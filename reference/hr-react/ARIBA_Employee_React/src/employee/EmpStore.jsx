import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { rpc } from '../lib/api.js';
import * as auth from '../lib/auth.js';
import { num } from './util.jsx';
import { applyLive } from './liveLeave.js';

const Ctx = createContext(null);
export const useEmp = () => useContext(Ctx);

/** يبني كائن الموظف (ME) من استجابة ariba_employee_context — نفس تجميع الحقول في النسخة القديمة */
// أرقام الرصيد اللي حسبها برنامج الموارد البشرية (sql/19 — ariba_my_leave_snapshot) لها الأولوية على أي رقم تاني
const SNAP_KEYS = ['leaveBalance', 'leaveYearEnd', 'leaveCarryover', 'leaveTotalSinceStart', 'leaveUsedSinceStart', 'leaveAvailableSinceStart', 'leaveEosExcess', 'leaveCalc', 'leaveSnapshotAt'];
export function buildMe(c) {
  let e = c && c.employee; if (!e) return null;
  const sn = c.leaveSnap;
  if (sn && typeof sn === 'object' && sn.leaveBalance != null) { e = { ...e }; SNAP_KEYS.forEach((k) => { if (sn[k] !== undefined) e[k] = sn[k]; }); if (!e.contractJoin && sn.contractJoin) e.contractJoin = sn.contractJoin; if (!e.dob && sn.dob) e.dob = sn.dob; }
  const A = (...v) => { for (const x of v) if (x !== undefined && x !== null && x !== '') return x; return ''; };
  return applyLive({
    id: String(e.id), username: A(e.username, e.u), name: A(e.nameAr, e.na, e.name), name_en: A(e.nameEn, e.ne, e.name_en),
    employer: A(e.employer, e.em), job: A(e.jobTitle, e.jt, e.job), dept: A(e.dept, e.dep, e.department), nationality: A(e.nationality, e.nat),
    salary: num(A(e.salary, e.sal)), hou: num(A(e.housingAllowance, e.hou)), tra: num(A(e.transportAllowance, e.tra)), prj: num(A(e.projectAllowance, e.prj)),
    oth: num(A(e.otherAllowance, e.oth)), natureAllowance: num(e.natureAllowance),
    salaryTotal: num(A(e.salaryTotal, e.salary_total, e.total)), insuranceSub: num(A(e.insuranceSub, e.insEmp)),
    net: num(A(e.netSalary, e.net, e.nsar, e.netSalarySAR)),
    leave_bal: e.leaveBalance != null ? num(e.leaveBalance) : (e.lb != null ? num(e.lb) : 0),
    leaveYearEnd: e.leaveYearEnd != null ? num(e.leaveYearEnd) : (e.leave_year_end != null ? num(e.leave_year_end) : null),
    leave_carry: num(A(e.leaveCarryover, e.leave_carryover)), leaveTotalSinceStart: num(e.leaveTotalSinceStart), leaveUsedSinceStart: num(e.leaveUsedSinceStart),
    leaveAvailableSinceStart: num(e.leaveAvailableSinceStart), leaveEosExcess: num(e.leaveEosExcess),
    remote_used: num(e.remoteDaysUsed), remote_limit: 10,
    mgr_id: String(A(e.managerId, e.manager_id)), iqama: A(e.iqamaNo, e.iq), iqama_exp: A(e.iqamaExpiry, e.iqe),
    join: A(e.contractJoin, e.cj), end: A(e.contractEnd, e.ce), contractNature: A(e.contractNature, e.contract_nature), contractDuration: A(e.contractDuration, e.dur),
    mobile: A(e.mobile, e.mb), email: A(e.email, e.ml), iban: A(e.iban, e.ib, e.bk), dob: A(e.dob),
    empNo: A(e.empNo, e.emp_no, e.id), photoUrl: A(e.photoUrl, e.photo_url),
    managerName: (c.manager && (c.manager.nameAr || c.manager.nameEn)) || '',
    workLocationIds: Array.isArray(e.workLocationIds) ? e.workLocationIds.filter(Boolean) : [],
    role: c.role || 'employee',
    notifications: c.notifications || [], requests: c.requests || [], locations: c.locations || [], team: c.team || [],
    payroll: Array.isArray(c.payroll) ? c.payroll : [], attendance: Array.isArray(c.attendance) ? c.attendance : [],
    documents: Array.isArray(c.documents) ? c.documents : [], holidays: Array.isArray(c.holidays) ? c.holidays : [],
  }, e, Array.isArray(c.holidays) ? c.holidays : []);
}

