# Verification Report — Porting the HR Program (React) into Our System — تقرير التحقق — نقل برنامج الموارد البشرية (React) إلى نظامنا

> English first, then the full Arabic version (same content).

---

# English

## Verification Report — Porting the HR Program (React) into Our System

Branch: `feature/hr-react-port` (not merged into main, not deployed, and no Railway command was run).
All data used in the trials is synthetic (`tools/dev-db`); there is no real data and no passwords in the repo.

### 1. What was done (one commit per phase)

| Task | commit | Content |
|---|---|---|
| 3 | `ffc63d8` | Our formulas produce their results: payroll, end of service, final settlement, social insurance (GOSI), leave, attendance, dashboard (V142), rows 113/142. |
| 4 | `91436f9` | Removed our logic that they do not have (🟣), with a test for each item — `docs/15_LOGIC_AUDIT.md` §10. |
| 5 | `69d5063` | Migration `docs/db-migrations/001_react_port.sql` + `verify_001.sql` + `run_on_railway.sh` (also works with `local:<db>`), and a test database built from the schema `tools/dev-db`. |
| 6 | `8ff583c` | Server routes for all their functions (request workflow, candidates, employees, goals and evaluation, document signing, leave attachments, mail, tasks, assets, audit log and month deletion, settings and permissions, prepare/approve/reopen payroll, password recovery, WebAuthn, Push, scheduled jobs). |
| 7 + 9 | `5deaa1c` | The website = their exact screens (`frontend/hr-web/src/port`) on top of our server, and `/apply` is the public application form. |
| 8 | `3fb1487` | Their employee-app features in the Expo app (tsc only). |

#### How the website was ported (Task 7)
- The `ARIBA_HR_React/src` files were copied as-is into `frontend/hr-web/src/port`, so every screen matches theirs literally (same JSX and CSS).
- Only the "transport" changed: `rpc('ariba_…')` goes to our corresponding server route (table §9 in the plan), login uses our session, and the router is on
  Next.js. The full list of modified files and the reason for each change is in `frontend/hr-web/src/port/ADAPTED.md` (and `diff -rq` against
  their folder shows only these files).
- What was in the browser and moved to the server per the decisions: the audit log (the server records differences field by field and records payroll edits),
  leave balances (no snapshots), department/entity lists, report templates, the salary-letter sequence, automatic candidate registration.
- The notification bell polls every 20 seconds instead of 3 seconds, and no `sw.js`.

#### Deviations from the plan (with the reason)
| Item | Plan | What was done |
|---|---|---|
| AI assistant | Port `aiParse.js` to Python | Their file stayed as-is in the browser: it only parses text, and every action it executes goes through a server route that checks permissions. Porting it adds no protection and changes its behavior. |
| `ariba_audit_list` | `GET /audit` | `POST /audit/list` (filters in the request body). |
| HTML2PDF | jspdf 2.5.2 (theirs) | jspdf 4.2.1: their version pulls in a dompurify with vulnerabilities; the functions used (addImage/addPage/output) are the same. |
| Manager signature in the app | Inside their Approvals tab | In the Documents tab (same behavior). |
| Work locations and delegation in the app | Separate screens | Cards inside "My Profile" and "Leave" as in theirs (they were cards in theirs too). |

### 2. What was verified here (last run before this report)

| Check | Result |
|---|---|
| pytest (`backend`, with `LEGACY_PARITY_PG`) | **107 passed**, 0 failed, 2 skipped: one needs a restored canonical copy (`TEST_DATABASE_URL`), and one was replaced by decision 4 and is covered by react-parity |
| `tools/react-parity` | 21 groups, 81,428 cases, **0 differences** — 111/111 rows match their version |
| `tools/legacy-parity` | All groups match |
| Website: `tsc` | Passed |
| Website: `eslint` | 0 errors (one old warning in `lib/calc/payroll.ts`) |
| Website: `next build` | Passed (all routes + `/apply`) |
| App: `tsc` | Passed (there is no eslint config for the app) |
| Migration on a database built from the schema | Passed twice in a row (idempotent), the before/after counters are equal, and `verify_001.sql` is all ok |

#### Trying the website locally against the local server (Chromium)
- Logged in as hr / admin / finance and opened all 26 screens: **no page errors and no failed requests**, and no "failed to…" messages in the content.
- Edit an employee and save → it appears in the audit log with the changed fields.
- Monthly payroll: "Prepare for Finance" from HR → Finance sees "Ready for Finance approval".
- Public application form `/apply?k=…`: submitting an application with a CV → the candidate and their file reached the server.

