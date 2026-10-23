import { Router } from 'express';
import {
  studentRegister,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  studentLogin,
  getStudentMe,
  getStudentDashboard,
  forgotPassword,
  resetPassword,
  logout,
  changeStudentPassword,
} from '../controllers/authController';
import { authRateLimit, otpRateLimit, otpEmailRateLimit, passwordResetRateLimit } from '../middleware/rateLimiter';
import { studentAuth } from '../middleware/auth';
import {
  validateBody,
  studentRegisterSchema,
  verifyStudentOtpSchema,
  resendStudentOtpSchema,
  studentLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../middleware/validate';

const router = Router();

/**
 * POST /api/auth/register
 * Student account self-registration with roster verification and OTP dispatch
 */
router.post(
  '/register',
  authRateLimit,
  otpEmailRateLimit,
  validateBody(studentRegisterSchema),
  studentRegister
);

/**
 * POST /api/auth/verify-registration-otp
 * Verify 6-digit OTP or link token to activate student account
 */
router.post(
  '/verify-registration-otp',
  otpRateLimit,
  otpEmailRateLimit,
  validateBody(verifyStudentOtpSchema),
  verifyRegistrationOtp
);

/**
 * POST /api/auth/resend-registration-otp
 * Resend a new 6-digit OTP to student's email
 */
router.post(
  '/resend-registration-otp',
  otpRateLimit,
  otpEmailRateLimit,
  validateBody(resendStudentOtpSchema),
  resendRegistrationOtp
);

/**
 * POST /api/auth/login
 * Student account login with email/roll_number & password
 * 5-attempt lockout, single active session enforcement
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
 * GET /api/auth/dashboard
 * Student assessment dashboard (profile, upcoming exams, results, rank)
 */
router.get(
  '/dashboard',
  studentAuth,
  getStudentDashboard
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
 * POST /api/auth/change-password
 * Complete password change for authenticated student
 */
router.post(
  '/change-password',
  studentAuth,
  changeStudentPassword
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
