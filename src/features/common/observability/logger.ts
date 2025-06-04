// ABOUTME: Comprehensive logging service with PII redaction and structured output
// ABOUTME: Provides GDPR-compliant logging with different levels and contexts

import { ErrorSerializer } from '../errors';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Log categories for filtering and routing
 */
export enum LogCategory {
  APPLICATION = 'application',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  BUSINESS = 'business',
  INFRASTRUCTURE = 'infrastructure',
  AUDIT = 'audit',
}

/**
 * Log context interface
 */
export interface LogContext {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  operation?: string;
  component?: string;
  method?: string;
  url?: string;
  userAgent?: string;
  ipAddress?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: LogContext;
  error?: any;
  tags?: string[];
  environment: string;
  service: string;
  version: string;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  redactPII: boolean;
  service: string;
  version: string;
  environment: string;
  remoteEndpoint?: string;
  bufferSize: number;
  flushInterval: number;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: false,
  enableRemote: false,
  redactPII: true,
  service: 'azure-chat',
  version: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  bufferSize: 100,
  flushInterval: 5000, // 5 seconds
};

/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.FATAL]: 4,
};

/**
 * PII patterns to redact (extending ErrorSerializer patterns)
 */
const PII_PATTERNS = [
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  // Phone numbers
  /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  // Credit card numbers
  /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  // SSN patterns
  /\b\d{3}-\d{2}-\d{4}\b/g,
  // API keys and tokens (long alphanumeric strings)
  /\b[A-Za-z0-9]{32,}\b/g,
  // IP addresses (optional - might be needed for debugging)
  // /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
];

/**
 * Sensitive field names
 */
const SENSITIVE_FIELDS = new Set([
  'password', 'secret', 'token', 'key', 'authorization', 'cookie',
  'session', 'bearer', 'apikey', 'api_key', 'access_token', 'refresh_token',
  'client_secret', 'private_key', 'email', 'phone', 'ssn', 'credit_card',
  'card_number', 'cvv', 'pin', 'social_security', 'passport', 'license',
]);

/**
 * Comprehensive logger with PII redaction
 */
