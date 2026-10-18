import { useMemo, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import { toast } from '../../components/Toast.jsx';
import { rpc } from '../../lib/api.js';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';

/** إعادة تعيين كلمة مرور موظف (كلمة مؤقتة تُعرض مرة واحدة) + قائمة الحسابات التي لم تغيّر كلمة المرور الافتراضية */
export default function PwReset({ open, onClose, preselect }) {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a); const { activeEmps } = useApp();
  const [id, setId] = useState(preselect ? String(preselect) : ''), [q, setQ] = useState(''), [busy, setBusy] = useState(false), [res, setRes] = useState(null), [dl, setDl] = useState(null);
  const list = useMemo(() => { const s = q.trim().toLowerCase(); return activeEmps.filter((e) => !s || (String(e.nameAr) + ' ' + String(e.nameEn || '') + ' ' + String(e.empNo || '')).toLowerCase().includes(s)); }, [activeEmps, q]);
  const emp = activeEmps.find((e) => String(e.id) === id);
  async function reset() {
    if (!emp) return toast(T('اختر الموظف', 'Select an employee'), 'ter');
    if (!window.confirm(T('هتطلع كلمة مرور مؤقتة جديدة لـ ' + emp.nameAr + '، والقديمة هتبطل. متأكد؟', 'Generate a new temporary password for ' + emp.nameAr + '? The old one will stop working.'))) return;
    setBusy(true);
    try { const r = await rpc('ariba_hr_reset_password', { p_employee_id: String(emp.id) }); setRes({ name: emp.nameAr, ...r }); }
    catch (e) { toast('❌ ' + (e.message || e), 'ter'); } finally { setBusy(false); }
  }
  async function pwList() { try { const r = await rpc('ariba_hr_default_password_list', {}); setDl((r && r.accounts) || []); } catch (e) { toast('❌ ' + (e.message || e), 'ter'); } }
  const copy = async (t) => { try { await navigator.clipboard.writeText(String(t)); toast(T('تم النسخ ✓', 'Copied ✓'), 'tin'); } catch { toast(String(t), 'tin'); } };
  const close = () => { setRes(null); setDl(null); setId(''); onClose(); };
  return (
    <Modal open={open} onClose={close} title={T('🔑 إعادة تعيين كلمة مرور', '🔑 Reset password')} width={460}>
      {!res ? <div>
        <input placeholder={T('بحث بالاسم / الرقم…', 'Search name / no…')} value={q} onChange={(x) => setQ(x.target.value)} style={{ width: '100%', marginBottom: 8 }} id="PW_Q" />
        <select id="PW_SEL" value={id} onChange={(x) => setId(x.target.value)} style={{ width: '100%', marginBottom: 10 }}><option value="">{T('— اختر الموظف —', '— Select employee —')}</option>{list.map((e) => <option key={e.id} value={e.id}>{e.nameAr}{e.empNo ? ' — ' + e.empNo : ''}</option>)}</select>
        <div style={{ display: 'flex', gap: 8 }}><button className="btn bpl" id="PW_GO" disabled={busy || !id} onClick={reset}>{busy ? T('جاري الإنشاء…', 'Generating…') : T('إنشاء كلمة مؤقتة', 'Generate temporary password')}</button><button className="btn" onClick={pwList}>{T('الحسابات بكلمة افتراضية', 'Accounts on default password')}</button></div>
        {dl && <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.8 }}>{!dl.length ? T('✅ كل الحسابات النشطة غيّرت كلمة المرور الافتراضية.', '✅ All active accounts changed the default password.') : <><b>{dl.length}</b> {T('حساب لسه على كلمة المرور الافتراضية أو المؤقتة:', 'accounts still on a default/temporary password:')}{dl.map((x, i) => <div key={i}>{x.name} — <span dir="ltr">{x.username}</span>{x.role !== 'employee' && <b> ({x.role})</b>}</div>)}</>}</div>}
      </div> : <div>
        <div>🔑 {T('كلمة مرور مؤقتة لـ ', 'Temporary password for ')}<b>{res.name}</b></div>
        <div style={{ margin: '10px 0', fontSize: 15 }}>{T('اسم المستخدم: ', 'Username: ')}<b dir="ltr">{res.username}</b><br />{T('كلمة المرور المؤقتة: ', 'Temporary password: ')}<b dir="ltr" id="PW_TMP" style={{ fontSize: 17 }}>{res.temporary_password}</b></div>
        <div className="al alb" style={{ marginBottom: 10 }}><span style={{ fontSize: 11 }}>{T('تظهر مرة واحدة فقط — سلّمها للموظف وسيُطلب منه تغييرها عند أول دخول.', 'Shown once only — give it to the employee; they must change it at first sign-in.')}</span></div>
        <div style={{ display: 'flex', gap: 8 }}><button className="btn bpl" onClick={() => copy(res.temporary_password)}>{T('نسخ', 'Copy')}</button><button className="btn" onClick={close}>{T('إغلاق', 'Close')}</button></div>
      </div>}
    </Modal>
  );
}
