import { useEffect, useRef, useState } from 'react';
import { rpc } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { useLang } from '../lib/i18n.js';
import { useEmp } from './EmpStore.jsx';
import EmpModal, { INP, LBL, btnS } from './EmpModal.jsx';
import { T, fileToData, MAX_ATT } from './util.jsx';
import { wrapLetterhead, esc } from '../lib/print.js';

export const DOC_TYPES = [['id', 'الهوية / الإقامة', 'ID / Iqama'], ['passport', 'جواز السفر', 'Passport'], ['experience', 'شهادة خبرة', 'Experience certificate'], ['cv', 'السيرة الذاتية', 'CV'], ['national_address', 'العنوان الوطني', 'National address'],
  ['contract', 'العقد', 'Contract'], ['graduation', 'شهادة التخرج', 'Graduation certificate'], ['social_insurance', 'شهادة التأمينات الاجتماعية', 'Social insurance certificate'], ['other', 'أخرى', 'Other']];
const isEN = () => { try { return localStorage.getItem('ariba_ui_lang') === 'en'; } catch { return false; } };
const pending = (me, type) => (me.requests || []).find((r) => r.request_type === type && r.status === 'pending');

/** رفع مستند → يذهب لمراجعة HR، وعند الاعتماد يُحفظ تلقائياً في ملف الموظف في برنامج HR وفي وثائقي */
export function DocUpload({ onClose }) {
  const { reload } = useEmp();
  const [type, setType] = useState('id'), [other, setOther] = useState(''), [file, setFile] = useState(null), [busy, setBusy] = useState(false);
  async function go() {
    if (!file) return toast(T('اختر الملف', 'Choose a file'), 'ter');
    if (file.size > MAX_ATT) return toast(T('حجم الملف يتجاوز 12 MB', 'File exceeds 12 MB'), 'ter');
    const t = DOC_TYPES.find((x) => x[0] === type), label = type === 'other' ? (other.trim() || 'مستند آخر') : t[1];
    setBusy(true);
    try {
      const a = await fileToData(file);
      await rpc('ariba_submit_request', { p_type: 'document', p_payload: { doc_type: type, doc_label: label, notes: other }, p_attachment_name: a.name, p_attachment_mime: a.mime, p_attachment_base64: a.data });
      toast('✅ ' + T('أُرسل المستند للموارد البشرية للمراجعة', 'Sent to HR for review'), 'tin'); await reload(true); onClose();
    } catch (e) { toast(e.message || T('تعذر الإرسال', 'Could not send'), 'ter'); } finally { setBusy(false); }
  }
  return (
    <EmpModal id="docUpModal" onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>📤 {T('رفع مستند', 'Upload a document')}</div>
      <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>{T('يُراجَع من الموارد البشرية، وعند الاعتماد يُحفظ تلقائياً في ملفك ووثائقي.', 'HR reviews it; once approved it is saved automatically to your file and My Documents.')}</div>
      <label style={LBL}>{T('نوع المستند', 'Document type')}</label>
      <select id="docUpType" style={INP} value={type} onChange={(e) => setType(e.target.value)}>{DOC_TYPES.map((x) => <option key={x[0]} value={x[0]}>{isEN() ? x[2] : x[1]}</option>)}</select>
      {type === 'other' && <><label style={LBL}>{T('اسم المستند', 'Document name')}</label><input style={INP} value={other} onChange={(e) => setOther(e.target.value)} /></>}
      <label style={LBL}>{T('الملف (PDF / صورة)', 'File (PDF / image)')}</label>
      <input id="docUpFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" style={INP} onChange={(e) => setFile(e.target.files && e.target.files[0] || null)} />
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}><button id="docUpGo" type="button" style={btnS()} disabled={busy} onClick={go}>{busy ? '…' : T('إرسال للمراجعة', 'Send for review')}</button><button type="button" style={btnS('ghost')} onClick={onClose}>{T('إلغاء', 'Cancel')}</button></div>
    </EmpModal>
  );
}

