import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { T, getLang } from '../../lib/i18n.js';
import { readImage } from '../../lib/images.js';
import { printHtml, wrapLetterhead } from '../../lib/print.js';
import { toast } from '../../components/Toast.jsx';
import { Card, useSaveSetting } from './shared.jsx';

const isEN = () => getLang() === 'en';
const mmv = (v, d) => { const n = Number(v); return isFinite(n) && n >= 0 && n <= 120 ? n : d; };
const CK = 'ariba_lh_compact_v1';
const sample = () => '<div style="padding:10mm 12mm;font-family:Arial,Tahoma,sans-serif;direction:' + (isEN() ? 'ltr' : 'rtl') + '"><h2 style="margin:0 0 8mm">' + T('نموذج تجريبي', 'Sample form') + '</h2><div style="line-height:2;font-size:13px">' + T('هذا نموذج تجريبي لمعاينة الورق الرسمي.', 'This is a sample to preview the official letterhead.') + '<br>' + T('النص بيبدأ تحت الهيدر وبينتهي فوق الفوتر.', 'Text starts below the header and ends above the footer.') + '</div></div>';

export default function LetterheadCard() {
  const { settings } = useApp(); const save = useSaveSetting();
  const [C, setC] = useState(null); const [stat, setStat] = useState(''); const [keep, setKeep] = useState(false);
  const [compact, setCompact] = useState(() => { try { return localStorage.getItem(CK) !== '0'; } catch { return true; } });
  useEffect(() => { const v = settings.letterhead; setC(v && (v.mode === 'page' || v.mode === 'hf') ? v : null); }, [settings.letterhead]);
  const mode = C ? C.mode : 'default';
  const say = (m, ok) => { setKeep(true); setStat(m + ' — ' + (ok ? T('اتحفظ على السيرفر ✓', 'Saved to the server ✓') : T('ما اتحفظش على السيرفر', 'Not saved to the server'))); setTimeout(() => setKeep(false), 6000); };
  const commit = async (n, msg) => { setC(n && n.mode !== 'default' ? n : null); const ok = await save('letterhead', 'letterhead', n || { mode: 'default', updated: Date.now() }, msg); say(msg, ok); };
  const setMode = (m) => {
    if (m === 'default') return commit(null, T('رجع الافتراضي (بدون ورق رسمي)', 'Default restored (no letterhead)'));
    const p = C || {}; setC({ mode: m, page: p.page || '', head: p.head || '', foot: p.foot || '', top: p.top ?? 42, bottom: p.bottom ?? 30, updated: Date.now() });
  };
  const up = (field, opts, msg) => async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try { const d = await readImage(f, opts); const base = field === 'page' ? { mode: 'page', head: '', foot: '' } : { mode: 'hf', page: '' }; await commit({ top: 42, bottom: 30, ...(C || {}), ...base, [field]: d, preset: undefined, updated: Date.now() }, msg); }
    catch { toast(T('تعذر قراءة الصورة', 'Could not read the image'), 'ter'); }
    ev.target.value = '';
  };
  const margin = () => { if (!C || C.mode !== 'page') return; commit({ ...C, top: mmv(C.top, 42), bottom: mmv(C.bottom, 30), updated: Date.now() }, T('اتحفظت الهوامش', 'Margins saved')); };
  const preset = () => commit({ mode: 'hf', preset: 'ariba', page: '', head: '', foot: '', top: 42, bottom: 30, updated: Date.now() }, T('اتفعّل ورق أريبا الجاهز', 'Ariba letterhead enabled'));
  const test = () => printHtml(T('طباعة تجريبية', 'Test print'), wrapLetterhead(C, sample()));
  const pv = useMemo(() => '<!doctype html><html dir="' + (isEN() ? 'ltr' : 'rtl') + '"><head><meta charset="utf-8"><style>body{margin:0;background:#fff}</style></head><body>' + wrapLetterhead(C, sample()) + '</body></html>', [C]);
  const text = stat && keep ? stat : ({ default: T('افتراضي: بدون ورق رسمي', 'Default: no letterhead'), page: T('خلفية ورقة كاملة', 'Full-page background'), hf: T('هيدر + فوتر', 'Header + footer') })[mode];
  const setM = (k, v) => setC((c) => ({ ...c, [k]: v }));
  return (
    <Card icon="file-text" title={T('الورق الرسمي للطباعة (النماذج والمخالصة والتقارير)', 'Official letterhead (forms, settlement & reports)')} id="LH_CARD">
      <div className="row">
        <div style={{ flex: 1, minWidth: 260 }}>
          <label className="opt"><input type="radio" name="LH_MODE" value="default" checked={mode === 'default'} onChange={() => setMode('default')} /> {T('افتراضي (بدون ورق رسمي)', 'Default (no letterhead)')}</label>
          <label className="opt"><input type="radio" name="LH_MODE" value="page" checked={mode === 'page'} onChange={() => setMode('page')} /> {T('خلفية ورقة كاملة (A4)', 'Full-page background (A4)')}</label>
          <label className="opt"><input type="radio" name="LH_MODE" value="hf" checked={mode === 'hf'} onChange={() => setMode('hf')} /> {T('هيدر + فوتر منفصلين', 'Separate header + footer')}</label>
          <div id="LH_PAGE_BOX" style={{ display: mode === 'page' ? '' : 'none', marginTop: 8 }}>
            <label className="lb">{T('صورة الورق الرسمي (ورقة A4 كاملة)', 'Letterhead image (full A4 page)')}</label>
            <input type="file" id="LH_PAGE" accept="image/png,image/jpeg,image/webp" style={{ width: '100%', fontSize: 12 }} onChange={up('page', { maxW: 1240, maxH: 1754, maxLen: 520000 }, T('اتغيّر الورق الرسمي', 'Letterhead updated'))} />
            <div style={{ display: 'flex', gap: 14, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div><label className="lb">{T('هامش من فوق (مم)', 'Top margin (mm)')}</label><input type="number" id="LH_TOP" min="0" max="120" value={mmv(C && C.top, 42)} onChange={(e) => setM('top', e.target.value)} onBlur={margin} /></div>
              <div><label className="lb">{T('هامش من تحت (مم)', 'Bottom margin (mm)')}</label><input type="number" id="LH_BOT" min="0" max="120" value={mmv(C && C.bottom, 30)} onChange={(e) => setM('bottom', e.target.value)} onBlur={margin} /></div>
            </div>
          </div>
          <div id="LH_HF_BOX" style={{ display: mode === 'hf' ? '' : 'none', marginTop: 8 }}>
            <button type="button" className="btn bsm" id="LH_ARIBA" style={{ marginBottom: 8 }} onClick={preset}>{T('استخدام ورق أريبا الجاهز (هيدر + فوتر)', 'Use the ready Ariba letterhead (header + footer)')}</button>
            <label className="lb">{T('صورة الهيدر (أعلى الورقة)', 'Header image (top)')}</label>
            <input type="file" id="LH_HEAD" accept="image/png,image/jpeg,image/webp" style={{ width: '100%', fontSize: 12 }} onChange={up('head', { maxW: 1800, maxH: 700, maxLen: 320000 }, T('اتغيّر الهيدر', 'Header updated'))} />
            <label className="lb" style={{ marginTop: 8 }}>{T('صورة الفوتر (أسفل الورقة)', 'Footer image (bottom)')}</label>
            <input type="file" id="LH_FOOT" accept="image/png,image/jpeg,image/webp" style={{ width: '100%', fontSize: 12 }} onChange={up('foot', { maxW: 1800, maxH: 500, maxLen: 260000 }, T('اتغيّر الفوتر', 'Footer updated'))} />
          </div>
          <label className="opt" style={{ marginTop: 12 }}><input type="checkbox" id="LH_COMPACT" checked={compact} onChange={(e) => { setCompact(e.target.checked); try { localStorage.setItem(CK, e.target.checked ? '1' : '0'); } catch { /* ignore */ } setKeep(true); setStat(e.target.checked ? T('اتفعّل الورق الموسّع', 'Expanded letterhead on') : T('رجع الهيدر الكامل', 'Full header restored')); setTimeout(() => setKeep(false), 6000); }} /> {T('ورق أريبا الموسّع: يقصّ الجزء الفاضي من أسفل الهيدر (بتدرج ناعم) ويستغل المساحة الفاضية فوق الفوتر، فالنموذج يملا الصفحة أكتر', 'Expanded Ariba letterhead: trims the empty bottom of the header (soft fade) and uses the empty space above the footer so the form fills more of the page')}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn bpl bsm" id="LH_TEST" onClick={test}><i className="ti ti-printer" /> {T('طباعة تجريبية', 'Test print')}</button>
            <span id="LH_STAT" style={{ fontSize: 12, color: 'var(--mu)' }}>{text}</span>
          </div>
        </div>
        <div id="LH_PV"><iframe id="LH_FRAME" title="preview" sandbox="" srcDoc={pv} /></div>
      </div>
    </Card>
  );
}
