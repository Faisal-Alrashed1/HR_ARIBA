import { useEffect, useMemo, useState } from 'react';
import { aiBridge } from '../../lib/aiBridge.js';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { isEG, resignFactor, leaveCum, rules } from '../../engines/country.js';
import { num, r2, money, pd, iso, esc, printOfficial } from '../../lib/finance.js';
import { duration } from './Eos.jsx';
import { buildSettlementHtml } from '../../lib/settlementDoc.js';
import { toast } from '../../components/Toast.jsx';
import { mailDoc } from '../../lib/mailDoc.js';
import { wrapLetterhead } from '../../lib/print.js';

const LN = { m84: ['م.84', 'Art.84'], m74: ['م.74', 'Art.74'], m85: ['م.85', 'Art.85'], m75: ['م.75', 'Art.75'], m77: ['م.77', 'Art.77'], m80: ['م.80', 'Art.80'], m53: ['م.53', 'Art.53'], m74r: ['م.74(4)', 'Art.74(4)'], m74d: ['م.74(3)', 'Art.74(3)'] };
const REASONS = { m84: ['م.84 إنهاء الشركة', 'Art.84 employer'], m74: ['م.74 اتفاق', 'Art.74 mutual'], m85: ['م.85 استقالة', 'Art.85 resign'], m75: ['م.75 قسرية', 'Art.75 forced'], m77: ['م.77 تعسفي', 'Art.77 arbitrary'], m80: ['م.80 تأديبي', 'Art.80 disciplinary'], m53: ['م.53 تجربة', 'Art.53 probation'], m74r: ['م.74(4) تقاعد', 'Art.74(4) retire'], m74d: ['م.74(3) وفاة', 'Art.74(3) death'] };
/** حساب المخالصة — نفس معادلات sRun في النظام القديم */
export function settle(p) {
  const d1 = pd(p.start), d2 = pd(p.end), sal = num(p.sal); if (!d1 || !d2 || !sal || d2 < d1) return null;
  const eg = isEG(), dur = duration(d1, d2), ty = dur.total, r = p.reason;
  const y1 = Math.min(ty, 5), y2 = Math.max(0, ty - 5), e84 = r2((sal / 2) * y1 + sal * y2);
  let ef = 0, note = '';
  if (r === 'm84' || r === 'm74' || r === 'm74r' || r === 'm74d') { ef = e84; note = 'نصف شهر × 5 سنوات أولى + شهر × ما بعدها.|Half month × first 5 years + full month after.'; }
  else if (eg && r === 'm85') { ef = r2(e84 * resignFactor(ty)); note = 'استقالة: نسبة من المكافأة حسب مدة الخدمة.|Resignation: share of EOS by service length.'; }
  else if (r === 'm85' || r === 'm75') { if (ty < 2) { ef = 0; note = 'أقل من سنتين — لا تستحق.|Under 2 years — nothing due.'; } else if (ty < 5) { ef = r2(e84 / 3); note = 'ثلث م.84.|One third of Art.84.'; } else if (ty < 10) { ef = r2(e84 * 2 / 3); note = 'ثلثان م.84.|Two thirds of Art.84.'; } else { ef = e84; note = 'م.84 كاملة.|Full Art.84.'; } }
  else if (r === 'm77') { const c77 = eg ? Math.round(sal * rules().arbMonths * ty) : Math.max(Math.round(sal * 2), Math.round((sal / 30) * 15 * ty)); ef = r2(e84 + c77); note = 'تعويض + م.84.|Compensation + Art.84.'; }
  else if (r === 'm80' || r === 'm53') { ef = 0; note = 'لا مكافأة.|No award.'; }
  const ld = num(p.leaveD) || 21, lt = num(p.taken);
  const ldue = eg ? r2(leaveCum(d1, d2, null)) : r2(ty * ld), lrem = Math.max(0, r2(ldue - lt)), lcomp = r2((sal / 30) * lrem);
  const wd = num(p.wd), ad = num(p.ad), lmsf = wd > 0 && ad > 0 ? r2((sal / wd) * ad) : sal;
  const lexc = Math.max(0, r2(lt - ldue)), lded = r2((sal / 30) * lexc);
  const extT = p.extras.reduce((a, x) => a + num(x.v), 0);
  const dedT = p.deds.reduce((a, x) => { const v = num(x.v); if (!v) return a; return a + (x.t === 'days' ? r2((sal / (wd || 30)) * v) : v); }, 0);
  const total = Math.max(0, r2(ef + lcomp + lmsf + extT - dedT - lded));
  return { dur, ty, e84, ef, note, ldue, lrem, lcomp, lmsf, lexc, lded, extT, dedT, total, lawN: LN[r] };
}
const INP = { padding: 6, border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--c2)', color: 'var(--tx)', fontSize: 12, width: '100%' };
const Lb = ({ t, children }) => <div><label style={{ fontSize: 10, color: 'var(--mu)', fontWeight: 600, display: 'block', marginBottom: 2 }}>{t}</label>{children}</div>;