#### The full scenario locally (Task 10, on a synthetic database) — `tools/dev-db/scenario.py`
On a fresh database from `build.sh` and a local server (`MAIL_DISABLED=1 PUSH_DISABLED=1 SCHEDULER_ENABLED=1`): **50 passed, 0 failed**.
1. HR adds an employee → account with a temporary password → logging in with it requires a change → changing it.
2. Clock-in and clock-out from the office, and a clock-in outside the geofence is rejected.
3. All request types (annual, sick, unpaid, salary advance, overtime, forgotten clock-in, short leave permission, data change, IBAN change
   with a certificate, document upload) pass through all their stages up to approval, and their result is applied (the data, the IBAN, the attendance row). Rejection without a reason is refused,
   and escalation after the manager's deadline moves the request to HR.
4. Monthly payroll: save → HR prepares → Finance approves → the payslip reaches the employee with the correct net.
5. A candidate from the public link → accepted → becomes an employee with the next number, with their files in their documents.
6. A goal and an evaluation from the manager → approval → visible to the employee.
7. Saving the sending mailbox (password encrypted) + a test email (disabled locally) + employee notifications.
8. Termination of service (recorded in the audit log) and the end-of-service award (Art. 84 and Art. 85).

**Question for you:** after their service is terminated, the employee **can still log in** to the app (same as our behavior before the port). Their function
`ariba_hr_terminate_employee` is not in the reference, so I don't know whether it locks the account. I changed nothing — tell me if you want it to lock the account.

#### Scenarios covered by integration tests on a real database (`tests_canonical/test_port_*.py`)
The new requests with their stages (unpaid, salary advance with a cap and a single request, IBAN change with the certificate, data change, document upload),
delegation and submitting on someone's behalf, HR returning to the manager and rejection with a reason, escalation after the deadline, the candidate (form key, one-time links,
the bot honeypot, acceptance → employee with the next number and their files in their documents), goals, evaluation and approval, tasks and meetings,
assets and custody, the audit log and deleting a month with Finance approval, settings, permissions and roles, payroll: save → prepare → Finance
approval → lock → reopen with a reason, password recovery (the old one stays valid until the temporary one is used), Push and deleting expired devices,
WebAuthn (options and rejection), brand colors from a website (internal addresses are rejected), scheduled jobs with an advisory lock.

### 3. What remains on your machine (Task 10)

1. **The production copy:** run the migration on a local copy of it:
   `bash docs/db-migrations/run_on_railway.sh local:<copy_name>` — it takes a backup, migrates, verifies, and prints the before/after counters.
   Old notifications are marked "sent" during the migration so that nothing old is sent by email or Push.
2. **The full scenario on the production copy**: it passed here on a synthetic database; rerun it on the production copy with
   `SCENARIO_DB=<copy_name> .venv/bin/python ../tools/dev-db/scenario.py` (it needs the test accounts hr.test/mgr.test/ceo.test
   and an unused number 900 — safest on a `build.sh` database), then send a real test email from Settings, and compare the figures with their version.
3. **Comparing the screens with their version:** running their version requires copying it to a temporary folder and `npm install` (I did not do that inside their folder).
4. **The Expo app on the iOS simulator:** not run here (tsc only). It needs:
   - For Push: `extra.eas.projectId` in `app.json` (from EAS), then a real device.
   - Face ID works on the simulator from the Features › Face ID menu.
