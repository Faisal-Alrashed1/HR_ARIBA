"use client";

import { useLocale } from "@/lib/i18n/locale";
import { Button } from "./button";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useLocale();
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-muted">
      <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      <span>{label ?? t("common.loading")}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useLocale();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-danger-soft px-4 py-10 text-center text-danger">
      <p className="font-medium">{message ?? t("common.error")}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ message, action }: { message?: string; action?: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-12 text-center text-muted">
      <p>{message ?? t("common.empty")}</p>
      {action}
    </div>
  );
}

export function NotBuilt({ title }: { title: string }) {
  const { t } = useLocale();
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{title}</h1>
      <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-16 text-center">
        <p className="font-medium">{t("common.notBuilt")}</p>
        <p className="mt-1 text-sm text-muted">{t("common.notBuiltHint")}</p>
      </div>
    </div>
  );
}

export function Notice({ tone = "accent", children }: { tone?: "accent" | "warning" | "danger" | "success"; children: React.ReactNode }) {
  const tones = {
    accent: "bg-accent-soft text-accent",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
  };
  return <div className={`rounded-lg px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>;
}
