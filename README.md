# LogicWhileLiRE — Enterprise 3D Examination & Assessment Engine

[![Node.js CI](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL%203D-049EF4?logo=three.js&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-0A3F8F)](LICENSE)

> **"Logic. While. LiRE."** — *Learn. Reason. Excel.*  
> Developed & Architected by **R. Charan Sai**  
> © 2026 LogicWhileLiRE. All rights reserved.

---

## 🚀 Overview

**LogicWhileLiRE** is an autonomous, high-throughput Campus Recruitment Training (CRT) and institutional examination platform engineered specifically for engineering colleges, technical universities, and large-scale competitive drives.

Engineered for 5,000+ candidate concurrency, LogicWhileLiRE integrates a complete **3D Full-Stack Experience**: interactive WebGL 3D Technical Sectors Universe, multi-axis 3D competency radar visualizers, proctored zero-OTP entrance system, server-authoritative timekeeping, and real-time behavioral telemetry.

### Key Pillars & 3D Technical Sectors
- **5-Sector Competency Framework:**
  1. **Sector 1 · Quantitative Aptitude & Numerical Velocity (Set A)**
  2. **Sector 2 · Logical Reasoning & Deductive Logic (Set B)**
  3. **Sector 3 · Core Computer Science & Systems (Set C)**
  4. **Sector 4 · Data Structures & Algorithms (Set D)**
  5. **Sector 5 · Full-Stack Architecture & Distributed Systems (Set E)**
- **Interactive 3D WebGL Universe (`SectorsUniverse3D`):** Orbiting polyhedral sector nodes around a glowing LogicWhileLiRE core with real-time HUD telemetry, hover animations, and raycaster navigation.
- **3D Dynamic Radar Competency Visualizer (`SectorRadar3D`):** 5-axis 3D radar polygon comparing candidate sector performance against live cohort benchmarks.
- **Zero-OTP Exam Entrance:** Frictionless candidate entry via Hall Ticket + Institutional Exam Code (`DEMO123`, `LWL-TECH-2026`, `GR-TECH-2026`).
- **Server-Authoritative Clock:** Examination clocks compute strictly against the database server (`started_at + duration_minutes`). Local clock manipulation cannot prolong test time.
- **Continuous Anti-Tamper & Proctoring:** Active detection of tab switching, window blurring, developer tools execution, screen dimension manipulation, and multi-session concurrency conflicts.
- **Zero-3D Exam Screen Guard:** High-fidelity 3D on landing, lobby, practice arena, and analytics; isolated 0-overhead 2D on the active exam screen for guaranteed 60fps across all devices.

---

## ⚡ 5-Minute Quickstart (Demo Mode)

GROWTHRAN comes with a self-contained in-memory demo engine that allows instant local evaluation with **zero external dependencies** (no Supabase account or cloud services needed).

### 1. Clone & Install

```bash
# Clone the repository
git clone https://github.com/your-username/Quiz.git
cd Quiz

# Install backend dependencies & setup environment
cd server
npm install
cp .env.example .env    # On Windows PowerShell: copy .env.example .env

# Install frontend dependencies
cd ../client
npm install
```

### 2. Launch Local Servers

In Terminal 1 (Backend Server):
```bash
cd server
npm run dev
```
*The server starts at `http://localhost:3001` in demo mode.*

In Terminal 2 (Frontend Client):
```bash
cd client
npm run dev
```
*The client starts at `http://localhost:5173`.*

### 3. Seed Demo Dataset

In Terminal 3, initialize clean demo records:
```bash
cd server
npm run seed:demo
```

### 4. Complete Output Portals Directory

The **LogicWhileLiRE** ecosystem features dedicated portals for Candidates, Invigilators, and Administrators:

