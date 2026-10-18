/* eslint-disable */
// @ts-nocheck
// calcFor of ARIBA_HR_React/src/pages/finance/InsCalc.jsx (GOSI per employee for a month, the monthly GOSI file), verbatim.
import { PAYX as X } from './payx';
import { insDefault, rates } from './payroll-rows';
import { insExempt } from './empkind';
import { num, pd, isTerm, lastDayOf } from './finance-util';
const insDaysFor = (e, m) => {
  const jn = pd(e.contractJoin || e.join_date), ld = isTerm(e) ? lastDayOf(e) : null; let st = 1, en = m.days;
  if (jn && jn > m.end) return 0; if (jn && jn >= m.start) st = jn.getDate();
  if (ld) { if (ld < m.start) return 0; if (ld <= m.end) en = ld.getDate(); }
  return Math.max(0, Math.min(m.days, en - st + 1));
};
export function calcFor(e, m, ovr) {
  const sal = num(e.salary || e.sal), hou = num(e.housingAllowance || e.hou), status = insDefault(e);
  const ins = (ovr === undefined || ovr === null || ovr === '') ? insDaysFor(e, m) : Math.max(0, Math.min(m.days, num(ovr)));
  const o = X.compute({ basic: sal, houRate: sal > 0 ? hou / sal : 0, traRate: 0, days: m.days, work: ins, insDays: ins, insStatus: status, saudi: !!e.isSaudi || X.isSaudiNat(e.nationality), nat: e.nationality, employer: e.employer, dob: e.dob, asOf: m.end, trainee: X.isTrainee(e.employer), noIns: !!insExempt(e), rates: rates(m.end) });
  const emp = num(o.AO), co = num(o.AR);
  return { status, days: ins, base: num(o.AQ), emp, co, total: emp + co };
}
