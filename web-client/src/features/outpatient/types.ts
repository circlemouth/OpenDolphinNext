import type { DataSourceTransition, ResolveMasterSource } from '../../libs/observability/types';

export type ReceptionStatus = '受付中' | '診療中' | '会計待ち' | '会計済み' | '予約';

export type ReceptionEntry = {
  id: string;
  appointmentId?: string;
  receptionId?: string;
  scheduleKey?: string;
  encounterKey?: string;
  patientId?: string;
  departmentCode?: string;
  physicianCode?: string;
  voucherNumber?: string;
  sequentialNumber?: string;
  insuranceCombinationNumber?: string;
  name?: string;
  kana?: string;
  birthDate?: string;
  sex?: string;
  department?: string;
  physician?: string;
  appointmentTime?: string;
  reservationTime?: string;
  acceptanceTime?: string;
  visitDate?: string;
  status: ReceptionStatus;
  insurance?: string;
  note?: string;
  source: 'slots' | 'reservations' | 'visits' | 'unknown';
};

export type OutpatientMeta = {
  runId?: string;
  traceId?: string;
  requestId?: string;
  apiResult?: string;
  apiResultMessage?: string;
  dataSourceTransition?: DataSourceTransition;
  resolveMasterSource?: ResolveMasterSource;
  cacheHit?: boolean;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  fallbackFlagMissing?: boolean;
  fetchedAt?: string;
  recordsReturned?: number;
  outcome?: string;
  hasNextPage?: boolean;
  page?: number;
  size?: number;
  fromCache?: boolean;
  retryCount?: number;
  sourcePath?: string;
  httpStatus?: number;
  auditEvent?: Record<string, unknown>;
  abortRetryAttempted?: boolean;
  abortRetryReason?: string;
  abortSignalAborted?: boolean;
};

export type ClaimQueuePhase = 'pending' | 'retry' | 'hold' | 'failed' | 'sent' | 'ack';

export type ClaimQueueEntry = {
  id: string;
  phase: ClaimQueuePhase;
  retryCount?: number;
  nextRetryAt?: string;
  errorMessage?: string;
  holdReason?: string;
  requestId?: string;
  patientId?: string;
  scheduleKey?: string;
  encounterKey?: string;
  appointmentId?: string;
  fallbackUsed?: boolean;
};

export type AppointmentPayload = OutpatientMeta & {
  entries: ReceptionEntry[];
  raw: unknown;
  apiResult?: string;
  apiResultMessage?: string;
};

export type OrcaOutpatientSummary = OutpatientMeta & {
  note?: string;
  payload?: Record<string, unknown>;
};

export type ClaimBundleItem = {
  code?: string;
  tableId?: string;
  name?: string;
  number?: number;
  unit?: string;
  claimRate?: number;
  amount?: number;
};

export type ClaimBundleStatus = '会計待ち' | '会計済み' | '診療中' | '受付中' | '予約';

export type ClaimBundle = {
  bundleNumber?: string;
  classCode?: string;
  patientId?: string;
  appointmentId?: string;
  performTime?: string;
  invoiceNumber?: string;
  claimStatusText?: string;
  claimStatus?: ClaimBundleStatus;
  totalClaimAmount?: number;
  items?: ClaimBundleItem[];
};

export type ClaimOutpatientPayload = OutpatientMeta & {
  bundles: ClaimBundle[];
  claimStatus?: ClaimBundleStatus;
  claimStatusText?: string;
  queueEntries?: ClaimQueueEntry[];
  raw?: Record<string, unknown>;
  apiResult?: string;
  apiResultMessage?: string;
  invoiceNumber?: string;
  dataId?: string;
};

export type OutpatientFlagResponse = ClaimOutpatientPayload;
