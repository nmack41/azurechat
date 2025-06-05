// ABOUTME: Azure Application Insights integration for comprehensive telemetry
// ABOUTME: Provides automatic performance monitoring, error tracking, and custom event tracking

import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { logger } from './logger';

interface AppInsightsConfig {
  connectionString?: string;
  enableAutoCollection: boolean;
  enableCorsCorrelation: boolean;
  disableFetchTracking: boolean;
  enableRequestHeaderTracking: boolean;
  enableResponseHeaderTracking: boolean;
}

const DEFAULT_CONFIG: AppInsightsConfig = {
  enableAutoCollection: true,
  enableCorsCorrelation: true,
  disableFetchTracking: false,
  enableRequestHeaderTracking: true,
  enableResponseHeaderTracking: true,
};

/**
 * Azure Application Insights telemetry service
 */
class AppInsightsService {
  private appInsights: ApplicationInsights | null = null;
  private isInitialized = false;
  private config: AppInsightsConfig;

  constructor(config: Partial<AppInsightsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize Application Insights
   */
  public initialize(): boolean {
    if (this.isInitialized) {
      return true;
    }

    const connectionString = 
      this.config.connectionString || 
      process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING ||
      process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    if (!connectionString) {
      logger.warn('Application Insights connection string not configured');
      return false;
    }

    try {
      this.appInsights = new ApplicationInsights({
        config: {
          connectionString,
          enableAutoRouteTracking: this.config.enableAutoCollection,
          enableCorsCorrelation: this.config.enableCorsCorrelation,
          disableFetchTracking: this.config.disableFetchTracking,
          enableRequestHeaderTracking: this.config.enableRequestHeaderTracking,
          enableResponseHeaderTracking: this.config.enableResponseHeaderTracking,
          samplingPercentage: 100,
          enableAutoExceptionCollection: true,
          enableUnhandledPromiseRejectionTracking: true,
          enablePerfMgr: true,
          perfEvtsSendAll: true,
        }
      });

      this.appInsights.loadAppInsights();
      this.isInitialized = true;

      // Track initialization
      this.trackEvent('AppInsights.Initialized', {
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || 'unknown',
      });

      logger.info('Azure Application Insights initialized successfully');
      return true;

    } catch (error) {
      logger.error('Failed to initialize Application Insights', { error });
      return false;
    }
  }

  /**
   * Track custom events
   */
  public trackEvent(name: string, properties?: Record<string, any>, measurements?: Record<string, number>): void {
    if (!this.appInsights) {
      return;
    }

    try {
      this.appInsights.trackEvent({
        name,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          userId: this.getUserId(),
          sessionId: this.getSessionId(),
        },
        measurements,
      });
    } catch (error) {
      logger.error('Failed to track event', { error, eventName: name });
    }
  }

  /**
   * Track exceptions
   */
  public trackException(error: Error, properties?: Record<string, any>): void {
    if (!this.appInsights) {
      return;
    }

    try {
      this.appInsights.trackException({
        exception: error,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          userId: this.getUserId(),
          sessionId: this.getSessionId(),
        },
      });
    } catch (trackingError) {
      logger.error('Failed to track exception', { trackingError, originalError: error.message });
    }
  }

  /**
   * Track page views
   */
  public trackPageView(name?: string, uri?: string, properties?: Record<string, any>): void {
    if (!this.appInsights) {
      return;
    }

    try {
      this.appInsights.trackPageView({
        name,
        uri,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          userId: this.getUserId(),
          sessionId: this.getSessionId(),
        },
      });
    } catch (error) {
      logger.error('Failed to track page view', { error, pageName: name });
    }
  }

  /**
   * Track custom metrics
   */
  public trackMetric(name: string, average: number, properties?: Record<string, any>): void {
    if (!this.appInsights) {
      return;
    }

    try {
      this.appInsights.trackMetric({
        name,
        average,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          userId: this.getUserId(),
          sessionId: this.getSessionId(),
        },
      });
    } catch (error) {
      logger.error('Failed to track metric', { error, metricName: name });
    }
  }

  /**
   * Track dependencies (external calls)
   */
  public trackDependency(
    name: string,
    commandName: string,
    startTime: Date,
    duration: number,
    success: boolean,
    properties?: Record<string, any>
  ): void {
    if (!this.appInsights) {
      return;
    }

    try {
      this.appInsights.trackDependencyData({
        name,
        data: commandName,
        duration,
        success,
        startTime,
        properties: {
          ...properties,
          userId: this.getUserId(),
          sessionId: this.getSessionId(),
        },
      });
    } catch (error) {
      logger.error('Failed to track dependency', { error, dependencyName: name });
    }
  }

  /**
   * Track traces (logs)
   */
  public trackTrace(message: string, severityLevel?: number, properties?: Record<string, any>): void {
    if (!this.appInsights) {
      return;
    }

    try {
      this.appInsights.trackTrace({
        message,
        severityLevel,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          userId: this.getUserId(),
          sessionId: this.getSessionId(),
        },
      });
    } catch (error) {
      logger.error('Failed to track trace', { error, message });
    }
  }

  /**
   * Set authenticated user context
   */
  public setAuthenticatedUserContext(userId: string, accountId?: string): void {
    if (!this.appInsights) {
      return;
    }

    try {
      this.appInsights.setAuthenticatedUserContext(userId, accountId);
    } catch (error) {
      logger.error('Failed to set authenticated user context', { error, userId });
    }
  }

  /**
   * Clear authenticated user context
   */
  public clearAuthenticatedUserContext(): void {
    if (!this.appInsights) {
      return;
    }

    try {
      this.appInsights.clearAuthenticatedUserContext();
    } catch (error) {
      logger.error('Failed to clear authenticated user context', { error });
    }
  }

  /**
   * Flush pending telemetry
   */
  public flush(): void {
    if (!this.appInsights) {
      return;
    }

    try {
      this.appInsights.flush();
    } catch (error) {
      logger.error('Failed to flush telemetry', { error });
    }
  }

  /**
   * Get current user ID (sanitized)
   */
  private getUserId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    
    try {
      // Get user ID from session storage or generate anonymous ID
      let userId = sessionStorage.getItem('userId');
      if (!userId) {
        userId = `anon_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('userId', userId);
      }
      return userId;
    } catch {
      return undefined;
    }
  }

  /**
   * Get current session ID
   */
  private getSessionId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    
    try {
      let sessionId = sessionStorage.getItem('sessionId');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('sessionId', sessionId);
      }
      return sessionId;
    } catch {
      return undefined;
    }
  }

  /**
   * Check if Application Insights is initialized
   */
  public isReady(): boolean {
    return this.isInitialized && this.appInsights !== null;
  }

  /**
   * Get telemetry configuration
   */
  public getConfig(): AppInsightsConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const appInsights = new AppInsightsService();

// Initialize on import (client-side only)
if (typeof window !== 'undefined') {
  appInsights.initialize();
}

// Export types
export type { AppInsightsConfig };