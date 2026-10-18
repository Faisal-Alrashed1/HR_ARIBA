import { useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { T } from '../../lib/i18n.js';
import { getLists, saveLists } from '../../lib/masterLists.js';
import PromptModal from '../../components/PromptModal.jsx';
import { toast } from '../../components/Toast.jsx';

/** إدارة الأقسام وجهات العمل (V60): بتظهر في نموذج الموظف والفلاتر */
export default function MasterListsCard() {
  const { employees } = useApp();
  const [rev, setRev] = useState(0); const [ask, setAsk] = useState(null);
  const L = getLists(employees); void rev;
  const add = (kind, v) => {
    setAsk(null); v = (v || '').trim(); if (!v) return;
    const l = getLists(employees); if (l[kind].includes(v)) { toast(T('موجود بالفعل', 'Already exists'), 'ter'); return; }
    l[kind].push(v); saveLists(l); setRev((x) => x + 1); toast(T('✓ تم إضافة ', '✓ Added ') + v, 'tin');
  };
  const rm = (kind, v) => {
    const inUse = employees.some((e) => (kind === 'departments' ? e.dept === v : e.employer === v));
    if (inUse) { toast(T('لا يمكن حذف ' + v + ' لأنه مستخدم لدى موظف', 'Cannot delete ' + v + ' — it is used by an employee'), 'ter'); return; }
    const l = getLists(employees); l[kind] = l[kind].filter((x) => x !== v); saveLists(l); setRev((x) => x + 1);
  };
  const box = (kind, title) => (
    <div className="ariba-list-box">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><strong style={{ flex: 1 }}>{title}</strong><button className="btn bsm bpl" onClick={() => setAsk(kind)}>{T('+ إضافة', '+ Add')}</button></div>
      {L[kind].map((x) => <div className="ariba-list-row" key={x}><span>{x}</span><button className="btn bsm" style={{ color: 'var(--rd)' }} aria-label={T('حذف', 'Delete')} onClick={() => rm(kind, x)}><i className="ti ti-trash" /></button></div>)}
    </div>
  );
  return (
    <div id="ARIBA_MASTER_LISTS" className="card">
      <div className="g2">{box('departments', T('الأقسام', 'Departments'))}{box('employers', T('جهات العمل', 'Employers'))}</div>
      <PromptModal open={!!ask} title={ask === 'departments' ? T('القسم الجديد', 'New department') : T('جهة العمل الجديدة', 'New employer')} label={ask === 'departments' ? T('القسم الجديد:', 'New department:') : T('جهة العمل الجديدة:', 'New employer:')} required confirmText={T('إضافة', 'Add')} onConfirm={(v) => add(ask, v)} onClose={() => setAsk(null)} />
    </div>
  );
}
