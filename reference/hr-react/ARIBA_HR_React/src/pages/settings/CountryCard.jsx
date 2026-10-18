import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppStore.jsx';
import { DEF, rules as egRules } from '../../engines/country.js';
import { rt } from '../../engines/runtime.js';
import { T } from '../../lib/i18n.js';
import PromptModal from '../../components/PromptModal.jsx';
import { Card, Note, useSaveSetting } from './shared.jsx';

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const clone = (o) => JSON.parse(JSON.stringify(o));
const Fld = ({ id, label, val, set, step }) => <div><label style={{ fontSize: 11 }}>{label}</label><input type="number" id={id} step={step || 'any'} value={val ?? ''} onChange={(e) => set(e.target.value)} /></div>;
const tinp = { width: '100%', minWidth: 92, maxWidth: 130, textAlign: 'center', padding: '6px 4px' };

function validate(R) {
  if (R.insEmp < 0 || R.insEmp > 50 || R.insEr < 0 || R.insEr > 50) return T('نسب التأمينات لازم تكون بين 0 و50', 'Insurance rates must be between 0 and 50');
  const b = R.taxBrackets; if (!b.length) return T('أضف شريحة ضريبة واحدة على الأقل', 'Add at least one tax bracket');
  for (let i = 1; i < b.length; i++) if (b[i - 1][1] === null || Math.abs(b[i - 1][1] - b[i][0]) > 0.001) return T('شرائح الضريبة لازم تكون متصلة (نهاية كل شريحة = بداية اللي بعدها)', 'Tax brackets must be contiguous');
  if (b[b.length - 1][1] !== null) return T('آخر شريحة لازم تكون مفتوحة (من غير "إلى")', 'The last bracket must be open-ended');
  return '';
}

