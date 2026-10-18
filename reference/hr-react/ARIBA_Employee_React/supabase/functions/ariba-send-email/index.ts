// ariba-send-email — زر "إرسال إيميل للموظف" (النماذج / المخالصة): يرسل المستند كمرفق على إيميل الموظف
// من بريد المسؤول المحفوظ في الإعدادات (أو بريد الشركة). انشرها مع verify_jwt=false (التحقق من المستخدم داخل الدالة).
import { admin, b64utf8, caller, CORS, esc, isEmail, json, pickAccount, sendMail, STAFF_ROLES, wrap } from "../_shared/mail.ts";

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
    const empId = String(b.employee_id || "").trim(), title = String(b.title || "مستند من الموارد البشرية").slice(0, 200), html = String(b.html || "");
    if (!empId || !html) return json({ ok: false, error: "BAD_INPUT", message: "بيانات ناقصة" });
    if (html.length > 8_000_000) return json({ ok: false, error: "TOO_LARGE", message: "المستند كبير جداً" });

    const { data: emp } = await sb.from("employee_directory").select("name_ar,data").eq("employee_id", empId).maybeSingle();
    const d = (emp?.data ?? {}) as Record<string, unknown>;
    const to = [d.email, d.workEmail, d.mail].map((x) => String(x ?? "").trim()).find(isEmail);
    if (!to) return json({ ok: false, error: "NO_EMAIL", message: "مفيش إيميل مسجل للموظف ده" });

    const account = await pickAccount(sb, acc.employee_id);
    const name = String(emp?.name_ar ?? d.nameAr ?? "");
    const file = title.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 100) + ".html";
    const doc = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body>${html}</body></html>`;
    const r = await sendMail(account, {
      to: [to], subject: title,
      html: wrap(title, `عزيزي/عزيزتي ${esc(name)}،<br>مرفق <b>${esc(title)}</b>.<br><br>مع التحية،<br>الموارد البشرية`),
      attachments: [{ filename: file, content: b64utf8(doc), contentType: "text/html; charset=utf-8" }],
    });
    if (!r.ok) return json(r);
    await sb.from("ariba_audit_log").insert({ actor_employee_id: acc.employee_id, actor_role: acc.role, module: "forms", action: "email_document", summary: `إرسال ${title} بالإيميل إلى ${to}`, details: { type: b.type, employee_id: empId, via: r.via } }).then(() => {}, () => {});
    return json({ ok: true, to, via: r.via, from: r.from });
  } catch (e) {
    return json({ ok: false, error: "SERVER_ERROR", message: String((e as Error)?.message ?? e).slice(0, 300) });
  }
});
