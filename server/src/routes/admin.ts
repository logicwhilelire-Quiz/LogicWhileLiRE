import { Router } from 'express';
import {
  adminAuth,
  requireRole,
  requireExamOwnership,
  requireFacultyPermission,
} from '../middleware/adminAuth';
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
  requestLoginOtp,
  verifyLoginOtp,
  adminLogout,
  listExams,
  createExam,
  activateExam,
  deleteExam,
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
  updateStaff,
  deleteStaff,
  toggleStaffStatus,
  updateStaffPermissions,
  getBulkEnrollTemplate,
  bulkEnrollParticipantsHandler,
  listAuditLogs,
  toggleStudentBlock,
  overrideScore,
  updateExamSettings,
  getPlatformSettings,
  updatePlatformSettings,
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  listCurriculum,
  createCurriculum,
  updateCurriculum,
  deleteCurriculum,
  getAdminDashboardWidgets,
} from '../controllers/adminController';
import { getLeaderboard } from '../controllers/adminController';
import {
  listAcademicYears,
  createAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
  listCohorts,
  createCohort,
  updateCohort,
  deleteCohort,
  listSections,
  createSection,
  updateSection,
  deleteSection,
  listBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  getHierarchyOverview,
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkImportStudents,
  previewHierarchyImport,
  exportBatchStudents,
  resetStudentPassword,
  resetStaffPassword,
  changePassword,
  setup2fa,
  verifyAndEnable2fa,
  disable2fa,
  runSystemBackup,
  downloadSystemBackup,
  getBackupHistory,
  getGoogleDriveStatusHandler,
  inspectorStartExam,
  inspectorEndExam,
  getInspectorDashboardData,
} from '../controllers/hierarchyController';
import {
  listColleges,
  createCollege,
  updateCollege,
  deleteCollege,
} from '../controllers/examCodeController';

const router = Router();

// ——— Auth (public) ———
router.post('/login', adminLoginRateLimit, validateBody(adminLoginSchema), adminLogin);
router.post('/request-login-otp', adminLoginRateLimit, requestLoginOtp);
router.post('/verify-login-otp', adminLoginRateLimit, verifyLoginOtp);
router.post('/logout', adminLogout);

// ——— 2FA enrollment (pre-auth — accessible via enrollment_token issued at login) ———
router.post('/2fa/enroll-init', setup2fa);
router.post('/2fa/enroll-confirm', verifyAndEnable2fa);

// ——— All routes below require staff authentication (super_admin, faculty, or inspector) ———
router.use(adminAuth);

// ——— Staff Management (super_admin has full CRUD & permission matrix control) ———
router.get('/staff', requireRole('super_admin'), listStaff);
router.post(
  '/staff',
  requireRole('super_admin'),
  auditLog('CREATE_STAFF', 'staff'),
  validateBody(createStaffSchema),
  createStaff
);
router.patch(
  '/staff/:id/permissions',
  requireRole('super_admin'),
  auditLog('UPDATE_STAFF_PERMISSIONS', 'staff'),
  updateStaffPermissions
);
router.patch('/staff/:id', requireRole('super_admin'), auditLog('UPDATE_STAFF', 'staff'), updateStaff);
router.delete('/staff/:id', requireRole('super_admin'), auditLog('DELETE_STAFF', 'staff'), deleteStaff);
router.patch(
  '/staff/:id/deactivate',
  requireRole('super_admin'),
  auditLog('DEACTIVATE_STAFF', 'staff'),
  validateParams(UUIDParam),
  validateBody(updateStaffStatusSchema),
  toggleStaffStatus
);

// ——— Colleges Management (super_admin full CRUD; student reg toggle) ———
router.get('/colleges', listColleges);
router.post('/colleges', requireRole('super_admin'), auditLog('CREATE_COLLEGE', 'colleges'), createCollege);
router.patch('/colleges/:id', requireRole('super_admin'), auditLog('UPDATE_COLLEGE', 'colleges'), updateCollege);
router.put('/colleges/:id', requireRole('super_admin'), auditLog('UPDATE_COLLEGE', 'colleges'), updateCollege);
router.delete('/colleges/:id', requireRole('super_admin'), auditLog('DELETE_COLLEGE', 'colleges'), deleteCollege);

