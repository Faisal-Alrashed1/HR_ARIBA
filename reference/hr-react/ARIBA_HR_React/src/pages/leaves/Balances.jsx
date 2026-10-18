import { useEffect, useMemo, useState } from 'react';
import { useApp, usePerm } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import { syncEmployee } from '../../lib/employees.js';
import { clearLeaveCache, rt } from '../../engines/runtime.js';
import * as L from '../../engines/leave.js';
import { LVL } from '../../lib/leaves.js';
import { syncState, onSyncState, syncLeaveSnapshots } from '../../lib/leaveSnapshots.js';
import { tod } from '../../lib/util.js';
import { printHtml } from '../../lib/print.js';
import { tableHtml } from '../../lib/exporter.js';

const r2 = (v) => Math.round(v * 100) / 100;
const f2 = (v) => Number(v).toFixed(2);

function Equation({ e, h, yr }) {
  const now = new Date(), ann = L.leaveAnnual(e), method = rt.leaveAccrual || 'calendar';
  const acc = L.leaveAccruedForPeriod(e, yr, now), carry = L.leaveCarryForward(e, yr), adj = L.leaveManualNet(e, yr, now), used = L.leaveDefaultUsed(e, yr, now), bal = L.leaveCurrentBalance(e);
  const doy = Math.floor((Date.UTC(yr, now.getMonth(), now.getDate()) - Date.UTC(yr, 0, 1)) / 864e5) + 1, dY = (yr % 4 === 0 ? 366 : 365);
  const wd = L.leaveWorkingDaysInYear(yr), el = ann > 0 ? Math.round(acc * wd / ann) : 0;
  const M = { calendar: [h ? 'Calendar days' : 'أيام تقويمية', 'Annual × DayOfYear ÷ DaysInYear', h ? 'Days elapsed / days in year' : 'الأيام المنقضية / أيام السنة', doy + ' / ' + dY], workdays: [h ? 'Workdays' : 'أيام العمل', 'Annual × WorkdaysElapsed ÷ WorkdaysInYear', h ? 'Workdays elapsed / in year' : 'أيام العمل المنقضية / أيام عمل السنة', el + ' / ' + wd], monthly: [h ? 'Monthly' : 'شهرياً', 'Annual ÷ 12 × MonthsElapsed (partial month prorated)', h ? 'Months elapsed' : 'الأشهر المنقضية', ann > 0 ? f2(acc / ann * 12) : '0'] }[method];
  const row = (k, v) => <tr key={k}><td style={{ textAlign: 'start' }}>{k}</td><td style={{ fontWeight: 800 }}>{v}</td></tr>;
  return (
    <div className="card" style={{ marginTop: 12, padding: 12 }}>
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{h ? 'Balance equation (current year, as of today)' : 'معادلة الرصيد (السنة الحالية حتى اليوم)'} — {M[0]}</div>
      <div style={{ fontSize: 12, lineHeight: 1.9, marginBottom: 8 }} dir="ltr">{'Balance = Carry-in + Accrued + Adjustments − Used'}<br />{'Accrued = ' + M[1]}<br />{'Carry-in(Y) = min(cap, Closing(Y-1))   |   Closing(Y) = Carry-in + Entitlement + Adjustments − Used'}</div>
      <div className="tw"><table><tbody>
        {row(h ? 'Carry-in from previous year (capped)' : 'المرحل من السنة السابقة (بعد الحد الأقصى)', f2(carry))}
        {row(h ? 'Annual entitlement (contract)' : 'الاستحقاق السنوي بالعقد', f2(ann))}
        {row(M[2], M[3])}
        {row(h ? 'Accrued to today' : 'المستحق حتى اليوم', f2(acc))}
        {row(h ? 'Manual adjustments' : 'التعديلات اليدوية', f2(adj))}
        {(() => { const ints = L.leaveInterruptions(e, yr); const n = ints.reduce((s, x) => s + x.refunded, 0); return n ? row(h ? 'Annual days returned (covered by other leaves)' : 'أيام رجعت من السنوية (مغطاة بإجازات أخرى)', n + ' — ' + ints.map((x) => String(x.leave.from).slice(5) + '→' + String(x.leave.to).slice(5) + ': ' + Object.entries(x.byType).map(([k, v]) => (LVL[k] ? (h ? LVL[k].en : LVL[k].ar) : k) + ' ' + v).join('، ')).join(' | ')) : null; })()}
        {row(h ? 'Used this year' : 'المستخدم هذا العام', f2(used))}
        {row(h ? 'Balance today' : 'الرصيد اليوم', f2(bal))}
      </tbody></table></div>
      <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 6 }}>{h ? 'The accrual method can be changed from Settings → Leaves & balances.' : 'طريقة الاحتساب تتغير من الإعدادات ← الإجازات والأرصدة.'}</div>
    </div>
  );
}

