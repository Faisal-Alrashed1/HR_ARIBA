import { useMemo, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { T } from '../../lib/i18n.js';
import { rpc } from '../../lib/api.js';
import * as auth from '../../lib/auth.js';
import { toast } from '../../components/Toast.jsx';
import ChangePw from '../../employee/ChangePw.jsx';
import EmpModal, { btnS } from '../../employee/EmpModal.jsx';
import { Card } from './shared.jsx';

/** كلمات المرور والأمان (V114): تغيير كلمة مرور حسابي + إعادة تعيين كلمة مرور موظف (مؤقتة تظهر مرة واحدة) */
export default function PwCard() {
  const { activeEmps } = useApp();
  const [chg, setChg] = useState(false), [q, setQ] = useState(''), [id, setId] = useState(''), [busy, setBusy] = useState(false), [res, setRes] = useState(null), [copied, setCopied] = useState(false);
  const list = useMemo(() => { const s = q.trim().toLowerCase(); return activeEmps.filter((e) => e && e.nameAr).slice().sort((a, b) => String(a.nameAr).localeCompare(String(b.nameAr), 'ar')).filter((e) => !s || (String(e.nameAr) + ' ' + String(e.nameEn || '') + ' ' + String(e.empNo || '')).toLowerCase().includes(s)); }, [activeEmps, q]);
  const reset = async () => {
    if (!id) { toast(T('اختر الموظف الأول', 'Select an employee first'), 'ter'); return; }
    const emp = activeEmps.find((e) => String(e.id) === String(id)); if (!emp) { toast(T('الموظف غير موجود', 'Employee not found'), 'ter'); return; }
    if (!window.confirm(T('هتطلع كلمة مرور مؤقتة جديدة لـ ' + emp.nameAr + '، والقديمة هتبطل. متأكد؟', 'Generate a new temporary password for ' + emp.nameAr + '? The old one will stop working.'))) return;
    setBusy(true);
    try { const r = await rpc('ariba_hr_reset_password', { p_employee_id: String(emp.id) }); setCopied(false); setRes({ name: emp.nameAr, ...r }); }
    catch (e) { toast('❌ ' + (e.message || e), 'ter'); } finally { setBusy(false); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(String(res.temporary_password || '')); setCopied(true); } catch { toast(String(res.temporary_password || ''), 'tin'); } };
  const canChange = !!auth.state.token;
  return (
    <Card icon="lock" title={T('كلمات المرور والأمان', 'Passwords & security')} id="aribaPwSetCard">
      <div style={{ marginTop: 10, fontWeight: 700 }}>{T('كلمة مرور حسابي', 'My account password')}</div>
      <div style={{ fontSize: 12, color: 'var(--mu)', margin: '4px 0 8px' }}>{T('غيّر كلمة مرور دخولك للبرنامج في أي وقت.', 'Change your sign-in password at any time.')}</div>
      <button type="button" className="btn bpl" id="aribaPwMineBtn" onClick={() => (canChange ? setChg(true) : toast(T('سجّل الدخول بحسابك الأول', 'Please sign in first'), 'ter'))}><i className="ti ti-key" /> {T('تغيير كلمة المرور', 'Change password')}</button>
      <div style={{ borderTop: '1px solid var(--bd)', margin: '16px 0 12px' }} />
      <div style={{ fontWeight: 700 }}>{T('إعادة تعيين كلمة مرور موظف', 'Reset an employee password')}</div>
      <div style={{ fontSize: 12, color: 'var(--mu)', margin: '4px 0 8px' }}>{T('بتطلع كلمة مرور مؤقتة، والقديمة بتبطل، والموظف بيغيّرها أول ما يدخل تطبيق الموظف.', 'Generates a temporary password, the old one stops working, and the employee must change it at first sign-in.')}</div>
      <div className="fg">
        <div><label>{T('بحث بالاسم أو الرقم الوظيفي', 'Search by name or employee no.')}</label><input id="aribaPwEmpQ" type="text" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div><label>{T('الموظف', 'Employee')}</label><select id="aribaPwEmpSel" value={id} onChange={(e) => setId(e.target.value)}><option value="">{T('— اختر الموظف —', '— Select employee —')}</option>{list.map((e) => <option key={e.id} value={e.id}>{e.nameAr + (e.empNo ? ' — ' + e.empNo : '')}</option>)}</select></div>
      </div>
      <button type="button" className="btn bpl" id="aribaPwResetBtn" style={{ marginTop: 10 }} disabled={busy} onClick={reset}><i className="ti ti-refresh" /> {busy ? T('جاري الإنشاء…', 'Generating…') : T('إعادة تعيين كلمة المرور', 'Reset password')}</button>
      {chg && <ChangePw onClose={() => setChg(false)} />}
      {res && (
        <EmpModal id="aribaPw2Result" onClose={() => setRes(null)}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>🔑 {T('كلمة مرور مؤقتة', 'Temporary password')}</div>
          <div style={{ fontSize: 13, marginBottom: 6 }}>{res.name}</div>
          <div style={{ background: '#f3f4f6', borderRadius: 10, padding: 12, marginBottom: 10, lineHeight: 2 }}>{T('اسم المستخدم', 'Username')}: <b dir="ltr">{res.username}</b><br />{T('كلمة المرور المؤقتة', 'Temporary password')}: <b dir="ltr" style={{ fontSize: 18 }} id="aribaPw2Tmp">{res.temporary_password}</b></div>
          <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7, marginBottom: 12 }}>{T('ادّيها للموظف. أول ما يدخل هيتطلب منه يغيّرها بكلمة خاصة بيه، وأي جهاز كان داخل على حسابه اتعمله خروج. مش هتظهر تاني بعد ما تقفل النافذة.', 'Give it to the employee. They must change it at first sign-in and any signed-in device is logged out. It will not be shown again after you close this window.')}</div>
          <div style={{ display: 'flex', gap: 8 }}><button type="button" style={btnS()} onClick={copy}>{copied ? T('تم النسخ ✓', 'Copied ✓') : T('نسخ', 'Copy')}</button><button type="button" style={btnS('ghost')} onClick={() => setRes(null)}>{T('إغلاق', 'Close')}</button></div>
        </EmpModal>)}
    </Card>
  );
}
