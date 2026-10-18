import { useSyncExternalStore } from 'react';
let lang = 'ar';
try { lang = localStorage.getItem('ariba_ui_lang') || localStorage.getItem('hr7_lang') || 'ar'; } catch { /* storage blocked */ }
const subs = new Set();
try { document.documentElement.lang = lang; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl'; } catch { /* document unavailable */ }
export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'ar';
  try { localStorage.setItem('ariba_ui_lang', lang); } catch { /* ignore */ }
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  subs.forEach((f) => f());
  import('./domTr.js').then((m) => m.syncDomTr()).catch(() => {});
}
export function useLang() { return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, getLang); }
/** T(عربي, English) */
export const T = (ar, en) => (lang === 'en' ? en : ar);
