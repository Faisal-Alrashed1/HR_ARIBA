// صفوف مسير الرواتب — منقولة حرفياً من طبقة V119 في النظام القديم (نفس معادلات الإكسيل عبر PAYX.compute)
import { PAYX as X } from './payx.js';
import { gosiRuleFor, insStatusText } from './insurance.js';
import { insExempt, noEos } from './empkind.js';
import { leaveStartYear, leaveDefaultUsed, leaveYearOverride, leaveYearDates, leaveAnnual } from './leave.js';

export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const p2 = (n) => (n < 10 ? '0' : '') + n;
export const iso = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());

/** سياق الشهر: daysSel (28..31) يغلب أيام الشهر الحقيقية */
export function ctx(y, m, daysSel) {
  let days = new Date(y, m, 0).getDate(); if (daysSel >= 28 && daysSel <= 31) days = daysSel;
  return { y, m, days, start: new Date(y, m - 1, 1), end: new Date(y, m - 1, days) };
}
export function rates(end) {
  try {
    const g = gosiRuleFor(new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12)), r = g.rule, s = g.settings, p = (v) => (Number(v) || 0) / 100;
    return { matchEmp: p(r.matchEmp), matchEmp55: p(r.matchEmp55), matchEr: p(r.matchEr), matchEr55: p(r.matchEr55), noMatchEmp: p(r.noMatchEmp), noMatchEmp55: p(r.noMatchEmp55), noMatchEr: p(r.noMatchEr), noMatchEr55: p(r.noMatchEr55), nonSaudiEr: p(r.nonSaudiEr), cap: s.wageCap, ageThr: s.ageThreshold };
  } catch { return null; }
}
const isTraineeRow = (r) => X.isTrainee(r.employer);

export function usedThrough(e, end) {
  try {
    if (!e || !end) return 0;
    const sy = leaveStartYear(e), ey = end.getFullYear(); let tot = 0;
    for (let y = sy; y <= ey; y++) {
      const o = leaveYearOverride(e, y);
      if (o && o.used !== undefined && y < ey) tot += Math.max(0, Number(o.used) || 0);
      else tot += num(leaveDefaultUsed(e, y, (y === ey) ? end : leaveYearDates(y).end));
    }
    return Math.round(tot * 100) / 100;
  } catch { return 0; }
}
/** أيام التأمينات/العمل الافتراضية: أيام الشهر كاملة إلا لو الموظف باشر أو انتهت خدمته داخل الشهر */
export function defaultInsDays(r, e, m) {
  const days = m.days; let st = 1, en = days;
  const jn = r.join ? new Date(r.join + 'T00:00:00') : null, ld = r.lastDay && X.findReason(r.reason) ? new Date(r.lastDay + 'T00:00:00') : null;
  if (jn && jn > m.end) return 0; if (jn && jn >= m.start) st = jn.getDate();
  if (ld) { if (ld < m.start) return 0; if (ld <= m.end) en = ld.getDate(); }
  return Math.max(0, Math.min(days, en - st + 1));
}
export function reasonFromEmp(e) { const R = X.findReason(e && (e.terminationReason || e.termReason)); return R ? R.k : ''; }
export function insDefault(e) {
  if (!e) return 'لا يطابق';
  if (insExempt(e)) return 'غير خاضع';
  const cons = ((e.excelCategory || '') === 'consultant') || /استشاري/.test(String(e.jobTitle || '')) || /مهمة محددة/.test(String(e.empType || ''));
  if (cons) return 'لا يطبق';
  try { return insStatusText(e); } catch { /* fallthrough */ }
  if (!e.isSaudi) return 'غير سعودي'; if ((e.wpsType || 'wps') !== 'wps') return 'لا يطبق'; return e.insSystem === 'new' ? 'يطابق' : 'لا يطابق';
}
/** القيمة الافتراضية لكل حقل من بيانات الموظف (للرجوع التلقائي ↺) */
export function empDefault(field, e) {
  e = e || {};
  if (field === 'insStatus') return insDefault(e);
  if (field === 'otAmount') return num(e.extraAllowance);
  if (field === 'prj') return num(e.projectAllowance);
  if (field === 'oth') return num(e.otherAllowance);
  if (field === 'exchRate') return num(e.exchRate) || 1;
  if (field === 'leaveDays') return leaveAnnual(e);
  return undefined;
}

