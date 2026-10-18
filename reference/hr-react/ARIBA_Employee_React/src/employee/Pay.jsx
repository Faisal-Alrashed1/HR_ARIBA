import { useEffect, useState } from 'react';
import { useEmp } from './EmpStore.jsx';
import { rpc } from '../lib/api.js';
import { printHtml, esc } from '../lib/print.js';
import { useLang } from '../lib/i18n.js';
import { T, isEN, money, num, MN_AR, MN_EN } from './util.jsx';

const pl = (raw) => (raw && raw.payload && typeof raw.payload === 'object' ? raw.payload : (raw || {}));
const isNewSlip = (p) => p.houPay !== undefined || p.salByDays !== undefined;
const monthTitle = (raw) => { const m = (isEN() ? MN_EN : MN_AR)[Number(raw && raw.month) || 0] || ''; return m + (raw && raw.year ? ' ' + raw.year : ''); };
const Row = ({ l, v, cls, neg }) => <div className={'hr-pay-row' + (cls ? ' ' + cls : '')}><span>{l}</span><b>{neg ? '- ' : ''}{typeof v === 'string' ? v : money(v)}</b></div>;
const Opt = (p) => (num(p.v) ? <Row {...p} /> : null);

/** قسيمة راتب شهرية معتمدة — الصيغة الجديدة (v119) أو القديمة */
export function SlipCard({ raw, onPdf }) {
  const p = pl(raw), t = monthTitle(raw);
  if (isNewSlip(p)) {
    const cur = p.currency && p.currency !== 'ريال سعودي' ? p.currency : '';
    const insEmp = p.noInsDeduct ? 0 : num(p.insEmp);
    return (
      <div className="card hr-pay-card slip-card">
        <div className="card-title"><i className="ti ti-file-invoice" /> {T('قسيمة الراتب', 'Payslip')}{t ? ' — ' + t : ''}</div>
        <Row l={T('الراتب الأساسي (حسب أيام العمل)', 'Basic salary (by working days)')} v={p.salByDays} />
        <Row l={T('بدل السكن', 'Housing allowance')} v={p.houPay} />
        <Row l={T('بدل النقل', 'Transport allowance')} v={p.traPay} />
        <Opt l={T('بدل المشروع', 'Project allowance')} v={p.prjPay} />
        <Opt l={T('بدلات أخرى', 'Other allowances')} v={num(p.othPay) + num(p.otherAllow)} />
        <Opt l={T('الإضافي', 'Overtime')} v={p.overtime} />
        <Opt l={T('بدل الإجازة', 'Leave allowance')} v={p.leaveComp} />
        <Opt l={T('مكافأة نهاية الخدمة', 'End-of-service award')} v={p.eosAmt} />
        <Row l={T('إجمالي المستحق', 'Total due')} v={p.totalDue} cls="hr-pay-total" />
        <Row l={T('استقطاع التأمينات', 'Insurance deduction')} v={insEmp} cls="hr-pay-ded" neg />
        <Opt l={T('سلف / غياب', 'Advances / absence')} v={p.loanDeduct} cls="hr-pay-ded" neg />
        <Opt l={T('استقطاعات أخرى', 'Other deductions')} v={p.otherDeduct} cls="hr-pay-ded" neg />
        <Row l={T('صافي الراتب', 'Net salary')} v={p.netSAR != null ? p.netSAR : p.net} cls="hr-pay-net" />
        {cur && <div className="hr-pay-row"><span>{T('الصافي بالعملة الأصلية', 'Net in original currency')}</span><b>{num(p.net).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {cur}</b></div>}
        <button type="button" className="a140-pdf btn" onClick={() => onPdf(raw)} style={{ width: '100%', marginTop: 10, background: 'var(--bp,#014D3D)', color: '#fff', border: 0, borderRadius: 12, padding: 11, fontWeight: 700, fontFamily: 'inherit' }}>⬇ {T('تحميل القسيمة PDF', 'Download payslip PDF')}</button>
      </div>
    );
  }
  const g = (...k) => { for (const x of k) if (p[x] != null) return num(p[x]); return 0; };
  const r = { sal: g('sal', 'salary'), hou: g('hou', 'housingAllowance'), tra: g('tra', 'transportAllowance'), prj: g('prj', 'projectAllowance'), oth: g('oth', 'otherAllowance'), tot: g('tot', 'salaryTotal', 'totalDue'), ins: g('insEmp', 'insuranceSub'), net: g('net', 'netSalary', 'netSAR'), loan: g('loanDeduct'), od: g('otherDeduct') };
  return (
    <div className="card hr-pay-card slip-card">
      <div className="card-title"><i className="ti ti-file-invoice" /> {T('قسيمة الراتب', 'Payslip')}{t ? ' — ' + t : ''}</div>
      <Row l={T('الراتب الأساسي', 'Basic salary')} v={r.sal} /><Row l={T('بدل السكن', 'Housing allowance')} v={r.hou} /><Row l={T('بدل النقل', 'Transport allowance')} v={r.tra} />
      <Row l={T('بدل المشروع', 'Project allowance')} v={r.prj} /><Row l={T('بدلات أخرى', 'Other allowances')} v={r.oth} />
      <Row l={T('إجمالي الراتب', 'Gross salary')} v={r.tot} cls="hr-pay-total" /><Row l={T('استقطاع التأمينات', 'Insurance deduction')} v={r.ins} cls="hr-pay-ded" neg />
      {r.loan ? <Row l={T('استقطاع السلفة', 'Advance deduction')} v={r.loan} cls="hr-pay-ded" neg /> : null}{r.od ? <Row l={T('استقطاعات أخرى', 'Other deductions')} v={r.od} cls="hr-pay-ded" neg /> : null}
      <Row l={T('صافي الراتب', 'Net salary')} v={r.net} cls="hr-pay-net" />
    </div>
  );
}

const nf = (v) => num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** قسيمة PDF من نافذة الطباعة (حفظ كـ PDF) */
function slipDoc(raw, me, CO) {
  const p = pl(raw), en = isEN(), cur = p.currency && p.currency !== 'ريال سعودي' ? p.currency : '';
  const mname = (en ? MN_EN : MN_AR)[Number(raw && raw.month) || 0] || '', title = (en ? 'Payslip' : 'قسيمة راتب') + ' — ' + mname + ' ' + (raw && raw.year || '');
  const nm = en ? (me.name_en || me.name || '') : (me.name || me.name_en || ''), co = en ? ((CO && CO.nameEn) || 'Ariba Business Solutions') : ((CO && CO.nameAr) || 'حلول اريبا لخدمات الأعمال');
  const insEmp = p.noInsDeduct ? 0 : num(p.insEmp);
  const rows = [[en ? 'Basic salary (by working days)' : 'الراتب الأساسي (حسب أيام العمل)', p.salByDays], [en ? 'Housing allowance' : 'بدل السكن', p.houPay], [en ? 'Transport allowance' : 'بدل النقل', p.traPay], [en ? 'Project allowance' : 'بدل المشروع', p.prjPay], [en ? 'Other allowances' : 'بدلات أخرى', num(p.othPay) + num(p.otherAllow)], [en ? 'Overtime' : 'الإضافي', p.overtime], [en ? 'Leave allowance' : 'بدل الإجازة', p.leaveComp], [en ? 'End-of-service award' : 'مكافأة نهاية الخدمة', p.eosAmt]].filter((r, i) => i < 3 || num(r[1]));
  const ded = [[en ? 'Social insurance' : 'استقطاع التأمينات', insEmp], [en ? 'Advances / absence' : 'سلف / غياب', p.loanDeduct], [en ? 'Other deductions' : 'استقطاعات أخرى', p.otherDeduct]].filter((r, i) => i === 0 || num(r[1]));
  const net = p.netSAR != null ? p.netSAR : p.net, td = 'padding:8px 12px;border-bottom:1px solid #e3ece7;font-size:13px', al = en ? 'right' : 'left';
  const logo = CO && CO.logo && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(CO.logo) ? '<img src="' + CO.logo + '" style="max-height:60px;max-width:180px;object-fit:contain">' : '';
  return '<style>@page{size:A4;margin:14mm}body{font-family:Tahoma,Arial,sans-serif;color:#231F20;margin:0}table{width:100%;border-collapse:collapse}.h{background:#014D3D;color:#fff;font-weight:700}</style>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #29B35E;padding-bottom:8px;margin-bottom:14px"><div><div style="font-size:18px;font-weight:800;color:#014D3D">' + esc(co) + '</div><div style="font-size:13px;color:#555;margin-top:2px">' + esc(title) + '</div></div>' + logo + '</div>'
    + '<table style="margin-bottom:12px"><tr><td style="' + td + ';width:30%;color:#587066">' + (en ? 'Employee' : 'الموظف') + '</td><td style="' + td + ';font-weight:700">' + esc(nm) + '</td></tr>' + (me.empNo ? '<tr><td style="' + td + ';color:#587066">' + (en ? 'Employee no.' : 'الرقم الوظيفي') + '</td><td style="' + td + '">' + esc(me.empNo) + '</td></tr>' : '') + '</table>'
    + '<table><tr class="h"><td style="padding:8px 12px">' + (en ? 'Earnings' : 'المستحقات') + '</td><td style="padding:8px 12px;text-align:' + al + '">' + (en ? 'SAR' : 'ر.س') + '</td></tr>' + rows.map((r) => '<tr><td style="' + td + '">' + r[0] + '</td><td style="' + td + ';text-align:' + al + ';direction:ltr">' + nf(r[1]) + '</td></tr>').join('') + '<tr style="background:#f1f8f4"><td style="' + td + ';font-weight:800">' + (en ? 'Total due' : 'إجمالي المستحق') + '</td><td style="' + td + ';text-align:' + al + ';direction:ltr;font-weight:800">' + nf(p.totalDue) + '</td></tr></table>'
    + '<table style="margin-top:12px"><tr class="h"><td style="padding:8px 12px">' + (en ? 'Deductions' : 'الاستقطاعات') + '</td><td style="padding:8px 12px;text-align:' + al + '">' + (en ? 'SAR' : 'ر.س') + '</td></tr>' + ded.map((r) => '<tr><td style="' + td + '">' + r[0] + '</td><td style="' + td + ';text-align:' + al + ';direction:ltr;color:#b45309">- ' + nf(r[1]) + '</td></tr>').join('') + '</table>'
    + '<table style="margin-top:12px"><tr style="background:#014D3D;color:#fff"><td style="padding:12px;font-size:15px;font-weight:800">' + (en ? 'Net salary' : 'صافي الراتب') + '</td><td style="padding:12px;font-size:16px;font-weight:800;text-align:' + al + ';direction:ltr">' + nf(net) + ' ' + (en ? 'SAR' : 'ر.س') + '</td></tr>' + (cur ? '<tr><td style="' + td + '">' + (en ? 'Net in original currency' : 'الصافي بالعملة الأصلية') + '</td><td style="' + td + ';text-align:' + al + ';direction:ltr">' + nf(p.net) + ' ' + esc(cur) + '</td></tr>' : '') + '</table>'
    + '<div style="margin-top:18px;font-size:11px;color:#6b7c75;text-align:center">' + (en ? 'This payslip is generated electronically and needs no signature.' : 'هذه القسيمة صادرة إلكترونيًا ولا تحتاج توقيعًا.') + '</div>';
}

export default function Pay() {
  useLang();
  const { me } = useEmp();
  const [CO, setCO] = useState(null);
  useEffect(() => { rpc('ariba_company_public', {}).then((r) => { if (r && r.ok) setCO(r); }).catch(() => {}); }, []);
  if (!me) return null;
  const arr = me.payroll || [];
  const gross = me.salaryTotal || (me.salary + me.hou + me.tra + me.prj + me.oth + (me.natureAllowance || 0));
  const pdf = (raw) => printHtml((isEN() ? 'Payslip' : 'قسيمة راتب'), slipDoc(raw, me, CO), { dir: isEN() ? 'ltr' : 'rtl', lang: isEN() ? 'en' : 'ar' });
  return (
    <div id="payTab">
      <div className="card hr-pay-card">
        <div className="card-title"><i className="ti ti-cash" /> {T('الراتب الحالي — من نظام الموارد البشرية', 'Current salary — from the HR system')}</div>
        <Row l={T('الراتب الأساسي', 'Basic salary')} v={me.salary} /><Row l={T('بدل السكن', 'Housing allowance')} v={me.hou} /><Row l={T('بدل النقل', 'Transport allowance')} v={me.tra} />
        <Row l={T('بدل المشروع', 'Project allowance')} v={me.prj} /><Row l={T('بدلات أخرى', 'Other allowances')} v={me.oth + (me.natureAllowance || 0)} />
        <Row l={T('إجمالي الراتب', 'Gross salary')} v={gross} cls="hr-pay-total" /><Row l={T('استقطاع التأمينات', 'Insurance deduction')} v={me.insuranceSub} cls="hr-pay-ded" neg />
        <Row l={T('صافي الراتب', 'Net salary')} v={me.net} cls="hr-pay-net" />
      </div>
      {arr.length > 0 && <SlipCard raw={arr[0]} onPdf={pdf} />}
      {arr.length > 1 && <div className="card"><div className="card-title"><i className="ti ti-history" /> {T('الرواتب الشهرية المعتمدة', 'Approved monthly payslips')}</div>{arr.map((raw, i) => <SlipCard key={(raw.year || '') + '-' + (raw.month || '') + '-' + i} raw={raw} onPdf={pdf} />)}</div>}
      {arr.length === 0 && <div className="card"><div style={{ fontSize: 11, color: 'var(--mu)' }}>{T('لا توجد مسيرات معتمدة حتى الآن.', 'No approved payslips yet.')}</div></div>}
      <div className="card"><div className="card-title"><i className="ti ti-building-bank" /> {T('بيانات البنك', 'Bank details')}</div><Row l="IBAN" v={me.iban || '—'} /></div>
    </div>
  );
}
