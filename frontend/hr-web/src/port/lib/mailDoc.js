// "إرسال إيميل للموظف" (V155): إرسال تلقائي بمرفق عبر الدالة ariba-send-email، أو فتح Outlook (سطح المكتب / ويب) مع تنزيل الملف
import { functionCall } from './api.js';
import { toast } from '../components/Toast.jsx';
import { getMailMode } from '../pages/settings/MailCard.jsx';
import { htmlToPdfBlob } from './htmlPdf.js';

// رسائل واضحة لكل سبب فشل (بدون فتح Outlook في وضع الإرسال التلقائي)
const WHY = {
  NETWORK: 'خدمة الإرسال (ariba-send-email) مش منشورة على Supabase لسه — اتبع خطوات النشر في الإعدادات ← البريد والإشعارات',
  PDF_OR_NETWORK: 'تعذر تجهيز PDF أو الاتصال بخدمة الإرسال. راجع إعدادات البريد وحاول مرة أخرى',
  PDF_REQUIRED: 'المرفق لم يصل بصيغة PDF. حدّث واجهة البرنامج ثم أعد الإرسال',
  EMAIL_NOT_CONFIGURED: 'مفيش بريد إرسال محفوظ — اضبط "بريدي أنا" أو "بريد الشركة" في الإعدادات ← البريد والإشعارات',
  NO_EMAIL: 'مفيش إيميل مسجل للموظف ده في ملفه',
  SMTP_PORT_BLOCKED: 'منفذ البريد ممنوع من سيرفر Supabase — لـ Gmail استخدم smtp.gmail.com والمنفذ 465',
  M365_GRAPH_NOT_CONFIGURED: 'إرسال Microsoft 365 غير مكتمل: يجب إعداد M365_TENANT_ID وM365_CLIENT_ID وM365_CLIENT_SECRET في أسرار Supabase، وتفعيل صلاحية Microsoft Graph Mail.Send وموافقة مسؤول Microsoft 365.',
  M365_TOKEN_FAILED: 'تعذر الحصول على رمز Microsoft 365. راجع بيانات تطبيق Microsoft في أسرار Supabase.',
  M365_SEND_FAILED: 'Microsoft 365 رفض الإرسال. راجع صلاحية Mail.Send وموافقة مسؤول Microsoft 365 وصلاحية التطبيق على صندوق البريد.',
  M365_ATTACHMENT_TOO_LARGE: 'حجم ملف PDF أكبر من الحد المناسب للإرسال المباشر عبر Microsoft 365. قلّل حجم الملف ثم أعد المحاولة.',
  UNAUTHENTICATED: 'انتهت الجلسة — سجّل الدخول من جديد', NOT_AUTHORIZED: 'مفيش صلاحية إرسال',
};
const smtpHint = (m) => (/Invalid login|Username and Password not accepted|535|BadCredentials/i.test(m) ? ' — كلمة المرور مرفوضة: لـ Gmail لازم "كلمة مرور تطبيق" (App Password) من حساب Google وليس كلمة المرور العادية' : /ENOTFOUND|getaddrinfo/i.test(m) ? ' — اسم الخادم غلط (المفروض smtp.gmail.com)' : '');
async function serverSend(type, emp, cap) {
  let r;
  try {
    const pdf = await htmlToPdfBlob(cap.html, { onePage: /salary_cert|clearance|experience|contract_end|onboarding|custody|extension|termination|offer|settlement/i.test(String(type || '')) });
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const base = btoa(bin);
    const filename = String(cap.title || type || 'document').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 100) + '.pdf';
    r = await functionCall('ariba-send-email', { type, employee_id: String(emp.id), emp_no: String(emp.empNo || emp.id || ''), title: cap.title, attachment: { filename, base64: base, contentType: 'application/pdf' } });
  }
  catch (e) { return { ok: false, code: 'PDF_OR_NETWORK', msg: String(e && e.message || e) }; }
  const j = (r && r.data) || {};
  if (j.ok) return { ok: true, to: j.to };
  if (!j.error) return { ok: false, code: r && r.status === 404 ? 'NETWORK' : 'HTTP', msg: 'HTTP ' + (r && r.status) };
  return { ok: false, code: j.error, msg: j.message || '' };
}

/** cap = { title, html } — بيرجّع true لو العملية خلصت (إرسال أو فتح Outlook) */
export async function mailDoc(type, emp, cap) {
  if (!emp || !cap || !cap.html) return false;
  const mode = getMailMode();
  if (mode === 'server') {
    if (!window.confirm('هيتبعت "' + cap.title + '" على الإيميل المسجل للموظف مع المستند كمرفق. متأكد؟')) return false;
    const rs = await serverSend(type, emp, cap);
    if (rs.ok) { toast('✅ اتبعت على إيميل الموظف (' + (rs.to || '') + ') مع المرفق', 'tin'); return true; }
    toast('⚠️ ما اتبعتش: ' + (WHY[rs.code] || rs.msg || rs.code) + (rs.code === 'SEND_FAILED' ? smtpHint(rs.msg || '') : ''), 'ter');
    return false;
  }
  const to = String(emp.email || emp.mail || emp.ml || '').trim();
  if (!to) { toast('⚠️ مفيش إيميل مسجل للموظف ده', 'ter'); return false; }
  let pdfBlob;
  try { pdfBlob = await htmlToPdfBlob(cap.html, { onePage: /salary_cert|clearance|experience|contract_end|onboarding|custody|extension|termination|offer|settlement/i.test(String(type || '')) }); } catch (e) { toast('⚠️ تعذر تحويل المستند إلى PDF: ' + String(e && e.message || e), 'ter'); return false; }
  const fname = type + '_' + String(emp.nameEn || emp.nameAr || emp.id).replace(/[^\w؀-ۿ]+/g, '_') + '.pdf';
  const a = document.createElement('a'); a.href = URL.createObjectURL(pdfBlob); a.download = fname; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  const subj = cap.title || 'مستند من الموارد البشرية';
  const body = 'عزيزي/عزيزتي ' + (emp.nameAr || '') + '،\r\n\r\nمرفق ' + subj + '.\r\n\r\nمع التحية،\r\nالموارد البشرية';
  const url = mode === 'outlook_web'
    ? 'https://outlook.office.com/mail/deeplink/compose?to=' + encodeURIComponent(to) + '&subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body)
    : 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body);
  setTimeout(() => { if (mode === 'outlook_web') window.open(url, '_blank', 'noopener'); else window.location.href = url; }, 700);
  toast('📎 اتحمّلت قسيمة/النموذج بصيغة PDF وفتحنا Outlook — أرفق ملف PDF واضغط إرسال', 'tin');
  return true;
}
