import { useMemo, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import { PAYX as X } from '../../engines/payx.js';
import { insDefault, rates } from '../../engines/payrollRows.js';
import { insExempt } from '../../engines/empkind.js';
import { MN_AR, MN_EN, num, r2, money, p2, pd, iso, monthCtx, isTerm, lastDayOf, shortNm, empNoSort, liveEmps, saveXlsx, saveCsv, printOfficial, esc } from '../../lib/finance.js';

const insDaysFor = (e, m) => {
  const jn = pd(e.contractJoin || e.join_date), ld = isTerm(e) ? lastDayOf(e) : null; let st = 1, en = m.days;
  if (jn && jn > m.end) return 0; if (jn && jn >= m.start) st = jn.getDate();
  if (ld) { if (ld < m.start) return 0; if (ld <= m.end) en = ld.getDate(); }
  return Math.max(0, Math.min(m.days, en - st + 1));
};
export function calcFor(e, m, ovr) {
  const sal = num(e.salary || e.sal), hou = num(e.housingAllowance || e.hou), status = insDefault(e);
  const ins = (ovr === undefined || ovr === null || ovr === '') ? insDaysFor(e, m) : Math.max(0, Math.min(m.days, num(ovr)));
  const o = X.compute({ basic: sal, houRate: sal > 0 ? hou / sal : 0, traRate: 0, days: m.days, work: ins, insDays: ins, insStatus: status, saudi: !!e.isSaudi || X.isSaudiNat(e.nationality), nat: e.nationality, employer: e.employer, dob: e.dob, asOf: m.end, trainee: X.isTrainee(e.employer), noIns: !!insExempt(e), rates: rates(m.end) });
  const emp = num(o.AO), co = num(o.AR);
  return { status, days: ins, base: num(o.AQ), emp, co, total: emp + co };
}
const Kpi = ({ l, v, c }) => <div style={{ background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 12, padding: '10px 14px', minWidth: 150, flex: 1 }}><div style={{ fontSize: 11, color: 'var(--mu)' }}>{l}</div><div style={{ fontSize: 19, fontWeight: 800, color: c, marginTop: 2 }}>{v}</div></div>;
const TD = { padding: '6px 8px', borderBottom: '1px solid rgba(36,48,68,.25)', textAlign: 'right', whiteSpace: 'nowrap', fontSize: 11.5 };
const INP = { background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '6px 9px', fontSize: 12 };

export default function InsCalc() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a);
  const { employees, settings } = useApp();
  const [date, setDate] = useState(iso(new Date())); const [selEmp, setSelEmp] = useState(''); const [selEr, setSelEr] = useState(''); const [over, setOver] = useState({});
  const emps = useMemo(() => liveEmps(employees).sort((a, b) => String(a.nameAr || '').localeCompare(String(b.nameAr || ''), 'ar')), [employees]);
  const ers = useMemo(() => [...new Set(emps.map((e) => e.employer).filter(Boolean))], [emps]);
  const d = pd(date) || new Date(), m = monthCtx(d.getFullYear(), d.getMonth() + 1), key = (e) => m.y + '-' + m.m + '-' + e.id;
  const data = useMemo(() => {
    const rows = emps.filter((e) => { const jn = pd(e.contractJoin || e.join_date); return !(jn && jn > m.end) && (!selEmp || String(e.id) === selEmp) && (!selEr || String(e.employer) === selEr); })
      .sort((a, b) => { const ea = String(a.employer || ''), eb = String(b.employer || ''); return ea !== eb ? ea.localeCompare(eb, 'ar') : empNoSort(a, b); })
      .map((e) => { const c = calcFor(e, m, over[key(e)]); return { e, id: String(e.id), empNo: e.empNo || e.id, name: shortNm(e, en), employer: e.employer || '', nat: e.nationality || '', ...c, manual: over[key(e)] !== undefined }; });
    const tot = { emp: 0, co: 0, total: 0 }; rows.forEach((r) => { tot.emp += r.emp; tot.co += r.co; tot.total += r.total; });
    return { rows, tot };
  }, [emps, date, selEmp, selEr, over, en]); // eslint-disable-line
  const mn = (en ? MN_EN : MN_AR)[m.m];
  const shift = (k) => setDate(iso(new Date(d.getFullYear(), d.getMonth() + k, 1)));
  const head = [T('م', '#'), T('الرقم', 'No.'), T('الاسم', 'Employee'), T('جهة العمل', 'Employer'), T('حالة التأمينات', 'Status'), T('الأجر الخاضع', 'Insurable wage'), T('أيام التأمينات', 'Ins. days'), T('حصة الموظف', 'Employee share'), T('حصة الشركة', 'Company share'), T('الإجمالي', 'Total')];
  function xlsx() {
    if (!data.rows.length) return toast(T('لا يوجد موظفين', 'No employees'), 'ter');
    const hh = [T('م', '#'), T('الرقم', 'No.'), T('الاسم', 'Employee'), T('جهة العمل', 'Employer'), T('الجنسية', 'Nationality'), T('حالة التأمينات', 'Status'), T('الأجر الخاضع', 'Insurable wage'), T('أيام التأمينات', 'Ins. days'), T('حصة الموظف', 'Employee share'), T('حصة الشركة', 'Company share'), T('الإجمالي', 'Total')];
    const rows = [[T('حاسبة التأمينات الاجتماعية — ', 'Social insurance calculation — ') + mn + ' ' + m.y], [], hh, ...data.rows.map((x, i) => [i + 1, x.empNo, x.name, x.employer, x.nat, x.status, r2(x.base), x.days, r2(x.emp), r2(x.co), r2(x.total)]), [T('الإجمالي', 'Total'), '', '', '', '', '', '', '', r2(data.tot.emp), r2(data.tot.co), r2(data.tot.total)]];
    saveXlsx('insurance_' + m.y + '_' + p2(m.m) + '.xlsx', [{ name: T('التأمينات', 'Insurance'), rows, widths: [6, 10, 28, 14, 14, 16, 14, 12, 14, 14, 14] }]);
  }
  function gosi(csv) {
    const rows = data.rows.filter((x) => x.status !== 'غير خاضع' && x.status !== 'لا يطبق' && x.base > 0);
    if (!rows.length) return toast(T('لا يوجد مشتركين خاضعين في هذا الشهر', 'No subject subscribers this month'), 'ter');
    const idOf = (e) => String(e.iqamaNo || e.iqama || e.idNo || '').trim();
    const h = [T('رقم الهوية/الإقامة', 'ID / Iqama'), T('اسم المشترك', 'Subscriber name'), T('الجنسية', 'Nationality'), T('تاريخ الميلاد', 'Date of birth'), T('تاريخ الالتحاق', 'Joining date'), T('الأجر الأساسي', 'Basic wage'), T('بدل السكن', 'Housing'), T('الأجر الخاضع', 'Insurable wage'), T('أيام الاشتراك', 'Days'), T('حصة المشترك', 'Employee share'), T('حصة المنشأة', 'Employer share'), T('الإجمالي', 'Total')];
    const body = rows.map((x) => { const e = x.e; return [idOf(e), shortNm(e, en), e.nationality || '', String(e.dob || '').slice(0, 10), String(e.contractJoin || e.join_date || '').slice(0, 10), r2(e.salary || e.sal), r2(e.housingAllowance || e.hou), r2(x.base), x.days, r2(x.emp), r2(x.co), r2(x.total)]; });
    const tot = ['', '', '', '', '', '', '', '', '', 0, 0, 0]; [9, 10, 11].forEach((i) => { tot[i] = r2(body.reduce((a, r) => a + num(r[i]), 0)); }); tot[0] = T('الإجمالي', 'Total') + ' (' + body.length + ')';
    const name = 'gosi_' + m.y + '_' + p2(m.m);
    if (csv) saveCsv(name + '.csv', h, [...body, tot]); else saveXlsx(name + '.xlsx', [{ name: 'GOSI', rows: [h, ...body, tot], widths: [16, 28, 14, 12, 12, 14, 14, 14, 10, 14, 14, 14] }]);
  }
  function print() {
    if (!data.rows.length) return toast(T('لا يوجد موظفين', 'No employees'), 'ter');
    const title = T('حاسبة التأمينات الاجتماعية — ', 'Social insurance calculation — ') + mn + ' ' + m.y;
    const th = 'background:#014D3D;color:#fff;padding:4px 3px;font-size:9px;text-align:center;border:1px solid #014D3D', td = 'padding:3px 4px;border:1px solid #d9e3df;text-align:center;font-size:9.5px', tdn = 'padding:3px 4px;border:1px solid #d9e3df;text-align:right;font-size:9.5px;font-weight:700';
    let body = '', i = 0, cur = null, grp = null;
    const flush = () => { if (grp) body += '<tr style="background:#e8f3ee;font-weight:800"><td colspan="7" style="' + tdn + '">' + T('إجمالي ', 'Total ') + esc(cur || '—') + ' (' + grp.n + ')</td><td style="' + td + '">' + money(grp.emp) + '</td><td style="' + td + '">' + money(grp.co) + '</td><td style="' + td + '">' + money(grp.total) + '</td></tr>'; };
    data.rows.forEach((x) => {
      if (x.employer !== cur || !grp) { flush(); cur = x.employer; grp = { emp: 0, co: 0, total: 0, n: 0 }; body += '<tr style="background:#f1f6f4"><td colspan="10" style="' + tdn + ';color:#014D3D">' + esc(cur || '—') + '</td></tr>'; }
      grp.emp += x.emp; grp.co += x.co; grp.total += x.total; grp.n++; i++;
      body += '<tr><td style="' + td + '">' + i + '</td><td style="' + td + '">' + esc(x.empNo) + '</td><td style="' + tdn + '">' + esc(x.name) + '</td><td style="' + td + '">' + esc(x.employer) + '</td><td style="' + td + '">' + esc(x.status) + '</td><td style="' + td + '">' + money(x.base) + '</td><td style="' + td + '">' + x.days + '</td><td style="' + td + '">' + money(x.emp) + '</td><td style="' + td + '">' + money(x.co) + '</td><td style="' + td + ';font-weight:800">' + money(x.total) + '</td></tr>';
    });
    flush();
    body += '<tr style="background:#014D3D;color:#fff;font-weight:800"><td colspan="7" style="' + tdn + ';color:#fff">' + T('الإجمالي العام', 'Grand total') + ' (' + data.rows.length + ')</td><td style="' + td + '">' + money(data.tot.emp) + '</td><td style="' + td + '">' + money(data.tot.co) + '</td><td style="' + td + '">' + money(data.tot.total) + '</td></tr>';
    const html = '<div dir="' + (en ? 'ltr' : 'rtl') + '" style="font-family:Tahoma,Arial,sans-serif;padding:0 6mm"><div style="text-align:center;margin:2mm 0 3mm"><div style="font-size:15px;font-weight:800;color:#014D3D">' + esc(title) + '</div><div style="font-size:10.5px;color:#555">' + m.days + ' ' + T('يوم', 'days') + ' — ' + T('المبلغ المطلوب توفيره: ', 'Amount to set aside: ') + '<b>' + money(data.tot.total) + ' ' + T('ر.س', 'SAR') + '</b></div></div><table style="width:100%;border-collapse:collapse"><thead><tr>' + head.map((x) => '<th style="' + th + '">' + esc(x) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>';
    printOfficial(settings, title, html, { dir: en ? 'ltr' : 'rtl', lang: en ? 'en' : 'ar' });
  }
  const L = (t) => <label style={{ fontSize: 10.5, color: 'var(--mu)', display: 'block', marginBottom: 3 }}>{t}</label>;
  return (
    <div className="pg on" style={{ padding: '12px 16px' }}>
      <div className="card" style={{ padding: 14 }}>
        <div className="ct" style={{ marginBottom: 10 }}><i className="ti ti-shield-check" /> {T('حاسبة التأمينات الاجتماعية الشهرية', 'Monthly social insurance calculator')}</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>{L(T('التاريخ (الشهر اللي هيتحسب)', 'Date (month to calculate)'))}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={INP} /></div>
          <div style={{ display: 'flex', gap: 6 }}><button className="btn bsm" onClick={() => shift(-1)}>‹</button><button className="btn bsm" onClick={() => setDate(iso(new Date()))}>{T('الشهر الحالي', 'This month')}</button><button className="btn bsm" onClick={() => shift(1)}>{T('الشهر القادم', 'Next month')}</button></div>
          <div>{L(T('الموظف', 'Employee'))}<select value={selEmp} onChange={(e) => setSelEmp(e.target.value)} style={{ ...INP, minWidth: 200 }}><option value="">{T('كل الموظفين', 'All employees')}</option>{emps.map((e) => <option key={e.id} value={e.id}>{shortNm(e, en)}</option>)}</select></div>
          <div>{L(T('جهة العمل', 'Employer'))}<select value={selEr} onChange={(e) => setSelEr(e.target.value)} style={INP}><option value="">{T('كل الجهات', 'All employers')}</option>{ers.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
          <div style={{ display: 'flex', gap: 6, marginInlineStart: 'auto' }}>
            <button className="btn bgr bsm" onClick={print}><i className="ti ti-printer" /> {T('طباعة رسمي', 'Print (official)')}</button>
            <button className="btn bpl bsm" onClick={xlsx}><i className="ti ti-file-spreadsheet" /> Excel</button>
            <button className="btn bsm" onClick={() => gosi(false)} title={T('ملف الاشتراكات الشهري للمحاسب', 'Monthly subscription file for the accountant')}><i className="ti ti-file-upload" /> {T('ملف التأمينات (GOSI)', 'GOSI file')}</button>
            <button className="btn bsm" onClick={() => gosi(true)}>CSV</button>
          </div>
        </div>
        <div style={{ marginTop: 10, fontWeight: 800, fontSize: 13 }}>{mn} {m.y} — {m.days} {T('يوم', 'days')}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
        <Kpi l={T('حصة الموظفين', "Employees' share")} v={money(data.tot.emp)} c="var(--am)" /><Kpi l={T('حصة الشركة', 'Company share')} v={money(data.tot.co)} c="var(--bl)" />
        <Kpi l={T('المبلغ المطلوب توفيره', 'Amount to set aside')} v={money(data.tot.total) + ' ' + T('ر.س', 'SAR')} c="var(--gr)" /><Kpi l={T('عدد الموظفين', 'Employees')} v={data.rows.length} c="var(--cy)" />
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!data.rows.length ? <div style={{ padding: 26, textAlign: 'center', color: 'var(--mu)' }}>{T('لا يوجد موظفين', 'No employees')}</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{head.map((x) => <th key={x} style={{ background: 'var(--c2)', padding: '7px 8px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, borderBottom: '2px solid var(--bl)', whiteSpace: 'nowrap' }}>{x}</th>)}</tr></thead>
            <tbody>
              {(() => {
                const out = []; let cur = null, g = null, i = 0; const gs = { background: 'rgba(1,77,61,.10)', fontWeight: 800 };
                const flush = () => { if (g) out.push(<tr key={'g' + cur}><td colSpan={7} style={{ ...TD, ...gs }}>{T('إجمالي ', 'Total ')}{cur || '—'} ({g.n})</td><td style={{ ...TD, ...gs }}>{money(g.emp)}</td><td style={{ ...TD, ...gs }}>{money(g.co)}</td><td style={{ ...TD, ...gs }}>{money(g.total)}</td></tr>); };
                data.rows.forEach((x) => {
                  if (x.employer !== cur || !g) { flush(); cur = x.employer; g = { emp: 0, co: 0, total: 0, n: 0 }; }
                  g.emp += x.emp; g.co += x.co; g.total += x.total; g.n++; i++;
                  out.push(<tr key={x.id}><td style={TD}>{i}</td><td style={TD}>{x.empNo}</td><td style={{ ...TD, fontWeight: 700 }}>{x.name}</td><td style={TD}>{x.employer}</td><td style={TD}>{x.status}</td><td style={TD}>{money(x.base)}</td>
                    <td style={TD}><input type="number" min="0" max={m.days} value={x.days} onChange={(ev) => setOver({ ...over, [key(x.e)]: ev.target.value })} style={{ width: 52, background: 'transparent', border: '1px solid ' + (x.manual ? 'var(--am)' : 'transparent'), borderRadius: 4, color: 'var(--tx)', fontSize: 11.5, padding: 2, textAlign: 'right' }} />
                      {x.manual && <a href="#" onClick={(ev) => { ev.preventDefault(); const o = { ...over }; delete o[key(x.e)]; setOver(o); }} style={{ color: 'var(--cy)', textDecoration: 'none' }} title={T('رجوع للتلقائي', 'Back to automatic')}> ↺</a>}</td>
                    <td style={{ ...TD, color: 'var(--am)' }}>{money(x.emp)}</td><td style={{ ...TD, color: 'var(--bl)' }}>{money(x.co)}</td><td style={{ ...TD, fontWeight: 800, color: 'var(--gr)' }}>{money(x.total)}</td></tr>);
                });
                flush();
                out.push(<tr key="gt"><td colSpan={7} style={{ ...TD, background: 'rgba(59,130,246,.12)', fontWeight: 800 }}>{T('الإجمالي العام', 'Grand total')} ({data.rows.length})</td><td style={{ ...TD, background: 'rgba(59,130,246,.12)', fontWeight: 800 }}>{money(data.tot.emp)}</td><td style={{ ...TD, background: 'rgba(59,130,246,.12)', fontWeight: 800 }}>{money(data.tot.co)}</td><td style={{ ...TD, background: 'rgba(59,130,246,.12)', fontWeight: 800 }}>{money(data.tot.total)}</td></tr>);
                return out;
              })()}
            </tbody>
          </table>)}
      </div>
    </div>
  );
}
