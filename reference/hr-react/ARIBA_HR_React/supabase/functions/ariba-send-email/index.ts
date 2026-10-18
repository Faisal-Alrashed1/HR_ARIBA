// ariba-send-email — نسخة ملف واحد للنشر من لوحة Supabase (Edge Functions › Deploy a new function › Via Editor)
// اسم الدالة لازم يكون بالظبط: ariba-send-email — وبعد النشر: Settings › اقفل "Enforce JWT verification"
// أدوات الإرسال المشتركة: يرسل من حساب البريد المحفوظ في الإعدادات (ariba_mail_accounts) عبر SMTP،
// ولو المنفذ محجوب في Supabase (25 / 587 — ومنها Microsoft 365) أو الإرسال فشل، يستخدم Resend لو مضبوط.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-notify-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
// ملاحظة: الأخطاء المتوقعة ترجع 200 مع ok:false عشان المتصفح يقرا الرسالة ويقرر (مثلاً يفتح Outlook بدل الإرسال التلقائي)
export const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
export const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
export const isEmail = (x: unknown) => /^\S+@\S+\.\S+$/.test(String(x ?? "").trim());
export const admin = (): SupabaseClient => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export const STAFF_ROLES = new Set(["admin", "chairman", "hr", "ceo", "admin_manager", "finance", "accountant"]);
/** المستخدم الحالي من الـJWT */
export async function caller(sb: SupabaseClient, req: Request) {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) return null;
  const { data: acc } = await sb.from("ariba_auth_accounts").select("role,employee_id,active").eq("auth_user_id", u.user.id).maybeSingle();
  return acc?.active ? acc as { role: string; employee_id: string } : null;
}

export type Account = { owner: string; host: string; port: number; secure: boolean; username: string; password: string; from_name: string | null; from_email: string };
/** حساب الإرسال: بريد المسؤول نفسه، ولو مش موجود بريد الشركة */
export async function pickAccount(sb: SupabaseClient, ownerId: string | null): Promise<Account | null> {
  const owners = [ownerId, "company"].filter(Boolean) as string[];
  const { data } = await sb.from("ariba_mail_accounts").select("*").in("owner", owners);
  const rows = (data ?? []) as Account[];
  return rows.find((r) => r.owner === ownerId) ?? rows.find((r) => r.owner === "company") ?? null;
}

const BLOCKED = new Set([25, 587]); // Supabase/Deno Deploy يمنع الاتصال الخارجي على المنفذين دول

export type Mail = { to: string[]; subject: string; html: string; attachments?: { filename: string; content: string; contentType?: string }[] };
export type SendResult = { ok: true; via: string; from: string } | { ok: false; error: string; message: string };

/** تصحيح أخطاء الكتابة الشائعة + المنفذ: Gmail لازم 465 لأن Supabase يمنع 587 */
export function fixAccount(acc: Account): Account {
  let host = String(acc.host || "").trim().toLowerCase(), port = Number(acc.port) || 465;
  if (/^smtp\.(gmil|gmial|gmai|gamil|gmal)\.com$/.test(host) || host === "gmail.com" || host === "smtp.gmail") host = "smtp.gmail.com";
  if (BLOCKED.has(port) && !/office365|outlook/i.test(host)) port = 465; // لا نغيّر منفذ Microsoft 365؛ يستخدم Graph OAuth بدلاً من SMTP
  return { ...acc, host, port, secure: port === 465 ? true : !!acc.secure };
}

