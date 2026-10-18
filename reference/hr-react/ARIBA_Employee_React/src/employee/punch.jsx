import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { useEmp } from './EmpStore.jsx';
import { T, isEN, dOf, riyadhNow, secs, hav, pip } from './util.jsx';

/** حالة اليوم من سجلات السيرفر (كل الجلسات) */
export function todayState(attendance) {
  const d = riyadhNow().date;
  const rows = (attendance || []).filter((a) => dOf(a) === d && a.time_in).sort((a, b) => String(a.time_in).localeCompare(String(b.time_in)));
  const n = rows.length, open = rows.filter((r) => !r.time_out).pop();
  const outs = rows.filter((r) => r.time_out).map((r) => String(r.time_out)).sort(), lastOut = outs.length ? outs[outs.length - 1] : '';
  let closedSec = 0; rows.forEach((r) => { if (r.time_out) { const x = secs(r.time_out) - secs(r.time_in); if (x > 0) closedSec += x; } });
  return { rows, n, open, firstIn: n ? rows[0].time_in : '', lastOut, closedSec, late: !!n && rows[0].status === 'late' };
}
/** الانصراف المتوقع في الدوام المرن */
export function expectedOut(S0, att0) {
  const S = S0, rmd = att0 && att0.is_ramadan_today && att0.ramadan_flex_enabled;
  const att = rmd ? { ...att0, flexible_enabled: true, shift_hours: att0.ramadan_shift_hours, flex_window_start: att0.ramadan_window_start, flex_window_end: att0.ramadan_window_end } : att0;
  if (!att || !att.flexible_enabled || !S.firstIn) return null;
  const sh = Number(att.shift_hours) || 8; let e = secs(S.firstIn) + sh * 3600;
  if (S.late && att.flex_window_end) e = Math.min(e, secs(att.flex_window_end));
  return { sec: e, shift: sh * 3600 };
}
const nm = (l) => (isEN() ? (l.name_en || l.name) : l.name);

/** تقييم الموقع الحالي مقابل مواقع الموظف (نصف قطر + مضلعات) */
export function evalLoc(locations, pos, err) {
  if (err) return { state: 'denied', text: err.code === 1 ? T('فعّل صلاحية الموقع', 'Allow location access') : T('تعذر تحديد الموقع', 'Unable to detect location') };
  const ALL = (locations || []).filter((l) => l && l.type !== 'remote' && l.lat != null && l.lng != null);
  const L = ALL.filter((l) => !(Number(l.lat) === 0 && Number(l.lng) === 0));
  if (ALL.length && !L.length) return { state: 'out', text: T('إحداثيات موقع عملك غير مضبوطة', 'Your work location coordinates are not set') };
  if (!pos) return { state: 'loading', text: T('جاري تحديد موقعك…', 'Locating you…') };
  if (!L.length) return { state: 'gps', text: T('تم تحديد موقعك', 'Location detected') };
  let best = null, bd = 1e12; L.forEach((l) => { const d = hav(pos.lat, pos.lng, +l.lat, +l.lng); if (d < bd) { bd = d; best = l; } });
  let inside = bd <= (+best.radius_m || 200); const hit = ALL.find((l) => l.polygon && pip(pos.lat, pos.lng, l.polygon)); if (hit) { best = hit; inside = true; }
  const dist = bd >= 1000 ? (bd / 1000).toFixed(1) + T(' كم', ' km') : Math.round(bd) + T(' م', ' m');
  return inside ? { state: 'in', text: T('داخل نطاق: ', 'Inside: ') + nm(best) } : { state: 'out', text: T('خارج النطاق — أقرب موقع ', 'Outside — nearest ') + nm(best) + ' (' + dist + ')' };
}

