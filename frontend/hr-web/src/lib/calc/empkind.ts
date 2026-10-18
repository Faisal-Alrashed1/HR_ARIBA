/* eslint-disable */
// @ts-nocheck
// Copied verbatim from ARIBA_HR_React/src/engines/empkind.js (kindOf / noEos / insExempt).
// نوع الموظف المشتق (استشاري / تمهير / تدريب / غير خاضع) — منقول من ariba-v130-insurance-exempt و v135
export function kindOf(e) {
  if (!e) return '';
  const w = String(e.wpsType || e.wps || 'wps');
  if (w === 'consultant' || w === 'tamheer' || w === 'trainee') return w;
  if (w !== 'wps') return w;
  const job = String(e.jobTitle || e.job || e.jt || ''), dep = String(e.department || e.dept || e.dep || ''), emp = String(e.employer || e.em || ''), typ = String(e.empType || ''), cat = String(e.excelCategory || '');
  if (/تمهير/.test(emp) || /تمهير/.test(job) || /تمهير/.test(dep)) return 'tamheer';
  if (/استشاري|مستشار|استشاريه|استشارية/.test(job) || cat === 'consultant' || /مهمة محددة/.test(typ)) return 'consultant';
  if (/متدرب|تدريب|trainee|intern/i.test(job) || /^\s*تدريب\s*$/.test(dep) || /تدريب/.test(emp) || /متدرب/.test(typ)) return 'trainee';
  return '';
}
/** لا مكافأة نهاية خدمة (استشاري/تمهير/تدريب) */
export const noEos = (e) => !!kindOf(e);
/** إعفاء من التأمينات: النوع المشتق أو insSystem === 'exempt' */
export const insExempt = (e) => !!(e && e.insSystem === 'exempt') || noEos(e);
