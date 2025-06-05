// ABOUTME: Advanced performance monitoring system for database queries and API operations
// ABOUTME: Provides real-time metrics, alerting, and performance insights with configurable thresholds

import { logger } from "./logger";

// Performance metric types
interface QueryMetric {
  id: string;
  operation: string;
  query?: string;
  duration: number;
  timestamp: number;
  requestUnits?: number; // For Cosmos DB
  success: boolean;
  error?: string;
  cached: boolean;
  userId?: string;
  threadId?: string;
  resultCount?: number;
  tags?: Record<string, string>;
}

interface AggregatedMetric {
  operation: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  cacheHitRate: number;
  totalRequestUnits: number;
  averageRequestUnits: number;
  p50: number;
  p95: number;
  p99: number;
  timeWindow: string;
}

interface PerformanceAlert {
  id: string;
  type: 'latency' | 'error_rate' | 'request_units' | 'cache_miss';
  operation: string;
  threshold: number;
  currentValue: number;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

interface MonitoringConfig {
  enableMetrics: boolean;
  enableAlerting: boolean;
  retentionPeriod: number; // in milliseconds
  aggregationInterval: number; // in milliseconds
  maxMetricsInMemory: number;
  thresholds: {
    latency: {
      warning: number;
      critical: number;
    };
    errorRate: {
      warning: number;
      critical: number;
    };
    requestUnits: {
      warning: number;
      critical: number;
    };
    cacheHitRate: {
      warning: number; // minimum acceptable rate
    };
  };
}

const DEFAULT_CONFIG: MonitoringConfig = {
  enableMetrics: true,
  enableAlerting: process.env.NODE_ENV === 'production',
  retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
  aggregationInterval: 5 * 60 * 1000, // 5 minutes
  maxMetricsInMemory: 10000,
  thresholds: {
    latency: {
      warning: 1000, // 1 second
      critical: 5000, // 5 seconds
    },
    errorRate: {
      warning: 0.05, // 5%
      critical: 0.1, // 10%
    },
    requestUnits: {
      warning: 50,
      critical: 100,
    },
    cacheHitRate: {
      warning: 0.7, // 70%
    },
  },
};

/**
 * Advanced performance monitoring system
 */
class PerformanceMonitor {
  private metrics: QueryMetric[] = [];
  private aggregatedMetrics = new Map<string, AggregatedMetric>();
  private alerts: PerformanceAlert[] = [];
  private config: MonitoringConfig;
  private aggregationTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enableMetrics) {
      this.startAggregation();
      this.startCleanup();
    }
  }

  /**
   * Record a query performance metric
   */
  public recordQuery(metric: Omit<QueryMetric, 'id' | 'timestamp'>): string {
    if (!this.config.enableMetrics) return '';

    const fullMetric: QueryMetric = {
      ...metric,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.metrics.push(fullMetric);

    // Trim metrics if we exceed the limit
    if (this.metrics.length > this.config.maxMetricsInMemory) {
      this.metrics = this.metrics.slice(-this.config.maxMetricsInMemory);
    }

    // Check for immediate alerts
    if (this.config.enableAlerting) {
      this.checkAlerts(fullMetric);
    }

    // Log the metric
    logger.info('Query executed', {
      operation: metric.operation,
      duration: metric.duration,
      success: metric.success,
      cached: metric.cached,
      requestUnits: metric.requestUnits,
      resultCount: metric.resultCount,
    });

    return fullMetric.id;
  }

  /**
   * Start a performance measurement session
   */
  public startMeasurement(operation: string, tags?: Record<string, string>) {
    const startTime = performance.now();
    const startTimestamp = Date.now();

    return {
      finish: (
        success: boolean,
        options: {
          requestUnits?: number;
          cached?: boolean;
          error?: string;
          query?: string;
          userId?: string;
          threadId?: string;
          resultCount?: number;
        } = {}
      ): string => {
        const duration = performance.now() - startTime;
        
        return this.recordQuery({
          operation,
          duration,
          success,
          cached: options.cached || false,
          requestUnits: options.requestUnits,
          error: options.error,
          query: options.query,
          userId: options.userId,
          threadId: options.threadId,
          resultCount: options.resultCount,
          tags,
        });
      },
    };
  }

  /**
   * Get performance metrics for a specific operation
   */
  public getMetrics(operation?: string, timeWindow?: number): QueryMetric[] {
    let filtered = this.metrics;

    if (operation) {
      filtered = filtered.filter(m => m.operation === operation);
    }

    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      filtered = filtered.filter(m => m.timestamp >= cutoff);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get aggregated metrics
   */
  public getAggregatedMetrics(operation?: string): AggregatedMetric[] {
    const metrics = Array.from(this.aggregatedMetrics.values());
    
    if (operation) {
      return metrics.filter(m => m.operation === operation);
    }

    return metrics.sort((a, b) => b.averageDuration - a.averageDuration);
  }

  /**
   * Get current alerts
   */
  public getAlerts(severity?: PerformanceAlert['severity']): PerformanceAlert[] {
    let alerts = [...this.alerts];

    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get performance summary
   */
  public getSummary(timeWindow = 60 * 60 * 1000): {
    totalQueries: number;
    successRate: number;
    averageDuration: number;
    totalRequestUnits: number;
    cacheHitRate: number;
    slowestOperations: Array<{ operation: string; averageDuration: number }>;
    activeAlerts: number;
  } {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);

    if (recentMetrics.length === 0) {
      return {
        totalQueries: 0,
        successRate: 1,
        averageDuration: 0,
        totalRequestUnits: 0,
        cacheHitRate: 0,
        slowestOperations: [],
        activeAlerts: 0,
      };
    }

    const totalQueries = recentMetrics.length;
    const successfulQueries = recentMetrics.filter(m => m.success).length;
    const cachedQueries = recentMetrics.filter(m => m.cached).length;
    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const totalRequestUnits = recentMetrics.reduce((sum, m) => sum + (m.requestUnits || 0), 0);

    // Get slowest operations
    const operationStats = new Map<string, { total: number; count: number }>();
    recentMetrics.forEach(m => {
      const existing = operationStats.get(m.operation) || { total: 0, count: 0 };
      existing.total += m.duration;
      existing.count += 1;
      operationStats.set(m.operation, existing);
    });

    const slowestOperations = Array.from(operationStats.entries())
      .map(([operation, stats]) => ({
        operation,
        averageDuration: stats.total / stats.count,
      }))
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5);

    return {
      totalQueries,
      successRate: successfulQueries / totalQueries,
      averageDuration: totalDuration / totalQueries,
      totalRequestUnits,
      cacheHitRate: cachedQueries / totalQueries,
      slowestOperations,
      activeAlerts: this.alerts.length,
    };
  }

  /**
   * Performance monitoring decorator for async functions
   */
  public monitor<T extends (...args: any[]) => Promise<any>>(
    operation: string,
    fn: T,
    extractMetadata?: (args: Parameters<T>, result: any) => {
      requestUnits?: number;
      cached?: boolean;
      userId?: string;
      threadId?: string;
      resultCount?: number;
    }
  ): T {
    return (async (...args: Parameters<T>) => {
      const measurement = this.startMeasurement(operation);

      try {
        const result = await fn(...args);
        const metadata = extractMetadata ? extractMetadata(args, result) : {};
        
        measurement.finish(true, metadata);
        return result;
      } catch (error) {
        measurement.finish(false, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    }) as T;
  }

  /**
   * Generate performance report
   */
  public generateReport(timeWindow = 24 * 60 * 60 * 1000): string {
    const summary = this.getSummary(timeWindow);
    const aggregated = this.getAggregatedMetrics();
    const alerts = this.getAlerts();

    let report = `Performance Report (Last ${timeWindow / (60 * 60 * 1000)} hours)\n`;
    report += `======================================================\n\n`;
    
    report += `Summary:\n`;
    report += `- Total Queries: ${summary.totalQueries}\n`;
    report += `- Success Rate: ${(summary.successRate * 100).toFixed(2)}%\n`;
    report += `- Average Duration: ${summary.averageDuration.toFixed(2)}ms\n`;
    report += `- Cache Hit Rate: ${(summary.cacheHitRate * 100).toFixed(2)}%\n`;
    report += `- Total Request Units: ${summary.totalRequestUnits}\n`;
    report += `- Active Alerts: ${summary.activeAlerts}\n\n`;

    if (summary.slowestOperations.length > 0) {
      report += `Slowest Operations:\n`;
      summary.slowestOperations.forEach((op, index) => {
        report += `${index + 1}. ${op.operation}: ${op.averageDuration.toFixed(2)}ms\n`;
      });
      report += `\n`;
    }

    if (alerts.length > 0) {
      report += `Active Alerts:\n`;
      alerts.slice(0, 10).forEach((alert, index) => {
        report += `${index + 1}. [${alert.severity.toUpperCase()}] ${alert.message}\n`;
      });
      report += `\n`;
    }

    return report;
  }

  /**
   * Start periodic aggregation
   */
  private startAggregation() {
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics();
    }, this.config.aggregationInterval);
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Aggregate metrics by operation
   */
  private aggregateMetrics() {
    const now = Date.now();
    const windowStart = now - this.config.aggregationInterval;
    const windowMetrics = this.metrics.filter(m => m.timestamp >= windowStart);

    const operationGroups = new Map<string, QueryMetric[]>();
    windowMetrics.forEach(metric => {
      const existing = operationGroups.get(metric.operation) || [];
      existing.push(metric);
      operationGroups.set(metric.operation, existing);
    });

    operationGroups.forEach((metrics, operation) => {
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
      const successCount = metrics.filter(m => m.success).length;
      const cacheHits = metrics.filter(m => m.cached).length;
      const totalRU = metrics.reduce((sum, m) => sum + (m.requestUnits || 0), 0);

      const aggregated: AggregatedMetric = {
        operation,
        count: metrics.length,
        totalDuration: durations.reduce((sum, d) => sum + d, 0),
        averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minDuration: durations[0] || 0,
        maxDuration: durations[durations.length - 1] || 0,
        successRate: successCount / metrics.length,
        cacheHitRate: cacheHits / metrics.length,
        totalRequestUnits: totalRU,
        averageRequestUnits: totalRU / metrics.length,
        p50: this.getPercentile(durations, 0.5),
        p95: this.getPercentile(durations, 0.95),
        p99: this.getPercentile(durations, 0.99),
        timeWindow: new Date(windowStart).toISOString(),
      };

      this.aggregatedMetrics.set(`${operation}-${windowStart}`, aggregated);
    });

    // Cleanup old aggregated metrics
    const cutoff = now - this.config.retentionPeriod;
    for (const [key, metric] of this.aggregatedMetrics.entries()) {
      if (new Date(metric.timeWindow).getTime() < cutoff) {
        this.aggregatedMetrics.delete(key);
      }
    }
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(metric: QueryMetric) {
    const alerts: PerformanceAlert[] = [];

    // Latency alert
    if (metric.duration > this.config.thresholds.latency.critical) {
      alerts.push(this.createAlert(
        'latency',
        metric.operation,
        this.config.thresholds.latency.critical,
        metric.duration,
        'critical',
        `Critical latency: ${metric.operation} took ${metric.duration.toFixed(2)}ms`
      ));
    } else if (metric.duration > this.config.thresholds.latency.warning) {
      alerts.push(this.createAlert(
        'latency',
        metric.operation,
        this.config.thresholds.latency.warning,
        metric.duration,
        'medium',
        `High latency: ${metric.operation} took ${metric.duration.toFixed(2)}ms`
      ));
    }

    // Request Units alert
    if (metric.requestUnits && metric.requestUnits > this.config.thresholds.requestUnits.critical) {
      alerts.push(this.createAlert(
        'request_units',
        metric.operation,
        this.config.thresholds.requestUnits.critical,
        metric.requestUnits,
        'critical',
        `High RU consumption: ${metric.operation} used ${metric.requestUnits} RU`
      ));
    }

    this.alerts.push(...alerts);

    // Keep only recent alerts
    const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour
    this.alerts = this.alerts.filter(a => a.timestamp >= cutoff);
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'],
    operation: string,
    threshold: number,
    currentValue: number,
    severity: PerformanceAlert['severity'],
    message: string
  ): PerformanceAlert {
    return {
      id: this.generateId(),
      type,
      operation,
      threshold,
      currentValue,
      timestamp: Date.now(),
      severity,
      message,
    };
  }

  /**
   * Cleanup old metrics
   */
  private cleanup() {
    const cutoff = Date.now() - this.config.retentionPeriod;
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
    this.alerts = this.alerts.filter(a => a.timestamp >= cutoff);
  }

  /**
   * Calculate percentile
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[index] || 0;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destroy the monitor and cleanup timers
   */
  public destroy() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export types for external use
export type {
  QueryMetric,
  AggregatedMetric,
  PerformanceAlert,
  MonitoringConfig,
};