"use client";

import { useState } from "react";
import Link from "next/link";
import { api, describeError } from "../../../lib/api";
import { useCan } from "../../../lib/access";
import { formatDateTime } from "../../../lib/format";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import type { ReferralCode } from "../../../lib/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Loading,
  PageHeader,
  Table,
  TextInput,
} from "../../../components/ui";

/**
 * Referral codes (GET/POST /admin/referrals): every customer's own, and the
 * codes staff make for agents and campaigns. Tracking only: a referral moves
 * no money. Anyone can read this page; OPERATIONS (or SUPER_ADMIN) makes and
 * switches codes. Switching one off stops new sign-ups using it; earlier
 * sign-ups keep it.
 */
export default function ReferralsPage() {
  useDocumentTitle("Referrals");
  const res = useResource<{ items: ReferralCode[] }>("/admin/referrals");
  const canManage = useCan("manageReferrals");

  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function create() {
    if (label.trim().length < 2) {
      setCreateError("Give the code a label: who or what it is for.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    setCreated(null);
    try {
      const r = await api.post<{ id: string; code: string }>("/admin/referrals", {
        label: label.trim(),
        ...(code.trim() ? { code: code.trim() } : {}),
      });
      setCreated(r.code);
      setLabel("");
      setCode("");
      res.reload();
    } catch (err) {
      setCreateError(describeError(err));
    } finally {
      setCreating(false);
    }
  }

  async function toggle(r: ReferralCode) {
    setToggling(r.id);
    setToggleError(null);
    try {
      await api.post(`/admin/referrals/${r.id}/active`, { active: !r.active });
      res.reload();
    } catch (err) {
      setToggleError(describeError(err));
    } finally {
      setToggling(null);
    }
  }

  const codes = res.data?.items;
  const total = codes?.reduce((sum, r) => sum + r.signups, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Referrals"
        description="Who brought each new customer. Tracking only: no reward is paid."
        actions={
          <Button variant="secondary" busy={res.loading} onClick={res.reload}>
            Refresh
          </Button>
        }
      />
      <ErrorBox error={res.error} />

      {canManage && (
        <Card title="New agent or campaign code" className="mb-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_minmax(0,12rem)_auto] sm:items-end">
            <TextInput
              label="Label"
              placeholder="e.g. Agent: Ada, or Campus campaign"
              value={label}
              maxLength={80}
              onChange={(e) => setLabel(e.target.value)}
            />
            <TextInput
              label="Code (optional)"
              placeholder="Generated if blank"
              value={code}
              maxLength={16}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <Button busy={creating} onClick={create}>
              Create code
            </Button>
          </div>
          {createError && (
            <Alert tone="danger" className="mt-3">
              {createError}
            </Alert>
          )}
          {created && (
            <Alert tone="info" className="mt-3">
              Created <span className="font-mono">{created}</span>.
            </Alert>
          )}
        </Card>
      )}

      {toggleError && (
        <Alert tone="danger" className="mb-4">
          {toggleError}
        </Alert>
      )}

      {!codes && res.loading && <Loading />}
      {codes && (
        <Card
          flush
          title={`${codes.length} code${codes.length === 1 ? "" : "s"} · ${total} sign-up${total === 1 ? "" : "s"}`}
        >
          {codes.length === 0 ? (
            <Empty>
              No referral codes yet. Customers get theirs when they open the invite card.
            </Empty>
          ) : (
            <Table head={["Code", "For", "Sign-ups", "Status", "Created", ""]}>
              {codes.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono">{r.code}</td>
                  <td>
                    {r.owner ? (
                      <Link className="underline" href={`/dashboard/users/${r.owner.id}`}>
                        {r.owner.name ?? r.owner.phoneNumber}
                      </Link>
                    ) : (
                      (r.label ?? "—")
                    )}
                    <span className="ml-2 text-xs text-muted">
                      {r.owner ? "customer" : "agent / campaign"}
                    </span>
                  </td>
                  <td>{r.signups}</td>
                  <td>
                    <Badge>{r.active ? "ACTIVE" : "OFF"}</Badge>
                  </td>
                  <td>{formatDateTime(r.createdAt)}</td>
                  <td className="text-right">
                    {canManage && (
                      <Button
                        size="sm"
                        variant="secondary"
                        busy={toggling === r.id}
                        onClick={() => toggle(r)}
                      >
                        {r.active ? "Turn off" : "Turn on"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
