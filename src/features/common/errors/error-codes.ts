// ABOUTME: Centralized error codes for consistent error identification
// ABOUTME: Semantic codes help with debugging, monitoring, and support

/**
 * Error code structure: CATEGORY_SPECIFIC_ERROR
 * - CHAT_xxx: Chat-related errors
 * - AUTH_xxx: Authentication/authorization errors
 * - AI_xxx: AI service errors
 * - DB_xxx: Database errors
 * - STORAGE_xxx: Storage service errors
 * - DOC_xxx: Document processing errors
 * - VAL_xxx: Validation errors
 * - NET_xxx: Network errors
 * - CONFIG_xxx: Configuration errors
 * - SYS_xxx: System errors
 */

export const ErrorCodes = {
  // Chat errors (CHAT_xxx)
  CHAT_001: 'CHAT_MESSAGE_TOO_LONG',
  CHAT_002: 'CHAT_THREAD_NOT_FOUND',
  CHAT_003: 'CHAT_MESSAGE_SEND_FAILED',
  CHAT_004: 'CHAT_HISTORY_LOAD_FAILED',
  CHAT_005: 'CHAT_STREAM_INTERRUPTED',
  CHAT_006: 'CHAT_CONTEXT_EXCEEDED',
  CHAT_007: 'CHAT_INVALID_MESSAGE_FORMAT',
  CHAT_008: 'CHAT_THREAD_ACCESS_DENIED',
  CHAT_009: 'CHAT_CONCURRENT_SUBMISSION',
  CHAT_010: 'CHAT_ATTACHMENT_FAILED',

  // Authentication errors (AUTH_xxx)
  AUTH_001: 'AUTH_INVALID_CREDENTIALS',
  AUTH_002: 'AUTH_SESSION_EXPIRED',
  AUTH_003: 'AUTH_TOKEN_INVALID',
  AUTH_004: 'AUTH_USER_NOT_FOUND',
  AUTH_005: 'AUTH_PROVIDER_ERROR',
  AUTH_006: 'AUTH_MFA_REQUIRED',
  AUTH_007: 'AUTH_ACCOUNT_LOCKED',
  AUTH_008: 'AUTH_PASSWORD_EXPIRED',
  AUTH_009: 'AUTH_INSUFFICIENT_PRIVILEGES',
  AUTH_010: 'AUTH_ADMIN_REQUIRED',

  // AI service errors (AI_xxx)
  AI_001: 'AI_SERVICE_UNAVAILABLE',
  AI_002: 'AI_RATE_LIMIT_EXCEEDED',
  AI_003: 'AI_TOKEN_LIMIT_EXCEEDED',
  AI_004: 'AI_CONTENT_FILTERED',
  AI_005: 'AI_INVALID_MODEL',
  AI_006: 'AI_QUOTA_EXCEEDED',
  AI_007: 'AI_TIMEOUT',
  AI_008: 'AI_INVALID_RESPONSE',
  AI_009: 'AI_STREAMING_ERROR',
  AI_010: 'AI_CONTEXT_LENGTH_EXCEEDED',

  // Database errors (DB_xxx)
  DB_001: 'DB_CONNECTION_FAILED',
  DB_002: 'DB_QUERY_FAILED',
  DB_003: 'DB_TRANSACTION_FAILED',
  DB_004: 'DB_RECORD_NOT_FOUND',
  DB_005: 'DB_DUPLICATE_KEY',
  DB_006: 'DB_CONSTRAINT_VIOLATION',
  DB_007: 'DB_TIMEOUT',
  DB_008: 'DB_OPTIMISTIC_LOCK_FAILED',
  DB_009: 'DB_PARTITION_KEY_MISMATCH',
  DB_010: 'DB_THROUGHPUT_EXCEEDED',

  // Storage errors (STORAGE_xxx)
  STORAGE_001: 'STORAGE_UPLOAD_FAILED',
  STORAGE_002: 'STORAGE_DOWNLOAD_FAILED',
  STORAGE_003: 'STORAGE_FILE_NOT_FOUND',
  STORAGE_004: 'STORAGE_ACCESS_DENIED',
  STORAGE_005: 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_006: 'STORAGE_INVALID_FILE_TYPE',
  STORAGE_007: 'STORAGE_FILE_TOO_LARGE',
  STORAGE_008: 'STORAGE_SAS_TOKEN_EXPIRED',
  STORAGE_009: 'STORAGE_CONTAINER_NOT_FOUND',
  STORAGE_010: 'STORAGE_OPERATION_TIMEOUT',

  // Document processing errors (DOC_xxx)
  DOC_001: 'DOC_PROCESSING_FAILED',
  DOC_002: 'DOC_UNSUPPORTED_FORMAT',
  DOC_003: 'DOC_EXTRACTION_FAILED',
  DOC_004: 'DOC_TOO_MANY_PAGES',
  DOC_005: 'DOC_CORRUPTED_FILE',
  DOC_006: 'DOC_OCR_FAILED',
  DOC_007: 'DOC_ANALYSIS_TIMEOUT',
  DOC_008: 'DOC_LANGUAGE_NOT_SUPPORTED',
  DOC_009: 'DOC_SIZE_EXCEEDED',
  DOC_010: 'DOC_INDEX_FAILED',

  // Validation errors (VAL_xxx)
  VAL_001: 'VAL_REQUIRED_FIELD_MISSING',
  VAL_002: 'VAL_INVALID_FORMAT',
  VAL_003: 'VAL_OUT_OF_RANGE',
  VAL_004: 'VAL_INVALID_EMAIL',
  VAL_005: 'VAL_INVALID_URL',
  VAL_006: 'VAL_CONTAINS_PROHIBITED_CONTENT',
  VAL_007: 'VAL_INVALID_FILE_TYPE',
  VAL_008: 'VAL_STRING_TOO_LONG',
  VAL_009: 'VAL_INVALID_JSON',
  VAL_010: 'VAL_SCHEMA_MISMATCH',

  // Network errors (NET_xxx)
  NET_001: 'NET_CONNECTION_FAILED',
  NET_002: 'NET_TIMEOUT',
  NET_003: 'NET_DNS_FAILED',
  NET_004: 'NET_SSL_ERROR',
  NET_005: 'NET_PROXY_ERROR',
  NET_006: 'NET_OFFLINE',
  NET_007: 'NET_CORS_ERROR',
  NET_008: 'NET_REQUEST_ABORTED',
  NET_009: 'NET_RESPONSE_TOO_LARGE',
  NET_010: 'NET_WEBSOCKET_FAILED',

  // Configuration errors (CONFIG_xxx)
  CONFIG_001: 'CONFIG_MISSING_ENV_VAR',
  CONFIG_002: 'CONFIG_INVALID_VALUE',
  CONFIG_003: 'CONFIG_SERVICE_NOT_CONFIGURED',
  CONFIG_004: 'CONFIG_FEATURE_DISABLED',
  CONFIG_005: 'CONFIG_INVALID_CREDENTIALS',
  CONFIG_006: 'CONFIG_REGION_MISMATCH',
  CONFIG_007: 'CONFIG_VERSION_MISMATCH',
  CONFIG_008: 'CONFIG_DEPRECATED_SETTING',
  CONFIG_009: 'CONFIG_CONFLICTING_VALUES',
  CONFIG_010: 'CONFIG_LOAD_FAILED',

  // System errors (SYS_xxx)
  SYS_001: 'SYS_OUT_OF_MEMORY',
  SYS_002: 'SYS_DISK_FULL',
  SYS_003: 'SYS_PROCESS_CRASHED',
  SYS_004: 'SYS_UNHANDLED_ERROR',
  SYS_005: 'SYS_INITIALIZATION_FAILED',
  SYS_006: 'SYS_SHUTDOWN_IN_PROGRESS',
  SYS_007: 'SYS_RESOURCE_EXHAUSTED',
  SYS_008: 'SYS_CIRCUIT_BREAKER_OPEN',
  SYS_009: 'SYS_HEALTH_CHECK_FAILED',
  SYS_010: 'SYS_DEPENDENCY_FAILED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Get error category from error code
 */
export function getErrorCategory(code: ErrorCode): string {
  const prefix = code.split('_')[0];
  const categoryMap: Record<string, string> = {
    CHAT: 'Chat Operations',
    AUTH: 'Authentication & Authorization',
    AI: 'AI Services',
    DB: 'Database Operations',
    STORAGE: 'Storage Services',
    DOC: 'Document Processing',
    VAL: 'Input Validation',
    NET: 'Network Operations',
    CONFIG: 'Configuration',
    SYS: 'System',
  };
  
  return categoryMap[prefix] || 'Unknown';
}

/**
 * Error code metadata for additional context
 */
export const ErrorMetadata: Record<ErrorCode, { 
  description: string; 
  userMessage: string;
  isRetryable: boolean;
}> = {
  // Chat errors
  [ErrorCodes.CHAT_001]: {
    description: 'Message exceeds maximum allowed length',
    userMessage: 'Your message is too long. Please shorten it and try again.',
    isRetryable: false,
  },
  [ErrorCodes.CHAT_002]: {
    description: 'Chat thread not found in database',
    userMessage: 'This conversation could not be found.',
    isRetryable: false,
  },
  [ErrorCodes.CHAT_003]: {
    description: 'Failed to send chat message',
    userMessage: 'Failed to send your message. Please try again.',
    isRetryable: true,
  },
  [ErrorCodes.CHAT_005]: {
    description: 'AI response stream was interrupted',
    userMessage: 'The response was interrupted. Please try again.',
    isRetryable: true,
  },
  [ErrorCodes.CHAT_009]: {
    description: 'Multiple messages submitted simultaneously',
    userMessage: 'Please wait for the current message to complete before sending another.',
    isRetryable: false,
  },

  // AI errors
  [ErrorCodes.AI_002]: {
    description: 'OpenAI API rate limit exceeded',
    userMessage: 'Too many requests. Please wait a moment before trying again.',
    isRetryable: true,
  },
  [ErrorCodes.AI_003]: {
    description: 'Request exceeds token limit',
    userMessage: 'Your request is too long. Please shorten it and try again.',
    isRetryable: false,
  },
  [ErrorCodes.AI_004]: {
    description: 'Content filtered by AI safety system',
    userMessage: 'Your message was blocked by our safety filters. Please rephrase and try again.',
    isRetryable: false,
  },

  // Storage errors
  [ErrorCodes.STORAGE_006]: {
    description: 'Uploaded file type not allowed',
    userMessage: 'This file type is not supported. Please upload a different file.',
    isRetryable: false,
  },
  [ErrorCodes.STORAGE_007]: {
    description: 'File size exceeds maximum allowed',
    userMessage: 'This file is too large. Please upload a smaller file.',
    isRetryable: false,
  },

  // Add more metadata as needed...
  
  // Default for unmapped codes
  SYS_004: {
    description: 'Unhandled system error',
    userMessage: 'An unexpected error occurred. Please try again or contact support.',
    isRetryable: true,
  },
};

/**
 * Get user-friendly message for error code
 */
export function getUserMessage(code: ErrorCode): string {
  return ErrorMetadata[code]?.userMessage || 
    'An error occurred. Please try again or contact support.';
}

/**
 * Check if error code represents a retryable error
 */
export function isRetryableError(code: ErrorCode): boolean {
  return ErrorMetadata[code]?.isRetryable ?? true;
}