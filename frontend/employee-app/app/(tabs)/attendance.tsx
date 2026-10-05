import { NotBuilt } from "@/components/not-built";

export default function Attendance() {
  return (
    <NotBuilt
      title="الحضور"
      items={["تسجيل دخول / خروج بالموقع (GPS) داخل نطاق موقع العمل", "الساعات المرنة والانصراف المتوقع", "طلب نسيان بصمة", "سجل الحضور"]}
    />
  );
}
