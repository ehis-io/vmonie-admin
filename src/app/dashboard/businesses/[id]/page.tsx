"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "../../../../lib/api";
import { can, requiredHint, useAdmin } from "../../../../lib/access";
import { formatDateTime, shortId } from "../../../../lib/format";
import { formatKobo } from "../../../../lib/money";
import { useDocumentTitle } from "../../../../lib/useDocumentTitle";
import { useResource } from "../../../../lib/useResource";
import type { BusinessDetail } from "../../../../lib/types";
import { ConfirmAction } from "../../../../components/ConfirmAction";
import {
  ApiKeysCard,
  IpAllowlistCard,
  WebhookCard,
} from "../../../../components/business/AccessCards";
import { UsersCard } from "../../../../components/business/UsersCard";
import {
  BusinessTransactionsCard,
  DiscountsCard,
  TopUpsCard,
} from "../../../../components/business/MoneyCards";
import {
  Alert,
  Badge,
  Card,
  ErrorBox,
  KeyValues,
  Loading,
  Notice,
  PageHeader,
  StatTile,
} from "../../../../components/ui";

const REASON = { label: "Reason", minLength: 10, maxLength: 500 };

const setStatus = (id: string, status: "ACTIVE" | "SUSPENDED" | "CLOSED", reason: string) =>
  api.post(`/admin/businesses/${id}/status`, { status, reason });

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const session = useAdmin();
  const me = session.status === "ready" ? session.me : null;
  const allowed = me ? can(me.roles, "viewBusinesses") : false;
  const res = useResource<BusinessDetail>(allowed ? `/admin/businesses/${id}` : null);
  const b = res.data;
  useDocumentTitle(b ? b.name : "Business");

  const who = (adminId: string | null) =>
    !adminId ? "—" : adminId === me?.id ? "You" : shortId(adminId);

  if (me && !allowed) return <Notice>{requiredHint("viewBusinesses")}.</Notice>;
  if (!b) {
    return (
      <>
        <ErrorBox error={res.error} />
        {res.loading || !me ? <Loading /> : null}
      </>
    );
  }

  const ownCreation = b.createdById === me?.id;
  // Keyed by the saved values so these editors reset after each save. The
  // webhook card is not: it holds a one-time secret across the reload.
  const ipKey = b.ipAllowlist.join(",");
  const discountKey = b.discounts.map((d) => `${d.billType}:${d.discountBps}`).join(",");

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/dashboard/businesses" className="text-primary-soft hover:underline">
          ← Businesses
        </Link>
      </div>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {b.name} <Badge>{b.status}</Badge>
          </span>
        }
        description={`Business API account · created ${formatDateTime(b.createdAt)}`}
        actions={
          <>
            {b.status === "PENDING" && (
              <ConfirmAction
                label="Approve"
                permission="approveBusiness"
                disabledReason={
                  ownCreation
                    ? "You created this business; a different person must approve it (four-eyes)"
                    : undefined
                }
                variant="primary"
                size="md"
                title="Approve business"
                description={
                  <>
                    <strong>{b.name}</strong> becomes Active: its wallet opens, it
                    can be funded, and its API keys start working. Check its
                    registration and contact details first.
                  </>
                }
                onConfirm={() => api.post(`/admin/businesses/${b.id}/approve`)}
                onDone={res.reload}
              />
            )}
            {b.status === "ACTIVE" && (
              <ConfirmAction
                label="Suspend"
                permission="setBusinessStatus"
                danger
                size="md"
                title="Suspend business"
                description="Its API calls are refused until it is reactivated. The wallet balance is kept."
                textField={REASON}
                onConfirm={({ text }) => setStatus(b.id, "SUSPENDED", text)}
                onDone={res.reload}
              />
            )}
            {b.status === "SUSPENDED" && (
              <ConfirmAction
                label="Reactivate"
                permission="setBusinessStatus"
                variant="primary"
                size="md"
                title="Reactivate business"
                description="Its API keys work again."
                textField={REASON}
                onConfirm={({ text }) => setStatus(b.id, "ACTIVE", text)}
                onDone={res.reload}
              />
            )}
            {(b.status === "ACTIVE" || b.status === "SUSPENDED") && (
              <ConfirmAction
                label="Close"
                permission="setBusinessStatus"
                danger
                size="md"
                title="Close business"
                description={
                  <>
                    Its API calls are refused for good: a closed business cannot
                    be reopened or funded.
                    {b.balanceMinor !== "0" && (
                      <>
                        {" "}
                        Its wallet still holds{" "}
                        <strong>{formatKobo(b.balanceMinor)}</strong>; settle that
                        with the business separately.
                      </>
                    )}
                  </>
                }
                textField={REASON}
                onConfirm={({ text }) => setStatus(b.id, "CLOSED", text)}
                onDone={res.reload}
              />
            )}
          </>
        }
      />
      <ErrorBox error={res.error} />
      {b.status === "PENDING" && (
        <Alert tone="warning" className="mb-4">
          Waiting for approval by a COMPLIANCE admin other than the one who
          created it{ownCreation ? " (you)" : ""}. It cannot be funded or call the
          API until then.
        </Alert>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr]">
        <StatTile
          label="Wallet balance"
          value={formatKobo(b.balanceMinor)}
          hint="Prefunded; bills are paid from it."
        />
        <Card title="Details">
          <KeyValues
            rows={[
              ["RC number", b.rcNumber ?? "—"],
              ["Contact", b.contactName ?? "—"],
              ["Email", b.contactEmail],
              ["Phone", b.contactPhone ?? "—"],
              ["Created by", who(b.createdById)],
              [
                "Approved",
                b.approvedAt
                  ? `${formatDateTime(b.approvedAt)} by ${who(b.approvedById)}`
                  : "—",
              ],
              ["Business id", <span key="id" className="font-mono text-xs">{b.id}</span>],
            ]}
          />
        </Card>
      </div>

      <div className="space-y-4">
        <UsersCard business={b} />
        <ApiKeysCard business={b} onChanged={res.reload} />
        <div className="grid gap-4 xl:grid-cols-2">
          <IpAllowlistCard key={ipKey} business={b} onChanged={res.reload} />
          <DiscountsCard key={discountKey} business={b} onChanged={res.reload} />
        </div>
        <WebhookCard business={b} onChanged={res.reload} />
        <TopUpsCard business={b} meId={me?.id} onChanged={res.reload} />
        <BusinessTransactionsCard businessId={b.id} />
      </div>
    </>
  );
}