const EDIT_FIELDS = [['mobile', 'الجوال', 'Mobile', 'tel'], ['email', 'البريد الإلكتروني', 'Email', 'email'], ['address', 'العنوان', 'Address', 'text'], ['city', 'المدينة', 'City', 'text'], ['nameEn', 'الاسم بالإنجليزي', 'Name (EN)', 'text'], ['emergencyName', 'اسم جهة الطوارئ', 'Emergency contact', 'text'], ['emergencyPhone', 'جوال الطوارئ', 'Emergency phone', 'tel']];
/** طلب تعديل بيانات: لا يُحفظ إلا بعد اعتماد HR */
export function EditData({ onClose }) {
  const { me, reload } = useEmp();
  const cur = { mobile: me.mobile, email: me.email, nameEn: me.name_en };
  const [v, setV] = useState(() => Object.fromEntries(EDIT_FIELDS.map(([k]) => [k, cur[k] || ''])));
  const [busy, setBusy] = useState(false), [file, setFile] = useState(null);
  async function go() {
    const changes = {}; EDIT_FIELDS.forEach(([k]) => { const nv = String(v[k] || '').trim(); if (nv && nv !== String(cur[k] || '')) changes[k] = nv; });
    if (!Object.keys(changes).length) return toast(T('لم تغيّر أي بيان', 'Nothing changed'), 'ter');
    if (file && file.size > MAX_ATT) return toast(T('حجم الملف يتجاوز 12 MB', 'File exceeds 12 MB'), 'ter');
    setBusy(true);
    try { const a = file ? await fileToData(file) : null; await rpc('ariba_submit_request', { p_type: 'profile_edit', p_payload: { changes }, ...(a ? { p_attachment_name: a.name, p_attachment_mime: a.mime, p_attachment_base64: a.data } : {}) }); toast('✅ ' + T('أُرسل طلب التعديل للموارد البشرية', 'Edit request sent to HR'), 'tin'); await reload(true); onClose(); }
    catch (e) { toast(e.message || T('تعذر الإرسال', 'Could not send'), 'ter'); } finally { setBusy(false); }
  }
  return (
    <EmpModal id="editDataModal" onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>✏️ {T('طلب تعديل بياناتي', 'Request data edit')}</div>
      <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>{T('التعديل لا يُطبَّق إلا بعد موافقة الموارد البشرية.', 'Changes apply only after HR approval.')}</div>
      {EDIT_FIELDS.map(([k, a, e, ty]) => <div key={k}><label style={LBL}>{isEN() ? e : a}</label><input data-f={k} type={ty} style={INP} value={v[k]} onChange={(ev) => setV((p) => ({ ...p, [k]: ev.target.value }))} /></div>)}
      <label style={LBL}>{T('مرفق داعم (اختياري) — يُحفظ في ملفك بعد الاعتماد', 'Supporting file (optional) — saved to your file after approval')}</label>
      <input id="editDataFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" style={INP} onChange={(e) => setFile(e.target.files && e.target.files[0] || null)} />
      <div style={{ display: 'flex', gap: 8 }}><button id="editDataGo" type="button" style={btnS()} disabled={busy} onClick={go}>{busy ? '…' : T('إرسال للاعتماد', 'Send for approval')}</button><button type="button" style={btnS('ghost')} onClick={onClose}>{T('إلغاء', 'Cancel')}</button></div>
    </EmpModal>
  );
}

