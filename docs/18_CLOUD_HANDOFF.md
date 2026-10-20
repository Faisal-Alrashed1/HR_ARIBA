# Handoff to the Cloud Session — Porting the React System (2026-10-18) — تسليم للجلسة السحابية — نقل نظام React (2026-10-18)

> English first, then the full Arabic version (same content).

---

# English

## Handoff to the Cloud Session — Porting the React System (2026-10-18)

Read in order: `docs/port-context/PORT_PROMPT_AR.md` (the full prompt: rules, decisions and Tasks 1–11),
`docs/17_PORT_PLAN.md` (the plan: 188 rows, screens, functions, tables, phases), `docs/port-context/ARIBA_MASTER_CONTEXT.md`,
`docs/port-context/task0_reading_notes.md`, `tools/react-parity/README.md`.

### Where the materials are in the repo (instead of the desktop paths in the prompt)
| In the prompt | In the repo |
|---|---|
| `~/Desktop/مشروع الموارد البشرية/React` | `reference/hr-react/` (read-only copy, public key hidden) |
| `~/Desktop/HR/مقارنة_المعادلات.xlsx` and `.md` | `docs/port-context/` + `tools/react-parity/comparison_rows.json` |
| `ARIBA_MASTER_CONTEXT.md` and the prompt | `docs/port-context/` |
| The `ariba_after2` database | There is no data in the cloud. Schema only: `docs/db-schema/current_schema.sql` (create a local Postgres database from it and add test data) |

### What was done
- Task 1: `docs/17_PORT_PLAN.md`.
- Task 2: `tools/react-parity` (`cd tools/react-parity && npm test`; needs `frontend/hr-web/node_modules` and `backend/.venv`).
- Task 3 (partially, commit `8db0266`): the server matches theirs in the leave engine (`services/leave.py`, the three methods),
  the automatic social-insurance table and calcIns (`services/gosi.py`), the Egypt layer (`services/country.py`), and stored employee figures.
  react-parity groups: leave_*, rates and figures = zero differences.
  Their formulas are copied literally into `frontend/hr-web/src/lib/calc/` (payx, payroll-rows, insurance, country, schedule,
  salcalc, tax, assets, wps, goals, inscalc, provisions, eos-react, settle-react) — **the pages have not been switched to them yet.**

### Next (in order)
1. Finish Task 3: switch `lib/calc/payroll.ts` to use `payroll-rows.ts` (by converting SalaryBasisRow to the old employee shape),
   and `eos.ts`/`settlement.ts` to `eos-react`/`settle-react`, and the payroll, end-of-service and settlement pages, and set up `rt` on the website
   from the settings (insurance_rules, leave_carry, leave_accrual_method, attendance_schedule, country_system), and the V142
   alert rows in `_dashboard_alerts`, salaries by work entity, absentees, daysLeft with round, rows 113/142,
   and the payroll-page bugs the tool uncovered (insSystem new/exempt). The goal: `npm test` in react-parity = zero differences.
   Add the needed fields to `salary_basis` (is_hourly…). Update pytest, tools/legacy-parity and docs/15_LOGIC_AUDIT.md.
2. Tasks 4, 5 (a migration in `docs/db-migrations/` with a script like run_on_railway.sh — try it on a database built from the schema), 6, 7, 9.
3. Task 8 (Expo) and Task 10 (simulator, production copy, running their version) need the project owner's machine: write the code and tsc only.

### Rules
- One commit per phase on `feature/hr-react-port` and push to the same branch. **Do not merge into main and do not deploy**: deployment comes after verification on the
  project owner's machine (Task 10), and he runs the Railway commands.
- No real data and no passwords in the repo. Replies in Arabic.

---

# العربي

## تسليم للجلسة السحابية — نقل نظام React (2026-10-18)

