import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase';

/**
 * Middleware factory for admin audit logging.
 * Wrap admin mutation routes with this to automatically write
 * an audit_log entry after the route handler runs.
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

        supabase
          .from('audit_log')
          .insert({
            admin_id: req.admin.sub,
            action,
            target_table: targetTable || null,
            target_id: targetId || null,
            payload: {
              body: req.body,
              params: req.params,
              query: req.query,
            },
            ip_address: req.ip,
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
