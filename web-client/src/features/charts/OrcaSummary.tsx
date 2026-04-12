import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ToneBanner } from '../reception/components/ToneBanner';
import { StatusBadge } from '../shared/StatusBadge';
import { MissingMasterRecoveryGuide } from '../shared/MissingMasterRecoveryGuide';
import { MISSING_MASTER_RECOVERY_MESSAGE, MISSING_MASTER_RECOVERY_STATUS_DETAIL } from '../shared/missingMasterRecovery';
import { useAuthService } from './authService';
import { getChartToneDetails, getTransitionCopy, type ChartTonePayload } from '../../ux/charts/tones';
import { resolveAriaLive, resolveRunId } from '../../libs/observability/observability';
import type { OrcaOutpatientSummary } from './api';
import type { ClaimOutpatientPayload, ReceptionEntry } from '../outpatient/types';
import { recordOutpatientFunnel } from '../../libs/telemetry/telemetryClient';
import { logAuditEvent, logUiState } from '../../libs/audit/auditLogger';
import { resolveOutpatientFlags, type OutpatientFlagSource } from '../outpatient/flags';
import { useOptionalSession } from '../../AppRouter';
import { useAppNavigation } from '../../routes/useAppNavigation';
import { buildIncomeInfoRequest, fetchOrcaIncomeInfo } from './orcaIncomeInfoApi';
import { getOrcaClaimSendEntry, type OrcaMedicalWarningUi } from './orcaClaimSendCache';
import { formatOrcaIdentifier } from './orcaIdentifiers';
import {
  buildBillingStatusUpdateAudit,
  resolveBillingStatusFromInvoice,
  resolveBillingStatusUpdateDurationMs,
} from './orcaBillingStatus';
import { saveOrcaIncomeInfoCache } from './orcaIncomeInfoCache';
import type { OrcaEncounterContext } from './orcaEncounterContext';

export interface OrcaSummaryProps {
  summary?: OrcaOutpatientSummary;
  claim?: ClaimOutpatientPayload;
  claimEnabled?: boolean;
  showOperationalMeta?: boolean;
  appointments?: ReceptionEntry[];
  appointmentMeta?: OutpatientFlagSource;
  patientId?: string;
  visitDate?: string;
  orcaEncounterContext?: Partial<OrcaEncounterContext>;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
}

