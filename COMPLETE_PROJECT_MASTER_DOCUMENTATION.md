# LogicWhileLiRE Assessment Engine v4.0.0
# Complete Project Master Documentation & Administrative Operations Handbook

---

## 1. Executive Summary & Zero-Default Architecture

The **LogicWhileLiRE Assessment Platform** is an enterprise-grade examination, psychometric competency, and institutional evaluation engine.

### Core Architectural Principle: 100% Authoritative Admin Control
In accordance with institutional requirements:
1. **Zero Default / Fallback Data**: No hardcoded mock answer keys (`OFFICIAL_KEY_MAP`), synthetic browser attempts, or unauthoritative client caches (`admin_imported_questions_...`, `admin_created_exams`) exist in the system.
2. **Strict Server-Side Authority**: Every exam code, question set, time limit, section eligibility rule, and student submission is verified, served, and evaluated strictly by the backend API and Supabase PostgreSQL database.
3. **Admin Dominance**: No student can start an unlaunched exam, bypass academic section filters, fake question answers, or restart a terminated attempt without explicit administrative action.
4. **Production Safety**: `DEMO_MODE=false` is enforced globally. All mock JWT bypass tokens (`demo-*`) are rejected with `401 Unauthorized`.

---

## 2. Complete User Roles, Usernames & System Credentials

The platform enforces Role-Based Access Control (RBAC) with granular security scopes across four distinct user tiers:

| User Tier | Portal URL | Username / Identifier | Password / Secret | Assigned Permissions & Scopes |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `/admin/login` | `admin` | `LiREAdmin@2026!` | **Global Unrestricted Access**: Provision colleges, manage sections, create exams, upload questions, configure 2FA, view live telemetry across all institutions, clear student re-entry. Email: `admin@logicwhilelire.com`. |
| **Exam Inspector** | `/inspector/login` | `inspector` | `LiREInspector@2026!` | **Live Invigilation & Proctoring**: Remote live room supervision, pause/resume candidates, push time extensions, inspect webcam feeds, broadcast emergency warnings, resolve drop-box tickets, terminate malpractice. Email: `inspector@logicwhilelire.com`. |
| **Faculty Member** | `/faculty/login` | `faculty` | `LiREFaculty@2026!` | **Scoped Institutional Access**: Strictly restricted to assigned College (`college_id`) and assigned Sections (`section_ids`). Can view question banks, monitor class progress, and export section grade rosters. Email: `faculty@logicwhilelire.com`. |
| **Student / Candidate** | `/enter-exam` or `/student/login` | Hall Ticket (e.g. `22VRSECCSE001`) | `StudentPass@2026!` (for dashboard) | **Assessment Execution**: Direct hall ticket entry into scheduled exams matching assigned college, graduation year, and section. Direct scorecard review upon authoritative submission. |

### Verified Student Test Accounts (Pre-Enrolled)
The following pre-enrolled verified students are available across collegiate sections:
- **VRSEC Section CSE-A**: `22VRSECCSE001`, `22VRSECCSE002`, `22VRSECCSE003`, `22VRSECCSE004`, `22VRSECCSE005`
- **VRSEC Section CSE-B**: `22VRSECCSE006`, `22VRSECCSE007`, `22VRSECCSE008`, `22VRSECCSE009`, `22VRSECCSE010`
- **General Qualified Candidates**: `24HU1A05F9`, `RVACJ31411`, `24A91A051483`

---

## 3. Administrative Control Suite: Complete Feature Breakdown

Every operational dimension of the platform is directly governed from the Admin Portal:

### 3.1 Academic Hierarchy & Section Allocation (`/admin/colleges`, `/admin/hierarchy`)
- **Institution Management**: Create, edit, and audit participating colleges (`VRSEC`, `KLU`, `VVIT`, `LOGICWHILE`).
- **Department & Branch Structuring**: Organize departments (Computer Science, Artificial Intelligence, Information Technology, Electronics).
- **Graduation Batches**: Configure target graduation years (`2026`, `2027`, `2028`, `2029`, `2030`).
- **Section Subdivision**: Allocate students into distinct academic sections (`CSE-A`, `CSE-B`, `CSM-A`, `IT-A`, `Section A`, `Section B`).
- **Section Targeting Guarantee**: Admin can lock an assessment exclusively to specific sections (e.g. `['CSE-A', 'CSE-B']`). Any student from another section or college is rejected with HTTP 403. Setting `['ALL']` permits universal institutional access.

