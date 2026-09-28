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
  question_id: z.string().min(1).max(64),
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
  username: z.string().min(1, 'Username or email is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export const studentRegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  hall_ticket: z
    .string()
    .min(3, 'Hall ticket must be at least 3 characters')
    .max(30)
    .trim()
    .regex(/^[A-Za-z0-9\-_]+$/, 'Hall ticket may only contain letters, numbers, hyphens, underscores')
    .transform((val) => val.toUpperCase()),
  mobile: z
    .string()
    .regex(/^\+?[0-9]{7,15}$/, 'Invalid mobile number')
    .optional()
    .or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const studentLoginSchema = z.object({
  login: z.string().min(1, 'Email or hall ticket is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required').trim(),
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const createStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['super_admin', 'faculty', 'college_admin']),
  college_id: z.union([z.number(), z.string()]).optional(),
});

export const updateStaffStatusSchema = z.object({
  is_active: z.boolean().optional(),
});

/**
 * Gate Module: Candidate Registration Schema
 * Specification ID: AL-SPEC-2026-REG
 */
export const candidateRegisterSchema = z
  .object({
    first_name: z
      .string()
      .trim()
      .min(2, 'First name must be at least 2 characters')
      .regex(/^[A-Za-z\s]+$/, 'First name must contain only alphabetic characters')
      .transform((val) => val.charAt(0).toUpperCase() + val.slice(1)),
    last_name: z
      .string()
      .trim()
      .min(1, 'Last name must be at least 1 character')
      .regex(/^[A-Za-z\s]+$/, 'Last name must contain only alphabetic characters')
      .transform((val) => val.charAt(0).toUpperCase() + val.slice(1)),
    college_id: z.string().trim().min(1, 'College affiliation is required'),
    college_name: z.string().trim().optional(),
    year_of_passing: z
      .union([z.number(), z.string()])
      .transform((val) => Number(val))
      .refine((val) => [2027, 2028, 2029, 2030].includes(val), {
        message: 'Year of passing must be one of: 2027, 2028, 2029, 2030',
      }),
    roll_number: z
      .string()
      .trim()
      .min(2, 'Roll / Hall Ticket number is required')
      .max(30, 'Roll number cannot exceed 30 characters')
      .regex(/^[A-Za-z0-9]+$/, 'Roll number must be alphanumeric (e.g. 22B91A0501)')
      .transform((val) => val.toUpperCase()),
    branch_code: z
      .string()
      .trim()
      .min(1, 'Branch code is required')
      .transform((val) => val.toUpperCase()),
    section: z.enum(['A', 'B', 'C', 'D', 'E']),
    email: z
      .string()
      .trim()
      .email('Invalid email address (must follow RFC 5322 format)')
      .toLowerCase(),
    contact_number: z
      .string()
      .trim()
      .regex(/^[6-9][0-9]{9}$/, 'Contact number must be a 10-digit mobile number starting with 6-9'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
      .regex(/\d/, 'Password must contain at least 1 number')
      .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/, 'Password must contain at least 1 special character'),
    confirm_password: z.string().min(1, 'Confirm password is required'),
    timestamp: z.string().optional(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Confirm password must match password exactly',
    path: ['confirm_password'],
  });
