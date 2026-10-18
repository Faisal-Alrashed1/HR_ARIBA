import { useEffect, useState } from 'react';
import { useEmp } from './EmpStore.jsx';
import { useLang } from '../lib/i18n.js';
import { Svg, T, isEN, riyadhNow, secs, hm, fmtHM, shortName, greet, money, num, MN_AR, MN_EN } from './util.jsx';
import { todayState, expectedOut, useLocation, usePunch } from './punch.jsx';
import { useAppNav } from './nav.jsx';
import WorkLocations from './WorkLocations.jsx';
import { usePunchLogo } from './brand.js';

/** بطاقة البصمة + البلاطات + الإجراءات السريعة (v118) */
export default function Home() {
  const wm = usePunchLogo();
  useLang();
  const { me, att, loadAtt, docsN } = useEmp();
  const nav = useAppNav();
  const [now, setNow] = useState(riyadhNow);
  const { loc } = useLocation(true);
  const { punch, busy } = usePunch();
  useEffect(() => { loadAtt(); const iv = setInterval(() => setNow(riyadhNow()), 1000); return () => clearInterval(iv); }, []); // eslint-disable-line
  if (!me) return null;

  const S = todayState(me.attendance), en = isEN();
  const nm = en ? (me.name_en || me.name) : me.name, first = (nm || '').split(/\s+/)[0] || '';
  const mode = !S.n ? 'in' : (S.open ? 'out' : 'done');
  const label = mode === 'in' ? T('سجّل حضورك', 'Check in') : mode === 'out' ? T('سجّل انصرافك', 'Check out') : T('تم الانصراف', 'Checked out');
  const icon = mode === 'in' ? 'finger' : mode === 'out' ? 'out' : 'check';
  const ex = expectedOut(S, att), R = 82, C = 2 * Math.PI * R;
  const workedSec = S.closedSec + (S.open ? Math.max(0, (now.h * 3600 + now.m * 60 + now.s) - secs(S.open.time_in)) : 0);
  const prog = ex ? Math.min(1, workedSec / ex.shift) : (S.n ? Math.min(1, workedSec / 28800) : 0);
  const lc = loc.state === 'in' || loc.state === 'gps' ? 'ok' : (loc.state === 'out' || loc.state === 'denied' || loc.state === 'na') ? 'bad' : '';
  const h12 = ((now.h + 11) % 12) + 1, pad = (x) => ('0' + x).slice(-2);
  const ye = me.leaveYearEnd, rem = me.remote_limit != null ? me.remote_limit - (me.remote_used || 0) : null;
  const fmtN = (v) => (v == null || isNaN(v) ? '—' : Number(v).toFixed(2).replace(/\.00$/, ''));
  const pend = (me.requests || []).filter((r) => r.status === 'pending').length;
  const last = me.payroll && me.payroll[0];
  const lp = last ? (last.payload && typeof last.payload === 'object' ? last.payload : last) : null;
  const mname = last ? ((en ? MN_EN : MN_AR)[Number(last.month) || 0] || '') + (last.year ? ' ' + last.year : '') : '';

  const onPunch = () => { if (busy) return; if (mode === 'in') punch('in'); else if (mode === 'out') punch('out'); };
  const Tile = ({ ic, v, l }) => <div className="a8-tile"><div className="ic"><Svg n={ic} /></div><div className="v">{v}</div><div className="l">{l}</div></div>;
  const Q = ({ ic, l, go, id }) => <button type="button" className="a8-q" id={id} onClick={go}><div className="ic"><Svg n={ic} size={22} /></div><span>{l}</span></button>;

  return (
    <div id="a8Wrap">
      <div className="a8-hero" id="a8Hero">
        <div className="a8-top">
          <div className="a8-av">{me.photoUrl && /^(https?:|data:image\/)/i.test(me.photoUrl) ? <img src={me.photoUrl} alt="" /> : (first || '؟').charAt(0)}</div>
          <div><div className="a8-hello">{greet(now.h)}</div><div className="a8-name">{shortName(nm)}</div></div>
        </div>
        <div className="a8-clock" id="a8Clock" dir="ltr">{pad(h12)}:{pad(now.m)}:{pad(now.s)}<small>{now.h < 12 ? T('ص', 'AM') : T('م', 'PM')}</small></div>
        <div className="a8-date">{new Date().toLocaleDateString(en ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Riyadh' })}</div>
        <div className="a8-pw">
          {wm && <img className="a8-wm" src={wm} alt="" />}
          <svg className="a8-ring" viewBox="0 0 184 184"><circle className="bg" cx="92" cy="92" r={R} /><circle className="fg" cx="92" cy="92" r={R} strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - prog)).toFixed(1)} /></svg>
          <button type="button" className={'a8-btn ' + mode + (busy ? ' busy' : '')} id="a8Punch" aria-label={label} onClick={onPunch}><Svg n={icon} /><span>{label}</span></button>
        </div>
        <div className="a8-chips">
          <span className={'a8-chip ' + lc}><span className="d" /><Svg n="pin" /><span>{loc.text}</span></span>
          {S.n > 0 && S.open && ex && <span className="a8-chip"><Svg n="flag" /><span>{T('الانصراف المتوقع ', 'Expected check-out ')}{pad(Math.floor(ex.sec / 3600) % 24)}:{pad(Math.floor((ex.sec % 3600) / 60))}</span></span>}
          {S.n > 0 && <span className="a8-chip"><span>{T('ساعات اليوم ', 'Today ')}{fmtHM(workedSec)}</span></span>}
        </div>
        {S.n > 0 && <div className="a8-sess">{S.rows.map((r, i) => <span key={i} className="a8-s" dir="ltr">{hm(r.time_in)} → {r.time_out ? hm(r.time_out) : '…'}</span>)}</div>}
        {mode === 'done' && <button type="button" className="a8-back" id="a8Back" onClick={() => punch('in')}>↩ {T('رجوع للعمل — تسجيل حضور مرة أخرى', 'Back to work — check in again')}</button>}
      </div>

      <div className="a8-tiles">
        <Tile ic="leave" v={fmtN(me.leave_bal)} l={T('رصيد الإجازة (يوم)', 'Leave balance (days)')} />
        <Tile ic="lv" v={fmtN(ye)} l={T('رصيد نهاية العام', 'Year-end balance')} />
        <Tile ic="wallet" v={rem == null ? '—' : rem} l={T('عن بعد المتبقي', 'Remote days left')} />
      </div>
      <div className="a8-qa">
        <Q ic="lv" l={T('طلب إجازة', 'Leave request')} go={() => nav.go('lv')} id="qa-lv" />
        <Q ic="finger" l={T('نسيت بصمة', 'Forgot punch')} go={() => nav.openForgot()} id="qa-fp" />
        <Q ic="ot" l={T('عمل إضافي', 'Overtime')} go={() => nav.go('overtime')} id="qa-ot" />
        <Q ic="docs" l={T('مستنداتي', 'My documents')} go={() => nav.go('docs')} id="qa-docs" />
      </div>
      <div className="a8-sec">{T('بياناتي', 'My details')}</div>
      <div className="card">
        <div className="profile-grid">
          <div className="profile-info"><span>{T('جهة العمل', 'Employer')}</span><b>{me.employer || '—'}</b></div>
          <div className="profile-info"><span>{T('القسم', 'Department')}</span><b>{me.dept || '—'}</b></div>
          <div className="profile-info"><span>{T('المدير المباشر', 'Direct manager')}</span><b>{me.managerName || '—'}</b></div>
          <div className="profile-info"><span>{T('الجنسية', 'Nationality')}</span><b>{me.nationality || '—'}</b></div>
        </div>
      </div>
      <div className="card salary-card">
        <div className="card-title"><i className="ti ti-cash" /> {T('آخر راتب معتمد', 'Latest approved salary')}</div>
        {lp ? (
          <div className="salary-month">
            <div><strong>{mname}</strong><div style={{ fontSize: 10, color: 'var(--mu)' }}>{T('الإجمالي ', 'Gross ')}{money(lp.totalDue ?? lp.total ?? lp.salaryTotal ?? lp.tot)} • {T('التأمينات ', 'Insurance ')}{money(lp.insEmp ?? lp.insuranceSub ?? lp.ins)}</div></div>
            <div className="salary-net">{money(lp.netSAR ?? lp.net ?? lp.netSalary)}</div>
          </div>
        ) : <div style={{ color: 'var(--mu)', fontSize: 11 }}>{T('لم يتم إصدار مسير معتمد للموظف حتى الآن.', 'No approved payroll has been issued yet.')}</div>}
      </div>
      {pend > 0 && <div className="card"><div className="card-title">🔔 {T('طلبات معلقة', 'Pending requests')}</div><div style={{ fontSize: 12 }}>{T('لديك ' + pend + ' طلب/طلبات بانتظار الاعتماد.', 'You have ' + pend + ' request(s) awaiting approval.')}</div></div>}
      {docsN > 0 && <div className="card" style={{ cursor: 'pointer' }} onClick={() => nav.go('docs')}><div className="card-title">📄 {T('مستندات بانتظار توقيعك', 'Documents awaiting your signature')} <span className="b ba">{docsN}</span></div></div>}
      <WorkLocations />
    </div>
  );
}
void num;
