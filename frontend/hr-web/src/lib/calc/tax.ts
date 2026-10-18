/* eslint-disable */
// @ts-nocheck
// ARIBA_HR_React/src/pages/finance/TaxCalc.jsx: the VAT formula lines, verbatim.
import { num } from './finance-util';
export function vat(rate, inc, exc) {
  const r = num(rate) / 100;
  const incV = num(inc), ex1 = incV / (1 + r), tx1 = ex1 * r, ex2 = num(exc), tx2 = ex2 * r;
  return { ex1, tx1, ex2, tx2 };
}
