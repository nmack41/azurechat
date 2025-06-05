// ABOUTME: Health check API endpoint for monitoring system status
// ABOUTME: Provides comprehensive health information for all dependencies

import { NextRequest, NextResponse } from 'next/server';
import { healthService } from '@/observability/health-service';
import { ErrorSerializer } from '@/errors';

/**
 * GET /api/health - Get overall system health
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const health = await healthService.getSystemHealth();
    
    // Set appropriate HTTP status based on health status
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    return NextResponse.json(health, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error: unknown) {
    console.error('Health check failed:', ErrorSerializer.serialize(error));
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      dependencies: {},
      summary: {
        healthy: 0,
        degraded: 0,
        unhealthy: 1,
        total: 1,
      },
    }, { status: 503 });
  }
}