function Detail({ e, h }) {
  if (!e) return <div className="al alb"><i className="ti ti-user-search" />{h ? 'Select an employee to view detailed balances.' : 'اختر الموظف لعرض تفاصيل رصيده بالتفصيل.'}</div>;
  const yr = new Date().getFullYear();
  const today = L.leaveCurrentBalance(e), yend = L.leaveProjectedYearEnd(e, yr), accrued = L.leaveCumulativeAccruedToToday(e), used = L.leaveCumulativeUsedToToday(e);
  const cum = Math.max(0, accrued - used + L.leaveCumulativeManualToToday(e)), eos = L.leaveAccumulatedEos(e, yr);
  const cards = [['الرصيد المرحل من العام السابق', 'Previous Carry Forward', L.leaveCarryForward(e, yr), 'var(--cy)'], ['الرصيد المتاح حتى اليوم', 'Available Balance Today', today, 'var(--gr)'], ['رصيد نهاية العام', 'Year End Balance', yend, 'var(--pu)'],
    ['إجمالي المستحق من بداية الخدمة', 'Total Accrued Since Joining', accrued, 'var(--bl)'], ['إجمالي المستخدم من بداية الخدمة', 'Total Used Since Joining', used, 'var(--rd)'], ['الرصيد المتبقي من بداية الخدمة', 'Cumulative Remaining', cum, 'var(--gr)'], ['رصيد نهاية الخدمة المتراكم (فائض السنوات السابقة فوق حد الترحيل)', 'EOS Leave Excess (previous years)', eos, 'var(--am)'], ['الفائض المتوقع هذا العام (يضاف نهاية الخدمة)', 'Expected excess this year', L.leaveYearExcess(e, yr), 'var(--rd)']];
  const s = L.leaveStartYear(e);
  const years = Array.from({ length: Math.max(1, yr - s + 1) }, (_, i) => s + i);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 8, marginBottom: 12 }}>
        {cards.map((c) => <div key={c[1]} style={{ padding: 12, border: '1px solid var(--bd)', borderRadius: 10, background: 'var(--c2)' }}><div style={{ fontSize: 10, color: 'var(--mu)' }}>{h ? c[1] : c[0]}</div><div style={{ fontSize: 20, fontWeight: 900, color: c[3] }}>{f2(c[2])} <span style={{ fontSize: 11, fontWeight: 500 }}>{h ? 'days' : 'يوم'}</span></div></div>)}
      </div>
      <div className="al alb" style={{ marginBottom: 8 }}><i className="ti ti-info-circle" />{h ? 'Accrual follows the method chosen in Settings (calendar days by default). A full year is 21 days; the first year is prorated from the joining date. Excess over the carry cap remains as end-of-service leave balance.' : 'الاستحقاق يُحسب بالطريقة المختارة في الإعدادات (الأيام التقويمية افتراضياً). السنة الكاملة = 21 يومًا، والسنة الأولى تُحسب تناسبيًا من تاريخ المباشرة. يرحل بحد أقصى الحد المحدد في الإعدادات للسنة التالية، وما زاد يبقى ضمن رصيد نهاية الخدمة.'}</div>
      <div className="tw"><table><tbody>
        <tr>{(h ? ['Year', 'Carry In', 'Entitlement', 'Used', 'Adjustments', 'Year End', 'Carry Next', 'EOS Excess'] : ['السنة', 'المرحل', 'استحقاق السنة', 'المستخدم', 'التعديلات', 'نهاية السنة', 'مرحل للعام التالي', 'فائض نهاية الخدمة']).map((t) => <th key={t}>{t}</th>)}</tr>
        {years.map((y) => { const l = L.leaveYearLedger(e, y); return <tr key={y}><td>{y}</td><td>{f2(l.opening)}</td><td>{f2(l.entitlement)}</td><td>{f2(l.used)}</td><td>{f2(l.adjustment)}</td><td style={{ fontWeight: 900 }}>{f2(l.close)}</td><td>{f2(l.carry)}</td><td style={{ fontWeight: 800, color: l.eos > 0 ? 'var(--rd)' : 'var(--dm)' }}>{f2(l.eos)}</td></tr>; })}
      </tbody></table></div>
      <Equation e={e} h={h} yr={yr} />
    </>
  );
}

