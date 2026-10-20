# Project Status — حالة المشروع

> English first, then the full Arabic version (same content).

---

# English

## Project status

_Last updated: 2026-10-04 · branch `feat/foundation`_

Start here. This file says what exists, what has been checked, and what has **not** been checked.

### Hosting: Railway (2026-10-04)
Decision: everything on Railway (Postgres + backend + frontend), no Supabase. Sign-in is now built into the
backend (Argon2id hashes in the `credentials` table, HS256 session tokens with a per-user token version that
revokes old sessions on every password change). Files go to disk (a Railway Volume in production).
Steps: [07_DEPLOY_RAILWAY.md](07_DEPLOY_RAILWAY.md). Verified on a local PostgreSQL 16 in production mode.

### Design match (2026-10-04)
The frontend now reproduces the V114 prototypes' look exactly (prototype CSS, fonts, logo, wording, markup);
see `frontend/hr-web/DESIGN.md`. Backend additions for the built screens: GOSI and end-of-service calculations,
salary figures on the employee record, live salary preview, full dashboard (KPIs, charts, expiry alerts),
document/photo uploads (stored on disk; a Railway Volume in production), dependents, duplicate checks and
automatic employee numbers. New endpoints: `GET /dashboard`, `POST /employees/salary-preview`,
`GET|POST /employees/{id}/documents`, `GET /documents/{id}/file`, `DELETE /documents/{id}`,
`GET|PUT|DELETE /employees/{id}/photo`, `GET|POST /employees/{id}/dependents`, `PATCH|DELETE /dependents/{id}`,
`POST /dependents/{id}/documents`. The employee app has its own login at `/me/login`.

### Phase 1 — Foundation + Employees (done)

| Area | State |
|---|---|
| Repo layout (backend / frontend / docs) | ✅ |
| Baseline schema for every §3.3 entity (27 enums, 25 tables) | ✅ `0001_baseline_schema` |
| Reference data (workplaces, departments, nationalities, holidays, GOSI rules, settings, workflow stages) | ✅ `0002_seed_reference_data` |
| Built-in sign-in (Argon2 + HS256 tokens), refresh, logout | ✅ |
| Forced password change, temporary passwords, password policy | ✅ |
| Roles + data scope + salary/ID visibility | ✅ employees module |
| Error format, security headers, CORS allowlist, login rate limit, audit log | ✅ |
| Employees API (list/tabs/filters/search/sort/pagination, detail, create, update, terminate, reactivate, counts) | ✅ |
| Login accounts API (create, temporary password, role/active) | ✅ |
| Frontend: proxy (route mirror), `lib/api.ts`, i18n AR/EN + RTL, light/night theme, print CSS | ✅ |
| Frontend pages: login, dashboard (headcount KPIs), employees list, employee form (5 tabs), new employee, `/me` home + profile + settings | ✅ |
| Other screens | 🟡 placeholder pages so the navigation is complete |

#### Verified
- `pytest`: 45 passed on SQLite (auth, employees, permissions, security, scheduling, migrations incl. model-drift guard).
- `npm run lint`, `tsc --noEmit`, `next build`: clean.
- Manual check in a browser against the local backend (SQLite + dev auth): login → forced password change →
  dashboard → employees list → create employee (fixed-term contract end auto-calculated) → detail;
  Arabic RTL and English LTR; light and night themes.

#### Not verified yet (be honest here)
- Not deployed to Railway yet (needs your Railway account; see 07_DEPLOY_RAILWAY.md).
- Mobile layout of the employee app checked only in a narrow browser window, not on a phone.
- The login rate limiter is in-memory: correct for one backend instance only.

### Decisions taken (with the business owner)
- EOS base = **basic + housing** everywhere.
- Service years = **actual days ÷ 365**.
- Saudization = **simple count** (no Nitaqat weighting for now).
- Approval stages per request type are **data** (`workflow_rules`): leaves/remote/advance → manager → HR → CEO;
  permission/maternity permission/early leave/overtime/mission → manager → HR; forgot punch → HR only.

Open questions found in the prototypes are listed at the end of [04_BUSINESS_RULES.md](04_BUSINESS_RULES.md).

