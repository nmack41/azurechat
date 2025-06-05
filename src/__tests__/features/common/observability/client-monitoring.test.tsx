// ABOUTME: Tests for client-side monitoring service
// ABOUTME: Validates error tracking, performance monitoring, and user interaction capture

/**
 * @jest-environment jsdom
 */

import { render, fireEvent, act } from '@testing-library/react';
import { 
  initializeMonitoring,
  useClientMonitoring,
  MonitoringErrorBoundary 
} from '@/features/common/observability/client-monitoring';

// Mock correlation ID hook
jest.mock('@/features/common/observability/use-correlation', () => ({
  useCorrelationId: () => 'test-correlation-id',
}));

// Mock performance API
const mockPerformance = {
  now: jest.fn(() => 1000),
  getEntriesByType: jest.fn(() => []),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000,
  },
};

Object.defineProperty(window, 'performance', {
  value: mockPerformance,
  writable: true,
});

// Mock PerformanceObserver
global.PerformanceObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}));

describe('Client Monitoring', () => {
  let originalConsoleError: any;
  let originalConsoleLog: any;
  let originalConsoleWarn: any;

  beforeEach(() => {
    // Mock console methods
    originalConsoleError = console.error;
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    
    console.error = jest.fn();
    console.log = jest.fn();
    console.warn = jest.fn();

    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    // Clear any existing global state
    (window as any).__correlationId = undefined;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    
    jest.clearAllMocks();
  });

  describe('Error Tracking', () => {
    it('should capture global JavaScript errors', () => {
      const service = initializeMonitoring({
        enableErrorTracking: true,
        sampleRate: 1.0,
      });

      // Simulate a JavaScript error
      const errorEvent = new ErrorEvent('error', {
        message: 'Test error',
        filename: 'test.js',
        lineno: 123,
        colno: 45,
        error: new Error('Test error'),
      });

      fireEvent(window, errorEvent);

      expect(console.error).toHaveBeenCalledWith(
        'Client error captured:',
        expect.objectContaining({
          type: 'javascript',
          message: 'Test error',
          filename: 'test.js',
          lineno: 123,
          colno: 45,
        })
      );
    });

    it('should capture unhandled promise rejections', () => {
      initializeMonitoring({
        enableErrorTracking: true,
        sampleRate: 1.0,
      });

      // Simulate unhandled promise rejection
      const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject(new Error('Promise rejection')),
        reason: new Error('Promise rejection'),
      });

      fireEvent(window, rejectionEvent);

      expect(console.error).toHaveBeenCalledWith(
        'Client error captured:',
        expect.objectContaining({
          type: 'unhandled-promise',
          message: 'Promise rejection',
        })
      );
    });

    it('should capture resource loading errors', () => {
      initializeMonitoring({
        enableErrorTracking: true,
        sampleRate: 1.0,
      });

      // Create a mock image element that fails to load
      const img = document.createElement('img');
      img.src = 'invalid-image.jpg';
      document.body.appendChild(img);

      // Simulate resource error
      const errorEvent = new Event('error');
      Object.defineProperty(errorEvent, 'target', {
        value: img,
        enumerable: true,
      });

      fireEvent(img, errorEvent);

      expect(console.error).toHaveBeenCalledWith(
        'Client error captured:',
        expect.objectContaining({
          type: 'resource',
          message: 'Failed to load resource: IMG',
          source: 'invalid-image.jpg',
        })
      );

      document.body.removeChild(img);
    });
  });

  describe('Performance Monitoring', () => {
    it('should collect navigation timing metrics', () => {
      mockPerformance.getEntriesByType.mockReturnValue([
        {
          name: 'navigation',
          navigationStart: 0,
          domContentLoadedEventEnd: 1500,
          loadEventEnd: 2000,
          responseStart: 100,
        },
      ]);

      initializeMonitoring({
        enablePerformanceMonitoring: true,
        sampleRate: 1.0,
      });

      // Trigger load event
      fireEvent(window, new Event('load'));

      // Wait for setTimeout
      act(() => {
        jest.runAllTimers();
      });

      expect(console.log).toHaveBeenCalledWith(
        'Performance metrics collected:',
        expect.objectContaining({
          domContentLoaded: 1500,
          loadComplete: 2000,
          timeToFirstByte: 100,
        })
      );
    });

    it('should include memory usage when available', () => {
      mockPerformance.getEntriesByType.mockReturnValue([
        {
          name: 'navigation',
          navigationStart: 0,
          domContentLoadedEventEnd: 1000,
          loadEventEnd: 1500,
          responseStart: 100,
        },
      ]);

      initializeMonitoring({
        enablePerformanceMonitoring: true,
        sampleRate: 1.0,
      });

      fireEvent(window, new Event('load'));

      act(() => {
        jest.runAllTimers();
      });

      expect(console.log).toHaveBeenCalledWith(
        'Performance metrics collected:',
        expect.objectContaining({
          memoryUsage: {
            usedJSHeapSize: 1000000,
            totalJSHeapSize: 2000000,
            jsHeapSizeLimit: 4000000,
          },
        })
      );
    });

    it('should collect First Contentful Paint when available', () => {
      mockPerformance.getEntriesByType
        .mockReturnValueOnce([
          {
            name: 'navigation',
            navigationStart: 0,
            domContentLoadedEventEnd: 1000,
            loadEventEnd: 1500,
            responseStart: 100,
          },
        ])
        .mockReturnValueOnce([
          {
            name: 'first-contentful-paint',
            startTime: 800,
          },
        ]);

      initializeMonitoring({
        enablePerformanceMonitoring: true,
        sampleRate: 1.0,
      });

      fireEvent(window, new Event('load'));

      act(() => {
        jest.runAllTimers();
      });

      expect(console.log).toHaveBeenCalledWith(
        'Performance metrics collected:',
        expect.objectContaining({
          firstContentfulPaint: 800,
        })
      );
    });
  });

  describe('Network Monitoring', () => {
    it('should monitor fetch requests', async () => {
      initializeMonitoring({
        enableNetworkMonitoring: true,
        sampleRate: 1.0,
      });

      // Make a fetch request
      await fetch('/api/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      // Check that original fetch was called
      expect(global.fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });
    });

    it('should capture network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      initializeMonitoring({
        enableNetworkMonitoring: true,
        sampleRate: 1.0,
      });

      try {
        await fetch('/api/error');
      } catch (error) {
        // Expected to throw
      }

      expect(global.fetch).toHaveBeenCalledWith('/api/error');
    });
  });

  describe('User Interaction Tracking', () => {
    it('should track click interactions when enabled', () => {
      initializeMonitoring({
        enableUserInteractionTracking: true,
        sampleRate: 1.0,
      });

      const button = document.createElement('button');
      button.id = 'test-button';
      document.body.appendChild(button);

      fireEvent.click(button, {
        clientX: 100,
        clientY: 200,
        button: 0,
      });

      document.body.removeChild(button);
    });

    it('should throttle scroll events', () => {
      jest.useFakeTimers();

      initializeMonitoring({
        enableUserInteractionTracking: true,
        sampleRate: 1.0,
      });

      // Fire multiple scroll events
      fireEvent.scroll(document);
      fireEvent.scroll(document);
      fireEvent.scroll(document);

      // Fast-forward time to trigger throttled callback
      act(() => {
        jest.advanceTimersByTime(150);
      });

      jest.useRealTimers();
    });
  });

  describe('Sampling', () => {
    it('should respect sample rate', () => {
      // Mock Math.random to always return 0.8
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.8);

      // With 50% sample rate, should not initialize
      const service1 = initializeMonitoring({
        sampleRate: 0.5,
      });

      // With 90% sample rate, should initialize
      const service2 = initializeMonitoring({
        sampleRate: 0.9,
      });

      Math.random = originalRandom;
    });
  });

  describe('Configuration', () => {
    it('should use default configuration when not provided', () => {
      const service = initializeMonitoring();
      expect(service).toBeDefined();
    });

    it('should merge custom configuration with defaults', () => {
      const service = initializeMonitoring({
        enableErrorTracking: false,
        maxErrors: 50,
      });
      
      expect(service).toBeDefined();
    });
  });

  describe('Data Management', () => {
    it('should limit stored errors to maxErrors', () => {
      const service = initializeMonitoring({
        maxErrors: 2,
        enableErrorTracking: true,
      });

      // Generate 3 errors
      for (let i = 0; i < 3; i++) {
        const errorEvent = new ErrorEvent('error', {
          message: `Error ${i}`,
          error: new Error(`Error ${i}`),
        });
        fireEvent(window, errorEvent);
      }

      const errors = service?.getErrors() || [];
      expect(errors.length).toBe(2);
      expect(errors[0].message).toBe('Error 1'); // First error should be dropped
      expect(errors[1].message).toBe('Error 2');
    });
  });
});

