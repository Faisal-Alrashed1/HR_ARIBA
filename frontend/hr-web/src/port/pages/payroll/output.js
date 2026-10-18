// تصدير Excel + الطباعة المختصرة للمسير (A4 عرضي) — نفس محتوى النظام القديم
import { PAYX as X } from '../../engines/payx.js';
import { num, sums } from '../../engines/payrollRows.js';
import { money, dmy } from './cols.jsx';
import { esc } from '../../lib/print.js';
import { buildXlsx } from '../../lib/xlsx.js';

export const MONTHS_AR = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const MONTHS_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const val = (r, t) => {
  const g = {
    'م': r.idx, 'الرقم': r.empNo, 'الاسم': r.name, 'الجنسية': r.nat, 'نطاق العمل': r.employer, 'الوظيفة': r.job, 'بداية العقد': dmy(r.join), 'نهاية العقد / آخر يوم': dmy(r.lastDay || r.contractEnd), 'مدة التعاقد (شهر)': r.contractMonths,
    'سنوات الخدمة': (r.K == null || Number.isNaN(r.K)) ? '' : Math.round(r.K * 100) / 100, 'سبب الإنهاء': r.eosLaw, 'المستحق سنويًا (يوم)': r.leaveDays, 'رصيد المستحق خلال فترة التعاقد': r.N,
    'ما تم استحقاقه (يوم)': X.findReason(r.reason) || r.usedManual != null ? num(r.usedManual != null ? r.usedManual : r.usedAuto) : '', 'الرصيد المستحق (يوم)': r.P, 'الأساسي': r.sal, 'العملة': r.currency, 'معدل الصرف': r.exchRate,
    'الراتب شامل البدلات': r.allIn, 'أيام العمل': r.workDays, 'أيام التأمينات': r.insDays, 'الراتب حسب الأيام': r.salByDays, 'ساعات الإضافي': r.otHours || 0, 'إضافي': r.overtime, 'سكن': r.houPay, 'مواصلات': r.traPay,
    'مشروع (شهري)': r.prjPay, 'أخرى (شهري)': r.othPay, 'بدل أجازة': r.leaveComp, 'خدمة (سنة)': r.svcY, 'خدمة (شهر)': r.svcM, 'خدمة (يوم)': r.svcD, 'تكلفة السنوات': r.costY, 'تكلفة الشهور': r.costM, 'تكلفة الأيام': r.costD,
    'إجمالي المكافأة': r.eos, 'مكافأة نهاية الخدمة': r.eosAmt, 'إجمالي المستحق': r.totalDue, 'سلف / غياب': r.loanDeduct, 'تأمينات موظف': r.noInsDeduct ? 0 : r.insEmp, 'ضريبة كسب العمل': r.tax, 'صندوق الشهداء': r.mf, 'أخرى': r.otherDeduct,
    'الأجر الخاضع للتأمينات': r.insBase, 'تأمينات شركة': r.insEr, 'حالة التأمينات': r.insStatus, 'إجمالي المستقطع': r.totalDeduct, 'المستحق بالعملة': r.net, 'الصافي (ريال سعودي)': r.netSAR, 'الصافي (جنيه مصري)': r.netSAR, 'طريقة الدفع': r.payMethod, 'ملاحظات': r.notes,
  }[t];
  if (typeof g === 'number' && Number.isFinite(g)) return Math.round(g * 100) / 100;
  return g == null || (typeof g === 'number' && !Number.isFinite(g)) ? '' : g;
};
export function payrollXlsx(rows, cols, SUMCOL, y, m) {
  const head = cols.map((c) => c.t);
  const data = [head, ...rows.map((r) => cols.map((c) => val(r, c.t)))];
  const s = sums(rows);
  data.push(cols.map((c, i) => { if (i === 0) return 'الإجمالي'; const k = SUMCOL[c.t]; return k ? Math.round(s[k] * 100) / 100 : ''; }));
  const blob = buildXlsx([{ name: 'رواتب الموظفين', rows: data, widths: cols.map((c, i) => (i === 2 ? 30 : (i < 6 ? 14 : 15))) }]);
  return { blob, name: 'payroll_' + y + '_' + String(m).padStart(2, '0') + '.xlsx' };
}

