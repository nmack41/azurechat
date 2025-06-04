// ABOUTME: Enhanced Azure Storage service with comprehensive error handling
// ABOUTME: Provides retry logic, circuit breaker, and structured error responses

import { BlobServiceClient, RestError, StorageSharedKeyCredential } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import { 
  BaseError, 
  ErrorCodes, 
  ErrorSeverity, 
  ErrorCategory,
  withRetry,
  CircuitBreaker,
  CircuitBreakerState,
  globalErrorAggregator,
  ErrorClassifier 
} from "../errors";
import { ServerActionResponse } from "../server-action-response";

/**
 * Azure Storage service configuration
 */
interface StorageServiceConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  enableCircuitBreaker: boolean;
  circuitBreakerFailureThreshold: number;
  circuitBreakerTimeoutMs: number;
  maxBlobSizeMB: number;
  allowedContentTypes: string[];
}

/**
 * Default service configuration
 */
const DEFAULT_CONFIG: StorageServiceConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 60000, // 60 seconds for uploads
  enableCircuitBreaker: true,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerTimeoutMs: 60000,
  maxBlobSizeMB: 100,
  allowedContentTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
};

/**
 * Storage operation options
 */
interface StorageOperationOptions {
  correlationId?: string;
  userId?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  timeout?: number;
  overwrite?: boolean;
}

/**
 * Enhanced Azure Storage service
 */
export class AzureStorageService {
  private blobServiceClient: BlobServiceClient;
  private config: StorageServiceConfig;
  private circuitBreaker?: CircuitBreaker;

  constructor(config: Partial<StorageServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    try {
      this.blobServiceClient = this.initBlobServiceClient();
    } catch (error) {
      // Re-throw the error to maintain the existing behavior
      throw error;
    }
    
    if (this.config.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker({
        failureThreshold: this.config.circuitBreakerFailureThreshold,
        successThreshold: 3,
        timeout: this.config.circuitBreakerTimeoutMs,
        onStateChange: (state) => {
          console.warn(`Azure Storage Circuit breaker state changed to: ${state}`);
        },
      });
    }
  }

  /**
   * Initialize blob service client with proper authentication
   */
  private initBlobServiceClient(): BlobServiceClient {
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const endpointSuffix = process.env.AZURE_STORAGE_ENDPOINT_SUFFIX || "core.windows.net";
    const endpoint = `https://${accountName}.blob.${endpointSuffix}`;

    if (!accountName) {
      throw new BaseError('Azure Storage account name not configured', {
        code: ErrorCodes.STORAGE_001,
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.CONFIGURATION,
        statusCode: 500,
      });
    }

    try {
      const useManagedIdentities = process.env.USE_MANAGED_IDENTITIES === "true";
      
      if (useManagedIdentities) {
        return new BlobServiceClient(endpoint, new DefaultAzureCredential());
      }

      const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
      if (!accountKey) {
        throw new BaseError('Azure Storage account key not configured', {
          code: ErrorCodes.STORAGE_002,
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.CONFIGURATION,
          statusCode: 500,
        });
      }

      const credential = new StorageSharedKeyCredential(accountName, accountKey);
      return new BlobServiceClient(endpoint, credential);
    } catch (error) {
      // If it's already a BaseError, re-throw it
      if (error instanceof BaseError) {
        throw error;
      }
      
      throw new BaseError('Failed to initialize Azure Storage client', {
        code: ErrorCodes.STORAGE_003,
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.STORAGE,
        statusCode: 500,
        cause: error,
      });
    }
  }

  /**
   * Upload blob with comprehensive error handling
   */
  public async uploadBlob(
    containerName: string,
    blobName: string,
    blobData: Buffer,
    options: StorageOperationOptions = {}
  ): Promise<ServerActionResponse<string>> {
    const operation = async () => {
      // Validate input
      this.validateUploadInput(containerName, blobName, blobData, options);

      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Prepare upload options
      const uploadOptions = {
        metadata: options.metadata,
        blobHTTPHeaders: options.contentType ? {
          blobContentType: options.contentType,
        } : undefined,
        timeout: options.timeout || this.config.timeoutMs,
      };

      try {
        // Check if blob exists and handle overwrite
        if (!options.overwrite) {
          const exists = await blockBlobClient.exists();
          if (exists) {
            throw new BaseError(`Blob already exists: ${blobName}`, {
              code: ErrorCodes.STORAGE_004,
              severity: ErrorSeverity.LOW,
              category: ErrorCategory.VALIDATION,
              statusCode: 409,
            });
          }
        }

        // Upload the blob
        const response = await blockBlobClient.uploadData(blobData, uploadOptions);

        if (response.errorCode) {
          throw new BaseError(`Failed to upload blob: ${response.errorCode}`, {
            code: ErrorCodes.STORAGE_005,
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.STORAGE,
            statusCode: 500,
            details: { errorCode: response.errorCode, blobName },
          });
        }

        return {
          status: "OK" as const,
          response: blockBlobClient.url,
        };
      } catch (error) {
        if (error instanceof BaseError) {
          throw error;
        }

        if (error instanceof RestError) {
          throw this.handleRestError(error, 'upload', { containerName, blobName });
        }

        throw new BaseError('Unexpected error during blob upload', {
          code: ErrorCodes.STORAGE_006,
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.STORAGE,
          statusCode: 500,
          cause: error,
          details: { containerName, blobName },
        });
      }
    };

    try {
      if (this.circuitBreaker) {
        return await this.circuitBreaker.execute(() => 
          withRetry(operation, {
            maxAttempts: this.config.maxRetries,
            baseDelay: this.config.retryDelayMs,
            retryIf: (error) => this.shouldRetryStorageError(error),
          })
        );
      } else {
        return await withRetry(operation, {
          maxAttempts: this.config.maxRetries,
          baseDelay: this.config.retryDelayMs,
          retryIf: (error) => this.shouldRetryStorageError(error),
        });
      }
    } catch (error) {
      globalErrorAggregator.record(error);
      
      if (error instanceof BaseError) {
        return {
          status: "ERROR",
          errors: [{
            message: error.message,
            code: error.code,
          }],
        };
      }

      return {
        status: "ERROR",
        errors: [{
          message: "Failed to upload blob to storage",
          code: ErrorCodes.STORAGE_006,
        }],
      };
    }
  }

