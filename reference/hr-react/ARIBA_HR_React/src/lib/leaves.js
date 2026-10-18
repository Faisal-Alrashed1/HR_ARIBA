import { htmlToPdfBlob, isHtmlFile } from './htmlPdf.js';
import { rpc } from './api.js';
import { uid } from './util.js';

export const LVL = {
  annual: { ar: 'سنوية', en: 'Annual', icon: 'ti-sun', color: '#E4E4BC' }, sick: { ar: 'مرضية', en: 'Sick', icon: 'ti-stethoscope', color: '#6B7280' },
  emergency: { ar: 'اضطرارية', en: 'Emergency', icon: 'ti-urgent', color: '#E4E4BC' }, death: { ar: 'وفاة', en: 'Bereavement', icon: 'ti-candle', color: '#6366f1' },
  marriage: { ar: 'زواج', en: 'Marriage', icon: 'ti-heart', color: '#E4E4BC' }, paternity: { ar: 'أبوة', en: 'Paternity', icon: 'ti-baby-carriage', color: '#014D3D' },
  maternity: { ar: 'أمومة', en: 'Maternity', icon: 'ti-baby', color: '#E4E4BC' }, umrah: { ar: 'عمرة', en: 'Umrah', icon: 'ti-moon', color: '#29B35E' },
  hajj: { ar: 'حج', en: 'Hajj', icon: 'ti-star', color: '#014D3D' }, remote: { ar: 'عن بعد', en: 'Remote Work', icon: 'ti-home-laptop', color: '#29B35E' },
  mission: { ar: 'مهمة خارجية', en: 'External Mission', icon: 'ti-briefcase', color: '#014D3D' }, perm: { ar: 'استئذان', en: 'Permission', icon: 'ti-clock-hour-4', color: '#014D3D' },
  perm_mat: { ar: 'استئذان أمومة', en: 'Mat.Permission', icon: 'ti-baby-carriage', color: '#f472b6' }, early_leave: { ar: 'خروج مبكر', en: 'Early Leave', icon: 'ti-door-exit', color: '#E4E4BC' },
  unpaid: { ar: 'إجازة بدون راتب', en: 'Unpaid Leave', icon: 'ti-calendar-off', color: '#f59e0b' }, salary_advance: { ar: 'طلب راتب مقدم', en: 'Salary Advance', icon: 'ti-cash-banknote', color: '#10b981' },
  iban_change: { ar: 'تغيير الآيبان', en: 'IBAN Change', icon: 'ti-building-bank', color: '#0ea5e9' }, profile_edit: { ar: 'تعديل بيانات', en: 'Profile Edit', icon: 'ti-user-edit', color: '#8b5cf6' }, document: { ar: 'رفع مستند', en: 'Document Upload', icon: 'ti-file-upload', color: '#64748b' },
  advance: { ar: 'سلفة', en: 'Advance', icon: 'ti-cash', color: '#29B35E' }, overtime: { ar: 'عمل إضافي', en: 'Overtime', icon: 'ti-clock-plus', color: '#014D3D' },
};
export const HR_LEAVE_TYPES = ['annual', 'sick', 'emergency', 'death', 'marriage', 'paternity', 'maternity', 'umrah', 'hajj', 'remote', 'unpaid'];
/** الأنواع التي يرفعها الموظف كطلب ولا تظهر في شاشة «طلب جديد» لـ HR */
export const EMP_REQ_TYPES = ['unpaid', 'salary_advance'];
export const PERM_TYPES = ['perm', 'perm_mat', 'early_leave', 'advance'];

