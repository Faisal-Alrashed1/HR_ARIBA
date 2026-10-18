import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import { rpc } from '../../lib/api.js';
import { printOfficial, esc } from '../../lib/finance.js';
import { loadTr } from '../../lib/tr.js';
import { buildEn } from './formsEn.js';
import { FORMS } from './docs.js';
import { scHtml, missing, dataFromEmp, num, money, nextRef, consumeRef, placeOf, savePlace, salaryOf, acctFromIban } from './salaryCert.js';
import { todayInfo } from '../../lib/hrSig.js';
import { mailDoc } from '../../lib/mailDoc.js';

const b64 = (s) => { try { return btoa(unescape(encodeURIComponent(s))); } catch { return btoa(s); } };
const BULK_FORMS = { onboarding: ['مباشرة عمل', 'Onboarding notice'], custody: ['استلام عهدة تقنية', 'IT custody receipt'], extension: ['إشعار تمديد فترة التجربة', 'Probation extension'], termination: ['إشعار إنهاء فترة التجربة', 'Probation termination'], clearance: ['إخلاء طرف', 'Final clearance'], experience: ['شهادة خبرة', 'Experience certificate'], contract_end: ['إشعار انتهاء عقد العمل', 'Contract termination notice'], salary_cert: ['تعريف بالراتب', 'Salary certificate'] };
const PER_EMP_JOIN = ['onboarding', 'extension', 'termination', 'evaluation', 'contract_end'];
const S = 'padding:6px;border:1px solid var(--bd);border-radius:6px;background:var(--c2);color:var(--tx);font-size:12px;width:100%;box-sizing:border-box';
const STY = { padding: 6, border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--c2)', color: 'var(--tx)', fontSize: 12, width: '100%', boxSizing: 'border-box' };
void S;

