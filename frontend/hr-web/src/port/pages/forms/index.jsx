import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useApp, usePerm } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import { rpc } from '../../lib/api.js';
import { printOfficial, esc } from '../../lib/finance.js';
import { offerDraft } from '../../lib/offerDraft.js';
import { aiBridge } from '../../lib/aiBridge.js';
import { FORMS, wrap, CRIT, LAWS, offerHtml, SENDABLE } from './docs.js';
import { buildEn } from './formsEn.js';
import { loadTr } from '../../lib/tr.js';
import { mailDoc } from '../../lib/mailDoc.js';
import { BulkCard, SalaryCertCard } from './extraCards.jsx';

const STY = { padding: 6, border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--c2)', color: 'var(--tx)', fontSize: 12, width: '100%', boxSizing: 'border-box' };
const Fld = ({ l, children }) => <div style={{ marginBottom: 6 }}><label style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 600, display: 'block', marginBottom: 2 }}>{l}</label>{children}</div>;
const b64 = (s) => { try { return btoa(unescape(encodeURIComponent(s))); } catch { return btoa(s); } };
const TYPE_AR = { onboarding: 'مباشرة عمل', custody: 'استلام عهدة', extension: 'تمديد التجربة', termination: 'إشعار الإنهاء', contract_end: 'إنهاء عقد', clearance: 'إخلاء طرف', experience: 'شهادة خبرة', evaluation: 'تقييم التجربة', salary_cert: 'تعريف بالراتب' };
const STAT = { pending: '⏳ بانتظار الموظف', approved: '✅ تمت الموافقة', rejected: '⚠️ معترَض عليه' };
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

const FormsCtx = createContext(null);
function CardX({ k, icon, children, pbtn, title, id }) {
  const { T, canSend, busy, print, send, email } = useContext(FormsCtx);
  return (
    <div className="card" style={{ padding: 12 }} id={id || ('TFC_' + k)}>
      <div className="ct" style={{ marginBottom: 8 }}><i className={'ti ' + icon} /> {title || FORMS[k].ar}</div>
      {children}
      <button className="btn bgr bsm" style={{ marginTop: 8 }} data-print={k} onClick={() => print(k)}><i className="ti ti-printer" /> {pbtn}</button>
      {canSend && SENDABLE.includes(k) && <button className="btn bsm" data-send={k} disabled={busy === k} style={{ background: '#0a5c9e', color: '#fff', marginTop: 6, width: '100%' }} onClick={() => send(k)}><i className="ti ti-send" /> {busy === k ? T('جاري الإرسال...', 'Sending...') : T('إرسال للموظف للتوقيع', 'Send to employee to sign')}</button>}
      {canSend && SENDABLE.includes(k) && <button type="button" className="btn bsm" data-mail={k} disabled={busy === 'm' + k} style={{ background: '#7a3e00', color: '#fff', marginTop: 6, width: '100%' }} onClick={() => email(k)}><i className="ti ti-mail" /> {T('إرسال إيميل للموظف', 'Send email to employee')}</button>}
    </div>
  );
}

