// ABOUTME: Observability module exports for comprehensive application monitoring
// ABOUTME: Provides centralized access to correlation, health, logging, and error tracking

// Health monitoring
export { healthService } from './health-service';
export type { 
  HealthStatus, 
  HealthCheckResult, 
  SystemHealth, 
  HealthChecker 
} from './health-service';

// Correlation tracking and distributed tracing
export {
  generateCorrelationId,
  getCorrelationId,
  createRequestContext,
  addCorrelationHeaders,
  logRequest,
  withCorrelation,
  correlationMiddleware,
  fetchWithCorrelation,
  setupAxiosCorrelation,
  addCorrelationToWebSocketMessage,
  CORRELATION_ID_HEADER,
} from './correlation-middleware';

export type { 
  RequestContext, 
  WebSocketMessage 
} from './correlation-middleware';

// React correlation hooks and context
export {
  CorrelationProvider,
  useCorrelation,
  useCorrelationId,
  useCorrelatedFetch,
  useExtractCorrelationId,
  useErrorWithCorrelation,
  usePerformanceTracking,
  useCorrelatedLogging,
  usePersistedCorrelationId,
} from './use-correlation';

// Client-side monitoring and error tracking
export {
  initializeMonitoring,
  useClientMonitoring,
  MonitoringErrorBoundary,
  monitoringService,
} from './client-monitoring';

export type {
  MonitoringConfig,
  ErrorReport,
  PerformanceMetrics,
} from './client-monitoring';

// Monitoring provider and higher-order components
export {
  MonitoringProvider,
  MonitoringProviderWithDefaults,
  useMonitoring,
  withMonitoring,
  DefaultMonitoringErrorFallback,
  MonitoringConfigs,
} from './monitoring-provider';

// Structured logging
export { logger } from './logger';

/**
 * Complete observability setup for application
 */
export function setupObservability(config?: {
  enableHealthChecks?: boolean;
  enableCorrelationTracking?: boolean;
  enableClientMonitoring?: boolean;
  monitoringEndpoint?: string;
  userId?: string;
}) {
  const {
    enableHealthChecks = true,
    enableCorrelationTracking = true,
    enableClientMonitoring = true,
    monitoringEndpoint,
    userId,
  } = config || {};

  // Initialize health monitoring
  if (enableHealthChecks && typeof window === 'undefined') {
    // Server-side health checks are automatically initialized
    console.log('Health monitoring initialized on server');
  }

  // Initialize client monitoring
  if (enableClientMonitoring && typeof window !== 'undefined') {
    const monitoringConfig = {
      endpoint: monitoringEndpoint,
      enableErrorTracking: true,
      enablePerformanceMonitoring: true,
      enableNetworkMonitoring: true,
      enableUserInteractionTracking: false, // Privacy-conscious default
      sampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    };

    const service = initializeMonitoring(monitoringConfig);
    
    if (service && userId) {
      service.setUserId(userId);
    }

    console.log('Client monitoring initialized', {
      endpoint: monitoringEndpoint || 'none',
      userId: userId || 'anonymous',
    });
  }

  // Log correlation tracking status
  if (enableCorrelationTracking) {
    console.log('Correlation tracking enabled');
  }

  return {
    healthService,
    monitoringService,
  };
}

/**
 * Observability utilities
 */
export const ObservabilityUtils = {
  /**
   * Create a complete error context for debugging
   */
  createErrorContext: (error: Error, correlationId?: string) => ({
    correlationId: correlationId || generateCorrelationId(),
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : 'server',
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  }),

  /**
   * Create performance measurement context
   */
  createPerformanceContext: (operationName: string, correlationId?: string) => {
    const startTime = performance.now();
    return {
      correlationId: correlationId || generateCorrelationId(),
      operation: operationName,
      start: () => startTime,
      end: () => {
        const duration = performance.now() - startTime;
        const context = {
          correlationId: correlationId || generateCorrelationId(),
          operation: operationName,
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        };
        
        console.log('Performance measurement:', context);
        return context;
      },
    };
  },

  /**
   * Generate a unique session ID
   */
  generateSessionId: () => `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,

  /**
   * Check if we're in a browser environment
   */
  isBrowser: () => typeof window !== 'undefined',

  /**
   * Check if we're in development mode
   */
  isDevelopment: () => process.env.NODE_ENV === 'development',

  /**
   * Get current page performance metrics (browser only)
   */
  getCurrentPageMetrics: () => {
    if (typeof window === 'undefined') {
      return null;
    }

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const memory = (performance as any).memory;

    return {
      navigation: navigation ? {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart,
        timeToFirstByte: navigation.responseStart - navigation.navigationStart,
      } : null,
      memory: memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      } : null,
      timestamp: new Date().toISOString(),
    };
  },
};