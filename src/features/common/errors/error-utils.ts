// ABOUTME: Utility functions for error handling and recovery
// ABOUTME: Provides helpers for retry logic, error classification, and recovery

import { BaseError, ErrorSeverity, ErrorCategory } from './base-error';
import { ErrorSerializer } from './error-serializer';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
  retryIf?: (error: unknown) => boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  retryIf: (error) => {
    if (error instanceof BaseError) {
      return error.isRetryable();
    }
    // Default to retrying for unknown errors
    return true;
  },
};

/**
 * Calculate retry delay with exponential backoff and jitter
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponentialDelay = Math.min(
    config.baseDelay * Math.pow(config.backoffFactor, attempt),
    config.maxDelay
  );
  
  if (config.jitter) {
    const jitterAmount = 0.3 * exponentialDelay;
    const jitter = (Math.random() - 0.5) * 2 * jitterAmount;
    return Math.max(0, Math.floor(exponentialDelay + jitter));
  }
  
  return exponentialDelay;
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;
  
  for (let attempt = 0; attempt < retryConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (!retryConfig.retryIf!(error)) {
        throw error;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === retryConfig.maxAttempts - 1) {
        throw error;
      }
      
      // Calculate delay and wait
      const delay = calculateRetryDelay(attempt, retryConfig);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Circuit breaker state
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  onStateChange?: (state: CircuitBreakerState) => void;
}

/**
 * Simple circuit breaker implementation
 */
export class CircuitBreaker {
  private state = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  constructor(private config: CircuitBreakerConfig) {}

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.config.timeout) {
        throw new BaseError('Circuit breaker is open', {
          code: 'SYS_008',
          statusCode: 503,
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.UNKNOWN,
        });
      }
      
      this.state = CircuitBreakerState.HALF_OPEN;
      this.config.onStateChange?.(this.state);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.successCount = 0;
        this.config.onStateChange?.(this.state);
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.successCount = 0;
      this.config.onStateChange?.(this.state);
    }
  }

  public getState(): CircuitBreakerState {
    return this.state;
  }

  public getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Error classification utilities
 */
export class ErrorClassifier {
  /**
   * Determine if an error is a client error (4xx)
   */
  public static isClientError(error: unknown): boolean {
    if (error instanceof BaseError) {
      return error.statusCode >= 400 && error.statusCode < 500;
    }
    return false;
  }

  /**
   * Determine if an error is a server error (5xx)
   */
  public static isServerError(error: unknown): boolean {
    if (error instanceof BaseError) {
      return error.statusCode >= 500;
    }
    return true; // Assume unknown errors are server errors
  }

  /**
   * Determine if an error requires immediate attention
   */
  public static isHighSeverity(error: unknown): boolean {
    if (error instanceof BaseError) {
      return [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL].includes(error.severity);
    }
    return true; // Assume unknown errors are high severity
  }

  /**
   * Determine if an error indicates a system problem
   */
  public static isSystemError(error: unknown): boolean {
    if (error instanceof BaseError) {
      return [
        ErrorCategory.DATABASE,
        ErrorCategory.AI_SERVICE,
        ErrorCategory.STORAGE,
        ErrorCategory.CONFIGURATION,
      ].includes(error.category);
    }
    return false;
  }
}

/**
 * Error aggregation for monitoring
 */
export class ErrorAggregator {
  private errorCounts = new Map<string, number>();
  private lastReset = Date.now();
  private resetInterval = 60000; // 1 minute

  /**
   * Record an error occurrence
   */
  public record(error: unknown): void {
    this.maybeReset();
    
    const key = this.getErrorKey(error);
    const current = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, current + 1);
  }

  /**
   * Get error statistics
   */
  public getStats(): Record<string, number> {
    this.maybeReset();
    return Object.fromEntries(this.errorCounts);
  }

  /**
   * Get top errors by frequency
   */
  public getTopErrors(limit = 10): Array<{ error: string; count: number }> {
    this.maybeReset();
    
    return Array.from(this.errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private getErrorKey(error: unknown): string {
    if (error instanceof BaseError) {
      return `${error.code}:${error.category}`;
    }
    
    if (error instanceof Error) {
      return `${error.name}:${error.constructor.name}`;
    }
    
    return `unknown:${typeof error}`;
  }

  private maybeReset(): void {
    const now = Date.now();
    if (now - this.lastReset > this.resetInterval) {
      this.errorCounts.clear();
      this.lastReset = now;
    }
  }
}

/**
 * Global error aggregator instance
 */
export const globalErrorAggregator = new ErrorAggregator();

/**
 * Error recovery strategies
 */
export interface RecoveryStrategy<T> {
  name: string;
  canHandle: (error: unknown) => boolean;
  recover: (error: unknown, context?: any) => Promise<T>;
}

/**
 * Error recovery manager
 */
export class ErrorRecoveryManager<T> {
  private strategies: RecoveryStrategy<T>[] = [];

  /**
   * Register a recovery strategy
   */
  public registerStrategy(strategy: RecoveryStrategy<T>): void {
    this.strategies.push(strategy);
  }

  /**
   * Attempt to recover from an error
   */
  public async recover(error: unknown, context?: any): Promise<T> {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(error)) {
        try {
          return await strategy.recover(error, context);
        } catch (recoveryError) {
          // Log recovery failure but continue to next strategy
          console.warn(`Recovery strategy ${strategy.name} failed:`, 
            ErrorSerializer.serialize(recoveryError));
        }
      }
    }
    
    // No recovery strategy could handle this error
    throw error;
  }
}

/**
 * Safe error execution wrapper
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  fallback?: T,
  onError?: (error: unknown) => void
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    globalErrorAggregator.record(error);
    onError?.(error);
    return fallback;
  }
}