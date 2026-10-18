import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { friendly } from '../../components/Toast.jsx';
import { modName, flush, auditList } from '../../lib/audit.js';
import Modal from '../../components/Modal.jsx';
import { AuditTable, auditXlsx, auditPrint } from './index.jsx';

/** زر «سجل التعديلات» أعلى كل صفحة: بيفتح نافذة بتعديلات القسم ده بس (V132) */
export const PAGE_MODS = { emps: ['employees'], att: ['attendance'], pay: ['payroll'], slip: ['payroll'], eos: ['settlement', 'eos'], eoscalc: ['settlement', 'eos'], lv: ['leaves', 'requests'], loc: ['locations'], docs: ['documents'], forms: ['documents'], set: ['settings', 'security', 'locations'] };
export default function SectionAudit({ page }) {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a); const { settings } = useApp();
  const mods = PAGE_MODS[page]; const [open, setOpen] = useState(false), [rows, setRows] = useState(null), [msg, setMsg] = useState('');
  useEffect(() => {
    if (!open) return; let off = false; setRows(null); setMsg('');
    (async () => { await flush(); try { const r = await auditList({ limit: 300, modules: mods }); if (!off) setRows((r && r.rows) || []); } catch (e) { if (!off) { setRows([]); setMsg(friendly(e.message || e)); } } })();
    return () => { off = true; };
  }, [open]); // eslint-disable-line
  if (!mods) return null;
  const title = T('سجل التعديلات — ', 'Audit log — ') + mods.map((m) => modName(m, en)).join(' / ');
  return (
    <>
      <div className="a132-btn" data-l={en ? 'en' : 'ar'} style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 16px 0' }}>
        <button type="button" className="btn bgr bsm" onClick={() => setOpen(true)}><i className="ti ti-history" /> {T('سجل التعديلات', 'Audit log')}</button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={'🕘 ' + title} width={1100}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button type="button" className="btn bgr bsm" onClick={() => auditPrint(rows || [], en, settings)}><i className="ti ti-printer" /></button>
          <button type="button" className="btn bgr bsm" onClick={() => auditXlsx(rows || [], en)}>Excel</button>
        </div>
        <div style={{ maxHeight: '64vh', overflow: 'auto' }}>
          {rows === null ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--mu)' }}>{T('جاري التحميل…', 'Loading…')}</div>
            : msg ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--rd)' }}>{msg}</div> : <AuditTable rows={rows} en={en} />}
        </div>
      </Modal>
    </>
  );
}