### 3.2 Master Exam Management (`/admin/exam-codes`)
- **Exam Code Generation**: Create unique master assessment keys (e.g., `CS2026`, `EXAM-001`, `GR-UNIV-001`).
- **Time Window & Duration Control**: Set dynamic exam duration (e.g., 60 minutes) and strict start/end window timestamps.
- **Anti-Cheat Threshold Settings**: Set `max_violations` (default: **2 strikes**) and `auto_terminate: true`.
- **Push-To-Start**: Admin holds all students in the Synchronized Waiting Lobby until the invigilator triggers the synchronized launch event.
- **Negative Marking & Passing Percentage**: Fine-grained penalty marks per wrong answer and cut-off percentage calculation.

### 3.3 Authoritative 5-Sector Question Bank & Importer (`/admin/import-questions`, `/admin/questions`)
- **Centralized Database Storage**: All questions are stored in Supabase PostgreSQL (`questions_ec` and `questions` tables).
- **2-Sheet Excel Import (.xlsx)**:
  - Generates downloadable dual-sheet Excel template (`Questions` master sheet and `Instructions` guide sheet).
  - Supports MCQs, Coding Challenges, Diagram Questions, and Quantitative Aptitude problems.
  - Multi-phase server validation: checks question text, non-empty options, valid answer keys (`A`, `B`, `C`, `D`), diagram URLs, and JSON test cases.
  - Commits valid questions directly to the database; reports malformed rows with exact line errors back to the admin.
- **Zero LocalStorage Fallback**: If the server is unreachable or errors occur, the import halts with a visible diagnostic error—ensuring bad or uncommitted data is never treated as valid.

### 3.4 Candidate Rostering & Re-Entry Clearance (`/admin/students`)
- **Student Roster Management**: View all enrolled candidates, their assigned section, hall ticket, email, and registration status.
- **Malpractice Status Audit**: Live indicator showing whether an attempt is `not_started`, `in_progress`, `completed`, or `terminated_cheating`.
- **Authoritative Re-Entry Clearance**: When a candidate is auto-terminated due to a fullscreen breach or tab switch, the system applies an uncompromising restart guard (HTTP 403 `ATTEMPT_TERMINATED`). Only an Admin can click **"Allow Re-Entry"**, which:
  - Preserves the exact remaining exam seconds (`time_remaining_seconds`).
  - Preserves all previously saved answers intact.
  - Re-activates the session token, permitting the student to resume without losing a single mark or second.

### 3.5 Live Holo-Proctoring & Remote Invigilation (`/admin/monitor`, `/instructor-console/:code`)
- **Sub-100ms WebSocket Telemetry**: Real-time heartbeat stream of candidate connection, question number, answered count, and violation strikes.
- **Live Remote Control Actions**:
  - **Broadcast Warning**: Transmit urgent institutional banners to all active candidate screens.
  - **Whisper Warning**: Send confidential proctor notice to a single candidate.
  - **Pause Exam**: Instantly freeze the exam viewport and stop timer for a student or room.
  - **Extend Time**: Grant `+N` minutes to compensate for verified technical issues.
  - **Force Disqualification**: Terminate attempt instantly for observed malpractice.

---

## 4. The 5-Sector Technical Competency Matrix

Every assessment is balanced across **5 Core Technical Sectors** to measure total computational engineering proficiency:

### Sector Specifications
1. **Quantitative Aptitude & Numerical Velocity (`SEC-QUANT`)**: `#F59E0B` (Amber). Time & Work, Relative Speed, Probability, Compound Growth, Modulo Arithmetic.
2. **Logical Reasoning & Deductive Invariants (`SEC-LOGIC`)**: `#8B5CF6` (Violet). Syllogistic Deduction, Circular Topology, Scheduling Constraints, Matrix Patterns.
3. **Core Computer Science & Systems Architecture (`SEC-CORECS`)**: `#10B981` (Emerald). OS Virtual Memory & TLB, DBMS ACID & WAL, TCP Reno & Handshakes, CPU Pipeline Hazards.
4. **Data Structures & Algorithmic Complexity (`SEC-DSA`)**: `#38BDF8` (Sky Blue). AVL Trees, Dijkstra with Fibonacci Heaps, Space-Optimized LCS, Monotonic Stacks, Live Coding.
5. **Advanced Full-Stack & Distributed Architecture (`SEC-FULLSTACK`)**: `#F43F5E` (Rose). Event Loop Microtasks, Cache-Aside Invalidation, SameSite CSRF Defense, WebSocket Upgrades.

