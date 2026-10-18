/* eslint-disable */
// @ts-nocheck
// Copied verbatim from ARIBA_HR_React/src/engines/insurance.js (GOSI auto table, calcIns).
// تأمينات GOSI السعودية + المصرية — منقول من calcIns / gosiRates / ARIBA_GOSI_AUTO
import { rt } from './runtime';
import * as C from './country';
import { kindOf, insExempt } from './empkind';

export const INS_RULES_DEFAULT = { wageCap: 45000, ageThreshold: 55, effectiveRules: [
  { date: '2026-01-01', matchEmp: 10.75, matchEmp55: 10.50, matchEr: 12.75, matchEr55: 12.50, noMatchEmp: 9.75, noMatchEmp55: 9.00, noMatchEr: 11.75, noMatchEr55: 11.00, nonSaudiEr: 2.00 },
  { date: '2027-07-01', matchEmp: 11.25, matchEmp55: 11.00, matchEr: 13.25, matchEr55: 13.00, noMatchEmp: 10.25, noMatchEmp55: 9.50, noMatchEr: 12.25, noMatchEr55: 11.50, nonSaudiEr: 2.00 } ] };

/** الجدول النظامي التلقائي: الجديد 10.25/12.25 من 1/7/2025 ويزيد 0.5% كل 1 يوليو لحد 11.75/13.75، القديم ثابت 9.75/11.75 */
export function autoRate(date, sys) {
  const d = (date instanceof Date) ? date : new Date(date), y = d.getFullYear(), mo = d.getMonth() + 1;
  if (sys !== 'new' || y < 2025 || (y === 2025 && mo < 7)) return { emp: 9.75, er: 11.75, n: -1, from: '' };
  const n = y - 2025 - (mo < 7 ? 1 : 0);
  return { emp: Math.min(11.75, 10.25 + 0.5 * n), er: Math.min(13.75, 12.25 + 0.5 * n), n, from: '1/7/' + (2025 + n) };
}
const r2 = (n) => Math.round(n * 100) / 100;
export function ruleFor(date, nonSaudiEr) {
  const d = new Date(date + 'T00:00:00'), nw = autoRate(d, 'new'), od = autoRate(d, 'old');
  const r = { date, matchEmp: nw.emp, matchEmp55: r2(nw.emp - 0.25), matchEr: nw.er, matchEr55: r2(nw.er - 0.25), noMatchEmp: od.emp, noMatchEmp55: r2(od.emp - 0.75), noMatchEr: od.er, noMatchEr55: r2(od.er - 0.75), nonSaudiEr: (nonSaudiEr == null ? 2 : nonSaudiEr) };
  if (date === '2000-01-01') { r.matchEmp55 = 9.5; r.matchEr55 = 11.5; }
  return r;
}
const KEYS = ['matchEmp', 'matchEmp55', 'matchEr', 'matchEr55', 'noMatchEmp', 'noMatchEmp55', 'noMatchEr', 'noMatchEr55', 'nonSaudiEr'];
const same = (a, b) => KEYS.every((k) => Math.abs((Number(a[k]) || 0) - (Number(b[k]) || 0)) < 1e-9);
const LEGACY = INS_RULES_DEFAULT.effectiveRules;
const autoDates = () => { const y = Math.max(new Date().getFullYear() + 1, 2028), out = ['2000-01-01', '2025-07-01']; for (let k = 2026; k <= y; k++) out.push(k + '-07-01'); return out; };

