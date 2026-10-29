import { Router } from 'express';
import { enrollParticipant, verifyEnrollmentOtp, resendEnrollmentOtp } from '../controllers/enrollmentController';
import { enrollRateLimit, otpRateLimit } from '../middleware/rateLimiter';
import { validateBody, validateParams, enrollSchema, verifyOtpSchema, ExamIdParam } from '../middleware/validate';

const router = Router();

/**
 * POST /api/enroll/:examId
 * Step 1 — submit name, hall_ticket, mobile, email; receive OTP via email
 */
router.post(
  '/:examId',
  enrollRateLimit,
  validateParams(ExamIdParam),
  validateBody(enrollSchema),
  enrollParticipant
);

/**
 * POST /api/enroll/:examId/verify-otp
 * Step 2 — submit OTP; receive HttpOnly JWT cookie + session_id
 */
router.post(
  '/:examId/verify-otp',
  otpRateLimit,
  validateParams(ExamIdParam),
  validateBody(verifyOtpSchema),
  verifyEnrollmentOtp
);

/**
 * POST /api/enroll/:examId/resend-otp
 * Resend a new OTP to the participant's email
 */
router.post(
  '/:examId/resend-otp',
  otpRateLimit,
  validateParams(ExamIdParam),
  resendEnrollmentOtp
);

export default router;
