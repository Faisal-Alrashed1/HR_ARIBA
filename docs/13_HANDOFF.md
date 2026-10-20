# HANDOFF — ARIBA HR Project — مشروع أريبا للموارد البشرية

> English first, then the full Arabic version (same content).

---

# English

## HANDOFF — ARIBA HR Project (full summary of the conversation)

> Last updated: 2026-10-06 · Write to me in Arabic, briefly and without padding.
> This file is enough to continue the work in a new conversation.

---

### 0. Update 2026-10-08 — the database is now the original (canonical) Supabase database
- The server now runs on the 34 Supabase tables as they are (`employee_directory` + `data` JSONB, `workflow_requests`, `employee_payrolls`…) via `backend/app/routers/canonical.py`. No Alembic and no table creation at startup; the old ORM files (`routers/*` except canonical/health, `alembic/`, `tests/`) are archive only.
- Calculation logic comes from our code: leave `services/leave.py` via `services/canonical_data.py`, social insurance (GOSI) `services/gosi.py` (settings in `ariba_app_settings['ins_settings']`), attendance punch and the approval workflow ported from the old server's functions saved in `ariba_function_backups`, and the employee record is translated in both directions in `services/employee_map.py`.
- Railway: a new database `Postgres-Q6OM` holding our colleague's data (106 employees, 110 accounts). The server `DATABASE_URL=${{Postgres-Q6OM.DATABASE_URL}}`, `RUN_MIGRATIONS_ON_STARTUP=false`. The old `Postgres` database was not touched (to roll back: point the variable back to it and deploy `1ea0d8a`), and a pg_dump copy of it is in `~/Desktop/HR/backups/`.
- Loading data into an empty database: `CANONICAL_TARGET_URL=... python tools/load_canonical.py supabase_canonical.sql` (the file is outside the repo — it contains real data).
- Sign-in uses the old system's accounts (bcrypt). The `admin` account from our old database does not exist in the new database.
- Not supported yet: dependents, adding/deleting departments and work entities. Details in `docs/14_INTEGRATION_AUDIT.md`.

### 1. Goal
Rebuild ARIBA's HR system so that it **matches 100%** the old version (the split HTML files up to update V130) in screens, fields, texts and formulas, but on modern technology:
- **An HR website** (browser).
- **A mobile app for employees** (iPhone + Android).
- **One server + database** serving both.

**The user's explicit rule:** logic and formulas are ported **as clean logic with the same results**, not copy-paste of the old UI or code. The only reference is the new split version, not the older version.

---

### 2. Technologies
| Part | Technology | Location | Deployment |
|---|---|---|---|
| Server | Python 3.12 · FastAPI · SQLAlchemy 2 · Alembic · Argon2 · JWT | `backend/` | Railway |
| Database | PostgreSQL (SQLite locally) | Railway | — |
| HR website | Next.js 16 (App Router) · React 19 · TypeScript | `frontend/hr-web/` | Railway |
| Employee app | React Native · Expo SDK 57 · expo-router · TypeScript | `frontend/employee-app/` | Not published (stores later) |
| Old reference | Split HTML/CSS/JS (231 files) | `frontend/legacy/` | Reference only — not modified |
| Documentation | Markdown | `docs/` | — |

---

### 3. Links and access
- **GitHub:** `Faisal-Alrashed1/HR_ARIBA` (private), branch `main`. Any push to `main` deploys automatically to Railway.
- **The old version of the repository before the reset:** tag `archive/before-reset` (and branch `feat/foundation`).
- **Railway:** project `sparkling-learning` (ID `12c5dc37-b739-441d-954c-08412b958fe4`, environment production `64f9e490-e396-49a8-b4e6-979d386d8709`).
  - HR website: https://frontend-production-f9a8a.up.railway.app (Root Directory: `frontend/hr-web`)
  - Server: https://hrariba-production.up.railway.app (Root Directory: `backend`, runs `alembic upgrade head` before every deploy)
  - The server service in Railway is named `HR_ARIBA`, the website service `frontend`, and there is `Postgres`.
- **Admin account on the deployed website:** username `admin` (created via `railway ssh -- python -m app.services.seeds create-user --username admin --name-ar "مدير النظام" --role admin --print`; "مدير النظام" = "System Administrator"). The password is temporary and is changed on first sign-in — **it is not written in any file**.
- **Local copy:** `/Users/fyslalrashd/Desktop/HR/HR_ARIBA` (linked to Railway via `railway link`).
- **Original files (do not touch):** `/Users/fyslalrashd/Desktop/HR/‪1_HR_برنامج_الموارد_البشرية_V114 1.html` and `‪2_EMPLOYEE_تطبيق_الموظف_V114 2.html` — md5 `27a11e07fa9bddf3c2ea268f50e71cf0` and `a3aa514f2330813c1e7efba3978b2fd9`.
- **The original split version on the machine:** `/Users/fyslalrashd/Desktop/HR/ariba-portals/`.

