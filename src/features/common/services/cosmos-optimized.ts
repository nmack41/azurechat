// ABOUTME: Optimized Cosmos DB service with caching, pagination, and performance improvements
// ABOUTME: Provides connection pooling, query optimization, and result caching

import { CosmosClient, Container, SqlQuerySpec, FeedOptions } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { LRUCache } from "../performance-utils";
import { performanceMonitor } from "../observability/performance-monitor";
import { connectionPoolManager } from "./connection-pool-manager";
import { streamingQueryService, StreamingOptions, StreamingCallback } from "./streaming-query-service";

// Environment configuration
const DB_NAME = process.env.AZURE_COSMOSDB_DB_NAME || "chat";
const CONTAINER_NAME = process.env.AZURE_COSMOSDB_CONTAINER_NAME || "history";
const CONFIG_CONTAINER_NAME = process.env.AZURE_COSMOSDB_CONFIG_CONTAINER_NAME || "config";
const USE_MANAGED_IDENTITIES = process.env.USE_MANAGED_IDENTITIES === "true";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  pageSize?: number;
  continuationToken?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  continuationToken?: string;
  hasMore: boolean;
  totalCount?: number;
}

/**
 * Singleton Cosmos client with connection pooling
 */
class CosmosClientSingleton {
  private static instance: CosmosClient;

  static getInstance(): CosmosClient {
    if (!this.instance) {
      const endpoint = process.env.AZURE_COSMOSDB_URI;
      
      if (!endpoint) {
        throw new Error(
          "Azure Cosmos DB endpoint is not configured. Please configure it in the .env file."
        );
      }

      const credential = this.getCosmosCredential();
      
      if (credential instanceof DefaultAzureCredential) {
        this.instance = new CosmosClient({ 
          endpoint, 
          aadCredentials: credential,
          connectionPolicy: {
            enableEndpointDiscovery: true,
            preferredLocations: this.getPreferredLocations(),
            connectionMode: "Gateway", // Better for serverless
            requestTimeout: 10000,
            enableAutomaticFailover: true,
          }
        });
      } else {
        this.instance = new CosmosClient({ 
          endpoint, 
          key: credential,
          connectionPolicy: {
            enableEndpointDiscovery: true,
            preferredLocations: this.getPreferredLocations(),
            connectionMode: "Gateway",
            requestTimeout: 10000,
            enableAutomaticFailover: true,
          }
        });
      }
    }
    
    return this.instance;
  }

  private static getCosmosCredential() {
    if (USE_MANAGED_IDENTITIES) {
      return new DefaultAzureCredential();
    }
    const key = process.env.AZURE_COSMOSDB_KEY;
    if (!key) {
      throw new Error("Azure Cosmos DB key is not provided in environment variables.");
    }
    return key;
  }

  private static getPreferredLocations(): string[] {
    const region = process.env.AZURE_REGION || "East US";
    return [region];
  }
}

/**
 * Optimized Cosmos DB service with caching and pagination
 */
export class OptimizedCosmosService {
  private client: CosmosClient;
  private queryCache: LRUCache<string, CacheEntry<any>>;
  private containerCache = new Map<string, Container>();
  private useConnectionPool: boolean;

  constructor(cacheSize = 100, useConnectionPool = true) {
    this.client = CosmosClientSingleton.getInstance();
    this.queryCache = new LRUCache(cacheSize);
    this.useConnectionPool = useConnectionPool;
  }

  /**
   * Execute operation with connection pooling if enabled
   */
  private async executeWithPooling<T>(
    operation: (client: CosmosClient) => Promise<T>
  ): Promise<T> {
    if (this.useConnectionPool) {
      return connectionPoolManager.executeWithConnection(operation);
    } else {
      return operation(this.client);
    }
  }

  /**
   * Get container with caching
   */
  private getContainer(containerName: string, client?: CosmosClient): Container {
    const keyClient = client || this.client;
    const cacheKey = `${containerName}-${keyClient.constructor.name}`;
    
    if (!this.containerCache.has(cacheKey)) {
      const database = keyClient.database(DB_NAME);
      const container = database.container(containerName);
      this.containerCache.set(cacheKey, container);
    }
    return this.containerCache.get(cacheKey)!;
  }

  /**
   * Get history container
   */
  public historyContainer(): Container {
    return this.getContainer(CONTAINER_NAME);
  }

