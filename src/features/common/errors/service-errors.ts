// ABOUTME: Service-specific error classes for Azure services
// ABOUTME: Handles OpenAI, Cosmos DB, Storage, and other Azure service errors

import { BaseError, ErrorSeverity, ErrorCategory, ErrorOptions } from './base-error';
import { ErrorCodes, type ErrorCode } from './error-codes';

/**
 * OpenAI/Azure OpenAI service errors
 */
export class OpenAIError extends BaseError {
  public readonly openaiCode?: string;
  public readonly requestId?: string;
  public readonly modelUsed?: string;
  public readonly tokensUsed?: number;

  constructor(
    message: string,
    code: ErrorCode,
    openaiDetails?: {
      openaiCode?: string;
      requestId?: string;
      modelUsed?: string;
      tokensUsed?: number;
    },
    options?: Partial<ErrorOptions>
  ) {
    super(message, {
      code,
      category: ErrorCategory.AI_SERVICE,
      severity: ErrorSeverity.HIGH,
      ...options,
    });

    this.openaiCode = openaiDetails?.openaiCode;
    this.requestId = openaiDetails?.requestId;
    this.modelUsed = openaiDetails?.modelUsed;
    this.tokensUsed = openaiDetails?.tokensUsed;
  }

  public static fromOpenAIResponse(error: any, requestId?: string): OpenAIError {
    const message = error.message || 'OpenAI service error';
    const status = error.status || error.response?.status;
    
    // Map OpenAI status codes to our error codes
    let code: ErrorCode;
    let severity = ErrorSeverity.HIGH;
    
    switch (status) {
      case 400:
        code = ErrorCodes.AI_010; // Context length exceeded
        severity = ErrorSeverity.MEDIUM;
        break;
      case 401:
        code = ErrorCodes.CONFIG_005; // Invalid credentials
        severity = ErrorSeverity.CRITICAL;
        break;
      case 403:
        code = ErrorCodes.AI_004; // Content filtered
        severity = ErrorSeverity.LOW;
        break;
      case 429:
        code = ErrorCodes.AI_002; // Rate limit
        severity = ErrorSeverity.MEDIUM;
        break;
      case 503:
        code = ErrorCodes.AI_001; // Service unavailable
        severity = ErrorSeverity.HIGH;
        break;
      default:
        code = ErrorCodes.AI_008; // Invalid response
        severity = ErrorSeverity.HIGH;
    }

    return new OpenAIError(
      message,
      code,
      {
        openaiCode: error.code,
        requestId,
      },
      {
        statusCode: status,
        severity,
        cause: error,
      }
    );
  }

  public isRetryable(): boolean {
    return [
      ErrorCodes.AI_001, // Service unavailable
      ErrorCodes.AI_002, // Rate limit
      ErrorCodes.AI_007, // Timeout
      ErrorCodes.AI_009, // Streaming error
    ].includes(this.code as ErrorCode);
  }

  public getRetryDelay(): number {
    if (this.code === ErrorCodes.AI_002) {
      // For rate limits, use a longer delay
      const baseDelay = 5000; // 5 seconds
      const attempt = (this.metadata?.retryAttempt as number) || 0;
      return Math.min(baseDelay * Math.pow(2, attempt), 60000); // Max 1 minute
    }
    
    return super.getRetryDelay();
  }
}

/**
 * Cosmos DB errors
 */
export class CosmosError extends BaseError {
  public readonly cosmosCode?: number;
  public readonly requestCharge?: number;
  public readonly activityId?: string;

  constructor(
    message: string,
    code: ErrorCode,
    cosmosDetails?: {
      cosmosCode?: number;
      requestCharge?: number;
      activityId?: string;
    },
    options?: Partial<ErrorOptions>
  ) {
    super(message, {
      code,
      category: ErrorCategory.DATABASE,
      severity: ErrorSeverity.HIGH,
      ...options,
    });

    this.cosmosCode = cosmosDetails?.cosmosCode;
    this.requestCharge = cosmosDetails?.requestCharge;
    this.activityId = cosmosDetails?.activityId;
  }

