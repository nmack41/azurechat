// ABOUTME: Security audit logging service for tracking security events and compliance
// ABOUTME: Provides encrypted audit trails, authentication tracking, and security incident detection

import crypto from 'crypto';
import { logger } from './logger';
import { appInsights } from './app-insights';

export type SecurityEventType = 
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILURE' 
  | 'AUTH_BYPASS_ATTEMPT'
  | 'PRIVILEGE_ESCALATION'
  | 'SUSPICIOUS_UPLOAD'
  | 'RATE_LIMIT_VIOLATION'
  | 'UNAUTHORIZED_ACCESS'
  | 'DATA_ACCESS'
  | 'ADMIN_ACTION'
  | 'SECURITY_CONFIG_CHANGE'
  | 'PII_ACCESS'
  | 'EXPORT_REQUEST';

export type SecurityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  level: SecurityLevel;
  timestamp: number;
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource: string;
  action: string;
  details: Record<string, any>;
  context: {
    correlationId?: string;
    requestId?: string;
    route?: string;
    method?: string;
  };
  encrypted: boolean;
}

interface AuditConfig {
  enableEncryption: boolean;
  encryptionKey?: string;
  retentionDays: number;
  alertThresholds: {
    failedAuthAttempts: number;
    timeWindowMinutes: number;
    suspiciousUploads: number;
    privilegeEscalations: number;
  };
  enableRealTimeAlerts: boolean;
}

const DEFAULT_CONFIG: AuditConfig = {
  enableEncryption: true,
  retentionDays: 2555, // 7 years for compliance
  alertThresholds: {
    failedAuthAttempts: 5,
    timeWindowMinutes: 15,
    suspiciousUploads: 3,
    privilegeEscalations: 1,
  },
  enableRealTimeAlerts: true,
};

/**
 * Security audit logging service with encryption and real-time alerting
 */
