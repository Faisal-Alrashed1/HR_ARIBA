# Architecture — البنية المعمارية

> English first, then the full Arabic version (same content).

---

# English

## Architecture

```
Browser ──HTTPS/JSON──▶ FastAPI (/api/v1) ──SQLAlchemy──▶ Postgres on Railway (RLS on, no policies)
   │                         │
   │ Next.js pages           └── files ──▶ Railway Volume (/data), streamed after a scope check
   │ proxy.ts (route mirror)
Hosting: Railway — services `backend`, `hr-web` (frontend/hr-web), `Postgres`; the employee app (frontend/employee-app) ships to the App Store / Google Play (docs/07_DEPLOY_RAILWAY.md)
```

### Principles
1. **The backend owns everything that matters**: state, rules, calculations and permissions.
   The frontend renders data and sends user actions. A native mobile app can use the same API later.
2. **One place per concern.** Thin routers (HTTP only) → services (business logic, pure where possible)
   → models. All `fetch` calls are in `frontend/hr-web/src/lib/api.ts` (employee app: `frontend/employee-app/src/lib/api.ts`).
3. **One calculation per rule**, used by both apps. This fixes the prototype, where the HR portal and the
   employee app computed leave differently.
4. **Normalized data.** One column per fact, no JSON blobs, no aliased field names, files in Storage.

### Backend (`backend/app`)
| Path | Role |
|---|---|
| `main.py` | app factory: CORS, security headers, request ids, error handlers, routers |
| `config.py` | settings from `.env`, validated at startup (production refuses SQLite / missing Supabase keys) |
| `database.py` | engine + session; Postgres via psycopg 3, SQLite for quick tests |
| `models.py` / `schemas.py` | every table + enum / every request + response shape |
| `migrations.py` | Alembic runner (startup in dev, tests) |
| `core/` | auth, identity provider, permissions, security, errors, audit, storage, scheduling, language, pagination |
| `routers/` | one file per resource |
| `services/` | business logic; stubs document the phases still to come |

**Request lifecycle**: security-headers middleware assigns a request id → CORS → router dependency
`get_current_user` verifies the JWT and loads the `users` row (active? must change password?) →
`require_roles(...)` → service applies the data scope → audit entry added in the same transaction → commit.

**Identity.** Built into the backend: Argon2id password hashes in `credentials`, HS256 session tokens with a
per-user token version (core/identity.py). Usernames are employee numbers.

### HR web (`frontend/hr-web/src`)
| Path | Role |
|---|---|
| `proxy.ts` | Next 16's replacement for `middleware.ts`: redirects by session and role (mirror only) |
| `app/` | one folder per route; HR pages at the top level, the employee app under `me/` |
| `components/` | `ui/` primitives, `nav/` shells (HR sidebar, employee bottom nav), feature components |
| `lib/api.ts` | the only `fetch`; all API types; refresh-on-401; `ApiError` |
| `lib/<area>.ts` | typed helpers per area (`auth.ts`, `employees.ts`) |
| `lib/i18n/` | `ar.ts` (source of keys), `en.ts`, `locale.tsx` |
| `lib/session.ts` | access/refresh tokens in first-party cookies so `proxy.ts` can read the role |

Language and theme are cookies read in the root layout, so the first paint already has the right
`lang`, `dir` and `data-theme`.

**Changes from the original brief:** hosting moved from Supabase to Railway (decision 2026-10-04), so auth and
storage are built in; the frontend never needed a Supabase client. The UI reproduces the V114 prototypes
verbatim (see frontend/hr-web/DESIGN.md), which is why Tailwind is not used.

---

# العربي

## البنية المعمارية

```
Browser ──HTTPS/JSON──▶ FastAPI (/api/v1) ──SQLAlchemy──▶ Postgres on Railway (RLS on, no policies)
   │                         │
   │ Next.js pages           └── files ──▶ Railway Volume (/data), streamed after a scope check
   │ proxy.ts (route mirror)
Hosting: Railway — services `backend`, `hr-web` (frontend/hr-web), `Postgres`; the employee app (frontend/employee-app) ships to the App Store / Google Play (docs/07_DEPLOY_RAILWAY.md)
```

### المبادئ
1. **الخلفية تملك كل ما هو مهم**: الحالة والقواعد والحسابات والصلاحيات.
   الواجهة الأمامية تعرض البيانات وترسل إجراءات المستخدم. ويمكن لتطبيق جوال أصلي استخدام نفس الواجهة البرمجية لاحقًا.
