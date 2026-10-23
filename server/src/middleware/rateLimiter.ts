import rateLimit from 'express-rate-limit';

export const isLoadTestBypass = (req: any): boolean => {
  // CRITICAL SECURITY RULE: In production, load test bypass has NO effect.
  // Rate limits are strictly always active to prevent production DDoS/bypass attacks.
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return Boolean(
    process.env.NODE_ENV === 'test' ||
    process.env.LOAD_TEST === 'true' ||
    req?.headers?.['x-load-test'] === 'true' ||
    (process.env.DEMO_MODE === 'true' && (
      req?.ip === '127.0.0.1' ||
      req?.ip === '::1' ||
      req?.ip === '::ffff:127.0.0.1'
    ))
  );
};

/**
 * Rate limiter for enrollment endpoint — 5 requests per minute per IP
 */
export const enrollRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many enrollment attempts. Please try again in a minute.',
  },
});

/**
 * Rate limiter for OTP verification — 5 requests per minute per IP
 */
export const otpRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many OTP attempts from this IP address. Please try again in a minute.',
  },
});

/**
 * In-memory sliding window rate limiter for OTP requests per email address
 * Max 3 OTP requests per 10 minutes per email
 */
interface OtpEmailRecord {
  count: number;
  resetAt: number;
}
const emailOtpWindowMap = new Map<string, OtpEmailRecord>();

// Cleanup stale records periodically
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of emailOtpWindowMap.entries()) {
    if (now > record.resetAt) {
      emailOtpWindowMap.delete(email);
    }
  }
}, 5 * 60 * 1000);

export function otpEmailRateLimit(req: any, res: any, next: any): void {
  if (isLoadTestBypass(req)) {
    return next();
  }
  const rawEmail = req.body?.email;
  if (!rawEmail || typeof rawEmail !== 'string') {
    return next();
  }

  const normalized = rawEmail.toLowerCase().trim();
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxAttempts = 3;

  let record = emailOtpWindowMap.get(normalized);
  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + windowMs };
    emailOtpWindowMap.set(normalized, record);
    return next();
  }

  if (record.count >= maxAttempts) {
    const remainingSeconds = Math.ceil((record.resetAt - now) / 1000);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    res.status(429).json({
      success: false,
      error: `Too many OTP requests for this email address. Please wait ${remainingMinutes} minute(s) before requesting another code.`,
      code: 'EMAIL_OTP_RATE_LIMITED',
      retry_after_seconds: remainingSeconds,
    });
    return;
  }

  record.count++;
  next();
}

/**
 * Rate limiter for answer submission — 120 requests per minute per candidate token
 * (keyed by auth token or IP so 300 campus students on a single NAT IP don't conflict)
 */
export const answerRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req: any) => {
    return (req.headers.authorization as string) || (req.ip as string) || 'unknown';
  },
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many answer submissions. Please slow down.',
  },
});

/**
 * Rate limiter for admin login — 10 per 15 minutes per IP
 */
export const adminLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many login attempts. Please try again later.',
  },
});

/**
 * Rate limiter for student auth (login, register) — 15 per 15 minutes per IP
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.',
  },
});

/**
 * Rate limiter for password reset requests — 5 per 15 minutes per IP
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many password reset requests. Please check your inbox or try again in 15 minutes.',
  },
});

/**
 * Rate limiter for enter-exam & exam code verification — 20 per 10 minutes per IP
 */
export const enterExamRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many exam entry attempts. Please check your credentials and try again in 10 minutes.',
  },
});

/**
 * Rate limiter for contact inquiry form submissions — 5 per 15 minutes per IP
 */
export const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many contact inquiries submitted. Please try again in 15 minutes.',
  },
});

/**
 * General API rate limiter
 */
export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req: any) => {
    return (req.headers.authorization as string) || (req.ip as string) || 'unknown';
  },
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
});


