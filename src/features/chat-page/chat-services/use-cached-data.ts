// ABOUTME: React hooks for using cached chat data with automatic updates
// ABOUTME: Provides SWR-like functionality for server actions with built-in caching

import { useEffect, useState, useCallback, useRef } from 'react';
import { ServerActionResponse } from '@/utils/server-action-response';
import { cacheManager } from '@/features/common/cache/cache-manager';

interface UseCachedDataOptions {
  refreshInterval?: number; // Auto refresh interval in ms
  refreshOnFocus?: boolean; // Refresh when window gains focus
  refreshOnReconnect?: boolean; // Refresh when network reconnects
  dedupingInterval?: number; // Deduplication interval in ms
}

interface UseCachedDataReturn<T> {
  data: T | null;
  error: any | null;
  isLoading: boolean;
  isValidating: boolean;
  mutate: (data?: T) => void;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching and caching data with automatic revalidation
 */
export function useCachedData<T>(
  cacheNamespace: string,
  cacheKey: string,
  fetcher: () => Promise<ServerActionResponse<T>>,
  options: UseCachedDataOptions = {}
): UseCachedDataReturn<T> {
  const {
    refreshInterval,
    refreshOnFocus = true,
    refreshOnReconnect = true,
    dedupingInterval = 2000,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  
  const lastFetchTime = useRef<number>(0);
  const fetchInProgress = useRef<boolean>(false);
  
  // Fetch data with deduplication
  const fetchData = useCallback(async (isRevalidation = false) => {
    const now = Date.now();
    
    // Deduplicate requests
    if (fetchInProgress.current || (now - lastFetchTime.current < dedupingInterval)) {
      return;
    }
    
    fetchInProgress.current = true;
    
    if (isRevalidation) {
      setIsValidating(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      // Check cache first
      const cached = cacheManager.get<ServerActionResponse<T>>(cacheNamespace, cacheKey);
      
      if (cached && cached.status === 'OK' && !isRevalidation) {
        setData(cached.response);
        setError(null);
        setIsLoading(false);
        
        // Still fetch in background for fresh data
        fetcher().then(result => {
          if (result.status === 'OK') {
            setData(result.response);
            cacheManager.set(cacheNamespace, cacheKey, result);
          }
        });
      } else {
        // Fetch from server
        const result = await fetcher();
        lastFetchTime.current = now;
        
        if (result.status === 'OK') {
          setData(result.response);
          setError(null);
          cacheManager.set(cacheNamespace, cacheKey, result);
        } else {
          setError(result.errors);
          setData(null);
        }
      }
    } catch (err) {
      setError(err);
      setData(null);
    } finally {
      setIsLoading(false);
      setIsValidating(false);
      fetchInProgress.current = false;
    }
  }, [cacheNamespace, cacheKey, fetcher, dedupingInterval]);
  
  // Manual refresh function
  const refresh = useCallback(async () => {
    cacheManager.invalidate(cacheNamespace, cacheKey);
    await fetchData(true);
  }, [cacheNamespace, cacheKey, fetchData]);
  
  // Mutate local data and cache
  const mutate = useCallback((newData?: T) => {
    if (newData !== undefined) {
      setData(newData);
      const response: ServerActionResponse<T> = {
        status: 'OK',
        response: newData,
      };
      cacheManager.set(cacheNamespace, cacheKey, response);
    } else {
      // Revalidate if no data provided
      refresh();
    }
  }, [cacheNamespace, cacheKey, refresh]);
  
  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Set up refresh interval
  useEffect(() => {
    if (!refreshInterval) return;
    
    const interval = setInterval(() => {
      fetchData(true);
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval, fetchData]);
  
  // Refresh on focus
  useEffect(() => {
    if (!refreshOnFocus) return;
    
    const handleFocus = () => {
      if (Date.now() - lastFetchTime.current > dedupingInterval) {
        fetchData(true);
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshOnFocus, fetchData, dedupingInterval]);
  
  // Refresh on reconnect
  useEffect(() => {
    if (!refreshOnReconnect) return;
    
    const handleOnline = () => {
      fetchData(true);
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refreshOnReconnect, fetchData]);
  
  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    refresh,
  };
}

/**
 * Hook for chat threads with caching
 */
export function useChatThreads(
  fetcher: () => Promise<ServerActionResponse<any>>,
  userId: string,
  options?: UseCachedDataOptions
) {
  return useCachedData(
    'chatThreads',
    `threads:${userId}`,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      ...options,
    }
  );
}

/**
 * Hook for chat messages with caching
 */
export function useChatMessages(
  fetcher: () => Promise<ServerActionResponse<any>>,
  threadId: string,
  options?: UseCachedDataOptions
) {
  return useCachedData(
    'chatMessages',
    `messages:${threadId}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds for active chats
      ...options,
    }
  );
}

/**
 * Hook to get cache statistics
 */
export function useCacheStats(namespace?: string) {
  const [stats, setStats] = useState(cacheManager.getStats(namespace));
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(cacheManager.getStats(namespace));
    }, 5000);
    
    return () => clearInterval(interval);
  }, [namespace]);
  
  return stats;
}