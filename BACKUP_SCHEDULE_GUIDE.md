# 💾 LogicWhileLiRE — Automated System Backup & Task Scheduler Guide

This guide describes how to configure, run, and automate daily backups of all key platform tables for **LogicWhileLiRE**.

---

## 1. Overview of the Backup Engine

The backup system exports database tables from Supabase into dated **CSV** and **JSON** formats, packages them with batch-wise student rosters and exam-wise result sheets, performs row-count integrity checks, strips sensitive credentials, and automatically retains archives for the last **30 days**.

### Key Exported Tables
* **`students`**: Student and candidate profiles, roll numbers, sections, cohorts, and colleges.
* **`staff`**: Inspector, faculty, and administrator accounts (with college scoping).
* **`colleges`**: College profiles, codes, cities, states, and institutional details.
* **`sections` & `batches`**: Academic years, cohort mappings, sections, and batches.
* **`exams`**: Standard exams and exam code records.
* **`questions`**: Full question papers and questions_ec banks (options, marks, sections, topics).
* **`attempts`**: Student exam sessions, answer logs, and timestamps.
* **`results`**: Evaluated scores, percentages, ranks, and performance breakdowns.
* **`audit_logs`**: Administrative action logs and security telemetry.

### Special Directories & Reports
* **`batch_wise_students/`**: Separate CSV rosters grouped by batch/section (e.g., `batch_bat-vrsec-csm-b-1.csv`).
* **`exam_results/`**: Comprehensive result sheets per exam code (e.g., `results_LW-VRSEC-2026.csv`).
* **`manifest.json`**: Cryptographic SHA-256 hash manifest and row-count verification report.
* **`backup_summary.log`**: Human-readable execution summary.
* **`backup.log`**: Append-only master execution ledger in `BACKUP_DIR`.

### 🔒 Security Guarantee
**All sensitive credentials are scrubbed prior to export.** The following fields are strictly omitted from all CSV and JSON backup artifacts:
* `password`, `password_hash`, `temp_password`, `admin_password_hash`
* `session_token`, `totp_secret`, `auth_token`, `jwt_secret`, `jwt_token`, `api_key`

---

## 2. Running Backups Manually

### Via CLI
Run from the `server` directory:
```bash
cd server
npm run backup
```

### Configurable Storage Folder (`BACKUP_DIR`)
By default, backups are written to `server/backups/`. You can customize this by setting the `BACKUP_DIR` environment variable in your `server/.env` file:
```env
BACKUP_DIR=D:\SecureBackups\LogicWhileLiRE
```

### Via Admin Portal ("Download backup now")
1. Log in to the Admin Portal as a **Super Administrator** (`super_admin`).
2. Navigate to **System & Backups** (`/admin/settings`) or **Hierarchy & Roster** (`/admin/hierarchy`).
3. Click the **"Download backup now"** button.
4. The platform generates a live snapshot, validates row counts, compresses the entire dated backup directory into a `.zip` archive, and downloads it directly to your browser.

---

## 3. Scheduling Daily Backups with Windows Task Scheduler

To execute backups automatically every day at **02:00 AM**, choose either Option A (Command Line) or Option B (GUI).

### Option A: Quick Setup via PowerShell / `schtasks` (Recommended)

Open **PowerShell as Administrator** and execute:

```powershell
$TaskName = "LogicWhileLiRE_Daily_Backup"
$BatPath  = "C:\Users\chara\OneDrive\Desktop\Quiz\server\scripts\run-backup.bat"

# Create a daily task scheduled at 02:00 AM
schtasks /Create /TN $TaskName /TR "`"$BatPath`"" /SC DAILY /ST 02:00 /RU SYSTEM /F
```

To run and test the scheduled task immediately:
```powershell
schtasks /Run /TN "LogicWhileLiRE_Daily_Backup"
```

To verify the task status:
```powershell
schtasks /Query /TN "LogicWhileLiRE_Daily_Backup" /V /FO LIST
```

---

### Option B: Step-by-Step Windows Task Scheduler GUI

1. Press `Win + R`, type `taskschd.msc`, and press **Enter** to open **Task Scheduler**.
2. In the right-hand panel under **Actions**, click **Create Basic Task...**.
3. **Name**: Enter `LogicWhileLiRE Daily System Backup`.
   * **Description**: `Automated daily export of all Supabase tables, batch rosters, and exam result sheets with 30-day retention.`
   * Click **Next**.
4. **Trigger**: Select **Daily**, then click **Next**.
5. **Time**: Set Start to `02:00:00 AM`, Recur every `1 days`, then click **Next**.
6. **Action**: Select **Start a program**, then click **Next**.
7. **Program/script**:
   * Click **Browse...** and select:
     ```
     C:\Users\chara\OneDrive\Desktop\Quiz\server\scripts\run-backup.bat
     ```
   * **Start in (optional)**: Enter the server directory:
     ```
     C:\Users\chara\OneDrive\Desktop\Quiz\server
     ```
   * Click **Next**.
8. Check **Open the Properties dialog for this task when I click Finish**, then click **Finish**.
9. In the **Properties** dialog:
   * Under the **General** tab:
     * Check **Run whether user is logged on or not**.
     * Check **Run with highest privileges**.
     * Configure for: **Windows 10 / Windows 11**.
   * Under the **Settings** tab:
     * Check **Run task as soon as possible after a scheduled start is missed**.
     * If the task fails, restart every: `10 minutes`, attempt up to: `3 times`.
   * Click **OK** and enter your Windows administrator credentials when prompted.

---

## 4. Retention Policy & Verification

### 30-Day Automated Purge
Every time `npm run backup` executes:
1. It scans `BACKUP_DIR` for past folders and zip files matching `backup_*`.
2. Archives older than 30 days are automatically deleted to reclaim disk space.
3. The number of purged backups is recorded in `manifest.json` and printed in the execution log.

### Integrity Log Inspection
Review historical backup runs by viewing the persistent log file:
```bash
type C:\Users\chara\OneDrive\Desktop\Quiz\server\backups\backup.log
```

Sample entry:
```
[2026-10-04T05:17:01.275Z] BACKUP_ID=backup_2026-10-04T05-17-01 RECORDS=110 STATUS=PASS DURATION=130ms PURGED=0
```
