#!/usr/bin/env node
/**
 * LOGICWHILE QUIZ — Admin Password Rotation Utility
 * Generates a high-security bcrypt hash (12 rounds) for ADMIN_PASSWORD_HASH
 *
 * Usage:
 *   node scripts/generate-password-hash.js <new-password>
 *   or:
 *   node scripts/generate-password-hash.js
 *   (generates a strong random password if none provided)
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function main() {
  let password = process.argv[2];

  if (!password) {
    // Generate a cryptographically strong 16-character password
    password = crypto.randomBytes(12).toString('base64url');
    console.log('\n🔑 No password provided. Generated secure temporary password:');
    console.log(`\x1b[33m   ${password}\x1b[0m\n`);
  }

  const saltRounds = 12;
  console.log(`Generating bcrypt hash with ${saltRounds} salt rounds...`);
  const hash = await bcrypt.hash(password, saltRounds);

  // Self-test hash verification
  const isValid = await bcrypt.compare(password, hash);
  if (!isValid) {
    console.error('❌ Error: Verification check failed for generated hash.');
    process.exit(1);
  }

  console.log('✅ Hash verified successfully!\n');
  console.log('================================================================');
  console.log('Copy the following line to your server/.env file:');
  console.log('================================================================');
  console.log(`\x1b[32mADMIN_PASSWORD_HASH=${hash}\x1b[0m`);
  console.log('================================================================\n');
  console.log('⚠️ Reminder: Never store plaintext passwords in .env or source control.');
}

main().catch((err) => {
  console.error('Error generating hash:', err);
  process.exit(1);
});