2. **مكان واحد لكل مسؤولية.** موجّهات رفيعة (HTTP فقط) ← خدمات (منطق الأعمال، نقية حيثما أمكن)
   ← نماذج. كل استدعاءات `fetch` موجودة في `frontend/hr-web/src/lib/api.ts` (تطبيق الموظف: `frontend/employee-app/src/lib/api.ts`).
3. **حساب واحد لكل قاعدة**، يستخدمه كلا التطبيقين. وهذا يصلح النموذج الأولي، حيث كانت بوابة الموارد البشرية و
   تطبيق الموظف يحسبان الإجازات بشكل مختلف.
4. **بيانات مُطبَّعة.** عمود واحد لكل معلومة، لا كتل JSON، لا أسماء حقول مستعارة، والملفات في التخزين.

### الخلفية (`backend/app`)
| المسار | الدور |
|---|---|
| `main.py` | مصنع التطبيق: CORS، ترويسات الأمان، معرّفات الطلبات، معالجات الأخطاء، الموجّهات |
| `config.py` | الإعدادات من `.env`، يُتحقَّق منها عند البدء (الإنتاج يرفض SQLite / مفاتيح Supabase المفقودة) |
| `database.py` | المحرك + الجلسة؛ Postgres عبر psycopg 3، وSQLite للاختبارات السريعة |
| `models.py` / `schemas.py` | كل جدول + تعداد / كل شكل طلب + استجابة |
| `migrations.py` | مُشغّل Alembic (عند البدء في التطوير، والاختبارات) |
| `core/` | المصادقة، مزوّد الهوية، الصلاحيات، الأمان، الأخطاء، التدقيق، التخزين، الجدولة، اللغة، الترقيم |
| `routers/` | ملف واحد لكل مورد |
| `services/` | منطق الأعمال؛ والقوالب المبدئية توثّق المراحل القادمة |

**دورة حياة الطلب**: وسيط ترويسات الأمان يعيّن معرّف طلب ← CORS ← اعتمادية الموجّه
`get_current_user` تتحقق من JWT وتحمّل صف `users` (نشط؟ يجب تغيير كلمة المرور؟) ←
`require_roles(...)` ← تطبّق الخدمة نطاق البيانات ← يُضاف إدخال التدقيق في نفس المعاملة ← الإيداع.

**الهوية.** مدمجة في الخلفية: تجزئات كلمات مرور Argon2id في `credentials`، ورموز جلسة HS256 مع
إصدار رمز لكل مستخدم (core/identity.py). أسماء المستخدمين هي أرقام الموظفين.

### واجهة الموارد البشرية (`frontend/hr-web/src`)
| المسار | الدور |
|---|---|
| `proxy.ts` | بديل Next 16 لـ `middleware.ts`: يعيد التوجيه حسب الجلسة والدور (عكس فقط) |
| `app/` | مجلد واحد لكل مسار؛ صفحات الموارد البشرية في المستوى الأعلى، وتطبيق الموظف تحت `me/` |
| `components/` | عناصر `ui/` الأساسية، وأغلفة `nav/` (الشريط الجانبي للموارد البشرية، والتنقل السفلي للموظف)، ومكوّنات الميزات |
| `lib/api.ts` | استدعاء `fetch` الوحيد؛ كل أنواع الواجهة البرمجية؛ التحديث عند 401؛ `ApiError` |
| `lib/<area>.ts` | مساعدات مُنمَّطة لكل مجال (`auth.ts`، `employees.ts`) |
| `lib/i18n/` | `ar.ts` (مصدر المفاتيح)، `en.ts`، `locale.tsx` |
| `lib/session.ts` | رموز الوصول/التحديث في ملفات تعريف ارتباط من الطرف الأول حتى يتمكن `proxy.ts` من قراءة الدور |

اللغة والسمة ملفات تعريف ارتباط تُقرأ في التخطيط الجذري، لذا يحمل العرض الأول بالفعل القيم الصحيحة لـ
`lang` و`dir` و`data-theme`.

**تغييرات عن الموجز الأصلي:** انتقلت الاستضافة من Supabase إلى Railway (قرار 2026-10-04)، لذا أصبحت المصادقة و
التخزين مدمجين؛ ولم تحتج الواجهة الأمامية قط إلى عميل Supabase. تعيد الواجهة إنتاج نماذج V114 الأولية
حرفيًا (انظر frontend/hr-web/DESIGN.md)، ولهذا لا يُستخدم Tailwind.
