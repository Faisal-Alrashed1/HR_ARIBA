// Settlement calculator — their `settle` (ARIBA_HR_React/src/pages/finance/EosCalc.jsx, copied in settle-react.ts),
// rows 78–94 of the comparison file: no art. 87, art. 77 the same for every contract, the inputs are not truncated,
// and Egypt (rt.country === "EG") uses its own resignation factor, art. 77 months and leave (docs/LOGIC_AUDIT.md section 9).
import { settle } from "./settle-react";

export type SettlementReason = "m84" | "m74" | "m85" | "m75" | "m77" | "m80" | "m53" | "m74r" | "m74d";

export const REASONS: { value: SettlementReason; label: string }[] = [
  { value: "m84", label: "م.84 إنهاء الشركة" },
  { value: "m74", label: "م.74 اتفاق" },
  { value: "m85", label: "م.85 استقالة" },
  { value: "m75", label: "م.75 قسرية" },
  { value: "m77", label: "م.77 تعسفي" },
  { value: "m80", label: "م.80 تأديبي" },
  { value: "m53", label: "م.53 تجربة" },
  { value: "m74r", label: "م.74(4) تقاعد" },
  { value: "m74d", label: "م.74(3) وفاة" },
];

export const LAW_NAME: Record<SettlementReason, string> = {
  m84: "م.84",
  m74: "م.74",
  m85: "م.85",
  m75: "م.75",
  m77: "م.77",
  m80: "م.80",
  m53: "م.53",
  m74r: "م.74(4)",
  m74d: "م.74(3)",
};

export interface SettlementInput {
  start: string; // yyyy-mm-dd
  end: string;
  salary: number;
  reason: SettlementReason;
  leavePerYear: number; // default 21
  leaveTaken: number;
  monthDays: number; // 0 = not entered
  attendanceDays: number;
  extras: number[];
  deductions: { value: number; type: "amount" | "days" }[];
}

export interface SettlementResult {
  years: number;
  months: number;
  days: number;
  totalYears: number;
  e84: number;
  award: number;
  lawNote: string;
  leaveDue: number;
  leaveRemaining: number;
  leaveComp: number;
  periodSalary: number;
  leaveExcess: number;
  leaveExcessDeduction: number;
  extrasTotal: number;
  deductionsTotal: number;
  total: number;
}

export function runSettlement(i: SettlementInput): SettlementResult | null {
  const R = settle({
    start: i.start, end: i.end, sal: i.salary, reason: i.reason, leaveD: i.leavePerYear, taken: i.leaveTaken, wd: i.monthDays, ad: i.attendanceDays,
    extras: i.extras.map((v) => ({ v })), deds: i.deductions.map((d) => ({ v: d.value, t: d.type })),
  });
  if (!R) return null;
  return {
    years: R.dur.fy, months: R.dur.fm, days: R.dur.fd, totalYears: R.ty, e84: R.e84, award: R.ef, lawNote: String(R.note).split("|")[0],
    leaveDue: R.ldue, leaveRemaining: R.lrem, leaveComp: R.lcomp, periodSalary: R.lmsf, leaveExcess: R.lexc, leaveExcessDeduction: R.lded,
    extrasTotal: R.extT, deductionsTotal: R.dedT, total: R.total,
  };
}

export const sNum = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

export function sDt(d: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn");
  } catch {
    return d;
  }
}
