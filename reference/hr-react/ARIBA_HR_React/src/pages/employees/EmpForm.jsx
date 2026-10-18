import PwReset from './PwReset.jsx';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../store/AppStore.jsx';
import { toast } from '../../components/Toast.jsx';
import { fN } from '../../lib/util.js';
import { getLists } from '../../lib/masterLists.js';
import { EMPLOYERS, NATS, DEPTS, emptyForm, formFromEmployee, buildEmployee, salaryPreview, addMonthsSafe, syncEmployee } from '../../lib/employees.js';
import { defaultExchangeRate } from '../../lib/data.js';
import EmpCustody from './EmpCustody.jsx';
import EmpDocsBox, { uploadEmpDocs } from './EmpDocsBox.jsx';

const REL = ['زوجة', 'زوج', 'ابن', 'ابنة', 'والد', 'والدة'];
const EMOJI = { زوجة: '👩', زوج: '👨', ابن: '👦', ابنة: '👧', والد: '👴', والدة: '👵' };
const emptyDep = () => ({ nameAr: '', nameEn: '', rel: 'زوجة', dob: '', idNo: '', idExp: '', ppNo: '', ppExp: '', insCo: '', insCard: '', insExp: '', mobile: '', files: [] });

function resizePhoto(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = rej;
    r.onload = () => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        const M = 480; const k = Math.min(1, M / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
const readFile = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res({ name: f.name, type: f.type, data: r.result }); r.onerror = rej; r.readAsDataURL(f); });

const Tab = ({ i, tab, setTab, children }) => <div className={'tab' + (tab === i ? ' on' : '')} onClick={() => setTab(i)}>{children}</div>;
/** سياق الاسترجاع: base = القيم المحفوظة عند فتح النموذج، f = القيم الحالية */
const UndoCtx = createContext(null);
const sameV = (a, b) => String(a == null ? '' : a) === String(b == null ? '' : b);
function UndoBtn({ k }) {
  const u = useContext(UndoCtx);
  if (!u || !k || !(k in u.base) || sameV(u.base[k], u.f[k])) return null;
  return <button type="button" className="undo-f" title={'استرجاع القيمة المحفوظة: ' + (String(u.base[k] || '') || '(فارغ)').slice(0, 40)} onClick={() => u.revert(k)}>↺</button>;
}
const Fi = ({ label, k, ...p }) => { const kk = k || (p.onChange && p.onChange.k); return <div><label>{label}<UndoBtn k={kk} /></label><input {...p} /></div>; };
const Fs = ({ label, opts, k, ...p }) => { const kk = k || (p.onChange && p.onChange.k); return <div><label>{label}<UndoBtn k={kk} /></label><select {...p}>{opts}</select></div>; };