---

### 4. Repository structure
```
HR_ARIBA/
├── backend/
│   ├── app/{core,routers,services,models.py,schemas.py,main.py}
│   ├── alembic/versions/0001…0008
│   └── tests/
├── frontend/
│   ├── hr-web/        (src/app/(hr)/(portal)/*, src/components, src/lib, src/lib/calc, src/styles/hr|employee)
│   ├── employee-app/  (app/(tabs), app/login.tsx, app/change-password.tsx, src/lib/api.ts, src/lib/auth.tsx, src/theme.ts)
│   └── legacy/{hr-portal,employee-portal}/{index.html,css/,js/}
└── docs/
    ├── 10_ARIBA_HR_System_Documentation.md  ← the specification (section 4 = all formulas with numeric examples, section 9 = 35 open questions)
    ├── 11_ROADMAP.md, 01_ARCHITECTURE.md, 04_BUSINESS_RULES.md, 02_DATABASE.md, 07_DEPLOY_RAILWAY.md, 03_SECURITY.md
    └── 13_HANDOFF.md (this file)
```

---

### 5. Sequence of what was done (the whole conversation)

#### 5.1 Splitting the old HTML files (complete)
- Each HTML file was split into `index.html` + `css/` + `js/` (HR: 27 CSS + 141 JS, employee: 14 CSS + 47 JS), and the formulas are in `js/calculations/`.
- Verification: reassembling = the original file character for character; a Playwright run comparing 13 pages (look + variables + formulas) = identical.
- Full documentation: `docs/10_ARIBA_HR_System_Documentation.md`.

#### 5.2 The repository and deployment
- The repository was reset (after saving `archive/before-reset`), then the server and website were restored from the archive and the Expo app was built, and the split files were moved to `frontend/legacy`.
- The website CSS was split into files with the same names as the split files (`src/styles/hr/*`, `src/styles/employee/*`).
- It was discovered that the first website was built from an older HTML version → the only reference became the new version.

#### 5.3 The server (Backend) — what exists now
- **Sign-in and security:** Argon2, JWT with refresh, forced password change, attempt limit, audit log, 6 roles: `employee, manager, finance, hr, ceo, admin`.
- **Employees:** add/edit/terminate/reinstate, documents, photo, dependents, salary preview.
- **Social insurance:** `services/gosi.py` + V130 exemption `exempt_kind` (Tamheer/consultant/trainee + non-WPS).
- **End of service:** `services/end_of_service.py` (years = days ÷ 365.25 rounded, Art. 77 rounded to the riyal).
- **Contract end:** `services/contracts.py` `fixed_term_end` = add the months − one day (like `addMonthsSafe`). + `apply_auto_terminations` (automatic termination/reinstatement for fixed-term contracts, called in the employee list, the dashboard and the payroll data).
- **Leave engine:** `services/leave.py` (`LeaveBook`) — clean logic **matching 100%** the old code (test `tests/test_leave_engine.py` with numbers extracted from running the old JS). Reads from `leave_year_overrides`, `leave_adjustments`, `employees.leave_eos_excess`, approved requests and holidays. + `used_through` for the column "ما تم استحقاقه" ("accrued so far").
- **Approval workflow:** `services/workflow.py` (stages from `workflow_rules`: leave/remote/advance → manager ← HR ← CEO; permission/overtime/assignment → manager ← HR; forgotten punch → HR only). Approve, approve on behalf, final approval, reject with reason, delete (restores the balance).
- **Routers (all under `/api/v1`):** `auth, me, dashboard, employees, dependents, documents, salary, settings, sheets (+payroll-archive), locations (+assignments, work-locations), attendance (+range, summary), leave (holidays, requests, balances, used-through), registry (documents), letters (+me/letters)`.
- **Tests:** last full run = 74 passed (after that the user asked to stop running tests to save time).

#### 5.4 The database (Alembic files)
| File | Contents |
|---|---|
| 0001 | Core tables (the previous project) |
| 0002 | Reference data (work entities, departments, nationalities, holidays, social insurance rates, approval stages) |
| 0003 | Employee overtime allowance |
| 0004 | Hashed passwords `credentials` |
| 0005 | `sheets` (flexible keyed storage: the logo `company_logo`, the signature and stamp `hr_signer`) |
| 0006 | `sent_letters` (forms sent to the employee) |
| 0007 | **Schema cleanup:** attendance allows more than one session per day; `payroll_runs`/`payroll_rows` linked tables (the full payroll row in `data` JSON + totals as columns); new `leave_year_overrides` + `leave_adjustments`; `employees.leave_eos_excess`; dropped the old `settlements, settlement_items, template_letters, leave_year_ledgers`; CASCADE for request steps; CHECK on type and status of `sent_letters`. **One-way (downgrade not supported).** |
| 0008 | `employee_locations` (punch locations per employee — V121) |
- 40+ real Foreign Key relationships. The employee is the hub.
- Payroll: the website still uses `GET/PUT /sheets/pay_YYYY_MM` but the server actually stores them in `payroll_runs/rows`.

