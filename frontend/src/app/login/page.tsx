"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PrefsToggles } from "@/components/nav/prefs-toggles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { ApiError } from "@/lib/api";
import { login } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/i18n/locale";
import { homeFor } from "@/lib/routes";
import { loginSchema } from "@/lib/validation";

function LoginForm() {
  const { t } = useLocale();
  const { reload } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ username, password });
    if (!parsed.success) return;
    setBusy(true);
    setError(null);
    try {
      const user = await login(parsed.data.username, parsed.data.password);
      await reload();
      const next = params.get("next");
      if (user.must_change_password) router.replace("/me/settings?force=1");
      else router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : homeFor(user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Notice tone="danger">{error}</Notice>}
      <Input
        label={t("auth.username")}
        hint={t("auth.usernameHint")}
        autoComplete="username"
        autoCapitalize="none"
        dir="ltr"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <Input
        label={t("auth.password")}
        type="password"
        autoComplete="current-password"
        dir="ltr"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" loading={busy} disabled={!username || !password}>
        {t("auth.signIn")}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  const { t } = useLocale();
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-4">
      <div className="absolute end-4 top-4">
        <PrefsToggles />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-brand-dark text-lg font-bold text-white">A</span>
          <h1 className="text-lg font-bold">{t("app.name")}</h1>
          <p className="text-sm text-muted">{t("app.company")}</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
