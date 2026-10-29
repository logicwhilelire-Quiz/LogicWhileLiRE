require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStaffAuth() {
  const { data, error } = await supabase.from('staff').select('*').eq('email', 'logicwhilelire@gmail.com');
  if (error) {
    console.error(error);
    return;
  }
  const user = data[0];
  console.log('User in DB:', user?.email, user?.role, 'Hash length:', user?.password_hash?.length);

  const envPass = process.env.ADMIN_PASSWORD;
  const match = await bcrypt.compare(envPass, user.password_hash);
  console.log('Does process.env.ADMIN_PASSWORD match hash?', match);

  // Also check inspector
  const { data: inspData } = await supabase.from('staff').select('*').eq('email', 'inspector@logicwhilelire.com');
  const inspUser = inspData[0];
  const inspMatch = await bcrypt.compare(process.env.INSPECTOR_PASSWORD, inspUser.password_hash);
  console.log('Does process.env.INSPECTOR_PASSWORD match inspector hash?', inspMatch);
}

checkStaffAuth();
