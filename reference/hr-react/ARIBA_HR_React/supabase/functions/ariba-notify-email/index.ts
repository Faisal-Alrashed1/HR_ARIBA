// ariba-notify-email — تستدعيها قاعدة البيانات (trigger ariba_notif_email في sql/15) مع كل إشعار جديد،
// وترسل إيميل لصاحب الإشعار من "بريد الشركة" المحفوظ في الإعدادات. انشرها مع verify_jwt=false.
import { admin, CORS, esc, isEmail, json, pickAccount, sendMail, wrap } from "../_shared/mail.ts";

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
