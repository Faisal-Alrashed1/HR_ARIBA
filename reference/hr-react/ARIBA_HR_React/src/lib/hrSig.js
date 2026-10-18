// بلوك توقيع وختم مدير الموارد البشرية (نفس sigHtml في القديم V120/V142): العربي التوقيع يسار / الإنجليزي يمين
import { esc } from './print.js';
import { signerOf, safeImg } from './branding.js';

export function fmtName(n, f) { const p = String(n || '').trim().split(/\s+/).filter(Boolean); if (p.length <= 1 || !f || f === 'full') return p.join(' '); if (f === 'fl') return p[0] + ' ' + p[p.length - 1]; if (f === 'ff') return p[0] + ' ' + p[1]; if (f === 'ffl') return p.length >= 3 ? (p[0] + ' ' + p[1] + ' ' + p[p.length - 1]) : p.join(' '); return p.join(' '); }
const p2 = (n) => (n < 10 ? '0' : '') + n;
export function todayInfo() {
  const now = new Date(), g = {}, h = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).forEach((p) => { g[p.type] = p.value; });
  new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(now).forEach((p) => { h[p.type] = p.value; });
  return { gd: g.day, gm: g.month, gy: g.year, hd: p2(+h.day), hm: p2(+h.month), hy: h.year, ymd: g.year + g.month + g.day, iso: g.year + '-' + g.month + '-' + g.day };
}
export const todayDMY = () => { const t = todayInfo(); return t.gd + '/' + t.gm + '/' + t.gy; };

/** الموقّع الحالي (اسم + مسمى + توقيع + ختم) — tr = مترجم للإنجليزي (اختياري) */
export function getSigner(settings, employees, tr) {
  const s = signerOf(settings, employees); const S = (settings && settings.signer) || {};
  const o = { titleAr: s.titleAr, titleEn: S.titleEn || 'Human Resources Manager', useSig: s.useSig, useStamp: s.useStamp, nameAr: s.nameAr, nameEn: s.nameEn, sig: s.sig, stamp: s.stamp };
  if (S.empId && S.empId !== 'default') {
    const e = (employees || []).find((x) => String(x.id) === String(S.empId));
    const ar = (e && e.nameAr) || S.nameAr || '';
    let en = (e && e.nameEn) || S.nameEn || (tr && /[؀-ۿ]/.test(ar) ? tr(ar) : ar) || '';
    if (/[؀-ۿ]/.test(en)) en = S.nameEn || en;
    o.nameAr = fmtName(ar, S.nameFmt || 'full'); o.nameEn = fmtName(en, S.nameFmt || 'full');
  } else { o.nameAr = ''; o.nameEn = ''; o.sig = ''; }
  o.stamp = safeImg(S.stamp);
  return o;
}

export function sigHtml(settings, employees, lang, opt = {}, tr) {
  const en = lang === 'en', g = getSigner(settings, employees, tr), dir = en ? 'ltr' : 'rtl';
  const name = en ? g.nameEn : g.nameAr, title = en ? g.titleEn : g.titleAr;
  const HB = Math.min((opt.h || 33) * 1.1, 38), k = HB / 33, W = (v) => (v * k).toFixed(1) + 'mm';
  const showSig = !opt.noImg && g.useSig && g.sig, showStamp = !opt.noImg && g.useStamp && g.stamp;
  let imgs = '';
  if (showStamp) imgs += '<img src="' + g.stamp + '" style="position:absolute;width:' + W(31) + ';height:' + W(31) + ';object-fit:contain;right:1mm;top:' + W(4) + ';opacity:1;filter:contrast(1.08) saturate(1.1)">';
  if (showSig) imgs += '<img src="' + g.sig + '" style="position:absolute;width:' + W(38) + ';max-height:' + W(23) + ';object-fit:contain;left:1mm;top:' + W(9) + ';mix-blend-mode:multiply">';
  const line = showSig ? '' : '<div style="position:absolute;left:12%;right:12%;bottom:' + W(5) + ';border-top:1px solid #333"></div>';
  const fs = k < 0.9 ? 11 : 12;
  const box = '<div class="hs-box" style="position:relative;width:' + W(75) + ';height:' + Math.max(HB, 39).toFixed(1) + 'mm;text-align:center;flex:0 0 auto"><div style="font-weight:800;font-size:' + fs + 'px">' + esc(title) + '</div>' + imgs + line + '<div style="position:absolute;bottom:0;left:0;right:0;font-weight:800;font-size:' + fs + 'px">' + esc(name) + '</div></div>';
  const date = opt.date ? '<div style="font-size:11px;align-self:flex-end;padding-bottom:1mm">' + (en ? 'Date' : 'التاريخ') + ': ' + todayDMY() + '</div>' : '<div></div>';
  const left = opt.extra || '';
  return '<div class="hs-row" dir="' + dir + '" style="display:flex;justify-content:space-between;align-items:flex-end;gap:6mm;margin-top:' + (opt.mt == null ? 4 : opt.mt) + 'mm;page-break-inside:avoid">' + (left ? '<div style="flex:1">' + left + '</div>' : date) + box + '</div>';
}
