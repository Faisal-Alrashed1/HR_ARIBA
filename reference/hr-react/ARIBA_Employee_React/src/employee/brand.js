// ألوان الشركة لتطبيق الموظف: نفس اشتقاق النسخة القديمة (استبدال الألوان الأساسية داخل الـCSS) مع تحقق من القيم
import { useSyncExternalStore } from 'react';
import { rpc } from '../lib/api.js';
const LK = 'ariba_emp_brand_v1';
const h2r = (h) => { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return (isFinite(n) && h.length === 6) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : null; };
const r2h = (r) => '#' + r.map((v) => { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join('').toUpperCase();
const shade = (r, k) => r.map((v) => v * (1 - k)), lift = (r, k) => r.map((v) => v + (255 - v) * k);
function pal(b) { const P = h2r(b.p), A = h2r(b.a) || lift(P, .35), S = h2r(b.s) || [244, 240, 230]; return { P: r2h(P), A: r2h(A), S: r2h(S), P2: r2h(shade(P, .2)), P3: r2h(lift(P, .1)), P4: r2h(lift(P, .2)), AL: r2h(lift(A, .3)), AD: r2h(shade(A, .15)), rgbP: P.join(','), rgbS: S.join(','), rgbA: A.join(',') }; }
export function conv(t, p) {
  return t.replace(/#013D31/gi, p.P2).replace(/#075444/gi, p.P3).replace(/#176A58/gi, p.P4).replace(/#014D3D/gi, p.P).replace(/#4BDC86/gi, p.AL).replace(/#1D9A4C/gi, p.AD).replace(/#1F9A4F/gi, p.AD).replace(/#29B35E/gi, p.A).replace(/#E4E4BC/gi, p.S).replace(/#F4F0E6/gi, p.S)
    .replace(/rgba\(\s*1\s*,\s*77\s*,\s*61\s*,/gi, 'rgba(' + p.rgbP + ',').replace(/rgba\(\s*228\s*,\s*228\s*,\s*188\s*,/gi, "rgba(" + p.rgbS + ",").replace(/rgba\(\s*41\s*,\s*179\s*,\s*94\s*,/gi, 'rgba(' + p.rgbA + ',');
}
export const loadBrand = () => { try { const b = JSON.parse(localStorage.getItem(LK) || 'null'); return b && h2r(b.p) ? b : null; } catch { return null; } };
/** يركّب ورقة الأنماط (الأصلية أو بألوان الشركة) داخل <style id=ariba-emp-css> */
export function installCss(css, brand) {
  let el = document.getElementById('ariba-emp-css'); if (!el) { el = document.createElement('style'); el.id = 'ariba-emp-css'; document.head.appendChild(el); }
  el.textContent = brand ? conv(css, pal(brand)) : css;
  const rs = document.documentElement.style; if (brand) { const q = pal(brand); rs.setProperty('--bp', q.P); rs.setProperty('--ba', q.A); rs.setProperty('--bs', q.S); } else { rs.removeProperty('--bp'); rs.removeProperty('--ba'); rs.removeProperty('--bs'); }
  const m = document.querySelector('meta[name=theme-color]'); if (m && brand) { m.setAttribute('content', pal(brand).P); el.setAttribute('data-brand', '1'); } else el.removeAttribute('data-brand');
}
/** يسحب ألوان الشركة من السيرفر؛ عند التغيير يعيد التحميل (كما في النسخة القديمة) */
export async function pullBrand(css) {
  try {
    const r = await rpc('ariba_get_brand', {}), v = r && r.value;
    setPunchLogo(v && v.punch);
    const nb = (!v || v.reset || !v.p) ? null : { p: v.p, a: v.a || '', s: v.s || '', updated: v.updated || 0 };
    const cur = loadBrand();
    if (JSON.stringify(nb) === JSON.stringify(cur)) return;
    if (!nb) { try { localStorage.removeItem(LK); } catch { /* ignore */ } } else { try { localStorage.setItem(LK, JSON.stringify(nb)); } catch { /* ignore */ } }
    installCss(css, nb);
  } catch { /* ignore */ }
}

// شعار خلف زر البصمة (بيجي مع قيمة brand_colors من السيرفر)
const PK = 'ariba_emp_punch_logo_v1'; const psubs = new Set();
const okImg = (d) => typeof d === 'string' && /^data:image\/(png|jpeg|webp|svg\+xml);base64,/i.test(d) && d.length < 900000;
export const getPunchLogo = () => { try { return localStorage.getItem(PK) || ''; } catch { return ''; } };
export function setPunchLogo(d) { const v = okImg(d) ? d : ''; if (v === getPunchLogo()) return; try { if (v) localStorage.setItem(PK, v); else localStorage.removeItem(PK); } catch { /* ignore */ } psubs.forEach((f) => f()); }
export const usePunchLogo = () => useSyncExternalStore((f) => { psubs.add(f); return () => psubs.delete(f); }, getPunchLogo);
