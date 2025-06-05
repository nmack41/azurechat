// ABOUTME: LRU (Least Recently Used) cache implementation for efficient memory management
// ABOUTME: Automatically evicts least recently used items when cache reaches max size

export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private accessOrder: K[];
  public readonly maxSize: number;
  private hits: number = 0;
  private misses: number = 0;
  
  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.accessOrder = [];
    this.maxSize = maxSize;
  }
  
  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      this.hits++;
      // Move to end (most recently used)
      this.updateAccessOrder(key);
      return this.cache.get(key);
    }
    this.misses++;
    return undefined;
  }
  
  /**
   * Set value in cache
   */
  set(key: K, value: V): void {
    // If key exists, update it
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.updateAccessOrder(key);
      return;
    }
    
    // If cache is full, evict least recently used
    if (this.cache.size >= this.maxSize) {
      const lru = this.accessOrder.shift();
      if (lru !== undefined) {
        this.cache.delete(lru);
      }
    }
    
    // Add new entry
    this.cache.set(key, value);
    this.accessOrder.push(key);
  }
  
  /**
   * Delete entry from cache
   */
  delete(key: K): boolean {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    return this.cache.delete(key);
  }
  
  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
  }
  
  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
  
  /**
   * Check if key exists
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }
  
  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }
  
  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: K): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }
  
  /**
   * Get all keys in order of access (least to most recent)
   */
  getKeys(): K[] {
    return [...this.accessOrder];
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hits: number; misses: number; hitRate: number } {
    return {
      size: this.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
    };
  }
}