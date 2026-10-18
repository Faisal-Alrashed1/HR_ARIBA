// محرك أرصدة الإجازات — منقول من الدوال leave* في النظام القديم (نفس المعادلات) لكن بدون DOM أو globals.
import { rt, perfGet } from './runtime.js';
import * as C from './country.js';
import { countLeaveWorkdays, countAnnualLeaveDays, isLeaveWorkday, isOfficialHoliday, ymd } from './holidays.js';

export const leaveDateValue = (l, key) => l[key] || l[(key === 'from' ? 'from_date' : key === 'to' ? 'to_date' : key)] || l.date || '';
export const leaveEmployeeId = (l) => String(l.empId ?? l.emp_id ?? l.employeeId ?? l.employee_id ?? '');
export const leaveTypeValue = (l) => l.type || l.leave_type || l.leaveType || 'annual';
const getLvs = () => rt.leaves || [];

export const leaveYearDates = (year) => { const y = Number(year) || new Date().getFullYear(); return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) }; };
export function leaveEmpStart(e) { const raw = e.contractJoin || e.joinDate || e.startDate; if (!raw) return null; const d = new Date(raw); return isNaN(d) ? null : d; }
export function leaveAnnual(e) { if (C.isEG()) return C.annualDays(e, new Date()); return Math.max(0, Number(e.leaveDaysContract || e.ldc || 21) || 21); }
export function leaveWorkingDaysInYear(year) { const y = Number(year) || new Date().getFullYear(); return perfGet('workdays|' + y, () => countLeaveWorkdays(new Date(y, 0, 1), new Date(y, 11, 31))); }

export function leaveAccruedForPeriod(e, year, toDate) {
  const y = Number(year), end0 = toDate instanceof Date ? new Date(toDate) : new Date(toDate || leaveYearDates(y).end);
  const key = 'accrued|' + String(e?.id ?? '') + '|' + y + '|' + (isNaN(end0) ? 'bad' : end0.toISOString().slice(0, 10));
  return perfGet(key, () => {
    const dates = leaveYearDates(y), annual = leaveAnnual(e), join = leaveEmpStart(e);
    if (join && join > dates.end) return 0;
    const start = join && join > dates.start ? new Date(join) : new Date(dates.start); let end = new Date(end0);
    if (end > dates.end) end = new Date(dates.end);
    if (end < start) return 0;
    const full = leaveWorkingDaysInYear(y);
    if (full <= 0) return 0;
    if (C.isEG()) return Math.max(0, C.accrued(e, start, end, full, countLeaveWorkdays));
    const method = rt.leaveAccrual || 'calendar';
    if (method === 'calendar') { // السنوي × (عدد الأيام التقويمية من بداية الاستحقاق حتى التاريخ ÷ أيام السنة)
      const d0 = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()), d1 = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
      const inYear = (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 864e5;
      return Math.min(annual, Math.max(0, annual * (((d1 - d0) / 864e5 + 1) / inYear)));
    }
    if (method === 'monthly') { // السنوي ÷ 12 لكل شهر، والشهر الجزئي بالتناسب
      let m = 0;
      for (let mo = 0; mo < 12; mo++) {
        const ms = new Date(y, mo, 1), me = new Date(y, mo + 1, 0), a = start > ms ? start : ms, b = end < me ? end : me;
        if (b >= a) m += (Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5) + 1) / me.getDate();
      }
      return Math.min(annual, Math.max(0, (annual / 12) * m));
    }
    const worked = countLeaveWorkdays(start, end);
    return Math.min(annual, Math.max(0, annual * (worked / full)));
  });
}
export const leaveStartYear = (e) => { const d = leaveEmpStart(e); return d ? d.getFullYear() : new Date().getFullYear(); };
export function leaveManualNet(e, year, toDate) {
  const y = Number(year); if (!Number.isFinite(y)) return 0;
  const end0 = toDate ? new Date(toDate) : leaveYearDates(y).end;
  const key = 'manual|' + String(e?.id ?? '') + '|' + y + '|' + (isNaN(end0) ? 'bad' : end0.toISOString().slice(0, 10));
  return perfGet(key, () => {
    const end = new Date(end0); end.setHours(23, 59, 59, 999); const eid = String(e?.id ?? '');
    return (rt.adjustments || []).filter((a) => String(a.empId ?? a.emp_id ?? '') === eid && String(a.date || a.createdAt || '').slice(0, 4) === String(y) && new Date(a.date || a.createdAt || 0) <= end).reduce((s, a) => s + (Number(a.delta) || 0), 0);
  });
}
export const leaveYearOverride = (e, year) => { const o = e && e.leaveYearOverrides && e.leaveYearOverrides[String(Number(year))]; return o && typeof o === 'object' ? o : null; };

