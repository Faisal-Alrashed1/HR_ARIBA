import { useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { curKey } from '../../lib/goals.js';
import TargetsEditor from '../../goals/TargetsEditor.jsx';
import EvalForm from '../../goals/EvalForm.jsx';

/** صفحة المستهدفات (page='goals') والتقييم (page='eval') في برنامج HR */
function Picker({ mode }) {
  const { activeEmps } = useApp();
  const [eid, setEid] = useState(''), [type, setType] = useState('quarterly'), [key, setKey] = useState(curKey('quarterly'));
  const emp = activeEmps.find((e) => String(e.id) === eid);
  const onPeriod = (t, k) => { setType(t); setKey(k); };
  return (
    <div className="pg on" id={mode === 'eval' ? 'pg-eval' : 'pg-goals'}>
      <div className="card">
        <div className="ch"><div className="ct"><i className={'ti ' + (mode === 'eval' ? 'ti-star' : 'ti-target')} /> <span>{mode === 'eval' ? 'تقييم الموظفين' : 'مستهدفات الموظفين'}</span></div>
          <select id="GP_EMP" value={eid} onChange={(e) => setEid(e.target.value)} style={{ minWidth: 260 }}><option value="">اختر الموظف…</option>{activeEmps.map((e) => <option key={e.id} value={e.id}>{e.nameAr} — {e.jobTitle || e.employer}</option>)}</select></div>
        <div style={{ padding: 14 }}>
          {!emp && <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 24 }}>{mode === 'eval' ? 'اختر موظفاً لتظهر مستهدفاته تلقائياً ويُقيَّم عليها.' : 'اختر موظفاً لعرض مستهدفاته أو إضافة مستهدفات (سنوية / ربع سنوية / شهرية).'}</div>}
          {emp && mode !== 'eval' && <TargetsEditor key={emp.id} employee={emp} type={type} keyv={key} onPeriod={onPeriod} />}
          {emp && mode === 'eval' && <EvalForm key={emp.id + type + key} employee={emp} type={type} keyv={key} onPeriod={onPeriod} />}
        </div>
      </div>
    </div>
  );
}
export const Eval = () => <Picker mode="eval" />;
export default function Goals() { return <Picker mode="goals" />; }
