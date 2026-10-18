// ADAPTED (transport only): their sign-in module (same exports and behaviour) on our server's session —
// POST /auth/login, /auth/refresh, /auth/logout; the tokens live in our first-party cookies (src/lib/session.ts)
// and my role + permission matrix come from GET /me/perms (their ariba_login_jwt / ariba_my_perms).
import { request } from '@/lib/api';
import { clearSession, getAccessToken as cookieAccess, getRefreshToken, saveSession } from '@/lib/session';
import { MAX_LIFETIME_MS, PROMPT_AT } from './config.js';
import { T } from './i18n.js';

const SK = 'ariba_hr_session_meta_v1';
export const state = { jwt: null, rt: null, exp: 0, t0: 0, token: null, me: null, perms: null, role: '' };
const subs = new Set();
const emit = () => subs.forEach((f) => f());
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const snapshot = () => state.me;
let version = 0;
export const getVersion = () => version;
const bump = () => { version++; emit(); };

const meta = () => { try { return JSON.parse(sessionStorage.getItem(SK) || 'null') || {}; } catch { return {}; } };
function saveMeta() { try { if (state.jwt) sessionStorage.setItem(SK, JSON.stringify({ exp: state.exp, t0: state.t0 })); else sessionStorage.removeItem(SK); } catch { /* ignore */ } }

function setSession(d, keepT0) {
  saveSession(d.access_token, d.refresh_token, Number(d.expires_in) || 3600, !!(d.user && d.user.must_change_password));
  state.jwt = d.access_token; state.rt = d.refresh_token; state.exp = Date.now() + (Number(d.expires_in) || 3600) * 1000;
  state.t0 = keepT0 && state.t0 ? state.t0 : Date.now(); state.token = d.access_token; saveMeta();
}

let refreshing = null;
export function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const rt = state.rt || getRefreshToken();
    if (!rt) return false;
    try { const d = await request('/auth/refresh', { method: 'POST', body: { refresh_token: rt }, anonymous: true }); setSession(d, true); return true; }
    catch (e) { return e && e.status === 401 ? false : null; }
  })().finally(() => { refreshing = null; });
  return refreshing;
}
export async function getAccessToken() {
  if (state.jwt && state.exp - Date.now() < 30000 && state.rt) await refresh();
  return state.jwt;
}

async function loadMe() {
  try {
    const d = await request('/me/perms');
    if (!d || !d.ok) return null;
    state.me = d; state.perms = d.perms || null; state.role = d.real_role || d.role || '';
    return d;
  } catch { return null; }
}

export async function login(username, password) {
  const u = String(username || '').trim().toLowerCase();
  let d;
  try { d = await request('/auth/login', { method: 'POST', body: { username: u, password: String(password || '') }, anonymous: true }); }
  catch (e) {
    if (e && e.status === 0) return { ok: false, error: T('تعذر الاتصال بالخادم. تأكد من الإنترنت.', 'Could not reach the server. Check your connection.') };
    return { ok: false, error: e && e.status === 429 ? T('محاولات كتير. حاول بعد شوية.', 'Too many attempts. Try again shortly.') : T('بيانات الدخول غير صحيحة', 'Invalid login details') };
  }
  setSession(d, false);
  const me = await loadMe();
  if (!me) { await signOut(); return { ok: false, error: T('تعذر تحميل بيانات الحساب', 'Could not load the account') }; }
  bump(); return { ok: true, me };
}
/** Sign-in with a session the server already issued (fingerprint / Face ID — WebAuthn). */
export async function loginWithRefresh(session) {
  if (!session || !session.access_token) return { ok: false };
  setSession(session, false);
  const me = await loadMe(); if (!me) { await signOut(); return { ok: false }; }
  bump(); return { ok: true, me };
}
export async function restore() {
  try {
    const at = cookieAccess(), rt = getRefreshToken();
    if (!at && !rt) return false;
    const m = meta();
    Object.assign(state, { jwt: at, rt, token: at, exp: m.exp || (at ? Date.now() + 60000 : 0), t0: m.t0 || Date.now() });
    if (!at || state.exp - Date.now() < 30000) { const ok = await refresh(); if (!ok) { clear(); return false; } }
    const me = await loadMe(); if (!me) { clear(); return false; }
    bump(); return true;
  } catch { clear(); return false; }
}
function clear() { Object.assign(state, { jwt: null, rt: null, exp: 0, t0: 0, token: null, me: null, perms: null, role: '' }); clearSession(); saveMeta(); }
export async function signOut(reason) {
  const had = !!state.jwt;
  if (had) { try { await request('/auth/logout', { method: 'POST' }); } catch { /* ignore */ } }
  clear();
  try { if (reason) sessionStorage.setItem('ariba_logout_reason', reason); } catch { /* ignore */ }
  bump();
}
export function handleUnauthorized() { if (state.jwt) refresh().then((ok) => { if (ok === false) signOut('refresh_failed'); }); }
export const isAuthed = () => !!state.jwt && !!state.me;

export async function refreshPerms() {
  if (!state.jwt) return;
  if (await loadMe()) bump();
}
/** Called every 10 s: silent refresh or end the session */
export function tick(isActive, onPrompt) {
  if (!state.jwt) return;
  const now = Date.now(), left = state.exp - now;
  if (state.t0 && now - state.t0 > MAX_LIFETIME_MS - 60000) { signOut('max_lifetime'); return; }
  if (left < PROMPT_AT) { if (isActive()) refresh().then((ok) => { if (ok === false) signOut('refresh_failed'); }); else onPrompt && onPrompt(); }
}
