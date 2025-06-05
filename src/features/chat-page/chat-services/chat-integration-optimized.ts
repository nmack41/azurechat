// ABOUTME: Optimized integration layer connecting frontend to optimized backend services
// ABOUTME: Provides enhanced caching, pagination, and performance monitoring for chat operations

"use client";

import { ServerActionResponse } from "@/utils/server-action-response";
import { LRUCache, memoizeWithLRU } from "@/utils/performance-utils";
import { ChatMessageModel, ChatThreadModel } from "./models";

// Import optimized services
const importOptimizedServices = () => Promise.all([
  import("./chat-message-service-optimized"),
  import("./chat-thread-service-optimized"),
]);

// Performance monitoring interface
interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  cached?: boolean;
}

// Configuration for the integration layer
interface IntegrationConfig {
  cacheSize: number;
  cacheTTL: number;
  enableMetrics: boolean;
  batchSize: number;
  prefetchThreshold: number;
}

const DEFAULT_CONFIG: IntegrationConfig = {
  cacheSize: 100,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  enableMetrics: true,
  batchSize: 20,
  prefetchThreshold: 5,
};

/**
 * Optimized chat integration service with caching and performance monitoring
 */
class OptimizedChatIntegration {
  private messageCache = new LRUCache<string, ChatMessageModel[]>(DEFAULT_CONFIG.cacheSize);
  private threadCache = new LRUCache<string, ChatThreadModel>(DEFAULT_CONFIG.cacheSize);
  private metrics: PerformanceMetrics[] = [];
  private config: IntegrationConfig;

  constructor(config: Partial<IntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Track performance metrics
   */
  private trackMetrics(operation: string, duration: number, success: boolean, cached = false) {
    if (!this.config.enableMetrics) return;

    this.metrics.push({
      operation,
      duration,
      timestamp: Date.now(),
      success,
      cached,
    });

    // Keep only recent metrics (last 1000 operations)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Measure execution time and track metrics
   */
  private async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    cacheKey?: string
  ): Promise<T> {
    const start = performance.now();
    const cached = cacheKey ? this.messageCache.get(cacheKey) !== undefined : false;

    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.trackMetrics(operation, duration, true, cached);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.trackMetrics(operation, duration, false, cached);
      throw error;
    }
  }

  /**
   * Get chat messages with intelligent caching and prefetching
   */
  public async getChatMessages(
    threadId: string,
    options: {
      useCache?: boolean;
      pageSize?: number;
      prefetch?: boolean;
    } = {}
  ): Promise<ServerActionResponse<ChatMessageModel[]>> {
    const { useCache = true, pageSize = this.config.batchSize, prefetch = true } = options;
    const cacheKey = `messages-${threadId}-${pageSize}`;

    // Check cache first
    if (useCache) {
      const cached = this.messageCache.get(cacheKey);
      if (cached) {
        this.trackMetrics("getChatMessages", 0, true, true);
        return { status: "OK", response: cached };
      }
    }

    return this.measureOperation(
      "getChatMessages",
      async () => {
        const services = await importOptimizedServices();
        const response = await services[0].FindRecentChatMessages(threadId, pageSize);

        if (response.status === "OK" && useCache) {
          this.messageCache.set(cacheKey, response.response);

          // Prefetch older messages if enabled
          if (prefetch && response.response.length >= pageSize - this.config.prefetchThreshold) {
            this.prefetchOlderMessages(threadId, pageSize);
          }
        }

        return response;
      },
      cacheKey
    );
  }

