# Phase 1 Review Report — تقرير مراجعة المرحلة الأولى

> English first, then the full Arabic version (same content).

---

# English

## Phase 1 review report

**Date:** 2026-10-04
**Branch:** `feat/foundation` (last commit: `e8ca7c9`)
**Reference:** the two V114 prototype files
- `_1_HR_برنامج_الموارد_البشرية_V114.html`: 12,245 lines
- `_2_EMPLOYEE_تطبيق_الموظف_V114 1.html`: 3,108 lines

**Method:**
- I extracted from the two HTML files all pages (`pg-*`), the navigation list (`PG_NAV`), the dialogs, tabs, buttons, tables and calculations.
- I matched every element against the actual code in the repository (frontend + API + database), and ran the tests.

**Judgement rule:** an element is "complete" only if it meets four conditions:
1. Its UI exists.
2. It is wired to an API.
3. It is saved in the database.
4. Its permissions are enforced on the server.

---

## Section 1: What I did

### 1.1 Main files and folders

```
ariba-hr/
├── README.md · .gitignore · .vscode/ · .claude/launch.json
├── docs/        PROJECT_STATUS · ARCHITECTURE · SECURITY · BUSINESS_RULES · DATABASE
│                FEATURE_auth · FEATURE_employees · PHASE1_REVIEW (this file)
├── backend/
│   ├── requirements.txt · .env.example · alembic.ini · README.md
│   ├── alembic/env.py · alembic/versions/0001_baseline_schema.py · 0002_seed_reference_data.py
│   ├── app/main.py · config.py · database.py · models.py · schemas.py · migrations.py
│   ├── app/core/      auth · identity · permissions · security · errors · audit · storage
│   │                  scheduling · language · pagination
│   ├── app/routers/   auth · me · employees · settings · health
│   ├── app/services/  employees · accounts · contracts · saudization · seeds
│   │                  + empty files (description only): leave · payroll · gosi · end_of_service
│   │                    attendance · geofence · workflow · alerts · templates · dashboard
│   └── tests/         conftest + 6 test files
└── frontend/
    ├── README.md · DESIGN.md · next.config.ts (security headers) · .env.example
    └── src/
        ├── proxy.ts (route protection; its name in Next 16 instead of middleware.ts)
        ├── app/ (28 pages: 10 built + 18 placeholders)
        ├── components/ui/ · components/nav/ · components/employees/ · components/me/
        └── lib/  api.ts · session.ts · auth.ts · auth-context.tsx · employees.ts · routes.ts
                  validation.ts · format.ts · theme.tsx · prefs.ts · use-api.ts
                  i18n/ar.ts · en.ts · locale.tsx
```

### 1.2 Database

**25 tables and 27 Enum types:**

| Group | Tables |
|---|---|
| Reference | `workplaces` · `departments` · `nationalities` · `holidays` · `gosi_rules` · `workflow_rules` · `company_settings` · `attendance_settings` |
| People | `employees` · `users` · `dependents` · `excluded_candidates` |
| Attendance | `locations` · `attendance_records` |
| Requests | `requests` · `request_steps` |
| Leaves | `leave_year_ledgers` · `leave_adjustments` |
| Payroll | `payroll_runs` · `payroll_rows` |
| End of service | `settlements` · `settlement_items` |
| Files | `documents` · `template_letters` |
| Audit | `audit_logs` |

**Migrations:**
- `0001_baseline_schema`: creates all tables; on Postgres it creates the native Enum types and enables RLS on every table.
- `0002_seed_reference_data`: the seed data:
  - 5 workplaces, 8 departments and 10 nationalities.
  - 6 public holidays: Founding Day, National Day, and Eid al-Fitr and Eid al-Adha for 2026 and 2027.
  - 6 GOSI rules.
  - Company and attendance settings.
  - 17 approval-stage rules.

**RLS policies:**
- Enabled on all tables without any policy, so the `anon` and `authenticated` roles in Supabase cannot read anything.
- The code is in `0001_baseline_schema.py` line 590.
- ⚠️ **Not actually applied on Postgres yet**, because the Supabase keys have not arrived.

**Important note:** most of these tables exist in the schema only, with no API or UI using them. The tables actually used:
- `employees` and `users`.
- `workplaces`, `departments` and `nationalities` (read).
- `audit_logs` (write).

### 1.3 The API (all endpoints that actually exist: 19)

| Method | Path | Function | Who uses it |
|---|---|---|---|
| GET | `/health` | Server and database check | Public |
| POST | `/api/v1/auth/login` | Login by username (with attempt limiting) | Public |
| POST | `/api/v1/auth/refresh` | Session refresh | Public (needs a refresh token) |
| POST | `/api/v1/auth/logout` | Logout | Any user |
| POST | `/api/v1/auth/change-password` | Change password according to the policy | Any user |
| POST | `/api/v1/auth/users` | Create a login account for an employee with a temporary password | HR, system admin |
| PATCH | `/api/v1/auth/users/{id}` | Change role (system admin only), activate and deactivate | HR, system admin |
| POST | `/api/v1/auth/users/{id}/temporary-password` | Issue a temporary password | HR, system admin |
| GET | `/api/v1/auth/users/by-employee/{id}` | Find the login account linked to an employee | HR, system admin |
| GET | `/api/v1/me` | Current user's data | Any user |
| GET | `/api/v1/me/employee` | The user's own employee record | Any user with an employee record |
| GET | `/api/v1/employees` | The list: 8 tabs, workplace and department filter, search, sort, pagination | Everyone except Finance (by scope) |
| GET | `/api/v1/employees/counts` | Tab counts and Saudization rate | Everyone except Finance |
| POST | `/api/v1/employees` | Add an employee | HR, system admin |
| GET | `/api/v1/employees/{id}` | Employee details (out of scope → 404) | Everyone except Finance |
| PATCH | `/api/v1/employees/{id}` | Edit an employee | HR, system admin |
| POST | `/api/v1/employees/{id}/terminate` | Terminate service (date + article + reason) | HR, system admin |
| POST | `/api/v1/employees/{id}/reactivate` | Reactivate an employee | HR, system admin |
| GET | `/api/v1/settings/lookups` | Workplaces, departments and nationalities | Any user |

### 1.4 Frontend pages

| Page | Status |
|---|---|
| `/login` | ✅ built |
| `/dashboard` | 🟡 partial: counts and Saudization rate only |
| `/employees` | ✅ built |
| `/employees/new` | ✅ built |
| `/employees/[id]` | ✅ built (dependents tab is a placeholder) |
| `/me` | 🟡 partial |
| `/me/profile` | ✅ built |
| `/me/settings` | ✅ built |
| `/` | redirect by role |

**Placeholder pages (18):** they show «لم تُبنَ بعد» ("not built yet").
- **Portal:** `attendance` · `locations` · `leaves` · `payroll` · `payslips` · `end-of-service` · `settlement` · `documents` · `templates` · `reports` · `settings`
- **Employee app:** `me/attendance` · `me/leaves` · `me/salary` · `me/team` · `me/overtime` · `me/documents` · `me/approvals`

