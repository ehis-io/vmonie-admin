"use client";

import { useState } from "react";
import { api, type AdminRole } from "../../../lib/api";
import { useCan } from "../../../lib/access";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { ConfirmAction } from "../../../components/ConfirmAction";
import { Card, Label, Notice, PageHeader, TextInput } from "../../../components/ui";

const ROLES: { role: AdminRole; help: string }[] = [
  { role: "SUPPORT", help: "Support cases, reveal account numbers, requery, retry account opening" },
  { role: "OPERATIONS", help: "Freeze/restrict, reconciliation, request adjustments, reports" },
  { role: "FINANCE", help: "Resolve transfers, approve adjustments, reconciliation, ledger, reports" },
  { role: "COMPLIANCE", help: "Freeze/unfreeze, restrict/unrestrict, reveal, audit log" },
  { role: "SUPER_ADMIN", help: "Everything, including creating admin users" },
];

interface Created {
  id: string;
  email: string;
  name: string;
  roles: AdminRole[];
}

export default function AdminUsersPage() {
  useDocumentTitle("Admin users");
  const allowed = useCan("createAdmin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [created, setCreated] = useState<Created | null>(null);

  const problems = [
    name.trim().length < 2 && "a name",
    !/^\S+@\S+\.\S+$/.test(email.trim()) && "a valid email",
    password.length < 12 && "a password of at least 12 characters",
    roles.length === 0 && "at least one role",
  ].filter(Boolean);

  if (!allowed) {
    return (
      <>
        <PageHeader title="Admin users" />
        <Notice>Creating admin users needs SUPER_ADMIN.</Notice>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Admin users"
        description="Create a staff account. Hand the password over out of band."
      />
      {created && (
        <div className="mb-4 max-w-2xl">
          <Notice tone="blue">
            Created {created.name} ({created.email}) with {created.roles.join(", ")}.
          </Notice>
        </div>
      )}
      <Card className="max-w-2xl">
        <div className="space-y-4">
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
          <fieldset>
            <Label>Roles</Label>
            <div className="space-y-2">
              {ROLES.map(({ role, help }) => (
                <label key={role} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={roles.includes(role)}
                    onChange={(e) =>
                      setRoles((r) => (e.target.checked ? [...r, role] : r.filter((x) => x !== role)))
                    }
                  />
                  <span>
                    <span className="font-medium">{role}</span>
                    <span className="block text-xs text-muted-foreground">{help}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <ConfirmAction
            label="Create admin"
            permission="createAdmin"
            variant="primary"
            size="md"
            disabledReason={problems.length ? `Needs ${problems.join(", ")}` : undefined}
            title="Create admin user"
            description={
              <>
                Create <strong>{name.trim()}</strong> ({email.trim()}) with{" "}
                <strong>{roles.join(", ")}</strong>.
              </>
            }
            confirmLabel="Create"
            onConfirm={() =>
              api.post<Created>("/admin/users", {
                name: name.trim(),
                email: email.trim(),
                password,
                roles,
              })
            }
            onDone={(r) => {
              setCreated(r as Created);
              setName("");
              setEmail("");
              setPassword("");
              setRoles([]);
            }}
          />
        </div>
      </Card>
    </>
  );
}
