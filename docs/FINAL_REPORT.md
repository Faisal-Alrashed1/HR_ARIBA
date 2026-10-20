# Final Report — التقرير النهائي

# English

## Final Report — ARIBA HR System (ARIBA HR)

> From the very first seed (4 October 2026) to the last commit (`e0587b2`, 20 October 2026).
> Sources: all `docs/` files (PROJECT_GUIDE, HANDOFF, PROJECT_STATUS, ROADMAP, PHASE1_REVIEW, INTEGRATION_AUDIT, USAGE,
> DEPLOY_RAILWAY, CLOUD_HANDOFF, ARIBA_HR_System_Documentation, BUSINESS_RULES, LOGIC_AUDIT, DATABASE, ARCHITECTURE,
> SECURITY, FEATURE_auth, FEATURE_employees, PORT_PLAN, PORT_VERIFICATION, port-context/*, db-normalization/*,
> db-migrations/*), plus `frontend/hr-web/src/port/ADAPTED.md`, `tools/react-parity`, the full git log, and the work done in the sessions
> between 18 and 20 October (migration, merge, deployment, settings, fixes).
> This report contains no passwords, secret keys, or real personal data.

---

### Table of Contents
1. Idea and Goal
2. Working Rules with the Owner
3. Technology Stack and Architecture
4. Full Timeline
5. The Legacy System (V114) As It Was
6. Business Rules and Formulas
7. Parity Audit Against the Legacy System (LOGIC_AUDIT)
8. Porting the HR Department's React System
9. The Database Across All Phases
10. The Server (Backend) and Its Routes
11. The Website (HR Dashboard)
12. The Employee App (Mobile)
13. Roles, Permissions, and Security
14. Environments, URLs, Variables, and Deployment
15. Backups and Rollback Points
16. Tests, Parity Tools, and Their Results
17. Full Commit Log
18. Known Issues and Open Items
19. Contradictions Between Old Documents and the Current State
20. Appendix: Identity and Colors

---

### 1. Idea and Goal

- **ARIBA Consulting** used to run its human resources from **a single huge HTML file** that evolved through numbered updates from V1 to V130
  (and the HR department's copy later reached V171+). The data lived on **Supabase**, built by colleague **Mohammed Awad**
  (tables, SQL functions, calculations).
- The two original files:
  - `1_HR_برنامج_الموارد_البشرية_V114 1.html`: 15,009 lines, about 1.9 MB (of which ~700 KB are base64 images and fonts).
  - `2_EMPLOYEE_تطبيق_الموظف_V114 2.html`: 4,464 lines, about 390 KB.
  - The fingerprint (MD5) of each file is documented in `PROJECT_GUIDE`, and the split copies are in `frontend/legacy`.
- **Goal:** rebuild the system on modern technology **with the same screens, fields, texts, and formulas**:
  1. A website for HR, managers, and finance.
  2. A mobile app for the employee (iPhone and Android): attendance punch, requests, salary.
  3. One server and one database serving both.
- **Principle:** port the logic cleanly with matching results, not copy the old code.
- **People:** the owner Faisal Alrashed. Colleague Mohammed Awad (the original Supabase database). Colleague Ghady Nafisah (Ghady Nafisah,
  repository `Dalteam/HR_ARIBA`) carried out the database unification (Normalization). On 18 October the HR department delivered a complete
  React system whose features were ported.

---

### 2. Working Rules with the Owner

- Reply **in Arabic, brief and direct**.
- **No push to `main` and no deployment until the owner says "deploy".** Pushing to `main` deploys **production and demo together**.
- **No deletion of anything** (files, databases, environments, backups) unless the owner names it and requests it.
- The implementer decides the details, and stops for the owner only on real decisions and before deployment.
- No real passwords are written on the deployed sites; testing is done locally with test accounts.
- No files containing real data are pushed (database dumps, logs). SQL files for schema only are allowed.
- The reference for every screen, field, text, and formula: the split HTML copy in `frontend/legacy` and the Supabase functions in
  `tools/legacy-parity/sql` — then from 18 October: **the HR department's React system**.
- `frontend/legacy` and the original files are not modified; and their system's folder (`reference/hr-react`) is read-only.
- The owner personally runs any Railway command that changes the database.
- Every commit ends with a `Co-Authored-By` line.

---

### 3. Technology Stack and Architecture

#### 3.1 Current Technologies
| Part | Technology |
|---|---|
| Server | Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2 + psycopg 3 (raw SQL via `text()`), Pydantic, PyJWT, Argon2/bcrypt, pytest |
| Database | PostgreSQL 18 on Railway, service `Postgres-Q6OM` (unified since 13 October), and the old `Postgres` service preserved untouched |
| HR website | Next.js 16, React 19, TypeScript, Chart.js, Tabler Icons, Zod, ESLint. Uses `proxy.ts` instead of `middleware.ts` (Next 16) |
| Employee app | Expo 57, React Native 0.86, TypeScript, Expo Router, expo-location, expo-secure-store, react-native-svg, react-native-webview, and after the port: expo-document-picker, expo-file-system, expo-local-authentication, expo-notifications, expo-print, expo-sharing, expo-device |
| Hosting | Railway, project `sparkling-learning`, two environments: production and demo |
| Repository | GitHub `Faisal-Alrashed1/HR_ARIBA` (private) — pushing to `main` deploys both environments automatically |
| PDF libraries on the website | jspdf 4.2.1 + html2canvas 1.4.1 |

#### 3.2 Architecture
```
 HR website (Next.js)                  Employee app (Expo)
 frontend/hr-web                       frontend/employee-app
        │        HTTPS JSON  /api/v1          │
        └──────────────────┬──────────────────┘
                           ▼
      FastAPI: backend/app/main.py
      routers/canonical.py (the core) + routers/port_*.py (their system's features)
      services/ (formulas, mail, notifications, scheduled jobs …)
                           ▼
      PostgreSQL on Railway (the unified schema + migration 001 tables)
```
- **The server owns** state, rules, calculations, and permissions; the frontends only reflect.
- **Login:** `POST /api/v1/auth/login` returns a server-signed JWT; accounts are in `ariba_auth_accounts`; old bcrypt passwords
  (`$2a$`) are automatically converted to Argon2; `ariba_sessions` stores a session ID inside the JWT.
- **Files** (photos, attachments, and letters) are stored **inside the database** in `ariba_documents.file_data` (since commit
  `683982d`), and the Railway disk `/data` is unused.
- Both frontends rely only on the server's JSON, not on the database's shape.

#### 3.3 Key Files
- `backend/app/routers/canonical.py`: all core routes in raw SQL (~2,640 lines).
- `backend/app/routers/port_*.py`: routes for their system's features: `port_workflow`, `port_candidates`, `port_employees`,
  `port_goals`, `port_docs`, `port_mail`, `port_tasks`, `port_assets`, `port_audit`, `port_auth`, `port_staff`,
  `port_settings`.
- `backend/app/services/`: `employee_map.py`, `canonical_data.py`, `leave.py`, `gosi.py`, `end_of_service.py`,
  `contracts.py`, `country.py` (Egypt), `schedule.py` (Ramadan), `port_common.py` (permissions, stages, notifications),
  `port_audit.py`, `mailer.py`, `push.py`, `scheduler.py`.
- `backend/app/models.py`: the list of allowed tables, checked at startup (the server refuses to boot if a table is missing).
- `frontend/hr-web/src/port/`: their system's screens ported as-is (see §11).
- `frontend/hr-web/src/lib/calc/*`: the website's formulas (payx, payroll-rows, insurance, country, schedule, salcalc, tax,
  assets, wps, goals, inscalc, provisions, eos, settlement, tafqeet, forms …).
- `frontend/employee-app/app/*` and `src/lib/*`: the app's screens and the server client.
- `tools/legacy-parity`, `tools/react-parity`, and `tools/dev-db`: the parity tools and the test database.

---

### 4. Full Timeline

#### 4.1 — 4 October: The First Version (later reset)
- Server foundation: login, roles, security, employees; Saudization, social insurance, end of service, dashboard, alerts, documents,
  photo, dependents; V114 design; first deployment on Railway.
- Hosting decision: everything on Railway without Supabase; internal login with Argon2id in the `credentials` table and JWT HS256 with
  a per-user `token_version` (changing the password revokes old sessions); files on disk (Railway Volume).
- Phase one review (`PHASE1_REVIEW`, branch `feat/foundation`, last commit `e8ca7c9`): 25 tables, 27 enums, 19 routes,
  28 pages (10 built and 18 placeholders). Estimate: infrastructure ~85%, HR features ~12%, app ~15%, approval workflow 0%,
  **overall ~15%**. The "complete" rule = UI + route + saved in the database + server-side permissions.
- That day's decisions (`PROJECT_STATUS`): end-of-service base = basic + housing (changed later), years of service = days ÷ 365,
  Saudization = headcount, approval stages are data in `workflow_rules`.
- This state was preserved in the tag `archive/before-reset` and the branch `feat/foundation`.

#### 4.2 — 5 October: Rebuilding from the Split HTML
- The repository became: `backend` + `frontend/hr-web` + `frontend/employee-app`, with the reference in `frontend/legacy`
  (HR portal: 27 CSS + 141 JS; employee portal: 14 CSS + 47 JS; re-merging yields the original character for character, and a
  Playwright comparison of 13 pages matched).
- Ported with matching results: social insurance with the V130 exemption, the end-of-service page (`rEOS`), the final settlement (`sRun`), the PAYX V119 payroll engine,
  the payslip, locations, attendance, the leave-ledger engine, leaves, documents, the nine reports, settings, the nine forms on company
  letterhead.
- That day's commits: `782616e` payslip, `32339b9` locations, `efc07d3` attendance, `b03d014` leave engine, `abd4f3b` leave
  routes, `0085b8b` leaves page, `e93e943` documents, `435879f` reports, `0e013a0` and `afd85a9` settings, `9e97bc8`
  and `4e997a0` letters and forms, `50f2998` fetching all employee pages.

#### 4.3 — 6 October: Additions and the First App
- Website: V117 attendance reports, the settlement document with amount-in-words (tafqeet), payroll archive, bulk sending and English forms, work locations
  per employee (V121), request attachments (12 MB), contract end with automatic termination/reactivation, a "no deduction" option for social insurance.
- App: GPS attendance punch with server-side verification of the geofence and flexible hours, My Requests, forgotten punch, team, approvals, forms,
  payslips, notifications.
- Commits: `8796992` schema cleanup 0007, `b691f3f`, `12f2a9c`, `e731ac6`, `ccbe966`, `c7a268b`, `5ac4b22`, `cd5e76b`,
  `cd0e941`, `0c4e305`, `53615a5`, `8b3a3f9`, `94785dc`, `46c6ae5`, `0d0caa9`, `1df0d25`, `1ea0d8a`.

#### 4.4 — 8 October: Moving to the Colleague's Database (canonical)
- The server now runs on the original Supabase schema via `canonical.py`, service `Postgres-Q6OM`.
- Integration audit (`INTEGRATION_AUDIT`): 34 tables, 106 employees, 110 accounts. The export file had no keys or indexes, and some tables
  had duplicate rows; 5 missing functions were rewritten in Python (`ariba_leave_calc`, `ariba_punch_late`, `ariba_punch_early`,
  `ariba_point_in_polygon`, `ariba_apply_forgot_punch`).
- A tool `backend/tools/create_account.py` to create a login with a temporary password. The app took on the old V118 look.
- Rollback for that step: revert `DATABASE_URL` to `${{Postgres.DATABASE_URL}}` and deploy `1ea0d8a`.
- Commits: `d32f890`, `d5cd4e3`, `39616b4`, `8b46326`, `6f89af9`.

#### 4.5 — 11 October: Demo, Identity, and UI
- **Demo environment:** a copy of production with all salaries set to 1000 (a Railway setting, not a commit).
- **Identity:** Tabler icons instead of emoji, ARIBA colors, avatar images for male/female/Tamheer.
- UI: a unified date/time picker (39 fields), a "Requests and Leaves" page, a forgotten-punch alert, dashboard improvements, a
  "Refresh data" button that reloads any page.
- Employees: saving recalculates the stored social insurance and net pay (102/107 match the legacy), an "All employers" filter.
- Commits: `673ddb1`, `9a345ee`, `487fbaa`, `8ee52fc`, `fe9c836`, `d1d6699`, `2dea04d`.

#### 4.6 — 11–12 October: Parity Audit Against the Legacy System (`0f85a93`)
- Details in §7. Key findings: the end-of-service report uses the recorded award (84/84), contract end is computed on save,
  reactivation on renewal, punch by polygons with the smallest zone first, remote work only with an approved request, late minutes ≥1, dashboard
  numbers match, social insurance exemption = `kindOf` (428/428), app balance = `ariba_leave_calc`, all requests go manager → HR →
  executive (forgotten punch HR only), HR is alerted on every request, and Labor Law corrections A–J (then K).

#### 4.7 — 12–13 October
- `683982d` files in the database, `c24e6d6` removed the open-notes section from the guide, `1d2bbed` dark green borders
  for all dashboard tiles, `ad8ee40` fixed HR deleting a request (a missing parenthesis was returning 500 and showing "Could not reach the server") + a test.
- Rollback point `before-normalization` (a tag on `ad8ee40` + a full copy on the owner's machine).

#### 4.8 — 13 October: Database Unification (Normalization) and Its Deployment
- `dbbee54`: merged the work of colleague Ghady Nafisah (repository `Dalteam/HR_ARIBA` commit `8e5716a`); taken as-is: `canonical.py`,
  `models.py`, the contract test, `create_account.py`, app notifications (read state from the server), the attendance page (sessions per
  day). Kept from ours: the delete fix and the borders. A unified delete function was added that deletes a request and everything linked to it.
- `1ba1a42`: the script `docs/db-normalization/run_on_railway.sh` (backup → `railway_prep.sql` → checks →
  fixes → checks → `ariba_normalization.sql`).
- **Deployment:** demo 15:23 and production 15:26 on 13 October, deployment 15:27. Health OK. Counts unchanged except: payroll
  175 → 171 (4 orphan rows for deleted employees, preserved in `ops.orphan_payrolls_backup`), and approval procedures 12 → 14
  (added the missing ones and removed the old "HR bypass" stages).
- `494998d` (14 October): updated `PROJECT_GUIDE` in Arabic and English — the last commit before porting their system.

#### 4.9 — 18 October: Porting the HR Department's React System (Tasks 0–11)
- Full details in §8. Commit summary:
  - `14b7983` Task 1: the plan `PORT_PLAN.md` (188 rows, all screens and functions).
  - `2c5f71b` Task 2: the `tools/react-parity` tool and the baseline (81,615 cases).
  - `8db0266` part of Task 3: their leave engine, the automatic social insurance table, the Egypt layer, copying their formulas.
  - `abdcf3d` cloud session handoff: a read-only reference copy of their system + context files + the database schema without data.
  - `ffc63d8` **Task 3:** our formulas produce their results (0 differences, 111/111 rows).
  - `91436f9` **Task 4:** removed our logic that they don't have (🟣).
  - `69d5063` **Task 5:** migration `001_react_port.sql` + verification + the script + the test database `tools/dev-db`.
  - `8ff583c` **Task 6:** server routes for all their features + integration tests.
  - `5deaa1c` **Tasks 7 and 9:** the website with their screens + the public application page `/apply`.
  - `3fb1487` **Task 8:** employee app features (type check only).
  - `339ccf9` the verification report `PORT_VERIFICATION.md`.
  - `837cbeb` **Task 10:** a full scenario on a synthetic database: 50/50.

#### 4.10 — 18 October Evening: Migration, Merge, and Deployment
- **Code backup:** branch `backup/قبل-الدمج` on the old `main` (`494998d`).
- **Database migration (run by the owner from his machine with `run_on_railway.sh`):**
  - **Demo:** 19 MB backup (`db_demo_20261018-201331.sql.gz`), all checks ok, 25 foreign keys, counts
    before = after: accounts 111, attendance 65, audit 624, documents 4, employees 111, leaves 15, notifications 82,
    payroll 171, requests 29.
  - **Production:** 19 MB backup (`db_production_20261018-201456.sql.gz`), all checks ok, counts before = after:
    accounts 111, attendance 50, audit 446, documents 2, employees 107, leaves 8, notifications 21, payroll 171,
    requests 9.
- **Merge:** `main` fast-forwarded from `494998d` to `837cbeb`; the Railway deployment for both environments succeeded (green).
- **Server variables** (added by the owner via Railway commands):
  - Production: `MAIL_SECRET_KEY` (randomly generated on the owner's machine), `SCHEDULER_ENABLED=1`.
  - Demo: `MAIL_SECRET_KEY`, `SCHEDULER_ENABLED=1`, `MAIL_DISABLED=1`, `PUSH_DISABLED=1`.
- Running the app from the Mac: `npx expo start --tunnel` (any network) or with `EXPO_PUBLIC_API_URL=https://hrariba-demo.up.railway.app` for the demo.

#### 4.11 — 19 October: Identity, Mail, and Production Data
- `daabbf3`: it was discovered that their system converts every emoji into a Tabler icon via `ico-runtime.js` (in their Vite config) and that this
  was lost in the port; it was wired via `next.config.ts` for `src/port` files only. And our dashboard design came back (green borders, icons,
  single-color avatars, a readable payroll figure, department bars with a gradient, chart colors) + the ARIBA logo in the sidebar.
- **Mail:** the company mail was configured on Gmail with an app password (port 465 SSL).
  - `6fb7303`: the "Send test message" button was going to the document-sending route and asking for a PDF; it now goes to `/mail/test`.
  - In Safari the "Send email to employee" button showed nothing; in Chrome the real error appeared:
    `SMTP: [Errno 101] Network is unreachable` — **Railway blocks SMTP on trial/free plans**.
  - Decision: send via **Microsoft 365 / Graph** (does not go through SMTP). Registering the app in Microsoft Entra began
    (the owner's account shows "No roles assigned", so the Grant admin consent step may need a Global Administrator).
- **Direct manager:** in their system it is filled in for all employees, and in our database it is not — because we ported their code, not their data. One employee
  had a manager saved with a non-existent ID, so the server refused to save his salary ("Manager must be a different existing employee"); it was resolved from
  the screen. Filling in managers for all employees is handled by the owner's colleague.
- **Searching the employee list** was crashing (`includes is not a function`): 7 employees had their iqama number stored as a number rather than text
  (from an old Excel import). Fixed with a single SQL command in **production (UPDATE 7)** then **demo (UPDATE 7)**.
- A comparison of features and their lists, environment URLs, stop/start commands, Railway cost estimates (~$0.3–0.5 per day
  for the eight services), and a warning that the Railway trial credit shows "9 days or $2.46 left".

#### 4.12 — 20 October: Fixes from the Owner's Review (`e0587b2`, deployed after "deploy")
- **App:** the edit-profile, change-IBAN, and document-upload screens were crashing ("useData outside DataProvider") →
  the data provider moved to the app root and is cleared on logout; attachment upload "Could not read the file" → `base64` in the file picker
  is web-only, so the file is now read from the device via `expo-file-system`; the signature pad (line jumping and page moving) was fixed and enlarged;
  the signature buttons appear only when the document is awaiting the employee; the "My File" card covers fully and a long name wraps to a new line.
- **Document flow:** HR sends → the employee signs/approves → it appears in HR's pending requests with the signed copy → HR approval closes it →
  it appears in all requests and the forms archive; an objection closes it and notifies HR.
- **Website:** the sidebar now sits under popups (it was above them and covering part of them); checkboxes no longer squeeze
  the text beside them (country-system cards); all numbers are English (Western) digits; **only 4 identity colors**.
- Checks: pytest 108 passed, react-parity 0 differences, legacy-parity matching, the scenario 50/50, the production build succeeded, 24 screens with no
  Arabic digits, all screens error-free for three roles, and the app in the browser opens the three screens.
- Deployment: committed on `main` locally, then after the owner's "deploy" command it was pushed and deployed.

---

### 5. The Legacy System (V114) As It Was

#### 5.1 How It Was Built
- A main file followed by dozens of patches (from V18 to V130), each wrapping or replacing a previous global function or injecting UI via
  `setInterval`; the load order determines behavior and the last definition of a function is the effective one.
- Server: Supabase RPC functions (`ariba_*`), and hosting as static files on Netlify.
- HR data was in the browser's **localStorage** (keys `hr7_…` such as `hr7_emps`, `hr7_pay_YYYY_MM`,
  `hr7_settings`, `hr7_insuranceRules`, `hr7_hols`, and `hr7_locs`), with the "sensitive" keys XOR-encrypted with a fixed key (obfuscation, not
  security), and dependents stored on the device only.
- The session in `sessionStorage['ariba_hr_session_v3']`, lost when the tab is closed.

#### 5.2 The HR Portal
- Menu: General (dashboard), Employees, Attendance and punch locations, Leaves, Finance (payroll, payslip, end of service,
  settlement), Documents, Administrative (reports, settings), Forms.
- Dashboard: six tiles (employees, Saudization, total salaries, gender, departments, suspended/terminated/Tamheer), charts
  (salaries by employer, nationalities, employers, departments), urgent alerts (≤ 90 days), pending requests, payroll summary.
- Employees: tabs (All, Current, Terminated, Tamheer, Training, Consultants), a 5-tab form (Basic,
  Documents, Contract, Salary, Dependents), saving (`sEmp`) checks uniqueness of number, email, and ID, new number = highest number + 1, username
  `EMP` + 3 digits, termination of service with a reason and last day, reactivation, permanent deletion.
- Attendance: today's cards, daily log, manual entry, monthly report, advanced V117 reports, refresh every 8 seconds.
- Punch locations: radius 50–5,000 m (V38 enforces 1,000 m for non-"remote"), the "Remote work" and "Egypt" locations are mandatory (V35),
  linking employees to locations (V121).
- Leaves (6 tabs): Pending (approve/reject with reason/final approval/delete), All Requests, New Request from HR, Balances and their editor,
  Public Holidays, Overtime.
- Payroll: matches the Excel file "September 2026 Payroll", approval freezes the payroll and shows it to the employee, printing is A4 landscape with fixed
  signatures.
- Payslip, end of service (Articles 84/74/85/75/77/80/74(4)/74(3)), settlement (9 reasons, a one-page official document with amount-in-words),
  documents (iqamas, passports, medical insurance, contracts), the nine reports, settings, the nine forms (work commencement, receipt of IT custody,
  probation extension, probation end notice, clearance, experience certificate, probation evaluation, contract end notice, salary
  letter), the "ARIBA AI" assistant (V112), the bell.

#### 5.3 The Old Employee App (PWA)
- Login with `EMPxxx`, and the full context via `ariba_employee_context`.
- Tabs: Home (punch card and Riyadh clock), Attendance, Leaves, Salary, My Team, My File, Overtime, Documents,
  Approvals (for manager/HR/executive).
- The punch `ariba_attendance` with server-side verification of the geofence and the flexible window; errors `OUTSIDE_GEOFENCE`,
  `TOO_EARLY_FOR_FLEXIBLE_WINDOW`, `TOO_LATE_FOR_FLEXIBLE_WINDOW`; multiple sessions per day.
- Requests: 16 types + forgotten punch; attachment ≤ 12 MB.

---

### 6. Business Rules and Formulas

> The current state = **their system's formulas** (since 18 October). The date is mentioned where something changed.

#### 6.1 General Rules
- Rounding `r2(x) = Math.round(x×100)/100` (the V119 engine adds EPSILON).
- A working day for leaves: not Friday, not Saturday, and not a public holiday; holidays extend by their number of days and recurring ones repeat every year.
- Time zone: Asia/Riyadh. Work week: Sunday–Thursday.
- **Numbers in the interfaces are always English (0–9)** since 20 October.

#### 6.2 Salary and Currency
- `salaryTotal = basic + housing + transport + project + other + extra`.
- `net = total − employee's social insurance share − other deductions`.
- Currencies: riyal, dollar, euro, pound; the default dollar rate is 3.755 (and in some places 3.75), and net in riyals = net × rate.
- Old data fix: a net mistakenly stored in riyals is divided by the rate, and a net greater than 20 times the total is recalculated.

#### 6.3 Social Insurance (GOSI)
| Rate | From 2026-01-01 | From 2027-07-01 |
|---|---|---|
| Employee "matching" < 55 | 10.75% | 11.25% |
| Employee "matching" 55+ | 10.50% | 11.00% |
| Employer "matching" < 55 | 12.75% | 13.25% |
| Employer "matching" 55+ | 12.50% | 13.00% |
| Employee "non-matching" < 55 | 9.75% | 10.25% |
| Employee "non-matching" 55+ | 9.00% | 9.50% |
| Employer "non-matching" < 55 | 11.75% | 12.25% |
| Employer "non-matching" 55+ | 11.00% | 11.50% |
| Non-Saudi | Employee 0%, employer 2% | Same |
| Wage cap | 45,000 | 45,000 |
- `calcIns`: `base = min(cap ÷ days in month × working days, basic + housing)`; the employee and employer shares = base × rate.
- The automatic V130 exemption (zero for both parties): Tamheer, consultant, trainee (by title, department, employer, or type).
- **After the port:** an automatic rate table with periods before 2026 as well (their table is more legally accurate: before 2026 we computed zero, and the rate for the first
  half of 2026 was wrong), and `calcIns` with JavaScript rounding, in `services/gosi.py` and `lib/calc/inscalc.ts`.

#### 6.4 Leaves
- Annual entitlement = `leaveDaysContract` or 21.
- **After the port — three accrual methods** (setting `leave_accrual_method`): calendar (their default), monthly, working days.
- Carry-over (setting `leave_carry`): with a maximum (production: 10 days, enabled), and the excess goes to the end-of-service balance.
- The special 2024 carry-over rule (the excess over 10 from 2023) was **cancelled**, and freezing the balance of a terminated employee was **cancelled**.
- Annual leave interrupted by sick leave has its days restored (`usedThrough`).
- The app balance (current and year-end) is computed by the server with the same engine (Decision 4), with no snapshots from the browser.
- A year-balance editor (yearEnd/current/carryNext/eos) with a log of the last 10 saves and "undo".

#### 6.5 Overtime
- Payroll column X: `(total ÷ days ÷ 8 × hours) + (basic ÷ days ÷ 8 ÷ 2 × hours)` — the full hourly wage + 50%
  of basic (Article 107). Without hours: a manual amount.

#### 6.6 End of Service
- End-of-service page (`eosByLaw` after the port): base = basic + housing; years = days ÷ 365.25;
  Article 84 = `base/2 × min(years,5) + base × max(0, years−5)`.
- Resignation (85/75): less than two years 0, less than 5 one third, less than 10 two thirds, otherwise full — **exactly 5 years = two thirds**
  (correction A cancelled).
- Article 77: a single article for all contracts (correction C for fixed-term contracts cancelled); Article 87 **removed** (correction D); Article 80 and Article
  53 (probation) = 0; an employee "excluded from end of service" is not computed.
- In payroll (PAYX): `K = years + months/12 + days/360`, the wage `T` = all allowances, reason factors (agreement 1, contract end 1,
  Article 80 = 0, resignation by ratios, …).
- A documented old example: joined 2019-03-10, last day 2026-09-30, T = 14,000, resignation → AK = 47,203.65.

#### 6.7 Settlement
- Copied verbatim (`settle`): service in years+months+days (+1); award as per Article 84 and others; leave compensation = wage/30 × remaining
  balance; deduction for excess leave; wage for the last period; additions and deductions (amount or days).
- **After the port:** no rounding of inputs, no Article 87, no Article 77 for fixed-term contracts, and an Egyptian settlement.
- Documented old examples: Article 84 = 140,224; 85 = 116,618.44; 77 = 193,132; 80 = 69,407.33.

#### 6.8 Payroll (PAYX V119)
- Inclusion: current employees except those terminated, hourly workers, external consultants, and excluded ones; those terminated during the month are added automatically.
- Columns: V basic by days, Y housing, Z transport, AA project, AB other, X overtime, AC leave compensation, AK end of service,
  AM total due, AU deductions, AV net, AW net in currency.
- Leave balance in payroll: `N = K≤5 ? K×M : 105 + (K−5)×30`.
- **Payroll social insurance on basic + 25%** (correction G, which used the actual housing, was cancelled).
- Egypt layer: income tax (TAX) and the Martyrs' Fund (MF).
- **Payroll cycle after the port:** HR saves → "Prepare for Finance" → Finance approves → it is locked → reopening with a reason ≥ 5 characters; autosave
  and syncing others' edits; every manual edit is recorded in the edit log.
- Deduction for unpaid leave and salary advance remains manual (Decision 8).

#### 6.9 Payslip and Salary Letter
- The payslip comes from the approved payroll row; if not saved, `calcFor` is computed for the month (row 55).
- Salary letter: total = basic + housing + transport + other (without project), an outgoing number `AR-YYYYMMDD-n` daily, Hijri date
  (Umm al-Qura) and Gregorian.

#### 6.10 Attendance and Punch
- Lateness = check-in − (start of shift + grace); a partial minute counts as at least one full minute; a grace of 0 is respected.
- Flexible hours: expected check-out = first check-in + shift hours, capped at the end of the window if late; **after the port, Ramadan
  hours are included** (Ramadan detection with the Umm al-Qura calendar `hijridate`).
- Each session keeps its own early check-out (correction K cancelled).
- Absent = employees − (present + late).
- Remaining remote work = `remote_days_per_year − used` (default 10) — Decision 1.
- Geofence: Haversine ≤ radius; polygons (V140) and smallest zone first; "remote" only with an approved request for that day.

#### 6.11 Alerts (V142 after the port)
- Iqama 60 days, passport 90, contract 60, probation 30 (from −7, within 400 days of the start, not for consultant/Tamheer/trainee),
  sorted by days; remaining days via `Math.round`.

#### 6.12 Approval Workflow (their sql/10)
- The path: direct manager → Human Resources → [CEO]; the executive only if the final approver for the type is the executive.
- `workflow_config`: `manager_wait_days` 3, `ceo_wait_days` 3, `advance_max_percent` 100, `extra_hr_emails`,
  `final_by_type` = Human Resources for: unpaid, advance, IBAN change, data edit, document.
- Forgotten punch, data edit, and document go directly to HR; no manager → HR.
- Advance ≤ salary × percentage, and only one pending request. IBAN change: one request, certificate mandatory, letter ≤ 400 KB.
- Data edit: 9 allowed fields. An HR rejection requires a reason.
- Escalation: after the timeout from `updated_at` (an hourly scheduled job). HR return to the manager with a note. Delegation. Submitting on behalf of someone.
- **Forms sent for signature (since 20 October):** the employee signs/approves → (the manager's signature if required in `doc_sign_cfg`) → the
  `hr` stage in pending requests → HR approval closes it (no executive stage).

#### 6.13 Goals and Evaluation
- Annual/quarterly/monthly periods; evaluation = `round(Σ score×weight ÷ Σ weights, 1)`; approval by the manager/head/executive or
  the direct manager with permission; HR only prepares.

#### 6.14 Amount-in-Words (Tafqeet)
- Riyals and halalas in singular, dual, and plural forms, "… Saudi riyals and … halalas" or "only". Example: 2,000 → «ألفان ريال سعودي لا غير» ("two thousand Saudi riyals only").

#### 6.15 Data Hard-Coded in the Old Code (Inherited)
- Names excluded or terminated in old patches, fixed signatures in the payroll printout, and the stage approvers (HR = employee 40,
  executive = employee 86 in `workflow_approvers`).

---

### 7. Parity Audit Against the Legacy System (LOGIC_AUDIT, 11 October)

#### 7.1 Method
- Running the complete old HR portal in jsdom (141 JS files in order, 107 real employees in a temporary local database), and comparing number
  by number with the website, server, and app, and running the old server functions in a local Postgres.

#### 7.2 100% Match
| Unit | Result |
|---|---|
| PAYX V119 | 20,000/20,000 cases |
| Settlement `sRun` | 3,000/3,000 |
| End-of-service page | 840/840 |
| Amount-in-words | 3,032/3,032 |
| Leave working days | 4,000/4,000 (website and server) |
| Year-end balance and end-of-service days | 107/107 |
| App balance vs. `ariba_leave_calc` | 23/23 |
| Alert count | 14 = 14 |

#### 7.3 Close ⚠️ and Not Matching ❌ (What Was Done)
- ❌1 End-of-service report → uses the recorded award (84/84). ❌2–4 Dashboard (total salaries, gender by names, Tamheer) →
  matching. ❌5 Contract end is computed. ❌6 Reactivation on renewal. ❌7 Polygons. ❌8 "Remote" with an approved request. ❌9 All types
  via the executive. ❌10 HR alerted on every request. ❌11 Balance check at request time **kept** by the owner's decision (stricter than the legacy).
- ⚠️ Social insurance by `kindOf` (428/428), and lateness by the minute.

#### 7.4 Labor Law Corrections A–K (added 11–13 October, then all cancelled on 18 October)
| Code | Correction | Fate |
|---|---|---|
| A | Resignation: exactly 5 years = one third, 10 = full | Cancelled |
| B | End-of-service base = actual wage | Cancelled (basic + housing) |
| C | Article 77 for fixed-term contracts = wage for the remaining period (minimum two months) | Cancelled |
| D | Article 87 (full award) | Cancelled |
| E/F | Legal notes for HR on requests | Cancelled |
| G | Payroll social insurance on actual housing | Cancelled (25% of basic) |
| H | Overtime divisor | Never changed |
| I | Alert for missing holidays of the year | Cancelled |
| J | Leave after 5 years for contracts above 21 days | Cancelled |
| K | Flexible day: early check-out on the last session | Cancelled |

---

### 8. Porting the HR Department's React System

#### 8.1 What They Delivered (18 October)
- `ARIBA_HR_React` (the program + `apply.html`) and `ARIBA_Employee_React` (a PWA app).
- React 19.2 + Vite 8.3, JavaScript only, react-router 6, Chart.js 4, Tabler, jsPDF + html2canvas.
- **No server:** the browser calls Supabase directly (119 PL/pgSQL functions: 61 old, 52 new in `sql/10–20`, and 6 missing),
  mail via 4 Edge Functions + Resend, and scheduling via pg_cron. 12 new tables on their side.
- Their report: 25 slides/pages, 10 app tabs, 24 settings cards, 10 official documents, an AI assistant, Excel import, V142 alerts,
  numbered V152 settings, the V171 Egypt layer. Their acknowledged flaws: untested mail, 33 duplicate files, a bell every 3 seconds, manual deductions,
  the ARIBA Two font needs installation. And they said they would not send further updates.

#### 8.2 The Decision
- Our system is the foundation (technology, unified schema, data, way of working), and we take **all** of their features, screens, and formulas, without
  their technical approach (no database calls from the browser, no final calculations in the browser, no PWA).
- The color-coded comparison file (188 rows: 🟢 81, 🟠 30, 🔴 24, 🔵 42, 🟣 11): 🟢 stays, 🟠/🔴 changes to match their formula exactly,
  🟣 is removed without exception, 🔵 is added.

#### 8.3 Approved Decisions
1. Rows 113 and 142 are not removed but match their app: "Year-end balance" and "Remaining remote" (+ a "Remote work limit" field).
2. Row 66: automatic termination at contract end is removed, and added instead: saving a terminated employee whose fixed-term contract has not ended reactivates them + a
   "Reactivate" button.
3. What they store in the browser moves to the server (`ariba_app_settings`): master lists, report templates, the salary certificate counter,
   the ID issuance place. The signature stays on the employee's device only.
4. The leave balance in the app and the manager's team balances are computed by the server with the same engine, without snapshots.
5. Mail passwords are AES-GCM encrypted with the key `MAIL_SECRET_KEY`.
6. Mail: SMTP, Resend, and Microsoft Graph with PDF attachments.
7. Calculations on the server (or `lib/calc` for instant display), and the server's result is final using their formula.
8. Unpaid-leave deduction and salary advance stay manual as on their side.
9. Their flaws are not ported: the audit log from the browser, a bell every 3 seconds, `sw.js`, settings hard-coded in the code.

#### 8.4 Tasks
| Task | What was done |
|---|---|
| 0 | Reading the references (`task0_reading_notes.md`) |
| 1 | The plan `PORT_PLAN.md` (`14b7983`) |
| 2 | The `tools/react-parity` tool (`2c5f71b`): baseline of 21 groups, 81,615 cases, 29,391 with differences |
| 3 | Our formulas = their results (`8db0266`, `ffc63d8`): 0 differences, 111/111 rows; pytest +7 |
| 4 | Removing 🟣 (`91436f9`): rows 66, 70/82, 72, 100, 114, 137, 153, 188, and corrections A–K; tests `test_port_removed.py` |
| 5 | Migration `001_react_port.sql` + `verify_001.sql` + `run_on_railway.sh` + `tools/dev-db` (`69d5063`) |
| 6 | Server routes for all their features + scheduled jobs + WebAuthn + Push (`8ff583c`) |
| 7 + 9 | The website = their screens + `/apply` (`5deaa1c`) |
| 8 | The Expo app (`3fb1487`) |
| 10 | Verification: the report (`339ccf9`), the scenario 50/50 (`837cbeb`), then the actual migration and deployment (18 October evening) |
| 11 | Deployment after "deploy" |

#### 8.5 The Six Missing Functions and Their Replacements
1. Team availability → `GET /team/availability` (merging consecutive leaves, "upcoming leave" within 14 days, "returns" on the first working day).
2. Tasks and meetings → `/tasks` (warning if the invitee is on leave; done/accept/decline with reason/cancel).
3. Flexible Ramadan hours → `PUT /settings/attendance/ramadan`.
4. Identity → `GET /public/brand`.
5. Password recovery → `POST /auth/password-recovery` (a temporary password to the registered email; the old one remains until the temporary one is used).
6. Identity colors from the company website → `POST /settings/brand/extract` (public addresses only).

#### 8.6 Deviations from the Plan
| Item | Plan | What was done | Reason |
|---|---|---|---|
| AI assistant | Move `aiParse.js` to the server | Their file stayed in the browser | Text parsing only, and every action goes through a protected route |
| Audit log list | `GET /audit` | `POST /audit/list` | Filters in the request body |
| PDF library | jspdf 2.5.2 | jspdf 4.2.1 | Their version pulls in dompurify, which has vulnerabilities |
| Manager signature in the app | Approvals tab | Documents tab | Same behavior |
| Work locations and delegation | Separate screens | Cards inside "My File" and "Leaves" | As on their side |
| Website screens | Rebuild every screen | Copy their screens as-is | Literal match |
| Tasks | Table `ariba_task_assignees` | `ariba_tasks` one row per recipient | Simpler |

---

### 9. The Database Across All Phases

#### 9.1 The ORM Era (4–6 October, no longer used)
- 25 tables and 27 enums via Alembic (0001–0008), UUID keys, money as `Numeric(12,2)`, RLS enabled with no policies.

#### 9.2 The Canonical Era (canonical, from 8 October)
- The original Supabase schema: `employee_directory` + a `data` JSONB field, `workflow_requests`, `employee_payrolls`, and others.
- Export problems: no PK/FK/indexes, duplicate rows in 10 tables, 3 employee identifiers that do not agree.

#### 9.3 The Unified Schema (Normalization, 13 October)
- Reference tables: `employers`, `departments`, `job_titles`, `roles` (8), `workflow_stages`, `leave_types`,
  `permission_types`, `document_types`, `workflow_request_types`.
- `employee_directory`: foreign keys for employer, department, and title, `manager_id` preventing an employee from being their own manager, and `data`
  JSONB for the old fields. The username is in `ariba_auth_accounts` only.
- `workflow_requests.status` is a computed column from `current_stage` (completed → approved, rejected → rejected, otherwise pending).
- `workflow_approvers` (hr = 40, ceo = 86), `workflow_actions` with the acting account, `workflow_notifications.read_at`.
- `leave_requests` (compatibility view `leave_requests_v`), `permissions`, `attendance` (one open session per employee/day),
  `payroll_periods` (month approval), `payroll_components`/`payroll_lines` (empty).
- `ops`: internal backups (`orphan_payrolls_backup`, `employee_payrolls_approval_backup`, old tables).
- Scripts: `railway_prep.sql` (restoring lost keys, aligning approval), `preflight_checks.sql`,
  `pre_migration_fixes.sql`, `ariba_normalization.sql`, `run_on_railway.sh`.

#### 9.4 Their System's Migration `001_react_port.sql` (18 October)
- Schema only, a single transaction, `IF NOT EXISTS` (safe to run twice), does not change data.
- New request types: unpaid, salary_advance, iban_change, profile_edit, document (+ overtime, forgot_punch); leave type
  unpaid; document types (cv, id, passport, certificate, experience, national_address, insurance, photo, other,
  iban_letter, iban_certificate, signed_document, employee_upload, identity, degree, social_insurance, contract,
  profile_edit, graduation).
- New columns: `workflow_requests` (submitted_by_employee_id, escalated_from, escalated_at, returned_at, return_note),
  `workflow_notifications` (emailed_at, email_error, email_tries, pushed_at — and old ones are marked as sent), `payroll_periods`
  (prepared_at/by, prepare_note, approved_by, reopened_at/by, reopen_reason).
- 14 new tables: `ariba_delegations`, `ariba_manager_perms`, `ariba_candidates`, `ariba_candidate_files`,
  `ariba_candidate_invites`, `ariba_targets`, `ariba_evaluations`, `ariba_doc_signing`, `ariba_leave_files` (≤ 13 MB),
  `ariba_mail_accounts` (password encrypted), `ariba_mail_log`, `ariba_tasks`, `ariba_webauthn_credentials`,
  `ariba_push_tokens`.
- Settings: `workflow_config`, `doc_sign_cfg`, `apply_invite_only` = false, `apply_invite_hours` = 72.
- `verify_001.sql`: the 14 tables, the 11 columns, the five request types, `workflow_config`, ≥ 20 foreign keys.
- **Executed on demo and production on 18 October** successfully (§4.10).

#### 9.5 Data Fixes in Production After Deployment
- 19 October: 7 employees with their iqama number stored as a number → converted to text (production and demo).
- The direct manager is not filled in our data (handled by the owner's colleague).

#### 9.6 Known Issue: Long Identifiers
- 81 employees (1 active, 80 terminated) have identifiers like `XLS-62d422dece6b` from an old Excel import; 78 have a real number in `data.empNo`,
  and 3 terminated ones have no number; 4 accounts with names `EMPXLS-…`. Not addressed.

---

### 10. The Server (Backend) and Its Routes

- All routes are under `/api/v1`. The core is in `canonical.py`, their system's features in `port_*.py`, and their functions are translated on the website via
  `lib/api.js` (RPC name → REST route).
- **Request workflow:** `/me/requests` (new types + attachment), `/me/team/{id}/requests` (on behalf), `/me/delegation`,
  `/me/manager-perms`, `/settings/manager-perms`, `/me/approvals`, `/requests/{id}/approve|reject|override|final-approve|return`,
  `/requests/escalate`, `/settings/workflow`, `/staff/queue`, `/staff/requests`, `/messages`.
- **Candidates:** `/candidates` (+ accept/reject/files/by-ref), `/candidates/invites`, `/candidates/apply-key/rotate`,
  `/candidates/apply-mode`, the public `/public/apply?k=` and `/public/apply/invite/{token}` (a bot trap, rate limits).
- **Goals and evaluation:** `/targets`, `/evaluations`, `/evaluations/{id}/approve`, `/me/goals`.
- **Documents and signing:** `/me/letters` (+ stage since 20 October), `/me/letters/{id}/sign`, `/me/letters/{id}/respond`,
  `/me/sign/states`, `/me/sign/pending`, `/me/sign/{id}`, `/settings/doc-sign`, `/letters/{id}/html` (signed copy first),
  `/staff/templates`, `/documents/{id}/content`, `/leave-files`.
- **Mail:** `/mail/{scope}` (mine/company), `/mail/test`, `/mail/send-document`, `/mail/send-report`.
- **Tasks and team:** `/tasks`, `/tasks/{id}/update`, `/team/availability`.
- **Assets:** `/assets`, `/assets/{id}/custody`.
- **Audit log:** `/audit/list`, `/audit/purge` (deleting a month older than 30 days with Finance approval).
- **Settings:** `/settings/kv/{key}`, `/settings/permissions`, `/settings/roles`, `/settings/attendance` (+ Ramadan),
  `/public/brand`, `/settings/brand/extract`, `/auth/password-recovery`, `/auth/users/default-passwords`.
- **Payroll:** `/staff/payroll/{y}/{m}`, `/sheets/{key}/prepare|unapprove`, `/payroll-archive`.
- **Advanced login:** WebAuthn (`/auth/webauthn/*`), `/me/push-token`.
- **`port_staff` routes** in their data shapes: leaves, holidays, locations, attendance, overtime, documents, forms, password
  reset, termination of service, payroll, the bell, attendance settings, my permissions.
- **Scheduled jobs** (`scheduler.py`, advisory locks): escalation every hour, mail and notifications every 5 minutes, candidate registration
  every minute. They run with `SCHEDULER_ENABLED=1`.
- **Mail settings:** SMTP from settings, Microsoft Graph via `M365_TENANT_ID`/`M365_CLIENT_ID`/`M365_CLIENT_SECRET`,
  Resend via `RESEND_API_KEY`/`EMAIL_FROM`; `MAIL_DISABLED=1` prevents any connection.

---

### 11. The Website (HR Dashboard)

#### 11.1 How It Was Ported
- `ARIBA_HR_React/src` was copied verbatim into `frontend/hr-web/src/port`; every page in the portal renders their screen inside their layout, store,
  and permission guard. `/login` is their screen, `/apply` is the public application form.
- Only the modified files are listed in `src/port/ADAPTED.md`:
  - **Written for the port:** `router.jsx`, `next/PortApp.jsx`, `next/LoginApp.jsx`, `next/Shell.jsx`, `next/page.jsx`.
  - **Moved to our server:** `lib/api.js`, `lib/auth.js`, `lib/config.js`, `lib/vault.js` (WebAuthn), `apply/ApplyApp.jsx`.
  - **What moved to the server:** `lib/audit.js`, `lib/leaveSnapshots.js`, `lib/masterLists.js`, `CustomReport.jsx`, `salaryCert.js`,
    `lib/candidates.js`, `CandAuto.jsx`, `HrBell.jsx` (every 20 seconds), `lib/arLetterhead.js`, `engines/*` (re-export
    `lib/calc`).
  - **Build setup:** `lib/ico-runtime.js` (emoji → icons, wired in `next.config.ts` via `next/ico/*`).
  - **Our look on their screens:** `Dashboard.jsx` + `styles/ariba-ours.css` (green borders, icons, avatars, bars,
    chart colors), `Layout.jsx` (the logo), `next/palette.js` + `BrandCard.jsx` (the four-color palette), `next/latn.js`
    (English digits), sidebar and checkbox layers, showing forms with their title and stage in
    `Pending.jsx`/`AllRequests.jsx`/`forms/index.jsx`.
- The old website components (`components/hr/*`, `lib/sheets.ts` …) were not deleted, but the portal no longer uses them.

#### 11.2 Screens (26)
Dashboard, Employees (+ new, + employee file), Candidates, Goals, Evaluation, Attendance, Punch Locations, Leaves and Requests,
Team Availability and Tasks, Payroll, Social Insurance Calculator, Salary Calculator, Tax Calculator, Salary Transfer File (WPS), Provisions
Report, Assets and Custody, Payslip, End of Service, Settlement, Documents, Reports, Settings (9 sections), Audit Log,
Forms.

---

### 12. The Employee App (Mobile)

- **Leaves:** unpaid and advance (reason mandatory), optional attachment, the approval path, upcoming holidays, manager delegation, notes on
  submission on behalf, escalation, and return.
- **My File:** data-edit request, IBAN change (official letter + signature + certificate), document upload, My Documents, balances.
- **Documents:** approve with signature (stays on the device only), approve without signature, reject with reason, manager signature on his team's documents;
  since 20 October: buttons only while awaiting the employee, then "🕓 Awaiting HR approval".
- **My Team (for the manager):** whatever HR allows, team requests, submitting on behalf, goals and evaluation, tasks, meetings, and availability.
- **"My Goals and Evaluation" tab.**
- **Login:** remember me, Face ID/fingerprint, forget device, forgot password; Push registration; company colors from the server; PDF payslip.
- **20 October fixes:** data provider at the root, reading files from the device, the signature pad, the file card, the color palette,
  English digits.
- **Running:** Expo Go via `npx expo start --tunnel` (no permanent TestFlight/APK build yet; real notifications need
  an EAS build and `extra.eas.projectId`).

---

### 13. Roles, Permissions, and Security

#### 13.1 Roles
- admin, admin_manager, hr, ceo, finance, manager, employee (+ chairman in the old data). admin and chairman have full permissions.
- **Permission matrix** (from their system): 19 modules × 7 roles, managed from settings (`/settings/permissions`), read by the website from
  `GET /me/perms`, and enforced by the server on every route (`port_common.can/require`).
- **Direct manager permissions** (`ariba_manager_perms`, 10 keys): view the team and its data, salaries, leaves, requests, and attendance,
  submit on behalf, approve, goals, evaluation (default: approve, goals, and evaluation).
- Finance: payroll, payslip, end of service, and settlement, plus payroll approval and deleting a month from the log.

#### 13.2 Security
- JWT signed with `JWT_SECRET`, sessions in `ariba_sessions`, bcrypt → Argon2 automatically.
- **After the port:** a one-hour token renewed with activity up to 24 hours from login, and logout on idle after 5 + 3 minutes in the UI.
- **The login lockout after failed attempts was cancelled** (row 188; failure is always 401 and only logged).
- Password recovery: a temporary password to the registered email (stored as `temp:`+sha256), the old one remains until it is used.
- **WebAuthn** (fingerprint/Face ID on the website): a signed state valid for 5 minutes, the signature counter prevents replay.
- Fingerprint in the app: a copy of the refresh token in the Keychain behind biometric verification; "Log out" with fingerprint does not revoke the server session
  (up to 24 hours), and "Forget this device" deletes everything.
- Mail passwords AES-GCM with `MAIL_SECRET_KEY` (not changed after saving, otherwise they cannot be decrypted).
- Extracting identity colors: public addresses only, with verification of every redirect (the name is resolved twice; acceptable because it is for admins only).
- Website security headers: CSP with `connect-src` on the server address only, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy,
  Permissions-Policy.
- The audit log is written by the server (field-by-field diffs, payroll edits, settings) — no queue from the browser.
- Sensitive files (database dumps) are on the owner's machine only, and are never pushed.

#### 13.3 Open Question
- **A terminated employee can still log in** (same as our behavior before the port; their termination function is not in the reference), awaiting the owner's
  decision.

---

### 14. Environments, URLs, Variables, and Deployment

| | Production (real data) | Demo (salaries 1000) |
|---|---|---|
| Website | https://frontend-production-f9a8a.up.railway.app | https://frontend-demo-b5ec.up.railway.app |
| Server | https://hrariba-production.up.railway.app | https://hrariba-demo.up.railway.app |
| Database | `Postgres-Q6OM` | `Postgres-Q6OM` (the demo copy) |

- Services of each environment: `HR_ARIBA` (the server), `frontend`, `Postgres-Q6OM`, `Postgres` (old, untouched).
- **Server variables:** `DATABASE_URL` (`${{Postgres-Q6OM.DATABASE_URL}}`), `JWT_SECRET`, `CORS_ORIGINS`,
  `RUN_MIGRATIONS_ON_STARTUP=false`, `ENV=production`, **and since 18 October:** `MAIL_SECRET_KEY`, `SCHEDULER_ENABLED=1`,
  and in demo `MAIL_DISABLED=1` and `PUSH_DISABLED=1`. Available when needed: `RESEND_API_KEY`, `EMAIL_FROM`, `M365_TENANT_ID`,
  `M365_CLIENT_ID`, `M365_CLIENT_SECRET`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS` (all documented in `backend/.env.example`).
- **Website variables:** `NEXT_PUBLIC_API_URL` (read at build time).
- **App:** `EXPO_PUBLIC_API_URL` (defaults to production).
- **Deployment:** pushing to `main` deploys both environments. Before any database change: migration first, then merge (the server refuses to boot without
  the tables).
- **Approximate cost** (at known Railway prices): ~$0.3–0.5 per day for the eight services, ~$10–15 per month; the trial
  credit was "9 days or $2.46 left" and needs a plan upgrade. The Pro plan is also required to unblock SMTP.
- **Useful commands** (from a folder linked with `railway link`): `railway variables --service HR_ARIBA --environment <env> --set "K=V"`,
  `railway down`/`railway redeploy --service <svc>`, and `railway ssh -s Postgres-Q6OM -e <env> -- psql -U postgres -d railway -c "…"`.

---

### 15. Backups and Rollback Points

| Point | Contents |
|---|---|
| `archive/before-reset` + branch `feat/foundation` | The repository before the rebuild (4 October) |
| `before-normalization` (tag on `ad8ee40`) + `~/Desktop/HR/backups/before-normalization/` | The code + dumps of the production and demo databases + the variables before 13 October |
| `~/Desktop/HR/backups/before-migration-2026-10-13/` | Dumps of both databases immediately before the unification |
| `~/Desktop/HR/backups/before-react-port/` | Dumps of both databases before migration 001 (18 October, 19 MB each) |
| Branch `backup/قبل-الدمج` | `main` before merging the port of their system (`494998d`) |
| `ops.*` inside the database | Orphan payroll rows, old approval flags, old tables |
- **Rollback = code and database together:** the code by reverting to the branch/tag and then pushing; the database by restoring the dump into a **new** database and pointing
  `DATABASE_URL` to it. Migration 001 only added tables and columns, so the old code most likely works on the new database.
- The backup folders contain **real data**: for the owner only.

---

### 16. Tests, Parity Tools, and Their Results

| Check | Latest result (20 October) |
|---|---|
| pytest (`backend`, with `LEGACY_PARITY_PG`) | **108 passed**, 2 skipped (one needs a canonical dump, and one was replaced by Decision 4) |
| `tools/react-parity` | 21 groups, **81,428 cases, 0 differences**, 111/111 rows |
| `tools/legacy-parity` | All groups match (runs the old HTML without corrections) |
| Website `tsc` / `eslint` / `next build` | Passed / 0 errors (one old warning) / Passed |
| App `tsc` | Passed |
| Full scenario `tools/dev-db/scenario.py` | **50/50** |
| Screen crawl (Chromium) | All screens error-free for HR, manager, and finance accounts; 0 Arabic digits in 24 screens |
| App in the browser (Expo web) | Data edit, IBAN change, document upload, and documents open without errors |

- **react-parity:** compares their formulas (a reference copy in `tools/react-parity/reference`) with ours (TypeScript on the website
  and Python on the server) on generated cases with a frozen clock (2026-10-18 10:00 Riyadh). Baseline before the changes: 29,391 cases with differences,
  and it revealed two bugs on our side (insSystem "new" and "exempt" on the payroll page).
- **legacy-parity:** Node + jsdom against the old HTML (PAYX, settlement, end of service, amount-in-words, exemption, attendance reports).
- **The scenario:** a new employee with a temporary password → check-in/check-out punch (and outside the geofence rejected) → all request types with their stages and applying
  their results → rejection without a reason rejected → escalation → payroll (save/prepare/approve/payslip) → an accepted candidate → a goal and evaluation → mail →
  termination of service and end of service.
- **Document flow test** (20 October, `test_form_flow_sign_then_hr_approves`): send → sign → pending at HR with the signed
  copy → approval → all requests and the archive; and approval without signature; and objection.
- **Local test database:** `tools/dev-db/build.sh` builds a database from the schema with synthetic data and `*.test` accounts.

---

### 17. Full Commit Log (branch `main`)

> The local copy of the repository starts from 5 October; what came before is preserved in `archive/before-reset`.

| commit | Date | Description |
|---|---|---|
| `782616e` | 2026-10-05 | Payslip page (V60 rSlip + V69 official print) from approved payroll sheets |
| `32339b9` | 2026-10-05 | Locations: backend CRUD (V38 1000m radius, remote) + HR page |
| `efc07d3` | 2026-10-05 | Attendance: backend manual records + summary, HR page (day list, manual entry, monthly) |
| `b03d014` | 2026-10-05 | Leave ledger engine: port of legacy 02/03 (verified against the legacy JS output) |
| `abd4f3b` | 2026-10-05 | Leave APIs: holidays, requests (HR record, approve / on-behalf / final / reject / delete), balances + year editor |
| `0085b8b` | 2026-10-05 | Leaves page: pending, all requests, new request, balances + year editor, official holidays, overtime |
| `e93e943` | 2026-10-05 | Documents page (V60 loadDocs: iqama, passports, medical insurance, contracts) + GET /registry/documents |
| `435879f` | 2026-10-05 | Reports page: the 9 legacy reports (final patched versions) + report figures on /salary/basis and leave balances |
| `0e013a0` | 2026-10-05 | Settings APIs: company, attendance/flexible hours, GOSI periods, departments/workplaces, accounts, payroll exclusion |
| `afd85a9` | 2026-10-05 | Settings page: company + attendance, logo, departments/workplaces, GOSI periods, flexible hours, roles, passwords, payroll exclusion, HR signer |
| `9e97bc8` | 2026-10-05 | Letters: send forms to employees, status, employee approve/object (migration 0006) |
| `4e997a0` | 2026-10-05 | Forms page: 9 letterhead forms (V70/V114/V117) with HR signer, print + send to employee, sent-forms status |
| `50f2998` | 2026-10-05 | Fetch all employee pages (API caps page_size at 100) on attendance, leaves, settings, forms, settlement |
| `8796992` | 2026-10-06 | Schema cleanup (0007): attendance sessions, payroll and leave in linked tables, cascade request steps, drop unused tables |
| `b691f3f` | 2026-10-06 | Payroll «ما تم استحقاقه» ("amount accrued"): leave taken up to the end date from the leave engine (legacy usedThrough) |
| `12f2a9c` | 2026-10-06 | Attendance: V117 reports (sessions grouping, day classes, filters, summary/detail, print, export) + /attendance/range |
| `e731ac6` | 2026-10-06 | Settlement: official settlement document with amount in words (clean tafqeet, same results) |
| `ccbe966` | 2026-10-06 | Payroll: approved payroll archive (legacy V53) + /payroll-archive |
| `c7a268b` | 2026-10-06 | Forms: send a form to several employees at once (legacy V117 bulk send) |
| `5ac4b22` | 2026-10-06 | Forms: English versions (V117) attached when sending; salary certificate language choice |
| `cd5e76b` | 2026-10-06 | Settings: show signature / show stamp, delete selected signature, refresh accounts |
| `cd0e941` | 2026-10-06 | Locations: per-employee work locations (V121, migration 0008) + linked employees list, page title |
| `0c4e305` | 2026-10-06 | Leaves: optional request attachment (PDF/Word/image, 12 MB) for leave and overtime |
| `53615a5` | 2026-10-06 | Contract end −1 day (legacy addMonthsSafe), auto-terminate/reactivate fixed-term contracts, dashboard gender by names, USD default 3.755 |
| `8b3a3f9` | 2026-10-06 | Payroll «بدون خصم» ("no deduction") insurance toggle; wording aligned with legacy (attendance, forms) |
| `94785dc` | 2026-10-06 | docs: full handoff summary |
| `46c6ae5` | 2026-10-06 | Employee app: GPS punch (server geofence, flexible hours, multi-session) + attendance tab; app defaults to deployed backend |
| `0d0caa9` | 2026-10-06 | Employee app: my requests (all types + forgot punch), leave balance, team and approvals; approved forgot punch writes attendance |
| `1df0d25` | 2026-10-06 | Employee app: forms (view + approve/object), payslips from approved payrolls, notifications bell |
| `1ea0d8a` | 2026-10-06 | docs: quick usage guide for the HR site and employee app |
| `d32f890` | 2026-10-08 | docs: canonical DB integration audit and plan (phase A+B, no code changes) |
| `d5cd4e3` | 2026-10-08 | Use the canonical Supabase schema/data as the database; keep the verified calculation logic |
| `39616b4` | 2026-10-08 | docs: handoff — canonical database on Railway |
| `8b46326` | 2026-10-08 | tools: create a login in ariba_auth_accounts with a one-time temporary password |
| `6f89af9` | 2026-10-08 | Employee app: legacy look and flow (V118 shell, punch dial, all tabs) on the canonical backend |
| `673ddb1` | 2026-10-11 | UI: replace emoji icons with Tabler line icons; ARIBA brand colours |
| `9a345ee` | 2026-10-11 | UI: every removed emoji now has an icon; formal gender avatars and tamheer cap |
| `487fbaa` | 2026-10-11 | Unified date/time picker (site + app), Requests & leaves page, forgot-punch notice |
| `8ee52fc` | 2026-10-11 | Dashboard: KPI icons, readable payroll total, same-colour gender avatars, department bars |
| `fe9c836` | 2026-10-11 | Header «تحديث البيانات» ("Refresh data") reloads every page |
| `d1d6699` | 2026-10-11 | Employee save recomputes stored GOSI/net (legacy sEmp), add-employee returns to list, clearer required-field message; app keyboard; docs |
| `2dea04d` | 2026-10-11 | Employees list: «كل جهات العمل» ("All employers") filter works (workplace_id was ignored by the API) |
| `0f85a93` | 2026-10-11 | Legacy parity: leave/app balance, approvals, notifications, punch, labour-law corrections, parity tests |
| `683982d` | 2026-10-12 | Docs: files and photos live in the database (ariba_documents), same in demo |
| `c24e6d6` | 2026-10-12 | Remove open notes and known debts section |
| `1d2bbed` | 2026-10-12 | Dashboard: dark green border on every KPI tile |
| `ad8ee40` | 2026-10-13 | Fix HR delete request: missing parenthesis in the archive snapshot SQL (+ regression test) |
| `dbbee54` | 2026-10-13 | Bring in the colleague's schema normalization (Dalteam/HR_ARIBA 8e5716a) |
| `1ba1a42` | 2026-10-13 | db-normalization: script that backs up and migrates one Railway environment |
| `494998d` | 2026-10-14 | Docs: PROJECT_GUIDE up to date (normalization merge and migration), English + Arabic |
| `14b7983` | 2026-10-18 | Port plan: every comparison row, screen and RPC mapped to our stack |
| `2c5f71b` | 2026-10-18 | tools/react-parity: their React formulas vs ours on seeded cases, tied to the comparison file |
| `8db0266` | 2026-10-18 | Port their leave engine, GOSI auto table and employee figures to the backend; their engines copied to the site |
| `abdcf3d` | 2026-10-18 | Cloud handoff: their React project (read-only reference), port context docs, schema-only dump |
| `ffc63d8` | 2026-10-18 | Task 3: our formulas now give their React results (react-parity 0 differences) |
| `91436f9` | 2026-10-18 | Task 4: remove the rules only we had (purple rows) |
| `69d5063` | 2026-10-18 | Task 5: schema migration for the ported features, run/verify script, local test database |
| `8ff583c` | 2026-10-18 | Task 6: server routes for their RPCs, with integration tests |
| `5deaa1c` | 2026-10-18 | Tasks 7 and 9: the HR site is their React screens, plus the public apply page |
| `3fb1487` | 2026-10-18 | Task 8: their employee-app features in the Expo app (typecheck only) |
| `339ccf9` | 2026-10-18 | Port verification report: what was done, what was checked here, what is left for the owner's machine |
| `837cbeb` | 2026-10-18 | Task 10: end-to-end scenario on a synthetic DB (50 checks pass) + report |
| `daabbf3` | 2026-10-19 | Site: their emoji become icons as in their build; our dashboard look and logo on their screens |
| `6fb7303` | 2026-10-19 | Site: Settings › Mail › send test goes to /mail/test (it went to send-document and asked for a PDF) |
| `e0587b2` | 2026-10-20 | Owner's review fixes (2026-10-20): app crashes, uploads, signing, form flow through HR, layout, digits, palette |

---

### 18. Known Issues and Open Items

1. **Mail:** Railway blocks SMTP on the current plan; the chosen solution is Microsoft 365 (Graph): registering an app in Entra +
   `Mail.Send` + admin consent, then the three variables. The owner's account has no visible admin role (may need a Global Administrator).
2. **The direct manager** is not filled in our data (handled by the owner's colleague), and it is required for the manager stage, the team, delegation, and goals.
3. **Safari:** the "Send email to employee" button showed nothing (Chrome works).
4. **A terminated employee can log in** — awaiting a decision.
5. **Fingerprint login on the website** needs `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGINS` (their commands are ready with the website URLs).
6. **The Railway** trial credit is nearly exhausted.
7. **App:** no permanent build (TestFlight/APK), and real notifications need EAS; finger signing and file upload were tested in
   the browser and need testing on a real device.
8. **A safeguard in the code** for iqama numbers stored as numbers (the data was fixed, but the safeguard was not added).
9. **Long identifiers** `XLS-…` (3 terminated with no number).
10. `payroll_lines` is empty (the app reads `payload`).
11. The screens were not compared side by side with their running version, and the app was not tested on an iOS simulator.
12. 35 old open questions for the HR department in the system document (§9 there).

---

### 19. Contradictions Between Old Documents and the Current State

| Topic | Old documents | Current state |
|---|---|---|
| Approval stages | `BUSINESS_RULES`: permission, overtime, and business-trip requests stop at HR | Their system's logic: [manager] → HR → [executive per `final_by_type`] |
| End-of-service years and base | Days ÷ 365, basic + housing, one third from 2 to 5 | 365.25 on the page, K via DATEDIF in payroll and settlement, exactly 5 = two thirds |
| Login lockout | `SECURITY.md`: 5 per user and 20 per IP within 5 minutes | Cancelled (row 188) |
| Session duration | 60-minute token + 7-day refresh | One hour renewed up to 24 hours + idle 5+3 minutes |
| Contract end | Joining + months without −1 day | `addMonthsSafe` minus one day |
| Schema | `DATABASE.md`: Alembic model with 25 tables | The unified schema (`employee_directory` …) + migration 001 |
| Files | Railway disk | Inside the database (`ariba_documents`) |
| Port status in `PORT_VERIFICATION` | "Not merged and not deployed" | Merged and deployed on 18 October after the migration |

---

### 20. Appendix: Identity and Colors

#### 20.1 The Approved Color Palette (20 October, from the company identity file ARIBA_LAYOUT)
| Role | Color |
|---|---|
| Primary dark | `#014D3D` |
| Primary light | `#28B35D` |
| Secondary dark | `#231F20` |
| Secondary light | `#E4E4BC` |
| Errors only | Red |
- Blue, purple, turquoise, orange, and brown in their screens are converted to the nearest of the four colors (`next/palette.js`), as are the badge
  and alert classes; the color picker in settings keeps its real colors.
- Warnings: charcoal in light mode and beige in dark mode (`--ar-warm`).

#### 20.2 Other Elements
- Font: ARIBA Two (light, medium, bold).
- Logo: `/brand/ariba-logo.png` by default in the sidebar until a logo is uploaded from settings.
- Icons: Tabler (line) instead of emoji on all screens.
- Dashboard: dark green borders for every tile, icons for indicators, single-color male/female avatars, department bars with a gradient.
- Digits: English (0–9) on the website and the app.

---

# العربي

## التقرير النهائي — نظام أريبا للموارد البشرية (ARIBA HR)

> من أول بذرة (4 أكتوبر 2026) إلى آخر commit (`e0587b2`، 20 أكتوبر 2026).
> المصادر: كل ملفات `docs/` (PROJECT_GUIDE، HANDOFF، PROJECT_STATUS، ROADMAP، PHASE1_REVIEW، INTEGRATION_AUDIT، USAGE،
> DEPLOY_RAILWAY، CLOUD_HANDOFF، ARIBA_HR_System_Documentation، BUSINESS_RULES، LOGIC_AUDIT، DATABASE، ARCHITECTURE،
> SECURITY، FEATURE_auth، FEATURE_employees، PORT_PLAN، PORT_VERIFICATION، port-context/*، db-normalization/*،
> db-migrations/*)، و`frontend/hr-web/src/port/ADAPTED.md`، و`tools/react-parity`، وسجل git كامل، وما تم في الجلسات
> بين 18 و20 أكتوبر (الترحيل، الدمج، النشر، الإعدادات، الإصلاحات).
> لا يحتوي التقرير على أي كلمة مرور أو مفتاح سري أو بيانات شخصية حقيقية.

---

### الفهرس
1. الفكرة والهدف
2. قواعد العمل مع المالك
3. البنية التقنية والمعمارية
4. الخط الزمني الكامل
5. النظام القديم (V114) كما كان
6. قواعد العمل والمعادلات
7. تدقيق المطابقة مع النظام القديم (LOGIC_AUDIT)
8. نقل نظام React الخاص بقسم الموارد البشرية
9. قاعدة البيانات عبر كل المراحل
10. الخادم (Backend) ومساراته
11. الموقع (لوحة الموارد البشرية)
12. تطبيق الموظف (الجوال)
13. الأدوار والصلاحيات والأمان
14. البيئات والروابط والمتغيرات والنشر
15. النسخ الاحتياطية ونقاط التراجع
16. الاختبارات وأدوات المطابقة ونتائجها
17. سجل الـ commits كاملاً
18. المشاكل المعروفة والبنود المفتوحة
19. تناقضات بين الوثائق القديمة والحالة الحالية
20. ملحق: الهوية والألوان

---

### 1. الفكرة والهدف

- **شركة أريبا للاستشارات** كانت تدير الموارد البشرية من **ملف HTML واحد ضخم** تطوّر بتحديثات مرقّمة من V1 إلى V130
  (ونسخة قسم الموارد البشرية وصلت لاحقاً إلى V171+). البيانات كانت على **Supabase**، وبناها الزميل **محمد عوض**
  (جداول، دوال SQL، حسابات).
- الملفان الأصليان:
  - `1_HR_برنامج_الموارد_البشرية_V114 1.html`: 15,009 سطر، تقريباً 1.9 ميجا (منها ~700 كيلو صور وخطوط base64).
  - `2_EMPLOYEE_تطبيق_الموظف_V114 2.html`: 4,464 سطر، تقريباً 390 كيلو.
  - البصمة (MD5) لكل ملف موثّقة في `PROJECT_GUIDE`، والنسخ المقسّمة في `frontend/legacy`.
- **الهدف:** إعادة بناء النظام على تقنية حديثة **بنفس الشاشات والحقول والنصوص والمعادلات**:
  1. موقع للموارد البشرية والمدراء والمالية.
  2. تطبيق جوال للموظف (آيفون وأندرويد): البصمة، الطلبات، الراتب.
  3. خادم واحد وقاعدة بيانات واحدة تخدم الاثنين.
- **المبدأ:** نقل المنطق بشكل نظيف بنتائج مطابقة، وليس نسخ الكود القديم.
- **الأشخاص:** المالك فيصل الراشد. الزميل محمد عوض (قاعدة Supabase الأصلية). الزميلة غادي نفيسة (Ghady Nafisah،
  مستودع `Dalteam/HR_ARIBA`) نفّذت توحيد قاعدة البيانات (Normalization). قسم الموارد البشرية سلّم في 18 أكتوبر نظام
  React كامل تم نقل ميزاته.

---

### 2. قواعد العمل مع المالك

- الرد **بالعربي، مختصر ومباشر**.
- **لا رفع على `main` ولا نشر قبل أن يقول المالك «انشر».** الرفع على `main` ينشر **الإنتاج والديمو معاً**.
- **لا حذف لأي شيء** (ملفات، قواعد بيانات، بيئات، نسخ احتياطية) إلا إذا سمّاه المالك وطلبه.
- القرار للمنفّذ في التفاصيل، والتوقف للمالك فقط عند القرارات الحقيقية وقبل النشر.
- لا تُكتب كلمات مرور حقيقية في المواقع المنشورة؛ الاختبار محلياً بحسابات اختبار.
- لا تُرفع ملفات فيها بيانات حقيقية (نسخ قواعد بيانات، سجلات). ملفات SQL للبنية فقط مسموحة.
- المرجع لكل شاشة وحقل ونص ومعادلة: نسخة HTML المقسّمة في `frontend/legacy` ودوال Supabase في
  `tools/legacy-parity/sql` — ثم من 18 أكتوبر: **نظام React الخاص بقسم الموارد البشرية**.
- لا يُعدَّل `frontend/legacy` ولا الملفات الأصلية؛ ومجلد نظامهم (`reference/hr-react`) للقراءة فقط.
- المالك يشغّل بنفسه أي أمر Railway يغيّر قاعدة البيانات.
- كل commit ينتهي بسطر `Co-Authored-By`.

---

### 3. البنية التقنية والمعمارية

#### 3.1 التقنيات الحالية
| الجزء | التقنية |
|---|---|
| الخادم | Python 3.12، FastAPI، Uvicorn، SQLAlchemy 2 + psycopg 3 (SQL مباشر عبر `text()`)، Pydantic، PyJWT، Argon2/bcrypt، pytest |
| قاعدة البيانات | PostgreSQL 18 على Railway، الخدمة `Postgres-Q6OM` (موحّدة منذ 13 أكتوبر)، والخدمة القديمة `Postgres` محفوظة بدون لمس |
| موقع الموارد البشرية | Next.js 16، React 19، TypeScript، Chart.js، Tabler Icons، Zod، ESLint. يستخدم `proxy.ts` بدل `middleware.ts` (Next 16) |
| تطبيق الموظف | Expo 57، React Native 0.86، TypeScript، Expo Router، expo-location، expo-secure-store، react-native-svg، react-native-webview، وبعد النقل: expo-document-picker، expo-file-system، expo-local-authentication، expo-notifications، expo-print، expo-sharing، expo-device |
| الاستضافة | Railway، المشروع `sparkling-learning`، بيئتان: production و demo |
| المستودع | GitHub `Faisal-Alrashed1/HR_ARIBA` (خاص) — الرفع على `main` ينشر البيئتين تلقائياً |
| مكتبات PDF في الموقع | jspdf 4.2.1 + html2canvas 1.4.1 |

#### 3.2 المعمارية
```
 موقع الموارد البشرية (Next.js)        تطبيق الموظف (Expo)
 frontend/hr-web                       frontend/employee-app
        │        HTTPS JSON  /api/v1          │
        └──────────────────┬──────────────────┘
                           ▼
      FastAPI: backend/app/main.py
      routers/canonical.py (الأساس) + routers/port_*.py (ميزات نظامهم)
      services/ (المعادلات، البريد، الإشعارات، المهام المجدولة …)
                           ▼
      PostgreSQL على Railway (المخطط الموحّد + جداول الترحيل 001)
```
- **الخادم يملك** الحالة والقواعد والحسابات والصلاحيات؛ الواجهات تعكس فقط.
- **الدخول:** `POST /api/v1/auth/login` يرجع JWT موقّع من الخادم؛ الحسابات في `ariba_auth_accounts`؛ كلمات المرور
  القديمة bcrypt (`$2a$`) تتحول تلقائياً إلى Argon2؛ `ariba_sessions` تحفظ معرّف جلسة داخل الـ JWT.
- **الملفات** (الصور والمرفقات والخطابات) محفوظة **داخل قاعدة البيانات** في `ariba_documents.file_data` (منذ commit
  `683982d`)، وقرص Railway `/data` غير مستخدم.
- الواجهتان تعتمدان على JSON الخادم فقط، لا على شكل قاعدة البيانات.

#### 3.3 أهم الملفات
- `backend/app/routers/canonical.py`: كل المسارات الأساسية بـ SQL مباشر (~2,640 سطر).
- `backend/app/routers/port_*.py`: مسارات ميزات نظامهم: `port_workflow`، `port_candidates`، `port_employees`،
  `port_goals`، `port_docs`، `port_mail`، `port_tasks`، `port_assets`، `port_audit`، `port_auth`، `port_staff`،
  `port_settings`.
- `backend/app/services/`: `employee_map.py`، `canonical_data.py`، `leave.py`، `gosi.py`، `end_of_service.py`،
  `contracts.py`، `country.py` (مصر)، `schedule.py` (رمضان)، `port_common.py` (الصلاحيات، المراحل، الإشعارات)،
  `port_audit.py`، `mailer.py`، `push.py`، `scheduler.py`.
- `backend/app/models.py`: قائمة الجداول المسموحة، تُفحص عند التشغيل (الخادم يرفض الإقلاع إذا نقص جدول).
- `frontend/hr-web/src/port/`: شاشات نظامهم منقولة كما هي (انظر §11).
- `frontend/hr-web/src/lib/calc/*`: معادلات الموقع (payx، payroll-rows، insurance، country، schedule، salcalc، tax،
  assets، wps، goals، inscalc، provisions، eos، settlement، tafqeet، forms …).
- `frontend/employee-app/app/*` و`src/lib/*`: شاشات التطبيق وعميل الخادم.
- `tools/legacy-parity` و`tools/react-parity` و`tools/dev-db`: أدوات المطابقة وقاعدة الاختبار.

---

### 4. الخط الزمني الكامل

#### 4.1 — 4 أكتوبر: النسخة الأولى (أُعيد ضبطها لاحقاً)
- أساس الخادم: الدخول، الأدوار، الأمان، الموظفون؛ السعودة، التأمينات، نهاية الخدمة، لوحة التحكم، التنبيهات، الوثائق،
  الصورة، التابعون؛ تصميم V114؛ أول نشر على Railway.
- قرار الاستضافة: كل شيء على Railway بدون Supabase؛ دخول داخلي بـ Argon2id في جدول `credentials` و JWT HS256 مع
  `token_version` لكل مستخدم (تغيير كلمة المرور يلغي الجلسات القديمة)؛ الملفات على قرص (Railway Volume).
- مراجعة المرحلة الأولى (`PHASE1_REVIEW`، الفرع `feat/foundation`، آخر commit `e8ca7c9`): 25 جدول، 27 enum، 19 مسار،
  28 صفحة (10 مبنية و18 مؤقتة). التقدير: البنية ~85%، ميزات الموارد البشرية ~12%، التطبيق ~15%، سير الموافقات 0%،
  **الإجمالي ~15%**. قاعدة «مكتمل» = واجهة + مسار + حفظ في القاعدة + صلاحيات على الخادم.
- قرارات ذلك اليوم (`PROJECT_STATUS`): أساس نهاية الخدمة = أساسي + سكن (تغيّر لاحقاً)، سنوات الخدمة = الأيام ÷ 365،
  السعودة = عدد، مراحل الموافقة بيانات في `workflow_rules`.
- حُفظت هذه الحالة في الوسم `archive/before-reset` والفرع `feat/foundation`.

#### 4.2 — 5 أكتوبر: إعادة البناء من HTML المقسّم
- المستودع صار: `backend` + `frontend/hr-web` + `frontend/employee-app`، والمرجع في `frontend/legacy`
  (بوابة الموارد البشرية: 27 CSS + 141 JS؛ بوابة الموظف: 14 CSS + 47 JS؛ إعادة الدمج تعطي الأصل حرفاً بحرف، ومقارنة
  Playwright لـ 13 صفحة متطابقة).
- نُقل بنتائج مطابقة: التأمينات مع إعفاء V130، صفحة نهاية الخدمة (`rEOS`)، المخالصة (`sRun`)، محرك المسيّر PAYX V119،
  كشف الراتب، المواقع، الحضور، محرك سجل الإجازات، الإجازات، الوثائق، التقارير التسعة، الإعدادات، النماذج التسعة على ورق
  الشركة.
- commits اليوم: `782616e` كشف الراتب، `32339b9` المواقع، `efc07d3` الحضور، `b03d014` محرك الإجازات، `abd4f3b` مسارات
  الإجازات، `0085b8b` صفحة الإجازات، `e93e943` الوثائق، `435879f` التقارير، `0e013a0` و`afd85a9` الإعدادات، `9e97bc8`
  و`4e997a0` الخطابات والنماذج، `50f2998` جلب كل صفحات الموظفين.

#### 4.3 — 6 أكتوبر: إضافات وأول تطبيق
- الموقع: تقارير الحضور V117، مستند المخالصة مع التفقيط، أرشيف المسيّر، الإرسال الجماعي والنماذج الإنجليزية، مواقع عمل
  لكل موظف (V121)، مرفقات الطلبات (12 ميجا)، نهاية العقد مع إنهاء/إعادة تفعيل تلقائي، خيار «بدون خصم» للتأمينات.
- التطبيق: بصمة GPS مع تحقق الخادم من النطاق والساعات المرنة، طلباتي، نسيان البصمة، الفريق، الموافقات، النماذج،
  كشوف الرواتب، الإشعارات.
- commits: `8796992` تنظيف المخطط 0007، `b691f3f`، `12f2a9c`، `e731ac6`، `ccbe966`، `c7a268b`، `5ac4b22`، `cd5e76b`،
  `cd0e941`، `0c4e305`، `53615a5`، `8b3a3f9`، `94785dc`، `46c6ae5`، `0d0caa9`، `1df0d25`، `1ea0d8a`.

#### 4.4 — 8 أكتوبر: الانتقال إلى قاعدة بيانات الزميل (canonical)
- الخادم صار يعمل على مخطط Supabase الأصلي عبر `canonical.py`، الخدمة `Postgres-Q6OM`.
- تدقيق التكامل (`INTEGRATION_AUDIT`): 34 جدول، 106 موظف، 110 حساب. ملف التصدير بلا مفاتيح ولا فهارس، وبعض الجداول
  مكررة الصفوف؛ 5 دوال ناقصة أُعيدت كتابتها بـ Python (`ariba_leave_calc`، `ariba_punch_late`، `ariba_punch_early`،
  `ariba_point_in_polygon`، `ariba_apply_forgot_punch`).
- أداة `backend/tools/create_account.py` لإنشاء دخول بكلمة مؤقتة. التطبيق أخذ شكل V118 القديم.
- التراجع لتلك الخطوة: إرجاع `DATABASE_URL` إلى `${{Postgres.DATABASE_URL}}` ونشر `1ea0d8a`.
- commits: `d32f890`، `d5cd4e3`، `39616b4`، `8b46326`، `6f89af9`.

#### 4.5 — 11 أكتوبر: الديمو والهوية والواجهة
- **بيئة الديمو:** نسخة من الإنتاج وكل الرواتب 1000 (إعداد في Railway وليس commit).
- **الهوية:** أيقونات Tabler بدل الإيموجي، ألوان أريبا، صور شخصيات ذكر/أنثى/تمهير.
- الواجهة: منتقي تاريخ/وقت موحّد (39 حقلاً)، صفحة «الطلبات والإجازات»، تنبيه نسيان البصمة، تحسين لوحة التحكم، زر
  «تحديث البيانات» يعيد تحميل أي صفحة.
- الموظفون: الحفظ يعيد حساب التأمينات والصافي المخزّنة (102/107 تطابق القديم)، فلتر «كل جهات العمل».
- commits: `673ddb1`، `9a345ee`، `487fbaa`، `8ee52fc`، `fe9c836`، `d1d6699`، `2dea04d`.

#### 4.6 — 11–12 أكتوبر: تدقيق المطابقة مع النظام القديم (`0f85a93`)
- التفاصيل في §7. أبرز النتائج: تقرير نهاية الخدمة يستخدم المكافأة المسجلة (84/84)، نهاية العقد تُحسب عند الحفظ، إعادة
  التفعيل عند التجديد، البصمة بالمضلعات وأصغر منطقة أولاً، العمل عن بعد فقط بطلب معتمد، الدقائق المتأخرة ≥1، أرقام
  لوحة التحكم مطابقة، إعفاء التأمينات = `kindOf` (428/428)، رصيد التطبيق = `ariba_leave_calc`، كل الطلبات مدير ← HR ←
  تنفيذي (نسيان البصمة HR فقط)، تنبيه HR بكل طلب، وتصحيحات نظام العمل A–J (ثم K).

#### 4.7 — 12–13 أكتوبر
- `683982d` الملفات في قاعدة البيانات، `c24e6d6` حذف قسم الملاحظات المفتوحة من الدليل، `1d2bbed` حدود خضراء غامقة
  لكل مربعات لوحة التحكم، `ad8ee40` إصلاح حذف HR لطلب (قوس ناقص كان يعطي 500 ويظهر «تعذر الوصول للخادم») + اختبار.
- نقطة التراجع `before-normalization` (وسم على `ad8ee40` + نسخة كاملة على جهاز المالك).

#### 4.8 — 13 أكتوبر: توحيد قاعدة البيانات (Normalization) ونشره
- `dbbee54`: دمج عمل الزميلة غادي نفيسة (مستودع `Dalteam/HR_ARIBA` commit `8e5716a`)؛ أُخذت كما هي: `canonical.py`،
  `models.py`، اختبار العقد، `create_account.py`، إشعارات التطبيق (حالة القراءة من الخادم)، صفحة الحضور (جلسات لكل
  يوم). بقي منّا: إصلاح الحذف والحدود. أُضيفت دالة حذف موحّدة تحذف الطلب وكل ما يرتبط به.
- `1ba1a42`: سكربت `docs/db-normalization/run_on_railway.sh` (نسخة احتياطية → `railway_prep.sql` → فحوصات →
  إصلاحات → فحوصات → `ariba_normalization.sql`).
- **النشر:** الديمو 15:23 والإنتاج 15:26 يوم 13 أكتوبر، النشر 15:27. الصحة تمام. العدّادات بدون تغيير عدا: المسيّر
  175 → 171 (4 صفوف يتيمة لموظفين محذوفين، محفوظة في `ops.orphan_payrolls_backup`)، وإجراءات الموافقة 12 → 14
  (إضافة الناقص وحذف مراحل «تجاوز HR» القديمة).
- `494998d` (14 أكتوبر): تحديث `PROJECT_GUIDE` بالعربي والإنجليزي — آخر commit قبل نقل نظامهم.

#### 4.9 — 18 أكتوبر: نقل نظام React الخاص بقسم الموارد البشرية (المهام 0–11)
- التفاصيل الكاملة في §8. ملخص commits:
  - `14b7983` المهمة 1: الخطة `PORT_PLAN.md` (188 صف، كل الشاشات والدوال).
  - `2c5f71b` المهمة 2: أداة `tools/react-parity` وخط الأساس (81,615 حالة).
  - `8db0266` جزء من المهمة 3: محرك إجازاتهم، جدول التأمينات التلقائي، طبقة مصر، نسخ معادلاتهم.
  - `abdcf3d` تسليم الجلسة السحابية: نسخة مرجعية للقراءة فقط من نظامهم + ملفات السياق + مخطط القاعدة بدون بيانات.
  - `ffc63d8` **المهمة 3:** معادلاتنا تعطي نتائجهم (0 فرق، 111/111 صف).
  - `91436f9` **المهمة 4:** حذف منطقنا الذي ليس عندهم (🟣).
  - `69d5063` **المهمة 5:** ترحيل `001_react_port.sql` + التحقق + السكربت + قاعدة الاختبار `tools/dev-db`.
  - `8ff583c` **المهمة 6:** مسارات الخادم لكل ميزاتهم + اختبارات تكامل.
  - `5deaa1c` **المهمتان 7 و9:** الموقع بشاشاتهم + صفحة التقديم العامة `/apply`.
  - `3fb1487` **المهمة 8:** ميزات تطبيق الموظف (فحص الأنواع فقط).
  - `339ccf9` تقرير التحقق `PORT_VERIFICATION.md`.
  - `837cbeb` **المهمة 10:** سيناريو كامل على قاعدة اصطناعية: 50/50.

#### 4.10 — 18 أكتوبر مساءً: الترحيل والدمج والنشر
- **نسخة احتياطية للكود:** فرع `backup/قبل-الدمج` على `main` القديم (`494998d`).
- **ترحيل قاعدة البيانات (شغّله المالك من جهازه بـ `run_on_railway.sh`):**
  - **الديمو:** نسخة احتياطية 19 ميجا (`db_demo_20261018-201331.sql.gz`)، كل الفحوصات ok، 25 مفتاح أجنبي، العدّادات
    قبل = بعد: accounts 111، attendance 65، audit 624، documents 4، employees 111، leaves 15، notifications 82،
    payroll 171، requests 29.
  - **الإنتاج:** نسخة احتياطية 19 ميجا (`db_production_20261018-201456.sql.gz`)، كل الفحوصات ok، العدّادات قبل = بعد:
    accounts 111، attendance 50، audit 446، documents 2، employees 107، leaves 8، notifications 21، payroll 171،
    requests 9.
- **الدمج:** `main` تقدّم مباشرة (fast-forward) من `494998d` إلى `837cbeb`؛ نشر Railway للبيئتين نجح (أخضر).
- **متغيرات الخادم** (أضافها المالك بأوامر Railway):
  - الإنتاج: `MAIL_SECRET_KEY` (مولّد عشوائياً على جهاز المالك)، `SCHEDULER_ENABLED=1`.
  - الديمو: `MAIL_SECRET_KEY`، `SCHEDULER_ENABLED=1`، `MAIL_DISABLED=1`، `PUSH_DISABLED=1`.
- تشغيل التطبيق من الماك: `npx expo start --tunnel` (أي شبكة) أو مع `EXPO_PUBLIC_API_URL=https://hrariba-demo.up.railway.app` للديمو.

#### 4.11 — 19 أكتوبر: الهوية والبريد وبيانات الإنتاج
- `daabbf3`: اكتُشف أن نظامهم يحوّل كل إيموجي إلى أيقونة Tabler عبر `ico-runtime.js` (في إعداد Vite عندهم) وأن هذا
  ضاع في النقل؛ رُبط عبر `next.config.ts` لملفات `src/port` فقط. ورجع تصميمنا للوحة التحكم (حدود خضراء، أيقونات،
  صور شخصيات بلون واحد، رقم الرواتب مقروء، أعمدة الأقسام بتدرج، ألوان الرسوم) + شعار أريبا في القائمة الجانبية.
- **البريد:** ضُبط بريد الشركة على Gmail بكلمة مرور تطبيق (منفذ 465 SSL).
  - `6fb7303`: زر «إرسال رسالة تجربة» كان يذهب لمسار إرسال المستندات ويطلب PDF؛ صار يذهب لـ `/mail/test`.
  - في Safari زر «إرسال إيميل للموظف» لم يُظهر شيئاً؛ في Chrome ظهر الخطأ الحقيقي:
    `SMTP: [Errno 101] Network is unreachable` — **Railway يمنع SMTP في الخطط التجريبية/المجانية**.
  - القرار: الإرسال عبر **Microsoft 365 / Graph** (لا يمر بـ SMTP). بدأ تسجيل التطبيق في Microsoft Entra
    (حساب المالك يظهر «No roles assigned»، فخطوة Grant admin consent قد تحتاج Global Administrator).
- **المدير المباشر:** في نظامهم معبّأ لكل الموظفين، وفي قاعدتنا غير معبّأ — لأننا نقلنا كودهم وليس بياناتهم. موظف واحد
  كان محفوظاً له مدير برقم غير موجود فرفض الخادم حفظ راتبه («Manager must be a different existing employee»)؛ حُلّ من
  الشاشة. تعبئة المدراء لكل الموظفين يتولاها زميل المالك.
- **البحث في قائمة الموظفين** كان يطيح (`includes is not a function`): 7 موظفين رقم إقامتهم محفوظ كرقم وليس نصاً
  (من استيراد Excel قديم). صُحّح بأمر SQL واحد في **الإنتاج (UPDATE 7)** ثم **الديمو (UPDATE 7)**.
- مقارنة الميزات وقوائمها، وروابط البيئات، وأوامر الإيقاف/التشغيل، وتقديرات تكلفة Railway (~0.3–0.5 دولار يومياً
  للخدمات الثمان)، وتنبيه أن رصيد Railway التجريبي «9 days or $2.46 left».

#### 4.12 — 20 أكتوبر: إصلاحات مراجعة المالك (`e0587b2`، نُشر بعد «انشر»)
- **التطبيق:** شاشات تعديل البيانات وتغيير الآيبان ورفع المستند كانت تطيح («useData outside DataProvider») →
  مزوّد البيانات انتقل لجذر التطبيق ويُمسح عند الخروج؛ رفع المرفقات «تعذر قراءة الملف» → `base64` في منتقي الملفات
  للويب فقط، صار يُقرأ الملف من الجهاز عبر `expo-file-system`؛ لوحة التوقيع (الخط يقفز والصفحة تتحرك) أُصلحت وكبرت؛
  أزرار التوقيع تظهر فقط حين ينتظر المستند الموظف؛ بطاقة «ملفي» تغطي كاملة والاسم الطويل ينزل سطراً.
- **مسار المستندات:** HR يرسل → الموظف يوقّع/يوافق → يظهر في طلبات HR المعلقة مع النسخة الموقّعة → اعتماد HR يغلقه →
  يظهر في كل الطلبات وأرشيف النماذج؛ الاعتراض يغلقه ويُشعر HR.
- **الموقع:** القائمة الجانبية صارت تحت النوافذ المنبثقة (كانت فوقها وتغطي جزءاً منها)؛ خانات الاختيار لم تعد تضغط
  النص بجانبها (بطاقات نظام الدولة)؛ كل الأرقام إنجليزية؛ **4 ألوان هوية فقط**.
- الفحوصات: pytest 108 نجح، react-parity 0 فرق، legacy-parity مطابق، السيناريو 50/50، بناء الإنتاج نجح، 24 شاشة بلا
  أرقام عربية، كل الشاشات بلا أخطاء لثلاثة أدوار، والتطبيق في المتصفح يفتح الشاشات الثلاث.
- النشر: commit على `main` محلياً، ثم بعد أمر المالك «انشر» رُفع ونُشر.

---

### 5. النظام القديم (V114) كما كان

#### 5.1 طريقة البناء
- ملف رئيسي ثم عشرات الـ patches (من V18 إلى V130) كل واحد يغلّف أو يستبدل دالة عامة سابقة أو يحقن واجهة بـ
  `setInterval`؛ ترتيب التحميل يحدد السلوك وآخر تعريف للدالة هو الفعّال.
- الخادم: دوال Supabase RPC (`ariba_*`)، والاستضافة ملفات ثابتة على Netlify.
- بيانات الموارد البشرية كانت في **localStorage** المتصفح (مفاتيح `hr7_…` مثل `hr7_emps` و`hr7_pay_YYYY_MM` و
  `hr7_settings` و`hr7_insuranceRules` و`hr7_hols` و`hr7_locs`)، والمفاتيح «الحساسة» مشفّرة بـ XOR بمفتاح ثابت (تمويه وليس
  أماناً)، والتابعون محفوظون في الجهاز فقط.
- الجلسة في `sessionStorage['ariba_hr_session_v3']`، تُفقد عند إغلاق التبويب.

#### 5.2 بوابة الموارد البشرية
- القائمة: عام (لوحة التحكم)، الموظفون، الحضور ومواقع البصمة، الإجازات، المالية (المسيّر، الكشف، نهاية الخدمة،
  المخالصة)، الوثائق، إدارية (التقارير، الإعدادات)، النماذج.
- لوحة التحكم: ستة مربعات (الموظفون، السعودة، إجمالي الرواتب، الجنس، الأقسام، المعلّق/المنتهية/التمهير)، رسوم
  (رواتب حسب جهة العمل، الجنسيات، جهات العمل، الأقسام)، تنبيهات عاجلة (≤ 90 يوم)، طلبات معلقة، ملخص الرواتب.
- الموظفون: تبويبات (الكل، الحاليون، المنتهية خدمتهم، التمهير، التدريب، الاستشاريون)، نموذج من 5 تبويبات (أساسي،
  وثائق، عقد، راتب، تابعون)، الحفظ (`sEmp`) يتحقق من تفرّد الرقم والبريد والهوية، الرقم الجديد = أعلى رقم + 1، اسم
  المستخدم `EMP` + 3 أرقام، إنهاء الخدمة بسبب وآخر يوم، إعادة التفعيل، الحذف النهائي.
- الحضور: بطاقات اليوم، سجل يومي، إضافة يدوية، تقرير شهري، تقارير V117 المتقدمة، تحديث كل 8 ثواني.
- مواقع البصمة: نصف قطر 50–5,000 م (V38 يفرض 1,000 م لغير «عن بعد»)، موقعا «عمل عن بعد» و«مصر» إلزاميان (V35)،
  ربط موظفين بمواقع (V121).
- الإجازات (6 تبويبات): المعلّق (اعتماد/رفض بسبب/اعتماد نهائي/حذف)، كل الطلبات، طلب جديد من HR، الأرصدة ومحرّرها،
  العطل الرسمية، العمل الإضافي.
- المسيّر: يطابق ملف Excel «مسير رواتب سبتمبر 2026»، الاعتماد يجمّد المسيّر ويظهره للموظف، الطباعة A4 أفقي بتوقيعات
  ثابتة.
- كشف الراتب، نهاية الخدمة (المواد 84/74/85/75/77/80/74(4)/74(3))، المخالصة (9 أسباب، مستند رسمي صفحة واحدة مع التفقيط)،
  الوثائق (إقامات، جوازات، تأمين طبي، عقود)، التقارير التسعة، الإعدادات، النماذج التسعة (مباشرة عمل، استلام عهدة تقنية،
  تمديد فترة التجربة، إشعار انتهاء التجربة، إخلاء طرف، شهادة خبرة، تقييم فترة التجربة، إشعار انتهاء العقد، خطاب
  راتب)، مساعد «اريبا AI» (V112)، الجرس.

#### 5.3 تطبيق الموظف القديم (PWA)
- الدخول باسم `EMPxxx`، والسياق كاملاً عبر `ariba_employee_context`.
- التبويبات: الرئيسية (بطاقة البصمة وساعة الرياض)، الحضور، الإجازات، الراتب، فريقي، ملفي، العمل الإضافي، المستندات،
  الموافقات (للمدير/HR/التنفيذي).
- البصمة `ariba_attendance` مع تحقق الخادم من النطاق والنافذة المرنة؛ أخطاء `OUTSIDE_GEOFENCE`،
  `TOO_EARLY_FOR_FLEXIBLE_WINDOW`، `TOO_LATE_FOR_FLEXIBLE_WINDOW`؛ جلسات متعددة في اليوم.
- الطلبات: 16 نوعاً + نسيان البصمة؛ مرفق ≤ 12 ميجا.

---

### 6. قواعد العمل والمعادلات

> الحالة الحالية = **معادلات نظامهم** (منذ 18 أكتوبر). ذُكر التاريخ حيث تغيّر.

#### 6.1 القواعد العامة
- التقريب `r2(x) = Math.round(x×100)/100` (محرك V119 يضيف EPSILON).
- يوم العمل للإجازات: ليس جمعة ولا سبت ولا عطلة رسمية؛ العطل تتمدد بعدد أيامها والمتكررة تتكرر كل سنة.
- المنطقة الزمنية: آسيا/الرياض. أسبوع العمل: الأحد–الخميس.
- **الأرقام في الواجهات إنجليزية دائماً (0–9)** منذ 20 أكتوبر.

#### 6.2 الراتب والعملة
- `salaryTotal = أساسي + سكن + نقل + مشروع + أخرى + إضافي`.
- `الصافي = الإجمالي − حصة الموظف في التأمينات − الاستقطاعات الأخرى`.
- العملات: ريال، دولار، يورو، جنيه؛ سعر الدولار الافتراضي 3.755 (وفي مواضع 3.75)، والصافي بالريال = الصافي × السعر.
- إصلاح بيانات قديمة: صافٍ محفوظ بالريال بالغلط يُقسم على السعر، وصافٍ أكبر من 20 ضعف الإجمالي يُعاد حسابه.

#### 6.3 التأمينات الاجتماعية (GOSI)
| النسبة | من 2026-01-01 | من 2027-07-01 |
|---|---|---|
| موظف «يطابق» < 55 | 10.75% | 11.25% |
| موظف «يطابق» 55+ | 10.50% | 11.00% |
| صاحب العمل «يطابق» < 55 | 12.75% | 13.25% |
| صاحب العمل «يطابق» 55+ | 12.50% | 13.00% |
| موظف «لا يطابق» < 55 | 9.75% | 10.25% |
| موظف «لا يطابق» 55+ | 9.00% | 9.50% |
| صاحب العمل «لا يطابق» < 55 | 11.75% | 12.25% |
| صاحب العمل «لا يطابق» 55+ | 11.00% | 11.50% |
| غير سعودي | موظف 0%، صاحب العمل 2% | نفسه |
| سقف الأجر | 45,000 | 45,000 |
- `calcIns`: `الأساس = min(السقف ÷ أيام الشهر × أيام العمل، أساسي + سكن)`؛ حصة الموظف وصاحب العمل = الأساس × النسبة.
- إعفاء V130 التلقائي (صفر للطرفين): التمهير، الاستشاري، المتدرب (بالمسمى أو القسم أو جهة العمل أو النوع).
- **بعد النقل:** جدول نسب تلقائي بفترات قبل 2026 أيضاً (جدولهم أدق قانونياً: قبل 2026 كنا نحسب صفراً، ونسبة النصف
  الأول من 2026 كانت خاطئة)، و`calcIns` بتقريب JavaScript، في `services/gosi.py` و`lib/calc/inscalc.ts`.

#### 6.4 الإجازات
- الاستحقاق السنوي = `leaveDaysContract` أو 21.
- **بعد النقل — ثلاث طرق احتساب** (الإعداد `leave_accrual_method`): تقويمي (الافتراضي عندهم)، شهري، أيام عمل.
- الترحيل (الإعداد `leave_carry`): بحد أقصى (الإنتاج: 10 أيام مفعّل)، والزائد يذهب لرصيد نهاية الخدمة.
- **أُلغيت** قاعدة ترحيل 2024 الخاصة (الزائد عن 10 من 2023)، و**أُلغي** تجميد رصيد المنتهية خدمته.
- الإجازة السنوية التي تقطعها إجازة مرضية تُستعاد أيامها (`usedThrough`).
- رصيد التطبيق (الحالي ونهاية العام) يحسبه الخادم بنفس المحرك (القرار 4)، ولا لقطات من المتصفح.
- محرّر أرصدة السنوات (yearEnd/current/carryNext/eos) مع سجل آخر 10 حفظات و«تراجع».

#### 6.5 العمل الإضافي
- عمود المسيّر X: `(الإجمالي ÷ الأيام ÷ 8 × الساعات) + (الأساسي ÷ الأيام ÷ 8 ÷ 2 × الساعات)` — أجر الساعة كاملاً + 50%
  من الأساسي (المادة 107). بدون ساعات: مبلغ يدوي.

#### 6.6 نهاية الخدمة
- صفحة نهاية الخدمة (`eosByLaw` بعد النقل): الأساس = أساسي + سكن؛ السنوات = الأيام ÷ 365.25؛
  المادة 84 = `الأساس/2 × min(سنوات،5) + الأساس × max(0، سنوات−5)`.
- الاستقالة (85/75): أقل من سنتين 0، أقل من 5 الثلث، أقل من 10 الثلثان، غير ذلك كاملة — **بالضبط 5 سنوات = الثلثان**
  (تصحيح A أُلغي).
- المادة 77: مادة واحدة لكل العقود (أُلغي تصحيح C للعقد المحدد)؛ المادة 87 **أُزيلت** (تصحيح D)؛ المادة 80 والمادة
  53 (التجربة) = 0؛ الموظف «المستثنى من نهاية الخدمة» لا يُحسب.
- في المسيّر (PAYX): `K = سنوات + أشهر/12 + أيام/360`، الأجر `T` = كل البدلات، عوامل الأسباب (اتفاق 1، انتهاء العقد 1،
  المادة 80 = 0، الاستقالة بنسب، …).
- مثال قديم موثّق: انضمام 2019-03-10، آخر يوم 2026-09-30، T = 14,000، استقالة → AK = 47,203.65.

#### 6.7 المخالصة
- منسوخة حرفياً (`settle`): الخدمة سنوات+أشهر+أيام (+1)؛ مكافأة كالمادة 84 وغيرها؛ تعويض الإجازة = الأجر/30 × الرصيد
  المتبقي؛ خصم الإجازة الزائدة؛ أجر الفترة الأخيرة؛ إضافات واستقطاعات (مبلغ أو أيام).
- **بعد النقل:** لا تقريب للمدخلات، لا مادة 87، لا مادة 77 للعقد المحدد، ومخالصة مصرية.
- أمثلة قديمة موثّقة: المادة 84 = 140,224؛ 85 = 116,618.44؛ 77 = 193,132؛ 80 = 69,407.33.

#### 6.8 المسيّر (PAYX V119)
- الشمول: الحاليون عدا المنتهين، والعمال بالساعة، والاستشاري الخارجي، والمستثنين؛ المنتهون خلال الشهر يُضافون تلقائياً.
- الأعمدة: V الأساسي حسب الأيام، Y السكن، Z النقل، AA المشروع، AB أخرى، X الإضافي، AC تعويض الإجازة، AK نهاية الخدمة،
  AM الإجمالي المستحق، AU الاستقطاعات، AV الصافي، AW الصافي بالعملة.
- رصيد الإجازة في المسيّر: `N = K≤5 ? K×M : 105 + (K−5)×30`.
- **تأمينات المسيّر على الأساسي + 25%** (أُلغي تصحيح G الذي كان يستخدم السكن الفعلي).
- طبقة مصر: ضريبة كسب العمل (TAX) وصندوق الشهداء (MF).
- **دورة المسيّر بعد النقل:** HR يحفظ → «تجهيز للمالية» → المالية تعتمد → يُقفل → الفتح بسبب ≥ 5 أحرف؛ حفظ تلقائي
  ومزامنة تعديلات الآخرين؛ كل تعديل يدوي يُسجَّل في سجل التعديلات.
- خصم الإجازة بدون راتب والسلفة يبقى يدوياً (القرار 8).

#### 6.9 كشف الراتب وخطاب الراتب
- الكشف من صف المسيّر المعتمد؛ وإن لم يُحفظ يُحسب `calcFor` للشهر (الصف 55).
- خطاب الراتب: الإجمالي = أساسي + سكن + نقل + أخرى (بدون المشروع)، رقم صادر `AR-YYYYMMDD-n` يومي، تاريخ هجري
  (أم القرى) وميلادي.

#### 6.10 الحضور والبصمة
- التأخير = الدخول − (بداية الدوام + السماح)؛ الدقيقة الجزئية تُحسب دقيقة كاملة على الأقل؛ سماح 0 يُحترم.
- الساعات المرنة: الخروج المتوقع = أول دخول + ساعات الوردية، بحد نهاية النافذة إذا كان متأخراً؛ **بعد النقل يدخل
  دوام رمضان** (اكتشاف رمضان بتقويم أم القرى `hijridate`).
- كل جلسة تحتفظ بخروجها المبكر (أُلغي تصحيح K).
- الغائب = الموظفون − (الحاضرون + المتأخرون).
- العمل عن بعد المتبقي = `remote_days_per_year − المستخدم` (الافتراضي 10) — القرار 1.
- النطاق الجغرافي: هافرساين ≤ نصف القطر؛ المضلعات (V140) وأصغر منطقة أولاً؛ «عن بعد» فقط بطلب معتمد لذلك اليوم.

#### 6.11 التنبيهات (V142 بعد النقل)
- الإقامة 60 يوماً، الجواز 90، العقد 60، فترة التجربة 30 (من −7، خلال 400 يوم من البداية، ليس للاستشاري/التمهير/المتدرب)،
  مرتبة بالأيام؛ الأيام المتبقية بـ `Math.round`.

#### 6.12 سير الموافقات (sql/10 عندهم)
- المسار: المدير المباشر ← الموارد البشرية ← [الرئيس التنفيذي]؛ التنفيذي فقط إذا كان المعتمد النهائي للنوع هو التنفيذي.
- `workflow_config`: `manager_wait_days` 3، `ceo_wait_days` 3، `advance_max_percent` 100، `extra_hr_emails`،
  `final_by_type` = الموارد البشرية لـ: بدون راتب، سلفة، تغيير آيبان، تعديل بيانات، مستند.
- نسيان البصمة وتعديل البيانات والمستند يذهبون مباشرة لـ HR؛ بدون مدير ← HR.
- السلفة ≤ الراتب × النسبة، وطلب واحد معلّق فقط. تغيير الآيبان: طلب واحد، شهادة إلزامية، الخطاب ≤ 400 كيلو.
- تعديل البيانات: 9 حقول مسموحة. رفض HR يحتاج سبباً.
- التصعيد: بعد المهلة من `updated_at` (مهمة مجدولة كل ساعة). إرجاع HR للمدير بملاحظة. التفويض. التقديم بالنيابة.
- **النماذج المرسلة للتوقيع (منذ 20 أكتوبر):** الموظف يوقّع/يوافق ← (توقيع المدير إن طُلب في `doc_sign_cfg`) ← مرحلة
  `hr` في الطلبات المعلقة ← اعتماد HR يغلقها (بدون مرحلة تنفيذي).

#### 6.13 المستهدفات والتقييم
- فترات سنوية/ربعية/شهرية؛ التقييم = `round(Σ الدرجة×الوزن ÷ Σ الأوزان، 1)`؛ الاعتماد من المدير/الرئيس/التنفيذي أو
  المدير المباشر بصلاحية؛ HR يجهّز فقط.

#### 6.14 التفقيط
- ريالات وهللات بصيغ المفرد والمثنى والجمع، «… ريال سعودي و… هللة» أو «لا غير». مثال: 2,000 → «ألفان ريال سعودي لا غير».

#### 6.15 بيانات مكتوبة في الكود القديم (موروثة)
- أسماء مستثناة أو مُنهاة في patches قديمة، وتوقيعات ثابتة في طباعة المسيّر، ومعتمِدا المراحل (HR = الموظف 40،
  التنفيذي = الموظف 86 في `workflow_approvers`).

---

### 7. تدقيق المطابقة مع النظام القديم (LOGIC_AUDIT، 11 أكتوبر)

#### 7.1 الطريقة
- تشغيل بوابة HR القديمة كاملة في jsdom (141 ملف JS بالترتيب، 107 موظف حقيقي في قاعدة محلية مؤقتة)، ومقارنة رقماً
  برقم مع الموقع والخادم والتطبيق، وتشغيل دوال الخادم القديمة في Postgres محلي.

#### 7.2 مطابق 100%
| الوحدة | النتيجة |
|---|---|
| PAYX V119 | 20,000/20,000 حالة |
| المخالصة `sRun` | 3,000/3,000 |
| صفحة نهاية الخدمة | 840/840 |
| التفقيط | 3,032/3,032 |
| أيام عمل الإجازات | 4,000/4,000 (موقع وخادم) |
| رصيد نهاية العام وأيام نهاية الخدمة | 107/107 |
| رصيد التطبيق مقابل `ariba_leave_calc` | 23/23 |
| عدد التنبيهات | 14 = 14 |

#### 7.3 قريب ⚠️ وغير مطابق ❌ (ما تم فيه)
- ❌1 تقرير نهاية الخدمة → يستخدم المكافأة المسجلة (84/84). ❌2–4 لوحة التحكم (إجمالي الرواتب، الجنس بالأسماء، التمهير) →
  مطابقة. ❌5 نهاية العقد تُحسب. ❌6 إعادة التفعيل عند التجديد. ❌7 المضلعات. ❌8 «عن بعد» بطلب معتمد. ❌9 كل الأنواع
  عبر التنفيذي. ❌10 تنبيه HR بكل طلب. ❌11 التحقق من الرصيد عند الطلب **أُبقي** بقرار المالك (أشد من القديم).
- ⚠️ التأمينات حسب `kindOf` (428/428)، والتأخير بالدقيقة.

#### 7.4 تصحيحات نظام العمل A–K (أُضيفت 11–13 أكتوبر ثم أُلغيت كلها 18 أكتوبر)
| الرمز | التصحيح | المصير |
|---|---|---|
| A | الاستقالة: بالضبط 5 سنوات = الثلث، 10 = كاملة | أُلغي |
| B | أساس نهاية الخدمة = الأجر الفعلي | أُلغي (أساسي + سكن) |
| C | المادة 77 للعقد المحدد = أجر المدة المتبقية (حد أدنى شهران) | أُلغي |
| D | المادة 87 (المكافأة كاملة) | أُلغي |
| E/F | ملاحظات قانونية لـ HR على الطلبات | أُلغيت |
| G | تأمينات المسيّر على السكن الفعلي | أُلغي (25% من الأساسي) |
| H | قاسم العمل الإضافي | لم يتغير أصلاً |
| I | تنبيه نقص أعياد السنة | أُلغي |
| J | الإجازة بعد 5 سنوات للعقود فوق 21 يوماً | أُلغي |
| K | اليوم المرن: الخروج المبكر على آخر جلسة | أُلغي |

---

### 8. نقل نظام React الخاص بقسم الموارد البشرية

#### 8.1 ما سلّموه (18 أكتوبر)
- `ARIBA_HR_React` (البرنامج + `apply.html`) و`ARIBA_Employee_React` (تطبيق PWA).
- React 19.2 + Vite 8.3، JavaScript فقط، react-router 6، Chart.js 4، Tabler، jsPDF + html2canvas.
- **بدون خادم:** المتصفح يستدعي Supabase مباشرة (119 دالة PL/pgSQL: 61 قديمة، 52 جديدة في `sql/10–20`، و6 ناقصة)،
  والبريد 4 Edge Functions + Resend، والجدولة pg_cron. 12 جدولاً جديداً عندهم.
- تقريرهم: 25 شريحة/صفحة، 10 تبويبات تطبيق، 24 بطاقة إعدادات، 10 مستندات رسمية، مساعد AI، استيراد Excel، تنبيهات V142،
  إعدادات مرقّمة V152، طبقة مصر V171. عيوبهم المعترف بها: بريد غير مجرّب، 33 ملف مكرر، جرس كل 3 ثوانٍ، خصومات يدوية،
  خط ARIBA Two يحتاج تثبيت. وقالوا إنهم لن يرسلوا تحديثات أخرى.

#### 8.2 القرار
- نظامنا هو الأساس (التقنية، المخطط الموحّد، البيانات، طريقة العمل)، ونأخذ **كل** ميزاتهم وشاشاتهم ومعادلاتهم، بدون
  طريقتهم التقنية (لا استدعاء قاعدة من المتصفح، لا حسابات نهائية في المتصفح، لا PWA).
- ملف المقارنة الملوّن (188 صفاً: 🟢 81، 🟠 30، 🔴 24، 🔵 42، 🟣 11): 🟢 يبقى، 🟠/🔴 يتغيّر ليطابق معادلتهم بالضبط،
  🟣 يُحذف بلا استثناء، 🔵 يُضاف.

#### 8.3 القرارات المعتمدة
1. الصفان 113 و142 لا يُحذفان بل يطابقان تطبيقهم: «رصيد نهاية العام» و«عن بعد المتبقي» (+ حقل «حد العمل عن بعد»).
2. الصف 66: يُحذف الإنهاء التلقائي عند انتهاء العقد، ويُضاف: حفظ موظف منتهٍ عقده المحدد لم ينتهِ يعيد تفعيله + زر
   «إعادة تفعيل».
3. ما يحفظونه في المتصفح ينتقل للخادم (`ariba_app_settings`): القوائم الرئيسية، قوالب التقارير، عدّاد شهادة الراتب،
   مكان إصدار الهوية. التوقيع يبقى في جهاز الموظف فقط.
4. رصيد الإجازات في التطبيق وأرصدة فريق المدير يحسبها الخادم بنفس المحرك، بلا لقطات.
5. كلمات مرور البريد مشفّرة AES-GCM بالمفتاح `MAIL_SECRET_KEY`.
6. البريد: SMTP وResend وMicrosoft Graph مع مرفقات PDF.
7. الحسابات على الخادم (أو `lib/calc` للعرض الفوري)، ونتيجة الخادم نهائية بمعادلتهم.
8. خصم بدون راتب والسلفة يبقى يدوياً كما عندهم.
9. لا تُنقل عيوبهم: سجل التعديلات من المتصفح، جرس كل 3 ثوانٍ، `sw.js`، الإعدادات المكتوبة في الكود.

#### 8.4 المهام
| المهمة | ما تم |
|---|---|
| 0 | قراءة المراجع (`task0_reading_notes.md`) |
| 1 | الخطة `PORT_PLAN.md` (`14b7983`) |
| 2 | أداة `tools/react-parity` (`2c5f71b`): خط الأساس 21 مجموعة، 81,615 حالة، 29,391 فيها فرق |
| 3 | معادلاتنا = نتائجهم (`8db0266`، `ffc63d8`): 0 فرق، 111/111 صفاً؛ pytest +7 |
| 4 | حذف 🟣 (`91436f9`): الصفوف 66، 70/82، 72، 100، 114، 137، 153، 188، وتصحيحات A–K؛ اختبارات `test_port_removed.py` |
| 5 | ترحيل `001_react_port.sql` + `verify_001.sql` + `run_on_railway.sh` + `tools/dev-db` (`69d5063`) |
| 6 | مسارات الخادم لكل ميزاتهم + المهام المجدولة + WebAuthn + Push (`8ff583c`) |
| 7 + 9 | الموقع = شاشاتهم + `/apply` (`5deaa1c`) |
| 8 | تطبيق Expo (`3fb1487`) |
| 10 | التحقق: التقرير (`339ccf9`)، السيناريو 50/50 (`837cbeb`)، ثم الترحيل الفعلي والنشر (18 أكتوبر مساءً) |
| 11 | النشر بعد «انشر» |

#### 8.5 الدوال الست الناقصة وبدائلها
1. توفّر الفريق → `GET /team/availability` (دمج الإجازات المتتالية، «إجازة قريبة» خلال 14 يوماً، «يعود» أول يوم عمل).
2. المهام والاجتماعات → `/tasks` (تحذير لو المدعو في إجازة؛ تم/قبول/اعتذار بسبب/إلغاء).
3. دوام رمضان المرن → `PUT /settings/attendance/ramadan`.
4. الهوية → `GET /public/brand`.
5. استرجاع كلمة المرور → `POST /auth/password-recovery` (كلمة مؤقتة على البريد المسجّل؛ القديمة تبقى حتى تُستخدم المؤقتة).
6. ألوان الهوية من موقع الشركة → `POST /settings/brand/extract` (عناوين عامة فقط).

#### 8.6 الانحرافات عن الخطة
| البند | الخطة | ما تم | السبب |
|---|---|---|---|
| المساعد AI | نقل `aiParse.js` للخادم | بقي ملفهم في المتصفح | تحليل نص فقط وكل إجراء يمر بمسار محمي |
| قائمة سجل التعديلات | `GET /audit` | `POST /audit/list` | الفلاتر في جسم الطلب |
| مكتبة PDF | jspdf 2.5.2 | jspdf 4.2.1 | نسختهم تسحب dompurify فيه ثغرات |
| توقيع المدير في التطبيق | تبويب الموافقات | تبويب المستندات | نفس السلوك |
| مواقع العمل والتفويض | شاشات مستقلة | بطاقات داخل «ملفي» و«الإجازات» | كما عندهم |
| شاشات الموقع | إعادة بناء كل شاشة | نسخ شاشاتهم كما هي | تطابق حرفي |
| المهام | جدول `ariba_task_assignees` | `ariba_tasks` صف لكل مستلم | أبسط |

---

### 9. قاعدة البيانات عبر كل المراحل

#### 9.1 عصر ORM (4–6 أكتوبر، لم يعد مستخدماً)
- 25 جدولاً و27 enum بـ Alembic (0001–0008)، مفاتيح UUID، أموال `Numeric(12,2)`، RLS مفعّل بلا سياسات.

#### 9.2 العصر القانوني (canonical، من 8 أكتوبر)
- مخطط Supabase الأصلي: `employee_directory` + حقل `data` JSONB، `workflow_requests`، `employee_payrolls`، وغيرها.
- مشاكل التصدير: بلا PK/FK/فهارس، صفوف مكررة في 10 جداول، 3 معرّفات للموظف لا تتفق.

#### 9.3 المخطط الموحّد (Normalization، 13 أكتوبر)
- جداول مرجعية: `employers`، `departments`، `job_titles`، `roles` (8)، `workflow_stages`، `leave_types`،
  `permission_types`، `document_types`، `workflow_request_types`.
- `employee_directory`: مفاتيح أجنبية للجهة والقسم والمسمى، `manager_id` مع منع أن يكون الموظف مدير نفسه، و`data`
  JSONB للحقول القديمة. اسم المستخدم في `ariba_auth_accounts` فقط.
- `workflow_requests.status` عمود محسوب من `current_stage` (completed → approved، rejected → rejected، غير ذلك pending).
- `workflow_approvers` (hr = 40، ceo = 86)، `workflow_actions` بالحساب المنفّذ، `workflow_notifications.read_at`.
- `leave_requests` (عرض توافق `leave_requests_v`)، `permissions`، `attendance` (جلسة واحدة مفتوحة لكل موظف/يوم)،
  `payroll_periods` (اعتماد الشهر)، `payroll_components`/`payroll_lines` (فارغة).
- `ops`: نسخ احتياطية داخلية (`orphan_payrolls_backup`، `employee_payrolls_approval_backup`، جداول قديمة).
- السكربتات: `railway_prep.sql` (إرجاع المفاتيح الضائعة، مواءمة الاعتماد)، `preflight_checks.sql`،
  `pre_migration_fixes.sql`، `ariba_normalization.sql`، `run_on_railway.sh`.

#### 9.4 ترحيل نظامهم `001_react_port.sql` (18 أكتوبر)
- مخطط فقط، معاملة واحدة، `IF NOT EXISTS` (آمن مرتين)، لا يغيّر بيانات.
- أنواع طلبات جديدة: unpaid، salary_advance، iban_change، profile_edit، document (+ overtime، forgot_punch)؛ نوع إجازة
  unpaid؛ أنواع مستندات (cv، id، passport، certificate، experience، national_address، insurance، photo، other،
  iban_letter، iban_certificate، signed_document، employee_upload، identity، degree، social_insurance، contract،
  profile_edit، graduation).
- أعمدة جديدة: `workflow_requests` (submitted_by_employee_id، escalated_from، escalated_at، returned_at، return_note)،
  `workflow_notifications` (emailed_at، email_error، email_tries، pushed_at — والقديمة تُعلَّم مُرسلة)، `payroll_periods`
  (prepared_at/by، prepare_note، approved_by، reopened_at/by، reopen_reason).
- 14 جدولاً جديداً: `ariba_delegations`، `ariba_manager_perms`، `ariba_candidates`، `ariba_candidate_files`،
  `ariba_candidate_invites`، `ariba_targets`، `ariba_evaluations`، `ariba_doc_signing`، `ariba_leave_files` (≤ 13 ميجا)،
  `ariba_mail_accounts` (كلمة المرور مشفّرة)، `ariba_mail_log`، `ariba_tasks`، `ariba_webauthn_credentials`،
  `ariba_push_tokens`.
- إعدادات: `workflow_config`، `doc_sign_cfg`، `apply_invite_only` = false، `apply_invite_hours` = 72.
- `verify_001.sql`: الجداول الـ14، الأعمدة الـ11، أنواع الطلبات الخمسة، `workflow_config`، ≥ 20 مفتاحاً أجنبياً.
- **نُفّذ على الديمو والإنتاج يوم 18 أكتوبر** بنجاح (§4.10).

#### 9.5 تصحيحات بيانات في الإنتاج بعد النشر
- 19 أكتوبر: 7 موظفين رقم إقامتهم محفوظ كرقم → تحويله لنص (الإنتاج والديمو).
- المدير المباشر غير معبّأ في بياناتنا (يتولاه زميل المالك).

#### 9.6 مشكلة معروفة: المعرّفات الطويلة
- 81 موظفاً (1 نشط، 80 منتهٍ) معرّفهم مثل `XLS-62d422dece6b` من استيراد Excel قديم؛ 78 لهم رقم حقيقي في `data.empNo`،
  و3 منتهون بدون رقم؛ 4 حسابات بأسماء `EMPXLS-…`. لم تُعالج.

---

### 10. الخادم (Backend) ومساراته

- كل المسارات تحت `/api/v1`. الأساس في `canonical.py`، وميزات نظامهم في `port_*.py`، ودوالهم تُترجم في الموقع عبر
  `lib/api.js` (اسم RPC → مسار REST).
- **سير الطلبات:** `/me/requests` (الأنواع الجديدة + مرفق)، `/me/team/{id}/requests` (بالنيابة)، `/me/delegation`،
  `/me/manager-perms`، `/settings/manager-perms`، `/me/approvals`، `/requests/{id}/approve|reject|override|final-approve|return`،
  `/requests/escalate`، `/settings/workflow`، `/staff/queue`، `/staff/requests`، `/messages`.
- **المرشحون:** `/candidates` (+ accept/reject/files/by-ref)، `/candidates/invites`، `/candidates/apply-key/rotate`،
  `/candidates/apply-mode`، العامة `/public/apply?k=` و`/public/apply/invite/{token}` (فخ للروبوتات، حدود معدّل).
- **المستهدفات والتقييم:** `/targets`، `/evaluations`، `/evaluations/{id}/approve`، `/me/goals`.
- **المستندات والتوقيع:** `/me/letters` (+ stage منذ 20 أكتوبر)، `/me/letters/{id}/sign`، `/me/letters/{id}/respond`،
  `/me/sign/states`، `/me/sign/pending`، `/me/sign/{id}`، `/settings/doc-sign`، `/letters/{id}/html` (النسخة الموقّعة أولاً)،
  `/staff/templates`، `/documents/{id}/content`، `/leave-files`.
- **البريد:** `/mail/{scope}` (mine/company)، `/mail/test`، `/mail/send-document`، `/mail/send-report`.
- **المهام والفريق:** `/tasks`، `/tasks/{id}/update`، `/team/availability`.
- **الأصول:** `/assets`، `/assets/{id}/custody`.
- **سجل التعديلات:** `/audit/list`، `/audit/purge` (حذف شهر أقدم من 30 يوماً بموافقة المالية).
- **الإعدادات:** `/settings/kv/{key}`، `/settings/permissions`، `/settings/roles`، `/settings/attendance` (+ رمضان)،
  `/public/brand`، `/settings/brand/extract`، `/auth/password-recovery`، `/auth/users/default-passwords`.
- **المسيّر:** `/staff/payroll/{y}/{m}`، `/sheets/{key}/prepare|unapprove`، `/payroll-archive`.
- **الدخول المتقدم:** WebAuthn (`/auth/webauthn/*`)، `/me/push-token`.
- **مسارات `port_staff`** بأشكال بياناتهم: الإجازات، العطل، المواقع، الحضور، العمل الإضافي، الوثائق، النماذج، إعادة
  كلمة المرور، إنهاء الخدمة، المسيّر، الجرس، إعدادات الحضور، صلاحياتي.
- **المهام المجدولة** (`scheduler.py`، أقفال advisory): التصعيد كل ساعة، البريد والإشعارات كل 5 دقائق، تسجيل المرشحين
  كل دقيقة. تعمل بـ `SCHEDULER_ENABLED=1`.
- **إعدادات البريد:** SMTP من الإعدادات، Microsoft Graph عبر `M365_TENANT_ID`/`M365_CLIENT_ID`/`M365_CLIENT_SECRET`،
  Resend عبر `RESEND_API_KEY`/`EMAIL_FROM`؛ `MAIL_DISABLED=1` يمنع أي اتصال.

---

### 11. الموقع (لوحة الموارد البشرية)

#### 11.1 طريقة النقل
- نُسخ `ARIBA_HR_React/src` حرفياً إلى `frontend/hr-web/src/port`؛ كل صفحة في البوابة تعرض شاشتهم داخل تخطيطهم ومخزنهم
  وحارس الصلاحيات. `/login` شاشتهم، `/apply` نموذج التقديم العام.
- الملفات المعدّلة فقط مذكورة في `src/port/ADAPTED.md`:
  - **مكتوبة للنقل:** `router.jsx`، `next/PortApp.jsx`، `next/LoginApp.jsx`، `next/Shell.jsx`، `next/page.jsx`.
  - **النقل لخادمنا:** `lib/api.js`، `lib/auth.js`، `lib/config.js`، `lib/vault.js` (WebAuthn)، `apply/ApplyApp.jsx`.
  - **ما انتقل للخادم:** `lib/audit.js`، `lib/leaveSnapshots.js`، `lib/masterLists.js`، `CustomReport.jsx`، `salaryCert.js`،
    `lib/candidates.js`، `CandAuto.jsx`، `HrBell.jsx` (كل 20 ثانية)، `lib/arLetterhead.js`، `engines/*` (تعيد تصدير
    `lib/calc`).
  - **إعداد البناء:** `lib/ico-runtime.js` (الإيموجي → أيقونات، مربوط في `next.config.ts` عبر `next/ico/*`).
  - **شكلنا على شاشاتهم:** `Dashboard.jsx` + `styles/ariba-ours.css` (الحدود الخضراء، الأيقونات، صور الشخصيات، الأعمدة،
    ألوان الرسوم)، `Layout.jsx` (الشعار)، `next/palette.js` + `BrandCard.jsx` (لوحة الألوان الأربعة)، `next/latn.js`
    (الأرقام الإنجليزية)، طبقات القائمة الجانبية وخانات الاختيار، عرض النماذج بعنوانها ومرحلتها في
    `Pending.jsx`/`AllRequests.jsx`/`forms/index.jsx`.
- مكوّنات الموقع القديمة (`components/hr/*`، `lib/sheets.ts` …) لم تُحذف لكن البوابة لم تعد تستخدمها.

#### 11.2 الشاشات (26)
لوحة التحكم، الموظفون (+ جديد، + ملف موظف)، المرشحون، المستهدفات، التقييم، الحضور، مواقع البصمة، الإجازات والطلبات،
توفّر الفريق والمهام، مسيّر الرواتب، حاسبة التأمينات، حاسبة الراتب، حاسبة الضريبة، ملف تحويل الرواتب (WPS)، تقرير
المخصصات، الأصول والعهد، كشف الراتب، نهاية الخدمة، المخالصة، الوثائق، التقارير، الإعدادات (9 أقسام)، سجل التعديلات،
النماذج.

---

### 12. تطبيق الموظف (الجوال)

- **الإجازات:** بدون راتب وسلفة (سبب إلزامي)، مرفق اختياري، مسار الموافقة، العطل القادمة، تفويض المدير، ملاحظات
  التقديم بالنيابة والتصعيد والإرجاع.
- **ملفي:** طلب تعديل البيانات، تغيير الآيبان (خطاب رسمي + توقيع + شهادة)، رفع مستند، مستنداتي، الأرصدة.
- **المستندات:** موافقة مع التوقيع (يبقى في الجهاز فقط)، موافقة بدون توقيع، رفض بسبب، توقيع المدير على مستندات فريقه؛
  منذ 20 أكتوبر: الأزرار فقط وقت انتظار الموظف، ثم «🕓 بانتظار اعتماد الموارد البشرية».
- **فريقي (للمدير):** ما يسمح به HR، طلبات الفريق، التقديم بالنيابة، المستهدفات والتقييم، المهام والاجتماعات والتوفّر.
- **تبويب «أهدافي وتقييمي».**
- **الدخول:** تذكرني، Face ID/البصمة، نسيان الجهاز، نسيت كلمة المرور؛ تسجيل Push؛ ألوان الشركة من الخادم؛ قسيمة PDF.
- **إصلاحات 20 أكتوبر:** مزوّد البيانات في الجذر، قراءة الملفات من الجهاز، لوحة التوقيع، بطاقة الملف، لوحة الألوان،
  الأرقام الإنجليزية.
- **التشغيل:** Expo Go عبر `npx expo start --tunnel` (لا يوجد بناء دائم TestFlight/APK بعد؛ الإشعارات الحقيقية تحتاج
  بناء EAS و`extra.eas.projectId`).

---

### 13. الأدوار والصلاحيات والأمان

#### 13.1 الأدوار
- admin، admin_manager، hr، ceo، finance، manager، employee (+ chairman في البيانات القديمة). admin وchairman صلاحيات كاملة.
- **مصفوفة الصلاحيات** (من نظامهم): 19 وحدة × 7 أدوار، تُدار من الإعدادات (`/settings/permissions`)، ويقرأها الموقع من
  `GET /me/perms`، ويفرضها الخادم في كل مسار (`port_common.can/require`).
- **صلاحيات المدير المباشر** (`ariba_manager_perms`، 10 مفاتيح): عرض الفريق وبياناته ورواتبه وإجازاته وطلباته وحضوره،
  التقديم بالنيابة، الاعتماد، المستهدفات، التقييم (الافتراضي: الاعتماد والمستهدفات والتقييم).
- المالية: المسيّر والكشف ونهاية الخدمة والمخالصة، واعتماد المسيّر وحذف شهر من السجل.

#### 13.2 الأمان
- JWT موقّع بـ `JWT_SECRET`، الجلسات في `ariba_sessions`، bcrypt → Argon2 تلقائياً.
- **بعد النقل:** رمز ساعة يتجدد مع النشاط حتى 24 ساعة من الدخول، وخروج عند الخمول 5 + 3 دقائق في الواجهة.
- **أُلغي قفل الدخول بعد المحاولات الفاشلة** (الصف 188؛ الفشل دائماً 401 ويُسجَّل فقط).
- استرجاع كلمة المرور: كلمة مؤقتة على البريد المسجّل (مخزّنة `temp:`+sha256)، القديمة تبقى حتى تُستخدم.
- **WebAuthn** (البصمة/Face ID في الموقع): حالة موقّعة صالحة 5 دقائق، عدّاد التوقيع يمنع الإعادة.
- البصمة في التطبيق: نسخة من رمز التجديد في Keychain خلف التحقق الحيوي؛ «تسجيل الخروج» مع البصمة لا يلغي جلسة الخادم
  (حتى 24 ساعة)، و«نسيان هذا الجهاز» يحذف كل شيء.
- كلمات مرور البريد AES-GCM بـ `MAIL_SECRET_KEY` (لا تُغيَّر بعد الحفظ وإلا لا تُفك).
- استخراج ألوان الهوية: عناوين عامة فقط مع التحقق من كل تحويل (الاسم يُحلّ مرتين؛ مقبول لأنه للمسؤولين فقط).
- رؤوس أمان الموقع: CSP مع `connect-src` على عنوان الخادم فقط، `X-Frame-Options: DENY`، `nosniff`، Referrer-Policy،
  Permissions-Policy.
- سجل التعديلات يكتبه الخادم (فروق الحقول حقلاً حقلاً، تعديلات المسيّر، الإعدادات) — لا طابور من المتصفح.
- الملفات الحساسة (نسخ قواعد البيانات) على جهاز المالك فقط، ولا تُرفع أبداً.

#### 13.3 سؤال مفتوح
- **الموظف المنتهية خدمته ما زال يستطيع الدخول** (نفس سلوكنا قبل النقل؛ دالتهم لإنهاء الخدمة ليست في المرجع)، بانتظار قرار
  المالك.

---

### 14. البيئات والروابط والمتغيرات والنشر

| | الإنتاج (بيانات حقيقية) | الديمو (الرواتب 1000) |
|---|---|---|
| الموقع | https://frontend-production-f9a8a.up.railway.app | https://frontend-demo-b5ec.up.railway.app |
| الخادم | https://hrariba-production.up.railway.app | https://hrariba-demo.up.railway.app |
| قاعدة البيانات | `Postgres-Q6OM` | `Postgres-Q6OM` (نسخة الديمو) |

- خدمات كل بيئة: `HR_ARIBA` (الخادم)، `frontend`، `Postgres-Q6OM`، `Postgres` (قديمة بلا لمس).
- **متغيرات الخادم:** `DATABASE_URL` (`${{Postgres-Q6OM.DATABASE_URL}}`)، `JWT_SECRET`، `CORS_ORIGINS`،
  `RUN_MIGRATIONS_ON_STARTUP=false`، `ENV=production`، **ومنذ 18 أكتوبر:** `MAIL_SECRET_KEY`، `SCHEDULER_ENABLED=1`،
  وفي الديمو `MAIL_DISABLED=1` و`PUSH_DISABLED=1`. متاحة عند الحاجة: `RESEND_API_KEY`، `EMAIL_FROM`، `M365_TENANT_ID`،
  `M365_CLIENT_ID`، `M365_CLIENT_SECRET`، `WEBAUTHN_RP_ID`، `WEBAUTHN_ORIGINS` (كلها موثّقة في `backend/.env.example`).
- **متغيرات الموقع:** `NEXT_PUBLIC_API_URL` (يُقرأ وقت البناء).
- **التطبيق:** `EXPO_PUBLIC_API_URL` (الافتراضي الإنتاج).
- **النشر:** الرفع على `main` ينشر البيئتين. قبل أي تغيير في القاعدة: الترحيل أولاً ثم الدمج (الخادم يرفض الإقلاع بدون
  الجداول).
- **التكلفة التقريبية** (بأسعار Railway المعروفة): ~0.3–0.5 دولار يومياً للخدمات الثمان، ~10–15 دولار شهرياً؛ الرصيد
  التجريبي كان «9 days or $2.46 left» ويحتاج ترقية الخطة. خطة Pro مطلوبة أيضاً لفتح SMTP.
- **أوامر مفيدة** (من مجلد مربوط بـ `railway link`): `railway variables --service HR_ARIBA --environment <env> --set "K=V"`،
  `railway down`/`railway redeploy --service <svc>`، و`railway ssh -s Postgres-Q6OM -e <env> -- psql -U postgres -d railway -c "…"`.

---

### 15. النسخ الاحتياطية ونقاط التراجع

| النقطة | المحتوى |
|---|---|
| `archive/before-reset` + الفرع `feat/foundation` | المستودع قبل إعادة البناء (4 أكتوبر) |
| `before-normalization` (وسم على `ad8ee40`) + `~/Desktop/HR/backups/before-normalization/` | الكود + نسخ قاعدتي الإنتاج والديمو + المتغيرات قبل 13 أكتوبر |
| `~/Desktop/HR/backups/before-migration-2026-10-13/` | نسخ القاعدتين قبل التوحيد مباشرة |
| `~/Desktop/HR/backups/before-react-port/` | نسخ القاعدتين قبل ترحيل 001 (18 أكتوبر، 19 ميجا لكل واحدة) |
| فرع `backup/قبل-الدمج` | `main` قبل دمج نقل نظامهم (`494998d`) |
| `ops.*` داخل القاعدة | صفوف المسيّر اليتيمة، أعلام الاعتماد القديمة، جداول قديمة |
- **التراجع = الكود والقاعدة معاً:** الكود بالرجوع للفرع/الوسم ثم الرفع؛ القاعدة باستعادة النسخة في قاعدة **جديدة** وتوجيه
  `DATABASE_URL` إليها. ترحيل 001 أضاف جداول وأعمدة فقط، فالكود القديم يعمل غالباً على القاعدة الجديدة.
- مجلدات النسخ فيها **بيانات حقيقية**: للمالك فقط.

---

### 16. الاختبارات وأدوات المطابقة ونتائجها

| الفحص | النتيجة الأخيرة (20 أكتوبر) |
|---|---|
| pytest (`backend`، مع `LEGACY_PARITY_PG`) | **108 نجح**، 2 متخطّى (واحد يحتاج نسخة canonical، وواحد استُبدل بالقرار 4) |
| `tools/react-parity` | 21 مجموعة، **81,428 حالة، 0 فرق**، 111/111 صفاً |
| `tools/legacy-parity` | كل المجموعات مطابقة (يشغّل HTML القديم بدون تصحيحات) |
| الموقع `tsc` / `eslint` / `next build` | نجح / 0 أخطاء (تحذير قديم واحد) / نجح |
| التطبيق `tsc` | نجح |
| السيناريو الكامل `tools/dev-db/scenario.py` | **50/50** |
| زحف الشاشات (Chromium) | كل الشاشات بلا أخطاء لحسابات HR والمدير والمالية؛ 0 أرقام عربية في 24 شاشة |
| التطبيق على المتصفح (Expo web) | تعديل البيانات وتغيير الآيبان ورفع المستند والمستندات تفتح بلا أخطاء |

- **react-parity:** يقارن معادلاتهم (نسخة مرجعية في `tools/react-parity/reference`) بمعادلاتنا (TypeScript في الموقع
  وPython في الخادم) على حالات مولّدة بساعة مجمّدة (2026-10-18 10:00 الرياض). خط الأساس قبل التعديل: 29,391 حالة فرق،
  وكشف خطأين عندنا (insSystem «new» و«exempt» في صفحة المسيّر).
- **legacy-parity:** Node + jsdom ضد HTML القديم (PAYX، المخالصة، نهاية الخدمة، التفقيط، الإعفاء، تقارير الحضور).
- **السيناريو:** موظف جديد بكلمة مؤقتة ← بصمة دخول/خروج (وخارج النطاق مرفوضة) ← كل أنواع الطلبات بمراحلها وتطبيق
  نتائجها ← رفض بلا سبب مرفوض ← التصعيد ← المسيّر (حفظ/تجهيز/اعتماد/قسيمة) ← مرشح مقبول ← مستهدف وتقييم ← البريد ←
  إنهاء الخدمة ونهاية الخدمة.
- **اختبار مسار المستندات** (20 أكتوبر، `test_form_flow_sign_then_hr_approves`): إرسال ← توقيع ← معلّق عند HR مع النسخة
  الموقّعة ← اعتماد ← كل الطلبات والأرشيف؛ والموافقة بدون توقيع؛ والاعتراض.
- **قاعدة اختبار محلية:** `tools/dev-db/build.sh` يبني قاعدة من المخطط ببيانات اصطناعية وحسابات `*.test`.

---

### 17. سجل الـ commits كاملاً (الفرع `main`)

> النسخة المحلية من المستودع تبدأ من 5 أكتوبر؛ ما قبلها محفوظ في `archive/before-reset`.

| commit | التاريخ | الوصف |
|---|---|---|
| `782616e` | 2026-10-05 | Payslip page (V60 rSlip + V69 official print) from approved payroll sheets |
| `32339b9` | 2026-10-05 | Locations: backend CRUD (V38 1000m radius, remote) + HR page |
| `efc07d3` | 2026-10-05 | Attendance: backend manual records + summary, HR page (day list, manual entry, monthly) |
| `b03d014` | 2026-10-05 | Leave ledger engine: port of legacy 02/03 (verified against the legacy JS output) |
| `abd4f3b` | 2026-10-05 | Leave APIs: holidays, requests (HR record, approve / on-behalf / final / reject / delete), balances + year editor |
| `0085b8b` | 2026-10-05 | Leaves page: pending, all requests, new request, balances + year editor, official holidays, overtime |
| `e93e943` | 2026-10-05 | Documents page (V60 loadDocs: iqama, passports, medical insurance, contracts) + GET /registry/documents |
| `435879f` | 2026-10-05 | Reports page: the 9 legacy reports (final patched versions) + report figures on /salary/basis and leave balances |
| `0e013a0` | 2026-10-05 | Settings APIs: company, attendance/flexible hours, GOSI periods, departments/workplaces, accounts, payroll exclusion |
| `afd85a9` | 2026-10-05 | Settings page: company + attendance, logo, departments/workplaces, GOSI periods, flexible hours, roles, passwords, payroll exclusion, HR signer |
| `9e97bc8` | 2026-10-05 | Letters: send forms to employees, status, employee approve/object (migration 0006) |
| `4e997a0` | 2026-10-05 | Forms page: 9 letterhead forms (V70/V114/V117) with HR signer, print + send to employee, sent-forms status |
| `50f2998` | 2026-10-05 | Fetch all employee pages (API caps page_size at 100) on attendance, leaves, settings, forms, settlement |
| `8796992` | 2026-10-06 | Schema cleanup (0007): attendance sessions, payroll and leave in linked tables, cascade request steps, drop unused tables |
| `b691f3f` | 2026-10-06 | Payroll «ما تم استحقاقه»: leave taken up to the end date from the leave engine (legacy usedThrough) |
| `12f2a9c` | 2026-10-06 | Attendance: V117 reports (sessions grouping, day classes, filters, summary/detail, print, export) + /attendance/range |
| `e731ac6` | 2026-10-06 | Settlement: official settlement document with amount in words (clean tafqeet, same results) |
| `ccbe966` | 2026-10-06 | Payroll: approved payroll archive (legacy V53) + /payroll-archive |
| `c7a268b` | 2026-10-06 | Forms: send a form to several employees at once (legacy V117 bulk send) |
| `5ac4b22` | 2026-10-06 | Forms: English versions (V117) attached when sending; salary certificate language choice |
| `cd5e76b` | 2026-10-06 | Settings: show signature / show stamp, delete selected signature, refresh accounts |
| `cd0e941` | 2026-10-06 | Locations: per-employee work locations (V121, migration 0008) + linked employees list, page title |
| `0c4e305` | 2026-10-06 | Leaves: optional request attachment (PDF/Word/image, 12 MB) for leave and overtime |
| `53615a5` | 2026-10-06 | Contract end −1 day (legacy addMonthsSafe), auto-terminate/reactivate fixed-term contracts, dashboard gender by names, USD default 3.755 |
| `8b3a3f9` | 2026-10-06 | Payroll «بدون خصم» insurance toggle; wording aligned with legacy (attendance, forms) |
| `94785dc` | 2026-10-06 | docs: full handoff summary |
| `46c6ae5` | 2026-10-06 | Employee app: GPS punch (server geofence, flexible hours, multi-session) + attendance tab; app defaults to deployed backend |
| `0d0caa9` | 2026-10-06 | Employee app: my requests (all types + forgot punch), leave balance, team and approvals; approved forgot punch writes attendance |
| `1df0d25` | 2026-10-06 | Employee app: forms (view + approve/object), payslips from approved payrolls, notifications bell |
| `1ea0d8a` | 2026-10-06 | docs: quick usage guide for the HR site and employee app |
| `d32f890` | 2026-10-08 | docs: canonical DB integration audit and plan (phase A+B, no code changes) |
| `d5cd4e3` | 2026-10-08 | Use the canonical Supabase schema/data as the database; keep the verified calculation logic |
| `39616b4` | 2026-10-08 | docs: handoff — canonical database on Railway |
| `8b46326` | 2026-10-08 | tools: create a login in ariba_auth_accounts with a one-time temporary password |
| `6f89af9` | 2026-10-08 | Employee app: legacy look and flow (V118 shell, punch dial, all tabs) on the canonical backend |
| `673ddb1` | 2026-10-11 | UI: replace emoji icons with Tabler line icons; ARIBA brand colours |
| `9a345ee` | 2026-10-11 | UI: every removed emoji now has an icon; formal gender avatars and tamheer cap |
| `487fbaa` | 2026-10-11 | Unified date/time picker (site + app), Requests & leaves page, forgot-punch notice |
| `8ee52fc` | 2026-10-11 | Dashboard: KPI icons, readable payroll total, same-colour gender avatars, department bars |
| `fe9c836` | 2026-10-11 | Header «تحديث البيانات» reloads every page |
| `d1d6699` | 2026-10-11 | Employee save recomputes stored GOSI/net (legacy sEmp), add-employee returns to list, clearer required-field message; app keyboard; docs |
| `2dea04d` | 2026-10-11 | Employees list: «كل جهات العمل» filter works (workplace_id was ignored by the API) |
| `0f85a93` | 2026-10-11 | Legacy parity: leave/app balance, approvals, notifications, punch, labour-law corrections, parity tests |
| `683982d` | 2026-10-12 | Docs: files and photos live in the database (ariba_documents), same in demo |
| `c24e6d6` | 2026-10-12 | Remove open notes and known debts section |
| `1d2bbed` | 2026-10-12 | Dashboard: dark green border on every KPI tile |
| `ad8ee40` | 2026-10-13 | Fix HR delete request: missing parenthesis in the archive snapshot SQL (+ regression test) |
| `dbbee54` | 2026-10-13 | Bring in the colleague's schema normalization (Dalteam/HR_ARIBA 8e5716a) |
| `1ba1a42` | 2026-10-13 | db-normalization: script that backs up and migrates one Railway environment |
| `494998d` | 2026-10-14 | Docs: PROJECT_GUIDE up to date (normalization merge and migration), English + Arabic |
| `14b7983` | 2026-10-18 | Port plan: every comparison row, screen and RPC mapped to our stack |
| `2c5f71b` | 2026-10-18 | tools/react-parity: their React formulas vs ours on seeded cases, tied to the comparison file |
| `8db0266` | 2026-10-18 | Port their leave engine, GOSI auto table and employee figures to the backend; their engines copied to the site |
| `abdcf3d` | 2026-10-18 | Cloud handoff: their React project (read-only reference), port context docs, schema-only dump |
| `ffc63d8` | 2026-10-18 | Task 3: our formulas now give their React results (react-parity 0 differences) |
| `91436f9` | 2026-10-18 | Task 4: remove the rules only we had (purple rows) |
| `69d5063` | 2026-10-18 | Task 5: schema migration for the ported features, run/verify script, local test database |
| `8ff583c` | 2026-10-18 | Task 6: server routes for their RPCs, with integration tests |
| `5deaa1c` | 2026-10-18 | Tasks 7 and 9: the HR site is their React screens, plus the public apply page |
| `3fb1487` | 2026-10-18 | Task 8: their employee-app features in the Expo app (typecheck only) |
| `339ccf9` | 2026-10-18 | Port verification report: what was done, what was checked here, what is left for the owner's machine |
| `837cbeb` | 2026-10-18 | Task 10: end-to-end scenario on a synthetic DB (50 checks pass) + report |
| `daabbf3` | 2026-10-19 | Site: their emoji become icons as in their build; our dashboard look and logo on their screens |
| `6fb7303` | 2026-10-19 | Site: Settings › Mail › send test goes to /mail/test (it went to send-document and asked for a PDF) |
| `e0587b2` | 2026-10-20 | Owner's review fixes (2026-10-20): app crashes, uploads, signing, form flow through HR, layout, digits, palette |

---

### 18. المشاكل المعروفة والبنود المفتوحة

1. **البريد:** Railway يمنع SMTP في الخطة الحالية؛ الحل المختار Microsoft 365 (Graph): تسجيل تطبيق في Entra +
   `Mail.Send` + موافقة مسؤول، ثم المتغيرات الثلاثة. حساب المالك بلا دور مسؤول ظاهر (قد يحتاج Global Administrator).
2. **المدير المباشر** غير معبّأ في بياناتنا (يتولاه زميل المالك)، وهو مطلوب لمرحلة المدير والفريق والتفويض والمستهدفات.
3. **Safari:** زر «إرسال إيميل للموظف» لم يُظهر شيئاً (Chrome يعمل).
4. **الموظف المنتهية خدمته يستطيع الدخول** — بانتظار قرار.
5. **البصمة في الموقع** تحتاج `WEBAUTHN_RP_ID` و`WEBAUTHN_ORIGINS` (أوامرها جاهزة بروابط الموقع).
6. **رصيد Railway** التجريبي قارب النهاية.
7. **التطبيق:** لا بناء دائم (TestFlight/APK)، والإشعارات الحقيقية تحتاج EAS؛ التوقيع بالإصبع ورفع الملفات جُرّبا في
   المتصفح وتحتاج تجربة على جهاز حقيقي.
8. **حماية في الكود** لأرقام الإقامة المحفوظة كأرقام (البيانات صُحّحت، والحماية لم تُضف).
9. **المعرّفات الطويلة** `XLS-…` (3 منتهين بلا رقم).
10. `payroll_lines` فارغ (التطبيق يقرأ `payload`).
11. لم تُقارن الشاشات جنباً إلى جنب مع نسختهم وهي تعمل، ولم يُجرَّب التطبيق على محاكي iOS.
12. 35 سؤالاً مفتوحاً قديماً لقسم الموارد البشرية في وثيقة النظام (§9 هناك).

---

### 19. تناقضات بين الوثائق القديمة والحالة الحالية

| الموضوع | الوثائق القديمة | الحالة الحالية |
|---|---|---|
| مراحل الموافقة | `BUSINESS_RULES`: الاستئذان والإضافي والمهمة تقف عند HR | منطق نظامهم: [مدير] ← HR ← [تنفيذي حسب `final_by_type`] |
| سنوات وأساس نهاية الخدمة | الأيام ÷ 365، أساسي + سكن، الثلث من 2 إلى 5 | 365.25 في الصفحة، K بـ DATEDIF في المسيّر والمخالصة، بالضبط 5 = الثلثان |
| قفل الدخول | `SECURITY.md`: 5 لكل مستخدم و20 لكل IP خلال 5 دقائق | أُلغي (الصف 188) |
| مدة الجلسة | رمز 60 دقيقة + تجديد 7 أيام | ساعة تتجدد حتى 24 ساعة + خمول 5+3 دقائق |
| نهاية العقد | انضمام + أشهر بدون −1 يوم | `addMonthsSafe` ناقص يوم |
| المخطط | `DATABASE.md`: نموذج Alembic بـ 25 جدولاً | المخطط الموحّد (`employee_directory` …) + ترحيل 001 |
| الملفات | قرص Railway | داخل القاعدة (`ariba_documents`) |
| حالة النقل في `PORT_VERIFICATION` | «لم يُدمج ولم يُنشر» | دُمج ونُشر 18 أكتوبر بعد الترحيل |

---

### 20. ملحق: الهوية والألوان

#### 20.1 لوحة الألوان المعتمدة (20 أكتوبر، من ملف هوية الشركة ARIBA_LAYOUT)
| الدور | اللون |
|---|---|
| رئيسي غامق | `#014D3D` |
| رئيسي فاتح | `#28B35D` |
| فرعي غامق | `#231F20` |
| فرعي فاتح | `#E4E4BC` |
| الأخطاء فقط | أحمر |
- الأزرق والبنفسجي والفيروزي والبرتقالي والبني في شاشاتهم تتحوّل لأقرب لون من الأربعة (`next/palette.js`)، وكذلك فئات
  الشارات والتنبيهات؛ منتقي الألوان في الإعدادات يحتفظ بألوانه الحقيقية.
- التحذيرات: فحمي نهاراً وبيج ليلاً (`--ar-warm`).

#### 20.2 عناصر أخرى
- الخط: ARIBA Two (خفيف، متوسط، عريض).
- الشعار: `/brand/ariba-logo.png` افتراضياً في القائمة الجانبية حتى يُرفع شعار من الإعدادات.
- الأيقونات: Tabler (خطية) بدل الإيموجي في كل الشاشات.
- لوحة التحكم: حدود خضراء غامقة لكل مربع، أيقونات للمؤشرات، صور شخصيات ذكر/أنثى بلون واحد، أعمدة أقسام بتدرج.
- الأرقام: إنجليزية (0–9) في الموقع والتطبيق.
