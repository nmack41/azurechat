// ABOUTME: Client-side observability provider for initializing monitoring services
// ABOUTME: Initializes AppInsights, offline detection, and performance monitoring on app startup

"use client";

import { useEffect } from 'react';
import { appInsights } from './app-insights';
import { offlineDetection } from './offline-detection';
import { performanceMonitor } from './performance-monitor';
import { securityAudit } from './security-audit';
import { logger } from './logger';

interface ObservabilityProviderProps {
  children: React.ReactNode;
  userId?: string;
  enableDevelopmentMode?: boolean;
}

/**
 * Provider component that initializes all observability services
 */
export function ObservabilityProvider({ 
  children, 
  userId,
  enableDevelopmentMode = process.env.NODE_ENV === 'development' 
}: ObservabilityProviderProps) {
  useEffect(() => {
    // Initialize Application Insights
    const appInsightsInitialized = appInsights.initialize();
    
    if (appInsightsInitialized && userId) {
      appInsights.setAuthenticatedUserContext(userId);
    }

    // Initialize offline detection
    offlineDetection.initialize();

    // Log initialization
    logger.info('Observability services initialized', {
      appInsights: appInsightsInitialized,
      offlineDetection: true,
      performanceMonitor: true,
      securityAudit: true,
      userId: userId || 'anonymous',
      developmentMode: enableDevelopmentMode,
    });

    // Track application start
    if (appInsightsInitialized) {
      appInsights.trackEvent('ApplicationStart', {
        userId: userId || 'anonymous',
        timestamp: new Date().toISOString(),
        developmentMode: enableDevelopmentMode,
      });
    }

    // Set up global error handlers
    const handleUnhandledError = (event: ErrorEvent) => {
      logger.error('Unhandled JavaScript error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });

      if (appInsights.isReady()) {
        appInsights.trackException(new Error(event.message), {
          source: 'unhandled_error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      }

      // Record security event for unhandled errors
      securityAudit.recordSecurityEvent(
        'SECURITY_CONFIG_CHANGE',
        'MEDIUM',
        'client_application',
        'unhandled_error',
        {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        }
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      
      logger.error('Unhandled promise rejection', {
        reason: event.reason,
        stack: error.stack,
      });

      if (appInsights.isReady()) {
        appInsights.trackException(error, {
          source: 'unhandled_promise_rejection',
        });
      }

      // Record security event for unhandled promise rejections
      securityAudit.recordSecurityEvent(
        'SECURITY_CONFIG_CHANGE',
        'MEDIUM',
        'client_application',
        'unhandled_promise_rejection',
        {
          reason: String(event.reason),
          errorMessage: error.message,
        }
      );
    };

    // Set up performance observation
    const observePerformance = () => {
      // Track Core Web Vitals
      if ('web-vitals' in window || typeof window !== 'undefined') {
        // FCP - First Contentful Paint
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
              performanceMonitor.recordQuery({
                operation: 'core_web_vital_fcp',
                duration: entry.startTime,
                success: true,
                cached: false,
                tags: { metric: 'first-contentful-paint' },
              });
            }
          });
        });

        try {
          observer.observe({ entryTypes: ['paint'] });
        } catch (error) {
          // PerformanceObserver not supported
        }

        // Track navigation timing
        if (performance.getEntriesByType) {
          const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
          if (navEntries.length > 0) {
            const nav = navEntries[0];
            
            performanceMonitor.recordQuery({
              operation: 'page_load_time',
              duration: nav.loadEventEnd - nav.navigationStart,
              success: true,
              cached: false,
              tags: { 
                type: 'navigation',
                domContentLoaded: (nav.domContentLoadedEventEnd - nav.navigationStart).toString(),
                timeToFirstByte: (nav.responseStart - nav.navigationStart).toString(),
              },
            });
          }
        }
      }
    };

    // Add event listeners
    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Observe performance when DOM is ready
    if (document.readyState === 'complete') {
      observePerformance();
    } else {
      window.addEventListener('load', observePerformance);
    }

    // Cleanup function
    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('load', observePerformance);
      
      // Flush any pending telemetry
      if (appInsights.isReady()) {
        appInsights.flush();
      }
      
      // Destroy offline detection
      offlineDetection.destroy();
    };
  }, [userId, enableDevelopmentMode]);

  // Track page views on route changes
  useEffect(() => {
    if (appInsights.isReady()) {
      appInsights.trackPageView(
        document.title,
        window.location.href,
        {
          userId: userId || 'anonymous',
        }
      );
    }
  }, [userId]);

  return <>{children}</>;
}

/**
 * Hook to access observability services
 */
export function useObservability() {
  return {
    appInsights: appInsights.isReady() ? appInsights : null,
    offlineDetection,
    performanceMonitor,
    securityAudit,
    logger,
  };
}