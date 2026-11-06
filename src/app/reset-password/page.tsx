"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "../../lib/api";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { VmonieMark } from "../../components/Brand";
import { Alert, Button, ErrorBox, TextInput } from "../../components/ui";
import { passwordProblem } from "../../lib/password";

/** The page an emailed reset link opens: choose a new password, once. */
function ResetForm() {
  useDocumentTitle("Choose a new password");
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const problem = passwordProblem(password, confirm);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || problem) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/admin/auth/reset-password", {
        token,
        newPassword: password,
      });
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <form
        onSubmit={submit}
        noValidate
        className="card fade-in w-full max-w-md space-y-5 p-8 sm:p-10"
      >
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <VmonieMark size={48} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Choose a new password
          </h1>
        </div>
        {!token ? (
          <Alert>
            This link is incomplete. Open the link from the email again, or ask
            for a new one.
          </Alert>
        ) : done ? (
          <Alert tone="info">
            Password changed. Every other session was signed out.
          </Alert>
        ) : (
          <>
            <ErrorBox error={error} />
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
            <Button
              type="submit"
              busy={busy}
              disabled={!!problem}
              className="w-full"
            >
              Change password
            </Button>
          </>
        )}
        <p className="text-center text-sm">
          <Link
            href={done ? "/login" : "/forgot-password"}
            className="text-primary-soft hover:underline"
          >
            {done ? "Sign in" : "Ask for a new link"}
          </Link>
        </p>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
