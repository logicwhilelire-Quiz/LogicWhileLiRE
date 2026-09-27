import { Router } from 'express';
import multer from 'multer';
import { adminAuth } from '../middleware/adminAuth';
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
  getExamCodeReport,
} from '../controllers/examCodeController';
import {
  verifyExamEntry,
  getExamCodeQuestions,
  submitExamCodeAttempt,
  logExamCodeViolation,
  getExamCodeLeaderboard,
} from '../controllers/examCodeController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── PUBLIC ROUTES (no auth) ───────────────────────────────────

// Public list of colleges for dropdown
router.get('/colleges', listColleges);

// Student exam entry verification (NO OTP)
router.post('/verify-exam-entry', verifyExamEntry);

// Adapters for EnterExamPage & QuizPage routes
router.get('/exam-code/:code/verify', (req, res) => {
  req.body = {
    examCode: req.params.code,
    hallTicket: req.query.hallTicket || req.body?.hallTicket,
  };
  return verifyExamEntry(req, res);
});
router.post('/exam-code/:code/verify', (req, res) => {
  req.body = {
    examCode: req.params.code,
    hallTicket: req.body?.hallTicket || req.query.hallTicket,
  };
  return verifyExamEntry(req, res);
});
router.post('/exam-code/:code/validate', (req, res) => {
  req.body = {
    examCode: req.params.code,
    hallTicket: req.body?.hallTicket || req.query.hallTicket,
  };
  return verifyExamEntry(req, res);
});

// Start session endpoint: returns exam + questions
router.get('/exam-code/:code/start', async (req, res) => {
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

    const formattedQuestions = (questions || []).map((q: any) => ({
      id: q.id,
      question_text: q.question || q.question_text || 'Question',
      options: [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean),
      question_type: q.question_type || 'mcq',
      marks: q.marks || 1,
      difficulty: q.difficulty || 'Medium',
      topic: q.topic || 'General',
    }));

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

// Submit answers
router.post('/exam-code/:code/submit', submitExamCodeAttempt);

// Log violation
router.post('/exam-code/:code/violation', logExamCodeViolation);
router.post('/proctor/violation', logExamCodeViolation);
router.post('/proctor/log', logExamCodeViolation);

// Public leaderboard per exam code
router.get('/exam-code/:code/leaderboard', getExamCodeLeaderboard);

// ─── ADMIN ROUTES (require adminAuth) ─────────────────────────

// Colleges management
router.get('/admin/colleges', adminAuth, listColleges);
router.post('/admin/colleges', adminAuth, createCollege);
router.patch('/admin/colleges/:id', adminAuth, updateCollege);
router.delete('/admin/colleges/:id', adminAuth, deleteCollege);

// Exam codes management
router.get('/admin/exam-codes', adminAuth, listExamCodes);
router.post('/admin/exam-codes', adminAuth, createExamCode);
router.patch('/admin/exam-codes/:id/toggle', adminAuth, toggleExamCode);
router.get('/admin/exam-codes/:id/qr', adminAuth, getExamCodeQR);
router.get('/admin/exam-codes/:id/report', adminAuth, getExamCodeReport);

// Question import for exam codes
router.post(
  '/admin/exam-codes/:id/import-questions',
  adminAuth,
  upload.single('file'),
  importQuestionsForExamCode
);

export default router;
