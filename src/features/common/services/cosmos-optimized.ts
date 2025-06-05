// ABOUTME: Optimized Cosmos DB service with caching, pagination, and performance improvements
// ABOUTME: Provides connection pooling, query optimization, and result caching

import { CosmosClient, Container, SqlQuerySpec, FeedOptions } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { LRUCache } from "../performance-utils";

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

  constructor(cacheSize = 100) {
    this.client = CosmosClientSingleton.getInstance();
    this.queryCache = new LRUCache(cacheSize);
  }

  /**
   * Get container with caching
   */
  private getContainer(containerName: string): Container {
    if (!this.containerCache.has(containerName)) {
      const database = this.client.database(DB_NAME);
      const container = database.container(containerName);
      this.containerCache.set(containerName, container);
    }
    return this.containerCache.get(containerName)!;
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
        return cached.data;
      }
    }

    const response = await container.items
      .query<T>(query, feedOptions)
      .fetchNext();

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

    return result;
  }

  /**
   * Execute query with caching (no pagination)
   */
  public async query<T>(
    container: Container,
    query: SqlQuerySpec,
    options: FeedOptions = {}
  ): Promise<T[]> {
    if (options.partitionKey) {
      const cacheKey = this.generateCacheKey(query, options.partitionKey as string);
      const cached = this.queryCache.get(cacheKey);
      
      if (this.isCacheValid(cached)) {
        return cached.data;
      }
    }

    const { resources } = await container.items
      .query<T>(query, options)
      .fetchAll();

    if (options.partitionKey) {
      const cacheKey = this.generateCacheKey(query, options.partitionKey as string);
      this.queryCache.set(cacheKey, {
        data: resources,
        timestamp: Date.now(),
      });
    }

    return resources;
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
    const response = await container.items.upsert(item);
    
    // Invalidate relevant caches
    this.invalidateCache(partitionKey);
    
    return response.resource;
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
   * Clear all caches
   */
  public clearCache(): void {
    this.queryCache.clear();
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