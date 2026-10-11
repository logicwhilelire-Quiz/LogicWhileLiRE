import fs from 'fs';
import path from 'path';

const filePath = path.resolve(__dirname, '../src/db/mockSupabase.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const startMarker = 'const store: MockTableData = {';
const endMarker = 'class MockQueryBuilder {';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find markers in mockSupabase.ts', { startIndex, endIndex });
  process.exit(1);
}

const cleanStoreCode = `const store: MockTableData = {
  staff: [
    {
      id: 'e6fa7676-2798-4b3c-b452-37d455bb3585',
      name: 'Super Administrator',
      email: 'admin@logicwhilelire.com',
      password_hash: '$2b$12$Y65kU/s0HBji1KPpvVjjh.fXc1.p4T.B35JH3xj82W7Udi6PDGPeu',
      role: 'super_admin',
      college_id: null,
      failed_attempts: 0,
      locked_until: null,
      reset_token_hash: null,
      reset_token_expires: null,
      totp_secret: null,
      is_2fa_enabled: false,
      totp_enabled: false,
      must_change_password: false,
      is_active: true,
      permissions: ['create_questions', 'upload_excel', 'view_results', 'export_data', 'manage_exams', 'manage_students'],
      created_by: null,
      created_at: new Date().toISOString(),
    },
  ],
  students: [],
  academic_years: [],
  cohorts: [],
  sections: [],
  batches: [],
  curriculum: [],
  exams: [],
  participants: [],
  exam_sessions: [],
  session_answers: [],
  questions: [],
  violations: [],
  suspicious_activity: [],
  results: [],
  deliverable_failures: [],
  audit_log: [],
  student_roster: [],
  colleges: [],
  exam_codes: [],
  questions_ec: [],
  exam_code_attempts: [],
  email_queue: [],
};

// Aliases matching Postgres compatibility views
(store as any).candidates = store.participants;
(store as any).sessions = store.exam_sessions;
(store as any).audit_logs = store.audit_log;

`;

content = content.slice(0, startIndex) + cleanStoreCode + content.slice(endIndex);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('✅ mockSupabase.ts successfully cleaned! Only 1 Super Admin remains.');