describe('useClientMonitoring Hook', () => {
  const TestComponent = () => {
    const { captureError, measurePerformance, correlationId } = useClientMonitoring();
    
    return (
      <div>
        <button
          onClick={() => captureError(new Error('Manual error'))}
          data-testid="error-button"
        >
          Trigger Error
        </button>
        <button
          onClick={() => measurePerformance('test-operation', () => {
            // Simulate work
          })}
          data-testid="performance-button"
        >
          Measure Performance
        </button>
        <span data-testid="correlation-id">{correlationId}</span>
      </div>
    );
  };

  it('should provide error capture functionality', () => {
    const { getByTestId } = render(<TestComponent />);
    
    fireEvent.click(getByTestId('error-button'));

    expect(console.error).toHaveBeenCalledWith(
      'Client error captured:',
      expect.objectContaining({
        message: 'Manual error',
        type: 'javascript',
      })
    );
  });

  it('should provide performance measurement', () => {
    const { getByTestId } = render(<TestComponent />);
    
    fireEvent.click(getByTestId('performance-button'));

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Performance: test-operation took'),
      expect.objectContaining({
        operation: 'test-operation',
        correlationId: 'test-correlation-id',
      })
    );
  });

  it('should provide correlation ID', () => {
    const { getByTestId } = render(<TestComponent />);
    
    expect(getByTestId('correlation-id')).toHaveTextContent('test-correlation-id');
  });
});

