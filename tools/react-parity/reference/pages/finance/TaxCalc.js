// ARIBA_HR_React/src/pages/finance/TaxCalc.jsx lines 11 and 13: the component's two formula lines, wrapped in a function (same arithmetic).
import { num } from '../../lib/finance.js';
export function vat(rate, inc, exc) {
  const r = num(rate) / 100;
  const incV = num(inc), ex1 = incV / (1 + r), tx1 = ex1 * r, ex2 = num(exc), tx2 = ex2 * r;
  return { ex1, tx1, ex2, tx2 };
}
