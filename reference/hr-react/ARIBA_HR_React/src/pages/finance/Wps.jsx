import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import { payrollDraft } from '../../lib/payroll.js';
import { num, r2, money, p2, saveXlsx, saveCsv } from '../../lib/finance.js';

export const BANKS = { '05': 'مصرف الإنماء', 10: 'البنك الأهلي السعودي', 15: 'بنك البلاد', 20: 'بنك الرياض', 30: 'البنك العربي الوطني', 45: 'البنك السعودي البريطاني (ساب)', 55: 'البنك السعودي الفرنسي', 60: 'بنك الجزيرة', 65: 'البنك السعودي للاستثمار', 80: 'مصرف الراجحي' };
export function ibanOK(s) {
  s = String(s || '').replace(/\s+/g, '').toUpperCase(); if (!/^SA\d{22}$/.test(s)) return false;
  const r = s.slice(4) + s.slice(0, 4); let n = ''; for (let i = 0; i < r.length; i++) { const c = r.charCodeAt(i); n += c >= 65 ? (c - 55) : String.fromCharCode(c); }
  let rem = 0; for (let j = 0; j < n.length; j++) rem = (rem * 10 + (+n[j])) % 97; return rem === 1;
}
export const idOK = (s) => /^\d{10}$/.test(String(s || '').trim());
const TD = { padding: '6px 8px', borderBottom: '1px solid rgba(36,48,68,.25)', fontSize: 11.5, whiteSpace: 'nowrap' };
const INP = { background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '6px 9px', fontSize: 12 };

