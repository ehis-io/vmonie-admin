"use client";

import { useState } from "react";
import { qs } from "../../../lib/api";
import { useCan } from "../../../lib/access";
import { humanize, lagosToday } from "../../../lib/format";
import { formatKobo } from "../../../lib/money";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { useResource } from "../../../lib/useResource";
import type { DailyReport, LedgerAccount, LedgerIntegrity } from "../../../lib/types";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  KeyValues,
  Loading,
  Notice,
  PageHeader,
  Table,
  TextInput,
} from "../../../components/ui";

function Daily({ date }: { date: string }) {
  const res = useResource<DailyReport>(`/admin/reports/daily${qs({ date })}`);
  const r = res.data;
  return (
    <Card title={`Daily report, ${date} (Lagos)`}>
      <ErrorBox error={res.error} />
      {!r && res.loading && <Loading />}
      {r && (
        <>
          <div className="mb-4">
            <KeyValues
              rows={[
                ["Registrations", r.registrations],
                ["Identity verifications", r.verifications],
              ]}
            />
          </div>
          {r.transactions.length === 0 ? (
            <Empty>No transactions that day.</Empty>
          ) : (
            <Table head={["Kind", "Status", "Count", "Amount", "Fees"]}>
              {r.transactions.map((t) => (
                <tr key={`${t.kind}-${t.status}`}>
                  <td>{humanize(t.kind)}</td>
                  <td>
                    <Badge>{t.status}</Badge>
                  </td>
                  <td className="tabular-nums">{t.count}</td>
                  <td className="tabular-nums">{formatKobo(t.amountMinor)}</td>
                  <td className="tabular-nums">{formatKobo(t.feeMinor)}</td>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}
    </Card>
  );
}

function Ledger() {
  const system = useResource<LedgerAccount[]>("/admin/ledger/system");
  const [check, setCheck] = useState(false);
  const integrity = useResource<LedgerIntegrity>(check ? "/admin/ledger/integrity" : null);
  const i = integrity.data;
  return (
    <Card
      title="Ledger (FINANCE)"
      className="mt-4"
      actions={
        <Button
          size="sm"
          variant="secondary"
          busy={integrity.loading}
          onClick={() => (check ? integrity.reload() : setCheck(true))}
        >
          Check integrity
        </Button>
      }
    >
      <ErrorBox error={system.error ?? integrity.error} />
      {i && (
        <div className="mb-4">
          {i.balanced && i.drift.length === 0 ? (
            <Notice tone="blue">
              Balanced: debits {formatKobo(i.debits)} = credits {formatKobo(i.credits)}; no
              account drift.
            </Notice>
          ) : (
            <Notice>
              <strong>Integrity failure.</strong> Debits {formatKobo(i.debits)}, credits{" "}
              {formatKobo(i.credits)}; {i.drift.length} account(s) drifting:{" "}
              {i.drift.map((d) => `${d.code} stored ${formatKobo(d.stored)} vs computed ${formatKobo(d.computed)}`).join("; ")}
            </Notice>
          )}
        </div>
      )}
      {system.data && (
        <Table head={["System ledger", "Type", "Balance"]}>
          {system.data.map((l) => (
            <tr key={l.id}>
              <td className="font-mono text-xs">{l.code}</td>
              <td>{l.type}</td>
              <td className="tabular-nums">{formatKobo(l.balanceMinor)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

export default function ReportsPage() {
  useDocumentTitle("Reports");
  const canReports = useCan("viewReports");
  const canLedger = useCan("viewLedger");
  const [draft, setDraft] = useState(lagosToday());
  const [date, setDate] = useState(lagosToday());

  return (
    <>
      <PageHeader title="Reports" description="Daily activity totals, by Lagos calendar day." />
      {!canReports ? (
        <Notice>Reports need the FINANCE or OPERATIONS role.</Notice>
      ) : (
        <>
          <form
            className="mb-4 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (/^\d{4}-\d{2}-\d{2}$/.test(draft)) setDate(draft);
            }}
          >
            <TextInput label="Date" type="date" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit">Show</Button>
          </form>
          <Daily key={date} date={date} />
        </>
      )}
      {canLedger && <Ledger />}
    </>
  );
}