---

## 5. Collegiate Hierarchy & Active Academic Sections

| College Code | College ID | Institution Name | Active Sections |
| :--- | :---: | :--- | :--- |
| **VRSEC** | `1` | Velagapudi Ramakrishna Siddhartha Engineering College | `CSE-A`, `CSE-B`, `CSE-C`, `CSM-A`, `CSM-B`, `IT-A`, `IT-B` |
| **KLU** | `2` | Koneru Lakshmaiah Education Foundation | `KLU-CSE-01`, `KLU-CSE-02`, `KLU-CSIT-01` |
| **VVIT** | `3` | Vasireddy Venkatadri Institute of Technology | `VVIT-CSE-A`, `VVIT-CSE-B`, `VVIT-CSD` |
| **LOGICWHILE** | `80` | LogicWhile LiRE Benchmark Academy | `LW-SECT-01`, `LW-SECT-02`, `LW-GLOBAL` |

---

## 6. Strict Exam Anti-Cheat & Security Lockdown

1. **10-Second Fullscreen Lockdown (`FullscreenEnforcementOverlay`)**: Any exit from fullscreen triggers a countdown overlay. Reaching 0 auto-terminates the exam with status `terminated_cheating`.
2. **Window Blur & Tab Switch Detector**: Window blurs and tab switches increment the 2-strike maximum threshold and dispatch alerts to the proctor desk.
3. **Hardware Keyboard Shield**: Nullifies `F12`, `Ctrl+Shift+I`, `Alt+Tab`, `Ctrl+U`, copy/paste. Right click is disabled.
4. **Dynamic Anti-Leak Watermark (`AntiLeakWatermark`)**: Overlays candidate roll number and ISO timestamp across all question cards.
5. **Microphone Audio Decibel Monitor (`useAudioProctor`)**: Triggers audible/visible warnings when sound exceeds `-24 dB`.
6. **Restart Guard**: HTTP 403 `ATTEMPT_TERMINATED` locks out terminated candidates until Admin allows re-entry.

---

## 7. Verification & Test Suite Results Matrix

All platform systems were verified with 100% automated pass rates:

| Verification Suite | Target Areas | Tests | Result |
| :--- | :--- | :---: | :---: |
| `test-phase5-question-importer.js` | Excel upload, preview validation, CRUD, multi-dim filtering | 37 | **37 / 37 PASSED (100%)** |
| `test-reentry-and-termination.js` | Restart Guard, HTTP 403 lockout, time & answer preservation | 6 | **6 / 6 PASSED (100%)** |
| `test-section-eligibility-rejection.js` | College, department, batch, and section eligibility gate | 8 | **8 / 8 PASSED (100%)** |
| `test-phase4-student-gate.js` | Hall ticket resolution, gate passes, drop-box reporting | 18 | **18 / 18 PASSED (100%)** |
| `test-faculty-scope-and-production-safety.js` | DEMO_MODE=false, token bypass rejection, faculty college/section scope | 9 | **9 / 9 PASSED (100%)** |
| `test-name-validation.js` | Candidate name regex enforcement (`/^[A-Za-z\s.'-]+$/`) | 13 | **13 / 13 PASSED (100%)** |
| `test-2fa-enforcement.js` | RFC 6238 TOTP, backup recovery codes, brute-force mitigation | 6 | **6 / 6 PASSED (100%)** |
| `test-50-students-load.js` | 50 concurrent students, synchronized lobby, Push-To-Start latency (mean 516ms), auto-submit cron | 50 | **50 / 50 PASSED (100%)** |
| **Frontend Production Build** | TypeScript build (`tsc -b && vite build`) | — | **0 Errors (1.44s)** |
| **Backend Production Build** | TypeScript build (`tsc`) | — | **0 Errors** |
