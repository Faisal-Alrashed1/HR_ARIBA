// تصدير أي جدول إلى Excel / PDF / Word + إرساله بالإيميل تلقائياً (بدون فتح برنامج بريد)
import { buildXlsx } from './xlsx.js';
import { esc } from './print.js';
import { functionCall } from './api.js';

export const FORMATS = { xlsx: ['Excel', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], pdf: ['PDF', 'pdf', 'application/pdf'], doc: ['Word', 'doc', 'application/msword'] };
const safeName = (s) => String(s || 'report').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);

/** جدول HTML منسّق (يستخدم للـ PDF والـ Word) */
export function tableHtml({ title, headers, rows, sub, dir = 'rtl' }) {
  const th = 'background:#014D3D;color:#fff;padding:5px 7px;font-size:11px;border:1px solid #014D3D', td = 'padding:4px 7px;border:1px solid #cfdad6;font-size:11px;text-align:center';
  return '<div dir="' + dir + '" style="font-family:Tahoma,Arial,sans-serif;color:#111">'
    + (title ? '<h3 style="text-align:center;color:#014D3D;margin:0 0 4px">' + esc(title) + '</h3>' : '') + (sub ? '<div style="text-align:center;font-size:10px;color:#667;margin-bottom:8px">' + esc(sub) + '</div>' : '')
    + '<table style="width:100%;border-collapse:collapse"><thead><tr>' + headers.map((h) => '<th style="' + th + '">' + esc(h) + '</th>').join('') + '</tr></thead><tbody>'
    + rows.map((r) => '<tr>' + r.map((c) => '<td style="' + td + '">' + esc(c == null ? '' : c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}

async function pdfBlob(spec) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: spec.headers.length > 7 ? 'landscape' : 'portrait' });
  const W = pdf.internal.pageSize.getWidth(), PH = pdf.internal.pageSize.getHeight(), PER = spec.headers.length > 7 ? 22 : 32;
  const chunks = []; for (let i = 0; i < Math.max(spec.rows.length, 1); i += PER) chunks.push(spec.rows.slice(i, i + PER));
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-99999px;top:0;background:#fff;padding:16px;width:' + (spec.headers.length > 7 ? 1180 : 780) + 'px'; document.body.appendChild(host);
  try {
    for (let i = 0; i < chunks.length; i++) {
      host.innerHTML = tableHtml({ ...spec, title: i === 0 ? spec.title : '', sub: i === 0 ? spec.sub : '', rows: chunks[i] }) + '<div style="text-align:center;font-size:9px;color:#889;margin-top:6px">' + (i + 1) + ' / ' + chunks.length + '</div>';
      const cv = await html2canvas(host, { scale: 2, backgroundColor: '#fff' });
      if (i) pdf.addPage();
      const h = Math.min(PH - 6, (cv.height * (W - 8)) / cv.width);
      pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 4, 3, W - 8, h);
    }
  } finally { host.remove(); }
  return pdf.output('blob');
}

/** spec = {title, headers, rows, sub?, name?} → {blob, name, mime} */
export async function makeFile(fmt, spec) {
  const base = safeName(spec.name || spec.title);
  if (fmt === 'xlsx') return { blob: buildXlsx([{ name: String(spec.title || 'Report').replace(/[\\/?*[\]:]/g, ' ').slice(0, 30), rows: [spec.headers, ...spec.rows], widths: spec.headers.map(() => 18) }]), name: base + '.xlsx', mime: FORMATS.xlsx[2] };
  if (fmt === 'doc') {
    const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl"><head><meta charset="utf-8"><title>' + esc(spec.title) + '</title><style>@page{size:A4 landscape}body{font-family:Tahoma,Arial}</style></head><body>' + tableHtml(spec) + '</body></html>';
    return { blob: new Blob(['﻿', html], { type: 'application/msword' }), name: base + '.doc', mime: FORMATS.doc[2] };
  }
  return { blob: await pdfBlob(spec), name: base + '.pdf', mime: FORMATS.pdf[2] };
}
export function saveBlob(file) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(file.blob); a.download = file.name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
export const blobToBase64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); });

/** إرسال تقرير بالإيميل تلقائياً عبر الدالة ariba-send-report */
export async function emailReport({ to, subject, message, file }) {
  const list = [...new Set((to || []).map((x) => String(x).trim()).filter(Boolean))];
  if (!list.length) throw new Error('اختر مستلماً واحداً على الأقل');
  if (file.blob.size > 7 * 1024 * 1024) throw new Error('حجم الملف أكبر من 7MB — قلّل الحقول أو الموظفين');
  const r = await functionCall('ariba-send-report', { to: list, subject, message: message || '', attachment: { name: file.name, mime: file.mime, base64: await blobToBase64(file.blob) } });
  const j = (r && r.data) || {};
  if (!j.ok) throw new Error(j.message || j.error || 'تعذر إرسال التقرير');
  return j;
}

/** يلتقط كل الجداول الظاهرة داخل عنصر ويحولها لمواصفات تصدير */
export function tablesFrom(root) {
  const out = [];
  (root ? root.querySelectorAll('table') : []).forEach((t, i) => {
    if (!t.offsetParent && t.getClientRects().length === 0) return;
    const trs = [...t.querySelectorAll('tr')].filter((tr) => !tr.closest('table') || tr.closest('table') === t); if (trs.length < 2) return;
    const cells = (tr) => [...tr.children].map((c) => c.innerText.replace(/\s+/g, ' ').trim());
    const head = trs.find((tr) => tr.querySelector('th')) || trs[0]; const headers = cells(head); const rows = trs.filter((tr) => tr !== head).map(cells).filter((r) => r.some(Boolean));
    if (!rows.length) return;
    const card = t.closest('.card'); const ttl = (card && card.querySelector('.ct')) ? card.querySelector('.ct').innerText.trim() : ('جدول ' + (i + 1));
    out.push({ title: ttl, headers, rows: rows.map((r) => { const x = r.slice(0, headers.length); while (x.length < headers.length) x.push(''); return x; }) });
  });
  return out;
}