export default function Wps() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a); const { employees } = useApp();
  const now = new Date(), pm0 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [y, setY] = useState(pm0.getFullYear()), [m, setM] = useState(pm0.getMonth() + 1), [meth, setMeth] = useState('dom'), [er, setEr] = useState(''), [withBad, setWithBad] = useState(false);
  const [src, setSrc] = useState({ rows: [], approved: false, source: '' }), [loading, setLoading] = useState(false);
  useEffect(() => {
    let dead = false; setLoading(true);
    payrollDraft(y, m).then((r) => { if (dead) return; const rows = (r && Array.isArray(r.rows)) ? r.rows.map((x) => x.payload).filter(Boolean) : []; setSrc({ rows, approved: !!(r && r.approved), source: T('السحابة', 'cloud') }); })
      .catch(() => { if (!dead) { setSrc({ rows: [], approved: false, source: '' }); toast(T('تعذر تحميل المسير', 'Could not load payroll'), 'ter'); } }).finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [y, m]); // eslint-disable-line
  const byId = useMemo(() => new Map(employees.map((e) => [String(e.id), e])), [employees]);
  const ers = useMemo(() => [...new Set(src.rows.map((r) => r && r.employer).filter(Boolean))], [src.rows]);
  const built = useMemo(() => {
    const out = []; let bad = 0, ended = 0;
    src.rows.forEach((r) => {
      if (!r || !r.id) return;
      const cur = byId.get(String(r.id)); if (!cur || cur.isTerminated || cur.term || cur.active === false || String(r.reason || '') !== '') { ended++; return; }
      const pm = String(r.payMethod || 'مدد');
      if (meth === 'dom' && !(pm === 'مدد' || pm === 'تحويل')) return; if (meth === 'mudad' && pm !== 'مدد') return; if (meth === 'bank' && pm !== 'تحويل') return;
      if (er && String(r.employer || '') !== er) return; const net = num(r.netSAR); if (net <= 0) return;
      const e = cur, fx = (r.exchRate === '' || r.exchRate == null) ? 1 : (num(r.exchRate) || 1);
      const basic = num(r.salByDays) * fx, hou = num(r.houPay) * fx, other = (num(r.traPay) + num(r.prjPay) + num(r.othPay) + num(r.overtime) + num(r.leaveComp) + num(r.eosAmt) + num(r.otherAllow)) * fx, ded = Math.max(0, basic + hou + other - net);
      const iban = String(e.iban || r.iban || '').replace(/\s+/g, '').toUpperCase(), id = String(e.iqamaNo || e.iqama || e.idNo || r.iqamaNo || '').trim(), bank = iban.length >= 6 ? iban.slice(4, 6) : '';
      const problems = []; if (!idOK(id)) problems.push(T('رقم الهوية ناقص أو خاطئ', 'ID missing/invalid')); if (!ibanOK(iban)) problems.push(iban ? T('آيبان غير صحيح', 'Invalid IBAN') : T('الآيبان ناقص', 'IBAN missing'));
      if (problems.length) bad++;
      out.push({ r, id, iban, bank, basic, hou, other, ded, net, problems, skip: problems.length > 0 && !withBad });
    });
    return { rows: out, bad, ended };
  }, [src.rows, byId, meth, er, withBad, en]); // eslint-disable-line
  const use = built.rows.filter((x) => !x.skip);
  const tot = use.reduce((a, x) => ({ basic: a.basic + x.basic, hou: a.hou + x.hou, other: a.other + x.other, ded: a.ded + x.ded, net: a.net + x.net }), { basic: 0, hou: 0, other: 0, ded: 0, net: 0 });
  const HEAD = [T('رقم الهوية/الإقامة', 'ID / Iqama'), T('اسم الموظف', 'Employee name'), T('رمز البنك', 'Bank code'), T('اسم البنك', 'Bank'), T('رقم الآيبان', 'IBAN'), T('الراتب الأساسي', 'Basic salary'), T('بدل السكن', 'Housing'), T('بدلات أخرى', 'Other earnings'), T('الاستقطاعات', 'Deductions'), T('صافي الراتب', 'Net salary'), T('شهر الراتب', 'Salary month')];
  const dataRows = () => use.map((x) => [x.id, x.r.name || '', x.bank, BANKS[x.bank] || '', x.iban, r2(x.basic), r2(x.hou), r2(x.other), r2(x.ded), r2(x.net), m + '/' + y]);
  function xlsx() {
    const rows = dataRows(); if (!rows.length) return toast(T('لا توجد صفوف للتصدير', 'Nothing to export'), 'ter');
    const t = [T('الإجمالي', 'Total'), '', '', '', '', 0, 0, 0, 0, 0, '']; for (let i = 5; i <= 9; i++) t[i] = r2(rows.reduce((a, r) => a + num(r[i]), 0));
    saveXlsx('wps_' + y + '_' + p2(m) + '.xlsx', [{ name: 'WPS', rows: [HEAD, ...rows, t], widths: [16, 30, 10, 24, 28, 14, 14, 14, 14, 14, 12] }]);
  }
  function csv() { const rows = dataRows(); if (!rows.length) return toast(T('لا توجد صفوف للتصدير', 'Nothing to export'), 'ter'); saveCsv('wps_' + y + '_' + p2(m) + '.csv', HEAD, rows); }
  const Kpi = ({ l, v, c }) => <div style={{ background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 12, padding: '10px 14px', minWidth: 170, flex: 1 }}><div style={{ fontSize: 11, color: 'var(--mu)' }}>{l}</div><div style={{ fontSize: 19, fontWeight: 800, color: c, marginTop: 2 }}>{v}</div></div>;
  const Lb = ({ t }) => <label style={{ fontSize: 10.5, color: 'var(--mu)', display: 'block', marginBottom: 3 }}>{t}</label>;
  const ys = []; for (let k = now.getFullYear() - 3; k <= now.getFullYear() + 10; k++) ys.push(k);
  return (
    <div className="pg on" style={{ padding: '12px 16px' }}>
      <div className="card" style={{ padding: 14 }}>
        <div className="ct" style={{ marginBottom: 10 }}><i className="ti ti-building-bank" /> {T('ملف تحويل الرواتب (WPS / مدد)', 'Salary transfer file (WPS / Mudad)')}</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><Lb t={T('السنة', 'Year')} /><select id="WP_Y" value={y} onChange={(e) => setY(+e.target.value)} style={INP}>{ys.map((k) => <option key={k}>{k}</option>)}</select></div>
          <div><Lb t={T('الشهر', 'Month')} /><select id="WP_M" value={m} onChange={(e) => setM(+e.target.value)} style={INP}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></div>
          <div><Lb t={T('طريقة الدفع', 'Payment method')} /><select value={meth} onChange={(e) => setMeth(e.target.value)} style={INP}><option value="dom">{T('مدد + تحويل بنكي', 'Mudad + bank transfer')}</option><option value="mudad">{T('مدد فقط', 'Mudad only')}</option><option value="bank">{T('تحويل بنكي فقط', 'Bank transfer only')}</option><option value="all">{T('الكل (حتى النقدي والدولي)', 'All (incl. cash & international)')}</option></select></div>
          <div><Lb t={T('جهة العمل', 'Employer')} /><select value={er} onChange={(e) => setEr(e.target.value)} style={INP}><option value="">{T('كل الجهات', 'All employers')}</option>{ers.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
          <label style={{ fontSize: 12, paddingBottom: 7 }}><input type="checkbox" checked={withBad} onChange={(e) => setWithBad(e.target.checked)} /> {T('أضمّن الموظفين اللي بياناتهم ناقصة', 'Include employees with incomplete data')}</label>
          <div style={{ display: 'flex', gap: 6, marginInlineStart: 'auto' }}><button className="btn bpl bsm" onClick={xlsx}><i className="ti ti-file-spreadsheet" /> Excel</button><button className="btn bgr bsm" onClick={csv}><i className="ti ti-file-type-csv" /> CSV</button></div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12 }}>
          {src.rows.length > 0 && <>{T('مصدر المسير: ', 'Payroll source: ')}<b>{src.source}</b> — {src.approved ? <span style={{ color: 'var(--gr)' }}>{T('معتمد', 'approved')}</span> : <span style={{ color: 'var(--am)' }}>{T('غير معتمد (مسودة)', 'not approved (draft)')}</span>}</>}
          {built.ended > 0 && <span style={{ color: 'var(--mu)' }}> — {T('استُبعد ' + built.ended + ' موظف منتهي الخدمة أو غير موجود في بيانات الموظفين', 'Excluded ' + built.ended + ' ended-service / unknown employee(s)')}</span>}
          {built.bad > 0 && <span style={{ color: 'var(--rd)' }}> — {built.bad} {T('موظف بياناته ناقصة (هوية/آيبان)', 'employee(s) with missing/invalid ID or IBAN')}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}><Kpi l={T('عدد التحويلات', 'Transfers')} v={use.length} c="var(--cy)" /><Kpi l={T('إجمالي الصافي المطلوب تحويله (ر.س)', 'Total net to transfer (SAR)')} v={money(tot.net)} c="var(--gr)" /><Kpi l={T('الاستقطاعات', 'Deductions')} v={money(tot.ded)} c="var(--am)" /></div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {loading ? <div style={{ padding: 26, textAlign: 'center', color: 'var(--mu)' }}>…</div> : !built.rows.length ? <div style={{ padding: 26, textAlign: 'center', color: 'var(--mu)' }}>{T('لا يوجد مسير لهذا الشهر. افتح "مسير الرواتب" أولاً.', 'No payroll for this month. Open "Payroll" first.')}</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{[T('م', '#'), T('الاسم', 'Employee'), T('رقم الهوية', 'ID'), T('البنك', 'Bank'), T('الآيبان', 'IBAN'), T('الأساسي', 'Basic'), T('السكن', 'Housing'), T('بدلات أخرى', 'Other earnings'), T('الاستقطاعات', 'Deductions'), T('الصافي', 'Net'), T('ملاحظات', 'Notes')].map((x) => <th key={x} style={{ background: 'var(--c2)', padding: '7px 8px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, borderBottom: '2px solid var(--bl)', whiteSpace: 'nowrap' }}>{x}</th>)}</tr></thead>
            <tbody>
              {built.rows.map((x, i) => { const st = x.problems.length ? { background: 'rgba(229,72,77,.08)' } : {}; return (
                <tr key={x.r.id} style={{ opacity: x.skip ? 0.55 : 1 }}><td style={{ ...TD, ...st }}>{i + 1}</td><td style={{ ...TD, ...st, fontWeight: 700 }}>{x.r.name || ''}</td><td style={{ ...TD, ...st, direction: 'ltr', textAlign: 'right' }}>{x.id || '—'}</td><td style={{ ...TD, ...st }}>{BANKS[x.bank] || x.bank || '—'}</td><td style={{ ...TD, ...st, direction: 'ltr', textAlign: 'right', fontSize: 10.5 }}>{x.iban || '—'}</td><td style={{ ...TD, ...st }}>{money(x.basic)}</td><td style={{ ...TD, ...st }}>{money(x.hou)}</td><td style={{ ...TD, ...st }}>{money(x.other)}</td><td style={{ ...TD, ...st, color: 'var(--am)' }}>{money(x.ded)}</td><td style={{ ...TD, ...st, fontWeight: 800, color: 'var(--gr)' }}>{money(x.net)}</td><td style={{ ...TD, ...st, color: 'var(--rd)', fontSize: 10.5 }}>{x.problems.join(' / ')}{x.skip ? ' (' + T('مستبعد', 'excluded') + ')' : ''}</td></tr>); })}
              <tr style={{ background: 'rgba(41,179,94,.12)', fontWeight: 800 }}><td colSpan={5} style={TD}>{T('الإجمالي', 'Total')} ({use.length})</td><td style={TD}>{money(tot.basic)}</td><td style={TD}>{money(tot.hou)}</td><td style={TD}>{money(tot.other)}</td><td style={TD}>{money(tot.ded)}</td><td style={TD}>{money(tot.net)}</td><td style={TD} /></tr>
            </tbody>
          </table>)}
      </div>
    </div>
  );
}
