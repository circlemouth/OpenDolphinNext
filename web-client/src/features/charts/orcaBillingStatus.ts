import type { ClaimBundle, ClaimBundleStatus, ClaimQueueEntry } from '../outpatient/types';
import type { OrcaClaimSendCacheEntry } from './orcaClaimSendCache';
import type { OrcaIncomeInfoCacheEntry } from './orcaIncomeInfoCache';

export type BillingTransmissionState = '未送信' | '送信済' | '送信失敗';
export type BillingTransmissionSource = 'medical-mod-v2' | 'none';
export type BillingConfirmationSource = 'income-info' | 'unresolved' | 'none';
export type BillingCorrectionState = 'required' | 'none';

export type BillingStatusDecision = {
  status?: ClaimBundleStatus;
  statusText?: string;
  invoiceNumber?: string;
  paid: boolean;
  transmissionState: BillingTransmissionState;
  transmissionSource: BillingTransmissionSource;
  confirmationSource: BillingConfirmationSource;
  correctionState: BillingCorrectionState;
  correctionNote?: string;
  settingNote?: string;
};

export type BillingStatusUpdateAudit = {
  action: 'orca_billing_status_update';
  status?: ClaimBundleStatus;
  statusText?: string;
  invoiceNumber?: string;
  performMonth?: string;
  apiResult?: string;
  apiResultMessage?: string;
  fetchedAt?: string;
  durationMs?: number;
  transmissionSource?: BillingTransmissionSource;
  confirmationSource?: BillingConfirmationSource;
  correctionState?: BillingCorrectionState;
};

const normalizeInvoiceNumber = (value?: string | null) => value?.trim() || undefined;

export const resolveBillingInvoiceNumber = ({
  claimInvoiceNumber,
  sendInvoiceNumber,
  sendStatus,
  paidInvoiceNumbers,
}: {
  claimInvoiceNumber?: string | null;
  sendInvoiceNumber?: string | null;
  sendStatus?: OrcaClaimSendCacheEntry['sendStatus'];
  paidInvoiceNumbers?: Set<string>;
}) => {
  const claimInvoice = normalizeInvoiceNumber(claimInvoiceNumber);
  if (claimInvoice) return claimInvoice;
  const sendInvoice = normalizeInvoiceNumber(sendInvoiceNumber);
  if (sendInvoice) return sendInvoice;
  if (sendStatus !== 'success' || !paidInvoiceNumbers || paidInvoiceNumbers.size !== 1) {
    return undefined;
  }
  const [singleInvoice] = paidInvoiceNumbers;
  return normalizeInvoiceNumber(singleInvoice);
};

export const buildPaidInvoiceSet = (income?: OrcaIncomeInfoCacheEntry | null) => {
  const invoices = income?.invoiceNumbers ?? [];
  return new Set(invoices.map((value) => value.trim()).filter(Boolean));
};

export const resolveBillingStatusUpdateDurationMs = (completedAt?: number | null, renderedAt?: number) => {
  if (typeof completedAt !== 'number' || Number.isNaN(completedAt)) return undefined;
  const end = typeof renderedAt === 'number' && !Number.isNaN(renderedAt) ? renderedAt : completedAt;
  return Math.max(0, Math.round(end - completedAt));
};

export const buildBillingStatusUpdateAudit = (params: Omit<BillingStatusUpdateAudit, 'action'>): BillingStatusUpdateAudit => ({
  action: 'orca_billing_status_update',
  ...params,
});

type ResolveBillingStatusDecisionParams = {
  invoiceNumber?: string | null;
  sendStatus?: OrcaClaimSendCacheEntry['sendStatus'];
  paidInvoiceNumbers?: Set<string>;
  correctionRequired?: boolean;
};

export const resolveBillingStatusFromInvoice = (
  invoiceNumber?: string | null,
  paidInvoiceNumbers?: Set<string>,
): BillingStatusDecision => {
  const normalized = normalizeInvoiceNumber(invoiceNumber);
  if (!normalized) {
    return {
      paid: false,
      transmissionState: '未送信',
      transmissionSource: 'none',
      confirmationSource: 'none',
      correctionState: 'none',
    };
  }
  const paid = paidInvoiceNumbers?.has(normalized) ?? false;
  const status: ClaimBundleStatus = paid ? '会計済み' : '会計待ち';
  return {
    status,
    statusText: status,
    invoiceNumber: normalized,
    paid,
    transmissionState: '未送信',
    transmissionSource: 'none',
    confirmationSource: paidInvoiceNumbers ? 'income-info' : 'unresolved',
    correctionState: 'none',
  };
};