### 1.5 Authentication, permissions and security

**Authentication**
- **Login path:** employee number → internal email → Supabase Auth via the server. The browser never connects to Supabase.
- **Token verification:** with an HS256 key or via JWKS. The server rejects expired tokens, refresh tokens, and disabled accounts.
- **Password change:** mandatory for accounts with a temporary password. Until the user changes it, all endpoints are locked for them except `/me` and `/auth/change-password`.
- **Password policy:** at least 8 characters, containing letters and digits, and different from the old one.
- **Local login:** a local login provider for development only; the configuration rejects it in production.

**Permissions (on the server)**

| Role | Employees | Salary | Full ID |
|---|---|---|---|
| Employee | Self only | Own salary | Own ID |
| Manager | Self + direct team | Own salary only | Own ID only |
| Finance | Forbidden (403) | — | — |
| HR / system admin | All | ✔ | ✔ |
| CEO | All | ✘ | ✘ (hidden) |

**Security**
- Unified error format.
- Security headers in the API and in Next.js, including CSP.
- CORS with an allow-list of origins only.
- Login attempt limit: 5 per user and 20 per IP within 5 minutes.
- Audit log for successful and failed logins, for reading lists and details, and for every change.
- Secrets in `.env` files only, and none of them in git (I checked before pushing).

### 1.6 Tests (result of the actual run today)

```
backend:  45 passed, 1 skipped in 1.44s
          test_auth 15 · test_employees 10 · test_permissions 7 · test_security 7
          test_scheduling 4 · test_migrations 3
          skipped: test_postgres_migrations_and_rls (TEST_DATABASE_URL not set)
frontend: eslint ✔ (0 warnings) · tsc --noEmit ✔ · next build ✔
```

- I tested the project manually in the browser, in Arabic and English and in light and dark modes:
  login → mandatory password change → dashboard → employee list → adding a female employee with a fixed-term contract (contract end was calculated) → the employee's page.
- I also tested a fresh copy from GitHub (clone): tests and build passed.

### 1.7 Running on localhost

```bash
# Terminal 1 — backend
cd ~/Desktop/HR/ariba-hr/backend && .venv/bin/uvicorn app.main:app --reload --port 8000
# Terminal 2 — frontend
cd ~/Desktop/HR/ariba-hr/frontend && npm run dev
```

- **App:** http://localhost:3000
- **API docs:** http://localhost:8000/docs
- **Test account:** `emp084` (system admin). The password is in `backend/.env.test.local`.
- **On a new machine:** install the requirements first as in `README.md` (`pip install`, `npm install` and copying the `.env.example` files).

---

## Section 2: What is missing (exists in the HTML and was not built at all)

> "Not built" = no working UI, no API, and no calculation logic. Some have a database table only, and I noted that in the note column.

### HR system

| Item | Where in the HTML | Priority | Note |
|---|---|---|---|
| **Attendance:** daily log | `pg-att` (l. 795) | High | Only the `attendance_records` table exists |
| **Monthly attendance report** | `pg-att`: «تقرير شهري» ("Monthly report") button and employee filter | High | — |
| **Manually add and edit an attendance record** | «تسجيل/تعديل حضور» ("Record/edit attendance") dialog: employee, date, check-in, check-out, location, status | High | — |
| **Punch locations:** list, add and delete | `pg-loc` (l. 910) + «إضافة موقع بصمة» ("Add punch location") dialog | High | Fields: name, workplace, type, radius in meters, coordinates, «موقعي الحالي» ("My current location") button, Google map. Only the `locations` table exists |
| **Leaves:** pending requests | `pg-lv` (l. 802): «معلقة» ("Pending") tab + employee, type and status filters | High | — |
| **All leave requests** | `pg-lv`: «كل الطلبات» ("All requests") | High | — |
| **New leave request from HR** | `pg-lv`: «طلب جديد» ("New request") (employee, from, to, notes, 12MB attachment) | High | Corresponds to `ariba_hr_record_leave` in the old system |
| **Leave balances and an employee's balance details** | `pg-lv`: «الأرصدة» ("Balances") → choose the employee | High | Only the `leave_year_ledgers` and `leave_adjustments` tables exist |
| **Year-by-year balance adjustment with reason** | `pg-lv`: «تعديل الرصيد» ("Adjust balance") button | High | — |
| **Leave logic** | `leaveYear*` functions (l. 1734–1858) | High | Entitlement, ledger, carry-over up to 10 days, end-of-service balance and the 2024 rule. `services/leave.py` is an empty file |
| **Public holidays:** view and add | `pg-lv`: «الإجازات الرسمية» ("Public holidays") + «إضافة إجازة رسمية» ("Add public holiday") dialog | Medium | The `holidays` table has seed data, but no API |
| **Overtime (from HR)** | `pg-lv`: «⏱️ عمل إضافي» ("Overtime") (employee, date, hours, reason, attachment) + requests table | Medium | — |
| **Approval workflow:** employee → direct manager → HR → CEO | `workflowHrAct` · `ariba_workflow_action` · `ariba_hr_override_workflow` · `ariba_hr_final_approve` | High | Includes rejection with a reason («سبب الرفض» ("Rejection reason") dialog), approval on behalf of the manager, final approval, and the stage log. Only the `requests`, `request_steps` and `workflow_rules` tables exist |
| **Payroll** | `pg-pay` (l. 843) | High | Has the month, days in the month, work-scope filter, and approve, add row, rebuild, Excel and print buttons. Only the `payroll_runs` and `payroll_rows` tables exist |
| **GOSI calculation** | `calcIns` (l. 2418) | High | The `gosi_rules` table has seed data, but no logic |
| **Archive of approved payrolls** | `ariba_payroll_archive` | High | — |
| **Detailed payslip** | `pg-slip` (l. 897) | High | — |
| **End of service (bulk view)** | `pg-eos` (l. 898): termination date, «اليوم» ("Today") button, article, workplace, Excel | High | — |
| **Settlement calculator** | `pg-eoscalc` (l. 627) | High | Has the employee, service data, 9 articles, leave, attendance days, addable entitlements and deductions, total, print, reset. Only the `settlements` and `settlement_items` tables exist |
| **Settlement printout** | `buildSettlementDocV2` (l. 7537) | Medium | — |
| **Documents:** iqama, passport, medical insurance and contract tabs | `pg-docs` (l. 900) | High | Includes «طباعة هذا التاب» ("Print this tab") and «طباعة الكل» ("Print all"). The data (numbers and dates) exists on the employee, but the page is not built |
| **Employee file uploads** | `DOC_TYPES` (l. 233): ID, passport, qualification, experience, GOSI, national address, CV | High | The `documents` table exists, and `core/storage.py` is written but unused and untested |
| **Dependents** | ft5 tab in the employee form | High | Fields: relationship, names, birth date, ID, passport, insurance, mobile, attachments. Only the `dependents` table exists |
| **The seven templates (+ the eighth)** | `pg-forms` (V70, l. 7941–8158) | Medium | Work commencement, IT custody, probation extension, probation termination, clearance, experience certificate, probation evaluation. On company letterhead, with sending to the employee and tracking its status. Only the `template_letters` table exists |
| **The nine reports** | `pg-rpt` / `buildRpts` (l. 2209) | Medium | Leave balances, iqamas, passports, contracts, detailed payroll, end of service, urgent alerts, current employees, terminated employees |
| **Urgent alerts** | `getAlerts` (l. 1343) + dashboard card + «الوثائق» ("Documents") badge | High | Days remaining are calculated per employee, but there is no alert list and no badge |
| **Excluded** | `pg-excl` (l. 936) | Low | 4 tables: candidates who did not start, current consultants, excluded consultants, terminated. Only the `excluded_candidates` table exists |
| **Projects / workplaces** | `pg-projects` (l. 965) | Low | Choose the workplace then 4 tabs: basic, documents, finance, leaves |
| **Settings:** company | `pg-set` (l. 912) | Medium | Name in Arabic and English, labor law (Saudi Arabia/Egypt/UAE), work start time, late grace period, remote-work limit. The `company_settings` and `attendance_settings` tables have seed data with no API |
| **Settings:** dated GOSI rates | `pg-set` | Medium | Seed data exists with no API |
| **Settings:** flexible hours | V86 · `ariba_hr_set_flexible_hours` | Medium | — |
| **Settings:** user permissions (UI) | V83 · `ariba_hr_list_roles` / `ariba_hr_set_role` | Medium | The API exists (`PATCH /auth/users/{id}`), but there is no account list and no UI |
| **Excel export** | `exportPayExcel` (l. 2991) · `download='EOS_…'` | Medium | Payroll export with 32 columns, and end-of-service export |
| **Data migration from V114** | Section 3.6 of the specification | High | `backend/import_from_v114.py` does not exist |