#### 5.5 The website (hr-web) — all pages are built
Dashboard, employees, attendance (+ V117 reports + monthly report), punch locations (+ linked employees V121), leave (6 tabs + optional attachment + year-by-year balance editor), payroll V119 (+ automatic "ما تم استحقاقه" ("accrued so far") + "بدون خصم" ("no deduction") + archive of approved payrolls), payslip, end of service, final settlement (+ printing an official settlement with the amount in words), documents, reports (9), settings (9 cards + show signature/stamp), forms (9 forms + bulk send + English versions + salary letter language + sent status).
- Calculation libraries: `src/lib/calc/` (`payx.ts` the payroll engine, `settlement.ts`, `settlement-doc.ts`, `eos.ts`, `tafqeet.ts`, `forms.ts`, `forms-en.ts`, `payroll.ts`).
- `listAllEmployees` fetches all pages (the server limits 100 per page).

#### 5.6 Matching the old version
- Automatic comparison: running the old version and extracting 380 elements (buttons/tabs/titles/fields) and comparing them with the website → **97%**. The rest are minor wording differences.
- **Formulas match in numbers:** payroll (AV 89,168.24 · AK 47,203.65 · AC 28,816.67), final settlement (Art. 84 140,224 · Art. 85 116,618.44 · Art. 77 193,132 · Art. 80 69,407.33), leave (balance 25.81), amount in words (12,345.67 / 2,000), contract end (2025-03-10+24 = 2027-03-09).

#### 5.7 The mobile app — foundation only
Exists: sign-in, change password, home, salary, my profile, sign-out; the old app's colors and the ARIBA Two font; RTL. Currently pointed at `localhost` (`EXPO_PUBLIC_API_URL`). Temporary app identifier `sa.ariba.employee`. Not tried on a real phone.

---

