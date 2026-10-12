import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { supabase } from '../db/supabase';

export interface ParticipantJWTPayload {
  sessionId: string;
  participantId: string;
  examId: string;
  iat?: number;
  exp?: number;
}

export interface StudentJWTPayload {
  studentId: string;
  name: string;
  email: string;
  hallTicket: string;
  role: 'student';
  sessionId?: string;
  must_change_password?: boolean;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      participant?: ParticipantJWTPayload;
      student?: StudentJWTPayload;
      sessionTokenRaw?: string;
    }
  }
}

/**
 * Participant auth middleware.
 * Reads JWT from HttpOnly cookie 'session_token'.
 * Validates signature, expiry, and bcrypt-compares the raw token
 * against the stored token_hash to ensure the token hasn't been revoked.
 */
export async function participantAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = req.cookies?.session_token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  let payload: ParticipantJWTPayload;
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('[FATAL] JWT_SECRET environment variable is strictly required');
    }
    payload = jwt.verify(token, jwtSecret) as ParticipantJWTPayload;
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired session token' });
    return;
  }

  // Verify token hash in DB (guards against token revocation)
  const { data: session, error } = await supabase
    .from('exam_sessions')
    .select('token_hash, status')
    .eq('id', payload.sessionId)
    .single();

  if (error || !session) {
    res.status(401).json({ success: false, error: 'Session not found' });
    return;
  }

  let hashMatch = false;
  if (session.token_hash && (session.token_hash.startsWith('$2b$') || session.token_hash.startsWith('$2a$'))) {
    hashMatch = await bcrypt.compare(token, session.token_hash);
  } else if (session.token_hash) {
    const computedHash = crypto.createHash('sha256').update(token).digest('hex');
    hashMatch = crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(session.token_hash));
  }
  if (!hashMatch) {
    res.status(401).json({ success: false, error: 'Token mismatch — possible replay attack' });
    return;
  }

  if (session.status === 'terminated') {
    res.status(403).json({ success: false, error: 'Session has been terminated', code: 'SESSION_TERMINATED' });
    return;
  }

  req.participant = payload;
  req.sessionTokenRaw = token;
  next();
}

/**
 * Student auth middleware.
 * Reads JWT from cookie 'student_token' or Authorization header.
 * Validates signature, expiry, and verifies active student record in DB.
 * Strictly enforces single active session per student.
 */
export async function studentAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = req.cookies?.student_token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

  if (!token) {
    res.status(401).json({ success: false, error: 'Student authentication required' });
    return;
  }

  // Reject administrative tokens attempting student portal access
  try {
    const decodedAny = jwt.decode(token) as any;
    if (decodedAny && ['super_admin', 'admin', 'faculty', 'inspector', 'college_admin'].includes(decodedAny.role)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Administrative accounts cannot use student portal routes',
        code: 'ADMIN_TOKEN_REJECTED',
      });
      return;
    }
  } catch {}

  let payload: StudentJWTPayload;
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('[FATAL] JWT_SECRET environment variable is strictly required');
    }
    payload = jwt.verify(token, jwtSecret) as StudentJWTPayload;
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired student session' });
    return;
  }

  if (payload.role !== 'student' || !payload.studentId) {
    res.status(403).json({ success: false, error: 'Access denied: not a student account' });
    return;
  }

  const { data: student, error } = await supabase
    .from('students')
    .select('id, is_active, is_verified, locked_until, active_session_id')
    .eq('id', payload.studentId)
    .maybeSingle();

  if (error || !student) {
    res.status(401).json({ success: false, error: 'Student account not found' });
    return;
  }

  if (!student.is_active) {
    res.status(403).json({ success: false, error: 'Student account is deactivated' });
    return;
  }

  if (student.locked_until && new Date(student.locked_until) > new Date()) {
    res.status(423).json({ success: false, error: 'Account is temporarily locked. Please reset your password.' });
    return;
  }

  // Enforce single active session per student
  if (payload.sessionId && student.active_session_id && payload.sessionId !== student.active_session_id) {
    res.status(401).json({
      success: false,
      error: 'Session expired: Your account has been logged in from another device or browser session.',
      code: 'SESSION_SUPERSEDED',
    });
    return;
  }

  req.student = payload;
  next();
}
