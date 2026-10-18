import { useEffect, useState } from 'react';
import * as auth from '../lib/auth.js';
import * as vault from '../lib/vault.js';
import { functionCall } from '../lib/api.js';
import { T, useLang } from '../lib/i18n.js';

const EYE = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
const EYEOFF = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5.6 19 2 12 2 12a18.3 18.3 0 0 1 4.1-5.1M9.9 5.2A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2" /><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22" /></svg>;

const inputStyle = { width: '100%', padding: '11px 14px', border: '1px solid #d8d0bd', borderRadius: 10, background: '#fffdf8', color: '#202522', fontSize: 14, direction: 'ltr', boxSizing: 'border-box', fontFamily: 'inherit' };
const labelStyle = { fontSize: 11, color: '#56766d', fontWeight: 700, display: 'block', marginBottom: 5 };

export default function Login() {
  useLang();
  const rec = vault.getRec();
  const [u, setU] = useState(rec ? rec.u : '');
  const [p, setP] = useState('');
  const [show, setShow] = useState(false);
  const [rm, setRm] = useState(!!rec);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState({ t: '', good: false });
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState(false);
  const [rec2, setRec2] = useState(rec);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    vault.biometricAvailable().then(setBio);
    try { const why = sessionStorage.getItem('ariba_logout_reason'); if (why) { sessionStorage.removeItem('ariba_logout_reason'); if (why === 'idle') setMsg({ t: T('انتهت الجلسة بسبب عدم النشاط. سجّل الدخول من جديد.', 'Session ended due to inactivity. Please sign in again.'), good: false }); } } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (!show) return undefined; const t = setTimeout(() => setShow(false), 15000); return () => clearTimeout(t); }, [show]);

  async function doLogin(e) {
    e && e.preventDefault();
    const uu = u.trim(), pp = p.trim();
    if (!uu || !pp || busy) return;
    setBusy(true); setErr('');
    const r = await auth.login(uu, pp);
    setBusy(false);
    if (!r.ok) { setErr('❌ ' + r.error); return; }
    if (rm) { await vault.rememberUser(uu); const rc = vault.getRec(); if (rc && rc.cred) await vault.storeRefresh(auth.state.rt); setRec2(vault.getRec()); if (bio && !(rc && rc.cred) && !(rc && rc.nudged)) { try { sessionStorage.setItem('ariba_bio_nudge', '1'); } catch { /* ignore */ } } }
    else vault.forget();
  }
  async function doBio() {
    setBusy(true);
    const r = await vault.biometricUnlock();
    if (!r.ok) { setBusy(false); setMsg({ t: r.msg || '', good: false }); return; }
    const l = await auth.loginWithRefresh(r.rt);
    setBusy(false);
    if (!l.ok) { setMsg({ t: T('انتهت صلاحية الدخول المحفوظ، اكتب كلمة المرور.', 'Saved sign-in expired, please type your password.'), good: false }); return; }
    await vault.storeRefresh(auth.state.rt);
  }
  return (
    <div id="LG" style={{ position: 'fixed', inset: 0, background: '#F4F0E6', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <form onSubmit={doLogin} style={{ background: '#fffdf8', border: '1px solid #d8d0bd', borderRadius: 20, padding: '36px 28px', width: '100%', maxWidth: 360, textAlign: 'center', direction: 'rtl', boxShadow: '0 18px 44px rgba(20,35,29,.16)', color: '#173d33' }} autoComplete="on">
        <div style={{ fontSize: 36, fontWeight: 900, color: '#29B35E', letterSpacing: 3, marginBottom: 4 }}>ARIBA HR</div>
        <div style={{ fontSize: 13, color: '#7a8d86', marginBottom: 28 }}>نظام إدارة الموارد البشرية</div>
        <div style={{ textAlign: 'start', marginBottom: 12 }}>
          <label htmlFor="LU" style={labelStyle}>{T('اسم المستخدم', 'Username')}</label>
          <input id="LU" name="username" type="text" placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" style={inputStyle} />
        </div>
        <div style={{ textAlign: 'start', marginBottom: 14 }}>
          <label htmlFor="LP" style={labelStyle}>{T('كلمة المرور', 'Password')}</label>
          <span className="ariba-eye-wrap" style={{ position: 'relative', display: 'block', width: '100%' }}>
            <input id="LP" name="password" type={show ? 'text' : 'password'} placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" style={{ ...inputStyle, paddingRight: 36 }} />
            <button type="button" className="ariba-eye-btn" tabIndex={-1} aria-label={show ? T('إخفاء كلمة المرور', 'Hide password') : T('إظهار كلمة المرور', 'Show password')} title={show ? T('إخفاء كلمة المرور', 'Hide password') : T('إظهار كلمة المرور', 'Show password')}
              onMouseDown={(e) => e.preventDefault()} onClick={() => setShow((s) => !s)}
              style={{ position: 'absolute', top: 0, bottom: 0, right: 2, width: 34, border: 0, background: 'transparent', cursor: 'pointer', color: show ? '#29B35E' : '#8a94a0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>{show ? EYEOFF : EYE}</button>
          </span>
        </div>
        <div id="ax-row" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 14px', fontSize: 12, color: '#56766d', textAlign: 'start' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0 }}>
            <input type="checkbox" id="ax-rm" checked={rm} onChange={(e) => setRm(e.target.checked)} style={{ width: 'auto', margin: 0, padding: 0 }} />
            <span>{T('تذكرني على هذا الجهاز', 'Remember me on this device')}</span>
          </label>
        </div>
        <button id="LB" type="submit" disabled={busy} style={{ width: '100%', padding: 13, background: '#29B35E', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? '…' : T('دخول', 'Sign in')}</button>
        <div id="ax-below" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', textAlign: 'center', fontSize: 12 }}>
          <button type="button" id="ax-bio" disabled={busy} aria-disabled={!bio || !(rec2 && rec2.cred && rec2.rt) || busy} onClick={() => { if (!bio || !(rec2 && rec2.cred && rec2.rt)) { setMsg({ t: T('سجّل الدخول أولًا ثم فعّل البصمة لهذا الجهاز.', 'Sign in first, then enable fingerprint / Face ID for this device.'), good: false }); return; } doBio(); }} style={{ width: '100%', padding: 11, border: '1px solid #d8d0bd', background: '#fffdf8', color: '#014D3D', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: (!bio || !(rec2 && rec2.cred && rec2.rt) || busy) ? 'not-allowed' : 'pointer', opacity: (!bio || !(rec2 && rec2.cred && rec2.rt)) ? .78 : 1, fontFamily: 'inherit' }}>🔐 {T('الدخول بالبصمة / Face ID', 'Sign in with fingerprint / Face ID')}</button>
          <a href="#" id="ax-forgot" onClick={(e) => { e.preventDefault(); setForgot(true); }} style={{ color: '#014D3D', textDecoration: 'none', fontWeight: 700 }}>{T('نسيت كلمة المرور؟', 'Forgot password?')}</a>
          {rec2 && <a href="#" id="ax-forget" onClick={(e) => { e.preventDefault(); vault.forget(); setRec2(null); setRm(false); setMsg({ t: T('تم نسيان هذا الجهاز', 'This device has been forgotten'), good: true }); }} style={{ color: '#7a8d86', textDecoration: 'none', fontSize: 11 }}>{T('نسيان هذا الجهاز (حذف البيانات المحفوظة)', 'Forget this device (delete saved data)')}</a>}
          {msg.t && <div id="ax-msg" style={{ fontSize: 12, color: msg.good ? '#16834a' : '#9a6700' }}>{msg.t}</div>}
        </div>
        {err && <div id="LE" role="alert" style={{ display: 'block', color: '#9f2d2d', fontSize: 12, marginTop: 10, padding: 9, background: 'rgba(248,113,113,.08)', borderRadius: 8 }}>{err}</div>}
      </form>
      {forgot && <ForgotDialog onClose={() => setForgot(false)} />}
    </div>
  );
}

const card = { background: '#fff', color: '#111', borderRadius: 16, maxWidth: 380, width: '100%', padding: 22, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.4)' };
const ov = { position: 'fixed', inset: 0, zIndex: 2147483646, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const bs = (primary) => ({ flex: 1, padding: 11, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: primary ? 'none' : '1px solid #ccc', background: primary ? '#29B35E' : '#fff', color: primary ? '#fff' : '#333' });

export function ForgotDialog({ onClose }) {
  const [mode, setMode] = useState('user');
  const [v, setV] = useState('');
  const [msg, setMsg] = useState({ t: '', ok: false });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function go() {
    const val = v.trim(); if (!val) { setMsg({ t: T('اكتب القيمة المطلوبة', 'Please enter a value'), ok: false }); return; }
    setBusy(true);
    try {
      const r = await functionCall('ariba-password-recovery', mode === 'user' ? { username: val } : { iqama: val });
      if (r.data && r.data.ok) { setMsg({ t: (r.data.message || '') + (r.data.sent_to ? ' (' + r.data.sent_to + ')' : ''), ok: true }); setDone(true); }
      else if (r.status === 404 || !r.data) setMsg({ t: T('الخدمة غير متاحة حاليًا. كلّم الموارد البشرية.', 'The service is unavailable right now. Contact HR.'), ok: false });
      else setMsg({ t: (r.data && r.data.message) || T('تعذر تنفيذ الطلب', 'Request failed'), ok: false });
    } catch { setMsg({ t: T('تعذر الاتصال بالخادم. تأكد من الإنترنت وحاول تاني.', 'Could not reach the server. Check your connection.'), ok: false }); }
    setBusy(false);
  }
  return (
    <div style={ov} role="dialog" aria-modal="true">
      <div style={{ ...card, textAlign: 'right' }}>
        <div style={{ fontSize: 34, textAlign: 'center' }}>🔑</div>
        <div style={{ fontWeight: 800, fontSize: 16, margin: '8px 0', textAlign: 'center' }}>{T('استرجاع بيانات الدخول', 'Recover your login')}</div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 10 }}>{mode === 'user' ? T('اكتب اسم المستخدم وهنبعتلك كلمة مرور مؤقتة على الإيميل المسجّل.', 'Enter your username and we will email you a temporary password.') : T('اكتب رقم الإقامة وهنبعتلك اسم المستخدم وكلمة مرور مؤقتة على الإيميل المسجّل.', 'Enter your Iqama number and we will email you your username and a temporary password.')}</div>
        <label style={{ fontSize: 12, color: '#444', fontWeight: 700 }}>{mode === 'user' ? T('اسم المستخدم', 'Username') : T('رقم الإقامة', 'Iqama number')}</label>
        <input id="ax-f-in" autoComplete="off" inputMode={mode === 'iq' ? 'numeric' : undefined} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #ccc', borderRadius: 10, fontSize: 14, direction: 'ltr', marginTop: 6, background: '#fff', color: '#111' }} autoFocus />
        <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'user' ? 'iq' : 'user'); setMsg({ t: '', ok: false }); }} style={{ display: 'block', margin: '10px 0', fontSize: 12, color: 'var(--ariba-bright,#29B35E)', textDecoration: 'none' }}>{mode === 'user' ? T('نسيت اسم المستخدم؟ استخدم رقم الإقامة', 'Forgot your username? Use your Iqama number') : T('عندي اسم المستخدم', 'I know my username')}</a>
        <div style={{ fontSize: 12, minHeight: 16, marginBottom: 10, color: msg.ok ? '#15803d' : '#b45309' }}>{msg.t}</div>
        <div style={{ display: 'flex', gap: 8 }}><button style={bs(0)} onClick={onClose}>{T('إغلاق', 'Close')}</button>{!done && <button style={bs(1)} disabled={busy} onClick={go}>{busy ? T('جاري الإرسال…', 'Sending…') : T('إرسال', 'Send')}</button>}</div>
      </div>
    </div>
  );
}
