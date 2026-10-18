// ADAPTED (transport only): their screens call Supabase RPCs by name; here each name goes to the matching route of
// our FastAPI server (docs/PORT_PLAN.md section 9), with the arguments and the result in the shape the screen expects.
// The server checks the session and the permission matrix on every call.
import { request, ApiError as OurError } from '@/lib/api';
import { saveSession } from '@/lib/session';

export class ApiError extends Error { constructor(msg, status, data) { super(msg); this.status = status; this.data = data; } }

// Error codes their screens compare against (their SQL raised these as the message).
const CODE_MESSAGES = /^(PAYROLL_[A-Z_]+|APPROVAL_REQUIRES_FINANCE|REASON_REQUIRED|NOT_AUTHORIZED|INVALID_SESSION|PASSWORD_REQUIRED|INVITE_[A-Z_]+|FORM_CLOSED|SEND_FAILED)$/;
const wrapErr = (e) => {
  if (e instanceof OurError) return new ApiError(CODE_MESSAGES.test(e.code) ? e.code : (e.message || e.code), e.status, { code: e.code, message: e.message });
  return e instanceof Error ? e : new Error(String(e));
};
const call = async (method, path, body, query) => {
  try { return await request(path, { method, body, query }); } catch (e) { throw wrapErr(e); }
};
const get = (p, q) => call('GET', p, undefined, q);
const post = (p, b) => call('POST', p, b ?? {});
const put = (p, b) => call('PUT', p, b ?? {});
const del = (p, q) => call('DELETE', p, undefined, q);
const enc = encodeURIComponent;
const sheet = (a) => 'pay_' + a.p_year + '_' + String(a.p_month).padStart(2, '0');

