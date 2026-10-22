"use client";

import React, { useRef, useState } from "react";
import { api, describeError, qs } from "../../../lib/api";
import { isOwner, useAdmin } from "../../../lib/access";
import { age, formatDateTime } from "../../../lib/format";
import { formatNairaDecimal } from "../../../lib/money";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import type { FeeEarning, FeeRule } from "../../../lib/types";
import { Modal } from "../../../components/Modal";
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Loading,
  PageHeader,
  TextArea,
  TextInput,
} from "../../../components/ui";

const NAIRA = /^\d{1,12}(\.\d{1,2})?$/;
const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;

/** 25 bps → "0.25". */
const bpsToPercent = (bps: number) => (bps / 100).toFixed(2).replace(/\.?0+$/, "") || "0";

function describeRule(r: FeeRule): string {
  const parts: string[] = [];
  if (r.feeBps) parts.push(`${bpsToPercent(r.feeBps)}%`);
  if (Number(r.feeFlat)) parts.push(formatNairaDecimal(r.feeFlat));
  return parts.length ? parts.join(" + ") : "Nothing";
}

interface Draft {
  percent: string;
  flat: string;
  min: string;
  max: string;
  active: boolean;
  reason: string;
}

const draftOf = (r: FeeRule): Draft => ({
  percent: bpsToPercent(r.feeBps),
  flat: r.feeFlat ?? "0",
  min: r.feeMin ?? "",
  max: r.feeMax ?? "",
  active: r.active,
  reason: "",
});

function problemsOf(d: Draft, anyCurrency: boolean): string[] {
  const out: string[] = [];
  if (!PERCENT.test(d.percent.trim()) || Number(d.percent) > 100)
    out.push("a percentage between 0 and 100 (up to 2 decimals)");
  if (!NAIRA.test(d.flat.trim())) out.push("a fixed amount in naira");
  if (anyCurrency && Number(d.flat) > 0)
    out.push("no fixed amount on a rule for every currency");
  if (d.min.trim() && !NAIRA.test(d.min.trim())) out.push("a valid minimum");
  if (d.max.trim() && !NAIRA.test(d.max.trim())) out.push("a valid maximum");
  if (d.min.trim() && d.max.trim() && Number(d.min) > Number(d.max))
    out.push("a minimum no larger than the maximum");
  if (d.reason.trim().length < 10) out.push("a reason (10+ characters)");
  return out;
}

