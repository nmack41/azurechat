// ABOUTME: Enhanced Cosmos DB service with query optimization, caching, and performance monitoring
// ABOUTME: Provides optimized operations with composite index utilization and request unit monitoring

import { CosmosClient, Container } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { performanceMonitor } from "@/observability/performance-monitor";
import { logger } from "@/observability/logger";

// Configure Cosmos DB details
const DB_NAME = process.env.AZURE_COSMOSDB_DB_NAME || "chat";
const CONTAINER_NAME = process.env.AZURE_COSMOSDB_CONTAINER_NAME || "history";
const CONFIG_CONTAINER_NAME = process.env.AZURE_COSMOSDB_CONFIG_CONTAINER_NAME || "config";
const USE_MANAGED_IDENTITIES = process.env.USE_MANAGED_IDENTITIES === "true";

// LRU Cache for frequently accessed items
class LRUCache<T> {
  private cache = new Map<string, { value: T; timestamp: number }>();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttlMinutes: number = 5) {
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    // Check if item has expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: string, value: T): void {
    // Remove if already exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0 // Would need to track hits/misses for actual hit rate
    };
  }
}

// Global cache instances
const queryCache = new LRUCache<any[]>(50, 2); // 2 minute TTL for query results
const itemCache = new LRUCache<any>(200, 5); // 5 minute TTL for individual items

const getCosmosCredential = () => {
  if (USE_MANAGED_IDENTITIES) {
    return new DefaultAzureCredential();
  }
  const key = process.env.AZURE_COSMOSDB_KEY;
  if (!key) {
    throw new Error("Azure Cosmos DB key is not provided in environment variables.");
  }
  return key;
};

let clientInstance: CosmosClient | null = null;

export const CosmosInstance = (): CosmosClient => {
  if (clientInstance) {
    return clientInstance;
  }

  const endpoint = process.env.AZURE_COSMOSDB_URI;
  if (!endpoint) {
    throw new Error(
      "Azure Cosmos DB endpoint is not configured. Please configure it in the .env file."
    );
  }

  const credential = getCosmosCredential();
  if (credential instanceof DefaultAzureCredential) {
    clientInstance = new CosmosClient({ endpoint, aadCredentials: credential });
  } else {
    clientInstance = new CosmosClient({ endpoint, key: credential });
  }

  return clientInstance;
};

export const ConfigContainer = (): Container => {
  const client = CosmosInstance();
  const database = client.database(DB_NAME);
  return database.container(CONFIG_CONTAINER_NAME);
};

export const HistoryContainer = (): Container => {
  const client = CosmosInstance();
  const database = client.database(DB_NAME);
  return database.container(CONTAINER_NAME);
};

