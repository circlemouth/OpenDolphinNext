import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { logAuditEvent, logUiState } from '../../libs/audit/auditLogger';
import { isSystemAdminRole } from '../../libs/auth/roles';
import { resolveAuditActor } from '../../libs/auth/storedAuth';
import { httpFetch } from '../../libs/http/httpClient';
import { getObservabilityMeta, resolveAriaLive } from '../../libs/observability/observability';
import { recordOutpatientFunnel } from '../../libs/telemetry/telemetryClient';
import { ToneBanner, type BannerTone } from '../reception/components/ToneBanner';
import { resolveUserSafeOperationFailure } from './userSafeErrorCopy';
import { StatusPill } from '../shared/StatusPill';
import { recordChartsAuditEvent, type ChartsOperationPhase } from './audit';
import type { ChartsTabLockStatus } from './useChartsTabLock';
import type { DataSourceTransition } from './authService';
import type { ClaimQueueEntry } from '../outpatient/types';
import type { ReceptionEntry } from '../reception/api';
import {
  clearOutpatientOutputResult,
  loadOutpatientOutputResult,
  saveOutpatientPrintPreview,
  saveReportPrintPreview,
} from './print/printPreviewStorage';
import { isNetworkError } from '../shared/apiError';
import { useOptionalSession } from '../../AppRouter';
import { buildPrintUrl } from '../../routes/appNavigation';
import { useAppNavigation } from '../../routes/useAppNavigation';
import { buildMedicalModV23RequestXml, postOrcaMedicalModV23Xml } from './orcaMedicalModApi';
import { buildMedicalModV2RequestXml, postOrcaMedicalModV2Xml } from './orcaClaimApi';
import { getOrcaClaimSendEntry, saveOrcaClaimSendCache, type OrcaMedicalWarningUi } from './orcaClaimSendCache';
import { ReportPrintDialog } from './print/ReportPrintDialog';
import { useOrcaReportPrint } from './print/useOrcaReportPrint';
import { MISSING_MASTER_RECOVERY_NEXT_STEPS } from '../shared/missingMasterRecovery';
import { ORCA_SEND_ORDER_ENTITIES } from './orderCategoryRegistry';
import { buildOrderHubEventId, recordOrderHubKpi } from './orderHubKpi';
import {
  buildMedicalModV2BlockNotice,
  fetchMedicalModV2OrderBundles,
  prepareMedicalModV2SendData,
} from './orderRpNormalization';
import { retryOrcaQueue } from '../outpatient/orcaQueueApi';

type ChartAction = 'start' | 'pause' | 'finish' | 'send' | 'draft' | 'cancel' | 'print';

type ToastState = {
  tone: 'success' | 'warning' | 'error' | 'info';
  message: string;
  detail?: string;
};

type ActionCompletionMeta = {
  requestId?: string;
  traceId?: string;
  runId?: string;
  encounterKey?: string;
  idempotencyKey?: string;
  detail?: string;
};

type BannerState = {
  tone: BannerTone;
  message: string;
  nextAction?: string;
};

type GuardReason = {
  key:
    | 'missing_master'
    | 'fallback_used'
    | 'config_disabled'
    | 'draft_unsaved'
    | 'permission_denied'
    | 'network_offline'
    | 'network_degraded'
    | 'not_server_route'
    | 'patient_not_selected'
    | 'locked'
    | 'approval_locked';
  summary: string;
  detail: string;
  next: string[];
};

type SendConfirmSummary = {
  patientName?: string;
  patientId?: string;
  birthDate?: string;
  age?: string;
  visitDate?: string;
  receptionId?: string;
  appointmentId?: string;
  diagnosisCount?: number;
  orderCount?: number;
  soap?: {
    subjective?: boolean;
    objective?: boolean;
    assessment?: boolean;
    plan?: boolean;
  };
  imageAttachmentCount?: number;
};

const ACTION_LABEL: Record<ChartAction, string> = {
  start: '診察開始',
  pause: '診察中断',
  finish: '診察終了',
  send: 'ORCA送信',
  draft: 'ドラフト保存',
  cancel: 'キャンセル',
  print: '印刷',
};

const CHARTS_SUPPORT_GUIDE = '必要に応じて障害情報コピーで RUN_ID を共有してください。';

const buildActionSuccessDetail = (action: ChartAction) => {
  if (action === 'send') {
    return 'ORCA 送信結果を確認し、必要なら一覧を再取得してください。';
  }
  if (action === 'finish') {
    return '会計待ちへの反映を確認してください。';
  }
  if (action === 'start' || action === 'pause') {
    return '画面上の状態更新を確認してください。';
  }
  if (action === 'print') {
    return 'プレビュー内容を確認してから出力してください。';
  }
  return CHARTS_SUPPORT_GUIDE;
};

const ORCA_ACTION_TIMEOUT_MS = Number(import.meta.env.VITE_ORCA_SEND_TIMEOUT_MS ?? '60000');
const resolveActionTimeoutMs = (action: ChartAction) => {
  if (action !== 'send' && action !== 'finish') return 0;
  if (!Number.isFinite(ORCA_ACTION_TIMEOUT_MS) || ORCA_ACTION_TIMEOUT_MS <= 0) return 0;
  return ORCA_ACTION_TIMEOUT_MS;
};

const summarizeGuardReasons = (reasons: GuardReason[]) => {
  if (reasons.length === 0) return null;
  const parts = reasons.slice(0, 2).map((reason) => reason.summary);
  let summary = parts.join(' / ');
  const remaining = reasons.length - parts.length;
  if (remaining > 0) summary = `${summary}（他${remaining}件）`;

  const normalizeActionKey = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const bracketIndex = trimmed.search(/[（(]/);
    if (bracketIndex === -1) return trimmed;
    return trimmed.slice(0, bracketIndex).trim();
  };

  const nextActions: string[] = [];
  const nextActionKeys = new Set<string>();
  for (const reason of reasons) {
    for (const action of reason.next) {
      const normalized = action.trim();
      if (!normalized) continue;
      const normalizedKey = normalizeActionKey(normalized);
      if (nextActionKeys.has(normalizedKey) || nextActions.includes(normalized)) continue;
      nextActions.push(normalized);
      if (normalizedKey) nextActionKeys.add(normalizedKey);
      if (nextActions.length >= 2) break;
    }
    if (nextActions.length >= 2) break;
  }

  return {
    summary,
    nextActions,
  };
};

export interface ChartsActionBarProps {
  runId: string;
  traceId?: string;
  cacheHit: boolean;
  missingMaster: boolean;
  dataSourceTransition: DataSourceTransition;
  fallbackUsed?: boolean;
  showOperationalMeta?: boolean;
  compactHeader?: boolean;
  defaultCollapsed?: boolean;
  embedded?: boolean;
  claimEnabled?: boolean;
  selectedEntry?: ReceptionEntry;
  sendEnabled?: boolean;
  sendDisabledReason?: string;
  patientId?: string;
  encounterId?: string;
  visitDate?: string;
  queueEntry?: ClaimQueueEntry;
  hasUnsavedDraft?: boolean;
  hasPermission?: boolean;
  requireServerRouteForSend?: boolean;
  requirePatientForSend?: boolean;
  networkDegradedReason?: string;
  approvalLock?: {
    locked: boolean;
    approvedAt?: string;
    runId?: string;
    action?: 'send';
  };
  editLock?: {
    readOnly: boolean;
    reason?: string;
    ownerRunId?: string;
    expiresAt?: string;
    lockStatus?: ChartsTabLockStatus;
  };
  uiLockReason?: string | null;
  onReloadLatest?: () => void | Promise<void>;
  onDiscardChanges?: () => void;
  onForceTakeover?: () => void;
  onAfterSend?: () => void | Promise<void>;
  onAfterStart?: () => ActionCompletionMeta | void | Promise<ActionCompletionMeta | void>;
  onAfterPause?: () => ActionCompletionMeta | void | Promise<ActionCompletionMeta | void>;
  onAfterFinish?: () => ActionCompletionMeta | void | Promise<ActionCompletionMeta | void>;
  onDraftSaved?: () => void;
  onLockChange?: (locked: boolean, reason?: string) => void;
  onApprovalConfirmed?: (meta: { action: 'send'; actor?: string }) => void;
  onApprovalUnlock?: () => void;
  onBeforeAction?: (action: ChartAction) => boolean | Promise<boolean>;
  sendConfirmSummary?: SendConfirmSummary;
}

export type ChartsActionBarHandle = {
  start: () => Promise<void>;
  pause: () => Promise<void>;
  finish: () => Promise<void>;
};

