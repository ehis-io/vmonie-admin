"use client";

import { useState } from "react";
import { qs } from "../../../lib/api";
import { useCan } from "../../../lib/access";
import { formatDateTime, shortId } from "../../../lib/format";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import type { AuditEntry } from "../../../lib/types";
import {
  Button,
  Card,
  Empty,
  ErrorBox,
  Json,
  Loading,
  Notice,
  PageHeader,
  Table,
  TextInput,
} from "../../../components/ui";

interface Verify {
  ok: boolean;
  brokenAt: string | null;
  rows: number;
}

function VerifyChain() {
  const [run, setRun] = useState(false);
  const res = useResource<Verify>(run ? "/admin/audit/verify" : null);
  const v = res.data;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        busy={res.loading}
        onClick={() => (run ? res.reload() : setRun(true))}
      >
        Verify chain
      </Button>
      {res.error ? <ErrorBox error={res.error} /> : null}
      {v &&
        !res.loading &&
        (v.ok ? (
          <span className="text-sm text-success">
            Chain intact across {v.rows} rows.
          </span>
        ) : (
          <span className="text-sm font-semibold text-danger">
            Chain BROKEN at sequence {v.brokenAt} ({v.rows} rows checked). Escalate.
          </span>
        ))}
    </div>
  );
}

export default function AuditPage() {
  useDocumentTitle("Audit log");
  const allowed = useCan("viewAudit");
  const [draft, setDraft] = useState({ entityId: "", actorId: "" });
  const [filters, setFilters] = useState({ entityId: "", actorId: "" });
  const res = useResource<AuditEntry[]>(allowed ? `/admin/audit${qs(filters)}` : null);

  if (!allowed) {
    return (
      <>
        <PageHeader title="Audit log" />
        <Notice>The audit log needs the COMPLIANCE role.</Notice>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Tamper-evident record of privileged actions (newest 200)."
        actions={<VerifyChain />}
      />
      <form
        className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ entityId: draft.entityId.trim(), actorId: draft.actorId.trim() });
        }}
      >
        <TextInput
          label="Entity id"
          value={draft.entityId}
          onChange={(e) => setDraft({ ...draft, entityId: e.target.value })}
        />
        <TextInput
          label="Actor id"
          value={draft.actorId}
          onChange={(e) => setDraft({ ...draft, actorId: e.target.value })}
        />
        <Button type="submit">Filter</Button>
      </form>
      <Card>
        <ErrorBox error={res.error} />
        {!res.data && res.loading && <Loading />}
        {res.data && res.data.length === 0 && <Empty>No entries.</Empty>}
        {res.data && res.data.length > 0 && (
          <Table head={["#", "When", "Action", "Actor", "Entity", "Detail", "IP"]}>
            {res.data.map((a) => (
              <tr key={a.id}>
                <td className="tabular-nums">{a.sequence}</td>
                <td className="whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                <td className="font-mono text-xs">{a.action}</td>
                <td className="text-xs">
                  {a.actorType}
                  <span className="block font-mono" title={a.actorId ?? undefined}>
                    {shortId(a.actorId)}
                  </span>
                </td>
                <td className="text-xs">
                  {a.entityType ?? "—"}
                  <span className="block font-mono" title={a.entityId ?? undefined}>
                    {shortId(a.entityId)}
                  </span>
                </td>
                <td>
                  <Json value={a.detail} />
                </td>
                <td className="font-mono text-xs">{a.ip}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
