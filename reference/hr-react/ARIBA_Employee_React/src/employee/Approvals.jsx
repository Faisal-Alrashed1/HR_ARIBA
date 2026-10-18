import { useEffect, useState } from 'react';
import { rpc } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import PromptModal from '../components/PromptModal.jsx';
import { useEmp } from './EmpStore.jsx';
import { useLang } from '../lib/i18n.js';
import { T, lvName } from './util.jsx';
import { reqDetail } from './Leaves.jsx';
import { downloadDoc } from './Prof.jsx';
import MgrSignDocs from './MgrSignDocs.jsx';

/** تبويب الموافقات للمدير/الموارد البشرية/الرئيس التنفيذي */
export default function Approvals() {
  useLang();
  const { queue, loadQueue, reload } = useEmp();
  const [loading, setLoading] = useState(true), [rej, setRej] = useState(null), [busy, setBusy] = useState('');
  useEffect(() => { loadQueue().finally(() => setLoading(false)); }, []); // eslint-disable-line
  async function act(id, action, reason) {
    setBusy(id);
    try { await rpc('ariba_workflow_action', { p_request_id: id, p_action: action, p_reason: reason || null }); toast(action === 'approved' ? '✅ ' + T('تمت الموافقة وانتقل الطلب للمرحلة التالية', 'Approved — moved to the next stage') : '❌ ' + T('تم رفض الطلب', 'Request rejected'), 'tin'); await reload(true); await loadQueue(); }
    catch (e) { toast(e.message || T('تعذر تنفيذ الإجراء', 'Could not complete the action'), 'ter'); }
    finally { setBusy(''); }
  }
  if (loading) return <div className="card"><div className="card-title">⏳ {T('الموافقات', 'Approvals')}</div><div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>{T('جاري تحميل الطلبات...', 'Loading requests…')}</div></div>;
  if (!queue.length) return <div><MgrSignDocs /><div className="card" id="noApprovals" style={{ textAlign: 'center', padding: 35, color: 'var(--mu)' }}>✅ {T('لا توجد طلبات بانتظار موافقتك حالياً.', 'No requests are awaiting your approval.')}</div></div>;
  return (
    <div id="approvalsTab">
      <MgrSignDocs />
      <div className="card"><div className="card-title">{T('طلبات بانتظار موافقتك', 'Requests awaiting your approval')} <span className="b ba">{queue.length}</span></div>
        {queue.map((x) => { const r = x.request || {}, e = x.employee || {}, name = e.nameAr || e.na || e.nameEn || r.employee_id || T('الموظف', 'Employee'), atts = x.attachments || []; return (
          <div key={r.id} className="apv-card" data-id={r.id} style={{ background: 'var(--c2)', border: '1px solid var(--bd)', borderInlineStart: '3px solid var(--am)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{name}</strong><span className="b ba">{lvName(r.request_type)}</span></div>
            <div style={{ fontSize: 11, color: 'var(--mu)', margin: '6px 0' }}>{reqDetail(r)}</div>
            {r.payload && r.payload.submitted_by_manager && <div style={{ fontSize: 11, color: 'var(--bl)', marginBottom: 6 }}>👤 {T('قدّمه المدير بالنيابة: ', 'Submitted on behalf by: ')}{r.payload.submitted_by_name || ''}</div>}
            {r.payload && Array.isArray(r.payload.returned) && r.payload.returned.length > 0 && <div style={{ fontSize: 11, color: 'var(--am)', marginBottom: 6 }}>↩ {T('أعادته الموارد البشرية: ', 'Returned by HR: ')}{(r.payload.returned[r.payload.returned.length - 1] || {}).note}</div>}
            {r.payload && r.payload.notes && <div style={{ fontSize: 11, color: 'var(--dm)', marginBottom: 8 }}>{r.payload.notes}</div>}
            {atts.map((a) => <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, margin: '5px 0', fontSize: 11 }}><span>{a.document_type} — {a.file_name}</span><button className="btn bsm" onClick={() => downloadDoc(a.id)}>⬇ {T('فتح', 'Open')}</button></div>)}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-success" data-act="approve" style={{ flex: 1 }} disabled={busy === r.id} onClick={() => act(r.id, 'approved')}>✓ {T('موافقة', 'Approve')}</button>
              <button className="btn btn-danger" data-act="reject" style={{ flex: 1 }} disabled={busy === r.id} onClick={() => setRej(r.id)}>✗ {T('رفض', 'Reject')}</button>
            </div>
          </div>); })}
      </div>
      <div className="card"><div className="card-title">{T('مسار الطلب', 'Approval path')}</div><div style={{ fontSize: 11, color: 'var(--mu)' }}>{T('الموظف → المدير المباشر → الموارد البشرية → الرئيس التنفيذي → الموظف', 'Employee → direct manager → HR → CEO → employee')}</div></div>
      <PromptModal open={!!rej} title={T('سبب الرفض', 'Rejection reason')} label={T('سبب الرفض', 'Rejection reason')} required danger confirmText={T('رفض', 'Reject')} onClose={() => setRej(null)} onConfirm={(v) => { const id = rej; setRej(null); act(id, 'rejected', v); }} />
    </div>
  );
}
