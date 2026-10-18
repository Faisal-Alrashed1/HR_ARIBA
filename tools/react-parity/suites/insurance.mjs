// GOSI: the rate table by date (rows 45–48) and the stored employee figures (rows 49–58).
import { gosiRuleFor, calcIns } from '../reference/engines/insurance.js';
import { salaryPreview } from '../reference/lib/employees.js';
import { setRuntime } from '../reference/engines/runtime.js';
import { Tally } from '../lib/cmp.mjs';
import { rng, employee, iso } from '../lib/gen.mjs';

const KEYS = ['matchEmp', 'matchEmp55', 'matchEr', 'matchEr55', 'noMatchEmp', 'noMatchEmp55', 'noMatchEr', 'noMatchEr55', 'nonSaudiEr'];
const PY = { matchEmp: 'match_emp', matchEmp55: 'match_emp_55', matchEr: 'match_er', matchEr55: 'match_er_55', noMatchEmp: 'no_match_emp', noMatchEmp55: 'no_match_emp_55', noMatchEr: 'no_match_er', noMatchEr55: 'no_match_er_55', nonSaudiEr: 'non_saudi_er' };

export function ratesPrepare(py) {
  const cases = [];
  for (let y = 2024; y <= 2030; y++) for (let m = 1; m <= 12; m++) cases.push({ date: iso(y, m, 15) });
  py.rates = cases;
  return cases;
}
export function rates(cases, out) {
  setRuntime({ country: 'SA', insRules: null });
  const t = new Tally('rates', 'جدول نسب التأمينات حسب الشهر (2024–2030)', [45, 46, 47, 48]);
  cases.forEach((c, i) => {
    const [y, m, d] = c.date.split('-').map(Number);
    const g = gosiRuleFor(new Date(y, m - 1, d, 12)), a = { cap: g.settings.wageCap, ageThr: g.settings.ageThreshold };
    KEYS.forEach((k) => { a[k] = Number(g.rule[k]); });
    const o = out[i], b = { cap: o.cap, ageThr: o.age_thr };
    KEYS.forEach((k) => { b[k] = Number(o[PY[k]]); });
    // row 47 is the 55+ rule itself: the reduction from the normal rate, where we have a period at all
    if (b.matchEmp) for (const [k, base] of [['matchEmp55', 'matchEmp'], ['matchEr55', 'matchEr'], ['noMatchEmp55', 'noMatchEmp'], ['noMatchEr55', 'noMatchEr']]) { a['d_' + k] = a[base] - a[k]; b['d_' + k] = b[base] - b[k]; }
    t.add(a, b, [...KEYS, 'cap', 'ageThr', ...(b.matchEmp ? ['d_matchEmp55', 'd_matchEr55', 'd_noMatchEmp55', 'd_noMatchEr55'] : [])], c, (inp) => (inp.date < '2026-01-01' ? 'لا فترة قبل 2026 عندنا (صفر)' : 'الجدول التلقائي عندهم'),
      (f) => (f === 'cap' || f === 'ageThr' ? 48 : f.startsWith('d_') ? 47 : c.date < '2026-01-01' ? 46 : 45));
  });
  return t;
}

const DATES = ['2025-03-15', '2025-09-15', '2026-03-15', '2026-10-18', '2027-09-15', '2028-09-15'];
export function figuresPrepare(py) {
  const r = rng(54), cases = [];
  DATES.forEach((on) => { for (let i = 0; i < 500; i++) { const e = employee(r, 1000 + cases.length); e.excelCategory = ''; e.empType = r.chance(0.9) ? 'active' : 'training'; cases.push({ data: e, on }); } });
  py.figures = cases;
  return cases;
}
export function figures(cases, out) {
  const t = new Tally('figures', 'أرقام الموظف المحفوظة (الإجمالي، التأمينات 31/31، الصافي)', [49, 50, 51, 52, 53, 54, 57, 58]);
  cases.forEach((c, i) => {
    globalThis.__parityNow(c.on + 'T10:00:00');
    setRuntime({ country: 'SA', insRules: null });
    const e = c.data, f = { sal: e.salary, hou: e.housingAllowance, tra: e.transportAllowance, prj: e.projectAllowance, oth: e.otherAllowance, extra: e.extraAllowance, ded: e.otherDeductions,
      nat: e.nationality, currency: e.currency, exchRate: e.exchRate, insSystem: e.insSystem, wpsType: e.wpsType, dob: e.dob, jt: e.jobTitle };
    const pv = salaryPreview(f);
    const a = { total: pv.tot, gosi_employee: pv.ins, gosi_employer: pv.insC, net: pv.net };
    t.add(a, out[i], ['total', 'gosi_employee', 'gosi_employer', 'net'], { on: c.on, insSystem: e.insSystem, wpsType: e.wpsType, jobTitle: e.jobTitle, department: e.department, employer: e.employer, empType: e.empType }, (inp, A, B, bad) => {
      if (inp.on < '2026-07-01' || inp.on >= '2027-07-01') return 'جدول النسب';
      if (bad.every((f) => Math.abs(A[f] - B[f]) <= 0.011)) return 'تقريب الهللة (Decimal عندنا، Math.round عندهم)';
      if (/تمهير|تدريب/.test(inp.employer + inp.department) || inp.empType === 'training') return 'الإعفاء بالقسم/جهة العمل (نحن نمرّرها، نموذجهم لا)';
      return null;
    }, (f) => ({ total: 57, gosi_employee: 54, gosi_employer: 54, net: 58 })[f]);
  });
  globalThis.__parityNow((process.env.PARITY_NOW || '2026-10-18T10:00:00'));
  // calcIns itself on the same dates (the legacy calcIns(e,31,31,asOf) used by refreshInsuranceDependentViews)
  return t;
}
export { calcIns };
