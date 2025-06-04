// ABOUTME: Health check service for monitoring application and dependency health
// ABOUTME: Provides endpoints for readiness, liveness, and dependency status

import { openAIService } from '../services/openai-service';
import { cosmosService } from '../services/cosmos-service';
import { ErrorSerializer } from '../errors';

/**
 * Health status levels
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  duration: number;
  details?: Record<string, any>;
  error?: string;
}

/**
 * Overall system health
 */
export interface SystemHealth {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime: number;
  dependencies: Record<string, HealthCheckResult>;
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
}

/**
 * Dependency health checker interface
 */
export interface HealthChecker {
  name: string;
  check(): Promise<HealthCheckResult>;
  critical: boolean; // Whether this dependency is critical for system health
}

/**
 * Health service for monitoring system status
 */
export class HealthService {
  private checkers: Map<string, HealthChecker> = new Map();
  private startTime = Date.now();

  constructor() {
    this.registerDefaultCheckers();
  }

  /**
   * Register default health checkers
   */
  private registerDefaultCheckers() {
    // OpenAI service health checker
    this.registerChecker({
      name: 'openai',
      critical: true,
      check: async (): Promise<HealthCheckResult> => {
        const startTime = Date.now();
        try {
          const healthStatus = await openAIService.getHealthStatus();
          return {
            status: this.mapServiceStatus(healthStatus.status),
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            details: {
              circuitBreakerState: healthStatus.circuitBreakerState,
              responseTime: healthStatus.responseTime,
            },
          };
        } catch (error: any) {
          return {
            status: HealthStatus.UNHEALTHY,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            error: error.message,
          };
        }
      },
    });

    // Cosmos DB health checker
    this.registerChecker({
      name: 'cosmos',
      critical: true,
      check: async (): Promise<HealthCheckResult> => {
        const startTime = Date.now();
        try {
          const healthStatus = await cosmosService.getHealthStatus();
          return {
            status: this.mapServiceStatus(healthStatus.status),
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            details: {
              historyContainer: healthStatus.historyContainer,
              configContainer: healthStatus.configContainer,
              responseTime: healthStatus.responseTime,
            },
          };
        } catch (error: any) {
          return {
            status: HealthStatus.UNHEALTHY,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            error: error.message,
          };
        }
      },
    });

    // Memory health checker
    this.registerChecker({
      name: 'memory',
      critical: false,
      check: async (): Promise<HealthCheckResult> => {
        const startTime = Date.now();
        try {
          const memUsage = process.memoryUsage();
          const totalMem = memUsage.heapTotal;
          const usedMem = memUsage.heapUsed;
          const memoryUsagePercent = (usedMem / totalMem) * 100;

          let status = HealthStatus.HEALTHY;
          if (memoryUsagePercent > 85) {
            status = HealthStatus.UNHEALTHY;
          } else if (memoryUsagePercent > 70) {
            status = HealthStatus.DEGRADED;
          }

          return {
            status,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            details: {
              heapUsed: Math.round(usedMem / 1024 / 1024),
              heapTotal: Math.round(totalMem / 1024 / 1024),
              usagePercent: Math.round(memoryUsagePercent),
              external: Math.round(memUsage.external / 1024 / 1024),
              rss: Math.round(memUsage.rss / 1024 / 1024),
            },
          };
        } catch (error: any) {
          return {
            status: HealthStatus.UNHEALTHY,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            error: error.message,
          };
        }
      },
    });

    // Environment health checker
    this.registerChecker({
      name: 'environment',
      critical: true,
      check: async (): Promise<HealthCheckResult> => {
        const startTime = Date.now();
        try {
          const requiredEnvVars = [
            'AZURE_OPENAI_API_INSTANCE_NAME',
            'AZURE_OPENAI_API_DEPLOYMENT_NAME',
            'AZURE_COSMOSDB_URI',
            'NEXTAUTH_SECRET',
          ];

          const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
          
          const status = missing.length === 0 ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;

          return {
            status,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            details: {
              requiredVariables: requiredEnvVars.length,
              configured: requiredEnvVars.length - missing.length,
              missing: missing,
              nodeEnv: process.env.NODE_ENV,
              useManagedIdentities: process.env.USE_MANAGED_IDENTITIES === 'true',
            },
            error: missing.length > 0 ? `Missing required environment variables: ${missing.join(', ')}` : undefined,
          };
        } catch (error: any) {
          return {
            status: HealthStatus.UNHEALTHY,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            error: error.message,
          };
        }
      },
    });
  }

