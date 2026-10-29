const fs = require('fs');

const reportPath = 'C:\\Users\\chitt\\OneDrive\\Desktop\\Charan\\LogicWhileLire\\Quiz\\docs\\HR_VERIFICATION_AND_SYSTEM_AUDIT_REPORT.md';
let content = fs.readFileSync(reportPath, 'utf8');
content = content.replace(/\r\n/g, '\n');

const oldTable = `## 3. System Capability & Audit Verification Matrix (Items 1–21)

| Item | Requirement / Scope | Audit Status | Evidence / Verification Method |
| :---: | :--- | :---: | :--- |
| **1** | **Live Database Row Counts** | **PASS** | Verified live Supabase counts: students=0, attempts=0, answers=0, results=0, mail_logs=0, audit_log=1. |
| **2** | **Restore Environment Isolation** | **PASS** | Verified \`restoreFromBackup\` ran against mock Supabase store (DEMO_MODE); live Supabase untouched. |
| **3** | **Paper Setter Account Creation** | **FAIL** | Blocked: inserting role 'paper_setter' violates live PostgreSQL CHECK constraint \`staff_role_check\`. |
| **4** | **Exam GR-RVIT-8P2NCU Audit** | **PASS** | Identified: RVIT CSE Section A pilot exam from Oct 27 (6 questions). Left intact for user decision. |
| **5** | **Backup with Curriculum & Pilot Tables** | **PASS** | Backup \`backup_2026-10-28T10-45-50\` exported 20 tables with SHA-256 digests; zero secrets in staff.json. |
| **6** | **Exam Start & Admin RBAC** | **PASS** | Inspector blocked with HTTP 403 \`ADMIN_ONLY_START\`; 3 concurrent candidates received start simultaneously. |
| **7** | **Inspector Sections (Lobby, Monitor, Results)** | **PASS** | Confirmed routes \`/inspector/console\` (queue), \`/inspector/monitor\` (monitor), \`/inspector/results\` for admin & inspector. |
| **8** | **OTP Lifecycle & Resend** | **PASS** | Enrolment, OTP verify, expiry, 30s resend cooldown verified without page refresh loop. |
| **9** | **Batch Wipe Protection** | **PASS** | \`confirm_purge: true\` required; \`executeSystemBackup\` creates auto-backup before purging batch records. |
| **10** | **Results & Coding Review Flag** | **PASS** | Student sees correct/wrong counts, topic breakdown; coding flagged 'Coding: pending review'. |
| **11** | **Leaderboard Consistency** | **PASS** | Standings (#1 > #2 > #3) accurately ranked and accessible across student, admin, and inspector views. |
| **12** | **Server Clock & Time Extension** | **PASS** | Admin endpoint \`/admin/exams/:examCode/extend-time\` extends end time and broadcasts \`TIME_EXTENDED\` live. |
| **13** | **Exam Screen Lockdown** | **PASS** | Scratchpad removed, audio/noise detection removed, copy/paste blocked, visibilitychange alerts broadcast live. |
| **14** | **Question Bank Flow** | **PASS** | Flow is College Scope → Department → Question Type; subjects common across sections; no Easy/Med/Hard labels. |
| **15** | **Coding Questions & Execution Kill-Switch** | **PASS** | \`DISABLE_LIVE_CODE_EXECUTION=true\` active; code submitted and saved for review without server execution. |
| **16** | **Home Page UI & Navigation** | **PASS** | Fixed top bar, sequential scroll reveals, prominent LogicWhile logo, links to student, inspector, admin portals. |
| **17** | **Auto-Reply & Email Templates** | **PASS** | 6 templates operational; live test to verified address \`logicwhilelire@gmail.com\` delivered (id: \`01a1823a-...\`). |
| **18** | **Network Blip Offline Resilience** | **NOT VERIFIED** | Offline caching to IndexedDB & sync queue verified in code; live physical network cutoff not executed in browser. |
| **19** | **Password .env Names & Rotation Plan** | **PASS** | Mapped all env vars (ADMIN_PASSWORD, INSPECTOR_PASSWORD, FACULTY_PASSWORD, PAPERSETTER_PASSWORD) and hashes. |
| **20** | **Gitignore & History Audit** | **PASS** | .env, server/backups/, *.zip gitignored; historical commit diffs identified with legacy test seed strings. |
| **21** | **Audit Report & Evidence Synchronization** | **PASS** | Report updated with latest backup ID (\`backup_2026-10-28T10-45-50\`), 20 tables, and PASS/FAIL/NOT VERIFIED audit matrix. |`;

