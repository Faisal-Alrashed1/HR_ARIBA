import { useEffect, useRef, useState } from 'react';
import { esc } from '../lib/print.js';

const MB = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
export const fmtSize = (n) => (n ? MB(Number(n)) : '—');

/** معاينة مرفق داخل البرنامج: صور / PDF / نصوص / CSV / JSON. غير ذلك يُحمَّل. file = { name, mime, bytes(Uint8Array) } */
export default function DocPreview({ file, onClose, onDownload }) {
  const [url, setUrl] = useState('');
  const ext = String(file.name || '').split('.').pop().toLowerCase(), m = String(file.mime || '').toLowerCase();
  const kind = (m === 'text/html' || /^(html?|xhtml)$/.test(ext)) ? 'html' : /^image\//.test(m) || /^(png|jpe?g|webp|gif|bmp)$/.test(ext) ? 'img' : (m === 'application/pdf' || ext === 'pdf') ? 'pdf' : (/^text\//.test(m) || /^(txt|csv|json|md|log|xml)$/.test(ext) || m === 'application/json') ? 'text' : 'none';
  useEffect(() => {
    if (kind === 'text' || kind === 'none' || kind === 'html') return undefined;
    const u = URL.createObjectURL(new Blob([file.bytes], { type: kind === 'pdf' ? 'application/pdf' : (m || 'image/png') })); setUrl(u); return () => URL.revokeObjectURL(u);
  }, [file, kind, m]);
  const frame = useRef(null);
  const htmlDoc = kind === 'html' ? (() => { const t = new TextDecoder('utf-8').decode(file.bytes); return /<html/i.test(t) ? t : '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{margin:0;background:#fff}</style></head><body>' + t + '</body></html>'; })() : '';
  const printIt = () => { try { const w = frame.current && frame.current.contentWindow; w.focus(); w.print(); } catch { onDownload(); } };
  const txt = kind === 'text' ? new TextDecoder('utf-8').decode(file.bytes).slice(0, 300000) : '';
  return (
    <div id="docPreview" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
      <div style={{ background: '#fff', color: '#111', width: 'min(960px,97vw)', height: '92vh', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #ddd' }}>
          <b style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name} <span style={{ color: '#666', fontWeight: 400 }}>({fmtSize(file.bytes.length)})</span></b>
          <button type="button" className="btn bsm" style={{ color: '#111', borderColor: '#bbb' }} onClick={onDownload}>تحميل</button>
          {kind === 'html' && <button type="button" className="btn bsm" id="docPreviewPrint" style={{ color: '#111', borderColor: '#bbb' }} onClick={printIt}>طباعة</button>}
          <button type="button" className="btn bsm" id="docPreviewX" style={{ color: '#111', borderColor: '#bbb' }} onClick={onClose}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: kind === 'pdf' ? 0 : 12, background: '#f3f4f6', textAlign: 'center' }}>
          {kind === 'img' && url && <img alt={esc(file.name)} src={url} style={{ maxWidth: '100%', maxHeight: '100%' }} />}
          {kind === 'pdf' && url && <iframe title="pdf" src={url} style={{ width: '100%', height: '100%', border: 0 }} />}
          {kind === 'text' && <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'start', margin: 0, fontFamily: 'inherit' }}>{txt}</pre>}
          {kind === 'html' && <iframe ref={frame} title="doc" sandbox="allow-same-origin allow-modals" srcDoc={htmlDoc} style={{ width: '100%', maxWidth: 860, height: '100%', minHeight: 600, border: 0, background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,.15)' }} />}
          {kind === 'none' && <div style={{ padding: 40, lineHeight: 2 }}>هذه الصيغة ({ext || m || '?'}) لا تُعرض داخل البرنامج.<br />استخدم زر التحميل لفتحها.</div>}
        </div>
      </div>
    </div>
  );
}
