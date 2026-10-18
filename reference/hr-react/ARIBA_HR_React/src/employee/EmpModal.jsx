import { useEffect } from 'react';

export const INP = { width: '100%', boxSizing: 'border-box', padding: 10, marginBottom: 8, border: '1px solid #ccc', borderRadius: 8, fontSize: 14, background: '#fff', color: '#111', fontFamily: 'inherit' };
export const LBL = { display: 'block', fontSize: 12, color: '#444', margin: '6px 0 3px' };
export const btnS = (kind) => ({ flex: kind === 'ghost' ? '0 0 auto' : 1, padding: kind === 'ghost' ? '11px 16px' : 11, border: kind === 'ghost' ? '1px solid #ccc' : 0, borderRadius: 8, background: kind === 'ghost' ? '#f3f4f6' : kind === 'danger' ? '#e5484d' : '#0f766e', color: kind === 'ghost' ? '#111' : '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' });

/** نافذة بيضاء فوق خلفية معتمة (نفس النوافذ في النسخة القديمة) */
export default function EmpModal({ id, onClose, children, locked }) {
  useEffect(() => {
    if (locked) return undefined;
    const k = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [onClose, locked]);
  return (
    <div id={id} role="dialog" aria-modal="true" onMouseDown={(e) => { if (!locked && e.target === e.currentTarget) onClose && onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483646, background: 'rgba(15,23,42,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', color: '#111', maxWidth: 400, width: '100%', maxHeight: '92vh', overflow: 'auto', borderRadius: 14, padding: 20, boxShadow: '0 20px 50px rgba(0,0,0,.35)' }}>{children}</div>
    </div>
  );
}