export const ChartsActionBar = forwardRef<ChartsActionBarHandle, ChartsActionBarProps>(function ChartsActionBar({
  runId,
  traceId,
  cacheHit,
  missingMaster,
  dataSourceTransition,
  fallbackUsed = false,
  showOperationalMeta = true,
  compactHeader = false,
  defaultCollapsed = false,
  embedded = false,
  claimEnabled = true,
  selectedEntry,
  sendEnabled = true,
  sendDisabledReason,
  patientId,
  encounterId,
  visitDate,
  queueEntry,
  hasUnsavedDraft = false,
  hasPermission = true,
  requireServerRouteForSend = true,
  requirePatientForSend = true,
  networkDegradedReason,
  approvalLock,
  editLock,
  uiLockReason,
  onReloadLatest,
  onDiscardChanges,
  onForceTakeover,
  onAfterSend,
  onAfterStart,
  onAfterPause,
  onAfterFinish,
  onDraftSaved,
  onLockChange,
  onApprovalConfirmed,
  onApprovalUnlock,
  onBeforeAction,
  sendConfirmSummary,
}: ChartsActionBarProps, ref) {
  const session = useOptionalSession();
  const canRetryOrcaQueue = isSystemAdminRole(session?.role);
  const storageScope = useMemo(
    () => ({ facilityId: session?.facilityId, userId: session?.userId }),
    [session?.facilityId, session?.userId],
  );
  const appNav = useAppNavigation({ facilityId: session?.facilityId, userId: session?.userId });
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [retryAction, setRetryAction] = useState<ChartAction | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runningAction, setRunningAction] = useState<ChartAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<ChartAction | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [approvalUnlockDialogStep, setApprovalUnlockDialogStep] = useState<'confirm' | 'final' | null>(null);
  const [forceTakeoverDialogStep, setForceTakeoverDialogStep] = useState<'confirm' | 'final' | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const outpatientResultRef = useRef(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(() => compactHeader && defaultCollapsed);

  const resolvedLockReason = uiLockReason ?? lockReason;
  const uiLocked = resolvedLockReason !== null;
  const readOnly = editLock?.readOnly === true;
  const readOnlyReason = editLock?.reason ?? '並行編集を検知したため、このタブは閲覧専用です。';
  const approvalLocked = approvalLock?.locked === true;
  const approvalReason = approvalLocked ? '署名確定済みのため編集できません。' : undefined;
  const actionLocked = uiLocked || isRunning || readOnly;
  const isLocked = actionLocked || approvalLocked;
  const resolvedTraceId = traceId ?? getObservabilityMeta().traceId;
  const resolvedPatientId = patientId ?? selectedEntry?.patientId;
  const resolvedAppointmentId = queueEntry?.appointmentId ?? selectedEntry?.appointmentId;
  const resolvedReceptionId = selectedEntry?.receptionId;
  const isServerRoute = dataSourceTransition === 'server';
  const headerMetaCollapsed = compactHeader && isHeaderCollapsed;
  const resolvedVisitDate = useMemo(
    () => visitDate ?? selectedEntry?.visitDate,
    [selectedEntry?.visitDate, visitDate],
  );
  const orcaSendEntry = getOrcaClaimSendEntry(storageScope, resolvedPatientId);
  const reportPrint = useOrcaReportPrint({
    dialogOpen: printDialogOpen,
    patientId: resolvedPatientId,
    appointmentId: resolvedAppointmentId,
    visitDate: resolvedVisitDate,
    selectedEntry,
    orcaSendEntry,
    runId,
    cacheHit,
    missingMaster,
    fallbackUsed,
    dataSourceTransition,
    traceId: resolvedTraceId,
  });
  const {
    printDestination,
    setPrintDestination,
    reportForm,
    updateReportField,
    reportFieldErrors,
    reportReady,
    reportIncomeStatus,
    reportIncomeError,
    reportIncomeLatest,
    reportInvoiceOptions,
    reportInsuranceOptions,
    reportNeedsInvoice,
    reportNeedsOutsideClass,
    reportNeedsDepartment,
    reportNeedsInsurance,
    reportNeedsPerformMonth,
    resolvedReportType,
    requestReportPreview,
  } = reportPrint;

  const resolveDepartmentCode = (department?: string) => {
    if (!department) return undefined;
    const trimmed = department.trim();
    if (!trimmed) return undefined;
    const leading = trimmed.match(/^(\d{2})(?:\D|$)/)?.[1];
    if (leading) return leading;
    const match = trimmed.match(/\b(\d{2})\b/);
    return match?.[1];
  };

  const resolvePhysicianCode = (physician?: string) => {
    if (!physician) return undefined;
    const trimmed = physician.trim();
    if (!trimmed) return undefined;
    const leading = trimmed.match(/^(\d{4,5})(?:\D|$)/)?.[1];
    if (!leading) return undefined;
    return leading.length === 4 ? `1${leading}` : leading;
  };

  const fetchVisitContextCodes = async (
    patientId: string,
    visitDate: string,
    signal?: AbortSignal,
  ): Promise<{ departmentCode?: string; physicianCode?: string }> => {
    try {
      const response = await httpFetch('/api/orca/visits/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitDate, requestNumber: '01' }),
        signal,
      });
      if (!response.ok) return {};
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const visits = Array.isArray(payload.visits) ? payload.visits : [];
      const matched = visits.find((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const candidate =
          (entry as { patientId?: string }).patientId ??
          ((entry as { patient?: { patientId?: string } }).patient?.patientId ?? undefined);
        return typeof candidate === 'string' && candidate.trim() === patientId;
      });
      if (!matched || typeof matched !== 'object') return {};
      const rawDepartment =
        (matched as { departmentCode?: unknown }).departmentCode ??
        (matched as { Department_Code?: unknown }).Department_Code ??
        (matched as { department?: unknown }).department;
      const rawPhysician =
        (matched as { physicianCode?: unknown }).physicianCode ??
        (matched as { Physician_Code?: unknown }).Physician_Code ??
        (matched as { physician?: unknown }).physician;
      const departmentCode = resolveDepartmentCode(typeof rawDepartment === 'string' ? rawDepartment : undefined);
      const physicianCode = resolvePhysicianCode(typeof rawPhysician === 'string' ? rawPhysician : undefined);
      return { departmentCode, physicianCode };
    } catch {
      return {};
    }
  };

  const normalizeVisitDate = (value?: string) => {
    if (!value) return undefined;
    return value.length >= 10 ? value.slice(0, 10) : value;
  };

  const isApiResultOk = (apiResult?: string) => Boolean(apiResult && /^0+$/.test(apiResult));
  const isIdempotentDuplicate = (apiResult?: string, apiResultMessage?: string) =>
    apiResult === '80' && Boolean(apiResultMessage && /既に同日の診療データが登録されています/.test(apiResultMessage));

  const sendQueueLabel = useMemo(() => {
    const phase = queueEntry?.phase;
    if (!phase) return undefined;
    if (phase === 'ack') return '成功';
    if (phase === 'failed') return '失敗';
    if (phase === 'retry' || phase === 'sent') return '処理中';
    if (phase === 'hold') return '待ち（保留）';
    return '待ち';
  }, [queueEntry?.phase]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!permissionDenied) return;
    if (hasPermission) {
      setPermissionDenied(false);
    }
  }, [hasPermission, permissionDenied]);

  useEffect(() => {
    if (outpatientResultRef.current) return;
    const outputResult = loadOutpatientOutputResult(storageScope);
    if (!outputResult) return;
    clearOutpatientOutputResult(storageScope);
    outpatientResultRef.current = true;
    if (outputResult.outcome === 'success') {
      setBanner(null);
      setToast({
        tone: 'success',
        message: '外来印刷を完了',
        detail: buildActionSuccessDetail('print'),
      });
      return;
    }
    const isBlocked = outputResult.outcome === 'blocked';
    const nextAction = '印刷/エクスポートを再度開く / 受付で再取得';
    setBanner({
      tone: isBlocked ? 'warning' : 'error',
      message: isBlocked ? '外来印刷が停止されました' : '外来印刷に失敗しました',
      nextAction,
    });
    setToast({
      tone: isBlocked ? 'warning' : 'error',
      message: isBlocked ? '外来印刷を停止' : '外来印刷に失敗',
      detail: isBlocked ? '印刷内容を見直してから再度開いてください。' : CHARTS_SUPPORT_GUIDE,
    });
  }, []);

  const sendPrecheckReasons: GuardReason[] = useMemo(() => {
    const reasons: GuardReason[] = [];

    if (!sendEnabled) {
      reasons.push({
        key: 'config_disabled',
        summary: '管理配信: 送信停止で送信不可',
        detail: sendDisabledReason ?? '管理配信により ORCA 送信が無効化されています。',
        next: ['管理画面で再配信', '設定を再取得して反映を確認'],
      });
    }

    if (uiLocked) {
      reasons.push({
        key: 'locked',
        summary: '他の操作: 実行中で送信不可',
        detail: resolvedLockReason ? resolvedLockReason : '別アクション実行中のため送信できません。',
        next: ['ロック解除', '処理完了を待って再試行'],
      });
    }

    if (isRunning) {
      reasons.push({
        key: 'locked',
        summary: '他の操作: 実行中で送信不可',
        detail: runningAction ? `${ACTION_LABEL[runningAction]} 実行中のため送信できません。` : '別アクション実行中のため送信できません。',
        next: ['処理完了を待って再試行'],
      });
    }

    if (readOnly) {
      reasons.push({
        key: 'locked',
        summary: '並行編集: 閲覧専用で送信不可',
        detail: readOnlyReason,
        next: ['最新を再読込', '別タブを閉じる', '必要ならロック引き継ぎ（強制）'],
      });
    }

    if (approvalLocked) {
      reasons.push({
        key: 'approval_locked',
        summary: '承認済み: 編集不可で送信不可',
        detail: approvalReason ?? '署名確定済みのため編集できません。',
        next: ['必要なら新規受付で再作成', '承認内容の確認（監査ログ）'],
      });
    }

    if (requirePatientForSend && !resolvedPatientId) {
      reasons.push({
        key: 'patient_not_selected',
        summary: '患者未選択: 対象未確定で送信不可',
        detail: '患者が未選択のため送信先が確定できません。',
        next: ['患者管理で患者を選択', '受付へ戻って対象患者を確定'],
      });
    }

    if (requireServerRouteForSend && !isServerRoute) {
      reasons.push({
        key: 'not_server_route',
        summary: '参照状態: 最新データ確認前のため送信不可',
        detail: '最新データを確認できる状態へ戻ってから送信してください。',
        next: ['server route に切替（MSW OFF / 実 API）', '受付で再取得'],
      });
    }

    if (missingMaster && isServerRoute) {
      reasons.push({
        key: 'missing_master',
        summary: 'ORCA 参照不足: 送信不可',
        detail: 'マスタ欠損を検知したため、送信は実施できません。',
        next: [...MISSING_MASTER_RECOVERY_NEXT_STEPS],
      });
    }

    if (fallbackUsed && isServerRoute) {
      reasons.push({
        key: 'fallback_used',
        summary: '暫定データ: 送信不可',
        detail: 'フォールバック経路のため、送信は実施できません。',
        next: [...MISSING_MASTER_RECOVERY_NEXT_STEPS],
      });
    }

    if (!embedded && hasUnsavedDraft) {
      reasons.push({
        key: 'draft_unsaved',
        summary: '未保存ドラフト: 保存前で送信不可',
        detail: '未保存の入力があるため、送信前にドラフト保存が必要です。',
        next: ['ドラフト保存', '不要なら入力を戻してから再送'],
      });
    }

    if (!isOnline) {
      reasons.push({
        key: 'network_offline',
        summary: '通信断: オフラインで送信不可',
        detail: 'ブラウザが offline 状態のため送信できません。',
        next: ['通信回復を待つ', '回線/プロキシ設定を確認'],
      });
    }

    if (networkDegradedReason) {
      reasons.push({
        key: 'network_degraded',
        summary: '通信不安定: 再取得が必要で送信不可',
        detail: networkDegradedReason,
        next: ['再取得してから再送', '受付へ戻って状態確認'],
      });
    }

    if ((permissionDenied || !hasPermission) && isServerRoute) {
      reasons.push({
        key: 'permission_denied',
        summary: '認証不備: 権限不足で送信不可',
        detail: permissionDenied
          ? '直近の送信で 401/403 を検知しました。'
          : '認証情報が揃っていないため送信を停止します。',
        next: ['再ログイン', '設定確認（facilityId/userId/password）'],
      });
    }

    return reasons;
  }, [
    dataSourceTransition,
    fallbackUsed,
    hasPermission,
    hasUnsavedDraft,
    isOnline,
    isRunning,
    runningAction,
    resolvedLockReason,
    missingMaster,
    networkDegradedReason,
    patientId,
    permissionDenied,
    approvalLocked,
    approvalReason,
    readOnly,
    readOnlyReason,
    requireServerRouteForSend,
    requirePatientForSend,
    sendDisabledReason,
    sendEnabled,
    embedded,
    uiLocked,
    isServerRoute,
    resolvedPatientId,
  ]);

  const finishPrecheckReasons: GuardReason[] = useMemo(() => {
    const reasons: GuardReason[] = [];

    if (isRunning) {
      reasons.push({
        key: 'locked',
        summary: '他の操作: 実行中で診察終了不可',
        detail: '別アクションの実行中は診察終了を開始できません。',
        next: ['処理完了を待つ'],
      });
    }

    if (uiLocked) {
      reasons.push({
        key: 'locked',
        summary: 'ロック中: 操作中で診察終了不可',
        detail: resolvedLockReason ? resolvedLockReason : '別アクション実行中のため診察終了できません。',
        next: ['ロック解除', '処理完了を待って再試行'],
      });
    }

    if (readOnly) {
      reasons.push({
        key: 'locked',
        summary: '並行編集: 閲覧専用で診察終了不可',
        detail: readOnlyReason,
        next: ['最新を再読込', '別タブを閉じる', '必要ならロック引き継ぎ（強制）'],
      });
    }

    if (approvalLocked) {
      reasons.push({
        key: 'approval_locked',
        summary: '承認済み: 編集不可で診察終了不可',
        detail: approvalReason ?? '署名確定済みのため編集できません。',
        next: ['必要なら新規受付で再作成', '承認内容の確認（監査ログ）'],
      });
    }

    if (!resolvedPatientId) {
      reasons.push({
        key: 'patient_not_selected',
        summary: '患者未選択: 対象未確定で診察終了不可',
        detail: 'patientId が未確定のため診察終了を実行できません。',
        next: ['患者管理で患者を選択', '受付へ戻って対象患者を確定'],
      });
    }

    return reasons;
  }, [approvalLocked, approvalReason, isRunning, readOnly, readOnlyReason, resolvedLockReason, uiLocked, resolvedPatientId]);

  const sendDisabled = isRunning || approvalLocked || sendPrecheckReasons.length > 0;
  const primaryAction = useMemo<ChartAction | 'sending'>(() => {
    if (isRunning && runningAction === 'send') return 'sending';
    const status = (selectedEntry?.status ?? '').trim();
    if (/受付|予約/.test(status)) return 'start';
    if (/診療中|診察中/.test(status)) return 'finish';
    if (/終了|会計|送信待ち|送信済/.test(status)) return 'send';
    if (!status) return 'finish';
    return 'send';
  }, [isRunning, runningAction, selectedEntry?.status]);

  const printPrecheckReasons: GuardReason[] = useMemo(() => {
    const reasons: GuardReason[] = [];

    if (isRunning) {
      reasons.push({
        key: 'locked',
        summary: '他の操作: 実行中で印刷不可',
        detail: '別アクションの実行中は印刷を開始できません。',
        next: ['処理完了を待って再試行'],
      });
    }

    if (uiLocked) {
      reasons.push({
        key: 'locked',
        summary: 'ロック中: 操作中で印刷不可',
        detail: resolvedLockReason ? resolvedLockReason : '別アクション実行中のため印刷できません。',
        next: ['ロック解除', '処理完了を待って再試行'],
      });
    }

    if (readOnly) {
      reasons.push({
        key: 'locked',
        summary: '並行編集: 閲覧専用で印刷不可',
        detail: readOnlyReason,
        next: ['最新を再読込', '別タブを閉じる', '必要ならロック引き継ぎ（強制）'],
      });
    }

    if (approvalLocked) {
      reasons.push({
        key: 'approval_locked',
        summary: '承認済み: 編集不可で印刷不可',
        detail: approvalReason ?? '署名確定済みのため編集できません。',
        next: ['必要なら新規受付で再作成', '承認内容の確認（監査ログ）'],
      });
    }

    if (!selectedEntry) {
      reasons.push({
        key: 'patient_not_selected',
        summary: '患者未選択: 対象未確定で印刷不可',
        detail: '患者が未選択のため印刷プレビューを開けません。',
        next: ['患者管理で患者を選択', '受付へ戻って対象患者を確定'],
      });
    }

    if (missingMaster) {
      reasons.push({
        key: 'missing_master',
        summary: 'ORCA 参照不足: 印刷不可',
        detail: 'マスタ欠損を検知したため出力を停止します。',
        next: [...MISSING_MASTER_RECOVERY_NEXT_STEPS],
      });
    }

    if (fallbackUsed) {
      reasons.push({
        key: 'fallback_used',
        summary: '暫定データ: 印刷不可',
        detail: 'フォールバック経路のため出力を停止します。',
        next: [...MISSING_MASTER_RECOVERY_NEXT_STEPS],
      });
    }

    if (permissionDenied || !hasPermission) {
      reasons.push({
        key: 'permission_denied',
        summary: '認証不備: 権限不足で印刷不可',
        detail: permissionDenied
          ? '直近の送信で 401/403 を検知しました。'
          : '認証情報が揃っていないため出力を停止します。',
        next: ['再ログイン', '設定確認（facilityId/userId/password）'],
      });
    }

    return reasons;
  }, [
    approvalLocked,
    approvalReason,
    fallbackUsed,
    hasPermission,
    isRunning,
    resolvedLockReason,
    missingMaster,
    permissionDenied,
    readOnly,
    readOnlyReason,
    selectedEntry,
    uiLocked,
  ]);

  const printDisabled = printPrecheckReasons.length > 0;
  const otherBlocked = isLocked;
  const guardSummaries = useMemo(() => {
    const entries: { key: string; action: string; summary: string; nextAction?: string }[] = [];
    if (finishPrecheckReasons.length > 0) {
      const summary = summarizeGuardReasons(finishPrecheckReasons);
      if (summary) {
        entries.push({
          key: 'finish',
          action: ACTION_LABEL.finish,
          summary: summary.summary,
          nextAction: summary.nextActions?.join(' / '),
        });
      }
    }
    if (sendPrecheckReasons.length > 0) {
      const summary = summarizeGuardReasons(sendPrecheckReasons);
      if (summary) {
        entries.push({
          key: 'send',
          action: ACTION_LABEL.send,
          summary: summary.summary,
          nextAction: summary.nextActions?.join(' / '),
        });
      }
    }
    if (printPrecheckReasons.length > 0) {
      const summary = summarizeGuardReasons(printPrecheckReasons);
      if (summary) {
        entries.push({
          key: 'print',
          action: ACTION_LABEL.print,
          summary: summary.summary,
          nextAction: summary.nextActions?.join(' / '),
        });
      }
    }
    return entries;
  }, [finishPrecheckReasons, printPrecheckReasons, sendPrecheckReasons]);
  useEffect(() => {
    onLockChange?.(actionLocked, resolvedLockReason ?? undefined);
  }, [actionLocked, onLockChange, resolvedLockReason]);

  const statusLine = useMemo(() => {
    if (isRunning && runningAction) {
      return `${ACTION_LABEL[runningAction]}を実行中… dataSourceTransition=${dataSourceTransition}`;
    }
    if (approvalLocked) {
      return '承認済み（署名確定）: 編集不可';
    }
    if (resolvedLockReason) return resolvedLockReason;
    if (readOnly) return readOnlyReason;
    if (sendPrecheckReasons.length > 0) {
      const summary = summarizeGuardReasons(sendPrecheckReasons);
      return `送信ガード: ${summary?.summary ?? sendPrecheckReasons[0].summary}`;
    }
    if (printPrecheckReasons.length > 0) {
      const summary = summarizeGuardReasons(printPrecheckReasons);
      return `印刷ガード: ${summary?.summary ?? printPrecheckReasons[0].summary}`;
    }
    if (finishPrecheckReasons.length > 0) {
      const summary = summarizeGuardReasons(finishPrecheckReasons);
      return `診察終了ガード: ${summary?.summary ?? finishPrecheckReasons[0].summary}`;
    }
    if (sendQueueLabel) {
      return `送信状態: ${sendQueueLabel}${queueEntry?.requestId ? `（requestId=${queueEntry.requestId}）` : ''}`;
    }
    return 'アクションを選択できます';
  }, [
    dataSourceTransition,
    isRunning,
    resolvedLockReason,
    queueEntry?.requestId,
    readOnly,
    readOnlyReason,
    resolvedTraceId,
    runId,
    runningAction,
    sendPrecheckReasons,
    sendQueueLabel,
    approvalLocked,
    approvalLock?.runId,
    finishPrecheckReasons,
    printPrecheckReasons,
  ]);

  const statusTone = useMemo<'ready' | 'busy' | 'guarded' | 'locked'>(() => {
    if (isRunning) return 'busy';
    if (approvalLocked || readOnly || Boolean(resolvedLockReason)) return 'locked';
    if (sendPrecheckReasons.length > 0 || printPrecheckReasons.length > 0 || finishPrecheckReasons.length > 0) return 'guarded';
    return 'ready';
  }, [
    approvalLocked,
    finishPrecheckReasons.length,
    isRunning,
    printPrecheckReasons.length,
    readOnly,
    resolvedLockReason,
    sendPrecheckReasons.length,
  ]);

  const sendDialogSummary = useMemo(() => {
    const patientName = sendConfirmSummary?.patientName?.trim() || selectedEntry?.name?.trim() || '—';
    const patientIdLabel = sendConfirmSummary?.patientId?.trim() || resolvedPatientId?.trim() || '—';
    const selectedBirthDate = (selectedEntry as Partial<{ birthDate?: string }> | undefined)?.birthDate;
    const birthDate = sendConfirmSummary?.birthDate?.trim() || selectedBirthDate?.trim() || '—';
    const ageLabel = sendConfirmSummary?.age?.trim() || '';
    const visitLabel = sendConfirmSummary?.visitDate?.trim() || resolvedVisitDate?.trim() || '—';
    const receptionLabel = sendConfirmSummary?.receptionId?.trim() || resolvedReceptionId?.trim() || '—';
    const appointmentLabel = sendConfirmSummary?.appointmentId?.trim() || resolvedAppointmentId?.trim() || '—';
    const diagnosisCount = typeof sendConfirmSummary?.diagnosisCount === 'number' ? `${sendConfirmSummary.diagnosisCount}件` : '—';
    const orderCount = typeof sendConfirmSummary?.orderCount === 'number' ? `${sendConfirmSummary.orderCount}件` : '—';
    const imageCount = typeof sendConfirmSummary?.imageAttachmentCount === 'number' ? `${sendConfirmSummary.imageAttachmentCount}件` : '—';
    const soap = sendConfirmSummary?.soap ?? {};
    const soapState = `${soap.subjective ? 'S:あり' : 'S:なし'} / ${soap.objective ? 'O:あり' : 'O:なし'} / ${
      soap.assessment ? 'A:あり' : 'A:なし'
    } / ${soap.plan ? 'P:あり' : 'P:なし'}`;

    return {
      patientName,
      patientIdLabel,
      birthDate,
      ageLabel,
      visitLabel,
      receptionLabel,
      appointmentLabel,
      diagnosisCount,
      orderCount,
      imageCount,
      soapState,
    };
  }, [
    resolvedAppointmentId,
    resolvedPatientId,
    resolvedReceptionId,
    resolvedVisitDate,
    selectedEntry,
    sendConfirmSummary,
  ]);

  const logTelemetry = (
    action: ChartAction,
    outcome: 'success' | 'error' | 'blocked' | 'started',
    durationMs?: number,
    note?: string,
    reason?: string,
    meta?: { runId?: string; traceId?: string },
  ) => {
    recordOutpatientFunnel('charts_action', {
      action,
      outcome,
      durationMs,
      note,
      reason,
      cacheHit,
      missingMaster,
      dataSourceTransition,
      fallbackUsed,
      runId: meta?.runId ?? runId,
      traceId: meta?.traceId ?? resolvedTraceId,
    });
  };

  const buildFallbackDetails = () => {
    const details: Record<string, unknown> = {};
    if (!patientId && resolvedPatientId) details.fallbackPatientId = resolvedPatientId;
    if (!queueEntry?.appointmentId && resolvedAppointmentId) details.fallbackAppointmentId = resolvedAppointmentId;
    if ((!patientId || !queueEntry?.appointmentId) && resolvedReceptionId) details.fallbackReceptionId = resolvedReceptionId;
    if (editLock?.lockStatus) details.lockStatus = editLock.lockStatus;
    return details;
  };

  const logAudit = (
    action: ChartAction,
    outcome: 'success' | 'error' | 'blocked' | 'started',
    detail?: string,
    durationMs?: number,
    options?: { phase?: ChartsOperationPhase; details?: Record<string, unknown> },
  ) => {
    const actionMap: Record<
      ChartAction,
      'ENCOUNTER_START' | 'ENCOUNTER_PAUSE' | 'ENCOUNTER_CLOSE' | 'ORCA_SEND' | 'DRAFT_SAVE' | 'DRAFT_CANCEL' | 'PRINT_OUTPATIENT'
    > = {
      start: 'ENCOUNTER_START',
      pause: 'ENCOUNTER_PAUSE',
      finish: 'ENCOUNTER_CLOSE',
      send: 'ORCA_SEND',
      draft: 'DRAFT_SAVE',
      cancel: 'DRAFT_CANCEL',
      print: 'PRINT_OUTPATIENT',
    };
    const normalizedAction = outcome === 'error' ? 'CHARTS_ACTION_FAILURE' : actionMap[action];
    const phase = options?.phase ?? (outcome === 'blocked' ? 'lock' : 'do');
    const details: Record<string, unknown> = {
      operationPhase: phase,
      ...(action === 'send' || action === 'start' || action === 'pause' || action === 'finish'
        ? {
            ...(resolvedVisitDate ? { visitDate: resolvedVisitDate } : {}),
          }
        : {}),
      ...buildFallbackDetails(),
      ...options?.details,
    };
    recordChartsAuditEvent({
      action: normalizedAction,
      outcome,
      subject: `charts-action-${action}`,
      note: detail,
      error: outcome === 'error' ? detail : undefined,
      durationMs,
      patientId: resolvedPatientId,
      appointmentId: resolvedAppointmentId,
      dataSourceTransition,
      cacheHit,
      missingMaster,
      fallbackUsed,
      runId,
      details,
    });
    if (action === 'send') {
      logAuditEvent({
        runId,
        cacheHit,
        missingMaster,
        fallbackUsed,
        dataSourceTransition,
        payload: {
          action: 'orca_claim_send',
          outcome,
          subject: `charts-action-${action}`,
          details,
        },
      });
    }
  };

  const approvalSessionRef = useRef<{ action: ChartAction; closed: boolean } | null>(null);

  const logApproval = (action: ChartAction, state: 'open' | 'confirmed' | 'cancelled') => {
    const blockedReasons = state === 'cancelled' ? ['confirm_cancelled'] : undefined;
    logUiState({
      action: action === 'print' ? 'print' : 'send',
      screen: 'charts/action-bar',
      controlId: `action-${action}-approval`,
      runId,
      cacheHit,
      missingMaster,
      dataSourceTransition,
      fallbackUsed,
      details: {
        operationPhase: 'approval',
        approvalState: state,
        patientId: resolvedPatientId,
        appointmentId: resolvedAppointmentId,
        requestId: queueEntry?.requestId,
        traceId: resolvedTraceId,
        ...(blockedReasons ? { blockedReasons } : {}),
        ...buildFallbackDetails(),
      },
    });
    logAudit(action, state === 'open' || state === 'confirmed' ? 'started' : 'blocked', `approval_${state}`, undefined, {
      phase: 'approval',
      details: {
        approvalState: state,
        requestId: queueEntry?.requestId,
        traceId: resolvedTraceId,
        ...(blockedReasons ? { blockedReasons } : {}),
        ...buildFallbackDetails(),
      },
    });
  };

  const finalizeApproval = (action: ChartAction, state: 'confirmed' | 'cancelled') => {
    const session = approvalSessionRef.current;
    if (!session || session.action !== action || session.closed) return;
    session.closed = true;
    logApproval(action, state);
  };

  const handleAction = async (action: ChartAction) => {
    if (isRunning) return;

    if (approvalLocked) {
      const blockedReason = approvalReason ?? '署名確定済みのため編集できません。';
      setToast({
        tone: 'warning',
        message: `${ACTION_LABEL[action]}を停止`,
        detail: blockedReason,
      });
      setRetryAction(null);
      logTelemetry(action, 'blocked', undefined, blockedReason, blockedReason);
      logUiState({
        action,
        screen: 'charts/action-bar',
        controlId: `action-${action}`,
        runId,
        cacheHit,
        missingMaster,
        dataSourceTransition,
        fallbackUsed,
        details: {
          operationPhase: 'lock',
          blocked: true,
          reasons: ['approval_locked'],
          traceId: resolvedTraceId,
          approval: approvalLock ?? null,
        },
      });
      logAudit(action, 'blocked', blockedReason, undefined, {
        phase: 'lock',
        details: {
          trigger: 'approval_locked',
          blockedReasons: ['approval_locked'],
          approvalState: 'confirmed',
        },
      });
      return;
    }

    if (readOnly) {
      const blockedReason = readOnlyReason;
      setToast({
        tone: 'warning',
        message: `${ACTION_LABEL[action]}を停止`,
        detail: blockedReason,
      });
      setRetryAction(null);
      logTelemetry(action, 'blocked', undefined, blockedReason, blockedReason);
      logUiState({
        action,
        screen: 'charts/action-bar',
        controlId: `action-${action}`,
        runId,
        cacheHit,
        missingMaster,
        dataSourceTransition,
        fallbackUsed,
        details: {
          operationPhase: 'lock',
          blocked: true,
          reasons: ['edit_lock_conflict'],
          traceId: resolvedTraceId,
          lockStatus: editLock?.lockStatus,
          editLock: editLock ?? null,
        },
      });
      logAudit(action, 'blocked', blockedReason, undefined, {
        phase: 'lock',
        details: {
          trigger: 'edit_lock',
          traceId: resolvedTraceId,
          blockedReasons: ['edit_lock_conflict'],
        },
      });
      return;
    }

    if (action === 'send' && sendPrecheckReasons.length > 0) {
      const blockedReason = sendPrecheckReasons
        .map((reason) => `${reason.summary}: ${reason.detail}`)
        .join(' / ');
      setBanner({
        tone: 'warning',
        message: `ORCA送信を停止: ${blockedReason}`,
        nextAction: '送信前チェック（理由）を確認し、必要なら受付で再取得してください。',
      });
      setRetryAction(null);
      setToast(null);
      logTelemetry(action, 'blocked', undefined, blockedReason, blockedReason);
      logUiState({
        action: 'send',
        screen: 'charts/action-bar',
        controlId: `action-${action}`,
        runId,
        cacheHit,
        missingMaster,
        dataSourceTransition,
        fallbackUsed,
        details: {
          operationPhase: 'lock',
          blocked: true,
          reasons: sendPrecheckReasons.map((reason) => reason.key),
          traceId: resolvedTraceId,
          lockStatus: editLock?.lockStatus,
        },
      });
      logAudit(action, 'blocked', blockedReason, undefined, {
        phase: 'lock',
        details: {
          trigger: 'precheck',
          traceId: resolvedTraceId,
          reasons: sendPrecheckReasons.map((reason) => reason.key),
          blockedReasons: sendPrecheckReasons.map((reason) => reason.key),
        },
      });
      return;
    }

    if (action === 'send' && !resolvedPatientId) {
      const blockedReason = '患者IDが未確定のため ORCA 送信を実行できません。Patients で患者を選択してください。';
      setBanner({ tone: 'warning', message: `ORCA送信を停止: ${blockedReason}`, nextAction: 'Patients で対象患者を選択してください。' });
      setRetryAction(null);
      setToast(null);
      logTelemetry(action, 'blocked', undefined, blockedReason, blockedReason);
      logUiState({
        action: 'send',
        screen: 'charts/action-bar',
        controlId: `action-${action}`,
        runId,
        cacheHit,
        missingMaster,
        dataSourceTransition,
        fallbackUsed,
        details: { operationPhase: 'lock', blocked: true, reasons: ['patient_not_selected'], traceId: resolvedTraceId },
      });
      logAudit(action, 'blocked', blockedReason, undefined, {
        phase: 'lock',
        details: {
          trigger: 'patient_not_selected',
          traceId: resolvedTraceId,
          blockedReasons: ['patient_not_selected'],
        },
      });
      return;
    }

    if (action === 'finish' && !resolvedPatientId) {
      const blockedReason = '患者IDが未確定のため診察終了を実行できません。Patients で患者を選択してください。';
      setBanner({ tone: 'warning', message: `診察終了を停止: ${blockedReason}`, nextAction: 'Patients で対象患者を選択してください。' });
      setRetryAction(null);
      setToast(null);
      logTelemetry(action, 'blocked', undefined, blockedReason, blockedReason);
      logUiState({
        action: 'finish',
        screen: 'charts/action-bar',
        controlId: `action-${action}`,
        runId,
        cacheHit,
        missingMaster,
        dataSourceTransition,
        fallbackUsed,
        details: { operationPhase: 'lock', blocked: true, reasons: ['patient_not_selected'], traceId: resolvedTraceId },
      });
      logAudit(action, 'blocked', blockedReason, undefined, {
        phase: 'lock',
        details: {
          trigger: 'patient_not_selected',
          traceId: resolvedTraceId,
          blockedReasons: ['patient_not_selected'],
        },
      });
      return;
    }

    if (onBeforeAction) {
      const allowAction = await Promise.resolve(onBeforeAction(action));
      if (!allowAction) {
        setRetryAction(null);
        return;
      }
    }

    if (action === 'send' && (fallbackUsed || missingMaster)) {
      setBanner({
        tone: 'warning',
        message: missingMaster
          ? 'ORCA 参照が不足しているため、送信前に再取得が必要です。'
          : '暫定データ表示中のため、送信前に最新データの再取得が必要です。',
        nextAction: MISSING_MASTER_RECOVERY_NEXT_STEPS.join(' / '),
      });
    }

    const startedAt = performance.now();
    setIsRunning(true);
    setRunningAction(action);
    setRetryAction(null);
    setToast(null);

    logUiState({
      action:
        action === 'start'
          ? 'start'
          : action === 'pause'
            ? 'pause'
            : action === 'draft'
          ? 'draft'
          : action === 'finish'
            ? 'finish'
            : action === 'cancel'
              ? 'cancel'
              : action === 'print'
                ? 'print'
                : 'send',
      screen: 'charts/action-bar',
      controlId: `action-${action}`,
      runId,
      cacheHit,
      missingMaster,
      dataSourceTransition,
      fallbackUsed,
      details: {
        operationPhase: 'do',
        patientId: resolvedPatientId,
        appointmentId: resolvedAppointmentId,
        requestId: queueEntry?.requestId,
        traceId: resolvedTraceId,
        ...buildFallbackDetails(),
      },
    });
    logTelemetry(action, 'started');
    logAudit(action, 'started', undefined, undefined, { phase: 'do' });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      const timeoutMs = resolveActionTimeoutMs(action);
      timeoutId = timeoutMs > 0 ? setTimeout(() => abortControllerRef.current?.abort(), timeoutMs) : null;

      if (action === 'send' || action === 'finish') {
        if (action === 'send') {
          const calculationDate = normalizeVisitDate(resolvedVisitDate);
          let departmentCode = resolveDepartmentCode(selectedEntry?.department);
          let physicianCode = resolvePhysicianCode(selectedEntry?.physician);
          if ((!departmentCode || !physicianCode) && resolvedPatientId && calculationDate) {
            const resolvedCodes = await fetchVisitContextCodes(resolvedPatientId, calculationDate, signal);
            departmentCode = departmentCode ?? resolvedCodes.departmentCode;
            physicianCode = physicianCode ?? resolvedCodes.physicianCode;
          }
          const missingFields = [
            !resolvedPatientId ? 'Patient_ID' : undefined,
            !calculationDate ? 'Perform_Date' : undefined,
            !departmentCode ? 'Department_Code' : undefined,
            !physicianCode ? 'Physician_Code' : undefined,
          ].filter((field): field is string => Boolean(field));
          if (missingFields.length > 0) {
            const blockedReason = `medicalmodv2 を停止: ${missingFields.join(', ')} が不足しています。`;
            setBanner({
              tone: 'warning',
              message: `ORCA送信を停止: ${blockedReason}`,
              nextAction: '受付で患者/診療科/日付を確認してください。',
            });
            setIsRunning(false);
            setRunningAction(null);
            return;
          }

          if (!resolvedPatientId || !calculationDate || !departmentCode || !physicianCode) {
            setIsRunning(false);
            setRunningAction(null);
            return;
          }

          const { actor } = resolveAuditActor();
          onApprovalConfirmed?.({ action: 'send', actor });

          const orderBundleResult = await fetchMedicalModV2OrderBundles(resolvedPatientId, calculationDate, encounterId);
          if (orderBundleResult.errors.length > 0) {
            const failedEntitiesPreview = orderBundleResult.errors.slice(0, 6).join(' / ');
            const remaining = orderBundleResult.errors.length - 6;
            setBanner({
              tone: 'warning',
              message: `ORCA送信を停止: オーダー取得失敗（${failedEntitiesPreview}${remaining > 0 ? ` / 他${remaining}件` : ''}）`,
              nextAction: '取得失敗したentityの通信状態とORCA連携設定を確認してください。',
            });
            setIsRunning(false);
            setRunningAction(null);
            return;
          }
          const preparedSendData = prepareMedicalModV2SendData(orderBundleResult.bundles);
          if (preparedSendData.requiredIssues.length > 0) {
            const eventId = buildOrderHubEventId();
            recordOrderHubKpi(
              {
                runId,
                cacheHit,
                missingMaster,
                fallbackUsed,
                dataSourceTransition,
                patientId: resolvedPatientId,
                appointmentId: resolvedAppointmentId,
              },
              {
                category: 'OUI-04',
                source: 'system',
                result: 'blocked',
                eventId,
                reason: 'rp_required_missing',
                details: {
                  issueCount: preparedSendData.requiredIssues.length,
                  issues: preparedSendData.requiredIssues.slice(0, 8).map((issue) => ({
                    entity: issue.entity,
                    bundleName: issue.bundleName ?? null,
                    documentId: issue.documentId ?? null,
                    moduleId: issue.moduleId ?? null,
                    missing: issue.missing,
                  })),
                },
              },
            );
          }
          if (preparedSendData.codeIssues.length > 0) {
            const eventId = buildOrderHubEventId();
            recordOrderHubKpi(
              {
                runId,
                cacheHit,
                missingMaster,
                fallbackUsed,
                dataSourceTransition,
                patientId: resolvedPatientId,
                appointmentId: resolvedAppointmentId,
              },
              {
                category: 'OUI-04',
                source: 'system',
                result: 'blocked',
                eventId,
                reason: 'code_missing',
                details: {
                  issueCount: preparedSendData.codeIssues.length,
                  issues: preparedSendData.codeIssues.slice(0, 8).map((issue) => ({
                    entity: issue.entity ?? null,
                    bundleName: issue.bundleName ?? null,
                    documentId: issue.documentId ?? null,
                    moduleId: issue.moduleId ?? null,
                    mixedRows: issue.mixedRows,
                    missingCodeItemIndexes: issue.missingCodeItemIndexes,
                  })),
                },
              },
            );
          }
          if (preparedSendData.bundleIssues.length > 0) {
            const eventId = buildOrderHubEventId();
            recordOrderHubKpi(
              {
                runId,
                cacheHit,
                missingMaster,
                fallbackUsed,
                dataSourceTransition,
                patientId: resolvedPatientId,
                appointmentId: resolvedAppointmentId,
              },
              {
                category: 'OUI-04',
                source: 'system',
                result: 'blocked',
                eventId,
                reason: 'bundle_unsupported',
                details: {
                  issueCount: preparedSendData.bundleIssues.length,
                  issues: preparedSendData.bundleIssues.slice(0, 8).map((issue) => ({
                    code: issue.code,
                    entity: issue.entity ?? null,
                    bundleName: issue.bundleName ?? null,
                    documentId: issue.documentId ?? null,
                    moduleId: issue.moduleId ?? null,
                    detail: issue.detail,
                  })),
                },
              },
            );
          }
          const blockNotice = buildMedicalModV2BlockNotice(preparedSendData);
          if (blockNotice) {
            setBanner({
              tone: 'warning',
              message: blockNotice.message,
              nextAction: blockNotice.nextAction,
            });
            setIsRunning(false);
            setRunningAction(null);
            return;
          }

          const requestXml = buildMedicalModV2RequestXml({
            patientId: resolvedPatientId,
            performDate: calculationDate,
            departmentCode,
            physicianCode,
            medicalInformation: preparedSendData.medicalInformation,
          });
          const result = await postOrcaMedicalModV2Xml(requestXml, { classCode: '01', signal });
          const idempotentDuplicate = isIdempotentDuplicate(result.apiResult, result.apiResultMessage);
          const transportOk = result.ok;
          const apiOk = (result.apiOk ?? isApiResultOk(result.apiResult)) || idempotentDuplicate;
          const hasMissingTags = Boolean(result.missingTags?.length);
          const allowMissingTags = idempotentDuplicate;
          const outcome = transportOk && apiOk && (!hasMissingTags || allowMissingTags) ? 'success' : transportOk ? 'warning' : 'error';
          const durationMs = Math.round(performance.now() - startedAt);
          const nextRunId = result.runId ?? getObservabilityMeta().runId ?? runId;
          const nextTraceId = result.traceId ?? getObservabilityMeta().traceId ?? resolvedTraceId;
          const detailParts = [
            `runId=${nextRunId}`,
            `traceId=${nextTraceId ?? 'unknown'}`,
            result.apiResult ? `Api_Result=${result.apiResult}` : undefined,
            result.apiResultMessage ? `Api_Result_Message=${result.apiResultMessage}` : undefined,
            result.invoiceNumber ? `Invoice_Number=${result.invoiceNumber}` : undefined,
            result.dataId ? `Data_Id=${result.dataId}` : undefined,
          ].filter((part): part is string => Boolean(part));

          const mappedWarnings: OrcaMedicalWarningUi[] = (result.medicalWarnings ?? []).map((warning) => {
            const groupPosition = warning.medicalWarningPosition;
            const itemPosition = warning.medicalWarningItemPosition;
            const groupIndex = typeof groupPosition === 'number' ? groupPosition - 1 : undefined;
            const groupSource =
              typeof groupIndex === 'number' && groupIndex >= 0 && groupIndex < preparedSendData.medicalInformationSources.length
                ? preparedSendData.medicalInformationSources[groupIndex]
                : undefined;
            const rowIndex = typeof itemPosition === 'number' ? itemPosition - 1 : undefined;
            const rowSource =
              groupSource && typeof rowIndex === 'number' && rowIndex >= 0 && rowIndex < groupSource.rows.length
                ? groupSource.rows[rowIndex]
                : undefined;
            return {
              medicalWarning: warning.medicalWarning,
              message: warning.medicalWarningMessage,
              code: warning.medicalWarningCode,
              groupPosition,
              itemPosition,
              entity: groupSource?.entity,
              documentId: groupSource?.documentId,
              moduleId: groupSource?.moduleId,
              bundleName: groupSource?.bundleName,
              medicalClass: groupSource?.medicalClass,
              medicationCode: rowSource?.medication.code,
              medicationName: rowSource?.medication.name,
              sourceKind: rowSource?.source.kind,
              sourceItemIndex: rowSource?.source.kind === 'bundle_item' ? rowSource.source.itemIndex : undefined,
              sourceSectionIndex: rowSource?.source.kind === 'bundle_item' ? rowSource.source.sectionIndex : undefined,
              sourceRowRole: rowSource?.source.kind === 'bundle_item' ? rowSource.source.rowRole : undefined,
              sourceRowSubtype: rowSource?.source.kind === 'bundle_item' ? rowSource.source.rowSubtype : undefined,
            };
          });

          let retryMeta:
            | { retryRequested?: boolean; retryApplied?: boolean; retryReason?: string; queueRunId?: string; queueTraceId?: string }
            | undefined;
          if (outcome === 'success') {
            setBanner(null);
            setToast({
              tone: 'success',
              message: 'ORCA送信を完了',
              detail: buildActionSuccessDetail('send'),
            });
          } else {
            if (resolvedPatientId && canRetryOrcaQueue) {
              try {
                const retryResponse = await retryOrcaQueue(resolvedPatientId, { enabled: canRetryOrcaQueue });
                retryMeta = {
                  retryRequested: retryResponse.retryRequested,
                  retryApplied: retryResponse.retryApplied,
                  retryReason: retryResponse.retryReason,
                  queueRunId: retryResponse.runId,
                  queueTraceId: retryResponse.traceId,
                };
              } catch {
                retryMeta = { retryRequested: true, retryApplied: false, retryReason: 'retry_request_failed' };
              }
            }
            setBanner({
              tone: outcome === 'error' ? 'error' : 'warning',
              message: outcome === 'error' ? 'ORCA送信に失敗しました。' : 'ORCA送信に警告があります。',
              nextAction: 'ORCA 応答を確認し再送してください。',
            });
            setToast({
              tone: outcome === 'error' ? 'error' : 'warning',
              message: outcome === 'error' ? 'ORCA送信に失敗' : 'ORCA送信に警告',
              detail: outcome === 'error' ? CHARTS_SUPPORT_GUIDE : 'ORCA 応答を確認し、必要なら再送してください。',
            });
          }

          logTelemetry(
            action,
            outcome === 'success' ? 'success' : 'error',
            durationMs,
            detailParts.join(' / '),
            result.apiResult,
            { runId: nextRunId, traceId: nextTraceId ?? undefined },
          );
          logAudit(action, outcome === 'success' ? 'success' : 'error', detailParts.join(' / '), durationMs, {
            phase: 'do',
            details: {
              endpoint: '/api/orca/chart-support/medical-mod-v2',
              httpStatus: result.status,
              apiResult: result.apiResult,
              apiResultMessage: result.apiResultMessage,
              departmentCode,
              physicianCode,
              invoiceNumber: result.invoiceNumber,
              dataId: result.dataId,
              transportOk,
              apiOk,
              missingTags: result.missingTags,
              medicalWarnings: mappedWarnings.length > 0 ? mappedWarnings.length : undefined,
              retryQueue: retryMeta,
              orderBundles: {
                entities: ORCA_SEND_ORDER_ENTITIES.length,
                bundles: orderBundleResult.bundles.length,
                medicalInformation: preparedSendData.medicalInformation.length,
                fetchErrors: orderBundleResult.errors.length > 0 ? orderBundleResult.errors : undefined,
              },
            },
          });

          if (resolvedPatientId) {
            saveOrcaClaimSendCache(
              {
                patientId: resolvedPatientId,
                appointmentId: resolvedAppointmentId,
                performDate: calculationDate,
                invoiceNumber: result.invoiceNumber,
                dataId: result.dataId,
                runId: nextRunId,
                traceId: nextTraceId ?? undefined,
                apiResult: result.apiResult,
                sendStatus: outcome === 'success' ? 'success' : 'error',
                errorMessage: outcome === 'success' ? undefined : detailParts.join(' / '),
                medicalWarnings: mappedWarnings,
              },
              storageScope,
            );
          }

          // medicalmodv23 を後続で実行（診療終了相当）。結果は参考情報として扱う。
          const v23RequestXml = buildMedicalModV23RequestXml({
            patientId: resolvedPatientId ?? '',
            requestNumber: '01',
            firstCalculationDate: calculationDate,
            lastVisitDate: calculationDate,
            departmentCode,
          });
          try {
            await postOrcaMedicalModV23Xml(v23RequestXml, { signal });
          } catch {
            // v23 失敗は警告のみ（既存ロジックで捕捉済み）。ここでは握りつぶす。
          }

          void Promise.resolve(onAfterSend?.()).catch((error) => {
            const detail = error instanceof Error ? error.message : String(error);
            logUiState({
              action: 'send',
              screen: 'charts/action-bar',
              controlId: 'action-send',
              runId,
              cacheHit,
              missingMaster,
              dataSourceTransition,
              fallbackUsed,
              details: { operationPhase: 'after_send', error: detail },
            });
          });
          return;
        } else {
          const after = getObservabilityMeta();
          const nextTraceId = after.traceId ?? resolvedTraceId;
          setBanner(null);
          setToast({
            tone: 'success',
            message: `${ACTION_LABEL[action]}を完了`,
            detail: buildActionSuccessDetail(action),
          });

          const durationMs = Math.round(performance.now() - startedAt);
          logTelemetry(action, 'success', durationMs);
          logAudit(action, 'success', undefined, durationMs, {
            phase: 'do',
            details: {
              completionMode: 'local_finish',
              postFinishAction: 'medicalmodv23',
              traceId: nextTraceId,
            },
          });

          const departmentCode = resolveDepartmentCode(selectedEntry?.department);
          const calculationDate = normalizeVisitDate(resolvedVisitDate);
          const missingFields = [
            !resolvedPatientId ? 'Patient_ID' : undefined,
            !calculationDate ? 'First_Calculation_Date' : undefined,
            !calculationDate ? 'LastVisit_Date' : undefined,
            !departmentCode ? 'Department_Code' : undefined,
          ].filter((field): field is string => typeof field === 'string');

          if (missingFields.length > 0) {
            const blockedReason = `medicalmodv23 をスキップ: ${missingFields.join(', ')} が不足しています。`;
            setBanner({
              tone: 'warning',
              message: `診療終了後の追加更新を停止: ${blockedReason}`,
              nextAction: '受付情報（患者/診療科/日付）を確認してください。',
            });
            logUiState({
              action: 'medicalmodv23',
              screen: 'charts/action-bar',
              controlId: 'action-finish',
              runId,
              cacheHit,
              missingMaster,
              dataSourceTransition,
              fallbackUsed,
              details: {
                operationPhase: 'lock',
                blocked: true,
                missingFields,
                patientId: resolvedPatientId,
                appointmentId: resolvedAppointmentId,
                traceId: resolvedTraceId,
              },
            });
            recordChartsAuditEvent({
              action: 'ORCA_MEDICAL_MOD_V23',
              outcome: 'blocked',
              subject: 'medicalmodv23',
              note: blockedReason,
              patientId: resolvedPatientId,
              appointmentId: resolvedAppointmentId,
              runId,
              cacheHit,
              missingMaster,
              fallbackUsed,
              dataSourceTransition,
              details: {
                operationPhase: 'lock',
                trigger: 'missing_fields',
                missingFields,
                endpoint: '/api/orca/chart-support/medical-mod-v23',
              },
            });
          } else {
            const requestXml = buildMedicalModV23RequestXml({
              patientId: resolvedPatientId ?? '',
              requestNumber: '01',
              firstCalculationDate: calculationDate,
              lastVisitDate: calculationDate,
              departmentCode,
            });
            try {
              const result = await postOrcaMedicalModV23Xml(requestXml, { signal });
              const transportOk = result.ok;
              const apiOk = result.apiOk ?? isApiResultOk(result.apiResult);
              const hasMissingTags = Boolean(result.missingTags?.length);
              const outcome = transportOk && apiOk && !hasMissingTags ? 'success' : transportOk ? 'warning' : 'error';
              const bannerDetail = [
                `Api_Result=${result.apiResult ?? '—'}`,
                result.apiResultMessage ? `Message=${result.apiResultMessage}` : undefined,
                hasMissingTags ? `missingTags=${result.missingTags?.join(', ')}` : undefined,
              ].filter((part): part is string => typeof part === 'string' && part.length > 0);

              if (outcome !== 'success') {
                setBanner({
                  tone: outcome === 'error' ? 'error' : 'warning',
                  message: `診療終了後の追加更新(${outcome}) / ${bannerDetail.join(' / ')}`,
                  nextAction: 'ORCA 応答を確認し、必要なら再送してください。',
                });
              }

              logUiState({
                action: 'medicalmodv23',
                screen: 'charts/action-bar',
                controlId: 'action-finish',
                runId: result.runId ?? runId,
                cacheHit,
                missingMaster,
                dataSourceTransition,
                fallbackUsed,
                details: {
                  operationPhase: 'do',
                  patientId: resolvedPatientId,
                  appointmentId: resolvedAppointmentId,
                  traceId: result.traceId ?? resolvedTraceId,
                  endpoint: '/api/orca/chart-support/medical-mod-v23',
                  httpStatus: result.status,
                  apiResult: result.apiResult,
                  apiResultMessage: result.apiResultMessage,
                  transportOk,
                  apiOk,
                  missingTags: result.missingTags,
                },
              });

              recordChartsAuditEvent({
                action: 'ORCA_MEDICAL_MOD_V23',
                outcome,
                subject: 'medicalmodv23',
                patientId: resolvedPatientId,
                appointmentId: resolvedAppointmentId,
                runId: result.runId ?? runId,
                cacheHit,
                missingMaster,
                fallbackUsed,
                dataSourceTransition,
                details: {
                  operationPhase: 'do',
                  endpoint: '/api/orca/chart-support/medical-mod-v23',
                  httpStatus: result.status,
                  apiResult: result.apiResult,
                  apiResultMessage: result.apiResultMessage,
                  transportOk,
                  apiOk,
                  missingTags: result.missingTags,
                },
              });
            } catch (error) {
              const detail = error instanceof Error ? error.message : String(error);
              setBanner({
                tone: 'error',
                message: `診療終了後の追加更新に失敗: ${detail}`,
                nextAction: 'ORCA 接続と診療科情報を確認してください。',
              });
              logUiState({
                action: 'medicalmodv23',
                screen: 'charts/action-bar',
                controlId: 'action-finish',
                runId,
                cacheHit,
                missingMaster,
                dataSourceTransition,
                fallbackUsed,
                details: {
                  operationPhase: 'do',
                  patientId: resolvedPatientId,
                  appointmentId: resolvedAppointmentId,
                  traceId: resolvedTraceId,
                  endpoint: '/api/orca/chart-support/medical-mod-v23',
                  error: detail,
                },
              });
              recordChartsAuditEvent({
                action: 'ORCA_MEDICAL_MOD_V23',
                outcome: 'error',
                subject: 'medicalmodv23',
                note: detail,
                error: detail,
                patientId: resolvedPatientId,
                appointmentId: resolvedAppointmentId,
                runId,
                cacheHit,
                missingMaster,
                fallbackUsed,
                dataSourceTransition,
                details: {
                  operationPhase: 'do',
                  endpoint: '/api/orca/chart-support/medical-mod-v23',
                  error: detail,
                },
              });
            }
          }
        }

        const finishMeta = await Promise.resolve(onAfterFinish?.());
        if (finishMeta) {
          const nextTraceId = finishMeta.traceId ?? getObservabilityMeta().traceId ?? resolvedTraceId;
          logUiState({
            action: 'finish',
            screen: 'charts/action-bar',
            controlId: 'action-finish',
            runId: finishMeta.runId ?? runId,
            cacheHit,
            missingMaster,
            dataSourceTransition,
            fallbackUsed,
            details: {
              operationPhase: 'after_finish',
              requestId: finishMeta.requestId,
              traceId: nextTraceId,
              detail: finishMeta.detail,
            },
          });
        }
        return;
      } else if (action === 'start') {
        const startMeta = await Promise.resolve(onAfterStart?.());
        const nextTraceId = startMeta?.traceId ?? getObservabilityMeta().traceId ?? resolvedTraceId;
        logUiState({
          action: 'start',
          screen: 'charts/action-bar',
          controlId: 'action-start',
          runId: startMeta?.runId ?? runId,
          cacheHit,
          missingMaster,
          dataSourceTransition,
          fallbackUsed,
          details: {
            operationPhase: 'after_start',
            requestId: startMeta?.requestId,
            traceId: nextTraceId,
            encounterKey: startMeta?.encounterKey,
            idempotencyKey: startMeta?.idempotencyKey,
            detail: startMeta?.detail,
          },
        });
        const durationMs = Math.round(performance.now() - startedAt);
        const after = getObservabilityMeta();
        const nextRunId = startMeta?.runId ?? after.runId ?? runId;
        setBanner(null);
        setToast({
          tone: 'success',
          message: `${ACTION_LABEL[action]}を完了`,
          detail: buildActionSuccessDetail(action),
        });
        logTelemetry(action, 'success', durationMs, startMeta?.detail, undefined, { runId: nextRunId, traceId: nextTraceId });
        logAudit(action, 'success', undefined, durationMs, {
          phase: 'do',
          details: {
            requestId: startMeta?.requestId,
            traceId: nextTraceId,
            encounterKey: startMeta?.encounterKey,
            idempotencyKey: startMeta?.idempotencyKey,
          },
        });
        return;
      } else if (action === 'pause') {
        const pauseMeta = await Promise.resolve(onAfterPause?.());
        const nextTraceId = pauseMeta?.traceId ?? getObservabilityMeta().traceId ?? resolvedTraceId;
        logUiState({
          action: 'pause',
          screen: 'charts/action-bar',
          controlId: 'action-pause',
          runId: pauseMeta?.runId ?? runId,
          cacheHit,
          missingMaster,
          dataSourceTransition,
          fallbackUsed,
          details: {
            operationPhase: 'after_pause',
            requestId: pauseMeta?.requestId,
            traceId: nextTraceId,
            detail: pauseMeta?.detail,
          },
        });
      } else if (action === 'draft') {
        // 下書き保存は既存の保存経路に委ね、ここでは送信前ガード後の完了通知だけを扱う。
        onDraftSaved?.();
      } else {
        // cancel は現状デモ（監査・テレメトリの記録）として扱う。
      }

      const durationMs = Math.round(performance.now() - startedAt);
      setBanner(null);
      setToast({
        tone: 'success',
        message: `${ACTION_LABEL[action]}を完了`,
        detail: buildActionSuccessDetail(action),
      });
      logTelemetry(action, 'success', durationMs);
      logAudit(action, 'success', undefined, durationMs, { phase: 'do' });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const isAbort =
        error instanceof DOMException
          ? error.name === 'AbortError'
          : error instanceof Error
            ? error.name === 'AbortError'
            : false;
      const apiDetails =
        error && typeof error === 'object' && 'apiDetails' in error
          ? ((error as { apiDetails?: Record<string, unknown> }).apiDetails ?? undefined)
          : undefined;
      const durationMs = Math.round(performance.now() - startedAt);
      const after = getObservabilityMeta();
      const errorRunId = (typeof apiDetails?.runId === 'string' ? (apiDetails?.runId as string) : undefined) ?? after.runId ?? runId;
      const errorTraceId =
        (typeof apiDetails?.traceId === 'string' ? (apiDetails?.traceId as string) : undefined) ??
        after.traceId ??
        resolvedTraceId;
      const errorRequestId =
        (typeof apiDetails?.requestId === 'string' ? (apiDetails?.requestId as string) : undefined) ??
        queueEntry?.requestId;
      const errorEndpoint = typeof apiDetails?.endpoint === 'string' ? (apiDetails?.endpoint as string) : undefined;
      const errorHttpStatus = typeof apiDetails?.httpStatus === 'number' ? (apiDetails?.httpStatus as number) : undefined;
      const errorOutcome = typeof apiDetails?.outcome === 'string' ? (apiDetails?.outcome as string) : undefined;
      const errorApiResult = typeof apiDetails?.apiResult === 'string' ? (apiDetails?.apiResult as string) : undefined;
      const errorApiResultMessage =
        typeof apiDetails?.apiResultMessage === 'string' ? (apiDetails?.apiResultMessage as string) : undefined;

      if (isAbort) {
        const abortedDetail = 'ユーザー操作により送信を中断しました。通信回復後に再試行できます。';
        setRetryAction('send');
        setBanner({ tone: 'warning', message: `ORCA送信を中断: ${abortedDetail}`, nextAction: '通信回復後にリトライできます。' });
        if (action === 'send') {
          setToast({ tone: 'warning', message: 'ORCA送信を中断', detail: abortedDetail });
        } else {
          setToast({ tone: 'warning', message: `${ACTION_LABEL[action]}を中断`, detail: abortedDetail });
        }
        logTelemetry(action, 'blocked', durationMs, abortedDetail, abortedDetail);
        logAudit(action, 'blocked', abortedDetail, durationMs, {
          phase: 'lock',
          details: {
            trigger: 'abort',
            traceId: errorTraceId,
            endpoint: errorEndpoint,
            httpStatus: errorHttpStatus,
          },
        });
      } else {
        const nextSteps = (() => {
          if (/HTTP 401|HTTP 403|権限不足/.test(detail)) {
            return '次にやること: 再ログイン / 設定確認（facilityId/userId/password）';
          }
          if (isNetworkError(error) || isNetworkError(detail)) {
            return '次にやること: 通信回復を待つ / 受付で再取得 / リトライ';
          }
          return claimEnabled
            ? '次にやること: 受付へ戻る / 請求を再取得 / 設定確認'
            : '次にやること: 受付へ戻る / 受付データを再取得 / 設定確認';
        })();
        let retryDetail: string | undefined;
        let retryMeta: { retryRequested?: boolean; retryApplied?: boolean; retryReason?: string; queueRunId?: string; queueTraceId?: string } =
          {};
        if (action === 'send' && resolvedPatientId && canRetryOrcaQueue) {
          try {
            const retryResponse = await retryOrcaQueue(resolvedPatientId, { enabled: canRetryOrcaQueue });
            const retryApplied = retryResponse.retryApplied === true;
            const retryReason = retryResponse.retryReason;
            const queueRunId = retryResponse.runId;
            const queueTraceId = retryResponse.traceId;
            retryMeta = {
              retryRequested: retryResponse.retryRequested,
              retryApplied,
              retryReason,
              queueRunId,
              queueTraceId,
            };
            retryDetail = `retryQueue=${retryApplied ? 'applied' : 'requested'}${retryReason ? `(${retryReason})` : ''}`;
          } catch {
            retryMeta = { retryRequested: true, retryApplied: false, retryReason: 'retry_request_failed' };
            retryDetail = 'retryQueue=error';
          }
        }
        const extraTags = [
          `runId=${errorRunId}`,
          `traceId=${errorTraceId ?? 'unknown'}`,
          errorRequestId ? `requestId=${errorRequestId}` : undefined,
          errorEndpoint ? `endpoint=${errorEndpoint}` : undefined,
          typeof errorHttpStatus === 'number' ? `HTTP ${errorHttpStatus}` : undefined,
          errorApiResult ? `apiResult=${errorApiResult}` : undefined,
          errorApiResultMessage ? `message=${errorApiResultMessage}` : undefined,
          errorOutcome ? `outcome=${errorOutcome}` : undefined,
          retryDetail,
        ].filter((part): part is string => typeof part === 'string');
        const composedDetail = `${detail}（${extraTags.join(' / ')}）${nextSteps ? ` / ${nextSteps}` : ''}`;
        const safeSupportDetail = [
          `runId=${errorRunId}`,
          `traceId=${errorTraceId ?? 'unknown'}`,
        ].join(' / ');
        const userSafeFailure = resolveUserSafeOperationFailure(detail);
        if (action === 'send' && resolvedPatientId) {
          saveOrcaClaimSendCache(
            {
              patientId: resolvedPatientId,
              appointmentId: resolvedAppointmentId,
              performDate: normalizeVisitDate(resolvedVisitDate) ?? undefined,
              runId: errorRunId,
              traceId: errorTraceId ?? undefined,
              apiResult: errorApiResult,
              sendStatus: 'error',
              errorMessage: detail,
              medicalWarnings: [],
            },
            storageScope,
          );
        }
        setRetryAction(action);
        setBanner({
          tone: 'error',
          message: `${ACTION_LABEL[action]}に失敗しました。${userSafeFailure}`,
          nextAction: nextSteps,
        });
        setToast({
          tone: 'error',
          message: action === 'send' ? 'ORCA送信に失敗' : `${ACTION_LABEL[action]}に失敗`,
          detail: safeSupportDetail,
        });
        logTelemetry(action, 'error', durationMs, composedDetail, composedDetail, { runId: errorRunId, traceId: errorTraceId });
        logAudit(action, 'error', composedDetail, durationMs, {
          phase: 'do',
          details: {
            traceId: errorTraceId,
            endpoint: errorEndpoint,
            httpStatus: errorHttpStatus,
            requestId: errorRequestId,
            apiResult: errorApiResult,
            apiResultMessage: errorApiResultMessage,
            outcome: errorOutcome,
            retryQueue: retryMeta,
          },
        });
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setIsRunning(false);
      setRunningAction(null);
    }
  };

  useImperativeHandle(ref, () => ({
    start: () => handleAction('start'),
    pause: () => handleAction('pause'),
    finish: () => handleAction('finish'),
  }));

  const handlePrintExport = () => {
    if (printPrecheckReasons.length > 0) {
      const head = printPrecheckReasons[0];
      const blockedReasons = printPrecheckReasons.map((reason) => reason.key);
      const nextAction = head.next.join(' / ');
      setBanner({ tone: 'warning', message: `印刷/エクスポートを停止: ${head.summary}`, nextAction });
      setToast(null);
      logUiState({
        action: 'print',
        screen: 'charts/action-bar',
        controlId: 'action-print',
        runId,
        cacheHit,
        missingMaster,
        dataSourceTransition,
        fallbackUsed,
        details: {
          operationPhase: 'lock',
          blocked: true,
          blockedReasons,
          ...buildFallbackDetails(),
        },
      });
      logAudit('print', 'blocked', head.detail, undefined, {
        phase: 'lock',
        details: {
          trigger: blockedReasons[0],
          blockedReasons,
        },
      });
      return;
    }

    if (!selectedEntry) {
      const message = '患者未選択のため印刷/エクスポートを停止しました';
      setBanner({ tone: 'warning', message, nextAction: '患者を選択' });
      setToast({ tone: 'warning', message: '患者未選択', detail: message });
      logUiState({
        action: 'print',
        screen: 'charts/action-bar',
        controlId: 'action-print',
        runId,
        cacheHit,
        missingMaster,
        dataSourceTransition,
        fallbackUsed,
        details: {
          operationPhase: 'lock',
          blocked: true,
          blockedReasons: ['no-selection'],
          ...buildFallbackDetails(),
        },
      });
      logAudit('print', 'blocked', message, undefined, {
        phase: 'lock',
        details: { trigger: 'no-selection', blockedReasons: ['no-selection'] },
      });
      return;
    }

    const { actor, facilityId } = resolveAuditActor();

    const detail = `印刷プレビューを開きました。実行者は監査ログに記録しました。`;
    setBanner(null);
    setToast({ tone: 'success', message: '印刷/エクスポートを開きました', detail });

    recordChartsAuditEvent({
      action: 'PRINT_OUTPATIENT',
      outcome: 'started',
      subject: 'outpatient-document-preview',
      note: detail,
      actor,
      patientId: selectedEntry.patientId ?? selectedEntry.id,
      appointmentId: selectedEntry.appointmentId,
      runId,
      cacheHit,
      missingMaster,
      fallbackUsed,
      dataSourceTransition,
      details: {
        operationPhase: 'do',
        endpoint: '/charts/print/outpatient',
        httpStatus: 200,
      },
    });

    const printPath = buildPrintUrl({
      facilityId: session?.facilityId,
      kind: 'outpatient',
      from: 'charts',
      external: appNav.external,
    });
    logUiState({
      action: 'print',
      screen: 'charts/action-bar',
      controlId: 'action-print',
      runId,
      cacheHit,
      missingMaster,
      dataSourceTransition,
      fallbackUsed,
      details: {
        operationPhase: 'do',
        destination: printPath,
        patientId: selectedEntry.patientId ?? selectedEntry.id,
        appointmentId: selectedEntry.appointmentId,
      },
    });

    const navState = {
      entry: selectedEntry,
      meta: { runId, cacheHit, missingMaster, fallbackUsed, dataSourceTransition },
      actor,
      facilityId,
      from: 'charts',
      returnTo: appNav.currentUrl,
    };
    appNav.openPrintOutpatient({ state: navState });
    saveOutpatientPrintPreview(navState, { facilityId: session?.facilityId, userId: session?.userId });
  };

  const openPrintDialog = () => {
    setPrintDialogOpen(true);
    approvalSessionRef.current = { action: 'print', closed: false };
    logApproval('print', 'open');
  };

  const handleReportPrint = async () => {
    if (printPrecheckReasons.length > 0) {
      const head = printPrecheckReasons[0];
      const blockedReasons = printPrecheckReasons.map((reason) => reason.key);
      const nextAction = head.next.join(' / ');
      setBanner({ tone: 'warning', message: `帳票出力を停止: ${head.summary}`, nextAction });
      setToast(null);
      recordChartsAuditEvent({
        action: 'ORCA_REPORT_PRINT',
        outcome: 'blocked',
        subject: 'orca-report-preview',
        note: head.detail,
        patientId: resolvedPatientId,
        appointmentId: resolvedAppointmentId,
        runId,
        cacheHit,
        missingMaster,
        fallbackUsed,
        dataSourceTransition,
        details: {
          operationPhase: 'lock',
          blockedReasons,
          reportType: resolvedReportType,
        },
      });
      return;
    }

    if (!resolvedPatientId) {
      const message = '患者IDが未確定のため帳票出力を開始できません。';
      setBanner({ tone: 'warning', message, nextAction: 'Patients で患者を選択してください。' });
      setToast({ tone: 'warning', message: '患者未選択', detail: message });
      recordChartsAuditEvent({
        action: 'ORCA_REPORT_PRINT',
        outcome: 'blocked',
        subject: 'orca-report-preview',
        note: message,
        runId,
        cacheHit,
        missingMaster,
        fallbackUsed,
        dataSourceTransition,
        details: {
          operationPhase: 'lock',
          blockedReasons: ['patient_not_selected'],
          reportType: resolvedReportType,
        },
      });
      return;
    }

    if (!reportReady) {
      const message = reportFieldErrors.join(' / ') || '帳票出力条件が不足しています。';
      setBanner({ tone: 'warning', message: `帳票出力を停止: ${message}`, nextAction: '入力内容を確認してください。' });
      setToast({ tone: 'warning', message: '帳票出力を停止', detail: message });
      recordChartsAuditEvent({
        action: 'ORCA_REPORT_PRINT',
        outcome: 'blocked',
        subject: 'orca-report-preview',
        note: message,
        patientId: resolvedPatientId,
        appointmentId: resolvedAppointmentId,
        runId,
        cacheHit,
        missingMaster,
        fallbackUsed,
        dataSourceTransition,
        details: {
          operationPhase: 'lock',
          blockedReasons: reportFieldErrors,
          reportType: resolvedReportType,
          invoiceNumber: reportForm.invoiceNumber || undefined,
          departmentCode: reportForm.departmentCode || undefined,
          insuranceCombinationNumber: reportForm.insuranceCombinationNumber || undefined,
          performMonth: reportForm.performMonth || undefined,
        },
      });
      return;
    }

    setIsRunning(true);
    setRunningAction('print');
    setRetryAction(null);
    setToast(null);
    setBanner(null);

    try {
      const result = await requestReportPreview();
      if (!result.ok) {
        throw new Error(result.error);
      }
      const previewState = result.previewState;
      const navState = { ...previewState, from: 'charts', returnTo: appNav.currentUrl };
      appNav.openPrintDocument({ state: navState as Record<string, unknown> });
      saveReportPrintPreview(previewState, { facilityId: session?.facilityId, userId: session?.userId });
      setToast({
        tone: 'success',
        message: '帳票プレビューを開きました',
        detail: buildActionSuccessDetail('print'),
      });
    } catch {
      const nextAction =
        resolvedReportType === 'prescription'
          ? '代替: 診療記録（外来サマリ）をローカル印刷で出力してください。'
          : 'ORCA 応答を確認し、再試行してください。';
      setBanner({ tone: 'error', message: '帳票出力に失敗しました。', nextAction });
      setToast({ tone: 'error', message: '帳票出力に失敗', detail: CHARTS_SUPPORT_GUIDE });
    } finally {
      setIsRunning(false);
      setRunningAction(null);
    }
  };

  const handleUnlock = () => {
    setLockReason(null);
    setBanner({ tone: 'info', message: 'UIロックを解除しました。次のアクションを実行できます。' });
    setToast(null);
    logUiState({
      action: 'lock',
      screen: 'charts/action-bar',
      controlId: 'unlock',
      runId,
      cacheHit,
      missingMaster,
      dataSourceTransition,
      fallbackUsed,
      details: { operationPhase: 'lock', unlocked: true },
    });
    recordChartsAuditEvent({
      action: 'CHARTS_EDIT_LOCK',
      outcome: 'released',
      subject: 'charts-ui-lock',
      patientId: resolvedPatientId,
      appointmentId: resolvedAppointmentId,
      runId,
      cacheHit,
      missingMaster,
      fallbackUsed,
      dataSourceTransition,
      details: {
        operationPhase: 'lock',
        trigger: 'ui_unlock',
        lockStatus: 'ui',
      },
    });
  };

  const handleAbort = () => {
    if (!isRunning) return;
    if (runningAction !== 'send') return;
    abortControllerRef.current?.abort();
  };

  const handleApprovalUnlock = () => {
    if (!approvalLocked || !onApprovalUnlock) return;
    setApprovalUnlockDialogStep('confirm');
  };

  const handleReloadLatest = async () => {
    setToast({
      tone: 'info',
      message: '最新を再読込',
      detail: '最新データを再取得します（取得完了後に編集可否が更新されます）。',
    });
    recordChartsAuditEvent({
      action: 'CHARTS_CONFLICT',
      outcome: 'resolved',
      subject: 'charts-tab-lock',
      patientId: resolvedPatientId,
      appointmentId: resolvedAppointmentId,
      runId,
      cacheHit,
      missingMaster,
      fallbackUsed,
      dataSourceTransition,
      details: {
        operationPhase: 'lock',
        trigger: 'tab',
        resolution: 'reload',
        lockStatus: editLock?.lockStatus,
      },
    });
    logUiState({
      action: 'lock',
      screen: 'charts/action-bar',
      controlId: 'reload-latest',
      runId,
      cacheHit,
      missingMaster,
      dataSourceTransition,
      fallbackUsed,
      details: {
        operationPhase: 'lock',
        trigger: 'tab',
        resolution: 'reload',
        lockStatus: editLock?.lockStatus,
      },
    });
    await onReloadLatest?.();
  };

  const handleDiscard = () => {
    onDiscardChanges?.();
    setToast({
      tone: 'info',
      message: '変更を破棄しました',
      detail: 'ローカルの未保存状態を破棄し、閲覧専用状態の解除を待てます。',
    });
  };

  const handleForceTakeover = () => {
    if (!onForceTakeover) return;
    setForceTakeoverDialogStep('confirm');
  };

  const showDraftAction = !embedded;
  const draftSaveButton = !showDraftAction
    ? null
    : (
        <button
          type="button"
          id="charts-action-draft"
          className={`charts-actions__button charts-actions__button--draft${
            compactHeader && isHeaderCollapsed ? ' charts-actions__button--compact' : ''
          }`}
          disabled={otherBlocked}
          data-disabled-reason={otherBlocked ? (isLocked ? 'locked' : undefined) : undefined}
          onClick={() => handleAction('draft')}
          aria-keyshortcuts="Shift+Enter"
        >
          ドラフト保存
        </button>
      );

  return (
    <section
      className={`charts-actions${isLocked ? ' charts-actions--locked' : ''}${embedded ? ' charts-actions--embedded' : ''}`}
      id="charts-actionbar"
      tabIndex={-1}
      data-focus-anchor="true"
      aria-live="off"
      data-run-id={runId}
      data-test-id="charts-actionbar"
      data-compact-collapsed={compactHeader && isHeaderCollapsed ? '1' : '0'}
      data-embedded={embedded ? '1' : '0'}
      data-status-tone={statusTone}
    >
      <header className="charts-actions__header">
        <div>
          <p className="charts-actions__kicker">
            {embedded ? '診療操作' : compactHeader ? '診察状況・送信パネル' : '診察状況更新と送信制御'}
          </p>
          <h2>診察状況・送信</h2>
          <p className={`charts-actions__status charts-actions__status--${statusTone}`} role="status">
            {statusLine}
          </p>
          {compactHeader ? (
            <div className="charts-actions__quick-controls" role="group" aria-label="Charts クイック操作">
              {showDraftAction && isHeaderCollapsed ? draftSaveButton : null}
              <button
                type="button"
                className="charts-actions__toggle"
                aria-controls="charts-actionbar-details"
                aria-expanded={!isHeaderCollapsed}
                onClick={() => setIsHeaderCollapsed((prev) => !prev)}
              >
                {isHeaderCollapsed ? '操作を開く' : '操作を閉じる'}
              </button>
            </div>
          ) : null}
        </div>
        <div className={`charts-actions__meta${compactHeader ? ' charts-actions__meta--compact' : ''}`}>
          {headerMetaCollapsed ? null : (
            <>
              <StatusPill
                className="charts-actions__pill"
                label="患者"
                value={`${selectedEntry?.name ?? '未選択'}（${selectedEntry?.patientId ?? selectedEntry?.appointmentId ?? 'ID不明'}）`}
              />
              <StatusPill className="charts-actions__pill" label="診療日" value={resolvedVisitDate ?? '—'} />
              <StatusPill
                className="charts-actions__pill"
                label="現在"
                value={`${selectedEntry?.status ?? '—'}（受付→診療→会計）`}
              />
            </>
          )}

          {showOperationalMeta ? (
            <>
              <StatusPill className="charts-actions__pill" label="runId" value={runId ?? '—'} tone="info" />
              <StatusPill
                className="charts-actions__pill"
                label="missingMaster"
                value={String(missingMaster)}
                tone={missingMaster ? 'warning' : 'success'}
              />
              <StatusPill
                className="charts-actions__pill"
                label="draftDirty"
                value={String(hasUnsavedDraft)}
                tone={hasUnsavedDraft ? 'warning' : 'success'}
              />
              {compactHeader ? (
                <details className="charts-actions__meta-details">
                  <summary className="charts-actions__meta-summary">詳細</summary>
                  <div className="charts-actions__meta-details-grid">
                    <StatusPill className="charts-actions__pill" label="traceId" value={resolvedTraceId ?? 'unknown'} tone="info" />
                    <StatusPill className="charts-actions__pill" label="transition" value={dataSourceTransition} tone="info" />
                    <StatusPill
                      className="charts-actions__pill"
                      label="fallbackUsed"
                      value={String(fallbackUsed)}
                      tone={fallbackUsed ? 'warning' : 'success'}
                    />
                    <StatusPill
                      className="charts-actions__pill"
                      label="cacheHit"
                      value={String(cacheHit)}
                      tone={cacheHit ? 'success' : 'warning'}
                    />
                    <StatusPill className="charts-actions__pill" label="受付ID" value={selectedEntry?.receptionId ?? '—'} />
                  </div>
                </details>
              ) : (
                <>
                  <StatusPill className="charts-actions__pill" label="traceId" value={resolvedTraceId ?? 'unknown'} tone="info" />
                  <StatusPill className="charts-actions__pill" label="transition" value={dataSourceTransition} tone="info" />
                  <StatusPill
                    className="charts-actions__pill"
                    label="fallbackUsed"
                    value={String(fallbackUsed)}
                    tone={fallbackUsed ? 'warning' : 'success'}
                  />
                  <StatusPill
                    className="charts-actions__pill"
                    label="cacheHit"
                    value={String(cacheHit)}
                    tone={cacheHit ? 'success' : 'warning'}
                  />
                  <StatusPill className="charts-actions__pill" label="受付ID" value={selectedEntry?.receptionId ?? '—'} />
                </>
              )}
            </>
          ) : null}
        </div>
      </header>

      <div id="charts-actionbar-details" hidden={compactHeader && isHeaderCollapsed}>
      {guardSummaries.length > 0 ? (
        <div className="charts-actions__guard-summary" role="status" aria-live="polite">
          <strong>ガード理由（短文）</strong>
          <ul>
            {guardSummaries.map((item) => (
              <li key={item.key}>
                {item.action}: {item.summary}
                {item.nextAction ? ` / 次: ${item.nextAction}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <FocusTrapDialog
        open={confirmAction === 'send'}
        role="alertdialog"
        title="ORCA送信の確認"
        description="現在の患者/受付を ORCA へ送信します。実行後に取り消せない場合があります。"
        onClose={() => {
          finalizeApproval('send', 'cancelled');
          setConfirmAction(null);
        }}
        testId="charts-send-dialog"
      >
        <div className="charts-actions__send-confirm" role="group" aria-label="ORCA送信の確認">
          <section className="charts-actions__send-confirm-section" aria-label="患者確認">
            <h3>患者確認</h3>
            <p className="charts-actions__send-confirm-identity">
              <strong>
                {sendDialogSummary.patientName}
              </strong>
            </p>
            <dl className="charts-actions__send-confirm-list">
              <div>
                <dt>患者ID</dt>
                <dd>{sendDialogSummary.patientIdLabel}</dd>
              </div>
              <div>
                <dt>生年月日 / 年齢</dt>
                <dd>
                  {sendDialogSummary.birthDate}
                  {sendDialogSummary.ageLabel ? ` / ${sendDialogSummary.ageLabel}` : ''}
                </dd>
              </div>
              <div>
                <dt>診療日</dt>
                <dd>{sendDialogSummary.visitLabel}</dd>
              </div>
              <div>
                <dt>受付ID</dt>
                <dd>{sendDialogSummary.receptionLabel}</dd>
              </div>
              <div>
                <dt>予約ID</dt>
                <dd>{sendDialogSummary.appointmentLabel}</dd>
              </div>
            </dl>
          </section>
          <section className="charts-actions__send-confirm-section" aria-label="送信対象サマリ">
            <h3>送信対象サマリ</h3>
            <dl className="charts-actions__send-confirm-list">
              <div>
                <dt>病名</dt>
                <dd>{sendDialogSummary.diagnosisCount}</dd>
              </div>
              <div>
                <dt>オーダー</dt>
                <dd>{sendDialogSummary.orderCount}</dd>
              </div>
              <div>
                <dt>SOAP</dt>
                <dd>{sendDialogSummary.soapState}</dd>
              </div>
              <div>
                <dt>画像添付</dt>
                <dd>{sendDialogSummary.imageCount}</dd>
              </div>
            </dl>
          </section>
          <button
            type="button"
            onClick={() => {
              finalizeApproval('send', 'cancelled');
              setConfirmAction(null);
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => {
              finalizeApproval('send', 'confirmed');
              setConfirmAction(null);
              void handleAction('send');
            }}
          >
            送信する
          </button>
        </div>
      </FocusTrapDialog>

      <FocusTrapDialog
        open={approvalUnlockDialogStep !== null}
        role="alertdialog"
        title={approvalUnlockDialogStep === 'final' ? '承認ロック解除: 最終確認' : '承認ロック解除'}
        description="署名確定を取り消し、編集可能状態に戻します。監査対象の危険操作です。"
        onClose={() => setApprovalUnlockDialogStep(null)}
        testId="charts-approval-unlock-dialog"
      >
        <section className="charts-actions__send-confirm" aria-label="承認ロック解除確認">
          <dl className="charts-actions__send-confirm-list">
            <div>
              <dt>患者名</dt>
              <dd>{selectedEntry?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>患者ID</dt>
              <dd>{resolvedPatientId ?? '—'}</dd>
            </div>
            <div>
              <dt>診療日</dt>
              <dd>{resolvedVisitDate ?? '—'}</dd>
            </div>
            <div>
              <dt>受付ID / 予約ID</dt>
              <dd>{resolvedReceptionId ?? '—'} / {resolvedAppointmentId ?? '—'}</dd>
            </div>
            <div>
              <dt>影響範囲</dt>
              <dd>署名確定が解除され、編集・送信が再開可能になります。</dd>
            </div>
          </dl>
          <div className="charts-tab-guard__actions" role="group" aria-label="承認ロック解除操作">
            <button type="button" onClick={() => setApprovalUnlockDialogStep(null)}>
              キャンセル
            </button>
            {approvalUnlockDialogStep === 'confirm' ? (
              <button type="button" className="charts-tab-guard__danger" onClick={() => setApprovalUnlockDialogStep('final')}>
                最終確認へ
              </button>
            ) : (
              <button
                type="button"
                className="charts-tab-guard__danger"
                onClick={() => {
                  setApprovalUnlockDialogStep(null);
                  onApprovalUnlock?.();
                  setBanner({
                    tone: 'warning',
                    message: '承認ロックを解除しました。署名確定が取り消され、編集が再開できます。',
                    nextAction: '編集前に内容確認と再署名が必要か確認してください。',
                  });
                  setToast(null);
                }}
              >
                解除を実行
              </button>
            )}
          </div>
        </section>
      </FocusTrapDialog>

      <FocusTrapDialog
        open={forceTakeoverDialogStep !== null}
        role="alertdialog"
        title={forceTakeoverDialogStep === 'final' ? '編集ロック引き継ぎ: 最終確認' : '編集ロック引き継ぎ'}
        description="別タブの編集ロックを現在タブへ引き継ぎます。上書き競合の可能性があります。"
        onClose={() => setForceTakeoverDialogStep(null)}
        testId="charts-force-takeover-dialog"
      >
        <section className="charts-actions__send-confirm" aria-label="編集ロック引き継ぎ確認">
          <dl className="charts-actions__send-confirm-list">
            <div>
              <dt>患者名</dt>
              <dd>{selectedEntry?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>患者ID</dt>
              <dd>{resolvedPatientId ?? '—'}</dd>
            </div>
            <div>
              <dt>診療日</dt>
              <dd>{resolvedVisitDate ?? '—'}</dd>
            </div>
            <div>
              <dt>受付ID / 予約ID</dt>
              <dd>{resolvedReceptionId ?? '—'} / {resolvedAppointmentId ?? '—'}</dd>
            </div>
            <div>
              <dt>影響範囲</dt>
              <dd>他タブの編集内容と競合する可能性があります。</dd>
            </div>
          </dl>
          <div className="charts-tab-guard__actions" role="group" aria-label="編集ロック引き継ぎ操作">
            <button type="button" onClick={() => setForceTakeoverDialogStep(null)}>
              キャンセル
            </button>
            {forceTakeoverDialogStep === 'confirm' ? (
              <button type="button" className="charts-tab-guard__danger" onClick={() => setForceTakeoverDialogStep('final')}>
                最終確認へ
              </button>
            ) : (
              <button
                type="button"
                className="charts-tab-guard__danger"
                onClick={() => {
                  setForceTakeoverDialogStep(null);
                  onForceTakeover?.();
                }}
              >
                引き継ぎを実行
              </button>
            )}
          </div>
        </section>
      </FocusTrapDialog>

      <ReportPrintDialog
        open={printDialogOpen}
        runId={runId}
        isRunning={isRunning}
        onClose={() => {
          finalizeApproval('print', 'cancelled');
          setPrintDialogOpen(false);
        }}
        onConfirmOutpatient={() => {
          finalizeApproval('print', 'confirmed');
          setPrintDialogOpen(false);
          handlePrintExport();
        }}
        onConfirmReport={() => {
          finalizeApproval('print', 'confirmed');
          setPrintDialogOpen(false);
          void handleReportPrint();
        }}
        printDestination={printDestination}
        onDestinationChange={setPrintDestination}
        reportForm={reportForm}
        onReportFieldChange={updateReportField}
        reportFieldErrors={reportFieldErrors}
        reportReady={reportReady}
        reportIncomeStatus={reportIncomeStatus}
        reportIncomeError={reportIncomeError}
        reportIncomeLatest={reportIncomeLatest}
        reportInvoiceOptions={reportInvoiceOptions}
        reportInsuranceOptions={reportInsuranceOptions}
        reportNeedsInvoice={reportNeedsInvoice}
        reportNeedsOutsideClass={reportNeedsOutsideClass}
        reportNeedsDepartment={reportNeedsDepartment}
        reportNeedsInsurance={reportNeedsInsurance}
        reportNeedsPerformMonth={reportNeedsPerformMonth}
        resolvedReportType={resolvedReportType}
      />

      {banner && (
        <div className="charts-actions__banner">
          <ToneBanner tone={banner.tone} message={banner.message} nextAction={banner.nextAction} runId={runId} />
          <div className="charts-actions__banner-actions" role="group" aria-label="通知操作">
            {retryAction && !isRunning && (
              <button type="button" className="charts-actions__retry" onClick={() => handleAction(retryAction)}>
                リトライ
              </button>
            )}
            <button type="button" className="charts-actions__retry" onClick={() => setBanner(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {isRunning && runningAction === 'send' && (
        <div className="charts-actions__banner-actions" role="group" aria-label="進行中の操作">
          <button type="button" className="charts-actions__retry" onClick={handleAbort}>
            送信を中断
          </button>
        </div>
      )}
      {approvalLocked ? (
        <div className="charts-actions__conflict" role="group" aria-label="承認済み（署名確定）のため編集不可">
          <div className="charts-actions__conflict-title">
            <strong>承認済み（署名確定）</strong>
            <span className="charts-actions__conflict-meta">
              {approvalLock?.approvedAt ? `approvedAt=${approvalLock.approvedAt}` : ''}
            </span>
          </div>
          <p className="charts-actions__conflict-message">{approvalReason}</p>
          <div className="charts-actions__conflict-actions">
            <button type="button" className="charts-actions__button charts-actions__button--print" onClick={openPrintDialog}>
              印刷/エクスポートへ
            </button>
            <button
              type="button"
              className="charts-actions__button charts-actions__button--danger"
              onClick={handleApprovalUnlock}
              disabled={!onApprovalUnlock}
            >
              承認ロック解除
            </button>
          </div>
        </div>
      ) : null}
      {readOnly && !approvalLocked ? (
        <div className="charts-actions__conflict" role="group" aria-label="並行編集（閲覧専用）の対応">
          <div className="charts-actions__conflict-title">
            <strong>並行編集を検知</strong>
            <span className="charts-actions__conflict-meta">
              {editLock?.ownerRunId ? `ownerRunId=${editLock.ownerRunId}` : ''}
              {editLock?.expiresAt ? ` expiresAt=${editLock.expiresAt}` : ''}
            </span>
          </div>
          <p className="charts-actions__conflict-message">{readOnlyReason}</p>
          <div className="charts-actions__conflict-actions">
            <button type="button" className="charts-actions__button charts-actions__button--reload" onClick={handleReloadLatest}>
              最新を再読込
            </button>
            <button
              type="button"
              className="charts-actions__button charts-actions__button--cancel"
              onClick={handleDiscard}
              disabled={!hasUnsavedDraft}
            >
              自分の変更を破棄
            </button>
            <button type="button" className="charts-actions__button charts-actions__button--takeover" onClick={handleForceTakeover}>
              強制引き継ぎ
            </button>
          </div>
        </div>
      ) : null}

      <div className="charts-actions__controls">
        <div className="charts-actions__group" data-group="encounter" role="group" aria-label={embedded ? '診察開始' : '診察状況更新'}>
          <button
            type="button"
            id="charts-action-start"
            className={`charts-actions__button charts-actions__button--encounter-start${primaryAction === 'start' ? ' charts-actions__button--primary-route' : ''}`}
            disabled={otherBlocked || !resolvedPatientId}
            data-disabled-reason={
              otherBlocked
                ? (isLocked ? 'locked' : undefined)
                : !resolvedPatientId
                  ? 'patient_not_selected'
                  : undefined
            }
            title={!resolvedPatientId ? '患者未選択のため開始できません。' : otherBlocked ? statusLine : undefined}
            onClick={() => handleAction('start')}
          >
            診察開始
          </button>
          {embedded ? null : (
            <>
              <button
                type="button"
                id="charts-action-pause"
                className="charts-actions__button charts-actions__button--encounter-pause"
                disabled={otherBlocked || !resolvedPatientId}
                data-disabled-reason={
                  otherBlocked
                    ? (isLocked ? 'locked' : undefined)
                    : !resolvedPatientId
                      ? 'patient_not_selected'
                      : undefined
                }
                onClick={() => handleAction('pause')}
              >
                診察中断
              </button>
              <button
                type="button"
                id="charts-action-finish"
                className={`charts-actions__button charts-actions__button--encounter-finish${primaryAction === 'finish' ? ' charts-actions__button--primary-route' : ''}`}
                disabled={otherBlocked || !resolvedPatientId}
                data-disabled-reason={
                  otherBlocked
                    ? (isLocked ? 'locked' : undefined)
                    : !resolvedPatientId
                      ? 'patient_not_selected'
                      : undefined
                }
                title={!resolvedPatientId ? '患者未選択のため終了できません。' : otherBlocked ? statusLine : undefined}
                onClick={() => handleAction('finish')}
                aria-keyshortcuts="Alt+E"
              >
                診察終了
              </button>
            </>
          )}
        </div>
        <div className="charts-actions__group" data-group="send" role="group" aria-label="主要送信操作">
          <button
            type="button"
            id="charts-action-send"
            className={`charts-actions__button charts-actions__button--send${
              primaryAction === 'send' || primaryAction === 'sending' ? ' charts-actions__button--primary-route' : ''
            }`}
            disabled={sendDisabled}
            onClick={() => {
              setConfirmAction('send');
              approvalSessionRef.current = { action: 'send', closed: false };
              logApproval('send', 'open');
            }}
            aria-disabled={sendDisabled}
            aria-describedby={!isRunning && sendPrecheckReasons.length > 0 ? 'charts-actions-send-guard' : undefined}
            data-disabled-reason={
              sendDisabled
                ? (isRunning ? 'running' : sendPrecheckReasons.map((reason) => reason.key).join(','))
                : undefined
            }
            title={sendDisabled ? `送信不可: ${sendPrecheckReasons.map((reason) => reason.summary).join(' / ')}` : undefined}
            aria-keyshortcuts="Alt+S"
          >
            {primaryAction === 'sending' ? '送信中…' : 'ORCA 送信'}
          </button>
        </div>
      </div>
      <details className="charts-actions__more">
        <summary className="charts-actions__more-summary">その他</summary>
        <div className="charts-actions__more-actions" role="group" aria-label="補助操作">
          {showDraftAction && (compactHeader && isHeaderCollapsed ? null : draftSaveButton)}
          <button
            type="button"
            id="charts-action-print"
            className="charts-actions__button charts-actions__button--print"
            disabled={printDisabled}
            aria-disabled={printDisabled}
            onClick={openPrintDialog}
            aria-describedby={!isRunning && printPrecheckReasons.length > 0 ? 'charts-actions-print-guard' : undefined}
            data-disabled-reason={printDisabled ? printPrecheckReasons.map((reason) => reason.key).join(',') : undefined}
            title={printDisabled ? `印刷不可: ${printPrecheckReasons.map((reason) => reason.summary).join(' / ')}` : undefined}
            aria-keyshortcuts="Alt+I"
          >
            印刷/エクスポート
          </button>
          <button
            type="button"
            className="charts-actions__button charts-actions__button--cancel"
            disabled={otherBlocked}
            data-disabled-reason={otherBlocked ? (isLocked ? 'locked' : undefined) : undefined}
            title={otherBlocked ? statusLine : undefined}
            onClick={() => handleAction('cancel')}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="charts-actions__button charts-actions__button--unlock"
            disabled={isRunning || !isLocked || approvalLocked}
            onClick={handleUnlock}
          >
            ロック解除
          </button>
        </div>
      </details>

      {!isRunning && sendPrecheckReasons.length > 0 && (
        <div id="charts-actions-send-guard" className="charts-actions__guard" role="note" aria-live="off">
          <details>
            <summary>送信不可（{sendPrecheckReasons.length}件）</summary>
            <ul>
              {sendPrecheckReasons.map((reason) => (
                <li key={reason.key}>
                  {reason.summary}: {reason.detail}（次にやること: {reason.next.join(' / ')}）
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {!isRunning && printPrecheckReasons.length > 0 && (
        <div id="charts-actions-print-guard" className="charts-actions__guard" role="note" aria-live="off">
          <details>
            <summary>印刷不可（{printPrecheckReasons.length}件）</summary>
            <ul>
              {printPrecheckReasons.map((reason) => (
                <li key={reason.key}>
                  {reason.summary}: {reason.detail}（次にやること: {reason.next.join(' / ')}）
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {isRunning && (
        <div className="charts-actions__skeleton" role="status" aria-live={resolveAriaLive('info')}>
          <div className="charts-actions__skeleton-bar" />
          <div className="charts-actions__skeleton-bar charts-actions__skeleton-bar--short" />
        </div>
      )}

      {toast && (
        <div
          className={`charts-actions__toast charts-actions__toast--${toast.tone}`}
          role="status"
          aria-live={resolveAriaLive(toast.tone)}
          aria-atomic="false"
        >
          <div>
            <strong>{toast.message}</strong>
            {toast.detail && <p>{toast.detail}</p>}
          </div>
          <button type="button" className="charts-actions__retry" onClick={() => setToast(null)}>
            閉じる
          </button>
        </div>
      )}
      </div>
    </section>
  );
});

ChartsActionBar.displayName = 'ChartsActionBar';
