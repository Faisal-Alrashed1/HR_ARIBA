import { useState } from 'react';
import { useLang } from '../../lib/i18n.js';
import { num, money } from '../../lib/finance.js';

const INP = { background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '7px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const TD = { padding: '7px 10px', borderBottom: '1px solid rgba(36,48,68,.25)', fontSize: 12.5 };
const Row = ({ l, v, bold, col }) => <tr><td style={{ ...TD, fontWeight: bold ? 800 : 400 }}>{l}</td><td style={{ ...TD, textAlign: 'left', direction: 'ltr', fontWeight: bold ? 800 : 600, color: col }}>{money(v)}</td></tr>;
export default function TaxCalc() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a);
  const [rate, setRate] = useState('15'), [inc, setInc] = useState(''), [exc, setExc] = useState('');
  const r = num(rate) / 100;
  const card = (title, label, val, set, body) => <div className="card" style={{ padding: 14, maxWidth: 560, marginBottom: 12 }}><div className="ct" style={{ marginBottom: 10 }}>{title}</div><label style={{ fontSize: 10.5, color: 'var(--mu)', display: 'block', marginBottom: 3, fontWeight: 600 }}>{label}</label><input type="number" step="0.01" value={val} onChange={(e) => set(e.target.value)} style={INP} /><div style={{ marginTop: 10 }}>{val !== '' && <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{body}</tbody></table>}</div></div>;
  const incV = num(inc), ex1 = incV / (1 + r), tx1 = ex1 * r, ex2 = num(exc), tx2 = ex2 * r;
  return (
    <div className="pg on" style={{ padding: '12px 16px' }}>
      <div className="card" style={{ padding: 14, maxWidth: 560, marginBottom: 12 }}><div className="ct" style={{ marginBottom: 10 }}><i className="ti ti-receipt-tax" /> {T('حاسبة الضريبة (القيمة المضافة)', 'VAT calculator')}</div>
        <label style={{ fontSize: 10.5, color: 'var(--mu)', display: 'block', marginBottom: 3, fontWeight: 600 }}>{T('نسبة الضريبة %', 'Tax rate %')}</label><input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} style={INP} /></div>
      {card(T('من المبلغ الإجمالي (شامل الضريبة)', 'From the total (tax included)'), T('المبلغ الإجمالي شامل الضريبة', 'Total amount incl. tax'), inc, setInc, <><Row l={T('المبلغ غير شامل الضريبة', 'Amount excl. tax')} v={ex1} /><Row l={T('مبلغ الضريبة', 'Tax amount')} v={tx1} col="var(--am)" /><Row l={T('الإجمالي شامل الضريبة', 'Total incl. tax')} v={ex1 + tx1} bold col="var(--gr)" /></>)}
      {card(T('من المبلغ (غير شامل الضريبة)', 'From the amount (tax excluded)'), T('المبلغ غير شامل الضريبة', 'Amount excl. tax'), exc, setExc, <><Row l={T('مبلغ الضريبة', 'Tax amount')} v={tx2} col="var(--am)" /><Row l={T('الإجمالي شامل الضريبة', 'Total incl. tax')} v={ex2 + tx2} bold col="var(--gr)" /><Row l={T('تأكيد: مجموع المبلغ والضريبة', 'Check: amount + tax')} v={ex2 + tx2} /></>)}
    </div>
  );
}
