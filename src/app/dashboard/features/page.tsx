"use client";

import { useState } from "react";
import { api } from "../../../lib/api";
import { useCan } from "../../../lib/access";
import { age, formatDateTime, humanize } from "../../../lib/format";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import {
  FEATURE_STATUSES,
  FEATURE_STATUS_HINTS,
  type FeatureFlag,
  type FeatureStatus,
} from "../../../lib/types";
import { ConfirmAction } from "../../../components/ConfirmAction";
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Label,
  Loading,
  PageHeader,
} from "../../../components/ui";

const MESSAGE_MAX = 300;

/** What the operator has typed but not saved, for one switch. */
interface Draft {
  status: FeatureStatus;
  message: string;
}

const draftOf = (f: FeatureFlag): Draft => ({
  status: f.status,
  message: f.message ?? "",
});

/** A message only exists while the feature is unavailable. */
const messageFor = (d: Draft): string | null =>
  d.status === "LIVE" ? null : d.message.trim() || null;

const isDirty = (f: FeatureFlag, d: Draft) =>
  d.status !== f.status || messageFor(d) !== (f.message ?? null);

/**
 * The app's switches (GET/POST /admin/features), as in zemfi-admin. A change
 * reaches every customer at once; each one asks for a reason, which goes in
 * the audit log. Anyone can read this page; OPERATIONS (or SUPER_ADMIN)
 * changes it.
 */
export default function FeaturesPage() {
  useDocumentTitle("Features");
  const res = useResource<{ items: FeatureFlag[] }>("/admin/features");
  const canEdit = useCan("updateFeature");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const draftFor = (f: FeatureFlag) => drafts[f.key] ?? draftOf(f);
  const edit = (f: FeatureFlag, patch: Partial<Draft>) =>
    setDrafts((cur) => ({ ...cur, [f.key]: { ...draftFor(f), ...patch } }));
  const discard = (key: string) =>
    setDrafts((cur) => {
      const next = { ...cur };
      delete next[key];
      return next;
    });

  const features = res.data?.items;
  const unavailable = features?.filter((f) => !f.enabled) ?? [];

  return (
    <>
      <PageHeader
        title="Features"
        description="What the app may offer right now. Changes reach every customer immediately."
        actions={
          <Button variant="secondary" busy={res.loading} onClick={res.reload}>
            Refresh
          </Button>
        }
      />
      <ErrorBox error={res.error} />
      {!features && res.loading && <Loading />}

      {features && unavailable.length > 0 && (
        <Alert tone="warning" className="mb-4">
          {unavailable.length === 1
            ? `${unavailable[0].label} is not live.`
            : `${unavailable.length} features are not live: ${unavailable
                .map((f) => f.label)
                .join(", ")}.`}
        </Alert>
      )}

      {features && (
        <Card flush>
          {features.length === 0 ? (
            <Empty>No switchable features.</Empty>
          ) : (
            <ul className="divide-y divide-surface-border">
              {features.map((f) => {
                const d = draftFor(f);
                const dirty = isDirty(f, d);
                const statusId = `status-${f.key}`;
                const messageId = `message-${f.key}`;
                return (
                  <li key={f.key} className="fade-in px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{f.label}</p>
                        <p className="mt-0.5 font-mono text-xs text-muted">{f.key}</p>
                      </div>
                      <Badge>{f.status}</Badge>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-start">
                      <div>
                        <label htmlFor={statusId}>
                          <Label>State</Label>
                        </label>
                        <select
                          id={statusId}
                          className="input-field"
                          value={d.status}
                          disabled={!canEdit}
                          onChange={(e) =>
                            edit(f, { status: e.target.value as FeatureStatus })
                          }
                        >
                          {FEATURE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {humanize(s)}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-muted">
                          {FEATURE_STATUS_HINTS[d.status]}
                        </p>
                      </div>

                      {d.status !== "LIVE" && (
                        <div>
                          <label htmlFor={messageId}>
                            <Label>What customers are told</Label>
                          </label>
                          <textarea
                            id={messageId}
                            rows={2}
                            maxLength={MESSAGE_MAX}
                            disabled={!canEdit}
                            className="input-field resize-y"
                            placeholder="Transfers are paused while our bank completes maintenance."
                            value={d.message}
                            onChange={(e) => edit(f, { message: e.target.value })}
                          />
                          <p className="mt-1 text-xs text-muted">
                            {d.message.trim()
                              ? `${d.message.length}/${MESSAGE_MAX}`
                              : "Without a message the app shows a generic one."}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted" title={formatDateTime(f.updatedAt)}>
                        {f.updatedBy
                          ? `Changed by ${f.updatedByName ?? "a former admin"} ${age(f.updatedAt)}`
                          : "Never changed since launch."}
                      </p>
                      {dirty && (
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => discard(f.key)}>
                            Cancel
                          </Button>
                          <ConfirmAction
                            label="Save"
                            permission="updateFeature"
                            variant={d.status === "LIVE" ? "primary" : "danger"}
                            danger={d.status !== "LIVE"}
                            title={`${f.label}: ${humanize(f.status)} → ${humanize(d.status)}`}
                            description={
                              d.status === "LIVE"
                                ? "Every customer can use it as soon as you save."
                                : "Every customer loses it as soon as you save. Anything they start is refused."
                            }
                            textField={{
                              label: "Reason",
                              minLength: 10,
                              maxLength: 500,
                              placeholder: "e.g. Partner bank maintenance, 14:00–16:00",
                            }}
                            confirmLabel="Save"
                            onConfirm={({ text }) =>
                              api.post<FeatureFlag>(`/admin/features/${f.key}`, {
                                status: d.status,
                                ...(messageFor(d) ? { message: messageFor(d) } : {}),
                                reason: text,
                              })
                            }
                            onDone={() => {
                              discard(f.key);
                              res.reload();
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
      {features && !canEdit && (
        <p className="mt-3 text-xs text-muted">
          Changing a feature needs the OPERATIONS role.
        </p>
      )}
    </>
  );
}
