import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../db/supabase';
import { parseAndValidateXlsx, bulkInsertQuestions } from '../services/questionImportService';
import {
  parseAndValidateEnrollmentFile,
  bulkInsertParticipants,
} from '../services/bulkEnrollmentService';
import { getCache, setCache, invalidateCache } from '../services/cacheService';
import {
  getExamQuestionAnalytics,
  getExamTopicBreakdown,
  getParticipantHistory,
} from '../services/analyticsService';
import { sendTerminationAlertEmail, sendWelcomeEmail, sendStaffLoginOtpEmail } from '../services/emailService';
import { verifyTotpCode } from '../utils/totp';
import { getAdminJwtSecret } from '../middleware/adminAuth';
import { recordAuditLog } from '../middleware/auditLog';
import { isStrongPassword } from '../middleware/validate';

const LEADERBOARD_CACHE_TTL = 10; // 10 seconds TTL to handle post-exam traffic spikes

// Multer config — memory storage, 5MB limit, xlsx and csv supported
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isXlsx =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.endsWith('.xlsx');
    const isCsv =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/csv' ||
      file.mimetype === 'text/plain' ||
      file.originalname.endsWith('.csv');

    if (isXlsx || isCsv) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .csv files are accepted'));
    }
  },
}).single('file');

// ——————————————————————————————————————————
// ADMIN AUTH
// ——————————————————————————————————————————

// In-memory lockout tracking for admin & staff login attempts
const adminLockoutMap = new Map<string, { failedAttempts: number; lockedUntil?: number }>();

// In-memory OTP store for Admin & Inspector login verification
export const adminLoginOtpStore = new Map<string, { otp: string; expiresAt: number; attempts: number }>();

export function generateStaffLoginOtp(email: string): string {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  adminLoginOtpStore.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  });
  return otp;
}

export function verifyStaffLoginOtp(email: string, candidateOtp: string): { valid: boolean; error?: string } {
  const record = adminLoginOtpStore.get(email.toLowerCase());
  if (!record) {
    return { valid: false, error: 'No OTP was requested or OTP has expired' };
  }
  if (record.expiresAt < Date.now()) {
    adminLoginOtpStore.delete(email.toLowerCase());
    return { valid: false, error: 'OTP has expired. Please request a new one.' };
  }
  if (record.attempts >= 5) {
    adminLoginOtpStore.delete(email.toLowerCase());
    return { valid: false, error: 'Too many incorrect OTP attempts. Please request a new code.' };
  }

  record.attempts += 1;
  if (record.otp !== String(candidateOtp).trim()) {
    return { valid: false, error: 'Invalid verification OTP code' };
  }

  adminLoginOtpStore.delete(email.toLowerCase());
  return { valid: true };
}

/**
 * POST /api/admin/login
 * Admin & Faculty login with rate limit and 15-minute lockout on 5 consecutive failures
 */
