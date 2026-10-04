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
    .select('*')
    .eq('id', attemptId)
    .eq('exam_code', examCode.toUpperCase())
    .maybeSingle();

  if (!attempt) return { valid: false, evicted: false, terminated: false, attempt: null };
  if (attempt.status === 'terminated_cheating' || attempt.status === 'completed') {
    return { valid: false, evicted: false, terminated: true, attempt };
  }
  // If no stored token yet (legacy row), accept and migrate
  if (!attempt.session_token) return { valid: true, evicted: false, terminated: false, attempt };

  let match = false;
  if (providedToken && typeof providedToken === 'string') {
    const bufA = Buffer.from(String(attempt.session_token));
    const bufB = Buffer.from(String(providedToken));
    if (bufA.length === bufB.length) {
      match = crypto.timingSafeEqual(bufA, bufB);
    }
  }

  if (!match) return { valid: false, evicted: true, terminated: false, attempt };
  return { valid: true, evicted: false, terminated: false, attempt };
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Generates a unique exam code: GR-{COLLEGE_CODE}-{6CHAR} (LOGICWHILELIRE)
 * e.g. GR-VRSEC-8X9P2Q
 * Note: The platform continuously accepts both new GR- and legacy LW- codes.
 */
export function generateExamCode(collegeCode: string): string {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `GR-${collegeCode.toUpperCase()}-${random}`;
}

/**
 * Validates exam code format. Explicitly supports both new GR- and legacy LW- codes.
 */
export function isValidExamCodeFormat(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  return /^(LWL|LIRE|GR|LW)-[A-Z0-9]+-[A-Z0-9]+$/i.test(code.trim()) || /^[A-Z0-9_-]{3,32}$/i.test(code.trim());
}

/**
 * Deterministically shuffles an array using a string seed.
 * Consistent across reloads for the same student session, but unique per candidate.
 */
