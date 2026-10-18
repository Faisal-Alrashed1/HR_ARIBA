import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc } from '../lib/api.js';
import { toast } from './Toast.jsx';
import { useLang } from '../lib/i18n.js';
import { T, ago } from '../employee/util.jsx';
import { useNavigate } from 'react-router-dom';

const BELL = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
const KIC = {
  template: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  request: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  ok: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.5 9.5"/></svg>',
  no: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
};
const iconKind = (n) => { const t = String(n.title || ''), k = String(n.kind || ''); if (k === 'template') return 'template'; if (k === 'request') return 'request'; if (/⚠|رفض|اعترض|reject|object/i.test(t)) return 'no'; return 'ok'; };

/** جرس الإشعارات: عدّاد + لوحة + إشعار فوري عند ورود جديد (v118/v140) */
export default function HrBell() {
  useLang();
  const nav = useNavigate();
  const [items, setItems] = useState([]), [unread, setUnread] = useState(0), [open, setOpen] = useState(false), [err, setErr] = useState(''), [loading, setLoading] = useState(false), [ring, setRing] = useState(false);
  const known = useRef(null); const btn = useRef(null); const [pos, setPos] = useState({ top: 56 });

  const refresh = useCallback(async () => {
    try {
      const r = await rpc('ariba_my_notifications', { p_limit: 40 }); setErr('');
      const its = (r && r.items) || [], un = its.filter((n) => !n.is_read).map((n) => n.id);
      let fresh = []; if (known.current !== null) fresh = its.filter((n) => !n.is_read && !known.current.includes(n.id));
      known.current = known.current === null ? un : known.current.concat(un.filter((i) => !known.current.includes(i)));
      setItems(its); setUnread(Math.max(Number(r && r.unread) || 0, un.length));
      if (fresh.length) {
        setRing(true); setTimeout(() => setRing(false), 1000);
        try { navigator.vibrate && navigator.vibrate([60, 40, 60]); } catch { /* ignore */ }
        toast('🔔 ' + fresh[0].title + (fresh.length > 1 ? ' (+' + (fresh.length - 1) + ')' : ''), 'tin');
      }
    } catch (e) { setErr(String((e && e.message) || e)); }
  }, []);
  useEffect(() => { setLoading(true); refresh().finally(() => setLoading(false)); const iv = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 3000); const vis = () => document.visibilityState === 'visible' && refresh(); document.addEventListener('visibilitychange', vis); return () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); }; }, [refresh]);
  useEffect(() => {
    if (!open) return undefined;
    const c = (e) => { if (!e.target.closest('#a9Panel') && !e.target.closest('#a9Bell')) setOpen(false); }, k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', c); document.addEventListener('keydown', k); return () => { document.removeEventListener('click', c); document.removeEventListener('keydown', k); };
  }, [open]);

  const toggle = () => { if (!open && btn.current) setPos({ top: Math.round(btn.current.getBoundingClientRect().bottom + 8) }); setOpen((o) => !o); if (!open) refresh(); };
  const markIds = async (ids) => { try { await rpc('ariba_mark_notifications_read', { p_ids: ids && ids.length ? ids : null }); } catch { refresh(); } };
  const markAll = () => { setItems((a) => a.map((n) => ({ ...n, is_read: true }))); known.current = (known.current || []).concat(items.map((n) => n.id)); setUnread(0); markIds(null); };
  const openItem = (n) => {
    if (!n.is_read) { setItems((a) => a.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))); setUnread((u) => Math.max(0, u - 1)); markIds([n.id]); }
    setOpen(false);
    const k = String(n.kind || ''), st = String(n.stage || '');
    void st; if (k === 'template' || k === 'template_decision') nav('/forms'); else nav('/lv');
  };
  const sp = { dir: document.documentElement.dir };
  return (
    <>
      <button type="button" id="a9Bell" ref={btn} className={'a9-bell ib' + (ring ? ' ring' : '')} aria-label={T('الإشعارات', 'Notifications')} title={unread > 0 ? T('لديك ' + unread + ' إشعار جديد', 'You have ' + unread + ' new notification' + (unread > 1 ? 's' : '')) : T('الإشعارات', 'Notifications')} onClick={(e) => { e.stopPropagation(); toggle(); }}>
        <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: BELL }} /><span className={'a9-badge' + (unread > 0 ? ' on' : '')} id="a9Badge">{unread > 99 ? '99+' : unread}</span>
      </button>
      <div id="a9Panel" className={open ? 'on' : ''} role="dialog" style={{ top: pos.top }} {...sp} onClick={(e) => e.stopPropagation()}>
        <div className="a9-h"><b>{T('الإشعارات', 'Notifications')}</b>{unread > 0 && <span className="a9-new">{unread} {T('جديد', 'new')}</span>}
          <button type="button" className="a9-mk" id="a9MarkAll" disabled={unread === 0} onClick={markAll}>{T('تعليم الكل كمقروء', 'Mark all as read')}</button><button type="button" className="a9-x" id="a9Close" aria-label={T('إغلاق', 'Close')} onClick={() => setOpen(false)}>×</button></div>
        <div className="a9-l">
          {err && !items.length ? <div className="a9-e">{err}</div> : loading && !items.length ? <div className="a9-e">{T('جاري التحميل…', 'Loading…')}</div> : !items.length ? <div className="a9-e">{T('لا توجد إشعارات.', 'No notifications.')}</div>
            : items.map((n) => { const ic = iconKind(n); return (
              <div key={n.id} className={'a9-i' + (n.is_read ? '' : ' un')} data-id={n.id} onClick={() => openItem(n)}>
                <div className={'a9-ic ' + ic} dangerouslySetInnerHTML={{ __html: KIC[ic] }} />
                <div style={{ flex: 1, minWidth: 0 }}><div className="a9-t">{n.title}</div>{n.body && <div className="a9-b">{n.body}</div>}<div className="a9-m">{ago(n.created_at)}</div></div>
                {!n.is_read && <span className="a9-dot" />}
              </div>); })}
        </div>
      </div>
    </>
  );
}
