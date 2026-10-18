import { useState } from 'react';
import { rpc } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import EmpModal, { INP, LBL, btnS } from './EmpModal.jsx';
import { useEmp } from './EmpStore.jsx';
import { T, riyadhNow } from './util.jsx';

/** طلب نسيان بصمة: يذهب مباشرة للموارد البشرية (v114) */
export default function ForgotPunch({ onClose }) {
  const { reload } = useEmp();
  const today = riyadhNow().date;
  const [kind, setKind] = useState('in'), [date, setDate] = useState(today), [t1, setT1] = useState(''), [t2, setT2] = useState(''), [notes, setNotes] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const fail = (m) => { setErr(m); setBusy(false); };
  async function send() {
    if (!date) return fail(T('اختر التاريخ', 'Choose the date'));
    if (date > today) return fail(T('لا يمكن اختيار تاريخ في المستقبل', 'Date cannot be in the future'));
    if (!t1) return fail(T('اختر الوقت', 'Choose the time'));
    if (kind === 'both') { if (!t2) return fail(T('اختر وقت الخروج', 'Choose the check-out time')); if (t2 <= t1) return fail(T('وقت الخروج لازم يكون بعد وقت الدخول', 'Check-out must be after check-in')); }
    if (!notes.trim()) return fail(T('اكتب السبب', 'Write the reason'));
    setBusy(true); setErr('');
    const payload = { kind, date, time: t1, notes: notes.trim() }; if (kind === 'both') payload.time2 = t2;
    try { await rpc('ariba_submit_request', { p_type: 'forgot_punch', p_payload: payload }); toast('✅ ' + T('تم إرسال الطلب — بانتظار الموارد البشرية', 'Request sent — pending HR'), 'tin'); await reload(true); onClose(); }
    catch (e) { fail(e.message || T('حصلت مشكلة', 'Something went wrong')); }
  }
  const kinds = [['in', T('دخول', 'Check-in')], ['out', T('خروج', 'Check-out')], ['both', T('دخول وخروج', 'Both')]];
  return (
    <EmpModal id="aribaFpModal" onClose={onClose}>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>🖐 {T('نسيان بصمة', 'Forgot to punch')}</div>
      <div style={{ fontSize: 12.5, color: '#555', lineHeight: 1.7, marginBottom: 10 }}>{T('اختر نوع البصمة اللي نسيتها والتاريخ والوقت واكتب السبب. الطلب بيروح للموارد البشرية مباشرة، ولما يوافقوا بيتسجل الحضور/الانصراف في سجلك.', 'Choose the missed punch, date and time and write the reason. The request goes straight to HR; once approved it is recorded in your attendance.')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 4 }}>
        {kinds.map(([k, l]) => <button key={k} type="button" data-k={k} onClick={() => setKind(k)} style={{ padding: '9px 4px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: '2px solid ' + (kind === k ? '#0f766e' : '#ddd'), background: kind === k ? '#ecfdf5' : '#f9fafb', color: '#111', fontWeight: kind === k ? 700 : 400, fontFamily: 'inherit' }}>{l}</button>)}
      </div>
      <label style={LBL}>{T('التاريخ', 'Date')}</label><input id="aribaFpDate" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} style={INP} />
      <label style={LBL}>{kind === 'out' ? T('وقت الخروج', 'Check-out time') : T('وقت الدخول', 'Check-in time')}</label><input id="aribaFpT1" type="time" value={t1} onChange={(e) => setT1(e.target.value)} style={INP} />
      {kind === 'both' && <><label style={LBL}>{T('وقت الخروج', 'Check-out time')}</label><input id="aribaFpT2" type="time" value={t2} onChange={(e) => setT2(e.target.value)} style={INP} /></>}
      <label style={LBL}>{T('السبب (مطلوب)', 'Reason (required)')}</label>
      <textarea id="aribaFpNotes" rows={3} style={{ ...INP, resize: 'vertical' }} placeholder={T('اكتب سبب نسيان البصمة', 'Why did you forget?')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {err && <div id="aribaFpErr" style={{ color: '#b91c1c', fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}><button id="aribaFpSend" type="button" style={btnS()} disabled={busy} onClick={send}>{busy ? T('جاري الإرسال…', 'Sending…') : T('إرسال الطلب', 'Send request')}</button><button type="button" style={btnS('ghost')} onClick={onClose}>{T('إلغاء', 'Cancel')}</button></div>
    </EmpModal>
  );
}
