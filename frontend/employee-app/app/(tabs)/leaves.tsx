// الإجازات — their Leaves.jsx: «📋 طلباتي», the delegation card, then «إرسال طلب جديد» with the 4-column type grid
// (+ unpaid leave and salary advance, each with a reason; an optional attachment; the approval path; upcoming holidays).
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { ForgotPunchSheet, todayISO } from "@/components/shared";
import { Btn, Card, CardTitle, Empty, Input, Page, PickerField, T, useToast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ApiError, requests, type MyRequest, type RequestType } from "@/lib/api";
import { DelegationCard } from "@/components/delegation";
import { pickFile, type Picked } from "@/lib/files";
import { calendarDays, submitRequest } from "@/lib/port";
import { HOURLY, RequestItem, TYPES } from "@/components/request-item";
import { useData } from "@/lib/data";
import { useTheme } from "@/theme";

export default function Leaves() {
  const t = useTheme();
  const toast = useToast();
  const { requests: list, leave, refresh } = useData();
  const [type, setType] = useState<RequestType>("annual");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [dur, setDur] = useState("1");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [file, setFile] = useState<Picked | null>(null);
  const mine = list.filter((r) => r.type !== "overtime");
  const today = todayISO();
  const upcoming = (leave?.upcoming_holidays ?? []).filter((h) => h.date >= today).slice(0, 4);
  const twoStage = type === "unpaid" || type === "salary_advance";

  async function attach() {
    try { setFile(await pickFile()); } catch (e) { toast(e instanceof Error ? e.message : "تعذر قراءة المرفق", "err"); }
  }

  function pick(k: RequestType) {
    if (k === "forgot_punch") return setForgot(true);
    setType(k);
  }

  async function submit() {
    const n = notes.trim() || undefined;
    let body: Parameters<typeof requests.submit>[0] | null = null;
    let port: Record<string, unknown> | null = null;
    if (type === "advance" || type === "salary_advance") {
      if (!(Number(amount) > 0)) return toast("أدخل مبلغ السلفة", "err");
      if (type === "salary_advance" && !n) return toast("اكتب سبب طلب الراتب المقدم", "err");
      if (type === "salary_advance") port = { amount: Number(amount), notes: n };
      else body = { type, amount: String(Number(amount)), notes: n };
    } else if (HOURLY.includes(type)) {
      if (!date || !time) return toast("حدد التاريخ والوقت", "err");
      body = { type, on_date: date, time_from: time, hours: String(Number(dur) || 1), notes: n };
    } else {
      if (!from || !to || to < from) return toast("حدد الفترة بشكل صحيح", "err");
      if (type === "unpaid" && !n) return toast("اكتب سبب الإجازة بدون راتب", "err");
      if (type === "annual" && leave && leave.current <= 0) return toast("يتجاوز الرصيد المتاح", "err");
      if (type === "unpaid") port = { from, to, days: calendarDays(from, to), notes: n };
      else body = { type, from_date: from, to_date: to, notes: n };
    }
    setBusy(true);
    try {
      // their submit sends the payload and the attachment together (ariba_submit_request)
      if (port || file) await submitRequest(type, port ?? toPayload(body!), file);
      else await requests.submit(body!);
      toast(twoStage ? "✅ تم إرسال الطلب — بانتظار المدير المباشر" : "تم إرسال الطلب", "ok");
      setFrom(""); setTo(""); setTime(""); setAmount(""); setNotes(""); setFile(null);
      await refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "تعذر إرسال الطلب", "err");
    } finally {
      setBusy(false);
    }
  }

  function remove(r: MyRequest) {
    Alert.alert("حذف الطلب", "هل تريد حذف هذا الطلب؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try { await requests.remove(r.id); toast("تم الحذف", "ok"); await refresh(); } catch (e) { toast(e instanceof ApiError ? e.message : "تعذر الحذف", "err"); }
      } },
    ]);
  }

  return (
    <Page onRefresh={refresh}>
      <Card>
        <CardTitle icon="clipboard">طلباتي</CardTitle>
        {!mine.length ? <Empty text="لا توجد طلبات" /> : null}
        {mine.map((r) => <RequestItem key={r.id} r={r} onDelete={remove} />)}
      </Card>

      <DelegationCard />
      <Card>
        <CardTitle>إرسال طلب جديد</CardTitle>
        <T size={12} color={t.mu} style={{ marginBottom: 8 }}>
          {twoStage ? "مسار الاعتماد: المدير المباشر → الموارد البشرية (اعتماد نهائي). يصلك إشعار وإيميل عند كل خطوة."
            : "مسار الاعتماد: المدير المباشر → الموارد البشرية → الرئيس التنفيذي."}
        </T>
        {upcoming.length ? (
          <View style={{ marginBottom: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "rgba(59,130,246,.2)", backgroundColor: "rgba(59,130,246,.08)" }}>
            <T size={12} weight={700} color={t.bl} style={{ marginBottom: 6 }}>🗓️ إجازات رسمية قادمة</T>
            {upcoming.map((h, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
                <T size={12}>{h.name}</T><T size={12} color={t.mu}>{`${h.date}${h.days ? ` (${h.days} يوم)` : ""}`}</T>
              </View>
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {TYPES.map(([k, label]) => {
            const on = k === type;
            return (
              <Pressable key={k} onPress={() => pick(k)}
                style={{ width: "23.3%", borderWidth: 2, borderColor: on ? t.bl : t.bd, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 4, backgroundColor: t.c2 }}>
                <T size={12} center weight={on ? 700 : 500}>{label}</T>
              </Pressable>
            );
          })}
        </View>

        {type === "advance" || type === "salary_advance" ? (
          <Input label="مبلغ السلفة" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
        ) : HOURLY.includes(type) ? (
          <View style={{ flexDirection: "row", gap: 6 }}>
            <PickerField label="التاريخ" value={date} onChange={setDate} mode="date" />
            <PickerField label="الوقت" value={time} onChange={setTime} mode="time" />
            <Input label="المدة (س)" value={dur} onChangeText={setDur} keyboardType="decimal-pad" />
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 6 }}>
            <PickerField label="من تاريخ" value={from} onChange={setFrom} mode="date" />
            <PickerField label="إلى تاريخ" value={to} onChange={setTo} mode="date" />
          </View>
        )}
        <Input label={twoStage ? "السبب" : "ملاحظات"} value={notes} onChangeText={setNotes} placeholder={twoStage ? "مطلوب" : "اختياري"} multiline />
        <Btn kind="ghost" title={file ? `📎 ${file.name}` : "📎 مرفق الطلب (اختياري)"} onPress={file ? () => setFile(null) : attach} style={{ marginTop: 8 }} />
        <T size={12} color={t.mu} style={{ marginTop: 4 }}>يمكن إرسال الطلب بدون مرفق. الحد الأقصى 12 MB.{file ? " — اضغط لإزالته" : ""}</T>
        <Btn kind="primary" title="إرسال الطلب" icon={<Icon name="send" size={16} color={t.dark ? "#013D31" : "#fff"} />} onPress={submit} busy={busy} />
      </Card>
      <ForgotPunchSheet visible={forgot} onClose={() => setForgot(false)} />
    </Page>
  );
}

/** Our NewRequest fields → their payload names (when the request goes with an attachment). */
function toPayload(b: Parameters<typeof requests.submit>[0]): Record<string, unknown> {
  return { from: b.from_date, to: b.to_date, date: b.on_date, time: b.time_from, dur: b.hours ? Number(b.hours) : undefined,
    amount: b.amount ? Number(b.amount) : undefined, notes: b.notes };
}
