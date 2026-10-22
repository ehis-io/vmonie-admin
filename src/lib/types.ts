/**
 * Response shapes of the /admin endpoints, as the backend actually returns
 * them (docs/API.md does not spell most of them out). Amounts are kobo
 * strings; dates are ISO strings.
 */
import type { AdminRole } from "./api";

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
  "BILL_PAYMENT",
] as const;

/** What a BILL_PAYMENT bought. The token itself never reaches staff. */
export interface BillInfo {
  type: "AIRTIME" | "DATA" | "CABLE_TV" | "ELECTRICITY";
  categoryId: string;
  billerName: string;
  productCode: string | null;
  productName: string | null;
  customerIdentifier: string;
  customerName: string | null;
  vendType: string | null;
  address: string | null;
  providerBillId: string | null;
  providerFeeMinor: string | null;
  vmonieFeeMinor: string | null;
  hasToken: boolean;
}

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
  /** Staff forced a PIN reset; cleared when the customer resets it. */
  pinResetRequired?: boolean;
  dutchmanCustomerId?: string | null;
  dutchmanKycStatus?: string | null;
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
    /** Live sign-ins on the device. */
    sessions?: {
      id: string;
      createdAt: string;
      lastRefreshedAt: string | null;
      expiresAt: string;
    }[];
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
  /** Only on BILL_PAYMENT. */
  bill?: BillInfo | null;
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

// ─── Feature flags (GET /admin/features) ─────────────────────────────────

export type FeatureStatus = "LIVE" | "COMING_SOON" | "OFF";

export const FEATURE_STATUSES: FeatureStatus[] = ["LIVE", "COMING_SOON", "OFF"];

/** What each state means for a customer, shown under the selector. */
export const FEATURE_STATUS_HINTS: Record<FeatureStatus, string> = {
  LIVE: "Customers can use it.",
  COMING_SOON: "Shown as not launched yet. Requests are refused.",
  OFF: "Paused. Requests are refused with the message below.",
};

export interface FeatureFlag {
  key: string;
  label: string;
  status: FeatureStatus;
  /** Only LIVE is usable. */
  enabled: boolean;
  message: string | null;
  /** Admin id of whoever last changed it; null if never changed. */
  updatedBy: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

// ─── Fees (GET /admin/fees), read live from Dutchman Bridge ─────────────

export interface FeeRule {
  flow: string;
  label: string;
  /** ISO code, or `*` for every currency. */
  currency: string;
  feeBps: number;
  /** Naira, decimal strings. */
  feeFlat: string;
  feeMin: string | null;
  feeMax: string | null;
  active: boolean;
  /** False when Bridge holds no rule yet (charges nothing). */
  configured: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
  lastReason: string | null;
}

export interface FeeEarning {
  currency: string;
  /** Decimal strings. */
  amount: string;
  held: string;
}

// ─── Admins (GET /admin/users) ───────────────────────────────────────────

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  roles: AdminRole[];
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

// ─── KYC queue (GET /admin/kyc) ──────────────────────────────────────────

export type KycQueueStatus =
  | "MANUAL_REVIEW"
  | "PENDING"
  | "MISMATCH"
  | "ERROR"
  | "VERIFIED"
  | "NONE";

export const KYC_QUEUE_STATUSES: KycQueueStatus[] = [
  "MANUAL_REVIEW",
  "PENDING",
  "MISMATCH",
  "ERROR",
  "NONE",
  "VERIFIED",
];

export const KYC_QUEUE_HINTS: Record<KycQueueStatus, string> = {
  MANUAL_REVIEW: "The provider could not decide: someone has to look at these.",
  PENDING: "Checks sent and not answered yet.",
  MISMATCH: "The registry answered, but the details did not match what the customer entered.",
  ERROR: "The provider could not answer (outage or timeout). Safe to retry.",
  NONE: "Signed up, no identity check yet.",
  VERIFIED: "Identity verified.",
};

export interface KycQueueItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string;
  status: string;
  tier: number;
  bridgeKycStatus: string | null;
  createdAt: string;
  kycStatus: KycQueueStatus;
  latestCheck: { checkType: string; provider: string; at: string } | null;
  waitingSince: string;
}

// ─── Overview (GET /admin/stats) ─────────────────────────────────────────

export interface OverviewStats {
  customers: {
    total: number;
    byStatus: Record<string, number>;
    byTier: Record<string, number>;
    newLast7Days: number;
  };
  accounts: { open: number; openedToday: number };
  today: {
    since: string;
    deposits: { count: number; volumeMinor: string };
    transfers: { count: number; volumeMinor: string; feesMinor: string; failed: number };
  };
  pendingTransfers: number;
  transfersNeedingReview: number;
  openComplianceHolds: number;
  openSupportCases: number;
}
