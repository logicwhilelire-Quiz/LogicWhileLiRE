import { Router } from 'express';
import { adminAuth, requireRole, requireExamOwnership } from '../middleware/adminAuth';
import { adminLoginRateLimit } from '../middleware/rateLimiter';
import { auditLog } from '../middleware/auditLog';
import {
  validateBody,
  validateParams,
  validateQuery,
  adminLoginSchema,
  createExamSchema,
  createStaffSchema,
  updateStaffStatusSchema,
  ExamIdParam,
  UUIDParam,
  SessionIdParam,
  HallTicketParam,
  HallTicketQuery,
} from '../middleware/validate';
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
  listStaff,
  createStaff,
  toggleStaffStatus,
  getBulkEnrollTemplate,
  bulkEnrollParticipantsHandler,
  listAuditLogs,
  toggleStudentBlock,
  overrideScore,
  updateExamSettings,
  getPlatformSettings,
  updatePlatformSettings,
} from '../controllers/adminController';
import { getLeaderboard } from '../controllers/adminController';

const router = Router();

// ——— Auth (public) ———
router.post('/login', adminLoginRateLimit, validateBody(adminLoginSchema), adminLogin);
router.post('/logout', adminLogout);

// ——— All routes below require staff authentication (super_admin or faculty) ———
router.use(adminAuth);

// ——— Staff Management (super_admin only) ———
router.get('/staff', requireRole('super_admin'), listStaff);
router.post(
  '/staff',
  requireRole('super_admin'),
  auditLog('CREATE_STAFF', 'staff'),
  validateBody(createStaffSchema),
  createStaff
);
router.patch(
  '/staff/:id/deactivate',
  requireRole('super_admin'),
  auditLog('DEACTIVATE_STAFF', 'staff'),
  validateParams(UUIDParam),
  validateBody(updateStaffStatusSchema),
  toggleStaffStatus
);

// ——— Exams ———
router.get('/exams', listExams);
router.post('/exams', auditLog('CREATE_EXAM', 'exams'), validateBody(createExamSchema), createExam);
router.patch(
  '/exams/:id/activate',
  requireExamOwnership('id'),
  auditLog('TOGGLE_EXAM_ACTIVE', 'exams'),
  validateParams(UUIDParam),
  activateExam
);
router.get('/exams/:examId/qr', requireExamOwnership('examId'), validateParams(ExamIdParam), getEnrollmentQR);

// ——— Questions ———
router.post(
  '/exams/:examId/import-questions',
  requireExamOwnership('examId'),
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

// ——— Bulk Enrollment ———
router.get('/bulk-enroll/template', getBulkEnrollTemplate);
router.post(
  '/exams/:examId/bulk-enroll',
  requireExamOwnership('examId'),
  auditLog('BULK_ENROLL', 'participants'),
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
  bulkEnrollParticipantsHandler
);

// ——— Sessions ———
router.get('/exams/:examId/sessions', requireExamOwnership('examId'), validateParams(ExamIdParam), listSessions);
router.post(
  '/sessions/:sessionId/terminate',
  requireExamOwnership('sessionId'),
  auditLog('TERMINATE_SESSION', 'exam_sessions'),
  validateParams(SessionIdParam),
  terminateSession
);

// ——— Reports ———
router.get('/exams/:examId/report/excel', requireExamOwnership('examId'), validateParams(ExamIdParam), exportExcelReport);
router.get('/exams/:examId/report/pdf', requireExamOwnership('examId'), validateParams(ExamIdParam), exportPdfReport);

// ——— Analytics ———
router.get('/exams/:examId/analytics/questions', requireExamOwnership('examId'), validateParams(ExamIdParam), getQuestionAnalytics);
router.get('/exams/:examId/analytics/topics', requireExamOwnership('examId'), validateParams(ExamIdParam), getTopicAnalytics);
router.get('/participant-history/:hallTicket', validateParams(HallTicketParam), getParticipantHistoryHandler);
router.get('/participants/history', validateQuery(HallTicketQuery), getParticipantHistoryHandler);

// ——— Suspicious Activity & Fingerprint Proctoring ———
router.get('/exams/:examId/suspicious-activity', requireExamOwnership('examId'), validateParams(ExamIdParam), listSuspiciousActivity);
router.patch(
  '/suspicious-activity/:id/resolve',
  auditLog('RESOLVE_SUSPICIOUS_ACTIVITY', 'suspicious_activity'),
  validateParams(UUIDParam),
  resolveSuspiciousActivity
);

// ——— Student & Candidate Master Controls ———
router.patch('/students/:id/block', requireRole('super_admin'), auditLog('BLOCK_STUDENT', 'students'), toggleStudentBlock);

// ——— Score Override & Grace Marks ———
router.post('/results/:sessionId/override', requireRole('super_admin'), auditLog('OVERRIDE_SCORE', 'results'), overrideScore);

// ——— Exam Security & Feature Toggles ———
router.patch('/exams/:id/settings', requireExamOwnership('id'), auditLog('UPDATE_EXAM_SETTINGS', 'exams'), updateExamSettings);

// ——— Platform & Engine Settings ———
router.get('/settings', getPlatformSettings);
router.post('/settings', requireRole('super_admin'), auditLog('UPDATE_PLATFORM_SETTINGS', 'platform_settings'), updatePlatformSettings);

// ——— Audit Logs (Phase 3 Results Vault) ———
router.get('/audit-logs', requireRole('super_admin'), listAuditLogs);

export default router;

// ——— Public leaderboard (separate export, mounted outside /admin) ———
export { getLeaderboard };
