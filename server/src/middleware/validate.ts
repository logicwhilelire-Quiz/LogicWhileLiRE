import { z, ZodSchema, ZodIssue } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory: validate req.body against a Zod schema.
 * Returns 400 with a structured error list on failure.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.issues.map((e: ZodIssue) => ({
          field: e.path.map(String).join('.'),
          message: e.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Middleware factory: validate req.params against a Zod schema.
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid path parameters',
        details: result.error.issues.map((e: ZodIssue) => ({
          field: e.path.map(String).join('.'),
          message: e.message,
        })),
      });
      return;
    }
    next();
  };
}

/**
 * Middleware factory: validate req.query against a Zod schema.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: result.error.issues.map((e: ZodIssue) => ({
          field: e.path.map(String).join('.'),
          message: e.message,
        })),
      });
      return;
    }
    next();
  };
}

// ——— Common Zod schemas ———

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UUIDParam = z.object({
  id: z.string().regex(uuidRegex, 'Invalid UUID'),
});

export const ExamIdParam = z.object({
  examId: z.string().regex(uuidRegex, 'Invalid exam ID'),
});

export const SessionIdParam = z.object({
  sessionId: z.string().regex(uuidRegex, 'Invalid session ID'),
});

export const HallTicketParam = z.object({
  hallTicket: z.string().min(1, 'Hall ticket is required').trim(),
});

export const HallTicketQuery = z.object({
  hallTicket: z.string().min(1, 'hallTicket query parameter is required').trim(),
});

export const enrollSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  hall_ticket: z
    .string()
    .min(3)
    .max(30)
    .trim()
    .regex(/^[A-Za-z0-9\-_]+$/, 'Hall ticket may only contain letters, numbers, hyphens, underscores'),
  mobile: z
    .string()
    .regex(/^\+?[0-9]{7,15}$/, 'Invalid mobile number'),
  email: z.string().email('Invalid email address').toLowerCase(),
});

export const verifyOtpSchema = z.object({
  participant_id: z.string().uuid(),
  otp: z.string().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const startSessionSchema = z.object({
  fingerprint: z.string().max(256).optional(),
});

export const answerSchema = z.object({
  question_id: z.string().uuid(),
  chosen_option: z.enum(['a', 'b', 'c', 'd']),
  answer_latency_ms: z.number().int().nonnegative().optional(),
});

export const violationSchema = z.object({
  type: z.enum(['tab_switch', 'window_blur', 'fullscreen_exit', 'devtools', 'copy_paste']),
  notes: z.string().max(500).optional(),
});

export const createExamSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  duration_minutes: z.number().int().min(1).max(480),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  admin_email: z.string().email('Invalid admin alert email').optional(),
  is_leaderboard_public: z.boolean().optional().default(true),
});

export const adminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const createStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['super_admin', 'faculty']),
});

export const updateStaffStatusSchema = z.object({
  is_active: z.boolean().optional(),
});
