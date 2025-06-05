// ABOUTME: Network status indicator component showing connection state and quality
// ABOUTME: Provides visual feedback for online/offline status with connection quality indicators

"use client";

import { useState, useEffect } from "react";
import { useNetworkStatus } from "@/observability/offline-detection";
import { Badge } from "@/ui/badge";

interface NetworkStatusProps {
  showQuality?: boolean;
  showOfflineMessage?: boolean;
  className?: string;
}

/**
 * Network status indicator component
 */
export function NetworkStatusIndicator({ 
  showQuality = false, 
  showOfflineMessage = true,
  className = "" 
}: NetworkStatusProps) {
  const networkStatus = useNetworkStatus();

  if (networkStatus.status === 'online' && networkStatus.connectionQuality === 'excellent') {
    // Don't show anything when everything is perfect
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Connection Status Badge */}
      <Badge 
        variant={
          networkStatus.status === 'offline' ? 'destructive' :
          networkStatus.connectionQuality === 'poor' ? 'destructive' :
          networkStatus.connectionQuality === 'good' ? 'default' : 'secondary'
        }
        className="text-xs"
      >
        <div className="flex items-center gap-1">
          {/* Connection indicator dot */}
          <div 
            className={`w-2 h-2 rounded-full ${
              networkStatus.status === 'offline' ? 'bg-red-400' :
              networkStatus.connectionQuality === 'poor' ? 'bg-orange-400' :
              networkStatus.connectionQuality === 'good' ? 'bg-yellow-400' :
              'bg-green-400'
            }`}
          />
          
          {/* Status text */}
          {networkStatus.status === 'offline' && 'Offline'}
          {networkStatus.status === 'online' && networkStatus.connectionQuality === 'poor' && 'Slow connection'}
          {networkStatus.status === 'online' && networkStatus.connectionQuality === 'good' && 'Good connection'}
          {networkStatus.status === 'slow' && 'Limited connectivity'}
        </div>
      </Badge>

      {/* Offline capabilities indicator */}
      {networkStatus.status === 'offline' && networkStatus.capabilities.offlineFallbacksEnabled && (
        <Badge variant="outline" className="text-xs">
          Offline mode
        </Badge>
      )}
    </div>
  );
}

/**
 * Detailed network status component for settings/debugging
 */
export function DetailedNetworkStatus() {
  const networkStatus = useNetworkStatus();
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  useEffect(() => {
    setLastUpdated(Date.now());
  }, [networkStatus]);

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Network Status</h3>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Status:</span>
          <div className="flex items-center gap-2 mt-1">
            <div 
              className={`w-3 h-3 rounded-full ${
                networkStatus.status === 'offline' ? 'bg-red-500' :
                networkStatus.status === 'slow' ? 'bg-orange-500' :
                'bg-green-500'
              }`}
            />
            <span className="font-medium capitalize">{networkStatus.status}</span>
          </div>
        </div>

        <div>
          <span className="text-gray-600">Quality:</span>
          <div className="mt-1">
            <span className="font-medium capitalize">{networkStatus.connectionQuality}</span>
          </div>
        </div>

        {networkStatus.effectiveType && (
          <div>
            <span className="text-gray-600">Type:</span>
            <div className="mt-1">
              <span className="font-medium">{networkStatus.effectiveType}</span>
            </div>
          </div>
        )}

        {networkStatus.downlink && (
          <div>
            <span className="text-gray-600">Speed:</span>
            <div className="mt-1">
              <span className="font-medium">{networkStatus.downlink} Mbps</span>
            </div>
          </div>
        )}

        {networkStatus.rtt && (
          <div>
            <span className="text-gray-600">Latency:</span>
            <div className="mt-1">
              <span className="font-medium">{networkStatus.rtt}ms</span>
            </div>
          </div>
        )}

        <div>
          <span className="text-gray-600">Last Updated:</span>
          <div className="mt-1">
            <span className="font-medium text-xs">
              {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* Offline Capabilities */}
      <div className="pt-3 border-t border-gray-200">
        <span className="text-gray-600 text-sm">Offline Capabilities:</span>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${networkStatus.capabilities.localStorageAvailable ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span>Local Storage</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${networkStatus.capabilities.indexedDBAvailable ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span>IndexedDB</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${networkStatus.capabilities.cacheAvailable ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span>Cache API</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${networkStatus.capabilities.serviceWorkerActive ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span>Service Worker</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Offline message banner
 */
export function OfflineBanner() {
  const networkStatus = useNetworkStatus();

  if (networkStatus.status !== 'offline') {
    return null;
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <div className="text-sm">
          <span className="font-medium text-red-800">You're offline</span>
          <span className="text-red-600 ml-2">
            Some features may be limited until your connection is restored.
          </span>
        </div>
      </div>
      
      {networkStatus.capabilities.offlineFallbacksEnabled && (
        <div className="mt-2 text-xs text-red-600">
          Offline mode is enabled. You can still view cached content.
        </div>
      )}
    </div>
  );
}