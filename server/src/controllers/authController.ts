import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase';
import { sendPasswordResetEmail } from '../services/emailService';

const BCRYPT_ROUNDS = 12;
const STUDENT_JWT_EXPIRY = (process.env.STUDENT_JWT_EXPIRY || '24h') as any;

/**
 * Helper to set secure auth cookie
 */
function setStudentCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('student_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  });
}

/**
 * POST /api/auth/register
 * Student account registration
 */
export async function studentRegister(req: Request, res: Response): Promise<void> {
  const { name, email, hall_ticket, mobile, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedHallTicket = hall_ticket.toUpperCase().trim();

  // Check duplicate email
  const { data: existingEmail } = await supabase
    .from('students')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingEmail) {
    res.status(409).json({ success: false, error: 'An account with this email already exists' });
    return;
  }

  // Check duplicate hall ticket
  const { data: existingHallTicket } = await supabase
    .from('students')
    .select('id')
    .eq('hall_ticket', normalizedHallTicket)
    .maybeSingle();

  if (existingHallTicket) {
    res.status(409).json({ success: false, error: 'An account with this hall ticket number already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const { data: newStudent, error: insertError } = await supabase
    .from('students')
    .insert({
      name: name.trim(),
      email: normalizedEmail,
      hall_ticket: normalizedHallTicket,
      mobile: mobile ? mobile.trim() : null,
      password_hash: passwordHash,
      failed_attempts: 0,
      locked_until: null,
      is_active: true,
    })
    .select('id, name, email, hall_ticket, mobile')
    .single();

  if (insertError || !newStudent) {
    console.error('[Student Register] DB Error:', insertError);
    res.status(500).json({ success: false, error: 'Failed to create student account. Please try again.' });
    return;
  }

  const payload = {
    studentId: newStudent.id,
    name: newStudent.name,
    email: newStudent.email,
    hallTicket: newStudent.hall_ticket,
    role: 'student' as const,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: STUDENT_JWT_EXPIRY });
  setStudentCookie(res, token);

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    token,
    student: {
      id: newStudent.id,
      name: newStudent.name,
      email: newStudent.email,
      hall_ticket: newStudent.hall_ticket,
    },
  });
}

/**
 * POST /api/auth/login
 * Student login (email or hall ticket + password)
 * Implements 5-attempt rate limit and 15-minute account lockout
 */
export async function studentLogin(req: Request, res: Response): Promise<void> {
  const { login, password } = req.body;
  const normalizedLogin = login.trim();

  // Find by email or hall ticket
  let { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('email', normalizedLogin.toLowerCase())
    .maybeSingle();

  if (!student) {
    const { data: byHallTicket } = await supabase
      .from('students')
      .select('*')
      .eq('hall_ticket', normalizedLogin.toUpperCase())
      .maybeSingle();
    student = byHallTicket;
  }

  if (!student) {
    res.status(401).json({ success: false, error: 'Invalid email/hall ticket or password' });
    return;
  }

  if (!student.is_active) {
    res.status(403).json({
      success: false,
      error: 'Your account is deactivated. Please contact your administrator.',
    });
    return;
  }

  // Check account lockout
  if (student.locked_until) {
    const lockExpiry = new Date(student.locked_until);
    const now = new Date();
    if (lockExpiry > now) {
      const remainingMinutes = Math.ceil((lockExpiry.getTime() - now.getTime()) / (60 * 1000));
      res.status(423).json({
        success: false,
        locked: true,
        error: `Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in ${remainingMinutes} minute(s) or reset your password.`,
      });
      return;
    }
  }

  const passwordValid = await bcrypt.compare(password, student.password_hash);

  if (!passwordValid) {
    const newFailedAttempts = (student.failed_attempts || 0) + 1;
    if (newFailedAttempts >= 5) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await supabase
        .from('students')
        .update({ failed_attempts: newFailedAttempts, locked_until: lockUntil })
        .eq('id', student.id);

      res.status(423).json({
        success: false,
        locked: true,
        error: 'Account locked for 15 minutes due to 5 consecutive failed login attempts. Please reset your password or wait 15 minutes.',
      });
      return;
    } else {
      await supabase
        .from('students')
        .update({ failed_attempts: newFailedAttempts })
        .eq('id', student.id);

      const attemptsLeft = 5 - newFailedAttempts;
      res.status(401).json({
        success: false,
        error: `Invalid email/hall ticket or password. ${attemptsLeft} attempt(s) remaining before account lockout.`,
      });
      return;
    }
  }

  // Reset failed attempts on successful login
  if (student.failed_attempts > 0 || student.locked_until) {
    await supabase
      .from('students')
      .update({ failed_attempts: 0, locked_until: null })
      .eq('id', student.id);
  }

  const payload = {
    studentId: student.id,
    name: student.name,
    email: student.email,
    hallTicket: student.hall_ticket,
    role: 'student' as const,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: STUDENT_JWT_EXPIRY });
  setStudentCookie(res, token);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    token,
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      hall_ticket: student.hall_ticket,
    },
  });
}

