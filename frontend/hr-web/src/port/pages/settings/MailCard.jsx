import { useEffect, useState } from 'react';
import { T } from '../../lib/i18n.js';
import { rpc, functionCall } from '../../lib/api.js';
import { toast } from '../../components/Toast.jsx';
import { Card } from './shared.jsx';

export const MAIL_KEY = 'ariba_mail_mode';
export const getMailMode = () => { try { const v = localStorage.getItem(MAIL_KEY); return v === 'outlook_desktop' || v === 'outlook_web' ? v : 'server'; } catch { return 'server'; } };

const INP = { background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '7px 10px', fontSize: 12, width: '100%' };
const lb = { fontSize: 10, color: 'var(--mu)', display: 'block', marginBottom: 2 };
const PRESETS = { o365: { host: 'smtp.office365.com', port: 587, secure: false }, gmail: { host: 'smtp.gmail.com', port: 465, secure: true }, custom: null };
// نوع البريد بيتحدد من الخادم المحفوظ (عشان بعد التحديث يفضل على آخر اختيار)
const provOf = (host) => (/gmail|gmil|gmial/i.test(host || '') ? 'gmail' : /office365|outlook|live\.com|hotmail/i.test(host || '') ? 'o365' : 'custom');
/** تصحيح الإعدادات قبل الحفظ: أخطاء كتابة Gmail + المنفذ 587 ممنوع من سيرفر Supabase (Gmail يشتغل على 465) */
export function normalizeMail(f) {
  const n = { ...f, host: String(f.host || '').trim().toLowerCase(), port: Number(f.port) || 0 }; const notes = [];
  if (/^smtp\.(gmil|gmial|gmai|gamil|gmal)\.com$/.test(n.host) || n.host === 'gmail.com' || n.host === 'smtp.gmail') { notes.push('اتصحح الخادم من ' + n.host + ' لـ smtp.gmail.com'); n.host = 'smtp.gmail.com'; }
  if (n.host === 'smtp.gmail.com' && n.port !== 465) { notes.push('اتغير المنفذ لـ 465 (SSL) لأن سيرفر الإرسال يمنع المنفذ ' + (n.port || 587)); n.port = 465; n.secure = true; }
  if (n.port === 465) n.secure = true;
  return { f: n, notes };
}

