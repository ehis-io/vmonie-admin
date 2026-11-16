"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, describeError, qs } from "../../../lib/api";
import { can, requiredHint, useAdmin } from "../../../lib/access";
import { formatDateTime, humanize } from "../../../lib/format";
import { formatKobo } from "../../../lib/money";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import {
  BUSINESS_STATUSES,
  type BusinessListItem,
  type BusinessSummary,
} from "../../../lib/types";
import { Modal } from "../../../components/Modal";
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Loading,
  Notice,
  PageHeader,
  Table,
  TextInput,
} from "../../../components/ui";

const TABS = ["", ...BUSINESS_STATUSES] as const;

const EMPTY_FORM = {
  name: "",
  rcNumber: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
};

/** POST /admin/businesses. Creates it PENDING; another person approves. */
function CreateBusiness({ onCreated }: { onCreated: (b: BusinessSummary) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const close = () => {
    if (inFlight.current) return;
    setOpen(false);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    const name = form.name.trim();
    const contactEmail = form.contactEmail.trim();
    if (name.length < 2) return setError("Enter the business's registered name.");
    if (!/^\S+@\S+\.\S+$/.test(contactEmail))
      return setError("Enter a contact email address.");
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const optional = (v: string) => (v.trim() ? v.trim() : undefined);
      const created = await api.post<BusinessSummary>("/admin/businesses", {
        name,
        contactEmail,
        rcNumber: optional(form.rcNumber),
        contactName: optional(form.contactName),
        contactPhone: optional(form.contactPhone),
      });
      inFlight.current = false;
      setBusy(false);
      setOpen(false);
      setForm(EMPTY_FORM);
      onCreated(created);
    } catch (err) {
      inFlight.current = false;
      setBusy(false);
      setError(describeError(err));
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>New business</Button>
      <Modal open={open} title="New business" onClose={close} wide>
        {() => (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-muted">
              The business starts as Pending. A different COMPLIANCE admin
              approves it before it can be funded or use its API keys.
            </p>
            <TextInput
              label="Registered name"
              value={form.name}
              onChange={set("name")}
              maxLength={120}
              required
              autoFocus
            />
            <TextInput
              label="RC number (optional)"
              value={form.rcNumber}
              onChange={set("rcNumber")}
              maxLength={30}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Contact name (optional)"
                value={form.contactName}
                onChange={set("contactName")}
                maxLength={120}
              />
              <TextInput
                label="Contact phone (optional)"
                value={form.contactPhone}
                onChange={set("contactPhone")}
                maxLength={30}
              />
            </div>
            <TextInput
              label="Contact email"
              type="email"
              value={form.contactEmail}
              onChange={set("contactEmail")}
              required
            />
            {error && <Alert>{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" busy={busy}>
                Create business
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

/**
 * Business API accounts: businesses that buy bills through Vmonie's API from
 * a wallet they prefund by bank transfer.
 */
export default function BusinessesPage() {
  useDocumentTitle("Businesses");
  const router = useRouter();
  const session = useAdmin();
  const me = session.status === "ready" ? session.me : null;
  const allowed = me ? can(me.roles, "viewBusinesses") : false;
  const canCreate = me ? can(me.roles, "createBusiness") : false;
  const [status, setStatus] = useState<(typeof TABS)[number]>("");
  const res = useResource<BusinessListItem[]>(
    allowed ? `/admin/businesses${qs({ status })}` : null,
  );

  return (
    <>
      <PageHeader
        title="Businesses"
        description="Businesses that buy bills through the Vmonie API from a prefunded wallet."
        actions={
          <>
            {me && can(me.roles, "viewBusinessTopUps") && (
              <Link
                href="/dashboard/businesses/top-ups"
                className="text-sm text-primary-soft hover:underline"
              >
                Top-up approvals
              </Link>
            )}
            {canCreate ? (
              <CreateBusiness
                onCreated={(b) => router.push(`/dashboard/businesses/${b.id}`)}
              />
            ) : (
              me && (
                <span className="text-xs text-muted">
                  Creating needs OPERATIONS or COMPLIANCE
                </span>
              )
            )}
          </>
        }
      />
      {me && !allowed && <Notice>{requiredHint("viewBusinesses")}.</Notice>}
      {allowed && (
        <>
          <div className="mb-3 flex flex-wrap gap-2" role="tablist">
            {TABS.map((s) => (
              <button
                key={s || "all"}
                role="tab"
                aria-selected={status === s}
                onClick={() => setStatus(s)}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  status === s
                    ? "bg-primary text-white"
                    : "border border-surface-border bg-surface"
                }`}
              >
                {s ? humanize(s) : "All"}
              </button>
            ))}
          </div>
          <Card>
            <ErrorBox error={res.error} />
            {!res.data && res.loading && <Loading />}
            {res.data && res.data.length === 0 && <Empty>No businesses.</Empty>}
            {res.data && res.data.length > 0 && (
              <Table head={["Business", "Contact", "Status", "Wallet", "Created"]}>
                {res.data.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link
                        href={`/dashboard/businesses/${b.id}`}
                        className="font-medium text-primary-soft hover:underline"
                      >
                        {b.name}
                      </Link>
                      {b.rcNumber && (
                        <span className="block text-xs text-muted">RC {b.rcNumber}</span>
                      )}
                    </td>
                    <td>
                      {b.contactName ?? "—"}
                      <span className="block text-xs text-muted">{b.contactEmail}</span>
                    </td>
                    <td>
                      <Badge>{b.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {formatKobo(b.balanceMinor)}
                    </td>
                    <td className="whitespace-nowrap">{formatDateTime(b.createdAt)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}
    </>
  );
}
