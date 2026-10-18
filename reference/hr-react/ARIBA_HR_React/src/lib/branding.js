// الشعار والموقّع من إعدادات الشركة (سحابية) — للطباعة
const fmtName = (n, f) => { const p = String(n || '').trim().split(/\s+/).filter(Boolean); if (p.length <= 1 || !f || f === 'full') return p.join(' '); if (f === 'fl') return p[0] + ' ' + p[p.length - 1]; if (f === 'ff') return p[0] + ' ' + p[1]; if (f === 'ffl') return p.length >= 3 ? (p[0] + ' ' + p[1] + ' ' + p[p.length - 1]) : p.join(' '); return p.join(' '); };
export const safeImg = (s) => (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(String(s || '')) ? s : '');
export const logoOf = (settings) => safeImg(settings && settings.logo && (settings.logo.data || settings.logo));
export function signerOf(settings, employees) {
  const S = (settings && settings.signer) || {}; const o = { titleAr: S.titleAr || 'مدير الموارد البشرية', titleEn: S.titleEn || 'HR Manager', nameAr: '', nameEn: '', sig: '', stamp: safeImg(S.stamp), useSig: S.useSig !== false, useStamp: S.useStamp !== false };
  if (S.empId && S.empId !== 'default') {
    const e = (employees || []).find((x) => String(x.id) === String(S.empId));
    const ar = (e && e.nameAr) || S.nameAr || '', en = (e && e.nameEn) || S.nameEn || ar;
    o.nameAr = fmtName(ar, S.nameFmt || 'full'); o.nameEn = fmtName(en, S.nameFmt || 'full'); o.sig = safeImg(S.sigs && S.sigs[S.empId]);
  }
  return o;
}
