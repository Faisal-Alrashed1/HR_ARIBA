"use client";

import { NotBuilt } from "@/components/ui/states";
import { useLocale } from "@/lib/i18n/locale";

export default function Page() {
  const { t } = useLocale();
  return <NotBuilt title={t("me.overtime")} />;
}
