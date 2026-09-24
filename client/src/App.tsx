import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import ErrorBoundary from './components/ErrorBoundary';
import PageLoader from './components/PageLoader';

// Code-split routes for optimal performance and smaller initial bundles
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

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/enroll/:examId" element={<EnrollPage />} />
        <Route path="/enroll/:examId/verify" element={<OTPVerifyPage />} />
        <Route path="/exam" element={<ExamPage />} />
        <Route path="/leaderboard/:examId" element={<LeaderboardPage />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/staff" element={<StaffManagementPage />} />
        <Route path="/admin/create-exam" element={<CreateExamPage />} />
        <Route path="/admin/import" element={<ImportQuestionsPage />} />
        <Route path="/admin/sessions" element={<SessionsPage />} />
        <Route path="/admin/reports" element={<ReportsPage />} />
        <Route path="/admin/analytics" element={<AnalyticsPage />} />
        <Route path="/admin/analytics/:examId" element={<AnalyticsPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

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
