// طبقة الدولة: السعودية (افتراضي) أو مصر — منقول حرفياً من النظام القديم (ariba-v171-country-core)
import { rt } from './runtime.js';

export const DEF = {
  insEmp: 11, insEr: 18.75,
  insLimits: { 2020: [1000, 7000], 2021: [1200, 8100], 2022: [1400, 9400], 2023: [1700, 10900], 2024: [2000, 12600], 2025: [2300, 14500], 2026: [2700, 16700], 2027: [3200, 19300] },
  taxExempt: 20000,
  taxBrackets: [[0, 40000, 0], [40000, 55000, 10], [55000, 70000, 15], [70000, 200000, 20], [200000, 400000, 22.5], [400000, 1200000, 25], [1200000, null, 27.5]],
  martyrs: 0.05,
  leaveFirst: 15, leaveStd: 21, leaveSenior: 30, seniorYears: 10, seniorAge: 50, casualDays: 7,
  eosEnabled: true, eosFirstYears: 5, eosFirstRate: 0.5, eosNextRate: 1,
  resignTiers: [[2, 0], [5, 1 / 3], [10, 2 / 3], [null, 1]],
  arbComp: true, arbMonths: 2,
  weekend: 'fri_sat',
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function rules() {
  const r = clone(DEF), s = rt.egRules;
  if (s && typeof s === 'object') Object.keys(s).forEach((k) => { if (s[k] !== undefined && s[k] !== null) r[k] = s[k]; });
  return r;
}
export const isEG = () => rt.country === 'EG';

export function limitsFor(year) {
  const L = rules().insLimits, ys = Object.keys(L).map(Number).sort((a, b) => a - b);
  let y = Number(year) || new Date().getFullYear();
  if (y < ys[0]) y = ys[0]; if (y > ys[ys.length - 1]) y = ys[ys.length - 1];
  return L[String(y)];
}
export const isEgyptian = (nat) => /^مصر/.test(String(nat || '').trim()) || /^egypt/i.test(String(nat || '').trim());
export function insured(emp) {
  emp = emp || {};
  if (emp.insSystem === 'none' || emp.insSystem === 'exempt') return false;
  if (emp.insSystem === 'eg') return true;
  if (((emp.excelCategory || '') === 'consultant') || /استشاري/.test(String(emp.jobTitle || '')) || /مهمة محددة/.test(String(emp.empType || ''))) return false;
  return isEgyptian(emp.nationality);
}
export const insText = (emp) => (insured(emp) ? 'خاضع' : 'غير خاضع');

export function taxAnnual(a) {
  const B = rules().taxBrackets; let t = 0; a = Math.max(0, num(a));
  B.forEach((b) => { const lo = num(b[0]), hi = (b[1] === null || b[1] === undefined) ? Infinity : num(b[1]); if (a > lo) t += (Math.min(a, hi) - lo) * num(b[2]) / 100; });
  return t;
}
export function taxMonthly(taxableMonthly) {
  const R = rules(); const annual = Math.max(0, num(taxableMonthly) * 12 - num(R.taxExempt));
  return taxAnnual(annual) / 12;
}
export function taxes(gross, insEmp) {
  const R = rules(); gross = num(gross);
  return { tax: r2(taxMonthly(gross - num(insEmp))), mf: r2(gross * num(R.martyrs) / 100) };
}

export function calcInsEG(emp, wd, md, asOf) {
  emp = emp || {}; const R = rules();
  const wage = num(emp.salary) + num(emp.housingAllowance) + num(emp.transportAllowance) + num(emp.projectAllowance) + num(emp.otherAllowance);
  const gross = wage + num(emp.extraAllowance), frac = (md > 0 ? Math.max(0, Math.min(1, wd / md)) : 1);
  const d = asOf instanceof Date ? asOf : new Date(); const ok = insured(emp) && wage > 0;
  let ins = 0, insEr = 0, base = 0;
  if (ok) { const lim = limitsFor(d.getFullYear()); base = Math.min(lim[1], Math.max(lim[0], wage)) * frac; ins = base * R.insEmp / 100; insEr = base * R.insEr / 100; }
  const g = gross * frac; let tx = (g > 0) ? taxMonthly((g - ins) / (frac || 1)) * frac : 0; let mf = g * num(R.martyrs) / 100;
  ins = r2(ins); tx = r2(tx); mf = r2(mf);
  return { base: r2(base), empAmt: r2(ins + tx + mf), insOnly: ins, taxAmt: tx, mfAmt: mf, erAmt: r2(insEr), status: ok ? 'خاضع' : 'غير خاضع', empRate: ok ? R.insEmp / 100 : 0, erRate: ok ? R.insEr / 100 : 0 };
}

const addYears = (d, n) => { let x = new Date(d.getFullYear() + n, d.getMonth(), d.getDate()); if (x.getMonth() !== d.getMonth()) x = new Date(d.getFullYear() + n, d.getMonth() + 1, 0); return x; };
const ageAt = (dob, d) => { let a = d.getFullYear() - dob.getFullYear(); const m = d.getMonth() - dob.getMonth(); if (m < 0 || (m === 0 && d.getDate() < dob.getDate())) a--; return a; };
function rateFor(idx, start, dob) {
  const R = rules();
  if (idx >= R.seniorYears || (dob && ageAt(dob, start) >= R.seniorAge)) return R.leaveSenior;
  return idx === 0 ? R.leaveFirst : R.leaveStd;
}
export function leaveCum(join, end, dob) {
  if (!join || !end || end <= join) return 0; let tot = 0;
  for (let j = 0; j < 80; j++) {
    const s = addYears(join, j); if (s >= end) break; let e = addYears(join, j + 1); if (e > end) e = end;
    const frac = (e - s) / (addYears(join, j + 1) - s); tot += rateFor(j, s, dob) * frac;
  }
  return tot;
}
const empDob = (e) => { const d = e && (e.dob || e.birthDate); if (!d) return null; const x = new Date(d); return isNaN(x) ? null : x; };
export function annualDays(e, at) {
  const j = e && (e.contractJoin || e.joinDate || e.startDate); const s = j ? new Date(j) : null; at = at || new Date();
  if (!s || isNaN(s)) return rules().leaveStd;
  const idx = Math.max(0, Math.floor((at - s) / (365.25 * 86400000)));
  return rateFor(idx, at, empDob(e));
}
export function accrued(e, start, end, fullYearWorkdays, countWorkdays) {
  const j = e && (e.contractJoin || e.joinDate || e.startDate); const join = j ? new Date(j) : null; const dob = empDob(e);
  if (!join || isNaN(join)) return Math.min(rules().leaveStd, rules().leaveStd * (countWorkdays(start, end) / fullYearWorkdays));
  const cuts = [];
  for (let k = 0; k <= 80; k++) { const a = addYears(join, k); if (a > start && a <= end) cuts.push(a); if (a > end) break; }
  const segs = []; let cur = new Date(start);
  cuts.forEach((c) => { const prev = new Date(c); prev.setDate(prev.getDate() - 1); segs.push([cur, prev]); cur = new Date(c); });
  segs.push([cur, new Date(end)]);
  let tot = 0;
  segs.forEach((sg) => {
    if (sg[1] < sg[0]) return; const idx = Math.max(0, Math.floor((sg[0] - join) / (365.25 * 86400000)));
    tot += rateFor(idx, sg[0], dob) * (countWorkdays(sg[0], sg[1]) / fullYearWorkdays);
  });
  return tot;
}
export const isWorkdayEG = (day) => { const w = rules().weekend; return w === 'fri' ? day !== 5 : (day !== 5 && day !== 6); };
export function resignFactor(K) {
  const T = rules().resignTiers;
  for (let i = 0; i < T.length; i++) { if (T[i][0] === null || K < T[i][0] || (K === T[i][0] && i === T.length - 1)) return num(T[i][1]); }
  return 1;
}

export function egCompute(x, o, c) {
  const R = rules(), T = o.T, days = c.days, U = c.U, Ins = c.Ins, st = String(x.insStatus || '').trim();
  let N = null;
  if (!isNaN(c.K) && !(c.H && c.asOf < c.H)) { N = c.r2(c.K <= 0 ? 0 : leaveCum(c.H, c.Ieff || c.I || c.asOf, c.dob)); }
  o.N = N; o.P = (N === null) ? null : c.r2(N - o.O);
  o.AC = (!c.hasReason || o.P === null) ? num(x.leaveManual) : o.P * (T / 30);
  const Rr = c.hasReason ? c.findReason(x.reason) : null; let f = 0;
  if (Rr) { f = (Rr.f === 'tier') ? resignFactor(c.K) : Rr.f; }
  if (!R.eosEnabled) f = 0;
  o.AK = c.hasReason ? o.AJ * f : 0; o.ARB = 0;
  if (c.hasReason && Rr && Rr.k === 'arb77' && R.arbComp && !(c.trainee || x.noEos || isNaN(c.AD)) && c.K > 0) { o.ARB = num(R.arbMonths) * T * c.K; o.AK += o.ARB; }
  o.AM = o.V + o.X + o.Y + o.Z + o.AA + o.AB + o.AC + o.AK;
  const isIns = !(c.trainee || x.noIns) && !(st === 'لا يطبق' || st === 'غير خاضع'), lim = limitsFor(c.asOf.getFullYear());
  if (isIns && T > 0) { const w = Math.min(lim[1], Math.max(lim[0], T)), base = w * (Ins / days); o.AQ = base; o.AO = base * R.insEmp / 100; o.AR = base * R.insEr / 100; }
  else { o.AO = 0; o.AR = 0; o.AQ = 0; }
  const gross = o.V + o.X + o.Y + o.Z + o.AA + o.AB + o.AC, insDed = x.noInsDeduct ? 0 : o.AO, frac = (days > 0 && U > 0) ? U / days : 0;
  o.TAX = 0; o.MF = 0;
  if (frac > 0) { o.TAX = r2(taxMonthly((gross - insDed) / frac) * frac); o.MF = r2(gross * num(R.martyrs) / 100); }
  return o;
}
