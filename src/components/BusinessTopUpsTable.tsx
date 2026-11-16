"use client";

import Link from "next/link";
import { api } from "../lib/api";
import { formatDateTime, shortId } from "../lib/format";
import { formatKobo } from "../lib/money";
import type { BusinessTopUp } from "../lib/types";
import { ConfirmAction } from "./ConfirmAction";
import { Badge, Table } from "./ui";

/**
 * Recorded business top-ups with approve/reject. The person who recorded a
 * top-up cannot decide it (four-eyes); approval credits the wallet.
 */
export function BusinessTopUpsTable({
  rows,
  meId,
  showBusiness,
  onChanged,
}: {
  rows: BusinessTopUp[];
  meId: string | undefined;
  /** Add a Business column (the cross-business queue). */
  showBusiness?: boolean;
  onChanged: () => void;
}) {
  const who = (id: string | null) =>
    !id ? "—" : id === meId ? "You" : shortId(id);

  const decide = (t: BusinessTopUp, approve: boolean, note: string) =>
    api.post(`/admin/businesses/top-ups/${t.id}/decide`, {
      approve,
      ...(note ? { note } : {}),
    });

  return (
    <Table
      head={[
        "Recorded",
        ...(showBusiness ? ["Business"] : []),
        "Amount",
        "Bank reference",
        "Note",
        "Status",
        "Decision",
      ]}
    >
      {rows.map((t) => {
        const own = t.requestedById === meId;
        const name = t.business?.name ?? shortId(t.businessId);
        return (
          <tr key={t.id}>
            <td className="whitespace-nowrap">
              {formatDateTime(t.createdAt)}
              <span className="block text-xs text-muted">
                by {who(t.requestedById)}
              </span>
            </td>
            {showBusiness && (
              <td>
                <Link
                  href={`/dashboard/businesses/${t.businessId}`}
                  className="text-primary-soft hover:underline"
                >
                  {name}
                </Link>
              </td>
            )}
            <td className="whitespace-nowrap tabular-nums text-success">
              +{formatKobo(t.amountMinor)}
            </td>
            <td className="font-mono text-xs">{t.bankReference}</td>
            <td className="max-w-xs">{t.note ?? "—"}</td>
            <td>
              <Badge>{t.status}</Badge>
              {t.transactionId && (
                <Link
                  href={`/dashboard/transactions/${t.transactionId}`}
                  className="block text-xs text-primary-soft hover:underline"
                >
                  Transaction
                </Link>
              )}
            </td>
            <td>
              {t.status === "PENDING_APPROVAL" ? (
                <div className="flex flex-col items-start gap-2">
                  {own && (
                    <span className="text-xs text-warning">
                      You recorded this. Another FINANCE admin must decide it
                      (four-eyes).
                    </span>
                  )}
                  <div className="flex gap-2">
                    <ConfirmAction
                      label="Approve"
                      permission="decideBusinessTopUp"
                      disabledReason={
                        own
                          ? "You cannot approve a top-up you recorded (four-eyes)"
                          : undefined
                      }
                      variant="primary"
                      title="Approve top-up"
                      description={
                        <>
                          Credits <strong>{formatKobo(t.amountMinor)}</strong>{" "}
                          to {name}&apos;s wallet. Check the bank statement
                          shows a transfer with reference{" "}
                          <span className="font-mono">{t.bankReference}</span>{" "}
                          for this amount first.
                        </>
                      }
                      textField={{
                        label: "Note (optional)",
                        minLength: 0,
                        maxLength: 500,
                      }}
                      onConfirm={({ text }) => decide(t, true, text)}
                      onDone={onChanged}
                    />
                    <ConfirmAction
                      label="Reject"
                      permission="decideBusinessTopUp"
                      disabledReason={
                        own
                          ? "You cannot decide a top-up you recorded (four-eyes)"
                          : undefined
                      }
                      danger
                      title="Reject top-up"
                      description="Nothing is credited. The bank reference stays used; a corrected top-up needs its own reference."
                      textField={{
                        label: "Note (optional)",
                        minLength: 0,
                        maxLength: 500,
                      }}
                      onConfirm={({ text }) => decide(t, false, text)}
                      onDone={onChanged}
                    />
                  </div>
                </div>
              ) : (
                <span className="text-xs text-muted">
                  {formatDateTime(t.decidedAt)} by {who(t.decidedById)}
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </Table>
  );
}
