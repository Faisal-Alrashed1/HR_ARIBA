// PAYX (rows 1–30) and the payroll rows layer (rows 32–44).
import { PAYX as TX } from '../reference/engines/payx.js';
import * as TRows from '../reference/engines/payrollRows.js';
import { setRuntime } from '../reference/engines/runtime.js';
import { noEos as tNoEos } from '../reference/engines/empkind.js';
import { Tally } from '../lib/cmp.mjs';
import { rng, employee, iso, p2 } from '../lib/gen.mjs';

const REASON_KEYS = ['agree', 'expiry', 'art80', 'arb77', 'retire', 'art81', 'abandon', 'resign', 'art87'];
const PAYX_FIELDS = ['V', 'Y', 'Z', 'AA', 'AB', 'T', 'X', 'I', 'AD', 'AE', 'AF', 'K', 'N', 'O', 'P', 'AC', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AM', 'INS', 'AQ', 'AO', 'AR', 'AU', 'AV', 'AW', 'TAX', 'MF'];
export const PAYX_ROW = { V: 1, Y: 2, Z: 3, AA: 4, AB: 5, T: 6, X: 7, I: 8, AD: 10, AE: 10, AF: 10, K: 11, N: 12, O: 13, P: 14, AC: 15, AG: 16, AH: 17, AI: 18, AJ: 19, AK: 22, AM: 23, INS: 24, AQ: 25, AO: 26, AR: 27, AU: 29, AV: 30, AW: 30, TAX: 31, MF: 31 };

function payxCase(r) {
  const days = r.int(28, 31), y = r.int(2025, 2027), m = r.int(1, 12), asOf = iso(y, m, new Date(y, m, 0).getDate());
  const join = r.date(2000, 2026), reason = r.chance(0.5) ? '' : r.pick(REASON_KEYS);
  const x = {
    basic: r.money(3000, 60000), houRate: r.chance(0.6) ? 0.25 : r.pick([0, 0.2, 0.3, 0.4]), traRate: r.chance(0.7) ? 0.1 : r.pick([0, 0.05, 0.15]),
    prj: r.chance(0.2) ? r.money(500, 8000) : 0, oth: r.chance(0.2) ? r.money(100, 3000) : 0, allIn: r.chance(0.05) ? r.money(5000, 70000) : null,
    days, work: r.chance(0.8) ? days : r.int(0, days), insDays: r.chance(0.85) ? undefined : r.int(0, days), otHours: r.chance(0.15) ? r.int(1, 40) : 0,
    otAmount: r.chance(0.1) ? r.money(100, 3000) : 0, advances: r.chance(0.1) ? r.money(100, 5000) : 0, otherDed: r.chance(0.1) ? r.money(50, 2000) : 0,
    fx: r.chance(0.08) ? 3.755 : 1, insStatus: r.pick(['يطابق', 'لا يطابق', 'لا يطبق', 'غير خاضع', 'يطابق', 'لا يطابق']),
    saudi: r.chance(0.7), trainee: r.chance(0.04), nat: '', employer: '', dob: r.date(1960, 2003), join,
    lastDay: reason && r.chance(0.7) ? r.date(+join.slice(0, 4), 2027) : null, contractMonths: r.chance(0.3) ? r.pick([12, 24, 36]) : null,
    reason, leaveDays: r.pick([21, 21, 21, 25, 30]), used: r.chance(0.1) ? r.int(0, 120) : null, usedAuto: r.int(0, 200),
    noIns: r.chance(0.05), leaveManual: r.chance(0.1) ? r.money(100, 5000) : 0, noInsDeduct: r.chance(0.05), noEos: r.chance(0.06), asOf,
  };
  if (x.lastDay && x.lastDay < join) x.lastDay = null;
  x.rates = TRows.rates(new Date(y, m - 1, new Date(y, m, 0).getDate()));
  return x;
}

/** Why the two engines differ on one case — each cause is a documented row of the comparison file. */
function payxCause(x, a, b, bad) {
  const set = new Set(bad), causes = [];
  const R = TX.findReason(x.reason), K = a.K;
  if (x.reason === 'art87') causes.push('D م.87');
  if (R && R.k === 'resign' && Math.abs(K - 10) < 1e-9) causes.push('A استقالة 10 سنوات بالضبط');
  if (x.noEos && ['AG', 'AH', 'AI', 'AJ', 'AK'].some((f) => set.has(f))) causes.push('noEos');
  if (x.leaveDays !== 21 && K > 5 && set.has('N')) causes.push('J رصيد ما بعد 5 سنوات');
  if (x.houRate !== 0.25 && ['AQ', 'AO', 'AR'].some((f) => set.has(f))) causes.push('G تأمينات على السكن الفعلي');
  return causes.join(' + ') || null;
}

/** Our engine has no Egypt items; in Saudi mode they are zero on their side too. */
const saudiOnly = (o) => ({ TAX: 0, MF: 0, ...o });
const payxRow = (f, x) => (f === 'AK' ? [20, 21, 22] : f === 'TAX' || f === 'MF' ? null : PAYX_ROW[f]);

export function payx(ours, N = 20000) {
  setRuntime({ country: 'SA', insRules: null, leaves: [], adjustments: [], holidays: [] });
  const t = new Tally('payx', 'محرك المسيّر PAYX (A..AW)', [...new Set(Object.values(PAYX_ROW))]);
  const O = ours('calc/payx');
  if (!O) { t.missing('ملف lib/calc/payx.ts غير موجود', N); return t; }
  const r = rng(20261018);
  for (let i = 0; i < N; i++) {
    const x = payxCase(r);
    const a = TX.compute(structuredClone(x)), b = saudiOnly(O.PAYX.compute(structuredClone(x)));
    t.add(a, b, PAYX_FIELDS, x, payxCause, payxRow);
  }
  // edge cases from the comparison file
  const edge = [
    { reason: 'resign', join: '2016-01-01', lastDay: '2020-12-31' }, { reason: 'resign', join: '2011-01-01', lastDay: '2020-12-31' },
    { reason: 'art87', join: '2015-01-01', lastDay: '2025-06-30' }, { reason: 'expiry', join: '2017-01-01', lastDay: '2024-12-31', leaveDays: 30 },
    { reason: '', houRate: 0.4 }, { reason: 'expiry', join: '2019-01-01', lastDay: '2025-12-31', noEos: true },
  ];
  edge.forEach((e) => {
    const x = Object.assign(payxCase(r), { lastDay: null, contractMonths: null, used: null }, e);
    t.add(TX.compute(structuredClone(x)), saudiOnly(O.PAYX.compute(structuredClone(x))), PAYX_FIELDS, x, payxCause, payxRow);
  });
  return t;
}

/** The legacy data → /salary/basis row the payroll page reads (backend/app/routers/canonical.py salary_basis). */
export function toBasis(e) {
  const g = (k, d) => (e[k] === undefined ? d : e[k]);
  return {
    id: e.id, emp_no: e.empNo, name_ar: e.nameAr, workplace: e.employer, department: e.department, job_title: e.jobTitle, nationality: e.nationality,
    is_saudi: !!e.isSaudi, birth_date: e.dob, category: g('empType', 'active'), excel_category: e.excelCategory, wps_type: g('wpsType', 'wps'),
    gosi_system: e.insSystem, join_date: e.contractJoin, contract_duration_months: g('contractDuration', null), contract_end_date: e.contractEnd || null,
    annual_leave_days: g('leaveDaysContract', 21), basic_salary: Number(e.salary || 0), housing_allowance: Number(e.housingAllowance || 0),
    transport_allowance: g('transportAllowance', 0), project_allowance: g('projectAllowance', 0), other_allowances: g('otherAllowance', 0),
    extra_allowance: g('extraAllowance', 0), other_deductions: g('otherDeductions', 0), currency: g('currency', 'SAR'), exchange_rate: g('exchRate', 1),
    payment_method: e.payMethod, bank_name: e.bank, iban: e.iban, exclude_from_payroll: !!e.excludeFromPayroll, exclude_from_eos: !!e.excludeFromEos,
    is_terminated: !!e.isTerminated, termination_date: e.terminationDate || e.lastDay || null, termination_article: e.terminationArticle || null,
    termination_reason: e.terminationReason || null,
  };
}
const ROW_FIELDS = ['workDays', 'insDays', 'insStatus', 'leaveDays', 'otAmount', 'reason', 'lastDay', 'costY', 'costM', 'costD', 'eos', 'eosAmt', 'N', 'P', 'leaveComp', 'totalDue', 'insEmp', 'insEr', 'insBase', 'totalDeduct', 'net', 'netSAR'];
export const ROWS_ROW = { members: 32, workDays: 33, insDays: 33, insStatus: 34, leaveDays: 36, eosAmt: 37, costY: 37, costM: 37, costD: 37, eos: 37, otAmount: 41, sums: 42 };

export function rows(ours, months = 240) {
  const t = new Tally('rows', 'صفوف المسيّر (من يدخل، الافتراضيات، noEos، الإضافي القديم، المجاميع)', [32, 33, 34, 35, 36, 37, 38, 39, 41, 42]);
  const P = ours('calc/payroll');
  if (!P) { t.missing('ملف lib/calc/payroll.ts غير موجود', months); return t; }
  setRuntime({ country: 'SA', insRules: null, leaves: [], adjustments: [], holidays: [] });
  const r = rng(77);
  for (let k = 0; k < months; k++) {
    const y = r.int(2025, 2026), mo = r.int(1, 12), m = TRows.ctx(y, mo, 0);
    const emps = Array.from({ length: 25 }, (_, i) => employee(r, 100 + i));
    const prevMap = {};
    emps.forEach((e) => { if (r.chance(0.1)) prevMap[e.id] = { overtime: r.money(100, 2000) }; });
    const theirs = TRows.buildRows(structuredClone(emps), m, structuredClone(prevMap));
    const basis = emps.map(toBasis), bMap = new Map(basis.map((b) => [String(b.id), b]));
    const saved = Object.entries(prevMap).map(([id, v]) => ({ id, ...v }));
    const mine = P.buildRows(basis, { ...m }, saved);
    P.USED_CACHE.clear();
    mine.forEach((row) => { const e = emps.find((x) => String(x.id) === String(row.id)); if (e) P.USED_CACHE.set(P.usedKey(row, m), TRows.usedThrough(e, new Date(P.usedEnd(row, m) + 'T00:00:00'))); });
    const rates = TRows.rates(m.end);
    mine.forEach((row) => P.recalc(row, bMap.get(String(row.id)), m, rates));
    const tIds = new Set(theirs.map((x) => String(x.id))), oIds = new Set(mine.map((x) => String(x.id)));
    emps.forEach((e) => {
      const id = String(e.id), inT = tIds.has(id), inO = oIds.has(id);
      if (inT !== inO) { t.add({ member: inT }, { member: inO }, ['member'], { e: { nameAr: e.nameAr, empType: e.empType } }, () => (/البوصيري/.test(e.nameAr) ? 'اسم البوصيري مكتوب في الكود' : e.empType === 'consultant_external' ? 'consultant_external' : null), () => 32); return; }
      t.rowCases[32] = (t.rowCases[32] || 0) + 1;
      if (!inT) return;
      const a = theirs.find((x) => String(x.id) === id), b = mine.find((x) => String(x.id) === id);
      t.add(a, b, ROW_FIELDS, { id, insSystem: e.insSystem, employer: e.employer, jobTitle: e.jobTitle, wpsType: e.wpsType, empType: e.empType, prev: prevMap[id] }, (inp, A, B, bad) => {
        const c = [];
        if (e.insSystem === 'exempt' && bad.includes('insStatus')) c.push('insSystem exempt لا يُعفى في صفحة المسيّر عندنا (خطأ عندنا)');
        if (bad.includes('insStatus') && e.insSystem === 'new') c.push('insSystem new يقرأ gosi_system==="matching" عندنا (خطأ عندنا)');
        if (bad.some((f) => ['costY', 'costM', 'costD', 'eos', 'eosAmt'].includes(f)) && tNoEos(e)) c.push('noEos');
        if (bad.includes('otAmount') && prevMap[id]) c.push('ترحيل الإضافي القديم');
        if (bad.some((f) => ['insEmp', 'insEr', 'insBase', 'totalDeduct', 'net', 'netSAR'].includes(f)) && Number(e.housingAllowance) !== Number(e.salary) * 0.25) c.push('G');
        return c.join(' + ') || null;
      }, (f) => ({ workDays: 33, insDays: 33, insStatus: 34, leaveDays: 36, otAmount: 41, costY: 37, costM: 37, costD: 37, eos: 37, eosAmt: 37 })[f] ?? null);
    });
    // sums (row 42): same keys present on both sides
    const sk = TRows.SUMK.filter((k) => k !== 'tax' && k !== 'mf');
    const s1 = TRows.sums(theirs.filter((x) => oIds.has(String(x.id)))), s2 = { tax: 0, mf: 0, ...P.sums(mine.filter((x) => tIds.has(String(x.id)))) };
    t.add(s1, s2, [...sk, 'tax', 'mf'], { month: y + '-' + p2(mo) }, (i, A, B, bad) => (bad.every((f) => f === 'tax' || f === 'mf') ? 'بنود مصر' : 'يتبع فروق الصفوف'), () => 42);
  }
  return t;
}
