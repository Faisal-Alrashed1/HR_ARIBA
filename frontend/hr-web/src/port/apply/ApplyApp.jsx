import { useEffect, useState } from 'react';
import { raw } from '../lib/api.js'; // ADAPTED: our public routes (/public/apply…) instead of Supabase RPCs

/** نموذج طلب التوظيف العام للمرشحين (بدون تسجيل دخول) — رابطه: apply.html?k=<مفتاح النموذج> */
const DOCS = [['cv', 'السيرة الذاتية (CV)'], ['id', 'الهوية / الإقامة'], ['passport', 'جواز السفر'], ['certificate', 'شهادة التخرج'], ['experience', 'شهادة الخبرة'], ['national_address', 'العنوان الوطني'], ['insurance', 'شهادة التأمينات الاجتماعية'], ['photo', 'صورة شخصية'], ['other', 'مستند آخر']];
const MAX = 5 * 1024 * 1024, OKM = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const css = `*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;background:#f3f6f5;color:#16302b}
.w{max-width:760px;margin:0 auto;padding:16px}.hd{background:#014D3D;color:#fff;border-radius:14px;padding:18px 20px;margin-bottom:12px}.hd h1{margin:0;font-size:20px}.hd p{margin:6px 0 0;font-size:13px;opacity:.9}
.c{background:#fff;border:1px solid #dce7e3;border-radius:14px;padding:16px;margin-bottom:12px}.c h2{margin:0 0 10px;font-size:14px;color:#014D3D}
.g{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:560px){.g{grid-template-columns:1fr}}.f{grid-column:1/-1}
label{display:block;font-size:12px;color:#4a6660;margin-bottom:3px}input,select,textarea{width:100%;padding:9px 10px;border:1px solid #c7d6d1;border-radius:9px;font:inherit;font-size:14px;background:#fff}
button{font:inherit;cursor:pointer}.b{background:#014D3D;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-weight:700;font-size:15px;width:100%}.b:disabled{opacity:.6}
.e{background:#fdecec;color:#a02020;border-radius:9px;padding:9px 12px;font-size:13px;margin-bottom:10px}.ok{text-align:center;padding:30px 10px}.ok h2{color:#0a7a3f;font-size:20px}
.fl{display:flex;align-items:center;gap:8px;border:1px dashed #b9cfc8;border-radius:9px;padding:8px 10px;margin-bottom:6px;font-size:13px}.fl select{width:auto;flex:0 0 200px}.fl span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fl button{background:none;border:0;color:#b22;font-size:16px}
.hp{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);opacity:0;pointer-events:none}`;
const b64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
const F = ({ k, label, form, set, type = 'text', req, ...r }) => <div><label>{label}{req && ' *'}</label><input type={type} value={form[k] || ''} onChange={(e) => set(k, e.target.value)} required={req} {...r} /></div>;

