import { useCallback, useEffect, useState } from 'react';
import { toast } from '../components/Toast.jsx';
import { listTargets, saveTarget, deleteTarget, pct, keyLabel, PT } from '../lib/goals.js';
import PeriodPick from './PeriodPick.jsx';

const bar = (p) => <div style={{ height: 7, background: 'rgba(120,140,160,.25)', borderRadius: 5, overflow: 'hidden', minWidth: 80 }}><div style={{ width: (p || 0) + '%', height: '100%', background: p >= 90 ? '#16a34a' : p >= 60 ? '#d99a00' : '#dc2626' }} /></div>;
const blank = { title: '', description: '', unit: '', target_value: '', actual_value: '', weight: 1 };

/** مستهدفات موظف واحد: عرض/إضافة/تعديل/حذف حسب الفترة (للمدير أو الرئيس التنفيذي أو HR) */
export default function TargetsEditor({ employee, type, keyv, onPeriod }) {
  const [rows, setRows] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false);
  const year = keyv.slice(0, 4);
  const load = useCallback(() => listTargets(employee.id, year).then(setRows).catch((e) => { setRows([]); toast(e.message, 'ter'); }), [employee.id, year]);
  useEffect(() => { setRows(null); load(); }, [load]);
  const shown = (rows || []).filter((t) => t.period_type === type && t.period_key === keyv);
  const others = (rows || []).filter((t) => !(t.period_type === type && t.period_key === keyv));
  async function save() {
    if (!form.title.trim()) return toast('اكتب عنوان المستهدف', 'ter');
    setBusy(true);
    try { await saveTarget({ ...form, employee_id: String(employee.id), period_type: type, period_key: keyv }); toast('✓ حُفظ المستهدف' + (form.id ? '' : ' وأُشعر الموظف'), 'tin'); setForm(null); await load(); }
    catch (e) { toast(e.message || 'تعذر الحفظ', 'ter'); } finally { setBusy(false); }
  }
  async function del(t) { if (!window.confirm('حذف المستهدف؟')) return; try { await deleteTarget(t.id); await load(); } catch (e) { toast(e.message, 'ter'); } }
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div id="TG_BOX">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <PeriodPick type={type} keyv={keyv} onChange={onPeriod} />
        <button className="btn bpl bsm" id="TG_ADD" style={{ marginInlineStart: 'auto' }} onClick={() => setForm({ ...blank })}>+ مستهدف جديد</button>
      </div>
      {rows === null && <div style={{ color: 'var(--mu)', padding: 14 }}>…</div>}
      {rows && !shown.length && <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 18, fontSize: 13 }}>لا مستهدفات ({PT[type]} — {keyLabel(type, keyv)}) لـ {employee.nameAr}</div>}
      {shown.map((t) => { const p = pct(t); return (
        <div key={t.id} className="tg-row" style={{ padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}><b style={{ fontSize: 13 }}>{t.title}</b>{t.status === 'done' && <span className="b bg" style={{ marginInlineStart: 6 }}>منجز</span>}
              <div style={{ fontSize: 11, color: 'var(--mu)' }}>{t.description}</div>
              <div style={{ fontSize: 11, color: 'var(--mu)' }}>المطلوب: {t.target_value ?? '—'} {t.unit || ''} · المنجز: {t.actual_value ?? 0} · الوزن {t.weight}</div></div>
            <div style={{ width: 120 }}>{p != null && <><div style={{ fontSize: 11, textAlign: 'center' }}>{p}%</div>{bar(p)}</>}</div>
            <button className="btn bsm" onClick={() => setForm({ ...t, target_value: t.target_value ?? '', actual_value: t.actual_value ?? '', description: t.description || '', unit: t.unit || '' })}>تعديل</button>
            <button className="btn bsm" style={{ color: 'var(--rd)' }} onClick={() => del(t)}>حذف</button>
          </div></div>); })}
      {others.length > 0 && <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 8 }}>مستهدفات أخرى هذا العام: {others.length} (غيّر الفترة لعرضها)</div>}
      {form && (
        <div style={{ marginTop: 12, border: '1px solid var(--bd)', borderRadius: 10, padding: 12, background: 'var(--c2)' }} id="TG_FORM">
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>{form.id ? 'تعديل مستهدف' : 'مستهدف جديد'} — {PT[type]} {keyLabel(type, keyv)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ gridColumn: '1/-1' }}><label>العنوان *</label><input id="TG_TITLE" value={form.title} onChange={f('title')} style={{ width: '100%' }} /></div>
            <div style={{ gridColumn: '1/-1' }}><label>الوصف</label><input value={form.description} onChange={f('description')} style={{ width: '100%' }} /></div>
            <div><label>القيمة المستهدفة</label><input id="TG_TARGET" type="number" step="any" value={form.target_value} onChange={f('target_value')} style={{ width: '100%' }} /></div>
            <div><label>الوحدة (عميل، ريال، %…)</label><input value={form.unit} onChange={f('unit')} style={{ width: '100%' }} /></div>
            <div><label>المنجز حتى الآن</label><input type="number" step="any" value={form.actual_value} onChange={f('actual_value')} style={{ width: '100%' }} /></div>
            <div><label>الوزن (الأهمية)</label><input type="number" min="0.1" step="0.1" value={form.weight} onChange={f('weight')} style={{ width: '100%' }} /></div>
            {form.id && <div><label>الحالة</label><select value={form.status || 'active'} onChange={f('status')} style={{ width: '100%' }}><option value="active">نشط</option><option value="done">منجز</option></select></div>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button className="btn bpl" id="TG_SAVE" disabled={busy} onClick={save}>حفظ</button><button className="btn" onClick={() => setForm(null)}>إلغاء</button></div>
        </div>)}
    </div>
  );
}