const PCSS = '<style>@page{size:A4 landscape;margin:8mm 9mm}*{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#10231c;font-size:8.2px;direction:rtl}'
  + '.hd{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #014D3D;padding-bottom:4px;margin-bottom:5px}.hd img{height:12mm}.hd .t{text-align:center;flex:1}.hd .t b{display:block;font-size:13px;color:#014D3D}.hd .t span{font-size:9.5px;color:#555}'
  + 'table{width:100%;border-collapse:collapse;table-layout:auto}thead{display:table-header-group}tr{page-break-inside:avoid}th{background:#014D3D;color:#fff;padding:3px 2px;font-size:8px;font-weight:700;text-align:center;border:1px solid #014D3D}td{padding:1.5px 3px;border:1px solid #d9e3df;text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap}td.n{text-align:right;font-weight:700;white-space:normal}'
  + 'tr.g td{background:#e8f3ee;font-weight:800;color:#014D3D;text-align:right}tr.s td{background:#f1f6f4;font-weight:800}tr.gt td{background:#014D3D;color:#fff;font-weight:800;font-size:9px}'
  + '.sum{display:flex;gap:5px;margin:4px 0}.sum div{flex:1;border:1px solid #d9e3df;border-radius:6px;padding:4px 6px;background:#f7faf9}.sum b{display:block;font-size:11px;color:#014D3D}.sum span{font-size:8px;color:#666}'
  + '.sg{display:flex;justify-content:space-around;margin-top:3px;page-break-inside:avoid}.sg div{text-align:center;width:26%;font-size:8.5px;font-weight:700}.sg i{display:block;border-top:1px solid #333;margin-top:9px;padding-top:1px;font-style:normal;font-weight:400;color:#555}'
  + '.ft{margin-top:3px;font-size:7.5px;color:#777;text-align:center;border-top:1px solid #ddd;padding-top:3px}.cur{color:#a15c00}</style>';