function EditFee({
  rule,
  onClose,
  onSaved,
}: {
  rule: FeeRule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState<Draft>(() => draftOf(rule));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const problems = problemsOf(d, rule.currency === "*");
  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || problems.length) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/fees/${rule.flow}/${encodeURIComponent(rule.currency)}`, {
        feeBps: Math.round(Number(d.percent) * 100),
        feeFlat: Number(d.flat),
        feeMin: d.min.trim() ? Number(d.min) : null,
        feeMax: d.max.trim() ? Number(d.max) : null,
        active: d.active,
        reason: d.reason.trim(),
      });
      onSaved();
    } catch (err) {
      setError(describeError(err));
      inFlight.current = false;
      setBusy(false);
    }
  };

  const close = () => !inFlight.current && onClose();

  return (
    <Modal open title={`${rule.label} (${rule.currency})`} onClose={close} wide>
      {() => (
        <form onSubmit={save} className="space-y-4">
          <p className="text-sm text-muted">
            Vmonie&apos;s markup on top of Dutchman Bridge&apos;s own fee. Bridge
            charges it on every {rule.label.toLowerCase()} the moment you save.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Percentage (%)"
              inputMode="decimal"
              value={d.percent}
              disabled={busy}
              onChange={(e) => set({ percent: e.target.value })}
            />
            <TextInput
              label="Fixed (₦)"
              inputMode="decimal"
              value={d.flat}
              disabled={busy || rule.currency === "*"}
              onChange={(e) => set({ flat: e.target.value })}
            />
            <TextInput
              label="Minimum (₦, blank for none)"
              inputMode="decimal"
              value={d.min}
              disabled={busy}
              onChange={(e) => set({ min: e.target.value })}
            />
            <TextInput
              label="Maximum (₦, blank for none)"
              inputMode="decimal"
              value={d.max}
              disabled={busy}
              onChange={(e) => set({ max: e.target.value })}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={d.active}
              disabled={busy}
              onChange={(e) => set({ active: e.target.checked })}
            />
            <span>
              <span className="font-medium text-foreground">Charge this fee</span>
              <span className="block text-xs text-muted">
                A rule charges nothing until it is on, whatever its numbers say.
              </span>
            </span>
          </label>
          <TextArea
            label="Reason (recorded in the audit log)"
            value={d.reason}
            maxLength={500}
            disabled={busy}
            placeholder="e.g. Launch pricing approved by the board on 21 Oct"
            onChange={(e) => set({ reason: e.target.value })}
          />
          {problems.length > 0 && (
            <p className="text-xs text-muted">Needs {problems.join(", ")}.</p>
          )}
          {error && <Alert>{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={d.active ? "danger" : "primary"}
              busy={busy}
              disabled={problems.length > 0}
            >
              Save on Bridge
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Earnings() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const res = useResource<{ items: FeeEarning[] }>(
    `/admin/fees/earnings${qs({ from, to })}`,
  );
  return (
    <Card
      title="Earnings"
      className="mt-6"
      actions={
        <div className="flex items-end gap-2">
          <TextInput
            type="date"
            aria-label="From"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <TextInput
            type="date"
            aria-label="To"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      }
    >
      <p className="mb-3 text-xs text-muted">
        What the markup earned, as Bridge credited it{from || to ? " in the period" : ", all time"}.
        &ldquo;Held&rdquo; is on transfers still in flight, credited when they complete.
      </p>
      <ErrorBox error={res.error} />
      {!res.data && res.loading && <Loading />}
      {res.data && res.data.items.length === 0 && <Empty>No earnings yet.</Empty>}
      {res.data && res.data.items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {res.data.items.map((e) => (
            <div key={e.currency} className="rounded-lg border border-surface-border p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {e.currency}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {e.currency === "NGN" ? formatNairaDecimal(e.amount) : e.amount}
              </p>
              <p className="text-xs text-muted">
                Held {e.currency === "NGN" ? formatNairaDecimal(e.held) : e.held}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Vmonie's fee markup (zemfi-admin's Fees page). Read live from Dutchman
 * Bridge, which charges it; every change goes to Bridge first and is audited
 * here with a reason. SUPER_ADMIN only.
 */
export default function FeesPage() {
  useDocumentTitle("Fees");
  const session = useAdmin();
  const owner = session.status === "ready" && isOwner(session.me.roles);
  const res = useResource<{ items: FeeRule[] }>(owner ? "/admin/fees" : null);
  const [editing, setEditing] = useState<FeeRule | null>(null);

  if (!owner) {
    return (
      <>
        <PageHeader title="Fees" />
        <Alert tone="warning">Fees are managed by SUPER_ADMIN.</Alert>
      </>
    );
  }

  const rules = res.data?.items;
  return (
    <>
      <PageHeader
        title="Fees"
        description="Vmonie's markup on each flow, charged by Dutchman Bridge on top of its own fee."
        actions={
          <Button variant="secondary" busy={res.loading} onClick={res.reload}>
            Refresh
          </Button>
        }
      />
      <ErrorBox error={res.error} />
      {!rules && res.loading && <Loading />}
      {rules && (
        <Card flush>
          {rules.length === 0 ? (
            <Empty>No fee rules.</Empty>
          ) : (
            <ul className="divide-y divide-surface-border">
              {rules.map((r) => (
                <li
                  key={`${r.flow}/${r.currency}`}
                  className="fade-in flex flex-wrap items-start justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {r.label}{" "}
                      <span className="font-mono text-xs font-normal text-muted">
                        {r.flow} · {r.currency}
                      </span>
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                      {describeRule(r)}
                    </p>
                    <p className="text-xs text-muted">
                      Min {formatNairaDecimal(r.feeMin)} · Max {formatNairaDecimal(r.feeMax)}
                    </p>
                    <p className="mt-1 text-xs text-muted" title={formatDateTime(r.updatedAt)}>
                      {!r.configured
                        ? "Not set on Bridge yet: charges nothing."
                        : r.updatedByName
                          ? `Changed by ${r.updatedByName} ${age(r.updatedAt)}${r.lastReason ? ` — “${r.lastReason}”` : ""}`
                          : r.updatedAt
                            ? `Changed ${age(r.updatedAt)}`
                            : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.active ? (
                      <Badge tone="success">Charging</Badge>
                    ) : (
                      <Badge tone="neutral">Off</Badge>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                      Edit
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <Earnings />
      {editing && (
        <EditFee
          rule={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            res.reload();
          }}
        />
      )}
    </>
  );
}
