# tools/dev-db — قاعدة تجربة محلية من السكيما فقط

`build.sh <db>` يبني قاعدة Postgres من سكيما Supabase (`tools/legacy-parity/sql/schema.sql`) ثم يشغّل الترتيب نفسه الذي
نُفّذ على Railway (`docs/db-normalization`) ثم ترحيلات النقل (`docs/db-migrations`) ثم بيانات تجربة مصطنعة (`seed.py`).

```
export PGHOST=/tmp PGUSER=postgres ARIBA_DEV_PASSWORD='كلمة-مرور-تجربة'
bash tools/dev-db/build.sh ariba_dev                  # مع الترحيلات
bash tools/dev-db/build.sh ariba_trial --no-migrations  # لتجربة run_on_railway.sh local:ariba_trial
```

الحسابات: `admin.test`، `hr.test` (40)، `ceo.test` (86)، `fin.test` (60)، `mgr.test` (50 مدير 51–58)، `emp.test` (51)،
`chair.test` (61)، `adm.test` (62)، و`emp<رقم>.test` لكل موظف آخر. كلمة المرور من `ARIBA_DEV_PASSWORD` فقط (لا تُحفظ في الريبو).
البيانات مصطنعة بالكامل (أسماء «اختبار/تجريبي»، أرقام عشوائية بمولّد ثابت).
