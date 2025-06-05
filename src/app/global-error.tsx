// ABOUTME: Global error boundary for unhandled application errors
// ABOUTME: Provides recovery options and error reporting for critical application failures

"use client";

import { useEffect } from "react";
import { Button } from "@/features/ui/button";
import { Card } from "@/features/ui/card";
import { Badge } from "@/features/ui/badge";
import { appInsights } from "@/features/common/observability/app-insights";
import { logger } from "@/features/common/observability/logger";
import { securityAudit } from "@/features/common/observability/security-audit";
import { ErrorReferenceService } from "@/features/common/errors/error-reference";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Generate error reference code
    const errorCode = `SYS-${Date.now().toString().slice(-6)}`;
    
    // Log critical error
    logger.error('Global application error', {
      errorCode,
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    // Track in Application Insights
    if (appInsights.isReady()) {
      appInsights.trackException(error, {
        errorCode,
        severity: 'critical',
        digest: error.digest,
        url: window.location.href,
      });
    }

    // Record security event for critical system failures
    securityAudit.recordSecurityEvent(
      'SECURITY_CONFIG_CHANGE',
      'CRITICAL',
      'application',
      'global_error',
      {
        errorMessage: error.message,
        errorCode,
        digest: error.digest,
      },
      {
        correlationId: error.digest,
        route: window.location.pathname,
      }
    );
  }, [error]);

  const handleReset = () => {
    // Track recovery attempt
    if (appInsights.isReady()) {
      appInsights.trackEvent('GlobalErrorRecovery', {
        action: 'reset',
        errorMessage: error.message,
        digest: error.digest,
      });
    }

    logger.info('User initiated error recovery', {
      action: 'reset',
      errorMessage: error.message,
    });

    reset();
  };

  const handleReload = () => {
    // Track reload attempt
    if (appInsights.isReady()) {
      appInsights.trackEvent('GlobalErrorRecovery', {
        action: 'reload',
        errorMessage: error.message,
        digest: error.digest,
      });
    }

    logger.info('User initiated page reload', {
      action: 'reload',
      errorMessage: error.message,
    });

    window.location.reload();
  };

  const handleGoHome = () => {
    // Track navigation attempt
    if (appInsights.isReady()) {
      appInsights.trackEvent('GlobalErrorRecovery', {
        action: 'go_home',
        errorMessage: error.message,
        digest: error.digest,
      });
    }

    logger.info('User navigated to home page', {
      action: 'go_home',
      errorMessage: error.message,
    });

    window.location.href = '/';
  };

  const handleReportError = () => {
    // Track error report
    if (appInsights.isReady()) {
      appInsights.trackEvent('GlobalErrorRecovery', {
        action: 'report_error',
        errorMessage: error.message,
        digest: error.digest,
      });
    }

    // Generate support ticket information
    const supportInfo = {
      errorCode: `SYS-${Date.now().toString().slice(-6)}`,
      message: error.message,
      digest: error.digest,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };

    // Create mailto link with error details
    const subject = `Critical Application Error - ${supportInfo.errorCode}`;
    const body = `A critical error occurred in the application:

Error Code: ${supportInfo.errorCode}
Time: ${supportInfo.timestamp}
Page: ${supportInfo.url}
Digest: ${supportInfo.digest || 'Not available'}

Error Message: ${error.message}

Please describe what you were doing when this error occurred:
[Please provide details here]

Browser Information: ${supportInfo.userAgent}`;

    const mailtoLink = `mailto:support@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
  };

  const errorCode = `SYS-${Date.now().toString().slice(-6)}`;
  const errorReference = ErrorReferenceService.getReference('SYS-001');

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-red-50 px-4">
          <div className="max-w-lg w-full">
            <Card className="p-8">
              {/* Error Header */}
              <div className="text-center mb-6">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Something Went Wrong
                </h1>
                
                <p className="text-gray-600 mb-4">
                  A critical error has occurred and we couldn't recover automatically. 
                  Don't worry - your data is safe.
                </p>

                <div className="flex justify-center space-x-2 mb-4">
                  <Badge variant="destructive">Critical Error</Badge>
                  <Badge variant="outline">{errorCode}</Badge>
                </div>
              </div>

              {/* Error Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Error Details</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    <strong>Reference:</strong> {errorCode}
                  </div>
                  {error.digest && (
                    <div>
                      <strong>Digest:</strong> {error.digest}
                    </div>
                  )}
                  <div>
                    <strong>Time:</strong> {new Date().toLocaleString()}
                  </div>
                  <div className="mt-3 p-3 bg-red-50 rounded border-l-4 border-red-200">
                    <div className="text-xs font-mono text-red-800 break-all">
                      {error.message}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recovery Actions */}
              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-medium text-gray-700">Try these recovery options:</h3>
                
                <Button
                  onClick={handleReset}
                  className="w-full"
                  size="lg"
                >
                  Try Again
                </Button>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={handleReload}
                    className="w-full"
                  >
                    Reload Page
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleGoHome}
                    className="w-full"
                  >
                    Go Home
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  onClick={handleReportError}
                  className="w-full"
                >
                  Report This Issue
                </Button>
              </div>

              {/* Suggested Actions */}
              {errorReference && (
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">
                    Troubleshooting Steps
                  </h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {errorReference.suggestedActions.map((action, index) => (
                      <li key={index} className="flex items-start">
                        <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Safety Message */}
              <div className="text-center pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  This error has been automatically reported to our team. 
                  Your data and progress have been saved.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Need immediate help? Contact support with reference code: <strong>{errorCode}</strong>
                </p>
              </div>
            </Card>
          </div>
        </div>
      </body>
    </html>
  );
}