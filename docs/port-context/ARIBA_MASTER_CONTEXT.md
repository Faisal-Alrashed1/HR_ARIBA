# ARIBA HR — السياق الكامل (من البذرة إلى 18 أكتوبر 2026)

> هذا الملف هو المرجع لأي محادثة جديدة. اقرأه كاملاً قبل أي عمل.
> كُتب 2026-10-18. آخر commit على `main` (منشور): `494998d`.
> المسارات: مشروعنا `~/Desktop/HR/HR_ARIBA` · مشروعهم `~/Desktop/مشروع الموارد البشرية/React` · المقارنة `~/Desktop/HR/مقارنة_المعادلات.xlsx` و`.md`.

---

## 0. قواعد العمل (تعليمات صاحب المشروع)
- الرد **بالعربي، مختصر ومباشر**. الكود والمسارات والأوامر كما هي.
- **لا push على `main` ولا نشر إلا بكلمة «انشر»**. الـ push على `main` ينشر الإنتاج والديمو معاً.
- **لا تحذف أي شيء** (ملفات، قواعد، بيئات، نسخ احتياطية) إلا إذا سمّاه صاحب المشروع وطلب حذفه. استثناء مُعتمد في هذه المرحلة: حذف **المعادلات/المنطق** الموجود عندنا وغير موجود عندهم (القسم 12) — معتمد بدون استثناء.
- قرّر الأفضل ونفّذ، وتوقّف فقط عند نقاط التحقق الكبيرة (قبل أي تغيير على الإنتاج، وقبل الحذف).
- لا تكتب كلمات مرور حقيقية في المواقع المنشورة. التجربة محلياً بحسابات تجربة.
- لا ترفع ملفات فيها بيانات حقيقية (dump، سجلات). ملفات السكيما فقط.
- نظام الحماية في Claude Code يمنع أي أمر يغيّر قاعدة الإنتاج أو ينشر. القراءة عبر `railway ssh` مسموحة. **أي تغيير على قاعدة Railway يشغّله صاحب المشروع بنفسه** من الطرفية، وأنت تجهّز الأمر.
- مجلد مشروعهم **للقراءة فقط**: لا تعدّل فيه، ولا `npm install` ولا build داخله. لو احتجت تشغيل معادلاتهم: انسخها إلى الـ scratchpad وشغّلها بـ node بدون `npm install` (كما فعلنا في المقارنة).

---

## 1. البذرة (الفكرة)
- **أريبا للاستشارات** كانت تدير الموارد البشرية في **ملف HTML ضخم واحد** تطوّر عبر تحديثات V1 إلى V130 (ثم وصلت نسختهم إلى V171+). البيانات في **Supabase** بناها الزميل محمد عوض (جداول ودوال SQL وحسابات).
- **الهدف:** إعادة البناء على تقنيات حديثة بنفس الشاشات والحقول والنصوص والمعادلات:
  1. **موقع الموارد البشرية** للـ HR والمدراء والمالية.
  2. **تطبيق الموظف** (آيفون وأندرويد): بصمة GPS، طلبات، راتب.
  3. **خادم وقاعدة بيانات واحدة** للاثنين.
- **المبدأ:** ننقل المنطق بشكل نظيف وبنتائج مطابقة، لا نسخ الكود القديم.

## 2. التقنيات عندنا (Tech Stack)
- **Backend:** Python 3.12 + FastAPI + Uvicorn · SQLAlchemy 2 + psycopg 3 (SQL مباشر عبر `text()`) · Pydantic · PyJWT · Argon2/bcrypt · pytest.
- **Database:** PostgreSQL 18 على Railway، خدمة `Postgres-Q6OM` — **بسكيما الزميلة المرتّبة (normalized) منذ 2026-10-13**. الخدمة القديمة `Postgres` محفوظة بدون لمس.
- **HR Web:** Next.js 16 + React 19 + TypeScript · Chart.js · Tabler Icons · Zod · ESLint.
  - تنبيه: Next.js هذه فيها تغييرات جذرية. اقرأ `frontend/hr-web/AGENTS.md`؛ تستخدم `proxy.ts` لا `middleware.ts`.
- **Mobile:** Expo 57 + React Native 0.86 + TypeScript + Expo Router · expo-location · expo-secure-store · react-native-svg.
- **Hosting:** Railway مشروع `sparkling-learning`، بيئتان (production, demo). GitHub `Faisal-Alrashed1/HR_ARIBA` (خاص). الـ push على `main` ينشر الاثنين.
- **أدوات المطابقة:** `backend/tests_canonical/test_legacy_parity.py` (يشغّل دوال SQL القديمة في قاعدة مؤقتة ويقارنها بكودنا) · `tools/legacy-parity` (Node + jsdom يشغّل HTML القديم ويقارن معادلات الموقع).

