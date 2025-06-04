// ABOUTME: Error boundary exports for React error handling
// ABOUTME: Provides components and utilities for UI crash protection

export {
  BaseErrorBoundary,
  type ErrorBoundaryProps,
} from './base-error-boundary';

export {
  ChatErrorBoundary,
  withChatErrorBoundary,
  useErrorHandler,
} from './chat-error-boundary';

export {
  AppErrorBoundary,
} from './app-error-boundary';