"use client";

import { useState } from "react";
import Link from "next/link";
import { qs } from "../../../../lib/api";
import { requiredHint, useAdmin, can } from "../../../../lib/access";
import { humanize } from "../../../../lib/format";
import { useDocumentTitle } from "../../../../lib/useDocumentTitle";
import { useResource } from "../../../../lib/useResource";
import type { BusinessTopUp } from "../../../../lib/types";
import { BusinessTopUpsTable } from "../../../../components/BusinessTopUpsTable";
import {
  Button,
  Card,
  Empty,
  ErrorBox,
  Loading,
  Notice,
  PageHeader,
} from "../../../../components/ui";

const TABS = ["PENDING_APPROVAL", "APPROVED", "REJECTED", ""] as const;

/**
 * Business wallet top-ups across every business. Staff record money a
 * business sent by bank transfer on the business's page; a different
 * FINANCE admin approves it here, which credits the wallet.
 */
export default function BusinessTopUpsPage() {
  useDocumentTitle("Business top-ups");
  const session = useAdmin();
  const me = session.status === "ready" ? session.me : null;
  const allowed = me ? can(me.roles, "viewBusinessTopUps") : false;
  const [status, setStatus] = useState<(typeof TABS)[number]>("PENDING_APPROVAL");
  const res = useResource<BusinessTopUp[]>(
    allowed ? `/admin/businesses/top-ups${qs({ status })}` : null,
  );

  return (
    <>
      <PageHeader
        title="Business top-ups"
        description="Money businesses sent to Vmonie by bank transfer. One person records it on the business's page; a different FINANCE admin approves it here, and only approval credits the wallet."
        actions={
          <>
            <Link
              href="/dashboard/businesses"
              className="text-sm text-primary-soft hover:underline"
            >
              All businesses
            </Link>
            {allowed && (
              <Button variant="secondary" busy={res.loading} onClick={res.reload}>
                Refresh
              </Button>
            )}
          </>
        }
      />
      {me && !allowed && <Notice>{requiredHint("viewBusinessTopUps")}.</Notice>}
      {allowed && (
        <>
          <div className="mb-3 flex flex-wrap gap-2" role="tablist">
            {TABS.map((s) => (
              <button
                key={s || "all"}
                role="tab"
                aria-selected={status === s}
                onClick={() => setStatus(s)}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  status === s
                    ? "bg-primary text-white"
                    : "border border-surface-border bg-surface"
                }`}
              >
                {s ? humanize(s) : "All"}
              </button>
            ))}
          </div>
          <Card>
            <ErrorBox error={res.error} />
            {!res.data && res.loading && <Loading />}
            {res.data && res.data.length === 0 && <Empty>No top-ups.</Empty>}
            {res.data && res.data.length > 0 && (
              <BusinessTopUpsTable
                rows={res.data}
                meId={me?.id}
                showBusiness
                onChanged={res.reload}
              />
            )}
            {res.data && res.data.length >= 200 && (
              <div className="mt-3">
                <Notice>Showing the newest 200; the API does not page this list.</Notice>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
