import { useEffect, useState } from 'react';
import { rpc } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { useLang } from '../lib/i18n.js';
import { T, lvName, calendarDays } from './util.jsx';
import { statusOf, reqDetail } from './Leaves.jsx';
import TargetsEditor from '../goals/TargetsEditor.jsx';
import EvalForm from '../goals/EvalForm.jsx';
import { curKey } from '../lib/goals.js';
import { useEmp } from './EmpStore.jsx';
import { accrualSinceSnapshot } from './liveLeave.js';

/** فريق المدير المباشر حسب الصلاحيات التي تحددها الموارد البشرية + التقديم بالنيابة (بعد تفويض الموظف) */
export default function MgrTeam() {
  useLang(); const { me } = useEmp();
  const [perms, setPerms] = useState(null), [team, setTeam] = useState(null), [reqs, setReqs] = useState(null), [onb, setOnb] = useState(null), [goal, setGoal] = useState(null);
  const load = async () => {
    try {
      const p = await rpc('ariba_mgr_my_perms', {}); setPerms(p);
      if (!p.is_manager) return;
      if (p.perms.view_team) rpc('ariba_mgr_team', {}).then(async (d) => {
        const t = d.team || [];
        // رصيد كل عضو = نفس رقم برنامج الموارد البشرية (sql/19) + الاستحقاق من تاريخ الحساب لحد النهارده
        try {
          const sn = await rpc('ariba_mgr_team_leave_snapshots', {}); const hol = (me && me.holidays) || [];
          t.forEach((x) => { const v = sn && sn[String(x.id)]; if (x.info && v && v.leaveBalance != null) { let dd = 0; try { dd = accrualSinceSnapshot({ id: x.id, ...v }, hol); } catch { dd = 0; } x.info.leaveBalance = Math.round((Number(v.leaveBalance) + dd) * 100) / 100; } });
        } catch { /* sql/19 لسه ما اتشغلش */ }
        setTeam(t);
      }).catch(() => setTeam([]));
      if (p.perms.view_team_requests) rpc('ariba_mgr_team_requests', {}).then((d) => setReqs(d.requests || [])).catch(() => setReqs([]));
    } catch { setPerms({ is_manager: false }); }
  };
  useEffect(() => { load(); }, []);
  if (!perms || !perms.is_manager) return null;
  const P = perms.perms || {};
  return (
    <>
      {P.view_team && (
        <div className="card" id="mgrTeam">
          <div className="card-title">👥 {T('بيانات فريقي', 'My team data')} {team && <span className="b ba">{team.length}</span>}</div>
          {team === null && <div style={{ color: 'var(--mu)', padding: 12 }}>…</div>}
          {team && team.map((x) => (
            <details key={x.id} style={{ borderBottom: '1px solid var(--bd)', padding: '8px 0' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>{x.nameAr} <span style={{ color: 'var(--mu)', fontWeight: 400 }}>— {x.jobTitle || ''}</span>{x.delegated && <span className="b bg" style={{ marginInlineStart: 6 }}>{T('فوّضك', 'Delegated')}</span>}</summary>
              <div style={{ fontSize: 11.5, lineHeight: 1.9, color: 'var(--mu)', marginTop: 6 }}>
                {x.info && <div>{T('الجنسية', 'Nationality')}: {x.info.nationality || '—'} | {T('تاريخ المباشرة', 'Join date')}: {x.info.joinDate || '—'} | {T('انتهاء العقد', 'Contract end')}: {x.info.contractEnd || '—'} | {T('انتهاء الإقامة', 'ID expiry')}: {x.info.iqamaExpiry || '—'}{x.info.leaveBalance != null && <> | {T('رصيد الإجازة', 'Leave balance')}: {String(x.info.leaveBalance)}</>}</div>}
                {x.salary && <div>{T('إجمالي الراتب', 'Total salary')}: {x.salary.salaryTotal != null ? Number(x.salary.salaryTotal).toLocaleString('en-US') : '—'}</div>}
                {x.leaves && (x.leaves.length ? x.leaves.map((l) => <div key={l.id}>• {lvName(l.type)} {l.from} ← {l.to} ({l.days} {T('يوم', 'd')}) — {l.status}</div>) : <div>{T('لا إجازات خلال 12 شهراً', 'No leaves in 12 months')}</div>)}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>{P.manage_targets && <button className="btn bsm" onClick={() => setGoal({ emp: x, mode: 'goals' })}>🎯 {T('المستهدفات', 'Targets')}</button>}{P.evaluate_team && <button className="btn bsm" onClick={() => setGoal({ emp: x, mode: 'eval' })}>⭐ {T('التقييم', 'Evaluation')}</button>}</div>
                {P.submit_for_team && x.delegated && <button className="btn bsm btn-primary" style={{ marginTop: 6 }} onClick={() => setOnb(x)}>📝 {T('تقديم طلب نيابةً عنه', 'Submit a request for him')}</button>}
                {P.submit_for_team && !x.delegated && <div style={{ fontSize: 10 }}>{T('لم يفعّل الموظف «تفويض المدير المباشر» بعد.', 'Employee has not enabled delegation yet.')}</div>}
              </div>
            </details>))}
          {team && !team.length && <div style={{ color: 'var(--mu)', padding: 12, textAlign: 'center' }}>{T('لا موظفين تحت إدارتك', 'No team members')}</div>}
        </div>)}
      {P.view_team_requests && reqs && (
        <div className="card" id="mgrReqs">
          <div className="card-title">📋 {T('طلبات فريقي وحالتها', 'Team requests & status')}</div>
          {!reqs.length && <div style={{ color: 'var(--mu)', padding: 12, textAlign: 'center' }}>{T('لا طلبات', 'No requests')}</div>}
          {reqs.slice(0, 40).map((r) => { const st = statusOf(r); return (
            <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--bd)', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{r.employee_name} — {lvName(r.request_type)}</strong><span className={'b ' + st[1]}>{st[0]}</span></div>
              <div style={{ fontSize: 11, color: 'var(--mu)' }}>{reqDetail(r)}</div>
              {r.status === 'rejected' && r.rejection_reason && <div style={{ fontSize: 11, color: 'var(--rd)' }}>❌ {r.rejection_reason}</div>}
            </div>); })}
        </div>)}
      {goal && <GoalOverlay g={goal} onClose={() => setGoal(null)} />}
      {onb && <OnBehalf emp={onb} onClose={() => setOnb(null)} onDone={() => { setOnb(null); load(); }} />}
    </>
  );
}

function OnBehalf({ emp, onClose, onDone }) {
  const [type, setType] = useState('annual'), [from, setFrom] = useState(''), [to, setTo] = useState(''), [amount, setAmount] = useState(''), [notes, setNotes] = useState(''), [busy, setBusy] = useState(false);
  const adv = type === 'salary_advance';
  async function go() {
    const p = { notes, type };
    if (adv) { p.amount = parseFloat(amount || 0); if (!(p.amount > 0)) return toast(T('أدخل المبلغ', 'Enter the amount'), 'ter'); }
    else { if (!from || !to || to < from) return toast(T('حدد الفترة', 'Select the period'), 'ter'); p.from = from; p.to = to; p.days = calendarDays(from, to); }
    setBusy(true);
    try { await rpc('ariba_submit_request_for', { p_employee_id: String(emp.id), p_type: type, p_payload: p }); toast('✅ ' + T('قُدّم الطلب نيابةً عن الموظف — أُبلغت الموارد البشرية والموظف', 'Submitted on his behalf — HR and the employee were notified'), 'tin'); onDone(); }
    catch (e) { toast(e.message || T('تعذر الإرسال', 'Could not submit'), 'ter'); } finally { setBusy(false); }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="card-title">📝 {T('طلب نيابةً عن ', 'Request on behalf of ')}{emp.nameAr}</div>
        <label>{T('النوع', 'Type')}</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>{['annual', 'sick', 'emergency', 'unpaid', 'salary_advance'].map((k) => <option key={k} value={k}>{lvName(k)}</option>)}</select>
        {adv ? <><label>{T('المبلغ', 'Amount')}</label><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></>
          : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}><div><label>{T('من', 'From')}</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div><div><label>{T('إلى', 'To')}</label><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></div></div>}
        <label>{T('ملاحظات / السبب', 'Notes / reason')}</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={go}>{T('إرسال', 'Submit')}</button><button className="btn" onClick={onClose}>{T('إلغاء', 'Cancel')}</button></div>
      </div>
    </div>
  );
}

function GoalOverlay({ g, onClose }) {
  const [type, setType] = useState('quarterly'), [key, setKey] = useState(curKey('quarterly'));
  const emp = { id: g.emp.id, nameAr: g.emp.nameAr };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(0,0,0,.55)', overflow: 'auto', padding: 10 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 640, margin: '10px auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{g.mode === 'eval' ? '⭐ ' + T('تقييم ', 'Evaluate ') : '🎯 ' + T('مستهدفات ', 'Targets of ')}{emp.nameAr}</span><button className="btn bsm" onClick={onClose}>✕</button></div>
        {g.mode === 'eval' ? <EvalForm key={type + key} employee={emp} type={type} keyv={key} onPeriod={(t, k) => { setType(t); setKey(k); }} /> : <TargetsEditor employee={emp} type={type} keyv={key} onPeriod={(t, k) => { setType(t); setKey(k); }} />}
      </div>
    </div>
  );
}
