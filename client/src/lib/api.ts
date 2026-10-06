import axios from 'axios';
import { API_BASE_URL } from './config';

// The base URL must come from an environment variable (for example VITE_API_URL or VITE_API_BASE_URL)
// and must never default to localhost in production builds.
const envApiUrl = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_API_BASE_URL;
if (import.meta.env.PROD && (!envApiUrl || envApiUrl.includes('localhost') || envApiUrl.includes('127.0.0.1'))) {
  throw new Error('Production builds require VITE_API_URL to be set to a valid non-localhost URL.');
}

const BASE_URL = API_BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send HttpOnly cookies
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor to attach Bearer token fallback for cross-domain environments
api.interceptors.request.use((config) => {
  const isAdminRoute = config.url?.startsWith('/api/admin');
  const adminToken = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
  const studentToken = localStorage.getItem('student_token') || sessionStorage.getItem('student_token');
  const sessionToken = localStorage.getItem('session_token') || sessionStorage.getItem('session_token');

  if (isAdminRoute && adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  } else if (studentToken) {
    config.headers.Authorization = `Bearer ${studentToken}`;
  } else if (sessionToken) {
    config.headers.Authorization = `Bearer ${sessionToken}`;
  }
  return config;
});

// Response interceptor to clean up invalidated or rejected demo tokens
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const url = error.config?.url || '';
      if (url.startsWith('/api/admin')) {
        const token = localStorage.getItem('admin_token');
        if (token && (token.startsWith('demo-') || error.response?.data?.code === 'DEMO_BYPASS_REJECTED')) {
          localStorage.removeItem('admin_token');
          sessionStorage.removeItem('admin_token');
        }
      }
    }
    return Promise.reject(error);
  }
);

// ——— Auth (Students & Recovery) ———
export const studentLogin = (data: { login?: string; roll_number?: string; email?: string; password: string }) =>
  api.post('/api/auth/login', data);

export const studentRegister = (data: {
  name?: string;
  full_name?: string;
  email: string;
  roll_number?: string;
  hall_ticket?: string;
  college_id?: string | number;
  cohort_id?: string;
  section?: string;
  section_id?: string;
  phone?: string;
  mobile?: string;
  password: string;
}) => api.post('/api/auth/register', data);

export const verifyRegistrationOtp = (data: { email: string; otp?: string; token?: string }) =>
  api.post('/api/auth/verify-registration-otp', data);

export const resendRegistrationOtp = (data: { email: string }) =>
  api.post('/api/auth/resend-registration-otp', data);

export const getStudentDashboard = () => api.get('/api/student/dashboard');

export interface CandidateRegisterPayload {
  first_name: string;
  last_name: string;
  college_id: string;
  college_name?: string;
  year_of_passing: number;
  roll_number: string;
  branch_code: string;
  section: string;
  email: string;
  contact_number: string;
  password: string;
  confirm_password: string;
  timestamp?: string;
}

// ——— Gate Module: Candidate Assessment Registration (AL-SPEC-2026-REG) ———
export const registerCandidate = (data: CandidateRegisterPayload) =>
  api.post('/api/v1/assessment/register-candidate', data);

export const getAssessmentSystemCheck = () =>
  api.get('/api/v1/assessment/system-check');

export const getAssessmentLobbyStatus = (contestId?: string) =>
  api.get(`/api/v1/assessment/lobby-status${contestId ? `?contest_id=${encodeURIComponent(contestId)}` : ''}`);


export const getStudentMe = () => api.get('/api/auth/me');

export const forgotPassword = (data: { email: string }) =>
  api.post('/api/auth/forgot-password', data);

export const resetPassword = (data: { token: string; email: string; new_password: string }) =>
  api.post('/api/auth/reset-password', data);

export const authLogout = () => api.post('/api/auth/logout');

// ——— Enrollment (Legacy / Direct) ———
export const enrollParticipant = (examId: string, data: {
  name: string; hall_ticket: string; mobile: string; email: string;
}) => api.post(`/api/enroll/${examId}`, data);

export const verifyOtp = (examId: string, data: {
  participant_id: string; otp: string;
}) => api.post(`/api/enroll/${examId}/verify-otp`, data);

// ——— Session ———
export const startSession = (fingerprint?: string) => api.post('/api/session/start', { fingerprint });
export const getTimeRemaining = (sessionId: string) => api.get(`/api/session/${sessionId}/time-remaining`);
export const getQuestions = (sessionId: string, page: number) =>
  api.get(`/api/session/${sessionId}/questions?page=${page}`);
