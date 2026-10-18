import { useCallback, useEffect, useState } from 'react';
import { rpc } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { useEmp } from './EmpStore.jsx';
import { useLang } from '../lib/i18n.js';
import { T, isEN, fDMY } from './util.jsx';
import SigManager from './SigManager.jsx';
import { getSig, injectSignature, b64Utf8, utf8FromB64 } from '../lib/signature.js';

const TYPE_AR = { onboarding: ['مباشرة عمل', 'Start of employment'], custody: ['استلام عهدة تقنية', 'IT equipment custody'], extension: ['تمديد فترة التجربة', 'Probation extension'], termination: ['إشعار إنهاء فترة التجربة', 'Probation termination notice'] };
const TYPE_ICON = { onboarding: 'ti-login-2', custody: 'ti-device-laptop', extension: 'ti-calendar-plus', termination: 'ti-calendar-x' };

/** عرض مستند HTML في نافذة معزولة (iframe sandbox) بدل document.write */
function viewHtml(html) {
  const parts = String(html).split('<!--ARIBA_EN-->'), body = (isEN() && parts[1]) ? parts[1] : parts[0];
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-modals'); f.title = 'document';
  f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;background:#fff;z-index:2147483645';
  f.srcdoc = /<html[\s>]/i.test(body) ? body : '<!doctype html><html dir="' + (isEN() ? 'ltr' : 'rtl') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:12px">' + body + '</body></html>';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '✕ ' + T('إغلاق', 'Close'); close.id = 'docViewClose';
  close.style.cssText = 'position:fixed;top:10px;inset-inline-end:10px;z-index:2147483646;background:#014D3D;color:#fff;border:0;border-radius:10px;padding:8px 14px;font-weight:700;cursor:pointer;font-family:inherit';
  close.onclick = () => { f.remove(); close.remove(); };
  document.body.appendChild(f); document.body.appendChild(close);
}

