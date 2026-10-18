// تجميع بصمات الحضور وحساب الأيام (حاضر/متأخر/غائب/إجازة/عن بعد) — منقول من تقارير الحضور V117
import { rt } from './runtime.js';
import { scheduleFor, evalPeriods } from '../lib/schedule.js';
import { isLeaveWorkday, isOfficialHoliday } from './holidays.js';
import { leaveEmployeeId, leaveDateValue, leaveTypeValue } from './leave.js';

const pad = (n) => (n < 10 ? '0' : '') + n;
export const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parseD = (s) => { const p = String(s).slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
export const secs = (t) => { if (!t) return null; const p = String(t).split(':'); return (+p[0]) * 3600 + (+p[1] || 0) * 60 + (parseFloat(p[2]) || 0); };
export const hm = (t) => (t ? String(t).slice(0, 5) : '');
const r2 = (n) => Math.round(n * 100) / 100;
/** دقائق → نص (ساعة ودقيقة) */
export function fmtHM(m, en) {
  m = Math.round(Number(m) || 0); if (m <= 0) return en ? '0' : '0 دقيقة';
  const h = Math.floor(m / 60), r = m % 60;
  if (en) return ((h ? h + 'h ' : '') + (r ? r + 'm' : '')).trim() || '0m';
  if (!h) return r + ' دقيقة';
  let hs = h === 1 ? 'ساعة' : (h === 2 ? 'ساعتان' : h + ' ساعات'); if (h > 10) hs = h + ' ساعة';
  return hs + (r ? ' و' + r + ' دقيقة' : '');
}
export const ST_AR = { present: 'حاضر', late: 'متأخر', absent: 'غائب', leave: 'إجازة', remote: 'عن بعد', off: 'عطلة', pending: 'لم يُسجَّل بعد' };
export const ST_EN = { present: 'Present', late: 'Late', absent: 'Absent', leave: 'Leave', remote: 'Remote', off: 'Day off', pending: 'Not yet' };

export function buildEmpMaps(all) {
  const byId = {}, byNo = {}; all.forEach((e) => { byId[String(e.id)] = e; if (e.empNo != null && e.empNo !== '') byNo[String(e.empNo)] = e; });
  return { all, byId, byNo };
}
/** تجميع بصمات اليوم الواحد (أكثر من جلسة) في سجل واحد */
export function groupRows(rows, maps) {
  const g = {};
  rows.forEach((r) => { const e = maps.byId[String(r.emp_id)] || maps.byNo[String(r.emp_id)]; if (!e) return; const k = String(e.id) + '|' + String(r.date).slice(0, 10); (g[k] = g[k] || { e, date: String(r.date).slice(0, 10), rows: [] }).rows.push(r); });
  Object.keys(g).forEach((k) => {
    const x = g[k]; let rs = x.rows.slice().sort((a, b) => (secs(a.time_in) == null ? 1e9 : secs(a.time_in)) - (secs(b.time_in) == null ? 1e9 : secs(b.time_in)));
    const seenIn = {}, uniq = [];
    rs.forEach((r) => { if (r.time_in && seenIn[String(r.time_in)] !== undefined) { const q = uniq[seenIn[String(r.time_in)]]; if ((secs(r.time_out) || 0) > (secs(q.time_out) || 0)) uniq[seenIn[String(r.time_in)]] = r; } else { if (r.time_in) seenIn[String(r.time_in)] = uniq.length; uniq.push(r); } });
    rs = uniq;
    const first = rs[0], withIn = rs.filter((r) => r.time_in), isAuto = (r) => /إغلاق تلقائي|auto/i.test(String(r.notes || ''));
    let hours = 0, anyAuto = false;
    withIn.forEach((r) => { const au = isAuto(r); if (au) anyAuto = true; if (r.time_out && !au) { const dd = (secs(r.time_out) - secs(r.time_in)) / 3600; if (dd > 0) hours += dd; } });
    const lastS = withIn.length ? withIn[withIn.length - 1] : first, finalReal = !!(lastS && lastS.time_out && !isAuto(lastS));
    const anyLate = rs.some((r) => r.status === 'late'), st = first.status || 'present';
    x.in = first.time_in || null; x.out = finalReal ? lastS.time_out : null;
    x.status = (st === 'absent' || st === 'leave' || st === 'remote') ? st : ((first.status === 'late' || (anyLate && withIn.length <= 1)) ? 'late' : 'present');
    x.late = (first.status === 'late' || st === 'late') ? (Number(first.late_minutes) || 0) : 0;
    x.early = finalReal ? (Number(lastS.early_minutes) || 0) : 0; x.hours = r2(hours); x.open = !finalReal && !!(lastS && !lastS.time_out); x.auto = anyAuto;
    x.noOut = !!first.time_in && !finalReal; x.sessions = withIn.length;
    // الفترات (دخول/خروج متعددة) + الجدول المُطبَّق (رسمي / رمضان)
    x.periods = withIn.map((r) => ({ in: hm(r.time_in), out: r.time_out && !isAuto(r) ? hm(r.time_out) : '', auto: isAuto(r) }));
    if (rt.schedule && rt.schedule.enabled) {
      const sch = scheduleFor(x.date, rt.schedule), ev = evalPeriods(x.periods, sch); x.sched = sch; x.shortfall = ev.shortfall;
      if (x.status === 'present' || x.status === 'late') { x.late = ev.late; x.status = ev.late > 0 ? 'late' : 'present'; if (finalReal) x.early = ev.early; }
    }
    x.loc = first.location_name || ''; x.notes = rs.map((r) => r.notes).filter(Boolean).join(' | ');
  });
  return g;
}
export function leaveMap() {
  const m = {};
  (rt.leaves || []).forEach((l) => {
    if (String(l.status || '').toLowerCase() !== 'approved') return;
    const eid = String(leaveEmployeeId(l)); if (!eid) return;
    const f = leaveDateValue(l, 'from'); let t = leaveDateValue(l, 'to'); if (!f) return; t = t || f; const type = leaveTypeValue(l);
    const a = parseD(f), b = parseD(t); for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) { (m[eid] = m[eid] || {})[ymd(d)] = (type === 'remote' ? 'remote' : 'leave'); }
  });
  return m;
}
export const isOff = (d) => { try { return !isLeaveWorkday(d) || isOfficialHoliday(d); } catch { return d.getDay() === 5 || d.getDay() === 6; } };
const joinOf = (e) => e.contractJoin || e.join || e.joinDate || e.join_date || '';

