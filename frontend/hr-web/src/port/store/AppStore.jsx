import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchEmployees, fetchLeaves, fetchHolidays, fetchLocations, fetchSettings, runtimePatchFromSettings } from '../lib/data.js';
import { setRuntime, rt } from '../engines/runtime.js';
import * as auth from '../lib/auth.js';
import { startAudit } from '../lib/audit.js';
import { toast } from '../components/Toast.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [state, setState] = useState({ employees: [], leaves: [], holidays: [], locations: [], settings: {}, loading: true, error: null, rev: 0 });
  const busy = useRef(false);

  const reload = useCallback(async (opts = {}) => {
    if (busy.current) return; busy.current = true;
    if (!opts.silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [employees, leaves, holidays, locations, settings] = await Promise.all([
        fetchEmployees().catch((e) => { throw e; }),
        fetchLeaves().catch(() => []),
        fetchHolidays().catch(() => []),
        fetchLocations().catch(() => []),
        fetchSettings(),
      ]);
      setRuntime({ employees, leaves, holidays, ...runtimePatchFromSettings(settings) });
      setState((s) => ({ employees, leaves, holidays, locations, settings, loading: false, error: null, rev: s.rev + 1 }));
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message || String(e) }));
      if (!opts.silent) toast('تعذر تحميل البيانات: ' + (e.message || e), 'ter');
    } finally { busy.current = false; }
  }, []);

  useEffect(() => { startAudit(); }, []);
  useEffect(() => { reload(); const t = setInterval(() => reload({ silent: true }), 60000); return () => clearInterval(t); }, [reload]);
  useEffect(() => { const t = setInterval(() => auth.refreshPerms(), 300000); return () => clearInterval(t); }, []);

  const patchSettings = useCallback((key, value) => {
    setState((s) => {
      const settings = { ...s.settings, [key]: value };
      setRuntime(runtimePatchFromSettings(settings));
      return { ...s, settings, rev: s.rev + 1 };
    });
  }, []);
  const setEmployees = useCallback((fn) => setState((s) => { const employees = typeof fn === 'function' ? fn(s.employees) : fn; setRuntime({ employees }); return { ...s, employees, rev: s.rev + 1 }; }), []);
  const setLeaves = useCallback((fn) => setState((s) => { const leaves = typeof fn === 'function' ? fn(s.leaves) : fn; setRuntime({ leaves }); return { ...s, leaves, rev: s.rev + 1 }; }), []);
  const setHolidays = useCallback((holidays) => setState((s) => { setRuntime({ holidays }); return { ...s, holidays, rev: s.rev + 1 }; }), []);
  const setLocations = useCallback((locations) => setState((s) => ({ ...s, locations, rev: s.rev + 1 })), []);

  const value = useMemo(() => ({
    ...state, reload, patchSettings, setEmployees, setLeaves, setHolidays, setLocations,
    activeEmps: state.employees.filter((e) => !e.isTerminated && !e.term),
    terminatedEmps: state.employees.filter((e) => e.isTerminated),
    country: rt.country,
  }), [state, reload, patchSettings, setEmployees, setLeaves, setHolidays, setLocations]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** مستوى الصلاحية لوحدة: none | view | edit */
export function usePerm() {
  const v = auth.getVersion();
  return useMemo(() => {
    const P = auth.state.perms;
    const lvl = (m) => (!P || typeof P !== 'object') ? 'edit' : (P[m] || 'none');
    return { lvl, can: (m) => lvl(m) !== 'none', edit: (m) => lvl(m) === 'edit', role: auth.state.role, me: auth.state.me };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
}
