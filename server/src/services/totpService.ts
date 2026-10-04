/**
 * LogicWhileLiRE — TOTP 2FA Service
 * Mandatory for admin and inspector roles.
 * TOTP secrets are AES-256-CTR encrypted at rest using TOTP_ENCRYPTION_KEY env var.
 *
 * Uses otpauth-compliant base32 secrets (hotp/totp standard).
 * Compatible with: Google Authenticator, Authy, Bitwarden, and any RFC 6238 app.
 */

import crypto from 'crypto';

// ── Encryption config (AES-256-GCM with legacy AES-256-CTR fallback) ──────
const GCM_ALGORITHM = 'aes-256-gcm';
const GCM_IV_LENGTH = 12; // 96-bit IV for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

const CTR_ALGORITHM = 'aes-256-ctr';
const CTR_IV_LENGTH = 16;
const ENCODING = 'hex' as const;

function getDerivedKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY || '';
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[TOTP] TOTP_ENCRYPTION_KEY is required in production. Generate with: openssl rand -hex 32');
    }
    // Dev fallback — consistent deterministic key for local testing only
    return crypto.createHash('sha256').update('logicwhilelire_dev_totp_key_2026').digest();
  }
  // Derive a 32-byte key regardless of input length
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypts a plain-text TOTP secret using AES-256-GCM.
 * Format: gcm:iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptTotpSecret(plaintext: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm:${iv.toString(ENCODING)}:${tag.toString(ENCODING)}:${encrypted.toString(ENCODING)}`;
}

/**
 * Decrypts a stored TOTP secret back to plaintext.
 * Seamlessly supports AES-256-GCM and legacy AES-256-CTR formats.
 */
export function decryptTotpSecret(stored: string): string {
  if (!stored) throw new Error('[TOTP] Cannot decrypt empty secret');
  const key = getDerivedKey();

  // 1. AES-256-GCM
  if (stored.startsWith('gcm:')) {
    const parts = stored.slice(4).split(':');
    if (parts.length !== 3) {
      throw new Error('[TOTP] Invalid GCM encrypted secret format');
    }
    const [ivHex, tagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, ENCODING);
    const tag = Buffer.from(tagHex, ENCODING);
    const cipherText = Buffer.from(cipherHex, ENCODING);

    const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');
  }

  // 2. Legacy AES-256-CTR fallback
  const parts = stored.split(':');
  if (parts.length === 2 && parts[0].length === CTR_IV_LENGTH * 2) {
    const [ivHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, ENCODING);
    const cipherText = Buffer.from(cipherHex, ENCODING);
    const decipher = crypto.createDecipheriv(CTR_ALGORITHM, key, iv);
    return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');
  }

  throw new Error('[TOTP] Invalid or unsupported encrypted secret format');
}

/**
 * Detects whether a stored secret is already encrypted (GCM or legacy CTR).
 */
export function isEncryptedSecret(secret: string): boolean {
  if (!secret) return false;
  if (secret.startsWith('gcm:')) {
    const parts = secret.slice(4).split(':');
    return parts.length === 3 && parts[0].length === GCM_IV_LENGTH * 2 && parts[1].length === AUTH_TAG_LENGTH * 2;
  }
  const parts = secret.split(':');
  return parts.length === 2 && parts[0].length === CTR_IV_LENGTH * 2;
}

/**
 * Migration helper: converts any stored secret to AES-256-GCM format.
 */
export function migrateTotpSecretToGcm(stored: string): string {
  if (!stored || stored.startsWith('gcm:')) return stored;
  const plain = isEncryptedSecret(stored) ? decryptTotpSecret(stored) : stored;
  return encryptTotpSecret(plain);
}

// ── TOTP Generation ────────────────────────────────────────────────────────

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generates a cryptographically random base32-encoded TOTP secret (160 bits / 32 chars).
 * Returns { secret, otpauthUrl, qrDataUrl (placeholder \u2014 render on frontend) }
 */
export function generateTotpSecret(issuer: string, accountName: string): {
  secret: string;
  otpauthUrl: string;
  encryptedSecret: string;
} {
  // Generate 20 random bytes (160 bits) and base32-encode
  const raw = crypto.randomBytes(20);
  let secret = '';
  for (let i = 0; i < raw.length; i += 5) {
    const b0 = raw[i];
    const b1 = raw[i + 1] ?? 0;
    const b2 = raw[i + 2] ?? 0;
    const b3 = raw[i + 3] ?? 0;
    const b4 = raw[i + 4] ?? 0;
    secret += BASE32_CHARS[(b0 >> 3) & 0x1f];
    secret += BASE32_CHARS[((b0 & 0x07) << 2) | ((b1 >> 6) & 0x03)];
    secret += BASE32_CHARS[(b1 >> 1) & 0x1f];
    secret += BASE32_CHARS[((b1 & 0x01) << 4) | ((b2 >> 4) & 0x0f)];
    secret += BASE32_CHARS[((b2 & 0x0f) << 1) | ((b3 >> 7) & 0x01)];
    secret += BASE32_CHARS[(b3 >> 2) & 0x1f];
    secret += BASE32_CHARS[((b3 & 0x03) << 3) | ((b4 >> 5) & 0x07)];
    secret += BASE32_CHARS[b4 & 0x1f];
  }

  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  const otpauthUrl = `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  const encryptedSecret = encryptTotpSecret(secret);

  return { secret, otpauthUrl, encryptedSecret };
}

// ── TOTP Verification ──────────────────────────────────────────────────────

function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const c of clean) {
    const idx = BASE32_CHARS.indexOf(c);
    if (idx < 0) throw new Error(`[TOTP] Invalid base32 character: ${c}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function hotp(secret: Buffer, counter: bigint): string {
  const counterBuf = Buffer.alloc(8);
  // Write counter as big-endian 64-bit
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  const hmac = crypto.createHmac('sha1', secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP code against a (possibly encrypted) secret.
 * Accepts ±1 time window (30s tolerance for clock skew).
 */
export function verifyTotpCode(storedSecret: string, userCode: string): boolean {
  try {
    const plainSecret = isEncryptedSecret(storedSecret)
      ? decryptTotpSecret(storedSecret)
      : storedSecret;
    const secretBytes = base32Decode(plainSecret);
    const counter = BigInt(Math.floor(Date.now() / 30000));
    const clean = userCode.replace(/\s/g, '');
    // Check current window and ±1 adjacent windows
    for (let delta = -1n; delta <= 1n; delta++) {
      if (hotp(secretBytes, counter + delta) === clean) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Generates single-use backup recovery codes (8 × 8-char alphanumeric).
 * Returns both plain (to show user once) and hashed (for storage).
 */
export function generateBackupCodes(count = 8): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    plain.push(code);
    hashed.push(crypto.createHash('sha256').update(code).digest('hex'));
  }
  return { plain, hashed };
}

/**
 * Verifies and invalidates a backup code (returns the remaining hashed codes array
 * with the used code removed, or null if the code was invalid).
 */
export function verifyAndConsumeBackupCode(hashedCodes: string[], userCode: string): string[] | null {
  const inputHash = crypto.createHash('sha256').update(userCode.trim().toUpperCase()).digest('hex');
  const idx = hashedCodes.indexOf(inputHash);
  if (idx < 0) return null;
  return hashedCodes.filter((_, i) => i !== idx);
}