## 3. التسلسل الزمني لمشروعنا
### 3.1 — 4 أكتوبر: النسخة الأولى (أُعيد ضبطها لاحقاً)
أساس الخادم: الدخول، الأدوار، الأمان، الموظفين، السعودة، التأمينات، نهاية الخدمة، لوحة التحكم، التنبيهات، المستندات، الصورة، المرافقين. تصميم V114 وأول نشر على Railway. (الأرشيف في التاغ `archive/before-reset`.)
### 3.2 — 5 أكتوبر: إعادة البناء من HTML المقسّم
الريبو صار `backend` + `frontend/hr-web` + `frontend/employee-app`، والـ HTML القديم مرجع في `frontend/legacy`. نُقل بنتائج مطابقة: التأمينات مع إعفاء V130، صفحة نهاية الخدمة `rEOS` والمخالصة `sRun`، محرك المسيّر PAYX V119 (جدول كامل، تعديل يدوي، حفظ/اعتماد، CSV، طباعة)، قسيمة الراتب، مواقع العمل، الحضور (يدوي + شهري)، محرك سجل الإجازات سطراً بسطر، APIs الإجازات، صفحة الإجازات، سجل المستندات، 9 تقارير، كل الإعدادات، الخطابات/النماذج (9 نماذج بترويسة، إرسال للموظف، موافقة/اعتراض).
### 3.3 — 6 أكتوبر: إضافات وأول تطبيق
الموقع: تنظيف السكيما، «ما تم استحقاقه» في المسيّر، تقارير حضور V117، مستند المخالصة الرسمي مع التفقيط، أرشيف المسيّر، إرسال جماعي ونماذج إنجليزية، خيارات التوقيع/الختم، مواقع عمل لكل موظف (V121)، مرفقات الطلبات، نهاية العقد = البداية + المدة − يوم مع إنهاء/تفعيل تلقائي، خيار «بدون خصم» للتأمينات.
التطبيق: بصمة GPS مع سياج جغرافي من الخادم، دوام مرن، جلسات متعددة، طلباتي (كل الأنواع + نسيان بصمة)، الرصيد، الفريق، الموافقات، النماذج، القسائم، الإشعارات.
### 3.4 — 8 أكتوبر: الانتقال لقاعدة الزميل (canonical)
الخادم يشتغل مباشرة على سكيما Supabase الأصلية (34 جدولاً) عبر `backend/app/routers/canonical.py` (كل المسارات SQL مباشر). `backend/tools/create_account.py` ينشئ حساباً بكلمة مرور مؤقتة. التطبيق بشكل V118.
### 3.5 — 11 أكتوبر: الديمو والهوية والواجهة
بيئة الديمو: نسخة من الإنتاج والرواتب كلها 1000 (إعداد Railway، ليس commit). أيقونات Tabler، ألوان أريبا، صور رمزية رجال/نساء/تمهير، منتقي تاريخ/وقت موحّد، صفحة «الطلبات والإجازات»، تنبيه نسيان البصمة، «تحديث البيانات». حفظ الموظف يعيد حساب التأمينات والصافي (legacy sEmp)، فلتر «كل جهات العمل».
### 3.6 — 11–12 أكتوبر: تدقيق المطابقة (`0f85a93`)
التقرير `docs/LOGIC_AUDIT.md`. شغّلنا البوابة القديمة في jsdom ودوال SQL القديمة في Postgres وقارنّا رقماً برقم. إصلاحات: تقرير نهاية الخدمة، نهاية العقد عند الحفظ، إعادة التفعيل عند التجديد، البصمة مطابقة لـ `ariba_attendance` V140 (مضلعات، الأصغر أولاً، عن بعد بطلب معتمد فقط، التأخير ≥ 1 دقيقة، السماح 0 لا يصير 15)، لوحة التحكم، إعفاء التأمينات = kindOf (428/428)، رصيد التطبيق = `ariba_leave_calc`، الطلبات (مدير ← HR ← رئيس تنفيذي، نسيان البصمة لـ HR فقط، إشعارات مطابقة، الاعتماد نيابة والنهائي)، تقارير الحضور، صافي تقرير المسيّر.
### 3.7 — 12–13 أكتوبر
`683982d` الملفات والصور داخل القاعدة (`ariba_documents`) · `1d2bbed` حدود خضراء داكنة (#014D3D) على بطاقات لوحة التحكم · `ad8ee40` إصلاح حذف الطلب من HR (قوس ناقص) + اختبار · تاغ `before-normalization` = `ad8ee40`.
### 3.8 — 13 أكتوبر: دمج نورملايز الزميلة ونشره ✅
- الزميلة **Ghady Nafisah**، ريبو `https://github.com/Dalteam/HR_ARIBA` (commits `31cb909`، `8e5716a`) — ريبو مستقل مبني على كودنا عند `c24e6d6`.
- **أخذناه كما هو:** `canonical.py`، `models.py`، `test_canonical_contract.py`، `create_account.py`، `services/punch.py`، إشعارات التطبيق (حالة «مقروء» على الخادم + `POST /me/notifications/read`)، صفحة الحضور (جلسات متعددة)، الوثائق، وملفاتها الثلاثة في `docs/db-normalization/`: `preflight_checks.sql`، `pre_migration_fixes.sql`، `ariba_normalization.sql`.
- **تركناه:** `canonical.py.bak`، `load_log.txt`، `aribaOldSchema.txt`، تعديلات لوحة التحكم والـ CSS.
- **أضفناه نحن:** إصلاح حذف الطلب · `_delete_request_rows` (يحذف الطلب وكل ما يرتبط به بالترتيب) · `docs/db-normalization/railway_prep.sql` (يرجّع المفاتيح الأساسية/الفريدة/الربط من سكيما Supabase الأصلية + يضبط علامات اعتماد المسيّر مع نسخة في `ops.employee_payrolls_approval_backup`) · `docs/db-normalization/run_on_railway.sh <production|demo>` (نسخة احتياطية مع تحقق ثم railway_prep ← preflight ← pre_migration_fixes ← preflight ← ariba_normalization).
- **التحقق قبل النشر:** pytest 44 نجح، `tools/legacy-parity` كله مطابق (تصحيحات نظام العمل 9/9)، tsc/eslint نظيف، مقارنة 555 استدعاء API قبل/بعد على نسخة إنتاج: مطابقة.
- **النشر:** صاحب المشروع شغّل `run_on_railway.sh demo` (15:23) ثم `production` (15:26)، الاثنان نجحا، والسكيما على Railway مطابقة سطراً بسطر (82 مفتاحاً/رابطاً). `dbbee54` + `1ba1a42` على `main`. `494998d` (14 أكتوبر): تحديث `docs/PROJECT_GUIDE.md`.
### 3.9 — تصحيحات نظام العمل عندنا (فروق مقصودة عن القديم)
| الرمز | التصحيح |
|---|---|
| A | م.85 الاستقالة: 5 سنوات بالضبط = الثلث، 10 بالضبط = كاملة |
| B | أساس نهاية الخدمة = الأجر الفعلي (أساسي + كل البدلات الثابتة) |
| C | م.77 في العقد محدد المدة = أجر المدة المتبقية (حد أدنى شهرين) |
| D | م.87 مكافأة كاملة |
| E/F | ملاحظات نظامية لـ HR (مرضية م.117، زواج/وفاة/أبوة/أمومة، حج) |
| G | تأمينات المسيّر على بدل السكن الفعلي |
| H | مقسوم الإضافي بدون تغيير |
| I | تنبيه لو أعياد السنة الحالية/القادمة ناقصة |
| J | رصيد الإجازة بعد 5 سنوات للعقود فوق 21 يوماً |
| K | الدوام المرن بأكثر من جلسة: الخروج المبكر على آخر جلسة فقط، ودخول ثانٍ يصفّر خروج الجلسة السابقة |
> ⚠️ بقرار 18 أكتوبر (القسم 12) هذه التصحيحات **تُلغى كلها** ويصير السلوك مثل نظامهم تماماً.

### 3.10 — تغييرات سلوك بعد النورملايز (معروفة ومقبولة)
- الاعتماد: مرحلة HR = الموظف 40 فقط، الرئيس التنفيذي = 86 فقط (`workflow_approvers`)، والـ admin في كل المراحل.
- المسيّر: الاعتماد للشهر كاملاً (`payroll_periods`). سبتمبر 2026 غير معتمد (11 موظفاً لا يرون قسيمته).
- ملخص الحضور: اليوم يُحسب مرة واحدة.
- 3 حسابات انفك ربطها: Ariba-HR (40)، EMP108 (موظف 103 محذوف)، EMPXLS-62d422dece6b.
- 7 سجلات «اعتماد نيابة» قديمة حُذفت (موجودة في النسخة الاحتياطية) · 4 مسيّرات يتيمة نُسخت في `ops.orphan_payrolls_backup` ثم حُذفت.
- 3 موظفين منتهين مكررون بدون رقم: XLS-28cb119175e4 ↔ 20، XLS-8b3e7db7e810 ↔ 14، XLS-9e8e058c5963 ↔ 11 — قرار: تُترك.

## 4. البيئات والروابط
| | الإنتاج (بيانات حقيقية) | الديمو (رواتب 1000) |
|---|---|---|
| الموقع | https://frontend-production-f9a8a.up.railway.app | https://frontend-demo-b5ec.up.railway.app |
| الخادم | https://hrariba-production.up.railway.app | https://hrariba-demo.up.railway.app |
| القاعدة | Postgres-Q6OM (production) | Postgres-Q6OM (demo) |
- الخدمات في كل بيئة: `HR_ARIBA` (خادم)، `frontend`، `Postgres-Q6OM`، `Postgres` (قديمة).
- Railway CLI مربوط على production؛ أضف `-e demo` للديمو. القاعدة بدون رابط عام: `railway ssh -s Postgres-Q6OM -e <env> -- psql -U postgres -d railway` (SQL عبر stdin).
- GitHub CLI: الحساب النشط لازم `Faisal-Alrashed1`.
- تشغيل التطبيق (مربوط على الديمو عبر `frontend/employee-app/.env`): `cd frontend/employee-app && npx expo start --lan --clear`.

## 5. الملفات المهمة عندنا
- `backend/app/routers/canonical.py` (2,642 سطراً): كل مسارات الـ API. ثوابت `_EMPLOYEE_FROM` / `_EMPLOYEE_COLUMNS`. البصمة الفعلية هنا (`punch`, `_punch_late`, `_punch_early`, `_locate`).
- `backend/app/services/`: `employee_map.py` (figures)، `canonical_data.py`، `leave.py` (LeaveBook)، `gosi.py`، `end_of_service.py`، `contracts.py`. (`punch.py` و`routers/me.py` والمسارات القديمة غير مستخدمة.)
- `backend/app/models.py`: قائمة الجداول المسموحة (الخادم لا يشتغل لو نقص جدول).
- `frontend/hr-web/src/lib/calc/*`: `payx.ts`، `payroll.ts`، `eos.ts`، `settlement.ts`، `settlement-doc.ts`، `att-reports.ts`، `forms.ts`، `forms-en.ts`، `tafqeet.ts`.
- `frontend/employee-app/`: `app/(tabs)/*` و`src/lib/{geo,punch,api,data,notifications}.ts(x)`.
- `docs/`: `PROJECT_GUIDE.md`، `LOGIC_AUDIT.md`، `INTEGRATION_AUDIT.md`، `DATABASE.md`، `BUSINESS_RULES.md`، `db-normalization/`.

## 6. التشغيل والفحص محلياً
- Postgres محلي (`host=/tmp`). القاعدة الأنسب: **`ariba_after2`** (نسخة إنتاج 13 أكتوبر بعد الترحيل). أخرى: `ariba_demo` (حسابات `ui.check` admin و`ui.emp` موظف 10 — سكيما قديمة)، `ariba_before`، `ariba_verify`، `ariba_after`، `ariba_norm_trial`، `ariba_parity_2c945104`، `ariba_hr_dev`، `ariba_hr_test` (لا تُحذف).
- الخادم: `cd backend && DATABASE_URL='postgresql:///ariba_after2?host=/tmp' RUN_MIGRATIONS_ON_STARTUP=false ENV=development .venv/bin/uvicorn app.main:app --port 8010`
- الموقع: `cd frontend/hr-web && NEXT_PUBLIC_API_URL=http://localhost:8010/api/v1 npx next dev -p 3010`
- الفحوصات (كلها لازم تنجح قبل أي نشر):
  - `cd backend && LEGACY_PARITY_PG='postgresql:///postgres?host=/tmp' .venv/bin/python -m pytest -q` (حالياً 44 passed, 1 skipped)
  - `cd tools/legacy-parity && npm ci && npm test`
  - `cd frontend/hr-web && npx tsc --noEmit && npx eslint src --quiet`
  - `cd frontend/employee-app && npx tsc --noEmit`

## 7. النسخ الاحتياطية ونقاط الرجوع
- قبل النورملايز: تاغ `before-normalization` = `ad8ee40` + `~/Desktop/HR/backups/before-normalization/` (dump الإنتاج والديمو، متغيرات Railway، الكود، README.txt).
- قبل الترحيل مباشرة: `~/Desktop/HR/backups/before-migration-2026-10-13/db_demo.sql.gz` و`db_production.sql.gz`.
- كلها فيها بيانات حقيقية — لا تُرفع ولا تُشارك. الكود والقاعدة يرجعان معاً.

## 8. المفتوح عندنا قبل 18 أكتوبر
- صاحب المشروع يجرّب الديمو بنفسه (لم نجرّب الدخول على المواقع المنشورة).
- مسيّر سبتمبر 2026 يحتاج اعتماد HR للشهر.
- تغيير معرّف موظف يحتاج سكربتاً مخصصاً (أكثر من 10 جداول، بدون ON UPDATE CASCADE).
- `payroll_lines` فاضي (الكود يستخدم payload).
- ملفات غير مرفوعة: `docs/HANDOFF_NEXT.md`، `docs/db-normalization/restore_keys.sql`.
- لا يوجد CI قبل النشر، التطبيق لم يُبنَ للمتاجر (لا `eas.json`)، لا إيميل، لا مهام مجدولة.

---

## 9. مشروعهم: نظام React من قسم الموارد البشرية (وصل 18 أكتوبر)
### 9.1 التسليم
- الخطاب: يطلبون استلام المشروع ومراجعته، رفعه على بيئة التشغيل، ربط الخدمات والقواعد، تجهيز تطبيق الجوال النهائي، اختبار كل الوظائف، والرد بالخطوات والمدة.
- **الملفات:**
  - `~/Desktop/مشروع الموارد البشرية/React/ARIBA_HR_React/` — برنامج الموارد (`index.html`) + نموذج التقديم العام للمرشحين (`apply.html`).
  - `~/Desktop/مشروع الموارد البشرية/React/ARIBA_Employee_React/` — تطبيق الموظف PWA (`employee.html`).
  - `~/Desktop/مشروع الموارد البشرية/صفحة-التقديم-للرفع (1).zip` — صفحة التقديم كملف HTML واحد.
  - `~/Downloads/مشروع الموارد البشرية.zip` — نفس المجلد (تحققنا: مطابق).
  - `~/Desktop/Ariba_HR_Deployment_Guide.docx` و`~/Desktop/ARIBA_Employee_Deployment_Guide.docx` — أدلة النشر (IIS).
  - `~/Desktop/تقرير_مشروع_أريبا_للموارد_البشرية_النهائي.pdf` — التقرير النهائي (**لم يُقرأ بعد**: لا توجد أداة PDF على الجهاز؛ اطلب إذن صاحب المشروع لتثبيت `poppler` عبر Homebrew ثم اقرأه بـ Read).
  - نسخ HTML قديمة أحدث في التنزيلات: `~/Downloads/1_HR_برنامج_الموارد_البشرية_V114 3.html` و`2_EMPLOYEE_تطبيق_الموظف_V114 4.html` (15 أكتوبر) — غالباً المصدر الذي بُني منه React (فيه V135/V140/V142/V171).
- آخر تعديل على ملفاتهم: 17 أكتوبر.

### 9.2 التقنيات عندهم
React 19.2 + Vite 8.3 (JavaScript/JSX، بدون TypeScript) · react-router-dom 6 (روابط `#/`) · Chart.js 4 · Tabler Icons webfont · jsPDF + html2canvas · oxlint · vitest (غير مستخدم) · vite-plugin-singlefile.
**لا يوجد خادم:** المتصفح يستدعي Supabase مباشرة (`iwviydmapqpqihcdazpe`) عبر دالة واحدة `rpc()` في `src/lib/api.js` → 119 دالة PL/pgSQL. الدخول: Supabase Auth بالبريد (`@accounts.hr.ariba.com.sa`) + `ariba_login_jwt` + `p_token`. الإيميل: 4 Edge Functions (Deno) + Resend. المجدولة: pg_cron + pg_net. الاستضافة المقترحة: IIS (ملفات ثابتة).

### 9.3 هيكل الملفات
**ARIBA_HR_React/src:** `engines/` (attendance, country, empkind, holidays, insurance, leave, payrollRows, payx, runtime) · `lib/` (40 ملفاً: api, auth, config, data, employees, finance, goals, leaves, leaveSnapshots, leaveFiles, payroll, schedule, settlementDoc, tafqeet, util, xlsx, importXlsx, exporter, mailDoc, aiBridge, aiParse, candidates, audit, print, htmlPdf, ...) · `pages/` (72 ملفاً: Dashboard, attendance, audit, candidates, docs, employees, finance [Assets, Eos, EosCalc, InsCalc, Prov, SalCalc, Slip, TaxCalc, Wps], forms, goals, leaves [AllRequests, Balances, Holidays, NewRequest, Overtime, Pending], payroll, reports [index, CustomReport], settings [22 بطاقة], team) · `components/` (AiAssistant, HrBell, ExportDialog, PageExport, ...) · `goals/` · `apply/` · `employee/` · `store/AppStore.jsx` · `nav.js`.
**ARIBA_Employee_React/src:** `employee/` (32 ملفاً: Home, punch, Att, Leaves, Overtime, ForgotPunch, Pay, Prof, ProfileRequests, Docs, MgrSignDocs, SigManager, Approvals, Delegation, Team, MgrTeam, Bell, WorkLocations, liveLeave, EmpStore, ...) · `engines/` (country, holidays, leave, runtime) · `goals/` · `lib/` · `pages/team`.
**sql/ (المرجع = نسخة HR):** `10_phase1_workflow_upgrade` (بدون راتب، راتب مقدم، مهلة المدير/التصعيد، رفض بسبب، إرجاع للمدير، صلاحيات المديرين، التفويض، التقديم بالنيابة، تغيير الآيبان، تعديل البيانات، رفع المستندات، إيميل لكل إشعار، pg_cron) · `11_phase5_candidates` · `12_phase6_goals` · `13_signed_documents` · `14_leave_files` · `15_mail_accounts_and_notify_email` · `16_goals_team_delegation` · `17_ai_send_message` · `18_run_once_remaining` · `19_leave_snapshot` · `20_candidate_invites` · `tests/` (سيناريوهات المراحل 1، 5–9).
**supabase/functions:** `ariba-notify-dispatch`، `ariba-notify-email`، `ariba-send-email`، `ariba-send-report`، `_shared/mail.ts` (+ نسخ `dashboard/` للصق في اللوحة).
**docs:** `SETUP_NEW_FEATURES.md` (المراحل 1–9 وملاحظاتهم)، `M365_GRAPH_SETUP.md`.

### 9.4 الدوال (119)
- **61 قديمة** (من سكيما Supabase الأصلية، نسخة 8 أكتوبر `~/Downloads/supabase_full.sql`): ariba_asset_custody, ariba_assets_delete, ariba_assets_list, ariba_assets_upsert, ariba_attendance, ariba_audit_add_many, ariba_audit_list, ariba_audit_purge_decide, ariba_audit_purge_info, ariba_audit_purge_request, ariba_change_my_password, ariba_company_public, ariba_delete_location, ariba_delete_request, ariba_employee_ack_template, ariba_employee_context, ariba_employee_pending_templates, ariba_get_attendance_settings, ariba_get_document, ariba_hr_attendance_range, ariba_hr_default_password_list, ariba_hr_delete_employee, ariba_hr_delete_leave, ariba_hr_final_approve, ariba_hr_get_setting, ariba_hr_leaves_since, ariba_hr_list_roles, ariba_hr_locations, ariba_hr_record_leave, ariba_hr_reset_password, ariba_hr_send_template, ariba_hr_set_attendance_settings, ariba_hr_set_flexible_hours, ariba_hr_set_role, ariba_hr_set_setting, ariba_hr_submit_overtime, ariba_hr_template_status, ariba_hr_terminate_employee, ariba_list_documents, ariba_mark_notifications_read, ariba_my_attendance_range, ariba_my_notifications, ariba_password_status, ariba_payroll_archive, ariba_payroll_draft_get, ariba_payroll_prepare, ariba_payroll_reopen, ariba_payroll_status_get, ariba_perms_matrix, ariba_perms_set, ariba_save_document, ariba_staff_attendance, ariba_staff_employees, ariba_staff_holidays, ariba_staff_queue, ariba_staff_requests, ariba_sync_attendance, ariba_sync_employee, ariba_sync_holidays, ariba_sync_payroll, ariba_upsert_location.
- **52 جديدة** (في sql/10–20): ariba_doc_employee_sign, ariba_doc_manager_pending, ariba_doc_manager_sign, ariba_doc_my_states, ariba_doc_sign_cfg_get/set, ariba_eval_approve/get/list/save, ariba_hr_apply_key_rotate, ariba_hr_apply_mode_set, ariba_hr_candidate_accept/by_ref/file/reject, ariba_hr_candidates, ariba_hr_get_wf_config, ariba_hr_invite_create/revoke, ariba_hr_invites, ariba_hr_leave_snapshots, ariba_hr_manager_perms, ariba_hr_override_workflow, ariba_hr_reject, ariba_hr_return_to_manager, ariba_hr_run_escalation, ariba_hr_send_message, ariba_hr_set_leave_snapshots, ariba_hr_set_manager_perms, ariba_hr_set_wf_config, ariba_leave_file_delete/get/list/save, ariba_mail_delete/get/set, ariba_mgr_my_perms, ariba_mgr_team, ariba_mgr_team_leave_snapshots, ariba_mgr_team_requests, ariba_my_delegation, ariba_my_goals, ariba_my_leave_snapshot, ariba_set_delegation, ariba_submit_request, ariba_submit_request_for, ariba_target_delete/save, ariba_targets_list, ariba_workflow_action. (أعادوا تعريف 3 قديمة: ariba_submit_request، ariba_workflow_action، ariba_hr_override_workflow.)
- **6 ناقصة** (تستدعيها الواجهة وغير موجودة في ملفاتهم): `ariba_get_brand`، `ariba_hr_set_ramadan_flex`، `ariba_my_tasks`، `ariba_send_task`، `ariba_task_update`، `ariba_team_availability` (= ميزة «توفر الفريق والمهام» + دوام رمضان + هوية التطبيق). مطلوبة من قسم الموارد.
- 12 جدولاً جديداً: ariba_candidate_files, ariba_candidate_invites, ariba_candidates, ariba_delegations, ariba_doc_signing, ariba_evaluations, ariba_leave_files, ariba_leave_snapshots, ariba_mail_accounts, ariba_manager_perms, ariba_private_kv, ariba_targets.

### 9.5 الميزات الموجودة عندهم وغير الموجودة عندنا
المرشحون ونموذج التقديم العام وروابط تقديم لمرة واحدة · المستهدفات والتقييم (سنوي/ربع/شهري) · توفر الفريق والمهام · حاسبة الراتب (4 أوضاع) · حاسبة ضريبة القيمة المضافة · ملف التأمينات الشهري · تقرير المخصصات · ملف تحويل الرواتب (WPS) · الأصول والعهد مع الإهلاك والجرد · منشئ التقارير المخصص + «تصدير الصفحة» Excel/PDF/Word + إرسال بالإيميل · سجل التعديلات وطلبات الحذف · إرسال الإيميل والإشعارات بالبريد · إجازة بدون راتب · راتب مقدم بحد نسبة · التصعيد بعد المهلة · الرفض بسبب والإرجاع للمدير · تفويض المدير · صلاحيات لكل مدير على فريقه · التقديم بالنيابة · تغيير الآيبان بخطاب · طلب تعديل البيانات · رفع المستندات من الموظف · التوقيع على المستندات (موظف ومدير) · مرفقات الإجازات على الخادم · جدول دوام رسمي + رمضان · استرجاع الإجازة السنوية المقطوعة بمرضية · طرق استحقاق (تقويمية/شهرية/أيام عمل) · حد ترحيل قابل للتعديل · تنبيهات V142 (إقامة 60، جواز 90، عقد 60، تجربة 30) · المساعد الذكي (AiAssistant/aiParse) · دعم دولة مصر · البدل كنسبة من الأساسي · العرض الوظيفي من حاسبة الراتب · إعدادات البريد والترويسة والعلامة المائية.

### 9.5.1 من التقرير PDF (قُرئ نصه في 18 أكتوبر — صاحب المشروع لصقه في المحادثة)
ملخص ما في التقرير (25 شريحة)، وما فيه **زيادة** على ملف المقارنة مُعلَّم بـ ➕:
- **البنية:** برنامجان (الموارد `index.html` + تطبيق الموظف `employee.html`) + نموذج التقديم `apply.html`، وقاعدة Supabase واحدة. أرقام: +170 نسخة قبل React، 11 ملف ترقية للقاعدة (10–20)، 10 تبويبات في التطبيق، 25 صفحة في برنامج الموارد.
- **25 صفحة في 7 أقسام:** المالية 11 (المسيّر، كشف الراتب، ملف تحويل الرواتب، المخصصات، حاسبات التأمينات والراتب والضريبة، الأصول والعهد، نهاية الخدمة، المخالصة) · الموظفون 4 (الموظفون، المرشحون، المستهدفات، التقييم) · إدارية 4 (التقارير، الإعدادات، سجل التعديلات، النماذج) · الحضور والإجازات 4 (الحضور، مواقع البصمة، الإجازات والطلبات، توفر الفريق والمهام) · عام والوثائق 2 (لوحة التحكم، الوثائق وتنبيهاتها).
- **تطبيق الموظف — 10 تبويبات:** الرئيسية (ملخص اليوم والتنبيهات) · الحضور (البصمة بالموقع ونسيان البصمة) · الإجازات (الرصيد والطلبات، بدون راتب، راتب مقدم) · الراتب (الكشف الشهري) · عمل إضافي · أهدافي وتقييمي · الموافقات (للمديرين) · ملفي (رفع مستند، تعديل بيانات، تغيير الآيبان) · فريقي (للمدير: الفريق والمهام والتقديم بالنيابة) · مستندات (الاستلام والموافقة بالتوقيع). ➕ عربي/إنجليزي، ➕ وضع ليلي، التبويبات الخضراء الفاتحة للمديرين فقط.
- **الأدوار:** مسؤول HR، رئيس المجلس، الرئيس التنفيذي، المدير الإداري، المالية، المحاسب، المدير، الموظف · صلاحيات لكل صفحة · صلاحيات منفصلة للمدير على فريقه · التفويض والتقديم بالنيابة.
- **الأمان:** الجلسة في المتصفح فقط، كلمات المرور لا تُحفظ، تنبيه عند الخمول ثم إنهاء الجلسة، ➕ **دخول بالبصمة / Face ID** على الأجهزة الداعمة، سجل تعديلات لكل عملية، ➕ **حذف السجلات القديمة بموافقة المالية**.
- **21 بطاقة إعدادات:** بيانات الشركة، الشعار والهوية، الورق الرسمي، المفوّض بالتوقيع، الدولة، التأمينات، جدول الدوام، الساعة المرنة، البصمة، ترحيل الإجازات، سير الطلبات والمهل، الأدوار، الصلاحيات، صلاحيات المديرين، كلمات المرور، البريد والإشعارات، توقيع المستندات، نموذج التقديم، القوائم الرئيسية، المستبعدون، ألوان البرنامج.
- **10 مستندات رسمية** (عربي وإنجليزي، ورق أريبا، توقيع وختم، تفقيط): شهادة راتب، إخلاء طرف، شهادة خبرة، انتهاء عقد، مباشرة عمل، استلام عهدة، تمديد، إنهاء خدمة، ➕ عرض وظيفي، مخالصة. PDF بحجم A4: صفحة واحدة للمستندات الرسمية (يُصغَّر لو زاد قليلاً — V109)، وصفحات متعددة للتقارير الطويلة. الإرسال من بريد المسؤول أو بريد الشركة (SMTP أو Resend أو Microsoft 365)، ➕ والبديل لو الإرسال غير متاح: يحمّل المستند ويفتح Outlook.
- ➕ **مساعد أريبا AI (V112):** يفهم الأوامر بالعامية، يفتح الصفحات ويعرض الإحصائيات، يرسل رسالة أو إشعاراً لموظف محدد، ويطلب تأكيداً قبل أي تنفيذ.
- **التقارير والتصدير:** منشئ تقارير مخصص (أعمدة وفلاتر)، زر «تصدير الصفحة» أعلى أي صفحة، Excel وWord وPDF، إرسال التقرير بالإيميل لمستلمين مختارين.
- **تنبيهات استباقية:** الإقامة والجواز والعقد وفترة التجربة (V112 وV125 وV142).
- ➕ **استيراد الموظفين من Excel مع مطابقة الأعمدة (V139).**
- **سير الطلبات:** الموظف ← المدير المباشر (يوافق أو يرفض بسبب أو يرجّع) ← الرئيس التنفيذي (للطلبات التي تحتاجه) ← الموارد البشرية (الاعتماد النهائي والتسجيل). كل خطوة إشعار داخل التطبيق + إيميل. تفويض ونيابة. مهلة وتصعيد تلقائي.
- **محطات النسخ القديمة:** V53 أرشيف المسيّرات · V60 القوائم الرئيسية · V68 شهادات الخدمة · V83 الصلاحيات · V86 الساعة المرنة · V109 ضبط الصفحة الواحدة · V112 مساعد AI · V114 كلمات المرور · V117 تقارير الحضور · V119 محرك المسيّر · V120 كتلة التوقيع والختم · V130 ثم V135 الإعفاء من التأمينات · V134 الورق الرسمي · V139 استيراد الموظفين · V142 التنبيهات · V152 ➕ تنظيم الإعدادات في أقسام مرقّمة · V155 إرسال الإيميل بمرفق · V171 طبقة الدولة (مصر).
- **النقل إلى React:** صفحة لكل ملف تُحمَّل عند فتحها · المعادلات منقولة حرفياً في مجلد مستقل · ثلاثة برامج مستقلة · الصلاحيات في دوال القاعدة مع اختبارات SQL · ➕ ألوان أريبا وخط ARIBA Two كمتغيرات مع وضع نهاري وليلي · ➕ تبديل اللغة واتجاه الصفحة بالكامل مع قاموس ترجمة.
- **المراحل 1–9 وملفات 15–20:** كما في القسم 9.3. ملف 15: بريد لكل مسؤول وبريد للشركة · 16: أهدافي وفريقي وتفويض المدير · 17: رسائل المساعد · 18: الأجزاء التي رفضت المنصة تنفيذها تلقائياً · 19: رصيد التطبيق = رصيد برنامج الموارد 100% · 20: رابط تقديم خاص لكل مرشح **ينتهي بعد 72 ساعة**.
- **تعديلات 15 و17 و18 أكتوبر (واجهة):** تطبيق اللغة والاتجاه فوراً عند الفتح · زر البصمة/Face ID ظاهر دائماً مع رسالة توضيحية · القائمة الجانبية: العربي يميناً والإنجليزي يساراً، والمحتوى يتمدّد عند إغلاقها · شاشات دخول بألوان أريبا (بيج وأبيض وأخضر) وخاناتها فاتحة حتى في الوضع الليلي · مساحة أكبر للتوقيع والختم · أسماء الفريق بالإنجليزي في التطبيق · ➕ **جرس إشعارات بعدّاد يتحدّث كل 3 ثوانٍ** · مرفقات الإيميل الرسمية في صفحة A4 واحدة · PDF الصفحة الواحدة يبدأ من أعلى الصفحة والطويل صفحات متعددة.
- **ما قالوا إنه يحتاج متابعة (عيوب يعترفون بها):** تجربة الإيميل الفعلي لم تتم · 33 ملفاً مكرراً بين البرنامجين · تحديث الإشعارات كل 3 ثوانٍ ثقيل (الأفضل 15–30) · خصم الإجازة بدون راتب والراتب المقدم من المسيّر ما زال يدوياً · خط ARIBA Two يُقرأ من الجهاز ويجب تثبيته · أيقونة المتصفح افتراضية.
- **قرارنا لهذه البنود:** كل ➕ يُضاف عندنا (مهمة 1 تضعه في الخطة). Face ID في تطبيقنا الأصلي عبر `expo-local-authentication`، وفي الموقع عبر WebAuthn إن أمكن. الإشعارات في تطبيقنا Push بدل التحديث كل 3 ثوانٍ، وفي الموقع تحديث دوري معقول — نفس النتيجة للمستخدم. خصم بدون راتب والراتب المقدم يبقى يدوياً مثلهم (مطابقة).

### 9.6 عيوبهم المعروفة (لا ننقلها)
32 بنداً مفصّلة في محادثة 18 أكتوبر؛ أهمها: لا خادم والأمان معلّق على RLS والدوال · سجل التعديلات يُكتب من المتصفح · رصيد التطبيق يعتمد على أن متصفح الموارد مفتوح · الحسابات في المتصفح · PWA بدل تطبيق أصلي · 6 دوال ناقصة · `sw.js`/manifest في برنامج الموارد نسخة من تطبيق الموظف وغير مربوطة · إعدادات مثبتة في الكود · نشر يدوي بلا ديمو.
**القاعدة:** ننقل **ميزاتهم ومعادلاتهم وشاشاتهم**، ونبنيها على **بنيتنا** (خادم FastAPI، القاعدة المرتّبة، Next.js، Expo) — لا ننقل طريقتهم في الاتصال المباشر بالقاعدة ولا الحسابات في المتصفح ولا PWA.

---

## 10. نتيجة مقارنة المعادلات (18 أكتوبر)
- الملفات: `~/Desktop/HR/مقارنة_المعادلات.xlsx` (188 معادلة، ملوّنة) و`~/Desktop/HR/مقارنة_المعادلات.md` (الشرح والأرقام).
- النتيجة: 🟢 مطابق 81 · 🟠 شبه مطابق 30 · 🔴 غير مطابق 24 · 🔵 عندهم فقط 42 · 🟣 عندنا فقط 11.
- سكربتات التشغيل (scratchpad المحادثة السابقة، قد لا تكون متاحة): `fcmp/cmp1.mjs`، `gen2.mjs`، `ours2.py`، `cmp2.mjs`، `extract.mjs`، `build_xlsx.py`. أعد بناءها إن احتجت.
- أهم الفروق: طريقة استحقاق الإجازة (تقويمية عندهم افتراضياً) · فائض الإجازة لنهاية الخدمة من أول سنة عندهم · جدول التأمينات التلقائي عندهم (عندنا لا نسب قبل 2026) · السكن 25% ثابت في تأمينات المسيّر عندهم · noEos للاستشاري/التمهير/المتدرب · تنبيهات V142 · غياب م.87 وتصحيحات A/B/C/G/J/K عندهم.
- إعدادات إنتاجنا (نسخة 13 أكتوبر المحلية): لا يوجد `ins_settings` ولا `insurance_rules` ولا `leave_accrual_method`؛ يوجد `leave_carry = {days:10, enabled:true}`.

## 11. القرار (18 أكتوبر)
**نظامنا هو الأساس** (التقنيات والسكيما المرتّبة والبيانات وطريقة العمل). ننقل من نظامهم **كل** الميزات والشاشات والمعادلات، ونبنيها كاملة، ونتحقق منها كاملة، ثم ننشر على الديمو والإنتاج بعد «انشر». قسم الموارد قال إنهم **لن يرسلوا تحديثات** بعد هذا التسليم.

## 12. قواعد المطابقة (قرار صاحب المشروع 18 أكتوبر)
حسب ملف المقارنة الملوّن:
1. 🟢 **مطابق:** يبقى كما هو بالضبط.
2. 🟠/🔴 **شبه مطابق أو غير مطابق:** نعدّل كودنا ليطابق **معادلتهم بالضبط** — لا نعتمد على منطقنا.
3. 🟣 **عندنا فقط:** يُحذف — **مُعتمد من صاحب المشروع (18 أكتوبر) بدون استثناء**، بما فيها تصحيحات نظام العمل A–K، وقفل الدخول بعد المحاولات الفاشلة، والإنهاء التلقائي للعقود. النظام يصير مثل نظامهم تماماً.
4. 🔵 **عندهم فقط:** يُضاف.
5. الميزات والواجهات الجديدة تُبنى **بالضبط مثل موقعهم وتطبيقهم** (نفس الشاشات والحقول والنصوص والترتيب)، داخل Next.js وExpo.
