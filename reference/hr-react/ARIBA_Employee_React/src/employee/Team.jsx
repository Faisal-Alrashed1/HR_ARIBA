import { useEffect, useState } from 'react';
import { useEmp } from './EmpStore.jsx';
import { rpc } from '../lib/api.js';
import { TeamTasks } from '../pages/team/index.jsx';
import { useLang } from '../lib/i18n.js';
import { T } from './util.jsx';
import MgrTeam from './MgrTeam.jsx';

const FB = 'var(--bp,#014D3D)';
const AR_LATIN = { 'ا':'a','أ':'a','إ':'i','آ':'aa','ء':'','ؤ':'u','ئ':'e','ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh','د':'d','ذ':'dh','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','ة':'a','و':'w','ي':'y','ى':'a','ـ':'' };
function latinize(value) { return String(value || '').replace(/[\u064B-\u065F\u0670]/g,'').split('').map((c) => AR_LATIN[c] ?? c).join('').replace(/\s+/g,' ').trim(); }

/** تبويب فريقي: قائمة المرؤوسين + مدخل المهام والاجتماعات */
export default function Team() {
  useLang();
  const { me, hasApproval, queue } = useEmp();
  const [open, setOpen] = useState(false);
  if (!me) return null;
  const team = me.team || []; const en = document.documentElement.lang === 'en' || document.documentElement.dir === 'ltr';
  return (
    <div id="teamTab">
      <div className="card">
        <div className="card-title">👥 {T('فريقي', 'My team')}</div>
        {!team.length && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 20 }}>{T('لم يتم تحديد موظفين تحت إدارتك.', 'No employees are assigned under you.')}</div>}
        {team.map((x, i) => { const arName = x.nameAr || x.na || x.name || ''; const enName = x.nameEn || x.name_en || x.ne || ''; const n = en ? (enName || latinize(arName)) : (arName || enName); const arJob = x.jobTitleAr || x.job_title_ar || x.jobTitle || x.jt || ''; const enJob = x.jobTitleEn || x.job_title_en || x.job_en || ''; const j = en ? (enJob || latinize(arJob)) : (arJob || enJob); return (
          <div key={x.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(59,130,246,.13)', color: 'var(--bl)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{n.charAt(0)}</div>
            <div><div style={{ fontWeight: 700, fontSize: 12 }}>{n}</div><div style={{ fontSize: 10, color: 'var(--mu)' }}>{j}</div></div>
          </div>); })}
        {hasApproval && queue.length > 0 && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--am)' }}>⏳ {T('لديك ' + queue.length + ' طلب بانتظار موافقتك — تبويب الموافقات', 'You have ' + queue.length + ' request(s) awaiting approval — see Approvals')}</div>}
      </div>
      <MgrTeam />
      <div className="card">
        <div className="card-title">📅 {T('المهام والاجتماعات / توفر الفريق', 'Tasks, meetings & team availability')}</div>
        <button type="button" id="TV_OPEN" className="btn btn-primary" style={{ width: '100%', background: FB }} onClick={() => setOpen(true)}>{T('فتح', 'Open')}</button>
      </div>
      {open && <TasksOverlay onClose={() => setOpen(false)} />}
    </div>
  );
}

/** نافذة كاملة الشاشة للمهام والاجتماعات (v: ariba-team-avail) */
export function TasksOverlay({ onClose }) {
  useLang();
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div id="TV_OVERLAY" dir={document.documentElement.dir} style={{ position: 'fixed', inset: 0, zIndex: 2147483640, background: '#f4f4f4', color: '#111', overflow: 'auto', ['--c2']: '#fff', ['--tx']: '#111', ['--bd']: '#ddd', ['--mu']: '#666', ['--gr']: FB, fontFamily: 'inherit' }}>
      <div style={{ background: FB, color: '#fff', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 2 }}>
        <b>{T('المهام والاجتماعات / توفر الفريق', 'Tasks, meetings & team availability')}</b>
        <button type="button" id="TV_CL" onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.5)', color: '#fff', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>{T('إغلاق', 'Close')}</button>
      </div>
      <div style={{ padding: 14, maxWidth: 1000, margin: '0 auto' }}><TeamTasks /></div>
    </div>
  );
}

/** زر عائم يعرض عدد المهام المفتوحة في الوارد ويفتح النافذة */
export function TaskFab() {
  useLang();
  const [n, setN] = useState(0), [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    const load = async () => { try { const r = await rpc('ariba_my_tasks', { p_scope: 'inbox' }); if (live) setN(((r && r.items) || []).filter((t) => t.status === 'open').length); } catch { /* ignore */ } };
    load(); const iv = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
    return () => { live = false; clearInterval(iv); };
  }, [open]);
  return (
    <>
      <button type="button" id="TV_FAB" aria-label={T('المهام والاجتماعات', 'Tasks & meetings')} onClick={() => setOpen(true)}
        style={{ position: 'fixed', bottom: 96, insetInlineStart: 14, zIndex: 2147483000, display: 'flex', alignItems: 'center', gap: 6, background: FB, color: '#fff', border: 0, borderRadius: 24, padding: '10px 14px', fontWeight: 700, fontSize: 13, boxShadow: '0 6px 18px rgba(0,0,0,.28)', cursor: 'pointer', fontFamily: 'inherit' }}>
        📅 {T('المهام', 'Tasks')}{n > 0 && <b style={{ background: '#e5484d', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{n}</b>}
      </button>
      {open && <TasksOverlay onClose={() => setOpen(false)} />}
    </>
  );
}
