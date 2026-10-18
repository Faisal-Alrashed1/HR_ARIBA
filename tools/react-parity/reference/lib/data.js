// From ARIBA_HR_React/src/lib/data.js: normalizeEmployee (lines 7-44), verbatim.
export const defaultExchangeRate = (cur) => (cur === 'دولار' ? 3.755 : 1);
export function normalizeEmployee(raw) {
  const e = { ...raw };
  e.id = String(e.id ?? e.employee_id ?? '');
  if (e.empNo === undefined || e.empNo === null || e.empNo === '') e.empNo = String(e.id || '');
  if (!e.insSystem) e.insSystem = e.isSaudi ? 'old' : 'expat';
  if (!e.wpsType || e.wpsType === 'wps') {
    const et = (e.empType || '').toLowerCase();
    if (et.includes('تمهير') || et.includes('tamheer')) e.wpsType = 'tamheer';
    else if (et.includes('متدرب') || et.includes('تدريب') || et.includes('trainee')) e.wpsType = 'trainee';
    else e.wpsType = 'wps';
  }
  if (!e.currency) e.currency = 'ريال سعودي';
  if (!e.payMethod) e.payMethod = 'مدد';
  if (e.extraAllowance === undefined) e.extraAllowance = 0;
  // الراتب بالعملة المحلية هو الأصل
  let rate = (e.currency === 'ريال سعودي') ? 1 : (Number(e.exchRate) > 0 ? Number(e.exchRate) : defaultExchangeRate(e.currency));
  if (!rate || rate <= 0) rate = defaultExchangeRate(e.currency);
  const b = Number(e.salary) || 0, h = Number(e.housingAllowance) || 0, t = Number(e.transportAllowance) || 0, p = Number(e.projectAllowance) || 0, o = Number(e.otherAllowance) || 0;
  if (!(Number(e.salaryTotal) > 0) && (b || h || t || p || o)) e.salaryTotal = Math.round((b + h + t + p + o) * 100) / 100;
  const gross = Number(e.salaryTotal) || 0;
  let rawNet = Number(e.netSalaryLocal);
  if (!(rawNet > 0)) rawNet = Number(e.netSalary) || 0;
  const ins = Number(e.insuranceSub) || 0, ded = Number(e.otherDeductions) || 0;
  if (e.currency !== 'ريال سعودي' && gross > 0) {
    const ratio = rawNet / gross;
    if (rawNet > gross * 2 && Math.abs(ratio - rate) < 0.05) rawNet = rawNet / rate;
    else if (rawNet > gross * 20) rawNet = Math.max(0, gross - ins - ded);
  }
  if (!(rawNet > 0) && gross > 0) rawNet = Math.max(0, gross - ins - ded);
  e.exchRate = rate; e.netSalaryLocal = rawNet; e.netSalary = rawNet; e.netSalarySAR = rawNet * rate;
  e.isTerminated = !!e.isTerminated;
  // تواريخ مشتقة تُحسب عند كل تحميل (زي refreshComputedDates في الأصل)
  const dl = (d) => { if (!d) return undefined; const x = new Date(String(d).slice(0, 10) + 'T00:00:00'), t = new Date(); if (isNaN(x)) return undefined; t.setHours(0, 0, 0, 0); return Math.round((x - t) / 86400000); };
  const iq = dl(e.iqamaExpiry), ce = dl(e.contractEnd), pp = dl(e.passportExpiry), ins2 = dl(e.insuranceExpiry);
  if (iq !== undefined) e.iqamaDaysLeft = iq; if (ce !== undefined) e.contractDaysLeft = ce; if (pp !== undefined) e.passportDaysLeft = pp; if (ins2 !== undefined) e.insuranceDaysLeft = ins2;
  if (e.contractJoin) { const s0 = new Date(String(e.contractJoin).slice(0, 10) + 'T00:00:00'), en0 = e.isTerminated && e.lastDay ? new Date(String(e.lastDay).slice(0, 10) + 'T00:00:00') : new Date(); if (!isNaN(s0) && !isNaN(en0)) e.yearsOfService = Math.round(((en0 - s0) / (365.25 * 86400000)) * 100) / 100; }
  return e;
}