const MAP = {
  // assets
  ariba_assets_list: () => get('/assets'),
  ariba_assets_upsert: (a) => post('/assets', { asset: a.p_asset }),
  ariba_assets_delete: (a) => del('/assets/' + enc(a.p_id)),
  ariba_asset_custody: (a) => post('/assets/' + enc(a.p_id) + '/custody', { employee_id: a.p_employee_id || '', date: a.p_date, notes: a.p_notes }),
  // audit (the server writes the entries itself — decision 9)
  ariba_audit_add_many: async () => ({ ok: true }),
  ariba_audit_list: (a) => post('/audit/list', a.p_filters || {}),
  ariba_audit_purge_info: () => get('/audit/purge'),
  ariba_audit_purge_request: (a) => post('/audit/purge', { month: a.p_month }),
  ariba_audit_purge_decide: (a) => post('/audit/purge/' + enc(a.p_request) + '/decide', { approve: !!a.p_approve }),
  // account
  ariba_change_my_password: async (a) => {
    const s = await post('/auth/change-password', { old_password: a.p_old, new_password: a.p_new });
    if (s && s.access_token) saveSession(s.access_token, s.refresh_token, s.expires_in, false);
    return { ok: true };
  },
  ariba_hr_reset_password: (a) => post('/staff/employees/' + enc(a.p_employee_id) + '/reset-password'),
  ariba_hr_default_password_list: () => get('/auth/users/default-passwords'),
  ariba_hr_list_roles: () => get('/settings/roles'),
  ariba_hr_set_role: (a) => put('/settings/roles', { employee_id: a.p_employee_id, role: a.p_role }),
  ariba_perms_matrix: () => get('/settings/permissions'),
  ariba_perms_set: (a) => put('/settings/permissions', { role: a.p_role, module: a.p_module, level: a.p_level }),
  // employees
  ariba_staff_employees: () => get('/staff/employees'),
  ariba_sync_employee: (a) => put('/staff/employees/' + enc(a.p_employee.id ?? a.p_employee.employee_id), { employee: a.p_employee }),
  ariba_hr_delete_employee: (a) => del('/employees/' + enc(a.p_employee_id)),
  ariba_hr_terminate_employee: (a) => post('/staff/employees/' + enc(a.p_employee_id) + '/terminate', { reason: a.p_reason, last_day: a.p_last_day }),
  ariba_list_documents: (a) => get('/staff/documents/' + enc(a.p_employee_id)),
  ariba_save_document: (a) => post('/staff/documents', { employee_id: a.p_employee_id, document_type: a.p_document_type, file_name: a.p_file_name, mime_type: a.p_mime_type, base64: a.p_base64, request_id: a.p_request_id || null }),
  ariba_get_document: (a) => get('/documents/' + enc(a.p_document_id) + '/content'),
  // candidates
  ariba_hr_candidates: (a) => get('/candidates', a && a.p_status ? { status: a.p_status } : undefined),
  ariba_hr_candidate_by_ref: (a) => get('/candidates/by-ref/' + enc(a.p_ref)),
  ariba_hr_candidate_file: (a) => get('/candidates/files/' + enc(a.p_file_id)),
  ariba_hr_candidate_accept: (a) => post('/candidates/' + enc(a.p_candidate_id) + '/accept', a.p_values || {}),
  ariba_hr_candidate_reject: (a) => post('/candidates/' + enc(a.p_candidate_id) + '/reject', { note: a.p_note }),
  ariba_hr_apply_key_rotate: () => post('/candidates/apply-key/rotate'),
  ariba_hr_apply_mode_set: (a) => put('/candidates/apply-mode', { invite_only: !!a.p_invite_only, hours: a.p_hours }),
  ariba_hr_invites: () => get('/candidates/invites'),
  ariba_hr_invite_create: (a) => post('/candidates/invites', { label: a.p_label, hours: a.p_hours }),
  ariba_hr_invite_revoke: (a) => post('/candidates/invites/' + enc(a.p_invite) + '/revoke'),
  // targets and evaluations
  ariba_targets_list: (a) => get('/targets', { employee_id: a.p_employee_id, year: a.p_year }),
  ariba_target_save: (a) => post('/targets', { target: a.p_target }),
  ariba_target_delete: (a) => del('/targets/' + enc(a.p_id)),
  ariba_eval_get: (a) => get('/evaluations/' + enc(a.p_employee_id) + '/' + enc(a.p_type) + '/' + enc(a.p_key)),
  ariba_eval_save: (a) => put('/evaluations/' + enc(a.p_employee_id) + '/' + enc(a.p_type) + '/' + enc(a.p_key), { items: a.p_items, comments: a.p_comments, submit: !!a.p_submit }),
  ariba_eval_approve: (a) => post('/evaluations/' + enc(a.p_evaluation_id) + '/approve'),
  ariba_eval_list: (a) => get('/evaluations', a && a.p_status ? { status: a.p_status } : undefined),
  ariba_my_goals: () => get('/me/goals'),
  // attendance and locations
  ariba_hr_attendance_range: (a) => get('/staff/attendance/range', { date_from: a.p_from, date_to: a.p_to, employee_id: a.p_employee_id || undefined }),
  ariba_staff_attendance: (a) => get('/staff/attendance', { day: a.p_date }),
  ariba_sync_attendance: (a) => put('/staff/attendance', { employee_id: a.p_employee_id, date: a.p_date, time_in: a.p_time_in, time_out: a.p_time_out, status: a.p_status, location_id: a.p_location_id, location_name: a.p_location_name, lat: a.p_lat, lng: a.p_lng, notes: a.p_notes }),
  ariba_hr_locations: () => get('/staff/locations'),
  ariba_upsert_location: (a) => post('/staff/locations', { location: a.p_location }),
  ariba_delete_location: (a) => del('/staff/locations/' + enc(a.p_id)),
  ariba_get_attendance_settings: () => get('/settings/attendance'),
  ariba_hr_set_attendance_settings: (a) => put('/staff/attendance-settings', { work_start: a.p_work_start, tolerance_minutes: a.p_tolerance_minutes, remote_days_per_year: a.p_remote_days_per_year }),
  ariba_hr_set_flexible_hours: (a) => put('/staff/flexible-hours', { enabled: !!a.p_enabled, shift_hours: a.p_shift_hours, window_start: a.p_window_start, window_end: a.p_window_end }),
  ariba_hr_set_ramadan_flex: (a) => put('/settings/attendance/ramadan', { enabled: !!a.p_enabled, shift_hours: a.p_shift_hours, window_start: a.p_window_start, window_end: a.p_window_end, from: a.p_from, to: a.p_to }),
  // leaves, requests, workflow
  ariba_hr_leaves_since: () => get('/staff/leaves'),
  ariba_hr_record_leave: (a) => post('/staff/leaves', { employee_id: a.p_employee_id, hr_leave_id: a.p_hr_leave_id, type: a.p_type, from: a.p_from, to: a.p_to, days: a.p_days, notes: a.p_notes, status: a.p_status }),
  ariba_hr_delete_leave: (a) => del('/staff/leaves/' + enc(a.p_hr_leave_id)),
  ariba_staff_holidays: () => get('/staff/holidays'),
  ariba_sync_holidays: (a) => put('/staff/holidays', { holidays: a.p_holidays || [] }),
  ariba_staff_queue: () => get('/staff/queue'),
  ariba_staff_requests: () => get('/staff/requests'),
  ariba_hr_override_workflow: (a) => post('/requests/' + enc(a.p_request_id) + '/override', { reason: a.p_reason }),
  ariba_hr_final_approve: (a) => post('/requests/' + enc(a.p_request_id) + '/final-approve', { reason: a.p_reason }),
  ariba_workflow_action: (a) => post('/requests/' + enc(a.p_request_id) + (a.p_action === 'rejected' ? '/reject' : '/approve'), { reason: a.p_reason }),
  ariba_hr_reject: (a) => post('/requests/' + enc(a.p_request_id) + '/reject', { reason: a.p_reason }),
  ariba_hr_return_to_manager: (a) => post('/requests/' + enc(a.p_request_id) + '/return', { note: a.p_note }),
  ariba_hr_run_escalation: () => post('/requests/escalate'),
  ariba_hr_get_wf_config: () => get('/settings/workflow'),
  ariba_hr_set_wf_config: (a) => put('/settings/workflow', a.p_config || {}),
  ariba_hr_manager_perms: () => get('/settings/manager-perms'),
  ariba_hr_set_manager_perms: (a) => put('/settings/manager-perms/' + enc(a.p_manager_id), { perms: a.p_perms }),
  ariba_hr_submit_overtime: (a) => post('/staff/overtime', { employee_id: a.p_employee_id, payload: a.p_payload, attachment_name: a.p_attachment_name, attachment_mime: a.p_attachment_mime, attachment_base64: a.p_attachment_base64 }),
  ariba_leave_file_save: (a) => post('/leave-files', { leave_id: a.p_leave_id, employee_id: a.p_employee_id, file_name: a.p_file_name, mime_type: a.p_mime_type, base64: a.p_base64 }),
  ariba_leave_file_list: (a) => get('/leave-files', a && a.p_leave_id ? { leave_id: a.p_leave_id } : undefined),
  ariba_leave_file_get: (a) => get('/leave-files/' + enc(a.p_id)),
  ariba_leave_file_delete: (a) => del('/leave-files', { leave_id: a.p_leave_id }),
  // leave snapshots are not sent from the browser any more (decision 4: the server computes the balance)
  ariba_hr_leave_snapshots: async () => ({ rows: [] }),
  ariba_hr_set_leave_snapshots: async () => ({ ok: true }),
  // documents, forms, messages
  ariba_hr_send_template: (a) => post('/staff/templates', { employee_id: a.p_employee_id, emp_no: a.p_emp_no, template_type: a.p_template_type, title: a.p_title, file_name: a.p_file_name, mime_type: a.p_mime_type, base64: a.p_base64 }),
  ariba_hr_template_status: () => get('/staff/templates'),
  ariba_doc_sign_cfg_get: () => get('/settings/doc-sign'),
  ariba_doc_sign_cfg_set: (a) => put('/settings/doc-sign', { manager_types: a.p_manager_types }),
  ariba_hr_send_message: (a) => post('/messages', { employee_id: a.p_employee_id, title: a.p_title, body: a.p_body }),
  ariba_mail_get: (a) => get('/mail/' + enc(a.p_scope)),
  ariba_mail_set: (a) => put('/mail/' + enc(a.p_scope), { host: a.p_host, port: a.p_port, secure: a.p_secure, username: a.p_username, password: a.p_password, from_name: a.p_from_name, from_email: a.p_from_email }),
  ariba_mail_delete: (a) => del('/mail/' + enc(a.p_scope)),
  // notifications
  ariba_my_notifications: (a) => get('/staff/notifications', { limit: (a && a.p_limit) || 40 }),
  ariba_mark_notifications_read: async (a) => { await post('/me/notifications/read', a && a.p_ids ? { ids: a.p_ids } : {}); return { ok: true }; },
  // payroll
  ariba_payroll_draft_get: (a) => get('/staff/payroll/' + a.p_year + '/' + a.p_month),
  ariba_payroll_status_get: (a) => get('/sheets/' + sheet(a) + '/status'),
  ariba_sync_payroll: (a) => put('/staff/payroll/' + a.p_year + '/' + a.p_month, { approved: !!a.p_approved, rows: a.p_rows || [] }),
  ariba_payroll_prepare: (a) => post('/sheets/' + sheet(a) + '/prepare', { note: a.p_note || '' }),
  ariba_payroll_reopen: (a) => post('/sheets/' + sheet(a) + '/unapprove', { reason: a.p_reason }),
  ariba_payroll_archive: (a) => get('/staff/payroll-archive', a && a.p_year ? { year: a.p_year, month: a.p_month } : undefined),
  // team and tasks
  ariba_team_availability: () => get('/team/availability'),
  ariba_my_tasks: (a) => get('/tasks', { box: (a && a.p_scope) || 'inbox' }),
  ariba_send_task: (a) => post('/tasks', { to: a.p_to, kind: a.p_kind, title: a.p_title, details: a.p_details, due: a.p_due, start: a.p_start, end: a.p_end, location: a.p_location }),
  ariba_task_update: (a) => post('/tasks/' + enc(a.p_id) + '/update', { status: a.p_status, note: a.p_note }),
  // settings (key/value)
  ariba_hr_get_setting: (a) => get('/settings/kv/' + enc(a.p_key)),
  ariba_hr_set_setting: (a) => put('/settings/kv/' + enc(a.p_key), { value: a.p_value }),
};

