import { lazy, Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import * as auth from '../lib/auth.js';
import { rpc } from '../lib/api.js';
import { getLang, setLang, useLang } from '../lib/i18n.js';
import IdleGuard from '../components/IdleGuard.jsx';
import BioAsk from '../components/BioAsk.jsx';
import { ToastHost, toast } from '../components/Toast.jsx';
import * as vault from '../lib/vault.js';
import EmpLogin from './EmpLogin.jsx';
import { EmpProvider, useEmp } from './EmpStore.jsx';
import { NavProvider } from './nav.jsx';
import { Svg, T } from './util.jsx';
import { setEmpTheme, useEmpTheme } from './theme.js';
import Bell from './Bell.jsx';
import ChangePw from './ChangePw.jsx';
import ForgotPunch from './ForgotPunch.jsx';
import Home from './Home.jsx';
import Att from './Att.jsx';
import Leaves from './Leaves.jsx';
import Pay from './Pay.jsx';
import Prof from './Prof.jsx';
import Overtime from './Overtime.jsx';
import Docs from './Docs.jsx';
import Approvals from './Approvals.jsx';
import Team, { TaskFab } from './Team.jsx';
import MyGoals from '../goals/MyGoals.jsx';
import { pullBrand } from './brand.js';
import css from './employee.css?inline';
import './employee-extra.css';
void lazy; void Suspense;

const SUN = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7z" fill="currentColor"/></svg>';

const TAB_ICON = { home: 'home', att: 'att', lv: 'lv', pay: 'pay', team: 'team', prof: 'prof', overtime: 'ot', docs: 'docs' };

function Shell() {
  useLang();
  const { me, hasApproval, queue, docsN, reload, loadQueue, loadDocsN } = useEmp();
  const theme = useEmpTheme(); const lang = getLang();
  const [tab, setTab] = useState('home'), [spin, setSpin] = useState(false), [forgot, setForgot] = useState(false), [pw, setPw] = useState(false), [forced, setForced] = useState(null);
  const [bioAsk, setBioAsk] = useState(() => { try { return sessionStorage.getItem('ariba_bio_nudge') === '1'; } catch { return false; } });

  // كلمة المرور الافتراضية => تغيير إجباري قبل المتابعة
  useEffect(() => {
    let live = true;
    rpc('ariba_password_status', {}).then((d) => { if (live && d && d.must_change) setForced(d.username || ''); }).catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => { pullBrand(css); const iv = setInterval(() => pullBrand(css), 15000); return () => clearInterval(iv); }, []);
  useEffect(() => { document.title = me ? (T('تطبيق الموظف', 'Employee App') + ' - ' + (me.name_en && lang === 'en' ? me.name_en : me.name)) : T('تطبيق الموظف - اريبا', 'Ariba Employee App'); }, [me, lang]);
  useEffect(() => { if (tab === 'approvals' && !hasApproval) setTab('home'); }, [tab, hasApproval]);

  const go = useCallback((t) => { setTab(t); window.scrollTo(0, 0); }, []);
  const navCtx = useMemo(() => ({ go, openForgot: () => setForgot(true), openPw: () => setPw(true) }), [go]);
  async function refresh() { setSpin(true); try { await reload(true); await loadDocsN(); await loadQueue(); toast(T('تم التحديث والحفظ', 'Updated and synced'), 'tin'); } catch { toast(T('تعذر إكمال التحديث', 'Update failed'), 'ter'); } finally { setSpin(false); } }

  const tabs = [['home', T('الرئيسية', 'Home')], ['att', T('الحضور', 'Attendance')], ['lv', T('الإجازات', 'Leaves')], ['pay', T('الراتب', 'Salary')], ['team', T('فريقي', 'My Team')], ['prof', T('ملفي', 'Profile')]];
  if (hasApproval) tabs.push(['approvals', T('الموافقات', 'Approvals')]);
  tabs.push(['goals', T('أهدافي وتقييمي', 'Goals & review')], ['overtime', T('عمل إضافي', 'Overtime')], ['docs', T('مستندات', 'Documents')]);
  const title = (tabs.find((x) => x[0] === tab) || tabs[0])[1];
  const body = { home: <Home />, att: <Att />, lv: <Leaves />, pay: <Pay />, team: <Team />, prof: <Prof />, overtime: <Overtime />, docs: <Docs />, approvals: <Approvals />, goals: <MyGoals /> }[tab];

  return (
    <NavProvider value={navCtx}>
      <div className="screen on" id="sc-app">
        <div className="hdr">
          <div className="hdr-title" id="pageTitle">{title}</div>
          <div className="hdr-user">
            <Bell />
            <button type="button" id="ARIBA_MANUAL_REFRESH_EMP" className={spin ? 'busy' : ''} title={T('التحديث', 'Refresh')} aria-label={T('التحديث', 'Refresh')} disabled={spin} onClick={refresh}><Svg n="refresh" /></button>
            <button type="button" id="aribaPwHdrBtn" className="a8-ib" title={T('تغيير كلمة المرور', 'Change password')} aria-label={T('تغيير كلمة المرور', 'Change password')} onClick={() => setPw(true)}><Svg n="key" /></button>
            <button type="button" id="aribaLogoutBtn" className="a8-ib" style={{ color: 'var(--rd)' }} title={T('تسجيل الخروج', 'Sign out')} aria-label={T('تسجيل الخروج', 'Sign out')} onClick={() => auth.signOut('manual')}><Svg n="logout" /></button>
          </div>
          <div className="ariba-top-actions">
            <button type="button" id="aribaModeBtn" className="ariba-mode-btn" title={theme === 'dark' ? T('التبديل للوضع النهاري', 'Switch to light mode') : T('التبديل للوضع الليلي', 'Switch to dark mode')}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, minWidth: 40, padding: 0, borderRadius: '50%', border: '1.5px solid ' + (theme === 'dark' ? '#f5b301' : 'var(--bp,#014D3D)'), background: theme === 'dark' ? 'rgba(245,179,1,.12)' : 'color-mix(in srgb, var(--bp,#014D3D) 8%, transparent)', color: theme === 'dark' ? '#f5b301' : 'var(--bp,#014D3D)', cursor: 'pointer', fontSize: 0 }}
              onClick={() => setEmpTheme(theme === 'dark' ? 'light' : 'dark')} dangerouslySetInnerHTML={{ __html: theme === 'dark' ? SUN : MOON }} />
          </div>
          <button type="button" id="aribaLangBtn" className="ariba-lang-btn-x" title="Language / اللغة" onClick={() => { setLang(lang === 'en' ? 'ar' : 'en'); }}
            style={{ minWidth: 36, height: 36, borderRadius: 12, padding: '0 10px', fontSize: 11, fontWeight: 800, border: '1px solid var(--bd)', background: 'var(--c2)', color: 'var(--tx)', cursor: 'pointer', fontFamily: 'inherit' }}>{lang === 'en' ? 'AR' : 'EN'}</button>
        </div>
        <div className="content" id="appContent">{me ? body : <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 40 }}>{T('جاري التحميل…', 'Loading…')}</div>}</div>
        <nav className="bnav">
          {tabs.map(([k, l]) => (
            <button key={k} type="button" id={'tb-' + k} className={'bni' + (tab === k ? ' on' : '')} data-a8="1" onClick={() => go(k)}>
              {k === 'approvals' ? <i className="ti ti-checks" /> : k === 'goals' ? <i className="ti ti-target" /> : <Svg n={TAB_ICON[k]} />}<span>{l}</span>
              {k === 'approvals' && queue.length > 0 && <b id="approvalBadge" style={{ position: 'absolute', margin: '-4px 0 0 -10px', background: 'var(--rd)', color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 9 }}>{queue.length}</b>}
              {k === 'docs' && docsN > 0 && <span id="docsBadge" style={{ display: 'flex', position: 'absolute', top: 2, insetInlineEnd: 14, background: '#e5484d', color: '#fff', borderRadius: '50%', minWidth: 16, height: 16, fontSize: 9, alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{docsN}</span>}
            </button>
          ))}
        </nav>
        <TaskFab />
      </div>
      {forgot && <ForgotPunch onClose={() => setForgot(false)} />}
      {pw && <ChangePw onClose={() => setPw(false)} />}
      {forced !== null && <ChangePw forced username={forced} onClose={(ok) => { if (ok) setForced(null); }} />}
      {bioAsk && <BioAsk onClose={() => { try { sessionStorage.removeItem('ariba_bio_nudge'); } catch { /* ignore */ } const r = vault.getRec(); if (r) { r.nudged = true; vault.setRec(r); } setBioAsk(false); }} />}
    </NavProvider>
  );
}

export default function EmpApp() {
  const [booting, setBooting] = useState(true);
  useSyncExternalStore(auth.subscribe, auth.getVersion);
  useEffect(() => { auth.restore().finally(() => setBooting(false)); }, []);
  if (booting) return <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)' }} />;
  return (
    <>
      {auth.isAuthed() ? <EmpProvider><Shell /></EmpProvider> : <EmpLogin />}
      {auth.isAuthed() && <IdleGuard />}
      <ToastHost />
    </>
  );
}
