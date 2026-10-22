"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "../lib/api";
import { can, isOwner, type AdminMe, type Permission } from "../lib/access";
import { humanize } from "../lib/format";
import { Brand } from "./Brand";
import { Button } from "./ui";

interface NavLink {
  href: string;
  label: string;
  exact?: boolean;
  /** SUPER_ADMIN only (zemfi's "owner"). The API refuses others too. */
  ownerOnly?: boolean;
  /** Shown only to roles that can use the page. */
  permission?: Permission;
}

/**
 * zemfi-admin's order first (Overview, Users, Support, the KYC/compliance
 * queue, Features, then the owner's pages), with Vmonie's money pages, which
 * zemfi has no equivalent of, between them.
 */
const SECTIONS: { title?: string; links: NavLink[] }[] = [
  {
    links: [
      { href: "/dashboard", label: "Overview", exact: true },
      { href: "/dashboard/users", label: "Users" },
      { href: "/dashboard/support", label: "Support" },
      { href: "/dashboard/kyc", label: "KYC" },
      {
        href: "/dashboard/compliance",
        label: "Compliance",
        permission: "manageCompliance",
      },
      { href: "/dashboard/features", label: "Features" },
    ],
  },
  {
    title: "Money",
    links: [
      { href: "/dashboard/transactions", label: "Transactions" },
      { href: "/dashboard/reconciliation", label: "Reconciliation" },
      { href: "/dashboard/adjustments", label: "Adjustments" },
      { href: "/dashboard/webhooks", label: "Webhooks" },
      { href: "/dashboard/reports", label: "Reports", permission: "viewReports" },
    ],
  },
  {
    title: "Admin",
    links: [
      { href: "/dashboard/fees", label: "Fees", ownerOnly: true },
      { href: "/dashboard/admins", label: "Admins", ownerOnly: true },
      // COMPLIANCE reads the audit log too (backend @Roles), so this is
      // permission-gated rather than owner-only as in zemfi.
      { href: "/dashboard/audit", label: "Audit", permission: "viewAudit" },
    ],
  },
];

const isActive = (pathname: string, link: NavLink) =>
  link.exact
    ? pathname === link.href
    : pathname === link.href || pathname.startsWith(link.href + "/");

/**
 * Sidebar on wide screens, collapsible top bar on narrow ones, as in
 * zemfi-admin. Rendered once by the dashboard layout.
 */
export function Sidebar({ me }: { me: AdminMe }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const visible = (l: NavLink) =>
    (!l.ownerOnly || isOwner(me.roles)) &&
    (!l.permission || can(me.roles, l.permission));

  const nav = (
    <nav className="flex flex-col gap-4">
      {SECTIONS.map((section, i) => {
        const links = section.links.filter(visible);
        if (!links.length) return null;
        return (
          <div key={section.title ?? i} className="flex flex-col gap-1">
            {section.title && (
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted/70">
                {section.title}
              </p>
            )}
            {links.map((link) => {
              const active = isActive(pathname, link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/20 text-primary-soft"
                      : "text-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  const account = (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface/60 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {me.name ?? me.email}
        </p>
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted">
          {me.roles.map(humanize).join(", ")}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={logout}>
        Sign out
      </Button>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-surface-border bg-background/80 p-4 lg:flex">
        <Brand />
        <div className="mt-8 flex-1 overflow-y-auto">{nav}</div>
        {account}
      </aside>

      <header className="flex items-center justify-between border-b border-surface-border bg-background/80 px-4 py-3 lg:hidden">
        <Brand />
        <button
          type="button"
          className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-muted"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          Menu
        </button>
      </header>
      {open && (
        <div
          id="mobile-nav"
          className="space-y-3 border-b border-surface-border bg-background p-4 lg:hidden"
        >
          {nav}
          {account}
        </div>
      )}
    </>
  );
}
