// ألوان البرنامج: نفس اشتقاق الباليت من النظام القديم (V146) لكن بمتغيرات CSS فقط (بدون إعادة كتابة نصوص الـstyle)
export const DEFC = { p: '#014D3D', a: '#29B35E', s: '#F4F0E4' };
export const PRESETS = [['#014D3D', '#F4F0E4', 'الأخضر الأصلي', 'Original green'], ['#1E3A8A', '#EAF0FA', 'أزرق', 'Blue'], ['#7C2D12', '#FBF0E6', 'بني', 'Brown'], ['#581C87', '#F3EBFA', 'بنفسجي', 'Purple'], ['#0F766E', '#E8F5F3', 'تركواز', 'Teal'], ['#111827', '#EEEFF2', 'رمادي داكن', 'Slate']];
const HEX = /^#[0-9a-f]{6}$/i;
export const validHex = (h) => HEX.test(String(h || ''));
export function hex2rgb(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return (isFinite(n) && h.length === 6) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : null; }
export const rgb2hex = (r) => '#' + r.map((v) => { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join('').toUpperCase();
export function rgb2hsl(r) { const R = r[0] / 255, G = r[1] / 255, B = r[2] / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2, d = mx - mn; let h = 0, s = 0; if (d) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === R ? ((G - B) / d + (G < B ? 6 : 0)) : mx === G ? ((B - R) / d + 2) : ((R - G) / d + 4); h *= 60; } return [h, s, l]; }
export function hsl2rgb(h, s, l) { h = ((h % 360) + 360) % 360; const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; let r = 0, g = 0, b = 0; if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; } return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; }
export function palette(b) {
  const P = hex2rgb(b.p), S = hex2rgb(b.s), hp = rgb2hsl(P), A = hex2rgb(b.a) || hsl2rgb(hp[0], Math.min(.7, Math.max(.45, hp[1] * .7)), .43), hs = rgb2hsl(S);
  const dk = (l, s) => rgb2hex(hsl2rgb(hp[0], s == null ? .52 : s, l));
  return { P: rgb2hex(P), A: rgb2hex(A), S: rgb2hex(S), bdL: rgb2hex(hsl2rgb(hs[0], Math.min(hs[1], .3), Math.max(.05, hs[2] - .11))), dBg: dk(.06, .55), dP: dk(.09), dC: dk(.11), dC2: dk(.14), dBd: dk(.21, .5), dTx: rgb2hex(hsl2rgb(hp[0], .45, .95)), dMu: rgb2hex(hsl2rgb(hp[0], .18, .67)), dDm: rgb2hex(hsl2rgb(hp[0], .15, .45)), lMu: rgb2hex(hsl2rgb(hp[0], .18, .34)), lDm: rgb2hex(hsl2rgb(hp[0], .12, .5)) };
}
const ID = 'ariba-brand-css';
/** يطبّق الألوان على الواجهة (يمسح التخصيص لو b فاضي) — القيم تتحقق قبل ما تدخل CSS */
export function applyBrand(b) {
  let el = document.getElementById(ID);
  if (!b || !validHex(b.p) || !validHex(b.s)) { if (el) el.remove(); return; }
  const pal = palette({ p: b.p, s: b.s, a: validHex(b.a) ? b.a : '' });
  let css0 = '';
  const css = `html{--gr:${pal.A};--ariba-dark:${pal.P};--ariba-bright:${pal.A}}`
    + `html[data-ariba-theme="light"]{--bg:${pal.S};--c2:${pal.S};--bd:${pal.bdL};--bl:${pal.P};--gr:${pal.A};--cy:${pal.P};--pu:${pal.P};--mu:${pal.lMu};--dm:${pal.lDm}}`
    + `html[data-ariba-theme="dark"]{--bg:${pal.dBg};--p:${pal.dP};--c:${pal.dC};--c2:${pal.dC2};--bd:${pal.dBd};--bl:${pal.A};--gr:${pal.A};--cy:${pal.A};--pu:${pal.P};--tx:${pal.dTx};--mu:${pal.dMu};--dm:${pal.dDm}}`;
  const extra = `.lic{background:linear-gradient(135deg,${pal.A},${pal.P})!important}.ai-fab{background:linear-gradient(135deg,${pal.P},${pal.A})!important}.pg.on th{background:${pal.P}!important}.hero-p{background:${pal.P}!important}`;
  const Ar = hex2rgb(pal.A).join(','), Pr = hex2rgb(pal.P).join(',');
  const hp = rgb2hsl(hex2rgb(pal.P)), dkc = (l, sat) => rgb2hex(hsl2rgb(hp[0], sat == null ? .52 : sat, l));
  const D = 'html[data-ariba-theme="dark"]', L = 'html[data-ariba-theme="light"]';
  const strong = `html:root{--ariba-dark:${pal.P}!important;--ariba-green:${pal.A}!important;--ariba-bright:${pal.A}!important;--ariba-beige:${pal.S}!important;--ariba-soft:${pal.S}!important}`
    + `html .topbar,html .sb,html .tbar{background:${pal.P}!important;border-color:${pal.P}!important}`
    + `${L} .topbar,${L} .sb{background:${pal.P}!important;border-color:${pal.P}!important}`
    + `${L} .sb .ni:hover,${L} .sb .ni.on,${L} .sb .ns.on{background:rgba(${Ar},.28)!important}`
    + `${L} body{background:${pal.S}!important}`
    + `${D} body{background:${pal.dBg}!important}${D} .topbar{background:${dkc(.17)}!important}${D} .sb{background:${dkc(.12)}!important}`
    + `${D} .card,${D} .panel,${D} .box,${D} .tbar,${D} .modal,${D} .section,${D} .table-wrap{background:${pal.dC}!important;border-color:${pal.dBd}!important}`
    + `${D} .stat,${D} .tile,${D} .kpi{background:${pal.dC2}!important;border-color:${pal.dBd}!important}`
    + `${D} input,${D} select,${D} textarea{background:${pal.dP}!important;border-color:${pal.dBd}!important}`
    + `.btn.bpl,.btn.bgl,.primary,.btn-primary,.active-btn{background:${pal.P}!important;border-color:${pal.P}!important}`
    + `.btn.bpl:hover,.btn.bgl:hover,.primary:hover,.btn-primary:hover{background:${pal.A}!important;border-color:${pal.A}!important}`
    + `#HRL,.hr-role,#ARIBA_PAYROLL_ARCHIVE .ct,${L} #aribaThemeBtn,${L} .ariba-theme-label,#KR .kpi:last-child .kv{color:${pal.P}!important}`;
  void Pr;
  css0 = css + extra + strong;
  if (!el) { el = document.createElement('style'); el.id = ID; document.head.appendChild(el); }
  el.textContent = css0;
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', pal.P);
}

/** قيمة brand_colors الكاملة: الألوان + شعار البصمة (تطبيق الموظف بيقرأهم من نفس المفتاح) */
export function brandValue(brand, punchData) {
  const b = brand && brand.p && !brand.reset ? { p: brand.p, s: brand.s, a: brand.a || '' } : { reset: true };
  const d = typeof punchData === 'string' ? punchData : '';
  return { ...b, updated: Date.now(), ...(d ? { punch: d } : {}) };
}
