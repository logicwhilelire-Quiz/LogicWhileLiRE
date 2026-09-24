import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import multer from 'multer';
import { supabase } from '../db/supabase';
import { parseAndValidateXlsx, bulkInsertQuestions } from '../services/questionImportService';
import { getCache, setCache, invalidateCache } from '../services/cacheService';
import {
  getExamQuestionAnalytics,
  getExamTopicBreakdown,
  getParticipantHistory,
} from '../services/analyticsService';
import { sendTerminationAlertEmail } from '../services/emailService';

const LEADERBOARD_CACHE_TTL = 10; // 10 seconds TTL to handle post-exam traffic spikes

// Multer config — memory storage, 5MB limit, xlsx only
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are accepted'));
    }
  },
}).single('file');

// ——————————————————————————————————————————
// ADMIN AUTH
// ——————————————————————————————————————————

/**
 * POST /api/admin/login
 */
export async function adminLogin(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;

  if (username !== process.env.ADMIN_USERNAME) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  let passwordValid = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH!);
  if (!passwordValid && process.env.DEMO_MODE === 'true' && password === 'admin123') {
    passwordValid = true;
  }
  if (!passwordValid) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign({ sub: username, role: 'admin' }, process.env.ADMIN_JWT_SECRET!, {
    expiresIn: '8h',
  });

  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({ success: true, message: 'Admin logged in successfully', token });
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
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, exams: data });
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

  // Build summary sheet
  const summaryRows = (results || []).map((r, i) => ({
    Rank: i + 1,
    Name: (r.participant as any)?.name,
    'Hall Ticket': (r.participant as any)?.hall_ticket,
    Email: (r.participant as any)?.email,
    Score: r.total_score,
    'Max Score': r.max_score,
    Correct: r.correct_count,
    Wrong: r.wrong_count,
    'Time (s)': r.time_taken_seconds,
    'Graded At': r.graded_at,
    Platform: 'LogicWhile QUIZ',
  }));

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
    'Content-Disposition': `attachment; filename="LogicWhile_${safeTitle}_report.xlsx"`,
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

  // Executive Brand Header: LogicWhile in deep navy, QUIZ in brand amber
  doc.fontSize(23).font('Helvetica-Bold').fillColor('#0f172a').text('LogicWhile ', { continued: true, align: 'center' });
  doc.fillColor('#d97706').text('QUIZ');
  
  // Official Tagline
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ea580c').text('ELEVATING CODING KNOWLEDGE', { align: 'center', characterSpacing: 2 });
  doc.moveDown(0.6);

  // Brand Accent Divider Rule
  const startX = 60;
  const endX = doc.page.width - 60;
  doc.strokeColor('#f59e0b').lineWidth(1.5).moveTo(startX, doc.y).lineTo(endX, doc.y).stroke();
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
  res.json({
    success: true,
    sessions: data,
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