export default function EmpForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { employees, reload, locations } = useApp();
  const existing = id ? employees.find((e) => e.id === id) : null;
  const [f, setF] = useState(() => (existing ? formFromEmployee(existing) : emptyForm()));
  const [deps, setDeps] = useState(() => (existing && Array.isArray(existing.deps) ? existing.deps : []));
  const [depForm, setDepForm] = useState(null); // {idx, d}
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState('');
  const [pwOpen, setPwOpen] = useState(false);
  const [picked, setPicked] = useState({}); const [docKey, setDocKey] = useState(0);
  const [modes, setModes] = useState(() => (existing && existing.allowModes) || {});
  const [wl, setWl] = useState(() => (existing && Array.isArray(existing.workLocationIds) ? existing.workLocationIds.map(String) : []));
  const physLocs = [...(locations || [])].filter((l) => l && l.active !== false && l.type !== 'remote').sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
  const first = useRef(true);
  useEffect(() => { if (existing && first.current) { first.current = false; setF(formFromEmployee(existing)); setDeps(Array.isArray(existing.deps) ? existing.deps : []); setModes(existing.allowModes || {}); } }, [existing]);

  const set = (k) => { const fn = (ev) => setF((p) => ({ ...p, [k]: ev.target.value })); fn.k = k; return fn; };
  // ----- استرجاع القيم المحفوظة (لكل حقل + الكل) -----
  const base = useMemo(() => (existing ? formFromEmployee(existing) : null), [existing]);
  const baseDeps = useMemo(() => (existing && Array.isArray(existing.deps) ? existing.deps : []), [existing]);
  const baseWl = useMemo(() => (existing && Array.isArray(existing.workLocationIds) ? existing.workLocationIds.map(String) : []), [existing]);
  const revert = (k) => setF((p) => ({ ...p, [k]: base[k] }));
  const changedKeys = base ? Object.keys(base).filter((k) => !sameV(base[k], f[k])) : [];
  const depsChanged = !!existing && JSON.stringify(deps) !== JSON.stringify(baseDeps);
  const wlChanged = !!existing && JSON.stringify([...wl].sort()) !== JSON.stringify([...baseWl].sort());
  const baseModes = (existing && existing.allowModes) || {};
  const modesChanged = !!existing && JSON.stringify(modes) !== JSON.stringify(baseModes);
  const anyChanged = changedKeys.length > 0 || depsChanged || wlChanged || modesChanged;
  function revertAll() {
    if (!window.confirm('استرجاع كل البيانات لآخر قيمة محفوظة؟ ستضيع التعديلات غير المحفوظة.')) return;
    setF(base); setDeps(baseDeps); setWl(baseWl); setModes(baseModes); setDepForm(null); toast('↺ رجعت كل البيانات للقيم المحفوظة', 'tin');
  }
  const AK = ['hou', 'tra', 'prj', 'oth', 'extra'];
  const r2n = (n) => Math.round((Number(n) || 0) * 100) / 100;
  useEffect(() => {
    setF((p) => { let ch = false; const n = { ...p }; AK.forEach((k) => { const m = modes[k]; if (m && m.m === 'pct') { const v = r2n((parseFloat(p.sal) || 0) * (parseFloat(m.p) || 0) / 100); if (String(p[k]) !== String(v)) { n[k] = v; ch = true; } } }); return ch ? n : p; });
  }, [modes, f.sal]); // eslint-disable-line
  const fixed = f.contractNature === 'fixed';
  // تاريخ نهاية العقد المحدد المدة يُحسب تلقائياً
  const autoEnd = fixed && f.dur ? addMonthsSafe(f.cj, f.dur) : '';
  const ceVal = fixed ? (autoEnd || f.ce) : f.ce;
  const pv = useMemo(() => salaryPreview(f), [f]);
  const managers = employees.filter((e) => !e.isTerminated && (!existing || e.id !== existing.id));
  const employerList = getLists(employees).employers;

  const onCurrency = (ev) => setF((p) => ({ ...p, currency: ev.target.value, exchRate: defaultExchangeRate(ev.target.value) }));
  async function onPhoto(ev) {
    const file = ev.target.files && ev.target.files[0]; if (!file) return;
    if (!file.type.startsWith('image/')) return toast('الملف لازم يكون صورة', 'ter');
    try { const d = await resizePhoto(file); setF((p) => ({ ...p, photoData: d })); } catch { toast('تعذر قراءة الصورة', 'ter'); }
  }
  async function submit(ev) {
    ev.preventDefault();
    const fx = { ...f, ce: ceVal }; AK.forEach((k) => { const m = modes[k]; if (m && m.m === 'pct') fx[k] = r2n((parseFloat(f.sal) || 0) * (parseFloat(m.p) || 0) / 100); });
    const r = buildEmployee(fx, existing, employees);
    if (r.error) return toast(r.error, 'ter');
    const emp = { ...r.emp, deps };
    const mm = {}; AK.forEach((k) => { const m = modes[k]; if (m && m.m === 'pct') mm[k] = { m: 'pct', p: parseFloat(m.p) >= 0 ? parseFloat(m.p) : 0 }; });
    if (Object.keys(mm).length) emp.allowModes = mm; else delete emp.allowModes;
    if (wl.length) emp.workLocationIds = wl.slice(); else delete emp.workLocationIds;
    if (existing && (existing.isTerminated || existing.term)) {
      const expired = emp.contractNature === 'fixed' && emp.contractEnd && new Date(emp.contractEnd) < new Date(new Date().toISOString().slice(0, 10));
      if (!expired) { emp.isTerminated = false; emp.term = false; emp.terminationReason = ''; emp.lastDay = ''; }
    }
    setSaving(true);
    try {
      await syncEmployee(emp);
      if (Object.values(picked).some(Boolean)) { const n = await uploadEmpDocs(emp.id, picked); if (n) toast('✓ تم رفع ' + n + ' وثيقة'); setPicked({}); setDocKey((k) => k + 1); }
      toast(existing ? '✓ تم تحديث بيانات الموظف' : `✓ تم إضافة ${emp.nameAr} | ${emp.username}`);
      setDone('✓ محفوظ — قابل للتعديل دائماً');
      await reload({ silent: true });
      nav('/emps');
    } catch (e) { toast('❌ لم يُحفظ الموظف: ' + (e.message || e), 'ter'); } finally { setSaving(false); }
  }

  // ----- التابعون -----
  const dField = (k) => (ev) => setDepForm((p) => ({ ...p, d: { ...p.d, [k]: ev.target.value } }));
  async function addFiles(ev) {
    const arr = [...ev.target.files]; const ok = [];
    for (const file of arr) { if (file.size > 1.5 * 1024 * 1024) { toast(file.name + ' أكبر من 1.5MB', 'ter'); continue; } if (!/^(application\/pdf|image\/(jpeg|png))$/.test(file.type)) { toast(file.name + ' نوع غير مدعوم', 'ter'); continue; } ok.push(await readFile(file)); }
    setDepForm((p) => ({ ...p, d: { ...p.d, files: [...(p.d.files || []), ...ok] } }));
    ev.target.value = '';
  }
  function saveDep() {
    const d = depForm.d;
    if (!d.nameAr.trim()) return toast('اسم التابع مطلوب', 'ter');
    setDeps((a) => (depForm.idx >= 0 ? a.map((x, i) => (i === depForm.idx ? d : x)) : [...a, d]));
    setDepForm(null);
  }
  const dLeft = (d) => (d ? Math.round((new Date(d) - new Date()) / 86400000) : 9999);
  const badge = (n) => (n === 9999 ? null : <span style={{ color: n <= 30 ? 'var(--rd)' : n <= 90 ? 'var(--am)' : 'var(--gr)', fontWeight: 700, marginInlineStart: 4 }}>({n < 0 ? 'منتهي' : n + ' يوم'})</span>);
  const allow = (k, label) => { const m = modes[k] || { m: 'amt' }, isPct = m.m === 'pct';
    return <div data-apct={k}><label>{label}<UndoBtn k={k} /></label><input type="number" step="0.01" value={f[k]} readOnly={isPct} title={isPct ? 'يُحسب تلقائيًا = الأساسي × النسبة' : ''} style={isPct ? { opacity: 0.75 } : undefined} onChange={set(k)} />
      <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
        <select aria-label={label} style={{ flex: 1, minWidth: 0 }} value={isPct ? 'pct' : 'amt'} onChange={(ev) => { const v = ev.target.value; setModes((o) => { const n = { ...o }; if (v === 'pct') { const b = parseFloat(f.sal) || 0, a = parseFloat(f[k]) || 0; n[k] = { m: 'pct', p: b > 0 ? r2n(a / b * 100) : '' }; } else delete n[k]; return n; }); }}><option value="amt">مبلغ ثابت</option><option value="pct">نسبة % من الأساسي</option></select>
        {isPct && <input type="number" step="0.01" min="0" max="1000" placeholder="النسبة %" aria-label={'نسبة ' + label} style={{ width: 90 }} value={m.p} onChange={(ev) => setModes((o) => ({ ...o, [k]: { m: 'pct', p: ev.target.value } }))} />}
      </div></div>; };
  const num = (k, label) => <div><label>{label}<UndoBtn k={k} /></label><input type="number" step="0.01" value={f[k]} onChange={set(k)} /></div>;

  if (id && !existing) return <div className="pg on" style={{ padding: 20, color: 'var(--mu)' }}>الموظف غير موجود</div>;
  return (
    <div className="pg on">
      {existing && <PwReset open={pwOpen} onClose={() => setPwOpen(false)} preselect={existing.id} />}
      <div className="card">
        <div className="ch"><div className="ct"><i className="ti ti-user-plus" /> <span>{existing ? 'تعديل: ' + existing.nameAr : 'إضافة موظف'}</span></div>
          <div style={{ display: 'flex', gap: 6 }}><button type="button" className="btn bsm" onClick={() => nav('/emps')}><i className="ti ti-arrow-back-up" /> تراجع</button></div></div>
        <div className="tbar"><Tab i={0} tab={tab} setTab={setTab}>البيانات الأساسية</Tab><Tab i={1} tab={tab} setTab={setTab}>الوثائق</Tab><Tab i={2} tab={tab} setTab={setTab}>العقد</Tab><Tab i={3} tab={tab} setTab={setTab}>الراتب</Tab><Tab i={4} tab={tab} setTab={setTab}><i className="ti ti-package" /> العهدة</Tab><Tab i={5} tab={tab} setTab={setTab}>👨‍👩‍👧 التابعون</Tab></div>
        <UndoCtx.Provider value={base ? { base, f, revert } : null}>
        <form onSubmit={submit} autoComplete="off">
          {tab === 0 && <div className="fg">
            <div className="fsec">البيانات الشخصية</div>
            <Fi required value={f.na} onChange={set('na')} label="الاسم بالعربي *" />
            <Fi value={f.ne} onChange={set('ne')} label="الاسم بالإنجليزي" />
            <Fi value={f.empNo} onChange={set('empNo')} label="الرقم الوظيفي" inputMode="numeric" pattern="[0-9]*" placeholder="مثال: 102" />
            <Fs required value={f.em} onChange={set('em')} label="جهة العمل *" opts={[<option key="" value="">اختر...</option>, ...employerList.map((x) => <option key={x}>{x}</option>)]} />
            <div id="WL_BOX" style={{ gridColumn: '1/-1', background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 3 }}><i className="ti ti-map-pin" /> مواقع العمل (مربوطة بمواقع البصمة)</div>
              <div style={{ fontSize: 10.5, color: 'var(--mu)', lineHeight: 1.7, marginBottom: 6 }}>اختار موقع أو أكتر — الموظف هيبصم في المواقع دي بس. لو سيبتها فاضية، هيبصم في مواقع جهة عمله زي الأول.</div>
              <div id="WL_LIST" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: '4px 12px' }}>
                {physLocs.length ? physLocs.map((l) => <label key={l.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer', margin: 0, fontWeight: 500, color: 'var(--tx)' }}>
                  <input type="checkbox" style={{ width: 'auto', margin: 0 }} value={l.id} checked={wl.includes(String(l.id))} onChange={(ev) => setWl((a) => (ev.target.checked ? [...a, String(l.id)] : a.filter((x) => x !== String(l.id))))} />
                  <span>{l.name}</span><span style={{ fontSize: 9.5, background: 'rgba(41,179,94,.15)', color: '#1f9a4f', borderRadius: 8, padding: '0 6px' }}>{l.type === 'hq' ? 'مقر رئيسي' : 'مشروع'}</span>
                  {l.employer && l.employer !== 'all' && <span style={{ fontSize: 9.5, color: 'var(--mu)' }}>{l.employer}</span>}</label>)
                  : <div style={{ fontSize: 11, color: 'var(--mu)' }}>مفيش مواقع بصمة — أضف من "مواقع البصمة".</div>}
              </div>
            </div>
            <Fs value={f.nat} onChange={set('nat')} label="الجنسية" opts={[...new Set([...NATS, f.nat].filter(Boolean))].map((x) => <option key={x}>{x}</option>)} />
            <Fs value={f.dep} onChange={set('dep')} label="القسم" opts={[...new Set([...getLists(employees).departments, f.dep].filter(Boolean))].map((x) => <option key={x}>{x}</option>)} />
            <Fi value={f.jt} onChange={set('jt')} label="الوظيفة" /><Fi value={f.dob} onChange={set('dob')} label="تاريخ الميلاد" type="date" /><Fi value={f.mb} onChange={set('mb')} label="الجوال" /><Fi value={f.ml} onChange={set('ml')} label="البريد الإلكتروني" type="email" />
            <div className="fsec" style={{ marginTop: 8 }}>صورة الموظف</div>
            <div className="photo-field">
              <div className="emp-photo-preview">{(f.photoData || (existing && existing.photoUrl)) ? <img src={f.photoData || existing.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : 'لا توجد صورة'}</div>
              <div><label>رفع صورة الموظف<UndoBtn k="photoData" /></label><input type="file" accept="image/*" onChange={onPhoto} />
                <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 5 }}>الصورة تحفظ داخل بيانات الموظف وتظهر تلقائيًا في تطبيق الموظف (تُصغَّر تلقائياً).</div></div>
            </div>
            <Fi value={f.bk} onChange={set('bk')} label="البنك" /><Fi value={f.ib} onChange={set('ib')} label="الIBAN" /><Fi value={f.sp} onChange={set('sp')} label="الكفيل" />
            <Fs value={f.rel} onChange={set('rel')} label="الديانة" opts={['مسلم', 'مسلمة', 'أخرى'].map((x) => <option key={x}>{x}</option>)} />
            <div><label>المدير المباشر<UndoBtn k="managerId" /></label><select value={f.managerId} onChange={set('managerId')}><option value="">لا يوجد مدير مباشر</option>{managers.map((m) => <option key={m.id} value={m.id}>{String(m.nameAr || '').split(' ').slice(0, 3).join(' ')} — {m.jobTitle || m.employer}</option>)}</select></div>
            <div className="ff"><label>ملاحظات</label><textarea rows={2} value={f.notes} onChange={set('notes')} /></div>
          </div>}
          {tab === 1 && <div className="fg">
            <div className="fsec">الوثائق الرسمية</div>
            <Fi value={f.iq} onChange={set('iq')} label="رقم الإقامة/الهوية" /><Fi value={f.iqe} onChange={set('iqe')} label="انتهاء الإقامة" type="date" /><Fi value={f.pn} onChange={set('pn')} label="رقم جواز السفر" /><Fi value={f.ppe} onChange={set('ppe')} label="انتهاء الجواز" type="date" />
            <div className="fsec">التأمين الطبي</div>
            <Fi value={f.ic} onChange={set('ic')} label="شركة التأمين" /><Fi value={f.icl} onChange={set('icl')} label="فئة التأمين" /><Fi value={f.icard} onChange={set('icard')} label="رقم البطاقة" /><Fi value={f.ie} onChange={set('ie')} label="انتهاء التأمين" type="date" />
            <EmpDocsBox empId={existing && existing.id} picked={picked} setPicked={setPicked} refreshKey={docKey} />
          </div>}
          {tab === 2 && <div className="fg">
            <div className="fsec">بيانات العقد</div>
            <Fs value={f.contractNature} onChange={set('contractNature')} label="طبيعة العقد" opts={[<option key="f" value="fixed">محدد المدة</option>, <option key="i" value="indefinite">غير محدد المدة</option>]} />
            <div><label>مدة العقد (شهر)<UndoBtn k="dur" /></label><input type="number" min="1" step="1" disabled={!fixed} value={fixed ? f.dur : ''} onChange={set('dur')} /></div>
            <Fi value={f.cj} onChange={set('cj')} label="تاريخ المباشرة" type="date" />
            <div><label>انتهاء العقد / آخر يوم عمل<UndoBtn k="ce" /></label><input type="date" disabled={fixed} value={ceVal} onChange={set('ce')} /></div>
            <div className="ff" style={{ fontSize: 10, color: 'var(--mu)', padding: '4px 0' }}>{fixed ? 'محدد المدة: أدخل تاريخ المباشرة وعدد الأشهر، وسيتم حساب تاريخ انتهاء العقد تلقائياً.' : 'غير محدد المدة: لا يوجد تاريخ انتهاء للعقد. عند إنهاء خدمة الموظف يتم تحديد آخر يوم عمل يدوياً ويُسجل كتاريخ الانتهاء.'}</div>
            <Fi value={f.ldc} onChange={set('ldc')} label="أيام الإجازة السنوية" type="number" />
          </div>}
          {tab === 3 && <div className="fg">
            <div className="fsec">الراتب والبدلات</div>
            {num('sal', 'الراتب الأساسي')}{allow('hou', 'بدل السكن')}{allow('tra', 'بدل المواصلات')}{allow('prj', 'بدل المشروع')}{allow('oth', 'بدلات أخرى')}{num('ded', 'استقطاعات أخرى')}{allow('extra', 'إضافي')}
            <div className="fsec" style={{ marginTop: 8 }}>التأمينات وحماية الأجور</div>
            <div><label>العملة<UndoBtn k="currency" /></label><select value={f.currency} onChange={onCurrency}><option value="ريال سعودي">ريال سعودي (SAR)</option><option value="دولار">دولار (USD)</option><option value="يورو">يورو (EUR)</option><option value="جنيه مصري">جنيه مصري (EGP)</option></select></div>
            <div><label>معدل الصرف<UndoBtn k="exchRate" /></label><input type="number" step="0.0001" value={f.exchRate} onChange={set('exchRate')} /></div>
            <Fs value={f.insSystem} onChange={set('insSystem')} label="نظام التأمينات" opts={[<option key="o" value="old">لا يطابق 9.75%+11.75%</option>, <option key="n" value="new">يطابق 10.75%+12.75%</option>, <option key="e" value="expat">غير سعودي 0%+2%</option>, <option key="x" value="exempt">معفى من التأمينات</option>]} />
            <Fs value={f.wpsType} onChange={set('wpsType')} label="نوع الموظف / WPS" opts={[['wps', 'خاضع حماية الأجور (WPS)'], ['trainee', 'متدرب'], ['tamheer', 'تمهير'], ['external', 'عقد خارجي'], ['consultant', 'استشاري'], ['no_wps', 'بدون WPS'], ['remote', 'عن بعد']].map(([v, t]) => <option key={v} value={v}>{t}</option>)} />
            <div className="ff"><div style={{ background: 'var(--c2)', borderRadius: 8, padding: 10, border: '1px solid var(--bd)', display: 'grid', gridTemplateColumns: `repeat(${(pv.isSAR ? 4 : 5) + (pv.eg ? 1 : 0)},1fr)`, gap: 8, fontSize: 12 }}>
              <div><div style={{ color: 'var(--mu)', fontSize: 10 }}>الإجمالي</div><div style={{ fontWeight: 700, color: 'var(--gr)' }}>{fN(pv.tot)} {pv.isSAR ? 'ر.س' : pv.cur}</div></div>
              <div><div style={{ color: 'var(--mu)', fontSize: 10 }}>تأمين موظف</div><div style={{ color: 'var(--rd)' }}>{pv.ins > 0 ? '-' + fN(pv.ins) + ' ' + (pv.isSAR ? 'ر.س' : pv.cur) : 'لا يوجد'}</div></div>
              <div><div style={{ color: 'var(--mu)', fontSize: 10 }}>تأمين شركة</div><div style={{ color: 'var(--am)' }}>{fN(pv.insC)} {pv.isSAR ? 'ر.س' : pv.cur}</div></div>
              {pv.eg && <div><div style={{ color: 'var(--mu)', fontSize: 10 }}>ضريبة كسب العمل + صندوق الشهداء</div><div style={{ color: 'var(--rd)' }}>{pv.tax > 0 ? '-' + fN(pv.tax) + ' ' + (pv.isSAR ? 'ر.س' : pv.cur) : 'معفى'}</div></div>}
              <div><div style={{ color: 'var(--mu)', fontSize: 10 }}>{pv.isSAR ? 'الصافي' : 'صافي/' + pv.cur}</div><div style={{ fontWeight: 700, color: 'var(--cy)' }}>{fN(pv.net)} {pv.isSAR ? 'ر.س' : pv.cur}</div></div>
              {!pv.isSAR && <div><div style={{ color: 'var(--mu)', fontSize: 10 }}>صافي/ريال</div><div style={{ fontWeight: 800, color: 'var(--bl)' }}>{fN(pv.netSAR)} ر.س</div></div>}
            </div></div>
          </div>}
          {tab === 4 && <EmpCustody emp={existing} />}
          {tab === 5 && <div style={{ padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--bd)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--bl)' }}>👨‍👩‍👧 التابعون — أفراد الأسرة</div>
              {depsChanged && <button type="button" className="btn bsm" onClick={() => setDeps(baseDeps)}>↺ استرجاع التابعين</button>}
              <button type="button" className="btn bpl" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => setDepForm({ idx: -1, d: emptyDep() })}><i className="ti ti-plus" /> إضافة تابع</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              {!deps.length && <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 20, fontSize: 13 }}>لا يوجد تابعون — اضغط إضافة تابع</div>}
              {deps.map((d, i) => (
                <div key={i} style={{ background: 'var(--c2)', borderRadius: 12, padding: 12, marginBottom: 8, borderInlineEnd: '3px solid var(--gr)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 20 }}>{EMOJI[d.rel] || '👤'}</span><div><div style={{ fontWeight: 700, fontSize: 13 }}>{d.nameAr}</div><div style={{ fontSize: 11, color: 'var(--mu)' }}>{d.rel}</div></div></div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" className="btn bsm" title="تعديل" onClick={() => setDepForm({ idx: i, d: { ...emptyDep(), ...d } })}><i className="ti ti-edit" /></button>
                      <button type="button" className="btn bsm" style={{ color: 'var(--rd)' }} title="حذف" onClick={() => { if (window.confirm('حذف هذا التابع؟')) setDeps((a) => a.filter((_, j) => j !== i)); }}><i className="ti ti-trash" /></button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, fontSize: 11 }}>
                    {d.idNo && <div>🪪 <span style={{ color: 'var(--mu)' }}>الهوية/الإقامة:</span> <strong>{d.idNo}</strong>{badge(dLeft(d.idExp))}</div>}
                    {d.ppNo && <div>📘 <span style={{ color: 'var(--mu)' }}>الجواز:</span> <strong>{d.ppNo}</strong>{badge(dLeft(d.ppExp))}</div>}
                    {d.mobile && <div>📱 {d.mobile}</div>}{d.dob && <div>🎂 {d.dob}</div>}
                    {(d.insCo || d.insCard) && <div>💊 تأمين: <strong>{d.insCo} {d.insCard}</strong>{badge(dLeft(d.insExp))}</div>}
                    {(d.files && d.files.length > 0) && <div style={{ color: 'var(--bl)' }}>📎 {d.files.length} ملف</div>}
                  </div>
                </div>
              ))}
            </div>
            {depForm && <div style={{ background: 'var(--c2)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div className="fsec">بيانات التابع</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label>الاسم بالعربي</label><input value={depForm.d.nameAr} onChange={dField('nameAr')} style={{ width: '100%' }} /></div>
                <div><label>الاسم بالإنجليزي</label><input value={depForm.d.nameEn} onChange={dField('nameEn')} style={{ width: '100%' }} /></div>
                <div><label>العلاقة</label><select value={depForm.d.rel} onChange={dField('rel')} style={{ width: '100%' }}>{REL.map((r) => <option key={r}>{r}</option>)}</select></div>
                <div><label>تاريخ الميلاد</label><input type="date" value={depForm.d.dob} onChange={dField('dob')} style={{ width: '100%' }} /></div>
                <div><label>رقم الهوية / الإقامة</label><input value={depForm.d.idNo} onChange={dField('idNo')} style={{ width: '100%' }} /></div>
                <div><label>انتهاء الهوية / الإقامة</label><input type="date" value={depForm.d.idExp} onChange={dField('idExp')} style={{ width: '100%' }} /></div>
                <div><label>رقم الجواز</label><input value={depForm.d.ppNo} onChange={dField('ppNo')} style={{ width: '100%' }} /></div>
                <div><label>انتهاء الجواز</label><input type="date" value={depForm.d.ppExp} onChange={dField('ppExp')} style={{ width: '100%' }} /></div>
                <div><label>شركة التأمين الطبي</label><input value={depForm.d.insCo} onChange={dField('insCo')} style={{ width: '100%' }} /></div>
                <div><label>رقم بطاقة التأمين</label><input value={depForm.d.insCard} onChange={dField('insCard')} style={{ width: '100%' }} /></div>
                <div><label>انتهاء التأمين</label><input type="date" value={depForm.d.insExp} onChange={dField('insExp')} style={{ width: '100%' }} /></div>
                <div><label>رقم الجوال</label><input value={depForm.d.mobile} onChange={dField('mobile')} style={{ width: '100%' }} /></div>
              </div>
              <div style={{ marginBottom: 10 }}><label>المرفقات (هوية / جواز / بطاقة تأمين / كرت عائلي) — PDF/JPG/PNG حتى 1.5MB</label>
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={addFiles} style={{ width: '100%', marginTop: 4 }} />
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>{(depForm.d.files || []).map((x, i) => <span key={i} className="b bb">{x.name} <span style={{ cursor: 'pointer' }} onClick={() => setDepForm((p) => ({ ...p, d: { ...p.d, files: p.d.files.filter((_, j) => j !== i) } }))}>✕</span></span>)}</div></div>
              <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn bgl" style={{ flex: 1 }} onClick={saveDep}><i className="ti ti-check" /> حفظ التابع</button><button type="button" className="btn" style={{ flex: 1 }} onClick={() => setDepForm(null)}>إلغاء</button></div>
            </div>}
          </div>}
          <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="submit" className="btn bpl" disabled={saving}><i className="ti ti-check" /> <span>{saving ? 'جارٍ الحفظ…' : 'حفظ وتحديث'}</span></button>
            {existing && <button type="button" className="btn bsm" id="EMP_REVERT_ALL" disabled={!anyChanged} title="استرجاع كل البيانات لآخر قيمة محفوظة" onClick={revertAll}>↺ استرجاع الكل{anyChanged ? ' (' + (changedKeys.length + (depsChanged ? 1 : 0) + (wlChanged ? 1 : 0)) + ')' : ''}</button>}
            {existing && <button type="button" className="btn bsm" id="PW_OPEN" onClick={() => setPwOpen(true)}>🔑 كلمة مرور جديدة لتطبيق الموظف</button>}
            <button type="button" className="btn bsm" onClick={() => nav('/emps')}>إلغاء</button>
            <span style={{ fontSize: 11, color: 'var(--gr)' }}>{done || '⚡ يمكنك التعديل دائماً — يمكن التراجع بعد الحفظ'}</span>
          </div>
        </form>
        </UndoCtx.Provider>
      </div>
    </div>
  );
}
