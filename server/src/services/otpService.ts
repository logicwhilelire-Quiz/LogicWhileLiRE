import crypto from 'crypto';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;
const OTP_TTL_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);
const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;

/**
 * Generate a cryptographically random 6-digit OTP string.
 */
export function generateOtp(): string {
  // Use crypto to get a random number in 0-999999, zero-padded to 6 digits
  const num = crypto.randomInt(0, 1_000_000);
  return num.toString().padStart(6, '0');
}

/**
 * Hash an OTP for storage using bcrypt.
 * We store only the hash in the DB — never the raw OTP.
 */
export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, BCRYPT_ROUNDS);
}

/**
 * Verify a raw OTP against a stored bcrypt hash.
 */
export async function verifyOtp(rawOtp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(rawOtp, hash);
}

/**
 * Compute OTP expiration timestamp.
 */
export function otpExpiresAt(): Date {
  return new Date(Date.now() + OTP_TTL_MS);
}

/**
 * Check whether a stored OTP expiration date has passed.
 */
export function isOtpExpired(expiresAt: string | Date): boolean {
  return new Date(expiresAt) < new Date();
}
