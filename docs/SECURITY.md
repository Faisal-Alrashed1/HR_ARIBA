# Security — الأمان

> English first, then the full Arabic version (same content).

---

# English

## Security

### Authentication
- Passwords are stored only as **Argon2id** hashes in the `credentials` table (rehashed automatically if the
  parameters change). Unknown usernames are verified against a dummy hash so timing doesn't reveal them.
- Sessions are **HS256 JWTs** signed with `JWT_SECRET` (issuer and audience checked): a 60-minute access token
  and a 7-day refresh token. Each credential has a `token_version`; changing or resetting a password bumps it,
  which immediately invalidates every older token on every device.
- Every request: `Authorization: Bearer <access token>` → signature, expiry, type and version checked → the
  `users` row must exist and be active (401 `unauthorized` / `session_expired`, 403 `account_inactive`).
- **Password policy** (server and client): ≥ 8 characters, letters **and** digits, different from the old one.
  Changing a password re-verifies the current one.
- **Temporary passwords**: HR/admin issue them (shown once, never logged). `must_change_password` blocks every
  endpoint except `/me` and `/auth/change-password` (403 `password_change_required`).
- **Rate limit**: login allows 5 attempts per username and 20 per IP in 5 minutes (429); in-memory, so one
  backend instance only. Behind Railway's proxy the client IP comes from `X-Forwarded-For` (`--proxy-headers`).
- Production refuses to start without a 32+ character `JWT_SECRET` or with SQLite.

### Authorization
Roles: `employee`, `manager`, `finance`, `hr`, `ceo`, `admin`. Every endpoint checks on the server;
the frontend (`proxy.ts`, hidden menu items) only mirrors it.

| Rule | Where |
|---|---|
| Role gates | `require_roles(...)` in each router |
| Data scope: employee → self; manager → self + direct reports; hr/ceo/admin → all; finance → no directory | `permissions.scope_employees` |
| Out-of-scope record → **404**, not 403 | scoped lookups in services |
| Salaries: finance, hr, admin, or the employee themselves | `permissions.can_view_salary` |
| Full ID / passport / insurance card / IBAN: hr, admin, or self; otherwise masked `******1234` | `permissions.can_view_full_ids` |
| Lists always mask the national ID and never include salaries | `employees.to_list_item` |
| Only admin changes roles or creates/resets admin accounts; nobody changes their own role or disables themselves | `services/accounts.py` |

**RLS** is enabled on every table in Postgres with **no policies**: any database role other than the owner
(which the backend uses) reads nothing. It is a second layer behind the backend's own checks.

### Transport and headers
- CORS allowlist from `CORS_ORIGINS`; no credentials mode (bearer tokens only).
- API headers: `Content-Security-Policy: default-src 'none'`, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, HSTS in production, `X-Request-ID`.
- Frontend headers (`next.config.ts`): CSP that allows `connect-src` to the API origin only, frame-ancestors none.
- OpenAPI docs only in development.

### Data protection (Saudi PDPL in mind)
- **Audit log** (`audit_logs`): logins (successful and failed), employee list and detail reads (noting whether
  salary or full IDs were returned), every write with the changed field **names** (not values), account changes.
  Each entry records actor, IP and request id.
- Minimum disclosure: masked IDs, salary hidden by role, notes hidden from roles without full-ID access.
- Uploads: allowlisted types checked against magic bytes (PDF, Word, JPG, PNG), 12 MB max, stored on disk
  (a Railway Volume) outside the web root and streamed only after a scope check; no base64 in the database.
- Secrets live only in `.env` files, which are git-ignored. `.env.example` files contain no values.

### Session handling in the browser
Access and refresh tokens are kept in first-party, `SameSite=Strict` cookies (`Secure` on HTTPS) so `proxy.ts`
can mirror routing. They are readable by JavaScript (the client sends the bearer token); the strict CSP limits
script injection. A possible hardening step: move tokens to httpOnly cookies behind a
Next.js backend-for-frontend.

---

# العربي

## الأمان

### المصادقة
- تُخزَّن كلمات المرور فقط كتجزئات **Argon2id** في جدول `credentials` (ويُعاد تجزيئها تلقائيًا إذا تغيّرت
  المعاملات). تُتحقَّق أسماء المستخدمين غير المعروفة مقابل تجزئة وهمية حتى لا يكشفها التوقيت.
- الجلسات هي **HS256 JWTs** موقّعة بـ `JWT_SECRET` (مع التحقق من الجهة المُصدِرة والجمهور): رمز وصول مدته 60 دقيقة
  ورمز تحديث مدته 7 أيام. لكل بيانات اعتماد قيمة `token_version`؛ وتغيير كلمة المرور أو إعادة تعيينها يزيدها،
  مما يُبطل فورًا كل رمز أقدم على كل جهاز.
- كل طلب: `Authorization: Bearer <access token>` ← التحقق من التوقيع والصلاحية والنوع والإصدار ← يجب أن يكون صف
  `users` موجودًا ونشطًا (401 `unauthorized` / `session_expired`، 403 `account_inactive`).
- **سياسة كلمات المرور** (في الخادم والعميل): 8 أحرف على الأقل، حروف **و** أرقام، ومختلفة عن القديمة.
  يتطلب تغيير كلمة المرور إعادة التحقق من الحالية.