/**
 * GET /api/auth/me
 * Get current authenticated student profile
 */
export async function getStudentMe(req: Request, res: Response): Promise<void> {
  const studentPayload = req.student!;

  const { data: student, error } = await supabase
    .from('students')
    .select('id, name, email, hall_ticket, mobile, is_active, created_at')
    .eq('id', studentPayload.studentId)
    .single();

  if (error || !student) {
    res.status(404).json({ success: false, error: 'Student not found' });
    return;
  }

  res.json({
    success: true,
    student,
  });
}

/**
 * POST /api/auth/forgot-password
 * Request a password reset email link (Students & Staff)
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Look up student or staff
  let user: any = null;
  let userType: 'student' | 'staff' = 'student';

  const { data: student } = await supabase
    .from('students')
    .select('id, name, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (student) {
    user = student;
    userType = 'student';
  } else {
    const { data: staff } = await supabase
      .from('staff')
      .select('id, name, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (staff) {
      user = staff;
      userType = 'staff';
    } else if (
      normalizedEmail === (process.env.ADMIN_USERNAME || 'admin@logicwhilelire.com') ||
      normalizedEmail === 'admin@logicwhilelire.com' ||
      normalizedEmail === 'admin@growthran.com'
    ) {
      // Bootstrap super admin account
      user = {
        id: 'st000000-0000-0000-0000-000000000001',
        name: 'System Super Admin',
        email: normalizedEmail,
      };
      userType = 'staff';
    }
  }

  // Security best practice: don't reveal if account exists
  if (!user) {
    res.status(200).json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been dispatched.',
    });
    return;
  }

  // 2. Generate cryptographically strong random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour validity

  // 3. Save hashed token in DB
  const table = userType === 'student' ? 'students' : 'staff';
  const { error: updateError } = await supabase
    .from(table)
    .update({
      reset_token_hash: tokenHash,
      reset_token_expires: expiresAt,
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('[Forgot Password] DB update error:', updateError);
  }

  // 4. Construct reset link
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const resetLink = `${clientOrigin}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

  // 5. Send branded email
  try {
    await sendPasswordResetEmail(user.email, user.name, resetLink);
  } catch (emailErr) {
    console.error('[Forgot Password] Email send failure:', emailErr);
  }

  console.log(`\n==========================================\n🔑 [PASSWORD RESET LINK] User: ${user.email}\nLink: ${resetLink}\n==========================================\n`);

  res.status(200).json({
    success: true,
    message: 'If an account exists with that email, a password reset link has been dispatched.',
    ...(process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true'
      ? { demo_reset_link: resetLink, demo_token: rawToken }
      : {}),
  });
}

/**
 * POST /api/auth/reset-password
 * Complete password reset using token from email link
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, email, new_password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  let user: any = null;
  let userType: 'student' | 'staff' = 'student';

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (student) {
    user = student;
    userType = 'student';
  } else {
    const { data: staff } = await supabase
      .from('staff')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (staff) {
      user = staff;
      userType = 'staff';
    }
  }

  if (!user || !user.reset_token_hash || !user.reset_token_expires) {
    res.status(400).json({
      success: false,
      error: 'Invalid or expired password reset link. Please request a new one.',
    });
    return;
  }

  // Verify expiry
  if (new Date(user.reset_token_expires) < new Date()) {
    res.status(400).json({
      success: false,
      error: 'Password reset link has expired. Please request a new one.',
    });
    return;
  }

  // Verify token hash
  const computedHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  if (computedHash !== user.reset_token_hash) {
    res.status(400).json({
      success: false,
      error: 'Invalid password reset token. Please request a new one.',
    });
    return;
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
  const table = userType === 'student' ? 'students' : 'staff';

  const { error: updateError } = await supabase
    .from(table)
    .update({
      password_hash: newPasswordHash,
      reset_token_hash: null,
      reset_token_expires: null,
      failed_attempts: 0,
      locked_until: null,
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('[Reset Password] DB Update failed:', updateError);
    res.status(500).json({ success: false, error: 'Failed to reset password. Please try again.' });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Your password has been reset successfully. You can now log in with your new password.',
  });
}

/**
 * POST /api/auth/logout
 * Log out and clear all cookies
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('student_token', { path: '/' });
  res.clearCookie('admin_token', { path: '/' });
  res.clearCookie('session_token', { path: '/' });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
}
