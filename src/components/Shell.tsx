"use client";

import React, { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getToken, subscribeSession } from "../lib/api";
import { useAdmin } from "../lib/access";
import { Sidebar } from "./Sidebar";
import { ErrorBox, Spinner } from "./ui";

/** The token, read from memory/sessionStorage; null during server render. */
function useToken(): string | null {
  return useSyncExternalStore(subscribeSession, getToken, () => null);
}

/** Has the client hydrated? (false on the server and the first client pass) */
function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Guard + nav around every /dashboard page (zemfi's DashboardShell). No
 * token sends the browser to /login; otherwise /admin/me proves the token and
 * supplies the roles the sidebar and buttons are gated on.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const token = useToken();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  if (!hydrated || !token) return null;
  return <SignedIn>{children}</SignedIn>;
}

export { Shell as DashboardShell };

function SignedIn({ children }: { children: React.ReactNode }) {
  const session = useAdmin();

  if (session.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (session.status === "error") {
    return (
      <div className="mx-auto max-w-xl p-8">
        <ErrorBox error={session.error} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar me={session.me} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
