const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

async function testAuthAndTiming() {
  console.log('--- Testing OTP Generation & Hashing ---');
  // 6-digit OTP
  const otp = crypto.randomInt(100000, 1000000).toString();
  console.log('Generated OTP:', otp, '(Length:', otp.length, ')');
  if (otp.length !== 6 || isNaN(Number(otp))) {
    throw new Error('OTP generation failed!');
  }

  // Hashing
  const hash = await bcrypt.hash(otp, 10);
  const isValid = await bcrypt.compare(otp, hash);
  const isInvalid = await bcrypt.compare('000000', hash);
  console.log('OTP Valid check:', isValid);
  console.log('Wrong OTP check (should be false):', isInvalid);
  if (!isValid || isInvalid) throw new Error('OTP bcrypt verification failed!');

  console.log('\n--- Testing JWT Tokens ---');
  const secret = 'test-secret-key-12345678901234567890';
  const payload = {
    sessionId: 'mock-session-uuid',
    participantId: 'mock-participant-uuid',
    examId: 'mock-exam-uuid',
  };
  const token = jwt.sign(payload, secret, { expiresIn: '2h' });
  const decoded = jwt.verify(token, secret);
  console.log('Decoded JWT session ID:', decoded.sessionId);
  if (decoded.sessionId !== payload.sessionId) throw new Error('JWT verification failed!');

  console.log('\n--- Testing Server-Authoritative Timing Math ---');
  const durationMinutes = 30;
  const startedAt = new Date();
  const scheduledEndTime = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

  // Simulate 5 minutes passed
  const simulatedNow = new Date(startedAt.getTime() + 5 * 60 * 1000);
  const remainingSeconds = Math.max(0, Math.floor((scheduledEndTime.getTime() - simulatedNow.getTime()) / 1000));
  console.log('Calculated remaining seconds (expected ~1500s):', remainingSeconds);
  if (remainingSeconds !== 25 * 60) throw new Error('Timing calculation error!');

  // Simulate expired
  const simulatedExpiredNow = new Date(scheduledEndTime.getTime() + 10000);
  const remainingExpired = Math.max(0, Math.floor((scheduledEndTime.getTime() - simulatedExpiredNow.getTime()) / 1000));
  console.log('Expired remaining seconds (expected 0):', remainingExpired);
  if (remainingExpired !== 0) throw new Error('Expired timing calculation error!');

  console.log('\n SUCCESS: All Auth, Security, & Timing logic tests passed cleanly!');
}

testAuthAndTiming().catch((err) => {
  console.error('Error during test:', err);
  process.exit(1);
});