5. **Server environment variables** (documented in `backend/.env.example`):
   `MAIL_SECRET_KEY` (required for saving mail passwords), `RESEND_API_KEY`/`EMAIL_FROM` or an SMTP account from Settings,
   `M365_*` if the mail is Microsoft 365, `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGINS` (the website's domain name), `SCHEDULER_ENABLED=1`.
   In the demo: `MAIL_DISABLED=1` and `PUSH_DISABLED=1`.
6. **The website:** `NEXT_PUBLIC_API_URL` as it is. Install the new packages (`npm ci`).
7. After all of the above succeeds: one question, "Deploy?" (Task 11).

### 4. Known notes
- The old website components (`components/hr/*`, `lib/sheets.ts` …) were not deleted (the instructions: no file deletion), but the portal pages no longer use them.
- Extracting brand colors from a website: it accepts public addresses only and checks every redirect, but the name is resolved twice (check then request); acceptable
  because the route is for administrators only.
- WebAuthn: the signed state is valid for 5 minutes; the signature counter prevents reuse on devices that increment it.
- Biometrics in the app: a copy of the refresh token in the Keychain behind biometric verification; "Log out" with biometrics enabled does not invalidate
  the session on the server (up to 24 hours at most), and "Forget this device" deletes everything.
- The signature in the app is stored as SVG on the device only and is inserted into the document on "Approve with signature".
- "Revert to the automatic value" in payroll is recorded as an ordinary manual edit (the server does not know the source was the revert button).

---

# العربي

## تقرير التحقق — نقل برنامج الموارد البشرية (React) إلى نظامنا

الفرع: `feature/hr-react-port` (لم يُدمج في main ولم يُنشر، ولم يُشغَّل أي أمر Railway).
كل البيانات المستخدمة في التجارب اصطناعية (`tools/dev-db`)، ولا توجد بيانات حقيقية أو كلمات مرور في الريبو.

### 1. ما تمّ (commit لكل مرحلة)

| المهمة | commit | المحتوى |
|---|---|---|
| 3 | `ffc63d8` | معادلاتنا تعطي نتائجهم: المسيّر، نهاية الخدمة، المخالصة، التأمينات، الإجازات، الحضور، لوحة التحكم (V142)، الصفان 113/142. |
| 4 | `91436f9` | حذف منطقنا الذي ليس عندهم (🟣) مع اختبار لكل بند — `docs/15_LOGIC_AUDIT.md` §10. |
| 5 | `69d5063` | ترحيل `docs/db-migrations/001_react_port.sql` + `verify_001.sql` + `run_on_railway.sh` (يعمل أيضاً `local:<db>`)، وقاعدة اختبار من السكيما `tools/dev-db`. |
| 6 | `8ff583c` | مسارات الخادم لكل دوالهم (سير الطلبات، المرشحون، الموظفون، المستهدفات والتقييم، توقيع المستندات، مرفقات الإجازات، البريد، المهام، الأصول، سجل التعديلات وحذف شهر، الإعدادات والصلاحيات، تجهيز/اعتماد/فتح المسيّر، استرجاع كلمة المرور، WebAuthn، Push، المهام المجدولة). |
| 7 + 9 | `5deaa1c` | الموقع = شاشاتهم نفسها (`frontend/hr-web/src/port`) فوق خادمنا، و`/apply` نموذج التقديم العام. |
| 8 | `3fb1487` | ميزات تطبيق الموظف عندهم في تطبيق Expo (tsc فقط). |

#### طريقة نقل الموقع (المهمة 7)
- نُسخت ملفات `ARIBA_HR_React/src` كما هي إلى `frontend/hr-web/src/port`، فكل شاشة تطابق شاشتهم حرفياً (نفس الـ JSX والـ CSS).
- لم يتغيّر إلا «النقل»: `rpc('ariba_…')` تذهب لمسار خادمنا المقابل (الجدول §9 في الخطة)، والدخول على جلستنا، والراوتر على
  Next.js. القائمة الكاملة للملفات المعدّلة وسبب كل تعديل في `frontend/hr-web/src/port/ADAPTED.md` (و`diff -rq` مع
  مجلدهم يُظهر هذه الملفات فقط).
- ما كان في المتصفح ونُقل للخادم حسب القرارات: سجل التعديلات (الخادم يسجّل الفروق حقلاً حقلاً ويسجّل تعديلات المسيّر)،
  أرصدة الإجازة (لا لقطات)، قوائم الأقسام/الجهات، قوالب التقارير، تسلسل خطاب الراتب، التسجيل التلقائي للمرشحين.
- الجرس كل 20 ثانية بدل 3 ثوانٍ، ولا `sw.js`.

#### انحرافات عن الخطة (مع السبب)
| البند | الخطة | ما تمّ |
|---|---|---|
| مساعد AI | نقل `aiParse.js` إلى Python | بقي ملفهم كما هو في المتصفح: هو تحليل نص فقط، وكل إجراء ينفّذه يمر بمسار في الخادم يتحقق من الصلاحية. نقله لا يضيف حماية ويغيّر سلوكه. |
| `ariba_audit_list` | `GET /audit` | `POST /audit/list` (الفلاتر جسم الطلب). |
| HTML2PDF | jspdf 2.5.2 (عندهم) | jspdf 4.2.1: نسختهم تسحب dompurify فيه ثغرات؛ الدوال المستخدمة (addImage/addPage/output) نفسها. |
| توقيع المدير في التطبيق | داخل تبويب الموافقات عندهم | في تبويب المستندات (نفس السلوك). |
| مواقع العمل والتفويض في التطبيق | شاشات مستقلة | بطاقات داخل «ملفي» و«الإجازات» كما عندهم (كانت بطاقات عندهم أيضاً). |

### 2. ما تم التحقق منه هنا (آخر تشغيل قبل هذا التقرير)

| الفحص | النتيجة |
|---|---|
| pytest (`backend`، مع `LEGACY_PARITY_PG`) | **107 نجح**، 0 فشل، 2 متخطّى: واحد يحتاج نسخة canonical مستعادة (`TEST_DATABASE_URL`)، وواحد استُبدل بقرار 4 وتغطيه react-parity |
| `tools/react-parity` | 21 مجموعة، 81,428 حالة، **0 فرق** — 111/111 صفاً تطابق نسختهم |
| `tools/legacy-parity` | كل المجموعات تطابق |
| الموقع: `tsc` | نجح |
| الموقع: `eslint` | 0 أخطاء (تحذير واحد قديم في `lib/calc/payroll.ts`) |
| الموقع: `next build` | نجح (كل المسارات + `/apply`) |
| التطبيق: `tsc` | نجح (لا يوجد إعداد eslint للتطبيق) |
| الترحيل على قاعدة من السكيما | نجح مرتين متتاليتين (idempotent)، والعدّادات قبل/بعد متساوية، و`verify_001.sql` كله ok |

#### تجربة الموقع محلياً على الخادم المحلي (Chromium)
- تسجيل الدخول بـ hr / admin / finance، وفتح الـ 26 شاشة كلها: **لا أخطاء صفحة ولا طلبات فاشلة**، ولا رسائل «تعذّر» في المحتوى.
- تعديل موظف وحفظه → يظهر في سجل التعديلات بالحقول المتغيّرة.
- مسيّر الشهر: «تجهيز للمالية» من HR → يظهر للمالية «جاهز للمالية للاعتماد».
- نموذج التقديم العام `/apply?k=…`: إرسال طلب بسيرة ذاتية → وصل المرشح وملفه للخادم.

#### السيناريو الكامل محلياً (المهمة 10، على قاعدة اصطناعية) — `tools/dev-db/scenario.py`
على قاعدة جديدة من `build.sh` وخادم محلي (`MAIL_DISABLED=1 PUSH_DISABLED=1 SCHEDULER_ENABLED=1`): **50 نجح، 0 فشل**.
1. HR يضيف موظفاً → حساب بكلمة مؤقتة → الدخول بها يطلب التغيير → تغييرها.
2. بصمة حضور وانصراف من المقر، وبصمة خارج النطاق مرفوضة.
3. كل أنواع الطلبات (سنوية، مرضية، بدون راتب، راتب مقدم، عمل إضافي، نسيان بصمة، استئذان، تعديل بيانات، تغيير آيبان
   بشهادة، رفع مستند) تمر بكل مراحلها حتى الاعتماد، وتُطبَّق نتيجتها (البيانات، الآيبان، سطر الحضور). الرفض بلا سبب مرفوض،
   والتصعيد بعد مهلة المدير ينقل الطلب لـ HR.
4. مسيّر الشهر: حفظ → تجهيز HR → اعتماد المالية → القسيمة عند الموظف بالصافي الصحيح.
5. مرشح من الرابط العام → قبوله → موظف بالرقم التالي وملفاته في وثائقه.
6. مستهدف وتقييم من المدير → اعتماد → يظهر للموظف.
7. حفظ بريد الإرسال (كلمة المرور مشفّرة) + إيميل تجريبي (معطّل محلياً) + إشعارات الموظف.
8. إنهاء الخدمة (مسجّل في سجل التعديلات) ومكافأة نهاية الخدمة (م84 و م85).

**سؤال لك:** الموظف بعد إنهاء خدمته **ما زال يقدر يسجّل دخول** للتطبيق (نفس سلوكنا قبل النقل). دالتهم
`ariba_hr_terminate_employee` ليست في المرجع فلا أعرف هل تقفل الحساب. لم أغيّر شيئاً — قل لي إن تبيها تقفل الحساب.

#### سيناريوهات مغطّاة باختبارات تكاملية على قاعدة حقيقية (`tests_canonical/test_port_*.py`)
الطلبات الجديدة بمراحلها (بدون راتب، راتب مقدم بسقف وطلب واحد، تغيير الآيبان بالشهادة، تعديل بيانات، رفع مستند)،
التفويض والتقديم بالنيابة، إرجاع HR للمدير والرفض بسبب، التصعيد بعد المهلة، المرشح (مفتاح النموذج، الروابط لمرة واحدة،
الفخ للروبوتات، القبول → موظف بالرقم التالي وملفاته في وثائقه)، المستهدفات والتقييم والاعتماد، المهام والاجتماعات،
الأصول والعهدة، سجل التعديلات وحذف شهر بموافقة المالية، الإعدادات والصلاحيات والأدوار، مسيّر: حفظ → تجهيز → اعتماد
المالية → قفل → فتح بسبب، استرجاع كلمة المرور (القديمة تبقى حتى تُستخدم المؤقتة)، Push وحذف الأجهزة المنتهية،
WebAuthn (الخيارات والرفض)، ألوان الهوية من موقع (والعناوين الداخلية مرفوضة)، المهام المجدولة بقفل advisory.

### 3. ما بقي على جهازك (المهمة 10)

1. **نسخة الإنتاج:** شغّل الترحيل على نسخة محلية منها:
   `bash docs/db-migrations/run_on_railway.sh local:<اسم_النسخة>` — يأخذ نسخة احتياطية، يرحّل، يتحقق، ويطبع العدّادات قبل/بعد.
   الإشعارات القديمة تُعلَّم «مُرسلة» عند الترحيل حتى لا يُرسل شيء قديم بالإيميل أو Push.
2. **السيناريو الكامل على نسخة الإنتاج**: نجح هنا على قاعدة اصطناعية؛ أعده على نسخة الإنتاج بـ
   `SCENARIO_DB=<اسم_النسخة> .venv/bin/python ../tools/dev-db/scenario.py` (يحتاج حسابات الاختبار hr.test/mgr.test/ceo.test
   ورقم 900 غير مستخدم — الأسلم على قاعدة `build.sh`)، ثم أرسل إيميلاً تجريبياً حقيقياً من الإعدادات، وقارن الأرقام بنسختهم.
3. **مقارنة الشاشات بنسختهم:** تشغيل نسختهم يحتاج نسخها لمجلد مؤقت و`npm install` (لم أفعل ذلك داخل مجلدهم).
4. **تطبيق Expo على محاكي iOS:** لم يُشغَّل هنا (tsc فقط). يحتاج:
   - للـ Push: `extra.eas.projectId` في `app.json` (من EAS)، ثم جهاز حقيقي.
   - Face ID يعمل على المحاكي من قائمة Features › Face ID.
5. **متغيرات البيئة للخادم** (موثّقة في `backend/.env.example`):
   `MAIL_SECRET_KEY` (إلزامي لحفظ كلمات مرور البريد)، `RESEND_API_KEY`/`EMAIL_FROM` أو حساب SMTP من الإعدادات،
   `M365_*` لو البريد Microsoft 365، `WEBAUTHN_RP_ID` و`WEBAUTHN_ORIGINS` (اسم نطاق الموقع)، `SCHEDULER_ENABLED=1`.
   في الديمو: `MAIL_DISABLED=1` و`PUSH_DISABLED=1`.
6. **الموقع:** `NEXT_PUBLIC_API_URL` كما هو. ثبّت الحزم الجديدة (`npm ci`).
7. بعد نجاح كل ما سبق: سؤال واحد «انشر؟» (المهمة 11).

### 4. ملاحظات معروفة
- مكوّنات الموقع القديمة (`components/hr/*`، `lib/sheets.ts` …) لم تُحذف (التعليمات: لا حذف ملفات)، لكن صفحات البوابة لم تعد تستخدمها.
- استخراج ألوان الهوية من موقع: يقبل عناوين عامة فقط ويتحقق من كل تحويل، لكن الاسم يُحلّ مرتين (فحص ثم طلب)؛ مقبول
  لأن المسار للمسؤولين فقط.
- WebAuthn: الحالة الموقّعة صالحة 5 دقائق؛ عدّاد التوقيع يمنع إعادة الاستخدام عند الأجهزة التي تزيده.
- البصمة في التطبيق: نسخة من رمز التجديد في Keychain خلف التحقق الحيوي؛ «تسجيل الخروج» مع البصمة المفعّلة لا يُبطل
  الجلسة على الخادم (حتى 24 ساعة كحد أقصى)، و«نسيان هذا الجهاز» يحذف كل شيء.
- التوقيع في التطبيق يُحفظ كـ SVG في الجهاز فقط ويُدرج في المستند عند «موافق مع التوقيع».
- «رجوع للقيمة التلقائية» في المسيّر يُسجَّل كتعديل يدوي عادي (الخادم لا يعرف أن المصدر زر الرجوع).