### Employee app

| Item | Where in the HTML | Priority | Note |
|---|---|---|---|
| **GPS punch (check-in/check-out)** | `att` tab · `ariba_attendance` (l. 1243) | High | Includes server-side geofence check, lateness, expected check-out time, and out-of-radius and outside-flexible-window messages |
| **Monthly attendance log + search by date** | `att` tab · `ariba_my_attendance_range` (l. 2656) | High | — |
| **Submitting requests of all types (17 types)** | `lv` tab · `ariba_submit_request` | High | **Leaves:** annual, sick, emergency, bereavement, marriage, maternity, paternity, Umrah, Hajj, remote. **Other:** business assignment, short permission, maternity permission, early leave, salary advance, forgotten punch, overtime. Fields change by type |
| **Request attachments** | All requests · max 12MB | High | — |
| **«طلباتي» ("My requests") with request status and path** | `lv` tab (l. 1294) | High | The stage is shown: awaiting manager, or HR, or CEO, or approved, or rejected |
| **Leave balance (to date + projected 31/12)** | Home + V112 (l. 2854) | High | — |
| **Current salary + last approved payslip + history** | `pay` tab (l. 2316) | High | — |
| **My team (manager and colleagues)** | `team` tab (l. 1283) | Medium | — |
| **Overtime** | `overtime` tab (l. 1672) | Medium | — |
| **Documents + «بانتظار توقيعي» ("Awaiting my signature")** | `docs` tab (l. 2465) | Medium | Includes viewing the letter, accepting, and rejecting with a reason of at least 3 characters |
| **Approvals (for manager, HR and CEO)** | `approvals` tab (l. 1191) | High | — |
| **Forgotten punch** | V-patch (l. 3049) | High | Type (check-in/check-out/both), date, time, reason. Goes directly to HR |
| **Upcoming public holidays on Home** | Home | Low | — |

### Data in the employee form that does not exist in the new system

| Item | Where in the HTML | Priority | Note |
|---|---|---|---|
| **Profile photo** | ft1: `photo` | Medium | The `photo_path` column exists in the table, but there is no form field and no upload |
| **Extra allowance** (separate from «أخرى» ("Other")) | ft4: `extra` / `extraAllowance` | Medium | Linked to open question no. 4 |
| **Qualification, work type, title in contract, Mona exception, «بالساعة» ("Hourly") flag** | `expand()` (l. 986): `edu`, `et`, `jc`, `mona`, `hourly` | Low | "Hourly" is covered by the `hourly` classification; the rest do not exist |
| **«تراجع» ("Undo") button in the edit form** | `UB` / `uForm()` (l. 664) | Low | — |

---

## Section 3: What is display-only UI (shows up but is incomplete)

| Item | What works | What does not work | What is needed to complete it |
|---|---|---|---|
| **Dashboard** | 6 cards from the API: current employees (Saudi/non-Saudi), Saudization rate, Tamheer, terminated, training, consultants | No charts (salaries by workplace, nationalities, workplaces, departments), no gender breakdown, no urgent alerts, no pending requests, and no payroll summary. A «تُضاف مع وحداتها» ("Added with their modules") message is shown | Dashboard endpoint + chart components. Depends on the payroll, requests and alerts modules |
| **«التابعون» ("Dependents") tab in the employee form** | The tab is visible | It only shows «تُضاف في المرحلة القادمة» ("Added in the next phase") | Dependents API + table and add form |
| **«الوثائق» ("Documents") tab in the employee form** | ID, passport and insurance numbers and expiry dates are saved, with a days-remaining badge | Files cannot be uploaded or downloaded | Supabase Storage integration + document endpoints |
| **«المدير المباشر» ("Direct manager") field** | Saved and validated on the server | The list fetches only the first 100 employees | Search in the list if the employee count grows |
| **«طباعة» ("Print") button on the employee page** | Prints the page without the navigation buttons | Not an official print template, and the form prints only one tab | Print template for the employee file on letterhead |
| **Home in the employee app** | Employee card (name, job, workplace, department, nationality, number) and the Gregorian and Hijri date | No leave balance, no last salary, no upcoming holidays, and a «ستُضاف لاحقاً» ("Will be added later") message is shown | Leaves, payroll and public holidays modules |
| **Bottom bar in the employee app** | The six buttons navigate between pages | 4 of them (attendance, leaves, salary, my team) are placeholder pages. Overtime, documents and approvals are not in the bar at all | Build the modules, and show «الموافقات» ("Approvals") to manager, HR and CEO only |
| **Sidebar in the portal** | All links exist, and are hidden by role (Finance sees only its pages) | 11 links open placeholder pages | Build the modules |
| **«الإعدادات» ("Settings") page in the portal** | Link to my personal settings (language, theme, password) | Company, GOSI, attendance and permissions settings do not exist | Read and write endpoints for settings (tables and seed data are ready) + the UI |
| **Change role / deactivate account** | The API works and is tested, and only the system admin changes roles | No UI and no account list | «صلاحيات المستخدمين» ("User permissions") page |
| **Public holidays, GOSI rules, approval stages, attendance settings** | Data is saved in the database | No API and no UI, and nothing uses them yet (except working-days calculation in code) | Built with their modules |
| **Audit log** | Actually written for every sensitive read and change | No screen to view it | A page for the system admin (was not in the HTML, but required in the specification) |
| **`core/storage.py`** | The code is written | Unused and untested | Wire it to the documents module |
| **Supabase integration** | The code is ready, and tested against fake HTTP | Not run against real Supabase: login, JWKS, Postgres and RLS | Keys for the development and test projects |
| **Login attempt limit** | Works and is tested | In server memory, so it does not work with more than one server instance | Redis or a table, when scaling |

