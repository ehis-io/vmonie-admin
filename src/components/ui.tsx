"use client";

/**
 * The console's UI kit. Styled after zemfi-admin (dark surfaces, small caps
 * labels, pill badges) in Vmonie's blue; the API is vmonie's own, so pages
 * written against it keep working.
 */
import React from "react";
import { describeError } from "../lib/api";
import { humanize } from "../lib/format";

// ─── Buttons ──────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20 disabled:hover:bg-primary",
  secondary:
    "bg-surface border border-surface-border text-foreground hover:border-primary/60 hover:bg-surface-raised",
  danger:
    "bg-danger/15 text-danger border border-danger/30 hover:bg-danger hover:text-white",
  ghost: "text-primary-soft hover:text-foreground hover:bg-surface-raised",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  busy?: boolean;
  size?: "sm" | "md";
}

export function Button({
  variant = "primary",
  busy,
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      // After the spread: a caller cannot re-enable a button mid-request.
      disabled={busy || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
      } ${BUTTON[variant]} ${className}`}
    >
      {busy && (
        <svg
          className="h-4 w-4 animate-spin text-current"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ─── Form fields ──────────────────────────────────────────────────────────

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </span>
  );
}

export function TextInput({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && <Label>{label}</Label>}
      <input {...props} className="input-field" />
    </label>
  );
}

export function TextArea({
  label,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && <Label>{label}</Label>}
      <textarea rows={3} {...props} className="input-field resize-y" />
    </label>
  );
}

export function Select({
  label,
  options,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className={`block ${className}`}>
      {label && <Label>{label}</Label>}
      <select {...props} className="input-field">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────

export function Card({
  title,
  actions,
  children,
  className = "",
  flush = false,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** No body padding: for a table that should run edge to edge. */
  flush?: boolean;
}) {
  return (
    <section className={`card fade-in ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-3">
          {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A number tile, as on the overview. */
export function StatTile({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div
      className={`card fade-in h-full p-4 ${warn ? "border-warning/40 bg-warning/5" : ""}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${warn ? "text-warning" : "text-foreground"}`}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";
/** vmonie's original tone names, still accepted. */
type LegacyTone = "green" | "red" | "amber" | "blue" | "gray";

const LEGACY: Record<LegacyTone, BadgeTone> = {
  green: "success",
  red: "danger",
  amber: "warning",
  blue: "info",
  gray: "neutral",
};

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-raised text-muted border-surface-border",
  info: "bg-primary/15 text-primary-soft border-primary/40",
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/30",
};

/** One place that decides what colour a backend status word gets. */
const STATUS_TONE: Record<string, BadgeTone> = {
  SUCCESSFUL: "success",
  ACTIVE: "success",
  VERIFIED: "success",
  PROCESSED: "success",
  APPROVED: "success",
  RESOLVED: "success",
  CLEAR: "success",
  FALSE_POSITIVE: "success",
  LIVE: "success",
  CLOSED: "neutral",
  FAILED: "danger",
  REJECTED: "danger",
  FROZEN: "danger",
  RESTRICTED: "danger",
  MISMATCH: "danger",
  POTENTIAL_MATCH: "danger",
  CONFIRMED_MATCH: "danger",
  ERROR: "danger",
  OFF: "danger",
  NEEDS_REVIEW: "warning",
  UNKNOWN: "warning",
  ESCALATED: "warning",
  MANUAL_REVIEW: "warning",
  OPEN: "warning",
  PENDING_APPROVAL: "warning",
  COMING_SOON: "warning",
  PENDING: "info",
  CREATED: "info",
  SUBMITTED: "info",
  RECEIVED: "info",
  IN_PROGRESS: "info",
  AWAITING_CUSTOMER: "info",
  REVERSED: "neutral",
  REGISTERED: "neutral",
  IGNORED: "neutral",
};

export const toneForStatus = (status: string): BadgeTone =>
  STATUS_TONE[status.toUpperCase()] ?? "neutral";

const isStatusWord = (s: string) => /^[A-Z][A-Z0-9_]*$/.test(s);

/**
 * A pill. A backend status word ("NEEDS_REVIEW") picks its own colour and is
 * shown humanised; anything else is shown as given.
 */
export function Badge({
  children,
  tone,
  className = "",
}: {
  children: React.ReactNode;
  tone?: BadgeTone | LegacyTone;
  className?: string;
}) {
  const word = typeof children === "string" && isStatusWord(children);
  const t: BadgeTone = tone
    ? (LEGACY[tone as LegacyTone] ?? (tone as BadgeTone))
    : word
      ? toneForStatus(children as string)
      : "neutral";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONES[t]} ${className}`}
    >
      {word ? humanize(children as string) : children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge>{status}</Badge>;
}

// ─── Feedback ─────────────────────────────────────────────────────────────

const ALERT = {
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning",
  info: "border-primary/40 bg-primary/10 text-primary-soft",
};

export function Alert({
  tone = "danger",
  children,
  className = "",
}: {
  tone?: keyof typeof ALERT;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" className={`rounded-lg border px-4 py-3 text-sm ${ALERT[tone]} ${className}`}>
      {children}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Alert className="mb-4">
      {typeof error === "string" ? error : describeError(error)}
    </Alert>
  );
}

export function Notice({
  children,
  tone = "amber",
}: {
  children: React.ReactNode;
  tone?: "amber" | "blue";
}) {
  return <Alert tone={tone === "amber" ? "warning" : "info"}>{children}</Alert>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center py-16 ${className}`} role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
    </div>
  );
}

/** Kept for existing callers: the zemfi spinner, with an accessible label. */
export function Loading({ what = "Loading" }: { what?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted" role="status">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      {what}…
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted">{children}</p>;
}

// ─── Data display ─────────────────────────────────────────────────────────

/** A scrollable table with header cells. */
export function Table({
  head,
  children,
}: {
  head: React.ReactNode[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-surface-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border bg-surface/60 text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border [&>tr]:transition-colors [&>tr:hover]:bg-surface-raised/40 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top">
          {children}
        </tbody>
      </table>
    </div>
  );
}

/** Label/value pairs, zemfi's definition-list look. */
export function KeyValues({
  rows,
}: {
  rows: [string, React.ReactNode][];
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{k}</dt>
          <dd className="mt-0.5 break-words text-sm text-foreground">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>—</span>;
  return (
    <pre className="max-w-xl overflow-x-auto whitespace-pre-wrap rounded-lg border border-surface-border bg-background/60 p-2 font-mono text-xs text-muted">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs">{children}</span>;
}
