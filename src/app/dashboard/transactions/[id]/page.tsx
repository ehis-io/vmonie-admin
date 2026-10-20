"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "../../../../lib/api";
import { formatDateTime, humanize, maskAccount } from "../../../../lib/format";
import { formatKobo } from "../../../../lib/money";
import { useDocumentTitle } from "../../../../lib/useDocumentTitle";
import { useResource } from "../../../../lib/useResource";
import type { TransactionDetail } from "../../../../lib/types";
import { ConfirmAction } from "../../../../components/ConfirmAction";
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  Json,
  KeyValues,
  Loading,
  Notice,
  PageHeader,
  Table,
} from "../../../../components/ui";

const NOT_FINAL = ["CREATED", "SUBMITTED", "UNKNOWN", "NEEDS_REVIEW"];

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const res = useResource<TransactionDetail>(`/admin/transactions/${id}`);
  const t = res.data;
  useDocumentTitle(t ? t.reference : "Transaction");

  if (!t) return res.error ? <ErrorBox error={res.error} /> : <Loading />;

  const isTransfer = t.kind === "TRANSFER_OUT";
  const total = (BigInt(t.amountMinor) + BigInt(t.feeMinor)).toString();

  return (
    <>
      <PageHeader
        title={t.reference}
        description={
          <>
            {humanize(t.kind)} · {t.direction} · <Badge>{t.status}</Badge>
          </>
        }
        actions={
          isTransfer && (
            <>
              <ConfirmAction
                label="Requery"
                permission="requeryTransfer"
                title="Ask the bank for this transfer's status"
                description="Queries the partner for the current status and applies the answer. It never resends the transfer."
                confirmLabel="Requery"
                onConfirm={() => api.post(`/admin/transactions/${t.id}/requery`)}
                onDone={res.reload}
              />
              <ConfirmAction
                label="Resolve"
                permission="resolveTransfer"
                disabledReason={
                  t.status === "NEEDS_REVIEW"
                    ? undefined
                    : "Only transfers in NEEDS_REVIEW can be resolved by hand"
                }
                danger
                title="Resolve this transfer by hand"
                description={
                  <>
                    Settle {formatKobo(t.amountMinor)} to {t.counterpartyName} only after
                    checking the partner&apos;s records. <strong>Failed</strong> releases the
                    held funds back to the customer; <strong>Successful</strong> completes the
                    debit. Cite the partner&apos;s confirmation in the reason.
                  </>
                }
                choice={{
                  label: "Outcome",
                  options: [
                    { value: "SUCCESSFUL", label: "Successful: money reached the beneficiary" },
                    { value: "FAILED", label: "Failed: refund the customer" },
                  ],
                }}
                textField={{ label: "Reason", minLength: 10, maxLength: 500 }}
                onConfirm={({ text, choice }) =>
                  api.post(`/admin/transactions/${t.id}/resolve`, {
                    outcome: choice,
                    reason: text,
                  })
                }
                onDone={res.reload}
              />
            </>
          )
        }
      />
      <ErrorBox error={res.error} />
      {t.status === "NEEDS_REVIEW" && (
        <div className="mb-4">
          <Notice>
            The requery window ran out without a final answer. Funds stay held until this
            is resolved against the partner&apos;s records.
          </Notice>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Details">
          <KeyValues
            rows={[
              ["Amount", formatKobo(t.amountMinor)],
              ["Fee", formatKobo(t.feeMinor)],
              ["Total", formatKobo(total)],
              ["Narration", t.narration],
              [
                "Customer",
                t.customerId ? (
                  <Link
                    key="c"
                    href={`/dashboard/customers/${t.customerId}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {t.customerId}
                  </Link>
                ) : (
                  "—"
                ),
              ],
              ["Failure reason", t.failureReason],
              [
                "Original transaction",
                t.originalId ? (
                  <Link
                    key="o"
                    href={`/dashboard/transactions/${t.originalId}`}
                    className="text-primary hover:underline"
                  >
                    {t.originalId}
                  </Link>
                ) : (
                  "—"
                ),
              ],
              ["Created", formatDateTime(t.createdAt)],
              ["Submitted", formatDateTime(t.submittedAt)],
              ["Completed", formatDateTime(t.completedAt)],
            ]}
          />
        </Card>
        <Card title="Counterparty and provider">
          <KeyValues
            rows={[
              ["Name", t.counterpartyName],
              ["Bank", `${t.counterpartyBank ?? "—"} ${t.counterpartyBankCode ? `(${t.counterpartyBankCode})` : ""}`],
              ["Account", <span key="a" className="font-mono">{maskAccount(t.counterpartyAccount)}</span>],
              ["Provider", t.providerCode],
              ["Provider reference", <span key="p" className="font-mono text-xs">{t.providerReference ?? "—"}</span>],
              ["Status checks", t.statusChecks],
              [
                "Next status check",
                NOT_FINAL.includes(t.status) ? formatDateTime(t.nextStatusCheckAt) : "—",
              ],
            ]}
          />
        </Card>
      </div>

      <Card title="Event timeline" className="mt-4">
        {t.events.length === 0 ? (
          <Empty>No events.</Empty>
        ) : (
          <ol className="space-y-3">
            {t.events.map((e) => (
              <li key={e.id} className="border-l-2 border-border pl-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {e.fromStatus && (
                    <>
                      <Badge>{e.fromStatus}</Badge>
                      <span aria-hidden>→</span>
                    </>
                  )}
                  <Badge>{e.toStatus}</Badge>
                  <span className="text-xs text-muted-foreground">
                    via {e.source} · {formatDateTime(e.createdAt)}
                  </span>
                </div>
                {e.detail !== null && e.detail !== undefined && (
                  <div className="mt-1">
                    <Json value={e.detail} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title="Ledger journals" className="mt-4">
        {t.journals.length === 0 ? (
          <Empty>Nothing posted to the ledger for this transaction.</Empty>
        ) : (
          <div className="space-y-4">
            {t.journals.map((j) => (
              <div key={j.id}>
                <p className="text-sm font-medium">{j.description}</p>
                <p className="mb-1 text-xs text-muted-foreground">
                  <span className="font-mono">{j.idempotencyKey}</span> ·{" "}
                  {formatDateTime(j.createdAt)}
                </p>
                <Table head={["Ledger account", "Debit", "Credit"]}>
                  {j.entries.map((en) => (
                    <tr key={en.id}>
                      <td className="font-mono text-xs">{en.ledgerAccount.code}</td>
                      <td className="tabular-nums">
                        {en.side === "DEBIT" ? formatKobo(en.amountMinor) : ""}
                      </td>
                      <td className="tabular-nums">
                        {en.side === "CREDIT" ? formatKobo(en.amountMinor) : ""}
                      </td>
                    </tr>
                  ))}
                </Table>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
