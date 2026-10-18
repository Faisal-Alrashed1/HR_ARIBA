import { useState } from 'react';
import { useApp, usePerm } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { fD, uid } from '../../lib/util.js';
import { toast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import PromptModal from '../../components/PromptModal.jsx';
import { syncHolidays } from '../../lib/leaves.js';
import { rt } from '../../engines/runtime.js';

export default function Holidays() {
  const h = useLang() === 'en';
  const { holidays, setHolidays } = useApp();
  const can = usePerm().edit('settings') || usePerm().edit('leaves');
  const [open, setOpen] = useState(false); const [f, setF] = useState({ name: '', date: '', days: 1, recurring: '0' });
  const [del, setDel] = useState(null);
  const eg = rt.country === 'EG';
  async function persist(next, msg) {
    const prev = holidays; setHolidays(next);
    try { await syncHolidays(next); toast(msg); } catch (e) { setHolidays(prev); toast('تعذر حفظ العطلات على السيرفر: ' + (e.message || e), 'ter'); }
  }
  function save() {
    if (!f.name || !f.date) return toast(h ? 'Fill required fields' : 'يرجى تعبئة الحقول', 'ter');
    setOpen(false); persist([...holidays, { id: uid(), name: f.name, nameEn: f.name, date: f.date, days: parseInt(f.days, 10) || 1, recurring: f.recurring === '1' }], '✓');
    setF({ name: '', date: '', days: 1, recurring: '0' });
  }
  return (
    <div id="lv5"><div className="card">
      <div className="ch"><div className="ct"><i className="ti ti-calendar-event" /> <span>{h ? 'Official holidays' : 'الإجازات الرسمية'}</span></div>
        {can && <button className="btn bpl bsm" onClick={() => setOpen(true)}><i className="ti ti-plus" /></button>}</div>
      <div className="tw"><table><tbody>
        <tr><th>{h ? 'Holiday' : 'الإجازة'}</th><th>{h ? 'Date' : 'التاريخ'}</th><th>{h ? 'Days' : 'الأيام'}</th><th>{h ? 'Recurring' : 'متكررة'}</th><th /></tr>
        {holidays.map((hl, i) => <tr key={hl.id || i}><td style={{ fontWeight: 600 }}>{h ? hl.nameEn || hl.name : hl.name}</td><td>{fD(hl.date)}</td><td>{hl.days}</td><td>{hl.recurring ? (h ? 'Yes' : 'نعم') : (h ? 'No' : 'لا')}</td>
          <td>{can && <button className="btn bsm" style={{ color: 'var(--rd)' }} onClick={() => setDel(i)}><i className="ti ti-trash" /></button>}</td></tr>)}
      </tbody></table></div>
      <div className="al alb" style={{ marginTop: 10 }}><i className="ti ti-info-circle" /><span>الإجازات الرسمية لا تُحسب من رصيد الإجازة السنوية{eg ? ' — ملاحظة: قائمة العطلات واحدة مشتركة على السيرفر (لا قائمة منفصلة لمصر بعد).' : ''}</span></div>
      <Modal open={open} onClose={() => setOpen(false)} title="إضافة إجازة رسمية" width={420}
        footer={<div className="mf"><button className="btn" onClick={() => setOpen(false)}>إلغاء</button><button className="btn bpl" onClick={save}>حفظ</button></div>}>
        <div className="fg">
          <div><label>اسم الإجازة</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label>التاريخ</label><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div><label>الأيام</label><input type="number" min="1" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></div>
          <div><label>متكررة سنوياً</label><select value={f.recurring} onChange={(e) => setF({ ...f, recurring: e.target.value })}><option value="0">لا</option><option value="1">نعم</option></select></div>
        </div>
      </Modal>
      <PromptModal open={del !== null} noInput title="حذف إجازة رسمية" message="حذف هذه الإجازة الرسمية؟" danger confirmText="حذف" onClose={() => setDel(null)} onConfirm={() => { const i = del; setDel(null); persist(holidays.filter((_, j) => j !== i), 'تم الحذف'); }} />
    </div></div>
  );
}
