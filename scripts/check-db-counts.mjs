import { createClient } from '../server/node_modules/@supabase/supabase-js/dist/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../server/.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    const trimmed = l.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const tables = ['staff', 'students', 'student_roster', 'colleges', 'academic_years', 'cohorts', 'sections', 'batches', 'exams', 'questions', 'results', 'violations', 'audit_log', 'email_queue'];
  console.log('=== REAL SUPABASE DATABASE RECORD COUNTS ===');
  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) console.log(`${table}: Error - ${error.message}`);
      else console.log(`${table}: ${count} records`);
    } catch (e) {
      console.log(`${table}: Exception - ${e.message}`);
    }
  }

  // Also check staff emails
  const { data: staffList } = await supabase.from('staff').select('id, username, email, role, must_change_password');
  console.log('\n=== STAFF ACCOUNTS ===');
  console.log(staffList);

  // Check colleges
  const { data: collegesList } = await supabase.from('colleges').select('id, name, code');
  console.log('\n=== COLLEGES ===');
  console.log(collegesList);
}

check();
