// ABOUTME: Base class and utilities for optimized Valtio store patterns
// ABOUTME: Provides performance optimization patterns, automatic cleanup, and selective subscriptions

import { proxy, subscribe, snapshot, ref } from "valtio";
import { subscribeKey } from "valtio/utils";

/**
 * Base interface for store state that supports optimization
 */
export interface OptimizedStoreState {
  /**
   * Tracks the last update timestamp for staleness detection
   */
  _lastUpdated?: number;
  
  /**
   * Tracks dirty state for efficient updates
   */
  _isDirty?: boolean;
}

/**
 * Configuration for store optimization
 */
export interface StoreOptimizationConfig {
  /**
   * Maximum age for cached data in milliseconds
   */
  maxAge?: number;
  
  /**
   * Enable automatic cleanup of old data
   */
  autoCleanup?: boolean;
  
  /**
   * Batch update interval in milliseconds
   */
  batchInterval?: number;
  
  /**
   * Maximum items to keep in collections
   */
  maxItems?: number;
}

/**
 * Performance tracker for store operations
 */
class StorePerformanceTracker {
  private metrics = new Map<string, { count: number; totalTime: number; lastUpdate: number }>();

  startOperation(operationName: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      const existing = this.metrics.get(operationName) || { count: 0, totalTime: 0, lastUpdate: 0 };
      this.metrics.set(operationName, {
        count: existing.count + 1,
        totalTime: existing.totalTime + duration,
        lastUpdate: Date.now()
      });
    };
  }

  getMetrics(): Record<string, { avgTime: number; count: number; lastUpdate: number }> {
    const result: Record<string, { avgTime: number; count: number; lastUpdate: number }> = {};
    
    for (const [operation, metrics] of this.metrics.entries()) {
      result[operation] = {
        avgTime: metrics.totalTime / metrics.count,
        count: metrics.count,
        lastUpdate: metrics.lastUpdate
      };
    }
    
    return result;
  }

  reset(): void {
    this.metrics.clear();
  }
}

/**
 * Global performance tracker instance
 */
export const storePerformanceTracker = new StorePerformanceTracker();

/**
 * Optimized store base class with common patterns
 */
export class OptimizedStoreBase<T extends OptimizedStoreState> {
  protected config: StoreOptimizationConfig;
  protected batchedUpdates: Set<string> = new Set();
  protected batchTimeout?: NodeJS.Timeout;
  protected cleanupInterval?: NodeJS.Timeout;

  constructor(
    protected store: T,
    config: StoreOptimizationConfig = {}
  ) {
    this.config = {
      maxAge: 5 * 60 * 1000, // 5 minutes default
      autoCleanup: true,
      batchInterval: 16, // ~60fps
      maxItems: 1000,
      ...config
    };

    this.initializeOptimizations();
  }

  private initializeOptimizations(): void {
    // Set up automatic cleanup if enabled
    if (this.config.autoCleanup) {
      this.cleanupInterval = setInterval(() => {
        this.performCleanup();
      }, this.config.maxAge! / 4); // Cleanup every quarter of max age
    }
  }

  /**
   * Batch updates to reduce re-renders
   */
  protected batchUpdate(key: string, updateFn: () => void): void {
    this.batchedUpdates.add(key);
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    this.batchTimeout = setTimeout(() => {
      const finishOp = storePerformanceTracker.startOperation('batch_update');
      
      try {
        updateFn();
        this.store._lastUpdated = Date.now();
        this.store._isDirty = true;
      } finally {
        finishOp();
        this.batchedUpdates.clear();
      }
    }, this.config.batchInterval);
  }

  /**
   * Update a specific property with performance tracking
   */
  protected updateProperty<K extends keyof T>(key: K, value: T[K]): void {
    const finishOp = storePerformanceTracker.startOperation(`update_${String(key)}`);
    
    try {
      (this.store as any)[key] = value;
      this.store._lastUpdated = Date.now();
      this.store._isDirty = true;
    } finally {
      finishOp();
    }
  }

  /**
   * Merge properties efficiently
   */
  protected mergeProperties(updates: Partial<T>): void {
    const finishOp = storePerformanceTracker.startOperation('merge_properties');
    
    try {
      Object.assign(this.store, updates);
      this.store._lastUpdated = Date.now();
      this.store._isDirty = true;
    } finally {
      finishOp();
    }
  }

