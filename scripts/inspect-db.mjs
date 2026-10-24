import { createClient } from '../server/node_modules/@supabase/supabase-js/dist/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envLines = fs.readFileSync(path.resolve(__dirname, '../server/.env'), 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: ec, error: errEc } = await sb.from('exam_codes').select('*').limit(1);
  console.log('--- exam_codes ---');
  console.log(ec || errEc);

  const { data: ex, error: errEx } = await sb.from('exams').select('*').limit(1);
  console.log('--- exams ---');
  console.log(ex || errEx);
}

run();