  /**
   * Get config container
   */
  public configContainer(): Container {
    return this.getContainer(CONFIG_CONTAINER_NAME);
  }

  /**
   * Generate cache key from query
   */
  private generateCacheKey(query: SqlQuerySpec, partitionKey?: string): string {
    const queryKey = JSON.stringify({
      query: query.query,
      parameters: query.parameters,
      partitionKey,
    });
    return queryKey;
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid<T>(entry?: CacheEntry<T>): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL;
  }

  /**
   * Execute query with caching and pagination
   */
  public async queryWithPagination<T>(
    container: Container,
    query: SqlQuerySpec,
    options: PaginationOptions & FeedOptions = {}
  ): Promise<PaginatedResponse<T>> {
    const measurement = performanceMonitor.startMeasurement('cosmos_query_paginated', {
      container: container.id,
      hasPartitionKey: !!options.partitionKey,
    });

    try {
      const pageSize = Math.min(options.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
      
      const feedOptions: FeedOptions = {
        ...options,
        maxItemCount: pageSize,
        continuationToken: options.continuationToken,
      };

      // Don't cache paginated queries with continuation tokens
      if (!options.continuationToken && options.partitionKey) {
        const cacheKey = this.generateCacheKey(query, options.partitionKey as string);
        const cached = this.queryCache.get(cacheKey);
        
        if (this.isCacheValid(cached)) {
          measurement.finish(true, {
            cached: true,
            resultCount: cached.data.items.length,
          });
          return cached.data;
        }
      }

      const response = await this.executeWithPooling(async (client) => {
        const pooledContainer = this.getContainer(container.id.split('/').pop() || CONTAINER_NAME, client);
        return pooledContainer.items.query<T>(query, feedOptions).fetchNext();
      });

      const result: PaginatedResponse<T> = {
        items: response.resources,
        continuationToken: response.continuationToken,
        hasMore: !!response.continuationToken,
      };

      // Cache the first page only
      if (!options.continuationToken && options.partitionKey) {
        const cacheKey = this.generateCacheKey(query, options.partitionKey as string);
        this.queryCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
        });
      }

      measurement.finish(true, {
        cached: false,
        requestUnits: response.requestCharge,
        resultCount: result.items.length,
        query: query.query,
      });

      return result;
    } catch (error) {
      measurement.finish(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: query.query,
      });
      throw error;
    }
  }

  /**
   * Execute query with caching (no pagination)
   */
  public async query<T>(
    container: Container,
    query: SqlQuerySpec,
    options: FeedOptions = {}
  ): Promise<T[]> {
    const measurement = performanceMonitor.startMeasurement('cosmos_query', {
      container: container.id,
      hasPartitionKey: !!options.partitionKey,
    });

    try {
      if (options.partitionKey) {
        const cacheKey = this.generateCacheKey(query, options.partitionKey as string);
        const cached = this.queryCache.get(cacheKey);
        
        if (this.isCacheValid(cached)) {
          measurement.finish(true, {
            cached: true,
            resultCount: cached.data.length,
          });
          return cached.data;
        }
      }

      const response = await this.executeWithPooling(async (client) => {
        const pooledContainer = this.getContainer(container.id.split('/').pop() || CONTAINER_NAME, client);
        return pooledContainer.items.query<T>(query, options).fetchAll();
      });

      if (options.partitionKey) {
        const cacheKey = this.generateCacheKey(query, options.partitionKey as string);
        this.queryCache.set(cacheKey, {
          data: response.resources,
          timestamp: Date.now(),
        });
      }

      measurement.finish(true, {
        cached: false,
        requestUnits: response.requestCharge,
        resultCount: response.resources.length,
        query: query.query,
      });

      return response.resources;
    } catch (error) {
      measurement.finish(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: query.query,
      });
      throw error;
    }
  }

  /**
   * Batch read items for better performance
   */
  public async batchRead<T>(
    container: Container,
    ids: string[],
    partitionKey: string
  ): Promise<T[]> {
    if (ids.length === 0) return [];

    // Cosmos DB has a limit on batch size
    const batchSize = 100;
    const results: T[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const query: SqlQuerySpec = {
        query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)`,
        parameters: [
          { name: "@ids", value: batch }
        ],
      };

      const items = await this.query<T>(container, query, { partitionKey });
      results.push(...items);
    }

    return results;
  }

  /**
   * Upsert with cache invalidation
   */
  public async upsert<T>(
    container: Container,
    item: T & { id: string },
    partitionKey: string
  ): Promise<T> {
    const measurement = performanceMonitor.startMeasurement('cosmos_upsert', {
      container: container.id,
    });

    try {
      const response = await this.executeWithPooling(async (client) => {
        const pooledContainer = this.getContainer(container.id.split('/').pop() || CONTAINER_NAME, client);
        return pooledContainer.items.upsert(item);
      });
      
      // Invalidate relevant caches
      this.invalidateCache(partitionKey);
      
      measurement.finish(true, {
        requestUnits: response.requestCharge,
      });
      
      return response.resource;
    } catch (error) {
      measurement.finish(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Batch upsert for better performance
   */
  public async batchUpsert<T extends { id: string }>(
    container: Container,
    items: T[],
    partitionKey: string
  ): Promise<T[]> {
    const results = await Promise.all(
      items.map(item => container.items.upsert(item))
    );

    // Invalidate cache for the partition
    this.invalidateCache(partitionKey);

    return results.map(r => r.resource);
  }

  /**
   * Delete with cache invalidation
   */
  public async delete(
    container: Container,
    id: string,
    partitionKey: string
  ): Promise<void> {
    await container.item(id, partitionKey).delete();
    this.invalidateCache(partitionKey);
  }

  /**
   * Invalidate cache for a partition key
   */
  private invalidateCache(partitionKey: string): void {
    // Simple approach: clear all cache for now
    // In production, implement more sophisticated cache invalidation
    this.queryCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    return {
      size: this.queryCache.size(),
      ttl: CACHE_TTL,
    };
  }

  /**
   * Get connection pool statistics
   */
  public getConnectionPoolStats() {
    if (this.useConnectionPool) {
      return connectionPoolManager.getStats();
    }
    return null;
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Stream large query results for memory-efficient processing
   */
  public async streamQuery<T>(
    container: Container,
    query: SqlQuerySpec,
    callback: StreamingCallback<T>,
    options: StreamingOptions = {}
  ): Promise<string> {
    return streamingQueryService.streamQuery(
      container,
      query,
      callback,
      options
    );
  }

  /**
   * Create async iterator for streaming large datasets
   */
  public streamAsyncIterator<T>(
    container: Container,
    query: SqlQuerySpec,
    options: StreamingOptions = {}
  ): AsyncIterableIterator<any> {
    return streamingQueryService.streamAsyncIterator(container, query, options);
  }

  /**
   * Stream and process data in batches
   */
  public async streamBatches<T>(
    container: Container,
    query: SqlQuerySpec,
    batchSize: number,
    onBatch: (batch: any[], batchIndex: number) => Promise<void>,
    options: StreamingOptions = {}
  ): Promise<string> {
    return streamingQueryService.streamBatches(
      container,
      query,
      batchSize,
      onBatch,
      options
    );
  }

  /**
   * Cancel a streaming operation
   */
  public cancelStream(streamId: string): boolean {
    return streamingQueryService.cancelStream(streamId);
  }

  /**
   * Get streaming statistics
   */
  public getStreamingStats() {
    return streamingQueryService.getGlobalStats();
  }

  /**
   * Create optimized indexes for common queries
   */
  public static getRecommendedIndexingPolicy() {
    return {
      indexingMode: "consistent",
      automatic: true,
      includedPaths: [
        {
          path: "/*",
          indexes: [
            {
              kind: "Range",
              dataType: "Number",
              precision: -1
            },
            {
              kind: "Range",
              dataType: "String",
              precision: -1
            }
          ]
        }
      ],
      excludedPaths: [
        {
          path: "/content/*" // Exclude large text content from indexing
        }
      ],
      compositeIndexes: [
        // Optimize for chat thread queries
        [
          { path: "/type", order: "ascending" },
          { path: "/userId", order: "ascending" },
          { path: "/isDeleted", order: "ascending" },
          { path: "/createdAt", order: "descending" }
        ],
        // Optimize for message queries
        [
          { path: "/type", order: "ascending" },
          { path: "/threadId", order: "ascending" },
          { path: "/createdAt", order: "ascending" }
        ]
      ]
    };
  }
}

// Export singleton instance
export const optimizedCosmosService = new OptimizedCosmosService();

// Legacy compatibility exports
export const CosmosInstance = () => CosmosClientSingleton.getInstance();
export const HistoryContainer = () => optimizedCosmosService.historyContainer();
export const ConfigContainer = () => optimizedCosmosService.configContainer();