export const resolveBillingStatusDecision = ({
  invoiceNumber,
  sendStatus,
  paidInvoiceNumbers,
  correctionRequired = false,
}: ResolveBillingStatusDecisionParams): BillingStatusDecision => {
  const normalized = normalizeInvoiceNumber(invoiceNumber);
  const transmissionState: BillingTransmissionState =
    sendStatus === 'success' ? '送信済' : sendStatus === 'error' ? '送信失敗' : '未送信';
  const transmissionSource: BillingTransmissionSource = sendStatus ? 'medical-mod-v2' : 'none';
  const confirmationSource: BillingConfirmationSource = sendStatus === 'success'
    ? paidInvoiceNumbers?.has(normalized ?? '') ? 'income-info' : 'unresolved'
    : normalized && paidInvoiceNumbers
      ? 'income-info'
      : 'none';
  const correctionState: BillingCorrectionState = correctionRequired ? 'required' : 'none';
  const correctionNote = correctionRequired
    ? '補正が必要です。medical-mod-v2 の警告を確認し、必要な修正だけを行ってください。'
    : undefined;
  const settingNote =
    sendStatus === 'success' && confirmationSource === 'unresolved'
      ? '収納情報の確認前です。送信済みですが、会計確定は未判定です。'
      : undefined;

  if (normalized && paidInvoiceNumbers?.has(normalized)) {
    return {
      status: '会計済み',
      statusText: '会計済み',
      invoiceNumber: normalized,
      paid: true,
      transmissionState,
      transmissionSource,
      confirmationSource: 'income-info',
      correctionState,
      correctionNote,
      settingNote,
    };
  }

  if (sendStatus === 'success') {
    return {
      status: '会計待ち',
      statusText: '会計待ち+送信済',
      invoiceNumber: normalized,
      paid: false,
      transmissionState,
      transmissionSource,
      confirmationSource,
      correctionState,
      correctionNote,
      settingNote,
    };
  }

  if (normalized || paidInvoiceNumbers) {
    return {
      status: '会計待ち',
      statusText: '会計待ち',
      invoiceNumber: normalized,
      paid: false,
      transmissionState,
      transmissionSource,
      confirmationSource,
      correctionState,
      correctionNote,
      settingNote,
    };
  }

  return {
    invoiceNumber: normalized,
    paid: false,
    transmissionState,
    transmissionSource,
    confirmationSource,
    correctionState,
    correctionNote,
    settingNote,
  };
};

export const buildSendClaimBundle = (
  entry: OrcaClaimSendCacheEntry,
  paidInvoiceNumbers?: Set<string>,
): ClaimBundle => {
  const decision = resolveBillingStatusDecision({
    invoiceNumber: entry.invoiceNumber,
    sendStatus: entry.sendStatus,
    paidInvoiceNumbers,
    correctionRequired: Boolean(entry.medicalWarnings?.length),
  });
  const fallbackStatus: ClaimBundleStatus | undefined = entry.sendStatus === 'error' ? undefined : '会計待ち';
  const status = decision.status ?? fallbackStatus;
  const statusText = decision.statusText ?? (entry.sendStatus === 'error' ? '送信失敗' : fallbackStatus);
  return {
    bundleNumber: entry.invoiceNumber ?? entry.dataId ?? `send-${entry.patientId ?? 'unknown'}`,
    patientId: entry.patientId,
    appointmentId: entry.appointmentId,
    performTime: entry.savedAt,
    invoiceNumber: decision.invoiceNumber ?? entry.invoiceNumber ?? undefined,
    claimStatus: status,
    claimStatusText: statusText,
  };
};

export const buildQueueEntryFromSendCache = (
  entry: OrcaClaimSendCacheEntry,
  paidInvoiceNumbers?: Set<string>,
): ClaimQueueEntry => {
  const decision = resolveBillingStatusDecision({
    invoiceNumber: entry.invoiceNumber,
    sendStatus: entry.sendStatus,
    paidInvoiceNumbers,
    correctionRequired: Boolean(entry.medicalWarnings?.length),
  });
  if (decision.paid) {
    return {
      id: `send-queue-${entry.patientId ?? entry.invoiceNumber ?? entry.dataId ?? 'unknown'}`,
      phase: 'ack',
      patientId: entry.patientId,
      appointmentId: entry.appointmentId,
      errorMessage: undefined,
    };
  }
  if (entry.sendStatus === 'error') {
    return {
      id: `send-queue-${entry.patientId ?? entry.invoiceNumber ?? entry.dataId ?? 'unknown'}`,
      phase: 'failed',
      patientId: entry.patientId,
      appointmentId: entry.appointmentId,
      errorMessage: entry.errorMessage,
    };
  }
  return {
    id: `send-queue-${entry.patientId ?? entry.invoiceNumber ?? entry.dataId ?? 'unknown'}`,
    phase: 'sent',
    patientId: entry.patientId,
    appointmentId: entry.appointmentId,
    nextRetryAt: entry.savedAt,
  };
};

export const mergeClaimBundles = (bundles: ClaimBundle[], sendBundles: ClaimBundle[]) => {
  if (sendBundles.length === 0) return bundles;
  const patientIds = new Set(sendBundles.map((bundle) => bundle.patientId).filter(Boolean));
  const appointmentIds = new Set(sendBundles.map((bundle) => bundle.appointmentId).filter(Boolean));
  const filtered = bundles.filter((bundle) => {
    if (bundle.patientId && patientIds.has(bundle.patientId)) return false;
    if (bundle.appointmentId && appointmentIds.has(bundle.appointmentId)) return false;
    return true;
  });
  return [...filtered, ...sendBundles];
};

export const mergeQueueEntries = (entries: ClaimQueueEntry[], sendEntries: ClaimQueueEntry[]) => {
  if (sendEntries.length === 0) return entries;
  const key = (entry: ClaimQueueEntry) => entry.appointmentId ? `appointment:${entry.appointmentId}` : `patient:${entry.patientId ?? entry.id}`;
  const map = new Map<string, ClaimQueueEntry>();
  entries.forEach((entry) => map.set(key(entry), entry));
  sendEntries.forEach((entry) => {
    const k = key(entry);
    if (!map.has(k)) {
      map.set(k, entry);
    }
  });
  return Array.from(map.values());
};

export const resolveOverallClaimStatus = (bundles: ClaimBundle[]) => {
  if (bundles.length === 0) return undefined;
  const statuses = bundles.map((bundle) => bundle.claimStatus).filter(Boolean) as ClaimBundleStatus[];
  if (statuses.length === 0) return undefined;
  if (statuses.every((status) => status === '会計済み')) return '会計済み' as ClaimBundleStatus;
  if (statuses.some((status) => status === '会計待ち')) return '会計待ち' as ClaimBundleStatus;
  return statuses[0];
};
