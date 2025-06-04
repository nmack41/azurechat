// ABOUTME: Central exports for error handling system
// ABOUTME: Provides unified access to all error classes and utilities

// Base error classes
export {
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ErrorSeverity,
  ErrorCategory,
  type ErrorOptions,
  type ErrorContext,
} from './base-error';

// Error codes
export {
  ErrorCodes,
  type ErrorCode,
  getErrorCategory,
  getUserMessage,
  isRetryableError,
  ErrorMetadata,
} from './error-codes';

// Service-specific errors
export {
  OpenAIError,
  CosmosError,
  StorageError,
  DocumentProcessingError,
  NetworkError,
} from './service-errors';

// Error serialization
export {
  ErrorSerializer,
} from './error-serializer';

// Utility functions for error handling
export * from './error-utils';