// ── قطع الإجازة السنوية بإجازة أخرى ──
// لو اتعتمدت إجازة من الأنواع دي بتواريخ داخل إجازة سنوية معتمدة، أيام العمل المشتركة بتتشال من السنوية وترجع للرصيد.
// (العمل عن بعد والمهمة الخارجية والاستئذان مش منهم لأن الموظف فيهم شغال)
export const INTERRUPT_TYPES = ['sick', 'emergency', 'death', 'marriage', 'paternity', 'maternity', 'hajj', 'umrah', 'unpaid'];
const isApproved = (l) => String(l.status || '').toLowerCase() === 'approved';
const dayList = (from, to) => { const out = [], a = new Date(from), b = new Date(to); if (isNaN(a) || isNaN(b)) return out; a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) out.push(new Date(d)); return out; };
/** خريطة: تاريخ → نوع الإجازة المعتمدة اللي بتغطيه (غير السنوية) لموظف */
export function leaveCoverMap(eid, excludeId) {
  return perfGet('cover|' + eid + '|' + (excludeId || ''), () => {
    const m = new Map();
    getLvs().forEach((l) => {
      if (leaveEmployeeId(l) !== eid || !isApproved(l) || !INTERRUPT_TYPES.includes(leaveTypeValue(l)) || (excludeId && String(l.id) === String(excludeId))) return;
      const f = leaveDateValue(l, 'from'), t = leaveDateValue(l, 'to') || f;
      dayList(f, t).forEach((d) => { const k = ymd(d); if (!m.has(k)) m.set(k, leaveTypeValue(l)); });
    });
    return m;
  });
}
/** أيام الإجازة السنوية الفعلية بعد استبعاد الأيام المغطاة بإجازات أخرى. بيرجّع {days, refunded, byType} */
export function annualLeaveNetDays(l, upTo) {
  const eid = leaveEmployeeId(l), from = leaveDateValue(l, 'from'), to0 = leaveDateValue(l, 'to') || from;
  let to = new Date(to0); if (upTo && to > upTo) to = new Date(upTo);
  const cover = leaveCoverMap(eid);
  let days = 0, refunded = 0; const byType = {};
  dayList(from, to).forEach((d) => {
    if (!isLeaveWorkday(d) || isOfficialHoliday(d)) return;
    const c = cover.get(ymd(d));
    if (c) { refunded++; byType[c] = (byType[c] || 0) + 1; } else days++;
  });
  return { days, refunded, byType };
}
/** الإجازات السنوية المعتمدة لموظف في سنة اللي اتقطعت بإجازات أخرى (للعرض) */
export function leaveInterruptions(e, year) {
  const eid = String(e?.id ?? ''), y = Number(year);
  return getLvs().filter((l) => leaveEmployeeId(l) === eid && leaveTypeValue(l) === 'annual' && isApproved(l) && new Date(leaveDateValue(l, 'from')).getFullYear() === y)
    .map((l) => ({ leave: l, ...annualLeaveNetDays(l) })).filter((x) => x.refunded > 0);
}
/** لو الفترة دي (لإجازة غير سنوية) بتقع جوه إجازة سنوية معتمدة: عدد أيام العمل اللي هترجع للرصيد */
export function overlapWithAnnual(eid, type, from, to) {
  if (!INTERRUPT_TYPES.includes(type) || !from || !to) return { days: 0, leaves: [] };
  const want = new Set(dayList(from, to).filter((d) => isLeaveWorkday(d) && !isOfficialHoliday(d)).map(ymd));
  const cover = leaveCoverMap(String(eid));
  let days = 0; const leaves = [];
  getLvs().forEach((l) => {
    if (leaveEmployeeId(l) !== String(eid) || leaveTypeValue(l) !== 'annual' || !isApproved(l)) return;
    let n = 0; dayList(leaveDateValue(l, 'from'), leaveDateValue(l, 'to') || leaveDateValue(l, 'from')).forEach((d) => { const k = ymd(d); if (want.has(k) && !cover.has(k)) n++; });
    if (n) { days += n; leaves.push(l); }
  });
  return { days, leaves };
}