### Next phases (proposed order)
1. First Railway deploy (see 07_DEPLOY_RAILWAY.md)
2. Leave (ledger, balances, holidays) · requests + approval workflow
3. Attendance (check-in, geofence, late, remote limit) · punch locations
4. Payroll + GOSI · payslips
5. End of service + settlement · templates/letters · alerts · full dashboard · reports
6. `import_from_v114.py` (one-time migration from the old Supabase project)

### API (v1)

All under `/api/v1` unless noted. 🔒 = needs a bearer token.

| Method | Path | Who |
|---|---|---|
| GET | `/health` (no prefix) | public |
| POST | `/auth/login` | public, rate-limited |
| POST | `/auth/refresh` | public (refresh token) |
| POST | `/auth/logout` | 🔒 any |
| POST | `/auth/change-password` | 🔒 any (incl. pending change) |
| POST | `/auth/users` | 🔒 hr, admin (admin accounts: admin only) |
| PATCH | `/auth/users/{id}` | 🔒 hr, admin (role: admin only) |
| POST | `/auth/users/{id}/temporary-password` | 🔒 hr, admin |
| GET | `/auth/users/by-employee/{employee_id}` | 🔒 hr, admin |
| GET | `/me` | 🔒 any (incl. pending change) |
| GET | `/me/employee` | 🔒 any with an employee record |
| GET | `/employees?tab=&q=&workplace_id=&department_id=&page=&page_size=&sort=` | 🔒 all but finance (scoped) |
| GET | `/employees/counts` | 🔒 all but finance (scoped) |
| POST | `/employees` | 🔒 hr, admin |
| GET | `/employees/{id}` | 🔒 all but finance (scoped; 404 outside scope) |
| PATCH | `/employees/{id}` | 🔒 hr, admin |
| POST | `/employees/{id}/terminate` | 🔒 hr, admin |
| POST | `/employees/{id}/reactivate` | 🔒 hr, admin |
| GET | `/settings/lookups` | 🔒 any |

OpenAPI docs at `/docs` in development only.

### Doc index
- [01_ARCHITECTURE.md](01_ARCHITECTURE.md) · [03_SECURITY.md](03_SECURITY.md) · [02_DATABASE.md](02_DATABASE.md) · [04_BUSINESS_RULES.md](04_BUSINESS_RULES.md)
- Features: [05_FEATURE_auth.md](05_FEATURE_auth.md) · [06_FEATURE_employees.md](06_FEATURE_employees.md)
- [backend/README.md](../backend/README.md) · [frontend/hr-web/README.md](../frontend/hr-web/README.md) · [frontend/hr-web/DESIGN.md](../frontend/hr-web/DESIGN.md)

---

# العربي

## حالة المشروع

_آخر تحديث: 2026-10-04 · الفرع `feat/foundation`_

ابدأ من هنا. يوضح هذا الملف ما هو موجود، وما تم التحقق منه، وما **لم** يتم التحقق منه.

### الاستضافة: Railway (2026-10-04)
القرار: كل شيء على Railway (Postgres + الخلفية + الواجهة الأمامية)، بلا Supabase. أصبح تسجيل الدخول مدمجًا في
الخلفية (تجزئات Argon2id في جدول `credentials`، ورموز جلسة HS256 مع رقم إصدار رمز لكل مستخدم
يُلغي الجلسات القديمة عند كل تغيير لكلمة المرور). تُحفظ الملفات على القرص (Railway Volume في الإنتاج).
الخطوات: [07_DEPLOY_RAILWAY.md](07_DEPLOY_RAILWAY.md). تم التحقق على PostgreSQL 16 محلية في وضع الإنتاج.

