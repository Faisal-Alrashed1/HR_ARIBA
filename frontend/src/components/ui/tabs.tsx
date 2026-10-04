"use client";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="no-print flex gap-1 overflow-x-auto border-b border-border">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${
              active ? "border-accent font-semibold text-accent" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {item.label}
            {item.count !== undefined && <span className="ms-1.5 rounded-full bg-surface-2 px-1.5 text-xs ltr-nums">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
