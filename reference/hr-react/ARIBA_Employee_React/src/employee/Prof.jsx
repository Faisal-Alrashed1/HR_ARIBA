import { useState } from 'react';
import { useEmp } from './EmpStore.jsx';
import { rpc } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { useLang } from '../lib/i18n.js';
import { T, isEN, money, fDMY } from './util.jsx';
import { useAppNav } from './nav.jsx';
import WorkLocations from './WorkLocations.jsx';
import { DocUpload, EditData, IbanChange } from './ProfileRequests.jsx';

const Info = ({ l, v }) => <div className="profile-info"><span>{l}</span><b>{v == null || v === '' ? '—' : v}</b></div>;
const Row = ({ l, v, cls }) => <div className={'hr-pay-row' + (cls ? ' ' + cls : '')}><span>{l}</span><b>{v}</b></div>;

/** تنزيل وثيقة: HTML يُحمّل كصفحة UTF-8 بنسخة لغة واحدة، وغيره كما هو */
export async function downloadDoc(id) {
  try {
    const d = await rpc('ariba_get_document', { p_document_id: id });
    if (!d || !d.base64) throw new Error(T('تعذر تحميل الوثيقة', 'Unable to download document'));
    const bin = atob(d.base64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const name = d.file_name || 'document', isHtml = /\.html?$/i.test(name) || /text\/html/i.test(d.mime_type || '');
    let blob;
    if (isHtml) {
      const txt = new TextDecoder('utf-8').decode(u8), parts = txt.split('<!--ARIBA_EN-->'), useEn = !!(isEN() && parts[1]), body = useEn ? parts[1] : parts[0];
      const full = /<html[\s>]/i.test(body) ? (/charset/i.test(body) ? body : body.replace(/<head[^>]*>/i, (m) => m + '<meta charset="utf-8">')) : '<!doctype html><html dir="' + (useEn ? 'ltr' : 'rtl') + '" lang="' + (useEn ? 'en' : 'ar') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + name.replace(/[<>&"]/g, '') + '</title></head><body style="margin:0">' + body + '</body></html>';
      blob = new Blob([full], { type: 'text/html;charset=utf-8' });
    } else blob = new Blob([u8], { type: /^text\/(html|plain|csv)\s*$/i.test(d.mime_type || '') ? d.mime_type + ';charset=utf-8' : (d.mime_type || 'application/octet-stream') });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  } catch (e) { toast(e.message || T('تعذر تحميل الوثيقة', 'Unable to download document'), 'ter'); }
}

const DOCL = { identity: ['الهوية / الإقامة', 'ID / Iqama'], id: ['الهوية / الإقامة', 'ID / Iqama'], passport: ['جواز السفر', 'Passport'], degree: ['شهادة التخرج', 'Degree'], experience: ['شهادة خبرة', 'Experience certificate'], cv: ['السيرة الذاتية', 'CV'], national_address: ['العنوان الوطني', 'National address'], contract: ['العقد', 'Contract'], social_insurance: ['شهادة التأمينات', 'Social insurance'], profile_edit: ['مرفق تعديل بيانات', 'Data-edit attachment'], other: ['مستند آخر', 'Other document'] };
const docLbl = (t) => { const x = DOCL[t]; return x ? T(x[0], x[1]) : t; };
export default function Prof() {
  useLang();
  const { me } = useEmp(); const nav = useAppNav();
  const [busy, setBusy] = useState(''), [dlg, setDlg] = useState('');
  if (!me) return null;
  const pend = (t) => (me.requests || []).some((r) => r.request_type === t && r.status === 'pending');
  const en = isEN(), nm = en ? (me.name_en || me.name) : me.name, gross = me.salaryTotal || (me.salary + me.hou + me.tra + me.prj + me.oth + (me.natureAllowance || 0));
  const fixed = me.contractNature === 'fixed' || me.contractNature === 'محدد المدة';
  const docs = me.documents || [];
  const fmt2 = (v) => Number(v || 0).toFixed(2) + T(' يوم', ' days');
  return (
    <div id="profTab">
      <div className="profile-hero">
        {me.photoUrl && /^(https?:|data:image\/)/i.test(me.photoUrl) ? <img className="profile-photo" style={{ width: 82, height: 82 }} src={me.photoUrl} alt="" /> : <div className="profile-avatar">{(String(me.name || '؟').trim().split(/\s+/)[0] || '؟').slice(0, 1)}</div>}
        <div style={{ minWidth: 0, flex: 1 }}><div className="profile-name">{nm || '—'}</div><div className="profile-en">{me.name_en || '—'}</div><div className="profile-job">{me.job || '—'}</div><div style={{ fontSize: 10, color: 'var(--dm)', marginTop: 4 }}>EMP: {me.empNo || '—'}</div></div>
      </div>
      <div className="card"><div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{T('البيانات الشخصية', 'Personal information')}<button type="button" id="editDataBtn" className="btn bsm" onClick={() => setDlg('edit')}>✏️ {T('طلب تعديل', 'Request edit')}</button></div><div className="profile-grid">
        <Info l={T('الرقم الوظيفي', 'Employee No.')} v={me.empNo} /><Info l={T('الجنسية', 'Nationality')} v={me.nationality} /><Info l={T('الجوال', 'Mobile')} v={me.mobile} /><Info l={T('البريد الإلكتروني', 'Email')} v={me.email} /><Info l={T('رقم الإقامة / الهوية', 'Iqama / ID no.')} v={me.iqama} /><Info l={T('تاريخ الميلاد', 'Date of birth')} v={fDMY(me.dob)} />
      </div></div>
      <div className="card"><div className="card-title">{T('الوظيفة والعقد', 'Job & contract')}</div><div className="profile-grid">
        <Info l={T('جهة العمل', 'Employer')} v={me.employer} /><Info l={T('القسم', 'Department')} v={me.dept} /><Info l={T('الوظيفة', 'Job title')} v={me.job} /><Info l={T('المدير المباشر', 'Direct manager')} v={me.managerName} />
        <Info l={T('تاريخ المباشرة', 'Join date')} v={fDMY(me.join)} /><Info l={T('انتهاء الإقامة', 'Iqama expiry')} v={fDMY(me.iqama_exp)} /><Info l={T('طبيعة العقد', 'Contract nature')} v={me.contractNature} />
        {fixed && <Info l={T('مدة العقد (شهر)', 'Contract duration (months)')} v={me.contractDuration} />}<Info l={T('انتهاء العقد', 'Contract end')} v={fDMY(me.end)} />
      </div></div>
      <div className="card"><div className="card-title">🏖 {T('أرصدة الإجازات', 'Leave balances')}</div>
        <Row l={T('الرصيد حتى اليوم', 'Balance as of today')} v={fmt2(me.leave_bal)} /><Row l={T('رصيد نهاية العام', 'Year-end balance')} v={fmt2(me.leaveYearEnd != null ? me.leaveYearEnd : me.leave_bal)} /><Row l={T('المرحل', 'Carried over')} v={fmt2(me.leave_carry)} />
        <Row l={T('إجمالي منذ بداية الخدمة', 'Total since start')} v={fmt2(me.leaveTotalSinceStart)} /><Row l={T('المستخدم منذ بداية الخدمة', 'Used since start')} v={fmt2(me.leaveUsedSinceStart)} /><Row l={T('المتاح منذ بداية الخدمة', 'Available since start')} v={fmt2(me.leaveAvailableSinceStart)} /></div>
      <div className="card"><div className="card-title">💰 {T('الراتب من الموارد البشرية', 'Salary (from HR)')}</div>
        <Row l={T('الراتب الأساسي', 'Basic salary')} v={money(me.salary)} /><Row l={T('بدل السكن', 'Housing allowance')} v={money(me.hou)} /><Row l={T('بدل النقل', 'Transport allowance')} v={money(me.tra)} /><Row l={T('بدل المشروع', 'Project allowance')} v={money(me.prj)} /><Row l={T('بدلات أخرى', 'Other allowances')} v={money(me.oth + (me.natureAllowance || 0))} />
        <Row l={T('إجمالي الراتب', 'Gross salary')} v={money(gross)} cls="hr-pay-total" /><Row l={T('استقطاع التأمينات', 'Insurance deduction')} v={'- ' + money(me.insuranceSub)} cls="hr-pay-ded" /><Row l={T('صافي الراتب', 'Net salary')} v={money(me.net)} cls="hr-pay-net" /></div>
      <div className="card"><div className="card-title">🏦 {T('بيانات البنك', 'Bank details')}</div><Info l="IBAN" v={me.iban} />
        <button type="button" id="ibanReqBtn" className="btn" style={{ width: '100%', marginTop: 8, background: 'var(--c2)', border: '1px solid var(--bd)' }} onClick={() => setDlg('iban')}>{pend('iban_change') ? '⏳ ' + T('طلب تغيير الآيبان قيد المراجعة', 'IBAN change under review') : '✏️ ' + T('طلب تغيير الآيبان', 'Request IBAN change')}</button></div>
      <div className="card" id="myDocs"><div className="card-title">📎 {T('وثائقي', 'My Documents')}</div>
        <button type="button" id="docUpBtn" className="btn" style={{ width: '100%', marginBottom: 8, background: 'var(--c2)', border: '1px solid var(--bd)' }} onClick={() => setDlg('doc')}>📤 {T('رفع مستند للمراجعة', 'Upload a document for review')}</button>
        {docs.length ? docs.map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid var(--bd)' }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 12 }}>{docLbl(d.document_type)}</div><div style={{ fontSize: 10, color: 'var(--mu)', overflowWrap: 'anywhere' }}>{d.file_name}</div></div>
            <button className="btn bsm" disabled={busy === d.id} onClick={async () => { setBusy(d.id); await downloadDoc(d.id); setBusy(''); }}>⬇ {T('فتح', 'Open')}</button>
          </div>
        )) : <div style={{ color: 'var(--mu)', fontSize: 11, textAlign: 'center', padding: 12 }}>{T('لا توجد وثائق مرفوعة', 'No documents uploaded')}</div>}
      </div>
      <div className="card" id="aribaPwCard"><div className="card-title">🔒 {T('الأمان', 'Security')}</div>
        <div style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.7, marginBottom: 10 }}>{T('تقدر تغيّر كلمة المرور في أي وقت.', 'You can change your password at any time.')}</div>
        <button type="button" id="aribaPwCardBtn" onClick={() => nav.openPw()} style={{ width: '100%', padding: 11, border: 0, borderRadius: 10, background: '#0f766e', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🔑 {T('تغيير كلمة المرور', 'Change password')}</button></div>
      <WorkLocations />
      {dlg === 'iban' && <IbanChange onClose={() => setDlg('')} />}{dlg === 'doc' && <DocUpload onClose={() => setDlg('')} />}{dlg === 'edit' && <EditData onClose={() => setDlg('')} />}
    </div>
  );
}
