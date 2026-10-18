import { useState } from 'react';
import { useEmp } from './EmpStore.jsx';
import { rpc } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { useLang } from '../lib/i18n.js';
import { T, fileToData, MAX_ATT, riyadhNow } from './util.jsx';
import { statusOf } from './Leaves.jsx';

export default function Overtime() {
  useLang();
  const { me, reload } = useEmp();
  const [date, setDate] = useState(riyadhNow().date), [hours, setHours] = useState('1'), [notes, setNotes] = useState(''), [file, setFile] = useState(null), [busy, setBusy] = useState(false);
  if (!me) return null;
  const list = (me.requests || []).filter((r) => r.request_type === 'overtime');
  async function submit() {
    const h = parseFloat(hours) || 0;
    if (!date || h <= 0) { toast(T('حدد التاريخ وعدد الساعات', 'Select date and hours'), 'ter'); return; }
    let att = null;
    if (file) { if (file.size > MAX_ATT) { toast(T('حجم المرفق يتجاوز 12 MB', 'Attachment exceeds 12 MB'), 'ter'); return; } att = await fileToData(file); }
    setBusy(true);
    try { await rpc('ariba_submit_request', { p_type: 'overtime', p_payload: { date, hours: h, notes }, p_attachment_name: att ? att.name : null, p_attachment_mime: att ? att.mime : null, p_attachment_base64: att ? att.data : null }); toast(T('تم إرسال طلب العمل الإضافي', 'Overtime request submitted'), 'tin'); setNotes(''); setFile(null); await reload(true); }
    catch (e) { toast(e.message || T('تعذر إرسال الطلب', 'Unable to submit request'), 'ter'); }
    finally { setBusy(false); }
  }
  return (
    <div id="otTab">
      <div className="card">
        <div className="card-title">⏱️ {T('طلب عمل إضافي', 'Overtime request')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><label>{T('التاريخ', 'Date')}</label><input id="otDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label>{T('عدد الساعات', 'Hours')}</label><input id="otHours" type="number" min="0.5" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
        </div>
        <label>{T('السبب / المهمة', 'Reason / Task')}</label><textarea id="otNotes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <label>📎 {T('مرفق (اختياري)', 'Attachment (optional)')}</label><input id="otAttachment" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(e) => setFile(e.target.files && e.target.files[0] || null)} />
        <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4 }}>{T('يمكن إرسال الطلب بدون مرفق. الحد الأقصى 12 MB.', 'Attachment is optional. Maximum 12 MB.')}</div>
        <button className="btn btn-primary" id="otSubmit" style={{ width: '100%', marginTop: 10 }} disabled={busy} onClick={submit}>⏱️ {T('إرسال الطلب', 'Submit request')}</button>
      </div>
      <div className="card">
        <div className="card-title">📋 {T('طلبات العمل الإضافي', 'Overtime requests')}</div>
        {list.length ? list.map((r) => { const st = statusOf(r); return <div key={r.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--bd)', fontSize: 11 }}><strong>{(r.payload && r.payload.date) || ''}</strong> — {(r.payload && r.payload.hours) || 0} {T('ساعة', 'hours')} <span className={'b ' + st[1]}>{st[0]}</span></div>; })
          : <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 10 }}>{T('لا توجد طلبات', 'No requests')}</div>}
      </div>
    </div>
  );
}