  /**
   * Register a custom health checker
   */
  public registerChecker(checker: HealthChecker) {
    this.checkers.set(checker.name, checker);
  }

  /**
   * Remove a health checker
   */
  public unregisterChecker(name: string) {
    this.checkers.delete(name);
  }

  /**
   * Get overall system health
   */
  public async getSystemHealth(): Promise<SystemHealth> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;

    // Run all health checks in parallel
    const checkPromises = Array.from(this.checkers.entries()).map(async ([name, checker]) => {
      try {
        const result = await Promise.race([
          checker.check(),
          this.createTimeoutPromise(5000), // 5 second timeout for health checks
        ]);
        return [name, result] as [string, HealthCheckResult];
      } catch (error: any) {
        return [name, {
          status: HealthStatus.UNHEALTHY,
          timestamp: new Date().toISOString(),
          duration: 5000,
          error: `Health check timeout or error: ${error.message}`,
        }] as [string, HealthCheckResult];
      }
    });

    const checkResults = await Promise.all(checkPromises);
    const dependencies = Object.fromEntries(checkResults);

    // Calculate summary
    const summary = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      total: checkResults.length,
    };

    let systemStatus = HealthStatus.HEALTHY;

    for (const [name, result] of checkResults) {
      const checker = this.checkers.get(name);
      
      switch (result.status) {
        case HealthStatus.HEALTHY:
          summary.healthy++;
          break;
        case HealthStatus.DEGRADED:
          summary.degraded++;
          if (systemStatus === HealthStatus.HEALTHY) {
            systemStatus = HealthStatus.DEGRADED;
          }
          break;
        case HealthStatus.UNHEALTHY:
          summary.unhealthy++;
          if (checker?.critical) {
            systemStatus = HealthStatus.UNHEALTHY;
          } else if (systemStatus === HealthStatus.HEALTHY) {
            systemStatus = HealthStatus.DEGRADED;
          }
          break;
      }
    }

    return {
      status: systemStatus,
      timestamp,
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.round(uptime / 1000), // Convert to seconds
      dependencies,
      summary,
    };
  }

  /**
   * Get readiness check (for Kubernetes readiness probe)
   */
  public async getReadiness(): Promise<{ ready: boolean; checks: Record<string, boolean> }> {
    const systemHealth = await this.getSystemHealth();
    
    const checks: Record<string, boolean> = {};
    let ready = true;

    for (const [name, result] of Object.entries(systemHealth.dependencies)) {
      const checker = this.checkers.get(name);
      const isHealthy = result.status === HealthStatus.HEALTHY;
      checks[name] = isHealthy;
      
      // Only critical services affect readiness
      if (checker?.critical && !isHealthy) {
        ready = false;
      }
    }

    return { ready, checks };
  }

  /**
   * Get liveness check (for Kubernetes liveness probe)
   */
  public async getLiveness(): Promise<{ alive: boolean; uptime: number }> {
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    
    // Simple liveness check - if we can respond, we're alive
    return {
      alive: true,
      uptime,
    };
  }

  /**
   * Get specific dependency health
   */
  public async getDependencyHealth(name: string): Promise<HealthCheckResult | null> {
    const checker = this.checkers.get(name);
    if (!checker) {
      return null;
    }

    try {
      return await checker.check();
    } catch (error: any) {
      return {
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date().toISOString(),
        duration: 0,
        error: error.message,
      };
    }
  }

  /**
   * Map service status to health status
   */
  private mapServiceStatus(status: string): HealthStatus {
    switch (status) {
      case 'healthy':
        return HealthStatus.HEALTHY;
      case 'degraded':
        return HealthStatus.DEGRADED;
      case 'unhealthy':
        return HealthStatus.UNHEALTHY;
      default:
        return HealthStatus.UNHEALTHY;
    }
  }

  /**
   * Create timeout promise for health checks
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Health check timeout'));
      }, timeoutMs);
    });
  }

  /**
   * Get list of registered checkers
   */
  public getRegisteredCheckers(): Array<{ name: string; critical: boolean }> {
    return Array.from(this.checkers.values()).map(checker => ({
      name: checker.name,
      critical: checker.critical,
    }));
  }
}

/**
 * Global health service instance
 */
export const healthService = new HealthService();