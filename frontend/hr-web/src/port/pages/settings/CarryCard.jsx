import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { T } from '../../lib/i18n.js';
import { Card, Note, useSaveSetting } from './shared.jsx';

export default function CarryCard() {
  const { settings } = useApp(); const save = useSaveSetting();
  const c = settings.carry && typeof settings.carry === 'object' ? settings.carry : { enabled: false, days: 0 };
  const [en, setEn] = useState(!!c.enabled), [d, setD] = useState(c.days || 0), [err, setErr] = useState('');
  useEffect(() => { setEn(!!c.enabled); setD(c.days || 0); }, [c.enabled, c.days]);
  const go = async () => {
    const days = Math.max(0, Number(d) || 0);
    if (en && days <= 0) { setErr(T('اكتب عدد الأيام', 'Enter the number of days')); return; }
    setErr(''); await save('carry', 'leave_carry', { enabled: en, days }, T('اتحفظ إعداد ترحيل الإجازات', 'Leave carry-over saved'));
  };
  return (
    <Card icon="calendar-repeat" title={T('ترحيل أرصدة الإجازات', 'Leave balance carry-over')} id="LC_CARD">
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600 }}><input type="checkbox" id="LC_EN" checked={en} onChange={(e) => { setEn(e.target.checked); if (e.target.checked && !(Number(d) > 0)) setD(10); }} /> {T('تفعيل ترحيل الأرصدة بعدد أيام محدد', 'Enable carry-over with a day limit')}</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12 }}>{T('أقصى عدد أيام يتم ترحيله للسنة التالية', 'Max days carried to next year')}</span>
        <input type="number" id="LC_DAYS" min="0" step="0.5" value={d} disabled={!en} onChange={(e) => setD(e.target.value)} style={{ width: 100 }} />
        <button className="btn bpl bsm" id="LC_SAVE" onClick={go}>{T('حفظ', 'Save')}</button>
        {err && <span style={{ color: 'var(--rd)', fontSize: 12 }}>{err}</span>}
      </div>
      <Note style={{ marginTop: 8 }}>{en ? T(`الترحيل شغال: أقصى ${Number(d) || 0} يوم يتنقل للسنة الجديدة والباقي بيروح لرصيد نهاية الخدمة.`, `Carry-over ON: up to ${Number(d) || 0} days roll into the new year; the rest goes to end-of-service leave.`) : T('الترحيل مفتوح بدون حد: كل الرصيد المتبقي بيتنقل للسنة الجديدة ومفيش فائض نهاية خدمة.', 'Unlimited carry-over: the whole remaining balance rolls into the new year; no end-of-service excess.')}</Note>
      <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 6, lineHeight: 1.7 }}>{T('بيتطبق على كل الموظفين وكل السنين (الجدول والكروت وتطبيق الموظف). السنوات اللي عدّلتها يدوياً من "تعديل الرصيد" بتفضل بقيمها المحفوظة.', 'Applies to all employees and years (table, cards, Employee App). Years you edited manually via "Edit balance" keep their saved values.')}</div>
    </Card>
  );
}

/** طريقة احتساب استحقاق الإجازة السنوية حتى اليوم */
export function AccrualCard() {
  const { settings } = useApp(); const save = useSaveSetting();
  const am = settings.accrual && settings.accrual.method ? settings.accrual.method : 'calendar';
  const setAm = (m) => save('accrual', 'leave_accrual_method', { method: m }, T('اتحفظت طريقة احتساب الاستحقاق', 'Accrual method saved'));
  const AM = [['calendar', T('أيام تقويمية', 'Calendar days'), T('السنوي × (عدد الأيام من أول السنة/المباشرة حتى اليوم ÷ أيام السنة 365)', 'Annual × (days elapsed ÷ days in year)')], ['workdays', T('أيام العمل', 'Workdays'), T('السنوي × (أيام العمل المنقضية أحد–خميس بدون الإجازات الرسمية ÷ أيام عمل السنة)', 'Annual × (workdays elapsed ÷ workdays in year)')], ['monthly', T('شهرياً', 'Monthly'), T('السنوي ÷ 12 لكل شهر، والشهر الحالي بالتناسب', 'Annual ÷ 12 per month, current month prorated')]];
  return (
    <Card icon="calculator" title={T('طريقة احتساب الاستحقاق السنوي حتى اليوم', 'Annual leave accrual method')} id="LC_ACC_CARD">
      <div id="LC_ACCRUAL" style={{ display: 'grid', gap: 6 }}>
        {AM.map(([k, l, d]) => <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, border: '1px solid ' + (am === k ? 'var(--gr)' : 'var(--bd)') }}><input type="radio" name="lcam" checked={am === k} onChange={() => setAm(k)} style={{ marginTop: 3 }} /><span><b>{l}</b><br /><span style={{ color: 'var(--mu)', fontSize: 11.5 }}>{d}</span></span></label>)}
      </div>
      <Note style={{ marginTop: 6 }}>{T('يتطبق على كل الموظفين وكل السنين، ومعادلة الرصيد في صفحة الأرصدة بتتغير معاه.', 'Applies to all employees and years; the balance equation follows it.')}</Note>
    </Card>
  );
}
