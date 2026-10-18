import { useEffect } from 'react';
/** نافذة منبثقة بنفس تنسيق .mw/.modal القديم */
export default function Modal({ open, onClose, title, width = 600, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="mw on" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="modal" style={{ width, maxWidth: '96vw' }} role="dialog" aria-modal="true">
        <div className="mh"><h3>{title}</h3><button type="button" className="btn bsm" onClick={onClose} aria-label="close"><i className="ti ti-x" /></button></div>
        <div className="mb">{children}</div>
        {footer}
      </div>
    </div>
  );
}