export function compute(rows, from, to, emps, maps, lang = 'ar') {
  const grp = groupRows(rows, maps), lv = leaveMap(), today = ymd(new Date()), out = [], a = parseD(from), b = parseD(to);
  const dayName = (d) => d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', { weekday: 'long' });
  emps.forEach((e) => {
    const jn = joinOf(e), id = String(e.id), days = [];
    const s = { e, expected: 0, present: 0, late: 0, absent: 0, leave: 0, remote: 0, offWorked: 0, lateMin: 0, early: 0, earlyDays: 0, noOut: 0, hours: 0, inSum: 0, inCnt: 0 };
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
      const ds = ymd(d); if (ds > today) break; if (jn && ds < String(jn).slice(0, 10)) continue;
      const g = grp[id + '|' + ds], off = isOff(d); let cls, rec = null;
      if (g) { rec = g; cls = g.status; } else if (off) cls = 'off'; else if (lv[id] && lv[id][ds]) cls = lv[id][ds]; else if (ds === today) cls = 'pending'; else cls = 'absent';
      if (rec && (cls === 'present' || cls === 'late' || cls === 'remote') && off) s.offWorked++;
      if (cls !== 'off' && cls !== 'pending' && !(off && rec)) s.expected++;
      if (cls === 'present') s.present++; else if (cls === 'late') s.late++; else if (cls === 'absent') s.absent++; else if (cls === 'leave') s.leave++; else if (cls === 'remote') s.remote++;
      if (rec) { if (cls === 'late') s.lateMin += rec.late; if (rec.early > 0) { s.early += rec.early; s.earlyDays++; } if (rec.noOut && ds < today) s.noOut++; s.hours += rec.hours; if (rec.in) { s.inSum += secs(rec.in); s.inCnt++; } }
      days.push({ date: ds, dow: dayName(d), cls, rec });
    }
    s.hours = r2(s.hours); s.days = days;
    const base = s.expected - s.leave; s.rate = base > 0 ? Math.round(((s.present + s.late + s.remote) / base) * 1000) / 10 : null;
    s.avgIn = s.inCnt ? ((x) => { const m = Math.round(x / 60); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); })(s.inSum / s.inCnt) : '';
    out.push(s);
  });
  return out;
}
export const FILTERS = {
  all: { ar: 'كل الموظفين', en: 'All employees', f: () => true },
  late: { ar: 'المتأخرون فقط', en: 'Late only', f: (s, n) => s.late >= n },
  absent: { ar: 'الغائبون فقط', en: 'Absent only', f: (s, n) => s.absent >= n },
  early: { ar: 'عندهم خروج مبكر', en: 'Early exit', f: (s, n) => s.earlyDays >= n },
  noout: { ar: 'بدون بصمة انصراف', en: 'Missing check-out', f: (s, n) => s.noOut >= n },
  remote: { ar: 'عن بعد', en: 'Remote', f: (s, n) => s.remote >= n },
  leave: { ar: 'في إجازة', en: 'On leave', f: (s, n) => s.leave >= n },
  clean: { ar: 'ملتزمون (بدون تأخير أو غياب)', en: 'Fully compliant', f: (s) => s.late === 0 && s.absent === 0 && (s.present + s.remote) > 0 },
};
