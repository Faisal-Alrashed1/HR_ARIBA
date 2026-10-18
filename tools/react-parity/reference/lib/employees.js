// From ARIBA_HR_React/src/lib/employees.js: addMonthsSafe (lines 13-22) and salaryPreview (lines 26-37), verbatim; data.js defaultExchangeRate (line 5).
import { calcIns } from '../engines/insurance.js';
export const defaultExchangeRate = (cur) => (cur === 'دولار' ? 3.755 : 1);
export function addMonthsSafe(dateStr, months) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime()) || !Number.isFinite(Number(months)) || Number(months) <= 0) return '';
  const m = Math.floor(Number(months)); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + m);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last)); d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function salaryPreview(f) {
  const g = (k) => parseFloat(f[k]) || 0;
  const sal = g('sal'), hou = g('hou'), tra = g('tra'), prj = g('prj'), oth = g('oth'), ext = g('extra'), ded = g('ded');
  const tot = sal + hou + tra + prj + oth + ext;
  const isSaudi = ['سعودي', 'سعودية'].includes(f.nat || '');
  const cur = f.currency || 'ريال سعودي'; const isSAR = cur === 'ريال سعودي';
  const exr = parseFloat(f.exchRate) || defaultExchangeRate(cur);
  const c = calcIns({ isSaudi, insSystem: f.insSystem || 'old', wpsType: f.wpsType || 'wps', dob: f.dob || '', salary: sal, housingAllowance: hou, nationality: f.nat || '', transportAllowance: tra, projectAllowance: prj, otherAllowance: oth, extraAllowance: ext, jobTitle: f.jt || '', empType: '' }, 31, 31);
  const eg = c.insOnly !== undefined;
  const net = Math.round((tot - c.empAmt - ded) * 100) / 100;
  return { tot, ins: eg ? c.insOnly : c.empAmt, insC: c.erAmt, tax: eg ? (c.taxAmt || 0) + (c.mfAmt || 0) : 0, eg, net, netSAR: isSAR ? net : Math.round(net * exr * 100) / 100, isSAR, cur, calc: c, isSaudi };
}
