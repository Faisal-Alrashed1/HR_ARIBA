import { useEffect, useState } from 'react';
import * as auth from '../lib/auth.js';
import * as vault from '../lib/vault.js';
import { ForgotDialog } from '../components/Login.jsx';
import { T, useLang } from '../lib/i18n.js';

/** شاشة دخول الموظف: نفس تصميم النسخة القديمة + تذكرني / البصمة / نسيت كلمة المرور */
export default function EmpLogin() {
  useLang();
  const rec = vault.getRec();
  const [u, setU] = useState(rec ? rec.u : ''), [p, setP] = useState(''), [show, setShow] = useState(false), [rm, setRm] = useState(!!rec);
  const [err, setErr] = useState(''), [msg, setMsg] = useState({ t: '', good: false }), [busy, setBusy] = useState(false), [bio, setBio] = useState(false), [rec2, setRec2] = useState(rec), [forgot, setForgot] = useState(false);
  useEffect(() => {
    vault.biometricAvailable().then(setBio);
    try { const why = sessionStorage.getItem('ariba_logout_reason'); if (why) { sessionStorage.removeItem('ariba_logout_reason'); if (why === 'idle') setMsg({ t: T('انتهت الجلسة بسبب عدم النشاط. سجّل الدخول من جديد.', 'Session ended due to inactivity. Please sign in again.'), good: false }); } } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (!show) return undefined; const t = setTimeout(() => setShow(false), 15000); return () => clearTimeout(t); }, [show]);

  async function doLogin(e) {
    e && e.preventDefault();
    const uu = u.trim(), pp = p.trim(); if (!uu || !pp || busy) return;
    setBusy(true); setErr('');
    const r = await auth.login(uu, pp); setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    if (rm) { await vault.rememberUser(uu); const rc = vault.getRec(); if (rc && rc.cred) await vault.storeRefresh(auth.state.rt); setRec2(vault.getRec()); if (bio && !(rc && rc.cred) && !(rc && rc.nudged)) { try { sessionStorage.setItem('ariba_bio_nudge', '1'); } catch { /* ignore */ } } }
    else vault.forget();
  }
  async function doBio() {
    setBusy(true); const r = await vault.biometricUnlock();
    if (!r.ok) { setBusy(false); setMsg({ t: r.msg || '', good: false }); return; }
    const l = await auth.loginWithRefresh(r.rt); setBusy(false);
    if (!l.ok) { setMsg({ t: T('انتهت صلاحية الدخول المحفوظ، اكتب كلمة المرور.', 'Saved sign-in expired, please type your password.'), good: false }); return; }
    await vault.storeRefresh(auth.state.rt);
  }
  return (
    <div className="screen on" id="sc-login">
      <div className="login-wrap">
        <form className="login-box" onSubmit={doLogin} autoComplete="on">
          <div className="login-logo"><div className="logo-big">ARIBA</div><div className="logo-sub">تطبيق الموظف | Employee App</div></div>
          <div className="fg">
            <label htmlFor="loginUser">{T('اسم المستخدم', 'Username')}</label>
            <input id="loginUser" name="username" placeholder="EMPxxx" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} />
            <label htmlFor="loginPass">{T('كلمة المرور', 'Password')}</label>
            <span style={{ position: 'relative', display: 'block' }}>
              <input id="loginPass" name="password" type={show ? 'text' : 'password'} placeholder="****" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} />
              <button type="button" tabIndex={-1} aria-label={show ? T('إخفاء كلمة المرور', 'Hide password') : T('إظهار كلمة المرور', 'Show password')} onMouseDown={(e) => e.preventDefault()} onClick={() => setShow((s) => !s)}
                style={{ position: 'absolute', top: 0, bottom: 12, insetInlineEnd: 4, width: 34, border: 0, background: 'transparent', cursor: 'pointer', color: show ? 'var(--ba,#29B35E)' : '#8a94a0', fontSize: 16 }}><i className={'ti ' + (show ? 'ti-eye-off' : 'ti-eye')} /></button>
            </span>
          </div>
          <label id="ax-row" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 12px', fontSize: 12, color: 'var(--mu)', cursor: 'pointer' }}>
            <input type="checkbox" id="ax-rm" checked={rm} onChange={(e) => setRm(e.target.checked)} style={{ width: 'auto', margin: 0 }} /><span>{T('تذكرني على هذا الجهاز', 'Remember me on this device')}</span>
          </label>
          {err && <div className="login-err" id="loginErr" role="alert" style={{ display: 'block' }}>{err}</div>}
          <button className="btn-login" id="LB" type="submit" disabled={busy}>{busy ? '…' : T('دخول', 'Sign in')}</button>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center', fontSize: 12 }}>
            <button type="button" id="ax-bio" disabled={busy} aria-disabled={!bio || !(rec2 && rec2.cred && rec2.rt) || busy} onClick={() => { if (!bio || !(rec2 && rec2.cred && rec2.rt)) { setMsg({ t: T('سجّل الدخول أولًا ثم فعّل البصمة لهذا الجهاز.', 'Sign in first, then enable fingerprint / Face ID for this device.'), good: false }); return; } doBio(); }} style={{ width: '100%', padding: 11, border: '1px solid #D8D0BD', background: '#FFFDF8', color: '#014D3D', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: (!bio || !(rec2 && rec2.cred && rec2.rt) || busy) ? 'not-allowed' : 'pointer', opacity: (!bio || !(rec2 && rec2.cred && rec2.rt)) ? .78 : 1, fontFamily: 'inherit' }}>🔐 {T('الدخول بالبصمة / Face ID', 'Sign in with fingerprint / Face ID')}</button>
            <a href="#" id="ax-forgot" onClick={(e) => { e.preventDefault(); setForgot(true); }} style={{ color: 'var(--gr)', textDecoration: 'none', fontWeight: 700 }}>{T('نسيت كلمة المرور؟', 'Forgot password?')}</a>
            {rec2 && <a href="#" id="ax-forget" onClick={(e) => { e.preventDefault(); vault.forget(); setRec2(null); setRm(false); setMsg({ t: T('تم نسيان هذا الجهاز', 'This device has been forgotten'), good: true }); }} style={{ color: 'var(--mu)', textDecoration: 'none', fontSize: 11 }}>{T('نسيان هذا الجهاز (حذف البيانات المحفوظة)', 'Forget this device (delete saved data)')}</a>}
            {msg.t && <div id="ax-msg" style={{ color: msg.good ? 'var(--gr)' : 'var(--am)' }}>{msg.t}</div>}
          </div>
        </form>
      </div>
      {forgot && <ForgotDialog onClose={() => setForgot(false)} />}
    </div>
  );
}
