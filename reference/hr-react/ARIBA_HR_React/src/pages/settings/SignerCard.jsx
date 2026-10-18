import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { T, getLang } from '../../lib/i18n.js';
import { readImage } from '../../lib/images.js';
import { signerOf, safeImg } from '../../lib/branding.js';
import { toast } from '../../components/Toast.jsx';
import { useSaveSetting } from './shared.jsx';

const DEF = { empId: 'default', nameAr: '', nameEn: '', titleAr: 'مدير الموارد البشرية', titleEn: 'Human Resources Manager', nameFmt: 'full', useSig: true, useStamp: true, sigs: {}, stamp: '' };

// يقصّ الحواف الشفافة حوالين الرسمة (زي procImage القديمة)
function cropAlpha(url) {
  return new Promise((res) => {
    const im = new Image();
    im.onerror = () => res(url);
    im.onload = () => {
      const w = im.width, h = im.height, c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const a = x.getImageData(0, 0, w, h).data; let minX = w, minY = h, maxX = 0, maxY = 0;
      for (let i = 3; i < a.length; i += 4) if (a[i] > 20) { const p = (i - 3) / 4, px = p % w, py = (p - px) / w; if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; }
      if (maxX <= minX || maxY <= minY) { res(url); return; }
      const cw = maxX - minX + 1, ch = maxY - minY + 1, o = document.createElement('canvas'); o.width = cw; o.height = ch;
      o.getContext('2d').drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch); res(o.toDataURL('image/png'));
    };
    im.src = url;
  });
}

function Box({ en, g }) {
  const name = en ? g.nameEn : g.nameAr, title = en ? g.titleEn : g.titleAr;
  const showSig = g.useSig && g.sig, showStamp = g.useStamp && g.stamp;
  const k = 30 / 33 * 1.7, W = (v) => (v * k).toFixed(1) + 'mm';
  return (
    <div className="bx" dir={en ? 'ltr' : 'rtl'} style={{ width: W(48), height: '30mm' }}>
      <div style={{ fontWeight: 800, fontSize: 12 }}>{title}</div>
      {showStamp && <img src={g.stamp} alt="" style={{ position: 'absolute', width: W(25), left: '50%', marginLeft: '-' + W(3), top: W(4) }} />}
      {showSig && <img src={g.sig} alt="" style={{ position: 'absolute', width: W(30), left: '50%', marginLeft: '-' + W(29), top: W(10), mixBlendMode: 'multiply' }} />}
      {!showSig && <div style={{ position: 'absolute', left: '12%', right: '12%', bottom: W(5), borderTop: '1px solid #333' }} />}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontWeight: 800, fontSize: 12 }}>{name}</div>
    </div>
  );
}

