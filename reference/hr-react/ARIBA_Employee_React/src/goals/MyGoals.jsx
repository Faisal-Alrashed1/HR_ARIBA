import { useEffect, useState } from 'react';
import { myGoals, pct, keyLabel, PT } from '../lib/goals.js';

/** للموظف: مستهدفاتي (حسب الفترة) + نتائج تقييماتي المعتمدة */
export default function MyGoals() {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => { myGoals().then(setD).catch((e) => setErr(e.message || 'تعذر التحميل')); }, []);
  if (err) return <div className="card"><div style={{ color: 'var(--rd)', padding: 14 }}>{err}</div></div>;
  if (!d) return <div className="card"><div style={{ padding: 20, textAlign: 'center', color: 'var(--mu)' }}>…</div></div>;
  const groups = {}; d.targets.forEach((t) => { const k = t.period_type + '|' + t.period_key; (groups[k] = groups[k] || []).push(t); });
  return (
    <div id="goalsTab">
      <div className="card"><div className="card-title">🎯 مستهدفاتي</div>
        {!d.targets.length && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 18 }}>لا توجد مستهدفات حالياً</div>}
        {Object.entries(groups).map(([k, list]) => { const [type, key] = k.split('|'); return (
          <div key={k} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--bl)', margin: '8px 0 4px' }}>{PT[type]} — {keyLabel(type, key)}</div>
            {list.map((t) => { const p = pct(t); return (
              <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b style={{ fontSize: 12 }}>{t.title}</b>{p != null && <span style={{ fontSize: 11 }}>{p}%</span>}</div>
                {t.description && <div style={{ fontSize: 11, color: 'var(--mu)' }}>{t.description}</div>}
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>المطلوب {t.target_value ?? '—'} {t.unit || ''} · المنجز {t.actual_value ?? 0}</div>
                {p != null && <div style={{ height: 6, background: 'rgba(120,140,160,.25)', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}><div style={{ width: p + '%', height: '100%', background: p >= 90 ? '#16a34a' : p >= 60 ? '#d99a00' : '#dc2626' }} /></div>}
              </div>); })}
          </div>); })}
      </div>
      <div className="card"><div className="card-title">⭐ تقييماتي</div>
        {!d.evaluations.length && <div style={{ textAlign: 'center', color: 'var(--mu)', padding: 18 }}>لا توجد تقييمات معتمدة بعد</div>}
        {d.evaluations.map((e) => (
          <div key={e.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontSize: 12 }}>{PT[e.period_type]} — {keyLabel(e.period_type, e.period_key)}</b><span><b>{e.overall}%</b> <span className="b bg">{e.rating}</span></span></div>
            {(e.items || []).map((i, j) => <div key={j} style={{ fontSize: 11, color: 'var(--mu)' }}>• {i.title}: {i.score}%{i.comment ? ' — ' + i.comment : ''}</div>)}
            {e.comments && <div style={{ fontSize: 11, marginTop: 4 }}>📝 {e.comments}</div>}
          </div>))}
      </div>
    </div>
  );
}