export function deterministicShuffle<T>(arr: T[], seedStr: string): T[] {
  const copy = [...arr];
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = ((seed << 5) - seed + seedStr.charCodeAt(i)) | 0;
  }
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((Math.abs(seed) / 233280) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ─────────────────────────────────────────────
// COLLEGES
// ─────────────────────────────────────────────

/**
 * GET /api/colleges
 * Public – returns active colleges for dropdown.
 * When ?registration=true is supplied, filters only colleges enabled for student registration.
 */
export async function listColleges(req: Request, res: Response): Promise<void> {
  let query = supabase
    .from('colleges')
    .select('id, college_name, college_code, city, state, is_active, registration_enabled')
    .order('college_name');

  if (req.query.registration === 'true') {
    query = (query as any).eq('is_active', true).eq('registration_enabled', true);
  }

  const { data, error } = await query;

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  
  // Ensure default registration_enabled is true if null/undefined
  const colleges = (data || []).map((c: any) => ({
    ...c,
    registration_enabled: c.registration_enabled !== false,
  }));

  // Extra guard if query was registration=true
  const result = req.query.registration === 'true'
    ? colleges.filter((c: any) => c.registration_enabled && c.is_active)
    : colleges;

  res.json({ success: true, colleges: result });
}

/**
 * POST /api/admin/colleges
 */
export async function createCollege(req: Request, res: Response): Promise<void> {
  const { college_name, college_code, city, state, contact_email, contact_phone, registration_enabled } = req.body;
  if (!college_name || !college_code) {
    res.status(400).json({ success: false, error: 'college_name and college_code are required' });
    return;
  }
  const normalized = college_code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const { data, error } = await supabase
    .from('colleges')
    .insert({
      college_name,
      college_code: normalized,
      city,
      state,
      contact_email,
      contact_phone,
      registration_enabled: registration_enabled !== false,
      is_active: true,
    })
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
  const { college_name, city, state, contact_email, contact_phone, is_active, registration_enabled } = req.body;
  const updates: any = {};
  if (college_name !== undefined) updates.college_name = college_name;
  if (city !== undefined) updates.city = city;
  if (state !== undefined) updates.state = state;
  if (contact_email !== undefined) updates.contact_email = contact_email;
  if (contact_phone !== undefined) updates.contact_phone = contact_phone;
  if (is_active !== undefined) updates.is_active = is_active;
  if (registration_enabled !== undefined) updates.registration_enabled = registration_enabled;

  const { data, error } = await supabase
    .from('colleges')
    .update(updates)
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
    if (existing.status === 'in_progress' || existing.status === 'active') {
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
    .select('id, question, option_a, option_b, option_c, option_d, marks, penalty, negative_marks, difficulty, topic, section, tags, display_order')
    .eq('exam_code', String(code).toUpperCase())
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at');

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  // Phase 3: Section-wise and student-specific question shuffling
  const studentIdentifier = String(attemptId || req.query.candidateId || req.query.hallTicket || 'student');
  const sectionsMap = new Map<string, any[]>();
  for (const q of questions || []) {
    const sec = q.section || q.topic || 'General';
    if (!sectionsMap.has(sec)) sectionsMap.set(sec, []);
    sectionsMap.get(sec)!.push(q);
  }
  const randomizedQuestions: any[] = [];
  for (const [secName, qList] of sectionsMap.entries()) {
    const shuffledList = deterministicShuffle(qList, `${studentIdentifier}_sec_${secName}`);
    randomizedQuestions.push(...shuffledList);
  }

  // Question secrecy guard & per-student option shuffling:
  // Options are shuffled per student; grading strictly uses the server's master key.
  const sanitizedQuestions = (randomizedQuestions || []).map((q: any) => {
    const studentSeed = `${studentIdentifier}_${q.id}`;
    const opts = [
      { key: 'A', text: q.option_a },
      { key: 'B', text: q.option_b },
      { key: 'C', text: q.option_c },
      { key: 'D', text: q.option_d },
    ].filter((o) => o.text !== undefined && o.text !== null && String(o.text).trim().length > 0);

    const shuffledOpts = deterministicShuffle(opts, studentSeed);
    const { correct_answer, correct_option, explanation, ...safeQ } = q;
    return {
      ...safeQ,
      options: shuffledOpts.map((o) => o.text),
      option_a: shuffledOpts[0]?.text ?? null,
      option_b: shuffledOpts[1]?.text ?? null,
      option_c: shuffledOpts[2]?.text ?? null,
      option_d: shuffledOpts[3]?.text ?? null,
      penalty: Number(q.penalty ?? q.negative_marks ?? 0),
    };
  });

  res.json({ success: true, questions: sanitizedQuestions, total: sanitizedQuestions.length });
}

/**
 * POST /api/exam-code/:code/submit
 * Grades and saves the final attempt
 */
export async function submitExamCodeAttempt(req: Request, res: Response): Promise<void> {
  const code = String(req.params.code || req.body?.examCode || '').toUpperCase();
  const { attemptId, answers, codeAnswers, timeTakenSeconds, violationCount, session_token } = req.body;
  const candidateId = req.body.candidateId || req.body.hallTicket;

  let attempt: any = null;

  // ── 1a & 1.4: verify session token or locate attempt by candidateId ──
  if (attemptId && session_token) {
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
    attempt = tokenCheck.attempt;
  } else if (attemptId) {
    const { data } = await supabase
      .from('exam_code_attempts')
      .select('*')
      .eq('id', attemptId)
      .maybeSingle();
    attempt = data;
  } else if (candidateId) {
    const { data } = await supabase
      .from('exam_code_attempts')
      .select('*')
      .eq('exam_code', code)
      .or(`hall_ticket.eq.${candidateId},hall_ticket_no.eq.${candidateId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    attempt = data;
  }

  if (!attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found' });
    return;
  }
  if (attempt.status === 'completed') {
    res.status(409).json({ success: false, error: 'Already submitted' });
    return;
  }

  // ── 1.5 Server-Authoritative Timer & Grace Period (30s) Enforcement ──
  const { data: examData } = await supabase
    .from('exam_codes')
    .select('duration_minutes, total_marks')
    .eq('exam_code', code)
    .maybeSingle();

  const durationMinutes = examData?.duration_minutes || 60;
  const extraTime = attempt.extra_time_seconds || 0;
  const totalAllowedSec = durationMinutes * 60 + extraTime;
  const startTime = attempt.created_at ? new Date(attempt.created_at).getTime() : Date.now();
  const allowedEndTime = startTime + (totalAllowedSec * 1000) + (30 * 1000); // 30s grace window
  const isGraceExpired = Date.now() > allowedEndTime;

  // Merge buffered partial answers from server with final submitted answers
  const finalAnswers: Record<string, any> = {
    ...((attempt.partial_answers as Record<string, any>) || {}),
    ...(answers || {}),
  };

  // Fetch questions with correct answers for server-authoritative grading
  const { data: questions } = await supabase
    .from('questions_ec')
    .select('id, question, correct_answer, marks, penalty, negative_marks, topic, option_a, option_b, option_c, option_d, question_type')
    .eq('exam_code', String(code).toUpperCase());

  if (!questions) {
    res.status(500).json({ success: false, error: 'Could not fetch questions for grading' });
    return;
  }

  // ── 1.5 Pure Server-Authoritative Scoring & Negative Marking ──
  let totalScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let mcqScore = 0;
  let mcqMaxScore = 0;
  const codingQuestionsList: Array<{ id: string; title: string; marks: number; submitted: boolean }> = [];
  const topicBreakdown: Record<string, { correct: number; wrong: number; score: number; maxScore: number; penalty?: number }> = {};
  const optLetters = ['A', 'B', 'C', 'D'];

  const studentIdentifier = String(attempt.id || candidateId || attempt.hall_ticket_no || 'student');

  for (const q of questions) {
    const isCodingQ = q.question_type === 'code' || (!q.option_a && !q.option_b && (String(q.topic || '').toLowerCase().includes('algorithm') || String(q.topic || '').toLowerCase().includes('code')));
    const qMarks = Number(q.marks || 1);
    maxScore += qMarks;
    const topic = q.topic || 'General';
    if (!topicBreakdown[topic]) {
      topicBreakdown[topic] = { correct: 0, wrong: 0, score: 0, maxScore: 0, penalty: 0 };
    }
    topicBreakdown[topic].maxScore += qMarks;

    if (isCodingQ) {
      const codeAns = codeAnswers ? codeAnswers[q.id] : undefined;
      const isSubmitted = typeof codeAns === 'string' && codeAns.trim().length > 0;
      codingQuestionsList.push({
        id: q.id,
        title: q.question || 'Coding Challenge',
        marks: qMarks,
        submitted: isSubmitted,
      });
      // Coding questions are evaluated manually; not scored by MCQ letter matcher
      continue;
    }

    // MCQ question:
    mcqMaxScore += qMarks;
    const studentAnswer = finalAnswers[q.id];
    if (studentAnswer !== undefined && studentAnswer !== null && String(studentAnswer).trim() !== '') {
      // Re-create the student's unique shuffled option mapping
      const studentSeed = `${studentIdentifier}_${q.id}`;
      const origOpts = [
        { key: 'A', text: q.option_a },
        { key: 'B', text: q.option_b },
        { key: 'C', text: q.option_c },
        { key: 'D', text: q.option_d },
      ].filter((o) => o.text !== undefined && o.text !== null && String(o.text).trim().length > 0);
      const shuffledOpts = deterministicShuffle(origOpts, studentSeed);

      let studentMasterLetter = '';
      if (typeof studentAnswer === 'number') {
        studentMasterLetter = shuffledOpts[studentAnswer]?.key || optLetters[studentAnswer] || '';
      } else if (typeof studentAnswer === 'string') {
        const trimmed = studentAnswer.trim();
        if (/^[0-3]$/.test(trimmed)) {
          const idx = parseInt(trimmed, 10);
          studentMasterLetter = shuffledOpts[idx]?.key || optLetters[idx] || '';
        } else {
          // Check matching option text directly in original or shuffled
          const matchedByText = origOpts.find((o) => String(o.text).trim().toLowerCase() === trimmed.toLowerCase());
          if (matchedByText) {
            studentMasterLetter = matchedByText.key;
          } else if (/^[A-D]$/i.test(trimmed)) {
            // Mapped letter or direct letter
            const letterIdx = optLetters.indexOf(trimmed.toUpperCase());
            studentMasterLetter = shuffledOpts[letterIdx]?.key || trimmed.toUpperCase();
          }
        }
      }

      const expectedLetter = String(q.correct_answer || 'A').trim().toUpperCase();
      const penalty = Number(q.penalty ?? q.negative_marks ?? 0);

      if (studentMasterLetter && studentMasterLetter === expectedLetter) {
        totalScore += qMarks;
        mcqScore += qMarks;
        correctCount++;
        topicBreakdown[topic].correct++;
        topicBreakdown[topic].score += qMarks;
      } else {
        wrongCount++;
        const pen = penalty > 0 ? penalty : 0;
        totalScore -= pen;
        mcqScore -= pen;
        topicBreakdown[topic].wrong++;
        topicBreakdown[topic].score -= pen;
        topicBreakdown[topic].penalty = (topicBreakdown[topic].penalty || 0) + pen;
      }
    }
  }

  totalScore = Math.max(0, Math.round(totalScore * 100) / 100);
  mcqScore = Math.max(0, Math.round(mcqScore * 100) / 100);

  const vCount = violationCount !== undefined ? violationCount : (attempt.violation_count || 0);
  const finalStatus = vCount >= 5
    ? 'terminated_cheating'
    : isGraceExpired
    ? 'auto_submitted_expired'
    : 'completed';

  // Update attempt record
  const { error: updateError } = await supabase
    .from('exam_code_attempts')
    .update({
      status: finalStatus,
      end_time: new Date().toISOString(),
      score: totalScore,
      max_score: maxScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      answers: finalAnswers,
      code_answers: codeAnswers || {},
      time_taken_seconds: timeTakenSeconds || Math.round((Date.now() - startTime) / 1000),
      topic_breakdown: topicBreakdown,
      violation_count: vCount,
    })
    .eq('id', attempt.id);

  if (updateError) { res.status(500).json({ success: false, error: updateError.message }); return; }

  // Persist attempt to results table for institutional record keeping
  try {
    await supabase.from('results').insert({
      attempt_id: attempt.id,
      exam_id: attempt.exam_code,
      exam_code: attempt.exam_code,
      student_id: attempt.hall_ticket_no,
      student_name: attempt.student_name,
      score: totalScore,
      max_score: maxScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      status: finalStatus,
      answers: finalAnswers,
      time_taken_seconds: timeTakenSeconds || Math.round((Date.now() - startTime) / 1000),
      submitted_at: new Date().toISOString(),
    });
  } catch {}

  // Clear leaderboard cache for fresh rank computation
  try {
    leaderboardCache.delete(code);
  } catch {}

  // Trigger throttled room telemetry (<= 1 update per second per room)
  try {
    const { scheduleThrottledRoomUpdate } = await import('../services/socketService');
    scheduleThrottledRoomUpdate(code);
  } catch {}

  res.json({
    success: true,
    result: {
      score: totalScore,
      max_score: maxScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      topic_breakdown: topicBreakdown,
      status: finalStatus,
      expired_grace: isGraceExpired,
      code_answers: codeAnswers || {},
      mcq_score: mcqScore,
      mcq_max_score: mcqMaxScore > 0 ? mcqMaxScore : maxScore,
      mcq_percentage: mcqMaxScore > 0 ? Math.round((mcqScore / mcqMaxScore) * 100) : (maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0),
      coding_questions: codingQuestionsList,
      has_coding_questions: codingQuestionsList.length > 0,
    },
  });
}

/**
 * POST /api/exam-code/:code/violation
 * Phase 2: Logs violation with snapshot thumbnail, timestamps, configurable thresholds,
 * grace period check, and maintains violation_timeline.
 */
export async function logExamCodeViolation(req: Request, res: Response): Promise<void> {
  const code = (req.params.code || req.body.examCode || '').toUpperCase();
  const attemptId = req.body.attemptId || req.body.candidateId;
  const violationType = req.body.violationType || req.body.eventType || 'tab_switch';
  const notes = req.body.notes || req.body.metadata?.message || req.body.message || '';
  const snapshot_thumb = req.body.snapshot_thumb || req.body.snapshot || null;

  // 1. Look up attempt
  let query = supabase.from('exam_code_attempts').select('*');
  if (attemptId) {
    query = (query as any).or(`id.eq.${attemptId},hall_ticket_no.eq.${attemptId},hall_ticket.eq.${attemptId}`);
  }
  if (code) {
    query = (query as any).eq('exam_code', code);
  }
  const { data: attempt } = await query.maybeSingle();

  if (!attempt || (attempt.status !== 'in_progress' && attempt.status !== 'active')) {
    res.status(403).json({ success: false, error: 'Invalid attempt or session closed' });
    return;
  }

  // 2. Fetch exam settings for configurable proctoring rules
  const { data: exam } = await supabase
    .from('exam_codes')
    .select('max_violations, auto_terminate, grace_period_seconds')
    .eq('exam_code', attempt.exam_code)
    .maybeSingle();

  const maxViolations = Number(exam?.max_violations) > 0 ? Number(exam?.max_violations) : 5;
  const autoTerminate = exam?.auto_terminate !== false;
  const gracePeriodSec = Number(exam?.grace_period_seconds) || 0;

  // Check if inside grace period since attempt creation
  const attemptStart = new Date(attempt.created_at || Date.now()).getTime();
  const elapsedSec = (Date.now() - attemptStart) / 1000;
  const isGrace = elapsedSec < gracePeriodSec;

  const currentTimeline = Array.isArray(attempt.violation_timeline) ? attempt.violation_timeline : [];
  const currentCount = Number(attempt.violation_count) || 0;
  const newCount = isGrace ? currentCount : currentCount + 1;
  const shouldTerminate = autoTerminate && newCount >= maxViolations;

  const vItem = {
    id: `viol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: violationType,
    message: notes || `${violationType} detected`,
    timestamp: new Date().toISOString(),
    snapshot_thumb: snapshot_thumb ? String(snapshot_thumb).slice(0, 30000) : null,
    count: newCount,
    duration_seconds: req.body.duration_seconds || req.body.duration || null,
    exit_number: req.body.exitCount || req.body.exit_count || null,
    peak_db: req.body.peak_db || req.body.peakDb || null,
    in_grace_period: isGrace,
    is_false_positive: false,
    reviewed_by: null,
    reviewed_at: null,
  };

  const updatedTimeline = [...currentTimeline, vItem];

  await supabase
    .from('exam_code_attempts')
    .update({
      violation_count: newCount,
      violation_timeline: updatedTimeline,
      ...(shouldTerminate ? { status: 'terminated_cheating', end_time: new Date().toISOString() } : {}),
    })
    .eq('id', attempt.id);

  try {
    await supabase.from('proctor_logs').insert({
      id: vItem.id,
      exam_id: code,
      candidate_id: attempt.hall_ticket_no || attempt.hall_ticket || String(attempt.id),
      event_type: violationType,
      metadata: { message: notes || `${violationType} detected`, count: newCount, snapshot_thumb: vItem.snapshot_thumb },
      created_at: vItem.timestamp,
    });
  } catch {}

  res.json({
    success: true,
    violation_id: vItem.id,
    violation_count: newCount,
    count: newCount,
    max_violations: maxViolations,
    in_grace_period: isGrace,
    terminated: shouldTerminate,
    message: isGrace
      ? `Grace period active: ${notes || violationType} noted without strike.`
      : shouldTerminate
      ? `Exam auto-submitted due to reaching ${maxViolations} violations.`
      : `Warning ${newCount}/${maxViolations}: ${notes || violationType}.`,
  });
}

/**
 * POST /api/exam-code/:code/screen-thumbnail
 * Phase 1.2: Records periodic (30s) screen capture thumbnail for proctoring audit
 */
export async function saveScreenThumbnail(req: Request, res: Response): Promise<void> {
  const code = (req.params.code || req.body.examCode || '').toUpperCase();
  const candidateId = req.body.candidateId || req.body.hallTicket;
  const thumbnail = req.body.thumbnail || req.body.screen_thumb;
  const timestamp = req.body.timestamp || new Date().toISOString();

  if (!candidateId || !thumbnail) {
    res.status(400).json({ success: false, error: 'candidateId and thumbnail required' });
    return;
  }

  await supabase
    .from('exam_code_attempts')
    .update({
      latest_screen_thumb: String(thumbnail).slice(0, 50000),
      screen_thumb_updated_at: timestamp,
    })
    .or(`hall_ticket.eq.${candidateId},hall_ticket_no.eq.${candidateId}`);

  res.json({ success: true, timestamp });
}

/**
 * GET /api/admin/attempts/:id/violations
 * Phase 2: Returns candidate violation timeline with snapshot evidence
 */
export async function getAttemptViolations(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { data: attempt, error } = await supabase
    .from('exam_code_attempts')
    .select('id, exam_code, hall_ticket_no, student_name, violation_count, violation_timeline, status, created_at, end_time')
    .eq('id', id)
    .maybeSingle();

  if (error || !attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found' });
    return;
  }

  res.json({
    success: true,
    attempt: {
      id: attempt.id,
      exam_code: attempt.exam_code,
      hall_ticket_no: attempt.hall_ticket_no,
      student_name: attempt.student_name,
      violation_count: attempt.violation_count || 0,
      status: attempt.status,
      timeline: attempt.violation_timeline || [],
    },
  });
}

/**
 * PATCH /api/admin/attempts/:id/violations/:violationId/review
 * Phase 2: False-positive review + override
 */
export async function reviewAttemptViolation(req: Request, res: Response): Promise<void> {
  const { id, violationId } = req.params;
  const { is_false_positive, review_notes } = req.body;
  const adminUser = (req as any).admin?.sub || (req as any).admin?.name || 'admin';

  const { data: attempt, error } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found' });
    return;
  }

  const timeline = Array.isArray(attempt.violation_timeline) ? [...attempt.violation_timeline] : [];
  const targetIdx = timeline.findIndex((v: any) => v.id === violationId);
  if (targetIdx === -1) {
    res.status(404).json({ success: false, error: 'Violation record not found in candidate timeline' });
    return;
  }

  timeline[targetIdx] = {
    ...timeline[targetIdx],
    is_false_positive: Boolean(is_false_positive),
    review_notes: review_notes || (is_false_positive ? 'Marked as false positive by admin' : 'Confirmed by admin'),
    reviewed_by: adminUser,
    reviewed_at: new Date().toISOString(),
  };

  // Recalculate active (non-false-positive and non-grace) violations
  const activeCount = timeline.filter((v: any) => !v.is_false_positive && !v.in_grace_period).length;

  // Check if attempt was terminated for cheating and now qualifies for restoration
  let newStatus = attempt.status;
  let restored = false;
  if (attempt.status === 'terminated_cheating' && activeCount < 5) {
    newStatus = 'in_progress';
    restored = true;
  }

  await supabase
    .from('exam_code_attempts')
    .update({
      violation_count: activeCount,
      violation_timeline: timeline,
      status: newStatus,
    })
    .eq('id', id);

  res.json({
    success: true,
    message: is_false_positive ? 'Violation marked as false positive.' : 'Violation confirmed.',
    violation_count: activeCount,
    status: newStatus,
    restored,
    timeline,
  });
}

/**
 * POST /api/exam-code/:code/save-answer
 * 1b & 1.4: Per-question autosave and batch offline buffer sync with session-token and candidateId guards.
 */
export async function saveExamCodeAnswer(req: Request, res: Response): Promise<void> {
  const code = String(req.params.code || req.body?.examCode || '').toUpperCase();
  const { attemptId, question_id, answer, answers, items, current_question_index, session_token } = req.body;
  const candidateId = req.body.candidateId || req.body.hallTicket;

  let attempt: any = null;

  if (attemptId) {
    if (!session_token) {
      res.status(400).json({ success: false, error: 'session_token required when attemptId is provided', code: 'TOKEN_REQUIRED' });
      return;
    }
    const tokenCheck = await verifyAttemptToken(String(attemptId), String(code), String(session_token));
    if (!tokenCheck.valid) {
      const errCode = tokenCheck.evicted ? 'SESSION_EVICTED' : tokenCheck.terminated ? 'SESSION_ENDED' : 'INVALID_ATTEMPT';
      res.status(tokenCheck.evicted ? 409 : 403).json({ success: false, code: errCode });
      return;
    }
    attempt = tokenCheck.attempt;
  } else if (candidateId) {
    const { data } = await supabase
      .from('exam_code_attempts')
      .select('*')
      .eq('exam_code', code)
      .or(`hall_ticket.eq.${candidateId},hall_ticket_no.eq.${candidateId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    attempt = data;
  } else {
    res.status(400).json({ success: false, error: 'attemptId or candidateId required' });
    return;
  }

  if (!attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found or session expired', code: 'INVALID_ATTEMPT' });
    return;
  }

  const existing = (attempt.partial_answers as Record<string, string>) || {};

  // Single answer
  if (question_id && answer !== undefined && answer !== null) {
    existing[String(question_id)] = String(answer);
  }

  // Batch map
  if (answers && typeof answers === 'object') {
    for (const [qId, ans] of Object.entries(answers)) {
      if (ans !== undefined && ans !== null) {
        existing[String(qId)] = String(ans);
      }
    }
  }

  // Batch array of items
  if (Array.isArray(items)) {
    for (const item of items) {
      const qId = item.question_id || item.questionId;
      const ans = item.answer;
      if (qId && ans !== undefined && ans !== null) {
        existing[String(qId)] = String(ans);
      }
    }
  }

  const upd: Record<string, unknown> = { partial_answers: existing };
  if (current_question_index !== undefined && Number.isInteger(Number(current_question_index))) {
    upd.last_question_index = Number(current_question_index);
  }

  await supabase.from('exam_code_attempts').update(upd).eq('id', attempt.id);

  // Trigger throttled room telemetry (<= 1 update per second per room)
  try {
    const { scheduleThrottledRoomUpdate } = await import('../services/socketService');
    scheduleThrottledRoomUpdate(code);
  } catch {}

  res.json({
    success: true,
    saved: true,
    total_saved: Object.keys(existing).length,
    partial_answers: existing,
  });
}

/**
 * GET /api/exam-code/:code/resume-state
 * 1b & 1.4: Returns partial_answers + last_question_index for crash/refresh recovery.
 */
export async function getExamCodeResumeState(req: Request, res: Response): Promise<void> {
  const code = String(req.params.code || '').toUpperCase();
  const { attemptId, session_token } = req.query as { attemptId?: string; session_token?: string };
  const candidateId = req.query.candidateId || req.query.hallTicket;

  let attempt: any = null;

  if (attemptId && session_token) {
    const tokenCheck = await verifyAttemptToken(String(attemptId), String(code), String(session_token));
    if (!tokenCheck.valid) {
      res.status(tokenCheck.evicted ? 409 : 403).json({
        success: false,
        code: tokenCheck.evicted ? 'SESSION_EVICTED' : 'INVALID_ATTEMPT',
      });
      return;
    }
    attempt = tokenCheck.attempt;
  } else if (attemptId) {
    const { data } = await supabase.from('exam_code_attempts').select('*').eq('id', attemptId).maybeSingle();
    attempt = data;
  } else if (candidateId) {
    const { data } = await supabase
      .from('exam_code_attempts')
      .select('*')
      .eq('exam_code', code)
      .or(`hall_ticket.eq.${candidateId},hall_ticket_no.eq.${candidateId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    attempt = data;
  } else {
    res.status(400).json({ success: false, error: 'attemptId or candidateId required' });
    return;
  }

  if (!attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found' });
    return;
  }

  res.json({
    success: true,
    partial_answers: attempt.partial_answers || {},
    last_question_index: attempt.last_question_index ?? 0,
  });
}

// ─────────────────────────────────────────────
// LEADERBOARD CACHE (read-heavy scaling)
// ─────────────────────────────────────────────
const leaderboardCache = new Map<string, { timestamp: number; payload: any }>();
const LEADERBOARD_CACHE_TTL_MS = 5000;

/**
 * GET /api/exam-code/:code/leaderboard
 * Public leaderboard for an exam code (college-scoped)
 */
export async function getExamCodeLeaderboard(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const cacheKey = String(code).toUpperCase();

  const cached = leaderboardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LEADERBOARD_CACHE_TTL_MS) {
    res.json(cached.payload);
    return;
  }

  const { data, error } = await supabase
    .from('exam_code_attempts')
    .select('hall_ticket_no, student_name, score, max_score, correct_count, wrong_count, time_taken_seconds, topic_breakdown, status, created_at')
    .eq('exam_code', cacheKey)
    .in('status', ['completed', 'terminated_cheating'])
    .order('score', { ascending: false })
    .order('time_taken_seconds', { ascending: true });

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  const leaderboard = (data || []).map((row, index) => ({
    rank: index + 1,
    hall_ticket: row.hall_ticket_no,
    hall_ticket_no: row.hall_ticket_no,
    student_id: row.hall_ticket_no,
    name: row.student_name || row.hall_ticket_no,
    student_name: row.student_name || row.hall_ticket_no,
    score: row.score,
    max_score: row.max_score,
    percentage: row.max_score > 0 ? Math.round((Number(row.score) / Number(row.max_score)) * 100) : 0,
    correct_count: row.correct_count,
    wrong_count: row.wrong_count,
    time_taken_seconds: row.time_taken_seconds,
    topic_breakdown: row.topic_breakdown,
    status: row.status,
  }));

  const payload = { success: true, leaderboard, total: leaderboard.length };
  leaderboardCache.set(cacheKey, { timestamp: Date.now(), payload });

  res.json(payload);
}

/**
 * POST /api/admin/exam-codes/:id/import-questions
 * Excel upload of questions for an exam code
 */
/**
 * POST /api/admin/exam-codes/:id/import-questions
 * Phase 3: Excel upload with duplicate detection, section-wise tags, and validation report
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

  // Fetch existing questions for duplicate detection
  const { data: existingDbQuestions } = await supabase
    .from('questions_ec')
    .select('question')
    .eq('exam_code', ec.exam_code);

  const seenNorm = new Set<string>(
    (existingDbQuestions || []).map((q: any) =>
      String(q.question || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    )
  );

  const validRows: any[] = [];
  const errors: string[] = [];
  const duplicates: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel row (header=1)

    // Normalize keys
    const norm: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      norm[k.trim().toLowerCase().replace(/[\s_]/g, '')] = String(v ?? '').trim();
    }

    const question = String(
      norm['questiontext'] || norm['question'] || row['Question'] || row['question'] || ''
    ).trim();

    // Check pipe options (Col C: option1 | option2 | option3 | option4)
    const optionsPipe = String(
      norm['options'] || norm['option1option2option3option4'] || norm['optionslist'] || ''
    ).trim();

    let optA = '';
    let optB = '';
    let optC = '';
    let optD = '';

    if (optionsPipe && optionsPipe.includes('|')) {
      const parts = optionsPipe.split('|').map((s) => s.trim());
      optA = parts[0] || '';
      optB = parts[1] || '';
      optC = parts[2] || '';
      optD = parts[3] || '';
    } else {
      optA = String(norm['optiona'] || row['OptionA'] || row['Option A'] || row['option_a'] || '').trim();
      optB = String(norm['optionb'] || row['OptionB'] || row['Option B'] || row['option_b'] || '').trim();
      optC = String(norm['optionc'] || row['OptionC'] || row['Option C'] || row['option_c'] || '').trim();
      optD = String(norm['optiond'] || row['OptionD'] || row['Option D'] || row['option_d'] || '').trim();
    }

    const qType = String(norm['type'] || norm['questiontype'] || 'mcq').toLowerCase();
    if (qType === 'code' && (!optA || !optB)) {
      optA = 'Submission';
      optB = '-';
      optC = '-';
      optD = '-';
    }

    let correctRaw = String(
      norm['correctindex'] || norm['correct'] || norm['correctoption'] || norm['correctanswer'] || row['Correct'] || row['correct'] || row['CorrectAnswer'] || ''
    ).trim().toUpperCase();

    if (correctRaw === '0') correctRaw = 'A';
    else if (correctRaw === '1') correctRaw = 'B';
    else if (correctRaw === '2') correctRaw = 'C';
    else if (correctRaw === '3') correctRaw = 'D';

    const correct = correctRaw;
    const marks = parseFloat(String(norm['marks'] || row['Marks'] || row['marks'] || '1'));
    const topic = String(norm['topic'] || row['Topic'] || row['topic'] || 'General').trim();
    const section = String(norm['section'] || row['Section'] || row['section'] || topic).trim();
    const tags = String(norm['tags'] || row['Tags'] || row['tags'] || '').trim();
    const difficulty = String(norm['difficulty'] || row['Difficulty'] || row['difficulty'] || 'Medium').trim();
    const explanation = String(norm['explanation'] || row['Explanation'] || row['explanation'] || '').trim();

    if (!question) { errors.push(`Row ${rowNum}: Question is empty`); continue; }
    if (!optA || !optB || !optC || !optD) { errors.push(`Row ${rowNum}: Missing options`); continue; }
    if (!['A', 'B', 'C', 'D'].includes(correct)) { errors.push(`Row ${rowNum}: Correct answer must be A, B, C, or D`); continue; }
    if (isNaN(marks) || marks <= 0) { errors.push(`Row ${rowNum}: Invalid marks value`); continue; }

    const normKey = question.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenNorm.has(normKey)) {
      duplicates.push(`Row ${rowNum}: "${question.slice(0, 45)}..." is a duplicate.`);
      continue;
    }
    seenNorm.add(normKey);

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
      section,
      tags: tags ? tags.split(',').map((t) => t.trim()) : [],
      difficulty: ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium',
      explanation: explanation || null,
      display_order: i + 1,
    });
  }

  if (validRows.length === 0) {
    res.status(400).json({
      success: false,
      error: 'No valid rows found',
      row_errors: errors,
      duplicates,
    });
    return;
  }

  const { error: insertError } = await supabase.from('questions_ec').insert(validRows);
  if (insertError) {
    res.status(500).json({ success: false, error: insertError.message });
    return;
  }

  res.json({
    success: true,
    total_rows: rows.length,
    inserted_count: validRows.length,
    duplicate_count: duplicates.length,
    skipped_count: rows.length - validRows.length,
    duplicates,
    validation_errors: errors,
    message: `${validRows.length} questions imported for exam code ${ec.exam_code}.`,
  });
}

/**
 * POST /api/admin/questions/validate-preview
 * Faculty upload questions by Excel in the 5-column format with validation and preview.
 * Supports:
 * - 5-column format: [Question, Option A, Option B, Option C, Option D]
 * - Extended format with Correct Option, Marks, Negative Marks / Penalty, Section, Topic, Difficulty
 */
export async function validateAndPreviewQuestions(req: Request, res: Response): Promise<void> {
  try {
    let rows: any[] = [];
    if (req.file) {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    } else if (Array.isArray(req.body.questions)) {
      rows = req.body.questions;
    } else if (Array.isArray(req.body.rows)) {
      rows = req.body.rows;
    }

    if (rows.length === 0) {
      res.status(400).json({ success: false, error: 'No question rows found in uploaded file or request body' });
      return;
    }

    const preview: any[] = [];
    const allErrors: string[] = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const rowErrors: string[] = [];

      const norm: Record<string, string> = {};
      const keys = Object.keys(row);
      for (const k of keys) {
        norm[k.trim().toLowerCase().replace(/[\s_]/g, '')] = String(row[k] ?? '').trim();
      }

      let question = '';
      let optA = '';
      let optB = '';
      let optC = '';
      let optD = '';
      let correct = '';
      let marks = 1;
      let penalty = 0;
      let section = 'General';
      let topic = 'General';
      let difficulty = 'Medium';

      if (keys.length >= 5 && (!norm['question'] && !norm['questiontext'])) {
        // Positional 5-column format: Col 1: Question, Col 2: Opt A, Col 3: Opt B, Col 4: Opt C, Col 5: Opt D
        question = String(row[keys[0]] ?? '').trim();
        optA = String(row[keys[1]] ?? '').trim();
        optB = String(row[keys[2]] ?? '').trim();
        optC = String(row[keys[3]] ?? '').trim();
        optD = String(row[keys[4]] ?? '').trim();
        if (keys.length > 5) correct = String(row[keys[5]] ?? '').trim().toUpperCase();
        if (keys.length > 6) marks = parseFloat(String(row[keys[6]])) || 1;
        if (keys.length > 7) penalty = parseFloat(String(row[keys[7]])) || 0;
      } else {
        question = String(norm['question'] || norm['questiontext'] || row['Question'] || '').trim();
        optA = String(norm['optiona'] || row['Option A'] || row['OptionA'] || '').trim();
        optB = String(norm['optionb'] || row['Option B'] || row['OptionB'] || '').trim();
        optC = String(norm['optionc'] || row['Option C'] || row['OptionC'] || '').trim();
        optD = String(norm['optiond'] || row['Option D'] || row['OptionD'] || '').trim();
        correct = String(norm['correct'] || norm['correctoption'] || norm['correctanswer'] || row['Correct Answer'] || '').trim().toUpperCase();
        marks = parseFloat(String(norm['marks'] || row['Marks'] || '1')) || 1;
        penalty = parseFloat(String(norm['penalty'] || norm['negativemarks'] || norm['negativemarking'] || row['Penalty'] || '0')) || 0;
        section = String(norm['section'] || row['Section'] || 'General').trim();
        topic = String(norm['topic'] || row['Topic'] || 'General').trim();
        difficulty = String(norm['difficulty'] || row['Difficulty'] || 'Medium').trim();
      }

      // Default correct to 'A' if 5-column minimal format was uploaded without answer column
      if (!correct || correct === '') {
        correct = 'A';
      } else if (correct === '0' || correct === '1' || correct === '2' || correct === '3') {
        correct = ['A', 'B', 'C', 'D'][parseInt(correct, 10)] || 'A';
      }

      if (!question) rowErrors.push('Question text is required');
      if (!optA) rowErrors.push('Option A is required');
      if (!optB) rowErrors.push('Option B is required');
      if (!optC) rowErrors.push('Option C is required');
      if (!optD) rowErrors.push('Option D is required');
      if (!['A', 'B', 'C', 'D'].includes(correct)) rowErrors.push('Correct option must be A, B, C, or D');
      if (isNaN(marks) || marks <= 0) rowErrors.push('Marks must be greater than 0');
      if (isNaN(penalty) || penalty < 0) rowErrors.push('Negative marking penalty must be >= 0');

      const isValid = rowErrors.length === 0;
      if (isValid) validCount++;
      else {
        invalidCount++;
        allErrors.push(`Row ${rowNum}: ${rowErrors.join(', ')}`);
      }

      preview.push({
        row_number: rowNum,
        valid: isValid,
        question,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        correct_answer: correct,
        marks,
        penalty,
        section: section || 'General',
        topic: topic || 'General',
        difficulty: ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium',
        errors: rowErrors,
      });
    }

    res.json({
      success: true,
      total_rows: rows.length,
      valid_count: validCount,
      invalid_count: invalidCount,
      preview: preview.slice(0, 100),
      errors: allErrors,
      can_import: validCount > 0,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Validation failed' });
  }
}

/**
 * POST /api/admin/questions/confirm-import
 * Commits the validated preview questions into the database
 */
export async function confirmImportQuestions(req: Request, res: Response): Promise<void> {
  try {
    const { examCode, examId, questions } = req.body;
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ success: false, error: 'No questions provided for import' });
      return;
    }

    const targetCode = String(examCode || 'DEFAULT').toUpperCase();
    const rowsToInsert = questions.map((q: any, idx: number) => ({
      exam_code: targetCode,
      exam_id: examId || null,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer || 'A',
      marks: Number(q.marks || 1),
      penalty: Number(q.penalty || 0),
      negative_marks: Number(q.penalty || 0),
      topic: q.topic || 'General',
      section: q.section || 'General',
      difficulty: q.difficulty || 'Medium',
      display_order: idx + 1,
    }));

    const { error } = await supabase.from('questions_ec').insert(rowsToInsert);
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    // Also populate standard questions table
    try {
      await supabase.from('questions').insert(
        rowsToInsert.map((r: any) => ({
          exam_id: examId || targetCode,
          question_text: r.question,
          option_a: r.option_a,
          option_b: r.option_b,
          option_c: r.option_c,
          option_d: r.option_d,
          correct_option: r.correct_answer.toLowerCase(),
          marks: r.marks,
          penalty: r.penalty,
          topic: r.topic,
          difficulty: r.difficulty,
          section: r.section,
        }))
      );
    } catch {}

    res.json({
      success: true,
      imported_count: rowsToInsert.length,
      exam_code: targetCode,
      message: `Successfully imported ${rowsToInsert.length} questions for ${targetCode}.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Import failed' });
  }
}

/**
 * POST /api/admin/attempts/:id/extend-time
 * Phase 3 Live Monitor: Extends candidate time by X minutes
 */
export async function extendAttemptTime(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { minutes } = req.body;
  const mins = parseInt(String(minutes || '10'), 10);

  const { data: attempt, error } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found' });
    return;
  }

  const extendedSec = (attempt.time_extended_seconds || 0) + mins * 60;
  await supabase
    .from('exam_code_attempts')
    .update({ time_extended_seconds: extendedSec })
    .eq('id', id);

  res.json({
    success: true,
    message: `Extended time by ${mins} minutes.`,
    attempt_id: id,
    total_extended_minutes: Math.round(extendedSec / 60),
  });
}

/**
 * POST /api/admin/attempts/:id/force-submit
 * Phase 3 Live Monitor: Force-submit a candidate's session
 */
export async function forceSubmitAttempt(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { data: attempt, error } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !attempt) {
    res.status(404).json({ success: false, error: 'Attempt not found' });
    return;
  }

  if (attempt.status === 'completed') {
    res.status(400).json({ success: false, error: 'Attempt already completed' });
    return;
  }

  // Grade partial answers
  const { data: questions } = await supabase
    .from('questions_ec')
    .select('id, correct_answer, marks, topic')
    .eq('exam_code', attempt.exam_code);

  const answers = (attempt.partial_answers as Record<string, string>) || {};
  let totalScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let wrongCount = 0;

  for (const q of questions || []) {
    maxScore += Number(q.marks);
    const ans = answers[q.id];
    if (ans && ans.toUpperCase() === q.correct_answer.toUpperCase()) {
      totalScore += Number(q.marks);
      correctCount++;
    } else if (ans) {
      wrongCount++;
    }
  }

  await supabase
    .from('exam_code_attempts')
    .update({
      status: 'completed',
      end_time: new Date().toISOString(),
      score: totalScore,
      max_score: maxScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', id);

  res.json({
    success: true,
    message: 'Candidate session successfully force-submitted and graded.',
    attempt_id: id,
    score: totalScore,
    max_score: maxScore,
  });
}

/**
 * POST /api/admin/exam-codes/:id/reevaluate
 * Phase 3 Results Vault: Re-grades all submitted attempts against updated questions
 */
export async function reevaluateExamCode(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { data: ec } = await supabase.from('exam_codes').select('exam_code').eq('id', id).maybeSingle();
  if (!ec) { res.status(404).json({ success: false, error: 'Exam code not found' }); return; }

  const { data: questions } = await supabase
    .from('questions_ec')
    .select('id, correct_answer, marks, topic')
    .eq('exam_code', ec.exam_code);

  const { data: attempts } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('exam_code', ec.exam_code);

  let updatedCount = 0;

  for (const attempt of attempts || []) {
    const answers = (attempt.answers || attempt.partial_answers || {}) as Record<string, string>;
    let totalScore = 0;
    let maxScore = 0;
    let correctCount = 0;
    let wrongCount = 0;

    for (const q of questions || []) {
      maxScore += Number(q.marks);
      const studentAns = answers[q.id];
      if (studentAns && studentAns.toUpperCase() === q.correct_answer.toUpperCase()) {
        totalScore += Number(q.marks);
        correctCount++;
      } else if (studentAns) {
        wrongCount++;
      }
    }

    await supabase
      .from('exam_code_attempts')
      .update({
        score: totalScore,
        max_score: maxScore,
        correct_count: correctCount,
        wrong_count: wrongCount,
        percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      })
      .eq('id', attempt.id);

    updatedCount++;
  }

  res.json({
    success: true,
    message: `Successfully re-evaluated ${updatedCount} candidate attempts for ${ec.exam_code}.`,
    reevaluated_attempts: updatedCount,
  });
}

/**
 * GET /api/admin/exam-codes/:id/analytics
 * Phase 3 Analytics: Question difficulty index, topic-wise accuracy, score distribution, time-per-question heatmap
 */
export async function getExamCodeAnalytics(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { data: ec } = await supabase.from('exam_codes').select('*').eq('id', id).maybeSingle();
  if (!ec) { res.status(404).json({ success: false, error: 'Exam code not found' }); return; }

  const { data: questions } = await supabase
    .from('questions_ec')
    .select('*')
    .eq('exam_code', ec.exam_code);

  const { data: attempts } = await supabase
    .from('exam_code_attempts')
    .select('*')
    .eq('exam_code', ec.exam_code);

  const totalAttempts = attempts?.length || 0;
  const completedAttempts = attempts?.filter((a) => a.status === 'completed') || [];

  // 1. Question Difficulty Index (% correct per question)
  const questionDifficulty = (questions || []).map((q) => {
    let correctCount = 0;
    let attemptedCount = 0;
    for (const a of completedAttempts) {
      const answers = (a.answers || a.partial_answers || {}) as Record<string, string>;
      if (answers[q.id]) {
        attemptedCount++;
        if (answers[q.id].toUpperCase() === q.correct_answer.toUpperCase()) {
          correctCount++;
        }
      }
    }
    const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
    return {
      id: q.id,
      question: q.question,
      topic: q.topic || 'General',
      difficulty_rated: q.difficulty,
      accuracy_percentage: accuracy,
      difficulty_index: accuracy >= 70 ? 'Easy' : accuracy >= 40 ? 'Medium' : 'Hard',
      attempted_count: attemptedCount,
      correct_count: correctCount,
    };
  });

  // 2. Topic-wise Accuracy
  const topicStats: Record<string, { total: number; correct: number }> = {};
  for (const q of questionDifficulty) {
    if (!topicStats[q.topic]) topicStats[q.topic] = { total: 0, correct: 0 };
    topicStats[q.topic].total += q.attempted_count;
    topicStats[q.topic].correct += q.correct_count;
  }
  const topicAccuracy = Object.entries(topicStats).map(([topic, stat]) => ({
    topic,
    accuracy: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
    total_answers: stat.total,
  }));

  // 3. Score Distribution Buckets (0-20, 21-40, 41-60, 61-80, 81-100)
  const buckets = { '0-20%': 0, '21-40%': 0, '41-60%': 0, '61-80%': 0, '81-100%': 0 };
  for (const a of completedAttempts) {
    const pct = a.max_score > 0 ? (Number(a.score) / Number(a.max_score)) * 100 : 0;
    if (pct <= 20) buckets['0-20%']++;
    else if (pct <= 40) buckets['21-40%']++;
    else if (pct <= 60) buckets['41-60%']++;
    else if (pct <= 80) buckets['61-80%']++;
    else buckets['81-100%']++;
  }

  // 4. Time-per-question heatmap
  const avgTimeTakenSec =
    completedAttempts.length > 0
      ? Math.round(
          completedAttempts.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0) /
            completedAttempts.length
        )
      : 0;

  res.json({
    success: true,
    exam: { exam_code: ec.exam_code, exam_name: ec.exam_name },
    summary: {
      total_candidates: totalAttempts,
      completed_count: completedAttempts.length,
      average_time_taken_seconds: avgTimeTakenSec,
    },
    question_difficulty: questionDifficulty,
    topic_accuracy: topicAccuracy,
    score_distribution: buckets,
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