export default function EosCalc() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a); const { employees, settings } = useApp();
  const empty = { start: '', end: '', sal: '', reason: 'm84', leaveD: 21, taken: 0, wd: '', ad: '', extras: [], deds: [] };
  const [id, setId] = useState(''), [p, setP] = useState(empty);
  const list = useMemo(() => employees.filter((e) => e && !e.isHourly).sort((a, b) => String(a.nameAr || '').localeCompare(String(b.nameAr || ''), 'ar')), [employees]);
  const e = list.find((x) => String(x.id) === id);
  const set = (k, v) => setP((o) => ({ ...o, [k]: v }));
  function pick(v) {
    setId(v); const x = list.find((y) => String(y.id) === v); if (!x) return setP(empty);
    const tot = num(x.salaryTotal) || (num(x.salary || x.sal) + num(x.housingAllowance || x.hou) + num(x.transportAllowance || x.tra) + num(x.projectAllowance) + num(x.otherAllowance));
    setP({ ...empty, start: String(x.contractJoin || '').slice(0, 10), sal: tot || '', leaveD: num(x.leaveDaysContract) || 21, end: iso(new Date()) });
  }
  const [aiAuto, setAiAuto] = useState(false);
  useEffect(() => { const q = aiBridge.pending; if (q && q.kind === 'settlement') { aiBridge.pending = null; pick(String(q.empId)); if (q.date) set('end', q.date); if (q.reason) set('reason', q.reason); setAiAuto(true); } }, []); // eslint-disable-line
  const R = useMemo(() => settle(p), [p]);
  useEffect(() => { if (aiAuto && R && e) { setAiAuto(false); print(); } }, [aiAuto, R, e]); // eslint-disable-line
  const upd = (k, i, f, v) => setP((o) => ({ ...o, [k]: o[k].map((x, j) => (j === i ? { ...x, [f]: v } : x)) }));
  const cur = T('ر.س', 'SAR'), f = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const nt = R && R.note.split('|')[en ? 1 : 0], rl = (REASONS[p.reason] || [])[en ? 1 : 0];
  function print() {
    if (!R) return; const nm = e ? (en ? (e.nameEn || e.nameAr) : e.nameAr) : '';
    const rw = (a, b) => '<tr><td style="padding:5px 8px;border:1px solid #d9e3df">' + esc(a) + '</td><td style="padding:5px 8px;border:1px solid #d9e3df;direction:ltr;text-align:left">' + esc(b) + '</td></tr>';
    const h = '<div dir="' + (en ? 'ltr' : 'rtl') + '" style="font-family:Tahoma,Arial,sans-serif;padding:0 12mm"><div style="text-align:center;font-weight:800;font-size:16px;color:#014D3D;margin:4mm 0">' + T('مخالصة نهاية الخدمة', 'End of service settlement') + '</div><table style="width:100%;border-collapse:collapse;font-size:12px">'
      + rw(T('الموظف', 'Employee'), nm) + rw(T('من', 'From'), p.start) + rw(T('إلى', 'To'), p.end) + rw(T('المدة', 'Duration'), R.dur.fy + 'y ' + R.dur.fm + 'm ' + R.dur.fd + 'd') + rw(T('السبب', 'Reason'), rl) + rw(T('المكافأة المستحقة', 'EOS due'), f(R.ef) + ' ' + cur)
      + rw(T('بدل الإجازة', 'Leave pay') + ' (' + R.lrem + ')', f(R.lcomp) + ' ' + cur) + rw(T('راتب الفترة', 'Period salary'), f(R.lmsf) + ' ' + cur) + rw(T('استحقاقات أخرى', 'Other earnings'), f(R.extT) + ' ' + cur) + rw(T('استقطاعات', 'Deductions'), '-' + f(R.dedT + R.lded) + ' ' + cur)
      + '<tr style="background:#eef5f2;font-weight:800"><td style="padding:7px 8px;border:1px solid #014D3D">' + T('صافي المخالصة', 'Net settlement') + '</td><td style="padding:7px 8px;border:1px solid #014D3D;direction:ltr;text-align:left">' + f(R.total) + ' ' + cur + '</td></tr></table></div>';
    printOfficial(settings, T('مخالصة', 'Settlement'), h, { dir: en ? 'ltr' : 'rtl', lang: en ? 'en' : 'ar' });
  }
  function printOfficialDoc() {
    if (!R || !e) { toast(T('اختر الموظف أولاً', 'Select an employee first'), 'ter'); return; }
    printOfficial(settings, T('مخالصة نهاية خدمة', 'End-of-service settlement') + ' — ' + (e.nameAr || ''), buildSettlementHtml(e, p, R, { eosLabel: R.lawN ? R.lawN[0] : '', lawNote: nt || '' }), { dir: 'rtl', lang: 'ar' });
  }
  async function mailSettlement() {
    if (!R || !e) { toast(T('اختر الموظف أولاً', 'Select an employee first'), 'ter'); return; }
    const html = wrapLetterhead(settings && settings.letterhead, buildSettlementHtml(e, p, R, { eosLabel: R.lawN ? R.lawN[0] : '', lawNote: nt || '' }));
    await mailDoc('settlement', e, { title: 'مخالصة نهاية خدمة — ' + (e.nameAr || ''), html });
  }
  const Box = ({ l, v, c }) => <div style={{ borderRadius: 10, padding: 10, textAlign: 'center', background: c + '18', border: '1px solid ' + c + '44' }}><div style={{ fontSize: 10, color: 'var(--mu)' }}>{l}</div><div style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 10, color: 'var(--dm)' }}>{cur}</div></div>;
  const Br = ({ l, v, c }) => <tr><td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(36,48,68,.3)', fontSize: 11 }}>{l}</td><td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(36,48,68,.3)', textAlign: 'left', fontWeight: 600, fontSize: 11, color: c }}>{v}</td></tr>;
  const Sec = ({ t }) => <tr><td colSpan={2} style={{ background: 'rgba(59,130,246,.08)', color: 'var(--bl)', fontWeight: 700, fontSize: 11, padding: '6px 10px' }}>📋 {t}</td></tr>;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 10 }}>
        <div className="card" style={{ padding: 10 }}>
          <div className="ct" style={{ marginBottom: 8, fontSize: 12 }}><i className="ti ti-user-search" /> {T('الموظف', 'Employee')}</div>
          <select id="sEmpSel" style={{ ...INP, marginBottom: 8 }} value={id} onChange={(x) => pick(x.target.value)}><option value="">{T('— اختر موظفاً —', '— Select employee —')}</option>{list.map((x) => <option key={x.id} value={x.id}>{(en ? (x.nameEn || x.nameAr) : x.nameAr) + ' — ' + (x.employer || '') + (x.isTerminated ? T(' (منتهي)', ' (ended)') : T(' (حالي)', ' (current)'))}</option>)}</select>
          {e && <div id="sEmpInfo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11 }}><div><span style={{ color: 'var(--mu)' }}>{T('الاسم: ', 'Name: ')}</span>{en ? (e.nameEn || e.nameAr) : e.nameAr}</div><div><span style={{ color: 'var(--mu)' }}>{T('سنوات: ', 'Years: ')}</span><span style={{ color: 'var(--pu)' }}>{R ? R.ty.toFixed(2) : '—'}</span></div><div><span style={{ color: 'var(--mu)' }}>{T('الإجمالي: ', 'Gross: ')}</span><span style={{ color: 'var(--gr)' }}>{f(p.sal)} {cur}</span></div></div>}
        </div>
        <div className="card" style={{ padding: 10 }}>
          <div className="ct" style={{ marginBottom: 8, fontSize: 12 }}><i className="ti ti-briefcase" /> {T('بيانات الخدمة', 'Service data')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Lb t={T('تاريخ المباشرة', 'Start date')}><input type="date" id="sStart" style={INP} value={p.start} onChange={(x) => set('start', x.target.value)} /></Lb>
            <Lb t={T('تاريخ الإنهاء', 'End date')}><input type="date" id="sEndDate" style={INP} value={p.end} onChange={(x) => set('end', x.target.value)} /></Lb>
            <Lb t={T('الراتب الإجمالي', 'Gross salary')}><input type="number" id="sSal" style={INP} value={p.sal} onChange={(x) => set('sal', x.target.value)} /></Lb>
            <Lb t={T('سبب الإنهاء', 'Reason')}><select id="sReason" style={INP} value={p.reason} onChange={(x) => set('reason', x.target.value)}>{Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v[en ? 1 : 0]}</option>)}</select></Lb>
            <Lb t={T('إجازة/سنة', 'Leave/yr')}><input type="number" id="sLeaveD" style={INP} value={p.leaveD} onChange={(x) => set('leaveD', x.target.value)} /></Lb>
            <Lb t={T('إجازة مأخوذة', 'Leave taken')}><input type="number" id="sLeaveTaken" style={INP} value={p.taken} onChange={(x) => set('taken', x.target.value)} /></Lb>
            <Lb t={T('أيام الشهر', 'Month days')}><input type="number" id="sWD" placeholder="31" style={INP} value={p.wd} onChange={(x) => set('wd', x.target.value)} /></Lb>
            <Lb t={T('أيام الحضور', 'Days attended')}><input type="number" id="sAD" placeholder="31" style={INP} value={p.ad} onChange={(x) => set('ad', x.target.value)} /></Lb>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 10, marginTop: 10 }}>
        <div className="card" style={{ padding: 10 }}>
          <div className="ct" style={{ marginBottom: 8, fontSize: 12, color: 'var(--gr)' }}><i className="ti ti-plus-circle" /> {T('استحقاقات', 'Earnings')}</div>
          {p.extras.map((x, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 6, marginBottom: 6 }}><input style={INP} placeholder={T('بدل سفر...', 'Travel...')} value={x.n} onChange={(v) => upd('extras', i, 'n', v.target.value)} /><input type="number" data-sev style={INP} placeholder="0" value={x.v} onChange={(v) => upd('extras', i, 'v', v.target.value)} /><button className="btn bsm" style={{ background: 'var(--rd)', color: '#fff' }} onClick={() => set('extras', p.extras.filter((_, j) => j !== i))}>×</button></div>)}
          <button className="btn bsm" style={{ color: 'var(--gr)' }} onClick={() => set('extras', [...p.extras, { n: '', v: '' }])}><i className="ti ti-plus" /> {T('إضافة', 'Add')}</button>
        </div>
        <div className="card" style={{ padding: 10 }}>
          <div className="ct" style={{ marginBottom: 8, fontSize: 12 }}><i className="ti ti-minus" /> {T('استقطاعات', 'Deductions')}</div>
          {p.deds.map((x, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, marginBottom: 6 }}><input style={INP} placeholder={T('سلفة...', 'Advance...')} value={x.n} onChange={(v) => upd('deds', i, 'n', v.target.value)} /><select style={INP} value={x.t} onChange={(v) => upd('deds', i, 't', v.target.value)}><option value="amount">{T('مبلغ', 'Amount')}</option><option value="days">{T('أيام', 'Days')}</option></select><input type="number" data-sdv style={INP} placeholder="0" value={x.v} onChange={(v) => upd('deds', i, 'v', v.target.value)} /><button className="btn bsm" style={{ background: 'var(--rd)', color: '#fff' }} onClick={() => set('deds', p.deds.filter((_, j) => j !== i))}>×</button></div>)}
          <button className="btn bsm" style={{ color: 'var(--rd)' }} onClick={() => set('deds', [...p.deds, { n: '', t: 'amount', v: '' }])}><i className="ti ti-plus" /> {T('إضافة', 'Add')}</button>
        </div>
      </div>
      {R && <div id="sResult" style={{ marginTop: 10 }}>
        <div id="sDurInfo" style={{ background: 'var(--c2)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--mu)' }}>{p.start} — {p.end} | {R.dur.fy} {T('سنة', 'y')} {R.dur.fm} {T('شهر', 'm')} {R.dur.fd} {T('يوم', 'd')} ({R.ty.toFixed(4)})</div>
        {nt && <div id="sLawNote" style={{ background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 8, padding: '6px 12px', marginTop: 8, fontSize: 11, color: 'var(--mu)' }}>{nt}</div>}
        <div id="sBoxes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, margin: '10px 0' }}>
          <Box l={R.lawN[en ? 1 : 0]} v={R.ef === 0 ? T('لا تستحق', 'Not due') : f(R.ef)} c={R.ef === 0 ? '#ef4444' : '#10b981'} />
          <Box l={T('بدل الإجازة', 'Leave pay') + ' (' + R.lrem + ')'} v={f(R.lcomp)} c="#f59e0b" /><Box l={T('راتب الفترة', 'Period salary')} v={f(R.lmsf)} c="#06b6d4" /><Box l={T('استحقاقات أخرى', 'Other earnings')} v={f(R.extT)} c="#10b981" /><Box l={T('الاستقطاعات', 'Deductions')} v={f(R.dedT)} c="#ef4444" />
          {R.lexc > 0 && <Box l={T('خصم إجازة زائدة', 'Excess-leave deduction') + ' (' + R.lexc + ')'} v={'-' + f(R.lded)} c="#ef4444" />}
        </div>
        <div style={{ background: 'var(--c2)', borderRadius: 10, padding: 12, textAlign: 'center', marginBottom: 10, border: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 4 }}>{T('إجمالي المخالصة — ', 'Total settlement — ')}{R.lawN[en ? 1 : 0]}</div>
          <div id="sTotal" style={{ fontSize: 26, fontWeight: 900, color: 'var(--bl)' }}>{f(R.total)}</div><div style={{ fontSize: 11, color: 'var(--dm)' }}>{cur}</div>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody id="sBrk">
          <Sec t={T('مكافأة نهاية الخدمة', 'End-of-service award')} /><Br l={R.lawN[en ? 1 : 0]} v={f(R.e84) + ' ' + cur} c="var(--bl)" /><Br l={T('المستحق', 'Due')} v={R.ef > 0 ? f(R.ef) + ' ' + cur : T('لا تستحق', 'Not due')} c={R.ef > 0 ? 'var(--gr)' : 'var(--rd)'} />
          <Sec t={T('بدل الإجازة', 'Leave pay')} /><Br l={T('المتبقي', 'Remaining')} v={R.lrem + T(' يوم', ' d')} /><Br l={T('البدل', 'Pay')} v={f(R.lcomp) + ' ' + cur} c="var(--am)" />
          {R.lexc > 0 && <><Br l={T('إجازة زائدة عن المستحق', 'Excess leave')} v={R.lexc + T(' يوم', ' d') + ' (' + R.ldue + ' / ' + p.taken + ')'} c="var(--rd)" /><Br l={T('خصم الإجازة الزائدة', 'Excess deduction')} v={'-' + f(R.lded) + ' ' + cur} c="var(--rd)" /></>}
          <Sec t={T('راتب الفترة', 'Period salary')} /><Br l={T('الإجمالي', 'Total')} v={f(R.lmsf) + ' ' + cur} c="var(--cy)" />
          <tr style={{ background: 'rgba(16,185,129,.08)' }}><td style={{ padding: '8px 10px', fontWeight: 700, fontSize: 13 }}>💰 {T('صافي المخالصة', 'Net settlement')}</td><td style={{ padding: '8px 10px', textAlign: 'left', fontSize: 14, fontWeight: 900, color: 'var(--bl)' }}>{f(R.total)} {cur}</td></tr>
        </tbody></table></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn bgr bsm" onClick={print}><i className="ti ti-printer" /> {T('طباعة', 'Print')}</button>
          <button className="btn bsm" id="v68SettleBtn" style={{ background: 'var(--ariba-dark,#014D3D)', color: '#fff' }} onClick={printOfficialDoc}><i className="ti ti-file-certificate" /> {T('طباعة مخالصة رسمية', 'Official settlement form')}</button>
          <button className="btn bsm" id="v68MailBtn" style={{ background: 'var(--bl)', color: '#fff' }} onClick={mailSettlement}><i className="ti ti-mail" /> {T('إرسال إيميل للموظف', 'Email to employee')}</button>
          <button className="btn bsm" style={{ background: 'var(--am)', color: '#fff' }} onClick={() => { setId(''); setP(empty); }}><i className="ti ti-refresh" /> {T('تصفير', 'Reset')}</button>
        </div>
      </div>}
    </div>
  );
}