export default function CountryCard() {
  const { settings } = useApp(); const save = useSaveSetting();
  const cur = rt.country === 'EG' ? 'EG' : 'SA';
  const [pick, setPick] = useState(cur);
  const [R, setR] = useState(() => egRules());
  const [msg, setMsg] = useState(''); const [bad, setBad] = useState(false);
  const [ask, setAsk] = useState(null);
  useEffect(() => { setPick(rt.country === 'EG' ? 'EG' : 'SA'); setR(egRules()); }, [settings.country]);
  const cloud = () => (settings.country && typeof settings.country === 'object' ? settings.country : {});
  const say = (m, b) => { setMsg(m); setBad(!!b); };
  const apply = async () => { setAsk(null); const ok = await save('country', 'country_system', { mode: pick, rules: cloud().rules || null, updated: Date.now() }, T('تم التبديل', 'System switched')); if (ok) say(T('تم تطبيق النظام', 'System applied')); };
  const saveRules = async () => {
    const x = clone(R); x.insEmp = num(x.insEmp); x.insEr = num(x.insEr); x.martyrs = num(x.martyrs); x.taxExempt = num(x.taxExempt);
    ['leaveFirst', 'leaveStd', 'leaveSenior', 'seniorYears', 'seniorAge', 'arbMonths'].forEach((k) => { x[k] = num(x[k]); });
    x.taxBrackets = x.taxBrackets.map((b) => [num(b[0]), (b[1] === '' || b[1] === null) ? null : num(b[1]), num(b[2])]).sort((a, b) => a[0] - b[0]);
    const lim = {}; Object.keys(x.insLimits).forEach((k) => { const l = x.insLimits[k]; const y = Math.round(num(k)); if (y > 1990 && num(l[1]) > 0) lim[y] = [num(l[0]), num(l[1])]; }); x.insLimits = lim;
    const rs = x.resignTiers.map((t) => [(t[0] === '' || t[0] === null) ? null : num(t[0]), Math.max(0, Math.min(1, num(t[1])))]).sort((a, b) => (a[0] === null ? 1e9 : a[0]) - (b[0] === null ? 1e9 : b[0]));
    if (!rs.length || rs[rs.length - 1][0] !== null) rs.push([null, 1]); x.resignTiers = rs;
    const e = validate(x); if (e) { say(e, true); return; }
    const ok = await save('country', 'country_system', { mode: 'EG', rules: x, updated: Date.now() }, T('اتحفظت القواعد', 'Rules saved')); if (ok) say(T('اتحفظت القواعد على السيرفر ✓', 'Rules saved to the server ✓'));
  };
  const up = (k) => (v) => setR((s) => ({ ...s, [k]: v }));
  const limKeys = Object.keys(R.insLimits).sort();
  const _unusedOpt = (on) => ({ display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid ' + (on ? 'var(--gr)' : 'var(--bd)'), background: on ? 'rgba(16,185,129,.08)' : 'transparent', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', flex: 1, minWidth: 220 });
  const del = (fn) => <a href="#" style={{ color: 'var(--rd)' }} onClick={(e) => { e.preventDefault(); fn(); }}>✕</a>;
  return (
    <Card icon="world" title={T('إعدادات الشركة — نظام الدولة (السعودي / المصري)', 'Company — country system (Saudi / Egypt)')} max={1000} id="CN_CARD">
      <div className="cn-note" style={{ marginBottom: 10 }}>{T(<>اختار النظام اللي الشركة شغالة بيه. <b>السعودي</b> = التأمينات (GOSI) ونظام العمل السعودي كما هو. <b>المصري</b> = التأمينات الاجتماعية المصرية (قانون 148/2019) + ضريبة كسب العمل + صندوق الشهداء + قانون العمل 14/2025 (الإجازات ونهاية الخدمة) + الإجازات الرسمية المصرية + العملة الجنيه المصري. بيانات الموظفين نفسها مش بتتغير، والتبديل بيرجّعك لأي نظام في أي وقت.</>, <>Choose the system your company runs on. <b>Saudi</b> = GOSI and Saudi labor law as is. <b>Egyptian</b> = Egyptian social insurance (Law 148/2019) + income tax + martyrs fund + labor law 14/2025 (leave and end of service) + Egyptian public holidays + the Egyptian pound. Employee data is not changed and you can switch back at any time.</>)}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label className={'cn-opt' + (pick === 'SA' ? ' on' : '')}><input type="radio" name="cn_mode" value="SA" checked={pick === 'SA'} onChange={() => setPick('SA')} /><div><b>🇸🇦 {T('النظام السعودي', 'Saudi system')}</b><span>{T('GOSI · نظام العمل السعودي · الريال · إجازات المملكة', 'GOSI · Saudi labor law · Riyal · Kingdom holidays')}</span></div></label>
        <label className={'cn-opt' + (pick === 'EG' ? ' on' : '')}><input type="radio" name="cn_mode" value="EG" checked={pick === 'EG'} onChange={() => setPick('EG')} /><div><b>🇪🇬 {T('النظام المصري', 'Egyptian system')}</b><span>{T('التأمينات الاجتماعية · ضريبة الدخل · قانون العمل 14/2025 · الجنيه · إجازات مصر', 'Social insurance · income tax · labor law 14/2025 · Egyptian pound · Egypt holidays')}</span></div></label>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <button type="button" className="btn bpl bsm" id="CN_APPLY" onClick={() => { if (pick === cur) say(T('النظام ده هو المفعّل حاليًا', 'Already active')); else setAsk(pick); }}><i className="ti ti-check" /> {T('تطبيق النظام المختار', 'Apply selected system')}</button>
        <span id="CN_STAT" style={{ fontSize: 12, color: bad ? 'var(--rd)' : 'var(--gr)' }}>{msg}</span>
      </div>
      <PromptModal open={!!ask} noInput title={T('تأكيد تبديل النظام', 'Confirm switch')} message={ask === 'EG' ? T('هتحوّل البرنامج للنظام المصري (تأمينات + ضريبة + قانون عمل مصري + جنيه). المتابعة؟', 'Switch to the Egyptian system?') : T('هترجّع البرنامج للنظام السعودي. المتابعة؟', 'Switch back to the Saudi system?')} confirmText={T('تأكيد', 'Confirm')} onConfirm={apply} onClose={() => setAsk(null)} />
      {cur === 'EG' && (<>
        <hr style={{ border: 0, borderTop: '1px solid var(--bd)', margin: '14px 0' }} />
        <div className="ct" style={{ fontSize: 13, marginBottom: 6 }}>{T('قواعد النظام المصري (قابلة للتعديل لو القوانين اتغيّرت)', 'Egyptian rules (editable if the laws change)')}</div>
        <div className="cn-note" style={{ marginBottom: 8 }}>{T('القيم الافتراضية مطابقة لقانون التأمينات 148/2019 (حصة العامل 11% وصاحب العمل 18.75%) وقانون الضريبة 175/2023 (إعفاء شخصي 20,000 ج.م سنويًا وشرائح من 0% إلى 27.5%) وصندوق الشهداء 0.05% وقانون العمل 14/2025. راجع محاسبك أو مكتب التأمينات قبل الاعتماد.', 'Defaults follow insurance law 148/2019 (employee 11%, employer 18.75%), tax law 175/2023 (EGP 20,000 annual personal exemption, 0%–27.5% brackets), martyrs fund 0.05% and labor law 14/2025. Check with your accountant or the insurance office before relying on them.')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
          <Fld id="cn_insEmp" label={T('حصة العامل من التأمينات %', 'Employee insurance %')} val={R.insEmp} set={up('insEmp')} />
          <Fld id="cn_insEr" label={T('حصة صاحب العمل %', 'Employer insurance %')} val={R.insEr} set={up('insEr')} />
          <Fld id="cn_mart" label={T('صندوق الشهداء % من الإجمالي', 'Martyrs fund % of gross')} val={R.martyrs} set={up('martyrs')} />
          <Fld id="cn_exempt" label={T('الإعفاء الشخصي السنوي (ج.م)', 'Annual personal exemption (EGP)')} val={R.taxExempt} set={up('taxExempt')} />
          <Fld id="cn_lf" label={T('إجازة أول سنة (يوم)', 'First-year leave')} val={R.leaveFirst} set={up('leaveFirst')} />
          <Fld id="cn_ls" label={T('الإجازة السنوية العادية (يوم)', 'Standard annual leave (days)')} val={R.leaveStd} set={up('leaveStd')} />
          <Fld id="cn_lsen" label={T('إجازة بعد 10 سنوات / سن 50 (يوم)', 'Leave after 10 years / age 50 (days)')} val={R.leaveSenior} set={up('leaveSenior')} />
          <Fld id="cn_sy" label={T('سنوات الخدمة لإجازة 30 يوم', 'Years for senior leave')} val={R.seniorYears} set={up('seniorYears')} />
          <Fld id="cn_sa" label={T('السن لإجازة 30 يوم', 'Age for senior leave')} val={R.seniorAge} set={up('seniorAge')} />
          <Fld id="cn_arb" label={T('تعويض الفصل التعسفي (شهور عن كل سنة)', 'Arbitrary dismissal (months per year)')} val={R.arbMonths} set={up('arbMonths')} />
          <div><label style={{ fontSize: 11 }}>{T('عطلة نهاية الأسبوع', 'Weekend')}</label><select id="cn_wk" value={R.weekend === 'fri' ? 'fri' : 'fri_sat'} onChange={(e) => up('weekend')(e.target.value)}><option value="fri_sat">{T('الجمعة والسبت', 'Fri & Sat')}</option><option value="fri">{T('الجمعة فقط', 'Friday only')}</option></select></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{T('حدود الأجر التأميني (أدنى / أقصى شهريًا)', 'Insurable wage limits (monthly min / max)')}</div>
            <table className="cn" id="cn_lim" style={{ width: '100%', fontSize: 12, textAlign: 'center' }}><thead><tr><th>{T('السنة', 'Year')}</th><th>{T('الحد الأدنى', 'Minimum')}</th><th>{T('الحد الأقصى', 'Maximum')}</th><th /></tr></thead><tbody>
              {limKeys.map((y) => <tr key={y}><td><input type="number" style={tinp} defaultValue={y} onBlur={(e) => { const ny = String(Math.round(num(e.target.value))); if (ny === y) return; setR((s) => { const L = { ...s.insLimits }; L[ny] = L[y]; delete L[y]; return { ...s, insLimits: L }; }); }} /></td>
                <td><input type="number" style={tinp} value={R.insLimits[y][0]} onChange={(e) => setR((s) => ({ ...s, insLimits: { ...s.insLimits, [y]: [e.target.value, s.insLimits[y][1]] } }))} /></td>
                <td><input type="number" style={tinp} value={R.insLimits[y][1]} onChange={(e) => setR((s) => ({ ...s, insLimits: { ...s.insLimits, [y]: [s.insLimits[y][0], e.target.value] } }))} /></td>
                <td>{del(() => setR((s) => { const L = { ...s.insLimits }; delete L[y]; return { ...s, insLimits: L }; }))}</td></tr>)}
            </tbody></table>
            <a href="#" id="cn_limadd" style={{ fontSize: 12 }} onClick={(e) => { e.preventDefault(); setR((s) => { const ys = Object.keys(s.insLimits).map(Number); const ny = Math.max(...ys, new Date().getFullYear()) + 1; return { ...s, insLimits: { ...s.insLimits, [ny]: ['', ''] } }; }); }}>+ {T('إضافة سنة', 'Add year')}</a>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{T('شرائح ضريبة كسب العمل (سنويًا بعد الإعفاء الشخصي)', 'Income tax brackets (annual, after the personal exemption)')}</div>
            <table className="cn" id="cn_br" style={{ width: '100%', fontSize: 12, textAlign: 'center' }}><thead><tr><th>{T('من', 'From')}</th><th>{T('إلى', 'To')}</th><th>{T('النسبة %', 'Rate %')}</th><th /></tr></thead><tbody>
              {R.taxBrackets.map((b, i) => <tr key={i}>{[0, 1, 2].map((j) => <td key={j}><input type="number" style={tinp} placeholder={j === 1 ? '∞' : ''} value={b[j] ?? ''} onChange={(e) => setR((s) => { const t = s.taxBrackets.map((x) => x.slice()); t[i][j] = e.target.value; return { ...s, taxBrackets: t }; })} /></td>)}
                <td>{del(() => setR((s) => ({ ...s, taxBrackets: s.taxBrackets.filter((_, k) => k !== i) })))}</td></tr>)}
            </tbody></table>
            <a href="#" id="cn_bradd" style={{ fontSize: 12 }} onClick={(e) => { e.preventDefault(); setR((s) => ({ ...s, taxBrackets: [...s.taxBrackets, ['', '', '']] })); }}>+ {T('إضافة شريحة', 'Add bracket')}</a>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{T('مكافأة نهاية الخدمة عند الاستقالة (شرائح قابلة للتعديل)', 'End-of-service on resignation (editable tiers)')}</div>
            <table className="cn" id="cn_rs" style={{ width: '100%', fontSize: 12, textAlign: 'center' }}><thead><tr><th>{T('أقل من (سنوات)', 'Under (yrs)')}</th><th>{T('نسبة من المكافأة', 'Share of the award')}</th></tr></thead><tbody>
              {R.resignTiers.map((t, i) => <tr key={i}><td><input type="number" style={tinp} placeholder={T('أكثر', 'more')} value={t[0] ?? ''} onChange={(e) => setR((s) => { const x = s.resignTiers.map((r) => r.slice()); x[i][0] = e.target.value; return { ...s, resignTiers: x }; })} /></td>
                <td><input type="number" step="any" style={tinp} value={Math.round(num(t[1]) * 10000) / 10000} onChange={(e) => setR((s) => { const x = s.resignTiers.map((r) => r.slice()); x[i][1] = e.target.value; return { ...s, resignTiers: x }; })} /></td></tr>)}
            </tbody></table>
            <div className="cn-note">{T('المكافأة الكاملة = نصف شهر عن كل سنة من أول 5 سنوات + شهر عن كل سنة بعدها. النسب دي افتراضية — عدّلها حسب عقد الشركة ولائحتها.', 'Full award = half a month per year for the first 5 years + one month per year after. These ratios are defaults — adjust them to your contract and policy.')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <button type="button" className="btn bpl bsm" id="CN_SAVE" onClick={saveRules}><i className="ti ti-device-floppy" /> {T('حفظ القواعد', 'Save rules')}</button>
          <button type="button" className="btn bgr bsm" id="CN_RESET" onClick={() => setR(clone(DEF))}>{T('رجوع للقيم الافتراضية', 'Reset to defaults')}</button>
        </div>
      </>)}
    </Card>
  );
}
