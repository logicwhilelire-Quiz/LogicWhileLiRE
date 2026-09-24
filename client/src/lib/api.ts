import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send HttpOnly cookies
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor to attach Bearer token fallback for cross-domain environments
api.interceptors.request.use((config) => {
  const isAdminRoute = config.url?.startsWith('/api/admin');
  const adminToken = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
  const participantToken = localStorage.getItem('session_token') || sessionStorage.getItem('session_token');

  if (isAdminRoute && adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  } else if (!isAdminRoute && participantToken) {
    config.headers.Authorization = `Bearer ${participantToken}`;
  }
  return config;
});

// ——— Enrollment ———
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
export const adminLogin = (data: { username: string; password: string }) =>
  api.post('/api/admin/login', data);
export const adminLogout = () => api.post('/api/admin/logout');
export const listExams = () => api.get('/api/admin/exams');
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
export const listSessions = (examId: string, page: number = 1, limit: number = 20) =>
  api.get(`/api/admin/exams/${examId}/sessions?page=${page}&limit=${limit}`);
export const terminateSession = (sessionId: string, reason: string) =>
  api.post(`/api/admin/sessions/${sessionId}/terminate`, { reason });
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

// ——— Staff Management (Super Admin) ———
export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'faculty';
  is_active: boolean;
  created_by?: string;
  created_at: string;
}

export const listStaff = () =>
  api.get<{ success: boolean; staff: StaffMember[] }>('/api/admin/staff');

export const createStaff = (data: {
  name: string;
  email: string;
  password: string;
  role: 'super_admin' | 'faculty';
}) => api.post<{ success: boolean; message: string; staff: StaffMember }>('/api/admin/staff', data);

export const toggleStaffActive = (id: string, is_active: boolean) =>
  api.patch<{ success: boolean; message: string; staff: StaffMember }>(`/api/admin/staff/${id}/deactivate`, { is_active });

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