**Positive note:** there is no fake data and no hard-coded numbers on the site. Every number shown comes from the API, and every button on the built pages works and saves to the database.

---

## Summary

### Approximate completion compared with the HTML

| Area | Percentage | Basis |
|---|---|---|
| **Core infrastructure** (database, authentication, permissions, security, language and theme, tests) | ~85% | Missing: verification on Supabase, storage, and alerts |
| **HR system features** | ~12% | 18 pages: complete ones are employees (mostly), part of the dashboard, and login accounts |
| **Employee app features** | ~15% | 10 tabs: complete ones are profile and settings, and part of Home |
| **Approval workflow** | 0% | Only the tables and rules are ready |
| **Total (features)** | **~15%** | The foundation is solid, but most business modules are not built |

### [DECIDE] items and pending questions

**Decided:**
- End-of-service award basis: basic + housing.
- Years of service: days ÷ 365.
- Saudization: simple count.
- Approval stages: by request type.

**Still need your decision:**
1. **2024 opening balance:** the old code carries over only what exceeds 10 days of the 2023 balance. Where do the first 10 days go?
2. **Late minutes:** calculated from 8:00 or from 8:15 (after the grace period)?
3. **Leave compensation in the settlement:** on basic only (as in the old system), or basic + housing (like the end-of-service award)?
4. **Extra allowance:** a separate field outside the payroll total as in the old system, or merged into "other allowances"?
5. **The eighth template «إشعار انتهاء عقد» ("Contract expiry notice"):** should it be added?
6. **Official company name in letters:** «أريبا للاستشارات» ("Ariba Consulting"), «شركة اريبا لخدمات الأعمال» ("Ariba Business Services Company"), or «شركة حلول أريبا لخدمات الأعمال» ("Ariba Solutions Business Services Company")?
7. **Fixed-term contract end:** start date + duration (current), or minus one day?
8. **GOSI for Saudis on a non-WPS system:** the old system makes it zero. Is this intended?
9. **Gender determination:** the old system infers it from a hard-coded list of first names in the code (Mona, Zainab, Reem, …), and the new system has an explicit field. Do we fill it manually during data migration, or use the same inference once and then have HR review it?

**Still needed from you:**
- Keys for the two Supabase projects.
- Your colleagues' names on GitHub.
- Optional: the ARIBA Two font and letterhead images.

---

# العربي

## تقرير مراجعة المرحلة الأولى

**التاريخ:** 2026-10-04
**الفرع:** `feat/foundation` (آخر commit: `e8ca7c9`)
**المرجع:** ملفّا النموذج الأولي V114
- `_1_HR_برنامج_الموارد_البشرية_V114.html`: 12,245 سطراً
- `_2_EMPLOYEE_تطبيق_الموظف_V114 1.html`: 3,108 أسطر

**المنهجية:**
- استخرجت من ملفّي HTML كل الصفحات (`pg-*`) وقائمة التنقل (`PG_NAV`) والنوافذ والتبويبات والأزرار والجداول والحسابات.
- طابقت كل عنصر مع الكود الفعلي في المستودع (الواجهة + API + قاعدة البيانات)، وشغّلت الاختبارات.

**قاعدة الحكم:** العنصر «مكتمل» فقط إذا تحققت فيه أربعة شروط:
1. واجهته موجودة.
2. مربوط بـ API.
3. يُحفظ في قاعدة البيانات.
4. صلاحياته مطبّقة في السيرفر.

---

## القسم 1: ماذا فعلت

### 1.1 الملفات والمجلدات الرئيسية

```
ariba-hr/
├── README.md · .gitignore · .vscode/ · .claude/launch.json
├── docs/        PROJECT_STATUS · ARCHITECTURE · SECURITY · BUSINESS_RULES · DATABASE
│                FEATURE_auth · FEATURE_employees · PHASE1_REVIEW (هذا الملف)
├── backend/
│   ├── requirements.txt · .env.example · alembic.ini · README.md
│   ├── alembic/env.py · alembic/versions/0001_baseline_schema.py · 0002_seed_reference_data.py
│   ├── app/main.py · config.py · database.py · models.py · schemas.py · migrations.py
│   ├── app/core/      auth · identity · permissions · security · errors · audit · storage
│   │                  scheduling · language · pagination
│   ├── app/routers/   auth · me · employees · settings · health
│   ├── app/services/  employees · accounts · contracts · saudization · seeds
│   │                  + ملفات فارغة (وصف فقط): leave · payroll · gosi · end_of_service
│   │                    attendance · geofence · workflow · alerts · templates · dashboard
│   └── tests/         conftest + 6 ملفات اختبار
└── frontend/
    ├── README.md · DESIGN.md · next.config.ts (ترويسات أمان) · .env.example
    └── src/
        ├── proxy.ts (حماية المسارات؛ اسمه في Next 16 بدل middleware.ts)
        ├── app/ (28 صفحة: 10 مبنية + 18 مؤقتة)
        ├── components/ui/ · components/nav/ · components/employees/ · components/me/
        └── lib/  api.ts · session.ts · auth.ts · auth-context.tsx · employees.ts · routes.ts
                  validation.ts · format.ts · theme.tsx · prefs.ts · use-api.ts
                  i18n/ar.ts · en.ts · locale.tsx
```

### 1.2 قاعدة البيانات

**25 جدولاً و27 نوع Enum:**

| المجموعة | الجداول |
|---|---|
| مرجعية | `workplaces` · `departments` · `nationalities` · `holidays` · `gosi_rules` · `workflow_rules` · `company_settings` · `attendance_settings` |
| الأشخاص | `employees` · `users` · `dependents` · `excluded_candidates` |
| الحضور | `locations` · `attendance_records` |
| الطلبات | `requests` · `request_steps` |
| الإجازات | `leave_year_ledgers` · `leave_adjustments` |
| الرواتب | `payroll_runs` · `payroll_rows` |
| نهاية الخدمة | `settlements` · `settlement_items` |
| الملفات | `documents` · `template_letters` |
| التدقيق | `audit_logs` |

