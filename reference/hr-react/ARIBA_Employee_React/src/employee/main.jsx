import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import * as vault from '../lib/vault.js';
import { applyEmpTheme, getEmpTheme } from './theme.js';
import { installCss, loadBrand } from './brand.js';
import css from './employee.css?inline';
import EmpApp from './EmpApp.jsx';

// تطبيق الموظف: مفتاح تخزين منفصل لـ"تذكرني/البصمة"، ثم الأنماط (بألوان الشركة إن وُجدت) والوضع
vault.setNamespace('emp');
installCss(css, loadBrand());
applyEmpTheme(getEmpTheme());
const lang = (() => { try { return localStorage.getItem('ariba_ui_lang') === 'en' ? 'en' : 'ar'; } catch { return 'ar'; } })();
document.documentElement.lang = lang; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
createRoot(document.getElementById('root')).render(<StrictMode><EmpApp /></StrictMode>);
import('../lib/domTr.js').then((m) => m.syncDomTr()).catch(() => {});

// PWA: تسجيل عامل الخدمة (يعمل على https/localhost فقط)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
