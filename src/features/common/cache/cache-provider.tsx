// ABOUTME: React context provider for cache management and monitoring
// ABOUTME: Provides cache statistics, invalidation controls, and performance monitoring

"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { cacheManager } from './cache-manager';
import { cosmosQueryCache } from '../services/cosmos-cache-enhanced';
import { cachedCosmosService } from '../services/cosmos-service-cached';

interface CacheContextValue {
  // Cache statistics
  clientCacheStats: Record<string, any>;
  cosmosCacheStats: any;
  
  // Cache control functions
  invalidateClientCache: (namespace?: string, key?: string) => void;
  invalidateCosmosCache: (pattern?: string) => void;
  clearAllCaches: () => void;
  
  // Preload functions
  preloadUserData: (userId: string) => Promise<boolean>;
  
  // Performance insights
  getCacheEfficiency: () => any;
}

const CacheContext = createContext<CacheContextValue | null>(null);

interface CacheProviderProps {
  children: ReactNode;
  enableMonitoring?: boolean;
  monitoringInterval?: number;
}

export const CacheProvider: React.FC<CacheProviderProps> = ({
  children,
  enableMonitoring = true,
  monitoringInterval = 30000, // 30 seconds
}) => {
  const [clientCacheStats, setClientCacheStats] = useState({});
  const [cosmosCacheStats, setCosmosCacheStats] = useState({});
  
  // Update cache statistics
  useEffect(() => {
    if (!enableMonitoring) return;
    
    const updateStats = () => {
      setClientCacheStats(cacheManager.getStats());
      setCosmosCacheStats(cachedCosmosService.getCacheStats());
    };
    
    // Initial update
    updateStats();
    
    // Set up interval
    const interval = setInterval(updateStats, monitoringInterval);
    
    return () => clearInterval(interval);
  }, [enableMonitoring, monitoringInterval]);
  
  // Cache control functions
  const invalidateClientCache = (namespace?: string, key?: string) => {
    if (namespace && key) {
      cacheManager.invalidate(namespace, key);
    } else if (namespace) {
      cacheManager.invalidateNamespace(namespace);
    } else {
      cacheManager.invalidateAll();
    }
  };
  
  const invalidateCosmosCache = (pattern?: string) => {
    if (pattern) {
      cosmosQueryCache.invalidateByPattern(new RegExp(pattern, 'i'));
    } else {
      cosmosQueryCache.clear();
    }
  };
  
  const clearAllCaches = () => {
    cacheManager.invalidateAll();
    cosmosQueryCache.clear();
  };
  
  const preloadUserData = async (userId: string) => {
    return cachedCosmosService.preloadUserData(userId);
  };
  
  const getCacheEfficiency = () => {
    return {
      client: cacheManager.getStats(),
      cosmos: cachedCosmosService.getCacheEfficiency(),
    };
  };
  
  const contextValue: CacheContextValue = {
    clientCacheStats,
    cosmosCacheStats,
    invalidateClientCache,
    invalidateCosmosCache,
    clearAllCaches,
    preloadUserData,
    getCacheEfficiency,
  };
  
  return (
    <CacheContext.Provider value={contextValue}>
      {children}
    </CacheContext.Provider>
  );
};

/**
 * Hook to use cache context
 */
export const useCache = (): CacheContextValue => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
};

/**
 * Hook for cache monitoring and debugging
 */
export const useCacheMonitor = () => {
  const { clientCacheStats, cosmosCacheStats, getCacheEfficiency } = useCache();
  
  return {
    stats: {
      client: clientCacheStats,
      cosmos: cosmosCacheStats,
    },
    efficiency: getCacheEfficiency(),
    
    // Helper functions for monitoring
    getMemoryUsage: () => {
      if (typeof window !== 'undefined' && (performance as any).memory) {
        const memory = (performance as any).memory;
        return {
          used: Math.round(memory.usedJSHeapSize / 1048576), // MB
          total: Math.round(memory.totalJSHeapSize / 1048576), // MB
          limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
        };
      }
      return null;
    },
    
    getTotalCacheSize: () => {
      let totalSize = 0;
      Object.values(clientCacheStats).forEach((stat: any) => {
        if (stat.size) totalSize += stat.size;
      });
      if (cosmosCacheStats.cacheSize) totalSize += cosmosCacheStats.cacheSize;
      return totalSize;
    },
  };
};

/**
 * Development cache inspector component
 */
export const CacheInspector: React.FC<{ show?: boolean }> = ({ 
  show = process.env.NODE_ENV === 'development' 
}) => {
  const { stats, efficiency, getMemoryUsage, getTotalCacheSize } = useCacheMonitor();
  
  if (!show) return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-md z-50">
      <h3 className="font-bold mb-2">Cache Performance</h3>
      
      <div className="space-y-2">
        <div>
          <strong>Total Cache Entries:</strong> {getTotalCacheSize()}
        </div>
        
        {stats.cosmos.hitRate !== undefined && (
          <div>
            <strong>Cosmos Hit Rate:</strong> {(stats.cosmos.hitRate * 100).toFixed(1)}%
          </div>
        )}
        
        {efficiency.cosmos.averageRequestUnits && (
          <div>
            <strong>Avg RU/Query:</strong> {efficiency.cosmos.averageRequestUnits.toFixed(2)}
          </div>
        )}
        
        {getMemoryUsage() && (
          <div>
            <strong>Memory:</strong> {getMemoryUsage()!.used}MB / {getMemoryUsage()!.total}MB
          </div>
        )}
        
        {efficiency.cosmos.recommendations.length > 0 && (
          <div>
            <strong>Recommendations:</strong>
            <ul className="text-xs mt-1">
              {efficiency.cosmos.recommendations.map((rec, i) => (
                <li key={i}>• {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};