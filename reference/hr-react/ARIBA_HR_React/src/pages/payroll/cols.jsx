// أعمدة جدول المسير (نفس ترتيب الإكسيل) — كل عمود: عنوان + دالة عرض (r, locked, api)
import { PAYX as X } from '../../engines/payx.js';
import { num } from '../../engines/payrollRows.js';

export const money = (n) => num(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dmy = (s) => { const a = String(s || '').slice(0, 10).split('-'); return a.length === 3 && a[0] ? (a[2] + '/' + a[1] + '/' + a[0]) : ''; };
const f2 = (v) => (v === null || v === undefined || v === '' ? '' : money(v));
const INP = { background: 'transparent', border: '1px solid transparent', borderRadius: 4, color: 'var(--tx)', fontSize: 11, textAlign: 'right', padding: 2 };
const SEL = { background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 4, fontSize: 10, color: 'var(--tx)', padding: 2 };
const Back = ({ title, onClick }) => <a href="#auto" title={title} style={{ color: 'var(--cy)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); onClick(); }}>↺</a>;

/** حقل إدخال: يلتزم بالقيمة عند الخروج منه (مثل onchange القديم) */
export function Inp({ row, field, value, w = 70, locked, type = 'number', step = '0.01', api }) {
  if (locked) return type === 'date' ? dmy(value) : (value === null || value === undefined || value === '' ? '' : String(value));
  return <input key={String(row.id) + field + String(value)} type={type} defaultValue={value === null || value === undefined ? '' : value} step={step} style={{ ...INP, width: w }}
    onFocus={(e) => { e.target.style.borderColor = 'var(--bd)'; }} onBlur={(e) => { e.target.style.borderColor = 'transparent'; if (String(e.target.value) !== String(value ?? '')) api.update(row.id, field, e.target.value); }}
    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />;
}
export function Sel({ row, field, value, opts, locked, w = 110, api }) {
  if (locked) { const o = opts.find((x) => x[0] === value); return o ? o[1] : value; }
  return <select value={value ?? ''} style={{ ...SEL, maxWidth: w }} onChange={(e) => api.update(row.id, field, e.target.value)}>{opts.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>;
}
export const REASON_OPTS = [['', '—'], ...X.REASONS.map((r) => [r.k, r.ar])];
export const ST_SA = [['يطابق', 'يطابق'], ['لا يطابق', 'لا يطابق'], ['غير سعودي', 'غير سعودي'], ['غير خاضع', 'غير خاضع'], ['لا يطبق', 'لا يطبق']];
export const ST_EG = [['خاضع', 'خاضع'], ['غير خاضع', 'غير خاضع']];
export const PAY_OPTS = [['مدد', 'مدد'], ['تحويل', 'تحويل بنكي'], ['تحويل دولي', 'تحويل دولي'], ['نقد', 'نقداً']];

export function buildCols(eg) {
  const man = (r, f) => !!(r.manualEdits && r.manualEdits[f]);
  const cols = [
    { g: 'بيانات الموظف', t: 'م', v: (r) => r.idx, sticky: true },
    { t: 'الرقم', v: (r) => r.empNo },
    { t: 'الاسم', v: (r) => <><b>{String(r.name || '').split(' ').slice(0, 3).join(' ')}</b>{r.reason ? <span style={{ color: '#d97706', fontSize: 9 }}> ●</span> : null}</>, st: { minWidth: 130 }, sticky: true },
    { t: 'الجنسية', v: (r) => r.nat },
    { t: 'نطاق العمل', v: (r) => <span className="b bb" style={{ fontSize: 10 }}>{r.employer}</span> },
    { t: 'الوظيفة', v: (r) => <span style={{ color: 'var(--mu)' }}>{r.job}</span>, st: { maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' } },
    { g: 'التعاقد والإجازة', t: 'بداية العقد', v: (r) => dmy(r.join) },
    { t: 'نهاية العقد / آخر يوم', v: (r, L, api) => <Inp row={r} field="lastDay" value={r.lastDay || r.contractEnd} w={118} locked={L} type="date" api={api} /> },
    { t: 'مدة التعاقد (شهر)', v: (r) => (r.contractMonths == null ? '' : r.contractMonths) },
    { t: 'سنوات الخدمة', v: (r) => ((r.K === null || r.K === undefined || Number.isNaN(r.K)) ? '' : num(r.K).toFixed(2)) },
    { t: 'سبب الإنهاء', v: (r, L, api) => <Sel row={r} field="reason" value={(X.findReason(r.reason) || {}).k || ''} opts={REASON_OPTS} locked={L} w={170} api={api} />, st: { minWidth: 150 } },
    { t: 'المستحق سنويًا (يوم)', v: (r, L, api) => <Inp row={r} field="leaveDays" value={r.leaveDays} w={50} locked={L} api={api} /> },
    { t: 'رصيد المستحق خلال فترة التعاقد', v: (r) => ((r.N === null || r.N === undefined) ? '' : f2(r.N)) },
    { t: 'ما تم استحقاقه (يوم)', v: (r, L, api) => { const auto = X.findReason(r.reason); const m = r.usedManual !== null && r.usedManual !== undefined && r.usedManual !== ''; return <><Inp row={r} field="usedManual" value={m ? r.usedManual : (auto ? num(r.usedAuto) : '')} w={70} locked={L} api={api} />{!L && m && <> <Back title="رجوع للقيمة التلقائية من سجل الإجازات" onClick={() => api.update(r.id, 'usedManual', 'auto')} /></>}</>; } },
    { t: 'الرصيد المستحق (يوم)', v: (r) => ((r.P === null || r.P === undefined) ? '' : <b>{f2(r.P)}</b>) },
    { g: 'الراتب', t: 'الأساسي', v: (r) => <span style={{ color: 'var(--gr)' }}>{money(r.sal)}</span> },
    { t: 'العملة', v: (r) => r.currency },
    { t: 'معدل الصرف', v: (r, L, api) => <Inp row={r} field="exchRate" value={r.exchRate} w={56} locked={L} api={api} /> },
    { t: 'الراتب شامل البدلات', v: (r, L, api) => { const m = r.allInManual !== null && r.allInManual !== undefined && r.allInManual !== ''; return <><Inp row={r} field="allInManual" value={m ? r.allInManual : num(r.allIn).toFixed(2)} w={84} locked={L} api={api} />{!L && m && <> <Back title="رجوع للحساب التلقائي" onClick={() => api.update(r.id, 'allInManual', 'auto')} /></>}</>; } },
    { t: 'أيام العمل', v: (r, L, api) => <><span style={{ color: man(r, 'workDays') ? 'var(--am)' : 'inherit' }}><Inp row={r} field="workDays" value={r.workDays} w={48} locked={L} api={api} /></span>{!L && man(r, 'workDays') && <> <Back title="رجوع لأيام العمل التلقائية (أيام الشهر)" onClick={() => api.update(r.id, 'workDays', 'auto')} /></>}</> },
    { t: 'أيام التأمينات', v: (r, L, api) => <><span style={{ color: man(r, 'insDays') ? 'var(--am)' : 'inherit' }}><Inp row={r} field="insDays" value={r.insDays} w={48} locked={L} api={api} /></span>{!L && man(r, 'insDays') && <> <Back title="رجوع لأيام التأمينات التلقائية (أيام الشهر)" onClick={() => api.update(r.id, 'insDays', 'auto')} /></>}</> },
    { t: 'الراتب حسب الأيام', v: (r) => <span style={{ color: 'var(--cy)' }}>{money(r.salByDays)}</span> },
    { g: 'البدلات', t: 'ساعات الإضافي', v: (r, L, api) => <Inp row={r} field="otHours" value={r.otHours || ''} w={52} locked={L} api={api} /> },
    { t: 'إضافي', v: (r, L, api) => { if (num(r.otHours) > 0) return money(r.overtime); return <><Inp row={r} field="otAmount" value={r.otAmount || ''} w={64} locked={L} api={api} />{!L && man(r, 'otAmount') && <> <Back title="رجوع لقيمة الإضافي في بيانات الموظف" onClick={() => api.update(r.id, 'otAmount', 'auto')} /></>}</>; } },
    { t: 'سكن', v: (r) => money(r.houPay) },
    { t: 'مواصلات', v: (r) => money(r.traPay) },
    { t: 'مشروع (شهري)', v: (r, L, api) => <Inp row={r} field="prj" value={r.prj} w={70} locked={L} api={api} /> },
    { t: 'أخرى (شهري)', v: (r, L, api) => <Inp row={r} field="oth" value={r.oth} w={70} locked={L} api={api} /> },
    { t: 'بدل أجازة', v: (r, L, api) => (X.findReason(r.reason) ? <b style={{ color: '#d97706' }}>{money(r.leaveComp)}</b> : (num(r.leaveManual) > 0 ? <Inp row={r} field="leaveManual" value={r.leaveManual} w={64} locked={L} api={api} /> : money(0))) },
    { g: 'مكافأة نهاية الخدمة', t: 'خدمة (سنة)', v: (r) => (r.svcY === undefined || Number.isNaN(r.svcY) ? '' : r.svcY) },
    { t: 'خدمة (شهر)', v: (r) => (r.svcM === undefined || Number.isNaN(r.svcM) ? '' : r.svcM) },
    { t: 'خدمة (يوم)', v: (r) => (r.svcD === undefined || Number.isNaN(r.svcD) ? '' : r.svcD) },
    { t: 'تكلفة السنوات', v: (r) => money(r.costY) },
    { t: 'تكلفة الشهور', v: (r) => money(r.costM) },
    { t: 'تكلفة الأيام', v: (r) => money(r.costD) },
    { t: 'إجمالي المكافأة', v: (r) => money(r.eos) },
    { t: 'مكافأة نهاية الخدمة', v: (r) => (X.findReason(r.reason) ? <b style={{ color: 'var(--pu)' }}>{money(r.eosAmt)}</b> : money(0)) },
    { g: 'الإجمالي', t: 'إجمالي المستحق', v: (r) => <b style={{ color: 'var(--bl)' }}>{money(r.totalDue)}</b> },
    { g: 'الاستقطاعات', t: 'سلف / غياب', v: (r, L, api) => <Inp row={r} field="loanDeduct" value={r.loanDeduct || ''} w={64} locked={L} api={api} /> },
    { t: 'تأمينات موظف', v: (r, L, api) => <><span style={{ color: r.noInsDeduct ? 'var(--dm)' : 'var(--am)', textDecoration: r.noInsDeduct ? 'line-through' : 'none' }}>{money(r.insEmp)}</span>{!L && <label title="لا يُخصم من الموظف" style={{ fontSize: 9, color: 'var(--mu)', marginInlineStart: 4 }}><input type="checkbox" checked={!!r.noInsDeduct} onChange={(e) => api.update(r.id, 'noInsDeduct', e.target.checked)} />بدون خصم</label>}</> },
    ...(eg ? [{ t: 'ضريبة كسب العمل', v: (r) => <span style={{ color: 'var(--am)' }}>{money(r.tax)}</span> }, { t: 'صندوق الشهداء', v: (r) => <span style={{ color: 'var(--am)' }}>{money(r.mf)}</span> }] : []),
    { t: 'أخرى', v: (r, L, api) => <Inp row={r} field="otherDeduct" value={r.otherDeduct || ''} w={64} locked={L} api={api} /> },
    { t: 'الأجر الخاضع للتأمينات', v: (r) => money(r.insBase) },
    { t: 'تأمينات شركة', v: (r) => money(r.insEr) },
    { t: 'حالة التأمينات', v: (r, L, api) => <><Sel row={r} field="insStatus" value={r.insStatus} opts={eg ? ST_EG : ST_SA} locked={L} w={90} api={api} />{!L && man(r, 'insStatus') && <> <Back title="رجوع لحالة التأمينات المكتوبة في بيانات الموظف" onClick={() => api.update(r.id, 'insStatus', 'auto')} /></>}</> },
    { t: 'إجمالي المستقطع', v: (r) => <b style={{ color: 'var(--rd)' }}>{money(r.totalDeduct)}</b> },
    { g: 'الصافي', t: 'المستحق بالعملة', v: (r) => <><b style={{ color: 'var(--gr)' }}>{money(r.net)}</b>{r.currency && r.currency !== 'ريال سعودي' && <span style={{ fontSize: 9, color: 'var(--am)' }}> {r.currency}</span>}</> },
    { t: eg ? 'الصافي (جنيه مصري)' : 'الصافي (ريال سعودي)', v: (r) => <b style={{ color: 'var(--gr)', fontSize: 12 }}>{money(r.netSAR)}</b> },
    { t: 'طريقة الدفع', v: (r, L, api) => <Sel row={r} field="payMethod" value={r.payMethod} opts={PAY_OPTS} locked={L} w={100} api={api} /> },
    { t: 'ملاحظات', v: (r, L, api) => (L ? r.notes : <input key={r.id + 'n' + r.notes} type="text" defaultValue={r.notes} style={{ ...INP, width: 90, fontSize: 10 }} onBlur={(e) => { if (e.target.value !== (r.notes || '')) api.update(r.id, 'notes', e.target.value); }} />) },
  ];
  return cols;
}
export const SUMCOL = { 'ضريبة كسب العمل': 'tax', 'صندوق الشهداء': 'mf', 'الصافي (جنيه مصري)': 'netSAR', 'الأساسي': 'sal', 'الراتب حسب الأيام': 'salByDays', 'إضافي': 'overtime', 'سكن': 'houPay', 'مواصلات': 'traPay', 'مشروع (شهري)': 'prjPay', 'أخرى (شهري)': 'othPay', 'بدل أجازة': 'leaveComp', 'مكافأة نهاية الخدمة': 'eosAmt', 'إجمالي المستحق': 'totalDue', 'سلف / غياب': 'loanDeduct', 'تأمينات موظف': 'insEmp', 'أخرى': 'otherDeduct', 'الأجر الخاضع للتأمينات': 'insBase', 'تأمينات شركة': 'insEr', 'إجمالي المستقطع': 'totalDeduct', 'المستحق بالعملة': 'net', 'الصافي (ريال سعودي)': 'netSAR' };