  public static fromCosmosResponse(error: any): CosmosError {
    const message = error.message || 'Cosmos DB error';
    const status = error.code || error.statusCode;
    
    let code: ErrorCode;
    let severity = ErrorSeverity.HIGH;
    
    switch (status) {
      case 400:
        code = ErrorCodes.DB_009; // Partition key mismatch
        severity = ErrorSeverity.MEDIUM;
        break;
      case 404:
        code = ErrorCodes.DB_004; // Record not found
        severity = ErrorSeverity.LOW;
        break;
      case 409:
        code = ErrorCodes.DB_005; // Duplicate key
        severity = ErrorSeverity.MEDIUM;
        break;
      case 412:
        code = ErrorCodes.DB_008; // Optimistic lock failed
        severity = ErrorSeverity.MEDIUM;
        break;
      case 429:
        code = ErrorCodes.DB_010; // Throughput exceeded
        severity = ErrorSeverity.MEDIUM;
        break;
      case 503:
        code = ErrorCodes.DB_001; // Connection failed
        severity = ErrorSeverity.HIGH;
        break;
      default:
        code = ErrorCodes.DB_002; // Query failed
        severity = ErrorSeverity.HIGH;
    }

    return new CosmosError(
      message,
      code,
      {
        cosmosCode: status,
        requestCharge: error.requestCharge,
        activityId: error.activityId,
      },
      {
        statusCode: status >= 400 && status < 600 ? status : 500,
        severity,
        cause: error,
      }
    );
  }

  public isRetryable(): boolean {
    return [
      ErrorCodes.DB_001, // Connection failed
      ErrorCodes.DB_007, // Timeout
      ErrorCodes.DB_010, // Throughput exceeded
    ].includes(this.code as ErrorCode);
  }
}

/**
 * Azure Storage errors
 */
export class StorageError extends BaseError {
  public readonly storageCode?: string;
  public readonly requestId?: string;
  public readonly containerName?: string;
  public readonly blobName?: string;

  constructor(
    message: string,
    code: ErrorCode,
    storageDetails?: {
      storageCode?: string;
      requestId?: string;
      containerName?: string;
      blobName?: string;
    },
    options?: Partial<ErrorOptions>
  ) {
    super(message, {
      code,
      category: ErrorCategory.STORAGE,
      severity: ErrorSeverity.MEDIUM,
      ...options,
    });

    this.storageCode = storageDetails?.storageCode;
    this.requestId = storageDetails?.requestId;
    this.containerName = storageDetails?.containerName;
    this.blobName = storageDetails?.blobName;
  }

  public static fromStorageResponse(error: any, context?: {
    containerName?: string;
    blobName?: string;
  }): StorageError {
    const message = error.message || 'Storage service error';
    const status = error.statusCode || error.code;
    
    let code: ErrorCode;
    let severity = ErrorSeverity.MEDIUM;
    
    switch (status) {
      case 403:
        code = ErrorCodes.STORAGE_004; // Access denied
        severity = ErrorSeverity.HIGH;
        break;
      case 404:
        code = ErrorCodes.STORAGE_003; // File not found
        severity = ErrorSeverity.LOW;
        break;
      case 409:
        code = ErrorCodes.STORAGE_005; // Quota exceeded
        severity = ErrorSeverity.MEDIUM;
        break;
      case 413:
        code = ErrorCodes.STORAGE_007; // File too large
        severity = ErrorSeverity.LOW;
        break;
      case 'RequestTimeout':
      case 'ETIMEDOUT':
        code = ErrorCodes.STORAGE_010; // Operation timeout
        severity = ErrorSeverity.MEDIUM;
        break;
      default:
        code = ErrorCodes.STORAGE_001; // Upload failed
        severity = ErrorSeverity.MEDIUM;
    }

    return new StorageError(
      message,
      code,
      {
        storageCode: error.code,
        requestId: error.requestId,
        ...context,
      },
      {
        statusCode: typeof status === 'number' ? status : 500,
        severity,
        cause: error,
      }
    );
  }

