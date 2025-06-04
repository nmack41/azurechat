// ABOUTME: Enhanced Cosmos DB service wrapper with comprehensive error handling
// ABOUTME: Provides retry logic, connection pooling, and structured error responses

import { Container, ItemResponse, FeedResponse, SqlQuerySpec } from "@azure/cosmos";
import { ConfigContainer, HistoryContainer } from "./cosmos";
import { 
  CosmosError, 
  ErrorCodes, 
  ErrorSerializer, 
  withRetry, 
  CircuitBreaker, 
  ErrorSeverity 
} from "../errors";

/**
 * Cosmos DB service configuration
 */
interface CosmosServiceConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  enableCircuitBreaker: boolean;
  circuitBreakerFailureThreshold: number;
  circuitBreakerTimeoutMs: number;
  maxItemCount: number;
}

/**
 * Default service configuration
 */
const DEFAULT_CONFIG: CosmosServiceConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 10000,
  enableCircuitBreaker: true,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerTimeoutMs: 60000,
  maxItemCount: 100,
};

/**
 * Query options
 */
interface QueryOptions {
  correlationId?: string;
  userId?: string;
  maxItemCount?: number;
  continuationToken?: string;
  timeout?: number;
}

/**
 * Item operation options
 */
interface ItemOptions {
  correlationId?: string;
  userId?: string;
  timeout?: number;
  etag?: string;
}

/**
 * Enhanced Cosmos DB service with error handling
 */
export class CosmosService {
  private config: CosmosServiceConfig;
  private historyCircuitBreaker?: CircuitBreaker;
  private configCircuitBreaker?: CircuitBreaker;

