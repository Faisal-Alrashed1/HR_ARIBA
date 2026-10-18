import { useRef, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { T } from '../../lib/i18n.js';
import { readImage, isSafeDataImg } from '../../lib/images.js';
import { toast } from '../../components/Toast.jsx';
import { Card, useSaveSetting } from './shared.jsx';
import { setSetting } from '../../lib/api.js';
import { brandValue } from '../../lib/brand.js';

export default function PunchCard() {
  const { settings } = useApp(); const save = useSaveSetting(); const ref = useRef(null);
  const [stat, setStat] = useState('');
  const d = settings.punch && isSafeDataImg(settings.punch.data) ? settings.punch.data : '';
  // تطبيق الموظف بيقرأ الألوان من brand_colors — فنحط الشعار جواها كمان
  const mirror = async (data) => { try { await setSetting('brand_colors', brandValue(settings.brand, data)); } catch { /* ignore */ } };
  const done = async (ok, msg) => { setStat(msg + ' — ' + (ok ? T('اتحفظ ✓ وبيظهر في تطبيق الموظف خلال دقيقتين', 'Saved ✓ — shows in the employee app within two minutes') : T('ما اتحفظش على السيرفر (سجّل دخول سحابي)', 'Not saved to the server (sign in to the cloud)'))); setTimeout(() => setStat(''), 7000); };
  const pick = async (e) => { const f = e.target.files[0]; if (!f) return; try { const data = await readImage(f, { maxW: 520, maxH: 520, maxLen: 380000 }); const ok = await save('punch', 'punch_watermark', { data, updated: Date.now(), name: f.name.slice(0, 80) }, T('اتغيّر الشعار', 'Logo updated')); if (ok) await mirror(data); done(ok, T('اتغيّر الشعار', 'Logo updated')); } catch { toast(T('تعذر قراءة الصورة', 'Could not read the image'), 'ter'); } if (ref.current) ref.current.value = ''; };
  const rm = async () => { const ok = await save('punch', 'punch_watermark', { data: '', updated: Date.now() }, T('اتشال الشعار', 'Logo removed')); if (ok) await mirror(''); done(ok, T('اتشال الشعار', 'Logo removed')); };
  return (
    <Card icon="fingerprint" title={T('شعار خلف زر البصمة (تطبيق الموظف)', 'Logo behind the punch button (employee app)')} id="PW_CARD">
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div id="PW_PREV" style={{ width: 150, height: 150, background: '#fff', border: '1px dashed var(--bd)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, boxSizing: 'border-box' }}>
          {d ? <img src={d} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', opacity: 0.55 }} /> : <span style={{ color: 'var(--mu)', fontSize: 12 }}>{T('من غير شعار', 'No logo')}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 600, display: 'block', marginBottom: 4 }}>{T('اختار صورة الشعار (PNG بخلفية شفافة أفضل)', 'Choose the logo image (a transparent PNG works best)')}</label>
          <input ref={ref} type="file" id="PW_FILE" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ width: '100%', fontSize: 12 }} onChange={pick} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn bgr bsm" id="PW_RM" style={{ display: d ? '' : 'none' }} onClick={rm}>{T('إزالة الشعار', 'Remove the logo')}</button>
            <span id="PW_STAT" style={{ fontSize: 12, color: 'var(--mu)' }}>{stat || (d ? T('فيه شعار', 'Logo set') : T('الافتراضي: من غير شعار', 'Default: no logo'))}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 8, lineHeight: 1.7 }}>{T('بيظهر باهت خلف دايرة الحضور والانصراف. الافتراضي من غير أي شعار.', 'Shown faintly behind the check-in circle. Nothing is shown by default.')}</div>
        </div>
      </div>
    </Card>
  );
}
