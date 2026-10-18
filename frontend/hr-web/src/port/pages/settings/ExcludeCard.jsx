import { useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { T } from '../../lib/i18n.js';
import { syncEmployee } from '../../lib/employees.js';
import { toast } from '../../components/Toast.jsx';
import { Card } from './shared.jsx';

/** استبعاد موظف من مسير الرواتب (V72): الحقل excludeFromPayroll على بيانات الموظف + مزامنة للسحابة */
export default function ExcludeCard() {
  const { employees, setEmployees } = useApp();
  const [id, setId] = useState('');
  const list = employees.filter((e) => e && (e.nameAr || e.nameEn) && !e.isTerminated && !e.term);
  const e = list.find((x) => String(x.id) === String(id));
  const set = async (val) => {
    if (!id) { toast(T('اختر الموظف أولاً', 'Select an employee first'), 'ter'); return; }
    if (!e) { toast(T('تعذر إيجاد الموظف', 'Employee not found'), 'ter'); return; }
    const n = { ...e, excludeFromPayroll: val };
    try { await syncEmployee(n); setEmployees((a) => a.map((x) => (String(x.id) === String(id) ? n : x))); toast(val ? T('✓ تم استبعاد الموظف من المسير', '✓ Employee excluded from payroll') : T('✓ تم إرجاع الموظف لمسير الرواتب', '✓ Employee returned to payroll'), 'tin'); }
    catch (x) { toast(T('تعذر الحفظ: ', 'Could not save: ') + (x.message || x), 'ter'); }
  };
  return (
    <Card icon="user-off" title={T('استبعاد موظف من مسير الرواتب', 'Exclude an employee from payroll')} max={9999} id="V72_EXCLUDE_CARD">
      <select id="V72_EMP" value={id} onChange={(ev) => setId(ev.target.value)} style={{ width: '100%', maxWidth: 420, marginBottom: 8 }}>
        <option value="">{T('— اختر الموظف —', '— Select employee —')}</option>
        {list.map((x) => <option key={x.id} value={x.id}>{(x.nameAr || x.nameEn || x.id) + (x.excludeFromPayroll ? T(' (مستبعد حاليًا)', ' (currently excluded)') : '')}</option>)}
      </select>
      <div id="V72_STATUS" style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 8 }}>{e ? (e.excludeFromPayroll ? T('⚠️ هذا الموظف مستبعد حاليًا من مسير الرواتب.', '⚠️ This employee is currently excluded from payroll.') : T('✓ هذا الموظف مُدرج حاليًا في مسير الرواتب.', '✓ This employee is currently included in payroll.')) : ''}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn bsm" style={{ background: 'var(--rd)', color: '#fff' }} onClick={() => set(true)}><i className="ti ti-user-off" /> {T('استبعاد من المسير', 'Exclude from payroll')}</button>
        <button className="btn bsm" style={{ background: 'var(--gr)', color: '#fff' }} onClick={() => set(false)}><i className="ti ti-user-check" /> {T('إرجاع للمسير', 'Return to payroll')}</button>
      </div>
    </Card>
  );
}