const KEYS = ['carry', 'entitlement', 'used', 'adjustment', 'current', 'yearEnd', 'carryNext', 'eos'];
function buildRows(e) {
  const yNow = new Date().getFullYear(), out = [];
  for (let y = L.leaveStartYear(e); y <= yNow; y++) {
    const l = L.leaveYearLedger(e, y), cur = y === yNow ? L.leaveCurrentBalance(e) : l.close;
    const v = { carry: l.opening, entitlement: l.entitlement, used: l.used, adjustment: l.adjustment, current: cur, yearEnd: l.close, carryNext: l.carry, eos: l.eos };
    const o = {}; KEYS.forEach((k) => { o[k] = r2(v[k]); v[k] = r2(v[k]); });
    out.push({ y, v, o, man: {} });
  }
  return out;
}
function recalc(rows, i, fromYearEnd, e) {
  const yNow = new Date().getFullYear(), r = rows[i]; if (!r) return;
  const ratio = (y) => { try { const d = L.leaveYearDates(y), full = L.leaveAccruedForPeriod(e, y, d.end), part = L.leaveAccruedForPeriod(e, y, new Date()); return full > 0 ? Math.min(1, Math.max(0, part / full)) : 1; } catch { return 1; } };
  let ye;
  if (fromYearEnd) ye = Math.max(0, r.v.yearEnd);
  else {
    ye = Math.max(0, r.v.carry + r.v.entitlement + r.v.adjustment - r.v.used); r.v.yearEnd = r2(ye);
    r.v.current = r2(r.y === yNow ? Math.max(0, r.v.carry + r.v.entitlement * ratio(r.y) + r.v.adjustment - r.v.used) : ye);
  }
  const cap = L.leaveCarryCap();
  let carryNext = Math.min(cap, ye);
  if (r.man.carryNext) carryNext = Math.max(0, r.v.carryNext); else r.v.carryNext = r2(carryNext);
  if (!r.man.eos) r.v.eos = r2(L.leaveEosOf(ye));
  if (rows[i + 1]) { rows[i + 1].v.carry = r2(carryNext); recalc(rows, i + 1, false, e); }
}

