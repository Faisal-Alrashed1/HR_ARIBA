// رصيد الإجازة في تطبيق الموظف = نفس رقم برنامج الموارد البشرية بالظبط.
// برنامج الموارد بيحفظ الرصيد المحسوب + تاريخه (leaveSnapshotAt) + معطيات المعادلة (leaveCalc)،
// وهنا بنكمّل الاستحقاق من التاريخ ده لحد النهارده بنفس المحرك (engines/leave.js) ونفس الطريقة والإجازات الرسمية.
import { setRuntime } from '../engines/runtime.js';
import * as L from '../engines/leave.js';

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/** يرجّع الفرق في الاستحقاق من تاريخ آخر حساب في برنامج الموارد لحد النهارده (0 لو مش متاح) */
export function accrualSinceSnapshot(e, holidays, now = new Date()) {
  const calc = e && e.leaveCalc, at = e && e.leaveSnapshotAt;
  const join = e && (e.contractJoin || e.cj || e.joinDate);
  if (!calc || !at || !join) return 0;
  const a = new Date(String(at).slice(0, 10) + 'T12:00:00');
  if (isNaN(a) || a.getFullYear() !== now.getFullYear() || a >= now) return 0; // سنة جديدة: نستنى برنامج الموارد يقفل السنة ويرحّل
  setRuntime({
    leaveAccrual: calc.method || 'calendar', country: calc.country || 'SA', egRules: calc.egRules || null,
    holidays: (holidays || []).map((h) => ({ date: h.date, days: Number(h.days) || 1, recurring: !!h.recurring })),
  });
  const emp = { id: String(e.id), contractJoin: join, leaveDaysContract: calc.annual, dob: e.dob };
  const y = now.getFullYear();
  const d = L.leaveAccruedForPeriod(emp, y, now) - L.leaveAccruedForPeriod(emp, y, a);
  return d > 0 ? d : 0;
}

/** يطبّق الفرق على الأرقام اللي بتزيد مع الوقت */
export function applyLive(me, e, holidays) {
  let d = 0; try { d = accrualSinceSnapshot(e, holidays); } catch { d = 0; }
  if (!d) return me;
  return { ...me, leave_bal: r2(me.leave_bal + d), leaveTotalSinceStart: r2(me.leaveTotalSinceStart + d), leaveAvailableSinceStart: r2(me.leaveAvailableSinceStart + d) };
}
