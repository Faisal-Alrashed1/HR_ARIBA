import * as auth from '../lib/auth.js';
import * as vault from '../lib/vault.js';
import { toast } from './Toast.jsx';
import { T } from '../lib/i18n.js';

export default function BioAsk({ onClose }) {
  const bs = (p) => ({ flex: 1, padding: 11, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: p ? 'none' : '1px solid #ccc', background: p ? '#29B35E' : '#fff', color: p ? '#fff' : '#333' });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483646, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} role="dialog" aria-modal="true">
      <div style={{ background: '#fff', color: '#111', borderRadius: 16, maxWidth: 380, width: '100%', padding: 22, textAlign: 'center' }}>
        <div style={{ fontSize: 34 }}>🔐</div>
        <div style={{ fontWeight: 800, fontSize: 16, margin: '8px 0' }}>{T('تفعيل الدخول بالبصمة؟', 'Enable fingerprint / Face ID sign-in?')}</div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>{T('بدل كتابة كلمة المرور كل مرة، تدخل بالبصمة أو Face ID على هذا الجهاز.', 'Sign in with your fingerprint or Face ID on this device instead of typing your password.')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={bs(0)} onClick={onClose}>{T('مش دلوقتي', 'Not now')}</button>
          <button style={bs(1)} onClick={async () => { const r = await vault.enableBiometric(auth.state.rt || ''); toast(r.msg || '', r.ok ? 'tin' : 'ter'); onClose(); }}>{T('تفعيل', 'Enable')}</button>
        </div>
      </div>
    </div>
  );
}
