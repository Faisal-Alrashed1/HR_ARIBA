"use client";

import { Card } from "@/components/ui/card";
import { ReadField } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { myEmployee } from "@/lib/employees";
import { formatDate, formatMoney } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale";
import { useApi } from "@/lib/use-api";

export default function MeProfilePage() {
  const { t, tEnum, lang } = useLocale();
  const { data: e, error, loading, reload } = useApi(myEmployee, "me");

  if (loading) return <LoadingState />;
  if (error?.status === 404) return <EmptyState message={t("me.noEmployee")} />;
  if (error || !e) return <ErrorState message={error?.message} onRetry={reload} />;

  const lookup = (l: { name_ar: string; name_en: string } | null) => (l ? (lang === "en" ? l.name_en : l.name_ar) : "—");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">{t("me.profile")}</h1>
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <ReadField label={t("emp.f.empNo")} value={e.emp_no} ltr />
          <ReadField label={t("emp.f.nationality")} value={lookup(e.nationality)} />
          <ReadField label={t("emp.f.mobile")} value={e.mobile} ltr />
          <ReadField label={t("emp.f.email")} value={e.email} ltr />
          <ReadField label={t("emp.f.nationalId")} value={e.national_id} ltr />
          <ReadField label={t("emp.f.birthDate")} value={formatDate(e.birth_date)} ltr />
        </div>
      </Card>
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <ReadField label={t("emp.f.workplace")} value={lookup(e.workplace)} />
          <ReadField label={t("emp.f.department")} value={lookup(e.department)} />
          <ReadField label={t("emp.f.jobTitle")} value={e.job_title} />
          <ReadField label={t("emp.f.manager")} value={e.manager ? (lang === "en" && e.manager.name_en) || e.manager.name_ar : null} />
          <ReadField label={t("emp.f.joinDate")} value={formatDate(e.join_date)} ltr />
          <ReadField label={t("emp.f.contractEnd")} value={formatDate(e.contract_end_date)} ltr />
          <ReadField label={t("emp.f.contractNature")} value={tEnum("contract_nature", e.contract_nature)} />
        </div>
      </Card>
      {e.salary && (
        <Card>
          <div className="grid grid-cols-2 gap-4">
            <ReadField label={t("emp.f.basicSalary")} value={formatMoney(e.salary.basic_salary, lang, e.salary.currency)} ltr />
            <ReadField label={t("emp.f.housing")} value={formatMoney(e.salary.housing_allowance, lang, e.salary.currency)} ltr />
            <ReadField label={t("emp.f.transport")} value={formatMoney(e.salary.transport_allowance, lang, e.salary.currency)} ltr />
            <ReadField label={t("emp.f.totalSalary")} value={formatMoney(e.salary.total_salary, lang, e.salary.currency)} ltr />
            <ReadField label={t("emp.f.iban")} value={e.salary.iban} ltr />
          </div>
        </Card>
      )}
    </div>
  );
}
