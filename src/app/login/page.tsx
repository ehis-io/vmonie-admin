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
import { VmonieMark } from "../../components/Brand";
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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <form
        onSubmit={submit}
        noValidate
        className="card fade-in w-full max-w-md space-y-5 p-8 sm:p-10"
      >
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <VmonieMark size={48} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Vmonie Admin
          </h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted">
            Operations console
          </p>
          <p className="mt-3 text-xs text-muted">
            Staff only. Every action is audited.
          </p>
        </div>
        {expired && !error && (
          <Notice>Your session ended. Sign in again.</Notice>
        )}
        <ErrorBox error={error} />
        <TextInput
          label="Email"
          type="email"
          placeholder="you@vmonie.com"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInput
          label="Password"
          type="password"
          placeholder="••••••••"
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
