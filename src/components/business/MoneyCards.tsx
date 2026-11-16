"use client";

import { useState } from "react";
import Link from "next/link";
import { api, qs } from "../../lib/api";
import { requiredHint, useCan } from "../../lib/access";
import { formatDateTime, humanize } from "../../lib/format";
import { formatKobo, formatMinor, parseNairaToKobo } from "../../lib/money";
import { useResource } from "../../lib/useResource";
import {
  BILL_TYPES,
  MAX_DISCOUNT_BPS,
  type BillType,
  type BusinessDetail,
  type BusinessTopUp,
  type BusinessTransaction,
} from "../../lib/types";
import { BusinessTopUpsTable } from "../BusinessTopUpsTable";
import { ConfirmAction } from "../ConfirmAction";
import { CursorPager } from "../CursorPager";
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  Loading,
  Notice,
  Table,
  TextInput,
} from "../ui";

// ─── Discounts ────────────────────────────────────────────────────────────

/** 125 → "1.25%". Integer arithmetic, no float rounding. */
export function bpsToPercent(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const frac = (bps % 100).toString().padStart(2, "0").replace(/0+$/, "");
  return `${whole}${frac ? `.${frac}` : ""}%`;
}

const parseBps = (v: string): number | null =>
  /^\d{1,4}$/.test(v.trim()) && Number(v) <= MAX_DISCOUNT_BPS ? Number(v) : null;

export function DiscountsCard({
  business,
  onChanged,
}: {
  business: BusinessDetail;
  onChanged: () => void;
}) {
  const currentOf = (t: BillType) =>
    business.discounts.find((d) => d.billType === t)?.discountBps ?? 0;
  const [drafts, setDrafts] = useState<Record<BillType, string>>(() => {
    const init = {} as Record<BillType, string>;
    for (const t of BILL_TYPES) init[t] = String(currentOf(t));
    return init;
  });
  const canEdit = useCan("setBusinessDiscount");

  return (
    <Card title="Discounts">
      <p className="mb-4 text-sm text-muted">
        A discount is a share of Vmonie&apos;s markup, set in basis points of
        the bill&apos;s face value (100 bps = 1%, at most {MAX_DISCOUNT_BPS} bps).
        It is capped at Vmonie&apos;s own markup on each bill, so a bill is never
        sold below cost (face value plus the provider&apos;s fee). A bill whose
        fee has no known split gets no discount.
      </p>
      <Table head={["Bill type", "Current", "New (bps)", ""]}>
        {BILL_TYPES.map((t) => {
          const current = currentOf(t);
          const bps = parseBps(drafts[t]);
          return (
            <tr key={t}>
              <td className="whitespace-nowrap">{humanize(t)}</td>
              <td className="whitespace-nowrap tabular-nums">
                {current} bps
                <span className="block text-xs text-muted">
                  {bpsToPercent(current)} of face value
                </span>
              </td>
              <td>
                <TextInput
                  aria-label={`${humanize(t)} discount in basis points`}
                  inputMode="numeric"
                  value={drafts[t]}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [t]: e.target.value }))
                  }
                  disabled={!canEdit}
                  className="w-28"
                />
                <span className="mt-1 block text-xs text-muted">
                  {bps === null
                    ? `Whole number, 0–${MAX_DISCOUNT_BPS}`
                    : `= ${bpsToPercent(bps)}`}
                </span>
              </td>
              <td className="text-right">
                <ConfirmAction
                  label="Save"
                  permission="setBusinessDiscount"
                  disabledReason={
                    bps === null
                      ? `Enter a whole number from 0 to ${MAX_DISCOUNT_BPS}`
                      : bps === current
                        ? "No changes"
                        : undefined
                  }
                  variant="primary"
                  title={`${humanize(t)} discount`}
                  description={
                    <>
                      From <strong>{current} bps</strong> ({bpsToPercent(current)})
                      to <strong>{bps ?? 0} bps</strong> ({bpsToPercent(bps ?? 0)})
                      of face value, capped at Vmonie&apos;s markup on each bill.
                      Applies to {business.name}&apos;s next{" "}
                      {humanize(t).toLowerCase()} purchase.
                    </>
                  }
                  onConfirm={() =>
                    api.put(`/admin/businesses/${business.id}/discounts`, {
                      billType: t,
                      discountBps: bps,
                    })
                  }
                  onDone={onChanged}
                />
              </td>
            </tr>
          );
        })}
      </Table>
    </Card>
  );
}

// ─── Top-ups ──────────────────────────────────────────────────────────────

