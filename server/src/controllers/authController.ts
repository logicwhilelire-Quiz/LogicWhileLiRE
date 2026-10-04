import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase';
import { sendPasswordResetEmail, sendStudentVerificationEmail } from '../services/emailService';
import { StudentJWTPayload } from '../middleware/auth';

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
 * Student account self-registration with roster verification and OTP activation
 * - Checks admin-uploaded roster for matching college and section
 * - Enforces composite uniqueness (college_id, roll_number)
 * - Sends 6-digit OTP and activation link via email
 */
export async function studentRegister(req: Request, res: Response): Promise<void> {
  const {
    name,
    full_name,
    roll_number,
    hall_ticket,
    college_id,
    cohort_id,
    section_id,
    section,
    email,
    phone,
    mobile,
    password,
  } = req.body;

  const rawName = (name || full_name || '').trim();
  const rawRoll = (roll_number || hall_ticket || '').trim().toUpperCase();
  const normalizedEmail = (email || '').toLowerCase().trim();
  const contactPhone = (phone || mobile || '').trim();
  const collegeId = college_id !== undefined && college_id !== null ? String(college_id) : '1';
  const requestedSection = (section || section_id || '').trim();

  if (!normalizedEmail || !rawRoll || !password) {
    res.status(400).json({
      success: false,
      error: 'Full name, roll number, college, section, email, and password are required.',
    });
    return;
  }

  // 0. College Registration Toggle Check: Verify registration is enabled for this college
  const { data: collegeRecord } = await supabase
    .from('colleges')
    .select('id, college_name, is_active, registration_enabled')
    .eq('id', collegeId)
    .maybeSingle();

  if (collegeRecord && (collegeRecord.registration_enabled === false || collegeRecord.is_active === false)) {
    res.status(403).json({
      success: false,
      error: `Student registration is currently disabled for ${collegeRecord.college_name || 'this college'}. Please contact your administrator.`,
      code: 'COLLEGE_REGISTRATION_DISABLED',
    });
    return;
  }

  // 1. Roster Validation: Must exist in admin-uploaded roster for that college
  const { data: rosterEntries } = await supabase
    .from('student_roster')
    .select('*')
    .eq('college_id', collegeId);

  let rosterMatch = (rosterEntries || []).find(
    (r: any) => String(r.roll_number || '').trim().toUpperCase() === rawRoll
  );

  // Fallback: check students table for pre-imported roster students
  if (!rosterMatch) {
    const { data: preStudents } = await supabase
      .from('students')
      .select('*')
      .eq('college_id', collegeId);

    const matchedPre = (preStudents || []).find(
      (s: any) => (s.roll_number || s.hall_ticket || '').trim().toUpperCase() === rawRoll
    );
    if (matchedPre) {
      rosterMatch = matchedPre;
    }
  }

  if (!rosterMatch) {
    res.status(403).json({
      success: false,
      error: `Registration rejected: Roll number "${rawRoll}" is not on the approved student roster for this college. Please contact your college administrator to be added to the roster before registering.`,
      code: 'ROSTER_ROLL_NOT_FOUND',
    });
    return;
  }

  // Section check: If section is specified on roster and requested by user, verify match
  const rosterSection = (rosterMatch.section || rosterMatch.section_id || '').trim().toUpperCase();
  if (requestedSection && rosterSection) {
    const reqSecUpper = requestedSection.toUpperCase();
    if (
      reqSecUpper !== rosterSection &&
      !rosterSection.includes(reqSecUpper) &&
      !reqSecUpper.includes(rosterSection)
    ) {
      res.status(400).json({
        success: false,
        error: `Selected section "${requestedSection}" does not match the approved roster section ("${rosterSection}") for roll number ${rawRoll}. Please choose section ${rosterSection}.`,
        code: 'ROSTER_SECTION_MISMATCH',
      });
      return;
    }
  }

  // 2. Composite unique check: (college_id, roll_number)
  const { data: existingRollStudents } = await supabase
    .from('students')
    .select('id, email, roll_number, hall_ticket, is_verified, is_active')
    .eq('college_id', collegeId);

  const duplicateRollStudent = (existingRollStudents || []).find(
    (s: any) =>
      (s.roll_number || s.hall_ticket || '').trim().toUpperCase() === rawRoll &&
      s.is_verified !== false
  );

  if (duplicateRollStudent) {
    res.status(409).json({
      success: false,
      error: `A student account with roll number "${rawRoll}" is already registered and verified at this college. Please log in or reset your password.`,
      code: 'DUPLICATE_COLLEGE_ROLL',
    });
    return;
  }

  // 3. Email uniqueness check
  const { data: existingEmail } = await supabase
    .from('students')
    .select('id, email, is_verified')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingEmail && existingEmail.is_verified !== false) {
    res.status(409).json({
      success: false,
      error: 'An account with this email address already exists. Please log in or reset your password.',
      code: 'DUPLICATE_EMAIL',
    });
    return;
  }

  // 4. Clean up any prior unverified registration attempt for this email to allow fresh registration
  if (existingEmail && existingEmail.is_verified === false) {
    await supabase.from('students').delete().eq('id', existingEmail.id);
  }

  // 5. Generate 6-digit OTP and 32-byte direct verification token (15-min expiry)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const studentName = rawName || rosterMatch.name || rawRoll;
  const firstName = studentName.split(' ')[0] || '';
  const lastName = studentName.split(' ').slice(1).join(' ') || '';

  // 6. Insert new student as unverified & inactive until OTP/email link is completed
  const { data: newStudent, error: insertError } = await supabase
    .from('students')
    .insert({
      name: studentName,
      first_name: firstName,
      last_name: lastName,
      email: normalizedEmail,
      roll_number: rawRoll,
      hall_ticket: rawRoll,
      college_id: collegeId,
      college_name: rosterMatch.college_name || null,
      academic_year_id: rosterMatch.academic_year_id || null,
      cohort_id: cohort_id || rosterMatch.cohort_id || null,
      section_id: section_id || rosterMatch.section_id || null,
      section: rosterSection || requestedSection || null,
      batch_id: rosterMatch.batch_id || null,
      batch: rosterMatch.batch || null,
      mobile: contactPhone || rosterMatch.mobile || null,
      contact_number: contactPhone || rosterMatch.mobile || null,
      password_hash: passwordHash,
      failed_attempts: 0,
      locked_until: null,
      is_active: false,
      is_verified: false,
      verification_otp: otp,
      verification_token: rawToken,
      verification_expires_at: expiresAt,
      must_change_password: false,
    })
    .select()
    .single();

  if (insertError || !newStudent) {
    console.error('[Student Register] DB Insert Error:', insertError);
    if ((insertError as any)?.code === '23505' || String((insertError as any)?.message).includes('uq_college_roll')) {
      res.status(409).json({
        success: false,
        error: `A student account with roll number "${rawRoll}" is already registered at this college.`,
        code: 'DUPLICATE_COLLEGE_ROLL',
      });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create student registration. Please try again.' });
    return;
  }

  // 7. Dispatch verification email with OTP and direct activation link
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const verifyLink = `${clientOrigin}/verify-email?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

  try {
    await sendStudentVerificationEmail(normalizedEmail, studentName, otp, verifyLink);
  } catch (emailErr) {
    console.warn('[Student Register] Verification email delivery warning:', emailErr);
  }

  res.status(201).json({
    success: true,
    message: 'Registration initiated successfully. A 6-digit verification code and activation link have been sent to your email address.',
    requires_verification: true,
    email: normalizedEmail,
    roll_number: rawRoll,
    ...(process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true'
      ? { demo_otp: otp, demo_verify_link: verifyLink, demo_token: rawToken }
      : {}),
  });
}

/**
 * POST /api/auth/verify-registration-otp
 * Verify 6-digit OTP or token to activate student account
 */
export async function verifyRegistrationOtp(req: Request, res: Response): Promise<void> {
  const { email, otp, token } = req.body;
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (!normalizedEmail || (!otp && !token)) {
    res.status(400).json({ success: false, error: 'Email and verification OTP or token are required.' });
    return;
  }

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!student) {
    res.status(404).json({ success: false, error: 'No student registration found with that email address.' });
    return;
  }

  if (student.is_verified) {
    res.status(200).json({
      success: true,
      message: 'Account is already verified. You may proceed to log in.',
      already_verified: true,
    });
    return;
  }

  if (student.verification_expires_at && new Date(student.verification_expires_at) < new Date()) {
    res.status(400).json({
      success: false,
      error: 'Verification code or link has expired (15-minute limit). Please request a new code.',
      code: 'VERIFICATION_EXPIRED',
    });
    return;
  }

  const otpMatches = otp && String(student.verification_otp).trim() === String(otp).trim();
  const tokenMatches = token && String(student.verification_token).trim() === String(token).trim();

  if (!otpMatches && !tokenMatches) {
    res.status(400).json({
      success: false,
      error: 'Invalid verification code or link. Please verify the code and try again.',
      code: 'INVALID_VERIFICATION_CODE',
    });
    return;
  }

  // Activate account and assign single active session ID
  const activeSessionId = crypto.randomUUID();

  await supabase
    .from('students')
    .update({
      is_verified: true,
      is_active: true,
      verification_otp: null,
      verification_token: null,
      verification_expires_at: null,
      active_session_id: activeSessionId,
      failed_attempts: 0,
      locked_until: null,
    })
    .eq('id', student.id);

  const payload: StudentJWTPayload = {
    studentId: student.id,
    name: student.name,
    email: student.email,
    hallTicket: student.roll_number || student.hall_ticket,
    role: 'student',
    sessionId: activeSessionId,
    must_change_password: Boolean(student.must_change_password),
  };

  const jwtToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: STUDENT_JWT_EXPIRY });
  setStudentCookie(res, jwtToken);

  res.status(200).json({
    success: true,
    message: 'Account verified and activated successfully!',
    token: jwtToken,
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      roll_number: student.roll_number || student.hall_ticket,
      hall_ticket: student.roll_number || student.hall_ticket,
      college_id: student.college_id,
      section: student.section,
      batch: student.batch,
    },
  });
}

/**
 * POST /api/auth/resend-registration-otp
 * Resend a fresh 6-digit verification OTP and activation link
 */
export async function resendRegistrationOtp(req: Request, res: Response): Promise<void> {
  const { email } = req.body;
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (!normalizedEmail) {
    res.status(400).json({ success: false, error: 'Email address is required.' });
    return;
  }

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!student) {
    res.status(404).json({ success: false, error: 'No registration found with that email address.' });
    return;
  }

  if (student.is_verified) {
    res.status(200).json({
      success: true,
      message: 'Account is already verified. Please sign in.',
      already_verified: true,
    });
    return;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await supabase
    .from('students')
    .update({
      verification_otp: otp,
      verification_token: rawToken,
      verification_expires_at: expiresAt,
    })
    .eq('id', student.id);

  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const verifyLink = `${clientOrigin}/verify-email?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

  try {
    await sendStudentVerificationEmail(normalizedEmail, student.name, otp, verifyLink);
  } catch (emailErr) {
    console.warn('[Resend OTP] Failed to send email:', emailErr);
  }

  res.status(200).json({
    success: true,
    message: 'A new 6-digit verification code has been dispatched to your email.',
    ...(process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true'
      ? { demo_otp: otp, demo_verify_link: verifyLink, demo_token: rawToken }
      : {}),
  });
}

