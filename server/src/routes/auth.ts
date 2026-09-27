import { Router } from 'express';
import {
  studentRegister,
  studentLogin,
  getStudentMe,
  forgotPassword,
  resetPassword,
  logout,
} from '../controllers/authController';
import { authRateLimit, passwordResetRateLimit } from '../middleware/rateLimiter';
import { studentAuth } from '../middleware/auth';
import {
  validateBody,
  studentRegisterSchema,
  studentLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../middleware/validate';

const router = Router();

/**
 * POST /api/auth/register
 * Student account registration with email & password
 */
router.post(
  '/register',
  authRateLimit,
  validateBody(studentRegisterSchema),
  studentRegister
);

/**
 * POST /api/auth/login
 * Student account login with email/hall_ticket & password
 */
router.post(
  '/login',
  authRateLimit,
  validateBody(studentLoginSchema),
  studentLogin
);

/**
 * GET /api/auth/me
 * Get current authenticated student details
 */
router.get(
  '/me',
  studentAuth,
  getStudentMe
);

/**
 * POST /api/auth/forgot-password
 * Request a password reset email link
 */
router.post(
  '/forgot-password',
  passwordResetRateLimit,
  validateBody(forgotPasswordSchema),
  forgotPassword
);

/**
 * POST /api/auth/reset-password
 * Complete password reset with token from email link
 */
router.post(
  '/reset-password',
  authRateLimit,
  validateBody(resetPasswordSchema),
  resetPassword
);

/**
 * POST /api/auth/logout
 * Log out and clear cookies
 */
router.post(
  '/logout',
  logout
);

export default router;