export async function sendMail(acc0: Account | null, m: Mail): Promise<SendResult> {
  const errs: string[] = [];
  const isO365 = !!acc0 && /office365|outlook\.com|live\.com|hotmail|smtp\.office365\.com/i.test(acc0.host);
  const acc = acc0 ? fixAccount(acc0) : null;
  if (acc && isO365) {
    const tenant = Deno.env.get("M365_TENANT_ID"), clientId = Deno.env.get("M365_CLIENT_ID"), clientSecret = Deno.env.get("M365_CLIENT_SECRET");
    if (!tenant || !clientId || !clientSecret) return { ok: false, error: "M365_GRAPH_NOT_CONFIGURED", message: "Microsoft 365 يحتاج أسرار Supabase: M365_TENANT_ID وM365_CLIENT_ID وM365_CLIENT_SECRET، وصلاحية Microsoft Graph Mail.Send مع موافقة المسؤول." };
    const from = String(acc.from_email || acc.username || "").trim();
    try {
      if ((m.attachments || []).some((a) => a.content.length > 4_000_000)) return { ok: false, error: "M365_ATTACHMENT_TOO_LARGE", message: "ملف PDF أكبر من 3 MB؛ قلّل حجمه ثم أعد الإرسال." };
      const tr = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }) });
      const tj = await tr.json().catch(() => ({}));
      if (!tr.ok || !tj.access_token) return { ok: false, error: "M365_TOKEN_FAILED", message: "فشل تسجيل تطبيق Microsoft 365؛ راجع بيانات التطبيق في Supabase." };
      const message = { subject: m.subject, body: { contentType: "HTML", content: m.html }, toRecipients: m.to.map((address) => ({ emailAddress: { address } })), attachments: (m.attachments || []).map((a) => ({ "@odata.type": "#microsoft.graph.fileAttachment", name: a.filename, contentType: a.contentType || "application/pdf", contentBytes: a.content })) };
      const sent = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`, { method: "POST", headers: { Authorization: `Bearer ${tj.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ message, saveToSentItems: true }) });
      if (!sent.ok) return { ok: false, error: "M365_SEND_FAILED", message: `Microsoft 365 رفض الإرسال (${sent.status}). راجع صلاحية Mail.Send وموافقة المسؤول وصلاحية التطبيق على صندوق البريد. ` + (await sent.text()).slice(0, 180) };
      return { ok: true, via: "microsoft_graph", from };
    } catch (e) { return { ok: false, error: "M365_SEND_FAILED", message: "تعذر الاتصال بـ Microsoft Graph: " + String((e as Error)?.message ?? e).slice(0, 180) }; }
  }
  if (acc && !BLOCKED.has(Number(acc0!.port))) {
    try {
      const t = nodemailer.createTransport({ host: acc.host, port: Number(acc.port), secure: !!acc.secure || Number(acc.port) === 465, auth: { user: acc.username, pass: acc.password }, connectionTimeout: 15000 });
      await t.sendMail({
        from: acc.from_name ? `"${acc.from_name.replace(/"/g, "")}" <${acc.from_email}>` : acc.from_email, to: m.to, subject: m.subject, html: m.html,
        attachments: (m.attachments ?? []).map((a) => ({ filename: a.filename, content: a.content, encoding: "base64", contentType: a.contentType })),
      });
      return { ok: true, via: "smtp", from: acc.from_email };
    } catch (e) { errs.push("SMTP: " + String((e as Error)?.message ?? e).slice(0, 200)); }
  } else if (acc0) errs.push(`SMTP_PORT_BLOCKED (${acc0.host}:${acc0.port})`);

  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("EMAIL_FROM");
  if (key && from) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: m.to, subject: m.subject, html: m.html, reply_to: acc?.from_email || undefined, attachments: (m.attachments ?? []).map((a) => ({ filename: a.filename, content: a.content })) }),
    });
    if (r.ok) return { ok: true, via: "resend", from };
    errs.push("Resend: " + (await r.text()).slice(0, 200));
  }
  if (!acc && !(key && from)) return { ok: false, error: "EMAIL_NOT_CONFIGURED", message: "مفيش بريد إرسال مضبوط (الإعدادات ← البريد والإشعارات)" };
  const blocked = errs.length === 1 && errs[0].startsWith("SMTP_PORT_BLOCKED");
  return blocked
    ? { ok: false, error: "SMTP_PORT_BLOCKED", message: "منفذ " + acc0!.port + " (" + acc0!.host + ") ممنوع من سيرفر Supabase — Microsoft 365 لا يعمل إلا عليه. استخدم Gmail (منفذ 465) أو Resend" }
    : { ok: false, error: "SEND_FAILED", message: errs.join(" | ") };
}

export const wrap = (title: string, inner: string) => `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
  <div style="background:#014D3D;color:#fff;padding:14px 18px;font-weight:700">${esc(title)}</div>
  <div style="padding:18px;line-height:1.9;color:#111">${inner}</div>
  <div style="padding:10px 18px;background:#f8fafc;color:#64748b;font-size:12px">الموارد البشرية — أريبا</div></div>`;

export const b64utf8 = (s: string) => { const b = new TextEncoder().encode(s); let out = ""; for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(out); };

