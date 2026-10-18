// ariba-send-report — يرسل تقريراً (مرفق) تلقائياً لعدة مستلمين بدون فتح برنامج بريد
// الأسرار: RESEND_API_KEY ، EMAIL_FROM  (SUPABASE_URL / SERVICE_ROLE تلقائية). يتطلب مستخدماً مسجلاً بدور HR/admin/chairman/ceo/finance...
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const ALLOWED = new Set(["admin", "chairman", "hr", "ceo", "admin_manager", "finance", "accountant"]);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) return json({ ok: false, error: "UNAUTHENTICATED" }, 401);
  const { data: acc } = await sb.from("ariba_auth_accounts").select("role,employee_id,active").eq("auth_user_id", u.user.id).maybeSingle();
  if (!acc?.active || !ALLOWED.has(acc.role)) return json({ ok: false, error: "NOT_AUTHORIZED" }, 403);

  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("EMAIL_FROM");
  if (!key || !from) return json({ ok: false, error: "EMAIL_NOT_CONFIGURED", message: "أسرار RESEND_API_KEY / EMAIL_FROM غير مضبوطة" }, 500);

  let b: any; try { b = await req.json(); } catch { return json({ ok: false, error: "BAD_JSON" }, 400); }
  const to: string[] = (Array.isArray(b.to) ? b.to : []).map((x: unknown) => String(x).trim()).filter((x: string) => /^\S+@\S+\.\S+$/.test(x)).slice(0, 30);
  if (!to.length) return json({ ok: false, error: "NO_RECIPIENTS", message: "لا يوجد مستلم بإيميل صحيح" }, 400);
  const att = b.attachment; if (!att?.base64 || String(att.base64).length > 10_000_000) return json({ ok: false, error: "BAD_ATTACHMENT" }, 400);
  const subject = String(b.subject || "تقرير من الموارد البشرية").slice(0, 200), msg = String(b.message || "").slice(0, 2000);
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9"><p>السلام عليكم ورحمة الله،</p><p>${esc(msg || "مرفق التقرير المطلوب.")}</p><p>مع التحية،<br>الموارد البشرية</p></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, attachments: [{ filename: String(att.name || "report").slice(0, 120), content: att.base64 }] }),
  });
  if (!r.ok) return json({ ok: false, error: "SEND_FAILED", message: (await r.text()).slice(0, 300) }, 502);
  await sb.from("ariba_audit_log").insert({ actor_employee_id: acc.employee_id, actor_role: acc.role, module: "reports", action: "email_report", summary: `إرسال تقرير بالإيميل (${to.length} مستلم): ${subject}`, details: { to, file: att.name } });
  return json({ ok: true, sent: to.length });
});
