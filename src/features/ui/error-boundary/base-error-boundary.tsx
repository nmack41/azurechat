// ABOUTME: Base React Error Boundary component with comprehensive error handling
// ABOUTME: Provides crash protection, error logging, and recovery mechanisms

'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { BaseError, ErrorSeverity, ErrorCategory, ErrorSerializer } from '@/errors';

/**
 * Props for error boundary components
 */
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  isolate?: boolean; // Whether this boundary should isolate errors to this component tree
}

/**
 * Error boundary state
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

/**
 * Error boundary component that can be extended for specific use cases
 */
export class BaseErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: ErrorSerializer.createCorrelationId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    this.logError(error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
    
    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;
    
    if (hasError && prevProps.resetOnPropsChange !== resetOnPropsChange) {
      if (resetOnPropsChange) {
        this.resetErrorBoundary();
      }
    }
    
    if (hasError && resetKeys) {
      const prevResetKeys = prevProps.resetKeys || [];
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => prevResetKeys[index] !== key
      );
      
      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    // Create a comprehensive error report
    const appError = new BaseError(
      `React Error Boundary caught error: ${error.message}`,
      {
        code: 'SYS_004', // Unhandled error
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.UNKNOWN,
        context: {
          correlationId: this.state.errorId || ErrorSerializer.createCorrelationId(),
          url: typeof window !== 'undefined' ? window.location.href : undefined,
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        },
        metadata: {
          componentStack: errorInfo.componentStack,
          errorBoundary: this.constructor.name,
          retryCount: this.state.retryCount,
          isolate: this.props.isolate,
        },
        cause: error,
      }
    );

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 React Error Boundary');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Serialized:', ErrorSerializer.serialize(appError));
      console.groupEnd();
    }

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to monitoring service (Sentry, AppInsights, etc.)
      this.sendToMonitoring(appError, errorInfo);
    }
  };

  private sendToMonitoring = (error: BaseError, errorInfo: ErrorInfo) => {
    // This would integrate with your monitoring service
    // Example implementations:
    
    // Sentry
    // Sentry.withScope((scope) => {
    //   scope.setTag('errorBoundary', this.constructor.name);
    //   scope.setContext('errorInfo', errorInfo);
    //   Sentry.captureException(error);
    // });

    // Application Insights
    // appInsights.trackException({
    //   exception: error,
    //   properties: {
    //     componentStack: errorInfo.componentStack,
    //     errorBoundary: this.constructor.name,
    //   },
    // });

    // Custom logging service
    console.error('Error Boundary Error:', ErrorSerializer.serialize(error, {
      componentStack: errorInfo.componentStack,
    }));
  };

  public resetErrorBoundary = () => {
    // Clear any existing timeout
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: this.state.retryCount + 1,
    });
  };

  public resetAfterDelay = (delayMs = 5000) => {
    this.resetTimeoutId = window.setTimeout(() => {
      this.resetErrorBoundary();
    }, delayMs);
  };

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return this.renderDefaultFallback();
    }

    return this.props.children;
  }

  private renderDefaultFallback() {
    return (
      <DefaultErrorFallback
        error={this.state.error}
        errorId={this.state.errorId}
        retryCount={this.state.retryCount}
        onRetry={this.resetErrorBoundary}
        onReport={() => this.reportError()}
      />
    );
  }

  private reportError = () => {
    if (this.state.error && this.state.errorInfo) {
      // Generate error report for user to send to support
      const report = {
        errorId: this.state.errorId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        error: {
          name: this.state.error.name,
          message: this.state.error.message,
          stack: this.state.error.stack,
        },
        componentStack: this.state.errorInfo.componentStack,
      };

      // Copy to clipboard or download as file
      navigator.clipboard?.writeText(JSON.stringify(report, null, 2));
    }
  };
}

/**
 * Default fallback UI component
 */
interface DefaultErrorFallbackProps {
  error: Error | null;
  errorId: string | null;
  retryCount: number;
  onRetry: () => void;
  onReport: () => void;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({
  error,
  errorId,
  retryCount,
  onRetry,
  onReport,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-red-50 border border-red-200 rounded-lg">
      <div className="text-red-600 mb-4">
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 18.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      
      <h3 className="text-lg font-semibold text-red-800 mb-2">
        Something went wrong
      </h3>
      
      <p className="text-red-700 text-center mb-4 max-w-md">
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </p>
      
      {errorId && (
        <p className="text-sm text-red-600 mb-4 font-mono">
          Error ID: {errorId}
        </p>
      )}
      
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          disabled={retryCount >= 3}
        >
          {retryCount >= 3 ? 'Max Retries Reached' : 'Try Again'}
        </button>
        
        <button
          onClick={onReport}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          Copy Error Report
        </button>
      </div>
      
      {process.env.NODE_ENV === 'development' && error && (
        <details className="mt-4 w-full max-w-2xl">
          <summary className="cursor-pointer text-sm text-red-600 hover:text-red-800">
            Show Error Details (Development Only)
          </summary>
          <pre className="mt-2 p-3 bg-red-100 text-red-800 text-xs overflow-auto rounded border">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
};