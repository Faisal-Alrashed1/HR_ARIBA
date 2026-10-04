"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/me/change-password-form";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/i18n/locale";
import { homeFor } from "@/lib/routes";
import { useTheme } from "@/lib/theme";

function SettingsBody() {
  const { t, lang, setLang } = useLocale();
  const { theme, setTheme } = useTheme();
  const { user, reload } = useAuth();
  const router = useRouter();
  const forced = useSearchParams().get("force") === "1" || !!user?.must_change_password;

  const choice = (active: boolean) =>
    `flex-1 rounded-lg border px-3 py-2 text-sm ${active ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border"}`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">{t("me.settings")}</h1>
      {forced && <Notice tone="warning">{t("auth.mustChange")}</Notice>}

      {!forced && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">{t("settings.language")}</h2>
          <div className="flex gap-2">
            <button type="button" className={choice(lang === "ar")} onClick={() => setLang("ar")}>
              العربية
            </button>
            <button type="button" className={choice(lang === "en")} onClick={() => setLang("en")}>
              English
            </button>
          </div>
          <h2 className="mb-2 mt-4 text-sm font-semibold">{t("settings.theme")}</h2>
          <div className="flex gap-2">
            <button type="button" className={choice(theme === "light")} onClick={() => setTheme("light")}>
              {t("settings.light")}
            </button>
            <button type="button" className={choice(theme === "dark")} onClick={() => setTheme("dark")}>
              {t("settings.dark")}
            </button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold">{t("auth.changePassword")}</h2>
        <ChangePasswordForm
          onDone={async () => {
            await reload();
            if (forced && user) router.replace(homeFor(user.role));
          }}
        />
      </Card>
    </div>
  );
}

export default function MeSettingsPage() {
  return (
    <Suspense>
      <SettingsBody />
    </Suspense>
  );
}