**الـ Migrations:**
- `0001_baseline_schema`: ينشئ كل الجداول، وعلى Postgres ينشئ أنواع Enum الأصلية ويفعّل RLS على كل جدول.
- `0002_seed_reference_data`: البيانات الأولية:
  - 5 جهات عمل و8 أقسام و10 جنسيات.
  - 6 إجازات رسمية: يوم التأسيس، اليوم الوطني، وعيدا الفطر والأضحى لعامي 2026 و2027.
  - 6 قواعد تأمينات.
  - إعدادات الشركة والحضور.
  - 17 قاعدة لمراحل الاعتماد.

**سياسات RLS:**
- مفعّل على كل الجداول بدون أي سياسة، فدور `anon` ودور `authenticated` في Supabase لا يقرآن شيئاً.
- الكود في `0001_baseline_schema.py` سطر 590.
- ⚠️ **لم يُطبَّق على Postgres فعلياً بعد**، لأن مفاتيح Supabase لم تصل.

**ملاحظة مهمة:** أغلب هذه الجداول موجودة في المخطط فقط، بدون أي API أو واجهة تستخدمها. الجداول المستخدمة فعلاً:
- `employees` و`users`.
- `workplaces` و`departments` و`nationalities` (للقراءة).
- `audit_logs` (للكتابة).

### 1.3 الـ API (كل الـ endpoints الموجودة فعلاً: 19)

| Method | المسار | الوظيفة | من يستخدمه |
|---|---|---|---|
| GET | `/health` | فحص السيرفر وقاعدة البيانات | عام |
| POST | `/api/v1/auth/login` | الدخول باسم المستخدم (مع حدّ للمحاولات) | عام |
| POST | `/api/v1/auth/refresh` | تجديد الجلسة | عام (يحتاج refresh token) |
| POST | `/api/v1/auth/logout` | الخروج | أي مستخدم |
| POST | `/api/v1/auth/change-password` | تغيير كلمة المرور حسب السياسة | أي مستخدم |
| POST | `/api/v1/auth/users` | إنشاء حساب دخول لموظف بكلمة مرور مؤقتة | الموارد البشرية، مدير النظام |
| PATCH | `/api/v1/auth/users/{id}` | تغيير الدور (مدير النظام فقط)، والتفعيل والتعطيل | الموارد البشرية، مدير النظام |
| POST | `/api/v1/auth/users/{id}/temporary-password` | إصدار كلمة مرور مؤقتة | الموارد البشرية، مدير النظام |
| GET | `/api/v1/auth/users/by-employee/{id}` | معرفة حساب الدخول المرتبط بموظف | الموارد البشرية، مدير النظام |
| GET | `/api/v1/me` | بيانات المستخدم الحالي | أي مستخدم |
| GET | `/api/v1/me/employee` | سجل الموظف الخاص بالمستخدم | أي مستخدم له سجل موظف |
| GET | `/api/v1/employees` | القائمة: 8 تبويبات، فلتر جهة العمل والقسم، بحث، ترتيب، ترقيم | الكل عدا المالية (حسب النطاق) |
| GET | `/api/v1/employees/counts` | أعداد التبويبات ونسبة السعودة | الكل عدا المالية |
| POST | `/api/v1/employees` | إضافة موظف | الموارد البشرية، مدير النظام |
| GET | `/api/v1/employees/{id}` | تفاصيل موظف (خارج النطاق ← 404) | الكل عدا المالية |
| PATCH | `/api/v1/employees/{id}` | تعديل موظف | الموارد البشرية، مدير النظام |
| POST | `/api/v1/employees/{id}/terminate` | إنهاء خدمة (التاريخ + المادة + السبب) | الموارد البشرية، مدير النظام |
| POST | `/api/v1/employees/{id}/reactivate` | إعادة تفعيل موظف | الموارد البشرية، مدير النظام |
| GET | `/api/v1/settings/lookups` | جهات العمل والأقسام والجنسيات | أي مستخدم |

### 1.4 صفحات الواجهة

| الصفحة | الحالة |
|---|---|
| `/login` | ✅ مبنية |
| `/dashboard` | 🟡 جزئية: الأعداد ونسبة السعودة فقط |
| `/employees` | ✅ مبنية |
| `/employees/new` | ✅ مبنية |
| `/employees/[id]` | ✅ مبنية (تبويب التابعين مؤقت) |
| `/me` | 🟡 جزئية |
| `/me/profile` | ✅ مبنية |
| `/me/settings` | ✅ مبنية |
| `/` | توجيه حسب الدور |

**الصفحات المؤقتة (18):** تعرض «لم تُبنَ بعد».
- **البوابة:** `attendance` · `locations` · `leaves` · `payroll` · `payslips` · `end-of-service` · `settlement` · `documents` · `templates` · `reports` · `settings`
- **تطبيق الموظف:** `me/attendance` · `me/leaves` · `me/salary` · `me/team` · `me/overtime` · `me/documents` · `me/approvals`

### 1.5 المصادقة والصلاحيات والأمان

**المصادقة**
- **مسار الدخول:** رقم الموظف ← بريد داخلي ← Supabase Auth عبر السيرفر. المتصفح لا يتصل بـ Supabase أبداً.
- **التحقق من التوكن:** بمفتاح HS256 أو عبر JWKS. السيرفر يرفض التوكن المنتهي، وتوكن التجديد، والحساب المعطّل.
- **تغيير كلمة المرور:** إجباري للحسابات ذات كلمة المرور المؤقتة. حتى يغيّرها المستخدم، كل endpoints مقفلة عليه عدا `/me` و`/auth/change-password`.
- **سياسة كلمة المرور:** 8 أحرف على الأقل، فيها حروف وأرقام، ومختلفة عن القديمة.
- **الدخول المحلي:** مزوّد دخول محلي للتطوير فقط، يرفضه الإعداد في بيئة الإنتاج.

**الصلاحيات (في السيرفر)**

| الدور | الموظفون | الراتب | الهوية كاملة |
|---|---|---|---|
| موظف | نفسه فقط | راتبه | هويته |
| مدير | نفسه + فريقه المباشر | راتبه فقط | هويته فقط |
| مالية | ممنوع (403) | — | — |
| موارد بشرية / مدير النظام | الكل | ✔ | ✔ |
| رئيس تنفيذي | الكل | ✘ | ✘ (مخفية) |

**الأمان**
- صيغة أخطاء موحّدة.
- ترويسات أمان في الـ API وفي Next.js، منها CSP.
- CORS بقائمة نطاقات مسموحة فقط.
- حدّ لمحاولات الدخول: 5 لكل مستخدم و20 لكل IP خلال 5 دقائق.
- سجل تدقيق للدخول الناجح والفاشل، ولقراءة القوائم والتفاصيل، ولكل تعديل.
- الأسرار في ملفات `.env` فقط، ولا شيء منها في git (تحققت قبل الرفع).

### 1.6 الاختبارات (نتيجة التشغيل الفعلي اليوم)

```
backend:  45 passed, 1 skipped in 1.44s
          test_auth 15 · test_employees 10 · test_permissions 7 · test_security 7
          test_scheduling 4 · test_migrations 3
          skipped: test_postgres_migrations_and_rls (TEST_DATABASE_URL not set)
frontend: eslint ✔ (0 warnings) · tsc --noEmit ✔ · next build ✔
```

