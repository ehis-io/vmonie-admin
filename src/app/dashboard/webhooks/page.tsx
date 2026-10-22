"use client";

import { useState } from "react";
import { formatDateTime, humanize } from "../../../lib/format";
import { qs } from "../../../lib/api";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import type { Page, WebhookEvent } from "../../../lib/types";
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

const STATUSES = ["RECEIVED", "PROCESSED", "FAILED", "REJECTED", "IGNORED"];

function List({ status }: { status: string }) {
  const [stack, setStack] = useState<string[]>([]);
  const cursor = stack[stack.length - 1];
  const res = useResource<Page<WebhookEvent>>(
    `/admin/webhooks${qs({ status, cursor, limit: "50" })}`,
  );
  return (
    <Card>
      <ErrorBox error={res.error} />
      {!res.data && res.loading && <Loading />}
      {res.data && res.data.items.length === 0 && <Empty>No webhooks.</Empty>}
      {res.data && res.data.items.length > 0 && (
        <Table head={["Received", "Provider", "Event", "Status", "Signature", "Attempts", "Processed", "Last error"]}>
          {res.data.items.map((w) => (
            <tr key={w.id}>
              <td className="whitespace-nowrap">{formatDateTime(w.receivedAt)}</td>
              <td>{w.providerCode}</td>
              <td className="font-mono text-xs">{w.eventType ?? "—"}</td>
              <td>
                <Badge>{w.status}</Badge>
              </td>
              <td>
                {w.signatureOk ? <Badge tone="green">Valid</Badge> : <Badge tone="red">Invalid</Badge>}
              </td>
              <td className="tabular-nums">{w.attempts}</td>
              <td className="whitespace-nowrap">{formatDateTime(w.processedAt)}</td>
              <td className="max-w-xs text-xs text-danger">{w.lastError ?? ""}</td>
            </tr>
          ))}
        </Table>
      )}
      <CursorPager stack={stack} nextCursor={res.data?.nextCursor} onChange={setStack} busy={res.loading} />
    </Card>
  );
}

export default function WebhooksPage() {
  useDocumentTitle("Webhooks");
  const [status, setStatus] = useState("");
  return (
    <>
      <PageHeader title="Webhooks" description="Inbound partner notifications, newest first." />
      <div className="mb-4 max-w-xs">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: "", label: "All statuses" },
            ...STATUSES.map((s) => ({ value: s, label: humanize(s) })),
          ]}
        />
      </div>
      <List key={status} status={status} />
    </>
  );
}
