// تفقيط المبالغ بالعربي (ريال سعودي) — نفس منطق النسخة القديمة
const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
function three(n) {
  n = Math.floor(n); const h = Math.floor(n / 100), r = n % 100, out = [];
  if (h) out.push(hundreds[h]);
  if (r >= 10 && r < 20) out.push(teens[r - 10]);
  else { const t = Math.floor(r / 10), o = r % 10, parts = []; if (o) parts.push(ones[o]); if (t) parts.push(tens[t]); if (parts.length) out.push(parts.join(' و')); }
  return out.join(' و');
}
function int(n) {
  n = Math.floor(n); if (n === 0) return 'صفر';
  const groups = [{ v: Math.floor(n / 1000000) % 1000, s: 'مليون', d: 'مليونان', p: 'ملايين' }, { v: Math.floor(n / 1000) % 1000, s: 'ألف', d: 'ألفان', p: 'آلاف' }, { v: n % 1000, s: '', d: '', p: '' }];
  const parts = [];
  groups.forEach((g) => { if (!g.v) return; let t = three(g.v); if (g.s) { if (g.v === 1) t = g.s; else if (g.v === 2) t = g.d; else if (g.v >= 3 && g.v <= 10) t = t + ' ' + g.p; else t = t + ' ' + g.s; } parts.push(t); });
  return parts.join(' و');
}
export function tafqeet(amount) {
  amount = Number(amount) || 0; let riyals = Math.floor(amount), h = Math.round((amount - riyals) * 100);
  if (h === 100) { riyals += 1; h = 0; }
  let t = int(riyals) + ' ريال سعودي'; t += h > 0 ? ' و' + int(h) + ' هللة' : ' لا غير'; return t;
}