export function leaveDefaultUsed(e, year, toDate) {
  const y = Number(year); if (!Number.isFinite(y)) return 0;
  const end0 = toDate instanceof Date ? new Date(toDate) : new Date(toDate || leaveYearDates(y).end);
  const key = 'used|' + String(e?.id ?? '') + '|' + y + '|' + (isNaN(end0) ? 'bad' : end0.toISOString().slice(0, 10));
  return perfGet(key, () => {
    const end = new Date(end0); end.setHours(23, 59, 59, 999); const eid = String(e?.id ?? '');
    const ov = e && e.leaveYearOverrides && e.leaveYearOverrides[String(y)];
    const snap = ov && ov.asOf ? new Date(ov.asOf) : null;
    const requestDays = getLvs().filter((l) => leaveEmployeeId(l) === eid && leaveTypeValue(l) === 'annual' && String(l.status || '').toLowerCase() === 'approved').reduce((sum, l) => {
      const from = new Date(leaveDateValue(l, 'from') || ''), to = new Date(leaveDateValue(l, 'to') || from);
      if (isNaN(from) || isNaN(to) || from.getFullYear() !== y || from > end) return sum;
      if (snap && from < snap) return sum;
      return sum + annualLeaveNetDays(l, to > end ? end : null).days; // بعد استبعاد الأيام المغطاة بإجازة مرضية/أخرى
    }, 0);
    const baseline = (ov && ov.asOf && ov.used !== undefined) ? Math.max(0, Number(ov.used) || 0) : Math.max(Number(e && e['leaveUsed' + y] || 0) || 0, Number(e && e.leaveHistoryByYear && e.leaveHistoryByYear[String(y)] || 0) || 0, Number((ov && ov.used) || 0) || 0);
    return baseline + requestDays;
  });
}
export function leaveCarryCap() { const c = rt.leaveCarry && typeof rt.leaveCarry === 'object' ? rt.leaveCarry : { enabled: true, days: 10 }; return c.enabled ? Math.max(0, Number(c.days) || 0) : Infinity; }
export function leaveEosOf(close) { const cap = leaveCarryCap(); return cap === Infinity ? 0 : Math.max(0, (Number(close) || 0) - cap); }
export function leaveCarryForward(e, year) {
  const y = Number(year) || new Date().getFullYear(), o = leaveYearOverride(e, y);
  if (o && o.carry !== undefined) return Math.max(0, Number(o.carry) || 0);
  if (y === leaveStartYear(e)) return 0;
  const po = leaveYearOverride(e, y - 1);
  if (po && po.carryNext !== undefined) return Math.max(0, Number(po.carryNext) || 0);
  return Math.min(leaveCarryCap(), Math.max(0, leaveYearClosing(e, y - 1)));
}
export function leaveUsedFor(e, y, end) { const o = leaveYearOverride(e, y), cy = new Date().getFullYear(); if (o && o.used !== undefined && y < cy && !o.asOf) return Math.max(0, Number(o.used) || 0); return leaveDefaultUsed(e, y, end); }
export function leaveUsedDelta(e, y, end) { const o = leaveYearOverride(e, y); if (!o || o.used === undefined) return 0; return Math.max(0, leaveUsedFor(e, y, end) - (Number(o.used) || 0)); }
export function leaveYearLedger(e, year) {
  const y = Number(year), key = 'ledger|' + String(e?.id ?? '') + '|' + y;
  return perfGet(key, () => {
    const dates = leaveYearDates(y), o = leaveYearOverride(e, y), opening = leaveCarryForward(e, y);
    const entitlement = o && o.entitlement !== undefined ? Math.max(0, Number(o.entitlement) || 0) : leaveAccruedForPeriod(e, y, dates.end);
    const used = leaveUsedFor(e, y, dates.end);
    const adjustment = o && o.adjustment !== undefined ? Number(o.adjustment) || 0 : leaveManualNet(e, y);
    const close = o && o.yearEnd !== undefined && o.carry !== undefined ? Math.max(0, (Number(o.yearEnd) || 0) - leaveUsedDelta(e, y, dates.end)) : Math.max(0, opening + entitlement + adjustment - used);
    const carry = (o && o.carryNext !== undefined) ? Math.max(0, Number(o.carryNext) || 0) : Math.min(leaveCarryCap(), Math.max(0, close));
    const eos = (o && o.eos !== undefined) ? Math.max(0, Number(o.eos) || 0) : leaveEosOf(close);
    return { year: y, opening, entitlement, used, adjustment, close, carry, eos, override: o };
  });
}
export function leaveCurrentLedger(e) {
  const y = new Date().getFullYear(), o = leaveYearOverride(e, y), now = new Date();
  if (o && o.current !== undefined) {
    let base = Math.max(0, (Number(o.current) || 0) - leaveUsedDelta(e, y, now));
    const ad = o.currentAsOf || o.updatedAt, d = ad ? new Date(ad) : null;
    if (d && !isNaN(d) && d.getFullYear() === y && d < now) base += Math.max(0, leaveAccruedForPeriod(e, y, now) - leaveAccruedForPeriod(e, y, d));
    return Math.max(0, base);
  }
  return Math.max(0, leaveCarryForward(e, y) + leaveAccruedForPeriod(e, y, now) + leaveManualNet(e, y, now) - leaveDefaultUsed(e, y, now));
}
export function leaveYearClosing(e, year) {
  const y = Number(year), o = leaveYearOverride(e, y), now = new Date();
  if (y < leaveStartYear(e)) return 0;
  if (o && o.yearEnd !== undefined && o.carry !== undefined) return Math.max(0, (Number(o.yearEnd) || 0) - leaveUsedDelta(e, y, leaveYearDates(y).end));
  if (y === now.getFullYear()) return Math.max(0, leaveCarryForward(e, y) + leaveAccruedForPeriod(e, y, leaveYearDates(y).end) + leaveManualNet(e, y) - leaveDefaultUsed(e, y, leaveYearDates(y).end));
  return leaveYearLedger(e, y).close;
}
export function leaveYearExcess(e, year) { const o = leaveYearOverride(e, year); if (o && o.eos !== undefined) return Math.max(0, Number(o.eos) || 0); return leaveEosOf(leaveYearClosing(e, year)); }
export function leaveAccumulatedEos(e, endYear) { const start = leaveStartYear(e), end = Number(endYear) || new Date().getFullYear(); let total = 0; /* مجموع فائض كل سنة (فوق حد الترحيل) من أول سنة خدمة — بدون إضافة الحقل القديم leaveEosExcess لأنه كان يُحسب مرتين */ for (let y = start; y < end; y++) total += leaveYearExcess(e, y); return Math.max(0, total); }
export function leaveCumulativeAccruedToToday(e) { const start = leaveStartYear(e), now = new Date(), cy = now.getFullYear(); let t = 0; for (let y = start; y <= cy; y++) { const o = leaveYearOverride(e, y); t += o && o.entitlement !== undefined && y < cy ? Math.max(0, Number(o.entitlement) || 0) : leaveAccruedForPeriod(e, y, y === cy ? now : leaveYearDates(y).end); } return t; }
export function leaveCumulativeUsedToToday(e) { const start = leaveStartYear(e), now = new Date(), cy = now.getFullYear(); let t = 0; for (let y = start; y <= cy; y++) t += leaveUsedFor(e, y, y === cy ? now : leaveYearDates(y).end); return t; }
export function leaveCumulativeManualToToday(e) { const start = leaveStartYear(e), now = new Date(), cy = now.getFullYear(); let t = 0; for (let y = start; y <= cy; y++) { const o = leaveYearOverride(e, y); t += o && o.adjustment !== undefined ? Number(o.adjustment) || 0 : leaveManualNet(e, y, y === cy ? now : leaveYearDates(y).end); } return t; }
export const leaveCumulativeBalanceToToday = (e) => Math.max(0, leaveCumulativeAccruedToToday(e) - leaveCumulativeUsedToToday(e) + leaveCumulativeManualToToday(e));
export const leaveProjectedYearEnd = (e, year) => leaveYearClosing(e, Number(year) || new Date().getFullYear());
export const leaveCurrentBalance = (e) => Math.max(0, leaveCurrentLedger(e));
export const leaveRequestDays = (l) => { const type = leaveTypeValue(l), from = leaveDateValue(l, 'from'), to = leaveDateValue(l, 'to'); if (type === 'annual' && from && to) return countAnnualLeaveDays(from, to); return Number(l.days) || 0; };
