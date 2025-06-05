// ABOUTME: Readiness probe endpoint for Kubernetes deployment
// ABOUTME: Checks if application is ready to receive traffic

import { NextRequest, NextResponse } from 'next/server';
import { healthService } from '@/observability/health-service';
import { ErrorSerializer } from '@/errors';

/**
 * GET /api/ready - Readiness probe for Kubernetes
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const readiness = await healthService.getReadiness();
    
    return NextResponse.json(readiness, { 
      status: readiness.ready ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error: unknown) {
    console.error('Readiness check failed:', ErrorSerializer.serialize(error));
    
    return NextResponse.json({
      ready: false,
      checks: {},
      error: 'Readiness check failed',
    }, { status: 503 });
  }
}