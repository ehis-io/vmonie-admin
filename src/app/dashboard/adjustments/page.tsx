"use client";

import { useState } from "react";
import Link from "next/link";
import { api, qs } from "../../../lib/api";
import { can, useAdmin } from "../../../lib/access";
import { formatDateTime, humanize, shortId } from "../../../lib/format";
import { formatKobo } from "../../../lib/money";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import type { Adjustment } from "../../../lib/types";
import { ConfirmAction } from "../../../components/ConfirmAction";
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  Loading,
  Notice,
  PageHeader,
  Table,
} from "../../../components/ui";

const TABS = ["PENDING_APPROVAL", "APPROVED", "REJECTED", ""] as const;

export default function AdjustmentsPage() {
  useDocumentTitle("Adjustments");
  const session = useAdmin();
  const me = session.status === "ready" ? session.me : null;
  const [status, setStatus] = useState<(typeof TABS)[number]>("PENDING_APPROVAL");
  const res = useResource<Adjustment[]>(`/admin/adjustments${qs({ status })}`);
  const canRequest = me ? can(me.roles, "requestAdjustment") : false;

  const who = (id: string | null) =>
    !id ? "—" : id === me?.id ? "You" : shortId(id);

  return (
    <>
      <PageHeader
        title="Adjustments"
        description="Balance corrections. One person requests, a different FINANCE admin approves; only approval posts to the ledger."
        actions={
          canRequest ? (
            <Link
              href="/dashboard/adjustments/new"
              className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Request adjustment
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">
              Requesting needs OPERATIONS or FINANCE
            </span>
          )
        }
      />
      <div className="mb-3 flex flex-wrap gap-2" role="tablist">
        {TABS.map((s) => (
          <button
            key={s || "all"}
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              status === s ? "bg-primary text-white" : "border border-border bg-surface"
            }`}
          >
            {s ? humanize(s) : "All"}
          </button>
        ))}
      </div>
      <Card>
        <ErrorBox error={res.error} />
        {!res.data && res.loading && <Loading />}
        {res.data && res.data.length === 0 && <Empty>No adjustments.</Empty>}
        {res.data && res.data.length > 0 && (
          <Table
            head={["Requested", "Amount", "Account", "Against", "Reason", "Status", "Decision"]}
          >
            {res.data.map((a) => {
              const own = a.requestedById === me?.id;
              return (
                <tr key={a.id}>
                  <td className="whitespace-nowrap">
                    {formatDateTime(a.createdAt)}
                    <span className="block text-xs text-muted-foreground">
                      by {who(a.requestedById)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap tabular-nums">
                    <span className={a.direction === "CREDIT" ? "text-green-700" : "text-red-700"}>
                      {a.direction === "CREDIT" ? "+" : "−"}
                      {formatKobo(a.amountMinor)}
                    </span>
                    <span className="block text-xs text-muted-foreground">{a.direction}</span>
                  </td>
                  <td className="font-mono text-xs" title={a.accountId}>
                    {shortId(a.accountId)}
                  </td>
                  <td className="font-mono text-xs">
                    {a.counterLedgerCode}
                    {a.reconciliationId && (
                      <span className="block font-sans text-muted-foreground">
                        Exception {shortId(a.reconciliationId)}
                      </span>
                    )}
                  </td>
                  <td className="max-w-xs">{a.reason}</td>
                  <td>
                    <Badge>{a.status}</Badge>
                    {a.transactionId && (
                      <Link
                        href={`/dashboard/transactions/${a.transactionId}`}
                        className="block text-xs text-primary hover:underline"
                      >
                        Transaction
                      </Link>
                    )}
                  </td>
                  <td>
                    {a.status === "PENDING_APPROVAL" ? (
                      <div className="flex flex-col items-start gap-2">
                        {own && (
                          <span className="text-xs text-amber-800">
                            You requested this. Another FINANCE admin must decide it
                            (four-eyes).
                          </span>
                        )}
                        <div className="flex gap-2">
                          <ConfirmAction
                            label="Approve"
                            permission="decideAdjustment"
                            disabledReason={own ? "You cannot approve your own request (four-eyes)" : undefined}
                            variant="primary"
                            title="Approve adjustment"
                            description={
                              <>
                                Posts {a.direction === "CREDIT" ? "a credit" : "a debit"} of{" "}
                                <strong>{formatKobo(a.amountMinor)}</strong> to account{" "}
                                <span className="font-mono">{shortId(a.accountId)}</span> against{" "}
                                <span className="font-mono">{a.counterLedgerCode}</span>. The customer
                                will see it as an adjustment.
                              </>
                            }
                            textField={{ label: "Note (optional)", minLength: 0, maxLength: 500 }}
                            onConfirm={({ text }) =>
                              api.post(`/admin/adjustments/${a.id}/decision`, {
                                approve: true,
                                ...(text ? { note: text } : {}),
                              })
                            }
                            onDone={res.reload}
                          />
                          <ConfirmAction
                            label="Reject"
                            permission="decideAdjustment"
                            disabledReason={own ? "You cannot decide your own request (four-eyes)" : undefined}
                            danger
                            title="Reject adjustment"
                            description="Nothing is posted. The requester can raise a new one."
                            textField={{ label: "Note (optional)", minLength: 0, maxLength: 500 }}
                            onConfirm={({ text }) =>
                              api.post(`/admin/adjustments/${a.id}/decision`, {
                                approve: false,
                                ...(text ? { note: text } : {}),
                              })
                            }
                            onDone={res.reload}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(a.decidedAt)} by {who(a.decidedById)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
        {res.data && res.data.length >= 200 && (
          <div className="mt-3">
            <Notice>Showing the newest 200; the API does not page this list.</Notice>
          </div>
        )}
      </Card>
    </>
  );
}
