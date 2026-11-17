const path = require('path');
const dotenv = require(path.resolve(__dirname, '../node_modules/dotenv'));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require(path.resolve(__dirname, '../node_modules/@supabase/supabase-js'));

const supabaseUrl = process.env.SUPABASE_URL || 'https://xhutjekdbyccscselzdy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectStudents() {
  const { data: students, error } = await supabase.from('students').select('id, name, roll_number, hall_ticket, email, college_id, section, branch, is_verified, is_active, password_hash').limit(25);
  if (error) {
    console.error('Error fetching students:', error);
    return;
  }
  console.log('Students count in DB:', students.length);
  students.forEach(s => {
    console.log(JSON.stringify({
      id: s.id,
      name: s.name,
      roll: s.roll_number,
      hall_ticket: s.hall_ticket,
      email: s.email,
      has_password: Boolean(s.password_hash && s.password_hash.length > 5),
      is_verified: s.is_verified,
      is_active: s.is_active,
    }));
  });
}

inspectStudents().catch(console.error);
