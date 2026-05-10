import type { OrcaPushEvent, OrcaPushEventMeta, OrcaQueueEntry } from './orcaQueueApi';
import type { ClaimQueueEntry, ClaimQueuePhase } from './types';

export type OrcaSendStatusKey = 'waiting' | 'processing' | 'success' | 'failure' | 'unknown';

export type OrcaSendStatus = {
  key: OrcaSendStatusKey;
  label: '待ち' | '処理中' | '送達確認' | '失敗' | '不明';
  tone: 'info' | 'warning' | 'success' | 'error';
  isStalled: boolean;
  lastDispatchAt?: string;
  error?: string;
};

export type OrcaQueueWarningSummary = {
  total: number;
  pending: number;
  failed: number;
  delayed: number;
};

export type OrcaPushEventSummary = {
  total: number;
  kept: number;
  deduped: number;
  newCount: number;
  byEvent: Record<string, number>;
  lastEventAt?: string;
};

export const ORCA_QUEUE_STALL_THRESHOLD_MS = 5 * 60 * 1000;
const STALL_THRESHOLD_MS = ORCA_QUEUE_STALL_THRESHOLD_MS;
const PROCESSING_WINDOW_MS = 90 * 1000;

const normalizeClaimQueuePhaseFromStatus = (status: string): ClaimQueuePhase => {
  const normalized = status.toLowerCase();
  if (normalized === 'delivered' || normalized === 'ack') return 'ack';
  if (normalized === 'failed' || normalized === 'error') return 'failed';
  if (normalized === 'pending' || normalized === 'queued' || normalized === 'waiting') return 'pending';
  if (normalized.includes('retry')) return 'retry';
  if (normalized.includes('hold')) return 'hold';
  if (normalized.includes('sent')) return 'sent';
  return 'pending';
};

const toTimeMs = (iso?: string): number | undefined => {
  if (!iso) return undefined;
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T');
  const t = new Date(normalized).getTime();
  return Number.isNaN(t) ? undefined : t;
};

export const resolveOrcaSendStatus = (entry: OrcaQueueEntry | undefined, nowMs = Date.now()): OrcaSendStatus | undefined => {
  if (!entry) return undefined;

  const phase = normalizeClaimQueuePhaseFromStatus(entry.status);
  const lastDispatchAt = entry.lastDispatchAt;
  const lastMs = toTimeMs(lastDispatchAt);
  const elapsedMs = lastMs === undefined ? undefined : Math.max(0, nowMs - lastMs);

  if (phase === 'ack') {
    return { key: 'success', label: '送達確認', tone: 'success', isStalled: false, lastDispatchAt, error: entry.error };
  }
  if (phase === 'failed') {
    return { key: 'failure', label: '失敗', tone: 'error', isStalled: false, lastDispatchAt, error: entry.error };
  }

  const isProcessing =
    phase === 'retry' ||
    phase === 'sent' ||
    (phase === 'pending' && elapsedMs !== undefined && elapsedMs <= PROCESSING_WINDOW_MS) ||
    /processing|dispatch|sending|in[_-]?flight/.test(entry.status.toLowerCase());

  const key: OrcaSendStatusKey = isProcessing ? 'processing' : 'waiting';
  const label: OrcaSendStatus['label'] = isProcessing ? '処理中' : '待ち';
  const tone: OrcaSendStatus['tone'] = isProcessing ? 'info' : 'warning';
  const isStalled =
    (key === 'waiting' || key === 'processing') && elapsedMs !== undefined ? elapsedMs >= STALL_THRESHOLD_MS : false;

  return { key, label, tone, isStalled, lastDispatchAt, error: entry.error };
};

export const toClaimQueueEntryFromOrcaQueueEntry = (entry: OrcaQueueEntry): ClaimQueueEntry => {
  const phase = normalizeClaimQueuePhaseFromStatus(entry.status);
  return {
    id: `orca-queue-${entry.patientId}`,
    patientId: entry.patientId,
    phase,
    errorMessage: entry.error,
  };
};

export const isOrcaQueueWarningEntry = (entry: OrcaQueueEntry, nowMs = Date.now()) => {
  const phase = normalizeClaimQueuePhaseFromStatus(entry.status);
  const sendStatus = resolveOrcaSendStatus(entry, nowMs);
  const isFailed = phase === 'failed' || sendStatus?.key === 'failure';
  const isPending = phase === 'pending' || phase === 'retry' || phase === 'hold' || phase === 'sent';
  const missingDispatch = isPending && !entry.lastDispatchAt;
  const isDelayed = Boolean(sendStatus?.isStalled || missingDispatch);
  return {
    isWarning: isFailed || isDelayed,
    isFailed,
    isPending,
    isDelayed,
  };
};

export const buildOrcaQueueWarningSummary = (entries: OrcaQueueEntry[], nowMs = Date.now()): OrcaQueueWarningSummary => {
  let pending = 0;
  let failed = 0;
  let delayed = 0;

  entries.forEach((entry) => {
    const result = isOrcaQueueWarningEntry(entry, nowMs);
    if (result.isFailed) failed += 1;
    if (result.isPending) pending += 1;
    if (result.isDelayed) delayed += 1;
  });

  return {
    total: entries.length,
    pending,
    failed,
    delayed,
  };
};

export const buildOrcaPushEventSummary = (
  events: OrcaPushEvent[],
  meta?: OrcaPushEventMeta,
): OrcaPushEventSummary => {
  const total = meta?.total ?? events.length;
  const kept = meta?.kept ?? events.length;
  const deduped = meta?.deduped ?? Math.max(0, total - kept);
  const newCount = meta?.newlyAdded ?? events.length;
  const byEvent: Record<string, number> = {};
  let lastEventAt: string | undefined;
  let lastEventMs = -1;

  events.forEach((event) => {
    const key = event.event ?? 'unknown';
    byEvent[key] = (byEvent[key] ?? 0) + 1;
    const eventMs = toTimeMs(event.timestamp);
    if (eventMs !== undefined && eventMs > lastEventMs) {
      lastEventMs = eventMs;
      lastEventAt = event.timestamp;
    }
  });

  return {
    total,
    kept,
    deduped,
    newCount,
    byEvent,
    lastEventAt,
  };
};

export const resolveOrcaPushEventTone = (summary: OrcaPushEventSummary): OrcaSendStatus['tone'] => {
  if (summary.newCount > 0) return 'info';
  if (summary.deduped > 0) return 'warning';
  return 'success';
};
