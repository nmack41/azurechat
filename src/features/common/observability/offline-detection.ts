// ABOUTME: Offline mode detection and network status monitoring
// ABOUTME: Provides real-time network status updates and offline capability management

"use client";

import { logger } from './logger';
import { appInsights } from './app-insights';

export type NetworkStatus = 'online' | 'offline' | 'slow' | 'unknown';

export interface NetworkInfo {
  status: NetworkStatus;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  lastChanged: number;
  isOnline: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
}

export interface OfflineCapability {
  cacheAvailable: boolean;
  serviceWorkerActive: boolean;
  localStorageAvailable: boolean;
  indexedDBAvailable: boolean;
  offlineFallbacksEnabled: boolean;
}

type NetworkStatusCallback = (networkInfo: NetworkInfo) => void;

/**
 * Network status monitoring and offline detection service
 */
export class OfflineDetectionService {
  private callbacks: Set<NetworkStatusCallback> = new Set();
  private currentStatus: NetworkInfo;
  private checkInterval?: NodeJS.Timeout;
  private isInitialized = false;
  private offlineCapabilities: OfflineCapability;

  constructor() {
    this.currentStatus = {
      status: 'unknown',
      lastChanged: Date.now(),
      isOnline: true,
      connectionQuality: 'excellent',
    };

    this.offlineCapabilities = {
      cacheAvailable: false,
      serviceWorkerActive: false,
      localStorageAvailable: false,
      indexedDBAvailable: false,
      offlineFallbacksEnabled: false,
    };
  }

  /**
   * Initialize offline detection
   */
  public initialize(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    try {
      // Check initial online status
      this.updateNetworkStatus();

      // Set up event listeners
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));

      // Monitor connection quality
      this.startConnectionMonitoring();

      // Check offline capabilities
      this.checkOfflineCapabilities();

      this.isInitialized = true;

