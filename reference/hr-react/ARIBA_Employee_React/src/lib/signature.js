// توقيع الموظف: يُحفظ في جهاز/تطبيق الموظف فقط (localStorage) ولا يُرسل لأي جدول ولا تراه الموارد البشرية.
// ما يصل للسيرفر هو المستند بعد دمج التوقيع فيه فقط.
const KEY = (id) => 'ariba_sig_v1_' + String(id || '');
export function getSig(id) { try { return localStorage.getItem(KEY(id)) || ''; } catch { return ''; } }
export function setSig(id, dataUrl) { try { if (dataUrl) localStorage.setItem(KEY(id), dataUrl); else localStorage.removeItem(KEY(id)); return true; } catch { return false; } }
const OK = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;
export const isSigData = (s) => typeof s === 'string' && OK.test(s) && s.length < 700000;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => new Date().toLocaleDateString('en-GB');
const imgTag = (sig) => '<img alt="signature" src="' + sig + '" style="height:38px;max-width:150px;vertical-align:middle">';

/** يدمج التوقيع في مكان توقيع الموظف/المدير. role: employee | manager. يعمل على كل جزء (عربي/إنجليزي) */
export function injectSignature(html, role, sig, name) {
  if (!isSigData(sig)) throw new Error('BAD_SIGNATURE');
  const parts = String(html).split('<!--ARIBA_EN-->');
  const slot = '<span data-sig="' + role + '">________________</span>';
  const stamp = ' <span style="font-size:10px;color:#555">' + esc(now()) + '</span>';
  const out = parts.map((p) => {
    if (p.includes(slot)) { let n = 0; return p.split(slot).join('\u0000').replace(/\u0000/g, () => (n++ === 0 ? imgTag(sig) + stamp : '<span data-sig-done="' + role + '">✓</span>')); }
    // لا يوجد مكان مخصص (مستند قديم/مدير): نضيف خانة اعتماد في نهاية المستند
    const lbl = role === 'manager' ? 'اعتماد المدير المباشر / Direct manager approval' : 'توقيع الموظف / Employee signature';
    const block = '<div style="margin:18px 12px 0;padding-top:8px;border-top:1px solid #999;font-size:12px"><b>' + lbl + '</b> ' + (name ? '— ' + esc(name) : '') + '<div style="margin-top:6px">' + imgTag(sig) + stamp + '</div></div>';
    return /<\/body>/i.test(p) ? p.replace(/<\/body>/i, block + '</body>') : p + block;
  });
  return out.join('<!--ARIBA_EN-->');
}
export const b64Utf8 = (s) => { const u = new TextEncoder().encode(s); let b = ''; u.forEach((c) => { b += String.fromCharCode(c); }); return btoa(b); };
export const utf8FromB64 = (b) => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder('utf-8').decode(u); };
