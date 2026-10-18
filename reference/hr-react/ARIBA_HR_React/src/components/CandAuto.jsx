import { useEffect, useRef } from 'react';
import { useApp, usePerm } from '../store/AppStore.jsx';
import { rpc } from '../lib/api.js';
import { toast } from './Toast.jsx';
import { acceptCandidate, getAutoCfg } from '../lib/candidates.js';

/** يسجّل المرشحين الجدد تلقائياً كموظفين لو الخيار شغّال (أثناء فتح البرنامج عند مسؤول موارد بشرية) */
export default function CandAuto() {
  const { employees, reload } = useApp(); const can = usePerm().edit('employees_admin') || usePerm().edit('employees');
  const emps = useRef(employees); emps.current = employees; const busy = useRef(false);
  useEffect(() => {
    if (!can) return undefined;
    const tick = async () => {
      if (busy.current || document.visibilityState !== 'visible') return; busy.current = true;
      try {
        const cfg = await getAutoCfg(); if (!cfg.on || !cfg.em) return;
        const d = await rpc('ariba_hr_candidates', { p_status: 'new' }); let n = 0;
        for (const c of (d.candidates || [])) {
          try { await acceptCandidate(c, { em: cfg.em, dep: cfg.dep || 'التشغيل', jt: c.data.position || '', nature: cfg.nature || 'indefinite', cj: new Date().toISOString().slice(0, 10), dur: '12', sal: c.data.expectedSalary || '', note: 'تسجيل تلقائي' }, emps.current); n++; } catch { /* يبقى بانتظار المراجعة اليدوية */ }
        }
        if (n) { toast('✅ اتسجّل ' + n + ' موظف جديد تلقائياً من طلبات التوظيف', 'tin'); await reload({ silent: true }); }
      } catch { /* ignore */ } finally { busy.current = false; }
    };
    const t0 = setTimeout(tick, 8000), iv = setInterval(tick, 60000); return () => { clearTimeout(t0); clearInterval(iv); };
  }, [can, reload]);
  return null;
}
