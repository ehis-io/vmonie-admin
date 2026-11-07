"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { qs } from "../../../lib/api";
import { age, formatDateTime } from "../../../lib/format";
import { formatMinor, formatMinorCompact } from "../../../lib/money";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import {
  ACTIVE_FILTERS,
  TXN_PERIODS,
  type CustomerPage,
  type TxnPeriod,
  type TxnStats,
} from "../../../lib/types";
import { CursorPager } from "../../../components/CursorPager";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Loading,
  PageHeader,
  Select,
  Table,
  TextInput,
} from "../../../components/ui";

const ACTIVE_VALUES: readonly string[] = ACTIVE_FILTERS.map((f) => f.value);
const DEFAULT_PERIOD: TxnPeriod = "30";
const isPeriod = (v: string): v is TxnPeriod =>
  TXN_PERIODS.some((p) => p.value === v);
const periodLabel = (p: TxnPeriod) =>
  TXN_PERIODS.find((x) => x.value === p)?.label.toLowerCase() ?? "";

/** Non-zero volumes, one per currency. */
const volumes = (stats: TxnStats) =>
  Object.entries(stats.volumeMinor).filter(([, v]) => v !== "0");

/** "₦4.2m · GH₵12k", or "—" when nothing moved. */
function Volume({ stats }: { stats: TxnStats }) {
  const list = volumes(stats);
  if (!list.length) return <span className="text-muted">—</span>;
  return (
    <>
      {list.map(([currency, minor]) => (
        <span
          key={currency}
          className="block"
          title={formatMinor(minor, currency)}
        >
          {formatMinorCompact(minor, currency)}
        </span>
      ))}
    </>
  );
}

/** Every user's transactions in the period, whatever the search or activity filter. */
function TotalsLine({
  totals,
  period,
}: {
  totals: TxnStats;
  period: TxnPeriod;
}) {
  return (
    <p className="mb-3 text-sm text-muted">
      All users, {periodLabel(period)}:{" "}
      <span className="font-semibold text-foreground">
        {totals.count.toLocaleString()}
      </span>{" "}
      {totals.count === 1 ? "transaction" : "transactions"}
      {volumes(totals).map(([currency, minor]) => (
        <span key={currency} title={formatMinor(minor, currency)}>
          {" · "}
          <span className="font-semibold text-foreground">
            {formatMinorCompact(minor, currency)}
          </span>{" "}
          volume
        </span>
      ))}
    </p>
  );
}

function Results({
  q,
  active,
  period,
}: {
  q: string;
  active: string;
  period: TxnPeriod;
}) {
  const [stack, setStack] = useState<string[]>([]);
  const cursor = stack[stack.length - 1];
  const res = useResource<CustomerPage>(
    `/admin/customers${qs({ q, active, period, cursor, limit: "25" })}`,
  );
  // Totals come with the first page; keep them while paging on.
  const [totals, setTotals] = useState<TxnStats | null>(null);
  const fresh = res.data?.totals;
  if (fresh && fresh !== totals) setTotals(fresh);
  return (
    <Card>
      {totals && <TotalsLine totals={totals} period={period} />}
      <ErrorBox error={res.error} />
      {!res.data && res.loading && <Loading />}
      {res.data && res.data.items.length === 0 && (
        <Empty>No users match.</Empty>
      )}
      {res.data && res.data.items.length > 0 && (
        <Table
          head={[
            "Name",
            "Phone",
            "Status",
            "Tier",
            "Accounts",
            "Transactions",
            "Volume",
            "Last activity",
            "Joined",
          ]}
        >
          {res.data.items.map((c) => (
            <tr key={c.id}>
              <td>
                <Link
                  href={`/dashboard/users/${c.id}`}
                  className="font-medium text-foreground hover:text-primary-soft"
                >
                  {[c.firstName, c.lastName].filter(Boolean).join(" ") ||
                    "(no name yet)"}
                </Link>
              </td>
              <td className="font-mono text-xs">{c.phoneNumber}</td>
              <td>
                <Badge>{c.status}</Badge>
              </td>
              <td>{c.tier}</td>
              <td>
                {c.accounts.length === 0
                  ? "—"
                  : c.accounts.map((a) => (
                      <span key={a.id} className="mr-2 inline-flex gap-1">
                        <span className="font-mono text-xs">
                          {a.accountNumber ?? "(none)"}
                        </span>
                        <Badge>{a.status}</Badge>
                      </span>
                    ))}
              </td>
              <td className="tabular-nums">
                {c.transactions ? c.transactions.count.toLocaleString() : "—"}
              </td>
              <td className="whitespace-nowrap tabular-nums">
                {c.transactions ? <Volume stats={c.transactions} /> : "—"}
              </td>
              <td className="whitespace-nowrap">
                {c.lastActivityAt ? (
                  <span title={formatDateTime(c.lastActivityAt)}>
                    {age(c.lastActivityAt)}
                  </span>
                ) : (
                  <span className="text-muted">Never</span>
                )}
              </td>
              <td className="whitespace-nowrap">
                {formatDateTime(c.createdAt)}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <CursorPager
        stack={stack}
        nextCursor={res.data?.nextCursor}
        onChange={setStack}
        busy={res.loading}
      />
    </Card>
  );
}

function UsersScreen() {
  useDocumentTitle("Users");
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const rawActive = params.get("active") ?? "";
  const active = ACTIVE_VALUES.includes(rawActive) ? rawActive : "";
  const rawPeriod = params.get("period") ?? "";
  const period = isPeriod(rawPeriod) ? rawPeriod : DEFAULT_PERIOD;
  const [draft, setDraft] = useState(q);

  const go = (next: { q: string; active: string; period: TxnPeriod }) =>
    router.push(
      `/dashboard/users${qs({
        ...next,
        // The default stays out of the URL.
        period: next.period === DEFAULT_PERIOD ? "" : next.period,
      })}`,
    );
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    go({ q: draft.trim(), active, period });
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with a Vmonie account. Search by phone number, name, full account number or customer id. Active means they moved money: a deposit, transfer, Vmonie transfer or bill that went through. Transactions and volume count those movements in the chosen period; volume is the amount moved, before fees."
      />
      <form
        onSubmit={submit}
        className="mb-4 flex max-w-3xl flex-wrap items-end gap-2"
      >
        <TextInput
          className="flex-1"
          placeholder="08031234567, Okafor, 9038042624…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Search users"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        <Select
          aria-label="Activity"
          value={active}
          onChange={(e) => go({ q, active: e.target.value, period })}
          options={[{ value: "", label: "Everyone" }, ...ACTIVE_FILTERS]}
        />
        <Select
          aria-label="Transactions period"
          value={period}
          onChange={(e) =>
            go({
              q,
              active,
              period: isPeriod(e.target.value)
                ? e.target.value
                : DEFAULT_PERIOD,
            })
          }
          options={[...TXN_PERIODS]}
        />
      </form>
      {/* Keyed by the query so paging restarts on a new search. */}
      <Results
        key={`${q}|${active}|${period}`}
        q={q}
        active={active}
        period={period}
      />
    </>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <UsersScreen />
    </Suspense>
  );
}
