// ABOUTME: Client monitoring endpoint for receiving browser performance and error data
// ABOUTME: Processes client-side telemetry for real-time monitoring and analytics

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/features/common/observability/logger";
import { appInsights } from "@/features/common/observability/app-insights";
import { performanceMonitor } from "@/features/common/observability/performance-monitor";
import { securityAudit } from "@/features/common/observability/security-audit";

interface ClientMetric {
  type: 'performance' | 'error' | 'navigation' | 'interaction';
  timestamp: number;
  data: any;
  userId?: string;
  sessionId?: string;
  url: string;
  userAgent: string;
}

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  navigationType: string;
  connectionType?: string;
}

interface ErrorMetric {
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  errorType: 'javascript' | 'unhandled-promise' | 'resource' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface NavigationMetric {
  from: string;
  to: string;
  method: 'link' | 'pushstate' | 'reload' | 'back-forward';
  duration: number;
}

interface InteractionMetric {
  element: string;
  action: 'click' | 'input' | 'scroll' | 'resize' | 'focus';
  duration?: number;
  value?: string;
}

/**
 * Process client monitoring data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const metrics: ClientMetric[] = Array.isArray(body) ? body : [body];

    // Validate and process each metric
    const processedMetrics = [];
    const errors = [];

    for (const metric of metrics) {
      try {
        const processedMetric = await processClientMetric(metric, request);
        processedMetrics.push(processedMetric);
      } catch (error) {
        errors.push({
          metric,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log batch processing summary
    logger.info('Client monitoring batch processed', {
      totalMetrics: metrics.length,
      processedCount: processedMetrics.length,
      errorCount: errors.length,
      types: processedMetrics.reduce((acc, m) => {
        acc[m.type] = (acc[m.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    });

    return NextResponse.json({
      status: 'success',
      processed: processedMetrics.length,
      errors: errors.length,
      timestamp: Date.now(),
    });

  } catch (error) {
    logger.error('Failed to process client monitoring data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      headers: Object.fromEntries(request.headers.entries()),
    });

    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Failed to process monitoring data',
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}

/**
 * Process individual client metric
 */
async function processClientMetric(metric: ClientMetric, request: NextRequest): Promise<ClientMetric> {
  // Validate metric structure
  if (!metric.type || !metric.timestamp || !metric.data) {
    throw new Error('Invalid metric structure');
  }

  // Extract client information
  const clientInfo = {
    ipAddress: getClientIP(request),
    userAgent: metric.userAgent || request.headers.get('user-agent') || 'unknown',
    correlationId: request.headers.get('x-correlation-id'),
  };

  // Process based on metric type
  switch (metric.type) {
    case 'performance':
      await processPerformanceMetric(metric.data as PerformanceMetric, clientInfo, metric);
      break;
    
    case 'error':
      await processErrorMetric(metric.data as ErrorMetric, clientInfo, metric);
      break;
    
    case 'navigation':
      await processNavigationMetric(metric.data as NavigationMetric, clientInfo, metric);
      break;
    
    case 'interaction':
      await processInteractionMetric(metric.data as InteractionMetric, clientInfo, metric);
      break;
    
    default:
      logger.warn('Unknown metric type received', { type: metric.type });
  }

  return metric;
}

/**
 * Process performance metrics
 */
async function processPerformanceMetric(
  data: PerformanceMetric, 
  clientInfo: any, 
  metric: ClientMetric
): Promise<void> {
  // Record performance metric in our monitoring system
  const measurementId = performanceMonitor.recordQuery({
    operation: `client_performance_${data.name}`,
    duration: data.value,
    success: data.rating !== 'poor',
    cached: false,
    userId: metric.userId,
    tags: {
      rating: data.rating,
      navigationType: data.navigationType,
      connectionType: data.connectionType || 'unknown',
    }
  });

  // Log performance data
  logger.performance('Client performance metric', {
    measurementId,
    name: data.name,
    value: data.value,
    rating: data.rating,
    url: metric.url,
    userId: metric.userId,
    sessionId: metric.sessionId,
    navigationType: data.navigationType,
    connectionType: data.connectionType,
  });

  // Track in Application Insights
  if (appInsights.isReady()) {
    appInsights.trackMetric(`client.performance.${data.name}`, data.value, {
      rating: data.rating,
      navigationType: data.navigationType,
      connectionType: data.connectionType,
      url: metric.url,
      userId: metric.userId,
      sessionId: metric.sessionId,
    });
  }

  // Alert on poor performance
  if (data.rating === 'poor') {
    logger.warn('Poor client performance detected', {
      metric: data.name,
      value: data.value,
      url: metric.url,
      userId: metric.userId,
    });

    // Track performance issue
    if (appInsights.isReady()) {
      appInsights.trackEvent('PoorPerformance', {
        metric: data.name,
        value: data.value,
        rating: data.rating,
        url: metric.url,
        userId: metric.userId,
      });
    }
  }
}

/**
 * Process error metrics
 */
async function processErrorMetric(
  data: ErrorMetric, 
  clientInfo: any, 
  metric: ClientMetric
): Promise<void> {
  // Create error object for tracking
  const error = new Error(data.message);
  if (data.stack) {
    error.stack = data.stack;
  }

  // Log client-side error
  logger.error('Client-side error reported', {
    message: data.message,
    stack: data.stack,
    filename: data.filename,
    lineno: data.lineno,
    colno: data.colno,
    errorType: data.errorType,
    severity: data.severity,
    url: metric.url,
    userId: metric.userId,
    sessionId: metric.sessionId,
    userAgent: clientInfo.userAgent,
    correlationId: clientInfo.correlationId,
  });

  // Track in Application Insights
  if (appInsights.isReady()) {
    appInsights.trackException(error, {
      errorType: data.errorType,
      severity: data.severity,
      filename: data.filename,
      lineno: data.lineno,
      colno: data.colno,
      url: metric.url,
      userId: metric.userId,
      sessionId: metric.sessionId,
      source: 'client',
    });
  }

  // Record security event for critical errors
  if (data.severity === 'critical') {
    securityAudit.recordSecurityEvent(
      'SECURITY_CONFIG_CHANGE',
      'HIGH',
      'client_application',
      'critical_error',
      {
        errorMessage: data.message,
        errorType: data.errorType,
        filename: data.filename,
        url: metric.url,
      },
      {
        userId: metric.userId,
        correlationId: clientInfo.correlationId,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      }
    );
  }
}

/**
 * Process navigation metrics
 */
async function processNavigationMetric(
  data: NavigationMetric, 
  clientInfo: any, 
  metric: ClientMetric
): Promise<void> {
  // Record navigation performance
  const measurementId = performanceMonitor.recordQuery({
    operation: 'client_navigation',
    duration: data.duration,
    success: true,
    cached: false,
    userId: metric.userId,
    tags: {
      method: data.method,
      from: data.from,
      to: data.to,
    }
  });

  // Log navigation
  logger.info('Client navigation', {
    measurementId,
    from: data.from,
    to: data.to,
    method: data.method,
    duration: data.duration,
    userId: metric.userId,
    sessionId: metric.sessionId,
  });

  // Track in Application Insights
  if (appInsights.isReady()) {
    appInsights.trackPageView(data.to, data.to, {
      from: data.from,
      method: data.method,
      duration: data.duration,
      userId: metric.userId,
      sessionId: metric.sessionId,
    });
  }
}

/**
 * Process interaction metrics
 */
async function processInteractionMetric(
  data: InteractionMetric, 
  clientInfo: any, 
  metric: ClientMetric
): Promise<void> {
  // Log user interaction
  logger.info('Client interaction', {
    element: data.element,
    action: data.action,
    duration: data.duration,
    value: data.value ? '[REDACTED]' : undefined, // Don't log actual values for privacy
    url: metric.url,
    userId: metric.userId,
    sessionId: metric.sessionId,
  });

  // Track in Application Insights
  if (appInsights.isReady()) {
    appInsights.trackEvent('UserInteraction', {
      element: data.element,
      action: data.action,
      duration: data.duration,
      hasValue: !!data.value,
      url: metric.url,
      userId: metric.userId,
      sessionId: metric.sessionId,
    });
  }
}

/**
 * Extract client IP address
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for client IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const clientIP = request.headers.get('x-client-ip');
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (clientIP) {
    return clientIP;
  }
  
  // Fallback to request IP (may be undefined in some environments)
  return request.ip || 'unknown';
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: Date.now(),
    endpoints: {
      metrics: '/api/monitoring',
      health: '/api/health',
      prometheus: '/api/metrics',
    }
  });
}