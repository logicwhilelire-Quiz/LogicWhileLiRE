import 'dotenv/config';
import {
  EMAIL_FROM,
  MAIL_DOMAIN,
  SUPPORT_EMAIL,
  ADMIN_EMAIL,
  getHostedLogoUrl,
  dailyEmailQuota,
  sendWelcomeCredentialsEmail,
  sendEmailVerificationOtpEmail,
  sendPasswordResetEmail,
  sendExamScheduledEmail,
  sendExamStartedReminderEmail,
  sendResultPublishedEmail,
  sendContactAutoReplyEmail,
  sendContactAdminNotificationEmail,
} from '../services/emailService';
import { emailQueue } from '../services/emailQueue';

async function main() {
  console.log('\n========================================================================');
  console.log('📧 LogicWhileLiRE — MULTI-TEMPLATE EMAIL VERIFICATION SUITE');
  console.log('========================================================================\n');

  // Parse recipient email from CLI arguments (handles npm run test-email -- address@example.com)
  const rawArgs = process.argv.slice(2).filter((arg) => arg !== '--');
  let targetEmail = rawArgs.find((arg) => arg.includes('@'));

  if (!targetEmail) {
    targetEmail = rawArgs[0] || 'test@example.com';
    console.warn(`ℹ️  No recipient email specified. Defaulting to: ${targetEmail}`);
    console.warn(`   Usage: npm run test-email -- candidate@example.com\n`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(targetEmail)) {
    console.error(`❌ Invalid email address provided: "${targetEmail}"`);
    process.exit(1);
  }

  // Detect Active Transport
  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  let transportMode = 'Mock / Dev Safe Fallback';
  if (resendApiKey) {
    transportMode = `Resend HTTPS API (Key: ${resendApiKey.slice(0, 5)}...${resendApiKey.slice(-4)})`;
  } else if (smtpHost && process.env.SMTP_USER) {
    transportMode = `SMTP (${smtpHost}:${process.env.SMTP_PORT || '587'})`;
  }

  const logoUrl = getHostedLogoUrl();
  const quota = dailyEmailQuota.getStats();

  console.log('⚙️  ACTIVE EMAIL SUBSYSTEM CONFIGURATION:');
  console.log(`   • Transport:       ${transportMode}`);
  console.log(`   • From Address:    ${EMAIL_FROM}`);
  console.log(`   • Mail Domain:     ${MAIL_DOMAIN}`);
  console.log(`   • Support Contact: ${SUPPORT_EMAIL}`);
  console.log(`   • Admin Contact:   ${ADMIN_EMAIL}`);
  console.log(`   • Hosted Logo URL: ${logoUrl}`);
  console.log(`   • Daily Quota:     ${quota.sentCount} / ${quota.dailyCap} emails (Remaining: ${quota.remaining})`);
  console.log(`   • Target Recipient:${targetEmail}\n`);

  const results: Array<{ template: string; subject: string; success: boolean; error?: string }> = [];

  const templatesToTest = [
    {
      name: '1. Welcome with Credentials',
      send: () =>
        sendWelcomeCredentialsEmail({
          toEmail: targetEmail!,
          recipientName: 'Aarav Reddy',
          role: 'student',
          identifier: '22JR1A0501',
          tempPassword: 'LwL-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
          collegeName: 'Velagapudi Ramakrishna Siddhartha Engineering College',
        }),
    },
    {
      name: '2. Email Verification / OTP',
      send: () =>
        sendEmailVerificationOtpEmail({
          toEmail: targetEmail!,
          recipientName: 'Aarav Reddy',
          otp: String(Math.floor(100000 + Math.random() * 900000)),
          expiresMinutes: 15,
        }),
    },
    {
      name: '3. Password Reset Request',
      send: () =>
        sendPasswordResetEmail(
          targetEmail!,
          'Aarav Reddy',
          `http://localhost:5173/reset-password?token=${Math.random().toString(36).slice(2)}&email=${encodeURIComponent(targetEmail!)}`
        ),
    },
    {
      name: '4. Exam Scheduled (Hall Ticket)',
      send: () =>
        sendExamScheduledEmail({
          toEmail: targetEmail!,
          recipientName: 'Aarav Reddy',
          hallTicket: '22JR1A0501',
          examCode: 'VRSEC-CS2026',
          examTitle: 'Advanced Data Structures & Algorithms Assessment',
          durationMinutes: 45,
          scheduledAt: new Date(Date.now() + 86400000).toLocaleString(),
        }),
    },
    {
      name: '5. Exam Started Live Reminder',
      send: () =>
        sendExamStartedReminderEmail({
          toEmail: targetEmail!,
          recipientName: 'Aarav Reddy',
          hallTicket: '22JR1A0501',
          examCode: 'VRSEC-CS2026',
          examTitle: 'Advanced Data Structures & Algorithms Assessment',
        }),
    },
    {
      name: '6. Result Published & Standings',
      send: () =>
        sendResultPublishedEmail({
          toEmail: targetEmail!,
          recipientName: 'Aarav Reddy',
          hallTicket: '22JR1A0501',
          examTitle: 'Advanced Data Structures & Algorithms Assessment',
          examCode: 'VRSEC-CS2026',
          result: {
            totalScore: 92,
            maxScore: 100,
            normalizedScore: 92,
            correctCount: 46,
            wrongCount: 4,
            timeTakenSeconds: 2150,
            rank: 3,
            totalParticipants: 180,
          },
        }),
    },
    {
      name: '7. Contact Form Auto-Reply',
      send: () =>
        sendContactAutoReplyEmail({
          toEmail: targetEmail!,
          senderName: 'Dr. Suresh Varma',
          referenceId: `REF-${Date.now().toString().slice(-6)}-PILOT`,
          subject: 'Campus Sandbox Pilot Onboarding',
          message: 'We would like to pilot LogicWhileLiRE for our 650 CSE candidates in the upcoming semester.',
        }),
    },
    {
      name: '8. Contact Form Admin Alert',
      send: () =>
        sendContactAdminNotificationEmail({
          senderName: 'Dr. Suresh Varma',
          senderEmail: targetEmail!,
          referenceId: `REF-${Date.now().toString().slice(-6)}-PILOT`,
          subject: 'Campus Sandbox Pilot Onboarding',
          message: 'We would like to pilot LogicWhileLiRE for our 650 CSE candidates in the upcoming semester.',
          institution: 'VR Siddhartha Engineering College',
          candidateCount: '650 candidates',
        }),
    },
  ];

  console.log('🚀 Dispatching all 8 branded email templates...\n');

  for (const item of templatesToTest) {
    process.stdout.write(`   ⏳ Sending [${item.name}]... `);
    try {
      const ok = await item.send();
      if (ok) {
        console.log('✅ Sent');
        results.push({ template: item.name, subject: 'Dispatched successfully', success: true });
      } else {
        console.log('⚠️ Failed');
        results.push({ template: item.name, subject: 'Delivery returned false', success: false });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ Error: ${msg}`);
      results.push({ template: item.name, subject: 'Exception', success: false, error: msg });
    }
  }

  // Drain any queued background jobs if applicable
  await emailQueue.drain(2000);

  const updatedQuota = dailyEmailQuota.getStats();

  console.log('\n========================================================================');
  console.log('📊 DISPATCH SUMMARY REPORT');
  console.log('========================================================================');
  console.table(
    results.map((r) => ({
      Template: r.template,
      Recipient: targetEmail,
      Status: r.success ? '✅ SUCCESS' : '❌ FAILED',
      Details: r.error || 'Delivered / Queued',
    }))
  );

  console.log(`📈 Daily Quota Status: ${updatedQuota.sentCount} / ${updatedQuota.dailyCap} (Remaining: ${updatedQuota.remaining})`);

  const allPassed = results.every((r) => r.success);
  if (allPassed) {
    console.log('\n🎉 ALL 8 EMAIL TEMPLATES DISPATCHED AND VERIFIED CLEANLY!\n');
    process.exit(0);
  } else {
    console.error('\n⚠️ Some email templates failed to dispatch. Review errors above.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal CLI execution error:', err);
  process.exit(1);
});
