import { SVG } from './svgs.js';
import { getLang } from '../lib/i18n.js';

export const isEN = () => getLang() === 'en';
export const T = (ar, en) => (isEN() ? en : ar);

/** أيقونة SVG ثابتة (نصوص ثابتة من الكود وليست من المستخدم) */
export function Svg({ n, size, ...p }) {
  let h = SVG[n] || '';
  if (size) h = h.replace(/width="\d+" height="\d+"/, 'width="' + size + '" height="' + size + '"');
  return <em {...p} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: h }} />;
}

export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const money = (v) => num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + T('ر.س', 'SAR');
export const fD = (d) => { if (!d) return '—'; try { const x = new Date(d); if (isNaN(x)) return String(d); return x.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return String(d); } };
export const fDMY = (v) => { if (!v) return '—'; const x = new Date(v); if (isNaN(x)) return String(v); return String(x.getDate()).padStart(2, '0') + '/' + String(x.getMonth() + 1).padStart(2, '0') + '/' + x.getFullYear(); };
export const MN_AR = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const MN_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** الوقت الحالي بتوقيت الرياض (التاريخ + الساعة) */
export function riyadhNow() {
  const p = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
  if (p.hour === '24') p.hour = '00';
  return { date: p.year + '-' + p.month + '-' + p.day, h: +p.hour, m: +p.minute, s: +p.second };
}
export const secs = (t) => { if (!t) return null; const a = String(t).split(':'); return (+a[0]) * 3600 + (+a[1] || 0) * 60 + (parseFloat(a[2]) || 0); };
export const hm = (t) => (t ? String(t).slice(0, 5) : '');
export const fmtHM = (sec) => { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return h + T('س ', 'h ') + ('0' + m).slice(-2) + T('د', 'm'); };
export const dOf = (a) => String(a.attendance_date || a.date || '').slice(0, 10);
export function hav(a, b, c, d) { const R = 6371000, r = Math.PI / 180, x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2); return 2 * R * Math.asin(Math.sqrt(x * x + Math.cos(a * r) * Math.cos(c * r) * y * y)); }
/** نقطة داخل مضلع [[lat,lng],…] */
export function pip(la, ln, poly) { if (!Array.isArray(poly) || poly.length < 3) return false; let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const yi = +poly[i][0], xi = +poly[i][1], yj = +poly[j][0], xj = +poly[j][1]; if (((yi > la) !== (yj > la)) && (ln < (xj - xi) * (la - yi) / (yj - yi) + xi)) ins = !ins; } return ins; }

/** الاسم الأول + اسم العائلة مع مراعاة الأسماء المركبة (عبد الله…) */
export function shortName(n) {
  const t = String(n || '').trim().split(/\s+/).filter(Boolean); if (t.length <= 1) return t[0] || '';
  let first = t[0]; if (/^(عبد|عبدال|أبو|ابو|أم|ام|Abdul|Abd|Abu|Umm)$/i.test(first) && t.length > 2) first = t[0] + ' ' + t[1];
  const last = t[t.length - 1]; if (first.indexOf(' ') > 0 && t.length <= 2) return first;
  return first + ' ' + last;
}
export const greet = (h) => (h < 12 ? T('صباح الخير', 'Good morning') : h < 17 ? T('مساء الخير', 'Good afternoon') : T('مساء الخير', 'Good evening'));