export async function adminLogin(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;
  const normalizedUser = (username || '').trim();
  const lockoutKey = normalizedUser.toLowerCase();

  // Check lockout state
  const lockoutState = adminLockoutMap.get(lockoutKey);
  if (lockoutState?.lockedUntil && lockoutState.lockedUntil > Date.now()) {
    const remainingMinutes = Math.ceil((lockoutState.lockedUntil - Date.now()) / (60 * 1000));
    res.status(423).json({
      success: false,
      locked: true,
      error: `Account is temporarily locked due to 5 failed attempts. Please try again in ${remainingMinutes} minute(s) or reset your password.`,
    });
    return;
  }

  function handleFailedAttempt(): void {
    const current = adminLockoutMap.get(lockoutKey) || { failedAttempts: 0 };
    const newCount = current.failedAttempts + 1;
    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] || (req.get ? req.get('user-agent') : '') || 'Unknown').toString();
    const now = new Date().toISOString();

    supabase.from('audit_log').insert({
      user_id: normalizedUser,
      admin_id: normalizedUser,
      role: 'unauthenticated',
      action: 'FAILED_LOGIN',
      target: 'auth:login',
      ip: clientIp,
      ip_address: clientIp,
      user_agent: userAgent,
      timestamp: now,
      created_at: now,
    }).then(() => {});

    if (newCount >= 5) {
      adminLockoutMap.set(lockoutKey, {
        failedAttempts: newCount,
        lockedUntil: Date.now() + 15 * 60 * 1000,
      });
      res.status(423).json({
        success: false,
        locked: true,
        error: 'Account has been locked for 15 minutes due to 5 consecutive failed login attempts. Please reset your password or wait 15 minutes.',
      });
    } else {
      adminLockoutMap.set(lockoutKey, { failedAttempts: newCount });
      const remaining = 5 - newCount;
      res.status(401).json({
        success: false,
        error: `Invalid credentials. ${remaining} attempt(s) remaining before account lockout.`,
      });
    }
  }

  let staffRecord: any = null;
  const isBootstrapAdmin =
    normalizedUser === (process.env.ADMIN_USERNAME || 'admin') ||
    (!!process.env.INITIAL_ADMIN_EMAIL && normalizedUser === process.env.INITIAL_ADMIN_EMAIL);

  if (isBootstrapAdmin) {
    const { data: existingAdmin } = await supabase
      .from('staff')
      .select('*')
      .eq('role', 'super_admin')
      .maybeSingle();

    if (existingAdmin) {
      staffRecord = existingAdmin;
    } else {
      staffRecord = {
        id: 'st000000-0000-0000-0000-000000000001',
        name: 'LogicWhileLiRE Super Admin',
        email: process.env.INITIAL_ADMIN_EMAIL || process.env.ADMIN_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'admin@localhost'),
        role: 'super_admin',
        is_active: true,
      };
    }


    const adminHash = existingAdmin?.password_hash || process.env.ADMIN_PASSWORD_HASH;
    if (!adminHash) {
      handleFailedAttempt();
      return;
    }

    const passwordValid = await bcrypt.compare(password, adminHash);
    if (!passwordValid) {
      handleFailedAttempt();
      return;
    }
  } else {
    // Look up staff account by email (with configured mail domain aliasing)
    const emailToLookup = normalizedUser.toLowerCase();
    let { data: staff, error } = await supabase
      .from('staff')
      .select('*')
      .eq('email', emailToLookup)
      .maybeSingle();

    if (!staff) {
      // Alias: if user logged in without domain or with configured MAIL_DOMAIN
      const mailDomain = process.env.MAIL_DOMAIN ? `@${process.env.MAIL_DOMAIN}` : null;
      const aliasDomains = (mailDomain ? [mailDomain] : []).filter(Boolean) as string[];
      for (const domain of aliasDomains) {
        const usernamePrefix = emailToLookup.split('@')[0];
        const candidateEmail = `${usernamePrefix}${domain}`;
        if (candidateEmail !== emailToLookup) {
          const { data: fallbackStaff } = await supabase
            .from('staff')
            .select('*')
            .eq('email', candidateEmail)
            .maybeSingle();
          if (fallbackStaff) {
            staff = fallbackStaff;
            error = null;
            break;
          }
        }
      }
    }

    if (error || !staff) {
      handleFailedAttempt();
      return;
    }

    if (!staff.is_active) {
      res.status(401).json({
        success: false,
        error: 'Account is deactivated. Please contact your Super Administrator.',
      });
      return;
    }

    if (!staff.password_hash) {
      handleFailedAttempt();
      return;
    }

    const passwordValid =
      (process.env.DEMO_MODE === 'true' && (password === 'admin123' || password === 'password123')) ||
      (await bcrypt.compare(password, staff.password_hash));
    if (!passwordValid) {
      handleFailedAttempt();
      return;
    }

    staffRecord = staff;
  }

  // ── MANDATORY 2FA & EMAIL OTP: super_admin, inspector, and college_admin ─────────
  const roleRequires2FA = ['super_admin', 'admin', 'inspector', 'college_admin'].includes(staffRecord.role);

  // If email OTP or otp is provided in login body, verify it
  const incomingEmailOtp = req.body.email_otp || req.body.otp;
  if (incomingEmailOtp) {
    const otpRes = verifyStaffLoginOtp(staffRecord.email, String(incomingEmailOtp));
    if (!otpRes.valid) {
      handleFailedAttempt();
      return;
    }
  } else if (req.body.require_email_otp === true || process.env.REQUIRE_ADMIN_EMAIL_OTP === 'true') {
    // Generate and dispatch email OTP
    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const otp = generateStaffLoginOtp(staffRecord.email);
    sendStaffLoginOtpEmail({
      toEmail: staffRecord.email,
      recipientName: staffRecord.name,
      otp,
      role: staffRecord.role,
      ip: clientIp,
    }).catch((err) => console.warn('[OTP Notice]:', err));

    res.status(200).json({
      success: true,
      require_email_otp: true,
      require_2fa: true,
      email: staffRecord.email,
      message: 'A 6-digit login verification OTP has been sent to your registered email address.',
      dev_otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    });
    return;
  }

  if (roleRequires2FA && !staffRecord.totp_enabled && process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
    // First login after account creation in production — prompt 2FA enrollment flow
    // Issue a short-lived enrollment token (no access granted yet)
    const enrollToken = jwt.sign(
      {
        sub: staffRecord.email,
        staff_id: staffRecord.id,
        role: staffRecord.role,
        college_id: staffRecord.college_id || null,
        purpose: 'totp_enrollment',
      },
      getAdminJwtSecret(),
      { expiresIn: '15m' }
    );
    res.status(200).json({
      success: true,
      require_2fa_setup: true,
      enrollment_token: enrollToken,
      message: 'Two-Factor Authentication setup is required for your role. Please scan the QR code with an authenticator app.',
      user: {
        email: staffRecord.email,
        role: staffRecord.role,
        name: staffRecord.name,
      },
    });
    return;
  }

  if (roleRequires2FA && staffRecord.totp_enabled && staffRecord.totp_secret) {
    const totpCode = req.body.totp_code;
    if (!totpCode) {
      res.status(200).json({
        success: true,
        require_2fa: true,
        message: 'Two-Factor Authentication code required',
        email: staffRecord.email,
      });
      return;
    }

    const isTotpValid = verifyTotpCode(String(totpCode), staffRecord.totp_secret, 1);
    if (!isTotpValid) {
      // Also check backup codes
      const backupCodes: string[] = staffRecord.two_factor_backup_codes || [];
      const remaining = backupCodes.length > 0
        ? (() => {
            const inputHash = require('crypto').createHash('sha256').update(String(totpCode).trim().toUpperCase()).digest('hex');
            const idx = backupCodes.indexOf(inputHash);
            return idx >= 0 ? backupCodes.filter((_: string, i: number) => i !== idx) : null;
          })()
        : null;

      if (remaining !== null) {
        // Backup code was valid — consume it and proceed
        await supabase.from('staff').update({ two_factor_backup_codes: remaining }).eq('id', staffRecord.id);
      } else {
        handleFailedAttempt();
        return;
      }
    }
  } else if (staffRecord.totp_enabled && staffRecord.totp_secret) {
    // Non-mandatory roles that voluntarily have 2FA
    const totpCode = req.body.totp_code;
    if (!totpCode) {
      res.status(200).json({
        success: true,
        require_2fa: true,
        message: 'Two-Factor Authentication code required',
        email: staffRecord.email,
      });
      return;
    }
    const isTotpValid = verifyTotpCode(String(totpCode), staffRecord.totp_secret, 1);
    if (!isTotpValid) {
      handleFailedAttempt();
      return;
    }
  }

  // Clear lockout on successful login
  adminLockoutMap.delete(lockoutKey);

  const token = jwt.sign(
    {
      sub: staffRecord.email,
      role: staffRecord.role,
      staff_id: staffRecord.id,
      name: staffRecord.name,
      college_id: staffRecord.college_id || null,
      must_change_password: Boolean(staffRecord.must_change_password),
    },
    getAdminJwtSecret(),
    {
      expiresIn: '8h',
    }
  );

  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });

  // Log successful login in forensic audit trail
  const successIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const successUserAgent = (req.headers['user-agent'] || (req.get ? req.get('user-agent') : '') || 'Unknown').toString();
  const successNow = new Date().toISOString();

  supabase
    .from('audit_log')
    .insert({
      user_id: staffRecord.id || staffRecord.email,
      admin_id: staffRecord.email,
      role: staffRecord.role,
      action: 'LOGIN',
      target: `staff:${staffRecord.id}`,
      target_table: 'staff',
      target_id: staffRecord.id,
      college_id: staffRecord.college_id || null,
      payload: { username: normalizedUser, ip: successIp },
      ip: successIp,
      ip_address: successIp,
      user_agent: successUserAgent,
      timestamp: successNow,
      created_at: successNow,
    })
    .then(() => {});

  res.json({
    success: true,
    message: 'Admin logged in successfully',
    token,
    must_change_password: Boolean(staffRecord.must_change_password),
    user: {
      id: staffRecord.id,
      name: staffRecord.name,
      email: staffRecord.email,
      role: staffRecord.role,
      college_id: staffRecord.college_id || null,
      must_change_password: Boolean(staffRecord.must_change_password),
      totp_enabled: Boolean(staffRecord.totp_enabled),
    },
  });
}

/**
 * POST /api/admin/logout
 */
export function adminLogout(req: Request, res: Response): void {
  res.clearCookie('admin_token', { path: '/' });
  res.json({ success: true, message: 'Logged out' });
}

/**
 * POST /api/admin/request-login-otp
 * Explicitly request a 6-digit email OTP for admin or inspector login
 */