/** إرسال نموذج لعدة موظفين دفعة واحدة (V117/A117) */
export function BulkCard({ ctx, mkFor, st, withEn, refresh }) {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a);
  const { employees, settings } = ctx;
  const [form, setForm] = useState('onboarding'), [q, setQ] = useState(''), [dep, setDep] = useState(''), [sel, setSel] = useState({}), [stat, setStat] = useState(null), [busy, setBusy] = useState(false);
  const emps = useMemo(() => employees.filter((x) => !x.isTerminated), [employees]);
  const depts = useMemo(() => [...new Set(emps.map((x) => x.dept || x.department).filter(Boolean))], [emps]);
  const nm = (x) => (en ? (x.nameEn || x.nameAr || x.id) : (x.nameAr || x.nameEn || x.id));
  const list = emps.filter((x) => (!dep || (x.dept || x.department) === dep) && (!q.trim() || (String(x.nameAr || '') + ' ' + String(x.nameEn || '') + ' ' + String(x.empNo || '')).toLowerCase().indexOf(q.trim().toLowerCase()) >= 0));
  const cnt = Object.keys(sel).filter((k) => sel[k]).length;
  async function go() {
    const ids = Object.keys(sel).filter((k) => sel[k]);
    if (!ids.length) { toast(T('اختر موظفًا واحدًا على الأقل', 'Select at least one employee'), 'ter'); return; }
    const F = BULK_FORMS[form];
    if (!window.confirm(en ? 'Send "' + F[1] + '" to ' + ids.length + ' employees at once?' : 'هيتبعت "' + F[0] + '" لـ ' + ids.length + ' موظف دفعة واحدة. متأكد؟')) return;
    setBusy(true); let ok = 0; const fail = []; const tr = await loadTr();
    const scEl = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    for (let i = 0; i < ids.length; i++) {
      const e2 = emps.find((x) => String(x.id) === String(ids[i])); if (!e2) continue;
      setStat({ prog: (i + 1) + ' / ' + ids.length + ' — ' + nm(e2) });
      try {
        let title, html, type = form;
        if (form === 'salary_cert') {
          const dd = dataFromEmp(e2, tr, { to: scEl('SC_TO').trim(), toEn: scEl('SC_TO_EN').trim(), bankOn: !!(document.getElementById('SC_BANK_ON') || {}).checked, seal: !!(document.getElementById('SC_SEAL') || { checked: true }).checked });
          const m = missing('ar', dd); if (m.length) throw new Error(T('بيانات ناقصة: ', 'Incomplete: ') + m.map((x) => x.label).join('، '));
          const r = scHtml('ar', dd, { settings, employees, tr }); title = r.title; html = r.html;
          const m2 = missing('en', dd); if (!m2.length) html += '<!--ARIBA_EN-->' + scHtml('en', dd, { settings, employees, tr }).html;
        } else {
          const stk = { ...(st[form] || {}) }; if (PER_EMP_JOIN.includes(form)) stk.join = '';
          const r = mkFor(form, e2, stk); if (r.err) throw new Error(r.err);
          title = r.title; html = await withEn(form, e2, stk, r.html);
        }
        await rpc('ariba_hr_send_template', { p_employee_id: String(e2.id), p_emp_no: String(e2.empNo || e2.id), p_template_type: type, p_title: title, p_file_name: type + '_' + e2.id + '.html', p_mime_type: 'text/html', p_base64: b64(html) });
        if (form === 'salary_cert') consumeRef();
        ok++;
      } catch (err) { fail.push(nm(e2) + ': ' + (err.message || err)); if (form !== 'salary_cert' && /inputs|incomplete|ناقصة|اكتب|حدد|اختر|أضف|enter|set/i.test(String(err.message || ''))) break; }
    }
    setBusy(false); setStat({ ok, fail }); try { refresh(); } catch { /* ignore */ }
  }
  return (
    <div className="card" id="A117Bulk" style={{ padding: 12, marginBottom: 12 }}>
      <div className="ct" style={{ marginBottom: 8 }}><i className="ti ti-users-group" /> {T('إرسال نموذج لعدة موظفين دفعة واحدة', 'Send a form to several employees at once')}</div>
      <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 8 }}>{T('املأ بيانات النموذج المطلوب في كارته بالأسفل (التواريخ مثلًا)، ثم اختر الموظفين هنا. بيانات كل موظف (الاسم، الراتب، تاريخ المباشرة…) بتتاخد من ملفه تلقائيًا.', "Fill the form fields in its card below (e.g. dates), then pick employees here. Each employee's own data (name, salary, join date…) is taken from his record.")}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <select id="A117BForm" style={{ minWidth: 220 }} value={form} onChange={(x) => setForm(x.target.value)}>{Object.keys(BULK_FORMS).map((k) => <option key={k} value={k}>{BULK_FORMS[k][en ? 1 : 0]}</option>)}</select>
        <input id="A117BQ" placeholder={T('بحث', 'Search')} value={q} onChange={(x) => setQ(x.target.value)} />
        <select id="A117BDep" value={dep} onChange={(x) => setDep(x.target.value)}><option value="">{T('كل الأقسام', 'All departments')}</option>{depts.map((d) => <option key={d}>{d}</option>)}</select>
        <button type="button" className="btn bgr bsm" id="A117BAll" onClick={() => setSel((o) => { const n = { ...o }; list.forEach((x) => { n[x.id] = true; }); return n; })}>{T('تحديد الظاهر', 'Select shown')}</button>
        <button type="button" className="btn bgr bsm" id="A117BNone" onClick={() => setSel({})}>{T('إلغاء الكل', 'Clear')}</button>
        <span id="A117BCnt" style={{ alignSelf: 'center', fontWeight: 700 }}>{cnt} {T('موظف محدد', 'selected')}</span>
      </div>
      <div id="A117BList" style={{ maxHeight: 170, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '2px 10px', border: '1px solid var(--bd)', borderRadius: 8, padding: 6 }}>
        {list.map((x) => <label key={x.id} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12 }}><input type="checkbox" checked={!!sel[x.id]} onChange={(c) => setSel((o) => ({ ...o, [x.id]: c.target.checked }))} /> {nm(x)}</label>)}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button type="button" className="btn bpl bsm" id="A117BGo" disabled={busy} onClick={go}><i className="ti ti-send" /> {T('إرسال للمحدّدين', 'Send to selected')}</button>
        <span id="A117BStat" style={{ fontSize: 12 }}>{stat && stat.prog}{stat && stat.ok !== undefined && <><b style={{ color: 'var(--gr)' }}>{T('تم الإرسال: ', 'Sent: ')}{stat.ok}</b>{stat.fail.length > 0 && <> — <b style={{ color: 'var(--rd)' }}>{T('فشل: ', 'Failed: ')}{stat.fail.length}</b><br /><span style={{ fontSize: 11 }}>{stat.fail.join(' | ')}</span></>}</>}</span>
      </div>
    </div>
  );
}

