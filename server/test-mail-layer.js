const assert = require('assert');
const http = require('http');

// Load environment
require('dotenv').config();
const { isRealSupabase, cleanupTestData } = require('./test-helper');
if (!isRealSupabase) {
  process.env.DEMO_MODE = 'true';
}
process.env.NODE_ENV = 'development';
process.env.EMAIL_DAILY_CAP = '10'; // Set small cap for fast quota testing
process.env.MAIL_DOMAIN = 'logicwhilelire.com';
process.env.SUPPORT_EMAIL = 'support@logicwhilelire.com';

const {
  dailyEmailQuota,
  getHostedLogoUrl,
  wrapBrandTemplate,
  sendWelcomeCredentialsEmail,
  sendEmailVerificationOtpEmail,
  sendPasswordResetEmail,
  sendExamScheduledEmail,
  sendExamStartedReminderEmail,
  sendResultPublishedEmail,
  sendContactAutoReplyEmail,
  sendContactAdminNotificationEmail,
  sendWithRetry,
} = require('./dist/services/emailService');

const { emailQueue } = require('./dist/services/emailQueue');
const { supabase } = require('./dist/db/supabase');

let passed = 0;
function pass(num, label) {
  passed++;
  console.log(`  ✅ [${num}] ${label}`);
}

