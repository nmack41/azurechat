// ABOUTME: React hooks for correlation ID management in client components
// ABOUTME: Provides correlation context and fetch helpers for distributed tracing

'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { 
  generateCorrelationId, 
  fetchWithCorrelation,
  CORRELATION_ID_HEADER 
} from './correlation-middleware';

/**
 * Correlation context interface
 */
interface CorrelationContextValue {
  correlationId: string;
  refreshCorrelationId: () => void;
  fetchWithId: (url: string, options?: RequestInit) => Promise<Response>;
}

/**
 * Correlation context
 */
const CorrelationContext = createContext<CorrelationContextValue | null>(null);

/**
 * Correlation provider component
 */
interface CorrelationProviderProps {
  children: React.ReactNode;
  initialCorrelationId?: string;
}

export function CorrelationProvider({ 
  children, 
  initialCorrelationId 
}: CorrelationProviderProps) {
  const [correlationId, setCorrelationId] = useState<string>(
    initialCorrelationId || generateCorrelationId()
  );

  const refreshCorrelationId = () => {
    setCorrelationId(generateCorrelationId());
  };

  const fetchWithId = (url: string, options: RequestInit = {}) => {
    return fetchWithCorrelation(url, options, correlationId);
  };

  const value: CorrelationContextValue = {
    correlationId,
    refreshCorrelationId,
    fetchWithId,
  };

  return (
    <CorrelationContext.Provider value={value}>
      {children}
    </CorrelationContext.Provider>
  );
}

/**
 * Hook to access correlation ID and utilities
 */
export function useCorrelation(): CorrelationContextValue {
  const context = useContext(CorrelationContext);
  
  if (!context) {
    throw new Error('useCorrelation must be used within a CorrelationProvider');
  }
  
  return context;
}

/**
 * Hook to get just the correlation ID
 */
export function useCorrelationId(): string {
  const { correlationId } = useCorrelation();
  return correlationId;
}

/**
 * Hook for making API calls with correlation ID
 */
export function useCorrelatedFetch() {
  const { fetchWithId } = useCorrelation();
  return fetchWithId;
}

/**
 * Hook to extract correlation ID from response headers
 */
export function useExtractCorrelationId() {
  return (response: Response): string | null => {
    return response.headers.get(CORRELATION_ID_HEADER);
  };
}

/**
 * Error boundary that captures correlation ID
 */
interface CorrelationErrorInfo {
  correlationId?: string;
  timestamp: string;
  componentStack?: string;
}

export function useErrorWithCorrelation() {
  const { correlationId } = useCorrelation();
  
  return (error: Error, errorInfo?: any): CorrelationErrorInfo => {
    return {
      correlationId,
      timestamp: new Date().toISOString(),
      componentStack: errorInfo?.componentStack,
    };
  };
}

/**
 * Performance monitoring with correlation ID
 */
export function usePerformanceTracking() {
  const { correlationId } = useCorrelation();

  const startTimer = (operationName: string) => {
    const startTime = performance.now();
    
    return {
      end: () => {
        const duration = performance.now() - startTime;
        
        console.log('Performance metric:', {
          correlationId,
          operation: operationName,
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        });
        
        return duration;
      },
    };
  };

  return { startTimer };
}

/**
 * Debug logging with correlation ID
 */
export function useCorrelatedLogging() {
  const { correlationId } = useCorrelation();

  const log = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const logData = {
      correlationId,
      timestamp: new Date().toISOString(),
      message,
      ...data,
    };

    switch (level) {
      case 'error':
        console.error(logData);
        break;
      case 'warn':
        console.warn(logData);
        break;
      default:
        console.log(logData);
        break;
    }
  };

  return {
    info: (message: string, data?: any) => log('info', message, data),
    warn: (message: string, data?: any) => log('warn', message, data),
    error: (message: string, data?: any) => log('error', message, data),
  };
}

/**
 * Session storage for correlation ID persistence
 */
export function usePersistedCorrelationId() {
  const [correlationId, setCorrelationId] = useState<string>('');

  useEffect(() => {
    // Try to get from session storage on mount
    const stored = sessionStorage.getItem('correlation-id');
    if (stored) {
      setCorrelationId(stored);
    } else {
      const newId = generateCorrelationId();
      setCorrelationId(newId);
      sessionStorage.setItem('correlation-id', newId);
    }
  }, []);

  const refreshAndPersist = () => {
    const newId = generateCorrelationId();
    setCorrelationId(newId);
    sessionStorage.setItem('correlation-id', newId);
  };

  return {
    correlationId,
    refresh: refreshAndPersist,
  };
}