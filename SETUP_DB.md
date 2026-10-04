# LogicWhileLiRE — Production Supabase Database Setup Guide

This guide details the exact steps to provision and configure a real Supabase (PostgreSQL 15+) database for the LogicWhileLiRE platform, runnable from top to bottom on an empty database.

---

## Table of Contents
1. [Prerequisites & Supabase Project Creation](#1-prerequisites--supabase-project-creation)
2. [Database Schema Deployment](#2-database-schema-deployment)
   - [Method A: 1-Click Consolidated Script (Recommended)](#method-a-1-click-consolidated-script-recommended)
   - [Method B: Step-by-Step Ordered Migrations](#method-b-step-by-step-ordered-migrations)
3. [Row Level Security (RLS) Verification](#3-row-level-security-rls-verification)
4. [Environment Configuration](#4-environment-configuration)
5. [Seeding the Super Admin Account](#5-seeding-the-super-admin-account)
6. [Email Queue & Worker Architecture](#6-email-queue--worker-architecture)
7. [Running Tests in Dual Modes](#7-running-tests-in-dual-modes)
   - [Mock Mode (Default)](#mock-mode-default)
   - [Real Supabase Mode](#real-supabase-mode)
8. [Automated Backups](#8-automated-backups)

---

## 1. Prerequisites & Supabase Project Creation

1. Navigate to [database.new](https://database.new) and sign in to your Supabase account.
2. Click **New Project**:
   - **Name**: `logicwhilelire-prod` (or your choice)
   - **Database Password**: Choose a strong password and save it securely in a password manager.
   - **Region**: Choose the AWS region closest to your target audience (e.g., `ap-south-1` Mumbai).
   - **Pricing Plan**: Free or Pro tier (both PostgreSQL 15+ supported).
3. Wait ~2 minutes for the database cluster to finish provisioning.

---

## 2. Database Schema Deployment

You have two methods to run the database setup in the Supabase Dashboard:

### Method A: 1-Click Consolidated Script (Recommended)

1. Open your Supabase Dashboard and click on **SQL Editor** in the left sidebar (icon `>_`).
2. Click **+ New Query** at the top.
3. Open the consolidated SQL file in your repository:
   - File: `supabase/schema_full.sql`
4. Copy the entire contents of `supabase/schema_full.sql` and paste them into the SQL Editor query window.
5. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
6. Confirm the execution finishes with `Success. No rows returned`.

---

### Method B: Step-by-Step Ordered Migrations

If you prefer applying each migration incrementally or using the Supabase CLI, run the migration files in this exact sequence:

#### Step 1: Core Schema & Extensions
- **File**: `supabase/migrations/20261003000000_core_schema.sql`
- **What it does**:
  - Enables `uuid-ossp` and `pgcrypto` extensions.
  - Declares ENUMs: `session_status`, `violation_type`, `staff_role`.
  - Creates tables: `colleges`, `staff`, `students`, `platform_settings`, `exams`, `questions`, `participants`, `exam_sessions`, `session_answers`, `results`, `exam_codes`, `questions_ec`, `exam_code_attempts`, `violations`, `suspicious_activity`, `proctor_logs`, `deliverable_failures`, `audit_log`, `leaderboard`.
- **Action**: Paste contents into the SQL Editor and click **Run**.

#### Step 2: Role Hierarchy, Roster & Persistent Email Queue
- **File**: `supabase/migrations/20261004000000_hierarchy_roster_email_queue.sql`
- **What it does**:
  - Creates the organizational hierarchy tables:
    - `academic_years` (scoped to college)
    - `cohorts` (Year of Passing / YOP)
    - `sections` (Branch & Section)
    - `batches` (Specific lab/class subsets)
  - Creates `student_roster` with composite unique constraint `(college_id, roll_number)` for strict registration validation.
  - Creates `email_queue` for durable, crash-resilient transactional emails with exponential backoff and payload tracking.
  - Creates backwards-compatibility views: `candidates`, `sessions`, `audit_logs`.
  - Builds performance B-Tree indices on foreign keys, lookup roll numbers, and query timestamps.
- **Action**: Paste contents into the SQL Editor and click **Run**.

#### Step 3: Row Level Security (RLS) & Policies
- **File**: `supabase/migrations/20261004000001_enable_rls_and_policies.sql`
- **What it does**:
  - Enables Row Level Security on all 25 tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
  - Implements **Deny-by-Default** on every table.
  - Creates explicit `service_role` full-access policies so the backend Node.js server (connecting with `SUPABASE_SERVICE_ROLE_KEY`) has unrestricted administrative access while unauthenticated public clients cannot access or modify records.
- **Action**: Paste contents into the SQL Editor and click **Run**.

---

## 3. Row Level Security (RLS) Verification

To verify that all 25 platform tables have RLS enabled with deny-by-default, run this verification query in the **SQL Editor**:

```sql
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected Result**: All 25 tables must show `rls_enabled = true`.

To verify policies:
```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected Result**: Each table has a policy `Allow service_role full access on <table>` granting `ALL` commands to `service_role`.

---

## 4. Environment Configuration

1. In the Supabase Dashboard, navigate to **Project Settings** (gear icon) -> **API**.
2. Retrieve the following credentials:
   - **Project URL**: e.g., `https://xyzabc123.supabase.co`
   - **service_role Key** (under *Project API keys* - click "Reveal"): Starts with `ey...`
   > **SECURITY WARNING**: Never expose the `service_role` key to frontend clients or commit it to version control. It bypasses RLS policies and is strictly intended for the backend server.

3. Update `server/.env`:
```env
# Database Mode (Set false for real Supabase)
DEMO_MODE=false

# Supabase Credentials
SUPABASE_URL=https://xyzabc123.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Mail Layer (Resend API with Brevo SMTP Fallback)
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=noreply@logicwhilelire.com
SUPPORT_EMAIL=support@logicwhilelire.com
ADMIN_EMAIL=admin@logicwhilelire.com
MAIL_DOMAIN=logicwhilelire.com
EMAIL_DAILY_CAP=100
# Optional Brevo Fallback Transport:
BREVO_SMTP_USER=your_brevo_account@domain.com
BREVO_SMTP_PASS=xsmtp_your_brevo_key_here

# Security, Domains & Encryption
PORT=3001
NODE_ENV=production
CLIENT_ORIGIN=https://app.logicwhilelire.com
FRONTEND_URL=https://app.logicwhilelire.com
JWT_SECRET=super-secret-jwt-key-minimum-32-chars-long-here
ADMIN_JWT_SECRET=super-secret-admin-jwt-key-minimum-32-chars-long-here
TOTP_ENCRYPTION_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
BACKUP_DIR=/var/backups/logicwhilelire
```

4. Update `client/.env`:
```env
VITE_API_URL=https://app.logicwhilelire.com/api
VITE_SOCKET_URL=https://app.logicwhilelire.com
```

---

## 5. Automated Pre-Flight Verification (`npm run verify-prod`)

Before sending live traffic, run the automated production pre-flight matrix to verify all 69 critical security checks:
```bash
cd server
npm run verify-prod
```

This automated validator confirms:
- All 15 required production environment variables and domain consistencies.
- Supabase database reachability and connection latency.
- Presence of all 25 expected tables.
- Row Level Security (RLS) active on all 25 tables.
- Security-invoker compatibility views (`candidates`, `sessions`, `audit_logs`).

---

## 6. Seeding the Super Admin Account

Run the interactive admin creation CLI to provision the root super admin with a cryptographically hashed bcrypt password:

```bash
cd server
npm run create-admin
```

Follow the prompts:
- **Email**: `admin@logicwhilelire.com`
- **Name**: `System Super Admin`
- **Password**: `YourSecurePassword123!`

Alternatively, you can insert an admin directly via the Supabase SQL Editor:
```sql
INSERT INTO staff (
    name,
    email,
    password_hash,
    role,
    is_active
) VALUES (
    'System Super Admin',
    'admin@logicwhilelire.com',
    -- bcrypt hash for your secure password (12 rounds)
    '$2b$12$e0NZhMZbjS8V8/f46P4/r.N3fLwzVp52Yk6K7x7A9B.1234567890',
    'super_admin',
    true
) ON CONFLICT (email) DO NOTHING;
```

---

## 6. Email Queue & Worker Architecture

The platform uses a durable, crash-resilient email queue backed by the `email_queue` PostgreSQL table:
- **Zero Loss on Restarts**: When an email is triggered (registration OTP, welcome credentials, exam reminders, reset passwords), a pending job is inserted into `email_queue`.
- **Automatic Resume on Boot**: On server startup (`server/src/index.ts`), `emailQueue.resumePendingJobs()` automatically queries `email_queue` for uncompleted tasks (`status IN ('pending', 'processing')`) and resumes processing.
- **Exponential Backoff**: Transient SMTP/Resend failures retry automatically at 2s, 4s, 8s intervals up to `max_attempts` (default: 3).
- **Delivery Audit Log**: Permanent failures are logged into `deliverable_failures` for administrator review.

---

## 7. Running Tests in Dual Modes

The test suite is designed to run seamlessly in two modes:

### Mock Mode (Default)
Fast, in-memory execution requiring zero external dependencies or internet connection:
```bash
cd server
npm test
```
All 15 test suites run against the in-memory mock store.

### Real Supabase Mode
Run tests against your live Supabase database with automated cleanup of test entities:
```bash
cd server

# Windows PowerShell:
$env:TEST_SUPABASE_URL="https://xyzabc123.supabase.co"
$env:TEST_SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1Ni..."
$env:DEMO_MODE="false"
npm test

# Linux / macOS Bash:
TEST_SUPABASE_URL="https://xyzabc123.supabase.co" \
TEST_SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1Ni..." \
DEMO_MODE="false" \
npm test
```

#### Automated Test Cleanup
When executed against real Supabase, `server/test-helper.js` triggers `cleanupTestData(supabase)` at the end of every suite, purging:
- All test attempts, sessions, and grading results (`%TEST%`, `GR-VRSEC%`, `CS2026-FINAL`)
- All temporary students, rosters, and staff (`%@testcollege.edu`, `%@campus.edu`, `HT2026%`, `TEST%`)
- All temporary hierarchy entries (sections, batches, cohorts, colleges)
- All processed test jobs in `email_queue`

### Playwright End-to-End Tests
To run the full 10-flow browser end-to-end suite against real Supabase:
```bash
cd client
TEST_SUPABASE_URL="https://xyzabc123.supabase.co" \
TEST_SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1Ni..." \
npm run test:e2e
```

---

## 8. Automated Backups

To execute an on-demand database backup into dated CSV and JSON files with row-integrity checks:
```bash
cd server
npm run backup
```

The backup produces:
- `backups/backup-<YYYY-MM-DD-HHmmss>.zip` containing CSV and JSON tables for `colleges`, `staff`, `students`, `student_roster`, `academic_years`, `cohorts`, `sections`, `batches`, `exams`, `questions`, `participants`, `exam_sessions`, `results`, `audit_log`.
- Section/batch-wise student rosters.
- Result sheets grouped per exam.
- Retains the last 30 days of archives and enforces non-leakage of password hashes or TOTP secrets.
