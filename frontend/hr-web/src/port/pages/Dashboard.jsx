import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppStore.jsx';
import ChartCanvas from '../components/ChartCanvas.jsx';
import { collectAlerts, dmy, isSaudiEmp } from '../lib/util.js';
import { noEos } from '../engines/empkind.js';
import { rpc } from '../lib/api.js';
import { useLang } from '../lib/i18n.js';
import { FemaleIcon, MaleIcon } from '@/components/hr/gender-icons';

const EMP_COLORS = { 'أريبا': '#014D3D', 'الجيوميكانية': '#29B35E', 'أوبتيموم': '#E4E4BC' };
const NAT_COLORS = { 'سعودي': '#014D3D', 'مصري': '#29B35E', 'أردني': '#E4E4BC', 'سوداني': '#231F20', 'سوري': '#4B5563', 'تونسي': '#9CA3AF' };
const DEPT_COLORS = ['#014D3D', '#29B35E', '#E4E4BC', '#4B5563', '#9CA3AF', '#231F20'];
const FEMALE_NAMES = ['منى', 'زينب', 'ريم', 'بدريه', 'ساره', 'نوره', 'كادي', 'منيرة', 'دعاء', 'غدي', 'لينا', 'نهى', 'سجى', 'روان', 'أثير', 'هيا', 'نورة', 'فاطمة', 'عائشة', 'أفنان'];
const KPI_ICON = { fontSize: 24, display: 'block', marginBottom: 6 };
const count = (arr, f) => arr.reduce((m, e) => { const k = f(e); m[k] = (m[k] || 0) + 1; return m; }, {});

