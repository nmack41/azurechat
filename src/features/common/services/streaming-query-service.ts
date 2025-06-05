// ABOUTME: Streaming query service for handling large datasets efficiently
// ABOUTME: Provides memory-efficient streaming, backpressure handling, and real-time data processing

import { Container, SqlQuerySpec, FeedOptions } from "@azure/cosmos";
import { performanceMonitor } from "../observability/performance-monitor";
import { logger } from "../observability/logger";

export interface StreamingOptions {
  pageSize?: number;
  maxConcurrentRequests?: number;
  backpressureThreshold?: number;
  enableCompression?: boolean;
  timeoutMs?: number;
  retryAttempts?: number;
}

export interface StreamingResult<T> {
  data: T;
  metadata: {
    index: number;
    timestamp: number;
    requestUnits: number;
    partitionKey?: string;
  };
}

export interface StreamingStats {
  totalItems: number;
  processedItems: number;
  currentPage: number;
  totalPages?: number;
  averageLatency: number;
  totalRequestUnits: number;
  isComplete: boolean;
  hasError: boolean;
  errorMessage?: string;
}

type StreamingCallback<T> = (result: StreamingResult<T>) => Promise<void> | void;
type ErrorCallback = (error: Error, stats: StreamingStats) => void;
type ProgressCallback = (stats: StreamingStats) => void;

const DEFAULT_STREAMING_OPTIONS: Required<StreamingOptions> = {
  pageSize: 50,
  maxConcurrentRequests: 3,
  backpressureThreshold: 1000,
  enableCompression: false,
  timeoutMs: 30000,
  retryAttempts: 3,
};

/**
 * High-performance streaming query processor
 */
export class StreamingQueryService {
  private activeStreams = new Map<string, StreamingController>();
  private globalStats = {
    totalStreamsCreated: 0,
    totalItemsProcessed: 0,
    totalRequestUnits: 0,
  };

  /**
   * Stream query results with callback processing
   */
  public async streamQuery<T>(
    container: Container,
    query: SqlQuerySpec,
    onData: StreamingCallback<T>,
    options: StreamingOptions = {},
    onProgress?: ProgressCallback,
    onError?: ErrorCallback
  ): Promise<string> {
    const streamId = this.generateStreamId();
    const config = { ...DEFAULT_STREAMING_OPTIONS, ...options };
    
    const controller = new StreamingController<T>(
      streamId,
      container,
      query,
      config,
      onData,
      onProgress,
      onError
    );

    this.activeStreams.set(streamId, controller);
    this.globalStats.totalStreamsCreated++;

    // Start streaming in background
    controller.start().catch((error) => {
      logger.error('Streaming query failed', {
        streamId,
        error: error.message,
        query: query.query,
      });
    }).finally(() => {
      this.activeStreams.delete(streamId);
    });

    return streamId;
  }

  /**
   * Create async iterator for streaming results
   */
  public async* streamAsyncIterator<T>(
    container: Container,
    query: SqlQuerySpec,
    options: StreamingOptions = {}
  ): AsyncIterableIterator<StreamingResult<T>> {
    const config = { ...DEFAULT_STREAMING_OPTIONS, ...options };
    const results: StreamingResult<T>[] = [];
    let isComplete = false;
    let error: Error | null = null;

    // Use streaming with callback to populate results array
    const streamId = await this.streamQuery<T>(
      container,
      query,
      async (result) => {
        results.push(result);
      },
      config,
      undefined,
      (err) => {
        error = err;
        isComplete = true;
      }
    );

    const controller = this.activeStreams.get(streamId);
    
    try {
      let index = 0;
      while (!isComplete || index < results.length) {
        if (error) {
          throw error;
        }

        if (index < results.length) {
          yield results[index];
          index++;
        } else {
          // Wait a bit before checking again
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Check if streaming is complete
        if (controller && controller.isComplete()) {
          isComplete = true;
        }
      }
    } finally {
      if (controller) {
        controller.cancel();
      }
    }
  }

  /**
   * Stream with transform function for data processing
   */
  public async streamWithTransform<T, R>(
    container: Container,
    query: SqlQuerySpec,
    transform: (data: T, metadata: any) => Promise<R> | R,
    onData: StreamingCallback<R>,
    options: StreamingOptions = {}
  ): Promise<string> {
    return this.streamQuery<T>(
      container,
      query,
      async (result) => {
        try {
          const transformed = await transform(result.data, result.metadata);
          await onData({
            data: transformed,
            metadata: result.metadata,
          });
        } catch (error) {
          logger.error('Transform function failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            index: result.metadata.index,
          });
          throw error;
        }
      },
      options
    );
  }

  /**
   * Batch stream processing with configurable batch size
   */
  public async streamBatches<T>(
    container: Container,
    query: SqlQuerySpec,
    batchSize: number,
    onBatch: (batch: StreamingResult<T>[], batchIndex: number) => Promise<void>,
    options: StreamingOptions = {}
  ): Promise<string> {
    let currentBatch: StreamingResult<T>[] = [];
    let batchIndex = 0;

    return this.streamQuery<T>(
      container,
      query,
      async (result) => {
        currentBatch.push(result);

        if (currentBatch.length >= batchSize) {
          await onBatch([...currentBatch], batchIndex);
          currentBatch = [];
          batchIndex++;
        }
      },
      options,
      undefined,
      async (error, stats) => {
        // Process remaining items in the last batch
        if (currentBatch.length > 0) {
          try {
            await onBatch([...currentBatch], batchIndex);
          } catch (batchError) {
            logger.error('Final batch processing failed', { batchError });
          }
        }
      }
    );
  }

