"use client";

import { useState } from "react";
import Link from "next/link";
import { api, qs } from "../../../lib/api";
import { useCan } from "../../../lib/access";
import { formatDateTime, humanize, lagosToday, shortId } from "../../../lib/format";
import { formatKobo } from "../../../lib/money";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import type { Page, ReconciliationRecord } from "../../../lib/types";
import { ConfirmAction } from "../../../components/ConfirmAction";
import { CursorPager } from "../../../components/CursorPager";
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  Json,
  Loading,
  PageHeader,
  Table,
  TextInput,
} from "../../../components/ui";

function adjustmentHref(r: ReconciliationRecord): string {
  return `/dashboard/adjustments/new${qs({
    reconciliationId: r.id,
    amountMinor: r.amountMinor,
    counterLedger: "SUSPENSE",
    direction: "CREDIT",
  })}`;
}

function Exceptions({ status }: { status: "OPEN" | "RESOLVED" }) {
  const [stack, setStack] = useState<string[]>([]);
  const cursor = stack[stack.length - 1];
  const canAdjust = useCan("requestAdjustment");
  const res = useResource<Page<ReconciliationRecord>>(
    `/admin/reconciliation${qs({ status, cursor, limit: "25" })}`,
  );

  return (
    <Card>
      <ErrorBox error={res.error} />
      {!res.data && res.loading && <Loading />}
      {res.data && res.data.items.length === 0 && (
        <Empty>No {status.toLowerCase()} exceptions.</Empty>
      )}
      {res.data && res.data.items.length > 0 && (
        <Table
          head={[
            "Kind",
            "Amount",
            "Provider ref",
            "Transaction",
            "Details",
            status === "OPEN" ? "Raised" : "Resolution",
            "",
          ]}
        >
          {res.data.items.map((r) => (
            <tr key={r.id}>
              <td>
                <Badge tone={status === "OPEN" ? "amber" : "green"}>
                  {humanize(r.kind)}
                </Badge>
              </td>
              <td className="whitespace-nowrap tabular-nums">
                {formatKobo(r.amountMinor)}
              </td>
              <td className="font-mono text-xs">
                {r.providerCode}
                <span className="block">{r.providerReference ?? "—"}</span>
              </td>
              <td>
                {r.transactionId ? (
                  <Link
                    href={`/dashboard/transactions/${r.transactionId}`}
                    className="font-mono text-xs text-primary-soft hover:underline"
                  >
                    {shortId(r.transactionId)}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td>
                <Json value={r.details} />
              </td>
              <td className="text-sm">
                {status === "OPEN" ? (
                  formatDateTime(r.createdAt)
                ) : (
                  <>
                    {r.resolution}
                    <span className="block text-xs text-muted">
                      {formatDateTime(r.resolvedAt)} by {shortId(r.resolvedById)}
                    </span>
                  </>
                )}
              </td>
              <td>
                {status === "OPEN" && (
                  <div className="flex flex-col items-start gap-2">
                    {r.kind === "UNMATCHED_DEPOSIT" &&
                      (canAdjust ? (
                        <Link
                          href={adjustmentHref(r)}
                          className="whitespace-nowrap rounded-lg border border-surface-border px-2.5 py-1 text-xs font-medium hover:bg-surface-raised"
                        >
                          Assign via adjustment
                        </Link>
                      ) : (
                        <span
                          className="text-xs text-muted"
                          title="Requires the OPERATIONS or FINANCE role"
                        >
                          Assign via adjustment
                        </span>
                      ))}
                    <ConfirmAction
                      label="Resolve"
                      permission="resolveReconciliation"
                      title={`Resolve ${humanize(r.kind).toLowerCase()} exception`}
                      description="Only for exceptions that need no money movement. One that does is closed by approving its adjustment."
                      textField={{
                        label: "Resolution note",
                        minLength: 10,
                        maxLength: 1000,
                      }}
                      onConfirm={({ text }) =>
                        api.post(`/admin/reconciliation/${r.id}/resolve`, {
                          resolution: text,
                        })
                      }
                      onDone={res.reload}
                    />
                  </div>
                )}
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

function RunReconciliation({ onRan }: { onRan: () => void }) {
  const [date, setDate] = useState(lagosToday());
  const [report, setReport] = useState<unknown>(null);
  return (
    <Card title="Run reconciliation for a date" className="mb-4">
      <div className="flex flex-wrap items-end gap-3">
        <TextInput
          label="Lagos date"
          type="date"
          value={date}
          max={lagosToday()}
          onChange={(e) => setDate(e.target.value)}
        />
        <ConfirmAction
          label="Run reconciliation"
          permission="runReconciliation"
          variant="primary"
          size="md"
          disabledReason={/^\d{4}-\d{2}-\d{2}$/.test(date) ? undefined : "Pick a date"}
          title={`Reconcile ${date}`}
          description="Compares the partner's statement for that Lagos day with our records and raises exceptions for differences. Re-running does not duplicate open exceptions."
          confirmLabel="Run"
          onConfirm={() =>
            api.post("/admin/reconciliation/run", { date }).then((r) => {
              setReport(r);
              return r;
            })
          }
          onDone={onRan}
        />
      </div>
      {report !== null && (
        <div className="mt-3">
          <p className="mb-1 text-sm font-medium">Report</p>
          <Json value={report} />
        </div>
      )}
    </Card>
  );
}

export default function ReconciliationPage() {
  useDocumentTitle("Reconciliation");
  const [tab, setTab] = useState<"OPEN" | "RESOLVED">("OPEN");
  const [runs, setRuns] = useState(0);

  return (
    <>
      <PageHeader
        title="Reconciliation"
        description="Differences between our ledger and the partner bank's records."
      />
      <RunReconciliation onRan={() => setRuns((n) => n + 1)} />
      <div className="mb-3 flex gap-2" role="tablist">
        {(["OPEN", "RESOLVED"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === s ? "bg-primary text-white" : "border border-surface-border bg-surface"
            }`}
          >
            {humanize(s)}
          </button>
        ))}
      </div>
      <Exceptions key={`${tab}-${runs}`} status={tab} />
    </>
  );
}