      logger.info('Offline detection service initialized', {
        initialStatus: this.currentStatus.status,
        capabilities: this.offlineCapabilities,
      });

    } catch (error) {
      logger.error('Failed to initialize offline detection', { error });
    }
  }

  /**
   * Add network status change callback
   */
  public onStatusChange(callback: NetworkStatusCallback): () => void {
    this.callbacks.add(callback);
    
    // Call immediately with current status
    callback(this.getCurrentStatus());

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Get current network status
   */
  public getCurrentStatus(): NetworkInfo {
    return { ...this.currentStatus };
  }

  /**
   * Get offline capabilities
   */
  public getOfflineCapabilities(): OfflineCapability {
    return { ...this.offlineCapabilities };
  }

  /**
   * Check if device is online
   */
  public isOnline(): boolean {
    return this.currentStatus.isOnline;
  }

  /**
   * Check if device is offline
   */
  public isOffline(): boolean {
    return !this.currentStatus.isOnline;
  }

  /**
   * Get connection quality
   */
  public getConnectionQuality(): 'excellent' | 'good' | 'poor' | 'offline' {
    return this.currentStatus.connectionQuality;
  }

  /**
   * Perform network connectivity test
   */
  public async testConnectivity(): Promise<{
    isConnected: boolean;
    latency: number;
    error?: string;
  }> {
    if (typeof window === 'undefined') {
      return { isConnected: false, latency: 0, error: 'Server-side environment' };
    }

    const startTime = performance.now();

    try {
      // Test connectivity to our own health endpoint
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const latency = performance.now() - startTime;
      const isConnected = response.ok;

      if (isConnected) {
        this.updateConnectionQuality(latency);
      }

      return {
        isConnected,
        latency,
      };

    } catch (error) {
      const latency = performance.now() - startTime;
      
      return {
        isConnected: false,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enable offline fallback mode
   */
  public enableOfflineFallbacks(): void {
    this.offlineCapabilities.offlineFallbacksEnabled = true;
    
    // Store offline mode preference
    try {
      localStorage.setItem('offlineFallbacksEnabled', 'true');
    } catch (error) {
      logger.warn('Failed to store offline fallback preference', { error });
    }

    logger.info('Offline fallbacks enabled');
  }

  /**
   * Disable offline fallback mode
   */
  public disableOfflineFallbacks(): void {
    this.offlineCapabilities.offlineFallbacksEnabled = false;
    
    try {
      localStorage.removeItem('offlineFallbacksEnabled');
    } catch (error) {
      logger.warn('Failed to remove offline fallback preference', { error });
    }

    logger.info('Offline fallbacks disabled');
  }

  /**
   * Get cached data for offline use
   */
  public async getCachedData(key: string): Promise<any> {
    if (!this.offlineCapabilities.localStorageAvailable) {
      return null;
    }

    try {
      const cached = localStorage.getItem(`offline_cache_${key}`);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.expiry && Date.now() > data.expiry) {
          localStorage.removeItem(`offline_cache_${key}`);
          return null;
        }
        return data.value;
      }
    } catch (error) {
      logger.warn('Failed to retrieve cached data', { error, key });
    }

    return null;
  }

  /**
   * Store data for offline use
   */
  public async storeCachedData(key: string, data: any, ttlMs = 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.offlineCapabilities.localStorageAvailable) {
      return;
    }

    try {
      const cacheEntry = {
        value: data,
        expiry: Date.now() + ttlMs,
        cached: Date.now(),
      };

      localStorage.setItem(`offline_cache_${key}`, JSON.stringify(cacheEntry));
    } catch (error) {
      logger.warn('Failed to store cached data', { error, key });
    }
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    this.updateNetworkStatus();
    
    // Test connectivity when coming back online
    this.testConnectivity().then(result => {
      logger.info('Connection restored', {
        latency: result.latency,
        quality: this.currentStatus.connectionQuality,
      });

      // Track reconnection
      if (appInsights.isReady()) {
        appInsights.trackEvent('NetworkReconnected', {
          latency: result.latency,
          quality: this.currentStatus.connectionQuality,
        });
      }
    });
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.updateNetworkStatus();
    
    logger.warn('Connection lost - entering offline mode', {
      capabilities: this.offlineCapabilities,
    });

    // Track disconnection
    if (appInsights.isReady()) {
      appInsights.trackEvent('NetworkDisconnected', {
        capabilities: this.offlineCapabilities,
      });
    }
  }

  /**
   * Update network status
   */
  private updateNetworkStatus(): void {
    if (typeof window === 'undefined') return;

    const wasOnline = this.currentStatus.isOnline;
    const isOnline = navigator.onLine;
    
    // Get connection info if available
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    let status: NetworkStatus = 'unknown';
    let connectionQuality: 'excellent' | 'good' | 'poor' | 'offline' = 'excellent';

    if (!isOnline) {
      status = 'offline';
      connectionQuality = 'offline';
    } else if (connection) {
      const effectiveType = connection.effectiveType;
      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        status = 'slow';
        connectionQuality = 'poor';
      } else if (effectiveType === '3g') {
        status = 'online';
        connectionQuality = 'good';
      } else {
        status = 'online';
        connectionQuality = 'excellent';
      }
    } else {
      status = isOnline ? 'online' : 'offline';
      connectionQuality = isOnline ? 'excellent' : 'offline';
    }

    this.currentStatus = {
      status,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData,
      lastChanged: Date.now(),
      isOnline,
      connectionQuality,
    };

    // Notify callbacks if status changed
    if (wasOnline !== isOnline) {
      this.notifyCallbacks();
    }
  }

  /**
   * Start connection quality monitoring
   */
  private startConnectionMonitoring(): void {
    // Test connection every 30 seconds
    this.checkInterval = setInterval(() => {
      if (this.currentStatus.isOnline) {
        this.testConnectivity();
      }
    }, 30000);

    // Listen for connection changes
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', () => {
        this.updateNetworkStatus();
        this.notifyCallbacks();
      });
    }
  }

  /**
   * Update connection quality based on latency
   */
  private updateConnectionQuality(latency: number): void {
    let quality: 'excellent' | 'good' | 'poor' | 'offline';

    if (latency < 100) {
      quality = 'excellent';
    } else if (latency < 300) {
      quality = 'good';
    } else {
      quality = 'poor';
    }

    this.currentStatus.connectionQuality = quality;
  }

  /**
   * Check offline capabilities
   */
  private checkOfflineCapabilities(): void {
    // Check localStorage
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      this.offlineCapabilities.localStorageAvailable = true;
    } catch {
      this.offlineCapabilities.localStorageAvailable = false;
    }

    // Check IndexedDB
    this.offlineCapabilities.indexedDBAvailable = 'indexedDB' in window;

    // Check Service Worker
    this.offlineCapabilities.serviceWorkerActive = 
      'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;

    // Check Cache API
    this.offlineCapabilities.cacheAvailable = 'caches' in window;

    // Check offline fallback preference
    try {
      this.offlineCapabilities.offlineFallbacksEnabled = 
        localStorage.getItem('offlineFallbacksEnabled') === 'true';
    } catch {
      this.offlineCapabilities.offlineFallbacksEnabled = false;
    }
  }

  /**
   * Notify all callbacks
   */
  private notifyCallbacks(): void {
    this.callbacks.forEach(callback => {
      try {
        callback(this.getCurrentStatus());
      } catch (error) {
        logger.error('Error in network status callback', { error });
      }
    });
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this));
      window.removeEventListener('offline', this.handleOffline.bind(this));
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.callbacks.clear();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const offlineDetection = new OfflineDetectionService();

// Initialize on import (client-side only)
if (typeof window !== 'undefined') {
  offlineDetection.initialize();
}

// React hook for network status
export function useNetworkStatus() {
  if (typeof window === 'undefined') {
    return {
      status: 'unknown' as NetworkStatus,
      isOnline: true,
      connectionQuality: 'excellent' as const,
      capabilities: {
        cacheAvailable: false,
        serviceWorkerActive: false,
        localStorageAvailable: false,
        indexedDBAvailable: false,
        offlineFallbacksEnabled: false,
      }
    };
  }

  const { useState, useEffect } = require('react');
  
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>(
    offlineDetection.getCurrentStatus()
  );

  useEffect(() => {
    const unsubscribe = offlineDetection.onStatusChange(setNetworkInfo);
    return unsubscribe;
  }, []);

  return {
    ...networkInfo,
    capabilities: offlineDetection.getOfflineCapabilities(),
  };
}