export default function Dashboard() {
  const lang = useLang();
  const h = lang === 'en';
  const { activeEmps: a, terminatedEmps: t, leaves } = useApp();
  const [queue, setQueue] = useState([]);
  useEffect(() => {
    let off = false;
    const load = () => rpc('ariba_staff_queue').then((d) => { if (!off) setQueue((d && d.queue) || []); }).catch(() => {});
    load(); const iv = setInterval(load, 20000);
    return () => { off = true; clearInterval(iv); };
  }, []);

  const m = useMemo(() => {
    const saudis = a.filter(isSaudiEmp), expats = a.filter((e) => !saudis.includes(e));
    const females = a.filter((e) => { const g = String(e.gender || e.gen || '').trim(); const name = e.nameAr || e.name_ar || ''; return g === 'أنثى' || g === 'f' || g === 'female' || FEMALE_NAMES.some((fn) => name.startsWith(fn)); });
    const males = a.filter((e) => !females.includes(e));
    const tamheer = a.filter((e) => String(e.jobTitle || e.jt || '').includes('تمهير'));
    const totSal = a.reduce((s, e) => s + (Number(e.salary || e.sal || 0) + Number(e.housingAllowance || e.hou || 0) + Number(e.transportAllowance || e.tra || 0)), 0);
    const deptMap = count(a, (e) => String(e.dept || e.dep || 'غير محدد').trim());
    const deptKeys = Object.keys(deptMap).sort((x, y) => deptMap[y] - deptMap[x]);
    const empMap = count(a, (e) => String(e.employer || e.em || 'غير محدد').trim());
    const natMap = count(a, (e) => String(e.nationality || e.nat || '—').replace('سعودية', 'سعودي').replace('مصرية', 'مصري').replace('أردنية', 'أردني'));
    const byEmp = {};
    a.forEach((e) => { const sal = Number(e.salary || e.sal || 0) + Number(e.housingAllowance || e.hou || 0) + Number(e.transportAllowance || e.tra || 0); const em = String(e.employer || e.em || 'غير محدد').trim(); if (sal > 0) byEmp[em] = (byEmp[em] || 0) + sal; });
    const pct = (n) => (a.length ? Math.round(n / a.length * 100) : 0);
    const femalePct = pct(females.length);
    const totalGross = a.reduce((s, e) => s + Number(e.salaryTotal || (Number(e.salary || e.sal || 0) + Number(e.housingAllowance || e.hou || 0) + Number(e.transportAllowance || e.tra || 0) + Number(e.projectAllowance || 0) + Number(e.otherAllowance || 0)) || 0), 0);
    const totalNet = a.reduce((s, e) => s + Number(e.netSalary || e.net || 0), 0);
    return { saudis, expats, females, males, tamheer, totSal, deptMap, deptKeys, empMap, natMap, byEmp, saudiPct: pct(saudis.length), femalePct, malePct: 100 - femalePct, totalGross, totalNet };
  }, [a]);

  const localPending = leaves.filter((l) => l.status === 'pending').length;
  const pending = localPending + queue.length;
  const alerts = useMemo(() => collectAlerts(a, h, noEos), [a, h]);
  const fmt = (n) => Math.round(n).toLocaleString('en-US') + ' ر.س';
  const stageTxt = (s) => (s === 'manager' ? 'بانتظار المدير المباشر' : s === 'hr' ? 'بانتظار الموارد البشرية' : s === 'ceo' ? 'بانتظار الرئيس التنفيذي' : 'قيد المعالجة');

  return (
    <div className="pg on" id="pg-dash" style={{ padding: '12px 16px', width: '100%', boxSizing: 'border-box' }}>
      <div className="kr" id="KR" style={{ width: '100%', marginBottom: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr 1.5fr 0.8fr', gap: 14, marginBottom: 20, alignItems: 'stretch', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ background: 'var(--ariba-dark,#014D3D)', borderRadius: 18, padding: '24px 20px', textAlign: 'center', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 140 }}>
            <i className="ti ti-users" aria-hidden="true" style={{ ...KPI_ICON, opacity: .9 }} />
            <div style={{ fontSize: 12, opacity: .8, letterSpacing: .5, marginBottom: 8 }}>{h ? 'EMPLOYEES' : 'الموظفون الحاليون'}</div>
            <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, marginBottom: 8 }}>{a.length}</div>
            <div style={{ fontSize: 11, opacity: .7, borderTop: '1px solid rgba(255,255,255,.25)', paddingTop: 8 }}>{m.saudis.length} سعودي &nbsp;•&nbsp; {m.expats.length} وافد</div>
          </div>
          <div data-ariba-kpi="saudization" style={{ background: 'var(--c2)', borderRadius: 18, padding: '24px 20px', textAlign: 'center', border: '2px solid var(--ariba-dark,#014D3D)', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 140 }}>
            <i className="ti ti-flag ariba-kpi-icon" aria-hidden="true" style={KPI_ICON} />
            <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 8 }}>{h ? 'SAUDIZATION' : 'نسبة السعودة'}</div>
            <div className="ariba-kpi-num" style={{ fontSize: 52, fontWeight: 900, color: 'var(--ariba-dark,#014D3D)', lineHeight: 1, marginBottom: 10 }}>{m.saudiPct}<span style={{ fontSize: 22 }}>%</span></div>
            <div style={{ height: 8, background: 'var(--bd)', borderRadius: 4 }}><div style={{ height: 8, borderRadius: 4, background: 'var(--ariba-dark,#014D3D)', width: m.saudiPct + '%' }} /></div>
          </div>
          <div data-ariba-kpi="payroll" style={{ background: 'var(--c2)', borderRadius: 18, padding: '24px 20px', textAlign: 'center', border: '2px solid var(--ariba-dark,#014D3D)', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 140 }}>
            <i className="ti ti-cash ariba-kpi-icon" aria-hidden="true" style={KPI_ICON} />
            <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 8 }}>{h ? 'MONTHLY PAYROLL' : 'إجمالي الرواتب'}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--tx)', lineHeight: 1.2, marginBottom: 6 }}>{Math.round(m.totSal).toLocaleString('ar-SA')}</div>
            <div style={{ fontSize: 12, color: 'var(--mu)' }}>ريال سعودي / شهرياً</div>
          </div>
          <div data-ariba-kpi="gender" style={{ background: 'var(--c2)', borderRadius: 18, padding: '24px 20px', border: '2px solid var(--ariba-dark,#014D3D)', minHeight: 140 }}>
            <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 14, fontWeight: 600 }}>{h ? 'GENDER DISTRIBUTION' : 'توزيع الجنس'}</div>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: 'calc(100% - 36px)' }}>
              <div style={{ textAlign: 'center' }}><div style={{ marginBottom: 6 }}><MaleIcon /></div><div className="ariba-kpi-num" style={{ fontSize: 28, fontWeight: 900, color: 'var(--ariba-dark,#014D3D)', lineHeight: 1 }}>{m.males.length}</div><div style={{ fontSize: 12, color: 'var(--mu)', marginTop: 4 }}>{m.malePct}% ذكور</div></div>
              <div style={{ width: 1, height: 60, background: 'var(--bd)' }} />
              <div style={{ textAlign: 'center' }}><div style={{ marginBottom: 6 }}><FemaleIcon /></div><div className="ariba-kpi-num" style={{ fontSize: 28, fontWeight: 900, color: 'var(--ariba-dark,#014D3D)', lineHeight: 1 }}>{m.females.length}</div><div style={{ fontSize: 12, color: 'var(--mu)', marginTop: 4 }}>{m.femalePct}% إناث</div></div>
            </div>
          </div>
          <div data-ariba-kpi="departments" style={{ background: 'var(--c2)', borderRadius: 18, padding: '24px 20px', border: '2px solid var(--ariba-dark,#014D3D)', minHeight: 140 }}>
            <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 12, fontWeight: 600 }}>{h ? 'DEPARTMENTS' : 'توزيع الأقسام'}</div>
            {m.deptKeys.map((d) => { const p = Math.round(m.deptMap[d] / a.length * 100); return (
              <div key={d} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}><span style={{ color: 'var(--tx)' }}>{d}</span><span className="ariba-kpi-num" style={{ fontWeight: 700, color: 'var(--ariba-dark,#014D3D)' }}>{m.deptMap[d]} <span style={{ color: 'var(--mu)', fontWeight: 400 }}>({p}%)</span></span></div>
                <div style={{ height: 7, background: 'var(--bd)', borderRadius: 4 }}><div className="ariba-dept-bar" style={{ height: 7, borderRadius: 4, background: 'linear-gradient(90deg,#29B35E,#014D3D)', width: p + '%', transition: 'width .5s' }} /></div>
              </div>); })}
          </div>
          <div data-ariba-kpi="pending" style={{ background: 'var(--c2)', borderRadius: 18, padding: '20px 16px', border: '2px solid var(--ariba-dark,#014D3D)', minHeight: 140, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
            {[['ti-bell', 'طلبات معلقة', pending], ['ti-user-off', 'منتهية الخدمة', t.length], ['ti-school', 'تمهير', m.tamheer.length]].map(([ic, l, v]) => (
              <div key={l} style={{ background: 'var(--c1)', borderRadius: 12, padding: '12px 14px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 10 }}><i className={'ti ' + ic + ' ariba-kpi-icon'} aria-hidden="true" style={{ fontSize: 22 }} /><span className="ariba-kpi-num" style={{ fontSize: 26, fontWeight: 900, color: 'var(--ariba-dark,#014D3D)', lineHeight: 1, minWidth: 28, textAlign: 'center' }}>{v}</span><span style={{ fontSize: 12, color: 'var(--mu)' }}>{l}</span></div>))}
          </div>
        </div>
      </div>
      <div className="g3">
        <div className="card"><div className="ch"><div className="ct"><i className="ti ti-chart-bar" /> <span>الرواتب حسب جهة العمل</span></div></div><div style={{ height: 160 }}><ChartCanvas id="cSal" type="bar" labels={Object.keys(m.byEmp)} data={Object.values(m.byEmp).map(Math.round)} colors={Object.keys(m.byEmp).map((x) => EMP_COLORS[x.trim()] || '#014D3D')} /></div></div>
        <div className="card"><div className="ch"><div className="ct"><i className="ti ti-chart-donut" /> <span>الجنسيات</span></div></div><div style={{ height: 160 }}><ChartCanvas id="cNat" type="doughnut" labels={Object.keys(m.natMap)} data={Object.values(m.natMap)} colors={Object.keys(m.natMap).map((x) => NAT_COLORS[x.trim()] || '#9CA3AF')} /></div></div>
        <div className="card"><div className="ch"><div className="ct"><i className="ti ti-building" /> <span>جهات العمل</span></div></div><div style={{ height: 160 }}><ChartCanvas id="cEmp" type="doughnut" labels={Object.keys(m.empMap)} data={Object.values(m.empMap)} colors={Object.keys(m.empMap).map((x) => EMP_COLORS[x.trim()] || '#014D3D')} /></div></div>
      </div>
      <div className="g2">
        <div className="card"><div className="ch"><div className="ct"><i className="ti ti-alert-triangle" style={{ color: 'var(--rd)' }} /> <span>تنبيهات عاجلة</span></div><span className="b br" id="AC">{alerts.length}</span></div>
          <div id="AL" style={{ maxHeight: 200, overflowY: 'auto' }}>
            {alerts.length ? alerts.slice(0, 40).map((al, i) => { const c = al.n < 0 ? 'var(--rd)' : al.n <= 14 ? 'var(--rd)' : al.n <= 30 ? 'var(--am)' : '#f59e0b';
              return <div key={i} style={{ padding: '8px 10px', borderInlineStart: '3px solid ' + c, marginBottom: 4, background: c + '14', borderRadius: 4, fontSize: 12, color: c }}>⚠ <b>{String((h ? (al.e.nameEn || al.e.nameAr) : (al.e.nameAr || al.e.nameEn)) || al.e.id || '').split(' ').slice(0, 3).join(' ')}</b> — {al.label}: {dmy(al.d)} <span style={{ opacity: .9 }}>({al.n < 0 ? (h ? 'expired ' + (-al.n) + ' days ago' : 'منتهي من ' + (-al.n) + ' يوم') : al.n === 0 ? (h ? 'today' : 'النهارده') : (h ? al.n + ' days left' : 'باقي ' + al.n + ' يوم')})</span></div>; })
              : <div style={{ padding: 20, textAlign: 'center', color: 'var(--mu)', fontSize: 13 }}>{h ? 'No urgent alerts' : 'لا توجد تنبيهات عاجلة'}</div>}
          </div></div>
        <div className="card"><div className="ch"><div className="ct"><i className="ti ti-chart-pie-2" /> <span>الأقسام</span></div></div><div style={{ height: 180 }}><ChartCanvas id="cDept" type="doughnut" labels={Object.keys(m.deptMap)} data={Object.values(m.deptMap)} colors={Object.keys(m.deptMap).map((x, i) => DEPT_COLORS[i % DEPT_COLORS.length])} /></div></div>
      </div>
      <div className="g2">
        <div className="card"><div className="ch"><div className="ct"><i className="ti ti-clock" /> <span>طلبات معلقة</span></div></div>
          <div id="PL" style={{ maxHeight: 200, overflowY: 'auto' }}>
            {!queue.length ? <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 14, fontSize: 12 }}>✓ لا توجد طلبات سحابية معلقة حاليًا</div>
              : queue.slice(0, 15).map((x, i) => { const r = x.request || {}, e = x.employee || {}; return <div key={i} style={{ padding: '8px 10px', borderBottom: '1px solid var(--bd)', fontSize: 12 }}><strong>{e.nameAr || e.nameEn || r.employee_id || '—'}</strong> — {r.request_type || 'طلب'} <span style={{ color: 'var(--mu)' }}>({stageTxt(r.current_stage)})</span></div>; })}
          </div></div>
        <div className="card"><div className="ch"><div className="ct"><i className="ti ti-cash" /> <span>ملخص الرواتب</span></div></div>
          <div id="PS">
            {!a.length ? <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 14, fontSize: 12 }}>لا توجد بيانات رواتب حالياً</div> : <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12 }}><span style={{ color: 'var(--mu)' }}>عدد الموظفين</span><strong>{a.length}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, borderTop: '1px solid var(--bd)' }}><span style={{ color: 'var(--mu)' }}>إجمالي الرواتب</span><strong style={{ color: 'var(--gr)' }}>{fmt(m.totalGross)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, borderTop: '1px solid var(--bd)' }}><span style={{ color: 'var(--mu)' }}>إجمالي الصافي</span><strong style={{ color: 'var(--cy)' }}>{fmt(m.totalNet)}</strong></div></>}
          </div></div>
      </div>
    </div>
  );
}
