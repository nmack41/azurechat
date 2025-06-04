// ABOUTME: Enhanced OpenAI service wrapper with comprehensive error handling
// ABOUTME: Provides retry logic, rate limiting, and structured error responses

import { OpenAI } from "openai";
import { OpenAIInstance, OpenAIEmbeddingInstance } from "./openai";
import { 
  OpenAIError, 
  ErrorCodes, 
  ErrorSerializer, 
  withRetry, 
  CircuitBreaker, 
  ErrorSeverity,
  type ErrorCode 
} from "../errors";

/**
 * OpenAI service configuration
 */
interface OpenAIServiceConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  enableCircuitBreaker: boolean;
  circuitBreakerFailureThreshold: number;
  circuitBreakerTimeoutMs: number;
}

/**
 * Default service configuration
 */
const DEFAULT_CONFIG: OpenAIServiceConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 30000,
  enableCircuitBreaker: true,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerTimeoutMs: 60000,
};

/**
 * Chat completion request options
 */
interface ChatCompletionOptions {
  correlationId?: string;
  userId?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  timeout?: number;
}

/**
 * Chat completion response
 */
interface ChatCompletionResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  model?: string;
}

/**
 * Enhanced OpenAI service with error handling
 */
export class OpenAIService {
  private client: OpenAI;
  private embeddingClient: OpenAI;
  private config: OpenAIServiceConfig;
  private circuitBreaker?: CircuitBreaker;

  constructor(config: Partial<OpenAIServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = OpenAIInstance();
    this.embeddingClient = OpenAIEmbeddingInstance();
    
    if (this.config.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker({
        failureThreshold: this.config.circuitBreakerFailureThreshold,
        successThreshold: 3,
        timeout: this.config.circuitBreakerTimeoutMs,
        onStateChange: (state) => {
          console.warn(`OpenAI Circuit breaker state changed to: ${state}`);
        },
      });
    }
  }

  /**
   * Create chat completion with error handling
   */
  public async createChatCompletion(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResponse> {
    const operation = async () => {
      try {
        const startTime = Date.now();
        
        const completion = await Promise.race([
          this.client.chat.completions.create({
            model: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME || "gpt-4",
            messages,
            max_tokens: options.maxTokens || 4000,
            temperature: options.temperature || 0.7,
            stream: false,
          }),
          this.createTimeoutPromise(options.timeout || this.config.timeoutMs),
        ]);

        const duration = Date.now() - startTime;
        
        // Log successful completion
        console.log(`OpenAI completion successful in ${duration}ms`, {
          correlationId: options.correlationId,
          tokenCount: completion.usage?.total_tokens,
          model: completion.model,
        });

        const choice = completion.choices[0];
        if (!choice || !choice.message) {
          throw new OpenAIError(
            'No completion choice returned',
            ErrorCodes.AI_008, // Invalid response
            {
              requestId: options.correlationId,
              modelUsed: completion.model,
            }
          );
        }

        return {
          content: choice.message.content || '',
          usage: completion.usage ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          } : undefined,
          finishReason: choice.finish_reason,
          model: completion.model,
        };

      } catch (error: any) {
        // Transform and rethrow as OpenAIError
        throw this.transformError(error, options.correlationId);
      }
    };

    // Execute with circuit breaker if enabled
    const executeOperation = this.circuitBreaker 
      ? () => this.circuitBreaker!.execute(operation)
      : operation;

    // Execute with retry logic
    return withRetry(executeOperation, {
      maxAttempts: this.config.maxRetries,
      baseDelay: this.config.retryDelayMs,
      retryIf: (error) => {
        if (error instanceof OpenAIError) {
          return error.isRetryable();
        }
        return false;
      },
    });
  }

