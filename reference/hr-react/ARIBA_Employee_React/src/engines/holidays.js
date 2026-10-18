import { rt } from './runtime.js';
import * as C from './country.js';

export const ymd = (x) => [x.getFullYear(), String(x.getMonth() + 1).padStart(2, '0'), String(x.getDate()).padStart(2, '0')].join('-');
export function holidayDatesForYear(year) {
  const y = Number(year) || new Date().getFullYear(), out = [];
  (rt.holidays || []).forEach((h) => {
    const base = new Date(h.date || ''); if (isNaN(base)) return;
    let start;
    if (h.recurring) start = new Date(y, base.getMonth(), base.getDate());
    else { if (base.getFullYear() !== y) return; start = new Date(base); }
    for (let i = 0; i < Math.max(1, Number(h.days) || 1); i++) { const d = new Date(start); d.setDate(d.getDate() + i); out.push(ymd(d)); }
  });
  return new Set(out);
}
export function isOfficialHoliday(d) {
  const x = d instanceof Date ? new Date(d) : new Date(d); if (isNaN(x)) return false;
  return holidayDatesForYear(x.getFullYear()).has(ymd(x));
}
export function isLeaveWorkday(d) {
  const x = d instanceof Date ? new Date(d) : new Date(d); if (isNaN(x)) return false;
  const day = x.getDay();
  if (C.isEG()) return C.isWorkdayEG(day);
  return day !== 5 && day !== 6;
}
export function countLeaveWorkdays(fromDate, toDate) {
  const start = fromDate instanceof Date ? new Date(fromDate) : new Date(fromDate);
  const end = toDate instanceof Date ? new Date(toDate) : new Date(toDate);
  if (isNaN(start) || isNaN(end) || start > end) return 0;
  start.setHours(0, 0, 0, 0); end.setHours(0, 0, 0, 0);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) if (isLeaveWorkday(d) && !isOfficialHoliday(d)) count++;
  return count;
}
export const countAnnualLeaveDays = countLeaveWorkdays;
