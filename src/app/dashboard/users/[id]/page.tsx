"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, qs } from "../../../../lib/api";
import { useCan } from "../../../../lib/access";
import { age, formatDateTime, humanize } from "../../../../lib/format";
import { formatKobo } from "../../../../lib/money";
import { useDocumentTitle } from "../../../../lib/useDocumentTitle";
import { useResource } from "../../../../lib/useResource";
import type {
  Account,
  AmlScreening,
  ComplianceHold,
  CustomerDetail,
  Page,
  Transaction,
} from "../../../../lib/types";
import { ConfirmAction } from "../../../../components/ConfirmAction";
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  Json,
  KeyValues,
  Loading,
  Notice,
  PageHeader,
  Table,
} from "../../../../components/ui";

const REASON = { label: "Reason", minLength: 10, maxLength: 500 };

function AccountNumber({ account }: { account: Account }) {
  // Held in component state only: gone on navigation, never stored.
  const [revealed, setRevealed] = useState<string | null>(null);
  if (!account.accountNumber) return <span>—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono">{revealed ?? account.accountNumber}</span>
      {revealed ? (
        <button
          type="button"
          className="text-xs text-primary-soft hover:underline"
          onClick={() => setRevealed(null)}
        >
          Hide
        </button>
      ) : (
        <ConfirmAction
          label="Reveal"
          permission="revealAccount"
          variant="ghost"
          title="Reveal full account number"
          description="Revealing the number is recorded in the audit log with your reason."
          textField={{
            ...REASON,
            placeholder: "e.g. Customer on call (case VMS-123) asked to confirm their account number",
          }}
          onConfirm={async ({ text }) => {
            const res = await api.post<{ accountNumber: string }>(
              `/admin/accounts/${account.id}/reveal`,
              { reason: text },
            );
            setRevealed(res.accountNumber);
          }}
        />
      )}
    </span>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const res = useResource<CustomerDetail>(`/admin/customers/${id}`);
  // Compliance only: the routes refuse everyone else, so do not ask.
  const compliance = useCan("manageCompliance");
  const holds = useResource<ComplianceHold[]>(
    compliance ? `/admin/compliance/holds${qs({ customerId: id, open: "true" })}` : null,
  );
  const screenings = useResource<AmlScreening[]>(
    compliance ? `/admin/compliance/screenings${qs({ customerId: id })}` : null,
  );
  const recent = useResource<Page<Transaction>>(
    `/admin/transactions${qs({ customerId: id, limit: "10" })}`,
  );
  const reloadCompliance = () => {
    holds.reload();
    screenings.reload();
  };
  const c = res.data;
  const name = c
    ? [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ") ||
      "(no name yet)"
    : "Customer";
  useDocumentTitle(name);

  if (!c) {
    return res.error ? <ErrorBox error={res.error} /> : <Loading />;
  }

  const restricted = c.status === "RESTRICTED";
  const hasWorkingAccount = c.accounts.some(
    (a) => a.status === "ACTIVE" || a.status === "FROZEN",
  );

  return (
    <>
      <PageHeader
        title={name}
        description={<span className="font-mono text-xs">{c.id}</span>}
        actions={
          <>
            <Link
              href={`/dashboard/transactions?customerId=${c.id}`}
              className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/60 hover:bg-surface-raised"
            >
              Transactions
            </Link>
            {restricted ? (
              <ConfirmAction
                label="Unrestrict"
                permission="unrestrictCustomer"
                title="Lift the restriction"
                description="The customer will be able to transact again."
                textField={REASON}
                onConfirm={({ text }) =>
                  api.post(`/admin/customers/${c.id}/unrestrict`, { reason: text })
                }
                onDone={res.reload}
              />
            ) : (
              <ConfirmAction
                label="Restrict"
                permission="restrictCustomer"
                danger
                title="Restrict this customer"
                description="A restricted customer cannot transact. Lifting it needs COMPLIANCE."
                textField={REASON}
                onConfirm={({ text }) =>
                  api.post(`/admin/customers/${c.id}/restrict`, { reason: text })
                }
                onDone={res.reload}
              />
            )}
            <ConfirmAction
              label="Screen now"
              permission="manageCompliance"
              disabledReason={c.firstName ? undefined : "No verified name to screen yet"}
              title="Screen against PEP, sanctions and adverse-media lists"
              description="Runs a screening now, outside the yearly cycle. A match holds the customer's transfers until reviewed."
              confirmLabel="Screen"
              onConfirm={() => api.post(`/admin/compliance/customers/${c.id}/screen`)}
              onDone={reloadCompliance}
            />
            <ConfirmAction
              label="Hold transfers"
              permission="manageCompliance"
              danger
              title="Hold this customer's transfers"
              description="Transfers out are refused until the hold is released; deposits still arrive. The customer is told only that their account is under review."
              textField={REASON}
              confirmLabel="Hold"
              onConfirm={({ text }) =>
                api.post(`/admin/compliance/customers/${c.id}/holds`, { note: text })
              }
              onDone={reloadCompliance}
            />
            <ConfirmAction
              label="Reset PIN"
              permission="customerSecurity"
              danger
              disabledReason={c.pinResetRequired ? "A PIN reset is already pending" : undefined}
              title="Force a PIN reset"
              description="The current PIN stops working at once and every session ends. The customer sets a new PIN with “Forgot PIN” (OTP) on their registered phone. You never see or choose the PIN."
              textField={REASON}
              confirmLabel="Reset PIN"
              onConfirm={({ text }) =>
                api.post(`/admin/customers/${c.id}/reset-pin`, { reason: text })
              }
              onDone={res.reload}
            />
            <ConfirmAction
              label="Retry account opening"
              permission="retryAccountOpening"
              disabledReason={
                hasWorkingAccount ? "The customer already has an account" : undefined
              }
              title="Retry account opening"
              description="Asks the bank to open the account again with the same request reference, so a duplicate is not created."
              confirmLabel="Retry"
              onConfirm={() =>
                api.post(`/admin/customers/${c.id}/retry-account-opening`)
              }
              onDone={res.reload}
            />
          </>
        }
      />
      <ErrorBox error={res.error} />
      {c.pinResetRequired && (
        <div className="mb-4">
          <Notice>
            PIN reset pending: the customer cannot sign in or send money until they set a new
            PIN with “Forgot PIN” on their registered phone.
          </Notice>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profile">
          <KeyValues
            rows={[
              ["Status", <Badge key="s">{c.status}</Badge>],
              ["Tier", c.tier],
              ["Phone", <span key="p" className="font-mono">{c.phoneNumber}</span>],
              ["Email", c.email],
              ["Date of birth", c.dateOfBirth?.slice(0, 10)],
              ["PIN failures", c.pinFailures],
              ["PIN reset required", c.pinResetRequired ? "Yes" : "No"],
              ["Bridge KYC", c.dutchmanKycStatus ? <Badge key="b">{c.dutchmanKycStatus}</Badge> : "—"],
              ["PIN locked until", c.pinLockedUntil ? formatDateTime(c.pinLockedUntil) : "—"],
              ["Consents", `Terms ${c.termsVersion}, privacy ${c.privacyVersion} (${formatDateTime(c.consentedAt)})`],
              ["Joined", formatDateTime(c.createdAt)],
            ]}
          />
        </Card>

        <Card title="Identity checks">
          {c.kycRecords.length === 0 ? (
            <Empty>No identity checks yet.</Empty>
          ) : (
            <Table head={["Type", "Status", "Provider", "Outcome", "When"]}>
              {c.kycRecords.map((k) => (
                <tr key={k.id}>
                  <td>{k.checkType}</td>
                  <td>
                    <Badge>{k.status}</Badge>
                  </td>
                  <td>{k.provider}</td>
                  <td>
                    <Json value={k.outcome} />
                  </td>
                  <td className="whitespace-nowrap">{formatDateTime(k.createdAt)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <Card title="Accounts" className="mt-4">
        {c.accounts.length === 0 ? (
          <Empty>No account has been requested.</Empty>
        ) : (
          <Table
            head={["Account number", "Status", "Bank", "Ledger balance", "Opening", "Actions"]}
          >
            {c.accounts.map((a) => (
              <tr key={a.id}>
                <td>
                  <AccountNumber account={a} />
                  <span className="block text-xs text-muted">
                    {a.accountName}
                  </span>
                </td>
                <td>
                  <Badge>{a.status}</Badge>
                </td>
                <td>{a.bankName ?? a.providerCode}</td>
                <td className="tabular-nums">
                  {a.ledgerBalanceMinor === null ? "—" : formatKobo(a.ledgerBalanceMinor)}
                </td>
                <td className="text-xs">
                  {a.attempts} attempt{a.attempts === 1 ? "" : "s"}
                  {a.lastError && (
                    <span className="block text-danger">{a.lastError}</span>
                  )}
                </td>
                <td>
                  {a.status === "ACTIVE" && (
                    <ConfirmAction
                      label="Freeze"
                      permission="freezeAccount"
                      danger
                      title="Freeze this account"
                      description="Post-no-debit: money can still arrive, nothing can leave. Unfreezing needs COMPLIANCE."
                      textField={REASON}
                      onConfirm={({ text }) =>
                        api.post(`/admin/accounts/${a.id}/freeze`, { reason: text })
                      }
                      onDone={res.reload}
                    />
                  )}
                  {a.status === "FROZEN" && (
                    <ConfirmAction
                      label="Unfreeze"
                      permission="unfreezeAccount"
                      title="Unfreeze this account"
                      description="Refused while the ledger balance is negative: recover the shortfall with an adjustment first."
                      textField={REASON}
                      onConfirm={({ text }) =>
                        api.post(`/admin/accounts/${a.id}/unfreeze`, { reason: text })
                      }
                      onDone={res.reload}
                    />
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {compliance && (
        <Card
          title="Compliance"
          className="mt-4"
          actions={
            <Link
              href="/dashboard/compliance"
              className="text-xs text-primary-soft hover:underline"
            >
              Compliance console
            </Link>
          }
        >
          <ErrorBox error={holds.error ?? screenings.error} />
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
            Open holds
          </p>
          {holds.data && holds.data.length === 0 && (
            <p className="mb-4 text-sm text-muted">None. Transfers are not held.</p>
          )}
          {holds.data && holds.data.length > 0 && (
            <ul className="mb-4 space-y-2 text-sm">
              {holds.data.map((h) => (
                <li key={h.id} className="flex flex-wrap items-start justify-between gap-2">
                  <span>
                    <Badge tone="red">{humanize(h.source)}</Badge>{" "}
                    {h.reason}
                    <span className="block text-xs text-muted">
                      Since {formatDateTime(h.createdAt)}
                    </span>
                  </span>
                  <ConfirmAction
                    label="Release"
                    permission="manageCompliance"
                    size="sm"
                    title="Release this hold"
                    description="The customer will be able to send transfers again, unless another hold is open."
                    textField={REASON}
                    confirmLabel="Release"
                    onConfirm={({ text }) =>
                      api.post(`/admin/compliance/holds/${h.id}/release`, { note: text })
                    }
                    onDone={reloadCompliance}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
            Screenings
          </p>
          {screenings.data && screenings.data.length === 0 && (
            <p className="text-sm text-muted">Not screened yet.</p>
          )}
          {screenings.data && screenings.data.length > 0 && (
            <Table head={["When", "Result", "Review", "Note"]}>
              {screenings.data.slice(0, 10).map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap">
                    {formatDateTime(s.createdAt)}
                    <span className="block text-xs text-muted">{humanize(s.trigger)}</span>
                  </td>
                  <td>
                    <Badge>{s.status}</Badge>
                  </td>
                  <td>
                    {s.status === "POTENTIAL_MATCH" ? <Badge>{s.reviewStatus}</Badge> : "—"}
                  </td>
                  <td className="max-w-xs text-xs text-muted">
                    {s.reviewNote ?? s.error ?? ""}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      <Card
        title="Recent transactions"
        className="mt-4"
        actions={
          <Link
            href={`/dashboard/transactions?customerId=${c.id}`}
            className="text-xs font-semibold text-primary-soft hover:underline"
          >
            View all
          </Link>
        }
      >
        <ErrorBox error={recent.error} />
        {!recent.data && recent.loading && <Loading />}
        {recent.data && recent.data.items.length === 0 && (
          <Empty>No transactions yet.</Empty>
        )}
        {recent.data && recent.data.items.length > 0 && (
          <Table head={["Reference", "Kind", "Status", "Amount", "Counterparty", "When"]}>
            {recent.data.items.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link
                    href={`/dashboard/transactions/${t.id}`}
                    className="font-mono text-xs text-primary-soft hover:underline"
                  >
                    {t.reference}
                  </Link>
                </td>
                <td className="whitespace-nowrap">
                  {humanize(t.kind)}
                  <span className="block text-xs text-muted">{t.direction}</span>
                </td>
                <td>
                  <Badge>{t.status}</Badge>
                </td>
                <td className="whitespace-nowrap tabular-nums">
                  {formatKobo(t.amountMinor)}
                </td>
                <td>
                  {t.counterpartyName ?? "—"}
                  <span className="block text-xs text-muted">
                    {t.counterpartyBank} {t.counterpartyAccount}
                  </span>
                </td>
                <td className="whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card
        title="Devices and sessions"
        className="mt-4"
        actions={
          <ConfirmAction
            label="Sign out everywhere"
            permission="customerSecurity"
            danger
            title="Sign this customer out everywhere"
            description="Ends every session. Their devices stay registered, so they sign in again with their PIN."
            textField={REASON}
            confirmLabel="Sign out"
            onConfirm={({ text }) =>
              api.post(`/admin/customers/${c.id}/sessions/revoke`, { reason: text })
            }
            onDone={res.reload}
          />
        }
      >
        {c.devices.length === 0 ? (
          <Empty>No devices.</Empty>
        ) : (
          <Table head={["Name", "Bound", "Last seen", "Sessions", "State", ""]}>
            {c.devices.map((d) => {
              const live = d.sessions ?? [];
              return (
                <tr key={d.id}>
                  <td>{d.name ?? "(unnamed)"}</td>
                  <td className="whitespace-nowrap">{formatDateTime(d.boundAt)}</td>
                  <td className="whitespace-nowrap">{formatDateTime(d.lastSeenAt)}</td>
                  <td className="text-xs">
                    {live.length === 0
                      ? "None"
                      : live.map((s) => (
                          <span key={s.id} className="block whitespace-nowrap">
                            Since {formatDateTime(s.createdAt)}
                            {s.lastRefreshedAt && (
                              <span className="text-muted"> · active {age(s.lastRefreshedAt)}</span>
                            )}
                          </span>
                        ))}
                  </td>
                  <td>
                    {d.revokedAt ? (
                      <Badge tone="gray">Revoked {formatDateTime(d.revokedAt)}</Badge>
                    ) : (
                      <Badge tone="green">{humanize("ACTIVE")}</Badge>
                    )}
                  </td>
                  <td className="text-right">
                    {!d.revokedAt && (
                      <ConfirmAction
                        label="Revoke"
                        permission="customerSecurity"
                        danger
                        title={`Revoke ${d.name ?? "this device"}`}
                        description="Signs the device out at once. Using it again needs an OTP device change."
                        textField={REASON}
                        confirmLabel="Revoke"
                        onConfirm={({ text }) =>
                          api.post(`/admin/devices/${d.id}/revoke`, { reason: text })
                        }
                        onDone={res.reload}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