const Fl = ({ l, star, children }) => <div style={{ marginBottom: 5 }}><label style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 600, display: 'block', marginBottom: 2 }}>{l}{star && <> <span style={{ color: '#dc2626' }}>*</span></>}</label>{children}</div>;
const EMPTY = { to: '', toEn: '', ref: '', lang: 'auto', name: '', nameEn: '', empNo: '', join: '', nat: '', natEn: '', job: '', jobEn: '', id: '', place: '', placeEn: '', basic: '', hous: '', tran: '', oth: '', bankOn: false, bank: '', iban: '', acct: '', seal: true };
/** خطاب تعريف راتب (V117) */
export function SalaryCertCard({ ctx, eid }) {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a);
  const { employees, settings } = ctx;
  const [f, setF] = useState(() => ({ ...EMPTY, ref: nextRef() })); const [flag, setFlag] = useState(false), [busy, setBusy] = useState(false), [tick, setTick] = useState(0);
  const e = employees.find((x) => String(x.id) === String(eid));
  const set = (k) => (x) => { const v = x.target.type === 'checkbox' ? x.target.checked : x.target.value; setF((o) => ({ ...o, [k]: v })); };
  useEffect(() => {
    let live = true;
    (async () => {
      if (!e) { setF((o) => ({ ...EMPTY, to: o.to, toEn: o.toEn, lang: o.lang, bankOn: o.bankOn, seal: o.seal, ref: nextRef() })); setFlag(false); return; }
      const tr = await loadTr(); if (!live) return;
      const tEn = (x) => { if (!x) return ''; const r = tr(x); return /[؀-ۿ]/.test(r) ? '' : r; };
      const sal = salaryOf(e), pl = placeOf(e), p = (v) => (v == null ? '' : String(v));
      setF((o) => ({ ...o, ref: nextRef(), name: e.nameAr || '', nameEn: e.nameEn || tEn(e.nameAr), empNo: p(e.empNo), join: String(e.contractJoin || e.join || e.joinDate || '').slice(0, 10), nat: e.nationality || e.nat || '', natEn: tEn(e.nationality || e.nat || ''), job: e.jobTitle || e.job || '', jobEn: tEn(e.jobTitle || e.job || ''), id: String(e.iqamaNo || e.iqama || ''), place: pl, placeEn: tEn(pl), basic: p(sal.basic || ''), hous: p(sal.housing || ''), tran: p(sal.transport || ''), oth: p(sal.other || ''), bank: e.bank || '', iban: e.iban || '', acct: acctFromIban(e.iban) }));
      setFlag(true);
    })();
    return () => { live = false; };
  }, [eid, employees]); // eslint-disable-line
  const total = num(f.basic) + num(f.hous) + num(f.tran) + num(f.oth);
  const lang = f.lang === 'ar' ? 'ar' : f.lang === 'en' ? 'en' : (en ? 'en' : 'ar');
  const mk = async (lg) => {
    const tr = await loadTr(); const tEn = (x) => { if (!x) return ''; const r = tr(x); return /[؀-ۿ]/.test(r) ? '' : r; };
    const d = { e, nameAr: f.name.trim(), nameEn: f.nameEn.trim() || tEn(f.name.trim()), empNo: f.empNo.trim(), join: f.join, natAr: f.nat.trim(), natEn: f.natEn.trim() || tEn(f.nat.trim()), jobAr: f.job.trim(), jobEn: f.jobEn.trim() || tEn(f.job.trim()), id: f.id.trim(), placeAr: f.place.trim(), placeEn: f.placeEn.trim() || tEn(f.place.trim()), basic: num(f.basic), housing: num(f.hous), transport: num(f.tran), other: num(f.oth), iban: f.iban.trim(), bank: f.bank.trim(), acct: f.acct.trim(), ref: f.ref.trim() || nextRef(), bankOn: f.bankOn, toAr: f.to.trim(), toEn: f.toEn.trim() || f.to.trim(), seal: f.seal };
    d.total = d.basic + d.housing + d.transport + d.other;
    return { d, m: missing(lg, d), tr };
  };
  const badIds = useMemo(() => { if (!flag) return new Set(); const tEnSync = () => ''; void tEnSync; const d = { toAr: f.to.trim(), nameAr: f.name.trim(), nameEn: f.nameEn.trim(), empNo: f.empNo.trim(), join: f.join, natAr: f.nat.trim(), natEn: f.natEn.trim(), jobAr: f.job.trim(), jobEn: f.jobEn.trim(), id: f.id.trim(), placeAr: f.place.trim(), placeEn: f.placeEn.trim(), total, bankOn: f.bankOn, iban: f.iban.trim() }; return new Set(missing(lang, d).map((x) => x.id)); }, [f, flag, lang, total]); // eslint-disable-line
  const bs = (id) => (badIds.has(id) ? { borderColor: '#dc2626' } : null);
  async function print() {
    if (!e) { toast(T('اختر الموظف أولاً', 'Select the employee first'), 'ter'); return; }
    const { d, m, tr } = await mk(lang); setFlag(true);
    if (m.length) { toast((lang === 'en' ? 'Missing / incomplete: ' : 'بيانات ناقصة: ') + m.map((x) => x.label).join('، '), 'ter'); setTick(tick + 1); return; }
    const r = scHtml(lang, d, { settings, employees, tr }); printOfficial(settings, r.title + ' — ' + (e.nameAr || ''), r.html, { dir: lang === 'en' ? 'ltr' : 'rtl', lang }); consumeRef(); setF((o) => ({ ...o, ref: nextRef() }));
  }
  async function send() {
    if (!e) { toast(T('اختر الموظف أولاً', 'Select the employee first'), 'ter'); return; }
    const { d, m, tr } = await mk('ar'); setFlag(true);
    if (m.length) { toast('بيانات ناقصة: ' + m.map((x) => x.label).join('، '), 'ter'); return; }
    const r = scHtml('ar', d, { settings, employees, tr });
    if (!window.confirm(T('هيتبعت "' + r.title + '" (رقم ' + r.ref + ') لـ ' + (e.nameAr || '') + ' في تطبيقه. متأكد؟', 'Send "' + r.title + '" (ref ' + r.ref + ') to ' + (e.nameEn || e.nameAr || '') + '?'))) return;
    setBusy(true);
    try {
      let html = r.html; const m2 = missing('en', d);
      if (!m2.length) html += '<!--ARIBA_EN-->' + scHtml('en', d, { settings, employees, tr }).html; else toast(T('النسخة الإنجليزية ما اتبعتتش لأن بيانات إنجليزية ناقصة (افتح "النسخة الإنجليزية" واملأها)', 'English copy not attached: English data is incomplete'), 'ter');
      await rpc('ariba_hr_send_template', { p_employee_id: String(e.id), p_emp_no: String(e.empNo || e.id), p_template_type: 'salary_cert', p_title: r.title, p_file_name: 'salary_cert_' + e.id + '.html', p_mime_type: 'text/html', p_base64: b64(html) });
      consumeRef(); setF((o) => ({ ...o, ref: nextRef() })); toast('✅ ' + T('اتبعت للموظف', 'Sent to the employee'), 'tin');
    } catch (err) { toast('⚠️ ' + (err.message || err), 'ter'); } finally { setBusy(false); }
  }
  async function emailSalary() {
    if (!e) { toast(T('اختر الموظف أولاً', 'Select the employee first'), 'ter'); return; }
    const { d, m, tr } = await mk(lang); setFlag(true);
    if (m.length) { toast((lang === 'en' ? 'Missing / incomplete: ' : 'بيانات ناقصة: ') + m.map((x) => x.label).join('، '), 'ter'); setTick(tick + 1); return; }
    const r = scHtml(lang, d, { settings, employees, tr });
    const sent = await mailDoc('salary_cert', e, { title: r.title + ' — ' + (e.nameAr || e.nameEn || ''), html: r.html });
    if (sent) { consumeRef(); setF((o) => ({ ...o, ref: nextRef() })); }
  }
  const t = todayInfo();
  const inp = (id, key, extra, type = 'text') => <input id={id} type={type} style={{ ...STY, ...extra, ...bs(id) }} value={f[key]} onChange={set(key)} />;
  const g2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 };
  const hd = { fontSize: 11, fontWeight: 700, margin: '6px 0 4px', color: 'var(--mu)' };
  void esc; void money; void savePlace;
  return (
    <div className="card" id="TF_SC_CARD" style={{ padding: 12 }}>
      <div className="ct" style={{ marginBottom: 8 }}><i className="ti ti-cash" /> {T('خطاب تعريف راتب', 'Salary certificate letter')}</div>
      <div id="SC_DATE_LINE" style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 6 }}>{T('تاريخ الإصدار (اليوم): ', 'Issue date (today): ')}{t.gd}/{t.gm}/{t.gy} — {t.hd}/{t.hm}/{t.hy}{T('هـ', ' AH')}</div>
      <Fl l={T('السادة / الجهة الموجّه إليها الخطاب', 'Addressed to (bank / company)')} star>{inp('SC_TO', 'to')}</Fl>
      <div style={g2}>
        <Fl l={T('رقم الصادر (تلقائي بتاريخ اليوم)', 'Reference no. (auto, today)')}>{inp('SC_REF', 'ref', { direction: 'ltr' })}</Fl>
        <Fl l={T('لغة الخطاب', 'Letter language')}><select id="SC_LANG" style={STY} value={f.lang} onChange={set('lang')}><option value="auto">{T('حسب لغة البرنامج', 'Same as program language')}</option><option value="ar">العربية</option><option value="en">English</option></select></Fl>
      </div>
      <div style={hd}>{T('بيانات الموظف (بتتعبّى من ملفه — الناقص بيتلوّن أحمر وتكتبه)', 'Employee data (auto-filled — missing items turn red)')}</div>
      <div style={g2}>
        <Fl l={T('الاسم', 'Name')} star>{inp('SC_NAME', 'name')}</Fl><Fl l={T('الرقم الوظيفي', 'Employee no.')} star>{inp('SC_EMPNO', 'empNo')}</Fl>
        <Fl l={T('تاريخ التعيين', 'Hire date')} star>{inp('SC_JOIN', 'join', null, 'date')}</Fl><Fl l={T('الجنسية', 'Nationality')} star>{inp('SC_NAT', 'nat')}</Fl>
        <Fl l={T('المسمى الوظيفي', 'Job title')} star>{inp('SC_JOB', 'job')}</Fl><Fl l={T('رقم الهوية / الإقامة', 'ID / Iqama no.')} star>{inp('SC_ID', 'id', { direction: 'ltr' })}</Fl>
        <Fl l={T('مكان الإصدار', 'Place of issue')} star><input id="SC_PLACE" style={{ ...STY, ...bs('SC_PLACE') }} value={f.place} onChange={set('place')} onBlur={(x) => { if (e) savePlace(e, x.target.value); if (!f.placeEn || /[؀-ۿ]/.test(f.placeEn)) loadTr().then((tr) => { const r = tr(x.target.value); setF((o) => ({ ...o, placeEn: /[؀-ۿ]/.test(r) ? '' : r })); }); }} /></Fl>
        <Fl l={T('الإجمالي (محسوب)', 'Total (calculated)')}><input id="SC_TOTAL" readOnly style={{ ...STY, fontWeight: 800, background: '#eef5f2' }} value={total ? money(total) : ''} /></Fl>
      </div>
      <div style={hd}>{T('الراتب (ر.س)', 'Salary (SAR)')}</div>
      <div style={g2}>
        <Fl l={T('الأساسي', 'Basic')} star>{inp('SC_BASIC', 'basic', null, 'number')}</Fl><Fl l={T('السكن', 'Housing')}>{inp('SC_HOUS', 'hous', null, 'number')}</Fl>
        <Fl l={T('المواصلات', 'Transportation')}>{inp('SC_TRAN', 'tran', null, 'number')}</Fl><Fl l={T('بدلات أخرى', 'Other allowances')}>{inp('SC_OTH', 'oth', null, 'number')}</Fl>
      </div>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, margin: '6px 0' }}><input type="checkbox" id="SC_BANK_ON" checked={f.bankOn} onChange={set('bankOn')} /> {T('إدراج بيانات الحساب البنكي (IBAN) في الخطاب', 'Include bank account details (IBAN) in the letter')}</label>
      <div id="SC_BANK_BOX" style={{ display: f.bankOn ? 'block' : 'none' }}>
        <Fl l={T('اسم البنك', 'Bank name')}>{inp('SC_BANK', 'bank')}</Fl>
        <div style={g2}><Fl l="IBAN"><input id="SC_IBAN" style={{ ...STY, direction: 'ltr', ...bs('SC_IBAN') }} value={f.iban} onChange={(x) => { const a = acctFromIban(x.target.value); setF((o) => ({ ...o, iban: x.target.value, ...(a ? { acct: a } : {}) })); }} /></Fl><Fl l={T('رقم الحساب', 'Account number')}>{inp('SC_ACCT', 'acct', { direction: 'ltr' })}</Fl></div>
      </div>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, margin: '2px 0 6px' }}><input type="checkbox" id="SC_SEAL" checked={f.seal} onChange={set('seal')} /> {T('إدراج التوقيع وختم الشركة (من الإعدادات)', 'Include signature and company stamp (from Settings)')}</label>
      <details style={{ marginBottom: 6 }} open={[...badIds].some((i) => /_EN$/.test(i)) || undefined}><summary style={{ cursor: 'pointer', fontSize: 11.5, fontWeight: 700 }}>{T('النسخة الإنجليزية (تلقائي — عدّل لو محتاج)', 'English version (auto — edit if needed)')}</summary>
        <Fl l="Addressed to">{inp('SC_TO_EN', 'toEn', { direction: 'ltr' })}</Fl>
        <div style={g2}><Fl l="Name">{inp('SC_NAME_EN', 'nameEn', { direction: 'ltr' })}</Fl><Fl l="Nationality">{inp('SC_NAT_EN', 'natEn', { direction: 'ltr' })}</Fl><Fl l="Job title">{inp('SC_JOB_EN', 'jobEn', { direction: 'ltr' })}</Fl><Fl l="Place of issue">{inp('SC_PLACE_EN', 'placeEn', { direction: 'ltr' })}</Fl></div>
      </details>
      <button className="btn bgr bsm" id="SC_PRINT" onClick={print}><i className="ti ti-printer" /> {T('طباعة خطاب تعريف الراتب', 'Print salary certificate')}</button>
      <button className="btn bsm" id="TF_SC_SEND" disabled={busy} style={{ background: '#0a5c9e', color: '#fff', marginTop: 6, width: '100%' }} onClick={send}><i className="ti ti-send" /> {T('إرسال للموظف', 'Send to employee')}</button>
      <button type="button" className="btn bsm" id="TF_SC_EMAIL" disabled={busy || !e} style={{ background: '#014D3D', color: '#fff', marginTop: 6, width: '100%' }} onClick={emailSalary}><i className="ti ti-mail" /> {T('إرسال تعريف الراتب بالبريد الإلكتروني (PDF)', 'Email salary certificate (PDF)')}</button>
    </div>
  );
}
void FORMS; void buildEn;