export default function Docs() {
  useLang();
  const { me, loadDocsN, reload } = useEmp();
  const owner = me && (me.empNo || me.id), [sigOpen, setSigOpen] = useState(false), [states, setStates] = useState({}), [hasSig, setHasSig] = useState(!!getSig(owner));
  const [list, setList] = useState(null), [err, setErr] = useState(''), [rej, setRej] = useState({}), [busy, setBusy] = useState('');
  const load = useCallback(async () => { try {
    const l = await rpc('ariba_employee_pending_templates', {}); const arr = Array.isArray(l) ? l : [];
    let st = {}; try { const r = await rpc('ariba_doc_my_states', {}); (Array.isArray(r) ? r : []).forEach((x) => { st[String(x.request_id)] = x; }); } catch { st = {}; }
    setStates(st);
    // وقّع المدير: نكمل موافقة الموظف المعتادة تلقائياً ليصل المستند للموارد البشرية
    for (const x of arr) { const g = st[String(x.request_id)]; if (g && g.stage === 'hr' && g.needs_manager) { try { await rpc('ariba_employee_ack_template', { p_request_id: x.request_id, p_action: 'approved', p_reason: null }); } catch { /* قد يكون انتقل بالفعل */ } } }
    setList(arr.filter((x) => { const g = st[String(x.request_id)]; return !(g && g.stage === 'hr' && g.needs_manager); })); setErr(''); loadDocsN(); } catch (e) { setErr(e.message || T('تعذر التحميل', 'Could not load')); setList([]); } }, [loadDocsN]);
  useEffect(() => { load(); }, [load]);

  async function view(did) {
    if (!did) { toast(T('المستند غير متاح', 'Document unavailable'), 'ter'); return; }
    try {
      const d = await rpc('ariba_get_document', { p_document_id: did });
      if (!d || !d.base64) { toast(T('تعذر فتح المستند', 'Could not open the document'), 'ter'); return; }
      const bin = atob(d.base64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      viewHtml(new TextDecoder('utf-8').decode(u8));
    } catch (e) { toast(e.message || T('تعذر فتح المستند', 'Could not open the document'), 'ter'); }
  }
  async function ack(rid, action, reason) {
    if (action === 'rejected' && (!reason || reason.trim().length < 3)) { toast(T('برجاء كتابة سبب الرفض', 'Please write the rejection reason'), 'ter'); return; }
    setBusy(rid);
    try { await rpc('ariba_employee_ack_template', { p_request_id: rid, p_action: action, p_reason: reason || null }); toast(action === 'approved' ? '✅ ' + T('تمت الموافقة', 'Approved') : T('تم إرسال الرفض بالسبب المذكور', 'Rejection sent with your reason'), 'tin'); await load(); reload(true); }
    catch (e) { toast(e.message || T('تعذر إرسال الرد', 'Could not send the reply'), 'ter'); }
    finally { setBusy(''); }
  }
  async function signApprove(x) {
    const rid = String(x.request_id), sig = getSig(owner);
    if (!sig) { setSigOpen(true); toast(T('أضف توقيعك أولاً ثم اضغط «موافق مع التوقيع»', 'Add your signature first, then press “Approve with signature”'), 'tin'); return; }
    if (!x.document_id) { toast(T('المستند غير متاح', 'Document unavailable'), 'ter'); return; }
    if (!window.confirm(T('سيُضاف توقيعك على المستند في مكان توقيع الموظف ويُرسل للمسؤول. متأكد؟', 'Your signature will be placed on the document and it will be sent on. Continue?'))) return;
    setBusy(rid);
    try {
      const d = await rpc('ariba_get_document', { p_document_id: x.document_id });
      if (!d || !d.base64) throw new Error(T('تعذر فتح المستند', 'Could not open the document'));
      const signed = injectSignature(utf8FromB64(d.base64), 'employee', sig, me && me.name);
      const r = await rpc('ariba_doc_employee_sign', { p_request_id: rid, p_document_id: x.document_id, p_template_type: x.template_type || '', p_signed_base64: b64Utf8(signed) });
      if (r && r.next === 'manager') toast('✍️ ' + T('تم التوقيع، المستند الآن عند مديرك المباشر لتوقيعه ثم يذهب للموارد البشرية', 'Signed. The document is now with your direct manager, then HR'), 'tin');
      else { await rpc('ariba_employee_ack_template', { p_request_id: rid, p_action: 'approved', p_reason: null }); toast('✅ ' + T('تمت الموافقة بالتوقيع وأُرسل المستند للموارد البشرية', 'Approved with signature and sent to HR'), 'tin'); }
      await load(); reload(true);
    } catch (e) { toast(e.message || T('تعذر التوقيع', 'Could not sign'), 'ter'); }
    finally { setBusy(''); }
  }
  async function del(rid) {
    if (!window.confirm(T('حذف المستند؟', 'Delete the document?'))) return;
    try { await rpc('ariba_delete_request', { p_request_id: rid }); toast('✓ ' + T('اتحذف', 'Deleted'), 'tin'); await load(); }
    catch (e) { toast(T('تعذر الحذف: ', 'Could not delete: ') + (e.message || ''), 'ter'); }
  }
  return (
    <div id="docsTab"><div className="card"><div className="card-title">📄 {T('مستندات بانتظار توقيعي', 'Documents awaiting my signature')}
        <button type="button" id="mySigBtn" className="btn" style={{ float: 'inline-end', fontSize: 11, padding: '4px 10px' }} onClick={() => setSigOpen(true)}>✍️ {hasSig ? T('توقيعي', 'My signature') : T('أضف توقيعي', 'Add my signature')}</button></div>
      {sigOpen && <SigManager ownerId={owner} onClose={() => setSigOpen(false)} onSaved={(d) => setHasSig(!!d)} />}
      <div id="pendingDocsList">
        {list === null && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 16, fontSize: 12 }}>{T('جاري التحميل...', 'Loading…')}</div>}
        {err && <div style={{ padding: 14, color: '#e5484d' }}>{err}</div>}
        {list && !list.length && !err && <div style={{ padding: 14, color: 'var(--mu)', textAlign: 'center' }}>{T('لا توجد مستندات بانتظار توقيعك حاليًا ✓', 'No documents are awaiting your signature ✓')}</div>}
        {(list || []).map((x) => { const rid = String(x.request_id), g = states[rid], ty = TYPE_AR[x.template_type], name = ty ? T(ty[0], ty[1]) : (x.title || x.template_type), r = rej[rid]; return (
          <div className="card doc-card" key={rid} data-rid={rid} style={{ marginBottom: 10, padding: 12, textAlign: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><i className={'ti ' + (TYPE_ICON[x.template_type] || 'ti-file-text')} style={{ fontSize: 18, color: 'var(--pri,var(--gr))' }} /><strong style={{ fontSize: 13 }}>{name}</strong></div>
            <div style={{ fontSize: 10.5, color: 'var(--mu)', marginBottom: 10 }}>{fDMY(x.created_at)}</div>
            <button className="btn" style={{ width: '100%', marginBottom: 6, background: 'var(--c2)', border: '1px solid var(--bd)' }} onClick={() => view(x.document_id)}><i className="ti ti-eye" /> {T('عرض المستند', 'View document')}</button>
            {g && g.stage === 'manager' && <div className="wait-mgr" style={{ padding: 8, borderRadius: 8, background: 'rgba(245,158,11,.15)', fontSize: 12, marginBottom: 6 }}>⏳ {T('وقّعت — بانتظار توقيع مديرك المباشر قبل أن يذهب للموارد البشرية', 'Signed — waiting for your direct manager before it goes to HR')}</div>}
            {g && g.stage === 'rejected' && <div style={{ padding: 8, borderRadius: 8, background: 'rgba(229,72,77,.12)', fontSize: 12, marginBottom: 6 }}>❌ {T('رفض المدير التوقيع: ', 'Manager declined: ')}{g.reject_reason}</div>}
            {!g && <button className="btn" data-act="sign" disabled={busy === rid} style={{ width: '100%', marginBottom: 6, background: 'var(--bp,#014D3D)', color: '#fff' }} onClick={() => signApprove(x)}><i className="ti ti-signature" /> {T('موافق مع التوقيع', 'Approve with signature')}</button>}
            {!g && <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" data-act="approve" disabled={busy === rid} style={{ flex: 1, background: '#12b76a', color: '#fff' }} onClick={() => ack(rid, 'approved', null)}><i className="ti ti-check" /> {T('موافقة بدون توقيع', 'Approve (no signature)')}</button>
              <button className="btn" data-act="reject" style={{ flex: 1, background: '#e5484d', color: '#fff' }} onClick={() => setRej({ ...rej, [rid]: r == null ? '' : undefined })}><i className="ti ti-x" /> {T('رفض', 'Reject')}</button>
            </div>}
            {!g && r != null && <div style={{ marginTop: 8 }}>
              <textarea rows={2} placeholder={T('اكتب سبب الرفض هنا (إجباري)...', 'Write the rejection reason (required)...')} style={{ width: '100%', fontSize: 11 }} value={r} onChange={(e) => setRej({ ...rej, [rid]: e.target.value })} />
              <button className="btn rej-confirm" disabled={r.trim().length < 3 || busy === rid} style={{ width: '100%', marginTop: 6, background: '#e5484d', color: '#fff', opacity: r.trim().length >= 3 ? 1 : 0.5 }} onClick={() => ack(rid, 'rejected', r)}>{T('تأكيد الرفض', 'Confirm rejection')}</button></div>}
            <button type="button" className="btn" style={{ width: '100%', marginTop: 6, background: 'transparent', color: '#e5484d', border: '1px solid rgba(229,72,77,.5)' }} onClick={() => del(rid)}>🗑 {T('حذف المستند', 'Delete the document')}</button>
          </div>); })}
      </div></div></div>
  );
}
