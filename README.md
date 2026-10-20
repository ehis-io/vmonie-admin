# Vmonie Personal — Operations Console

Internal web console for Vmonie Personal staff: customers and accounts,
transfers, reconciliation, balance adjustments, support cases, webhooks,
reports and the audit log. It talks only to the `/admin` API described in
`../docs/API.md`.

Built with Next.js 16 (App Router), React 19, Tailwind 4 and TypeScript, the
same stack as `dutchman-bridge/admin-app`. Read `AGENTS.md` before changing
framework code: this Next.js version differs from older docs.

## Run it

```bash
cp .env.example .env.local   # optional; the default is the local backend
npm install
npm run dev                  # http://localhost:3101
```

The backend must be running (`../backend`, port 4100). Dev login:
`ops@vmonie.dev` / `dev-password-123` (SUPER_ADMIN).

| Variable              | Default                        | Description |
| --------------------- | ------------------------------ | ----------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4100/api/v1` | API base URL including `/api/v1`. Inlined at build time, so set it before `next build`. |

| Command         | What it does                     |
| --------------- | -------------------------------- |
| `npm run dev`   | Dev server on port 3101          |
| `npm run build` | Production build                 |
| `npm start`     | Serve the production build, 3101 |
| `npm run lint`  | ESLint                           |

Type-check with `npx tsc --noEmit`.

## Screens

| Screen | Path | For |
| --- | --- | --- |
| Login | `/login` | Staff sign-in. |
| Dashboard | `/dashboard` | Integration tiles (transfers in flight, needing review, open exceptions by kind, webhooks in the last 24h by status, last verified webhook) and the pending-transfer queue, oldest first. |
| Customers | `/dashboard/customers` | Search by phone, name, full account number or id. |
| Customer | `/dashboard/customers/:id` | Profile, identity checks, accounts with ledger balance, devices. Actions: reveal the account number (needs a reason, audited), restrict/unrestrict, freeze/unfreeze, retry account opening, and a link to the customer's transactions. |
| Transactions | `/dashboard/transactions` | Filter by status, kind, reference or customer id, with cursor paging. |
| Transaction | `/dashboard/transactions/:id` | Event timeline and ledger journals. Actions: requery the partner (never resends), and resolve by hand (NEEDS_REVIEW only, with an outcome and a reason). |
| Reconciliation | `/dashboard/reconciliation` | Open and resolved exceptions, resolve with a note, run reconciliation for a Lagos date. An unmatched deposit can be assigned through an adjustment that is pre-filled with SUSPENSE, the amount and the exception id. |
| Adjustments | `/dashboard/adjustments` | Requests by status, approve/reject. The requester cannot decide their own (four-eyes). |
| Request adjustment | `/dashboard/adjustments/new` | Pick the account by searching customers, then direction, amount in naira, counter ledger and reason. |
| Support cases | `/dashboard/support` | The queue by status. |
| Support case | `/dashboard/support/:id` | The full thread, with internal notes highlighted. Reply to the customer, add an internal note, change the status, assign to me. |
| Webhooks | `/dashboard/webhooks` | Inbound partner events, filterable by status. |
| Reports | `/dashboard/reports` | Daily totals for a date (FINANCE/OPERATIONS), plus system ledger balances and an integrity check (FINANCE). |
| Audit log | `/dashboard/audit` | Privileged-action log and "Verify chain" (COMPLIANCE). |
| Admin users | `/dashboard/admin-users` | Create staff accounts (SUPER_ADMIN). |

## Rules the code keeps

- **Money** arrives as kobo strings and never becomes a JS `number`.
  `src/lib/money.ts` formats it with BigInt and parses typed naira with
  string arithmetic.
- **Session**: the admin token is kept in memory and mirrored to
  `sessionStorage`, never `localStorage` or a cookie. Any 401 clears it and
  returns to `/login`.
- **Masking**: account numbers stay masked. The full number appears only after
  the audited Reveal, lives in component state, and is gone on navigation.
- **Confirmation**: every state-changing action goes through
  `ConfirmAction`. It shows a confirm dialog with the reason/note field the
  API takes (and its minimum length), and blocks double submits while the
  request is in flight.
- **Roles**: `src/lib/access.ts` mirrors the backend's `@Roles()`. Actions an
  admin cannot perform are disabled, and hovering one shows the role it
  needs. A 403 from the API still shows its message and the required role.
