import crypto from 'crypto';
import QRCode from 'qrcode';

// Base32 RFC 4648 alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// ── AES-256-GCM encryption at rest with legacy AES-256-CTR migration path ────
const GCM_ALGORITHM = 'aes-256-gcm';
const GCM_IV_LENGTH = 12; // 96-bit IV standard for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

const CTR_ALGORITHM = 'aes-256-ctr';
const CTR_IV_LENGTH = 16;

function getDerivedKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('[TOTP] TOTP_ENCRYPTION_KEY environment variable is strictly required. Generate with: openssl rand -hex 32');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypts a plain-text TOTP secret for storage in the database using AES-256-GCM.
 * Format: gcm:iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptTotpSecret(plaintext: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a stored TOTP secret back to plaintext.
 * Seamlessly supports both:
 * 1. Current AES-256-GCM format (gcm:iv:tag:ciphertext)
 * 2. Legacy AES-256-CTR format (iv:ciphertext) for backward compatibility
 */
export function decryptTotpSecret(stored: string): string {
  if (!stored) throw new Error('[TOTP] Cannot decrypt empty secret');
  const key = getDerivedKey();

  // 1. AES-256-GCM format
  if (stored.startsWith('gcm:')) {
    const parts = stored.slice(4).split(':');
    if (parts.length !== 3) {
      throw new Error('[TOTP] Invalid GCM encrypted secret format. Expected gcm:iv:tag:ciphertext');
    }
    const [ivHex, tagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const cipherText = Buffer.from(cipherHex, 'hex');

    const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');
  }

  // 2. Backward compatibility: Legacy AES-256-CTR format (iv:ciphertext)
  const parts = stored.split(':');
  if (parts.length === 2 && parts[0].length === CTR_IV_LENGTH * 2) {
    const [ivHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const cipherText = Buffer.from(cipherHex, 'hex');
    const decipher = crypto.createDecipheriv(CTR_ALGORITHM, key, iv);
    return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');
  }

  throw new Error('[TOTP] Invalid or unsupported encrypted secret format');
}

/**
 * Returns true if the stored value is encrypted (AES-256-GCM or legacy CTR).
 */
export function isEncryptedTotpSecret(secret: string): boolean {
  if (!secret) return false;
  if (secret.startsWith('gcm:')) {
    const parts = secret.slice(4).split(':');
    return parts.length === 3 && parts[0].length === GCM_IV_LENGTH * 2 && parts[1].length === AUTH_TAG_LENGTH * 2;
  }
  const parts = secret.split(':');
  return parts.length === 2 && parts[0].length === CTR_IV_LENGTH * 2;
}

/**
 * Migration helper: converts any stored secret (CTR or plain base32) to AES-256-GCM.
 * If already AES-256-GCM, returns it unchanged.
 */
export function migrateTotpSecretToGcm(stored: string): string {
  if (!stored) return stored;
  if (stored.startsWith('gcm:')) {
    return stored;
  }
  const plain = resolvePlainSecret(stored);
  return encryptTotpSecret(plain);
}

/**
 * Resolves a secret to plaintext — decrypts if encrypted (GCM or CTR), returns as-is if plain base32.
 */
export function resolvePlainSecret(secret: string): string {
  return isEncryptedTotpSecret(secret) ? decryptTotpSecret(secret) : secret;
}

/**
 * Encode a Buffer to a Base32 string
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decode a Base32 string to a Buffer
 */
export function base32Decode(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate a random 20-byte Base32 secret for TOTP (160 bits, standard).
 * Returns both the plain secret and its encrypted form for DB storage.
 */
export function generateTotpSecret(): string {
  const randomBytes = crypto.randomBytes(20);
  return base32Encode(randomBytes);
}

/**
 * Generate an encrypted TOTP secret ready for DB storage.
 */
export function generateEncryptedTotpSecret(): { plain: string; encrypted: string } {
  const plain = generateTotpSecret();
  const encrypted = encryptTotpSecret(plain);
  return { plain, encrypted };
}

/**
 * Generate the standard otpauth:// URL for authenticator apps (Google Authenticator, Authy, etc.)
 */
export function generateTotpUri(username: string, issuer: string, secret: string): string {
  const encIssuer = encodeURIComponent(issuer);
  const encUser = encodeURIComponent(username);
  return `otpauth://totp/${encIssuer}:${encUser}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate a QR code as a data URL (PNG)
 */
export async function generateTotpQrDataUrl(username: string, issuerOrSecret: string, secret?: string): Promise<string> {
  const issuer = secret ? issuerOrSecret : 'LogicWhileLiRE';
  const sec = secret || issuerOrSecret;
  const plainSec = resolvePlainSecret(sec);
  const uri = generateTotpUri(username, issuer, plainSec);
  return await QRCode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 240,
    color: {
      dark: '#080E1F',
      light: '#FFFFFF',
    },
  });
}

/**
 * Calculate TOTP code for a given timestamp and secret (RFC 6238)
 */
export function calculateTotpCode(secret: string, timestampMs: number = Date.now()): string {
  const plainSecret = resolvePlainSecret(secret);
  const counter = Math.floor(timestampMs / 1000 / 30);
  const key = base32Decode(plainSecret);

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuf);
  const digest = hmac.digest();

  // Dynamic truncation (RFC 4226 section 5.4)
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify a 6-digit TOTP code with time-step tolerance (+/- window steps).
 * Accepts both plain-text and encrypted (iv:ciphertext) stored secrets.
 */
export function verifyTotpCode(code: string, secret: string, windowSteps: number = 1): boolean {
  if (!code || !secret) return false;
  const cleanedCode = code.trim();
  if (cleanedCode.length !== 6 || !/^\d{6}$/.test(cleanedCode)) return false;

  const now = Date.now();
  const stepMs = 30 * 1000;

  try {
    for (let i = -windowSteps; i <= windowSteps; i++) {
      const expected = calculateTotpCode(secret, now + i * stepMs);
      if (crypto.timingSafeEqual(Buffer.from(cleanedCode), Buffer.from(expected))) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Generate single-use backup recovery codes (8 × 10-char alphanumeric).
 * Returns plain (show once) and hashed (store in DB).
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
 * Verify and invalidate a backup code — returns updated codes array (with used code removed)
 * or null if the code was invalid.
 */
export function verifyAndConsumeBackupCode(hashedCodes: string[], userCode: string): string[] | null {
  const inputHash = crypto.createHash('sha256').update(userCode.trim().toUpperCase()).digest('hex');
  const idx = hashedCodes.indexOf(inputHash);
  if (idx < 0) return null;
  return hashedCodes.filter((_, i) => i !== idx);
}

export const generateTotpCode = calculateTotpCode;
export const generateTotpQrCode = generateTotpQrDataUrl;
