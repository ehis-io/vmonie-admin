"use client";

import { useState } from "react";
import Link from "next/link";
import { age, formatDateTime, humanize } from "../../../lib/format";
import { qs } from "../../../lib/api";
import { useAdmin } from "../../../lib/access";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import { SUPPORT_STATUSES, type Page, type SupportCase } from "../../../lib/types";
import { CursorPager } from "../../../components/CursorPager";
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  Loading,
  PageHeader,
  Select,
  Table,
} from "../../../components/ui";

function Queue({ status }: { status: string }) {
  const session = useAdmin();
  const meId = session.status === "ready" ? session.me.id : null;
  const [stack, setStack] = useState<string[]>([]);
  const cursor = stack[stack.length - 1];
  const res = useResource<Page<SupportCase>>(
    `/admin/support/cases${qs({ status, cursor, limit: "50" })}`,
  );
  return (
    <Card>
      <ErrorBox error={res.error} />
      {!res.data && res.loading && <Loading />}
      {res.data && res.data.items.length === 0 && <Empty>No cases.</Empty>}
      {res.data && res.data.items.length > 0 && (
        <Table head={["Reference", "Subject", "Type", "Customer", "Status", "Assigned", "Opened"]}>
          {res.data.items.map((c) => (
            <tr key={c.id}>
              <td>
                <Link
                  href={`/dashboard/support/${c.id}`}
                  className="font-mono text-xs text-primary-soft hover:underline"
                >
                  {c.reference}
                </Link>
              </td>
              <td>{c.subject}</td>
              <td className="whitespace-nowrap">{humanize(c.type)}</td>
              <td>
                {[c.customer.firstName, c.customer.lastName].filter(Boolean).join(" ") || "—"}
                <span className="block font-mono text-xs text-muted">
                  {c.customer.phoneNumber}
                </span>
              </td>
              <td>
                <Badge>{c.status}</Badge>
              </td>
              <td className="text-xs">
                {!c.assignedToId ? "Unassigned" : c.assignedToId === meId ? "You" : c.assignedToId.slice(0, 8)}
              </td>
              <td className="whitespace-nowrap" title={formatDateTime(c.createdAt)}>
                {age(c.createdAt)}
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

export default function SupportPage() {
  useDocumentTitle("Support cases");
  const [status, setStatus] = useState("OPEN");
  return (
    <>
      <PageHeader title="Support cases" description="Customer cases, oldest first." />
      <div className="mb-4 max-w-xs">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: "", label: "All statuses" },
            ...SUPPORT_STATUSES.map((s) => ({ value: s, label: humanize(s) })),
          ]}
        />
      </div>
      <Queue key={status} status={status} />
    </>
  );
}
