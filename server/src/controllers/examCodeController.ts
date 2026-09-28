import { Request, Response } from 'express';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import crypto from 'crypto';
import { supabase } from '../db/supabase';

// ─────────────────────────────────────────────
// SESSION TOKEN UTILITIES  (1a: concurrent-session block)
// ─────────────────────────────────────────────

/**
 * Generate a cryptographically random session token (16 bytes → 32 hex chars).
 * Stored per-attempt; a second verifyExamEntry with same hall_ticket+exam_code
 * overwrites this token, evicting any already-open browser session.
 */
function generateSessionToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Verify that the provided session_token matches the stored token for this attempt.
 * Returns { valid, evicted, terminated } to let the caller decide the response.
 */
export async function verifyAttemptToken(
  attemptId: string,
  examCode: string,
  providedToken: string | undefined
): Promise<{ valid: boolean; evicted: boolean; terminated: boolean; attempt: any | null }> {
  const { data: attempt } = await supabase
    .from('exam_code_attempts')
    .select('id, status, session_token, exam_code')
    .eq('id', attemptId)
    .eq('exam_code', examCode.toUpperCase())
    .maybeSingle();

  if (!attempt) return { valid: false, evicted: false, terminated: false, attempt: null };
  if (attempt.status === 'terminated_cheating' || attempt.status === 'completed') {
    return { valid: false, evicted: false, terminated: true, attempt };
  }
  // If no stored token yet (legacy row), accept and migrate
  if (!attempt.session_token) return { valid: true, evicted: false, terminated: false, attempt };
  const match = providedToken && crypto.timingSafeEqual(
    Buffer.from(attempt.session_token, 'hex'),
    Buffer.from(providedToken.padEnd(32, '0').slice(0, 32), 'hex')
  );
  if (!match) return { valid: false, evicted: true, terminated: false, attempt };
  return { valid: true, evicted: false, terminated: false, attempt };
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Generates a unique exam code: LW-{COLLEGE_CODE}-{6CHAR}
 * e.g. LW-VRSEC-8X9P2Q
 */
function generateExamCode(collegeCode: string): string {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LW-${collegeCode.toUpperCase()}-${random}`;
}

// ─────────────────────────────────────────────
// COLLEGES
// ─────────────────────────────────────────────

/**
 * GET /api/colleges
 * Public – returns active colleges for dropdown
 */
export async function listColleges(req: Request, res: Response): Promise<void> {
  const { data, error } = await supabase
    .from('colleges')
    .select('id, college_name, college_code, city, state, is_active')
    .order('college_name');

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, colleges: data });
}

/**
 * POST /api/admin/colleges
 */
export async function createCollege(req: Request, res: Response): Promise<void> {
  const { college_name, college_code, city, state, contact_email, contact_phone } = req.body;
  if (!college_name || !college_code) {
    res.status(400).json({ success: false, error: 'college_name and college_code are required' });
    return;
  }
  const normalized = college_code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const { data, error } = await supabase
    .from('colleges')
    .insert({ college_name, college_code: normalized, city, state, contact_email, contact_phone })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ success: false, error: 'College code already exists. Use a different code.' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
    return;
  }
  res.status(201).json({ success: true, college: data });
}

/**
 * PATCH /api/admin/colleges/:id
 */
export async function updateCollege(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { college_name, city, state, contact_email, contact_phone, is_active } = req.body;
  const { data, error } = await supabase
    .from('colleges')
    .update({ college_name, city, state, contact_email, contact_phone, is_active })
    .eq('id', id)
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, college: data });
}

/**
 * DELETE /api/admin/colleges/:id
 */
export async function deleteCollege(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { error } = await supabase.from('colleges').delete().eq('id', id);
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, message: 'College deleted' });
}

// ─────────────────────────────────────────────
// EXAM CODES
// ─────────────────────────────────────────────

/**
 * GET /api/admin/exam-codes
 * 1e: super_admin sees all; college_admin/faculty see only their college's codes.
 */
export async function listExamCodes(req: Request, res: Response): Promise<void> {
  const admin = (req as any).admin;
  const isSuperAdmin = admin?.role === 'super_admin' || admin?.role === 'admin';
  const callerCollegeId = admin?.college_id;
  let query = supabase
    .from('exam_codes')
    .select('*, college:college_id ( college_name, college_code )')
    .order('created_at', { ascending: false });
  if (!isSuperAdmin && callerCollegeId) {
    query = (query as any).eq('college_id', callerCollegeId);
  }
  const { data, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, exam_codes: data });
}

/**
 * POST /api/admin/exam-codes
 * Creates a new exam code for a college. Auto-generates LW-XXX-XXXXXX code.
 */
export async function createExamCode(req: Request, res: Response): Promise<void> {
  const {
    college_id,
    exam_name,
    subject,
    total_questions,
    duration_minutes,
    start_time,
    end_time,
  } = req.body;

  if (!college_id || !exam_name || !start_time || !end_time) {
    res.status(400).json({ success: false, error: 'college_id, exam_name, start_time, end_time are required' });
    return;
  }

  // Fetch college code for prefix
  const { data: college } = await supabase
    .from('colleges')
    .select('college_code')
    .eq('id', college_id)
    .single();

  if (!college) { res.status(404).json({ success: false, error: 'College not found' }); return; }

  // Generate unique code – retry up to 5 times if collision
  let examCode = '';
  let attempts = 0;
  while (attempts < 5) {
    examCode = generateExamCode(college.college_code);
    const { data: existing } = await supabase
      .from('exam_codes')
      .select('exam_code')
      .eq('exam_code', examCode)
      .maybeSingle();
    if (!existing) break;
    attempts++;
  }

  if (!examCode) {
    res.status(500).json({ success: false, error: 'Could not generate unique exam code. Try again.' });
    return;
  }

  const { data, error } = await supabase
    .from('exam_codes')
    .insert({
      exam_code: examCode,
      college_id: parseInt(college_id, 10),
      exam_name,
      subject: subject || null,
      total_questions: parseInt(total_questions, 10) || 30,
      duration_minutes: parseInt(duration_minutes, 10) || 60,
      start_time,
      end_time,
      is_active: true,
      created_by_staff_id: (req as any).admin?.staff_id || null,
    })
    .select(`*, college:college_id ( college_name, college_code )`)
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  // Generate QR data URL for the exam entry link
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const entryUrl = `${clientOrigin}/enter-exam?code=${examCode}`;
  const qrDataUrl = await QRCode.toDataURL(entryUrl, { width: 300, margin: 2 });

  res.status(201).json({ success: true, exam_code: data, qr: qrDataUrl, entry_url: entryUrl });
}

/**
 * PATCH /api/admin/exam-codes/:id/toggle
 */
export async function toggleExamCode(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { is_active } = req.body;
  const { data, error } = await supabase
    .from('exam_codes')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, exam_code: data });
}

/**
 * GET /api/admin/exam-codes/:id/qr
 * Returns the QR as PNG buffer
 */
export async function getExamCodeQR(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { data: ec } = await supabase.from('exam_codes').select('exam_code').eq('id', id).single();
  if (!ec) { res.status(404).json({ success: false, error: 'Exam code not found' }); return; }

  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const entryUrl = `${clientOrigin}/enter-exam?code=${ec.exam_code}`;
  const qrBuffer = await QRCode.toBuffer(entryUrl, { type: 'png', width: 300 });
  res.set('Content-Type', 'image/png');
  res.send(qrBuffer);
}

// ─────────────────────────────────────────────
// STUDENT EXAM ENTRY (NO OTP)
// ─────────────────────────────────────────────

/**
 * POST /api/verify-exam-entry
 * PUBLIC – verifies hall ticket + exam code and allows entry
 */
export async function verifyExamEntry(req: Request, res: Response): Promise<void> {
  const { hallTicket, examCode, studentName } = req.body;

  if (!hallTicket || !examCode) {
    res.status(400).json({ success: false, error: 'Hall ticket and exam code are required' });
    return;
  }

  const ht = hallTicket.trim().toUpperCase();
  const ec = examCode.trim().toUpperCase();

  // 1. Check exam code exists and is active
  const { data: exam, error: examError } = await supabase
    .from('exam_codes')
    .select(`
      *,
      college:college_id ( college_name, college_code )
    `)
    .eq('exam_code', ec)
    .eq('is_active', true)
    .maybeSingle();

  if (examError || !exam) {
    res.status(404).json({ success: false, error: 'Invalid exam code. Please check and try again.' });
    return;
  }

  // 2. Time window check
  const now = new Date();
  const startTime = new Date(exam.start_time);
  const endTime = new Date(exam.end_time);

  if (now < startTime) {
    const diffMs = startTime.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / 60000);
    res.status(403).json({
      success: false,
      error: `Exam has not started yet. It begins in ${diffMins} minute(s).`,
      code: 'EXAM_NOT_STARTED',
    });
    return;
  }

  if (now > endTime) {
    res.status(403).json({
      success: false,
      error: 'This exam code has expired. The exam window has closed.',
      code: 'EXAM_EXPIRED',
    });
    return;
  }

  // 3. Check for existing attempt
  const { data: existing } = await supabase
    .from('exam_code_attempts')
    .select('id, status, score, max_score')
    .eq('hall_ticket_no', ht)
    .eq('exam_code', ec)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'in_progress') {
      // ── 1a: Concurrent-session block ──────────────────────────────────────
      // Issue a FRESH session_token so any previously-open browser is evicted.
      // The new token is returned to THIS caller; the old tab's token no longer
      // matches and will receive SESSION_EVICTED on its next save/submit call.
      const freshToken = generateSessionToken();
      await supabase
        .from('exam_code_attempts')
        .update({ session_token: freshToken, last_resumed_at: new Date().toISOString() })
        .eq('id', existing.id);

      res.json({
        success: true,
        resumed: true,
        attempt_id: existing.id,
        session_token: freshToken,
        examDetails: {
          exam_code: exam.exam_code,
          exam_name: exam.exam_name,
          subject: exam.subject,
          duration_minutes: exam.duration_minutes,
          total_questions: exam.total_questions,
          end_time: exam.end_time,
          college: exam.college,
        },
        message: 'Resuming your existing session. Any other open tabs have been logged out.',
      });
      return;
    }
    res.status(409).json({
      success: false,
      error: 'You have already completed this exam. Each student can attempt only once.',
      code: 'ALREADY_ATTEMPTED',
    });
    return;
  }

  // 4. Check questions exist for this exam code
  const { count: qCount } = await supabase
    .from('questions_ec')
    .select('id', { count: 'exact', head: true })
    .eq('exam_code', ec);

  if (!qCount || qCount === 0) {
    res.status(503).json({
      success: false,
      error: 'Questions not yet uploaded for this exam. Please contact your coordinator.',
    });
    return;
  }

  // 5. Create attempt record — include a fresh session_token from the start
  const newToken = generateSessionToken();
  const { data: attempt, error: insertError } = await supabase
    .from('exam_code_attempts')
    .insert({
      hall_ticket_no: ht,
      exam_code: ec,
      student_name: studentName?.trim() || ht,
      status: 'in_progress',
      session_token: newToken,
    })
    .select()
    .single();

  if (insertError) {
    res.status(500).json({ success: false, error: 'Failed to create attempt. Please try again.' });
    return;
  }

  res.json({
    success: true,
    resumed: false,
    attempt_id: attempt.id,
    session_token: newToken,
    examDetails: {
      exam_code: exam.exam_code,
      exam_name: exam.exam_name,
      subject: exam.subject,
      duration_minutes: exam.duration_minutes,
      total_questions: exam.total_questions,
      end_time: exam.end_time,
      college: exam.college,
    },
  });
}

// ─────────────────────────────────────────────
// QUESTIONS FOR EXAM CODE
// ─────────────────────────────────────────────

/**
 * GET /api/exam-code/:code/questions
 * Returns questions (WITHOUT correct_answer) for an active exam
 */
export async function getExamCodeQuestions(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const { attemptId, session_token } = req.query as { attemptId: string; session_token?: string };

  // ── 1a: verify session token (concurrent-session guard) ──
  const tokenCheck = await verifyAttemptToken(String(attemptId ?? ""), String(code), session_token ? String(session_token) : undefined);
  if (!tokenCheck.valid) {
    if (tokenCheck.evicted) {
      res.status(409).json({ success: false, error: 'Your session was taken over from another device. Please log in again.', code: 'SESSION_EVICTED' });
    } else if (tokenCheck.terminated) {
      res.status(403).json({ success: false, error: 'This exam session has already ended.', code: 'SESSION_ENDED' });
    } else {
      res.status(403).json({ success: false, error: 'Invalid or expired attempt', code: 'INVALID_ATTEMPT' });
    }
    return;
  }

  const { data: questions, error } = await supabase
    .from('questions_ec')
    .select('id, question, option_a, option_b, option_c, option_d, marks, difficulty, topic, display_order')
    .eq('exam_code', String(code).toUpperCase())
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at');

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  // Shuffle for anti-cheating
  const shuffled = (questions || []).sort(() => Math.random() - 0.5);

  res.json({ success: true, questions: shuffled, total: shuffled.length });
}

/**
 * POST /api/exam-code/:code/submit
 * Grades and saves the final attempt
 */
export async function submitExamCodeAttempt(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const { attemptId, answers, timeTakenSeconds, violationCount, session_token } = req.body;

  // ── 1a: verify session token (concurrent-session guard) ──
  const tokenCheck = await verifyAttemptToken(String(attemptId ?? ""), String(code), session_token ? String(session_token) : undefined);
  if (!tokenCheck.valid) {
    if (tokenCheck.evicted) {
      res.status(409).json({ success: false, error: 'Your session was taken over from another device.', code: 'SESSION_EVICTED' });
      return;
    }
    if (!tokenCheck.terminated && !tokenCheck.attempt) {
      res.status(404).json({ success: false, error: 'Attempt not found' });
      return;
    }
  }
  const attempt = tokenCheck.attempt;
  if (!attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found' });
    return;
  }
  if (attempt.status === 'completed') {
    res.status(409).json({ success: false, error: 'Already submitted' });
    return;
  }

  // Fetch questions with correct answers for grading
  const { data: questions } = await supabase
    .from('questions_ec')
    .select('id, correct_answer, marks, topic')
    .eq('exam_code', String(code).toUpperCase());

  if (!questions) {
    res.status(500).json({ success: false, error: 'Could not fetch questions for grading' });
    return;
  }

  // Grade
  let totalScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  const topicBreakdown: Record<string, { correct: number; wrong: number; score: number; maxScore: number }> = {};

  for (const q of questions) {
    maxScore += Number(q.marks);
    const topic = q.topic || 'General';
    if (!topicBreakdown[topic]) {
      topicBreakdown[topic] = { correct: 0, wrong: 0, score: 0, maxScore: 0 };
    }
    topicBreakdown[topic].maxScore += Number(q.marks);

    const studentAnswer = (answers as Record<string, string>)[q.id];
    if (studentAnswer) {
      if (studentAnswer.toUpperCase() === q.correct_answer.toUpperCase()) {
        totalScore += Number(q.marks);
        correctCount++;
        topicBreakdown[topic].correct++;
        topicBreakdown[topic].score += Number(q.marks);
      } else {
        wrongCount++;
        topicBreakdown[topic].wrong++;
      }
    }
  }

  // Update attempt record
  const { error: updateError } = await supabase
    .from('exam_code_attempts')
    .update({
      status: violationCount >= 3 ? 'terminated_cheating' : 'completed',
      end_time: new Date().toISOString(),
      score: totalScore,
      max_score: maxScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      answers,
      time_taken_seconds: timeTakenSeconds || 0,
      topic_breakdown: topicBreakdown,
      violation_count: violationCount || 0,
    })
    .eq('id', attemptId);

  if (updateError) { res.status(500).json({ success: false, error: updateError.message }); return; }

  res.json({
    success: true,
    result: {
      score: totalScore,
      max_score: maxScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      topic_breakdown: topicBreakdown,
      status: violationCount >= 3 ? 'terminated_cheating' : 'completed',
    },
  });
}

/**
 * POST /api/exam-code/:code/violation
 * Logs a violation and potentially terminates
 */
export async function logExamCodeViolation(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const { attemptId, violationType, session_token } = req.body;

  // ── 1a: token check (soft — violations should still record even if evicted)
  const { data: attempt } = await supabase
    .from('exam_code_attempts')
    .select('id, violation_count, status')
    .eq('id', attemptId)
    .eq('exam_code', String(code).toUpperCase())
    .maybeSingle();

  if (!attempt || attempt.status !== 'in_progress') {
    res.status(403).json({ success: false, error: 'Invalid attempt' });
    return;
  }

  const newCount = attempt.violation_count + 1;
  const shouldTerminate = newCount >= 3;

  await supabase
    .from('exam_code_attempts')
    .update({
      violation_count: newCount,
      ...(shouldTerminate ? { status: 'terminated_cheating', end_time: new Date().toISOString() } : {}),
    })
    .eq('id', attemptId);

  res.json({
    success: true,
    violation_count: newCount,
    terminated: shouldTerminate,
    message: shouldTerminate
      ? 'Exam auto-submitted due to repeated violations.'
      : `Warning ${newCount}/3. Your exam will be terminated on the 3rd violation.`,
  });
}

/**
 * POST /api/exam-code/:code/save-answer
 * 1b: Per-question autosave with session-token guard.
 */
export async function saveExamCodeAnswer(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const { attemptId, question_id, answer, current_question_index, session_token } = req.body;
  if (!attemptId || !session_token) {
    res.status(400).json({ success: false, error: 'attemptId and session_token are required' });
    return;
  }
  const tokenCheck = await verifyAttemptToken(String(attemptId ?? ""), String(code), session_token ? String(session_token) : undefined);
  if (!tokenCheck.valid) {
    const errCode = tokenCheck.evicted ? 'SESSION_EVICTED' : tokenCheck.terminated ? 'SESSION_ENDED' : 'INVALID_ATTEMPT';
    res.status(tokenCheck.evicted ? 409 : 403).json({ success: false, code: errCode });
    return;
  }
  const { data: row } = await supabase
    .from('exam_code_attempts')
    .select('partial_answers')
    .eq('id', attemptId)
    .maybeSingle();
  const existing = (row?.partial_answers as Record<string, string>) || {};
  if (question_id && answer !== undefined) existing[String(question_id)] = String(answer);
  const upd: Record<string, unknown> = { partial_answers: existing };
  if (current_question_index !== undefined && Number.isInteger(Number(current_question_index))) {
    upd.last_question_index = Number(current_question_index);
  }
  await supabase.from('exam_code_attempts').update(upd).eq('id', attemptId);
  res.json({ success: true, saved: true, total_saved: Object.keys(existing).length });
}

/**
 * GET /api/exam-code/:code/resume-state
 * 1b: Returns partial_answers + last_question_index for crash/refresh recovery.
 */
export async function getExamCodeResumeState(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const { attemptId, session_token } = req.query as { attemptId: string; session_token: string };
  const tokenCheck = await verifyAttemptToken(String(attemptId ?? ""), String(code), session_token ? String(session_token) : undefined);
  if (!tokenCheck.valid) {
    res.status(tokenCheck.evicted ? 409 : 403).json({
      success: false,
      code: tokenCheck.evicted ? 'SESSION_EVICTED' : 'INVALID_ATTEMPT',
    });
    return;
  }
  const { data: row } = await supabase
    .from('exam_code_attempts')
    .select('partial_answers, last_question_index')
    .eq('id', attemptId)
    .maybeSingle();
  res.json({
    success: true,
    partial_answers: row?.partial_answers || {},
    last_question_index: row?.last_question_index ?? 0,
  });
}

/**
 * GET /api/exam-code/:code/leaderboard
 * Public leaderboard for an exam code (college-scoped)
 */
export async function getExamCodeLeaderboard(req: Request, res: Response): Promise<void> {
  const { code } = req.params;

  const { data, error } = await supabase
    .from('exam_code_attempts')
    .select('hall_ticket_no, student_name, score, max_score, correct_count, wrong_count, time_taken_seconds, topic_breakdown, status, created_at')
    .eq('exam_code', String(code).toUpperCase())
    .in('status', ['completed', 'terminated_cheating'])
    .order('score', { ascending: false })
    .order('time_taken_seconds', { ascending: true });

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  const leaderboard = (data || []).map((row, index) => ({
    rank: index + 1,
    hall_ticket: row.hall_ticket_no,
    name: row.student_name || row.hall_ticket_no,
    score: row.score,
    max_score: row.max_score,
    percentage: row.max_score > 0 ? Math.round((Number(row.score) / Number(row.max_score)) * 100) : 0,
    correct_count: row.correct_count,
    wrong_count: row.wrong_count,
    time_taken_seconds: row.time_taken_seconds,
    topic_breakdown: row.topic_breakdown,
    status: row.status,
  }));

  res.json({ success: true, leaderboard, total: leaderboard.length });
}

/**
 * POST /api/admin/exam-codes/:id/import-questions
 * Excel upload of questions for an exam code
 */
export async function importQuestionsForExamCode(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  // Verify exam code exists
  const { data: ec } = await supabase.from('exam_codes').select('exam_code').eq('id', id).single();
  if (!ec) { res.status(404).json({ success: false, error: 'Exam code not found' }); return; }

  // Parse Excel
  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

  if (rows.length === 0) {
    res.status(400).json({ success: false, error: 'Excel file is empty' });
    return;
  }

  const validRows: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel row (header=1)

    const question = String(row['Question'] || row['question'] || '').trim();
    const optA = String(row['OptionA'] || row['Option A'] || row['option_a'] || '').trim();
    const optB = String(row['OptionB'] || row['Option B'] || row['option_b'] || '').trim();
    const optC = String(row['OptionC'] || row['Option C'] || row['option_c'] || '').trim();
    const optD = String(row['OptionD'] || row['Option D'] || row['option_d'] || '').trim();
    const correct = String(row['Correct'] || row['correct'] || row['CorrectAnswer'] || '').trim().toUpperCase();
    const marks = parseFloat(String(row['Marks'] || row['marks'] || '1'));
    const topic = String(row['Topic'] || row['topic'] || 'General').trim();
    const difficulty = String(row['Difficulty'] || row['difficulty'] || 'Medium').trim();
    const explanation = String(row['Explanation'] || row['explanation'] || '').trim();

    if (!question) { errors.push(`Row ${rowNum}: Question is empty`); continue; }
    if (!optA || !optB || !optC || !optD) { errors.push(`Row ${rowNum}: Missing options`); continue; }
    if (!['A', 'B', 'C', 'D'].includes(correct)) { errors.push(`Row ${rowNum}: Correct answer must be A, B, C, or D`); continue; }
    if (isNaN(marks) || marks <= 0) { errors.push(`Row ${rowNum}: Invalid marks value`); continue; }

    validRows.push({
      exam_code: ec.exam_code,
      question,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      correct_answer: correct,
      marks,
      topic,
      difficulty: ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium',
      explanation: explanation || null,
      display_order: i + 1,
    });
  }

  if (validRows.length === 0) {
    res.status(400).json({ success: false, error: 'No valid rows found', row_errors: errors });
    return;
  }

  // Delete existing questions and insert fresh
  await supabase.from('questions_ec').delete().eq('exam_code', ec.exam_code);

  const { error: insertError } = await supabase.from('questions_ec').insert(validRows);
  if (insertError) {
    res.status(500).json({ success: false, error: insertError.message });
    return;
  }

  res.json({
    success: true,
    inserted_count: validRows.length,
    skipped_count: rows.length - validRows.length,
    validation_errors: errors,
    message: `${validRows.length} questions imported for exam code ${ec.exam_code}.`,
  });
}

/**
 * GET /api/admin/exam-codes/:id/report
 * Admin report for a specific exam code
 */
export async function getExamCodeReport(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { data: ec } = await supabase.from('exam_codes').select('exam_code, exam_name').eq('id', id).single();
  if (!ec) { res.status(404).json({ success: false, error: 'Exam code not found' }); return; }

  const { data, error } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('exam_code', ec.exam_code)
    .order('score', { ascending: false });

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  const total = data?.length || 0;
  const completed = data?.filter(d => d.status === 'completed').length || 0;
  const avgScore = total > 0 ? (data!.reduce((s, d) => s + Number(d.score), 0) / total).toFixed(2) : '0';
  const avgPercent = total > 0
    ? (data!.reduce((s, d) => s + (d.max_score > 0 ? (Number(d.score) / Number(d.max_score)) * 100 : 0), 0) / total).toFixed(1)
    : '0';

  res.json({
    success: true,
    summary: { total_attempts: total, completed, avg_score: avgScore, avg_percent: avgPercent, exam_name: ec.exam_name },
    attempts: (data || []).map((d, i) => ({
      rank: i + 1,
      hall_ticket: d.hall_ticket_no,
      name: d.student_name,
      score: d.score,
      max_score: d.max_score,
      percentage: d.max_score > 0 ? Math.round((Number(d.score) / Number(d.max_score)) * 100) : 0,
      correct: d.correct_count,
      wrong: d.wrong_count,
      time_taken: d.time_taken_seconds,
      violations: d.violation_count,
      status: d.status,
    })),
  });
}


