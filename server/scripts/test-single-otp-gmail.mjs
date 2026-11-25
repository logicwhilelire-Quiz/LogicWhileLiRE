/**
 * scripts/test-single-otp-gmail.mjs
 *
 * Sends a single real OTP verification email to the specified Gmail address
 * using the configured Resend API key and LogicWhile LiRE institutional template.
 *
 * Usage:
 *   node scripts/test-single-otp-gmail.mjs your-email@gmail.com
 *   (or from root: node backend/scripts/test-single-otp-gmail.mjs your-email@gmail.com)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env
function loadEnv() {
  const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'server', '.env'),
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env'),
    path.resolve(__dirname, '..', '..', 'server', '.env'),
  ];

  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch {}
    }
  }
}

loadEnv();

async function sendSingleOtpMail() {
  console.log('\n========================================================================');
  console.log('📧 LogicWhile LiRE — REAL SINGLE OTP DISPATCH TEST');
  console.log('========================================================================\n');

  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const targetEmail = args[0];

  if (!targetEmail || !targetEmail.includes('@')) {
    console.error('❌ Error: Please provide your recipient Gmail address.');
    console.error('   Usage: node scripts/test-single-otp-gmail.mjs yourname@gmail.com\n');
    process.exit(1);
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('❌ Error: RESEND_API_KEY is not defined in environment or .env file.');
    process.exit(1);
  }

  const fromEmail = process.env.EMAIL_FROM || 'LogicWhile LiRE <onboarding@resend.dev>';
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresMins = 10;

  console.log(`📡 Preparing dispatch:`);
  console.log(`   • Recipient:   ${targetEmail}`);
  console.log(`   • Sender:      ${fromEmail}`);
  console.log(`   • Generated OTP: [${otpCode}] (Valid for ${expiresMins} minutes)`);
  console.log(`   • API Endpoint: https://api.resend.com/emails\n`);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your LogicWhile LiRE Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050814; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FFFFFF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #050814; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #0B1226; border-radius: 14px; border: 1px solid rgba(234, 168, 18, 0.35); overflow: hidden; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #001A38 0%, #002147 100%); padding: 28px 32px; border-bottom: 2px solid #EAA812; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 22px; font-weight: 800; letter-spacing: -0.01em;">
                LogicWhile <span style="color: #EAA812;">Live Rank Engine</span>
              </h1>
              <p style="margin: 6px 0 0; color: #94A3B8; font-size: 13px; font-weight: 500;">
                Live Assessment &amp; Institutional Examination Authority
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 14px; color: #FFFFFF; font-size: 18px; font-weight: 700;">
                One-Time Password (OTP) Verification
              </h2>
              <p style="margin: 0 0 24px; color: #CBD5E1; font-size: 14px; line-height: 1.6;">
                Use the following 6-digit verification code to authenticate your LogicWhile LiRE candidate session. This code is confidential and expires in <strong>${expiresMins} minutes</strong>.
              </p>

              <!-- OTP Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background: #001833; border: 2px solid #EAA812; border-radius: 12px; padding: 18px 36px; text-align: center; box-shadow: 0 8px 24px rgba(234, 168, 18, 0.25);">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #EAA812;">
                        ${otpCode}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 18px; color: #94A3B8; font-size: 13px; line-height: 1.5;">
                ⚠️ <strong>Security Notice:</strong> If you did not initiate this authentication request, please disregard this email. Never disclose this code to anyone; LogicWhile administrators will never ask for your code.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #070B18; padding: 20px 32px; border-top: 1px solid rgba(255, 255, 255, 0.08); text-align: center;">
              <p style="margin: 0 0 6px; color: #64748B; font-size: 12px;">
                © 2026 LogicWhile LiRE. All rights reserved. • Developed by R. Charan Sai Krishna
              </p>
              <p style="margin: 0; color: #475569; font-size: 11px;">
                Institutional Security Infrastructure • Authoritative Proctoring &amp; Sync
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textContent = `
LogicWhile Live Rank Engine — Verification Code

Your One-Time Password (OTP) verification code is: ${otpCode}

This code expires in ${expiresMins} minutes.
Never share this code with anyone.

© 2026 LogicWhile LiRE. All rights reserved.
  `.trim();

  try {
    process.stdout.write('⏳ Dispatched payload to Resend API...');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [targetEmail],
        subject: `LogicWhile LiRE — Verification Code: ${otpCode}`,
        html: htmlContent,
        text: textContent,
      }),
    });

    const resData = await response.json();
    console.log(' -> HTTP', response.status);

    if (response.ok) {
      console.log('\n🎉 SUCCESS! Real OTP email dispatched successfully.');
      console.log('========================================================================');
      console.log(`   • Resend Email ID: ${resData.id}`);
      console.log(`   • Delivered To:    ${targetEmail}`);
      console.log(`   • Dispatched OTP:  ${otpCode}`);
      console.log(`   • Timestamp:       ${new Date().toISOString()}`);
      console.log('========================================================================\n');
      console.log('📬 Check your Gmail inbox (and Spam/Updates folder) for the verification email.');
    } else {
      console.error('\n❌ Resend API Error:');
      console.error(JSON.stringify(resData, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Network / Dispatch Exception:', err);
    process.exit(1);
  }
}

sendSingleOtpMail();
