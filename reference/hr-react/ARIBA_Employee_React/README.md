# تطبيق الموظف — Ariba Employee (React + Vite)
تطبيق مستقل: `employee.html`.

- تشغيل للتطوير: `npm install` ثم `npm run dev` وافتح /employee.html
- بناء للنشر (مجلد dist): `npm run build` ثم ارفع محتويات dist كلها
- بناء ملف HTML واحد: `npm run build:single` (الناتج `dist-single/employee.html`)
- بيستخدم نفس قاعدة بيانات Supabase بتاعة برنامج الموارد. ملفات `sql/` و`supabase/` هنا نسخة للرجوع بس،
  والمرجع الأساسي اللي بيتنفذ منه هو مجلد برنامج الموارد البشرية (ARIBA_HR_React).
- الإعداد وتفاصيل الميزات الجديدة: `docs/SETUP_NEW_FEATURES.md`