// ——— Exams ———
router.get('/exams', listExams);
router.post(
  '/exams',
  requireFacultyPermission('manage_exams'),
  auditLog('CREATE_EXAM', 'exams'),
  validateBody(createExamSchema),
  createExam
);
router.patch(
  '/exams/:id/activate',
  requireFacultyPermission('manage_exams'),
  requireExamOwnership('id'),
  auditLog('TOGGLE_EXAM_ACTIVE', 'exams'),
  validateParams(UUIDParam),
  activateExam
);
router.delete('/exams/:id', requireRole('super_admin'), auditLog('DELETE_EXAM', 'exams'), deleteExam);
router.get('/exams/:examId/qr', requireExamOwnership('examId'), validateParams(ExamIdParam), getEnrollmentQR);
router.patch('/exams/:id/settings', requireFacultyPermission('manage_exams'), requireExamOwnership('id'), auditLog('UPDATE_EXAM_SETTINGS', 'exams'), updateExamSettings);

// ——— Questions & Question Papers CRUD ———
router.get('/questions', listQuestions);
router.post('/questions', requireFacultyPermission('create_questions'), auditLog('CREATE_QUESTION', 'questions'), createQuestion);
router.patch('/questions/:id', requireFacultyPermission('create_questions'), auditLog('UPDATE_QUESTION', 'questions'), updateQuestion);
router.put('/questions/:id', requireFacultyPermission('create_questions'), auditLog('UPDATE_QUESTION', 'questions'), updateQuestion);
router.delete('/questions/:id', requireFacultyPermission('create_questions'), auditLog('DELETE_QUESTION', 'questions'), deleteQuestion);
router.post(
  '/exams/:examId/import-questions',
  requireFacultyPermission('create_questions'),
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

// ——— Curriculum / Sectors / Categories CRUD ———
router.get('/curriculum', listCurriculum);
router.post('/curriculum', requireRole('super_admin'), auditLog('CREATE_CURRICULUM', 'curriculum'), createCurriculum);
router.patch('/curriculum/:id', requireRole('super_admin'), auditLog('UPDATE_CURRICULUM', 'curriculum'), updateCurriculum);
router.put('/curriculum/:id', requireRole('super_admin'), auditLog('UPDATE_CURRICULUM', 'curriculum'), updateCurriculum);
router.delete('/curriculum/:id', requireRole('super_admin'), auditLog('DELETE_CURRICULUM', 'curriculum'), deleteCurriculum);

// ——— Bulk Enrollment ———
router.get('/bulk-enroll/template', getBulkEnrollTemplate);
router.post(
  '/exams/:examId/bulk-enroll',
  requireFacultyPermission('upload_excel'),
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
router.get('/exams/:examId/sessions', requireFacultyPermission('view_results'), requireExamOwnership('examId'), validateParams(ExamIdParam), listSessions);
router.post(
  '/sessions/:sessionId/terminate',
  requireExamOwnership('sessionId'),
  auditLog('TERMINATE_SESSION', 'exam_sessions'),
  validateParams(SessionIdParam),
  terminateSession
);

// ——— Reports ———
router.get('/exams/:examId/report/excel', requireFacultyPermission('export_data'), requireExamOwnership('examId'), validateParams(ExamIdParam), exportExcelReport);
router.get('/exams/:examId/report/pdf', requireFacultyPermission('export_data'), requireExamOwnership('examId'), validateParams(ExamIdParam), exportPdfReport);

// ——— Analytics ———
router.get('/exams/:examId/analytics/questions', requireFacultyPermission('view_results'), requireExamOwnership('examId'), validateParams(ExamIdParam), getQuestionAnalytics);
router.get('/exams/:examId/analytics/topics', requireFacultyPermission('view_results'), requireExamOwnership('examId'), validateParams(ExamIdParam), getTopicAnalytics);
router.get('/participant-history/:hallTicket', requireFacultyPermission('view_results'), validateParams(HallTicketParam), getParticipantHistoryHandler);
router.get('/participants/history', requireFacultyPermission('view_results'), validateQuery(HallTicketQuery), getParticipantHistoryHandler);

// ——— Suspicious Activity & Fingerprint Proctoring ———
router.get('/exams/:examId/suspicious-activity', requireFacultyPermission('view_results'), requireExamOwnership('examId'), validateParams(ExamIdParam), listSuspiciousActivity);
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

// ——— Staff Password Reset (super_admin only) ———
router.post('/staff/:id/reset-password', requireRole('super_admin'), auditLog('RESET_STAFF_PASSWORD', 'staff'), resetStaffPassword);

// ——— Force Password Change (for authenticated staff) ———
router.post('/change-password', auditLog('CHANGE_STAFF_PASSWORD', 'staff'), changePassword);

// ——— 2FA (TOTP) Management (Admin & Inspector) ———
router.post('/2fa/setup', setup2fa);
router.post('/2fa/verify', auditLog('ENABLE_2FA', 'staff'), verifyAndEnable2fa);
router.post('/2fa/disable', auditLog('DISABLE_2FA', 'staff'), disable2fa);

// ——— Academic Structure (super_admin full CRUD) ———
// Academic Years
router.get('/academic-years', requireRole('super_admin', 'inspector', 'faculty'), listAcademicYears);
router.post('/academic-years', requireRole('super_admin'), auditLog('CREATE_ACADEMIC_YEAR', 'academic_years'), createAcademicYear);
router.patch('/academic-years/:id', requireRole('super_admin'), auditLog('UPDATE_ACADEMIC_YEAR', 'academic_years'), updateAcademicYear);
router.put('/academic-years/:id', requireRole('super_admin'), auditLog('UPDATE_ACADEMIC_YEAR', 'academic_years'), updateAcademicYear);
router.delete('/academic-years/:id', requireRole('super_admin'), auditLog('DELETE_ACADEMIC_YEAR', 'academic_years'), deleteAcademicYear);

// Cohorts (YOP Cohorts)
router.get('/cohorts', requireRole('super_admin', 'inspector', 'faculty'), listCohorts);
router.post('/cohorts', requireRole('super_admin'), auditLog('CREATE_COHORT', 'cohorts'), createCohort);
router.patch('/cohorts/:id', requireRole('super_admin'), auditLog('UPDATE_COHORT', 'cohorts'), updateCohort);
router.put('/cohorts/:id', requireRole('super_admin'), auditLog('UPDATE_COHORT', 'cohorts'), updateCohort);
router.delete('/cohorts/:id', requireRole('super_admin'), auditLog('DELETE_COHORT', 'cohorts'), deleteCohort);

// Sections
router.get('/sections', requireRole('super_admin', 'inspector', 'faculty'), listSections);
router.post('/sections', requireRole('super_admin'), auditLog('CREATE_SECTION', 'sections'), createSection);
router.patch('/sections/:id', requireRole('super_admin'), auditLog('UPDATE_SECTION', 'sections'), updateSection);
router.put('/sections/:id', requireRole('super_admin'), auditLog('UPDATE_SECTION', 'sections'), updateSection);
router.delete('/sections/:id', requireRole('super_admin'), auditLog('DELETE_SECTION', 'sections'), deleteSection);

// Batches
router.get('/batches', requireRole('super_admin', 'inspector', 'faculty'), listBatches);
router.post('/batches', requireRole('super_admin'), auditLog('CREATE_BATCH', 'batches'), createBatch);
router.patch('/batches/:id', requireRole('super_admin'), auditLog('UPDATE_BATCH', 'batches'), updateBatch);
router.put('/batches/:id', requireRole('super_admin'), auditLog('UPDATE_BATCH', 'batches'), updateBatch);
router.delete('/batches/:id', requireRole('super_admin'), auditLog('DELETE_BATCH', 'batches'), deleteBatch);

// Full Hierarchy Tree
router.get('/hierarchy', requireRole('super_admin', 'inspector', 'faculty'), getHierarchyOverview);
router.get('/hierarchy/overview', requireRole('super_admin', 'inspector', 'faculty'), getHierarchyOverview);

// ——— Student Management (super_admin full CRUD; faculty scoped by permissions) ———
router.get('/students', requireRole('super_admin', 'inspector', 'faculty'), listStudents);
router.post('/students', requireFacultyPermission('manage_students'), auditLog('CREATE_STUDENT', 'students'), createStudent);
router.patch('/students/:id', requireFacultyPermission('manage_students'), auditLog('UPDATE_STUDENT', 'students'), updateStudent);
router.put('/students/:id', requireFacultyPermission('manage_students'), auditLog('UPDATE_STUDENT', 'students'), updateStudent);
router.delete('/students/:id', requireRole('super_admin'), auditLog('DELETE_STUDENT', 'students'), deleteStudent);
router.post(
  '/students/import-preview',
  (req, res, next) => {
    if (req.headers['content-type']?.includes('multipart')) {
      uploadMiddleware(req, res, (err) => {
        if (err) {
          res.status(400).json({ success: false, error: err.message });
          return;
        }
        next();
      });
    } else {
      next();
    }
  },
  previewHierarchyImport
);
router.post(
  '/hierarchy/import-preview',
  (req, res, next) => {
    if (req.headers['content-type']?.includes('multipart')) {
      uploadMiddleware(req, res, (err) => {
        if (err) {
          res.status(400).json({ success: false, error: err.message });
          return;
        }
        next();
      });
    } else {
      next();
    }
  },
  previewHierarchyImport
);
router.post(
  '/students/bulk-import',
  requireFacultyPermission('upload_excel'),
  auditLog('BULK_IMPORT_STUDENTS', 'students'),
  (req, res, next) => {
    if (req.headers['content-type']?.includes('multipart')) {
      uploadMiddleware(req, res, (err) => {
        if (err) {
          res.status(400).json({ success: false, error: err.message });
          return;
        }
        next();
      });
    } else {
      next();
    }
  },
  bulkImportStudents
);
router.post(
  '/hierarchy/bulk-import',
  requireFacultyPermission('upload_excel'),
  auditLog('BULK_IMPORT_STUDENTS', 'students'),
  (req, res, next) => {
    if (req.headers['content-type']?.includes('multipart')) {
      uploadMiddleware(req, res, (err) => {
        if (err) {
          res.status(400).json({ success: false, error: err.message });
          return;
        }
        next();
      });
    } else {
      next();
    }
  },
  bulkImportStudents
);
router.get('/students/export', requireFacultyPermission('export_data'), exportBatchStudents);
router.post('/students/:id/reset-password', requireFacultyPermission('manage_students'), auditLog('RESET_STUDENT_PASSWORD', 'students'), resetStudentPassword);

// ——— System Backups & Google Drive Cloud Sync (super_admin only) ———
router.get('/backup', requireRole('super_admin'), auditLog('RUN_SYSTEM_BACKUP', 'system'), runSystemBackup);
router.post('/backup', requireRole('super_admin'), auditLog('RUN_SYSTEM_BACKUP', 'system'), runSystemBackup);
router.get('/backup/download', requireRole('super_admin'), auditLog('DOWNLOAD_SYSTEM_BACKUP', 'system'), downloadSystemBackup);
router.get('/backup/history', requireRole('super_admin'), getBackupHistory);
router.get('/backup/drive-status', requireRole('super_admin'), getGoogleDriveStatusHandler);

// ——— Inspector Exam Controls & Dashboard (inspector only lands on live leaderboard & waiting queue; starts/ends exams) ———
router.get('/inspector/dashboard-data', requireRole('super_admin', 'inspector', 'college_admin'), getInspectorDashboardData);
router.post('/exams/:id/start', requireRole('super_admin', 'inspector'), auditLog('START_EXAM', 'exams'), inspectorStartExam);
router.post('/exams/:id/end', requireRole('super_admin', 'inspector'), auditLog('END_EXAM', 'exams'), inspectorEndExam);

// ——— Platform & Engine Settings (super_admin only; Inspector completely blocked) ———
router.get('/settings', requireRole('super_admin'), getPlatformSettings);
router.post('/settings', requireRole('super_admin'), auditLog('UPDATE_PLATFORM_SETTINGS', 'platform_settings'), updatePlatformSettings);

// ——— Audit Logs & Monitoring (super_admin only) ———
router.get('/audit-logs', requireRole('super_admin'), listAuditLogs);
router.get('/activity', requireRole('super_admin'), listAuditLogs);
router.get('/dashboard-widgets', requireRole('super_admin'), getAdminDashboardWidgets);

export default router;

// ——— Public leaderboard (separate export, mounted outside /admin) ———
export { getLeaderboard };
