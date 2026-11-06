"use client";

import React, { useState } from "react";
import { api, getStoredProfile, setSession } from "../../../lib/api";
import { passwordProblem } from "../../../lib/password";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import {
  Alert,
  Button,
  Card,
  ErrorBox,
  PageHeader,
  TextInput,
} from "../../../components/ui";

/** The signed-in staff member's own account: change password. */
export default function AccountPage() {
  useDocumentTitle("Your account");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const problem = passwordProblem(password, confirm);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || problem || !current) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await api.post<{ accessToken: string }>(
        "/admin/auth/change-password",
        { currentPassword: current, newPassword: password },
      );
      // The change signed out every other token, this one included.
      const profile = getStoredProfile();
      if (profile) setSession(res.accessToken, profile);
      setCurrent("");
      setPassword("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Your account"
        description="Changing your password signs you out on every other browser."
      />
      <Card title="Change password" className="max-w-lg">
        <form onSubmit={submit} noValidate className="space-y-4">
          <ErrorBox error={error} />
          {done && <Alert tone="info">Password changed.</Alert>}
          <TextInput
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <TextInput
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextInput
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {password && problem && (
            <p className="text-xs text-muted">{problem}</p>
          )}
          <Button type="submit" busy={busy} disabled={!!problem || !current}>
            Change password
          </Button>
        </form>
      </Card>
    </>
  );
}