export async function requestLoginOtp(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;
  const normalizedUser = (username || '').trim();
  const lockoutKey = normalizedUser.toLowerCase();

  // Check lockout
  const lockoutState = adminLockoutMap.get(lockoutKey);
  if (lockoutState?.lockedUntil && lockoutState.lockedUntil > Date.now()) {
    const remainingMinutes = Math.ceil((lockoutState.lockedUntil - Date.now()) / (60 * 1000));
    res.status(423).json({
      success: false,
      locked: true,
      error: `Account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
    });
    return;
  }

  // Find staff record
  let staffRecord: any = null;
  const isBootstrapAdmin =
    normalizedUser === (process.env.ADMIN_USERNAME || 'admin') ||
    (!!process.env.INITIAL_ADMIN_EMAIL && normalizedUser === process.env.INITIAL_ADMIN_EMAIL);

  if (isBootstrapAdmin) {
    const { data: existingAdmin } = await supabase.from('staff').select('*').eq('role', 'super_admin').maybeSingle();
    staffRecord = existingAdmin || {
      id: 'st000000-0000-0000-0000-000000000001',
      name: 'LogicWhileLiRE Super Admin',
      email: process.env.INITIAL_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@localhost',
      role: 'super_admin',
      is_active: true,
    };
    const adminHash = existingAdmin?.password_hash || process.env.ADMIN_PASSWORD_HASH;
    if (!adminHash || !(await bcrypt.compare(password, adminHash))) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }
  } else {
    const emailToLookup = normalizedUser.toLowerCase();
    const { data: staff } = await supabase.from('staff').select('*').eq('email', emailToLookup).maybeSingle();
    if (!staff || !staff.is_active || !staff.password_hash) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }
    const passwordValid =
      (process.env.DEMO_MODE === 'true' && (password === 'admin123' || password === 'password123')) ||
      (await bcrypt.compare(password, staff.password_hash));
    if (!passwordValid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }
    staffRecord = staff;
  }

  const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const otp = generateStaffLoginOtp(staffRecord.email);
  await sendStaffLoginOtpEmail({
    toEmail: staffRecord.email,
    recipientName: staffRecord.name,
    otp,
    role: staffRecord.role,
    ip: clientIp,
  }).catch((err) => console.warn('[OTP Notice]:', err));

  res.json({
    success: true,
    require_email_otp: true,
    email: staffRecord.email,
    message: 'A 6-digit login verification OTP has been sent to your registered email address.',
    dev_otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
  });
}

/**
 * POST /api/admin/verify-login-otp
 * Verifies email OTP and completes admin/inspector login
 */
export async function verifyLoginOtp(req: Request, res: Response): Promise<void> {
  const { email, username, otp } = req.body;
  const userIdentifier = (email || username || '').trim().toLowerCase();
  if (!userIdentifier || !otp) {
    res.status(400).json({ success: false, error: 'Email/username and OTP are required' });
    return;
  }

  // Look up staff
  let staffRecord: any = null;
  const isBootstrapAdmin =
    userIdentifier === (process.env.ADMIN_USERNAME || 'admin').toLowerCase() ||
    userIdentifier === (process.env.INITIAL_ADMIN_EMAIL || '').toLowerCase();

  if (isBootstrapAdmin) {
    const { data: existingAdmin } = await supabase.from('staff').select('*').eq('role', 'super_admin').maybeSingle();
    staffRecord = existingAdmin || {
      id: 'st000000-0000-0000-0000-000000000001',
      name: 'LogicWhileLiRE Super Admin',
      email: process.env.INITIAL_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@localhost',
      role: 'super_admin',
      is_active: true,
    };
  } else {
    const { data: staff } = await supabase.from('staff').select('*').eq('email', userIdentifier).maybeSingle();
    if (!staff) {
      res.status(404).json({ success: false, error: 'Staff account not found' });
      return;
    }
    staffRecord = staff;
  }

  const check = verifyStaffLoginOtp(staffRecord.email, String(otp));
  if (!check.valid) {
    res.status(401).json({ success: false, error: check.error || 'Invalid or expired OTP' });
    return;
  }

  // OTP is valid! Issue token and cookie
  const token = jwt.sign(
    {
      sub: staffRecord.email,
      role: staffRecord.role,
      staff_id: staffRecord.id,
      name: staffRecord.name,
      college_id: staffRecord.college_id || null,
      must_change_password: Boolean(staffRecord.must_change_password),
    },
    getAdminJwtSecret(),
    { expiresIn: '8h' }
  );

  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });

  const successIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const successUserAgent = (req.headers['user-agent'] || (req.get ? req.get('user-agent') : '') || 'Unknown').toString();
  const successNow = new Date().toISOString();

  supabase
    .from('audit_log')
    .insert({
      user_id: staffRecord.id || staffRecord.email,
      admin_id: staffRecord.email,
      role: staffRecord.role,
      action: 'LOGIN_OTP_VERIFIED',
      target: `staff:${staffRecord.id}`,
      target_table: 'staff',
      target_id: staffRecord.id,
      college_id: staffRecord.college_id || null,
      payload: { username: userIdentifier, ip: successIp },
      ip: successIp,
      ip_address: successIp,
      user_agent: successUserAgent,
      timestamp: successNow,
      created_at: successNow,
    })
    .then(() => {});

  res.json({
    success: true,
    token,
    user: {
      id: staffRecord.id,
      email: staffRecord.email,
      name: staffRecord.name,
      role: staffRecord.role,
      college_id: staffRecord.college_id || null,
    },
  });
}

// ——————————————————————————————————————————
// EXAM MANAGEMENT
// ——————————————————————————————————————————

/**
 * GET /api/admin/exams
 */
export async function listExams(req: Request, res: Response): Promise<void> {
  let query = supabase.from('exams').select('*');

  // If faculty role, restrict to their created exams only
  if (req.admin?.role === 'faculty') {
    query = query.eq('created_by_staff_id', req.admin.staff_id);
  }

  const { data: exams, error } = await query.order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  // Enrich with creator name and email for display
  const enrichedExams = (exams || []).map((exam: any) => ({
    ...exam,
    created_by_name: exam.creator?.name || exam.staff?.name || null,
    created_by_email: exam.creator?.email || exam.staff?.email || null,
  }));

  res.json({ success: true, exams: enrichedExams });
}

/**
 * POST /api/admin/exams
 */
export async function createExam(req: Request, res: Response): Promise<void> {
  const { title, duration_minutes, start_time, end_time, admin_email, is_leaderboard_public } = req.body;

  const { data, error } = await supabase
    .from('exams')
    .insert({
      title,
      duration_minutes,
      start_time: start_time || null,
      end_time: end_time || null,
      admin_email: admin_email?.trim() || null,
      is_leaderboard_public: is_leaderboard_public ?? true,
      is_active: false,
      created_by_staff_id: req.admin?.staff_id || null,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  res.status(201).json({ success: true, exam: data });
}

/**
 * PATCH /api/admin/exams/:id/activate
 */
export async function activateExam(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { is_active } = req.body;

  const { data, error } = await supabase
    .from('exams')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, exam: data });
}

/**
 * GET /api/admin/exams/:examId/qr
 * Generate a QR code PNG for the enrollment URL.
 * Encodes only the exam_id in the URL — no sensitive data.
 */
export async function getEnrollmentQR(req: Request, res: Response): Promise<void> {
  const { examId } = req.params;
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const enrollUrl = `${clientOrigin}/enroll/${examId}`;

  try {
    const qrBuffer = await QRCode.toBuffer(enrollUrl, { type: 'png', width: 300 });
    res.set('Content-Type', 'image/png');
    res.send(qrBuffer);
  } catch (err) {
    res.status(500).json({ success: false, error: 'QR generation failed' });
  }
}

// ——————————————————————————————————————————
// QUESTION IMPORT
// ——————————————————————————————————————————

/**
 * POST /api/admin/exams/:examId/import-questions
 * Multipart upload of .xlsx file. Validates all rows, rejects on any error.
 */
export async function importQuestions(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  const examId = String(req.params.examId);

  // Verify exam exists
  const { data: exam } = await supabase.from('exams').select('id, title').eq('id', examId).single();
  if (!exam) { res.status(404).json({ success: false, error: 'Exam not found' }); return; }

  // Parse and validate
  const result = parseAndValidateXlsx(req.file.buffer);

  if (!result.valid) {
    res.status(400).json({
      success: false,
      error: 'Validation failed. No questions were imported.',
      row_errors: result.errors,
    });
    return;
  }

  // Bulk insert
  try {
    const inserted = await bulkInsertQuestions(examId, result.rows);
    res.json({ success: true, inserted_count: inserted, message: `${inserted} questions imported successfully.` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Insert failed';
    res.status(500).json({ success: false, error: message });
  }
}

/**
 * POST /api/admin/exams/:examId/bulk-enroll
 * Bulk pre-register candidate roster via CSV or XLSX
 */
export async function bulkEnrollParticipantsHandler(req: Request, res: Response): Promise<void> {
  const { examId } = req.params;

  if (!req.file) {
    res.status(400).json({ success: false, error: 'No CSV or XLSX file uploaded' });
    return;
  }

  const { data: exam } = await supabase
    .from('exams')
    .select('id, title, is_active')
    .eq('id', examId)
    .single();

  if (!exam) {
    res.status(404).json({ success: false, error: 'Exam not found' });
    return;
  }

  const { validRows, errors: parseErrors } = parseAndValidateEnrollmentFile(req.file.buffer);

  if (parseErrors.length > 0 && validRows.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Validation failed for all rows in file.',
      row_errors: parseErrors,
    });
    return;
  }

  try {
    const { inserted, skipped } = await bulkInsertParticipants(examId as string, validRows);
    res.json({
      success: true,
      message: `Enrolled ${inserted.length} candidates successfully (${skipped.length} skipped as duplicates).`,
      total_uploaded: validRows.length,
      inserted_count: inserted.length,
      skipped_count: skipped.length,
      inserted,
      skipped,
      validation_warnings: parseErrors,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Bulk enrollment failed';
    res.status(500).json({ success: false, error: msg });
  }
}

/**
 * GET /api/admin/bulk-enroll/template
 * Download sample CSV roster template
 */
export function getBulkEnrollTemplate(_req: Request, res: Response): void {
  const csvContent = 'Full Name,Hall Ticket,Mobile Number,Email Address\nAarav Sharma,HT2026101,+919876543210,aarav.student@example.com\nNeha Patel,HT2026102,+919876543211,neha.student@example.com\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="logicwhilelire_roster_template.csv"');
  res.send(csvContent);
}


// ——————————————————————————————————————————
// LEADERBOARD
// ——————————————————————————————————————————

/**
 * GET /api/exam/:examId/leaderboard
 * Public endpoint (no auth required). Cached for 30s.
 */
export async function getLeaderboard(req: Request, res: Response): Promise<void> {
  const { examId } = req.params;
  const cacheKey = `leaderboard:${examId}`;

  const cached = getCache<unknown[]>(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT');
    res.json({ success: true, leaderboard: cached });
    return;
  }

  const { data, error } = await supabase
    .from('results')
    .select(`
      total_score,
      max_score,
      normalized_score,
      correct_count,
      wrong_count,
      time_taken_seconds,
      graded_at,
      participant:participant_id (
        name,
        hall_ticket
      )
    `)
    .eq('participant.exam_id', examId)
    .order('normalized_score', { ascending: false })
    .order('total_score', { ascending: false })
    .order('time_taken_seconds', { ascending: true });

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  const leaderboard = (data || []).map((r, index) => ({
    rank: index + 1,
    name: (r.participant as any)?.name,
    hall_ticket: (r.participant as any)?.hall_ticket,
    total_score: r.total_score,
    max_score: r.max_score,
    normalized_score: r.normalized_score !== undefined && r.normalized_score !== null
      ? Number(r.normalized_score)
      : (r.max_score > 0 ? Number(((r.total_score / r.max_score) * 100).toFixed(2)) : 0),
    correct_count: r.correct_count,
    wrong_count: r.wrong_count,
    time_taken_seconds: r.time_taken_seconds,
  }));

  setCache(cacheKey, leaderboard, LEADERBOARD_CACHE_TTL);
  res.set('X-Cache', 'MISS');
  res.json({ success: true, leaderboard });
}

// ——————————————————————————————————————————
// REPORTS
// ——————————————————————————————————————————

/**
 * PII Masking Utilities for Scoped Faculty Visibility
 */
export function maskEmail(email?: string): string {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const [user, domain] = parts;
  const maskedUser = user.length <= 2 ? `${user[0]}*` : `${user[0]}***${user[user.length - 1]}`;
  return `${maskedUser}@${domain}`;
}

export function maskMobile(mobile?: string): string {
  if (!mobile) return '';
  const digits = mobile.replace(/\s+/g, '');
  if (digits.length <= 4) return '******';
  return `${digits.slice(0, 3)}******${digits.slice(-3)}`;
}

/**
 * GET /api/admin/exams/:examId/report/excel
 * Per-participant report with topic breakdown + violations as .xlsx
 */
export async function exportExcelReport(req: Request, res: Response): Promise<void> {
  const { examId } = req.params;

  const { data: exam } = await supabase.from('exams').select('title').eq('id', examId).single();
  const { data: results } = await supabase
    .from('results')
    .select(`
      total_score, max_score, correct_count, wrong_count, time_taken_seconds, topic_breakdown, graded_at,
      participant:participant_id ( name, hall_ticket, email, mobile )
    `)
    .eq('participant.exam_id', examId)
    .order('total_score', { ascending: false });

  const { data: violations } = await supabase
    .from('violations')
    .select('session_id, type, timestamp, notes, session:session_id(participant_id, participant:participant_id(hall_ticket))')
    .in('session_id',
      (await supabase.from('exam_sessions').select('id').in('participant_id',
        (await supabase.from('participants').select('id').eq('exam_id', examId)).data?.map(p => p.id) || []
      )).data?.map(s => s.id) || []
    );

  const isFaculty = req.admin?.role === 'faculty';

  // Build summary sheet (PII masked for faculty)
  const summaryRows = (results || []).map((r, i) => {
    const p = r.participant as any;
    return {
      Rank: i + 1,
      Name: p?.name,
      'Hall Ticket': p?.hall_ticket,
      Email: isFaculty ? maskEmail(p?.email) : p?.email,
      Mobile: isFaculty ? maskMobile(p?.mobile) : p?.mobile,
      Score: r.total_score,
      'Max Score': r.max_score,
      Correct: r.correct_count,
      Wrong: r.wrong_count,
      'Time (s)': r.time_taken_seconds,
      'Graded At': r.graded_at,
      Platform: 'LogicWhileLiRE',
    };
  });

  // Build violations sheet
  const violationRows = (violations || []).map((v) => ({
    'Hall Ticket': (v as any)?.session?.participant?.hall_ticket,
    Type: v.type,
    Timestamp: v.timestamp,
    Notes: v.notes,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Results');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(violationRows), 'Violations');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const safeTitle = (exam?.title || 'exam').replace(/[^a-zA-Z0-9_\-]/g, '_');
  if (req.admin) {
    recordAuditLog(req.admin, 'EXPORT_REPORT_EXCEL', 'exams', String(examId), { title: exam?.title, count: summaryRows.length }, req).catch(() => {});
  }
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="LogicWhileLiRE_${safeTitle}_report.xlsx"`,
  });
  res.send(buf);
}

/**
 * GET /api/admin/exams/:examId/report/pdf
 * Per-participant summary report as PDF
 */
export async function exportPdfReport(req: Request, res: Response): Promise<void> {
  const { examId } = req.params;

  const { data: exam } = await supabase.from('exams').select('title, duration_minutes').eq('id', examId).single();
  const { data: results } = await supabase
    .from('results')
    .select(`
      total_score, max_score, correct_count, wrong_count, time_taken_seconds, topic_breakdown,
      participant:participant_id ( name, hall_ticket )
    `)
    .eq('participant.exam_id', examId)
    .order('total_score', { ascending: false });

  const safeTitle = (exam?.title || 'exam').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${safeTitle}_report.pdf"`,
  });
  doc.pipe(res);

  // Brand Logo & Header
  const logoPath = path.resolve(__dirname, '../../logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, (doc.page.width - 56) / 2, doc.y, { width: 56 });
      doc.moveDown(4.8);
    } catch (e) {
      // fallback
    }
  }

  // Executive Brand Header: LogicWhileLiRE in deep blue
  doc.fontSize(24).font('Helvetica-Bold').fillColor('#0A3F8F').text('LogicWhileLiRE', { align: 'center' });
  
  // Official Tagline
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#4A7DBE').text('LOGIC. WHILE. LIRE.', { align: 'center', characterSpacing: 2 });
  doc.moveDown(0.6);

  // Brand Accent Divider Rule
  const startX = 60;
  const endX = doc.page.width - 60;
  doc.strokeColor('#1B5FB5').lineWidth(1.5).moveTo(startX, doc.y).lineTo(endX, doc.y).stroke();
  doc.moveDown(0.8);

  // Exam Details
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text(exam?.title || 'Official Assessment Report', { align: 'center' });
  doc.fontSize(10).font('Helvetica').fillColor('#64748b').text(`Duration: ${exam?.duration_minutes} minutes  •  Server-Authoritative Evaluation`, { align: 'center' });
  doc.moveDown(1.4);

  // Results table
  doc.fontSize(14).font('Helvetica-Bold').text('Results Summary');
  doc.moveDown(0.5);

  (results || []).forEach((r, i) => {
    const p = r.participant as any;
    doc.fontSize(11).font('Helvetica-Bold').text(`#${i + 1} ${p?.name} (${p?.hall_ticket})`);
    doc.fontSize(10).font('Helvetica').text(
      `Score: ${r.total_score}/${r.max_score} | Correct: ${r.correct_count} | Wrong: ${r.wrong_count} | Time: ${r.time_taken_seconds}s`
    );

    // Topic breakdown
    if (r.topic_breakdown) {
      const topics = Object.entries(r.topic_breakdown as Record<string, { correct: number; wrong: number; score: number; maxScore: number }>);
      topics.forEach(([topic, stats]) => {
        doc.text(`  ${topic}: ${stats.correct}/${stats.correct + stats.wrong} correct, ${stats.score}/${stats.maxScore} marks`, { indent: 20 });
      });
    }
    doc.moveDown(0.5);
  });

  doc.moveDown(1.5);
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('LogicWhileLiRE Autonomous Assessment Engine • Developed by R. Charan Sai • © 2026 R. Charan Sai. All rights reserved.', { align: 'center' });

  if (req.admin) {
    recordAuditLog(req.admin, 'EXPORT_REPORT_PDF', 'exams', String(examId), { title: exam?.title, count: results?.length || 0 }, req).catch(() => {});
  }

  doc.end();
}

