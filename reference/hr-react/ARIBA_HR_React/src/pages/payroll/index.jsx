import { logPayEdit } from '../../lib/audit.js';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp, usePerm } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import PromptModal from '../../components/PromptModal.jsx';
import { rt } from '../../engines/runtime.js';
import { PAYX as X } from '../../engines/payx.js';
import { ctx as mctx, buildRows, recalc, updateField, baseRow, enrich, autoWork, sums, rowSig, PKEYS, num, iso, defaultInsDays } from '../../engines/payrollRows.js';
import { payrollDraft, payrollStatus, payrollSync, payrollPrepare, payrollReopen } from '../../lib/payroll.js';
import { buildCols, SUMCOL, money } from './cols.jsx';
import { payrollXlsx, payrollPrintHtml, MONTHS_AR } from './output.js';
import { printHtml } from '../../lib/print.js';
import { download } from '../../lib/util.js';
import PayArchive from './Archive.jsx';
import { logoOf, signerOf } from '../../lib/branding.js';

const TDS = { padding: '5px 7px', borderBottom: '1px solid rgba(36,48,68,.25)', textAlign: 'right', whiteSpace: 'nowrap', fontSize: 11, borderLeft: '1px solid rgba(36,48,68,.15)' };
const dtime = (ts) => { try { return new Date(ts).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

export default function Payroll() {
  const h = useLang() === 'en';
  const { employees, settings, rev } = useApp();
  const perm = usePerm();
  const now = new Date();
  const [y, setY] = useState(now.getFullYear()); const [mo, setMo] = useState(now.getMonth() + 1); const [daysSel, setDaysSel] = useState(0);
  const [rows, setRows] = useState([]); const [approved, setApproved] = useState(false); const [approvedAt, setApprovedAt] = useState(null);
  const [status, setStatus] = useState(null); const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(''); const [dlg, setDlg] = useState(null); const [busy, setBusy] = useState(false); const [saveState, setSaveState] = useState('');
  const eg = rt.country === 'EG';
  const m = useMemo(() => mctx(y, mo, daysSel), [y, mo, daysSel]);
  const pushed = useRef({}); const seen = useRef({}); const dirty = useRef(new Set()); const timer = useRef(null); const rowsRef = useRef([]);
  const empMap = useMemo(() => new Map(employees.map((e) => [String(e.id), e])), [employees]);
  const cols = useMemo(() => buildCols(eg), [eg]);
  rowsRef.current = rows;
  const canEdit = perm.edit('payroll');
  const role = (status && status.role) || '';
  const st = (status && status.status) || 'draft';
  const locked = approved;

  // ---------- تحميل المسير من السحابة ----------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([payrollDraft(y, mo), payrollStatus(y, mo).catch(() => null)]);
      setStatus(s);
      const cloud = (d && Array.isArray(d.rows)) ? d.rows : [];
      const approvedCloud = !!(d && d.approved) && cloud.length > 0;
      pushed.current = {}; seen.current = {}; dirty.current = new Set();
      if (approvedCloud) {
        const rs = cloud.map((c) => ({ ...(c.payload || {}), id: String((c.payload && c.payload.id != null) ? c.payload.id : c.employee_id) })).sort((a, b) => (a.idx || 0) - (b.idx || 0));
        setRows(rs); setApproved(true); setApprovedAt(d.approved_at ? new Date(d.approved_at).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn') : null);
        cloud.forEach((c) => { seen.current[String(c.employee_id)] = c.updated_at; });
      } else {
        const prev = {}; cloud.forEach((c) => { const p = c.payload || {}; prev[String(p.id != null ? p.id : c.employee_id)] = p; seen.current[String(c.employee_id)] = c.updated_at; });
        const rs = buildRows(employees, m, prev);
        rs.forEach((r) => { if (prev[String(r.id)]) pushed.current[String(r.id)] = rowSig(r); });
        setRows(rs); setApproved(false); setApprovedAt(null);
      }
    } catch (e) { toast('تعذر تحميل المسير: ' + (e.message || e), 'ter'); setRows([]); } finally { setLoading(false); }
  }, [y, mo, employees, m]); // eslint-disable-line
  const loadedKey = useRef('');
  useEffect(() => { const k = y + '-' + mo + '-' + daysSel + '-' + (employees.length ? 1 : 0); if (loadedKey.current !== k && employees.length) { loadedKey.current = k; load(); } }, [y, mo, daysSel, employees.length, load]);
  // عند تحديث بيانات الموظفين (مزامنة خلفية) أعد حساب الصفوف غير المعتمدة دون فقد التعديلات
  useEffect(() => { if (!approved && rowsRef.current.length) setRows((rs) => rs.map((r) => { const e = empMap.get(String(r.id)); if (e && e.employer && r.employer !== e.employer) r.employer = e.employer; return { ...recalc({ ...r }, e || {}, m) }; })); }, [rev]); // eslint-disable-line

  // ---------- الحفظ التلقائي (الصفوف المعدّلة فقط) ----------
  const flush = useCallback(async (all) => {
    if (approved || !canEdit) return;
    const cur = rowsRef.current; const send = cur.filter((r) => all || dirty.current.has(String(r.id)) && pushed.current[String(r.id)] !== rowSig(r));
    if (!send.length) return;
    setSaveState('…');
    try { await payrollSync(y, mo, false, null, send); send.forEach((r) => { pushed.current[String(r.id)] = rowSig(r); dirty.current.delete(String(r.id)); }); setSaveState('✓ محفوظ'); setTimeout(() => setSaveState(''), 2000); }
    catch (e) { const msg = String(e.message || e); setSaveState('⚠'); toast('تعذر حفظ المسير: ' + (/PAYROLL_APPROVED_LOCKED/.test(msg) ? 'المسير معتمد ومقفول' : /NOT_AUTHORIZED/.test(msg) ? 'لا تملك صلاحية التعديل' : msg), 'ter'); }
  }, [approved, canEdit, y, mo]);
  const schedule = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(() => flush(false), 700); }, [flush]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const api = useMemo(() => ({
    update: (id, field, val) => {
      setRows((rs) => rs.map((r) => { if (String(r.id) !== String(id)) return r; const nr = { ...r, manualEdits: { ...(r.manualEdits || {}) } }; const oldV = r[field]; updateField(nr, field, val, empMap.get(String(id)) || {}, m); try { logPayEdit(nr, field, oldV, nr[field], mo + '/' + y, val === 'auto'); } catch { /* ignore */ } dirty.current.add(String(id)); return nr; }));
      schedule();
    },
  }), [empMap, m, schedule]);
  const bulk = (fn) => { setRows((rs) => rs.map((r) => { const nr = { ...r, manualEdits: { ...(r.manualEdits || {}) } }; fn(nr); nr.edited = true; recalc(nr, empMap.get(String(nr.id)) || {}, m); dirty.current.add(String(nr.id)); return nr; })); schedule(); };

  // ---------- مزامنة تعديلات المستخدمين الآخرين (استطلاع دوري) ----------
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden || loading || busy) return;
      const ae = document.activeElement; if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName) && ae.closest('#payBody')) return;
      try {
        const d = await payrollDraft(y, mo); const cloud = (d && d.rows) || [];
        const apprCloud = !!d.approved && cloud.length > 0;
        if (apprCloud !== approved && (apprCloud || cloud.length)) { loadedKey.current = ''; load(); return; }
        if (approved) return;
        let changed = 0; const cur = rowsRef.current; const by = new Map(cur.map((r) => [String(r.id), r]));
        const next = cur.map((r) => ({ ...r }));
        cloud.forEach((c) => {
          const pl = c.payload || {}, id = String(pl.id != null ? pl.id : c.employee_id), i = next.findIndex((r) => String(r.id) === id); if (i < 0) return;
          if (seen.current[id] && seen.current[id] >= c.updated_at) return;
          const cs = rowSig(pl), ls = rowSig(by.get(id));
          seen.current[id] = c.updated_at;
          if (cs === ls) { pushed.current[id] = ls; return; }
          if (dirty.current.has(id) || (pushed.current[id] !== undefined && pushed.current[id] !== ls)) return; // تعديلنا المحلي غير المرسل يكسب
          PKEYS.forEach((k) => { if (pl[k] === undefined || pl[k] === null) delete next[i][k]; else next[i][k] = pl[k]; });
          next[i].edited = true; recalc(next[i], empMap.get(id) || {}, m); pushed.current[id] = rowSig(next[i]); changed++;
        });
        if (changed) { setRows(next); toast('🔄 اتحدّث ' + changed + ' صف في المسير من مستخدم تاني', 'tin'); }
        const s = await payrollStatus(y, mo).catch(() => null); if (s) setStatus(s);
      } catch { /* ignore */ }
    }, 6000);
    return () => clearInterval(t);
  }, [y, mo, approved, loading, busy, load, m, empMap]);

  // ---------- أزرار شريط الأدوات ----------
  const list = useMemo(() => (filter ? rows.filter((r) => r.employer === filter) : rows), [rows, filter]);
  const employers = useMemo(() => [...new Set(employees.filter((e) => !e.isTerminated && !e.isHourly).map((e) => e.employer).filter(Boolean))].sort(), [employees]);
  const haveIds = new Set(rows.map((r) => String(r.id)));
  const termAddable = employees.filter((e) => (e.isTerminated || e.term) && !haveIds.has(String(e.id)) && num(e.salary || e.sal) > 0);
  function addTerminated(id) {
    const e = empMap.get(String(id)); if (!e) return; const b = baseRow(e, m.days); b.addedTerminated = true; enrich(b, e, null); b.edited = true;
    if (b.reason && !b.lastDay) b.lastDay = iso(m.end); autoWork(b, m); recalc(b, e, m); dirty.current.add(String(b.id));
    setRows((rs) => [...rs, b].map((r, i) => ({ ...r, idx: i + 1 }))); schedule();
  }
  function addRow() {
    if (locked) return toast('المسير معتمد - لا يمكن التعديل', 'ter');
    const id = 'new_' + Date.now(); const b = baseRow({ id, nameAr: 'موظف جديد' }, m.days); b.edited = true; b.insStatus = '—'; b.empNo = '';
    try { recalc(b, {}, m); } catch { /* صف فارغ */ }
    dirty.current.add(String(b.id)); setRows((rs) => [...rs, b].map((r, i) => ({ ...r, idx: i + 1 }))); schedule();
  }
  async function rebuild() {
    setDlg(null); setBusy(true);
    try { pushed.current = {}; dirty.current = new Set(); const rs = buildRows(employees, m, {}); setRows(rs); toast('✓ تم إعادة بناء المسير'); } finally { setBusy(false); }
  }
  async function prepare(note) {
    setDlg(null); setBusy(true);
    try { await flush(true); await payrollSync(y, mo, false, null, rowsRef.current); rowsRef.current.forEach((r) => { pushed.current[String(r.id)] = rowSig(r); }); await payrollPrepare(y, mo, note); toast('✓ اتبعت للمالية للاعتماد'); setStatus(await payrollStatus(y, mo)); }
    catch (e) { const mm = String(e.message || e); toast('تعذر التجهيز: ' + (mm === 'PAYROLL_NOT_SAVED' ? 'المسير لسه ما اتحفظش' : mm === 'PAYROLL_ALREADY_APPROVED' ? 'المسير معتمد بالفعل' : mm), 'ter'); } finally { setBusy(false); }
  }
  async function approve() {
    setDlg(null); setBusy(true);
    try {
      const s = await payrollStatus(y, mo); setStatus(s);
      if (s.role === 'finance' && s.status !== 'prepared' && s.status !== 'approved') { toast('لازم الموارد البشرية تجهّز المسير الأول', 'ter'); return; }
      const at = new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn');
      await payrollSync(y, mo, true, new Date().toISOString(), rowsRef.current);
      setApproved(true); setApprovedAt(at); toast('✓ تم اعتماد مسير الرواتب'); setStatus(await payrollStatus(y, mo));
    } catch (e) {
      const mm = String(e.message || e), code = (mm.match(/APPROVAL_REQUIRES_FINANCE|PAYROLL_NOT_PREPARED|PAYROLL_APPROVED_LOCKED/) || [])[0];
      toast('السيرفر رفض الاعتماد: ' + ({ APPROVAL_REQUIRES_FINANCE: 'الاعتماد للمالية', PAYROLL_NOT_PREPARED: 'المسير لسه ما اتجهّزش', PAYROLL_APPROVED_LOCKED: 'المسير معتمد ومقفول' }[code] || mm), 'ter');
    } finally { setBusy(false); }
  }
  async function reopen(reason) {
    setDlg(null); setBusy(true);
    try { await payrollReopen(y, mo, reason); setApproved(false); setApprovedAt(null); toast('✓ اتفتح المسير'); loadedKey.current = ''; await load(); setStatus(await payrollStatus(y, mo)); }
    catch (e) { const mm = String(e.message || e); toast('تعذر فتح المسير: ' + (mm === 'REASON_REQUIRED' ? 'السبب مطلوب' : mm === 'NOT_AUTHORIZED' ? 'الصلاحية للمالية فقط' : mm), 'ter'); } finally { setBusy(false); }
  }
  function exportXlsx() { if (!list.length) return toast('لا توجد بيانات', 'ter'); const { blob, name } = payrollXlsx(list, cols, SUMCOL, y, mo); download(name, blob); }
  function print() {
    if (!list.length) return toast('لا توجد بيانات للطباعة', 'ter');
    const body = payrollPrintHtml(list, { y, m: mo, logo: logoOf(settings), signer: signerOf(settings, employees), companyTitle: ((settings.names && settings.names.coAr) ? 'كشف رواتب ومكافآت موظفي ' + settings.names.coAr : undefined) });
    printHtml('مسير الرواتب ' + MONTHS_AR[mo] + ' ' + y, body);
  }

  // ---------- مجاميع ----------
  const sAll = useMemo(() => sums(list), [list]);
  const byCur = {}; list.forEach((r) => { const c = r.currency || 'ريال سعودي'; byCur[c] = (byCur[c] || 0) + num(r.net); });
  const grossText = Object.keys(byCur).map((c) => money(byCur[c]) + (c === 'ريال سعودي' ? ' ر.س' : ' ' + c)).join(' | ');
  const pay = {}; list.forEach((r) => { const k = r.payMethod || 'مدد'; pay[k] = (pay[k] || 0) + num(r.netSAR); });
  const order = [], by = {}; list.forEach((r) => { const k = r.employer || '—'; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(r); });
  const kpi = (l, v, c) => <div key={l} className="kpi" style={{ '--ac': c }}><div className="kl">{l}</div><div className="kv" style={{ fontSize: 15 }}>{v}</div></div>;

  const totalRow = (label, rs, bg, key) => {
    const s = sums(rs); let first = true;
    return <tr key={key}>{cols.map((c, i) => { if (first) { first = false; return <td key={i} colSpan={3} style={{ ...TDS, background: bg, fontWeight: 800, position: 'sticky', right: 0 }}>{label} ({rs.length})</td>; } if (i < 3) return null; const k = SUMCOL[c.t]; return <td key={i} style={{ ...TDS, background: bg, fontWeight: 800 }}>{k ? money(s[k]) : ''}</td>; })}</tr>;
  };
  const groups = []; let curG = null; cols.forEach((c) => { if (c.g) { curG = { t: c.g, n: 0 }; groups.push(curG); } curG.n += 1; });
  const thS = { background: 'var(--c2)', padding: '6px 7px', textAlign: 'right', fontSize: 10, fontWeight: 700, borderBottom: '2px solid var(--bl)', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, borderLeft: '1px solid rgba(36,48,68,.3)' };
  const gS = { background: 'rgba(1,77,61,.18)', padding: '5px 7px', textAlign: 'center', fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap', borderLeft: '2px solid var(--bd)' };
  const years = []; for (let i = 2011; i <= 2086; i += 1) years.push(i);
  const isHR = role === 'hr' || role === 'admin', isFin = role === 'finance' || role === 'admin' || role === 'ceo';
  const chip = st === 'approved' ? ['rgba(41,179,94,.15)', 'var(--gr)', '🔒 معتمد'] : st === 'prepared' ? ['rgba(59,130,246,.15)', 'var(--bl)', '✅ جاهز للمالية للاعتماد'] : st === 'reopened' ? ['rgba(245,158,11,.15)', 'var(--am)', '🔓 اتفتح بعد الاعتماد'] : ['rgba(148,163,184,.18)', 'var(--mu)', '📝 مسودة'];
  const sub = !status ? '' : st === 'approved' ? 'اعتمده ' + (status.approved_by || '') + (status.approved_at ? ' — ' + dtime(status.approved_at) : '')
    : st === 'prepared' ? 'جهّزه ' + (status.prepared_by || '') + (status.prepared_at ? ' — ' + dtime(status.prepared_at) : '') + (status.prepare_note ? ' — ' + status.prepare_note : '')
      : st === 'reopened' ? 'فتحه ' + (status.reopened_by || '') + (status.reopened_at ? ' — ' + dtime(status.reopened_at) : '') + ' — السبب: ' + (status.reopen_reason || '')
        : (isHR ? 'جهّز المسير وابعته للمالية للاعتماد' : 'مستني تجهيز الموارد البشرية');
  const approveDisabled = busy || (role === 'finance' && st !== 'prepared' && st !== 'approved') || approved;

  return (
    <div className="pg on" id="pg-pay">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--c2)', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--bd)' }}>
          <label style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 600 }}>الشهر:</label>
          <select value={mo} onChange={(e) => { setMo(+e.target.value); setDaysSel(0); }} style={{ fontSize: 12, background: 'transparent', border: 'none', color: 'var(--tx)' }}>{MONTHS_AR.slice(1).map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select>
          <select value={y} onChange={(e) => { setY(+e.target.value); setDaysSel(0); }} style={{ fontSize: 12, background: 'transparent', border: 'none', color: 'var(--tx)' }}>{years.map((v) => <option key={v}>{v}</option>)}</select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--c2)', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--bd)' }}>
          <label style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 600 }}>أيام الشهر:</label>
          <select value={m.days} disabled={locked} onChange={(e) => { const v = +e.target.value; setDaysSel(v === new Date(y, mo, 0).getDate() ? 0 : v); }} style={{ fontSize: 12, background: 'transparent', border: 'none', color: 'var(--tx)' }}>{[28, 29, 30, 31].map((d) => <option key={d}>{d}</option>)}</select>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ fontSize: 12, maxWidth: 160 }}><option value="">كل جهات العمل</option>{employers.map((x) => <option key={x}>{x}</option>)}</select>
        <div>{approved ? <span style={{ background: 'rgba(16,185,129,.15)', color: 'var(--gr)', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>✓ معتمد {approvedAt ? '— ' + approvedAt : ''}</span> : <span style={{ background: 'rgba(245,158,11,.1)', color: 'var(--am)', padding: '3px 10px', borderRadius: 6, fontSize: 11 }}>⏳ غير معتمد</span>}</div>
        <span style={{ fontSize: 11, color: 'var(--mu)' }}>{saveState}</span>
        {!locked && canEdit && <>
          {termAddable.length > 0 && <select value="" onChange={(e) => e.target.value && addTerminated(e.target.value)} style={{ fontSize: 11, maxWidth: 190 }}><option value="">+ إضافة موظف منتهي الخدمة…</option>{termAddable.map((e) => <option key={e.id} value={e.id}>{e.nameAr}</option>)}</select>}
          <button type="button" className="btn bsm" style={{ fontSize: 11, padding: '3px 9px' }} title="ترجع أيام العمل لأيام الشهر (أو من المباشرة/لآخر يوم) لكل الموظفين" onClick={() => bulk((r) => { if (r.manualEdits) delete r.manualEdits.workDays; r.workDays = defaultInsDays(r, empMap.get(String(r.id)) || {}, m); })}>↺ أيام العمل تلقائي</button>
          <button type="button" className="btn bsm" style={{ fontSize: 11, padding: '3px 9px' }} title="تنسخ أيام العمل لأيام التأمينات لكل الموظفين" onClick={() => bulk((r) => { r.insDays = num(r.workDays); r.manualEdits.insDays = true; })}>أيام التأمينات = أيام العمل</button>
          <button type="button" className="btn bsm" style={{ fontSize: 11, padding: '3px 9px' }} title="ترجع أيام التأمينات لأيام الشهر لكل الموظفين" onClick={() => bulk((r) => { if (r.manualEdits) delete r.manualEdits.insDays; r.insDays = defaultInsDays(r, empMap.get(String(r.id)) || {}, m); })}>↺ أيام التأمينات تلقائي</button>
        </>}
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {role !== 'hr' && perm.edit('payroll_approve') && <button className="btn bgr bsm" disabled={approveDisabled} title={role === 'finance' && st !== 'prepared' ? 'الاعتماد بعد ما الموارد البشرية تجهّز المسير' : ''} onClick={() => setDlg({ kind: 'approve' })}><i className="ti ti-check" /> اعتماد</button>}
          {!locked && canEdit && <button className="btn bsm" id="PAY_ADDROW" style={{ background: 'var(--cy)', color: '#fff', borderColor: 'var(--cy)' }} onClick={addRow}><i className="ti ti-plus" /> إضافة صف</button>}
          {!locked && canEdit && <button className="btn bsm" style={{ background: 'var(--am)', color: '#fff' }} onClick={() => setDlg({ kind: 'rebuild' })}><i className="ti ti-refresh" /> إعادة بناء</button>}
          <button className="btn bsm" style={{ background: 'var(--pu)', color: '#fff' }} onClick={exportXlsx}><i className="ti ti-file-spreadsheet" /> Excel</button>
          <button className="btn bsm" style={{ background: 'var(--rd)', color: '#fff' }} onClick={print}><i className="ti ti-printer" /> طباعة المسير</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0', padding: '8px 12px', borderRadius: 12, border: '1px solid var(--bd)', background: 'var(--c2)', fontSize: 12.5 }}>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: chip[0], color: chip[1] }}>{chip[2]}</span>
        <span style={{ color: 'var(--mu)', fontSize: 11.5 }}>{sub}</span><span style={{ flex: 1 }} />
        {isHR && (st === 'draft' || (st === 'reopened' && role !== 'admin')) && canEdit && <button type="button" className="btn bpl bsm" disabled={busy} onClick={() => setDlg({ kind: 'prepare' })}>📤 تجهيز للمالية</button>}
        {isFin && st === 'approved' && <button type="button" className="btn bsm" disabled={busy} style={{ borderColor: 'var(--am)', color: 'var(--am)' }} onClick={() => setDlg({ kind: 'reopen' })}>🔓 فتح المسير</button>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {kpi('إجمالي صافي العملات', grossText, 'var(--bl)')}{kpi(eg ? 'إجمالي الصافي (ج.م)' : 'إجمالي الصافي (ر.س)', money(sAll.netSAR), 'var(--gr)')}{kpi('تأمينات المنشأة', money(sAll.insEr), 'var(--am)')}
        {sAll.leaveComp ? kpi('بدل الإجازة', money(sAll.leaveComp), 'var(--pu)') : null}{sAll.eosAmt ? kpi('مكافأة نهاية الخدمة', money(sAll.eosAmt), 'var(--pu)') : null}{kpi('عدد الموظفين', list.length, 'var(--cy)')}
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--mu)' }}>جاري تحميل المسير…</div> :
          <table id="payTable" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 2000 }}>
            <thead>
              <tr>{groups.map((g) => <th key={g.t} colSpan={g.n} style={gS}>{g.t}</th>)}</tr>
              <tr>{cols.map((c) => <th key={c.t} style={thS}>{c.t}</th>)}</tr>
            </thead>
            <tbody id="payBody">
              {order.map((k) => <Fragment key={k}>{by[k].map((r) => {
                const term = !!X.findReason(r.reason);
                return <tr key={r.id} style={term ? { background: 'rgba(217,119,6,.07)' } : undefined}>{cols.map((c) => <td key={c.t} style={{ ...TDS, ...(c.st || {}) }}>{c.v(r, locked || !canEdit, api)}</td>)}</tr>;
              })}{order.length > 1 && totalRow('إجمالي ' + k, by[k], 'rgba(1,77,61,.10)', 't' + k)}</Fragment>)}
              {!list.length && <tr><td colSpan={cols.length} style={{ ...TDS, textAlign: 'center', padding: 24, color: 'var(--mu)' }}>لا توجد صفوف</td></tr>}
            </tbody>
            <tfoot>
              {totalRow('الإجمالي العام', list, 'rgba(59,130,246,.12)', 'gt')}
              <tr><td colSpan={cols.length} style={{ ...TDS, background: 'rgba(59,130,246,.06)', fontSize: 11 }}>إجمالي حسب طريقة الدفع ({eg ? 'ج.م' : 'ر.س'}): {Object.keys(pay).map((k, i) => <span key={k}>{i ? ' | ' : ''}{k}: <b>{money(pay[k])}</b></span>)}</td></tr>
            </tfoot>
          </table>}
      </div>

      <PayArchive />
      <PromptModal open={dlg && dlg.kind === 'approve'} noInput title="اعتماد مسير الرواتب" message="اعتماد مسير الرواتب؟ لن يمكن التعديل بعد الاعتماد (فتحه من المالية فقط وبسبب مسجّل)." confirmText="اعتماد" onClose={() => setDlg(null)} onConfirm={approve} />
      <PromptModal open={dlg && dlg.kind === 'rebuild'} noInput danger title="إعادة بناء المسير" message="إعادة بناء المسير من بيانات الموظفين؟ ستُفقد التعديلات اليدوية غير المعتمدة." confirmText="إعادة بناء" onClose={() => setDlg(null)} onConfirm={rebuild} />
      <PromptModal open={dlg && dlg.kind === 'prepare'} title="تجهيز المسير للمالية" label="ملاحظة للمالية (اختياري)" confirmText="إرسال للمالية" onClose={() => setDlg(null)} onConfirm={prepare} />
      <PromptModal open={dlg && dlg.kind === 'reopen'} title="فتح المسير بعد اعتماده" label="السبب (إلزامي — يُسجَّل في سجل التعديلات، 5 حروف على الأقل)" required confirmText="فتح" danger onClose={() => setDlg(null)} onConfirm={(v) => (v.length < 5 ? toast('اكتب سبب واضح (5 حروف على الأقل)', 'ter') : reopen(v))} />
    </div>
  );
}