export const saveAnswer = (sessionId: string, data: {
  question_id: string; chosen_option: string; answer_latency_ms?: number;
}) => api.post(`/api/session/${sessionId}/answer`, data);
export const submitSession = (sessionId: string) => api.post(`/api/session/${sessionId}/submit`);

// ——— Violations (also via sendBeacon for tab-close safety) ———
export const logViolation = (sessionId: string, type: string, notes?: string) =>
  api.post(`/api/session/${sessionId}/violation`, { type, notes });

// ——— Leaderboard ———
export const getLeaderboard = (examId: string) => api.get(`/api/exam/${examId}/leaderboard`);

// ——— Admin ———
export const adminLogin = (data: { username: string; password: string; totp_code?: string }) =>
  api.post('/api/admin/login', data);
export const enrollInit2FA = (enrollment_token: string) =>
  api.post('/api/admin/2fa/enroll-init', { enrollment_token }, {
    headers: { Authorization: `Bearer ${enrollment_token}` },
  });
export const enrollConfirm2FA = (enrollment_token: string, code: string) =>
  api.post('/api/admin/2fa/enroll-confirm', { enrollment_token, code }, {
    headers: { Authorization: `Bearer ${enrollment_token}` },
  });
export const adminLogout = () => api.post('/api/admin/logout');
export const listExams = (page?: number, limit?: number) =>
  api.get('/api/admin/exams', { params: page !== undefined ? { page, limit } : undefined });
export const createExam = (data: {
  title: string;
  duration_minutes: number;
  start_time?: string;
  end_time?: string;
  admin_email?: string;
  is_leaderboard_public?: boolean;
}) => api.post('/api/admin/exams', data);
export const activateExam = (id: string, is_active: boolean) =>
  api.patch(`/api/admin/exams/${id}/activate`, { is_active });
