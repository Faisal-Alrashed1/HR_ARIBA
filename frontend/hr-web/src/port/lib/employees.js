import { logEmployeeSave } from './audit.js';
// عمليات الموظفين على السحابة (Supabase) — المصدر الوحيد للحقيقة
import { rpc } from './api.js';
import { defaultExchangeRate } from './data.js';
import { calcIns } from '../engines/insurance.js';
import { tod } from './util.js';

export const EMPLOYERS = ['اريبا', 'الجيوميكانية', 'أوبتيموم', 'دار التميز', 'أمانة الرياض'];
export const NATS = ['سعودي', 'سعودية', 'مصري', 'مصرية', 'أردني', 'يمني', 'سوري', 'تونسي', 'باكستاني', 'فلبيني', 'سوداني', 'أخرى'];
export const DEPTS = ['التشغيل', 'الاستشارات', 'الخدمات اللوجيستية', 'المالية', 'التسويق', 'الموارد البشرية', 'تدريب', 'أخرى'];
export const salaryUnit = (e) => { const c = (e && e.currency) || 'ريال سعودي'; return c === 'دولار' ? 'USD' : c === 'يورو' ? 'EUR' : c === 'جنيه مصري' ? 'EGP' : 'ر.س'; };

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
export const dl = (d) => (!d ? 9999 : Math.round((new Date(d) - new Date(tod())) / 86400000));

/** حساب بطاقة الراتب/التأمين اللحظية في نموذج الموظف (cSP) */
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

export const emptyForm = () => ({
  na: '', ne: '', empNo: '', em: '', nat: 'سعودي', dep: 'التشغيل', jt: '', dob: '', mb: '', ml: '', photoData: '', bk: '', ib: '', sp: '', rel: 'مسلم', managerId: '', notes: '',
  iq: '', iqe: '', pn: '', ppe: '', ic: '', icl: '', icard: '', ie: '',
  contractNature: 'fixed', ct: '', dur: '', cj: '', ce: '', ldc: 21,
  sal: 0, hou: 0, tra: 0, prj: 0, oth: 0, ded: 0, extra: 0, currency: 'ريال سعودي', exchRate: 1, insSystem: 'old', wpsType: 'wps',
});
export function formFromEmployee(e) {
  return {
    ...emptyForm(), na: e.nameAr || '', ne: e.nameEn || '', empNo: e.empNo || '', em: e.employer || '', nat: e.nationality || 'سعودي', dep: e.dept || 'التشغيل', jt: e.jobTitle || '', dob: e.dob || '',
    mb: e.mobile || '', ml: e.email || '', photoData: '', bk: e.bank || '', ib: e.iban || '', sp: e.sponsor || '', rel: e.religion || 'مسلم', managerId: e.managerId || '', notes: e.notes || '',
    iq: e.iqamaNo || '', iqe: e.iqamaExpiry || '', pn: e.passportNo || '', ppe: e.passportExpiry || '', ic: e.insuranceCo || '', icl: e.insuranceClass || '', icard: e.insuranceCard || '', ie: e.insuranceExpiry || '',
    contractNature: e.contractNature || ((e.contractDuration || e.contractEnd) ? 'fixed' : 'indefinite'), ct: e.contractType || '', dur: e.contractDuration || '', cj: e.contractJoin || '', ce: e.contractEnd || '', ldc: e.leaveDaysContract || 21,
    sal: e.salary || 0, hou: e.housingAllowance || 0, tra: e.transportAllowance || 0, prj: e.projectAllowance || 0, oth: e.otherAllowance || 0, ded: e.otherDeductions || 0, extra: e.extraAllowance || 0,
    currency: e.currency || 'ريال سعودي', exchRate: e.exchRate || defaultExchangeRate(e.currency || 'ريال سعودي'), insSystem: e.insSystem || 'old', wpsType: e.wpsType || 'wps',
  };
}

