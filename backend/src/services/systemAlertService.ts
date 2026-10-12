/**
 * LogicWhileLiRE — System Alerting Agent (Phase 2 Requirement 5)
 * Background monitor that catches failed auth, security breaches, and system crashes,
 * immediately alerting the admin via email and realtime notification feed.
 */

import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../db/supabase';
import { ADMIN_EMAIL, sendSystemAlertAdminEmail } from './emailService';

export interface SystemAlert {
  id: string;
  type: 'AUTH_FAILURE' | 'SYSTEM_CRASH' | 'SECURITY_BREACH' | 'DATABASE_ERROR' | 'UNCAUGHT_EXCEPTION';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  userEmail?: string;
  userId?: string;
  stack?: string;
  timestamp: string;
  dispatchedToEmail: boolean;
}

// In-memory circular buffer for ultra-fast admin notification feed retrieval
const RECENT_ALERTS_LIMIT = 100;
const alertBuffer: SystemAlert[] = [];

// Rate-limiting repeated email dispatches to prevent spam during storms
const emailThrottleMap = new Map<string, number>();
const EMAIL_THROTTLE_WINDOW_MS = 30 * 1000; // 30 seconds per similar alert fingerprint

function getAlertFingerprint(alert: Partial<SystemAlert>): string {
  return `${alert.type}:${alert.message}:${alert.ip || 'no-ip'}`;
}

export class SystemAlertingAgent {
  private static instance: SystemAlertingAgent;

  private constructor() {
    this.attachProcessHooks();
  }

  public static getInstance(): SystemAlertingAgent {
    if (!SystemAlertingAgent.instance) {
      SystemAlertingAgent.instance = new SystemAlertingAgent();
    }
    return SystemAlertingAgent.instance;
  }

  /**
   * Record and dispatch a failed authentication attempt
   */
  public async recordAuthFailure(params: {
    user?: string;
    role?: string;
    ip?: string;
    userAgent?: string;
    reason: string;
    path?: string;
  }): Promise<SystemAlert> {
    const isSuperAdminTarget = (params.user || '').toLowerCase().includes('admin');
    const severity: SystemAlert['severity'] = isSuperAdminTarget ? 'HIGH' : 'MEDIUM';

    const alert: SystemAlert = {
      id: uuidv4(),
      type: 'AUTH_FAILURE',
      severity,
      message: `Authentication failure for user '${params.user || 'anonymous'}' (${params.role || 'unknown role'}): ${params.reason}`,
      details: {
        targetUser: params.user,
        role: params.role,
        path: params.path,
        reason: params.reason,
      },
      ip: params.ip,
      userAgent: params.userAgent,
      userEmail: params.user,
      timestamp: new Date().toISOString(),
      dispatchedToEmail: false,
    };

    return this.processAlert(alert);
  }

  /**
   * Record and dispatch an unhandled system crash or 500 server error
   */
  public async recordSystemCrash(params: {
    error: any;
    context?: string;
    path?: string;
    method?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<SystemAlert> {
    const errMsg = params.error?.message || String(params.error);
    const errStack = params.error?.stack || undefined;

    const alert: SystemAlert = {
      id: uuidv4(),
      type: 'SYSTEM_CRASH',
      severity: 'CRITICAL',
      message: `System Exception in ${params.context || params.path || 'Core Engine'}: ${errMsg}`,
      details: {
        context: params.context,
        path: params.path,
        method: params.method,
        errorMessage: errMsg,
        stackSnippet: errStack ? errStack.split('\n').slice(0, 5).join('\n') : undefined,
      },
      ip: params.ip,
      userAgent: params.userAgent,
      stack: errStack,
      timestamp: new Date().toISOString(),
      dispatchedToEmail: false,
    };

    return this.processAlert(alert);
  }

  /**
   * Internal processor: saves to buffer, persists to database, and sends email alert
   */
  private async processAlert(alert: SystemAlert): Promise<SystemAlert> {
    // 1. In-memory buffer update
    alertBuffer.unshift(alert);
    if (alertBuffer.length > RECENT_ALERTS_LIMIT) {
      alertBuffer.pop();
    }

    console.warn(`[SystemAlertAgent] [${alert.severity}] ${alert.type}: ${alert.message}`);

    // 2. Persist to audit_log / alerts in database
    try {
      await supabase.from('audit_log').insert({
        admin_id: 'system-agent',
        action: `SYSTEM_ALERT_${alert.type}`,
        target_table: 'system_alerts',
        payload: {
          user_id: alert.userId || 'system-agent',
          severity: alert.severity,
          message: alert.message,
          alertId: alert.id,
          ...alert.details,
          timestamp: alert.timestamp,
        },
        ip_address: alert.ip || '127.0.0.1',
        created_at: new Date().toISOString(),
      });
    } catch (dbErr) {
      // Don't fail if audit log write fails
    }

    // 3. Dispatch Email Alert if severity is HIGH or CRITICAL
    const fingerprint = getAlertFingerprint(alert);
    const lastSent = emailThrottleMap.get(fingerprint) || 0;
    const now = Date.now();

    if ((alert.severity === 'CRITICAL' || alert.severity === 'HIGH') && now - lastSent > EMAIL_THROTTLE_WINDOW_MS) {
      emailThrottleMap.set(fingerprint, now);
      try {
        const sent = await sendSystemAlertAdminEmail({
          alertType: alert.type,
          severity: alert.severity,
          message: alert.message,
          ip: alert.ip,
          userAgent: alert.userAgent,
          details: alert.details,
          timestamp: alert.timestamp,
        });
        alert.dispatchedToEmail = sent;
      } catch (mailErr) {
        console.warn('[SystemAlertAgent] Email dispatch warning:', mailErr);
      }
    }

    return alert;
  }

  /**
   * Attach process unhandled exception / rejection hooks
   */
  private attachProcessHooks(): void {
    process.on('uncaughtException', (err: Error) => {
      this.recordSystemCrash({
        error: err,
        context: 'Process Uncaught Exception',
      }).catch(() => {});
    });

    process.on('unhandledRejection', (reason: any) => {
      this.recordSystemCrash({
        error: reason instanceof Error ? reason : new Error(String(reason)),
        context: 'Process Unhandled Promise Rejection',
      }).catch(() => {});
    });
  }

  /**
   * Retrieve recent alerts for admin notification feed
   */
  public getRecentAlerts(limit: number = 50): SystemAlert[] {
    return alertBuffer.slice(0, limit);
  }
}

export const systemAlertAgent = SystemAlertingAgent.getInstance();
