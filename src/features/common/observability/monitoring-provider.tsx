// ABOUTME: Global monitoring provider for comprehensive application observability
// ABOUTME: Combines correlation tracking, error monitoring, and performance measurement

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { CorrelationProvider } from './use-correlation';
import { 
  initializeMonitoring, 
  MonitoringErrorBoundary,
  type MonitoringConfig 
} from './client-monitoring';

/**
 * Monitoring context interface
 */
interface MonitoringContextValue {
  isInitialized: boolean;
  config: MonitoringConfig;
  updateConfig: (newConfig: Partial<MonitoringConfig>) => void;
}

/**
 * Monitoring context
 */
const MonitoringContext = createContext<MonitoringContextValue | null>(null);

/**
 * Default monitoring configuration for production
 */
const PRODUCTION_CONFIG: Partial<MonitoringConfig> = {
  enableErrorTracking: true,
  enablePerformanceMonitoring: true,
  enableUserInteractionTracking: false, // Usually disabled for privacy
  enableNetworkMonitoring: true,
  sampleRate: 0.1, // 10% sampling in production
  maxErrors: 50,
  maxMetrics: 25,
};

/**
 * Default monitoring configuration for development
 */
const DEVELOPMENT_CONFIG: Partial<MonitoringConfig> = {
  enableErrorTracking: true,
  enablePerformanceMonitoring: true,
  enableUserInteractionTracking: true,
  enableNetworkMonitoring: true,
  sampleRate: 1.0, // 100% sampling in development
  maxErrors: 100,
  maxMetrics: 50,
};

/**
 * Monitoring provider props
 */
interface MonitoringProviderProps {
  children: React.ReactNode;
  config?: Partial<MonitoringConfig>;
  endpoint?: string;
  userId?: string;
  fallbackComponent?: React.ComponentType<{ error: Error; correlationId: string }>;
}

/**
 * Global monitoring provider
 */
export function MonitoringProvider({
  children,
  config: customConfig,
  endpoint,
  userId,
  fallbackComponent,
}: MonitoringProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [config, setConfig] = useState<MonitoringConfig>(() => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const baseConfig = isDevelopment ? DEVELOPMENT_CONFIG : PRODUCTION_CONFIG;
    
    return {
      ...baseConfig,
      ...customConfig,
      endpoint: endpoint || customConfig?.endpoint,
    } as MonitoringConfig;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return; // Skip on server-side
    }

    // Initialize monitoring service
    const service = initializeMonitoring(config);
    
    if (service && userId) {
      service.setUserId(userId);
    }

    setIsInitialized(true);

    // Log initialization
    console.log('Monitoring initialized', {
      config: {
        errorTracking: config.enableErrorTracking,
        performanceMonitoring: config.enablePerformanceMonitoring,
        userInteractionTracking: config.enableUserInteractionTracking,
        networkMonitoring: config.enableNetworkMonitoring,
        sampleRate: config.sampleRate,
      },
      endpoint: config.endpoint || 'none',
      userId: userId || 'anonymous',
    });
  }, [config, userId]);

  const updateConfig = (newConfig: Partial<MonitoringConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };

  const contextValue: MonitoringContextValue = {
    isInitialized,
    config,
    updateConfig,
  };

  return (
    <MonitoringContext.Provider value={contextValue}>
      <CorrelationProvider>
        <MonitoringErrorBoundary fallback={fallbackComponent}>
          {children}
        </MonitoringErrorBoundary>
      </CorrelationProvider>
    </MonitoringContext.Provider>
  );
}

/**
 * Hook to access monitoring context
 */
export function useMonitoring(): MonitoringContextValue {
  const context = useContext(MonitoringContext);
  
  if (!context) {
    throw new Error('useMonitoring must be used within a MonitoringProvider');
  }
  
  return context;
}

/**
 * High-order component for adding monitoring to any component
 */
export function withMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  config?: Partial<MonitoringConfig>
) {
  const WrappedComponent = (props: P) => (
    <MonitoringProvider config={config}>
      <Component {...props} />
    </MonitoringProvider>
  );

  WrappedComponent.displayName = `withMonitoring(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Custom error fallback for monitoring errors
 */
export const DefaultMonitoringErrorFallback: React.FC<{
  error: Error;
  correlationId: string;
}> = ({ error, correlationId }) => {
  const handleReload = () => {
    window.location.reload();
  };

  const handleReport = async () => {
    try {
      // Try to copy error details to clipboard
      const errorReport = {
        correlationId,
        error: error.message,
        stack: error.stack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      };

      await navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2));
      alert('Error report copied to clipboard');
    } catch (err) {
      console.error('Failed to copy error report:', err);
      alert('Failed to copy error report');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 18.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Something went wrong
            </h2>
            <p className="text-sm text-gray-500">
              We're sorry for the inconvenience
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-600 mb-1">Error Reference:</p>
          <code className="text-xs font-mono text-gray-800 break-all">
            {correlationId}
          </code>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleReload}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reload Page
          </button>
          
          <button
            onClick={handleReport}
            className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Copy Error Report
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
              🛠️ Developer Details
            </summary>
            <div className="mt-2 p-3 bg-red-50 rounded border text-xs">
              <div className="mb-2">
                <strong>Error:</strong>
                <pre className="text-red-700 mt-1 overflow-auto">
                  {error.message}
                </pre>
              </div>
              <div>
                <strong>Stack Trace:</strong>
                <pre className="text-red-700 mt-1 overflow-auto max-h-32">
                  {error.stack}
                </pre>
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

/**
 * Monitoring provider with default error fallback
 */
export function MonitoringProviderWithDefaults(props: MonitoringProviderProps) {
  return (
    <MonitoringProvider
      {...props}
      fallbackComponent={props.fallbackComponent || DefaultMonitoringErrorFallback}
    />
  );
}

/**
 * Environment-specific monitoring configurations
 */
export const MonitoringConfigs = {
  production: PRODUCTION_CONFIG,
  development: DEVELOPMENT_CONFIG,
  testing: {
    enableErrorTracking: false,
    enablePerformanceMonitoring: false,
    enableUserInteractionTracking: false,
    enableNetworkMonitoring: false,
    sampleRate: 0,
  } as Partial<MonitoringConfig>,
};