const stable = (v) => { if (v === null || typeof v !== 'object') return v; if (Array.isArray(v)) return v.map(stable); const o = {}; Object.keys(v).sort().forEach((k) => { o[k] = stable(v[k]); }); return o; };
const sig = (c) => { try { return JSON.stringify(stable({ s: c.leaveSnap || null, e: c.employee, r: c.requests, n: c.notifications, a: c.attendance, t: c.team, l: c.locations, p: c.payroll, d: c.documents, h: c.holidays, m: c.manager })); } catch { return String(Math.random()); } };

const HK = 'ariba_emp_hidden_reqs';
const readHidden = () => { try { return JSON.parse(localStorage.getItem(HK) || '[]'); } catch { return []; } };

export function EmpProvider({ children }) {
  const [raw, setRaw] = useState(null);
  const [att, setAtt] = useState(null);          // إعدادات الدوام (الحضور المرن + حد العمل عن بعد)
  const [queue, setQueue] = useState([]);        // طلبات تنتظر موافقتي (مدير/موارد/رئيس تنفيذي)
  const [docsN, setDocsN] = useState(0);         // مستندات بانتظار توقيعي
  const [hidden, setHidden] = useState(readHidden);
  const [err, setErr] = useState('');
  const lastSig = useRef(''); const busy = useRef(false); const attAt = useRef(0);

  const loadQueue = useCallback(async (role) => {
    if (!(role === 'manager' || role === 'hr' || role === 'ceo')) { setQueue([]); return; }
    try { const d = await rpc('ariba_staff_queue', {}); setQueue((d && d.queue) || []); } catch { setQueue([]); }
  }, []);
  const loadDocsN = useCallback(async () => { try { const l = await rpc('ariba_employee_pending_templates', {}); setDocsN(Array.isArray(l) ? l.length : 0); } catch { /* ignore */ } }, []);
  const loadAtt = useCallback(async (force) => {
    if (!force && att && Date.now() - attAt.current < 60000) return;
    attAt.current = Date.now();
    try { const r = await rpc('ariba_get_attendance_settings', {}); setAtt(r || {}); } catch { setAtt((a) => a || {}); }
  }, [att]);

  /** تحديث السياق من السيرفر. صامت: لا يعيد الرسم إلا إذا تغيّرت البيانات فعلًا */
  const reload = useCallback(async (force) => {
    if (busy.current && !force) return null; busy.current = true;
    try {
      const c = await rpc('ariba_employee_context', {});
      if (c && c.employee) { try { c.leaveSnap = await rpc('ariba_my_leave_snapshot', {}); } catch { c.leaveSnap = null; } }
      setErr('');
      if (c && c.employee) { const s = sig(c); if (s !== lastSig.current || force) { lastSig.current = s; setRaw(c); } loadQueue(c.role); }
      return c;
    } catch (e) { setErr(String(e.message || e)); return null; } finally { busy.current = false; }
  }, [loadQueue]);

  useEffect(() => { reload(true); loadDocsN(); loadAtt(true); }, []); // eslint-disable-line
  useEffect(() => {
    const iv = setInterval(() => { if (document.visibilityState === 'visible') { reload(); loadDocsN(); loadAtt(); } }, 15000);
    const wake = () => { if (document.visibilityState === 'visible') { reload(); loadDocsN(); } };
    document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake); window.addEventListener('focus', wake);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); window.removeEventListener('focus', wake); };
  }, [reload, loadDocsN, loadAtt]);

  const me = useMemo(() => {
    const m = buildMe(raw); if (!m) return null;
    if (att && att.remote_days_per_year != null && isFinite(Number(att.remote_days_per_year))) m.remote_limit = Number(att.remote_days_per_year);
    return m;
  }, [raw, att]);
  const hide = useCallback((id) => { const a = readHidden(); if (!a.includes(String(id))) a.push(String(id)); try { localStorage.setItem(HK, JSON.stringify(a)); } catch { /* ignore */ } setHidden(a); }, []);
  const hasApproval = !!me && (me.role === 'manager' || me.role === 'hr' || me.role === 'ceo');

  const value = useMemo(() => ({ me, raw, att, queue, docsN, hidden, hide, hasApproval, err, reload, loadQueue: () => loadQueue(me && me.role), loadDocsN, loadAtt, token: auth.state.token }),
    [me, raw, att, queue, docsN, hidden, hide, hasApproval, err, reload, loadQueue, loadDocsN, loadAtt]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