### 6. Known technical debt (unresolved — by the user's decision to start the app first)
1. **`frontend/hr-web/src/lib/calc/payx.ts` is copied verbatim** from the old JS file (`// @ts-nocheck`). Needed later: rewrite it as clean logic with the same results.
2. `settlement.ts` is ported line by line from `sRun`.
3. Payroll, final settlement, end of service and attendance report calculations run in the **browser**; it would be better to move them to the server.
4. Migration 0007 has no downgrade (an upgrade/downgrade test will fail).
5. Features were added after the last test run (the user's request: no tests for now).
6. The payslip shows `otherDeduct || loanDeduct` (intentional old behavior).
7. The 35 questions in section 9 of the documentation still have no answer from the HR staff member.

---

### 7. Next step: the mobile app
**How it connects:** the app does not talk to the website; both talk to the same server and database, so everything shows up immediately on the other side.

**Ready in the server for the app:** `/auth/*`, `/me`, `/me/employee`, `/me/letters` (+ `/me/letters/{id}/respond`), `/letters/{id}/html`.

**Missing in the server (must be built):**
- Mobile punch: `POST /me/attendance/punch` (GPS, nearest location, the radius — saving enforces 1000 m for non-"عن بعد" ("remote") per V38, the employee's V121 locations or their work entity's locations, flexible hours and expected check-out, lateness and early leave), and my log `GET /me/attendance`.
- My requests: `POST /me/requests` (leave of all types, permission, advance, overtime, forgotten punch → goes directly to HR) + `GET /me/requests` + my balance `GET /me/leave`.
- My team and manager approvals: `GET /me/team`, `GET /me/approvals`, `POST /me/approvals/{id}`.
- My payslips from approved payrolls: `GET /me/payslips`.
- Notifications.

**Done (2026-10-06):**
- ✅ 1. The app is connected by default to the deployed server (`src/lib/api.ts`, and `.env.example`).
- ✅ 2. GPS punch: `services/geofence.py` (Haversine) + `services/punch.py` + `GET /me/attendance` and `POST /me/attendance/punch {action in|out, lat, lng}`. Errors: `outside_geofence` (with the nearest location and its distance), `too_early_for_flexible_window`, `too_late_for_flexible_window`, `remote_limit_reached`, `already_checked_in`, `not_checked_in`. Lateness from the first session only; flexible hours: no lateness and expected check-out = first check-in + the hours. Attendance screen in the app (Riyadh clock, location status, back to work, today's sessions, 31-day log). + Fix: attendance times are shown in Riyadh time (`attendance.local`) instead of UTC from Postgres.
- ✅ 3+4. Requests, balance, team and approvals: `routers/me_requests.py` — `GET/POST /me/requests`, `DELETE /me/requests/{id}` (unapproved only), `GET /me/leave`, `GET /me/team`, `GET /me/approvals`, `POST /me/approvals/{id} {action approve|reject, reason}` (the direct manager for the manager stage, hr/admin for the HR stage, ceo/admin for the CEO stage). Approving a "نسيان بصمة" ("forgotten punch") request records the attendance automatically (`punch.record_forgot_punch`). Leave and My Team screens in the app. Attachments in app requests are not built yet, and dates are typed as text (YYYY-MM-DD).
- ✅ 5. Forms: a "مستندات" ("Documents") tab + screen `app/letter/[id].tsx` (HTML view via `react-native-webview` + accept/object with a reason ≥ 3 characters). Payslips: `GET /me/payslips` (approved payrolls only, V119 payslip fields) in the salary tab.
- ✅ 6. Notifications: `GET /me/notifications` (forms awaiting a reply, decisions on my requests in the last 60 days, requests awaiting my approval) + a bell with a counter in the header of every tab + screen `app/notifications.tsx`; "مقروء" ("read") is saved on the device. Push notifications were not built: they need an Expo/EAS account and a custom build (Expo Go does not support them on Android).
- ⏳ 7. Testing on a phone: not done (no Xcode/simulator on the machine). Verification done: `tsc` + `expo export` + temporary API tests.
- Note: the old `ariba_attendance` logic was in Supabase and not in the files; it was built from the documentation's description (3.2.4, 4.11, 4.12).

**The app plan in order:**
1. Connect it to the deployed server (`EXPO_PUBLIC_API_URL=https://hrariba-production.up.railway.app`).
2. GPS punch (most important).
3. Leave, requests and balance.
4. My team and approvals.
5. Forms (accept/object with a reason ≥ 3 characters) and payslips.
6. Notifications.
7. Testing on the user's phone via Expo Go, then the stores (needs Apple Developer + Google Play).

**Reference for the app:** `frontend/legacy/employee-portal/` + sections 3 and 6 of the documentation.

---

### 8. Useful commands
```bash
# Server locally
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000
# Website locally
cd frontend/hr-web && npm run dev
# The app
cd frontend/employee-app && npx expo start
# Check the website
cd frontend/hr-web && npx tsc --noEmit && npm run lint
# Deployment status
railway status --json -p 12c5dc37-b739-441d-954c-08412b958fe4 -e 64f9e490-e396-49a8-b4e6-979d386d8709
# If git push fails with HTTP 400
git config http.postBuffer 524288000
```

### 9. Rules for working with the user
- Reply in Arabic, briefly, without spending extra tokens; say "خلصت" ("done") when finished.
- Do not modify `frontend/legacy` or the original files. Do not change Railway/Supabase/Netlify settings. Do not inspect the old Supabase database.
- Do not write real passwords anywhere, and do not create accounts on the deployed website yourself (the user runs the command).
- Small commits on `main` with the line: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

# العربي

## HANDOFF — مشروع أريبا للموارد البشرية (ملخص كامل للمحادثة)

> آخر تحديث: 2026-10-06 · اكتب لي بالعربي، باختصار وبدون إطالة.
> هذا الملف كافٍ لمواصلة العمل في محادثة جديدة.

---

### 0. تحديث 2026-10-08 — قاعدة البيانات صارت قاعدة Supabase الأصلية (canonical)
- الخادم يشتغل الآن على جداول Supabase الـ 34 كما هي (`employee_directory` + `data` JSONB، `workflow_requests`، `employee_payrolls`…) عبر `backend/app/routers/canonical.py`. لا Alembic ولا إنشاء جداول عند التشغيل؛ ملفات ORM القديمة (`routers/*` عدا canonical/health، `alembic/`, `tests/`) أرشيف فقط.
- منطق الحسابات من كودنا: الإجازات `services/leave.py` عبر `services/canonical_data.py`، التأمينات `services/gosi.py` (الإعدادات في `ariba_app_settings['ins_settings']`)، البصمة وسير الاعتماد منقولة من دوال الخادم القديم المحفوظة في `ariba_function_backups`، وملف الموظف مترجم بالاتجاهين في `services/employee_map.py`.
- Railway: قاعدة جديدة `Postgres-Q6OM` فيها بيانات زميلنا (106 موظف، 110 حساب). الخادم `DATABASE_URL=${{Postgres-Q6OM.DATABASE_URL}}`, `RUN_MIGRATIONS_ON_STARTUP=false`. القاعدة القديمة `Postgres` لم تُلمس (للرجوع: أرجع المتغير لها وانشر `1ea0d8a`)، ونسخة pg_dump منها في `~/Desktop/HR/backups/`.
- تحميل البيانات لقاعدة فاضية: `CANONICAL_TARGET_URL=... python tools/load_canonical.py supabase_canonical.sql` (الملف خارج الريبو — فيه بيانات حقيقية).
- الدخول بحسابات النظام القديم (bcrypt). حساب `admin` الخاص بقاعدتنا القديمة غير موجود في القاعدة الجديدة.
- غير مدعوم بعد: المرافقين، إضافة/حذف الأقسام وجهات العمل. التفاصيل في `docs/14_INTEGRATION_AUDIT.md`.

### 1. الهدف
إعادة بناء نظام الموارد البشرية لشركة أريبا بحيث **يطابق 100%** النسخة القديمة (ملفات HTML المفصولة حتى التحديث V130) في الشاشات والحقول والنصوص والمعادلات، لكن على تقنيات حديثة:
- **موقع للموارد البشرية** (متصفح).
- **تطبيق جوال للموظف** (iPhone + Android).
- **خادم واحد + قاعدة بيانات** يخدم الاثنين.

**قاعدة المستخدم الصريحة:** المنطق والمعادلات تُنقل **كمنطق نظيف بنفس النتائج**، مو نسخ ولصق للواجهات أو الكود القديم. المرجع الوحيد هو النسخة المفصولة الجديدة، وليس النسخة الأقدم.

---

### 2. التقنيات
| الجزء | التقنية | المكان | النشر |
|---|---|---|---|
| الخادم | Python 3.12 · FastAPI · SQLAlchemy 2 · Alembic · Argon2 · JWT | `backend/` | Railway |
| قاعدة البيانات | PostgreSQL (SQLite محلياً) | Railway | — |
| موقع HR | Next.js 16 (App Router) · React 19 · TypeScript | `frontend/hr-web/` | Railway |
| تطبيق الموظف | React Native · Expo SDK 57 · expo-router · TypeScript | `frontend/employee-app/` | لم يُنشر (المتاجر لاحقاً) |
| المرجع القديم | HTML/CSS/JS مفصول (231 ملف) | `frontend/legacy/` | مرجع فقط — لا يُعدّل |
| التوثيق | Markdown | `docs/` | — |

---

### 3. الروابط والوصول
- **GitHub:** `Faisal-Alrashed1/HR_ARIBA` (خاص)، الفرع `main`. أي push على `main` يُنشر تلقائياً على Railway.
- **النسخة القديمة من المستودع قبل التصفير:** العلامة `archive/before-reset` (وفرع `feat/foundation`).
- **Railway:** مشروع `sparkling-learning` (ID `12c5dc37-b739-441d-954c-08412b958fe4`, environment production `64f9e490-e396-49a8-b4e6-979d386d8709`).
  - موقع HR: https://frontend-production-f9a8a.up.railway.app (Root Directory: `frontend/hr-web`)
  - الخادم: https://hrariba-production.up.railway.app (Root Directory: `backend`، يشغّل `alembic upgrade head` قبل كل نشر)
  - خدمة الخادم في Railway اسمها `HR_ARIBA`، وخدمة الموقع `frontend`، وفيه `Postgres`.
- **حساب المدير على الموقع المنشور:** اسم المستخدم `admin` (أُنشئ عبر `railway ssh -- python -m app.services.seeds create-user --username admin --name-ar "مدير النظام" --role admin --print`). كلمة المرور مؤقتة وتُغيَّر أول دخول — **لا تُكتب في أي ملف**.
- **نسخة محلية:** `/Users/fyslalrashd/Desktop/HR/HR_ARIBA` (مربوطة بـ Railway عبر `railway link`).
- **الملفات الأصلية (لا تُلمس):** `/Users/fyslalrashd/Desktop/HR/‪1_HR_برنامج_الموارد_البشرية_V114 1.html` و `‪2_EMPLOYEE_تطبيق_الموظف_V114 2.html` — md5 `27a11e07fa9bddf3c2ea268f50e71cf0` و `a3aa514f2330813c1e7efba3978b2fd9`.
- **النسخة المفصولة الأصلية على الجهاز:** `/Users/fyslalrashd/Desktop/HR/ariba-portals/`.

---

### 4. هيكل المستودع
```
HR_ARIBA/
├── backend/
│   ├── app/{core,routers,services,models.py,schemas.py,main.py}
│   ├── alembic/versions/0001…0008
│   └── tests/
├── frontend/
│   ├── hr-web/        (src/app/(hr)/(portal)/*, src/components, src/lib, src/lib/calc, src/styles/hr|employee)
│   ├── employee-app/  (app/(tabs), app/login.tsx, app/change-password.tsx, src/lib/api.ts, src/lib/auth.tsx, src/theme.ts)
│   └── legacy/{hr-portal,employee-portal}/{index.html,css/,js/}
└── docs/
    ├── 10_ARIBA_HR_System_Documentation.md  ← المواصفات (القسم 4 = كل المعادلات بأمثلة رقمية، القسم 9 = 35 سؤال مفتوح)
    ├── 11_ROADMAP.md, 01_ARCHITECTURE.md, 04_BUSINESS_RULES.md, 02_DATABASE.md, 07_DEPLOY_RAILWAY.md, 03_SECURITY.md
    └── 13_HANDOFF.md (هذا الملف)
```

---

### 5. تسلسل ما تم (كل المحادثة)

#### 5.1 فصل ملفات HTML القديمة (مكتمل)
- كل ملف HTML قُسّم إلى `index.html` + `css/` + `js/` (HR: 27 CSS + 141 JS، الموظف: 14 CSS + 47 JS)، والمعادلات في `js/calculations/`.
- التحقق: إعادة التركيب = الملف الأصلي حرف بحرف؛ تشغيل Playwright مقارنة 13 صفحة (شكل + متغيرات + معادلات) = متطابق.
- التوثيق الكامل: `docs/10_ARIBA_HR_System_Documentation.md`.

#### 5.2 المستودع والنشر
- صُفّر المستودع (بعد حفظ `archive/before-reset`)، ثم أُعيد الخادم والموقع من الأرشيف وبُني تطبيق Expo، ونُقلت الملفات المفصولة إلى `frontend/legacy`.
- تقسيم CSS الموقع إلى ملفات بنفس أسماء ملفات الفصل (`src/styles/hr/*`, `src/styles/employee/*`).
- اكتُشف أن الموقع الأول بُني من نسخة HTML أقدم → صار المرجع الوحيد هو النسخة الجديدة.

#### 5.3 الخادم (Backend) — الموجود الآن
- **الدخول والأمان:** Argon2، JWT مع تجديد، تغيير كلمة المرور الإجباري، حد محاولات، سجل عمليات، 6 أدوار: `employee, manager, finance, hr, ceo, admin`.
- **الموظفين:** إضافة/تعديل/إنهاء/إرجاع، مستندات، صورة، مرافقين، معاينة الراتب.
- **التأمينات:** `services/gosi.py` + إعفاء V130 `exempt_kind` (تمهير/استشاري/متدرب + غير WPS).
- **نهاية الخدمة:** `services/end_of_service.py` (سنوات = الأيام ÷ 365.25 مقربة، م.77 مقربة لريال).
- **نهاية العقد:** `services/contracts.py` `fixed_term_end` = إضافة الشهور − يوم (مثل `addMonthsSafe`). + `apply_auto_terminations` (انتهاء/إرجاع تلقائي للعقود المحددة، يُستدعى في قائمة الموظفين ولوحة التحكم وبيانات الرواتب).
- **محرك الإجازات:** `services/leave.py` (`LeaveBook`) — منطق نظيف **مطابق 100%** للكود القديم (اختبار `tests/test_leave_engine.py` بأرقام مستخرجة من تشغيل JS القديم). يقرأ من `leave_year_overrides` و `leave_adjustments` و `employees.leave_eos_excess` والطلبات المعتمدة والعطلات. + `used_through` لعمود «ما تم استحقاقه».
- **سير الاعتماد:** `services/workflow.py` (المراحل من `workflow_rules`: إجازات/عن بعد/سلفة → مدير ← HR ← رئيس تنفيذي؛ استئذان/إضافي/مهمة → مدير ← HR؛ نسيان بصمة → HR فقط). موافقة، اعتماد نيابة، اعتماد نهائي، رفض بسبب، حذف (يرجّع الرصيد).
- **Routers (كلها تحت `/api/v1`):** `auth, me, dashboard, employees, dependents, documents, salary, settings, sheets (+payroll-archive), locations (+assignments, work-locations), attendance (+range, summary), leave (holidays, requests, balances, used-through), registry (documents), letters (+me/letters)`.
- **الاختبارات:** آخر تشغيل كامل = 74 ناجحة (بعدها طلب المستخدم إيقاف الاختبارات لتوفير الوقت).

#### 5.4 قاعدة البيانات (ملفات Alembic)
| الملف | المحتوى |
|---|---|
| 0001 | الجداول الأساسية (المشروع السابق) |
| 0002 | البيانات المرجعية (جهات العمل، الأقسام، الجنسيات، العطلات، نسب التأمينات، مراحل الاعتماد) |
| 0003 | بدل الإضافي للموظف |
| 0004 | كلمات المرور المشفرة `credentials` |
| 0005 | `sheets` (تخزين مرن بمفتاح: الشعار `company_logo`، التوقيع والختم `hr_signer`) |
| 0006 | `sent_letters` (النماذج المرسلة للموظف) |
| 0007 | **تنظيف السكيما:** الحضور يسمح بأكثر من جلسة يومياً؛ `payroll_runs`/`payroll_rows` جداول مربوطة (صف المسير الكامل في `data` JSON + المجاميع أعمدة)؛ `leave_year_overrides` + `leave_adjustments` جديدة؛ `employees.leave_eos_excess`؛ حذف `settlements, settlement_items, template_letters, leave_year_ledgers` القديمة؛ CASCADE لخطوات الطلب؛ CHECK على نوع وحالة `sent_letters`. **باتجاه واحد (downgrade غير مدعوم).** |
| 0008 | `employee_locations` (مواقع بصمة لكل موظف — V121) |
- 40+ علاقة Foreign Key حقيقية. الموظف هو المحور.
- المسير: الموقع ما زال يستخدم `GET/PUT /sheets/pay_YYYY_MM` لكن الخادم يحفظها فعلياً في `payroll_runs/rows`.

#### 5.5 الموقع (hr-web) — كل الصفحات مبنية
لوحة التحكم، الموظفين، الحضور (+ تقارير V117 + تقرير شهري)، مواقع البصمة (+ الموظفين المربوطين V121)، الإجازات (6 تبويبات + مرفق اختياري + محرر الرصيد سنة بسنة)، المسير V119 (+ «ما تم استحقاقه» تلقائي + «بدون خصم» + أرشيف المسيرات المعتمدة)، كشف الراتب، نهاية الخدمة، المخالصة (+ طباعة مخالصة رسمية بالتفقيط)، الوثائق، التقارير (9)، الإعدادات (9 بطاقات + إظهار التوقيع/الختم)، النماذج (9 نماذج + إرسال جماعي + نسخ إنجليزية + لغة خطاب الراتب + حالة المرسَل).
- مكتبات الحساب: `src/lib/calc/` (`payx.ts` محرك المسير، `settlement.ts`, `settlement-doc.ts`, `eos.ts`, `tafqeet.ts`, `forms.ts`, `forms-en.ts`, `payroll.ts`).
- `listAllEmployees` يجيب كل الصفحات (الخادم يحد 100 لكل صفحة).

#### 5.6 المطابقة مع النسخة القديمة
- مقارنة تلقائية: تشغيل النسخة القديمة وسحب 380 عنصر (أزرار/تبويبات/عناوين/حقول) ومقارنتها بالموقع → **97%**. الباقي صياغات بسيطة.
- **المعادلات مطابقة بالأرقام:** المسير (AV 89,168.24 · AK 47,203.65 · AC 28,816.67)، المخالصة (م.84 140,224 · م.85 116,618.44 · م.77 193,132 · م.80 69,407.33)، الإجازات (رصيد 25.81)، التفقيط (12,345.67 / 2,000)، نهاية العقد (2025-03-10+24 = 2027-03-09).

#### 5.7 تطبيق الجوال — الأساس فقط
موجود: الدخول، تغيير كلمة المرور، الرئيسية، الراتب، ملفي، الخروج؛ ألوان التطبيق القديم وخط ARIBA Two؛ RTL. مربوط حالياً بـ `localhost` (`EXPO_PUBLIC_API_URL`). معرّف التطبيق مؤقت `sa.ariba.employee`. ما انجرب على جوال حقيقي.

---

### 6. ديون تقنية معروفة (لم تُحل — بقرار المستخدم بدء التطبيق أولاً)
1. **`frontend/hr-web/src/lib/calc/payx.ts` منسوخ حرفياً** من ملف JS القديم (`// @ts-nocheck`). المطلوب لاحقاً: إعادة كتابته كمنطق نظيف بنفس النتائج.
2. `settlement.ts` منقول سطر بسطر من `sRun`.
3. حسابات المسير والمخالصة ونهاية الخدمة وتقارير الحضور تتم في **المتصفح**؛ الأصح نقلها للخادم.
4. ملف التعديل 0007 بدون downgrade (اختبار upgrade/downgrade سيفشل).
5. أُضيفت ميزات بعد آخر تشغيل للاختبارات (طلب المستخدم: لا اختبارات الآن).
6. كشف الراتب يعرض `otherDeduct || loanDeduct` (سلوك قديم مقصود).
7. الأسئلة الـ 35 في القسم 9 من التوثيق ما زالت بلا رد من موظف الموارد البشرية.

---

### 7. الخطوة التالية: تطبيق الجوال
**كيف يرتبط:** التطبيق لا يكلّم الموقع؛ الاثنان يكلّمان نفس الخادم وقاعدة البيانات، فكل شيء يظهر فوراً في الطرف الآخر.

**الجاهز في الخادم للتطبيق:** `/auth/*`, `/me`, `/me/employee`, `/me/letters` (+ `/me/letters/{id}/respond`), `/letters/{id}/html`.

**الناقص في الخادم (لازم يُبنى):**
- بصمة الجوال: `POST /me/attendance/punch` (GPS، أقرب موقع، النطاق — الحفظ يفرض 1000م لغير «عن بعد» حسب V38، مواقع الموظف V121 أو مواقع جهة عمله، الساعات المرنة والانصراف المتوقع، التأخير والخروج المبكر)، وسجلي `GET /me/attendance`.
- طلباتي: `POST /me/requests` (إجازة بأنواعها، استئذان، سلفة، إضافي، نسيان بصمة → يذهب لـ HR مباشرة) + `GET /me/requests` + رصيدي `GET /me/leave`.
- فريقي وموافقات المدير: `GET /me/team`, `GET /me/approvals`, `POST /me/approvals/{id}`.
- كشوف رواتبي من المسيرات المعتمدة: `GET /me/payslips`.
- الإشعارات.

**تم (2026-10-06):**
- ✅ 1. التطبيق مربوط افتراضياً بالخادم المنشور (`src/lib/api.ts`، و`.env.example`).
- ✅ 2. البصمة بالـ GPS: `services/geofence.py` (Haversine) + `services/punch.py` + `GET /me/attendance` و `POST /me/attendance/punch {action in|out, lat, lng}`. الأخطاء: `outside_geofence` (مع أقرب موقع ومسافته)، `too_early_for_flexible_window`، `too_late_for_flexible_window`، `remote_limit_reached`، `already_checked_in`، `not_checked_in`. التأخير من أول جلسة فقط؛ الساعة المرنة: لا تأخير والانصراف المتوقع = أول دخول + الساعات. شاشة الحضور في التطبيق (ساعة الرياض، حالة الموقع، رجوع للعمل، جلسات اليوم، سجل 31 يوم). + إصلاح: أوقات الحضور تُعرض بتوقيت الرياض (`attendance.local`) بدل UTC من Postgres.
- ✅ 3+4. الطلبات والرصيد والفريق والموافقات: `routers/me_requests.py` — `GET/POST /me/requests`, `DELETE /me/requests/{id}` (غير المعتمد فقط)، `GET /me/leave`, `GET /me/team`, `GET /me/approvals`, `POST /me/approvals/{id} {action approve|reject, reason}` (المدير المباشر لمرحلة المدير، hr/admin لمرحلة HR، ceo/admin لمرحلة الرئيس التنفيذي). اعتماد «نسيان بصمة» يسجّل الحضور تلقائياً (`punch.record_forgot_punch`). شاشات الإجازات وفريقي في التطبيق. المرفقات في طلبات التطبيق لم تُبنَ بعد، والتواريخ تُكتب نصاً (YYYY-MM-DD).
- ✅ 5. النماذج: تبويب «مستندات» + شاشة `app/letter/[id].tsx` (عرض HTML عبر `react-native-webview` + موافقة/اعتراض بسبب ≥ 3 أحرف). كشوف الراتب: `GET /me/payslips` (المسيرات المعتمدة فقط، حقول قسيمة V119) في تبويب الراتب.
- ✅ 6. الإشعارات: `GET /me/notifications` (نماذج بانتظار الرد، قرارات طلباتي آخر 60 يوم، طلبات بانتظار موافقتي) + جرس بعدّاد في رأس كل تبويب + شاشة `app/notifications.tsx`؛ «مقروء» يُحفظ على الجهاز. إشعارات الدفع (Push) لم تُبنَ: تحتاج حساب Expo/EAS و build خاص (Expo Go لا يدعمها على Android).
- ⏳ 7. التجربة على الجوال: لم تتم (لا يوجد Xcode/محاكي على الجهاز). التحقق المنجز: `tsc` + `expo export` + اختبارات API مؤقتة.
- ملاحظة: منطق `ariba_attendance` القديم كان في Supabase وغير موجود في الملفات؛ بُني من وصف التوثيق (3.2.4، 4.11، 4.12).

**خطة التطبيق بالترتيب:**
1. ربطه بالخادم المنشور (`EXPO_PUBLIC_API_URL=https://hrariba-production.up.railway.app`).
2. البصمة بالـ GPS (الأهم).
3. الإجازات والطلبات والرصيد.
4. فريقي والموافقات.
5. النماذج (موافقة/اعتراض بسبب ≥ 3 أحرف) وكشوف الراتب.
6. الإشعارات.
7. التجربة على جوال المستخدم عبر Expo Go، ثم المتاجر (يحتاج Apple Developer + Google Play).

**المرجع للتطبيق:** `frontend/legacy/employee-portal/` + القسم 3 و 6 من التوثيق.

---

### 8. أوامر مفيدة
```bash
# الخادم محلياً
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000
# الموقع محلياً
cd frontend/hr-web && npm run dev
# التطبيق
cd frontend/employee-app && npx expo start
# فحص الموقع
cd frontend/hr-web && npx tsc --noEmit && npm run lint
# حالة النشر
railway status --json -p 12c5dc37-b739-441d-954c-08412b958fe4 -e 64f9e490-e396-49a8-b4e6-979d386d8709
# إذا فشل git push بـ HTTP 400
git config http.postBuffer 524288000
```

### 9. قواعد العمل مع المستخدم
- الرد بالعربي، مختصر، وبدون استهلاك توكن زائد؛ قل «خلصت» عند الانتهاء.
- لا تعدّل `frontend/legacy` أو الملفات الأصلية. لا تغيّر إعدادات Railway/Supabase/Netlify. لا تفحص قاعدة Supabase القديمة.
- لا تكتب كلمات مرور حقيقية في أي مكان، ولا تنشئ حسابات على الموقع المنشور بنفسك (المستخدم يشغّل الأمر).
- commits صغيرة على `main` مع السطر: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
