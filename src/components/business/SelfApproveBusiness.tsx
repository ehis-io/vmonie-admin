"use client";

import React, { useRef, useState } from "react";
import { api, describeError } from "../../lib/api";
import { Modal } from "../Modal";
import { Button, TextInput } from "../ui";

/**
 * A super admin approving a business they created: no second admin, but a
 * code emailed to them first. The backend checks the code is theirs, for
 * this business, and unused.
 */
export function SelfApproveBusiness({
  businessId,
  businessName,
  onDone,
}: {
  businessId: string;
  businessName: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [challenge, setChallenge] = useState<{ challengeId: string; sentTo: string } | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const base = `/admin/businesses/${businessId}/approve`;

  const run = async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(describeError(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const close = () => {
    if (inFlight.current) return;
    setOpen(false);
    setChallenge(null);
    setCode("");
    setError(null);
  };

  const sendCode = () =>
    run(async () => {
      setChallenge(await api.post<{ challengeId: string; sentTo: string }>(`${base}/code`));
      setCode("");
    });

  const approve = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!challenge || !/^\d{6}$/.test(code)) return;
    return run(async () => {
      await api.post(base, { challengeId: challenge.challengeId, code });
      setOpen(false);
      setChallenge(null);
      setCode("");
      onDone();
    });
  };

  return (
    <>
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        Approve
      </Button>
      <Modal open={open} title="Approve business" onClose={close}>
        {() => (
          <form onSubmit={approve} className="space-y-4">
            <p className="text-sm text-muted">
              <strong>{businessName}</strong> becomes Active: its wallet opens, it can be
              funded, and its API keys start working. You created it, so as a super admin you
              confirm with a code we email you instead of a second approver. This is
              recorded in the audit log.
            </p>
            {challenge ? (
              <>
                <TextInput
                  label={`Code sent to ${challenge.sentTo}`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  disabled={busy}
                  autoFocus
                />
                <button
                  type="button"
                  className="text-xs text-primary-soft hover:underline disabled:opacity-50"
                  onClick={sendCode}
                  disabled={busy}
                >
                  Send a new code
                </button>
              </>
            ) : null}
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close} disabled={busy}>
                Cancel
              </Button>
              {challenge ? (
                <Button type="submit" variant="primary" busy={busy} disabled={code.length !== 6}>
                  Approve
                </Button>
              ) : (
                <Button variant="primary" busy={busy} onClick={sendCode}>
                  Email me a code
                </Button>
              )}
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
