import { useCallback, useEffect, useState } from 'react';
import { useApp, usePerm } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import PromptModal from '../../components/PromptModal.jsx';
import { fetchRequests, submitOvertime, fileToData, downloadDoc, wfApprove, wfReject } from '../../lib/leaves.js';
import { tod } from '../../lib/util.js';

export default function Overtime() {
  const h = useLang() === 'en';
  const { activeEmps } = useApp();
  const can = usePerm().edit('requests');
  const [f, setF] = useState({ emp: '', date: tod(), hours: 1, notes: '' }); const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null); const [dlg, setDlg] = useState(null); const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetchRequests().then((a) => setRows(a.filter((x) => String((x.request || {}).request_type || '') === 'overtime'))).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  async function submit() {
    const hours = parseFloat(f.hours) || 0;
    if (!f.emp || !f.date || hours <= 0) return toast('حدد الموظف والتاريخ وعدد الساعات', 'ter');
    setBusy(true);
    try { const att = await fileToData(file); await submitOvertime(f.emp, { date: f.date, hours, notes: f.notes }, att); toast('✓ تم إرسال طلب العمل الإضافي'); setF({ ...f, notes: '' }); setFile(null); await load(); }
    catch (e) { toast(e.message || 'تعذر إرسال طلب العمل الإضافي', 'ter'); } finally { setBusy(false); }
  }
  async function decide(d, reason) {
    try { if (d.kind === 'approve') await wfApprove(d.id, reason); else await wfReject(d.id, reason); toast(d.kind === 'approve' ? '✓ تمت الموافقة' : 'تم الرفض'); await load(); } catch (e) { toast(e.message || 'تعذر التنفيذ', 'ter'); }
  }
  const stage = (r) => ({ manager: 'بانتظار المدير المباشر', hr: 'بانتظار الموارد البشرية', ceo: 'بانتظار الرئيس التنفيذي' })[r.current_stage] || ({ approved: 'موافق', rejected: 'مرفوض' })[r.status] || 'مكتمل';
  return (
    <div id="lv6">
      {can && <div className="card" style={{ marginBottom: 10 }}>
        <div className="ch"><div className="ct"><i className="ti ti-clock-plus" /><span>طلب عمل إضافي</span></div></div>
        <div className="fg">
          <div><label>الموظف *</label><select value={f.emp} onChange={(e) => setF({ ...f, emp: e.target.value })}><option value="">اختر...</option>{activeEmps.map((e) => <option key={e.id} value={e.id}>{e.nameAr}</option>)}</select></div>
          <div><label>التاريخ *</label><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div><label>عدد الساعات *</label><input type="number" min="0.5" step="0.5" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
          <div className="ff"><label>السبب / المهمة</label><textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <div className="ff"><label>مرفق اختياري</label><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(e) => setFile(e.target.files[0] || null)} /></div>
        </div>
        <button className="btn bpl" style={{ marginTop: 10 }} disabled={busy} onClick={submit}><i className="ti ti-send" /> إرسال الطلب</button>
      </div>}
      <div className="card">
        <div className="ch"><div className="ct"><i className="ti ti-list-check" /><span>طلبات العمل الإضافي</span></div><button className="btn bpl bsm" onClick={load}>تحديث</button></div>
        {rows === null && <div style={{ padding: 25, textAlign: 'center', color: 'var(--mu)' }}>…</div>}
        {rows && !rows.length && <div style={{ padding: 25, textAlign: 'center', color: 'var(--mu)' }}>✓ لا توجد طلبات عمل إضافي</div>}
        {(rows || []).map((x) => { const r = x.request || {}, e = x.employee || {}, p = r.payload || {}; const pend = r.status === 'pending' && r.current_stage === 'hr'; return (
          <div key={r.id} style={{ padding: '12px 14px', borderBottom: '1px solid rgba(36,48,68,.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}><div style={{ fontWeight: 800, fontSize: 13 }}>{e.nameAr || e.nameEn || r.employee_id}</div><div style={{ fontSize: 11, color: 'var(--mu)' }}>{p.date} | {p.hours} ساعة{p.notes ? ' | ' + p.notes : ''}</div><div style={{ fontSize: 10, color: 'var(--dm)' }}>{stage(r)}</div></div>
              {can && pend && <><button className="btn bgl bsm" onClick={() => setDlg({ kind: 'approve', id: r.id })}>✓ موافقة</button><button className="btn bsm" style={{ color: 'var(--rd)' }} onClick={() => setDlg({ kind: 'reject', id: r.id })}>✗ رفض</button></>}
            </div>
            {(x.attachments || []).map((a) => <button key={a.id} className="btn bsm" style={{ color: 'var(--cy)', margin: 2 }} onClick={() => downloadDoc(a.id).catch((er) => toast(er.message, 'ter'))}>📎 {a.file_name || 'مرفق'}</button>)}
          </div>); })}
      </div>
      <PromptModal open={!!dlg} onClose={() => setDlg(null)} title={dlg && dlg.kind === 'approve' ? 'موافقة' : 'سبب الرفض'} label={dlg && dlg.kind === 'approve' ? 'ملاحظة (اختياري)' : 'السبب'} required={!!dlg && dlg.kind === 'reject'} danger={!!dlg && dlg.kind === 'reject'}
        onConfirm={(v) => { const d = dlg; setDlg(null); decide(d, v); }} />
    </div>
  );
}
