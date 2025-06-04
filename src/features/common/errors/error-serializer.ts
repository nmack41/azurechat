// ABOUTME: Error serialization utilities for safe logging and monitoring
// ABOUTME: Ensures PII is redacted and errors are properly structured

import { BaseError } from './base-error';
import { createHash } from 'crypto';

/**
 * Sensitive data patterns to redact
 */
const SENSITIVE_PATTERNS = [
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  // Phone numbers (various formats)
  /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  // Credit card numbers
  /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  // SSN patterns
  /\b\d{3}-\d{2}-\d{4}\b/g,
  // API keys (common patterns)
  /\b[A-Za-z0-9]{32,}\b/g,
  // IP addresses (optional - might be needed for debugging)
  // /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
];

/**
 * Fields that should be completely redacted
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'secret',
  'token',
  'key',
  'authorization',
  'cookie',
  'session',
  'bearer',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
  'client_secret',
  'private_key',
  'email',
  'phone',
  'ssn',
  'credit_card',
  'card_number',
]);

/**
 * Redacted value placeholder
 */
const REDACTED = '[REDACTED]';

/**
 * Hash a value for safe logging while maintaining uniqueness
 */
function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

/**
 * Check if a field name contains sensitive information
 */
function isSensitiveField(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return Array.from(SENSITIVE_FIELDS).some(field => lowerKey.includes(field));
}

/**
 * Redact sensitive patterns from a string
 */
function redactPatterns(value: string): string {
  let redacted = value;
  
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTED);
  }
  
  return redacted;
}

/**
 * Recursively clean an object, removing or redacting sensitive data
 */
function cleanObject(obj: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[DEPTH_LIMIT_EXCEEDED]';
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return redactPatterns(obj);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: redactPatterns(obj.message),
      stack: process.env.NODE_ENV === 'production' ? undefined : obj.stack,
    };
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveField(key)) {
        // For sensitive fields, provide a hash for debugging while hiding the value
        if (typeof value === 'string' && value.length > 0) {
          cleaned[key] = `${REDACTED}_${hashValue(value)}`;
        } else {
          cleaned[key] = REDACTED;
        }
      } else {
        cleaned[key] = cleanObject(value, depth + 1);
      }
    }
    
    return cleaned;
  }
  
  // For functions, symbols, etc.
  return String(obj);
}

/**
 * Error serializer for safe logging
 */
export class ErrorSerializer {
  /**
   * Serialize an error for logging with PII redaction
   */
  public static serialize(error: unknown, context?: Record<string, any>): Record<string, any> {
    const timestamp = new Date().toISOString();
    
    // Handle BaseError instances
    if (error instanceof BaseError) {
      return {
        timestamp,
        type: 'BaseError',
        name: error.name,
        code: error.code,
        message: redactPatterns(error.message),
        statusCode: error.statusCode,
        severity: error.severity,
        category: error.category,
        isOperational: error.isOperational,
        correlationId: error.context.correlationId,
        errorReference: error.getErrorReference(),
        userMessage: error.getUserMessage(),
        context: cleanObject(error.context),
        metadata: cleanObject(error.metadata),
        cause: error.cause ? this.serialize(error.cause) : undefined,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
        additionalContext: cleanObject(context),
      };
    }
    
    // Handle standard Error instances
    if (error instanceof Error) {
      return {
        timestamp,
        type: 'Error',
        name: error.name,
        message: redactPatterns(error.message),
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
        additionalContext: cleanObject(context),
      };
    }
    
    // Handle other types
    return {
      timestamp,
      type: typeof error,
      value: cleanObject(error),
      additionalContext: cleanObject(context),
    };
  }

  /**
   * Serialize an error for user display (minimal information)
   */
  public static serializeForUser(error: unknown): { message: string; reference?: string } {
    if (error instanceof BaseError) {
      return {
        message: error.getUserMessage(),
        reference: error.getErrorReference(),
      };
    }
    
    if (error instanceof Error) {
      // Don't expose internal error messages to users
      return {
        message: 'An error occurred. Please try again or contact support if the issue persists.',
      };
    }
    
    return {
      message: 'An unexpected error occurred. Please try again or contact support.',
    };
  }

  /**
   * Serialize an error for monitoring/alerting (structured for metrics)
   */
  public static serializeForMetrics(error: unknown): Record<string, string | number> {
    const base = {
      timestamp: Date.now(),
      severity: 'unknown',
      category: 'unknown',
      code: 'UNKNOWN_ERROR',
      isOperational: false,
    };
    
    if (error instanceof BaseError) {
      return {
        ...base,
        severity: error.severity,
        category: error.category,
        code: error.code,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        isRetryable: error.isRetryable(),
      };
    }
    
    if (error instanceof Error) {
      return {
        ...base,
        name: error.name,
        hasStack: !!error.stack,
      };
    }
    
    return {
      ...base,
      type: typeof error,
    };
  }

  /**
   * Create a correlation ID for tracking related errors
   */
  public static createCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Extract actionable information for debugging (safe for logs)
   */
  public static extractDebugInfo(error: unknown): Record<string, any> {
    const debugInfo: Record<string, any> = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
    };
    
    if (error instanceof BaseError) {
      debugInfo.errorCode = error.code;
      debugInfo.errorCategory = error.category;
      debugInfo.isRetryable = error.isRetryable();
      debugInfo.correlationId = error.context.correlationId;
      
      // Include service-specific debug info if available
      if ('openaiCode' in error) {
        debugInfo.openaiCode = error.openaiCode;
        debugInfo.requestId = error.requestId;
      }
      
      if ('cosmosCode' in error) {
        debugInfo.cosmosCode = error.cosmosCode;
        debugInfo.activityId = error.activityId;
      }
      
      if ('storageCode' in error) {
        debugInfo.storageCode = error.storageCode;
        debugInfo.containerName = error.containerName;
      }
    }
    
    return debugInfo;
  }
}