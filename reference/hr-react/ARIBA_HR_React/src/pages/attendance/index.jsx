import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp, usePerm } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { rpc } from '../../lib/api.js';
import { toast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import { tod } from '../../lib/util.js';
import { esc, printHtml, wrapLetterhead } from '../../lib/print.js';
import { buildXlsx } from '../../lib/xlsx.js';
import { download } from '../../lib/util.js';
import { buildEmpMaps, groupRows, compute, FILTERS, ST_AR, ST_EN, fmtHM, ymd, hm } from '../../engines/attendance.js';
import { rt } from '../../engines/runtime.js';

const fetchRange = async (from, to, empId = null) => { const r = await rpc('ariba_hr_attendance_range', { p_from: from, p_to: to, p_employee_id: empId }); return Array.isArray(r) ? r : []; };
const dispD = (s) => { const p = String(s).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
const nameOf = (e, en) => (en ? (e.nameEn || e.nameAr || e.id) : (e.nameAr || e.nameEn || e.id));
const Kpi = ({ l, v, s, c }) => <div className="kpi" style={{ '--ac': c }}><div className="kl">{l}</div><div className="kv">{v}</div>{s && <div className="ks">{s}</div>}</div>;

function AttModal({ rec, emps, locs, T, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ empId: rec.empId || (emps[0] && emps[0].id) || '', date: rec.date || tod(), timeIn: rec.timeIn || '', timeOut: rec.timeOut || '', locId: rec.locId || '', status: rec.status || 'present' }));
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function save() {
    if (!f.empId || !f.date) return toast(T('اختر الموظف والتاريخ', 'Pick employee and date'), 'ter');
    const loc = locs.find((l) => String(l.id) === String(f.locId));
    try {
      await rpc('ariba_sync_attendance', { p_employee_id: String(f.empId), p_date: f.date, p_time_in: f.timeIn || null, p_time_out: f.timeOut || null, p_status: f.status || 'present', p_location_id: f.locId || null, p_location_name: loc ? loc.name : null, p_lat: null, p_lng: null, p_notes: null });
      toast('✓ ' + T('تم حفظ سجل الحضور', 'Attendance saved')); onSaved();
    } catch (e) { toast(T('تعذر حفظ الحضور: ', 'Could not save attendance: ') + (e.message || e), 'ter'); }
  }
  return (
    <Modal open onClose={onClose} title={T('تسجيل/تعديل حضور', 'Record / edit attendance')} width={480} footer={<div className="mf"><button className="btn" onClick={onClose}>{T('إلغاء', 'Cancel')}</button><button className="btn bpl" id="AT_SAVE" onClick={save}>{T('حفظ', 'Save')}</button></div>}>
      <div className="fg">
        <div><label>{T('الموظف', 'Employee')}</label><select id="AES" value={f.empId} onChange={set('empId')}>{emps.map((e) => <option key={e.id} value={e.id}>{e.nameAr || e.nameEn}</option>)}</select></div>
        <div><label>{T('التاريخ', 'Date')}</label><input type="date" id="AMD" value={f.date} onChange={set('date')} /></div>
        <div><label>{T('وقت الحضور', 'Check-in')}</label><input type="time" id="AMI" value={f.timeIn} onChange={set('timeIn')} /></div>
        <div><label>{T('وقت الانصراف', 'Check-out')}</label><input type="time" id="AMO" value={f.timeOut} onChange={set('timeOut')} /></div>
        <div><label>{T('الموقع', 'Location')}</label><select id="AML" value={f.locId} onChange={set('locId')}><option value="">—</option>{locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
        <div><label>{T('الحالة', 'Status')}</label><select id="AMS" value={f.status} onChange={set('status')}>{['present', 'late', 'absent', 'leave', 'remote'].map((k) => <option key={k} value={k}>{ST_AR[k]} / {ST_EN[k]}</option>)}</select></div>
      </div>
    </Modal>
  );
}

function Daily({ T, en, emps, locs, can }) {
  const [date, setDate] = useState(tod()); const [rows, setRows] = useState([]); const [staff, setStaff] = useState([]); const [modal, setModal] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try { const [r, s] = await Promise.all([fetchRange(date, date), rpc('ariba_staff_attendance', { p_date: date }).catch(() => ({ attendance: [] }))]); setRows(r); setStaff((s && s.attendance) || []); setErr(''); } catch (e) { setErr(String(e.message || e)); }
  }, [date]);
  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load]);
  const maps = useMemo(() => buildEmpMaps(emps), [emps]); const grp = useMemo(() => groupRows(rows, maps), [rows, maps]);
  const stRec = (e) => staff.find((x) => String(x.employee_id) === String(e.id));
  const sets = rt.settings || {}; void sets;
  const ST = { present: ['bg', T('حاضر', 'Present')], late: ['ba', T('متأخر', 'Late')], absent: ['br', T('غائب', 'Absent')], leave: ['bp', T('إجازة', 'Leave')], remote: ['bc', T('عن بعد', 'Remote')] };
  const recs = emps.map((e) => grp[String(e.id) + '|' + date]).filter(Boolean);
  const pres = recs.filter((g) => g.status === 'present' || g.status === 'late').length, late = recs.filter((g) => g.status === 'late').length;
  return (
    <>
      <div className="kr" id="ATK">
        <Kpi l={T('حاضر اليوم', 'Present Today')} v={pres} s={T('من ', 'of ') + emps.length} c="var(--gr)" /><Kpi l={T('متأخر', 'Late')} v={late} c="var(--am)" />
        <Kpi l={T('عمل عن بعد', 'Remote')} v={recs.filter((g) => g.status === 'remote').length} c="var(--cy)" /><Kpi l={T('غائب', 'Absent')} v={Math.max(0, emps.length - pres)} c="var(--rd)" />
      </div>
      <div className="card"><div className="ch"><div className="ct"><i className="ti ti-map-pin" /> <span>{T('سجل الحضور', 'Attendance log')}</span></div>
        <div style={{ display: 'flex', gap: 5 }}><input type="date" id="AD" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 155 }} />{can && <button className="btn bpl bsm" id="AT_ADD" onClick={() => setModal({ date })}><i className="ti ti-plus" /></button>}</div></div>
        {err && <div style={{ padding: 12, color: 'var(--rd)' }}>{err}</div>}
        <div id="ATL" style={{ maxHeight: 380, overflowY: 'auto' }}>
          {emps.map((e) => { const g = grp[String(e.id) + '|' + date], s = stRec(e); const st = g ? (ST[g.status] || ST.present) : null; return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(36,48,68,.4)' }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(nameOf(e, en)).split(' ').slice(0, 3).join(' ')}</div><div style={{ fontSize: 10, color: 'var(--dm)' }}>{(g && g.loc) || e.employer}</div></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>{g ? hm(g.in) + ' → ' + (g.out ? hm(g.out) : '…') + (g.sessions > 1 ? '  (×' + g.sessions + ')' : '') : '—'}</div>
                {g && g.status === 'late' && g.late > 0 && <div style={{ fontSize: 10, color: 'var(--am)' }}>⏰ {T('تأخير ', 'Late ')}{fmtHM(g.late, en)}</div>}
                {g && g.early > 0 && <div style={{ fontSize: 10, color: 'var(--rd)' }}>🚪 {T('خروج مبكر ', 'Early exit ')}{fmtHM(g.early, en)}</div>}
                {g && g.periods && g.periods.length > 1 && <div style={{ fontSize: 10, color: 'var(--cy)' }}>{g.periods.map((p) => p.in + '→' + (p.out || '…')).join(' ، ')}</div>}
                {g && g.hours > 0 && <div style={{ fontSize: 10, color: 'var(--mu)' }}>⏱ {g.hours}{T(' ساعة', ' h')}{g.sched ? ' / ' + g.sched.hours + (g.sched.kind === 'ramadan' ? ' 🌙' : '') : ''}{g.shortfall > 0 && g.out ? <span style={{ color: 'var(--am)' }}> ({T('نقص ', 'short ')}{g.shortfall})</span> : null}</div>}
              </div>
              {st ? <span className={'b ' + st[0]}>{st[1]}</span> : <span className="b bk">{T('لم يسجل', 'No record')}</span>}
              {g && can && <button className="btn bsm" title={T('تعديل', 'Edit')} onClick={() => setModal({ empId: e.id, date, timeIn: hm(g.in), timeOut: hm(g.out), locId: s ? s.location_id : '', status: g.status })}><i className="ti ti-edit" style={{ fontSize: 12 }} /></button>}
            </div>); })}
        </div>
      </div>
      {modal && <AttModal rec={modal} emps={emps} locs={locs} T={T} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </>
  );
}

