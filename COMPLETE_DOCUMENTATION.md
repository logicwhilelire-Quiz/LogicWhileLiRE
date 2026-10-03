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
3. [System Architecture & Data Flow](#3-system-architecture--data-flow)
4. [Frontend Architecture & Page Catalog](#4-frontend-architecture--page-catalog)
5. [Backend Architecture & Complete REST API Reference](#5-backend-architecture--complete-rest-api-reference)
6. [Anti-Tamper, Security & Proctoring Engine](#6-anti-tamper-security--proctoring-engine)
7. [Database Schema & Data Dictionary](#7-database-schema--data-dictionary)
8. [Hardware-Accelerated 3D & Animation System](#8-hardware-accelerated-3d--animation-system)
9. [DevOps, Deployment & Observability](#9-devops-deployment--observability)
10. [Performance Benchmarks & 500-User Load Validation](#10-performance-benchmarks--500-user-load-validation)

---

## 1. Executive Summary & System Overview

**LogicWhileLiRE** is an enterprise-grade, high-throughput Campus Recruitment Training (CRT) and coding assessment platform engineered specifically for autonomous engineering colleges, technical universities, and recruitment drives.

### Core Capabilities
- **High-Throughput Assessment Gate:** High-concurrency registration and queueing gate preventing database bottlenecks during simultaneous logins of 5,000+ candidates.
- **Exam Code Flow (Zero-OTP Friction):** Direct entrance with pre-generated institutional Exam Codes (`DEMO123`, `LW-TECH-2026`, `GR-TECH-2026`) + Student Hall Ticket numbers, completely eliminating SMS/Email OTP bottlenecks.
- **Server-Authoritative Clock:** Examination timers are computed exclusively on the server (`started_at + duration_minutes`). Client-side clock manipulation or browser pauses cannot extend test duration.
- **Anti-Cheat Hardware & Canvas Fingerprinting:** Continuous detection of tab switching, window blurring, developer tools execution, screen resizing, and multi-session concurrency conflicts.
- **Client-Side Face Sentinel:** On-device MediaPipe landmarking detects face absence, multiple faces, and looking away. Zero video feeds or audio streams are ever transmitted or stored on cloud servers.
- **Real-Time Leaderboard:** Powered by sub-second ranking computation and WebSocket push mechanisms across thousands of concurrent test takers.
- **Argon2id & 12-Round Bcrypt Hashing:** High-security password storage where plaintext secrets never leave the server memory.
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

All Google Fonts are loaded with `font-display: swap` for instant text rendering.

---

## 3. System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FRONTEND CLIENT (React 18 + Vite)                     │
│                                                                             │
│  [Landing Page]    [Candidate Gate]    [Exam Code Entry]    [Admin Suite]   │
│         │                 │                   │                   │         │
│         └───────────┬─────┴───────────────────┴───────────────────┘         │
│                     │ HTTPS / JSON & WebSockets                             │
└─────────────────────┼───────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  BACKEND ENGINE (Node.js + Express + TS)                    │
│                                                                             │
│  ├── Helmet / Strict CORS / X-Request-Id Tracker / Compression (Gzip)       │
│  ├── Tiered Rate Limiting (General 300/15m, Auth 5/15m, Code Gates)         │
│  ├── Controllers:                                                           │
│  │   ├── candidateController.ts (AL-SPEC-2026-REG Gate)                    │
│  │   ├── examCodeController.ts  (No-OTP Assessment Engine)                  │
│  │   ├── sessionController.ts   (Server-Timed Proctored Session)            │
│  │   ├── adminController.ts     (Analytics, Reports, Staff, Exams)          │
│  │   └── proctorController.ts   (Client Gaze/Face Sentinel & Overrides)     │
│  └── Graceful Shutdown Handlers (SIGTERM, SIGINT) & Readiness Check         │
└─────────────────────┬───────────────────────────────────────────────────────┘
                      │
         ┌────────────┴───────────────────────┐
         ▼                                    ▼
┌─────────────────────────────────┐  ┌────────────────────────────────────────┐
│     SUPABASE (PostgreSQL 15)    │  │       IN-MEMORY CACHE & REALTIME       │
│                                 │  │                                        │
│  - students / staff / colleges  │  │  - Read Cache (Leaderboard TTL 5s)     │
│  - exam_codes / attempts        │  │  - Socket.io Real-time Telemetry       │
│  - exams / questions / sessions │  │  - High listen backlog (2048)          │
│  - High-perf B-tree DB Indexes  │  │  - Zero-drop surge absorption          │
└─────────────────────────────────┘  └────────────────────────────────────────┘
```

---

## 4. Frontend Architecture & Page Catalog

The frontend is built using React 18, Vite, and modern CSS. All 20+ routes are code-split via `React.lazy` and `Suspense` inside `client/src/App.tsx`.

### 4.1 Candidate Experience
- **Public Marketing Landing (`/`):** `client/src/pages/LandingPage.tsx`
  - Canonical LogicWhileLiRE logo, hero showcase, live animated counter, feature breakdown, and developer credit (*R. Charan Sai*).
- **Exam Code Entrance (`/enter-exam`):** `client/src/pages/EnterExamPage.tsx`
  - Hall Ticket Number + Master Exam Code entry with immediate active-window verification.
- **Pre-Assessment Instructions (`/instructions/:examCode`):** `client/src/pages/InstructionsPage.tsx`
  - Fullscreen enforcement consent, anti-tamper penalty notice, webcam sentinel preview.
- **Candidate Registration Gate (`/register`, `/gate`):** `client/src/pages/CandidateRegisterGatePage.tsx`
  - 4-stage identity wizard with live SHA-256 preview and debounced roll number composite check.
- **Contest Waiting Lobby (`/contest/:contestId/waiting-lobby`):** `client/src/pages/WaitingLobbyPage.tsx`
  - Live participant proximity network, countdown timer, and automated handoff into test.
- **Proctored Exam Room (`/quiz/:examCode`):** `client/src/pages/ExamCodeQuizPage.tsx`
  - **Zero 3D modules imported** (backed by 4 dedicated 2D components: `ExamTimerProgress`, `ExamFaceMonitor`, `ExamCodeEditor`, `ExamQuestionCard`).
  - Real-time question palette, full-screen lock, offline IndexedDB sync queue, auto-save answers.
- **Score Report Breakdown (`/result-ec/:examCode`):** `client/src/pages/ResultECPage.tsx`
  - Immediate score computation, accuracy percentage, topic radar, and time taken.
- **Real-Time Leaderboard (`/leaderboard-ec/:examCode`):** `client/src/pages/LeaderboardECPage.tsx`
  - Dynamic podium for top 3 candidates and institutional score distribution.

### 4.2 Administrative Console (`/admin/*`)
- **Admin Login (`/admin`):** Rate-limited administrator authentication.
- **Dashboard (`/admin/dashboard`):** Real-time candidate counts, active exams, and system health status.
- **Colleges Management (`/admin/colleges`):** Institutional tenant management.
- **Exam Codes Management (`/admin/exam-codes`):** Generate and manage zero-OTP access codes.
- **Create Exam Wizard (`/admin/create-exam`):** Multi-section exam creator with question randomized shuffling.
- **Bulk Enrollment (`/admin/bulk-enroll`):** Instant CSV/Excel ingestion of candidate rosters.
- **Live Proctoring Sessions (`/admin/sessions`):** Real-time candidate telemetry, violation logs, and false-positive override controls.
- **Analytics & Exports (`/admin/analytics`, `/admin/reports`):** Question discrimination index, topic accuracy breakdowns, and CSV score ledgers.

---

## 5. Backend Architecture & Complete REST API Reference

### 5.1 System Health & Observability
| Method | Route | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | Service health, demo mode status, and version | None |
| `GET` | `/api/ready` | K8s/Container readiness probe (`ready: true`) | None |
| `GET` | `/health` | Legacy backwards-compatible health check | None |

### 5.2 Exam Code System (`/api`)
| Method | Route | Description | Flow |
|---|---|---|---|
| `POST` | `/api/exam-code/validate` | Validates exam code + hall ticket; checks start/end time window | Entry Gate |
| `GET` | `/api/exam-code/:examCode/instructions` | Fetches exam rules, duration, subject, institutional owner | Instructions |
| `POST` | `/api/exam-code/start` | Creates `exam_code_attempts` record, initializes server end time | Exam Start |
| `POST` | `/api/exam-code/answer` | Saves candidate answer option, tracks latency in ms | Live Answer |
| `POST` | `/api/exam-code/violation` | Logs tab switches / blur; terminates attempt if violation count > 2 | Proctoring |
| `POST` | `/api/exam-code/submit` | Finalizes attempt, computes score, accuracy, topic breakdown | Final Submit |
| `GET` | `/api/exam-code/:examCode/result/:hallTicket` | Returns scorecard, topic mastery, and question breakdown | Scorecard |
| `GET` | `/api/exam-code/:examCode/leaderboard` | Returns live ranked leaderboard (cached with 5s TTL) | Ranking |

### 5.3 Administrative Suite (`/api/admin`)
| Method | Route | Description | Access Level |
|---|---|---|---|
| `POST` | `/api/admin/login` | Super admin / faculty authentication | Rate Limited |
| `GET` | `/api/admin/exams` | Lists all created exams | Admin / Faculty |
| `POST` | `/api/admin/exams` | Creates timed exam with proctoring alert settings | Admin / Faculty |
| `POST` | `/api/admin/exams/:id/bulk-enroll` | Uploads student CSV roster for bulk registration | Admin / Faculty |
| `GET` | `/api/admin/exams/:id/sessions` | Paginated live sessions with violation counts | Admin / Faculty |
| `POST` | `/api/admin/attempts/:id/extend-time` | Extends candidate time during legitimate incidents | Admin / Faculty |
| `POST` | `/api/admin/attempts/:id/force-submit` | Concludes candidate test remotely | Admin / Faculty |
| `PATCH` | `/api/admin/attempts/:id/violations/:vId/review` | Decrements violation strike on false positive | Admin / Faculty |

---

## 6. Anti-Tamper, Security & Proctoring Engine

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

## 7. Database Schema & Data Dictionary

### Core Tables & B-Tree Optimization
- `colleges`: Institutional accounts with unique `college_code`.
- `students`: Candidate profiles with composite uniqueness constraint `(college_id, roll_number)` and high-speed B-tree index.
- `exam_codes`: Master institutional exam keys with time windows.
- `exam_code_attempts`: Candidate examination runs with answers, violation timeline, and scores.
- `questions_ec`: Question bank with topic classifications and difficulty ratings.
- `staff`: Role-Based Access Control (`admin`, `college_admin`, `faculty`).

---

## 8. Hardware-Accelerated 3D & Animation System

All 3D capabilities are unified inside `client/src/three/`:
- `capability.ts`: Detects WebGL2/WebGL1 availability, GPU tier, device memory, and `prefers-reduced-motion`.
- `renderer.ts`: Factory for Three.js WebGLRenderers enforcing DPR cap of 1.5, power preference `high-performance`, and automatic canvas resizing.
- `sceneManager.ts`: Lifecycle manager that pauses animation loops on `document.hidden` to conserve battery and CPU.
- `disposal.ts`: Recursive resource cleanup ensuring zero GPU memory leaks on unmount.
- **Architectural Guard:** The examination page (`ExamCodeQuizPage.tsx`) imports **zero 3D code**, confirmed by automated architectural test `server/test-3d-architecture.js`.

---

## 9. DevOps, Deployment & Observability

### Deployment Artifacts
- **Frontend (Netlify):** `netlify.toml` with SPA redirects, security headers, and immutable asset caching.
- **Backend (Render):** `render.yaml` with production and staging service blueprints, health checks, and secure secrets injection.
- **Operational Runbook:** `OPS.md` covering backup/restore procedures, secrets rotation, and incident checklists.

### Logging & Request Tracing
Every HTTP request receives a unique `X-Request-Id` (UUID v4) propagated across logs and response headers for distributed tracing and rapid incident resolution.

---

## 10. Performance Benchmarks & 500-User Load Validation

The LogicWhileLiRE platform was benchmarked under a realistic 500-candidate concurrent load simulation across 7 phases:
- **Total Requests Executed:** 4,500
- **Successful Requests:** 4,500
- **Failed Requests:** 0 (0.00% error rate)
- **Measured Throughput:** 385.0 requests/sec
- **Latency Distribution:**
  - P50 (Median): 106.58 ms
  - P95: 439.65 ms
  - P99: **708.30 ms** (Sub-2.0s production SLA met)

---

## 👥 Credits & Verification

- **Architect & Author:** R. Charan Sai
- **Platform:** LogicWhileLiRE — *"Logic. While. LiRE."*
- **Status:** Release Ready v4.0.0
