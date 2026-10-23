/**
 * LogicWhileLiRE — Client Configuration Module
 * Single authoritative source of truth for API, WebSocket, and Environment settings.
 */

// Priority: VITE_API_URL or VITE_API_BASE_URL
const rawApiUrl = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_API_BASE_URL;
const rawSocketUrl = (import.meta as any).env?.VITE_SOCKET_URL;

// Detect if running on localhost / loopback (e.g. local dev, vite preview, or local testing)
const isLocalhostHost = typeof window !== 'undefined' && (
  !window.location.hostname ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.endsWith('.local')
);

// In production builds deployed to a remote domain, ensure valid remote URL
const defaultProductionApiUrl = 'https://logicwhilelire-api.onrender.com';
const resolvedApiUrl = isLocalhostHost
  ? ((rawApiUrl && (rawApiUrl.includes('localhost') || rawApiUrl.includes('127.0.0.1'))) ? rawApiUrl : 'http://localhost:3001')
  : (rawApiUrl || defaultProductionApiUrl);

const resolvedSocketUrl = isLocalhostHost
  ? ((rawSocketUrl && (rawSocketUrl.includes('localhost') || rawSocketUrl.includes('127.0.0.1'))) ? rawSocketUrl : 'http://localhost:3001')
  : (rawSocketUrl || resolvedApiUrl);

export const API_BASE_URL: string = resolvedApiUrl.replace(/\/+$/, '');
export const SOCKET_URL: string = resolvedSocketUrl.replace(/\/+$/, '');

export const SUPABASE_URL: string = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://xhutjekdbyccscselzdy.supabase.co';
export const SUPABASE_ANON_KEY: string = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dNAfXpoQ-y4EAPF3RCh4dw_LnpRLEcw';

import axios from 'axios';

// Ensure all client axios requests support cross-origin credentials (HttpOnly cookies)
axios.defaults.withCredentials = true;
// 60-second timeout ensures Render free-tier cold starts (~25-35s) complete cleanly without premature timeout aborts
axios.defaults.timeout = 60000;

// Request interceptor to automatically attach admin and session tokens from storage if present
axios.interceptors.request.use((reqConfig) => {
  const adminToken = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
  const studentToken = localStorage.getItem('student_token') || sessionStorage.getItem('student_token');
  const sessionToken = localStorage.getItem('session_token') || sessionStorage.getItem('session_token');

  if (!reqConfig.headers) {
    reqConfig.headers = {} as any;
  }

  if (adminToken && (!reqConfig.headers.Authorization || reqConfig.headers.Authorization === 'Bearer ')) {
    reqConfig.headers.Authorization = `Bearer ${adminToken}`;
  } else if (studentToken && !reqConfig.headers.Authorization) {
    reqConfig.headers.Authorization = `Bearer ${studentToken}`;
  } else if (sessionToken && !reqConfig.headers.Authorization) {
    reqConfig.headers.Authorization = `Bearer ${sessionToken}`;
  }
  return reqConfig;
});

export const config = {
  apiBaseUrl: API_BASE_URL,
  socketUrl: SOCKET_URL,
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  isProd: import.meta.env.PROD,
  isDev: import.meta.env.DEV,
};

export default config;