/** إعادة حساب صف (نفس معادلات الإكسيل) — يعدّل الصف نفسه ويرجعه */
export function recalc(r, e, m) {
  e = e || {};
  const days = m.days; r.days = days;
  const manualW = !!(r.manualEdits && r.manualEdits.workDays);
  if (!manualW || r.workDays === undefined || r.workDays === null || r.workDays === '') r.workDays = defaultInsDays(r, e, m);
  const U = Math.max(0, Math.min(days, num(r.workDays))); r.workDays = U;
  const sal = num(r.sal), hou = num(r.hou), tra = num(r.tra), reasonSet = !!X.findReason(r.reason);
  const manualIns = !!(r.manualEdits && r.manualEdits.insDays);
  if (!manualIns || r.insDays === undefined || r.insDays === null || r.insDays === '') r.insDays = defaultInsDays(r, e, m);
  r.insDays = Math.max(0, Math.min(days, num(r.insDays)));
  const lastD = r.lastDay ? new Date(r.lastDay + 'T00:00:00') : null;
  const endForUsed = lastD || (() => { const jn = r.join ? new Date(r.join + 'T00:00:00') : null; return (jn && r.contractMonths != null) ? X.edate(jn, num(r.contractMonths)) : m.end; })();
  const usedAuto = reasonSet ? usedThrough(e, endForUsed) : 0; r.usedAuto = usedAuto;
  const emp0 = (x) => x === null || x === undefined || x === '';
  const o = X.compute({
    basic: sal, houRate: sal > 0 ? hou / sal : 0, traRate: sal > 0 ? tra / sal : 0, prj: r.prj, oth: r.oth, allIn: emp0(r.allInManual) ? null : r.allInManual,
    days, work: U, insDays: r.insDays, otHours: r.otHours, otAmount: r.otAmount, advances: r.loanDeduct, otherDed: r.otherDeduct, fx: r.exchRate, insStatus: r.insStatus,
    saudi: !!(r.isSaudi || X.isSaudiNat(r.nat)), trainee: isTraineeRow(r), nat: r.nat, employer: r.employer, dob: r.dob || e.dob, join: r.join, lastDay: r.lastDay || null,
    contractMonths: r.contractMonths, reason: r.reason, leaveDays: r.leaveDays || 21, used: emp0(r.usedManual) ? null : r.usedManual, usedAuto,
    noIns: (() => { const ex = insExempt(e); const man = !!(r.manualEdits && r.manualEdits.insStatus); return ex && !(man && !/لا يطبق|غير خاضع/.test(String(r.insStatus || ''))); })(),
    leaveManual: r.leaveManual, noInsDeduct: r.noInsDeduct, noEos: !!noEos(e), asOf: m.end, rates: rates(m.end),
  });
  r.salByDays = o.V; r.houPay = o.Y; r.traPay = o.Z; r.prjPay = o.AA; r.othPay = o.AB; r.allIn = o.T; r.overtime = o.X;
  r.contractEnd = o.I; r.K = o.K; r.N = o.N; r.O = o.O; r.P = o.P; r.leaveComp = o.AC; r.svcY = o.AD; r.svcM = o.AE; r.svcD = o.AF;
  r.costY = o.AG; r.costM = o.AH; r.costD = o.AI; r.eos = o.AJ; r.eosAmt = o.AK; r.eosLawAmt = 0;
  const extra = num(r.otherAllow);
  r.totalDue = o.AM + extra; r.insEmp = o.AO; r.insEr = o.AR; r.tax = o.TAX || 0; r.mf = o.MF || 0; r.arbComp = o.ARB || 0; r.insBase = o.AQ; r.totalDeduct = o.AU; r.net = o.AV + extra;
  r.netSAR = (o.AV + extra) * (r.exchRate === '' || r.exchRate == null ? 1 : num(r.exchRate));
  const R = X.findReason(r.reason); r.eosLaw = R ? R.ar : '';
  return r;
}