export default function ApplyApp() {
  const qs = new URLSearchParams(location.search), key = qs.get('k') || '', inv = qs.get('i') || '';
  // رابط خاص لمرة واحدة (?i=...): نتأكد من حالته أول ما الصفحة تفتح
  const [inviteSt, setInviteSt] = useState(inv ? 'loading' : '');
  useEffect(() => {
    if (!inv) return;
    raw('/public/apply/invite/' + encodeURIComponent(inv), { method: 'GET' }).then((r) => setInviteSt(r.ok && r.data && r.data.status ? r.data.status : 'invalid')).catch(() => setInviteSt('neterr'));
  }, [inv]);
  const [form, setForm] = useState({ nationality: 'سعودي' }), [files, setFiles] = useState([]), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const addFiles = (e) => {
    const add = []; for (const f of e.target.files) { if (f.size > MAX) { setErr(f.name + ' أكبر من 5MB'); continue; } if (!OKM.includes(f.type)) { setErr(f.name + ': الأنواع المسموحة PDF / JPG / PNG'); continue; } add.push({ file: f, type: 'other' }); }
    setFiles((a) => [...a, ...add].slice(0, 10)); e.target.value = '';
  };
  async function send(e) {
    e.preventDefault(); setErr('');
    if (!files.some((x) => x.type === 'cv')) return setErr('أرفق السيرة الذاتية (حدد نوع الملف: السيرة الذاتية)');
    setBusy(true);
    try {
      const payload = []; for (const x of files) payload.push({ type: x.type, name: x.file.name, mime: x.file.type, base64: await b64(x.file) });
      const r = inv
        ? await raw('/public/apply', { body: { invite: inv, data: form, files: payload } })
        : await raw('/public/apply', { body: { form_key: key, data: form, files: payload } });
      if (!r.ok) {
        const m = (r.data && (r.data.message || r.data.hint)) || 'تعذر الإرسال';
        if (m === 'INVITE_USED' || m === 'INVITE_EXPIRED' || m === 'INVITE_INVALID') { setInviteSt(m === 'INVITE_USED' ? 'used' : m === 'INVITE_EXPIRED' ? 'expired' : 'invalid'); return; }
        throw new Error(m === 'FORM_CLOSED' ? 'النموذج مغلق أو الرابط غير صحيح' : m === 'INVITE_ONLY' ? 'التقديم بالرابط العام متوقف — اطلب رابط تقديم خاص بيك من الموارد البشرية' : m);
      }
      setDone(r.data);
    } catch (er) { setErr(er.message || 'تعذر الإرسال'); } finally { setBusy(false); }
  }
  const MSG = { used: 'الرابط ده اتستخدم قبل كده — كل رابط بيتقدّم منه مرة واحدة بس. لو محتاج تعدّل طلبك تواصل مع الموارد البشرية.', expired: 'انتهت صلاحية الرابط ده — اطلب رابط جديد من الموارد البشرية.', revoked: 'الرابط ده اتلغى — اطلب رابط جديد من الموارد البشرية.', invalid: 'الرابط غير صحيح — اطلب رابط التقديم من الموارد البشرية.', neterr: 'تعذر الاتصال — تأكد من الإنترنت وأعد فتح الرابط.' };
  if (!done && inv && inviteSt === 'loading') return <div className="w"><style>{css}</style><div className="c" style={{ textAlign: 'center', color: '#4a6660' }}>جاري التحقق من الرابط…</div></div>;
  if (!done && inv && MSG[inviteSt]) return <div className="w"><style>{css}</style><div className="c"><div className="e" id="INV_MSG">{MSG[inviteSt]}</div></div></div>;
  if (!key && !inv) return <div className="w"><style>{css}</style><div className="c"><div className="e">الرابط غير صحيح — اطلب رابط التقديم من الموارد البشرية.</div></div></div>;
  if (done) return <div className="w"><style>{css}</style><div className="c ok"><h2>✓ تم استلام طلبك</h2><p>شكراً {form.nameAr}، ستراجع الموارد البشرية بياناتك وتتواصل معك على البريد أو الجوال المسجل.</p><p style={{ fontSize: 12, color: '#678' }}>رمز المرجع (أرسله للموارد البشرية عند الحاجة): <b dir="ltr" style={{ userSelect: 'all' }}>{done.ref}</b></p></div></div>;
  return (
    <div className="w"><style>{css}</style>
      <div className="hd"><h1>طلب توظيف</h1><p>عبّئ بياناتك وأرفق مستنداتك، وستراجعها الموارد البشرية قبل أي إجراء.</p></div>
      <form onSubmit={send}>
        <input className="hp" tabIndex={-1} autoComplete="off" name="website" value={form.website || ''} onChange={(e) => set('website', e.target.value)} />
        <div className="c"><h2>البيانات الشخصية</h2><div className="g">
          <F k="nameAr" label="الاسم الكامل بالعربي" req form={form} set={set} /><F k="nameEn" label="الاسم بالإنجليزي" form={form} set={set} />
          <F k="nationality" label="الجنسية" form={form} set={set} /><F k="dob" label="تاريخ الميلاد" type="date" form={form} set={set} />
          <F k="mobile" label="رقم الجوال" req inputMode="tel" form={form} set={set} /><F k="email" label="البريد الإلكتروني" req type="email" form={form} set={set} />
          <F k="city" label="المدينة" form={form} set={set} /><F k="address" label="العنوان" form={form} set={set} /></div></div>
        <div className="c"><h2>الهوية والجواز</h2><div className="g">
          <F k="idNo" label="رقم الهوية / الإقامة" form={form} set={set} /><F k="idExpiry" label="انتهاء الهوية / الإقامة" type="date" form={form} set={set} />
          <F k="passportNo" label="رقم الجواز" form={form} set={set} /><F k="passportExpiry" label="انتهاء الجواز" type="date" form={form} set={set} /></div></div>
        <div className="c"><h2>الوظيفة والخبرة</h2><div className="g">
          <F k="position" label="الوظيفة المتقدم لها" req form={form} set={set} /><F k="education" label="المؤهل العلمي" form={form} set={set} />
          <F k="experienceYears" label="سنوات الخبرة" type="number" min="0" form={form} set={set} /><F k="currentEmployer" label="جهة العمل الحالية" form={form} set={set} />
          <F k="expectedSalary" label="الراتب المتوقع" type="number" min="0" form={form} set={set} /><F k="availability" label="تاريخ الجاهزية للمباشرة" type="date" form={form} set={set} /></div></div>
        <div className="c"><h2>البيانات البنكية (اختياري)</h2><div className="g">
          <F k="bank" label="اسم البنك" form={form} set={set} /><F k="iban" label="رقم الآيبان IBAN" dir="ltr" form={form} set={set} /></div></div>
        <div className="c"><h2>المستندات</h2>
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={addFiles} />
          <div style={{ fontSize: 12, color: '#678', margin: '6px 0' }}>PDF / JPG / PNG — حتى 5MB للملف، وبحد أقصى 10 ملفات. حدد نوع كل ملف.</div>
          {files.map((x, i) => <div className="fl" key={i}><span>📎 {x.file.name}</span>
            <select value={x.type} onChange={(e) => setFiles((a) => a.map((y, j) => (j === i ? { ...y, type: e.target.value } : y)))}>{DOCS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <button type="button" onClick={() => setFiles((a) => a.filter((_, j) => j !== i))}>✕</button></div>)}</div>
        <div className="c"><label>ملاحظات إضافية</label><textarea rows={3} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} /></div>
        {err && <div className="e">{err}</div>}
        <button className="b" disabled={busy}>{busy ? 'جارٍ الإرسال…' : 'إرسال الطلب'}</button>
      </form>
    </div>
  );
}