// Enhanced Cosmos operations with optimization
export const OptimizedCosmosOperations = {
  /**
   * Optimized query with caching and monitoring
   */
  async query<T>(
    container: Container, 
    querySpec: any, 
    options: any = {},
    enableCache: boolean = true
  ): Promise<{ resources: T[]; requestCharge: number; activityId: string }> {
    const cacheKey = enableCache ? 
      `query:${JSON.stringify(querySpec)}:${JSON.stringify(options)}` : 
      null;
    
    // Check cache first
    if (cacheKey && enableCache) {
      const cached = queryCache.get(cacheKey);
      if (cached) {
        logger.debug('Cache hit for query', { cacheKey: cacheKey.substring(0, 50) });
        return {
          resources: cached,
          requestCharge: 0, // Cached queries consume no RU
          activityId: 'cached'
        };
      }
    }

    const measurement = performanceMonitor.startMeasurement('cosmos_query_optimized', {
      container: container.id || 'unknown',
      query: querySpec.query || 'unknown',
      cached: false,
    });

    try {
      // Enable cross-partition queries only when necessary
      const queryOptions = {
        enableCrossPartitionQuery: options.enableCrossPartitionQuery ?? false,
        maxItemCount: options.maxItemCount ?? 100,
        ...options
      };

      const response = await container.items.query<T>(querySpec, queryOptions).fetchAll();
      
      measurement.finish(true, {
        resultCount: response.resources.length,
        requestCharge: response.requestCharge,
        activityId: response.activityId,
        cached: false,
      });

      // Cache successful results
      if (cacheKey && enableCache && response.resources.length > 0) {
        queryCache.set(cacheKey, response.resources);
      }

      logger.debug('Query executed', {
        container: container.id,
        resultCount: response.resources.length,
        requestCharge: response.requestCharge,
        activityId: response.activityId
      });

      return {
        resources: response.resources,
        requestCharge: response.requestCharge,
        activityId: response.activityId || 'unknown'
      };
    } catch (error) {
      measurement.finish(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      logger.error('Query failed', {
        container: container.id,
        query: querySpec.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  },

  /**
   * Optimized point read with caching
   */
  async read<T>(
    container: Container, 
    id: string, 
    partitionKey?: string,
    enableCache: boolean = true
  ): Promise<{ resource: T | undefined; requestCharge: number; activityId: string }> {
    const cacheKey = enableCache ? `item:${container.id}:${id}:${partitionKey || 'no-pk'}` : null;
    
    // Check cache first
    if (cacheKey && enableCache) {
      const cached = itemCache.get(cacheKey);
      if (cached) {
        logger.debug('Cache hit for item read', { id, partitionKey });
        return {
          resource: cached,
          requestCharge: 0,
          activityId: 'cached'
        };
      }
    }

    const measurement = performanceMonitor.startMeasurement('cosmos_read_optimized', {
      container: container.id || 'unknown',
      hasPartitionKey: !!partitionKey,
      cached: false,
    });

    try {
      const response = await container.item(id, partitionKey).read<T>();
      
      measurement.finish(true, {
        resultCount: response.resource ? 1 : 0,
        requestCharge: response.requestCharge,
        activityId: response.activityId,
        cached: false,
      });

      // Cache successful reads
      if (cacheKey && enableCache && response.resource) {
        itemCache.set(cacheKey, response.resource);
      }

      logger.debug('Item read completed', {
        container: container.id,
        id,
        found: !!response.resource,
        requestCharge: response.requestCharge,
        activityId: response.activityId
      });

      return {
        resource: response.resource,
        requestCharge: response.requestCharge,
        activityId: response.activityId || 'unknown'
      };
    } catch (error) {
      measurement.finish(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
        logger.debug('Item not found', { container: container.id, id, partitionKey });
        return {
          resource: undefined,
          requestCharge: 1, // Point reads that miss still consume RU
          activityId: 'not-found'
        };
      }
      
      logger.error('Item read failed', {
        container: container.id,
        id,
        partitionKey,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  },

  /**
   * Optimized upsert with cache invalidation
   */
  async upsert<T>(container: Container, item: T): Promise<{ resource: T; requestCharge: number; activityId: string }> {
    const measurement = performanceMonitor.startMeasurement('cosmos_upsert_optimized', {
      container: container.id || 'unknown',
    });

    try {
      const response = await container.items.upsert(item);
      
      measurement.finish(true, {
        requestCharge: response.requestCharge,
        activityId: response.activityId,
      });

      // Invalidate cache for this item and related queries
      const itemWithId = item as any;
      if (itemWithId.id) {
        // Clear specific item cache
        const itemCacheKey = `item:${container.id}:${itemWithId.id}`;
        itemCache.delete(itemCacheKey);
        
        // Clear query cache (simpler approach - clear all for this container)
        // In production, you might want more sophisticated cache invalidation
        this.clearCacheForContainer(container.id);
      }

      logger.debug('Item upserted', {
        container: container.id,
        id: itemWithId.id,
        requestCharge: response.requestCharge,
        activityId: response.activityId
      });

      return {
        resource: response.resource!,
        requestCharge: response.requestCharge,
        activityId: response.activityId || 'unknown'
      };
    } catch (error) {
      measurement.finish(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      logger.error('Item upsert failed', {
        container: container.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  },

  /**
   * Optimized delete with cache invalidation
   */
  async delete(container: Container, id: string, partitionKey?: string): Promise<{ requestCharge: number; activityId: string }> {
    const measurement = performanceMonitor.startMeasurement('cosmos_delete_optimized', {
      container: container.id || 'unknown',
      hasPartitionKey: !!partitionKey,
    });

    try {
      const response = await container.item(id, partitionKey).delete();
      
      measurement.finish(true, {
        requestCharge: response.requestCharge,
        activityId: response.activityId,
      });

      // Invalidate cache
      const itemCacheKey = `item:${container.id}:${id}:${partitionKey || 'no-pk'}`;
      itemCache.delete(itemCacheKey);
      this.clearCacheForContainer(container.id);

      logger.debug('Item deleted', {
        container: container.id,
        id,
        partitionKey,
        requestCharge: response.requestCharge,
        activityId: response.activityId
      });

      return {
        requestCharge: response.requestCharge,
        activityId: response.activityId || 'unknown'
      };
    } catch (error) {
      measurement.finish(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      logger.error('Item delete failed', {
        container: container.id,
        id,
        partitionKey,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  },

  /**
   * Batch operations for better performance
   */
  async batchUpsert<T>(container: Container, items: T[]): Promise<{ requestCharge: number; successCount: number; errors: any[] }> {
    if (items.length === 0) {
      return { requestCharge: 0, successCount: 0, errors: [] };
    }

    const measurement = performanceMonitor.startMeasurement('cosmos_batch_upsert', {
      container: container.id || 'unknown',
      itemCount: items.length,
    });

    let totalRequestCharge = 0;
    let successCount = 0;
    const errors: any[] = [];

    try {
      // Process in batches of 100 (Cosmos DB limit)
      const batchSize = 100;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        // Execute batch operations in parallel
        const promises = batch.map(async (item) => {
          try {
            const response = await container.items.upsert(item);
            return { success: true, requestCharge: response.requestCharge };
          } catch (error) {
            return { success: false, error, requestCharge: 0 };
          }
        });

        const results = await Promise.all(promises);
        
        results.forEach(result => {
          totalRequestCharge += result.requestCharge;
          if (result.success) {
            successCount++;
          } else {
            errors.push(result.error);
          }
        });
      }

      measurement.finish(true, {
        requestCharge: totalRequestCharge,
        successCount,
        errorCount: errors.length,
      });

      // Clear cache for container due to bulk changes
      this.clearCacheForContainer(container.id);

      logger.debug('Batch upsert completed', {
        container: container.id,
        totalItems: items.length,
        successCount,
        errorCount: errors.length,
        totalRequestCharge
      });

      return { requestCharge: totalRequestCharge, successCount, errors };
    } catch (error) {
      measurement.finish(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      logger.error('Batch upsert failed', {
        container: container.id,
        itemCount: items.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  },

  /**
   * Clear cache for a specific container
   */
  clearCacheForContainer(containerId: string): void {
    // Clear query cache (simple approach - clear all)
    queryCache.clear();
    
    // Clear item cache for this container
    // More sophisticated implementation would track items by container
    logger.debug('Cache cleared for container', { containerId });
  },

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      queryCache: queryCache.getStats(),
      itemCache: itemCache.getStats(),
    };
  },

  /**
   * Warm up cache with commonly accessed data
   */
  async warmupCache(container: Container, warmupQueries: any[]): Promise<void> {
    logger.info('Starting cache warmup', { 
      container: container.id, 
      queryCount: warmupQueries.length 
    });

    const promises = warmupQueries.map(async (querySpec) => {
      try {
        await this.query(container, querySpec, {}, true);
      } catch (error) {
        logger.warn('Warmup query failed', { 
          query: querySpec.query,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    await Promise.all(promises);
    
    logger.info('Cache warmup completed', { 
      container: container.id,
      cacheStats: this.getCacheStats()
    });
  }
};

// Export optimized operations as default
export const CosmosOperations = OptimizedCosmosOperations;