/** نموذج بيانات بريد إرسال (SMTP). scope: 'mine' = بريدي أنا، 'company' = بريد الشركة (إشعارات النظام) */
function MailForm({ scope }) {
  const [f, setF] = useState({ host: 'smtp.office365.com', port: 587, secure: false, username: '', password: '', from_name: '', from_email: '' });
  const [st, setSt] = useState(null), [busy, setBusy] = useState(false);
  const load = async () => {
    try { const r = await rpc('ariba_mail_get', { p_scope: scope }); if (r && r.configured) { setF((x) => ({ ...x, host: r.host, port: r.port, secure: !!r.secure, username: r.username, password: '', from_name: r.from_name || '', from_email: r.from_email })); setProv(provOf(r.host)); setSt('on'); } else setSt('off'); }
    catch (e) { setSt(/Could not find|schema cache|ariba_mail_get/i.test(String(e.message)) ? 'nodb' : 'off'); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const [prov, setProv] = useState('o365');
  const preset = (e) => { const v = e.target.value; setProv(v); const p = PRESETS[v]; if (p) setF({ ...f, ...p }); };
  const save = async () => {
    if (!f.host || !f.username || !f.from_email) return toast(T('اكتب الخادم واسم المستخدم وعنوان المرسل', 'Enter host, username and sender address'), 'ter');
    const nm = normalizeMail(f); const g = nm.f; if (nm.notes.length) { setF((x) => ({ ...x, host: g.host, port: g.port, secure: g.secure })); toast('ℹ️ ' + nm.notes.join(' — '), 'tin'); }
    setBusy(true);
    try { await rpc('ariba_mail_set', { p_scope: scope, p_host: g.host, p_port: +g.port || 465, p_secure: !!g.secure, p_username: f.username, p_password: (prov === 'o365' ? (f.password || 'GRAPH_OAUTH') : f.password), p_from_name: f.from_name, p_from_email: f.from_email }); toast(T('✓ اتحفظ بريد الإرسال', '✓ Sending mailbox saved'), 'tin'); setF((x) => ({ ...x, password: '' })); load(); }
    catch (e) { toast('⚠️ ' + (/PASSWORD_REQUIRED/.test(e.message) ? T('اكتب كلمة المرور', 'Enter the password') : (e.message || T('تعذر الحفظ', 'Could not save'))), 'ter'); }
    setBusy(false);
  };
  const test = async () => {
    setBusy(true);
    try {
      const r = await functionCall('ariba-send-email', { test: true, scope }); const j = (r && r.data) || {};
      if (j.ok) toast('✅ اتبعتت رسالة تجربة على ' + j.to + ' — شيك على البريد الوارد (أو Spam)', 'tin');
      else if (r && r.status === 404) toast('⚠️ خدمة الإرسال مش منشورة على Supabase لسه (ariba-send-email)', 'ter');
      else toast('⚠️ ' + (j.message || j.error || ('HTTP ' + (r && r.status))) + (/Invalid login|535|Username and Password/i.test(j.message || '') ? ' — لـ Gmail لازم كلمة مرور تطبيق (App Password)' : ''), 'ter');
    } catch { toast('⚠️ خدمة الإرسال مش منشورة على Supabase لسه (ariba-send-email) — اتبع خطوات النشر', 'ter'); }
    setBusy(false);
  };
  const del = async () => { if (!window.confirm(T('حذف بيانات البريد المحفوظة؟', 'Delete the saved mailbox?'))) return; try { await rpc('ariba_mail_delete', { p_scope: scope }); setF({ ...f, username: '', password: '', from_name: '', from_email: '' }); load(); } catch (e) { toast('⚠️ ' + e.message, 'ter'); } };
  if (st === 'nodb') return <div className="al alb" style={{ fontSize: 11.5 }}><i className="ti ti-info-circle" /><span>{T('شغّل ملفي sql/15 و sql/18 مرة واحدة في Supabase SQL Editor لتفعيل بريد الإرسال.', 'Run sql/15_mail_accounts_and_notify_email.sql and sql/18_run_once_remaining.sql once in the Supabase SQL Editor.')}</span></div>;
  return (
    <div id={'ML_FORM_' + scope}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8 }}>
        <div><label style={lb}>{T('نوع البريد', 'Provider')}</label><select style={INP} onChange={preset} value={prov} id={'ML_PROV_' + scope}><option value="o365">Microsoft 365 / Outlook</option><option value="gmail">Gmail</option><option value="custom">{T('آخر (يدوي)', 'Other')}</option></select></div>
        <div><label style={lb}>{T('خادم SMTP', 'SMTP host')}</label><input style={INP} value={f.host} onChange={set('host')} /></div>
        <div><label style={lb}>{T('المنفذ', 'Port')}</label><input style={INP} type="number" value={f.port} onChange={set('port')} /></div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}><label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={f.secure} onChange={set('secure')} /> SSL ({T('منفذ 465', 'port 465')})</label></div>
        <div><label style={lb}>{T('اسم المستخدم (إيميلك)', 'Username (your email)')}</label><input style={INP} id={'ML_USER_' + scope} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value, from_email: f.from_email || e.target.value })} autoComplete="off" /></div>
        <div><label style={lb}>{T(prov === 'o365' ? 'كلمة المرور (غير مستخدمة مع Microsoft 365 Graph)' : 'كلمة المرور / كلمة مرور التطبيق', prov === 'o365' ? 'Password (not used by Microsoft 365 Graph)' : 'Password / app password')}</label><input style={INP} id={'ML_PASS_' + scope} type="password" value={f.password} onChange={set('password')} placeholder={prov === 'o365' ? T('اتركها فارغة — الإرسال عبر Microsoft Graph بعد إعداد الخادم', 'Leave blank — Microsoft Graph is configured server-side') : (st === 'on' ? T('محفوظة — اتركها فاضية للإبقاء', 'saved — leave empty to keep') : '')} autoComplete="new-password" /></div>
        <div><label style={lb}>{T('اسم المرسل الظاهر', 'Sender name')}</label><input style={INP} value={f.from_name} onChange={set('from_name')} placeholder={T('الموارد البشرية', 'HR')} /></div>
        <div><label style={lb}>{T('عنوان المرسل', 'Sender address')}</label><input style={INP} id={'ML_FROM_' + scope} value={f.from_email} onChange={set('from_email')} /></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn bpl bsm" id={'ML_SAVE_' + scope} disabled={busy} onClick={save}><i className="ti ti-device-floppy" /> {T('حفظ', 'Save')}</button>
        {st === 'on' && <button className="btn bsm" style={{ borderColor: 'var(--rd)', color: 'var(--rd)' }} onClick={del}>{T('حذف', 'Delete')}</button>}
        {st === 'on' && <button className="btn bsm" id={'ML_TEST_' + scope} disabled={busy} onClick={test}><i className="ti ti-send" /> {T('إرسال رسالة تجربة', 'Send test email')}</button>}
        <span style={{ fontSize: 12, fontWeight: 700, color: st === 'on' ? '#0a7a3f' : 'var(--mu)' }}>{st === 'on' ? T('🟢 مضبوط — الإرسال من ', '🟢 Active — sending from ') + f.from_email : T('⚪ غير مضبوط', '⚪ Not set')}</span>
      </div>
    </div>
  );
}

