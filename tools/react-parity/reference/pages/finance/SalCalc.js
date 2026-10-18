// Pure functions from ARIBA_HR_React/src/pages/finance/SalCalc.jsx (lines 11-34, verbatim; ratesFor exported for the parity run).
import { rates as payRates } from '../../engines/payrollRows.js';
import { autoRate } from '../../engines/insurance.js';
/* نفس معادلات الإكسيل: الأجر الخاضع = الأساسي + السكن، السقف، الصافي = الإجمالي − التأمينات */
export function calc(mode, p, T = (a) => a) {
  const hp = p.h || 0, tp = p.t || 0, hA = p.hA || 0, tA = p.tA || 0, sau = !!p.sau, rate = sau ? p.rate : 0, cap = p.cap || 45000;
  const pp = p.prType === 'pct' ? (p.pr || 0) : 0, pA = p.prType === 'amt' ? (p.pr || 0) : 0;
  const k = 1 + hp + tp + pp, fixed = hA + tA + pA + (p.O || 0); let B = 0, other = p.O || 0, warn = '';
  const baseOf = (b) => b * (1 + hp) + hA, insFor = (b) => (sau ? Math.min(baseOf(b), cap) * rate : 0);
  if (mode === 'gross') B = (p.G - fixed) / k;
  else if (mode === 'net') {
    if (!sau || !rate) B = (p.N - fixed) / k;
    else { const b1 = (p.N - fixed + rate * hA) / (k - rate * (1 + hp)); if (baseOf(b1) <= cap) B = b1; else { B = (p.N - fixed + rate * cap) / k; warn = T('الأجر الخاضع وصل للحد الأقصى (' + cap + ') فالتأمينات ثابتة', 'The insurable wage reached the cap (' + cap + '), so the deduction is fixed'); } }
  } else B = p.B;
  if ((mode === 'gross' || mode === 'net') && B < 0) warn = T('البدلات الثابتة أكبر من المبلغ المدخل — راجع الأرقام', 'The fixed allowances exceed the entered amount — check the figures');
  const housing = B * hp + hA, transport = B * tp + tA, project = B * pp + pA;
  if (mode === 'target') { other = p.N + insFor(B) - (B + housing + transport + project); if (other < 0) warn = T('الصافي المطلوب أقل من الراتب الأساسي والبدلات الحالية — البدل المطلوب سالب', 'The target net is below the basic and allowances — the required allowance is negative'); }
  const gross = B + housing + transport + project + other, ins = insFor(B), net = gross - ins, base = Math.min(baseOf(B), cap);
  return { basic: B, housing, transport, project, other, gross, ins, net, base, rate, warn };
}
export function ratesFor(date, sys, a55, src) {
  let R = null; try { R = payRates(date); } catch { /* ignore */ }
  const cap = (R && R.cap) || 45000;
  if ((src || 'auto') === 'auto' && !a55) { const A = autoRate(date, sys); return { rate: A.emp / 100, coRate: A.er / 100, cap, src: 'auto', from: A.from, n: A.n, nonSaudiEr: R ? R.nonSaudiEr : 0.02 }; }
  if (!R) return { rate: sys === 'new' ? 0.1075 : 0.0975, coRate: sys === 'new' ? 0.1275 : 0.1175, cap: 45000, src: 'default', nonSaudiEr: 0.02 };
  return { rate: sys === 'new' ? (a55 ? R.matchEmp55 : R.matchEmp) : (a55 ? R.noMatchEmp55 : R.noMatchEmp), cap, coRate: sys === 'new' ? (a55 ? R.matchEr55 : R.matchEr) : (a55 ? R.noMatchEr55 : R.noMatchEr), src: 'settings', nonSaudiEr: R.nonSaudiEr };
}
