// ADAPTED: see below. سجل التعديلات — تسجيل من جهة العميل (طابور محلي ثم ariba_audit_add_many) مثل V132 لكن بدون تعديل window.fetch/XHR
import { rpc } from './api.js';
import { rt } from '../engines/runtime.js';

export const MOD = { employees: ['الموظفون', 'Employees'], attendance: ['الحضور والانصراف', 'Attendance'], payroll: ['مسير الرواتب', 'Payroll'], leaves: ['الإجازات', 'Leaves'], requests: ['الطلبات', 'Requests'], documents: ['المستندات والنماذج', 'Documents & forms'], settings: ['الإعدادات', 'Settings'], locations: ['مواقع البصمة', 'Punch locations'], security: ['الصلاحيات والأمان', 'Permissions & security'], settlement: ['المخالصة', 'Settlement'], insurance: ['التأمينات', 'Insurance'] };
export const modName = (m, en) => (MOD[m] ? MOD[m][en ? 1 : 0] : m);
const trim = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
export const fv = (v, en) => { if (v === undefined || v === null || v === '') return '—'; if (typeof v === 'boolean') return v ? (en ? 'Yes' : 'نعم') : (en ? 'No' : 'لا'); if (Array.isArray(v)) return v.join('، '); if (typeof v === 'object') return trim(JSON.stringify(v), 80); return trim(v, 80); };
// ADAPTED (decision 9): the server writes every audit entry itself (field-by-field employee diffs, payroll edits,
// settings, …), so nothing is queued in the browser and nothing here sends anything.
export const silently = (f) => f();
export const pending = () => 0;
export async function flush() { /* nothing queued */ }
export function log() { /* written by the server */ }
export function startAudit() { /* nothing to start */ }