export function OrcaSummary({
  summary,
  claim,
  claimEnabled = true,
  showOperationalMeta = true,
  appointments = [],
  appointmentMeta,
  patientId,
  visitDate,
  orcaEncounterContext,
  onRefresh,
  isRefreshing = false,
}: OrcaSummaryProps) {
  const session = useOptionalSession();
  const appNav = useAppNavigation({ facilityId: session?.facilityId, userId: session?.userId });
  const { flags } = useAuthService();
  const effectiveClaim = claimEnabled ? claim : undefined;
  const resolvedFlags = resolveOutpatientFlags(summary, effectiveClaim, appointmentMeta, flags);
  const resolvedRunId = resolveRunId(resolvedFlags.runId ?? flags.runId);
  const resolvedMissingMaster = resolvedFlags.missingMaster ?? flags.missingMaster;
  const resolvedCacheHit = resolvedFlags.cacheHit ?? flags.cacheHit;
  const resolvedFallbackUsed = resolvedFlags.fallbackUsed ?? flags.fallbackUsed ?? false;
  const resolvedTransition = resolvedFlags.dataSourceTransition ?? flags.dataSourceTransition;
  const fallbackFlagMissing = resolvedFlags.fallbackFlagMissing ?? false;
  const [perfMeasured, setPerfMeasured] = useState(false);
  const renderStartedAt = useMemo(() => performance.now(), []);
  const resolvedPatientId = orcaEncounterContext?.patientId ?? patientId;
  const performDate = useMemo(
    () => orcaEncounterContext?.visitDate?.slice(0, 10) ?? visitDate?.slice(0, 10),
    [orcaEncounterContext?.visitDate, visitDate],
  );
  const performMonth = useMemo(() => performDate?.slice(0, 7), [performDate]);
  const hasIncomeRequestContext = Boolean(resolvedPatientId && performDate);
  const tonePayload: ChartTonePayload = {
    missingMaster: resolvedMissingMaster ?? false,
    cacheHit: resolvedCacheHit ?? false,
    dataSourceTransition: resolvedTransition ?? 'snapshot',
  };
  const { tone, message: sharedMessage, transitionMeta } = getChartToneDetails(tonePayload);
  const transitionCopy = getTransitionCopy(resolvedTransition ?? 'snapshot');

  const incomeInfoQuery = useQuery({
    queryKey: ['orca-income-info', resolvedPatientId, performDate],
    queryFn: () => {
      if (!resolvedPatientId || !performDate) throw new Error('patientId and performDate are required');
      const request = buildIncomeInfoRequest({ patientId: resolvedPatientId, baseDate: performDate });
      return fetchOrcaIncomeInfo(request);
    },
    enabled: false,
    staleTime: 60_000,
  });

  const [lastSendCache, setLastSendCache] = useState<ReturnType<typeof getOrcaClaimSendEntry> | null>(null);

  useEffect(() => {
    if (!claimEnabled) {
      setLastSendCache(null);
      return;
    }
    const cache = getOrcaClaimSendEntry(
      { facilityId: session?.facilityId, userId: session?.userId },
      resolvedPatientId,
    );
    setLastSendCache(cache);
  }, [
    claimEnabled,
    session?.facilityId,
    session?.userId,
    resolvedPatientId,
    summary?.fetchedAt,
    effectiveClaim?.fetchedAt,
    summary?.runId,
    effectiveClaim?.runId,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || !claimEnabled) return undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ patientId?: string }>).detail;
      if (detail?.patientId && detail.patientId !== resolvedPatientId) return;
      const cache = getOrcaClaimSendEntry(
        { facilityId: session?.facilityId, userId: session?.userId },
        resolvedPatientId,
      );
      setLastSendCache(cache);
    };
    window.addEventListener('orca-claim-send-cache-update', handler);
    return () => {
      window.removeEventListener('orca-claim-send-cache-update', handler);
    };
  }, [claimEnabled, resolvedPatientId, session?.facilityId, session?.userId]);

  const sendWarnings = useMemo(() => {
    const warnings = lastSendCache?.medicalWarnings ?? [];
    if (!lastSendCache?.performDate || lastSendCache.performDate.slice(0, 10) !== performDate) {
      return [];
    }
    return warnings;
  }, [lastSendCache?.medicalWarnings, lastSendCache?.performDate, performDate]);

  const handleWarningFocus = useCallback(
    (warning: OrcaMedicalWarningUi) => {
      if (typeof window === 'undefined') return;
      if (!resolvedPatientId) return;
      window.dispatchEvent(
        new CustomEvent('orca-medical-warning-focus', {
          detail: { patientId: resolvedPatientId, warning },
        }),
      );
    },
    [resolvedPatientId],
  );

  const incomeInfoNotice = useMemo(() => {
    if (!resolvedPatientId) {
      return { tone: 'warning' as const, message: '患者が未選択のため収納情報を取得できません。' };
    }
    if (!performDate) {
      return { tone: 'warning' as const, message: '来院日の文脈が不足しているため収納情報を取得できません。' };
    }
    if (incomeInfoQuery.isError) {
      return { tone: 'error' as const, message: '収納情報の取得に失敗しました。' };
    }
    const data = incomeInfoQuery.data;
    if (!data) return null;
    const apiResultLabel = `Api_Result=${data.apiResult ?? '—'}`;
    if (!data.ok) {
      const detail = data.error ?? data.apiResultMessage ?? '収納情報の取得に失敗しました。';
      return { tone: 'error' as const, message: `${apiResultLabel} / ${detail}` };
    }
    const apiOk = Boolean(data.apiResult && /^0+$/.test(data.apiResult));
    if (!apiOk) {
      const reason = data.apiResultMessage;
      return {
        tone: 'warning' as const,
        message: `${apiResultLabel} / ${reason || '収納情報の取得に警告'}`,
      };
    }
    if (data.entries.length === 0) {
      return { tone: 'warning' as const, message: `${apiResultLabel} / 収納情報が見つかりません。` };
    }
    return { tone: 'success' as const, message: `${apiResultLabel} / 収納情報の取得に成功` };
  }, [incomeInfoQuery.data, incomeInfoQuery.isError, performDate, resolvedPatientId]);
  const resolvedIncomeTone = incomeInfoNotice?.tone === 'success' ? 'info' : incomeInfoNotice?.tone;

  const summaryMessage = useMemo(() => {
    if (resolvedMissingMaster) {
      return `${sharedMessage} ${MISSING_MASTER_RECOVERY_MESSAGE}`;
    }
    if (resolvedFallbackUsed) {
      return `${sharedMessage} ${MISSING_MASTER_RECOVERY_MESSAGE}`;
    }
    if (fallbackFlagMissing) {
      return `${sharedMessage} fallbackUsed フラグが欠落しています。サーバー応答にフラグを含めてください。`;
    }
    if (resolvedCacheHit) {
      return `${sharedMessage} ORCA 再送は Info tone で提示し、${transitionMeta.label} を記録します。`;
    }
    return `${sharedMessage} ${transitionMeta.label} を監査ログへ再送出します。`;
  }, [resolvedCacheHit, resolvedFallbackUsed, fallbackFlagMissing, resolvedMissingMaster, sharedMessage, transitionMeta.label]);

  const payloadPreview = useMemo(() => {
    if (!summary?.payload) return null;
    const entries = Object.entries(summary.payload).slice(0, 4);
    return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' ｜ ');
  }, [summary?.payload]);

  const claimBundles = effectiveClaim?.bundles ?? [];
  const claimTotal = useMemo(
    () =>
      claimBundles.reduce((acc, bundle) => {
        if (typeof bundle.totalClaimAmount === 'number') return acc + bundle.totalClaimAmount;
        const itemSum = bundle.items?.reduce((sum, item) => sum + (item.amount ?? 0), 0) ?? 0;
        return acc + itemSum;
      }, 0),
    [claimBundles],
  );
  const appointmentList = useMemo(() => {
    const sorted = [...appointments].sort((a, b) => (a.appointmentTime ?? '').localeCompare(b.appointmentTime ?? ''));
    return sorted.slice(0, 3);
  }, [appointments]);
  const hasAppointmentCollision = useMemo(() => {
    const seen = new Set<string>();
    return appointmentList.some((entry) => {
      const key = `${entry.appointmentTime ?? ''}-${entry.department ?? ''}`;
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
  }, [appointmentList]);

  const incomeEntries = incomeInfoQuery.data?.entries ?? [];
  const paidInvoiceNumbers = useMemo(() => {
    const numbers = incomeEntries.map((entry) => entry.invoiceNumber).filter((value): value is string => Boolean(value));
    return new Set(numbers);
  }, [incomeEntries]);
  const incomePreview = incomeEntries.slice(0, 3);
  const incomeLatest = useMemo(() => {
    if (incomeEntries.length === 0) return undefined;
    return [...incomeEntries].sort((a, b) => (b.performDate ?? '').localeCompare(a.performDate ?? ''))[0];
  }, [incomeEntries]);
  const incomeStatusLabel = useMemo(() => {
    if (!resolvedPatientId) return '患者未選択';
    if (!performDate) return '来院日未解決';
    if (incomeEntries.length === 0) return 'データなし';
    return null;
  }, [incomeEntries.length, performDate, resolvedPatientId]);
  const incomeTotals = useMemo(() => {
    const totals = incomeEntries.reduce(
      (acc, entry) => {
        acc.claim += entry.claimAmount ?? 0;
        acc.receipt += entry.paymentAmount ?? 0;
        acc.insurance += entry.insuranceAppliedAmount ?? 0;
        acc.selfPay += entry.selfPayAmount ?? 0;
        acc.mealLiving += entry.mealLivingCopayAmount ?? 0;
        return acc;
      },
      { claim: 0, receipt: 0, insurance: 0, selfPay: 0, mealLiving: 0 },
    );
    return totals;
  }, [incomeEntries]);

  const ctaDisabledReason = resolvedFallbackUsed ? 'fallback_used' : resolvedMissingMaster ? 'missing_master' : undefined;
  const isCtaDisabled = Boolean(ctaDisabledReason);
  const invoiceNumber = effectiveClaim?.invoiceNumber ?? lastSendCache?.invoiceNumber;
  const invoiceIdentifier = formatOrcaIdentifier('Invoice_Number', invoiceNumber ?? effectiveClaim?.invoiceNumber);
  const claimDataIdIdentifier = formatOrcaIdentifier('Data_Id', effectiveClaim?.dataId);
  const lastSendInvoiceIdentifier = formatOrcaIdentifier('Invoice_Number', lastSendCache?.invoiceNumber);
  const lastSendDataIdIdentifier = formatOrcaIdentifier('Data_Id', lastSendCache?.dataId);
  const billingDecision = useMemo(
    () => resolveBillingStatusFromInvoice(invoiceNumber, paidInvoiceNumbers),
    [invoiceNumber, paidInvoiceNumbers],
  );
  const displayClaimStatus = effectiveClaim?.claimStatus;
  const billingStatusRef = useRef<string | undefined>(undefined);
  const incomeRefreshCompletedAtRef = useRef<number | null>(null);

  const handleNavigate = useCallback(
    (target: 'reservation' | 'billing' | 'new-appointment') => {
      appNav.openReception({
        runId: resolvedRunId ?? undefined,
        section: target === 'reservation' ? 'appointment' : target === 'billing' ? 'billing' : undefined,
        intent: target === 'billing' ? 'billing' : undefined,
        create: target === 'new-appointment',
        visitDate,
      });
      logUiState({
        action: 'outpatient_fetch',
        screen: 'charts/orca-summary',
        controlId: `navigate-${target}`,
        runId: resolvedRunId,
        cacheHit: resolvedCacheHit,
        missingMaster: resolvedMissingMaster,
        dataSourceTransition: resolvedTransition,
        fallbackUsed: resolvedFallbackUsed,
        details: { target, dataSourceTransition: resolvedTransition },
      });
      recordOutpatientFunnel('orca_summary', {
        action: `navigate_${target}`,
        outcome: 'success',
        cacheHit: resolvedCacheHit ?? false,
        missingMaster: resolvedMissingMaster ?? false,
        dataSourceTransition: resolvedTransition ?? 'snapshot',
        fallbackUsed: resolvedFallbackUsed ?? false,
        runId: resolvedRunId,
        note: `cta:${target}`,
      });
    },
    [
      appNav,
      resolvedCacheHit,
      resolvedFallbackUsed,
      resolvedMissingMaster,
      resolvedRunId,
      resolvedTransition,
      visitDate,
    ],
  );

  const handleOpenReception = useCallback(() => {
    appNav.openReception();
  }, [appNav]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    logUiState({
      action: 'outpatient_fetch',
      screen: 'charts/orca-summary',
      controlId: 'refresh',
      runId: resolvedRunId,
      cacheHit: resolvedCacheHit,
      missingMaster: resolvedMissingMaster,
      dataSourceTransition: resolvedTransition,
      fallbackUsed: resolvedFallbackUsed,
      details: { manualRefresh: true },
    });
    const started = performance.now();
    recordOutpatientFunnel('orca_summary', {
      action: 'manual_refresh',
      outcome: 'started',
      cacheHit: resolvedCacheHit ?? false,
      missingMaster: resolvedMissingMaster ?? false,
      dataSourceTransition: resolvedTransition ?? 'snapshot',
      fallbackUsed: resolvedFallbackUsed ?? false,
      runId: resolvedRunId,
    });
    try {
      await onRefresh();
      recordOutpatientFunnel('orca_summary', {
        action: 'manual_refresh',
        outcome: 'success',
        cacheHit: resolvedCacheHit ?? false,
        missingMaster: resolvedMissingMaster ?? false,
        dataSourceTransition: resolvedTransition ?? 'snapshot',
        fallbackUsed: resolvedFallbackUsed ?? false,
        runId: resolvedRunId,
        durationMs: Math.round(performance.now() - started),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      recordOutpatientFunnel('orca_summary', {
        action: 'manual_refresh',
        outcome: 'error',
        cacheHit: resolvedCacheHit ?? false,
        missingMaster: resolvedMissingMaster ?? false,
        dataSourceTransition: resolvedTransition ?? 'snapshot',
        fallbackUsed: resolvedFallbackUsed ?? false,
        runId: resolvedRunId,
        note: reason,
        reason,
      });
    }
  }, [
    onRefresh,
    resolvedCacheHit,
    resolvedFallbackUsed,
    resolvedMissingMaster,
    resolvedRunId,
    resolvedTransition,
  ]);

  const handleIncomeRefresh = useCallback(async () => {
    if (!resolvedPatientId || !performDate) return;
    const started = performance.now();
    recordOutpatientFunnel('orca_summary', {
      action: 'income_refresh',
      outcome: 'started',
      cacheHit: resolvedCacheHit ?? false,
      missingMaster: resolvedMissingMaster ?? false,
      dataSourceTransition: resolvedTransition ?? 'snapshot',
      fallbackUsed: resolvedFallbackUsed ?? false,
      runId: resolvedRunId,
    });
    try {
      await incomeInfoQuery.refetch();
      incomeRefreshCompletedAtRef.current = performance.now();
      recordOutpatientFunnel('orca_summary', {
        action: 'income_refresh',
        outcome: 'success',
        cacheHit: resolvedCacheHit ?? false,
        missingMaster: resolvedMissingMaster ?? false,
        dataSourceTransition: resolvedTransition ?? 'snapshot',
        fallbackUsed: resolvedFallbackUsed ?? false,
        runId: resolvedRunId,
        durationMs: Math.round(performance.now() - started),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      recordOutpatientFunnel('orca_summary', {
        action: 'income_refresh',
        outcome: 'error',
        cacheHit: resolvedCacheHit ?? false,
        missingMaster: resolvedMissingMaster ?? false,
        dataSourceTransition: resolvedTransition ?? 'snapshot',
        fallbackUsed: resolvedFallbackUsed ?? false,
        runId: resolvedRunId,
        note: reason,
        reason,
      });
    }
  }, [
    incomeInfoQuery,
    resolvedPatientId,
    performDate,
    resolvedCacheHit,
    resolvedFallbackUsed,
    resolvedMissingMaster,
    resolvedRunId,
    resolvedTransition,
  ]);

  useEffect(() => {
    if (perfMeasured) return;
    if (!summary && !claim) return;
    setPerfMeasured(true);
    recordOutpatientFunnel('orca_summary', {
      action: 'render',
      outcome: 'success',
      durationMs: Math.round(performance.now() - renderStartedAt),
      cacheHit: resolvedCacheHit ?? false,
      missingMaster: resolvedMissingMaster ?? false,
      dataSourceTransition: resolvedTransition ?? 'snapshot',
      fallbackUsed: resolvedFallbackUsed ?? false,
      runId: resolvedRunId,
    });
  }, [
    claim,
    perfMeasured,
    renderStartedAt,
    resolvedCacheHit,
    resolvedFallbackUsed,
    resolvedMissingMaster,
    resolvedRunId,
    resolvedTransition,
    summary,
  ]);

  useEffect(() => {
    if (!resolvedPatientId || !incomeInfoQuery.data?.ok) return;
    const invoiceNumbers = incomeEntries
      .map((entry) => entry.invoiceNumber)
      .filter((value): value is string => Boolean(value));
    saveOrcaIncomeInfoCache(
      {
        patientId: resolvedPatientId,
        performMonth,
        invoiceNumbers,
        fetchedAt: new Date().toISOString(),
        apiResult: incomeInfoQuery.data.apiResult,
        apiResultMessage: incomeInfoQuery.data.apiResultMessage,
      },
      { facilityId: session?.facilityId, userId: session?.userId },
    );
  }, [
    incomeEntries,
    incomeInfoQuery.data?.apiResult,
    incomeInfoQuery.data?.apiResultMessage,
    incomeInfoQuery.data?.ok,
    resolvedPatientId,
    performMonth,
    session?.facilityId,
    session?.userId,
  ]);

  useEffect(() => {
    if (!resolvedPatientId || !invoiceNumber || !billingDecision.status) return;
    if (incomeRefreshCompletedAtRef.current) return;
    if (billingStatusRef.current === billingDecision.status) return;
    billingStatusRef.current = billingDecision.status;
    logAuditEvent({
      runId: resolvedRunId,
      source: 'charts/orca-summary',
      patientId: resolvedPatientId,
      payload: buildBillingStatusUpdateAudit({
        status: billingDecision.status,
        invoiceNumber,
        performMonth,
        apiResult: incomeInfoQuery.data?.apiResult,
        apiResultMessage: incomeInfoQuery.data?.apiResultMessage,
        fetchedAt: incomeInfoQuery.data?.informationDate,
      }),
    });
  }, [
    billingDecision.status,
    incomeInfoQuery.data?.apiResult,
    incomeInfoQuery.data?.apiResultMessage,
    incomeInfoQuery.data?.informationDate,
    invoiceNumber,
    resolvedPatientId,
    performMonth,
    resolvedRunId,
  ]);

  useEffect(() => {
    const completedAt = incomeRefreshCompletedAtRef.current;
    if (!completedAt) return;
    const durationMs = resolveBillingStatusUpdateDurationMs(completedAt, performance.now());
    incomeRefreshCompletedAtRef.current = null;
    if (durationMs === undefined) return;
    recordOutpatientFunnel('orca_summary', {
      action: 'billing_status_update',
      outcome: 'success',
      cacheHit: resolvedCacheHit ?? false,
      missingMaster: resolvedMissingMaster ?? false,
      dataSourceTransition: resolvedTransition ?? 'snapshot',
      fallbackUsed: resolvedFallbackUsed ?? false,
      runId: resolvedRunId,
      durationMs,
      note: displayClaimStatus ?? billingDecision.status ?? 'unknown',
    });
    logAuditEvent({
      runId: resolvedRunId,
      source: 'charts/orca-summary',
      patientId: resolvedPatientId,
      payload: buildBillingStatusUpdateAudit({
        status: displayClaimStatus ?? billingDecision.status,
        invoiceNumber,
        performMonth,
        apiResult: incomeInfoQuery.data?.apiResult,
        apiResultMessage: incomeInfoQuery.data?.apiResultMessage,
        fetchedAt: incomeInfoQuery.data?.informationDate,
        durationMs,
      }),
    });
  }, [
    billingDecision.status,
    displayClaimStatus,
    incomeInfoQuery.data?.apiResult,
    incomeInfoQuery.data?.apiResultMessage,
    incomeInfoQuery.data?.informationDate,
    incomeInfoQuery.dataUpdatedAt,
    invoiceNumber,
    resolvedPatientId,
    performMonth,
    resolvedCacheHit,
    resolvedFallbackUsed,
    resolvedMissingMaster,
    resolvedRunId,
    resolvedTransition,
  ]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        void handleRefresh();
      }
      if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        handleNavigate('billing');
      }
      if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        handleNavigate('reservation');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNavigate, handleRefresh]);

  const summaryUpdatedAt = summary?.fetchedAt ?? effectiveClaim?.fetchedAt ?? lastSendCache?.savedAt ?? '—';
  const sendStatusLabel = lastSendCache?.sendStatus
    ? lastSendCache.sendStatus === 'success'
      ? '送信成功'
      : '送信失敗'
    : '未送信';
  const warningStateLabel = sendWarnings.length > 0 ? `警告 ${sendWarnings.length} 件` : '警告なし';
  const hasRecoveryIssue =
    resolvedMissingMaster ||
    resolvedFallbackUsed ||
    sendWarnings.length > 0 ||
    incomeInfoNotice?.tone === 'error';
  const recoveryTraceId = summary?.traceId ?? effectiveClaim?.traceId ?? lastSendCache?.traceId ?? '—';

  return (
    <section
      className="orca-summary"
      id="charts-orca-summary"
      tabIndex={-1}
      data-focus-anchor="true"
      data-run-id={resolvedRunId}
      data-loading-scope="orca-summary"
      data-test-id="orca-summary"
    >
      <ToneBanner
        tone={tone}
        message={summaryMessage}
        destination="ORCA master"
        runId={resolvedRunId}
        ariaLive={tone === 'info' ? 'polite' : 'assertive'}
      />
      {(resolvedMissingMaster || resolvedFallbackUsed) && (
        <MissingMasterRecoveryGuide
          runId={resolvedRunId}
          onRefetch={handleRefresh}
          isRefetching={isRefreshing}
          onOpenReception={handleOpenReception}
        />
      )}
      <div className="orca-summary__headline" role="status" aria-live={resolveAriaLive('info')}>
        <span>送信状況: {sendStatusLabel}</span>
        <span>{warningStateLabel}</span>
        <span>最終更新: {summaryUpdatedAt}</span>
      </div>
      {hasRecoveryIssue ? (
        <div className="orca-summary__recovery" role="group" aria-label="エラー時の再取得とログ">
          <button type="button" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? '再取得中…' : '再取得'}
          </button>
          <button type="button" onClick={handleOpenReception}>
            受付を開く
          </button>
          <span>runId: {resolvedRunId ?? '—'}</span>
          <span>traceId: {recoveryTraceId}</span>
        </div>
      ) : null}
      <details className="orca-summary__details-fold">
        <summary className="orca-summary__details-summary">詳細を表示</summary>
        <div className="orca-summary__details-body">
      {showOperationalMeta ? (
        <div className="orca-summary__details">
          <div className="orca-summary__meta">
            <p className="orca-summary__meta-label">dataSourceTransition</p>
            <strong>{transitionCopy.headline}</strong>
            <p>{transitionCopy.body}</p>
            <p className="orca-summary__meta-label">recordsReturned</p>
            <strong>{summary?.recordsReturned ?? effectiveClaim?.recordsReturned ?? '―'}</strong>
            <p className="orca-summary__meta-label">outcome</p>
            <strong>{summary?.outcome ?? '―'}</strong>
            {summary?.fetchedAt && <p className="orca-summary__meta-note">取得: {summary.fetchedAt}</p>}
            {claimEnabled && effectiveClaim?.fetchedAt && !summary?.fetchedAt && (
              <p className="orca-summary__meta-note">請求取得: {effectiveClaim.fetchedAt}</p>
            )}
            {summary?.requestId && <p className="orca-summary__meta-note">requestId: {summary.requestId}</p>}
            {summary?.note && <p className="orca-summary__meta-note">メッセージ: {summary.note}</p>}
            {claimEnabled && effectiveClaim?.claimStatus && (
              <p className="orca-summary__meta-note">
                請求ステータス: {effectiveClaim.claimStatus}（{effectiveClaim.claimStatusText ?? 'textなし'}）
              </p>
            )}
            {claimEnabled && effectiveClaim?.bundles && effectiveClaim.bundles.length > 0 && (
              <p className="orca-summary__meta-note">請求バンドル件数: {effectiveClaim.bundles.length}</p>
            )}
          </div>
          <div className="orca-summary__badges">
            <StatusBadge
              label="missingMaster"
              value={resolvedMissingMaster ? 'true' : 'false'}
              tone={resolvedMissingMaster ? 'warning' : 'success'}
              description={
                resolvedMissingMaster
                  ? `マスタ未取得で再送停止。${MISSING_MASTER_RECOVERY_STATUS_DETAIL}`
                  : 'マスタ取得済みで ORCA 再送可能'
              }
              ariaLive="off"
              runId={resolvedRunId}
            />
            <StatusBadge
              label="cacheHit"
              value={resolvedCacheHit ? 'true' : 'false'}
              tone={resolvedCacheHit ? 'success' : 'warning'}
              description={resolvedCacheHit ? 'マスタキャッシュ命中' : 'キャッシュを使えず再取得を試行'}
              ariaLive="off"
              runId={resolvedRunId}
            />
            <StatusBadge
              label="fallbackUsed"
              value={resolvedFallbackUsed ? 'true' : 'false'}
              tone={resolvedFallbackUsed ? 'error' : 'info'}
              description={
                resolvedFallbackUsed
                  ? `fallbackUsed=true ｜ snapshot/fallback データで処理中。${MISSING_MASTER_RECOVERY_STATUS_DETAIL}`
                  : 'fallback 未使用'
              }
              ariaLive="off"
              runId={resolvedRunId}
            />
            {fallbackFlagMissing && (
              <StatusBadge
                label="fallbackFlagMissing"
                value="true"
                tone="warning"
                description="API 応答に fallbackUsed が含まれていません"
                ariaLive="off"
                runId={resolvedRunId}
              />
            )}
          </div>
        </div>
      ) : null}
      <div className="orca-summary__cards" aria-live="off">
        {claimEnabled && (
          <div className="orca-summary__card">
            <header>
              <strong>院内ローカル診療サマリ</strong>
              <span className="orca-summary__card-meta">status: {displayClaimStatus ?? '—'}</span>
            </header>
            <p className="orca-summary__help">院内編集中のローカル集計です。ORCA の請求・収納記録ではありません。</p>
            <ul>
              <li>ローカル見込み総額: {claimTotal > 0 ? `${claimTotal.toLocaleString()} 円` : '—'}</li>
              <li>ローカル請求件数: {claimBundles.length} 件</li>
              <li>院内ステータス: {effectiveClaim?.claimStatusText ?? '—'}</li>
              <li>recordsReturned: {effectiveClaim?.recordsReturned ?? summary?.recordsReturned ?? '—'}</li>
              {invoiceIdentifier && <li>{invoiceIdentifier}</li>}
              {claimDataIdIdentifier && <li>{claimDataIdIdentifier}</li>}
              {lastSendCache?.sendStatus && (
                <li>ORCA送信: {lastSendCache.sendStatus === 'success' ? '成功' : '失敗'}</li>
              )}
              {!effectiveClaim?.invoiceNumber && lastSendInvoiceIdentifier && (
                <li>直近送信: {lastSendInvoiceIdentifier}（runId={lastSendCache?.runId ?? '—'}）</li>
              )}
              {!effectiveClaim?.dataId && lastSendDataIdIdentifier && (
                <li>直近送信: {lastSendDataIdIdentifier}（runId={lastSendCache?.runId ?? '—'}）</li>
              )}
            </ul>
          </div>
        )}
        {claimEnabled && sendWarnings.length > 0 && (
          <div className="orca-summary__card orca-summary__card--warning">
            <header>
              <strong>ORCA 警告</strong>
              <span className="orca-summary__card-meta">{sendWarnings.length} 件</span>
            </header>
            <ul className="orca-summary__warning-list">
              {sendWarnings.slice(0, 8).map((warning, index) => {
                const key = `${warning.groupPosition ?? 'g'}-${warning.itemPosition ?? 'l'}-${warning.code ?? ''}-${index}`;
                const pos = warning.groupPosition
                  ? `G${warning.groupPosition}${warning.itemPosition ? `-L${warning.itemPosition}` : ''}`
                  : '位置不明';
                const text = warning.message ?? warning.medicalWarning ?? warning.code ?? '警告';
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className="orca-summary__warning-button"
                      onClick={() => handleWarningFocus(warning)}
                      title={warning.bundleName ? `${warning.bundleName} / ${text}` : text}
                    >
                      <span className="orca-summary__warning-pos">{pos}</span>
                      <span className="orca-summary__warning-text">{text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {sendWarnings.length > 8 && (
              <p className="orca-summary__help">他 {sendWarnings.length - 8} 件</p>
            )}
            <p className="orca-summary__help">
              警告項目をクリックすると、オーダー入力側（同一タブ内）で該当行へフォーカスします。
            </p>
          </div>
        )}
        <div className="orca-summary__card">
          <header>
            <strong>予約サマリ (直近3件)</strong>
          </header>
          {appointmentList.length === 0 && <p>予約データを取得中または未取得です。</p>}
          {appointmentList.length > 0 && (
            <ul>
              {appointmentList.map((entry, index) => {
                const appointmentKey = [
                  entry.appointmentId ?? 'appointment',
                  entry.patientId ?? 'patient',
                  entry.appointmentTime ?? 'time',
                  index,
                ].join(':');
                return (
                  <li key={appointmentKey}>
                    {entry.appointmentTime ?? '--:--'} ｜ {entry.department ?? '科未設定'} ｜ {entry.status} ｜ {entry.name ?? '氏名未設定'}
                  </li>
                );
              })}
            </ul>
          )}
          {hasAppointmentCollision && (
            <p
              className="orca-summary__warning"
              data-test-id="orca-summary-warning"
              role="alert"
              aria-live={resolveAriaLive('warning')}
            >
              予約時間が重複しています。オーバーブッキングに注意してください。
            </p>
          )}
        </div>
        <div className="orca-summary__card">
          <header>
            <strong>ORCA収納情報</strong>
            <span className="orca-summary__card-meta">
              {performDate ? `対象日: ${performDate}` : '来院日未解決'}
            </span>
          </header>
          <button
            type="button"
            onClick={handleIncomeRefresh}
            disabled={!hasIncomeRequestContext || incomeInfoQuery.isFetching}
            data-disabled-reason={!resolvedPatientId ? 'no-patient' : !performDate ? 'missing-perform-date' : incomeInfoQuery.isFetching ? 'loading' : undefined}
          >
            {incomeInfoQuery.isFetching ? '収納情報確認中…' : '収納情報を確認'}
          </button>
          {incomeInfoNotice ? (
            <ToneBanner
              tone={resolvedIncomeTone ?? 'info'}
              message={incomeInfoNotice.message}
              destination="incomeinfv2"
              runId={resolvedRunId}
              ariaLive={resolveAriaLive(resolvedIncomeTone ?? 'info')}
            />
          ) : null}
          <p className="orca-summary__help">official incomeinfv2 の収納情報です。ローカル診療サマリとは別の記録として扱ってください。</p>
          <div className="orca-summary__income-highlight">
            <div>
              <span className="orca-summary__label">直近請求</span>
              <strong>
                {incomeStatusLabel
                  ? incomeStatusLabel
                  : incomeLatest
                  ? `${incomeLatest.performDate ?? '日付不明'} ／ ${incomeLatest.departmentName ?? '科未設定'}`
                  : '—'}
              </strong>
            </div>
            <div>
              <span className="orca-summary__label">請求金額</span>
              <strong>{incomeLatest?.claimAmount !== undefined ? `${incomeLatest.claimAmount.toLocaleString()} 円` : '—'}</strong>
            </div>
          </div>
          <ul>
            <li>Api_Result: {incomeInfoQuery.data?.apiResult ?? '—'}</li>
            <li>件数: {incomeEntries.length} 件</li>
            <li>保険組合せ: {orcaEncounterContext?.insuranceCombinationNumber ?? incomeLatest?.insuranceCombinationNumber ?? '—'}</li>
            <li>
              取得: {incomeInfoQuery.data?.informationDate ?? '—'} {incomeInfoQuery.data?.informationTime ?? ''}
            </li>
          </ul>
          <div className="orca-summary__income-summary">
            <div>
              <span className="orca-summary__label">未収金合計 (Unpaid_Money_Total)</span>
              <strong>
                {incomeInfoQuery.data?.unpaidMoneyTotal !== undefined ? `${incomeInfoQuery.data.unpaidMoneyTotal.toLocaleString()} 円` : '—'}
              </strong>
            </div>
            <div>
              <span className="orca-summary__label">請求金額 (Ac_Money)</span>
              <strong>{incomeEntries.length > 0 ? `${incomeTotals.claim.toLocaleString()} 円` : '—'}</strong>
            </div>
            <div>
              <span className="orca-summary__label">入金額 (Ic_Money)</span>
              <strong>{incomeEntries.length > 0 ? `${incomeTotals.receipt.toLocaleString()} 円` : '—'}</strong>
            </div>
            <div>
              <span className="orca-summary__label">保険適用金額 (Ai_Money)</span>
              <strong>{incomeEntries.length > 0 ? `${incomeTotals.insurance.toLocaleString()} 円` : '—'}</strong>
            </div>
            <div>
              <span className="orca-summary__label">自費金額 (Oe_Money)</span>
              <strong>{incomeEntries.length > 0 ? `${incomeTotals.selfPay.toLocaleString()} 円` : '—'}</strong>
            </div>
            <div>
              <span className="orca-summary__label">食事・生活療養負担金 (Ml_Smoney)</span>
              <strong>{incomeEntries.length > 0 ? `${incomeTotals.mealLiving.toLocaleString()} 円` : '—'}</strong>
            </div>
          </div>
          {incomePreview.length > 0 && (
            <ul>
              {incomePreview.map((entry, index) => (
                <li key={`${entry.invoiceNumber ?? 'invoice'}-${index}`}>
                  {entry.performDate ?? '日付不明'} ｜ {entry.departmentName ?? '科未設定'} ｜ 請求金額: {entry.claimAmount?.toLocaleString() ?? '—'} 円 ｜ 入金額:{' '}
                  {entry.paymentAmount?.toLocaleString() ?? '—'} 円
                </li>
              ))}
            </ul>
          )}
          {incomeInfoQuery.data?.unpaidMoneyInformation?.length ? (
            <ul>
              {incomeInfoQuery.data.unpaidMoneyInformation.slice(0, 3).map((entry, index) => (
                <li key={`${entry.invoiceNumber ?? 'unpaid'}-${index}`}>
                  未収金情報: {entry.performDate ?? '日付不明'} ｜ 伝票 {entry.invoiceNumber ?? '—'} ｜ {entry.unpaidMoney?.toLocaleString() ?? '—'} 円
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {(resolvedFallbackUsed || resolvedMissingMaster || hasAppointmentCollision) && (
          <div
            className="orca-summary__card orca-summary__card--warning"
            role="alert"
            aria-live={resolveAriaLive('warning')}
            data-test-id="orca-summary-warning"
          >
            <strong>注意</strong>
            <ul>
              {resolvedFallbackUsed && (
                <li>計算は暫定（fallbackUsed=true）。会計/予約確定をブロックしています。{MISSING_MASTER_RECOVERY_STATUS_DETAIL}</li>
              )}
              {resolvedMissingMaster && (
                <li>マスタ未取得のため送信を停止中。{MISSING_MASTER_RECOVERY_STATUS_DETAIL}</li>
              )}
              {hasAppointmentCollision && <li>予約衝突あり。日付・時間を確認してください。</li>}
            </ul>
          </div>
        )}
      </div>
      {showOperationalMeta && payloadPreview && (
        <div className="orca-summary__payload" aria-live="off">
          <strong>応答プレビュー</strong>
          <p>{payloadPreview}</p>
        </div>
      )}
        </div>
      </details>
      <div className="orca-summary__cta" role="group" aria-label="OrcaSummary アクション">
        <button
          type="button"
          onClick={() => handleNavigate('reservation')}
          disabled={isCtaDisabled}
          data-disabled-reason={ctaDisabledReason}
        >
          予約へ
        </button>
        <button type="button" onClick={() => handleNavigate('billing')} disabled={isCtaDisabled} data-disabled-reason={ctaDisabledReason}>
          会計へ
        </button>
        <button type="button" onClick={handleRefresh} disabled={isRefreshing} data-disabled-reason={isRefreshing ? 'loading' : undefined}>
          {isRefreshing ? '再取得中…' : '再取得'}
        </button>
        <button
          type="button"
          onClick={() => handleNavigate('new-appointment')}
          disabled={isCtaDisabled}
          data-disabled-reason={ctaDisabledReason}
        >
          新規予約
        </button>
      </div>
    </section>
  );
}
