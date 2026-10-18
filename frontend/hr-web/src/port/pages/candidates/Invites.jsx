import { useCallback, useEffect, useState } from 'react';
import { rpc } from '../../lib/api.js';
import { toast } from '../../components/Toast.jsx';

const fmt = (d) => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? '' : x.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
export function inviteStatus(v) {
  if (v.used_at) return ['bg', 'اتقدّم منه ✓' + (v.candidate ? ' — ' + v.candidate : '')];
  if (v.revoked_at) return ['br', 'ملغي'];
  if (new Date(v.expires_at) < new Date()) return ['br', 'منتهي'];
  if (v.opened_at) return ['ba', 'اتفتح — لسه ما اتقدّمش'];
  return ['bb', 'لسه ما اتفتحش'];
}

/** روابط تقديم لمرة واحدة: رابط خاص لكل مرشح، يتقبل منه طلب واحد بس وبينتهي بعد مدة */
export default function Invites({ baseUrl, can }) {
  const [d, setD] = useState(null), [label, setLabel] = useState(''), [hours, setHours] = useState(''), [last, setLast] = useState(null), [busy, setBusy] = useState(false);
  const load = useCallback(() => rpc('ariba_hr_invites', {}).then(setD).catch((e) => setD({ error: e.message })), []);
  useEffect(() => { load(); }, [load]);
  const link = (t) => (baseUrl ? baseUrl + (baseUrl.indexOf('?') >= 0 ? '&' : '?') + 'i=' + t : '');
  const copy = (t) => { try { navigator.clipboard.writeText(t); toast('✓ نُسخ الرابط', 'tin'); } catch { window.prompt('انسخ', t); } };
  async function create() {
    if (!baseUrl) return toast('اكتب عنوان صفحة التقديم الأول (فوق)', 'ter');
    setBusy(true);
    try { const r = await rpc('ariba_hr_invite_create', { p_label: label.trim() || null, p_hours: hours ? Number(hours) : null }); setLast(r); setLabel(''); copy(link(r.token)); load(); }
    catch (e) { toast(e.message, 'ter'); } finally { setBusy(false); }
  }
  async function revoke(t) { if (!window.confirm('إلغاء الرابط ده؟ المرشح مش هيقدر يستخدمه.')) return; try { await rpc('ariba_hr_invite_revoke', { p_invite: t }); load(); } catch (e) { toast(e.message, 'ter'); } }

  if (d && d.error && /Could not find|schema cache|PGRST202/i.test(d.error)) return <div className="card" style={{ marginBottom: 10 }}><div className="al alb" style={{ margin: 12, fontSize: 12 }}><i className="ti ti-info-circle" /><span>لتفعيل روابط التقديم لمرة واحدة: شغّل ملف <b>sql/20_candidate_invites.sql</b> مرة واحدة في Supabase › SQL Editor.</span></div></div>;
  const list = (d && d.invites) || [];
  return (
    <div className="card" style={{ marginBottom: 10 }} id="CAND_INV">
      <div className="ch"><div className="ct"><i className="ti ti-ticket" /> <span>روابط تقديم لمرة واحدة (رابط خاص لكل مرشح)</span></div></div>
      <div style={{ padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.8 }}>كل رابط خاص بمرشح واحد: <b>يتقبل منه طلب واحد بس</b> وبعدها يتقفل، وبينتهي بعد المدة المحددة. لو حد تاني فتحه بعد ما المرشح قدّم هيلاقي «الرابط ده اتستخدم قبل كده».{d && d.invite_only ? <b style={{ color: '#0a7a3f' }}> الرابط العام متقفل — التقديم بالروابط الخاصة بس.</b> : <span> (الرابط العام لسه شغال — تقدر تقفله من الإعدادات ← المستخدمون والصلاحيات والأمان.)</span>}</div>
        {can && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input id="INV_LABEL" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="اسم المرشح أو الوظيفة (اختياري — للتمييز)" style={{ flex: 1, minWidth: 200 }} />
          <input id="INV_HOURS" type="number" min="1" max="720" value={hours} onChange={(e) => setHours(e.target.value)} placeholder={'الصلاحية بالساعات (' + ((d && d.hours) || 72) + ')'} style={{ width: 170 }} />
          <button className="btn bpl bsm" id="INV_NEW" disabled={busy} onClick={create}><i className="ti ti-plus" /> إنشاء رابط جديد</button>
        </div>}
        {last && <div className="al alg" style={{ fontSize: 12 }}><i className="ti ti-check" /><span style={{ flex: 1 }}>اتعمل رابط جديد{last.label ? ' لـ ' + last.label : ''} واتنسخ — صالح لحد {fmt(last.expires_at)}:<br /><input readOnly dir="ltr" value={link(last.token)} onFocus={(e) => e.target.select()} style={{ width: '100%', marginTop: 4 }} /></span>
          <span style={{ display: 'flex', gap: 4, flexDirection: 'column' }}><button className="btn bsm" onClick={() => copy(link(last.token))}>نسخ</button><a className="btn bsm" target="_blank" rel="noopener noreferrer" href={'https://wa.me/?text=' + encodeURIComponent('رابط طلب التوظيف الخاص بك (يُستخدم مرة واحدة): ' + link(last.token))}>واتساب</a></span></div>}
        {list.length > 0 && <div className="tw"><table><tbody>
          <tr><th>المرشح / الوصف</th><th>اتعمل</th><th>ينتهي</th><th>الحالة</th><th /></tr>
          {list.slice(0, 30).map((v) => { const st = inviteStatus(v), live = st[1].startsWith('لسه') || st[1].startsWith('اتفتح'); return (
            <tr key={v.token}><td>{v.label || '—'}</td><td>{fmt(v.created_at)}</td><td>{fmt(v.expires_at)}</td><td><span className={'b ' + st[0]}>{st[1]}</span></td>
              <td style={{ whiteSpace: 'nowrap' }}>{live && <><button className="btn bsm" title="نسخ الرابط" onClick={() => copy(link(v.token))}><i className="ti ti-copy" /></button>{can && <button className="btn bsm" style={{ color: 'var(--rd)' }} title="إلغاء" onClick={() => revoke(v.token)}><i className="ti ti-x" /></button>}</>}</td></tr>); })}
        </tbody></table></div>}
      </div>
    </div>
  );
}
