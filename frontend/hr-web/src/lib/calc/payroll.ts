/* eslint-disable @typescript-eslint/no-explicit-any */
// Payroll table: their rows layer (payroll-rows.ts = ARIBA_HR_React/src/engines/payrollRows.js, verbatim) over PAYX,
// fed from the backend salary-basis rows converted back to the stored employee record (`toLegacy`). Rows 32–44 of the
// comparison file (docs/15_LOGIC_AUDIT.md section 9). The GOSI rates come from the runtime (`rt.insRules`, set from the
// server settings by lib/calc/setup.ts), as in their system.
import type { SalaryBasisRow } from "../salary";
import * as R from "./payroll-rows";
import { calcFor } from "./inscalc";
import { kindOf } from "./empkind";
import { PAYX } from "./payx";

export interface MonthCtx {
  y: number;
  m: number; // 1..12
  days: number;
  start: Date;
  end: Date;
}

export interface PayRow {
  id: string;
  idx: number;
  empNo: string;
  name: string;
  nat: string;
  employer: string;
  job: string;
  isSaudi: boolean;
  wpsType: string;
  insSystem: string;
  currency: string;
  exchRate: number;
  sal: number;
  hou: number;
  tra: number;
  prj: number;
  oth: number;
  tot: number;
  days: number;
  workDays: number;
  insDays: number;
  salByDays: number;
  houPay: number;
  traPay: number;
  prjPay: number;
  othPay: number;
  allIn: number;
  overtime: number;
  leaveComp: number;
  otherAllow: number;
  totalDue: number;
  loanDeduct: number;
  insEmp: number;
  insBase: number;
  otherDeduct: number;
  totalDeduct: number;
  net: number;
  netSAR: number;
  insEr: number;
  insStatus: string;
  eos: number;
  yearsOfService: number;
  eosLaw: string;
  eosLawAmt: number;
  payMethod: string;
  iban: string;
  notes: string;
  edited: boolean;
  addedTerminated?: boolean;
  manualEdits: Record<string, boolean>;
  join: string;
  dob: string;
  contractMonths: number | null;
  leaveDays: number;
  reason: string;
  lastDay: string;
  usedManual: number | null;
  otHours: number;
  otAmount: number;
  leaveManual: number;
  allInManual: number | null;
  noInsDeduct: boolean;
  contractEnd: string;
  K: number | null;
  N: number | null;
  O: number;
  P: number | null;
  svcY: number;
  svcM: number;
  svcD: number;
  costY: number;
  costM: number;
  costD: number;
  eosAmt: number;
  usedAuto: number;
  tax?: number;
  mf?: number;
}

