# GROWTHRAN — Administrator & Faculty Examination Runbook

**Product:** GROWTHRAN Assessment Engine  
**Tagline:** "Learn. Grow. Run."  
**Platform Architect:** R. Charan Sai  
**Audience:** Super Admins, College Department Heads, Exam Coordinators, and Faculty Proctors  

---

## 📋 Table of Contents
1. [Overview & Role Permissions](#1-overview--role-permissions)
2. [Step 1: Admin Authentication](#step-1-admin-authentication)
3. [Step 2: Institutional Setup (Colleges & Departments)](#step-2-institutional-setup-colleges--departments)
4. [Step 3: Student Enrollment via Bulk Upload](#step-3-student-enrollment-via-bulk-upload)
5. [Step 4: Creating an Exam (Wizard Workflow)](#step-4-creating-an-exam-wizard-workflow)
6. [Step 5: Generating & Distributing Exam Codes](#step-5-generating--distributing-exam-codes)
7. [Step 6: Pre-Exam Readiness Checklist](#step-6-pre-exam-readiness-checklist)
8. [Step 7: Live Examination Monitoring & Proctoring](#step-7-live-examination-monitoring--proctoring)
9. [Step 8: Post-Exam Scoring, Analytics & Exports](#step-8-post-exam-scoring-analytics--exports)
10. [Step 9: Emergency Controls & Incident Response](#step-9-emergency-controls--incident-response)

---

## 1. Overview & Role Permissions

GROWTHRAN enforces three distinct tiers of operational control:

| Role | Scope | Permitted Actions |
| :--- | :--- | :--- |
| **Super Admin** (`admin`) | Entire Platform | Create colleges, manage staff users, database backups, global settings, system logs. |
| **College Admin** (`college_admin`) | Assigned Institution | Bulk enroll students, view college statistics, create exams for their college. |
| **Faculty / Proctor** (`faculty`) | Assigned Exams | Monitor live candidate feeds, review proctoring flags, unlock locked sessions. |

---

## Step 1: Admin Authentication

1. Navigate to the secure admin portal: `https://app.growthran.com/admin/login` (or `http://localhost:5173/admin/login` locally).
2. Enter your authorized administrator credentials:
   - **Super Admin:** User `admin` or registered email.
3. Upon successful authentication, a cryptographically signed JWT with your role claim is issued.

---

## Step 2: Institutional Setup (Colleges & Departments)

Before onboarding candidates or scheduling assessments, verify the institutional entity exists:

1. In the sidebar, select **Colleges**.
2. Click **Add College** and enter:
   - **College Name:** e.g., *VR Siddhartha Engineering College*
   - **College Code:** e.g., *VRSEC*
   - **City / Region:** e.g., *Vijayawada, Andhra Pradesh*
3. Define the academic departments (e.g., Computer Science, Information Technology, AI & Data Science).

---

## Step 3: Student Enrollment via Bulk Upload

GROWTHRAN allows enrolling thousands of candidates in seconds using CSV or XLSX files:

1. Navigate to **Students** → **Bulk Enrollment**.
2. Download the standard CSV template. The file must contain:
   ```csv
   roll_number,full_name,email,college_code,department,year_of_study
   2201A0501,Aditya Sharma,aditya.s@vrsec.edu.in,VRSEC,CSE,4
   2201A0502,Bhavya Reddy,bhavya.r@vrsec.edu.in,VRSEC,CSE,4
   ```
3. Drag and drop the CSV into the upload dropzone.
4. The system validates:
   - Roll number uniqueness per college.
   - Email format validity.
   - College code existence.
5. Click **Confirm Import**. The students are automatically indexed for instant hall ticket validation.

---

## Step 4: Creating an Exam (Wizard Workflow)

1. Select **Exams** → **Create New Exam**.
2. **Phase 1: Basic Information**
   - **Exam Title:** e.g., *2026 Campus Placement Technical Assessment*
   - **College / Target Audience:** Select specific college or All Colleges.
   - **Scheduled Start Time & Expiry Window:** e.g., 10:00 AM to 12:00 PM.
   - **Duration:** e.g., 60 minutes.
3. **Phase 2: Question Configuration**
   - Choose question composition:
     - Multiple Choice Questions (Single select / Multi-select)
     - Coding Problems (Python, Java, C++, JavaScript)
     - Aptitude / Logical Reasoning
   - Set question randomized shuffling (`true` recommended).
4. **Phase 3: Security & Proctoring Configuration**
   - **Full Screen Enforcement:** `Enabled`
   - **Tab-Switching Violation Limit:** Set threshold (default: `2`). Exceeding this auto-terminates the exam.
   - **MediaPipe WebCam Face Monitoring:** `Enabled` (Flags missing face, multiple faces, look-away). Note: No video is ever stored on the server.
5. Click **Publish Exam**.

---

## Step 5: Generating & Distributing Exam Codes

GROWTHRAN eliminates brittle OTP emails by using high-entropy institutional Exam Codes:

1. In the Exam Details screen, click **Generate Exam Codes**.
2. Specify prefix or format (e.g., `DEMO123`, `GR-TECH-2026`).
3. Set code validity parameters:
   - Allowed start window (e.g., within 30 minutes of exam start).
   - Maximum simultaneous uses.
4. Distribute the Exam Code to candidates via official channels. Candidates will enter using:
   - **Candidate Hall Ticket Number** (e.g., `2201A0501`)
   - **Exam Code** (e.g., `GR-TECH-2026`)

---

## Step 6: Pre-Exam Readiness Checklist

Complete this checklist 15 minutes before exam commencement:

- [ ] **Readiness Probe:** Verify `https://api.growthran.com/api/ready` returns `status: ready`.
- [ ] **Health Endpoint:** Verify `https://api.growthran.com/api/health` reports all sub-systems operational.
- [ ] **Lobby Active:** Verify candidates can enter the waiting lobby at `https://app.growthran.com/lobby/:examId`.
- [ ] **Proctoring Telemetry:** Confirm WebSocket connection indicator is green in the Admin Console.

---

## Step 7: Live Examination Monitoring & Proctoring

During the examination window, navigate to **Live Monitor**:

1. **Candidate Roster:**
   - **Active (Green):** Candidate is currently testing and transmitting heartbeats.
   - **Warning (Yellow):** 1 tab-switch detected or transient network disconnect.
   - **Terminated (Red):** Exceeded violation threshold or manual termination.
2. **Proctoring Event Timeline:**
   - Real-time log of security events (e.g., `2201A0501: Tab switch detected [1/2]`).
3. **Emergency Proctor Override:**
   - If a candidate suffered a legitimate hardware malfunction or browser crash, a proctor can click **Review Incident** → **Unlock / Resume Session**.
   - This resets the lock and allows the candidate to resume from their exact saved state with server-authoritative remaining time.

---

## Step 8: Post-Exam Scoring, Analytics & Exports

1. As soon as the exam expires or candidates submit, the auto-grading engine compiles final scores.
2. Navigate to **Exams** → **[Exam Name]** → **Results & Analytics**.
3. **Score Breakdown:**
   - Overall distribution curve, average score, median completion time.
   - Topic-level strength & weakness matrix.
4. **Export Options:**
   - **Consolidated CSV:** Complete candidate scores, roll numbers, percentage, and submission timestamps.
   - **Detailed Audit Log:** Comprehensive proctoring history for institutional accreditation.

---

## Step 9: Emergency Controls & Incident Response

### Candidate Network Drop
- Candidates have an automated offline queue in their browser (`ExamOfflineQueue`). If Wi-Fi blips, answers are stored in indexed DB and synchronized the instant connection resumes.

### Accidental Browser Close
- The candidate can simply reopen `https://app.growthran.com/enter-exam`, re-enter their Hall Ticket and Exam Code, and resume instantly. The server timer continues running in the background.

### Need to Extend Time for All Candidates
- In the Live Monitor console, click **Global Exam Adjustments** → **Extend Duration (+15 minutes)**. The server broadcasts the time adjustment to all connected clients over WebSockets.
