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
    error: 'Too many OTP attempts. Please try again in a minute.',
  },
});

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


