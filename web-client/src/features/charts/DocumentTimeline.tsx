import { useCallback, useEffect, useMemo, useState } from 'react';

import { ToneBanner } from '../reception/components/ToneBanner';
import { StatusBadge } from '../shared/StatusBadge';
import { ApiFailureBanner } from '../shared/ApiFailureBanner';
import { MISSING_MASTER_RECOVERY_MESSAGE, MISSING_MASTER_RECOVERY_NEXT_ACTION } from '../shared/missingMasterRecovery';
import { useAuthService } from './authService';
import { getChartToneDetails, type ChartTonePayload } from '../../ux/charts/tones';
import { resolveAriaLive, resolveRunId } from '../../libs/observability/observability';
import { useOptionalSession } from '../../AppRouter';
import { isSystemAdminRole } from '../../libs/auth/roles';
import type { ReceptionEntry, ReceptionStatus } from '../reception/api';
import type { ClaimOutpatientPayload, ClaimBundle, ClaimBundleStatus } from '../outpatient/types';
import type { AppointmentDataBanner } from '../outpatient/appointmentDataBanner';
import {
  resolveOrcaQueueRetryUiFeedback,
  retryOrcaQueue,
  type OrcaPushEventResponse,
  type OrcaQueueEntry,
  type OrcaQueueResponse,
} from '../outpatient/orcaQueueApi';
import { buildOrcaPushEventSummary, resolveOrcaPushEventTone, resolveOrcaSendStatus } from '../outpatient/orcaQueueStatus';
import { resolveOutpatientFlags, type OutpatientFlagSource } from '../outpatient/flags';
import { getOrcaClaimSendEntry } from './orcaClaimSendCache';
import { formatOrcaIdentifier, formatOrcaIdentifierInline } from './orcaIdentifiers';
import { formatSoapAuthoredAt, getLatestSoapEntries, SOAP_SECTION_LABELS, type SoapEntry, type SoapSectionKey } from './soapNote';

export interface DocumentTimelineProps {
  entries?: ReceptionEntry[];
  appointmentBanner?: AppointmentDataBanner | null;
  appointmentMeta?: OutpatientFlagSource;
  auditEvent?: Record<string, unknown>;
  soapHistory?: SoapEntry[];
  selectedPatientId?: string;
  selectedAppointmentId?: string;
  selectedReceptionId?: string;
  claimData?: ClaimOutpatientPayload;
  claimError?: Error;
  isClaimLoading?: boolean;
  claimEnabled?: boolean;
  orcaQueue?: OrcaQueueResponse;
  orcaQueueUpdatedAt?: number;
  isOrcaQueueLoading?: boolean;
  orcaQueueError?: Error;
  orcaPushEvents?: OrcaPushEventResponse;
  orcaPushEventsUpdatedAt?: number;
  isOrcaPushEventsLoading?: boolean;
  orcaPushEventsError?: Error;
  recordsReturned?: number;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  isInitialLoading?: boolean;
  pageSize?: number;
  isRefetchingList?: boolean;
  onRetryClaim?: () => void;
  onOpenReception?: () => void;
}

const STATUS_ORDER: ReceptionStatus[] = ['受付中', '診療中', '会計待ち', '会計済み', '予約'];

const VIRTUAL_WINDOW = 32;

const resolveReceptionStatusFromClaim = (status?: ClaimBundleStatus): ReceptionStatus | undefined => {
  if (status === '会計待ち' || status === '会計済み') return status;
  if (status === '診療中') return '診療中';
  if (status === '受付中') return '受付中';
  if (status === '予約') return '予約';
  return undefined;
};

const pickClaimBundleForEntry = (entry: ReceptionEntry, bundles: ClaimBundle[]) => {
  if (entry.appointmentId) {
    const byAppointment = bundles.find((bundle) => bundle.appointmentId === entry.appointmentId);
    if (byAppointment) return byAppointment;
  }
  if (entry.patientId) {
    return bundles.find((bundle) => bundle.patientId === entry.patientId);
  }
  return undefined;
};

type QueuePhase = 'ok' | 'retrying' | 'holding' | 'error' | 'pending';

type OrcaQueueCounts = {
  waiting: number;
  processing: number;
  success: number;
  failure: number;
  unknown: number;
  stalled: number;
};

const resolveQueuePhase = (options: {
  missingMaster?: boolean;
  isClaimLoading?: boolean;
  claimError?: Error;
  fallbackUsed?: boolean;
  cacheHit?: boolean;
}): QueuePhase => {
  if (options.claimError) return 'error';
  if (options.missingMaster) return 'holding';
  if (options.isClaimLoading) return 'retrying';
  if (options.fallbackUsed === true || options.cacheHit === false) return 'pending';
  return 'ok';
};

const buildOrcaQueueCounts = (queue: OrcaQueueEntry[]): OrcaQueueCounts => {
  const counts: OrcaQueueCounts = {
    waiting: 0,
    processing: 0,
    success: 0,
    failure: 0,
    unknown: 0,
    stalled: 0,
  };

  for (const entry of queue) {
    const status = resolveOrcaSendStatus(entry);
    if (!status) {
      counts.unknown += 1;
      continue;
    }
    counts[status.key] += 1;
    if (status.isStalled) counts.stalled += 1;
  }

  return counts;
};

const deriveNextAction = (
  status: ReceptionStatus,
  queuePhase: QueuePhase,
  missingMaster?: boolean,
  sendStatus?: ReturnType<typeof resolveOrcaSendStatus>,
  claimEnabled: boolean = true,
): string => {
  if (missingMaster) return MISSING_MASTER_RECOVERY_NEXT_ACTION;
  if (sendStatus?.key === 'failure') return '送信失敗：ORCA再送を試行';
  if (sendStatus?.key === 'waiting' || sendStatus?.key === 'processing') {
    return sendStatus.isStalled
      ? '送信が滞留：ORCA再送を試行'
      : '送信待ち/処理中：反映を確認してから会計へ進む';
  }
  if (queuePhase === 'error') {
    return claimEnabled ? '請求キューを再取得し、失敗理由を確認' : '送信キューを再取得し、失敗理由を確認';
  }
  if (queuePhase === 'retrying') return '再取得完了まで待機し、結果を確認';
  if (queuePhase === 'pending') return 'ORCA キューへの反映を確認してから会計へ進む';
  switch (status) {
    case '受付中':
      return '診療開始を知らせ、受付情報を確定';
    case '診療中':
      return 'カルテ保存後に ORCA 送信を実行';
    case '会計待ち':
      return claimEnabled ? '請求金額を確認し会計へ進む' : '会計金額を確認し会計へ進む';
    case '会計済み':
      return '記録を監査ログに同期し終了';
    case '予約':
      return '来院時に受付へ変換し、診療へ送る';
    default:
      return '状況を確認';
  }
};