function Monthly({ T, en, emps }) {
  const now = new Date(); const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return { v: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), l: d.toLocaleDateString(en ? 'en-US' : 'ar-SA-u-nu-latn', { month: 'long', year: 'numeric' }) }; });
  const [eid, setEid] = useState(''), [mon, setMon] = useState(months[0].v), [res, setRes] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  async function run() {
    setBusy(true); setErr('');
    try { const p = mon.split('-'), from = mon + '-01', to = ymd(new Date(+p[0], +p[1], 0)); const rows = await fetchRange(from, to); setRes(compute(rows, from, to, emps.filter((e) => !eid || String(e.id) === String(eid)), buildEmpMaps(emps), en ? 'en' : 'ar')); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }
  const H = en ? ['Employee', 'Present', 'Late', 'Absent', 'Leave', 'Remote', 'Late', 'Hours'] : ['الموظف', 'حاضر', 'متأخر', 'غائب', 'إجازة', 'عن بعد', 'إجمالي التأخير', 'الساعات'];
  return (
    <div className="card"><div className="ch"><div className="ct"><i className="ti ti-calendar-stats" /> <span>{T('تقرير شهري', 'Monthly report')}</span></div>
      <div style={{ display: 'flex', gap: 5 }}><select id="AME" value={eid} onChange={(e) => setEid(e.target.value)} style={{ maxWidth: 140 }}><option value="">{T('الكل', 'All')}</option>{emps.map((e) => <option key={e.id} value={e.id}>{String(e.nameAr || '').split(' ').slice(0, 3).join(' ')}</option>)}</select>
        <select id="AMM" value={mon} onChange={(e) => setMon(e.target.value)} style={{ maxWidth: 130 }}>{months.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}</select><button className="btn bpl bsm" id="AMS_GO" onClick={run}><i className="ti ti-search" /></button></div></div>
      <div className="tw"><table id="AMT">
        {busy ? <tbody><tr><td style={{ padding: 14, color: 'var(--mu)' }}>{T('جارٍ التحميل…', 'Loading…')}</td></tr></tbody> : err ? <tbody><tr><td style={{ padding: 14, color: 'var(--rd)' }}>{err}</td></tr></tbody> : res && (
          <tbody><tr>{H.map((x, i) => <th key={i}>{x}</th>)}</tr>{res.map((s) => <tr key={s.e.id}><td>{String(nameOf(s.e, en)).split(' ').slice(0, 3).join(' ')}</td><td style={{ color: 'var(--gr)' }}>{s.present}</td><td style={{ color: 'var(--am)' }}>{s.late}</td><td style={{ color: 'var(--rd)' }}>{s.absent}</td><td style={{ color: 'var(--pu)' }}>{s.leave}</td><td style={{ color: 'var(--cy)' }}>{s.remote}</td><td>{fmtHM(s.lateMin, en)}</td><td>{s.hours}</td></tr>)}</tbody>)}
      </table></div>
    </div>
  );
}

