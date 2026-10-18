import { useEffect, useState } from 'react';
import { rpc } from '../../lib/api.js';
import { T } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import { Card } from './shared.jsx';

const lb = { fontSize: 10, color: 'var(--mu)', display: 'block', marginBottom: 2 };
/** الساعة المرنة (V86): نطاق دخول + عدد ساعات — بتتحفظ في إعدادات الحضور بالسحابة وبتتطبّق على بصمة تطبيق الموظف */
export default function FlexCard() {
  const [from, setFrom] = useState('08:00'), [to, setTo] = useState('17:00'), [hours, setHours] = useState(8);
  const [st, setSt] = useState(null);
  const [rm, setRm] = useState({ on: false, from: '09:00', to: '15:00', hours: 6, d1: '', d2: '', today: false });
  const refresh = async () => {
    try {
      const r = await rpc('ariba_get_attendance_settings', {});
      if (r) setRm({ on: !!r.ramadan_flex_enabled, from: String(r.ramadan_window_start || '09:00').slice(0, 5), to: String(r.ramadan_window_end || '15:00').slice(0, 5), hours: r.ramadan_shift_hours || 6, d1: r.ramadan_from || '', d2: r.ramadan_to || '', today: !!r.is_ramadan_today });
      if (r && r.flex_window_start) setFrom(String(r.flex_window_start).slice(0, 5));
      if (r && r.flex_window_end) setTo(String(r.flex_window_end).slice(0, 5));
      if (r && r.flexible_enabled) { setHours(r.shift_hours); setSt({ on: true, from: String(r.flex_window_start).slice(0, 5), to: String(r.flex_window_end).slice(0, 5), hours: r.shift_hours }); }
      else setSt({ on: false });
    } catch { setSt({ on: false }); }
  };
  useEffect(() => { refresh(); }, []);
  const toggle = async (enabled) => {
    const h = parseFloat(hours) || 8;
    try {
      await rpc('ariba_hr_set_flexible_hours', { p_enabled: enabled, p_shift_hours: h, p_window_start: (from || '08:00') + ':00', p_window_end: (to || '17:00') + ':00' });
      toast(enabled ? T('✓ اتفعّلت الساعة المرنة (' + from + ' - ' + to + '، ' + h + ' ساعات)', '✓ Flexible hours enabled (' + from + ' - ' + to + ', ' + h + ' hours)') : T('✓ اتلغت الساعة المرنة، رجعنا لوقت الحضور الثابت', '✓ Flexible hours cancelled — back to fixed check-in time'), 'tin');
      refresh();
    } catch (e) { toast('⚠️ ' + (e.message || T('تعذر الحفظ', 'Could not save')), 'ter'); }
  };
  const saveRm = async (enabled) => {
    try {
      await rpc('ariba_hr_set_ramadan_flex', { p_enabled: enabled, p_shift_hours: parseFloat(rm.hours) || 6, p_window_start: (rm.from || '09:00') + ':00', p_window_end: (rm.to || '15:00') + ':00', p_from: rm.d1 || null, p_to: rm.d2 || null });
      toast(enabled ? T('✓ اتفعّلت الساعة المرنة في رمضان', '✓ Ramadan flexible hours enabled') : T('✓ اتلغت الساعة المرنة في رمضان', '✓ Ramadan flexible hours cancelled'), 'tin'); refresh();
    } catch (e) { toast('⚠️ ' + (e.message || T('تعذر الحفظ', 'Could not save')), 'ter'); }
  };
  return (
    <Card icon="clock-hour-4" title={T('الساعة المرنة', 'Flexible hours')} id="V86_FLEX_CARD">
      <div style={{ fontSize: 11.5, color: 'var(--mu)', marginBottom: 10 }}>{T('لما تتفعّل، الموظف يدخل أي وقت داخل نطاق الدوام المحدد تحت، ووقت انصرافه المفروض = وقت دخوله + عدد الساعات (مثال: نطاق 8 إلى 5، دوام 8 ساعات → دخل 8 يمشي 4، دخل 9 يمشي 5). لو الدخول هيخلي الانصراف يعدي نهاية النطاق، البصمة بترفض.', 'When enabled, employees can check in at any time inside the window below and their expected check-out = check-in + the shift hours (example: window 8 to 5, 8-hour shift → in at 8 leaves at 4, in at 9 leaves at 5). If a check-in would push the check-out past the end of the window, the punch is rejected.')}</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div><label style={lb}>{T('من الساعة', 'From')}</label><input type="time" id="V86_FROM" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 110 }} /></div>
        <div><label style={lb}>{T('إلى الساعة', 'To')}</label><input type="time" id="V86_TO" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 110 }} /></div>
        <div><label style={lb}>{T('عدد ساعات الدوام', 'Shift hours')}</label><input type="number" id="V86_HOURS" value={hours} min="1" max="16" step="0.5" onChange={(e) => setHours(e.target.value)} style={{ width: 100 }} /></div>
        <button className="btn bsm" style={{ background: '#0a7a3f', color: '#fff' }} onClick={() => toggle(true)}><i className="ti ti-clock-play" /> {T('تفعيل الساعة المرنة', 'Enable flexible hours')}</button>
        <button className="btn bsm" style={{ background: 'var(--rd)', color: '#fff' }} onClick={() => toggle(false)}><i className="ti ti-clock-cancel" /> {T('إلغاء الساعة المرنة', 'Cancel flexible hours')}</button>
      </div>
      <div id="V86_STATUS" style={{ marginTop: 10, fontSize: 12, fontWeight: 700 }}>
        {st && (st.on
          ? <span style={{ color: '#0a7a3f' }}>{T('🟢 الساعة المرنة مفعّلة الآن — نطاق ' + st.from + ' إلى ' + st.to + '، ' + st.hours + ' ساعات دوام', '🟢 Flexible hours are on — window ' + st.from + ' to ' + st.to + ', ' + st.hours + ' shift hours')}</span>
          : <span style={{ color: 'var(--mu)' }}>{T('⚪ الساعة المرنة غير مفعّلة (وقت حضور ثابت)', '⚪ Flexible hours are off (fixed check-in time)')}</span>)}
      </div>
      <div id="RMD_FLEX" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--bd)' }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--am)', marginBottom: 4 }}>🌙 {T('الساعة المرنة في رمضان', 'Flexible hours in Ramadan')}</div>
        <div style={{ fontSize: 11.5, color: 'var(--mu)', marginBottom: 10 }}>{T('تتفعّل تلقائياً كل سنة مع دخول رمضان (التقويم الهجري) وترجع للوضع العادي بعد انتهائه، بدون أي تدخل. التواريخ اليدوية اختيارية لتصحيح بداية/نهاية الشهر لو اختلفت الرؤية.', 'Applies automatically every year when Ramadan starts (Hijri calendar) and reverts afterwards. Manual dates are optional to correct moon-sighting differences.')}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div><label style={lb}>{T('من الساعة', 'From')}</label><input type="time" id="RMD_FROM" value={rm.from} onChange={(e) => setRm({ ...rm, from: e.target.value })} style={{ width: 110 }} /></div>
          <div><label style={lb}>{T('إلى الساعة', 'To')}</label><input type="time" id="RMD_TO" value={rm.to} onChange={(e) => setRm({ ...rm, to: e.target.value })} style={{ width: 110 }} /></div>
          <div><label style={lb}>{T('ساعات الدوام', 'Shift hours')}</label><input type="number" id="RMD_HOURS" value={rm.hours} min="1" max="16" step="0.5" onChange={(e) => setRm({ ...rm, hours: e.target.value })} style={{ width: 90 }} /></div>
          <div><label style={lb}>{T('بداية رمضان (اختياري)', 'Ramadan start (optional)')}</label><input type="date" value={rm.d1} onChange={(e) => setRm({ ...rm, d1: e.target.value })} /></div>
          <div><label style={lb}>{T('نهايته (اختياري)', 'End (optional)')}</label><input type="date" value={rm.d2} onChange={(e) => setRm({ ...rm, d2: e.target.value })} /></div>
          <button className="btn bsm" id="RMD_ON" style={{ background: '#0a7a3f', color: '#fff' }} onClick={() => saveRm(true)}><i className="ti ti-moon" /> {T('تفعيل', 'Enable')}</button>
          <button className="btn bsm" id="RMD_OFF" style={{ background: 'var(--rd)', color: '#fff' }} onClick={() => saveRm(false)}>{T('إلغاء', 'Cancel')}</button>
        </div>
        <div id="RMD_STATUS" style={{ marginTop: 8, fontSize: 12, fontWeight: 700 }}>{rm.on ? <span style={{ color: '#0a7a3f' }}>{T('🟢 مفعّلة لرمضان — ' + rm.from + ' إلى ' + rm.to + '، ' + rm.hours + ' ساعات', '🟢 On for Ramadan — ' + rm.from + ' to ' + rm.to + ', ' + rm.hours + ' h')}{rm.today ? T(' (سارية اليوم)', ' (active today)') : ''}</span> : <span style={{ color: 'var(--mu)' }}>{T('⚪ غير مفعّلة', '⚪ Off')}</span>}</div>
      </div>
    </Card>
  );
}