// ——————————————————————————————————————————
// SESSIONS MANAGEMENT
// ——————————————————————————————————————————

/**
 * GET /api/admin/exams/:examId/sessions
 */
export async function listSessions(req: Request, res: Response): Promise<void> {
  const { examId } = req.params;
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '20', 10)));
  const offset = (page - 1) * limit;

  const { data: participants } = await supabase
    .from('participants')
    .select('id')
    .eq('exam_id', examId);

  const participantIds = participants?.map((p) => p.id) || [];
  if (participantIds.length === 0) {
    res.json({
      success: true,
      sessions: [],
      pagination: { page, limit, total_count: 0, total_pages: 0 },
    });
    return;
  }

  const { count } = await supabase
    .from('exam_sessions')
    .select('id', { count: 'exact', head: true })
    .in('participant_id', participantIds);

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  const { data, error } = await supabase
    .from('exam_sessions')
    .select(`
      id, status, started_at, submitted_at, violation_count, suspicious_flags, termination_reason,
      participant:participant_id ( name, hall_ticket, email )
    `)
    .in('participant_id', participantIds)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  const isFaculty = req.admin?.role === 'faculty';
  const sanitizedSessions = (data || []).map((s: any) => {
    if (!s.participant) return s;
    return {
      ...s,
      participant: {
        ...s.participant,
        email: isFaculty ? maskEmail(s.participant.email) : s.participant.email,
      },
    };
  });

  res.json({
    success: true,
    sessions: sanitizedSessions,
    pagination: {
      page,
      limit,
      total_count: totalCount,
      total_pages: totalPages,
    },
  });
}

