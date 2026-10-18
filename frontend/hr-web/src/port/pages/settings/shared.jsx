import { useState } from 'react';
import { setSetting } from '../../lib/api.js';
import { useApp } from '../../store/AppStore.jsx';
import { toast } from '../../components/Toast.jsx';
import { T } from '../../lib/i18n.js';

/** حفظ إعداد سحابي + تحديث الـstore (الخادم يفرض الصلاحية) */
export function useSaveSetting() {
  const { patchSettings } = useApp();
  return async (storeKey, cloudKey, value, okMsg) => {
    try { await setSetting(cloudKey, value); patchSettings(storeKey, value); toast('✓ ' + (okMsg || T('اتحفظ', 'Saved')), 'tin'); return true; }
    catch (e) { toast(T('تعذر الحفظ: ', 'Could not save: ') + (e.message || e), 'ter'); return false; }
  };
}
export const Card = ({ icon, title, children, max = 900, id }) => (
  <div className="card" id={id} style={{ marginTop: 12, maxWidth: max, padding: 14 }}>
    <div className="ct" style={{ marginBottom: 12 }}><i className={'ti ti-' + icon} /> <span>{title}</span></div>
    {children}
  </div>
);
export const Note = ({ children, style }) => <div style={{ fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.7, ...style }}>{children}</div>;
export function useBusy() { const [b, set] = useState(false); return [b, async (fn) => { set(true); try { return await fn(); } finally { set(false); } }]; }
