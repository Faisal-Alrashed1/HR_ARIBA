// Leave engine (rows 95–120): their leave.js with each accrual method vs our backend LeaveBook.
import * as L from '../reference/engines/leave.js';
import { usedThrough } from '../reference/engines/payrollRows.js';
import { setRuntime } from '../reference/engines/runtime.js';
import { Tally } from '../lib/cmp.mjs';
import { rng, employee, iso, addDays } from '../lib/gen.mjs';

const OTHER = ['sick', 'emergency', 'marriage', 'death', 'hajj', 'unpaid', 'remote'];

/** 300 employees with history: approved annual and other leave, imported per-year figures, manual adjustments. */
export function leaveData(seed = 300) {
  const r = rng(seed), today = globalThis.__parityToday(), cy = +today.slice(0, 4);
  const holidays = [{ date: '2024-04-09', days: 4, recurring: false }, { date: '2025-03-30', days: 4, recurring: false }, { date: '2026-03-19', days: 4, recurring: false },
    { date: '2024-06-15', days: 5, recurring: false }, { date: '2025-06-05', days: 5, recurring: false }, { date: '2026-05-26', days: 5, recurring: false },
    { date: '2020-09-23', days: 1, recurring: true }, { date: '2020-02-22', days: 1, recurring: true }];
  const employees = [], leaves = [], adjustments = [], usedEnd = {};
  for (let i = 0; i < 300; i++) {
    const clean = i < 35;
    const e = employee(r, 5000 + i, { join: r.date(2015, 2026), terminated: !clean && r.chance(0.08) });
    if (e.terminationDate && e.terminationDate > today) e.terminationDate = today;
    const sy = +e.contractJoin.slice(0, 4);
    if (!clean) {
      for (let y = sy; y <= cy; y++) {
        if (r.chance(0.15)) {
          const o = {};
          if (r.chance(0.5)) o.used = r.int(0, 25);
          if (r.chance(0.3)) o.entitlement = r.pick([21, 25, 30]);
          if (r.chance(0.3)) { o.carry = r.int(0, 15); }
          if (r.chance(0.3)) o.yearEnd = r.int(0, 40);
          if (r.chance(0.2)) o.carryNext = r.int(0, 15);
          if (r.chance(0.15)) o.eos = r.int(0, 20);
          if (y === cy && r.chance(0.4)) { o.current = r.int(0, 40); o.currentAsOf = iso(cy, r.int(1, 9), 1); }
          if (r.chance(0.2)) o.asOf = iso(y, r.int(1, 12), 1);
          if (Object.keys(o).length) (e.leaveYearOverrides = e.leaveYearOverrides || {})[String(y)] = o;
        }
        if (r.chance(0.1)) e['leaveUsed' + y] = r.int(0, 20);
        if (r.chance(0.1)) (e.leaveHistoryByYear = e.leaveHistoryByYear || {})[String(y)] = r.int(0, 20);
      }
      if (r.chance(0.1)) e.leaveEosExcess = r.int(1, 30);
    }
    employees.push(e);
    for (let k = 0; k < r.int(0, 6); k++) {
      const f = r.date(Math.max(sy, cy - 4), cy), to = addDays(f, r.int(0, 14));
      if (f < e.contractJoin) continue;
      leaves.push({ id: 'L' + leaves.length, empId: e.id, type: 'annual', from: f, to, status: r.chance(0.85) ? 'approved' : 'pending' });
      if (!clean && r.chance(0.25)) { const s = addDays(f, r.int(0, 5)); leaves.push({ id: 'L' + leaves.length, empId: e.id, type: r.pick(OTHER), from: s, to: addDays(s, r.int(0, 4)), status: 'approved' }); }
    }
    // their app never loads rt.adjustments (always []), and our canonical loader has none either: no adjustments here
    usedEnd[e.id] = e.terminationDate || iso(cy, 10, 31);
  }
  return { today, employees, leaves, adjustments, holidays, usedEnd, clean: new Set(employees.slice(0, 35).map((e) => e.id)) };
}

export function leavePrepare(py, data) { py.leave = [{ today: data.today, employees: data.employees, leaves: data.leaves, adjustments: data.adjustments, holidays: data.holidays, usedEnd: data.usedEnd }]; }