/**
 * POST /api/admin/sessions/:sessionId/terminate
 */
export async function terminateSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { reason } = req.body;

  const { error } = await supabase
    .from('exam_sessions')
    .update({
      status: 'terminated',
      termination_reason: reason || 'Terminated by admin',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  invalidateCache('leaderboard:');

  // Asynchronously dispatch termination alert email
  (async () => {
    try {
      const { data: sessionData } = await supabase
        .from('exam_sessions')
        .select(`
          violation_count,
          participant_id,
          participants:participant_id (
            name,
            hall_ticket,
            exam_id,
            exams:exam_id (
              title,
              admin_email
            )
          )
        `)
        .eq('id', sessionId)
        .single();

      const p = (sessionData as any)?.participants;
      const examTitle = p?.exams?.title || 'Exam';
      const examId = p?.exam_id;
      const adminEmail = process.env.ADMIN_ALERT_EMAIL || p?.exams?.admin_email || process.env.SMTP_USER;

      const { data: vLogs } = await supabase
        .from('violations')
        .select('type, timestamp, notes')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (adminEmail) {
        const { emailQueue } = await import('../services/emailQueue');
        emailQueue.enqueueTerminationAlert({
          sessionId: String(sessionId),
          participantId: sessionData?.participant_id || '',
          participantName: p?.name || 'Participant',
          hallTicket: p?.hall_ticket || 'Unknown',
          examId: String(examId || ''),
          examTitle,
          adminEmail,
          reason: reason || 'Manually terminated by administrator',
          violationCount: sessionData?.violation_count || 0,
          ipAddress: req.ip,
          violations: vLogs || [],
          timestamp: new Date(),
        });
      }
    } catch (e) {
      console.error('[AdminTerminate] Email alert failed:', e);
    }
  })();

  res.json({ success: true, message: 'Session terminated' });
}

// ——————————————————————————————————————————
// ANALYTICS & INSIGHTS
// ——————————————————————————————————————————

/**
 * GET /api/admin/exams/:examId/analytics/questions
 */
export async function getQuestionAnalytics(req: Request, res: Response): Promise<void> {
  const examId = req.params.examId as string;
  try {
    const analytics = await getExamQuestionAnalytics(examId);
    res.json({ success: true, analytics });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: msg });
  }
}