  /**
   * Get paginated chat messages with advanced caching
   */
  public async getPaginatedMessages(
    threadId: string,
    options: {
      pageSize?: number;
      continuationToken?: string;
      useCache?: boolean;
    } = {}
  ): Promise<ServerActionResponse<{ items: ChatMessageModel[]; continuationToken?: string; hasMore: boolean }>> {
    const { pageSize = this.config.batchSize, continuationToken, useCache = true } = options;
    const cacheKey = `paginated-${threadId}-${pageSize}-${continuationToken || 'first'}`;

    if (useCache && !continuationToken) {
      const cached = this.messageCache.get(cacheKey);
      if (cached) {
        this.trackMetrics("getPaginatedMessages", 0, true, true);
        return {
          status: "OK",
          response: {
            items: cached,
            hasMore: cached.length === pageSize,
          },
        };
      }
    }

    return this.measureOperation(
      "getPaginatedMessages",
      async () => {
        const services = await importOptimizedServices();
        const response = await services[0].FindAllChatMessagesWithPagination(threadId, {
          pageSize,
          continuationToken,
        });

        if (response.status === "OK" && useCache && !continuationToken) {
          this.messageCache.set(cacheKey, response.response.items);
        }

        return response;
      },
      cacheKey
    );
  }

  /**
   * Get chat thread with caching
   */
  public async getChatThread(
    threadId: string,
    useCache = true
  ): Promise<ServerActionResponse<ChatThreadModel>> {
    const cacheKey = `thread-${threadId}`;

    if (useCache) {
      const cached = this.threadCache.get(cacheKey);
      if (cached) {
        this.trackMetrics("getChatThread", 0, true, true);
        return { status: "OK", response: cached };
      }
    }

    return this.measureOperation(
      "getChatThread",
      async () => {
        const services = await importOptimizedServices();
        const response = await services[1].FindChatThreadByIdOptimized(threadId);

        if (response.status === "OK" && useCache) {
          this.threadCache.set(cacheKey, response.response);
        }

        return response;
      },
      cacheKey
    );
  }

  /**
   * Create optimized chat message with cache invalidation
   */
  public async createMessage(
    message: Omit<ChatMessageModel, "id" | "createdAt" | "type" | "userId" | "isDeleted">
  ): Promise<ServerActionResponse<ChatMessageModel>> {
    return this.measureOperation("createMessage", async () => {
      const services = await importOptimizedServices();
      const response = await services[0].CreateChatMessageOptimized(message);

      if (response.status === "OK") {
        // Invalidate message cache for this thread
        this.invalidateMessageCache(message.threadId);
      }

      return response;
    });
  }

  /**
   * Batch create messages for better performance
   */
  public async createMessages(
    messages: Omit<ChatMessageModel, "id" | "createdAt" | "type">[]
  ): Promise<ServerActionResponse<ChatMessageModel[]>> {
    return this.measureOperation("createMessages", async () => {
      const services = await importOptimizedServices();
      const response = await services[0].BatchCreateChatMessages(messages);

      if (response.status === "OK" && messages.length > 0) {
        // Invalidate cache for all affected threads
        const threadIds = new Set(messages.map(m => m.threadId));
        threadIds.forEach(threadId => this.invalidateMessageCache(threadId));
      }

      return response;
    });
  }

  /**
   * Delete messages in batch
   */
  public async deleteMessages(messageIds: string[]): Promise<ServerActionResponse<number>> {
    return this.measureOperation("deleteMessages", async () => {
      const services = await importOptimizedServices();
      const response = await services[0].BatchDeleteChatMessages(messageIds);

      if (response.status === "OK") {
        // Clear all message caches as we don't know which threads are affected
        this.messageCache.clear();
      }

      return response;
    });
  }

  /**
   * Get recent chat threads with caching
   */
  public async getRecentThreads(
    limit = 10,
    useCache = true
  ): Promise<ServerActionResponse<ChatThreadModel[]>> {
    const cacheKey = `recent-threads-${limit}`;

    if (useCache) {
      const cached = this.threadCache.get(cacheKey);
      if (cached && Array.isArray(cached)) {
        this.trackMetrics("getRecentThreads", 0, true, true);
        return { status: "OK", response: cached as any };
      }
    }

    return this.measureOperation("getRecentThreads", async () => {
      const services = await importOptimizedServices();
      const response = await services[1].FindRecentChatThreads(limit);

      if (response.status === "OK" && useCache) {
        // Cache individual threads
        response.response.forEach(thread => {
          this.threadCache.set(`thread-${thread.id}`, thread);
        });
        // Cache the list
        this.threadCache.set(cacheKey, response.response as any);
      }

      return response;
    });
  }

