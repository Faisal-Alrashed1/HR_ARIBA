import { useRef, useState } from 'react';
import { toast } from '../components/Toast.jsx';
import { useLang } from '../lib/i18n.js';
import EmpModal, { LBL, btnS } from './EmpModal.jsx';
import { SigPad } from './ProfileRequests.jsx';
import { T } from './util.jsx';
import { getSig, setSig, isSigData } from '../lib/signature.js';

/** إدارة توقيعي: رسم أو رفع صورة. يُحفظ في هذا التطبيق/المتصفح فقط ولا يراه أحد غيرك. onSaved(dataUrl) اختياري */
export default function SigManager({ ownerId, onClose, onSaved }) {
  useLang();
  const [cur, setCur] = useState(getSig(ownerId)), [draw, setDraw] = useState(''), [mode, setMode] = useState(cur ? 'view' : 'draw'), fileRef = useRef(null);
  function save(d) {
    if (!isSigData(d)) { toast(T('التوقيع غير صالح أو كبير الحجم', 'Invalid or too large signature'), 'ter'); return; }
    if (!setSig(ownerId, d)) { toast(T('تعذر الحفظ على هذا الجهاز', 'Could not save on this device'), 'ter'); return; }
    setCur(d); setMode('view'); toast('✓ ' + T('تم حفظ توقيعك في التطبيق فقط', 'Signature saved in this app only'), 'tin'); onSaved && onSaved(d);
  }
  function upload(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 400000) { toast(T('اختر صورة PNG/JPG أقل من 400KB', 'Choose a PNG/JPG under 400KB'), 'ter'); return; }
    const r = new FileReader(); r.onload = () => save(String(r.result)); r.readAsDataURL(f);
  }
  return (
    <EmpModal id="sigMgr" onClose={onClose}>
      <h3 style={{ margin: '0 0 6px' }}>✍️ {T('توقيعي', 'My signature')}</h3>
      <div style={{ fontSize: 11.5, color: '#555', lineHeight: 1.7, marginBottom: 8 }}>🔒 {T('يُحفظ توقيعك داخل هذا التطبيق فقط ولا يظهر للموارد البشرية ولا لأي جهة. يُدرج تلقائياً في المستند عند اختيار «موافق مع التوقيع».', 'Your signature is stored only inside this app and is never visible to HR or anyone else. It is placed on the document when you choose “Approve with signature”.')}</div>
      {mode === 'view' && cur && <div><div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 8, textAlign: 'center', background: '#fff' }}><img id="sigCur" alt="signature" src={cur} style={{ maxHeight: 90, maxWidth: '100%' }} /></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button type="button" style={btnS('ghost')} onClick={() => setMode('draw')}>{T('رسم توقيع جديد', 'Draw new')}</button>
          <button type="button" style={btnS('ghost')} onClick={() => fileRef.current && fileRef.current.click()}>{T('رفع صورة', 'Upload image')}</button>
          <button type="button" style={{ ...btnS('ghost'), color: '#c00' }} onClick={() => { setSig(ownerId, ''); setCur(''); setMode('draw'); toast(T('تم حذف التوقيع', 'Signature removed'), 'tin'); onSaved && onSaved(''); }}>{T('حذف', 'Delete')}</button></div></div>}
      {mode === 'draw' && <div><label style={LBL}>{T('ارسم توقيعك', 'Draw your signature')}</label><SigPad onChange={setDraw} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button id="sigSave" type="button" style={btnS()} disabled={!draw} onClick={() => save(draw)}>{T('حفظ التوقيع', 'Save signature')}</button>
          <button type="button" style={btnS('ghost')} onClick={() => fileRef.current && fileRef.current.click()}>{T('رفع صورة', 'Upload image')}</button></div></div>}
      <input ref={fileRef} id="sigFile" type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={upload} />
      <button type="button" style={{ ...btnS('ghost'), width: '100%', marginTop: 10 }} onClick={onClose}>{T('إغلاق', 'Close')}</button>
    </EmpModal>
  );
}
