# ARIBA HR — Full Project Handoff and Next Step

> Written 2026-10-13. Last deployed commit on our repo: `ad8ee40` (tag `before-normalization`).
> Purpose: everything a new session needs, from the original idea to the last change, plus the next step (bringing the colleague's normalization into our code) with phases and rules.

---

## 0. Working rules (owner's instructions)
- Reply in **Arabic, short and direct**.
- **No push to `main` and no deploy until the owner says «انشر».** A push to `main` deploys **both** production and demo.
- **Never delete anything** (files, databases, environments, backups) unless the owner names it and asks.
- Decide the best option and execute; stop only at the checkpoints listed in section 8.
- Never type real passwords on deployed sites; test locally with test accounts.
- Never commit files containing real data (SQL dumps, logs with data). Schema-only SQL is fine.
- The reference for every screen, field, text and formula is the split legacy HTML in `frontend/legacy`, plus the legacy Supabase SQL functions (`tools/legacy-parity/sql`). Documented labour-law corrections are the only intended differences (section 3.8).

---

## 1. The idea
- **ARIBA Consulting** ran HR on **one huge HTML file**, grown through numbered updates V1 to V130. Data lived in **Supabase**, built by colleague Mohammed Awad: tables, SQL functions and calculations.
- **Goal:** rebuild it on a modern stack with **the same screens, fields, texts and formulas**:
  1. **HR website** for HR, managers and finance.
  2. **Employee mobile app** (iPhone and Android): punch, requests, salary.
  3. **One backend + database** serving both.
- **Principle:** port the logic cleanly with identical results, not copy the old code.

## 2. Tech stack
- **Backend:**
  - Python 3.12 + FastAPI + Uvicorn.
  - SQLAlchemy 2 + psycopg 3, raw SQL via `text()`.
  - Pydantic, PyJWT, Argon2/bcrypt.
  - pytest.
- **Database:** PostgreSQL 18 on Railway, service `Postgres-Q6OM`. The old service `Postgres` is kept untouched.
- **HR website:** Next.js 16, React 19, TypeScript, Chart.js, Tabler Icons, Zod, ESLint.
  - Note: this Next.js has breaking changes. Read `frontend/hr-web/AGENTS.md`; it uses `proxy.ts`, not `middleware.ts`.
- **Employee app:** Expo 57, React Native 0.86, TypeScript, Expo Router, expo-location, expo-secure-store, react-native-svg.
- **Hosting:** Railway project `sparkling-learning` with two environments (production, demo). GitHub `Faisal-Alrashed1/HR_ARIBA` (private). Push to `main` auto-deploys both.
- **Parity tooling:**
  - `backend/tests_canonical/test_legacy_parity.py`: runs the legacy SQL functions in a throw-away Postgres DB.
  - `tools/legacy-parity`: Node + jsdom, runs the legacy HTML and compares the site's formulas with it.

## 3. Timeline (every phase)

### 3.1 — 4 Oct: first version (later reset)
- Backend foundation: auth, roles, security, employees.
- Saudization, GOSI, EOS, dashboard, alerts, documents, photo, dependents.
- V114 design and first Railway deploy.

### 3.2 — 5 Oct: rebuild from the split legacy HTML
- Repo reset into `backend` + `frontend/hr-web` + `frontend/employee-app`, with the legacy HTML as reference in `frontend/legacy`.
- Ported with identical results:
  - GOSI with the V130 exemption.
  - EOS page (`rEOS`) and settlement (`sRun`).
  - Payroll engine PAYX V119: full table, manual edits, save/approve, CSV, print.
  - Payslip, work locations, attendance (manual + monthly).
  - Leave ledger engine, ported line by line.
  - Leave APIs: holidays, requests (approve / on-behalf / final / reject / delete), balances and year editor.
  - Leaves page, documents registry, the 9 reports.
  - Settings: company, attendance, flexible hours, GOSI periods, departments/workplaces, accounts, payroll exclusion, HR signer.
  - Letters/forms: 9 letterhead forms, send to the employee, employee approve/object.

### 3.3 — 6 Oct: additions and the first app
- **Web:**
  - Schema cleanup.
  - Payroll «ما تم استحقاقه» from the leave engine.
  - V117 attendance reports.
  - Official settlement document with amount in words (tafqeet).
  - Payroll archive.
  - Bulk form sending and English forms.
  - Signature/stamp options.
  - Per-employee work locations (V121).
  - Request attachments.
  - Contract end = start + duration − 1 day, with auto terminate/reactivate.
  - «بدون خصم» GOSI toggle.
- **App:**
  - GPS punch with server geofence, flexible hours and multiple sessions.
  - My requests (all types + forgot punch), balance, team, approvals.
  - Forms, payslips, notifications.

### 3.4 — 8 Oct: moved onto the colleague's database (canonical)
- The backend runs directly on the original Supabase schema (34 tables) through `backend/app/routers/canonical.py`, which holds all routes as raw SQL.
- DB service `Postgres-Q6OM`. Integration audit in `docs/INTEGRATION_AUDIT.md`.
- `backend/tools/create_account.py` creates a login with a temporary password.
- The app was restyled to the legacy V118 look.

### 3.5 — 11 Oct: demo, brand, UI
- **Demo environment:** a copy of production with all salaries set to 1000. It is a Railway setup, not a commit.
- **Brand:**
  - Tabler icons instead of emoji.
  - ARIBA colours.
  - Male/female/tamheer avatars.
- **UI:**
  - Unified date/time picker on site and app.
  - «الطلبات والإجازات» page listing all request types.
  - Forgot-punch notice on the attendance page.
  - Dashboard polish.
  - «تحديث البيانات» reloads any page.
- **Employees:**
  - Saving an employee recomputes stored GOSI and net (legacy `sEmp`).
  - Add-employee returns to the list, with a clear message for missing fields.
  - App keyboard handling.
  - «كل جهات العمل» filter fixed.

### 3.6 — 11–12 Oct: legacy parity audit and fixes (`0f85a93`)
- Audit report in `docs/LOGIC_AUDIT.md`. The legacy portal was run in jsdom and the legacy SQL functions in Postgres, then compared number by number.
- **Official documents:**
  - EOS report uses the recorded award (84/84).
  - Contract end computed on save.
  - Reactivation when the contract is renewed (V101).
- **Punch (legacy `ariba_attendance` V140):**
  - Polygons, smallest zone first.
  - A remote location only with an approved remote request for the day.
  - Late minutes at least 1, rounded half-up.
  - Tolerance 0 no longer becomes 15.
- **Dashboard:**
  - Payroll total = basic + housing + transport.
  - Gender from the field or the female-names list.
  - Tamheer from the job title.
  - Whole-number Saudization.
  - Contract alert skips indefinite contracts.
- **GOSI exemption = legacy `kindOf`** (428/428).
- **App leave balance = `ariba_leave_calc`:**
  - Year-end deducts approved leave after the snapshot.
  - A started leave counts in full.
  - The HR balances page keeps the HTML logic.
- **Requests:**
  - Every type goes manager → HR → CEO; forgot-punch goes to HR only.
  - HR is notified of every new request.
  - Notification texts as legacy.
  - HR override and final approve as legacy.
  - Forgot punch merges into the day's record.
  - An employee deleting a pending request notifies HR.
  - The annual-leave balance check on submit is **kept** (owner's choice).
- **Attendance reports:** logic moved to `frontend/hr-web/src/lib/calc/att-reports.ts`, with an added avg check-in column.
- **Payroll report:** recomputes net (total − employee GOSI − other deductions).
- **Permanent parity tests:**
  - `backend/tests_canonical/test_legacy_parity.py`.
  - `tools/legacy-parity` (`npm test`; documented corrections in `CORRECTIONS`).

### 3.7 — 12–13 Oct
- `683982d`: docs — files and photos live in the DB (`ariba_documents`), not on disk.
- `c24e6d6`: the owner removed the open-notes section from `PROJECT_GUIDE.md`.
- `1d2bbed`: dashboard — dark green (`#014D3D`) border on every KPI tile.
- `ad8ee40`: **HR delete request fixed.** A missing parenthesis in the archive SQL made it fail with HTTP 500 and the site showed «Cannot reach the server». A regression test was added.
- The owner's own DB normalization plan was **cancelled**, because the colleague did it (`~/.claude/plans/keen-cooking-thimble.md`, marked cancelled).

### 3.8 — Labour-law corrections (intended differences from legacy)
| Code | Correction |
|---|---|
| A | Art. 85 resignation: exactly 5 years = 1/3, exactly 10 = full (EOS page, payroll, settlement, backend) |
| B | EOS base = actual wage (basic + all fixed allowances) |
| C | Art. 77 on a fixed-term contract = wage of the months left (min two months) |
| D | Art. 87 full award option |
| E/F | Legal notes for HR on sick leave tiers (art. 117), marriage/death/paternity/maternity limits, hajj — notes only, nothing is rejected |
| G | Payroll GOSI on the actual housing allowance |
| H | Overtime divisor unchanged |
| I | Warning when this or next year's Eids are missing in holidays |
| J | Leave after 5 years correct for contracts above 21 days |

## 4. Environments and links
| | Production (real data) | Demo (salaries 1000) |
|---|---|---|
| Website | https://frontend-production-f9a8a.up.railway.app | https://frontend-demo-b5ec.up.railway.app |
| Backend | https://hrariba-production.up.railway.app | https://hrariba-demo.up.railway.app |
| Database | `Postgres-Q6OM` (production) | `Postgres-Q6OM` (demo copy) |

- **Services per environment:** `HR_ARIBA` (backend), `frontend`, `Postgres-Q6OM`, `Postgres` (old, untouched).
- **Railway CLI** is linked to production; add `-e demo` for demo.
- **The system is still in build stage, developers only.** Downtime of both environments during the merge is acceptable.
- **Employee app:** no permanent build yet. Run it with:
  ```
  cd frontend/employee-app && npx expo start --lan --clear
  ```
  or `--tunnel`. `frontend/employee-app/.env` points at demo.
- **GitHub CLI:** the active account must be `Faisal-Alrashed1`. The other account `FaisalAlrashed1122` cannot see the private repo.

## 5. Key files
- `backend/app/routers/canonical.py`: all API routes (raw SQL), about 2440 lines.
- `backend/app/services/`:
  - `employee_map.py`: data ↔ API fields, `figures()`.
  - `canonical_data.py`: readers for the engines.
  - `leave.py`: LeaveBook.
  - `gosi.py`, `end_of_service.py`, `contracts.py`.
- `backend/app/models.py`: table allowlist checked at startup. `backend/tests_canonical/test_canonical_contract.py` asserts it.
- `frontend/hr-web/src/lib/calc/*`: site formulas (payx, payroll, eos, settlement, att-reports, tafqeet).
- `frontend/hr-web/src/lib/*.ts` and `frontend/employee-app/src/lib/api.ts`: API types. **The frontends depend only on API JSON.**
- `docs/PROJECT_GUIDE.md` (project guide), `docs/LOGIC_AUDIT.md` (audit + decisions), this file.

## 6. Local setup and checks
- **Local Postgres (`host=/tmp`):**
  - `ariba_demo`: demo copy with test accounts `ui.check` (admin) and `ui.emp` (employee 10). Passwords are never written in files.
  - `ariba_verify`: a production copy used for comparisons.
- **Backend:**
  ```
  cd backend && DATABASE_URL='postgresql:///ariba_demo?host=/tmp' RUN_MIGRATIONS_ON_STARTUP=false ENV=development .venv/bin/uvicorn app.main:app --port 8010
  ```
- **Website:**
  ```
  cd frontend/hr-web && NEXT_PUBLIC_API_URL=http://localhost:8010/api/v1 npx next dev -p 3010
  ```
- **Checks (all must pass before any deploy):**
  - `cd backend && LEGACY_PARITY_PG='postgresql:///postgres?host=/tmp' .venv/bin/python -m pytest -q` — currently 32 passed, 1 skipped.
  - `cd tools/legacy-parity && npm ci && npm test` — all suites match, incl. «تصحيحات نظام العمل» 9/9.
  - `cd frontend/hr-web && npx tsc --noEmit && npx eslint src --quiet`
  - `cd frontend/employee-app && npx tsc --noEmit`

## 7. Rollback point `before-normalization` (taken 2026-10-13)
- **Code:** git tag `before-normalization` = `ad8ee40`, on GitHub.
- **Everything else:** `~/Desktop/HR/backups/before-normalization/`, outside the repo, owner-only permissions, **contains real data**. See its `README.txt` for restore steps.
  - Full `pg_dump` of the production and demo `Postgres-Q6OM` databases (Postgres 18.6; production 107 employees, demo 110).
  - Railway variables of `HR_ARIBA` and `frontend` in both environments.
  - Code bundle and zip.
  - `/data` volumes (empty; files are in the DB).
- **Restore rule:** code and database go back **together**.
  - Restore the DB into a **new** database and point `DATABASE_URL` at it.
  - Overwriting the existing DB only on the owner's explicit order.

---

## 8. THE NEXT STEP — bring the colleague's normalization into our code

### 8.1 What the colleague delivered
- **Repo:** https://github.com/Dalteam/HR_ARIBA (public, author Ghady Nafisah).
- **Commits:**
  - `31cb909` «Ariba HR: normalized schema, updated backend/frontend, migration scripts».
  - `8e5716a` «Remove backup file, ignore *.bak».
- **Their words:** they changed the schema and everything related to it, the CRUD operations, and the API routes. This is the final version to merge.
- **It is a separate repo with a fresh history** (its first commit has no parent). It is **not** a branch of ours.
  - Its tree equals our code from about `c24e6d6` plus their changes.
  - It does **not** contain our later commits `1d2bbed` (dashboard borders) and the regression test from `ad8ee40`. It does contain the delete-request SQL fix.
- **Fetch locally without touching `main`:**
  ```
  git fetch https://github.com/Dalteam/HR_ARIBA.git main:refs/remotes/dalteam/main
  ```
- **Their changes vs our `ad8ee40`** (`git diff --stat ad8ee40 dalteam/main`, 20 files):
  - `backend/app/routers/canonical.py` (about 600 lines): normalized SQL/CRUD/routes.
  - `backend/app/models.py`: allowlist adds `departments`, `document_types`, `employers`, `job_titles`, `leave_types`, `payroll_components`, `payroll_lines`, `payroll_periods`, `permission_types`, `roles`, `workflow_approvers`, `workflow_request_types`, `workflow_stages`; removes `ariba_backup_v106_duplicates`, `ariba_backup_v116_cleanup`, `ariba_function_backups`, `ariba_payroll_status`.
  - `backend/app/services/punch.py`: a new punch-in resets the previous closed session's early minutes. Review against legacy.
  - `backend/tests_canonical/test_canonical_contract.py` (262 lines), `test_legacy_parity.py` (21), `backend/tools/create_account.py`.
  - `frontend/employee-app`: `app/(tabs)/_layout.tsx`, `src/lib/api.ts`, `src/lib/notifications.tsx`.
  - `frontend/hr-web`: `attendance/page.tsx` (36 lines), and `dashboard/page.tsx` + `styles/hr/26-ariba-v42-requested-ui.css`. **These two revert our dark borders and must be ignored.**
  - Docs: `README.md`, `docs/PROJECT_GUIDE.md`, `docs/INTEGRATION_AUDIT.md`.
  - **New files to review:**
    - `tools/pre_migration_fixes.sql`: data fixes before migrating. It updates accounts, backfills `workflow_actions`, and creates schema `ops` with an orphan-payroll backup.
    - `aribaOldSchema.txt`.
    - `load_log.txt` (196 KB) — **check that it contains no real data before keeping anything.**
    - `backend/app/routers/canonical.py.bak` (2640 lines) — unwanted.
- **Migration SQL — now in our repo folder `docs/db-normalization/`** (received from the colleague 2026-10-13; schema only, no real data; `*.sql` is git-ignored, so add a `.gitignore` exception before committing):
  - `preflight_checks.sql`: **read-only** report (one row per check with an issue count). Run it first on the copy; every count should be 0 (or explained) before migrating.
  - `pre_migration_fixes.sql`: data fixes to run before the migration (one transaction):
    - A: detach accounts of deleted employees.
    - B: detach the duplicate accounts `Ariba-HR`/40 and `EMPXLS-62d422dece6b`.
    - C: backfill rejected actions.
    - D: back up orphan payrolls to `ops.orphan_payrolls_backup`, then delete them.
    - **E: deletes `workflow_actions` rows with `hr_override_*` stages, with no backup.** This conflicts with the owner's "never delete" rule: back those rows up (e.g. into `ops`) or map them to plain stages, and get the owner's OK.
    - F/F2: rebuild missing actions from the old `mgr_/hr_/ceo_` columns.
  - `ariba_normalization.sql`: the migration, one transaction. **It alters `public` in place** (no new schema), so rollback = restore the `before-normalization` dump (section 7). It contains safety checks that abort if the data is not clean.
    - **Lookups:** `employers`, `departments`, `job_titles`, `roles`, `workflow_stages`, `leave_types`, `permission_types`, `document_types`, `workflow_request_types`.
    - **`employee_directory`:** `employer`/`department`/`job_title` → `*_id`; drops `username`; adds a manager FK.
    - **Auth:** accounts get a role FK and `UNIQUE(employee_id)`; `ariba_sessions` drops `role`/`employee_id`.
    - **Workflow:**
      - `workflow_approvers` (hr=40, ceo=86).
      - `workflow_requests` drops `manager_id`, `hr_id`, `ceo_id`, `rejected_at`, `rejection_reason`; `status` becomes generated from `current_stage`.
      - `workflow_actions` drops `actor_employee_id`; `hr_override_*` stages become plain.
      - `workflow_notifications` drops `is_read` (`read_at` is used instead).
    - **`leave_requests`:** `emp_id`→`employee_id`, `type`→`leave_type`; per-stage columns dropped (compat view `leave_requests_v`).
    - **`attendance`:** `emp_id`→`employee_id`; drops `location_name`; one open session per employee per day.
    - **`permissions`:** renamed columns.
    - **Payroll:** `payroll_periods` holds the approval; `employee_payrolls` drops `approved*`; `payroll_components`/`payroll_lines` are created **empty (TODO in the file)**.
    - **Other:** document `file_size` generated, type FK; `work_locations.employer` → `employer_id` (NULL = all); `company_settings` drops `shift_hours`; backup tables move to schema `ops`.
    - It does **not** normalize the `employee_directory.data` JSONB.
  - **Run order:** `preflight_checks.sql` (report) → `pre_migration_fixes.sql` → `preflight_checks.sql` again (all 0) → `ariba_normalization.sql`.
  - **Open question for the colleague:** does their code read payroll from the old `payload`? The new `payroll_lines` are empty (TODO in the file).

### 8.2 Direction
**Our repo and our current code are the base.** We bring in **only what the colleague changed**: the normalized schema, the CRUD operations and the API routes (plus the migration scripts).

All our features and fixes stay exactly as they are:
- Legacy parity.
- Labour-law corrections.
- Notifications.
- Delete fix and its test.
- Dashboard borders.

### 8.3 Execution phases
1. **Identify exactly what they changed.** Diff their tree against our `ad8ee40` (and against `c24e6d6`, their apparent base) so only their changes show:
   - The new schema.
   - The CRUD operations.
   - The API routes.
   - The migration scripts.
2. **Give the owner a list before editing anything:**
   - What we will take.
   - What conflicts with our current code.
   - Open points: empty `payroll_lines`; step E of `pre_migration_fixes.sql` deletes rows without backup.
   - Which files we will not take (`.bak`, logs, the dashboard/CSS revert).
3. **Bring their changes into our code** on a new local branch (e.g. `merge-normalization`), never directly on `main`:
   - Apply the new schema queries, CRUD and routes to our current `canonical.py`, keeping every later fix of ours.
   - Update `models.py` and the contract test to the new tables.
4. **Update the website and the app** if any route's name or JSON shape changed. List every change.
5. **Run all tests and try locally:**
   - Build a local copy of production data (`ariba_verify`, or restore `db_production.sql.gz` into a new local DB).
   - Run, in order: `preflight_checks.sql` → `pre_migration_fixes.sql` → `preflight_checks.sql` (all 0) → `ariba_normalization.sql` (all in `docs/db-normalization/`).
   - Start the backend on it.
   - Run: pytest (with `LEGACY_PARITY_PG`; adapt `test_legacy_parity.py` to the new tables while keeping all comparisons), `tools/legacy-parity`, tsc/eslint for site and app.
   - Compare real figures before/after on the same data: salary total, GOSI, net, leave balances, EOS report, payroll totals, request/attendance counts, dashboard numbers.
6. **Give the owner a result summary. Deploy only on «انشر»:**
   - Fresh backups first.
   - Run the pre-migration fixes + migration on **both** databases (production and demo).
   - Merge to `main` and push (deploys both).
   - Smoke-test both: health, login, dashboard, employees, a test request, punch.
   - Rollback = section 7.

### 8.4 Checkpoints (stop and ask the owner)
- After phase 2: the list of changes and conflicts.
- After phase 5: test results and the before/after figures.
- Before phase 6: the word «انشر».

### 8.5 Risks to watch
- **Data files.** `load_log.txt` or other files in their repo may contain real data. Do not copy them into our repo.
- **Their dashboard/CSS files** revert our borders. Keep ours.
- **`punch.py` change.** It touches `services/punch.py`, which the live router may not use (the live punch is in `canonical.py`). Verify before taking it.
- **Migration order.** `pre_migration_fixes.sql` first, then schema + data migration. The code must be deployed only after both databases are migrated, otherwise the backend fails on startup (table allowlist).
- **All migration files are in `docs/db-normalization/`.** The migration's own safety checks stop it on bad data, so a trial run on a local copy is safe.
- **Deletions in `pre_migration_fixes.sql`.** D deletes orphan payrolls (backed up to `ops` first); E deletes override actions without a backup. Both need the owner's OK before running on production.
