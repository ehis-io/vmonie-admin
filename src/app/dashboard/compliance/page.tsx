"use client";

import { useState } from "react";
import Link from "next/link";
import { api, qs } from "../../../lib/api";
import { formatDateTime, humanize, shortId } from "../../../lib/format";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import type {
  AmlScreening,
  ComplianceCustomer,
  ComplianceHold,
  ComplianceSummary,
  ScreeningHit,
} from "../../../lib/types";
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

const TABS = [
  { key: "review", label: "To review" },
  { key: "holds", label: "Held customers" },
  { key: "all", label: "All screenings" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const STATUS_FILTERS = ["", "POTENTIAL_MATCH", "FAILED", "CLEAR"] as const;

/** The backend wants at least 10 characters: the note is the audit of why. */
const NOTE = {
  label: "Note (kept for audit, never shown to the customer)",
  minLength: 10,
  maxLength: 1000,
};

const customerName = (c: ComplianceCustomer) =>
  [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phoneNumber;

const list = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v.join(", ") : (v ?? "");

function CustomerLink({ customer }: { customer: ComplianceCustomer }) {
  return (
    <Link
      href={`/dashboard/users/${customer.id}`}
      className="font-medium text-primary-soft hover:underline"
    >
      {customerName(customer)}
    </Link>
  );
}

/** What the provider matched on, so the officer can compare it to the customer. */
function Hits({ hits }: { hits: ScreeningHit[] | null }) {
  if (!hits || hits.length === 0) {
    return (
      <span className="text-xs text-muted">
        The provider gave no detail. Treat it as unresolved.
      </span>
    );
  }
  return (
    <ul className="space-y-1 text-xs">
      {hits.slice(0, 8).map((h, i) => (
        <li key={i}>
          <span className="font-medium">{h.sourceType ?? "Result"}</span>
          {h.name ? ` · ${list(h.name)}` : ""}
          {h.country ? ` · ${list(h.country)}` : ""}
          {h.dateOfBirth ? ` · born ${h.dateOfBirth}` : ""}
          {Array.isArray(h.positions) && h.positions.length > 0
            ? ` · ${h.positions.join(", ")}`
            : ""}
          {h.articles?.length
            ? ` · ${h.articles.length} article(s): ${h.articles[0]?.headline ?? ""}`
            : ""}
        </li>
      ))}
      {hits.length > 8 && (
        <li className="text-muted">and {hits.length - 8} more</li>
      )}
    </ul>
  );
}

function Tile({ label, value, alarm }: { label: string; value: number | undefined; alarm?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        alarm && value ? "border-danger/30 bg-danger/10" : "border-surface-border bg-surface"
      }`}
    >
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${alarm && value ? "text-danger" : ""}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}

export default function CompliancePage() {
  useDocumentTitle("Compliance");
  const [tab, setTab] = useState<Tab>("review");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("");

  const summary = useResource<ComplianceSummary>("/admin/compliance/summary");
  const queue = useResource<AmlScreening[]>(
    tab === "review"
      ? `/admin/compliance/screenings${qs({ status: "POTENTIAL_MATCH", review: "PENDING" })}`
      : null,
  );
  const holds = useResource<ComplianceHold[]>(
    tab === "holds" ? `/admin/compliance/holds${qs({ open: "true" })}` : null,
  );
  const all = useResource<AmlScreening[]>(
    tab === "all" ? `/admin/compliance/screenings${qs({ status: statusFilter })}` : null,
  );

  const refresh = () => {
    summary.reload();
    queue.reload();
    holds.reload();
    all.reload();
  };

  return (
    <>
      <PageHeader
        title="Compliance"
        description="PEP, sanctions and adverse-media screening, and the holds that pause a customer's transfers. Every decision needs a note and is audited. Never tell a customer why they are held."
      />

      <ErrorBox error={summary.error} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Matches to review" value={summary.data?.pendingReviews} alarm />
        <Tile label="Customers held" value={summary.data?.openHolds} alarm />
        <Tile label="Failed screenings (24 h)" value={summary.data?.failedLast24h} />
        <Tile label="Verified, never screened" value={summary.data?.neverScreened} />
      </div>
      {!!summary.data?.failedLast24h && (
        <div className="mb-4">
          <Notice>
            Some screenings failed in the last day. They are retried hourly. If
            this keeps happening, check the screening provider (an unfunded
            wallet looks like this).
          </Notice>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === t.key ? "bg-primary text-white" : "border border-surface-border bg-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "review" && (
        <Card>
          <ErrorBox error={queue.error} />
          {!queue.data && queue.loading && <Loading />}
          {queue.data && queue.data.length === 0 && <Empty>No matches waiting for review.</Empty>}
          {queue.data && queue.data.length > 0 && (
            <Table head={["Screened", "Customer", "Matched on", "Provider says", "Decision"]}>
              {queue.data.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap">
                    {formatDateTime(s.createdAt)}
                    <span className="block text-xs text-muted">{humanize(s.trigger)}</span>
                  </td>
                  <td>
                    <CustomerLink customer={s.customer} />
                    <span className="block text-xs text-muted">
                      Screened as {s.subjectName}
                    </span>
                  </td>
                  <td className="max-w-md">
                    <Hits hits={s.results} />
                  </td>
                  <td className="whitespace-nowrap">
                    <Badge tone="red">{s.matchStatus ?? "Unclear"}</Badge>
                    <span className="block text-xs text-muted">
                      Risk {s.riskLevel ?? "—"}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col items-start gap-2">
                      <ConfirmAction
                        label="False positive"
                        permission="manageCompliance"
                        variant="primary"
                        title="Not this customer"
                        description={
                          <>
                            Releases the hold on <strong>{customerName(s.customer)}</strong>. Say
                            what rules the match out, such as a different date of birth or
                            role.
                          </>
                        }
                        textField={{ ...NOTE, placeholder: "e.g. Customer born 1980; PEP profile born 1961" }}
                        confirmLabel="Release hold"
                        onConfirm={({ text }) =>
                          api.post(`/admin/compliance/screenings/${s.id}/review`, {
                            decision: "FALSE_POSITIVE",
                            note: text,
                          })
                        }
                        onDone={refresh}
                      />
                      <ConfirmAction
                        label="Confirmed match"
                        permission="manageCompliance"
                        danger
                        title="This is the customer"
                        description="The hold stays. For a PEP, start enhanced due diligence; for sanctions or serious adverse media, escalate and consider a report to the NFIU."
                        textField={NOTE}
                        confirmLabel="Keep hold"
                        onConfirm={({ text }) =>
                          api.post(`/admin/compliance/screenings/${s.id}/review`, {
                            decision: "CONFIRMED_MATCH",
                            note: text,
                          })
                        }
                        onDone={refresh}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === "holds" && (
        <Card>
          <ErrorBox error={holds.error} />
          {!holds.data && holds.loading && <Loading />}
          {holds.data && holds.data.length === 0 && <Empty>No customer is held.</Empty>}
          {holds.data && holds.data.length > 0 && (
            <Table head={["Since", "Customer", "Raised by", "Reason", ""]}>
              {holds.data.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap">{formatDateTime(h.createdAt)}</td>
                  <td>
                    <CustomerLink customer={h.customer} />
                  </td>
                  <td>
                    <Badge>{humanize(h.source)}</Badge>
                    {h.createdBy && (
                      <span className="block text-xs text-muted">
                        by {shortId(h.createdBy)}
                      </span>
                    )}
                  </td>
                  <td className="max-w-md">{h.reason}</td>
                  <td>
                    <ConfirmAction
                      label="Release"
                      permission="manageCompliance"
                      title="Release this hold"
                      description={
                        h.source === "SCREENING"
                          ? "A screening hold is normally released by reviewing the match as a false positive. Release it here only if that is not possible, and say why."
                          : "The customer will be able to send transfers again, unless another hold is open."
                      }
                      textField={NOTE}
                      confirmLabel="Release"
                      onConfirm={({ text }) =>
                        api.post(`/admin/compliance/holds/${h.id}/release`, { note: text })
                      }
                      onDone={refresh}
                    />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === "all" && (
        <Card
          actions={
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f || "all"}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded px-2 py-1 text-xs ${
                    statusFilter === f ? "bg-primary text-white" : "border border-surface-border"
                  }`}
                >
                  {f ? humanize(f) : "All"}
                </button>
              ))}
            </div>
          }
          title="Newest 100"
        >
          <ErrorBox error={all.error} />
          {!all.data && all.loading && <Loading />}
          {all.data && all.data.length === 0 && <Empty>No screenings.</Empty>}
          {all.data && all.data.length > 0 && (
            <Table head={["Screened", "Customer", "Result", "Review", "Provider"]}>
              {all.data.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap">
                    {formatDateTime(s.createdAt)}
                    <span className="block text-xs text-muted">{humanize(s.trigger)}</span>
                  </td>
                  <td>
                    <CustomerLink customer={s.customer} />
                  </td>
                  <td>
                    <Badge>{s.status}</Badge>
                    {s.error && (
                      <span className="block max-w-xs text-xs text-muted">{s.error}</span>
                    )}
                  </td>
                  <td>
                    {s.status === "POTENTIAL_MATCH" ? (
                      <>
                        <Badge>{s.reviewStatus}</Badge>
                        {s.reviewNote && (
                          <span className="block max-w-xs text-xs text-muted">
                            {s.reviewNote}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="text-xs">{s.provider}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
