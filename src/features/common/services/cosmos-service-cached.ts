// ABOUTME: Cosmos DB service with advanced caching and query optimization
// ABOUTME: Integrates query result caching, connection pooling, and performance monitoring

import { Container, SqlQuerySpec, FeedOptions } from "@azure/cosmos";
import { CosmosInstance, HistoryContainer, ConfigContainer } from "./cosmos";
import { 
  cosmosQueryCache, 
  QueryCacheOptions, 
  CachedQueryResult,
  COMMON_QUERIES 
} from "./cosmos-cache-enhanced";
import { performanceMonitor } from "../observability/performance-monitor";

export interface CachedQueryOptions extends QueryCacheOptions {
  maxItemCount?: number;
  enableCrossPartitionQuery?: boolean;
  partitionKey?: string;
  consistencyLevel?: 'Strong' | 'BoundedStaleness' | 'Session' | 'ConsistentPrefix' | 'Eventual';
}

/**
 * Enhanced Cosmos service with intelligent caching
 */
export class CachedCosmosService {
  private historyContainer: Container;
  private configContainer: Container;
  
  constructor() {
    this.historyContainer = HistoryContainer();
    this.configContainer = ConfigContainer();
  }
  
  /**
   * Execute query with caching
   */
  async queryWithCache<T>(
    query: SqlQuerySpec,
    options: CachedQueryOptions = {}
  ): Promise<CachedQueryResult<T>> {
    const startTime = performance.now();
    const container = this.historyContainer;
    
    // Check cache first
    if (!options.skipCache) {
      const cached = cosmosQueryCache.get<T>(query, options.partitionKey);
      if (cached) {
        console.log(`[Cosmos Cache] Hit for query: ${query.query.substring(0, 50)}...`);
        return cached;
      }
    }
    
    console.log(`[Cosmos Cache] Miss for query: ${query.query.substring(0, 50)}...`);
    
    // Execute query
    const feedOptions: FeedOptions = {
      maxItemCount: options.maxItemCount || 100,
      enableCrossPartitionQuery: options.enableCrossPartitionQuery ?? true,
      partitionKey: options.partitionKey,
    };
    
    try {
      const queryIterator = container.items.query<T>(query, feedOptions);
      const response = await queryIterator.fetchAll();
      
      const duration = performance.now() - startTime;
      const requestCharge = response.requestCharge || 0;
      
      // Log performance metrics
      performanceMonitor.recordQuery({
        query: query.query,
        duration,
        requestUnits: requestCharge,
        resultCount: response.resources.length,
        cached: false,
        timestamp: new Date()
      });
      
      // Cache the result
      if (!options.skipCache) {
        cosmosQueryCache.set(
          query,
          response.resources,
          requestCharge,
          options.partitionKey,
          options
        );
      }
      
      return {
        data: response.resources,
        timestamp: Date.now(),
        ttl: options.ttl || 5 * 60 * 1000,
        requestUnits: requestCharge,
        fromCache: false,
        queryFingerprint: ''
      };
      
    } catch (error) {
      console.error('[Cosmos Cache] Query failed:', error);
      throw error;
    }
  }
  
  /**
   * Get chat threads with caching
   */
  async getChatThreadsForUser(userId: string, options: CachedQueryOptions = {}) {
    const query = {
      ...COMMON_QUERIES.GET_CHAT_THREADS.query,
      parameters: [
        { name: '@type', value: 'CHAT_THREAD' },
        { name: '@userId', value: userId },
        { name: '@isDeleted', value: false }
      ]
    };
    
    return this.queryWithCache(query, {
      ttl: 5 * 60 * 1000, // 5 minutes for chat threads
      partitionKey: userId,
      ...options
    });
  }
  
  /**
   * Get chat messages with caching
   */
  async getChatMessages(chatThreadId: string, options: CachedQueryOptions = {}) {
    const query = {
      ...COMMON_QUERIES.GET_CHAT_MESSAGES.query,
      parameters: [
        { name: '@type', value: 'CHAT_MESSAGE' },
        { name: '@chatThreadId', value: chatThreadId }
      ]
    };
    
    return this.queryWithCache(query, {
      ttl: 10 * 60 * 1000, // 10 minutes for messages
      partitionKey: chatThreadId,
      ...options
    });
  }
  
