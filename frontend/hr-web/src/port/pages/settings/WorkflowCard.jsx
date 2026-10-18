import { useEffect, useState } from 'react';
import { T } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import { getWfConfig, setWfConfig, wfRunEscalation } from '../../lib/leaves.js';
import { Card, Note } from './shared.jsx';

const lb = { fontSize: 10, color: 'var(--mu)', display: 'block', marginBottom: 2 };
/** سير الطلبات: مهلة المدير المباشر / الرئيس التنفيذي، سقف الراتب المقدم، إيميلات إضافية للموارد البشرية */
export default function WorkflowCard() {
  const [c, setC] = useState(null); const [emails, setEmails] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { getWfConfig().then((x) => { setC(x); setEmails((x.extra_hr_emails || []).join(', ')); }).catch((e) => toast(e.message, 'ter')); }, []);
  if (!c) return <Card icon="route" title={T('سير الطلبات والمهل', 'Request workflow & timeouts')}><Note>…</Note></Card>;
  const set = (k, v) => setC((o) => ({ ...o, [k]: v }));
  async function save() {
    setBusy(true);
    try {
      const list = emails.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
      if (list.some((x) => !/^\S+@\S+\.\S+$/.test(x))) throw new Error(T('إيميل غير صحيح في القائمة', 'Invalid email in list'));
      const r = await setWfConfig({ manager_wait_days: Number(c.manager_wait_days) || 0, ceo_wait_days: Number(c.ceo_wait_days) || 0, advance_max_percent: Number(c.advance_max_percent) || 100, extra_hr_emails: list });
      setC(r.config); toast('✓ ' + T('اتحفظت إعدادات سير الطلبات', 'Workflow settings saved'), 'tin');
    } catch (e) { toast(e.message || T('تعذر الحفظ', 'Could not save'), 'ter'); } finally { setBusy(false); }
  }
  async function runNow() {
    try { const r = await wfRunEscalation(); toast(T('تم فحص المهل — طلبات نُقلت للموارد البشرية: ', 'Timeouts checked — requests moved to HR: ') + (r && r.escalated != null ? r.escalated : 0), 'tin'); }
    catch (e) { toast(e.message, 'ter'); }
  }
  return (
    <Card icon="route" title={T('سير الطلبات والمهل', 'Request workflow & timeouts')} id="WF_CARD">
      <Note style={{ marginBottom: 10 }}>{T('أي طلب موظف يصل للمدير المباشر وللموارد البشرية (تنبيه بالنظام + إيميل). لو تأخر المدير (أو الرئيس التنفيذي) أكثر من المهلة يصل الطلب رسمياً للموارد البشرية لقرار الموافقة أو الرفض (بسبب) أو الإرجاع للمدير. اكتب 0 لإلغاء المهلة.', 'Every employee request reaches the direct manager and HR (in-app + email). If the manager (or CEO) exceeds the wait time, the request officially moves to HR to approve, reject (with reason) or send back. Use 0 to disable the timeout.')}</Note>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><label style={lb}>{T('مهلة المدير المباشر (أيام)', 'Direct-manager wait (days)')}</label><input type="number" min="0" max="60" value={c.manager_wait_days ?? 0} onChange={(e) => set('manager_wait_days', e.target.value)} style={{ width: 120 }} /></div>
        <div><label style={lb}>{T('مهلة الرئيس التنفيذي / المعتمد الأعلى (أيام)', 'CEO / top approver wait (days)')}</label><input type="number" min="0" max="60" value={c.ceo_wait_days ?? 0} onChange={(e) => set('ceo_wait_days', e.target.value)} style={{ width: 120 }} /></div>
        <div><label style={lb}>{T('سقف الراتب المقدم (% من الراتب)', 'Salary-advance cap (% of salary)')}</label><input type="number" min="1" max="1000" value={c.advance_max_percent ?? 100} onChange={(e) => set('advance_max_percent', e.target.value)} style={{ width: 120 }} /></div>
      </div>
      <div style={{ marginTop: 10 }}><label style={lb}>{T('إيميلات إضافية تستقبل إشعارات الموارد البشرية (مفصولة بفاصلة)', 'Extra emails receiving HR notifications (comma separated)')}</label>
        <input type="text" dir="ltr" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="hr@company.com, finance@company.com" style={{ width: '100%' }} /></div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn bpl bsm" disabled={busy} onClick={save}><i className="ti ti-device-floppy" /> {T('حفظ', 'Save')}</button>
        <button className="btn bsm" onClick={runNow}><i className="ti ti-player-play" /> {T('فحص المهل الآن', 'Check timeouts now')}</button>
      </div>
      <Note style={{ marginTop: 8 }}>{T('الإجازة بدون راتب والراتب المقدم: الاعتماد النهائي من الموارد البشرية بعد المدير المباشر.', 'Unpaid leave & salary advance: HR gives final approval after the direct manager.')}</Note>
    </Card>
  );
}
