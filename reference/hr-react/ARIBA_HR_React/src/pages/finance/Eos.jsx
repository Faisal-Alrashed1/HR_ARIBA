import { useMemo, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { fD, fN, num, r2, money, pd, iso, saveXlsx, esc, printOfficial } from '../../lib/finance.js';

export const LAWS = { m84: ['م.84 — إنهاء من الشركة', 'Art.84 — Employer termination'], m74: ['م.74 — اتفاق الطرفين', 'Art.74 — Mutual'], m85: ['م.85 — استقالة', 'Art.85 — Resignation'], m75: ['م.75 — استقالة قسرية', 'Art.75 — Forced resignation'], m77: ['م.77 — فصل تعسفي', 'Art.77 — Arbitrary dismissal'], m80: ['م.80 — فصل تأديبي', 'Art.80 — Disciplinary'], m74r: ['م.74(4) — تقاعد', 'Art.74(4) — Retirement'], m74d: ['م.74(3) — وفاة/عجز', 'Art.74(3) — Death/disability'] };
/** مكافأة نهاية الخدمة حسب المادة (نظام العمل السعودي) */
export function eosByLaw(sal, hou, yrs, law) {
  const base = sal + hou, y1 = Math.min(yrs, 5), y2 = Math.max(0, yrs - 5), e84 = r2((base / 2) * y1 + base * y2);
  if (law === 'm84' || law === 'm74' || law === 'm74r' || law === 'm74d') return e84;
  if (law === 'm85' || law === 'm75') { if (yrs < 2) return 0; if (yrs < 5) return r2(e84 / 3); if (yrs < 10) return r2(e84 * 2 / 3); return e84; }
  if (law === 'm77') return r2(e84 + Math.max(Math.round(base * 2), Math.round((base / 30) * 15 * yrs)));
  return 0;
}
/** مدة الخدمة y/m/d كما في النظام القديم */
export function duration(d1, d2) {
  let fy = d2.getFullYear() - d1.getFullYear();
  if (d2.getMonth() < d1.getMonth() || (d2.getMonth() === d1.getMonth() && d2.getDate() < d1.getDate())) fy--;
  let tmp = new Date(d1.getFullYear() + fy, d1.getMonth(), d1.getDate()), fm = 0;
  while (new Date(tmp.getFullYear(), tmp.getMonth() + 1, tmp.getDate()) <= d2) { tmp = new Date(tmp.getFullYear(), tmp.getMonth() + 1, tmp.getDate()); fm++; }
  const fd = Math.round((d2 - tmp) / 86400000) + 1;
  return { fy, fm, fd, total: fy + fm / 12 + fd / 360 };
}
const TD = { padding: '7px 10px', borderBottom: '1px solid rgba(36,48,68,.25)', textAlign: 'right', fontSize: 11 };
const TH = { padding: '7px 10px', textAlign: 'right', fontSize: 10, fontWeight: 700, borderBottom: '2px solid var(--bl)', background: 'var(--c2)' };
const INP = { background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '6px 9px', fontSize: 12 };

export default function Eos() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a); const { employees, settings } = useApp();
  const [date, setDate] = useState(''), [law, setLaw] = useState('m84'), [er, setEr] = useState('');
  const endD = pd(date) || new Date(new Date().toDateString());
  const base = useMemo(() => employees.filter((e) => e && !e.isHourly && !e.isTerminated && !e.term && e.excludeFromEOS !== true), [employees]);
  const ers = useMemo(() => [...new Set(base.map((e) => e.employer).filter(Boolean))].sort(), [base]);
  const rows = useMemo(() => base.filter((e) => !er || e.employer === er).map((e) => {
    const j = pd(e.contractJoin), yrs = j ? Math.max(0, r2((endD - j) / (365.25 * 86400000))) : num(e.yearsOfService);
    const sal = num(e.salary || e.sal), hou = num(e.housingAllowance || e.hou), d = j ? duration(j, endD) : null;
    return { e, join: e.contractJoin || '', dur: d ? d.fy + T(' سنة ', 'y ') + d.fm + T(' شهر ', 'm ') + d.fd + T(' يوم', 'd') : yrs.toFixed(2), sal, hou, base: sal + hou, eos: eosByLaw(sal, hou, yrs, law) };
  }), [base, er, law, date]); // eslint-disable-line
  const totB = rows.reduce((a, r) => a + r.base, 0), totE = rows.reduce((a, r) => a + r.eos, 0), lawName = LAWS[law][en ? 1 : 0], LAWN = { m84: 'م.84 إنهاء الشركة', m74: 'م.74 اتفاق', m85: 'م.85 استقالة', m75: 'م.75 قسرية', m77: 'م.77 تعسفي', m80: 'م.80 تأديبي', m74r: 'م.74(4) تقاعد', m74d: 'م.74(3) وفاة' }, lawShort = en ? lawName : (LAWN[law] || lawName);
  const nm = (e) => String((en ? (e.nameEn || e.nameAr) : (e.nameAr || e.nameEn)) || '').split(' ').slice(0, 3).join(' ');
  const head = [T('م', '#'), T('الموظف', 'Employee'), T('جهة العمل', 'Employer'), T('المباشرة', 'Joined'), T('الخدمة', 'Service'), T('الأساسي', 'Basic'), T('السكن', 'Housing'), T('الوعاء', 'Base'), lawShort];
  function xlsx() { saveXlsx('EOS_' + law + '_' + iso(endD) + '.xlsx', [{ name: 'EOS', rows: [[T('مكافأة نهاية الخدمة — ', 'End of service — ') + lawName + ' — ' + iso(endD)], [], head, ...rows.map((r, i) => [i + 1, nm(r.e), r.e.employer || '', r.join, r.dur, r2(r.sal), r2(r.hou), r2(r.base), r2(r.eos)]), [T('الإجمالي', 'Total'), '', '', '', '', '', '', r2(totB), r2(totE)]], widths: [6, 28, 16, 12, 18, 12, 12, 12, 16] }]); }
  function print() {
    const th = 'background:#014D3D;color:#fff;padding:4px;font-size:9px;border:1px solid #014D3D', td = 'padding:3px 5px;border:1px solid #d9e3df;font-size:9.5px;text-align:center';
    const body = rows.map((r, i) => '<tr><td style="' + td + '">' + (i + 1) + '</td><td style="' + td + ';text-align:right">' + esc(nm(r.e)) + '</td><td style="' + td + '">' + esc(r.e.employer || '') + '</td><td style="' + td + '">' + esc(r.join) + '</td><td style="' + td + '">' + esc(r.dur) + '</td><td style="' + td + '">' + money(r.sal) + '</td><td style="' + td + '">' + money(r.hou) + '</td><td style="' + td + '">' + money(r.base) + '</td><td style="' + td + ';font-weight:700">' + money(r.eos) + '</td></tr>').join('');
    const h = '<div dir="' + (en ? 'ltr' : 'rtl') + '" style="font-family:Tahoma,Arial,sans-serif;padding:0 8mm"><div style="text-align:center;font-weight:800;color:#014D3D;margin:3mm 0">' + esc(T('مكافأة نهاية الخدمة — ', 'End of service — ') + lawName) + ' (' + iso(endD) + ')</div><table style="width:100%;border-collapse:collapse"><thead><tr>' + head.map((x) => '<th style="' + th + '">' + esc(x) + '</th>').join('') + '</tr></thead><tbody>' + body + '<tr style="font-weight:800;background:#eef5f2"><td colspan="7" style="' + td + '">' + T('الإجمالي', 'Total') + '</td><td style="' + td + '">' + money(totB) + '</td><td style="' + td + '">' + money(totE) + '</td></tr></tbody></table></div>';
    printOfficial(settings, T('نهاية الخدمة', 'End of service'), h, { dir: en ? 'ltr' : 'rtl', lang: en ? 'en' : 'ar' });
  }
  const K = ({ l, v, c }) => <div style={{ background: c + '15', border: '1px solid ' + c + '44', borderRadius: 10, padding: 10, textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--mu)' }}>{l}</div><div style={{ fontSize: 14, fontWeight: 800, color: c }}>{v}</div></div>;
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--c2)', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--bd)' }}>
          <label style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 600 }}>{T('تاريخ الإنهاء:', 'End date:')}</label>
          <input type="date" id="eosEndDate" value={date} onChange={(x) => setDate(x.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--tx)', fontSize: 12 }} />
          <button onClick={() => setDate('')} style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer', fontSize: 11 }}>{T('اليوم', 'Today')}</button>
        </div>
        <select id="eosLawSel" style={INP} value={law} onChange={(x) => setLaw(x.target.value)}>{Object.entries(LAWS).map(([k, v]) => <option key={k} value={k}>{v[en ? 1 : 0]}</option>)}</select>
        <select id="eosEmpFilter" style={INP} value={er} onChange={(x) => setEr(x.target.value)}><option value="">{T('كل جهات العمل', 'All employers')}</option>{ers.map((x) => <option key={x}>{x}</option>)}</select>
        <button className="btn bsm" style={{ background: 'var(--pu)', color: '#fff' }} onClick={xlsx}><i className="ti ti-file-spreadsheet" /> Excel</button>
      </div>
      <div id="eosKPIs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginBottom: 10 }}>
        <K l={T('القانون', 'Law')} v={lawShort} c="#3b82f6" /><K l={T('إجمالي المكافآت', 'Total EOS')} v={fN(Math.round(totE)) + ' ' + T('ر.س', 'SAR')} c="#10b981" /><K l={T('إجمالي الوعاء', 'Total base')} v={fN(Math.round(totB)) + ' ' + T('ر.س', 'SAR')} c="#06b6d4" /><K l={T('عدد الموظفين', 'Employees')} v={rows.length} c="#8b5cf6" />
      </div>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead id="eosHead"><tr>{head.map((x, i) => <th key={i} style={i === 8 ? { ...TH, textAlign: 'center', background: 'rgba(59,130,246,.12)', color: 'var(--bl)' } : TH}>{x}</th>)}</tr></thead>
          <tbody id="eosBody">{rows.map((r, i) => <tr key={r.e.id}>
            <td style={{ ...TD, color: 'var(--dm)' }}>{i + 1}</td><td style={{ ...TD, fontWeight: 600 }}>{nm(r.e)}</td><td style={TD}><span className="b bb" style={{ fontSize: 10 }}>{r.e.employer}</span></td><td style={TD}>{fD(r.join)}</td>
            <td style={{ ...TD, color: 'var(--pu)', fontWeight: 600 }}>{r.dur}</td><td style={{ ...TD, color: 'var(--gr)' }}>{fN(r.sal)}</td><td style={TD}>{fN(r.hou)}</td><td style={{ ...TD, color: 'var(--cy)', fontWeight: 600 }}>{fN(r.base)}</td>
            <td style={{ ...TD, textAlign: 'center', fontWeight: r.eos > 0 ? 700 : 400, color: r.eos === 0 ? 'var(--dm)' : law === 'm77' ? 'var(--rd)' : 'var(--bl)' }}>{r.eos > 0 ? fN(r.eos) + ' ' + T('ر.س', 'SAR') : '—'}</td></tr>)}</tbody>
          <tfoot id="eosFoot"><tr style={{ fontWeight: 700 }}><td style={{ ...TD, background: 'rgba(59,130,246,.08)' }} colSpan={7}>{T('الإجمالي (' + rows.length + ' موظف)', 'Total (' + rows.length + ' employees)')}</td><td style={{ ...TD, background: 'rgba(59,130,246,.08)', color: 'var(--cy)' }}>{fN(Math.round(totB))}</td><td style={{ ...TD, background: 'rgba(59,130,246,.08)', color: 'var(--bl)', textAlign: 'center' }}>{fN(Math.round(totE))} {T('ر.س', 'SAR')}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}