  constructor(config: Partial<CosmosServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enableCircuitBreaker) {
      this.historyCircuitBreaker = new CircuitBreaker({
        failureThreshold: this.config.circuitBreakerFailureThreshold,
        successThreshold: 3,
        timeout: this.config.circuitBreakerTimeoutMs,
        onStateChange: (state) => {
          console.warn(`Cosmos History circuit breaker state changed to: ${state}`);
        },
      });

      this.configCircuitBreaker = new CircuitBreaker({
        failureThreshold: this.config.circuitBreakerFailureThreshold,
        successThreshold: 3,
        timeout: this.config.circuitBreakerTimeoutMs,
        onStateChange: (state) => {
          console.warn(`Cosmos Config circuit breaker state changed to: ${state}`);
        },
      });
    }
  }

  /**
   * Query items from history container
   */
  public async queryHistory<T>(
    query: string | SqlQuerySpec,
    partitionKey?: string,
    options: QueryOptions = {}
  ): Promise<T[]> {
    const operation = async () => {
      try {
        const container = HistoryContainer();
        const startTime = Date.now();

        const querySpec = typeof query === 'string' ? { query } : query;
        const queryIterator = container.items.query(querySpec, {
          maxItemCount: options.maxItemCount || this.config.maxItemCount,
          continuationToken: options.continuationToken,
          partitionKey,
        });

        const response = await Promise.race([
          queryIterator.fetchAll(),
          this.createTimeoutPromise(options.timeout || this.config.timeoutMs),
        ]);

        const duration = Date.now() - startTime;
        
        console.log(`Cosmos query completed in ${duration}ms`, {
          correlationId: options.correlationId,
          itemCount: response.resources.length,
          requestCharge: response.requestCharge,
        });

        return response.resources;

      } catch (error: any) {
        throw this.transformError(error, options.correlationId, 'query');
      }
    };

    const executeOperation = this.historyCircuitBreaker 
      ? () => this.historyCircuitBreaker!.execute(operation)
      : operation;

    return withRetry(executeOperation, {
      maxAttempts: this.config.maxRetries,
      baseDelay: this.config.retryDelayMs,
      retryIf: (error) => error instanceof CosmosError && error.isRetryable(),
    });
  }

  /**
   * Get item from history container
   */
  public async getHistoryItem<T>(
    id: string,
    partitionKey: string,
    options: ItemOptions = {}
  ): Promise<T | null> {
    const operation = async () => {
      try {
        const container = HistoryContainer();
        const startTime = Date.now();

        const response = await Promise.race([
          container.item(id, partitionKey).read<T>(),
          this.createTimeoutPromise(options.timeout || this.config.timeoutMs),
        ]);

        const duration = Date.now() - startTime;
        
        console.log(`Cosmos read completed in ${duration}ms`, {
          correlationId: options.correlationId,
          itemId: id,
          requestCharge: response.requestCharge,
        });

        return response.resource || null;

      } catch (error: any) {
        if (this.isNotFoundError(error)) {
          return null;
        }
        throw this.transformError(error, options.correlationId, 'read');
      }
    };

    const executeOperation = this.historyCircuitBreaker 
      ? () => this.historyCircuitBreaker!.execute(operation)
      : operation;

    return withRetry(executeOperation, {
      maxAttempts: this.config.maxRetries,
      baseDelay: this.config.retryDelayMs,
      retryIf: (error) => error instanceof CosmosError && error.isRetryable(),
    });
  }

  /**
   * Create item in history container
   */
  public async createHistoryItem<T>(
    item: T,
    options: ItemOptions = {}
  ): Promise<T> {
    const operation = async () => {
      try {
        const container = HistoryContainer();
        const startTime = Date.now();

        const response = await Promise.race([
          container.items.create<T>(item),
          this.createTimeoutPromise(options.timeout || this.config.timeoutMs),
        ]);

        const duration = Date.now() - startTime;
        
        console.log(`Cosmos create completed in ${duration}ms`, {
          correlationId: options.correlationId,
          requestCharge: response.requestCharge,
        });

        return response.resource;

      } catch (error: any) {
        throw this.transformError(error, options.correlationId, 'create');
      }
    };

    const executeOperation = this.historyCircuitBreaker 
      ? () => this.historyCircuitBreaker!.execute(operation)
      : operation;

    return withRetry(executeOperation, {
      maxAttempts: this.config.maxRetries,
      baseDelay: this.config.retryDelayMs,
      retryIf: (error) => error instanceof CosmosError && error.isRetryable(),
    });
  }

  /**
   * Update item in history container
   */
  public async updateHistoryItem<T>(
    id: string,
    partitionKey: string,
    item: T,
    options: ItemOptions = {}
  ): Promise<T> {
    const operation = async () => {
      try {
        const container = HistoryContainer();
        const startTime = Date.now();

        const requestOptions: any = {};
        if (options.etag) {
          requestOptions.accessCondition = { type: 'IfMatch', condition: options.etag };
        }

        const response = await Promise.race([
          container.item(id, partitionKey).replace<T>(item, requestOptions),
          this.createTimeoutPromise(options.timeout || this.config.timeoutMs),
        ]);

        const duration = Date.now() - startTime;
        
        console.log(`Cosmos update completed in ${duration}ms`, {
          correlationId: options.correlationId,
          itemId: id,
          requestCharge: response.requestCharge,
        });

        return response.resource;

      } catch (error: any) {
        throw this.transformError(error, options.correlationId, 'update');
      }
    };

    const executeOperation = this.historyCircuitBreaker 
      ? () => this.historyCircuitBreaker!.execute(operation)
      : operation;

    return withRetry(executeOperation, {
      maxAttempts: this.config.maxRetries,
      baseDelay: this.config.retryDelayMs,
      retryIf: (error) => error instanceof CosmosError && error.isRetryable(),
    });
  }

  /**
   * Delete item from history container
   */
  public async deleteHistoryItem(
    id: string,
    partitionKey: string,
    options: ItemOptions = {}
  ): Promise<void> {
    const operation = async () => {
      try {
        const container = HistoryContainer();
        const startTime = Date.now();

        const response = await Promise.race([
          container.item(id, partitionKey).delete(),
          this.createTimeoutPromise(options.timeout || this.config.timeoutMs),
        ]);

        const duration = Date.now() - startTime;
        
        console.log(`Cosmos delete completed in ${duration}ms`, {
          correlationId: options.correlationId,
          itemId: id,
          requestCharge: response.requestCharge,
        });

      } catch (error: any) {
        if (this.isNotFoundError(error)) {
          return; // Item already deleted
        }
        throw this.transformError(error, options.correlationId, 'delete');
      }
    };

    const executeOperation = this.historyCircuitBreaker 
      ? () => this.historyCircuitBreaker!.execute(operation)
      : operation;

    return withRetry(executeOperation, {
      maxAttempts: this.config.maxRetries,
      baseDelay: this.config.retryDelayMs,
      retryIf: (error) => error instanceof CosmosError && error.isRetryable(),
    });
  }

  /**
   * Get configuration item
   */
  public async getConfigItem<T>(
    id: string,
    partitionKey: string,
    options: ItemOptions = {}
  ): Promise<T | null> {
    const operation = async () => {
      try {
        const container = ConfigContainer();
        const startTime = Date.now();

        const response = await Promise.race([
          container.item(id, partitionKey).read<T>(),
          this.createTimeoutPromise(options.timeout || this.config.timeoutMs),
        ]);

        const duration = Date.now() - startTime;
        
        console.log(`Cosmos config read completed in ${duration}ms`, {
          correlationId: options.correlationId,
          configId: id,
          requestCharge: response.requestCharge,
        });

        return response.resource || null;

      } catch (error: any) {
        if (this.isNotFoundError(error)) {
          return null;
        }
        throw this.transformError(error, options.correlationId, 'config-read');
      }
    };

    const executeOperation = this.configCircuitBreaker 
      ? () => this.configCircuitBreaker!.execute(operation)
      : operation;

    return withRetry(executeOperation, {
      maxAttempts: this.config.maxRetries,
      baseDelay: this.config.retryDelayMs,
      retryIf: (error) => error instanceof CosmosError && error.isRetryable(),
    });
  }

  /**
   * Transform Cosmos DB errors to our error format
   */
  private transformError(error: any, correlationId?: string, operation?: string): CosmosError {
    return CosmosError.fromCosmosResponse(error);
  }

  /**
   * Check if error is a not found error
   */
  private isNotFoundError(error: any): boolean {
    return error.code === 404 || error.statusCode === 404;
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Cosmos DB request timeout'));
      }, timeoutMs);
    });
  }

  /**
   * Get service health status
   */
  public async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    historyContainer?: string;
    configContainer?: string;
    lastError?: string;
    responseTime?: number;
  }> {
    try {
      const startTime = Date.now();
      
      // Simple health check - try to read a system item
      await this.getConfigItem('_health', '_system', { timeout: 5000 });
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        historyContainer: this.historyCircuitBreaker?.getState(),
        configContainer: this.configCircuitBreaker?.getState(),
        responseTime,
      };
      
    } catch (error: any) {
      const isUnhealthy = 
        this.historyCircuitBreaker?.getState() === 'open' ||
        this.configCircuitBreaker?.getState() === 'open';
        
      return {
        status: isUnhealthy ? 'unhealthy' : 'degraded',
        historyContainer: this.historyCircuitBreaker?.getState(),
        configContainer: this.configCircuitBreaker?.getState(),
        lastError: error.message,
      };
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics() {
    return {
      historyCircuitBreaker: this.historyCircuitBreaker?.getMetrics(),
      configCircuitBreaker: this.configCircuitBreaker?.getMetrics(),
      config: this.config,
    };
  }
}

/**
 * Global Cosmos service instance
 */
export const cosmosService = new CosmosService();