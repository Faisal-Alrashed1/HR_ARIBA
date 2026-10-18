import { PT, MONTHS, curKey } from '../lib/goals.js';

/** اختيار الفترة: النوع + السنة + (الربع | الشهر) → {type,key} */
export default function PeriodPick({ type, keyv, onChange, compact }) {
  const y = keyv.slice(0, 4), yrs = []; const now = new Date().getFullYear(); for (let i = now - 2; i <= now + 1; i++) yrs.push(String(i));
  const set = (t, k) => onChange(t, k);
  const changeType = (t) => { const d = new Date(); const c = curKey(t, d); set(t, y === String(now) ? c : (t === 'annual' ? y : t === 'quarterly' ? y + '-Q1' : y + '-01')); };
  const sty = { width: compact ? 'auto' : undefined, minWidth: 90 };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <select id="PP_TYPE" value={type} onChange={(e) => changeType(e.target.value)} style={sty}>{Object.entries(PT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select id="PP_YEAR" value={y} onChange={(e) => set(type, type === 'annual' ? e.target.value : e.target.value + keyv.slice(4))} style={sty}>{yrs.map((v) => <option key={v}>{v}</option>)}</select>
      {type === 'quarterly' && <select id="PP_Q" value={keyv.slice(-1)} onChange={(e) => set(type, y + '-Q' + e.target.value)} style={sty}>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>الربع {q}</option>)}</select>}
      {type === 'monthly' && <select id="PP_M" value={keyv.slice(5)} onChange={(e) => set(type, y + '-' + e.target.value)} style={sty}>{MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}</select>}
    </div>
  );
}