/** يُرجع {error} أو {emp} — نفس قواعد التحقق في sEmp القديمة، بدون تخزين أي كلمة مرور */
export function buildEmployee(f, existing, all) {
  const norm = (v) => String(v || '').trim().toLowerCase();
  const nature = f.contractNature || 'fixed';
  const dur = nature === 'fixed' ? (parseInt(f.dur, 10) || 0) : 0;
  const contractEnd = nature === 'fixed' ? addMonthsSafe(f.cj, dur) : (f.ce || '');
  if (nature === 'fixed' && (!f.cj || !dur || !contractEnd)) return { error: 'يرجى إدخال تاريخ المباشرة ومدة العقد المحددة.' };
  const sal = parseFloat(f.sal) || 0, hou = parseFloat(f.hou) || 0, tra = parseFloat(f.tra) || 0, prj = parseFloat(f.prj) || 0, oth = parseFloat(f.oth) || 0, ded = parseFloat(f.ded) || 0, ext = parseFloat(f.extra) || 0;
  const tot = sal + hou + tra + prj + oth + ext;
  const pv = salaryPreview(f); const ic = pv.calc;
  const others = all.filter((x) => !existing || x.id !== existing.id);
  let empNo = String(f.empNo || (existing && (existing.empNo || existing.id)) || '').trim();
  let id = existing ? existing.id : '';
  if (!existing) {
    const num = (v) => { const t = String(v == null ? '' : v).trim(); return /^\d+$/.test(t) ? parseInt(t, 10) : 0; };
    id = String(Math.max(0, ...all.map((e) => num(e.id)), ...all.map((e) => num(e.empNo))) + 1);
    if (!empNo) empNo = id;
  }
  if (!empNo) return { error: 'الرقم الوظيفي مطلوب' };
  const email = norm(f.ml), iq = norm(f.iq);
  if (others.some((x) => norm(x.empNo || x.id) === norm(empNo) || (email && norm(x.email) === email) || (iq && norm(x.iqamaNo) === iq))) return { error: 'يوجد موظف مسجل بنفس الرقم الوظيفي أو البريد الإلكتروني أو رقم الهوية/الإقامة.' };
  const username = existing ? existing.username : 'EMP' + String(empNo).padStart(3, '0');
  if (!existing && all.some((x) => String(x.username || '').toUpperCase() === username.toUpperCase() || String(x.id) === id)) return { error: 'اسم المستخدم ' + username + ' مستخدم لموظف تاني — غيّر الرقم الوظيفي' };
  const exch = parseFloat(f.exchRate) > 0 ? parseFloat(f.exchRate) : defaultExchangeRate(f.currency || 'ريال سعودي');
  const base = existing || { isTerminated: false, payMethod: 'مدد', leaveBalance: 21, yearsOfService: 0, empType: 'دوام كامل', eosLaborLaw: 0, gender: '', createdAt: new Date().toISOString() };
  const emp = {
    ...base, id, empNo, username, managerId: f.managerId || '', nameAr: f.na, nameEn: f.ne, employer: f.em, nationality: f.nat, dept: f.dep, jobTitle: f.jt, mobile: f.mb, email: f.ml,
    bank: f.bk, iban: f.ib, sponsor: f.sp, religion: f.rel, notes: f.notes, isSaudi: pv.isSaudi, iqamaNo: f.iq, iqamaExpiry: f.iqe, iqamaDaysLeft: dl(f.iqe), passportNo: f.pn, passportExpiry: f.ppe, passportDaysLeft: dl(f.ppe),
    insuranceCo: f.ic, insuranceClass: f.icl, insuranceCard: f.icard, insuranceExpiry: f.ie, insuranceDaysLeft: dl(f.ie),
    contractNature: nature, contractType: f.ct, contractDuration: dur, contractJoin: f.cj, contractEnd, contractDaysLeft: dl(contractEnd), leaveDaysContract: parseInt(f.ldc, 10) || 21,
    salary: sal, housingAllowance: hou, transportAllowance: tra, projectAllowance: prj, otherAllowance: oth, otherDeductions: ded, extraAllowance: ext, salaryTotal: tot,
    insuranceSub: ic.insOnly !== undefined ? ic.insOnly : ic.empAmt, taxDeduct: ic.insOnly !== undefined ? (ic.taxAmt || 0) + (ic.mfAmt || 0) : 0, insuranceComp: ic.erAmt,
    netSalary: tot - ic.empAmt - ded, netSalaryLocal: tot - ic.empAmt - ded, insSystem: f.insSystem || 'old', wpsType: f.wpsType || 'wps', currency: f.currency || 'ريال سعودي', exchRate: exch,
    dob: f.dob || (existing && existing.dob) || '', photoUrl: f.photoData || (existing && existing.photoUrl) || '', updatedAt: new Date().toISOString(),
  };
  delete emp.password; // لا تُخزَّن كلمات المرور في بيانات الموظف أبداً
  return { emp };
}

export const employeePayload = (e) => ({
  ...e, employee_id: String(e.id), employeeId: String(e.id), name_ar: e.nameAr || '', name_en: e.nameEn || '', employer: e.employer || '', department: e.dept || '', job_title: e.jobTitle || '',
  nationality: e.nationality || '', iqama_no: e.iqamaNo || '', dob: e.dob || '', join_date: e.contractJoin || '', manager_id: e.managerId || '', active: !e.isTerminated, empNo: e.empNo || e.id, photoUrl: e.photoUrl || '',
});
export const syncEmployee = async (e) => { const r = await rpc('ariba_sync_employee', { p_employee: employeePayload(e) }); try { logEmployeeSave(e); } catch { /* ignore */ } return r; };
export const deleteEmployee = (id) => rpc('ariba_hr_delete_employee', { p_employee_id: String(id) });
export const terminateEmployee = (id, reason, lastDay) => rpc('ariba_hr_terminate_employee', { p_employee_id: String(id), p_reason: reason, p_last_day: lastDay });
