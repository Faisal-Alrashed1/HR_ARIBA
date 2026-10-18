// Attendance reports (rows 121–126), tafqeet (156), dashboard alerts (147–150) and their-only formulas (🔵).
import * as A from '../reference/engines/attendance.js';
import { normSchedule, scheduleFor, evalPeriods, isRamadan } from '../reference/lib/schedule.js';
import * as TQ from '../reference/lib/tafqeet.js';
import { collectAlerts, daysLeft } from '../reference/lib/util.js';
import { noEos } from '../reference/engines/empkind.js';
import { setRuntime } from '../reference/engines/runtime.js';
import * as G from '../reference/lib/goals.js';
import { calc as salCalc } from '../reference/pages/finance/SalCalc.js';
import { vat } from '../reference/pages/finance/TaxCalc.js';
import * as AS from '../reference/pages/finance/Assets.js';
import { ibanOK, idOK } from '../reference/pages/finance/Wps.js';
import * as C from '../reference/engines/country.js';
import { compute as payxCompute } from '../reference/engines/payx.js';
import { calcFor } from '../reference/pages/finance/InsCalc.js';
import { provFor } from '../reference/pages/finance/Prov.js';
import { ctx } from '../reference/engines/payrollRows.js';
import { Tally } from '../lib/cmp.mjs';
import { rng, employee, iso, addDays } from '../lib/gen.mjs';

const pad = (n) => (n < 10 ? '0' : '') + n;

export function attendance(ours) {
  const t = new Tally('attendance', 'تقارير الحضور (تجميع الجلسات وتصنيف الأيام والملخص)', [121, 122, 123, 124]);
  const O = ours('calc/att-reports');
  if (!O) { t.missing('ملف att-reports غير موجود', 1); return t; }
  const r = rng(117), today = globalThis.__parityToday(), from = addDays(today, -290);
  const holidays = [{ date: '2026-03-19', days: 4, recurring: false }, { date: '2026-05-26', days: 5, recurring: false }, { date: '2020-09-23', days: 1, recurring: true }];
  const emps = Array.from({ length: 25 }, (_, i) => ({ id: String(700 + i), empNo: String(700 + i), contractJoin: r.chance(0.2) ? addDays(today, -r.int(10, 250)) : '2020-01-01' }));
  const leaves = [], rows = [];
  emps.forEach((e) => {
    for (let k = 0; k < r.int(0, 4); k++) { const f = addDays(today, -r.int(1, 280)); leaves.push({ empId: e.id, from: f, to: addDays(f, r.int(0, 6)), type: r.pick(['annual', 'sick', 'remote']), status: 'approved' }); }
    for (let d = 0; d <= 290; d++) {
      const ds = addDays(from, d); if (r.chance(0.12)) continue;
      const sessions = r.chance(0.1) ? 2 : 1;
      let h = r.int(7, 9);
      for (let s = 0; s < sessions; s++) {
        const tin = pad(h) + ':' + pad(r.int(0, 59)) + ':00', hasOut = r.chance(0.9), tout = pad(Math.min(23, h + r.int(3, 9))) + ':' + pad(r.int(0, 59)) + ':00';
        const late = r.chance(0.25) ? r.int(1, 90) : 0;
        rows.push({ emp_id: e.id, date: ds, time_in: tin, time_out: hasOut ? tout : null, status: r.chance(0.04) ? 'remote' : late ? 'late' : 'present', late_minutes: late, early_minutes: hasOut && r.chance(0.2) ? r.int(1, 60) : 0, notes: !hasOut && r.chance(0.3) ? 'إغلاق تلقائي' : null });
        h = Math.min(20, h + r.int(4, 6));
      }
    }
  });
  setRuntime({ country: 'SA', holidays, leaves, schedule: null });
  const maps = A.buildEmpMaps(emps), theirs = A.compute(rows, from, today, emps, maps, 'ar');
  const mine = O.computeReport({ rows: rows.map((x) => ({ employee_id: x.emp_id, work_date: x.date, time_in: x.time_in, time_out: x.time_out, status: x.status, late_minutes: x.late_minutes, early_minutes: x.early_minutes, notes: x.notes })),
    from, to: today, emps: emps.map((e) => ({ id: e.id, join_date: e.contractJoin })), hols: holidays.map((h) => ({ start_date: h.date, days: h.days, is_recurring: h.recurring })),
    leaves: leaves.map((l) => ({ employee_id: l.empId, from_date: l.from, to_date: l.to, type: l.type })), today, dayName: (d) => d.toLocaleDateString('ar-SA', { weekday: 'long' }) });
  const F = ['expected', 'present', 'late', 'absent', 'leave', 'remote', 'offWorked', 'lateMin', 'early', 'earlyDays', 'noOut', 'hours', 'rate', 'avgIn'];
  theirs.forEach((s, i) => {
    t.add(s, mine[i], F, { id: s.e.id }, null, () => 123);
    s.days.forEach((d, k) => t.add({ cls: d.cls, late: d.rec?.late ?? 0, hours: d.rec?.hours ?? 0 }, { cls: mine[i].days[k]?.cls, late: mine[i].days[k]?.rec?.late ?? 0, hours: mine[i].days[k]?.rec?.hours ?? 0 }, ['cls', 'late', 'hours'], { id: s.e.id, date: d.date }, null, (f) => (f === 'cls' ? 122 : 121)));
  });
  // official schedule + Ramadan (rows 125–126): ours must offer the same evaluation
  const S = ours('calc/schedule');
  const sch = normSchedule({ enabled: true });
  for (let k = 0; k < 400; k++) {
    const ds = addDays(today, -r.int(0, 900)), periods = [{ in: pad(r.int(7, 10)) + ':' + pad(r.int(0, 59)), out: r.chance(0.9) ? pad(r.int(13, 18)) + ':' + pad(r.int(0, 59)) : '' }];
    const a = { ram: isRamadan(ds, sch), ...evalPeriods(periods, scheduleFor(ds, sch)) };
    if (!S) { t.missing('جدول الدوام ورمضان غير موجود عندنا (🔵)', 1, [125, 126]); continue; }
    t.add(a, { ram: S.isRamadan(ds, sch), ...S.evalPeriods(periods, S.scheduleFor(ds, sch)) }, ['ram', 'worked', 'late', 'early', 'shortfall'], { ds, periods }, null, (f) => (f === 'ram' ? 126 : 125));
  }
  return t;
}