const empName = (id) => { const e = (rt.employees || []).find((x) => String(x.id) === String(id)); return e ? String(e.nameAr || e.nameEn || id).split(' ').slice(0, 3).join(' ') : String(id == null ? '' : id); };
const SET_LBL = { insurance_rules: 'تعديل نسب التأمينات الاجتماعية', hr_signer: 'تعديل مدير الموارد البشرية / التوقيع / الختم', company_logo: 'تغيير شعار الشركة', company_names: 'تغيير اسم الشركة', letterhead: 'تعديل الورق الرسمي', country_system: 'تغيير النظام (سعودي/مصري)', leave_carry: 'تعديل ترحيل الإجازات', brand_colors: 'تعديل ألوان الهوية' };
const RPCW = {
  ariba_hr_record_leave: (a) => ['leaves', 'تسجيل إجازة', { type: 'employee', id: a.p_employee_id, name: empName(a.p_employee_id), summary: 'تسجيل إجازة ' + (a.p_type || a.p_leave_type || '') + ' لـ ' + empName(a.p_employee_id) + ' من ' + (a.p_from || a.p_start_date || '') + ' إلى ' + (a.p_to || a.p_end_date || '') }],
  ariba_hr_send_template: (a) => ['documents', 'إرسال نموذج للموظف', { type: 'employee', id: a.p_employee_id, name: empName(a.p_employee_id), summary: 'إرسال نموذج (' + (a.p_title || a.p_template_type || '') + ') إلى ' + empName(a.p_employee_id) }],
  ariba_delete_request: (a) => ['requests', 'حذف طلب / مستند', { type: 'request', id: a.p_request_id, summary: 'حذف طلب أو مستند (رقم ' + trim(a.p_request_id, 8) + ')' }],
  ariba_hr_final_approve: (a) => ['requests', 'اعتماد نهائي بالنيابة', { type: 'request', id: a.p_request_id, summary: 'اعتماد نهائي لطلب (رقم ' + trim(a.p_request_id, 8) + ')' + (a.p_reason ? ' — ' + a.p_reason : '') }],
  ariba_workflow_action: (a) => ['requests', 'إجراء على طلب (' + (a.p_action || '') + ')', { type: 'request', id: a.p_request_id, summary: 'إجراء ' + (a.p_action || '') + ' على طلب (رقم ' + trim(a.p_request_id, 8) + ')' + (a.p_reason ? ' — ' + a.p_reason : '') }],
  ariba_hr_override_workflow: (a) => ['requests', 'تجاوز مرحلة اعتماد', { type: 'request', id: a.p_request_id, summary: 'تجاوز مرحلة اعتماد لطلب (رقم ' + trim(a.p_request_id, 8) + ')' }],
  ariba_apply_forgot_punch: (a) => ['attendance', 'اعتماد نسيان بصمة', { type: 'request', id: a.p_request_id, summary: 'تطبيق طلب نسيان بصمة على سجل الحضور (رقم ' + trim(a.p_request_id, 8) + ')' }],
  ariba_hr_reset_password: (a) => ['security', 'إعادة تعيين كلمة مرور', { type: 'employee', id: a.p_employee_id, name: empName(a.p_employee_id), summary: 'إعادة تعيين كلمة مرور ' + empName(a.p_employee_id) }],
  ariba_hr_set_role: (a) => ['security', 'تغيير صلاحية', { type: 'employee', id: a.p_employee_id, name: empName(a.p_employee_id), summary: 'تغيير صلاحية ' + empName(a.p_employee_id) + ' إلى ' + (a.p_role || '') }],
  ariba_hr_deactivate_employee: (a) => ['employees', 'إيقاف موظف', { type: 'employee', id: a.p_employee_id, name: empName(a.p_employee_id), summary: 'إيقاف الموظف ' + empName(a.p_employee_id) }],
  ariba_hr_delete_employee: (a) => ['employees', 'حذف موظف', { type: 'employee', id: a.p_employee_id, name: empName(a.p_employee_id), summary: 'حذف الموظف ' + empName(a.p_employee_id) }],
  ariba_hr_terminate_employee: (a) => ['employees', 'إنهاء خدمة موظف', { type: 'employee', id: a.p_employee_id, name: empName(a.p_employee_id), summary: 'إنهاء خدمة ' + empName(a.p_employee_id) + ' — ' + (a.p_reason || '') + ' (آخر يوم ' + (a.p_last_day || '') + ')' }],
  ariba_hr_set_attendance_settings: (a) => ['settings', 'تعديل إعدادات الحضور', { summary: 'بداية الدوام ' + (a.p_work_start || '') + ' — هامش التأخير ' + (a.p_tolerance_minutes == null ? '' : a.p_tolerance_minutes) + ' دقيقة', details: a }],
  ariba_hr_set_flexible_hours: (a) => ['settings', 'تعديل الدوام المرن', { summary: (a.p_enabled ? 'تفعيل' : 'إيقاف') + ' الدوام المرن — ' + (a.p_shift_hours || '') + ' ساعة', details: a }],
  ariba_hr_set_setting: (a) => ['settings', SET_LBL[a.p_key] || ('تعديل إعداد: ' + a.p_key), { summary: SET_LBL[a.p_key] || ('تعديل إعداد: ' + a.p_key) }],
  ariba_sync_holidays: (a) => ['settings', 'تحديث العطلات الرسمية', { summary: 'تحديث قائمة العطلات الرسمية' + (Array.isArray(a.p_holidays) ? ' (' + a.p_holidays.length + ' عطلة)' : '') }],
  ariba_upsert_location: (a) => { const l = a.p_location || {}; return ['locations', 'إضافة/تعديل موقع بصمة', { type: 'location', id: l.id, name: l.name, summary: 'موقع "' + (l.name || '') + '" — ' + fv(l.latitude) + ', ' + fv(l.longitude) + ' — نصف القطر ' + fv(l.radius_m), details: l }]; },
  ariba_delete_location: (a) => ['locations', 'حذف موقع بصمة', { type: 'location', id: a.p_id, summary: 'حذف موقع بصمة (رقم ' + a.p_id + ')' }],
  ariba_payroll_prepare: (a) => ['payroll', 'تجهيز المسير للمالية', { summary: 'تجهيز مسير ' + a.p_month + '/' + a.p_year + ' للمالية' }],
  ariba_payroll_reopen: (a) => ['payroll', 'إعادة فتح المسير', { summary: 'إعادة فتح مسير ' + a.p_month + '/' + a.p_year + ' — ' + (a.p_reason || '') }],
  ariba_sync_attendance: (a) => ['attendance', 'تعديل/إضافة سجل حضور', { summary: 'سجل حضور يدوي', details: { rec: a.p_record || a.p_rows || null } }],
  ariba_asset_custody: (a) => ['employees', 'عهدة أصل', { summary: 'تسليم/استلام عهدة (أصل ' + trim(a.p_asset_id || a.p_id, 12) + ')' }],
};


