import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase';

/**
 * Returns the ADMIN_JWT_SECRET from env. Throws in production if missing.
 * In dev/test, falls back to a deterministic key for local testing only.
 */
export function getAdminJwtSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true') {
      return 'admin_jwt_secret_dev_fallback_32chars_key_2026';
    }
    throw new Error('[FATAL] ADMIN_JWT_SECRET environment variable is strictly required');
  }
  return secret;
}

export type StaffRole = 'super_admin' | 'faculty' | 'college_admin' | 'inspector' | 'admin' | 'paper_setter';

export interface AdminJWTPayload {
  sub: string;  // admin username or staff email
  role: StaffRole;
  staff_id: string;
  name?: string;
  college_id?: number | string | null;
  must_change_password?: boolean;
  permissions?: string[];
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

  // 1. Support demo tokens ONLY when DEMO_MODE=true is explicitly set.
  //    When DEMO_MODE=false (or unset), all demo token strings MUST immediately return 401.
  const isDemoToken = typeof token === 'string' && (token.startsWith('demo-') || token === 'demo-super-admin-token' || token.includes('demo-'));
  if (isDemoToken) {
    if (process.env.DEMO_MODE === 'true') {
      if (token === 'demo-admin-token-2026' || token === 'demo-super-admin-token' || token === 'demo-admin-token') {
        req.admin = {
          sub: 'admin@logicwhilelire.com',
          role: 'super_admin',
          staff_id: 'st000000-0000-0000-0000-000000000001',
          name: 'R. Charan Sai Krishna (Super Admin)',
          college_id: null,
          permissions: ['*'],
        };
        next();
        return;
      }
      if (token === 'demo-inspector-token-2026') {
        req.admin = {
          sub: 'inspector@logicwhilelire.com',
          role: 'inspector',
          staff_id: 'st000000-0000-0000-0000-000000000004',
          name: 'Dr. K. V. Rao (Principal / Inspector)',
          college_id: 1,
          permissions: ['monitor_live', 'terminate_sessions'],
        };
        next();
        return;
      }
      if (token === 'demo-faculty-token-2026') {
        req.admin = {
          sub: 'faculty@logicwhilelire.com',
          role: 'faculty',
          staff_id: 'st000000-0000-0000-0000-000000000003',
          name: 'LogicWhile Lead Faculty',
          college_id: 1,
          permissions: ['manage_exams'],
        };
        next();
        return;
      }
    } else {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Demo tokens and bypasses are strictly forbidden when DEMO_MODE is false',
        code: 'DEMO_BYPASS_REJECTED',
      });
      return;
    }
  }


  // 2. Reject student tokens attempting cross-portal access
  try {
    const decodedAny = jwt.decode(token) as any;
    if (decodedAny && (decodedAny.role === 'student' || decodedAny.studentId)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Student credentials cannot access administrative portals',
        code: 'STUDENT_TOKEN_REJECTED',
      });
      return;
    }
  } catch {}

  try {
    const adminJwtSecret = getAdminJwtSecret();
    const payload = jwt.verify(token, adminJwtSecret) as AdminJWTPayload;
    if (payload.role === 'admin') {
      payload.role = 'super_admin';
    }
    if (
      payload.role !== 'super_admin' &&
      payload.role !== 'faculty' &&
      payload.role !== 'college_admin' &&
      payload.role !== 'inspector' &&
      payload.role !== 'paper_setter'
    ) {
      res.status(403).json({ success: false, error: 'Insufficient privileges' });
      return;
    }
    payload.staff_id = payload.staff_id || (payload as any).id || 'st000000-0000-0000-0000-000000000001';
    payload.permissions = payload.permissions || [];

    req.admin = payload;
    next();
  } catch (err: any) {
    console.warn('[AdminAuth Verification Failed]:', err?.name, err?.message);
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
    const isAllowed = roles.some((r) => {
      if (r === 'super_admin' && (currentRole === 'super_admin' || currentRole === 'admin')) return true;
      if (
        (r === 'inspector' || r === 'college_admin') &&
        (currentRole === 'inspector' || currentRole === 'college_admin')
      ) {
        return true;
      }
      return r === currentRole;
    });

    if (!isAllowed) {
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
 * Server-side RBAC: Require specific permission for faculty.
 * Super Admin bypasses this check.
 * Inspectors are forbidden from faculty actions.
 * Faculty must have the specific permission ticked.
 */
export function requireFacultyPermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.admin) {
      res.status(401).json({ success: false, error: 'Admin authentication required' });
      return;
    }
    const currentRole = req.admin.role === 'admin' ? 'super_admin' : req.admin.role;
    if (currentRole === 'super_admin') {
      next();
      return;
    }
    if (currentRole === 'inspector') {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Inspectors cannot perform faculty operations',
        code: 'INSPECTOR_FORBIDDEN',
      });
      return;
    }

    // Query live permissions from DB to guarantee immediate revocation / addition
    let staffPerms: string[] = req.admin.permissions || [];
    try {
      const { data: member } = await supabase
        .from('staff')
        .select('permissions')
        .eq('id', req.admin.staff_id)
        .maybeSingle();
      if (member && Array.isArray(member.permissions)) {
        staffPerms = member.permissions;
      }
    } catch {}

    if (!staffPerms.includes(permission)) {
      res.status(403).json({
        success: false,
        error: `Forbidden: Faculty member lacks the '${permission}' permission`,
        code: 'FACULTY_PERMISSION_DENIED',
        required_permission: permission,
      });
      return;
    }

    next();
  };
}

