import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, usePerm } from '../../store/AppStore.jsx';
import { rpc, getSetting, setSetting } from '../../lib/api.js';
import { toast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import PromptModal from '../../components/PromptModal.jsx';
import { getLists } from '../../lib/masterLists.js';
import { acceptCandidate, getAutoCfg, setAutoCfg } from '../../lib/candidates.js';
import Invites from './Invites.jsx';

const ST = { new: ['ba', 'بانتظار المراجعة'], accepted: ['bg', 'مقبول'], rejected: ['br', 'مرفوض'] };
const DT = { photo: 'صورة', cv: 'السيرة الذاتية', id: 'الهوية/الإقامة', passport: 'الجواز', experience: 'شهادة خبرة', certificate: 'شهادة تخرج', national_address: 'العنوان الوطني', insurance: 'شهادة التأمينات', other: 'أخرى' };
const FIELDS = [['nameAr', 'الاسم'], ['nameEn', 'بالإنجليزي'], ['nationality', 'الجنسية'], ['dob', 'الميلاد'], ['mobile', 'الجوال'], ['email', 'الإيميل'], ['idNo', 'الهوية/الإقامة'], ['idExpiry', 'انتهاؤها'], ['passportNo', 'الجواز'], ['passportExpiry', 'انتهاؤه'],
  ['position', 'الوظيفة'], ['education', 'المؤهل'], ['experienceYears', 'سنوات الخبرة'], ['currentEmployer', 'جهة العمل الحالية'], ['expectedSalary', 'الراتب المتوقع'], ['availability', 'جاهزية المباشرة'], ['city', 'المدينة'], ['address', 'العنوان'], ['bank', 'البنك'], ['iban', 'الآيبان'], ['notes', 'ملاحظات']];

async function openFile(f) {
  try { const r = await rpc('ariba_hr_candidate_file', { p_file_id: f.id }); const bin = atob(r.base64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const url = URL.createObjectURL(new Blob([u], { type: r.mime })); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000); }
  catch (e) { toast(e.message, 'ter'); }
}
export default function Candidates() {
  const nav = useNavigate(); const { employees, reload } = useApp(); const can = usePerm().edit('employees_admin') || usePerm().edit('employees');
  const [list, setList] = useState(null), [key, setKey] = useState(''), [flt, setFlt] = useState('new'), [ref, setRef] = useState(''), [cur, setCur] = useState(null), [acc, setAcc] = useState(null), [rej, setRej] = useState(null), [busy, setBusy] = useState(false);
  const load = useCallback(() => rpc('ariba_hr_candidates', {}).then(async (d) => { setList(d.candidates || []); let k = d.form_key || ''; if (!k && can) { try { k = (await rpc('ariba_hr_apply_key_rotate', {})).form_key || ''; } catch { /* ignore */ } } setKey(k); }).catch((e) => { setList([]); toast(e.message, 'ter'); }), [can]);
  useEffect(() => { load(); }, [load]);
  const [auto, setAuto] = useState(null);
  useEffect(() => { getAutoCfg().then(setAuto); }, []);
  const L0 = getLists(employees);
  const saveAuto = async (n) => { setAuto(n); try { await setAutoCfg(n); toast(n.on ? '✓ التسجيل التلقائي شغّال' : 'اتوقف التسجيل التلقائي', 'tin'); } catch (e) { toast(e.message, 'ter'); } };
  // عنوان صفحة التقديم على الإنترنت (إعداد سحابي مشترك). لو البرنامج نفسه مرفوع على https نستخدم مكانه تلقائياً،
  // لكن لو مفتوح كملف من الجهاز (file://) الرابط ده مش هيفتح عند المرشح، فلازم عنوان عام.
  const [pub, setPub] = useState(''), [pubIn, setPubIn] = useState(''), [pubEdit, setPubEdit] = useState(false);
  useEffect(() => { getSetting('apply_public_url').then((v) => { const u = typeof v === 'string' ? v : (v && v.url) || ''; setPub(u); setPubIn(u); }).catch(() => {}); }, []);
  const here = /^https?:$/i.test(location.protocol) ? new URL('apply.html', location.href.replace(/[#?].*$/, '')).href : '';
  const baseUrl = pub || here;
  const link = key && baseUrl ? baseUrl + (baseUrl.indexOf('?') >= 0 ? '&' : '?') + 'k=' + key : '';
  async function savePub() {
    let u = pubIn.trim().replace(/[#].*$/, '').replace(/[?&]k=[^&]*/, '').replace(/\?$/, '');
    if (u && !/^https:\/\/[^\s/]+\.[^\s]+/i.test(u)) return toast('اكتب عنوان يبدأ بـ https:// (عنوان صفحة التقديم بعد رفعها على الإنترنت)', 'ter');
    try { await setSetting('apply_public_url', { url: u }); setPub(u); setPubIn(u); setPubEdit(false); toast(u ? '✓ اتحفظ عنوان صفحة التقديم' : 'اتمسح العنوان', 'tin'); } catch (e) { toast(e.message, 'ter'); }
  }
  const shown = useMemo(() => (list || []).filter((c) => !flt || c.status === flt), [list, flt]);
  async function pull() {
    if (!ref.trim()) return toast('الصق رابط المرشح أو رمزه', 'ter');
    try { const r = await rpc('ariba_hr_candidate_by_ref', { p_ref: ref.trim() }); setCur(r.candidate); setRef(''); } catch (e) { toast(e.message, 'ter'); }
  }
  async function rotate() { if (!window.confirm('تغيير مفتاح النموذج سيُبطل الرابط الحالي. متأكد؟')) return; try { const r = await rpc('ariba_hr_apply_key_rotate', {}); setKey(r.form_key); toast('✓ رابط جديد للنموذج', 'tin'); } catch (e) { toast(e.message, 'ter'); } }
  const copy = (t, m) => { try { navigator.clipboard.writeText(t); toast(m, 'tin'); } catch { window.prompt('انسخ', t); } };

  async function accept(c, v) {
    setBusy(true);
    try {
      const r = await acceptCandidate(c, v, employees);
      toast('✅ أُضيف الموظف رقم ' + r.emp.empNo + ' ونُقل ' + r.moved + ' ملف لوثائقه', 'tin');
      setAcc(null); setCur(null); await Promise.all([load(), reload({ silent: true })]); nav('/emps/' + r.emp.id + '/edit');
    } catch (e) { toast('❌ ' + (e.message || 'تعذر القبول'), 'ter'); } finally { setBusy(false); }
  }
  async function reject(c, note) { try { await rpc('ariba_hr_candidate_reject', { p_candidate_id: c.id, p_note: note }); toast('تم رفض المرشح وحذف ملفاته', 'tin'); setRej(null); setCur(null); load(); } catch (e) { toast(e.message, 'ter'); } }

  return (
    <div className="pg on" id="cand">
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="ch"><div className="ct"><i className="ti ti-link" /> <span>رابط نموذج التقديم والاستيراد</span></div></div>
        <div style={{ padding: 12, display: 'grid', gap: 10 }}>
          <div><label>رابط نموذج التقديم (أرسله للمرشحين)</label>
            {link
              ? <div style={{ display: 'flex', gap: 6 }}><input readOnly dir="ltr" value={link} style={{ flex: 1 }} id="CAND_LINK" onFocus={(e) => e.target.select()} /><button className="btn bsm" onClick={() => copy(link, '✓ نُسخ الرابط')}>نسخ</button>{can && <button className="btn bsm" onClick={rotate}>تغيير الرابط</button>}{can && <button className="btn bsm" title="عنوان صفحة التقديم" onClick={() => setPubEdit((x) => !x)}><i className="ti ti-world" /></button>}</div>
              : <div className="al alb" id="CAND_NOPUB" style={{ fontSize: 12, lineHeight: 1.8 }}><i className="ti ti-alert-triangle" /><span>البرنامج مفتوح كملف من جهازك، فأي رابط منه هيفتح على جهازك بس ومش هيشتغل عند المرشح. ارفع ملف صفحة التقديم (apply) على الإنترنت مرة واحدة، واكتب عنوانه هنا، والرابط هيطلع صح لكل المرشحين.</span></div>}
            {can && (pubEdit || !baseUrl) && <div style={{ display: 'flex', gap: 6, marginTop: 6 }}><input dir="ltr" id="CAND_PUB" value={pubIn} onChange={(e) => setPubIn(e.target.value)} placeholder="https://ariba-apply.netlify.app" style={{ flex: 1 }} /><button className="btn bpl bsm" id="CAND_PUB_SAVE" onClick={savePub}><i className="ti ti-device-floppy" /> حفظ العنوان</button></div>}
          </div>
          <div><label>استيراد مرشح بالرابط: الصق رابط المرشح (أو رمز المرجع) لسحب بياناته وملفاته</label>
            <div style={{ display: 'flex', gap: 6 }}><input dir="ltr" id="CAND_REF" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="https://…/apply.html?c=… أو الرمز" style={{ flex: 1 }} /><button className="btn bpl bsm" id="CAND_PULL" onClick={pull}><i className="ti ti-download" /> سحب</button></div></div>
        </div>
      </div>
      <Invites baseUrl={baseUrl} can={can} />
      {can && auto && <div className="card" style={{ marginBottom: 10 }} id="CAND_AUTO">
        <div className="ch"><div className="ct"><i className="ti ti-bolt" /> <span>التسجيل التلقائي للمرشحين</span></div></div>
        <div style={{ padding: 12, display: 'grid', gap: 8 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}><input type="checkbox" id="CAND_AUTO_ON" checked={!!auto.on} onChange={(e) => saveAuto({ ...auto, on: e.target.checked, em: auto.em || L0.employers[0] || '', dep: auto.dep || L0.departments[0] || 'التشغيل', nature: auto.nature || 'indefinite' })} /> أي مرشح يملأ النموذج يتسجّل تلقائياً كموظف جديد ببياناته وملفاته</label>
          {auto.on && <div className="fg">
            <div><label>جهة العمل</label><select value={auto.em || ''} onChange={(e) => saveAuto({ ...auto, em: e.target.value })}>{L0.employers.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label>القسم</label><select value={auto.dep || ''} onChange={(e) => saveAuto({ ...auto, dep: e.target.value })}>{L0.departments.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label>طبيعة العقد</label><select value={auto.nature || 'indefinite'} onChange={(e) => saveAuto({ ...auto, nature: e.target.value })}><option value="indefinite">غير محدد المدة</option><option value="fixed">محدد المدة (12 شهر)</option></select></div>
          </div>}
          <div style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.7 }}>التسجيل يتم أثناء فتح البرنامج عند أي مسؤول موارد بشرية (خلال دقيقة من وصول الطلب). تاريخ المباشرة = يوم التسجيل والراتب من «الراتب المتوقع»، وتقدر تعدّلهم من ملف الموظف.</div>
        </div>
      </div>}
      <div className="card">
        <div className="ch"><div className="ct"><i className="ti ti-user-search" /> <span>المرشحون</span> {list && <span className="b bb">{shown.length}</span>}</div>
          <select value={flt} onChange={(e) => setFlt(e.target.value)} style={{ maxWidth: 160 }}><option value="new">بانتظار المراجعة</option><option value="accepted">المقبولون</option><option value="rejected">المرفوضون</option><option value="">الكل</option></select></div>
        {list === null && <div style={{ padding: 20, color: 'var(--mu)' }}>…</div>}
        {list && !shown.length && <div style={{ padding: 24, textAlign: 'center', color: 'var(--mu)' }}>لا يوجد مرشحون</div>}
        {shown.map((c) => <div key={c.id} data-cand={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(36,48,68,.4)' }}>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{c.data.nameAr}</div><div style={{ fontSize: 11, color: 'var(--mu)' }}>{c.data.position || '—'} · {c.data.mobile} · {new Date(c.submitted_at).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn')} · 📎 {c.files.length}</div></div>
          <span className={'b ' + ST[c.status][0]}>{ST[c.status][1]}</span>
          <button className="btn bsm" onClick={() => setCur(c)}>مراجعة</button>
        </div>)}
      </div>

      {cur && <Modal open onClose={() => setCur(null)} title={'مراجعة المرشح: ' + cur.data.nameAr} width={720}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 14px', fontSize: 12 }}>
          {FIELDS.filter(([k]) => cur.data[k]).map(([k, l]) => <div key={k}><span style={{ color: 'var(--mu)' }}>{l}: </span><b>{String(cur.data[k])}</b></div>)}</div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--mu)' }}>رمز المرجع: <span dir="ltr" style={{ userSelect: 'all' }}>{cur.ref}</span></div>
        <div style={{ margin: '10px 0 4px', fontWeight: 700, fontSize: 12 }}>الملفات المرفقة</div>
        {cur.files.map((f) => <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, padding: '3px 0' }}><span className="b bb">{DT[f.type] || f.type}</span><span style={{ flex: 1 }}>{f.name}</span><button className="btn bsm" onClick={() => openFile(f)}>فتح</button></div>)}
        {!cur.files.length && <div style={{ fontSize: 12, color: 'var(--mu)' }}>{cur.status === 'rejected' ? 'حُذفت الملفات بعد الرفض' : 'لا ملفات'}</div>}
        {cur.status !== 'new' && <div className={'al ' + (cur.status === 'accepted' ? 'alg' : 'alr')} style={{ marginTop: 10 }}>{ST[cur.status][1]}{cur.employee_id ? ' — الموظف رقم ' + cur.employee_id : ''}{cur.review_note ? ' — ' + cur.review_note : ''}</div>}
        {cur.status === 'new' && can && <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="btn bgl" id="CAND_ACCEPT" onClick={() => setAcc(cur)}>✓ قبول وإضافة كموظف</button><button className="btn" style={{ color: 'var(--rd)' }} onClick={() => setRej(cur)}>✗ رفض</button></div>}
      </Modal>}
      {acc && <AcceptModal c={acc} busy={busy} employees={employees} onClose={() => setAcc(null)} onGo={(v) => accept(acc, v)} />}
      <PromptModal open={!!rej} title="سبب الرفض" label="السبب (يُسجَّل)" required danger confirmText="رفض" onClose={() => setRej(null)} onConfirm={(v) => reject(rej, v)} />
    </div>
  );
}

function AcceptModal({ c, busy, employees, onClose, onGo }) {
  const L = getLists(employees);
  const [v, setV] = useState({ em: L.employers[0] || '', dep: L.departments[0] || 'التشغيل', jt: c.data.position || '', nature: 'indefinite', cj: new Date().toISOString().slice(0, 10), dur: '12', sal: c.data.expectedSalary || '', note: '' });
  const s = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title={'قبول ' + c.data.nameAr + ' وإضافته كموظف'} width={560}>
      <div className="al alb" style={{ marginBottom: 8, padding: '7px 10px' }}>سيُعطى رقماً وظيفياً تلقائياً (التالي في التسلسل)، وتُنقل كل ملفاته إلى وثائقه، ثم يُفتح ملفه لاستكمال أي بيانات.</div>
      <div className="fg">
        <div><label>جهة العمل *</label><select value={v.em} onChange={s('em')}>{L.employers.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label>القسم</label><select value={v.dep} onChange={s('dep')}>{L.departments.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label>الوظيفة</label><input value={v.jt} onChange={s('jt')} /></div>
        <div><label>تاريخ المباشرة</label><input type="date" value={v.cj} onChange={s('cj')} /></div>
        <div><label>طبيعة العقد</label><select value={v.nature} onChange={s('nature')}><option value="indefinite">غير محدد المدة</option><option value="fixed">محدد المدة</option></select></div>
        {v.nature === 'fixed' && <div><label>المدة (شهر)</label><input type="number" min="1" value={v.dur} onChange={s('dur')} /></div>}
        <div><label>الراتب الأساسي</label><input type="number" min="0" value={v.sal} onChange={s('sal')} /></div>
        <div className="ff"><label>ملاحظة القرار</label><input value={v.note} onChange={s('note')} /></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button className="btn bgl" id="CAND_CONFIRM" disabled={busy || !v.em} onClick={() => onGo(v)}>{busy ? '…' : 'تأكيد القبول وإضافة الموظف'}</button><button className="btn" onClick={onClose}>إلغاء</button></div>
    </Modal>
  );
}
