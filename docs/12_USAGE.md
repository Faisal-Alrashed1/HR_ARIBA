# Quick Usage Guide — Ariba HR — دليل الاستخدام السريع

> English first, then the full Arabic version (same content).

---

# English

## Quick usage guide — Ariba HR

The system has two parts that talk to the same server and database, so any change in one shows up immediately in the other:
- **HR website** (browser): https://frontend-production-f9a8a.up.railway.app
- **Employee app** (mobile): `frontend/employee-app` — currently tested through Expo Go.

> Do not write passwords in the repo or in chats. Every temporary password is changed at first login.

---

## Part 1: HR website

1. **Login:** open the link and sign in with an HR or admin (`admin`) account — you are asked to change the password the first time.
2. **Settings first:** Settings → work start time, late grace period, flexible hour, remote-work limit, and workplaces and departments.
3. **Punch locations:** Attendance → Punch locations → add a location with its coordinates and workplace (the radius is saved as 1000 m).
4. **Employees:** Employees → Add employee → details + salary + direct manager + «مواقع العمل» ("Work locations") (optional; without them the employee punches at their workplace's locations).
5. **Employee app account:** Settings → «كلمات المرور والأمان» ("Passwords and security") → choose the employee → «إعادة تعيين كلمة المرور» ("Reset password").
   It creates the account if it does not exist, and shows the username (employee number) and a temporary password **only once** — hand it to the employee.
6. **Daily use:**
   - **Attendance:** today's log and reports, and manual add/edit.
   - **Leaves:** pending requests (approve / reject with a reason / approve on behalf / final approval), balances, public holidays.
   - **Payroll:** calculate the month then «اعتماد» ("Approve") — after approval the payslip appears to the employee in the app.
   - **Forms:** send a form to an employee (or several employees) and track its status (accepted / objected).
   - Payslip, end of service, final settlement, documents, reports.

---

## Part 2: Employee app

### Running it for testing (once, on the developer's machine)
1. Create a free account at https://expo.dev/signup, install **Expo Go** on the phone and sign in to it with the same account.
2. On the computer:
   ```bash
   cd frontend/employee-app
   npm install
   npx expo login
   npx expo start --tunnel
   ```
3. In Expo Go: open the project from **Development servers** or scan the QR code from inside Expo Go (not from the camera).

The app is connected to the deployed server by default; for a local server set `EXPO_PUBLIC_API_URL` in `.env` (see `.env.example`).

### Usage
1. **Login:** employee number + the temporary password → change it.
2. **Attendance:** allow location access → «تسجيل الحضور» ("Check in") / «تسجيل الانصراف» ("Check out"). Outside the radius the punch is rejected and the nearest location and its distance are shown. Checked out by mistake? «رجوع للعمل» ("Back to work"). Forgot? «نسيت البصمة» ("Forgot to punch").
3. **Leaves:** balance and upcoming holidays → choose the type (leave, short permission, salary advance, business assignment, overtime, forgotten punch) → dates in `YYYY-MM-DD` format and time `HH:MM` → submit. «طلباتي» ("My requests") shows the current stage.
   The path: direct manager → HR → CEO (forgotten punch → HR directly, and on approval it is recorded in attendance).
4. **Salary:** current salary + payslips of approved payrolls.
5. **My team:** for managers — their team members and approve/reject (with a reason) their requests.
6. **Documents:** forms sent by HR → accept or object (reason ≥ 3 characters).
7. **🔔 Bell:** new forms, decisions on your requests, and requests awaiting your approval.

---

## Part 3: Quick end-to-end test from both sides
1. HR: add a punch location with your own coordinates + employees (an employee and their manager) + an account for each.
2. Employee (app): check-in punch → it appears on the website (Attendance).
3. Employee: leave request → the manager approves from «فريقي» ("My team") → HR approves from «الإجازات» ("Leaves") → the notification appears to the employee.
4. HR: send a form → the employee accepts from «مستندات» ("Documents") → the status changes on the website.

---

# العربي

## دليل الاستخدام السريع — أريبا للموارد البشرية

النظام جزءان يكلّمان نفس الخادم وقاعدة البيانات، فأي تغيير في أحدهما يظهر فوراً في الآخر:
- **موقع HR** (متصفح): https://frontend-production-f9a8a.up.railway.app
- **تطبيق الموظف** (جوال): `frontend/employee-app` — يُجرَّب حالياً عبر Expo Go.

> لا تكتب كلمات المرور في الريبو أو المحادثات. كل كلمة مرور مؤقتة تُغيَّر عند أول دخول.

---

## أولاً: موقع HR

1. **الدخول:** افتح الرابط وسجّل بحساب HR أو المدير (`admin`) — يُطلب تغيير كلمة المرور أول مرة.
2. **الإعدادات أولاً:** الإعدادات ← وقت بدء الدوام وهامش التأخير والساعة المرنة وحد العمل عن بعد، وجهات العمل والأقسام.
3. **مواقع البصمة:** الحضور ← مواقع البصمة ← أضف موقعاً بإحداثياته وجهة العمل (النطاق يُحفظ 1000 م).
4. **الموظفون:** الموظفون ← إضافة موظف ← البيانات + الراتب + المدير المباشر + «مواقع العمل» (اختياري؛ بدونها يبصم في مواقع جهة عمله).
5. **حساب التطبيق للموظف:** الإعدادات ← «كلمات المرور والأمان» ← اختر الموظف ← «إعادة تعيين كلمة المرور».
   ينشئ الحساب إن لم يوجد، ويُظهر اسم المستخدم (الرقم الوظيفي) وكلمة مرور مؤقتة **مرة واحدة** — سلّمها للموظف.
6. **الاستخدام اليومي:**
   - **الحضور:** سجل اليوم والتقارير، وإضافة/تعديل يدوي.
   - **الإجازات:** الطلبات المعلقة (موافقة / رفض بسبب / اعتماد نيابة / اعتماد نهائي)، الأرصدة، العطل الرسمية.
   - **المسير:** احسب الشهر ثم «اعتماد» — بعد الاعتماد تظهر القسيمة للموظف في التطبيق.
   - **النماذج:** أرسل نموذجاً للموظف (أو لعدة موظفين) وتابع حالته (موافق / معترض).
   - كشف الراتب، نهاية الخدمة، المخالصة، الوثائق، التقارير.

---

## ثانياً: تطبيق الموظف

### التشغيل للتجربة (مرة واحدة على جهاز المطوّر)
1. أنشئ حساباً مجانياً على https://expo.dev/signup ونزّل **Expo Go** على الجوال وسجّل فيه بنفس الحساب.
2. على الكمبيوتر:
   ```bash
   cd frontend/employee-app
   npm install
   npx expo login
   npx expo start --tunnel
   ```
3. في Expo Go: افتح المشروع من **Development servers** أو امسح الـ QR من داخل Expo Go (ليس من الكاميرا).

التطبيق مربوط افتراضياً بالخادم المنشور؛ لخادم محلي ضع `EXPO_PUBLIC_API_URL` في `.env` (انظر `.env.example`).

### الاستخدام
1. **الدخول:** الرقم الوظيفي + كلمة المرور المؤقتة ← غيّرها.
2. **الحضور:** اسمح بالموقع ← «تسجيل الحضور» / «تسجيل الانصراف». خارج النطاق تُرفض البصمة ويظهر أقرب موقع ومسافته. انصرفت بالخطأ؟ «رجوع للعمل». نسيت؟ «نسيت البصمة».
3. **الإجازات:** الرصيد والعطل القادمة ← اختر النوع (إجازة، استئذان، سلفة، مهمة، عمل إضافي، نسيان بصمة) ← التواريخ بصيغة `YYYY-MM-DD` والوقت `HH:MM` ← إرسال. «طلباتي» تعرض المرحلة الحالية.
   المسار: المدير المباشر ← الموارد البشرية ← الرئيس التنفيذي (نسيان البصمة ← HR مباشرة، وعند الموافقة يُسجَّل في الحضور).
4. **الراتب:** الراتب الحالي + قسائم المسيرات المعتمدة.
5. **فريقي:** للمدير — أعضاء فريقه والموافقة/الرفض (بسبب) على طلباتهم.
6. **مستندات:** النماذج المرسلة من HR ← موافقة أو اعتراض (سبب ≥ 3 أحرف).
7. **🔔 الجرس:** نماذج جديدة، قرارات طلباتك، وطلبات بانتظار موافقتك.

---

## ثالثاً: تجربة سريعة من الطرفين
1. HR: أضف موقع بصمة بإحداثيات مكانك + موظفين (موظف ومديره) + حساب لكل منهما.
2. الموظف (التطبيق): بصمة حضور ← تظهر في الموقع (الحضور).
3. الموظف: طلب إجازة ← المدير يوافق من «فريقي» ← HR يعتمد من «الإجازات» ← يظهر الإشعار للموظف.
4. HR: أرسل نموذجاً ← الموظف يوافق من «مستندات» ← تتغير الحالة في الموقع.
