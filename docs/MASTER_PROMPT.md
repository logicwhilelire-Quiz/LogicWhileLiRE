<USER_REQUEST>
# GROWTHRAN MASTER PROMPT (start to finish)

Product: GROWTHRAN | Tagline: "Learn. Grow. Run." | Developed by: R. Charan Sai
Project folder: C:\Users\chara\OneDrive\Desktop\Quiz | Branch: upgrade/premium-v4
Official logo: client/public/brand/growthran-logo.png (open book + rising growth arrow, bold blue wordmark)

Read this whole file before writing any code. Follow it in order.

---

## 0. GROUND RULES

0.1 Work ONLY inside the Quiz folder. Never touch another project. Never push to a remote. Never delete the git history.
0.2 Brand spelling: the product name is **GROWTHRAN** (matches the logo). Earlier work produced the spelling "GROWRAN" (docs, SQL file name, UI strings). Grep for GROWRAN / Growran / growran, list every hit, and unify to GROWTHRAN / growthran. Rename `growran_v1_admin_control.sql` to `growthran_v1_admin_control.sql` and update references. Internal DB table/column names stay unless a migration + rollback is written.
0.3 Autonomy: continue from phase to phase WITHOUT waiting for me, as long as both builds and ALL test suites are green. STOP and report immediately if (a) any test or build fails and cannot be fixed within the phase, (b) an item in Section 14 (owner inputs) is required and missing, or (c) an action is destructive (drop table, delete data, rename a deployed service).
0.4 After every phase: run both builds and every test suite, commit (one logical commit per item, clear messages), and append a section to `docs/PROGRESS_LOG.md` (what changed, files touched, test counts before/after, anything skipped and why).
0.5 Audit before building. For each phase, first check what already exists (the codebase already has: exam-code system with GR-/LW- prefixes, autosave/resume, concurrent-session block, college scoping, security pass, proctoring timeline, admin analytics, 52/52 tests). Implement only what is missing or weak. Do NOT rewrite working code.
0.6 Never invent secrets, licenses, domains, or credentials. Use env variables and placeholders.
0.7 Code quality: TypeScript strict where already used, no `any` in new code, no dead code, no console.log left behind, no hardcoded colors (tokens only), no duplicated components.

---

## 1. CURRENT STATE (do not redo)

- Client: React + Vite + TypeScript (localhost:5173). Server: Node + Express + TypeScript (localhost:3001).
- Data: running in DEMO_MODE (in-memory mock database) until Supabase credentials are supplied.
- Admin is the single source of truth: 9 admin controls; students can only enter a code, take the exam, and see published results.
- Seeded demo: super admin, exams GR-TECH-2026 and GR-DATA-2026, candidates 2201A0501 to 2201A0504.
- Legacy LW- exam codes remain valid alongside GR- codes.
- Storage keys migrated from lw_* / logicwhile_* to growthran_*.

---

## 2. PHASE A: SECURITY AND PRODUCTION HARDENING (do first)

A1. Default credentials: the seeded super admin `admin / admin123` must NEVER exist in production.
  - Seed it only when `NODE_ENV !== 'production'`.
  - In production, first boot requires `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` from env (min 12 chars), and forces a password change at first login.
  - Add a startup check that refuses to boot in production with a default/weak secret (`SESSION_SECRET`, JWT secret) or with DEMO_MODE on.
A2. DEMO_MODE: add a visible "Demo data" banner for admins when active; make the mode explicit in `/api/health`. Provide a clean switch to Supabase using the SQL file, with a migration runner and rollback notes in OPS.md.
A3. Secrets: confirm `.env`, `*.db`, keys, and scratch files are gitignored and not in history (`git log --all --stat`). If found, untrack and tell me. Provide `.env.example` with every variable documented (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, CLIENT_ORIGIN, SESSION_SECRET, JWT_SECRET, EMAIL_FROM, EMAIL_FROM_NAME, SMTP_HOST/PORT/USER/PASS, PISTON_URL).
A4. Email sender is env-driven (`EMAIL_FROM`, `EMAIL_FROM_NAME`). Do not hardcode a domain I may not own.
A5. Security headers (helmet), strict CORS allowlist from `CLIENT_ORIGIN`, rate limits on login/code-entry/registration, request size limits, input sanitization, parameterized queries only, secure/httpOnly/sameSite cookies in production, CSRF protection for cookie-authenticated mutations, and audit log for every admin action.
A6. Add `npm audit` results to the progress log and fix high/critical issues that do not break the build.
A7. Tests: add/extend suites for A1 (production boot refusal), A5 (rate limit, CORS reject, headers). All must pass.

