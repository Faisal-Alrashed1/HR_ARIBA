// ملفي — their Prof.jsx: profile hero, personal data (+ «طلب تعديل»), job and contract, leave balances, salary,
// bank (+ «طلب تغيير الآيبان»), «وثائقي» (+ «رفع مستند للمراجعة»), security, employer and work locations.
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { openDocument } from "@/lib/open-doc";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { PasswordSheet } from "@/components/password-sheet";
import { dmy, LocationsCard, sar } from "@/components/shared";
import { Btn, Card, CardTitle, InfoBox, Page, PayRow, T, useToast } from "@/components/ui";
import { useData } from "@/lib/data";
import { useTheme } from "@/theme";

export default function Profile() {
  const t = useTheme();
  const toast = useToast();
  const { employee: e, refresh } = useData();
  const [pw, setPw] = useState(false);
  const { leave, requests } = useData();
  const [docs, setDocs] = useState<{ id: string; type: string; file_name: string }[]>([]);
  const [opening, setOpening] = useState("");
  useEffect(() => {
    if (e?.id) api<{ id: string; type: string; file_name: string }[]>(`/employees/${encodeURIComponent(e.id)}/documents`).then(setDocs).catch(() => setDocs([]));
  }, [e?.id]);
  const ibanPending = requests.some((r) => r.type === "iban_change" && r.status === "pending");
  const s = e?.salary;
  return (
    <Page onRefresh={refresh}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, marginBottom: 12, overflow: "hidden", borderWidth: 1, borderColor: "#29B35E",
        shadowColor: t.dark ? "#000" : "#014D3D", shadowOpacity: t.dark ? 0.2 : 0.16, shadowRadius: 15, shadowOffset: { width: 0, height: 12 }, elevation: 3 }}>
        <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%">
          <Defs>
            <LinearGradient id="ph" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={t.dark ? "#013D31" : "#014D3D"} />
              <Stop offset="1" stopColor="#075444" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#ph)" />
        </Svg>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.gr, alignItems: "center", justifyContent: "center" }}>
          <T size={30} weight={800} color="#fff">{e?.name_ar?.charAt(0) ?? ""}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T size={17} weight={800} color="#fff">{e?.name_ar ?? ""}</T>
          {e?.name_en ? <T size={11} color="#D0D9D5">{e.name_en}</T> : null}
          {e?.job_title ? <T size={12} weight={700} color="#fff" style={{ marginTop: 6 }}>{e.job_title}</T> : null}
        </View>
      </View>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <CardTitle>البيانات الشخصية</CardTitle>
          <Btn kind="ghost" title="✏️ طلب تعديل" onPress={() => router.push("/profile-edit")} style={{ marginTop: 0, paddingVertical: 6 }} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <InfoBox label="الرقم الوظيفي" value={e?.emp_no} />
          <InfoBox label="الجنسية" value={e?.nationality?.name_ar} />
          <InfoBox label="الجوال" value={e?.mobile} />
          <InfoBox label="البريد الإلكتروني" value={e?.email} />
          <InfoBox label="رقم الإقامة / الهوية" value={e?.national_id} />
          <InfoBox label="تاريخ الميلاد" value={dmy(e?.birth_date)} />
        </View>
      </Card>
      <Card>
        <CardTitle>الوظيفة والعقد</CardTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <InfoBox label="جهة العمل" value={e?.workplace?.name_ar} />
          <InfoBox label="القسم" value={e?.department?.name_ar} />
          <InfoBox label="الوظيفة" value={e?.job_title} />
          <InfoBox label="المدير المباشر" value={e?.manager?.name_ar} />
          <InfoBox label="تاريخ المباشرة" value={dmy(e?.join_date)} />
          <InfoBox label="انتهاء العقد" value={dmy(e?.contract_end_date)} />
        </View>
      </Card>
      {leave ? (
        <Card>
          <CardTitle>🏖 أرصدة الإجازات</CardTitle>
          <PayRow label="الرصيد حتى اليوم" value={`${leave.current.toFixed(2)} يوم`} />
          <PayRow label="رصيد نهاية العام" value={`${leave.year_end.toFixed(2)} يوم`} />
          <PayRow label="المرحل" value={`${leave.carry.toFixed(2)} يوم`} />
        </Card>
      ) : null}
      {s ? (
        <Card>
          <CardTitle icon="wallet">الراتب</CardTitle>
          <PayRow label="الراتب الأساسي" value={sar(s.basic_salary)} />
          <PayRow label="بدل السكن" value={sar(s.housing_allowance)} />
          <PayRow label="بدل النقل" value={sar(s.transport_allowance)} />
          <PayRow label="إجمالي الراتب" value={sar(s.total_salary)} kind="total" />
          <PayRow label="صافي الراتب" value={sar(s.net_salary_sar)} kind="net" />
        </Card>
      ) : null}
      <Card>
        <CardTitle icon="bank">بيانات البنك</CardTitle>
        <View style={{ flexDirection: "row" }}><InfoBox label="الإيبان" value={s?.iban} /></View>
        <Btn kind="ghost" title={ibanPending ? "⏳ طلب تغيير الآيبان قيد المراجعة" : "✏️ طلب تغيير الآيبان"} onPress={() => router.push("/iban-change")} style={{ marginTop: 8 }} />
      </Card>
      <Card>
        <CardTitle>📎 وثائقي</CardTitle>
        <Btn kind="ghost" title="📤 رفع مستند للمراجعة" onPress={() => router.push("/upload-document")} style={{ marginTop: 0, marginBottom: 8 }} />
        {!docs.length ? <T size={11} color={t.mu} center>لا توجد وثائق مرفوعة</T> : null}
        {docs.map((d) => (
          <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: t.bd }}>
            <View style={{ flex: 1 }}>
              <T size={12} weight={700}>{DOCL[d.type] ?? d.type}</T>
              <T size={10} color={t.mu}>{d.file_name}</T>
            </View>
            <Pressable disabled={opening === d.id} onPress={async () => { setOpening(d.id); try { await openDocument(d.id, d.file_name); } catch { toast("تعذر تحميل الوثيقة", "err"); } setOpening(""); }}
              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: t.bd, backgroundColor: t.c2 }}>
              <T size={11} weight={700}>⬇ فتح</T>
            </Pressable>
          </View>
        ))}
      </Card>
      <Card>
        <CardTitle icon="lock">الأمان</CardTitle>
        <Btn kind="teal" title="تغيير كلمة المرور" icon="key" onPress={() => setPw(true)} style={{ borderRadius: 10, marginTop: 0 }} />
      </Card>
      <LocationsCard />
      <PasswordSheet visible={pw} onClose={() => setPw(false)} onDone={() => toast("تم تغيير كلمة المرور", "ok")} />
    </Page>
  );
}

const DOCL: Record<string, string> = { identity: "الهوية / الإقامة", id: "الهوية / الإقامة", passport: "جواز السفر", degree: "شهادة التخرج", graduation: "شهادة التخرج",
  experience: "شهادة خبرة", cv: "السيرة الذاتية", national_address: "العنوان الوطني", contract: "العقد", social_insurance: "شهادة التأمينات",
  profile_edit: "مرفق تعديل بيانات", iban_certificate: "شهادة الآيبان", letter: "نموذج", signed_document: "مستند موقّع", photo: "صورة شخصية", other: "مستند آخر" };