  /**
   * Download blob with error handling
   */
  public async downloadBlob(
    containerName: string,
    blobPath: string,
    options: StorageOperationOptions = {}
  ): Promise<ServerActionResponse<ReadableStream<any>>> {
    const operation = async () => {
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

      try {
        const downloadResponse = await blockBlobClient.download(0, undefined, {
          timeout: options.timeout || this.config.timeoutMs,
        });

        if (!downloadResponse.readableStreamBody) {
          throw new BaseError(`No stream data available for blob: ${blobPath}`, {
            code: ErrorCodes.STORAGE_007,
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.STORAGE,
            statusCode: 500,
          });
        }

        return {
          status: "OK" as const,
          response: downloadResponse.readableStreamBody as unknown as ReadableStream<any>,
        };
      } catch (error) {
        if (error instanceof BaseError) {
          throw error;
        }

        if (error instanceof RestError) {
          // Handle 404 specifically
          if (error.statusCode === 404) {
            return {
              status: "NOT_FOUND" as const,
              errors: [{
                message: `Blob not found: ${blobPath}`,
                code: ErrorCodes.STORAGE_008,
              }],
            };
          }

          throw this.handleRestError(error, 'download', { containerName, blobPath });
        }

        throw new BaseError('Unexpected error during blob download', {
          code: ErrorCodes.STORAGE_009,
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.STORAGE,
          statusCode: 500,
          cause: error,
          details: { containerName, blobPath },
        });
      }
    };

    try {
      if (this.circuitBreaker) {
        return await this.circuitBreaker.execute(() => 
          withRetry(operation, {
            maxAttempts: this.config.maxRetries,
            baseDelay: this.config.retryDelayMs,
            retryIf: (error) => this.shouldRetryStorageError(error),
          })
        );
      } else {
        return await withRetry(operation, {
          maxAttempts: this.config.maxRetries,
          baseDelay: this.config.retryDelayMs,
          retryIf: (error) => this.shouldRetryStorageError(error),
        });
      }
    } catch (error) {
      globalErrorAggregator.record(error);
      
      if (error instanceof BaseError) {
        return {
          status: "ERROR",
          errors: [{
            message: error.message,
            code: error.code,
          }],
        };
      }

      return {
        status: "ERROR",
        errors: [{
          message: "Failed to download blob from storage",
          code: ErrorCodes.STORAGE_009,
        }],
      };
    }
  }

  /**
   * Check if blob exists
   */
  public async blobExists(
    containerName: string,
    blobPath: string
  ): Promise<ServerActionResponse<boolean>> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
      
      const exists = await blockBlobClient.exists();
      