export function tafqeet(ours) {
  const t = new Tally('tafqeet', 'التفقيط', [156]);
  const O = ours('calc/tafqeet'), fn = Object.values(TQ).find((v) => typeof v === 'function');
  const r = rng(156);
  for (let i = 0; i < 5032; i++) {
    const n = i < 1000 ? i : i < 2000 ? r.int(1000, 999999) : Math.round(r.next() * 5000000 * 100) / 100;
    t.add({ v: fn(n) }, { v: O.aribaTafqeet(n) }, ['v'], { n }, null, () => 156);
  }
  return t;
}

export function alertsPrepare(py) {
  const r = rng(142), today = globalThis.__parityToday(), emps = [];
  for (let i = 0; i < 600; i++) {
    const e = employee(r, 9000 + i, { terminated: false, join: r.chance(0.3) ? addDays(today, -r.int(0, 420)) : r.date(2015, 2026) });
    if (r.chance(0.3)) e.iqamaExpiry = addDays(today, r.int(-20, 120));
    if (r.chance(0.3)) e.passportExpiry = addDays(today, r.int(-20, 150));
    if (r.chance(0.3)) e.contractEnd = addDays(today, r.int(-20, 120));
    if (r.chance(0.2)) e.insuranceExpiry = addDays(today, r.int(-20, 120));
    emps.push(e);
  }
  py.alerts = [{ today, employees: emps }];
  return emps;
}
const KIND = { iq: 'iqama', pp: 'passport', ce: 'contract', pr: 'probation' };
export function alerts(emps, out) {
  const t = new Tally('alerts', 'تنبيهات لوحة التحكم (V142) والأيام المتبقية', [147, 148, 61]);
  const theirs = collectAlerts(emps, false, noEos).map((a) => ({ id: String(a.e.id), kind: KIND[a.kind], n: a.n }));
  const key = (a) => a.id + '|' + a.kind;
  const T = new Map(theirs.map((a) => [key(a), a])), O = new Map(out[0].map((a) => [key(a), a]));
  emps.forEach((e) => {
    for (const kind of ['iqama', 'passport', 'contract', 'probation', 'insurance']) {
      const a = T.get(e.id + '|' + kind), b = O.get(e.id + '|' + kind);
      t.add({ has: !!a, n: a && b ? a.n : null }, { has: !!b, n: a && b ? b.n : null }, ['has', 'n'], { id: e.id, kind }, (inp) => (inp.kind === 'probation' ? 'تنبيه التجربة عندهم فقط' : inp.kind === 'insurance' ? 'التأمين الطبي ليس في collectAlerts' : 'حدود V142 (60/90/60) مقابل 90'),
        (f) => (kind === 'probation' ? 148 : f === 'n' ? 61 : 147));
    }
  });
  // daysLeft (row 150 reports): round, ours site used ceil
  return t;
}

