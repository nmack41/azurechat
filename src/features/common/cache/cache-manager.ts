// ABOUTME: Client-side cache manager for optimizing data fetching and reducing server calls
// ABOUTME: Implements LRU cache with TTL support for chat threads, messages, and user data

import { LRUCache } from './lru-cache';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of items in cache
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheManager {
  private caches: Map<string, LRUCache<string, CacheEntry<any>>> = new Map();
  
  // Default cache configurations
  private readonly defaultConfigs = {
    chatThreads: { ttl: 5 * 60 * 1000, maxSize: 100 }, // 5 minutes, 100 threads
    chatMessages: { ttl: 10 * 60 * 1000, maxSize: 50 }, // 10 minutes, 50 conversations
    personas: { ttl: 30 * 60 * 1000, maxSize: 20 }, // 30 minutes, 20 personas
    extensions: { ttl: 30 * 60 * 1000, maxSize: 20 }, // 30 minutes, 20 extensions
    documents: { ttl: 15 * 60 * 1000, maxSize: 30 }, // 15 minutes, 30 document sets
  };
  
  /**
   * Get or create a cache for a specific namespace
   */
  private getCache(namespace: string): LRUCache<string, CacheEntry<any>> {
    if (!this.caches.has(namespace)) {
      const config = this.defaultConfigs[namespace as keyof typeof this.defaultConfigs] || 
                     { ttl: 5 * 60 * 1000, maxSize: 50 };
      this.caches.set(namespace, new LRUCache<string, CacheEntry<any>>(config.maxSize));
    }
    return this.caches.get(namespace)!;
  }
  
  /**
   * Get data from cache
   */
  get<T>(namespace: string, key: string): T | null {
    const cache = this.getCache(namespace);
    const entry = cache.get(key);
    
    if (!entry) return null;
    
    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  /**
   * Set data in cache
   */
  set<T>(namespace: string, key: string, data: T, options?: CacheOptions): void {
    const cache = this.getCache(namespace);
    const config = this.defaultConfigs[namespace as keyof typeof this.defaultConfigs] || 
                   { ttl: 5 * 60 * 1000 };
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: options?.ttl || config.ttl,
    };
    
    cache.set(key, entry);
  }
  
  /**
   * Invalidate specific cache entry
   */
  invalidate(namespace: string, key: string): void {
    const cache = this.getCache(namespace);
    cache.delete(key);
  }
  
  /**
   * Invalidate all entries in a namespace
   */
  invalidateNamespace(namespace: string): void {
    const cache = this.getCache(namespace);
    cache.clear();
  }
  
  /**
   * Invalidate all caches
   */
  invalidateAll(): void {
    this.caches.forEach(cache => cache.clear());
  }
  
  /**
   * Get cache statistics
   */
  getStats(namespace?: string): Record<string, any> {
    if (namespace) {
      const cache = this.getCache(namespace);
      return {
        size: cache.size,
        maxSize: cache.maxSize,
        hitRate: cache.getHitRate(),
      };
    }
    
    const stats: Record<string, any> = {};
    this.caches.forEach((cache, name) => {
      stats[name] = {
        size: cache.size,
        maxSize: cache.maxSize,
        hitRate: cache.getHitRate(),
      };
    });
    return stats;
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

/**
 * Cache key generators for consistent key creation
 */
export const cacheKeys = {
  chatThreads: (userId: string) => `threads:${userId}`,
  chatThread: (threadId: string) => `thread:${threadId}`,
  chatMessages: (threadId: string) => `messages:${threadId}`,
  chatDocuments: (threadId: string) => `documents:${threadId}`,
  personas: (userId: string) => `personas:${userId}`,
  extensions: (userId: string) => `extensions:${userId}`,
  userProfile: (userId: string) => `profile:${userId}`,
};