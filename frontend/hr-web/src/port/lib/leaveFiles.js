// مرفقات طلبات الإجازة: تُحفظ على السيرفر فقط (جدول ariba_leave_files) فتظهر لكل من لديه صلاحية ومن أي جهاز.
import { rpc } from './api.js';
export const saveLeaveFile = (leaveId, empId, att) => rpc('ariba_leave_file_save', { p_leave_id: String(leaveId), p_employee_id: String(empId), p_file_name: att.name, p_mime_type: att.mime, p_base64: att.data });
export const listLeaveFiles = async (leaveId) => { const d = await rpc('ariba_leave_file_list', leaveId ? { p_leave_id: String(leaveId) } : {}); return Array.isArray(d) ? d : []; };
export const deleteLeaveFiles = (leaveId) => rpc('ariba_leave_file_delete', { p_leave_id: String(leaveId) });
export async function getLeaveFile(id) {
  const d = await rpc('ariba_leave_file_get', { p_id: id }); const bin = atob(d.base64 || ''); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return { name: d.file_name || 'file', mime: d.mime_type || 'application/octet-stream', bytes: u8 };
}
/** ترحيل لمرة واحدة: مرفقات كانت محفوظة محلياً على هذا الجهاز تُرفع للسيرفر ثم تُمسح محلياً */
export async function migrateLocalAtts(leaves) {
  const { listLocalAtts, getLocalAtt, deleteLocalAtt } = await import('./localAtt.js'); let n = 0;
  for (const a of await listLocalAtts()) {
    const l = leaves.find((q) => String(q.id) === String(a.id)); if (!l) continue;
    try { const f = await getLocalAtt(a.id); const raw = String(f.data); await saveLeaveFile(a.id, l.empId, { name: f.name, mime: f.mime, data: raw.includes(',') ? raw.split(',')[1] : raw }); await deleteLocalAtt(a.id); n++; } catch { /* يُعاد لاحقاً */ }
  }
  return n;
}
