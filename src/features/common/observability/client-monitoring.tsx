// ABOUTME: Client-side error tracking and performance monitoring
// ABOUTME: Provides browser error capture, performance metrics, and user experience monitoring

'use client';

import { useEffect, useRef, useState } from 'react';
import { useCorrelationId } from './use-correlation';
import { ErrorSerializer } from '../errors';

/**
 * Performance metrics interface
 */
interface PerformanceMetrics {
  correlationId: string;
  timestamp: string;
  url: string;
  userAgent: string;
  // Core Web Vitals
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  firstInputDelay?: number;
  interactionToNextPaint?: number;
  // Navigation timing
  domContentLoaded?: number;
  loadComplete?: number;
  timeToFirstByte?: number;
  // Memory info (if available)
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

/**
 * Error report interface
 */
interface ErrorReport {
  correlationId: string;
  timestamp: string;
  url: string;
  userAgent: string;
  type: 'javascript' | 'unhandled-promise' | 'resource' | 'network';
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  source?: string;
  userId?: string;
  sessionId?: string;
  additionalContext?: Record<string, any>;
}

/**
 * User interaction tracking
 */
interface UserInteraction {
  correlationId: string;
  timestamp: string;
  type: 'click' | 'scroll' | 'input' | 'navigation';
  target?: string;
  data?: Record<string, any>;
}

/**
 * Network request monitoring
 */
interface NetworkMetrics {
  correlationId: string;
  timestamp: string;
  url: string;
  method: string;
  status: number;
  duration: number;
  size?: number;
  type: 'fetch' | 'xhr';
}

/**
 * Client monitoring configuration
 */
interface MonitoringConfig {
  enableErrorTracking: boolean;
  enablePerformanceMonitoring: boolean;
  enableUserInteractionTracking: boolean;
  enableNetworkMonitoring: boolean;
  sampleRate: number; // 0.0 to 1.0
  endpoint?: string; // Where to send monitoring data
  maxErrors: number; // Max errors to store before dropping
  maxMetrics: number; // Max metrics to store before dropping
}

/**
 * Default monitoring configuration
 */
const DEFAULT_CONFIG: MonitoringConfig = {
  enableErrorTracking: true,
  enablePerformanceMonitoring: true,
  enableUserInteractionTracking: false,
  enableNetworkMonitoring: true,
  sampleRate: 1.0,
  maxErrors: 100,
  maxMetrics: 50,
};

/**
 * Client monitoring service
 */
class ClientMonitoringService {
  private config: MonitoringConfig;
  private errors: ErrorReport[] = [];
  private metrics: PerformanceMetrics[] = [];
  private interactions: UserInteraction[] = [];
  private networkMetrics: NetworkMetrics[] = [];
  private sessionId: string;
  private userId?: string;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
    this.initialize();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private initialize() {
    if (!this.shouldSample()) {
      return;
    }

    if (this.config.enableErrorTracking) {
      this.setupErrorTracking();
    }

    if (this.config.enablePerformanceMonitoring) {
      this.setupPerformanceMonitoring();
    }

    if (this.config.enableUserInteractionTracking) {
      this.setupUserInteractionTracking();
    }

    if (this.config.enableNetworkMonitoring) {
      this.setupNetworkMonitoring();
    }
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private setupErrorTracking() {
    // Global error handler
    window.addEventListener('error', (event) => {
      const report: ErrorReport = {
        correlationId: this.getCorrelationId(),
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        type: 'javascript',
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        userId: this.userId,
        sessionId: this.sessionId,
      };

      this.addError(report);
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      const report: ErrorReport = {
        correlationId: this.getCorrelationId(),
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        type: 'unhandled-promise',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        userId: this.userId,
        sessionId: this.sessionId,
      };

      this.addError(report);
    });

    // Resource error handler
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        const target = event.target as HTMLElement;
        const report: ErrorReport = {
          correlationId: this.getCorrelationId(),
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          type: 'resource',
          message: `Failed to load resource: ${target.tagName}`,
          source: (target as any).src || (target as any).href,
          userId: this.userId,
          sessionId: this.sessionId,
        };

        this.addError(report);
      }
    }, true);
  }

  private setupPerformanceMonitoring() {
    // Wait for page load to collect initial metrics
    window.addEventListener('load', () => {
      setTimeout(() => {
        this.collectPerformanceMetrics();
      }, 0);
    });

    // Collect Core Web Vitals
    this.observeWebVitals();
  }

  private setupUserInteractionTracking() {
    // Click tracking
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const interaction: UserInteraction = {
        correlationId: this.getCorrelationId(),
        timestamp: new Date().toISOString(),
        type: 'click',
        target: this.getElementSelector(target),
        data: {
          x: event.clientX,
          y: event.clientY,
          button: event.button,
        },
      };

      this.addInteraction(interaction);
    });

    // Scroll tracking (throttled)
    let scrollTimeout: NodeJS.Timeout;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const interaction: UserInteraction = {
          correlationId: this.getCorrelationId(),
          timestamp: new Date().toISOString(),
          type: 'scroll',
          data: {
            scrollY: window.scrollY,
            scrollX: window.scrollX,
          },
        };

        this.addInteraction(interaction);
      }, 100);
    });
  }

  private setupNetworkMonitoring() {
    // Monkey patch fetch
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const startTime = performance.now();
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';

      try {
        const response = await originalFetch(input, init);
        const duration = performance.now() - startTime;

        const metrics: NetworkMetrics = {
          correlationId: this.getCorrelationId(),
          timestamp: new Date().toISOString(),
          url,
          method,
          status: response.status,
          duration,
          type: 'fetch',
        };

        this.addNetworkMetrics(metrics);
        return response;
      } catch (error) {
        const duration = performance.now() - startTime;

        const metrics: NetworkMetrics = {
          correlationId: this.getCorrelationId(),
          timestamp: new Date().toISOString(),
          url,
          method,
          status: 0,
          duration,
          type: 'fetch',
        };

        this.addNetworkMetrics(metrics);
        throw error;
      }
    };
  }

  private observeWebVitals() {
    // Use Performance Observer API for Core Web Vitals
    if ('PerformanceObserver' in window) {
      try {
        // Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          this.updateMetric('largestContentfulPaint', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.updateMetric('firstInputDelay', entry.processingStart - entry.startTime);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.updateMetric('cumulativeLayoutShift', clsValue);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        console.warn('Performance observation not supported:', error);
      }
    }
  }

  private collectPerformanceMetrics() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const memory = (performance as any).memory;

    const metrics: PerformanceMetrics = {
      correlationId: this.getCorrelationId(),
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
      loadComplete: navigation.loadEventEnd - navigation.navigationStart,
      timeToFirstByte: navigation.responseStart - navigation.navigationStart,
    };

    // Add memory info if available
    if (memory) {
      metrics.memoryUsage = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };
    }

    // Add FCP if available
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    if (fcp) {
      metrics.firstContentfulPaint = fcp.startTime;
    }

    this.addMetrics(metrics);
  }

  private updateMetric(key: keyof PerformanceMetrics, value: number) {
    // Find or create current metrics entry
    let currentMetrics = this.metrics.find(m => 
      Date.now() - new Date(m.timestamp).getTime() < 1000
    );

    if (!currentMetrics) {
      currentMetrics = {
        correlationId: this.getCorrelationId(),
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      };
      this.addMetrics(currentMetrics);
    }

    (currentMetrics as any)[key] = value;
  }

  private getElementSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }

    if (element.className) {
      return `.${element.className.split(' ')[0]}`;
    }

    return element.tagName.toLowerCase();
  }

  private getCorrelationId(): string {
    // Try to get from React context or generate new one
    return (window as any).__correlationId || this.generateSessionId();
  }

  private addError(error: ErrorReport) {
    this.errors.push(error);
    if (this.errors.length > this.config.maxErrors) {
      this.errors.shift();
    }

    console.error('Client error captured:', error);
    this.sendToEndpoint('errors', error);
  }

  private addMetrics(metrics: PerformanceMetrics) {
    this.metrics.push(metrics);
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics.shift();
    }

    console.log('Performance metrics collected:', metrics);
    this.sendToEndpoint('metrics', metrics);
  }

  private addInteraction(interaction: UserInteraction) {
    this.interactions.push(interaction);
    if (this.interactions.length > 100) {
      this.interactions.shift();
    }

    this.sendToEndpoint('interactions', interaction);
  }

  private addNetworkMetrics(metrics: NetworkMetrics) {
    this.networkMetrics.push(metrics);
    if (this.networkMetrics.length > 100) {
      this.networkMetrics.shift();
    }

    this.sendToEndpoint('network', metrics);
  }

  private sendToEndpoint(type: string, data: any) {
    if (!this.config.endpoint) {
      return; // No endpoint configured
    }

    // Send data to monitoring endpoint (fire and forget)
    fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        data,
        timestamp: new Date().toISOString(),
      }),
    }).catch(error => {
      console.warn('Failed to send monitoring data:', error);
    });
  }

  public setUserId(userId: string) {
    this.userId = userId;
  }

  public getErrors(): ErrorReport[] {
    return [...this.errors];
  }

  public getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  public clearData() {
    this.errors = [];
    this.metrics = [];
    this.interactions = [];
    this.networkMetrics = [];
  }
}

