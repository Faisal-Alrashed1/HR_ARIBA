import { useMemo, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import { PAYX as X } from '../../engines/payx.js';
import { usedThrough, rates } from '../../engines/payrollRows.js';
import { noEos } from '../../engines/empkind.js';
import { leaveAnnual } from '../../engines/leave.js';
import { MN_AR, MN_EN, num, r2, money, p2, pd, shortNm, empNoSort, saveXlsx, printOfficial, esc } from '../../lib/finance.js';

const current = (e) => e && !e.isHourly && !e.isTerminated && !e.term && e.active !== false;
/** المخصص لموظف عند آخر يوم في الشهر: لو انتهت خدمته اليوم (مكافأة كاملة) + قيمة رصيد الإجازة */
export function provFor(e, end, reasonKey) {
  const join = pd(e.contractJoin || e.join_date); if (!join || join > end) return { eos: 0, leaveDays: 0, leave: 0, svc: '', base: 0, noEos: false, skip: true };
  const sal = num(e.salary || e.sal), hou = num(e.housingAllowance || e.hou), tra = num(e.transportAllowance || e.tra); let used = 0;
  try { used = usedThrough(e, end); } catch { /* ignore */ }
  const days = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  const o = X.compute({ basic: sal, houRate: sal > 0 ? hou / sal : 0, traRate: sal > 0 ? tra / sal : 0, prj: num(e.projectAllowance), oth: num(e.otherAllowance), days, work: days, insDays: days, fx: num(e.exchRate) || 1, insStatus: 'غير خاضع', saudi: !!e.isSaudi, trainee: false, nat: e.nationality, employer: e.employer, dob: e.dob,
    join: String(e.contractJoin || e.join_date || '').slice(0, 10), lastDay: end.getFullYear() + '-' + p2(end.getMonth() + 1) + '-' + p2(end.getDate()), reason: reasonKey, leaveDays: leaveAnnual(e), used: null, usedAuto: used, noIns: true, noEos: noEos(e), asOf: end, rates: rates(end) });
  const ne = noEos(e), daily = num(o.T) / 30;
  return { eos: ne ? 0 : num(o.AK), leaveDays: Math.max(0, num(o.P)), leave: Math.max(0, num(o.P)) * daily, svc: (o.AD || 0) + 'y ' + (o.AE || 0) + 'm ' + (o.AF || 0) + 'd', base: sal + hou, noEos: ne, skip: false, daily };
}
const TD = { padding: '6px 8px', borderBottom: '1px solid rgba(36,48,68,.25)', fontSize: 11.5, whiteSpace: 'nowrap' };
const INP = { background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '6px 9px', fontSize: 12 };

export default function Prov() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a); const { employees, settings } = useApp();
  const now = new Date();
  const [y, setY] = useState(now.getFullYear()), [m, setM] = useState(now.getMonth() + 1), [reason, setReason] = useState('expiry'), [er, setEr] = useState('');
  const emps = useMemo(() => employees.filter(current), [employees]);
  const ers = useMemo(() => [...new Set(emps.map((e) => e.employer).filter(Boolean))], [emps]);
  const data = useMemo(() => {
    const end = new Date(y, m, 0), pe = new Date(y, m - 1, 0), rows = [];
    emps.filter((e) => !er || String(e.employer) === er).sort((a, b) => { const ea = String(a.employer || ''), eb = String(b.employer || ''); return ea !== eb ? ea.localeCompare(eb, 'ar') : empNoSort(a, b); })
      .forEach((e) => { const cur = provFor(e, end, reason); if (cur.skip) return; const prev = provFor(e, pe, reason), incE = cur.eos - (prev.skip ? 0 : prev.eos), incL = cur.leave - (prev.skip ? 0 : prev.leave);
        rows.push({ id: e.id, no: e.empNo || e.id, name: shortNm(e, en), employer: e.employer || '', join: String(e.contractJoin || '').slice(0, 10), svc: cur.svc, base: cur.base, eos: cur.eos, leaveDays: cur.leaveDays, leave: cur.leave, total: cur.eos + cur.leave, incEos: incE, incLeave: incL, incTotal: incE + incL, noEos: cur.noEos }); });
    const tot = rows.reduce((a, r) => ({ eos: a.eos + r.eos, leave: a.leave + r.leave, total: a.total + r.total, incEos: a.incEos + r.incEos, incLeave: a.incLeave + r.incLeave, incTotal: a.incTotal + r.incTotal }), { eos: 0, leave: 0, total: 0, incEos: 0, incLeave: 0, incTotal: 0 });
    return { rows, tot };
  }, [emps, y, m, reason, er, en]);
  const { rows, tot } = data; const mn = (en ? MN_EN : MN_AR)[m];
  const title = T('تقرير مخصصات نهاية الخدمة والإجازات — ', 'End-of-service & leave provisions — ') + mn + ' ' + y;
  function print() {
    if (!rows.length) return;
    const th = 'background:#014D3D;color:#fff;padding:4px 3px;font-size:8.5px;text-align:center;border:1px solid #014D3D', td = 'padding:3px 4px;border:1px solid #d9e3df;text-align:center;font-size:9px';
    const heads = [T('م', '#'), T('الاسم', 'Employee'), T('جهة العمل', 'Employer'), T('الخدمة', 'Service'), T('أجر أساسي + سكن', 'Basic+housing'), T('مخصص نهاية الخدمة', 'EOS'), T('أيام الإجازة', 'Leave days'), T('مخصص الإجازات', 'Leave'), T('الإجمالي', 'Total'), T('زيادة الشهر', 'Month increase')];
    let body = rows.map((r, i) => '<tr><td style="' + td + '">' + (i + 1) + '</td><td style="' + td + ';text-align:right;font-weight:700">' + esc(r.name) + '</td><td style="' + td + '">' + esc(r.employer) + '</td><td style="' + td + ';direction:ltr">' + esc(r.svc) + '</td><td style="' + td + '">' + money(r.base) + '</td><td style="' + td + '">' + (r.noEos ? '—' : money(r.eos)) + '</td><td style="' + td + '">' + r2(r.leaveDays) + '</td><td style="' + td + '">' + money(r.leave) + '</td><td style="' + td + ';font-weight:800">' + money(r.total) + '</td><td style="' + td + '">' + money(r.incTotal) + '</td></tr>').join('');
    body += '<tr style="background:#014D3D;color:#fff;font-weight:800"><td colspan="5" style="' + td + ';text-align:right;color:#fff">' + T('الإجمالي', 'Total') + ' (' + rows.length + ')</td><td style="' + td + '">' + money(tot.eos) + '</td><td style="' + td + '"></td><td style="' + td + '">' + money(tot.leave) + '</td><td style="' + td + '">' + money(tot.total) + '</td><td style="' + td + '">' + money(tot.incTotal) + '</td></tr>';
    const html = '<div dir="' + (en ? 'ltr' : 'rtl') + '" style="font-family:Tahoma,Arial,sans-serif;padding:0 6mm"><div style="text-align:center;margin:2mm 0 3mm"><div style="font-size:14px;font-weight:800;color:#014D3D">' + esc(title) + '</div><div style="font-size:10.5px;color:#555">' + T('المطلوب توفيره عن الشهر: ', 'To set aside for the month: ') + '<b>' + money(tot.incTotal) + ' ' + T('ر.س', 'SAR') + '</b></div></div><table style="width:100%;border-collapse:collapse"><thead><tr>' + heads.map((x) => '<th style="' + th + '">' + esc(x) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>';
    printOfficial(settings, title, html, { dir: en ? 'ltr' : 'rtl', lang: en ? 'en' : 'ar' });
  }
  function xlsx() {
    if (!rows.length) return toast(T('لا يوجد موظفين', 'No employees'), 'ter');
    const head = [T('الرقم', 'No.'), T('الاسم', 'Employee'), T('جهة العمل', 'Employer'), T('تاريخ المباشرة', 'Joined'), T('مدة الخدمة', 'Service'), T('أجر أساسي + سكن', 'Basic + housing'), T('مخصص نهاية الخدمة', 'EOS provision'), T('أيام الإجازة', 'Leave days'), T('مخصص الإجازات', 'Leave provision'), T('الإجمالي', 'Total'), T('زيادة نهاية الخدمة', 'EOS increase'), T('زيادة الإجازات', 'Leave increase'), T('زيادة الشهر', 'Month increase')];
    const d = rows.map((r) => [r.no, r.name, r.employer, r.join, r.svc, r2(r.base), r2(r.eos), r2(r.leaveDays), r2(r.leave), r2(r.total), r2(r.incEos), r2(r.incLeave), r2(r.incTotal)]);
    d.push([T('الإجمالي', 'Total'), '', '', '', '', '', r2(tot.eos), '', r2(tot.leave), r2(tot.total), r2(tot.incEos), r2(tot.incLeave), r2(tot.incTotal)]);
    saveXlsx('provisions_' + y + '_' + p2(m) + '.xlsx', [{ name: T('المخصصات', 'Provisions'), rows: [[title], [], head, ...d], widths: [10, 28, 14, 12, 12, 14, 16, 12, 16, 16, 16, 16, 16] }]);
  }
  const Kpi = ({ l, v, c }) => <div style={{ background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 12, padding: '10px 14px', minWidth: 190, flex: 1 }}><div style={{ fontSize: 11, color: 'var(--mu)' }}>{l}</div><div style={{ fontSize: 19, fontWeight: 800, color: c, marginTop: 2 }}>{v} <span style={{ fontSize: 11, color: 'var(--mu)' }}>{T('ر.س', 'SAR')}</span></div></div>;
  const Lb = ({ t }) => <label style={{ fontSize: 10.5, color: 'var(--mu)', display: 'block', marginBottom: 3 }}>{t}</label>;
  const ys = []; for (let k = now.getFullYear() - 3; k <= now.getFullYear() + 10; k++) ys.push(k);
  const ropts = ['expiry', 'agree', 'arb77', 'retire'].map((k) => [k, X.findReason(k)]).filter(([, R]) => R);
  const heads = [T('م', '#'), T('الرقم', 'No.'), T('الاسم', 'Employee'), T('جهة العمل', 'Employer'), T('مدة الخدمة', 'Service'), T('الأجر الأساسي + السكن', 'Basic + housing'), T('مخصص نهاية الخدمة', 'EOS provision'), T('رصيد الإجازة (يوم)', 'Leave balance (days)'), T('مخصص الإجازات', 'Leave provision'), T('الإجمالي', 'Total'), T("زيادة الشهر", "This month's increase")];
  return (
    <div className="pg on" style={{ padding: '12px 16px' }}>
      <div className="card" style={{ padding: 14 }}>
        <div className="ct" style={{ marginBottom: 10 }}><i className="ti ti-pig-money" /> {T('تقرير المخصصات الشهري (نهاية الخدمة والإجازات)', 'Monthly provisions report (end of service & leave)')}</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><Lb t={T('السنة', 'Year')} /><select value={y} onChange={(e) => setY(+e.target.value)} style={INP}>{ys.map((k) => <option key={k}>{k}</option>)}</select></div>
          <div><Lb t={T('الشهر', 'Month')} /><select value={m} onChange={(e) => setM(+e.target.value)} style={INP}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{(en ? MN_EN : MN_AR)[i + 1]}</option>)}</select></div>
          <div style={{ minWidth: 260 }}><Lb t={T('أساس حساب مكافأة نهاية الخدمة', 'EOS calculation basis')} /><select value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...INP, width: '100%' }}>{ropts.map(([k, R]) => <option key={k} value={k}>{en ? R.en : R.ar}</option>)}</select></div>
          <div><Lb t={T('جهة العمل', 'Employer')} /><select value={er} onChange={(e) => setEr(e.target.value)} style={INP}><option value="">{T('كل الجهات', 'All employers')}</option>{ers.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
          <div style={{ display: 'flex', gap: 6, marginInlineStart: 'auto' }}><button className="btn bgr bsm" onClick={print}><i className="ti ti-printer" /> {T('طباعة', 'Print')}</button><button className="btn bpl bsm" onClick={xlsx}><i className="ti ti-file-spreadsheet" /> Excel</button></div>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--mu)' }}>{T('المخصص = ما يجب على الشركة دفعه لو انتهت خدمة كل الموظفين الحاليين في آخر الشهر (مكافأة كاملة) + قيمة رصيد الإجازات. "زيادة الشهر" = الفرق عن آخر الشهر السابق. الاستشاري والتمهير والتدريب بدون مكافأة.', 'Provision = what the company would owe if every current employee left at month end (full award) + the value of the leave balance. "Month increase" = difference from the previous month end. Consultants, Tamheer and trainees have no award.')}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
        <Kpi l={T('مخصص نهاية الخدمة (تراكمي)', 'End-of-service provision (cumulative)')} v={money(tot.eos)} c="var(--bl)" /><Kpi l={T('مخصص الإجازات (تراكمي)', 'Leave provision (cumulative)')} v={money(tot.leave)} c="var(--am)" />
        <Kpi l={T('إجمالي المخصصات', 'Total provisions')} v={money(tot.total)} c="var(--gr)" /><Kpi l={T('المطلوب توفيره عن هذا الشهر', 'To set aside for this month')} v={money(tot.incTotal)} c="var(--cy)" />
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!rows.length ? <div style={{ padding: 26, textAlign: 'center', color: 'var(--mu)' }}>{T('لا يوجد موظفين', 'No employees')}</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{heads.map((x) => <th key={x} style={{ background: 'var(--c2)', padding: '7px 8px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, borderBottom: '2px solid var(--bl)', whiteSpace: 'nowrap' }}>{x}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => <tr key={r.id}><td style={TD}>{i + 1}</td><td style={TD}>{r.no}</td><td style={{ ...TD, fontWeight: 700 }}>{r.name}</td><td style={TD}>{r.employer}</td><td style={{ ...TD, direction: 'ltr', textAlign: 'right' }}>{r.svc}</td><td style={TD}>{money(r.base)}</td><td style={TD}>{r.noEos ? <span style={{ color: 'var(--mu)' }}>{T('لا مكافأة', 'No award')}</span> : money(r.eos)}</td><td style={TD}>{r2(r.leaveDays)}</td><td style={TD}>{money(r.leave)}</td><td style={{ ...TD, fontWeight: 800 }}>{money(r.total)}</td><td style={{ ...TD, color: 'var(--gr)' }}>{money(r.incTotal)}</td></tr>)}
              <tr style={{ background: 'rgba(41,179,94,.12)', fontWeight: 800 }}><td colSpan={6} style={TD}>{T('الإجمالي', 'Total')} ({rows.length})</td><td style={TD}>{money(tot.eos)}</td><td style={TD} /><td style={TD}>{money(tot.leave)}</td><td style={TD}>{money(tot.total)}</td><td style={TD}>{money(tot.incTotal)}</td></tr>
            </tbody>
          </table>)}
      </div>
    </div>
  );
}
