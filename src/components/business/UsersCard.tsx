"use client";

import { useState } from "react";
import { api, ApiError } from "../../lib/api";
import { requiredHint, useCan } from "../../lib/access";
import { formatDateTime, humanize } from "../../lib/format";
import { useResource } from "../../lib/useResource";
import {
  BUSINESS_USER_ROLES,
  type BusinessDetail,
  type BusinessUser,
  type BusinessUserRole,
} from "../../lib/types";
import { ConfirmAction } from "../ConfirmAction";
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  Loading,
  Notice,
  Select,
  Table,
  TextInput,
} from "../ui";

const ROLE_HELP: Record<BusinessUserRole, string> = {
  OWNER: "Everything, including the team",
  DEVELOPER: "API keys, webhook and IP allowlist, plus read access",
  VIEWER: "Read only: wallet, statement and bills",
};

/** The API's message, made plainer for the codes staff can act on. */
async function explain<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.code === "EMAIL_TAKEN")
        throw new Error(
          "That email already has a Vmonie Business account (on this or another business). Use a different email.",
        );
      if (err.code === "DASHBOARD_NOT_CONFIGURED")
        throw new Error(
          "The Vmonie Business dashboard address is not set up on the server, so no invitation can be sent. Ask engineering to configure it.",
        );
      if (err.code === "LAST_OWNER")
        throw new Error(
          "This is the business's only active owner. A business needs at least one: invite or promote another owner first, then disable this one.",
        );
    }
    throw err;
  }
}

/**
 * People who sign in to the business's own Vmonie Business dashboard. Staff
 * invite the first owner; owners invite the rest themselves.
 */
export function UsersCard({ business }: { business: BusinessDetail }) {
  const base = `/admin/businesses/${business.id}/users`;
  const canView = useCan("viewBusinessUsers");
  const canManage = useCan("manageBusinessUsers");
  const res = useResource<BusinessUser[]>(canView ? base : null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<BusinessUserRole>("OWNER");
  const [sent, setSent] = useState<string | null>(null);
  const closed = business.status === "CLOSED";
  const e = email.trim();
  const n = name.trim();

  const invite = (body: { email: string; name: string; role: BusinessUserRole }) =>
    explain(api.post<BusinessUser>(base, body));

  return (
    <Card title="Dashboard users">
      <p className="mb-4 text-sm text-muted">
        They get an email to set a password and sign in to the Vmonie Business
        dashboard. Invite the business&apos;s first owner here; owners invite
        the rest themselves.
      </p>
      {canManage && (
        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_1fr_minmax(0,10rem)_auto] sm:items-start">
          <TextInput
            label="Name"
            value={name}
            maxLength={120}
            onChange={(ev) => setName(ev.target.value)}
            disabled={closed}
          />
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            disabled={closed}
          />
          <div>
            <Select
              label="Role"
              value={role}
              onChange={(ev) => setRole(ev.target.value as BusinessUserRole)}
              disabled={closed}
              options={BUSINESS_USER_ROLES.map((r) => ({ value: r, label: humanize(r) }))}
            />
            <span className="mt-1 block text-xs text-muted">{ROLE_HELP[role]}</span>
          </div>
          <div className="sm:pt-5">
            <ConfirmAction
              label="Invite user"
              permission="manageBusinessUsers"
              disabledReason={
                closed
                  ? "The business is closed"
                  : n.length < 2
                    ? "Enter their name"
                    : !/^\S+@\S+\.\S+$/.test(e)
                      ? "Enter their email"
                      : undefined
              }
              variant="primary"
              size="md"
              title="Invite dashboard user"
              description={
                <>
                  Sends {n} (<span className="font-mono">{e}</span>) an invitation
                  to {business.name}&apos;s Vmonie Business dashboard as{" "}
                  <strong>{humanize(role)}</strong>. The link works once, for 7
                  days.
                </>
              }
              confirmLabel="Send invitation"
              onConfirm={() => invite({ email: e, name: n, role })}
              onDone={() => {
                setSent(`Invitation sent to ${e}.`);
                setEmail("");
                setName("");
                setRole("OWNER");
                res.reload();
              }}
            />
          </div>
        </div>
      )}
      {sent && <Notice tone="blue">{sent}</Notice>}
      {!canView ? (
        <Notice>Seeing dashboard users: {requiredHint("viewBusinessUsers").toLowerCase()}.</Notice>
      ) : (
        <div className={sent ? "mt-3" : ""}>
          <ErrorBox error={res.error} />
          {!res.data && res.loading && <Loading />}
          {res.data && res.data.length === 0 && (
            <Empty>No dashboard users yet. Invite the business&apos;s first owner.</Empty>
          )}
          {res.data && res.data.length > 0 && (
            <Table head={["User", "Role", "Status", "Last sign-in", "Added", ""]}>
              {res.data.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    <span className="block text-xs text-muted">{u.email}</span>
                  </td>
                  <td>{humanize(u.role)}</td>
                  <td>
                    <Badge>{u.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap">
                    {u.lastSignInAt ? formatDateTime(u.lastSignInAt) : "Never"}
                  </td>
                  <td className="whitespace-nowrap">{formatDateTime(u.createdAt)}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      {u.status === "INVITED" && (
                        <ConfirmAction
                          label="Resend invite"
                          permission="manageBusinessUsers"
                          disabledReason={closed ? "The business is closed" : undefined}
                          title="Resend invitation"
                          description={
                            <>
                              Sends <span className="font-mono">{u.email}</span> a new
                              link. The earlier link stops working.
                            </>
                          }
                          confirmLabel="Send new link"
                          onConfirm={() =>
                            invite({ email: u.email, name: u.name, role: u.role })
                          }
                          onDone={() => {
                            setSent(`New invitation sent to ${u.email}.`);
                            res.reload();
                          }}
                        />
                      )}
                      {u.status !== "DISABLED" && (
                        <ConfirmAction
                          label="Disable"
                          permission="manageBusinessUsers"
                          danger
                          title="Disable dashboard user"
                          description={
                            <>
                              {u.name} (<span className="font-mono">{u.email}</span>)
                              is signed out and can no longer sign in to the Vmonie
                              Business dashboard. A business must keep at least one
                              active owner.
                            </>
                          }
                          onConfirm={() =>
                            explain(api.post(`${base}/${u.id}/disable`))
                          }
                          onDone={() => {
                            setSent(null);
                            res.reload();
                          }}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      )}
    </Card>
  );
}
