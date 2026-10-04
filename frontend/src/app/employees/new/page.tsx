"use client";

import { useRouter } from "next/navigation";
import { EmployeeForm } from "@/components/employees/employee-form";
import { PageHeader } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { createEmployee, getLookups, listEmployees } from "@/lib/employees";
import { useLocale } from "@/lib/i18n/locale";
import { useApi } from "@/lib/use-api";

export default function NewEmployeePage() {
  const { t } = useLocale();
  const router = useRouter();
  const lookups = useApi(getLookups, "lookups");
  const managers = useApi(() => listEmployees({ tab: "all", page_size: 100, sort: "name_ar" }), "managers");

  if (lookups.loading || managers.loading) return <LoadingState />;
  if (lookups.error || !lookups.data) return <ErrorState message={lookups.error?.message} onRetry={lookups.reload} />;

  return (
    <div>
      <PageHeader title={t("emp.new")} />
      <EmployeeForm
        lookups={lookups.data}
        managers={managers.data?.items ?? []}
        canEdit
        onSubmit={async (input) => {
          const emp = await createEmployee(input);
          router.replace(`/employees/${emp.id}`);
        }}
      />
    </div>
  );
}
