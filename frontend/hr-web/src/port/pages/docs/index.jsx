import { useMemo, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { daysLeft } from '../../lib/util.js';
import { fD } from '../../lib/finance.js';
import { printHtml, esc } from '../../lib/print.js';

const dB = (d, T) => (d == null || d >= 9999 ? <span className="b bk">—</span> : d <= 0 ? <span className="b br">{T('منتهي', 'Expired')}</span> : <span className={'b ' + (d <= 30 ? 'br' : d <= 90 ? 'ba' : 'bg')}>{d}{T('ي', 'd')}</span>);
const st = (d, none, T, fem) => (none ? <span className="b bk">{none}</span> : d != null && d <= 0 ? <span className="b br">{fem ? T('منتهية', 'Expired') : T('منتهي', 'Expired')}</span> : <span className="b bg">{fem ? T('سارية', 'Valid') : T('ساري', 'Valid')}</span>);

export default function Docs() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a); const { employees, reload } = useApp();
  const [tab, setTab] = useState('iqama');
  const a = useMemo(() => employees.filter((e) => e && !e.isTerminated && !e.term), [employees]);
  const nm = (e) => (en ? (e.nameEn || e.nameAr) : (e.nameAr || e.nameEn)) || '—';
  const inc = T('غير مكتمل', 'Incomplete');
  const TABS = {
    iqama: { t: T('🪪 الإقامات', '🪪 Iqamas'), h: [T('رقم الإقامة', 'Iqama no.'), T('جهة العمل', 'Employer'), T('الانتهاء', 'Expiry'), T('المتبقي', 'Left'), T('الحالة', 'Status')],
      r: (e) => { const d = e.iqamaExpiry ? daysLeft(e.iqamaExpiry) : null; return { c: [e.iqamaNo || '—', e.employer || '—', fD(e.iqamaExpiry), dB(d, T), st(d, !e.iqamaNo && !e.iqamaExpiry ? inc : '', T, true)], p: [e.iqamaNo || '—', e.employer || '—', fD(e.iqamaExpiry), d == null ? '—' : d, ''] }; } },
    pass: { t: T('الجوازات', 'Passports'), h: [T('رقم الجواز', 'Passport no.'), T('الجنسية', 'Nationality'), T('الانتهاء', 'Expiry'), T('المتبقي', 'Left'), T('الحالة', 'Status')],
      r: (e) => { const d = e.passportExpiry ? daysLeft(e.passportExpiry) : null; return { c: [e.passportNo || '—', e.nationality || '—', fD(e.passportExpiry), dB(d, T), st(d, !e.passportNo && !e.passportExpiry ? inc : '', T)], p: [e.passportNo || '—', e.nationality || '—', fD(e.passportExpiry), d == null ? '—' : d, ''] }; } },
    ins: { t: T('التأمين الطبي', 'Medical insurance'), h: [T('شركة التأمين', 'Insurer'), T('الفئة', 'Class'), T('رقم البطاقة', 'Card no.'), T('الانتهاء', 'Expiry'), T('المتبقي', 'Left'), T('الحالة', 'Status')],
      r: (e) => { const d = e.insuranceExpiry ? daysLeft(e.insuranceExpiry) : null; return { c: [e.insuranceCo || '—', e.insuranceClass || '—', e.insuranceCard || '—', fD(e.insuranceExpiry), dB(d, T), st(d, !e.insuranceCo && !e.insuranceExpiry ? inc : '', T)], p: [e.insuranceCo || '—', e.insuranceClass || '—', e.insuranceCard || '—', fD(e.insuranceExpiry), d == null ? '—' : d, ''] }; } },
    cont: { t: T('العقود', 'Contracts'), h: [T('جهة العمل', 'Employer'), T('النوع', 'Type'), T('المباشرة', 'Start'), T('الانتهاء', 'End'), T('المتبقي', 'Left'), T('الحالة', 'Status')],
      r: (e) => { const end = e.contractEnd || e.ce, d = end ? daysLeft(end) : null; return { c: [e.employer || '—', e.contractType || '—', fD(e.contractJoin || e.cj), fD(end), dB(d, T), st(d, !end ? T('مفتوح', 'Open-ended') : '', T)], p: [e.employer || '—', e.contractType || '—', fD(e.contractJoin || e.cj), fD(end), d == null ? '—' : d, ''] }; } },
  };
  const statusTxt = (e, k, d) => d;
  void statusTxt;
  const tableHtml = (k) => {
    const X = TABS[k]; const th = 'background:#014D3D;color:#fff;padding:4px 6px;font-size:10px;border:1px solid #014D3D', td = 'padding:3px 6px;border:1px solid #d9e3df;font-size:10px;text-align:center';
    return '<table style="width:100%;border-collapse:collapse"><thead><tr>' + ['#', T('الموظف', 'Employee')].concat(X.h).map((x) => '<th style="' + th + '">' + esc(x) + '</th>').join('') + '</tr></thead><tbody>'
      + a.map((e) => { const r = X.r(e).p; const d = r[r.length - 2]; const s = typeof d === 'number' ? (d <= 0 ? T('منتهي', 'Expired') : T('ساري', 'Valid')) : '—'; return '<tr><td style="' + td + '">' + esc(e.empNo != null ? e.empNo : e.id) + '</td><td style="' + td + ';text-align:right">' + esc(nm(e)) + '</td>' + r.slice(0, -1).map((c) => '<td style="' + td + '">' + esc(c) + '</td>').join('') + '<td style="' + td + '">' + s + '</td></tr>'; }).join('') + '</tbody></table>';
  };
  const wrap = (t, body) => '<div dir="' + (en ? 'ltr' : 'rtl') + '" style="font-family:Tahoma,Arial,sans-serif;padding:0 8mm">' + body + '</div>';
  const printTab = () => printHtml(TABS[tab].t, wrap('', '<h3>' + esc(TABS[tab].t) + '</h3>' + tableHtml(tab)), { dir: en ? 'ltr' : 'rtl', lang: en ? 'en' : 'ar' });
  const printAll = () => printHtml(T('وثائق الموظفين', 'Employee documents'), wrap('', Object.keys(TABS).map((k) => '<h3>' + esc(TABS[k].t) + '</h3>' + tableHtml(k)).join('')), { dir: en ? 'ltr' : 'rtl', lang: en ? 'en' : 'ar' });
  const X = TABS[tab];
  return (
    <div id="pg-docs-react">
      <div className="tbar" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        {Object.keys(TABS).map((k) => <div key={k} id={'t_' + k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{TABS[k].t}</div>)}
        <button className="btn bsm" onClick={printTab} style={{ marginInlineStart: 'auto', background: 'var(--gr)', color: '#fff' }}><i className="ti ti-printer" /> {T('طباعة هذا التاب', 'Print this tab')}</button>
        <button className="btn bsm" id="DOC_REFRESH" onClick={() => reload && reload({ silent: false })}><i className="ti ti-refresh" /> {T('تحديث البيانات', 'Refresh data')}</button>
        <button className="btn bsm" onClick={printAll}><i className="ti ti-printer" /> {T('طباعة الكل', 'Print all')}</button>
      </div>
      <div className="card" style={{ padding: 0 }}><div className="tw"><table id="DOCT">
        <thead><tr><th>#</th><th>{T('الموظف', 'Employee')}</th>{X.h.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{a.map((e) => <tr key={e.id}><td>{e.empNo != null ? e.empNo : e.id}</td><td style={{ fontWeight: 600 }}>{nm(e)}</td>{X.r(e).c.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
      </table></div></div>
    </div>
  );
}
