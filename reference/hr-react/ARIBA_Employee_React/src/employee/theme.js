// وضع الألوان لتطبيق الموظف (نهاري افتراضيًا) — نفس مفتاح التخزين القديم
import { useSyncExternalStore } from 'react';
const K = 'ariba_employee_theme';
const subs = new Set();
export const getEmpTheme = () => { try { return localStorage.getItem(K) || 'light'; } catch { return 'light'; } };
export function applyEmpTheme(t) {
  t = t === 'dark' ? 'dark' : 'light';
  document.body.classList.toggle('ariba-light', t === 'light'); document.body.classList.toggle('ariba-dark', t === 'dark');
  document.documentElement.setAttribute('data-ariba-theme', t); document.documentElement.style.setProperty('color-scheme', t);
  const m = document.querySelector('meta[name=theme-color]'); if (m && !document.getElementById('ariba-emp-brand')) m.setAttribute('content', t === 'dark' ? '#013D31' : '#014D3D');
}
export function setEmpTheme(t) { try { localStorage.setItem(K, t); } catch { /* ignore */ } applyEmpTheme(t); subs.forEach((f) => f()); }
export const useEmpTheme = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, getEmpTheme);
