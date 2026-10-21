import { useCallback, useEffect, useState } from 'react';
import { useApp, usePerm } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { fD } from '../../lib/util.js';
import { toast } from '../../components/Toast.jsx';
import PromptModal from '../../components/PromptModal.jsx';
import { Av } from '../employees/EmpList.jsx';
import { LVL, lvl, fetchQueue, wfApprove, wfFinalApprove, wfReject, wfHrReject, wfReturnToManager, recordLeave, downloadDoc } from '../../lib/leaves.js';
import { leaveRequestDays, overlapWithAnnual } from '../../engines/leave.js';
const IntNote = ({ eid, type, from, to }) => { let o = { days: 0 }; try { o = overlapWithAnnual(eid, type, from, to); } catch { /* ignore */ } return o.days ? <div style={{ fontSize: 11, color: '#0a7a3f', marginTop: 3, fontWeight: 700 }}>⤺ داخل إجازة سنوية معتمدة — عند الاعتماد يرجع {o.days} يوم لرصيد السنوية</div> : null; };


const STAGE = { manager: ['Pending Direct Manager', 'بانتظار المدير المباشر'], hr: ['Pending HR', 'بانتظار الموارد البشرية'], ceo: ['Pending CEO', 'بانتظار الرئيس التنفيذي'] };

