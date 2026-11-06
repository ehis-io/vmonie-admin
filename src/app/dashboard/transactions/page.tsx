"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { qs } from "../../../lib/api";
import { formatDateTime, humanize, shortId } from "../../../lib/format";
import { formatMinor, formatMinorCompact } from "../../../lib/money";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import {
  KIND_LABELS,
  TRANSACTION_KINDS,
  TRANSACTION_STATUSES,
  type Transaction,
  type TransactionListTotals,
  type TransactionPage,
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

interface Filters {
  q: string;
  status: string;
  kind: string;
  direction: string;
  from: string;
  to: string;
  reference: string;
  customerId: string;
}

const NO_FILTERS: Filters = {
  q: "",
  status: "",
  kind: "",
  direction: "",
  from: "",
  to: "",
  reference: "",
  customerId: "",
};

const customerName = (c: Transaction["customer"]): string =>
  c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phoneNumber : "";

const UUID = /^[0-9a-f-]{36}$/i;

/** "312 transactions · ₦4.2m completed", for the filters as applied. */
function TotalsLine({ totals }: { totals: TransactionListTotals }) {
  const amounts = Object.entries(totals.completedAmountMinor).filter(
    ([, v]) => v !== "0",
  );
  return (
    <p className="mb-3 text-sm text-muted">
      <span className="font-semibold text-foreground">
        {totals.count.toLocaleString()}
      </span>{" "}
      {totals.count === 1 ? "transaction" : "transactions"}
      {amounts.map(([currency, minor]) => (
        <span key={currency} title={`${formatMinor(minor, currency)} completed`}>
          {" · "}
          <span className="font-semibold text-foreground">
            {formatMinorCompact(minor, currency)}
          </span>{" "}
          completed
        </span>
      ))}
    </p>
  );
}

function Results({ filters }: { filters: Filters }) {
  const [stack, setStack] = useState<string[]>([]);
  const cursor = stack[stack.length - 1];
  const res = useResource<TransactionPage>(
    `/admin/transactions${qs({ ...filters, cursor, limit: "25" })}`,
  );
  // Totals come with the first page; keep them while paging on.
  const [totals, setTotals] = useState<TransactionListTotals | null>(null);
  const fresh = res.data?.totals;
  if (fresh && fresh !== totals) setTotals(fresh);
  return (
    <Card>
      {totals && <TotalsLine totals={totals} />}
      <ErrorBox error={res.error} />
      {!res.data && res.loading && <Loading />}
      {res.data && res.data.items.length === 0 && (
        <Empty>No transactions match.</Empty>
      )}
      {res.data && res.data.items.length > 0 && (
        <Table
          head={["Reference", "Kind", "Status", "Amount", "Fee", "Counterparty", "Customer", "Created"]}
        >
          {res.data.items.map((t) => (
            <tr key={t.id}>
              <td>
                <Link
                  href={`/dashboard/transactions/${t.id}`}
                  className="font-mono text-xs text-primary-soft hover:underline"
                >
                  {t.reference}
                </Link>
              </td>
              <td className="whitespace-nowrap">
                {humanize(t.kind)}
                <span className="block text-xs text-muted">
                  {t.direction}
                </span>
              </td>
              <td>
                <Badge>{t.status}</Badge>
              </td>
              <td className="whitespace-nowrap tabular-nums">
                {formatMinor(t.amountMinor, t.currency)}
              </td>
              <td className="whitespace-nowrap tabular-nums">
                {t.feeMinor === "0" ? "—" : formatMinor(t.feeMinor, t.currency)}
              </td>
              <td>
                {t.counterpartyName ?? "—"}
                <span className="block text-xs text-muted">
                  {t.bill
                    ? [humanize(t.bill.type), t.bill.productName, t.counterpartyAccount]
                        .filter(Boolean)
                        .join(" · ")
                    : `${t.counterpartyBank ?? ""} ${t.counterpartyAccount ?? ""}`}
                </span>
              </td>
              <td>
                {t.customerId ? (
                  <Link
                    href={`/dashboard/users/${t.customerId}`}
                    className="text-primary-soft hover:underline"
                  >
                    {customerName(t.customer) || (
                      <span className="font-mono text-xs">{shortId(t.customerId)}</span>
                    )}
                    {t.customer && (
                      <span className="block font-mono text-xs text-muted">
                        {t.customer.phoneNumber}
                      </span>
                    )}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
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

function TransactionsScreen() {
  useDocumentTitle("Transactions");
  const params = useSearchParams();
  const router = useRouter();
  const filters: Filters = {
    q: params.get("q") ?? "",
    status: params.get("status") ?? "",
    kind: params.get("kind") ?? "",
    direction: params.get("direction") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    reference: params.get("reference") ?? "",
    customerId: params.get("customerId") ?? "",
  };
  const [draft, setDraft] = useState<Filters>(filters);
  const [formError, setFormError] = useState<string | null>(null);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      ...draft,
      q: draft.q.trim(),
      reference: draft.reference.trim(),
      customerId: draft.customerId.trim(),
    };
    if (next.customerId && !UUID.test(next.customerId)) {
      setFormError("Customer id must be a full UUID.");
      return;
    }
    if (next.from && next.to && next.from > next.to) {
      setFormError("The start date is after the end date.");
      return;
    }
    setFormError(null);
    router.push(`/dashboard/transactions${qs({ ...next })}`);
  };

  return (
    <>
      <PageHeader title="Transactions" description="All money movements, newest first." />
      <form
        onSubmit={apply}
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
      >
        <TextInput
          className="sm:col-span-2"
          label="Search"
          placeholder="Name, phone, email, reference or counterparty"
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
        />
        <TextInput
          label="From"
          type="date"
          value={draft.from}
          onChange={(e) => setDraft({ ...draft, from: e.target.value })}
        />
        <TextInput
          label="To"
          type="date"
          value={draft.to}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
        />
        <Select
          label="Status"
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          options={[
            { value: "", label: "Any status" },
            ...TRANSACTION_STATUSES.map((s) => ({ value: s, label: humanize(s) })),
          ]}
        />
        <Select
          label="Kind"
          value={draft.kind}
          onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
          options={[
            { value: "", label: "Any kind" },
            ...TRANSACTION_KINDS.map((s) => ({ value: s, label: KIND_LABELS[s] })),
          ]}
        />
        <Select
          label="Direction"
          value={draft.direction}
          onChange={(e) => setDraft({ ...draft, direction: e.target.value })}
          options={[
            { value: "", label: "In and out" },
            { value: "CREDIT", label: "Money in (credit)" },
            { value: "DEBIT", label: "Money out (debit)" },
          ]}
        />
        <TextInput
          label="Reference"
          placeholder="Our reference or provider reference"
          value={draft.reference}
          onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
        />
        <TextInput
          label="Customer id"
          placeholder="UUID"
          value={draft.customerId}
          onChange={(e) => setDraft({ ...draft, customerId: e.target.value })}
        />
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(NO_FILTERS);
              router.push("/dashboard/transactions");
            }}
          >
            Clear
          </Button>
        </div>
      </form>
      <div className="mb-3">
        <ErrorBox error={formError} />
      </div>
      <Results key={params.toString()} filters={filters} />
    </>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TransactionsScreen />
    </Suspense>
  );
}