class SecurityAuditService {
  private config: AuditConfig;
  private eventBuffer: SecurityEvent[] = [];
  private encryptionKey: Buffer | null = null;
  private alertCounters = new Map<string, { count: number; firstSeen: number }>();

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeEncryption();
  }

  /**
   * Initialize encryption for audit logs
   */
  private initializeEncryption(): void {
    if (!this.config.enableEncryption) return;

    try {
      const key = this.config.encryptionKey || 
                  process.env.AUDIT_ENCRYPTION_KEY ||
                  process.env.NEXTAUTH_SECRET;

      if (!key) {
        logger.warn('No encryption key provided for audit logs');
        this.config.enableEncryption = false;
        return;
      }

      // Derive a 32-byte key from the provided key
      this.encryptionKey = crypto.scryptSync(key, 'audit-salt', 32);
      
    } catch (error) {
      logger.error('Failed to initialize audit encryption', { error });
      this.config.enableEncryption = false;
    }
  }

  /**
   * Encrypt sensitive audit data
   */
  private encrypt(data: string): string {
    if (!this.config.enableEncryption || !this.encryptionKey) {
      return data;
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      logger.error('Failed to encrypt audit data', { error });
      return '[ENCRYPTION_FAILED]';
    }
  }

  /**
   * Record security event
   */
  public recordSecurityEvent(
    type: SecurityEventType,
    level: SecurityLevel,
    resource: string,
    action: string,
    details: Record<string, any> = {},
    context: {
      userId?: string;
      userEmail?: string;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
      correlationId?: string;
      requestId?: string;
      route?: string;
      method?: string;
    } = {}
  ): string {
    const eventId = this.generateEventId();
    
    const securityEvent: SecurityEvent = {
      id: eventId,
      type,
      level,
      timestamp: Date.now(),
      userId: context.userId,
      userEmail: context.userEmail ? this.redactEmail(context.userEmail) : undefined,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress ? this.redactIpAddress(context.ipAddress) : undefined,
      userAgent: context.userAgent,
      resource,
      action,
      details: this.sanitizeDetails(details),
      context: {
        correlationId: context.correlationId,
        requestId: context.requestId,
        route: context.route,
        method: context.method,
      },
      encrypted: this.config.enableEncryption,
    };

    // Encrypt sensitive fields if encryption is enabled
    if (this.config.enableEncryption) {
      securityEvent.details = {
        ...securityEvent.details,
        _encrypted: this.encrypt(JSON.stringify(securityEvent.details)),
      };
    }

    // Add to buffer
    this.eventBuffer.push(securityEvent);

    // Log the event
    logger.audit('Security event recorded', {
      eventId,
      type,
      level,
      resource,
      action,
      userId: context.userId,
      correlationId: context.correlationId,
    });

    // Track to Application Insights
    if (appInsights.isReady()) {
      appInsights.trackEvent('SecurityEvent', {
        eventId,
        type,
        level,
        resource,
        action,
        encrypted: this.config.enableEncryption,
      });
    }

    // Check for alert conditions
    if (this.config.enableRealTimeAlerts) {
      this.checkAlertConditions(securityEvent);
    }

    // Cleanup old events
    this.cleanupOldEvents();

    return eventId;
  }

  /**
   * Record authentication success
   */
  public recordAuthSuccess(userId: string, context: any = {}): string {
    return this.recordSecurityEvent(
      'AUTH_SUCCESS',
      'LOW',
      'authentication',
      'login',
      { method: context.method || 'unknown' },
      { 
        userId, 
        userEmail: context.userEmail,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        correlationId: context.correlationId,
      }
    );
  }

  /**
   * Record authentication failure
   */
  public recordAuthFailure(reason: string, context: any = {}): string {
    return this.recordSecurityEvent(
      'AUTH_FAILURE',
      'MEDIUM',
      'authentication',
      'failed_login',
      { 
        reason,
        attemptedEmail: context.email ? this.redactEmail(context.email) : undefined,
      },
      { 
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        correlationId: context.correlationId,
      }
    );
  }

  /**
   * Record privilege escalation attempt
   */
  public recordPrivilegeEscalation(
    userId: string,
    attemptedAction: string,
    context: any = {}
  ): string {
    return this.recordSecurityEvent(
      'PRIVILEGE_ESCALATION',
      'HIGH',
      'authorization',
      'privilege_escalation',
      { 
        attemptedAction,
        currentRole: context.role,
        requiredRole: context.requiredRole,
      },
      { 
        userId,
        correlationId: context.correlationId,
        route: context.route,
        method: context.method,
      }
    );
  }

  /**
   * Record suspicious file upload
   */
  public recordSuspiciousUpload(
    userId: string,
    filename: string,
    reason: string,
    context: any = {}
  ): string {
    return this.recordSecurityEvent(
      'SUSPICIOUS_UPLOAD',
      'HIGH',
      'file_upload',
      'blocked_upload',
      { 
        filename: this.sanitizeFilename(filename),
        reason,
        fileSize: context.fileSize,
        mimeType: context.mimeType,
      },
      { 
        userId,
        correlationId: context.correlationId,
      }
    );
  }

  /**
   * Record rate limit violation
   */
  public recordRateLimitViolation(
    identifier: string,
    endpoint: string,
    context: any = {}
  ): string {
    return this.recordSecurityEvent(
      'RATE_LIMIT_VIOLATION',
      'MEDIUM',
      'rate_limiting',
      'limit_exceeded',
      { 
        endpoint,
        requestCount: context.requestCount,
        timeWindow: context.timeWindow,
      },
      { 
        userId: context.userId,
        ipAddress: context.ipAddress,
        correlationId: context.correlationId,
      }
    );
  }

  /**
   * Record admin action
   */
  public recordAdminAction(
    adminUserId: string,
    action: string,
    targetResource: string,
    context: any = {}
  ): string {
    return this.recordSecurityEvent(
      'ADMIN_ACTION',
      'MEDIUM',
      'administration',
      action,
      { 
        targetResource,
        changes: context.changes,
        affectedUsers: context.affectedUsers,
      },
      { 
        userId: adminUserId,
        correlationId: context.correlationId,
      }
    );
  }

  /**
   * Check for alert conditions
   */
  private checkAlertConditions(event: SecurityEvent): void {
    const now = Date.now();
    const windowMs = this.config.alertThresholds.timeWindowMinutes * 60 * 1000;

    // Check failed authentication attempts
    if (event.type === 'AUTH_FAILURE') {
      const key = `auth_failure_${event.ipAddress || 'unknown'}`;
      const counter = this.alertCounters.get(key) || { count: 0, firstSeen: now };
      
      if (now - counter.firstSeen > windowMs) {
        // Reset counter for new time window
        this.alertCounters.set(key, { count: 1, firstSeen: now });
      } else {
        counter.count++;
        this.alertCounters.set(key, counter);
        
        if (counter.count >= this.config.alertThresholds.failedAuthAttempts) {
          this.sendSecurityAlert('Multiple failed authentication attempts', event);
        }
      }
    }

    // Check for privilege escalation
    if (event.type === 'PRIVILEGE_ESCALATION') {
      this.sendSecurityAlert('Privilege escalation attempt detected', event);
    }

    // Check for suspicious uploads
    if (event.type === 'SUSPICIOUS_UPLOAD') {
      const key = `suspicious_upload_${event.userId || 'unknown'}`;
      const counter = this.alertCounters.get(key) || { count: 0, firstSeen: now };
      
      if (now - counter.firstSeen > windowMs) {
        this.alertCounters.set(key, { count: 1, firstSeen: now });
      } else {
        counter.count++;
        this.alertCounters.set(key, counter);
        
        if (counter.count >= this.config.alertThresholds.suspiciousUploads) {
          this.sendSecurityAlert('Multiple suspicious upload attempts', event);
        }
      }
    }
  }

  /**
   * Send security alert
   */
  private sendSecurityAlert(message: string, event: SecurityEvent): void {
    logger.security('SECURITY ALERT', {
      alert: message,
      eventId: event.id,
      eventType: event.type,
      level: event.level,
      userId: event.userId,
      resource: event.resource,
      timestamp: new Date(event.timestamp).toISOString(),
    });

    // Track critical security alert
    if (appInsights.isReady()) {
      appInsights.trackEvent('SecurityAlert', {
        message,
        eventId: event.id,
        eventType: event.type,
        level: event.level,
        severity: 'high',
      });
    }
  }

  /**
   * Get security events for analysis
   */
  public getSecurityEvents(
    filters: {
      type?: SecurityEventType;
      level?: SecurityLevel;
      userId?: string;
      startTime?: number;
      endTime?: number;
      limit?: number;
    } = {}
  ): SecurityEvent[] {
    let filtered = [...this.eventBuffer];

    if (filters.type) {
      filtered = filtered.filter(event => event.type === filters.type);
    }

    if (filters.level) {
      filtered = filtered.filter(event => event.level === filters.level);
    }

    if (filters.userId) {
      filtered = filtered.filter(event => event.userId === filters.userId);
    }

    if (filters.startTime) {
      filtered = filtered.filter(event => event.timestamp >= filters.startTime!);
    }

    if (filters.endTime) {
      filtered = filtered.filter(event => event.timestamp <= filters.endTime!);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  /**
   * Generate audit report
   */
  public generateAuditReport(startTime: number, endTime: number): {
    summary: Record<string, number>;
    events: SecurityEvent[];
    alerts: number;
    highRiskEvents: SecurityEvent[];
  } {
    const events = this.getSecurityEvents({ startTime, endTime });
    
    const summary: Record<string, number> = {};
    let alerts = 0;
    const highRiskEvents: SecurityEvent[] = [];

    events.forEach(event => {
      summary[event.type] = (summary[event.type] || 0) + 1;
      
      if (event.level === 'HIGH' || event.level === 'CRITICAL') {
        highRiskEvents.push(event);
        alerts++;
      }
    });

    return {
      summary,
      events,
      alerts,
      highRiskEvents,
    };
  }

  /**
   * Helper methods
   */
  private generateEventId(): string {
    return `sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private redactEmail(email: string): string {
    const [local, domain] = email.split('@');
    const redactedLocal = local.length > 2 
      ? `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`
      : '***';
    return `${redactedLocal}@${domain}`;
  }

  private redactIpAddress(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.***`;
    }
    return '***.***.***';
  }

  private sanitizeFilename(filename: string): string {
    // Remove potential path traversal attempts and limit length
    return filename.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 100);
  }

  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(details)) {
      if (typeof value === 'string') {
        // Limit string length and remove potential injection attempts
        sanitized[key] = value.substring(0, 1000).replace(/[<>]/g, '');
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (value && typeof value === 'object') {
        // Recursively sanitize objects (limited depth)
        sanitized[key] = JSON.stringify(value).substring(0, 500);
      }
    }
    
    return sanitized;
  }

  private cleanupOldEvents(): void {
    const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    this.eventBuffer = this.eventBuffer.filter(event => event.timestamp > cutoff);
    
    // Cleanup alert counters
    const windowMs = this.config.alertThresholds.timeWindowMinutes * 60 * 1000;
    const now = Date.now();
    
    for (const [key, counter] of this.alertCounters.entries()) {
      if (now - counter.firstSeen > windowMs) {
        this.alertCounters.delete(key);
      }
    }
  }

  /**
   * Get audit configuration
   */
  public getConfig(): AuditConfig {
    return { ...this.config };
  }

  /**
   * Get audit statistics
   */
  public getAuditStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByLevel: Record<string, number>;
    oldestEvent?: number;
    newestEvent?: number;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsByLevel: Record<string, number> = {};
    let oldestEvent: number | undefined;
    let newestEvent: number | undefined;

    this.eventBuffer.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsByLevel[event.level] = (eventsByLevel[event.level] || 0) + 1;
      
      if (!oldestEvent || event.timestamp < oldestEvent) {
        oldestEvent = event.timestamp;
      }
      
      if (!newestEvent || event.timestamp > newestEvent) {
        newestEvent = event.timestamp;
      }
    });

    return {
      totalEvents: this.eventBuffer.length,
      eventsByType,
      eventsByLevel,
      oldestEvent,
      newestEvent,
    };
  }
}

// Export singleton instance
export const securityAudit = new SecurityAuditService();

// Export types
export type { SecurityEvent, AuditConfig };