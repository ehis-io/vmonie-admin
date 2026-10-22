"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { qs } from "../../../lib/api";
import { formatDateTime, humanize, shortId } from "../../../lib/format";
import { formatKobo } from "../../../lib/money";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import {
  TRANSACTION_KINDS,
  TRANSACTION_STATUSES,
  type Page,
  type Transaction,
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
  status: string;
  kind: string;
  reference: string;
  customerId: string;
}

const UUID = /^[0-9a-f-]{36}$/i;

function Results({ filters }: { filters: Filters }) {
  const [stack, setStack] = useState<string[]>([]);
  const cursor = stack[stack.length - 1];
  const res = useResource<Page<Transaction>>(
    `/admin/transactions${qs({ ...filters, cursor, limit: "25" })}`,
  );
  return (
    <Card>
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
                {formatKobo(t.amountMinor)}
              </td>
              <td className="whitespace-nowrap tabular-nums">
                {t.feeMinor === "0" ? "—" : formatKobo(t.feeMinor)}
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
                    className="font-mono text-xs text-primary-soft hover:underline"
                  >
                    {shortId(t.customerId)}
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
    status: params.get("status") ?? "",
    kind: params.get("kind") ?? "",
    reference: params.get("reference") ?? "",
    customerId: params.get("customerId") ?? "",
  };
  const [draft, setDraft] = useState<Filters>(filters);
  const [formError, setFormError] = useState<string | null>(null);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      ...draft,
      reference: draft.reference.trim(),
      customerId: draft.customerId.trim(),
    };
    if (next.customerId && !UUID.test(next.customerId)) {
      setFormError("Customer id must be a full UUID.");
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
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_1.5fr_auto] lg:items-end"
      >
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
            ...TRANSACTION_KINDS.map((s) => ({ value: s, label: humanize(s) })),
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
              setDraft({ status: "", kind: "", reference: "", customerId: "" });
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
