"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, describeError } from "../../../../lib/api";
import { can, requiredHint, useAdmin } from "../../../../lib/access";
import { formatDateTime, humanize, shortId } from "../../../../lib/format";
import { useDocumentTitle } from "../../../../lib/useDocumentTitle";
import { useResource } from "../../../../lib/useResource";
import { SUPPORT_STATUSES, type SupportCaseDetail } from "../../../../lib/types";
import { ConfirmAction } from "../../../../components/ConfirmAction";
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Json,
  KeyValues,
  Loading,
  PageHeader,
  Select,
  TextArea,
} from "../../../../components/ui";

function Composer({
  caseId,
  allowed,
  onSent,
}: {
  caseId: string;
  allowed: boolean;
  onSent: () => void;
}) {
  const [message, setMessage] = useState("");
  const [internal, setInternal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const send = async () => {
    if (inFlight.current || !message.trim()) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/support/cases/${caseId}/updates`, {
        message: message.trim(),
        internal: true,
      });
      setMessage("");
      onSent();
    } catch (err) {
      setError(describeError(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm" role="radiogroup" aria-label="Message type">
        <label className="flex items-center gap-2">
          <input type="radio" checked={internal} onChange={() => setInternal(true)} disabled={busy} />
          Internal note (staff only)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={!internal} onChange={() => setInternal(false)} disabled={busy} />
          Reply to customer
        </label>
      </div>
      <TextArea
        label={internal ? "Internal note" : "Reply (the customer will see this)"}
        value={message}
        maxLength={2000}
        rows={4}
        disabled={busy || !allowed}
        onChange={(e) => setMessage(e.target.value)}
        className={internal ? "[&_textarea]:bg-warning/10" : ""}
      />
      <ErrorBox error={error} />
      {internal ? (
        <Button
          onClick={send}
          busy={busy}
          disabled={!allowed || !message.trim()}
          title={allowed ? undefined : requiredHint("updateSupportCase")}
        >
          Add internal note
        </Button>
      ) : (
        // A customer-visible message cannot be taken back: confirm it.
        <ConfirmAction
          label="Send reply"
          permission="updateSupportCase"
          variant="primary"
          size="md"
          disabledReason={message.trim() ? undefined : "Write a message first"}
          title="Send reply to the customer"
          description={
            <span className="block whitespace-pre-wrap rounded bg-surface-raised p-2 text-foreground">
              {message.trim()}
            </span>
          }
          confirmLabel="Send"
          onConfirm={() =>
            api.post(`/admin/support/cases/${caseId}/updates`, {
              message: message.trim(),
              internal: false,
            })
          }
          onDone={() => {
            setMessage("");
            onSent();
          }}
        />
      )}
    </div>
  );
}

export default function SupportCasePage() {
  const { id } = useParams<{ id: string }>();
  const session = useAdmin();
  const me = session.status === "ready" ? session.me : null;
  const res = useResource<SupportCaseDetail>(`/admin/support/cases/${id}`);
  const c = res.data;
  const [newStatus, setNewStatus] = useState("");
  useDocumentTitle(c ? c.reference : "Support case");

  if (!c) return res.error ? <ErrorBox error={res.error} /> : <Loading />;

  const allowed = !!me && can(me.roles, "updateSupportCase");
  const assignedToMe = !!me && c.assignedToId === me.id;
  const customerName =
    [c.customer.firstName, c.customer.lastName].filter(Boolean).join(" ") || "Customer";

  return (
    <>
      <PageHeader
        title={`${c.reference}: ${c.subject}`}
        description={
          <>
            {humanize(c.type)} · <Badge>{c.status}</Badge> · opened{" "}
            {formatDateTime(c.createdAt)}
          </>
        }
        actions={
          <ConfirmAction
            label={assignedToMe ? "Assigned to you" : "Assign to me"}
            permission="updateSupportCase"
            disabledReason={assignedToMe ? "Already assigned to you" : undefined}
            title="Assign this case to yourself"
            description={
              c.assignedToId
                ? `It is currently assigned to ${shortId(c.assignedToId)}.`
                : "It is currently unassigned."
            }
            confirmLabel="Assign to me"
            onConfirm={() =>
              api.post(`/admin/support/cases/${c.id}/updates`, {
                assignToSelf: true,
              })
            }
            onDone={res.reload}
          />
        }
      />
      <ErrorBox error={res.error} />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card title="Thread">
            <ol className="space-y-3">
              {c.events.map((e) => {
                const statusChange = e.toStatus && (
                  <p className="text-xs text-muted">
                    Status {e.fromStatus ? humanize(e.fromStatus) : "—"} →{" "}
                    <strong>{humanize(e.toStatus)}</strong>
                  </p>
                );
                return (
                  <li
                    key={e.id}
                    className={`rounded-lg border p-3 ${
                      e.internal
                        ? "border-warning/30 bg-warning/10"
                        : e.actorType === "CUSTOMER"
                          ? "border-surface-border bg-surface"
                          : "border-teal-200 bg-teal-50"
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="font-semibold text-foreground">
                        {e.actorType === "CUSTOMER"
                          ? customerName
                          : e.actorType === "ADMIN"
                            ? e.actorId === me?.id
                              ? "You"
                              : `Staff ${shortId(e.actorId)}`
                            : "System"}
                      </span>
                      {e.internal && <Badge tone="amber">Internal note</Badge>}
                      <span>{formatDateTime(e.createdAt)}</span>
                    </div>
                    {e.message && <p className="whitespace-pre-wrap text-sm">{e.message}</p>}
                    {statusChange}
                  </li>
                );
              })}
            </ol>
          </Card>
          <Card title="Respond">
            <Composer caseId={c.id} allowed={allowed} onSent={res.reload} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Case">
            <KeyValues
              rows={[
                [
                  "Customer",
                  <Link
                    key="c"
                    href={`/dashboard/users/${c.customerId}`}
                    className="text-primary-soft hover:underline"
                  >
                    {customerName}
                  </Link>,
                ],
                ["Phone", <span key="p" className="font-mono">{c.customer.phoneNumber}</span>],
                [
                  "Transaction",
                  c.transactionId ? (
                    <Link
                      key="t"
                      href={`/dashboard/transactions/${c.transactionId}`}
                      className="text-primary-soft hover:underline"
                    >
                      {shortId(c.transactionId)}
                    </Link>
                  ) : (
                    "—"
                  ),
                ],
                ["Assigned to", !c.assignedToId ? "Unassigned" : assignedToMe ? "You" : shortId(c.assignedToId)],
                ["Updated", formatDateTime(c.updatedAt)],
              ]}
            />
            {c.details !== null && c.details !== undefined && (
              <div className="mt-3">
                <p className="mb-1 text-xs uppercase text-muted">Customer details</p>
                <Json value={c.details} />
              </div>
            )}
          </Card>
          <Card title="Change status">
            <div className="space-y-3">
              <Select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                options={[
                  { value: "", label: "Choose a status…" },
                  ...SUPPORT_STATUSES.filter((s) => s !== c.status).map((s) => ({
                    value: s,
                    label: humanize(s),
                  })),
                ]}
              />
              <ConfirmAction
                label="Change status"
                permission="updateSupportCase"
                disabledReason={newStatus ? undefined : "Choose a status"}
                title={`Move case to ${humanize(newStatus)}`}
                description="The customer is notified and sees the status change in their thread. The note below is internal and is not shown to them."
                textField={{ label: "Internal note (optional)", minLength: 0, maxLength: 2000 }}
                confirmLabel="Change status"
                onConfirm={({ text }) =>
                  api.post(`/admin/support/cases/${c.id}/updates`, {
                    status: newStatus,
                    ...(text ? { message: text, internal: true } : {}),
                  })
                }
                onDone={() => {
                  setNewStatus("");
                  res.reload();
                }}
              />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
