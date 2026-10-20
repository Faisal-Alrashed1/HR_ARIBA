# Business Rules — قواعد العمل

> English first, then the full Arabic version (same content).

---

# English

## Business rules

Every calculation, with its formula and a worked example. Rules come from the V114 prototype code
(latest patch wins) plus the decisions recorded below. **Status** says whether the backend implements it yet.

All amounts are `Decimal`, rounded half-up to 2 places at the end of each formula.

### Decisions
| Topic | Decision | Prototype had |
|---|---|---|
| EOS base | **basic + housing**, everywhere | basic + housing on payroll/EOS page; full total in the settlement |
| Service years | **actual calendar days ÷ 365** | 365.25 in one place, years + months/12 + days/360 in another |
| Saudization | **Saudis ÷ current employees × 100**, count-based | same |
| Approval stages | per request type, stored in `workflow_rules` (see Workflow) | decided on the server, not visible |

### Calendar — ✅ implemented (`core/scheduling.py`)
- Time zone Asia/Riyadh. Workweek **Sunday–Thursday**; Friday and Saturday off.
- Official holidays (`holidays` table) are excluded from leave days and from leave accrual. Recurring ones
  (National Day 23 Sep, Founding Day 22 Feb) repeat yearly; the two Eids are entered per year (Hijri).
- `workdays_between(a, b, holidays)` counts both ends.

**Example.** 2026 has 261 Sun–Thu days. Seeded holidays that fall on workdays: Founding Day (Sun 22 Feb),
Eid al-Fitr (Sun 22 and Mon 23 Mar), Eid al-Adha (Tue 26 – Thu 28 May), National Day (Wed 23 Sep) = 7
→ **254 workdays**.

### Contracts — ✅ implemented (`services/contracts.py`)
- Fixed-term: `end = join + duration months`, clamped to the end of the month. Indefinite: no end date.
- Example: join 31 Jan 2026, 12 months → **31 Jan 2027**; 1 month → **28 Feb 2026**.
- This matches the prototype (`addMonthsSafe`), so imported dates don't shift. Some HR teams use
  "join + N months − 1 day" instead: confirm if that is preferred.

### Saudization — ✅ implemented (`services/saudization.py`)
`pct = round(saudis × 100 ÷ current, 1)`. Current = not terminated, any category.
Example: 2 Saudis of 5 current → **40.0%**; 1 of 3 → **33.3%**.

### Leave — ⏳ next phase (`services/leave.py`)
- Entitlement = contract annual days (default 21).
- **Accrued in a year** = `annual × workdays worked from max(join, 1 Jan) to date ÷ workdays in the whole year`,
  capped at `annual`. Holidays are not workdays.
  Example: 21 days, joined 1 Mar 2026, as of 30 Jun 2026: 83 workdays worked ÷ 254 in 2026 → `21 × 83 / 254` = **6.86 days**.
- **Year ledger**: `close = opening + entitlement + adjustment − used`; `carry = min(10, close)`;
  from 2024 on, `eos_bank += max(0, close − 10)`.
  Example: opening 8, entitlement 21, adjustment 0, used 12 → close **17**, carry **10**, EOS bank **+7**.
