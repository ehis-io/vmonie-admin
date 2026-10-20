"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, qs } from "../../../../lib/api";
import { useCan } from "../../../../lib/access";
import { shortId } from "../../../../lib/format";
import { formatKobo, koboToNairaInput, parseNairaToKobo } from "../../../../lib/money";
import { useDocumentTitle } from "../../../../lib/useDocumentTitle";
import { useResource } from "../../../../lib/useResource";
import type { CustomerSummary, Page } from "../../../../lib/types";
import { ConfirmAction } from "../../../../components/ConfirmAction";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Label,
  Loading,
  Notice,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from "../../../../components/ui";

interface Picked {
  accountId: string;
  accountNumber: string | null;
  customerName: string;
  customerId: string;
}

const nameOf = (c: CustomerSummary) =>
  [c.firstName, c.lastName].filter(Boolean).join(" ") || "(no name)";

/** Find a customer and choose one of their accounts. */
function AccountPicker({ onPick }: { onPick: (p: Picked) => void }) {
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState<string | null>(null);
  const res = useResource<Page<CustomerSummary>>(
    q === null ? null : `/admin/customers${qs({ q, limit: "10" })}`,
  );
  return (
    <div>
      <div className="flex items-end gap-2">
        <TextInput
          className="flex-1"
          label="Find the customer"
          placeholder="Phone, name, full account number or customer id"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setQ(draft.trim());
            }
          }}
        />
        <Button variant="secondary" onClick={() => setQ(draft.trim())}>
          Search
        </Button>
      </div>
      <div className="mt-2">
        <ErrorBox error={res.error} />
        {res.loading && <Loading what="Searching" />}
        {res.data && !res.loading && res.data.items.length === 0 && (
          <Empty>No customers match.</Empty>
        )}
        {res.data && !res.loading && res.data.items.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {res.data.items.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {nameOf(c)}{" "}
                  <span className="font-mono text-xs text-muted-foreground">{c.phoneNumber}</span>
                </span>
                <span className="flex flex-wrap gap-2">
                  {c.accounts.length === 0 && (
                    <span className="text-xs text-muted-foreground">No account</span>
                  )}
                  {c.accounts.map((a) => (
                    <Button
                      key={a.id}
                      size="sm"
                      variant="secondary"
                      disabled={!a.accountNumber}
                      title={a.accountNumber ? undefined : "This account has no number yet"}
                      onClick={() =>
                        onPick({
                          accountId: a.id,
                          accountNumber: a.accountNumber,
                          customerName: nameOf(c),
                          customerId: c.id,
                        })
                      }
                    >
                      <span className="font-mono">{a.accountNumber ?? "(pending)"}</span>
                      <Badge>{a.status}</Badge>
                    </Button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NewAdjustment() {
  useDocumentTitle("Request adjustment");
  const params = useSearchParams();
  const router = useRouter();
  const allowed = useCan("requestAdjustment");
  const reconciliationId = params.get("reconciliationId") ?? "";
  const prefillKobo = params.get("amountMinor");

  const [picked, setPicked] = useState<Picked | null>(null);
  const [direction, setDirection] = useState(params.get("direction") === "DEBIT" ? "DEBIT" : "CREDIT");
  const [counterLedger, setCounterLedger] = useState(
    params.get("counterLedger") === "OPERATIONAL_LOSS" ? "OPERATIONAL_LOSS" : "SUSPENSE",
  );
  const [amount, setAmount] = useState(koboToNairaInput(prefillKobo));
  const [reason, setReason] = useState(
    reconciliationId ? `Assign unmatched deposit (exception ${shortId(reconciliationId)}) to the customer: ` : "",
  );

  const parsed = parseNairaToKobo(amount);
  const reasonOk = reason.trim().length >= 10;
  const ready = !!picked && parsed.ok && reasonOk;

  return (
    <>
      <PageHeader
        title="Request adjustment"
        description="Creates a request only. A different FINANCE admin must approve it before anything posts."
      />
      {!allowed && (
        <div className="mb-4">
          <Notice>Requesting an adjustment needs the OPERATIONS or FINANCE role.</Notice>
        </div>
      )}
      {reconciliationId && (
        <div className="mb-4">
          <Notice tone="blue">
            For reconciliation exception <span className="font-mono">{reconciliationId}</span>.
            Approving the adjustment resolves the exception.
          </Notice>
        </div>
      )}
      <Card className="max-w-2xl">
        <div className="space-y-4">
          <div>
            <Label>Account</Label>
            {picked ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted px-3 py-2 text-sm">
                <span>
                  {picked.customerName} ·{" "}
                  <span className="font-mono">{picked.accountNumber}</span>{" "}
                  <span className="font-mono text-xs text-muted-foreground">({shortId(picked.accountId)})</span>
                </span>
                <Link
                  href={`/dashboard/customers/${picked.customerId}`}
                  target="_blank"
                  className="text-xs text-primary hover:underline"
                >
                  Open customer
                </Link>
                <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <AccountPicker onPick={setPicked} />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              options={[
                { value: "CREDIT", label: "Credit the customer (+)" },
                { value: "DEBIT", label: "Debit the customer (−)" },
              ]}
            />
            <Select
              label="Counter ledger"
              value={counterLedger}
              onChange={(e) => setCounterLedger(e.target.value)}
              options={[
                { value: "SUSPENSE", label: "SUSPENSE (unmatched funds)" },
                { value: "OPERATIONAL_LOSS", label: "OPERATIONAL_LOSS (refund / write-off)" },
              ]}
            />
          </div>
          <div>
            <TextInput
              label="Amount (₦)"
              inputMode="decimal"
              placeholder="5000.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className={`mt-1 text-xs ${amount && !parsed.ok ? "text-red-700" : "text-muted-foreground"}`}>
              {parsed.ok
                ? `${formatKobo(parsed.kobo)} (${parsed.kobo} kobo)`
                : amount
                  ? parsed.error
                  : "Naira, up to two decimal places"}
            </p>
          </div>
          <div>
            <TextArea
              label="Reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              At least 10 characters. Shown to the approver and kept in the audit log.
            </p>
          </div>
          <div className="flex gap-2">
            <ConfirmAction
              label="Submit request"
              permission="requestAdjustment"
              variant="primary"
              size="md"
              disabledReason={ready ? undefined : "Choose an account, a valid amount and a reason"}
              title="Submit adjustment request"
              description={
                picked && parsed.ok ? (
                  <>
                    Request a <strong>{direction.toLowerCase()}</strong> of{" "}
                    <strong>{formatKobo(parsed.kobo)}</strong> to {picked.customerName}{" "}
                    (<span className="font-mono">{picked.accountNumber}</span>) against{" "}
                    <span className="font-mono">{counterLedger}</span>. Nothing posts until
                    another FINANCE admin approves it.
                  </>
                ) : null
              }
              confirmLabel="Submit"
              onConfirm={() => {
                if (!picked || !parsed.ok) throw new Error("Form is incomplete");
                return api.post("/admin/adjustments", {
                  accountId: picked.accountId,
                  direction,
                  amountMinor: parsed.kobo,
                  counterLedger,
                  reason: reason.trim(),
                  ...(reconciliationId ? { reconciliationId } : {}),
                });
              }}
              onDone={() => router.push("/dashboard/adjustments")}
            />
            <Link
              href="/dashboard/adjustments"
              className="rounded-md border border-border px-3.5 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </Link>
          </div>
        </div>
      </Card>
    </>
  );
}

export default function NewAdjustmentPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewAdjustment />
    </Suspense>
  );
}
