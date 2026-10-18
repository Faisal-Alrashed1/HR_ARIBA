import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { T } from '../../lib/i18n.js';
import { normSchedule, scheduleFor, isRamadan } from '../../lib/schedule.js';
import { Card, Note, useSaveSetting } from './shared.jsx';

const lb = { fontSize: 10, color: 'var(--mu)', display: 'block', marginBottom: 2 };
const Row = ({ title, v, set, color }) => (
  <div style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: 10, flex: 1, minWidth: 280, borderTop: '3px solid ' + color }}>
    <b style={{ fontSize: 12.5 }}>{title}</b>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      <div><label style={lb}>{T('بداية الدوام', 'Start')}</label><input type="time" value={v.start} onChange={(e) => set({ start: e.target.value })} style={{ width: 105 }} /></div>
      <div><label style={lb}>{T('نهاية الدوام', 'End')}</label><input type="time" value={v.end} onChange={(e) => set({ end: e.target.value })} style={{ width: 105 }} /></div>
      <div><label style={lb}>{T('ساعات العمل المطلوبة', 'Required hours')}</label><input type="number" min="1" max="16" step="0.5" value={v.hours} onChange={(e) => set({ hours: e.target.value })} style={{ width: 95 }} /></div>
      <div><label style={lb}>{T('سماح التأخير (دقيقة)', 'Grace (min)')}</label><input type="number" min="0" max="120" value={v.grace} onChange={(e) => set({ grace: e.target.value })} style={{ width: 95 }} /></div>
    </div>
  </div>
);
/** جدول الدوام الرسمي + دوام رمضان (يتبدّل تلقائياً) — يُطبَّق على حساب التأخير والخروج المبكر والساعات */
export default function ScheduleCard() {
  const { settings } = useApp(); const save = useSaveSetting();
  const [c, setC] = useState(() => normSchedule(settings && settings.schedule));
  useEffect(() => { setC(normSchedule(settings && settings.schedule)); }, [settings && settings.schedule]); // eslint-disable-line
  const today = new Date().toISOString().slice(0, 10), now = scheduleFor(today, c), ram = isRamadan(today, c);
  const go = () => save('schedule', 'attendance_schedule', { ...c, official: { ...c.official, hours: +c.official.hours, grace: +c.official.grace }, ramadan: { ...c.ramadan, hours: +c.ramadan.hours, grace: +c.ramadan.grace } }, T('اتحفظ جدول الدوام', 'Working schedule saved'));
  return (
    <Card icon="calendar-time" title={T('جدول الدوام (رسمي + رمضان)', 'Working schedule (official + Ramadan)')} id="SCHED_CARD">
      <Note style={{ marginBottom: 10 }}>{T('الحضور يتحسب على الجدول المُطبَّق: الدوام الرسمي في الأيام العادية، ودوام رمضان تلقائياً مع دخول رمضان (حسب التقويم الهجري) بدون أي تدخل. ساعات اليوم = مجموع كل فترات الدخول والخروج (مثال: 8→12 ثم 13→16).', 'Attendance is calculated on the applied schedule: official hours normally and Ramadan hours automatically when Ramadan starts (Hijri calendar). Daily hours = sum of all in/out periods (e.g. 8→12 then 13→16).')}</Note>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, marginBottom: 10 }}><input type="checkbox" checked={c.enabled} onChange={(e) => setC({ ...c, enabled: e.target.checked })} /> {T('تفعيل حساب الحضور على الجدول', 'Calculate attendance on this schedule')}</label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Row title={T('الدوام الرسمي', 'Official hours')} v={c.official} color="var(--gr)" set={(p) => setC({ ...c, official: { ...c.official, ...p } })} />
        <Row title={T('دوام رمضان', 'Ramadan hours')} v={c.ramadan} color="var(--am)" set={(p) => setC({ ...c, ramadan: { ...c.ramadan, ...p } })} />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><input type="checkbox" checked={c.ramadanAuto} onChange={(e) => setC({ ...c, ramadanAuto: e.target.checked })} /> {T('رمضان تلقائياً (التقويم الهجري)', 'Auto-detect Ramadan (Hijri)')}</label>
        <div><label style={lb}>{T('أو تواريخ رمضان يدوياً: من', 'Or manual Ramadan: from')}</label><input type="date" value={c.ramadanFrom} onChange={(e) => setC({ ...c, ramadanFrom: e.target.value })} /></div>
        <div><label style={lb}>{T('إلى', 'to')}</label><input type="date" value={c.ramadanTo} onChange={(e) => setC({ ...c, ramadanTo: e.target.value })} /></div>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700 }}>{ram ? '🌙 ' : '🏢 '}{T('المُطبَّق اليوم: ', 'Applied today: ')}{ram ? T('دوام رمضان', 'Ramadan') : T('الدوام الرسمي', 'Official')} — {now.start} → {now.end} ({now.hours} {T('ساعات', 'h')})</div>
      <button className="btn bpl bsm" style={{ marginTop: 10 }} onClick={go}><i className="ti ti-device-floppy" /> {T('حفظ', 'Save')}</button>
    </Card>
  );
}