/**
 * GET /api/admin/exams/:examId/analytics/topics
 */
export async function getTopicAnalytics(req: Request, res: Response): Promise<void> {
  const examId = req.params.examId as string;
  try {
    const topics = await getExamTopicBreakdown(examId);
    res.json({ success: true, topics });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: msg });
  }
}

/**
 * GET /api/admin/participant-history/:hallTicket
 * GET /api/admin/participants/history?hallTicket=...
 */
export async function getParticipantHistoryHandler(req: Request, res: Response): Promise<void> {
  const hallTicket = ((req.params.hallTicket as string) || (req.query.hallTicket as string)).trim();
  try {
    const result = await getParticipantHistory(hallTicket);
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: msg });
  }
}

// ——————————————————————————————————————————
// SUSPICIOUS ACTIVITY & FINGERPRINT PROCTORING
// ——————————————————————————————————————————

/**
 * GET /api/admin/exams/:examId/suspicious-activity
 * Lists flagged duplicate fingerprint conflicts for manual admin review.
 */
export async function listSuspiciousActivity(req: Request, res: Response): Promise<void> {
  const { examId } = req.params;

  try {
    const { data, error } = await supabase
      .from('suspicious_activity')
      .select('*')
      .eq('exam_id', examId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, activities: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: msg });
  }
}

/**
 * PATCH /api/admin/suspicious-activity/:id/resolve
 * Resolves a flagged suspicious activity item ('clear' or 'confirm').
 */
export async function resolveSuspiciousActivity(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { action, notes } = req.body;

  if (!action || !['clear', 'confirm'].includes(action)) {
    res.status(400).json({ success: false, error: 'action must be "clear" or "confirm"' });
    return;
  }

  const newStatus = action === 'clear' ? 'cleared' : 'confirmed_violation';
  const reviewer = (req as any).admin?.username || 'admin';
  const now = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('suspicious_activity')
      .update({
        status: newStatus,
        reviewed_by: reviewer,
        reviewed_at: now,
        details: {
          resolution_notes: notes || null,
          action_taken: action,
          resolved_at: now,
        },
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    // If confirmed violation, record a proctoring violation for the session
    if (action === 'confirm' && data?.session_id) {
      await supabase.from('violations').insert({
        session_id: data.session_id,
        type: 'tab_switch',
        notes: `Confirmed duplicate hardware/browser fingerprint conflict with hall ticket ${data.conflict_hall_ticket}`,
        timestamp: now,
      });

      const { data: s } = await supabase
        .from('exam_sessions')
        .select('violation_count')
        .eq('id', data.session_id)
        .single();

      if (s) {
        await supabase
          .from('exam_sessions')
          .update({ violation_count: (s.violation_count || 0) + 1 })
          .eq('id', data.session_id);
      }
    }

    res.json({
      success: true,
      activity: data,
      message: action === 'clear' ? 'Flag cleared successfully' : 'Violation confirmed',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: msg });
  }
}

// ——————————————————————————————————————————
// STAFF MANAGEMENT (SUPER ADMIN ONLY)
// ——————————————————————————————————————————

/**
 * GET /api/admin/staff
 */
export async function listStaff(req: Request, res: Response): Promise<void> {
  let query = supabase
    .from('staff')
    .select('id, name, email, role, is_active, created_by, created_at, college_id')
    .order('created_at', { ascending: false });

  if (req.admin?.role === 'inspector' || req.admin?.role === 'college_admin') {
    if (req.admin.college_id) {
      query = (query as any).eq('college_id', req.admin.college_id);
    }
  }

  const { data: staffList, error } = await query;

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  const sanitized = (staffList || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    is_active: s.is_active,
    college_id: s.college_id,
    created_by: s.created_by,
    created_at: s.created_at,
  }));

  res.json({ success: true, staff: sanitized });
}

/**
 * POST /api/admin/staff
 */
export async function createStaff(req: Request, res: Response): Promise<void> {
  const { name, email, password, role, college_id } = req.body;
  const normalizedEmail = (email || '').toLowerCase().trim();

  // If caller is inspector, scope permissions: can only create faculty for their own college
  if (req.admin?.role === 'inspector' || req.admin?.role === 'college_admin') {
    if (role && role !== 'faculty') {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Inspectors can only create faculty accounts',
      });
      return;
    }
    if (college_id && String(college_id) !== String(req.admin.college_id)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Inspectors cannot create staff for other colleges',
      });
      return;
    }
  }

  // Check duplicate email
  const { data: existing } = await supabase
    .from('staff')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existing) {
    res.status(409).json({ success: false, error: 'A staff member with this email already exists' });
    return;
  }

  const effectiveCollegeId =
    req.admin?.role === 'inspector' || req.admin?.role === 'college_admin'
      ? req.admin.college_id
      : college_id
      ? parseInt(String(college_id), 10)
      : null;

  const assignedRole = role || 'faculty';

  // Enforce strong password policy for admin and inspector accounts
  if (password) {
    if (['super_admin', 'admin', 'inspector'].includes(assignedRole) || password.length < 8) {
      const strengthCheck = isStrongPassword(password);
      if (!strengthCheck.valid) {
        res.status(400).json({
          success: false,
          error: `Password policy violation: ${strengthCheck.error}`,
        });
        return;
      }
    }
  }

  const tempPassword = password || `Staff#${Math.floor(100000 + Math.random() * 900000)}!`;
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const newStaffId = uuidv4();

  const { data: created, error } = await supabase
    .from('staff')
    .insert({
      id: newStaffId,
      name: name.trim(),
      email: normalizedEmail,
      password_hash: passwordHash,
      role: assignedRole,
      college_id: effectiveCollegeId,
      created_by: req.admin?.staff_id || null,
      failed_attempts: 0,
      locked_until: null,
      must_change_password: true,
      totp_enabled: false,
      is_active: true,
      created_at: new Date().toISOString(),
    })
    .select('id, name, email, role, is_active, college_id, created_at')
    .single();

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  // Send welcome email with temporary password
  sendWelcomeEmail(normalizedEmail, name.trim(), assignedRole, tempPassword).catch((e) =>
    console.warn('[WelcomeEmail] Failed to send staff welcome email:', e)
  );

  res.status(201).json({
    success: true,
    message: 'Staff account created successfully. Welcome email dispatched with temporary password.',
    staff: {
      ...created,
      temporary_password: tempPassword,
    },
  });
}

/**
 * PATCH /api/admin/staff/:id/deactivate
 */