let onWrite = null;
/** Their audit hook (kept for their code; the server writes the audit log). */
export const setWriteHook = (f) => { onWrite = f; };

/** rpc(name, args) — same signature as theirs. */
export async function rpc(fn, args = {}) {
  const f = MAP[fn];
  if (!f) throw new ApiError('Could not find the function public.' + fn, 404, null);
  const r = await f(args || {});
  if (onWrite) { try { onWrite(fn, args); } catch { /* ignore */ } }
  return r;
}

/** Their raw() is only used by the public apply page; kept for its signature. */
export async function raw(path, { method = 'POST', body } = {}) {
  try { return { ok: true, status: 200, data: await request(path, { method, body, anonymous: true }) }; }
  catch (e) { return { ok: false, status: e.status || 0, data: e instanceof OurError ? { message: CODE_MESSAGES.test(e.code) ? e.code : e.message, code: e.code } : null }; }
}

const FUNCTIONS = {
  'ariba-brand-colors': (b) => post('/settings/brand/extract', b),
  'ariba-send-email': (b) => post('/mail/send-document', b),
  'ariba-send-report': (b) => post('/mail/send-report', b),
  'ariba-password-recovery': (b) => request('/auth/password-recovery', { method: 'POST', body: b, anonymous: true }),
};
/** functionCall(name, body) → {ok, status, data} as their Supabase functions answered. */
export async function functionCall(name, body) {
  const f = FUNCTIONS[name];
  if (!f) return { ok: false, status: 404, data: null };
  try { return { ok: true, status: 200, data: await f(body || {}) }; }
  catch (e) { const w = wrapErr(e); return { ok: false, status: w.status || 0, data: { ok: false, message: (w.data && w.data.message) || w.message, error: w.data && w.data.code } }; }
}

/** Server settings (ariba_app_settings) */
export async function getSetting(key) { const r = await rpc('ariba_hr_get_setting', { p_key: key }); return r && r.value !== undefined ? r.value : null; }
export async function setSetting(key, value) { return rpc('ariba_hr_set_setting', { p_key: key, p_value: value }); }
