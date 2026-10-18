/* eslint-disable */
// @ts-nocheck
// Pure functions of ARIBA_HR_React/src/pages/finance/EosCalc.jsx (settle), verbatim.
import { isEG, resignFactor, leaveCum, rules } from './country';
import { num, r2, pd } from './finance-util';
import { duration } from './eos-react';

const LN = { m84: ['م.84', 'Art.84'], m74: ['م.74', 'Art.74'], m85: ['م.85', 'Art.85'], m75: ['م.75', 'Art.75'], m77: ['م.77', 'Art.77'], m80: ['م.80', 'Art.80'], m53: ['م.53', 'Art.53'], m74r: ['م.74(4)', 'Art.74(4)'], m74d: ['م.74(3)', 'Art.74(3)'] };
const REASONS = { m84: ['م.84 إنهاء الشركة', 'Art.84 employer'], m74: ['م.74 اتفاق', 'Art.74 mutual'], m85: ['م.85 استقالة', 'Art.85 resign'], m75: ['م.75 قسرية', 'Art.75 forced'], m77: ['م.77 تعسفي', 'Art.77 arbitrary'], m80: ['م.80 تأديبي', 'Art.80 disciplinary'], m53: ['م.53 تجربة', 'Art.53 probation'], m74r: ['م.74(4) تقاعد', 'Art.74(4) retire'], m74d: ['م.74(3) وفاة', 'Art.74(3) death'] };
/** حساب المخالصة — نفس معادلات sRun في النظام القديم */
export function settle(p) {
  const d1 = pd(p.start), d2 = pd(p.end), sal = num(p.sal); if (!d1 || !d2 || !sal || d2 < d1) return null;
  const eg = isEG(), dur = duration(d1, d2), ty = dur.total, r = p.reason;
  const y1 = Math.min(ty, 5), y2 = Math.max(0, ty - 5), e84 = r2((sal / 2) * y1 + sal * y2);
  let ef = 0, note = '';
  if (r === 'm84' || r === 'm74' || r === 'm74r' || r === 'm74d') { ef = e84; note = 'نصف شهر × 5 سنوات أولى + شهر × ما بعدها.|Half month × first 5 years + full month after.'; }
  else if (eg && r === 'm85') { ef = r2(e84 * resignFactor(ty)); note = 'استقالة: نسبة من المكافأة حسب مدة الخدمة.|Resignation: share of EOS by service length.'; }
  else if (r === 'm85' || r === 'm75') { if (ty < 2) { ef = 0; note = 'أقل من سنتين — لا تستحق.|Under 2 years — nothing due.'; } else if (ty < 5) { ef = r2(e84 / 3); note = 'ثلث م.84.|One third of Art.84.'; } else if (ty < 10) { ef = r2(e84 * 2 / 3); note = 'ثلثان م.84.|Two thirds of Art.84.'; } else { ef = e84; note = 'م.84 كاملة.|Full Art.84.'; } }
  else if (r === 'm77') { const c77 = eg ? Math.round(sal * rules().arbMonths * ty) : Math.max(Math.round(sal * 2), Math.round((sal / 30) * 15 * ty)); ef = r2(e84 + c77); note = 'تعويض + م.84.|Compensation + Art.84.'; }
  else if (r === 'm80' || r === 'm53') { ef = 0; note = 'لا مكافأة.|No award.'; }
  const ld = num(p.leaveD) || 21, lt = num(p.taken);
  const ldue = eg ? r2(leaveCum(d1, d2, null)) : r2(ty * ld), lrem = Math.max(0, r2(ldue - lt)), lcomp = r2((sal / 30) * lrem);
  const wd = num(p.wd), ad = num(p.ad), lmsf = wd > 0 && ad > 0 ? r2((sal / wd) * ad) : sal;
  const lexc = Math.max(0, r2(lt - ldue)), lded = r2((sal / 30) * lexc);
  const extT = p.extras.reduce((a, x) => a + num(x.v), 0);
  const dedT = p.deds.reduce((a, x) => { const v = num(x.v); if (!v) return a; return a + (x.t === 'days' ? r2((sal / (wd || 30)) * v) : v); }, 0);
  const total = Math.max(0, r2(ef + lcomp + lmsf + extT - dedT - lded));
  return { dur, ty, e84, ef, note, ldue, lrem, lcomp, lmsf, lexc, lded, extT, dedT, total, lawN: LN[r] };
}
