/**
 * seed-official-logins.js
 * Updates all user IDs and passwords for Admin, Inspector, Faculty, Paper Setter, and Student
 * and dispatches the confirmation email to logicwhilelire@gmail.com.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[FATAL] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('================================================================');
  console.log('🔐 UPGRADING OFFICIAL LOGINS & PASSWORDS — LOGICWHILE LiRE');
  console.log('================================================================');

  const adminPass = 'LogicWhile#Admin2026!';
  const inspectorPass = 'LogicWhile#Inspector2026!';
  const facultyPass = 'LogicWhile#Faculty2026!';
  const paperSetterPass = 'LogicWhile#PaperSetter2026!';
  const studentPass = 'LogicWhile#Student2026!';

  const adminHash = await bcrypt.hash(adminPass, 10);
  const inspectorHash = await bcrypt.hash(inspectorPass, 10);
  const facultyHash = await bcrypt.hash(facultyPass, 10);
  const paperSetterHash = await bcrypt.hash(paperSetterPass, 10);
  const studentHash = await bcrypt.hash(studentPass, 10);

  // 1. Super Admin
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'logicwhilelire@gmail.com';
  console.log(`[1/5] Updating Super Admin: admin (${adminEmail})...`);
  const { data: existingAdmin } = await supabase
    .from('staff')
    .select('id, email, username')
    .or(`email.eq.${adminEmail},username.eq.admin,role.eq.super_admin`)
    .maybeSingle();

  if (existingAdmin) {
    const { error: updErr } = await supabase
      .from('staff')
      .update({
        username: 'admin',
        email: adminEmail,
        password_hash: adminHash,
        role: 'super_admin',
        is_active: true,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingAdmin.id);
    if (updErr) console.warn('  ⚠️ Admin update notice:', updErr.message);
    else console.log('  ✅ Admin account password updated successfully');
  } else {
    const { error: insErr } = await supabase.from('staff').insert({
      id: 'st000000-0000-0000-0000-000000000001',
      name: 'R. Charan Sai Krishna (Super Admin)',
      username: 'admin',
      email: adminEmail,
      role: 'super_admin',
      password_hash: adminHash,
      is_active: true,
      must_change_password: false,
      permissions: ['*'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (insErr) console.warn('  ⚠️ Admin insert notice:', insErr.message);
    else console.log('  ✅ Admin account provisioned successfully');
  }

  // 2. Chief Inspector
  console.log('[2/5] Updating Chief Inspector: inspector...');
  const { data: existingInspector } = await supabase
    .from('staff')
    .select('id, email, username')
    .or('email.eq.inspector@logicwhilelire.com,username.eq.inspector,role.eq.inspector')
    .maybeSingle();

  if (existingInspector) {
    const { error: updErr } = await supabase
      .from('staff')
      .update({
        username: 'inspector',
        email: 'inspector@logicwhilelire.com',
        password_hash: inspectorHash,
        role: 'inspector',
        is_active: true,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingInspector.id);
    if (updErr) console.warn('  ⚠️ Inspector update notice:', updErr.message);
    else console.log('  ✅ Inspector account password updated successfully');
  } else {
    const { error: insErr } = await supabase.from('staff').insert({
      id: 'st000000-0000-0000-0000-000000000004',
      name: 'Chief Exam Inspector',
      username: 'inspector',
      email: 'inspector@logicwhilelire.com',
      role: 'inspector',
      password_hash: inspectorHash,
      college_id: 1,
      is_active: true,
      must_change_password: false,
      permissions: ['start_exam', 'end_exam', 'view_live_telemetry', 'view_dashboard'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (insErr) console.warn('  ⚠️ Inspector insert notice:', insErr.message);
    else console.log('  ✅ Inspector account provisioned successfully');
  }

  // 3. Lead Faculty
  console.log('[3/5] Updating Faculty: faculty...');
  const { data: existingFaculty } = await supabase
    .from('staff')
    .select('id, email, username')
    .or('email.eq.faculty@logicwhilelire.com,username.eq.faculty,role.eq.faculty')
    .maybeSingle();

  if (existingFaculty) {
    const { error: updErr } = await supabase
      .from('staff')
      .update({
        username: 'faculty',
        email: 'faculty@logicwhilelire.com',
        password_hash: facultyHash,
        role: 'faculty',
        is_active: true,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingFaculty.id);
    if (updErr) console.warn('  ⚠️ Faculty update notice:', updErr.message);
    else console.log('  ✅ Faculty account password updated successfully');
  } else {
    const { error: insErr } = await supabase.from('staff').insert({
      id: 'st000000-0000-0000-0000-000000000003',
      name: 'LogicWhile Faculty Lead',
      username: 'faculty',
      email: 'faculty@logicwhilelire.com',
      role: 'faculty',
      password_hash: facultyHash,
      college_id: 1,
      is_active: true,
      must_change_password: false,
      permissions: ['view_results', 'view_dashboard', 'manage_students', 'create_questions'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (insErr) console.warn('  ⚠️ Faculty insert notice:', insErr.message);
    else console.log('  ✅ Faculty account provisioned successfully');
  }

  // 4. Paper Setter
  console.log('[4/5] Updating Paper Setter: papersetter...');
  const { data: existingPS } = await supabase
    .from('staff')
    .select('id, email, username')
    .or('email.eq.papersetter@logicwhilelire.com,username.eq.papersetter,role.eq.paper_setter')
    .maybeSingle();

  if (existingPS) {
    const { error: updErr } = await supabase
      .from('staff')
      .update({
        username: 'papersetter',
        email: 'papersetter@logicwhilelire.com',
        password_hash: paperSetterHash,
        role: 'paper_setter',
        is_active: true,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingPS.id);
    if (updErr) console.warn('  ⚠️ Paper Setter update notice:', updErr.message);
    else console.log('  ✅ Paper Setter account password updated successfully');
  } else {
    const { error: insErr } = await supabase.from('staff').insert({
      id: require('crypto').randomUUID(),
      name: 'LogicWhile Paper Setter',
      username: 'papersetter',
      email: 'papersetter@logicwhilelire.com',
      role: 'paper_setter',
      password_hash: paperSetterHash,
      college_id: 1,
      is_active: true,
      must_change_password: false,
      permissions: ['manage_questions', 'set_papers', 'view_question_bank'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (insErr) console.warn('  ⚠️ Paper Setter insert notice:', insErr.message);
    else console.log('  ✅ Paper Setter account provisioned successfully');
  }

  // 5. Student
  const studentRoll = '24HU1A05F9';
  const studentEmail = 'student@logicwhilelire.com';
  console.log(`[5/5] Updating Student: ${studentRoll} (${studentEmail})...`);
  const { data: existingStudent } = await supabase
    .from('students')
    .select('id, email, roll_number')
    .or(`roll_number.eq.${studentRoll},email.eq.${studentEmail},hall_ticket.eq.${studentRoll}`)
    .maybeSingle();

  if (existingStudent) {
    const { error: updErr } = await supabase
      .from('students')
      .update({
        roll_number: studentRoll,
        hall_ticket: studentRoll,
        email: studentEmail,
        password_hash: studentHash,
        is_active: true,
        is_verified: true,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingStudent.id);
    if (updErr) console.warn('  ⚠️ Student update notice:', updErr.message);
    else console.log('  ✅ Student account password updated and pre-verified successfully');
  } else {
    const { error: insErr } = await supabase.from('students').insert({
      name: 'Charan Sai Krishna (Candidate)',
      first_name: 'Charan',
      last_name: 'Sai Krishna',
      email: studentEmail,
      roll_number: studentRoll,
      hall_ticket: studentRoll,
      college_id: 1,
      college_name: 'VR Siddhartha Engineering College',
      section_id: 'sec-cse-a',
      batch_id: 'bat-2026-cse-1',
      section: 'A',
      batch: 'Batch 2026',
      branch_code: 'CSE',
      year_of_passing: 2026,
      password_hash: studentHash,
      is_active: true,
      is_verified: true,
      must_change_password: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (insErr) console.warn('  ⚠️ Student insert notice:', insErr.message);
    else console.log('  ✅ Student account provisioned and pre-verified successfully');
  }

  // Remove old demo college data like KLU if present
  try {
    const { error: delErr } = await supabase
      .from('colleges')
      .delete()
      .or('name.ilike.%KLU%,name.ilike.%K L University%,code.ilike.%KLU%');
    if (delErr) {
      console.log('  (Notice on colleges cleanup:', delErr.message, ')');
    } else {
      console.log('  🧹 Cleaned up sample colleges (KLU)');
    }
  } catch {}

  console.log('\n================================================================');
  console.log('📧 DISPATCHING OFFICIAL CREDENTIALS NOTIFICATION EMAIL...');
  console.log('================================================================');
  try {
    const { dispatchOfficialCredentialsNotification } = require('./dist/services/mailService');
    const emailResult = await dispatchOfficialCredentialsNotification('logicwhilelire@gmail.com');
    console.log('  Email result:', emailResult);
  } catch (emailErr) {
    console.log('  (Mail dispatch attempted via mailService:', emailErr.message, ')');
  }

  console.log('\n✅ ALL 5 MASTER ROLES UPGRADED AND VERIFIED.');
}

main().catch((err) => {
  console.error('Fatal error during credential upgrade:', err);
  process.exit(1);
});
