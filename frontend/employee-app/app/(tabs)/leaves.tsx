// طلباتي — their Leaves.jsx «📋 طلباتي» and the delegation card. Sending a request is the «+» in the dock (components/composer.tsx),
// which holds every type, rule and attachment that used to be the inline form here.
import { Alert, View } from "react-native";
import { Btn, Card, CardTitle, Empty, Page, T, useToast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useComposer } from "@/components/composer";
import { ApiError, requests, type MyRequest } from "@/lib/api";
import { DelegationCard } from "@/components/delegation";
import { RequestItem } from "@/components/request-item";
import { useData } from "@/lib/data";
import { useTheme } from "@/theme";

export default function Leaves() {
  const t = useTheme();
  const toast = useToast();
  const { open } = useComposer();
  const { requests: list, refresh } = useData();
  const mine = list.filter((r) => r.type !== "overtime");
  const pending = mine.filter((r) => r.status === "pending").length;

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
      <Btn kind="primary" title="طلب جديد" icon={<Icon name="send" size={16} color="#012A21" />} onPress={() => open()} style={{ marginTop: 0, marginBottom: 14 }} />
      <Card>
        <CardTitle icon="clipboard">طلباتي</CardTitle>
        {pending ? <View style={{ marginBottom: 6 }}><T size={12} color={t.mu}>{`${pending} طلب بانتظار الاعتماد`}</T></View> : null}
        {!mine.length ? <Empty text="لا توجد طلبات" /> : null}
        {mine.map((r) => <RequestItem key={r.id} r={r} onDelete={remove} />)}
      </Card>
      <DelegationCard />
    </Page>
  );
}
