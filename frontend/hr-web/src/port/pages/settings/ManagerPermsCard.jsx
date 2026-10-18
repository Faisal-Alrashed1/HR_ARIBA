import { useEffect, useState } from 'react';
import { T, useLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import { getManagerPerms, setManagerPerms, MGR_PERM_KEYS } from '../../lib/leaves.js';
import { Card, Note } from './shared.jsx';

/** صلاحيات المديرين المباشرين: كل مدير يرى فقط ما تختاره الموارد البشرية له (فريقه فقط) */
export default function ManagerPermsCard() {
  const en = useLang() === 'en';
  const [rows, setRows] = useState(null); const [busy, setBusy] = useState('');
  const load = () => getManagerPerms().then(setRows).catch((e) => { setRows([]); toast(e.message, 'ter'); });
  useEffect(() => { load(); }, []);
  const toggle = (mid, k) => setRows((rs) => rs.map((r) => r.manager_id !== mid ? r : { ...r, perms: { ...r.perms, [k]: !(k in r.perms ? r.perms[k] : k === 'approve_requests') }, dirty: true }));
  const val = (r, k) => (k in r.perms ? !!r.perms[k] : k === 'approve_requests');
  async function save(r) {
    setBusy(r.manager_id);
    try { const full = {}; MGR_PERM_KEYS.forEach(([k]) => { full[k] = val(r, k); }); await setManagerPerms(r.manager_id, full); toast('✓ ' + T('اتحفظت صلاحيات ', 'Saved permissions for ') + r.name, 'tin'); await load(); }
    catch (e) { toast(e.message, 'ter'); } finally { setBusy(''); }
  }
  return (
    <Card icon="users-group" title={T('صلاحيات المديرين المباشرين', 'Direct-manager permissions')} id="MGR_PERMS" max={1100}>
      <Note style={{ marginBottom: 8 }}>{T('المدير يرى بيانات فريقه فقط، وبالقدر الذي تحدده هنا. التقديم بالنيابة يتطلب أيضاً تفعيل الموظف «تفويض المدير المباشر» من تطبيقه.', 'A manager sees only his own team, limited to what you tick here. Submitting on behalf also requires the employee to enable "delegate direct manager" in his app.')}</Note>
      {rows === null && <Note>…</Note>}
      {rows && !rows.length && <Note>{T('لا يوجد مديرون مباشرون (لا موظفين لهم مدير مُعيَّن).', 'No direct managers (no employees have a manager assigned).')}</Note>}
      {rows && rows.length > 0 && <div style={{ overflowX: 'auto' }}><table className="tbl" style={{ width: '100%', fontSize: 12 }}>
        <thead><tr><th>{T('المدير', 'Manager')}</th><th>{T('الفريق', 'Team')}</th>{MGR_PERM_KEYS.map(([k, a, e]) => <th key={k} style={{ fontSize: 10.5 }}>{en ? e : a}</th>)}<th /></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.manager_id}>
          <td><b>{r.name}</b><div style={{ fontSize: 10, color: 'var(--mu)' }}>{r.job || ''} #{r.manager_id}</div></td><td>{r.team}</td>
          {MGR_PERM_KEYS.map(([k]) => <td key={k} style={{ textAlign: 'center' }}><input type="checkbox" checked={val(r, k)} onChange={() => toggle(r.manager_id, k)} /></td>)}
          <td><button className="btn bpl bsm" disabled={busy === r.manager_id || !r.dirty} onClick={() => save(r)}>{T('حفظ', 'Save')}</button></td></tr>)}</tbody></table></div>}
    </Card>
  );
}
