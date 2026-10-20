"use client";

import React from "react";
import { describeError } from "../lib/api";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover border border-primary",
  secondary:
    "bg-surface text-foreground border border-border hover:bg-muted",
  danger: "bg-danger text-white border border-danger hover:opacity-90",
  ghost: "text-primary hover:underline border border-transparent",
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
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm"
      } ${BUTTON[variant]} ${className}`}
    >
      {busy && (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

const FIELD =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function TextInput({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && <Label>{label}</Label>}
      <input {...props} className={FIELD} />
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
      <textarea rows={3} {...props} className={FIELD} />
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
      <select {...props} className={FIELD}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Card({
  title,
  actions,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-border bg-surface ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONE: Record<string, string> = {
  green: "bg-green-100 text-green-800 border-green-200",
  red: "bg-red-100 text-red-800 border-red-200",
  amber: "bg-amber-100 text-amber-900 border-amber-200",
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  gray: "bg-gray-100 text-gray-700 border-gray-200",
};

const STATUS_TONE: Record<string, keyof typeof TONE> = {
  SUCCESSFUL: "green",
  ACTIVE: "green",
  VERIFIED: "green",
  PROCESSED: "green",
  APPROVED: "green",
  RESOLVED: "green",
  CLEAR: "green",
  FALSE_POSITIVE: "green",
  CLOSED: "gray",
  FAILED: "red",
  REJECTED: "red",
  FROZEN: "red",
  RESTRICTED: "red",
  MISMATCH: "red",
  POTENTIAL_MATCH: "red",
  CONFIRMED_MATCH: "red",
  ERROR: "red",
  NEEDS_REVIEW: "amber",
  UNKNOWN: "amber",
  ESCALATED: "amber",
  MANUAL_REVIEW: "amber",
  OPEN: "amber",
  PENDING_APPROVAL: "amber",
  PENDING: "blue",
  CREATED: "blue",
  SUBMITTED: "blue",
  RECEIVED: "blue",
  IN_PROGRESS: "blue",
  AWAITING_CUSTOMER: "blue",
  REVERSED: "gray",
  REGISTERED: "gray",
  IGNORED: "gray",
};

export function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE;
}) {
  const t =
    tone ?? (typeof children === "string" ? STATUS_TONE[children] : undefined);
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${TONE[t ?? "gray"]}`}
    >
      {children}
    </span>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {typeof error === "string" ? error : describeError(error)}
    </div>
  );
}

export function Notice({
  children,
  tone = "amber",
}: {
  children: React.ReactNode;
  tone?: "amber" | "blue";
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${
        tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-blue-200 bg-blue-50 text-blue-900"
      }`}
    >
      {children}
    </div>
  );
}

export function Loading({ what = "Loading" }: { what?: string }) {
  return <p className="text-sm text-muted-foreground">{what}…</p>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-muted-foreground">{children}</p>;
}

/** A scrollable table with header cells. */
export function Table({
  head,
  children,
}: {
  head: React.ReactNode[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-border [&>tr:last-child]:border-0 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top">
          {children}
        </tbody>
      </table>
    </div>
  );
}

/** Label/value pairs. */
export function KeyValues({
  rows,
}: {
  rows: [string, React.ReactNode][];
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="break-all">{v ?? "—"}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>—</span>;
  return (
    <pre className="max-w-xl overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2 font-mono text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs">{children}</span>;
}
