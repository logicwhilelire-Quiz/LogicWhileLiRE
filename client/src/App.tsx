import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import ErrorBoundary from './components/ErrorBoundary';
import PageLoader from './components/PageLoader';
import CustomCursor from './components/CustomCursor';
import GrowthranIntro from './components/GrowthranIntro';
import PageTransition from './components/3d/PageTransition';

// Code-split routes for optimal performance and smaller initial bundles
const StudentLoginPage = lazy(() => import('./pages/StudentLoginPage'));
const CandidateRegisterGatePage = lazy(() => import('./pages/CandidateRegisterGatePage'));
const WaitingLobbyPage = lazy(() => import('./pages/WaitingLobbyPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const EnrollPage = lazy(() => import('./pages/EnrollPage'));
const OTPVerifyPage = lazy(() => import('./pages/OTPVerifyPage'));
const ExamPage = lazy(() => import('./pages/ExamPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const CreateExamPage = lazy(() => import('./pages/admin/CreateExamPage'));
const ImportQuestionsPage = lazy(() => import('./pages/admin/ImportQuestionsPage'));
const SessionsPage = lazy(() => import('./pages/admin/SessionsPage'));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage'));
const StaffManagementPage = lazy(() => import('./pages/admin/StaffManagementPage'));

// ── NEW: Exam Code System (No OTP) ──────────────────────────────
const LandingPage = lazy(() => import('./pages/LandingPage'));
const EnterExamPage = lazy(() => import('./pages/EnterExamPage'));
const InstructionsPage = lazy(() => import('./pages/InstructionsPage'));
const ExamCodeQuizPage = lazy(() => import('./pages/ExamCodeQuizPage'));
const ResultECPage = lazy(() => import('./pages/ResultECPage'));
const LeaderboardECPage = lazy(() => import('./pages/LeaderboardECPage'));
const VerifyCertificatePage = lazy(() => import('./pages/VerifyCertificatePage'));
const PracticeArenaPage = lazy(() => import('./pages/PracticeArenaPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// ── NEW: Admin pages ─────────────────────────────────────────────
const CollegesPage = lazy(() => import('./pages/admin/CollegesPage'));
const ExamCodesPage = lazy(() => import('./pages/admin/ExamCodesPage'));
const AdminMonitorPage = lazy(() => import('./pages/admin/AdminMonitorPage'));

// ── GROWTHRAN 1.0 Clean Admin Control Center ───────────────────────
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const ExamControl = lazy(() => import('./pages/admin/ExamControl'));
const QuestionControl = lazy(() => import('./pages/admin/QuestionControl'));
const StudentControl = lazy(() => import('./pages/admin/StudentControl'));
const MonitorControl = lazy(() => import('./pages/admin/MonitorControl'));
const ResultControl = lazy(() => import('./pages/admin/ResultControl'));
const SettingsControl = lazy(() => import('./pages/admin/SettingsControl'));

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

        {/* ── EXAM CODE SYSTEM (No OTP — Hall Ticket + Code) ── */}
        <Route path="/enter-exam" element={<EnterExamPage />} />
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

        {/* Gate Module: Candidate Assessment Registration (AL-SPEC-2026-REG) */}
        <Route path="/register" element={<CandidateRegisterGatePage />} />
        <Route path="/gate" element={<CandidateRegisterGatePage />} />
        <Route path="/register-candidate" element={<CandidateRegisterGatePage />} />
        <Route path="/student/register" element={<Navigate to="/register" replace />} />

        {/* Contest Waiting Lobby (Section 4 Handoff) */}
        <Route path="/contest/:contestId/waiting-lobby" element={<WaitingLobbyPage />} />
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
        <Route path="/admin/questions" element={<QuestionControl />} />
        <Route path="/admin/question-control" element={<QuestionControl />} />
        <Route path="/admin/students" element={<StudentControl />} />
        <Route path="/admin/student-control" element={<StudentControl />} />
        <Route path="/admin/monitor" element={<MonitorControl />} />
        <Route path="/admin/monitor/:examId" element={<MonitorControl />} />
        <Route path="/admin/monitor-control" element={<MonitorControl />} />
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
        <Route path="/admin/exam-codes" element={<ExamCodesPage />} />

        {/* ── About & Philosophy ── */}
        <Route path="/about" element={<AboutPage />} />

        {/* 404 Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function RouteSweep() {
  const location = useLocation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const timer = setTimeout(() => setActive(false), 450);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return <PageTransition isActive={active} duration={0.45} />;
}

// PERFORMANCE RULE - TO KEEP 60FPS:
// If mobile, reduce particles: isMobile ? 25 nodes : 50 nodes
// Use <Canvas dpr={[1,1.5]}> - Cap pixel ratio
// Use <Suspense> for all 3D - Lazy load
export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <GrowthranIntro />
          <RouteSweep />
          <CustomCursor />
          <Suspense fallback={<PageLoader />}>
            <AnimatedRoutes />
          </Suspense>
        </BrowserRouter>
      </MotionConfig>
    </ErrorBoundary>
  );
}

