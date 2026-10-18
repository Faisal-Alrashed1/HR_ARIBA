/* eslint-disable */
// @ts-nocheck
// Pure functions of ARIBA_HR_React/src/pages/finance/Assets.jsx (straight-line depreciation, yearly register), verbatim.
import { num, r2, pd } from './finance-util';
export const CAT = { computers: ['أجهزة وحاسبات', 'Computers', 4], electronics: ['أجهزة إلكترونية', 'Electronics', 4], vehicles: ['سيارات', 'Vehicles', 5], furniture: ['أثاث', 'Furniture', 10], equipment: ['معدات', 'Equipment', 5], software: ['برمجيات', 'Software', 3], other: ['أخرى', 'Other', 5] };
export const STS = { active: ['شغال', 'Active'], sold: ['مباع', 'Sold'], disposed: ['مستبعد', 'Disposed'], lost: ['مفقود', 'Lost'] };
const ym = (d) => d.getFullYear() * 12 + d.getMonth();
const dmy = (s) => { const a = String(s || '').slice(0, 10).split('-'); return a.length === 3 ? a[2] + '/' + a[1] + '/' + a[0] : ''; };
/* قواعد الإهلاك: قسط ثابت على (التكلفة − التخريدية) بالشهور من شهر الشراء، ويقف بعد شهر الاستبعاد. العهدة غير الرأسمالية لا تُهلك */
export function monthsDep(a, asOf) {
  if (!a || a.capitalized === false) return 0; const s = pd(a.acquisition_date); if (!s) return 0; let end = ym(asOf);
  if (a.status && a.status !== 'active' && a.disposal_date) end = Math.min(end, ym(pd(a.disposal_date)));
  return Math.max(0, Math.min(num(a.useful_life_months), end - ym(s) + 1));
}
export function accDep(a, asOf) { const life = num(a.useful_life_months) || 1, base = num(a.cost) - num(a.salvage_value), m = monthsDep(a, asOf); return m >= life ? r2(base) : r2(base * m / life); }
export function inRegister(a, asOf) { const s = pd(a.acquisition_date); if (!s || s > asOf) return false; if (a.status && a.status !== 'active' && a.disposal_date && pd(a.disposal_date) <= asOf) return false; return true; }
export function rate(a) { if (a.capitalized === false) return 0; const base = num(a.cost) - num(a.salvage_value), life = num(a.useful_life_months) || 1; return num(a.cost) > 0 ? (base / num(a.cost)) * (12 / life) * 100 : 0; }
const KEYS = ['opening', 'additions', 'disposals', 'closeCost', 'accOpen', 'charge', 'accDisp', 'accClose', 'nbvOpen', 'nbvClose', 'gl'];
export function yearReport(assets, Y) {
  const y0 = new Date(Y, 0, 1), yE = new Date(Y, 11, 31), yPrev = new Date(Y - 1, 11, 31), rows = [];
  assets.forEach((a) => {
    const acq = pd(a.acquisition_date); if (!acq || acq > yE) return; const disp = (a.status && a.status !== 'active' && a.disposal_date) ? pd(a.disposal_date) : null;
    if (disp && disp < y0) return;
    const cost = num(a.cost), opening = acq < y0 ? cost : 0, additions = acq >= y0 ? cost : 0, dispInY = !!(disp && disp >= y0 && disp <= yE), disposals = dispInY ? cost : 0;
    const accOpen = acq < y0 ? accDep(a, yPrev) : 0, accEnd = accDep(a, yE), charge = r2(accEnd - accOpen), accDisp = dispInY ? accEnd : 0, accClose = r2(accEnd - accDisp), closeCost = r2(opening + additions - disposals);
    const gl = dispInY ? r2(num(a.disposal_value) - (cost - accEnd)) : 0;
    rows.push({ a, opening, additions, disposals, closeCost, accOpen: r2(accOpen), charge, accDisp: r2(accDisp), accClose, nbvOpen: r2(opening - accOpen), nbvClose: r2(closeCost - accClose), gl, dispInY });
  });
  const z = () => Object.fromEntries(KEYS.map((k) => [k, 0])), cats = {}, tot = z();
  rows.forEach((r) => { const c = r.a.category || 'other'; cats[c] = cats[c] || { ...z(), n: 0 }; cats[c].n++; KEYS.forEach((k) => { cats[c][k] = r2(cats[c][k] + r[k]); tot[k] = r2(tot[k] + r[k]); }); });
  return { rows, cats, tot };
}
