"use client";

import React, { useRef, useState } from "react";
import { api, describeError, type AdminRole } from "../../../lib/api";
import { useAdmin, useCan } from "../../../lib/access";
import { age, formatDateTime } from "../../../lib/format";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import type { AdminAccount } from "../../../lib/types";
import { ConfirmAction } from "../../../components/ConfirmAction";
import { Modal } from "../../../components/Modal";
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Label,
  Loading,
  Notice,
  PageHeader,
  Table,
  TextArea,
  TextInput,
} from "../../../components/ui";

const ROLES: { role: AdminRole; help: string }[] = [
  { role: "SUPPORT", help: "Support cases, reveal account numbers, requery, retry account opening" },
  { role: "OPERATIONS", help: "Freeze/restrict, reconciliation, adjustments, features, customer security actions" },
  { role: "FINANCE", help: "Resolve transfers, approve adjustments, reconciliation, ledger, reports" },
  { role: "COMPLIANCE", help: "Freeze/unfreeze, restrict/unrestrict, AML screening and holds, audit log" },
  { role: "SUPER_ADMIN", help: "Everything, including fees and admin accounts" },
];

function RoleChecks({
  roles,
  onChange,
  disabled,
}: {
  roles: AdminRole[];
  onChange: (roles: AdminRole[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset>
      <Label>Roles</Label>
      <div className="space-y-2">
        {ROLES.map(({ role, help }) => (
          <label key={role} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              disabled={disabled}
              checked={roles.includes(role)}
              onChange={(e) =>
                onChange(e.target.checked ? [...roles, role] : roles.filter((x) => x !== role))
              }
            />
            <span>
              <span className="font-medium text-foreground">{role}</span>
              <span className="block text-xs text-muted">{help}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function EditRoles({
  account,
  onClose,
  onSaved,
}: {
  account: AdminAccount;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roles, setRoles] = useState<AdminRole[]>(account.roles);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const same =
    roles.length === account.roles.length && roles.every((r) => account.roles.includes(r));
  const ok = roles.length > 0 && !same && reason.trim().length >= 10;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || !ok) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/users/${account.id}/roles`, { roles, reason: reason.trim() });
      onSaved();
    } catch (err) {
      setError(describeError(err));
      inFlight.current = false;
      setBusy(false);
    }
  };
  const close = () => !inFlight.current && onClose();

  return (
    <Modal open title={`Roles for ${account.name}`} onClose={close}>
      {() => (
        <form onSubmit={save} className="space-y-4">
          <RoleChecks roles={roles} onChange={setRoles} disabled={busy} />
          <TextArea
            label="Reason (recorded in the audit log)"
            value={reason}
            maxLength={500}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
          />
          {error && <Alert>{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" busy={busy} disabled={!ok}>
              Save roles
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function AddAdmin({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [created, setCreated] = useState<string | null>(null);

  const problems = [
    name.trim().length < 2 && "a name",
    !/^\S+@\S+\.\S+$/.test(email.trim()) && "a valid email",
    password.length < 12 && "a password of at least 12 characters",
    roles.length === 0 && "at least one role",
  ].filter(Boolean);

  return (
    <Card title="Add an admin">
      {created && (
        <div className="mb-4">
          <Notice tone="blue">{created}</Notice>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextInput
          label="Email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInput
          label="Initial password (min 12 characters)"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="sm:row-span-2">
          <RoleChecks roles={roles} onChange={setRoles} />
        </div>
        <div className="flex items-end">
          <ConfirmAction
            label="Add admin"
            permission="manageAdmins"
            variant="primary"
            size="md"
            disabledReason={problems.length ? `Needs ${problems.join(", ")}` : undefined}
            title="Create admin user"
            description={
              <>
                Create <strong>{name.trim()}</strong> ({email.trim()}) with{" "}
                <strong>{roles.join(", ")}</strong>. Hand the password over out of band.
              </>
            }
            confirmLabel="Create"
            onConfirm={() =>
              api.post<AdminAccount>("/admin/users", {
                name: name.trim(),
                email: email.trim(),
                password,
                roles,
              })
            }
            onDone={(r) => {
              const a = r as AdminAccount;
              setCreated(`Created ${a.name} (${a.email}) with ${a.roles.join(", ")}.`);
              setName("");
              setEmail("");
              setPassword("");
              setRoles([]);
              onCreated();
            }}
          />
        </div>
      </div>
    </Card>
  );
}

/**
 * Staff accounts (zemfi's Admins page). SUPER_ADMIN only. The API refuses
 * deactivating yourself and removing the last active SUPER_ADMIN.
 */
export default function AdminsPage() {
  useDocumentTitle("Admins");
  const allowed = useCan("manageAdmins");
  const session = useAdmin();
  const meId = session.status === "ready" ? session.me.id : null;
  const res = useResource<{ items: AdminAccount[] }>(allowed ? "/admin/users" : null);
  const [editing, setEditing] = useState<AdminAccount | null>(null);

  if (!allowed) {
    return (
      <>
        <PageHeader title="Admins" />
        <Notice>Managing admin users needs SUPER_ADMIN.</Notice>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Admins" description="Who can sign in to this console." />
      <AddAdmin onCreated={res.reload} />

      <Card className="mt-6" title="Staff">
        <ErrorBox error={res.error} />
        {!res.data && res.loading && <Loading />}
        {res.data && res.data.items.length === 0 && <Empty>No admins.</Empty>}
        {res.data && res.data.items.length > 0 && (
          <Table head={["Name", "Roles", "Last signed in", "Added", "Actions"]}>
            {res.data.items.map((a) => {
              const isMe = a.id === meId;
              return (
                <tr key={a.id} className={a.active ? "" : "opacity-60"}>
                  <td>
                    <p className="font-medium text-foreground">
                      {a.name}
                      {isMe && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                    </p>
                    <p className="text-xs text-muted">{a.email}</p>
                    {!a.active && (
                      <Badge tone="danger" className="mt-1">
                        Deactivated
                      </Badge>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {a.roles.map((r) => (
                        <Badge key={r} tone={r === "SUPER_ADMIN" ? "info" : "neutral"}>
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-muted" title={formatDateTime(a.lastLoginAt)}>
                    {a.lastLoginAt ? age(a.lastLoginAt) : "Never"}
                  </td>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(a.createdAt)}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(a)}>
                        Roles
                      </Button>
                      {a.active ? (
                        <ConfirmAction
                          label="Deactivate"
                          permission="manageAdmins"
                          danger
                          disabledReason={isMe ? "You cannot deactivate yourself" : undefined}
                          title={`Deactivate ${a.name}`}
                          description="They are signed out at once and cannot sign in until reactivated."
                          textField={{ label: "Reason", minLength: 10, maxLength: 500 }}
                          onConfirm={({ text }) =>
                            api.post(`/admin/users/${a.id}/active`, { active: false, reason: text })
                          }
                          onDone={res.reload}
                        />
                      ) : (
                        <ConfirmAction
                          label="Reactivate"
                          permission="manageAdmins"
                          title={`Reactivate ${a.name}`}
                          description="They can sign in again with their existing password and roles."
                          textField={{ label: "Reason", minLength: 10, maxLength: 500 }}
                          onConfirm={({ text }) =>
                            api.post(`/admin/users/${a.id}/active`, { active: true, reason: text })
                          }
                          onDone={res.reload}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {editing && (
        <EditRoles
          account={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            res.reload();
          }}
        />
      )}
    </>
  );
}
