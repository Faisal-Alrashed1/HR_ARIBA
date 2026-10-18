// ariba-notify-email — نسخة ملف واحد للنشر من لوحة Supabase (Edge Functions › Deploy a new function › Via Editor)
// اسم الدالة لازم يكون بالظبط: ariba-notify-email — وبعد النشر: Settings › اقفل "Enforce JWT verification"
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
  if (BLOCKED.has(port)) port = 465; // نجرب SSL على 465 بدل المنفذ الممنوع (Gmail وأغلب مزودي البريد بيدعموه)
  return { ...acc, host, port, secure: port === 465 ? true : !!acc.secure };
}

export async function sendMail(acc0: Account | null, m: Mail): Promise<SendResult> {
  const errs: string[] = [];
  const isO365 = !!acc0 && /office365|outlook\.com|live\.com|hotmail/i.test(acc0.host);
  const acc = acc0 ? fixAccount(acc0) : null;
  if (acc && !(isO365 && BLOCKED.has(Number(acc0!.port)))) {
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

// ariba-notify-email — تستدعيها قاعدة البيانات (trigger ariba_notif_email في sql/15) مع كل إشعار جديد،
// وترسل إيميل لصاحب الإشعار من "بريد الشركة" المحفوظ في الإعدادات. انشرها مع verify_jwt=false.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = admin();
    const { data: k } = await sb.from("ariba_private_kv").select("value").eq("key", "notify_key").maybeSingle();
    if (!k?.value || req.headers.get("x-notify-key") !== k.value) return json({ ok: false, error: "FORBIDDEN" }, 403);
    const b = await req.json().catch(() => ({}));
    const id = String(b.recipient_employee_id || "");
    if (!id) return json({ ok: false, error: "NO_RECIPIENT" });
    const { data: emp } = await sb.from("employee_directory").select("name_ar,data").eq("employee_id", id).maybeSingle();
    const d = (emp?.data ?? {}) as Record<string, unknown>;
    const to = [d.email, d.workEmail, d.mail].map((x) => String(x ?? "").trim()).find(isEmail);
    if (!to) return json({ ok: false, error: "NO_EMAIL" });
    const title = String(b.title || "إشعار من الموارد البشرية").slice(0, 200);
    const r = await sendMail(await pickAccount(sb, null), { to: [to], subject: title, html: wrap(title, `مرحباً ${esc(String(emp?.name_ar ?? ""))}،<br>${esc(String(b.body || ""))}`) });
    return json(r);
  } catch (e) {
    return json({ ok: false, error: "SERVER_ERROR", message: String((e as Error)?.message ?? e).slice(0, 300) });
  }
});