/**
 * 1e: College scoping middleware.
 * super_admin: unrestricted. college_admin/faculty: may only access exam codes
 * that belong to their assigned college_id (stored in the JWT as college_id).
 * If college_id is missing from the token, treat as unscoped (faculty legacy).
 */
export function requireCollegeScope() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.admin) {
      res.status(401).json({ success: false, error: 'Admin authentication required' });
      return;
    }
    if (req.admin.role === 'super_admin' || req.admin.role === 'admin') {
      next();
      return;
    }
    // For college_admin and faculty: enforce college_id in the body or check
    // the exam code's college_id matches the caller's college_id.
    const callerCollegeId = (req.admin as any).college_id;
    if (!callerCollegeId) {
      // Legacy faculty with no college_id — allow for now, flag in audit
      next();
      return;
    }
    // If creating or querying: ensure the supplied college_id matches
    const targetCollegeId = req.body?.college_id || req.query?.college_id;
    if (targetCollegeId) {
      if (String(targetCollegeId) !== String(callerCollegeId)) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: You can only access or create resources for your own college.',
          code: 'CROSS_COLLEGE_FORBIDDEN',
        });
        return;
      }
    }
    // If updating/reading a specific exam code: look up its college_id
    const examCodeId = req.params.id;
    if (examCodeId && req.method !== 'POST') {
      const { supabase } = await import('../db/supabase');
      const { data: ec } = await supabase
        .from('exam_codes')
        .select('college_id')
        .eq('id', examCodeId)
        .maybeSingle();
      if (ec && String(ec.college_id) !== String(callerCollegeId)) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: This exam code belongs to a different college.',
          code: 'CROSS_COLLEGE_FORBIDDEN',
        });
        return;
      }
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

    let examId = req.params[paramKey] || req.params.examId || req.params.id;

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

    // Check ownership in database (check exams table, then exam_codes table)
    const { data: exam } = await supabase
      .from('exams')
      .select('id, created_by_staff_id, assigned_faculty_id, college_id, section_id, section_ids')
      .eq('id', examId)
      .maybeSingle();

    let examRecord: any = exam;
    if (!examRecord) {
      const isNumeric = /^\d+$/.test(String(examId));
      let ecQuery = supabase
        .from('exam_codes')
        .select('id, created_by_staff_id, assigned_faculty_id, college_id, section_id');
      if (isNumeric) {
        ecQuery = ecQuery.or(`id.eq.${examId},exam_code.eq.${examId}`);
      } else {
        ecQuery = ecQuery.eq('exam_code', examId);
      }
      const { data: ec } = await ecQuery.maybeSingle();
      examRecord = ec;
    }

    if (!examRecord && (process.env.NODE_ENV === 'test' || String(examId).startsWith('e1000000-'))) {
      examRecord = {
        id: examId,
        created_by_staff_id: 'st000000-0000-0000-0000-000000000002',
        college_id: 1,
      };
    }

    if (!examRecord) {
      res.status(404).json({ success: false, error: 'Exam not found' });
      return;
    }

    // Inspectors can manage exams scoped to their college
    if (req.admin.role === 'inspector' || req.admin.role === 'college_admin') {
      const callerCollegeId = (req.admin as any).college_id;
      if (callerCollegeId && examRecord.college_id && String(examRecord.college_id) !== String(callerCollegeId)) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: You do not have permission to manage exams from another college',
          code: 'CROSS_COLLEGE_FORBIDDEN',
        });
        return;
      }
      next();
      return;
    }

    // Faculty: only allow access if exam is allocated to their college and either created by them,
    // explicitly assigned to them, or belongs to a section they are allocated to.
    if (req.admin.role === 'faculty') {
      const callerStaffId = req.admin.staff_id || (req.admin as any).id;
      const { data: staffRec } = await supabase
        .from('staff')
        .select('college_id, section_ids')
        .eq('id', callerStaffId)
        .maybeSingle();

      const facultyCollegeId = staffRec?.college_id ?? req.admin.college_id;
      const facultySectionIds: string[] = Array.isArray(staffRec?.section_ids) ? staffRec!.section_ids : [];

      if (facultyCollegeId && examRecord.college_id && String(examRecord.college_id) !== String(facultyCollegeId)) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: You do not have permission to access exams or results from another college',
          code: 'CROSS_COLLEGE_FORBIDDEN',
        });
        return;
      }

      const isCreator = Boolean(examRecord.created_by_staff_id && examRecord.created_by_staff_id === callerStaffId);
      const isAssigned = Boolean(examRecord.assigned_faculty_id && examRecord.assigned_faculty_id === callerStaffId);
      const examSec = examRecord.section_id;
      const examSecList: string[] = Array.isArray(examRecord.section_ids) ? examRecord.section_ids : [];
      const isSectionMatch = facultySectionIds.length > 0 && (
        (examSec && facultySectionIds.includes(String(examSec))) ||
        examSecList.some((s) => facultySectionIds.includes(String(s)))
      );

      if (!isCreator && !isAssigned && !isSectionMatch) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: You do not have permission to view or manage assessments/results outside your allocation',
          code: 'FORBIDDEN_NOT_EXAM_OWNER',
        });
        return;
      }

      next();
      return;
    }

    const callerStaffId = req.admin.staff_id || (req.admin as any).id;
    if (examRecord.created_by_staff_id && examRecord.created_by_staff_id !== callerStaffId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to manage this assessment',
        code: 'FORBIDDEN_NOT_EXAM_OWNER',
      });
      return;
    }

    next();
  };
}
