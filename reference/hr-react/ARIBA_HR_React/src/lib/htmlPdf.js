// تحويل مستند HTML (نموذج/مخالصة) إلى PDF بصفحات A4 — للتحميل المباشر
const PXW = 794; // عرض A4 بالبكسل عند 96dpi

export async function htmlToPdfBlob(html, { onePage = false } = {}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const doc = /<html/i.test(html) ? html : '<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head><body>' + html + '</body></html>';
  const fr = document.createElement('iframe');
  fr.setAttribute('sandbox', 'allow-same-origin');
  fr.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + PXW + 'px;height:100px;border:0;background:#fff';
  document.body.appendChild(fr);
  try {
    await new Promise((res) => { fr.onload = res; fr.srcdoc = doc; setTimeout(res, 4000); });
    const d = fr.contentDocument; if (!d || !d.body) throw new Error('تعذر تجهيز المستند');
    d.body.style.margin = '0'; d.body.style.background = '#fff';
    try { if (d.fonts && d.fonts.ready) await d.fonts.ready; } catch { /* ignore */ }
    await Promise.all(Array.from(d.images || []).map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
    const h = Math.max(Math.ceil(d.body.getBoundingClientRect().height), d.body.scrollHeight, 200);
    fr.style.height = h + 'px';
    const cv = await html2canvas(d.body, { scale: 2, backgroundColor: '#fff', width: PXW, windowWidth: PXW, height: h, windowHeight: h, useCORS: true });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const W = pdf.internal.pageSize.getWidth(), PH = pdf.internal.pageSize.getHeight();
    // صفحة واحدة للمستندات الرسمية: يبدأ من أعلى الصفحة (الترويسة فوق) ويتصغّر فقط لو طوله تجاوز A4.
    // لو المستند أطول من 1.35 صفحة يرجع لتقسيم صفحات عادي عشان الخط ما يصغرش لدرجة يصعب قراءته.
    const pagesAtFullWidth = (cv.height * W) / cv.width / PH;
    if (onePage && pagesAtFullWidth <= 1.35) {
      const scale = Math.min(W / cv.width, PH / cv.height);
      const drawW = cv.width * scale, drawH = cv.height * scale;
      pdf.addImage(cv.toDataURL('image/jpeg', 0.95), 'JPEG', (W - drawW) / 2, 0, drawW, drawH);
    } else {
      const slicePx = Math.floor(cv.width * (PH / W));
      for (let y = 0, i = 0; y < cv.height; y += slicePx, i++) {
        const hh = Math.min(slicePx, cv.height - y), part = document.createElement('canvas');
        part.width = cv.width; part.height = hh;
        const ctx = part.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, part.width, part.height); ctx.drawImage(cv, 0, y, cv.width, hh, 0, 0, cv.width, hh);
        if (i) pdf.addPage();
        pdf.addImage(part.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, W, (hh * W) / cv.width);
      }
    }
    return pdf.output('blob');
  } finally { fr.remove(); }
}
export const isHtmlFile = (f) => /^text\/html/i.test(String(f.mime || '')) || /\.html?$/i.test(String(f.name || ''));
