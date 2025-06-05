// ABOUTME: Prometheus metrics endpoint for monitoring and alerting
// ABOUTME: Provides comprehensive application metrics in Prometheus format

import { NextRequest, NextResponse } from "next/server";
import { performanceMonitor } from "@/features/common/observability/performance-monitor";
import { connectionPoolManager } from "@/features/common/services/connection-pool-manager";
import { streamingQueryService } from "@/features/common/services/streaming-query-service";

interface MetricValue {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  labels?: Record<string, string>;
}

/**
 * Generate Prometheus metrics for application monitoring
 */
export async function GET(request: NextRequest) {
  try {
    const metrics: MetricValue[] = [];

    // Performance metrics
    const perfSummary = performanceMonitor.getSummary();
    const perfAlerts = performanceMonitor.getAlerts();

    metrics.push(
      {
        name: 'azurechat_queries_total',
        help: 'Total number of database queries executed',
        type: 'counter',
        value: perfSummary.totalQueries,
      },
      {
        name: 'azurechat_query_success_rate',
        help: 'Success rate of database queries (0-1)',
        type: 'gauge',
        value: perfSummary.successRate,
      },
      {
        name: 'azurechat_query_duration_avg_ms',
        help: 'Average query duration in milliseconds',
        type: 'gauge',
        value: perfSummary.averageDuration,
      },
      {
        name: 'azurechat_cache_hit_rate',
        help: 'Cache hit rate (0-1)',
        type: 'gauge',
        value: perfSummary.cacheHitRate,
      },
      {
        name: 'azurechat_request_units_total',
        help: 'Total Cosmos DB request units consumed',
        type: 'counter',
        value: perfSummary.totalRequestUnits,
      },
      {
        name: 'azurechat_active_alerts',
        help: 'Number of active performance alerts',
        type: 'gauge',
        value: perfAlerts.length,
      }
    );

    // Connection pool metrics
    const poolStats = connectionPoolManager.getStats();
    metrics.push(
      {
        name: 'azurechat_connection_pool_total',
        help: 'Total connections in pool',
        type: 'gauge',
        value: poolStats.totalConnections,
      },
      {
        name: 'azurechat_connection_pool_active',
        help: 'Active connections in pool',
        type: 'gauge',
        value: poolStats.activeConnections,
      },
      {
        name: 'azurechat_connection_pool_idle',
        help: 'Idle connections in pool',
        type: 'gauge',
        value: poolStats.idleConnections,
      },
      {
        name: 'azurechat_connection_pool_failed',
        help: 'Failed connections in pool',
        type: 'gauge',
        value: poolStats.failedConnections,
      },
      {
        name: 'azurechat_connection_pool_latency_avg_ms',
        help: 'Average connection latency in milliseconds',
        type: 'gauge',
        value: poolStats.averageLatency,
      },
      {
        name: 'azurechat_connection_pool_requests_per_second',
        help: 'Requests per second through connection pool',
        type: 'gauge',
        value: poolStats.requestsPerSecond,
      },
      {
        name: 'azurechat_circuit_breaker_open',
        help: 'Circuit breaker status (1 = open, 0 = closed)',
        type: 'gauge',
        value: poolStats.circuitBreakerOpen ? 1 : 0,
      }
    );

    // Streaming query metrics
    const streamStats = streamingQueryService.getGlobalStats();
    metrics.push(
      {
        name: 'azurechat_streams_created_total',
        help: 'Total number of streaming queries created',
        type: 'counter',
        value: streamStats.totalStreamsCreated,
      },
      {
        name: 'azurechat_streams_active',
        help: 'Currently active streaming queries',
        type: 'gauge',
        value: streamStats.activeStreams,
      },
      {
        name: 'azurechat_stream_items_processed_total',
        help: 'Total items processed by streaming queries',
        type: 'counter',
        value: streamStats.totalItemsProcessed,
      },
      {
        name: 'azurechat_stream_request_units_total',
        help: 'Total request units consumed by streaming queries',
        type: 'counter',
        value: streamStats.totalRequestUnits,
      }
    );

    // System metrics
    const memUsage = process.memoryUsage();
    metrics.push(
      {
        name: 'azurechat_memory_heap_used_bytes',
        help: 'Heap memory used in bytes',
        type: 'gauge',
        value: memUsage.heapUsed,
      },
      {
        name: 'azurechat_memory_heap_total_bytes',
        help: 'Heap memory total in bytes',
        type: 'gauge',
        value: memUsage.heapTotal,
      },
      {
        name: 'azurechat_memory_external_bytes',
        help: 'External memory used in bytes',
        type: 'gauge',
        value: memUsage.external,
      }
    );

    // Custom business metrics
    const currentTime = Date.now();
    metrics.push(
      {
        name: 'azurechat_uptime_seconds',
        help: 'Application uptime in seconds',
        type: 'counter',
        value: Math.floor(process.uptime()),
      },
      {
        name: 'azurechat_scrape_timestamp',
        help: 'Timestamp of metrics scrape',
        type: 'gauge',
        value: currentTime,
      }
    );

    // Convert to Prometheus format
    const prometheusOutput = metrics.map(metric => {
      const labelsStr = metric.labels 
        ? `{${Object.entries(metric.labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
        : '';
      
      return [
        `# HELP ${metric.name} ${metric.help}`,
        `# TYPE ${metric.name} ${metric.type}`,
        `${metric.name}${labelsStr} ${metric.value}`
      ].join('\n');
    }).join('\n\n');

    return new NextResponse(prometheusOutput, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    );
  }
}