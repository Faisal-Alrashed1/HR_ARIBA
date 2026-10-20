# Rebuild Plan — خطة إعادة البناء

> English first, then the full Arabic version (same content).

---

# English

## Rebuild plan — the only reference is the new version

## The rule
- **Reference:** `frontend/legacy/` (the new, split-up version, with updates up to V130) + `docs/ARIBA_HR_System_Documentation.md`.
- **Goal:** the website and the app match the HTML file **exactly**: same screens, fields, buttons, texts and formulas.
- If an old decision in `BUSINESS_RULES.md` differs from the HTML file → **we follow the HTML** and write down the difference.
- The existing code in `backend` and `frontend/hr-web` was built from an **older** version; it is reviewed and corrected against the new version.

## How we work on each module
1. Read the module's files in `frontend/legacy/*/js/<folder>` + its section in the documentation.
2. Port the formula to `backend/app/services/` and write a test that compares the result with the result of **the old JS code itself** (the examples in section 4 of the documentation).
3. Build the screen in `frontend/hr-web` (and/or `frontend/employee-app`) with the same elements as the HTML.
4. Compare the screen with the old version side by side.

## Order
| # | Module | legacy references | Status |
|---|---|---|---|
| 0 | List of differences between what is built now and the new version (employees, GOSI V130, end of service, dashboard) | — | ⏳ |
| 1 | Employees + GOSI (calcIns + V130 exemption) + contract | `js/main/06-employees`, `js/calculations/05`, `js/payroll/114-*` | 🟡 V130 exemption ✅ (2026-10-05) — remaining: review of the employee screen |
| 2 | Locations + attendance (punch, flexible hours, lateness, V117 reports, V121 employee locations) | `js/attendance`, `js/locations` | ❌ |
| 3 | Leaves (ledger, 10-day carry-over, entitlement) + requests and the approval workflow | `js/calculations/03,08`, `js/leaves`, `js/requests` | ❌ |
| 4 | Payroll V119 (Excel columns) + payslip | `js/payroll/107-*`, `js/calculations/06` | ❌ |
| 5 | End of service + final settlement + amount in words | `js/calculations/01,04,07`, `js/settlement-eos` | 🟡 End-of-service page (rEOS) ✅ — remaining: settlement calculator (leave compensation = gross ÷ 30) and amount in words |
| 6 | Forms and letters (V70/V71, V117 salary certificate) + documents | `js/forms` | ❌ |
| 7 | Reports + dashboard + settings and permissions | `js/reports`, `js/main/05,15,16` | 🟡 |
| 8 | Mobile app: attendance, leaves, requests, my team, documents, notifications | `frontend/legacy/employee-portal` | 🟡 foundation ready |
| 9 | Data migration from Supabase | — | ❌ |

## Open questions
Section 9 in `ARIBA_HR_System_Documentation.md` (35 questions for the HR officer).

---

# العربي

## خطة إعادة البناء — المرجع الوحيد هو النسخة الجديدة

## القاعدة
- **المرجع:** `frontend/legacy/` (النسخة الجديدة المفصولة، فيها التحديثات حتى V130) + `docs/ARIBA_HR_System_Documentation.md`.
- **الهدف:** الموقع والتطبيق يطابقون ملف HTML **بالضبط**: نفس الشاشات، الحقول، الأزرار، النصوص، والمعادلات.
- إذا اختلف قرار قديم في `BUSINESS_RULES.md` عن ملف HTML ← **نتبع HTML** ونكتب الفرق.
- الكود الموجود في `backend` و`frontend/hr-web` انبنى من نسخة **أقدم**؛ يُراجع ويُصحَّح على النسخة الجديدة.

## طريقة العمل لكل وحدة
1. نقرأ ملفات الوحدة في `frontend/legacy/*/js/<المجلد>` + قسمها في التوثيق.
2. ننقل المعادلة إلى `backend/app/services/` ونكتب اختبار يقارن النتيجة بنتيجة **كود الـ JS القديم نفسه** (أمثلة القسم 4 في التوثيق).
3. نبني الشاشة في `frontend/hr-web` (و/أو `frontend/employee-app`) بنفس عناصر HTML.
4. نقارن الشاشة بالنسخة القديمة جنب بعض.

## الترتيب
| # | الوحدة | مراجع legacy | الحالة |
|---|---|---|---|
| 0 | قائمة الفروق بين المبني حالياً والنسخة الجديدة (موظفين، تأمينات V130، نهاية خدمة، لوحة تحكم) | — | ⏳ |
| 1 | الموظفين + التأمينات (calcIns + إعفاء V130) + العقد | `js/main/06-employees`, `js/calculations/05`, `js/payroll/114-*` | 🟡 إعفاء V130 ✅ (2026-10-05) — باقي: مراجعة شاشة الموظف |
| 2 | المواقع + الحضور (البصمة، المرن، التأخير، تقارير V117، مواقع الموظف V121) | `js/attendance`, `js/locations` | ❌ |
| 3 | الإجازات (الدفتر، الترحيل 10 أيام، الاستحقاق) + الطلبات ومسار الاعتماد | `js/calculations/03,08`, `js/leaves`, `js/requests` | ❌ |
| 4 | المسير V119 (أعمدة Excel) + كشف الراتب | `js/payroll/107-*`, `js/calculations/06` | ❌ |
| 5 | نهاية الخدمة + المخالصة + التفقيط | `js/calculations/01,04,07`, `js/settlement-eos` | 🟡 صفحة نهاية الخدمة (rEOS) ✅ — باقي: حاسبة المخالصة (بدل الإجازة = الإجمالي ÷ 30) والتفقيط |
| 6 | النماذج والخطابات (V70/V71، تعريف الراتب V117) + المستندات | `js/forms` | ❌ |
| 7 | التقارير + لوحة التحكم + الإعدادات والصلاحيات | `js/reports`, `js/main/05,15,16` | 🟡 |
| 8 | تطبيق الجوال: الحضور، الإجازات، الطلبات، فريقي، المستندات، الإشعارات | `frontend/legacy/employee-portal` | 🟡 الأساس جاهز |
| 9 | نقل البيانات من Supabase | — | ❌ |

## الأسئلة المفتوحة
القسم 9 في `ARIBA_HR_System_Documentation.md` (35 سؤال لموظف الموارد البشرية).