/** بريدي أنا — يُرسل منه المسؤول النماذج والتقارير والمخالصات */
export function MyMailCard() {
  return (
    <Card icon="mail" title={T('بريدي أنا (إرسال النماذج والتقارير)', 'My mailbox (sending documents & reports)')} id="ML_CARD">
      <div style={{ fontSize: 11.5, color: 'var(--mu)', marginBottom: 8, lineHeight: 1.7 }}>{T('كل مسؤول يكتب بريده هنا مرة واحدة. Gmail يستخدم كلمة مرور تطبيق. بريد Microsoft 365 للشركة يُرسل عبر Microsoft Graph بعد إعداد بيانات تطبيق Microsoft في أسرار Supabase؛ لا تضع كلمة مرور Microsoft هنا. لو لم يُضبط Graph فلن ينجح الإرسال من Outlook.', 'Each approver enters their mailbox once. Gmail uses an App Password. Company Microsoft 365 sends through Microsoft Graph after Microsoft app credentials are configured in Supabase secrets; do not enter a Microsoft password here. Graph must be configured for Outlook sending.')}</div>
      <MailForm scope="mine" />
    </Card>
  );
}

/** بريد الشركة — إشعارات النظام التلقائية */
export function CompanyMailCard() {
  return (
    <Card icon="building" title={T('بريد الشركة (إشعارات النظام التلقائية)', 'Company mailbox (automatic system notifications)')} id="ML_CO_CARD">
      <div style={{ fontSize: 11.5, color: 'var(--mu)', marginBottom: 8, lineHeight: 1.7 }}>{T('أي إشعار جديد (طلب إجازة، نموذج، موافقة، رفض، مهمة...) يوصل للموظف أو المسؤول المعني بإيميل تلقائياً من هذا البريد. Microsoft 365 يحتاج إعداد Microsoft Graph في أسرار Supabase.', 'New notifications are emailed from this mailbox. Microsoft 365 requires Microsoft Graph secrets configured in Supabase.')}</div>
      <MailForm scope="company" />
    </Card>
  );
}

/** طريقة زر "إرسال إيميل للموظف" على هذا الجهاز */
export function MailModeCard() {
  const [m, setM] = useState(getMailMode);
  const ch = (e) => { setM(e.target.value); try { localStorage.setItem(MAIL_KEY, e.target.value); } catch { /* ignore */ } };
  return (
    <Card icon="send" title={T('طريقة إرسال الإيميل على هذا الجهاز', 'Email sending method on this device')} id="ML_MODE_CARD">
      <div style={{ fontSize: 11.5, color: 'var(--mu)', marginBottom: 6 }}>{T('طريقة زر "إرسال إيميل للموظف" على هذا الجهاز:', 'What "Send email to employee" does on this device:')}</div>
      <select id="ML_MODE" value={m} onChange={ch} style={{ ...INP, width: 'auto', minWidth: 260 }}>
        <option value="server">{T('إرسال تلقائي بمرفق من بريدي (بدون فتح Outlook نهائياً)', 'Automatic with attachment from my mailbox (never opens Outlook)')}</option>
        <option value="outlook_desktop">{T('أفتح Outlook (برنامج الكمبيوتر)', 'Open Outlook desktop')}</option>
        <option value="outlook_web">{T('أفتح Outlook على الويب', 'Open Outlook on the web')}</option>
      </select>
    </Card>
  );
}

/** توافق قديم: الثلاث كروت مع بعض */
export default function MailCard() {
  return <><MyMailCard /><CompanyMailCard /><MailModeCard /></>;
}
