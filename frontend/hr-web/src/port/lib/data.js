// تحميل وتطبيع بيانات السحابة (المصدر الوحيد للحقيقة) — يحاكي getEmps() + نماذج الإجازات في النظام القديم
import { normSchedule } from './schedule.js';
import { rpc, getSetting, setSetting } from './api.js';
import { setListsCache } from './masterLists.js';

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

export async function fetchEmployees() {
  const d = await rpc('ariba_staff_employees');
  const rows = Array.isArray(d && d.employees) ? d.employees : [];
  const by = new Map();
  rows.forEach((x) => {
    const id = String(x.id || x.employee_id || ''); if (!id) return;
    const cloud = { ...(x.data && typeof x.data === 'object' ? x.data : {}), ...x };
    by.set(id, normalizeEmployee({
      ...cloud, id, empNo: cloud.empNo || cloud.emp_no || id,
      nameAr: cloud.nameAr || cloud.name_ar || '', nameEn: cloud.nameEn || cloud.name_en || '',
      dept: cloud.dept || cloud.department || '', jobTitle: cloud.jobTitle || cloud.job_title || '',
      iqamaNo: cloud.iqamaNo || cloud.iqama_no || '', contractJoin: cloud.contractJoin || cloud.joinDate || cloud.join_date || '',
      managerId: cloud.managerId || cloud.manager_id || '', isTerminated: cloud.isTerminated !== undefined ? !!cloud.isTerminated : !cloud.active,
    }));
  });
  return [...by.values()];
}

export function normalizeLeave(c) {
  return {
    id: String(c.id), empId: String(c.empId || ''), type: c.type || 'annual',
    from: String(c.from || '').slice(0, 10), to: String(c.to || c.from || '').slice(0, 10),
    days: Number(c.days) || 0, status: String(c.status || 'pending').toLowerCase(), notes: c.notes || '',
    workflowRequestId: c.hr ? null : (c.workflowRequestId || String(c.id)), workflowManaged: !c.hr,
    ts: Date.parse(c.updated_at || c.created_at || '') || 0, hr: !!c.hr,
  };
}
export async function fetchLeaves() {
  const r = await rpc('ariba_hr_leaves_since', { p_since: null });
  return (r && Array.isArray(r.leaves) ? r.leaves : []).map(normalizeLeave).sort((a, b) => b.ts - a.ts);
}
export async function fetchHolidays() {
  const rows = await rpc('ariba_staff_holidays');
  return (Array.isArray(rows) ? rows : []).map((x) => ({ id: x.id, name: x.name, nameEn: x.nameEn || x.name, date: x.date, days: Number(x.days) || 1, recurring: !!x.recurring }));
}
export async function fetchLocations() { const r = await rpc('ariba_hr_locations'); return Array.isArray(r) ? r : (r && r.locations) || []; }

export const SETTING_KEYS = { brand: 'brand_colors', logo: 'company_logo', names: 'company_names', signer: 'hr_signer', insurance: 'insurance_rules', carry: 'leave_carry', accrual: 'leave_accrual_method', letterhead: 'letterhead', punch: 'punch_watermark', country: 'country_system', schedule: 'attendance_schedule', lists: 'master_lists' };
export async function fetchSettings() {
  const out = {};
  await Promise.all(Object.entries(SETTING_KEYS).map(async ([k, key]) => { try { out[k] = await getSetting(key); } catch { out[k] = null; } }));
  setListsCache(out.lists); // ADAPTED: master lists from the server (decision 3)
  return out;
}
export { getSetting, setSetting };

// تحويل الإعدادات لقيم تغذي محرك المعادلات
export function runtimePatchFromSettings(s) {
  const patch = {};
  if (s.carry && typeof s.carry === 'object') patch.leaveCarry = { enabled: s.carry.enabled !== false, days: Number(s.carry.days) || 0 };
  if (s.accrual && typeof s.accrual === 'object' && ['calendar', 'workdays', 'monthly'].includes(s.accrual.method)) patch.leaveAccrual = s.accrual.method;
  if (s.insurance && Array.isArray(s.insurance.effectiveRules)) patch.insRules = s.insurance;
  patch.schedule = normSchedule(s.schedule);
  if (s.country && typeof s.country === 'object') { patch.country = s.country.mode === 'EG' ? 'EG' : 'SA'; patch.egRules = s.country.rules || null; }
  return patch;
}