- جرّبت المشروع يدوياً في المتصفح، بالعربي والإنجليزي وبالوضعين النهاري والليلي:
  دخول ← تغيير كلمة المرور الإجباري ← لوحة المعلومات ← قائمة الموظفين ← إضافة موظفة بعقد محدد (نهاية العقد حُسبت) ← صفحة الموظفة.
- جرّبت أيضاً نسخة جديدة من GitHub (clone): الاختبارات والبناء نجحا.

### 1.7 التشغيل على localhost

```bash
# Terminal 1 — backend
cd ~/Desktop/HR/ariba-hr/backend && .venv/bin/uvicorn app.main:app --reload --port 8000
# Terminal 2 — frontend
cd ~/Desktop/HR/ariba-hr/frontend && npm run dev
```

- **التطبيق:** http://localhost:3000
- **توثيق الـ API:** http://localhost:8000/docs
- **حساب الاختبار:** `emp084` (مدير النظام). كلمة المرور في `backend/.env.test.local`.
- **على جهاز جديد:** ثبّت المتطلبات أولاً كما في `README.md` (`pip install` و`npm install` ونسخ ملفات `.env.example`).

---

## القسم 2: ما هو الناقص (موجود في الـ HTML ولم يُبنَ إطلاقاً)

> «لم يُبنَ» = لا واجهة تعمل، ولا API، ولا منطق حساب. بعضها له جدول في قاعدة البيانات فقط، وذكرت ذلك في الملاحظة.

### نظام الموارد البشرية

| العنصر | مكانه في الـ HTML | الأولوية | ملاحظة |
|---|---|---|---|
| **الحضور والانصراف:** السجل اليومي | `pg-att` (س 795) | عالية | جدول `attendance_records` موجود فقط |
| **التقرير الشهري للحضور** | `pg-att`: زر «تقرير شهري» وفلتر الموظف | عالية | — |
| **إضافة وتعديل سجل حضور يدوياً** | نافذة «تسجيل/تعديل حضور»: الموظف، التاريخ، الحضور، الانصراف، الموقع، الحالة | عالية | — |
| **مواقع البصمة:** القائمة والإضافة والحذف | `pg-loc` (س 910) + نافذة «إضافة موقع بصمة» | عالية | الحقول: الاسم، جهة العمل، النوع، النطاق بالمتر، الإحداثيات، زر «موقعي الحالي»، خريطة Google. جدول `locations` موجود فقط |
| **الإجازات:** الطلبات المعلقة | `pg-lv` (س 802): تبويب «معلقة» + فلاتر الموظف والنوع والحالة | عالية | — |
| **كل طلبات الإجازة** | `pg-lv`: «كل الطلبات» | عالية | — |
| **طلب إجازة جديد من HR** | `pg-lv`: «طلب جديد» (الموظف، من، إلى، ملاحظات، مرفق 12MB) | عالية | يقابله `ariba_hr_record_leave` في النظام القديم |
| **أرصدة الإجازات وتفاصيل رصيد موظف** | `pg-lv`: «الأرصدة» ← اختيار الموظف | عالية | جدولا `leave_year_ledgers` و`leave_adjustments` موجودان فقط |
| **تعديل الرصيد سنة بسنة مع السبب** | `pg-lv`: زر «تعديل الرصيد» | عالية | — |
| **منطق الإجازات** | دوال `leaveYear*` (س 1734–1858) | عالية | الاستحقاق والدفتر والترحيل حتى 10 أيام ورصيد نهاية الخدمة وقاعدة 2024. `services/leave.py` ملف فارغ |
| **الإجازات الرسمية:** العرض والإضافة | `pg-lv`: «الإجازات الرسمية» + نافذة «إضافة إجازة رسمية» | متوسطة | جدول `holidays` فيه بيانات أولية، لكن بدون API |
| **العمل الإضافي (من HR)** | `pg-lv`: «⏱️ عمل إضافي» (الموظف، التاريخ، الساعات، السبب، مرفق) + جدول الطلبات | متوسطة | — |
| **سير الاعتماد:** موظف ← مدير مباشر ← HR ← رئيس تنفيذي | `workflowHrAct` · `ariba_workflow_action` · `ariba_hr_override_workflow` · `ariba_hr_final_approve` | عالية | يشمل الرفض بسبب (نافذة «سبب الرفض»)، والاعتماد نيابةً عن المدير، والاعتماد النهائي، وسجل المراحل. جدولا `requests` و`request_steps` و`workflow_rules` موجودة فقط |
| **مسير الرواتب** | `pg-pay` (س 843) | عالية | فيه الشهر، وأيام الشهر، وفلتر نطاق العمل، وأزرار اعتماد وإضافة صف وإعادة بناء وExcel وطباعة. جدولا `payroll_runs` و`payroll_rows` موجودان فقط |
| **حساب التأمينات (GOSI)** | `calcIns` (س 2418) | عالية | جدول `gosi_rules` فيه بيانات أولية، لكن بدون منطق |
| **أرشيف المسيرات المعتمدة** | `ariba_payroll_archive` | عالية | — |
| **كشف الراتب التفصيلي** | `pg-slip` (س 897) | عالية | — |
| **نهاية الخدمة (عرض جماعي)** | `pg-eos` (س 898): تاريخ الإنهاء، زر «اليوم»، المادة، جهة العمل، Excel | عالية | — |
| **حاسبة المخالصة** | `pg-eoscalc` (س 627) | عالية | فيها الموظف، بيانات الخدمة، 9 مواد، الإجازة، أيام الحضور، استحقاقات واستقطاعات قابلة للإضافة، الإجمالي، طباعة، تصفير. جدولا `settlements` و`settlement_items` موجودان فقط |
| **طباعة المخالصة** | `buildSettlementDocV2` (س 7537) | متوسطة | — |
| **الوثائق:** تبويبات الإقامات والجوازات والتأمين الطبي والعقود | `pg-docs` (س 900) | عالية | تشمل «طباعة هذا التاب» و«طباعة الكل». البيانات (الأرقام والتواريخ) موجودة على الموظف، لكن الصفحة غير مبنية |
| **رفع ملفات الموظف** | `DOC_TYPES` (س 233): الهوية، الجواز، المؤهل، الخبرة، التأمينات، العنوان الوطني، السيرة الذاتية | عالية | جدول `documents` موجود، و`core/storage.py` مكتوب لكن غير مستخدم وغير مختبر |
| **التابعون** | تبويب ft5 في نموذج الموظف | عالية | الحقول: الصلة، الأسماء، الميلاد، الهوية، الجواز، التأمين، الجوال، المرفقات. جدول `dependents` موجود فقط |
| **القوالب السبعة (+ الثامن)** | `pg-forms` (V70، س 7941–8158) | متوسطة | مباشرة عمل، عهدة تقنية، تمديد التجربة، إنهاء التجربة، إخلاء طرف، شهادة خبرة، تقييم التجربة. على ترويسة الشركة، مع الإرسال للموظف ومتابعة حالته. جدول `template_letters` موجود فقط |
| **التقارير التسعة** | `pg-rpt` / `buildRpts` (س 2209) | متوسطة | أرصدة الإجازات، الإقامات، الجوازات، العقود، الرواتب التفصيلي، نهاية الخدمة، التنبيهات العاجلة، الموظفون الحاليون، المنتهية خدمتهم |
| **التنبيهات العاجلة** | `getAlerts` (س 1343) + بطاقة لوحة التحكم + شارة «الوثائق» | عالية | الأيام المتبقية تُحسب لكل موظف، لكن لا توجد قائمة تنبيهات ولا شارة |
| **المستبعدون** | `pg-excl` (س 936) | منخفضة | 4 جداول: مرشحون لم يباشروا، استشاريون حاليون، استشاريون مستبعدون، منتهية خدمتهم. جدول `excluded_candidates` موجود فقط |
| **المشاريع / جهات العمل** | `pg-projects` (س 965) | منخفضة | اختيار جهة العمل ثم 4 تبويبات: أساسي، وثائق، مالية، إجازات |
| **الإعدادات:** الشركة | `pg-set` (س 912) | متوسطة | الاسم بالعربي والإنجليزي، نظام العمل (السعودية/مصر/الإمارات)، بداية الدوام، هامش التأخير، حد العمل عن بعد. جدولا `company_settings` و`attendance_settings` فيهما بيانات أولية بدون API |
| **الإعدادات:** نسب التأمينات المؤرخة | `pg-set` | متوسطة | البيانات الأولية موجودة بدون API |
| **الإعدادات:** الدوام المرن | V86 · `ariba_hr_set_flexible_hours` | متوسطة | — |
| **الإعدادات:** صلاحيات المستخدمين (واجهة) | V83 · `ariba_hr_list_roles` / `ariba_hr_set_role` | متوسطة | الـ API موجود (`PATCH /auth/users/{id}`)، لكن لا توجد قائمة بالحسابات ولا واجهة |
| **تصدير Excel** | `exportPayExcel` (س 2991) · `download='EOS_…'` | متوسطة | تصدير المسير بـ 32 عموداً، وتصدير نهاية الخدمة |
| **ترحيل البيانات من V114** | قسم 3.6 من المواصفات | عالية | `backend/import_from_v114.py` غير موجود |

