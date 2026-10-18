import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import { rates as payRates } from '../../engines/payrollRows.js';
import { autoRate } from '../../engines/insurance.js';
import { num, r2, money, pd, iso, saveXlsx, printOfficial, esc } from '../../lib/finance.js';
import { offerDraft } from '../../lib/offerDraft.js';

/* نفس معادلات الإكسيل: الأجر الخاضع = الأساسي + السكن، السقف، الصافي = الإجمالي − التأمينات */
export function calc(mode, p, T = (a) => a) {
  const hp = p.h || 0, tp = p.t || 0, hA = p.hA || 0, tA = p.tA || 0, sau = !!p.sau, rate = sau ? p.rate : 0, cap = p.cap || 45000;
  const pp = p.prType === 'pct' ? (p.pr || 0) : 0, pA = p.prType === 'amt' ? (p.pr || 0) : 0;
  const k = 1 + hp + tp + pp, fixed = hA + tA + pA + (p.O || 0); let B = 0, other = p.O || 0, warn = '';
  const baseOf = (b) => b * (1 + hp) + hA, insFor = (b) => (sau ? Math.min(baseOf(b), cap) * rate : 0);
  if (mode === 'gross') B = (p.G - fixed) / k;
  else if (mode === 'net') {
    if (!sau || !rate) B = (p.N - fixed) / k;
    else { const b1 = (p.N - fixed + rate * hA) / (k - rate * (1 + hp)); if (baseOf(b1) <= cap) B = b1; else { B = (p.N - fixed + rate * cap) / k; warn = T('الأجر الخاضع وصل للحد الأقصى (' + cap + ') فالتأمينات ثابتة', 'The insurable wage reached the cap (' + cap + '), so the deduction is fixed'); } }
  } else B = p.B;
  if ((mode === 'gross' || mode === 'net') && B < 0) warn = T('البدلات الثابتة أكبر من المبلغ المدخل — راجع الأرقام', 'The fixed allowances exceed the entered amount — check the figures');
  const housing = B * hp + hA, transport = B * tp + tA, project = B * pp + pA;
  if (mode === 'target') { other = p.N + insFor(B) - (B + housing + transport + project); if (other < 0) warn = T('الصافي المطلوب أقل من الراتب الأساسي والبدلات الحالية — البدل المطلوب سالب', 'The target net is below the basic and allowances — the required allowance is negative'); }
  const gross = B + housing + transport + project + other, ins = insFor(B), net = gross - ins, base = Math.min(baseOf(B), cap);
  return { basic: B, housing, transport, project, other, gross, ins, net, base, rate, warn };
}
function ratesFor(date, sys, a55, src) {
  let R = null; try { R = payRates(date); } catch { /* ignore */ }
  const cap = (R && R.cap) || 45000;
  if ((src || 'auto') === 'auto' && !a55) { const A = autoRate(date, sys); return { rate: A.emp / 100, coRate: A.er / 100, cap, src: 'auto', from: A.from, n: A.n, nonSaudiEr: R ? R.nonSaudiEr : 0.02 }; }
  if (!R) return { rate: sys === 'new' ? 0.1075 : 0.0975, coRate: sys === 'new' ? 0.1275 : 0.1175, cap: 45000, src: 'default', nonSaudiEr: 0.02 };
  return { rate: sys === 'new' ? (a55 ? R.matchEmp55 : R.matchEmp) : (a55 ? R.noMatchEmp55 : R.noMatchEmp), cap, coRate: sys === 'new' ? (a55 ? R.matchEr55 : R.matchEr) : (a55 ? R.noMatchEr55 : R.noMatchEr), src: 'settings', nonSaudiEr: R.nonSaudiEr };
}
const MODES = [['gross', 'إجمالي ← مكونات', 'Gross → components'], ['net', 'صافي ← مكونات', 'Net → components'], ['basic', 'أساسي ← إجمالي وصافي', 'Basic → gross & net'], ['target', 'أساسي + صافي مطلوب ← بدل مطلوب', 'Basic + target net → required allowance']];
const INP = { background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '7px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const TD = { padding: '7px 10px', borderBottom: '1px solid rgba(36,48,68,.25)', fontSize: 12.5 };
const Lb = ({ t }) => <label style={{ fontSize: 10.5, color: 'var(--mu)', display: 'block', marginBottom: 3, fontWeight: 600 }}>{t}</label>;

export default function SalCalc() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a); const nav = useNavigate(); const { settings } = useApp();
  const [mode, setMode] = useState('gross');
  const [f, setF] = useState({ G: '', N: '', B: '', nat: 'sa', sys: 'new', a55: false, H: '25', HT: 'pct', T: '10', TT: 'pct', PR: '0', PRT: 'pct', O: '0', ON: '', date: iso(new Date()), src: 'auto', rate: '', rateManual: false });
  const set = (k, v) => setF((s) => { const n = { ...s, [k]: v }; if (['sys', 'nat', 'date', 'a55', 'src'].includes(k)) n.rateManual = false; if (k === 'rate') n.rateManual = true; return n; });
  const sau = f.nat === 'sa', dt = pd(f.date) || new Date();
  const rr = useMemo(() => ratesFor(dt, f.sys, f.a55, f.src), [f.date, f.sys, f.a55, f.src]); // eslint-disable-line
  const rateShown = f.rateManual ? f.rate : String(r2(rr.rate * 100 * 100) / 100);
  const rate = sau ? num(rateShown) / 100 : 0;
  const hv = num(f.H), tv = num(f.T);
  const p = { G: num(f.G), N: num(f.N), B: num(f.B), sau, rate, cap: rr.cap, h: f.HT !== 'amt' ? hv / 100 : 0, hA: f.HT !== 'amt' ? 0 : hv, t: f.TT !== 'amt' ? tv / 100 : 0, tA: f.TT !== 'amt' ? 0 : tv, pr: f.PRT === 'pct' ? num(f.PR) / 100 : num(f.PR), prType: f.PRT, O: num(f.O) };
  const ok = (mode === 'gross' && p.G > 0) || (mode === 'net' && p.N > 0) || (mode === 'basic' && p.B > 0) || (mode === 'target' && p.B > 0 && p.N > 0);
  const c = ok ? { ...calc(mode, p, T), otherLabel: f.ON.trim() } : null;
  offerDraft.last = c; // آخر نتيجة (لزر "جلب من حاسبة الراتب" في العرض الوظيفي)
  const manual = f.rateManual;
  const coCost = c ? c.gross + (sau ? c.base * (rr.coRate || 0) : c.base * (rr.nonSaudiEr || 0.02)) : 0;
  const rows = c ? (() => { const a = [[T('الراتب الأساسي', 'Basic salary'), c.basic], [T('بدل السكن', 'Housing allowance'), c.housing], [T('بدل النقل', 'Transport allowance'), c.transport]]; if (c.project) a.push([T('بدل المشروع', 'Project allowance'), c.project]); if (c.other || mode === 'target') a.push([c.otherLabel || T('بدلات أخرى', 'Other allowances'), c.other]); return a; })() : [];
  const outRows = () => { const a = rows.map(([l, v]) => [l, r2(v)]); a.push([T('الراتب الإجمالي', 'Gross salary'), r2(c.gross)], [T('خصم التأمينات (حصة الموظف)', 'Insurance (employee share)'), r2(c.ins)], [T('الصافي للموظف', 'Net to employee'), r2(c.net)]); return a; };
  const noRes = () => { if (c) return false; toast(T('اكتب الرقم المطلوب أولاً', 'Enter the figure first'), 'ter'); return true; };
  function print() {
    if (noRes()) return;
    const title = T('حاسبة الراتب', 'Salary calculation'), td = 'padding:6px 10px;border:1px solid #d9e3df;font-size:12px';
    const html = '<div dir="' + (en ? 'ltr' : 'rtl') + '" style="font-family:Tahoma,Arial,sans-serif;padding:0 10mm"><div style="text-align:center;font-weight:800;font-size:15px;color:#014D3D;margin:3mm 0">' + esc(title) + '</div><div style="font-size:11px;color:#555;text-align:center;margin-bottom:4mm">' + (sau ? T('سعودي', 'Saudi') + ' — ' + (f.sys === 'new' ? T('النظام الجديد', 'New system') : T('النظام القديم', 'Old system')) : T('غير سعودي', 'Non-Saudi')) + '</div><table style="width:100%;border-collapse:collapse">' + outRows().map((r) => '<tr><td style="' + td + '">' + esc(r[0]) + '</td><td style="' + td + ';text-align:left;font-weight:700;direction:ltr">' + money(r[1]) + '</td></tr>').join('') + '</table></div>';
    printOfficial(settings, title, html, { dir: en ? 'ltr' : 'rtl', lang: en ? 'en' : 'ar' });
  }
  const xls = () => noRes() || saveXlsx('salary_calc.xlsx', [{ name: T('حاسبة الراتب', 'Salary'), rows: [[T('حاسبة الراتب', 'Salary calculation')], [], [T('البند', 'Item'), T('المبلغ', 'Amount')], ...outRows()], widths: [40, 16] }]);
  const copy = async () => { if (noRes()) return; try { await navigator.clipboard.writeText(outRows().map((r) => r[0] + ': ' + money(r[1])).join('\n')); toast('✓ ' + T('تم النسخ', 'Copied')); } catch { toast(T('تعذر النسخ', 'Could not copy'), 'ter'); } };
  const offer = () => { if (noRes()) return; offerDraft.data = { ...c, otherLabel: f.ON.trim() }; nav('/forms'); };
  const nfo = !sau ? T('غير سعودي: لا استقطاع على الموظف', 'Non-Saudi: no employee deduction')
    : T('سقف الأجر الخاضع: ', 'Wage cap: ') + money(rr.cap) + ' — ' + (manual ? T('النسبة يدوية', 'manual rate') : (rr.src === 'auto' ? (f.sys === 'new' ? (rr.n >= 0 ? T('الجديد: ', 'New: ') + r2(rr.rate * 100 * 100) / 100 + '% ' + T('سارية من ', 'effective from ') + rr.from : T('قبل 1/7/2025: 9.75%', 'before 1/7/2025: 9.75%')) : T('القديم: ثابتة 9.75%', 'Old: flat 9.75%')) : T('من إعدادات البرنامج', 'from program settings')));
  const sched = sau ? (f.sys === 'new' ? [0, 1, 2, 3].map((i) => { const A = autoRate(new Date(2025 + i, 6, 1), 'new'); return '1/7/' + (2025 + i) + ' → ' + A.emp + '% / ' + A.er + '%'; }).join('  •  ') + T('  (بيزيد 0.5% كل 1 يوليو لحد 11.75% للموظف)', '  (+0.5% each 1 July up to 11.75% for the employee)') : T('النظام القديم: 9.75% موظف / 11.75% شركة ثابتة', 'Old system: 9.75% employee / 11.75% employer, flat')) : '';
  const num_ = (k, extra) => <input type="number" step="0.01" value={f[k]} onChange={(e) => set(k, e.target.value)} style={{ ...INP, ...extra }} />;
  return (
    <div className="pg on" style={{ padding: '12px 16px' }}>
      <div className="card" style={{ padding: 14, maxWidth: 1000 }}>
        <div className="ct" style={{ marginBottom: 10 }}><i className="ti ti-calculator" /> {T('حاسبة الراتب', 'Salary calculator')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>{MODES.map((m) => <button key={m[0]} className="btn bsm" style={{ fontWeight: 700, background: mode === m[0] ? 'var(--gr)' : '', color: mode === m[0] ? '#fff' : '' }} onClick={() => setMode(m[0])}>{T(m[1], m[2])}</button>)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
          {mode === 'gross' && <div><Lb t={T('الراتب الإجمالي شامل البدلات', 'Gross salary incl. allowances')} />{num_('G')}</div>}
          {(mode === 'net' || mode === 'target') && <div><Lb t={T('الراتب الصافي (بعد خصم التأمينات)', 'Net salary (after insurance)')} />{num_('N')}</div>}
          {(mode === 'basic' || mode === 'target') && <div><Lb t={T('الراتب الأساسي', 'Basic salary')} />{num_('B')}</div>}
          <div><Lb t={T('الجنسية', 'Nationality')} /><select value={f.nat} onChange={(e) => set('nat', e.target.value)} style={INP}><option value="sa">{T('سعودي', 'Saudi')}</option><option value="ns">{T('غير سعودي', 'Non-Saudi')}</option></select></div>
          {sau && <div><Lb t={T('نظام التأمينات / العمل', 'Insurance / labor system')} /><select value={f.sys} onChange={(e) => set('sys', e.target.value)} style={INP}><option value="new">{T('الجديد (يزيد كل سنة)', 'New (increases yearly)')}</option><option value="old">{T('القديم (ثابت 9.75%)', 'Old (flat 9.75%)')}</option></select></div>}
          {sau && <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}><label style={{ fontSize: 12 }}><input type="checkbox" checked={f.a55} onChange={(e) => set('a55', e.target.checked)} /> {T('عمره 55 سنة أو أكتر', 'Age 55 or above')}</label></div>}
        </div>
        <div style={{ marginTop: 10, fontWeight: 700, fontSize: 12, color: 'var(--mu)' }}>{T('البدلات (كل بدل: نسبة من الأساسي أو مبلغ ثابت)', 'Allowances (each one: % of basic or a fixed amount)')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 6 }}>
          {[['H', 'HT', T('بدل السكن', 'Housing allowance')], ['T', 'TT', T('بدل النقل', 'Transport allowance')], ['PR', 'PRT', T('بدل المشروع', 'Project allowance')]].map(([a, b, l]) => (
            <div key={a}><Lb t={l} /><div style={{ display: 'flex', gap: 4 }}>{num_(a)}<select value={f[b]} onChange={(e) => set(b, e.target.value)} style={{ ...INP, width: 78 }}><option value="pct">%</option><option value="amt">{T('مبلغ', 'SAR')}</option></select></div></div>))}
          {mode !== 'target' && <div><Lb t={T('بدلات أخرى (مبلغ ثابت)', 'Other allowances (fixed)')} />{num_('O')}</div>}
          {mode !== 'target' && <div><Lb t={T('نوع البدل الآخر (يظهر في العرض الوظيفي)', 'Name of the other allowance (shown in the offer)')} /><input value={f.ON} onChange={(e) => set('ON', e.target.value)} placeholder={T('مثال: بدل هاتف', 'e.g. phone allowance')} style={INP} /></div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginTop: 10, alignItems: 'end' }}>
          <div><Lb t={T('تاريخ الحساب (يحدد نسب التأمينات)', 'Calculation date (selects the insurance rates)')} /><input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} style={INP} /></div>
          <div><Lb t={T('مصدر النسبة', 'Rate source')} /><select value={f.src} onChange={(e) => set('src', e.target.value)} style={INP}><option value="auto">{T('تلقائي — الجدول النظامي من 1/7/2025', 'Automatic — statutory schedule from 1/7/2025')}</option><option value="settings">{T('من إعدادات البرنامج', 'From the program settings')}</option></select></div>
          <div><Lb t={T('نسبة خصم الموظف % (تعدّلها يدوي لو عايز)', 'Employee deduction % (editable)')} /><input type="number" step="0.01" value={rateShown} onChange={(e) => set('rate', e.target.value)} style={INP} /></div>
          <div style={{ fontSize: 11, color: 'var(--mu)', paddingBottom: 8 }}>{nfo}</div>
        </div>
        {sched && <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 6, lineHeight: 1.7 }}><b>{f.sys === 'new' ? T('جدول النظام الجديد (موظف / شركة): ', 'New-system schedule (employee / employer): ') : ''}</b>{sched}</div>}
      </div>
      <div className="card" style={{ padding: 14, maxWidth: 1000, marginTop: 12 }}>
        {!c ? <div style={{ padding: 22, textAlign: 'center', color: 'var(--mu)' }}>{T('اكتب الرقم المطلوب فوق وهتظهر النتيجة', 'Enter the figure above to see the result')}</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            {rows.map(([l, v], i) => <tr key={i}><td style={TD}>{l}</td><td style={{ ...TD, textAlign: 'left', fontWeight: 700, direction: 'ltr' }}>{money(v)}</td></tr>)}
            <tr style={{ background: 'rgba(41,179,94,.12)' }}><td style={{ ...TD, fontWeight: 800 }}>{T('الراتب الإجمالي', 'Gross salary')}</td><td style={{ ...TD, textAlign: 'left', fontWeight: 800, direction: 'ltr', color: 'var(--gr)' }}>{money(c.gross)}</td></tr>
            <tr><td style={TD}>{T('خصم التأمينات الاجتماعية (حصة الموظف)', 'Social insurance (employee share)')}{sau && <span style={{ color: 'var(--mu)', fontSize: 11 }}> {r2(rate * 100 * 100) / 100}% × {money(c.base)}</span>}</td><td style={{ ...TD, textAlign: 'left', direction: 'ltr', color: 'var(--am)' }}>{sau ? '-' : ''}{money(c.ins)}</td></tr>
            <tr style={{ background: 'rgba(59,130,246,.12)' }}><td style={{ ...TD, fontWeight: 800 }}>{T('الصافي للموظف', 'Net to employee')}</td><td style={{ ...TD, textAlign: 'left', fontWeight: 800, direction: 'ltr', color: 'var(--bl)' }}>{money(c.net)}</td></tr>
            <tr><td style={{ ...TD, color: 'var(--mu)', fontSize: 11.5 }}>{T('تكلفة الشركة الشهرية (الإجمالي + حصة الشركة من التأمينات)', 'Monthly cost to the company (gross + employer insurance share)')}</td><td style={{ ...TD, textAlign: 'left', color: 'var(--mu)', direction: 'ltr' }}>{money(coCost)}</td></tr>
            <tr><td style={{ ...TD, color: 'var(--mu)', fontSize: 11.5 }}>{T('تأكيد (مجموع المكونات)', 'Check (sum of components)')}</td><td style={{ ...TD, textAlign: 'left', color: 'var(--mu)', direction: 'ltr' }}>{money(c.basic + c.housing + c.transport + c.project + c.other)}</td></tr>
          </tbody></table>)}
        {c && c.warn && <div style={{ color: 'var(--am)', fontSize: 12, marginTop: 6 }}>{c.warn}</div>}
        {<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn bpl bsm" onClick={offer}><i className="ti ti-file-text" /> {T('إنشاء عرض وظيفي بهذه الأرقام', 'Create a job offer with these figures')}</button>
          <button className="btn bgr bsm" onClick={print}><i className="ti ti-printer" /> {T('طباعة', 'Print')}</button><button className="btn bgr bsm" onClick={xls}>Excel</button><button className="btn bsm" onClick={copy}>{T('نسخ', 'Copy')}</button></div>}
      </div>
    </div>
  );
}
