import 'dotenv/config';
import readline from 'readline';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../db/supabase';

/**
 * LogicWhileLiRE — Create Super Admin Script
 * Usage:
 *   ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD=YourStrongPassword123 npm run create-admin
 *   npm run create-admin -- --email admin@yourdomain.com --password YourStrongPassword123
 *   npm run create-admin (interactive prompt)
 */

function parseArgs(): { email?: string; password?: string } {
  const args = process.argv.slice(2);
  const result: { email?: string; password?: string } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      result.email = args[i + 1];
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      result.password = args[i + 1];
      i++;
    }
  }
  return result;
}

function ask(rl: readline.Interface, query: string, hideInput = false): Promise<string> {
  return new Promise((resolve) => {
    if (!hideInput) {
      rl.question(query, (ans) => resolve(ans.trim()));
    } else {
      process.stdout.write(query);
      const onData = (char: Buffer) => {
        const c = char.toString('utf-8');
        if (c === '\n' || c === '\r' || c === '\u0004') {
          process.stdin.removeListener('data', onData);
        }
      };
      process.stdin.on('data', onData);
      rl.question('', (ans) => {
        resolve(ans.trim());
      });
    }
  });
}

export async function createAdmin(): Promise<void> {
  console.log('\n======================================================');
  console.log('🏛️  LogicWhileLiRE — Super Admin Account Provisioning');
  console.log('======================================================\n');

  const parsed = parseArgs();
  let email = parsed.email || process.env.ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL;
  let password = parsed.password || process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD;

  if (!email || !password) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (!email) {
      email = await ask(rl, 'Enter Super Admin Email: ');
    }
    if (!password) {
      password = await ask(rl, 'Enter Super Admin Password (min 12 chars): ', true);
    }

    rl.close();
  }

  // 1. Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    console.error('❌ Error: A valid email address is required.');
    process.exit(1);
  }
  const normalizedEmail = email.trim().toLowerCase();

  // 2. Validate password
  if (!password || password.length < 12) {
    console.error('❌ Error: Super Admin password must be at least 12 characters long.');
    process.exit(1);
  }

  const weakPasswords = ['admin123', 'admin', 'password', 'changeme', 'secret123456', 'logicwhilelire'];
  if (weakPasswords.some((w) => password.toLowerCase().includes(w))) {
    console.error('❌ Error: Password contains a weak or default pattern. Choose a stronger passphrase.');
    process.exit(1);
  }

  // 3. Check if admin with this email already exists
  const { data: existingStaff, error: queryError } = await supabase
    .from('staff')
    .select('id, email, role')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (queryError) {
    console.error('❌ Database error while querying existing staff:', queryError.message);
    process.exit(1);
  }

  if (existingStaff) {
    console.error(`❌ Error: Account with email "${normalizedEmail}" already exists (Role: ${existingStaff.role}). Refusing to overwrite.`);
    process.exit(1);
  }

  // 4. Hash password with bcrypt 12 rounds
  console.log('🔒 Generating bcrypt salt and hashing password with 12 rounds...');
  const passwordHash = await bcrypt.hash(password, 12);

  // 5. Insert new Super Admin
  const adminId = `st000000-${uuidv4().slice(9)}`;
  const { error: insertError } = await supabase.from('staff').insert({
    id: adminId,
    name: 'Super Administrator',
    email: normalizedEmail,
    password_hash: passwordHash,
    role: 'super_admin',
    is_active: true,
    created_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error('❌ Failed to insert Super Admin account:', insertError.message);
    process.exit(1);
  }

  console.log('\n🎉 SUCCESS: Super Admin created successfully!');
  console.log(`   • ID:    ${adminId}`);
  console.log(`   • Email: ${normalizedEmail}`);
  console.log(`   • Role:  super_admin`);
  console.log('======================================================\n');
}

if (require.main === module) {
  createAdmin().catch((err) => {
    console.error('❌ Fatal error creating admin:', err);
    process.exit(1);
  });
}
