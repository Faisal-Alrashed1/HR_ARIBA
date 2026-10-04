"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ReadField } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingState, Notice } from "@/components/ui/states";
import { myEmployee } from "@/lib/employees";
import { formatDate, formatHijri, todayIso } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale";
import { useApi } from "@/lib/use-api";

export default function MeHomePage() {
  const { t, lang } = useLocale();
  const { data, error, loading, reload } = useApi(myEmployee, "me");

  if (loading) return <LoadingState />;
  if (error?.status === 404) return <EmptyState message={t("me.noEmployee")} />;
  if (error || !data) return <ErrorState message={error?.message} onRetry={reload} />;

  const name = (lang === "en" && data.name_en) || data.name_ar;
  const lookup = (l: { name_ar: string; name_en: string } | null) => (l ? (lang === "en" ? l.name_en : l.name_ar) : "—");
  const today = todayIso();

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl bg-gradient-to-br from-brand-dark to-[#0b6b54] p-5 text-white shadow-sm">
        <p className="text-sm opacity-80">
          {formatDate(today)} · {formatHijri(today, lang)}
        </p>
        <h1 className="mt-1 text-xl font-bold">{t("me.welcome", { name })}</h1>
        <p className="text-sm opacity-90">{data.job_title ?? "—"}</p>
      </section>

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <ReadField label={t("emp.f.workplace")} value={lookup(data.workplace)} />
          <ReadField label={t("emp.f.department")} value={lookup(data.department)} />
          <ReadField label={t("emp.f.nationality")} value={lookup(data.nationality)} />
          <ReadField label={t("emp.f.empNo")} value={data.emp_no} ltr />
        </div>
      </Card>

      <Notice>{t("common.notBuiltHint")}</Notice>
      <Link href="/me/profile" className="text-center text-sm text-accent underline">
        {t("me.profile")}
      </Link>
    </div>
  );
}
