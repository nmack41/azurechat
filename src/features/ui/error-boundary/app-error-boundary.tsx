// ABOUTME: Application-level error boundary for catastrophic failures
// ABOUTME: Handles top-level errors that could break the entire application

'use client';

import React from 'react';
import { BaseErrorBoundary } from './base-error-boundary';
import { ErrorReferenceService } from '@/errors/error-reference';
import { appInsights } from '@/observability/app-insights';
import { securityAudit } from '@/observability/security-audit';

/**
 * Application-level error boundary for catastrophic failures
 */
export class AppErrorBoundary extends BaseErrorBoundary {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    super.componentDidCatch(error, errorInfo);
    
    // Track in Application Insights
    if (appInsights.isReady()) {
      appInsights.trackException(error, {
        severity: 'critical',
        source: 'app_error_boundary',
        componentStack: errorInfo.componentStack,
        errorBoundary: 'AppErrorBoundary',
      });
    }

    // Record security event for critical application errors
    securityAudit.recordSecurityEvent(
      'SECURITY_CONFIG_CHANGE',
      'CRITICAL', 
      'application',
      'error_boundary_triggered',
      {
        errorMessage: error.message,
        componentStack: errorInfo.componentStack,
        errorBoundary: 'AppErrorBoundary',
      },
      {
        correlationId: this.state.errorId || undefined,
        route: typeof window !== 'undefined' ? window.location.pathname : undefined,
      }
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <AppErrorFallback
          error={this.state.error}
          errorId={this.state.errorId}
          retryCount={this.state.retryCount}
          onRetry={this.resetErrorBoundary}
          onReload={() => window.location.reload()}
          onHome={() => window.location.href = '/'}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Application-level error fallback UI
 */
interface AppErrorFallbackProps {
  error: Error | null;
  errorId: string | null;
  retryCount: number;
  onRetry: () => void;
  onReload: () => void;
  onHome: () => void;
}

const AppErrorFallback: React.FC<AppErrorFallbackProps> = ({
  error,
  errorId,
  retryCount,
  onRetry,
  onReload,
  onHome,
}) => {
  // Get user-friendly error information
  const errorReference = error ? ErrorReferenceService.getReference('SYS-001') : null;
  const userErrorMessage = errorReference 
    ? ErrorReferenceService.generateUserMessage(error as any)
    : {
        referenceCode: errorId || 'SYS-001',
        title: 'Application Error',
        message: 'The application encountered an unexpected error',
        actions: ['Try refreshing the page', 'Contact support'],
      };

  const copyErrorReport = async () => {
    const report = {
      errorId: userErrorMessage.referenceCode,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : null,
      supportUrl: userErrorMessage.supportUrl,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      alert('Error report copied to clipboard');
    } catch (err) {
      console.error('Failed to copy error report:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 text-white p-6 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-red-700 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">{userErrorMessage.title}</h1>
          <p className="text-red-100">
            {userErrorMessage.message}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-gray-700 text-lg mb-4">
              We're sorry, but something went wrong. The error has been logged and our team has been notified.
            </p>
            
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Error Reference:</strong>
              </p>
              <code className="text-sm font-mono bg-white px-3 py-1 rounded border">
                {userErrorMessage.referenceCode}
              </code>
              <p className="text-xs text-gray-500 mt-2">
                Please include this reference when contacting support
              </p>
              {userErrorMessage.supportUrl && (
                <a 
                  href={userErrorMessage.supportUrl}
                  className="text-blue-600 hover:underline text-sm mt-2 inline-block"
                >
                  View troubleshooting guide →
                </a>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={onRetry}
              disabled={retryCount >= 2}
              className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {retryCount >= 2 ? 'Max Retries Reached' : 'Try Again'}
            </button>
            
            <button
              onClick={onReload}
              className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reload Page
            </button>
            
            <button
              onClick={onHome}
              className="flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Go Home
            </button>
            
            <button
              onClick={copyErrorReport}
              className="flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Copy Error Report
            </button>
          </div>

          {/* Help Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Need Help?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Suggested Solutions:</h4>
                <ul className="space-y-1 text-gray-600">
                  {userErrorMessage.actions.map((action, index) => (
                    <li key={index}>• {action}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Get Support:</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• <a href="/support" className="text-blue-600 hover:underline">Contact Support</a></li>
                  <li>• <a href="/docs" className="text-blue-600 hover:underline">Documentation</a></li>
                  <li>• <a href="/status" className="text-blue-600 hover:underline">System Status</a></li>
                  <li>• Email: support@azurechat.com</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 text-center">
          <p className="text-xs text-gray-500">
            This error has been automatically reported to our team.
            We apologize for the inconvenience and are working to fix it.
          </p>
        </div>

        {/* Development Error Details */}
        {process.env.NODE_ENV === 'development' && error && (
          <div className="bg-red-50 border-t border-red-200 p-4">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-red-800 hover:text-red-900">
                🛠️ Development Error Details
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <h5 className="text-sm font-medium text-red-800">Error Message:</h5>
                  <pre className="text-xs bg-red-100 p-2 rounded mt-1 overflow-auto">
                    {error.message}
                  </pre>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-red-800">Stack Trace:</h5>
                  <pre className="text-xs bg-red-100 p-2 rounded mt-1 overflow-auto max-h-48">
                    {error.stack}
                  </pre>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};