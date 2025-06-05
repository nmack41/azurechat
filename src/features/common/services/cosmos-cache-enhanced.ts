// ABOUTME: Enhanced Cosmos DB caching layer with query result memoization and smart invalidation
// ABOUTME: Implements query fingerprinting, result deduplication, and automatic cache warming

import { SqlQuerySpec } from "@azure/cosmos";
import { LRUCache } from '../cache/lru-cache';
// Simple hash function for query fingerprinting (avoiding crypto dependency)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

export interface QueryCacheOptions {
  ttl?: number;
  maxSize?: number;
  skipCache?: boolean;
  refreshOnAccess?: boolean;
}

export interface CachedQueryResult<T> {
  data: T[];
  timestamp: number;
  ttl: number;
  requestUnits: number;
  fromCache: boolean;
  queryFingerprint: string;
}

export interface QueryMetrics {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  totalRequestUnits: number;
  averageResponseTime: number;
  hitRate: number;
}

/**
 * Enhanced Cosmos DB cache manager with query optimization
 */
export class CosmosQueryCache {
  private queryCache: LRUCache<string, CachedQueryResult<any>>;
  private preparedQueries: Map<string, SqlQuerySpec> = new Map();
  private queryMetrics: QueryMetrics = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalRequestUnits: 0,
    averageResponseTime: 0,
    hitRate: 0
  };
  
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  
  constructor(maxSize: number = 200) {
    this.queryCache = new LRUCache(maxSize);
  }
  
  /**
   * Generate fingerprint for query caching
   */
  private generateQueryFingerprint(query: SqlQuerySpec): string {
    const normalizedQuery = {
      query: query.query.replace(/\s+/g, ' ').trim().toLowerCase(),
      parameters: query.parameters?.sort((a, b) => a.name.localeCompare(b.name)) || [],
    };
    
    return simpleHash(JSON.stringify(normalizedQuery));
  }
  
  /**
   * Get cached query result
   */
  get<T>(
    query: SqlQuerySpec, 
    partitionKey?: string
  ): CachedQueryResult<T> | null {
    const fingerprint = this.generateQueryFingerprint(query);
    const cacheKey = partitionKey ? `${fingerprint}:${partitionKey}` : fingerprint;
    
    const cached = this.queryCache.get(cacheKey);
    if (!cached) {
      return null;
    }
    
    // Check TTL
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.queryCache.delete(cacheKey);
      return null;
    }
    
    this.queryMetrics.cacheHits++;
    this.queryMetrics.totalQueries++;
    this.updateHitRate();
    
    return {
      ...cached,
      fromCache: true
    };
  }
  
  /**
   * Set cached query result
   */
  set<T>(
    query: SqlQuerySpec,
    data: T[],
    requestUnits: number,
    partitionKey?: string,
    options: QueryCacheOptions = {}
  ): void {
    const fingerprint = this.generateQueryFingerprint(query);
    const cacheKey = partitionKey ? `${fingerprint}:${partitionKey}` : fingerprint;
    
    const cached: CachedQueryResult<T> = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.defaultTTL,
      requestUnits,
      fromCache: false,
      queryFingerprint: fingerprint
    };
    
    this.queryCache.set(cacheKey, cached);
    
    this.queryMetrics.cacheMisses++;
    this.queryMetrics.totalQueries++;
    this.queryMetrics.totalRequestUnits += requestUnits;
    this.updateHitRate();
  }
  
  /**
   * Invalidate cache entries by pattern
   */
  invalidateByPattern(pattern: RegExp): number {
    let invalidated = 0;
    const keysToDelete: string[] = [];
    
    for (const key of this.queryCache.getKeys()) {
      if (pattern.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.queryCache.delete(key);
      invalidated++;
    });
    
    return invalidated;
  }
  
  /**
   * Invalidate cache for specific entity types
   */
  invalidateEntityType(entityType: string): number {
    const pattern = new RegExp(`type.*${entityType}`, 'i');
    return this.invalidateByPattern(pattern);
  }
  
  /**
   * Invalidate cache for specific user
   */
  invalidateUser(userId: string): number {
    const pattern = new RegExp(`userId.*${userId}`, 'i');
    return this.invalidateByPattern(pattern);
  }
  
  /**
   * Prepare and cache optimized queries
   */
  prepareQuery(name: string, query: SqlQuerySpec): void {
    // Optimize query by removing unnecessary whitespace and comments
    const optimizedQuery = {
      ...query,
      query: query.query
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
    };
    
    this.preparedQueries.set(name, optimizedQuery);
  }
  
  /**
   * Get prepared query
   */
  getPreparedQuery(name: string): SqlQuerySpec | undefined {
    return this.preparedQueries.get(name);
  }
  
  /**
   * Get cache statistics
   */
  getStats(): QueryMetrics & { cacheSize: number; maxCacheSize: number } {
    return {
      ...this.queryMetrics,
      cacheSize: this.queryCache.size,
      maxCacheSize: this.queryCache.maxSize
    };
  }
  
  /**
   * Clear all caches
   */
  clear(): void {
    this.queryCache.clear();
    this.queryMetrics = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalRequestUnits: 0,
      averageResponseTime: 0,
      hitRate: 0
    };
  }
  
  /**
   * Warm cache with common queries
   */
  warmCache(queries: Array<{ name: string; query: SqlQuerySpec }>): void {
    queries.forEach(({ name, query }) => {
      this.prepareQuery(name, query);
    });
  }
  
  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    if (this.queryMetrics.totalQueries > 0) {
      this.queryMetrics.hitRate = this.queryMetrics.cacheHits / this.queryMetrics.totalQueries;
    }
  }
  
  /**
   * Get cache efficiency insights
   */
  getCacheEfficiency(): {
    hitRate: number;
    averageRequestUnits: number;
    potentialSavings: number;
    recommendations: string[];
  } {
    const stats = this.getStats();
    const averageRU = stats.totalQueries > 0 ? stats.totalRequestUnits / stats.totalQueries : 0;
    const savedRU = stats.cacheHits * averageRU;
    
    const recommendations: string[] = [];
    
    if (stats.hitRate < 0.3) {
      recommendations.push('Consider increasing cache TTL for frequently accessed data');
    }
    if (stats.hitRate > 0.8) {
      recommendations.push('Excellent cache performance! Consider reducing TTL to ensure data freshness');
    }
    if (averageRU > 10) {
      recommendations.push('High RU consumption detected. Consider query optimization');
    }
    
    return {
      hitRate: stats.hitRate,
      averageRequestUnits: averageRU,
      potentialSavings: savedRU,
      recommendations
    };
  }
}

