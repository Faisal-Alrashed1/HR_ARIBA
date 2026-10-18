// طباعة عبر iframe مخفي بدل window.open+document.write (لا حاجة لنوافذ منبثقة، ولا حقن في صفحة التطبيق)
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** ضبط الصفحة الواحدة (V109/V110): لو المستند زاد عن A4 بنسبة بسيطة بنصغّره (zoom) لحد ما يكفي صفحة، ولو طويل فعلًا بيفضل متعدد الصفحات */
export function fitOnePage(doc) {
  const t = doc && doc.querySelector('table.lh-t'); if (!t) return;
  const MM = 96 / 25.4, cell = t.querySelector('tbody td'); if (!cell) return;
  const head = t.querySelector('thead'), foot = t.querySelector('tfoot');
  const hh = head ? head.getBoundingClientRect().height : 0, fh = foot ? foot.getBoundingClientRect().height : 0;
  const limit = 297 * MM - hh - fh - 3 * MM;
  const wrap = doc.createElement('div'); while (cell.firstChild) wrap.appendChild(cell.firstChild); cell.appendChild(wrap);
  const h = () => wrap.getBoundingClientRect().height;
  if (h() <= limit) return;
  if (limit / h() < 0.78) return; // مستند طويل فعلًا
  let z = 1; while (h() > limit && z > 0.78) { z = Math.round((z - 0.02) * 100) / 100; wrap.style.zoom = z; }
  if (h() > limit) wrap.style.zoom = '';
}
export function printHtml(title, bodyHtml, { dir = 'rtl', lang = 'ar' } = {}) {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;inset-inline-start:-9999px;width:1200px;height:800px;border:0';
  f.setAttribute('sandbox', 'allow-modals allow-same-origin');
  f.srcdoc = '<!doctype html><html dir="' + dir + '" lang="' + lang + '"><head><meta charset="utf-8"><title>' + esc(title) + '</title></head><body>' + bodyHtml + '</body></html>';
  f.onload = () => { setTimeout(() => { try { fitOnePage(f.contentDocument); } catch { /* ignore */ } try { f.contentWindow.focus(); f.contentWindow.print(); } catch { /* ignore */ } setTimeout(() => f.remove(), 60000); }, 350); };
  document.body.appendChild(f);
}

/** الورق الرسمي (V134): cfg = {mode:'page'|'hf', page, head, foot, top, bottom} — الصور تتحقق أنها data:image */
const okImg = (s) => /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(String(s || ''));
const mmv = (v, d) => { const n = Number(v); return isFinite(n) && n >= 0 && n <= 120 ? n : d; };
import { ARIBA_LH } from './arLetterhead.js';
export function wrapLetterhead(cfg, html) {
  if (!cfg || (cfg.mode !== 'page' && cfg.mode !== 'hf')) return html;
  if (cfg.mode === 'page') {
    const page = okImg(cfg.page) ? cfg.page : '', T = mmv(cfg.top, 42), B = mmv(cfg.bottom, 30);
    return '<style>@page{size:A4;margin:0}html,body{margin:0!important}.lh-t{width:100%;border-collapse:collapse;border:0}.lh-t td{padding:0;border:0}.lh-t thead{display:table-header-group}.lh-t tfoot{display:table-footer-group}'
      + (page ? '.lh-bg{position:fixed;left:0;top:0;width:210mm;height:297mm;z-index:-1;background:url("' + page + '") no-repeat 0 0/100% 100%}' : '') + '</style>'
      + (page ? '<div class="lh-bg"></div>' : '') + '<table class="lh-t"><thead><tr><td><div style="height:' + T + 'mm"></div></td></tr></thead><tbody><tr><td>' + html + '</td></tr></tbody><tfoot><tr><td><div style="height:' + B + 'mm"></div></td></tr></tfoot></table>';
  }
  const hd = cfg.head || (cfg.preset === 'ariba' ? ARIBA_LH.head : ''), ft = cfg.foot || (cfg.preset === 'ariba' ? ARIBA_LH.foot : '');
  const h = okImg(hd) ? '<img src="' + hd + '" style="width:100%;display:block">' : '', f = okImg(ft) ? '<img src="' + ft + '" style="width:100%;display:block">' : '';
  return '<style>@page{size:A4;margin:0}html,body{margin:0!important}.lh-t{width:100%;border-collapse:collapse;border:0}.lh-t td{padding:0;border:0}.lh-t thead{display:table-header-group}.lh-t tfoot{display:table-footer-group}</style>'
    + '<table class="lh-t"><thead><tr><td>' + h + '</td></tr></thead><tbody><tr><td style="padding:0 12mm">' + html + '</td></tr></tbody><tfoot><tr><td>' + f + '</td></tr></tfoot></table>';
}