function BalanceEditor({ e, onClose, onSaved, h }) {
  const [rows, setRows] = useState(() => buildRows(e));
  const [note, setNote] = useState(''); const [date, setDate] = useState(tod()); const [busy, setBusy] = useState(false);
  const edit = (i, k, val) => setRows((prev) => {
    const rs = prev.map((r) => ({ ...r, v: { ...r.v }, man: { ...r.man } })); const r = rs[i]; r.v[k] = val === '' ? '' : parseFloat(val);
    const num = (x) => (Number.isFinite(x) ? x : 0); KEYS.forEach((kk) => { r.v[kk] = kk === k ? r.v[kk] : num(r.v[kk]); });
    if (['carry', 'entitlement', 'used', 'adjustment'].includes(k)) { delete r.man.carryNext; delete r.man.eos; recalc(rs, i, false, e); }
    else if (k === 'yearEnd') { delete r.man.carryNext; delete r.man.eos; recalc(rs, i, true, e); }
    else if (k === 'carryNext') { r.man.carryNext = true; if (rs[i + 1]) { rs[i + 1].v.carry = r2(Math.max(0, num(r.v.carryNext))); recalc(rs, i + 1, false, e); } }
    else if (k === 'eos') r.man.eos = true;
    return rs;
  });
  const chg = (r, k) => Math.abs((Number(r.v[k]) || 0) - r.o[k]) > 0.004;
  const anyCh = rows.some((r) => KEYS.some((k) => chg(r, k)));
  const undoCell = (i, k) => setRows((prev) => { const rs = prev.map((r) => ({ ...r, v: { ...r.v }, man: { ...r.man } })); rs[i].v[k] = rs[i].o[k]; delete rs[i].man[k]; if (['carry', 'entitlement', 'used', 'adjustment'].includes(k)) recalc(rs, i, false, e); return rs; });
  const undoRow = (i) => setRows((prev) => { const rs = prev.map((r) => ({ ...r, v: { ...r.v }, man: { ...r.man } })); KEYS.forEach((k) => { rs[i].v[k] = rs[i].o[k]; }); rs[i].man = {}; return rs; });
  const undoAll = () => { setRows(buildRows(e)); setNote(''); toast(h ? '↺ Restored' : '↺ رجعت كل الأرصدة للقيم المحفوظة', 'tin'); };
  const hist = Array.isArray(e.leaveBalanceHistory) ? e.leaveBalanceHistory : [];
  async function undoLastSave() {
    if (!hist.length || !window.confirm('استرجاع الأرصدة لما قبل آخر حفظ؟')) return;
    const last = hist[hist.length - 1];
    setBusy(true);
    try { await syncEmployee({ ...e, leaveYearOverrides: last.overrides || {}, leaveBalance: last.leaveBalance, leaveBalanceHistory: hist.slice(0, -1), leaveBalanceUpdatedAt: new Date().toISOString(), leaveBalanceUpdatedBy: 'HR' }); clearLeaveCache(); toast('↩ تم استرجاع آخر نسخة محفوظة من الأرصدة'); await onSaved(); onClose(); }
    catch (er) { toast('تعذر الاسترجاع: ' + (er.message || er), 'ter'); } finally { setBusy(false); }
  }
  async function save() {
    const yNow = new Date().getFullYear(), prevAll = e.leaveYearOverrides || {}, overrides = {};
    rows.forEach((r) => {
      const prev = (prevAll[String(r.y)] && typeof prevAll[String(r.y)] === 'object') ? prevAll[String(r.y)] : {}, ch = {}, o = r.v;
      KEYS.forEach((k) => { ch[k] = !Number.isFinite(r.o[k]) || Math.abs((Number(o[k]) || 0) - r.o[k]) > 0.004; });
      const out = {};
      ['carry', 'entitlement', 'used', 'adjustment'].forEach((k) => { if (ch[k]) out[k] = k === 'adjustment' ? o[k] : Math.max(0, o[k]); else if (prev[k] !== undefined) out[k] = prev[k]; });
      if (ch.yearEnd) { out.yearEnd = Math.max(0, o.yearEnd); if (out.carry === undefined) out.carry = Math.max(0, o.carry || 0); }
      if (ch.current && r.y === yNow) { out.current = Math.max(0, o.current); out.currentAsOf = new Date().toISOString(); }
      const coreChanged = ch.carry || ch.entitlement || ch.used || ch.adjustment || ch.yearEnd;
      ['carryNext', 'eos'].forEach((k) => { if (r.man[k] && Number.isFinite(Number(o[k]))) out[k] = Math.max(0, Number(o[k])); else if (prev[k] !== undefined && !coreChanged) out[k] = prev[k]; });
      if (out.used !== undefined) { if (ch.used) out.asOf = new Date().toISOString(); else if (prev.asOf) out.asOf = prev.asOf; }
      overrides[String(r.y)] = { ...out, note: note.trim(), updatedAt: new Date().toISOString() };
    });
    const n = { ...e, leaveYearOverrides: overrides, leaveBalanceHistory: [...hist.slice(-9), { at: new Date().toISOString(), overrides: e.leaveYearOverrides || {}, leaveBalance: e.leaveBalance }] };
    const co = overrides[String(yNow)];
    clearLeaveCache();
    n.leaveBalance = co && co.current !== undefined ? Math.max(0, Number(co.current) || 0) : L.leaveCurrentBalance(n);
    n.leaveBalanceUpdatedAt = new Date().toISOString(); n.leaveBalanceUpdatedBy = 'HR';
    setBusy(true);
    try { await syncEmployee(n); toast(h ? '✓ Yearly leave balances saved and synced' : '✓ تم حفظ واستبدال أرصدة كل السنوات ومزامنتها'); await onSaved(); onClose(); }
    catch (er) { toast('تعذر الحفظ: ' + (er.message || er), 'ter'); } finally { setBusy(false); }
  }
  const cols = [['carry', 'المرحل للسنة', 'Carry In'], ['entitlement', 'استحقاق السنة', 'Entitlement'], ['used', 'المستخدم', 'Used'], ['adjustment', 'تعديل +/-', 'Adjustment +/-'], ['current', 'الرصيد الحالي', 'Current Balance'], ['yearEnd', 'رصيد نهاية السنة', 'Year-End Balance'], ['carryNext', 'المرحل للعام التالي', 'Carry Next'], ['eos', 'فائض نهاية الخدمة', 'EOS Excess']];
  return (
    <Modal open onClose={onClose} width={1000} title={(h ? 'Edit leave balances — ' : 'تعديل أرصدة الإجازة — ') + (e.nameAr || '')}>
      <div className="fg" style={{ marginBottom: 10 }}>
        <div><label>تاريخ التعديل</label><input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} /></div>
        <div><label>ملاحظة</label><input value={note} onChange={(ev) => setNote(ev.target.value)} /></div>
      </div>
      <div className="tw"><table className="lb-edit-table"><tbody>
        <tr><th>{h ? 'Year' : 'السنة'}</th>{cols.map((c) => <th key={c[0]}>{h ? c[2] : c[1]}</th>)}</tr>
        {rows.map((r, i) => { const rowCh = cols.some(([k]) => chg(r, k)); return <tr key={r.y}><td><b>{r.y}</b>{rowCh && <button type="button" className="undo-f" title="استرجاع هذه السنة" onClick={() => undoRow(i)}>↺</button>}</td>{cols.map(([k]) => <td key={k}><input type="number" step="0.01" value={Number.isFinite(r.v[k]) ? r.v[k] : ''} onChange={(ev) => edit(i, k, ev.target.value)} />{chg(r, k) && <button type="button" className="undo-f" title={'استرجاع: ' + r.o[k]} onClick={() => undoCell(i, k)}>↺</button>}</td>)}</tr>; })}
      </tbody></table></div>
      <div style={{ padding: 8, color: 'var(--mu)', fontSize: 11 }}>{h ? 'Edit each service year separately. Year-end = carry in + entitlement + adjustment − used unless you override it. The carry limit is set in Settings.' : 'عدّل كل سنة من سنوات الخدمة بشكل مستقل. رصيد نهاية السنة = المرحل + الاستحقاق + التعديل − المستخدم، ما لم تدخل قيمة يدوية له. حد الترحيل يُحدَّد من الإعدادات؛ وما زاد يُحفظ كرصيد نهاية خدمة.'}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button className="btn bpl" disabled={busy} onClick={save}><i className="ti ti-check" /> {busy ? '…' : (h ? 'Save' : 'حفظ')}</button><button className="btn" onClick={onClose}>إلغاء</button><button className="btn bsm" disabled={!anyCh} onClick={undoAll}>↺ {h ? 'Restore all' : 'استرجاع الكل'}</button>{hist.length > 0 && <button className="btn bsm" disabled={busy} onClick={undoLastSave}>↩ {h ? 'Undo last save' : 'تراجع عن آخر حفظ'} ({hist.length})</button>}</div>
    </Modal>
  );
}

