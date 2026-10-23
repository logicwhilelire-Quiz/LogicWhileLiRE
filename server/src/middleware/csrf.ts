import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Double Submit Cookie CSRF Protection Middleware
 *
 * How it works:
 * 1. For state-changing operations (POST, PUT, PATCH, DELETE) that rely on HttpOnly authentication cookies
 *    (e.g., admin_token or student_token), the browser MUST provide a matching CSRF token in the
 *    'x-xsrf-token' or 'x-csrf-token' HTTP header matching the non-HttpOnly 'XSRF-TOKEN' cookie.
 * 2. Requests using Authorization: Bearer <token> headers are immune to CSRF attacks by definition
 *    (browsers do not automatically attach Bearer headers cross-origin) and are safely permitted.
 * 3. Public authentication endpoints (login, register, health, webhooks) are exempt.
 */

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'x-xsrf-token';
const CSRF_HEADER_ALT = 'x-csrf-token';

// Endpoints that are public entrypoints, API token authenticated, or safe from CSRF
const EXEMPT_PREFIXES = [
  '/api/health',
  '/api/ready',
  '/api/csrf-token',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify-otp',
  '/api/auth/resend-otp',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/admin/login',
  '/api/admin/request-login-otp',
  '/api/admin/verify-login-otp',
  '/api/enroll',
  '/api/assessment/register',
  '/api/v1/assessment/register',
  '/api/exam/verify-code',
  '/api/contact',
  '/api/v1/contact',
  '/api/v1/exams',
  '/api/v1/inspector',
  '/api/exam-code',
  '/api/session',
];

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware that ensures an XSRF-TOKEN cookie is set on outgoing responses
 */
export function ensureCsrfCookie(req: Request, res: Response, next: NextFunction): void {
  let token = req.cookies?.[CSRF_COOKIE_NAME];
  if (!token) {
    token = generateCsrfToken();
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by client JS to set the header
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  next();
}

/**
 * Endpoint handler for GET /api/csrf-token
 */
export function getCsrfToken(req: Request, res: Response): void {
  let token = req.cookies?.[CSRF_COOKIE_NAME];
  if (!token) {
    token = generateCsrfToken();
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  res.json({
    success: true,
    csrfToken: token,
  });
}

/**
 * Middleware that validates CSRF token for cookie-authenticated mutating requests
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe HTTP methods do not mutate state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  // Exempt routes
  const path = req.path.toLowerCase();
  const isExempt = EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (isExempt) {
    return next();
  }

  // If request uses Bearer token authorization header, it is safe from CSRF
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return next();
  }

  // Check if request is authenticated via cookie
  const hasAuthCookie = Boolean(req.cookies?.admin_token || req.cookies?.student_token);
  if (!hasAuthCookie) {
    // Unauthenticated requests will be handled by route auth middlewares
    return next();
  }

  // For cookie-authenticated requests, verify Double-Submit CSRF token
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = (req.headers[CSRF_HEADER_NAME] || req.headers[CSRF_HEADER_ALT]) as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({
      success: false,
      error: 'Forbidden: CSRF token mismatch or missing. Please refresh the page.',
      code: 'CSRF_VALIDATION_FAILED',
    });
    return;
  }

  next();
}
