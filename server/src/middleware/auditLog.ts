import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase';

/**
 * Middleware factory for admin audit logging.
 * Captures user_id, role, action, target, IP, user agent, timestamp.
 */
export function auditLog(action: string, targetTable?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original json method to intercept response
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      // Log after successful mutations (2xx responses)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.admin) {
        const rawId =
          req.params?.id ||
          req.params?.examId ||
          req.params?.sessionId ||
          (body as Record<string, unknown>)?.id ||
          null;
        const targetId = rawId ? String(rawId) : null;
        const userAgent = (req.headers['user-agent'] || (req.get ? req.get('user-agent') : '') || 'Unknown').toString();
        const clientIp = (req.ip || req.socket?.remoteAddress || req.headers['x-forwarded-for'] || '127.0.0.1').toString();
        const now = new Date().toISOString();

        supabase
          .from('audit_log')
          .insert({
            user_id: req.admin.staff_id || req.admin.sub,
            admin_id: req.admin.sub,
            role: req.admin.role,
            action,
            target: targetTable ? `${targetTable}${targetId ? `:${targetId}` : ''}` : (targetId || 'system'),
            target_table: targetTable || null,
            target_id: targetId || null,
            college_id: (req.admin as any).college_id || null,
            payload: {
              body: req.body,
              params: req.params,
              query: req.query,
            },
            ip: clientIp,
            ip_address: clientIp,
            user_agent: userAgent,
            timestamp: now,
            created_at: now,
          })
          .then(({ error }) => {
            if (error) {
              console.error('[AuditLog] Failed to write audit entry:', error.message);
            }
          });
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Direct audit log recorder for explicit action tracking (e.g. login, failed login, exam dispatch)
 */
export async function recordAuditLog(
  admin: { id?: string; staff_id?: string; sub?: string; role?: string; college_id?: string | number | null },
  action: string,
  targetTable?: string | null,
  targetId?: string | null,
  payload?: any,
  req?: any
): Promise<void> {
  const userAgent = req?.headers?.['user-agent'] || (req?.get ? req.get('user-agent') : '') || 'Unknown';
  const clientIp = req?.ip || req?.socket?.remoteAddress || req?.headers?.['x-forwarded-for'] || '127.0.0.1';
  const now = new Date().toISOString();
  const userId = admin.staff_id || admin.id || admin.sub || 'system';

  await supabase.from('audit_log').insert({
    user_id: userId,
    admin_id: admin.sub || userId,
    role: admin.role || 'super_admin',
    action,
    target: targetTable ? `${targetTable}${targetId ? `:${targetId}` : ''}` : (targetId || 'system'),
    target_table: targetTable || null,
    target_id: targetId || null,
    college_id: admin.college_id || null,
    payload: payload || null,
    ip: String(clientIp),
    ip_address: String(clientIp),
    user_agent: String(userAgent),
    timestamp: now,
    created_at: now,
  });
}
