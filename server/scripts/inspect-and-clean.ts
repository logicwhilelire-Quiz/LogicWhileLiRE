import 'dotenv/config';
import { supabase } from '../src/db/supabase.ts';

async function main() {
  const { data: colleges, error: cErr } = await supabase.from('colleges').select('*').limit(2);
  console.log('Colleges sample:', colleges, 'Error:', cErr);
}

main();
