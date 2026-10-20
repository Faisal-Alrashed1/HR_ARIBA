# Feature: authentication and accounts — الميزة: المصادقة والحسابات

> English first, then the full Arabic version (same content).

---

# English

## Feature: authentication and accounts

### What it does
- Sign in with a **username** (the employee number, e.g. `emp084`) and password.
- Sessions: access token (60 min) + refresh token; the frontend refreshes once on a 401.
- First sign-in with a temporary password forces a password change before anything else.
- HR/admin create logins for employees and issue temporary passwords; admins change roles.

### Flow
1. `POST /api/v1/auth/login {username, password}` → rate limit → Argon2 check against `credentials` → active
   check → audit → `{access_token, refresh_token, expires_in, user}`.
2. The frontend keeps the tokens in cookies (`lib/session.ts`); `proxy.ts` reads the role claim to redirect
   (mirror only).
3. Every API call: `Authorization: Bearer …` → `core/auth.py` (signature, expiry, token version) → `users` row
   → role/scope checks.
4. If `must_change_password`: a blocking password dialog (as in the prototypes); the backend refuses every
   other endpoint until the change. Changing the password returns a new session and revokes all older ones.

### Code
- Backend: `core/auth.py`, `core/identity.py` (Argon2, tokens), `core/security.py` (rate limit, password policy), `services/accounts.py`, `routers/auth.py`, `routers/me.py`
- Frontend: `lib/auth.ts`, `lib/session.ts`, `lib/auth-context.tsx`, `proxy.ts`, `app/login/`, `app/me/settings/`, `components/me/change-password-form.tsx`
- Tests: `tests/test_auth.py`

### Bootstrap
`python -m app.services.seeds create-user --username emp084 --name-ar "…" --role admin` creates the employee
and login. The temporary password is written to `backend/.env.test.local` (or printed with `--print`).

### First admin
Locally: the seeds CLI above. On Railway: `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD`
(see DEPLOY_RAILWAY.md).

---

# العربي

## الميزة: المصادقة والحسابات

### ما الذي تفعله
- تسجيل الدخول بـ **اسم مستخدم** (رقم الموظف، مثل `emp084`) وكلمة مرور.
- الجلسات: رمز وصول (60 دقيقة) + رمز تحديث؛ تُحدِّث الواجهة الأمامية مرة واحدة عند 401.
- أول تسجيل دخول بكلمة مرور مؤقتة يفرض تغيير كلمة المرور قبل أي شيء آخر.
- تنشئ الموارد البشرية/المدير العام حسابات دخول للموظفين وتُصدر كلمات مرور مؤقتة؛ ويغيّر المديرون العامون الأدوار.

### التدفق
1. `POST /api/v1/auth/login {username, password}` ← تحديد المعدّل ← تحقق Argon2 مقابل `credentials` ← تحقق
   النشاط ← التدقيق ← `{access_token, refresh_token, expires_in, user}`.
2. تحفظ الواجهة الأمامية الرموز في ملفات تعريف الارتباط (`lib/session.ts`)؛ ويقرأ `proxy.ts` مطالبة الدور لإعادة التوجيه
   (عكس فقط).
3. كل استدعاء للواجهة البرمجية: `Authorization: Bearer …` ← `core/auth.py` (التوقيع، الصلاحية، إصدار الرمز) ← صف `users`
   ← تحققات الدور/النطاق.
4. إذا كان `must_change_password`: نافذة كلمة مرور حاجبة (كما في النماذج الأولية)؛ وترفض الخلفية كل
   نقطة نهاية أخرى حتى يتم التغيير. يعيد تغيير كلمة المرور جلسة جديدة ويُلغي كل الجلسات الأقدم.

### الشيفرة
- الخلفية: `core/auth.py`، `core/identity.py` (Argon2، الرموز)، `core/security.py` (تحديد المعدّل، سياسة كلمات المرور)، `services/accounts.py`، `routers/auth.py`، `routers/me.py`
- الواجهة الأمامية: `lib/auth.ts`، `lib/session.ts`، `lib/auth-context.tsx`، `proxy.ts`، `app/login/`، `app/me/settings/`، `components/me/change-password-form.tsx`
- الاختبارات: `tests/test_auth.py`

### التهيئة
`python -m app.services.seeds create-user --username emp084 --name-ar "…" --role admin` ينشئ الموظف
وحساب الدخول. تُكتب كلمة المرور المؤقتة في `backend/.env.test.local` (أو تُطبع مع `--print`).

### أول مدير عام
محليًا: واجهة سطر أوامر البذور أعلاه. على Railway: `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD`
(انظر DEPLOY_RAILWAY.md).