/**
 * POST /api/auth/login
 * Student login (email or roll number + password)
 * - Implements 5-attempt lockout (15 minutes, HTTP 423)
 * - Requires verified account before login
 * - Strictly enforces single active session per student
 */
export async function studentLogin(req: Request, res: Response): Promise<void> {
  const { login, roll_number, email, password } = req.body;
  const rawLogin = (login || roll_number || email || '').trim();

  if (!rawLogin || !password) {
    res.status(400).json({ success: false, error: 'Email or roll number and password are required' });
    return;
  }

  // Find by email or roll_number/hall_ticket
  let { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('email', rawLogin.toLowerCase())
    .maybeSingle();

  if (!student) {
    const { data: byRoll } = await supabase
      .from('students')
      .select('*')
      .eq('roll_number', rawLogin.toUpperCase())
      .maybeSingle();
    student = byRoll;
  }

  if (!student) {
    const { data: byHallTicket } = await supabase
      .from('students')
      .select('*')
      .eq('hall_ticket', rawLogin.toUpperCase())
      .maybeSingle();
    student = byHallTicket;
  }

  if (!student) {
    res.status(401).json({ success: false, error: 'Invalid email/roll number or password' });
    return;
  }

  // Check verification requirement
  if (student.is_verified === false) {
    res.status(403).json({
      success: false,
      requires_verification: true,
      error: 'Your account email is not yet verified. Please enter the verification code sent to your email.',
      email: student.email,
    });
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
        error: `Invalid email/roll number or password. ${attemptsLeft} attempt(s) remaining before account lockout.`,
      });
      return;
    }
  }

  // SINGLE ACTIVE SESSION: Generate unique activeSessionId
  const activeSessionId = crypto.randomUUID();

  // Reset failed attempts and record activeSessionId on successful login
  await supabase
    .from('students')
    .update({ failed_attempts: 0, locked_until: null, active_session_id: activeSessionId })
    .eq('id', student.id);

  const payload: StudentJWTPayload = {
    studentId: student.id,
    name: student.name,
    email: student.email,
    hallTicket: student.roll_number || student.hall_ticket,
    role: 'student',
    sessionId: activeSessionId,
    must_change_password: Boolean(student.must_change_password),
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: STUDENT_JWT_EXPIRY });
  setStudentCookie(res, token);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    token,
    must_change_password: Boolean(student.must_change_password),
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      roll_number: student.roll_number || student.hall_ticket,
      hall_ticket: student.roll_number || student.hall_ticket,
      college_id: student.college_id,
      academic_year_id: student.academic_year_id,
      cohort_id: student.cohort_id,
      section_id: student.section_id,
      batch_id: student.batch_id,
      section: student.section,
      batch: student.batch,
      must_change_password: Boolean(student.must_change_password),
    },
  });
}

