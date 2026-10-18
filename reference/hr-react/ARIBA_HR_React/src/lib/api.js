import { SUPA, KEY } from './config.js';
import * as auth from './auth.js';

export class ApiError extends Error { constructor(msg, status, data) { super(msg); this.status = status; this.data = data; } }

async function raw(path, { method = 'POST', body, token, headers = {} } = {}) {
  const h = { apikey: KEY, 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(SUPA + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { ok: r.ok, status: r.status, data: d };
}
export { raw };

/** استدعاء دالة RPC بـJWT المستخدم. p_token (رمز الجلسة) يُضاف تلقائياً لو الدالة تحتاجه وطُلب withToken. */
export async function rpc(fn, args = {}, { withToken = true } = {}) {
  const jwt = await auth.getAccessToken();
  const body = withToken && auth.state.token && args.p_token === undefined && !NO_TOKEN.has(fn) ? { p_token: auth.state.token, ...args } : args;
  const r = await raw('/rest/v1/rpc/' + fn, { body, token: jwt || undefined, headers: { Prefer: 'return=representation' } });
  if (!r.ok) {
    if (r.status === 401) auth.handleUnauthorized();
    const m = (r.data && (r.data.message || r.data.hint || r.data.error)) || ('HTTP ' + r.status);
    throw new ApiError(m, r.status, r.data);
  }
  if (onWrite) { try { onWrite(fn, args); } catch { /* ignore */ } }
  return r.data;
}
let onWrite = null;
/** تسجيل تعديلات (سجل التعديلات) بعد نجاح أي RPC */
export const setWriteHook = (f) => { onWrite = f; };
const NO_TOKEN = new Set(['ariba_login_jwt', 'ariba_my_perms', 'ariba_leave_calc', 'ariba_auth_emp', 'ariba_auth_role', 'ariba_flag', 'ariba_audit_month_eligible', 'ariba_can']);

export async function functionCall(name, body) {
  const jwt = await auth.getAccessToken();
  return raw('/functions/v1/' + name, { body, token: jwt || undefined });
}

/** إعدادات السيرفر (ariba_app_settings) */
export async function getSetting(key) { const r = await rpc('ariba_hr_get_setting', { p_key: key }); return r && r.value !== undefined ? r.value : null; }
export async function setSetting(key, value) { return rpc('ariba_hr_set_setting', { p_key: key, p_value: value }); }