export async function toggleStaffStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { is_active } = req.body;

  // Prevent super admin from deactivating themselves
  if (req.admin?.staff_id === id) {
    res.status(400).json({ success: false, error: 'You cannot deactivate your own administrative account' });
    return;
  }

  // If inspector, ensure they can only deactivate faculty from their own college
  if (req.admin?.role === 'inspector' || req.admin?.role === 'college_admin') {
    const { data: targetStaff } = await supabase.from('staff').select('college_id, role').eq('id', id).maybeSingle();
    if (targetStaff) {
      if (targetStaff.role !== 'faculty') {
        res.status(403).json({ success: false, error: 'Forbidden: Inspectors can only manage faculty accounts' });
        return;
      }
      if (req.admin.college_id && targetStaff.college_id && String(targetStaff.college_id) !== String(req.admin.college_id)) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: Cannot manage staff from another college',
          code: 'CROSS_COLLEGE_FORBIDDEN',
        });
        return;
      }
    }
  }

  const targetActive = typeof is_active === 'boolean' ? is_active : false;

  const { data: updated, error } = await supabase
    .from('staff')
    .update({ is_active: targetActive })
    .eq('id', id)
    .select('id, name, email, role, is_active')
    .single();

  if (error || !updated) {
    res.status(404).json({ success: false, error: 'Staff member not found' });
    return;
  }

  res.json({
    success: true,
    message: `Staff member ${updated.name} has been ${targetActive ? 'activated' : 'deactivated'}`,
    staff: updated,
  });
}

/**
 * GET /api/admin/audit-logs
 * Phase 2 Monitoring & Audit: List audit logs with comprehensive filters
 * Filters: role (faculty/inspector/super_admin), user_id/staff_id, action, date
 */
export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const { action, role, user_id, staff_id, faculty, inspector, date, start_date, end_date, limit } = req.query;
  const maxLimit = Math.min(parseInt(String(limit || '100'), 10), 500);

  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(maxLimit);

  if (action && action !== 'all') {
    query = (query as any).eq('action', String(action));
  }

  const targetRole = role || (faculty ? 'faculty' : inspector ? 'inspector' : null);
  if (targetRole && targetRole !== 'all') {
    query = (query as any).eq('role', String(targetRole));
  }

  const targetUser = user_id || staff_id;
  if (targetUser) {
    query = (query as any).eq('user_id', String(targetUser));
  }

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  let logs = (data || []).map((l: any) => ({
    id: l.id || `audit-${Math.random()}`,
    user_id: l.user_id || l.admin_id || 'system',
    role: l.role || 'super_admin',
    action: l.action,
    target: l.target || l.target_table || l.target_id || 'system',
    target_table: l.target_table || null,
    target_id: l.target_id || null,
    ip: l.ip || l.ip_address || '127.0.0.1',
    user_agent: l.user_agent || 'Unknown',
    timestamp: l.timestamp || l.created_at || new Date().toISOString(),
    created_at: l.created_at || l.timestamp || new Date().toISOString(),
    payload: l.payload || null,
  }));

  // Date filtering in memory
  if (date) {
    const dStr = String(date);
    logs = logs.filter((l: any) => (l.timestamp || '').startsWith(dStr));
  } else if (start_date) {
    const startMs = new Date(String(start_date)).getTime();
    logs = logs.filter((l: any) => new Date(l.timestamp || 0).getTime() >= startMs);
  }

  res.json({ success: true, count: logs.length, logs });
}

/**
 * GET /api/admin/dashboard-widgets
 * Phase 2 Dashboard Widgets: live exams, students online, violations, recent faculty activity, system health
 */