### تطبيق الموظف

| العنصر | مكانه في الـ HTML | الأولوية | ملاحظة |
|---|---|---|---|
| **البصمة (حضور/انصراف) بالـ GPS** | تبويب `att` · `ariba_attendance` (س 1243) | عالية | يشمل التحقق الجغرافي في السيرفر، والتأخير، ووقت الانصراف المتوقع، ورسائل خارج النطاق وخارج نافذة الدوام المرن |
| **سجل الحضور الشهري + بحث بالتاريخ** | تبويب `att` · `ariba_my_attendance_range` (س 2656) | عالية | — |
| **تقديم الطلبات بكل أنواعها (17 نوعاً)** | تبويب `lv` · `ariba_submit_request` | عالية | **الإجازات:** سنوية، مرضية، اضطرارية، وفاة، زواج، أمومة، أبوة، عمرة، حج، عن بعد. **أخرى:** مهمة، استئذان، استئذان أمومة، خروج مبكر، سلفة، نسيان بصمة، عمل إضافي. الحقول تتغير حسب النوع |
| **مرفقات الطلبات** | كل الطلبات · حد أقصى 12MB | عالية | — |
| **«طلباتي» مع حالة الطلب ومساره** | تبويب `lv` (س 1294) | عالية | تظهر المرحلة: بانتظار المدير، أو الموارد البشرية، أو الرئيس التنفيذي، أو موافق، أو مرفوض |
| **رصيد الإجازة (حتى اليوم + المتوقع 31/12)** | الرئيسية + V112 (س 2854) | عالية | — |
| **الراتب الحالي + آخر كشف معتمد + السجل** | تبويب `pay` (س 2316) | عالية | — |
| **فريقي (المدير والزملاء)** | تبويب `team` (س 1283) | متوسطة | — |
| **العمل الإضافي** | تبويب `overtime` (س 1672) | متوسطة | — |
| **المستندات + «بانتظار توقيعي»** | تبويب `docs` (س 2465) | متوسطة | يشمل عرض الخطاب، والموافقة، والرفض بسبب لا يقل عن 3 أحرف |
| **الموافقات (للمدير وHR والرئيس التنفيذي)** | تبويب `approvals` (س 1191) | عالية | — |
| **نسيان البصمة** | V-patch (س 3049) | عالية | النوع (حضور/انصراف/كلاهما)، التاريخ، الوقت، السبب. يذهب للموارد البشرية مباشرة |
| **الإجازات الرسمية القادمة في الرئيسية** | الرئيسية | منخفضة | — |

### بيانات في نموذج الموظف غير موجودة في النظام الجديد

| العنصر | مكانه في الـ HTML | الأولوية | ملاحظة |
|---|---|---|---|
| **الصورة الشخصية** | ft1: `photo` | متوسطة | العمود `photo_path` موجود في الجدول، لكن لا يوجد حقل في النموذج ولا رفع |
| **البدل الإضافي** (منفصل عن «أخرى») | ft4: `extra` / `extraAllowance` | متوسطة | مرتبط بالسؤال المفتوح رقم 4 |
| **المؤهل، نوع العمل، المسمى في العقد، استثناء منى، علامة «بالساعة»** | `expand()` (س 986): `edu`, `et`, `jc`, `mona`, `hourly` | منخفضة | «بالساعة» مغطّاة بتصنيف `hourly`، والبقية غير موجودة |
| **زر «تراجع» في نموذج التعديل** | `UB` / `uForm()` (س 664) | منخفضة | — |

---

## القسم 3: ما هو واجهة عرض فقط (يظهر لكنه غير مكتمل)

