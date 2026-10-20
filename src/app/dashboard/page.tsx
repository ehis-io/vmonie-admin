"use client";

import Link from "next/link";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useResource } from "../../lib/useResource";
import { formatKobo } from "../../lib/money";
import { age, formatDateTime, humanize, maskAccount } from "../../lib/format";
import type { IntegrationHealth, Transaction } from "../../lib/types";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Loading,
  PageHeader,
  Table,
} from "../../components/ui";

function Tile({
  label,
  value,
  href,
  warn,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  warn?: boolean;
}) {
  const body = (
    <div
      className={`h-full rounded-lg border bg-surface p-4 ${
        warn ? "border-amber-300 bg-amber-50" : "border-border"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
  );
}

function Counts({
  counts,
  empty,
}: {
  counts: Record<string, number>;
  empty: string;
}) {
  const entries = Object.entries(counts);
  if (!entries.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {entries.map(([k, v]) => (
        <li key={k} className="flex justify-between gap-4">
          <span>{humanize(k)}</span>
          <span className="font-semibold tabular-nums">{v}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  useDocumentTitle("Dashboard");
  const health = useResource<IntegrationHealth>("/admin/health/integrations");
  const pending = useResource<Transaction[]>("/admin/transactions/pending");
  const h = health.data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Integration health and the transfers that are not final yet."
        actions={
          <Button
            variant="secondary"
            busy={health.loading || pending.loading}
            onClick={() => {
              health.reload();
              pending.reload();
            }}
          >
            Refresh
          </Button>
        }
      />
      <ErrorBox error={health.error} />
      {!h && health.loading && <Loading />}
      {h && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile
            label="Transfers in flight"
            value={h.transfersInFlight}
            href="#pending"
          />
          <Tile
            label="Needing review"
            value={h.transfersNeedingReview}
            href="/dashboard/transactions?status=NEEDS_REVIEW"
            warn={h.transfersNeedingReview > 0}
          />
          <Tile
            label="Last verified webhook"
            value={
              <span className="text-base">
                {h.lastVerifiedWebhookAt ? (
                  <>
                    {age(h.lastVerifiedWebhookAt)}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {formatDateTime(h.lastVerifiedWebhookAt)}
                    </span>
                  </>
                ) : (
                  "Never"
                )}
              </span>
            }
            href="/dashboard/webhooks"
          />
          <Tile
            label="Open exceptions"
            value={Object.values(h.openExceptions).reduce((a, b) => a + b, 0)}
            href="/dashboard/reconciliation"
            warn={Object.keys(h.openExceptions).length > 0}
          />
          <Card title="Open exceptions by kind" className="sm:col-span-2">
            <Counts counts={h.openExceptions} empty="No open exceptions." />
          </Card>
          <Card title="Webhooks, last 24h" className="sm:col-span-2">
            <Counts counts={h.webhooksLast24h} empty="No webhooks in the last 24 hours." />
          </Card>
        </div>
      )}

      <div id="pending" />
      <Card title="Pending transfers (oldest first)" className="mt-6">
        <ErrorBox error={pending.error} />
        {!pending.data && pending.loading && <Loading />}
        {pending.data && pending.data.length === 0 && (
          <Empty>No transfers waiting.</Empty>
        )}
        {pending.data && pending.data.length > 0 && (
          <Table
            head={["Reference", "Status", "Amount", "Beneficiary", "Checks", "Age"]}
          >
            {pending.data.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link
                    href={`/dashboard/transactions/${t.id}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {t.reference}
                  </Link>
                </td>
                <td>
                  <Badge>{t.status}</Badge>
                </td>
                <td className="tabular-nums">{formatKobo(t.amountMinor)}</td>
                <td>
                  {t.counterpartyName ?? "—"}
                  <span className="block text-xs text-muted-foreground">
                    {t.counterpartyBank} {maskAccount(t.counterpartyAccount)}
                  </span>
                </td>
                <td className="tabular-nums">{t.statusChecks}</td>
                <td title={formatDateTime(t.createdAt)}>{age(t.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
