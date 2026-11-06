"use client";

import React, { useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { VmonieMark } from "../../components/Brand";
import { Alert, Button, ErrorBox, TextInput } from "../../components/ui";

/** Ask for a reset link. The answer is the same whether or not the email is staff. */
export default function ForgotPasswordPage() {
  useDocumentTitle("Forgot password");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ message: string }>(
        "/admin/auth/forgot-password",
        { email: email.trim() },
      );
      setSent(res.message);
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
            Forgot password
          </h1>
          <p className="mt-2 text-sm text-muted">
            Enter your staff email. We will send a link to choose a new
            password.
          </p>
        </div>
        <ErrorBox error={error} />
        {sent ? (
          <Alert tone="info">{sent}</Alert>
        ) : (
          <>
            <TextInput
              label="Email"
              type="email"
              placeholder="you@vmonie.com"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              type="submit"
              busy={busy}
              disabled={!email.trim()}
              className="w-full"
            >
              Send reset link
            </Button>
          </>
        )}
        <p className="text-center text-sm">
          <Link href="/login" className="text-primary-soft hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