export function SigPad({ onChange }) {
  const ref = useRef(null), drawing = useRef(false);
  useEffect(() => { const c = ref.current, x = c.getContext('2d'); x.lineWidth = 2.2; x.lineCap = 'round'; x.strokeStyle = '#111'; }, []);
  const pos = (e) => { const c = ref.current, r = c.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * c.width / r.width, (t.clientY - r.top) * c.height / r.height]; };
  const start = (e) => { e.preventDefault(); drawing.current = true; const x = ref.current.getContext('2d'), [px, py] = pos(e); x.beginPath(); x.moveTo(px, py); };
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const x = ref.current.getContext('2d'), [px, py] = pos(e); x.lineTo(px, py); x.stroke(); };
  const end = () => { if (!drawing.current) return; drawing.current = false; onChange(ref.current.toDataURL('image/png')); };
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); onChange(''); };
  return (
    <div>
      <canvas id="sigPad" ref={ref} width={600} height={180} style={{ width: '100%', height: 110, border: '1px dashed #888', borderRadius: 8, background: '#fff', touchAction: 'none' }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      <button type="button" style={{ ...btnS('ghost'), padding: '4px 10px', fontSize: 12, marginTop: 4 }} onClick={clear}>{T('مسح التوقيع', 'Clear signature')}</button>
    </div>
  );
}

export function letterHtml({ me, bank, account, iban, sig }) {
  const d = new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn');
  const body = '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:14px;line-height:2;padding:6mm 4mm;color:#111">'
    + '<div style="text-align:left;margin-bottom:14px">التاريخ: ' + esc(d) + '</div>'
    + '<div style="font-weight:700">السادة / إدارة الموارد البشرية — المحترمين</div><div>السلام عليكم ورحمة الله وبركاته،</div>'
    + '<div style="font-weight:700;margin:14px 0;text-align:center;text-decoration:underline">الموضوع: طلب تغيير بيانات الحساب البنكي (الآيبان)</div>'
    + '<p>أنا الموقِّع أدناه <b>' + esc(me.name) + '</b>، الرقم الوظيفي <b>' + esc(me.empNo || '') + '</b>، رقم الهوية/الإقامة <b>' + esc(me.iqama || '—') + '</b>، أرجو التكرّم باعتماد بيانات حسابي البنكي الجديد لتحويل مستحقاتي المالية عليه، وذلك على النحو التالي:</p>'
    + '<table style="width:80%;margin:10px auto;border-collapse:collapse"><tbody>'
    + [['اسم البنك', bank], ['رقم الحساب', account], ['رقم الآيبان (IBAN)', iban]].map(([a, b]) => '<tr><td style="border:1px solid #888;padding:7px;background:#f3f6f5;width:35%">' + a + '</td><td style="border:1px solid #888;padding:7px" dir="ltr">' + esc(b) + '</td></tr>').join('')
    + '</tbody></table><p>مرفق شهادة الآيبان الصادرة من البنك. وأتحمّل كامل المسؤولية عن صحة البيانات أعلاه.</p><p>وتفضلوا بقبول فائق الاحترام والتقدير،</p>'
    + '<div style="margin-top:22px">مقدم الطلب: <b>' + esc(me.name) + '</b></div><div>التوقيع:</div>' + (sig ? '<img alt="signature" src="' + sig + '" style="height:60px;display:block;margin-top:4px">' : '') + '</div>';
  return wrapLetterhead({ mode: 'hf', preset: 'ariba' }, body);
}

