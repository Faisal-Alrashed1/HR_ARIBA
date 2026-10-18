import { useEffect, useState } from 'react';
import { rpc } from '../../lib/api.js';
import { toast } from '../../components/Toast.jsx';
import { T } from '../../lib/i18n.js';
import { Card, Note } from './shared.jsx';

/** حماية نموذج التوظيف: روابط لمرة واحدة فقط بدل الرابط العام */
export default function ApplyCard() {
  const [st, setSt] = useState(null), [hours, setHours] = useState(72), [on, setOn] = useState(false);
  useEffect(() => { rpc('ariba_hr_invites', {}).then((d) => { setSt('ok'); setOn(!!d.invite_only); setHours(d.hours || 72); }).catch((e) => setSt(/Could not find|schema cache|PGRST202/i.test(String(e.message)) ? 'nodb' : 'err')); }, []);
  const save = async (v, h) => { try { await rpc('ariba_hr_apply_mode_set', { p_invite_only: v, p_hours: Number(h) || 72 }); setOn(v); toast(v ? '✓ التقديم بالروابط الخاصة (مرة واحدة) فقط' : '✓ الرابط العام شغال تاني', 'tin'); } catch (e) { toast(e.message, 'ter'); } };
  return (
    <Card icon="ticket" title={T('حماية نموذج التوظيف (روابط لمرة واحدة)', 'Job application links (single use)')} id="APPLY_CARD">
      {st === 'nodb' ? <div className="al alb" style={{ fontSize: 11.5 }}><i className="ti ti-info-circle" /><span>شغّل ملف sql/20_candidate_invites.sql مرة واحدة في Supabase › SQL Editor لتفعيل الخاصية دي.</span></div> : <>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 700 }}><input type="checkbox" id="APPLY_INV_ONLY" checked={on} disabled={st !== 'ok'} onChange={(e) => save(e.target.checked, hours)} /> {T('التقديم بالروابط الخاصة بس — كل رابط يُستخدم مرة واحدة (وقفل الرابط العام)', 'Only single-use personal links (disable the public link)')}</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap', fontSize: 12 }}>
          <span>{T('صلاحية الرابط الخاص (بالساعات)', 'Link validity (hours)')}</span>
          <input type="number" min="1" max="720" id="APPLY_HOURS" value={hours} onChange={(e) => setHours(e.target.value)} style={{ width: 90 }} />
          <button className="btn bpl bsm" disabled={st !== 'ok'} onClick={() => save(on, hours)}>{T('حفظ', 'Save')}</button>
        </div>
        <Note style={{ marginTop: 8 }}>{T('من صفحة المرشحين ← «إنشاء رابط جديد» لكل مرشح. الرابط بيتقبل منه طلب واحد بس وبعدها يتقفل، وبينتهي بعد المدة دي حتى لو ما اتستخدمش، وتقدر تلغيه في أي وقت. لو حد تاني فتحه بعد المرشح هيلاقي إن الرابط اتستخدم.', 'Create a link per candidate from the Candidates page. Each link accepts one application, then closes; it expires after this period and can be revoked.')}</Note>
      </>}
    </Card>
  );
}
