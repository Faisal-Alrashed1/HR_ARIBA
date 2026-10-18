import { useMemo, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { fD } from '../../lib/util.js';
import { empNoSort } from '../../lib/finance.js';
import ExportDialog from '../../components/ExportDialog.jsx';

const age = (d) => { if (!d) return ''; const b = new Date(d); if (isNaN(b)) return ''; const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const yos = (e) => { const j = e.contractJoin || e.joinDate; if (!j) return ''; const d = (new Date() - new Date(j)) / 31557600000; return d > 0 ? Math.round(d * 10) / 10 : ''; };
const mgrName = (e, all) => { const m = all.find((x) => String(x.id) === String(e.managerId)); return m ? m.nameAr : ''; };
/** كتالوج الحقول: [المجموعة، مفتاح، عربي، إنجليزي، دالة القيمة] */
const G = (grp, list) => list.map(([k, ar, en, get]) => ({ grp, k, ar, en, get }));
const CATALOG = [
  ...G('البيانات الشخصية', [
    ['empNo', 'الرقم الوظيفي', 'Employee no.', (e) => e.empNo || e.id], ['nameAr', 'الاسم بالعربي', 'Name (AR)', (e) => e.nameAr], ['nameEn', 'الاسم بالإنجليزي', 'Name (EN)', (e) => e.nameEn],
    ['nationality', 'الجنسية', 'Nationality', (e) => e.nationality], ['dob', 'تاريخ الميلاد', 'Birth date', (e) => fD(e.dob)], ['age', 'العمر', 'Age', (e) => age(e.dob)],
    ['religion', 'الديانة', 'Religion', (e) => e.religion], ['mobile', 'الجوال', 'Mobile', (e) => e.mobile], ['email', 'البريد الإلكتروني', 'Email', (e) => e.email]]),
  ...G('الوظيفة', [
    ['employer', 'جهة العمل', 'Employer', (e) => e.employer], ['dept', 'القسم', 'Department', (e) => e.dept || e.department], ['jobTitle', 'الوظيفة', 'Job title', (e) => e.jobTitle],
    ['manager', 'المدير المباشر', 'Direct manager', (e, all) => mgrName(e, all)], ['deps', 'عدد التابعين', 'Dependents', (e) => (Array.isArray(e.deps) ? e.deps.length : 0)]]),
  ...G('الوثائق', [
    ['iqamaNo', 'رقم الهوية/الإقامة', 'ID/Iqama no.', (e) => e.iqamaNo], ['iqamaExpiry', 'انتهاء الإقامة', 'Iqama expiry', (e) => fD(e.iqamaExpiry)], ['passportNo', 'رقم الجواز', 'Passport no.', (e) => e.passportNo],
    ['passportExpiry', 'انتهاء الجواز', 'Passport expiry', (e) => fD(e.passportExpiry)], ['insuranceCo', 'شركة التأمين', 'Insurer', (e) => e.insuranceCo], ['insuranceClass', 'فئة التأمين', 'Insurance class', (e) => e.insuranceClass],
    ['insuranceCard', 'رقم بطاقة التأمين', 'Insurance card', (e) => e.insuranceCard], ['insuranceExpiry', 'انتهاء التأمين', 'Insurance expiry', (e) => fD(e.insuranceExpiry)]]),
  ...G('العقد والإجازات', [
    ['contractType', 'نوع العقد', 'Contract type', (e) => e.contractType], ['contractJoin', 'تاريخ المباشرة', 'Join date', (e) => fD(e.contractJoin)], ['contractEnd', 'انتهاء العقد', 'Contract end', (e) => fD(e.contractEnd)],
    ['yos', 'سنوات الخدمة', 'Years of service', (e) => yos(e)], ['leaveBalance', 'رصيد الإجازة', 'Leave balance', (e) => e.leaveBalance]]),
  ...G('الراتب', [
    ['salary', 'الراتب الأساسي', 'Basic salary', (e) => e.salary], ['housing', 'بدل السكن', 'Housing', (e) => e.housingAllowance], ['transport', 'بدل المواصلات', 'Transport', (e) => e.transportAllowance],
    ['salaryTotal', 'إجمالي الراتب', 'Total salary', (e) => e.salaryTotal], ['netSalary', 'صافي الراتب', 'Net salary', (e) => e.netSalary], ['currency', 'العملة', 'Currency', (e) => e.currency]]),
  ...G('البنك', [
    ['bank', 'البنك', 'Bank', (e) => e.bank], ['iban', 'الآيبان IBAN', 'IBAN', (e) => e.iban], ['account', 'رقم الحساب', 'Account no.', (e) => e.accountNo || e.bankAccount || e.account], ['sponsor', 'الكفيل', 'Sponsor', (e) => e.sponsor]]),
];
const GROUPS = [...new Set(CATALOG.map((c) => c.grp))];
const GEN = { 'البيانات الشخصية': 'Personal', 'الوظيفة': 'Job', 'الوثائق': 'Documents', 'العقد والإجازات': 'Contract & leave', 'الراتب': 'Salary', 'البنك': 'Bank' };
const GICO = { 'البيانات الشخصية': 'ti-user', 'الوظيفة': 'ti-briefcase', 'الوثائق': 'ti-id', 'العقد والإجازات': 'ti-file-text', 'الراتب': 'ti-cash', 'البنك': 'ti-building-bank' };
const DEFAULT = ['empNo', 'nameAr', 'jobTitle', 'nationality'];
const PRESETS = [
  ['أساسي', 'Basic', 'ti-list', ['empNo', 'nameAr', 'jobTitle', 'dept', 'employer', 'nationality']],
  ['الاتصال', 'Contact', 'ti-phone', ['empNo', 'nameAr', 'mobile', 'email', 'employer']],
  ['الوثائق والانتهاء', 'Documents & expiry', 'ti-id', ['empNo', 'nameAr', 'iqamaNo', 'iqamaExpiry', 'passportNo', 'passportExpiry', 'insuranceExpiry']],
  ['العقود', 'Contracts', 'ti-file-text', ['empNo', 'nameAr', 'contractType', 'contractJoin', 'contractEnd', 'yos', 'leaveBalance']],
  ['الرواتب والبنك', 'Payroll & bank', 'ti-cash', ['empNo', 'nameAr', 'salary', 'salaryTotal', 'netSalary', 'bank', 'iban']],
];
const LS = 'ariba_cr_templates_v1';
const readTpl = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } };

