"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { qs } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import type { CustomerSummary, Page } from "../../../lib/types";
import { CursorPager } from "../../../components/CursorPager";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Loading,
  PageHeader,
  Table,
  TextInput,
} from "../../../components/ui";

function Results({ q }: { q: string }) {
  const [stack, setStack] = useState<string[]>([]);
  const cursor = stack[stack.length - 1];
  const res = useResource<Page<CustomerSummary>>(
    `/admin/customers${qs({ q, cursor, limit: "25" })}`,
  );
  return (
    <Card>
      <ErrorBox error={res.error} />
      {!res.data && res.loading && <Loading />}
      {res.data && res.data.items.length === 0 && (
        <Empty>No customers match.</Empty>
      )}
      {res.data && res.data.items.length > 0 && (
        <Table head={["Name", "Phone", "Status", "Tier", "Accounts", "Joined"]}>
          {res.data.items.map((c) => (
            <tr key={c.id}>
              <td>
                <Link
                  href={`/dashboard/customers/${c.id}`}
                  className="text-primary hover:underline"
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
              <td className="whitespace-nowrap">{formatDateTime(c.createdAt)}</td>
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

function CustomersScreen() {
  useDocumentTitle("Customers");
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const [draft, setDraft] = useState(q);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/dashboard/customers${qs({ q: draft.trim() })}`);
  };

  return (
    <>
      <PageHeader
        title="Customers"
        description="Search by phone number, name, full account number or customer id."
      />
      <form onSubmit={submit} className="mb-4 flex max-w-xl items-end gap-2">
        <TextInput
          className="flex-1"
          placeholder="08031234567, Okafor, 9038042624…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Search customers"
        />
        <Button type="submit">Search</Button>
      </form>
      {/* Keyed by the query so paging restarts on a new search. */}
      <Results key={q} q={q} />
    </>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CustomersScreen />
    </Suspense>
  );
}
