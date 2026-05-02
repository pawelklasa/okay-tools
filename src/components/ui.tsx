import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="px-8 lg:px-16 pt-12 pb-10">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)] mb-3">
              {eyebrow}
            </p>
          )}
          <h1 className="text-[32px] md:text-[40px] font-semibold tracking-[-0.02em] text-[var(--color-fg)] leading-[1.1]">
            {title}
          </h1>
          {description && (
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-fg-muted)]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-2">
        <span className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-dim)]">
          {label}
        </span>
        {hint && <span className="mono text-[11px] text-[var(--color-fg-muted)]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <Field label={label} hint={display}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </Field>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  className = "",
  type = "button",
  href,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  type?: "button" | "submit";
  href?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles =
    variant === "primary"
      ? "bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90"
      : variant === "ghost"
      ? "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
      : "bg-[var(--color-surface)] text-[var(--color-fg)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)]";

  const cls = `inline-flex items-center justify-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition ${styles} ${className}`;

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} className={cls} {...rest}>
      {children}
    </button>
  );
}

export function Pill({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "ok" | "warn" | "err";
}) {
  const colors = {
    default: "text-[var(--color-fg-muted)] bg-[var(--color-surface-2)]",
    ok: "text-[var(--color-ok)] bg-[oklch(0.30_0.05_155)]/40",
    warn: "text-[var(--color-warn)] bg-[oklch(0.30_0.05_80)]/40",
    err: "text-[var(--color-err)] bg-[oklch(0.30_0.08_25)]/40",
  };
  return (
    <span
      className={`mono inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${colors[tone]}`}
    >
      {children}
    </span>
  );
}

export function HexInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2 items-stretch">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 shrink-0"
        aria-label="Pick colour"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="flex-1 min-w-0"
      />
    </div>
  );
}
