import BioAsk from './BioAsk.jsx';
import { useEffect, useMemo, useState } from 'react';
import PageExport from './PageExport.jsx';
import { Outlet, useLocation, useNavigate } from '../router.jsx';
import { PG_NAV, PG_INFO, MODS } from '../nav.js';
import { useApp, usePerm } from '../store/AppStore.jsx';
import * as auth from '../lib/auth.js';
import * as vault from '../lib/vault.js';
import { T, getLang, setLang, useLang } from '../lib/i18n.js';
import { getAlerts } from '../lib/util.js';
import { toast } from './Toast.jsx';
import { useTheme } from '../lib/theme.js';
import { applyBrand } from '../lib/brand.js';
import SectionAudit from '../pages/audit/SectionAudit.jsx';
import CandAuto from './CandAuto.jsx';
import HrBell from './HrBell.jsx';
import AiAssistant from './AiAssistant.jsx';
import ChangePw from '../employee/ChangePw.jsx';

const SB_KEY = 'hr7_sidebar_hidden';
const mob = () => window.innerWidth <= 900;
const storedClosed = () => { try { return localStorage.getItem(SB_KEY) === '1'; } catch { return false; } };

export default function Layout() {
  const lang = useLang();
  const en = lang === 'en';
  const { activeEmps, leaves, reload, settings: cfg } = useApp();
  useEffect(() => { applyBrand(cfg && cfg.brand && !cfg.brand.reset ? cfg.brand : null); }, [cfg && cfg.brand]);
  const coName = cfg && cfg.names ? ((en ? cfg.names.coEn : cfg.names.coAr) || '').trim() : '';
  const perm = usePerm();
  const loc = useLocation();
  const nav = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const [closed, setClosedState] = useState(() => (mob() ? true : storedClosed()));
  const [spin, setSpin] = useState(false);
  const [chgPw, setChgPw] = useState(false);
  useEffect(() => { document.body.classList.add('a9-hr'); return () => document.body.classList.remove('a9-hr'); }, []);
  const [bioAsk, setBioAsk] = useState(() => { try { return sessionStorage.getItem('ariba_bio_nudge') === '1'; } catch { return false; } });

  const setClosed = (c, save) => { setClosedState(c); if (save && !mob()) { try { localStorage.setItem(SB_KEY, c ? '1' : '0'); } catch { /* ignore */ } } };
  useEffect(() => { document.body.classList.toggle('sbx-closed', closed); document.body.classList.toggle('sidebar-hidden-v17', closed); setTimeout(() => window.dispatchEvent(new Event('resize')), 420); }, [closed]);
  useEffect(() => {
    let was = mob();
    const rs = () => { const m = mob(); if (m !== was) { was = m; setClosed(m ? true : storedClosed(), false); } };
    const esc = (e) => { if (e.key === 'Escape' && mob()) setClosed(true, false); };
    window.addEventListener('resize', rs); document.addEventListener('keydown', esc);
    return () => { window.removeEventListener('resize', rs); document.removeEventListener('keydown', esc); };
  }, []);
  useEffect(() => { if (mob()) setClosed(true, false); }, [loc.pathname]);

  const pageId = (loc.pathname.replace(/^\//, '').split('/')[0]) || 'dash';
  const info = PG_INFO[pageId] || { ar: pageId, en: pageId, ic: 'ti-circle' };
  const badges = useMemo(() => ({
    emp: activeEmps.length,
    lv: leaves.filter((l) => l.status === 'pending').length,
    docs: getAlerts(activeEmps).filter((x) => ['الهوية / الإقامة', 'جواز السفر', 'التأمين الطبي'].includes(x.type)).length,
  }), [activeEmps, leaves]);

  const items = PG_NAV.filter((n) => n.sec || !MODS[n.id] || perm.can(MODS[n.id]));
  // إخفاء عناوين الأقسام الفارغة
  const visible = items.filter((n, i) => !n.sec || (items[i + 1] && !items[i + 1].sec));

  const role = auth.state.role;
  const roleLabel = { admin: 'مسؤول HR', chairman: 'رئيس المجلس', ceo: 'الرئيس التنفيذي', hr: 'مسؤول HR', admin_manager: 'المدير الإداري', finance: 'المالية', manager: 'مدير', employee: 'موظف' }[role] || 'مسؤول HR';
  const dateTxt = new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  async function sync() {
    setSpin(true); await reload({ silent: false }); setSpin(false); toast('تم التحديث والمزامنة بنجاح ✓', 'tin');
  }
  return (
    <>
      <div className="app">
        <aside className="sb" id="SB" aria-hidden={closed}>
          <div className="lbx"><div className="lic" style={{ background: 'transparent', padding: 0, width: 44, height: 44 }}><CompanyLogo /></div><div className="lt"><h1 id="coN">{coName}</h1><p>اريبا للاستشارات</p></div></div>
          <div id="NV">
            {visible.map((n, i) => n.sec
              ? <div className="ns" key={'s' + i}>{n.sec}</div>
              : <div key={n.id} id={'ni-' + n.id} role="link" tabIndex={0} onClick={() => nav('/' + n.id)} onKeyDown={(e) => e.key === 'Enter' && nav('/' + n.id)} className={'ni' + (pageId === n.id ? ' on' : '')}>
                <i className={'ti ' + n.icon} /><span className="nl">{en ? n.en : n.ar}</span>
                {n.badge && badges[n.badge] > 0 && <span className={'nbg ' + n.bc} id={'nb_' + n.badge}>{badges[n.badge]}</span>}
              </div>)}
          </div>
          <div id="BUILD_STAMP" style={{ padding: '10px 14px', fontSize: 10, opacity: .55, textAlign: 'center' }}>{'build ' + (typeof __BUILD__ === 'string' ? __BUILD__ : '')}</div>
        </aside>
        <div className="main">
          <div className="topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <button id="SBX_BTN" type="button" aria-label="القائمة" aria-controls="SB" aria-expanded={!closed} onClick={() => setClosed(!closed, true)}><span /><span /><span /></button>
              <div className="pt" id="PT"><i className={'ti ' + info.ic} /> <span id="PTT">{en ? info.en : info.ar}</span></div>
            </div>
            <div className="tbr">
              <button id="aribaThemeBtn" className="ariba-theme-btn" type="button" onClick={toggleTheme} title={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}><i className={'ti ' + (theme === 'dark' ? 'ti-sun' : 'ti-moon')} /></button>
              <span style={{ fontSize: 11, color: 'var(--mu)' }} id="DTS">{dateTxt}</span>
              <HrBell /><CandAuto />
              <button className="ib" id="langBtn" onClick={() => setLang(getLang() === 'en' ? 'ar' : 'en')} title="تغيير اللغة" style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px' }}><span id="langBtnTxt">{en ? 'AR' : 'EN'}</span></button>
              <PageExport title={en ? info.en : info.ar} />
              <button className="ib" onClick={() => window.print()} title="طباعة"><i className="ti ti-printer" /></button>
              <button className="btn bpl bsm" onClick={sync} title="تحديث البيانات وحفظها" disabled={spin}><i className="ti ti-refresh" /> تحديث البيانات</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, fontSize: 11 }}>
                <div className="av" style={{ width: 26, height: 26, background: 'linear-gradient(135deg,var(--ariba-bright,#29B35E),var(--ariba-dark,#014D3D))', color: '#fff', fontSize: 10 }}>HR</div>
                <span id="HRL" style={{ fontWeight: 700 }}>{roleLabel}</span>
                <button id="aribaPwHdrBtn" type="button" className="ib" title={en ? 'Change my password' : 'تغيير كلمة مرور حسابي'} aria-label={en ? 'Change my password' : 'تغيير كلمة مرور حسابي'} style={{ fontSize: 12, color: theme === 'dark' ? '#E4E4BC' : undefined }} onClick={() => (auth.state.token ? setChgPw(true) : toast(en ? 'Please sign in first' : 'سجّل الدخول بحسابك الأول', 'ter'))}><i className="ti ti-key" /></button>
                <button className="ib" onClick={() => { auth.signOut(); nav('/'); }} title="تسجيل الخروج" style={{ color: theme === 'dark' ? '#E4E4BC' : 'var(--ariba-dark,#014D3D)', fontSize: 12, marginInlineStart: 5, paddingInline: 8 }} aria-label="تسجيل الخروج"><i className="ti ti-logout" /></button>
              </div>
            </div>
          </div>
          <div className="con"><SectionAudit page={pageId} /><Outlet /></div>
        </div>
      </div>
      <AiAssistant />
      {chgPw && <ChangePw onClose={() => setChgPw(false)} />}
      <div id="SBX_BD" onClick={() => setClosed(true, false)} />
      {bioAsk && <BioAsk onClose={() => { try { sessionStorage.removeItem('ariba_bio_nudge'); } catch { /* ignore */ } const r = vault.getRec(); if (r) { r.nudged = true; vault.setRec(r); } setBioAsk(false); }} />}
    </>
  );
}

function CompanyLogo() {
  const { settings } = useApp();
  const src = settings && settings.logo && settings.logo.data && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(settings.logo.data) ? settings.logo.data : null;
  return src ? <img src={src} style={{ width: 44, height: 44, objectFit: 'contain' }} alt="logo" /> : <span style={{ width: 44, height: 44 }} />;
}
