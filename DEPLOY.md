# LogicWhileLiRE — Complete Production Deployment Guide

> **Platform**: LogicWhileLiRE — "Logic. While. LiRE."  
> **Architecture**: Decoupled Client (/client) & Server (/server)  
> **Hosting**: Frontend on **Netlify**, Backend on **Render**, Database on **Supabase**, Email via **Resend**

---

## 1. Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │          Recipients / Inboxes           │
                      │  (Student Gmail, Admin Alerts, etc.)    │
                      └────────────────────▲────────────────────┘
                                           │ Outbound Transactional Emails
┌───────────────────────┐            ┌─────┴────────────────────┐
│   Netlify (Frontend)  │   HTTPS    │     Render (Backend)     │
│   Root: /client       ├───────────►│     Root: /server        │
│   Vite + React SPA    │  WebSocket │     Node / Express / WSS │
│   SPA Rewrite: 200    │◄───────────┤     Auth / Proctoring    │
└───────────────────────┘            └──────────┬───────────────┘
                                                │ PostgREST / RLS
                                     ┌──────────▼───────────────┐
                                     │   Supabase (PostgreSQL)  │
                                     │   Staff / Students / DB  │
                                     └──────────────────────────┘
```

---

## 2. Backend Deployment (Render)

### A. Repository & Service Settings

| Parameter | Value |
|---|---|
| **Service Type** | Web Service |
| **Name** | `logicwhile-server` |
| **Region** | Oregon (or closest to your users) |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |
| **Auto-Deploy** | `Yes` (deploys on git push to main) |

### B. Render Environment Variables

Set each of the following variables in the **Render Dashboard → Environment** tab:

| Variable | Required | Description / Example Format |
|---|---|---|
| `NODE_ENV` | **Yes** | `production` |
| `PORT` | Auto | Assigned automatically by Render (default `3001` or `10000`) |
| `DEMO_MODE` | **Yes** | `false` (Production boot guard enforces `false`) |
| `CLIENT_ORIGIN` | **Yes** | Exact Netlify URL without trailing slash: `https://your-app.netlify.app` |
| `CLIENT_URL` | **Yes** | Canonical client URL: `https://your-app.netlify.app` |
| `FRONTEND_URL` | **Yes** | Frontend origin for email links: `https://your-app.netlify.app` |
| `SUPABASE_URL` | **Yes** | Project URL from Supabase Settings: `https://xxxxxxxxxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Secret `service_role` key (never expose to frontend) |
| `SUPABASE_ANON_KEY` | Optional | Public `anon` key from Supabase Settings |
| `JWT_SECRET` | **Yes** | 64-character hex secret: `openssl rand -hex 64` |
| `ADMIN_JWT_SECRET` | **Yes** | Different 64-character hex secret: `openssl rand -hex 64` |
| `TOTP_ENCRYPTION_KEY` | **Yes** | 32+ character random key for AES-256-CTR encryption of TOTP secrets: `openssl rand -hex 32` |
| `ADMIN_USERNAME` | **Yes** | Initial Super Admin username (e.g. `admin`) |
| `INITIAL_ADMIN_EMAIL` | **Yes** | Initial Super Admin email: `admin@logicwhilelire.com` |
| `ADMIN_INITIAL_PASSWORD` | **Yes** | Strong initial password (12+ characters, random) |
| `INSPECTOR_INITIAL_PASSWORD`| **Yes** | Strong initial inspector password (12+ characters, random) |
| `ADMIN_PASSWORD_HASH` | Optional | Bcrypt hash (12 rounds) of admin password |
| `RESEND_API_KEY` | **Yes** | Resend API key starting with `re_...` (send-only access) |
| `RESEND_WEBHOOK_SECRET` | Optional | Resend webhook signing secret `whsec_...` for delivery status updates |
| `MAIL_FROM_NOREPLY` | **Yes** | `LogicWhile LiRE <noreply@logicwhilelire.com>` |
| `OTP_FROM_EMAIL` | **Yes** | `LogicWhile LiRE Security <admin@logicwhilelire.com>` |
| `LOGIN_ID_FROM_EMAIL` | **Yes** | `LogicWhile LiRE Inspections <inspector@logicwhilelire.com>` |
| `ADMIN_ALERT_EMAIL` | **Yes** | `admin@logicwhilelire.com` |
| `MAIL_REPLY_TO` | **Yes** | `support@logicwhilelire.com` |
| `SUPPORT_EMAIL` | **Yes** | `support@logicwhilelire.com` |
| `OTP_EXPIRY_MINUTES` | Optional | `10` |
| `VIOLATION_THRESHOLD` | Optional | `2` (Number of allowed fullscreen/tab violations before exam submission) |
| `BACKUP_DIR` | Optional | Absolute backup directory (e.g. `/var/backups/logicwhilelire`) |
| `BACKUP_CRON_SCHEDULE` | Optional | `"0 2 * * *"` (Nightly backup cron) |

---

## 3. Frontend Deployment (Netlify)

### A. Repository & Site Settings

| Parameter | Value |
|---|---|
| **Base Directory** | `client` |
| **Build Command** | `npm run build` |
| **Publish Directory** | `client/dist` (or `dist` relative to base) |
| **Redirects** | Handled automatically by `netlify.toml` (`/* -> /index.html 200`) |

### B. Netlify Environment Variables

Set each of the following in **Netlify Dashboard → Site configuration → Environment variables**:

| Variable | Required | Description / Example Format |
|---|---|---|
| `VITE_API_URL` | **Yes** | Render backend URL: `https://your-server.onrender.com` |
| `VITE_SOCKET_URL` | **Yes** | WebSocket backend URL: `https://your-server.onrender.com` |
| `VITE_SUPABASE_URL` | Optional | `https://xxxxxxxxxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Optional | Supabase public anon key |
| `VITE_ENABLE_PROCTORING` | Optional | `true` |
| `VITE_ENABLE_LEADERBOARD` | Optional | `true` |

---

## 4. Supabase Database Migrations

Before launching, execute the following SQL scripts in the **Supabase SQL Editor**:

1. **Mail Logs Audit Table**:
   Run contents of [`supabase/migrations/20261011000000_mail_logs.sql`](file:///c:/Users/chara/OneDrive/Desktop/LogicWhileLire/Quiz/supabase/migrations/20261011000000_mail_logs.sql)
   - Creates `mail_logs` table with statuses: `sent`, `delivered`, `bounced`, `failed`, `resending`
   - Creates indexes on `to_email`, `status`, `resend_id`, `created_at`

2. **Staff Login Linking**:
   Run contents of [`supabase/migrations/20261011000001_staff_login_linking.sql`](file:///c:/Users/chara/OneDrive/Desktop/LogicWhileLire/Quiz/supabase/migrations/20261011000001_staff_login_linking.sql)
   - Adds unique `username`, `phone`, and `must_change_password` columns to `staff`
   - Backfills existing accounts

3. **Core Staff Seeding**:
   Run the idempotent seed script to create initial accounts:
   ```bash
   ADMIN_INITIAL_PASSWORD="your-strong-password" INSPECTOR_INITIAL_PASSWORD="your-inspector-password" node scripts/seed-core-staff.mjs
   ```
   - Creates `admin@logicwhilelire.com` (username: `admin`, role: `admin`, `must_change_password: true`)
   - Creates `inspector@logicwhilelire.com` (username: `inspector`, role: `inspector`, `must_change_password: true`)
   - Idempotent: skips if accounts already exist, never deletes any data.

---

## 5. Resend Domain Verification & Webhook Setup

### A. DNS Configuration for `logicwhilelire.com`
Add the DNS records generated in your Resend Dashboard (Domains → Add Domain):
- **DKIM**: TXT record `resend._domainkey.logicwhilelire.com`
- **SPF**: MX / TXT record `bounces.logicwhilelire.com` pointing to `feedback-smtp.resend.com`
- **DMARC**: TXT record `_dmarc.logicwhilelire.com` value `v=DMARC1; p=none;`

### B. Resend Webhook (Delivery Status Tracking)
1. In Resend Dashboard → **Webhooks** → **Add Webhook**
2. **Endpoint URL**: `https://your-server.onrender.com/api/webhooks/resend`
3. **Events**: Select `email.sent`, `email.delivered`, `email.bounced`, `email.complained`
4. Copy the **Signing Secret** (`whsec_...`) and save as `RESEND_WEBHOOK_SECRET` in Render environment variables.
5. Inbound deliveries will automatically update `mail_logs` status in real-time.

---

## 6. Pre-Launch Verification Checklist

Run these commands locally or in CI before going live:

```bash
# 1. Build validation
cd client && npm run build
cd ../server && npm run build

# 2. Run Admin/Inspector lifecycle verification (9 steps)
cd server && node scripts/test-inspector-lifecycle.mjs

# 3. Verify core staff seed idempotency
node scripts/seed-core-staff.mjs

# 4. Run test suite
cd server && npm test
```
