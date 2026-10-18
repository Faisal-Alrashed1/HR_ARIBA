import { useEffect, useState } from 'react';
let push = () => {};
/** toast(msg, 'tin'|'ter') — نفس أنواع الإشعارات في النظام القديم */
/** رسائل الأخطاء التقنية → عربي مفهوم */
export function friendly(m) {
  m = String(m == null ? '' : m);
  const f = m.match(/Could not find the function public\.([a-z0-9_]+)/i);
  if (f) return 'هذه الميزة تحتاج تحديث قاعدة البيانات: نفّذ ملفات SQL الجديدة في Supabase (الدالة ' + f[1] + ')';
  if (/NOT_AUTHORIZED|INVALID_SESSION/.test(m)) return 'الجلسة غير صالحة أو لا تملك الصلاحية — سجّل الخروج ثم ادخل من جديد';
  return m;
}
let last = { m: '', t: 0 };
export function toast(msg, kind = 'tin') { const m = friendly(msg); const n = Date.now(); if (m === last.m && n - last.t < 4000) return; last = { m, t: n }; push({ msg: m, kind, id: Math.random() }); }
export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    push = (t) => { setItems((a) => [...a, t]); setTimeout(() => setItems((a) => a.filter((x) => x.id !== t.id)), 3800); };
    return () => { push = () => {}; };
  }, []);
  return <div id="TC">
    {items.map((t, i) => <div key={t.id} className={'toast on ' + t.kind} role="status">{t.msg}</div>)}
  </div>;
}
