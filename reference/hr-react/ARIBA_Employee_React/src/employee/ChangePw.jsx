import { useState } from 'react';
import { rpc } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import EmpModal, { INP, btnS } from './EmpModal.jsx';
import { T } from './util.jsx';

/** تغيير كلمة المرور: اختياري في أي وقت، أو إجباري (forced) لمن يدخل بكلمة المرور الافتراضية */
export default function ChangePw({ onClose, forced, username }) {
  const [o, setO] = useState(''), [n, setN] = useState(''), [n2, setN2] = useState(''), [show, setShow] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const fail = (m) => { setErr(m); setBusy(false); };
  async function save() {
    if (!o || !n) return fail(T('اكتب كلمة المرور الحالية والجديدة', 'Enter the current and new password'));
    if (n !== n2) return fail(T('كلمتين المرور الجديدتين مش زي بعض', 'The new passwords do not match'));
    if (n.length < 8) return fail(T('كلمة المرور الجديدة لازم 8 حروف على الأقل', 'New password must be at least 8 characters'));
    if (!/[A-Za-zء-ي]/.test(n) || !/[0-9٠-٩]/.test(n)) return fail(T('لازم تحتوي على حروف وأرقام', 'It must contain letters and numbers'));
    if (n === o) return fail(T('الكلمة الجديدة لازم تختلف عن الحالية', 'New password must differ from the current one'));
    setBusy(true); setErr('');
    try { await rpc('ariba_change_my_password', { p_old: o, p_new: n }); toast('✓ ' + T('تم تغيير كلمة المرور', 'Password changed'), 'tin'); onClose(true); }
    catch (e) { fail(e.message || T('حصلت مشكلة', 'Something went wrong')); }
  }
  const t = show ? 'text' : 'password';
  return (
    <EmpModal id={forced ? 'aribaPwModal' : 'aribaPw2Modal'} onClose={() => onClose(false)} locked={forced}>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>🔒 {forced ? T('غيّر كلمة المرور', 'Change your password') : T('تغيير كلمة المرور', 'Change password')}</div>
      <div style={{ fontSize: 12.5, color: '#555', lineHeight: 1.7, marginBottom: 14 }}>
        {forced ? <>{T('حسابك ', 'Your account ')}<b>{String(username || '').replace(/[<>&"]/g, '')}</b>{T(' لسه على كلمة المرور الافتراضية، ودي معروفة وسهل تتخمن. لازم تغيّرها عشان تكمل.', ' is still on the default password, which is well known. You must change it to continue.')}</>
          : T('اكتب كلمة المرور الحالية ثم الجديدة. هتشتغل من أول تسجيل دخول بعد الحفظ.', 'Enter your current password, then the new one. It works from your next sign-in.')}
      </div>
      <input id="apwOld" type={t} placeholder={T('كلمة المرور الحالية', 'Current password')} autoComplete="current-password" style={INP} value={o} onChange={(e) => setO(e.target.value)} autoFocus />
      <input id="apwNew" type={t} placeholder={T('كلمة المرور الجديدة (8 على الأقل، حروف وأرقام)', 'New password (min 8, letters and numbers)')} autoComplete="new-password" style={INP} value={n} onChange={(e) => setN(e.target.value)} />
      <input id="apwNew2" type={t} placeholder={T('أعد كتابة كلمة المرور الجديدة', 'Repeat new password')} autoComplete="new-password" style={INP} value={n2} onChange={(e) => setN2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#444', marginBottom: 10, cursor: 'pointer' }}><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} style={{ width: 'auto' }} /> {T('إظهار كلمات المرور', 'Show passwords')}</label>
      {err && <div id="apwErr" style={{ color: '#b91c1c', fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button id="apwBtn" type="button" style={btnS()} disabled={busy} onClick={save}>{busy ? T('جاري الحفظ…', 'Saving…') : T('حفظ كلمة المرور', 'Save password')}</button>
        {!forced && <button type="button" style={btnS('ghost')} onClick={() => onClose(false)}>{T('إلغاء', 'Cancel')}</button>}
      </div>
    </EmpModal>
  );
}