export function baseRow(e, days) {
  const sal = num(e.salary || e.sal), hou = num(e.housingAllowance || e.hou), tra = num(e.transportAllowance || e.tra), prj = num(e.projectAllowance), oth = num(e.otherAllowance);
  return {
    idx: 0, id: e.id, empNo: e.empNo || e.id || '', name: e.nameAr || '', nat: e.nationality || '', employer: e.employer || '', job: e.jobTitle || '', isSaudi: !!e.isSaudi, wpsType: e.wpsType || 'wps', insSystem: e.insSystem || 'new',
    currency: e.currency || 'ريال سعودي', exchRate: num(e.exchRate) || 1, sal, hou, tra, prj, oth, tot: Math.round((sal + hou + tra + prj + oth) * 100) / 100, days, workDays: days,
    salByDays: 0, overtime: 0, leaveComp: 0, otherAllow: 0, totalDue: 0, loanDeduct: 0, insEmp: 0, insBase: 0, otherDeduct: 0, totalDeduct: 0, net: 0, netSAR: 0, insEr: 0, insStatus: '', eos: 0,
    yearsOfService: e.yearsOfService || 0, eosLaw: '', eosLawAmt: 0, payMethod: e.payMethod || 'مدد', iban: e.iban || '', notes: '', edited: false,
  };
}
/** الحقول اليدوية التي تُحفظ على السحابة وتُدمج عند إعادة البناء */
export const MANUAL = ['insDays', 'workDays', 'days', 'otHours', 'otAmount', 'leaveManual', 'otherAllow', 'loanDeduct', 'otherDeduct', 'payMethod', 'notes', 'reason', 'lastDay', 'usedManual', 'allInManual', 'noInsDeduct', 'insStatus', 'prj', 'oth', 'exchRate', 'leaveDays', 'manualEdits', 'edited'];
const FOLLOW_EMP = { prj: 1, oth: 1, exchRate: 1, insStatus: 1, leaveDays: 1, otAmount: 1, workDays: 1 };
export function enrich(r, e, prev) {
  r.join = String(e.contractJoin || e.join_date || '').slice(0, 10); r.dob = String(e.dob || '').slice(0, 10);
  r.contractMonths = (e.contractDuration !== undefined && e.contractDuration !== null && e.contractDuration !== '') ? num(e.contractDuration) : null;
  r.leaveDays = leaveAnnual(e);
  r.nat = r.nat || e.nationality || ''; r.isSaudi = !!e.isSaudi;
  const isT = !!(e.isTerminated || e.term);
  r.reason = isT ? reasonFromEmp(e) : ''; r.lastDay = isT ? String(e.terminationDate || e.lastWorkingDay || e.lastDay || '').slice(0, 10) : '';
  r.usedManual = null; r.otHours = 0; r.otAmount = num(e.extraAllowance); r.leaveManual = 0; r.allInManual = null; r.noInsDeduct = false; r.insStatus = insDefault(e);
  if (prev) {
    MANUAL.forEach((k) => { if (prev[k] === undefined) return; if (FOLLOW_EMP[k] && !(prev.manualEdits && prev.manualEdits[k])) return; r[k] = prev[k]; });
    if (prev.overtime > 0 && prev.otHours === undefined && prev.otAmount === undefined && !(r.otAmount > 0)) r.otAmount = prev.overtime;
    if (prev.leaveComp > 0 && !X.findReason(prev.reason) && prev.leaveManual === undefined && prev.reason === undefined) r.leaveManual = prev.leaveComp;
  }
  return r;
}
const termDate = (e) => String(e.terminationDate || e.lastWorkingDay || e.lastDay || '').slice(0, 10);
const terminatedInMonth = (e, m) => { const d = termDate(e); return !!d && d >= iso(m.start) && d <= iso(m.end); };