| العنصر | ما يعمل | ما لا يعمل | ما يلزم لإكماله |
|---|---|---|---|
| **لوحة التحكم** | 6 بطاقات من الـ API: الموظفون الحاليون (سعودي/غير سعودي)، نسبة السعودة، تمهير، منتهية خدمتهم، تدريب، مستشارون | لا توجد رسوم بيانية (الرواتب حسب جهة العمل، الجنسيات، جهات العمل، الأقسام)، ولا توزيع حسب الجنس، ولا التنبيهات العاجلة، ولا الطلبات المعلقة، ولا ملخص الرواتب. تظهر رسالة «تُضاف مع وحداتها» | endpoint للوحة التحكم + مكوّنات رسوم بيانية. يعتمد على وحدات الرواتب والطلبات والتنبيهات |
| **تبويب «التابعون» في نموذج الموظف** | التبويب ظاهر | يعرض «تُضاف في المرحلة القادمة» فقط | API للتابعين + جدول ونموذج إضافة |
| **تبويب «الوثائق» في نموذج الموظف** | أرقام الهوية والجواز والتأمين وتواريخ الانتهاء تُحفظ، مع شارة الأيام المتبقية | لا يمكن رفع الملفات ولا تنزيلها | ربط Supabase Storage + endpoints للوثائق |
| **حقل «المدير المباشر»** | يُحفظ ويُتحقق منه في السيرفر | القائمة تجلب أول 100 موظف فقط | بحث في القائمة إذا زاد عدد الموظفين |
| **زر «طباعة» في صفحة الموظف** | يطبع الصفحة بدون أزرار التنقل | ليس قالب طباعة رسمياً، والنموذج يُطبع بتبويب واحد فقط | قالب طباعة لملف الموظف على الترويسة |
| **الرئيسية في تطبيق الموظف** | بطاقة الموظف (الاسم، الوظيفة، جهة العمل، القسم، الجنسية، الرقم) والتاريخ الميلادي والهجري | لا يوجد رصيد إجازة، ولا آخر راتب، ولا إجازات قادمة، وتظهر رسالة «ستُضاف لاحقاً» | وحدات الإجازات والرواتب والإجازات الرسمية |
| **الشريط السفلي في تطبيق الموظف** | الأزرار الستة تنتقل بين الصفحات | 4 منها (الحضور، الإجازات، الراتب، فريقي) صفحات مؤقتة. العمل الإضافي والمستندات والموافقات غير موجودة في الشريط أصلاً | بناء الوحدات، وإظهار «الموافقات» للمدير والموارد البشرية والرئيس التنفيذي فقط |
| **القائمة الجانبية في البوابة** | كل الروابط موجودة، وتُخفى حسب الدور (المالية ترى صفحاتها فقط) | 11 رابطاً تفتح صفحات مؤقتة | بناء الوحدات |
| **صفحة «الإعدادات» في البوابة** | رابط لإعداداتي الشخصية (اللغة، المظهر، كلمة المرور) | إعدادات الشركة والتأمينات والحضور والصلاحيات غير موجودة | endpoints قراءة وكتابة للإعدادات (الجداول والبيانات الأولية جاهزة) + الواجهة |
| **تغيير الدور / تعطيل الحساب** | الـ API يعمل ومختبر، ومدير النظام فقط يغيّر الأدوار | لا توجد واجهة ولا قائمة بالحسابات | صفحة «صلاحيات المستخدمين» |
| **الإجازات الرسمية، قواعد التأمينات، مراحل الاعتماد، إعدادات الحضور** | البيانات محفوظة في قاعدة البيانات | لا يوجد API ولا واجهة، ولا شيء يستخدمها بعد (عدا حساب أيام العمل في الكود) | تبنى مع وحداتها |
| **سجل التدقيق** | يُكتب فعلاً لكل قراءة حساسة وتعديل | لا توجد شاشة لعرضه | صفحة لمدير النظام (لم تكن في الـ HTML، لكنها مطلوبة في المواصفات) |
| **`core/storage.py`** | الكود مكتوب | غير مستخدم وغير مختبر | ربطه بوحدة الوثائق |
| **الربط بـ Supabase** | الكود جاهز، ومختبر على HTTP وهمي | لم يُشغَّل على Supabase الحقيقي: الدخول وJWKS وPostgres وRLS | مفاتيح مشروعَي التطوير والاختبار |
| **حدّ محاولات الدخول** | يعمل ومختبر | في ذاكرة السيرفر، فلا يصلح لأكثر من نسخة سيرفر | Redis أو جدول، عند التوسع |

**ملاحظة إيجابية:** لا توجد في الموقع بيانات وهمية ولا أرقام ثابتة. كل رقم ظاهر قادم من الـ API، وكل زر في الصفحات المبنية يعمل ويحفظ في قاعدة البيانات.

---

## الخلاصة

### نسبة الإنجاز التقريبية مقارنةً بالـ HTML

| المحور | النسبة | الأساس |
|---|---|---|
| **البنية الأساسية** (قاعدة البيانات، المصادقة، الصلاحيات، الأمان، اللغة والمظهر، الاختبارات) | ~85% | الناقص: التحقق على Supabase، والتخزين، والتنبيهات |
| **ميزات نظام HR** | ~12% | 18 صفحة: المكتمل منها الموظفون (معظمها)، وجزء من لوحة التحكم، وحسابات الدخول |
| **ميزات تطبيق الموظف** | ~15% | 10 تبويبات: المكتمل منها الملف الشخصي والإعدادات، وجزء من الرئيسية |
| **مسار الموافقات** | 0% | الجداول والقواعد جاهزة فقط |
| **الإجمالي (ميزات)** | **~15%** | الأساس متين، لكن أغلب وحدات العمل لم تُبنَ |

### بنود [DECIDE] والأسئلة المعلّقة

**محسومة:**
- أساس مكافأة نهاية الخدمة: الأساسي + السكن.
- سنوات الخدمة: الأيام ÷ 365.
- السعودة: عدّ بسيط.
- مراحل الاعتماد: حسب نوع الطلب.

**ما زالت تحتاج قرارك:**
1. **رصيد افتتاح 2024:** الكود القديم يرحّل فقط ما زاد عن 10 أيام من رصيد 2023. أين تذهب أول 10 أيام؟
2. **دقائق التأخير:** تُحسب من 8:00 أم من 8:15 (بعد هامش السماح)؟
3. **تعويض الإجازة في المخالصة:** على الأساسي فقط (كما في النظام القديم)، أم الأساسي + السكن (مثل مكافأة نهاية الخدمة)؟
4. **البدل الإضافي:** حقل منفصل خارج إجمالي المسير كما في النظام القديم، أم يُدمج في «بدلات أخرى»؟
5. **القالب الثامن «إشعار انتهاء عقد»:** هل يُضاف؟
6. **اسم الشركة الرسمي في الخطابات:** «أريبا للاستشارات»، أم «شركة اريبا لخدمات الأعمال»، أم «شركة حلول أريبا لخدمات الأعمال»؟
7. **نهاية العقد المحدد:** المباشرة + المدة (الحالي)، أم ناقص يوم؟
8. **التأمينات للسعودي على نظام غير WPS:** النظام القديم يجعلها صفراً. هل هذا مقصود؟
9. **تحديد الجنس:** النظام القديم يستنتجه من قائمة أسماء أولى ثابتة في الكود (منى، زينب، ريم، …)، والنظام الجديد فيه حقل صريح. هل نعبّئه يدوياً عند ترحيل البيانات، أم نستخدم نفس الاستنتاج مرة واحدة ثم يراجعه الموارد البشرية؟

**ما زال مطلوباً منك:**
- مفاتيح مشروعَي Supabase.
- أسماء زملائك في GitHub.
- اختياري: خط ARIBA Two وصور الترويسة.
