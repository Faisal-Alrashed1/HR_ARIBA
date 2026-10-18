/* eslint-disable */
// @ts-nocheck
// Pure functions of ARIBA_HR_React/src/lib/goals.js (period keys, progress, rating), verbatim — the API calls live in lib/goals.ts.
export const PT = { annual: 'سنوي', quarterly: 'ربع سنوي', monthly: 'شهري' };
export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const curKey = (type, d = new Date()) => (type === 'annual' ? String(d.getFullYear()) : type === 'quarterly' ? d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1) : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
export const keyLabel = (type, key) => (type === 'annual' ? 'سنة ' + key : type === 'quarterly' ? 'الربع ' + key.slice(-1) + ' / ' + key.slice(0, 4) : MONTHS[+key.slice(5) - 1] + ' ' + key.slice(0, 4));
export const pct = (t) => (Number(t.target_value) > 0 ? Math.max(0, Math.min(100, Math.round((Number(t.actual_value) || 0) / Number(t.target_value) * 100))) : null);
export const ratingOf = (p) => (p >= 90 ? 'ممتاز' : p >= 75 ? 'جيد جداً' : p >= 60 ? 'جيد' : p >= 50 ? 'مقبول' : 'ضعيف');
