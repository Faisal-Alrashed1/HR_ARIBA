import type { Lang } from "./i18n/locale";

const RIYADH = "Asia/Riyadh";

function locale(lang: Lang): string {
  // Gregorian calendar with Latin digits in both languages, as in the prototype's official documents.
  return lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
}

export function formatMoney(value: string | number | null | undefined, lang: Lang, currency = "SAR"): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat(locale(lang), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatNumber(value: string | number, lang: Lang, digits = 0): string {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(
    Number(value),
  );
}

/** Format an ISO date (YYYY-MM-DD) as DD/MM/YYYY in both languages.
 *  Built by hand: Intl's Arabic output inserts right-to-left marks that scramble the order
 *  when the date is shown inside left-to-right number spans. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatHijri(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-islamic-umalqura-nu-latn" : "en-u-ca-islamic-umalqura", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Today's date in Riyadh as YYYY-MM-DD. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: RIYADH }).format(new Date());
}
