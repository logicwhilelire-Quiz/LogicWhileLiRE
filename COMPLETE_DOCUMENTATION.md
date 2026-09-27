# LOGIC WHILE QUIZ — Complete Platform Documentation
**Version:** 2.0.0 (Production Architecture)  
**Product:** LOGIC WHILE QUIZ  
**Tagline:** *"Elevating Coding Knowledge"*  
**Sub-Brand:** *India's Most Secure CRT & Coding Assessment Platform*  
**Repository:** `c:\Users\chara\OneDrive\Desktop\Quiz`  
**Operating Stack:** React 18 + Vite (Frontend) · Node.js + Express + TypeScript (Backend) · PostgreSQL on Supabase (Database) · Redis / WebSockets (Real-time Telemetry & Leaderboard)

---

## Table of Contents
1. [Executive Summary & System Overview](#1-executive-summary--system-overview)
2. [Brand Identity & Design System](#2-brand-identity--design-system)
3. [System Architecture & Data Flow](#3-system-architecture--data-flow)
4. [Frontend Architecture & Complete Page Catalog](#4-frontend-architecture--complete-page-catalog)
   - [4.1 Public Marketing Landing](#41-public-marketing-landing)
   - [4.2 Exam Code System (No-OTP Student Flow)](#42-exam-code-system-no-otp-student-flow)
   - [4.3 Live Assessment Entrance Gate (AL-SPEC-2026-REG)](#43-live-assessment-entrance-gate-al-spec-2026-reg)
   - [4.4 Contest Waiting Lobby & Real-Time Handoff](#44-contest-waiting-lobby--real-time-handoff)
   - [4.5 Student Authentication & Password Recovery](#45-student-authentication--password-recovery)
   - [4.6 Legacy Participant & OTP Enrollment](#46-legacy-participant--otp-enrollment)
   - [4.7 Admin & Faculty Management Suite](#47-admin--faculty-management-suite)
5. [Backend Architecture & Complete REST API Reference](#5-backend-architecture--complete-rest-api-reference)
   - [5.1 Authentication & Recovery Endpoints](#51-authentication--recovery-endpoints)
   - [5.2 Assessment Gate Module Endpoints](#52-assessment-gate-module-endpoints)
   - [5.3 Exam Code System Endpoints](#53-exam-code-system-endpoints)
   - [5.4 Session, Proctored Answers & Violation Endpoints](#54-session-proctored-answers--violation-endpoints)
   - [5.5 Admin, Staff & Institutional Operations Endpoints](#55-admin-staff--institutional-operations-endpoints)
6. [Anti-Tamper, Security & Proctoring Engine](#6-anti-tamper-security--proctoring-engine)
7. [Database Schema & Entity-Relationship Architecture](#7-database-schema--entity-relationship-architecture)
8. [DevOps, Deployment & Environment Configuration](#8-devops-deployment--environment-configuration)
9. [Operational Runbook & Testing Guide](#9-operational-runbook--testing-guide)

---

## 1. Executive Summary & System Overview

**LOGIC WHILE QUIZ** is an enterprise-grade, high-throughput Campus Recruitment Training (CRT) and coding assessment platform engineered specifically for autonomous engineering colleges, technical universities, and recruitment drives across India.

### Core Capabilities
- **High-Throughput Assessment Gate:** High-concurrency registration and queueing gate preventing database bottlenecks during simultaneous logins of 5,000+ candidates.
- **Exam Code Flow (No-OTP Friction):** Direct entrance with pre-generated institutional Exam Codes (`LW-VRSEC-8X9P2Q`) + Student Hall Ticket numbers, completely eliminating SMS/Email OTP bottlenecks.
- **Server-Authoritative Clock:** Examination timers are computed exclusively on the server (`started_at + duration_minutes`). Client-side clock manipulation or browser pauses cannot extend test duration.
- **Anti-Cheat Hardware & Canvas Fingerprinting:** Continuous detection of tab switching, window blurring, developer tools execution, screen resizing, and multi-session concurrency conflicts.
- **Real-Time Leaderboard:** Powered by Redis Sorted Sets and WebSocket push mechanisms for sub-second ranking computation across thousands of concurrent test takers.
- **Argon2id & 12-Round Bcrypt Hashing:** High-security password storage where plaintext secrets never leave the server memory.
- **Hardware-Accelerated 3D & Motion Engine:** Platform features 10 proprietary WebGL & Framer Motion modules including Mathematical Icosahedron Projection, Proximity Node Network, and Spring-Physics Podium - Achieving 60fps on mid-range devices.

---

## 2. Brand Identity & Design System

### 2.1 Color Palette
The platform employs a dark, deep-navy launch console aesthetic with glassmorphic cards and cybernetic glow accents:

```css
/* Core Color Tokens */
--color-navy-deep:     #060914; /* Base page background */
--color-navy-surface:  #0e1630; /* Elevated cards and panels */
--color-navy-border:   rgba(255, 255, 255, 0.08); /* Crisp borders */

/* Accent Palettes */
--color-logic-blue:    #0A1931; /* Header, sidebar authority */
--color-while-purple:  #6C5CE7; /* Primary CTA buttons & active stages */
--color-purple-glow:   #7C3AED; /* Parallax glow orbs & focus rings */
--color-cyber-cyan:    #06B6D4; /* Data telemetry, links, verified states */
--color-emerald-green: #10B981; /* Success, correct answers, active status */
--color-amber-warning: #F59E0B; /* Pending review, violations, warnings */
--color-coral-danger:  #EF4444; /* Terminations, errors, password mismatch */
```

### 2.2 Typography System
- **Headings & Brand Title:** `Space Grotesk`, sans-serif (Weights: 600, 700, 800)
- **Body, Inputs & Labels:** `Inter`, system-ui, sans-serif (Weights: 400, 500, 600)
- **Code, Roll Numbers, Hashes & Telemetry:** `JetBrains Mono`, monospace (Weights: 400, 500, 700)

### 2.3 Proprietary 3D & Animation System (20 Complete Modules)

> **CEO Architectural Statement:**  
> *"Platform features 20 proprietary WebGL, Three.js & Framer Motion modules including Mathematical Icosahedron Projection, Proximity Node Network, Interactive College Globe, Liquid Mesh Distort, and Spring-Physics Podium - Achieving 60fps on mid-range devices."*

| # | Module Name | Implementation / Source File | Target Routes | Technical Specifications & Physics |
|---|---|---|---|---|
| **1** | **Hero 3D Icosahedron with Mouse Parallax** | `components/3d/IcosahedronHero.tsx` | `/gate`, `/register` | 12 golden-ratio vertices ($PHI = \frac{1+\sqrt{5}}{2}$), 3D perspective rotation matrix, glowing vertex nodes (`#6C5CE7`), camera mouse parallax ($\Delta x, \Delta y$). |
| **2** | **WebSocket Proximity Node Network** | `components/3d/NodeNetwork.tsx` | `/` (Landing Hero) | 50 dynamic particle nodes (25 on mobile), 120px Euclidean proximity threshold ($dist < 120$), line alpha = $1 - \frac{dist}{120}$, `#06B6D4` connecting lines, `#6C5CE7` glowing nodes, pure HTML5 canvas 0-overhead. |
| **3** | **Perspective 3D Tilt Cards** | `components/3d/TiltCard.tsx`, `hooks/use3DTilt.ts` | `/enter-exam`, `/register` | Apple-grade mouse tracking: `perspective(900px) rotateX(${-y/20}deg) rotateY(${x/20}deg)`, glare sweep overlay, cubic-bezier transition recovery. |
| **4** | **Particle Confetti Physics** | `components/Confetti.tsx` | `/register` (Success Gate) | 150-particle radial burst from center; physics engine: $v_y += 0.2$ (gravity), $v_x \times= 0.99$ (air friction); curated palette: `#6C5CE7`, `#00B894`, `#FDCB6E`, `#06B6D4`. |
| **5** | **3D Podium for Leaderboard** | `components/3d/Podium3D.tsx` | `/leaderboard-ec/:code` | Gold (1st): 180px height, continuous Y-axis float `y: [0, -10, 0]`, `box-shadow: 0 0 40px gold`; Silver (2nd): 140px height, 85% scale; Bronze (3rd): 100px height, 75% scale; Framer spring physics (`stiffness: 260, damping: 20`). |
| **6** | **Animated Counter & Typewriter Engine** | `components/AnimatedCounter.tsx`, `components/TypewriterText.tsx` | `/` (Landing), `/admin/dashboard` | Typewriter: `"Crack CRT \| Master Coding \| Get Placed"` typed at 80ms/char with cursor blink; Counter: 0 to 5000+ with `easeOutExpo` curve over 2000ms duration. |
| **7** | **Question Pallet Morphing Animations** | `client/src/index.css` (`.pallet-btn-*`) | `/quiz/:examCode` | Unanswered: scale 1.0; Answered: `scale 1.18 -> 1.0` check pop with `#00B894`; Marked: purple breathing pulse `#6C5CE7`; Current: continuous border glow `box-shadow: 0 0 0 3px rgba(108,92,231,0.5)`. |
| **8** | **Violation Shake + Red Glitch Engine** | `client/src/index.css` (`.violation-active`) | `/quiz/:examCode` (Proctoring) | Dual keyframe orchestration: 5-cycle horizontal shake (`translateX(±8px)`) + chromatic glitch (`text-shadow: 2px 0 #EF4444, -2px 0 #06B6D4`) + persistent red alert border. |
| **9** | **Parallax Atmospheric Glow Orbs** | `components/3d/ParallaxGlowOrbs.tsx` | `/`, `/enter-exam`, `/register` | 3 absolute floating glow spheres with `blur(80px)`: Orb 1 (400px, `#6C5CE7`, parallax speed 0.02), Orb 2 (300px, `#06B6D4`, speed 0.04), Orb 3 (500px, `#0A1931`, speed 0.01). |
| **10** | **Socket.io Real-Time Score Ticker** | `pages/LeaderboardECPage.tsx` | `/leaderboard-ec/:code` | Spring-physics layout morphing (`<motion.div layout transition={{ type: 'spring', stiffness: 300, damping: 30 }}>`) animating updated ranks from `y: 50, opacity: 0` to `y: 0, opacity: 1`. |
| **11** | **3D Interactive College Globe** | `components/3d/CollegeGlobe.tsx` | `/` (Landing Network) | Spherical map projecting India coordinates ($x=R\cos(lat)\cos(lng), y=R\sin(lat), z=R\cos(lat)\sin(lng)$) for VRSEC, KLU, GITAM, Vignan, RGUKT, CBIT with pulsing scale $1.0 \rightarrow 1.5$ infinite, auto-rotation speed 0.5, user drag interaction, and campus tooltip popups. |
| **12** | **Purple Matrix Code Rain** | `components/3d/CodeRain.tsx` | `/instructions/:code`, `/quiz/:code` | 2D Canvas matrix rain with Purple `#6C5CE7` characters (`01, </>, {}, &&`), 20px font, variable drop speeds (2–5px/frame), subtle 0.05 opacity behind exam questions, 80 capped columns. |
| **13** | **3D Flipping Quiz Card** | `components/3d/FlipCard.tsx` | `/quiz/:code` | Exam paper 3D flip animation (`rotateY: 180deg`) on question navigation with spring physics (`stiffness: 260, damping: 24`, duration 0.6s) and `preserve-3d` backface occlusion. |
| **14** | **Holographic Laser Scan Line** | `components/3d/HoloScan.tsx` | `/enter-exam` | Laser beam sweep animation across input fields (`linear-gradient(90deg, transparent, #06B6D4, transparent)`), 2s linear continuous cycle on focus/typing. |
| **15** | **3D Liquid Organic Blob** | `components/3d/LiquidBlob.tsx` | `/` (Landing), `/admin/*` | Three.js + `@react-three/drei` `MeshDistortMaterial` (`distort: 0.4`, `speed: 2`, `#6C5CE7`), smooth organic float and cursor pointer parallax response, capped DPR `[1, 1.5]` via Suspense. |
| **16** | **3D Star Particle Field Telemetry** | `components/3d/ParticleField.tsx` | `/waiting-lobby`, `/admin/*` | 1000 stars (500 on mobile) drifting in 3D perspective space with velocity dynamically bound to real-time candidate queue count (`liveCount`). |
| **17** | **3D Torus Ring Progress Indicator** | `components/3d/CircularProgress3D.tsx` | `/quiz/:code` | Torus progress ring computed via `thetaLength = (timeLeft / totalTime) * 2π`, transitioning through Green (>50%), Orange (≤50%), and Red (≤10%) with pulsing alert emission and synced indicator. |
| **18** | **Magnetic Buttons with 3D Press** | `components/3d/MagneticButton.tsx` | All Primary Platform CTAs | Cursor-tracking attraction translating button $0.15 \times \text{distance}$ using Framer Motion springs (`stiffness: 220, damping: 18`), with `scale: 0.92` tactile compression on click. |
| **19** | **Fluid WebGL Style Page Wipe** | `components/3d/PageTransition.tsx` | `/leaderboard-ec/:code` | Liquid chromatic aberration wipe transition (0.8s) featuring RGB color separation (Red `#EF4444`, Cyan `#06B6D4`, Violet `#6C5CE7`) on rank and leaderboard updates. |
| **20** | **3D Certificate Vault** | `components/3d/Certificate3D.tsx` | `/result-ec/:code` | Tilt credential card with dynamic specular light reflection tracking cursor coordinates, metallic gold seal, and holographic laser scanning QR code verification. |

---


## 3. System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React + Vite)                          │
│                                                                             │
│  [Landing Page]    [Candidate Gate]    [Exam Code Entry]    [Admin Suite]   │
│         │                 │                   │                   │         │
│         └───────────┬─────┴───────────────────┴───────────────────┘         │
│                     │ HTTPS / JSON                                          │
└─────────────────────┼───────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js + Express + TS)                       │
│                                                                             │
│  ├── Helmet / Strict CORS / Rate Limiting (General & Auth)                  │
│  ├── Zod / Joi Validation Gate (Zero Unsanitized Input)                     │
│  ├── Controllers:                                                           │
│  │   ├── candidateController.ts (AL-SPEC-2026-REG Gate)                    │
│  │   ├── examCodeController.ts  (No-OTP Assessment Engine)                  │
│  │   ├── sessionController.ts   (Server-Timed Proctored Session)            │
│  │   ├── adminController.ts     (Analytics, Reports, Staff, Exams)          │
│  │   └── violationController.ts (Proctoring Telemetry & Lockouts)           │
│  └── Session Cron (Auto-submits expired tests every 60s)                    │
└─────────────────────┬───────────────────────────────────────────────────────┘
                      │
         ┌────────────┴───────────────────────┐
         ▼                                    ▼
┌─────────────────────────────────┐  ┌────────────────────────────────────────┐
│     SUPABASE (PostgreSQL 15)    │  │       REDIS & WEBSOCKET ENGINE         │
│                                 │  │                                        │
│  - students / staff / colleges  │  │  - Redis Sorted Sets (Global Leader)   │
│  - exam_codes / attempts        │  │  - WebSocket Telemetry Channel         │
│  - exams / questions / sessions │  │  - Live Candidate Queue Count          │
│  - violations / audit logs      │  │  - Real-time Scorecard Broadcast       │
└─────────────────────────────────┘  └────────────────────────────────────────┘
```

---

## 4. Frontend Architecture & Complete Page Catalog

The frontend is built using React 18, Vite, Framer Motion, and Axios. Routes are code-split via `React.lazy` and `Suspense` inside `client/src/App.tsx`.

### 4.1 Public Marketing Landing (`/`)
- **File:** `client/src/pages/LandingPage.tsx`
- **Features:**
  - Dynamic typewriter hero: *"Crack CRT | Master Coding | Get Placed"*.
  - Live animated statistics counter: 5,000+ Students Tested, 98.4% Placement Accuracy.
  - Interactive test cards with glassmorphic glow.
  - Direct portal routing: "Enter Assessment Code" and "Candidate Registration Gate".

### 4.2 Exam Code System (No-OTP Student Flow)
Eliminates SMS/Email OTP latency for on-campus drives.
1. **Enter Exam Code (`/enter-exam`):**
   - **File:** `client/src/pages/EnterExamPage.tsx`
   - Inputs: Hall Ticket Number (`22B91A0501`) and Master Exam Code (`LW-VRSEC-8X9P2Q`).
   - Validates exam active window (`start_time` to `end_time`) and checks if attempt already exists.
2. **Pre-Assessment Instructions (`/instructions/:examCode`):**
   - **File:** `client/src/pages/InstructionsPage.tsx`
   - Mandatory fullscreen requirement notice, anti-cheating penalty breakdown, system hardware verification.
3. **Proctored Quiz Interface (`/quiz/:examCode`):**
   - **File:** `client/src/pages/ExamCodeQuizPage.tsx`
   - Split-screen layout: Question pallet (Answered, Marked for Review, Unvisited), rich code snippets, server countdown clock.
   - Background event listeners for `visibilitychange`, `blur`, `resize`, and key bindings (Ctrl+C, Ctrl+V, F12, PrintScreen).
4. **Instant Scorecard Breakdown (`/result-ec/:examCode`):**
   - **File:** `client/src/pages/ResultECPage.tsx`
   - Displays total score, accuracy %, topic-level performance radar, and time taken.
5. **Real-time College Leaderboard (`/leaderboard-ec/:examCode`):**
   - **File:** `client/src/pages/LeaderboardECPage.tsx`
   - 3D podium for Top 3 candidates (Gold, Silver, Bronze badges) and full institutional ranking table.

### 4.3 Live Assessment Entrance Gate (AL-SPEC-2026-REG)
- **Routes:** `/register`, `/gate`, `/register-candidate`
- **File:** `client/src/pages/CandidateRegisterGatePage.tsx`
- **Features:**
  - **3D Hero & Status:** Wireframe icosahedron canvas with mouse-parallax and live status `"System check: websocket ready · 18ms"`.
  - **4 Stat Badges:** `"100% Identity Uniqueness"`, `"4 Batches · YOP 2027–2030"`, `"5 Sections · A–E"`, `"Argon2id Credential Security"`.
  - **4-Stage Stepper Wizard:**
    1. *Identity:* First Name & Last Name (alphabetic only, auto-capitalization, live badge preview).
    2. *Academic:* Searchable institution combobox + chips, Year of Passing chips (2027–2030), Section chips (A–E), Roll Number with debounced composite check, Branch dropdown (CSE, CSM, CSD, CSC, INF/IT, AID, ECE, EEE).
    3. *Credentials:* RFC 5322 email with debounced availability check, mobile with fixed `+91` prefix, password with live strength meter + show/hide toggle, password confirmation matching, and pure Web Crypto SHA-256 preview.
    4. *Review:* Renders exact JSON payload conforming to schema, with copy JSON utility.
  - **Submit Flow:** Submits to `/api/v1/assessment/register-candidate`, shows particle confetti celebration, simulated routing sequence, and routes to `/contest/:id/waiting-lobby`.

### 4.4 Contest Waiting Lobby (`/contest/:contestId/waiting-lobby`)
- **File:** `client/src/pages/WaitingLobbyPage.tsx`
- Displays candidate clearance card with verified claim, live candidates count, queue rank, pre-assessment checklist, and Redis sorted set feed.

### 4.5 Student Authentication & Password Recovery
- **Login (`/login`):** `client/src/pages/StudentLoginPage.tsx` — Email/Hall ticket login with brute-force lockout.
- **Forgot Password (`/forgot-password`):** `client/src/pages/ForgotPasswordPage.tsx`
- **Reset Password (`/reset-password`):** `client/src/pages/ResetPasswordPage.tsx`

### 4.6 Legacy Participant & OTP Enrollment
- **Enroll (`/enroll/:examId`):** `client/src/pages/EnrollPage.tsx`
- **Verify OTP (`/enroll/:examId/verify`):** `client/src/pages/OTPVerifyPage.tsx`
- **Exam Session (`/exam`):** `client/src/pages/ExamPage.tsx`
- **Leaderboard (`/leaderboard/:examId`):** `client/src/pages/LeaderboardPage.tsx`

### 4.7 Admin & Faculty Management Suite
Located under `/admin/*`:
- **Admin Login (`/admin`):** `client/src/pages/admin/AdminLoginPage.tsx`
- **Dashboard (`/admin/dashboard`):** `client/src/pages/admin/AdminDashboardPage.tsx`
- **Colleges Management (`/admin/colleges`):** `client/src/pages/admin/CollegesPage.tsx`
- **Exam Codes Management (`/admin/exam-codes`):** `client/src/pages/admin/ExamCodesPage.tsx`
- **Create Exam (`/admin/create-exam`):** `client/src/pages/admin/CreateExamPage.tsx`
- **Import Questions (`/admin/import`):** `client/src/pages/admin/ImportQuestionsPage.tsx`
- **Live Sessions Proctoring (`/admin/sessions`):** `client/src/pages/admin/SessionsPage.tsx`
- **Staff RBAC (`/admin/staff`):** `client/src/pages/admin/StaffManagementPage.tsx`
- **Reports Export (`/admin/reports`):** `client/src/pages/admin/ReportsPage.tsx`
- **Deep Analytics (`/admin/analytics`):** `client/src/pages/admin/AnalyticsPage.tsx`

---

## 5. Backend Architecture & Complete REST API Reference

The backend is built with Express + TypeScript. All endpoints are protected by `helmet`, CORS allowlisting, and rate limiting.

### 5.1 Authentication & Recovery Endpoints (`/api/auth`)
| Method | Route | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register student account with hall ticket & email | None |
| `POST` | `/api/auth/login` | Student login (rate limited; auto-lockout after 5 failures) | None |
| `GET` | `/api/auth/me` | Fetch active student profile | Student Bearer / Cookie |
| `POST` | `/api/auth/forgot-password` | Generate reset token and dispatch email | None |
| `POST` | `/api/auth/reset-password` | Reset password using verified token | None |
| `POST` | `/api/auth/logout` | Invalidate cookie and session | None |

### 5.2 Assessment Gate Module Endpoints (`/api/v1/assessment`)
| Method | Route | Description | Validation |
|---|---|---|---|
| `POST` | `/api/v1/assessment/register-candidate` | Entrance Gate: Creates student with composite uniqueness check (`college_id × roll_number`), 12-round bcrypt hash, issues encrypted JWT claim | `candidateRegisterSchema` |
| `GET` | `/api/v1/assessment/system-check` | Live health probe returning WebSocket gateway & Redis latency | None |
| `GET` | `/api/v1/assessment/lobby-status` | Returns queue rank, connected candidates count, countdown | Optional `contest_id` |
| `GET` | `/api/v1/assessment/metadata` | Pre-populated dictionaries for top campuses, branch codes, batches | None |

### 5.3 Exam Code System Endpoints (`/api`)
| Method | Route | Description | Flow |
|---|---|---|---|
| `POST` | `/api/exam-code/validate` | Validates exam code + hall ticket; checks start/end time window | Entry Gate |
| `GET` | `/api/exam-code/:examCode/instructions` | Fetches exam rules, duration, subject, institutional owner | Instructions |
| `POST` | `/api/exam-code/start` | Creates `exam_code_attempts` record, initializes server end time | Exam Kickoff |
| `POST` | `/api/exam-code/answer` | Saves candidate answer option, tracks latency in ms | Live Answer |
| `POST` | `/api/exam-code/violation` | Logs tab switches / blur; terminates attempt if violation count > 3 | Proctoring |
| `POST` | `/api/exam-code/submit` | Finalizes attempt, computes score, accuracy, topic breakdown | Final Submit |
| `GET` | `/api/exam-code/:examCode/result/:hallTicket` | Returns scorecard, topic mastery, and question breakdown | Scorecard |
| `GET` | `/api/exam-code/:examCode/leaderboard` | Returns live ranked leaderboard for the exam code | Ranking |
| `GET` | `/api/colleges/active` | Returns list of colleges for entry dropdowns | Public |

### 5.4 Session, Proctored Answers & Violation Endpoints (`/api/session`)
| Method | Route | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/session/start` | Starts timed session, records device fingerprint | Participant JWT |
| `GET` | `/api/session/:sessionId/time-remaining` | Returns authoritative milliseconds remaining | Participant JWT |
| `GET` | `/api/session/:sessionId/questions` | Returns questions in randomized order without correct answers | Participant JWT |
| `POST` | `/api/session/:sessionId/answer` | Saves single question answer atomically | Participant JWT |
| `POST` | `/api/session/:sessionId/violation` | Logs violation; supports `navigator.sendBeacon` on tab close | Participant JWT |
| `POST` | `/api/session/:sessionId/submit` | Concludes exam and computes final score | Participant JWT |

### 5.5 Admin, Staff & Institutional Operations Endpoints (`/api/admin`)
| Method | Route | Description | Access Level |
|---|---|---|---|
| `POST` | `/api/admin/login` | Admin authentication with 24-char random JWT | None (Rate Limited) |
| `POST` | `/api/admin/logout` | Clears admin session cookie | None |
| `GET` | `/api/admin/exams` | Lists all created exams | Admin / Faculty |
| `POST` | `/api/admin/exams` | Creates timed exam with configurable proctoring alert email | Admin / Faculty |
| `PATCH` | `/api/admin/exams/:id/activate` | Toggles exam active state | Admin / Faculty |
| `GET` | `/api/admin/exams/:id/qr` | Generates QR code URL for instant mobile access | Admin / Faculty |
| `POST` | `/api/admin/exams/:id/import-questions` | Multipart file upload for CSV/Excel questions | Admin / Faculty |
| `POST` | `/api/admin/exams/:id/bulk-enroll` | Uploads student CSV roster for bulk registration | Admin / Faculty |
| `GET` | `/api/admin/exams/:id/sessions` | Paginated live sessions with violation counts | Admin / Faculty |
| `POST` | `/api/admin/sessions/:sessionId/terminate` | Force-terminates cheating participant | Admin / Faculty |
| `GET` | `/api/admin/exams/:id/report/excel` | Generates downloadable Excel spreadsheet | Admin / Faculty |
| `GET` | `/api/admin/exams/:id/report/pdf` | Generates downloadable PDF score ledger | Admin / Faculty |
| `GET` | `/api/admin/exams/:id/analytics/questions` | Discrimination index & difficulty breakdown | Admin / Faculty |
| `GET` | `/api/admin/exams/:id/analytics/topics` | Topic strength / weakness distribution | Admin / Faculty |
| `GET` | `/api/admin/exams/:id/suspicious-activity` | Lists flagged multi-fingerprint collisions | Admin / Faculty |
| `PATCH` | `/api/admin/suspicious-activity/:id/resolve` | Clears or confirms cheating flags | Admin / Faculty |
| `GET` | `/api/admin/colleges` | Lists all participating engineering colleges | Super Admin |
| `POST` | `/api/admin/colleges` | Creates college record (`college_name`, `college_code`) | Super Admin |
| `GET` | `/api/admin/exam-codes` | Lists all master exam codes | Admin / Faculty |
| `POST` | `/api/admin/exam-codes` | Generates new exam code with schedule | Admin / Faculty |
| `GET` | `/api/admin/staff` | Lists all staff accounts and roles | Super Admin |
| `POST` | `/api/admin/staff` | Invites new faculty or super admin | Super Admin |
| `PATCH` | `/api/admin/staff/:id/deactivate` | Toggles staff member active status | Super Admin |

---

## 6. Anti-Tamper, Security & Proctoring Engine

The platform operates an anti-cheating framework:

1. **Client Isolation & Tamper Detection:**
   - **Full-Screen Enforcement:** Exam cannot be commenced outside fullscreen mode. Exiting fullscreen logs a violation.
   - **Tab-Switch & Window Blur Detection:** Utilizes `document.visibilitychange` and `window.onblur`. Violations are transmitted via `navigator.sendBeacon` to ensure logging even if the tab is immediately closed.
   - **Keyboard & Clipboard Lock:** Blocks right-click context menus (`contextmenu`), text selection (`selectstart`), clipboard copying (`copy`), pasting (`paste`), and hotkeys (`Ctrl+C`, `Ctrl+V`, `Ctrl+U`, `F12`, `Alt+Tab`).
   - **Developer Tools Trap:** Detects devtools opening via window dimension threshold anomalies.

2. **Automated Enforcement Thresholds:**
   - Violation 1: Warning notification modal.
   - Violation 2: Severe alert with timer deduction.
   - Violation 3: Immediate session termination (`status = 'terminated_cheating'`), zero score assigned, and admin alert triggered.

3. **Server-Authoritative Clock:**
   - Examination remaining time is computed as:
     $$\text{Remaining Time} = \text{started\_at} + (\text{duration\_minutes} \times 60) - \text{NOW()}$$
   - Even if the candidate disconnects, closes the browser, or tampers with the local system clock, the server deadline remains unchanged. An automated background cron (`sessionCron.ts`) executes every 60 seconds to auto-submit expired sessions.

4. **Single-Session Mutex & Hardware Fingerprinting:**
   - Every candidate session captures device characteristics (screen depth, canvas fingerprint, user agent, IP).
   - If a duplicate login occurs on another machine while a session is active, the event is immediately flagged in `suspicious_activity` for admin review.

---

## 7. Database Schema & Entity-Relationship Architecture

The PostgreSQL database on Supabase consists of 14 core tables with Row-Level Security (RLS) policies:

```sql
-- Core Exam Code System (No-OTP Architecture)
CREATE TABLE colleges (
  id              SERIAL PRIMARY KEY,
  college_name    VARCHAR(150) NOT NULL,
  college_code    VARCHAR(20) UNIQUE NOT NULL,
  city            VARCHAR(100),
  state           VARCHAR(100) DEFAULT 'Andhra Pradesh',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE exam_codes (
  id                SERIAL PRIMARY KEY,
  exam_code         VARCHAR(20) UNIQUE NOT NULL,
  college_id        INT REFERENCES colleges(id) ON DELETE CASCADE,
  exam_name         VARCHAR(150) NOT NULL,
  subject           VARCHAR(100),
  total_questions   INT NOT NULL DEFAULT 30,
  duration_minutes  INT NOT NULL DEFAULT 60,
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE exam_code_attempts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hall_ticket_no  TEXT NOT NULL,
  exam_code       VARCHAR(20) NOT NULL REFERENCES exam_codes(exam_code) ON DELETE CASCADE,
  student_name    TEXT,
  start_time      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time        TIMESTAMPTZ,
  score           NUMERIC DEFAULT 0,
  max_score       NUMERIC DEFAULT 0,
  correct_count   INT DEFAULT 0,
  wrong_count     INT DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'terminated_cheating')),
  violation_count INT NOT NULL DEFAULT 0,
  answers         JSONB DEFAULT '{}',
  time_taken_seconds INT DEFAULT 0,
  topic_breakdown JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_hall_ticket_exam_code UNIQUE (hall_ticket_no, exam_code)
);

CREATE TABLE questions_ec (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_code       VARCHAR(20) NOT NULL REFERENCES exam_codes(exam_code) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  option_a        TEXT NOT NULL,
  option_b        TEXT NOT NULL,
  option_c        TEXT NOT NULL,
  option_d        TEXT NOT NULL,
  correct_answer  CHAR(1) NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
  marks           NUMERIC NOT NULL DEFAULT 1,
  difficulty      TEXT DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  topic           TEXT NOT NULL DEFAULT 'General',
  explanation     TEXT,
  display_order   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gate Candidates Table (AL-SPEC-2026-REG)
CREATE TABLE students (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name          TEXT,
  last_name           TEXT,
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  college_id          TEXT,
  college_name        TEXT,
  year_of_passing     INTEGER CHECK (year_of_passing IN (2027, 2028, 2029, 2030)),
  roll_number         TEXT,
  hall_ticket         TEXT UNIQUE,
  branch_code         TEXT,
  section             TEXT CHECK (section IN ('A', 'B', 'C', 'D', 'E')),
  contact_number      TEXT,
  mobile              TEXT,
  password_hash       TEXT NOT NULL,
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_college_roll UNIQUE (college_id, roll_number)
);
```

---

## 8. DevOps, Deployment & Environment Configuration

### 8.1 Client Environment Variables (`client/.env`)
```ini
# Base API URL pointing to the Express server
VITE_API_BASE_URL=http://localhost:3001

# Supabase Public Anon Key for Realtime Leaderboard client
VITE_SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co
VITE_SUPABASE_ANON_KEY=[YOUR-SUPABASE-ANON-KEY]
```

### 8.2 Server Environment Variables (`server/.env`)
```ini
NODE_ENV=production
PORT=3001

# Allowed client origin for strict CORS and HttpOnly cookies
CLIENT_ORIGIN=https://logicwhilequiz.com

# Supabase Service Role configuration (Bypasses RLS for authoritative writes)
SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SUPABASE-SERVICE-ROLE-KEY]
SUPABASE_ANON_KEY=[YOUR-SUPABASE-ANON-KEY]

# Database Connection Pool
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres

# JWT Cryptographic Secrets
JWT_SECRET=[64-character-random-hex]
ADMIN_JWT_SECRET=[64-character-random-hex]
STUDENT_JWT_EXPIRY=24h

# Root Super Admin Credentials
ADMIN_USERNAME=superadmin
ADMIN_PASSWORD_HASH=$2b$12$[GENERATED-BCRYPT-HASH]

# SMTP Email Dispatcher (For OTP fallback and password resets)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=[SENDGRID-API-KEY]
SMTP_FROM="LogicWhile Quiz <noreply@logicwhilequiz.com>"
```

### 8.3 Deployment Architecture
- **Frontend Hosting (Netlify):** Configured via `netlify.toml` with SPA redirects (`/*` → `/index.html 200`), security headers (Content Security Policy, X-Frame-Options: DENY), and asset caching.
- **Backend Hosting (Render / Railway):** Configured via `render.yaml` as a Node.js web service running `npm run build && npm start`.
- **Database (Supabase):** Multi-region PostgreSQL instance with Point-In-Time Recovery (PITR) enabled.

---

## 9. Operational Runbook & Testing Guide

### 9.1 Local Development Quickstart

1. **Clone & Setup Server:**
   ```bash
   cd server
   npm install
   cp .env.example .env # Fill credentials
   npm run dev
   ```
   *Server listens on `http://localhost:3001`.*

2. **Setup Client:**
   ```bash
   cd client
   npm install
   npm run dev
   ```
   *Client hot-reloads on `http://localhost:5173`.*

3. **Verify Type-Safety & Build:**
   ```bash
   # Frontend TypeScript validation
   cd client
   npx tsc --noEmit
   npm run build

   # Backend TypeScript compilation
   cd ../server
   npm run build
   ```

### 9.2 Verification Checklist
- [x] **Candidate Registration Gate:** Multi-step wizard advances only on valid input, calculates SHA-256 preview via Web Crypto API, debounces uniqueness checks, and issues JWT session claim upon 201 response.
- [x] **No-OTP Exam Code Flow:** Master exam codes validate dates and durations, randomized question ordering prevents collusion, and answers persist with microsecond latency metrics.
- [x] **Proctoring Engine:** Tab switches and window blur events record violations; exceeding thresholds causes immediate termination.
- [x] **Admin Suite:** Question Excel bulk import parses questions, sets, and answers; Excel & PDF reports generate institutional ledgers with topic-level analytics.
