/**
 * scripts/seed-core-staff.mjs
 *
 * Idempotently seeds the two core staff accounts:
 *   1. Admin: admin@logicwhilelire.com (role: 'admin', username: 'admin')
 *   2. Inspector: inspector@logicwhilelire.com (role: 'inspector', username: 'inspector')
 *
 * Requirements:
 *   - Each account gets unique username, linked email + phone, must_change_password = true
 *   - Passwords come exclusively from env vars:
 *       ADMIN_INITIAL_PASSWORD (or fallback INITIAL_ADMIN_PASSWORD / ADMIN_PASSWORD)
 *       INSPECTOR_INITIAL_PASSWORD (or fallback INITIAL_INSPECTOR_PASSWORD)
 *   - NEVER prints passwords or keys in output/logs
 *   - Idempotent: skips existing accounts, NEVER deletes
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let createClient;
let bcrypt;

// Resolve @supabase/supabase-js and bcrypt whether run from root or server
try {
  const mod = await import('@supabase/supabase-js');
  createClient = mod.createClient;
} catch {
  const targetPath = pathToFileURL(path.resolve(__dirname, '../node_modules/@supabase/supabase-js/dist/index.mjs')).href;
  const mod = await import(targetPath);
  createClient = mod.createClient;
}

try {
  const mod = await import('bcrypt');
  bcrypt = mod.default || mod;
} catch {
  const targetPath = pathToFileURL(path.resolve(__dirname, '../node_modules/bcrypt/bcrypt.js')).href;
  const mod = await import(targetPath);
  bcrypt = mod.default || mod;
}

// Load .env from common relative paths if not already loaded
function loadEnv() {
  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'server', '.env'),
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env'),
    path.resolve(__dirname, '..', '..', 'server', '.env'),
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch {}
    }
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAccountExists(email, username) {
  // Check by email
  const { data: byEmail } = await supabase
    .from('staff')
    .select('id, email, role, permissions')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (byEmail) return byEmail;

  // Check by username column if present
  try {
    const { data: byUser } = await supabase
      .from('staff')
      .select('id, email, role, permissions')
      .ilike('username', username)
      .maybeSingle();
    if (byUser) return byUser;
  } catch {}

  // Check by permissions array containing user:<username>
  try {
    const { data: allStaff } = await supabase.from('staff').select('id, email, role, permissions');
    if (allStaff) {
      const match = allStaff.find(
        (s) => Array.isArray(s.permissions) && s.permissions.includes(`user:${username.toLowerCase()}`)
      );
      if (match) return match;
    }
  } catch {}

  return null;
}

async function insertStaffAccount({ name, email, username, phone, role, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const staffId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const insertPayload = {
    id: staffId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    username: username.trim().toLowerCase(),
    phone: phone.trim(),
    password_hash: passwordHash,
    role,
    must_change_password: true,
    is_active: true,
    failed_attempts: 0,
    locked_until: null,
    permissions: [
      `user:${username.trim().toLowerCase()}`,
      `phone:${phone.trim()}`,
      'must_change_password:true',
    ],
    created_at: nowIso,
  };

  const { error: err1 } = await supabase.from('staff').insert(insertPayload);
  if (!err1) {
    return { id: staffId, created: true };
  }

  // Graceful fallback if columns username/phone/must_change_password don't exist yet on remote schema
  const fallbackPayload = { ...insertPayload };
  delete fallbackPayload.username;
  delete fallbackPayload.phone;
  delete fallbackPayload.must_change_password;

  const { error: err2 } = await supabase.from('staff').insert(fallbackPayload);
  if (err2) {
    throw new Error(`Failed to insert ${role} account: ${err2.message}`);
  }

  return { id: staffId, created: true };
}

async function runSeed() {
  console.log('================================================================');
  console.log('🌱 SEED CORE STAFF ACCOUNTS (Admin & Inspector)');
  console.log('================================================================');

  const adminPassword =
    process.env.ADMIN_INITIAL_PASSWORD ||
    process.env.INITIAL_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD;

  const inspectorPassword =
    process.env.INSPECTOR_INITIAL_PASSWORD ||
    process.env.INITIAL_INSPECTOR_PASSWORD ||
    process.env.INSPECTOR_PASSWORD;

  if (!adminPassword) {
    console.error('❌ Error: ADMIN_INITIAL_PASSWORD (or INITIAL_ADMIN_PASSWORD) is required in env.');
    process.exit(1);
  }

  if (!inspectorPassword) {
    console.error('❌ Error: INSPECTOR_INITIAL_PASSWORD (or INITIAL_INSPECTOR_PASSWORD) is required in env.');
    process.exit(1);
  }

  // 1. Seed Admin
  const adminEmail = 'admin@logicwhilelire.com';
  const adminUsername = 'admin';
  const adminPhone = process.env.ADMIN_PHONE || '+910000000000';

  const existingAdmin = await checkAccountExists(adminEmail, adminUsername);
  if (existingAdmin) {
    console.log(`ℹ️ [Admin] Account ${adminEmail} (username: ${adminUsername}) already exists. Skipping.`);
  } else {
    const res = await insertStaffAccount({
      name: 'System Administrator',
      email: adminEmail,
      username: adminUsername,
      phone: adminPhone,
      role: 'admin',
      password: adminPassword,
    });
    console.log(`✅ [Admin] Created ${adminEmail} (ID: ${res.id}, username: ${adminUsername}, role: admin, must_change_password: true)`);
  }

  // 2. Seed Inspector
  const inspectorEmail = 'inspector@logicwhilelire.com';
  const inspectorUsername = 'inspector';
  const inspectorPhone = process.env.INSPECTOR_PHONE || '+910000000001';

  const existingInspector = await checkAccountExists(inspectorEmail, inspectorUsername);
  if (existingInspector) {
    console.log(`ℹ️ [Inspector] Account ${inspectorEmail} (username: ${inspectorUsername}) already exists. Skipping.`);
  } else {
    const res = await insertStaffAccount({
      name: 'Chief Exam Inspector',
      email: inspectorEmail,
      username: inspectorUsername,
      phone: inspectorPhone,
      role: 'inspector',
      password: inspectorPassword,
    });
    console.log(`✅ [Inspector] Created ${inspectorEmail} (ID: ${res.id}, username: ${inspectorUsername}, role: inspector, must_change_password: true)`);
  }

  console.log('================================================================');
  console.log('🎉 Core staff seed complete (Idempotent: 0 records deleted).');
  console.log('================================================================\n');
}

runSeed().catch((err) => {
  console.error('❌ Seed failed:', err.message || err);
  process.exit(1);
});