/** يرجع HTML كامل لطباعة المسير (كل القيم مهرّبة esc) */
export function payrollPrintHtml(rows, { y, m, logo, signer, en = false, companyTitle }) {
  const mn = (en ? MONTHS_EN : MONTHS_AR)[m] + ' ' + y, order = [], by = {};
  rows.forEach((r) => { const k = r.employer || '—'; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(r); });
  const H = en ? ['#', 'Employee', 'Days', 'Ins. days', 'Basic', 'Housing', 'Transport', 'Project + other', 'Overtime', 'Leave pay', 'End-of-service', 'Total due', 'Advances / absence', 'Employee insurance', 'Other deductions', 'Total deductions', 'Net', 'Currency', 'Net (SAR)']
    : ['م', 'الاسم', 'أيام', 'أيام التأمينات', 'الأساسي', 'سكن', 'مواصلات', 'مشروع + أخرى', 'إضافي', 'بدل إجازة', 'مكافأة نهاية الخدمة', 'إجمالي المستحق', 'سلف / غياب', 'تأمينات الموظف', 'خصومات أخرى', 'إجمالي المستقطع', 'الصافي', 'العملة', 'الصافي (ر.س)'];
  const tr = (r, i) => '<tr><td>' + (i + 1) + '</td><td class="n">' + esc(String(r.name || '').split(' ').slice(0, 3).join(' ')) + (X.findReason(r.reason) ? ' <span class="cur">●</span>' : '') + '</td><td>' + num(r.workDays) + '</td><td>' + num(r.insDays) + '</td><td>' + money(r.sal) + '</td><td>' + money(r.houPay) + '</td><td>' + money(r.traPay) + '</td><td>' + money(num(r.prjPay) + num(r.othPay) + num(r.otherAllow)) + '</td><td>' + money(r.overtime) + '</td><td>' + money(r.leaveComp) + '</td><td>' + money(r.eosAmt) + '</td><td><b>' + money(r.totalDue) + '</b></td><td>' + money(r.loanDeduct) + '</td><td>' + money(r.insEmp && !r.noInsDeduct ? r.insEmp : 0) + '</td><td>' + money(r.otherDeduct) + '</td><td><b>' + money(r.totalDeduct) + '</b></td><td><b>' + money(r.net) + '</b></td><td class="cur">' + esc(r.currency && r.currency !== 'ريال سعودي' ? r.currency : 'ر.س') + '</td><td><b>' + money(r.netSAR) + '</b></td></tr>';
  const srow = (label, list, cls) => { const s = sums(list); return '<tr class="' + cls + '"><td colspan="4" style="text-align:right">' + esc(label) + ' (' + list.length + ')</td><td>' + money(s.sal) + '</td><td>' + money(s.houPay) + '</td><td>' + money(s.traPay) + '</td><td>' + money(s.prjPay + s.othPay) + '</td><td>' + money(s.overtime) + '</td><td>' + money(s.leaveComp) + '</td><td>' + money(s.eosAmt) + '</td><td>' + money(s.totalDue) + '</td><td>' + money(s.loanDeduct) + '</td><td>' + money(list.reduce((a, r) => a + (r.noInsDeduct ? 0 : num(r.insEmp)), 0)) + '</td><td>' + money(s.otherDeduct) + '</td><td>' + money(s.totalDeduct) + '</td><td>' + money(s.net) + '</td><td></td><td>' + money(s.netSAR) + '</td></tr>'; };
  let body = '', n = 0;
  order.forEach((k) => { body += '<tr class="g"><td colspan="' + H.length + '">' + esc(k) + '</td></tr>'; by[k].forEach((r) => { body += tr(r, n++); }); body += srow('إجمالي ' + k, by[k], 's'); });
  body += srow('الإجمالي العام', rows, 'gt');
  const byCur = {}, byPay = {}, s = sums(rows);
  rows.forEach((r) => { const c = (r.currency && r.currency !== 'ريال سعودي') ? r.currency : 'ر.س'; byCur[c] = (byCur[c] || 0) + num(r.net); const p = r.payMethod || 'مدد'; byPay[p] = (byPay[p] || 0) + num(r.netSAR); });
  const box = (v, l) => '<div><b>' + esc(v) + '</b><span>' + esc(l) + '</span></div>';
  const curTxt = Object.keys(byCur).map((c) => money(byCur[c]) + ' ' + c).join(' + '), payTxt = Object.keys(byPay).map((k) => k + ' ' + money(byPay[k])).join(' · ');
  const sg = signer || { titleAr: 'مدير الموارد البشرية', nameAr: '' };
  return PCSS + '<div class="hd"><div class="t"><b>' + esc(companyTitle || 'كشف رواتب ومكافآت الموظفين') + '</b><span>عن شهر ' + esc(mn) + ' — عدد الموظفين ' + rows.length + '</span></div>' + (logo ? '<img src="' + esc(logo) + '" alt="">' : '') + '</div>'
    + '<table><thead><tr>' + H.map((h) => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table>'
    + '<div class="sum">' + box(money(s.totalDue), 'إجمالي المستحقات') + box(money(s.totalDeduct), 'إجمالي الاستقطاعات') + box(curTxt, 'الصافي بالعملات') + box(money(s.netSAR), 'الصافي (ر.س)') + box(money(s.insEr), 'تأمينات الشركة') + '</div>'
    + '<div class="ft">حسب طريقة الدفع (ر.س): ' + esc(payTxt) + ' &nbsp;|&nbsp; ● موظف منتهي الخدمة (يشمل بدل الإجازة ومكافأة نهاية الخدمة)</div>'
    + '<div class="sg"><div>' + esc(sg.titleAr) + '<i>' + esc(sg.nameAr) + '</i></div><div>المدير المالي<i></i></div><div>الرئيس التنفيذي<i></i></div></div>';
}