export default function CustomReport() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a);
  const { activeEmps, terminatedEmps } = useApp();
  const [fields, setFields] = useState(DEFAULT), [mode, setMode] = useState('all'), [sel, setSel] = useState({}), [q, setQ] = useState(''), [inclTerm, setInclTerm] = useState(false), [dlg, setDlg] = useState(false);
  const [fEmployer, setFEmployer] = useState(''), [fDept, setFDept] = useState(''), [tpls, setTpls] = useState(readTpl), [tname, setTname] = useState('');
  const all = useMemo(() => [...activeEmps, ...terminatedEmps], [activeEmps, terminatedEmps]);
  const employers = useMemo(() => [...new Set(all.map((e) => e.employer).filter(Boolean))], [all]);
  const depts = useMemo(() => [...new Set(all.map((e) => e.dept || e.department).filter(Boolean))], [all]);
  const pool = useMemo(() => [...activeEmps, ...(inclTerm ? terminatedEmps : [])].filter((e) => (!fEmployer || e.employer === fEmployer) && (!fDept || (e.dept || e.department) === fDept)).sort(empNoSort), [activeEmps, terminatedEmps, inclTerm, fEmployer, fDept]);
  const emps = mode === 'all' ? pool : pool.filter((e) => sel[e.id]);
  const byKey = useMemo(() => Object.fromEntries(CATALOG.map((c) => [c.k, c])), []);
  const cols = fields.map((k) => byKey[k]).filter(Boolean);
  const toggle = (k) => setFields((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));
  const move = (i, d) => setFields((f) => { const n = [...f], j = i + d; if (j < 0 || j >= n.length) return f; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const grpAll = (g, on) => setFields((f) => { const ks = CATALOG.filter((c) => c.grp === g).map((c) => c.k); return on ? [...f, ...ks.filter((k) => !f.includes(k))] : f.filter((k) => !ks.includes(k)); });
  const saveTpl = () => { const n = tname.trim(); if (!n || !fields.length) return; const nx = [...tpls.filter((t) => t.n !== n), { n, f: fields }]; setTpls(nx); setTname(''); try { localStorage.setItem(LS, JSON.stringify(nx)); } catch { /* ignore */ } };
  const delTpl = (n) => { const nx = tpls.filter((t) => t.n !== n); setTpls(nx); try { localStorage.setItem(LS, JSON.stringify(nx)); } catch { /* ignore */ } };
  const rows = emps.map((e) => cols.map((c) => { const v = c.get(e, all); return v == null ? '' : v; }));
  const spec = { title: T('تقرير مخصص عن الموظفين', 'Custom employee report'), sub: new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn') + ' — ' + emps.length + T(' موظف', ' employees'), headers: cols.map((c) => (en ? c.en : c.ar)), rows, name: 'custom_report' };
  const list = pool.filter((e) => !q || String(e.nameAr || '').includes(q) || String(e.nameEn || '').toLowerCase().includes(q.toLowerCase()) || String(e.empNo || e.id).includes(q));
  const ok = cols.length > 0 && emps.length > 0;
  const St = ({ n, t, sub, right }) => <div className="cr-st"><span className="cr-n">{n}</span><div style={{ flex: 1 }}><div className="cr-t">{t}</div>{sub && <div className="cr-s">{sub}</div>}</div>{right}</div>;
  return (
    <div className="card" id="CR_BOX" style={{ marginBottom: 14 }}>
      <div className="ch"><div className="ct"><i className="ti ti-adjustments-horizontal" /> <span>{T('منشئ التقارير المخصص', 'Custom report builder')}</span></div>
        <span style={{ fontSize: 11, color: 'var(--mu)' }}>{T('اختر الأعمدة والموظفين ثم صدّر PDF أو Excel أو Word أو أرسله بالإيميل', 'Pick columns & employees, then export or email')}</span></div>
      <div className="cr-wrap">
        <div className="cr-side">
          <div className="cr-sec">
            <St n="1" t={T('اختر الأعمدة', 'Choose columns')} sub={T('ابدأ بقالب جاهز أو اختر بنفسك', 'Start from a preset or pick your own')}
              right={<><span className="b bb">{cols.length}</span><button type="button" className="btn bsm" onClick={() => setFields(CATALOG.map((c) => c.k))}>{T('الكل', 'All')}</button><button type="button" className="btn bsm" onClick={() => setFields([])}>{T('مسح', 'None')}</button></>} />
            <div className="cr-pre">{PRESETS.map(([a, b, ic, ks]) => <button type="button" key={a} className="cr-pbtn" onClick={() => setFields(ks)}><i className={'ti ' + ic} /> {en ? b : a}</button>)}
              {tpls.map((t) => <span key={t.n} className="cr-pbtn cr-tpl"><button type="button" onClick={() => setFields(t.f)}><i className="ti ti-bookmark" /> {t.n}</button><button type="button" title={T('حذف القالب', 'Delete')} onClick={() => delTpl(t.n)}>×</button></span>)}</div>
            <div className="cr-groups">
              {GROUPS.map((g) => { const items = CATALOG.filter((c) => c.grp === g), n = items.filter((c) => fields.includes(c.k)).length; return (
                <div key={g} className="cr-g"><div className="cr-gh"><i className={'ti ' + GICO[g]} /> <b>{en ? GEN[g] : g}</b><span className="cr-gc">{n}/{items.length}</span>
                  <button type="button" className="cr-gl" onClick={() => grpAll(g, n < items.length)}>{n < items.length ? T('تحديد الكل', 'All') : T('إلغاء', 'None')}</button></div>
                  <div className="cr-chips">{items.map((c) => <label key={c.k} className={'cr-chip' + (fields.includes(c.k) ? ' on' : '')}><input type="checkbox" data-cr={c.k} checked={fields.includes(c.k)} onChange={() => toggle(c.k)} />{en ? c.en : c.ar}</label>)}</div></div>); })}
            </div>
            {cols.length > 0 && <div className="cr-order"><div className="cr-ot">{T('ترتيب الأعمدة في التقرير', 'Column order')}</div>
              <div className="cr-ol">{cols.map((c, i) => <span key={c.k} className="cr-oi"><button type="button" disabled={i === 0} onClick={() => move(i, -1)} title={T('تقديم', 'Earlier')}>›</button><b>{i + 1}.</b> {en ? c.en : c.ar}<button type="button" disabled={i === cols.length - 1} onClick={() => move(i, 1)} title={T('تأخير', 'Later')}>‹</button></span>)}</div></div>}
            <div className="cr-save"><input placeholder={T('احفظ هذه الأعمدة كقالب باسم…', 'Save as template…')} value={tname} onChange={(e) => setTname(e.target.value)} /><button type="button" className="btn bsm" disabled={!tname.trim() || !fields.length} onClick={saveTpl}><i className="ti ti-device-floppy" /> {T('حفظ', 'Save')}</button></div>
          </div>
          <div className="cr-sec">
            <St n="2" t={T('اختر الموظفين', 'Choose employees')} sub={T('الكل أو تصفية بجهة العمل/القسم أو اختيار يدوي', 'All, filtered, or hand-picked')} />
            <div className="cr-row">
              {[['all', T('كل الموظفين', 'All employees')], ['pick', T('موظف / موظفون محددون', 'Selected employees')]].map(([k, l]) => <label key={k} className={'cr-radio' + (mode === k ? ' on' : '')}><input type="radio" name="crm" checked={mode === k} onChange={() => setMode(k)} /> {l}</label>)}
              <label className={'cr-radio' + (inclTerm ? ' on' : '')}><input type="checkbox" checked={inclTerm} onChange={(e) => setInclTerm(e.target.checked)} /> {T('مع المنتهية خدمتهم', 'Include terminated')}</label>
            </div>
            <div className="cr-row">
              <select value={fEmployer} onChange={(e) => setFEmployer(e.target.value)}><option value="">{T('كل جهات العمل', 'All employers')}</option>{employers.map((x) => <option key={x}>{x}</option>)}</select>
              <select value={fDept} onChange={(e) => setFDept(e.target.value)}><option value="">{T('كل الأقسام', 'All departments')}</option>{depts.map((x) => <option key={x}>{x}</option>)}</select>
            </div>
            {mode === 'pick' && <div style={{ marginTop: 8 }}>
              <div className="cr-row"><input placeholder={T('ابحث بالاسم أو الرقم…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
                <button type="button" className="btn bsm" onClick={() => setSel((s) => { const n = { ...s }; list.forEach((e) => { n[e.id] = true; }); return n; })}>{T('تحديد الظاهر', 'Select shown')}</button><button type="button" className="btn bsm" onClick={() => setSel({})}>{T('مسح', 'Clear')}</button></div>
              <div className="cr-emps">{list.map((e) => <label key={e.id}><input type="checkbox" checked={!!sel[e.id]} onChange={() => setSel((s) => ({ ...s, [e.id]: !s[e.id] }))} /> {e.nameAr} <span>#{e.empNo || e.id}</span></label>)}</div>
            </div>}
          </div>
        </div>
        <div className="cr-main">
          <div className="cr-bar">
            <div><b>{T('المعاينة', 'Preview')}</b><span className="cr-cnt">{emps.length} {T('موظف', 'employees')} × {cols.length} {T('عمود', 'columns')}</span></div>
            <button className="btn bpl" id="CR_EXPORT" disabled={!ok} onClick={() => setDlg(true)}><i className="ti ti-file-export" /> {T('تصدير / إرسال (PDF · Excel · Word)', 'Export / Email (PDF · Excel · Word)')}</button>
          </div>
          {ok ? <div className="cr-tw"><table id="CR_PREVIEW"><thead><tr><th>#</th>{spec.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 30).map((r, i) => <tr key={i}><td className="cr-i">{i + 1}</td>{r.map((c, j) => <td key={j}>{String(c)}</td>)}</tr>)}</tbody></table>
            {rows.length > 30 && <div className="cr-more">{T('المعاينة أول 30 صفاً — الملف المُصدَّر يحوي الكل', 'Preview shows 30 rows — the file has all')}</div>}</div>
            : <div className="cr-empty"><i className="ti ti-table-options" /><div>{cols.length ? T('لا يوجد موظفون مطابقون', 'No matching employees') : T('اختر عموداً واحداً على الأقل لتظهر المعاينة', 'Pick at least one column to see the preview')}</div></div>}
        </div>
      </div>
      <ExportDialog open={dlg} onClose={() => setDlg(false)} spec={spec} forEmps={emps} />
    </div>
  );
}