// ariba-send-email — زر "إرسال إيميل للموظف" (النماذج / المخالصة): يرسل المستند كمرفق على إيميل الموظف
// من بريد المسؤول المحفوظ في الإعدادات (أو بريد الشركة). انشرها مع verify_jwt=false (التحقق من المستخدم داخل الدالة).

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = admin();
    const acc = await caller(sb, req);
    if (!acc) return json({ ok: false, error: "UNAUTHENTICATED", message: "سجّل الدخول من جديد" });
    if (!STAFF_ROLES.has(acc.role)) return json({ ok: false, error: "NOT_AUTHORIZED", message: "مفيش صلاحية إرسال" });

    let b: any; try { b = await req.json(); } catch { return json({ ok: false, error: "BAD_JSON", message: "طلب غير صالح" }); }
    // رسالة تجربة من الإعدادات: بتتبعت لنفس بريد الإرسال عشان تتأكد إن الإعدادات صح
    if (b.test === true) {
      const account = await pickAccount(sb, b.scope === "company" ? null : acc.employee_id);
      if (!account) return json({ ok: false, error: "EMAIL_NOT_CONFIGURED", message: "مفيش بريد إرسال محفوظ" });
      const to = isEmail(b.to) ? String(b.to).trim() : account.from_email;
      const r = await sendMail(b.scope === "company" ? account : account, { to: [to], subject: "رسالة تجربة — نظام الموارد البشرية", html: wrap("رسالة تجربة", "لو وصلتك الرسالة دي يبقى إعدادات البريد سليمة والإرسال التلقائي شغال ✓") });
      return json(r.ok ? { ok: true, to, via: r.via, from: r.from } : r);
    }
    const empId = String(b.employee_id || "").trim(), title = String(b.title || "مستند من الموارد البشرية").slice(0, 200);
    const att = b.attachment && typeof b.attachment === "object" ? b.attachment : null;
    if (!empId) return json({ ok: false, error: "BAD_INPUT", message: "رقم الموظف غير موجود" });
    if (!att || typeof att.base64 !== "string" || !att.base64.trim()) return json({ ok: false, error: "PDF_REQUIRED", message: "المرفق لم يصل بصيغة PDF؛ حدّث واجهة البرنامج ثم أعد الإرسال." });
    const filename = String(att.filename || "").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 140);
    const contentType = String(att.contentType || "application/pdf").toLowerCase();
    const base64 = att.base64.replace("data:application/pdf;base64,", "").replace(/\s/g, "");
    if (contentType !== "application/pdf" || !filename.toLowerCase().endsWith(".pdf") || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length < 16 || base64.length > 12000000) return json({ ok: false, error: "BAD_ATTACHMENT", message: "المرفق يجب أن يكون PDF صالحًا وبحجم مناسب." });
    let signature = ""; try { signature = atob(base64.slice(0, 16)).slice(0, 4); } catch { /* invalid base64 */ }
    if (signature !== "%PDF") return json({ ok: false, error: "BAD_ATTACHMENT", message: "المرفق المرسل ليس ملف PDF صحيحًا." });

    const { data: emp } = await sb.from("employee_directory").select("name_ar,data").eq("employee_id", empId).maybeSingle();
    const d = (emp?.data ?? {}) as Record<string, unknown>;
    const to = [d.email, d.workEmail, d.mail].map((x) => String(x ?? "").trim()).find(isEmail);
    if (!to) return json({ ok: false, error: "NO_EMAIL", message: "مفيش إيميل مسجل للموظف ده" });

    const account = await pickAccount(sb, acc.employee_id);
    const name = String(emp?.name_ar ?? d.nameAr ?? "");
    const r = await sendMail(account, {
      to: [to], subject: title,
      html: wrap(title, `عزيزي/عزيزتي ${esc(name)}،<br>مرفق <b>${esc(title)}</b> بصيغة PDF على الورق الرسمي للشركة.<br><br>مع التحية،<br>الموارد البشرية`),
      attachments: [{ filename, content: base64, contentType: "application/pdf" }],
    });
    if (!r.ok) return json(r);
    await sb.from("ariba_audit_log").insert({ actor_employee_id: acc.employee_id, actor_role: acc.role, module: "forms", action: "email_document", summary: `إرسال ${title} بالإيميل إلى ${to}`, details: { type: b.type, employee_id: empId, via: r.via, format: "pdf" } }).then(() => {}, () => {});
    return json({ ok: true, to, via: r.via, from: r.from });
  } catch (e) {
    return json({ ok: false, error: "SERVER_ERROR", message: String((e as Error)?.message ?? e).slice(0, 300) });
  }
});