### مطابقة التصميم (2026-10-04)
تعيد الواجهة الأمامية الآن إنتاج مظهر النماذج الأولية V114 بدقة (CSS النموذج الأولي، الخطوط، الشعار، الصياغة، الترميز)؛
انظر `frontend/hr-web/DESIGN.md`. إضافات الخلفية للشاشات المبنية: حسابات التأمينات (GOSI) ونهاية الخدمة،
أرقام الراتب في سجل الموظف، معاينة حية للراتب، لوحة معلومات كاملة (مؤشرات الأداء، رسوم بيانية، تنبيهات الانتهاء)،
رفع المستندات/الصور (مخزنة على القرص؛ Railway Volume في الإنتاج)، المعالون، فحوص التكرار و
أرقام الموظفين التلقائية. نقاط النهاية الجديدة: `GET /dashboard`، `POST /employees/salary-preview`،
`GET|POST /employees/{id}/documents`، `GET /documents/{id}/file`، `DELETE /documents/{id}`،
`GET|PUT|DELETE /employees/{id}/photo`، `GET|POST /employees/{id}/dependents`، `PATCH|DELETE /dependents/{id}`،
`POST /dependents/{id}/documents`. لتطبيق الموظف صفحة دخول خاصة به على `/me/login`.

### المرحلة 1 — الأساس + الموظفون (مكتملة)

| المجال | الحالة |
|---|---|
| بنية المستودع (backend / frontend / docs) | ✅ |
| المخطط الأساسي لكل كيان في §3.3 (27 enum، 25 جدولًا) | ✅ `0001_baseline_schema` |
| البيانات المرجعية (مواقع العمل، الأقسام، الجنسيات، العطل، قواعد GOSI، الإعدادات، مراحل سير العمل) | ✅ `0002_seed_reference_data` |
| تسجيل دخول مدمج (Argon2 + رموز HS256)، التحديث، تسجيل الخروج | ✅ |
| فرض تغيير كلمة المرور، كلمات المرور المؤقتة، سياسة كلمات المرور | ✅ |
| الأدوار + نطاق البيانات + إظهار الراتب/الهوية | ✅ وحدة الموظفين |
| صيغة الأخطاء، ترويسات الأمان، قائمة سماح CORS، تحديد معدل الدخول، سجل التدقيق | ✅ |
| واجهة API للموظفين (القائمة/التبويبات/المرشحات/البحث/الترتيب/الترقيم، التفاصيل، الإنشاء، التعديل، إنهاء الخدمة، إعادة التفعيل، الأعداد) | ✅ |
| واجهة API لحسابات الدخول (إنشاء، كلمة مرور مؤقتة، الدور/التفعيل) | ✅ |
| الواجهة الأمامية: proxy (مرآة للمسارات)، `lib/api.ts`، i18n عربي/إنجليزي + RTL، سمة فاتحة/ليلية، CSS للطباعة | ✅ |
| صفحات الواجهة الأمامية: الدخول، لوحة المعلومات (مؤشرات عدد الموظفين)، قائمة الموظفين، نموذج الموظف (5 تبويبات)، موظف جديد، الصفحة الرئيسية `/me` + الملف الشخصي + الإعدادات | ✅ |
| الشاشات الأخرى | 🟡 صفحات مؤقتة لتكتمل التنقلات |

#### ما تم التحقق منه
- `pytest`: 45 ناجحًا على SQLite (المصادقة، الموظفون، الصلاحيات، الأمان، الجدولة، الترحيلات بما فيها حارس انحراف النموذج).
- `npm run lint`، `tsc --noEmit`، `next build`: نظيفة.
- فحص يدوي في المتصفح مقابل الخلفية المحلية (SQLite + مصادقة التطوير): الدخول ← فرض تغيير كلمة المرور ←
  لوحة المعلومات ← قائمة الموظفين ← إنشاء موظف (يُحسب تاريخ انتهاء العقد محدد المدة تلقائيًا) ← التفاصيل؛
  العربية RTL والإنجليزية LTR؛ السمتان الفاتحة والليلية.

#### ما لم يتم التحقق منه بعد (بصراحة)
- لم يُنشر على Railway بعد (يحتاج إلى حسابك على Railway؛ انظر 07_DEPLOY_RAILWAY.md).
- تخطيط تطبيق الموظف على الجوال فُحص فقط في نافذة متصفح ضيقة، وليس على هاتف.
- محدِّد معدل الدخول في الذاكرة: صحيح لنسخة خلفية واحدة فقط.