#### 🌐 A. Public & Candidate Portals
- **Public 3D Experience Portal:** [http://localhost:5173/](http://localhost:5173/)
  - Interactive 3D Sectors Universe, dynamic brand header, live feature matrix.
- **3D Practice Arena & Sandbox:** [http://localhost:5173/practice](http://localhost:5173/practice)
  - Real-time question testing sandbox with interactive scoring.
- **Candidate Registration Gate (Argon2id):** [http://localhost:5173/gate](http://localhost:5173/gate)
  - Strict RFC 5322 email validation, roll number uniqueness, biometric capture.
- **Candidate Exam Entrance (Zero-OTP):** [http://localhost:5173/enter-exam](http://localhost:5173/enter-exam)
  - Hall Ticket: `2201A0501` · Exam Code: `DEMO123`
- **Candidate Secure Exam Terminal:** [http://localhost:5173/quiz/DEMO123](http://localhost:5173/quiz/DEMO123)
  - Dynamic holographic anti-leak watermark, in-exam scratchpad & canvas, Invigilator Desk & AI Sentinel HUD, Web Audio Synthesizer, developer-tool lock.
- **Synchronous Waiting Lobby:** [http://localhost:5173/contest/demo-contest/waiting-lobby](http://localhost:5173/contest/demo-contest/waiting-lobby)
  - Live synchronized countdown clock and participant roster.
- **Candidate Scorecard & Result:** [http://localhost:5173/result-ec/DEMO123](http://localhost:5173/result-ec/DEMO123)
  - Full competency scorecards and automated verification hash.
- **Real-Time 3D Leaderboard:** [http://localhost:5173/leaderboard-ec/DEMO123](http://localhost:5173/leaderboard-ec/DEMO123)
  - Live 3D podium with sub-second rank updates.
- **Cryptographic Certificate Verification:** [http://localhost:5173/verify](http://localhost:5173/verify)
  - Instant tamper-proof credential validation.

#### 🛡️ B. Invigilator & Chief Inspector Command Centers
- **Master Inspector Surveillance Command Center:** [http://localhost:5173/admin/monitor/DEMO123](http://localhost:5173/admin/monitor/DEMO123)
  - 3D Orbital Candidate Matrix (Three.js radar sweep)
  - Biometric WebCam Multi-Feed Wall (every candidate's live video, face mesh outline, gaze tracker, sound meter)
  - AI Threat Index Meter (0-100%, risk bands, smart auto-recommendations)
  - Emergency Master Room Freeze (`⏸️ Master Room Freeze` / `▶️ Resume All`)
  - Remote Candidate Commands (whisper warning, +5m time extension, pause, disqualify)
  - Outbound Email & Notification Dispatch Hub modal (`📨 Mail Dispatch Hub`)
  - Candidate Forensic Flight Recorder & Dossier export (JSON)
- **Live Instructor Console:** [http://localhost:5173/admin/live-console/DEMO123](http://localhost:5173/admin/live-console/DEMO123)

#### 🏛️ C. Institutional Admin Management Portals
- **Admin Control Center:** [http://localhost:5173/admin/dashboard](http://localhost:5173/admin/dashboard)
  - Login: [http://localhost:5173/admin](http://localhost:5173/admin) (Username: `admin`, Password: `admin123`)
- **Exam Control & Scheduling:** [http://localhost:5173/admin/exams](http://localhost:5173/admin/exams)
- **AI Question Bank & Generator:** [http://localhost:5173/admin/questions](http://localhost:5173/admin/questions)
- **Student Master Directory:** [http://localhost:5173/admin/students](http://localhost:5173/admin/students)
- **Results Ledger & Publishing:** [http://localhost:5173/admin/results](http://localhost:5173/admin/results)
- **Access Codes & Passcodes:** [http://localhost:5173/admin/exam-codes](http://localhost:5173/admin/exam-codes)
- **Colleges & Universities:** [http://localhost:5173/admin/colleges](http://localhost:5173/admin/colleges)
- **Forensic Psychometric Analytics:** [http://localhost:5173/admin/analytics](http://localhost:5173/admin/analytics)
- **Security & Platform Settings:** [http://localhost:5173/admin/settings](http://localhost:5173/admin/settings)

#### ⚡ D. Backend REST API Endpoints
- Base API URL: `http://localhost:3001`
- Server Health Check: `http://localhost:3001/api/health`
- Inspector Email Ledger: `http://localhost:3001/api/v1/inspector/email-logs/DEMO123`
- Inspector Command Dispatch: `POST http://localhost:3001/api/v1/inspector/candidate-action`
- Candidate Issue Reporting: `POST http://localhost:3001/api/v1/inspector/report-issue`
- Candidate Submission Receipt Email: `POST http://localhost:3001/api/v1/inspector/send-receipt`

---

## 🧪 Comprehensive Test Suite

GROWTHRAN enforces 100% green status across all test suites prior to deployment:

```bash
# 1. Run all server unit & integration tests (52 tests)
cd server
npm test

# 2. Verify Role-Based Access Control (RBAC) security (9 tests)
node test-roles.js

# 3. Verify bulk student CSV/XLSX enrollment pipeline (6 tests)
node test-bulk-enroll.js

# 4. Verify 3D isolation & zero-3D exam page architectural guard (4 tests)
node test-3d-architecture.js

# 5. Run end-to-end API smoke test (8 tests)
node test-smoke.js

# 6. Run 500-Candidate Concurrency Load Test (4,500 requests across 7 phases)
node load-test.js

# 7. Type-check client and server
cd ../client && npx tsc -b
cd ../server && npx tsc --noEmit
```

---

## 🏗️ System Architecture

```mermaid
graph TD
    Client[React 18 + Vite Frontend] -->|REST + JSON| NGINX[Express Gateway :3001]
    Client -->|Socket.io| WS[Realtime WebSocket Engine]
    
    subgraph Security Layer
        NGINX --> Helmet[Helmet + CSP]
        NGINX --> RateLimit[Tiered Rate Limiter]
        NGINX --> ReqID[X-Request-Id Tracker]
        NGINX --> Auth[JWT + Bcrypt Auth]
    end
    
    subgraph Execution & Assessment
        Auth --> Gate[Exam Code Gate]
        Gate --> SessionMgr[Server Session Manager]
        SessionMgr --> Timer[Server-Authoritative Clock]
        SessionMgr --> Proctor[Anti-Cheat Telemetry]
        SessionMgr --> Sandbox[Code Runner / Evaluator]
    end

    subgraph Data Tier
        SessionMgr --> DB[(PostgreSQL / Supabase)]
        WS --> Cache[(In-Memory High-Speed Cache)]
    end
```

### Directory Structure
```text
Quiz/
├── client/                     # React 18 Frontend
│   ├── public/brand/           # Official SVG vector logos & brand marks
│   ├── src/
│   │   ├── components/         # Reusable UI & Exam components
│   │   │   ├── exam/           # Dedicated 2D high-performance exam components
│   │   │   └── BrandLogo.tsx   # Canonical GROWTHRAN logo component
│   │   ├── pages/              # Route pages (Exam, Admin, Lobby, Leaderboard)
│   │   ├── three/              # Consolidated Three.js WebGL visual kit
│   │   ├── lib/                # API client, offline queue, state management
│   │   └── index.css           # Design tokens, cybernetic dark palette
│   └── netlify.toml            # Netlify SPA production deployment blueprint
│
├── server/                     # Node.js + Express Backend
│   ├── db/                     # SQL schemas, migration scripts, rollback plans
│   │   ├── schema.sql          # Primary PostgreSQL schema with B-tree indexes
│   │   └── migration_exam_codes.sql # Zero-OTP exam code schema
│   ├── src/                    # TypeScript backend source code
│   │   ├── controllers/        # Business logic (Auth, Exam, Session, Proctor)
│   │   ├── routes/             # REST API endpoint routes
│   │   ├── middleware/         # Auth, RBAC, Rate Limiting, Request ID
│   │   └── index.ts            # Express app server boot with graceful shutdown
│   ├── seed-demo.js            # Self-contained demo seeder & reset tool
│   ├── load-test.js            # 500-candidate concurrency benchmark runner
│   └── test-*.js               # Architectural, RBAC, and smoke test suites
│
├── docs/                       # Comprehensive documentation & runbooks
│   ├── BRAND.md                # Brand identity, typography & color palette
│   ├── ADMIN_RUNBOOK.md        # Step-by-step administrator guide
│   ├── MASTER_PROMPT.md        # Architecture specification & roadmap
│   └── PROGRESS_LOG.md         # Detailed phase audit & completion log
├── render.yaml                 # Render infrastructure-as-code configuration
├── OPS.md                      # Operational runbook, incident guide & backups
└── COMPLETE_DOCUMENTATION.md   # Full platform technical specification
```

---

## 🔒 Security & Proctoring Principles

1. **Server-Authoritative Timers:** Client elapsed times are purely presentation mirrors; the server calculates test validity using UTC timestamps stored at exam generation.
2. **Browser Lockout:** Tab-switching and focus loss increment server-side violation counters. Exceeding threshold (`VIOLATION_THRESHOLD=2`) immediately auto-terminates the session.
3. **No Biometric Storage:** Client-side MediaPipe analyzes gaze and face presence in real-time. Only numeric confidence levels and violation incidents are logged—zero webcam video or audio feeds are stored or streamed to ensure absolute candidate privacy.
4. **Credential Isolation:** Super-admin passwords require 12-round Bcrypt hashes. Server boot guard strictly rejects weak passwords (`admin`, `password`, `123456`) in production.

---

## 🚢 Production Deployment

### Backend (Render)
The repository includes a ready-to-use `render.yaml` defining:
- Separate production (`logicwhile-quiz-server`) and staging environments.
- Automated `/health` and `/api/ready` health check validation.
- Secure environment secret injection.

### Frontend (Netlify)
The included `netlify.toml` automatically configures:
- Single-page application route rewrite rules (`/* -> /index.html 200`).
- Strict HTTP security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
- Long-lived immutable asset caching (`/assets/*`).

---

## 👥 Credits & Contact

- **Architect & Lead Developer:** R. Charan Sai
- **Platform:** LogicWhileLiRE — *"Logic. While. LiRE."*
- **Support & Inquiries:** `support@logicwhilelire.com`