/** Formulas only they have. When our module exists the same cases are compared; otherwise every case counts as missing. */
export function theirsOnly(ours) {
  const out = [];
  const r = rng(186);
  const run = (id, title, rows, mod, n, gen, theirsFn, oursFn, fields) => {
    const t = new Tally(id, title, rows), O = ours(mod);
    for (let i = 0; i < n; i++) {
      const x = gen(i);
      if (!O) { t.missing('غير موجود عندنا (🔵)', 1, rows); continue; }
      t.add(theirsFn(x), oursFn(O, x), fields, x, null, () => rows);
    }
    out.push(t);
  };
  setRuntime({ country: 'SA', insRules: null, leaves: [], adjustments: [], holidays: [] });
  run('salcalc', 'حاسبة الراتب (4 أوضاع)', [163, 164, 165, 166, 167], 'calc/salcalc', 4000, () => ({ mode: r.pick(['gross', 'net', 'basic', 'target']), p: { G: r.money(4000, 80000), N: r.money(3000, 70000), B: r.money(3000, 50000), h: r.pick([0.25, 0.2, 0]), t: r.pick([0.1, 0]), hA: r.chance(0.2) ? r.money(0, 3000) : 0, tA: 0, prType: r.pick(['pct', 'amt', '']), pr: r.chance(0.3) ? r.pick([0.1, 500]) : 0, O: r.chance(0.2) ? r.money(0, 2000) : 0, sau: r.chance(0.7), rate: r.pick([0.0975, 0.1075, 0.1125]), cap: 45000 } }),
    (x) => salCalc(x.mode, x.p), (O, x) => O.calc(x.mode, x.p), ['basic', 'housing', 'transport', 'project', 'other', 'gross', 'ins', 'net', 'base']);
  run('tax', 'ضريبة القيمة المضافة', [168, 169], 'calc/tax', 1000, () => ({ rate: r.pick(['15', '5', '0']), inc: r.money(0, 100000, 1), exc: r.money(0, 100000, 1) }), (x) => vat(x.rate, x.inc, x.exc), (O, x) => O.vat(x.rate, x.inc, x.exc), ['ex1', 'tx1', 'ex2', 'tx2']);
  const asset = () => ({ category: r.pick(Object.keys(AS.CAT)), cost: r.money(1000, 200000), salvage_value: r.chance(0.3) ? r.money(0, 1000) : 0, useful_life_months: r.pick([36, 48, 60, 120]), acquisition_date: r.date(2018, 2026), status: r.pick(['active', 'active', 'sold', 'disposed']), disposal_date: r.chance(0.3) ? r.date(2022, 2026) : '', disposal_value: r.money(0, 5000), capitalized: r.chance(0.9) });
  run('assets', 'إهلاك الأصول والجرد السنوي', [174, 175, 176], 'calc/assets', 1500, () => ({ a: asset(), asOf: r.date(2020, 2026) }), (x) => ({ dep: AS.accDep(x.a, new Date(x.asOf + 'T00:00:00')), rate: AS.rate(x.a), m: AS.monthsDep(x.a, new Date(x.asOf + 'T00:00:00')) }), (O, x) => ({ dep: O.accDep(x.a, new Date(x.asOf + 'T00:00:00')), rate: O.rate(x.a), m: O.monthsDep(x.a, new Date(x.asOf + 'T00:00:00')) }), ['dep', 'rate', 'm']);
  run('yearreport', 'جرد الأصول السنوي (المجاميع)', [176], 'calc/assets', 60, () => ({ list: Array.from({ length: 20 }, asset), Y: r.int(2021, 2026) }), (x) => AS.yearReport(x.list, x.Y).tot, (O, x) => O.yearReport(x.list, x.Y).tot, ['opening', 'additions', 'disposals', 'closeCost', 'accOpen', 'charge', 'accDisp', 'accClose', 'nbvOpen', 'nbvClose', 'gl']);
  run('wps', 'فحص الآيبان والهوية', [172, 173], 'calc/wps', 1000, (i) => ({ iban: i % 3 === 0 ? 'SA0380000000608010167519' : 'SA' + String(r.int(10, 99)) + String(r.int(1e9, 9e9)) + String(r.int(1e9, 9e9)) + String(r.int(10, 99)), id: String(r.int(1e8, 3e9)) }), (x) => ({ iban: ibanOK(x.iban), id: idOK(x.id) }), (O, x) => ({ iban: O.ibanOK(x.iban), id: O.idOK(x.id) }), ['iban', 'id']);
  run('goals', 'المستهدفات والتقييم (النسبة، التصنيف، مفتاح الفترة)', [177, 179, 180], 'calc/goals', 1000, () => ({ t: { target_value: r.chance(0.1) ? 0 : r.int(1, 500), actual_value: r.int(0, 600) }, p: r.int(0, 100), type: r.pick(['annual', 'quarterly', 'monthly']), d: r.date(2025, 2027) }),
    (x) => ({ pct: G.pct(x.t), rating: G.ratingOf(x.p), key: G.curKey(x.type, new Date(x.d + 'T00:00:00')) }), (O, x) => ({ pct: O.pct(x.t), rating: O.ratingOf(x.p), key: O.curKey(x.type, new Date(x.d + 'T00:00:00')) }), ['pct', 'rating', 'key']);
  run('egypt', 'دولة مصر (التأمينات والضريبة والشهداء والإجازات والاستقالة)', [31, 56, 94, 120, 182, 183, 184, 185], 'calc/country', 1500, () => ({ gross: r.money(3000, 90000), ins: r.money(0, 2000), K: Math.round(r.next() * 2500) / 100, join: r.date(2005, 2025), end: '2026-10-18', dob: r.date(1965, 2000), sal: r.money(3000, 40000) }),
    (x) => { setRuntime({ country: 'EG' }); const tx = C.taxes(x.gross, x.ins); const v = { tax: tx.tax, mf: tx.mf, rf: C.resignFactor(x.K), cum: C.leaveCum(new Date(x.join), new Date(x.end), new Date(x.dob)), ins: C.calcInsEG({ salary: x.sal, nationality: 'مصري' }, 30, 30, new Date(x.end)).empAmt }; setRuntime({ country: 'SA' }); return v; },
    (O, x) => { O.setCountry?.('EG'); const tx = O.taxes(x.gross, x.ins); const v = { tax: tx.tax, mf: tx.mf, rf: O.resignFactor(x.K), cum: O.leaveCum(new Date(x.join), new Date(x.end), new Date(x.dob)), ins: O.calcInsEG({ salary: x.sal, nationality: 'مصري' }, 30, 30, new Date(x.end)).empAmt }; O.setCountry?.('SA'); return v; }, ['tax', 'mf', 'rf', 'cum', 'ins']);
  run('inscalc', 'حاسبة التأمينات / ملف GOSI الشهري (calcFor)', [170], 'calc/inscalc', 1500, (i) => ({ e: employee(r, 20000 + i), y: r.int(2025, 2027), m: r.int(1, 12) }), (x) => calcFor(x.e, ctx(x.y, x.m, 0)), (O, x) => O.calcFor(x.e, ctx(x.y, x.m, 0)), ['status', 'days', 'base', 'emp', 'co', 'total']);
  run('prov', 'تقرير المخصصات (provFor)', [171], 'calc/provisions', 1500, (i) => ({ e: employee(r, 30000 + i, { terminated: false }), y: r.int(2025, 2026), m: r.int(1, 12), reason: r.pick(['expiry', 'agree', 'arb77', 'retire']) }),
    (x) => provFor(x.e, new Date(x.y, x.m, 0), x.reason), (O, x) => O.provFor(x.e, new Date(x.y, x.m, 0), x.reason), ['eos', 'leaveDays', 'leave', 'svc', 'base', 'noEos', 'skip']);
  void payxCompute; void daysLeft;
  return out;
}