  public isRetryable(): boolean {
    return [
      ErrorCodes.STORAGE_001, // Upload failed (generic)
      ErrorCodes.STORAGE_002, // Download failed
      ErrorCodes.STORAGE_010, // Timeout
    ].includes(this.code as ErrorCode);
  }
}

/**
 * Document Intelligence/Form Recognizer errors
 */
export class DocumentProcessingError extends BaseError {
  public readonly operationId?: string;
  public readonly documentUrl?: string;
  public readonly pageCount?: number;

  constructor(
    message: string,
    code: ErrorCode,
    docDetails?: {
      operationId?: string;
      documentUrl?: string;
      pageCount?: number;
    },
    options?: Partial<ErrorOptions>
  ) {
    super(message, {
      code,
      category: ErrorCategory.AI_SERVICE,
      severity: ErrorSeverity.MEDIUM,
      ...options,
    });

    this.operationId = docDetails?.operationId;
    this.documentUrl = docDetails?.documentUrl;
    this.pageCount = docDetails?.pageCount;
  }

  public static fromDocumentIntelligence(error: any, context?: {
    operationId?: string;
    documentUrl?: string;
  }): DocumentProcessingError {
    const message = error.message || 'Document processing failed';
    const status = error.statusCode || error.code;
    
    let code: ErrorCode;
    let severity = ErrorSeverity.MEDIUM;
    
    if (message.includes('unsupported') || message.includes('format')) {
      code = ErrorCodes.DOC_002; // Unsupported format
      severity = ErrorSeverity.LOW;
    } else if (message.includes('timeout')) {
      code = ErrorCodes.DOC_007; // Analysis timeout
      severity = ErrorSeverity.MEDIUM;
    } else if (message.includes('corrupted') || message.includes('invalid')) {
      code = ErrorCodes.DOC_005; // Corrupted file
      severity = ErrorSeverity.LOW;
    } else {
      code = ErrorCodes.DOC_001; // Processing failed
      severity = ErrorSeverity.MEDIUM;
    }

    return new DocumentProcessingError(
      message,
      code,
      context,
      {
        statusCode: typeof status === 'number' ? status : 500,
        severity,
        cause: error,
      }
    );
  }

  public isRetryable(): boolean {
    return [
      ErrorCodes.DOC_001, // Processing failed (generic)
      ErrorCodes.DOC_007, // Timeout
    ].includes(this.code as ErrorCode);
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends BaseError {
  public readonly originalUrl?: string;
  public readonly networkCode?: string;

  constructor(
    message: string,
    code: ErrorCode,
    networkDetails?: {
      originalUrl?: string;
      networkCode?: string;
    },
    options?: Partial<ErrorOptions>
  ) {
    super(message, {
      code,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      ...options,
    });

    this.originalUrl = networkDetails?.originalUrl;
    this.networkCode = networkDetails?.networkCode;
  }

  public static fromFetchError(error: any, url?: string): NetworkError {
    const message = error.message || 'Network request failed';
    
    let code: ErrorCode;
    let severity = ErrorSeverity.MEDIUM;
    
    if (error.name === 'AbortError') {
      code = ErrorCodes.NET_008; // Request aborted
      severity = ErrorSeverity.LOW;
    } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      code = ErrorCodes.NET_003; // DNS failed
      severity = ErrorSeverity.HIGH;
    } else if (error.code === 'ETIMEDOUT' || error.name === 'TimeoutError') {
      code = ErrorCodes.NET_002; // Timeout
      severity = ErrorSeverity.MEDIUM;
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      code = ErrorCodes.NET_001; // Connection failed
      severity = ErrorSeverity.HIGH;
    } else {
      code = ErrorCodes.NET_001; // Generic connection failed
      severity = ErrorSeverity.MEDIUM;
    }

    return new NetworkError(
      message,
      code,
      {
        originalUrl: url,
        networkCode: error.code,
      },
      {
        severity,
        cause: error,
      }
    );
  }

  public isRetryable(): boolean {
    // Most network errors are retryable except for aborts
    return this.code !== ErrorCodes.NET_008;
  }
}