describe('MonitoringErrorBoundary', () => {
  const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
      throw new Error('Boundary test error');
    }
    return <div data-testid="normal-content">Normal content</div>;
  };

  beforeEach(() => {
    // Suppress React error boundary console output for cleaner tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should catch and display errors', () => {
    const { getByText, queryByTestId } = render(
      <MonitoringErrorBoundary>
        <ThrowError shouldThrow={true} />
      </MonitoringErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeInTheDocument();
    expect(queryByTestId('normal-content')).not.toBeInTheDocument();
  });

  it('should render children when no error occurs', () => {
    const { getByTestId, queryByText } = render(
      <MonitoringErrorBoundary>
        <ThrowError shouldThrow={false} />
      </MonitoringErrorBoundary>
    );

    expect(getByTestId('normal-content')).toBeInTheDocument();
    expect(queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should use custom fallback component when provided', () => {
    const CustomFallback = ({ error, correlationId }: { error: Error; correlationId: string }) => (
      <div data-testid="custom-fallback">
        Custom error: {error.message} (ID: {correlationId})
      </div>
    );

    const { getByTestId } = render(
      <MonitoringErrorBoundary fallback={CustomFallback}>
        <ThrowError shouldThrow={true} />
      </MonitoringErrorBoundary>
    );

    expect(getByTestId('custom-fallback')).toBeInTheDocument();
    expect(getByTestId('custom-fallback')).toHaveTextContent('Custom error: Boundary test error');
  });
});