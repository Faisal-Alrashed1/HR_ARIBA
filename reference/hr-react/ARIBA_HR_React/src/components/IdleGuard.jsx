import { useEffect, useRef, useState } from 'react';
import * as auth from '../lib/auth.js';
import { IDLE_MS, WARN_MS } from '../lib/config.js';
import { T } from '../lib/i18n.js';

const card = { background: '#fff', color: '#111', borderRadius: 16, maxWidth: 380, width: '100%', padding: 22, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.4)' };
const bs = (p) => ({ flex: 1, padding: 11, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: p ? 'none' : '1px solid #ccc', background: p ? '#29B35E' : '#fff', color: p ? '#fff' : '#333' });
const fmt = (ms) => { let s = Math.max(0, Math.ceil(ms / 1000)); const m = Math.floor(s / 60); s %= 60; return m + ':' + (s < 10 ? '0' : '') + s; };

/** تنبيه الخمول: بعد 5 دقائق بدون نشاط يظهر عدّاد 3 دقائق (تمديد أو خروج) + تجديد الـJWT تلقائياً */
export default function IdleGuard() {
  const last = useRef(Date.now());
  const [left, setLeft] = useState(null);
  useEffect(() => {
    const mark = () => { if (left === null) last.current = Date.now(); };
    const evs = ['click', 'keydown', 'pointerdown', 'touchstart', 'scroll', 'wheel', 'mousemove'];
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true, capture: true }));
    const iv = setInterval(() => {
      if (!auth.isAuthed()) return;
      const idle = Date.now() - last.current;
      if (idle >= IDLE_MS + WARN_MS) { auth.signOut('idle'); return; }
      setLeft(idle >= IDLE_MS ? IDLE_MS + WARN_MS - idle : null);
    }, 1000);
    const tk = setInterval(() => auth.tick(() => Date.now() - last.current < IDLE_MS, null), 10000);
    const vis = () => { if (document.visibilityState === 'visible' && auth.isAuthed() && Date.now() - last.current >= IDLE_MS + WARN_MS) auth.signOut('idle'); };
    document.addEventListener('visibilitychange', vis);
    return () => { evs.forEach((e) => window.removeEventListener(e, mark, { capture: true })); clearInterval(iv); clearInterval(tk); document.removeEventListener('visibilitychange', vis); };
  }, [left]);
  if (left === null) return null;
  return (
    <div id="ariba-idle-prompt" role="alertdialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={card}>
        <div style={{ fontSize: 34 }}>⏳</div>
        <div style={{ fontWeight: 800, fontSize: 16, margin: '8px 0' }}>{T('هل ما زلت هنا؟', 'Are you still there?')}</div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>{T('لم نرصد أي نشاط منذ 5 دقائق. ستُغلق الجلسة تلقائيًا بعد:', 'No activity for 5 minutes. The session will close automatically in:')}</div>
        <div id="ax-idle-left" style={{ fontSize: 30, fontWeight: 900, color: '#b45309', direction: 'ltr', marginBottom: 16 }}>{fmt(left)}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={bs(0)} onClick={() => auth.signOut('manual')}>{T('تسجيل الخروج', 'Sign out')}</button>
          <button style={bs(1)} onClick={() => { last.current = Date.now(); setLeft(null); auth.refresh().then((ok) => { if (ok === false) auth.signOut('refresh_failed'); }); }}>{T('تمديد الجلسة', 'Extend session')}</button>
        </div>
      </div>
    </div>
  );
}
