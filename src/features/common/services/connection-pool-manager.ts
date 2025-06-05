// ABOUTME: Advanced connection pool manager for Cosmos DB with health monitoring
// ABOUTME: Provides connection pooling, circuit breaker, and automatic failover capabilities

import { CosmosClient, Container } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { performanceMonitor } from "../observability/performance-monitor";
import { logger } from "../observability/logger";

interface ConnectionPoolConfig {
  maxPoolSize: number;
  minPoolSize: number;
  connectionTimeout: number;
  requestTimeout: number;
  maxRetries: number;
  retryDelay: number;
  healthCheckInterval: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  enableTelemetry: boolean;
}

interface ConnectionHealth {
  isHealthy: boolean;
  lastChecked: number;
  consecutiveFailures: number;
  averageLatency: number;
  requestCount: number;
}

interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  failedConnections: number;
  averageLatency: number;
  requestsPerSecond: number;
  circuitBreakerOpen: boolean;
}

const DEFAULT_CONFIG: ConnectionPoolConfig = {
  maxPoolSize: 10,
  minPoolSize: 2,
  connectionTimeout: 10000,
  requestTimeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  healthCheckInterval: 30000,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000,
  enableTelemetry: true,
};

/**
 * Connection pool entry with health tracking
 */
class PooledConnection {
  public client: CosmosClient;
  public health: ConnectionHealth;
  public createdAt: number;
  public lastUsed: number;
  public isActive: boolean;

  constructor(client: CosmosClient) {
    this.client = client;
    this.createdAt = Date.now();
    this.lastUsed = Date.now();
    this.isActive = false;
    this.health = {
      isHealthy: true,
      lastChecked: Date.now(),
      consecutiveFailures: 0,
      averageLatency: 0,
      requestCount: 0,
    };
  }

  /**
   * Mark connection as used
   */
  public markUsed() {
    this.lastUsed = Date.now();
    this.isActive = true;
  }

  /**
   * Release connection back to pool
   */
  public release() {
    this.isActive = false;
  }

  /**
   * Update health metrics
   */
  public updateHealth(isHealthy: boolean, latency: number) {
    this.health.lastChecked = Date.now();
    this.health.requestCount++;
    
    if (isHealthy) {
      this.health.consecutiveFailures = 0;
      this.health.isHealthy = true;
      
      // Update average latency with exponential smoothing
      const alpha = 0.3;
      this.health.averageLatency = 
        alpha * latency + (1 - alpha) * this.health.averageLatency;
    } else {
      this.health.consecutiveFailures++;
      if (this.health.consecutiveFailures >= 3) {
        this.health.isHealthy = false;
      }
    }
  }
}

/**
 * Advanced connection pool manager with circuit breaker pattern
 */
