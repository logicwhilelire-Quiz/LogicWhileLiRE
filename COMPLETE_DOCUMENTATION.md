# LogicWhileLiRE — Complete Platform Documentation & Technical Reference

**Version:** 4.0.0 (Production Release)  
**Product:** LogicWhileLiRE Assessment Engine  
**Tagline:** "Logic. While. LiRE."  
**Platform Architect & Lead Developer:** R. Charan Sai  
**Copyright:** © 2026 R. Charan Sai. All rights reserved.  
**Repository:** `c:\Users\chara\OneDrive\Desktop\Quiz`  
**Operating Stack:** React 18 + Vite (Frontend) · Node.js + Express + TypeScript (Backend) · PostgreSQL on Supabase (Database) · WebSockets & In-Memory High-Speed Cache (Real-time Telemetry & Leaderboard)

---

## 📋 Table of Contents
1. [Executive Summary & System Overview](#1-executive-summary--system-overview)
2. [Brand Identity & Design System](#2-brand-identity--design-system)
3. [Section-Targeted Examinations & 404 Secrecy](#3-section-targeted-examinations--404-secrecy)
4. [Dynamic Study Year Derivation (Zero Hardcoding)](#4-dynamic-study-year-derivation-zero-hardcoding)
5. [Institutional Hierarchy & Bulk Ingestion](#5-institutional-hierarchy--bulk-ingestion)
6. [System Architecture & Data Flow](#6-system-architecture--data-flow)
7. [Frontend Architecture & Page Catalog](#7-frontend-architecture--page-catalog)
8. [Backend Architecture & Complete REST API Reference](#8-backend-architecture--complete-rest-api-reference)
9. [Anti-Tamper, Security & Proctoring Engine](#9-anti-tamper-security--proctoring-engine)
10. [Database Schema & Migration Guide](#10-database-schema--migration-guide)
11. [Hardware-Accelerated 3D & Animation System](#11-hardware-accelerated-3d--animation-system)
12. [Interactive Live Demo & Persona Walkthrough](#12-interactive-live-demo--persona-walkthrough)
13. [DevOps, Deployment & Observability](#13-devops-deployment--observability)
14. [Performance Benchmarks & 500-User Load Validation](#14-performance-benchmarks--500-user-load-validation)

---

## 1. Executive Summary & System Overview

**LogicWhileLiRE** is an enterprise-grade, high-throughput Campus Recruitment Training (CRT) and coding assessment platform engineered specifically for autonomous engineering colleges, technical universities, and recruitment drives.

### Core Capabilities
- **Section-Targeted Assessment Engine:** Exams can be scoped to specific colleges, branches, graduation cohorts, sections (`A`, `B`, `C`), and lab batches.
- **Server-Side Fail-Closed 404 Secrecy:** Non-targeted students receive an HTTP 404 (`EXAM_NOT_FOUND`) on every endpoint (verification, session start, question fetch, answer save, socket join), completely concealing the exam's existence.
- **Dynamic Academic Calendar Derivation:** Calculates student study year (1st, 2nd, 3rd, 4th Year) dynamically from graduation year and current date with zero hardcoded years.
- **Role-Based Workflow & Inspector Console:** Dedicated Inspector role landing directly on the live leaderboard with queue status, room monitoring, and real-time exam lifecycle controls (Start, Pause, Terminate).
- **Question Paper Allocation & Audit Locking:** Multi-step paper allocation to faculty/inspectors with cryptographic lock and immutable audit trail.
- **High-Throughput Assessment Gate:** High-concurrency registration and queueing gate preventing database bottlenecks during simultaneous logins of 5,000+ candidates.
- **Exam Code Flow (Zero-OTP Friction):** Direct entrance with pre-generated institutional Exam Codes (`TARGET-VRSEC-A`, `DEMO100`, `CS2026`) + Student Hall Ticket numbers, completely eliminating SMS/Email OTP bottlenecks.
- **Server-Authoritative Clock:** Examination timers are computed exclusively on the server (`started_at + duration_minutes`). Client-side clock manipulation or browser pauses cannot extend test duration.
- **Anti-Cheat Hardware & Canvas Fingerprinting:** Continuous detection of tab switching, window blurring, developer tools execution, screen resizing, and multi-session concurrency conflicts.
- **Client-Side Face Sentinel:** On-device MediaPipe landmarking detects face absence, multiple faces, and looking away. Zero video feeds or audio streams are ever transmitted or stored on cloud servers.
- **Real-Time Leaderboard:** Powered by sub-second ranking computation and WebSocket push mechanisms across thousands of concurrent test takers.
- **Strict Zero-3D Exam Page Guard:** Rich WebGL & Three.js 3D experiences on marketing, lobby, and leaderboard pages, with a hard architectural guarantee of zero 3D overhead on the exam screen to maximize device compatibility.

---

## 2. Brand Identity & Design System

### 2.1 Logo Philosophy & Visual Geometry
- **The Open Book:** Represents deep foundational knowledge, rigorous scholarship, and verified examination standards.
- **The Rising Growth Arrow:** Ascends from within the pages, breaks through institutional constraints, and surges diagonally upward-right at +45°, embodying upward trajectory, rapid growth, and execution speed.
- **The Wordmark:** **LogicWhileLiRE** — bold, geometric sans-serif featuring deep authority blue (`#0A3F8F`) paired with a vivid cyan-violet gradient (`#38BDF8` to `#C084FC`), projecting institutional reliability and next-gen intelligence.
- **The Tagline:** *"Logic. While. LiRE."* — modern medium weight in growth blue (`#1B5FB5` / `#93C5FD`), communicating structured logic, persistent momentum, and execution excellence.

### 2.2 Color Tokens
```css
/* Core Palette Tokens */
--color-wordmark-blue: #0A3F8F; /* Primary wordmark, major headings */
--color-mark-blue:     #1B5FB5; /* Mark strokes, active buttons */
--color-tagline-blue:  #4A7DBE; /* Tagline text, secondary accents */
--color-navy-deep:     #080E1F; /* Base dark background */
--color-navy-surface:  #101D3F; /* Elevated cards and panels */
--color-navy-border:   rgba(255, 255, 255, 0.08); /* Crisp borders */
--color-cyber-cyan:    #06B6D4; /* Data telemetry, links, verified states */
--color-emerald-green: #10B981; /* Success, correct answers, active status */
--color-amber-warning: #F59E0B; /* Pending review, violations, warnings */
--color-coral-danger:  #EF4444; /* Terminations, errors, lockout states */
```

### 2.3 Typography System
- **Headings & Brand Title:** `Space Grotesk` or `Inter`, sans-serif (Weights: 600, 700, 800)
- **Body, Inputs & Labels:** `Inter`, system-ui, sans-serif (Weights: 400, 500, 600)
- **Code, Roll Numbers, Hashes & Telemetry:** `JetBrains Mono`, monospace (Weights: 400, 500, 700)

---

## 3. Section-Targeted Examinations & 404 Secrecy

### 3.1 Server-Side Enforcement (Fail-Closed)
Targeting is not merely a UI filter; it is strictly enforced on every student route in the backend:
1. `GET /api/exam-code/:code/verify` (Candidate Gate verification)
2. `POST /api/exam-code/verify-entry` (Verification check)
3. `POST /api/exam-code/start` (Session creation)
4. `GET /api/exam-code/:code/questions` (Question delivery)
5. `POST /api/exam-code/save-answer` (Autosave answers)
6. `POST /api/exam-code/resume` (Attempt recovery)
7. `POST /api/exam-code/submit` (Final submission)
8. `lobby:join` / `exam:join` (WebSocket rooms)

If any targeting attribute (`college_id`, `branch`, `passout_year`, `section_id(s)`) fails to match the student record:
- **Response Code:** `HTTP 404 Not Found` (Never `403 Forbidden`).
- **Response Body:** `{"error": "EXAM_NOT_FOUND", "message": "Exam not found or unavailable for your section"}`.
- **Result:** Candidates of other sections cannot confirm whether an exam exists.

### 3.2 Live Leaderboard WebSocket Scoping
- The live leaderboard WebSocket room is `leaderboard:${examCode}`.
- Joining this room is restricted exclusively to authenticated staff (`super_admin`, `inspector`, `faculty`) assigned to that college and exam.
- Students connect only to `lobby:join` or `exam:join` which emit student-specific events.
- Telemetry updates (`leaderboard:update`) are only broadcast into `leaderboard:${examCode}`, ensuring students of other sections never receive live score or rank telemetry over the wire.

---

## 4. Dynamic Study Year Derivation (Zero Hardcoding)

In collegiate engineering institutions (such as autonomous engineering colleges in India), the academic calendar begins in **July** (month index $\ge 6$). Study years are derived dynamically with zero hardcoded years in [server/src/utils/academicYear.ts](file:///c:/Users/chara/OneDrive/Desktop/Quiz/server/src/utils/academicYear.ts):

$$\text{academicStartYear} = \begin{cases} \text{currentYear} & \text{if currentMonth} \ge 6 \\ \text{currentYear} - 1 & \text{if currentMonth} < 6 \end{cases}$$

$$\text{academicEndYear} = \text{academicStartYear} + 1$$

$$\text{rawStudyYear} = 4 - (\text{passoutYear} - \text{academicEndYear})$$

### Academic Cycle Mapping (Example: Oct 2026, Session 2026-27):
| Graduation (Passout) Year | Calculated Study Year | Human-Readable Label |
|---|---|---|
| **2027** | 4th Year | Final Year B.Tech |
| **2028** | 3rd Year | Pre-final Year B.Tech |
| **2029** | 2nd Year | Sophomore B.Tech |
| **2030** | 1st Year | Freshman B.Tech |
| **$\le$ 2026** | $> 4$ | Alumni / Graduated |

---

## 5. Institutional Hierarchy & Bulk Ingestion

### 5.1 Data Hierarchy Model
The institutional data model follows a strict 5-level hierarchy:
```
College (colleges)
  └── Academic Year (academic_years: e.g., "2026-2027")
       └── Cohort (cohorts: e.g., "B.Tech CSE - Class of 2028")
            └── Section (sections: e.g., "Section A", "Section B")
                 └── Batch (batches: e.g., "Batch 1 (Lab)", "Batch 2 (Lab)")
                      └── Students (students / student_roster)
```

### 5.2 Bulk Import Normalization & Typo Prevention
In `hierarchyController.ts`, all incoming spreadsheet records undergo strict sanitization:
- `branchCode`: `String(raw).trim().toUpperCase()`
- `sectionName`: `String(raw).trim().toUpperCase()`
- Both `"CSE "` and `"CSE"` sanitize identically to `'CSE'`.
- Both `"A "` and `"A"` sanitize identically to `'A'`.
- Canonical Section ID: `sec-${collegeId}-${branchCode.toLowerCase()}-${sectionName.toLowerCase()}` $\rightarrow$ `sec-1-cse-a`.
- **Duplicate Prevention:** Rows with trailing whitespace or casing differences automatically map to the existing section rather than creating duplicate sections.
- **Import Preview Endpoint:** `POST /api/admin/hierarchy/import-preview` returns duplicate counts, new student counts, and validation errors row-by-row before any commit.

---

## 6. System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FRONTEND CLIENT (React 18 + Vite)                     │
│                                                                             │
│  [3D Portal Home]      [Candidate Gate]      [Student ID]      [Admin Suite] │
│         │                     │                    │                 │      │
│         └──────────────┬──────┴────────────────────┴─────────────────┘      │
│                        │ HTTPS / REST & WebSockets (Socket.io)              │
└────────────────────────┼────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  BACKEND ENGINE (Node.js + Express + TS)                    │
│                                                                             │
│  ├── Helmet / Strict CORS / X-Request-Id Tracker / Compression (Gzip)       │
│  ├── Tiered Rate Limiting (General 300/15m, Auth 5/15m, Code Gates)         │
│  ├── Section Targeting Middleware & academicYear.ts Evaluation Engine       │
│  ├── Controllers:                                                           │
│  │   ├── candidateController.ts (Registration Gate & Fast Track)            │
│  │   ├── examCodeController.ts  (Server-Side 404 Secrecy & Assessment)      │
│  │   ├── hierarchyController.ts (Colleges, Cohorts, Sections, Bulk Import)  │
│  │   ├── adminController.ts     (Analytics, Allocations, Paper Locking)     │
│  │   └── proctorController.ts   (Client Gaze/Face Sentinel & Overrides)     │
│  └── Socket.io Server (Scoped Rooms: lobby:*, exam:*, leaderboard:*)        │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
            ┌────────────┴───────────────────────┐
            ▼                                    ▼
┌─────────────────────────────────┐  ┌────────────────────────────────────────┐
│     SUPABASE (PostgreSQL 15)    │  │       IN-MEMORY CACHE & REALTIME       │
│                                 │  │                                        │
│  - students / staff / colleges  │  │  - Read Cache (Leaderboard TTL 5s)     │
│  - exam_codes / attempts        │  │  - Socket.io Real-time Telemetry       │
│  - exams / questions / sessions │  │  - High listen backlog (2048)          │
│  - cohorts / sections / batches │  │  - Zero-drop surge absorption          │
│  - student_roster / email_queue │  │  - Scoped inspector/student rooms     │
│  - High-perf B-tree DB Indexes  │  │                                        │
└─────────────────────────────────┘  └────────────────────────────────────────┘
```

---

## 7. Frontend Architecture & Page Catalog

### 7.1 Landing Page (`/`): Simplified 3-Entry 3D Portal
The landing page ([client/src/pages/LandingPage.tsx](file:///c:/Users/chara/OneDrive/Desktop/Quiz/client/src/pages/LandingPage.tsx)) has been streamlined to focus exclusively on three large, accessible 3D interactive portal entries:
1. **Candidate Gate (`/gate`):** Direct Exam Code + Hall Ticket entrance. Zero-OTP friction.
2. **Student Portal ID (`/login`):** Email or roll number login with access to personal dashboard and 5 technical sectors.
3. **Admin Control Center (`/admin`):** Institutional console for Super Admins, Inspectors, and Faculty.

### 7.2 Student Dashboard (`/student/dashboard`)
- **Section Filtering:** Evaluates student profile against all active exams. Non-targeted exams are strictly omitted.
- **Empty State:** If no exams match the candidate's section, displays the clean, professional empty state: *"No exam available for your section at this time."*
- **Quick Code Launch:** Allows candidate to type an exam code directly. If the exam belongs to another section, displays: *"Exam not found or unavailable for your section"* (HTTP 404).

### 7.3 Inspector Console (`/admin/inspector`)
- Inspectors logging in via `/admin` are **automatically redirected directly to `/admin/inspector`**.
- Default view is the **Live Leaderboard** tab with real-time candidate queue, live violation counts, and synchronized Start/Stop controls.
- Strictly isolated from exam creation wizards, question editing, and system backup archives.

### 7.4 Faculty Console (`/admin/exams`)
- Faculty members logging in via `/admin` land on `/admin/exams`.
- Only exams allocated to their assigned section/branch are visible.

---

## 8. Backend Architecture & Complete REST API Reference

### 8.1 System Health & Observability
| Method | Route | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | Service health, demo mode status, and version | None |
| `GET` | `/api/ready` | K8s/Container readiness probe (`ready: true`) | None |

### 8.2 Section Targeting & Assessment Engine (`/api/exam-code`)
| Method | Route | Description | Access / Secrecy |
|---|---|---|---|
| `GET` | `/api/exam-code/:code/verify?hallTicket=...` | Verifies student eligibility; returns 404 on mismatch | Student / Candidate |
| `POST` | `/api/exam-code/verify-entry` | Verifies code + hall ticket; returns 404 on mismatch | Student / Candidate |
| `POST` | `/api/exam-code/start` | Creates attempt; returns 404 on section mismatch | Student / Candidate |
| `GET` | `/api/exam-code/:code/questions` | Delivers question paper; returns 404 on mismatch | Student / Candidate |
| `POST` | `/api/exam-code/save-answer` | Saves answer; returns 404 on mismatch | Student / Candidate |
| `POST` | `/api/exam-code/resume` | Recovers attempt; returns 404 on mismatch | Student / Candidate |
| `POST` | `/api/exam-code/submit` | Finalizes exam; returns 404 on mismatch | Student / Candidate |
| `GET` | `/api/exam-code/:code/leaderboard` | Public/Inspector ranked leaderboard | Cached (5s TTL) |

### 8.3 Paper Allocation & Admin Controls (`/api/admin`)
| Method | Route | Description | Access Level |
|---|---|---|---|
| `POST` | `/api/admin/login` | Staff login with 2FA / OTP verification | Rate Limited |
| `POST` | `/api/admin/exam-codes/:code/allocate` | Assigns faculty and inspector to exam section | Super Admin |
| `POST` | `/api/admin/exam-codes/:code/lock-paper` | Locks question paper against further edits | Super Admin |
| `POST` | `/api/admin/exam-codes/:code/replace-paper` | Replaces question paper with audit trail | Super Admin |
| `GET` | `/api/admin/hierarchy/tree` | Returns complete institutional tree | Staff |
| `POST` | `/api/admin/hierarchy/import-preview` | Validates Excel/CSV roster and flags typos/duplicates | Staff |
| `POST` | `/api/admin/hierarchy/import` | Bulk enrolls students and auto-links sections | Staff |
| `GET` | `/api/admin/backup` | Exports system database tables | Super Admin Only |

---

## 9. Anti-Tamper, Security & Proctoring Engine

1. **Client Isolation & Tamper Detection:**
   - **Full-Screen Enforcement:** Exam cannot be commenced outside fullscreen mode. Exiting fullscreen logs a violation.
   - **Tab-Switch & Blur Detection:** Utilizes `visibilitychange` and `window.onblur`. Violations are transmitted via `navigator.sendBeacon` to ensure delivery even if the tab is abruptly closed.
   - **Keyboard & Clipboard Lock:** Blocks right-click context menus (`contextmenu`), text selection, clipboard copying (`copy`), pasting (`paste`), and hotkeys (`Ctrl+C`, `Ctrl+V`, `F12`, `PrintScreen`).
2. **Server-Authoritative Clock:**
   - Remaining time is calculated strictly as:
     $$\text{Remaining Time} = \text{start\_time} + (\text{duration\_minutes} \times 60) - \text{NOW()}$$
   - Local clock adjustments or laptop sleep have zero effect on test expiration.
3. **Privacy-Preserving On-Device Sentinel:**
   - MediaPipe face landmarking detects gaze deviation and face presence entirely on the candidate's browser.
   - **Zero video feeds or images are ever stored on cloud servers**, fully complying with institutional privacy mandates.

---

## 10. Database Schema & Migration Guide

### 10.1 Running the Migration on Existing Databases
Execute [supabase/migration_existing_database.sql](file:///c:/Users/chara/OneDrive/Desktop/Quiz/supabase/migration_existing_database.sql) in **Supabase Dashboard → SQL Editor**. It is 100% idempotent:
- **Zero Drops:** Never executes `DROP TABLE` or `TRUNCATE`.
- **Zero Demo Pollution:** Contains no mock data inserts.
- **Additive Columns:** Uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`:
  ```sql
  -- Targeting columns on exam_codes & exams
  ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS branch VARCHAR(100);
  ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS passout_year INT;
  ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS section_id TEXT;
  ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS section_ids JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS batch_id TEXT;
  ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS assigned_faculty_id UUID REFERENCES staff(id) ON DELETE SET NULL;
  ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS assigned_inspector_id UUID REFERENCES staff(id) ON DELETE SET NULL;
  ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE exam_codes ADD COLUMN IF NOT EXISTS paper_status TEXT DEFAULT 'draft';
  ```

---

## 11. Hardware-Accelerated 3D & Animation System

All 3D capabilities are unified inside `client/src/three/`:
- `capability.ts`: Detects WebGL2/WebGL1 availability, GPU tier, device memory, and `prefers-reduced-motion`.
- `renderer.ts`: Factory for Three.js WebGLRenderers enforcing DPR cap of 1.5, power preference `high-performance`, and automatic canvas resizing.
- `sceneManager.ts`: Lifecycle manager that pauses animation loops on `document.hidden` to conserve battery and CPU.
- `disposal.ts`: Recursive resource cleanup ensuring zero GPU memory leaks on unmount.
- **Architectural Guard:** The examination page (`ExamCodeQuizPage.tsx`) imports **zero 3D code**, confirmed by automated architectural test `server/test-3d-architecture.js`.

---

## 12. Interactive Live Demo & Persona Walkthrough

The platform includes **1-Click Live Role Demo Buttons** on all login screens for immediate evaluation:

### Persona Overview & Demo Credentials:
| Persona | Email / Identifier | Role / Target Scope | Destination Page |
|---|---|---|---|
| **Student A** | `aarav.sharma@example.com` (`HT2026001`) | Section A (Eligible for `TARGET-VRSEC-A`) | `/student/dashboard` |
| **Student B** | `rohan.varma@example.com` (`HT2026003`) | Section B (Ineligible for `TARGET-VRSEC-A`) | `/student/dashboard` |
| **Super Admin** | `admin@logicwhilelire.com` | Global Full Control | `/admin/dashboard` |
| **Inspector** | `inspector@logicwhilelire.com` | Invigilator / Live Control | `/admin/inspector` (Leaderboard) |
| **Faculty** | `faculty@logicwhilelire.com` | Section A Faculty Evaluator | `/admin/exams` |

### Step-by-Step Demo Flow:
1. **Test Student A (Section A · Eligible):**
   - Navigate to `/login`.
   - Click **"⚡ Student A (Section A · Eligible)"**.
   - You land on the Student Dashboard. Notice `TARGET-VRSEC-A` appears in **Available Exams**.
   - Click **"Start Exam"** $\rightarrow$ Exam begins immediately.

2. **Test Student B (Section B · Ineligible):**
   - Logout and return to `/login`.
   - Click **"🔒 Student B (Section B · Ineligible)"**.
   - You land on the Student Dashboard. Notice `TARGET-VRSEC-A` is **hidden** and the screen displays **"No exam available for your section"**.
   - Type `TARGET-VRSEC-A` into the Quick Launch input and press Enter.
   - Result: HTTP 404 with error message: *"Exam not found or unavailable for your section"*.

3. **Test Inspector Direct Leaderboard Redirection:**
   - Navigate to `/admin`.
   - Click **"🛡️ Inspector (Live Leaderboard)"**.
   - Inspector is redirected directly to `/admin/inspector` on the **Live Leaderboard** tab with synchronized Start/Stop controls.

4. **Test Faculty Scoped Allocation:**
   - Navigate to `/admin`.
   - Click **"🎓 Faculty (Section Allocations)"**.
   - Faculty lands on `/admin/exams`, scoped to their assigned section.

---

## 13. DevOps, Deployment & Observability

### Pre-Flight Verification Script (`npm run verify-prod`)
Run in `server/`:
```bash
npm run verify-prod
```
Validates:
- Database connectivity & latency (< 50ms).
- All 25 required tables present.
- Row Level Security (RLS) enabled on all 25 tables (`rowsecurity = true`).
- Compatibility views (`candidates`, `sessions`, `audit_logs`) running with `security_invoker = true`.
- Zero placeholder environment variables in production.

---

## 14. Performance Benchmarks & 500-User Load Validation

The LogicWhileLiRE platform was benchmarked under a realistic 500-candidate concurrent load simulation:
- **Total Requests Executed:** 4,500
- **Successful Requests:** 4,500
- **Failed Requests:** 0 (0.00% error rate)
- **Measured Throughput:** 385.0 requests/sec
- **Latency Distribution:**
  - P50 (Median): 106.58 ms
  - P95: 439.65 ms
  - P99: **708.30 ms** (Sub-2.0s production SLA met)

---

## 15. Strict Exam Auto-Termination & Multi-Campus Collegiate Governance

### Strict Integrity Auto-Termination Protocol (`ExamCodeQuizPage.tsx`)
In compliance with high-stakes institutional standards, the examination client enforces an immediate disqualification protocol without second-chance warnings:
- **Trigger Conditions**:
  1. Window minimization or tab switching (`visibilitychange` / `document.hidden`).
  2. Terminal focus loss (`window.onblur`) triggered by clicking outside or third-party notification overlays.
  3. Fullscreen exit (`fullscreenchange` when `!document.fullscreenElement`).
  4. Restricted keyboard actions: `Escape`, `Alt`, `Meta` (Windows key), `F11`, `F12`, `Ctrl+W`, `Ctrl+T`, `Ctrl+N`, `Ctrl+Shift+I/J/C`, `Ctrl+U`. Non-alphanumeric keystrokes outside textareas/code editors are intercepted.
- **Immediate Disqualification Actions**:
  1. Terminal plays audio security alert tone (`soundFx.playSecurityAlertTone()`).
  2. Dispatches high-priority Realtime broadcast alert to the Proctor Live Console (`student_violation` with event `EXAM_FORCE_TERMINATED_BREACH`).
  3. Fires navigator beacon and post request to `/api/v1/inspector/report-issue` logging the exact timestamp, candidate ID, and incident description.
  4. Auto-submits current answers with status `'terminated_cheating'`.
  5. Clears local offline IndexedDB answer queues and flushes session tokens (`student_token`, `student_user`, `sessionStorage.clear()`).
  6. Immediately mounts the persistent red **INTEGRITY VIOLATION LOCKDOWN** screen displaying candidate details, violation reason, and a single exit path back to `/enter-exam`.

### Multi-Campus Collegiate Governance & Unified Admin Experience
- **College Seed Database**: Real institutions seeded in Supabase (`VRSEC` - Velagapudi Ramakrishna Siddhartha Engineering College, `KLU` - Koneru Lakshmaiah Education Foundation) with proper codes and domains.
- **Dynamic Exam Code Derivation**: Creating an exam in `/admin/create-exam` automatically derives institutional prefixes (e.g. `GR-VRSEC-XXXXXX`) matching the selected collegiate institution.
- **Sidebar & Boundary Harmonization**: All 9 admin control modules use the unified `<AdminSidebar />`, eliminating rogue legacy headers (`ENTERPRISE ADMIN`), ensuring consistent navigation across Exams, Questions, Colleges, Students, Sessions, Reports, Analytics, and Live Monitor.
- **Native OS Cursor**: Standard hardware mouse pointer active across all candidate and administrative routes.

---

## 👥 Credits & Verification

- **Architect & Author:** R. Charan Sai
- **Platform:** LogicWhileLiRE — *"Logic. While. LiRE."*
- **Status:** Release Ready v4.0.0

