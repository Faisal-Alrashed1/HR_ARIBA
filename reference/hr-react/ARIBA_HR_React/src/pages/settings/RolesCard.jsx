import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { T } from '../../lib/i18n.js';
import { rpc } from '../../lib/api.js';
import { toast } from '../../components/Toast.jsx';
import { Card } from './shared.jsx';

const ROLE_LABELS = { employee: ['موظف عادي', 'Regular employee'], manager: ['مدير (مدير مباشر)', 'Manager (line manager)'], finance: ['مالية', 'Finance'], hr: ['موارد بشرية', 'Human resources'], admin_manager: ['مدير إداري', 'Admin manager'], ceo: ['رئيس تنفيذي', 'CEO'], chairman: ['رئيس مجلس الإدارة (كل الصلاحيات)', 'Chairman (all permissions)'], admin: ['Admin (كل الصلاحيات)', 'Admin (all permissions)'] };
const rl = (k) => (ROLE_LABELS[k] ? T(ROLE_LABELS[k][0], ROLE_LABELS[k][1]) : k);
const lb = { fontSize: 10, color: 'var(--mu)', display: 'block', marginBottom: 2 };

/** صلاحيات المستخدمين (V83): اختيار موظف + دوره، وجدول بكل الأدوار الحالية */
export default function RolesCard() {
  const { employees } = useApp();
  const [emp, setEmp] = useState(''), [role, setRole] = useState('employee'), [rows, setRows] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const list = employees.filter((e) => e && (e.nameAr || e.nameEn) && !e.isTerminated && !e.term);
  const refresh = async () => { setErr(''); setRows(null); try { const r = await rpc('ariba_hr_list_roles', {}); setRows(Array.isArray(r) ? r : []); } catch (e) { setErr(e.message || T('تعذر التحميل', 'Could not load')); setRows([]); } };
  useEffect(() => { refresh(); }, []);
  const save = async () => {
    if (!emp) { toast(T('اختر الموظف أولاً', 'Select an employee first'), 'ter'); return; }
    const e = list.find((x) => String(x.id) === String(emp)); const lookup = e && e.empNo != null && e.empNo !== '' ? String(e.empNo) : String(emp);
    setBusy(true);
    try { await rpc('ariba_hr_set_role', { p_employee_id: lookup, p_role: role }); toast(T('✓ تم ضبط الصلاحية: ', '✓ Role set: ') + rl(role), 'tin'); refresh(); }
    catch (x) { toast('⚠️ ' + (x.message || T('تعذر الحفظ', 'Could not save')), 'ter'); } finally { setBusy(false); }
  };
  return (
    <Card icon="shield-lock" title={T('صلاحيات المستخدمين', 'User roles')} max={9999} id="V83_ROLES_CARD">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 220 }}><label style={lb}>{T('الموظف', 'Employee')}</label>
          <select id="V83_EMP" value={emp} onChange={(e) => setEmp(e.target.value)} style={{ width: '100%' }}><option value="">{T('— اختر الموظف —', '— Select employee —')}</option>{list.map((e) => <option key={e.id} value={e.id}>{e.nameAr || e.nameEn || e.id}</option>)}</select></div>
        <div style={{ minWidth: 180 }}><label style={lb}>{T('الصلاحية الجديدة', 'New role')}</label>
          <select id="V83_ROLE" value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%' }}>{Object.keys(ROLE_LABELS).map((k) => <option key={k} value={k}>{rl(k)}</option>)}</select></div>
        <button className="btn bsm" style={{ background: 'var(--ariba-dark,#014D3D)', color: '#fff' }} disabled={busy} onClick={save}><i className="ti ti-device-floppy" /> {T('حفظ', 'Save')}</button>
      </div>
      <div id="V83_CURRENT" style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 10 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <b style={{ fontSize: 12 }}>{T('الصلاحيات الحالية لكل المستخدمين', 'Current roles of all users')}</b>
        <button className="btn bsm" onClick={refresh}><i className="ti ti-refresh" /> {T('تحديث القائمة', 'Refresh list')}</button>
      </div>
      <div id="V83_LIST" style={{ maxHeight: 280, overflowY: 'auto' }}>
        {rows === null ? <div style={{ padding: 10, textAlign: 'center', color: 'var(--mu)', fontSize: 11 }}>{T('جاري التحميل...', 'Loading...')}</div>
          : err ? <div style={{ padding: 10, textAlign: 'center', color: 'var(--rd)', fontSize: 11 }}>{err}</div>
          : !rows.length ? <div style={{ padding: 10, textAlign: 'center', color: 'var(--mu)', fontSize: 11 }}>{T('لا توجد بيانات', 'No data')}</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead><tr style={{ color: 'var(--mu)', textAlign: 'start' }}><th style={{ padding: 5 }}>{T('الاسم', 'Name')}</th><th style={{ padding: 5 }}>{T('اليوزر', 'Username')}</th><th style={{ padding: 5 }}>{T('الصلاحية', 'Role')}</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} style={{ borderTop: '1px solid var(--bd)' }}><td style={{ padding: 5 }}>{r.name_ar || r.employee_id}</td><td style={{ padding: 5, fontFamily: 'monospace' }}>{r.username}</td><td style={{ padding: 5 }}><b>{rl(r.role)}</b></td></tr>)}</tbody></table>}
      </div>
    </Card>
  );
}
