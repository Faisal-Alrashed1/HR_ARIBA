# ARIBA HR — Project Guide, from the first seed to the latest change

> Last update: 2026-10-14. Last deployed commit: `1ba1a42` (production and demo).
> This file is **the first reference** for anyone (or any new session). The English version comes first, then the full Arabic version.

---

# English

## 0. Working rules (owner's instructions)
- Reply in **Arabic, short and direct**.
- **No push to `main` and no deploy until the owner says «انشر».** A push to `main` deploys **both** production and demo.
- **Never delete anything** (files, databases, environments, backups) unless the owner names it and asks.
- Decide the best option and execute. Stop for the owner only at real decisions and before deploying.
- Never type real passwords on deployed sites. Test locally with test accounts.
- Never commit files containing real data (DB dumps, logs with data). Schema-only SQL is fine.
- **Reference for every screen, field, text and formula:** the split legacy HTML in `frontend/legacy` and the legacy Supabase SQL functions (`tools/legacy-parity/sql`). The only intended differences are the documented labour-law corrections (section 6).

## 1. The idea
- **ARIBA Consulting** ran HR on **one huge HTML file**, grown through numbered updates V1 to V130. Data lived in **Supabase**, built by colleague Mohammed Awad: tables, SQL functions and calculations.
- **Goal:** rebuild it on a modern stack with **the same screens, fields, texts and formulas**:
  1. **HR website** for HR, managers and finance.
  2. **Employee mobile app** (iPhone and Android): punch, requests, salary.
  3. **One backend + database** serving both.
- **Principle:** port the logic cleanly with identical results, not copy the old code.

## 2. Tech stack
- **Backend:**
  - Python 3.12, FastAPI, Uvicorn.
  - SQLAlchemy 2 + psycopg 3, raw SQL via `text()`.
  - Pydantic, PyJWT, Argon2/bcrypt.
  - pytest.
- **Database:** PostgreSQL 18 on Railway, service `Postgres-Q6OM`. Normalized schema since 2026-10-13 (section 5). The old service `Postgres` is kept untouched.
- **HR website:** Next.js 16, React 19, TypeScript, Chart.js, Tabler Icons, Zod, ESLint.
  - This Next.js has breaking changes. Read `frontend/hr-web/AGENTS.md`; it uses `proxy.ts`, not `middleware.ts`.
- **Employee app:** Expo 57, React Native 0.86, TypeScript, Expo Router, expo-location, expo-secure-store, react-native-svg.
- **Hosting:** Railway project `sparkling-learning` with two environments (production, demo). GitHub `Faisal-Alrashed1/HR_ARIBA` (private). Push to `main` auto-deploys both.
- **Parity tooling:**
  - `backend/tests_canonical/test_legacy_parity.py`: runs the legacy SQL functions in a throw-away DB and compares them with our code.
  - `tools/legacy-parity`: Node + jsdom, runs the legacy HTML and compares the site's formulas.

## 3. Timeline

### 3.1 — 4 Oct: first version (later reset)
- Backend foundation: auth, roles, security, employees.
- Saudization, GOSI, EOS, dashboard, alerts, documents, photo, dependents.
- V114 design and first Railway deploy.

### 3.2 — 5 Oct: rebuild from the split legacy HTML
- Repo reset into `backend` + `frontend/hr-web` + `frontend/employee-app`, with the legacy HTML as reference in `frontend/legacy`.
- Ported with identical results:
  - GOSI with the V130 exemption.
  - EOS page (`rEOS`) and settlement (`sRun`).
  - Payroll engine PAYX V119.
  - Payslip, locations, attendance.
  - Leave ledger engine.
  - Leaves, documents, the 9 reports, settings.
  - The 9 letterhead forms.

### 3.3 — 6 Oct: additions and the first app
- **Web:**
  - V117 attendance reports.
  - Settlement document with amount in words.
  - Payroll archive.
  - Bulk and English forms.
  - Per-employee work locations (V121).
  - Request attachments.
  - Contract end with auto terminate/reactivate.
  - «بدون خصم» GOSI toggle.
- **App:** GPS punch with server geofence and flexible hours, my requests, forgot punch, team, approvals, forms, payslips, notifications.

### 3.4 — 8 Oct: moved onto the colleague's database (canonical)
- The backend runs on the original Supabase schema through `backend/app/routers/canonical.py` (all routes, raw SQL).
- DB service `Postgres-Q6OM`. Audit in `docs/14_INTEGRATION_AUDIT.md`.
- `backend/tools/create_account.py` creates a login with a temporary password.
- The app was restyled to the legacy V118 look.

### 3.5 — 11 Oct: demo, brand, UI
- **Demo environment:** a copy of production with all salaries 1000. It is a Railway setup, not a commit.
- **Brand:** Tabler icons instead of emoji, ARIBA colours, male/female/tamheer avatars.
- **UI:**
  - Unified date/time picker.
  - «الطلبات والإجازات» page with all request types.
  - Forgot-punch notice.
  - Dashboard polish.
  - «تحديث البيانات» reloads any page.
- **Employees:** saving recomputes stored GOSI/net (legacy `sEmp`); clearer messages; «كل جهات العمل» filter fixed.

