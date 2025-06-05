// ABOUTME: Custom 404 Not Found page with helpful navigation and support options
// ABOUTME: Provides user-friendly error handling for missing pages with recovery actions

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/features/ui/button";
import { Card } from "@/features/ui/card";
import { appInsights } from "@/features/common/observability/app-insights";
import { logger } from "@/features/common/observability/logger";

export default function NotFound() {
  useEffect(() => {
    // Log 404 error for analytics
    logger.warn('404 Page Not Found', {
      url: window.location.href,
      pathname: window.location.pathname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
    });

    // Track 404 in Application Insights
    if (appInsights.isReady()) {
      appInsights.trackEvent('PageNotFound', {
        url: window.location.href,
        pathname: window.location.pathname,
        referrer: document.referrer,
      });
    }
  }, []);

  const handleGoHome = () => {
    // Track user action
    if (appInsights.isReady()) {
      appInsights.trackEvent('404Recovery', {
        action: 'go_home',
        fromUrl: window.location.href,
      });
    }
  };

  const handleGoBack = () => {
    // Track user action
    if (appInsights.isReady()) {
      appInsights.trackEvent('404Recovery', {
        action: 'go_back',
        fromUrl: window.location.href,
      });
    }
    
    // Go back if possible, otherwise go home
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  const handleReportIssue = () => {
    // Track user action
    if (appInsights.isReady()) {
      appInsights.trackEvent('404Recovery', {
        action: 'report_issue',
        fromUrl: window.location.href,
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg w-full">
        <Card className="p-8 text-center">
          {/* Error Icon */}
          <div className="mb-6">
            <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.485 0-4.693-1.134-6.154-2.91m0 0A7.962 7.962 0 014 12c0-2.137.84-4.146 2.291-5.729m0 0A7.962 7.962 0 0112 4c2.485 0 4.693 1.134 6.154 2.91m0 0A7.962 7.962 0 0120 12a7.962 7.962 0 01-2.291 5.729"
                />
              </svg>
            </div>
          </div>

          {/* Error Content */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Page Not Found
            </h1>
            <p className="text-gray-600 mb-4">
              Sorry, we couldn't find the page you're looking for. The page may have been moved, deleted, or the URL might be incorrect.
            </p>
            <div className="text-sm text-gray-500 bg-gray-100 rounded-lg p-3 mb-6">
              <strong>Reference Code:</strong> NET-404
              <br />
              <strong>URL:</strong> {typeof window !== 'undefined' ? window.location.pathname : ''}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link href="/" onClick={handleGoHome}>
              <Button className="w-full" size="lg">
                Go to Home Page
              </Button>
            </Link>
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleGoBack}
            >
              Go Back
            </Button>

            <div className="flex space-x-3">
              <Link href="/chat" className="flex-1">
                <Button variant="ghost" className="w-full">
                  Start New Chat
                </Button>
              </Link>
              
              <a
                href="mailto:support@example.com?subject=Page Not Found - NET-404&body=I couldn't find the page at: "
                onClick={handleReportIssue}
                className="flex-1"
              >
                <Button variant="ghost" className="w-full">
                  Report Issue
                </Button>
              </a>
            </div>
          </div>

          {/* Helpful Links */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-3">You might be looking for:</p>
            <div className="space-y-2">
              <Link 
                href="/chat"
                className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Chat Interface
              </Link>
              <Link 
                href="/persona"
                className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                AI Personas
              </Link>
              <Link 
                href="/extensions"
                className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Extensions
              </Link>
              <Link 
                href="/prompt"
                className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Prompt Library
              </Link>
            </div>
          </div>

          {/* Status Information */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              If you continue to experience issues, please check our{" "}
              <a 
                href="/status" 
                className="text-blue-500 hover:text-blue-700 underline"
              >
                status page
              </a>{" "}
              or contact support.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}