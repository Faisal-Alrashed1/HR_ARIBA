import { useMemo, useState } from 'react';
import CustomReport from './CustomReport.jsx';
import ExportDialog from '../../components/ExportDialog.jsx';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { daysLeft, fD } from '../../lib/util.js';
import { leaveCurrentBalance, leaveYearOverride } from '../../engines/leave.js';
import { calcFor } from '../finance/InsCalc.jsx';
import { eosByLaw } from '../finance/Eos.jsx';
import { num, r2, money, monthCtx, saveXlsx, printOfficial, esc, empNoSort } from '../../lib/finance.js';

const cap = (d) => (d == null ? '—' : d <= 0 ? 'منتهي' : d + 'ي');
const Dd = ({ d, T }) => (d == null ? <span className="b bk">—</span> : d <= 0 ? <span className="b br">{T('منتهي', 'Expired')}</span> : <span className={'b ' + (d <= 30 ? 'br' : d <= 90 ? 'ba' : 'bg')}>{d}{T('ي', 'd')}</span>);

export default function Reports() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a); const { activeEmps, terminatedEmps, settings } = useApp();
  const [sel, setSel] = useState('');
  const nm = (e) => (en ? (e.nameEn || e.nameAr) : (e.nameAr || e.nameEn)) || '—';
  const cur = T('ر.س', 'SAR');
  const cat = useMemo(() => {
    const now = new Date(), mc = monthCtx(now.getFullYear(), now.getMonth() + 1), a = [...activeEmps].sort(empNoSort), no = (e) => (e.empNo != null ? e.empNo : e.id);
    const yr = now.getFullYear();
    return [
      { k: 'lv', i: 'ti-calendar-stats', t: T('أرصدة الإجازات', 'Leave balances'), h: [T('الموظف', 'Employee'), T('جهة العمل', 'Employer'), T('المستحق', 'Annual'), String(yr - 3), String(yr - 2), String(yr - 1), String(yr), T('الرصيد', 'Balance')],
        rows: a.map((e) => { const ov = (y) => { const o = leaveYearOverride(e, y); return o && o.used !== undefined ? o.used : 0; }; let b = 0; try { b = leaveCurrentBalance(e); } catch { b = num(e.leaveBalance); } return [no(e), nm(e), e.employer || '', e.leaveDaysContract || 21, ov(yr - 3), ov(yr - 2), ov(yr - 1), ov(yr), r2(b)]; }) },
      { k: 'iq', i: 'ti-id', t: T('الإقامات', 'Iqama'), h: [T('الموظف', 'Employee'), T('رقم الإقامة', 'Iqama no.'), T('جهة العمل', 'Employer'), T('الانتهاء', 'Expiry'), T('المتبقي', 'Left')],
        rows: a.filter((e) => e.iqamaNo).map((e) => ({ d: daysLeft(e.iqamaExpiry), e })).sort((x, y) => (x.d ?? 9999) - (y.d ?? 9999)).map(({ e, d }) => [no(e), nm(e), e.iqamaNo, e.employer || '', fD(e.iqamaExpiry), { d }]) },
      { k: 'pp', i: 'ti-passport', t: T('الجوازات', 'Passports'), h: [T('الموظف', 'Employee'), T('الجواز', 'Passport'), T('الجنسية', 'Nationality'), T('الانتهاء', 'Expiry'), T('المتبقي', 'Left')],
        rows: a.map((e) => [no(e), nm(e), e.passportNo || '—', e.nationality || '—', fD(e.passportExpiry), { d: e.passportExpiry ? daysLeft(e.passportExpiry) : null }]) },
      { k: 'ct', i: 'ti-file-text', t: T('العقود', 'Contracts'), h: [T('الموظف', 'Employee'), T('جهة العمل', 'Employer'), T('النوع', 'Type'), T('المباشرة', 'Start'), T('الانتهاء', 'End'), T('المتبقي', 'Left')],
        rows: a.map((e) => [no(e), nm(e), e.employer || '—', e.contractType || '—', fD(e.contractJoin), fD(e.contractEnd), { d: e.contractEnd ? daysLeft(e.contractEnd) : null }]) },
      { k: 'in', i: 'ti-heart-rate-monitor', t: T('التأمين الطبي', 'Medical insurance'), h: [T('الموظف', 'Employee'), T('شركة التأمين', 'Insurer'), T('الفئة', 'Class'), T('رقم البطاقة', 'Card'), T('الانتهاء', 'Expiry'), T('المتبقي', 'Left')],
        rows: a.map((e) => [no(e), nm(e), e.insuranceCo || '—', e.insuranceClass || '—', e.insuranceCard || '—', fD(e.insuranceExpiry), { d: e.insuranceExpiry ? daysLeft(e.insuranceExpiry) : null }]) },
      { k: 'pay', i: 'ti-cash', t: T('الرواتب التفصيلي', 'Payroll detail'), h: [T('الموظف', 'Employee'), T('جهة العمل', 'Employer'), T('الأساسي', 'Basic'), T('الإجمالي', 'Total'), T('تأمين موظف', 'Emp. ins.'), T('الصافي', 'Net')], tot: [3, 4, 5, 6],
        rows: a.filter((e) => !e.isHourly).map((e) => { const sal = num(e.salary || e.sal), st = num(e.salaryTotal) || (sal + num(e.housingAllowance || e.hou) + num(e.transportAllowance || e.tra) + num(e.projectAllowance) + num(e.otherAllowance)); let ins = 0; try { ins = calcFor(e, mc).emp; } catch { /* ignore */ } return [no(e), nm(e), e.employer || '', r2(sal), r2(st), r2(ins), r2(st - ins - num(e.otherDeductions))]; }) },
      { k: 'eos', i: 'ti-award', t: T('نهاية الخدمة (المنتهية خدمتهم)', 'EOS (terminated)'), h: [T('الموظف', 'Employee'), T('جهة العمل', 'Employer'), T('آخر يوم عمل', 'Last day'), T('السبب', 'Reason'), T('المكافأة', 'EOS')], tot: [5],
        rows: terminatedEmps.map((e) => { const amt = num(e.eosLaborLaw) || num(e.eosEndContract) || (e.eosCategory ? 0 : eosByLaw(num(e.salary), num(e.housingAllowance), num(e.yearsOfService), 'm84')); return { amt, e }; }).filter((x) => x.amt > 0).sort((x, y) => y.amt - x.amt)
          .map(({ e, amt }) => [no(e), nm(e), e.employer || '—', fD(e.lastDay || e.contractEnd), e.eosCategory || e.terminationReason || e.reason || '—', r2(amt)]) },
      { k: 'al', i: 'ti-alert-triangle', t: T('التنبيهات العاجلة', 'Urgent alerts'), h: [T('الموظف', 'Employee'), T('جهة العمل', 'Employer'), T('النوع', 'Type'), T('الانتهاء', 'Expiry'), T('المتبقي', 'Left')],
        rows: (() => { const o = []; a.forEach((e) => [['iqamaExpiry', T('الهوية / الإقامة', 'Iqama')], ['passportExpiry', T('الجواز', 'Passport')], ['contractEnd', T('العقد', 'Contract')]].forEach(([f, l]) => { const d = daysLeft(e[f]); if (d != null && d <= 90) o.push({ d, r: [nm(e), e.employer || '—', l, fD(e[f]), { d }] }); })); return o.sort((x, y) => x.d - y.d).map((x) => x.r); })() },
      { k: 'all', i: 'ti-users', t: T('كل الموظفين الحاليين', 'Active employees'), h: [T('الاسم', 'Name'), T('جهة العمل', 'Employer'), T('الجنسية', 'Nationality'), T('القسم', 'Dept'), T('المباشرة', 'Start'), T('الراتب', 'Salary')], tot: [6],
        rows: a.map((e, i) => [i + 1, nm(e), e.employer || '', e.nationality || '', e.dept || e.department || '', fD(e.contractJoin), r2(num(e.salaryTotal))]) },
      { k: 'term', i: 'ti-user-off', t: T('المنتهية خدمتهم', 'Terminated'), h: [T('الاسم', 'Name'), T('جهة العمل', 'Employer'), T('الجنسية', 'Nationality'), T('آخر يوم عمل', 'Last day'), T('السبب / البند', 'Reason')],
        rows: terminatedEmps.map((e, i) => [e.empNo || e.id || i + 1, nm(e), e.employer || '—', e.nationality || '—', fD(e.lastDay || e.contractEnd || e.ce), e.reason || e.terminationReason || '—']) },
    ];
  }, [activeEmps, terminatedEmps, en]); // eslint-disable-line
  const R = cat.find((c) => c.k === sel);
  const plain = (c) => (c && typeof c === 'object' ? cap(c.d) : c);
  const tots = R && R.tot ? R.tot.map((ci) => ({ ci, v: R.rows.reduce((a, r) => a + num(r[ci + 0]), 0) })) : [];
  const title = R ? R.t + ' (' + R.rows.length + ')' : '';
  function print() {
    const th = 'background:#014D3D;color:#fff;padding:4px 6px;font-size:10px;border:1px solid #014D3D', td = 'padding:3px 6px;border:1px solid #d9e3df;font-size:10px;text-align:center';
    const h = '<div dir="' + (en ? 'ltr' : 'rtl') + '" style="font-family:Tahoma,Arial,sans-serif;padding:0 8mm"><h3 style="text-align:center;color:#014D3D">' + esc(title) + '</h3><table style="width:100%;border-collapse:collapse"><thead><tr><th style="' + th + '">#</th>' + R.h.map((x) => '<th style="' + th + '">' + esc(x) + '</th>').join('') + '</tr></thead><tbody>'
      + R.rows.map((r) => '<tr>' + r.map((c, i) => '<td style="' + td + '">' + esc(typeof c === 'number' && R.tot && R.tot.includes(i) ? money(c) : plain(c)) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    printOfficial(settings, title, h, { dir: en ? 'ltr' : 'rtl', lang: en ? 'en' : 'ar' });
  }
  function xlsx() { saveXlsx('report_' + R.k + '.xlsx', [{ name: R.t.slice(0, 30), rows: [[title], [], ['#', ...R.h], ...R.rows.map((r) => r.map((c) => plain(c)))], widths: [8, 28, 16, 16, 16, 16, 16, 16] }]); }
  const [xd, setXd] = useState(false);
  return (
    <div>
      <CustomReport />
      <div id="RG" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(185px,1fr))', gap: 10, marginBottom: 14 }}>
        {[...cat.filter((c) => c.k !== 'in'), ...cat.filter((c) => c.k === 'in')].map((c) => <div key={c.k} data-rpt={c.k} onClick={() => setSel(c.k)} style={{ background: 'var(--c)', border: '1px solid ' + (sel === c.k ? 'var(--bl)' : 'var(--bd)'), borderRadius: 10, padding: 14, cursor: 'pointer' }}>
          {c.k === 'in' ? <><div style={{ fontWeight: 800 }}>🩺 {c.t}</div><div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 5 }}>{en ? 'Print the medical insurance report on its own' : 'طباعة تقرير التأمين الطبي منفردًا'}</div></>
            : <><i className={'ti ' + c.i} style={{ fontSize: 22, color: 'var(--bl)', display: 'block', marginBottom: 7 }} /><div style={{ fontSize: 13, fontWeight: 700 }}>{c.k === 'eos' ? T('نهاية الخدمة', 'EOS') : c.t}</div></>}</div>)}
      </div>
      {R && <div className="card" id="RO">
        <div className="ch"><div className="ct" id="RT">{title}</div><div style={{ display: 'flex', gap: 6 }}><button className="btn bsm" onClick={xlsx}><i className="ti ti-file-spreadsheet" /> Excel</button><button className="btn bsm" id="RO_EXPORT" onClick={() => setXd(true)}><i className="ti ti-file-export" /> PDF · Word · {T('إيميل', 'Email')}</button><button className="btn bsm" onClick={print}><i className="ti ti-printer" /></button></div></div>
        <div className="tw" id="RC"><table><thead><tr><th>#</th>{R.h.map((x, i) => <th key={i}>{x}</th>)}</tr></thead>
          <tbody>{R.rows.map((r, ri) => <tr key={ri}>{r.map((c, i) => <td key={i}>{c && typeof c === 'object' ? <Dd d={c.d} T={T} /> : (typeof c === 'number' && R.tot && R.tot.includes(i) ? money(c) : c)}</td>)}</tr>)}</tbody>
          {tots.length > 0 && <tfoot><tr style={{ fontWeight: 700 }}><td colSpan={R.h.length + 1 - tots.length}>{T('المجموع', 'Total')}</td>{tots.map((t) => <td key={t.ci}>{money(t.v)} {cur}</td>)}</tr></tfoot>}
        </table></div>
      </div>}
      {R && <ExportDialog open={xd} onClose={() => setXd(false)} spec={{ title, headers: ['#', ...R.h], rows: R.rows.map((r, i) => [i + 1, ...r.map((c) => plain(c))]), name: 'report_' + R.k }} forEmps={[]} />}
    </div>
  );
}
