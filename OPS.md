# LogicWhile QUIZ — Production Operations Manual (OPS.md)

**Official Assessment Platform:** **LogicWhile QUIZ**  
**Brand Motto:** *"Elevating Coding Knowledge"*  
**Authoritative Engine:** Server-Timed, Anti-Tamper Proctoring, Real-Time Leaderboards

---

## Table of Contents
1. [Database Backups & Point-in-Time Recovery](#1-database-backups--point-in-time-recovery)
2. [Staging Environment & Promotion Workflow](#2-staging-environment--promotion-workflow)
3. [CI Pipeline (GitHub Actions)](#3-ci-pipeline-github-actions)
4. [Secrets Audit & Credential Rotation](#4-secrets-audit--credential-rotation)
5. [Manual Setup Checklist Outside Codebase](#5-manual-setup-checklist-outside-codebase)

---

## 1. Database Backups & Point-in-Time Recovery

### Automated Backup Schedule & Retention Window
Supabase provides automated database backups based on your project tier:

| Tier | Backup Type | Frequency | Retention Window | Granularity |
|---|---|---|---|---|
| **Free Tier** | Logical (`pg_dump`) | Daily (automated) | **7 days** | Daily snapshot |
| **Pro / Team Tier** | Physical + WAL (Write-Ahead Logging) | Continuous + Daily | **7 to 30 days** | Point-in-Time Recovery (to the second) |

#### How to Confirm in Supabase Dashboard
1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Navigate to **Project Settings** (gear icon) > **Database**.
3. Scroll down to **Database Backups**:
   - Verify that **Point in Time Recovery (PITR)** is enabled (Pro tier) or **Daily Backups** are scheduled.
   - Review the listed daily snapshots with exact UTC timestamps.

---

### Manual Backup Before Any Risky Migration
Before applying new migrations or schema updates (e.g. running modifications on `server/db/schema.sql`), **always trigger a manual backup**:

#### Method A: Supabase Dashboard
1. Go to **Database** > **Backups** in Supabase.
2. Click **Take Backup Now** / **Download Backup**.

#### Method B: Supabase CLI
```bash
# Export schema + data to timestamped SQL dump
npx supabase db dump --project-ref <your-project-ref> -f pre_migration_backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Method C: Automated Offsite Backup Script (`server/scripts/backup-db.sh`)
We provide a standalone, production-ready backup script with `gzip -9` compression and automatic 14-day retention pruning:
```bash
cd server
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

#### Restoration Procedure
To restore from a backup:
```bash
# Decompress and restore into target database
gunzip -c backups/logicwhile_quiz_backup_TIMESTAMP.sql.gz | psql "$DATABASE_URL"
```

---

## 2. Staging Environment & Promotion Workflow

### Staging vs. Production Architecture

```
┌───────────────────────────────────────────────┐       ┌───────────────────────────────────────────────┐
│              STAGING ENVIRONMENT              │       │             PRODUCTION ENVIRONMENT            │
├───────────────────────────────────────────────┤       ├───────────────────────────────────────────────┤
│ Frontend: https://staging--quiz.netlify.app   │       │ Frontend: https://logicwhilequiz.com          │
│ Backend:  https://quiz-api-staging.onrender   │       │ Backend:  https://quiz-api.onrender.com       │
│ Database: Supabase Project (quiz-staging)     │       │ Database: Supabase Project (quiz-production)  │
│ Branch:   `staging`                           │       │ Branch:   `main`                              │
└───────────────────────────────────────────────┘       └───────────────────────────────────────────────┘
```

### Environment Configuration Comparison

| Variable | Staging Setting | Production Setting | Notes |
|---|---|---|---|
| `NODE_ENV` | `staging` | `production` | Enables appropriate logging and error details |
| `PORT` | `3001` | `3001` | Standard port |
| `SUPABASE_URL` | `https://[staging-ref].supabase.co` | `https://[prod-ref].supabase.co` | Strictly isolated databases |
| `SUPABASE_SERVICE_ROLE_KEY` | *Staging Service Role Key* | *Production Service Role Key* | Never cross staging and production keys |
| `SUPABASE_ANON_KEY` | *Staging Anon Key* | *Production Anon Key* | Safe for frontend Realtime client |
| `CLIENT_ORIGIN` | `https://staging--[site].netlify.app` | `https://logicwhilequiz.com` | Strict CORS and cookie credential origin |
| `JWT_SECRET` | *Staging Random Hex (64 char)* | *Production Random Hex (64 char)* | Generate via `openssl rand -hex 64` |
| `ADMIN_JWT_SECRET` | *Staging Random Hex (64 char)* | *Production Random Hex (64 char)* | Separate secret for admin JWT |
| `ADMIN_USERNAME` | `admin` | `[secure-admin-name]` | Custom username in production |
| `ADMIN_PASSWORD_HASH` | *Staging bcrypt hash* | *Production 12-round bcrypt hash* | Generated via `generate-password-hash.js` |
| `SMTP_HOST` | Staging SMTP (or Ethereal/Mailtrap) | Production SMTP (SendGrid/Resend/Gmail) | Dedicated email delivery service |

---

### Step-by-Step Change Promotion Workflow

```mermaid
graph LR
    A[Feature Branch] -->|Pull Request| B[Staging Branch]
    B -->|CI Verification| C[Netlify & Render Staging Deploy]
    C -->|Run test-smoke.js| D[Smoke Testing Passed]
    D -->|PR Merge| E[Main Branch]
    E -->|Auto-Deploy| F[Production Live]
```

1. **Local Development**:
   - Write code, verify locally: `npm run lint`, `npm run build`, `npm test`.
2. **Deploy to Staging**:
   - Create a Pull Request into the `staging` branch.
   - GitHub Actions automatically runs CI (lint, build, unit tests, and smoke test).
   - Once merged, Netlify deploys the branch preview (`staging--...`), and Render automatically deploys `logicwhile-quiz-server-staging`.
3. **End-to-End Staging Verification**:
   - Run the automated smoke test suite directly against staging:
     ```bash
     cd server
     API_URL=https://quiz-api-staging.onrender.com node test-smoke.js
     ```
   - Verify full lifecycle: Enrollment → OTP → Exam runner → Proctoring warning → Submission → Real-time Leaderboard → PDF report export.
4. **Promote to Production**:
   - Open a Pull Request from `staging` to `main`.
   - After CI checks pass and code review approval, merge the PR.
   - Netlify and Render auto-deploy to production with zero downtime.

---

## 3. CI Pipeline (GitHub Actions)

The repository includes a GitHub Actions configuration at [`.github/workflows/ci.yml`](file:///c:/Users/chara/OneDrive/Desktop/Quiz/.github/workflows/ci.yml).

### Pipeline Structure
The workflow triggers on every `push` and `pull_request` targeting `main`, `master`, `staging`, and `preview`:

1. **Job 1: `server-ci` (Server Build, Unit Tests & Live Smoke Test)**:
   - Sets up Node.js 20 with npm caching.
   - Installs dependencies: `npm ci`.
   - TypeScript build: `npm run build` (`tsc`).
   - Runs unit security & timing tests: `node test-auth.js`.
   - Runs Excel question schema parser tests: `node test-parser.js`.
   - Launches server in background and executes live smoke test: `node test-smoke.js`.
2. **Job 2: `client-ci` (Client Linter, Type Check & Production Bundle)**:
   - Sets up Node.js 20 with npm caching.
   - Installs dependencies: `npm ci`.
   - Runs static code linter: `npm run lint` (`oxlint`).
   - Type checks and generates production chunks: `npm run build` (`tsc -b && vite build`).

> [!IMPORTANT]
> **Branch Protection**: Configure GitHub branch protection on `main` to require `server-ci` and `client-ci` to pass before merging.

---

## 4. Secrets Audit & Credential Rotation

### Git Secrets Audit & Verification
- `.gitignore` files at root, `client/`, and `server/` strictly exclude all `.env`, `.env.*.local`, `*.dump`, and `node_modules` files.
- To verify that no secrets or API keys have ever been committed into Git history, run:
  ```bash
  # Check for any tracked .env files
  git ls-files | grep -i "\.env"

  # Scan commit history for sensitive variable names
  git log -p -S "SUPABASE_SERVICE_ROLE_KEY"
  git log -p -S "ADMIN_PASSWORD_HASH"
  git log -p -S "JWT_SECRET"
  ```
- *Audit Result*: No sensitive files are tracked. All environment configurations are cleanly separated.

---

### Admin Password Rotation Procedure
The platform does **not** allow plaintext passwords. `ADMIN_PASSWORD_HASH` must be stored as a cryptographically strong bcrypt hash (12 salt rounds).

#### How to Rotate the Admin Password:
1. Run the password rotation utility:
   ```bash
   cd server
   node scripts/generate-password-hash.js "YourNewSecurePassword123!#"
   ```
   *(Or run without arguments to generate a random 16-character base64url password)*
2. The script calculates a 12-round salt, creates the hash, verifies it, and outputs:
   ```
   ================================================================
   Copy the following line to your server/.env file:
   ================================================================
   ADMIN_PASSWORD_HASH=$2b$12$...
   ================================================================
   ```
3. Update `ADMIN_PASSWORD_HASH` in:
   - Local: `server/.env`
   - Staging: Render Dashboard > `logicwhile-quiz-server-staging` > **Environment**
   - Production: Render Dashboard > `logicwhile-quiz-server` > **Environment**
4. Restart the service for changes to take effect immediately.

---

## 5. Manual Setup Checklist Outside Codebase

Complete the following one-time manual tasks in your cloud dashboards:

### 1. Supabase Setup
- [ ] Create **Production Project** (`logicwhile-quiz-prod`) in Supabase.
- [ ] Create **Staging Project** (`logicwhile-quiz-staging`) in Supabase.
- [ ] In both projects, open the **SQL Editor**, paste the contents of [`server/db/schema.sql`](file:///c:/Users/chara/OneDrive/Desktop/Quiz/server/db/schema.sql), and run it.
- [ ] Verify that all 10 tables (`exams`, `participants`, `exam_sessions`, `session_answers`, `questions`, `violations`, `suspicious_activity`, `results`, `deliverable_failures`, `audit_log`) and indexes are created.
- [ ] Copy the Project URL, Anon Key, and Service Role Key for each environment.

### 2. Render / Railway Backend Deployment
- [ ] Connect your GitHub repository to Render.
- [ ] Apply [`render.yaml`](file:///c:/Users/chara/OneDrive/Desktop/Quiz/render.yaml) Blueprint to automatically create:
  - `logicwhile-quiz-server` (Production, branch `main`)
  - `logicwhile-quiz-server-staging` (Staging, branch `staging`)
- [ ] Fill in the environment variables marked with `sync: false` in Render's dashboard:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
  - `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`
  - `CLIENT_ORIGIN` (Your Netlify frontend domain)
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
  - `ADMIN_ALERT_EMAIL` (Security alert recipient for proctoring violations)

### 3. Netlify Frontend Deployment
- [ ] Connect your GitHub repository to Netlify.
- [ ] Set **Base directory**: `client`, **Build command**: `npm run build`, **Publish directory**: `dist`.
- [ ] In Netlify **Site configuration > Environment variables**, add:
  - `VITE_API_BASE_URL`: `https://[your-render-backend].onrender.com`
  - `VITE_SUPABASE_URL`: `https://[your-project-ref].supabase.co`
  - `VITE_SUPABASE_ANON_KEY`: `[your-anon-key]`
- [ ] Enable **Branch deploys** for the `staging` branch (Subdomain: `staging--[your-site].netlify.app`).

### 4. GitHub Repository Security
- [ ] Go to your GitHub repository > **Settings** > **Branches**.
- [ ] Add branch protection rule for `main` and `staging`:
  - Check **Require status checks to pass before merging** (`server-ci`, `client-ci`).
  - Check **Require a pull request before merging**.
