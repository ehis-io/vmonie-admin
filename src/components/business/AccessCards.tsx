"use client";

import { useState } from "react";
import { api } from "../../lib/api";
import { useCan } from "../../lib/access";
import { formatDateTime, humanize } from "../../lib/format";
import { useResource } from "../../lib/useResource";
import type {
  BusinessDetail,
  BusinessWebhookDelivery,
  BusinessWebhookResult,
  CreatedBusinessKey,
} from "../../lib/types";
import { ConfirmAction } from "../ConfirmAction";
import { OneTimeSecret } from "../OneTimeSecret";
import {
  Alert,
  Badge,
  Card,
  Empty,
  ErrorBox,
  Loading,
  Mono,
  Table,
  TextArea,
  TextInput,
} from "../ui";

// ─── API keys ─────────────────────────────────────────────────────────────

export function ApiKeysCard({
  business,
  onChanged,
}: {
  business: BusinessDetail;
  onChanged: () => void;
}) {
  // The new key lives here only while its dialog is open.
  const [newKey, setNewKey] = useState<string | null>(null);
  const base = `/admin/businesses/${business.id}`;
  const closed = business.status === "CLOSED";
  const active = business.apiKeys.filter((k) => !k.revokedAt).length;

  return (
    <Card
      title={`API keys · ${active} active`}
      actions={
        <ConfirmAction
          label="New API key"
          permission="createBusinessKey"
          disabledReason={closed ? "The business is closed" : undefined}
          variant="primary"
          title="Issue a new API key"
          description="The full key is shown once, right after this. Existing keys keep working until you revoke them, so the business can switch over without downtime."
          textField={{
            label: "Label (optional)",
            minLength: 0,
            maxLength: 60,
            placeholder: "e.g. Production server",
          }}
          confirmLabel="Issue key"
          onConfirm={async ({ text }) => {
            const created = await api.post<CreatedBusinessKey>(`${base}/keys`, {
              ...(text ? { label: text } : {}),
            });
            setNewKey(created.key);
          }}
          onDone={onChanged}
        />
      }
    >
      {business.status === "PENDING" && (
        <Alert tone="info" className="mb-4">
          Keys can be issued now but the API refuses them until the business is
          approved.
        </Alert>
      )}
      {business.apiKeys.length === 0 ? (
        <Empty>No API keys yet.</Empty>
      ) : (
        <Table head={["Key", "Label", "Created", "Last used", "Status", ""]}>
          {business.apiKeys.map((k) => (
            <tr key={k.id}>
              <td>
                <Mono>{k.prefix}…</Mono>
              </td>
              <td>{k.label ?? "—"}</td>
              <td className="whitespace-nowrap">{formatDateTime(k.createdAt)}</td>
              <td className="whitespace-nowrap">
                {k.lastUsedAt ? formatDateTime(k.lastUsedAt) : "Never"}
              </td>
              <td>
                {k.revokedAt ? (
                  <>
                    <Badge tone="danger">Revoked</Badge>
                    <span className="block text-xs text-muted">
                      {formatDateTime(k.revokedAt)}
                    </span>
                  </>
                ) : (
                  <Badge>ACTIVE</Badge>
                )}
              </td>
              <td className="text-right">
                {!k.revokedAt && (
                  <ConfirmAction
                    label="Revoke"
                    permission="revokeBusinessKey"
                    danger
                    title="Revoke API key"
                    description={
                      <>
                        Calls with the key starting{" "}
                        <span className="font-mono">{k.prefix}</span> are refused
                        from now on. This cannot be undone.
                      </>
                    }
                    onConfirm={() => api.post(`${base}/keys/${k.id}/revoke`)}
                    onDone={onChanged}
                  />
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <OneTimeSecret
        title="New API key"
        label="API key"
        value={newKey}
        onClose={() => setNewKey(null)}
      >
        The business sends it as{" "}
        <span className="font-mono">Authorization: Bearer &lt;key&gt;</span> on
        every API call.
      </OneTimeSecret>
    </Card>
  );
}

// ─── IP allowlist ─────────────────────────────────────────────────────────

const parseEntries = (text: string) => [
  ...new Set(
    text
      .split(/[\s,]+/)
      .map((e) => e.trim())
      .filter(Boolean),
  ),
];

export function IpAllowlistCard({
  business,
  onChanged,
}: {
  business: BusinessDetail;
  onChanged: () => void;
}) {
  const current = business.ipAllowlist;
  const [draft, setDraft] = useState(current.join("\n"));
  const entries = parseEntries(draft);
  const unchanged =
    entries.length === current.length && entries.every((e, i) => e === current[i]);
  const canEdit = useCan("manageBusinessAccess");

  return (
    <Card
      title="IP allowlist"
      actions={
        <ConfirmAction
          label="Save allowlist"
          permission="manageBusinessAccess"
          disabledReason={
            unchanged
              ? "No changes"
              : entries.length > 50
                ? "At most 50 entries"
                : undefined
          }
          variant="primary"
          title="Save IP allowlist"
          description={
            entries.length === 0 ? (
              <>
                The list will be empty: API calls with a valid key are accepted
                from <strong>any address</strong>.
              </>
            ) : (
              <>
                API calls are accepted only from:
                <span className="mt-2 block font-mono text-xs">
                  {entries.join(", ")}
                </span>
              </>
            )
          }
          onConfirm={() =>
            api.put(`/admin/businesses/${business.id}/ip-allowlist`, { entries })
          }
          onDone={onChanged}
        />
      }
    >
      <p className="mb-3 text-sm text-muted">
        IPv4 or IPv6 addresses, or ranges in CIDR form (e.g.{" "}
        <span className="font-mono">203.0.113.0/24</span>), one per line.{" "}
        {current.length === 0 ? (
          <strong className="text-warning">
            Empty now: calls are accepted from any address.
          </strong>
        ) : (
          `${current.length} entr${current.length === 1 ? "y" : "ies"} now.`
        )}
      </p>
      <TextArea
        label="Allowed addresses"
        rows={4}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={!canEdit}
        placeholder="Empty = any address"
        className="font-mono"
      />
    </Card>
  );
}

// ─── Webhook ──────────────────────────────────────────────────────────────

const isDelivery = (v: unknown): v is { delivered: boolean } =>
  typeof v === "object" && v !== null && "delivered" in v;

export function WebhookCard({
  business,
  onChanged,
}: {
  business: BusinessDetail;
  onChanged: () => void;
}) {
  const base = `/admin/businesses/${business.id}`;
  const [url, setUrl] = useState(business.webhookUrl ?? "");
  // A secret lives here only while its dialog is open.
  const [secret, setSecret] = useState<string | null>(null);
  const [retryNote, setRetryNote] = useState<string | null>(null);
  const canEdit = useCan("manageBusinessAccess");
  const canView = useCan("viewBusinessWebhooks");
  const deliveries = useResource<BusinessWebhookDelivery[]>(
    canView ? `${base}/webhooks` : null,
  );
  const trimmed = url.trim();

  return (
    <Card title="Webhook">
      <p className="mb-3 text-sm text-muted">
        Vmonie posts bill outcomes (successful, failed, reversed) to this https
        address, signed with the business&apos;s secret. Failed deliveries are
        retried.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <TextInput
          label="Webhook URL"
          type="url"
          placeholder="https://"
          value={url}
          maxLength={500}
          onChange={(e) => setUrl(e.target.value)}
          disabled={!canEdit}
        />
        <div className="flex flex-wrap gap-2">
          <ConfirmAction
            label="Save URL"
            permission="manageBusinessAccess"
            disabledReason={
              !trimmed
                ? "Enter a URL"
                : trimmed === business.webhookUrl
                  ? "No changes"
                  : !trimmed.startsWith("https://")
                    ? "The URL must start with https://"
                    : undefined
            }
            variant="primary"
            title="Set webhook URL"
            description={
              <>
                Bill outcomes go to{" "}
                <span className="break-all font-mono">{trimmed}</span>.{" "}
                {business.hasWebhookSecret
                  ? "The signing secret stays the same."
                  : "A signing secret is made now and shown once."}
              </>
            }
            onConfirm={async () => {
              const r = await api.put<BusinessWebhookResult>(`${base}/webhook`, {
                url: trimmed,
              });
              if (r.secret) setSecret(r.secret);
            }}
            onDone={onChanged}
          />
          <ConfirmAction
            label="Remove"
            permission="manageBusinessAccess"
            disabledReason={!business.webhookUrl ? "No URL set" : undefined}
            danger
            title="Remove webhook URL"
            description="Vmonie stops posting bill outcomes to the business. The signing secret is kept for when a URL is set again."
            onConfirm={() => api.put(`${base}/webhook`, { url: null })}
            onDone={() => {
              setUrl("");
              onChanged();
            }}
          />
          <ConfirmAction
            label="Rotate secret"
            permission="manageBusinessAccess"
            disabledReason={!business.hasWebhookSecret ? "No secret yet" : undefined}
            danger
            title="Rotate signing secret"
            description="A new secret is made and shown once. The old one stops at once: webhooks signed from now on will fail the business's check until they switch to the new secret."
            confirmLabel="Rotate now"
            onConfirm={async () => {
              const r = await api.post<{ secret: string }>(
                `${base}/webhook/rotate-secret`,
              );
              setSecret(r.secret);
            }}
            onDone={onChanged}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Signing secret: {business.hasWebhookSecret ? "set" : "not set"}.
      </p>

      {canView && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Recent deliveries
          </h3>
          <ErrorBox error={deliveries.error} />
          {retryNote && (
            <Alert tone="info" className="mb-3">
              {retryNote}
            </Alert>
          )}
          {!deliveries.data && deliveries.loading && <Loading />}
          {deliveries.data && deliveries.data.length === 0 && (
            <Empty>No webhooks sent yet.</Empty>
          )}
          {deliveries.data && deliveries.data.length > 0 && (
            <Table
              head={["Created", "Event", "Status", "Attempts", "Last response", "Next / delivered", ""]}
            >
              {deliveries.data.map((d) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap">{formatDateTime(d.createdAt)}</td>
                  <td className="font-mono text-xs">{d.event}</td>
                  <td>
                    <Badge>{d.status}</Badge>
                  </td>
                  <td className="tabular-nums">{d.attempts}</td>
                  <td className="max-w-xs">
                    {d.lastStatusCode !== null ? `HTTP ${d.lastStatusCode}` : "—"}
                    {d.lastError && (
                      <span className="block break-words text-xs text-danger">
                        {d.lastError}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {d.deliveredAt
                      ? `Delivered ${formatDateTime(d.deliveredAt)}`
                      : d.status === "PENDING"
                        ? `Next ${formatDateTime(d.nextAttemptAt)}`
                        : "—"}
                  </td>
                  <td className="text-right">
                    {d.status !== "DELIVERED" && (
                      <ConfirmAction
                        label="Retry"
                        permission="manageBusinessAccess"
                        title="Send this webhook again"
                        description={`Posts the ${humanize(d.event.replace(/\./g, "_"))} event to the business's current webhook URL now.`}
                        confirmLabel="Send now"
                        onConfirm={() =>
                          api.post(`${base}/webhooks/${d.id}/retry`)
                        }
                        onDone={(r) => {
                          setRetryNote(
                            isDelivery(r) && r.delivered
                              ? "Retry done. The delivery's status is below."
                              : "The business's server did not accept it. The delivery's status and last response are below.",
                          );
                          deliveries.reload();
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      )}

      <OneTimeSecret
        title="Webhook signing secret"
        label="Signing secret"
        value={secret}
        onClose={() => setSecret(null)}
      >
        The business uses it to check the signature on every webhook Vmonie
        sends.
      </OneTimeSecret>
    </Card>
  );
}
