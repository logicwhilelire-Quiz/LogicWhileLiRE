/**
 * LogicWhileLiRE — Client Configuration Module
 * Single authoritative source of truth for API, WebSocket, and Environment settings.
 */

const rawApiUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL;
const rawSocketUrl = (import.meta as any).env?.VITE_SOCKET_URL;

// In production builds, throw a clear and actionable error if the API URL is missing
if (import.meta.env.PROD && !rawApiUrl) {
  const errorMsg = '🚨 [Configuration Fatal] Missing VITE_API_BASE_URL in production environment. Please configure VITE_API_BASE_URL in Netlify/hosting dashboard.';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

export const API_BASE_URL: string = (rawApiUrl || 'http://localhost:3001').replace(/\/+$/, '');
export const SOCKET_URL: string = (rawSocketUrl || rawApiUrl || 'http://localhost:3001').replace(/\/+$/, '');

export const SUPABASE_URL: string = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
export const SUPABASE_ANON_KEY: string = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

import axios from 'axios';

// Ensure all client axios requests support cross-origin credentials (HttpOnly cookies)
axios.defaults.withCredentials = true;

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

