type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-border",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  accent: "bg-accent-soft text-accent border-transparent",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

/** Tone for "days until expiry": expired / <=30 urgent / <=90 warning. */
export function expiryTone(days: number | null): Tone {
  if (days === null) return "neutral";
  if (days < 0 || days <= 30) return "danger";
  if (days <= 90) return "warning";
  return "neutral";
}
