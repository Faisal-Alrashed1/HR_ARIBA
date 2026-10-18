import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { rt } from '../../engines/runtime.js';
import { T } from '../../lib/i18n.js';
import { rpc } from '../../lib/api.js';
import { toast } from '../../components/Toast.jsx';
import { Card, useSaveSetting } from './shared.jsx';

const DEF_AR = 'شركة اريبا لخدمات الأعمال', DEF_EN = 'Ariba Business Solutions';
export default function CompanyCard() {
  const { settings } = useApp(); const save = useSaveSetting();
  const n = settings.names || {};
  const [f, setF] = useState({ coAr: DEF_AR, coEn: DEF_EN, wst: '08:00', tol: 15, rmt: 10 });
  const touched = useRef(false);
  useEffect(() => { setF((s) => ({ coAr: n.coAr || DEF_AR, coEn: n.coEn || DEF_EN, wst: n.wst || '08:00', tol: n.tol || 15, rmt: touched.current ? s.rmt : (n.rmt || 10) })); }, [n.coAr, n.coEn, n.wst, n.tol, n.rmt]);
  // حد العمل عن بعد الحقيقي محفوظ في إعدادات الحضور (السحابة) وهو اللي بيظهر في تطبيق الموظف
  useEffect(() => { let off = false; rpc('ariba_get_attendance_settings', {}).then((r) => { if (!off && !touched.current && r && r.remote_days_per_year != null) setF((s) => ({ ...s, rmt: r.remote_days_per_year })); }).catch(() => {}); return () => { off = true; }; }, []);
  const set = (k) => (e) => { if (k === 'rmt') touched.current = true; setF((s) => ({ ...s, [k]: e.target.value })); };
  const go = async () => {
    const tol = Math.max(0, Math.min(240, parseInt(f.tol, 10) || 0)), rmt = Math.max(0, Math.min(366, parseInt(f.rmt, 10) || 0));
    const wst = /^\d{2}:\d{2}$/.test(f.wst) ? f.wst : '08:00';
    const v = { coAr: f.coAr.trim().slice(0, 120), coEn: f.coEn.trim().slice(0, 120), wst, tol, rmt, updated: Date.now() };
    const ok = await save('names', 'company_names', v, T('اتحفظت بيانات الشركة', 'Company details saved'));
    if (ok) {
      try { await rpc('ariba_hr_set_attendance_settings', { p_work_start: wst + ':00', p_tolerance_minutes: tol, p_remote_days_per_year: rmt }); toast(T('✓ حد العمل عن بعد وصل لتطبيق الموظف', '✓ Remote-work limit reached the Employee App'), 'tin'); }
      catch (e) { toast(T('⚠️ حد العمل عن بعد اتحفظ محليًا بس: ', '⚠️ Remote-work limit saved locally only: ') + (e && e.message || e), 'ter'); }
    }
    return ok;
  };
  return (
    <Card icon="settings" title={T('إعدادات الشركة', 'Company settings')} id="CO_CARD">
      <div className="fg">
        <div><label>{T('اسم الشركة بالعربي', 'Company name (Arabic)')}</label><input id="CN_AR" value={f.coAr} onChange={set('coAr')} maxLength={120} /></div>
        <div><label>{T('اسم الشركة بالإنجليزي', 'Company name (English)')}</label><input id="CN_EN" value={f.coEn} onChange={set('coEn')} maxLength={120} style={{ direction: 'ltr' }} /></div>
        <div><label>{T('نظام العمل', 'Labor law')}</label>
          <select id="CO_LAW" disabled value={rt.country === 'EG' ? 'EG' : 'SA'} onChange={() => {}} title={T('بيتحدد من كارت "نظام الدولة" تحت', 'Set from the "Country system" card below')}>
            <option value="SA">{T('المملكة العربية السعودية', 'Saudi Arabia')}</option><option value="EG">{T('مصر', 'Egypt')}</option><option value="AE">{T('الإمارات', 'UAE')}</option>
          </select></div>
        <div><label>{T('وقت بدء العمل', 'Work start time')}</label><input type="time" id="CO_ST" value={f.wst} onChange={set('wst')} /></div>
        <div><label>{T('هامش التأخير (دقيقة)', 'Lateness tolerance (min)')}</label><input type="number" id="CO_TOL" min="0" max="240" value={f.tol} onChange={set('tol')} /></div>
        <div><label>{T('حد العمل عن بعد (يوم/سنة)', 'Remote-work limit (days/year)')}</label><input type="number" id="CO_RMT" min="0" max="366" value={f.rmt} onChange={set('rmt')} /></div>
      </div>
      <button className="btn bpl" id="CO_SAVE" style={{ marginTop: 12 }} onClick={go}><i className="ti ti-check" /> <span>{T('حفظ', 'Save')}</span></button>
    </Card>
  );
}
