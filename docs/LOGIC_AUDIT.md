# Logic and Formula Audit — تدقيق المنطق والمعادلات

> English first, then the full Arabic version (same content).

---

# English

## Logic and formula audit — the old system (split HTML) vs. the website, the app and the server

> Date: 2026-10-11 · Reference: `frontend/legacy/` (the files after splitting) + the latest Supabase server functions (from `~/Downloads/supabase_full.sql`).
> Data: a copy of the real production data (107 employees, 23 active) in a temporary local database.

### Implementation status (2026-10-11, not deployed yet)
- ✅ ❌1 End-of-service report (84/84), ❌5 contract end, ❌6 returning the employee to active.
- ✅ ❌7 and ❌8 attendance punch (polygon, and "عن بعد" ("remote")), and ⚠️ lateness by the minute, and a fix for grace period = 0 (it used to turn into 15).
- ✅ ❌2, ❌3 and ❌4 the dashboard, the Saudization ratio, and the contract alert.
- ✅ ⚠️ Social insurance by `kindOf` (428/428).
- ✅ The app balance matches `ariba_leave_calc`: year end deducts approved leave after the snapshot, and "الحالي" ("current") deducts leave that has started in full (23/23 real, and 60 test employees on 4 dates). The balances page on the website stays on the HTML logic.
  - The "current" difference of 103/107 on the website came from the checking tool (linking the leave to a different id), not from the logic.
- ✅ ❌10 Notify HR of every new request, and notify an employee without a manager that their request went to HR.
- ✅ The checks became permanent tests: `backend/tests_canonical/test_legacy_parity.py` and `tools/legacy-parity` (details in `PROJECT_GUIDE.md` section 9).
- ✅ ❌9 Approval stages: all types manager ← HR ← CEO like the old system, and notification texts like it (compared step by step with `ariba_workflow_action`).
- ✅ ❌11 Balance check: **kept** by the project owner's decision (intentionally different from the old system).
- ✅ Notes A–J (implementation decision: we correct per the law, and the corrections are documented in `tools/legacy-parity/run.js` → `CORRECTIONS`):
  - A Art. 85: exactly 5 years = one third, and 10 = full (the page, the payroll, the settlement and the server).
  - B The end-of-service page base = the actual wage (basic + fixed allowances).
  - C Art. 77 for a fixed-term contract = the wage for the remaining term (at least two months).
  - D Added Art. 87 (full award).
  - E/F A legal alert to HR on sick leave, special leaves and Hajj (without rejection).
  - G Payroll social insurance on the actual housing.
  - H No change (the law does not specify the divisor).
  - I An alert when the current/next year's Eid holidays are not recorded.
  - J The post-5-years balance for contracts with more than 21 days.
- ✅ Approval on behalf/final approval, applying a forgotten punch, and an employee deleting a request: match the old functions (tests).
- ✅ V117 attendance reports match (40/40), and the payroll report recalculates the net like the old system.

### Method of checking
- **We did not settle for reading:** we ran the old HR portal **in full** in a virtual browser (jsdom). We loaded 141 JS files **in the same load order**, so every function was in its final version after all the patches, together with the real employee data.
- **The comparison:** the result of each old function was compared **number by number** with:
  - **The website:** `frontend/hr-web/src/lib/calc/*`, after converting it to JS and running it side by side.
  - **The server:** `backend/app/...`.
  - **The app:** the `/me/*` endpoints in the server.
- **Old server functions:** such as `ariba_leave_calc`, **we loaded them into a local Postgres and actually ran them**. The punch function `ariba_attendance` and the approvals we read line by line.
- **CSS files** (41 files): styling only, no formulas in them.
- **HTML files** (2): page skeletons.
- **Checking tools:** in the scratchpad folder (outside the repo).

---