/**
 * GET /api/student/dashboard
 * Authenticated Student Dashboard:
 * Returns student profile, upcoming/available exams, past results, and calculated ranking
 */
export async function getStudentDashboard(req: Request, res: Response): Promise<void> {
  const studentPayload = req.student!;

  const { data: student } = await supabase
    .from('students')
    .select('id, name, email, roll_number, hall_ticket, mobile, college_id, college_name, academic_year_id, cohort_id, section_id, batch_id, section, batch, must_change_password, is_active, created_at')
    .eq('id', studentPayload.studentId)
    .single();

  if (!student) {
    res.status(404).json({ success: false, error: 'Student not found' });
    return;
  }

  // 1. Fetch upcoming exams matching student's college or universal exams
  const { data: allExams } = await supabase
    .from('exams')
    .select('id, title, duration_minutes, start_time, end_time, college_id, is_active, is_leaderboard_public')
    .eq('is_active', true);

  const studentCollegeId = String(student.college_id || '');
  const upcomingExams = (allExams || []).filter((exam: any) => {
    return !exam.college_id || String(exam.college_id) === studentCollegeId;
  });

  // 2. Fetch past results
  const rollNumber = (student.roll_number || student.hall_ticket || '').toUpperCase();
  const { data: allParticipants } = await supabase
    .from('participants')
    .select('id, exam_id, hall_ticket, email')
    .or(`email.eq.${student.email},hall_ticket.eq.${rollNumber}`);

  const participantIds = (allParticipants || []).map((p: any) => p.id);

  let pastResults: any[] = [];
  if (participantIds.length > 0) {
    const { data: results } = await supabase
      .from('results')
      .select('id, participant_id, total_score, max_score, normalized_score, correct_count, wrong_count, time_taken_seconds, graded_at')
      .in('participant_id', participantIds);

    pastResults = (results || []).map((r: any) => {
      const part = allParticipants?.find((p: any) => p.id === r.participant_id);
      const exam = allExams?.find((e: any) => e.id === part?.exam_id);
      return {
        ...r,
        exam_id: part?.exam_id,
        exam_title: exam?.title || 'Assessment',
        percentage: r.max_score > 0 ? Math.round((r.total_score / r.max_score) * 100) : r.normalized_score || 0,
      };
    });
  }

  // 3. Calculate rank & percentile
  const { data: allResults } = await supabase
    .from('results')
    .select('id, participant_id, total_score, normalized_score');

  const studentTotalScore = pastResults.reduce((acc, r) => acc + (r.normalized_score || r.total_score || 0), 0);
  const avgScore = pastResults.length > 0 ? Math.round(studentTotalScore / pastResults.length) : 0;

  let globalRank = 1;
  const totalStudents = Math.max(1, (allResults || []).length);

  for (const r of allResults || []) {
    if ((r.normalized_score || r.total_score || 0) > avgScore) {
      globalRank++;
    }
  }

  const percentile = totalStudents > 1
    ? Math.max(10, Math.min(99, Math.round(((totalStudents - globalRank + 1) / totalStudents) * 100)))
    : 100;

  res.json({
    success: true,
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      roll_number: student.roll_number || student.hall_ticket,
      hall_ticket: student.roll_number || student.hall_ticket,
      college_id: student.college_id,
      college_name: student.college_name,
      section: student.section,
      batch: student.batch,
    },
    upcoming_exams: upcomingExams,
    past_results: pastResults,
    rank: {
      college_rank: Math.min(globalRank, 15),
      overall_rank: globalRank,
      total_students: totalStudents,
      average_score: avgScore,
      percentile,
      exams_completed: pastResults.length,
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
    .select('id, name, email, hall_ticket, mobile, college_id, college_name, academic_year_id, cohort_id, section_id, batch_id, section, batch, must_change_password, is_active, created_at')
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
 * POST /api/auth/change-password
 * Change password for authenticated student (first login or user update)
 */
export async function changeStudentPassword(req: Request, res: Response): Promise<void> {
  const student = req.student;
  const { new_password, current_password } = req.body;

  if (!student || !student.studentId) {
    res.status(401).json({ success: false, error: 'Student authentication required' });
    return;
  }

  if (!new_password || String(new_password).length < 6) {
    res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
    return;
  }

  const { data: stRec } = await supabase.from('students').select('*').eq('id', student.studentId).maybeSingle();
  if (!stRec) {
    res.status(404).json({ success: false, error: 'Student account not found' });
    return;
  }

  if (current_password && stRec.password_hash) {
    const valid = await bcrypt.compare(current_password, stRec.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Current password does not match' });
      return;
    }
  }

  const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
  await supabase
    .from('students')
    .update({
      password_hash: newHash,
      must_change_password: false,
      failed_attempts: 0,
      locked_until: null,
    })
    .eq('id', student.studentId);

  const payload = {
    studentId: stRec.id,
    name: stRec.name,
    email: stRec.email,
    hallTicket: stRec.hall_ticket,
    role: 'student' as const,
    must_change_password: false,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: STUDENT_JWT_EXPIRY });
  setStudentCookie(res, token);

  res.json({
    success: true,
    message: 'Password updated successfully.',
    token,
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
      normalizedEmail === (process.env.ADMIN_USERNAME || '') ||
      (!!process.env.INITIAL_ADMIN_EMAIL && normalizedEmail === process.env.INITIAL_ADMIN_EMAIL)
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

  // Dev/demo only: print the reset link to stdout for local testing
  // NEVER log tokens in production — the link is delivered exclusively by email
  if (process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE !== 'false') {
    console.log(`\n==========================================\n🔑 [PASSWORD RESET LINK — DEV ONLY] User: ${user.email}\nLink: ${resetLink}\n==========================================\n`);
  }

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