  /**
   * Check if data is stale
   */
  protected isStale(): boolean {
    if (!this.store._lastUpdated) return true;
    return Date.now() - this.store._lastUpdated > this.config.maxAge!;
  }

  /**
   * Override this method to implement custom cleanup logic
   */
  protected performCleanup(): void {
    // Default implementation - mark as clean
    this.store._isDirty = false;
  }

  /**
   * Create a selective subscription that only updates when specific keys change
   */
  public createSelectiveSubscription<K extends keyof T>(
    keys: K[],
    callback: (values: Pick<T, K>) => void
  ): () => void {
    const unsubscribeFunctions: Array<() => void> = [];
    
    keys.forEach(key => {
      const unsubscribe = subscribeKey(this.store, key, () => {
        const selectedValues = {} as Pick<T, K>;
        keys.forEach(k => {
          selectedValues[k] = this.store[k];
        });
        callback(selectedValues);
      });
      unsubscribeFunctions.push(unsubscribe);
    });

    // Return cleanup function
    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }

  /**
   * Get current performance metrics for this store
   */
  public getPerformanceMetrics(): Record<string, { avgTime: number; count: number; lastUpdate: number }> {
    return storePerformanceTracker.getMetrics();
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.batchedUpdates.clear();
  }
}

/**
 * Create an optimized proxy with ref optimization for large objects
 */
export function createOptimizedProxy<T extends OptimizedStoreState>(
  initialState: T,
  config: StoreOptimizationConfig = {}
): T {
  // Mark large objects as refs to prevent deep proxy wrapping
  const optimizedState = { ...initialState };
  
  // Auto-mark arrays with more than 100 items as refs
  Object.keys(optimizedState).forEach(key => {
    const value = (optimizedState as any)[key];
    if (Array.isArray(value) && value.length > 100) {
      (optimizedState as any)[key] = ref(value);
    }
  });

  const proxy = proxy({
    ...optimizedState,
    _lastUpdated: Date.now(),
    _isDirty: false
  }) as T;

  return proxy;
}

/**
 * Hook factory for creating optimized store hooks
 */
export function createOptimizedStoreHook<T extends OptimizedStoreState>(
  store: T,
  options: { 
    sync?: boolean;
    keys?: Array<keyof T>;
  } = {}
) {
  return () => {
    if (options.keys && options.keys.length > 0) {
      // Create selective snapshot for better performance
      const selectiveState = {} as Pick<T, keyof T>;
      options.keys.forEach(key => {
        selectiveState[key] = store[key];
      });
      return snapshot(selectiveState as T);
    }
    
    return snapshot(store, { sync: options.sync });
  };
}

/**
 * Utility for managing collections with automatic size limits
 */
export class OptimizedCollection<T> {
  private items: T[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  add(item: T): void {
    this.items.push(item);
    this.enforceSize();
  }

  addMany(items: T[]): void {
    this.items.push(...items);
    this.enforceSize();
  }

  remove(predicate: (item: T) => boolean): T[] {
    const removed: T[] = [];
    this.items = this.items.filter(item => {
      if (predicate(item)) {
        removed.push(item);
        return false;
      }
      return true;
    });
    return removed;
  }

  get(index: number): T | undefined {
    return this.items[index];
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  get length(): number {
    return this.items.length;
  }

  get all(): readonly T[] {
    return this.items;
  }

  clear(): void {
    this.items = [];
  }

  private enforceSize(): void {
    if (this.items.length > this.maxSize) {
      // Remove oldest items (FIFO)
      this.items = this.items.slice(-this.maxSize);
    }
  }
}

/**
 * Debounced update helper for high-frequency updates
 */
export function createDebouncedUpdater<T>(
  updateFn: (value: T) => void,
  delay: number = 300
): (value: T) => void {
  let timeout: NodeJS.Timeout;
  
  return (value: T) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => updateFn(value), delay);
  };
}

/**
 * Throttled update helper for performance-critical updates
 */
export function createThrottledUpdater<T>(
  updateFn: (value: T) => void,
  delay: number = 16 // ~60fps
): (value: T) => void {
  let lastUpdate = 0;
  let timeout: NodeJS.Timeout;
  
  return (value: T) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdate;
    
    if (timeSinceLastUpdate >= delay) {
      updateFn(value);
      lastUpdate = now;
    } else {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        updateFn(value);
        lastUpdate = Date.now();
      }, delay - timeSinceLastUpdate);
    }
  };
}