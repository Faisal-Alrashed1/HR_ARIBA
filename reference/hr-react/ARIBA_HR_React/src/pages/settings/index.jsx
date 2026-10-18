import { useEffect, useRef, useState } from 'react';
import { usePerm } from '../../store/AppStore.jsx';
import { T, useLang } from '../../lib/i18n.js';
import CountryCard from './CountryCard.jsx';
import CompanyCard from './CompanyCard.jsx';
import LogoCard from './LogoCard.jsx';
import SignerCard from './SignerCard.jsx';
import LetterheadCard from './LetterheadCard.jsx';
import BrandCard from './BrandCard.jsx';
import InsuranceCard from './InsuranceCard.jsx';
import CarryCard, { AccrualCard } from './CarryCard.jsx';
import PunchCard from './PunchCard.jsx';
import PermsCard from './PermsCard.jsx';
import FlexCard from './FlexCard.jsx';
import ExcludeCard from './ExcludeCard.jsx';
import MasterListsCard from './MasterListsCard.jsx';
import PwCard from './PwCard.jsx';
import RolesCard from './RolesCard.jsx';
import { MyMailCard, CompanyMailCard, MailModeCard } from './MailCard.jsx';
import ScheduleCard from './ScheduleCard.jsx';
import WorkflowCard from './WorkflowCard.jsx';
import ManagerPermsCard from './ManagerPermsCard.jsx';
import DocSignCard from './DocSignCard.jsx';
import ApplyCard from './ApplyCard.jsx';

/** أقسام الإعدادات المرقّمة (V152) — نفس الترتيب والتسميات */
const SECS = [
  ['company', '1', 'بيانات الشركة والهوية', 'Company & identity', 'ti-building'],
  ['print', '2', 'الورق الرسمي والتوقيع', 'Letterhead & signature', 'ti-file-text'],
  ['att', '3', 'الحضور والدوام', 'Attendance & working hours', 'ti-clock'],
  ['leave', '4', 'الإجازات والأرصدة', 'Leaves & balances', 'ti-calendar-repeat'],
  ['app', '5', 'تطبيق الموظف', 'Employee app', 'ti-device-mobile'],
  ['fin', '6', 'المالية والتأمينات', 'Finance & insurance', 'ti-cash'],
  ['mail', '7', 'البريد والإشعارات', 'Email & notifications', 'ti-mail'],
  ['lists', '8', 'القوائم والبيانات الأساسية', 'Lists & master data', 'ti-list-details'],
  ['access', '9', 'المستخدمون والصلاحيات والأمان', 'Users, permissions & security', 'ti-shield-lock'],
];
const OK = 'ariba_set_open_v1';
const readOpen = () => { try { return JSON.parse(localStorage.getItem(OK) || 'null') || { company: 1 }; } catch { return { company: 1 }; } };

export default function Settings() {
  const perm = usePerm(); const ro = !perm.edit('settings'); const lang = useLang(); const en = lang === 'en';
  const [open, setOpen] = useState(readOpen); const [q, setQ] = useState('');
  const org = useRef(null); const [counts, setCounts] = useState({});
  const toggle = (k) => setOpen((o) => { const n = { ...o, [k]: o[k] ? 0 : 1 }; try { localStorage.setItem(OK, JSON.stringify(n)); } catch { /* ignore */ } return n; });
  const jump = (k) => { setOpen((o) => { const n = { ...o, [k]: 1 }; try { localStorage.setItem(OK, JSON.stringify(n)); } catch { /* ignore */ } return n; }); setTimeout(() => { const el = org.current && org.current.querySelector('.so-sec[data-sec="' + k + '"]'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30); };
  // البحث: نخفي الكروت اللي ما فيهاش النص (زي النسخة القديمة)، ونفتح القسم اللي فيه نتائج
  useEffect(() => {
    const root = org.current; if (!root) return; const s = q.trim().toLowerCase(); let any = false; const c = {}; const op = {};
    root.querySelectorAll('.so-sec').forEach((sec) => {
      const k = sec.getAttribute('data-sec'); let shown = 0, total = 0;
      sec.querySelectorAll('.so-body > .card').forEach((card) => { total++; const ok = !s || card.textContent.toLowerCase().indexOf(s) >= 0; card.style.display = ok ? '' : 'none'; if (ok) shown++; });
      c[k] = total; if (s && shown) op[k] = 1;
      sec.style.display = (shown || (!s && total)) ? '' : 'none'; if (shown) any = true;
    });
    const em = root.querySelector('#SO_EMPTY'); if (em) em.style.display = (s && !any) ? 'block' : 'none';
    setCounts((prev) => (JSON.stringify(prev) === JSON.stringify(c) ? prev : c));
    if (s && Object.keys(op).some((k) => !open[k])) setOpen((o) => ({ ...o, ...op }));
  });
  if (!perm.can('settings')) return <div className="card" style={{ margin: 16 }}>{T('مفيش صلاحية لصفحة الإعدادات', 'No access to Settings')}</div>;
  const canPerm = perm.can('permissions');
  const S = {
    company: [<CountryCard key="cn" />, <CompanyCard key="co" />, <LogoCard key="lg" />, <BrandCard key="br" />],
    print: [<LetterheadCard key="lh" />, <SignerCard key="hs" />],
    att: [<ScheduleCard key="sc" />, <FlexCard key="fx" />],
    leave: [<CarryCard key="lc" />, <AccrualCard key="acc" />],
    app: [<PunchCard key="pw" />, <WorkflowCard key="wf" />, <DocSignCard key="ds" />],
    fin: [<InsuranceCard key="ins" />, <ExcludeCard key="ex" />],
    mail: [<MyMailCard key="mm" />, <CompanyMailCard key="mc" />, <MailModeCard key="mo" />],
    lists: [<MasterListsCard key="ml" />],
    access: [<PwCard key="pwd" />, <ApplyCard key="apl" />, ...(canPerm ? [<PermsCard key="pm" />, <RolesCard key="rl" />, <ManagerPermsCard key="mp" />] : [])],
  };
  return (
    <div id="pg-set">
      {ro && <div style={{ margin: '6px 0', fontSize: 11.5, color: 'var(--am)' }}>👁 {T('اطلاع فقط — مفيش تعديل في الصفحة دي', 'View only — no editing on this page')}</div>}
      <fieldset disabled={ro} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <div id="SET_ORG" ref={org} data-l={en ? 'en' : 'ar'}>
          <div className="so-bar">
            <input className="so-search" id="SO_Q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T('ابحث في الإعدادات…', 'Search settings…')} />
            {SECS.map((s) => <span key={s[0]} className="so-chip" data-sec={s[0]} style={{ display: counts[s[0]] ? '' : 'none' }} onClick={() => jump(s[0])}><b>{s[1]}</b>{en ? s[3] : s[2]}</span>)}
          </div>
          {SECS.map((s) => (
            <section key={s[0]} className={'so-sec' + (open[s[0]] ? '' : ' closed')} data-sec={s[0]}>
              <div className="so-head" onClick={() => toggle(s[0])}><span className="n">{s[1]}</span><i className={'ti ' + s[4]} /><span>{en ? s[3] : s[2]}</span><span className="cnt">{counts[s[0]] ? counts[s[0]] + ' ' + T('إعداد', 'item(s)') : ''}</span><i className="ti ti-chevron-down ar" /></div>
              <div className="so-body">{S[s[0]]}</div>
            </section>
          ))}
          <div className="so-empty" id="SO_EMPTY">{T('مفيش نتائج مطابقة', 'No matching settings')}</div>
        </div>
      </fieldset>
    </div>
  );
}