const EL = { salary: 'الراتب الأساسي', sal: 'الراتب الأساسي', housingAllowance: 'بدل السكن', transportAllowance: 'بدل النقل', projectAllowance: 'بدل المشروع', otherAllowance: 'بدلات أخرى', extraAllowance: 'الإضافي', currency: 'العملة', exchRate: 'سعر الصرف', nameAr: 'الاسم', nameEn: 'الاسم بالإنجليزي', employer: 'جهة العمل', dept: 'القسم', jobTitle: 'الوظيفة', nationality: 'الجنسية', iqamaNo: 'رقم الإقامة', iqamaExpiry: 'انتهاء الإقامة', passportNo: 'رقم الجواز', passportExpiry: 'انتهاء الجواز', contractJoin: 'تاريخ المباشرة', contractEnd: 'انتهاء العقد', iban: 'الآيبان', bank: 'البنك', insSystem: 'نظام التأمينات', mobile: 'الجوال', email: 'البريد' };
const EIGN = new Set(['ts', 'updatedAt', 'insuranceSub', 'insuranceComp', 'netSalary', 'salaryTotal', 'tot', 'photoData', 'photoUrl', 'password', 'pw', 'pwd', 'pass', 'passwordHash', 'savedAt', 'name_ar', 'name_en', 'job_title', 'iqama_no', 'join_date', 'employee_id', 'employeeId', 'manager_id', 'created_at', 'updated_at']);
const EREG = /^(net|insurance|total|calc|gosi|eosAcc|accrued|yearsOfService$|leaveBalance|leaveRemaining)/i;
const pick = (e) => { const o = {}; Object.keys(e || {}).forEach((k) => { if (EIGN.has(k) || EREG.test(k) || k[0] === '_') return; const v = e[k]; if (v === undefined || v === null || v === '') return; o[k] = typeof v === 'object' ? JSON.stringify(v) : v; }); return o; };
/** يُستدعى من syncEmployee: قارن القديم (من الذاكرة) بالجديد وسجّل الفروق حقلاً حقلاً */
export function logEmployeeSave(nw) {
  const old = (rt.employees || []).find((x) => String(x.id) === String(nw.id)), nmx = String(nw.nameAr || nw.nameEn || nw.id);
  if (!old) return log('employees', 'إضافة موظف', { type: 'employee', id: nw.id, name: nmx, summary: 'إضافة موظف جديد: ' + nmx + (nw.jobTitle ? ' — ' + nw.jobTitle : '') + (nw.employer ? ' (' + nw.employer + ')' : ''), details: { salary: nw.salary, employer: nw.employer } });
  const a = pick(old), b = pick(nw), ch = [];
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => { if (String(a[k]) !== String(b[k])) ch.push({ field: k, label: EL[k] || k, old: a[k] === undefined ? null : a[k], new: b[k] === undefined ? null : b[k] }); });
  if (ch.length) log('employees', 'تعديل بيانات موظف', { type: 'employee', id: nw.id, name: nmx, summary: nmx + ': ' + ch.slice(0, 6).map((c) => c.label + ' من ' + fv(c.old) + ' إلى ' + fv(c.new)).join('؛') + (ch.length > 6 ? ' … (+' + (ch.length - 6) + ')' : ''), details: { changes: ch } });
}
export const PAYF = { workDays: 'أيام العمل', insDays: 'أيام التأمينات', otHours: 'ساعات الإضافي', otAmount: 'الإضافي', leaveManual: 'بدل أجازة (يدوي)', otherAllow: 'بدلات أخرى', loanDeduct: 'سلف / غياب', otherDeduct: 'خصومات أخرى', payMethod: 'طريقة الدفع', notes: 'ملاحظات', reason: 'سبب الإنهاء', lastDay: 'نهاية العقد / آخر يوم' };
export function logPayEdit(row, field, oldV, newV, month, auto) {
  if (String(oldV) === String(newV) && !auto) return; const n = String(row.nameAr || row.name || row.id).split(' ').slice(0, 3).join(' ');
  log('payroll', auto ? 'رجوع للقيمة التلقائية في المسير' : 'تعديل يدوي في المسير', { type: 'employee', id: row.id, name: n, summary: n + ': ' + (PAYF[field] || field) + ' من ' + fv(oldV) + ' إلى ' + fv(newV) + ' (مسير ' + month + ')', details: { field, label: PAYF[field] || field, old: oldV === undefined ? null : oldV, new: newV === undefined ? null : newV, month, auto: !!auto } });
}
export const auditList = (filters) => rpc('ariba_audit_list', { p_filters: filters });
