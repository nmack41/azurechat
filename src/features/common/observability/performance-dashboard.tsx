// ABOUTME: Performance monitoring dashboard component for real-time metrics visualization
// ABOUTME: Displays query performance, cache hit rates, alerts, and system health indicators

"use client";

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { performanceMonitor, QueryMetric, AggregatedMetric, PerformanceAlert } from "./performance-monitor";

interface PerformanceDashboardProps {
  refreshInterval?: number;
  showDetailedMetrics?: boolean;
  autoRefresh?: boolean;
}

/**
 * Real-time performance monitoring dashboard
 */
export function PerformanceDashboard({
  refreshInterval = 30000, // 30 seconds
  showDetailedMetrics = false,
  autoRefresh = true,
}: PerformanceDashboardProps) {
  const [summary, setSummary] = useState(performanceMonitor.getSummary());
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [aggregatedMetrics, setAggregatedMetrics] = useState<AggregatedMetric[]>([]);
  const [recentMetrics, setRecentMetrics] = useState<QueryMetric[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      setSummary(performanceMonitor.getSummary());
      setAlerts(performanceMonitor.getAlerts());
      setAggregatedMetrics(performanceMonitor.getAggregatedMetrics());
      
      if (showDetailedMetrics) {
        setRecentMetrics(performanceMonitor.getMetrics(undefined, 5 * 60 * 1000)); // Last 5 minutes
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    refreshData();

    if (autoRefresh) {
      const interval = setInterval(refreshData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, autoRefresh, showDetailedMetrics]);

  // Severity color mapping
  const getSeverityColor = (severity: PerformanceAlert['severity']) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  // Health status based on metrics
  const healthStatus = useMemo(() => {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const successRate = summary.successRate;
    const cacheHitRate = summary.cacheHitRate;

    if (criticalAlerts > 0 || successRate < 0.9) {
      return { status: 'critical', color: 'text-red-600', label: 'Critical' };
    } else if (successRate < 0.95 || cacheHitRate < 0.5) {
      return { status: 'warning', color: 'text-yellow-600', label: 'Warning' };
    } else if (successRate >= 0.99 && cacheHitRate >= 0.7) {
      return { status: 'excellent', color: 'text-green-600', label: 'Excellent' };
    } else {
      return { status: 'good', color: 'text-blue-600', label: 'Good' };
    }
  }, [alerts, summary]);

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring of database and API performance
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${
              healthStatus.status === 'critical' ? 'bg-red-500' :
              healthStatus.status === 'warning' ? 'bg-yellow-500' :
              healthStatus.status === 'excellent' ? 'bg-green-500' : 'bg-blue-500'
            }`} />
            <span className={`text-sm font-medium ${healthStatus.color}`}>
              {healthStatus.label}
            </span>
          </div>
          <Button 
            onClick={refreshData} 
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Total Queries</div>
          <div className="text-2xl font-bold">{summary.totalQueries.toLocaleString()}</div>
        </Card>
        
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Success Rate</div>
          <div className="text-2xl font-bold">
            {(summary.successRate * 100).toFixed(1)}%
          </div>
          <div className={`text-xs ${summary.successRate >= 0.99 ? 'text-green-600' : 
            summary.successRate >= 0.95 ? 'text-yellow-600' : 'text-red-600'}`}>
            {summary.successRate >= 0.99 ? 'Excellent' : 
             summary.successRate >= 0.95 ? 'Good' : 'Needs Attention'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Avg Duration</div>
          <div className="text-2xl font-bold">{summary.averageDuration.toFixed(0)}ms</div>
          <div className={`text-xs ${summary.averageDuration <= 100 ? 'text-green-600' : 
            summary.averageDuration <= 500 ? 'text-yellow-600' : 'text-red-600'}`}>
            {summary.averageDuration <= 100 ? 'Fast' : 
             summary.averageDuration <= 500 ? 'Moderate' : 'Slow'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Cache Hit Rate</div>
          <div className="text-2xl font-bold">
            {(summary.cacheHitRate * 100).toFixed(1)}%
          </div>
          <div className={`text-xs ${summary.cacheHitRate >= 0.8 ? 'text-green-600' : 
            summary.cacheHitRate >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
            {summary.cacheHitRate >= 0.8 ? 'Excellent' : 
             summary.cacheHitRate >= 0.5 ? 'Good' : 'Poor'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Request Units</div>
          <div className="text-2xl font-bold">{summary.totalRequestUnits.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Total consumed</div>
        </Card>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Active Alerts ({alerts.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alerts.slice(0, 10).map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityColor(alert.severity) as any}>
                      {alert.severity}
                    </Badge>
                    <span className="text-sm font-medium">{alert.operation}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Slowest Operations */}
      {summary.slowestOperations.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Slowest Operations</h3>
          <div className="space-y-2">
            {summary.slowestOperations.map((op, index) => (
              <div key={op.operation} className="flex items-center justify-between p-2 bg-muted rounded">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-muted-foreground">#{index + 1}</span>
                  <span className="text-sm font-medium">{op.operation}</span>
                </div>
                <span className="text-sm font-mono">{op.averageDuration.toFixed(0)}ms</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Detailed Metrics (if enabled) */}
      {showDetailedMetrics && (
        <>
          {/* Aggregated Metrics */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Operation Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Operation</th>
                    <th className="text-right p-2">Count</th>
                    <th className="text-right p-2">Avg (ms)</th>
                    <th className="text-right p-2">P95 (ms)</th>
                    <th className="text-right p-2">Success%</th>
                    <th className="text-right p-2">Cache%</th>
                    <th className="text-right p-2">Avg RU</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedMetrics.slice(0, 10).map((metric) => (
                    <tr key={`${metric.operation}-${metric.timeWindow}`} className="border-b">
                      <td className="p-2 font-mono text-xs">{metric.operation}</td>
                      <td className="p-2 text-right">{metric.count}</td>
                      <td className="p-2 text-right">{metric.averageDuration.toFixed(0)}</td>
                      <td className="p-2 text-right">{metric.p95.toFixed(0)}</td>
                      <td className="p-2 text-right">{(metric.successRate * 100).toFixed(1)}%</td>
                      <td className="p-2 text-right">{(metric.cacheHitRate * 100).toFixed(1)}%</td>
                      <td className="p-2 text-right">{metric.averageRequestUnits.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Recent Query Log */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Recent Queries (Last 5 minutes)</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {recentMetrics.slice(0, 20).map((metric) => (
                <div key={metric.id} className="flex items-center justify-between p-2 text-xs bg-muted rounded">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${metric.success ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-mono">{metric.operation}</span>
                    {metric.cached && <Badge variant="secondary" className="text-xs">cached</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{metric.duration.toFixed(0)}ms</span>
                    {metric.requestUnits && <span>{metric.requestUnits} RU</span>}
                    <span>{new Date(metric.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * Minimal performance widget for embedding in other components
 */
export function PerformanceWidget() {
  const [summary, setSummary] = useState(performanceMonitor.getSummary());
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);

  useEffect(() => {
    const refresh = () => {
      setSummary(performanceMonitor.getSummary());
      setAlerts(performanceMonitor.getAlerts());
    };

    refresh();
    const interval = setInterval(refresh, 60000); // 1 minute
    return () => clearInterval(interval);
  }, []);

  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${
          summary.successRate >= 0.99 ? 'bg-green-500' :
          summary.successRate >= 0.95 ? 'bg-yellow-500' : 'bg-red-500'
        }`} />
        <span>{(summary.successRate * 100).toFixed(1)}%</span>
      </div>
      
      <span>{summary.averageDuration.toFixed(0)}ms</span>
      
      <span>{(summary.cacheHitRate * 100).toFixed(0)}% cache</span>
      
      {criticalAlerts > 0 && (
        <Badge variant="destructive" className="text-xs">
          {criticalAlerts} alert{criticalAlerts > 1 ? 's' : ''}
        </Badge>
      )}
    </div>
  );
}