/** حالة الربط مع تطبيق الموظف */
function SyncBadge({ h }) {
  const { employees } = useApp();
  const [st, setSt] = useState({ ...syncState }); const [busy, setBusy] = useState(false);
  useEffect(() => onSyncState(setSt), []);
  const now = async () => { setBusy(true); try { await syncLeaveSnapshots(employees); } finally { setBusy(false); } };
  const t = st.at ? st.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  const box = (bg, c, txt) => <div id="LB_SYNC" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', borderRadius: 10, background: bg, color: c, fontSize: 12, fontWeight: 700, marginBottom: 10 }}><i className="ti ti-device-mobile" /><span style={{ flex: 1 }}>{txt}</span><button className="btn bsm" disabled={busy} onClick={now}><i className="ti ti-refresh" /> {h ? 'Sync now' : 'مزامنة الآن'}</button></div>;
  if (!st.at) return box('rgba(100,116,139,.12)', 'var(--mu)', h ? 'Employee App sync: starting…' : 'ربط تطبيق الموظف: جاري المزامنة…');
  if (st.ok) return box('rgba(16,185,129,.12)', '#0a7a3f', (h ? '✓ Employee App shows exactly these balances — last sync ' : '✓ تطبيق الموظف بيعرض نفس الأرصدة دي بالظبط — آخر مزامنة ') + t + (st.saved ? (h ? ` (${st.saved} updated)` : ` (اتحدّث ${st.saved})`) : ''));
  if (st.error === 'SQL19_MISSING') return box('rgba(245,158,11,.14)', '#a16207', h ? '⚠ Run sql/19_leave_snapshot.sql once in Supabase so the Employee App reads the same balances' : '⚠ شغّل ملف sql/19_leave_snapshot.sql مرة واحدة في Supabase › SQL Editor عشان تطبيق الموظف يقرا نفس الأرصدة دي');
  return box('rgba(239,68,68,.12)', 'var(--rd)', (h ? '⚠ Sync failed: ' : '⚠ تعذرت المزامنة: ') + st.error);
}