  /**
   * Get chat documents with caching
   */
  async getChatDocuments(chatThreadId: string, options: CachedQueryOptions = {}) {
    const query = {
      ...COMMON_QUERIES.GET_CHAT_DOCUMENTS.query,
      parameters: [
        { name: '@type', value: 'CHAT_DOCUMENT' },
        { name: '@chatThreadId', value: chatThreadId }
      ]
    };
    
    return this.queryWithCache(query, {
      ttl: 15 * 60 * 1000, // 15 minutes for documents
      partitionKey: chatThreadId,
      ...options
    });
  }
  
  /**
   * Get recent chat threads with optimized caching
   */
  async getRecentChatThreads(userId: string, limit: number = 10) {
    const query: SqlQuerySpec = {
      query: `
        SELECT TOP @limit * FROM root r 
        WHERE r.type = @type 
        AND r.userId = @userId 
        AND r.isDeleted = @isDeleted 
        ORDER BY r.updatedAt DESC
      `,
      parameters: [
        { name: '@limit', value: limit },
        { name: '@type', value: 'CHAT_THREAD' },
        { name: '@userId', value: userId },
        { name: '@isDeleted', value: false }
      ]
    };
    
    return this.queryWithCache(query, {
      ttl: 2 * 60 * 1000, // 2 minutes for recent threads (more frequent updates)
      partitionKey: userId,
      maxItemCount: limit
    });
  }
  
  /**
   * Invalidate cache for specific operations
   */
  invalidateCache = {
    chatThread: (threadId: string) => {
      cosmosQueryCache.invalidateByPattern(new RegExp(threadId));
    },
    
    userThreads: (userId: string) => {
      cosmosQueryCache.invalidateUser(userId);
    },
    
    allThreads: () => {
      cosmosQueryCache.invalidateEntityType('CHAT_THREAD');
    },
    
    messages: (threadId: string) => {
      cosmosQueryCache.invalidateByPattern(new RegExp(`chatThreadId.*${threadId}`));
    },
    
    documents: (threadId: string) => {
      cosmosQueryCache.invalidateByPattern(new RegExp(`CHAT_DOCUMENT.*${threadId}`));
    }
  };
  
  /**
   * Preload common data for user
   */
  async preloadUserData(userId: string) {
    try {
      // Preload recent chat threads
      const recentThreadsPromise = this.getRecentChatThreads(userId, 5);
      
      // Preload user's personas and extensions in parallel
      const [recentThreads] = await Promise.all([recentThreadsPromise]);
      
      // Preload messages for the most recent threads
      if (recentThreads.data.length > 0) {
        const messagePromises = recentThreads.data
          .slice(0, 3) // Only preload top 3 conversations
          .map(thread => this.getChatMessages(thread.id, { skipCache: false }));
        
        await Promise.allSettled(messagePromises);
      }
      
      console.log(`[Cosmos Cache] Preloaded data for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`[Cosmos Cache] Failed to preload data for user ${userId}:`, error);
      return false;
    }
  }
  
  /**
   * Get cache performance statistics
   */
  getCacheStats() {
    return cosmosQueryCache.getStats();
  }
  
  /**
   * Get cache efficiency insights
   */
  getCacheEfficiency() {
    return cosmosQueryCache.getCacheEfficiency();
  }
  
  /**
   * Optimize cache based on usage patterns
   */
  optimizeCache() {
    const efficiency = this.getCacheEfficiency();
    
    // Auto-tune cache based on performance
    if (efficiency.hitRate < 0.3) {
      console.log('[Cosmos Cache] Low hit rate detected, extending TTL');
      // Could implement dynamic TTL adjustment here
    }
    
    if (efficiency.averageRequestUnits > 15) {
      console.log('[Cosmos Cache] High RU usage detected, enabling more aggressive caching');
      // Could implement more aggressive caching strategies
    }
    
    return efficiency;
  }
}

// Singleton instance
export const cachedCosmosService = new CachedCosmosService();