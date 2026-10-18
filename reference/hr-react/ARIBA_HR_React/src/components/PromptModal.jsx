import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
/** بديل آمن عن window.prompt/confirm */
export default function PromptModal({ open, title, label, defaultValue = '', required = false, confirmText = 'تأكيد', danger = false, noInput = false, message, onConfirm, onClose }) {
  const [v, setV] = useState(defaultValue);
  useEffect(() => { if (open) setV(defaultValue); }, [open, defaultValue]);
  return (
    <Modal open={open} onClose={onClose} title={title} width={440}>
      {message && <p style={{ margin: '0 0 12px', lineHeight: 1.7 }}>{message}</p>}
      {!noInput && <div style={{ marginBottom: 12 }}><label>{label}</label><textarea autoFocus rows={2} value={v} onChange={(e) => setV(e.target.value)} style={{ width: '100%' }} /></div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn bpl" style={danger ? { background: 'var(--rd)', color: '#fff' } : undefined} disabled={required && !noInput && !v.trim()} onClick={() => onConfirm(v.trim())}>{confirmText}</button>
        <button className="btn" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}
