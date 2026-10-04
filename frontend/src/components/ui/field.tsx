import { useId } from "react";

const control =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-text placeholder:text-muted disabled:opacity-60 aria-[invalid=true]:border-danger";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
}

export function Field({ label, error, hint, required, className = "", children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
        {required && <span className="ms-1 text-danger">*</span>}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-err`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

export function Input({ label, error, hint, required, className, ...rest }: InputProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(a11y) => <input {...a11y} {...rest} required={required} className={`${control} h-10`} />}
    </Field>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string };

export function Textarea({ label, error, className, ...rest }: TextareaProps) {
  return (
    <Field label={label} error={error} className={className}>
      {(a11y) => <textarea {...a11y} {...rest} className={`${control} min-h-24 py-2`} />}
    </Field>
  );
}

export interface Option {
  value: string;
  label: string;
}

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  label: string;
  error?: string;
  hint?: string;
  options: Option[];
  placeholder?: string;
};

export function Select({ label, error, hint, options, placeholder, required, className, ...rest }: SelectProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(a11y) => (
        <select {...a11y} {...rest} required={required} className={`${control} h-10`}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string };

export function Checkbox({ label, className = "", ...rest }: CheckboxProps) {
  return (
    <label className={`flex items-center gap-2 text-sm ${className}`}>
      <input type="checkbox" className="size-4 accent-[var(--accent)]" {...rest} />
      {label}
    </label>
  );
}

/** Read-only label/value pair for detail views. */
export function ReadField({ label, value, ltr = false }: { label: string; value: React.ReactNode; ltr?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm text-text ${ltr ? "ltr-nums" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}