- **كلمات المرور المؤقتة**: تُصدرها الموارد البشرية/المدير العام للنظام (تُعرض مرة واحدة، ولا تُسجَّل أبدًا). يحجب `must_change_password` كل
  نقطة نهاية عدا `/me` و`/auth/change-password` (403 `password_change_required`).
- **تحديد المعدّل**: يسمح تسجيل الدخول بـ 5 محاولات لكل اسم مستخدم و20 لكل عنوان IP خلال 5 دقائق (429)؛ وهو في الذاكرة، لذا
  يعمل على نسخة واحدة فقط من الخلفية. خلف وكيل Railway يُؤخذ عنوان IP للعميل من `X-Forwarded-For` (`--proxy-headers`).
- يرفض الإنتاج البدء دون `JWT_SECRET` بطول 32 حرفًا أو أكثر، أو مع SQLite.

### التفويض
الأدوار: `employee` و`manager` و`finance` و`hr` و`ceo` و`admin`. كل نقطة نهاية تتحقق في الخادم؛
والواجهة الأمامية (`proxy.ts`، وعناصر القائمة المخفية) تعكس ذلك فقط.

| القاعدة | الموضع |
|---|---|
| بوابات الأدوار | `require_roles(...)` في كل موجّه |
| نطاق البيانات: الموظف ← نفسه؛ المدير ← نفسه + مرؤوسوه المباشرون؛ hr/ceo/admin ← الجميع؛ المالية ← لا دليل | `permissions.scope_employees` |
| السجل خارج النطاق ← **404**، وليس 403 | عمليات البحث المقيّدة بالنطاق في الخدمات |
| الرواتب: المالية، أو الموارد البشرية، أو المدير العام للنظام، أو الموظف نفسه | `permissions.can_view_salary` |
| الهوية / الجواز / بطاقة التأمين / IBAN كاملة: hr أو admin أو الشخص نفسه؛ وإلا تُقنَّع `******1234` | `permissions.can_view_full_ids` |
| القوائم تُقنِّع رقم الهوية الوطنية دائمًا ولا تتضمن الرواتب أبدًا | `employees.to_list_item` |
| المدير العام للنظام وحده يغيّر الأدوار أو ينشئ/يعيد تعيين حسابات المدير العام؛ ولا أحد يغيّر دوره أو يعطّل نفسه | `services/accounts.py` |

**RLS** مفعّل على كل جدول في Postgres **دون أي سياسات**: أي دور في قاعدة البيانات غير المالك
(الذي تستخدمه الخلفية) لا يقرأ شيئًا. إنه طبقة ثانية خلف تحققات الخلفية نفسها.

### النقل والترويسات
- قائمة السماح لـ CORS من `CORS_ORIGINS`؛ دون وضع بيانات الاعتماد (رموز bearer فقط).
- ترويسات الواجهة البرمجية: `Content-Security-Policy: default-src 'none'`، `X-Frame-Options: DENY`، `nosniff`،
  `Referrer-Policy: no-referrer`، `Cache-Control: no-store`، وHSTS في الإنتاج، و`X-Request-ID`.
- ترويسات الواجهة الأمامية (`next.config.ts`): CSP تسمح بـ `connect-src` إلى أصل الواجهة البرمجية فقط، وframe-ancestors لا شيء.
- توثيق OpenAPI في بيئة التطوير فقط.

### حماية البيانات (مع مراعاة نظام حماية البيانات الشخصية السعودي PDPL)
- **سجل التدقيق** (`audit_logs`): عمليات تسجيل الدخول (الناجحة والفاشلة)، وقراءات قائمة الموظفين وتفاصيلهم (مع ملاحظة ما إذا
  أُعيد الراتب أو الهويات الكاملة)، وكل عملية كتابة مع **أسماء** الحقول المتغيّرة (لا قيمها)، وتغييرات الحسابات.
  يسجّل كل إدخال المنفِّذ وعنوان IP ومعرّف الطلب.
- الحد الأدنى من الإفصاح: هويات مقنّعة، والراتب مخفي حسب الدور، والملاحظات مخفية عن الأدوار التي لا تملك صلاحية الهوية الكاملة.
- الرفع: أنواع مسموح بها يُتحقَّق منها مقابل البايتات السحرية (PDF وWord وJPG وPNG)، بحد أقصى 12 MB، وتُخزَّن على القرص
  (Railway Volume) خارج جذر الويب ولا تُبَث إلا بعد التحقق من النطاق؛ ولا base64 في قاعدة البيانات.
- الأسرار موجودة فقط في ملفات `.env` المتجاهَلة في git. ملفات `.env.example` لا تحتوي على قيم.

### التعامل مع الجلسة في المتصفح
تُحفظ رموز الوصول والتحديث في ملفات تعريف ارتباط من الطرف الأول بخاصية `SameSite=Strict` (و`Secure` على HTTPS) حتى يتمكن `proxy.ts`
من عكس التوجيه. وهي قابلة للقراءة من JavaScript (يرسل العميل رمز bearer)؛ وتحدّ سياسة CSP الصارمة من
حقن السكربتات. خطوة تقوية ممكنة: نقل الرموز إلى ملفات تعريف ارتباط httpOnly خلف
خلفية-للواجهة-الأمامية (backend-for-frontend) في Next.js.