  /**
   * Create streaming chat completion with error handling
   */
  public async createStreamingChatCompletion(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: ChatCompletionOptions = {}
  ): Promise<AsyncIterable<string>> {
    const operation = async () => {
      try {
        const stream = await this.client.chat.completions.create({
          model: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME || "gpt-4",
          messages,
          max_tokens: options.maxTokens || 4000,
          temperature: options.temperature || 0.7,
          stream: true,
        });

        return this.processStream(stream, options.correlationId);

      } catch (error: any) {
        throw this.transformError(error, options.correlationId);
      }
    };

    const executeOperation = this.circuitBreaker 
      ? () => this.circuitBreaker!.execute(operation)
      : operation;

    return executeOperation();
  }

  /**
   * Create embeddings with error handling
   */
  public async createEmbeddings(
    input: string | string[],
    options: { correlationId?: string; userId?: string } = {}
  ): Promise<number[][]> {
    const operation = async () => {
      try {
        const response = await this.embeddingClient.embeddings.create({
          model: process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME || "text-embedding-ada-002",
          input,
        });

        return response.data.map(embedding => embedding.embedding);

      } catch (error: any) {
        throw this.transformError(error, options.correlationId);
      }
    };

    const executeOperation = this.circuitBreaker 
      ? () => this.circuitBreaker!.execute(operation)
      : operation;

    return withRetry(executeOperation, {
      maxAttempts: this.config.maxRetries,
      baseDelay: this.config.retryDelayMs,
      retryIf: (error) => error instanceof OpenAIError && error.isRetryable(),
    });
  }

  /**
   * Process streaming response
   */
  private async *processStream(
    stream: AsyncIterable<OpenAI.ChatCompletionChunk>,
    correlationId?: string
  ): AsyncIterable<string> {
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          yield delta.content;
        }
      }
    } catch (error: any) {
      throw new OpenAIError(
        'Stream processing failed',
        ErrorCodes.AI_009, // Streaming error
        {
          requestId: correlationId,
        },
        {
          cause: error,
        }
      );
    }
  }

  /**
   * Transform OpenAI errors to our error format
   */
  private transformError(error: any, correlationId?: string): OpenAIError {
    // Handle timeout
    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      return new OpenAIError(
        'OpenAI request timed out',
        ErrorCodes.AI_007, // Timeout
        {
          requestId: correlationId,
        },
        {
          statusCode: 408,
          cause: error,
        }
      );
    }

    // Handle OpenAI API errors
    if (error.status || error.response?.status) {
      return OpenAIError.fromOpenAIResponse(error, correlationId);
    }

    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return new OpenAIError(
        'Failed to connect to OpenAI service',
        ErrorCodes.AI_001, // Service unavailable
        {
          requestId: correlationId,
        },
        {
          statusCode: 503,
          cause: error,
        }
      );
    }

    // Generic error
    return new OpenAIError(
      error.message || 'Unknown OpenAI error',
      ErrorCodes.AI_008, // Invalid response
      {
        requestId: correlationId,
      },
      {
        cause: error,
      }
    );
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('OpenAI request timeout'));
      }, timeoutMs);
    });
  }

  /**
   * Get service health status
   */
  public async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    circuitBreakerState?: string;
    lastError?: string;
    responseTime?: number;
  }> {
    try {
      const startTime = Date.now();
      
      // Simple health check with minimal token usage
      await this.createChatCompletion([
        { role: 'user', content: 'ping' }
      ], {
        maxTokens: 1,
        timeout: 5000,
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        circuitBreakerState: this.circuitBreaker?.getState(),
        responseTime,
      };
      
    } catch (error: any) {
      return {
        status: this.circuitBreaker?.getState() === 'open' ? 'unhealthy' : 'degraded',
        circuitBreakerState: this.circuitBreaker?.getState(),
        lastError: error.message,
      };
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics() {
    return {
      circuitBreaker: this.circuitBreaker?.getMetrics(),
      config: this.config,
    };
  }
}

/**
 * Global OpenAI service instance
 */
export const openAIService = new OpenAIService();