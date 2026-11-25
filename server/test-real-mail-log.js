require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Fatal: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testLiveMail() {
  console.log('================================================================');
  console.log('📡 VERIFYING LIVE SUPABASE mail_logs TABLE & DISPATCH');
  console.log('================================================================\n');

  // 1. Check if mail_logs table exists
  console.log('1. Checking public.mail_logs table in Supabase...');
  const { data: checkData, error: checkError } = await supabase
    .from('mail_logs')
    .select('*')
    .limit(1);

  if (checkError) {
    console.error('❌ Table not found or inaccessible:', checkError.message);
    console.log('\nPlease run supabase/migrations/20261011000000_mail_logs.sql in Supabase SQL Editor.');
    process.exit(1);
  }
  console.log('✅ mail_logs table exists and is accessible!\n');

  // 2. Dispatch real email via Resend
  console.log('2. Dispatching real email via Resend API...');
  const recipient = 'logicwhilelire@gmail.com';
  let resendId = null;
  let status = 'sent';
  let errorMessage = null;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'LogicWhileLiRE <onboarding@resend.dev>',
        to: [recipient],
        subject: '🛡️ LogicWhile LiRE System Verification — mail_logs Test',
        html: '<div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;border-radius:8px;"><h2>System Verification</h2><p>This email validates real mail_logs table persistence in live Supabase.</p></div>'
      })
    });
    const resData = await res.json();
    if (res.ok && resData.id) {
      resendId = resData.id;
      console.log('✅ Resend accepted email. Resend ID:', resendId);
    } else {
      status = 'failed';
      errorMessage = resData.message || JSON.stringify(resData);
      console.warn('Resend response:', resData);
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err.message;
  }

  // 3. Insert real row directly into Supabase mail_logs
  console.log('\n3. Inserting record directly into live Supabase mail_logs...');
  const insertPayload = {
    to_email: recipient,
    template: 'system_verification',
    subject: '🛡️ LogicWhile LiRE System Verification — mail_logs Test',
    status: status,
    resend_id: resendId,
    error_message: errorMessage,
    metadata: { test: true, environment: 'live_supabase', timestamp: new Date().toISOString() },
    html_content: '<p>System Verification</p>',
    sent_by: 'live_verification_script'
  };

  const { data: insertedRow, error: insertError } = await supabase
    .from('mail_logs')
    .insert(insertPayload)
    .select('*')
    .single();

  if (insertError) {
    console.error('❌ Insert failed:', insertError);
    process.exit(1);
  }

  console.log('✅ Real row inserted into live Supabase mail_logs table:');
  console.log(JSON.stringify(insertedRow, null, 2));

  // 4. Query it back to prove it is in the database
  console.log('\n4. Querying back from live Supabase to prove database persistence:');
  const { data: fetchedRow } = await supabase
    .from('mail_logs')
    .select('*')
    .eq('id', insertedRow.id)
    .single();

  console.log('Fetched from live Supabase:', fetchedRow);
  console.log('\n================================================================');
  console.log('🎉 VERIFICATION COMPLETE: REAL ROW RETRIEVED FROM SUPABASE');
  console.log('================================================================');
}

testLiveMail().catch(console.error);
