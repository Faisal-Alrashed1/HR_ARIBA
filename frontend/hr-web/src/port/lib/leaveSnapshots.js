// ADAPTED: see syncLeaveSnapshots below.
// مزامنة أرقام رصيد الإجازة المحفوظة في بيانات كل موظف (اللي بيعرضها تطبيق الموظف وبطاقة الموظف)
// مع محرك الأرصدة — بحيث تتبع "طريقة احتساب الاستحقاق" و"ترحيل الأرصدة" المختارة من الإعدادات.
import { useEffect, useRef } from 'react';
import { useApp, usePerm } from '../store/AppStore.jsx';
import { rt } from '../engines/runtime.js';
import * as L from '../engines/leave.js';

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/** القيم المحسوبة بالمحرك لموظف واحد (بنفس أسماء الحقول اللي بيقرأها تطبيق الموظف) */
export function leaveSnapshot(e) {
  const cy = new Date().getFullYear();
  // calc: معطيات المعادلة اللي تطبيق الموظف بيستخدمها عشان يكمّل الاستحقاق يوم بيوم بنفس المحرك
  const calc = { method: rt.leaveAccrual || 'calendar', country: rt.country || 'SA', annual: L.leaveAnnual(e) };
  if (calc.country === 'EG' && rt.egRules) calc.egRules = rt.egRules;
  return {
    leaveCalc: calc,
    leaveBalance: r2(L.leaveCurrentBalance(e)),
    leaveYearEnd: r2(L.leaveProjectedYearEnd(e, cy)),
    leaveCarryover: r2(L.leaveCarryForward(e, cy)),
    leaveTotalSinceStart: r2(L.leaveCumulativeAccruedToToday(e)),
    leaveUsedSinceStart: r2(L.leaveCumulativeUsedToToday(e)),
    leaveAvailableSinceStart: r2(L.leaveCumulativeBalanceToToday(e)),
    leaveEosExcess: r2(L.leaveAccumulatedEos(e, cy)),
  };
}

// حالة آخر مزامنة (بتظهر في صفحة الأرصدة عشان تعرف إن تطبيق الموظف متربط)
export const syncState = { at: null, ok: null, saved: 0, total: 0, mode: '', error: '' };
const subs = new Set(); export const onSyncState = (f) => { subs.add(f); return () => subs.delete(f); };
const emit = (p) => { Object.assign(syncState, p, { at: new Date() }); subs.forEach((f) => { try { f({ ...syncState }); } catch { /* ignore */ } }); };

/** ADAPTED (decision 4): nothing is sent from the browser — the server computes every balance with the same engine
 *  (tools/react-parity checks it), so the Employee App already shows these numbers. Kept for the badge on Balances. */
export async function syncLeaveSnapshots(employees) {
  const list = (employees || []).filter((e) => e && !e.isTerminated && e.contractJoin);
  emit({ ok: true, saved: 0, total: list.length, mode: 'server', error: '' });
  return 0;
}

/** يشتغل في الخلفية لمسؤول الموارد (صلاحية تعديل الموظفين أو الإجازات) بعد كل تحميل أو تغيير إعداد */
export function useLeaveSnapshotSync() {
  const { employees, settings, loading, rev } = useApp(); const perm = usePerm();
  const allowed = perm.edit('employees') || perm.edit('leaves');
  const running = useRef(false), lastKey = useRef('');
  const key = JSON.stringify([settings && settings.accrual, settings && settings.carry, settings && settings.country]);
  useEffect(() => {
    if (!allowed || loading || !employees || !employees.length || running.current) return;
    const today = new Date().toISOString().slice(0, 10);
    const k = key + '|' + today + '|' + rev;
    if (k === lastKey.current) return; lastKey.current = k;
    running.current = true; let fired = false;
    const t = setTimeout(() => { fired = true; syncLeaveSnapshots(employees).finally(() => { running.current = false; }); }, 1500);
    return () => { if (!fired) { clearTimeout(t); running.current = false; lastKey.current = ''; } };
  }, [allowed, loading, employees, key, rev]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function LeaveSnapshotSync() { useLeaveSnapshotSync(); return null; }