export default function Balances() {
  const h = useLang() === 'en';
  const { activeEmps, reload, rev } = useApp();
  const canEdit = usePerm().edit('leaves');
  const [sel, setSel] = useState(''); const [editing, setEditing] = useState(null);
  const yr = new Date().getFullYear();
  const emps = activeEmps;
  const data = useMemo(() => {
    const rows = emps.map((e) => { const accrued = L.leaveCumulativeAccruedToToday(e), used = L.leaveCumulativeUsedToToday(e); return { e, carry: L.leaveCarryForward(e, yr), current: L.leaveCurrentBalance(e), projected: L.leaveProjectedYearEnd(e, yr), accrued, used, cum: Math.max(0, accrued - used + L.leaveCumulativeManualToToday(e)), eos: L.leaveAccumulatedEos(e, yr) + L.leaveYearExcess(e, yr) }; });
    const sum = rows.reduce((s, r) => ({ current: s.current + r.current, yearEnd: s.yearEnd + r.projected, accrued: s.accrued + r.accrued, used: s.used + r.used, eos: s.eos + r.eos }), { current: 0, yearEnd: 0, accrued: 0, used: 0, eos: 0 });
    return { rows, sum };
  }, [emps, rev, yr]); // eslint-disable-line
  const se = emps.find((x) => String(x.id) === sel);
  const printAll = () => {
    const head = ['#', h ? 'Employee' : 'الموظف', 'المرحّل من السابق', 'الرصيد الحالي', 'رصيد نهاية العام', 'المستحق من بداية الخدمة', 'المستخدم من بداية الخدمة', 'المتبقي من بداية الخدمة', 'نهاية الخدمة'];
    const rows = data.rows.map((r, i) => [i + 1, r.e.nameAr || r.e.nameEn || '—', f2(r.carry), f2(r.current), f2(r.projected), f2(r.accrued), f2(r.used), f2(r.cum), f2(r.eos)]);
    printHtml(h ? 'Leave balances' : 'أرصدة الإجازات', tableHtml({ title: h ? 'Leave balances' : 'أرصدة الإجازات', headers: head, rows, sub: new Date().toLocaleDateString('en-GB') }), { dir: h ? 'ltr' : 'rtl', lang: h ? 'en' : 'ar' });
  };
  return (
    <div id="lv4">
      <SyncBadge h={h} />
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="ch"><div className="ct"><i className="ti ti-user-search" /><span>{h ? 'Employee balance details' : 'تفاصيل رصيد موظف'}</span></div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><select value={sel} onChange={(ev) => setSel(ev.target.value)} style={{ minWidth: 280 }}><option value="">{h ? 'Select employee' : 'اختر الموظف'}</option>{emps.map((x) => <option key={x.id} value={x.id}>{x.nameAr}</option>)}</select>
            {canEdit && <button className="btn bsm" id="LB_EDIT" onClick={() => { if (!se) return toast(h ? 'Select an employee first' : 'اختر الموظف أولاً', 'ter'); setEditing(se); }}><i className="ti ti-edit" /> {h ? 'Edit balance' : 'تعديل الرصيد'}</button>}
            <button className="btn bsm" id="LB_PRINT" title={h ? 'Print all balances' : 'طباعة أرصدة الإجازات'} onClick={printAll}><i className="ti ti-printer" /></button></div></div>
        <Detail e={se} h={h} />
      </div>
      {editing && <BalanceEditor e={editing} h={h} onClose={() => setEditing(null)} onSaved={() => reload({ silent: true })} />}
    </div>
  );
}
