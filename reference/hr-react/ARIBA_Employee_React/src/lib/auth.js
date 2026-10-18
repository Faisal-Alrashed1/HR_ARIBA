// المصادقة عبر Supabase Auth (password grant) + JWT + تجديد تلقائي + مهلة الخمول
// أمان: الجلسة في sessionStorage افتراضياً، لا تُخزَّن كلمات المرور أبداً (تذكرني = اسم المستخدم فقط)
import { SUPA, KEY, DOMAIN, PROMPT_AT, MAX_LIFETIME_MS } from './config.js';
import { T } from './i18n.js';

const SK = 'ariba_sb_auth_v1';
export const state = { jwt: null, rt: null, exp: 0, t0: 0, token: null, me: null, perms: null, role: '' };
const subs = new Set();
const emit = () => subs.forEach((f) => f());
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const snapshot = () => state.me;
let version = 0;
export const getVersion = () => version;
const bump = () => { version++; emit(); };

const store = () => { try { return sessionStorage; } catch { return null; } };
function save() { try { const s = store(); if (!s) return; if (state.jwt) s.setItem(SK, JSON.stringify({ jwt: state.jwt, rt: state.rt, exp: state.exp, t0: state.t0, token: state.token })); else s.removeItem(SK); } catch { /* ignore */ } }

async function post(path, body, bearer) {
  const h = { apikey: KEY, 'Content-Type': 'application/json' }; if (bearer) h.Authorization = 'Bearer ' + bearer;
  const r = await fetch(SUPA + path, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}
function setSession(d, keepT0) {
  state.jwt = d.access_token; state.rt = d.refresh_token; state.exp = Date.now() + (Number(d.expires_in) || 3600) * 1000;
  state.t0 = keepT0 && state.t0 ? state.t0 : Date.now(); save();
}

let refreshing = null;
export function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    if (!state.rt) return false;
    try {
      const r = await post('/auth/v1/token?grant_type=refresh_token', { refresh_token: state.rt });
      if (r.ok && r.data && r.data.access_token) { setSession(r.data, true); return true; }
      return false;
    } catch { return null; }
  })().finally(() => { refreshing = null; });
  return refreshing;
}
export async function getAccessToken() {
  if (state.jwt && state.exp - Date.now() < 30000 && state.rt) await refresh();
  return state.jwt;
}

async function loadMe() {
  const r = await post('/rest/v1/rpc/ariba_login_jwt', {}, state.jwt);
  const d = r.data;
  if (!r.ok || !d || !d.ok) return null;
  state.token = d.token || null; state.me = d; state.perms = d.perms || null; state.role = d.real_role || d.role || '';
  save(); return d;
}

export async function login(username, password) {
  const u = String(username || '').trim().toLowerCase();
  let r;
  try { r = await post('/auth/v1/token?grant_type=password', { email: u + DOMAIN, password: String(password || '') }); }
  catch { return { ok: false, error: T('تعذر الاتصال بالخادم. تأكد من الإنترنت.', 'Could not reach the server. Check your connection.') }; }
  if (!r.ok || !r.data || !r.data.access_token) {
    return { ok: false, error: r.status === 429 ? T('محاولات كتير. حاول بعد شوية.', 'Too many attempts. Try again shortly.') : T('بيانات الدخول غير صحيحة', 'Invalid login details') };
  }
  state.jwt = null; setSession(r.data, false);
  const me = await loadMe();
  if (!me) { await signOut(); return { ok: false, error: T('تعذر تحميل بيانات الحساب', 'Could not load the account') }; }
  bump(); return { ok: true, me };
}
/** استعادة جلسة من refresh token (الدخول بالبصمة) */
export async function loginWithRefresh(rt) {
  state.rt = rt; state.jwt = null;
  const ok = await refresh(); if (!ok) { state.rt = null; return { ok: false }; }
  const me = await loadMe(); if (!me) { await signOut(); return { ok: false }; }
  bump(); return { ok: true, me };
}
export async function restore() {
  try {
    const s = store(); const raw = s && s.getItem(SK); if (!raw) return false;
    Object.assign(state, JSON.parse(raw));
    if (state.exp - Date.now() < 30000) { const ok = await refresh(); if (!ok) { clear(); return false; } }
    const me = await loadMe(); if (!me) { clear(); return false; }
    bump(); return true;
  } catch { clear(); return false; }
}
function clear() { Object.assign(state, { jwt: null, rt: null, exp: 0, t0: 0, token: null, me: null, perms: null, role: '' }); save(); }
export async function signOut(reason) {
  const t = state.jwt, st = state.token;
  clear();
  try { if (reason) sessionStorage.setItem('ariba_logout_reason', reason); } catch { /* ignore */ }
  if (t) { try { fetch(SUPA + '/auth/v1/logout', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + t } }).catch(() => {}); } catch { /* ignore */ } }
  void st; bump();
}
export function handleUnauthorized() { if (state.jwt) refresh().then((ok) => { if (ok === false) signOut('refresh_failed'); }); }
export const isAuthed = () => !!state.jwt && !!state.me;

export async function refreshPerms() {
  if (!state.jwt) return;
  try {
    const r = await post('/rest/v1/rpc/ariba_my_perms', {}, await getAccessToken());
    if (r.ok && r.data && r.data.ok) { state.perms = r.data.perms; state.role = r.data.role || state.role; bump(); }
  } catch { /* ignore */ }
}
/** يُستدعى كل 10 ث: تجديد صامت أو إنهاء الجلسة */
export function tick(isActive, onPrompt) {
  if (!state.jwt) return;
  const now = Date.now(), left = state.exp - now;
  if (state.t0 && now - state.t0 > MAX_LIFETIME_MS - 60000) { signOut('max_lifetime'); return; }
  if (left < PROMPT_AT) { if (isActive()) refresh().then((ok) => { if (ok === false) signOut('refresh_failed'); }); else onPrompt && onPrompt(); }
}