### القرارات المتخذة (مع مالك العمل)
- أساس مكافأة نهاية الخدمة = **الأساسي + السكن** في كل مكان.
- سنوات الخدمة = **الأيام الفعلية ÷ 365**.
- السعودة = **عدّ بسيط** (بلا ترجيح نطاقات حاليًا).
- مراحل الاعتماد لكل نوع طلب هي **بيانات** (`workflow_rules`): الإجازات/العمل عن بُعد/السلفة ← المدير ← الموارد البشرية ← الرئيس التنفيذي؛
  الاستئذان/استئذان الأمومة/الخروج المبكر/العمل الإضافي/مهمة العمل ← المدير ← الموارد البشرية؛ نسيان البصمة ← الموارد البشرية فقط.

الأسئلة المفتوحة المكتشفة في النماذج الأولية مدرجة في نهاية [04_BUSINESS_RULES.md](04_BUSINESS_RULES.md).

### المراحل التالية (الترتيب المقترح)
1. أول نشر على Railway (انظر 07_DEPLOY_RAILWAY.md)
2. الإجازات (الدفتر، الأرصدة، العطل) · الطلبات + سير عمل الاعتماد
3. الحضور (تسجيل الحضور، السياج الجغرافي، التأخير، حد العمل عن بُعد) · مواقع البصمة
4. الرواتب + التأمينات (GOSI) · قسائم الرواتب
5. نهاية الخدمة + المخالصة · القوالب/الخطابات · التنبيهات · لوحة المعلومات الكاملة · التقارير
6. `import_from_v114.py` (ترحيل لمرة واحدة من مشروع Supabase القديم)

### واجهة API (v1)

كلها تحت `/api/v1` ما لم يُذكر خلاف ذلك. 🔒 = يحتاج إلى رمز bearer.

| الطريقة | المسار | من |
|---|---|---|
| GET | `/health` (بلا بادئة) | عام |
| POST | `/auth/login` | عام، بتحديد معدل |
| POST | `/auth/refresh` | عام (رمز التحديث) |
| POST | `/auth/logout` | 🔒 أي مستخدم |
| POST | `/auth/change-password` | 🔒 أي مستخدم (بما فيه من عليه تغيير معلّق) |
| POST | `/auth/users` | 🔒 hr، admin (حسابات admin: admin فقط) |
| PATCH | `/auth/users/{id}` | 🔒 hr، admin (الدور: admin فقط) |
| POST | `/auth/users/{id}/temporary-password` | 🔒 hr، admin |
| GET | `/auth/users/by-employee/{employee_id}` | 🔒 hr، admin |
| GET | `/me` | 🔒 أي مستخدم (بما فيه من عليه تغيير معلّق) |
| GET | `/me/employee` | 🔒 أي مستخدم لديه سجل موظف |
| GET | `/employees?tab=&q=&workplace_id=&department_id=&page=&page_size=&sort=` | 🔒 الجميع عدا finance (ضمن النطاق) |
| GET | `/employees/counts` | 🔒 الجميع عدا finance (ضمن النطاق) |
| POST | `/employees` | 🔒 hr، admin |
| GET | `/employees/{id}` | 🔒 الجميع عدا finance (ضمن النطاق؛ 404 خارج النطاق) |
| PATCH | `/employees/{id}` | 🔒 hr، admin |
| POST | `/employees/{id}/terminate` | 🔒 hr، admin |
| POST | `/employees/{id}/reactivate` | 🔒 hr، admin |
| GET | `/settings/lookups` | 🔒 أي مستخدم |

توثيق OpenAPI على `/docs` في بيئة التطوير فقط.

### فهرس المستندات
- [01_ARCHITECTURE.md](01_ARCHITECTURE.md) · [03_SECURITY.md](03_SECURITY.md) · [02_DATABASE.md](02_DATABASE.md) · [04_BUSINESS_RULES.md](04_BUSINESS_RULES.md)
- الميزات: [05_FEATURE_auth.md](05_FEATURE_auth.md) · [06_FEATURE_employees.md](06_FEATURE_employees.md)
- [backend/README.md](../backend/README.md) · [frontend/hr-web/README.md](../frontend/hr-web/README.md) · [frontend/hr-web/DESIGN.md](../frontend/hr-web/DESIGN.md)
