import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { rpc } from '../../lib/api.js';
import { toast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import PromptModal from '../../components/PromptModal.jsx';
import { isLeaveWorkday } from '../../engines/holidays.js';
import { leaveEmployeeId, leaveDateValue } from '../../engines/leave.js';

const LT = { annual: ['سنوية', 'Annual'], sick: ['مرضية', 'Sick'], emergency: ['طارئة', 'Emergency'], death: ['وفاة', 'Bereavement'], marriage: ['زواج', 'Marriage'], maternity: ['وضع', 'Maternity'], paternity: ['أبوة', 'Paternity'], umrah: ['عمرة', 'Umrah'], hajj: ['حج', 'Hajj'], remote: ['عمل عن بعد', 'Remote'] };
const D = (s) => { const p = String(s).slice(0, 10).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); };
const iso = (d) => d.toISOString().slice(0, 10);
const addD = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const fmt = (s) => { if (!s) return ''; const p = String(s).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
const isWork = (s) => { const d = D(s); return isLeaveWorkday(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
const nextWork = (s) => { let d = addD(s, 1), i = 0; while (!isWork(d) && i++ < 10) d = addD(d, 1); return d; };
/* دمج الإجازات المتتالية (الإجازة التي تبدأ بعد نهاية السابقة بيوم عمل تُعامل كواحدة؛ والعمل عن بعد ليس غيابًا) */
function merge(ls) {
  const a = (ls || []).filter((l) => l.type !== 'remote').map((l) => ({ from: String(l.from).slice(0, 10), to: String(l.to).slice(0, 10), types: [l.type] })).sort((x, y) => (x.from < y.from ? -1 : 1)), out = [];
  a.forEach((l) => { const p = out[out.length - 1]; if (p && l.from <= nextWork(p.to)) { if (l.to > p.to) p.to = l.to; p.types = p.types.concat(l.types); } else out.push(l); });
  out.forEach((l) => { l.days = Math.round((D(l.to) - D(l.from)) / 864e5) + 1; }); return out;
}
function stateOf(e, day) {
  const m = merge(e.leaves); let cur = null, nxt = null;
  m.forEach((l) => { if (!cur && l.from <= day && day <= l.to) cur = l; else if (!nxt && l.from > day) nxt = l; });
  return { cur, nxt, st: cur ? 'leave' : (nxt && nxt.from <= addD(day, 14) ? 'soon' : 'avail') };
}
const Badge = ({ c, children }) => { const bg = { g: 'rgba(34,197,94,.15)', r: 'rgba(239,68,68,.15)', a: 'rgba(245,158,11,.18)', b: 'rgba(59,130,246,.15)' }[c], fg = { g: '#16a34a', r: '#dc2626', a: '#d97706', b: '#2563eb' }[c]; return <span style={{ background: bg, color: fg, padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>; };
const Btn = ({ pri, ...p }) => <button type="button" {...p} style={{ cursor: 'pointer', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', border: '1px solid ' + (pri ? 'transparent' : 'var(--bd,#ccc)'), background: pri ? 'var(--gr,#014D3D)' : 'transparent', color: pri ? '#fff' : 'var(--tx,#111)', ...(p.style || {}) }} />;
const FIX = (m) => (/Could not find the function|schema cache|PGRST202/i.test(m) ? 'ميزة المهام لم تُفعَّل على السيرفر بعد: شغّل ملف 5_run_in_SQL_Editor_team_tasks_and_fixes.sql في Supabase (SQL Editor) مرة واحدة.' : m);

const EMPTY = [], NOAPP = {};
export function TeamTasks() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a);
  const app = useApp() || NOAPP; const employees = app.employees || EMPTY, leaves = app.leaves || EMPTY;   // في تطبيق الموظف لا يوجد AppProvider
  const [S, setS] = useState({ items: null, today: '', allowed: false, inbox: null, sent: null, err: '', loading: false });
  const [tab, setTab] = useState('team'), [q, setQ] = useState(''), [f, setF] = useState('all'), [sel, setSel] = useState({}), [compose, setCompose] = useState(null), [decl, setDecl] = useState(null);
  const localTeam = useCallback(() => {
    const lv = {}; leaves.forEach((l) => { if (String(l.status || '').toLowerCase() !== 'approved') return; const id = leaveEmployeeId(l), fr = String(leaveDateValue(l, 'from') || '').slice(0, 10), t = String(leaveDateValue(l, 'to') || fr).slice(0, 10); if (!fr) return; (lv[id] = lv[id] || []).push({ from: fr, to: t, days: Math.round((D(t) - D(fr)) / 864e5) + 1, type: l.type || 'annual' }); });
    return { items: employees.filter((e) => !e.isTerminated && !e.term && e.active !== false).map((e) => ({ id: String(e.id), name: e.nameAr || e.nameEn, job: e.jobTitle, dept: e.dept || e.department, leaves: lv[String(e.id)] || [] })), today: iso(new Date(Date.now() + 3 * 36e5)), allowed: true };
  }, [employees, leaves]);
  const refresh = useCallback(async () => {
    setS((s) => ({ ...s, loading: true })); let patch = {}, err = '';
    try { const r = await rpc('ariba_team_availability', {}); patch = { items: r.items || [], today: String(r.today || '').slice(0, 10) || iso(new Date()), allowed: !!r.allowed }; }
    catch (e) { err = FIX(String(e.message || e)); patch = localTeam(); err = T('(عرض من بيانات البرنامج المحلية — الإرسال يحتاج تشغيل ملف SQL على السيرفر) ', '(Local data view — sending needs the SQL file on the server) ') + err; }
    try { const a = await rpc('ariba_my_tasks', { p_scope: 'inbox' }), b = await rpc('ariba_my_tasks', { p_scope: 'sent' }); patch.inbox = a.items || []; patch.sent = b.items || []; } catch (e) { err = err || FIX(String(e.message || e)); patch.inbox = patch.inbox || []; patch.sent = patch.sent || []; }
    setS((s) => ({ ...s, ...patch, err, loading: false }));
  }, [localTeam]); // eslint-disable-line
  useEffect(() => { refresh(); const iv = setInterval(refresh, 90000); return () => clearInterval(iv); }, [refresh]);
  const day = S.today;
  const rows = useMemo(() => (S.items || []).map((e) => ({ e, s: stateOf(e, day) })), [S.items, day]);
  const c = { avail: 0, leave: 0, soon: 0 }; rows.forEach((r) => { c[r.s.st]++; });
  const shown = rows.filter((r) => (f === 'all' || (f === 'avail' ? r.s.st !== 'leave' : r.s.st === f)) && (!q.trim() || (r.e.name + ' ' + (r.e.job || '') + ' ' + (r.e.dept || '')).toLowerCase().includes(q.trim().toLowerCase())));
  const n = Object.keys(sel).filter((k) => sel[k]).length;
  const lt = (t) => (LT[t] ? LT[t][en ? 1 : 0] : t);
  const openN = (S.inbox || []).filter((t) => t.status === 'open').length;
  const tabs = [['team', T('الفريق والتوفر', 'Team availability')], ['inbox', T('الوارد', 'Inbox') + (openN ? ' (' + openN + ')' : '')], ['sent', T('المرسل', 'Sent')]];
  async function act(t, st, note) { try { await rpc('ariba_task_update', { p_id: t.id, p_status: st, p_note: note || null }); toast('✓ ' + T('تم', 'Done')); refresh(); } catch (e) { toast(FIX(String(e.message || e)), 'ter'); } }
  const stBadge = (o) => (o === 'open' ? <Badge c="a">{T('مفتوحة', 'Open')}</Badge> : o === 'done' ? <Badge c="g">{T('تم', 'Done')}</Badge> : o === 'accepted' ? <Badge c="g">{T('مقبول', 'Accepted')}</Badge> : o === 'declined' ? <Badge c="r">{T('اعتذار', 'Declined')}</Badge> : <Badge c="r">{T('ملغي', 'Cancelled')}</Badge>);
  const whenTxt = (t) => (t.kind === 'meeting' && t.start_at ? new Date(t.start_at).toLocaleString(en ? 'en-GB' : 'ar-EG', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }) : (t.due_date ? T('الموعد: ', 'Due: ') + fmt(t.due_date) : ''));
  const card = (t, inbox) => (
    <div key={t.id} style={{ border: '1px solid var(--bd,#ddd)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><div style={{ fontWeight: 800 }}>{t.kind === 'meeting' ? '📅 ' : '✓ '}{t.title}</div><div>{stBadge(t.status)}</div></div>
      <div style={{ fontSize: 12, color: 'var(--mu,#666)', margin: '3px 0' }}>{inbox ? T('من: ', 'From: ') + (t.from_name || '') : T('إلى: ', 'To: ') + (t.to_name || '')} • {whenTxt(t)}{t.location ? ' • ' + t.location : ''}</div>
      {t.details && <div style={{ fontSize: 12.5, margin: '4px 0', whiteSpace: 'pre-wrap' }}>{t.details}</div>}
      {t.response_note && <div style={{ fontSize: 11.5, color: 'var(--mu,#666)' }}>{t.response_note}</div>}
      {inbox && t.status === 'open' && <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>{t.kind === 'meeting' ? <><Btn pri onClick={() => act(t, 'accepted')}>{T('قبول', 'Accept')}</Btn><Btn onClick={() => setDecl(t)}>{T('اعتذار', 'Decline')}</Btn></> : <Btn pri onClick={() => act(t, 'done')}>{T('تم الإنجاز', 'Done')}</Btn>}</div>}
      {!inbox && t.status === 'open' && <div style={{ display: 'flex', gap: 6, marginTop: 6 }}><Btn onClick={() => act(t, 'cancelled')}>{T('إلغاء', 'Cancel')}</Btn></div>}
    </div>);
  const list = (arr, inbox) => (!arr ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--mu,#666)' }}>{T('جارٍ التحميل…', 'Loading…')}</div> : !arr.length ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--mu,#666)' }}>{T('لا شيء هنا', 'Nothing here')}</div> : arr.map((t) => card(t, inbox)));
  return (
    <div id="TV_BODY">
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {tabs.map(([k, l]) => <button key={k} type="button" className="TV_TAB" onClick={() => setTab(k)} style={{ cursor: 'pointer', padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', border: '1px solid var(--bd,#ccc)', background: tab === k ? 'var(--gr,#014D3D)' : 'transparent', color: tab === k ? '#fff' : 'inherit' }}>{l}</button>)}
        <span style={{ flex: 1 }} /><Btn id="TV_REF" onClick={refresh}>⟳ {T('تحديث', 'Refresh')}</Btn>
      </div>
      {S.err && <div style={{ background: 'rgba(239,68,68,.12)', color: '#b91c1c', padding: '8px 10px', borderRadius: 8, fontSize: 12, marginBottom: 8 }}>{S.err}</div>}
      {tab === 'team' && (!S.items ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--mu,#666)' }}>{T('جارٍ التحميل…', 'Loading…')}</div> : !S.allowed ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--mu,#666)' }}>{T('هذه الصفحة للمدراء والإدارة (من لهم موظفون تابعون).', 'This view is for managers (people with direct reports).')}</div> : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <Badge c="g">{T('متاح: ', 'Available: ')}{c.avail + c.soon}</Badge><Badge c="r">{T('في إجازة: ', 'On leave: ')}{c.leave}</Badge><Badge c="a">{T('سيبدأ إجازة خلال 14 يوم: ', 'Leaving within 14 days: ')}{c.soon}</Badge>
            <input id="TV_Q" placeholder={T('بحث بالاسم أو الوظيفة…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 140, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--bd,#ccc)', background: 'transparent', color: 'inherit', fontFamily: 'inherit' }} />
            <select id="TV_F" value={f} onChange={(e) => setF(e.target.value)} style={{ padding: 7, borderRadius: 8, border: '1px solid var(--bd,#ccc)', background: 'var(--c2,#fff)', color: 'inherit', fontFamily: 'inherit' }}>{[['all', T('الكل', 'All')], ['avail', T('المتاحون', 'Available')], ['leave', T('في إجازة', 'On leave')], ['soon', T('سيبدؤون إجازة قريباً', 'Leaving soon')]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn id="TV_ALL" onClick={() => setSel(Object.fromEntries(shown.map((r) => [r.e.id, true])))}>{T('تحديد الظاهرين', 'Select shown')}</Btn><Btn id="TV_NONE" onClick={() => setSel({})}>{T('إلغاء التحديد', 'Clear')}</Btn>
            <Btn pri id="TV_TASK" onClick={() => (n ? setCompose('task') : toast(T('اختر موظفاً على الأقل', 'Select at least one employee'), 'ter'))}>✓ {T('إرسال مهمة', 'Send task')}{n ? ' (' + n + ')' : ''}</Btn>
            <Btn pri id="TV_MEET" onClick={() => (n ? setCompose('meeting') : toast(T('اختر موظفاً على الأقل', 'Select at least one employee'), 'ter'))}>📅 {T('دعوة اجتماع', 'Invite to meeting')}{n ? ' (' + n + ')' : ''}</Btn>
          </div>
          <div style={{ overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><tbody>
            {!shown.length && <tr><td style={{ padding: 20, textAlign: 'center', color: 'var(--mu,#666)' }}>{T('لا نتائج', 'No results')}</td></tr>}
            {shown.map(({ e, s }) => (
              <tr key={e.id} style={{ borderTop: '1px solid var(--bd,#e5e5e5)' }}>
                <td style={{ padding: '9px 6px', width: 30 }}><input type="checkbox" className="TV_CK" checked={!!sel[e.id]} onChange={(ev) => setSel({ ...sel, [e.id]: ev.target.checked })} /></td>
                <td style={{ padding: '9px 6px' }}><div style={{ fontWeight: 700 }}>{e.name}</div><div style={{ fontSize: 11.5, color: 'var(--mu,#666)' }}>{[e.job, e.dept].filter(Boolean).join(' • ')}</div></td>
                <td style={{ padding: '9px 6px' }}>{s.st === 'leave' ? <Badge c="r">{T('في إجازة', 'On leave')}</Badge> : s.st === 'soon' ? <Badge c="a">{T('متاح — إجازة قريبة', 'Available — leave soon')}</Badge> : <Badge c="g">{T('متاح', 'Available')}</Badge>}</td>
                <td style={{ padding: '9px 6px', fontSize: 12, color: 'var(--mu,#555)' }}>
                  {s.st === 'leave' ? <>{T('من ', 'From ')}{fmt(s.cur.from)}{T(' إلى ', ' to ')}{fmt(s.cur.to)} — <b>{s.cur.days}{T(' يوم', ' days')}</b> ({lt(s.cur.types[0])}) • {T('يعود للعمل: ', 'Back on: ')}<b>{fmt(nextWork(s.cur.to))}</b></>
                    : s.nxt ? <>{T('إجازته القادمة: من ', 'Next leave: ')}{fmt(s.nxt.from)}{T(' إلى ', ' to ')}{fmt(s.nxt.to)} — {s.nxt.days}{T(' يوم', ' days')} ({lt(s.nxt.types[0])}) • {T('يعود: ', 'Back: ')}{fmt(nextWork(s.nxt.to))}</> : null}
                </td></tr>))}
          </tbody></table></div>
        </>))}
      {tab === 'inbox' && list(S.inbox, true)}
      {tab === 'sent' && list(S.sent, false)}
      {compose && <Compose kind={compose} ids={Object.keys(sel).filter((k) => sel[k])} items={S.items || []} T={T} onClose={() => setCompose(null)} onSent={() => { setCompose(null); setSel({}); refresh(); }} />}
      <PromptModal open={!!decl} title={T('سبب الاعتذار', 'Decline reason')} label={T('اختياري', 'Optional')} confirmText={T('اعتذار', 'Decline')} onClose={() => setDecl(null)} onConfirm={(v) => { const t = decl; setDecl(null); act(t, 'declined', v); }} />
    </div>
  );
}

function Compose({ kind, ids, items, T, onClose, onSent }) {
  const [f, setF] = useState({ title: '', details: '', start: '', end: '', loc: '', due: '' }); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const names = ids.map((i) => (items.find((x) => x.id === i) || {}).name || i);
  const bad = kind === 'meeting' && f.start ? ids.filter((i) => { const e = items.find((x) => x.id === i); return e && stateOf(e, f.start.slice(0, 10)).cur; }).map((i) => items.find((x) => x.id === i).name) : [];
  async function send(force) {
    if (!f.title.trim()) return toast(T('اكتب العنوان', 'Enter a title'), 'ter');
    const a = { p_to: ids, p_kind: kind, p_title: f.title.trim(), p_details: f.details.trim() || null };
    if (kind === 'meeting') { if (!f.start) return toast(T('حدد وقت الاجتماع', 'Pick the meeting time'), 'ter'); if (bad.length && !force) return setAsk(true); a.p_start = f.start + ':00+03:00'; if (f.end) a.p_end = f.end + ':00+03:00'; a.p_location = f.loc.trim() || null; } else a.p_due = f.due || null;
    setBusy(true);
    try { const r = await rpc('ariba_send_task', a); toast('✓ ' + T('أُرسلت إلى ', 'Sent to ') + ((r && r.sent) || ids.length) + T(' موظف', ' employee(s)')); onSent(); } catch (er) { setBusy(false); toast(FIX(String(er.message || er)), 'ter'); }
  }
  return (
    <>
      <Modal open onClose={onClose} width={460} title={kind === 'meeting' ? '📅 ' + T('دعوة اجتماع', 'Meeting invitation') : '✓ ' + T('إرسال مهمة', 'Send a task')}
        footer={<div className="mf"><button className="btn" onClick={onClose}>{T('إلغاء', 'Cancel')}</button><button className="btn bpl" id="TC_OK" disabled={busy} onClick={() => send(false)}>{T('إرسال', 'Send')}</button></div>}>
        <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 10 }}>{T('إلى: ', 'To: ')}{names.join('، ')}</div>
        <div className="fg">
          <div className="ff"><label>{T('العنوان', 'Title')}</label><input id="TC_T" value={f.title} onChange={set('title')} /></div>
          <div className="ff"><label>{T('التفاصيل', 'Details')}</label><textarea id="TC_D" rows={3} value={f.details} onChange={set('details')} /></div>
          {kind === 'meeting' ? <>
            <div><label>{T('بداية الاجتماع', 'Start')}</label><input type="datetime-local" id="TC_S" value={f.start} onChange={set('start')} /></div>
            <div><label>{T('نهاية الاجتماع (اختياري)', 'End (optional)')}</label><input type="datetime-local" value={f.end} onChange={set('end')} /></div>
            <div className="ff"><label>{T('المكان / الرابط', 'Location / link')}</label><input value={f.loc} onChange={set('loc')} /></div></>
            : <div><label>{T('الموعد النهائي (اختياري)', 'Due date (optional)')}</label><input type="date" id="TC_DUE" value={f.due} onChange={set('due')} /></div>}
        </div>
        {bad.length > 0 && <div id="TC_W" style={{ fontSize: 12, color: '#b45309', marginTop: 8 }}>{T('⚠️ في إجازة وقت الاجتماع: ', '⚠️ On leave at that time: ')}{bad.join('، ')}</div>}
      </Modal>
      <PromptModal open={ask} noInput title={T('تنبيه', 'Warning')} message={T('⚠️ بعض المدعوين في إجازة وقت الاجتماع: ', '⚠️ Some invitees are on leave: ') + bad.join('، ') + ' — ' + T('هل تكمل الإرسال؟', 'Send anyway?')} confirmText={T('إرسال', 'Send')} onClose={() => setAsk(false)} onConfirm={() => { setAsk(false); send(true); }} />
    </>
  );
}

export default function Team() {
  const en = useLang() === 'en';
  return <div className="pg on" id="pg-team" style={{ padding: '12px 16px' }}><div className="card" style={{ padding: 14 }}><div className="ct" style={{ marginBottom: 10 }}><i className="ti ti-users-group" /> {en ? 'Team availability, tasks & meetings' : 'توفر الفريق والمهام والاجتماعات'}</div><TeamTasks /></div></div>;
}
