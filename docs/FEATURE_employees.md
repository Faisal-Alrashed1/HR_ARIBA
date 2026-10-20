# Feature: employees — الميزة: الموظفون

> English first, then the full Arabic version (same content).

---

# English

## Feature: employees

### What it does
- Directory with tabs **all / active / terminated / Tamheer / training / consultants / Saudi / non-Saudi**,
  workplace and department filters, search (number, Arabic/English name, job title), sort, pagination, tab counts.
- Employee record in 5 tabs: basic data · documents (numbers + expiries with days-left badges) · contract ·
  salary · dependents (next phase).
- Create (HR/admin), edit (PATCH, only changed fields are sent), end service (date + labour-law article + reason),
  reactivate, create a login / issue a temporary password.
- Dashboard headcount KPIs and Saudization % from `/employees/counts`.

### Rules
- `emp_no` is unique, lower-cased, and becomes the username (`emp084`).
- Fixed-term contracts: end date = join + duration (see BUSINESS_RULES › Contracts). Indefinite: no end date.
- Non-Saudis are always on the `non_saudi` GOSI system. Saudis default to `matching`; HR may pick `non_matching`.
- SAR always has exchange rate 1.
- An employee can't be their own manager; manager, workplace, department and nationality must exist.
- Termination date can't be before the join date. Terminating twice or reactivating an active employee → 409.

### Visibility (server-side)
| Role | Sees | Salary | Full IDs |
|---|---|---|---|
| employee | self | own | own |
| manager | self + direct reports | own only | own only |
| finance | no directory (payroll endpoints later) | — | — |
| hr, admin | all | ✔ | ✔ |
| ceo | all | ✘ | ✘ (masked) |

Lists always show the masked ID and never salaries. Records outside the caller's scope return 404.
Reads and writes are audited (`employee` entity: list, read, create, update, terminate, reactivate).

### Code
- Backend: `services/employees.py`, `services/contracts.py`, `services/saudization.py`, `routers/employees.py`, `routers/settings.py`
- Frontend: `lib/employees.ts`, `app/employees/`, `app/employees/[id]/`, `app/employees/new/`, `components/employees/employee-form.tsx`, `app/dashboard/`, `app/me/`
- Tests: `tests/test_employees.py`, `tests/test_permissions.py`

### Known limits
- The manager picker loads the first 100 employees (enough for today's ~85; replace with search if that grows).
- Dependents and document uploads arrive in the next phase.

---

# العربي

## الميزة: الموظفون

### ما الذي تفعله
- دليل بتبويبات **الكل / النشطون / المنتهية خدماتهم / تمهير / التدريب / المستشارون / السعوديون / غير السعوديين**،
  ومرشّحات مكان العمل والقسم، والبحث (الرقم، الاسم بالعربية/الإنجليزية، المسمى الوظيفي)، والفرز، والترقيم، وأعداد التبويبات.
- سجل الموظف في 5 تبويبات: البيانات الأساسية · المستندات (الأرقام + تواريخ الانتهاء مع شارات الأيام المتبقية) · العقد ·
  الراتب · التابعون (المرحلة التالية).
- الإنشاء (الموارد البشرية/المدير العام)، والتعديل (PATCH، تُرسل الحقول المتغيّرة فقط)، وإنهاء الخدمة (التاريخ + مادة نظام العمل + السبب)،
  وإعادة التفعيل، وإنشاء حساب دخول / إصدار كلمة مرور مؤقتة.
- مؤشرات أداء عدد الموظفين في لوحة المعلومات ونسبة السعودة % من `/employees/counts`.

### القواعد
- `emp_no` فريد، بأحرف صغيرة، ويصبح اسم المستخدم (`emp084`).
- العقود محددة المدة: تاريخ الانتهاء = تاريخ الالتحاق + المدة (انظر BUSINESS_RULES › Contracts). غير محددة المدة: لا تاريخ انتهاء.
- غير السعوديين دائمًا على نظام GOSI `non_saudi`. السعوديون افتراضيًا على `matching`؛ ويمكن للموارد البشرية اختيار `non_matching`.
- الريال السعودي (SAR) سعر صرفه دائمًا 1.
- لا يمكن للموظف أن يكون مدير نفسه؛ ويجب أن يكون المدير ومكان العمل والقسم والجنسية موجودين.
- لا يمكن أن يسبق تاريخ إنهاء الخدمة تاريخ الالتحاق. إنهاء الخدمة مرتين أو إعادة تفعيل موظف نشط ← 409.

### الظهور (من جهة الخادم)
| الدور | يرى | الراتب | الهويات الكاملة |
|---|---|---|---|
| employee | نفسه | راتبه | هويته |
| manager | نفسه + مرؤوسوه المباشرون | راتبه فقط | هويته فقط |
| finance | لا دليل (نقاط نهاية الرواتب لاحقًا) | — | — |
| hr, admin | الجميع | ✔ | ✔ |
| ceo | الجميع | ✘ | ✘ (مقنّعة) |

تعرض القوائم دائمًا الهوية المقنّعة ولا تعرض الرواتب أبدًا. السجلات خارج نطاق المستدعي تُعيد 404.
تخضع القراءات والكتابات للتدقيق (الكيان `employee`: list، read، create، update، terminate، reactivate).

### الشيفرة
- الخلفية: `services/employees.py`، `services/contracts.py`، `services/saudization.py`، `routers/employees.py`، `routers/settings.py`
- الواجهة الأمامية: `lib/employees.ts`، `app/employees/`، `app/employees/[id]/`، `app/employees/new/`، `components/employees/employee-form.tsx`، `app/dashboard/`، `app/me/`
- الاختبارات: `tests/test_employees.py`، `tests/test_permissions.py`

### القيود المعروفة
- منتقي المدير يحمّل أول 100 موظف (يكفي لعدد اليوم البالغ نحو 85؛ استبدله بالبحث إذا زاد العدد).
- التابعون ورفع المستندات يصلون في المرحلة التالية.