### 3.6 — 11–12 Oct: legacy parity audit (`0f85a93`)
- Report in `docs/15_LOGIC_AUDIT.md`. The legacy HTML was run in jsdom and the legacy SQL functions in Postgres, then compared number by number.
- **EOS report** uses the recorded award (84/84). Contract end is computed on save. Reactivation on renewal (V101).
- **Punch (legacy V140):**
  - Polygons, smallest zone first.
  - Remote only with an approved remote request for the day.
  - Late minutes at least 1, rounded.
  - Tolerance 0 respected.
- **Dashboard figures** match the legacy.
- **GOSI exemption** = legacy `kindOf` (428/428).
- **App leave balance** = legacy `ariba_leave_calc`.
- **Requests:**
  - Every type goes manager → HR → CEO; forgot punch goes to HR only.
  - HR is notified of every new request; legacy notification texts.
  - HR override and final approve as legacy.
  - Forgot punch merges into the day's record.
  - The annual-leave balance check on submit is **kept** (owner's choice).
- **Attendance reports** logic in `frontend/hr-web/src/lib/calc/att-reports.ts` (+ avg check-in). The payroll report recomputes net.
- **Permanent parity tests** (section 9).

### 3.7 — 12–13 Oct
- `683982d`: files and photos live in the DB (`ariba_documents`).
- `c24e6d6`: the owner removed the open-notes section from this guide.
- `1d2bbed`: dark green border on every dashboard tile.
- `ad8ee40`: HR delete-request fix (a missing parenthesis gave HTTP 500, shown as «Cannot reach the server») + regression test.
- **Rollback point** `before-normalization` taken (section 8).

### 3.8 — 13 Oct: the colleague's normalization merged and deployed
- The colleague (Ghady Nafisah, repo `Dalteam/HR_ARIBA`) normalized the schema and updated the CRUD operations and API routes.
- **`dbbee54`:** their changes brought into our code.
  - Taken as delivered: `canonical.py`, `models.py`, the contract test, `create_account.py`, the app's notifications (server read state), the attendance page (sessions per day).
  - Kept ours: the delete-request fix and the dashboard borders.
  - **Single delete helper:** removes a request with every row that references it (leave, permission, documents, notifications, actions). Used by HR delete, employee delete and letter delete, which failed on the new foreign keys.
  - **Parity tests** re-done on the new schema (adds correction K, section 6).
- **`1ba1a42`:** `docs/db-normalization/run_on_railway.sh` migrates one Railway environment:
  1. Full backup, verified.
  2. `railway_prep.sql`: restores the original Supabase keys the Railway export lost, and aligns payroll approval flags (backed up to `ops`).
  3. `preflight_checks.sql`, then `pre_migration_fixes.sql`, then `preflight_checks.sql` again.
  4. `ariba_normalization.sql`.
- **Production and demo DBs migrated, code deployed (15:27).**
  - Checked afterwards: health OK, login answers, no 500s.
  - Row counts unchanged, except:
    - Payroll rows 175 → 171: 4 orphan rows (deleted employees), backed up in `ops.orphan_payrolls_backup`.
    - Workflow actions 12 → 14: backfilled missing actions; old «HR override» stage rows were removed (they exist only in the pre-migration backup).
  - All tests green.

## 4. Architecture
```
 HR website (Next.js)            Employee app (Expo)
 frontend/hr-web                 frontend/employee-app
        │  HTTPS JSON /api/v1           │
        └──────────────┬────────────────┘
                       ▼
          FastAPI backend: backend/app/main.py → routers/canonical.py (raw SQL)
                       ▼
          PostgreSQL on Railway (normalized schema)
```
- **Login:** `POST /api/v1/auth/login` returns a JWT signed by the backend. Accounts in `ariba_auth_accounts`; legacy bcrypt passwords auto-upgrade to Argon2.
- **Roles:** admin, admin_manager, hr, ceo, finance, manager, employee. The backend checks permissions on every route; the UI only mirrors them.
- **Files:** photos, attachments and letters are stored **in the DB** (`ariba_documents.file_data`). The Railway `/data` disk is unused.
- **The frontends depend only on the API JSON**, never on the DB shape.

## 5. Database (normalized, since 2026-10-13)
- **`employee_directory`:**
  - `employee_id`, name, `manager_id` (FK), `active`.
  - `employer_id`, `department_id`, `job_title_id` (FKs to lookup tables).
  - `data` JSONB still holds the legacy fields and stored figures.
  - The username lives only in `ariba_auth_accounts`.
- **Lookups:** `employers`, `departments`, `job_titles`, `roles`, `workflow_stages`, `leave_types`, `permission_types`, `document_types`, `workflow_request_types`.
- **Workflow:**
  - `workflow_requests`: all requests; `status` is generated from `current_stage`.
  - `workflow_approvers`: hr = 40, ceo = 86.
  - `workflow_actions`: actor account and comment.
  - `workflow_notifications.read_at` marks read.
- **Requests detail:** `leave_requests` (`employee_id`, `leave_type`; compat view `leave_requests_v`) and `permissions`.
- **`attendance`:** `employee_id`; one row per session; at most one open session per employee per day; location via `location_id`.
- **Payroll:**
  - `employee_payrolls` (`payload` JSONB per employee and month) and `payroll_archives_v2`.
  - Month approval in `payroll_periods`.
  - `payroll_components`/`payroll_lines` exist but are **empty**; the app still reads the payload.
- **Other tables:** `ariba_auth_accounts`, `ariba_sessions`, `ariba_app_settings`, `work_locations` (`employer_id`, NULL = all), `public_holidays`, `company_settings` (shift hours from `shift_duration_minutes`), `ariba_documents`, `ariba_audit_log`, `ariba_deleted_items`.
- **Schema `ops`:** old backup tables, `orphan_payrolls_backup`, `employee_payrolls_approval_backup`.
- **Migration scripts:** `docs/db-normalization/` (section 3.8).
- **Known data issue — long IDs:**
  - 81 employees (1 active, 80 terminated) have an `employee_id` like `XLS-62d422dece6b`. The legacy HTML gave these IDs to employees imported from Excel, and they became the primary key.
  - 78 of them have a real employee number in `data.empNo`, which the UI shows.
  - **3 terminated employees have none**, so the long ID shows as their number.
  - 4 logins use `EMPXLS-…` usernames.
  - **Not fixed yet** (options: give the 3 a number, or renumber all IDs across tables).

## 6. Labour-law corrections (intended differences from legacy)
| Code | Correction |
|---|---|
| A | Art. 85 resignation: exactly 5 years = 1/3, exactly 10 = full |
| B | EOS base = actual wage (basic + all fixed allowances) |
| C | Art. 77 on a fixed-term contract = wage of the months left (min two months) |
| D | Art. 87 full-award option |
| E/F | Legal notes for HR (sick-leave tiers art. 117, marriage/death/paternity/maternity limits, hajj). Notes only, nothing is rejected |
| G | Payroll GOSI on the actual housing allowance |
| H | Overtime divisor unchanged |
| I | Warning when this or next year's Eids are missing |
| J | Leave after 5 years correct for contracts above 21 days |
| K | Flexible day: early leave counted on the last session (added with the normalization merge) |

## 7. Environments and links
| | Production (real data) | Demo (salaries 1000) |
|---|---|---|
| Website | https://frontend-production-f9a8a.up.railway.app | https://frontend-demo-b5ec.up.railway.app |
| Backend | https://hrariba-production.up.railway.app | https://hrariba-demo.up.railway.app |
| Database | `Postgres-Q6OM` | `Postgres-Q6OM` (demo copy) |

- **Services per environment:** `HR_ARIBA` (backend), `frontend`, `Postgres-Q6OM`, `Postgres` (old, untouched).
- **Railway CLI** is linked to production; add `-e demo` for demo.
- **Backend variables:** `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `RUN_MIGRATIONS_ON_STARTUP=false`, `ENV=production`. **Website:** `NEXT_PUBLIC_API_URL` (read at build time).
- **The system is still in build stage, for developers only.**
- **Employee app:** no permanent build yet (TestFlight/APK). Run it with Expo:
  ```
  cd frontend/employee-app && npx expo start --lan --clear
  ```
  or `--tunnel`. `frontend/employee-app/.env` points at demo.
- **GitHub CLI:** the active account must be `Faisal-Alrashed1`; the second account cannot see the private repo.

## 8. Backups and rollback
- **`before-normalization`:**
  - Git tag = `ad8ee40`.
  - Snapshot in `~/Desktop/HR/backups/before-normalization/`: prod + demo DB dumps, Railway variables, code bundle/zip, `README.txt` with restore steps.
- **`~/Desktop/HR/backups/before-migration-2026-10-13/`:** prod + demo DB dumps taken by `run_on_railway.sh` right before migrating.
- **These folders contain real data:** owner-only, never commit or share.
- **Rollback = code and DB together:**
  - Code: `git checkout before-normalization -- .`, commit, push.
  - DB: restore the dump into a **new** database and point `DATABASE_URL` at it.

## 9. Local setup, checks, tests
- **Local Postgres (`host=/tmp`):**
  - **New schema:** `ariba_after`, `ariba_after2`, `ariba_norm_trial` (migrated copies of production).
  - **Old schema, no longer usable with the current code:** `ariba_demo`, `ariba_verify`, `ariba_before`.
  - The test accounts `ui.check` (admin) / `ui.emp` (employee 10) exist only in old `ariba_demo`. On a new-schema copy, create a test login with `backend/tools/create_account.py`.
- **Backend:**
  ```
  cd backend && DATABASE_URL='postgresql:///ariba_after?host=/tmp' RUN_MIGRATIONS_ON_STARTUP=false ENV=development CORS_ORIGINS='http://localhost:3010,http://localhost:8082' .venv/bin/uvicorn app.main:app --port 8010
  ```
- **Website:**
  ```
  cd frontend/hr-web && NEXT_PUBLIC_API_URL=http://localhost:8010/api/v1 npx next dev -p 3010
  ```
- **App in the browser:**
  ```
  cd frontend/employee-app && EXPO_PUBLIC_API_URL=http://localhost:8010 npx expo start --web --port 8082
  ```
- **Checks (all must pass before any deploy):**
  - `cd backend && LEGACY_PARITY_PG='postgresql:///postgres?host=/tmp' .venv/bin/python -m pytest -q` — 44 passed, 1 skipped.
  - `cd tools/legacy-parity && npm ci && npm test` — all suites match the legacy HTML.
  - `cd frontend/hr-web && npx tsc --noEmit && npx eslint src --quiet`
  - `cd frontend/employee-app && npx tsc --noEmit`
- **Tests:**
  - `backend/tests_canonical/test_canonical_contract.py`: table allowlist, security, masking.
  - `test_legacy_parity.py`: legacy SQL functions run on the old shape, ours on the migrated shape, same rows. Covers punch, late/early, leave balance, notifications, approval flow, override/final, forgot punch, deletes, labour-law notes.
  - `tools/legacy-parity`: site formulas vs legacy HTML (PAYX, settlement, EOS, tafqeet, GOSI exemption, attendance reports, labour-law corrections).
  - `backend/tests/` (≈70, old) are broken and archived.

## 10. Key files
- `backend/app/routers/canonical.py`: all API routes (raw SQL), about 2640 lines.
- `backend/app/services/`:
  - `employee_map.py` (data ↔ API fields, `figures()`), `canonical_data.py` (readers for the engines).
  - `leave.py` (LeaveBook), `gosi.py`, `end_of_service.py`, `contracts.py`.
- `backend/app/models.py`: table allowlist checked at startup.
- `frontend/hr-web/src/app/(hr)/(portal)/*`: the pages (dashboard, employees, attendance, locations, leaves, payroll, payslips, end-of-service, settlement, documents, reports, settings, templates).
- `frontend/hr-web/src/lib/calc/*`: site formulas. `frontend/hr-web/src/lib/*.ts`: API clients and types.
- `frontend/employee-app/app/(tabs)/*`: app tabs. `frontend/employee-app/src/lib/api.ts`: API client.
- `frontend/legacy/`: the reference HTML.
- `docs/`:
  - `15_LOGIC_AUDIT.md`: legacy vs ours + decisions.
  - `14_INTEGRATION_AUDIT.md`: canonical DB vs our code.
  - `db-normalization/`: migration scripts.
  - `HANDOFF_NEXT.md` (local only, superseded by this guide).
  - The other docs are older references.

## 11. Current status
- **Production and demo:** same code (`1ba1a42`) on the normalized schema, all checks green.
- **Not done yet:**
  - The 3 employees without an employee number (long IDs, section 5).
  - Empty `payroll_lines`.
  - A manual pass over the screens after the migration.
  - A permanent mobile build.

---

# العربي

> آخر تحديث: 2026-10-14. آخر نسخة منشورة: `1ba1a42` (الإنتاج والعرض).
> هذا الملف **المرجع الأول** لأي شخص أو محادثة جديدة.

## 0. قواعد العمل (تعليمات صاحب المشروع)
- الرد **بالعربي، مختصر ومباشر**.
- **لا رفع على `main` ولا نشر إلا لما يقول «انشر».** الرفع على `main` ينشر **الإنتاج والعرض** مع بعض.
- **لا تحذف أي شي** (ملفات، قواعد، بيئات، نسخ احتياطية) إلا لو صاحب المشروع سمّاه وطلب.
- قرّر الأصح ونفّذ. توقف بس عند القرارات الحقيقية وقبل النشر.
- لا كلمات مرور حقيقية على مواقع منشورة. الفحص محلياً بحسابات تجربة.
- لا رفع لملفات فيها بيانات حقيقية (نسخ قواعد، سجلات فيها بيانات). ملفات السكيما بدون بيانات مسموحة.
- **المرجع لكل شاشة وحقل ونص ومعادلة:** الـ HTML المقسّم في `frontend/legacy`، ودوال SQL القديمة (`tools/legacy-parity/sql`). الفروق المقصودة الوحيدة هي تصحيحات نظام العمل الموثّقة (القسم 6).

## 1. الفكرة
- **أريبا للاستشارات** كانت تشغّل الموارد البشرية على **ملف HTML واحد ضخم**، تطوّر بتحديثات من V1 إلى V130. البيانات على **Supabase** بناها الزميل محمد عوض: جداول، ودوال SQL، وحسابات.
- **الهدف:** إعادة بنائه بتقنيات حديثة **بنفس الشاشات والحقول والنصوص والمعادلات**:
  1. **موقع HR** لـ HR والمدراء والمالية.
  2. **تطبيق جوال للموظف** (آيفون وأندرويد): البصمة، والطلبات، والراتب.
  3. **خادم واحد + قاعدة بيانات** يخدم الاثنين.
- **المبدأ:** ننقل المنطق نظيف وبنفس النتائج، ما ننسخ الكود القديم.

## 2. التقنيات
- **الخادم:**
  - Python 3.12، وFastAPI، وUvicorn.
  - SQLAlchemy 2 + psycopg 3، وأوامر SQL مباشرة.
  - Pydantic، وPyJWT، وArgon2/bcrypt.
  - pytest.
- **القاعدة:** PostgreSQL 18 على Railway، خدمة `Postgres-Q6OM`، بسكيما مرتبة من 2026-10-13 (القسم 5). والخدمة القديمة `Postgres` باقية بدون لمس.
- **موقع HR:** Next.js 16، وReact 19، وTypeScript، وChart.js، وTabler Icons، وZod، وESLint.
  - نسخة Next.js هذي فيها تغييرات جذرية. اقرأ `frontend/hr-web/AGENTS.md`، وتستخدم `proxy.ts` بدل `middleware.ts`.
- **التطبيق:** Expo 57، وReact Native 0.86، وTypeScript، وExpo Router، وexpo-location، وexpo-secure-store، وreact-native-svg.
- **الاستضافة:** Railway، مشروع `sparkling-learning`، ببيئتين (الإنتاج والعرض). GitHub `Faisal-Alrashed1/HR_ARIBA` (خاص). الرفع على `main` ينشر الاثنين.
- **أدوات المطابقة:**
  - `backend/tests_canonical/test_legacy_parity.py`: يشغّل دوال SQL القديمة في قاعدة مؤقتة ويقارنها بكودنا.
  - `tools/legacy-parity`: Node + jsdom، يشغّل الـ HTML القديم ويقارن معادلات الموقع معه.

## 3. الخط الزمني

### 3.1 — 4 أكتوبر: النسخة الأولى (انلغت بعدين)
- أساس الخادم: الدخول، والأدوار، والأمان، والموظفين.
- السعودة، والتأمينات، ونهاية الخدمة، ولوحة التحكم، والتنبيهات، والمستندات، والصورة، والمرافقين.
- تصميم V114، وأول نشر على Railway.

### 3.2 — 5 أكتوبر: إعادة البناء من الـ HTML المقسّم
- تصفير الريبو إلى `backend` و`frontend/hr-web` و`frontend/employee-app`، والـ HTML القديم مرجع في `frontend/legacy`.
- نقلنا بنفس النتائج:
  - التأمينات مع إعفاء V130.
  - صفحة نهاية الخدمة والمخالصة.
  - محرك المسير PAYX V119.
  - القسيمة، والمواقع، والحضور.
  - محرك أرصدة الإجازات.
  - الإجازات، والوثائق، والتقارير التسعة، والإعدادات.
  - النماذج التسعة بالترويسة.

### 3.3 — 6 أكتوبر: إضافات وأول تطبيق
- **الموقع:**
  - تقارير الحضور V117.
  - مستند المخالصة بالمبلغ بالحروف.
  - أرشيف المسير.
  - النماذج الجماعية والإنجليزية.
  - مواقع عمل لكل موظف (V121).
  - مرفقات الطلبات.
  - نهاية العقد مع الإنهاء والإرجاع التلقائي.
  - خيار «بدون خصم» للتأمينات.
- **التطبيق:** بصمة GPS مع نطاق جغرافي في الخادم ودوام مرن، وطلباتي، ونسيان البصمة، والفريق، والموافقات، والنماذج، والقسائم، والإشعارات.

### 3.4 — 8 أكتوبر: الانتقال لقاعدة زميلنا (canonical)
- الخادم يشتغل على سكيما Supabase الأصلية عبر `backend/app/routers/canonical.py` (كل الـ routes، بأوامر SQL مباشرة).
- خدمة القاعدة `Postgres-Q6OM`. التقرير في `docs/14_INTEGRATION_AUDIT.md`.
- `backend/tools/create_account.py` ينشئ حساب دخول بكلمة مرور مؤقتة.
- التطبيق صار بشكل V118 القديم.

### 3.5 — 11 أكتوبر: العرض والهوية والواجهة
- **بيئة العرض:** نسخة من الإنتاج والرواتب كلها 1000. إعداد في Railway، ما لها commit.
- **الهوية:** أيقونات Tabler بدل الإيموجي، وألوان أريبا، وصور الرجل والمرأة والتمهير.
- **الواجهة:**
  - منتقي تاريخ ووقت موحد.
  - صفحة «الطلبات والإجازات» بكل الأنواع.
  - تنبيه نسيان البصمة.
  - تحسينات لوحة التحكم.
  - «تحديث البيانات» يعيد تحميل أي صفحة.
- **الموظفين:** الحفظ يعيد حساب التأمينات والصافي المخزّن (`sEmp` القديمة)، ورسائل أوضح، وإصلاح فلتر «كل جهات العمل».

### 3.6 — 11 و12 أكتوبر: تدقيق المطابقة مع القديم (`0f85a93`)
- التقرير في `docs/15_LOGIC_AUDIT.md`. شغّلنا الـ HTML القديم في jsdom ودوال SQL القديمة في Postgres، وقارنّا رقم برقم.
- **تقرير نهاية الخدمة** يعتمد المكافأة المسجّلة (84/84). نهاية العقد تنحسب عند الحفظ. والإرجاع للنشاط عند التجديد (V101).
- **البصمة (V140 القديمة):**
  - المضلّعات، والموقع الأصغر أولاً.
  - «عن بعد» بس مع طلب معتمد لنفس اليوم.
  - دقيقة تأخير على الأقل مع التقريب.
  - وقت السماح 0 محترم.
- **أرقام لوحة التحكم** مطابقة للقديم.
- **إعفاء التأمينات** = `kindOf` القديمة (428/428).
- **رصيد التطبيق** = `ariba_leave_calc` القديمة.
- **الطلبات:**
  - كل نوع: مدير ← HR ← رئيس تنفيذي، ونسيان البصمة عند HR بس.
  - HR يتنبّه بكل طلب جديد، ونصوص الإشعارات مثل القديم.
  - الاعتماد نيابة والنهائي مثل القديم.
  - نسيان البصمة يندمج مع سجل اليوم.
  - التحقق من رصيد الإجازة السنوية عند التقديم **باقي** (قرار صاحب المشروع).
- **تقارير الحضور:** المنطق في `frontend/hr-web/src/lib/calc/att-reports.ts` (+ متوسط وقت الدخول). وتقرير الرواتب يعيد حساب الصافي.
- **اختبارات مطابقة دائمة** (القسم 9).

### 3.7 — 12 و13 أكتوبر
- `683982d`: الملفات والصور داخل القاعدة (`ariba_documents`).
- `c24e6d6`: صاحب المشروع حذف قسم الملاحظات المفتوحة من هذا الدليل.
- `1d2bbed`: حافة خضراء غامقة لكل بطاقات لوحة التحكم.
- `ad8ee40`: إصلاح حذف الطلب من HR. قوس ناقص كان يطلّع خطأ 500، والموقع يعرض «Cannot reach the server». وانضاف اختبار يمنع رجوعه.
- **نقطة رجوع** `before-normalization` (القسم 8).

### 3.8 — 13 أكتوبر: دمج نورملايزيشن زميلنا ونشره
- زميلنا (Ghady Nafisah، ريبو `Dalteam/HR_ARIBA`) رتّب السكيما، وحدّث عمليات CRUD وroutes الـ API.
- **`dbbee54`:** جبنا تعديلاته لكودنا.
  - **انأخذ كما سلّمه:** `canonical.py`، و`models.py`، واختبار قائمة الجداول، و`create_account.py`، وإشعارات التطبيق (حالة القراءة من الخادم)، وصفحة الحضور (الجلسات لكل يوم).
  - **بقى حقنا:** إصلاح حذف الطلب، وحواف الداشبورد.
  - **دالة حذف وحدة:** تحذف الطلب مع كل شي مربوط فيه (الإجازة، والاستئذان، والمستندات، والإشعارات، والإجراءات). تُستخدم في حذف HR، وحذف الموظف، وحذف الخطاب، لأنها كانت تطيح على الروابط الجديدة بين الجداول.
  - **اختبارات المطابقة** انعادت على السكيما الجديدة (وانضاف التصحيح K، القسم 6).
- **`1ba1a42`:** سكربت `docs/db-normalization/run_on_railway.sh` ينقل بيئة Railway وحدة:
  1. نسخة احتياطية كاملة يتأكد منها.
  2. `railway_prep.sql`: يرجّع مفاتيح Supabase الأصلية اللي ضاعت في تصدير Railway، ويوحّد حالة اعتماد المسير (مع نسخة في `ops`).
  3. `preflight_checks.sql` ← `pre_migration_fixes.sql` ← `preflight_checks.sql` مرة ثانية.
  4. `ariba_normalization.sql`.
- **انتقلت قاعدتي الإنتاج والعرض، وانتشر الكود (15:27).**
  - **الفحص بعدها:** الخادم سليم، والدخول يرد، وما فيه أخطاء 500.
  - أعداد الصفوف نفسها، ما عدا:
    - **المسير:** 175 صار 171. أربع صفوف يتيمة لموظفين محذوفين، محفوظة في `ops.orphan_payrolls_backup`.
    - **سجل الموافقات:** 12 صار 14. انضافت إجراءات ناقصة، وانحذفت سجلات «الاعتماد نيابة» القديمة (موجودة بس في نسخة ما قبل النقل).
  - كل الاختبارات ناجحة.

## 4. المعمارية
```
 موقع HR (Next.js)               تطبيق الموظف (Expo)
 frontend/hr-web                 frontend/employee-app
        │  HTTPS JSON /api/v1           │
        └──────────────┬────────────────┘
                       ▼
          خادم FastAPI: backend/app/main.py ← routers/canonical.py (SQL مباشر)
                       ▼
          PostgreSQL على Railway (السكيما المرتبة)
```
- **الدخول:** `POST /api/v1/auth/login` يرجّع JWT موقّع من الخادم. الحسابات في `ariba_auth_accounts`، وكلمات مرور bcrypt القديمة تتحوّل تلقائياً لـ Argon2.
- **الأدوار:** admin، وadmin_manager، وhr، وceo، وfinance، وmanager، وemployee. الخادم يتحقق من الصلاحية في كل route، والواجهة تعكسها بس.
- **الملفات:** الصور والمرفقات والخطابات **داخل القاعدة** (`ariba_documents.file_data`). قرص `/data` في Railway ما يُستخدم.
- **الواجهات تعتمد على JSON الـ API بس**، وما تعتمد على شكل القاعدة.

## 5. قاعدة البيانات (مرتبة من 2026-10-13)
- **`employee_directory`:**
  - `employee_id`، والاسم، و`manager_id` (رابط)، و`active`.
  - `employer_id` و`department_id` و`job_title_id` (روابط لجداول القوائم).
  - `data` JSONB للحين فيه الحقول القديمة والأرقام المخزّنة.
  - اسم المستخدم في `ariba_auth_accounts` بس.
- **القوائم المرجعية:** `employers`، و`departments`، و`job_titles`، و`roles`، و`workflow_stages`، و`leave_types`، و`permission_types`، و`document_types`، و`workflow_request_types`.
- **سير الموافقات:**
  - `workflow_requests`: كل الطلبات، و`status` يتولّد من `current_stage`.
  - `workflow_approvers`: hr = 40، وceo = 86.
  - `workflow_actions`: الحساب اللي سوّى الإجراء والتعليق.
  - `workflow_notifications.read_at`: يحدد المقروء.
- **تفاصيل الطلبات:** `leave_requests` (`employee_id`، و`leave_type`، وفيه عرض بديل `leave_requests_v`)، و`permissions`.
- **`attendance`:** `employee_id`، صف لكل جلسة، وجلسة مفتوحة وحدة بالأكثر لكل موظف في اليوم، والموقع عبر `location_id`.
- **المسير:**
  - `employee_payrolls` (`payload` JSONB لكل موظف وشهر)، و`payroll_archives_v2`.
  - اعتماد الشهر في `payroll_periods`.
  - `payroll_components`/`payroll_lines` موجودة بس **فاضية**، والتطبيق للحين يقرأ من الـ payload.
- **جداول ثانية:** `ariba_auth_accounts`، و`ariba_sessions`، و`ariba_app_settings`، و`work_locations` (`employer_id`، والفاضي = الكل)، و`public_holidays`، و`company_settings` (ساعات الدوام من `shift_duration_minutes`)، و`ariba_documents`، و`ariba_audit_log`، و`ariba_deleted_items`.
- **سكيما `ops`:** جداول النسخ القديمة، و`orphan_payrolls_backup`، و`employee_payrolls_approval_backup`.
- **سكربتات النقل:** `docs/db-normalization/` (القسم 3.8).
- **مشكلة بيانات معروفة، المعرّفات الطويلة:**
  - 81 موظف (1 نشط و80 منتهي) معرّفهم بشكل `XLS-62d422dece6b`. السبب: الـ HTML القديم عطى هالمعرّفات للموظفين المستوردين من Excel، وصارت هي المفتاح الأساسي.
  - 78 منهم عندهم رقم وظيفي حقيقي في `data.empNo`، والواجهة تعرضه.
  - **3 منتهية خدماتهم ما عندهم رقم**، فيظهر المعرّف الطويل مكان رقمهم.
  - 4 حسابات دخول أسماؤها `EMPXLS-…`.
  - **ما انحلّت للحين.** الخيارات: نعطي الـ 3 رقم، أو نعيد ترقيم كل المعرّفات في كل الجداول.

## 6. تصحيحات نظام العمل (فروق مقصودة عن القديم)
| الرمز | التصحيح |
|---|---|
| A | الاستقالة (م.85): 5 سنوات بالضبط = الثلث، و10 بالضبط = كاملة |
| B | وعاء نهاية الخدمة = الأجر الفعلي (الأساسي + كل البدلات الثابتة) |
| C | م.77 للعقد المحدد = أجر الأشهر الباقية (شهرين على الأقل) |
| D | خيار المكافأة الكاملة (م.87) |
| E/F | ملاحظات نظامية لـ HR (درجات المرضية م.117، وحدود الزواج والوفاة والأبوة والأمومة، والحج). ملاحظات بس وما ينرفض شي |
| G | تأمينات المسير على بدل السكن الفعلي |
| H | المقسوم عليه في الإضافي بدون تغيير |
| I | تنبيه لما أعياد السنة الحالية أو الجاية ناقصة |
| J | رصيد ما بعد 5 سنوات صحيح للعقود أكثر من 21 يوم |
| K | الدوام المرن: الخروج المبكر ينحسب على آخر جلسة (انضاف مع دمج النورملايزيشن) |

## 7. البيئات والروابط
| | الإنتاج (بيانات حقيقية) | العرض (الرواتب 1000) |
|---|---|---|
| الموقع | https://frontend-production-f9a8a.up.railway.app | https://frontend-demo-b5ec.up.railway.app |
| الخادم | https://hrariba-production.up.railway.app | https://hrariba-demo.up.railway.app |
| القاعدة | `Postgres-Q6OM` | `Postgres-Q6OM` (نسخة العرض) |

- **الخدمات في كل بيئة:** `HR_ARIBA` (الخادم)، و`frontend`، و`Postgres-Q6OM`، و`Postgres` (القديمة، بدون لمس).
- **Railway CLI** مربوط على الإنتاج، وأضف `-e demo` للعرض.
- **متغيرات الخادم:** `DATABASE_URL`، و`JWT_SECRET`، و`CORS_ORIGINS`، و`RUN_MIGRATIONS_ON_STARTUP=false`، و`ENV=production`. **والموقع:** `NEXT_PUBLIC_API_URL` (يُقرأ وقت البناء).
- **النظام للحين في مرحلة البناء، للمطورين بس.**
- **التطبيق:** ما له بناء دائم (TestFlight/APK). شغّله بـ Expo:
  ```
  cd frontend/employee-app && npx expo start --lan --clear
  ```
  أو `--tunnel`. وملف `frontend/employee-app/.env` يأشّر على العرض.
- **GitHub CLI:** الحساب النشط لازم يكون `Faisal-Alrashed1`، لأن الحساب الثاني ما يشوف الريبو الخاص.

## 8. النسخ الاحتياطية والرجوع
- **`before-normalization`:**
  - علامة git = `ad8ee40`.
  - نسخة في `~/Desktop/HR/backups/before-normalization/`: قاعدتي الإنتاج والعرض، ومتغيرات Railway، ونسخة الكود، و`README.txt` بخطوات الرجوع.
- **`~/Desktop/HR/backups/before-migration-2026-10-13/`:** نسخ قاعدتي الإنتاج والعرض، أخذها `run_on_railway.sh` قبل النقل مباشرة.
- **هالمجلدات فيها بيانات حقيقية:** مقفلة على صاحب المشروع، ولا ترتفع ولا تتشارك.
- **الرجوع = الكود والقاعدة مع بعض:**
  - **الكود:** `git checkout before-normalization -- .` ثم commit ثم رفع.
  - **القاعدة:** نرجّع النسخة في قاعدة **جديدة** ونوجّه لها `DATABASE_URL`.

## 9. التشغيل المحلي والفحوصات والاختبارات
- **Postgres محلي (`host=/tmp`):**
  - **سكيما جديدة:** `ariba_after`، و`ariba_after2`، و`ariba_norm_trial` (نسخ من الإنتاج بعد النقل).
  - **سكيما قديمة، ما تشتغل مع الكود الحالي:** `ariba_demo`، و`ariba_verify`، و`ariba_before`.
  - حسابات التجربة `ui.check` (مدير النظام) و`ui.emp` (موظف 10) موجودة بس في `ariba_demo` القديمة. على نسخة بالسكيما الجديدة، أنشئ حساب تجربة بـ `backend/tools/create_account.py`.
- **الخادم:**
  ```
  cd backend && DATABASE_URL='postgresql:///ariba_after?host=/tmp' RUN_MIGRATIONS_ON_STARTUP=false ENV=development CORS_ORIGINS='http://localhost:3010,http://localhost:8082' .venv/bin/uvicorn app.main:app --port 8010
  ```
- **الموقع:**
  ```
  cd frontend/hr-web && NEXT_PUBLIC_API_URL=http://localhost:8010/api/v1 npx next dev -p 3010
  ```
- **التطبيق في المتصفح:**
  ```
  cd frontend/employee-app && EXPO_PUBLIC_API_URL=http://localhost:8010 npx expo start --web --port 8082
  ```
- **الفحوصات (كلها لازم تنجح قبل أي نشر):**
  - `cd backend && LEGACY_PARITY_PG='postgresql:///postgres?host=/tmp' .venv/bin/python -m pytest -q` — 44 ناجح و1 متجاوز.
  - `cd tools/legacy-parity && npm ci && npm test` — كل الوحدات مطابقة للـ HTML القديم.
  - `cd frontend/hr-web && npx tsc --noEmit && npx eslint src --quiet`
  - `cd frontend/employee-app && npx tsc --noEmit`
- **الاختبارات:**
  - `backend/tests_canonical/test_canonical_contract.py`: قائمة الجداول، والأمان، وإخفاء الحقول الحساسة.
  - `test_legacy_parity.py`: دوال SQL القديمة على الشكل القديم، وكودنا على الشكل الجديد، بنفس الصفوف. يغطي البصمة، والتأخير والخروج المبكر، ورصيد الإجازة، والإشعارات، وسير الموافقات، والاعتماد نيابة والنهائي، ونسيان البصمة، والحذف، وملاحظات نظام العمل.
  - `tools/legacy-parity`: معادلات الموقع مقابل الـ HTML القديم (PAYX، والمخالصة، ونهاية الخدمة، والتفقيط، وإعفاء التأمينات، وتقارير الحضور، وتصحيحات نظام العمل).
  - `backend/tests/` (حوالي 70، قديمة) معطّلة ومؤرشفة.

## 10. أهم الملفات
- `backend/app/routers/canonical.py`: كل routes الـ API (SQL مباشر)، حوالي 2640 سطر.
- `backend/app/services/`:
  - `employee_map.py` (الترجمة بين البيانات وحقول الـ API، و`figures()`)، و`canonical_data.py` (قراءة البيانات للمحركات).
  - `leave.py` (محرك الأرصدة)، و`gosi.py`، و`end_of_service.py`، و`contracts.py`.
- `backend/app/models.py`: قائمة الجداول اللي تتحقق عند تشغيل الخادم.
- `frontend/hr-web/src/app/(hr)/(portal)/*`: الصفحات (لوحة التحكم، والموظفين، والحضور، والمواقع، والطلبات، والمسير، والقسائم، ونهاية الخدمة، والمخالصة، والوثائق، والتقارير، والإعدادات، والنماذج).
- `frontend/hr-web/src/lib/calc/*`: معادلات الموقع. `frontend/hr-web/src/lib/*.ts`: الاتصال بالـ API وأنواعه.
- `frontend/employee-app/app/(tabs)/*`: تبويبات التطبيق. `frontend/employee-app/src/lib/api.ts`: الاتصال بالـ API.
- `frontend/legacy/`: الـ HTML المرجعي.
- `docs/`:
  - `15_LOGIC_AUDIT.md`: القديم مقابل حقنا + القرارات.
  - `14_INTEGRATION_AUDIT.md`: قاعدة canonical مقابل كودنا.
  - `db-normalization/`: سكربتات النقل.
  - `HANDOFF_NEXT.md` (محلي بس، وهذا الدليل يغني عنه).
  - باقي الوثائق مراجع قديمة.

## 11. الوضع الحالي
- **الإنتاج والعرض:** نفس الكود (`1ba1a42`) على السكيما المرتبة، وكل الفحوصات ناجحة.
- **ما انعمل للحين:**
  - الـ 3 موظفين بدون رقم وظيفي (المعرّفات الطويلة، القسم 5).
  - `payroll_lines` الفاضية.
  - مرور يدوي على الشاشات بعد النقل.
  - بناء دائم للتطبيق.
