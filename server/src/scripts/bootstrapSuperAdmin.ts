import 'dotenv/config';
import readline from 'readline';
import bcrypt from 'bcrypt';
import qrcode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../db/supabase';
import {
  generateTotpSecret,
  encryptTotpSecret,
  generateTotpUri,
  generateBackupCodes,
} from '../utils/totp';

/**
 * LogicWhileLiRE — Interactive Super Admin Provisioning Script
 *
 * Requirements:
 * - Prompts interactively for credentials (zero hardcoded values)
 * - Masks password input with '*'
 * - Prompts for password confirmation
 * - Enforces password complexity (min 12 characters, upper, lower, number, special)
 * - Generates RFC 6238 TOTP 2FA secret (encrypted at rest)
 * - Generates 8 single-use emergency backup recovery codes
 * - Displays a scannable terminal QR code for Google Authenticator / Authy / 1Password
 * - Guarantees exactly ONE Super Admin exists in the database
 *
 * Usage:
 *   npx tsx src/scripts/bootstrapSuperAdmin.ts
 *   or: npm run bootstrap:admin
 */

function askText(rl: readline.Interface, query: string, defaultValue = ''): Promise<string> {
  return new Promise((resolve) => {
    const prompt = defaultValue ? `${query} [${defaultValue}]: ` : `${query}: `;
    rl.question(prompt, (answer) => {
      const trimmed = answer.trim();
      resolve(trimmed || defaultValue);
    });
  });
}

function askPassword(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(promptText);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.setRawMode) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';
    const onData = (ch: string) => {
      ch = ch.toString();
      switch (ch) {
        case '\n':
        case '\r':
        case '\u0004':
          if (stdin.setRawMode) {
            stdin.setRawMode(wasRaw || false);
          }
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          if (stdin.setRawMode) {
            stdin.setRawMode(wasRaw || false);
          }
          process.stdout.write('\nOperation cancelled by user.\n');
          process.exit(130);
          break;
        case '\u0008':
        case '\x7f': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          if (ch.length === 1 && ch.charCodeAt(0) >= 32) {
            password += ch;
            process.stdout.write('*');
          }
          break;
      }
    };
    stdin.on('data', onData);
  });
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 12) {
    return 'Password must be at least 12 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter (A-Z).';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter (a-z).';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number (0-9).';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one special character (!@#$%^&*...).';
  }
  const weakWords = ['password', 'admin', 'logicwhile', 'changeme', 'secret', '12345678'];
  for (const w of weakWords) {
    if (password.toLowerCase().includes(w)) {
      return `Password contains a predictable pattern ("${w}"). Please choose a stronger passphrase.`;
    }
  }
  return null;
}

