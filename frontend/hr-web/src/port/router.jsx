// ADAPTED (not in their source): the few react-router-dom pieces their screens use, on top of Next's App Router.
// Their screens navigate by page id ('/emps', '/emps/12/edit', '/lv'); each id is one Next route of the portal.
'use client';
import { Children, createContext, isValidElement, useContext, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export const ID_PATH = {
  dash: '/dashboard', emps: '/employees', cand: '/candidates', goals: '/goals', eval: '/evaluation', att: '/attendance',
  loc: '/locations', lv: '/leaves', team: '/team', pay: '/payroll', insc: '/insurance-calculator', salcalc: '/salary-calculator',
  taxcalc: '/tax-calculator', wps: '/wps', prov: '/provisions', assets: '/assets', slip: '/payslips', eos: '/end-of-service',
  eoscalc: '/settlement', docs: '/documents', rpt: '/reports', set: '/settings', audit: '/audit', forms: '/templates',
};
const PATH_ID = Object.fromEntries(Object.entries(ID_PATH).map(([k, v]) => [v, k]));

/** '/emps/12/edit' → '/employees/12' ; '/emps/new' → '/employees/new' ; '/lv' → '/leaves' */
export function toNext(theirs) {
  const parts = String(theirs || '/').replace(/^#?\/?/, '').split('/');
  const base = ID_PATH[parts[0] || 'dash'] || '/dashboard';
  if (parts[0] === 'emps' && parts[1]) return parts[1] === 'new' ? base + '/new' : base + '/' + parts[1];
  return base;
}
/** '/employees/12' → '/emps/12/edit' (what their screens read from the location) */
export function fromNext(path) {
  const parts = String(path || '/').split('/').filter(Boolean);
  const id = PATH_ID['/' + (parts[0] || 'dashboard')] || 'dash';
  if (id === 'emps' && parts[1]) return parts[1] === 'new' ? '/emps/new' : '/emps/' + parts[1] + '/edit';
  return '/' + id;
}

export function useNavigate() {
  const router = useRouter();
  return useMemo(() => (to, opts) => {
    if (typeof to === 'number') { if (to < 0) router.back(); return; }
    const href = toNext(to);
    if (opts && opts.replace) router.replace(href); else router.push(href);
  }, [router]);
}
export function useLocation() {
  const p = usePathname();
  return useMemo(() => ({ pathname: fromNext(p), search: '', hash: '' }), [p]);
}

const ParamsCtx = createContext({});
export const useParams = () => useContext(ParamsCtx);

const OutletCtx = createContext(null);
export const OutletProvider = ({ value, children }) => <OutletCtx.Provider value={value}>{children}</OutletCtx.Provider>;
export const Outlet = () => useContext(OutletCtx);

export function Navigate({ to, replace }) {
  const nav = useNavigate();
  useEffect(() => { nav(to, { replace }); }, [nav, to, replace]);
  return null;
}
/** Route matching inside one page (their employees/index.jsx): index, 'new', ':id/edit'. */
export function Route() { return null; }
export function Routes({ children }) {
  const { pathname } = useLocation();
  const rest = pathname.split('/').filter(Boolean).slice(1);
  for (const ch of Children.toArray(children)) {
    if (!isValidElement(ch)) continue;
    const { index, path, element } = ch.props;
    if (index && rest.length === 0) return element;
    if (!path) continue;
    const segs = path.split('/');
    if (segs.length !== rest.length) continue;
    const params = {};
    if (segs.every((s, i) => (s.startsWith(':') ? ((params[s.slice(1)] = decodeURIComponent(rest[i])), true) : s === rest[i]))) {
      return <ParamsCtx.Provider value={params}>{element}</ParamsCtx.Provider>;
    }
  }
  return null;
}
export function HashRouter({ children }) { return children; }
