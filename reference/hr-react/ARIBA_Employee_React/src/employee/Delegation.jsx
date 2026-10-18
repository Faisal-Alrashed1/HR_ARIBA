import { useEffect, useState } from 'react';
import { rpc } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { useLang } from '../lib/i18n.js';
import { T } from './util.jsx';

/** تفويض المدير المباشر: يسمح للمدير بتقديم/متابعة طلباتي نيابةً عني (والموارد البشرية تراجع وتعتمد) */
export default function Delegation() {
  useLang();
  const [d, setD] = useState(null), [busy, setBusy] = useState(false);
  useEffect(() => { rpc('ariba_my_delegation', {}).then(setD).catch(() => setD({ manager_id: null })); }, []);
  if (!d || !d.manager_id) return null;
  async function flip() {
    setBusy(true);
    try { const r = await rpc('ariba_set_delegation', { p_active: !d.active }); setD((o) => ({ ...o, active: r.active })); toast(r.active ? T('✓ فعّلت تفويض مديرك المباشر', '✓ Direct-manager delegation enabled') : T('✓ ألغيت التفويض', '✓ Delegation cancelled'), 'tin'); }
    catch (e) { toast(e.message || T('تعذر الحفظ', 'Could not save'), 'ter'); } finally { setBusy(false); }
  }
  return (
    <div className="card" id="delegCard">
      <div className="card-title">🤝 {T('تفويض المدير المباشر', 'Direct-manager delegation')}</div>
      <div style={{ fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.7 }}>{T('عند التفعيل يستطيع ' + (d.manager_name || 'مديرك المباشر') + ' تقديم الإجازات وطلباتك نيابةً عنك. تصل الموارد البشرية معلومة أنه قُدِّم بالنيابة وتعتمد أو ترفض، ويصلك إشعار وإيميل.', 'When enabled, ' + (d.manager_name || 'your direct manager') + ' can submit leaves and requests on your behalf. HR is told it was submitted on behalf and approves or rejects; you get a notification and email.')}</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontWeight: 700, fontSize: 13 }}>
        <input type="checkbox" id="delegChk" checked={!!d.active} disabled={busy} onChange={flip} /> {d.active ? T('مفعّل', 'Enabled') : T('غير مفعّل', 'Disabled')}
      </label>
    </div>
  );
}