export function getInsSettings() {
  let s = rt.insRules;
  if (!s || !Array.isArray(s.effectiveRules) || !s.effectiveRules.length) s = JSON.parse(JSON.stringify(INS_RULES_DEFAULT));
  else s = JSON.parse(JSON.stringify(s));
  s.wageCap = Number(s.wageCap) || 45000; s.ageThreshold = Number(s.ageThreshold) || 55;
  const rules = s.effectiveRules.filter((r) => !LEGACY.some((l) => l.date === r.date && same(l, r)));
  const have = {}; rules.forEach((r) => { have[r.date] = 1; });
  const ns = (rules[0] && rules[0].nonSaudiEr != null) ? rules[0].nonSaudiEr : 2;
  autoDates().forEach((dt) => { if (!have[dt]) rules.push(ruleFor(dt, ns)); });
  rules.sort((a, b) => String(a.date).localeCompare(String(b.date))); s.effectiveRules = rules;
  return s;
}
export function isAutoRule(r) { return autoDates().indexOf(r.date) >= 0 && same(r, ruleFor(r.date, r.nonSaudiEr)); }
export function empAge(emp) { if (!emp.dob) return 30; const d = new Date(emp.dob), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--; return a; }
export const noInsWps = (emp) => insExempt(emp);
export function insStatusText(emp) { if (kindOf(emp)) return 'غير خاضع'; if (C.isEG()) return C.insText(emp); if (!emp.isSaudi) return 'غير سعودي'; if (noInsWps(emp)) return 'لا يطبق'; return emp.insSystem === 'new' ? 'يطابق' : 'لا يطابق'; }
export function gosiRuleFor(asOf) {
  const s = getInsSettings(); let d = asOf ? new Date(asOf) : new Date(); if (isNaN(d)) d = new Date();
  const key = d.toISOString().slice(0, 10), rules = s.effectiveRules.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let chosen = rules[0]; rules.forEach((r) => { if (String(r.date) <= key) chosen = r; });
  return { settings: s, rule: chosen };
}
export function gosiRates(emp, asOf) {
  const x = gosiRuleFor(asOf), r = x.rule, age = empAge(emp), oldAge = age >= x.settings.ageThreshold;
  if (!emp.isSaudi) return { emp: 0, er: (Number(r.nonSaudiEr) || 0) / 100 };
  const match = (emp.insSystem || 'old') === 'new';
  if (match) return { emp: (Number(oldAge ? r.matchEmp55 : r.matchEmp) || 0) / 100, er: (Number(oldAge ? r.matchEr55 : r.matchEr) || 0) / 100 };
  return { emp: (Number(oldAge ? r.noMatchEmp55 : r.noMatchEmp) || 0) / 100, er: (Number(oldAge ? r.noMatchEr55 : r.noMatchEr) || 0) / 100 };
}
export function calcInsBase(sal, hou, wd, md) { const s = getInsSettings(); return Math.min((s.wageCap / md) * wd, sal + hou); }
export function calcIns(emp, wd, md, asOf) {
  if (kindOf(emp)) return { base: 0, empAmt: 0, erAmt: 0, status: 'غير خاضع' };
  if (C.isEG()) return C.calcInsEG(emp, wd, md, asOf);
  const isConsultant = ((emp.excelCategory || '') === 'consultant') || /استشاري/.test(String(emp.jobTitle || '')) || /مهمة محددة/.test(String(emp.empType || ''));
  const sal = emp.salary || 0, hou = emp.housingAllowance || 0, skip = noInsWps(emp);
  if (isConsultant || skip) return { base: 0, empAmt: 0, erAmt: 0, status: 'لا يطبق' };
  const rates = gosiRates(emp, asOf), base = calcInsBase(sal, hou, wd, md);
  return { base: Math.round(base * 100) / 100, empAmt: Math.round(base * rates.emp * 100) / 100, erAmt: Math.round(base * rates.er * 100) / 100, status: insStatusText(emp), empRate: rates.emp, erRate: rates.er };
}
export const calcEOS = (sal, yrs, hou = 0) => { const base = (Number(sal) || 0) + (Number(hou) || 0), y = Math.max(0, Number(yrs) || 0); return Math.round(((base / 2) * Math.min(y, 5) + base * Math.max(0, y - 5)) * 100) / 100; };