export class Logger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startFlushTimer();
  }

  /**
   * Debug level logging
   */
  public debug(
    message: string,
    context?: LogContext,
    category: LogCategory = LogCategory.APPLICATION
  ): void {
    this.log(LogLevel.DEBUG, message, context, category);
  }

  /**
   * Info level logging
   */
  public info(
    message: string,
    context?: LogContext,
    category: LogCategory = LogCategory.APPLICATION
  ): void {
    this.log(LogLevel.INFO, message, context, category);
  }

  /**
   * Warning level logging
   */
  public warn(
    message: string,
    context?: LogContext,
    category: LogCategory = LogCategory.APPLICATION
  ): void {
    this.log(LogLevel.WARN, message, context, category);
  }

  /**
   * Error level logging
   */
  public error(
    message: string,
    error?: unknown,
    context?: LogContext,
    category: LogCategory = LogCategory.APPLICATION
  ): void {
    this.log(LogLevel.ERROR, message, context, category, error);
  }

  /**
   * Fatal level logging
   */
  public fatal(
    message: string,
    error?: unknown,
    context?: LogContext,
    category: LogCategory = LogCategory.APPLICATION
  ): void {
    this.log(LogLevel.FATAL, message, context, category, error);
  }

  /**
   * Security event logging
   */
  public security(
    message: string,
    context?: LogContext,
    level: LogLevel = LogLevel.WARN
  ): void {
    this.log(level, message, context, LogCategory.SECURITY);
  }

  /**
   * Performance logging
   */
  public performance(
    message: string,
    context?: LogContext,
    level: LogLevel = LogLevel.INFO
  ): void {
    this.log(level, message, context, LogCategory.PERFORMANCE);
  }

  /**
   * Business event logging
   */
  public business(
    message: string,
    context?: LogContext,
    level: LogLevel = LogLevel.INFO
  ): void {
    this.log(level, message, context, LogCategory.BUSINESS);
  }

  /**
   * Audit logging
   */
  public audit(
    message: string,
    context?: LogContext,
    level: LogLevel = LogLevel.INFO
  ): void {
    this.log(level, message, context, LogCategory.AUDIT);
  }

  /**
   * Infrastructure logging
   */
  public infrastructure(
    message: string,
    context?: LogContext,
    level: LogLevel = LogLevel.INFO
  ): void {
    this.log(level, message, context, LogCategory.INFRASTRUCTURE);
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    category: LogCategory = LogCategory.APPLICATION,
    error?: unknown,
    tags?: string[]
  ): void {
    // Check if log level should be processed
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.level]) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message: this.config.redactPII ? this.redactPII(message) : message,
      context: this.config.redactPII && context ? this.redactContext(context) : context,
      error: error ? ErrorSerializer.serialize(error) : undefined,
      tags,
      environment: this.config.environment,
      service: this.config.service,
      version: this.config.version,
    };

    this.processLogEntry(logEntry);
  }

  /**
   * Process log entry through various outputs
   */
  private processLogEntry(entry: LogEntry): void {
    // Console output
    if (this.config.enableConsole) {
      this.writeToConsole(entry);
    }

    // Buffer for remote logging
    if (this.config.enableRemote) {
      this.buffer.push(entry);
      
      // Flush if buffer is full
      if (this.buffer.length >= this.config.bufferSize) {
        this.flushBuffer();
      }
    }

    // File output (if implemented)
    if (this.config.enableFile) {
      this.writeToFile(entry);
    }
  }

  /**
   * Write log entry to console with appropriate formatting
   */
  private writeToConsole(entry: LogEntry): void {
    const { timestamp, level, category, message, context, error } = entry;
    
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${category}]`;
    const contextStr = context ? ` [${context.correlationId || 'no-correlation'}]` : '';
    const fullMessage = `${prefix}${contextStr} ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(fullMessage, context, error);
        break;
      case LogLevel.INFO:
        console.info(fullMessage, context);
        break;
      case LogLevel.WARN:
        console.warn(fullMessage, context, error);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(fullMessage, context, error);
        break;
    }
  }

  /**
   * Write log entry to file (placeholder - implement based on needs)
   */
  private writeToFile(entry: LogEntry): void {
    // TODO: Implement file logging if needed
    // This could write to a rotating log file or send to a log management service
  }

  /**
   * Flush buffer to remote endpoint
   */
  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.remoteEndpoint) {
      return;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: entries }),
      });
    } catch (error) {
      // If remote logging fails, fall back to console
      console.error('Failed to send logs to remote endpoint:', error);
      // Put entries back in buffer for retry
      this.buffer.unshift(...entries);
    }
  }

  /**
   * Start flush timer for buffered logs
   */
  private startFlushTimer(): void {
    if (this.config.enableRemote && this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flushBuffer();
      }, this.config.flushInterval);
    }
  }

  /**
   * Stop flush timer
   */
  public stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Redact PII from string content
   */
  private redactPII(content: string): string {
    let redacted = content;
    
    for (const pattern of PII_PATTERNS) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }
    
    return redacted;
  }

  /**
   * Redact PII from context object
   */
  private redactContext(context: LogContext): LogContext {
    const redacted: LogContext = { ...context };
    
    // Redact sensitive fields
    for (const [key, value] of Object.entries(redacted)) {
      if (this.isSensitiveField(key) && typeof value === 'string') {
        (redacted as any)[key] = '[REDACTED]';
      }
    }

    // Redact metadata
    if (redacted.metadata) {
      redacted.metadata = this.redactObject(redacted.metadata);
    }

    // Redact PII from string fields
    if (redacted.userAgent) {
      redacted.userAgent = this.redactPII(redacted.userAgent);
    }
    
    if (redacted.url) {
      redacted.url = this.redactPII(redacted.url);
    }

    return redacted;
  }

  /**
   * Redact PII from generic object
   */
  private redactObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.redactPII(obj);
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObject(item));
    }

    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveField(key)) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = this.redactObject(value);
      }
    }

    return redacted;
  }

  /**
   * Check if field name is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    const lowerKey = fieldName.toLowerCase();
    return Array.from(SENSITIVE_FIELDS).some(field => lowerKey.includes(field));
  }

  /**
   * Set log level
   */
  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Get current configuration
   */
  public getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Create child logger with additional context
   */
  public child(additionalContext: Partial<LogContext>): Logger {
    const childLogger = new Logger(this.config);
    
    // Override log method to include additional context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level, message, context, category, error, tags) => {
      const mergedContext = { ...additionalContext, ...context };
      return originalLog(level, message, mergedContext, category, error, tags);
    };

    return childLogger;
  }

  /**
   * Flush any remaining logs and cleanup
   */
  public async shutdown(): Promise<void> {
    this.stopFlushTimer();
    await this.flushBuffer();
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger({
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableRemote: process.env.NODE_ENV === 'production',
  remoteEndpoint: process.env.LOG_ENDPOINT,
});

/**
 * Create logger for specific component
 */
export function createLogger(component: string, additionalContext?: Partial<LogContext>): Logger {
  return logger.child({
    component,
    ...additionalContext,
  });
}