اقرأ بالترتيب: `docs/port-context/PORT_PROMPT_AR.md` (البرومبت الكامل: القواعد والقرارات والمهام 1–11)،
`docs/17_PORT_PLAN.md` (الخطة: 188 صفاً، الشاشات، الدوال، الجداول، المراحل)، `docs/port-context/ARIBA_MASTER_CONTEXT.md`،
`docs/port-context/task0_reading_notes.md`، `tools/react-parity/README.md`.

### أين المواد في الريبو (بدل مسارات سطح المكتب في البرومبت)
| في البرومبت | في الريبو |
|---|---|
| `~/Desktop/مشروع الموارد البشرية/React` | `reference/hr-react/` (نسخة للقراءة فقط، المفتاح العام مخفي) |
| `~/Desktop/HR/مقارنة_المعادلات.xlsx` و`.md` | `docs/port-context/` + `tools/react-parity/comparison_rows.json` |
| `ARIBA_MASTER_CONTEXT.md` والبرومبت | `docs/port-context/` |
| قاعدة `ariba_after2` | لا توجد بيانات في السحابة. السكيما فقط: `docs/db-schema/current_schema.sql` (أنشئ قاعدة Postgres محلية منها وأضف بيانات تجربة) |

### ما تم
- المهمة 1: `docs/17_PORT_PLAN.md`.
- المهمة 2: `tools/react-parity` (`cd tools/react-parity && npm test`؛ يحتاج `frontend/hr-web/node_modules` و`backend/.venv`).
- المهمة 3 (جزئياً، commit `8db0266`): الخادم مطابق لهم في محرك الإجازات (`services/leave.py`، الطرق الثلاث)،
  وجدول التأمينات التلقائي وcalcIns (`services/gosi.py`)، وطبقة مصر (`services/country.py`)، وأرقام الموظف المحفوظة.
  مجموعات react-parity: leave_* وrates وfigures = صفر فرق.
  معادلاتهم منسوخة حرفياً في `frontend/hr-web/src/lib/calc/` (payx، payroll-rows، insurance، country، schedule،
  salcalc، tax، assets، wps، goals، inscalc، provisions، eos-react، settle-react) — **الصفحات لم تُحوَّل إليها بعد.**

### التالي (بالترتيب)
1. إكمال المهمة 3: تحويل `lib/calc/payroll.ts` ليستخدم `payroll-rows.ts` (عبر تحويل SalaryBasisRow إلى شكل الموظف القديم)،
   و`eos.ts`/`settlement.ts` إلى `eos-react`/`settle-react`، وصفحات المسيّر ونهاية الخدمة والمخالصة، وإعداد `rt` في الموقع
   من الإعدادات (insurance_rules، leave_carry، leave_accrual_method، attendance_schedule، country_system)، وصفوف
   التنبيهات V142 في `_dashboard_alerts`، والرواتب حسب جهة العمل، والغائبين، وdaysLeft بـ round، والصفان 113/142،
   وأخطاء صفحة المسيّر التي كشفتها الأداة (insSystem new/exempt). الهدف: `npm test` في react-parity = صفر فرق.
   أضف `salary_basis` الحقول اللازمة (is_hourly…). حدّث pytest وtools/legacy-parity وdocs/15_LOGIC_AUDIT.md.
2. المهام 4، 5 (ترحيل في `docs/db-migrations/` مع سكربت مثل run_on_railway.sh — جرّبه على قاعدة من السكيما)، 6، 7، 9.
3. المهمة 8 (Expo) والمهمة 10 (المحاكي، نسخة الإنتاج، تشغيل نسختهم) تحتاج جهاز صاحب المشروع: اكتب الكود والـ tsc فقط.

### قواعد
- commit لكل مرحلة على `feature/hr-react-port` وpush للفرع نفسه. **لا تدمج في main ولا تنشر**: النشر بعد التحقق على جهاز
  صاحب المشروع (المهمة 10)، وأوامر Railway يشغّلها هو.
- لا بيانات حقيقية ولا كلمات مرور في الريبو. الرد بالعربي.
