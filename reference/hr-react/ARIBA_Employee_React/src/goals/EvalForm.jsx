import { useCallback, useEffect, useState } from 'react';
import { toast } from '../components/Toast.jsx';
import { getEval, saveEval, approveEval, pct, ratingOf, keyLabel, PT } from '../lib/goals.js';
import PeriodPick from './PeriodPick.jsx';

const SB = { draft: ['ba', 'مسودة'], pending: ['bb', 'بانتظار الاعتماد'], approved: ['bg', 'معتمد'] };
const calc = (items) => { const tw = items.reduce((a, i) => a + (Number(i.weight) || 1), 0); return tw ? Math.round(items.reduce((a, i) => a + (Number(i.score) || 0) * (Number(i.weight) || 1), 0) / tw * 10) / 10 : null; };

/** تقييم موظف: يجلب مستهدفاته تلقائياً للفترة، ثم يقيَّم كل بند؛ حفظ مسودة ← إرسال للاعتماد ← اعتماد نهائي */
export default function EvalForm({ employee, type, keyv, onPeriod, onChanged }) {
  const [d, setD] = useState(null), [items, setItems] = useState([]), [comments, setComments] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setD(null);
    try {
      const r = await getEval(employee.id, type, keyv); setD(r);
      const ev = r.evaluation;
      if (ev && ev.items && ev.items.length) { setItems(ev.items); setComments(ev.comments || ''); }
      else { setItems((r.targets || []).map((t) => { const p = pct(t); return { target_id: t.id, title: t.title, target: t.target_value, unit: t.unit || '', actual: t.actual_value, weight: t.weight, score: p == null ? 0 : p, comment: '' }; })); setComments(''); }
    } catch (e) { setD({ error: e.message, targets: [] }); }
  }, [employee.id, type, keyv]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <div style={{ color: 'var(--mu)', padding: 14 }}>…</div>;
  if (d.error) return <div className="al alr">{d.error}</div>;
  const ev = d.evaluation, locked = ev && ev.status === 'approved', overall = calc(items);
  const up = (i, k, v) => setItems((a) => a.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const addManual = () => setItems((a) => [...a, { title: '', weight: 1, score: 0, comment: '', manual: true }]);
  async function act(submit) {
    setBusy(true);
    try { await saveEval(employee.id, type, keyv, items, comments, submit); toast(submit ? '✓ أُرسل التقييم للاعتماد' : '✓ حُفظت المسودة', 'tin'); await load(); onChanged && onChanged(); }
    catch (e) { toast(e.message || 'تعذر الحفظ', 'ter'); } finally { setBusy(false); }
  }
  async function approve() {
    if (!window.confirm('اعتماد التقييم نهائياً؟ سيصل الموظف إشعار وإيميل بالنتيجة.')) return;
    setBusy(true);
    try { await approveEval(ev.id); toast('✅ اعتُمد التقييم وأُرسلت النتيجة للموظف (إشعار + إيميل)', 'tin'); await load(); onChanged && onChanged(); }
    catch (e) { toast(e.message || 'تعذر الاعتماد', 'ter'); } finally { setBusy(false); }
  }
  return (
    <div id="EV_BOX">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <PeriodPick type={type} keyv={keyv} onChange={onPeriod} />
        {ev && <span className={'b ' + SB[ev.status][0]}>{SB[ev.status][1]}</span>}
        <span style={{ marginInlineStart: 'auto', fontSize: 12 }}>النتيجة الإجمالية: <b id="EV_OVERALL" style={{ fontSize: 16, color: 'var(--gr)' }}>{overall == null ? '—' : overall + '%'}</b> {overall != null && <span className="b bg">{ratingOf(overall)}</span>}</span>
      </div>
      {!items.length && <div className="al alb">لا مستهدفات للفترة {PT[type]} {keyLabel(type, keyv)} — أضف مستهدفات من تبويب المستهدفات أو أضف بنداً يدوياً.</div>}
      {items.map((it, i) => (
        <div key={i} className="ev-item" style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {it.manual ? <input placeholder="عنوان البند" value={it.title} disabled={locked} onChange={(e) => up(i, 'title', e.target.value)} style={{ flex: 1, minWidth: 160 }} /> : <b style={{ flex: 1, minWidth: 160, fontSize: 13 }}>{it.title}</b>}
            {!it.manual && <span style={{ fontSize: 11, color: 'var(--mu)' }}>المطلوب {it.target ?? '—'} {it.unit} · المنجز {it.actual ?? 0}</span>}
            <label style={{ fontSize: 11 }}>الدرجة % <input className="EV_SCORE" type="number" min="0" max="100" value={it.score} disabled={locked} onChange={(e) => up(i, 'score', e.target.value)} style={{ width: 70 }} /></label>
            <label style={{ fontSize: 11 }}>الوزن <input type="number" min="0.1" step="0.1" value={it.weight} disabled={locked || !it.manual} onChange={(e) => up(i, 'weight', e.target.value)} style={{ width: 60 }} /></label>
            {!locked && it.manual && <button className="btn bsm" onClick={() => setItems((a) => a.filter((_, j) => j !== i))}>✕</button>}
          </div>
          <input placeholder="ملاحظة على البند (اختياري)" value={it.comment || ''} disabled={locked} onChange={(e) => up(i, 'comment', e.target.value)} style={{ width: '100%', marginTop: 6 }} />
        </div>))}
      {!locked && <button className="btn bsm" onClick={addManual}>+ بند يدوي</button>}
      <div style={{ marginTop: 10 }}><label>ملاحظات عامة (تصل للموظف مع النتيجة)</label><textarea rows={2} value={comments} disabled={locked} onChange={(e) => setComments(e.target.value)} style={{ width: '100%' }} /></div>
      {!locked && <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button className="btn" id="EV_DRAFT" disabled={busy || !items.length} onClick={() => act(false)}>حفظ كمسودة</button>
        <button className="btn bpl" id="EV_SUBMIT" disabled={busy || !items.length} onClick={() => act(true)}>إرسال للاعتماد</button>
        {ev && ev.status === 'pending' && d.can_approve && <button className="btn bgl" id="EV_APPROVE" disabled={busy} onClick={approve}>✓ اعتماد نهائي وإبلاغ الموظف</button>}
      </div>}
      {locked && <div className="al alg" style={{ marginTop: 10 }}>التقييم معتمد ومُبلَّغ للموظف.</div>}
    </div>
  );
}