/** طلب تغيير الآيبان: خطاب جاهز على ورق الشركة، يدخل الموظف الآيبان ورقم الحساب والبنك ويوقّع ويرفق الشهادة */
export function IbanChange({ onClose }) {
  useLang();
  const { me, reload } = useEmp();
  const [bank, setBank] = useState(''), [account, setAccount] = useState(''), [iban, setIban] = useState(''), [cert, setCert] = useState(null), [sig, setSig] = useState(''), [busy, setBusy] = useState(false), [prev, setPrev] = useState(false);
  const ib = iban.replace(/\s+/g, '').toUpperCase();
  function check() {
    if (!bank.trim()) return T('اكتب اسم البنك', 'Enter the bank name');
    if (!account.trim()) return T('اكتب رقم الحساب', 'Enter the account number');
    if (!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(ib)) return T('رقم الآيبان غير صحيح', 'IBAN is invalid');
    if (!cert) return T('أرفق شهادة الآيبان', 'Attach the IBAN certificate');
    if (cert.size > MAX_ATT) return T('حجم الملف يتجاوز 12 MB', 'File exceeds 12 MB');
    if (!sig) return T('وقّع في المربع أولاً', 'Please sign first');
    return '';
  }
  async function go() {
    const er = check(); if (er) return toast(er, 'ter');
    setBusy(true);
    try {
      const a = await fileToData(cert);
      await rpc('ariba_submit_request', { p_type: 'iban_change', p_payload: { iban: ib, bank: bank.trim(), account_no: account.trim(), letter_html: letterHtml({ me, bank: bank.trim(), account: account.trim(), iban: ib, sig }) }, p_attachment_name: a.name, p_attachment_mime: a.mime, p_attachment_base64: a.data });
      toast('✅ ' + T('أُرسل الطلب للمدير المباشر والموارد البشرية', 'Sent to your manager and HR'), 'tin'); await reload(true); onClose();
    } catch (e) { toast(e.message || T('تعذر الإرسال', 'Could not send'), 'ter'); } finally { setBusy(false); }
  }
  if (pending(me, 'iban_change')) return <EmpModal id="ibanModal" onClose={onClose}><div style={{ padding: 8 }}>{T('لديك طلب تغيير آيبان قيد المراجعة بالفعل.', 'You already have an IBAN change request pending.')}</div><button style={btnS('ghost')} onClick={onClose}>{T('إغلاق', 'Close')}</button></EmpModal>;
  return (
    <EmpModal id="ibanModal" onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>🏦 {T('طلب تغيير الآيبان', 'IBAN change request')}</div>
      <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>{T('الخطاب الرسمي جاهز على ورق الشركة — اكتب بياناتك البنكية الجديدة ووقّع وأرفق الشهادة. يصل المدير المباشر والموارد البشرية، وعند الاعتماد تُحدَّث بياناتك تلقائياً.', 'The formal letter is prepared on company letterhead. Enter your new bank data, sign and attach the certificate. Your manager and HR are notified; once approved your data updates automatically.')}</div>
      <label style={LBL}>{T('اسم البنك الجديد', 'New bank name')}</label><input id="ibBank" style={INP} value={bank} onChange={(e) => setBank(e.target.value)} />
      <label style={LBL}>{T('رقم الحساب', 'Account number')}</label><input id="ibAcc" dir="ltr" style={INP} value={account} onChange={(e) => setAccount(e.target.value)} />
      <label style={LBL}>IBAN</label><input id="ibIban" dir="ltr" style={INP} value={iban} onChange={(e) => setIban(e.target.value)} placeholder="SA…" />
      <label style={LBL}>{T('شهادة الآيبان (PDF / صورة)', 'IBAN certificate (PDF / image)')}</label><input id="ibCert" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={INP} onChange={(e) => setCert(e.target.files && e.target.files[0] || null)} />
      <label style={LBL}>{T('التوقيع', 'Signature')}</label><SigPad onChange={setSig} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button id="ibGo" type="button" style={btnS()} disabled={busy} onClick={go}>{busy ? '…' : T('إرسال الطلب', 'Send request')}</button>
        <button type="button" style={btnS('ghost')} onClick={() => setPrev(true)}>{T('معاينة الخطاب', 'Preview letter')}</button>
        <button type="button" style={btnS('ghost')} onClick={onClose}>{T('إلغاء', 'Cancel')}</button>
      </div>
      {prev && <div style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: '#fff', overflow: 'auto' }}><button type="button" style={{ ...btnS(), position: 'fixed', top: 10, insetInlineEnd: 10, flex: 'none', width: 'auto', padding: '8px 14px' }} onClick={() => setPrev(false)}>✕ {T('إغلاق', 'Close')}</button>
        <iframe title="letter" sandbox="" style={{ width: '100%', height: '100%', border: 0 }} srcDoc={'<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head><body style="margin:0">' + letterHtml({ me, bank: bank || '…', account: account || '…', iban: ib || '…', sig }) + '</body></html>'} /></div>}
    </EmpModal>
  );
}
