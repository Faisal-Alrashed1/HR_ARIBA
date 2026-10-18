import { useCallback, useEffect, useState } from 'react';
import { rpc } from '../../lib/api.js';
import { toast } from '../../components/Toast.jsx';
import DocPreview from '../../components/DocPreview.jsx';
import { getDocFile, saveFile } from '../../lib/leaves.js';

export const EMP_DOC_TYPES = [['identity', 'الهوية / الإقامة', 'ID / Iqama'], ['passport', 'جواز السفر', 'Passport'], ['degree', 'شهادة التخرج', 'Degree Certificate'], ['experience', 'شهادة الخبرة', 'Experience Certificate'],
  ['social_insurance', 'شهادة التأمينات الاجتماعية', 'Social Insurance Certificate'], ['national_address', 'العنوان الوطني', 'National Address'], ['cv', 'السيرة الذاتية', 'CV / Resume'], ['contract', 'العقد', 'Contract'], ['profile_edit', 'مرفق تعديل بيانات', 'Data-edit attachment'], ['other', 'مستند آخر', 'Other document']];
const MAX = 12582912;
export const readB64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res({ name: f.name, mime: f.type || 'application/octet-stream', data: String(r.result).split(',')[1] || '' }); r.onerror = rej; r.readAsDataURL(f); });

/** يرفع الملفات المختارة إلى ariba_documents للموظف. يرجع عدد المرفوع */
export async function uploadEmpDocs(empId, picked) {
  let n = 0;
  for (const [type, f] of Object.entries(picked)) {
    if (!f) continue;
    if (f.size > MAX) { toast('ملف ' + f.name + ' يتجاوز 12 MB', 'ter'); continue; }
    try { const a = await readB64(f); await rpc('ariba_save_document', { p_employee_id: String(empId), p_document_type: type, p_file_name: a.name, p_mime_type: a.mime, p_base64: a.data, p_request_id: null }); n++; }
    catch { toast('تعذر رفع ' + f.name, 'ter'); }
  }
  return n;
}

/** الوثائق الإلكترونية داخل تبويب الوثائق: اختيار ملف لكل نوع (يُرفع عند "حفظ وتحديث") + قائمة المرفوع سابقاً */
export default function EmpDocsBox({ empId, picked, setPicked, refreshKey }) {
  const [docs, setDocs] = useState(null); const [prev, setPrev] = useState(null);
  const load = useCallback(async () => { if (!empId) return setDocs([]); try { const d = await rpc('ariba_list_documents', { p_employee_id: String(empId) }); setDocs(Array.isArray(d) ? d : (d && d.documents) || []); } catch { setDocs(null); } }, [empId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  const lbl = (t) => { const x = EMP_DOC_TYPES.find((q) => q[0] === t); return x ? x[1] : t; };
  const view = async (id) => { try { setPrev(await getDocFile(id)); } catch (e) { toast(e.message || 'تعذر فتح الوثيقة', 'ter'); } };
  return (
    <div id="ARIBA_HR_DOC_FIELDS" style={{ gridColumn: '1/-1' }}>
      <div className="fsec" style={{ marginTop: 10 }}><i className="ti ti-paperclip" /> الوثائق الإلكترونية / Employee Documents</div>
      {EMP_DOC_TYPES.map(([k, ar, en]) => <div key={k}><label>{ar} / {en}{picked[k] && <button type="button" className="undo-f" title="إلغاء الملف المختار" onClick={() => setPicked((p) => ({ ...p, [k]: null }))}>↺</button>}</label>
        <input key={k + (picked[k] ? 'y' : 'n')} className="ARIBA_DOC_FILE" data-doctype={k} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(e) => setPicked((p) => ({ ...p, [k]: (e.target.files && e.target.files[0]) || null }))} /></div>)}
      <div id="ARIBA_EMP_DOC_LIST" style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>الوثائق المرفوعة</div>
        {docs === null && <div style={{ color: 'var(--rd)', fontSize: 11 }}>تعذر تحميل الوثائق</div>}
        {docs && !docs.length && <div style={{ color: 'var(--mu)' }}>لا توجد وثائق</div>}
        {(docs || []).map((d) => <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--bd)', fontSize: 11 }}><span style={{ flex: 1 }}>{lbl(d.document_type)} — {d.file_name}</span>
          <button type="button" className="btn bsm" onClick={() => view(d.id)}>عرض</button><button type="button" className="btn bsm" onClick={() => getDocFile(d.id).then(saveFile).catch((e) => toast(e.message, 'ter'))}><i className="ti ti-download" /></button></div>)}
      </div>
      {prev && <DocPreview file={prev} onClose={() => setPrev(null)} onDownload={() => saveFile(prev)} />}
    </div>
  );
}
