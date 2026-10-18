// مزامنة أرقام رصيد الإجازة المحفوظة في بيانات كل موظف (اللي بيعرضها تطبيق الموظف وبطاقة الموظف)
// مع محرك الأرصدة — بحيث تتبع "طريقة احتساب الاستحقاق" و"ترحيل الأرصدة" المختارة من الإعدادات.
import { useEffect, useRef } from 'react';
import { rpc } from './api.js';
import { employeePayload } from './employees.js';
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

const differs = (e, snap) => Object.keys(snap).some((k) => (k === 'leaveCalc'
  ? JSON.stringify(e.leaveCalc || null) !== JSON.stringify(snap.leaveCalc)
  : (e[k] === undefined || e[k] === null || Math.abs((Number(e[k]) || 0) - snap[k]) > 0.005)));
const ymdLocal = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// حالة آخر مزامنة (بتظهر في صفحة الأرصدة عشان تعرف إن تطبيق الموظف متربط)
export const syncState = { at: null, ok: null, saved: 0, total: 0, mode: '', error: '' };
const subs = new Set(); export const onSyncState = (f) => { subs.add(f); return () => subs.delete(f); };
const emit = (p) => { Object.assign(syncState, p, { at: new Date() }); subs.forEach((f) => { try { f({ ...syncState }); } catch { /* ignore */ } }); };
const NUMS = ['leaveBalance', 'leaveYearEnd', 'leaveCarryover', 'leaveTotalSinceStart', 'leaveUsedSinceStart', 'leaveAvailableSinceStart', 'leaveEosExcess'];
const sameSnap = (a, b) => !!a && NUMS.every((k) => a[k] !== undefined && a[k] !== null && Math.abs((Number(a[k]) || 0) - b[k]) <= 0.005) && JSON.stringify(a.leaveCalc || null) === JSON.stringify(b.leaveCalc);
const missingFn = (e) => /Could not find|schema cache|does not exist|PGRST202/i.test(String(e && e.message));

/** يحسب رصيد كل موظف بالمحرك ويحفظ اللي اتغيّر في جدول ariba_leave_snapshots (sql/19) — منه بيقرا تطبيق الموظف.
 *  لو sql/19 لسه ما اتشغلش، بيرجع للطريقة القديمة (حفظ الأرقام جوه بيانات الموظف). */
export async function syncLeaveSnapshots(employees) {
  const list = (employees || []).filter((e) => e && !e.isTerminated && e.contractJoin);
  const today = ymdLocal(new Date());
  let stored = null;
  try { stored = await rpc('ariba_hr_leave_snapshots', {}); } catch (e) { if (!missingFn(e)) { emit({ ok: false, error: e.message || String(e), mode: 'table' }); return 0; } }
  if (stored && typeof stored === 'object') {
    const rows = [];
    for (const e of list) {
      let snap; try { snap = leaveSnapshot(e); } catch { continue; }
      if (sameSnap(stored[String(e.id)], snap)) continue;
      rows.push({ employee_id: String(e.id), snap: { ...snap, leaveSnapshotAt: today, contractJoin: e.contractJoin, dob: e.dob || null } });
    }
    let saved = 0;
    try { for (let i = 0; i < rows.length; i += 40) { const r = await rpc('ariba_hr_set_leave_snapshots', { p_rows: rows.slice(i, i + 40) }); saved += (r && r.saved) || 0; } emit({ ok: true, saved, total: list.length, mode: 'table', error: '' }); }
    catch (e) { emit({ ok: false, saved, total: list.length, mode: 'table', error: e.message || String(e) }); }
    return saved;
  }
  // الطريقة القديمة (قبل sql/19)
  let n = 0;
  for (const e of list) {
    let snap; try { snap = leaveSnapshot(e); } catch { continue; }
    if (!differs(e, snap)) continue;
    try { await rpc('ariba_sync_employee', { p_employee: employeePayload({ ...e, ...snap, leaveSnapshotAt: today, leaveSnapshotMethod: rt.leaveAccrual || 'calendar' }) }); n++; } catch { /* نكمل الباقي */ }
  }
  emit({ ok: false, saved: n, total: list.length, mode: 'legacy', error: 'SQL19_MISSING' });
  return n;
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
