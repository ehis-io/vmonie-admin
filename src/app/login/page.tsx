"use client";

import React, { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  api,
  describeError,
  setSession,
  type AdminProfile,
} from "../../lib/api";
import { resetAdminCache } from "../../lib/access";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { Button, ErrorBox, Notice, TextInput } from "../../components/ui";

interface LoginResponse {
  accessToken: string;
  admin: AdminProfile;
}

function LoginForm() {
  useDocumentTitle("Sign in");
  const expired = useSearchParams().get("expired") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<LoginResponse>("/admin/auth/login", {
        email: email.trim(),
        password,
      });
      setSession(res.accessToken, res.admin);
      resetAdminCache();
      window.location.replace("/dashboard");
    } catch (err) {
      setError(describeError(err));
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold">Vmonie Ops</h1>
          <p className="text-sm text-muted-foreground">
            Operations console. Staff only; every action is audited.
          </p>
        </div>
        {expired && !error && (
          <Notice>Your session ended. Sign in again.</Notice>
        )}
        <ErrorBox error={error} />
        <TextInput
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInput
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" busy={busy} className="w-full">
          Sign in
        </Button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
