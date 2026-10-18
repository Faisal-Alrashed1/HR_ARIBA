import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { T } from '../../lib/i18n.js';
import { DEFC, PRESETS, brandValue, applyBrand, validHex, palette, rgb2hex, hsl2rgb, rgb2hsl, hex2rgb } from '../../lib/brand.js';
import { functionCall } from '../../lib/api.js';
import { setSetting } from '../../lib/api.js';
import { toast } from '../../components/Toast.jsx';
import { Card } from './shared.jsx';

const DARK = ['#014D3D', '#0F766E', '#065F46', '#15803D', '#1E3A8A', '#1D4ED8', '#0369A1', '#0E7490', '#581C87', '#7E22CE', '#9D174D', '#BE123C', '#7C2D12', '#B45309', '#92400E', '#111827', '#1F2937', '#374151', '#0F172A', '#4C1D95'];
const MID = ['#29B35E', '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E', '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#64748B', '#78716C'];
const LIGHT = ['#F4F0E4', '#FFFFFF', '#F8FAFC', '#F1F5F9', '#EAF0FA', '#E8F5F3', '#ECFDF5', '#F0FDF4', '#FEFCE8', '#FFFBEB', '#FFF7ED', '#FEF2F2', '#FDF2F8', '#FAF5FF', '#F5F3FF', '#EEF2FF', '#F0F9FF', '#FBF0E6', '#F3EBFA', '#EEEFF2'];
const autoAccent = (p) => { const h = rgb2hsl(hex2rgb(p)); return rgb2hex(hsl2rgb(h[0], 0.6, 0.43)); };
const lbl = { fontSize: 11, color: 'var(--mu)', fontWeight: 600, display: 'block', marginBottom: 4 };
const Sw = ({ c, onPick }) => <button type="button" data-c={c} title={c} onClick={() => onPick(c)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(0,0,0,.18)', background: c, cursor: 'pointer', padding: 0 }} />;

export default function BrandCard() {
  const { settings, patchSettings } = useApp();
  const [B, setB] = useState({ p: DEFC.p, s: DEFC.s, a: '' }); const [stat, setStat] = useState(''); const [keep, setKeep] = useState(false);
  const [target, setTarget] = useState('p'); const [url, setUrl] = useState(''); const [found, setFound] = useState(null);
  const timer = useRef(null); const savedBrand = settings.brand && settings.brand.p && !settings.brand.reset ? settings.brand : null;
  useEffect(() => { setB(savedBrand ? { p: savedBrand.p, s: savedBrand.s, a: savedBrand.a || '' } : { p: DEFC.p, s: DEFC.s, a: '' }); }, [savedBrand && savedBrand.p, savedBrand && savedBrand.s, savedBrand && savedBrand.a]); // eslint-disable-line
  useEffect(() => () => clearTimeout(timer.current), []);
  const say = (m, ok) => { setKeep(true); setStat(m + ' — ' + (ok ? T('اتحفظ على السيرفر ✓ (بيظهر عند كل المستخدمين)', 'Saved to the server ✓ (everyone sees it)') : T('اتحفظ على الجهاز ده بس — ما اتبعتش للسيرفر', 'Saved on this device only — not sent to the server'))); setTimeout(() => setKeep(false), ok ? 6000 : 60000); };
  const commit = async (n, msg) => { // n=null → رجوع للألوان الأصلية
    clearTimeout(timer.current);
    const val = brandValue(n ? { p: n.p, s: n.s, a: n.a || '' } : null, settings.punch && settings.punch.data);
    applyBrand(n && validHex(n.p) && validHex(n.s) ? n : null);
    let ok = true; try { await setSetting('brand_colors', val); patchSettings('brand', val); } catch { ok = false; toast(T('تعذر الحفظ على السيرفر', 'Could not save to the server'), 'ter'); }
    say(msg, ok);
  };
  const live = (n) => { setB(n); if (validHex(n.p) && validHex(n.s)) applyBrand(n); clearTimeout(timer.current); timer.current = setTimeout(() => { if (validHex(n.p) && validHex(n.s)) commit(n, T('اتحفظ تلقائياً', 'Auto-saved')); }, 1200); };
  const pick = (hex) => { const k = hex.toLowerCase(); const n = { ...B, [target]: k }; if (target === 'a') n.a = k; live(n); };
  const pal = validHex(B.p) && validHex(B.s) ? palette(B) : palette(DEFC);
  const cust = !!savedBrand; const swPv = { width: 34, height: 34, borderRadius: 8 };
  const inp = { width: 54, height: 36, padding: 0, border: '1px solid var(--bd)', borderRadius: 8, background: 'transparent', cursor: 'pointer' };
  const extract = async () => {
    const u = url.trim(); if (!u) { setFound({ msg: T('اكتب لينك موقع الشركة', 'Enter the website link') }); return; }
    setFound({ msg: T('جاري القراءة…', 'Reading…') });
    try {
      const j = await functionCall('ariba-brand-colors', { url: u });
      if (!j || !j.ok) { setFound({ msg: T('تعذر قراءة الموقع (', 'Could not read the site (') + ((j && j.error) || '?') + ')' }); return; }
      const list = (j.theme_color ? [j.theme_color] : []).concat((j.colors || []).map((x) => x.color)).filter((v, i, a) => validHex(v) && a.indexOf(v) === i);
      if (!list.length) { setFound({ msg: T('مفيش ألوان واضحة في الصفحة', 'No clear colors found') }); return; }
      setFound({ list });
    } catch { setFound({ msg: T('تعذر الاتصال', 'Connection failed') }); }
  };
  const radio = (id, l) => <label style={{ fontSize: 12, display: 'inline-flex', gap: 4, alignItems: 'center', marginInlineEnd: 12 }}><input type="radio" name="BR_T" value={id} checked={target === id} onChange={() => setTarget(id)} /> {l}</label>;
  return (
    <Card icon="palette" title={T('ألوان البرنامج', 'Program colors')} id="BR_CARD">
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><label style={lbl}>{T('اللون الأساسي (الأخضر)', 'Primary color (green)')}</label><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="color" id="BR_P" style={inp} value={validHex(B.p) ? B.p : DEFC.p} onChange={(e) => live({ ...B, p: e.target.value })} /><input type="text" dir="ltr" maxLength={7} id="BR_PX" value={B.p} placeholder="#014D3D" onChange={(e) => { let v = e.target.value.trim(); if (v && v[0] !== '#') v = '#' + v; setB({ ...B, p: v }); if (validHex(v)) live({ ...B, p: v }); }} style={{ width: 84, fontFamily: 'monospace', fontSize: 12, background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '6px 8px' }} /></div></div>
        <div><label style={lbl}>{T('لون الخلفية الفاتحة (البيج)', 'Light background (beige)')}</label><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="color" id="BR_S" style={inp} value={validHex(B.s) ? B.s : DEFC.s} onChange={(e) => live({ ...B, s: e.target.value })} /><input type="text" dir="ltr" maxLength={7} id="BR_SX" value={B.s} placeholder="#014D3D" onChange={(e) => { let v = e.target.value.trim(); if (v && v[0] !== '#') v = '#' + v; setB({ ...B, s: v }); if (validHex(v)) live({ ...B, s: v }); }} style={{ width: 84, fontFamily: 'monospace', fontSize: 12, background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '6px 8px' }} /></div></div>
        <div><label style={lbl}>{T('اللون المميز (الأزرار والروابط)', 'Accent (buttons & links)')}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" id="BR_A" style={inp} value={validHex(B.a) ? B.a : autoAccent(validHex(B.p) ? B.p : DEFC.p)} onChange={(e) => live({ ...B, a: e.target.value })} /><input type="text" dir="ltr" maxLength={7} id="BR_AX" value={B.a} placeholder="#014D3D" onChange={(e) => { let v = e.target.value.trim(); if (v && v[0] !== '#') v = '#' + v; setB({ ...B, a: v }); if (validHex(v)) live({ ...B, a: v }); }} style={{ width: 84, fontFamily: 'monospace', fontSize: 12, background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '6px 8px' }} />
            <label style={{ fontSize: 11.5 }}><input type="checkbox" id="BR_AUTO" checked={!B.a} onChange={(e) => live({ ...B, a: e.target.checked ? '' : autoAccent(B.p) })} /> {T('تلقائي من اللون الأساسي', 'Auto from the primary')}</label>
          </div></div>
        <div id="BR_PV"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ ...swPv, background: pal.P }} /><span style={{ ...swPv, background: pal.A }} /><span style={{ ...swPv, background: pal.S, border: '1px solid ' + pal.bdL }} /><span style={{ ...swPv, background: pal.dBg }} /><span style={{ ...swPv, background: pal.dC2 }} /></div></div>
      </div>
      <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--mu)' }}>{T('ألوان جاهزة: ', 'Presets: ')}</div>
      <div id="BR_PRE" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {PRESETS.map((p) => <button key={p[0]} type="button" className="btn bsm" style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={() => { const orig = p[0] === DEFC.p && p[1] === DEFC.s; setB({ p: p[0], s: p[1], a: '' }); commit(orig ? null : { p: p[0], s: p[1], a: '' }, T('اتطبق: ', 'Applied: ') + T(p[2], p[3])); }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: p[0] }} /><span style={{ width: 14, height: 14, borderRadius: 4, background: p[1], border: '1px solid #ccc' }} />{T(p[2], p[3])}</button>)}
      </div>
      <div id="BR_ALL" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>{T('كل الألوان — اختار اللون وبعدين اضغط عليه', 'All colors — pick, then click a swatch')}</div>
        <div style={{ marginBottom: 8 }}>{T('هتغيّر: ', 'Change: ')}{radio('p', T('الأساسي', 'Primary'))}{radio('a', T('المميز', 'Accent'))}{radio('s', T('الخلفية الفاتحة', 'Light background'))}</div>
        <div style={{ fontSize: 11, color: 'var(--mu)', margin: '4px 0' }}>{T('ألوان غامقة', 'Dark')}</div><div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{DARK.map((c) => <Sw key={c} c={c} onPick={pick} />)}</div>
        <div style={{ fontSize: 11, color: 'var(--mu)', margin: '8px 0 4px' }}>{T('ألوان متوسطة وزاهية', 'Medium & bright')}</div><div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{MID.map((c) => <Sw key={c} c={c} onPick={pick} />)}</div>
        <div style={{ fontSize: 11, color: 'var(--mu)', margin: '8px 0 4px' }}>{T('ألوان فاتحة (للخلفية)', 'Light (backgrounds)')}</div><div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{LIGHT.map((c) => <Sw key={c} c={c} onPick={pick} />)}</div>
        <div style={{ fontWeight: 700, fontSize: 12.5, margin: '14px 0 6px' }}>{T('أو خد ألوان الشركة من موقعها', 'Or take the company colors from its website')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" id="BR_URL" dir="ltr" placeholder="https://www.company.com" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1, minWidth: 220, background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '7px 10px', fontSize: 12 }} />
          <button type="button" className="btn bgr bsm" id="BR_FETCH" onClick={extract}>{T('استخرج الألوان', 'Extract colors')}</button>
        </div>
        <div id="BR_FOUND" style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 11.5, color: 'var(--mu)' }}>
          {found && (found.msg ? found.msg : <>{T('اضغط على لون لتطبيقه على الخانة المختارة: ', 'Click a color to apply it to the selected field: ')}{found.list.map((c) => <Sw key={c} c={c} onPick={pick} />)}</>)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn bpl bsm" id="BR_SAVE" onClick={() => commit(B, T('اتحفظ', 'Saved'))}><i className="ti ti-device-floppy" /> {T('تطبيق وحفظ', 'Apply & save')}</button>
        <button type="button" className="btn bgr bsm" id="BR_RESET" onClick={() => { setB({ p: DEFC.p, s: DEFC.s, a: '' }); commit(null, T('رجعت الألوان الأصلية', 'Original colors restored')); }}>{T('رجوع للألوان الأصلية', 'Restore the original colors')}</button>
        <span id="BR_STAT" style={{ fontSize: 12, color: 'var(--mu)' }}>{keep && stat ? stat : (cust ? T('ألوان مخصصة', 'Custom colors') : T('الألوان الأصلية', 'Original colors'))}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 8, lineHeight: 1.7 }}>{T('الألوان بتتطبق على الوضع الفاتح والليلي. بعض الرسومات (الرسوم البيانية وورق الطباعة الرسمي) ليها ألوانها الخاصة.', 'The colors apply to the light and dark modes. Some graphics (charts and the official letterhead) keep their own colors.')}</div>
    </Card>
  );
}