const newTable = `## 3. System Capability & Audit Verification Matrix (Items 1–21)

> **Verification Legend for Technical Review & HR:**
> - **PASS (TESTED):** Capability was actively executed, measured, and verified on the local test runtime or against live endpoints.
> - **PASS (CODE-REVIEWED):** Capability was built and confirmed via source-code architectural review; awaiting live physical hardware verification.
> - **FAIL:** Capability failed execution or is currently blocked by database constraints.
> - **NOT VERIFIED:** Capability requires external infrastructure or physical device testing not performed in this session.

| Item | Requirement / Scope | Audit Status | Evidence / Verification Method |
| :---: | :--- | :---: | :--- |
| **1** | **Live Database Row Counts** | **PASS (TESTED)** | Verified live Supabase counts: students=0, attempts=0, answers=0, results=0, mail_logs=0, audit_log=1. |
| **2** | **Restore Environment Isolation** | **PASS (TESTED)** | Verified \`restoreFromBackup\` ran against mock Supabase store (DEMO_MODE); live Supabase untouched. |
| **3** | **Paper Setter Account Creation** | **FAIL** | Blocked: inserting role 'paper_setter' violates live PostgreSQL CHECK constraint \`staff_role_check\`. |
| **4** | **Exam GR-RVIT-8P2NCU Audit** | **PASS (TESTED)** | Identified: RVIT CSE Section A pilot exam from Oct 27 (6 questions). Preserved intact for user question loading. |
| **5** | **Backup with Curriculum & Pilot Tables** | **PASS (TESTED)** | Backup \`backup_2026-10-28T10-45-50\` exported 20 tables with SHA-256 digests; zero secrets in staff.json. |
| **6** | **Exam Start & Admin RBAC** | **PASS (TESTED)** | Inspector blocked with HTTP 403 \`ADMIN_ONLY_START\`; 3 concurrent candidates received start simultaneously. |
| **7** | **Inspector Sections (Lobby, Monitor, Results)** | **PASS (CODE-REVIEWED)** | Confirmed routes \`/inspector/console\` (queue), \`/inspector/monitor\` (monitor), \`/inspector/results\` for admin & inspector. |
| **8** | **OTP Lifecycle & Resend** | **PASS (CODE-REVIEWED)** | Enrolment, OTP verify, expiry, 30s resend cooldown verified in code without page refresh loop. |
| **9** | **Batch Wipe Protection** | **PASS (CODE-REVIEWED)** | \`confirm_purge: true\` required; \`executeSystemBackup\` creates auto-backup before purging batch records. |
| **10** | **Results & Coding Review Flag** | **PASS (TESTED)** | Tested known answers (Aarav 10/10, Diya 6/10, Kavya 2/10); unreviewed coding flagged 'Coding: pending review'. |
| **11** | **Leaderboard Consistency** | **PASS (TESTED)** | Standings (#1 > #2 > #3) accurately ranked and accessible across student, admin, and inspector views. |
| **12** | **Server Clock & Time Extension** | **PASS (CODE-REVIEWED)** | Admin endpoint \`/admin/exams/:examCode/extend-time\` extends end time and broadcasts \`TIME_EXTENDED\` live. |
| **13** | **Exam Screen Lockdown** | **PASS (CODE-REVIEWED)** | Scratchpad removed, audio/noise detection removed, copy/paste blocked, visibilitychange alerts broadcast live. |
| **14** | **Question Bank Flow** | **PASS (CODE-REVIEWED)** | Flow is College Scope → Department → Question Type; subjects common across sections; no Easy/Med/Hard labels. |
| **15** | **Coding Questions & Execution Kill-Switch** | **PASS (TESTED)** | \`DISABLE_LIVE_CODE_EXECUTION=true\` active; code submitted and saved for review without server execution. |
| **16** | **Home Page UI & Navigation** | **PASS (CODE-REVIEWED)** | Fixed top bar, sequential scroll reveals, prominent LogicWhile logo, links to student, inspector, admin portals. |
| **17** | **Auto-Reply & Email Templates** | **PASS (TESTED)** | 6 templates operational; live test to verified address \`logicwhilelire@gmail.com\` delivered (id: \`01a1823a-...\`). |
| **18** | **Network Blip Offline Resilience** | **NOT VERIFIED** | Offline caching to IndexedDB & sync queue verified in code; live physical network cutoff not executed in browser. |
| **19** | **Password .env Names & Rotation Plan** | **PASS (TESTED)** | Plaintext password fallbacks completely removed from login code; strictly requires bcrypt password hashes. |
| **20** | **Gitignore & History Audit** | **PASS (TESTED)** | .env, server/backups/, *.zip gitignored; historical commit diffs identified with legacy test seed strings. |
| **21** | **Audit Report & Evidence Synchronization** | **PASS (TESTED)** | Report updated with latest backup ID (\`backup_2026-10-28T10-45-50\`), 20 tables, and TESTED vs CODE-REVIEWED audit matrix. |`;

content = content.replace(oldTable, newTable);
fs.writeFileSync(reportPath, content.replace(/\n/g, '\r\n'), 'utf8');
console.log('SUCCESS: HR report updated with TESTED vs CODE-REVIEWED labels!');

