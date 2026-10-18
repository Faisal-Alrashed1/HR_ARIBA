import { useRef, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { T } from '../../lib/i18n.js';
import { logoOf } from '../../lib/branding.js';
import { readImage } from '../../lib/images.js';
import { toast } from '../../components/Toast.jsx';
import { Card, useSaveSetting } from './shared.jsx';

export default function LogoCard() {
  const { settings } = useApp(); const save = useSaveSetting(); const ref = useRef(null);
  const [stat, setStat] = useState('');
  const src = logoOf(settings);
  const pick = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { const data = await readImage(f, { maxW: 520, maxH: 520, maxLen: 420000 }); const ok = await save('logo', 'company_logo', { data, updated: Date.now(), name: f.name.slice(0, 80) }, T('اتغيّر الشعار', 'Logo updated')); setStat(T('اتغيّر الشعار', 'Logo updated') + ' — ' + (ok ? T('اتحفظ على السيرفر ✓', 'Saved to the server ✓') : T('ما اتحفظش على السيرفر', 'Not saved to the server'))); setTimeout(() => setStat(''), 6000); }
    catch { toast(T('تعذر قراءة الصورة', 'Could not read the image'), 'ter'); }
    if (ref.current) ref.current.value = '';
  };
  const reset = async () => { const ok = await save('logo', 'company_logo', { data: '', updated: Date.now() }, T('اتشال الشعار', 'Logo removed')); setStat(T('اتشال الشعار', 'Logo removed') + ' — ' + (ok ? T('اتحفظ على السيرفر ✓', 'Saved to the server ✓') : T('ما اتحفظش على السيرفر', 'Not saved to the server'))); setTimeout(() => setStat(''), 6000); };
  const lbl = { fontSize: 11, color: 'var(--mu)', fontWeight: 600, display: 'block', marginBottom: 4 };
  return (
    <Card icon="photo" title={T('شعار الشركة', 'Company logo')} id="LG_CARD">
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div id="LG_PREV" style={{ width: 190, height: 110, background: '#fff', border: '1px dashed var(--bd)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, boxSizing: 'border-box' }}>
          {src ? <img src={src} alt="" style={{ maxHeight: 90, maxWidth: '100%', objectFit: 'contain' }} /> : <span style={{ color: 'var(--mu)', fontSize: 12 }}>{T('لا يوجد شعار', 'No logo')}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 210 }}>
          <label style={lbl}>{T('اختار صورة الشعار', 'Choose the logo image')}</label>
          <input ref={ref} type="file" id="LG_FILE" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={pick} style={{ width: '100%', fontSize: 12 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn bgr bsm" id="LG_RESET" style={{ display: src ? '' : 'none' }} onClick={reset}>{T('إزالة الشعار', 'Remove the logo')}</button>
            <span id="LG_STAT" style={{ fontSize: 12, color: 'var(--mu)' }}>{stat || (src ? T('شعار الشركة', 'Company logo') : T('بدون شعار', 'No logo'))}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
