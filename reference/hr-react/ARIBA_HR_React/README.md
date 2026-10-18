# برنامج الموارد البشرية — Ariba HR (React + Vite)
تطبيق مستقل: `index.html` (البرنامج) + `apply.html` (نموذج التقديم العام للمرشحين).

- تشغيل للتطوير: `npm install` ثم `npm run dev`
- بناء للنشر (مجلد dist): `npm run build` ثم ارفع محتويات dist كلها
- بناء ملف HTML واحد: `npm run build:single` (الناتج `dist-single/index.html`)
- صفحة التقديم كملف واحد: `npm run build:apply` (الناتج `dist-apply/apply.html`)
- قاعدة البيانات: ملفات `sql/` بالترتيب من 10 إلى 20 (كل ملف مرة واحدة في Supabase › SQL Editor).
  ملف 18 فيه الأجزاء اللي ما اتنفذتش تلقائياً، و19 و20 آمنين لإعادة التشغيل.
- دوال الإيميل: `supabase/functions` (النشر بالـCLI) أو `supabase/dashboard` (نسخة ملف واحد للنشر من لوحة Supabase).
- الإعداد وتفاصيل الميزات الجديدة: `docs/SETUP_NEW_FEATURES.md`
