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
  totp_code: z.string().optional(),
});

/**
 * Strong password verification policy:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special symbol (!@#$%^&*...)
 */
export function isStrongPassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter (A-Z)' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter (a-z)' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one digit (0-9)' };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character (!@#$%^&*...)' };
  }
  return { valid: true };
}

export const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter (A-Z)')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter (a-z)')
  .regex(/[0-9]/, 'Password must contain at least one digit (0-9)')
  .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/, 'Password must contain at least one special character');

export const studentRegisterSchema = z.object({
  name: z.string().min(2, 'Full name must be at least 2 characters').max(100).trim().optional(),
  full_name: z.string().min(2).max(100).trim().optional(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  roll_number: z
    .string()
    .min(2, 'Roll number must be at least 2 characters')
    .max(30)
    .trim()
    .optional(),
  hall_ticket: z
    .string()
    .min(2, 'Hall ticket must be at least 2 characters')
    .max(30)
    .trim()
    .optional(),
  college_id: z.union([z.number(), z.string()]).optional().default(1),
  cohort_id: z.union([z.number(), z.string()]).optional(),
  section_id: z.union([z.number(), z.string()]).optional(),
  section: z.string().optional(),
  mobile: z
    .string()
    .regex(/^\+?[0-9]{7,15}$/, 'Invalid mobile number')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number')
    .optional()
    .or(z.literal('')),
  password: strongPasswordSchema,
});

export const verifyStudentOtpSchema = z.object({
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  otp: z.string().min(4).max(10).optional(),
  token: z.string().min(8).optional(),
});

export const resendStudentOtpSchema = z.object({
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
});

export const studentLoginSchema = z.object({
  login: z.string().trim().optional(),
  roll_number: z.string().trim().optional(),
  email: z.string().trim().optional(),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z
  .object({
    email: z.string().trim().optional(),
    identifier: z.string().trim().optional(),
    username: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.email || data.identifier || data.username), {
    message: 'Valid identifier (email, username, or phone) is required',
  });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required').trim(),
    email: z.string().trim().optional(),
    identifier: z.string().trim().optional(),
    username: z.string().trim().optional(),
    new_password: strongPasswordSchema,
  })
  .refine((data) => Boolean(data.email || data.identifier || data.username), {
    message: 'Valid identifier or email is required',
  });

export const createStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  username: z.string().min(3, 'Username must be at least 3 characters').max(60).trim().optional(),
  email: z.string().email('Invalid email address').toLowerCase().trim().optional().or(z.literal('')),
  phone: z.string().max(30).trim().optional().or(z.literal('')),
  password: strongPasswordSchema.optional(),
  role: z.enum(['super_admin', 'admin', 'faculty', 'college_admin', 'inspector']),
  college_id: z.union([z.number(), z.string()]).nullable().optional(),
  sections: z.array(z.string()).optional(),
  assigned_sections: z.array(z.string()).optional(),
}).passthrough();

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
      .regex(/^[A-Za-z\s.'-]+$/, 'First name must contain only letters, spaces, dots, apostrophes, and hyphens')
      .transform((val) => val.charAt(0).toUpperCase() + val.slice(1)),
    last_name: z
      .string()
      .trim()
      .min(1, 'Last name must be at least 1 character')
      .regex(/^[A-Za-z\s.'-]+$/, 'Last name must contain only letters, spaces, dots, apostrophes, and hyphens')
      .transform((val) => val.charAt(0).toUpperCase() + val.slice(1)),
    college_id: z.string().trim().min(1, 'College affiliation is required'),
    college_name: z.string().trim().optional(),
    year_of_passing: z
      .union([z.number(), z.string()])
      .transform((val) => Number(val))
      .refine((val) => [2027, 2028, 2029, 2030].includes(val), {
        message: 'Year of passing must be one of 2027, 2028, 2029, 2030',
      }),
    roll_number: z
      .string()
      .trim()
      .min(2, 'Roll / Hall Ticket number is required')
      .max(30, 'Roll number cannot exceed 30 characters')
      .regex(/^[A-Za-z0-9\-_]+$/, 'Roll number must be alphanumeric (e.g. 22B91A0501)')
      .transform((val) => val.toUpperCase()),
    branch_code: z
      .string()
      .trim()
      .min(1, 'Branch code is required')
      .transform((val) => val.toUpperCase()),
    section: z
      .string()
      .trim()
      .transform((val) => val.toUpperCase())
      .refine((val) => ['A', 'B', 'C', 'D', 'E'].includes(val), {
        message: 'Section must be strictly one of A, B, C, D, E',
      }),
    batch: z.string().optional(),
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
    confirm_password: z.string().optional(),
    timestamp: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.confirm_password !== undefined && data.confirm_password !== null && data.confirm_password !== '') {
        return data.password === data.confirm_password;
      }
      return true;
    },
    {
      message: 'Confirm password must match password exactly',
      path: ['confirm_password'],
    }
  );

export const verifyExamEntrySchema = z
  .object({
    examCode: z.string().optional(),
    exam_code: z.string().optional(),
    hallTicket: z.string().optional(),
    hall_ticket: z.string().optional(),
    candidateName: z.string().optional(),
    name: z.string().optional(),
    studentName: z.string().optional(),
    deviceFingerprint: z.string().optional(),
  })
  .refine(
    (data) => Boolean((data.examCode && data.examCode.trim()) || (data.exam_code && data.exam_code.trim())) &&
              Boolean((data.hallTicket && data.hallTicket.trim()) || (data.hall_ticket && data.hall_ticket.trim())),
    { message: 'Both exam code and hall ticket are required' }
  );

export const saveExamCodeAnswerSchema = z.object({
  attemptId: z.string().optional(),
  candidateId: z.string().optional(),
  hallTicket: z.string().optional(),
  session_token: z.string().optional(),
  question_id: z.string().optional(),
  answer: z.any().optional(),
  answers: z.record(z.string(), z.any()).optional(),
  items: z.any().optional(),
  current_question_index: z.number().optional(),
});

export const submitExamCodeSchema = z.object({
  attemptId: z.string().optional(),
  candidateId: z.string().optional(),
  hallTicket: z.string().optional(),
  session_token: z.string().optional(),
  answers: z.any().optional(),
  codeAnswers: z.any().optional(),
  timeTakenSeconds: z.number().nonnegative().optional(),
  violationCount: z.number().int().nonnegative().optional(),
});

export const inspectorBroadcastSchema = z.object({
  examCode: z.string().min(1, 'examCode is required'),
  message: z.string().min(1, 'message is required'),
  priority: z.enum(['normal', 'urgent', 'critical']).optional(),
  inspectorName: z.string().optional(),
});

export const inspectorCandidateActionSchema = z.object({
  examCode: z.string().min(1, 'examCode is required'),
  hallTicket: z.string().min(1, 'hallTicket is required'),
  action: z.enum(['warn', 'whisper', 'pause', 'resume', 'extend_time', 'terminate']),
  message: z.string().optional(),
  seconds: z.number().optional(),
  inspectorName: z.string().optional(),
  studentEmail: z.string().email().optional().or(z.literal('')),
  studentName: z.string().optional(),
});