export function DocumentTimeline({
  entries = [],
  appointmentBanner,
  appointmentMeta,
  auditEvent,
  soapHistory = [],
  selectedPatientId,
  selectedAppointmentId,
  selectedReceptionId,
  claimData,
  claimError,
  isClaimLoading,
  claimEnabled = true,
  orcaQueue,
  orcaQueueUpdatedAt,
  isOrcaQueueLoading,
  orcaQueueError,
  orcaPushEvents,
  orcaPushEventsUpdatedAt,
  isOrcaPushEventsLoading,
  orcaPushEventsError,
  recordsReturned,
  hasNextPage,
  onLoadMore,
  isLoadingMore,
  isInitialLoading,
  pageSize,
  isRefetchingList,
  onRetryClaim,
  onOpenReception,
}: DocumentTimelineProps) {
  const session = useOptionalSession();
  const { flags } = useAuthService();
  const isSystemAdmin = isSystemAdminRole(session?.role);
  const effectiveClaimData = claimEnabled ? claimData : undefined;
  const effectiveClaimError = claimEnabled ? claimError : undefined;
  const effectiveClaimLoading = claimEnabled ? isClaimLoading : false;
  const resolvedFlags = resolveOutpatientFlags(effectiveClaimData, appointmentMeta, flags);
  const resolvedRunId = resolveRunId(resolvedFlags.runId ?? flags.runId);
  const resolvedMissingMaster = resolvedFlags.missingMaster ?? flags.missingMaster;
  const resolvedCacheHit = resolvedFlags.cacheHit ?? flags.cacheHit;
  const resolvedTransition = resolvedFlags.dataSourceTransition ?? flags.dataSourceTransition;
  const resolvedFallbackUsed = resolvedFlags.fallbackUsed ?? flags.fallbackUsed ?? false;
  const fallbackFlagMissing = resolvedFlags.fallbackFlagMissing ?? false;
  const infoLive = resolveAriaLive('info');
  const tonePayload: ChartTonePayload = {
    missingMaster: resolvedMissingMaster ?? false,
    cacheHit: resolvedCacheHit ?? false,
    dataSourceTransition: resolvedTransition ?? 'snapshot',
  };

  const { tone, message: toneMessage, transitionMeta } = getChartToneDetails(tonePayload);
  const claimFetchedAt = effectiveClaimData?.fetchedAt;
  const orcaQueueUpdatedAtLabel =
    typeof orcaQueueUpdatedAt === 'number' && orcaQueueUpdatedAt > 0 ? new Date(orcaQueueUpdatedAt).toISOString() : undefined;
  const orcaPushEventsUpdatedAtLabel =
    typeof orcaPushEventsUpdatedAt === 'number' && orcaPushEventsUpdatedAt > 0
      ? new Date(orcaPushEventsUpdatedAt).toISOString()
      : undefined;
  const [queueRetryState, setQueueRetryState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    patientId?: string;
    message?: string;
  }>({ status: 'idle' });
  const retryUiVisible = isSystemAdmin && orcaQueue?.retrySupported === true;

  const auditSummary = useMemo(() => {
    if (!auditEvent) return null;
    const payload = auditEvent as Record<string, unknown>;
    const action = typeof payload.action === 'string' ? payload.action : 'AUDIT_EVENT';
    const outcome = typeof payload.outcome === 'string' ? payload.outcome : undefined;
    const details = (typeof payload.details === 'object' && payload.details !== null
      ? (payload.details as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const actor = typeof details.actor === 'string' ? details.actor : undefined;
    const note = typeof details.note === 'string' ? details.note : undefined;
    const lockExpiresAt = typeof details.lockExpiresAt === 'string' ? details.lockExpiresAt : undefined;

    const isConflict =
      action === 'CHARTS_EDIT_LOCK' ||
      action === 'CHARTS_CONFLICT' ||
      action === 'CHARTS_ACTION_FAILURE';
    const bannerTone = isConflict ? 'warning' : 'info';
    const message = [
      outcome ? `${action}(${outcome})` : action,
      actor ? '実行者は監査ログに記録しました。' : undefined,
      note ? `note=${note}` : undefined,
      lockExpiresAt ? `lockExpiresAt=${lockExpiresAt}` : undefined,
    ]
      .filter((fragment): fragment is string => typeof fragment === 'string' && fragment.length > 0)
      .join(' ｜ ');

    return { tone: bannerTone as 'warning' | 'info', message };
  }, [auditEvent]);

  const claimBundles = effectiveClaimData?.bundles ?? [];

  const queuePhase = claimEnabled
    ? resolveQueuePhase({
        missingMaster: resolvedMissingMaster,
        isClaimLoading: effectiveClaimLoading,
        claimError: effectiveClaimError,
        fallbackUsed: resolvedFallbackUsed,
        cacheHit: resolvedCacheHit,
      })
    : 'ok';

  const orcaQueueByPatientId = useMemo(() => {
    const map = new Map<string, OrcaQueueEntry>();
    const queue = orcaQueue?.queue ?? [];
    for (const entry of queue) {
      if (!entry?.patientId) continue;
      const prev = map.get(entry.patientId);
      if (!prev) {
        map.set(entry.patientId, entry);
        continue;
      }
      const prevAt = prev.lastDispatchAt ?? '';
      const nextAt = entry.lastDispatchAt ?? '';
      if (nextAt && (!prevAt || nextAt >= prevAt)) {
        map.set(entry.patientId, entry);
      }
    }
    return map;
  }, [orcaQueue?.queue]);

  const handleQueueRetry = useCallback(async (patientId?: string) => {
    if (!patientId) {
      setQueueRetryState({
        status: 'error',
        message: '患者IDが未選択のため再送できません。',
      });
      return;
    }
    if (!isSystemAdmin) {
      setQueueRetryState({
        status: 'error',
        patientId,
        message: 'ORCA再送の権限がありません。',
      });
      return;
    }
    if (!retryUiVisible) {
      setQueueRetryState({
        status: 'error',
        patientId,
        message: 'この環境では ORCA 再送を利用できません。',
      });
      return;
    }
    setQueueRetryState({ status: 'loading', patientId });
    try {
      const response = await retryOrcaQueue(patientId, { enabled: isSystemAdmin });
      const feedback = resolveOrcaQueueRetryUiFeedback(response);
      const detail = [feedback.detail, response.runId ? `runId=${response.runId}` : undefined, response.traceId ? `traceId=${response.traceId}` : undefined]
        .filter((part): part is string => Boolean(part))
        .join(' / ');
      setQueueRetryState({
        status: feedback.tone === 'error' ? 'error' : 'success',
        patientId,
        message: detail ? `${feedback.message} / ${detail}` : feedback.message,
      });
    } catch {
      setQueueRetryState({
        status: 'error',
        patientId,
        message: '再送要求に失敗しました。',
      });
    }
  }, [isSystemAdmin, retryUiVisible]);

  const selectedSendStatus = useMemo(() => {
    if (!selectedPatientId) return undefined;
    return resolveOrcaSendStatus(orcaQueueByPatientId.get(selectedPatientId));
  }, [orcaQueueByPatientId, selectedPatientId]);

  const orcaQueueCounts = useMemo(() => buildOrcaQueueCounts([...orcaQueueByPatientId.values()]), [orcaQueueByPatientId]);

  const orcaQueueCountsTone = useMemo(() => {
    if (orcaQueueCounts.failure > 0) return 'error' as const;
    if (orcaQueueCounts.stalled > 0) return 'warning' as const;
    if (orcaQueueCounts.waiting > 0) return 'warning' as const;
    if (orcaQueueCounts.processing > 0) return 'info' as const;
    return 'success' as const;
  }, [orcaQueueCounts.failure, orcaQueueCounts.processing, orcaQueueCounts.stalled, orcaQueueCounts.waiting]);

  const pushEvents = orcaPushEvents?.events ?? [];
  const pushEventSummary = useMemo(
    () => buildOrcaPushEventSummary(pushEvents, orcaPushEvents?.meta),
    [orcaPushEvents?.meta, pushEvents],
  );
  const pushEventTone = useMemo(() => resolveOrcaPushEventTone(pushEventSummary), [pushEventSummary]);
  const pushEventApiResult = orcaPushEvents?.apiResult;
  const pushEventApiResultMessage = orcaPushEvents?.apiResultMessage;
  const pushEventApiResultOk = typeof pushEventApiResult === 'string' ? /^0+$/.test(pushEventApiResult) : true;
  const pushEventWarning =
    orcaPushEvents?.warning ??
    ((orcaPushEvents?.missingTags?.length ?? 0) > 0 ? `missingTags=${orcaPushEvents?.missingTags?.join(', ')}` : undefined);
  const pushEventToneOverride =
    orcaPushEvents?.error ? ('error' as const) : !pushEventApiResultOk || pushEventWarning ? ('warning' as const) : undefined;
  const pushEventBadgeTone =
    orcaPushEvents
      ? pushEventToneOverride ?? pushEventTone
      : isOrcaPushEventsLoading
        ? ('info' as const)
        : ('warning' as const);
  const pushEventSummaryValue = isOrcaPushEventsLoading
    ? '取得中'
    : orcaPushEvents
      ? pushEventSummary.newCount > 0
        ? `新着:${pushEventSummary.newCount}`
        : '新着なし'
      : '未取得';

  const entriesWithClaim = useMemo(() => {
    if (entries.length === 0) return [];
    if (claimBundles.length === 0) return entries;
    return entries.map((entry) => {
      const bundle = pickClaimBundleForEntry(entry, claimBundles);
      if (!bundle) return entry;
      const status = resolveReceptionStatusFromClaim(bundle.claimStatus);
      if (!status) return entry;
      return {
        ...entry,
        status,
        note: entry.note ?? bundle.claimStatusText ?? '請求処理中',
      };
    });
  }, [claimBundles, entries]);

  const rank: Record<ReceptionStatus, number> = useMemo(() => {
    return STATUS_ORDER.reduce<Record<ReceptionStatus, number>>((acc, status, idx) => {
      acc[status] = idx;
      return acc;
    }, {} as Record<ReceptionStatus, number>);
  }, []);

  const sortedEntries = useMemo(() => {
    if (entriesWithClaim.length === 0) return [] as ReceptionEntry[];
    return [...entriesWithClaim].sort((a, b) => {
      const left = rank[a.status] ?? 99;
      const right = rank[b.status] ?? 99;
      if (left !== right) return left - right;
      return (a.appointmentTime ?? '').localeCompare(b.appointmentTime ?? '');
    });
  }, [entriesWithClaim, rank]);

  const [windowStart, setWindowStart] = useState(0);
  const [windowSize, setWindowSize] = useState(VIRTUAL_WINDOW);
  const totalEntries = sortedEntries.length;

  const selectedIndex = useMemo(() =>
    sortedEntries.findIndex(
      (entry) =>
        (selectedReceptionId && entry.receptionId === selectedReceptionId) ||
        (selectedAppointmentId && entry.appointmentId === selectedAppointmentId) ||
        (selectedPatientId && entry.patientId === selectedPatientId),
    ),
  [selectedAppointmentId, selectedPatientId, selectedReceptionId, sortedEntries]);

  const selectedEntry = useMemo(() => {
    if (selectedIndex < 0) return undefined;
    return sortedEntries[selectedIndex];
  }, [selectedIndex, sortedEntries]);

  const selectedBundle = useMemo(
    () => (selectedEntry ? pickClaimBundleForEntry(selectedEntry, claimBundles) : undefined),
    [claimBundles, selectedEntry],
  );
  const selectedSendCache = useMemo(
    () => getOrcaClaimSendEntry({}, selectedPatientId),
    [selectedPatientId],
  );
  const selectedInvoiceNumber =
    selectedBundle?.invoiceNumber ?? effectiveClaimData?.invoiceNumber ?? selectedSendCache?.invoiceNumber;
  const selectedDataId = effectiveClaimData?.dataId ?? selectedSendCache?.dataId;
  const selectedIdentifierInline = formatOrcaIdentifierInline({
    invoiceNumber: selectedInvoiceNumber,
    dataId: selectedDataId,
  });

  const alertSummary = useMemo(() => {
    const hasMasterIssue = Boolean(resolvedMissingMaster || resolvedFallbackUsed);
    const hasSendFailure = selectedSendStatus?.key === 'failure';
    const hasSendDelay = Boolean(selectedSendStatus?.isStalled);
    if (!hasMasterIssue && !hasSendFailure && !hasSendDelay) return null;

    const details: string[] = [];
    if (selectedEntry) {
      details.push(
        `対象: ${selectedEntry.name ?? '患者未登録'}（${selectedEntry.patientId ?? selectedEntry.appointmentId ?? 'ID不明'}）`,
      );
    }
    if (resolvedMissingMaster) details.push('missingMaster=true: マスタ未取得を検知');
    if (resolvedFallbackUsed) details.push('fallbackUsed=true: 暫定データで処理中');
    if (hasSendFailure) {
      details.push(`ORCA送信が失敗: ${selectedSendStatus?.error ?? 'エラー詳細未取得'}`);
    } else if (hasSendDelay) {
      details.push(
        `ORCA送信が滞留: ${selectedSendStatus?.lastDispatchAt ? `lastDispatchAt=${selectedSendStatus.lastDispatchAt}` : '送信時刻未取得'}`,
      );
    }
    if (selectedIdentifierInline) details.push(`送信ID: ${selectedIdentifierInline}`);
    if (
      queueRetryState.status !== 'idle' &&
      queueRetryState.patientId &&
      queueRetryState.patientId === selectedPatientId &&
      queueRetryState.message
    ) {
      details.push(`再送結果: ${queueRetryState.message}`);
    }

    const action = (() => {
      if (hasMasterIssue) {
        const fallbackAction = claimEnabled ? (onRetryClaim ?? onOpenReception) : onOpenReception;
        const fallbackLabel =
          claimEnabled && onRetryClaim ? '請求バンドルを再取得' : '受付へ戻る';
        return {
          label: fallbackLabel,
          tone: 'warning' as const,
          onClick: fallbackAction,
          disabled: !fallbackAction || Boolean(claimEnabled && onRetryClaim && effectiveClaimLoading),
          note:
            claimEnabled && onRetryClaim
              ? effectiveClaimLoading
                ? '再取得中'
                : '解消しない場合は受付で状態確認'
              : '受付状況を確認',
        };
      }
      if (hasSendFailure || hasSendDelay) {
        if (!retryUiVisible) {
          return null;
        }
        return {
          label: 'ORCA再送を試行',
          tone: hasSendFailure ? ('error' as const) : ('warning' as const),
          onClick: () => handleQueueRetry(selectedPatientId),
          disabled:
            !selectedPatientId ||
            (queueRetryState.status === 'loading' && queueRetryState.patientId === selectedPatientId),
          note: selectedPatientId ? 'ORCA queue 情報で再送' : '患者を選択してください',
        };
      }
      return null;
    })();

    const title = hasMasterIssue
      ? 'マスタ欠損を検知'
      : hasSendFailure
        ? 'ORCA送信が失敗'
        : 'ORCA送信が滞留';
    const tone: 'error' | 'warning' = hasSendFailure ? 'error' : 'warning';

    return { title, tone, details, action };
  }, [
    claimEnabled,
    effectiveClaimLoading,
    handleQueueRetry,
    onOpenReception,
    onRetryClaim,
    queueRetryState.message,
    queueRetryState.patientId,
    queueRetryState.status,
    retryUiVisible,
    resolvedFallbackUsed,
    resolvedMissingMaster,
    selectedEntry,
    selectedIdentifierInline,
    selectedPatientId,
    selectedSendStatus?.error,
    selectedSendStatus?.isStalled,
    selectedSendStatus?.key,
    selectedSendStatus?.lastDispatchAt,
  ]);

  useEffect(() => {
    if (selectedIndex < 0) return;
    if (selectedIndex < windowStart || selectedIndex >= windowStart + windowSize) {
      const centeredStart = Math.max(0, selectedIndex - Math.floor(windowSize / 2));
      setWindowStart(centeredStart);
    }
  }, [selectedIndex, windowSize, windowStart]);

  useEffect(() => {
    if (totalEntries === 0) {
      setWindowStart(0);
      return;
    }
    if (windowStart >= totalEntries) {
      setWindowStart(Math.max(0, totalEntries - windowSize));
    }
  }, [totalEntries, windowSize, windowStart]);

  const windowedEntries = useMemo(() => {
    if (totalEntries === 0) return [] as ReceptionEntry[];
    if (totalEntries <= windowSize) return sortedEntries;
    return sortedEntries.slice(windowStart, windowStart + windowSize);
  }, [sortedEntries, totalEntries, windowSize, windowStart]);

  const groupedEntries = useMemo(() =>
    STATUS_ORDER.map((status) => ({
      status,
      items: windowedEntries.filter((entry) => entry.status === status),
      total: sortedEntries.filter((entry) => entry.status === status).length,
    })).filter((section) => section.items.length > 0 || section.total > 0),
  [sortedEntries, windowedEntries]);

  const [collapsedSections, setCollapsedSections] = useState<Partial<Record<ReceptionStatus, boolean>>>({});

  const toggleSection = useCallback((status: ReceptionStatus) => {
    setCollapsedSections((prev) => ({ ...prev, [status]: !prev[status] }));
  }, []);

  const soapLatestBySection = useMemo(() => getLatestSoapEntries(soapHistory), [soapHistory]);

  const soapTimelineEntries = useMemo(() => {
    if (soapHistory.length === 0) return [];
    return [...soapHistory].sort((a, b) => (b.authoredAt ?? '').localeCompare(a.authoredAt ?? ''));
  }, [soapHistory]);

  const buildSoapMeta = useCallback((entry?: SoapEntry) => {
    if (!entry) return undefined;
    const authoredAt = formatSoapAuthoredAt(entry.authoredAt);
    const who = entry.authorName?.trim() || entry.authorRole;
    const template = entry.templateId ? `template=${entry.templateId}` : 'templateなし';
    return `${authoredAt} ／ ${who} ／ ${template}`;
  }, []);

  const resolveSoapLogBody = useCallback(
    (section: SoapSectionKey, fallback: string) => {
      const entry = soapLatestBySection.get(section);
      if (!entry) return { body: fallback, meta: undefined, tone: 'neutral' as const };
      return {
        body: entry.body,
        meta: buildSoapMeta(entry),
        tone: entry.action === 'update' ? ('info' as const) : ('neutral' as const),
      };
    },
    [buildSoapMeta, soapLatestBySection],
  );

  const sectionLogs = useMemo(() => {
    const planDetail = selectedEntry
      ? deriveNextAction(selectedEntry.status, queuePhase, resolvedMissingMaster, selectedSendStatus, claimEnabled)
      : '次にやることを待機中';
    const assessmentDetail = auditSummary?.message ?? '監査ログ未取得';
    const objectiveDetail = claimEnabled
      ? selectedBundle?.claimStatusText ?? selectedBundle?.claimStatus ?? selectedEntry?.status ?? '状態未取得'
      : selectedEntry?.status ?? '状態未取得';
    const subjectDetail = [
      selectedEntry?.department ? `診療科: ${selectedEntry.department}` : '診療科未指定',
      selectedEntry?.physician ? `担当: ${selectedEntry.physician}` : '担当未指定',
    ].join(' ｜ ');
    const appointmentMeta = selectedEntry?.appointmentTime ? `受付: ${selectedEntry.appointmentTime}` : '受付時刻未取得';
    const receptionMeta = selectedEntry?.receptionId ? `受付ID: ${selectedEntry.receptionId}` : undefined;
    const visitMeta = selectedEntry?.visitDate ? `診療日: ${selectedEntry.visitDate}` : undefined;
    const claimMeta = claimEnabled ? (claimFetchedAt ? `claim更新: ${claimFetchedAt}` : 'claim更新: 未取得') : undefined;
    const orcaMeta = orcaQueueUpdatedAtLabel ? `ORCA更新: ${orcaQueueUpdatedAtLabel}` : 'ORCA更新: 未取得';
    const freeLog = resolveSoapLogBody('free', selectedEntry?.note ?? '記載なし');
    const subjectiveLog = resolveSoapLogBody(
      'subjective',
      subjectDetail,
    );
    const objectiveLog = resolveSoapLogBody(
      'objective',
      `状態: ${objectiveDetail}`,
    );
    const assessmentLog = resolveSoapLogBody(
      'assessment',
      assessmentDetail,
    );
    const planLog = resolveSoapLogBody('plan', planDetail);

    return [
      {
        key: 'free',
        label: 'Free',
        body: freeLog.body,
        meta: freeLog.meta ?? appointmentMeta,
        tone: resolvedMissingMaster ? 'warning' : freeLog.tone,
      },
      {
        key: 'subjective',
        label: 'Subjective',
        body: subjectiveLog.body,
        meta: subjectiveLog.meta ?? visitMeta,
        tone: resolvedMissingMaster ? 'warning' : subjectiveLog.tone,
      },
      {
        key: 'objective',
        label: 'Objective',
        body: objectiveLog.body,
        meta: objectiveLog.meta ?? (receptionMeta ?? claimMeta),
        tone: queuePhase === 'error' ? 'error' : objectiveLog.tone,
      },
      {
        key: 'assessment',
        label: 'Assessment',
        body: assessmentLog.body,
        meta: assessmentLog.meta ?? (claimMeta ? `${claimMeta} ｜ ${orcaMeta}` : orcaMeta),
        tone: resolvedMissingMaster ? 'warning' : assessmentLog.tone,
      },
      {
        key: 'plan',
        label: 'Plan',
        body: planLog.body,
        meta:
          planLog.meta ??
          (selectedSendStatus?.label
            ? `ORCA送信: ${selectedSendStatus.label}${selectedIdentifierInline ? ` ／ ${selectedIdentifierInline}` : ''}`
            : orcaMeta),
        tone: queuePhase === 'error' ? 'error' : planLog.tone,
      },
    ];
  }, [
    auditSummary?.message,
    buildSoapMeta,
    claimEnabled,
    claimFetchedAt,
    orcaQueueUpdatedAtLabel,
    queuePhase,
    resolvedMissingMaster,
    resolveSoapLogBody,
    selectedEntry,
    selectedIdentifierInline,
    selectedBundle,
    selectedSendStatus,
  ]);

  const entryList = useMemo(() => {
    if (groupedEntries.length === 0) {
      return (
        <article className="document-timeline__entry" data-run-id={resolvedRunId}>
          <header>
            <span className="document-timeline__entry-time">--:--</span>
            <strong>外来データ未取得</strong>
          </header>
          <p>外来 API 応答を待機しています。受付画面で再取得するか、接続設定を確認してください。</p>
        </article>
      );
    }

    return groupedEntries.map((section) => (
      <div key={section.status} className="document-timeline__section" data-total-count={section.total}>
        <div className="document-timeline__section-header">
          <div className="document-timeline__section-labels">
            <span className="document-timeline__section-badge">{section.status}</span>
            <span className="document-timeline__section-count">
              表示 {section.items.length} / 全 {section.total} 件
            </span>
          </div>
          <button
            className="document-timeline__toggle"
            type="button"
            onClick={() => toggleSection(section.status)}
            aria-expanded={!collapsedSections[section.status]}
          >
            {collapsedSections[section.status] ? '展開' : '折りたたむ'}
          </button>
        </div>
        {!collapsedSections[section.status] &&
          section.items.map((entry) => {
            const isSelected =
              (selectedReceptionId && entry.receptionId === selectedReceptionId) ||
              (selectedPatientId && entry.patientId === selectedPatientId) ||
              (selectedAppointmentId && entry.appointmentId === selectedAppointmentId);
            const shouldHighlight = resolvedMissingMaster || isSelected;
            const bundle = pickClaimBundleForEntry(entry, claimBundles);
            const sendStatus = resolveOrcaSendStatus(entry.patientId ? orcaQueueByPatientId.get(entry.patientId) : undefined);
            const nextAction = deriveNextAction(entry.status, queuePhase, resolvedMissingMaster, sendStatus, claimEnabled);
            const bundleStatus = bundle?.claimStatus ?? '診療中';
            const entryInvoiceIdentifier = formatOrcaIdentifier(
              'Invoice_Number',
              bundle?.invoiceNumber ?? (isSelected ? selectedInvoiceNumber : undefined),
            );
            const entryDataIdIdentifier = isSelected
              ? formatOrcaIdentifier('Data_Id', selectedDataId)
              : undefined;
            const showQueueRetry =
              !alertSummary &&
              !resolvedMissingMaster &&
              !resolvedFallbackUsed &&
              retryUiVisible &&
              (sendStatus?.key === 'failure' || sendStatus?.isStalled);
            const claimNote = claimEnabled
              ? `請求: ${bundle?.claimStatusText ?? bundle?.claimStatus ?? '未取得'}`
              : undefined;
            const entryNoteParts = [
              entry.note ?? 'メモなし',
              claimNote,
              entryInvoiceIdentifier,
              entryDataIdIdentifier,
              sendStatus?.lastDispatchAt ? `最終送信: ${sendStatus.lastDispatchAt}` : undefined,
              sendStatus?.key === 'failure' && sendStatus.error ? `エラー: ${sendStatus.error}` : undefined,
            ].filter((part): part is string => Boolean(part));
            const queueStepStatus: Record<'受付' | '診療' | '会計', 'done' | 'active' | 'blocked' | 'pending'> = {
              受付: entry.status === '予約' ? 'pending' : 'done',
              診療:
                entry.status === '予約' || entry.status === '受付中'
                  ? 'pending'
                  : entry.status === '診療中'
                    ? 'active'
                    : 'done',
              会計:
                entry.status === '会計済み'
                  ? 'done'
                  : entry.status === '会計待ち'
                    ? 'active'
                    : sendStatus?.key === 'failure' || queuePhase === 'error' || queuePhase === 'holding'
                      ? 'blocked'
                      : sendStatus?.key === 'waiting' || sendStatus?.key === 'processing' || queuePhase === 'retrying' || queuePhase === 'pending'
                        ? 'pending'
                        : bundleStatus === '会計待ち' || bundleStatus === '会計済み'
                          ? 'active'
                          : 'pending',
            };

            return (
              <article
                key={`${entry.id}-${entry.appointmentTime ?? entry.patientId ?? entry.name ?? ''}`}
                className={`document-timeline__entry${shouldHighlight ? ' document-timeline__entry--highlight' : ''}`}
                data-run-id={resolvedRunId}
              >
                <header>
                  <span className="document-timeline__entry-time">{entry.appointmentTime ?? '---'}</span>
                  <div className="document-timeline__entry-title">
                    <strong>{entry.name ?? '患者未登録'}（{entry.patientId ?? entry.appointmentId ?? 'ID不明'}）</strong>
                    <span className="document-timeline__entry-meta">
                      {entry.department ?? '―'} ｜ {entry.status}
                      {entry.receptionId ? ` ｜ 受付ID: ${entry.receptionId}` : ''}
                    </span>
                  </div>
                  {shouldHighlight && <span className="document-timeline__badge-warning">missingMaster</span>}
                  {queuePhase === 'error' && <span className="document-timeline__badge-error">再取得待ち</span>}
                  {queuePhase === 'retrying' && <span className="document-timeline__badge-info">再取得中</span>}
                  {sendStatus && (
                    <span
                      className={
                        sendStatus.tone === 'success'
                          ? 'document-timeline__badge-success'
                          : sendStatus.tone === 'error'
                            ? 'document-timeline__badge-error'
                            : sendStatus.tone === 'warning'
                              ? 'document-timeline__badge-warning'
                              : 'document-timeline__badge-info'
                      }
                    >
                      送信:{sendStatus.label}
                    </span>
                  )}
                  {sendStatus?.isStalled && <span className="document-timeline__badge-warning">滞留</span>}
                </header>
                <div className="document-timeline__steps" aria-label="受付から会計までの進捗">
                  {(['受付', '診療', '会計'] as const).map((step) => (
                    <div key={step} className={`document-timeline__step document-timeline__step--${queueStepStatus[step]}`}>
                      <span className="document-timeline__step-label">{step}</span>
                    </div>
                  ))}
                </div>
                <p className="document-timeline__entry-note">{entryNoteParts.join(' ｜ ')}</p>
                <div className="document-timeline__actions" aria-label="次にやること">
                  <strong>次にやること:</strong>
                  <span>{nextAction}</span>
                </div>
                {showQueueRetry && (
                  <div className="document-timeline__next-actions" aria-label="ORCA再送">
                    <button
                      type="button"
                      className={`document-timeline__cta${sendStatus?.key === 'failure' ? ' document-timeline__cta--error' : ' document-timeline__cta--warning'}`}
                      onClick={() => handleQueueRetry(entry.patientId)}
                      disabled={
                        !entry.patientId ||
                        (queueRetryState.status === 'loading' && queueRetryState.patientId === entry.patientId)
                      }
                    >
                      {queueRetryState.status === 'loading' && queueRetryState.patientId === entry.patientId
                        ? '再送中…'
                        : 'ORCA再送を試行'}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
      </div>
    ));
  }, [
    alertSummary,
    claimBundles,
    collapsedSections,
    groupedEntries,
    handleQueueRetry,
    orcaQueueByPatientId,
    queuePhase,
    queueRetryState.patientId,
    queueRetryState.status,
    retryUiVisible,
    resolvedFallbackUsed,
    resolvedMissingMaster,
    resolvedRunId,
    selectedAppointmentId,
    selectedDataId,
    selectedInvoiceNumber,
    selectedPatientId,
    selectedReceptionId,
    toggleSection,
  ]);

  const moveWindow = useCallback(
    (direction: 'next' | 'prev' | 'start' | 'all' | 'center') => {
      if (totalEntries <= windowSize && direction !== 'all') return;
      if (direction === 'start') {
        setWindowStart(0);
        setWindowSize(VIRTUAL_WINDOW);
        return;
      }
      if (direction === 'all') {
        setWindowStart(0);
        setWindowSize(totalEntries || VIRTUAL_WINDOW);
        return;
      }
      if (direction === 'center' && selectedIndex >= 0) {
        setWindowStart(Math.max(0, selectedIndex - Math.floor(windowSize / 2)));
        return;
      }
      if (direction === 'next') {
        setWindowStart((prev) => Math.min(prev + windowSize, Math.max(0, totalEntries - windowSize)));
      } else {
        setWindowStart((prev) => Math.max(0, prev - windowSize));
      }
    },
    [selectedIndex, totalEntries, windowSize],
  );
  const toneNextAction = alertSummary
    ? undefined
    : resolvedMissingMaster
      ? MISSING_MASTER_RECOVERY_NEXT_ACTION
      : queuePhase === 'error'
        ? '請求再取得'
        : 'ORCA再送';

  return (
    <section
      id="document-timeline"
      className="document-timeline"
      aria-live={resolveAriaLive(tone)}
      aria-atomic="false"
      role="region"
      tabIndex={-1}
      data-run-id={resolvedRunId}
    >
      <div className="document-timeline__header" aria-label="DocumentTimeline メタ">
        <h2>Document Timeline</h2>
        <div className="document-timeline__meta-bar" role="status" aria-live={infoLive}>
          <span>RUN_ID: {resolvedRunId}</span>
          <span>dataSourceTransition: {resolvedTransition ?? 'snapshot'}</span>
          <span>cacheHit: {String(resolvedCacheHit ?? false)}</span>
          <span>missingMaster: {String(resolvedMissingMaster ?? false)}</span>
          <span>fallbackUsed: {String(resolvedFallbackUsed ?? false)}</span>
        </div>
      </div>
      {alertSummary && (
        <div
          className={`document-timeline__alert document-timeline__alert--${alertSummary.tone}`}
          role="alert"
          aria-live={resolveAriaLive(alertSummary.tone)}
        >
          <div className="document-timeline__alert-header">
            <strong>{alertSummary.title}</strong>
            <span>復旧導線をひとつに絞って案内します。</span>
          </div>
          {alertSummary.details.length > 0 && (
            <ul className="document-timeline__alert-list">
              {alertSummary.details.map((detail, index) => (
                <li key={`${detail}-${index}`}>{detail}</li>
              ))}
            </ul>
          )}
          {alertSummary.action && (
            <div className="document-timeline__next-actions">
              <button
                type="button"
                className={`document-timeline__cta document-timeline__cta--${alertSummary.action.tone}`}
                onClick={alertSummary.action.onClick}
                disabled={alertSummary.action.disabled || !alertSummary.action.onClick}
              >
                {alertSummary.action.label}
              </button>
              {alertSummary.action.note && (
                <span className="document-timeline__alert-note">{alertSummary.action.note}</span>
              )}
            </div>
          )}
        </div>
      )}
      <ToneBanner
        tone={tone}
        message={toneMessage}
        runId={resolvedRunId}
        destination="ORCA Queue"
        nextAction={toneNextAction}
      />
      {appointmentBanner && (
        <ToneBanner
          tone={appointmentBanner.tone}
          message={appointmentBanner.message}
          runId={resolvedRunId}
          destination="予約/来院リスト"
          nextAction="必要に応じて再取得"
        />
      )}
      {orcaQueueError && (
        <ApiFailureBanner
          subject="ORCA キュー"
          error={orcaQueueError}
          destination="ORCA キュー"
          runId={resolvedRunId}
          nextAction="再取得 / 設定確認（管理画面のキュー監視）"
        />
      )}
      {(orcaPushEventsError || orcaPushEvents?.error) && (
        <ApiFailureBanner
          subject="PUSH 通知"
          error={orcaPushEventsError ?? new Error(orcaPushEvents?.error ?? 'PUSH 通知の取得に失敗しました。')}
          destination="PUSH 通知"
          runId={resolvedRunId}
          nextAction="再取得 / 通知設定の確認"
        />
      )}
      <div className="document-timeline__controls">
        <div className="document-timeline__control-group" aria-label="表示件数とページング">
          <button type="button" onClick={() => moveWindow('start')} className="document-timeline__pager">先頭</button>
          <button type="button" onClick={() => moveWindow('prev')} className="document-timeline__pager">前へ</button>
          <button type="button" onClick={() => moveWindow('next')} className="document-timeline__pager">次へ</button>
          <button type="button" onClick={() => moveWindow('center')} className="document-timeline__pager">選択へ</button>
          <button type="button" onClick={() => moveWindow('all')} className="document-timeline__pager">すべて表示</button>
          <span className="document-timeline__window-meta">
            表示 {windowedEntries.length}/{totalEntries} 件
          </span>
          <span className="document-timeline__window-meta">
            取得 {recordsReturned ?? entries.length} 件{typeof pageSize === 'number' ? `（pageSize=${pageSize}）` : ''}
            {isRefetchingList ? ' ｜ 再取得中…' : ''}
          </span>
        </div>
        <div className="document-timeline__control-group" aria-label="仮想化ウィンドウサイズ">
          <label>
            ウィンドウ: 
            <input
              id="document-timeline-window-size"
              name="documentTimelineWindowSize"
              type="number"
              min={8}
              max={256}
              step={8}
              value={windowSize}
              onChange={(e) => setWindowSize(Math.max(8, Math.min(256, Number(e.target.value))))}
            />
          </label>
        </div>
        {hasNextPage && onLoadMore && (
          <div className="document-timeline__control-group" aria-label="追加読み込み">
            <button type="button" onClick={onLoadMore} className="document-timeline__pager" disabled={isLoadingMore || isInitialLoading}>
              {isLoadingMore ? '追加取得中…' : 'さらに読み込む'}
            </button>
          </div>
        )}
      </div>
      {resolvedFallbackUsed && (
        <div className="document-timeline__fallback" role="alert" aria-live={resolveAriaLive('warning')}>
          <strong>外来データは暫定（fallbackUsed=true）です。</strong>
          <p>{MISSING_MASTER_RECOVERY_MESSAGE}</p>
        </div>
      )}
      {fallbackFlagMissing && (
        <div className="document-timeline__fallback" role="alert" aria-live={resolveAriaLive('warning')}>
          <strong>API から fallbackUsed フラグが返却されていません。</strong>
          <p>サーバー側の telemetry 設定を確認し、fallback 判定を UI/Audit に連携してください。</p>
        </div>
      )}
      {claimEnabled && effectiveClaimError && (
        <ApiFailureBanner
          subject="請求バンドル"
          error={effectiveClaimError}
          httpStatus={effectiveClaimData?.httpStatus}
          apiResult={effectiveClaimData?.apiResult}
          apiResultMessage={effectiveClaimData?.apiResultMessage}
          destination="請求バンドル"
          runId={resolvedRunId}
          nextAction="再取得"
          retryLabel="請求バンドルを再取得"
          onRetry={onRetryClaim}
          isRetrying={effectiveClaimLoading}
        />
      )}
      {claimEnabled &&
        !alertSummary &&
        !effectiveClaimError &&
        onRetryClaim &&
        (resolvedFallbackUsed || resolvedCacheHit === false) && (
        <div className="document-timeline__retry" aria-live={infoLive}>
          <p>請求バンドルの整合性を再確認するには再取得を実行してください。</p>
          <button className="document-timeline__retry-button" onClick={onRetryClaim} disabled={effectiveClaimLoading}>
            {effectiveClaimLoading ? '再取得中…' : '請求バンドルを再取得'}
          </button>
        </div>
      )}
      <div className="document-timeline__content">
        <div className="document-timeline__timeline">
          <div className="document-timeline__section-logs" aria-label="セクション別ログ">
            <div className="document-timeline__section-logs-header">
              <h3>セクション別ログ</h3>
              <span>RUN_ID: {resolvedRunId} ｜ transition: {resolvedTransition ?? 'snapshot'}</span>
            </div>
            <div className="document-timeline__section-logs-grid">
              {sectionLogs.map((log) => {
                const metaId = log.meta ? `document-timeline-log-${log.key}-meta` : undefined;
                const bodyId = `document-timeline-log-${log.key}-body`;
                const describedBy = metaId ? `${metaId} ${bodyId}` : bodyId;
                return (
                  <article
                    key={log.key}
                    className={`document-timeline__section-log document-timeline__section-log--${log.tone}`}
                    data-run-id={resolvedRunId}
                    aria-label={`${log.label} セクションログ`}
                    aria-describedby={describedBy}
                  >
                    <header>
                      <strong>{log.label}</strong>
                      {log.meta ? <span id={metaId}>{log.meta}</span> : null}
                    </header>
                    <p id={bodyId}>{log.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
          <div className="document-timeline__soap-history" aria-label="SOAP記載履歴">
            <div className="document-timeline__soap-history-header">
              <h3>SOAP記載履歴</h3>
              <span>保存/更新の監査ログ</span>
            </div>
            {soapTimelineEntries.length === 0 ? (
              <p className="document-timeline__soap-empty">SOAP 記載履歴はまだありません。</p>
            ) : (
              <ul className="document-timeline__soap-list">
                {soapTimelineEntries.map((entry) => {
                  const label = SOAP_SECTION_LABELS[entry.section];
                  const actionLabel = entry.action === 'save' ? '保存' : '更新';
                  const body =
                    entry.body.length > 160 ? `${entry.body.slice(0, 160)}…` : entry.body;
                  return (
                    <li key={entry.id} className="document-timeline__soap-entry" data-section={entry.section}>
                      <header>
                        <strong>{label}</strong>
                        <span className="document-timeline__soap-action">{actionLabel}</span>
                        <span className="document-timeline__soap-time">{formatSoapAuthoredAt(entry.authoredAt)}</span>
                      </header>
                      <p>{body}</p>
                      <div className="document-timeline__soap-meta">
                        <span>記載者: {entry.authorName?.trim() || entry.authorRole}</span>
                        <span>template: {entry.templateId ?? '—'}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="document-timeline__list" aria-label="タイムライン">
            <div className="document-timeline__timeline-header">
              <h3>タイムライン</h3>
              <span>受付→診療→会計</span>
            </div>
            {entryList}
          </div>
        </div>
        <div className="document-timeline__insights">
          <StatusBadge
            label="missingMaster"
            value={resolvedMissingMaster ? 'true' : 'false'}
            tone={resolvedMissingMaster ? 'warning' : 'success'}
            description={resolvedMissingMaster ? 'マスタ欠損を検知・再取得を待機中' : 'マスタ取得済み・ORCA 再送フェーズ'}
            runId={resolvedRunId}
          />
          <StatusBadge
            label="cacheHit"
            value={resolvedCacheHit ? 'true' : 'false'}
            tone={resolvedCacheHit ? 'success' : 'warning'}
            description={resolvedCacheHit ? 'キャッシュ命中：再取得不要' : 'キャッシュ未命中：再取得または server route を模索'}
            runId={resolvedRunId}
          />
          <div
            className={`document-timeline__transition document-timeline__transition--${transitionMeta.tone}`}
            role="status"
            aria-live={resolveAriaLive(transitionMeta.tone)}
          >
            <strong>{transitionMeta.label}</strong>
            <p>{transitionMeta.description}</p>
          </div>
          <div className="document-timeline__queue" aria-live={infoLive}>
            <div className="document-timeline__queue-header">
              <strong>ORCA キュー連携</strong>
              <span className="document-timeline__queue-runid">RUN_ID: {resolvedRunId}</span>
            </div>
            <div className="document-timeline__queue-badges">
              <StatusBadge
                label="dataSourceTransition"
                value={resolvedTransition ?? 'snapshot'}
                tone={transitionMeta.tone}
                description={transitionMeta.description}
                runId={resolvedRunId}
              />
              <StatusBadge
                label="fallbackUsed"
                value={resolvedFallbackUsed ? 'true' : 'false'}
                tone={resolvedFallbackUsed ? 'error' : 'info'}
                description={resolvedFallbackUsed ? 'フォールバック使用中。優先で再取得を実施' : 'フォールバック未使用'}
                runId={resolvedRunId}
              />
              <StatusBadge
                label="ORCA送信（選択患者）"
                value={selectedSendStatus?.label ?? (selectedPatientId ? '未取得' : '患者未選択')}
                tone={
                  selectedSendStatus?.tone ??
                  (selectedPatientId ? 'warning' : 'info')
                }
                description={
                  selectedSendStatus
                    ? [
                        selectedSendStatus.isStalled ? '滞留を検知' : undefined,
                        selectedSendStatus.lastDispatchAt ? `lastDispatchAt=${selectedSendStatus.lastDispatchAt}` : undefined,
                        selectedSendStatus.key === 'failure' && selectedSendStatus.error ? `error=${selectedSendStatus.error}` : undefined,
                        selectedIdentifierInline ? `送信ID: ${selectedIdentifierInline}` : undefined,
                      ]
                        .filter((v): v is string => typeof v === 'string' && v.length > 0)
                        .join(' ｜ ')
                    : [
                        selectedIdentifierInline ? `送信ID: ${selectedIdentifierInline}` : undefined,
                        'ORCA キュー応答から送信状態を解決します。',
                      ]
                        .filter((v): v is string => typeof v === 'string' && v.length > 0)
                        .join(' ｜ ')
                }
                runId={orcaQueue?.runId ?? resolvedRunId}
              />
              <StatusBadge
                label="ORCA キュー"
                value={orcaQueue?.source ? `${orcaQueue.source}` : isOrcaQueueLoading ? '取得中' : '未取得'}
                tone={orcaQueue?.source ? 'info' : isOrcaQueueLoading ? 'info' : 'warning'}
                description={
                  [
                    orcaQueue?.queue ? `entries=${orcaQueue.queue.length}` : undefined,
                    orcaQueue?.fetchedAt ? `fetchedAt=${orcaQueue.fetchedAt}` : undefined,
                    orcaQueue?.traceId ? `traceId=${orcaQueue.traceId}` : undefined,
                    typeof orcaQueueUpdatedAt === 'number' && orcaQueueUpdatedAt > 0 ? `updatedAt=${new Date(orcaQueueUpdatedAt).toISOString()}` : undefined,
                  ]
                    .filter((v): v is string => typeof v === 'string' && v.length > 0)
                    .join(' ｜ ')
                }
                runId={orcaQueue?.runId ?? resolvedRunId}
              />
              <StatusBadge
                label="ORCA キュー内訳"
                value={`待ち:${orcaQueueCounts.waiting} / 処理中:${orcaQueueCounts.processing} / 成功:${orcaQueueCounts.success} / 失敗:${orcaQueueCounts.failure}`}
                tone={orcaQueueCountsTone}
                description={
                  [
                    orcaQueueCounts.stalled > 0 ? `滞留:${orcaQueueCounts.stalled}` : undefined,
                    orcaQueueCounts.unknown > 0 ? `不明:${orcaQueueCounts.unknown}` : undefined,
                  ]
                    .filter((v): v is string => typeof v === 'string' && v.length > 0)
                    .join(' ｜ ') || '選択患者以外の滞留/失敗も含めて俯瞰します。'
                }
                runId={orcaQueue?.runId ?? resolvedRunId}
              />
              <StatusBadge
                label="PUSH通知"
                value={pushEventSummaryValue}
                tone={pushEventBadgeTone}
                description={
                  [
                    `events=${pushEvents.length}`,
                    pushEventApiResult ? `Api_Result=${pushEventApiResult}` : undefined,
                    pushEventApiResultMessage ? `Api_Result_Message=${pushEventApiResultMessage}` : undefined,
                    pushEventWarning,
                    pushEventSummary.newCount > 0 ? `new=${pushEventSummary.newCount}` : undefined,
                    pushEventSummary.deduped > 0 ? `deduped=${pushEventSummary.deduped}` : undefined,
                    pushEventSummary.lastEventAt ? `last=${pushEventSummary.lastEventAt}` : undefined,
                    orcaPushEvents?.fetchedAt ? `fetchedAt=${orcaPushEvents.fetchedAt}` : undefined,
                    orcaPushEventsUpdatedAtLabel ? `updatedAt=${orcaPushEventsUpdatedAtLabel}` : undefined,
                  ]
                    .filter((v): v is string => typeof v === 'string' && v.length > 0)
                    .join(' ｜ ') || 'PUSH 通知のイベントを監視します。'
                }
                runId={orcaPushEvents?.runId ?? resolvedRunId}
              />
            </div>
            {pushEvents.length > 0 && (
              <div className="document-timeline__queue-meta" aria-live={infoLive}>
                <strong>PUSH通知（最新 {pushEvents.length} 件）</strong>
                <div className={`document-timeline__queue-row document-timeline__queue-row--${pushEventTone}`}>
                  <div className="document-timeline__queue-main">
                    {pushEvents.slice(0, 5).map((event, idx) => {
                      const label = event.event ?? 'event';
                      const metaParts = [
                        event.patientId ? `patient=${event.patientId}` : undefined,
                        event.timestamp ? `time=${event.timestamp}` : undefined,
                        event.eventId ? `id=${event.eventId}` : undefined,
                      ]
                        .filter((v): v is string => typeof v === 'string' && v.length > 0)
                        .join(' ｜ ');
                      return (
                        <div
                          key={`${label}-${event.eventId ?? event.timestamp ?? event.patientId ?? 'event'}-${idx}`}
                          className="document-timeline__queue-phase"
                        >
                          <span className="document-timeline__queue-label">{label}</span>
                          {metaParts && <span className="document-timeline__pill">{metaParts}</span>}
                        </div>
                      );
                    })}
                    {pushEvents.length > 5 && <p className="document-timeline__queue-detail">…ほか {pushEvents.length - 5} 件</p>}
                  </div>
                </div>
              </div>
            )}
            {claimEnabled && effectiveClaimData?.fetchedAt && (
              <p className="document-timeline__queue-meta">
                最終取得: {effectiveClaimData.fetchedAt} ｜ recordsReturned: {effectiveClaimData.recordsReturned ?? claimBundles.length ?? '―'}
              </p>
            )}
            {claimEnabled && claimBundles.length > 0 && (
              <div className="document-timeline__queue-meta" aria-live={infoLive}>
                <strong>請求バンドル ({claimBundles.length}件)</strong>
                <ul>
                  {claimBundles.slice(0, 3).map((bundle, idx) => (
                    <li key={bundle.bundleNumber ?? `${bundle.patientId ?? 'unknown'}-${bundle.appointmentId ?? idx}`}>
                      {bundle.patientId ?? '患者不明'} ｜ {bundle.bundleNumber ?? 'bundle?'} ｜{' '}
                      {bundle.claimStatus ?? '状態不明'}
                    </li>
                  ))}
                  {claimBundles.length > 3 && <li>…ほか {claimBundles.length - 3} 件</li>}
                </ul>
              </div>
            )}
          </div>
          {auditSummary ? (
            <ToneBanner
              tone={auditSummary.tone}
              message={auditSummary.message}
              destination="Charts/Timeline"
              nextAction="必要なら再取得して整合を確認"
              runId={resolvedRunId}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
