import { useMemo, useState } from 'react';
import { useEmp } from './EmpStore.jsx';
import { rpc } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { useLang } from '../lib/i18n.js';
import { LVL, PERM_TYPES, T, isEN, lvName, num, workdays, calendarDays, fileToData, MAX_ATT, fD, riyadhNow } from './util.jsx';
import { useAppNav } from './nav.jsx';
import Delegation from './Delegation.jsx';

export function statusOf(r) {
  if (r.status === 'approved') return [T('موافق', 'Approved'), 'bg'];
  if (r.status === 'rejected') return [T('مرفوض', 'Rejected'), 'br'];
  if (r.current_stage === 'manager') return [T('بانتظار المدير المباشر', 'Pending direct manager'), 'ba'];
  if (r.current_stage === 'hr') return [T('بانتظار الموارد البشرية', 'Pending HR'), 'ba'];
  if (r.current_stage === 'ceo') return [T('بانتظار الرئيس التنفيذي', 'Pending CEO'), 'ba'];
  return [T('معلق', 'Pending'), 'ba'];
}
export const FILTER_TYPES = (k) => k !== 'iban_change' && k !== 'profile_edit';
export function reqDetail(r) {
  const p = r.payload || {};
  if (r.request_type === 'forgot_punch') { const k = { in: T('دخول', 'Check-in'), out: T('خروج', 'Check-out'), both: T('دخول وخروج', 'Both') }[p.kind] || ''; return [k, p.date, p.time, p.time2 ? '→ ' + p.time2 : ''].filter(Boolean).join(' '); }
  if (r.request_type === 'iban_change') return 'IBAN: ' + (p.iban || '') + ' — ' + (p.bank || '');
  if (r.request_type === 'profile_edit') return Object.keys(p.changes || {}).map((k) => k + ': ' + p.changes[k]).join(' | ');
  if (r.request_type === 'document') return p.doc_label || '';
  if (r.request_type === 'overtime') return (p.date || '') + (p.hours ? ' | ' + p.hours + T(' ساعة', ' h') : '');
  if (p.from || p.to) return (p.from || '') + ' ← ' + (p.to || '') + (p.days != null ? ' | ' + p.days + T(' يوم', ' days') : '');
  if (p.date) return p.date + (p.time ? ' ' + p.time : '') + (p.dur ? ' | ' + p.dur + T(' ساعة', ' h') : '');
  if (p.amount && !p.from) return T('المبلغ: ', 'Amount: ') + Number(p.amount).toLocaleString('en-US') + T(' ر.س', ' SAR');
  return p.notes || '';
}

/** حذف/إخفاء طلب */
export async function removeRequest(r, { reload, hide }) {
  const approved = r.status === 'approved', isTpl = String(r.request_type || '').indexOf('template:') === 0;
  const msg = approved && !isTpl ? T('إخفاء الطلب من قائمتك؟', 'Hide this request from your list?') : (isTpl ? T('حذف المستند؟', 'Delete the document?') : T('حذف الطلب؟', 'Delete the request?'));
  if (!window.confirm(msg)) return;
  if (approved && !isTpl) { hide(String(r.id)); toast('✓ ' + T('اتشال من قائمتك', 'Removed from your list'), 'tin'); return; }
  try { await rpc('ariba_delete_request', { p_request_id: r.id }); toast('✓ ' + T('اتحذف', 'Deleted'), 'tin'); await reload(true); }
  catch (e) { const m = String((e && e.message) || e); toast(T('تعذر الحذف: ', 'Could not delete: ') + (m === 'CANNOT_DELETE_APPROVED' ? T('الطلب معتمد', 'the request is approved') : m), 'ter'); }
}

