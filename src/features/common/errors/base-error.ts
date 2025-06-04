// ABOUTME: Base error class hierarchy for consistent error handling
// ABOUTME: Provides structured errors with context, codes, and safe serialization

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error categories for grouping and handling
 */
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NETWORK = 'network',
  DATABASE = 'database',
  AI_SERVICE = 'ai_service',
  STORAGE = 'storage',
  CONFIGURATION = 'configuration',
  BUSINESS_LOGIC = 'business_logic',
  UNKNOWN = 'unknown',
}

/**
 * Error context for debugging without exposing PII
 */
export interface ErrorContext {
  userId?: string; // Hashed user ID
  sessionId?: string;
  correlationId?: string;
  timestamp: Date;
  url?: string;
  method?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Options for error creation
 */
export interface ErrorOptions {
  code: string;
  statusCode?: number;
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  context?: Partial<ErrorContext>;
  cause?: Error;
  isOperational?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Base error class for all application errors
 */
export class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context: ErrorContext;
  public readonly cause?: Error;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly metadata?: Record<string, any>;

  constructor(message: string, options: ErrorOptions) {
    super(message);
    
    // Ensure proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
    
    this.name = this.constructor.name;
    this.code = options.code;
    this.statusCode = options.statusCode || 500;
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.category = options.category || ErrorCategory.UNKNOWN;
    this.cause = options.cause;
    this.isOperational = options.isOperational ?? true;
    this.timestamp = new Date();
    this.metadata = options.metadata;
    
    // Build context with defaults
    this.context = {
      timestamp: this.timestamp,
      ...options.context,
    };
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to a safe JSON representation (no PII)
   */
  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      severity: this.severity,
      category: this.category,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.context.correlationId,
      isOperational: this.isOperational,
      // Exclude stack trace and cause in production
      ...(process.env.NODE_ENV !== 'production' && {
        stack: this.stack,
        cause: this.cause?.message,
      }),
    };
  }

  /**
   * Get user-friendly error message
   */
  public getUserMessage(): string {
    // Override in subclasses for specific user messages
    return 'An error occurred. Please try again or contact support if the issue persists.';
  }

  /**
   * Get error reference for support
   */
  public getErrorReference(): string {
    return `${this.code}-${this.context.correlationId?.substring(0, 8) || 'unknown'}`;
  }

  /**
   * Check if error is retryable
   */
  public isRetryable(): boolean {
    // Override in subclasses for specific retry logic
    return this.statusCode >= 500 || this.statusCode === 429;
  }

  /**
   * Get retry delay in milliseconds
   */
  public getRetryDelay(): number {
    // Default exponential backoff with jitter
    const baseDelay = 1000;
    const maxDelay = 30000;
    const attempt = (this.metadata?.retryAttempt as number) || 0;
    
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    
    return Math.floor(exponentialDelay + jitter);
  }
}

/**
 * Validation error for input validation failures
 */
export class ValidationError extends BaseError {
  public readonly validationErrors?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    validationErrors?: Array<{ field: string; message: string }>,
    options?: Partial<ErrorOptions>
  ) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      severity: ErrorSeverity.LOW,
      category: ErrorCategory.VALIDATION,
      ...options,
    });
    
    this.validationErrors = validationErrors;
  }

  public getUserMessage(): string {
    if (this.validationErrors && this.validationErrors.length > 0) {
      return `Invalid input: ${this.validationErrors.map(e => e.message).join(', ')}`;
    }
    return 'Invalid input provided. Please check your data and try again.';
  }

  public isRetryable(): boolean {
    return false; // Validation errors are not retryable
  }
}

/**
 * Authentication error for auth failures
 */
export class AuthenticationError extends BaseError {
  constructor(message: string, options?: Partial<ErrorOptions>) {
    super(message, {
      code: 'AUTH_ERROR',
      statusCode: 401,
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.AUTHENTICATION,
      isOperational: true,
      ...options,
    });
  }

  public getUserMessage(): string {
    return 'Authentication failed. Please sign in again.';
  }

  public isRetryable(): boolean {
    return false;
  }
}

/**
 * Authorization error for permission failures
 */
export class AuthorizationError extends BaseError {
  constructor(message: string, options?: Partial<ErrorOptions>) {
    super(message, {
      code: 'AUTHZ_ERROR',
      statusCode: 403,
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.AUTHORIZATION,
      isOperational: true,
      ...options,
    });
  }

  public getUserMessage(): string {
    return 'You do not have permission to perform this action.';
  }

  public isRetryable(): boolean {
    return false;
  }
}

/**
 * Not found error
 */
export class NotFoundError extends BaseError {
  constructor(resource: string, options?: Partial<ErrorOptions>) {
    super(`${resource} not found`, {
      code: 'NOT_FOUND',
      statusCode: 404,
      severity: ErrorSeverity.LOW,
      category: ErrorCategory.BUSINESS_LOGIC,
      ...options,
    });
  }

  public getUserMessage(): string {
    return 'The requested resource was not found.';
  }

  public isRetryable(): boolean {
    return false;
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends BaseError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number, options?: Partial<ErrorOptions>) {
    super(message, {
      code: 'RATE_LIMIT',
      statusCode: 429,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.NETWORK,
      ...options,
    });
    
    this.retryAfter = retryAfter;
  }

  public getUserMessage(): string {
    if (this.retryAfter) {
      return `Too many requests. Please try again in ${Math.ceil(this.retryAfter / 1000)} seconds.`;
    }
    return 'Too many requests. Please slow down and try again later.';
  }

  public getRetryDelay(): number {
    return this.retryAfter || super.getRetryDelay();
  }
}