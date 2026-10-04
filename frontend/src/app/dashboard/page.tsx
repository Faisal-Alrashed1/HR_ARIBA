"use client";

import { PageHeader, StatCard } from "@/components/ui/card";
import { ErrorState, LoadingState, Notice } from "@/components/ui/states";
import { employeeCounts } from "@/lib/employees";
import { formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale";
import { useApi } from "@/lib/use-api";

export default function DashboardPage() {
  const { t, lang } = useLocale();
  const { data, error, loading, reload } = useApi(employeeCounts, "counts");

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error?.message} onRetry={reload} />;

  const current = data.saudi + data.expat;
  return (
    <div>
      <PageHeader title={t("nav.dashboard")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("dash.activeEmployees")}
          value={formatNumber(current, lang)}
          hint={`${t("dash.saudi")} ${formatNumber(data.saudi, lang)} · ${t("dash.expat")} ${formatNumber(data.expat, lang)}`}
        />
        <StatCard label={t("dash.saudization")} value={`${formatNumber(data.saudization_pct, lang, 1)}%`} />
        <StatCard label={t("dash.tamheer")} value={formatNumber(data.tamheer, lang)} />
        <StatCard label={t("dash.terminated")} value={formatNumber(data.terminated, lang)} />
        <StatCard label={t("dash.training")} value={formatNumber(data.training, lang)} />
        <StatCard label={t("dash.consultants")} value={formatNumber(data.consultants, lang)} />
      </div>
      <div className="mt-6">
        <Notice>{t("dash.morePending")}</Notice>
      </div>
    </div>
  );
}
