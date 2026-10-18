// أدوات مشتركة لصفحات المالية (حاسبات، WPS، المخصصات…)
import { esc, printHtml, wrapLetterhead } from './print.js';
import { download } from './util.js';
import { buildXlsx } from './xlsx.js';

export const MN_AR = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const MN_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const r2 = (n) => Math.round(num(n) * 100) / 100;
export const money = (n) => num(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const p2 = (n) => (n < 10 ? '0' : '') + n;
export const pd = (s) => { const a = String(s || '').slice(0, 10).split('-'); return (a.length === 3 && a[0]) ? new Date(+a[0], +a[1] - 1, +a[2]) : null; };
export const iso = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
export const monthCtx = (y, mo) => { const days = new Date(y, mo, 0).getDate(); return { y, m: mo, days, start: new Date(y, mo - 1, 1), end: new Date(y, mo - 1, days) }; };
export const isTerm = (e) => !!(e && (e.isTerminated || e.term));
export const lastDayOf = (e) => pd(e.terminationDate || e.lastWorkingDay || e.lastDay);
export const shortNm = (e, en) => String((en ? (e.nameEn || e.nameAr) : (e.nameAr || e.nameEn)) || '').split(' ').slice(0, 3).join(' ');
export const empNoSort = (a, b) => { const x = Number(String(a.empNo || a.id).replace(/\D/g, '')), y = Number(String(b.empNo || b.id).replace(/\D/g, '')); return (Number.isFinite(x) ? x : 1e9) - (Number.isFinite(y) ? y : 1e9); };
/** الموظفون الحاليون النشطون غير بالساعة */
export const liveEmps = (emps) => (emps || []).filter((e) => e && !e.isHourly && !isTerm(e) && e.active !== false);

export function saveXlsx(name, sheets) { download(name, buildXlsx(sheets)); }
export function saveCsv(name, head, rows) {
  const q = (v) => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  download(name, '﻿' + [head].concat(rows).map((r) => r.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
/** طباعة على الورق الرسمي إن وُجد في الإعدادات */
export function printOfficial(settings, title, html, opts) {
  printHtml(title, wrapLetterhead(settings && settings.letterhead, html), opts);
}
export { esc };

/** نفس fD/fN في البرنامج الأصلي */
export const fD = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn'); } catch { return d; } };
export const fN = (n) => (n ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0');