/** بناء صفوف المسير: الموظفون الحاليون + المنتهون داخل الشهر + دمج التعديلات اليدوية المحفوظة (prevMap: id → صف سابق) */
export function buildRows(employees, m, prevMap = {}) {
  const live = employees.filter((e) => !e.isTerminated && !e.term && !e.isHourly && e.empType !== 'consultant_external' && e.excludeFromPayroll !== true);
  const rows = live.map((e) => baseRow(e, m.days)); const have = {}; rows.forEach((r) => { have[String(r.id)] = 1; });
  employees.filter((e) => e.isTerminated || e.term).forEach((e) => {
    const id = String(e.id); if (have[id]) return;
    if (terminatedInMonth(e, m) || (prevMap[id] && prevMap[id].addedTerminated)) { const b = baseRow(e, m.days); b.addedTerminated = true; rows.push(b); have[id] = 1; }
  });
  const byId = new Map(employees.map((e) => [String(e.id), e]));
  rows.forEach((r) => { const e = byId.get(String(r.id)) || {}; enrich(r, e, prevMap[String(r.id)]); r.days = m.days; if (r.workDays === undefined || r.workDays === null) r.workDays = m.days; recalc(r, e, m); });
  rows.sort((a, b) => { const x = Number(String(a.empNo || a.id || '').replace(/\D/g, '')), y = Number(String(b.empNo || b.id || '').replace(/\D/g, '')); return (Number.isFinite(x) ? x : 999999) - (Number.isFinite(y) ? y : 999999); });
  rows.forEach((r, i) => { r.idx = i + 1; });
  return rows;
}
export function autoWork(r, m) { if (r.lastDay && X.findReason(r.reason) && !(r.manualEdits && r.manualEdits.workDays)) { const d = new Date(r.lastDay + 'T00:00:00'); if (d >= m.start && d <= m.end) r.workDays = d.getDate(); else if (d < m.start) r.workDays = 0; } }

const NUMF = { insDays: 1, days: 1, workDays: 1, otHours: 1, otAmount: 1, prj: 1, oth: 1, loanDeduct: 1, otherDeduct: 1, exchRate: 1, leaveDays: 1, otherAllow: 1, leaveManual: 1 };
/** تعديل حقل في صف (نفس منطق updatePayRow) — يرجع الصف المعدّل */
export function updateField(row, field, val, e, m) {
  if (val === 'auto' && (field === 'insDays' || field === 'workDays')) { if (row.manualEdits) delete row.manualEdits[field]; row[field] = defaultInsDays(row, e || {}, m); row.edited = true; return recalc(row, e, m); }
  if (val === 'auto' && empDefault(field, e) !== undefined) { row[field] = empDefault(field, e); if (row.manualEdits) delete row.manualEdits[field]; row.edited = true; return recalc(row, e, m); }
  if (NUMF[field]) { const n = parseFloat(val); row[field] = Number.isNaN(n) ? 0 : n; }
  else if (field === 'usedManual' || field === 'allInManual') row[field] = (val === '' || val === 'auto' || val === null) ? null : num(val);
  else if (field === 'noInsDeduct') row[field] = (val === true || val === 'true' || val === '1' || val === 1);
  else if (field === 'reason') { row.reason = val || ''; if (row.reason && !row.lastDay) row.lastDay = iso(m.end); if (!row.reason && row.manualEdits) delete row.manualEdits.workDays; }
  else row[field] = val;
  row.edited = true; row.manualEdits = row.manualEdits || {}; row.manualEdits[field] = true;
  if (field === 'lastDay' || field === 'reason') autoWork(row, m);
  return recalc(row, e, m);
}
export const SUMK = ['tax', 'mf', 'sal', 'salByDays', 'overtime', 'houPay', 'traPay', 'prjPay', 'othPay', 'leaveComp', 'eosAmt', 'totalDue', 'loanDeduct', 'insEmp', 'otherDeduct', 'insBase', 'insEr', 'totalDeduct', 'net', 'netSAR'];
export function sums(rows) { const s = {}; SUMK.forEach((k) => { s[k] = 0; }); rows.forEach((r) => SUMK.forEach((k) => { s[k] += num(r[k]); })); return s; }
/** المفاتيح التي تُرسل للسحابة كمسودة (PKEYS في النظام القديم) */
export const PKEYS = ['workDays', 'insDays', 'otHours', 'otAmount', 'leaveManual', 'otherAllow', 'loanDeduct', 'otherDeduct', 'payMethod', 'notes', 'reason', 'lastDay', 'usedManual', 'allInManual', 'noInsDeduct', 'insStatus', 'prj', 'oth', 'exchRate', 'leaveDays', 'manualEdits'];
export function rowSig(r) { const o = {}; PKEYS.forEach((k) => { const v = r[k]; if (v !== undefined && v !== null && v !== '') o[k] = v; }); return JSON.stringify(o); }
