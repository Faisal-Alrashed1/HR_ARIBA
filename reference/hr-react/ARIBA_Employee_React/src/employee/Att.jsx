import { useEffect, useState } from 'react';
import { useEmp } from './EmpStore.jsx';
import { useLang } from '../lib/i18n.js';
import { T, isEN, riyadhNow, hm, dOf } from './util.jsx';
import { todayState, useLocation, usePunch } from './punch.jsx';
import { useAppNav } from './nav.jsx';
import { rpc } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';

const STL = { present: ['حاضر', 'Present'], late: ['متأخر', 'Late'], remote: ['عن بعد', 'Remote'], absent: ['غائب', 'Absent'], leave: ['إجازة', 'Leave'] };
const stName = (s) => { const x = STL[s]; return x ? T(x[0], x[1]) : (s || '—'); };

function RangeLookup() {
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const [from, setFrom] = useState(iso(Date.now() - 30 * 86400000)), [to, setTo] = useState(iso(Date.now()));
  const [res, setRes] = useState(null);
  const go = async () => {
    if (!from || !to) { toast(T('حدد الفترة من وإلى', 'Select from and to'), 'ter'); return; }
    setRes({ loading: true });
    try { const d = await rpc('ariba_my_attendance_range', { p_from: from, p_to: to }); setRes({ rows: Array.isArray(d) ? d : (d && d.rows) || [] }); }
    catch (e) { setRes({ err: String((e && e.message) || e) }); }
  };
  const t5 = (t) => (t ? String(t).slice(0, 5) : '—');
  return (
    <div className="card" id="V93_CARD">
      <div className="card-title">🔍 {T('استعلام عن حضور بفترة محددة', 'Attendance lookup for a period')}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <input type="date" id="V93_FROM" value={from} onChange={(e) => setFrom(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
        <input type="date" id="V93_TO" value={to} onChange={(e) => setTo(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
        <button className="btn btn-primary" id="V93_GO" onClick={go}>{T('بحث', 'Search')}</button>
      </div>
      <div id="V93_RESULTS">
        {res && res.loading && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 12, fontSize: 12 }}>{T('جاري البحث...', 'Searching...')}</div>}
        {res && res.err && <div style={{ textAlign: 'center', color: '#c0392b', padding: 12, fontSize: 12 }}>{res.err}</div>}
        {res && res.rows && !res.rows.length && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 12, fontSize: 12 }}>{T('لا يوجد سجل حضور في هذه الفترة', 'No attendance records in this period')}</div>}
        {res && res.rows && res.rows.map((a, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bd)', fontSize: 11.5 }}>
            <span>{a.date}</span><span dir="ltr">{t5(a.time_in)} → {t5(a.time_out)}</span><span>{Number(a.hours || 0).toFixed(1)} {T('س', 'h')}</span>
            <span style={{ fontWeight: 700, color: a.status === 'late' ? '#c0392b' : '#0a7a3f' }}>{a.status === 'late' ? T('متأخر', 'Late') : T('حاضر', 'Present')}</span>
          </div>))}
      </div>
    </div>
  );
}

