/**
 * Response shapes of the /admin endpoints, as the backend actually returns
 * them (docs/API.md does not spell most of them out). Amounts are kobo
 * strings; dates are ISO strings.
 */

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type TransactionStatus =
  | "CREATED"
  | "SUBMITTED"
  | "UNKNOWN"
  | "NEEDS_REVIEW"
  | "SUCCESSFUL"
  | "FAILED"
  | "REVERSED";
export const TRANSACTION_STATUSES: TransactionStatus[] = [
  "CREATED",
  "SUBMITTED",
  "UNKNOWN",
  "NEEDS_REVIEW",
  "SUCCESSFUL",
  "FAILED",
  "REVERSED",
];
export const TRANSACTION_KINDS = [
  "DEPOSIT",
  "TRANSFER_OUT",
  "REVERSAL",
  "ADJUSTMENT",
] as const;

export interface IntegrationHealth {
  webhooksLast24h: Record<string, number>;
  lastVerifiedWebhookAt: string | null;
  transfersInFlight: number;
  transfersNeedingReview: number;
  openExceptions: Record<string, number>;
}

export interface CustomerSummary {
  id: string;
  phoneNumber: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  tier: number;
  createdAt: string;
  accounts: { id: string; status: string; accountNumber: string | null }[];
}

export interface Account {
  id: string;
  status: string;
  accountNumber: string | null;
  accountName: string | null;
  bankName: string | null;
  bankCode: string | null;
  providerCode: string;
  currency: string;
  lastError: string | null;
  attempts: number;
  createdAt: string;
  ledgerBalanceMinor: string | null;
}

export interface CustomerDetail {
  id: string;
  phoneNumber: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  email: string | null;
  status: string;
  tier: number;
  pinFailures: number;
  pinLockedUntil: string | null;
  termsVersion: string;
  privacyVersion: string;
  consentedAt: string;
  createdAt: string;
  kycRecords: {
    id: string;
    checkType: string;
    provider: string;
    status: string;
    outcome: unknown;
    createdAt: string;
  }[];
  accounts: Account[];
  devices: {
    id: string;
    name: string | null;
    boundAt: string;
    revokedAt: string | null;
    lastSeenAt: string | null;
  }[];
}

export interface Transaction {
  id: string;
  reference: string;
  customerId: string | null;
  accountId: string | null;
  kind: string;
  direction: "CREDIT" | "DEBIT";
  status: TransactionStatus;
  amountMinor: string;
  feeMinor: string;
  currency: string;
  narration: string | null;
  counterpartyName: string | null;
  counterpartyBank: string | null;
  counterpartyBankCode: string | null;
  counterpartyAccount: string | null;
  providerCode: string;
  providerReference: string | null;
  originalId: string | null;
  failureReason: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  statusChecks: number;
  nextStatusCheckAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionDetail extends Transaction {
  events: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    source: string;
    detail: unknown;
    createdAt: string;
  }[];
  journals: {
    id: string;
    idempotencyKey: string;
    description: string;
    createdAt: string;
    entries: {
      id: string;
      side: "DEBIT" | "CREDIT";
      amountMinor: string;
      ledgerAccount: { code: string };
    }[];
  }[];
}

export interface ReconciliationRecord {
  id: string;
  kind: string;
  status: "OPEN" | "RESOLVED";
  providerCode: string;
  providerReference: string | null;
  transactionId: string | null;
  amountMinor: string | null;
  details: Record<string, unknown> | null;
  resolution: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface Adjustment {
  id: string;
  accountId: string;
  direction: "CREDIT" | "DEBIT";
  amountMinor: string;
  counterLedgerCode: string;
  reason: string;
  reconciliationId: string | null;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  requestedById: string;
  decidedById: string | null;
  decidedAt: string | null;
  transactionId: string | null;
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  providerCode: string;
  eventType: string | null;
  status: string;
  signatureOk: boolean;
  attempts: number;
  lastError: string | null;
  receivedAt: string;
  processedAt: string | null;
}

export const SUPPORT_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_CUSTOMER",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
] as const;

export interface SupportCase {
  id: string;
  reference: string;
  customerId: string;
  type: string;
  status: string;
  subject: string;
  transactionId: string | null;
  details: unknown;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id?: string;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string;
  };
}

export interface SupportCaseDetail extends SupportCase {
  events: {
    id: string;
    actorType: string;
    actorId: string | null;
    message: string | null;
    internal: boolean;
    fromStatus: string | null;
    toStatus: string | null;
    createdAt: string;
  }[];
}

export interface DailyReport {
  date: string;
  registrations: number;
  verifications: number;
  transactions: {
    kind: string;
    status: string;
    count: number;
    amountMinor: string;
    feeMinor: string;
  }[];
}

export interface AuditEntry {
  id: string;
  sequence: string;
  actorType: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  detail: unknown;
  ip: string | null;
  createdAt: string;
}

export interface LedgerAccount {
  id: string;
  code: string;
  type: string;
  balanceMinor: string;
}

export interface LedgerIntegrity {
  balanced: boolean;
  debits: string;
  credits: string;
  drift: { code: string; stored: string; computed: string }[];
}

export interface ComplianceSummary {
  pendingReviews: number;
  openHolds: number;
  failedLast24h: number;
  neverScreened: number;
}

/** A matched profile, or a group of adverse-media articles. */
export interface ScreeningHit {
  sourceType?: string;
  name?: string | string[];
  dateOfBirth?: string;
  country?: string | string[];
  positions?: unknown;
  mediaCategory?: string;
  articles?: { timestamp?: string; headline?: string; source?: string }[];
}

export interface ComplianceCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string;
}

export interface AmlScreening {
  id: string;
  customerId: string;
  subjectName: string;
  trigger: string;
  provider: string;
  status: "CLEAR" | "POTENTIAL_MATCH" | "FAILED";
  matchStatus: string | null;
  riskLevel: string | null;
  resultCount: number;
  results: ScreeningHit[] | null;
  error: string | null;
  reviewStatus: "PENDING" | "FALSE_POSITIVE" | "CONFIRMED_MATCH";
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  customer: ComplianceCustomer;
}

export interface ComplianceHold {
  id: string;
  customerId: string;
  source: "SCREENING" | "MONITORING" | "MANUAL";
  sourceId: string | null;
  reason: string;
  createdBy: string | null;
  createdAt: string;
  releasedAt: string | null;
  releasedBy: string | null;
  releaseNote: string | null;
  customer: ComplianceCustomer;
}
