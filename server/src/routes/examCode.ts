import { Router } from 'express';
import multer from 'multer';
import { adminAuth, requireRole, requireCollegeScope } from '../middleware/adminAuth';
import { supabase } from '../db/supabase';
import {
  listColleges,
  createCollege,
  updateCollege,
  deleteCollege,
  listExamCodes,
  createExamCode,
  toggleExamCode,
  getExamCodeQR,
  importQuestionsForExamCode,
  validateAndPreviewQuestions,
  confirmImportQuestions,
  deterministicShuffle,
  getExamCodeReport,
  getAttemptViolations,
  reviewAttemptViolation,
  extendAttemptTime,
  forceSubmitAttempt,
  reevaluateExamCode,
  getExamCodeAnalytics,
} from '../controllers/examCodeController';
import {
  verifyExamEntry,
  getExamCodeQuestions,
  submitExamCodeAttempt,
  logExamCodeViolation,
  getExamCodeLeaderboard,
  saveExamCodeAnswer,
  getExamCodeResumeState,
  saveScreenThumbnail,
} from '../controllers/examCodeController';
import { enrollRateLimit, answerRateLimit, enterExamRateLimit } from '../middleware/rateLimiter';
import { validateBody, verifyExamEntrySchema, saveExamCodeAnswerSchema, submitExamCodeSchema } from '../middleware/validate';


const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── PUBLIC ROUTES (no auth) ───────────────────────────────────

// Public list of colleges for dropdown
router.get('/colleges', listColleges);

// Student exam entry verification (NO OTP) — rate-limited & validated
router.post('/verify-exam-entry', enterExamRateLimit, validateBody(verifyExamEntrySchema), verifyExamEntry);


// Adapters for EnterExamPage & QuizPage routes
router.get('/exam-code/:code/verify', enterExamRateLimit, (req, res) => {
  req.body = {
    examCode: req.params.code,
    hallTicket: req.query.hallTicket || req.body?.hallTicket,
  };
  return verifyExamEntry(req, res);
});
router.post('/exam-code/:code/verify', enterExamRateLimit, (req, res) => {
  req.body = {
    examCode: req.params.code,
    hallTicket: req.body?.hallTicket || req.query.hallTicket,
  };
  return verifyExamEntry(req, res);
});
router.post('/exam-code/:code/validate', enterExamRateLimit, (req, res) => {
  req.body = {
    examCode: req.params.code,
    hallTicket: req.body?.hallTicket || req.query.hallTicket,
  };
  return verifyExamEntry(req, res);
});

