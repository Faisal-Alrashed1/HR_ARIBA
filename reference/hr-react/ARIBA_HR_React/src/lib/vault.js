// تخزين آمن لخيار "تذكرني" والدخول بالبصمة.
// تحسين أمني عن النسخة القديمة: لا تُحفظ كلمة المرور إطلاقاً. نحفظ اسم المستخدم فقط،
// وللبصمة نحفظ الـrefresh-token مشفراً بمفتاح AES-GCM غير قابل للتصدير داخل IndexedDB.
import { T } from './i18n.js';
import * as auth from './auth.js';
let RMK = 'ariba_rm_v2_hr';
let KNAME = 'hr';
/** تطبيق الموظف يستخدم مفتاحًا منفصلًا حتى لا يتداخل مع تطبيق الموارد البشرية */
export function setNamespace(ns) { RMK = 'ariba_rm_v2_' + ns; KNAME = ns; }
const hasCrypto = typeof crypto !== 'undefined' && !!crypto.subtle && typeof indexedDB !== 'undefined';

const b64 = (buf) => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); };
const unb64 = (s) => { const r = atob(s), a = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; };

export function getRec() { try { const r = localStorage.getItem(RMK); return r ? JSON.parse(r) : null; } catch { return null; } }
export function setRec(v) { try { if (v) localStorage.setItem(RMK, JSON.stringify(v)); else localStorage.removeItem(RMK); } catch { /* ignore */ } }

const idb = () => new Promise((res, rej) => { const q = indexedDB.open('ariba_rm_keys', 1); q.onupgradeneeded = () => q.result.createObjectStore('k'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
const idbGet = (k) => idb().then((db) => new Promise((res, rej) => { const r = db.transaction('k').objectStore('k').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
const idbPut = (k, v) => idb().then((db) => new Promise((res, rej) => { const t = db.transaction('k', 'readwrite'); t.objectStore('k').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }));
async function getKey() { let k = await idbGet(KNAME); if (k) return k; k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await idbPut(KNAME, k); return k; }
async function enc(txt) { const k = await getKey(), iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(txt)); return { iv: b64(iv), ct: b64(ct) }; }
async function dec(o) { try { const k = await idbGet(KNAME); if (!k || !o) return null; const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, k, unb64(o.ct)); return new TextDecoder().decode(pt); } catch { return null; } }

export async function biometricAvailable() {
  try { return !!(window.isSecureContext && window.PublicKeyCredential && hasCrypto && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
}
export async function rememberUser(username) { const old = getRec(); setRec({ u: username, rt: old && old.u === username ? old.rt || null : null, cred: old && old.u === username ? old.cred || null : null }); }
export function forget() { setRec(null); }
/** يحفظ الـrefresh-token مشفراً (يُستدعى بعد تسجيل الدخول لو البصمة مفعلة) */
export async function storeRefresh(rtok) { const rec = getRec(); if (!rec || !rec.cred || !hasCrypto) return; rec.rt = await enc(rtok); setRec(rec); }
export async function enableBiometric(rtok) {
  if (typeof rtok !== 'string') rtok = '';
  let rec = getRec();
  if (!rec) { const u = (auth.state.me && (auth.state.me.username || auth.state.me.email)) || ''; if (!u) return { ok: false, msg: T('سجّل الدخول مع تفعيل "تذكرني" مرة أولًا', 'Sign in with "Remember me" once first') }; await rememberUser(String(u).toLowerCase()); rec = getRec(); }
  if (!window.isSecureContext) return { ok: false, msg: T('البصمة لا تعمل إذا فُتح البرنامج كملف على الجهاز. افتحه من رابط https (موقع البرنامج).', 'Biometrics need the app to be opened from an https link, not a local file.') };
  if (!rtok) rtok = auth.state.rt || '';
  try {
    const cred = await navigator.credentials.create({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'ARIBA HR' }, user: { id: crypto.getRandomValues(new Uint8Array(16)), name: rec.u, displayName: rec.u }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000, attestation: 'none' } });
    if (!cred) return { ok: false };
    rec.cred = b64(cred.rawId); rec.rt = await enc(rtok); setRec(rec);
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
/** يتحقق بالبصمة ثم يرجع الـrefresh-token */
export async function biometricUnlock() {
  const rec = getRec(); if (!rec || !rec.cred || !rec.rt) return { ok: false };
  try { await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64(rec.cred), transports: ['internal'] }], userVerification: 'required', timeout: 60000 } }); }
  catch { return { ok: false, msg: T('تم إلغاء التحقق بالبصمة أو فشل. تقدر تدخل بكلمة المرور.', 'Biometric check failed or cancelled. You can sign in with your password.') }; }
  const rtok = await dec(rec.rt);
  if (!rtok) { rec.rt = null; rec.cred = null; setRec(rec); return { ok: false, msg: T('البيانات المحفوظة غير صالحة، اكتب كلمة المرور.', 'Saved data is invalid, please type your password.') }; }
  return { ok: true, rt: rtok, username: rec.u };
}
