// تسجيل الصفحات (يُضاف إليه كل ما يُنجز) — تحميل كسول لكل صفحة
import { lazy } from 'react';
const Soon = lazy(() => import('./Soon.jsx'));
export const PAGES = [
  ['goals', lazy(() => import('./goals/index.jsx'))], ['eval', lazy(() => import('./goals/Eval.jsx'))],
  ['cand', lazy(() => import('./candidates/index.jsx'))],
  ['emps', lazy(() => import('./employees/index.jsx'))], ['att', lazy(() => import('./attendance/index.jsx'))], ['loc', lazy(() => import('./attendance/Locations.jsx'))], ['lv', lazy(() => import('./leaves/index.jsx'))], ['team', lazy(() => import('./team/index.jsx'))], ['pay', lazy(() => import('./payroll/index.jsx'))], ['insc', lazy(() => import('./finance/InsCalc.jsx'))], ['salcalc', lazy(() => import('./finance/SalCalc.jsx'))], ['taxcalc', lazy(() => import('./finance/TaxCalc.jsx'))],
  ['wps', lazy(() => import('./finance/Wps.jsx'))], ['prov', lazy(() => import('./finance/Prov.jsx'))], ['assets', lazy(() => import('./finance/Assets.jsx'))], ['slip', lazy(() => import('./finance/Slip.jsx'))], ['eos', lazy(() => import('./finance/Eos.jsx'))], ['eoscalc', lazy(() => import('./finance/EosCalc.jsx'))], ['docs', lazy(() => import('./docs/index.jsx'))], ['rpt', lazy(() => import('./reports/index.jsx'))], ['set', lazy(() => import('./settings/index.jsx'))], ['audit', lazy(() => import('./audit/index.jsx'))], ['forms', lazy(() => import('./forms/index.jsx'))],
];