      return {
        status: "OK",
        response: exists,
      };
    } catch (error) {
      globalErrorAggregator.record(error);
      
      return {
        status: "ERROR",
        errors: [{
          message: "Failed to check blob existence",
          code: ErrorCodes.STORAGE_010,
        }],
      };
    }
  }

  /**
   * Delete blob
   */
  public async deleteBlob(
    containerName: string,
    blobPath: string
  ): Promise<ServerActionResponse<boolean>> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
      
      await blockBlobClient.deleteIfExists();
      
      return {
        status: "OK",
        response: true,
      };
    } catch (error) {
      globalErrorAggregator.record(error);
      
      if (error instanceof RestError) {
        const baseError = this.handleRestError(error, 'delete', { containerName, blobPath });
        return {
          status: "ERROR",
          errors: [{
            message: baseError.message,
            code: baseError.code,
          }],
        };
      }

      return {
        status: "ERROR",
        errors: [{
          message: "Failed to delete blob",
          code: ErrorCodes.STORAGE_011,
        }],
      };
    }
  }

  /**
   * Get service health status
   */
  public async getHealthStatus() {
    try {
      // Test connectivity by trying to list containers (limited)
      const listResponse = this.blobServiceClient.listContainers({ prefix: '__health__' });
      await listResponse.next();
      
      return {
        status: 'healthy',
        circuitBreakerState: this.circuitBreaker?.getState() || CircuitBreakerState.CLOSED,
        responseTime: Date.now(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        circuitBreakerState: this.circuitBreaker?.getState() || CircuitBreakerState.CLOSED,
        responseTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate upload input
   */
  private validateUploadInput(
    containerName: string,
    blobName: string,
    blobData: Buffer,
    options: StorageOperationOptions
  ): void {
    if (!containerName || containerName.trim().length === 0) {
      throw new BaseError('Container name is required', {
        code: ErrorCodes.VALIDATION_001,
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
        statusCode: 400,
      });
    }

    if (!blobName || blobName.trim().length === 0) {
      throw new BaseError('Blob name is required', {
        code: ErrorCodes.VALIDATION_002,
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
        statusCode: 400,
      });
    }

    if (!blobData || blobData.length === 0) {
      throw new BaseError('Blob data is required', {
        code: ErrorCodes.VALIDATION_003,
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
        statusCode: 400,
      });
    }

    // Check file size
    const sizeInMB = blobData.length / (1024 * 1024);
    if (sizeInMB > this.config.maxBlobSizeMB) {
      throw new BaseError(`File size ${sizeInMB.toFixed(2)}MB exceeds maximum allowed size of ${this.config.maxBlobSizeMB}MB`, {
        code: ErrorCodes.VALIDATION_004,
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
        statusCode: 413,
      });
    }

    // Check content type if provided
    if (options.contentType && !this.config.allowedContentTypes.includes(options.contentType)) {
      throw new BaseError(`Content type ${options.contentType} is not allowed`, {
        code: ErrorCodes.VALIDATION_005,
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
        statusCode: 415,
        details: { allowedTypes: this.config.allowedContentTypes },
      });
    }
  }

  /**
   * Handle Azure Storage REST errors
   */
  private handleRestError(error: RestError, operation: string, context: any): BaseError {
    const statusCode = error.statusCode || 500;
    let code: string;
    let severity: ErrorSeverity;

    switch (statusCode) {
      case 400:
        code = ErrorCodes.STORAGE_012;
        severity = ErrorSeverity.LOW;
        break;
      case 401:
        code = ErrorCodes.STORAGE_013;
        severity = ErrorSeverity.HIGH;
        break;
      case 403:
        code = ErrorCodes.STORAGE_014;
        severity = ErrorSeverity.MEDIUM;
        break;
      case 404:
        code = ErrorCodes.STORAGE_008;
        severity = ErrorSeverity.LOW;
        break;
      case 409:
        code = ErrorCodes.STORAGE_004;
        severity = ErrorSeverity.LOW;
        break;
      case 413:
        code = ErrorCodes.VALIDATION_004;
        severity = ErrorSeverity.LOW;
        break;
      case 429:
        code = ErrorCodes.STORAGE_015;
        severity = ErrorSeverity.MEDIUM;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        code = ErrorCodes.STORAGE_016;
        severity = ErrorSeverity.HIGH;
        break;
      default:
        code = ErrorCodes.STORAGE_017;
        severity = ErrorSeverity.MEDIUM;
    }

    return new BaseError(`Azure Storage ${operation} failed: ${error.message}`, {
      code,
      severity,
      category: ErrorCategory.STORAGE,
      statusCode,
      cause: error,
      details: { operation, ...context, errorCode: error.code },
    });
  }

  /**
   * Determine if storage error should be retried
   */
  private shouldRetryStorageError(error: unknown): boolean {
    if (error instanceof BaseError) {
      // Don't retry client errors (4xx) except for 429 (rate limit)
      if (ErrorClassifier.isClientError(error) && error.statusCode !== 429) {
        return false;
      }
      
      // Retry server errors and rate limits
      return ErrorClassifier.isServerError(error) || error.statusCode === 429;
    }

    if (error instanceof RestError) {
      const statusCode = error.statusCode || 500;
      // Don't retry client errors except for 429
      if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        return false;
      }
      return true;
    }

    // Retry unknown errors
    return true;
  }

  /**
   * Get circuit breaker metrics
   */
  public getMetrics() {
    return {
      circuitBreaker: this.circuitBreaker?.getMetrics(),
      config: this.config,
    };
  }
}

/**
 * Global Azure Storage service instance
 */
export const azureStorageService = new AzureStorageService();

// Legacy exports for backward compatibility
export const UploadBlob = (
  containerName: string,
  blobName: string,
  blobData: Buffer
) => azureStorageService.uploadBlob(containerName, blobName, blobData);

export const GetBlob = (
  containerName: string,
  blobPath: string
) => azureStorageService.downloadBlob(containerName, blobPath);