export default function Forms() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a); const { employees, settings } = useApp(); const perm = usePerm(); const canSend = perm.edit('forms');
  const [eid, setEid] = useState(''); const [st, setSt] = useState({ onboarding: { first: true }, custody: { items: [{ n: '', s: '', c: '' }] }, experience: { still: true, nature: 'دوام كامل' }, clearance: { reason: 'resign' }, evaluation: { scores: [70, 70, 70, 70, 70] }, contract_end: {} });
  const [status, setStatus] = useState(null), [busy, setBusy] = useState('');
  const [of, setOf] = useState({ name: '', basic: '', hou: '', tra: '', prj: '', oth: '', othn: '', job: '', ct: '', joinD: '', leave: 21, date: todayISO(), med: T('حسب سياسة الشركة', 'As per company policy'), lang: en ? 'en' : 'ar' });
  const list = useMemo(() => [...employees.filter((x) => !x.isTerminated), ...employees.filter((x) => x.isTerminated)], [employees]);
  const e = list.find((x) => String(x.id) === eid);
  const upd = (k, patch) => setSt((o) => ({ ...o, [k]: { ...o[k], ...patch } }));
  useEffect(() => { const d = offerDraft.data; if (d) { const rr = (n) => (Math.round((Number(n) || 0) * 100) / 100) || ''; setOf((o) => ({ ...o, basic: rr(d.basic), hou: rr(d.housing), tra: rr(d.transport), prj: rr(d.project), oth: rr(d.other), othn: d.otherLabel || '' })); offerDraft.data = null; setTimeout(() => { const el = document.getElementById('OF_NAME'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); } }, 200); } }, []);
  const ctx = { settings, employees };
  const mkFor = (k, emp, stk) => { const r = FORMS[k].build(emp, stk || {}, ctx); if (r.err) return { err: r.err }; return { title: (FORMS[k].sendAr || FORMS[k].ar), html: wrap(FORMS[k].ar, FORMS[k].en, r.body) }; };
  const make = (k) => { if (!e) { toast(T('اختر الموظف أولاً', 'Select the employee first'), 'ter'); return null; } const r = mkFor(k, e, st[k]); if (r.err) { toast(r.err, 'ter'); return null; } return r; };
  const print = async (k) => {
    if (en && e) { const tr = await loadTr(); const r = buildEn(k, e, st[k] || {}, { settings, employees, tr }); if (r && r.err) { toast(r.err, 'ter'); return; } if (r) { printOfficial(settings, r.title + ' — ' + (e.nameEn || e.nameAr || ''), r.html, { dir: 'ltr', lang: 'en' }); return; } }
    const r = make(k); if (r) printOfficial(settings, r.title + ' — ' + (e.nameAr || ''), r.html, { dir: 'rtl', lang: 'ar' });
  };
  // الإرسال: النموذج العربي + النسخة الإنجليزية بعد <!--ARIBA_EN-->
  const withEn = async (k, emp, stk, html) => { try { const tr = await loadTr(); const r = buildEn(k, emp, stk || {}, { settings, employees, tr }); return r && r.html ? html + '<!--ARIBA_EN-->' + r.html : html; } catch { return html; } };
  async function send(k) {
    const r = make(k); if (!r) return;
    if (!window.confirm('هيتبعت "' + r.title + '" لـ ' + (e.nameAr || '') + ' في تطبيقه عشان يوافق أو يعترض. متأكد؟')) return;
    setBusy(k);
    try { const html = await withEn(k, e, st[k], r.html); await rpc('ariba_hr_send_template', { p_employee_id: String(e.id), p_emp_no: String(e.empNo || e.id), p_template_type: k, p_title: r.title, p_file_name: k + '_' + e.id + '.html', p_mime_type: 'text/html', p_base64: b64(html) }); toast('✅ ' + T('اتبعت للموظف وبيقدر يوافق أو يعترض من تطبيقه', 'Sent to the employee for approval'), 'tin'); refresh(); }
    catch (err) { toast('⚠️ ' + (err.message || 'تعذر الإرسال'), 'ter'); } finally { setBusy(''); }
  }
  async function email(k) { const r = make(k); if (!r) return; setBusy('m' + k); try { await mailDoc(k, e, { title: r.title + ' — ' + (e.nameAr || ''), html: r.html }); } finally { setBusy(''); } }
  async function refresh() { try { const l = await rpc('ariba_hr_template_status', {}); setStatus(Array.isArray(l) ? l : (l && l.rows) || []); } catch (err) { setStatus({ err: String(err.message || err) }); } }
  const empName = (id) => { const f = employees.find((x) => String(x.id) === String(id)); return f ? (f.nameAr || f.nameEn || id) : id; };
  const Card = CardX;
  const fctx = { T, canSend, busy, print, send, email };
  const D = (k, f, label, type = 'date') => <Fld l={label}><input type={type} style={STY} value={(st[k] || {})[f] || ''} onChange={(x) => upd(k, { [f]: x.target.value })} /></Fld>;
  const ofSet = (k) => (x) => setOf((o) => ({ ...o, [k]: x.target.value }));
  const ofGross = ['basic', 'hou', 'tra', 'prj', 'oth'].reduce((a, k) => a + (parseFloat(of[k]) || 0), 0);
  // أوامر مساعد اريبا AI: اختيار الموظف وتاريخ النموذج وطباعته
  const [aiAuto, setAiAuto] = useState(null);
  useEffect(() => { const q = aiBridge.pending; if (q && q.kind === 'form') { aiBridge.pending = null; setEid(String(q.empId)); const df = { extension: 'end', termination: 'last', clearance: 'last' }[q.form]; if (q.date && df) upd(q.form, { [df]: q.date }); if (q.print) setAiAuto(q.form); } }, []); // eslint-disable-line
  useEffect(() => { if (aiAuto && e) { const k = aiAuto; setAiAuto(null); print(k); } }, [aiAuto, e, st]); // eslint-disable-line
  function fromCalc() { const f = offerDraft.last; if (!f) { toast(T('احسب في حاسبة الراتب الأول', 'Calculate in the salary calculator first'), 'ter'); return; } const rr = (n) => (Math.round((Number(n) || 0) * 100) / 100) || ''; setOf((o) => ({ ...o, basic: rr(f.basic), hou: rr(f.housing), tra: rr(f.transport), prj: rr(f.project), oth: rr(f.other), othn: f.otherLabel || '' })); }
  function printOffer() { if (!of.name.trim()) { toast(T('اكتب اسم المرشح', 'Enter the candidate name'), 'ter'); return; } const r = offerHtml(of, settings, employees); printOfficial(settings, r.title, r.html, { dir: of.lang === 'en' ? 'ltr' : 'rtl', lang: of.lang }); }
  return (
    <FormsCtx.Provider value={fctx}>
    <div>
      {canSend && <BulkCard ctx={{ employees, settings }} mkFor={mkFor} st={st} withEn={withEn} refresh={refresh} />}
      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="ct" style={{ marginBottom: 8 }}><i className="ti ti-user-search" /> {T('اختر الموظف (مشترك لكل النماذج)', 'Select the employee (shared by all forms)')}</div>
        <select id="TFE" style={{ ...STY, maxWidth: 420 }} value={eid} onChange={(x) => setEid(x.target.value)}><option value="">{T('— اختر الموظف —', '— Select —')}</option>{list.map((x) => <option key={x.id} value={x.id}>{x.nameAr || x.nameEn || x.id}</option>)}</select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
        <Card k="onboarding" icon="ti-login-2" pbtn="طباعة نموذج المباشرة">
          <Fld l="اسم المدير المباشر"><input style={STY} value={st.onboarding.mgr || ''} onChange={(x) => upd('onboarding', { mgr: x.target.value })} /></Fld>
          {D('onboarding', 'join', 'تاريخ المباشرة')}
          <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><input type="checkbox" checked={st.onboarding.first !== false} onChange={(x) => upd('onboarding', { first: x.target.checked })} /> مباشرة لأول مرة</label>
          <Fld l="نوع الإجازة (لو عائد من إجازة)"><input style={STY} placeholder="سنوية / مرضية / أمومة..." value={st.onboarding.lvType || ''} onChange={(x) => upd('onboarding', { lvType: x.target.value })} /></Fld>
        </Card>
        <Card k="custody" icon="ti-device-laptop" pbtn="طباعة نموذج العهدة" title={T('استلام عهدة تقنية', 'IT custody receipt')}>
          {st.custody.items.map((r, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, marginBottom: 6 }}>
            {[['n', 'اسم العهدة (لابتوب، جوال...)'], ['s', 'الموديل / الرقم التسلسلي'], ['c', 'الحالة (جديد/مستعمل)']].map(([f, ph]) => <input key={f} style={{ ...STY, fontSize: 11 }} placeholder={ph} value={r[f]} onChange={(x) => upd('custody', { items: st.custody.items.map((y, j) => (j === i ? { ...y, [f]: x.target.value } : y)) })} />)}
            <button type="button" className="btn bsm" style={{ color: 'var(--rd)' }} onClick={() => upd('custody', { items: st.custody.items.filter((_, j) => j !== i) })}><i className="ti ti-trash" /></button></div>)}
          <button type="button" className="btn bsm" style={{ color: 'var(--gr)', marginTop: 4 }} onClick={() => upd('custody', { items: [...st.custody.items, { n: '', s: '', c: '' }] })}><i className="ti ti-plus" /> إضافة عهدة</button>
        </Card>
        <Card k="extension" icon="ti-calendar-plus" pbtn="طباعة إشعار التمديد" title={T('تمديد فترة التجربة', 'Probation extension')}>{D('extension', 'join', 'تاريخ بداية العقد')}{D('extension', 'end', 'تاريخ نهاية التمديد الجديد')}</Card>
        <Card k="termination" icon="ti-calendar-x" pbtn="طباعة إشعار الإنهاء" title={T('إشعار بإنتهاء التعاقد (فترة التجربة)', 'Probation termination notice')}>{D('termination', 'join', 'تاريخ بداية العقد')}{D('termination', 'last', 'تاريخ آخر يوم عمل')}</Card>
        <Card k="clearance" icon="ti-logout" pbtn="طباعة إخلاء الطرف" title={T('إخلاء طرف', 'Final clearance')}>
          {D('clearance', 'join', 'تاريخ المباشرة')}{D('clearance', 'last', 'تاريخ آخر يوم عمل')}
          <Fld l="سبب إخلاء الطرف"><select style={STY} value={st.clearance.reason} onChange={(x) => upd('clearance', { reason: x.target.value })}><option value="resign">استقالة</option><option value="end">انتهاء العقد</option><option value="other">أخرى</option></select></Fld>
          <Fld l="توضيح (لو أخرى)"><input style={STY} value={st.clearance.other || ''} onChange={(x) => upd('clearance', { other: x.target.value })} /></Fld>
        </Card>
        <Card k="experience" icon="ti-certificate" pbtn="طباعة شهادة الخبرة">
          {D('experience', 'start', 'تاريخ بداية التعاقد')}
          <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0' }}><input type="checkbox" checked={st.experience.still !== false} onChange={(x) => upd('experience', { still: x.target.checked })} /> لا يزال على رأس العمل</label>
          <Fld l="تاريخ نهاية التعاقد (لو انتهى)"><input type="date" disabled={st.experience.still !== false} style={STY} value={st.experience.end || ''} onChange={(x) => upd('experience', { end: x.target.value })} /></Fld>
          <Fld l="طبيعة التعاقد"><input style={STY} value={st.experience.nature || ''} onChange={(x) => upd('experience', { nature: x.target.value })} /></Fld>
          <Fld l="رقم الشهادة الصادر"><input style={STY} placeholder="AR-000-2026" value={st.experience.no || ''} onChange={(x) => upd('experience', { no: x.target.value })} /></Fld>
        </Card>
        <Card k="evaluation" icon="ti-clipboard-check" pbtn="طباعة نموذج التقييم">
          {D('evaluation', 'join', 'تاريخ بداية العقد')}{D('evaluation', 'end', 'تاريخ نهاية فترة التجربة')}
          {CRIT.map((c, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><div style={{ flex: 1, fontSize: 11 }}>{c[1]}</div>
            <select style={{ ...STY, width: 170, fontSize: 11 }} value={st.evaluation.scores[i]} onChange={(x) => upd('evaluation', { scores: st.evaluation.scores.map((y, j) => (j === i ? +x.target.value : y)) })}>{[[0, 'غير مرضٍ'], [50, 'أقل من التوقعات'], [70, 'يحقق التوقعات'], [90, 'يفوق التوقعات'], [100, 'متميز']].map(([v, l]) => <option key={v} value={v}>{l} ({v}%)</option>)}</select></div>)}
          <Fld l="توصيات المدير المباشر"><textarea rows={2} style={STY} value={st.evaluation.rec || ''} onChange={(x) => upd('evaluation', { rec: x.target.value })} /></Fld>
          <div style={{ fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>{[['appoint', 'تثبيت'], ['terminate', 'إنهاء'], ['extend', 'تمديد']].map(([v, l]) => <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input type="radio" name="tf7dec" checked={st.evaluation.dec === v} onChange={() => upd('evaluation', { dec: v })} /> {l}</label>)}</div>
        </Card>
        <div className="card" style={{ padding: 12 }} id="TF_OFFER_CARD">
          <div className="ct" style={{ marginBottom: 8 }}><i className="ti ti-briefcase" /> {T('عرض وظيفي لمرشح', 'Job offer for a candidate')}</div>
          <Fld l={T('اسم المرشح', 'Candidate name') + ' *'}><input id="OF_NAME" style={STY} value={of.name} onChange={ofSet('name')} /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['basic', T('الراتب الأساسي', 'Basic salary')], ['hou', T('بدل السكن', 'Housing')], ['tra', T('بدل المواصلات', 'Transport')], ['prj', T('بدل المشروع', 'Project')], ['oth', T('بدلات أخرى', 'Other allowances')]].map(([k, l]) => <Fld key={k} l={l}><input type="number" step="0.01" id={'OF_' + k.toUpperCase()} style={STY} value={of[k]} onChange={ofSet(k)} /></Fld>)}
            <Fld l={T('نوع البدل الآخر', 'Other allowance name')}><input style={STY} value={of.othn} onChange={ofSet('othn')} /></Fld>
            <Fld l={T('الإجمالي (تلقائي)', 'Total (auto)')}><input id="OF_GROSS" readOnly style={{ ...STY, opacity: .8 }} value={ofGross ? Math.round(ofGross * 100) / 100 : ''} /></Fld>
          </div>
          <Fld l={T('الوظيفة (اختياري)', 'Position (optional)')}><input style={STY} value={of.job} onChange={ofSet('job')} /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Fld l={T('نوع العقد (اختياري)', 'Contract type')}><select style={STY} value={of.ct} onChange={ofSet('ct')}><option value="">—</option><option>{T('عقد محدد المدة', 'Fixed-term contract')}</option><option>{T('عقد غير محدد المدة', 'Open-ended contract')}</option><option>{T('فترة تجربة 90 يوم', '90-day probation')}</option></select></Fld>
            <Fld l={T('تاريخ الانضمام المقترح', 'Proposed joining date')}><input type="date" style={STY} value={of.joinD} onChange={ofSet('joinD')} /></Fld>
            <Fld l={T('الإجازة السنوية (يوم)', 'Annual leave (days)')}><input type="number" style={STY} value={of.leave} onChange={ofSet('leave')} /></Fld>
            <Fld l={T('تاريخ العرض', 'Offer date')}><input type="date" style={STY} value={of.date} onChange={ofSet('date')} /></Fld>
          </div>
          <Fld l={T('التغطية الطبية', 'Medical coverage')}><input style={STY} value={of.med} onChange={ofSet('med')} /></Fld>
          <Fld l={T('لغة العرض', 'Offer language')}><select style={STY} value={of.lang} onChange={ofSet('lang')}><option value="ar">{T('عربي', 'Arabic')}</option><option value="en">English</option></select></Fld>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button className="btn bgr bsm" id="OF_PRINT" onClick={printOffer}><i className="ti ti-printer" /> {T('طباعة العرض الوظيفي', 'Print the job offer')}</button><button className="btn bsm" id="OF_FROMCALC" onClick={fromCalc}>{T('جلب من حاسبة الراتب', 'Fetch from the salary calculator')}</button></div>
        </div>
        <Card k="contract_end" id="TF_CE_CARD" icon="ti-file-off" pbtn="طباعة إشعار انتهاء العقد" title={T('إشعار انتهاء عقد العمل', 'Employment contract termination notice')}>
          {D('contract_end', 'join', 'تاريخ بداية العقد (لو فاضي ياخده من ملف الموظف)')}{D('contract_end', 'last', 'تاريخ آخر يوم عمل')}
          <Fld l="السند النظامي (من مواد نظام العمل)"><select id="TF_CE_LAW" style={STY} value={st.contract_end.law || ''} onChange={(x) => upd('contract_end', { law: x.target.value })}><option value="">— اختر —</option>{Object.entries(LAWS).map(([k, v]) => <option key={k} value={k}>م.{v[0]} — {v[1]}</option>)}<option value="other">أخرى (اكتب المادة)</option></select></Fld>
          <div id="TF_CE_OTHERBOX" style={{ display: st.contract_end.law === 'other' ? 'block' : 'none' }}><Fld l="المادة / السند (نص حر)"><input id="TF_CE_OTHER" style={STY} value={st.contract_end.other || ''} onChange={(x) => upd('contract_end', { other: x.target.value })} /></Fld></div>
          {D('contract_end', 'ref', 'تاريخ الاستقالة / الاتفاق (اختياري)')}
          <Fld l="ملاحظات (اختياري)"><textarea id="TF_CE_NOTES" rows={2} style={STY} value={st.contract_end.notes || ''} onChange={(x) => upd('contract_end', { notes: x.target.value })} /></Fld>
        </Card>
        <SalaryCertCard ctx={{ employees, settings }} eid={eid} />
      </div>
      <div className="card" style={{ padding: 12, marginTop: 12 }} id="TF_STATUS_CARD">
        <div className="ct" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span><i className="ti ti-list-check" /> {T('حالة النماذج المُرسلة للموظفين', 'Status of forms sent to employees')}</span><button className="btn bsm" onClick={refresh}><i className="ti ti-refresh" /> {T('تحديث', 'Refresh')}</button></div>
        <div id="TF_STATUS_BOX">{!status ? <div style={{ padding: 14, textAlign: 'center', color: 'var(--mu)', fontSize: 12 }}>{T('اضغط تحديث لعرض الحالة', 'Press Refresh to show the status')}</div>
          : status.err ? <div style={{ padding: 14, textAlign: 'center', color: 'var(--rd)', fontSize: 12 }}>{status.err}</div>
          : !status.length ? <div style={{ padding: 14, textAlign: 'center', color: 'var(--mu)', fontSize: 12 }}>{T('لا توجد نماذج مُرسلة بعد', 'No forms sent yet')}</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}><thead><tr style={{ textAlign: 'right', color: 'var(--mu)' }}>{['الموظف', 'النموذج', 'الحالة', 'السبب', 'التاريخ'].map((h) => <th key={h} style={{ padding: 6 }}>{h}</th>)}</tr></thead>
            <tbody>{status.map((x, i) => <tr key={i} style={{ borderTop: '1px solid var(--bd)' }}><td style={{ padding: 6 }}>{empName(x.employee_id)}</td><td style={{ padding: 6 }}>{TYPE_AR[x.template_type] || x.template_type}</td><td style={{ padding: 6 }}>{x.status === 'pending' && x.stage === 'hr' ? '🕓 بانتظار اعتماد الموارد البشرية' : x.status === 'pending' && x.stage === 'manager' ? '✍️ بانتظار توقيع المدير المباشر' : STAT[x.status] || x.status}</td><td style={{ padding: 6, color: 'var(--rd)' }}>{x.rejection_reason || '—'}</td><td style={{ padding: 6, color: 'var(--mu)' }}>{x.updated_at ? new Date(x.updated_at).toLocaleString('ar-SA-u-ca-gregory-nu-latn') : ''}</td></tr>)}</tbody></table>}</div>
      </div>
    </div>
    </FormsCtx.Provider>
  );
}
void esc;
