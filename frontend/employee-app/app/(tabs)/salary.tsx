import { Card, ErrorText, Loading, Row, Screen, Txt } from "@/components/ui";
import { money, useMyEmployee } from "@/lib/use-employee";

// Same rows as the prototype's salary tab: basic, housing, transport, project, other, gross, insurance, net.
export default function Salary() {
  const { data, error, loading } = useMyEmployee();
  if (loading) return <Loading />;
  const s = data?.salary;
  return (
    <Screen>
      <ErrorText message={error} />
      {s ? (
        <Card title="تفاصيل الراتب">
          <Row label="الراتب الأساسي" value={money(s.basic_salary)} />
          <Row label="بدل السكن" value={money(s.housing_allowance)} />
          <Row label="بدل المواصلات" value={money(s.transport_allowance)} />
          <Row label="بدل المشروع" value={money(s.project_allowance)} />
          <Row label="بدلات أخرى" value={money(s.other_allowances)} />
          <Row label="الإجمالي" value={money(s.total_salary)} />
          <Row label="خصم التأمينات" value={money(s.gosi_employee)} />
          <Row label="استقطاعات أخرى" value={money(s.other_deductions)} />
          <Row label="الصافي" value={`${money(s.net_salary)} ${s.currency}`} />
        </Card>
      ) : (
        <Card>
          <Txt muted>لا توجد بيانات راتب.</Txt>
        </Card>
      )}
      <Card title="كشوف الرواتب الشهرية">
        <Txt muted>تظهر هنا بعد بناء وحدة المسير في الخادم.</Txt>
      </Card>
    </Screen>
  );
}
