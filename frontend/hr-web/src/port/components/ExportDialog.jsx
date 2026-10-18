import { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { toast } from './Toast.jsx';
import { useApp } from '../store/AppStore.jsx';
import { FORMATS, makeFile, saveBlob, emailReport } from '../lib/exporter.js';

const ROLE_CHIPS = [
  ['الرئيس التنفيذي', /الرئيس التنفيذي|CEO|chief executive/i], ['رئيس مجلس الإدارة', /رئيس مجلس|chairman/i], ['المدير الإداري', /المدير الإداري|admin(istrative)? manager/i],
  ['المدير المالي', /المدير المالي|CFO|finance manager/i], ['المحاسب', /محاسب|accountant/i], ['الموارد البشرية', /موارد بشرية|HR/i],
];
/** حوار تصدير موحّد: اختيار الصيغة (PDF/Excel/Word) + تنزيل + إرسال تلقائي بالإيميل لمستلمين مختارين */
export default function ExportDialog({ open, onClose, spec, forEmps = [] }) {
  const { employees } = useApp();
  const [fmt, setFmt] = useState('pdf'), [busy, setBusy] = useState(''), [picked, setPicked] = useState({}), [extra, setExtra] = useState(''), [q, setQ] = useState('');
  const [subject, setSubject] = useState(''), [msg, setMsg] = useState('');
  const withMail = useMemo(() => employees.filter((e) => !e.isTerminated && String(e.email || '').includes('@')), [employees]);
  if (!spec) return null;
  const toggle = (e) => setPicked((p) => ({ ...p, [e.id]: !p[e.id] }));
  const chip = (re) => { const hit = withMail.filter((e) => re.test(e.jobTitle || '')); if (!hit.length) return toast('لا يوجد موظف بهذه الصفة وله إيميل مسجل', 'ter'); setPicked((p) => { const n = { ...p }; hit.forEach((e) => { n[e.id] = true; }); return n; }); };
  const mgrChip = () => { const ids = new Set(forEmps.map((e) => String(e.managerId || '')).filter(Boolean)); const hit = withMail.filter((e) => ids.has(String(e.id))); if (!hit.length) return toast('لا مدير مباشر بإيميل للموظفين المختارين', 'ter'); setPicked((p) => { const n = { ...p }; hit.forEach((e) => { n[e.id] = true; }); return n; }); };
  const recips = () => [...withMail.filter((e) => picked[e.id]).map((e) => e.email), ...extra.split(/[,;\s]+/).filter(Boolean)];
  async function dl() { setBusy('dl'); try { saveBlob(await makeFile(fmt, spec)); } catch (e) { toast(e.message || 'تعذر إنشاء الملف', 'ter'); } finally { setBusy(''); } }
  async function mail() {
    const to = recips(); if (!to.length) return toast('اختر مستلماً واحداً على الأقل أو اكتب إيميلاً', 'ter');
    if (!window.confirm('سيُرسل التقرير تلقائياً إلى ' + to.length + ' مستلم. متأكد؟')) return;
    setBusy('mail');
    try { const f = await makeFile(fmt, spec); const r = await emailReport({ to, subject: subject || spec.title, message: msg, file: f }); toast('✅ أُرسل التقرير إلى ' + r.sent + ' مستلم', 'tin'); onClose(); }
    catch (e) { toast('⚠️ ' + (e.message || 'تعذر الإرسال'), 'ter'); } finally { setBusy(''); }
  }
  const list = withMail.filter((e) => !q || String(e.nameAr || '').includes(q) || String(e.nameEn || '').toLowerCase().includes(q.toLowerCase()) || String(e.jobTitle || '').includes(q)).slice(0, 60);
  return (
    <Modal open={open} onClose={onClose} title={'تصدير / إرسال: ' + spec.title} width={640}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {Object.entries(FORMATS).map(([k, v]) => <label key={k} style={{ display: 'flex', gap: 5, alignItems: 'center', border: '1px solid ' + (fmt === k ? 'var(--bl)' : 'var(--bd)'), borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}><input type="radio" name="xfmt" checked={fmt === k} onChange={() => setFmt(k)} /> {v[0]}</label>)}
        <button className="btn bpl bsm" id="XD_DL" disabled={!!busy} onClick={dl} style={{ marginInlineStart: 'auto' }}><i className="ti ti-download" /> {busy === 'dl' ? '…' : 'تنزيل'}</button>
      </div>
      <div className="fsec">إرسال بالإيميل تلقائياً (بدون فتح برنامج بريد)</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '6px 0' }}>
        {ROLE_CHIPS.map(([l, re]) => <button key={l} type="button" className="btn bsm" onClick={() => chip(re)}>+ {l}</button>)}
        {forEmps.length > 0 && <button type="button" className="btn bsm" onClick={mgrChip}>+ المدير المباشر للموظفين المختارين</button>}
      </div>
      <input placeholder="ابحث عن موظف…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 6 }} />
      <div style={{ maxHeight: 170, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 8, padding: 6 }}>
        {list.map((e) => <label key={e.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, padding: '2px 0', cursor: 'pointer' }}><input type="checkbox" checked={!!picked[e.id]} onChange={() => toggle(e)} /> {e.nameAr} <span style={{ color: 'var(--mu)', fontSize: 10 }}>{e.jobTitle || ''} — {e.email}</span></label>)}
        {!list.length && <div style={{ color: 'var(--mu)', fontSize: 12, padding: 8 }}>لا موظفين بإيميل مسجل</div>}
      </div>
      <input dir="ltr" placeholder="إيميلات أخرى مفصولة بفاصلة" value={extra} onChange={(e) => setExtra(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
      <input placeholder="عنوان الرسالة (اختياري)" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
      <textarea rows={2} placeholder="نص الرسالة (اختياري)" value={msg} onChange={(e) => setMsg(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <button className="btn bpl" id="XD_MAIL" disabled={!!busy} onClick={mail}><i className="ti ti-send" /> {busy === 'mail' ? 'جارٍ الإرسال…' : 'إرسال (' + recips().length + ')'}</button>
        <button className="btn" onClick={onClose}>إغلاق</button>
      </div>
    </Modal>
  );
}