export const recordLeave = (l, status) => rpc('ariba_hr_record_leave', { p_employee_id: String(l.empId), p_hr_leave_id: String(l.id), p_type: l.type, p_from: l.from, p_to: l.to || l.from, p_days: Number(l.days) || 0, p_notes: String(l.notes || ''), p_status: String(status || l.status || 'pending').toLowerCase() });
export const deleteLeave = (id) => rpc('ariba_hr_delete_leave', { p_hr_leave_id: String(id) });
export const newLeaveId = uid;
export const wfApprove = (id, reason) => rpc('ariba_hr_override_workflow', { p_request_id: id, p_reason: reason || 'اعتماد الموارد البشرية' });
export const wfFinalApprove = (id, reason) => rpc('ariba_hr_final_approve', { p_request_id: id, p_reason: reason || 'اعتماد نهائي من الموارد البشرية' });
export async function wfReject(id, reason) {
  try { return await rpc('ariba_workflow_action', { p_request_id: id, p_action: 'rejected', p_reason: reason || 'مرفوض من الموارد البشرية' }); }
  catch { return rpc('ariba_hr_override_workflow', { p_request_id: id, p_reason: 'مرفوض: ' + (reason || '') }); }
}
export const fetchQueue = async () => { const d = await rpc('ariba_staff_queue'); return (d && d.queue) || []; };
export const fetchRequests = async () => { const d = await rpc('ariba_staff_requests'); return (d && d.requests) || []; };
export const submitOvertime = (emp, payload, att) => rpc('ariba_hr_submit_overtime', { p_employee_id: String(emp), p_payload: payload, p_attachment_name: att ? att.name : null, p_attachment_mime: att ? att.mime : null, p_attachment_base64: att ? att.data : null });
export const syncHolidays = (v) => rpc('ariba_sync_holidays', { p_holidays: v || [] });

export async function getDocFile(id) {
  const d = await rpc('ariba_get_document', { p_document_id: id });
  const bin = atob(d.base64 || ''); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return { name: d.file_name || 'document', mime: d.mime_type || 'application/octet-stream', bytes: u8 };
}
export async function saveFile(f) {
  let blob, name = f.name;
  if (isHtmlFile(f)) { // النماذج والمخالصات: تنزل PDF مباشرة
    try { blob = await htmlToPdfBlob(new TextDecoder('utf-8').decode(f.bytes)); name = String(f.name || 'document').replace(/\.html?$/i, '') + '.pdf'; } catch { blob = null; }
  }
  if (!blob) blob = new Blob([f.bytes], { type: f.mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
export async function downloadDoc(id) {
  const d = await rpc('ariba_get_document', { p_document_id: id });
  const bin = atob(d.base64 || ''); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const mime = d.mime_type || 'application/octet-stream';
  const blob = new Blob([u8], { type: /^text\/(html|plain|csv)\s*$/i.test(mime) ? mime + ';charset=utf-8' : mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = d.file_name || 'document'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
export const fileToData = (file) => new Promise((res, rej) => {
  if (!file) return res(null);
  if (file.size > 12582912) return rej(new Error('حجم المرفق يتجاوز 12 MB'));
  const r = new FileReader(); r.onload = () => res({ name: file.name, mime: file.type || 'application/octet-stream', size: file.size, data: String(r.result).split(',')[1] || '' }); r.onerror = rej; r.readAsDataURL(file);
});

export const wfHrReject = (id, reason) => rpc('ariba_hr_reject', { p_request_id: id, p_reason: reason });
export const wfReturnToManager = (id, note) => rpc('ariba_hr_return_to_manager', { p_request_id: id, p_note: note });
export const wfRunEscalation = () => rpc('ariba_hr_run_escalation');
export const getWfConfig = async () => { const d = await rpc('ariba_hr_get_wf_config'); return (d && d.config) || {}; };
export const setWfConfig = (config) => rpc('ariba_hr_set_wf_config', { p_config: config });
export const getManagerPerms = async () => { const d = await rpc('ariba_hr_manager_perms'); return (d && d.managers) || []; };
export const setManagerPerms = (managerId, perms) => rpc('ariba_hr_set_manager_perms', { p_manager_id: String(managerId), p_perms: perms });
export const MGR_PERM_KEYS = [
  ['approve_requests', 'اعتماد / رفض طلبات فريقه', 'Approve / reject team requests'],
  ['view_team', 'رؤية قائمة فريقه', 'See team list'],
  ['view_team_data', 'بيانات الفريق (الوظيفية)', 'Team employment data'],
  ['view_team_leaves', 'إجازات وأرصدة الفريق', 'Team leaves & balances'],
  ['view_team_requests', 'طلبات الفريق وحالتها', 'Team requests & status'],
  ['view_team_attendance', 'حضور الفريق', 'Team attendance'],
  ['view_team_salary', 'رواتب الفريق', 'Team salaries'],
  ['manage_targets', 'إدخال مستهدفات الفريق', 'Set team targets'],
  ['evaluate_team', 'تقييم الفريق واعتماد التقييم', 'Evaluate team & approve'],
  ['submit_for_team', 'تقديم طلبات بالنيابة (بعد تفويض الموظف)', 'Submit on behalf (after employee delegation)'],
];
