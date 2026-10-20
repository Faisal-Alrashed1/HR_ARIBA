# Database — قاعدة البيانات

> English first, then the full Arabic version (same content).

---

# English

## Database

Postgres on Railway in production, SQLite for quick local work and tests. **Alembic owns the schema.**

### Conventions
- UUID primary keys; `created_at` / `updated_at` (timezone-aware) on every table.
- `deleted_at` soft delete on `employees`, `dependents`, `locations`, `documents`.
- Money `Numeric(12,2)`, rates `Numeric(6,3)`, day counts `Numeric(7,2)`. Never floats.
- Enums are stored by value and created as native Postgres `ENUM` types (`postgresql.ENUM`) by the baseline migration.
- One column per fact. The only JSON column is `audit_logs.details` (context for an audit entry).
- Files: `documents.storage_path` is a path under `STORAGE_DIR` (a Railway Volume in production). No base64 in the database.

### Tables (25)
| Group | Tables |
|---|---|
| Reference | `workplaces`, `departments`, `nationalities`, `holidays`, `gosi_rules`, `workflow_rules`, `company_settings`, `attendance_settings` |
| People | `employees`, `users` (login: role, active, must-change), `credentials` (Argon2 hash, token version), `dependents`, `excluded_candidates` |
| Attendance | `locations` (geofence), `attendance_records` (one per employee per day) |
| Requests | `requests`, `request_steps` (history) |
| Leave | `leave_year_ledgers` (one per employee per year), `leave_adjustments` (HR overrides with reason) |
| Payroll | `payroll_runs` (month, status, approved by/at), `payroll_rows` (snapshot of every figure) |
| EOS | `settlements`, `settlement_items` |
| Files/letters | `documents`, `template_letters` |
| Audit | `audit_logs` |

Indexes cover employee number, workplace, department, category, manager, termination date, every expiry date
used by alerts, request status/stage, and attendance date.

### Migrations
- Files: `backend/alembic/versions/NNNN_slug.py`, numbered, **never edited after merge**; add a new one instead.
- `0001_baseline_schema`: all tables. On Postgres it also creates the enum types and enables RLS on every table
  (no policies: no role but the owner can read).
- `0002_seed_reference_data`: workplaces, departments, nationalities, holidays, GOSI rules, settings, workflow rules.

Make a new migration:
```bash
cd backend
.venv/bin/alembic revision --autogenerate -m "add something"   # then review the file by hand
.venv/bin/alembic upgrade head
```
Migrations must not import `app.models` (freeze values such as enum lists inside the file).
New enum values on Postgres need `ALTER TYPE ... ADD VALUE` in a migration.

### Guards (in `tests/test_migrations.py`)
- upgrade → downgrade → upgrade on SQLite.
- **Model drift**: autogenerate against a migrated database must find no differences from `models.py`.
- Postgres variant (needs `TEST_DATABASE_URL` pointing at any Postgres test database): same, plus RLS on every table.

### Connecting to Postgres
On Railway set `DATABASE_URL=${{Postgres.DATABASE_URL}}`. Locally: `postgresql://localhost/ariba_hr_dev`
(`postgresql://...` is converted to the psycopg 3 driver automatically). Use separate projects for dev and test.

---

# العربي

## قاعدة البيانات

Postgres على Railway في الإنتاج، وSQLite للعمل المحلي السريع والاختبارات. **Alembic يملك المخطط.**

### الأعراف
- مفاتيح أساسية UUID؛ و`created_at` / `updated_at` (مدركة للمنطقة الزمنية) في كل جدول.
- حذف ناعم عبر `deleted_at` في `employees` و`dependents` و`locations` و`documents`.
- المبالغ `Numeric(12,2)`، والنسب `Numeric(6,3)`، وأعداد الأيام `Numeric(7,2)`. لا أعداد عشرية عائمة أبدًا.
- تُخزَّن التعدادات بقيمتها وتُنشأ كأنواع `ENUM` أصلية في Postgres (`postgresql.ENUM`) بواسطة الترحيل الأساسي.
- عمود واحد لكل معلومة. عمود JSON الوحيد هو `audit_logs.details` (سياق لإدخال التدقيق).
- الملفات: `documents.storage_path` مسار تحت `STORAGE_DIR` (Railway Volume في الإنتاج). لا base64 في قاعدة البيانات.

### الجداول (25)
| المجموعة | الجداول |
|---|---|
| المرجعية | `workplaces`، `departments`، `nationalities`، `holidays`، `gosi_rules`، `workflow_rules`، `company_settings`، `attendance_settings` |
| الأشخاص | `employees`، `users` (تسجيل الدخول: الدور، النشاط، وجوب التغيير)، `credentials` (تجزئة Argon2، إصدار الرمز)، `dependents`، `excluded_candidates` |
| الحضور | `locations` (السياج الجغرافي)، `attendance_records` (سجل واحد لكل موظف في اليوم) |
| الطلبات | `requests`، `request_steps` (السجل) |
| الإجازات | `leave_year_ledgers` (واحد لكل موظف في السنة)، `leave_adjustments` (تجاوزات الموارد البشرية مع السبب) |
| الرواتب | `payroll_runs` (الشهر، الحالة، اعتُمد بواسطة/في)، `payroll_rows` (لقطة لكل رقم) |
| نهاية الخدمة | `settlements`، `settlement_items` |
| الملفات/الخطابات | `documents`، `template_letters` |
| التدقيق | `audit_logs` |

تغطي الفهارس رقم الموظف، ومكان العمل، والقسم، والفئة، والمدير، وتاريخ إنهاء الخدمة، وكل تاريخ انتهاء
تستخدمه التنبيهات، وحالة/مرحلة الطلب، وتاريخ الحضور.

### الترحيلات
- الملفات: `backend/alembic/versions/NNNN_slug.py`، مرقّمة، و**لا تُعدَّل أبدًا بعد الدمج**؛ أضف ملفًا جديدًا بدلًا من ذلك.
- `0001_baseline_schema`: كل الجداول. على Postgres تنشئ أيضًا أنواع التعداد وتفعّل RLS على كل جدول
  (دون سياسات: لا يقرأ أي دور سوى المالك).
- `0002_seed_reference_data`: أماكن العمل، والأقسام، والجنسيات، والعطل، وقواعد GOSI، والإعدادات، وقواعد سير العمل.

إنشاء ترحيل جديد:
```bash
cd backend
.venv/bin/alembic revision --autogenerate -m "add something"   # then review the file by hand
.venv/bin/alembic upgrade head
```
يجب ألا تستورد الترحيلات `app.models` (جمّد القيم مثل قوائم التعداد داخل الملف).
قيم التعداد الجديدة على Postgres تحتاج إلى `ALTER TYPE ... ADD VALUE` في ترحيل.

### الضوابط (في `tests/test_migrations.py`)
- upgrade ← downgrade ← upgrade على SQLite.
- **انحراف النموذج**: يجب ألا يجد التوليد التلقائي مقابل قاعدة بيانات مُرحَّلة أي اختلافات عن `models.py`.
- نسخة Postgres (تحتاج `TEST_DATABASE_URL` يشير إلى أي قاعدة بيانات اختبار Postgres): الشيء نفسه، إضافة إلى RLS على كل جدول.

### الاتصال بـ Postgres
على Railway اضبط `DATABASE_URL=${{Postgres.DATABASE_URL}}`. محليًا: `postgresql://localhost/ariba_hr_dev`
(يُحوَّل `postgresql://...` إلى مشغّل psycopg 3 تلقائيًا). استخدم مشاريع منفصلة للتطوير والاختبار.
