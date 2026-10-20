"use client";

import React, { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getToken, logout, subscribeSession } from "../lib/api";
import { can, useAdmin, type Permission } from "../lib/access";
import { ErrorBox } from "./ui";

const NAV: { href: string; label: string; permission?: Permission }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/reconciliation", label: "Reconciliation" },
  { href: "/dashboard/adjustments", label: "Adjustments" },
  { href: "/dashboard/support", label: "Support cases" },
  {
    href: "/dashboard/compliance",
    label: "Compliance",
    permission: "manageCompliance",
  },
  { href: "/dashboard/webhooks", label: "Webhooks" },
  { href: "/dashboard/reports", label: "Reports", permission: "viewReports" },
  { href: "/dashboard/audit", label: "Audit log", permission: "viewAudit" },
  {
    href: "/dashboard/admin-users",
    label: "Admin users",
    permission: "createAdmin",
  },
];

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

function SignedIn({ children }: { children: React.ReactNode }) {
  const session = useAdmin();
  const pathname = usePathname();

  if (session.status === "loading") {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }
  if (session.status === "error") {
    return (
      <div className="p-8">
        <ErrorBox error={session.error} />
      </div>
    );
  }
  const { me } = session;
  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-surface md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-4 py-4">
          <Link href="/dashboard" className="font-semibold">
            Vmonie Ops
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {NAV.filter(
            (n) => !n.permission || can(me.roles, n.permission),
          ).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${
                isActive(n.href)
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-border px-4 py-3 text-xs text-muted-foreground md:block">
          <p className="font-medium text-foreground">{me.name ?? me.email}</p>
          <p className="truncate">{me.email}</p>
          <p className="mt-1">{me.roles.join(", ")}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 text-primary hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-4 flex justify-end text-xs md:hidden">
          <span className="mr-3 text-muted-foreground">{me.email}</span>
          <button type="button" onClick={logout} className="text-primary">
            Sign out
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
