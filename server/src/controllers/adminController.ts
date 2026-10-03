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
import { sendTerminationAlertEmail } from '../services/emailService';

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
    normalizedUser === (process.env.INITIAL_ADMIN_EMAIL || 'admin@logicwhilelire.local') ||
    normalizedUser === 'admin@growthran.local' ||
    normalizedUser === 'admin@growthran.com' ||
    normalizedUser === 'admin@logicwhilelire.com';

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
        email: process.env.INITIAL_ADMIN_EMAIL || 'admin@logicwhilelire.local',
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
    // Look up staff account by email (with backward-compatible domain aliasing)
    const emailToLookup = normalizedUser.toLowerCase();
    let { data: staff, error } = await supabase
      .from('staff')
      .select('*')
      .eq('email', emailToLookup)
      .maybeSingle();

    if (!staff) {
      const aliasDomains = ['@logicwhilelire.com', '@growthran.com', '@logicwhile.com'];
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

    const passwordValid = await bcrypt.compare(password, staff.password_hash);
    if (!passwordValid) {
      handleFailedAttempt();
      return;
    }

    staffRecord = staff;
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
    },
    process.env.ADMIN_JWT_SECRET || 'logicwhilelire_admin_jwt_default_secret_key_demo_2026',
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

  res.json({
    success: true,
    message: 'Admin logged in successfully',
    token,
    user: {
      id: staffRecord.id,
      name: staffRecord.name,
      email: staffRecord.email,
      role: staffRecord.role,
      college_id: staffRecord.college_id || null,
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
export async function listStaff(_req: Request, res: Response): Promise<void> {
  const { data: staffList, error } = await supabase
    .from('staff')
    .select('id, name, email, role, is_active, created_by, created_at')
    .order('created_at', { ascending: false });

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

  const passwordHash = await bcrypt.hash(password, 12);
  const newStaffId = uuidv4();

  const { data: created, error } = await supabase
    .from('staff')
    .insert({
      id: newStaffId,
      name: name.trim(),
      email: normalizedEmail,
      password_hash: passwordHash,
      role: role || 'faculty',
      college_id: college_id ? parseInt(String(college_id), 10) : null,
      created_by: req.admin?.staff_id || null,
      is_active: true,
      created_at: new Date().toISOString(),
    })
    .select('id, name, email, role, is_active, created_at')
    .single();

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  res.status(201).json({
    success: true,
    message: 'Staff account created successfully',
    staff: created,
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
 * Phase 3 Results Vault: List audit logs of all admin actions
 */
export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const { action, limit } = req.query;
  const maxLimit = Math.min(parseInt(String(limit || '50'), 10), 200);

  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(maxLimit);

  if (action) {
    query = (query as any).eq('action', String(action));
  }

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  res.json({ success: true, count: data?.length || 0, logs: data || [] });
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


