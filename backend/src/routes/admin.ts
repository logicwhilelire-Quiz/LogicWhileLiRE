import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase';
import {
  adminAuth,
  requireRole,
  requireExamOwnership,
  requireFacultyPermission,
  getAdminJwtSecret,
  StaffRole,
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
  listMailLogsController,
  resendMailLogController,
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
  bulkVerifyStudents,
  allowExamReentry,
} from '../controllers/hierarchyController';
import {
  listColleges,
  getCollegesBreakdown,
  createCollege,
  updateCollege,
  deleteCollege,
} from '../controllers/examCodeController';
import { systemAlertAgent } from '../services/systemAlertService';

const router = Router();

// ——— Auth (public) ———
router.post('/login', adminLoginRateLimit, validateBody(adminLoginSchema), adminLogin);
router.post('/request-login-otp', adminLoginRateLimit, requestLoginOtp);
router.post('/verify-login-otp', adminLoginRateLimit, verifyLoginOtp);
router.post('/logout', adminLogout);
router.post('/demo-login', (req, res) => {
  if (process.env.DEMO_MODE !== 'true') {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Demo login bypass is disabled when DEMO_MODE is false',
      code: 'DEMO_BYPASS_REJECTED',
    });
    return;
  }
  const role = (req.body?.role || 'super_admin') as StaffRole;
  const staff = {
    id: role === 'inspector' ? 'st000000-0000-0000-0000-000000000004' : role === 'faculty' ? 'st000000-0000-0000-0000-000000000003' : 'st000000-0000-0000-0000-000000000001',
    name: role === 'inspector' ? 'LogicWhile Lead Inspector' : role === 'faculty' ? 'LogicWhile Lead Faculty' : 'LogicWhile Super Admin',
    email: role === 'inspector' ? 'inspector@logicwhilelire.com' : role === 'faculty' ? 'faculty@logicwhilelire.com' : 'admin@logicwhilelire.com',
    role,
    college_id: role === 'super_admin' ? null : 1,
  };
  const token = jwt.sign(
    {
      sub: staff.email,
      role: staff.role,
      staff_id: staff.id,
      name: staff.name,
      college_id: staff.college_id,
      must_change_password: false,
    },
    getAdminJwtSecret(),
    { expiresIn: '8h' }
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
    token,
    user: staff,
  });
});

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
router.get('/colleges/breakdown', getCollegesBreakdown);
router.get('/colleges', listColleges);
router.post('/colleges', requireRole('super_admin'), auditLog('CREATE_COLLEGE', 'colleges'), createCollege);
router.patch('/colleges/:id', requireRole('super_admin'), auditLog('UPDATE_COLLEGE', 'colleges'), updateCollege);
router.put('/colleges/:id', requireRole('super_admin'), auditLog('UPDATE_COLLEGE', 'colleges'), updateCollege);
router.delete('/colleges/:id', requireRole('super_admin'), auditLog('DELETE_COLLEGE', 'colleges'), deleteCollege);

// ——— Exams (super_admin only creates & modifies) ———
router.get('/exams', listExams);
router.post(
  '/exams',
  requireRole('super_admin'),
  auditLog('CREATE_EXAM', 'exams'),
  validateBody(createExamSchema),
  createExam
);
router.patch(
  '/exams/:id/activate',
  requireRole('super_admin'),
  auditLog('TOGGLE_EXAM_ACTIVE', 'exams'),
  validateParams(UUIDParam),
  activateExam
);
router.delete('/exams/:id', requireRole('super_admin'), auditLog('DELETE_EXAM', 'exams'), deleteExam);
router.get('/exams/:examId/qr', validateParams(ExamIdParam), getEnrollmentQR);
router.patch('/exams/:id/settings', requireRole('super_admin'), auditLog('UPDATE_EXAM_SETTINGS', 'exams'), updateExamSettings);

