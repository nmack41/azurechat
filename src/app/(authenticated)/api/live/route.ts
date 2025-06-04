// ABOUTME: Liveness probe endpoint for Kubernetes deployment
// ABOUTME: Simple check to verify application is running

import { NextRequest, NextResponse } from 'next/server';
import { healthService } from '@/features/common/observability/health-service';
import { ErrorSerializer } from '@/features/common/errors';

/**
 * GET /api/live - Liveness probe for Kubernetes
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const liveness = await healthService.getLiveness();
    
    return NextResponse.json(liveness, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error: unknown) {
    console.error('Liveness check failed:', ErrorSerializer.serialize(error));
    
    return NextResponse.json({
      alive: false,
      uptime: 0,
      error: 'Liveness check failed',
    }, { status: 503 });
  }
}