export default function Pending({ onCount }) {
  const h = useLang() === 'en';
  const { employees, leaves, setLeaves, reload } = useApp();
  const perm = usePerm();
  const can = perm.edit('requests') || perm.edit('leaves');
  const [queue, setQueue] = useState(null);
  const [dlg, setDlg] = useState(null); // {kind, id, item}
  const [busy, setBusy] = useState(''); const [letter, setLetter] = useState('');

  const load = useCallback(() => fetchQueue().then(setQueue).catch((e) => { setQueue([]); toast('تعذر تحميل الطلبات: ' + e.message, 'ter'); }), []);
  useEffect(() => { load(); }, [load]);
  const today = new Date().toISOString().slice(0, 10);
  const hrPending = leaves.filter((l) => l.hr && l.status === 'pending' && (!l.to || l.to >= today));
  useEffect(() => { if (onCount && queue) onCount(queue.length + hrPending.length); }, [queue, hrPending.length]); // eslint-disable-line

  const name = (id) => { const e = employees.find((x) => String(x.id) === String(id)); return e ? String(e.nameAr || '').split(' ').slice(0, 3).join(' ') : '—'; };
  async function act(fn, ok, key) {
    setBusy(key);
    try { await fn(); toast(ok); await Promise.all([load(), reload({ silent: true })]); } catch (e) { toast(e.message || 'تعذر تنفيذ الإجراء', 'ter'); } finally { setBusy(''); }
  }
  const confirm = (reason) => {
    const d = dlg; setDlg(null);
    if (d.kind === 'approve') act(() => wfApprove(d.id, reason || 'تمت الموافقة من الموارد البشرية'), '✓ تمت الموافقة على الطلب', d.id);
    else if (d.kind === 'final') act(() => wfFinalApprove(d.id, reason), '✓ تم الاعتماد النهائي للطلب', d.id);
    else if (d.kind === 'reject') act(() => (d.stage === 'hr' ? wfHrReject(d.id, reason) : wfReject(d.id, reason)), '❌ تم رفض الطلب — أُرسل إشعار وإيميل للموظف', d.id);
    else if (d.kind === 'return') act(() => wfReturnToManager(d.id, reason), '↩ أُعيد الطلب للمدير المباشر مع الملاحظة — أُرسل إشعار وإيميل', d.id);
    else if (d.kind === 'hrReject') act(() => recordLeave({ ...d.item, notes: (d.item.notes || '') + (reason ? ' | سبب الرفض: ' + reason : '') }, 'rejected'), 'تم الرفض', d.id);
  };

  return (
    <div id="lv1">
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="ch"><div className="ct"><i className="ti ti-clock" /> <span>{h ? 'Pending Employee Requests' : 'طلبات الموظفين المعلقة'}</span></div></div>
        <div>
          {queue === null && <div style={{ padding: 22, textAlign: 'center', color: 'var(--mu)' }}>…</div>}
          {queue && !queue.length && <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 24, fontSize: 13 }}>✓ {h ? 'No pending employee requests' : 'لا توجد طلبات موظفين معلقة'}</div>}
          {(queue || []).map((x) => {
            const r = x.request || {}, e = x.employee || {}, p = r.payload || {};
            const nm = h ? (e.nameEn || e.nameAr || r.employee_id || '—') : (e.nameAr || e.nameEn || r.employee_id || '—');
            const detail = r.request_type === 'iban_change' ? `IBAN: ${p.iban || ''} | ${p.bank || ''} | حساب ${p.account_no || ''}${p.old_iban ? ' (السابق: ' + p.old_iban + ')' : ''}`
              : r.request_type === 'profile_edit' ? Object.keys(p.changes || {}).map((k) => `${k}: ${(p.old || {})[k] || '—'} ← ${p.changes[k]}`).join(' | ')
              : r.request_type === 'document' ? (p.doc_label || '')
              : String(r.request_type || '').startsWith('template:') ? (h ? 'Accepted by the employee — open the signed copy below' : 'وافق عليه الموظف — المستند الموقّع في المرفقات')
              : p.from ? `${p.from} ← ${p.to} | ${p.days || 0} ${h ? 'days' : 'يوم'}` : `${p.date || ''}${p.time ? ' ' + p.time : ''}${(p.hours || p.dur) ? ' | ' + (p.hours || p.dur) + (h ? ' h' : ' ساعة') : ''}${p.amount ? ' | ' + Number(p.amount).toLocaleString('en-US') + ' SAR' : ''}`;
            const st = STAGE[r.current_stage] || ['Completed', 'مكتمل'];
            const lt = lvl(r.request_type);
            return (
              <div key={r.id} style={{ padding: '12px 14px', borderBottom: '1px solid rgba(36,48,68,.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{nm} <span className="b ba">{lt ? (h ? lt.en : lt.ar) : (r.request_type === 'forgot_punch' ? (h ? 'Forgot punch' : 'نسيان بصمة') : String(r.request_type || '').startsWith('template:') ? '📄 ' + (p.title || (h ? 'Document' : 'مستند')) : r.request_type)}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 4 }}>{detail}</div>
                    {p.from && <IntNote eid={r.employee_id} type={r.request_type} from={p.from} to={p.to || p.from} />}
                    {r.request_type === 'forgot_punch' ? (() => { const KIND = { in: h ? 'Check-in' : 'دخول', out: h ? 'Check-out' : 'خروج', both: h ? 'Check-in & out' : 'دخول وخروج' }; const f5 = (t) => String(t || '').slice(0, 5); return (
                      <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(14,165,233,.08)', borderRadius: 8, fontSize: 12, lineHeight: 1.8 }}>
                        <b>{KIND[p.kind] || ''}</b> — {p.date || ''} — <span dir="ltr">{p.kind === 'both' ? f5(p.time) + ' → ' + f5(p.time2) : f5(p.time)}</span>
                        {p.notes && <><br />{h ? 'Reason' : 'السبب'}: {p.notes}</>}
                        <br /><span style={{ color: '#0f766e' }}>{h ? 'On approval it is recorded automatically in the employee attendance.' : 'عند الموافقة يتسجل تلقائيًا في سجل حضور الموظف.'}</span></div>); })()
                      : p.notes && <div style={{ fontSize: 11, color: 'var(--dm)' }}>{p.notes}</div>}
                    <div style={{ fontSize: 10, color: 'var(--dm)', marginTop: 3 }}>{h ? st[0] : st[1]}{p.submitted_by_manager && <span className="b ba" style={{ marginInlineStart: 6 }}>قُدّم بالنيابة من المدير: {p.submitted_by_name || ''}</span>}{p.escalated_from && <span className="b br" style={{ marginInlineStart: 6 }}>تجاوز مهلة {p.escalated_from === 'manager' ? 'المدير المباشر' : 'الرئيس التنفيذي'}</span>}{Array.isArray(p.returned) && p.returned.length > 0 && <span className="b ba" style={{ marginInlineStart: 6 }}>سبق إرجاعه للمدير</span>}</div>
                  </div>
                  {can && <>
                    <button className="btn bgl bsm" disabled={busy === r.id} title={r.current_stage === 'manager' || r.current_stage === 'ceo' ? 'الموارد البشرية تعتمد الطلب بالنيابة عن صاحب المرحلة الحالية' : undefined} onClick={() => setDlg({ kind: 'approve', id: r.id })}>✓ {h ? 'Approve' : r.current_stage === 'manager' ? 'موافقة نيابة عن المدير المباشر' : r.current_stage === 'ceo' ? 'موافقة نيابة عن الرئيس التنفيذي' : 'موافقة'}</button>
                    {(r.current_stage === 'manager' || r.current_stage === 'hr') && <button className="btn bsm" style={{ background: '#0a5c9e', color: '#fff' }} disabled={busy === r.id} title="اعتماد الطلب نهائياً بالنيابة عن كل المراحل المتبقية" onClick={() => setDlg({ kind: 'final', id: r.id })}>اعتماد نهائي</button>}
                    <button className="btn bsm" style={{ color: 'var(--rd)' }} disabled={busy === r.id} onClick={() => setDlg({ kind: 'reject', id: r.id, stage: r.current_stage })}>✗ {h ? 'Reject' : 'رفض'}</button>
                    {r.current_stage === 'hr' && r.manager_id && <button className="btn bsm" style={{ color: 'var(--am)' }} disabled={busy === r.id} title="إرجاع للمدير المباشر بملاحظة: يرجى الاهتمام بالرد والإفادة" onClick={() => setDlg({ kind: 'return', id: r.id })}>↩ {h ? 'Return to manager' : 'إرجاع للمدير'}</button>}
                  </>}
                </div>
                {p.letter_html && <button className="btn bsm" style={{ color: 'var(--cy)', margin: 2 }} onClick={() => setLetter(p.letter_html)}>📄 عرض خطاب الموظف الموقّع</button>}
                {(x.attachments || []).map((a) => <button key={a.id} className="btn bsm" style={{ color: 'var(--cy)', margin: 2 }} onClick={() => downloadDoc(a.id).catch((er) => toast(er.message, 'ter'))}>📎 {a.file_name || 'مرفق'}</button>)}
              </div>
            );
          })}
        </div>
      </div>

      {hrPending.length > 0 && <div className="card" style={{ marginBottom: 10 }}>
        <div className="ch"><div className="ct"><i className="ti ti-clock" /> <span>{h ? 'Requests recorded by HR' : 'طلبات مسجلة من الموارد البشرية'}</span></div></div>
        {hrPending.map((l) => { const lt = LVL[l.type] || { ar: l.type, en: l.type }; const e = employees.find((x) => String(x.id) === String(l.empId)); return (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid rgba(36,48,68,.5)' }}>
            <Av name={e ? e.nameAr : '؟'} size={32} />
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{name(l.empId)}</div>
              <div style={{ fontSize: 11, color: 'var(--mu)' }}>{h ? lt.en : lt.ar} | {fD(l.from)} ← {fD(l.to)} ({leaveRequestDays(l)} {h ? 'days' : 'أيام'})</div>
              {l.notes && <div style={{ fontSize: 11, color: 'var(--dm)' }}>{l.notes}</div>}
              <IntNote eid={l.empId} type={l.type} from={l.from} to={l.to || l.from} /></div>
            <span className="b ba">{h ? 'Pending' : 'معلق'}</span>
            {can && <>
              <button className="btn bgl bsm" disabled={busy === l.id} onClick={() => act(() => recordLeave({ ...l, days: leaveRequestDays(l) }, 'approved'), '✓ ' + (h ? 'Approved' : 'تمت الموافقة'), l.id)}>✓ {h ? 'Approve' : 'موافقة'}</button>
              <button className="btn bsm" style={{ color: 'var(--rd)' }} disabled={busy === l.id} onClick={() => setDlg({ kind: 'hrReject', id: l.id, item: l })}>✗ {h ? 'Reject' : 'رفض'}</button>
            </>}
          </div>); })}
      </div>}

      {letter && <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#fff' }}><button className="btn bpl" style={{ position: 'fixed', top: 10, insetInline: 'auto 12px', right: 12, zIndex: 3001 }} onClick={() => setLetter('')}>✕ إغلاق</button><iframe title="letter" sandbox="" style={{ width: '100%', height: '100%', border: 0 }} srcDoc={'<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head><body style="margin:0">' + letter + '</body></html>'} /></div>}
      <PromptModal open={!!dlg} onClose={() => setDlg(null)} onConfirm={confirm}
        title={dlg ? ({ approve: 'موافقة على الطلب', final: 'اعتماد نهائي بالنيابة', reject: 'سبب الرفض', hrReject: 'سبب الرفض', return: 'إرجاع للمدير المباشر' })[dlg.kind] : ''}
        label={dlg && (dlg.kind === 'reject' || dlg.kind === 'hrReject') ? 'السبب' : dlg && dlg.kind === 'return' ? 'ملاحظة للمدير' : 'ملاحظة (اختياري)'} required={dlg && (dlg.kind === 'reject' || dlg.kind === 'hrReject' || dlg.kind === 'return')} defaultValue={dlg && dlg.kind === 'return' ? 'يرجى الاهتمام بالرد والإفادة' : undefined}
        message={dlg && dlg.kind === 'final' ? 'سيتم اعتماد الطلب نهائياً بالنيابة عن كل المراحل المتبقية (المدير المباشر / الموارد البشرية / الرئيس التنفيذي) ويُسجَّل أنه اعتماد بالنيابة. متأكد؟' : undefined}
        danger={dlg && (dlg.kind === 'reject' || dlg.kind === 'hrReject')} confirmText={dlg && (dlg.kind === 'reject' || dlg.kind === 'hrReject') ? 'رفض' : 'تأكيد'} />
    </div>
  );
}
