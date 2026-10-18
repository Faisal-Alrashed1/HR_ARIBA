# تسليم للجلسة السحابية — نقل نظام React (2026-10-18)

اقرأ بالترتيب: `docs/port-context/PORT_PROMPT_AR.md` (البرومبت الكامل: القواعد والقرارات والمهام 1–11)،
`docs/PORT_PLAN.md` (الخطة: 188 صفاً، الشاشات، الدوال، الجداول، المراحل)، `docs/port-context/ARIBA_MASTER_CONTEXT.md`،
`docs/port-context/task0_reading_notes.md`، `tools/react-parity/README.md`.

## أين المواد في الريبو (بدل مسارات سطح المكتب في البرومبت)
| في البرومبت | في الريبو |
|---|---|
| `~/Desktop/مشروع الموارد البشرية/React` | `reference/hr-react/` (نسخة للقراءة فقط، المفتاح العام مخفي) |
| `~/Desktop/HR/مقارنة_المعادلات.xlsx` و`.md` | `docs/port-context/` + `tools/react-parity/comparison_rows.json` |
| `ARIBA_MASTER_CONTEXT.md` والبرومبت | `docs/port-context/` |
| قاعدة `ariba_after2` | لا توجد بيانات في السحابة. السكيما فقط: `docs/db-schema/current_schema.sql` (أنشئ قاعدة Postgres محلية منها وأضف بيانات تجربة) |

## ما تم
- المهمة 1: `docs/PORT_PLAN.md`.
- المهمة 2: `tools/react-parity` (`cd tools/react-parity && npm test`؛ يحتاج `frontend/hr-web/node_modules` و`backend/.venv`).
- المهمة 3 (جزئياً، commit `8db0266`): الخادم مطابق لهم في محرك الإجازات (`services/leave.py`، الطرق الثلاث)،
  وجدول التأمينات التلقائي وcalcIns (`services/gosi.py`)، وطبقة مصر (`services/country.py`)، وأرقام الموظف المحفوظة.
  مجموعات react-parity: leave_* وrates وfigures = صفر فرق.
  معادلاتهم منسوخة حرفياً في `frontend/hr-web/src/lib/calc/` (payx، payroll-rows، insurance، country، schedule،
  salcalc، tax، assets، wps، goals، inscalc، provisions، eos-react، settle-react) — **الصفحات لم تُحوَّل إليها بعد.**

## التالي (بالترتيب)
1. إكمال المهمة 3: تحويل `lib/calc/payroll.ts` ليستخدم `payroll-rows.ts` (عبر تحويل SalaryBasisRow إلى شكل الموظف القديم)،
   و`eos.ts`/`settlement.ts` إلى `eos-react`/`settle-react`، وصفحات المسيّر ونهاية الخدمة والمخالصة، وإعداد `rt` في الموقع
   من الإعدادات (insurance_rules، leave_carry، leave_accrual_method، attendance_schedule، country_system)، وصفوف
   التنبيهات V142 في `_dashboard_alerts`، والرواتب حسب جهة العمل، والغائبين، وdaysLeft بـ round، والصفان 113/142،
   وأخطاء صفحة المسيّر التي كشفتها الأداة (insSystem new/exempt). الهدف: `npm test` في react-parity = صفر فرق.
   أضف `salary_basis` الحقول اللازمة (is_hourly…). حدّث pytest وtools/legacy-parity وdocs/LOGIC_AUDIT.md.
2. المهام 4، 5 (ترحيل في `docs/db-migrations/` مع سكربت مثل run_on_railway.sh — جرّبه على قاعدة من السكيما)، 6، 7، 9.
3. المهمة 8 (Expo) والمهمة 10 (المحاكي، نسخة الإنتاج، تشغيل نسختهم) تحتاج جهاز صاحب المشروع: اكتب الكود والـ tsc فقط.

## قواعد
- commit لكل مرحلة على `feature/hr-react-port` وpush للفرع نفسه. **لا تدمج في main ولا تنشر**: النشر بعد التحقق على جهاز
  صاحب المشروع (المهمة 10)، وأوامر Railway يشغّلها هو.
- لا بيانات حقيقية ولا كلمات مرور في الريبو. الرد بالعربي.