/* موقع الجهاز مشترك بين الشاشات: استطلاع واحد كل 20 ثانية طالما هناك شاشة تستخدمه */
const GEO = { pos: null, err: null, users: 0, timer: null }; const geoSubs = new Set();
const geoEmit = () => geoSubs.forEach((f) => f());
function geoPoll() {
  if (!navigator.geolocation) { GEO.err = { code: 0 }; geoEmit(); return; }
  navigator.geolocation.getCurrentPosition((p) => { GEO.pos = { lat: p.coords.latitude, lng: p.coords.longitude }; GEO.err = null; geoEmit(); }, (e) => { GEO.err = e || { code: 0 }; geoEmit(); }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 });
}
export function useLocation(poll = true) {
  const { me } = useEmp();
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1); geoSubs.add(f);
    if (poll) { GEO.users++; if (GEO.users === 1) { geoPoll(); GEO.timer = setInterval(geoPoll, 20000); } else if (!GEO.pos) geoPoll(); }
    return () => { geoSubs.delete(f); if (poll) { GEO.users--; if (GEO.users <= 0) { GEO.users = 0; clearInterval(GEO.timer); GEO.timer = null; } } };
  }, [poll]);
  const loc = evalLoc(me && me.locations, GEO.pos, GEO.err);
  return { loc, pos: GEO.pos, refresh: geoPoll };
}

const CODES = { REMOTE_NOT_APPROVED: () => '❌ ' + T('أنت خارج مواقع العمل. للعمل عن بعد لازم يكون عندك طلب "عمل عن بعد" معتمد لليوم.', 'You are outside the work locations. Remote work needs an approved remote-work request for today.') };
function inMsg(m) {
  return m === 'OUTSIDE_GEOFENCE' ? '❌ ' + T('أنت خارج نطاق مواقع العمل المسموح بها', 'You are outside the allowed work locations')
    : m === 'TOO_EARLY_FOR_FLEXIBLE_WINDOW' ? '❌ ' + T('لسه بدري، الحضور المرن يبدأ لاحقًا حسب إعدادات الشركة', 'Too early — flexible check-in starts later per company settings')
    : m === 'TOO_LATE_FOR_FLEXIBLE_WINDOW' ? '❌ ' + T('الوقت متأخر — دوامك مش هيكمل جوه نطاق ساعات العمل المسموح بيها', 'Too late — your shift will not fit inside the allowed work window')
    : CODES[String(m || '').trim()] ? CODES[String(m).trim()]() : (m || T('تعذر تسجيل الحضور', 'Unable to check in'));
}
function getPos() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
  });
}
/** تنفيذ البصمة (حضور/انصراف) — التحقق الفعلي من النطاق يتم على السيرفر */
export function usePunch() {
  const { reload } = useEmp();
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const punch = useCallback(async (kind) => {
    if (lock.current) return false; lock.current = true; setBusy(true);
    try {
      const pos = await getPos();
      if (!pos) { toast('❌ ' + T('يجب السماح بتحديد الموقع', 'Location access is required'), 'ter'); return false; }
      try {
        const r = await rpc('ariba_attendance', { p_action: kind, p_lat: pos.lat, p_lng: pos.lng });
        if (kind === 'in') toast('✅ ' + T('تم تسجيل الحضور', 'Checked in') + (r && r.late_minutes > 0 ? ' — ' + T('تأخير ', 'Late ') + hmLate(r.late_minutes) : '') + (r && r.flexible_enabled && r.expected_checkout ? ' — ' + T('متوقع انصرافك الساعة ', 'Expected check-out ') + String(r.expected_checkout).slice(0, 5) : ''));
        else toast('🚪 ' + T('تم تسجيل الانصراف', 'Checked out') + (r && r.flexible_enabled && r.early_minutes > 0 ? ' — ' + T('قبل الموعد المتوقع بـ ', 'Before the expected time by ') + r.early_minutes + T(' دقيقة', ' min') : ''), 'tin');
        try { navigator.vibrate && navigator.vibrate(35); } catch { /* ignore */ }
        await reload(true); return true;
      } catch (e) { toast(kind === 'in' ? inMsg(e.message) : (e.message === 'OUTSIDE_GEOFENCE' ? inMsg(e.message) : (CODES[String(e.message || '').trim()] ? CODES[String(e.message).trim()]() : (e.message || T('تعذر تسجيل الانصراف', 'Unable to check out')))), 'ter'); return false; }
    } finally { setTimeout(() => { lock.current = false; setBusy(false); }, 600); }
  }, [reload]);
  return { punch, busy };
}
export function hmLate(min) { min = Math.round(min); if (min < 60) return min + T(' دقيقة', ' min'); const h = Math.floor(min / 60), m = min % 60; return h + T(' س', ' h') + (m ? ' ' + m + T(' د', ' m') : ''); }
