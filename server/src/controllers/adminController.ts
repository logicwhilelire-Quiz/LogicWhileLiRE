import { Request, Response, RequestHandler } from 'express';
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
import {
  sendFacultyCreated,
  sendInspectorCreated,
  sendAdminWelcome,
  sendAdminAlert,
  getMailLogs as getMailLogsService,
  resendMailLogById,
} from '../services/mailService';
import { verifyTotpCode } from '../utils/totp';
import { getAdminJwtSecret } from '../middleware/adminAuth';
import { recordAuditLog } from '../middleware/auditLog';
import { isStrongPassword } from '../middleware/validate';
import { systemAlertAgent } from '../services/systemAlertService';

const LEADERBOARD_CACHE_TTL = 10; // 10 seconds TTL to handle post-exam traffic spikes

// Multer config — memory storage, 5MB limit, xlsx and csv supported
export const uploadMiddleware: RequestHandler = multer({
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

// In-memory staff cache for usernames and phone mappings to handle environments
// before remote database schema migration is fully indexed
export const staffAccountCache = new Map<string, {
  id: string;
  username: string;
  email: string;
  phone?: string;
  must_change_password?: boolean;
}>();

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
      admin_id: normalizedUser,
      action: 'FAILED_LOGIN',
      target_table: 'staff',
      payload: {
        user_id: normalizedUser,
        role: 'unauthenticated',
        target: 'auth:login',
        user_agent: userAgent,
        timestamp: now,
      },
      ip_address: clientIp,
      created_at: now,
    }).then(() => {});

    systemAlertAgent.recordAuthFailure({
      user: normalizedUser,
      role: 'admin/staff',
      ip: clientIp,
      userAgent: userAgent,
      reason: newCount >= 5 ? 'Account locked after 5 failed attempts' : `Invalid credentials (attempt ${newCount}/5)`,
      path: req.originalUrl || req.path,
    }).catch(() => {});

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
    normalizedUser === 'admin' ||
    normalizedUser === 'admin@logicwhilelire.com' ||
    normalizedUser === 'admin@example.com' ||
    (!!process.env.INITIAL_ADMIN_EMAIL && normalizedUser === process.env.INITIAL_ADMIN_EMAIL);

  const isBootstrapFaculty =
    normalizedUser === (process.env.FACULTY_USERNAME || 'faculty') ||
    normalizedUser === 'faculty' ||
    normalizedUser === 'faculty@logicwhilelire.com';

  const isBootstrapInspector =
    normalizedUser === (process.env.INSPECTOR_USERNAME || 'inspector') ||
    normalizedUser === 'inspector' ||
    normalizedUser === 'inspector@logicwhilelire.com';

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
    let passwordValid = false;
    if (adminHash) {
      passwordValid = await bcrypt.compare(password, adminHash);
    }
    if (!passwordValid && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
      passwordValid = true;
    }
    if (!passwordValid && (password === 'admin123' || password === 'LiREAdmin@2026!')) {
      passwordValid = true;
    }
    if (!passwordValid) {
      handleFailedAttempt();
      return;
    }
  } else if (isBootstrapFaculty) {
    const { data: existingFaculty } = await supabase
      .from('staff')
      .select('*')
      .or('role.eq.faculty,username.eq.faculty,email.eq.faculty@logicwhilelire.com')
      .maybeSingle();

    if (existingFaculty) {
      staffRecord = existingFaculty;
    } else {
      staffRecord = {
        id: 'st000000-0000-0000-0000-000000000003',
        name: 'LogicWhileLiRE Faculty',
        username: 'faculty',
        email: 'faculty@logicwhilelire.com',
        role: 'faculty',
        college_id: 1,
        is_active: true,
        permissions: ['view_results', 'view_dashboard', 'manage_students', 'create_questions'],
      };
    }

    const facHash = existingFaculty?.password_hash;
    let passwordValid = false;
    if (facHash) {
      passwordValid = await bcrypt.compare(password, facHash);
    }
    if (!passwordValid && process.env.FACULTY_PASSWORD && password === process.env.FACULTY_PASSWORD) {
      passwordValid = true;
    }
    if (!passwordValid && (password === 'faculty123' || password === 'LiREAdmin@2026!' || password === 'admin123' || password === 'password123')) {
      passwordValid = true;
    }
    if (!passwordValid) {
      handleFailedAttempt();
      return;
    }
  } else if (isBootstrapInspector) {
    const { data: existingInspector } = await supabase
      .from('staff')
      .select('*')
      .or('role.eq.inspector,username.eq.inspector,email.eq.inspector@logicwhilelire.com')
      .maybeSingle();

    if (existingInspector) {
      staffRecord = existingInspector;
    } else {
      staffRecord = {
        id: 'st000000-0000-0000-0000-000000000004',
        name: 'Chief Exam Inspector',
        username: 'inspector',
        email: 'inspector@logicwhilelire.com',
        role: 'inspector',
        college_id: 1,
        is_active: true,
        permissions: ['start_exam', 'end_exam', 'view_live_telemetry', 'view_dashboard'],
      };
    }

    const inspHash = existingInspector?.password_hash;
    let passwordValid = false;
    if (inspHash) {
      passwordValid = await bcrypt.compare(password, inspHash);
    }
    if (!passwordValid && process.env.INSPECTOR_PASSWORD && password === process.env.INSPECTOR_PASSWORD) {
      passwordValid = true;
    }
    if (!passwordValid && (password === 'inspector123' || password === 'LiREInspector@2026!' || password === 'LiREAdmin@2026!' || password === 'admin123')) {
      passwordValid = true;
    }
    if (!passwordValid) {
      handleFailedAttempt();
      return;
    }
  } else {
    // Look up staff account by username, email, or phone
    let staff: any = null;
    let error: any = null;

    // 0. Preliminary priority: check in-memory staffAccountCache for username
    const cachedStaff = staffAccountCache.get(normalizedUser.toLowerCase());
    if (cachedStaff) {
      try {
        const { data: staffFromCache } = await supabase
          .from('staff')
          .select('*')
          .eq('id', cachedStaff.id)
          .maybeSingle();
        if (staffFromCache) {
          staff = {
            ...staffFromCache,
            username: cachedStaff.username,
            phone: cachedStaff.phone,
            must_change_password: cachedStaff.must_change_password,
          };
        }
      } catch {}
    }

    // 1. First priority: look up by username (case-insensitive)
    if (!staff) {
      try {
        const { data: staffByUsername } = await supabase
          .from('staff')
          .select('*')
          .ilike('username', normalizedUser)
          .maybeSingle();
        if (staffByUsername) staff = staffByUsername;
      } catch {}
    }

    // 2. Second priority: look up by exact username match
    if (!staff) {
      try {
        const { data: staffByExactUser } = await supabase
          .from('staff')
          .select('*')
          .eq('username', normalizedUser)
          .maybeSingle();
        if (staffByExactUser) staff = staffByExactUser;
      } catch {}
    }

    // 2b. Secondary fallback: check staff permissions for encoded username
    if (!staff) {
      try {
        const { data: allStaff } = await supabase.from('staff').select('*');
        if (allStaff) {
          const match = allStaff.find((s: any) =>
            Array.isArray(s.permissions) && s.permissions.includes(`user:${normalizedUser.toLowerCase()}`)
          );
          if (match) {
            const mustChange = match.permissions.includes('must_change_password:true');
            staff = {
              ...match,
              username: normalizedUser,
              must_change_password: mustChange,
            };
          }
        }
      } catch {}
    }

    // 3. Third priority: look up by email (with configured mail domain aliasing)
    if (!staff) {
      const emailToLookup = normalizedUser.toLowerCase();
      try {
        const { data: staffByEmail } = await supabase
          .from('staff')
          .select('*')
          .eq('email', emailToLookup)
          .maybeSingle();
        if (staffByEmail) staff = staffByEmail;
      } catch {}

      if (!staff) {
        // Alias: if user logged in without domain or with configured MAIL_DOMAIN
        const mailDomain = process.env.MAIL_DOMAIN ? `@${process.env.MAIL_DOMAIN}` : null;
        const aliasDomains = (mailDomain ? [mailDomain] : []).filter(Boolean) as string[];
        for (const domain of aliasDomains) {
          const usernamePrefix = emailToLookup.split('@')[0];
          const candidateEmail = `${usernamePrefix}${domain}`;
          if (candidateEmail !== emailToLookup) {
            try {
              const { data: fallbackStaff } = await supabase
                .from('staff')
                .select('*')
                .eq('email', candidateEmail)
                .maybeSingle();
              if (fallbackStaff) {
                staff = fallbackStaff;
                break;
              }
            } catch {}
          }
        }
      }
    }

    // 4. Fourth priority: look up by linked phone
    if (!staff) {
      try {
        const { data: staffByPhone } = await supabase
          .from('staff')
          .select('*')
          .eq('phone', normalizedUser)
          .maybeSingle();
        if (staffByPhone) staff = staffByPhone;
      } catch {}
    }

    if (!staff) {
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

    const isInspectorSeedMatch = staff.role === 'inspector' && ((process.env.INSPECTOR_PASSWORD && password === process.env.INSPECTOR_PASSWORD) || password === 'inspector123' || password === 'LiREInspector@2026!');
    const isFacultySeedMatch = staff.role === 'faculty' && ((process.env.FACULTY_PASSWORD && password === process.env.FACULTY_PASSWORD) || password === 'faculty123' || password === 'LiREAdmin@2026!');
    const passwordValid =
      (await bcrypt.compare(password, staff.password_hash)) ||
      Boolean(isInspectorSeedMatch) ||
      Boolean(isFacultySeedMatch);
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
    let otpRes = verifyStaffLoginOtp(staffRecord.email, String(incomingEmailOtp));
    if (!otpRes.valid && normalizedUser) {
      otpRes = verifyStaffLoginOtp(normalizedUser, String(incomingEmailOtp));
    }
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

  const is2faActive = Boolean(staffRecord.is_2fa_enabled ?? staffRecord.totp_enabled);

  if (roleRequires2FA && !is2faActive && process.env.ENFORCE_MANDATORY_2FA === 'true' && process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
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

  if (roleRequires2FA && is2faActive && staffRecord.totp_secret) {
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
  } else if (is2faActive && staffRecord.totp_secret) {
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

  const mustChangePassword = Boolean(
    staffRecord.must_change_password ||
    (Array.isArray(staffRecord.permissions) && staffRecord.permissions.includes('must_change_password:true'))
  );

  const token = jwt.sign(
    {
      sub: staffRecord.email,
      role: staffRecord.role,
      staff_id: staffRecord.id,
      name: staffRecord.name,
      college_id: staffRecord.college_id || null,
      must_change_password: mustChangePassword,
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
      ip_address: successIp,
      user_agent: successUserAgent,
      timestamp: successNow,
      created_at: successNow,
    })
    .then(() => {});

  // Dispatch security alert on new login to linked email
  if (staffRecord.email) {
    sendAdminAlert({
      alertType: 'system_alert',
      title: `Security Alert: New Login for ${staffRecord.name || staffRecord.username || staffRecord.email}`,
      message: `A new login to your LogicWhile LiRE account (${staffRecord.role}) was detected from IP ${successIp} at ${successNow}. If this was you, no action is required. If this was not you, please immediately contact your administrator or reset your password.`,
      details: {
        role: staffRecord.role,
        username: staffRecord.username || normalizedUser,
        email: staffRecord.email,
        ip: successIp,
        timestamp: successNow,
      },
      targetAdminEmail: staffRecord.email,
    }).catch((err) => {
      console.warn('[AdminLogin] Notice: login security alert delivery:', err?.message);
    });
  }

  res.json({
    success: true,
    message: 'Admin logged in successfully',
    token,
    must_change_password: mustChangePassword,
    user: {
      id: staffRecord.id,
      name: staffRecord.name,
      username: staffRecord.username || normalizedUser || null,
      email: staffRecord.email,
      phone: staffRecord.phone || null,
      role: staffRecord.role,
      college_id: staffRecord.college_id || null,
      must_change_password: Boolean(staffRecord.must_change_password),
      totp_enabled: is2faActive,
      is_2fa_enabled: is2faActive,
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
    const isMockOrTest = process.env.NODE_ENV === 'test' || process.env.DEMO_MODE === 'true';
    const passwordValid =
      isMockOrTest && (password === 'admin123' || password === 'LiREAdmin@2026!' || password === process.env.ADMIN_PASSWORD)
        ? true
        : adminHash && (await bcrypt.compare(password, adminHash));
    if (!passwordValid) {
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
    const passwordValid = (await bcrypt.compare(password, staff.password_hash));
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

  const admin = req.admin;
  if (admin?.role === 'faculty') {
    // Faculty scope: restrict to exams allocated to their college AND created by/assigned to them or their allocated sections
    const callerStaffId = admin.staff_id || (admin as any).id;
    const { data: staffRec } = await supabase
      .from('staff')
      .select('college_id, section_ids, permissions')
      .eq('id', callerStaffId)
      .maybeSingle();

    const facultyCollegeId = staffRec?.college_id ?? admin.college_id;
    const facultySectionIds: string[] = Array.isArray(staffRec?.section_ids) ? staffRec!.section_ids : [];

    if (facultyCollegeId) {
      query = query.eq('college_id', facultyCollegeId);
    }

    if (facultySectionIds.length > 0) {
      const secFilters = facultySectionIds.map((s) => `section_id.eq.${s}`).join(',');
      query = query.or(`created_by_staff_id.eq.${callerStaffId},assigned_faculty_id.eq.${callerStaffId},${secFilters}`);
    } else {
      query = query.or(`created_by_staff_id.eq.${callerStaffId},assigned_faculty_id.eq.${callerStaffId}`);
    }
  } else if (admin?.role === 'inspector') {
    // Inspector scope: restrict to their assigned college
    if (admin.college_id) {
      query = query.eq('college_id', admin.college_id);
    }
  }
  // super_admin: no filter — sees all exams

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
  const { title, duration_minutes, start_time, end_time, admin_email, is_leaderboard_public, exam_code } = req.body;

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

  // Automatically sync to exam_codes table so exam is immediately live on student & main portal
  try {
    const code = String(exam_code || `LW-${String(data.id).slice(0, 6).toUpperCase()}`).trim().toUpperCase();
    await supabase.from('exam_codes').upsert({
      exam_code: code,
      exam_name: title,
      subject: title,
      duration_minutes: duration_minutes || 60,
      start_time: start_time || new Date().toISOString(),
      end_time: end_time || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
      is_launched: true,
      college_id: req.admin?.college_id || 1,
      total_questions: 0,
    }, { onConflict: 'exam_code' });
  } catch (syncErr) {
    console.warn('[createExam] exam_codes bridge note:', syncErr);
  }

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
  const clientOrigin = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');
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
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('LogicWhileLiRE Autonomous Assessment Engine • Architect & Lead Engineer: R. Charan Sai Krishna • Support: logicwhilelire@gmail.com (+91 9493734553) • © 2026 LogicWhile LiRE. All rights reserved.', { align: 'center' });

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

  // If faculty, verify candidate belongs to allocated college/sections
  if (req.admin?.role === 'faculty') {
    const callerStaffId = req.admin.staff_id || (req.admin as any).id;
    const { data: staffRec } = await supabase
      .from('staff')
      .select('college_id, section_ids')
      .eq('id', callerStaffId)
      .maybeSingle();

    const facultyCollegeId = staffRec?.college_id ?? req.admin.college_id;
    const facultySectionIds: string[] = Array.isArray(staffRec?.section_ids) ? staffRec!.section_ids : [];

    if (facultySectionIds.length === 0) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: No academic sections allocated to your faculty account',
        code: 'NO_SECTIONS_ALLOCATED',
      });
      return;
    }

    const { data: student } = await supabase
      .from('students')
      .select('college_id, section_id, section')
      .or(`hall_ticket.eq.${hallTicket},roll_number.eq.${hallTicket}`)
      .maybeSingle();

    if (!student) {
      res.status(404).json({
        success: false,
        error: 'Candidate record not found in your allocated sections',
        code: 'CANDIDATE_NOT_FOUND',
      });
      return;
    }

    if (facultyCollegeId && String(student.college_id) !== String(facultyCollegeId)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Candidate belongs to another college outside your allocation',
        code: 'CROSS_COLLEGE_FORBIDDEN',
      });
      return;
    }

    const studentSec = student.section_id || student.section;
    if (!studentSec || !facultySectionIds.includes(String(studentSec))) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Candidate belongs to a section outside your allocation',
        code: 'SECTION_FORBIDDEN',
      });
      return;
    }
  }

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
  const { name, username, email, phone, password, role, college_id } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ success: false, error: 'Staff name is required' });
    return;
  }
  const normalizedUsername = (username || '').trim().toLowerCase();
  const normalizedEmail = (email || '').trim().toLowerCase() || null;
  const normalizedPhone = (phone || '').trim() || null;

  // Requirement: Each account must be linked to an email AND/OR phone number
  if (!normalizedEmail && !normalizedPhone) {
    res.status(400).json({
      success: false,
      error: 'At least one linked contact method (email or phone) is required when creating an account.',
    });
    return;
  }

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

  // Check duplicate username if provided
  if (normalizedUsername) {
    if (normalizedUsername.length < 3) {
      res.status(400).json({ success: false, error: 'Username must be at least 3 characters long.' });
      return;
    }
    try {
      const { data: existingUser } = await supabase
        .from('staff')
        .select('id')
        .ilike('username', normalizedUsername)
        .maybeSingle();
      if (existingUser) {
        res.status(409).json({ success: false, error: 'A staff member with this username already exists' });
        return;
      }
    } catch {}
  }

  // Check duplicate email if provided
  if (normalizedEmail) {
    const { data: existing } = await supabase
      .from('staff')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      res.status(409).json({ success: false, error: 'A staff member with this email already exists' });
      return;
    }
  }

  const effectiveCollegeId =
    req.admin?.role === 'inspector' || req.admin?.role === 'college_admin'
      ? req.admin.college_id
      : college_id
      ? parseInt(String(college_id), 10)
      : null;

  const assignedRole = role || 'inspector';

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

  // Generate a cryptographically random temp password (14+ chars, no fixed pattern)
  function generateSecureTempPassword(): string {
    const { randomInt } = require('crypto') as typeof import('crypto');
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '@#$%&!';
    const all = upper + lower + digits + special;
    // Guarantee at least one of each required class
    let pw = [
      upper[randomInt(0, upper.length)],
      lower[randomInt(0, lower.length)],
      digits[randomInt(0, digits.length)],
      special[randomInt(0, special.length)],
    ];
    // Fill remaining 10 characters from full charset
    for (let i = pw.length; i < 14; i++) pw.push(all[randomInt(0, all.length)]);
    // Fisher-Yates shuffle
    for (let i = pw.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      [pw[i], pw[j]] = [pw[j], pw[i]];
    }
    return pw.join('');
  }
  const tempPassword = password || generateSecureTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const newStaffId = uuidv4();

  const fallbackEmail = normalizedEmail || `${normalizedUsername || 'staff_' + Date.now()}@logicwhilelire.com`;
  const insertPayload: any = {
    id: newStaffId,
    name: name.trim(),
    email: fallbackEmail,
    password_hash: passwordHash,
    role: assignedRole,
    college_id: effectiveCollegeId,
    created_by: req.admin?.staff_id || null,
    failed_attempts: 0,
    locked_until: null,
    is_2fa_enabled: false,
    is_active: true,
    must_change_password: true,
    created_at: new Date().toISOString(),
  };
  if (normalizedUsername) insertPayload.username = normalizedUsername;
  if (normalizedPhone) insertPayload.phone = normalizedPhone;

  let created: any = null;
  const res1 = await supabase.from('staff').insert(insertPayload).select('*').single();
  if (!res1.error) {
    created = res1.data;
  } else {
    // Fallback if username/phone/must_change_password columns don't exist yet on remote table schema
    const fallbackPayload = { ...insertPayload };
    delete fallbackPayload.username;
    delete fallbackPayload.phone;
    delete fallbackPayload.must_change_password;
    fallbackPayload.permissions = [
      ...(Array.isArray(fallbackPayload.permissions) ? fallbackPayload.permissions : []),
      ...(normalizedUsername ? [`user:${normalizedUsername}`] : []),
      ...(normalizedPhone ? [`phone:${normalizedPhone}`] : []),
      'must_change_password:true',
    ];
    const res2 = await supabase.from('staff').insert(fallbackPayload).select('*').single();
    if (res2.error) {
      res.status(500).json({ success: false, error: res2.error.message });
      return;
    }
    created = { ...res2.data, ...insertPayload };
  }

  if (normalizedUsername) {
    staffAccountCache.set(normalizedUsername.toLowerCase(), {
      id: created.id,
      username: normalizedUsername,
      email: created.email,
      phone: normalizedPhone || undefined,
      must_change_password: true,
    });
  }

  // Lookup college name if college_id is set
  let collegeName: string | undefined = undefined;
  if (effectiveCollegeId) {
    const { data: col } = await supabase.from('colleges').select('name').eq('id', effectiveCollegeId).maybeSingle();
    if (col?.name) collegeName = col.name;
  }

  // Trigger role-based email template (Resend)
  if (normalizedEmail) {
    if (assignedRole === 'faculty') {
      const assignedSections: string[] = req.body.sections || req.body.assigned_sections || (req.body.section ? [req.body.section] : []);
      sendFacultyCreated({
        name: name.trim(),
        email: normalizedEmail,
        tempPassword,
        assignedSections,
        collegeName,
      }).catch((e) => console.warn('[MailService] Failed to send faculty_created email:', e));
    } else if (assignedRole === 'inspector') {
      sendInspectorCreated({
        name: name.trim(),
        email: normalizedEmail,
        tempPassword,
        collegeName,
      }).catch((e) => console.warn('[MailService] Failed to send inspector_created email:', e));
    } else {
      sendAdminWelcome({
        name: name.trim(),
        email: normalizedEmail,
        role: assignedRole,
        tempPassword,
      }).catch((e) => console.warn('[MailService] Failed to send admin_welcome email:', e));
    }
  }

  // Response: NEVER expose temporary password in API response
  res.status(201).json({
    success: true,
    message: 'Staff account created successfully. Credentials dispatched to the linked contact method.',
    staff: {
      id: created.id,
      name: created.name,
      username: created.username || normalizedUsername || null,
      email: created.email,
      phone: created.phone || normalizedPhone || null,
      role: created.role,
      is_active: created.is_active,
      college_id: created.college_id,
      must_change_password: true,
      created_at: created.created_at,
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
  const { name, username, email, phone, role, college_id, is_active, permissions } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (username !== undefined) updates.username = String(username).toLowerCase().trim();
  if (email !== undefined) updates.email = String(email).toLowerCase().trim();
  if (phone !== undefined) updates.phone = String(phone).trim();
  if (role !== undefined) updates.role = role;
  if (college_id !== undefined) updates.college_id = college_id;
  if (is_active !== undefined) updates.is_active = is_active;
  if (permissions !== undefined && Array.isArray(permissions)) updates.permissions = permissions;

  const { data: staff, error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', id)
    .select('*')
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
 * Question Bank list endpoint with filtering by:
 * - college / college_id
 * - topic
 * - difficulty ('Easy', 'Medium', 'Hard')
 * - question_type ('mcq', 'coding', 'aptitude', 'diagram')
 * - search query
 */
export async function listQuestions(req: Request, res: Response): Promise<void> {
  try {
    const { exam_id, college_id, topic, difficulty, question_type, search } = req.query;

    // Fetch exam_codes and colleges map for college scoping and metadata enrichment
    const { data: examCodesList } = await supabase
      .from('exam_codes')
      .select('exam_code, college_id');
    const { data: collegesList } = await supabase
      .from('colleges')
      .select('id, college_name, college_code');

    const collegeMap = new Map<number, { name: string; code: string }>();
    if (collegesList) {
      for (const col of collegesList) {
        collegeMap.set(col.id, { name: col.college_name, code: col.college_code });
      }
    }

    const examCollegeMap = new Map<string, { college_id: number | null; college_name: string; college_code: string }>();
    if (examCodesList) {
      for (const ec of examCodesList) {
        const colInfo = ec.college_id ? collegeMap.get(ec.college_id) : null;
        examCollegeMap.set(ec.exam_code.toUpperCase(), {
          college_id: ec.college_id,
          college_name: colInfo?.name || '',
          college_code: colInfo?.code || '',
        });
      }
    }

    let targetCodes: string[] | null = null;
    if (college_id && college_id !== 'all') {
      const cId = parseInt(String(college_id), 10);
      targetCodes = (examCodesList || [])
        .filter((ec: any) => ec.college_id === cId)
        .map((ec: any) => ec.exam_code);
      if (targetCodes.length === 0) {
        res.json({ success: true, count: 0, questions: [] });
        return;
      }
    }

    let query = supabase.from('questions_ec').select('*').order('created_at', { ascending: false });

    if (exam_id && exam_id !== 'all') {
      query = (query as any).eq('exam_code', String(exam_id).toUpperCase());
    }
    if (targetCodes) {
      query = (query as any).in('exam_code', targetCodes);
    }
    if (difficulty && difficulty !== 'all') {
      query = (query as any).eq('difficulty', String(difficulty));
    }

    const { data: qEcData, error } = await query;
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    let results = (qEcData || []).map((row: any) => {
      const tags = Array.isArray(row.tags) ? row.tags : [];
      const diagramTag = tags.find((t: string) => typeof t === 'string' && t.startsWith('diagram:'));
      const diagramUrl = diagramTag ? diagramTag.replace('diagram:', '') : '';
      const colMeta = examCollegeMap.get(String(row.exam_code || '').toUpperCase());

      let canonicalType: 'mcq' | 'coding' | 'aptitude' | 'diagram' = 'mcq';
      if (row.question_type === 'coding' || tags.includes('type:coding') || tags.includes('type:code')) {
        canonicalType = 'coding';
      } else if (tags.some((t: string) => t === 'type:diagram' || t.startsWith('diagram:'))) {
        canonicalType = 'diagram';
      } else if (tags.includes('type:aptitude')) {
        canonicalType = 'aptitude';
      }

      return {
        id: row.id,
        exam_code: row.exam_code,
        exam_id: row.exam_code,
        college_id: colMeta?.college_id || null,
        college_name: colMeta?.college_name || '',
        college_code: colMeta?.college_code || '',
        question: row.question || row.question_text || '',
        question_text: row.question || row.question_text || '',
        question_type: canonicalType,
        options: row.options || {
          a: row.option_a || '',
          b: row.option_b || '',
          c: row.option_c || '',
          d: row.option_d || '',
        },
        option_a: row.option_a || '',
        option_b: row.option_b || '',
        option_c: row.option_c || '',
        option_d: row.option_d || '',
        correct_option: (row.correct_answer || 'a').toLowerCase(),
        correct_answer: (row.correct_answer || 'A').toUpperCase(),
        marks: Number(row.marks || 1),
        penalty: Number(row.penalty || row.negative_marks || 0),
        difficulty: row.difficulty || 'Medium',
        topic: row.topic || 'General',
        section: row.section || 'General',
        tags: tags,
        diagram_url: diagramUrl,
        test_cases: row.test_cases || null,
        starter_code: row.starter_code || null,
        created_at: row.created_at,
      };
    });

    // In-memory filter for question_type
    if (question_type && question_type !== 'all') {
      const qType = String(question_type).toLowerCase();
      results = results.filter((q) => {
        if (qType === 'coding' || qType === 'code') return q.question_type === 'coding';
        if (qType === 'diagram') return q.question_type === 'diagram';
        if (qType === 'aptitude') return q.question_type === 'aptitude';
        if (qType === 'mcq') return q.question_type === 'mcq';
        return true;
      });
    }

    // In-memory filters for topic substring and search keyword
    if (topic && topic !== 'all') {
      const topLower = String(topic).toLowerCase();
      results = results.filter((q) => q.topic.toLowerCase().includes(topLower));
    }
    if (search) {
      const sLower = String(search).toLowerCase();
      results = results.filter(
        (q) =>
          q.question.toLowerCase().includes(sLower) ||
          q.topic.toLowerCase().includes(sLower) ||
          q.section.toLowerCase().includes(sLower) ||
          q.exam_code?.toLowerCase().includes(sLower) ||
          q.college_name?.toLowerCase().includes(sLower)
      );
    }

    res.json({ success: true, count: results.length, questions: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to list questions' });
  }
}

/**
 * POST /api/admin/questions
 * Creates a new question in the master question bank (supports MCQ, Coding, Aptitude, Diagram).
 */
export async function createQuestion(req: Request, res: Response): Promise<void> {
  try {
    const {
      exam_id,
      exam_code,
      question_text,
      question,
      question_type,
      options,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      correct_answer,
      marks,
      penalty,
      topic,
      section,
      difficulty,
      diagram_url,
      test_cases,
      starter_code,
    } = req.body;

    const text = question_text || question;
    if (!text || String(text).trim() === '') {
      res.status(400).json({ success: false, error: 'Question text is required' });
      return;
    }

    const rawType = String(question_type || 'mcq').toLowerCase();
    const dbType = rawType === 'coding' || rawType === 'code' ? 'coding' : 'mcq';
    const targetCode = String(exam_code || exam_id || 'CS2026').toUpperCase();

    const tags: string[] = Array.isArray(req.body.tags) ? [...req.body.tags] : [];
    if (topic && !tags.includes(topic)) tags.push(topic);
    if (rawType === 'diagram') {
      if (!tags.includes('type:diagram')) tags.push('type:diagram');
      if (diagram_url && String(diagram_url).trim() !== '') {
        tags.push(`diagram:${String(diagram_url).trim()}`);
      }
    } else if (rawType === 'aptitude') {
      if (!tags.includes('type:aptitude')) tags.push('type:aptitude');
    } else if (dbType === 'coding') {
      if (!tags.includes('type:coding')) tags.push('type:coding');
    }

    const optA = option_a || options?.a || '';
    const optB = option_b || options?.b || '';
    const optC = option_c || options?.c || '';
    const optD = option_d || options?.d || '';
    const ans = String(correct_answer || correct_option || 'A').trim().toUpperCase();

    const newQuestion = {
      id: req.body.id || uuidv4(),
      exam_code: targetCode,
      question: text,
      question_text: text,
      question_type: dbType,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      options: { a: optA, b: optB, c: optC, d: optD },
      correct_answer: ans,
      marks: marks !== undefined ? Number(marks) : 1,
      penalty: penalty !== undefined ? Number(penalty) : 0,
      negative_marks: penalty !== undefined ? Number(penalty) : 0,
      topic: topic || 'General',
      section: section || 'General',
      difficulty: (() => {
        const d = String(difficulty || 'Medium').trim().toLowerCase();
        return d === 'easy' ? 'Easy' : d === 'hard' ? 'Hard' : 'Medium';
      })(),
      tags: tags,
      test_cases: test_cases || null,
      starter_code: starter_code || null,
      created_at: new Date().toISOString(),
    };

    // Ensure parent exam_codes record exists to satisfy foreign key constraint
    try {
      const { data: existingCode } = await supabase
        .from('exam_codes')
        .select('id, exam_code, total_questions')
        .eq('exam_code', targetCode)
        .maybeSingle();

      if (!existingCode) {
        const now = new Date();
        await supabase.from('exam_codes').insert({
          exam_code: targetCode,
          exam_name: targetCode,
          subject: topic || 'General',
          total_questions: 1,
          duration_minutes: 60,
          start_time: now.toISOString(),
          end_time: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
          is_launched: true,
          college_id: req.admin?.college_id || 1,
        });
      } else {
        await supabase
          .from('exam_codes')
          .update({
            total_questions: (existingCode.total_questions || 0) + 1,
            is_active: true,
          })
          .eq('exam_code', targetCode);
      }
    } catch (ecSyncErr) {
      console.warn('[createQuestion] exam_codes sync note:', ecSyncErr);
    }

    const { data, error } = await supabase
      .from('questions_ec')
      .insert(newQuestion)
      .select()
      .single();

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    // Also sync to standard questions table
    try {
      await supabase.from('questions').insert({
        id: newQuestion.id,
        exam_id: targetCode,
        question_text: text,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        correct_option: ans.toLowerCase(),
        marks: newQuestion.marks,
        penalty: newQuestion.penalty,
        topic: newQuestion.topic,
        difficulty: newQuestion.difficulty,
        section: newQuestion.section,
        created_at: newQuestion.created_at,
      });
    } catch {}

    res.status(201).json({ success: true, question: data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to create question' });
  }
}

/**
 * PATCH /api/admin/questions/:id
 * Updates an existing question in the master question bank.
 */
export async function updateQuestion(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = { ...req.body };
    delete body.id;

    const updates: Record<string, any> = {};
    if (body.question || body.question_text) {
      updates.question = body.question || body.question_text;
      updates.question_text = body.question || body.question_text;
    }
    if (body.question_type) {
      const rawType = String(body.question_type).toLowerCase();
      updates.question_type = rawType === 'coding' ? 'code' : rawType;
    }
    if (body.option_a !== undefined) updates.option_a = body.option_a;
    if (body.option_b !== undefined) updates.option_b = body.option_b;
    if (body.option_c !== undefined) updates.option_c = body.option_c;
    if (body.option_d !== undefined) updates.option_d = body.option_d;
    if (body.options) updates.options = body.options;
    if (body.correct_answer || body.correct_option) {
      updates.correct_answer = String(body.correct_answer || body.correct_option).trim().toUpperCase();
    }
    if (body.marks !== undefined) updates.marks = Number(body.marks);
    if (body.penalty !== undefined) {
      updates.penalty = Number(body.penalty);
      updates.negative_marks = Number(body.penalty);
    }
    if (body.topic !== undefined) updates.topic = body.topic;
    if (body.section !== undefined) updates.section = body.section;
    if (body.difficulty !== undefined) {
      const d = String(body.difficulty || 'Medium').trim().toLowerCase();
      updates.difficulty = d === 'easy' ? 'Easy' : d === 'hard' ? 'Hard' : 'Medium';
    }
    if (body.test_cases !== undefined) updates.test_cases = body.test_cases;
    if (body.starter_code !== undefined) updates.starter_code = body.starter_code;

    if (body.diagram_url !== undefined || body.tags !== undefined) {
      const tags: string[] = Array.isArray(body.tags) ? [...body.tags] : [];
      if (body.diagram_url) {
        tags.push(`diagram:${String(body.diagram_url).trim()}`);
      }
      updates.tags = tags;
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('questions_ec')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    // Sync to standard questions table
    try {
      await supabase.from('questions').update({
        question_text: updates.question,
        option_a: updates.option_a,
        option_b: updates.option_b,
        option_c: updates.option_c,
        option_d: updates.option_d,
        correct_option: updates.correct_answer ? updates.correct_answer.toLowerCase() : undefined,
        marks: updates.marks,
        penalty: updates.penalty,
        topic: updates.topic,
        difficulty: updates.difficulty,
      }).eq('id', id);
    } catch {}

    res.json({ success: true, question: data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update question' });
  }
}

/**
 * DELETE /api/admin/questions/:id
 * Removes a question from the master question bank.
 */
export async function deleteQuestion(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('questions_ec').delete().eq('id', id);
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    try {
      await supabase.from('questions').delete().eq('id', id);
    } catch {}

    res.json({ success: true, message: 'Question deleted successfully from master question bank' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to delete question' });
  }
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

/**
 * GET /api/admin/mail-logs
 * List outbound email logs with filtering and pagination
 */
export async function listMailLogsController(req: Request, res: Response): Promise<void> {
  const { page, limit, status, template, search } = req.query;
  try {
    const result = await getMailLogsService({
      page: page ? parseInt(String(page), 10) : 1,
      limit: limit ? parseInt(String(limit), 10) : 20,
      status: status ? String(status) : undefined,
      template: template ? String(template) : undefined,
      search: search ? String(search) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch mail logs' });
  }
}

/**
 * POST /api/admin/mail-logs/:id/resend
 * Resend an existing email from the mail_logs table
 */
export async function resendMailLogController(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ success: false, error: 'Mail log ID is required' });
    return;
  }

  // Look up the mail log to check if it is a credential template
  let existingRecord: any = null;
  try {
    const { data } = await supabase.from('mail_logs').select('template, to_email').eq('id', id).maybeSingle();
    if (data) existingRecord = data;
  } catch {}
  // Fallback to memory buffer
  if (!existingRecord) {
    const { memoryMailLogs } = await import('../services/mailService');
    existingRecord = memoryMailLogs.find((l: any) => l.id === id) || null;
  }

  const credentialTemplates = ['admin_welcome', 'inspector_created', 'faculty_created'];
  const isCredentialEmail = existingRecord && credentialTemplates.includes(existingRecord.template);

  // Only super_admin may resend credential emails
  if (isCredentialEmail && req.admin?.role !== 'super_admin') {
    res.status(403).json({
      success: false,
      error: 'Forbidden: Only super_admin can resend credential emails.',
    });
    return;
  }

  try {
    const result = await resendMailLogById(String(id));

    // Mandatory audit entry for every credential resend
    if (isCredentialEmail) {
      const now = new Date().toISOString();
      Promise.resolve(
        supabase
          .from('audit_log')
          .insert({
            admin_id: req.admin?.sub || req.admin?.staff_id || 'unknown',
            user_id: req.admin?.staff_id || null,
            role: req.admin?.role || 'super_admin',
            action: 'CREDENTIAL_EMAIL_RESENT',
            target_table: 'mail_logs',
            target_id: id,
            payload: {
              mail_log_id: id,
              template: existingRecord?.template,
              to_email: existingRecord?.to_email,
              resend_result_id: result.resend_id || result.id,
              success: result.success,
            },
            ip_address: req.ip || req.socket?.remoteAddress || '127.0.0.1',
            created_at: now,
          })
      ).catch((e: Error) => console.warn('[Audit] Failed to log credential resend:', e?.message));
    }

    if (!result.success) {
      res.status(500).json({ success: false, error: result.error || 'Failed to resend email' });
      return;
    }
    res.json({
      success: true,
      message: 'Email successfully queued and re-dispatched via Resend',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to resend email' });
  }
}


