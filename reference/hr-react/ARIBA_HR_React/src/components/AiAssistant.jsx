import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppStore.jsx';
import { rpc } from '../lib/api.js';
import { toast } from './Toast.jsx';
import { aiBridge } from '../lib/aiBridge.js';
import { understand, PAGE_WORDS, findEmployees, parseDates, parseDuration, parseTime, showDate, iso, addDays, today, isTerm, SETTLE_REASONS, N } from '../lib/aiParse.js';
import { LVL, recordLeave, newLeaveId } from '../lib/leaves.js';
import { leaveCurrentBalance } from '../engines/leave.js';
import { countAnnualLeaveDays } from '../engines/holidays.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ST_AR = { absent: 'غياب', present: 'حضور', late: 'تأخير', remote: 'عمل عن بعد' };
const FORMS = { onboarding: { ar: 'نموذج مباشرة عمل' }, experience: { ar: 'شهادة خبرة' }, extension: { ar: 'نموذج تمديد عقد', date: 'end' }, termination: { ar: 'نموذج إنهاء خدمة', date: 'last' }, clearance: { ar: 'نموذج إخلاء طرف', date: 'last' }, custody: { ar: 'نموذج استلام عهدة' }, evaluation: { ar: 'نموذج تقييم فترة التجربة' } };
const num = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const empLabel = (e) => '<b>' + esc(e.nameAr) + '</b>' + (e.empNo ? ' <span class="ai-mini">(رقم ' + esc(e.empNo) + ')</span>' : '') + (isTerm(e) ? ' <span class="ai-mini">— منتهي الخدمة</span>' : '');