export const getQRUrl = (examId: string) => `${BASE_URL}/api/admin/exams/${examId}/qr`;
export const importQuestions = (examId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/api/admin/exams/${examId}/import-questions`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const validateAndPreviewQuestions = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/api/admin/questions/validate-preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const confirmImportQuestions = (data: { examCode: string; examId?: string; questions: any[] }) =>
  api.post('/api/admin/questions/confirm-import', data);

export const listSessions = (examId: string, page: number = 1, limit: number = 20) =>
  api.get(`/api/admin/exams/${examId}/sessions?page=${page}&limit=${limit}`);
export const terminateSession = (sessionId: string, reason: string) =>
  api.post(`/api/admin/sessions/${sessionId}/terminate`, { reason });
export const allowExamReentry = (attemptId: string, reason?: string) =>
  api.post(`/api/admin/attempts/${attemptId}/allow-reentry`, { reason });
export const getExcelReportUrl = (examId: string) => `${BASE_URL}/api/admin/exams/${examId}/report/excel`;
export const getPdfReportUrl = (examId: string) => `${BASE_URL}/api/admin/exams/${examId}/report/pdf`;

// ——— Analytics ———
export const getQuestionAnalytics = (examId: string) =>
  api.get(`/api/admin/exams/${examId}/analytics/questions`);
export const getTopicAnalytics = (examId: string) =>
  api.get(`/api/admin/exams/${examId}/analytics/topics`);
export const getParticipantHistory = (hallTicket: string) =>
  api.get(`/api/admin/participant-history/${encodeURIComponent(hallTicket)}`);

// ——— Suspicious Activity & Proctoring Flags ———
export const listSuspiciousActivity = (examId: string) =>
  api.get(`/api/admin/exams/${examId}/suspicious-activity`);
export const resolveSuspiciousActivity = (id: string, action: 'clear' | 'confirm', notes?: string) =>
  api.patch(`/api/admin/suspicious-activity/${id}/resolve`, { action, notes });

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'faculty' | 'inspector' | 'college_admin' | 'admin';
  is_active: boolean;
  permissions?: string[];
  college_id?: number | null;
  two_factor_enabled?: boolean;
  failed_login_attempts?: number;
  created_by?: string;
  created_at: string;
}

export const listStaff = () =>
  api.get<{ success: boolean; staff: StaffMember[] }>('/api/admin/staff');

export const createStaff = (data: {
  name: string;
  email: string;
  password?: string;
  role: 'super_admin' | 'faculty' | 'inspector';
  college_id?: number;
}) => api.post<{ success: boolean; message: string; staff: StaffMember; temporaryPassword?: string }>('/api/admin/staff', data);

export const toggleStaffActive = (id: string, is_active: boolean) =>
  api.patch<{ success: boolean; message: string; staff: StaffMember }>(`/api/admin/staff/${id}/deactivate`, { is_active });

export const resetStaffPassword = (id: string) =>
  api.post<{ success: boolean; message: string; temporaryPassword?: string }>(`/api/admin/staff/${id}/reset-password`);

export const updateStaffPermissions = (id: string, permissions: string[]) =>
  api.patch<{ success: boolean; message: string; staff: StaffMember }>(`/api/admin/staff/${id}/permissions`, { permissions });

export const deleteStaff = (id: string) =>
  api.delete<{ success: boolean; message: string }>(`/api/admin/staff/${id}`);

// ——— Hierarchy Management ———
export interface AcademicYear {
  id: number;
  college_id: number;
  year_name: string;
  start_date?: string;
  end_date?: string;
  is_current: boolean;
}

export interface Cohort {
  id: number;
  college_id: number;
  academic_year_id: number;
  cohort_name: string;
  yop: number;
  degree?: string;
  branch?: string;
}

export interface Section {
  id: number;
  cohort_id: number;
  section_name: string;
  capacity?: number;
}

export interface Batch {
  id: number;
  section_id: number;
  batch_name: string;
  max_students?: number;
}

export interface HierarchyStudent {
  id: string;
  roll_number?: string;
  hall_ticket?: string;
  name: string;
  email: string;
  phone?: string;
  college_id?: number;
  academic_year_id?: number;
  cohort_id?: number;
  section_id: number;
  batch_id: number;
  must_change_password?: boolean;
  created_at?: string;
}

export const getHierarchyOverview = () =>
  api.get<{ success: boolean; colleges: any[] }>('/api/admin/hierarchy/overview');

export const listAcademicYears = (collegeId?: number) =>
  api.get<{ success: boolean; academic_years: AcademicYear[] }>('/api/admin/academic-years', { params: { college_id: collegeId } });

export const createAcademicYear = (data: Partial<AcademicYear>) =>
  api.post<{ success: boolean; academic_year: AcademicYear }>('/api/admin/academic-years', data);

export const updateAcademicYear = (id: number, data: Partial<AcademicYear>) =>
  api.put<{ success: boolean; academic_year: AcademicYear }>(`/api/admin/academic-years/${id}`, data);

export const deleteAcademicYear = (id: number) =>
  api.delete<{ success: boolean }>(`/api/admin/academic-years/${id}`);

export const listCohorts = (params?: { college_id?: number; academic_year_id?: number }) =>
  api.get<{ success: boolean; cohorts: Cohort[] }>('/api/admin/cohorts', { params });

export const createCohort = (data: Partial<Cohort>) =>
  api.post<{ success: boolean; cohort: Cohort }>('/api/admin/cohorts', data);

export const updateCohort = (id: number, data: Partial<Cohort>) =>
  api.put<{ success: boolean; cohort: Cohort }>(`/api/admin/cohorts/${id}`, data);

export const deleteCohort = (id: number) =>
  api.delete<{ success: boolean }>(`/api/admin/cohorts/${id}`);

export const listSections = (cohortId?: number) =>
  api.get<{ success: boolean; sections: Section[] }>('/api/admin/sections', { params: { cohort_id: cohortId } });

export const createSection = (data: Partial<Section>) =>
  api.post<{ success: boolean; section: Section }>('/api/admin/sections', data);

export const updateSection = (id: number, data: Partial<Section>) =>
  api.put<{ success: boolean; section: Section }>(`/api/admin/sections/${id}`, data);

export const deleteSection = (id: number) =>
  api.delete<{ success: boolean }>(`/api/admin/sections/${id}`);

export const listBatches = (sectionId?: number) =>
  api.get<{ success: boolean; batches: Batch[] }>('/api/admin/batches', { params: { section_id: sectionId } });

export const createBatch = (data: Partial<Batch>) =>
  api.post<{ success: boolean; batch: Batch }>('/api/admin/batches', data);

export const updateBatch = (id: number, data: Partial<Batch>) =>
  api.put<{ success: boolean; batch: Batch }>(`/api/admin/batches/${id}`, data);

export const deleteBatch = (id: number) =>
  api.delete<{ success: boolean }>(`/api/admin/batches/${id}`);

export const listHierarchyStudents = (params?: { section_id?: number; batch_id?: number; college_id?: number; search?: string }) =>
  api.get<{ success: boolean; students: HierarchyStudent[] }>('/api/admin/students', { params });

export const createHierarchyStudent = (data: {
  roll_number: string;
  name: string;
  email: string;
  phone?: string;
  college_id?: number;
  academic_year_id?: number;
  cohort_id?: number;
  section_id: number;
  batch_id: number;
}) => api.post<{ success: boolean; message: string; student: HierarchyStudent; temporaryPassword?: string }>('/api/admin/students', data);

export const bulkImportStudents = (file: File, options?: { college_id?: number; section_id?: number; batch_id?: number }) => {
  const form = new FormData();
  form.append('file', file);
  if (options?.college_id) form.append('college_id', String(options.college_id));
  if (options?.section_id) form.append('section_id', String(options.section_id));
  if (options?.batch_id) form.append('batch_id', String(options.batch_id));
  return api.post<{
    success: boolean;
    summary: { total: number; inserted: number; errors: number; emailsSent: number };
    errors: Array<{ row: number; reason: string }>;
  }>('/api/admin/students/bulk-import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const previewHierarchyImport = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<{
    success: boolean;
    total: number;
    valid_count: number;
    duplicate_count: number;
    error_count: number;
    preview: Array<{ row: number; roll_number: string; name: string; email: string; section?: string; branch?: string }>;
    duplicates: Array<{ row: number; roll_number?: string; email?: string; reason: string }>;
    errors: Array<{ row: number; reason: string }>;
  }>('/api/admin/hierarchy/import-preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const bulkImportHierarchy = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<{
    success: boolean;
    summary: { total: number; inserted: number; errors: number; emailsSent: number };
    errors: Array<{ row: number; reason: string }>;
  }>('/api/admin/hierarchy/bulk-import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const exportBatchStudentsUrl = (batchId: number, format: 'xlsx' | 'csv' = 'xlsx') =>
  `${BASE_URL}/api/admin/students/export?batch_id=${batchId}&format=${format}`;

export const resetStudentPassword = (id: string) =>
  api.post<{ success: boolean; message: string; temporaryPassword?: string }>(`/api/admin/students/${id}/reset-password`);

// ——— 2FA & Security ———
export const setup2FA = () =>
  api.post<{ success: boolean; secret: string; otpauth_url: string; qr_code_url: string }>('/api/admin/2fa/setup');

export const verifyAndEnable2FA = (code: string) =>
  api.post<{ success: boolean; message: string }>('/api/admin/2fa/verify', { code });

export const disable2FA = (code: string) =>
  api.post<{ success: boolean; message: string }>('/api/admin/2fa/disable', { code });

export const runSystemBackup = () =>
  api.get('/api/admin/backup');

export const triggerBackupNow = () =>
  api.post('/api/admin/backup');

export const getBackupHistory = () =>
  api.get('/api/admin/backup/history');

export const getGoogleDriveStatus = () =>
  api.get('/api/admin/backup/drive-status');

export const downloadSystemBackupZip = (id?: string) =>
  api.get(`/api/admin/backup/download${id ? `?id=${encodeURIComponent(id)}` : ''}`, { responseType: 'blob' });

// ——— Bulk Enrollment ———
export interface BulkEnrollResult {
  success: boolean;
  message: string;
  total_uploaded: number;
  inserted_count: number;
  skipped_count: number;
  inserted: Array<{ id: string; name: string; hall_ticket: string; email: string }>;
  skipped: Array<{ hall_ticket: string; reason: string }>;
  validation_warnings?: Array<{ row: number; hall_ticket?: string; error: string }>;
}

export const getBulkEnrollTemplateUrl = () => `${BASE_URL}/api/admin/bulk-enroll/template`;

export const bulkEnrollParticipants = (examId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<BulkEnrollResult>(`/api/admin/exams/${examId}/bulk-enroll`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ——— Live Exam Dispatch (Sprint 2) ———
export const startExam = (examCode: string, opts?: { allow_late_join?: boolean }) =>
  api.post(`/api/v1/exams/${examCode}/start`, opts ?? {});

export const getExamLobbyStats = (examCode: string) =>
  api.get(`/api/v1/exams/${examCode}/lobby-stats`);

export const submitContactForm = (data: {
  name: string;
  email: string;
  subject?: string;
  message: string;
  institution?: string;
  candidateCount?: string;
}) => api.post('/api/contact', data);

/**
 * Robust helper to extract user-friendly error strings from Axios errors or standard Error objects.
 */
export function extractErrorMessage(err: unknown, defaultMessage = 'An unexpected error occurred'): string {
  if (!err) return defaultMessage;
  if (typeof err === 'string') return err;
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data) {
      if (typeof data === 'string') return data;
      if (typeof data.error === 'string') return data.error;
      if (typeof data.message === 'string') return data.message;
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        return data.errors.map((e: any) => e.message || String(e)).join(', ');
      }
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return defaultMessage;
}

export { api };
export default api;





