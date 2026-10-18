// أدوات مشتركة (تنسيق، تواريخ، هروب HTML) — منقولة من الدوال المساعدة في النظام القديم
export const fN = (n) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const fN0 = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
export const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const tod = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const fD = (d) => { if (!d) return '—'; const x = new Date(d); if (isNaN(x)) return String(d); return x.toLocaleDateString('en-GB'); };
export const ini = (n) => String(n || '؟').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('') || '؟';
export const shortName = (n, k = 3) => String(n || '').split(' ').slice(0, k).join(' ');
export const daysLeft = (dateStr, today = new Date()) => { if (!dateStr) return null; const d = new Date(dateStr); if (isNaN(d)) return null; return Math.round((d - today) / 86400000); };
export const isSaudiEmp = (e) => !!(e.isSaudi || e.saudi || ['سعودي', 'سعودية'].includes(String(e.nationality || e.nat || '').trim()));
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
export const pad2 = (n) => (n < 10 ? '0' : '') + n;
export const isoDate = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
// تنزيل ملف نصي/CSV/Blob
export function download(name, data, type = 'text/plain;charset=utf-8') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
/** تنبيهات استباقية (V142): إقامة ≤60، جواز ≤90، عقد ≤60، فترة التجربة ≤30 يوم */
const LIM = { iq: 60, pp: 90, ce: 60, pr: 30 };
const pdate = (s) => { const a = String(s || '').slice(0, 10).split('-'); if (a.length !== 3 || !a[0]) return null; const d = new Date(+a[0], +a[1] - 1, +a[2]); return isNaN(d.getTime()) ? null : d; };
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dTo = (d) => (d ? Math.round((d - today0()) / 86400000) : null);
export function collectAlerts(emps, en, noEos) {
  const out = [];
  emps.filter((e) => e && !e.isTerminated && !e.term && e.active !== false && !e.isHourly).forEach((e) => {
    const iq = pdate(e.iqamaExpiry || e.iqe), pp = pdate(e.passportExpiry || e.ppe); let ce = pdate(e.contractEnd || e.ce);
    const jn = pdate(e.contractJoin || e.cj || e.join_date); const dur = Number(e.contractDuration || e.dur) || 0;
    if (!ce && jn && dur > 0 && !/غير محدد|open|unlimited/i.test(String(e.contractNature || ''))) ce = new Date(jn.getFullYear(), jn.getMonth() + dur, jn.getDate());
    const push = (kind, label, d, lim) => { const n = dTo(d); if (n !== null && n <= lim) out.push({ e, kind, label, d, n }); };
    push('iq', en ? 'Iqama / ID expiry' : 'انتهاء الهوية / الإقامة', iq, LIM.iq); push('pp', en ? 'Passport expiry' : 'انتهاء الجواز', pp, LIM.pp); push('ce', en ? 'Contract end' : 'انتهاء العقد', ce, LIM.ce);
    if (!(noEos && noEos(e))) {
      const pe = pdate(e.probationEnd) || (jn ? new Date(jn.getFullYear(), jn.getMonth(), jn.getDate() + 90) : null), n2 = dTo(pe);
      if (pe && n2 !== null && n2 <= LIM.pr && n2 >= -7 && jn && (-dTo(jn)) <= 400) out.push({ e, kind: 'pr', label: en ? 'Probation end' : 'انتهاء فترة التجربة', d: pe, n: n2 });
    }
  });
  return out.sort((a, b) => a.n - b.n);
}
export const dmy = (d) => (d ? (('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear()) : '');
/** تنبيهات الوثائق (للشارة الجانبية): إقامة/جواز/تأمين طبي ≤ 90 يوم */
export function getAlerts(emps) {
  const al = [], today = new Date();
  emps.forEach((e) => {
    const iq = daysLeft(e.iqamaExpiry || e.iqe, today), pp = daysLeft(e.passportExpiry || e.ppe, today), ins = daysLeft(e.insuranceExpiry || e.ie, today);
    const name = e.nameAr || e.na || '';
    if (iq != null && iq <= 90) al.push({ name, type: 'الهوية / الإقامة', days: iq, date: e.iqamaExpiry || e.iqe || '' });
    if (pp != null && pp <= 90) al.push({ name, type: 'جواز السفر', days: pp, date: e.passportExpiry || e.ppe || '' });
    if (ins != null && ins <= 90) al.push({ name, type: 'التأمين الطبي', days: ins, date: e.insuranceExpiry || e.ie || '' });
  });
  return al.sort((a, b) => a.days - b.days);
}