/** مساعد اريبا AI العايم (V112/V125): بيفهم الأوامر بالعامية وينفذها جوه البرنامج من غير خادم */
export default function AiAssistant() {
  const { employees, leaves, reload } = useApp(); const waiting = useRef(null); const nav = useNavigate();
  const [open, setOpen] = useState(false), [msgs, setMsgs] = useState([]), [text, setText] = useState('');
  const emps = employees.filter((e) => e && e.nameAr);
  const logRef = useRef(null); const id = useRef(0);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [msgs]);
  const add = (m) => { const k = ++id.current; setMsgs((a) => [...a, { ...m, k }]); return k; };
  const upd = (k, patch) => setMsgs((a) => a.map((m) => (m.k === k ? { ...m, ...patch } : m)));
  const del = (k) => setMsgs((a) => a.filter((m) => m.k !== k));

  async function doReset(e) {
    try { const r = await rpc('ariba_hr_reset_password', { p_employee_id: String(e.id) });
      return '🔑 كلمة مرور مؤقتة لـ ' + empLabel(e) + '<div style="margin:8px 0;font-size:15px">اسم المستخدم: <b dir="ltr">' + esc(r.username) + '</b><br>كلمة المرور المؤقتة: <b dir="ltr" style="font-size:17px">' + esc(r.temporary_password) + '</b></div>';
    } catch (err) { return '❌ ' + esc(err.message || err); }
  }
  async function doPwList() {
    try { const r = await rpc('ariba_hr_default_password_list', {}); const a = (r && r.accounts) || [];
      if (!a.length) return '✅ كل الحسابات النشطة غيّرت كلمة المرور الافتراضية.';
      return '🔐 <b>' + a.length + '</b> حساب لسه على كلمة المرور الافتراضية أو المؤقتة (هيتطلب منهم تغييرها أول ما يدخلوا):<div class="ai-mini" style="line-height:1.8;margin-top:4px">' + a.map((x) => esc(x.name) + ' — <span dir="ltr">' + esc(x.username) + '</span>' + (x.role !== 'employee' ? ' <b>(' + esc(x.role) + ')</b>' : '')).join('<br>') + '</div>';
    } catch (err) { return '❌ ' + esc(err.message || err); }
  }
  async function doAttendance(e, status, date, time) {
    await rpc('ariba_sync_attendance', { p_employee_id: String(e.id), p_date: date, p_time_in: status === 'absent' ? null : (time || null), p_time_out: null, p_status: status, p_location_id: null, p_location_name: null, p_lat: null, p_lng: null, p_notes: null });
    return '✓ اتسجل ' + ST_AR[status] + ' لـ ' + empLabel(e) + ' — ' + showDate(date) + (time && status !== 'absent' ? ' الساعة ' + time : '');
  }
  async function doLeave(e, type, from, to) {
    const days = type === 'annual' ? countAnnualLeaveDays(from, to) : Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
    if (type === 'annual' && days > leaveCurrentBalance(e)) return '⚠ مااتسجلتش: يتجاوز الرصيد المتاح';
    await recordLeave({ id: newLeaveId(), empId: e.id, type, from, to, days, notes: 'مسجلة عن طريق مساعد اريبا' }, 'pending');
    try { await reload({ silent: true }); } catch { /* ignore */ }
    return '✓ اتسجل طلب إجازة ' + esc((LVL[type] || {}).ar || '') + ' لـ ' + empLabel(e) + ' من ' + showDate(from) + ' إلى ' + showDate(to);
  }
  function doQuery(q, e) {
    if (q === 'balance') { let b = 0; try { b = leaveCurrentBalance(e); } catch { b = Number(e.leaveBalance || 0); } return '🏖️ رصيد إجازة ' + empLabel(e) + ': <b>' + num(b) + ' يوم</b> حتى النهارده'; }
    if (q === 'salary') return '💰 ' + empLabel(e) + ': الأساسي ' + num(e.salary) + ' — الإجمالي ' + num(e.salaryTotal) + ' — الصافي <b>' + num(e.netSalary) + ' ريال</b>';
    if (q === 'iqama') return '🪪 إقامة ' + empLabel(e) + ': ' + esc(e.iqamaNo || '—') + ' — تنتهي ' + esc(e.iqamaExpiry || '—');
    if (q === 'contract') return '📄 عقد ' + empLabel(e) + ': من ' + esc(e.contractJoin || '—') + ' إلى ' + esc(e.contractEnd || 'غير محدد');
    return '';
  }
  function card(summary, run) { return add({ type: 'card', summary, run }); }
  async function runCard(m) {
    upd(m.k, { type: 'html', html: '<div class="ai-action">⏳ جاري التنفيذ…</div>', raw: true });
    try { const r = await m.run(); upd(m.k, { html: '<div class="ai-action">' + (r || '✓ تم') + '</div>' }); }
    catch (err) { upd(m.k, { html: '<div class="ai-action">❌ حصلت مشكلة: ' + esc((err && err.message) || err) + '</div>' }); }
  }

  const dstr = (d) => { try { return iso(new Date(d + 'T00:00:00')); } catch { return ''; } };
  const daysTo = (d) => { if (!d) return null; const x = new Date(String(d).slice(0, 10) + 'T00:00:00'); return isNaN(x) ? null : Math.round((x - today()) / 864e5); };
  const lst = (rows, empty) => rows.length ? '<div class="ai-mini" style="line-height:1.9;margin-top:4px">' + rows.join('<br>') + '</div>' : empty;
  function doStat(q) {
    const act = emps.filter((e) => !isTerm(e));
    if (q === 'headcount') return '👥 عدد الموظفين على رأس العمل: <b>' + act.length + '</b>' + (emps.length > act.length ? ' — منتهي الخدمة: ' + (emps.length - act.length) : '');
    if (q === 'payroll') { const g = act.reduce((a, e) => a + Number(e.salaryTotal || 0), 0), n = act.reduce((a, e) => a + Number(e.netSalary || 0), 0); return '💰 إجمالي الرواتب الشهرية (' + act.length + ' موظف): <b>' + num(g) + ' ريال</b><br>الصافي بعد الاستقطاعات: <b>' + num(n) + ' ريال</b>'; }
    if (q === 'iqama' || q === 'contract') {
      const key = q === 'iqama' ? 'iqamaExpiry' : 'contractEnd'; const rows = act.map((e) => ({ e, d: daysTo(e[key]) })).filter((x) => x.d !== null && x.d <= 60).sort((a, b) => a.d - b.d);
      return (q === 'iqama' ? '🪪 إقامات منتهية أو تنتهي خلال 60 يوم: ' : '📄 عقود منتهية أو تنتهي خلال 60 يوم: ') + '<b>' + rows.length + '</b>' + lst(rows.map((x) => esc(x.e.nameAr) + ' — ' + esc(String(x.e[key]).slice(0, 10)) + (x.d < 0 ? ' <b>(منتهية منذ ' + (-x.d) + ' يوم)</b>' : ' (باقي ' + x.d + ' يوم)')), '<br>✅ لا يوجد.');
    }
    if (q === 'onleave') {
      const td = iso(today()); const on = (leaves || []).filter((l) => l && l.from && l.from <= td && (l.to || l.from) >= td && !/rej|cancel|مرفوض/i.test(String(l.status || '')));
      const rows = on.map((l) => { const e = emps.find((x) => String(x.id) === String(l.empId)); return e ? esc(e.nameAr) + ' — ' + esc((LVL[l.type] || {}).ar || l.type) + ' حتى ' + esc(l.to || l.from) : ''; }).filter(Boolean);
      return '🏖️ في إجازة اليوم: <b>' + rows.length + '</b>' + lst(rows, '<br>لا أحد.');
    }
    if (q === 'dept' || q === 'nat') { const m = {}; act.forEach((e) => { const k = (q === 'dept' ? e.dept : e.nationality) || 'غير محدد'; m[k] = (m[k] || 0) + 1; }); return (q === 'dept' ? '🏢 توزيع الموظفين على الأقسام:' : '🌍 توزيع الموظفين حسب الجنسية:') + lst(Object.keys(m).sort((a, b) => m[b] - m[a]).map((k) => esc(k) + ': <b>' + m[k] + '</b>'), ''); }
    if (q === 'list') return '👥 الموظفون (' + act.length + '):' + lst(act.slice(0, 60).map((e) => esc(e.nameAr) + ' — ' + esc(e.jobTitle || '') + (e.dept ? ' — ' + esc(e.dept) : '')), '') + (act.length > 60 ? '<div class="ai-mini">… و' + (act.length - 60) + ' آخرين (افتح صفحة الموظفين)</div>' : '');
    return '';
  }
  const msgBody = (t, e) => {
    let b = ''; const m = t.match(/[:：]\s*([\s\S]+)$/) || t.match(/["«“]([^"»”]+)["»”]/);
    if (m) b = m[1]; else { const m2 = t.match(/(?:تقول|بنص|بخصوص|مفادها|مضمونها|نصها|بعنوان)\s+([\s\S]+)$/); if (m2) b = m2[1]; }
    void e; return b.trim();
  };
  async function doMessage(e, title, body) {
    await rpc('ariba_hr_send_message', { p_employee_id: String(e.id), p_title: title, p_body: body });
    return '✓ اتبعت الرسالة لـ ' + empLabel(e) + ' كإشعار داخل تطبيقه' + (e.email ? ' (وبالإيميل تلقائياً لو خدمة الإيميل مفعّلة)' : '') + '.';
  }
  function handle(t, forced) {
    if (waiting.current && !forced) { const w = waiting.current; waiting.current = null; const k = card('✉️ رسالة لـ ' + empLabel(w) + ':<div style="margin:6px 0;padding:6px 8px;background:rgba(0,0,0,.05);border-radius:6px">' + esc(t) + '</div>', () => doMessage(w, t.length > 60 ? t.slice(0, 57) + '…' : t, t)); void k; return; }
    const intent = understand(t);
    if (intent.kind === 'nav') { const pg = PAGE_WORDS.find((x) => x[1] === intent.page); nav('/' + intent.page); add({ type: 'html', html: '📂 فتحتلك الصفحة.' }); void pg; return; }
    if (intent.kind === 'stat') { add({ type: 'html', html: doStat(intent.q) }); return; }
    if (intent.kind === 'unknown') { add({ type: 'html', html: 'مافهمتش الطلب ده 🤔 جرّب مثلاً:<div class="ai-mini" style="line-height:1.9">• ابعت رسالة لأحمد: الاجتماع الساعة 10<br>• رصيد إجازة فلان / راتب فلان<br>• سجل غياب فلان امبارح / إجازة مرضية لفلان 3 أيام<br>• كشف راتب فلان / مخالصة فلان / شهادة خبرة فلان<br>• كم عدد الموظفين؟ / مين في إجازة النهارده؟<br>• الإقامات اللي بتنتهي / إجمالي الرواتب / توزيع الأقسام<br>• افتح الإجازات / افتح التقارير</div>' }); return; }
    if (intent.kind === 'pwlist') { const k = add({ type: 'html', html: '⏳ …' }); doPwList().then((h) => upd(k, { html: h })); return; }
    let list = forced ? [forced] : findEmployees(t, emps);
    if (!forced && list.length > 1 && /att|leave|payslip/.test(intent.kind)) { const act = list.filter((x) => !isTerm(x)); if (act.length) list = act; }
    if (!list.length) { add({ type: 'html', html: '❓ مش لاقي موظف بالاسم ده.' }); return; }
    if (list.length > 1) { add({ type: 'pick', list: list.slice(0, 8), t }); return; }
    if (intent.kind === 'msg') {
      const e0 = list[0], body = msgBody(t, e0);
      if (!body) { waiting.current = e0; add({ type: 'html', html: '✉️ اكتب نص الرسالة لـ ' + empLabel(e0) + ' (في رسالتك الجاية).' }); return; }
      card('✉️ إرسال رسالة لـ ' + empLabel(e0) + ':<div style="margin:6px 0;padding:6px 8px;background:rgba(0,0,0,.05);border-radius:6px">' + esc(body) + '</div>', () => doMessage(e0, body.length > 60 ? body.slice(0, 57) + '…' : body, body)); return;
    }
    const e = list[0], dates = parseDates(t, intent.kind === 'att'), dur = parseDuration(t), time = parseTime(t), td = iso(today());
    if (intent.kind === 'reset') { card('🔑 إعادة تعيين كلمة مرور تطبيق الموظف لـ ' + empLabel(e) + '<div class="ai-mini">هتطلع كلمة مرور مؤقتة، والقديمة هتبطل.</div>', () => doReset(e)); return; }
    if (intent.kind === 'att') { const d = dates[0] || td; card((intent.status === 'absent' ? '🚫' : '✅') + ' تسجيل ' + ST_AR[intent.status] + ' لـ ' + empLabel(e) + '<br>📅 ' + showDate(d) + (time && intent.status !== 'absent' ? ' — الساعة ' + time : ''), () => doAttendance(e, intent.status, d, time)); return; }
    if (intent.kind === 'leave') {
      let from = dates[0] || td, to = dates[1] || (dur ? iso(addDays(new Date(from + 'T00:00:00'), dur - 1)) : from);
      if (to < from) { const fD = new Date(from + 'T00:00:00'); let tD = new Date(to + 'T00:00:00'); if ((fD - tD) / 864e5 <= 7) { while (tD < fD) tD = addDays(tD, 7); to = iso(tD); } else { const tmp = from; from = to; to = tmp; } }
      card('🏖️ طلب إجازة ' + esc((LVL[intent.type] || {}).ar || '') + ' لـ ' + empLabel(e) + '<br>📅 من ' + showDate(from) + ' إلى ' + showDate(to), () => doLeave(e, intent.type, from, to)); return;
    }
    if (intent.kind === 'form') {
      const f = FORMS[intent.form]; aiBridge.pending = { kind: 'form', form: intent.form, empId: e.id, date: dates[0] || '', print: intent.form !== 'custody' }; nav('/forms');
      add({ type: 'html', html: intent.form === 'custody' ? '📝 فتحتلك ' + f.ar + ' لـ ' + empLabel(e) + ' — ضيف بنود العهدة واضغط طباعة.' : '🖨️ اتفتح ' + f.ar + ' لـ ' + empLabel(e) + ' للطباعة.' }); return;
    }
    if (intent.kind === 'settlement') {
      let reason = ''; const nt = N(t); SETTLE_REASONS.forEach((r) => { if (r[0].test(nt)) reason = r[1]; });
      aiBridge.pending = { kind: 'settlement', empId: e.id, date: dates[0] || '', reason }; nav('/eoscalc');
      add({ type: 'html', html: '🧾 مخالصة ' + empLabel(e) + (dates[0] ? ' — تاريخ الإنهاء ' + showDate(dates[0]) : '') + ' — واتفتحت للطباعة.' }); return;
    }
    if (intent.kind === 'payslip') { aiBridge.pending = { kind: 'payslip', empId: e.id }; nav('/slip'); add({ type: 'html', html: '🖨️ اتفتح كشف راتب ' + empLabel(e) + ' للطباعة.' }); return; }
    if (intent.kind === 'q') add({ type: 'html', html: doQuery(intent.q, e) });
  }
  const send = () => { const t = text.trim(); if (!t) return; setText(''); add({ type: 'html', cls: 'ai-user', html: esc(t) }); try { handle(t); } catch (err) { add({ type: 'html', html: '❌ حصلت مشكلة: ' + esc(err.message || err) }); } };
  void toast;
  return (
    <>
      <button className="ai-fab" type="button" onClick={() => setOpen((o) => !o)}>🤖 اريبا AI</button>
      <div className={'ai-panel' + (open ? ' on' : '')} id="aribaAiPanel" dir="rtl">
        <div className="ai-head"><strong>🤖 مساعد اريبا AI</strong><button className="btn bsm" type="button" onClick={() => setOpen(false)}>✕</button></div>
        <div className="ai-body">
          <div id="aribaAiLog" ref={logRef}>
            {msgs.map((m) => m.type === 'card'
              ? <div key={m.k} className="ai-msg ai-assistant"><div className="ai-action"><div style={{ fontWeight: 700, marginBottom: 6 }} dangerouslySetInnerHTML={{ __html: m.summary }} /><div className="ai-actions"><button className="btn bgl bsm" onClick={() => runCard(m)}>تنفيذ</button> <button className="btn bsm" onClick={() => del(m.k)}>إلغاء</button></div></div></div>
              : m.type === 'pick'
                ? <div key={m.k} className="ai-msg ai-assistant">👥 فيه أكتر من موظف بالاسم ده — تقصد مين؟<div className="ai-actions" style={{ flexWrap: 'wrap' }}>{m.list.map((x) => <button key={x.id} className="btn bsm" onClick={() => { del(m.k); handle(m.t, x); }}>{x.nameAr}{isTerm(x) ? ' (منتهي)' : ''}</button>)}</div></div>
                : <div key={m.k} className={'ai-msg ' + (m.cls || 'ai-assistant')} dangerouslySetInnerHTML={{ __html: m.html }} />)}
          </div>
          <div className="ai-row" style={{ marginTop: 10 }}>
            <textarea id="aribaAiInput" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') send(); }} />
            <button className="btn bpl" type="button" onClick={send}>إرسال</button>
          </div>
        </div>
      </div>
    </>
  );
}
