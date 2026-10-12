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

// In production builds deployed to a remote domain, base URL must come from environment and never point to localhost
if (import.meta.env.PROD && !isLocalhostHost) {
  if (!rawApiUrl || rawApiUrl.includes('localhost') || rawApiUrl.includes('127.0.0.1')) {
    const errorMsg = '🚨 [Configuration Fatal] When deployed to a remote domain, VITE_API_URL / VITE_API_BASE_URL must be configured with a valid remote URL, and must never default to localhost.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}

export const API_BASE_URL: string = (rawApiUrl || 'http://localhost:3001').replace(/\/+$/, '');
export const SOCKET_URL: string = (rawSocketUrl || rawApiUrl || 'http://localhost:3001').replace(/\/+$/, '');

export const SUPABASE_URL: string = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
export const SUPABASE_ANON_KEY: string = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

import axios from 'axios';

// Ensure all client axios requests support cross-origin credentials (HttpOnly cookies)
axios.defaults.withCredentials = true;
axios.defaults.timeout = 15000;

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

