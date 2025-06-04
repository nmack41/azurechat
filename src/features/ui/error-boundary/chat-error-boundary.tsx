// ABOUTME: Chat-specific error boundary with custom fallback UI
// ABOUTME: Handles chat interface crashes with context-aware recovery options

'use client';

import React from 'react';
import { BaseErrorBoundary, ErrorBoundaryProps } from './base-error-boundary';

/**
 * Chat-specific error boundary with custom fallback
 */
export class ChatErrorBoundary extends BaseErrorBoundary {
  render() {
    if (this.state.hasError) {
      return (
        <ChatErrorFallback
          error={this.state.error}
          errorId={this.state.errorId}
          retryCount={this.state.retryCount}
          onRetry={this.resetErrorBoundary}
          onNewChat={() => this.handleNewChat()}
          onRefresh={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }

  private handleNewChat = () => {
    // Clear chat state and reset error boundary
    if (typeof window !== 'undefined') {
      // Navigate to new chat or clear chat state
      window.location.href = '/chat';
    }
  };
}

/**
 * Chat-specific error fallback UI
 */
interface ChatErrorFallbackProps {
  error: Error | null;
  errorId: string | null;
  retryCount: number;
  onRetry: () => void;
  onNewChat: () => void;
  onRefresh: () => void;
}

const ChatErrorFallback: React.FC<ChatErrorFallbackProps> = ({
  error,
  errorId,
  retryCount,
  onRetry,
  onNewChat,
  onRefresh,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-lg">
      <div className="text-red-600 mb-6">
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      
      <h2 className="text-2xl font-bold text-red-800 mb-3">
        Chat Temporarily Unavailable
      </h2>
      
      <p className="text-red-700 text-center mb-6 max-w-lg">
        Something went wrong with the chat interface. Don't worry - your conversation history is safe.
        Try one of the options below to continue.
      </p>
      
      {errorId && (
        <div className="bg-red-100 px-4 py-2 rounded-lg mb-6">
          <p className="text-sm text-red-800">
            <span className="font-semibold">Error Reference:</span>{' '}
            <code className="font-mono text-xs">{errorId}</code>
          </p>
          <p className="text-xs text-red-600 mt-1">
            Share this reference with support if you need help
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-md">
        <button
          onClick={onRetry}
          disabled={retryCount >= 3}
          className="flex flex-col items-center p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm font-medium">
            {retryCount >= 3 ? 'Max Retries' : 'Try Again'}
          </span>
        </button>
        
        <button
          onClick={onNewChat}
          className="flex flex-col items-center p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="text-sm font-medium">New Chat</span>
        </button>
        
        <button
          onClick={onRefresh}
          className="flex flex-col items-center p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm font-medium">Refresh Page</span>
        </button>
      </div>
      
      <div className="mt-8 text-center">
        <p className="text-sm text-red-600 mb-2">
          Still having trouble?
        </p>
        <a 
          href="/support" 
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Contact Support
        </a>
      </div>

      {process.env.NODE_ENV === 'development' && error && (
        <details className="mt-6 w-full max-w-4xl">
          <summary className="cursor-pointer text-sm text-red-600 hover:text-red-800 mb-2">
            🛠️ Developer Error Details
          </summary>
          <div className="bg-red-100 p-4 rounded border">
            <div className="mb-3">
              <strong className="text-red-800">Error:</strong>
              <pre className="text-xs text-red-700 mt-1 overflow-auto">
                {error.message}
              </pre>
            </div>
            <div>
              <strong className="text-red-800">Stack Trace:</strong>
              <pre className="text-xs text-red-700 mt-1 overflow-auto max-h-40">
                {error.stack}
              </pre>
            </div>
          </div>
        </details>
      )}
    </div>
  );
};

/**
 * Higher-order component to wrap components with ChatErrorBoundary
 */
export function withChatErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
) {
  const WrappedComponent = (props: P) => (
    <ChatErrorBoundary>
      <Component {...props} />
    </ChatErrorBoundary>
  );

  WrappedComponent.displayName = `withChatErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Hook to manually trigger error boundary (useful for async errors)
 */
export function useErrorHandler() {
  return (error: Error, errorInfo?: string) => {
    // This will trigger the nearest error boundary
    throw error;
  };
}