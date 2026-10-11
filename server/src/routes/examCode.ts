import { Router } from 'express';
import multer from 'multer';
import { adminAuth, requireRole, requireCollegeScope, requireFacultyPermission } from '../middleware/adminAuth';
import { auditLog } from '../middleware/auditLog';
import { supabase } from '../db/supabase';
import {
  listColleges,
  createCollege,
  updateCollege,
  deleteCollege,
  bulkImportCollegesHandler,
  listExamCodes,
  createExamCode,
  toggleExamCode,
  getExamCodeQR,
  importQuestionsForExamCode,
  validateAndPreviewQuestions,
  confirmImportQuestions,
  downloadSampleQuestionsTemplate,
  deterministicShuffle,
  getExamCodeReport,
  getAttemptViolations,
  reviewAttemptViolation,
  extendAttemptTime,
  forceSubmitAttempt,
  reevaluateExamCode,
  getExamCodeAnalytics,
  allocateQuestionPaper,
  lockQuestionPaper,
  replaceQuestionPaper,
  validateStudentEligibility,
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
const handleExamCodeStart = async (req: any, res: any) => {
  const code = String(req.params.code).toUpperCase();
  const hallTicket = String(req.query.hallTicket || req.body?.hallTicket || 'GUEST').toUpperCase();

  try {
    const { data: exam } = await supabase
      .from('exam_codes')
      .select('*')
      .eq('exam_code', code)
      .maybeSingle();

    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found or unavailable', code: 'EXAM_NOT_FOUND' });
    }

    // Enforce student targeting (returns 404 so untargeted students cannot tell exam exists)
    const isEligible = await validateStudentEligibility(exam, hallTicket);
    if (!isEligible) {
      return res.status(404).json({ success: false, error: 'Exam not found or unavailable for your section', code: 'EXAM_NOT_FOUND' });
    }

    // Enforce student email verification (Item 9)
    const { data: studentRecord } = await supabase
      .from('students')
      .select('id, email, is_verified')
      .or(`hall_ticket.eq.${hallTicket},roll_number.eq.${hallTicket}`)
      .maybeSingle();

    if (studentRecord && studentRecord.is_verified === false) {
      return res.status(403).json({
        success: false,
        error: 'Your email address is not verified. Please verify your email before starting this examination.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Enforce inspector start (Item 3)
    const isDemoExam = code.includes('DEMO') || code === 'CS2026';
    if (!isDemoExam && !exam.started_at) {
      const { getExamStartedState } = await import('../services/socketService');
      const startedState = getExamStartedState(code);
      if (!startedState) {
        return res.status(403).json({
          success: false,
          error: 'The inspector has not started this examination yet. Please wait in the waiting lobby.',
          code: 'EXAM_NOT_STARTED_BY_INSPECTOR',
        });
      }
    }

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
};
router.get('/exam-code/:code/start', enterExamRateLimit, handleExamCodeStart);
router.post('/exam-code/:code/start', enterExamRateLimit, handleExamCodeStart);

// Get questions for a quiz session
router.get('/exam-code/:code/questions', getExamCodeQuestions);

// Per-question autosave (1b)
router.post('/exam-code/:code/save-answer', answerRateLimit, validateBody(saveExamCodeAnswerSchema), saveExamCodeAnswer);
router.post('/exam-code/:code/answer', answerRateLimit, saveExamCodeAnswer);

// Resume state after refresh/crash (1b)
router.get('/exam-code/:code/resume-state', getExamCodeResumeState);
router.get('/exam-code/:code/resume', getExamCodeResumeState);

// Submit answers
router.post('/exam-code/:code/submit', submitExamCodeAttempt);

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
router.post('/admin/colleges', adminAuth, requireRole('super_admin'), auditLog('CREATE_COLLEGE', 'colleges'), createCollege);
router.patch('/admin/colleges/:id', adminAuth, requireRole('super_admin'), auditLog('UPDATE_COLLEGE', 'colleges'), updateCollege);
router.delete('/admin/colleges/:id', adminAuth, requireRole('super_admin'), auditLog('DELETE_COLLEGE', 'colleges'), deleteCollege);
router.post('/admin/colleges/import', adminAuth, requireRole('super_admin'), upload.single('file'), bulkImportCollegesHandler);

// Exam codes management (super_admin only)
router.get('/admin/exam-codes', adminAuth, listExamCodes);
router.post('/admin/exam-codes', adminAuth, requireRole('super_admin'), auditLog('CREATE_EXAM_CODE', 'exam_codes'), createExamCode);
router.patch('/admin/exam-codes/:id/toggle', adminAuth, requireRole('super_admin'), auditLog('TOGGLE_EXAM_CODE', 'exam_codes'), toggleExamCode);
router.get('/admin/exam-codes/:id/qr', adminAuth, getExamCodeQR);
router.get('/admin/exam-codes/:id/report', adminAuth, getExamCodeReport);
router.post('/admin/exam-codes/:id/allocate', adminAuth, requireRole('super_admin'), auditLog('ALLOCATE_PAPER', 'exam_codes'), allocateQuestionPaper);
router.post('/admin/exam-codes/:id/lock-paper', adminAuth, requireRole('super_admin'), auditLog('LOCK_PAPER', 'exam_codes'), lockQuestionPaper);
router.post('/admin/exam-codes/:id/replace-paper', adminAuth, requireRole('super_admin'), auditLog('REPLACE_PAPER', 'exam_codes'), replaceQuestionPaper);

// Question import for exam codes (super_admin or faculty with create_questions permission; inspector forbidden)
router.post(
  '/admin/exam-codes/:id/import-questions',
  adminAuth,
  requireFacultyPermission('create_questions'),
  auditLog('IMPORT_QUESTIONS', 'exam_codes'),
  upload.single('file'),
  importQuestionsForExamCode
);
router.get('/admin/questions/sample-template', downloadSampleQuestionsTemplate);
router.get('/admin/exam-codes/sample-template', downloadSampleQuestionsTemplate);

router.post(
  '/admin/questions/validate-preview',
  adminAuth,
  requireFacultyPermission('create_questions'),
  upload.single('file'),
  validateAndPreviewQuestions
);
router.post(
  '/admin/questions/confirm-import',
  adminAuth,
  requireFacultyPermission('create_questions'),
  auditLog('CONFIRM_IMPORT_QUESTIONS', 'questions'),
  confirmImportQuestions
);
router.post(
  '/admin/exam-codes/:id/validate-preview',
  adminAuth,
  requireFacultyPermission('create_questions'),
  upload.single('file'),
  validateAndPreviewQuestions
);

// Phase 2: Violation timeline & false-positive review
router.get('/admin/attempts/:id/violations', adminAuth, getAttemptViolations);
router.patch('/admin/attempts/:id/violations/:violationId/review', adminAuth, requireRole('super_admin'), auditLog('REVIEW_VIOLATION', 'proctor_logs'), reviewAttemptViolation);

// Phase 3: Live Monitor, Analytics & Results Vault
router.post('/admin/attempts/:id/extend-time', adminAuth, requireRole('super_admin', 'inspector'), auditLog('EXTEND_ATTEMPT_TIME', 'exam_code_attempts'), extendAttemptTime);
router.post('/admin/attempts/:id/force-submit', adminAuth, requireRole('super_admin', 'inspector'), auditLog('FORCE_SUBMIT_ATTEMPT', 'exam_code_attempts'), forceSubmitAttempt);

// Allow Re-Entry: reopens a wrongly-terminated attempt (super_admin only)
// Also accessible from /api/admin/attempts/:id/allow-reentry (registered in admin.ts)
router.post('/admin/exam-codes/:id/reevaluate', adminAuth, requireRole('super_admin'), auditLog('REEVALUATE_EXAM_CODE', 'exam_codes'), reevaluateExamCode);
router.get('/admin/exam-codes/:id/analytics', adminAuth, getExamCodeAnalytics);


export default router;
