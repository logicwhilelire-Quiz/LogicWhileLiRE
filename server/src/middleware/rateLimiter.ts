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
 * Composite key helper so 200-300 students sharing a single college NAT Wi-Fi IP
 * never block each other on login/exam-entry endpoints, while still rate-limiting
 * individual accounts/tickets.
 */
function buildAccountCompositeKey(req: any, prefix: string): string {
  const ip = (req.ip as string) || 'unknown';
  const rawAccount =
    req.body?.hallTicket ||
    req.body?.hall_ticket ||
    req.query?.hallTicket ||
    req.query?.hall_ticket ||
    req.body?.login ||
    req.body?.roll_number ||
    req.body?.username ||
    req.body?.email ||
    req.body?.identifier ||
    '';
  const normAccount = String(rawAccount).trim().toUpperCase().slice(0, 80);
  const examCode = String(req.params?.code || req.body?.examCode || req.body?.exam_code || '').trim().toUpperCase().slice(0, 40);
  if (normAccount) {
    return `${prefix}:${ip}:${examCode}:${normAccount}`;
  }
  return `${prefix}:ip:${ip}`;
}

/**
 * Rate limiter for enrollment endpoint — 30 requests per minute per IP/candidate
 */
export const enrollRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req: any) => buildAccountCompositeKey(req, 'enroll'),
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many enrollment attempts. Please try again in a minute.',
  },
});

/**
 * Rate limiter for OTP verification — 20 requests per minute per IP/account
 */
export const otpRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req: any) => buildAccountCompositeKey(req, 'otp'),
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many OTP attempts. Please try again in a minute.',
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
 * Rate limiter for admin/staff login — 20 per 15 minutes per IP+username
 */
export const adminLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req: any) => buildAccountCompositeKey(req, 'admin_login'),
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many login attempts. Please try again later.',
  },
});

/**
 * Rate limiter for student auth (login, register) — 25 per 15 minutes per IP+account
 * (Safe for 300+ students sharing one campus NAT Wi-Fi gateway)
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req: any) => buildAccountCompositeKey(req, 'student_auth'),
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.',
  },
});

/**
 * Rate limiter for password reset / ID recovery requests — 10 per 15 minutes per IP+account
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req: any) => buildAccountCompositeKey(req, 'pw_reset'),
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many recovery requests. Please check your inbox or try again in 15 minutes.',
  },
});

/**
 * Rate limiter for enter-exam & exam code verification — 30 per 10 minutes per IP+hallTicket+examCode
 * Supports 300+ students entering from a single institutional NAT IP simultaneously.
 */
export const enterExamRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req: any) => buildAccountCompositeKey(req, 'enter_exam'),
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many exam entry attempts for this hall ticket. Please wait a few minutes or contact your invigilator.',
  },
});

/**
 * Rate limiter for contact inquiry form submissions — 10 per 15 minutes per IP
 */
export const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLoadTestBypass,
  message: {
    success: false,
    error: 'Too many contact inquiries submitted. Please try again in 15 minutes.',
  },
});

/**
 * General API rate limiter — 1500 req/min keyed by candidate token/hallTicket or IP,
 * excluding health/readiness probes so campus load bursts of 300+ users never trip a global 429.
 */
export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req: any) => {
    const authHeader = req.headers?.authorization as string | undefined;
    if (authHeader) return `auth:${authHeader.slice(-32)}`;
    const ht = req.query?.hallTicket || req.body?.hallTicket || req.body?.candidateId;
    if (ht) return `ht:${req.ip}:${String(ht).toUpperCase()}`;
    return `ip:${(req.ip as string) || 'unknown'}`;
  },
  skip: (req: any) => {
    if (isLoadTestBypass(req)) return true;
    const p = String(req?.path || '');
    return p === '/api/health' || p === '/health' || p === '/api/ready' || p === '/api/version';
  },
  message: {
    success: false,
    error: 'Server is experiencing heavy traffic. Retrying automatically.',
  },
});


