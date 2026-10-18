import { useMemo, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import { LVL, HR_LEAVE_TYPES, recordLeave, newLeaveId, fileToData } from '../../lib/leaves.js';
import { saveLeaveFile } from '../../lib/leaveFiles.js';
import { rpc } from '../../lib/api.js';
import { leaveCurrentBalance, overlapWithAnnual } from '../../engines/leave.js';
import { countAnnualLeaveDays } from '../../engines/holidays.js';

export default function NewRequest({ onDone }) {
  const h = useLang() === 'en';
  const { activeEmps, reload } = useApp();
  const [type, setType] = useState('annual');
  const [emp, setEmp] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false); const [file, setFile] = useState(null); const [fkey, setFkey] = useState(0);
  const e = activeEmps.find((x) => String(x.id) === emp);
  const bal = e ? leaveCurrentBalance(e) : 0;
  const days = useMemo(() => {
    if (!from || !to) return 0;
    return type === 'annual' ? countAnnualLeaveDays(from, to) : Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  }, [from, to, type]);
  const dirty = !!(emp || from || to || notes || file || type !== 'annual');
  const resetAll = () => { setType('annual'); setEmp(''); setFrom(''); setTo(''); setNotes(''); setFile(null); setFkey((k) => k + 1); };
  const U = ({ on, clear }) => (on ? <button type="button" className="undo-f" title="تراجع عن التعديل" onClick={clear}>↺</button> : null);
  async function submit() {
    if (!emp || !from || !to) return toast(h ? 'Fill required fields' : 'يرجى تعبئة جميع الحقول', 'ter');
    if (to < from) return toast('تاريخ النهاية قبل البداية', 'ter');
    if (type === 'annual' && days > bal) return toast(h ? 'Exceeds available balance' : 'يتجاوز الرصيد المتاح', 'ter');
    let att = null; try { att = await fileToData(file); } catch (er) { return toast(er.message || 'تعذر قراءة المرفق', 'ter'); }
    setBusy(true);
    try {
      const id = newLeaveId();
      await recordLeave({ id, empId: emp, type, from, to, days, notes }, 'pending');
      let attFail = '';
      if (att) { try { await saveLeaveFile(id, emp, att); } catch (er) { attFail = er.message || 'ATT'; } }
      if (attFail) toast((h ? 'Request saved but the attachment failed to upload: ' : 'تم حفظ الطلب لكن تعذر رفع المرفق للسيرفر: ') + attFail, 'ter');
      else toast('✓ ' + (h ? 'Request submitted' : 'تم إرسال الطلب') + (att ? (h ? ' — file attached' : ' — تم إرفاق الملف') : ''));
      setFrom(''); setTo(''); setNotes(''); setFile(null); setFkey((k) => k + 1); await reload({ silent: true }); onDone && onDone();
    } catch (er) { toast(er.message || 'تعذر الحفظ', 'ter'); } finally { setBusy(false); }
  }
  return (
    <div id="lv3"><div className="card" style={{ maxWidth: 640 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 12 }}>
        {HR_LEAVE_TYPES.map((k) => { const lt = LVL[k]; const on = type === k; return (
          <div key={k} onClick={() => setType(k)} style={{ padding: '10px 6px', textAlign: 'center', borderRadius: 10, cursor: 'pointer', fontSize: 12, border: `1.5px solid ${on ? lt.color : 'var(--bd)'}`, background: on ? lt.color + '22' : 'var(--c2)', color: on ? lt.color : 'var(--tx)' }}>
            <i className={'ti ' + lt.icon} style={{ display: 'block', fontSize: 18, marginBottom: 3 }} />{h ? lt.en : lt.ar}</div>); })}
      </div>
      <div className="fg">
        <div><label>{h ? 'Employee *' : 'الموظف *'}<U on={emp} clear={() => setEmp('')} /></label><select value={emp} onChange={(ev) => setEmp(ev.target.value)}><option value="">اختر...</option>{activeEmps.map((x) => <option key={x.id} value={x.id}>{x.nameAr}</option>)}</select></div>
        <div>{e && <div className="al alb" style={{ marginTop: 0, padding: '7px 10px' }}><i className="ti ti-info-circle" /><span>{h ? 'Available today:' : 'المتاح اليوم:'} <strong>{bal.toFixed(1)} {h ? 'days' : 'يوم'}</strong></span></div>}</div>
        <div><label>{h ? 'From *' : 'من تاريخ *'}<U on={from} clear={() => setFrom('')} /></label><input type="date" value={from} onChange={(ev) => setFrom(ev.target.value)} /></div>
        <div><label>{h ? 'To *' : 'إلى تاريخ *'}<U on={to} clear={() => setTo('')} /></label><input type="date" value={to} onChange={(ev) => setTo(ev.target.value)} /></div>
        <div className="ff">{from && to && (type === 'annual'
          ? (days > bal ? <div className="al alr"><i className="ti ti-x" />{h ? `Exceeds balance (${bal.toFixed(1)} days)` : `يتجاوز الرصيد (${bal.toFixed(1)} يوم)`}</div>
            : <div className="al alg"><i className="ti ti-check" />{h ? `Working days: ${days} | Remaining: ${(bal - days).toFixed(1)}` : `أيام العمل: ${days} | سيتبقى: ${(bal - days).toFixed(1)} يوم`}</div>)
          : <div className="al alb"><i className="ti ti-info-circle" />{h ? `Days: ${days}` : `الأيام: ${days}`}{(() => { let o = { days: 0 }; try { o = overlapWithAnnual(emp, type, from, to); } catch { /* ignore */ } return o.days ? <b style={{ marginInlineStart: 8, color: '#0a7a3f' }}>{h ? `— inside an approved annual leave: ${o.days} day(s) return to the annual balance on approval` : `— داخل إجازة سنوية معتمدة: هيرجع ${o.days} يوم لرصيد السنوية بعد الاعتماد`}</b> : null; })()}</div>)}</div>
        <div className="ff"><label>{h ? 'Notes' : 'ملاحظات'}<U on={notes} clear={() => setNotes('')} /></label><textarea rows={2} value={notes} onChange={(ev) => setNotes(ev.target.value)} /></div>
        <div className="ff" style={{ gridColumn: '1/-1' }}><label><i className="ti ti-paperclip" /> {h ? 'Request attachment' : 'مرفق الطلب'} <span style={{ color: 'var(--mu)', fontWeight: 400 }}>{h ? '(optional)' : '(اختياري)'}</span><U on={file} clear={() => { setFile(null); setFkey((k) => k + 1); }} /></label>
          <input key={fkey} id="HR_NLATT" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(ev) => setFile((ev.target.files && ev.target.files[0]) || null)} />
          <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4 }}>{h ? 'Optional — PDF / Word / JPG / PNG — max 12 MB.' : 'المرفق اختياري — PDF / Word / JPG / PNG — حد أقصى 12 MB.'}</div></div>
      </div>
      <button className="btn bpl" style={{ marginTop: 10 }} disabled={busy} onClick={submit}><i className="ti ti-send" /> <span>{h ? 'Submit' : 'إرسال الطلب'}</span></button>
      <button type="button" className="btn bsm" style={{ marginInlineStart: 8 }} disabled={!dirty} onClick={resetAll}>↺ {h ? 'Undo all' : 'تراجع عن الكل'}</button>
    </div></div>
  );
}
