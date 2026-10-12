import 'dotenv/config';
import bcrypt from 'bcrypt';
import { supabase } from '../src/db/supabase';

async function verifyStaff() {
  const { data: staffList, error } = await supabase.from('staff').select('*');
  if (error) {
    console.error('Error fetching staff:', error);
    return;
  }

  console.log('Found staff:', staffList.length);
  for (const s of staffList) {
    const isNewAdminPass = await bcrypt.compare('Charansai@2366R', s.password_hash || '');
    const isNewInspectorPass = await bcrypt.compare('Charansai@2366C', s.password_hash || '');
    const isOldAdminPass = await bcrypt.compare('admin123', s.password_hash || '');
    const isOldInspectorPass = await bcrypt.compare('inspector123', s.password_hash || '');

    console.log(`Staff: ${s.username} (${s.email}, role: ${s.role})`);
    console.log(`  - Matches Charansai@2366R: ${isNewAdminPass}`);
    console.log(`  - Matches Charansai@2366C: ${isNewInspectorPass}`);
    console.log(`  - Matches admin123: ${isOldAdminPass}`);
    console.log(`  - Matches inspector123: ${isOldInspectorPass}`);
    console.log(`  - must_change_password: ${s.must_change_password}`);
  }
}

verifyStaff().catch(console.error);
