import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase';

export type StaffRole = 'super_admin' | 'faculty';

export interface AdminJWTPayload {
  sub: string;  // admin username or staff email
  role: StaffRole | 'admin';
  staff_id: string;
  name?: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminJWTPayload;
    }
  }
}

/**
 * Admin auth middleware.
 * Reads JWT from HttpOnly cookie 'admin_token' or Authorization Bearer header.
 * Uses a separate ADMIN_JWT_SECRET to prevent participant tokens
 * from being used on admin routes.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = req.cookies?.admin_token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

  if (!token) {
    res.status(401).json({ success: false, error: 'Admin authentication required' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as AdminJWTPayload;
    if (payload.role === 'admin') {
      payload.role = 'super_admin';
    }
    if (payload.role !== 'super_admin' && payload.role !== 'faculty') {
      res.status(403).json({ success: false, error: 'Insufficient privileges' });
      return;
    }
    if (!payload.staff_id) {
      payload.staff_id = 'st000000-0000-0000-0000-000000000001';
    }
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired admin token' });
  }
}

/**
 * Require specific staff roles (e.g. super_admin only)
 */
export function requireRole(...roles: StaffRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ success: false, error: 'Admin authentication required' });
      return;
    }
    const currentRole = (req.admin.role === 'admin' ? 'super_admin' : req.admin.role) as StaffRole;
    if (!roles.includes(currentRole)) {
      res.status(403).json({
        success: false,
        error: `Insufficient privileges: Action requires ${roles.join(' or ')} permission`,
      });
      return;
    }
    next();
  };
}

/**
 * Enforce that faculty can only touch exams they created.
 * Super Admin bypasses this check.
 */
export function requireExamOwnership(paramKey: 'examId' | 'id' | 'sessionId' = 'examId') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.admin) {
      res.status(401).json({ success: false, error: 'Admin authentication required' });
      return;
    }

    // Super admins have unrestricted access
    if (req.admin.role === 'super_admin' || req.admin.role === 'admin') {
      next();
      return;
    }

    let examId = req.params[paramKey];

    // If param is sessionId, find associated examId
    if (paramKey === 'sessionId') {
      const { data: session } = await supabase
        .from('exam_sessions')
        .select('participant:participant_id ( exam_id )')
        .eq('id', examId)
        .single();
      const p = (session as any)?.participant;
      if (!p?.exam_id) {
        res.status(404).json({ success: false, error: 'Session not found' });
        return;
      }
      examId = p.exam_id;
    }

    if (!examId) {
      res.status(400).json({ success: false, error: 'Missing exam identifier' });
      return;
    }

    // Check ownership in database
    const { data: exam, error } = await supabase
      .from('exams')
      .select('id, created_by_staff_id')
      .eq('id', examId)
      .single();

    if (error || !exam) {
      res.status(404).json({ success: false, error: 'Exam not found' });
      return;
    }

    if (exam.created_by_staff_id && exam.created_by_staff_id !== req.admin.staff_id) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to manage this assessment',
      });
      return;
    }

    next();
  };
}