export const MONTHS_AR = [
  "",
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export const CURRENCY_LABEL: Record<string, string> = {
  SAR: "ريال سعودي",
  USD: "دولار",
  EUR: "يورو",
  EGP: "جنيه مصري",
};

export const isLocalCurrency = (c: string) => c === "SAR";
export const currencyLabel = (c: string) => CURRENCY_LABEL[c] ?? (c || "");

export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const money = (n: unknown): string =>
  num(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const p2 = (n: number) => (n < 10 ? "0" : "") + n;
export const isoDate = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const dmy = (s: string) => {
  const a = String(s || "").slice(0, 10).split("-");
  return a.length === 3 && a[0] ? `${a[2]}/${a[1]}/${a[0]}` : "";
};


/** Our stored payment codes → the Arabic labels their rows carry. */
const PAYMETHOD_AR: Record<string, string> = {
  mudad: "مدد",
  bank_transfer: "تحويل",
  international_transfer: "تحويل دولي",
  cash: "نقد",
};

/** The salary-basis row back in the stored employee shape (employee_directory.data) their engines read. */
export function toLegacy(b: SalaryBasisRow | undefined): Record<string, any> | undefined {
  if (!b) return undefined;
  return {
    id: b.id, empNo: b.emp_no, nameAr: b.name_ar, employer: b.workplace ?? "", department: b.department ?? "", jobTitle: b.job_title ?? "",
    nationality: b.nationality ?? "", isSaudi: !!b.is_saudi, dob: b.birth_date ?? "", empType: b.category, excelCategory: b.excel_category ?? "",
    wpsType: b.wps_type || "wps", insSystem: b.gosi_system, contractJoin: b.join_date ?? "", contractDuration: b.contract_duration_months ?? "",
    contractEnd: b.contract_end_date ?? "", leaveDaysContract: b.annual_leave_days, salary: num(b.basic_salary), housingAllowance: num(b.housing_allowance),
    transportAllowance: num(b.transport_allowance), projectAllowance: num(b.project_allowance), otherAllowance: num(b.other_allowances),
    extraAllowance: num(b.extra_allowance), otherDeductions: num(b.other_deductions), currency: b.currency, exchRate: num(b.exchange_rate),
    payMethod: PAYMETHOD_AR[b.payment_method] ?? b.payment_method ?? "", bank: b.bank_name ?? "", iban: b.iban ?? "",
    excludeFromPayroll: !!b.exclude_from_payroll, excludeFromEOS: !!b.exclude_from_eos, isTerminated: !!b.is_terminated,
    terminationDate: b.termination_date ?? "", terminationReason: b.termination_reason ?? "", isHourly: !!b.is_hourly || b.category === "hourly",
    salaryTotal: num(b.total_salary),
  };
}

/** Their kindOf (V130/V135): consultant / tamheer / trainee / another WPS type, or "" when insured. */
export const exemptKind = (e: SalaryBasisRow | undefined): string => kindOf(toLegacy(e));
export const insDefault = (e: SalaryBasisRow | undefined): string => R.insDefault(toLegacy(e));
export const reasonFromEmp = (e: SalaryBasisRow): string => R.reasonFromEmp(toLegacy(e));
export const defaultInsDays = (r: PayRow, e: SalaryBasisRow | undefined, m: MonthCtx): number => R.defaultInsDays(r, toLegacy(e), m);
export const empDefault = (field: string, e: SalaryBasisRow | undefined): number | string | undefined => R.empDefault(field, toLegacy(e));
export const autoWork = (r: PayRow, m: MonthCtx): void => R.autoWork(r, m);
export const baseRow = (e: SalaryBasisRow, days: number): PayRow => R.baseRow(toLegacy(e), days) as PayRow;
export const enrich = (r: PayRow, e: SalaryBasisRow, prev?: PayRow): PayRow => R.enrich(r, toLegacy(e), prev) as PayRow;
export const recalc = (r: PayRow, e: SalaryBasisRow | undefined, m: MonthCtx, _rates?: unknown): PayRow => R.recalc(r, toLegacy(e), m) as PayRow;
export const sums = (rows: PayRow[]): Record<string, number> => R.sums(rows);
export const SUMK: string[] = R.SUMK;

/** GOSI of an employee without a saved payroll row (their Slip.jsx → InsCalc `calcFor` for the month). */
export function calcEmployeeGosi(e: SalaryBasisRow, y: number, mo: number): { base: number; employee: number; employer: number } {
  const days = new Date(y, mo, 0).getDate();
  const c = calcFor(toLegacy(e), { y, m: mo, days, start: new Date(y, mo - 1, 1), end: new Date(y, mo - 1, days) }, undefined);
  return { base: c.base, employee: c.emp, employer: c.co };
}

/** Their `addPayRow`: a blank, fully editable row. */
export function blankRow(days: number): PayRow {
  const r = R.baseRow({ id: "", empNo: "", nameAr: "موظف جديد" }, days) as PayRow;
  r.id = `new_${Date.now()}`;
  r.edited = true;
  r.insStatus = "لا يطبق";
  return r;
}

export const NUMF: Record<string, boolean> = {
  insDays: true,
  days: true,
  workDays: true,
  otHours: true,
  otAmount: true,
  prj: true,
  oth: true,
  loanDeduct: true,
  otherDeduct: true,
  exchRate: true,
  leaveDays: true,
  otherAllow: true,
  leaveManual: true,
};

/** "<employee id>|<yyyy-mm-dd>" → days used (their usedThrough), filled from the backend leave engine. */
export const USED_CACHE: Map<string, number> = R.USED_CACHE;

function reasonKey(r: PayRow): string {
  return (PAYX.findReason(r.reason) || {}).k || "";
}

/** Their endForUsed: last day, else EDATE(join, contract months), else the month end. */
export function usedEnd(r: PayRow, m: MonthCtx): string {
  if (r.lastDay) return String(r.lastDay).slice(0, 10);
  const jn = r.join ? new Date(r.join + "T00:00:00") : null;
  const d = jn && r.contractMonths != null && (r.contractMonths as unknown) !== "" ? PAYX.edate(jn, Number(r.contractMonths)) : m.end;
  return isoDate(d);
}

export const usedKey = (r: PayRow, m: MonthCtx) => `${r.id}|${usedEnd(r, m)}`;

/** Rows whose «ما تم استحقاقه» still needs the backend figure. */
export function usedQueries(rows: PayRow[], m: MonthCtx): { employee_id: string; end: string }[] {
  return rows
    .filter((r) => r.id && reasonKey(r) && !USED_CACHE.has(usedKey(r, m)))
    .map((r) => ({ employee_id: String(r.id), end: usedEnd(r, m) }));
}

export function terminatedInMonth(e: SalaryBasisRow, m: MonthCtx): boolean {
  const d = (e.termination_date ?? "").slice(0, 10);
  return !!d && d >= isoDate(m.start) && d <= isoDate(m.end);
}

/** Their buildRows: current employees (not hourly, not external consultants, not excluded) + those terminated in the
 *  month + the saved manual edits. */
export function buildRows(all: SalaryBasisRow[], m: MonthCtx, saved: PayRow[]): PayRow[] {
  const prevMap: Record<string, PayRow> = {};
  saved.forEach((r) => (prevMap[String(r.id)] = r));
  return R.buildRows(all.map((b) => toLegacy(b)), m, prevMap) as PayRow[];
}

const SUMCOL: Record<string, string> = {
  "الأساسي": "sal",
  "الراتب حسب الأيام": "salByDays",
  "إضافي": "overtime",
  "سكن": "houPay",
  "مواصلات": "traPay",
  "مشروع (شهري)": "prjPay",
  "أخرى (شهري)": "othPay",
  "بدل أجازة": "leaveComp",
  "مكافأة نهاية الخدمة": "eosAmt",
  "إجمالي المستحق": "totalDue",
  "سلف / غياب": "loanDeduct",
  "تأمينات موظف": "insEmp",
  "أخرى": "otherDeduct",
  "الأجر الخاضع للتأمينات": "insBase",
  "تأمينات شركة": "insEr",
  "إجمالي المستقطع": "totalDeduct",
  "المستحق بالعملة": "net",
  "الصافي (ريال سعودي)": "netSAR",
};

export const EXCEL_COLS: { g?: string; t: string }[] = [
  { g: "بيانات الموظف", t: "م" },
  { t: "الرقم" },
  { t: "الاسم" },
  { t: "الجنسية" },
  { t: "نطاق العمل" },
  { t: "الوظيفة" },
  { g: "التعاقد والإجازة", t: "بداية العقد" },
  { t: "نهاية العقد / آخر يوم" },
  { t: "مدة التعاقد (شهر)" },
  { t: "سنوات الخدمة" },
  { t: "سبب الإنهاء" },
  { t: "المستحق سنويًا (يوم)" },
  { t: "رصيد المستحق خلال فترة التعاقد" },
  { t: "ما تم استحقاقه (يوم)" },
  { t: "الرصيد المستحق (يوم)" },
  { g: "الراتب", t: "الأساسي" },
  { t: "العملة" },
  { t: "معدل الصرف" },
  { t: "الراتب شامل البدلات" },
  { t: "أيام العمل" },
  { t: "أيام التأمينات" },
  { t: "الراتب حسب الأيام" },
  { g: "البدلات", t: "ساعات الإضافي" },
  { t: "إضافي" },
  { t: "سكن" },
  { t: "مواصلات" },
  { t: "مشروع (شهري)" },
  { t: "أخرى (شهري)" },
  { t: "بدل أجازة" },
  { g: "مكافأة نهاية الخدمة", t: "خدمة (سنة)" },
  { t: "خدمة (شهر)" },
  { t: "خدمة (يوم)" },
  { t: "تكلفة السنوات" },
  { t: "تكلفة الشهور" },
  { t: "تكلفة الأيام" },
  { t: "إجمالي المكافأة" },
  { t: "مكافأة نهاية الخدمة" },
  { g: "الإجمالي", t: "إجمالي المستحق" },
  { g: "الاستقطاعات", t: "سلف / غياب" },
  { t: "تأمينات موظف" },
  { t: "أخرى" },
  { t: "الأجر الخاضع للتأمينات" },
  { t: "تأمينات شركة" },
  { t: "حالة التأمينات" },
  { t: "إجمالي المستقطع" },
  { g: "الصافي", t: "المستحق بالعملة" },
  { t: "الصافي (ريال سعودي)" },
  { t: "طريقة الدفع" },
  { t: "ملاحظات" },
];

export function rowValue(r: PayRow, title: string): string | number {
  const v: Record<string, any> = {
    "م": r.idx,
    "الرقم": r.empNo,
    "الاسم": r.name.split(" ").slice(0, 3).join(" "),
    "الجنسية": r.nat,
    "نطاق العمل": r.employer,
    "الوظيفة": r.job,
    "بداية العقد": dmy(r.join),
    "نهاية العقد / آخر يوم": dmy(r.lastDay || r.contractEnd),
    "مدة التعاقد (شهر)": r.contractMonths ?? "",
    "سنوات الخدمة": r.K == null || Number.isNaN(r.K) ? "" : Math.round(r.K * 100) / 100,
    "سبب الإنهاء": r.eosLaw,
    "المستحق سنويًا (يوم)": r.leaveDays,
    "رصيد المستحق خلال فترة التعاقد": r.N,
    "ما تم استحقاقه (يوم)": PAYX.findReason(r.reason) || r.usedManual != null ? num(r.usedManual != null ? r.usedManual : r.usedAuto) : "",
    "الرصيد المستحق (يوم)": r.P,
    "الأساسي": r.sal,
    "العملة": currencyLabel(r.currency),
    "معدل الصرف": r.exchRate,
    "الراتب شامل البدلات": r.allIn,
    "أيام العمل": r.workDays,
    "أيام التأمينات": r.insDays,
    "الراتب حسب الأيام": r.salByDays,
    "ساعات الإضافي": r.otHours || 0,
    "إضافي": r.overtime,
    "سكن": r.houPay,
    "مواصلات": r.traPay,
    "مشروع (شهري)": r.prjPay,
    "أخرى (شهري)": r.othPay,
    "بدل أجازة": r.leaveComp,
    "خدمة (سنة)": r.svcY,
    "خدمة (شهر)": r.svcM,
    "خدمة (يوم)": r.svcD,
    "تكلفة السنوات": r.costY,
    "تكلفة الشهور": r.costM,
    "تكلفة الأيام": r.costD,
    "إجمالي المكافأة": r.eos,
    "مكافأة نهاية الخدمة": r.eosAmt,
    "إجمالي المستحق": r.totalDue,
    "سلف / غياب": r.loanDeduct,
    "تأمينات موظف": r.noInsDeduct ? 0 : r.insEmp,
    "أخرى": r.otherDeduct,
    "الأجر الخاضع للتأمينات": r.insBase,
    "تأمينات شركة": r.insEr,
    "حالة التأمينات": r.insStatus,
    "إجمالي المستقطع": r.totalDeduct,
    "المستحق بالعملة": r.net,
    "الصافي (ريال سعودي)": r.netSAR,
    "طريقة الدفع": r.payMethod,
    "ملاحظات": r.notes,
  };
  const val = v[title];
  if (typeof val === "number" && Number.isFinite(val)) return Math.round(val * 100) / 100;
  return val == null || (typeof val === "number" && !Number.isFinite(val)) ? "" : val;
}

export { SUMCOL };