### 1. ✅ 100% match
| Unit | Where it is used | Check result |
|---|---|---|
| PAYX payroll engine (V119) | Payroll page, payslip, archive | **20,000/20,000** random cases identical in all columns (gross, housing, transport, overtime, leave allowance, end of service, social insurance, net…) |
| Final settlement `sRun` | Settlement page and its document | **3,000/3,000** |
| End of service by article (`calcByLaw`) | End-of-service page | Website **840/840** |
| Tafqeet (amount in words) | Settlement document | **3,032/3,032** |
| Working days for leave (Sunday–Thursday − holidays) | Leave request, balances | Website **4,000/4,000** · Server **4,000/4,000** |
| Default public holidays | All calculations | The same four (Fitr 4, Adha 4, National Day 1, Founding Day 1) |
| Default social insurance rates | All calculations | The same table (2026-01-01 and 2027-07-01), cap 45,000, and age 55 |
| Year-end balance and end-of-service days (balances engine) | Balances page | **107/107** |
| App current and carried-over balance (vs. the server's `ariba_leave_calc`) | Employee app | **23/23** |
| Number of alerts (iqama, passport, insurance, contract ≤ 90 days) | Dashboard | 14 = 14 |
| Net and social insurance stored on save (`sEmp`) | Employee list, reports | 102/107 (the rest have old data) — **after today's undeployed change** |
| Current employees, Saudi and expatriate, and departments | Dashboard | Identical |

### 2. ⚠️ Nearly matching (small differences)
| Unit | Difference | Impact |
|---|---|---|
| Social insurance `calcIns` (server) | 416/428. **Ours exempts** if `empType` = consultant/training, and **the old one does not** (`kindOf` relies only on wpsType, the job title, the department and the work entity) | 3 employees (all terminated). The same rule in the payroll (`exemptKind` and `insDefault`) |
| End of service (server `eos_award`) | 839/840. A one-riyal difference in rounding the Article 77 compensation (Decimal vs. Math.round) | Not used in the screens currently |
| Current leave balance (HR) | 103/107. Active employees (74, 76) off by one day, and terminated employees in "المرحّل" ("carried over") | The cause is an approved annual leave whose days are counted differently |
| Year-end balance in the app (vs. the old server) | 21/23. The same employees: version V115 deducts **future** approved leave | One day |
| Saudization ratio | The old one rounds to an integer (43%), and ours shows 43.5% | Display only |
| Lateness in punching | Old: if the grace period is exceeded by seconds it counts **at least one minute** and rounds. Ours (non-flexible): truncates the fractions so it comes out 0 and treats it as "حاضر" ("present") | Edge cases |
| Contract expiry alert | The old one excludes open-ended contracts, and ours does not | The count came out equal now |

### 3. ❌ Not matching (needs a change)
| # | Unit | Old system | Ours | Impact on real data |
|---|---|---|---|---|
| 1 | **End-of-service award report (terminated employees)** | The amount = the recorded `eosLaborLaw` (accounts for the termination article), and if zero it computes `calcEOS` from the recorded `yearsOfService` | Computes full Article 84 for everyone, from the start date ÷ 365 | **Only 10/84 match. Total 172,456 vs. 460,158** |
| 2 | **Total salaries (dashboard)** | Basic + housing + transport for active employees | `salaryTotal` (includes project and other) | 205,034 vs. 217,360 |
| 3 | **Gender distribution** | The gender field, or a list of female names, and the rest male | The gender field only, and the rest "غير محدد" ("unspecified") | 16/7 vs. 20/2/1 |
| 4 | **Tamheer count** | The job title contains "تمهير" ("Tamheer") | By classification | 2 vs. 0 |
| 5 | **Contract end date calculation** | `sEmp` computes it automatically: start date + term − one day (`addMonthsSafe`) | **Not computed.** It saves whatever it receives, and the field is locked | A new employee or a change of term leaves the end empty or stale, which affects the alert |
| 6 | **Returning the employee to active if the contract is renewed** (V101 `reactivateIfRenewed`) | Exists | Does not exist | — |
| 7 | **Punch: polygon zones** (V140) | Accepts the punch inside the polygon, and picks the smallest area | Circle only, and picks the nearest by coordinates | **There is an actual polygon location in the data** |
| 8 | **Punch: remote work** | A "عن بعد" ("remote") location is accepted only if there is an approved "remote" request for the same day | Treats it as a normal location with coordinates (0,0), so it wrongly rejects or accepts | **There is an actual remote location** |
| 9 | **Approval stages** | All types (except forgotten punch): manager ← HR ← CEO | Permission, overtime and assignment stop at HR (in the code: "مؤكد مع صاحب العمل" ("confirmed with the employer")) | **Needs your decision** |
| 10 | **Notify HR of every new request** (V115) | HR is notified even if the request is with the manager | Notifies only the stage owner | — |
| 11 | **Checking the leave balance on submission** | None, and the days are calendar days from the app | Rejects if it exceeds the balance, and counts working days | Ours is stricter, and the old one is weaker |
| 12 | **Termination reason in the payroll** (`reasonFromEmp`) | From the termination reason text only | Adds a mapping from the termination article (84 ← arb77, 75 ← art81) | An addition of ours |

### 4. ⚖️ Saudi Labor Law notes (present in the old system, and we inherited them because we matched it)
| # | Topic | Status | The law |
|---|---|---|---|
| A | **Resignation (Art. 85)** at the boundaries | End-of-service page: exactly 5 years gets **⅔**. Payroll: exactly 10 years gets **⅔** | One third from two years **up to five** · two thirds from 5 **to less than 10** · full at **10 or more** |
| B | **The end-of-service base is not unified** | End-of-service page = basic + housing · Payroll = the comprehensive wage · Settlement = the gross | Art. 84 is computed on **the last actual wage** (Art. 2: the wage + fixed allowances), so there must be one base |
| C | **Art. 77 compensation** | The greater of (two months, and 15 days per year) | For an **open-ended** contract: 15 days/year. For a **fixed-term** contract: the wage for the remaining term. The minimum is two months. Fixed-term contracts are not handled correctly |
| D | **Special full-award cases** | Not present | **Art. 87**: resignation due to force majeure, or for a woman within 6 months of marriage or 3 of giving birth, is entitled to a full award |
| E | **Sick leave (Art. 117)** | No limits and no deduction | 30 days at full pay, 60 at three quarters, and 30 unpaid per year |
| F | **Maternity / paternity / marriage / bereavement / Hajj (Art. 113, 151, 114)** | Types exist **without limits** | Marriage 5, bereavement 5 (depending on kinship), paternity 3, maternity 12 weeks (per the latest amendment), and Hajj 10–15 once after two years of service. **The limits applied in the company need confirmation** |
| G | **The wage subject to social insurance in the payroll** | Basic + 25% of basic (an assumption) | Subject = basic + **the actual housing allowance** (capped at 45,000). The server uses the actual one, and the payroll uses the assumption |
| H | **Overtime hourly wage** | ÷ actual days in the month (28–31) ÷ 8 | Art. 107 matches the principle (hourly wage + 50% of basic). The common practice is ÷ 30 |
| I | **Public holidays for coming years** | The two Eids are recorded for 2026 only (not recurring) | Eid al-Fitr and Eid al-Adha dates for 2027 must be added, otherwise the Eid days are deducted from the leave balance |
| J | **Leave balance after 5 years** | 105 + (years − 5) × 30, and the number 105 is fixed even if the contract has more than 21 days | Matches Art. 109 for the default contract |

### 5. Proposed priority order
1. **❌1 End-of-service report** and **❌5 contract end calculation**: they affect official numbers and documents.
2. **❌7 and ❌8 the punch** (polygon and remote work): they affect employees today.
3. **❌2, ❌3 and ❌4 the dashboard**: small changes.
4. **⚠️ Social insurance by `empType`** and **⚠️ lateness by the minute**.
5. **Decisions that need you:** ❌9 approval stages, ❌11 balance check, and the legal notes A–J (do we match the old system as is, or correct it per the law?).

### 6. What was not covered by a numeric check
- **The nine reports:** other than the end-of-service report.
- **Form and letter texts.**
- **V117 attendance reports:** session aggregation and day classification.
- **The payslip screen:** relies on the matching payroll rows.
- **Look and colors (CSS).**

These were read or checked earlier, but without an automated number-by-number comparison in this audit.

---

### 9. Porting the React system's formulas (Task 3, 18 October 2026, branch `feature/hr-react-port`)

> The rule (the project owner's decision, `docs/port-context/PORT_PROMPT_AR.md`): every 🟠/🔴 row in the comparison file is changed to match
> their formula exactly, and we do not rely on our previous corrections (A–K in section 4 were cancelled). Proof in numbers: `tools/react-parity`
> (`npm test`): **21 suites, 81,428 cases, zero differences, and 111 rows checked all matching them** (74 of which were different in the comparison file).

#### What changed and why (each row's reason: "their formula")
| Rows | Before (ours) | After (their formula) | Files |
|---|---|---|---|
| 1–30 PAYX | Corrections A/G/J, without noEos and without Egypt | `payx.ts` copied verbatim from `engines/payx.js`: N = 105 + (K−5)×30, resignation ≤5 one third and <10 two thirds, AQ on 25% of basic, noEos, TAX/MF for Egypt | `lib/calc/payx.ts` |
| 32–43 Payroll rows | Our layer (excludes the name "البوصيري" ("Al-Busiri"), insSystem read as matching so a match shows "لا يطابق" ("does not match"), exempt is not exempted) | Their layer `payrollRows.js` verbatim, and the server row is converted to the employee record shape (`toLegacy`); old overtime is migrated to a manual amount; totals include tax/mf | `lib/calc/payroll.ts`, `payroll-rows.ts`, `/salary/basis` (+ `is_hourly`) |
| 44 usedThrough | Without restoring the interrupted annual leave | The leave engine in the server (restoration through sick leave) | `services/leave.py` (commit `8db0266`) |
| 45–56 Social insurance | No rates before 2026 | The automatic table `getInsSettings` + calcIns; an unsaved payslip = `calcFor` for the month (row 55) | `services/gosi.py`, `lib/calc/inscalc.ts`, the payslips page |
| 54, 58 Employee figures | — | `salaryPreview` (31/31) | `services/employee_map.py` |
| 69–77 End-of-service page | A (exactly 5 = one third), B (base = actual wage), C, D | `eosByLaw`: base = basic + housing, `yrs < 5` one third, one Art. 77 for all contracts, without Art. 87, and "مستبعد من نهاية الخدمة" ("excluded from end of service") is excluded | `lib/calc/eos.ts`, the end-of-service page |
| 78–94 Final settlement | A, C, D, `Math.trunc` for inputs | `settle` verbatim: no rounding of inputs (row 91), without Art. 87 and fixed-term Art. 77, and the Egypt settlement | `lib/calc/settlement.ts` |
| 95–120 Leave | Working days only, 2024 carry-over, the excess from 2024 | Their engine with the three methods and the settings `leave_accrual_method` and `leave_carry` (commit `8db0266`) | `services/leave.py` |
| 112–113 App balance | `ariba_leave_calc` | The server computes "الرصيد الحالي" ("current balance") and "رصيد نهاية العام" ("year-end balance") with the same engine (decisions 1 and 4) | `services/leave.py` app_current / app_year_end |
| 125–126 Working hours and Ramadan | — | `services/schedule.py` (Umm al-Qura via `hijridate`, matches `Intl islamic-umalqura` in the browser) + `lib/calc/schedule.ts` | New |
| 135 Expected check-out | From `late_minutes` | `expectedOut`: first check-in + working hours, capped at the end of the window if the first session is "متأخر" ("late"), and with flexible Ramadan hours | `/me/attendance` |
| 136–137 Early leave (flexible) | K: a new check-in resets the previous session's check-out | Each session keeps its own early leave like `ariba_attendance` | `punch` (the reset was removed) |
| 141 Absent | Employees − present − remote − on leave | Employees − (present + late) | The attendance page |
| 142 Remote remaining | The counter only | `remote_left` = `remote_days_per_year` − used (decision 1) | `/me/attendance` |
| 146 Salaries by work entity | `salaryTotal` | Basic + housing + transport, for those whose total > 0 | `/dashboard` |
| 147–148 Alerts | Iqama/passport/medical insurance/contract ≤ 90 | `collectAlerts` V142: iqama 60, passport 90, contract 60 (or start date + term), probation 30 (from −7, within 400 days, not for consultant/Tamheer/trainee), sorted by days | `_dashboard_alerts` |
| 150 Remaining days in reports | `ceil` | `Math.round` | The reports page |
| 187 Session | 8 hours renewing, cap 24 | A one-hour token renewed with activity up to 24 hours from sign-in, and idle (5 + 3 minutes) in the UI | `SESSION_HOURS` |

#### Tests after the change
- `tools/react-parity`: zero differences, and the verdict became "every checked row matches them" (was: "agrees with the comparison file"). The pre-port baseline is saved in `results/BASELINE_2026-10-18.md`.
- `tools/legacy-parity`: the `CORRECTIONS` list (A/G/J) was cancelled because their system kept the old HTML formulas, so the old system is now compared without modification; and the suite "تصحيحات نظام العمل (أُلغيت)" ("Labor Law corrections (cancelled)") proves that our website gives the old/React result in the cases that used to differ (9/9). The Egypt items (TAX/MF/ARB) are the only extras on their side.
- pytest: `tests_canonical/test_port_formulas.py` (alerts, Ramadan, session).

#### 🟠 rows ported along with their screens (Tasks 6–8)
62, 63 and 65 (updated years of service, fixing the net in foreign currency, allowance as a percentage) with syncing the employee record to their shape · 117 the balances editor · 119 and 139 in the app · 158 approval stages (sql/10).

### 10. Deleting what only we had 🟣 (Task 4)

> The deletion is approved by the project owner without exception (except rows 113 and 142 by decision 1, and row 66 by decision 2). Only the **logic** was deleted;
> no file, table or data was deleted (the `ariba_login_attempts` table remains as is and is not read).

| Item | What was deleted | Behavior now (like theirs) | Test |
|---|---|---|---|
| 66 Automatic contract termination/activation | `apply_auto_terminations` (the old services) and `_reactivate_if_renewed` (only returns those terminated "تلقائياً" ("automatically")) | No automatic termination. Saving a terminated employee returns them to active unless their contract is fixed-term and expired (EmpForm.jsx), and a "إعادة تفعيل" ("Reactivate") button exists (`/employees/{id}/reactivate`) | `test_port_removed.py` (4) |
| 70, 82 Art. 87 (D) | The Art. 87 option from the end-of-service page, the settlement and the payroll | Does not exist | legacy-parity "أُلغيت" ("cancelled") + react-parity eos/settle/payx |
| 72 Art. 77 for a fixed-term contract (C) | The "نهاية العقد المحدد" ("fixed-term contract end") field in the settlement and the contract months in the end-of-service page | One Art. 77 for all contracts | Same as above |
| A Art. 85 at 5 and 10 years | The `<=` condition in the page, the settlement, the payroll and `eos_award` in the server | Exactly 5 = two thirds, exactly 10 = two thirds in the payroll | legacy-parity + `test_port_removed.py` |
| B Page base = the actual wage | Other allowances from the base | Basic + housing | react-parity eos |
| G Payroll social insurance on the actual housing | `Q*houRate` | 25% of basic | legacy-parity + react-parity payx |
| J Post-5-years balance | `5*M+…` | 105 + (K−5)×30 | Same as above |
| 100 2024 carry-over | The special rule (2023 closing − 10) — deleted with the engine port (`8db0266`) | The normal cap | `test_carry_into_2024_is_the_normal_cap` |
| 114 Freezing a terminated employee's balance | — (with the engine port) | Computed like everyone else | `test_terminated_employee_balance_is_not_frozen` |
| 137 (K) Resetting the previous session's check-out | `UPDATE … early_minutes=0` on a new check-in | Each session keeps its early leave | `test_second_check_in_keeps_…` |
| 153 (E/F) Labor Law alert on requests | `_law_note` in the server and its display in the website and the app | No alert | `test_requests_carry_no_law_note` |
| I Missing holidays alert | The alert in the public holidays tab | No alert | UI only |
| 188 Sign-in lockout after failed attempts | Counting attempts and 429 | A failed attempt = always 401 (logged in the audit log only) | `test_failed_sign_ins_never_lock_the_account` |
| 113, 142 | **Not deleted** (decision 1) | "رصيد نهاية العام" ("year-end balance") and "عن بعد المتبقي" ("remote remaining") like Home.jsx | Section 9 |

---

# العربي

## تدقيق المنطق والمعادلات — النظام القديم (HTML المقسّم) مقابل الموقع والتطبيق والخادم

> التاريخ: 2026-10-11 · المرجع: `frontend/legacy/` (الملفات بعد التقسيم) + دوال خادم Supabase الأخيرة (من `~/Downloads/supabase_full.sql`).
> البيانات: نسخة الإنتاج الحقيقية (107 موظف، 23 نشط) في قاعدة محلية مؤقتة.

### حالة التنفيذ (2026-10-11، غير منشور بعد)
- ✅ ❌1 تقرير نهاية الخدمة (84/84)، ❌5 نهاية العقد، ❌6 إرجاع الموظف نشط.
- ✅ ❌7 و❌8 البصمة (المضلّع، و«عن بعد»)، و⚠️ التأخير بالدقيقة، وإصلاح وقت سماح = 0 (كان يتحوّل لـ 15).
- ✅ ❌2 و❌3 و❌4 لوحة التحكم، ونسبة السعودة، وتنبيه العقد.
- ✅ ⚠️ التأمينات حسب `kindOf` (428/428).
- ✅ رصيد التطبيق مطابق لـ `ariba_leave_calc`: نهاية السنة تخصم الإجازة المعتمدة بعد اللقطة، و«الحالي» يخصم الإجازة اللي بدأت كاملة (23/23 حقيقي، و60 موظف تجريبي على 4 تواريخ). صفحة الأرصدة في الموقع باقية على منطق الـ HTML.
  - فرق «الحالي» 103/107 في الموقع كان من أداة الفحص (ربط الإجازة بـ id مختلف)، مو من المنطق.
- ✅ ❌10 إشعار HR بكل طلب جديد، وإشعار الموظف بدون مدير إن طلبه راح لـ HR.
- ✅ الفحوصات صارت اختبارات دائمة: `backend/tests_canonical/test_legacy_parity.py` و `tools/legacy-parity` (التفاصيل في `PROJECT_GUIDE.md` القسم 9).
- ✅ ❌9 مراحل الموافقة: كل الأنواع مدير ← HR ← رئيس تنفيذي مثل القديم، ونصوص الإشعارات مثله (مقارنة خطوة بخطوة مع `ariba_workflow_action`).
- ✅ ❌11 التحقق من الرصيد: **باقي** بقرار صاحب المشروع (مختلف عن القديم عمداً).
- ✅ الملاحظات A–J (قرار التنفيذ: نصحّح حسب النظام، والتصحيحات موثّقة في `tools/legacy-parity/run.js` → `CORRECTIONS`):
  - A م.85: 5 سنوات بالضبط = الثلث، و10 = كاملة (الصفحة والمسير والمخالصة والخادم).
  - B وعاء صفحة نهاية الخدمة = الأجر الفعلي (الأساسي + البدلات الثابتة).
  - C م.77 للعقد المحدد = أجر المدة الباقية (شهرين على الأقل).
  - D إضافة م.87 (مكافأة كاملة).
  - E/F تنبيه نظامي لـ HR على المرضية والإجازات الخاصة والحج (بدون رفض).
  - G تأمينات المسير على السكن الفعلي.
  - H بدون تغيير (النظام ما يحدد المقسوم عليه).
  - I تنبيه لما أعياد السنة الحالية/الجاية غير مسجّلة.
  - J رصيد ما بعد 5 سنوات للعقود أكثر من 21 يوم.
- ✅ الاعتماد نيابة/النهائي، وتطبيق نسيان البصمة، وحذف الموظف للطلب: مطابقة للدوال القديمة (اختبارات).
- ✅ تقارير الحضور V117 مطابقة (40/40)، وتقرير الرواتب يعيد حساب الصافي مثل القديم.

### طريقة الفحص
- **ما اكتفينا بالقراءة:** شغّلنا بوابة HR القديمة **كاملة** في متصفح افتراضي (jsdom). حمّلنا 141 ملف JS **بنفس ترتيب التحميل**، فصارت كل الدوال بنسختها النهائية بعد كل الـ patches، ومعها بيانات الموظفين الحقيقية.
- **المقارنة:** نتيجة كل دالة قديمة قارناها **رقم برقم** مع:
  - **الموقع:** `frontend/hr-web/src/lib/calc/*`، بعد تحويلها لـ JS وتشغيلها جنبها.
  - **الخادم:** `backend/app/...`.
  - **التطبيق:** نقاط `/me/*` في الخادم.
- **دوال الخادم القديمة:** مثل `ariba_leave_calc`، **حمّلناها في Postgres محلي وشغّلناها فعلياً**. ودالة البصمة `ariba_attendance` والموافقات قرأناها سطر بسطر.
- **ملفات CSS** (41 ملف): تنسيق بس، ما فيها معادلات.
- **ملفات HTML** (2): هياكل الصفحات.
- **أدوات الفحص:** في مجلد scratchpad (خارج الريبو).

---

### 1. ✅ مطابق 100%
| الوحدة | وين تُستخدم | نتيجة الفحص |
|---|---|---|
| محرك المسير PAYX (V119) | صفحة المسير، القسيمة، الأرشيف | **20,000/20,000** حالة عشوائية متطابقة في كل الأعمدة (الإجمالي، والسكن، والنقل، والإضافي، وبدل الإجازة، ونهاية الخدمة، والتأمينات، والصافي…) |
| المخالصة `sRun` | صفحة المخالصة ومستندها | **3,000/3,000** |
| نهاية الخدمة حسب المادة (`calcByLaw`) | صفحة نهاية الخدمة | الموقع **840/840** |
| التفقيط (المبلغ بالحروف) | مستند المخالصة | **3,032/3,032** |
| أيام العمل للإجازة (الأحد–الخميس − العطل) | طلب الإجازة، الأرصدة | الموقع **4,000/4,000** · الخادم **4,000/4,000** |
| العطل الرسمية الافتراضية | كل الحسابات | نفس الأربع (فطر 4، أضحى 4، يوم وطني 1، تأسيس 1) |
| نسب التأمينات الافتراضية | كل الحسابات | نفس الجدول (2026-01-01 و 2027-07-01)، وسقف 45,000، وعمر 55 |
| رصيد نهاية السنة وأيام نهاية الخدمة (محرك الأرصدة) | صفحة الأرصدة | **107/107** |
| رصيد التطبيق الحالي والمرحّل (مقابل `ariba_leave_calc` الخادم) | تطبيق الموظف | **23/23** |
| عدد التنبيهات (إقامة، جواز، تأمين، عقد ≤ 90 يوم) | لوحة التحكم | 14 = 14 |
| الصافي والتأمينات المخزّنة عند الحفظ (`sEmp`) | قائمة الموظفين، التقارير | 102/107 (الباقي بيانات قديمة عندهم) — **بعد تعديل اليوم غير المنشور** |
| الحاليون، والسعودي والوافد، والأقسام | لوحة التحكم | متطابقة |

### 2. ⚠️ مطابق تقريباً (فروق صغيرة)
| الوحدة | الفرق | التأثير |
|---|---|---|
| التأمينات `calcIns` (الخادم) | 416/428. **حقنا يعفي** لو `empType` = consultant/training، و**القديم ما يعفي** (`kindOf` يعتمد على wpsType والمسمى والقسم وجهة العمل بس) | 3 موظفين (كلهم منتهية خدماتهم). نفس القاعدة في المسير (`exemptKind` و `insDefault`) |
| نهاية الخدمة (الخادم `eos_award`) | 839/840. فرق ريال في تقريب تعويض المادة 77 (Decimal مقابل Math.round) | ما يُستخدم في الشاشات حالياً |
| رصيد الإجازة الحالي (HR) | 103/107. موظفين نشطين (74، 76) بفرق يوم، وموظفين منتهية خدمتهم في «المرحّل» | السبب إجازة سنوية معتمدة تُحسب أيامها بطريقة مختلفة |
| رصيد نهاية السنة في التطبيق (مقابل الخادم القديم) | 21/23. نفس الموظفين: النسخة V115 تخصم الإجازة المعتمدة **المستقبلية** | يوم واحد |
| نسبة السعودة | القديم يقرّب لرقم صحيح (43%)، وحقنا يعرض 43.5% | عرض بس |
| التأخير في البصمة | القديم: لو تجاوز وقت السماح بثواني يحسب **دقيقة على الأقل** ويقرّب. حقنا (غير المرن): يقطع الكسور فيطلع 0 ويعتبره «حاضر» | حالات حدّية |
| تنبيه انتهاء العقد | القديم يستثني العقود غير محددة المدة، وحقنا ما يستثنيها | العدد طلع متساوي الحين |

### 3. ❌ غير مطابق (يحتاج تعديل)
| # | الوحدة | النظام القديم | حقنا | التأثير على البيانات الحقيقية |
|---|---|---|---|---|
| 1 | **تقرير مكافأة نهاية الخدمة (المنتهية خدماتهم)** | المبلغ = `eosLaborLaw` المسجّل (يراعي مادة الإنهاء)، ولو صفر يحسب `calcEOS` من `yearsOfService` المسجلة | يحسب المادة 84 كاملة للكل، من تاريخ المباشرة ÷ 365 | **10/84 بس متطابقة. المجموع 172,456 مقابل 460,158** |
| 2 | **إجمالي الرواتب (لوحة التحكم)** | الأساسي + السكن + النقل للنشطين | `salaryTotal` (فيه المشروع وأخرى) | 205,034 مقابل 217,360 |
| 3 | **توزيع الجنس** | حقل الجنس، أو قائمة أسماء نسائية، والباقي ذكور | حقل الجنس بس، والباقي «غير محدد» | 16/7 مقابل 20/2/1 |
| 4 | **عدد التمهير** | المسمى فيه «تمهير» | حسب التصنيف | 2 مقابل 0 |
| 5 | **حساب تاريخ نهاية العقد** | `sEmp` يحسبه تلقائياً: المباشرة + المدة − يوم (`addMonthsSafe`) | **ما يُحسب.** يحفظ اللي يوصله، والخانة مقفلة | الموظف الجديد أو تعديل المدة يخلي النهاية فاضية أو قديمة، فيتأثر التنبيه |
| 6 | **إرجاع الموظف نشط لو تجدد عقده** (V101 `reactivateIfRenewed`) | موجود | غير موجود | — |
| 7 | **البصمة: المناطق المضلّعة** (V140) | يقبل البصمة داخل المضلع، ويختار الأصغر مساحة | دائرة بس، ويختار الأقرب بالإحداثيات | **فيه موقع مضلّع فعلي في البيانات** |
| 8 | **البصمة: العمل عن بعد** | موقع «عن بعد» يُقبل بس لو فيه طلب «عن بعد» معتمد لنفس اليوم | يتعامل معه كموقع عادي بإحداثيات (0,0)، فيرفض أو يقبل غلط | **فيه موقع عن بعد فعلي** |
| 9 | **مراحل الموافقة** | كل الأنواع (عدا نسيان البصمة): مدير ← HR ← رئيس تنفيذي | الاستئذان والعمل الإضافي والمهمة تتوقف عند HR (في الكود: «مؤكد مع صاحب العمل») | **يحتاج قرارك** |
| 10 | **إشعار HR بكل طلب جديد** (V115) | HR يتنبّه حتى لو الطلب عند المدير | ينبّه صاحب المرحلة بس | — |
| 11 | **التحقق من رصيد الإجازة عند التقديم** | لا يوجد، والأيام تقويمية من التطبيق | يرفض لو تجاوز الرصيد، ويحسب أيام العمل | حقنا أشد، والقديم أضعف |
| 12 | **سبب الإنهاء في المسير** (`reasonFromEmp`) | من نص سبب الإنهاء بس | يضيف تحويل من مادة الإنهاء (84 ← arb77، 75 ← art81) | إضافة منّا |

### 4. ⚖️ ملاحظات نظام العمل السعودي (موجودة في القديم، وورثناها لأننا طابقناه)
| # | الموضوع | الوضع | النظام |
|---|---|---|---|
| A | **الاستقالة (م.85)** عند الحدود | صفحة نهاية الخدمة: 5 سنوات بالضبط تاخذ **⅔**. المسير: 10 سنوات بالضبط تاخذ **⅔** | الثلث من سنتين **إلى خمس** · الثلثان من 5 **إلى أقل من 10** · كاملة عند **10 فأكثر** |
| B | **وعاء نهاية الخدمة غير موحّد** | صفحة نهاية الخدمة = أساسي + سكن · المسير = الأجر الشامل · المخالصة = الإجمالي | م.84 تحسب على **الأجر الفعلي الأخير** (م.2: الأجر + البدلات الثابتة)، فلازم وعاء واحد |
| C | **تعويض م.77** | أكبر من (شهرين، و15 يوم عن كل سنة) | للعقد **غير محدد المدة**: 15 يوم/سنة. للعقد **المحدد**: أجر المدة الباقية. والحد الأدنى شهرين. العقد المحدد ما يُعامل صح |
| D | **حالات المكافأة الكاملة الخاصة** | غير موجودة | **م.87**: الاستقالة لقوة قاهرة، أو للمرأة خلال 6 أشهر من الزواج أو 3 من الوضع، تستحق مكافأة كاملة |
| E | **الإجازة المرضية (م.117)** | ما فيه حدود ولا خصم | 30 يوم بأجر كامل، و60 بثلاثة أرباع، و30 بدون أجر في السنة |
| F | **أمومة / أبوة / زواج / وفاة / حج (م.113، 151، 114)** | أنواع موجودة **بدون حدود** | الزواج 5، والوفاة 5 (حسب القرابة)، والأبوة 3، والأمومة 12 أسبوع (حسب التعديل الأخير)، والحج 10–15 مرة وحدة بعد سنتين خدمة. **يحتاج تأكيد الحدود المعمول بها في الشركة** |
| G | **الأجر الخاضع للتأمينات في المسير** | الأساسي + 25% من الأساسي (افتراض) | الخاضع = الأساسي + **بدل السكن الفعلي** (بحد 45,000). الخادم يستخدم الفعلي، والمسير يستخدم الافتراض |
| H | **أجر ساعة الإضافي** | ÷ أيام الشهر الفعلية (28–31) ÷ 8 | م.107 تطابق المبدأ (أجر الساعة + 50% من الأساسي). المتعارف عليه ÷ 30 |
| I | **العطل الرسمية للسنوات الجاية** | العيدين مسجّلين لـ 2026 بس (غير متكررين) | لازم تضاف تواريخ عيد الفطر والأضحى لـ 2027، وإلا تنحسب أيام العيد من رصيد الإجازة |
| J | **رصيد الإجازة بعد 5 سنوات** | 105 + (السنوات − 5) × 30، والرقم 105 ثابت حتى لو كان العقد بأكثر من 21 يوم | يطابق م.109 للعقد الافتراضي |

### 5. ترتيب الأولويات المقترح
1. **❌1 تقرير نهاية الخدمة** و **❌5 حساب نهاية العقد**: يأثرون على أرقام ومستندات رسمية.
2. **❌7 و❌8 البصمة** (المضلع والعمل عن بعد): يأثرون على موظفين فعلياً اليوم.
3. **❌2 و❌3 و❌4 لوحة التحكم**: تعديلات صغيرة.
4. **⚠️ التأمينات حسب `empType`** و **⚠️ التأخير بالدقيقة**.
5. **قرارات تحتاجك:** ❌9 مراحل الموافقة، و❌11 التحقق من الرصيد، والملاحظات القانونية A–J (هل نطابق القديم كما هو، أو نصحّحه حسب النظام؟).

### 6. ما لم يُغطَّ بفحص رقمي
- **التقارير التسعة:** غير تقرير نهاية الخدمة.
- **نصوص النماذج والخطابات.**
- **تقارير الحضور V117:** تجميع الجلسات وتصنيف الأيام.
- **شاشة القسيمة:** تعتمد على صفوف المسير المطابقة.
- **الشكل والألوان (CSS).**

هذي قُرئت أو انفحصت سابقاً، لكن بدون مقارنة آلية رقم برقم في هذا التدقيق.

---

### 9. نقل معادلات نظام React (المهمة 3، 18 أكتوبر 2026، الفرع `feature/hr-react-port`)

> القاعدة (قرار صاحب المشروع، `docs/port-context/PORT_PROMPT_AR.md`): كل صف 🟠/🔴 في ملف المقارنة يُعدَّل ليطابق
> معادلتهم بالضبط، ولا نعتمد على تصحيحاتنا السابقة (A–K في القسم 4 أُلغيت). الإثبات بالأرقام: `tools/react-parity`
> (`npm test`): **21 مجموعة، 81,428 حالة، صفر فرق، و111 صفاً مفحوصاً كلها تطابقهم** (74 منها كانت مختلفة في ملف المقارنة).

#### ما تغيّر ولماذا (لكل صف سببه: «معادلتهم»)
| الصفوف | قبل (عندنا) | بعد (معادلتهم) | الملفات |
|---|---|---|---|
| 1–30 PAYX | تصحيحات A/G/J، بدون noEos ولا مصر | `payx.ts` منسوخ حرفياً من `engines/payx.js`: N = 105 + (K−5)×30، الاستقالة ≤5 ثلث و<10 ثلثان، AQ على 25% من الأساسي، noEos، TAX/MF لمصر | `lib/calc/payx.ts` |
| 32–43 صفوف المسيّر | طبقتنا (تستثني اسم «البوصيري»، insSystem يُقرأ كـ matching فيظهر المطابق «لا يطابق»، exempt لا يُعفى) | طبقتهم `payrollRows.js` حرفياً، وصف الخادم يُحوَّل لشكل سجل الموظف (`toLegacy`)؛ الإضافي القديم يُرحَّل لمبلغ يدوي؛ المجاميع فيها tax/mf | `lib/calc/payroll.ts`، `payroll-rows.ts`، `/salary/basis` (+ `is_hourly`) |
| 44 usedThrough | بدون استرجاع السنوية المقطوعة | محرك الإجازات في الخادم (الاسترجاع بالمرضية) | `services/leave.py` (commit `8db0266`) |
| 45–56 التأمينات | لا نسب قبل 2026 | الجدول التلقائي `getInsSettings` + calcIns؛ القسيمة غير المحفوظة = `calcFor` للشهر (صف 55) | `services/gosi.py`، `lib/calc/inscalc.ts`، صفحة القسائم |
| 54، 58 أرقام الموظف | — | `salaryPreview` (31/31) | `services/employee_map.py` |
| 69–77 صفحة نهاية الخدمة | A (5 بالضبط = الثلث)، B (الوعاء = الأجر الفعلي)، C، D | `eosByLaw`: الوعاء = أساسي + سكن، `yrs < 5` ثلث، م.77 واحدة لكل العقود، بدون م.87، ويُستبعد «مستبعد من نهاية الخدمة» | `lib/calc/eos.ts`، صفحة نهاية الخدمة |
| 78–94 المخالصة | A، C، D، `Math.trunc` للمدخلات | `settle` حرفياً: بدون تقريب للمدخلات (صف 91)، بدون م.87 وم.77 المحدد، ومخالصة مصر | `lib/calc/settlement.ts` |
| 95–120 الإجازات | أيام عمل فقط، ترحيل 2024، الفائض من 2024 | محركهم بالطرق الثلاث والإعدادات `leave_accrual_method` و`leave_carry` (commit `8db0266`) | `services/leave.py` |
| 112–113 رصيد التطبيق | `ariba_leave_calc` | الخادم يحسب «الرصيد الحالي» و«رصيد نهاية العام» بنفس المحرك (قرار 1 و4) | `services/leave.py` app_current / app_year_end |
| 125–126 الدوام ورمضان | — | `services/schedule.py` (أم القرى عبر `hijridate`، يطابق `Intl islamic-umalqura` في المتصفح) + `lib/calc/schedule.ts` | جديد |
| 135 الانصراف المتوقع | من `late_minutes` | `expectedOut`: أول دخول + ساعات الدوام، وبحد نهاية النطاق لو أول جلسة «متأخر»، ومع دوام رمضان المرن | `/me/attendance` |
| 136–137 الخروج المبكر (المرن) | K: دخول جديد يصفّر خروج الجلسة السابقة | كل جلسة تحفظ خروجها المبكر مثل `ariba_attendance` | `punch` (حُذف التصفير) |
| 141 الغائبون | الموظفون − الحاضرون − عن بعد − الإجازة | الموظفون − (حاضر + متأخر) | صفحة الحضور |
| 142 عن بعد المتبقي | العدّاد فقط | `remote_left` = `remote_days_per_year` − المستخدم (قرار 1) | `/me/attendance` |
| 146 الرواتب حسب جهة العمل | `salaryTotal` | أساسي + سكن + نقل، لمن مجموعه > 0 | `/dashboard` |
| 147–148 التنبيهات | إقامة/جواز/تأمين طبي/عقد ≤ 90 | `collectAlerts` V142: إقامة 60، جواز 90، عقد 60 (أو المباشرة + المدة)، التجربة 30 (من −7، خلال 400 يوم، ليس للاستشاري/التمهير/المتدرب)، مرتبة بالأيام | `_dashboard_alerts` |
| 150 الأيام المتبقية في التقارير | `ceil` | `Math.round` | صفحة التقارير |
| 187 الجلسة | 8 ساعات متجددة، حد 24 | توكن ساعة يتجدد مع النشاط حتى 24 ساعة من الدخول، والخمول (5 + 3 دقائق) في الواجهة | `SESSION_HOURS` |

#### الاختبارات بعد التعديل
- `tools/react-parity`: صفر فرق، وصار الحكم «كل صف مفحوص يطابقهم» (كان: «يوافق ملف المقارنة»). خط الأساس قبل النقل محفوظ في `results/BASELINE_2026-10-18.md`.
- `tools/legacy-parity`: أُلغيت قائمة `CORRECTIONS` (A/G/J) لأن نظامهم أبقى معادلات HTML القديم، فصار القديم يُقارن بدون تعديل؛ ومجموعة «تصحيحات نظام العمل (أُلغيت)» تثبت أن موقعنا يعطي نتيجة القديم/React في الحالات التي كانت تختلف (9/9). بنود مصر (TAX/MF/ARB) الوحيدة الزائدة عندهم.
- pytest: `tests_canonical/test_port_formulas.py` (التنبيهات، رمضان، الجلسة).

#### صفوف 🟠 تُنقل مع شاشاتها (المهام 6–8)
62 و63 و65 (سنوات الخدمة المحدّثة، إصلاح الصافي بالعملة الأجنبية، البدل كنسبة) مع مزامنة سجل الموظف بشكلهم · 117 محرّر الأرصدة · 119 و139 في التطبيق · 158 مراحل الموافقة (sql/10).

### 10. حذف ما عندنا فقط 🟣 (المهمة 4)

> الحذف معتمد من صاحب المشروع بدون استثناء (عدا الصفين 113 و142 بالقرار 1، والصف 66 بالقرار 2). حُذف **المنطق** فقط؛
> لم يُحذف أي ملف ولا جدول ولا بيانات (جدول `ariba_login_attempts` باقٍ كما هو ولا يُقرأ).

| البند | ما حُذف | السلوك الآن (مثلهم) | الاختبار |
|---|---|---|---|
| 66 الإنهاء/التفعيل التلقائي للعقود | `apply_auto_terminations` (الخدمات القديمة) و`_reactivate_if_renewed` (يرجّع المنتهي «تلقائياً» فقط) | لا إنهاء تلقائي. حفظ موظف منتهٍ يرجّعه نشطاً ما لم يكن عقده محدداً ومنتهياً (EmpForm.jsx)، وزر «إعادة تفعيل» موجود (`/employees/{id}/reactivate`) | `test_port_removed.py` (4) |
| 70، 82 م.87 (D) | خيار م.87 من صفحة نهاية الخدمة والمخالصة والمسيّر | غير موجود | legacy-parity «أُلغيت» + react-parity eos/settle/payx |
| 72 م.77 للعقد المحدد (C) | حقل «نهاية العقد المحدد» في المخالصة وأشهر العقد في صفحة نهاية الخدمة | م.77 واحدة لكل العقود | نفس السابق |
| A م.85 عند 5 و10 سنوات | الشرط `<=` في الصفحة والمخالصة والمسيّر و`eos_award` في الخادم | 5 بالضبط = الثلثان، 10 بالضبط = الثلثان في المسيّر | legacy-parity + `test_port_removed.py` |
| B وعاء الصفحة = الأجر الفعلي | البدلات الأخرى من الوعاء | أساسي + سكن | react-parity eos |
| G تأمينات المسيّر على السكن الفعلي | `Q*houRate` | 25% من الأساسي | legacy-parity + react-parity payx |
| J رصيد ما بعد 5 سنوات | `5*M+…` | 105 + (K−5)×30 | نفس السابق |
| 100 ترحيل 2024 | القاعدة الخاصة (إقفال 2023 − 10) — حُذفت مع نقل المحرك (`8db0266`) | الحد العادي | `test_carry_into_2024_is_the_normal_cap` |
| 114 تجميد رصيد المنتهي | — (مع نقل المحرك) | يُحسب مثل غيره | `test_terminated_employee_balance_is_not_frozen` |
| 137 (K) تصفير خروج الجلسة السابقة | `UPDATE … early_minutes=0` عند دخول جديد | كل جلسة تحتفظ بخروجها المبكر | `test_second_check_in_keeps_…` |
| 153 (E/F) تنبيه نظام العمل على الطلبات | `_law_note` في الخادم وعرضه في الموقع والتطبيق | لا تنبيه | `test_requests_carry_no_law_note` |
| I تنبيه الأعياد الناقصة | التنبيه في تبويب العطل الرسمية | لا تنبيه | واجهة فقط |
| 188 قفل الدخول بعد المحاولات الفاشلة | عدّ المحاولات و429 | المحاولة الفاشلة = 401 دائماً (تُسجّل في سجل التعديلات فقط) | `test_failed_sign_ins_never_lock_the_account` |
| 113، 142 | **لم يُحذفا** (قرار 1) | «رصيد نهاية العام» و«عن بعد المتبقي» مثل Home.jsx | القسم 9 |
