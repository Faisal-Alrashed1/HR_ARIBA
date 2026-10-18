// End of service page (rows 67–77) and the settlement (rows 78–94).
import { eosByLaw, duration } from '../reference/pages/finance/Eos.js';
import { settle } from '../reference/pages/finance/EosCalc.js';
import { setRuntime } from '../reference/engines/runtime.js';
import { Tally } from '../lib/cmp.mjs';
import { rng } from '../lib/gen.mjs';

const LAWS = ['m84', 'm74', 'm85', 'm75', 'm77', 'm80', 'm74r', 'm74d', 'm87'];

export function eosPage(ours) {
  setRuntime({ country: 'SA' });
  const t = new Tally('eos', 'صفحة نهاية الخدمة حسب المادة + المدة', [67, 68, 69, 70, 71, 72, 73, 75, 76]);
  const E = ours('calc/eos');
  if (!E) { t.missing('ملف lib/calc/eos.ts غير موجود', 2727); return t; }
  for (const law of LAWS) for (let q = 0; q <= 100; q++) for (const [sal, hou] of [[5000, 1250], [12000, 3000], [30000, 7500]]) {
    const yrs = q / 4;
    t.add({ v: eosByLaw(sal, hou, yrs, law) }, { v: E.calcByLaw(sal, hou, yrs, law) }, ['v'], { law, yrs, sal, hou },
      (i) => (i.law === 'm87' ? 'D م.87' : (i.law === 'm85' || i.law === 'm75') && i.yrs === 5 ? 'A الاستقالة 5 سنوات بالضبط' : null),
      () => ({ m84: 67, m74: 68, m74r: 68, m74d: 68, m85: 69, m75: 69, m87: 70, m77: 71, m80: 73 })[law]);
  }
  // art. 77 on a fixed-term contract (the page passes the months left): C
  for (const left of [3, 12, 18, 30]) for (let q = 4; q <= 60; q += 4) {
    const yrs = q / 4;
    t.add({ v: eosByLaw(10000, 2500, yrs, 'm77') }, { v: E.calcByLaw(10000, 2500, yrs, 'm77', left) }, ['v'], { law: 'm77', yrs, left }, () => 'C م.77 للعقد المحدد', () => 72);
  }
  const r = rng(5);
  for (let i = 0; i < 2000; i++) {
    const a = r.date(1995, 2026), b = r.date(1995, 2026), [d1, d2] = a <= b ? [a, b] : [b, a];
    const D1 = new Date(d1 + 'T00:00:00'), D2 = new Date(d2 + 'T00:00:00'), x = duration(D1, D2);
    t.add({ v: `${x.fy} سنة ${x.fm} شهر ${x.fd} يوم` }, { v: E.durationText(d1, D2) }, ['v'], { d1, d2 }, null, () => 76);
  }
  return t;
}

export function settlement(ours, N = 19868) {
  setRuntime({ country: 'SA' });
  const t = new Tally('settle', 'المخالصة sRun', [78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91]);
  const S = ours('calc/settlement');
  if (!S) { t.missing('ملف lib/calc/settlement.ts غير موجود', N); return t; }
  const r = rng(91), reasons = ['m84', 'm74', 'm85', 'm75', 'm77', 'm80', 'm53', 'm74r', 'm74d', 'm87'];
  for (let i = 0; i < N; i++) {
    const start = r.date(2000, 2025), end = r.date(+start.slice(0, 4), 2026), frac = r.chance(0.05);
    const p = {
      start, end: end < start ? start : end, sal: r.money(3000, 60000), reason: r.pick(reasons), leaveD: r.pick([21, 25, 30]) + (frac ? 0.5 : 0),
      taken: r.int(0, 200) + (frac ? 0.5 : 0), wd: r.chance(0.5) ? r.pick([28, 29, 30, 31]) : 0, ad: r.chance(0.5) ? r.int(0, 31) : 0,
      extras: r.chance(0.3) ? [{ v: r.money(100, 5000) }] : [], deds: r.chance(0.3) ? [{ v: r.int(1, 10), t: r.pick(['days', 'amount']) }] : [],
    };
    const fixedLeft = p.reason === 'm77' && r.chance(0.3) ? r.int(1, 30) : null;
    const a = settle(structuredClone(p));
    const b = S.runSettlement({ start: p.start, end: p.end, salary: p.sal, reason: p.reason, leavePerYear: p.leaveD, leaveTaken: p.taken, monthDays: p.wd, attendanceDays: p.ad,
      extras: p.extras.map((x) => x.v), deductions: p.deds.map((d) => ({ value: d.v, type: d.t === 'days' ? 'days' : 'amount' })), fixedTermMonthsLeft: fixedLeft });
    const A = a && { ty: a.ty, e84: a.e84, ef: a.ef, ldue: a.ldue, lrem: a.lrem, lcomp: a.lcomp, lmsf: a.lmsf, lexc: a.lexc, lded: a.lded, extT: a.extT, dedT: a.dedT, total: a.total };
    const B = b && { ty: b.totalYears, e84: b.e84, ef: b.award, ldue: b.leaveDue, lrem: b.leaveRemaining, lcomp: b.leaveComp, lmsf: b.periodSalary, lexc: b.leaveExcess, lded: b.leaveExcessDeduction, extT: b.extrasTotal, dedT: b.deductionsTotal, total: b.total };
    t.add(A || {}, B || {}, ['ty', 'e84', 'ef', 'ldue', 'lrem', 'lcomp', 'lmsf', 'lexc', 'lded', 'extT', 'dedT', 'total'], { ...p, fixedLeft }, (inp, x, y, bad) => {
      const c = [];
      if (inp.reason === 'm87') c.push('D م.87');
      if ((inp.reason === 'm85' || inp.reason === 'm75') && x && Math.abs(x.ty - 5) < 1e-9) c.push('A');
      if (inp.fixedLeft != null) c.push('C م.77 المحدد');
      if (frac) c.push('الكسور (Math.trunc)');
      return c.join(' + ') || null;
    }, (f, inp) => (inp.leaveD % 1 || inp.taken % 1) && ['ldue', 'lrem', 'lcomp', 'lexc', 'lded', 'total'].includes(f) ? 91 : ({ ty: 78, e84: 79, ldue: 85, lrem: 86, lcomp: 86, lmsf: 87, lexc: 88, lded: 88, extT: 89, dedT: 89, total: 90,
      ef: ({ m84: 80, m74: 80, m74r: 80, m74d: 80, m85: 81, m75: 81, m87: 82, m77: 83, m80: 84, m53: 84 })[inp.reason] })[f] ?? null);
    if (frac) { t.rowCases[91] = (t.rowCases[91] || 0) + 1; }
  }
  return t;
}