export default function SignerCard() {
  const { settings, employees } = useApp(); const save = useSaveSetting();
  const [S, setS] = useState(DEF);
  const [stat, setStat] = useState({ t: '', ok: true });
  useEffect(() => { const s = settings.signer || {}; setS({ ...DEF, ...s, sigs: { ...(s.sigs || {}) } }); }, [settings.signer]);
  const key = S.empId || 'default';
  const isEn = getLang() === 'en';
  const persist = async (next, msg) => {
    const ok = await save('signer', 'hr_signer', { ...next, updated: Date.now() }, msg);
    setStat({ t: (msg ? msg + ' — ' : '') + (ok ? T('اتحفظ على السيرفر ✓', 'Saved to the server ✓') : T('تعذر الحفظ على السيرفر', 'Could not save to the server')), ok });
  };
  const list = [...employees].sort((a, b) => String(a.nameAr || '').localeCompare(String(b.nameAr || ''), 'ar'));
  const chooseEmp = (id) => { const e = id === 'default' ? null : employees.find((x) => String(x.id) === id); setS((s) => ({ ...s, empId: id, ...(e ? { nameAr: e.nameAr || '', nameEn: e.nameEn || '' } : {}) })); };
  const upImg = (kind) => async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const d = await cropAlpha(await readImage(f, { maxW: kind === 'sig' ? 520 : 420, maxH: kind === 'sig' ? 520 : 420, maxLen: 200000, whiteToAlpha: true }));
      const n = kind === 'sig' ? { ...S, sigs: { ...S.sigs, [key]: d } } : { ...S, stamp: d };
      setS(n); await persist(n, kind === 'sig' ? T('اتحدّث التوقيع', 'Signature updated') : T('اتحدّث الختم', 'Stamp updated'));
    } catch { toast(T('تعذر قراءة الصورة', 'Could not read the image'), 'ter'); }
    ev.target.value = '';
  };
  const pv = signerOf({ signer: S }, employees);
  const g = { ...pv, useSig: S.useSig !== false, useStamp: S.useStamp !== false, titleAr: S.titleAr || DEF.titleAr, titleEn: S.titleEn || DEF.titleEn, stamp: safeImg(S.stamp) };
  const hasSig = !!pv.sig;
  return (
    <div className="card hs-card" id="HS_CARD" style={{ marginTop: 12, maxWidth: 900, padding: 12 }}>
      <div className="ct" style={{ marginBottom: 8 }}><i className="ti ti-signature" /> {T('مدير الموارد البشرية والتوقيع والختم (لكل النماذج)', 'HR manager, signature & stamp (all forms)')}</div>
      <div className="hs-note" style={{ marginBottom: 8 }}>{T('الاسم والمسمى والتوقيع والختم اللي هنا بيظهروا في كل النماذج وخطابات الراتب بعد كده (على يسار الورقة في العربي، وعلى اليمين في الإنجليزي).', 'The name, title, signature and stamp set here appear on every form and letter (left side in Arabic, right side in English).')}</div>
      <div className="row">
        <div><label>{T('مدير الموارد البشرية', 'HR manager')}</label>
          <select id="HS_EMP" value={String(S.empId || 'default')} onChange={(e) => chooseEmp(e.target.value)}>
            <option value="default">{T('افتراضي (بدون اسم أو توقيع)', 'Default (no name or signature)')}</option>
            {list.map((e) => <option key={e.id} value={String(e.id)}>{isEn ? (e.nameEn || e.nameAr) : (e.nameAr || e.nameEn)}</option>)}
          </select></div>
        <div><label>{T('المسمى بالعربي', 'Title (Arabic)')}</label><input type="text" id="HS_TA" value={S.titleAr || ''} onChange={(e) => setS({ ...S, titleAr: e.target.value })} /></div>
        <div><label>{T('المسمى بالإنجليزي', 'Title (English)')}</label><input type="text" id="HS_TE" style={{ direction: 'ltr' }} value={S.titleEn || ''} onChange={(e) => setS({ ...S, titleEn: e.target.value })} /></div>
      </div>
      <div className="row"><div><label>{T('شكل الاسم في التوقيع', 'Name format on the signature')}</label>
        <select id="HS_FMT" value={S.nameFmt || 'full'} onChange={(e) => setS({ ...S, nameFmt: e.target.value })}>
          <option value="full">{T('الاسم كامل', 'Full name')}</option><option value="fl">{T('الاسم الأول والعائلة', 'First + family name')}</option>
          <option value="ff">{T('الاسم الأول والأب', 'First + father')}</option><option value="ffl">{T('الأول والأب والعائلة', 'First + father + family')}</option>
        </select></div></div>
      <div className="row">
        <div><label>{T('توقيع المدير المختار', 'Signature of the selected manager')}</label><input type="file" id="HS_SIGFILE" accept="image/*" onChange={upImg('sig')} />
          <div className="hs-note">{T('ارفع صورة التوقيع (PNG/JPG) — الخلفية البيضاء بتتشال تلقائياً.', 'Upload the signature image (PNG/JPG) — the white background is removed automatically.')}</div></div>
        <div><label>{T('ختم الشركة', 'Company stamp')}</label><input type="file" id="HS_STAMPFILE" accept="image/*" onChange={upImg('stamp')} />
          <div className="hs-note"><a href="#" id="HS_STAMPRESET" onClick={(ev) => { ev.preventDefault(); const n = { ...S, stamp: '' }; setS(n); persist(n, T('اتشال الختم', 'Stamp removed')); }}>{T('إزالة الختم', 'Remove the stamp')}</a></div></div>
      </div>
      <div id="HS_WARN" style={{ display: (!hasSig && S.empId && S.empId !== 'default') ? 'block' : 'none', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.4)', color: 'var(--am)', borderRadius: 8, padding: '7px 10px', fontSize: 12, marginBottom: 8 }}>{T('لسه ما اترفعش توقيع للمدير ده — هيظهر اسمه بخط للتوقيع لحد ما ترفعه.', 'No signature uploaded for this manager yet — his name will show with a signature line until you upload it.')}</div>
      <div className="row" style={{ alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, margin: 0 }}><input type="checkbox" id="HS_USESIG" checked={S.useSig !== false} onChange={(e) => setS({ ...S, useSig: e.target.checked })} /> {T('إظهار التوقيع', 'Show signature')}</label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, margin: 0 }}><input type="checkbox" id="HS_USESTAMP" checked={S.useStamp !== false} onChange={(e) => setS({ ...S, useStamp: e.target.checked })} /> {T('إظهار ختم الشركة', 'Show company stamp')}</label>
      </div>
      <div className="hs-prev" id="HS_PREV"><Box g={g} /><Box en g={g} /></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button type="button" className="btn bpl bsm" id="HS_SAVE" onClick={() => { const e = (S.empId && S.empId !== 'default') ? employees.find((x) => String(x.id) === String(S.empId)) : null; const n = { ...S, titleAr: (S.titleAr || '').trim() || DEF.titleAr, titleEn: (S.titleEn || '').trim() || DEF.titleEn, nameAr: e ? e.nameAr || S.nameAr : S.nameAr, nameEn: e ? e.nameEn || S.nameEn : S.nameEn }; setS(n); persist(n, T('اتحفظ', 'Saved')); }}><i className="ti ti-device-floppy" /> {T('حفظ', 'Save')}</button>
        <button type="button" className="btn bgr bsm" id="HS_DELSIG" onClick={() => { const sigs = { ...S.sigs }; delete sigs[key]; const n = { ...S, sigs }; setS(n); persist(n, T('اتحذف التوقيع', 'Signature removed')); }}>{T("حذف توقيع المدير المختار", "Remove selected manager's signature")}</button>
        <span id="HS_STAT" style={{ fontSize: 12, color: stat.ok ? 'var(--gr)' : 'var(--am)' }}>{stat.t}</span>
      </div>
    </div>
  );
}
