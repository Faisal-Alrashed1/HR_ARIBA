import { useEffect, useState } from 'react';
import { T } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import { rpc } from '../../lib/api.js';
import { Card, Note } from './shared.jsx';

const TYPES = [['onboarding', 'مباشرة عمل', 'Start of employment'], ['custody', 'استلام عهدة تقنية', 'IT equipment custody'], ['extension', 'تمديد فترة التجربة', 'Probation extension'], ['termination', 'إشعار إنهاء فترة التجربة', 'Probation termination notice'], ['*', 'كل المستندات', 'All documents']];

/** أي المستندات يلزم فيها توقيع المدير المباشر (تقف عند المدير بعد توقيع الموظف ثم تذهب للموارد البشرية) */
export default function DocSignCard() {
  const [sel, setSel] = useState(null), [busy, setBusy] = useState(false);
  useEffect(() => { rpc('ariba_doc_sign_cfg_get', {}).then((r) => setSel(r && r.manager_types || [])).catch(() => setSel([])); }, []);
  const tog = (k) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  async function save() { setBusy(true); try { await rpc('ariba_doc_sign_cfg_set', { p_manager_types: sel }); toast('✓ ' + T('تم الحفظ', 'Saved'), 'tin'); } catch (e) { toast(e.message, 'ter'); } finally { setBusy(false); } }
  return (
    <Card icon="signature" title={T('توقيع المدير المباشر على المستندات', 'Direct-manager signature on documents')} id="DOC_SIGN" max={900}>
      <Note style={{ marginBottom: 8 }}>{T('عند «موافق مع التوقيع» يدمج تطبيق الموظف توقيعه في المستند تلقائياً. المستندات المحددة هنا تقف عند مديره المباشر حتى يوقّع، ثم تذهب للموارد البشرية. توقيع الموظف نفسه محفوظ في تطبيقه فقط ولا تراه الموارد البشرية — تصلها نسخة المستند الموقّعة فقط.', 'When an employee approves with signature, the app places the signature on the document. Types ticked here stop at the direct manager until signed, then go to HR. The stored signature itself stays in the employee app; HR only receives the signed document.')}</Note>
      {sel && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{TYPES.map(([k, a, e]) => <label key={k} style={{ fontSize: 13 }}><input type="checkbox" checked={sel.includes(k)} onChange={() => tog(k)} /> {T(a, e)}</label>)}</div>}
      <button className="btn bpl" style={{ marginTop: 10 }} disabled={busy || !sel} onClick={save}>{T('حفظ', 'Save')}</button>
    </Card>
  );
}
