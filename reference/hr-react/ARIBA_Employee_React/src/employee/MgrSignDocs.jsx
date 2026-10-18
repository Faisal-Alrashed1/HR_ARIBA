import { useCallback, useEffect, useState } from 'react';
import { rpc } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { useLang } from '../lib/i18n.js';
import { useEmp } from './EmpStore.jsx';
import SigManager from './SigManager.jsx';
import { T, fDMY } from './util.jsx';
import { getSig, injectSignature, b64Utf8, utf8FromB64 } from '../lib/signature.js';

/** مستندات وقّعها الموظف وتنتظر توقيع المدير المباشر. تقف هنا حتى يوقّع ثم تذهب للموارد البشرية */
export default function MgrSignDocs() {
  useLang();
  const { me } = useEmp(), owner = me && (me.empNo || me.id);
  const [list, setList] = useState([]), [busy, setBusy] = useState(''), [open, setOpen] = useState(false), [rej, setRej] = useState({}), [view, setView] = useState(null);
  const load = useCallback(async () => { try { const l = await rpc('ariba_doc_manager_pending', {}); setList(Array.isArray(l) ? l : []); } catch { setList([]); } }, []);
  useEffect(() => { load(); }, [load]);
  async function getHtml(did) { const d = await rpc('ariba_get_document', { p_document_id: did }); if (!d || !d.base64) throw new Error(T('تعذر فتح المستند', 'Could not open the document')); return utf8FromB64(d.base64); }
  async function show(x) { try { setView(await getHtml(x.document_id)); } catch (e) { toast(e.message, 'ter'); } }
  async function sign(x) {
    const sig = getSig(owner); if (!sig) { setOpen(true); toast(T('أضف توقيعك أولاً', 'Add your signature first'), 'tin'); return; }
    if (!window.confirm(T('سيُضاف توقيعك كمدير مباشر ثم يذهب المستند للموارد البشرية. متأكد؟', 'Your signature will be added and the document goes to HR. Continue?'))) return;
    setBusy(x.request_id);
    try { const html = injectSignature(await getHtml(x.document_id), 'manager', sig, me && me.name);
      await rpc('ariba_doc_manager_sign', { p_request_id: x.request_id, p_action: 'approved', p_signed_base64: b64Utf8(html), p_reason: null });
      toast('✅ ' + T('تم توقيعك وتحويل المستند للموارد البشرية', 'Signed and sent to HR'), 'tin'); await load(); }
    catch (e) { toast(e.message || T('تعذر التوقيع', 'Could not sign'), 'ter'); } finally { setBusy(''); }
  }
  async function reject(x) {
    const r = rej[x.request_id] || ''; if (r.trim().length < 3) { toast(T('اكتب سبب الرفض', 'Write the reason'), 'ter'); return; }
    setBusy(x.request_id);
    try { await rpc('ariba_doc_manager_sign', { p_request_id: x.request_id, p_action: 'rejected', p_signed_base64: null, p_reason: r }); toast(T('تم الرفض وإبلاغ الموظف', 'Rejected'), 'tin'); await load(); }
    catch (e) { toast(e.message, 'ter'); } finally { setBusy(''); }
  }
  if (!list.length && !open) return null;
  return (
    <div className="card" id="mgrSignDocs"><div className="card-title">✍️ {T('مستندات بانتظار توقيعي كمدير', 'Documents awaiting my signature as manager')} <span className="b ba">{list.length}</span>
      <button type="button" className="btn" style={{ float: 'inline-end', fontSize: 11, padding: '4px 10px' }} onClick={() => setOpen(true)}>✍️ {T('توقيعي', 'My signature')}</button></div>
      {open && <SigManager ownerId={owner} onClose={() => setOpen(false)} />}
      {view != null && <div style={{ position: 'fixed', inset: 0, zIndex: 2147483645, background: '#fff' }}><button type="button" className="btn" style={{ position: 'fixed', top: 10, insetInlineEnd: 10, zIndex: 2147483646 }} onClick={() => setView(null)}>✕ {T('إغلاق', 'Close')}</button>
        <iframe title="doc" sandbox="" style={{ width: '100%', height: '100%', border: 0 }} srcDoc={String(view).split('<!--ARIBA_EN-->')[0]} /></div>}
      {list.map((x) => <div key={x.request_id} className="msd-card" data-rid={x.request_id} style={{ background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
        <strong>{x.employee_name || x.employee_id}</strong><div style={{ fontSize: 10.5, color: 'var(--mu)', margin: '2px 0 8px' }}>{T('وقّعه الموظف ', 'Employee signed ')}{fDMY(x.emp_signed_at)}</div>
        <button className="btn" style={{ width: '100%', marginBottom: 6 }} onClick={() => show(x)}><i className="ti ti-eye" /> {T('عرض المستند', 'View document')}</button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn" data-act="msign" disabled={busy === x.request_id} style={{ flex: 1, background: '#12b76a', color: '#fff' }} onClick={() => sign(x)}>✍️ {T('وقّع واعتمد', 'Sign & approve')}</button>
          <button className="btn" style={{ flex: 1, background: '#e5484d', color: '#fff' }} onClick={() => setRej({ ...rej, [x.request_id]: rej[x.request_id] == null ? '' : undefined })}>{T('رفض', 'Reject')}</button></div>
        {rej[x.request_id] != null && <div style={{ marginTop: 6 }}><textarea rows={2} style={{ width: '100%' }} placeholder={T('سبب الرفض (إجباري)', 'Reason (required)')} value={rej[x.request_id]} onChange={(e) => setRej({ ...rej, [x.request_id]: e.target.value })} />
          <button className="btn" style={{ width: '100%', marginTop: 4, background: '#e5484d', color: '#fff' }} onClick={() => reject(x)}>{T('تأكيد الرفض', 'Confirm')}</button></div>}
      </div>)}
    </div>
  );
}
