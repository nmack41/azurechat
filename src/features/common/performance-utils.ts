// ABOUTME: Performance optimization utilities for React components
// ABOUTME: Provides debouncing, throttling, memoization, and virtual scrolling helpers

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';

/**
 * Custom debounce hook with cancel capability
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): [T, () => void] {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      cancel();
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay, cancel]
  ) as T;

  // Cleanup on unmount
  useEffect(() => {
    return cancel;
  }, [cancel]);

  return [debouncedCallback, cancel];
}

/**
 * Custom throttle hook with leading and trailing options
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  limit: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): T {
  const { leading = true, trailing = true } = options;
  const lastCallTime = useRef<number>(0);
  const lastArgs = useRef<Parameters<T> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttled = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTime.current;

      lastArgs.current = args;

      const invokeCallback = () => {
        lastCallTime.current = Date.now();
        callbackRef.current(...args);
      };

      if (timeSinceLastCall >= limit) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = undefined;
        }

        if (leading) {
          invokeCallback();
        }
      } else if (trailing && !timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          invokeCallback();
          timeoutRef.current = undefined;
        }, limit - timeSinceLastCall);
      }
    },
    [limit, leading, trailing]
  ) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttled;
}

/**
 * Intersection Observer hook for lazy loading and virtualization
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [
  (element: Element | null) => void,
  IntersectionObserverEntry | undefined
] {
  const [entry, setEntry] = useState<IntersectionObserverEntry>();
  const [element, setElement] = useState<Element | null>(null);

  useEffect(() => {
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setEntry(entry),
      options
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element, options.root, options.rootMargin, options.threshold]);

  const ref = useCallback((el: Element | null) => {
    setElement(el);
  }, []);

  return [ref, entry];
}

/**
 * Virtual list hook for rendering large lists efficiently
 */
interface VirtualListOptions {
  itemHeight: number;
  overscan?: number;
  getItemHeight?: (index: number) => number;
}

export function useVirtualList<T>(
  items: T[],
  containerHeight: number,
  options: VirtualListOptions
) {
  const { itemHeight, overscan = 3, getItemHeight } = options;
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const { visibleRange, startOffset, endOffset, totalHeight } = 
    useMemo(() => {
      let accumulatedHeight = 0;
      let startIndex = 0;
      let endIndex = items.length - 1;
      let startOffset = 0;

      // Find start index
      for (let i = 0; i < items.length; i++) {
        const height = getItemHeight ? getItemHeight(i) : itemHeight;
        if (accumulatedHeight + height > scrollTop) {
          startIndex = Math.max(0, i - overscan);
          startOffset = accumulatedHeight;
          break;
        }
        accumulatedHeight += height;
      }

      // Find end index
      accumulatedHeight = startOffset;
      for (let i = startIndex; i < items.length; i++) {
        if (accumulatedHeight > scrollTop + containerHeight) {
          endIndex = Math.min(items.length - 1, i + overscan);
          break;
        }
        const height = getItemHeight ? getItemHeight(i) : itemHeight;
        accumulatedHeight += height;
      }

      // Calculate total height
      const totalHeight = getItemHeight
        ? items.reduce((sum, _, i) => sum + getItemHeight(i), 0)
        : items.length * itemHeight;

      return {
        visibleRange: [startIndex, endIndex] as const,
        startOffset,
        endOffset: totalHeight - accumulatedHeight,
        totalHeight,
      };
    }, [items.length, scrollTop, containerHeight, itemHeight, overscan, getItemHeight]);

  return {
    visibleRange,
    startOffset,
    endOffset,
    totalHeight,
    handleScroll,
  };
}

/**
 * Request idle callback hook for deferring non-critical work
 */
export function useIdleCallback(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions
) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!('requestIdleCallback' in window)) {
      // Fallback for browsers that don't support requestIdleCallback
      const id = setTimeout(() => {
        callbackRef.current({
          didTimeout: false,
          timeRemaining: () => 50,
        } as IdleDeadline);
      }, 1);

      return () => clearTimeout(id);
    }

    const id = requestIdleCallback(
      (deadline) => callbackRef.current(deadline),
      options
    );

    return () => cancelIdleCallback(id);
  }, [options?.timeout]);
}

/**
 * Batch updates for better performance
 */
export function batchUpdates<T>(
  updates: Array<() => void>,
  options: { batchSize?: number; delay?: number } = {}
) {
  const { batchSize = 10, delay = 0 } = options;

  const processBatch = (batch: Array<() => void>) => {
    requestAnimationFrame(() => {
      batch.forEach(update => update());
    });
  };

  const batches: Array<Array<() => void>> = [];
  for (let i = 0; i < updates.length; i += batchSize) {
    batches.push(updates.slice(i, i + batchSize));
  }

  batches.forEach((batch, index) => {
    if (delay > 0) {
      setTimeout(() => processBatch(batch), index * delay);
    } else {
      processBatch(batch);
    }
  });
}

/**
 * Memory-efficient string builder for large text operations
 */
export class StringBuilder {
  private chunks: string[] = [];
  private length = 0;

  append(str: string): this {
    this.chunks.push(str);
    this.length += str.length;
    return this;
  }

  toString(): string {
    return this.chunks.join('');
  }

  clear(): void {
    this.chunks = [];
    this.length = 0;
  }

  getLength(): number {
    return this.length;
  }
}

/**
 * LRU Cache implementation for memoization
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    
    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Create a memoized function with LRU cache
 */
export function memoizeWithLRU<T extends (...args: any[]) => any>(
  fn: T,
  cacheSize = 100,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new LRUCache<string, ReturnType<T>>(cacheSize);
  
  const defaultKeyGenerator = (...args: Parameters<T>) => 
    JSON.stringify(args);

  const generateKey = keyGenerator || defaultKeyGenerator;

  return ((...args: Parameters<T>) => {
    const key = generateKey(...args);
    const cached = cache.get(key);
    
    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Performance monitoring decorator
 */
export function measurePerformance(name: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = performance.now() - start;
        console.log(`${name}.${propertyKey} took ${duration.toFixed(2)}ms`);
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        console.error(`${name}.${propertyKey} failed after ${duration.toFixed(2)}ms`);
        throw error;
      }
    };

    return descriptor;
  };
}