export default function Leaves() {
  useLang();
  const { me, reload, hidden, hide } = useEmp(); const nav = useAppNav();
  const [type, setType] = useState('annual');
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [pd, setPd] = useState(riyadhNow().date), [pt, setPt] = useState(''), [dur, setDur] = useState('1'), [amount, setAmount] = useState(''), [notes, setNotes] = useState('');
  const [file, setFile] = useState(null), [busy, setBusy] = useState(false);
  const holidays = (me && me.holidays) || [];
  const reqs = useMemo(() => ((me && me.requests) || []).filter((r) => String(r.request_type || '').indexOf('template:') !== 0 && !hidden.includes(String(r.id))), [me, hidden]);
  const upcoming = useMemo(() => { const t = riyadhNow().date; return holidays.filter((h) => (h.date || '') >= t).sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 4); }, [holidays]);
  if (!me) return null;
  const isPerm = PERM_TYPES.includes(type), isAdv = type === 'advance' || type === 'salary_advance';
  const days = !isPerm && !isAdv && from && to && to >= from ? (type === 'annual' ? workdays(from, to, holidays) : calendarDays(from, to)) : 0;
  const remain = Number(me.leave_bal || 0) - days;
  // إجازة (مرضية/اضطرارية/...) داخل إجازة سنوية معتمدة: أيام العمل المشتركة بترجع لرصيد السنوية بعد الاعتماد
  const INT = ['sick', 'emergency', 'death', 'marriage', 'paternity', 'maternity', 'hajj', 'umrah', 'unpaid'];
  const backDays = (INT.includes(type) && from && to && to >= from) ? reqs.filter((r) => r.request_type === 'annual' && r.status === 'approved' && r.payload && r.payload.from).reduce((n, r) => {
    const a = from > r.payload.from ? from : r.payload.from, b = to < (r.payload.to || r.payload.from) ? to : (r.payload.to || r.payload.from);
    return b >= a ? n + workdays(a, b, holidays) : n;
  }, 0) : 0;

  async function submit() {
    const p = { notes }; let ok = true;
    if (isAdv) { p.amount = parseFloat(amount || 0); if (!(p.amount > 0)) { toast(T('أدخل مبلغ السلفة', 'Enter the advance amount'), 'ter'); return; }
      if (type === 'salary_advance' && !notes.trim()) { toast(T('اكتب سبب طلب الراتب المقدم', 'Write the reason for the advance'), 'ter'); return; } }
    else if (isPerm) { p.date = pd; p.time = pt; p.dur = parseFloat(dur || 0) || 0; if (!p.date || !p.time) { toast(T('حدد التاريخ والوقت', 'Select date and time'), 'ter'); return; } }
    else {
      if (!from || !to || to < from) { toast(T('حدد الفترة بشكل صحيح', 'Select the period correctly'), 'ter'); return; }
      if (type === 'unpaid' && !notes.trim()) { toast(T('اكتب سبب الإجازة بدون راتب', 'Write the reason for unpaid leave'), 'ter'); return; }
      p.from = from; p.to = to; p.days = days;
      if (type === 'annual' && days > Number(me.leave_bal || 0)) { toast(T('يتجاوز الرصيد المتاح', 'Exceeds available balance'), 'ter'); return; }
    }
    if (!ok) return;
    let att = null;
    if (file) { if (file.size > MAX_ATT) { toast(T('حجم المرفق يتجاوز 12 MB', 'Attachment exceeds 12 MB'), 'ter'); return; } try { att = await fileToData(file); } catch { toast(T('تعذر قراءة المرفق', 'Unable to read attachment'), 'ter'); return; } }
    setBusy(true);
    try {
      await rpc('ariba_submit_request', { p_type: type, p_payload: { ...p, type }, p_attachment_name: att ? att.name : null, p_attachment_mime: att ? att.mime : null, p_attachment_base64: att ? att.data : null });
      toast('✅ ' + T('تم إرسال الطلب — بانتظار المدير المباشر', 'Request submitted — pending direct manager'), 'tin');
      setNotes(''); setFile(null); setFrom(''); setTo(''); setAmount(''); setPt(''); await reload(true);
    } catch (e) { toast(e.message || T('تعذر إرسال الطلب', 'Unable to submit request'), 'ter'); }
    finally { setBusy(false); }
  }

  return (
    <div id="lvTab">
      <div className="card">
        <div className="card-title">📋 {T('طلباتي', 'My requests')}</div>
        {!reqs.length && <div id="noReqs" style={{ textAlign: 'center', color: 'var(--mu)', padding: 18 }}>{T('لا توجد طلبات حتى الآن', 'No requests yet')}</div>}
        {reqs.map((r) => { const st = statusOf(r), p = r.payload || {}, why = r.reject_reason || r.rejected_reason || r.decision_note || r.reason; return (
          <div key={r.id} className="req-row" data-id={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <strong style={{ fontSize: 12 }}>{lvName(r.request_type)}</strong>
              <span><span className={'b ' + st[1]}>{st[0]}</span><button type="button" className="a24-del" title={T('حذف', 'Delete')} onClick={() => removeRequest(r, { reload, hide })}>🗑</button></span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 4 }}>{reqDetail(r)}</div>
            {p.notes && <div style={{ fontSize: 10, color: 'var(--dm)', marginTop: 3 }}>{p.notes}</div>}
            {p.submitted_by_manager && <div style={{ fontSize: 10, color: 'var(--bl)', marginTop: 3 }}>👤 {T('قدّمه عنك مديرك: ', 'Submitted for you by: ')}{p.submitted_by_name || ''}</div>}
            {p.escalated_from && r.status === 'pending' && <div style={{ fontSize: 10, color: 'var(--am)', marginTop: 3 }}>⏱ {T('انتقل للموارد البشرية لانتهاء مهلة الرد', 'Moved to HR after the reply timeout')}</div>}
            {r.status === 'rejected' && why && <div style={{ fontSize: 11, color: 'var(--rd)', marginTop: 3 }}>❌ {why}</div>}
          </div>); })}
      </div>

      <Delegation />
      <div className="card">
        <div className="card-title">{T('إرسال طلب جديد', 'New request')}</div>
        <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 8 }}>{(type === 'unpaid' || type === 'salary_advance') ? T('مسار الاعتماد: المدير المباشر → الموارد البشرية (اعتماد نهائي). يصلك إشعار وإيميل عند كل خطوة.', 'Approval path: direct manager → HR (final). You get a notification and email at every step.') : T('مسار الاعتماد: المدير المباشر → الموارد البشرية → الرئيس التنفيذي.', 'Approval path: direct manager → HR → CEO.')}</div>
        {upcoming.length > 0 && (
          <div style={{ marginBottom: 10, padding: 10, background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bl)', marginBottom: 6 }}>🗓️ {T('إجازات رسمية قادمة', 'Upcoming public holidays')}</div>
            {upcoming.map((h, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid rgba(36,48,68,.3)' }}><span>{isEN() ? (h.nameEn || h.name) : h.name}</span><span style={{ color: 'var(--mu)' }}>{fD(h.date)}{h.days ? ' (' + h.days + T(' يوم', ' d') + ')' : ''}</span></div>)}
          </div>)}
        <div id="lvTypes" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
          {Object.keys(LVL).filter(FILTER_TYPES).map((k) => { const v = LVL[k], on = k === type; return (
            <button key={k} type="button" data-k={k} id={'lt_' + k} className={'lv-type' + (on ? ' on' : '')} style={on ? { borderColor: v.color, background: v.color + '22' } : undefined}
              onClick={() => { if (k === 'forgot_punch') nav.openForgot(); else setType(k); }}>
              <i className={'ti ' + v.icon} style={{ fontSize: 18, display: 'block', marginBottom: 3, color: v.color }} />{isEN() ? v.en : v.ar}
            </button>); })}
        </div>
        {isAdv ? (<><label>{T('مبلغ السلفة', 'Advance amount')}</label><input type="number" id="reqAmount" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></>)
          : isPerm ? (<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div><label>{T('التاريخ', 'Date')}</label><input type="date" id="permDate" value={pd} onChange={(e) => setPd(e.target.value)} /></div>
              <div><label>{T('الوقت', 'Time')}</label><input type="time" id="permTime" value={pt} onChange={(e) => setPt(e.target.value)} /></div>
              <div><label>{T('المدة (س)', 'Duration (h)')}</label><input type="number" id="permDur" min="0.5" step="0.5" value={dur} onChange={(e) => setDur(e.target.value)} /></div></div>)
          : (<><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div><label>{T('من تاريخ', 'From date')}</label><input type="date" id="lvFrom" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><label>{T('إلى تاريخ', 'To date')}</label><input type="date" id="lvTo" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></div></div>
              {backDays > 0 && <div id="lvBackDiv" style={{ marginTop: 6, fontSize: 12, color: '#0a7a3f', fontWeight: 700 }}>⤺ {T('الفترة دي داخل إجازتك السنوية المعتمدة — بعد اعتماد الطلب هيرجع ', 'This is inside your approved annual leave — after approval ')}{backDays}{T(' يوم لرصيدك السنوي', ' day(s) return to your annual balance')}</div>}
              {days > 0 && <div id="lvCalcDiv" style={{ marginTop: 6, fontSize: 12, color: type === 'annual' && remain < 0 ? 'var(--rd)' : 'var(--mu)' }}>{T('أيام العمل: ', 'Working days: ')}{days}{type === 'annual' ? ' | ' + T('سيتبقى: ', 'Remaining: ') + (Math.round(remain * 100) / 100) + T(' يوم', ' days') : ''}</div>}</>)}
        <label>{T('ملاحظات', 'Notes')}</label>
        <textarea id="lvNotes" rows={2} placeholder={T('اختياري', 'Optional')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div style={{ marginTop: 8 }}><label>📎 {T('مرفق الطلب (اختياري)', 'Request attachment (optional)')}</label>
          <input id="lvAttachment" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" style={{ width: '100%' }} onChange={(e) => setFile(e.target.files && e.target.files[0] || null)} />
          <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4 }}>{T('يمكن إرسال الطلب بدون مرفق. الحد الأقصى 12 MB.', 'Attachment is optional. Maximum 12 MB.')}</div></div>
        <button className="btn btn-primary" id="lvSubmit" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={busy} onClick={submit}><i className="ti ti-send" /> {busy ? '…' : T('إرسال الطلب', 'Submit request')}</button>
      </div>
    </div>
  );
}
void num;