/**
 * Global monitoring service instance
 */
let monitoringService: ClientMonitoringService | null = null;

/**
 * Initialize monitoring service
 */
export function initializeMonitoring(config?: Partial<MonitoringConfig>) {
  if (typeof window === 'undefined') {
    return; // Server-side, skip
  }

  monitoringService = new ClientMonitoringService(config);
  return monitoringService;
}

/**
 * React hook for client monitoring
 */
export function useClientMonitoring(config?: Partial<MonitoringConfig>) {
  const correlationId = useCorrelationId();
  const [service, setService] = useState<ClientMonitoringService | null>(null);

  useEffect(() => {
    if (!service) {
      const newService = initializeMonitoring(config);
      setService(newService);
    }

    // Update correlation ID in global scope for error capture
    if (typeof window !== 'undefined') {
      (window as any).__correlationId = correlationId;
    }
  }, [correlationId, config, service]);

  const captureError = (error: Error, additionalContext?: Record<string, any>) => {
    if (service) {
      const report: ErrorReport = {
        correlationId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        type: 'javascript',
        message: error.message,
        stack: error.stack,
        additionalContext,
        sessionId: (service as any).sessionId,
      };

      (service as any).addError(report);
    }
  };

  const measurePerformance = (name: string, fn: () => void | Promise<void>) => {
    const startTime = performance.now();
    
    const finish = () => {
      const duration = performance.now() - startTime;
      console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`, {
        correlationId,
        operation: name,
        duration,
      });
    };

    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.finally(finish);
      } else {
        finish();
        return result;
      }
    } catch (error) {
      finish();
      throw error;
    }
  };

  return {
    service,
    captureError,
    measurePerformance,
    correlationId,
  };
}

/**
 * React error boundary with monitoring
 */
interface MonitoringErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; correlationId: string }>;
}

export class MonitoringErrorBoundary extends React.Component<
  MonitoringErrorBoundaryProps,
  { hasError: boolean; error: Error | null; correlationId: string }
> {
  constructor(props: MonitoringErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      correlationId: '',
    };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      error,
      correlationId: (window as any).__correlationId || 'unknown',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Send to monitoring service
    if (monitoringService) {
      const report: ErrorReport = {
        correlationId: this.state.correlationId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        type: 'javascript',
        message: error.message,
        stack: error.stack,
        additionalContext: {
          componentStack: errorInfo.componentStack,
        },
        sessionId: (monitoringService as any).sessionId,
      };

      (monitoringService as any).addError(report);
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      if (FallbackComponent) {
        return (
          <FallbackComponent 
            error={this.state.error} 
            correlationId={this.state.correlationId} 
          />
        );
      }

      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h2 className="text-red-800 font-semibold">Something went wrong</h2>
          <p className="text-red-600 text-sm mt-2">
            Error ID: {this.state.correlationId}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Export monitoring service for direct access
 */
export { monitoringService };
export type { MonitoringConfig, ErrorReport, PerformanceMetrics };