// ——— Questions & Question Papers CRUD (super_admin only) ———
router.get('/questions', listQuestions);
router.post('/questions', requireFacultyPermission('create_questions'), auditLog('CREATE_QUESTION', 'questions'), createQuestion);
router.patch('/questions/:id', requireRole('super_admin'), auditLog('UPDATE_QUESTION', 'questions'), updateQuestion);
router.put('/questions/:id', requireRole('super_admin'), auditLog('UPDATE_QUESTION', 'questions'), updateQuestion);
router.delete('/questions/:id', requireRole('super_admin'), auditLog('DELETE_QUESTION', 'questions'), deleteQuestion);
router.post(
  '/exams/:examId/import-questions',
  requireRole('super_admin'),
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

// ——— Bulk Enrollment (super_admin only) ———
router.get('/bulk-enroll/template', getBulkEnrollTemplate);
router.post(
  '/exams/:examId/bulk-enroll',
  requireRole('super_admin'),
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

// ——— Student Management (super_admin full CRUD; faculty read-only roster) ———
router.get('/students', requireRole('super_admin', 'inspector', 'faculty'), listStudents);
router.post('/students', requireRole('super_admin'), auditLog('CREATE_STUDENT', 'students'), createStudent);
router.patch('/students/:id', requireRole('super_admin'), auditLog('UPDATE_STUDENT', 'students'), updateStudent);
router.put('/students/:id', requireRole('super_admin'), auditLog('UPDATE_STUDENT', 'students'), updateStudent);
router.delete('/students/:id', requireRole('super_admin'), auditLog('DELETE_STUDENT', 'students'), deleteStudent);
router.post(
  '/students/import-preview',
  requireRole('super_admin'),
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
  requireRole('super_admin'),
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
  requireRole('super_admin'),
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
  requireRole('super_admin'),
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
router.get('/students/export', requireRole('super_admin', 'faculty'), exportBatchStudents);
router.post('/students/:id/reset-password', requireRole('super_admin'), auditLog('RESET_STUDENT_PASSWORD', 'students'), resetStudentPassword);

// ——— Bulk Email Verification (super_admin only) ———
router.post('/students/bulk-verify', requireRole('super_admin'), auditLog('BULK_VERIFY_STUDENTS', 'students'), bulkVerifyStudents);

// ——— Admin Allow Exam Re-Entry (super_admin only) ———
router.post('/attempts/:id/allow-reentry', requireRole('super_admin'), auditLog('ALLOW_EXAM_REENTRY', 'exam_code_attempts'), allowExamReentry);

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
router.get('/system-alerts', requireRole('super_admin'), (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
  const alerts = systemAlertAgent.getRecentAlerts(limit);
  res.json({
    success: true,
    alerts,
    count: alerts.length,
  });
});

// ——— Outbound Email Logs & Resend (super_admin, admin) ———
router.get('/mail-logs', requireRole('super_admin', 'admin'), listMailLogsController);
router.post('/mail-logs/:id/resend', requireRole('super_admin', 'admin'), auditLog('RESEND_EMAIL', 'mail_logs'), resendMailLogController);

router.get('/results', requireRole('super_admin', 'admin', 'inspector', 'faculty'), async (req, res) => {
  try {
    const rawExamCode = ((req.query.examCode as string) || '').trim().toUpperCase();

    // 1. Fetch available exams for selector
    const { data: examList } = await supabase
      .from('exam_codes')
      .select('id, exam_code, exam_name, duration_minutes, total_questions, total_marks, is_active, results_published, created_at')
      .order('created_at', { ascending: false });

    const exams = examList || [];

    // Determine target exam code
    let targetCode = rawExamCode;
    let selectedExamData = exams.find((e) => e.exam_code === targetCode);

    if (!targetCode && exams.length > 0) {
      // Prefer exam with attempts or default to first
      targetCode = exams[0].exam_code;
      selectedExamData = exams[0];
    }

    const searchCodes: string[] = [];
    if (targetCode && targetCode !== 'ALL') {
      searchCodes.push(targetCode);
      const alt = [
        targetCode.replace(/5/g, 'S'),
        targetCode.replace(/S/g, '5'),
        targetCode.replace(/0/g, 'O'),
        targetCode.replace(/O/g, '0'),
      ].filter((c) => c !== targetCode);
      searchCodes.push(...alt);
    }

    // 2. Fetch attempts
    let query = supabase
      .from('exam_code_attempts')
      .select('*')
      .order('created_at', { ascending: false });

    if (searchCodes.length > 0) {
      query = query.in('exam_code', searchCodes);
    }

    const { data: attempts } = await query.limit(200);
    const rows = attempts || [];

    // 3. Enrich student names from students table if missing
    const hallTickets = Array.from(new Set(rows.map((r) => r.hall_ticket_no || r.hall_ticket).filter(Boolean)));
    const studentMap: Record<string, string> = {};

    if (hallTickets.length > 0) {
      try {
        const { data: students } = await supabase
          .from('students')
          .select('name, roll_number, hall_ticket')
          .or(hallTickets.map((ht) => `hall_ticket.eq.${ht},roll_number.eq.${ht}`).join(','));

        if (students) {
          for (const st of students) {
            if (st.name) {
              if (st.hall_ticket) studentMap[String(st.hall_ticket).toUpperCase()] = st.name;
              if (st.roll_number) studentMap[String(st.roll_number).toUpperCase()] = st.name;
            }
          }
        }
      } catch (stuErr) {
        console.warn('[AdminResults] Student enrichment notice:', stuErr);
      }
    }

    const maxExamScore = selectedExamData?.total_marks || (rows[0]?.max_score > 0 ? rows[0]?.max_score : 10);

    const formattedResults = rows.map((r: any) => {
      const ht = String(r.hall_ticket_no || r.hall_ticket || 'UNKNOWN').toUpperCase();
      const rawName = r.student_name && r.student_name !== ht ? r.student_name : (studentMap[ht] || ht);
      const rawScore = Number(r.score || 0);
      const graceMarks = Number(r.grace_marks || 0);
      const overrideScore = r.score_override !== null && r.score_override !== undefined ? Number(r.score_override) : undefined;
      const finalScore = (overrideScore ?? rawScore) + graceMarks;
      const mScore = Number(r.max_score || maxExamScore || 10);
      const isPassed = finalScore >= mScore * 0.4;

      return {
        id: r.id,
        attempt_id: r.id,
        exam_code: r.exam_code,
        hall_ticket: ht,
        name: rawName,
        raw_score: rawScore,
        grace_marks: graceMarks,
        score_override: overrideScore,
        override_reason: r.override_reason || null,
        final_score: finalScore,
        max_score: mScore,
        status: r.status === 'completed' || r.status === 'submitted'
          ? (isPassed ? 'passed' : 'failed')
          : r.status || 'in_progress',
        time_seconds: Number(r.time_taken_seconds || 0),
        violations: Number(r.violation_count || 0),
        created_at: r.created_at,
        end_time: r.end_time || r.submitted_at,
      };
    });

    // 4. Calculate Aggregate Stats
    const totalCount = formattedResults.length;
    const avgScore = totalCount > 0
      ? (formattedResults.reduce((acc, r) => acc + r.final_score, 0) / totalCount).toFixed(1)
      : '0.0';

    const passCount = formattedResults.filter((r) => r.status === 'passed').length;
    const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;
    const totalViolations = formattedResults.reduce((acc, r) => acc + r.violations, 0);

    res.json({
      success: true,
      selectedExam: targetCode,
      exams: exams.map((e) => ({
        exam_code: e.exam_code,
        exam_name: e.exam_name,
        total_questions: e.total_questions,
        total_marks: e.total_marks,
        results_published: Boolean(e.results_published),
      })),
      results: formattedResults,
      count: totalCount,
      stats: {
        average_score: Number(avgScore),
        max_score: maxExamScore,
        pass_rate: passRate,
        total_violations: totalViolations,
        results_published: Boolean(selectedExamData?.results_published),
        total_candidates: totalCount,
      },
    });
  } catch (err: any) {
    console.error('[AdminResults] Error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch results' });
  }
});

// Override candidate score or grant grace marks on exam_code_attempts
router.post('/results/:attemptId/override', requireRole('super_admin', 'admin', 'inspector'), async (req, res) => {
  const { attemptId } = req.params;
  const { score_override, grace_marks, reason } = req.body;

  try {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (score_override !== undefined && score_override !== null && !isNaN(Number(score_override))) {
      updatePayload.score_override = Number(score_override);
    }
    if (grace_marks !== undefined && grace_marks !== null && !isNaN(Number(grace_marks))) {
      updatePayload.grace_marks = Number(grace_marks);
    }
    if (reason) {
      updatePayload.override_reason = String(reason);
    }

    const { data: updated, error } = await supabase
      .from('exam_code_attempts')
      .update(updatePayload)
      .eq('id', attemptId)
      .select('*')
      .maybeSingle();

    if (error || !updated) {
      return overrideScore(req, res);
    }

    res.json({
      success: true,
      message: 'Score override and adjustments applied successfully.',
      result: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Toggle publish results for an exam code
router.post('/results/toggle-publish', requireRole('super_admin', 'admin'), async (req, res) => {
  const { examCode, publish } = req.body;
  if (!examCode) {
    res.status(400).json({ success: false, error: 'examCode is required' });
    return;
  }

  const code = String(examCode).trim().toUpperCase();
  const searchCodes = [
    code,
    code.replace(/5/g, 'S'),
    code.replace(/S/g, '5'),
    code.replace(/0/g, 'O'),
    code.replace(/O/g, '0'),
  ];

  try {
    const { data: existing } = await supabase
      .from('exam_codes')
      .select('id, exam_code, results_published')
      .in('exam_code', searchCodes)
      .limit(1);

    const currentPublished = Boolean(existing?.[0]?.results_published);
    const newPublished = publish !== undefined ? Boolean(publish) : !currentPublished;

    await supabase
      .from('exam_codes')
      .update({
        results_published: newPublished,
        updated_at: new Date().toISOString(),
      })
      .in('exam_code', searchCodes);

    res.json({
      success: true,
      exam_code: code,
      results_published: newPublished,
      message: newPublished ? 'Results are now live to candidates.' : 'Results are now hidden from candidates.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Authoritative recalculation of all scores for an exam
router.post('/results/recalculate', requireRole('super_admin', 'admin'), async (req, res) => {
  const { examCode } = req.body;
  if (!examCode) {
    res.status(400).json({ success: false, error: 'examCode is required' });
    return;
  }

  const code = String(examCode).trim().toUpperCase();
  const searchCodes = [
    code,
    code.replace(/5/g, 'S'),
    code.replace(/S/g, '5'),
    code.replace(/0/g, 'O'),
    code.replace(/O/g, '0'),
  ];

  try {
    const { data: questions } = await supabase
      .from('questions_ec')
      .select('id, correct_answer, marks, penalty, negative_marks')
      .in('exam_code', searchCodes);

    if (!questions || questions.length === 0) {
      res.status(404).json({ success: false, error: 'No questions found for this exam code' });
      return;
    }

    const qMap = new Map(questions.map((q) => [String(q.id), q]));

    const { data: attempts } = await supabase
      .from('exam_code_attempts')
      .select('id, answers, max_score')
      .in('exam_code', searchCodes);

    let recalculatedCount = 0;
    if (attempts && attempts.length > 0) {
      for (const att of attempts) {
        const answers = att.answers || {};
        let totalScore = 0;
        let correctCount = 0;
        let wrongCount = 0;
        let maxScore = 0;

        for (const [qid, q] of qMap.entries()) {
          const qMarks = Number(q.marks || 1);
          maxScore += qMarks;
          const givenAns = answers[qid];
          if (givenAns === undefined || givenAns === null || givenAns === '') continue;

          const normGiven = String(givenAns).trim().toUpperCase();
          const normCorr = String(q.correct_answer || '').trim().toUpperCase();

          if (normGiven === normCorr) {
            correctCount++;
            totalScore += qMarks;
          } else {
            wrongCount++;
            const pen = Number(q.penalty ?? q.negative_marks ?? 0);
            totalScore -= pen;
          }
        }

        totalScore = Math.max(0, Math.round(totalScore * 100) / 100);

        await supabase
          .from('exam_code_attempts')
          .update({
            score: totalScore,
            max_score: maxScore,
            correct_count: correctCount,
            wrong_count: wrongCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', att.id);

        recalculatedCount++;
      }
    }

    res.json({
      success: true,
      message: `Successfully recalculated ${recalculatedCount} candidate attempt(s).`,
      recalculated_count: recalculatedCount,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

export default router;

// ——— Public leaderboard (separate export, mounted outside /admin) ———
export { getLeaderboard };
