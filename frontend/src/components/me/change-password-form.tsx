"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { ApiError } from "@/lib/api";
import { changePassword } from "@/lib/auth";
import type { MessageKey } from "@/lib/i18n/ar";
import { useLocale } from "@/lib/i18n/locale";
import { changePasswordSchema, issuesToErrors } from "@/lib/validation";

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { t } = useLocale();
  const [values, setValues] = useState({ old_password: "", new_password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const msg = (m: string) => (m.includes(".") && !m.includes(" ") ? t(m as MessageKey) : m);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await changePassword(values.old_password, values.new_password);
      setValues({ old_password: "", new_password: "", confirm: "" });
      setMessage({ tone: "success", text: t("auth.passwordChanged") });
      onDone?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors());
        setMessage({ tone: "danger", text: err.message });
      } else setMessage({ tone: "danger", text: t("common.error") });
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof values, label: MessageKey, autoComplete: string) => (
    <Input
      label={t(label)}
      type="password"
      dir="ltr"
      autoComplete={autoComplete}
      value={values[key]}
      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      error={errors[key] ? msg(errors[key]) : undefined}
    />
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {field("old_password", "auth.oldPassword", "current-password")}
      {field("new_password", "auth.newPassword", "new-password")}
      {field("confirm", "auth.confirmPassword", "new-password")}
      <p className="text-xs text-muted">{t("auth.passwordRules")}</p>
      <Button type="submit" loading={busy}>
        {t("auth.changePassword")}
      </Button>
    </form>
  );
}