- **2024 opening rule**: the 2024 opening is `max(0, close 2023 − 10)`, uncapped
  (the code's `leaveYearClosing(e, 2023) − 10`). ⚠ Confirm before the import: taken literally, the first 10 days
  of the 2023 close are not carried anywhere. E.g. close 2023 = 25 → 2024 opening 15 (not 10 + 15 in the EOS bank).
- HR can override entitlement / used / adjustment / year-end / carry for any year, with a reason (`leave_adjustments`).
- The employee sees: balance to date, projected balance on 31/12, carried-over days, EOS-reserved days.
- An annual-leave request can't exceed the available balance; leave days are counted in workdays excluding holidays.

### GOSI — ⏳ payroll phase (`services/gosi.py`)
Effective-dated rules (`gosi_rules`, seeded):

| From | System | Employee | Employer | Employee 55+ | Employer 55+ |
|---|---|---|---|---|---|
| 2026-01-01 | matching ("new") | 10.75% | 12.75% | 10.50% | 12.50% |
| 2026-01-01 | non-matching ("old") | 9.75% | 11.75% | 9.00% | 11.00% |
| 2027-07-01 | matching | 11.25% | 13.25% | 11.00% | 13.00% |
| 2027-07-01 | non-matching | 10.25% | 12.25% | 9.50% | 11.50% |
| both | non-Saudi | 0% | 2% | 0% | 2% |

- `base = min(45,000 ÷ month days × work days, basic + housing)`; age ≥ 55 uses the 55+ columns.
- Consultants and non-WPS employees: no GOSI.
- Example: Saudi, matching, age 40, basic 12,000 + housing 3,000, 30-day month, 30 work days →
  base `min(45,000, 15,000)` = 15,000 → employee **1,612.50**, employer **1,912.50**.

### Payroll row — ⏳ payroll phase (`services/payroll.py`)
```
total          = basic + housing + transport + project + other
salary_by_days = total ÷ month_days × work_days
due            = salary_by_days + overtime + leave_compensation + other_allowances
deductions     = gosi_employee + loan/advance + other_deductions
net            = due − deductions;   net_sar = net × exchange_rate
```
Employer GOSI is shown separately. Excluded from the run: terminated, hourly, external consultants,
"exclude from payroll". Approving a run makes it immutable. The employee app shows only the last approved run.
**Editing work days recalculates GOSI** (the prototype didn't).

Example: basic 12,000, housing 3,000, transport 1,000 → total 16,000. 30-day month, 20 work days →
salary by days **10,666.67**. GOSI employee 1,612.50 (cap `45,000 ÷ 30 × 20` = 30,000 > 15,000), loan 500 →
deductions 2,112.50 → net **8,554.17**.

### End of service — ⏳ EOS phase (`services/end_of_service.py`)
Base = basic + housing. Years = days of service ÷ 365.

| Article | Award |
|---|---|
| 84, 74, 74(3) death/disability, 74(4) retirement | `e84 = base/2 × min(y, 5) + base × max(0, y − 5)` |
| 85, 75 (resignation) | `< 2 y`: 0 · `2–5`: ⅓ e84 · `5–10`: ⅔ e84 · `≥ 10`: full e84 |
| 77 | `e84 + max(2 × base, base/30 × 15 × y)` |
| 80, 53 (probation) | 0 |

Example: base 15,000; joined 1 Jan 2019, last day 1 Jul 2026 → 2,738 days ÷ 365 = **7.5014 years**.
Art. 84 → `7,500 × 5 + 15,000 × 2.5014` = **75,020.55**. Art. 85 → ⅔ = **50,013.70**.
Art. 77 → 75,020.55 + `max(30,000, 500 × 15 × 7.5014 = 56,260.27)` = **131,280.82**.

#### Settlement
```
total = EOS
      + leave compensation   (salary ÷ 30 × remaining days; remaining = years × annual days − taken)
      − excess-leave deduction
      + final period salary  (salary ÷ month days × attended days)
      ± extra items          (amount, or days × daily rate)
```
Example (salary = basic 12,000, 14 remaining days): leave compensation = 12,000 ÷ 30 × 14 = **5,600.00**.

### Alerts — ⏳ (`services/alerts.py`)
Iqama, passport, medical insurance and fixed-term contract expiring within **90 days**; **≤ 30 days** is urgent
(red); past expiry shows **منتهي**. The employee API already returns `expiry_days` per document.

### Attendance — ⏳ (`services/attendance.py`, `services/geofence.py`)
- Late if check-in > work start + tolerance. The prototype's late minutes = `check-in − (work start + tolerance)`;
  e.g. start 08:00, tolerance 15, check-in 08:20 → **5** late minutes. ⚠ Confirm whether late minutes
  should count from 08:00 (20) instead.
- Geofence checked **on the server**: haversine distance ≤ location radius (default 200 m, 50–5,000 m).
- Remote check-in counts against the yearly remote limit (default 10 days).
- Flexible hours: expected leave = check-in + shift hours (window 08:00–17:00, 8 h by default).
- "Forgot punch" goes through the request workflow.

### Workflow — ⏳ (`services/workflow.py`)
Stages come from `workflow_rules` (seeded, editable later):

| Request types | Stages |
|---|---|
| annual, sick, emergency, death, marriage, maternity, paternity, umrah, hajj, remote, advance | manager → HR → CEO |
| permission, maternity permission, early leave, overtime, mission | manager → HR |
| forgot punch | HR |

Rejection needs a reason. HR may approve on behalf of the manager (override with a reason) and can give the
final approval. Every step is kept in `request_steps`.

### Open questions from the prototypes (to settle in their phases)
1. **2024 leave opening rule**: where do the first 10 days of the 2023 close go? (see Leave)
2. **Late minutes**: from work start, or from work start + tolerance (see Attendance)?
3. **Settlement leave compensation base**: the prototype uses basic ÷ 30. Should it be basic + housing ÷ 30
   to match the EOS base?
4. **Payroll total vs. "extra allowance"**: the prototype leaves `extraAllowance` out of the payroll total but
   includes it on the employee screen. The new model has only `other_allowances` (in the total).
5. **An 8th template**, `contract_end` (إشعار انتهاء عقد العمل), exists in the HR file but not in the brief's 7.
6. **Company name** differs: settings say "شركة اريبا لخدمات الأعمال", the V114 templates say
   "شركة حلول أريبا لخدمات الأعمال", the brief says "أريبا للاستشارات" (used as the seed default).
7. **GOSI for non-WPS Saudis**: the prototype returns 0 for every non-`wps` WPS type. Confirm that's intended.

---

# العربي

## قواعد العمل

كل عملية حسابية، مع معادلتها ومثال محلول. القواعد مأخوذة من كود النموذج الأولي V114
(آخر تعديل هو المعتمد) إضافة إلى القرارات المسجلة أدناه. يوضح **الحالة** ما إذا كانت الخلفية تنفذها بعد.

جميع المبالغ من النوع `Decimal`، وتُقرَّب نصف للأعلى (half-up) إلى منزلتين عشريتين في نهاية كل معادلة.

### القرارات
| الموضوع | القرار | ما كان في النموذج الأولي |
|---|---|---|
| أساس مكافأة نهاية الخدمة | **الأساسي + السكن**، في كل مكان | الأساسي + السكن في صفحة الرواتب/نهاية الخدمة؛ والإجمالي الكامل في المخالصة |
| سنوات الخدمة | **عدد الأيام الفعلية ÷ 365** | 365.25 في موضع، وسنوات + أشهر/12 + أيام/360 في موضع آخر |
| السعودة | **السعوديون ÷ الموظفون الحاليون × 100**، بالعدد | نفسه |
| مراحل الاعتماد | لكل نوع طلب، مخزنة في `workflow_rules` (انظر سير العمل) | تُحدَّد على الخادم، وغير ظاهرة |

### التقويم — ✅ منفَّذ (`core/scheduling.py`)
- المنطقة الزمنية Asia/Riyadh. أسبوع العمل **الأحد–الخميس**؛ والجمعة والسبت عطلة.
- العطل الرسمية (جدول `holidays`) مستثناة من أيام الإجازة ومن استحقاق الإجازة. العطل المتكررة
  (اليوم الوطني 23 سبتمبر، يوم التأسيس 22 فبراير) تتكرر سنويًا؛ والعيدان يُدخلان لكل سنة (هجري).
- `workdays_between(a, b, holidays)` يحسب الطرفين كليهما.

**مثال.** في 2026 يوجد 261 يومًا من الأحد إلى الخميس. العطل المُدخلة مسبقًا التي تقع في أيام عمل: يوم التأسيس (الأحد 22 فبراير)،
عيد الفطر (الأحد 22 والاثنين 23 مارس)، عيد الأضحى (الثلاثاء 26 – الخميس 28 مايو)، اليوم الوطني (الأربعاء 23 سبتمبر) = 7
← **254 يوم عمل**.

### العقود — ✅ منفَّذ (`services/contracts.py`)
- محدد المدة: `end = join + duration months`، مع قصره على نهاية الشهر. غير محدد المدة: بلا تاريخ انتهاء.
- مثال: المباشرة 31 يناير 2026، 12 شهرًا ← **31 يناير 2027**؛ شهر واحد ← **28 فبراير 2026**.
- هذا يطابق النموذج الأولي (`addMonthsSafe`)، فلا تنزاح التواريخ المستوردة. بعض فرق الموارد البشرية تستخدم
  "المباشرة + N شهر − يوم واحد" بدلًا من ذلك: يُرجى التأكيد إن كان ذلك هو المفضل.

### السعودة — ✅ منفَّذ (`services/saudization.py`)
`pct = round(saudis × 100 ÷ current, 1)`. الحاليون = غير المنتهية خدمتهم، من أي فئة.
مثال: سعوديان من 5 حاليين ← **40.0%**؛ 1 من 3 ← **33.3%**.

### الإجازات — ⏳ المرحلة التالية (`services/leave.py`)
- الاستحقاق = أيام الإجازة السنوية في العقد (الافتراضي 21).
- **المستحق خلال السنة** = `annual × workdays worked from max(join, 1 Jan) to date ÷ workdays in the whole year`،
  بحد أقصى `annual`. العطل ليست أيام عمل.
  مثال: 21 يومًا، مباشرة 1 مارس 2026، حتى 30 يونيو 2026: 83 يوم عمل ÷ 254 في 2026 ← `21 × 83 / 254` = **6.86 يوم**.
- **دفتر السنة**: `close = opening + entitlement + adjustment − used`؛ `carry = min(10, close)`؛
  ومن 2024 فصاعدًا، `eos_bank += max(0, close − 10)`.
  مثال: الافتتاحي 8، الاستحقاق 21، التسوية 0، المستخدم 12 ← الختامي **17**، المرحَّل **10**، رصيد نهاية الخدمة **+7**.
- **قاعدة افتتاح 2024**: رصيد 2024 الافتتاحي هو `max(0, close 2023 − 10)`، بلا حد أقصى
  (في الكود `leaveYearClosing(e, 2023) − 10`). ⚠ يُرجى التأكيد قبل الاستيراد: بأخذها حرفيًا، فإن أول 10 أيام
  من رصيد 2023 الختامي لا تُرحَّل إلى أي مكان. مثلًا الختامي 2023 = 25 ← افتتاحي 2024 = 15 (وليس 10 + 15 في رصيد نهاية الخدمة).
- يمكن للموارد البشرية تعديل الاستحقاق / المستخدم / التسوية / رصيد نهاية السنة / المرحَّل لأي سنة، مع ذكر السبب (`leave_adjustments`).
- يرى الموظف: الرصيد حتى تاريخه، والرصيد المتوقع في 31/12، والأيام المرحَّلة، والأيام المحجوزة لنهاية الخدمة.
- لا يمكن أن يتجاوز طلب الإجازة السنوية الرصيد المتاح؛ وتُحسب أيام الإجازة بأيام العمل باستثناء العطل.

### التأمينات الاجتماعية (GOSI) — ⏳ مرحلة الرواتب (`services/gosi.py`)
قواعد ذات تاريخ سريان (`gosi_rules`، مُدخلة مسبقًا):

| من | النظام | الموظف | صاحب العمل | الموظف 55+ | صاحب العمل 55+ |
|---|---|---|---|---|---|
| 2026-01-01 | المطابق ("الجديد") | 10.75% | 12.75% | 10.50% | 12.50% |
| 2026-01-01 | غير المطابق ("القديم") | 9.75% | 11.75% | 9.00% | 11.00% |
| 2027-07-01 | المطابق | 11.25% | 13.25% | 11.00% | 13.00% |
| 2027-07-01 | غير المطابق | 10.25% | 12.25% | 9.50% | 11.50% |
| كلاهما | غير السعودي | 0% | 2% | 0% | 2% |

- `base = min(45,000 ÷ month days × work days, basic + housing)`؛ العمر ≥ 55 يستخدم أعمدة 55+.
- المستشارون والموظفون خارج نظام حماية الأجور (non-WPS): بلا تأمينات.
- مثال: سعودي، نظام مطابق، العمر 40، أساسي 12,000 + سكن 3,000، شهر 30 يومًا، 30 يوم عمل ←
  الأساس `min(45,000, 15,000)` = 15,000 ← الموظف **1,612.50**، صاحب العمل **1,912.50**.

### صف الرواتب — ⏳ مرحلة الرواتب (`services/payroll.py`)
```
total          = basic + housing + transport + project + other
salary_by_days = total ÷ month_days × work_days
due            = salary_by_days + overtime + leave_compensation + other_allowances
deductions     = gosi_employee + loan/advance + other_deductions
net            = due − deductions;   net_sar = net × exchange_rate
```
تُعرض تأمينات صاحب العمل منفصلة. المستبعدون من المسيّر: المنتهية خدمتهم، أصحاب الأجر بالساعة، المستشارون الخارجيون،
و"المستبعد من الرواتب". اعتماد المسيّر يجعله غير قابل للتعديل. يعرض تطبيق الموظف آخر مسيّر معتمد فقط.
**تعديل أيام العمل يعيد حساب التأمينات** (النموذج الأولي لم يكن يفعل ذلك).

مثال: أساسي 12,000، سكن 3,000، نقل 1,000 ← الإجمالي 16,000. شهر 30 يومًا، 20 يوم عمل ←
الراتب حسب الأيام **10,666.67**. تأمينات الموظف 1,612.50 (الحد `45,000 ÷ 30 × 20` = 30,000 > 15,000)، قرض 500 ←
الاستقطاعات 2,112.50 ← الصافي **8,554.17**.

### نهاية الخدمة — ⏳ مرحلة نهاية الخدمة (`services/end_of_service.py`)
الأساس = الأساسي + السكن. السنوات = أيام الخدمة ÷ 365.

| المادة | المكافأة |
|---|---|
| 84، 74، 74(3) الوفاة/العجز، 74(4) التقاعد | `e84 = base/2 × min(y, 5) + base × max(0, y − 5)` |
| 85، 75 (الاستقالة) | `< 2 y`: 0 · `2–5`: ⅓ e84 · `5–10`: ⅔ e84 · `≥ 10`: e84 كاملة |
| 77 | `e84 + max(2 × base, base/30 × 15 × y)` |
| 80، 53 (التجربة) | 0 |

مثال: الأساس 15,000؛ المباشرة 1 يناير 2019، آخر يوم 1 يوليو 2026 ← 2,738 يومًا ÷ 365 = **7.5014 سنة**.
المادة 84 ← `7,500 × 5 + 15,000 × 2.5014` = **75,020.55**. المادة 85 ← ⅔ = **50,013.70**.
المادة 77 ← 75,020.55 + `max(30,000, 500 × 15 × 7.5014 = 56,260.27)` = **131,280.82**.

#### المخالصة
```
total = EOS
      + leave compensation   (salary ÷ 30 × remaining days; remaining = years × annual days − taken)
      − excess-leave deduction
      + final period salary  (salary ÷ month days × attended days)
      ± extra items          (amount, or days × daily rate)
```
مثال (الراتب = أساسي 12,000، 14 يومًا متبقية): تعويض الإجازة = 12,000 ÷ 30 × 14 = **5,600.00**.

### التنبيهات — ⏳ (`services/alerts.py`)
الإقامة والجواز والتأمين الطبي والعقد محدد المدة التي تنتهي خلال **90 يومًا**؛ و**≤ 30 يومًا** عاجل
(أحمر)؛ وما تجاوز تاريخ انتهائه يظهر **منتهي**. تُرجع واجهة الموظف بالفعل `expiry_days` لكل مستند.

### الحضور — ⏳ (`services/attendance.py`، `services/geofence.py`)
- متأخر إذا كان تسجيل الحضور > بداية العمل + فترة السماح. دقائق التأخير في النموذج الأولي = `check-in − (work start + tolerance)`؛
  مثلًا البداية 08:00، السماح 15، الحضور 08:20 ← **5** دقائق تأخير. ⚠ يُرجى التأكيد إن كان يجب احتساب دقائق التأخير
  من 08:00 (20) بدلًا من ذلك.
- يُفحص السياج الجغرافي **على الخادم**: مسافة haversine ≤ نصف قطر الموقع (الافتراضي 200 م، 50–5,000 م).
- تسجيل الحضور عن بُعد يُحتسب من الحد السنوي للعمل عن بُعد (الافتراضي 10 أيام).
- الساعات المرنة: الانصراف المتوقع = الحضور + ساعات الوردية (النافذة 08:00–17:00، 8 ساعات افتراضيًا).
- "نسيان البصمة" يمر عبر سير عمل الطلبات.

### سير العمل — ⏳ (`services/workflow.py`)
تأتي المراحل من `workflow_rules` (مُدخلة مسبقًا، قابلة للتعديل لاحقًا):

| أنواع الطلبات | المراحل |
|---|---|
| سنوية، مرضية، اضطرارية، وفاة، زواج، أمومة، أبوة، عمرة، حج، عن بُعد، سلفة | المدير ← الموارد البشرية ← الرئيس التنفيذي |
| استئذان، استئذان أمومة، خروج مبكر، عمل إضافي، مهمة عمل | المدير ← الموارد البشرية |
| نسيان البصمة | الموارد البشرية |

الرفض يتطلب سببًا. يجوز للموارد البشرية الاعتماد نيابة عن المدير (تجاوز مع ذكر السبب) ويمكنها إعطاء
الاعتماد النهائي. تُحفظ كل خطوة في `request_steps`.

### أسئلة مفتوحة من النماذج الأولية (تُحسم في مراحلها)
1. **قاعدة افتتاح إجازات 2024**: أين تذهب أول 10 أيام من رصيد 2023 الختامي؟ (انظر الإجازات)
2. **دقائق التأخير**: من بداية العمل، أم من بداية العمل + فترة السماح (انظر الحضور)؟
3. **أساس تعويض الإجازة في المخالصة**: يستخدم النموذج الأولي الأساسي ÷ 30. هل يجب أن يكون (الأساسي + السكن) ÷ 30
   ليطابق أساس مكافأة نهاية الخدمة؟
4. **إجمالي الرواتب مقابل "البدل الإضافي"**: يستبعد النموذج الأولي `extraAllowance` من إجمالي الرواتب لكنه
   يضمّنه في شاشة الموظف. النموذج الجديد فيه `other_allowances` فقط (ضمن الإجمالي).
5. **قالب ثامن**، `contract_end` (إشعار انتهاء عقد العمل)، موجود في ملف الموارد البشرية لكنه ليس ضمن القوالب السبعة في الموجز.
6. **اسم الشركة** مختلف: الإعدادات تقول "شركة اريبا لخدمات الأعمال"، وقوالب V114 تقول
   "شركة حلول أريبا لخدمات الأعمال"، والموجز يقول "أريبا للاستشارات" (المستخدم كقيمة افتراضية أولية).
7. **التأمينات للسعوديين خارج نظام حماية الأجور**: يُرجع النموذج الأولي 0 لكل نوع WPS غير `wps`. يُرجى تأكيد أن هذا مقصود.
