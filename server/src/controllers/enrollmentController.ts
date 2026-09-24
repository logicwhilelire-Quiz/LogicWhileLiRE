import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../db/supabase';
import { sendOtpEmail } from '../services/emailService';
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  otpExpiresAt,
  isOtpExpired,
} from '../services/otpService';

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = (process.env.JWT_EXPIRY || '3h') as any;

/**
 * POST /api/enroll/:examId
 * Step 1: Collect participant info, send OTP email.
 */
export async function enrollParticipant(req: Request, res: Response): Promise<void> {
  const { examId } = req.params;
  const { name, hall_ticket, mobile, email } = req.body;

  // 1. Verify exam exists and is active
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, title, is_active')
    .eq('id', examId)
    .single();

  if (examError || !exam) {
    res.status(404).json({ success: false, error: 'Exam not found' });
    return;
  }
  if (!exam.is_active) {
    res.status(400).json({ success: false, error: 'Enrollment is not open for this exam' });
    return;
  }

  // 2. Check for duplicate hall ticket enrollment
  const { data: existing } = await supabase
    .from('participants')
    .select('id, otp_verified')
    .eq('exam_id', examId)
    .eq('hall_ticket', hall_ticket)
    .single();

  if (existing?.otp_verified) {
    res.status(409).json({ success: false, error: 'This hall ticket is already enrolled' });
    return;
  }

  // 3. Generate and hash OTP
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = otpExpiresAt();

  // 4. Upsert participant (allow re-enrollment attempt before OTP verified)
  let participantId: string;

  if (existing && !existing.otp_verified) {
    // Update existing unverified participant with new OTP
    const { error: updateError } = await supabase
      .from('participants')
      .update({ otp_hash: otpHash, otp_expires_at: expiresAt.toISOString(), name, mobile, email })
      .eq('id', existing.id);

    if (updateError) {
      res.status(500).json({ success: false, error: 'Failed to update enrollment' });
      return;
    }
    participantId = existing.id;
  } else {
    // Create new participant
    const { data: newParticipant, error: insertError } = await supabase
      .from('participants')
      .insert({
        exam_id: examId,
        name,
        hall_ticket,
        mobile,
        email,
        otp_hash: otpHash,
        otp_expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        res.status(409).json({ success: false, error: 'This hall ticket is already enrolled' });
      } else {
        res.status(500).json({ success: false, error: 'Failed to create enrollment' });
      }
      return;
    }
    participantId = newParticipant.id;
  }

  // 5. Send OTP email (with retry and failure logging)
  try {
    await sendOtpEmail(email, name, otp, exam.title, exam.id);
  } catch (emailErr) {
    console.error('[Enrollment] Failed to send OTP email:', emailErr);
    res.status(500).json({ success: false, error: 'Failed to send OTP email. Please try again.' });
    return;
  }

  console.log(`\n==========================================\n🔑 [DEMO OTP] Recipient: ${email} | Code: ${otp}\n==========================================\n`);

  res.status(200).json({
    success: true,
    message: 'OTP sent to your email address. Please verify to complete enrollment.',
    participant_id: participantId,
    ...(process.env.NODE_ENV !== 'production' ? { demo_otp: otp } : {}),
  });
}

/**
 * POST /api/enroll/:examId/verify-otp
 * Step 2: Verify OTP, issue JWT session token.
 */
export async function verifyEnrollmentOtp(req: Request, res: Response): Promise<void> {
  const { examId } = req.params;
  const { participant_id, otp } = req.body;

  // 1. Fetch participant with OTP data
  const { data: participant, error } = await supabase
    .from('participants')
    .select('id, name, exam_id, otp_hash, otp_expires_at, otp_verified')
    .eq('id', participant_id)
    .eq('exam_id', examId)
    .single();

  if (error || !participant) {
    res.status(404).json({ success: false, error: 'Participant not found' });
    return;
  }

  if (participant.otp_verified) {
    res.status(409).json({ success: false, error: 'Already verified. Please start your exam.' });
    return;
  }

  if (!participant.otp_hash) {
    res.status(400).json({ success: false, error: 'No OTP found. Please re-enroll.' });
    return;
  }

  if (isOtpExpired(participant.otp_expires_at)) {
    res.status(400).json({ success: false, error: 'OTP has expired. Please re-enroll to get a new code.' });
    return;
  }

  const otpValid = await verifyOtp(otp, participant.otp_hash);
  if (!otpValid) {
    res.status(400).json({ success: false, error: 'Invalid OTP. Please try again.' });
    return;
  }

  // 2. Mark OTP verified and clear sensitive hash
  await supabase
    .from('participants')
    .update({ otp_verified: true, otp_hash: null, otp_expires_at: null })
    .eq('id', participant_id);

  // 3. Create exam session
  const sessionId = uuidv4();

  // Generate JWT
  const jwtPayload = {
    sessionId,
    participantId: participant.id,
    examId: participant.exam_id,
  };

  const rawToken = jwt.sign(jwtPayload, process.env.JWT_SECRET!, { expiresIn: JWT_EXPIRY });

  // Hash token for revocation protection using SHA-256 (constant-time, cryptographically secure for high-entropy JWTs)
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const { error: sessionError } = await supabase.from('exam_sessions').insert({
    id: sessionId,
    participant_id: participant.id,
    token_hash: tokenHash,
    status: 'not_started',
    ip_address: req.ip,
  });

  if (sessionError) {
    console.error('[Enrollment] Failed to create session:', sessionError);
    res.status(500).json({ success: false, error: 'Failed to create exam session' });
    return;
  }

  // 4. Set JWT in HttpOnly cookie (cross-domain compatible)
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('session_token', rawToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 4 * 60 * 60 * 1000, // 4 hours
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'Enrollment verified. You can now start your exam.',
    session_id: sessionId,
    participant_name: participant.name,
    token: rawToken,
  });
}
