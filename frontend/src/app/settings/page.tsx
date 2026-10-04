"use client";

import Link from "next/link";
import { NotBuilt } from "@/components/ui/states";
import { useLocale } from "@/lib/i18n/locale";

// Company / attendance / GOSI / role settings arrive in a later phase.
export default function SettingsPage() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-4">
      <NotBuilt title={t("settings.system")} />
      <Link href="/me/settings" className="text-sm text-accent underline">
        {t("me.settings")} — {t("settings.language")} · {t("settings.theme")} · {t("auth.changePassword")}
      </Link>
    </div>
  );
}
