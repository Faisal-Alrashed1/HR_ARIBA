// ariba-notify-dispatch — يرسل إيميل لكل إشعار لم يُرسل بعد (workflow_notifications.emailed_at is null)
// الأسرار المطلوبة: NOTIFY_SECRET ، RESEND_API_KEY ، EMAIL_FROM (مثال: "Ariba HR <hr@yourdomain.com>")
// (SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY موجودة تلقائياً). انشرها مع verify_jwt=false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.headers.get("x-dispatch-secret") !== Deno.env.get("NOTIFY_SECRET")) return new Response("forbidden", { status: 403 });
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("EMAIL_FROM");
  if (!key || !from) return new Response(JSON.stringify({ ok: false, error: "RESEND_API_KEY/EMAIL_FROM missing" }), { status: 500 });

  const { data: rows, error } = await sb.from("workflow_notifications")
    .select("id,recipient_employee_id,title,body,created_at,email_tries").is("emailed_at", null).lt("email_tries", 5)
    .order("created_at").limit(40);
  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });

  let sent = 0, failed = 0, skipped = 0;
  for (const n of rows ?? []) {
    const { data: emp } = await sb.from("employee_directory").select("name_ar,data").eq("employee_id", n.recipient_employee_id).maybeSingle();
    const to = (emp?.data as any)?.email || (emp?.data as any)?.workEmail;
    if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
      await sb.from("workflow_notifications").update({ emailed_at: new Date().toISOString(), email_error: "no-email" }).eq("id", n.id);
      skipped++; continue;
    }
    const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
      <div style="background:#0f3d4c;color:#fff;padding:14px 18px;font-weight:700">${esc(n.title)}</div>
      <div style="padding:18px;line-height:1.9;color:#111">مرحباً ${esc(emp?.name_ar ?? "")}،<br>${esc(n.body)}</div>
      <div style="padding:10px 18px;background:#f8fafc;color:#64748b;font-size:12px">رسالة تلقائية من نظام أريبا للموارد البشرية — لا ترد عليها.</div></div>`;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject: n.title, html }),
      });
      if (!r.ok) throw new Error((await r.text()).slice(0, 300));
      await sb.from("workflow_notifications").update({ emailed_at: new Date().toISOString(), email_error: null }).eq("id", n.id);
      sent++;
    } catch (e) {
      await sb.from("workflow_notifications").update({ email_error: String(e).slice(0, 300), email_tries: (n.email_tries ?? 0) + 1 }).eq("id", n.id);
      failed++;
    }
  }
  return new Response(JSON.stringify({ ok: true, sent, failed, skipped }), { headers: { "Content-Type": "application/json" } });
});
