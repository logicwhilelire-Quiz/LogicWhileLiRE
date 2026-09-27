# LOGICWHILE QUIZ — Ops, Backups & Staging Reference

**Official Platform:** **LOGICWHILE QUIZ**  
**Brand Motto:** *"Elevating Coding Knowledge"*

---

## 1. Supabase Automated Backups & Retention Policy

### Native Supabase Backups
1. **Free Tier**:
   - Supabase performs daily logical backups (`pg_dump`) automatically.
   - Retention window: **7 days**.
   - Available via: **Project Settings > Database > Backups**.
2. **Pro / Team Tier**:
   - Includes **Point-in-Time Recovery (PITR)** using physical WAL (Write-Ahead Logging).
   - Recovery granularity: Up to the second.
   - Retention window: **7 days (standard) or up to 30 days (extended)**.

### Automated Offsite Backup Script
We provide a standalone backup utility in [`server/scripts/backup-db.sh`](file:///c:/Users/chara/OneDrive/Desktop/Quiz/server/scripts/backup-db.sh) that:
1. Performs compressed `pg_dump` backups using the direct Postgres connection URI (`postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`).
2. Compresses dumps with `gzip -9` and timestamps them.
3. Automatically prunes backups older than 14 days.

---

## 2. Separate Staging Environment Architecture

To test live exams, proctoring violations, and email flows without polluting production data:

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│       STAGING ENVIRONMENT       │       │      PRODUCTION ENVIRONMENT     │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ Netlify: preview--logicquiz.app │       │ Netlify: logicwhilequiz.com     │
│ Render:  api-staging.onrender   │       │ Render:  api.logicwhilequiz.com │
│ Supabase Project: quiz-staging  │       │ Supabase Project: quiz-prod     │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

### Staging Setup Checklist
1. **Supabase**: Create a separate project (e.g. `logic-while-quiz-staging`). Run `server/db/schema.sql`.
2. **Backend (Render / Railway)**:
   - Branch: `preview`
   - Set environment variables to point to staging Supabase & staging SMTP.
3. **Frontend (Netlify)**:
   - Branch deploys enabled for `preview`.
   - Set `VITE_API_BASE_URL` to staging Render backend URL.
4. **Isolated Testing**:
   - Tests run in staging will never collide with active production leaderboards or participant records.

---

## 3. GitHub Actions CI/CD Pipeline

The repository includes [`.github/workflows/ci.yml`](file:///c:/Users/chara/OneDrive/Desktop/Quiz/.github/workflows/ci.yml) which executes on every push and pull request to `main`, `master`, and `preview`:
- **Server Job**: Dependency installation, TypeScript compiler check (`tsc`), security auth test, and question schema validation.
- **Client Job**: Dependency installation, type check, and production bundle generation.

---

## 4. Admin Credentials & Rotation Utility

- Default development admin password should be rotated immediately before launch.
- Never store plaintext passwords in `.env` or Git.
- To generate a new bcrypt hash (12 salt rounds), run:
  ```bash
  cd server
  node scripts/generate-password-hash.js "YourSecurePasswordHere"
  ```
- Copy the output line `ADMIN_PASSWORD_HASH=...` to your `server/.env`.
