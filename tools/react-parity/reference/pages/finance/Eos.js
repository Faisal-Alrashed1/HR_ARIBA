// Pure functions from ARIBA_HR_React/src/pages/finance/Eos.jsx (lines 6-23, verbatim).
import { num, r2, pd } from '../../lib/finance.js';
export const LAWS = { m84: ['م.84 — إنهاء من الشركة', 'Art.84 — Employer termination'], m74: ['م.74 — اتفاق الطرفين', 'Art.74 — Mutual'], m85: ['م.85 — استقالة', 'Art.85 — Resignation'], m75: ['م.75 — استقالة قسرية', 'Art.75 — Forced resignation'], m77: ['م.77 — فصل تعسفي', 'Art.77 — Arbitrary dismissal'], m80: ['م.80 — فصل تأديبي', 'Art.80 — Disciplinary'], m74r: ['م.74(4) — تقاعد', 'Art.74(4) — Retirement'], m74d: ['م.74(3) — وفاة/عجز', 'Art.74(3) — Death/disability'] };
/** مكافأة نهاية الخدمة حسب المادة (نظام العمل السعودي) */
export function eosByLaw(sal, hou, yrs, law) {
  const base = sal + hou, y1 = Math.min(yrs, 5), y2 = Math.max(0, yrs - 5), e84 = r2((base / 2) * y1 + base * y2);
  if (law === 'm84' || law === 'm74' || law === 'm74r' || law === 'm74d') return e84;
  if (law === 'm85' || law === 'm75') { if (yrs < 2) return 0; if (yrs < 5) return r2(e84 / 3); if (yrs < 10) return r2(e84 * 2 / 3); return e84; }
  if (law === 'm77') return r2(e84 + Math.max(Math.round(base * 2), Math.round((base / 30) * 15 * yrs)));
  return 0;
}
/** مدة الخدمة y/m/d كما في النظام القديم */
export function duration(d1, d2) {
  let fy = d2.getFullYear() - d1.getFullYear();
  if (d2.getMonth() < d1.getMonth() || (d2.getMonth() === d1.getMonth() && d2.getDate() < d1.getDate())) fy--;
  let tmp = new Date(d1.getFullYear() + fy, d1.getMonth(), d1.getDate()), fm = 0;
  while (new Date(tmp.getFullYear(), tmp.getMonth() + 1, tmp.getDate()) <= d2) { tmp = new Date(tmp.getFullYear(), tmp.getMonth() + 1, tmp.getDate()); fm++; }
  const fd = Math.round((d2 - tmp) / 86400000) + 1;
  return { fy, fm, fd, total: fy + fm / 12 + fd / 360 };
}
