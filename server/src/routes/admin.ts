import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth';
import { adminLoginRateLimit } from '../middleware/rateLimiter';
import { auditLog } from '../middleware/auditLog';
import { validateBody, validateParams, validateQuery, adminLoginSchema, createExamSchema, ExamIdParam, UUIDParam, SessionIdParam, HallTicketParam, HallTicketQuery } from '../middleware/validate';
import { z } from 'zod';
import {
  adminLogin,
  adminLogout,
  listExams,
  createExam,
  activateExam,
  getEnrollmentQR,
  importQuestions,
  uploadMiddleware,
  exportExcelReport,
  exportPdfReport,
  listSessions,
  terminateSession,
  getQuestionAnalytics,
  getTopicAnalytics,
  getParticipantHistoryHandler,
  listSuspiciousActivity,
  resolveSuspiciousActivity,
} from '../controllers/adminController';
import { getLeaderboard } from '../controllers/adminController';

const router = Router();

// ——— Auth (no adminAuth guard here) ———
router.post('/login', adminLoginRateLimit, validateBody(adminLoginSchema), adminLogin);
router.post('/logout', adminLogout);

// ——— All routes below require admin JWT ———
router.use(adminAuth);

// ——— Exams ———
router.get('/exams', listExams);
router.post('/exams', auditLog('CREATE_EXAM', 'exams'), validateBody(createExamSchema), createExam);
router.patch(
  '/exams/:id/activate',
  auditLog('TOGGLE_EXAM_ACTIVE', 'exams'),
  validateParams(UUIDParam),
  activateExam
);
router.get('/exams/:examId/qr', validateParams(ExamIdParam), getEnrollmentQR);

// ——— Questions ———
router.post(
  '/exams/:examId/import-questions',
  auditLog('IMPORT_QUESTIONS', 'questions'),
  validateParams(ExamIdParam),
  (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      next();
    });
  },
  importQuestions
);

// ——— Sessions ———
router.get('/exams/:examId/sessions', validateParams(ExamIdParam), listSessions);
router.post(
  '/sessions/:sessionId/terminate',
  auditLog('TERMINATE_SESSION', 'exam_sessions'),
  validateParams(SessionIdParam),
  terminateSession
);

// ——— Reports ———
router.get('/exams/:examId/report/excel', validateParams(ExamIdParam), exportExcelReport);
router.get('/exams/:examId/report/pdf', validateParams(ExamIdParam), exportPdfReport);

// ——— Analytics ———
router.get('/exams/:examId/analytics/questions', validateParams(ExamIdParam), getQuestionAnalytics);
router.get('/exams/:examId/analytics/topics', validateParams(ExamIdParam), getTopicAnalytics);
router.get('/participant-history/:hallTicket', validateParams(HallTicketParam), getParticipantHistoryHandler);
router.get('/participants/history', validateQuery(HallTicketQuery), getParticipantHistoryHandler);

// ——— Suspicious Activity & Fingerprint Proctoring ———
router.get('/exams/:examId/suspicious-activity', validateParams(ExamIdParam), listSuspiciousActivity);
router.patch(
  '/suspicious-activity/:id/resolve',
  auditLog('RESOLVE_SUSPICIOUS_ACTIVITY', 'suspicious_activity'),
  validateParams(UUIDParam),
  resolveSuspiciousActivity
);

export default router;

// ——— Public leaderboard (separate export, mounted outside /admin) ———
export { getLeaderboard };