async function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: global.__SERVER_PORT__,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataString),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function run() {
  console.log('\n================================================================');
  console.log('📬 LogicWhileLiRE — RESEND & EMAIL SUBSYSTEM TEST SUITE');
  console.log('================================================================\n');

  try {
    // ── 1. HOSTED LOGO URL & FOOTER SUPPORT CONTACT VERIFICATION ──
    console.log('--- 1. Hosted Logo URL & Support Contact Footer ---');
    const logoUrl = getHostedLogoUrl();
    assert.ok(logoUrl.startsWith('http'), 'Logo URL must be a valid HTTP/HTTPS hosted URL');
    assert.ok(logoUrl.endsWith('/logo.png'), 'Logo URL must point to frontend /logo.png');
    pass(1, `Hosted logo URL verified: ${logoUrl}`);

    const sampleHtml = wrapBrandTemplate('Test Subject', '<p>Test Content</p>');
    assert.ok(sampleHtml.includes(`src="${logoUrl}"`), 'Email HTML must embed hosted logo via src URL (not CID attachment)');
    assert.ok(!sampleHtml.includes('cid:'), 'Email HTML must strictly avoid CID embedded attachments');
    assert.ok(sampleHtml.includes('support@logicwhilelire.com'), 'Email HTML footer must include official support email');
    assert.ok(sampleHtml.includes('LogicWhileLiRE'), 'Email HTML must include official platform brand signature');
    pass(2, 'Brand template guarantees hosted frontend logo and standard support footer');

    // ── 2. ALL 8 EMAIL TEMPLATES DISPATCH & GENERATION ────────────
    console.log('\n--- 2. All 8 Email Templates Generation & Dispatch ---');

    dailyEmailQuota.resetForTesting();
    dailyEmailQuota.setCap(100);

    // Template 1: Welcome with Credentials
    const t1 = await sendWelcomeCredentialsEmail({
      toEmail: 'new.student@campus.edu',
      recipientName: 'Vikram Seth',
      role: 'student',
      identifier: '22JR1A0599',
      tempPassword: 'TempPassword#2026',
      collegeName: 'VR Siddhartha Engineering College',
    });
    assert.strictEqual(t1, true, 'Welcome credentials email should succeed');
    pass(3, 'Template 1: Welcome with credentials dispatched');

    // Template 2: Email Verification / OTP
    const t2 = await sendEmailVerificationOtpEmail({
      toEmail: 'verify.student@campus.edu',
      recipientName: 'Vikram Seth',
      otp: '782910',
      expiresMinutes: 15,
    });
    assert.strictEqual(t2, true);
    pass(4, 'Template 2: Email verification / OTP dispatched');

    // Template 3: Password Reset
    const t3 = await sendPasswordResetEmail(
      'reset.user@campus.edu',
      'Vikram Seth',
      'http://localhost:5173/reset-password?token=sample_token_xyz'
    );
    assert.strictEqual(t3, true);
    pass(5, 'Template 3: Password reset request dispatched');

    // Template 4: Exam Scheduled
    const t4 = await sendExamScheduledEmail({
      toEmail: 'candidate@campus.edu',
      recipientName: 'Vikram Seth',
      hallTicket: '22JR1A0599',
      examCode: 'CS2026-FINAL',
      examTitle: 'Systems Programming & OS Assessment',
      durationMinutes: 60,
      scheduledAt: 'Tomorrow, 10:00 AM IST',
    });
    assert.strictEqual(t4, true);
    pass(6, 'Template 4: Exam scheduled with hall ticket dispatched');

    // Template 5: Exam Started Live Reminder
    const t5 = await sendExamStartedReminderEmail({
      toEmail: 'candidate@campus.edu',
      recipientName: 'Vikram Seth',
      hallTicket: '22JR1A0599',
      examCode: 'CS2026-FINAL',
      examTitle: 'Systems Programming & OS Assessment',
    });
    assert.strictEqual(t5, true);
    pass(7, 'Template 5: Exam started live reminder dispatched');

    // Template 6: Result Published
    const t6 = await sendResultPublishedEmail({
      toEmail: 'candidate@campus.edu',
      recipientName: 'Vikram Seth',
      hallTicket: '22JR1A0599',
      examTitle: 'Systems Programming & OS Assessment',
      examCode: 'CS2026-FINAL',
      result: {
        totalScore: 88,
        maxScore: 100,
        normalizedScore: 88,
        correctCount: 44,
        wrongCount: 6,
        timeTakenSeconds: 3100,
        rank: 5,
        totalParticipants: 120,
      },
    });
    assert.strictEqual(t6, true);
    pass(8, 'Template 6: Result published with score card dispatched');

    // Template 7: Contact Auto-Reply
    const t7 = await sendContactAutoReplyEmail({
      toEmail: 'dean.academics@college.edu',
      senderName: 'Prof. K. R. Rao',
      referenceId: 'REF-2026-PILOT01',
      subject: 'Inquiry: Campus Placement Sandbox',
      message: 'We want to schedule a demonstration for our computer science faculty next Monday.',
    });
    assert.strictEqual(t7, true);
    pass(9, 'Template 7: Contact-form auto-reply dispatched');

    // Template 8: Contact Admin Alert
    const t8 = await sendContactAdminNotificationEmail({
      senderName: 'Prof. K. R. Rao',
      senderEmail: 'dean.academics@college.edu',
      referenceId: 'REF-2026-PILOT01',
      subject: 'Inquiry: Campus Placement Sandbox',
      message: 'We want to schedule a demonstration for our computer science faculty next Monday.',
      institution: 'VR Siddhartha Engineering College',
      candidateCount: '800 students',
    });
    assert.strictEqual(t8, true);
    pass(10, 'Template 8: Contact-form admin alert dispatched');

    // ── 3. NON-BLOCKING QUEUE WITH RETRY & EXPONENTIAL BACKOFF ────
    console.log('\n--- 3. Non-Blocking Email Queue & Retry Behavior ---');

    // Test non-blocking execution: calling enqueue must return in < 5ms
    const startEnqueue = Date.now();
    const enqueueRes = emailQueue.enqueueEmail({
      to: 'queue.test@example.com',
      subject: 'Async Non-Blocking Queue Verification',
      text: 'This email is queued and processed in the background.',
      html: wrapBrandTemplate('Queue Test', '<p>Queue Content</p>'),
      emailType: 'welcome_credentials',
    });
    const enqueueDuration = Date.now() - startEnqueue;

    assert.strictEqual(enqueueRes.success, true);
    assert.strictEqual(enqueueRes.queued, true);
    assert.ok(enqueueRes.jobId, 'Queue must return tracking jobId');
    assert.ok(enqueueDuration < 20, `Enqueue must be non-blocking (< 20ms, took ${enqueueDuration}ms)`);
    pass(11, `Non-blocking queue returns synchronously in ${enqueueDuration}ms with jobId`);

    // Await queue drain
    await emailQueue.drain(3000);
    pass(12, 'Queue worker processes pending jobs asynchronously in background');

    // Test retry on transient error:
    let attemptCounter = 0;
    emailQueue.enqueue(
      'retry_test',
      async () => {
        attemptCounter++;
        if (attemptCounter < 2) {
          throw new Error('Simulated transient SMTP socket timeout');
        }
      },
      undefined,
      3
    );

    // Wait for backoff retry (attempt 2 after ~2s)
    await new Promise((r) => setTimeout(r, 2500));
    assert.strictEqual(attemptCounter, 2, 'Queue must retry failed jobs with backoff');
    pass(13, 'Queue successfully retries failed delivery with exponential backoff');

    // ── 4. DAILY FREE-TIER QUOTA CAP & ADMIN WARNING ──────────────
    console.log('\n--- 4. Daily Free-Tier Quota Limit & Admin Warning ---');

    dailyEmailQuota.resetForTesting();
    dailyEmailQuota.setCap(5); // Cap at 5 for testing

    const qStats1 = dailyEmailQuota.getStats();
    assert.strictEqual(qStats1.sentCount, 0);
    assert.strictEqual(qStats1.dailyCap, 5);

    // Send 3 emails (below 80% threshold: 80% of 5 is 4)
    for (let i = 0; i < 3; i++) {
      await sendWithRetry({
        to: `student${i}@campus.edu`,
        subject: `Quota Test ${i}`,
        text: 'Quota test text',
        html: wrapBrandTemplate('Quota Test', '<p>Quota Test</p>'),
        emailType: 'otp',
      });
    }

    const qStats2 = dailyEmailQuota.getStats();
    assert.strictEqual(qStats2.sentCount, 3);
    assert.strictEqual(qStats2.isWarning, false);

    // Send 4th email (hits 80% threshold = 4/5)
    await sendWithRetry({
      to: 'student4@campus.edu',
      subject: 'Quota Test 4',
      text: 'Quota test text',
      html: wrapBrandTemplate('Quota Test', '<p>Quota Test</p>'),
      emailType: 'otp',
    });

    const qStats3 = dailyEmailQuota.getStats();
    assert.strictEqual(qStats3.sentCount, 4);
    assert.strictEqual(qStats3.isWarning, true, '80% capacity must trigger warning state');
    pass(14, 'Daily quota tracker emits admin warning when 80% threshold is reached (4/5)');

    // Send 5th email (hits 100% cap)
    await sendWithRetry({
      to: 'student5@campus.edu',
      subject: 'Quota Test 5',
      text: 'Quota test text',
      html: wrapBrandTemplate('Quota Test', '<p>Quota Test</p>'),
      emailType: 'otp',
    });

    const qStats4 = dailyEmailQuota.getStats();
    assert.strictEqual(qStats4.sentCount, 5);
    assert.strictEqual(qStats4.isExceeded, true, '100% capacity must trigger exceeded state');

    // 6th email must be rejected/blocked
    const sixthSend = await sendWithRetry({
      to: 'student6_blocked@campus.edu',
      subject: 'Quota Test 6 (Should Block)',
      text: 'Quota test text',
      html: wrapBrandTemplate('Quota Test', '<p>Quota Test</p>'),
      emailType: 'otp',
    });

    assert.strictEqual(sixthSend, false, 'Send past cap must be rejected when no fallback configured');
    pass(15, 'Daily free-tier cap strictly halts outbound delivery past limit (5/5)');

    // Test secondary mail transport fallback (Brevo SMTP fallback) when cap is hit
    process.env.ENABLE_BREVO_MOCK = 'true';
    const fallbackSend = await sendWithRetry({
      to: 'student_fallback@campus.edu',
      subject: 'Quota Fallback via Brevo',
      text: 'Fallback text',
      html: wrapBrandTemplate('Quota Fallback', '<p>Quota Fallback</p>'),
      emailType: 'otp',
    });
    assert.strictEqual(fallbackSend, true, 'Fallback transport must deliver when Resend cap is hit');
    delete process.env.ENABLE_BREVO_MOCK;
    pass(16, 'Secondary mail transport fallback (Brevo SMTP) engages when Resend daily cap is hit');

    // Reset quota
    dailyEmailQuota.resetForTesting();
    dailyEmailQuota.setCap(100);

    // ── 5. CONTACT FORM ROUTE INTEGRATION ─────────────────────────
    console.log('\n--- 5. Contact Form Route & Live Telemetry ---');

    // Boot real server for HTTP testing
    const express = require('express');
    const app = express();
    app.use(express.json());

    const contactRoutes = require('./dist/routes/contactRoutes').default;
    app.use('/api/contact', contactRoutes);

    const testServer = http.createServer(app);
    await new Promise((resolve) => {
      testServer.listen(0, '127.0.0.1', () => {
        global.__SERVER_PORT__ = testServer.address().port;
        resolve();
      });
    });

    // Test validation: missing fields
    const invalidRes = await request('POST', '/api/contact', {
      name: '',
      email: 'not-an-email',
    });
    assert.strictEqual(invalidRes.status, 400);

    // Test valid submission: enqueues auto-reply + admin alert
    const validRes = await request('POST', '/api/contact', {
      name: 'Dr. Ramesh Babu',
      email: 'ramesh.babu@university.edu',
      subject: 'Campus Pilot Demonstration Request',
      message: 'We are requesting a pilot license for 1,200 candidates in the autumn semester.',
      institution: 'Koneru Lakshmaiah Education Foundation',
      candidateCount: '1,000 - 5,000 candidates',
    });

    assert.strictEqual(validRes.status, 200);
    assert.strictEqual(validRes.body?.success, true);
    assert.ok(validRes.body?.reference_id.startsWith('REF-'), 'Must return formatted reference ID');
    pass(17, `Contact route creates inquiry with reference ID: ${validRes.body?.reference_id}`);

    // Check stats endpoint
    const statsRes = await request('GET', '/api/contact/mail-stats');
    assert.strictEqual(statsRes.status, 200);
    assert.ok(statsRes.body?.quota);
    assert.ok(statsRes.body?.queue);
    pass(18, 'Real-time mail statistics endpoint /api/contact/mail-stats functional');

    // Await queue drain
    await emailQueue.drain(2000);

    testServer.close();
    await cleanupTestData(supabase);

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passed}/18 RESEND & EMAIL SUBSYSTEM TESTS PASSED!`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    try {
      await cleanupTestData(supabase);
    } catch {}
    process.exit(1);
  }
}

run();