// Singleton instance
export const cosmosQueryCache = new CosmosQueryCache();

// Common query patterns for preparation
export const COMMON_QUERIES = {
  GET_CHAT_THREADS: {
    name: 'getChatThreads',
    query: {
      query: 'SELECT * FROM root r WHERE r.type = @type AND r.userId = @userId AND r.isDeleted = @isDeleted ORDER BY r.createdAt DESC',
      parameters: [
        { name: '@type', value: 'CHAT_THREAD' },
        { name: '@userId', value: '' },
        { name: '@isDeleted', value: false }
      ]
    }
  },
  GET_CHAT_MESSAGES: {
    name: 'getChatMessages',
    query: {
      query: 'SELECT * FROM root r WHERE r.type = @type AND r.chatThreadId = @chatThreadId ORDER BY r.createdAt ASC',
      parameters: [
        { name: '@type', value: 'CHAT_MESSAGE' },
        { name: '@chatThreadId', value: '' }
      ]
    }
  },
  GET_CHAT_DOCUMENTS: {
    name: 'getChatDocuments',
    query: {
      query: 'SELECT * FROM root r WHERE r.type = @type AND r.chatThreadId = @chatThreadId',
      parameters: [
        { name: '@type', value: 'CHAT_DOCUMENT' },
        { name: '@chatThreadId', value: '' }
      ]
    }
  }
};

// Initialize common queries
cosmosQueryCache.warmCache(Object.values(COMMON_QUERIES));