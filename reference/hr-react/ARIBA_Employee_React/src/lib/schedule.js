// جدول الدوام: الرسمي + رمضان (تلقائي بالتقويم الهجري أم القرى أو بتواريخ يدوية) — يُطبَّق على حساب الحضور
export const DEFAULT_SCHEDULE = {
  enabled: false,
  official: { start: '08:00', end: '17:00', hours: 8, grace: 15 },
  ramadan: { start: '09:00', end: '15:00', hours: 6, grace: 15 },
  ramadanAuto: true,   // رمضان تلقائياً حسب التقويم الهجري
  ramadanFrom: '', ramadanTo: '', // تواريخ يدوية (تتغلب على التلقائي إن وُجدت)
};
export function normSchedule(s) {
  const d = DEFAULT_SCHEDULE; s = s && typeof s === 'object' ? s : {};
  return { enabled: !!s.enabled, official: { ...d.official, ...(s.official || {}) }, ramadan: { ...d.ramadan, ...(s.ramadan || {}) },
    ramadanAuto: s.ramadanAuto !== false, ramadanFrom: s.ramadanFrom || '', ramadanTo: s.ramadanTo || '' };
}
const fmtH = (() => { try { return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { month: 'numeric', timeZone: 'UTC' }); } catch { return null; } })();
/** هل التاريخ (YYYY-MM-DD) داخل رمضان؟ */
export function isRamadan(ds, cfg) {
  const c = normSchedule(cfg), d = String(ds).slice(0, 10);
  if (c.ramadanFrom && c.ramadanTo) return d >= c.ramadanFrom && d <= c.ramadanTo;
  if (!c.ramadanAuto || !fmtH) return false;
  try { const p = d.split('-'); return parseInt(fmtH.format(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12))), 10) === 9; } catch { return false; }
}
/** الجدول المُطبَّق على تاريخ معيّن: {kind:'official'|'ramadan', start,end,hours,grace} */
export function scheduleFor(ds, cfg) { const c = normSchedule(cfg), r = isRamadan(ds, c); return { kind: r ? 'ramadan' : 'official', ...(r ? c.ramadan : c.official) }; }
const toMin = (t) => { if (!t) return null; const p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
/** تقييم يوم من فترات [{in,out}] مقابل جدول: ساعات العمل = مجموع الفترات المغلقة */
export function evalPeriods(periods, sch) {
  let worked = 0; periods.forEach((p) => { const a = toMin(p.in), b = toMin(p.out); if (a != null && b != null && b > a) worked += (b - a) / 60; });
  const first = periods.length ? toMin(periods[0].in) : null; const last = periods.length ? periods[periods.length - 1] : null; const lastOut = last ? toMin(last.out) : null;
  const st = toMin(sch.start), en = toMin(sch.end), grace = Number(sch.grace) || 0;
  const late = first != null && st != null && first > st + grace ? first - st : 0;
  const early = lastOut != null && en != null && lastOut < en ? en - lastOut : 0;
  const need = Number(sch.hours) || 0;
  return { worked: Math.round(worked * 100) / 100, late, early, shortfall: Math.max(0, Math.round((need - worked) * 100) / 100) };
}
