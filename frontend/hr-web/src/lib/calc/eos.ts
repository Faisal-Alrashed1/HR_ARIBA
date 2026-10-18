// End-of-service page by article — their formula (ARIBA_HR_React/src/pages/finance/Eos.jsx `eosByLaw`, copied in
// eos-react.ts). Rows 67–77 of the comparison file: art. 85/75 at exactly 5 years = two thirds (`yrs < 5`), no art. 87,
// art. 77 always the indefinite-contract compensation (docs/LOGIC_AUDIT.md section 9).
import { eosByLaw, LAWS } from "./eos-react";

export type EosLaw = "m84" | "m74" | "m85" | "m75" | "m77" | "m80" | "m74r" | "m74d";

export const EOS_LAWS: { value: EosLaw; label: string }[] = (Object.keys(LAWS) as EosLaw[]).map((k) => ({ value: k, label: LAWS[k][0] }));

export const EOS_LAW_NAMES: Record<EosLaw, string> = {
  m84: "م.84 إنهاء الشركة",
  m74: "م.74 اتفاق",
  m85: "م.85 استقالة",
  m75: "م.75 قسرية",
  m77: "م.77 تعسفي",
  m80: "م.80 تأديبي",
  m74r: "م.74(4) تقاعد",
  m74d: "م.74(3) وفاة",
};

/** yyyy-mm-dd → local midnight (their `pd`). */
export function localDate(s: string | null | undefined): Date | null {
  const a = String(s || "").slice(0, 10).split("-");
  return a.length === 3 && a[0] ? new Date(+a[0], +a[1] - 1, +a[2]) : null;
}

/** The end date the page uses: the picked date, or today at midnight. */
export function endDateOf(s: string): Date {
  return localDate(s) || new Date(new Date().toDateString());
}

export function eosYears(join: string | null, end: Date, fallback = 0): number {
  const j = localDate(join);
  if (!j) return fallback;
  return Math.max(0, Math.round(((end.getTime() - j.getTime()) / (365.25 * 86400000)) * 100) / 100);
}

export function calcByLaw(sal: number, hou: number, yrs: number, sel: EosLaw): number {
  return eosByLaw(sal, hou, yrs, sel);
}

/** "N سنة N شهر N يوم" exactly as the page builds it. */
export function durationText(join: string, endD: Date): string {
  const d1 = localDate(join) ?? new Date(join);
  let fy = endD.getFullYear() - d1.getFullYear();
  if (endD.getMonth() < d1.getMonth() || (endD.getMonth() === d1.getMonth() && endD.getDate() < d1.getDate())) fy--;
  let tmp = new Date(d1.getFullYear() + fy, d1.getMonth(), d1.getDate());
  let fm = 0;
  while (new Date(tmp.getFullYear(), tmp.getMonth() + 1, tmp.getDate()) <= endD) {
    tmp = new Date(tmp.getFullYear(), tmp.getMonth() + 1, tmp.getDate());
    fm++;
  }
  const fd = Math.round((endD.getTime() - tmp.getTime()) / 86400000) + 1;
  return `${fy} سنة ${fm} شهر ${fd} يوم`;
}