export class ConnectionPoolManager {
  private config: ConnectionPoolConfig;
  private pool: PooledConnection[] = [];
  private circuitBreakerOpen = false;
  private circuitBreakerOpenedAt = 0;
  private healthCheckTimer?: NodeJS.Timeout;
  private statsTimer?: NodeJS.Timeout;
  private requestStats = {
    totalRequests: 0,
    failedRequests: 0,
    requestTimes: [] as number[],
  };

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializePool();
    this.startHealthChecks();
    this.startStatsCollection();
  }

  /**
   * Initialize connection pool with minimum connections
   */
  private async initializePool() {
    try {
      for (let i = 0; i < this.config.minPoolSize; i++) {
        const client = this.createClient();
        const connection = new PooledConnection(client);
        this.pool.push(connection);
      }
      
      logger.info('Connection pool initialized', {
        minPoolSize: this.config.minPoolSize,
        maxPoolSize: this.config.maxPoolSize,
      });
    } catch (error) {
      logger.error('Failed to initialize connection pool', { error });
      throw error;
    }
  }

  /**
   * Create a new Cosmos DB client
   */
  private createClient(): CosmosClient {
    const endpoint = process.env.AZURE_COSMOSDB_URI;
    if (!endpoint) {
      throw new Error("Azure Cosmos DB endpoint is not configured");
    }

    const useManaged = process.env.USE_MANAGED_IDENTITIES === "true";
    
    const clientConfig = {
      endpoint,
      connectionPolicy: {
        enableEndpointDiscovery: true,
        preferredLocations: this.getPreferredLocations(),
        connectionMode: "Gateway" as const,
        requestTimeout: this.config.requestTimeout,
        enableAutomaticFailover: true,
        maxRetries: this.config.maxRetries,
        retryAfter: this.config.retryDelay,
        enableTcpConnectionEndpointRediscovery: true,
        maxConnectionPoolSize: Math.ceil(this.config.maxPoolSize / 2),
      },
      plugins: this.config.enableTelemetry ? [this.createTelemetryPlugin()] : undefined,
    };

    if (useManaged) {
      return new CosmosClient({
        ...clientConfig,
        aadCredentials: new DefaultAzureCredential(),
      });
    } else {
      const key = process.env.AZURE_COSMOSDB_KEY;
      if (!key) {
        throw new Error("Azure Cosmos DB key is not provided");
      }
      return new CosmosClient({
        ...clientConfig,
        key,
      });
    }
  }

  /**
   * Get preferred Azure regions
   */
  private getPreferredLocations(): string[] {
    const region = process.env.AZURE_REGION || "East US";
    const secondaryRegion = process.env.AZURE_SECONDARY_REGION;
    
    return secondaryRegion ? [region, secondaryRegion] : [region];
  }

  /**
   * Create telemetry plugin for performance monitoring
   */
  private createTelemetryPlugin() {
    return {
      on: (event: any) => {
        if (event.eventName === 'request') {
          this.requestStats.totalRequests++;
          this.requestStats.requestTimes.push(Date.now());
          
          if (event.response?.statusCode && event.response.statusCode >= 400) {
            this.requestStats.failedRequests++;
          }
        }
      },
    };
  }

  /**
   * Get a connection from the pool
   */
  public async getConnection(): Promise<PooledConnection> {
    // Check circuit breaker
    if (this.circuitBreakerOpen) {
      if (Date.now() - this.circuitBreakerOpenedAt > this.config.circuitBreakerTimeout) {
        this.circuitBreakerOpen = false;
        logger.info('Circuit breaker closed, resuming normal operation');
      } else {
        throw new Error('Circuit breaker is open - too many failures');
      }
    }

    const measurement = performanceMonitor.startMeasurement('connection_pool_get');

    try {
      // Find an available healthy connection
      let connection = this.pool.find(
        conn => !conn.isActive && conn.health.isHealthy
      );

      if (!connection) {
        // Try to create a new connection if under max pool size
        if (this.pool.length < this.config.maxPoolSize) {
          const client = this.createClient();
          connection = new PooledConnection(client);
          this.pool.push(connection);
          
          logger.info('Created new pooled connection', {
            poolSize: this.pool.length,
            maxPoolSize: this.config.maxPoolSize,
          });
        } else {
          // Wait for a connection to become available or use any available connection
          connection = this.pool.find(conn => !conn.isActive);
          
          if (!connection) {
            throw new Error('No connections available in pool');
          }
        }
      }

      connection.markUsed();
      measurement.finish(true, {
        poolSize: this.pool.length,
        activeConnections: this.pool.filter(c => c.isActive).length,
      });

      return connection;
    } catch (error) {
      measurement.finish(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Return a connection to the pool
   */
  public releaseConnection(connection: PooledConnection) {
    connection.release();
    
    // Remove unhealthy connections from pool
    if (!connection.health.isHealthy && this.pool.length > this.config.minPoolSize) {
      this.removeConnection(connection);
    }
  }

  /**
   * Execute operation with automatic connection management
   */
  public async executeWithConnection<T>(
    operation: (client: CosmosClient) => Promise<T>
  ): Promise<T> {
    const connection = await this.getConnection();
    const startTime = performance.now();

    try {
      const result = await operation(connection.client);
      const latency = performance.now() - startTime;
      
      connection.updateHealth(true, latency);
      return result;
    } catch (error) {
      const latency = performance.now() - startTime;
      connection.updateHealth(false, latency);
      
      // Update circuit breaker
      this.updateCircuitBreaker(false);
      
      throw error;
    } finally {
      this.releaseConnection(connection);
    }
  }

  /**
   * Get connection pool statistics
   */
  public getStats(): ConnectionStats {
    const activeConnections = this.pool.filter(c => c.isActive).length;
    const healthyConnections = this.pool.filter(c => c.health.isHealthy).length;
    const totalLatency = this.pool.reduce((sum, c) => sum + c.health.averageLatency, 0);
    const averageLatency = this.pool.length > 0 ? totalLatency / this.pool.length : 0;
    
    // Calculate requests per second
    const now = Date.now();
    const recentRequests = this.requestStats.requestTimes.filter(
      time => now - time < 1000
    ).length;

    return {
      totalConnections: this.pool.length,
      activeConnections,
      idleConnections: this.pool.length - activeConnections,
      failedConnections: this.pool.length - healthyConnections,
      averageLatency,
      requestsPerSecond: recentRequests,
      circuitBreakerOpen: this.circuitBreakerOpen,
    };
  }

  /**
   * Remove a connection from the pool
   */
  private removeConnection(connection: PooledConnection) {
    const index = this.pool.indexOf(connection);
    if (index > -1) {
      this.pool.splice(index, 1);
      logger.info('Removed unhealthy connection from pool', {
        poolSize: this.pool.length,
      });
    }
  }

  /**
   * Update circuit breaker state
   */
  private updateCircuitBreaker(success: boolean) {
    if (!success) {
      const recentFailures = this.pool.reduce(
        (sum, conn) => sum + conn.health.consecutiveFailures,
        0
      );
      
      if (recentFailures >= this.config.circuitBreakerThreshold && !this.circuitBreakerOpen) {
        this.circuitBreakerOpen = true;
        this.circuitBreakerOpenedAt = Date.now();
        
        logger.error('Circuit breaker opened due to failures', {
          failures: recentFailures,
          threshold: this.config.circuitBreakerThreshold,
        });
      }
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health checks on all connections
   */
  private async performHealthChecks() {
    const healthPromises = this.pool.map(async (connection) => {
      if (connection.isActive) return; // Skip active connections

      try {
        const startTime = performance.now();
        
        // Simple health check - get database info
        await connection.client.getDatabaseAccount();
        
        const latency = performance.now() - startTime;
        connection.updateHealth(true, latency);
      } catch (error) {
        connection.updateHealth(false, 0);
        logger.warn('Connection health check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.allSettled(healthPromises);

    // Remove excess unhealthy connections
    const unhealthyConnections = this.pool.filter(c => !c.health.isHealthy);
    if (unhealthyConnections.length > 0 && this.pool.length > this.config.minPoolSize) {
      const toRemove = Math.min(
        unhealthyConnections.length,
        this.pool.length - this.config.minPoolSize
      );
      
      for (let i = 0; i < toRemove; i++) {
        this.removeConnection(unhealthyConnections[i]);
      }
    }

    // Add connections if below minimum
    while (this.pool.length < this.config.minPoolSize) {
      try {
        const client = this.createClient();
        const connection = new PooledConnection(client);
        this.pool.push(connection);
      } catch (error) {
        logger.error('Failed to create replacement connection', { error });
        break;
      }
    }
  }

  /**
   * Start statistics collection
   */
  private startStatsCollection() {
    this.statsTimer = setInterval(() => {
      // Clean old request times
      const cutoff = Date.now() - 60000; // Keep 1 minute of data
      this.requestStats.requestTimes = this.requestStats.requestTimes.filter(
        time => time > cutoff
      );
    }, 10000); // Clean every 10 seconds
  }

  /**
   * Gracefully shutdown the connection pool
   */
  public async shutdown() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
    }

    // Wait for active connections to finish (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.pool.some(c => c.isActive) && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.pool.length = 0;
    logger.info('Connection pool shutdown complete');
  }
}

// Export singleton instance
export const connectionPoolManager = new ConnectionPoolManager();

// Export types
export type { ConnectionPoolConfig, ConnectionStats, PooledConnection };