/** Dates in Lagos time, where the business day is defined. */
const dateTime = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Africa/Lagos",
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : dateTime.format(d);
}

/** "3m ago" style age, for queues. */
export function age(value: string | null | undefined): string {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return "—";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Today's date in Lagos as YYYY-MM-DD. */
export function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Last four characters of an account number, for anything the API forgot to mask. */
export function maskAccount(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.includes("*")) return value;
  return value.length <= 4
    ? "*".repeat(value.length)
    : "*".repeat(value.length - 4) + value.slice(-4);
}

export const shortId = (id: string | null | undefined): string =>
  id ? id.slice(0, 8) : "—";

export const humanize = (s: string | null | undefined): string =>
  s ? s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "—";
