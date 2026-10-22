"use client";

import { useEffect, useState } from "react";
import { api, type AdminRole, getStoredProfile } from "./api";

/**
 * Who may do what. This mirrors the @Roles() on each backend route so the
 * console can disable what an admin cannot do; the backend still enforces it
 * and its 403 is shown if the two ever disagree. SUPER_ADMIN passes every
 * check. Keep in step with backend/src/modules/admin/admin.controller.ts.
 */
export const PERMISSIONS = {
  revealAccount: ["SUPPORT", "OPERATIONS", "COMPLIANCE"],
  restrictCustomer: ["COMPLIANCE", "OPERATIONS"],
  unrestrictCustomer: ["COMPLIANCE"],
  freezeAccount: ["COMPLIANCE", "OPERATIONS"],
  unfreezeAccount: ["COMPLIANCE"],
  retryAccountOpening: ["OPERATIONS", "SUPPORT"],
  requeryTransfer: ["OPERATIONS", "SUPPORT", "FINANCE"],
  resolveTransfer: ["FINANCE"],
  runReconciliation: ["FINANCE", "OPERATIONS"],
  resolveReconciliation: ["FINANCE", "OPERATIONS"],
  requestAdjustment: ["OPERATIONS", "FINANCE"],
  decideAdjustment: ["FINANCE"],
  updateSupportCase: ["SUPPORT", "OPERATIONS"],
  viewReports: ["FINANCE", "OPERATIONS"],
  viewLedger: ["FINANCE"],
  viewAudit: ["COMPLIANCE"],
  // Every /admin/compliance route (admin-compliance.controller.ts).
  manageCompliance: ["COMPLIANCE"],
  createAdmin: [],
  // Feature switches (admin-features.controller.ts): any admin reads them,
  // OPERATIONS changes them.
  updateFeature: ["OPERATIONS"],
  // Fees and staff accounts are the owner's (SUPER_ADMIN), as in zemfi.
  manageFees: [],
  manageAdmins: [],
  // admin-customer-security.controller.ts: revoke a device, sign out
  // everywhere, force a PIN reset.
  customerSecurity: ["OPERATIONS"],
} satisfies Record<string, AdminRole[]>;

export type Permission = keyof typeof PERMISSIONS;

/** True if `held` grants `permission`. An empty role list means SUPER_ADMIN only. */
export function can(held: AdminRole[], permission: Permission): boolean {
  if (held.includes("SUPER_ADMIN")) return true;
  const required: AdminRole[] = PERMISSIONS[permission];
  return required.some((r) => held.includes(r));
}

/** zemfi's "owner": SUPER_ADMIN. Owner-only pages are hidden from others. */
export function isOwner(held: AdminRole[]): boolean {
  return held.includes("SUPER_ADMIN");
}

/** "Requires FINANCE" style hint for a disabled control. */
export function requiredHint(permission: Permission): string {
  const required: AdminRole[] = PERMISSIONS[permission];
  return required.length
    ? `Requires the ${required.join(" or ")} role`
    : "Requires SUPER_ADMIN";
}

export interface AdminMe {
  id: string;
  email: string;
  roles: AdminRole[];
  /** From the login response; /admin/me does not return it. */
  name?: string;
}

// One /admin/me per page load, shared by every component that asks.
let pending: Promise<AdminMe> | null = null;

export function resetAdminCache(): void {
  pending = null;
}

function fetchMe(): Promise<AdminMe> {
  pending ??= api
    .get<AdminMe>("/admin/me")
    .then((me) => {
      const stored = getStoredProfile();
      return { ...me, name: stored?.id === me.id ? stored.name : undefined };
    })
    .catch((err: unknown) => {
      pending = null;
      throw err;
    });
  return pending;
}

export type AdminSession =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; me: AdminMe };

/** The signed-in admin. Roles come from the server, never from storage. */
export function useAdmin(): AdminSession {
  const [session, setSession] = useState<AdminSession>({ status: "loading" });
  useEffect(() => {
    let live = true;
    fetchMe().then(
      (me) => live && setSession({ status: "ready", me }),
      (error: unknown) => live && setSession({ status: "error", error }),
    );
    return () => {
      live = false;
    };
  }, []);
  return session;
}

/** Whether the signed-in admin may do `permission`. False while loading. */
export function useCan(permission: Permission): boolean {
  const session = useAdmin();
  return session.status === "ready" && can(session.me.roles, permission);
}
