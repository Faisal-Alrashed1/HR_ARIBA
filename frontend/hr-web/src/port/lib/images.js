// قراءة الصور بأمان: تصغير على canvas + قائمة بيضاء لأنواع data: + سقف للحجم
const OK = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/i;
export const isSafeDataImg = (s) => /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(String(s || ''));

function load(file) {
  return new Promise((res, rej) => {
    if (!file || !OK.test(file.type)) { rej(new Error('type')); return; }
    if (file.size > 8 * 1024 * 1024) { rej(new Error('size')); return; }
    const fr = new FileReader();
    fr.onerror = () => rej(new Error('read'));
    fr.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('image')); im.onload = () => res(im); im.src = fr.result; };
    fr.readAsDataURL(file);
  });
}
/** يصغّر الصورة داخل (maxW × maxH) ويرجّع data URL؛ يكرّر التصغير لو تعدّى maxLen */
export async function readImage(file, { maxW = 520, maxH = 520, maxLen = 420000, whiteToAlpha = false } = {}) {
  const im = await load(file);
  const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height; if (!W || !H) throw new Error('size');
  let sc = Math.min(1, maxW / W, maxH / H);
  for (let i = 0; i < 5; i++) {
    const w = Math.max(1, Math.round(W * sc)), h = Math.max(1, Math.round(H * sc));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
    let alpha = whiteToAlpha;
    if (whiteToAlpha) { const d = x.getImageData(0, 0, w, h); const p = d.data; for (let k = 0; k < p.length; k += 4) { const m = Math.min(p[k], p[k + 1], p[k + 2]); if (m > 235) p[k + 3] = 0; else if (m > 200) p[k + 3] = Math.round(p[k + 3] * (235 - m) / 35); } x.putImageData(d, 0, 0); }
    else { try { const p = x.getImageData(0, 0, w, h).data; for (let k = 3; k < p.length; k += 40) if (p[k] < 250) { alpha = true; break; } } catch { /* ignore */ } }
    const out = (alpha || /png|gif|webp/i.test(file.type)) ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88);
    if (out.length <= maxLen) return out;
    sc *= 0.75;
  }
  throw new Error('size');
}
