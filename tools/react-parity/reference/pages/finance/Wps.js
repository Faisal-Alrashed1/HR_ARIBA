// Pure functions from ARIBA_HR_React/src/pages/finance/Wps.jsx (lines 8-14, verbatim).
export const BANKS = { '05': 'مصرف الإنماء', 10: 'البنك الأهلي السعودي', 15: 'بنك البلاد', 20: 'بنك الرياض', 30: 'البنك العربي الوطني', 45: 'البنك السعودي البريطاني (ساب)', 55: 'البنك السعودي الفرنسي', 60: 'بنك الجزيرة', 65: 'البنك السعودي للاستثمار', 80: 'مصرف الراجحي' };
export function ibanOK(s) {
  s = String(s || '').replace(/\s+/g, '').toUpperCase(); if (!/^SA\d{22}$/.test(s)) return false;
  const r = s.slice(4) + s.slice(0, 4); let n = ''; for (let i = 0; i < r.length; i++) { const c = r.charCodeAt(i); n += c >= 65 ? (c - 55) : String.fromCharCode(c); }
  let rem = 0; for (let j = 0; j < n.length; j++) rem = (rem * 10 + (+n[j])) % 97; return rem === 1;
}
export const idOK = (s) => /^\d{10}$/.test(String(s || '').trim());
