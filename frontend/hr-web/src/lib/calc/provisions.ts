/* eslint-disable */
// @ts-nocheck
// provFor of ARIBA_HR_React/src/pages/finance/Prov.jsx (EOS + leave provision at the month end), verbatim;
// usedThrough reads the server figure (payroll-rows USED_CACHE).
import { PAYX as X } from './payx';
import { usedThrough, rates } from './payroll-rows';
import { noEos } from './empkind';
import { leaveAnnual } from './leave-annual';
import { num, p2, pd } from './finance-util';
const current = (e) => e && !e.isHourly && !e.isTerminated && !e.term && e.active !== false;
/** المخصص لموظف عند آخر يوم في الشهر: لو انتهت خدمته اليوم (مكافأة كاملة) + قيمة رصيد الإجازة */
export function provFor(e, end, reasonKey) {
  const join = pd(e.contractJoin || e.join_date); if (!join || join > end) return { eos: 0, leaveDays: 0, leave: 0, svc: '', base: 0, noEos: false, skip: true };
  const sal = num(e.salary || e.sal), hou = num(e.housingAllowance || e.hou), tra = num(e.transportAllowance || e.tra); let used = 0;
  try { used = usedThrough(e, end); } catch { /* ignore */ }
  const days = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  const o = X.compute({ basic: sal, houRate: sal > 0 ? hou / sal : 0, traRate: sal > 0 ? tra / sal : 0, prj: num(e.projectAllowance), oth: num(e.otherAllowance), days, work: days, insDays: days, fx: num(e.exchRate) || 1, insStatus: 'غير خاضع', saudi: !!e.isSaudi, trainee: false, nat: e.nationality, employer: e.employer, dob: e.dob,
    join: String(e.contractJoin || e.join_date || '').slice(0, 10), lastDay: end.getFullYear() + '-' + p2(end.getMonth() + 1) + '-' + p2(end.getDate()), reason: reasonKey, leaveDays: leaveAnnual(e), used: null, usedAuto: used, noIns: true, noEos: noEos(e), asOf: end, rates: rates(end) });
  const ne = noEos(e), daily = num(o.T) / 30;
  return { eos: ne ? 0 : num(o.AK), leaveDays: Math.max(0, num(o.P)), leave: Math.max(0, num(o.P)) * daily, svc: (o.AD || 0) + 'y ' + (o.AE || 0) + 'm ' + (o.AF || 0) + 'd', base: sal + hou, noEos: ne, skip: false, daily };
}