const ROW = { current: 104, year_end: 102, carry: 101, acc_eos: 110, cum_accrued: 111, cum_used: 111, used_through: 44, app_current: 112, app_year_end: 113, summary_current: 114 };

export function leave(data, out, method) {
  const t = new Tally('leave_' + method, `محرك الإجازات — طريقة ${method === 'calendar' ? 'تقويمية (افتراضيهم)' : method === 'monthly' ? 'شهرية' : 'أيام عمل (= طريقتنا)'}`, [98, 101, 102, 103, 104, 105, 107, 109, 110, 111, 112, 113, 114]);
  setRuntime({ country: 'SA', leaveAccrual: method, leaveCarry: { enabled: true, days: 10 }, holidays: data.holidays, leaves: data.leaves, adjustments: data.adjustments, employees: data.employees });
  const cy = +data.today.slice(0, 4);
  let cleanDiff = 0; const cleanFields = {};
  data.employees.forEach((e) => {
    const o = out[e.id];
    const a = {
      current: L.leaveCurrentBalance(e), year_end: L.leaveProjectedYearEnd(e, cy), carry: L.leaveCarryForward(e, cy), acc_eos: L.leaveAccumulatedEos(e, cy),
      cum_accrued: L.leaveCumulativeAccruedToToday(e), cum_used: L.leaveCumulativeUsedToToday(e), used_through: usedThrough(e, new Date(data.usedEnd[e.id] + 'T00:00:00')),
      app_current: L.leaveCurrentBalance(e), app_year_end: L.leaveProjectedYearEnd(e, cy), summary_current: L.leaveCurrentBalance(e),
    };
    const fields = Object.keys(ROW);
    const isClean = data.clean.has(e.id);
    const hasOther = data.leaves.some((l) => l.empId === e.id && l.type !== 'annual');
    const changed = t.add(a, o, fields, { id: e.id, clean: isClean, join: e.contractJoin, overrides: e.leaveYearOverrides, terminated: e.isTerminated }, (inp, A, B, bad) => {
      const c = [];
      if (method !== 'workdays' && bad.some((f) => ['current', 'year_end', 'cum_accrued', 'carry', 'acc_eos', 'app_current', 'app_year_end', 'summary_current'].includes(f))) c.push('طريقة الاستحقاق');
      if (e.leaveYearOverrides) c.push('الأرقام المستوردة (yearEnd/current/carryNext)');
      if (Object.keys(e).some((k) => /^leaveUsed\d{4}$/.test(k))) c.push('leaveUsed<سنة>');
      if (hasOther) c.push('استرجاع السنوية المقطوعة');
      if (bad.includes('acc_eos') && (+e.contractJoin.slice(0, 4) < 2024 || e.leaveEosExcess)) c.push('الفائض من أول سنة بدون الحقل القديم');
      if (bad.includes('carry') && cy === 2024) c.push('ترحيل 2024');
      if (bad.includes('summary_current') && e.isTerminated) c.push('تجميد رصيد المنتهي');
      if (bad.some((f) => f === 'app_current')) c.push('رصيد التطبيق (الإجازة التي بدأت تُخصم كاملة)');
      if (data.adjustments.some((x) => x.empId === e.id)) c.push('التعديلات اليدوية');
      return c.join(' + ') || null;
    }, (f, inp) => {
      if (method !== 'workdays' && ['current', 'year_end', 'cum_accrued', 'app_current', 'app_year_end', 'summary_current'].includes(f)) return 98;
      if (!inp.clean && (f === 'cum_accrued' || f === 'cum_used')) return [103, 105, 107];
      return ROW[f];
    });
    if (changed && isClean) { cleanDiff++; Object.keys(a).forEach((f) => { if (Math.abs((a[f] ?? 0) - (o[f] ?? 0)) > 0.006) cleanFields[f] = (cleanFields[f] || 0) + 1; }); }
  });
  t.notes.push(`موظفون بدون أرقام مستوردة أو مرضية أو تعديلات (35): ${cleanDiff} فيهم فرق — الحقول: ${JSON.stringify(cleanFields)}`);
  return t;
}
