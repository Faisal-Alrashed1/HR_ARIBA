import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { getInsSettings, isAutoRule } from '../../engines/insurance.js';
import { T } from '../../lib/i18n.js';
import { Card, useSaveSetting } from './shared.jsx';

const COLS = [['matchEmp', 'يطابق أقل من العمر', 'Match emp <age'], ['matchEmp55', 'يطابق العمر فأكثر', 'Match emp ≥age'], ['matchEr', 'شركة يطابق أقل', 'Match er <age'], ['matchEr55', 'شركة يطابق فأكثر', 'Match er ≥age'], ['noMatchEmp', 'لا يطابق موظف أقل', 'No-match emp <age'], ['noMatchEmp55', 'لا يطابق موظف فأكثر', 'No-match emp ≥age'], ['noMatchEr', 'لا يطابق شركة أقل', 'No-match er <age'], ['noMatchEr55', 'لا يطابق شركة فأكثر', 'No-match er ≥age'], ['nonSaudiEr', 'غير سعودي شركة', 'Non-Saudi er']];
export default function InsuranceCard() {
  const { settings } = useApp(); const save = useSaveSetting();
  const [S, setS] = useState(() => getInsSettings()); const [err, setErr] = useState('');
  useEffect(() => { setS(getInsSettings()); }, [settings.insurance]);
  const setRule = (i, k, v) => setS((s) => ({ ...s, effectiveRules: s.effectiveRules.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const go = () => {
    if (S.effectiveRules.some((r) => !r.date)) { setErr(T('أدخل تاريخ سريان لكل فترة', 'Enter an effective date for every period')); return; }
    const dates = S.effectiveRules.map((r) => r.date); if (new Set(dates).size !== dates.length) { setErr(T('تاريخ مكرر', 'Duplicate date')); return; }
    setErr('');
    const rules = S.effectiveRules.map((r) => { const o = { date: r.date }; COLS.forEach(([k]) => { o[k] = Number(r[k]) || 0; }); return o; }).sort((a, b) => a.date.localeCompare(b.date));
    return save('insurance', 'insurance_rules', { wageCap: Number(S.wageCap) || 45000, ageThreshold: Number(S.ageThreshold) || 55, effectiveRules: rules, updated: Date.now() }, T('تم حفظ إعدادات التأمينات', 'Insurance settings saved'));
  };
  const last = S.effectiveRules[S.effectiveRules.length - 1] || {};
  return (
    <Card icon="shield-check" title={T('التأمينات الاجتماعية — إعدادات النسب', 'Social insurance — rates')} max={1200} id="INS_CARD">
      <div className="al alb" style={{ marginTop: 8 }}><i className="ti ti-info-circle" /><span>{T('النسب هنا مطابقة لمنطق معادلة Excel الخاصة باريبا. التاريخ يحدد النسبة التي يستخدمها مسير الرواتب تلقائيًا.', 'Rates follow the Ariba Excel logic. The date picks the rate payroll uses automatically.')}</span></div>
      <div className="g2" style={{ marginTop: 10 }}>
        <div><label>{T('حد أجر الاشتراك', 'Wage cap')}</label><input id="INS_CAP" type="number" min="0" value={S.wageCap} onChange={(e) => setS({ ...S, wageCap: e.target.value })} /></div>
        <div><label>{T('حد العمر', 'Age threshold')}</label><input id="INS_AGE" type="number" min="0" value={S.ageThreshold} onChange={(e) => setS({ ...S, ageThreshold: e.target.value })} /></div>
      </div>
      <div className="tw" style={{ marginTop: 12, maxHeight: 420, overflow: 'auto' }}>
        <table><thead><tr><th>{T('تاريخ السريان', 'Effective date')}</th>{COLS.map((c) => <th key={c[0]}>{T(c[1], c[2])}</th>)}<th /></tr></thead>
          <tbody>{S.effectiveRules.map((r, i) => (
            <tr key={i}>
              <td><input type="date" data-ir="date" value={r.date || ''} onChange={(e) => setRule(i, 'date', e.target.value)} />{isAutoRule(r) && <span className="a145 b bg" style={{ fontSize: 9.5, marginInlineStart: 6 }}>{T('تلقائي', 'auto')}</span>}</td>
              {COLS.map(([k]) => <td key={k}><input type="number" step="0.01" data-ir={k} value={r[k] ?? ''} onChange={(e) => setRule(i, k, e.target.value)} /></td>)}
              <td><button className="btn bd bsm" onClick={() => S.effectiveRules.length > 1 && setS((s) => ({ ...s, effectiveRules: s.effectiveRules.filter((_, j) => j !== i) }))}>{T('حذف', 'Delete')}</button></td>
            </tr>))}</tbody></table>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn" id="INS_ADD" onClick={() => setS((s) => ({ ...s, effectiveRules: [...s.effectiveRules, { date: '', ...Object.fromEntries(COLS.map(([k]) => [k, last[k] ?? (k === 'nonSaudiEr' ? 2 : 0)])) }] }))}>{T('+ إضافة فترة جديدة', '+ Add a new period')}</button>
        <button className="btn bpl" id="INS_SAVE" onClick={go}>{T('حفظ إعدادات التأمينات', 'Save insurance settings')}</button>
      </div>
      {err && <div style={{ color: 'var(--rd)', fontSize: 12, marginTop: 6 }}>{err}</div>}
      <div className="al alb" style={{ marginTop: 10 }}><i className="ti ti-info-circle" /><span>{T('النسب المدخلة هنا هي النسب الإجمالية المستخدمة في معادلة اريبا وتشمل المعاشات وساند، وحصة الشركة تشمل الأخطار المهنية وفق النسبة التي تدخلها. لا يتم تعديل النسب التاريخية عند إضافة فترة جديدة.', 'The rates entered here are the total rates used in the Ariba formula and include pensions and SANED; the company share includes occupational hazards per the rate you enter. Historical rates are not changed when a new period is added.')}</span></div>
      <div className="a145-note" style={{ fontSize: 11.5, color: 'var(--mu)', marginTop: 8, lineHeight: 1.7 }}>{T('الصفوف "تلقائي" بتتضاف لوحدها كل 1 يوليو حسب نظام التأمينات الاجتماعية (الجديد بيزيد 0.5% كل سنة لحد 11.75% للموظف). لو عدّلت أي رقم في صف بيتحوّل "يدوي" وبيفضل مطبّق على الحسابات كلها.', 'Rows tagged "auto" are added by themselves each 1 July per the social insurance schedule (the new system adds 0.5% a year up to 11.75% for the employee). If you edit any number in a row it becomes "manual" and stays applied to all calculations.')}</div>
    </Card>
  );
}
