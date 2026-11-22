"use client";

import { useState } from "react";
import { api, qs } from "../../../lib/api";
import { can, requiredHint, useAdmin } from "../../../lib/access";
import { formatDateTime, humanize } from "../../../lib/format";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import type { SalesLead, SalesLeadStatus } from "../../../lib/types";
import { CursorPager } from "../../../components/CursorPager";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Loading,
  Notice,
  PageHeader,
  Select,
  TextArea,
} from "../../../components/ui";

const STATUSES: SalesLeadStatus[] = ["NEW", "CONTACTED", "ONBOARDED", "NOT_A_FIT"];

const INTEREST: Record<string, string> = {
  BILLS: "Bills",
  VIRTUAL_ACCOUNTS: "Virtual accounts",
};
const VOLUME: Record<string, string> = {
  UNDER_1M: "Under ₦1m / month",
  "1M_10M": "₦1m – ₦10m / month",
  "10M_50M": "₦10m – ₦50m / month",
  "50M_PLUS": "Over ₦50m / month",
};

interface LeadPage {
  items: SalesLead[];
  nextCursor: string | null;
  counts: Partial<Record<SalesLeadStatus, number>>;
}

/**
 * "Talk to sales" enquiries from the business dashboard's sign-in page.
 * Each is also emailed to sales; here they are worked: contacted, onboarded
 * (create the business under Businesses), or closed as not a fit.
 */
export default function SalesLeadsPage() {
  useDocumentTitle("Sales leads");
  const session = useAdmin();
  const me = session.status === "ready" ? session.me : null;
  const allowed = me ? can(me.roles, "viewSalesLeads") : false;
  const canWork = me ? can(me.roles, "workSalesLeads") : false;
  const [status, setStatus] = useState<SalesLeadStatus | "">("NEW");
  const [stack, setStack] = useState<string[]>([]);
  const cursor = stack[stack.length - 1];
  const res = useResource<LeadPage>(
    allowed ? `/admin/sales-leads${qs({ status, cursor })}` : null,
  );

  return (
    <>
      <PageHeader
        title="Sales leads"
        description="Businesses that asked to talk to sales from the Vmonie Business sign-in page. Each is also emailed to sales@vmonieweb.com."
        actions={
          allowed && (
            <Button variant="secondary" busy={res.loading} onClick={res.reload}>
              Refresh
            </Button>
          )
        }
      />
      {me && !allowed && <Notice>{requiredHint("viewSalesLeads")}.</Notice>}
      {allowed && (
        <>
          <div className="mb-3 flex flex-wrap gap-2" role="tablist">
            {[...STATUSES, "" as const].map((s) => (
              <button
                key={s || "all"}
                role="tab"
                aria-selected={status === s}
                onClick={() => {
                  setStatus(s);
                  setStack([]);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  status === s
                    ? "bg-primary text-white"
                    : "border border-surface-border bg-surface"
                }`}
              >
                {s ? humanize(s) : "All"}
                {s && res.data?.counts[s] ? ` (${res.data.counts[s]})` : ""}
              </button>
            ))}
          </div>
          <ErrorBox error={res.error} />
          {res.loading && !res.data ? (
            <Loading />
          ) : res.data?.items.length ? (
            <div className="space-y-4">
              {res.data.items.map((lead) => (
                <LeadCard key={lead.id} lead={lead} canWork={canWork} onSaved={res.reload} />
              ))}
            </div>
          ) : (
            !res.error && <Empty>No {status ? humanize(status).toLowerCase() : ""} leads.</Empty>
          )}
          <CursorPager
            stack={stack}
            nextCursor={res.data?.nextCursor ?? null}
            onChange={setStack}
            busy={res.loading}
          />
        </>
      )}
    </>
  );
}

function LeadCard({
  lead,
  canWork,
  onSaved,
}: {
  lead: SalesLead;
  canWork: boolean;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<SalesLeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const dirty = status !== lead.status || notes !== (lead.notes ?? "");

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/admin/sales-leads/${lead.id}`, {
        ...(status !== lead.status ? { status } : {}),
        ...(notes !== (lead.notes ?? "") ? { notes: notes.trim() || null } : {}),
      });
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const website = lead.website
    ? /^https?:\/\//i.test(lead.website)
      ? lead.website
      : `https://${lead.website}`
    : null;

  return (
    <Card
      title={
        <span>
          {lead.businessName}{" "}
          <span className="text-sm font-normal text-muted">· {formatDateTime(lead.createdAt)}</span>
        </span>
      }
      actions={<Badge>{lead.status}</Badge>}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Contact</dt>
          <dd>{lead.contactName}</dd>
          <dt className="text-muted">Email</dt>
          <dd>
            <a href={`mailto:${encodeURIComponent(lead.email)}`} className="text-primary-soft hover:underline">
              {lead.email}
            </a>
          </dd>
          <dt className="text-muted">Phone</dt>
          <dd>
            {lead.phone ? (
              <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="text-primary-soft hover:underline">
                {lead.phone}
              </a>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-muted">Website</dt>
          <dd className="break-all">
            {website ? (
              <a href={website} target="_blank" rel="noopener noreferrer nofollow" className="text-primary-soft hover:underline">
                {lead.website}
              </a>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-muted">Wants</dt>
          <dd>{lead.interests.map((i) => INTEREST[i] ?? i).join(", ") || "—"}</dd>
          <dt className="text-muted">Volume</dt>
          <dd>{lead.monthlyVolume ? (VOLUME[lead.monthlyVolume] ?? lead.monthlyVolume) : "—"}</dd>
          {lead.message && (
            <>
              <dt className="text-muted">Message</dt>
              <dd className="whitespace-pre-wrap">{lead.message}</dd>
            </>
          )}
        </dl>
        <div className="space-y-3">
          <ErrorBox error={error} />
          <Select
            label="Status"
            value={status}
            disabled={!canWork}
            onChange={(e) => setStatus(e.target.value as SalesLeadStatus)}
            options={STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
          />
          <TextArea
            label="Notes"
            value={notes}
            disabled={!canWork}
            maxLength={4000}
            placeholder="Who called, what was agreed, next step…"
            onChange={(e) => setNotes(e.target.value)}
          />
          {canWork ? (
            <Button busy={busy} disabled={!dirty} onClick={save}>
              Save
            </Button>
          ) : (
            <p className="text-xs text-muted">{requiredHint("workSalesLeads")}.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