  /**
   * Cancel a streaming operation
   */
  public cancelStream(streamId: string): boolean {
    const controller = this.activeStreams.get(streamId);
    if (controller) {
      controller.cancel();
      this.activeStreams.delete(streamId);
      return true;
    }
    return false;
  }

  /**
   * Get statistics for a specific stream
   */
  public getStreamStats(streamId: string): StreamingStats | null {
    const controller = this.activeStreams.get(streamId);
    return controller ? controller.getStats() : null;
  }

  /**
   * Get global streaming statistics
   */
  public getGlobalStats() {
    const activeStreams = this.activeStreams.size;
    const totalItemsInProgress = Array.from(this.activeStreams.values())
      .reduce((sum, controller) => sum + controller.getStats().processedItems, 0);

    return {
      ...this.globalStats,
      activeStreams,
      totalItemsInProgress,
    };
  }

  /**
   * Cancel all active streams
   */
  public cancelAllStreams(): number {
    const count = this.activeStreams.size;
    this.activeStreams.forEach(controller => controller.cancel());
    this.activeStreams.clear();
    return count;
  }

  private generateStreamId(): string {
    return `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Controller for individual streaming operations
 */
class StreamingController<T> {
  private stats: StreamingStats;
  private isCancelled = false;
  private startTime: number;
  private requestUnitsAccumulator = 0;
  private latencyAccumulator = 0;
  private requestCount = 0;

  constructor(
    private streamId: string,
    private container: Container,
    private query: SqlQuerySpec,
    private config: Required<StreamingOptions>,
    private onData: StreamingCallback<T>,
    private onProgress?: ProgressCallback,
    private onError?: ErrorCallback
  ) {
    this.startTime = Date.now();
    this.stats = {
      totalItems: 0,
      processedItems: 0,
      currentPage: 0,
      averageLatency: 0,
      totalRequestUnits: 0,
      isComplete: false,
      hasError: false,
    };
  }

  /**
   * Start the streaming process
   */
  public async start(): Promise<void> {
    const measurement = performanceMonitor.startMeasurement('streaming_query', {
      streamId: this.streamId,
      pageSize: this.config.pageSize,
    });

    try {
      await this.executeStreaming();
      
      this.stats.isComplete = true;
      measurement.finish(true, {
        totalItems: this.stats.processedItems,
        totalRequestUnits: this.stats.totalRequestUnits,
        duration: Date.now() - this.startTime,
      });
    } catch (error) {
      this.stats.hasError = true;
      this.stats.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      measurement.finish(false, {
        error: this.stats.errorMessage,
        processedItems: this.stats.processedItems,
      });

      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error('Unknown error'), this.stats);
      }
      
      throw error;
    }
  }

  /**
   * Execute the streaming operation with pagination
   */
  private async executeStreaming(): Promise<void> {
    let continuationToken: string | undefined;
    let itemIndex = 0;
    const semaphore = new Semaphore(this.config.maxConcurrentRequests);

    do {
      if (this.isCancelled) {
        break;
      }

      await semaphore.acquire();

      try {
        const pageStart = performance.now();
        
        const feedOptions: FeedOptions = {
          maxItemCount: this.config.pageSize,
          continuationToken,
        };

        const response = await this.container.items
          .query<T>(this.query, feedOptions)
          .fetchNext();

        const pageLatency = performance.now() - pageStart;
        this.updateLatencyStats(pageLatency);
        this.requestUnitsAccumulator += response.requestCharge || 0;
        this.requestCount++;

        continuationToken = response.continuationToken;
        this.stats.currentPage++;
        this.stats.totalRequestUnits = this.requestUnitsAccumulator;
        this.stats.averageLatency = this.latencyAccumulator / this.requestCount;

        // Process items with backpressure control
        const processingPromises = response.resources.map(async (item, index) => {
          if (this.isCancelled) return;

          // Backpressure check
          if (this.stats.processedItems - itemIndex > this.config.backpressureThreshold) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          const result: StreamingResult<T> = {
            data: item,
            metadata: {
              index: itemIndex + index,
              timestamp: Date.now(),
              requestUnits: (response.requestCharge || 0) / response.resources.length,
            },
          };

          await this.onData(result);
          this.stats.processedItems++;
        });

        await Promise.all(processingPromises);
        itemIndex += response.resources.length;

        // Progress callback
        if (this.onProgress) {
          this.onProgress({ ...this.stats });
        }

        // Add delay between pages to prevent overwhelming the service
        if (continuationToken && !this.isCancelled) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }

      } finally {
        semaphore.release();
      }

    } while (continuationToken && !this.isCancelled);
  }

  /**
   * Cancel the streaming operation
   */
  public cancel(): void {
    this.isCancelled = true;
  }

  /**
   * Check if streaming is complete
   */
  public isComplete(): boolean {
    return this.stats.isComplete || this.isCancelled;
  }

  /**
   * Get current statistics
   */
  public getStats(): StreamingStats {
    return { ...this.stats };
  }

  private updateLatencyStats(latency: number): void {
    this.latencyAccumulator += latency;
  }
}

/**
 * Simple semaphore for controlling concurrent operations
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const nextResolve = this.waitQueue.shift();
      if (nextResolve) {
        this.permits--;
        nextResolve();
      }
    }
  }
}

// Export singleton instance
export const streamingQueryService = new StreamingQueryService();

// Export types
export type {
  StreamingCallback,
  ErrorCallback,
  ProgressCallback,
};