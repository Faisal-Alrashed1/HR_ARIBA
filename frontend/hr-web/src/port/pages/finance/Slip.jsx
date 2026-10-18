import { useEffect, useMemo, useState } from 'react';
import { aiBridge } from '../../lib/aiBridge.js';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import { payrollDraft } from '../../lib/payroll.js';
import { isEG, rules } from '../../engines/country.js';
import { calcFor } from './InsCalc.jsx';
import { MN_AR, MN_EN, num, money, monthCtx, isTerm, printOfficial, esc } from '../../lib/finance.js';

const INP = { background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '6px 9px', fontSize: 12 };

export default function Slip() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a);
  const { employees, settings } = useApp();
  const eg = isEG(), cur = T(eg ? 'ج.م' : 'ر.س', eg ? 'EGP' : 'SAR');
  const now = new Date();
  const list = useMemo(() => employees.filter((e) => e && !isTerm(e) && num(e.salaryTotal || e.salary || e.sal) > 0), [employees]);
  const [id, setId] = useState(''), [y, setY] = useState(now.getFullYear()), [m, setM] = useState(now.getMonth() + 1), [rows, setRows] = useState([]);
  const [aiAuto, setAiAuto] = useState(false), [ready, setReady] = useState(false);
  useEffect(() => { const q = aiBridge.pending; if (q && q.kind === 'payslip' && list.length) { aiBridge.pending = null; setId(String(q.empId)); setAiAuto(true); return; } if (!id && list.length) setId(String(list[0].id)); }, [list]); // eslint-disable-line
  useEffect(() => {
    let dead = false; setRows([]); setReady(false);
    payrollDraft(y, m).then((r) => { if (!dead) setRows((r && Array.isArray(r.rows)) ? r.rows.map((x) => x.payload).filter(Boolean) : []); }).catch(() => {}).finally(() => { if (!dead) setReady(true); });
    return () => { dead = true; };
  }, [y, m]);
  const e = list.find((x) => String(x.id) === String(id));
  const s = useMemo(() => {
    if (!e) return null;
    const row = rows.find((r) => String(r.id) === String(e.id));
    if (row) return { saved: true, basic: num(row.salByDays || row.sal), hou: num(row.houPay), tra: num(row.traPay), prj: num(row.prjPay), oth: num(row.othPay) + num(row.otherAllow) + num(row.overtime) + num(row.leaveComp) + num(row.eosAmt),
      gross: num(row.totalDue), ins: num(row.insEmp), tax: num(row.tax), mf: num(row.mf), loan: num(row.loanDeduct), ded: num(row.otherDeduct), net: num(row.net), co: num(row.insEr) };
    const c = calcFor(e, monthCtx(y, m), undefined);
    const basic = num(e.salary || e.sal), hou = num(e.housingAllowance || e.hou), tra = num(e.transportAllowance || e.tra), prj = num(e.projectAllowance), oth = num(e.otherAllowance), ded = num(e.otherDeductions);
    const gross = basic + hou + tra + prj + oth;
    return { saved: false, basic, hou, tra, prj, oth, gross, ins: c.emp, tax: 0, mf: 0, loan: 0, ded, net: gross - c.emp - ded, co: c.co };
  }, [e, rows, y, m]);
  const co = (settings.names && (en ? (settings.names.coEn || settings.names.coAr) : (settings.names.coAr || settings.names.coEn))) || '';
  const mn = (en ? MN_EN : MN_AR)[m] + ' ' + y;
  function html() {
    const dir = en ? 'ltr' : 'rtl';
    const CSS = '<style>*{box-sizing:border-box}.sl{font-family:"ARIBA Two","Segoe UI",Tahoma,Arial,sans-serif;color:#1a1a1a;line-height:1.5;font-size:13px;padding:0 14mm}.sl .hd{text-align:center;padding-bottom:4px;margin-bottom:8px}.sl .co{font-size:17px;font-weight:900;color:#014D3D}.sl .ti{font-size:14px;color:#444;margin-top:2px;font-weight:700}'
      + '.sl .ig{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;background:#f7f9f8;border:1px solid #e0e4e2;border-radius:8px;padding:10px 14px;margin-bottom:10px}.sl .ig div{font-size:12.5px}.sl .ig b{color:#014D3D}'
      + '.sl table.dt{width:100%;border-collapse:collapse;font-size:12px;page-break-inside:avoid}.sl table.dt th{background:#014D3D;color:#fff;padding:5px 10px;text-align:start;font-size:12px}.sl table.dt th.rd{background:#9b2c2c}.sl table.dt td{padding:4px 10px;border-bottom:1px solid #e0e4e2}.sl td.v{text-align:end;direction:ltr;font-weight:700}'
      + '.sl .tot td{background:#e8f0ee;color:#014D3D;font-weight:800}.sl .net{margin-top:12px;background:#014D3D;color:#fff;border-radius:8px;padding:10px;text-align:center}.sl .net small{display:block;font-size:11px;opacity:.85}.sl .net b{font-size:22px}.sl .sign{display:flex;justify-content:space-between;margin-top:26px;font-size:12.5px}.sl .sign div{width:45%;border-top:1px solid #333;padding-top:4px;text-align:center}</style>';
    const R = (a, v, neg) => '<tr><td>' + esc(a) + '</td><td class="v">' + (neg && v ? '-' : '') + money(v) + '</td></tr>';
    const earn = R(T('الراتب الأساسي', 'Basic'), s.basic) + R(T('بدل السكن', 'Housing'), s.hou) + R(T('بدل المواصلات', 'Transport'), s.tra) + R(T('بدل المشروع', 'Project'), s.prj) + R(T('بدلات أخرى', 'Other'), s.oth);
    const dd = R(T('التأمينات الاجتماعية', 'Social insurance'), s.ins, 1) + (eg ? R(T('ضريبة كسب العمل', 'Income tax'), s.tax, 1) + R(T('صندوق الشهداء', 'Martyrs fund'), s.mf, 1) : '') + R(T('سلف / غياب', 'Advances / absence'), s.loan, 1) + R(T('استقطاعات أخرى', 'Other'), s.ded, 1);
    const tded = s.ins + s.tax + s.mf + s.loan + s.ded;
    return CSS + '<div class="sl" dir="' + dir + '"><div class="hd"><div class="co">' + esc(co) + '</div><div class="ti">' + T('كشف راتب — ', 'Salary slip — ') + esc(mn) + '</div></div>'
      + '<div class="ig"><div><b>' + T('الموظف: ', 'Employee: ') + '</b>' + esc(en ? (e.nameEn || e.nameAr) : (e.nameAr || e.nameEn)) + '</div><div><b>' + T('الرقم الوظيفي: ', 'Emp. no: ') + '</b>' + esc(e.empNo || '—') + '</div><div><b>' + T('الوظيفة: ', 'Job: ') + '</b>' + esc(e.jobTitle || '—') + '</div><div><b>' + T('جهة العمل: ', 'Employer: ') + '</b>' + esc(e.employer || '—') + '</div><div style="grid-column:1/-1"><b>IBAN: </b><span style="direction:ltr;display:inline-block">' + esc(e.iban || '—') + '</span></div></div>'
      + '<table class="dt"><tr><th colspan="2">' + T('الاستحقاقات', 'Earnings') + '</th></tr>' + earn + '<tr class="tot"><td>' + T('إجمالي الاستحقاقات', 'Total earnings') + '</td><td class="v">' + money(s.gross) + '</td></tr></table>'
      + '<table class="dt" style="margin-top:10px"><tr><th class="rd" colspan="2">' + T('الاستقطاعات', 'Deductions') + '</th></tr>' + dd + '<tr class="tot"><td>' + T('إجمالي الاستقطاعات', 'Total deductions') + '</td><td class="v">-' + money(tded) + '</td></tr></table>'
      + '<div class="net"><small>' + T('صافي الراتب المستحق', 'Net salary due') + '</small><b>' + money(s.net) + ' ' + esc(cur) + '</b></div>'
      + '<div class="sign"><div>' + T('الموارد البشرية / المالية', 'HR / Finance') + '</div><div>' + T('توقيع الموظف: ', 'Employee signature: ') + '________</div></div></div>';
  }
  useEffect(() => { if (aiAuto && ready && s) { setAiAuto(false); printOfficial(settings, T('كشف راتب', 'Salary slip'), html(), { dir: en ? 'ltr' : 'rtl', lang: en ? 'en' : 'ar' }); } }, [aiAuto, ready, s]); // eslint-disable-line
  const fN = (n) => num(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const Row = ({ a, v, neg, c }) => (!v ? <div className="prow" style={{ color: 'var(--dm)' }}><span>{a}</span><span>—</span></div> : <div className="prow"><span>{a}</span><span style={{ color: c || (neg ? 'var(--rd)' : undefined), fontWeight: neg ? undefined : 600 }}>{neg ? '-' : ''}{fN(v)} {cur}</span></div>);
  const ys = []; for (let k = 2011; k <= 2086; k++) ys.push(k);
  return (
    <div>
      <div className="card" style={{ padding: 0, marginBottom: 0 }}>
        <div className="ch" style={{ padding: '12px 14px', flexWrap: 'wrap', gap: 8 }}>
          <div className="ct"><i className="ti ti-receipt" /> <span id="t_slip">{T('كشف الراتب التفصيلي', 'Detailed salary slip')}</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', alignItems: 'center', width: '100%' }}>
            <select id="SLE" style={{ flex: '2 1 0', minWidth: 0 }} value={id} onChange={(x) => setId(x.target.value)}>{list.map((x) => <option key={x.id} value={x.id}>{(en ? (x.nameEn || x.nameAr) : (x.nameAr || x.nameEn))}</option>)}{!list.length && <option value="">{T('لا يوجد موظفون', 'No employees')}</option>}</select>
            <select id="SLM" style={{ flex: '1 1 0', minWidth: 0 }} value={m} onChange={(x) => setM(+x.target.value)}>{(en ? MN_EN : MN_AR).slice(1).map((n, i) => <option key={i} value={i + 1}>{n}</option>)}</select>
            <select id="SLY" style={{ flex: '0 1 80px', minWidth: 0 }} value={y} onChange={(x) => setY(+x.target.value)}>{ys.map((k) => <option key={k}>{k}</option>)}</select>
            <button className="btn bpl bsm" id="SL_PRINT" style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }} disabled={!s} onClick={() => s && printOfficial(settings, T('كشف راتب', 'Salary slip'), html(), { dir: en ? 'ltr' : 'rtl', lang: en ? 'en' : 'ar' })}><i className="ti ti-printer" /> {T('طباعة رسمية', 'Official print')}</button>
          </div>
        </div>
        <div style={{ padding: 16 }}>
      <div id="SLC">
        {e && s ? (
          <div className="psc">
            <div style={{ textAlign: 'center', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--bd)' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--bl)' }}>{co}</div>
              <div style={{ fontSize: 12, color: 'var(--mu)', marginTop: 3 }}>{T('كشف راتب', 'Salary slip')} — {mn}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, background: 'var(--c2)', borderRadius: 8, padding: 10 }}>
              <div><div style={{ fontSize: 10, color: 'var(--dm)' }}>{T('الموظف', 'Employee')}</div><div style={{ fontWeight: 700 }}>{en ? (e.nameEn || e.nameAr) : e.nameAr}</div></div>
              <div><div style={{ fontSize: 10, color: 'var(--dm)' }}>{T('الوظيفة', 'Job title')}</div><div>{e.jobTitle || '—'}</div></div>
              <div><div style={{ fontSize: 10, color: 'var(--dm)' }}>{T('جهة العمل', 'Employer')}</div><div>{e.employer || '—'}</div></div>
              <div style={{ gridColumn: '1/-1' }}><div style={{ fontSize: 10, color: 'var(--dm)' }}>IBAN</div><div style={{ fontFamily: 'monospace', fontSize: 11 }}>{e.iban || '—'}</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'rgba(16,185,129,.07)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 9, padding: 13 }}>
                <div style={{ fontWeight: 700, color: 'var(--gr)', marginBottom: 9, fontSize: 12 }}>{T('الاستحقاقات', 'Earnings')}</div>
                <Row a={T('الراتب الأساسي', 'Basic salary')} v={s.basic} /><Row a={T('بدل السكن', 'Housing')} v={s.hou} /><Row a={T('بدل المواصلات', 'Transport')} v={s.tra} /><Row a={T('بدل المشروع', 'Project')} v={s.prj} /><Row a={T('بدلات أخرى', 'Other')} v={s.oth} />
                <div style={{ borderTop: '1px solid rgba(16,185,129,.3)', marginTop: 8, paddingTop: 7, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>{T('الإجمالي', 'Total')}</span><span style={{ color: 'var(--gr)' }}>{money(s.gross)} {cur}</span></div>
              </div>
              <div style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 9, padding: 13 }}>
                <div style={{ fontWeight: 700, color: 'var(--rd)', marginBottom: 9, fontSize: 12 }}>{T('الاستقطاعات', 'Deductions')}</div>
                <Row a={T('التأمينات الاجتماعية', 'Social insurance')} v={s.ins} neg />
                {s.loan > 0 && <Row a={T('سلف / غياب', 'Advances / absence')} v={s.loan} neg />}
                <Row a={T('استقطاعات أخرى', 'Other deductions')} v={s.ded} neg />
                <div style={{ borderTop: '1px solid rgba(239,68,68,.3)', marginTop: 8, paddingTop: 7, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>{T('إجمالي الاستقطاعات', 'Total deductions')}</span><span style={{ color: 'var(--rd)' }}>-{money(s.ins + s.tax + s.mf + s.loan + s.ded)} {cur}</span></div>
              </div>
            </div>
            {eg && <div style={{ border: '1px dashed var(--bd)', borderRadius: 8, padding: '9px 12px', fontSize: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 5 }}>{T('تفصيل الاستقطاعات (النظام المصري)', 'Deduction breakdown (Egypt)')}</div>
              <Row a={T('التأمينات — حصة العامل (' + rules().insEmp + '%)', 'Insurance — employee share (' + rules().insEmp + '%)')} v={s.ins} neg />
              <Row a={T('ضريبة كسب العمل', 'Income tax')} v={s.tax} neg />
              <Row a={T('صندوق الشهداء (' + rules().martyrs + '%)', 'Martyrs fund (' + rules().martyrs + '%)')} v={s.mf} neg />
            </div>}
            {s.co > 0 && <div className="al alb" style={{ marginBottom: 12 }}><i className="ti ti-info-circle" /><span style={{ fontSize: 11 }}>{T('تأمينات الشركة: ', 'Company insurance: ')}{money(s.co)} {cur} — {T('لا تُخصم من الموظف', 'not deducted from employee')}</span></div>}
            <div style={{ background: 'linear-gradient(135deg,rgba(59,130,246,.15),rgba(6,182,212,.1))', border: '2px solid var(--bl)', borderRadius: 11, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>{T('صافي الراتب المستحق', 'Net salary due')}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--bl)' }}>{money(s.net)} <span style={{ fontSize: 16 }}>{cur}</span></div>
            </div>
          </div>
        ) : <div style={{ textAlign: 'center', color: 'var(--mu)' }}>{T('اختر موظفاً', 'Select an employee')}</div>}
      </div>
        </div>
      </div>
    </div>
  );
}
