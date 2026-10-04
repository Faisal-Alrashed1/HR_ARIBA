"use client";

import { Icons } from "@/components/ui/icons";
import { useLocale } from "@/lib/i18n/locale";
import { useTheme } from "@/lib/theme";

export function PrefsToggles() {
  const { lang, setLang, t } = useLocale();
  const { theme, toggle } = useTheme();
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        className="rounded-lg px-2 py-1 text-sm font-medium hover:bg-surface-2"
        aria-label={t("settings.language")}
      >
        {lang === "ar" ? "EN" : "ع"}
      </button>
      <button
        type="button"
        onClick={toggle}
        className="rounded-lg p-1.5 hover:bg-surface-2"
        aria-label={theme === "dark" ? t("settings.light") : t("settings.dark")}
        title={theme === "dark" ? t("settings.light") : t("settings.dark")}
      >
        {theme === "dark" ? <Icons.sun /> : <Icons.moon />}
      </button>
    </div>
  );
}