// Start session endpoint: returns exam + questions
router.get('/exam-code/:code/start', enterExamRateLimit, async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const hallTicket = String(req.query.hallTicket || 'GUEST').toUpperCase();

  try {
    const { data: exam } = await supabase
      .from('exam_codes')
      .select('*')
      .eq('exam_code', code)
      .maybeSingle();

    const { data: qData } = await supabase
      .from('questions_ec')
      .select('*')
      .eq('exam_code', code);

    // If no questions found for exact code, fallback to first available questions
    let questions = qData;
    if (!questions || questions.length === 0) {
      const { data: fallbackQ } = await supabase
        .from('questions_ec')
        .select('*')
        .limit(15);
      questions = fallbackQ || [];
    }

    const studentIdentifier = `${hallTicket}_${code}`;
    const shuffledQuestions = deterministicShuffle(questions || [], studentIdentifier);

    const formattedQuestions = shuffledQuestions.map((q: any) => {
      const studentSeed = `${studentIdentifier}_${q.id}`;
      const origOpts = [
        { key: 'A', text: q.option_a },
        { key: 'B', text: q.option_b },
        { key: 'C', text: q.option_c },
        { key: 'D', text: q.option_d },
      ].filter((o) => o.text !== undefined && o.text !== null && String(o.text).trim().length > 0);
      const shuffledOpts = deterministicShuffle(origOpts, studentSeed);

      return {
        id: q.id,
        question_text: q.question || q.question_text || 'Question',
        options: shuffledOpts.map((o) => o.text),
        question_type: q.question_type || 'mcq',
        marks: q.marks || 1,
        penalty: Number(q.penalty ?? q.negative_marks ?? 0),
        difficulty: q.difficulty || 'Medium',
        topic: q.topic || 'General',
        section: q.section || 'General',
      };
    });

    return res.json({
      success: true,
      sessionId: `sess_${code}_${hallTicket}_${Date.now()}`,
      exam: exam || {
        exam_name: code,
        duration_minutes: 45,
        total_questions: formattedQuestions.length,
      },
      questions: formattedQuestions,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to start session' });
  }
});

// Get questions for a quiz session
router.get('/exam-code/:code/questions', getExamCodeQuestions);

// Per-question autosave (1b)
router.post('/exam-code/:code/save-answer', answerRateLimit, validateBody(saveExamCodeAnswerSchema), saveExamCodeAnswer);

// Resume state after refresh/crash (1b)
router.get('/exam-code/:code/resume-state', getExamCodeResumeState);

// Submit answers
router.post('/exam-code/:code/submit', validateBody(submitExamCodeSchema), submitExamCodeAttempt);

// Log violation
router.post('/exam-code/:code/violation', logExamCodeViolation);
router.post('/proctor/violation', logExamCodeViolation);
router.post('/proctor/log', logExamCodeViolation);
router.post('/exam-code/:code/screen-thumbnail', saveScreenThumbnail);

// Public leaderboard per exam code
router.get('/exam-code/:code/leaderboard', getExamCodeLeaderboard);

// ─── ADMIN ROUTES (require adminAuth) ─────────────────────────

// Colleges management (mutations restricted to super_admin)
router.get('/admin/colleges', adminAuth, listColleges);
router.post('/admin/colleges', adminAuth, requireRole('super_admin'), createCollege);
router.patch('/admin/colleges/:id', adminAuth, requireRole('super_admin'), updateCollege);
router.delete('/admin/colleges/:id', adminAuth, requireRole('super_admin'), deleteCollege);

// Exam codes management
router.get('/admin/exam-codes', adminAuth, listExamCodes);
router.post('/admin/exam-codes', adminAuth, requireCollegeScope(), createExamCode);
router.patch('/admin/exam-codes/:id/toggle', adminAuth, requireCollegeScope(), toggleExamCode);
router.get('/admin/exam-codes/:id/qr', adminAuth, requireCollegeScope(), getExamCodeQR);
router.get('/admin/exam-codes/:id/report', adminAuth, requireCollegeScope(), getExamCodeReport);

// Question import for exam codes & Faculty 5-column Excel upload with validation and preview
router.post(
  '/admin/exam-codes/:id/import-questions',
  adminAuth,
  requireCollegeScope(),
  upload.single('file'),
  importQuestionsForExamCode
);
router.post(
  '/admin/questions/validate-preview',
  adminAuth,
  upload.single('file'),
  validateAndPreviewQuestions
);
router.post(
  '/admin/questions/confirm-import',
  adminAuth,
  confirmImportQuestions
);
router.post(
  '/admin/exam-codes/:id/validate-preview',
  adminAuth,
  requireCollegeScope(),
  upload.single('file'),
  validateAndPreviewQuestions
);

// Phase 2: Violation timeline & false-positive review
router.get('/admin/attempts/:id/violations', adminAuth, getAttemptViolations);
router.patch('/admin/attempts/:id/violations/:violationId/review', adminAuth, reviewAttemptViolation);

// Phase 3: Live Monitor, Analytics & Results Vault
router.post('/admin/attempts/:id/extend-time', adminAuth, extendAttemptTime);
router.post('/admin/attempts/:id/force-submit', adminAuth, forceSubmitAttempt);
router.post('/admin/exam-codes/:id/reevaluate', adminAuth, requireCollegeScope(), reevaluateExamCode);
router.get('/admin/exam-codes/:id/analytics', adminAuth, requireCollegeScope(), getExamCodeAnalytics);

export default router;