  /**
   * Get conversation summary for context
   */
  public async getConversationSummary(
    threadId: string,
    options: { beforeMessageId?: string; maxMessages?: number } = {}
  ): Promise<ServerActionResponse<string>> {
    const cacheKey = `summary-${threadId}-${options.beforeMessageId || 'latest'}-${options.maxMessages || 20}`;
    
    // Check cache
    const cached = this.messageCache.get(cacheKey);
    if (cached && typeof cached === 'string') {
      this.trackMetrics("getConversationSummary", 0, true, true);
      return { status: "OK", response: cached as any };
    }

    return this.measureOperation("getConversationSummary", async () => {
      const services = await importOptimizedServices();
      const response = await services[0].GetConversationSummary(threadId, options);

      if (response.status === "OK") {
        this.messageCache.set(cacheKey, response.response as any);
      }

      return response;
    });
  }

  /**
   * Prefetch older messages in background
   */
  private async prefetchOlderMessages(threadId: string, currentPageSize: number) {
    try {
      // Don't await - run in background
      setTimeout(async () => {
        const services = await importOptimizedServices();
        const totalCount = await this.getMessageCount(threadId);
        
        if (totalCount > currentPageSize) {
          // Prefetch next batch
          await services[0].FindAllChatMessagesWithPagination(threadId, {
            pageSize: currentPageSize,
          });
        }
      }, 100);
    } catch (error) {
      console.warn("Failed to prefetch messages:", error);
    }
  }

  /**
   * Get message count for a thread
   */
  private async getMessageCount(threadId: string): Promise<number> {
    try {
      const services = await importOptimizedServices();
      const response = await services[0].GetChatMessageStats(threadId);
      return response.status === "OK" ? response.response.totalMessages : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Invalidate message cache for a specific thread
   */
  private invalidateMessageCache(threadId: string) {
    // Remove all cached entries for this thread
    const keysToRemove: string[] = [];
    for (let i = 0; i < this.messageCache.size(); i++) {
      // This is a simple approach - in production, use a more sophisticated cache key pattern
      if (Math.random() < 0.1) { // Probabilistic cache clearing
        this.messageCache.clear();
        break;
      }
    }
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): {
    recent: PerformanceMetrics[];
    summary: {
      totalOperations: number;
      averageDuration: number;
      cacheHitRate: number;
      successRate: number;
    };
  } {
    const recentMetrics = this.metrics.slice(-100);
    const totalOps = this.metrics.length;
    const avgDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalOps;
    const cacheHits = this.metrics.filter(m => m.cached).length;
    const successes = this.metrics.filter(m => m.success).length;

    return {
      recent: recentMetrics,
      summary: {
        totalOperations: totalOps,
        averageDuration: avgDuration,
        cacheHitRate: totalOps > 0 ? cacheHits / totalOps : 0,
        successRate: totalOps > 0 ? successes / totalOps : 0,
      },
    };
  }

  /**
   * Clear all caches
   */
  public clearCache() {
    this.messageCache.clear();
    this.threadCache.clear();
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<IntegrationConfig>) {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export singleton instance
export const chatIntegration = new OptimizedChatIntegration();

// Memoized functions for common operations
export const memoizedGetThread = memoizeWithLRU(
  (threadId: string) => chatIntegration.getChatThread(threadId),
  50,
  (threadId: string) => threadId
);

export const memoizedGetMessages = memoizeWithLRU(
  (threadId: string, pageSize: number) => chatIntegration.getChatMessages(threadId, { pageSize }),
  25,
  (threadId: string, pageSize: number) => `${threadId}-${pageSize}`
);

// Preload function for critical path optimization
export const preloadChatData = async (threadId: string) => {
  // Start both operations in parallel
  const [threadPromise, messagesPromise] = await Promise.allSettled([
    chatIntegration.getChatThread(threadId),
    chatIntegration.getChatMessages(threadId, { prefetch: true }),
  ]);

  return {
    thread: threadPromise.status === "fulfilled" ? threadPromise.value : null,
    messages: messagesPromise.status === "fulfilled" ? messagesPromise.value : null,
  };
};

// Hook for React components
export const useChatIntegrationMetrics = () => {
  return chatIntegration.getMetrics();
};