/** تبويب الحضور: الساعة + حالة الموقع + حالة اليوم + سجل آخر 31 يوم */
export default function Att() {
  useLang();
  const { me } = useEmp(); const nav = useAppNav();
  const { loc } = useLocation(true); const { punch, busy } = usePunch();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);
  if (!me) return null;
  const S = todayState(me.attendance), en = isEN();
  const all = (me.attendance || []).filter((a) => a.time_in), by = {};
  all.forEach((a) => { (by[dOf(a)] = by[dOf(a)] || []).push(a); });
  const dates = Object.keys(by).sort().reverse().slice(0, 31);
  const dotCol = loc.state === 'in' || loc.state === 'gps' ? 'var(--gr)' : (loc.state === 'out' || loc.state === 'denied' || loc.state === 'na') ? 'var(--rd)' : 'var(--am)';
  const btnS = { marginTop: 10, width: '100%' };
  void riyadhNow;
  return (
    <div id="attTab">
      <div className="att-big">
        <div className="att-time" id="liveClock" dir="ltr">{now.toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Riyadh' })}</div>
        <div className="att-date">{now.toLocaleDateString(en ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Riyadh' })}</div>
      </div>
      <div className="loc-badge"><div className="loc-dot" style={{ background: dotCol }} /><span id="locTxt" style={{ color: dotCol }}>{loc.state === 'loading' ? loc.text : '📍 ' + loc.text}</span></div>
      <div className="card">
        <div className="card-title">📌 {T('حالة الحضور اليوم', "Today's attendance status")}</div>
        {!S.n && <><div className="att-status att-none">{T('لم تسجل حضورك بعد', 'You have not checked in yet')}</div><button className="btn btn-success" id="btnIn" style={btnS} disabled={busy} onClick={() => punch('in')}>📍 {T('تسجيل الحضور', 'Check in')}</button></>}
        {S.n > 0 && S.open && <>
          <div className="att-status att-in">✅ {T('حضور', 'Checked in')} — {hm(S.firstIn)}{S.n > 1 ? ' (' + T('جلسة حالية من ', 'current session from ') + hm(S.open.time_in) + ')' : ''}</div>
          {S.lastOut && S.n > 1 && <div style={{ fontSize: 11, color: 'var(--mu)', textAlign: 'center', margin: '4px 0' }}>{T('رجعت للعمل بعد انصراف الساعة ', 'You returned after a check-out at ')}{hm(S.lastOut)}</div>}
          <button className="btn btn-danger" id="btnOut" style={btnS} disabled={busy} onClick={() => punch('out')}>🚪 {T('تسجيل الانصراف', 'Check out')}</button></>}
        {S.n > 0 && !S.open && <>
          <div className="att-status att-in">🚪 {T('آخر انصراف', 'Last check-out')} — {hm(S.lastOut)}</div>
          <div style={{ fontSize: 11, color: 'var(--mu)', textAlign: 'center', margin: '4px 0', lineHeight: 1.7 }}>{T('انصرفت بالخطأ؟ تقدر ترجع تسجل حضور تاني، وبيتحسب انصرافك على آخر مرة بتسجل فيها انصراف.', 'Checked out by mistake? You can check in again; your check-out counts as the last time you check out.')}</div>
          <button className="btn btn-success" id="btnBack" style={btnS} disabled={busy} onClick={() => punch('in')}>↩ {T('رجوع للعمل — تسجيل حضور مرة أخرى', 'Back to work — check in again')}</button></>}
        {S.n > 1 && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--mu)' }}>{T('جلسات اليوم:', "Today's sessions:")} {S.rows.map((r, i) => <span key={i} dir="ltr"> {i > 0 ? ' | ' : ''}{hm(r.time_in)} → {r.time_out ? hm(r.time_out) : '…'}</span>)}</div>}
        <button type="button" id="btnForgot" onClick={() => nav.openForgot()} style={{ width: '100%', marginTop: 8, background: 'transparent', border: '1px solid var(--bd)', color: 'var(--mu)', borderRadius: 8, padding: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>⚠️ {T('نسيت البصمة / مهمة خارجية', 'Forgot to punch / external assignment')}</button>
      </div>
      <div className="card">
        <div className="card-title">📅 {T('سجل آخر 31 يوم', 'Last 31 days log')}</div>
        {!dates.length && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 15 }}>{T('لا يوجد سجل', 'No records')}</div>}
        {dates.map((d) => {
          const rs = by[d].slice().sort((a, b) => String(a.time_in).localeCompare(String(b.time_in))), last = rs[rs.length - 1], st = rs[0].status || 'present';
          return <div key={d} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, padding: '7px 0', borderBottom: '1px solid var(--bd)', fontSize: 11 }}><span>{d}</span><span dir="ltr">{hm(rs[0].time_in)} → {last.time_out ? hm(last.time_out) : '…'}{rs.length > 1 ? ' (×' + rs.length + ')' : ''}</span><span>{stName(st)}</span></div>;
        })}
      </div>
    <RangeLookup />
    </div>
  );
}