export function TopUpsCard({
  business,
  meId,
  onChanged,
}: {
  business: BusinessDetail;
  meId: string | undefined;
  /** The wallet balance may have changed. */
  onChanged: () => void;
}) {
  const canView = useCan("viewBusinessTopUps");
  const canRecord = useCan("recordBusinessTopUp");
  const list = useResource<BusinessTopUp[]>(
    canView ? `/admin/businesses/top-ups${qs({ businessId: business.id })}` : null,
  );
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const parsed = parseNairaToKobo(amount);
  const ref = reference.trim();
  const fundable = business.status === "ACTIVE" || business.status === "SUSPENDED";

  const changed = () => {
    list.reload();
    onChanged();
  };

  return (
    <Card title="Top-ups">
      <p className="mb-4 text-sm text-muted">
        Record money the business sent to Vmonie&apos;s bank account. Recording
        credits nothing: a different FINANCE admin approves it, and approval
        credits the wallet. Each bank reference can be recorded once.
      </p>
      {canRecord ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr_auto] sm:items-start">
          <div>
            <TextInput
              label="Amount (naira)"
              inputMode="decimal"
              placeholder="e.g. 500000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!fundable}
            />
            {amount && (
              <span
                className={`mt-1 block text-xs ${parsed.ok ? "text-muted" : "text-danger"}`}
              >
                {parsed.ok ? formatKobo(parsed.kobo) : parsed.error}
              </span>
            )}
          </div>
          <TextInput
            label="Bank reference"
            placeholder="Transfer reference or session id"
            value={reference}
            maxLength={100}
            onChange={(e) => setReference(e.target.value)}
            disabled={!fundable}
          />
          <div className="sm:pt-5">
            <ConfirmAction
              label="Record top-up"
              permission="recordBusinessTopUp"
              disabledReason={
                !fundable
                  ? `Cannot fund a ${business.status.toLowerCase()} business`
                  : !parsed.ok
                    ? parsed.error
                    : ref.length < 4
                      ? "Enter the bank reference (at least 4 characters)"
                      : undefined
              }
              variant="primary"
              size="md"
              title="Record top-up"
              description={
                parsed.ok && (
                  <>
                    Records <strong>{formatKobo(parsed.kobo)}</strong> received
                    from {business.name} with bank reference{" "}
                    <span className="font-mono">{ref}</span>. Nothing is credited
                    until another FINANCE admin approves it.
                  </>
                )
              }
              textField={{ label: "Note (optional)", minLength: 0, maxLength: 500 }}
              onConfirm={({ text }) =>
                parsed.ok
                  ? api.post(`/admin/businesses/${business.id}/top-ups`, {
                      amountMinor: parsed.kobo,
                      bankReference: ref,
                      ...(text ? { note: text } : {}),
                    })
                  : Promise.reject(new Error(parsed.error))
              }
              onDone={() => {
                setAmount("");
                setReference("");
                changed();
              }}
            />
          </div>
        </div>
      ) : (
        <p className="mb-4 text-xs text-muted">
          Recording a top-up: {requiredHint("recordBusinessTopUp").toLowerCase()}.
        </p>
      )}
      {canView ? (
        <>
          <ErrorBox error={list.error} />
          {!list.data && list.loading && <Loading />}
          {list.data && list.data.length === 0 && <Empty>No top-ups yet.</Empty>}
          {list.data && list.data.length > 0 && (
            <BusinessTopUpsTable rows={list.data} meId={meId} onChanged={changed} />
          )}
        </>
      ) : (
        <Notice>Seeing top-ups: {requiredHint("viewBusinessTopUps").toLowerCase()}.</Notice>
      )}
    </Card>
  );
}

// ─── Transactions ─────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export function BusinessTransactionsCard({ businessId }: { businessId: string }) {
  const [stack, setStack] = useState<string[]>([]);
  const cursor = stack[stack.length - 1];
  const res = useResource<BusinessTransaction[]>(
    `/admin/businesses/${businessId}/transactions${qs({ cursor })}`,
  );
  const rows = res.data;
  const nextCursor =
    rows && rows.length >= PAGE_SIZE ? rows[rows.length - 1].id : null;

  return (
    <Card
      title="Transactions"
      actions={
        <button
          type="button"
          className="text-sm text-primary-soft hover:underline"
          onClick={res.reload}
        >
          Refresh
        </button>
      }
    >
      <ErrorBox error={res.error} />
      {!rows && res.loading && <Loading />}
      {rows && rows.length === 0 && <Empty>No transactions yet.</Empty>}
      {rows && rows.length > 0 && (
        <Table head={["Reference", "Kind", "Status", "Amount", "Fee", "Bill", "Created"]}>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>
                <Link
                  href={`/dashboard/transactions/${t.id}`}
                  className="font-mono text-xs text-primary-soft hover:underline"
                >
                  {t.reference}
                </Link>
                {t.narration && (
                  <span className="block text-xs text-muted">{t.narration}</span>
                )}
              </td>
              <td className="whitespace-nowrap">
                {humanize(t.kind)}
                <span className="block text-xs text-muted">{t.direction}</span>
              </td>
              <td>
                <Badge>{t.status}</Badge>
                {t.failureReason && (
                  <span className="block max-w-xs text-xs text-danger">
                    {t.failureReason}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap tabular-nums">
                <span className={t.direction === "CREDIT" ? "text-success" : ""}>
                  {t.direction === "CREDIT" ? "+" : "−"}
                  {formatMinor(t.amountMinor, t.currency)}
                </span>
              </td>
              <td className="whitespace-nowrap tabular-nums">
                {t.feeMinor === "0" ? "—" : formatMinor(t.feeMinor, t.currency)}
                {t.bill?.discountMinor && t.bill.discountMinor !== "0" && (
                  <span className="block text-xs text-muted">
                    after {formatMinor(t.bill.discountMinor, t.currency)} discount
                  </span>
                )}
              </td>
              <td>
                {t.bill ? (
                  <>
                    {t.bill.billerName}
                    <span className="block text-xs text-muted">
                      {[humanize(t.bill.type), t.bill.productName, t.bill.customerIdentifier]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </>
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
        nextCursor={nextCursor}
        onChange={setStack}
        busy={res.loading}
      />
    </Card>
  );
}
