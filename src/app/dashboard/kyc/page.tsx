"use client";

import { useState } from "react";
import Link from "next/link";
import { qs } from "../../../lib/api";
import { age, formatDateTime, humanize } from "../../../lib/format";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import {
  KYC_QUEUE_HINTS,
  KYC_QUEUE_STATUSES,
  type KycQueueItem,
  type KycQueueStatus,
  type Page,
} from "../../../lib/types";
import { CursorPager } from "../../../components/CursorPager";
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  Loading,
  PageHeader,
  Select,
} from "../../../components/ui";

const CUSTOMER_STATUSES = ["REGISTERED", "VERIFIED", "RESTRICTED", "CLOSED"];
const BRIDGE_STATUSES = ["PENDING", "REVIEW", "APPROVED", "REJECTED"];

const fullName = (i: KycQueueItem) =>
  [i.firstName, i.lastName].filter(Boolean).join(" ") || "(no name yet)";

function Queue({
  status,
  customerStatus,
  tier,
  bridgeStatus,
}: {
  status: KycQueueStatus;
  customerStatus: string;
  tier: string;
  bridgeStatus: string;
}) {
  const [stack, setStack] = useState<string[]>([]);
  const cursor = stack[stack.length - 1];
  const res = useResource<Page<KycQueueItem>>(
    `/admin/kyc${qs({ status, customerStatus, tier, bridgeStatus, cursor, limit: "25" })}`,
  );
  return (
    <Card flush>
      <div className="px-5 pt-4">
        <ErrorBox error={res.error} />
      </div>
      {!res.data && res.loading && <Loading />}
      {res.data && res.data.items.length === 0 && (
        <Empty>Nothing {humanize(status).toLowerCase()}.</Empty>
      )}
      {res.data && res.data.items.length > 0 && (
        <ul className="divide-y divide-surface-border">
          {res.data.items.map((i) => (
            <li key={i.id} className="fade-in">
              <Link
                href={`/dashboard/users/${i.id}`}
                className="block px-5 py-4 transition-colors hover:bg-surface-raised/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{fullName(i)}</p>
                    <p className="font-mono text-xs text-muted">{i.phoneNumber}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge>{i.status}</Badge>
                    <Badge tone="neutral">Tier {i.tier}</Badge>
                    <span
                      className="whitespace-nowrap text-xs text-muted"
                      title={formatDateTime(i.waitingSince)}
                    >
                      waiting {age(i.waitingSince)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {i.latestCheck ? (
                    <span className="flex items-center gap-2 rounded border border-surface-border px-2 py-1">
                      <span className="text-xs font-semibold text-foreground">
                        {i.latestCheck.checkType}
                      </span>
                      <Badge>{i.kycStatus}</Badge>
                      <span className="text-xs text-muted">{i.latestCheck.provider}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted">No identity check yet.</span>
                  )}
                  {i.bridgeKycStatus && (
                    <span className="flex items-center gap-2 rounded border border-surface-border px-2 py-1">
                      <span className="text-xs font-semibold text-foreground">Bridge</span>
                      <Badge>{i.bridgeKycStatus}</Badge>
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-surface-border px-5 pb-4">
        <CursorPager
          stack={stack}
          nextCursor={res.data?.nextCursor}
          onChange={setStack}
          busy={res.loading}
        />
      </div>
    </Card>
  );
}

/**
 * The identity-verification backlog, longest-waiting first (zemfi's KYC
 * page). A customer sits in the tab of their latest check; open one to see
 * every check and act on the account.
 */
export default function KycPage() {
  useDocumentTitle("KYC");
  const [status, setStatus] = useState<KycQueueStatus>("MANUAL_REVIEW");
  const [customerStatus, setCustomerStatus] = useState("");
  const [tier, setTier] = useState("");
  const [bridgeStatus, setBridgeStatus] = useState("");
  const counts = useResource<Record<string, number>>("/admin/kyc/counts");

  return (
    <>
      <PageHeader
        title="KYC"
        description="Customers by identity-verification status, longest waiting first."
      />

      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-surface-border">
        {KYC_QUEUE_STATUSES.map((tab) => {
          const active = tab === status;
          const count = counts.data?.[tab];
          return (
            <button
              key={tab}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setStatus(tab)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "border-primary text-primary-soft"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab === "NONE" ? "No check" : humanize(tab)}
              {count !== undefined && (
                <span className="ml-2 text-xs tabular-nums text-muted">{count}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mb-4 text-xs text-muted">{KYC_QUEUE_HINTS[status]}</p>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select
          label="Customer status"
          value={customerStatus}
          onChange={(e) => setCustomerStatus(e.target.value)}
          options={[
            { value: "", label: "Any" },
            ...CUSTOMER_STATUSES.map((s) => ({ value: s, label: humanize(s) })),
          ]}
        />
        <Select
          label="Tier"
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          options={[
            { value: "", label: "Any" },
            ...["0", "1", "2", "3"].map((t) => ({ value: t, label: `Tier ${t}` })),
          ]}
        />
        <Select
          label="Bridge KYC"
          value={bridgeStatus}
          onChange={(e) => setBridgeStatus(e.target.value)}
          options={[
            { value: "", label: "Any" },
            ...BRIDGE_STATUSES.map((s) => ({ value: s, label: humanize(s) })),
          ]}
        />
      </div>

      {/* Keyed so paging restarts when a filter changes. */}
      <Queue
        key={`${status}|${customerStatus}|${tier}|${bridgeStatus}`}
        status={status}
        customerStatus={customerStatus}
        tier={tier}
        bridgeStatus={bridgeStatus}
      />
    </>
  );
}