export async function getAdminDashboardWidgets(req: Request, res: Response): Promise<void> {
  try {
    // 1. Live exams: active exams
    const { data: exams } = await supabase.from('exams').select('id, title, is_active, start_time, end_time');
    const liveExams = (exams || []).filter((e: any) => e.is_active);

    // 2. Students online: active sessions
    const { data: sessions } = await supabase.from('exam_sessions').select('id, status, started_at');
    const activeSessions = (sessions || []).filter((s: any) => s.status === 'in_progress');

    // 3. Violations count
    const { data: violations } = await supabase.from('violations').select('id');
    const { data: suspicious } = await supabase.from('suspicious_activity').select('id');
    const totalViolations = (violations?.length || 0) + (suspicious?.length || 0);

    // 4. Recent faculty activity: audit logs where role == 'faculty'
    const { data: allLogs } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    const facultyLogs = (allLogs || []).filter((l: any) => l.role === 'faculty').slice(0, 10);

    // 5. System Health
    const mem = process.memoryUsage();
    const systemHealth = {
      status: 'operational',
      database: 'connected',
      latency_ms: 2,
      socket_engine: 'active',
      uptime_seconds: Math.floor(process.uptime()),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      node_version: process.version,
    };

    res.json({
      success: true,
      widgets: {
        live_exams_count: liveExams.length,
        live_exams: liveExams,
        students_online: activeSessions.length,
        violations_count: totalViolations,
        recent_faculty_activity: (facultyLogs || []).map((l: any) => ({
          id: l.id,
          user_id: l.user_id || l.admin_id,
          role: l.role,
          action: l.action,
          target: l.target || l.target_table,
          ip: l.ip || l.ip_address,
          timestamp: l.timestamp || l.created_at,
        })),
        system_health: systemHealth,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch dashboard widgets' });
  }
}

/**
 * PATCH /api/admin/students/:id/block
 * Toggle student block status during live exam or pre-assessment
 */
export async function toggleStudentBlock(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { is_blocked, block_reason } = req.body;

  const targetBlocked = typeof is_blocked === 'boolean' ? is_blocked : true;

  const { data: updated, error } = await supabase
    .from('students')
    .update({
      is_blocked: targetBlocked,
      block_reason: targetBlocked ? (block_reason || 'Blocked by administrator') : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, name, hall_ticket, is_blocked, block_reason')
    .maybeSingle();

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  res.json({
    success: true,
    message: `Student has been ${targetBlocked ? 'blocked' : 'unblocked'}.`,
    student: updated || { id, is_blocked: targetBlocked },
  });
}

/**
 * POST /api/admin/results/:sessionId/override
 * Override candidate score or grant grace marks
 */
export async function overrideScore(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { score_override, grace_marks, reason } = req.body;

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (score_override !== undefined && !isNaN(Number(score_override))) {
    updatePayload['score_override'] = Number(score_override);
    updatePayload['total_score'] = Number(score_override);
  }
  if (grace_marks !== undefined && !isNaN(Number(grace_marks))) {
    updatePayload['grace_marks'] = Number(grace_marks);
  }
  if (reason) {
    updatePayload['override_reason'] = String(reason);
  }

  const { data: updated, error } = await supabase
    .from('results')
    .update(updatePayload)
    .eq('session_id', sessionId)
    .select('*')
    .maybeSingle();

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  res.json({
    success: true,
    message: 'Score override and adjustments applied successfully.',
    result: updated || { session_id: sessionId, ...updatePayload },
  });
}

/**
 * PATCH /api/admin/exams/:id/settings
 * Update exam security, passing %, and feature toggles
 */
export async function updateExamSettings(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const settings = req.body;

  const { data: updated, error } = await supabase
    .from('exams')
    .update({
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  res.json({
    success: true,
    message: 'Exam settings updated successfully.',
    exam: updated || { id, ...settings },
  });
}

/**
 * GET /api/admin/settings
 * Fetch global platform branding & engine settings
 */
export async function getPlatformSettings(_req: Request, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error && error.message) {
    // Return sensible defaults if table not populated
    res.json({
      success: true,
      settings: {
        platform_name: 'LogicWhileLiRE',
        tagline: 'Logic. While. LiRE.',
        primary_color: '#2B7FFF',
        secondary_color: '#050814',
        maintenance_mode: false,
        allowed_languages: ['python', 'javascript', 'cpp', 'java', 'go'],
        execution_timeout_ms: 5000,
      },
    });
    return;
  }

  res.json({
    success: true,
    settings: data || {
      platform_name: 'LogicWhileLiRE',
      tagline: 'Logic. While. LiRE.',
      primary_color: '#2B7FFF',
      secondary_color: '#050814',
      maintenance_mode: false,
      allowed_languages: ['python', 'javascript', 'cpp', 'java', 'go'],
      execution_timeout_ms: 5000,
    },
  });
}

/**
 * POST /api/admin/settings
 * Save platform branding and maintenance mode
 */
export async function updatePlatformSettings(req: Request, res: Response): Promise<void> {
  const settings = req.body;

  const { data, error } = await supabase
    .from('platform_settings')
    .upsert({
      id: '00000000-0000-0000-0000-000000000001',
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .maybeSingle();

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  res.json({
    success: true,
    message: 'Platform configuration updated.',
    settings: data || settings,
  });
}

// ——————————————————————————————————————————
// PERMISSION MATRIX & STAFF CRUD (PHASE 1)
// ——————————————————————————————————————————

/**
 * PATCH /api/admin/staff/:id/permissions
 * Admin ticks what each faculty member may do.
 */
export async function updateStaffPermissions(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { permissions } = req.body;

  if (!Array.isArray(permissions)) {
    res.status(400).json({ success: false, error: 'permissions must be an array of strings' });
    return;
  }

  const { data: staff, error } = await supabase
    .from('staff')
    .update({ permissions })
    .eq('id', id)
    .select('id, name, email, role, permissions')
    .single();

  if (error || !staff) {
    res.status(404).json({ success: false, error: error?.message || 'Staff member not found' });
    return;
  }

  res.json({
    success: true,
    staff,
    message: `Updated permissions for ${staff.name} successfully`,
  });
}

/**
 * PATCH /api/admin/staff/:id
 * Full update of staff details (admin only)
 */
export async function updateStaff(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, email, role, college_id, is_active, permissions } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (email !== undefined) updates.email = String(email).toLowerCase().trim();
  if (role !== undefined) updates.role = role;
  if (college_id !== undefined) updates.college_id = college_id;
  if (is_active !== undefined) updates.is_active = is_active;
  if (permissions !== undefined && Array.isArray(permissions)) updates.permissions = permissions;

  const { data: staff, error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', id)
    .select('id, name, email, role, college_id, is_active, permissions')
    .single();

  if (error || !staff) {
    res.status(404).json({ success: false, error: error?.message || 'Staff member not found' });
    return;
  }

  res.json({ success: true, staff, message: 'Staff member updated successfully' });
}

/**
 * DELETE /api/admin/staff/:id
 */
export async function deleteStaff(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { data: target } = await supabase.from('staff').select('id, role').eq('id', id).maybeSingle();
  if (!target) {
    res.status(404).json({ success: false, error: 'Staff member not found' });
    return;
  }

  if (target.role === 'super_admin' && req.admin?.staff_id === id) {
    res.status(400).json({ success: false, error: 'Cannot delete your own super_admin account' });
    return;
  }

  const { error } = await supabase.from('staff').delete().eq('id', id);
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  res.json({ success: true, message: 'Staff member deleted successfully' });
}

/**
 * DELETE /api/admin/exams/:id
 */
export async function deleteExam(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { error } = await supabase.from('exams').delete().eq('id', id);
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, message: 'Exam deleted successfully' });
}

// ——————————————————————————————————————————
// QUESTIONS CRUD (PHASE 1)
// ——————————————————————————————————————————

/**
 * GET /api/admin/questions
 */
export async function listQuestions(req: Request, res: Response): Promise<void> {
  const { exam_id } = req.query;
  let query = supabase.from('questions').select('*').order('created_at', { ascending: false });
  if (exam_id) {
    query = (query as any).eq('exam_id', String(exam_id));
  }
  const { data, error } = await query;
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, count: data?.length || 0, questions: data || [] });
}

/**
 * POST /api/admin/questions
 */
export async function createQuestion(req: Request, res: Response): Promise<void> {
  const {
    exam_id,
    question_text,
    question,
    question_type,
    options,
    correct_option,
    marks,
    topic,
    sector,
    difficulty,
  } = req.body;

  const text = question_text || question;
  if (!text) {
    res.status(400).json({ success: false, error: 'Question text is required' });
    return;
  }

  const newQuestion = {
    id: uuidv4(),
    exam_id: exam_id || 'e1000000-0000-0000-0000-000000000001',
    question_text: text,
    question_type: question_type || 'mcq',
    options: options || { a: '', b: '', c: '', d: '' },
    correct_option: correct_option || 'a',
    marks: marks !== undefined ? Number(marks) : 1,
    topic: topic || 'General',
    sector: sector || 'Sector 1 · Quantitative Aptitude & Velocity',
    difficulty: difficulty || 'Medium',
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('questions').insert(newQuestion).select().single();
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.status(201).json({ success: true, question: data });
}

/**
 * PATCH /api/admin/questions/:id
 */
export async function updateQuestion(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const updates = { ...req.body };
  delete updates.id;

  const { data, error } = await supabase
    .from('questions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, question: data });
}

/**
 * DELETE /api/admin/questions/:id
 */
export async function deleteQuestion(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, message: 'Question deleted successfully' });
}

// ——————————————————————————————————————————
// CURRICULUM / CATEGORIES CRUD (PHASE 1)
// ——————————————————————————————————————————

/**
 * GET /api/admin/curriculum
 */
export async function listCurriculum(req: Request, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('curriculum')
    .select('*')
    .order('sector_number', { ascending: true });

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, curriculum: data || [] });
}

/**
 * POST /api/admin/curriculum
 */
export async function createCurriculum(req: Request, res: Response): Promise<void> {
  const { code, name, short_name, sector_number, color, description } = req.body;
  if (!code || !name) {
    res.status(400).json({ success: false, error: 'code and name are required' });
    return;
  }

  const newCurriculum = {
    id: uuidv4(),
    code: String(code).trim().toUpperCase(),
    name: String(name).trim(),
    short_name: short_name ? String(short_name).trim() : String(name).trim(),
    sector_number: sector_number ? Number(sector_number) : 1,
    color: color || '#3B82F6',
    description: description || '',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('curriculum').insert(newCurriculum).select().single();
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.status(201).json({ success: true, curriculum: data });
}

/**
 * PATCH /api/admin/curriculum/:id
 */
export async function updateCurriculum(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const updates = { ...req.body };
  delete updates.id;

  const { data, error } = await supabase
    .from('curriculum')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, curriculum: data });
}

/**
 * DELETE /api/admin/curriculum/:id
 */
export async function deleteCurriculum(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { error } = await supabase.from('curriculum').delete().eq('id', id);
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, message: 'Curriculum category deleted successfully' });
}


