import { useCallback, useEffect, useState } from 'react';
import { rpc } from '../../lib/api.js';
import { T, getLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import PromptModal from '../../components/PromptModal.jsx';
import { Card, Note } from './shared.jsx';

const ML = { staff: ['الدخول الأساسي', 'Basic access'], employees: ['بيانات الموظفين (إضافة وتعديل)', 'Employee data (add / edit)'], employees_admin: ['حذف وإنهاء وإيقاف الموظفين وكلمات المرور', 'Delete / terminate / deactivate employees & passwords'], attachments: ['مرفقات الموظفين', 'Employee attachments'], attendance: ['الحضور والانصراف', 'Attendance'], locations: ['مواقع البصمة', 'Punch locations'], leaves: ['الإجازات', 'Leaves'], requests: ['الطلبات والموافقات', 'Requests & approvals'], payroll: ['المسير والجزء المالي', 'Payroll & finance'], payroll_prepare: ['تجهيز المسير للمالية', 'Prepare payroll for finance'], payroll_approve: ['اعتماد المسير وفتحه', 'Approve / reopen payroll'], settlement: ['المخالصة', 'Settlement'], documents: ['الوثائق', 'Documents'], forms: ['النماذج', 'Forms'], reports: ['التقارير', 'Reports'], settings: ['الإعدادات', 'Settings'], permissions: ['الصلاحيات', 'Permissions'], audit: ['سجل التعديلات', 'Audit log'], assets: ['الأصول والعهد', 'Assets & custody'] };
const RL = { hr: ['الموارد البشرية', 'HR'], admin_manager: ['المدير الإداري', 'Administrative manager'], finance: ['المالية', 'Finance'], ceo: ['الرئيس التنفيذي', 'CEO'], chairman: ['رئيس مجلس الإدارة / المدير العام', 'Chairman / General manager'], admin: ['Admin (الافتراضي)', 'Admin (default)'], employee: ['موظف (تطبيق الموظف فقط)', 'Employee (employee app only)'] };
const LV = { none: ['لا', 'None'], view: ['اطلاع', 'View'], edit: ['كامل', 'Full'] };
const ROLE_ORDER = ['employee', 'hr', 'admin_manager', 'finance', 'ceo', 'chairman', 'admin'];
const lab = (o, k) => (o[k] ? o[k][getLang() === 'en' ? 1 : 0] : k);
const sel = { background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--tx)', padding: '3px 6px', fontSize: 11.5 };
const th = { padding: '6px 8px', borderBottom: '2px solid var(--bl)', fontSize: 11, textAlign: 'center', whiteSpace: 'nowrap', background: 'var(--c2)' };
const td = { padding: '5px 8px', borderBottom: '1px solid rgba(36,48,68,.25)', fontSize: 11.5, textAlign: 'center' };

export default function PermsCard() {
  const [MT, setMT] = useState(null), [acc, setAcc] = useState([]), [err, setErr] = useState(''), [ask, setAsk] = useState(null);
  const load = useCallback(async () => {
    try { const [m, a] = await Promise.all([rpc('ariba_perms_matrix'), rpc('ariba_hr_list_roles').catch(() => [])]); setMT(m); setAcc(Array.isArray(a) ? a : (a && a.accounts) || []); setErr(''); }
    catch (e) { setErr(e.message || String(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const setLevel = async (r, m, v) => { try { await rpc('ariba_perms_set', { p_role: r, p_module: m, p_level: v }); toast('✓ ' + T('اتحفظت الصلاحية', 'Permission saved'), 'tin'); } catch (e) { toast(T('تعذر الحفظ: ', 'Could not save: ') + (e.message || e), 'ter'); } load(); };
  const setRole = async () => { const a = ask; setAsk(null); try { await rpc('ariba_hr_set_role', { p_employee_id: a.employee_id, p_role: a.role }); toast('✓ ' + T('اتغيّر الدور', 'Role updated'), 'tin'); } catch (e) { toast(T('تعذر التغيير: ', 'Could not change: ') + (e.message || e), 'ter'); } load(); };
  return (
    <Card icon="shield-lock" title={T('الصلاحيات والأشخاص', 'Permissions & people')} max={1000} id="PM_CARD">
      <Note style={{ marginBottom: 10 }}>{T('اختار لكل دور يشوف ويعدّل إيه. الحماية بتتفرض على السيرفر (مش بس إخفاء أزرار). Admin ورئيس المجلس صلاحياتهم كاملة دايماً. أي تغيير بيتسجّل في سجل التعديلات.', 'Choose what each role can see and edit. Enforced on the server. Admin and Chairman always have full access. Changes are logged.')}</Note>
      {err && <div style={{ color: 'var(--rd)', fontSize: 12 }}>{err}</div>}
      {!MT && !err && <div style={{ color: 'var(--mu)' }}>…</div>}
      {MT && (<>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'right' }}>{T('الوحدة', 'Module')}</th>{MT.roles.map((r) => <th key={r} style={th}>{lab(RL, r)}</th>)}<th style={th}>{T('رئيس المجلس / Admin', 'Chairman / Admin')}</th></tr></thead>
            <tbody>{MT.modules.map((m) => (
              <tr key={m}><td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{lab(ML, m)}</td>
                {MT.roles.map((r) => (<td key={r} style={td}><select style={sel} className="pm-sel" data-r={r} data-m={m} disabled={!MT.can_edit} value={MT.matrix[r + '.' + m] || 'none'} onChange={(e) => setLevel(r, m, e.target.value)}>{['none', 'view', 'edit'].map((k) => <option key={k} value={k}>{lab(LV, k)}</option>)}</select></td>))}
                <td style={{ ...td, color: 'var(--gr)', fontWeight: 700 }}>{lab(LV, 'edit')}</td></tr>))}</tbody>
          </table>
        </div>
        <div style={{ fontWeight: 700, margin: '14px 0 6px' }}>{T('الأشخاص والأدوار', 'People & roles')}</div>
        <div style={{ overflow: 'auto', maxHeight: 340 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'right' }}>{T('الاسم', 'Name')}</th><th style={th}>{T('اسم المستخدم', 'Username')}</th><th style={th}>{T('الدور', 'Role')}</th></tr></thead>
            <tbody>{acc.map((a) => (
              <tr key={a.employee_id || a.username}><td style={{ ...td, textAlign: 'right' }}>{a.name_ar || ''}</td><td style={td}>{a.username || ''}</td>
                <td style={td}><select style={sel} className="pm-role" disabled={!MT.can_edit} value={a.role || 'employee'} onChange={(e) => setAsk({ ...a, role: e.target.value })}>{ROLE_ORDER.map((r) => <option key={r} value={r}>{lab(RL, r)}</option>)}</select></td></tr>))}</tbody>
          </table>
        </div>
      </>)}
      <PromptModal open={!!ask} noInput title={T('تغيير الدور', 'Change role')} message={ask ? T(`تغيير دور ${ask.username} إلى "${lab(RL, ask.role)}"؟`, `Change the role of ${ask.username} to "${lab(RL, ask.role)}"?`) : ''} confirmText={T('تأكيد', 'Confirm')} onConfirm={setRole} onClose={() => setAsk(null)} />
    </Card>
  );
}
