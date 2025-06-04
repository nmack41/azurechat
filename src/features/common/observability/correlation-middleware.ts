// ABOUTME: Correlation ID middleware for request tracing
// ABOUTME: Adds correlation IDs to requests for distributed tracing

import { NextRequest, NextResponse } from 'next/server';
import { ErrorSerializer } from '../errors';

/**
 * Correlation ID header name
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Request context with correlation ID
 */
export interface RequestContext {
  correlationId: string;
  startTime: number;
  method: string;
  url: string;
  userAgent?: string;
  userId?: string;
}

/**
 * Generate a correlation ID
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Extract correlation ID from request headers or generate new one
 */
export function getCorrelationId(request: NextRequest): string {
  const existingId = request.headers.get(CORRELATION_ID_HEADER);
  return existingId || generateCorrelationId();
}

/**
 * Create request context
 */
export function createRequestContext(request: NextRequest): RequestContext {
  return {
    correlationId: getCorrelationId(request),
    startTime: Date.now(),
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('user-agent') || undefined,
    // userId will be added by auth middleware if available
  };
}

/**
 * Add correlation ID to response headers
 */
export function addCorrelationHeaders(response: NextResponse, correlationId: string): NextResponse {
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

/**
 * Log request details with correlation ID
 */
export function logRequest(context: RequestContext, statusCode: number, error?: unknown) {
  const duration = Date.now() - context.startTime;
  
  const logData = {
    correlationId: context.correlationId,
    method: context.method,
    url: context.url,
    statusCode,
    duration,
    userAgent: context.userAgent,
    userId: context.userId,
    timestamp: new Date().toISOString(),
  };

  if (error) {
    console.error('Request failed:', {
      ...logData,
      error: ErrorSerializer.serialize(error),
    });
  } else {
    // Log different levels based on status code
    if (statusCode >= 500) {
      console.error('Server error:', logData);
    } else if (statusCode >= 400) {
      console.warn('Client error:', logData);
    } else {
      console.log('Request completed:', logData);
    }
  }
}

/**
 * Middleware function to add correlation ID and logging
 */
export function withCorrelation<T>(
  handler: (request: NextRequest, context: RequestContext) => Promise<T>
) {
  return async (request: NextRequest): Promise<T> => {
    const context = createRequestContext(request);
    
    try {
      const result = await handler(request, context);
      
      // Log successful request
      if (result instanceof NextResponse) {
        logRequest(context, result.status);
        addCorrelationHeaders(result, context.correlationId);
      }
      
      return result;
      
    } catch (error: unknown) {
      // Log failed request
      logRequest(context, 500, error);
      throw error;
    }
  };
}

/**
 * Express-style middleware for correlation ID
 */
export function correlationMiddleware(request: NextRequest, response: NextResponse): NextResponse {
  const correlationId = getCorrelationId(request);
  return addCorrelationHeaders(response, correlationId);
}

/**
 * React context for correlation ID (client-side)
 */
import { createContext, useContext } from 'react';

const CorrelationContext = createContext<string | null>(null);

export const CorrelationProvider = CorrelationContext.Provider;

export function useCorrelationId(): string | null {
  return useContext(CorrelationContext);
}

/**
 * Fetch wrapper that includes correlation ID
 */
export async function fetchWithCorrelation(
  url: string, 
  options: RequestInit = {},
  correlationId?: string
): Promise<Response> {
  const headers = new Headers(options.headers);
  
  // Add correlation ID if provided or generate new one
  const id = correlationId || generateCorrelationId();
  headers.set(CORRELATION_ID_HEADER, id);
  
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Axios interceptor for correlation ID (if using axios)
 */
export function setupAxiosCorrelation(axiosInstance: any, correlationId?: string) {
  axiosInstance.interceptors.request.use((config: any) => {
    const id = correlationId || generateCorrelationId();
    config.headers[CORRELATION_ID_HEADER] = id;
    return config;
  });

  axiosInstance.interceptors.response.use(
    (response: any) => response,
    (error: any) => {
      const correlationId = error.config?.headers?.[CORRELATION_ID_HEADER];
      if (correlationId) {
        console.error(`Request failed with correlation ID: ${correlationId}`, error);
      }
      return Promise.reject(error);
    }
  );
}

/**
 * WebSocket correlation ID support
 */
export interface WebSocketMessage {
  correlationId?: string;
  type: string;
  payload: any;
}

export function addCorrelationToWebSocketMessage(
  message: Omit<WebSocketMessage, 'correlationId'>,
  correlationId?: string
): WebSocketMessage {
  return {
    ...message,
    correlationId: correlationId || generateCorrelationId(),
  };
}