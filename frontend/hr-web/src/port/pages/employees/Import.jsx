import { useMemo, useRef, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import { toast } from '../../components/Toast.jsx';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { readFile, FIELDS, autoMap, conv, nn, toForm, templateHead } from '../../lib/importXlsx.js';
import { emptyForm, formFromEmployee, buildEmployee, syncEmployee } from '../../lib/employees.js';
import { saveXlsx } from '../../lib/finance.js';
import { log } from '../../lib/audit.js';

/** استيراد الموظفين من Excel/CSV: اختيار الملف ← مطابقة الأعمدة ← معاينة وفحص ← تنفيذ */
export default function Import({ open, onClose }) {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a); const { employees, reload } = useApp();
  const [S, setS] = useState({ sheets: [], sheet: 0, map: [], file: '' }), [upd, setUpd] = useState(false), [busy, setBusy] = useState(false), [prog, setProg] = useState('');
  const fileRef = useRef();
  const sh = S.sheets[S.sheet], header = sh ? (sh.rows[0] || []) : [], body = sh ? sh.rows.slice(1) : [];
  async function pick(f) {
    if (!f) return;
    try { const sheets = await readFile(f); const best = sheets.reduce((a, s, i) => (s.rows.length > (sheets[a] ? sheets[a].rows.length : 0) ? i : a), 0); setS({ sheets, sheet: best, map: autoMap(sheets[best].rows[0] || []), file: f.name }); }
    catch (e) { toast(T('تعذر قراءة الملف: ', 'Could not read the file: ') + (e.message || e), 'ter'); }
  }
  const rows = useMemo(() => {
    if (!sh) return [];
    const byNo = {}, byIq = {}, byMail = {}; employees.forEach((e) => { if (e.empNo != null && e.empNo !== '') byNo[nn(e.empNo)] = e; if (e.id != null) byNo[nn(e.id)] = byNo[nn(e.id)] || e; if (e.iqamaNo) byIq[nn(e.iqamaNo)] = e; if (e.email) byMail[nn(e.email)] = e; });
    const seenNo = {}, seenIq = {};
    return body.map((row, ri) => {
      const r = {}, issues = [], warns = [];
      S.map.forEach((k, ci) => { if (!k) return; const raw = row[ci]; if (raw == null || String(raw).trim() === '') return; const v = conv(k, raw); if (v === '' && (/date|dob|Expiry|Join/i.test(k) || k === 'insSystem' || k === 'wpsType')) warns.push(T('قيمة غير مفهومة في "' + (FIELDS.find((f) => f.k === k) || {}).ar + '" (' + String(raw).slice(0, 20) + ')', 'Unrecognised value in "' + k + '"')); if (v !== '') r[k] = v; });
      if (!r.nameAr && !r.nameEn) issues.push(T('الاسم ناقص', 'Name is missing'));
      if (r.iqamaNo && !/^\d{10}$/.test(r.iqamaNo)) warns.push(T('رقم الهوية/الإقامة مش 10 أرقام', 'ID/Iqama is not 10 digits'));
      if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) warns.push(T('البريد غير صحيح', 'Invalid email'));
      if (r.salary === undefined) warns.push(T('الراتب الأساسي ناقص', 'Basic salary missing')); else if (r.salary <= 0) warns.push(T('الراتب الأساسي صفر', 'Basic salary is zero'));
      if (!r.nationality) warns.push(T('الجنسية ناقصة', 'Nationality missing')); if (!r.contractJoin) warns.push(T('تاريخ المباشرة ناقص', 'Joining date missing'));
      const ke = r.empNo ? nn(r.empNo) : '', ki = r.iqamaNo ? nn(r.iqamaNo) : '';
      if ((ke && seenNo[ke]) || (ki && seenIq[ki])) issues.push(T('مكرر جوه الملف (نفس الرقم الوظيفي أو الهوية)', 'Duplicate inside the file'));
      if (ke) seenNo[ke] = 1; if (ki) seenIq[ki] = 1;
      const ex = (ke && byNo[ke]) || (ki && byIq[ki]) || (r.email && byMail[nn(r.email)]) || null;
      const action = issues.length ? 'error' : ex ? (upd ? 'update' : 'skip') : 'new';
      return { row: ri + 2, r, issues, warns, action, ex };
    });
  }, [S, upd, employees, sh]); // eslint-disable-line
  const cnt = (a) => rows.filter((x) => x.action === a).length;
  async function run() {
    const todo = rows.filter((x) => x.action === 'new' || x.action === 'update'); if (!todo.length) return toast(T('مفيش حاجة تتضاف أو تتحدّث', 'Nothing to add or update'), 'ter');
    setBusy(true); let added = 0, updated = 0, bad = 0, i = 0; const all = employees.slice(); const errs = [];
    for (const x of todo) {
      i++; setProg(i + ' / ' + todo.length);
      try {
        let f = toForm(x.r, emptyForm), existing = null;
        if (x.action === 'update' && x.ex) { // يكمّل الحقول غير المذكورة في الملف من الموظف الحالي
          existing = x.ex; const base = formFromEmployee(existing); f = { ...base, ...Object.fromEntries(Object.entries(toForm(x.r, emptyForm)).filter(([k]) => ({ na: 'nameAr', ne: 'nameEn', em: 'employer', nat: 'nationality', dep: 'dept', jt: 'jobTitle', dob: 'dob', mb: 'mobile', ml: 'email', bk: 'bank', ib: 'iban', sp: 'sponsor', rel: 'religion', iq: 'iqamaNo', iqe: 'iqamaExpiry', pn: 'passportNo', ppe: 'passportExpiry', cj: 'contractJoin', dur: 'contractDuration', ldc: 'leaveDaysContract', sal: 'salary', hou: 'housingAllowance', tra: 'transportAllowance', prj: 'projectAllowance', oth: 'otherAllowance', ded: 'otherDeductions', extra: 'extraAllowance', currency: 'currency', exchRate: 'exchRate', insSystem: 'insSystem', wpsType: 'wpsType', empNo: 'empNo', contractNature: 'contractNature' }[k] in x.r))) };
        }
        const res = buildEmployee(f, existing, all); if (res.error) { bad++; errs.push('#' + x.row + ': ' + res.error); continue; }
        await syncEmployee(res.emp); if (existing) { updated++; const j = all.findIndex((z) => z.id === existing.id); if (j >= 0) all[j] = res.emp; } else { added++; all.push(res.emp); }
      } catch (e) { bad++; errs.push('#' + x.row + ': ' + (e.message || e)); }
    }
    log('employees', 'استيراد موظفين من Excel', { summary: 'استيراد ملف "' + S.file + '": إضافة ' + added + ' وتحديث ' + updated + ' ورفض ' + (bad + cnt('error')), details: { file: S.file, added, updated, rejected: bad } });
    await reload({ silent: true }); setBusy(false); setProg('');
    toast('✓ ' + T('اتضاف ' + added + ' موظف' + (updated ? ' واتحدّث ' + updated : '') + (bad ? ' — ' + bad + ' مرفوض: ' + errs[0] : ''), 'Added ' + added + (updated ? ', updated ' + updated : '') + (bad ? ', rejected ' + bad : '')), bad ? 'ter' : 'tin');
    if (!bad) { setS({ sheets: [], sheet: 0, map: [], file: '' }); onClose(); }
  }
  function tpl() { saveXlsx('employees_import_template.xlsx', [{ name: 'Employees', rows: [templateHead()], widths: templateHead().map(() => 20) }]); }
  const AC = { new: ['جديد', 'New', 'bg'], update: ['تحديث', 'Update', 'ba'], skip: ['موجود — تخطي', 'Exists — skip', 'bk'], error: ['مرفوض', 'Rejected', 'br'] };
  return (
    <Modal open={open} onClose={onClose} title={T('📥 استيراد موظفين من Excel / CSV', '📥 Import employees from Excel / CSV')} width={1100}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <input ref={fileRef} id="EI_FILE" type="file" accept=".xlsx,.csv,.txt" onChange={(x) => pick(x.target.files[0])} />
        <button className="btn bsm" onClick={tpl}><i className="ti ti-download" /> {T('تنزيل قالب', 'Download template')}</button>
        {S.sheets.length > 1 && <select value={S.sheet} onChange={(x) => { const i = +x.target.value; setS({ ...S, sheet: i, map: autoMap(S.sheets[i].rows[0] || []) }); }}>{S.sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}</select>}
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={upd} onChange={(x) => setUpd(x.target.checked)} /> {T('تحديث الموظفين الموجودين (بدل التخطي)', 'Update existing employees (instead of skipping)')}</label>
      </div>
      {sh && <>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{T('مطابقة الأعمدة', 'Column mapping')} — {S.file}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 6, marginBottom: 10 }}>
          {header.map((h, ci) => <div key={ci} style={{ fontSize: 11 }}><div style={{ color: 'var(--mu)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(h)}</div>
            <select value={S.map[ci] || ''} onChange={(x) => setS({ ...S, map: S.map.map((m, j) => (j === ci ? x.target.value : m)) })} style={{ width: '100%' }}><option value="">{T('— تجاهل —', '— ignore —')}</option>{FIELDS.map((f) => <option key={f.k} value={f.k}>{f.ar}</option>)}</select></div>)}
        </div>
        <div id="EI_SUM" style={{ display: 'flex', gap: 14, fontSize: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          {Object.keys(AC).map((a) => <span key={a}><span className={'b ' + AC[a][2]}>{AC[a][en ? 1 : 0]}</span> {cnt(a)}</span>)}
        </div>
        <div className="tw" style={{ maxHeight: 280, overflow: 'auto' }}><table><thead><tr><th>#</th><th>{T('الاسم', 'Name')}</th><th>{T('الرقم', 'No.')}</th><th>{T('الهوية', 'ID')}</th><th>{T('الراتب', 'Salary')}</th><th>{T('الإجراء', 'Action')}</th><th>{T('ملاحظات', 'Notes')}</th></tr></thead>
          <tbody>{rows.slice(0, 300).map((x) => <tr key={x.row}><td>{x.row}</td><td>{x.r.nameAr || x.r.nameEn || '—'}</td><td>{x.r.empNo || '—'}</td><td>{x.r.iqamaNo || '—'}</td><td>{x.r.salary ?? '—'}</td><td><span className={'b ' + AC[x.action][2]}>{AC[x.action][en ? 1 : 0]}</span></td><td style={{ fontSize: 10.5, color: x.issues.length ? 'var(--rd)' : 'var(--am)' }}>{[...x.issues, ...x.warns].join('، ')}</td></tr>)}</tbody></table></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}><button className="btn bpl" id="EI_RUN" disabled={busy} onClick={run}>{busy ? T('جاري الاستيراد… ', 'Importing… ') + prog : T('استيراد ', 'Import ') + (cnt('new') + (upd ? cnt('update') : 0))}</button><button className="btn" onClick={onClose}>{T('إغلاق', 'Close')}</button></div>
      </>}
    </Modal>
  );
}