/** أنواع الطلبات (الألوان والأيقونات كما في النسخة القديمة) */
export const LVL = {
  annual: { ar: 'سنوية', en: 'Annual Leave', icon: 'ti-sun', color: '#f59e0b' },
  sick: { ar: 'مرضية', en: 'Sick Leave', icon: 'ti-stethoscope', color: '#ef4444' },
  emergency: { ar: 'اضطرارية', en: 'Emergency Leave', icon: 'ti-urgent', color: '#f97316' },
  death: { ar: 'وفاة', en: 'Bereavement Leave', icon: 'ti-candle', color: '#6366f1' },
  marriage: { ar: 'زواج', en: 'Marriage Leave', icon: 'ti-heart', color: '#ec4899' },
  maternity: { ar: 'أمومة', en: 'Maternity Leave', icon: 'ti-baby-carriage', color: '#ec4899' },
  paternity: { ar: 'أبوة', en: 'Paternity Leave', icon: 'ti-man', color: '#8b5cf6' },
  umrah: { ar: 'عمرة', en: 'Umrah Leave', icon: 'ti-moon', color: '#10b981' },
  hajj: { ar: 'حج', en: 'Hajj Leave', icon: 'ti-star', color: '#8b5cf6' },
  remote: { ar: 'عن بعد', en: 'Remote Work', icon: 'ti-home-laptop', color: '#3b82f6' },
  perm: { ar: 'استئذان', en: 'Permission', icon: 'ti-clock-hour-4', color: '#06b6d4' },
  perm_mat: { ar: 'استئذان أمومة', en: 'Maternity Permission', icon: 'ti-baby-carriage', color: '#f472b6' },
  early_leave: { ar: 'خروج مبكر', en: 'Early Exit', icon: 'ti-door-exit', color: '#f97316' },
  unpaid: { ar: 'إجازة بدون راتب', en: 'Unpaid Leave', icon: 'ti-calendar-off', color: '#f59e0b' },
  salary_advance: { ar: 'طلب راتب مقدم', en: 'Salary Advance', icon: 'ti-cash-banknote', color: '#10b981' },
  iban_change: { ar: 'تغيير الآيبان', en: 'IBAN Change', icon: 'ti-building-bank', color: '#0ea5e9' },
  profile_edit: { ar: 'تعديل بيانات', en: 'Profile Edit', icon: 'ti-user-edit', color: '#8b5cf6' },
  advance: { ar: 'سلفة', en: 'Advance', icon: 'ti-cash', color: '#10b981' },
  mission: { ar: 'مهمة خارجية', en: 'External Assignment', icon: 'ti-briefcase', color: '#8b5cf6' },
  forgot_punch: { ar: 'نسيان بصمة', en: 'Forgot to punch', icon: 'ti-fingerprint', color: '#0ea5e9' },
};
export const lvName = (t) => { const v = LVL[t]; return v ? (isEN() ? v.en : v.ar) : (t === 'overtime' ? T('عمل إضافي', 'Overtime') : String(t || T('طلب', 'Request'))); };
export const PERM_TYPES = ['perm', 'perm_mat', 'early_leave'];

/** عدد أيام العمل بين تاريخين (الأحد–الخميس) مع استبعاد الإجازات الرسمية (وتشمل المدة days) */
export function workdays(from, to, holidays) {
  const hs = {};
  (holidays || []).forEach((h) => { if (!h || !h.date) return; const st = new Date(h.date + 'T00:00:00Z'); if (isNaN(st)) return; const span = Math.max(1, Number(h.days) || 1); for (let i = 0; i < span; i++) { const d = new Date(st); d.setUTCDate(d.getUTCDate() + i); hs[d.toISOString().slice(0, 10)] = true; } });
  let n = 0; const d = new Date(from + 'T00:00:00Z'), en = new Date(to + 'T00:00:00Z');
  if (isNaN(d) || isNaN(en)) return 0;
  while (d <= en) { const w = d.getUTCDay(), ds = d.toISOString().slice(0, 10); if (w >= 0 && w <= 4 && !hs[ds]) n++; d.setUTCDate(d.getUTCDate() + 1); }
  return n;
}
export const calendarDays = (from, to) => Math.round((new Date(to) - new Date(from)) / 86400000) + 1;

export function fileToData(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, mime: file.type || 'application/octet-stream', data: r.result, size: file.size });
    r.onerror = reject; r.readAsDataURL(file);
  });
}
export const MAX_ATT = 12582912;
export function ago(ts) {
  const d = new Date(ts); if (isNaN(d)) return ''; const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return T('الآن', 'just now'); if (s < 3600) return T('منذ ' + Math.floor(s / 60) + ' د', Math.floor(s / 60) + 'm ago'); if (s < 86400) return T('منذ ' + Math.floor(s / 3600) + ' س', Math.floor(s / 3600) + 'h ago');
  if (s < 172800) return T('أمس', 'yesterday'); return d.toLocaleDateString(isEN() ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
