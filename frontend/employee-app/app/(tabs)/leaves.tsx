import { NotBuilt } from "@/components/not-built";

export default function Leaves() {
  return (
    <NotBuilt
      title="الإجازات"
      items={["رصيد الإجازة السنوية", "طلب إجازة / استئذان / سلفة / عمل إضافي", "حالة الطلبات: المدير ← الموارد البشرية ← الرئيس التنفيذي"]}
    />
  );
}