---

## 3. PHASE B: BRAND AND IDENTITY COMPLETION

B1. Logo pipeline from the provided PNG: remove the off-white background, trace to clean SVG. If the trace is blurry at small sizes, STOP and ask me for the vector original.
  Deliver: horizontal lockup with tagline, lockup without tagline, icon-only mark, one-color mark, and a REVERSED (white/light-blue) version for dark backgrounds.
  Generate favicon (16/32/48), apple-touch icon, maskable PWA icons (192/512), OG image (1200x630), email header, PDF header. Never add glow or drop shadow to the logo. Minimum size and clear-space rules go in `docs/BRAND.md`.
B2. Design tokens (one file, used everywhere):
  - Light theme (default): white and soft-blue surfaces; brand blues sampled from the logo (approx. wordmark #0A3F8F, icon #1B5FB5, tagline #4A7DBE) expanded into a 10-step scale.
  - Dark theme (toggle): Midnight Navy #050814 background, Aerospace Blue #2B7FFF accent, reversed logo.
  - Neutrals plus success/warning/danger; WCAG AA contrast verified on every text/background pair (darken tagline blue for small text on white).
  - Type: one geometric display face (Montserrat or Poppins 600-700), Inter for body, JetBrains Mono for codes/data. Nothing else.
  - Spacing, radius, elevation, and motion tokens (durations, easings). Remove the old neon/glow styling site-wide.
B3. Logo in header and footer on EVERY page (landing, gate, exam-code entry, waiting lobby, exam, results, admin, error, 404, About). Footer: logo, "Learn. Grow. Run.", "Developed by R. Charan Sai", and "(c) <current year> R. Charan Sai. All rights reserved." (placeholder; do NOT add a LICENSE file until I confirm terms).
B4. Logo motion: intro once per session (~1.2s): book outline strokes draw in, the growth line draws upward, arrowhead pops, wordmark slides in, tagline fades up. Loader = the growth-arrow line drawing in a loop. Route transition = thin blue arrow-sweep progress bar. Skeletons shimmer in a light brand tint. Everything respects `prefers-reduced-motion`.
B5. About / Credits page: product story, tagline, developer credit.
B6. PDFs, Excel exports, and emails: GROWTHRAN header + "Developed by R. Charan Sai" footer.
B7. Meta author tag, `package.json` author, manifest, page titles, README, OPS.md, COMPLETE_DOCUMENTATION.md all updated. Do not rename an already-deployed Render service (list any needed change for my approval).
B8. Verify: leftover search for LogicWhile / LOGIC WHILE / GROWRAN (keep only "LogicWhile Institute" as a customer record and legacy LW- compatibility), screenshots of every page in light and dark, all tests green.

---

## 4. PHASE C: REMOVE CERTIFICATES AND VERIFICATION EVERYWHERE

Decision made by the owner: the certificate feature is discontinued. Remove it completely and cleanly.

C1. Inventory first: grep `certificate`, `cert`, `verify`, `verification`, `qr`, `qrcode`, `GR-CERT`, `LW-CERT` across client, server, SQL, tests, docs, emails, PDFs, nav, footer, landing page, FAQ, and marketing copy. Print the list.
C2. Remove: certificate generation service, certificate PDF templates, certificate routes and controllers, public verification page and its route, QR generation used only for certificates, certificate buttons/links/menus in admin and student UI, certificate emails, certificate-related admin controls, and any landing/FAQ/feature text advertising certificates or verification.
C3. Database: do NOT drop data silently. Remove certificate tables/columns from the SQL schema for new installs, and provide a separate migration script (with rollback) for existing databases. List what data would be lost and wait for my OK before running it on any real database.
C4. Retired URL: the old public verification URL must not 404 or crash. Serve one simple branded static page: "Certificate verification has been retired." with a link home, because certificates issued earlier may carry printed QR codes that still point there.
C5. Dependencies: remove packages that were used only for certificates/QR (verify with a usage search before removing).
C6. Tests: delete or rewrite certificate tests (Phase 3 suite included) so the total is accurate, and add a test that the retired URL returns the static page with HTTP 200 and that no certificate route exists elsewhere.
C7. Docs: update OPS.md, COMPLETE_DOCUMENTATION.md, README, and the progress log to state the feature is removed. Re-run all builds and tests.

---

## 5. PHASE D: EXAM INTEGRITY (verify, then fill gaps)

Audit each item; implement only what is missing.
D1. One active session per hall ticket per exam, enforced on the server.
D2. Debounced autosave with an IndexedDB retry queue; a refresh restores the exact question, answers, and remaining server time.
D3. Service worker for the app shell and the active exam payload; queued answer sync on reconnect; visible "reconnecting / synced" indicator.
D4. Socket.io: server-pushed timer ticks (server is the only authority), reconnect and resume handling, shared use by the lobby, leaderboard, and live monitor. Keep the REST poll as fallback. Client displays only; it can never extend time.
D5. College scoping on every query touching exams, candidates, results, leaderboards. Roles: super admin, college admin, exam owner, enforced server-side, with cross-college 403 tests.
D6. JWT expiry tied to the exam window; automatic submission at expiry even if the client is offline or closed.
D7. Answer integrity: server validates that every submitted answer belongs to the candidate's assigned question set; ignore late or duplicate submissions idempotently.

---

## 6. PHASE E: PROCTORING

E1. Keep fullscreen enforcement, tab-switch/visibility detection, devtools detection, and hardware fingerprinting.
E2. Face detection (no face, multiple faces, looking away) with face-api.js or MediaPipe in a Web Worker, sampled every 1-2 seconds at low CPU. Consent screen before camera use. Never store video; store event logs and optional low-resolution snapshots only if the exam enables it.
E3. Per-exam configuration: warning count, terminate rule, grace period, which checks are enabled.
E4. Admin violation timeline per candidate, false-positive review and override, all overrides written to the audit log.
E5. Graceful degradation: if the camera is denied or the device is too slow, follow the exam's configured policy (block, warn, or continue with a flag) and log it.

---

## 7. PHASE F: ADMIN CONTROL AND ANALYTICS

F1. Question bank: Excel/CSV import with a validation report (row-level errors), tags, difficulty, duplicate detection, bulk edit, section randomization, and per-candidate question-order shuffling.
F2. Live monitor: who is online, progress, violations, force-submit, extend time (audit-logged), and broadcast message to all candidates.
F3. Exam builder: duration, sections, marking scheme (negative marking option), window start/end, allowed colleges/branches/sections/batches, proctoring toggles, result publish control.
F4. Roster: bulk enroll via CSV with deduplication and row errors; per-candidate reset and re-attempt with reason logged.
F5. Analytics: question difficulty index, topic accuracy, college/branch/section comparison, score distribution, time-per-question heatmap, and per-candidate growth over time (fits the growth-arrow brand).
F6. Results vault: branded PDF and Excel exports, re-evaluation, and the full admin audit log with filters. (No certificates; see Phase C.)
F7. Admin UI: light and dark themes, skeletons, empty states, keyboard shortcuts for frequent actions.

---

## 8. PHASE G: STUDENT AND PUBLIC EXPERIENCE

G1. Landing page at "/": hero, features, how it works, security and proctoring, college showcase, animated stat counters, FAQ, contact/demo request. No certificate mentions.
G2. Registration gate (spec AL-SPEC-2026-REG) polished with the brand system; multi-step form, live validation, password strength, availability checks.
G3. Exam-code + hall-ticket entry, waiting lobby (live participants, countdown), exam screen (clean, distraction-free), submission confirmation, published results page (score, rank, topic breakdown).
G4. Every page has loading, empty, error, and success states; smooth route transitions.
G5. Responsive audit on phone, tablet, and laptop; touch-friendly exam controls; keyboard navigation and visible focus.
G6. English/Telugu toggle on candidate-facing screens (labels and instructions).
G7. Installable PWA with the new icons and offline app shell.

---

## 9. PHASE H: 3D AND ANIMATION SYSTEM (every section)

H1. Shared 3D kit at `client/src/three/`: one renderer factory, shared materials and geometries, a scene manager, a disposal helper (dispose geometry, material, textures, renderer on unmount), and a capability detector.
  Consolidate the existing 3D folder (32 files, with duplicates such as Podium3D vs LeaderboardPodium) into this kit. Keep the visual output of what works; delete unused duplicates after confirming with a usage search.
H2. Performance rules (hard):
  - Lazy-load every 3D component with dynamic import; load three.js in its own chunk.
  - Cap device pixel ratio at 1.5; target 60 fps on a mid-range laptop, minimum 30 fps on low-end.
  - Pause rendering when the tab is hidden or the canvas is off-screen (IntersectionObserver).
  - Respect `prefers-reduced-motion`: show a static image or CSS/SVG animation instead.
  - Capability detector: no WebGL, `deviceMemory <= 4`, or `hardwareConcurrency <= 4` means automatic fallback to the CSS/SVG version.
  - Budgets: under 100k triangles per scene, under 5 MB of 3D assets per page, no blocking of first paint or core content.
  - ONE active WebGL context per page.
  - NO 3D on the exam-taking screen or during proctoring. Focus and performance come first there.
H3. Style: brand blues only, light and dark aware, no neon, no glow, no glassmorphism. Depth via soft lighting, subtle shadows, and gentle parallax.
H4. Scene per section:
  - Landing hero: 3D open book with a rising growth arrow (brand mark), plus a light node network reacting to mouse and scroll.
  - Landing sections: animated stat counters; small 3D icons for features (shield for proctoring, clock for timer, chart for analytics), each lazy and optional.
  - Registration gate: subtle 3D icosahedron/network backdrop and a card tilt on cursor; disabled on mobile.
  - Exam-code entry: small rotating key/lock element.
  - Waiting lobby: live participant network (nodes appear as candidates join) with a large countdown.
  - Results page: 3D score gauge and topic radar, animated on load.
  - Leaderboard: 3D podium for the top 3 with animated rank changes fed by Socket.io.
  - Admin dashboard: 2D animated charts by default; one optional 3D college globe (CollegeGlobe) on the overview page; 3D views must never slow tables or forms.
  - Loaders and route transitions: the growth-arrow line animation (SVG, not WebGL).
H5. Motion language: durations from tokens (fast 150ms, base 250ms, slow 500ms), one easing curve family, scroll-triggered reveals on section headings, hover states on cards and buttons, counters that count up, and page transitions. All disabled or simplified for reduced motion.
H6. Tests: unit test the capability detector and fallback; a build check that three.js is not in the main bundle; a check that the exam page imports no 3D module.

---

## 10. PHASE I: OPTIMIZATION

I1. Client: route-level code splitting, tree-shaking, image/SVG optimization, font subsetting with `font-display: swap`, bundle analysis. Targets: landing LCP under 2.5s on a mid-range phone (throttled), exam page fully usable on a low-end laptop, initial JS under a budget you record in the log.
I2. Server: DB indexes (college_id, roll_number, exam_id, email), pagination on every list endpoint, caching for read-heavy endpoints, connection pooling, gzip/brotli.
I3. Load test: simulate 500+ concurrent exam takers (autosave + timer sockets + submissions). Report throughput, error rate, and the measured breaking point, and fix the first bottleneck found.
I4. Accessibility: keyboard, focus order, ARIA, contrast, screen-reader labels on the exam screen; report Lighthouse scores for landing, gate, exam, results, and admin.

---

## 11. PHASE J: RELEASE READINESS

J1. Logging with request IDs, error tracking hooks, `/api/health` and `/api/ready`, graceful shutdown.
J2. Deployment: verify `netlify.toml` (client) and `render.yaml` (server) with production cookie/CORS settings and a complete env-var checklist. Do not create or rename cloud services.
J3. Backup and restore runbook, migration and rollback steps, secrets rotation, and an incident checklist in OPS.md.
J4. Documentation refreshed under the GROWTHRAN name: README (setup in 5 minutes), COMPLETE_DOCUMENTATION.md (architecture, API reference, data dictionary, 3D system), BRAND.md, ADMIN_RUNBOOK.md (how to create and run an exam step by step).
J5. Demo mode script: one command that seeds a clean demo dataset and resets it.

---

## 12. FINAL ACCEPTANCE CHECKLIST (definition of done)

Report each item as PASS or FAIL with evidence:
- [ ] Both builds: 0 errors. All test suites green (give the exact total).
- [ ] No hits for "GROWRAN" or product-brand "LogicWhile" (only the customer record and LW- compatibility remain).
- [ ] Logo and footer credit present on every page, light and dark.
- [ ] No certificate or verification code, routes, UI, copy, or tests remain; retired URL serves the static page.
- [ ] No default admin credentials possible in production; production refuses weak secrets.
- [ ] Exam: server-authoritative timer, single session per hall ticket, autosave/resume, offline queue, auto-submit at expiry.
- [ ] Proctoring: all checks working, consent screen, no video stored, admin timeline and override.
- [ ] Every section in H4 has its 3D scene or its documented fallback; exam screen has none; reduced-motion and low-end fallbacks verified.
- [ ] three.js not in the main bundle; landing LCP and Lighthouse numbers recorded.
- [ ] Load test result recorded with concurrency and breaking point.
- [ ] Docs updated; `docs/PROGRESS_LOG.md` complete; git working tree clean; no remote push.

---

## 13. FINAL REPORT FORMAT

End with: a table of every phase (status, commits, tests before/after), the list of files added/removed/changed, everything intentionally kept or skipped and why, open risks, and the exact commands to run the app, run all tests, and start the demo.

---

## 14. OWNER INPUTS (ask me only when the phase needs it; never invent them)

1. Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
2. Production domain and CLIENT_ORIGIN.
3. Email sender address/domain and SMTP credentials.
4. INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD for production.
5. License terms (until then: "All rights reserved" placeholder only).
6. Vector logo original, if the PNG trace is not crisp.
7. Approval before running the certificate-table migration on any real database.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-09-28T21:33:23+05:30.

The user's current state is as follows:
Active Document: c:\Users\chara\OneDrive\Desktop\Quiz\server\db\migration_exam_codes.sql (LANGUAGE_SQL)
Cursor is on line: 21
Other open documents:
- c:\Users\chara\OneDrive\Desktop\Quiz\server\db\schema.sql (LANGUAGE_SQL)
- c:\Users\chara\OneDrive\Desktop\Quiz\OPS.md (LANGUAGE_MARKDOWN)
- c:\Users\chara\OneDrive\Desktop\Quiz\netlify.toml (LANGUAGE_TOML)
- c:\Users\chara\OneDrive\Desktop\Quiz\client\src\components\BrandLogo.tsx (LANGUAGE_TSX)
- c:\Users\chara\OneDrive\Desktop\Quiz\build_svg_pipeline.js (LANGUAGE_JAVASCRIPT)
Browser State:
  Page 8B83902ADBDC0B4614FC5F44A6712B0D (GROWTHRAN — Learn. Grow. Run.) - http://localhost:5173/ [ACTIVE]
    Viewport: 1536x695, Page Height: 8605
</ADDITIONAL_METADATA>
<USER_SETTINGS_CHANGE>
The user changed setting `Model Selection` from Gemini 3.8 Flash (High) to Claude Sonnet 4.6 (Thinking). No need to comment on this change if the user doesn't ask about it. If reporting what model you are, please use a human readable name instead of the exact string.
</USER_SETTINGS_CHANGE>