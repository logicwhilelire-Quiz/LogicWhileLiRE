const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function applyMigration() {
  console.log('Applying staff login linking migration...');

  // Test which columns already exist
  const { error: colCheck } = await s.from('staff').select('username,phone,must_change_password').limit(1);
  if (!colCheck) {
    console.log('All columns already exist — migration already applied.');
    return;
  }
  console.log('Missing columns detected:', colCheck.message);

  // Apply via SQL using pg RPC or direct fetch
  const url = process.env.SUPABASE_URL + '/rest/v1/rpc/exec_sql';
  const sqlStatements = [
    "ALTER TABLE staff ADD COLUMN IF NOT EXISTS username TEXT",
    "ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone TEXT",
    "ALTER TABLE staff ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE",
  ];

  for (const stmt of sqlStatements) {
    console.log('Running:', stmt);
    const r = await s.rpc('exec_sql', { sql: stmt }).catch(e => ({ error: e }));
    if (r && r.error) {
      console.log('  -> RPC exec_sql not available:', r.error.message || r.error);
    } else {
      console.log('  -> OK');
    }
  }

  // Verify
  const { error: verifyErr } = await s.from('staff').select('username,phone,must_change_password').limit(1);
  if (!verifyErr) {
    console.log('SUCCESS: All columns now exist in staff table.');
  } else {
    console.log('FAILED: Columns still missing:', verifyErr.message);
    console.log('\n>>> Please run this SQL in your Supabase SQL Editor:');
    console.log('ALTER TABLE staff ADD COLUMN IF NOT EXISTS username TEXT;');
    console.log('ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone TEXT;');
    console.log('ALTER TABLE staff ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;');
  }
}

applyMigration().catch(console.error);