const PCSS = '<style>@page{size:A4;margin:0}*{box-sizing:border-box}body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#14231d;margin:0;font-size:10px}.doc{padding:6mm 10mm}.t{text-align:center;font-size:16px;font-weight:900;color:#014D3D}.s{text-align:center;color:#555;margin:1mm 0 4mm;font-size:11px}.k{display:flex;gap:5px;margin-bottom:4mm}.k div{flex:1;background:#eef5f2;border:1px solid #d8e2de;border-radius:7px;padding:5px;text-align:center}.k b{display:block;font-size:14px;color:#014D3D}.k span{font-size:8.5px;color:#666}table{width:100%;border-collapse:collapse;font-size:8.5px;margin-bottom:3mm}th{background:#014D3D;color:#fff;padding:4px 3px;text-align:center}td{padding:3px;border-bottom:1px solid #e5ece9;text-align:center}tr{page-break-inside:avoid}tr:nth-child(even){background:#f8faf9}h4{background:#014D3D;color:#fff;padding:4px 8px;border-radius:5px;margin:4mm 0 1mm;font-size:11px;page-break-after:avoid}.n{margin-top:4mm;padding-top:2mm;border-top:1px solid #ddd;font-size:8px;color:#777;line-height:1.7}</style>';

function Reports({ T, en, emps, settings }) {
  const now = new Date(), ms = (d) => ymd(new Date(d.getFullYear(), d.getMonth(), 1));
  const [from, setFrom] = useState(ms(now)), [to, setTo] = useState(ymd(now)), [fk, setFk] = useState('all'), [minN, setMinN] = useState(1), [mode, setMode] = useState('sum');
  const [sel, setSel] = useState(null), [panel, setPanel] = useState(false), [q, setQ] = useState(''), [dep, setDep] = useState('');
  const [res, setRes] = useState(null), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const quick = (k) => { const n = new Date(); let f, t; if (k === 'm0') { f = ms(n); t = ymd(n); } else if (k === 'm1') { f = ymd(new Date(n.getFullYear(), n.getMonth() - 1, 1)); t = ymd(new Date(n.getFullYear(), n.getMonth(), 0)); } else if (k === 'd7') { f = ymd(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 6)); t = ymd(n); } else { f = n.getFullYear() + '-01-01'; t = ymd(n); } setFrom(f); setTo(t); };
  const depts = useMemo(() => [...new Set(emps.map((e) => e.dept || e.department).filter(Boolean))], [emps]);
  const list = emps.filter((e) => (!dep || (e.dept || e.department) === dep) && (!q.trim() || (String(e.nameAr || '') + ' ' + String(e.nameEn || '') + ' ' + String(e.empNo || '')).toLowerCase().includes(q.trim().toLowerCase())));
  const selected = sel ? emps.filter((e) => sel[String(e.id)]) : emps;
  const toggle = (id, on) => setSel((s) => { const b = s || Object.fromEntries(emps.map((e) => [String(e.id), true])); return { ...b, [id]: on }; });
  async function run() {
    if (!from || !to || to < from) { toast(T('حدد فترة صحيحة (من ≤ إلى)', 'Choose a valid date range'), 'ter'); return null; }
    setBusy(true); setMsg('');
    try { const rows = await fetchRange(from, to); const r = compute(rows, from, to, selected, buildEmpMaps(emps), en ? 'en' : 'ar').filter((s) => FILTERS[fk].f(s, Math.max(1, parseInt(minN, 10) || 1))); const out = { r, from, to, mode, fk }; setRes(out); return out; }
    catch (e) { setMsg(String(e.message || e)); return null; } finally { setBusy(false); }
  }
  const hdrs = en ? ['#', 'Employee', 'Working days', 'Present', 'Late', 'Absent', 'Leave', 'Remote', 'Late (h/m)', 'Early exit (h/m)', 'No check-out', 'Hours', 'Attendance %'] : ['#', 'الموظف', 'أيام العمل', 'حاضر', 'متأخر', 'غائب', 'إجازة', 'عن بعد', 'إجمالي التأخير', 'خروج مبكر', 'بدون انصراف', 'الساعات', 'نسبة الحضور'];
  const sumRow = (s, i) => [i + 1, nameOf(s.e, en), s.expected, s.present, s.late, s.absent, s.leave, s.remote, fmtHM(s.lateMin, en), fmtHM(s.early, en), s.noOut, s.hours, s.rate == null ? '' : s.rate];
  const detHdr = en ? ['Date', 'Day', 'Status', 'Check-in', 'Check-out', 'Late (h/m)', 'Early exit (h/m)', 'Hours', 'Notes'] : ['التاريخ', 'اليوم', 'الحالة', 'دخول', 'خروج', 'تأخير', 'خروج مبكر', 'الساعات', 'ملاحظات'];
  const stL = (c) => (en ? ST_EN : ST_AR)[c] || c;
  const detRow = (d) => { const r = d.rec; let note = ''; if (r) { note = r.auto ? T('الجلسة الأخيرة أُغلقت تلقائيًا (بدون بصمة انصراف)', 'Last session auto-closed (no check-out)') : (r.noOut ? T('بدون بصمة انصراف', 'No check-out') : ''); if (r.sessions > 1) note = (note ? note + ' — ' : '') + r.sessions + T(' جلسات، الانصراف = آخر جلسة', ' sessions, check-out = last session'); } return [dispD(d.date), d.dow, stL(d.cls), r ? hm(r.in) : '', r ? hm(r.out) : '', r && d.cls === 'late' ? fmtHM(r.late, en) : '', r && r.early > 0 ? fmtHM(r.early, en) : '', r ? r.hours : '', note]; };
  const kp = (r) => { const t = { emps: r.length, present: 0, late: 0, absent: 0, leave: 0, remote: 0, lateMin: 0 }; r.forEach((s) => { t.present += s.present; t.late += s.late; t.absent += s.absent; t.leave += s.leave; t.remote += s.remote; t.lateMin += s.lateMin; }); return t; };
  async function doPrint() {
    const o = await run(); if (!o) return; if (!o.r.length) return toast(T('لا توجد بيانات للطباعة', 'Nothing to print'), 'ter');
    const k = kp(o.r), dir = en ? 'ltr' : 'rtl';
    const kk = '<div class="k">' + [[k.emps, T('موظف', 'Employees')], [k.present, T('حاضر', 'Present')], [k.late, T('متأخر', 'Late')], [k.absent, T('غائب', 'Absent')], [k.leave, T('إجازة', 'Leave')], [k.remote, T('عن بعد', 'Remote')], [fmtHM(k.lateMin, en), T('إجمالي التأخير', 'Total late')]].map((x) => '<div><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></div>').join('') + '</div>';
    const body = o.mode === 'det' ? o.r.map((s) => '<h4>' + esc(nameOf(s.e, en)) + ' — ' + esc(s.e.empNo || '') + '</h4><table><tr>' + detHdr.map((x) => '<th>' + esc(x) + '</th>').join('') + '</tr>' + s.days.filter((d) => d.cls !== 'off' || d.rec).map((d) => '<tr>' + detRow(d).map((x) => '<td>' + esc(x) + '</td>').join('') + '</tr>').join('') + '</table>').join('')
      : '<table><tr>' + hdrs.map((x) => '<th>' + esc(x) + '</th>').join('') + '</tr>' + o.r.map((s, i) => '<tr>' + sumRow(s, i).map((x, j) => '<td' + (j === 1 ? ' style="text-align:' + (en ? 'left' : 'right') + '"' : '') + '>' + esc(x) + '</td>').join('') + '</tr>').join('') + '</table>';
    const note = T('طريقة الحساب: يوم العمل = غير الجمعة/السبت والعطلات الرسمية وبعد تاريخ المباشرة ولا يشمل اليوم الحالي. الغياب = يوم عمل بدون بصمة وبدون إجازة معتمدة. التأخير والخروج المبكر من حساب النظام (الساعة المرنة وفترة السماح). السجلات المُقفلة تلقائيًا (بدون بصمة انصراف) لا تدخل في مجموع الساعات.', 'Method: a working day excludes Fri/Sat, official holidays, days before the hire date and today. Absent = working day with no punch and no approved leave. Late / early-exit minutes come from the system (flexible hours and grace). Auto-closed records (no check-out) are excluded from total hours.');
    const html = PCSS + '<div class="doc" dir="' + dir + '"><div class="t">' + T('تقرير الحضور والانصراف', 'Attendance Report') + '</div><div class="s">' + esc(T('من ', 'From ') + dispD(o.from) + T(' إلى ', ' to ') + dispD(o.to) + ' — ' + FILTERS[o.fk][en ? 'en' : 'ar']) + '</div>' + kk + body + '<div class="n">' + esc(note) + '</div></div>';
    printHtml(T('تقرير الحضور', 'Attendance report'), wrapLetterhead(settings && settings.letterhead, html), { dir, lang: en ? 'en' : 'ar' });
  }
  async function doXls() {
    const o = await run(); if (!o) return; if (!o.r.length) return toast(T('لا توجد بيانات للتصدير', 'Nothing to export'), 'ter');
    const s1 = [hdrs.slice(1).concat([T('متوسط وقت الدخول', 'Avg check-in')]), ...o.r.map((s, i) => sumRow(s, i).slice(1).concat([s.avgIn]))];
    const s2 = [[T('الموظف', 'Employee'), T('الرقم الوظيفي', 'Emp. no'), ...detHdr]];
    o.r.forEach((s) => s.days.filter((d) => d.cls !== 'off' || d.rec).forEach((d) => s2.push([nameOf(s.e, en), String(s.e.empNo || ''), ...detRow(d).map((v, i) => ((i === 7) && v !== '' ? Number(v) : v))])));
    download('attendance_' + o.from + '_to_' + o.to + '.xlsx', buildXlsx([{ name: T('ملخص', 'Summary'), rows: s1, widths: [26, 12, 10, 10, 10, 10, 10, 12, 14, 12, 10, 12, 16] }, { name: T('تفصيلي', 'Detail'), rows: s2, widths: [26, 12, 12, 12, 12, 10, 10, 12, 14, 10, 28] }], { rtl: !en }));
  }
  const fld = (l, c) => <div><label style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 600, display: 'block', marginBottom: 2 }}>{l}</label>{c}</div>;
  const k = res ? kp(res.r) : null;
  return (
    <div className="card" id="ariba117AttCard" style={{ padding: 12, marginTop: 12 }}>
      <div className="ct" style={{ marginBottom: 10 }}><i className="ti ti-report-analytics" /> {T('تقارير الحضور والانصراف', 'Attendance reports')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, alignItems: 'end' }}>
        {fld(T('من تاريخ', 'From'), <input type="date" id="A117F" style={{ width: '100%' }} value={from} onChange={(e) => setFrom(e.target.value)} />)}
        {fld(T('إلى تاريخ', 'To'), <input type="date" id="A117T" style={{ width: '100%' }} value={to} onChange={(e) => setTo(e.target.value)} />)}
        {fld(T('الفلتر', 'Filter'), <select id="A117Flt" style={{ width: '100%' }} value={fk} onChange={(e) => setFk(e.target.value)}>{Object.keys(FILTERS).map((x) => <option key={x} value={x}>{FILTERS[x][en ? 'en' : 'ar']}</option>)}</select>)}
        {fld(T('الحد الأدنى للأيام', 'Min. days'), <input type="number" id="A117N" min="1" style={{ width: '100%' }} value={minN} onChange={(e) => setMinN(e.target.value)} />)}
        {fld(T('نوع التقرير', 'Report type'), <select id="A117M" style={{ width: '100%' }} value={mode} onChange={(e) => setMode(e.target.value)}><option value="sum">{T('ملخص لكل موظف', 'Summary per employee')}</option><option value="det">{T('تفصيلي يومي', 'Daily detail')}</option></select>)}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
        {[['m0', T('هذا الشهر', 'This month')], ['m1', T('الشهر الماضي', 'Last month')], ['d7', T('آخر 7 أيام', 'Last 7 days')], ['y0', T('هذه السنة', 'This year')]].map(([id, l]) => <button key={id} className="btn bgr bsm" onClick={() => quick(id)}>{l}</button>)}
        <button className="btn bgr bsm" id="A117EmpBtn" onClick={() => setPanel(!panel)}><i className="ti ti-users" /> <span>{sel ? Object.values(sel).filter(Boolean).length + ' ' + T('موظف محدد', 'selected') : T('كل الموظفين', 'All employees')}</span></button>
      </div>
      {panel && <div style={{ border: '1px solid var(--bd)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}><input placeholder={T('بحث بالاسم أو الرقم الوظيفي', 'Search name or no.')} style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={dep} onChange={(e) => setDep(e.target.value)}><option value="">{T('كل الأقسام', 'All departments')}</option>{depts.map((d) => <option key={d}>{d}</option>)}</select>
          <button className="btn bgr bsm" onClick={() => setSel(null)}>{T('تحديد الكل', 'Select all')}</button><button className="btn bgr bsm" onClick={() => setSel({})}>{T('إلغاء الكل', 'Clear')}</button></div>
        <div style={{ maxHeight: 200, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: '2px 10px' }}>
          {list.map((e) => <label key={e.id} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12 }}><input type="checkbox" checked={!sel || !!sel[String(e.id)]} onChange={(ev) => toggle(String(e.id), ev.target.checked)} /> {nameOf(e, en)}</label>)}</div></div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn bpl bsm" id="A117Run" onClick={run}><i className="ti ti-search" /> {T('عرض التقرير', 'Show report')}</button>
        <button className="btn bgr bsm" id="A117Print" onClick={doPrint}><i className="ti ti-printer" /> {T('طباعة', 'Print')}</button><button className="btn bgr bsm" id="A117Xls" onClick={doXls}><i className="ti ti-file-spreadsheet" /> Excel</button></div>
      <div id="A117Out" style={{ marginTop: 10 }}>
        {busy && <div style={{ padding: 14, color: 'var(--mu)' }}>{T('جارٍ تحميل الحضور من السيرفر…', 'Loading attendance…')}</div>}
        {msg && <div style={{ padding: 14, color: 'var(--rd)' }}>{msg}</div>}
        {res && !busy && !res.r.length && <div style={{ padding: 16, textAlign: 'center', color: 'var(--mu)' }}>{T('لا توجد نتائج مطابقة للفلتر', 'No matching results')}</div>}
        {res && !busy && res.r.length > 0 && <div dir={en ? 'ltr' : 'rtl'}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{[[k.emps, T('موظف', 'Employees')], [k.present, T('حاضر', 'Present')], [k.late, T('متأخر', 'Late')], [k.absent, T('غائب', 'Absent')], [k.leave, T('إجازة', 'Leave')], [k.remote, T('عن بعد', 'Remote')], [fmtHM(k.lateMin, en), T('إجمالي التأخير', 'Total late')]].map(([v, l]) => <div key={l} style={{ background: 'var(--c2)', borderRadius: 8, padding: '6px 10px', textAlign: 'center', minWidth: 80 }}><div style={{ fontWeight: 800, fontSize: 15 }}>{v}</div><div style={{ fontSize: 10, color: 'var(--mu)' }}>{l}</div></div>)}</div>
          {res.mode === 'det' ? res.r.map((s) => <div key={s.e.id}><div style={{ fontWeight: 800, margin: '10px 0 4px' }}>{nameOf(s.e, en)} <span style={{ fontWeight: 400, color: 'var(--mu)', fontSize: 11 }}>{s.e.empNo || ''}</span></div><div className="tw"><table><tbody><tr>{detHdr.map((x) => <th key={x}>{x}</th>)}</tr>{s.days.filter((d) => d.cls !== 'off' || d.rec).map((d) => <tr key={d.date}>{detRow(d).map((x, i) => <td key={i}>{x}</td>)}</tr>)}</tbody></table></div></div>)
            : <div className="tw"><table><tbody><tr>{hdrs.map((x) => <th key={x}>{x}</th>)}</tr>{res.r.map((s, i) => <tr key={s.e.id}>{sumRow(s, i).map((x, j) => <td key={j}>{x}</td>)}</tr>)}</tbody></table></div>}
        </div>}
      </div>
    </div>
  );
}

export default function Attendance() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a);
  const { employees, locations, settings } = useApp(); const can = usePerm().edit('attendance');
  const emps = useMemo(() => employees.filter((e) => !e.isTerminated), [employees]);
  return (
    <div className="pg on" id="pg-att" style={{ padding: '12px 16px' }}>
      <div className="g2"><Daily T={T} en={en} emps={emps} locs={locations} can={can} /><Monthly T={T} en={en} emps={emps} /></div>
      <Reports T={T} en={en} emps={emps} settings={settings} />
    </div>
  );
}
