import { useCallback, useEffect, useState } from 'react';
import { useLang } from '../../lib/i18n.js';
import { rpc } from '../../lib/api.js';
import { toast } from '../../components/Toast.jsx';

/** حذف شهر قديم من سجل التعديلات بموافقة المالية (V154) */
export default function PurgeBox() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a);
  const [info, setInfo] = useState(null), [err, setErr] = useState(''), [month, setMonth] = useState('');
  const ST = { pending: ['بانتظار موافقة المالية', 'Awaiting finance'], approved: ['موافق عليه — بانتظار المسح', 'Approved — pending deletion'], rejected: ['مرفوض', 'Rejected'], executed: ['تم', 'Done'] };
  const load = useCallback(async () => { try { const r = await rpc('ariba_audit_purge_info', {}); setInfo(r || {}); setErr(''); setMonth((m) => m || (((r && r.months) || [])[0] || {}).month || ''); } catch (e) { setErr(String((e && e.message) || e)); } }, []);
  useEffect(() => { load(); }, [load]);
  if (err) return <div id="AP_BOX" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--bd)', color: 'var(--rd)', fontSize: 12 }}>{err}</div>;
  if (!info) return null;
  const fin = !!info.is_finance, ms = info.months || [], rq = info.requests || [];
  async function req() { if (!month) return; try { const x = await rpc('ariba_audit_purge_request', { p_month: month }); toast(T('تم إرسال الطلب للمالية', 'Request sent to Finance') + (x && x.notified === 0 ? ' — ' + T('(مفيش حساب مالية نشط حاليًا)', '(no active Finance account)') : '')); } catch (e) { toast(String((e && e.message) || e), 'ter'); } load(); }
  async function decide(id, ap) { try { await rpc('ariba_audit_purge_decide', { p_request: id, p_approve: ap }); toast(ap ? T('تمت الموافقة', 'Approved') : T('تم الرفض', 'Rejected')); } catch (e) { toast(String((e && e.message) || e), 'ter'); } load(); }
  return (
    <div id="AP_BOX" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--bd)' }}>
      <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>{T('حذف شهر قديم من سجل التعديلات', 'Delete an old month from the audit log')}</div>
      <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 6 }}>{T('مسموح فقط للشهور الأقدم من 30 يوم، والطلب بيتبعت للمالية للموافقة.', 'Only months older than 30 days; the request goes to Finance for approval.')}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select id="AP_M" value={month} onChange={(e) => setMonth(e.target.value)} style={{ background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '6px 9px', fontSize: 12 }}>
          {ms.length ? ms.map((m) => <option key={m.month} value={m.month}>{m.month} ({m.count})</option>) : <option value="">{T('لا توجد شهور أقدم من 30 يوم', 'No months older than 30 days')}</option>}
        </select>
        <button className="btn bgr bsm" id="AP_REQ" disabled={!ms.length} onClick={req}>{T('طلب حذف', 'Request deletion')}</button>
      </div>
      {rq.length > 0 && <table style={{ width: '100%', marginTop: 8, fontSize: 11.5 }}><tbody>{rq.map((q) => <tr key={q.id}><td>{q.month}</td><td>{q.requester_name || ''}</td><td>{(ST[q.status] || [q.status, q.status])[en ? 1 : 0]}</td>
        <td>{fin && q.status === 'pending' && <><button className="btn bpl bsm" onClick={() => decide(q.id, true)}>{T('موافقة', 'Approve')}</button> <button className="btn bgr bsm" onClick={() => decide(q.id, false)}>{T('رفض', 'Reject')}</button></>}</td></tr>)}</tbody></table>}
    </div>
  );
}