export async function bootstrapSuperAdmin(): Promise<void> {
  console.log('\n===============================================================');
  console.log('🏛️   LogicWhileLiRE — Interactive Super Admin Provisioning');
  console.log('    Zero Hardcoded Credentials | Mandatory 2FA | Strict Single-Admin');
  console.log('===============================================================\n');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in server/.env');
    process.exit(1);
  }
  if (!process.env.TOTP_ENCRYPTION_KEY) {
    console.error('❌ Error: TOTP_ENCRYPTION_KEY must be set in server/.env to encrypt 2FA secrets.');
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // 1. Prompt for Email
    const emailInput = await askText(rl, 'Enter Super Admin Email', 'logicwhilelire@gmail.com');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput)) {
      console.error('\n❌ Error: Invalid email address format.');
      process.exit(1);
    }
    const email = emailInput.toLowerCase();

    // 2. Prompt for Name
    const name = await askText(rl, 'Enter Administrator Full Name', 'Super Administrator');

    // Close readline before raw-mode password input
    rl.close();

    // 3. Prompt for Password
    let password = '';
    while (true) {
      password = await askPassword('Enter Super Admin Password (min 12 chars, mixed case, number, symbol): ');
      const err = validatePassword(password);
      if (err) {
        console.log(`❌ Invalid password: ${err}\nPlease try again.\n`);
        continue;
      }

      const confirm = await askPassword('Confirm Password: ');
      if (password !== confirm) {
        console.log('❌ Passwords do not match. Please try again.\n');
        continue;
      }
      break;
    }

    console.log('\n🔍 Checking existing Super Admin accounts in database...');
    const { data: existingAdmins, error: queryErr } = await supabase
      .from('staff')
      .select('id, email, name, role, created_at')
      .eq('role', 'super_admin');

    if (queryErr) {
      console.error('❌ Database error checking staff accounts:', queryErr.message);
      process.exit(1);
    }

    let targetAdminId = uuidv4();
    if (existingAdmins && existingAdmins.length > 0) {
      console.log(`\n⚠️  Found ${existingAdmins.length} existing Super Admin account(s):`);
      for (const a of existingAdmins) {
        console.log(`   - ID: ${a.id} | Email: ${a.email} | Name: ${a.name}`);
      }

      // Open quick confirmation prompt
      const rlConfirm = readline.createInterface({ input: process.stdin, output: process.stdout });
      const confirmReplace = await askText(
        rlConfirm,
        '\nUpdate/Replace existing Super Admin to ensure ONE single Super Admin? (Y/n)',
        'Y'
      );
      rlConfirm.close();

      if (confirmReplace.toUpperCase() !== 'Y') {
        console.log('\nAborted. Existing Super Admin accounts were left untouched.');
        process.exit(0);
      }

      // Pick the primary ID to update, remove any spurious duplicates
      const match = existingAdmins.find(a => a.email === email);
      targetAdminId = match ? match.id : existingAdmins[0].id;

      const extras = existingAdmins.filter(a => a.id !== targetAdminId);
      for (const extra of extras) {
        console.log(`🗑️  Removing duplicate super admin record: ${extra.email} (${extra.id})`);
        await supabase.from('staff').delete().eq('id', extra.id);
      }
    }

    // 4. Hash password with bcrypt 12 rounds
    console.log('\n🔒 Hashing password with bcrypt (12 salt rounds)...');
    const passwordHash = await bcrypt.hash(password, 12);

    // 5. Generate fresh TOTP 2FA secret (RFC 6238)
    console.log('🛡️  Generating fresh TOTP 2FA secret (AES-256-CTR encrypted at rest)...');
    const totpPlainSecret = generateTotpSecret();
    const totpEncryptedSecret = encryptTotpSecret(totpPlainSecret);
    const otpauthUri = generateTotpUri(email, 'LogicWhileLiRE', totpPlainSecret);
    const backupCodes = generateBackupCodes(8);

    // 6. Write to database
    console.log('💾 Writing Super Admin record to database...');
    const { error: upsertErr } = await supabase.from('staff').upsert({
      id: targetAdminId,
      name,
      email,
      password_hash: passwordHash,
      role: 'super_admin',
      college_id: null,
      is_active: true,
      is_2fa_enabled: true,
      totp_secret: totpEncryptedSecret,
      two_factor_backup_codes: backupCodes.hashed,
      updated_at: new Date().toISOString(),
    });

    if (upsertErr) {
      console.error('❌ Failed to upsert Super Admin account:', upsertErr.message);
      process.exit(1);
    }

    // 7. Render terminal QR code
    console.log('\n===============================================================');
    console.log('🎉 SUCCESS: ONE Super Admin provisioned with 2FA enabled!');
    console.log('===============================================================');
    console.log(`   • ID:               ${targetAdminId}`);
    console.log(`   • Email:            ${email}`);
    console.log(`   • Role:             super_admin`);
    console.log(`   • 2FA Status:       MANDATORY TOTP ACTIVE`);
    console.log(`   • 2FA Base32 Key:   ${totpPlainSecret}`);
    console.log(`   • Authenticator URI: ${otpauthUri}\n`);

    console.log('📱 Scan this QR code with Google Authenticator, Authy, or 1Password:\n');
    const qrString = await qrcode.toString(otpauthUri, { type: 'terminal', small: true });
    console.log(qrString);

    console.log('\n🔐 Emergency Single-Use Backup Recovery Codes:');
    console.log('───────────────────────────────────────────────────────────────');
    backupCodes.plain.forEach((code, idx) => {
      console.log(`   [${idx + 1}]  ${code}`);
    });
    console.log('───────────────────────────────────────────────────────────────');
    console.log('⚠️  Store these 8 emergency backup codes in a secure vault.');
    console.log('    They allow recovery if your authenticator device is lost.');
    console.log('===============================================================\n');

  } catch (err: any) {
    rl.close();
    console.error('\n❌ Fatal error:', err.message || err);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrapSuperAdmin().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
