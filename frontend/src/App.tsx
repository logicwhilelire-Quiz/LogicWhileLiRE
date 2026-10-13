import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import ErrorBoundary from './components/ErrorBoundary';
import PageLoader from './components/PageLoader';

// Resilient lazy loader: automatically purges stale cache and reloads on deployment chunk hash changes
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error: any) {
      console.warn('[ChunkLoader] Module import failed, auto-recovering:', error);
      const msg = error?.message || '';
      const isChunkError =
        msg.includes('dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        error?.name === 'ChunkLoadError';

      if (isChunkError && typeof window !== 'undefined') {
        const key = 'chunk_retry_' + window.location.pathname;
        const last = sessionStorage.getItem(key);
        const now = Date.now();
        if (!last || now - Number(last) > 10000) {
          sessionStorage.setItem(key, String(now));
          if ('caches' in window) {
            try {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            } catch (_) {}
          }
          window.location.href = window.location.pathname + '?_t=' + now;
          return new Promise(() => {}) as any;
        }
      }
      throw error;
    }
  });
}

// Code-split routes for optimal performance and smaller initial bundles
const StudentLoginPage = lazyWithRetry(() => import('./pages/StudentLoginPage'));
const StudentRegisterPage = lazyWithRetry(() => import('./pages/StudentRegisterPage'));
const StudentDashboardPage = lazyWithRetry(() => import('./pages/StudentDashboardPage'));
const VerifyEmailPage = lazyWithRetry(() => import('./pages/VerifyEmailPage'));
const CandidateRegisterGatePage = lazyWithRetry(() => import('./pages/CandidateRegisterGatePage'));
const WaitingLobbyPage = lazyWithRetry(() => import('./pages/WaitingLobbyPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('./pages/ResetPasswordPage'));
const EnrollPage = lazyWithRetry(() => import('./pages/EnrollPage'));
const OTPVerifyPage = lazyWithRetry(() => import('./pages/OTPVerifyPage'));
const ExamPage = lazyWithRetry(() => import('./pages/ExamPage'));
const LeaderboardPage = lazyWithRetry(() => import('./pages/LeaderboardPage'));
const AdminLoginPage = lazyWithRetry(() => import('./pages/admin/AdminLoginPage'));
const AdminDashboardPage = lazyWithRetry(() => import('./pages/admin/AdminDashboardPage'));
const CreateExamPage = lazyWithRetry(() => import('./pages/admin/CreateExamPage'));
const ImportQuestionsPage = lazyWithRetry(() => import('./pages/admin/ImportQuestionsPage'));
const SessionsPage = lazyWithRetry(() => import('./pages/admin/SessionsPage'));
const ReportsPage = lazyWithRetry(() => import('./pages/admin/ReportsPage'));
const AnalyticsPage = lazyWithRetry(() => import('./pages/admin/AnalyticsPage'));
const StaffManagementPage = lazyWithRetry(() => import('./pages/admin/StaffManagementPage'));

// ── NEW: Exam Code System (No OTP) ──────────────────────────────
const InspectorLoginPage = lazyWithRetry(() => import('./pages/InspectorLoginPage'));
const FacultyLoginPage = lazyWithRetry(() => import('./pages/FacultyLoginPage'));
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'));
const EnterExamPage = lazyWithRetry(() => import('./pages/EnterExamPage'));
const InstructionsPage = lazyWithRetry(() => import('./pages/InstructionsPage'));
const ExamCodeQuizPage = lazyWithRetry(() => import('./pages/ExamCodeQuizPage'));
const ResultECPage = lazyWithRetry(() => import('./pages/ResultECPage'));
const LeaderboardECPage = lazyWithRetry(() => import('./pages/LeaderboardECPage'));
const VerifyCertificatePage = lazyWithRetry(() => import('./pages/VerifyCertificatePage'));
const PracticeArenaPage = lazyWithRetry(() => import('./pages/PracticeArenaPage'));
const InstitutionalStudentReportPage = lazyWithRetry(() => import('./pages/InstitutionalStudentReportPage'));
const AboutPage = lazyWithRetry(() => import('./pages/AboutPage'));
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'));

// ── NEW: Admin pages ─────────────────────────────────────────────
const CollegesPage = lazyWithRetry(() => import('./pages/admin/CollegesPage'));
const ExamCodesPage = lazyWithRetry(() => import('./pages/admin/ExamCodesPage'));
const AdminMonitorPage = lazyWithRetry(() => import('./pages/admin/AdminMonitorPage'));

// ── LogicWhileLiRE Clean Admin Control Center ───────────────────────
const Dashboard = lazyWithRetry(() => import('./pages/admin/Dashboard'));
const ExamControl = lazyWithRetry(() => import('./pages/admin/ExamControl'));
const QuestionControl = lazyWithRetry(() => import('./pages/admin/QuestionControl'));
const StudentControl = lazyWithRetry(() => import('./pages/admin/StudentControl'));
const MonitorControl = lazyWithRetry(() => import('./pages/admin/MonitorControl'));
const ResultControl = lazyWithRetry(() => import('./pages/admin/ResultControl'));
const SettingsControl = lazyWithRetry(() => import('./pages/admin/SettingsControl'));
const InstructorConsolePage = lazyWithRetry(() => import('./pages/admin/InstructorConsolePage'));
const HierarchyManagementPage = lazyWithRetry(() => import('./pages/admin/HierarchyManagementPage'));
const ActivityLogPage = lazyWithRetry(() => import('./pages/admin/ActivityLogPage'));
const MailLogsPage = lazyWithRetry(() => import('./pages/admin/MailLogsPage'));

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}
      >
        <Routes location={location}>
        {/* ── PUBLIC LANDING (Marketing page — default route) ── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/faculty" element={<FacultyLoginPage />} />
        <Route path="/faculty/login" element={<FacultyLoginPage />} />
        <Route path="/faculty-login" element={<FacultyLoginPage />} />
        <Route path="/inspector" element={<InspectorLoginPage />} />
        <Route path="/inspector/login" element={<InspectorLoginPage />} />
        <Route path="/inspector/console" element={<InstructorConsolePage />} />
        <Route path="/inspector/console/:examCode" element={<InstructorConsolePage />} />
        <Route path="/inspector/monitor" element={<MonitorControl />} />
        <Route path="/inspector/results" element={<ResultControl />} />

        {/* ── EXAM CODE SYSTEM (No OTP — Hall Ticket + Code) ── */}
        <Route path="/enter-exam" element={<EnterExamPage />} />
        <Route path="/exam/enter" element={<EnterExamPage />} />
        <Route path="/exam-enter" element={<EnterExamPage />} />
        <Route path="/instructions/:examCode" element={<InstructionsPage />} />
        <Route path="/quiz/:examCode" element={<ExamCodeQuizPage />} />
        <Route path="/result-ec/:examCode" element={<ResultECPage />} />
        <Route path="/leaderboard-ec/:examCode" element={<LeaderboardECPage />} />
        <Route path="/leaderboard/:examCode" element={<LeaderboardECPage />} />

        {/* ── RETIRED CERTIFICATE VERIFICATION (C4 Spec) ── */}
        <Route path="/verify/:token" element={<VerifyCertificatePage />} />
        <Route path="/certificate/verify/:token" element={<VerifyCertificatePage />} />
        <Route path="/verify" element={<VerifyCertificatePage />} />
        <Route path="/practice" element={<PracticeArenaPage />} />
        <Route path="/arena" element={<PracticeArenaPage />} />
        <Route path="/sectors" element={<PracticeArenaPage />} />

        {/* ── INSTITUTIONAL PERFORMANCE REPORTS (PDF Pages 11-14) ── */}
        <Route path="/reports/student/:hallTicket" element={<InstitutionalStudentReportPage />} />
        <Route path="/reports/student" element={<InstitutionalStudentReportPage />} />
        <Route path="/student/report/:hallTicket" element={<InstitutionalStudentReportPage />} />
        <Route path="/student/report" element={<InstitutionalStudentReportPage />} />
        <Route path="/report" element={<InstitutionalStudentReportPage />} />

        {/* ── CANDIDATE / STUDENT REGISTRATION PORTAL ── */}
        <Route path="/register" element={<CandidateRegisterGatePage />} />
        <Route path="/student/register" element={<CandidateRegisterGatePage />} />
        <Route path="/student-register" element={<CandidateRegisterGatePage />} />
        <Route path="/register-candidate" element={<CandidateRegisterGatePage />} />
        <Route path="/gate" element={<CandidateRegisterGatePage />} />
        <Route path="/student/dashboard" element={<StudentDashboardPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* Contest Waiting Lobby (Section 4 Handoff) */}
        <Route path="/contest/:contestId/waiting-lobby" element={<WaitingLobbyPage />} />
        <Route path="/waiting-lobby/:contestId" element={<WaitingLobbyPage />} />
        <Route path="/lobby/:contestId" element={<WaitingLobbyPage />} />
        <Route path="/contest/waiting-lobby" element={<Navigate to="/contest/demo-contest/waiting-lobby" replace />} />
        <Route path="/waiting-lobby" element={<Navigate to="/contest/demo-contest/waiting-lobby" replace />} />
        <Route path="/enter-quiz" element={<Navigate to="/contest/demo-contest/waiting-lobby" replace />} />

        {/* Student Auth & Recovery */}
        <Route path="/login" element={<StudentLoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/student/login" element={<Navigate to="/login" replace />} />

        {/* Public & Student Exam Routes (legacy) */}
        <Route path="/enroll/:examId" element={<EnrollPage />} />
        <Route path="/enroll/:examId/verify" element={<OTPVerifyPage />} />
        <Route path="/exam" element={<ExamPage />} />
        <Route path="/leaderboard/:examId" element={<LeaderboardPage />} />

        {/* Admin Authentication & Control Center */}
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/exams" element={<ExamControl />} />
        <Route path="/admin/exam-control" element={<ExamControl />} />
        <Route path="/admin/activity" element={<ActivityLogPage />} />
        <Route path="/admin/audit-logs" element={<ActivityLogPage />} />
        <Route path="/admin/mail-logs" element={<MailLogsPage />} />
        <Route path="/admin/email-logs" element={<MailLogsPage />} />
        <Route path="/admin/questions" element={<QuestionControl />} />
        <Route path="/admin/question-control" element={<QuestionControl />} />
        <Route path="/admin/students" element={<StudentControl />} />
        <Route path="/admin/monitor" element={<MonitorControl />} />
        <Route path="/admin/monitor/:examId" element={<MonitorControl />} />
        <Route path="/admin/monitor-control" element={<MonitorControl />} />
        <Route path="/admin/live-monitor" element={<MonitorControl />} />
        <Route path="/admin/live-monitor/:examId" element={<MonitorControl />} />
        <Route path="/admin/results" element={<ResultControl />} />
        <Route path="/admin/result-control" element={<ResultControl />} />
        <Route path="/admin/settings" element={<SettingsControl />} />
        <Route path="/admin/settings-control" element={<SettingsControl />} />

        {/* Supporting Admin Management Pages */}
        <Route path="/admin/staff" element={<StaffManagementPage />} />
        <Route path="/admin/create-exam" element={<CreateExamPage />} />
        <Route path="/admin/import" element={<ImportQuestionsPage />} />
        <Route path="/admin/sessions" element={<SessionsPage />} />
        <Route path="/admin/reports" element={<ReportsPage />} />
        <Route path="/admin/analytics" element={<AnalyticsPage />} />
        <Route path="/admin/analytics/:examId" element={<AnalyticsPage />} />
        <Route path="/admin/colleges" element={<CollegesPage />} />
        <Route path="/admin/hierarchy" element={<HierarchyManagementPage />} />
        <Route path="/admin/structure" element={<HierarchyManagementPage />} />
        <Route path="/admin/exam-codes" element={<ExamCodesPage />} />
        <Route path="/admin/live-console/:examCode" element={<InstructorConsolePage />} />
        <Route path="/admin/live-console" element={<InstructorConsolePage />} />
        <Route path="/admin/inspector" element={<InstructorConsolePage />} />
        <Route path="/admin/inspector/:examCode" element={<InstructorConsolePage />} />

        {/* ── About & Philosophy ── */}
        <Route path="/about" element={<AboutPage />} />

        {/* 404 Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

// Clean, fast institutional assessment app root
export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <AnimatedRoutes />
          </Suspense>
        </BrowserRouter>
      </MotionConfig>
    </ErrorBoundary>
  );
}

