import { Request, Response, NextFunction } from "express";
import { supabase } from "../db/supabase";

/**
 * Middleware factory for admin audit logging.
 * Captures user_id, role, action, target, IP, user agent, timestamp inside payload.
 * Schema columns: id, admin_id, admin_name, action, target_table, target_id, before_state, payload, ip_address, created_at.
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
        const userAgent = (req.headers["user-agent"] || (req.get ? req.get("user-agent") : "") || "Unknown").toString();
        const clientIp = (req.ip || req.socket?.remoteAddress || req.headers["x-forwarded-for"] || "127.0.0.1").toString();
        const now = new Date().toISOString();

        const targetStr = targetTable ? `${targetTable}${targetId ? `:${targetId}` : ""}` : (targetId || "system");
        const userId = String(req.admin.staff_id || req.admin.sub || "admin");
        const userRole = req.admin.role || "super_admin";

        const auditData: any = {
          admin_id: userId,
          admin_name: (req.admin as any).username || (req.admin as any).email || "Admin",
          action,
          target_table: targetTable || null,
          target_id: targetId || null,
          ip_address: clientIp,
          user_agent: userAgent,
          payload: {
            user_id: userId,
            role: userRole,
            target: targetStr,
            college_id: (req.admin as any).college_id || null,
            body: req.body,
            params: req.params,
            query: req.query,
            user_agent: userAgent,
            timestamp: now,
          },
          created_at: now,
        };

        if (process.env.DEMO_MODE === "true" || process.env.TEST_MOCK_ONLY === "true") {
          auditData.user_id = userId;
          auditData.role = userRole;
          auditData.college_id = (req.admin as any).college_id || null;
          auditData.target = targetStr;
          auditData.ip = clientIp;
          auditData.timestamp = now;
        }

        supabase
          .from("audit_log")
          .insert(auditData)
          .then(({ error }) => {
            if (error) {
              console.error("[AuditLog] Failed to write audit entry:", error.message);
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
  admin: { id?: string; staff_id?: string; sub?: string; role?: string; college_id?: string | number | null; username?: string; email?: string },
  action: string,
  targetTable?: string | null,
  targetId?: string | null,
  payload?: any,
  req?: any
): Promise<void> {
  const userAgent = req?.headers?.["user-agent"] || (req?.get ? req.get("user-agent") : "") || "Unknown";
  const clientIp = req?.ip || req?.socket?.remoteAddress || req?.headers?.["x-forwarded-for"] || "127.0.0.1";
  const now = new Date().toISOString();
  const userId = String(admin.staff_id || admin.id || admin.sub || "system");
  const userRole = admin.role || "super_admin";
  const targetStr = targetTable ? `${targetTable}${targetId ? `:${targetId}` : ""}` : (targetId || "system");

  const auditData: any = {
    admin_id: userId,
    admin_name: admin.username || admin.email || "Admin",
    action,
    target_table: targetTable || null,
    target_id: targetId || null,
    ip_address: String(clientIp),
    user_agent: String(userAgent),
    payload: {
      user_id: userId,
      role: userRole,
      target: targetStr,
      college_id: admin.college_id || null,
      user_agent: String(userAgent),
      timestamp: now,
      ...(payload && typeof payload === "object" ? payload : { data: payload }),
    },
    created_at: now,
  };

  if (process.env.DEMO_MODE === "true" || process.env.TEST_MOCK_ONLY === "true") {
    auditData.user_id = userId;
    auditData.role = userRole;
    auditData.college_id = admin.college_id || null;
    auditData.target = targetStr;
    auditData.ip = String(clientIp);
    auditData.timestamp = now;
  }

  await supabase.from("audit_log").insert(auditData);
}
