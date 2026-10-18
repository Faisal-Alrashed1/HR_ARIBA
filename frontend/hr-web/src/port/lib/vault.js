// ADAPTED (see enableBiometric). تخزين آمن لخيار "تذكرني" والدخول بالبصمة.
// تحسين أمني عن النسخة القديمة: لا تُحفظ كلمة المرور إطلاقاً. نحفظ اسم المستخدم فقط،
// وللبصمة نحفظ الـrefresh-token مشفراً بمفتاح AES-GCM غير قابل للتصدير داخل IndexedDB.
import { T } from './i18n.js';
import * as auth from './auth.js';
import { request } from '@/lib/api';
let RMK = 'ariba_rm_v2_hr';
let KNAME = 'hr';
/** تطبيق الموظف يستخدم مفتاحًا منفصلًا حتى لا يتداخل مع تطبيق الموارد البشرية */
export function setNamespace(ns) { RMK = 'ariba_rm_v2_' + ns; KNAME = ns; }
const hasCrypto = typeof window !== 'undefined' && !!window.PublicKeyCredential;

const unb64 = (s) => { const r = atob(s), a = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; };

export function getRec() { try { const r = localStorage.getItem(RMK); return r ? JSON.parse(r) : null; } catch { return null; } }
export function setRec(v) { try { if (v) localStorage.setItem(RMK, JSON.stringify(v)); else localStorage.removeItem(RMK); } catch { /* ignore */ } }

export async function biometricAvailable() {
  try { return !!(window.isSecureContext && window.PublicKeyCredential && hasCrypto && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
}
export async function rememberUser(username) { const old = getRec(); setRec({ u: username, rt: old && old.u === username ? old.rt || null : null, cred: old && old.u === username ? old.cred || null : null }); }
export function forget() { setRec(null); }
// ADAPTED: fingerprint / Face ID is a WebAuthn passkey registered on OUR server (ariba_webauthn_credentials); the
// browser keeps only the username and the credential id — no token is stored. Same functions and messages as theirs.
export async function storeRefresh() { /* nothing stored in the browser */ }
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => unb64(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4));
const pkCreate = (o) => ({ ...o, challenge: unb64u(o.challenge), user: { ...o.user, id: unb64u(o.user.id) }, excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: unb64u(c.id) })) });
const pkGet = (o) => ({ ...o, challenge: unb64u(o.challenge), allowCredentials: (o.allowCredentials || []).map((c) => ({ ...c, id: unb64u(c.id) })) });
const credJson = (c) => ({ id: c.id, rawId: b64u(c.rawId), type: c.type, response: Object.fromEntries(['clientDataJSON', 'attestationObject', 'authenticatorData', 'signature', 'userHandle'].filter((k) => c.response[k]).map((k) => [k, b64u(c.response[k])])), clientExtensionResults: {} });
export async function enableBiometric() {
  let rec = getRec();
  if (!rec) { const u = (auth.state.me && (auth.state.me.username || auth.state.me.email)) || ''; if (!u) return { ok: false, msg: T('سجّل الدخول مع تفعيل "تذكرني" مرة أولًا', 'Sign in with "Remember me" once first') }; await rememberUser(String(u).toLowerCase()); rec = getRec(); }
  if (!window.isSecureContext) return { ok: false, msg: T('البصمة لا تعمل إذا فُتح البرنامج كملف على الجهاز. افتحه من رابط https (موقع البرنامج).', 'Biometrics need the app to be opened from an https link, not a local file.') };
  try {
    const o = await request('/auth/webauthn/register/options', { method: 'POST', body: {} });
    const cred = await navigator.credentials.create({ publicKey: pkCreate(o.options) });
    if (!cred) return { ok: false };
    const r = await request('/auth/webauthn/register', { method: 'POST', body: { state: o.state, credential: credJson(cred), label: navigator.platform || '' } });
    rec.cred = r.credential_id; rec.rt = 1; setRec(rec);
    return { ok: true, msg: T('✓ تم تفعيل الدخول بالبصمة على هذا الجهاز', '✓ Biometric sign-in enabled on this device') };
  } catch (e) {
    const n = (e && e.name) || '';
    const why = n === 'NotAllowedError' ? T('تم الإلغاء أو الجهاز ليس عليه قفل شاشة/بصمة (Windows Hello / قفل الهاتف). فعّله من إعدادات الجهاز ثم أعد المحاولة.', 'Cancelled, or this device has no screen lock / biometrics set up (Windows Hello / phone lock).')
      : n === 'SecurityError' ? T('المتصفح يمنع البصمة في هذا الوضع (افتح الرابط https مباشرة وليس داخل إطار).', 'Browser blocks biometrics here (open the https link directly, not inside a frame).')
      : n === 'NotSupportedError' ? T('هذا الجهاز/المتصفح لا يدعم البصمة.', 'This device/browser does not support biometrics.')
      : (n || 'error') + (e && e.message ? ': ' + String(e.message).slice(0, 80) : '');
    return { ok: false, msg: T('لم يتم تفعيل البصمة — ', 'Biometric not enabled — ') + why };
  }
}
/** يتحقق بالبصمة على الخادم ويرجع جلسة جديدة (loginWithRefresh يستقبلها) */
export async function biometricUnlock() {
  const rec = getRec(); if (!rec || !rec.cred) return { ok: false };
  try {
    const o = await request('/auth/webauthn/login/options', { method: 'POST', body: { username: rec.u }, anonymous: true });
    const cred = await navigator.credentials.get({ publicKey: pkGet(o.options) });
    const session = await request('/auth/webauthn/login', { method: 'POST', body: { state: o.state, credential: credJson(cred) }, anonymous: true });
    return { ok: true, rt: session, username: rec.u };
  } catch (e) {
    if (e && e.status === 401) { rec.rt = null; rec.cred = null; setRec(rec); return { ok: false, msg: T('البيانات المحفوظة غير صالحة، اكتب كلمة المرور.', 'Saved data is invalid, please type your password.') }; }
    return { ok: false, msg: T('تم إلغاء التحقق بالبصمة أو فشل. تقدر تدخل بكلمة المرور.', 'Biometric check failed or cancelled. You can sign in with your password.') };
  }
}
