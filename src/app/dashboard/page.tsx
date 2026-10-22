"use client";

import { useState } from "react";
import Link from "next/link";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useResource } from "../../lib/useResource";
import { formatKobo } from "../../lib/money";
import { age, formatDateTime, humanize, maskAccount } from "../../lib/format";
import type { IntegrationHealth, OverviewStats, Transaction } from "../../lib/types";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Loading,
  PageHeader,
  StatTile,
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
  const body = <StatTile label={label} value={value} warn={warn} />;
  return href ? (
    <Link href={href} className="block rounded-xl transition-opacity hover:opacity-90">
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
  if (!entries.length) return <p className="text-sm text-muted">{empty}</p>;
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

/** zemfi's overview tiles: where the product stands right now. */
function Stats() {
  const res = useResource<OverviewStats>("/admin/stats");
  const s = res.data;
  if (!s) return res.error ? <ErrorBox error={res.error} /> : <Loading />;
  const tiers = Object.entries(s.customers.byTier)
    .map(([t, n]) => `T${t}: ${n.toLocaleString()}`)
    .join(" · ");
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label="Customers"
          value={s.customers.total.toLocaleString()}
          href="/dashboard/users"
        />
        <Tile label="Verified" value={(s.customers.byStatus.VERIFIED ?? 0).toLocaleString()} />
        <Tile
          label="Restricted"
          value={(s.customers.byStatus.RESTRICTED ?? 0).toLocaleString()}
          warn={(s.customers.byStatus.RESTRICTED ?? 0) > 0}
        />
        <Tile label="New in 7 days" value={s.customers.newLast7Days.toLocaleString()} />
        <Tile
          label="Accounts open"
          value={s.accounts.open.toLocaleString()}
        />
        <Tile label="Opened today" value={s.accounts.openedToday.toLocaleString()} />
        <Tile
          label="Pending transfers"
          value={s.pendingTransfers.toLocaleString()}
          href="#pending"
          warn={s.transfersNeedingReview > 0}
        />
        <Tile
          label="Open compliance holds"
          value={s.openComplianceHolds.toLocaleString()}
          href="/dashboard/compliance"
          warn={s.openComplianceHolds > 0}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Card title="Deposits today">
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {formatKobo(s.today.deposits.volumeMinor)}
          </p>
          <p className="text-xs text-muted">
            {s.today.deposits.count.toLocaleString()} successful since Lagos midnight
          </p>
        </Card>
        <Card title="Transfers today">
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {formatKobo(s.today.transfers.volumeMinor)}
          </p>
          <p className="text-xs text-muted">
            {s.today.transfers.count.toLocaleString()} successful · fees{" "}
            {formatKobo(s.today.transfers.feesMinor)} · {s.today.transfers.failed} failed
          </p>
        </Card>
      </div>
      <p className="mt-2 text-xs text-muted">
        By tier: {tiers || "—"} · Open support cases: {s.openSupportCases}
      </p>
    </>
  );
}

export default function DashboardPage() {
  useDocumentTitle("Overview");
  const health = useResource<IntegrationHealth>("/admin/health/integrations");
  const pending = useResource<Transaction[]>("/admin/transactions/pending");
  const h = health.data;
  // Remounting Stats refetches it with the rest.
  const [statsKey, setStatsKey] = useState(0);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Where Vmonie stands right now: customers, today's money, and integration health."
        actions={
          <Button
            variant="secondary"
            busy={health.loading || pending.loading}
            onClick={() => {
              health.reload();
              pending.reload();
              setStatsKey((k) => k + 1);
            }}
          >
            Refresh
          </Button>
        }
      />
      <Stats key={statsKey} />

      <h2 className="mb-3 mt-8 text-sm font-semibold text-foreground">Integrations</h2>
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
                    <span className="block text-xs font-normal text-muted">
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
                    className="font-mono text-xs text-primary-soft hover:underline"
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
                  <span className="block text-xs text-muted">
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
