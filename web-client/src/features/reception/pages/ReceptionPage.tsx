import { Global } from '@emotion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { getAuditEventLog, logAuditEvent, logUiState } from '../../../libs/audit/auditLogger';
import { resolveAriaLive, resolveRunId } from '../../../libs/observability/observability';
import type { DataSourceTransition } from '../../../libs/observability/types';
import { isOrcaSuccessResult, normalizeOrcaApiResult } from '../../../libs/orca/orcaApiResultPolicy';
import { FocusTrapDialog } from '../../../components/modals/FocusTrapDialog';
import { OrderConsole } from '../components/OrderConsole';
import { ReceptionAuditPanel } from '../components/ReceptionAuditPanel';
import { ReceptionExceptionList, type ReceptionExceptionItem } from '../components/ReceptionExceptionList';
import { ToneBanner } from '../components/ToneBanner';
import {
  buildVisitEntryFromMutation,
  fetchAppointmentOutpatients,
  fetchClaimFlags,
  fetchMedicalInformationOptions,
  isClaimOutpatientEnabled,
  mutateVisit,
  type MedicalInformationOption,
  type AppointmentPayload,
  type ReceptionEntry,
  type ReceptionStatus,
  type VisitMutationParams,
  type VisitMutationPayload,
} from '../api';
import {
  fetchPatientMasterSearch,
  type PatientMasterRecord,
  type PatientMasterSearchResponse,
} from '../patientSearchApi';
import { buildDepartmentOptions } from '../departmentOptions';
import { receptionStyles } from '../styles';
import { applyAuthServicePatch, useAuthService, type AuthServiceFlags } from '../../charts/authService';
import { getChartToneDetails } from '../../../ux/charts/tones';
import type { ResolveMasterSource } from '../components/ResolveMasterBadge';
import { useAdminBroadcast } from '../../../libs/admin/useAdminBroadcast';
import { AdminBroadcastBanner } from '../../shared/AdminBroadcastBanner';
import { ApiFailureBanner } from '../../shared/ApiFailureBanner';
import { AuditSummaryInline } from '../../shared/AuditSummaryInline';
import { PatientIdentityBar } from '../../shared/PatientIdentityBar';
import { ReturnToBar } from '../../shared/ReturnToBar';
import { RunIdBadge } from '../../shared/RunIdBadge';
import { StatusPill } from '../../shared/StatusPill';
import { resolveCacheHitTone, resolveMetaFlagTone, resolveTransitionTone } from '../../shared/metaPillRules';
import { PatientMetaRow } from '../../shared/PatientMetaRow';
import {
  OUTPATIENT_AUTO_REFRESH_INTERVAL_MS,
  formatAutoRefreshTimestamp,
  useAutoRefreshNotice,
} from '../../shared/autoRefreshNotice';
import { MISSING_MASTER_RECOVERY_NEXT_ACTION } from '../../shared/missingMasterRecovery';
import {
  buildChartsUrl,
  hasHandoffEncounterKey,
  normalizeVisitDate,
  type OutpatientEncounterContext,
  type ReceptionCarryoverParams,
} from '../../charts/encounterContext';
import { useSession } from '../../../AppRouter';
import { isSystemAdminRole } from '../../../libs/auth/roles';
import { buildFacilityPath } from '../../../routes/facilityRoutes';
import { applyExternalParams, isSafeReturnTo, pickExternalParams } from '../../../routes/appNavigation';
import { useAppNavigation } from '../../../routes/useAppNavigation';
import type { ClaimBundle, ClaimQueueEntry, ClaimQueuePhase } from '../../outpatient/types';
import type {
  BillingCorrectionSignal,
  BillingTransmissionSignal,
  ReceptionBillingProjection,
} from '../../outpatient/types';
import { countAppointmentDataIntegrity, getAppointmentDataBanner } from '../../outpatient/appointmentDataBanner';
import type { OrcaQueueEntry } from '../../outpatient/orcaQueueApi';
import { fetchOrcaQueue, resolveOrcaQueueRetryUiFeedback, retryOrcaQueue } from '../../outpatient/orcaQueueApi';
import { ORCA_QUEUE_STALL_THRESHOLD_MS, resolveOrcaSendStatus, toClaimQueueEntryFromOrcaQueueEntry } from '../../outpatient/orcaQueueStatus';
import {
  buildExceptionAuditDetails,
  buildQueuePhaseSummary,
  resolveExceptionDecision,
} from '../exceptionLogic';
import {
  buildPendingAcceptHandoff,
  buildReceptionEncounterFromEntry,
  resolveAcceptMutationHandoff,
  resolvePatientChartsHandoff,
  resolvePendingAcceptHandoffFromEntries,
  type PendingReceptionHandoff,
  type ResolvedReceptionHandoff,
} from '../receptionHandoff';
import { findOrcaClaimSendEntryForMatch, loadOrcaClaimSendCache } from '../../charts/orcaClaimSendCache';
import { postMedicalRecords, type MedicalRecordEntry } from '../../administration/orcaInternalWrapperApi';
import { searchLocalPatients, type PatientListResponse, type PatientRecord } from '../../patients/api';
import {
  loadOutpatientSavedViews,
  removeOutpatientSavedView,
  resolvePaymentMode,
  type OutpatientSavedView,
  type PaymentMode,
  upsertOutpatientSavedView,
} from '../../outpatient/savedViews';
import type { StorageScope } from '../../../libs/session/storageScope';
import {
  clearReceptionStatusOverridesForDate,
  listReceptionSnapshotDates,
  resolveReceptionEntriesForDate,
  saveReceptionEntriesForDate,
} from '../receptionDailyState';
import {
  startReceptionRealtimeStream,
  type ReceptionRealtimeConnectionStatus,
  type ReceptionRealtimeEvent,
} from '../receptionRealtimeStream';
import { useAppToast } from '../../../libs/ui/appToast';
import { buildMedicalModV2RequestXml, postOrcaMedicalModV2Xml } from '../../charts/orcaClaimApi';
import { saveOrcaClaimSendCache } from '../../charts/orcaClaimSendCache';
import {
  buildOrcaEncounterContext,
  formatMissingOrcaEncounterContextLabels,
  hasCompleteOrcaEncounterContext,
  resolveMissingOrcaEncounterContextFields,
  type OrcaEncounterContext,
} from '../../charts/orcaEncounterContext';
import { ORCA_SEND_ORDER_ENTITIES } from '../../charts/orderCategoryRegistry';
import {
  buildMedicalModV2BlockNotice,
  fetchMedicalModV2OrderBundles,
  prepareMedicalModV2SendData,
} from '../../charts/orderRpNormalization';
import { resolveAcceptmodFallbackMessage } from '../acceptmodv2Result';

type SortKey = 'time' | 'acceptance' | 'reservation' | 'name' | 'department';
type StatusListLayout = 'table' | 'cards';

const SECTION_ORDER: ReceptionStatus[] = ['受付中', '診療中', '会計待ち', '再計待', '会計済み', '予約'];
const SECTION_LABEL: Record<ReceptionStatus, string> = {
  受付中: '診察待ち',
  診療中: '診察中',
  会計待ち: '会計待ち',
  再計待: '再計待',
  会計済み: '会計済',
  予約: '予約',
};
const FILTER_STORAGE_KEY = 'reception-filter-state';
const FILTER_PANEL_COLLAPSE_KEY = 'reception-filter-panel-collapsed';
const STATUS_LIST_LAYOUT_STORAGE_KEY = 'reception-status-list-layout';
const ORCA_QUEUE_REFRESH_INTERVAL_MS = 60_000;
const ORCA_QUEUE_QUERY_KEY = ['orca-queue'] as const;
const PATIENT_SEARCH_PAGE_SIZE = 50;
const STATUS_TAB_ORDER = SECTION_ORDER;

const pad2 = (value: number) => value.toString().padStart(2, '0');
const formatLocalYmd = (date: Date) =>
  `${date.getFullYear().toString().padStart(4, '0')}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const formatLocalHms = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
const todayString = () => formatLocalYmd(new Date());

const receptionStatusMvpPhase = (() => {
  const raw = import.meta.env.VITE_RECEPTION_STATUS_MVP ?? '';
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
})();
const isReceptionStatusMvpEnabled = receptionStatusMvpPhase >= 1;
const isReceptionStatusMvpPhase2 = receptionStatusMvpPhase >= 2;

const isSortKey = (value?: string | null): value is SortKey =>
  value === 'time' || value === 'acceptance' || value === 'reservation' || value === 'name' || value === 'department';
const isStatusListLayout = (value?: string | null): value is StatusListLayout =>
  value === 'table' || value === 'cards';
const resolveInitialStatusTab = (section?: string | null): ReceptionStatus => {
  if (section === 'appointment') return '予約';
  if (section === 'billing') return '会計待ち';
  return '受付中';
};

const entryKey = (entry: ReceptionEntry) =>
  entry.encounterKey ?? entry.scheduleKey ?? entry.receptionId ?? entry.appointmentId ?? entry.patientId ?? entry.id;

const queuePhaseLabel: Record<ClaimQueuePhase, string> = {
  pending: '待ち',
  retry: '再送待ち',
  hold: '保留',
  failed: '失敗',
  sent: '送信済',
  ack: '応答済',
};

const queuePhaseTone: Record<ClaimQueuePhase, 'info' | 'warning' | 'error' | 'success'> = {
  pending: 'warning',
  retry: 'warning',
  hold: 'warning',
  failed: 'error',
  sent: 'info',
  ack: 'success',
};

type BillingWorkflowStatus = Extract<ReceptionStatus, '会計待ち' | '再計待' | '会計済み'>;

const REBILL_FALLBACK_REASON = '会計済み後に変更があったため再会計が必要です。';

const normalizeBillingReason = (value?: string | null) => {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized ? truncateText(normalized, 80) : undefined;
};

const resolveTransmissionFromQueuePhase = (phase?: ClaimQueuePhase): BillingTransmissionSignal => {
  if (phase === 'retry') return '再送待ち';
  if (phase === 'hold') return '保留';
  if (phase === 'failed') return '失敗';
  if (phase === 'sent') return '送信済';
  if (phase === 'ack') return '応答済';
  return '未送信';
};

const resolveCorrectionSignal = (params: {
  bundle?: Pick<ClaimBundle, 'claimStatus' | 'claimStatusText'>;
  cache?: { correctionKind?: 'confirm' | 'rebill'; correctionReason?: string } | null;
}): BillingCorrectionSignal | undefined => {
  if (params.cache?.correctionKind === 'rebill') {
    return {
      kind: '要再計',
      reason: normalizeBillingReason(params.cache.correctionReason) ?? REBILL_FALLBACK_REASON,
    };
  }
  if (params.cache?.correctionKind === 'confirm') {
    const reason = normalizeBillingReason(params.cache.correctionReason);
    return reason ? { kind: '要確認', reason } : undefined;
  }
  const statusText = params.bundle?.claimStatusText ?? '';
  const normalized = statusText.toLowerCase();
  if (/再計待|再会計|rebill/.test(statusText) || normalized.includes('rebill')) {
    return {
      kind: '要再計',
      reason: normalizeBillingReason(statusText) ?? REBILL_FALLBACK_REASON,
    };
  }
  if (/補正|要確認|correction/.test(statusText) || normalized.includes('correction')) {
    const reason = normalizeBillingReason(statusText);
    return reason ? { kind: '要確認', reason } : undefined;
  }
  return undefined;
};

const formatCorrectionNote = (correction?: BillingCorrectionSignal) => {
  if (!correction) return undefined;
  return correction.kind === '要再計' ? `再計待: ${correction.reason}` : `ORCA補正要確認: ${correction.reason}`;
};

const resolveQueueStatus = (entry?: ClaimQueueEntry) => {
  if (!entry) return { label: '未取得', tone: 'warning' as const, detail: undefined };
  const label = queuePhaseLabel[entry.phase];
  const tone = queuePhaseTone[entry.phase];
  const detail =
    entry.retryCount !== undefined ? `再送${entry.retryCount}回` : entry.holdReason ?? entry.errorMessage ?? undefined;
  return { label, tone, detail };
};

const resolveOrcaQueueStatus = (entry?: OrcaQueueEntry) => {
  if (!entry) return { label: '未取得', tone: 'warning' as const, detail: undefined };
  const sendStatus = resolveOrcaSendStatus(entry);
  const phase = toClaimQueueEntryFromOrcaQueueEntry(entry).phase;
  const detailParts = [
    sendStatus?.isStalled ? '滞留' : undefined,
    sendStatus?.error ? `エラー: ${sendStatus.error}` : undefined,
  ].filter((value): value is string => Boolean(value));
  return {
    // ORCA queue の status は retry/sent/ack などを含むため、Reception 側は phase ベースのラベルで表示する。
    // (例) retry -> 再送待ち。UI と E2E で「次に何をすべきか」が分かる表現を優先する。
    label: queuePhaseLabel[phase],
    tone: queuePhaseTone[phase],
    detail: detailParts.length > 0 ? detailParts.join(' / ') : undefined,
  };
};

const paymentModeLabel = (insurance?: string | null) => {
  const mode = resolvePaymentMode(insurance ?? undefined);
  if (mode === 'insurance') return '保険';
  if (mode === 'self') return '自費';
  return '不明';
};

const RECEPTION_REALTIME_STATUS_LABEL: Record<ReceptionRealtimeConnectionStatus, string> = {
  connecting: '接続中',
  open: '接続済み',
  reconnecting: '再接続中',
  closed: '停止',
  unavailable: '未対応',
};

const RECEPTION_REALTIME_STATUS_TONE: Record<
  ReceptionRealtimeConnectionStatus,
  'neutral' | 'info' | 'warning' | 'success' | 'error'
> = {
  connecting: 'info',
  open: 'success',
  reconnecting: 'warning',
  closed: 'neutral',
  unavailable: 'warning',
};

const ACCEPT_SUCCESS_RESULTS = new Set(['00', '0000', 'K3']);
const ACCEPT_WARNING_RESULTS = new Set(['16', '21', '60']);
const RECEPTION_SUPPORT_GUIDE = '必要に応じて RUN_ID コピーで実行IDを共有してください。';

const buildReceptionAcceptResultDetail = () => '結果を確認し、必要なら一覧を再取得してください。';

const buildReceptionClaimSendDetail = (outcome: 'success' | 'warning' | 'error') => {
  if (outcome === 'success') {
    return '会計済みは収納確認後に反映します。';
  }
  if (outcome === 'warning') {
    return '会計送信結果に警告があります。内容を確認し、必要なら再試行してください。';
  }
  return RECEPTION_SUPPORT_GUIDE;
};

type PhysicianNameMap = Record<string, string>;

type BillingSendGuard =
  | {
      canSend: true;
      encounterContext: OrcaEncounterContext;
      title: string;
    }
  | {
      canSend: false;
      blockedReasons: string[];
      detail: string;
      message: string;
      title: string;
      visibleReason: string;
    };

const normalizeCanonicalCode = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const resolveReceptionEntryDepartmentCode = (entry?: Pick<ReceptionEntry, 'departmentCode'>) =>
  normalizeCanonicalCode(entry?.departmentCode);

const resolveReceptionEntryPhysicianCode = (entry?: Pick<ReceptionEntry, 'physicianCode'>) =>
  normalizeCanonicalCode(entry?.physicianCode);

const BILLING_SEND_ENABLE_GUIDE = '受付一覧を再取得し、official visit row の canonical field が揃うと送信できます。';

const resolveBillingSendGuard = ({
  entry,
  fallbackUsed,
}: {
  entry: Pick<
    ReceptionEntry,
    | 'patientId'
    | 'visitDate'
    | 'departmentCode'
    | 'physicianCode'
    | 'insuranceCombinationNumber'
    | 'voucherNumber'
    | 'sequentialNumber'
  >;
  fallbackUsed?: boolean;
}): BillingSendGuard => {
  if (fallbackUsed) {
    return {
      canSend: false,
      blockedReasons: ['fallback_used'],
      detail: `fallbackUsed=true。${BILLING_SEND_ENABLE_GUIDE}`,
      message: 'フォールバック経路のため会計送信できません。',
      title: 'fallbackUsed=true のため会計送信できません',
      visibleReason: `会計送信不可: fallbackUsed=true です。${BILLING_SEND_ENABLE_GUIDE}`,
    };
  }

  const encounterContext = buildOrcaEncounterContext(entry);
  if (hasCompleteOrcaEncounterContext(encounterContext)) {
    return {
      canSend: true,
      encounterContext,
      title: 'ORCAへ会計送信します',
    };
  }

  const missingFields = resolveMissingOrcaEncounterContextFields(encounterContext);
  const missingLabels = formatMissingOrcaEncounterContextLabels(missingFields);
  const missingLabelText = missingLabels.join(', ');
  return {
    canSend: false,
    blockedReasons: missingFields.map((field) => `missing_${field}`),
    detail: `${missingLabelText} が不足しています。${BILLING_SEND_ENABLE_GUIDE}`,
    message: 'canonical encounter context が不足しているため会計送信できません。',
    title: `${missingLabelText} が不足しているため会計送信できません`,
    visibleReason: `会計送信不可: ${missingLabelText} が不足しています。${BILLING_SEND_ENABLE_GUIDE}`,
  };
};

const resolveEntryDisplayLabel = (code: string, value?: string) => {
  const trimmed = value?.trim();
  if (trimmed && trimmed !== code) return trimmed;
  return code;
};

const isIdempotentDuplicate = (apiResult?: string, apiResultMessage?: string) =>
  apiResult === '80' && Boolean(apiResultMessage && /既に同日の診療データが登録されています/.test(apiResultMessage));

const truncateText = (value: string, maxLength = 60) => {
  if (value.length <= maxLength) return value;
  const limit = Math.max(0, maxLength - 3);
  return `${value.slice(0, limit)}...`;
};

type Rec001MvpDecision = {
  label: string;
  tone: 'info' | 'warning' | 'error' | 'success';
  detail?: string;
  nextAction: string;
  canRetry: boolean;
  retryTitle?: string;
};

const resolveRec001MvpDecision = (options: {
  missingMaster: boolean;
  orcaQueueErrorMessage?: string;
  orcaQueueStatus: ReturnType<typeof resolveOrcaQueueStatus>;
  orcaQueueEntry?: OrcaQueueEntry;
  isSystemAdmin: boolean;
  retrySupported: boolean;
}): Rec001MvpDecision => {
  if (options.missingMaster) {
    return {
      label: 'マスタ欠損',
      tone: 'warning',
      detail: `ORCA マスタ未取得のため再送できません。${MISSING_MASTER_RECOVERY_NEXT_ACTION}してください。`,
      nextAction: '復旧ガイド確認',
      canRetry: false,
    };
  }
  if (options.orcaQueueErrorMessage) {
    const msg = options.orcaQueueErrorMessage.toLowerCase();
    const kind =
      msg.includes('401') || msg.includes('unauthorized')
        ? '認証'
        : msg.includes('403')
          ? '権限'
          : msg.includes('502') || msg.includes('503')
            ? '上流'
            : '取得失敗';
    return {
      label: `ORCA queue ${kind}`,
      tone: 'error',
      detail: options.orcaQueueStatus.detail,
      nextAction: '接続/設定を確認して再取得',
      canRetry: false,
    };
  }
  if (options.orcaQueueEntry?.status === 'failed') {
    const retryable = options.isSystemAdmin && options.retrySupported && options.orcaQueueEntry.retryable !== false;
    return {
      label: options.orcaQueueStatus.label,
      tone: 'error',
      detail: options.orcaQueueStatus.detail,
      nextAction: retryable ? '再送' : options.retrySupported ? '原因確認' : '再送未対応',
      canRetry: retryable,
      retryTitle: retryable
        ? 'ORCA再送を要求します'
        : !options.isSystemAdmin
          ? 'システム管理者のみ再送できます'
          : !options.retrySupported
            ? 'この環境では ORCA 再送は未実装です'
            : 'retryable=false のため再送できません',
    };
  }
  if (options.orcaQueueEntry?.status === 'pending') {
    const stalled = Boolean(resolveOrcaSendStatus(options.orcaQueueEntry)?.isStalled);
    const retryable = stalled && options.isSystemAdmin && options.retrySupported && options.orcaQueueEntry.retryable !== false;
    return {
      label: options.orcaQueueStatus.label,
      tone: 'warning',
      detail: options.orcaQueueStatus.detail,
      nextAction: retryable ? '再送' : options.retrySupported ? '待機/滞留確認' : '再送未対応',
      canRetry: retryable,
      retryTitle: retryable
        ? '滞留のため ORCA再送を要求します'
        : !options.isSystemAdmin
          ? 'システム管理者のみ再送できます'
          : !options.retrySupported
            ? 'この環境では ORCA 再送は未実装です'
            : undefined,
    };
  }
  if (options.orcaQueueEntry?.status === 'delivered') {
    return {
      label: options.orcaQueueStatus.label,
      tone: 'success',
      detail: options.orcaQueueStatus.detail,
      nextAction: '—',
      canRetry: false,
    };
  }
  return {
    label: options.orcaQueueStatus.label,
    tone: options.orcaQueueStatus.tone,
    detail: options.orcaQueueStatus.detail,
    nextAction: options.orcaQueueStatus.tone === 'error' ? '原因確認' : '—',
    canRetry: false,
  };
};


const toDateLabel = (value?: string) => {
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  if (value.includes('T')) return value.split('T')[0] ?? value;
  return value;
};

const normalizeTimeLabel = (value?: string | null): string | undefined => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return undefined;
  if (raw.includes('T')) {
    const [, timePart] = raw.split('T');
    if (timePart && /^\d{2}:\d{2}/.test(timePart)) return timePart.slice(0, 5);
  }
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  if (/^\d{4}$/.test(raw)) return `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
  if (/^\d{6}$/.test(raw)) return `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
  return raw;
};

const computeElapsedMinutes = (nowMs: number, date: string, time?: string): number | null => {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}:00`);
  const baseMs = parsed.getTime();
  if (Number.isNaN(baseMs)) return null;
  const diff = nowMs - baseMs;
  if (diff < 0) return null;
  return Math.floor(diff / 60_000);
};

const toBundleTimeMs = (value?: string): number => {
  if (!value) return -1;
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return parsed;
  if (/^\d{8}$/.test(value)) {
    const normalized = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    const date = Date.parse(normalized);
    return Number.isNaN(date) ? -1 : date;
  }
  return -1;
};

const shiftDate = (value: string, dayDelta: number): string => {
  const normalized = normalizeVisitDate(value);
  if (!normalized) return value;
  const parsed = toUtcDateFromYmd(normalized);
  if (!parsed) return value;
  parsed.setUTCDate(parsed.getUTCDate() + dayDelta);
  return formatYmd(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
};

type DailyCalendarCell = {
  ymd: string;
  day: number;
  weekday: number;
  inMonth: boolean;
};

const DAILY_CALENDAR_WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;
const DAILY_CALENDAR_YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseYmd = (value: string): { year: number; month: number; day: number } | null => {
  const match = value.match(DAILY_CALENDAR_YMD_RE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { year, month, day };
};

const formatYmd = (year: number, month: number, day: number) => {
  const pad = (value: number, size: number) => value.toString().padStart(size, '0');
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
};

const toUtcDateFromYmd = (value: string): Date | null => {
  const parsed = parseYmd(value);
  if (!parsed) return null;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const startOfUtcMonth = (value: string): string => {
  const date = toUtcDateFromYmd(value);
  if (!date) return value;
  return formatYmd(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
};

const shiftUtcMonth = (monthStartYmd: string, monthDelta: number): string => {
  const date = toUtcDateFromYmd(monthStartYmd);
  if (!date) return monthStartYmd;
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + monthDelta);
  return formatYmd(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
};

const buildDailyCalendarCells = (monthStartYmd: string): DailyCalendarCell[] => {
  const monthStart = toUtcDateFromYmd(monthStartYmd);
  if (!monthStart) return [];

  const firstOfMonth = new Date(monthStart);
  firstOfMonth.setUTCDate(1);
  const startWeekday = firstOfMonth.getUTCDay();

  const firstCell = new Date(firstOfMonth);
  firstCell.setUTCDate(firstOfMonth.getUTCDate() - startWeekday);

  const monthIndex = firstOfMonth.getUTCMonth();
  const cells: DailyCalendarCell[] = [];

  for (let offset = 0; offset < 42; offset += 1) {
    const cellDate = new Date(firstCell);
    cellDate.setUTCDate(firstCell.getUTCDate() + offset);
    const weekday = cellDate.getUTCDay();
    cells.push({
      ymd: formatYmd(cellDate.getUTCFullYear(), cellDate.getUTCMonth() + 1, cellDate.getUTCDate()),
      day: cellDate.getUTCDate(),
      weekday,
      inMonth: cellDate.getUTCMonth() === monthIndex,
    });
  }

  return cells;
};

const loadCollapsedPanel = (key: string, fallback: boolean) => {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    return stored === '1' || stored === 'true';
  } catch {
    return fallback;
  }
};

const persistCollapsedPanel = (key: string, value: boolean) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // ignore
  }
};

const loadStatusListLayout = (): StatusListLayout => {
  if (typeof localStorage === 'undefined') return 'table';
  try {
    const stored = localStorage.getItem(STATUS_LIST_LAYOUT_STORAGE_KEY);
    return isStatusListLayout(stored) ? stored : 'table';
  } catch {
    return 'table';
  }
};

const persistStatusListLayout = (value: StatusListLayout) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STATUS_LIST_LAYOUT_STORAGE_KEY, value);
  } catch {
    // ignore
  }
};

const toMasterSource = (transition?: DataSourceTransition): ResolveMasterSource => {
  if (!transition) return 'snapshot';
  if (transition === 'fallback') return 'fallback';
  if (transition === 'server') return 'server';
  if (transition === 'mock') return 'mock';
  return 'snapshot';
};

const normalizePaymentMode = (value?: string | null): PaymentMode =>
  value === 'insurance' || value === 'self' ? value : 'all';

const filterEntries = (
  entries: ReceptionEntry[],
  keyword: string,
  department: string,
  physician: string,
  paymentMode: PaymentMode,
): ReceptionEntry[] => {
  const kw = keyword.trim().toLowerCase();
  return entries.filter((entry) => {
    const matchesKeyword =
      kw.length === 0 ||
      [entry.name, entry.kana, entry.patientId, entry.appointmentId].some((value) =>
        value?.toLowerCase().includes(kw),
      );
    const matchesDept = department ? entry.department === department : true;
    const matchesPhysician = physician ? entry.physician === physician : true;
    const resolvedPayment = resolvePaymentMode(entry.insurance);
    const matchesPayment =
      paymentMode === 'all' ? true : resolvedPayment ? resolvedPayment === paymentMode : false;
    return matchesKeyword && matchesDept && matchesPhysician && matchesPayment;
  });
};

const sortEntries = (entries: ReceptionEntry[], sortKey: SortKey) => {
  const toMinutes = (time?: string) => {
    if (!time) return Number.MAX_SAFE_INTEGER;
    const [h, m] = time.split(':').map((v) => Number(v));
    if (Number.isNaN(h) || Number.isNaN(m)) return Number.MAX_SAFE_INTEGER;
    return h * 60 + m;
  };

  return [...entries].sort((a, b) => {
    if (sortKey === 'time') {
      const aTime = a.acceptanceTime ?? a.reservationTime ?? a.appointmentTime;
      const bTime = b.acceptanceTime ?? b.reservationTime ?? b.appointmentTime;
      return toMinutes(aTime) - toMinutes(bTime);
    }
    if (sortKey === 'acceptance') {
      return toMinutes(a.acceptanceTime) - toMinutes(b.acceptanceTime);
    }
    if (sortKey === 'reservation') {
      return toMinutes(a.reservationTime) - toMinutes(b.reservationTime);
    }
    if (sortKey === 'department') {
      return (a.department ?? '').localeCompare(b.department ?? '', 'ja');
    }
    return (a.name ?? '').localeCompare(b.name ?? '', 'ja');
  });
};

const groupByStatus = (entries: ReceptionEntry[]) =>
  SECTION_ORDER.map((status) => ({
    status,
    items: entries.filter((entry) => entry.status === status),
  }));

type AcceptTargetSource = 'none' | 'manual' | 'patient-search' | 'master-search' | 'selection';
type AcceptTarget = {
  source: AcceptTargetSource;
  patientId: string;
  name: string;
  birthDate: string;
  sex: string;
};

type ReceptionPageProps = {
  runId?: string;
  patientId?: string;
  receptionId?: string;
  destination?: string;
  title?: string;
  description?: string;
};

export function ReceptionPage({
  runId: initialRunId,
  patientId,
  receptionId,
  destination = 'ORCA queue',
  title = '既存患者受付',
  description = '既存患者の受付一覧確認、当日受付、会計送信、カルテ起動を行う画面。',
}: ReceptionPageProps) {
  const session = useSession();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const appNav = useAppNavigation({ facilityId: session.facilityId, userId: session.userId });
  const navigationLocationState = (appNav.locationState ?? {}) as {
    encounter?: { visitDate?: string };
    carryover?: { kw?: string };
    visitDate?: string;
    kw?: string;
    keyword?: string;
  };
  const { enqueue } = useAppToast();
  const { broadcast } = useAdminBroadcast({ facilityId: session.facilityId, userId: session.userId });
  const { flags, setCacheHit, setMissingMaster, setDataSourceTransition, setFallbackUsed, bumpRunId } = useAuthService();
  const storageScope = useMemo<StorageScope>(
    () => ({ facilityId: session.facilityId, userId: session.userId }),
    [session.facilityId, session.userId],
  );
  const fallbackUrl = useMemo(() => {
    if (appNav.fromCandidate === 'patients') return buildFacilityPath(session.facilityId, '/patients');
    if (appNav.fromCandidate === 'reception') return buildFacilityPath(session.facilityId, '/reception');
    return buildFacilityPath(session.facilityId, '/charts');
  }, [appNav.fromCandidate, session.facilityId]);
  const stateVisitDate = useMemo(
    () => normalizeVisitDate(navigationLocationState.visitDate ?? navigationLocationState.encounter?.visitDate),
    [navigationLocationState.encounter?.visitDate, navigationLocationState.visitDate],
  );
  const stateKeyword = useMemo(() => {
    const fromCarryover = navigationLocationState.carryover?.kw;
    if (typeof fromCarryover === 'string' && fromCarryover.trim()) {
      return fromCarryover.trim();
    }
    const topLevel =
      typeof navigationLocationState.kw === 'string'
        ? navigationLocationState.kw
        : typeof navigationLocationState.keyword === 'string'
          ? navigationLocationState.keyword
          : undefined;
    if (typeof topLevel !== 'string') return '';
    return topLevel.trim();
  }, [navigationLocationState.carryover?.kw, navigationLocationState.keyword, navigationLocationState.kw]);
  const claimOutpatientEnabled = isClaimOutpatientEnabled();
  const [selectedDate, setSelectedDate] = useState(() => {
    const fromDate = searchParams.get('date');
    if (fromDate) return fromDate;
    const openedFromCharts = searchParams.get('from') === 'charts';
    if (openedFromCharts) return todayString();
    return stateVisitDate ?? todayString();
  });
  const chartVisitDate = stateVisitDate;
  const [keyword, setKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState(() => searchParams.get('dept') ?? '');
  const [physicianFilter, setPhysicianFilter] = useState(() => searchParams.get('phys') ?? '');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(() => normalizePaymentMode(searchParams.get('pay')));
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const fromUrl = searchParams.get('sort');
    return isSortKey(fromUrl) ? fromUrl : 'time';
  });
  const [activeStatusTab, setActiveStatusTab] = useState<ReceptionStatus>(() =>
    resolveInitialStatusTab(searchParams.get('section')),
  );
  const [filtersCollapsed, setFiltersCollapsed] = useState(() =>
    loadCollapsedPanel(FILTER_PANEL_COLLAPSE_KEY, true),
  );
  const landingSection = searchParams.get('section') ?? undefined;
  const landingCreate = searchParams.get('create') === '1';
  const landingHandledRef = useRef<string | null>(null);
  const statusTabManualSelectionRef = useRef(false);
  const statusTabAutoAdjustedRef = useRef(false);
  const [acceptWorkflowModalOpen, setAcceptWorkflowModalOpen] = useState(false);

  useEffect(() => {
    if (!landingSection && !landingCreate) return;
    const signature = `${landingSection ?? ''}|${landingCreate ? '1' : '0'}`;
    if (landingHandledRef.current === signature) return;
    landingHandledRef.current = signature;

    if (landingSection === 'filters') {
      setFiltersCollapsed(false);
      window.setTimeout(() => {
        const el = document.getElementById('reception-search-keyword');
        if (el instanceof HTMLInputElement) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 0);
      return;
    }
    if (landingSection === 'appointment') {
      setActiveStatusTab('予約');
      return;
    }
    if (landingSection === 'billing') {
      setActiveStatusTab('会計待ち');
      return;
    }
    if (landingSection === 'accept' || landingCreate) {
      setAcceptWorkflowModalOpen(true);
      setDailyCalendarOpen(false);
      window.setTimeout(() => {
        const el = document.getElementById('reception-patient-search-patient-id');
        if (el instanceof HTMLInputElement) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 0);
    }
  }, [landingCreate, landingSection, setFiltersCollapsed]);
  const [exceptionsModalOpen, setExceptionsModalOpen] = useState(false);
  const [recordsModalPatient, setRecordsModalPatient] = useState<{ patientId: string; name?: string } | null>(null);
  const [missingMasterNote, setMissingMasterNote] = useState('');
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const appliedMeta = useRef<Partial<AuthServiceFlags>>({});
  const lastAuditEventHash = useRef<string | undefined>(undefined);
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<{ tone: 'info' | 'warning'; message: string } | null>(null);
  const [selectionLost, setSelectionLost] = useState(false);
  const lastSidepaneAuditKey = useRef<string | null>(null);
  const lastExceptionAuditKey = useRef<string | null>(null);
  const lastAppointmentUpdatedAt = useRef<number | null>(null);
  const [savedViews, setSavedViews] = useState<OutpatientSavedView[]>(() => loadOutpatientSavedViews());
  const [savedViewName, setSavedViewName] = useState('');
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const lastUnlinkedToastKey = useRef<string | null>(null);
  const lastSelectionNoticeToastKey = useRef<string | null>(null);
  const [acceptPatientId, setAcceptPatientId] = useState(() => patientId ?? '');
  const [patientSearchPatientId, setPatientSearchPatientId] = useState(() => patientId ?? '');
  const [acceptPaymentMode, setAcceptPaymentMode] = useState<'insurance' | 'self' | ''>('');
  const [acceptVisitKind, setAcceptVisitKind] = useState('');
  const [acceptMedicalInformationCode, setAcceptMedicalInformationCode] = useState('');
  const [acceptDurationMs, setAcceptDurationMs] = useState<number | null>(null);
  const [masterSearchFilters, setMasterSearchFilters] = useState({
    name: '',
    kana: '',
    birthStartDate: '',
    birthEndDate: '',
    sex: '',
    inOut: '',
  });
  const [masterSearchResults, setMasterSearchResults] = useState<PatientMasterRecord[]>([]);
  const [masterSearchMeta, setMasterSearchMeta] = useState<PatientMasterSearchResponse | null>(null);
  const [masterSearchNotice, setMasterSearchNotice] = useState<{ tone: 'info' | 'warning' | 'error'; message: string; detail?: string } | null>(
    null,
  );
  const [masterSearchError, setMasterSearchError] = useState<string | null>(null);
  const [masterSelected, setMasterSelected] = useState<PatientMasterRecord | null>(null);

  const [patientSearchNameSei, setPatientSearchNameSei] = useState('');
  const [patientSearchNameMei, setPatientSearchNameMei] = useState('');
  const [patientSearchKanaSei, setPatientSearchKanaSei] = useState('');
  const [patientSearchKanaMei, setPatientSearchKanaMei] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState<PatientRecord[]>([]);
  const [patientSearchMeta, setPatientSearchMeta] = useState<PatientListResponse | null>(null);
  const [patientSearchError, setPatientSearchError] = useState<string | null>(null);
  const [patientSearchSelected, setPatientSearchSelected] = useState<PatientRecord | null>(null);
  const [patientSearchPage, setPatientSearchPage] = useState(1);
  const patientSearchFilterRef = useRef<{
    patientId: string;
    nameSei: string;
    nameMei: string;
    kanaSei: string;
    kanaMei: string;
  } | null>(null);

  const lastAcceptAutoFill = useRef<{
    patientId?: string;
    paymentMode?: 'insurance' | 'self' | '';
    departmentCode?: string;
    physicianCode?: string;
  }>({});
  const lastAcceptAutoFillSignature = useRef<string | null>(null);
  const [acceptErrors, setAcceptErrors] = useState<{
    patientId?: string;
    paymentMode?: string;
    visitKind?: string;
    department?: string;
    physician?: string;
  }>({});
  const [acceptDepartmentSelection, setAcceptDepartmentSelection] = useState('');
  const [acceptPhysicianSelection, setAcceptPhysicianSelection] = useState('');
  const [acceptResult, setAcceptResult] = useState<{
    tone: 'success' | 'warning' | 'error' | 'info';
    message: string;
    detail?: string;
    runId?: string;
    apiResult?: string;
  } | null>(null);
  const [manualAcceptConfirmedKey, setManualAcceptConfirmedKey] = useState<string | null>(null);
  const [cancelConfirmState, setCancelConfirmState] = useState<{
    entry: ReceptionEntry;
    source: 'selection' | 'card' | 'table';
    reason: string;
  } | null>(null);
  const [retryingPatientId, setRetryingPatientId] = useState<string | null>(null);
  const [claimSendingPatientId, setClaimSendingPatientId] = useState<string | null>(null);
  const [dailyStateRevision, setDailyStateRevision] = useState(0);
  const [openCardActionMenuKey, setOpenCardActionMenuKey] = useState<string | null>(null);
  const [receptionRealtimeStatus, setReceptionRealtimeStatus] =
    useState<ReceptionRealtimeConnectionStatus>('connecting');
  const [acceptedChartsHandoff, setAcceptedChartsHandoff] = useState<ResolvedReceptionHandoff | null>(null);
  const [pendingAcceptedChartsHandoff, setPendingAcceptedChartsHandoff] = useState<PendingReceptionHandoff | null>(null);
  const selectedDateRef = useRef(selectedDate);
  const storageScopeRef = useRef(storageScope);

  const isSystemAdmin = isSystemAdminRole(session.role);
  const debugUiEnabled = (import.meta.env.DEV && searchParams.get('debug') === '1') || isSystemAdmin;

  const [statusListLayout, setStatusListLayout] = useState<StatusListLayout>(() => {
    const fromQuery = searchParams.get('receptionList');
    if (isStatusListLayout(fromQuery)) return fromQuery;
    return loadStatusListLayout();
  });

  const claimQueryKey = ['outpatient-claim-flags'];
  const claimQuery = useQuery({
    queryKey: claimQueryKey,
    queryFn: (context) => fetchClaimFlags(context),
    enabled: claimOutpatientEnabled,
    refetchInterval: claimOutpatientEnabled ? OUTPATIENT_AUTO_REFRESH_INTERVAL_MS : false,
    staleTime: claimOutpatientEnabled ? OUTPATIENT_AUTO_REFRESH_INTERVAL_MS : Infinity,
    refetchOnWindowFocus: false,
    meta: {
      servedFromCache: !!queryClient.getQueryState(claimQueryKey)?.dataUpdatedAt,
      retryCount: queryClient.getQueryState(claimQueryKey)?.fetchFailureCount ?? 0,
    },
  });
  const refetchClaim = claimQuery.refetch;

  const orcaQueueQueryKey = useMemo(
    () => [...ORCA_QUEUE_QUERY_KEY, isSystemAdmin ? 'system-admin' : 'non-admin'] as const,
    [isSystemAdmin],
  );
  const orcaQueueQuery = useQuery({
    queryKey: orcaQueueQueryKey,
    queryFn: () => fetchOrcaQueue(undefined, { enabled: isSystemAdmin }),
    enabled: isSystemAdmin,
    refetchInterval: isSystemAdmin ? ORCA_QUEUE_REFRESH_INTERVAL_MS : false,
    staleTime: isSystemAdmin ? ORCA_QUEUE_REFRESH_INTERVAL_MS : Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
    meta: {
      servedFromCache: !!queryClient.getQueryState(orcaQueueQueryKey)?.dataUpdatedAt,
      retryCount: queryClient.getQueryState(orcaQueueQueryKey)?.fetchFailureCount ?? 0,
    },
  });

  const appointmentQueryKey = ['outpatient-appointments', selectedDate, submittedKeyword, departmentFilter, physicianFilter];
  const appointmentQuery = useQuery({
    queryKey: appointmentQueryKey,
    queryFn: (context) =>
      fetchAppointmentOutpatients(
        {
          date: selectedDate,
          keyword: submittedKeyword,
          departmentCode: departmentFilter || undefined,
          physicianCode: physicianFilter || undefined,
        },
        context,
      ),
    refetchOnWindowFocus: false,
    refetchInterval: OUTPATIENT_AUTO_REFRESH_INTERVAL_MS,
    staleTime: OUTPATIENT_AUTO_REFRESH_INTERVAL_MS,
    meta: {
      servedFromCache: !!queryClient.getQueryState(appointmentQueryKey)?.dataUpdatedAt,
      retryCount: queryClient.getQueryState(appointmentQueryKey)?.fetchFailureCount ?? 0,
    },
  });
  const refetchAppointment = appointmentQuery.refetch;

  const appointmentAutoRefreshNotice = useAutoRefreshNotice({
    subject: '受付一覧',
    dataUpdatedAt: appointmentQuery.dataUpdatedAt,
    isFetching: appointmentQuery.isFetching,
    isError: appointmentQuery.isError,
    intervalMs: OUTPATIENT_AUTO_REFRESH_INTERVAL_MS,
  });
  const appointmentUpdatedAtLabel = useMemo(() => {
    if (!appointmentQuery.dataUpdatedAt) return '—';
    return formatAutoRefreshTimestamp(appointmentQuery.dataUpdatedAt);
  }, [appointmentQuery.dataUpdatedAt]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    storageScopeRef.current = storageScope;
  }, [storageScope]);

  const handleReceptionRealtimeEvent = useCallback(
    (event: ReceptionRealtimeEvent) => {
      if (event.facilityId && event.facilityId !== session.facilityId) return;
      const eventType = event.type ?? 'reception.updated';
      if (eventType !== 'reception.updated' && eventType !== 'reception.replay-gap') {
        return;
      }
      const activeDate = selectedDateRef.current;
      const eventDate = event.date?.trim();
      const shouldRefreshAppointment = !eventDate || !activeDate || eventDate === activeDate;

      if (eventType === 'reception.updated' && eventDate) {
        clearReceptionStatusOverridesForDate({
          date: eventDate,
          patientId: event.patientId,
          scope: storageScopeRef.current,
        });
        setDailyStateRevision((prev) => prev + 1);
      }

      if (shouldRefreshAppointment || eventType === 'reception.replay-gap') {
        void queryClient.invalidateQueries({ queryKey: ['outpatient-appointments'] }).catch(() => undefined);
      }
      void queryClient.invalidateQueries({ queryKey: ORCA_QUEUE_QUERY_KEY }).catch(() => undefined);
    },
    [queryClient, session.facilityId],
  );

  useEffect(() => {
    const stopStream = startReceptionRealtimeStream({
      onStatusChange: setReceptionRealtimeStatus,
      onMessage: handleReceptionRealtimeEvent,
      onError: () => {
        setReceptionRealtimeStatus('reconnecting');
      },
    });
    return () => {
      stopStream();
    };
  }, [handleReceptionRealtimeEvent]);

  useEffect(() => {
    if (!broadcast?.updatedAt) return;
    if (claimOutpatientEnabled) {
      void refetchClaim();
    }
    void refetchAppointment();
  }, [broadcast?.updatedAt, claimOutpatientEnabled, refetchAppointment, refetchClaim]);

  const appointmentErrorContext = useMemo(() => {
    const httpStatus = appointmentQuery.data?.httpStatus;
    const hasHttpError = typeof httpStatus === 'number' && (httpStatus === 0 || httpStatus >= 400);
    const error = appointmentQuery.isError ? appointmentQuery.error : hasHttpError ? `status ${httpStatus}` : undefined;
    if (!error && !hasHttpError) return null;
    return {
      error,
      httpStatus,
      apiResult: appointmentQuery.data?.apiResult,
      apiResultMessage: appointmentQuery.data?.apiResultMessage,
    };
  }, [
    appointmentQuery.data?.apiResult,
    appointmentQuery.data?.apiResultMessage,
    appointmentQuery.data?.httpStatus,
    appointmentQuery.error,
    appointmentQuery.isError,
  ]);

  useEffect(() => {
    persistCollapsedPanel(FILTER_PANEL_COLLAPSE_KEY, filtersCollapsed);
  }, [filtersCollapsed]);

  useEffect(() => {
    persistStatusListLayout(statusListLayout);
  }, [statusListLayout]);

  useEffect(() => {
    const fromQuery = searchParams.get('receptionList');
    if (!isStatusListLayout(fromQuery)) return;
    setStatusListLayout(fromQuery);
  }, [searchParams]);

  useEffect(() => {
    if (!openCardActionMenuKey) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-card-actions-menu-root="true"]')) {
        return;
      }
      setOpenCardActionMenuKey(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenCardActionMenuKey(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openCardActionMenuKey]);

  useEffect(() => {
    type RestoredFilters = {
      dept?: string;
      phys?: string;
      pay?: string;
      sort?: string;
      date?: string;
    };
    const stored = (() => {
      if (typeof localStorage === 'undefined') return null;
      try {
        const raw = localStorage.getItem(FILTER_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return {
          dept: typeof parsed.dept === 'string' ? parsed.dept : undefined,
          phys: typeof parsed.phys === 'string' ? parsed.phys : undefined,
          pay: typeof parsed.pay === 'string' ? parsed.pay : undefined,
          sort: typeof parsed.sort === 'string' ? parsed.sort : undefined,
          date: typeof parsed.date === 'string' ? parsed.date : undefined,
        } satisfies RestoredFilters;
      } catch {
        return null;
      }
    })();
    const openedFromCharts = searchParams.get('from') === 'charts';
    const fromUrl: RestoredFilters = {
      dept: searchParams.get('dept') ?? undefined,
      phys: searchParams.get('phys') ?? undefined,
      pay: searchParams.get('pay') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      date: searchParams.get('date') ?? undefined,
    };
    const storedEffective: RestoredFilters = { ...(stored ?? {}) };
    if (openedFromCharts && !fromUrl.date) {
      delete storedEffective.date;
    }
    const merged: RestoredFilters = {
      ...storedEffective,
      ...(fromUrl.dept !== undefined ? { dept: fromUrl.dept } : {}),
      ...(fromUrl.phys !== undefined ? { phys: fromUrl.phys } : {}),
      ...(fromUrl.pay !== undefined ? { pay: fromUrl.pay } : {}),
      ...(fromUrl.sort !== undefined ? { sort: fromUrl.sort } : {}),
      ...(fromUrl.date !== undefined ? { date: fromUrl.date } : {}),
    };
    if (stateKeyword) {
      setKeyword(stateKeyword);
      setSubmittedKeyword(stateKeyword);
    }
    if (merged.dept !== undefined) setDepartmentFilter(merged.dept);
    if (merged.phys !== undefined) setPhysicianFilter(merged.phys);
    if (merged.pay !== undefined) setPaymentMode(normalizePaymentMode(merged.pay));
    if (merged.sort !== undefined && isSortKey(merged.sort)) setSortKey(merged.sort);
    if (merged.date !== undefined) {
      setSelectedDate(merged.date);
    } else if (!openedFromCharts && stateVisitDate) {
      setSelectedDate(stateVisitDate);
    }
  }, [searchParams, stateKeyword, stateVisitDate]);

  const visitMutation = useMutation<VisitMutationPayload, Error, VisitMutationParams>({
    mutationFn: (params) => mutateVisit(params),
  });
  const patientSearchMutation = useMutation<PatientListResponse, Error, { keyword: string }>({
    mutationFn: (params) => searchLocalPatients({ keyword: params.keyword }),
    onSuccess: (result) => {
      const normalizeToken = (value: string) => value.replace(/\s+/g, '').trim();
      const filters = patientSearchFilterRef.current;
      const basePatients = result.patients ?? [];
      const filteredPatients =
        filters
          ? basePatients.filter((patient) => {
              const patientId = (patient.patientId ?? '').trim();
              const fullName = normalizeToken(patient.name ?? '');
              const fullKana = normalizeToken(patient.kana ?? '');
              const needlePatientId = filters.patientId.trim();
              const needleNameSei = normalizeToken(filters.nameSei);
              const needleNameMei = normalizeToken(filters.nameMei);
              const needleKanaSei = normalizeToken(filters.kanaSei);
              const needleKanaMei = normalizeToken(filters.kanaMei);

              if (needlePatientId && !patientId.startsWith(needlePatientId)) return false;
              if (needleNameSei && !fullName.includes(needleNameSei)) return false;
              if (needleNameMei && !fullName.includes(needleNameMei)) return false;
              if (needleKanaSei && !fullKana.includes(needleKanaSei)) return false;
              if (needleKanaMei && !fullKana.includes(needleKanaMei)) return false;
              return true;
            })
          : basePatients;

      setPatientSearchResults(filteredPatients);
      setPatientSearchMeta({
        ...result,
        recordsReturned: filteredPatients.length,
      });
      setPatientSearchPage(1);
      setPatientSearchError(null);
    },
    onError: (error) => {
      const detail = error instanceof Error ? error.message : String(error);
      setPatientSearchError(detail);
    },
  });
  const masterSearchMutation = useMutation<PatientMasterSearchResponse, Error, Parameters<typeof fetchPatientMasterSearch>[0]>({
    mutationFn: (params) => fetchPatientMasterSearch(params),
    onSuccess: (result) => {
      setMasterSearchResults(result.patients);
      setMasterSearchMeta(result);
      setMasterSearchNotice({
        tone: result.ok ? 'info' : 'warning',
        message: result.ok ? '患者マスタ検索が完了しました。' : '患者マスタ検索で警告が返却されました。',
        detail: result.apiResultMessage ?? result.error,
      });
      setMasterSelected(null);
      setMasterSearchError(null);
    },
    onError: (error) => {
      const detail = error instanceof Error ? error.message : String(error);
      setMasterSearchNotice({ tone: 'error', message: '患者マスタ検索に失敗しました。', detail });
    },
  });

  const applyMutationResultToList = useCallback(
    (payload: VisitMutationPayload, params: VisitMutationParams) => {
      let nextEntriesSnapshot: ReceptionEntry[] = [];
      let createdEntryKey: string | null = null;
      queryClient.setQueryData<AppointmentPayload>(appointmentQueryKey, (previous) => {
        const base: AppointmentPayload =
          previous ??
          ({
            entries: [],
            raw: {},
            recordsReturned: 0,
            runId: payload.runId,
            cacheHit: payload.cacheHit,
            missingMaster: payload.missingMaster,
            dataSourceTransition: payload.dataSourceTransition ?? 'snapshot',
            fetchedAt: new Date().toISOString(),
          } as AppointmentPayload);
        const baseEntries = base.entries ?? [];
        if (params.requestNumber === '02') {
          const filtered = baseEntries.filter((entry) => {
            if (payload.acceptanceId && entry.receptionId === payload.acceptanceId) return false;
            const targetPatient = payload.patient?.patientId ?? params.patientId;
            if (targetPatient && entry.patientId === targetPatient) return false;
            return true;
          });
          return {
            ...base,
            entries: filtered,
            recordsReturned: filtered.length,
            apiResult: payload.apiResult ?? base.apiResult,
            apiResultMessage: payload.apiResultMessage ?? base.apiResultMessage,
          };
        }
        const nextEntry = buildVisitEntryFromMutation(payload, { paymentMode: params.paymentMode });
        if (!nextEntry) {
          nextEntriesSnapshot = baseEntries;
          return base;
        }
        createdEntryKey = entryKey(nextEntry);
        const deduped = baseEntries.filter((entry) => {
          if (entry.encounterKey && nextEntry.encounterKey && entry.encounterKey === nextEntry.encounterKey) return false;
          if (entry.scheduleKey && nextEntry.scheduleKey && entry.scheduleKey === nextEntry.scheduleKey) return false;
          if (entry.receptionId && nextEntry.receptionId && entry.receptionId === nextEntry.receptionId) return false;
          if (entry.id && nextEntry.id && entry.id === nextEntry.id) return false;
          return true;
        });
        const nextEntries = [nextEntry, ...deduped];
        nextEntriesSnapshot = nextEntries;
        return {
          ...base,
          entries: nextEntries,
          recordsReturned: nextEntries.length,
          apiResult: payload.apiResult ?? base.apiResult,
          apiResultMessage: payload.apiResultMessage ?? base.apiResultMessage,
        };
      });
      if (params.requestNumber === '02') {
        setAcceptedChartsHandoff((previous) =>
          previous?.encounter.patientId === (payload.patient?.patientId ?? params.patientId) ? null : previous,
        );
        setPendingAcceptedChartsHandoff((previous) =>
          previous?.patientId === (payload.patient?.patientId ?? params.patientId) ? null : previous,
        );
      } else {
        const mutationHandoff = resolveAcceptMutationHandoff(payload, params);
        if (mutationHandoff) {
          setAcceptedChartsHandoff(mutationHandoff);
          setPendingAcceptedChartsHandoff(null);
        } else {
          const pendingHandoff = buildPendingAcceptHandoff(payload, params);
          const refreshedEntryHandoff = resolvePendingAcceptHandoffFromEntries(nextEntriesSnapshot, pendingHandoff);
          setAcceptedChartsHandoff(refreshedEntryHandoff);
          setPendingAcceptedChartsHandoff(refreshedEntryHandoff ? null : pendingHandoff);
        }
      }
      if (createdEntryKey) {
        setSelectedEntryKey(createdEntryKey);
      }
    },
    [appointmentQueryKey, queryClient],
  );

  const intent = searchParams.get('intent') as 'appointment_change' | 'appointment_cancel' | null;
  const intentKeyword = stateKeyword;
  const intentParam = intent ?? '';
  const intentBanner = useMemo(() => {
    if (!intent) return null;
    if (intent === 'appointment_cancel') {
      return {
        tone: 'warning' as const,
        message: 'Charts から「予約キャンセル」導線で開きました。対象患者/予約を確認してから操作してください。',
        nextAction: '予約キャンセル確認',
      };
    }
    return {
      tone: 'info' as const,
      message: 'Charts から「予約変更」導線で開きました。対象患者/予約を確認してから操作してください。',
      nextAction: '予約変更',
    };
  }, [intent]);

  useEffect(() => {
    // Canonicalize filter params while preserving only the navigation contract keys + allowlisted external flags.
    const params = new URLSearchParams();
    const setOrDelete = (key: string, value?: string) => {
      if (value && value.trim()) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    };
    setOrDelete('dept', departmentFilter);
    setOrDelete('phys', physicianFilter);
    if (paymentMode !== 'all') {
      params.set('pay', paymentMode);
    }
    setOrDelete('sort', sortKey);
    setOrDelete('date', selectedDate);
    setOrDelete('intent', intentParam);
    const from = searchParams.get('from');
    if (from) params.set('from', from);
    const runIdFromUrl = searchParams.get('runId');
    if (runIdFromUrl) params.set('runId', runIdFromUrl);
    const section = searchParams.get('section');
    if (section) params.set('section', section);
    const create = searchParams.get('create');
    if (create === '1') params.set('create', '1');
    const returnTo = searchParams.get('returnTo');
    if (isSafeReturnTo(returnTo, session.facilityId)) params.set('returnTo', returnTo as string);
    applyExternalParams(params, pickExternalParams(searchParams));
    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      setSearchParams(params, { replace: true });
    }
    if (typeof localStorage !== 'undefined') {
      const snapshot = {
        dept: departmentFilter,
        phys: physicianFilter,
        pay: paymentMode,
        date: selectedDate,
      };
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(snapshot));
    }
  }, [
    departmentFilter,
    intentParam,
    physicianFilter,
    paymentMode,
    searchParams,
    selectedDate,
    setSearchParams,
    sortKey,
    session.facilityId,
  ]);

  const mergedMeta = useMemo(() => {
    const claim = claimOutpatientEnabled ? claimQuery.data : undefined;
    const appointment = appointmentQuery.data;
    const run = claim?.runId ?? appointment?.runId ?? initialRunId ?? flags.runId;
    const missing = claim?.missingMaster ?? appointment?.missingMaster ?? flags.missingMaster;
    const cache = claim?.cacheHit ?? appointment?.cacheHit ?? flags.cacheHit;
    const transition = claim?.dataSourceTransition ?? appointment?.dataSourceTransition ?? flags.dataSourceTransition;
    const fallbackUsed = claim?.fallbackUsed ?? appointment?.fallbackUsed ?? flags.fallbackUsed;
    return {
      runId: run,
      missingMaster: missing,
      cacheHit: cache,
      dataSourceTransition: transition,
      fallbackUsed,
      fetchedAt: appointment?.fetchedAt ?? claim?.fetchedAt,
    };
  }, [
    appointmentQuery.data,
    claimOutpatientEnabled,
    claimQuery.data,
    flags.cacheHit,
    flags.dataSourceTransition,
    flags.fallbackUsed,
    flags.missingMaster,
    flags.runId,
    initialRunId,
  ]);
  const resolvedRunId = resolveRunId(mergedMeta.runId ?? initialRunId ?? flags.runId);
  const infoLive = resolveAriaLive('info');
  const metaDataSourceTransition = mergedMeta.dataSourceTransition ?? 'snapshot';
  const metaMissingMaster = mergedMeta.missingMaster ?? true;
  const metaCacheHit = mergedMeta.cacheHit ?? false;

  useEffect(() => {
    document.title = `既存患者受付 | 施設ID=${session.facilityId ?? 'unknown'}`;
  }, [session.facilityId]);

  useEffect(() => {
    const { runId, cacheHit, missingMaster, dataSourceTransition, fallbackUsed } = mergedMeta;
    appliedMeta.current = applyAuthServicePatch(
      { runId, cacheHit, missingMaster, dataSourceTransition, fallbackUsed },
      appliedMeta.current,
      { bumpRunId, setCacheHit, setMissingMaster, setDataSourceTransition, setFallbackUsed },
    );
  }, [bumpRunId, mergedMeta, setCacheHit, setDataSourceTransition, setFallbackUsed, setMissingMaster]);

  useEffect(() => {
    if (!claimOutpatientEnabled) return;
    const apiAudit = claimQuery.data?.auditEvent as Record<string, unknown> | undefined;
    const serialized = apiAudit ? JSON.stringify(apiAudit) : undefined;
    if (serialized && serialized !== lastAuditEventHash.current) {
      lastAuditEventHash.current = serialized;
      const noteFromApi = typeof (apiAudit as Record<string, unknown>)?.missingMasterNote === 'string'
        ? String((apiAudit as Record<string, unknown>).missingMasterNote)
        : typeof (apiAudit as Record<string, unknown>)?.note === 'string'
          ? String((apiAudit as Record<string, unknown>).note)
          : undefined;
      if (noteFromApi) {
        setMissingMasterNote(noteFromApi);
      }
      logAuditEvent({
        runId: mergedMeta.runId,
        source: 'claim-flags',
        cacheHit: mergedMeta.cacheHit,
        missingMaster: mergedMeta.missingMaster,
        dataSourceTransition: mergedMeta.dataSourceTransition,
        payload: apiAudit,
      });
    }
  }, [
    claimOutpatientEnabled,
    claimQuery.data?.auditEvent,
    mergedMeta.cacheHit,
    mergedMeta.dataSourceTransition,
    mergedMeta.missingMaster,
    mergedMeta.runId,
  ]);

  const liveAppointmentEntries = appointmentQuery.data?.entries ?? [];
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const isSelectedDateToday = useMemo(() => selectedDate === todayString(), [selectedDate]);
  const reservationTimeByPatientId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of liveAppointmentEntries) {
      const patientIdKey = entry.patientId?.trim();
      if (!patientIdKey) continue;
      const reservationTime = normalizeTimeLabel(entry.reservationTime ?? (entry.status === '予約' ? entry.appointmentTime : undefined));
      if (!reservationTime) continue;
      const existing = map.get(patientIdKey);
      if (!existing || reservationTime < existing) {
        map.set(patientIdKey, reservationTime);
      }
    }
    return map;
  }, [liveAppointmentEntries]);
  const normalizedLiveEntries = useMemo(() => {
    return liveAppointmentEntries.map((entry) => {
      const patientIdKey = entry.patientId?.trim() ?? '';
      const normalizedReservationTime =
        entry.reservationTime ??
        (patientIdKey ? reservationTimeByPatientId.get(patientIdKey) : undefined);
      const normalizedAcceptanceTime =
        entry.acceptanceTime ?? (entry.source === 'visits' ? entry.appointmentTime : undefined);
      if (
        normalizedReservationTime === entry.reservationTime &&
        normalizedAcceptanceTime === entry.acceptanceTime
      ) {
        return entry;
      }
      return {
        ...entry,
        reservationTime: normalizedReservationTime,
        acceptanceTime: normalizedAcceptanceTime,
      };
    });
  }, [liveAppointmentEntries, reservationTimeByPatientId]);

  useEffect(() => {
    if (!selectedDate) return;
    if (!appointmentQuery.dataUpdatedAt) return;
    if (appointmentQuery.isError) return;
    const outcome = appointmentQuery.data?.outcome;
    if (outcome === 'error') return;
    const httpStatus = appointmentQuery.data?.httpStatus;
    if (typeof httpStatus === 'number' && (httpStatus === 0 || httpStatus >= 400)) return;
    if (normalizedLiveEntries.length > 0) return;

    saveReceptionEntriesForDate({
      date: selectedDate,
      entries: [],
      scope: storageScope,
    });
    setDailyStateRevision((prev) => prev + 1);
  }, [
    appointmentQuery.data?.httpStatus,
    appointmentQuery.data?.outcome,
    appointmentQuery.dataUpdatedAt,
    appointmentQuery.isError,
    normalizedLiveEntries.length,
    selectedDate,
    storageScope,
  ]);
  const dailyEntriesState = useMemo(
    () =>
      resolveReceptionEntriesForDate({
        date: selectedDate,
        incomingEntries: normalizedLiveEntries,
        scope: storageScope,
      }),
    [dailyStateRevision, normalizedLiveEntries, selectedDate, storageScope],
  );
  const effectiveDailyEntriesState = useMemo(() => {
    if (dailyEntriesState.source !== 'snapshot') return dailyEntriesState;
    const outcome = appointmentQuery.data?.outcome;
    const httpStatus = appointmentQuery.data?.httpStatus;
    const hasHttpError = typeof httpStatus === 'number' && (httpStatus === 0 || httpStatus >= 400);
    const liveSucceeded =
      !appointmentQuery.isLoading &&
      !appointmentQuery.isFetching &&
      !appointmentQuery.isError &&
      !hasHttpError &&
      outcome !== 'error';
    if (liveSucceeded && normalizedLiveEntries.length === 0) {
      return {
        ...dailyEntriesState,
        entries: [],
        source: 'live' as const,
      };
    }
    return dailyEntriesState;
  }, [
    appointmentQuery.data?.httpStatus,
    appointmentQuery.data?.outcome,
    appointmentQuery.isError,
    appointmentQuery.isFetching,
    appointmentQuery.isLoading,
    dailyEntriesState,
    normalizedLiveEntries.length,
  ]);
  const appointmentEntries = effectiveDailyEntriesState.entries;
  const visibleAppointmentEntries = useMemo(
    () => appointmentEntries,
    [appointmentEntries],
  );
  const snapshotDateOptions = useMemo(() => {
    const fromState = effectiveDailyEntriesState.availableDates ?? [];
    if (fromState.length > 0) return fromState.slice(0, 30);
    return listReceptionSnapshotDates(storageScope, 30);
  }, [dailyEntriesState.availableDates, storageScope]);
  const dailyCalendarAvailableDates = useMemo(() => {
    const enabled = new Set(snapshotDateOptions);
    if (selectedDate) enabled.add(selectedDate);
    return enabled;
  }, [selectedDate, snapshotDateOptions]);
  const dailyCalendarRootRef = useRef<HTMLDivElement | null>(null);
  const [dailyCalendarOpen, setDailyCalendarOpen] = useState(false);
  const [dailyCalendarMonthStart, setDailyCalendarMonthStart] = useState(() => startOfUtcMonth(selectedDate));
  const dailyCalendarCells = useMemo(
    () => buildDailyCalendarCells(dailyCalendarMonthStart),
    [dailyCalendarMonthStart],
  );
  const dailyCalendarMonthLabel = useMemo(() => {
    const parsed = parseYmd(dailyCalendarMonthStart);
    if (!parsed) return dailyCalendarMonthStart;
    return `${parsed.year}年${parsed.month}月`;
  }, [dailyCalendarMonthStart]);
  const toggleDailyCalendar = useCallback(() => {
    setDailyCalendarOpen((prev) => {
      const next = !prev;
      if (next) {
        setAcceptWorkflowModalOpen(false);
        setDailyCalendarMonthStart(startOfUtcMonth(selectedDate));
      }
      return next;
    });
  }, [selectedDate]);
  useEffect(() => {
    if (!dailyCalendarOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const root = dailyCalendarRootRef.current;
      const target = event.target;
      if (!root || !(target instanceof Node)) return;
      if (root.contains(target)) return;
      setDailyCalendarOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDailyCalendarOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [dailyCalendarOpen]);
  useEffect(() => {
    if (!acceptWorkflowModalOpen) return;
    setDailyCalendarOpen(false);
  }, [acceptWorkflowModalOpen]);
  useEffect(() => {
    if (!acceptWorkflowModalOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAcceptWorkflowModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [acceptWorkflowModalOpen]);
  const departmentLabelMap = useMemo(() => {
    const raw = appointmentQuery.data?.raw as Record<string, unknown> | undefined;
    const map = new Map<string, string>();
    if (!raw) return map;
    const collect = (items?: unknown) => {
      if (!Array.isArray(items)) return;
      items.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const record = item as Record<string, unknown>;
        const name =
          (record.departmentName as string | undefined) ??
          (record.Department_WholeName as string | undefined) ??
          (record.department_name as string | undefined);
        const code =
          (record.departmentCode as string | undefined) ??
          (record.Department_Code as string | undefined) ??
          (record.department_code as string | undefined);
        const normalizedCode = code?.trim();
        if (!normalizedCode) return;
        map.set(normalizedCode, resolveEntryDisplayLabel(normalizedCode, name));
      });
    };
    const rawRecord = raw as Record<string, unknown>;
    collect(rawRecord.slots);
    collect(rawRecord.reservations);
    collect(rawRecord.visits);
    return map;
  }, [appointmentQuery.data?.raw]);
  const physicianNameMap = useMemo(() => {
    const raw = appointmentQuery.data?.raw as Record<string, unknown> | undefined;
    const map: PhysicianNameMap = {};
    if (!raw) return map;
    const collect = (items?: unknown) => {
      if (!Array.isArray(items)) return;
      items.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const record = item as Record<string, unknown>;
        const code =
          (record.physicianCode as string | undefined) ??
          (record.Physician_Code as string | undefined) ??
          (record.physician_code as string | undefined);
        const name =
          (record.physicianName as string | undefined) ??
          (record.Physician_WholeName as string | undefined) ??
          (record.physician_name as string | undefined);
        if (code && name) {
          map[code] = name;
        }
      });
    };
    const rawRecord = raw as Record<string, unknown>;
    collect(rawRecord.slots);
    collect(rawRecord.reservations);
    collect(rawRecord.visits);
    return map;
  }, [appointmentQuery.data?.raw]);
  const uniqueDepartments = useMemo(
    () => Array.from(new Set(visibleAppointmentEntries.map((entry) => entry.department).filter(Boolean))) as string[],
    [visibleAppointmentEntries],
  );
  const uniquePhysicians = useMemo(
    () => Array.from(new Set(visibleAppointmentEntries.map((entry) => entry.physician).filter(Boolean))) as string[],
    [visibleAppointmentEntries],
  );
  const medicalInformationOptionsQuery = useQuery({
    queryKey: ['orca-medical-information-options'],
    queryFn: fetchMedicalInformationOptions,
    staleTime: 300_000,
  });
  const medicalInformationOptions = useMemo(
    () =>
      (medicalInformationOptionsQuery.data ?? []).filter(
        (option): option is MedicalInformationOption => Boolean(option?.code?.trim()),
      ),
    [medicalInformationOptionsQuery.data],
  );
  const departmentOptions = useMemo(() => {
    return buildDepartmentOptions({
      departmentLabels: departmentLabelMap,
      visibleEntries: visibleAppointmentEntries,
      selectedDepartmentCode: acceptDepartmentSelection,
    });
  }, [acceptDepartmentSelection, departmentLabelMap, visibleAppointmentEntries]);
  const rawFilteredEntries = useMemo(
    () => filterEntries(visibleAppointmentEntries, keyword, departmentFilter, physicianFilter, paymentMode),
    [departmentFilter, keyword, paymentMode, physicianFilter, visibleAppointmentEntries],
  );
  const rawSortedEntries = useMemo(() => sortEntries(rawFilteredEntries, sortKey), [rawFilteredEntries, sortKey]);
  useEffect(() => {
    if (!pendingAcceptedChartsHandoff) return;
    const resolved = resolvePendingAcceptHandoffFromEntries(visibleAppointmentEntries, pendingAcceptedChartsHandoff);
    if (!resolved) return;
    setAcceptedChartsHandoff(resolved);
    setPendingAcceptedChartsHandoff(null);
  }, [pendingAcceptedChartsHandoff, visibleAppointmentEntries]);
  const patientSearchTotalPages = useMemo(() => {
    const pages = Math.ceil(patientSearchResults.length / PATIENT_SEARCH_PAGE_SIZE);
    return Math.max(1, pages);
  }, [patientSearchResults.length]);
  const pagedPatientSearchResults = useMemo(() => {
    const startIndex = (patientSearchPage - 1) * PATIENT_SEARCH_PAGE_SIZE;
    return patientSearchResults.slice(startIndex, startIndex + PATIENT_SEARCH_PAGE_SIZE);
  }, [patientSearchPage, patientSearchResults]);
  const patientSearchRangeLabel = useMemo(() => {
    if (patientSearchResults.length === 0) return '0 / 0件';
    const startIndex = (patientSearchPage - 1) * PATIENT_SEARCH_PAGE_SIZE + 1;
    const endIndex = Math.min(patientSearchPage * PATIENT_SEARCH_PAGE_SIZE, patientSearchResults.length);
    return `${startIndex}-${endIndex} / ${patientSearchResults.length}件`;
  }, [patientSearchPage, patientSearchResults.length]);
  const showPatientSearchPagination = patientSearchResults.length > PATIENT_SEARCH_PAGE_SIZE;
  useEffect(() => {
    setPatientSearchPage((prev) => {
      if (prev < 1) return 1;
      if (prev > patientSearchTotalPages) return patientSearchTotalPages;
      return prev;
    });
  }, [patientSearchTotalPages]);
  useEffect(() => {
    if (!selectedDate || visibleAppointmentEntries.length === 0) return;
    saveReceptionEntriesForDate({
      date: selectedDate,
      entries: visibleAppointmentEntries,
      scope: storageScope,
    });
  }, [selectedDate, storageScope, visibleAppointmentEntries]);
  const tableColCount = 9;

  const claimBundles = claimOutpatientEnabled ? claimQuery.data?.bundles ?? [] : [];
  const claimQueueEntries = claimOutpatientEnabled ? claimQuery.data?.queueEntries ?? [] : [];
  const patientEntryCount = useMemo(() => {
    const map = new Map<string, number>();
    visibleAppointmentEntries.forEach((entry) => {
      const patientId = entry.patientId?.trim();
      if (!patientId) return;
      map.set(patientId, (map.get(patientId) ?? 0) + 1);
    });
    return map;
  }, [visibleAppointmentEntries]);
  const [claimSendCacheUpdatedAt, setClaimSendCacheUpdatedAt] = useState(0);
  useEffect(() => {
    setClaimSendCacheUpdatedAt(Date.now());
  }, [broadcast?.updatedAt, claimQuery.data?.runId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setClaimSendCacheUpdatedAt(Date.now());
    window.addEventListener('orca-claim-send-cache-update', handler as EventListener);
    return () => window.removeEventListener('orca-claim-send-cache-update', handler as EventListener);
  }, []);
  const claimSendCache = useMemo(
    () => loadOrcaClaimSendCache({ facilityId: session.facilityId, userId: session.userId }) ?? {},
    [claimSendCacheUpdatedAt, session.facilityId, session.userId],
  );

  const queueSummary = useMemo(() => {
    const nowMs = Date.now();
    return buildQueuePhaseSummary(claimQueueEntries, nowMs, ORCA_QUEUE_STALL_THRESHOLD_MS);
  }, [claimQueueEntries]);

  const claimBundlesByKey = useMemo(() => {
    const map = new Map<string, ClaimBundle[]>();
    for (const bundle of claimBundles) {
      if (bundle.appointmentId) {
        const key = `appointment:${bundle.appointmentId}`;
        const list = map.get(key) ?? [];
        list.push(bundle);
        map.set(key, list);
      }
      if (bundle.patientId) {
        const key = `patient:${bundle.patientId}`;
        const list = map.get(key) ?? [];
        list.push(bundle);
        map.set(key, list);
      }
    }
    return map;
  }, [claimBundles]);

  const claimQueueByKey = useMemo(() => {
    const map = new Map<string, ClaimQueueEntry>();
    for (const queue of claimQueueEntries) {
      if (queue.encounterKey) {
        map.set(`encounter:${queue.encounterKey}`, queue);
      }
      if (queue.scheduleKey) {
        map.set(`schedule:${queue.scheduleKey}`, queue);
      }
      if (queue.appointmentId) {
        map.set(`appointment:${queue.appointmentId}`, queue);
      }
      if (queue.patientId) {
        map.set(`patient:${queue.patientId}`, queue);
      }
    }
    return map;
  }, [claimQueueEntries]);

  const orcaQueueByPatientId = useMemo(() => {
    const map = new Map<string, OrcaQueueEntry>();
    const entries = orcaQueueQuery.data?.queue ?? [];
    for (const entry of entries) {
      if (entry.patientId) map.set(entry.patientId, entry);
    }
    return map;
  }, [orcaQueueQuery.data?.queue]);

  const orcaQueueErrorMessage = useMemo(() => {
    if (!orcaQueueQuery.isError) return undefined;
    const raw =
      orcaQueueQuery.error instanceof Error ? orcaQueueQuery.error.message : String(orcaQueueQuery.error ?? '');
    return raw ? truncateText(raw, 60) : undefined;
  }, [orcaQueueQuery.error, orcaQueueQuery.isError]);

  const orcaQueueErrorStatus = useMemo(() => {
    if (!orcaQueueQuery.isError) return undefined;
    return {
      label: '取得失敗',
      tone: 'error' as const,
      detail: orcaQueueErrorMessage ? `error: ${orcaQueueErrorMessage}` : 'error',
    };
  }, [orcaQueueErrorMessage, orcaQueueQuery.isError]);

  const resolveBundleForEntry = useCallback(
    (entry: ReceptionEntry): ClaimBundle | undefined => {
      const bundles: ClaimBundle[] = [];
      if (entry.appointmentId) {
        const byAppointment = claimBundlesByKey.get(`appointment:${entry.appointmentId}`);
        if (byAppointment) bundles.push(...byAppointment);
      }
      if (bundles.length === 0 && entry.patientId && (patientEntryCount.get(entry.patientId.trim()) ?? 0) <= 1) {
        const byPatient = claimBundlesByKey.get(`patient:${entry.patientId}`);
        if (byPatient) bundles.push(...byPatient);
      }
      if (bundles.length === 0) return undefined;
      return [...bundles].sort((a, b) => toBundleTimeMs(b.performTime) - toBundleTimeMs(a.performTime))[0];
    },
    [claimBundlesByKey, patientEntryCount],
  );

  const resolveQueueForEntry = useCallback(
    (entry: ReceptionEntry): ClaimQueueEntry | undefined => {
      if (entry.encounterKey) {
        const queue = claimQueueByKey.get(`encounter:${entry.encounterKey}`);
        if (queue) return queue;
      }
      if (entry.scheduleKey) {
        const queue = claimQueueByKey.get(`schedule:${entry.scheduleKey}`);
        if (queue) return queue;
      }
      if (entry.appointmentId) {
        const queue = claimQueueByKey.get(`appointment:${entry.appointmentId}`);
        if (queue) return queue;
      }
      if (entry.patientId && (patientEntryCount.get(entry.patientId.trim()) ?? 0) <= 1) {
        const queue = claimQueueByKey.get(`patient:${entry.patientId}`);
        if (queue) return queue;
      }
      return undefined;
    },
    [claimQueueByKey, patientEntryCount],
  );

  const resolveClaimSendCacheForEntry = useCallback(
    (entry: ReceptionEntry) =>
      findOrcaClaimSendEntryForMatch(claimSendCache, entry, {
        allowPatientFallback: Boolean(entry.patientId && (patientEntryCount.get(entry.patientId.trim()) ?? 0) <= 1),
      }),
    [claimSendCache, patientEntryCount],
  );

  const resolveBillingProjectionForEntry = useCallback(
    (entry: ReceptionEntry): ReceptionBillingProjection => {
      const bundle = resolveBundleForEntry(entry);
      const queue = resolveQueueForEntry(entry);
      const cache = resolveClaimSendCacheForEntry(entry);
      const correction = resolveCorrectionSignal({ bundle, cache });
      const workflow: BillingWorkflowStatus =
        correction?.kind === '要再計'
          ? '再計待'
          : bundle?.claimStatus === '会計済み'
            ? '会計済み'
            : entry.status === '会計済み' || entry.status === '再計待'
              ? entry.status
              : '会計待ち';
      const transmission =
        queue?.phase !== undefined
          ? resolveTransmissionFromQueuePhase(queue.phase)
          : cache?.sendStatus === 'success'
            ? '送信済'
            : cache?.sendStatus === 'error'
              ? '失敗'
              : '未送信';
      return {
        workflow,
        transmission,
        correction,
      };
    },
    [resolveBundleForEntry, resolveClaimSendCacheForEntry, resolveQueueForEntry],
  );

  const resolveLastVisitForEntry = useCallback(
    (entry: ReceptionEntry) => {
      const bundle = resolveBundleForEntry(entry);
      return toDateLabel(bundle?.performTime ?? entry.visitDate);
    },
    [resolveBundleForEntry],
  );

  const resolveQueueStatusForEntry = useCallback(
    (entry: ReceptionEntry) => resolveQueueStatus(resolveQueueForEntry(entry)),
    [resolveQueueForEntry],
  );

  const displayedEntries = useMemo(
    () =>
      rawSortedEntries.map((entry) => {
        if (entry.status !== '会計待ち' && entry.status !== '会計済み' && entry.status !== '再計待') {
          return entry;
        }
        const billingProjection = resolveBillingProjectionForEntry(entry);
        return {
          ...entry,
          status: billingProjection.workflow,
          billingProjection,
        };
      }),
    [rawSortedEntries, resolveBillingProjectionForEntry],
  );
  const grouped = useMemo(() => groupByStatus(displayedEntries), [displayedEntries]);
  const groupedByStatus = useMemo(
    () =>
      new Map<ReceptionStatus, ReceptionEntry[]>(
        grouped.map(({ status, items }) => [status, items]),
      ),
    [grouped],
  );
  const activeStatusItems = groupedByStatus.get(activeStatusTab) ?? [];
  const activeStatusLabel = SECTION_LABEL[activeStatusTab] ?? activeStatusTab;
  useEffect(() => {
    if (statusTabAutoAdjustedRef.current) return;
    if (!appointmentQuery.dataUpdatedAt) return;
    if (statusTabManualSelectionRef.current) {
      statusTabAutoAdjustedRef.current = true;
      return;
    }
    const activeCount = groupedByStatus.get(activeStatusTab)?.length ?? 0;
    if (activeCount === 0) {
      const fallback = SECTION_ORDER.find((status) => (groupedByStatus.get(status)?.length ?? 0) > 0);
      if (fallback) {
        setActiveStatusTab(fallback);
      }
    }
    statusTabAutoAdjustedRef.current = true;
  }, [activeStatusTab, appointmentQuery.dataUpdatedAt, groupedByStatus]);

  const receptionCarryover = useMemo<ReceptionCarryoverParams>(
    () => ({
      dept: departmentFilter || undefined,
      phys: physicianFilter || undefined,
      pay: paymentMode !== 'all' ? paymentMode : undefined,
      sort: sortKey,
      date: selectedDate || undefined,
    }),
    [departmentFilter, paymentMode, physicianFilter, selectedDate, sortKey],
  );

  const buildChartsUrlForEntry = useCallback(
    (entry: ReceptionEntry, runIdOverride?: string) => {
      const runId = runIdOverride ?? mergedMeta.runId ?? initialRunId ?? flags.runId;
      return buildChartsUrl(
        {
          patientId: entry.patientId,
          appointmentId: entry.appointmentId,
          receptionId: entry.receptionId,
          scheduleKey: entry.scheduleKey,
          encounterKey: entry.encounterKey,
          visitDate: entry.visitDate,
        },
        receptionCarryover,
        { runId },
        buildFacilityPath(session.facilityId, '/charts'),
      );
    },
    [flags.runId, initialRunId, mergedMeta.runId, receptionCarryover, session.facilityId],
  );

  const openChartsWithEncounter = useCallback(
    (
      encounter: OutpatientEncounterContext,
      source: 'list_action' | 'row_double_click' | 'patient_search',
      entry?: Pick<ReceptionEntry, 'patientId' | 'appointmentId' | 'receptionId' | 'scheduleKey' | 'encounterKey' | 'visitDate'>,
    ) => {
      const guardRunId = mergedMeta.runId ?? initialRunId ?? flags.runId;
      const normalizedEncounter = buildReceptionEncounterFromEntry({
        patientId: encounter.patientId ?? entry?.patientId,
        appointmentId: encounter.appointmentId ?? entry?.appointmentId,
        receptionId: encounter.receptionId ?? entry?.receptionId,
        scheduleKey: encounter.scheduleKey ?? entry?.scheduleKey,
        encounterKey: encounter.encounterKey ?? entry?.encounterKey,
        visitDate: encounter.visitDate ?? entry?.visitDate,
      });
      const controlId =
        source === 'row_double_click'
          ? 'open-charts-double-click'
          : source === 'patient_search'
            ? 'open-charts-patient-search'
            : 'open-charts';
      if (!hasHandoffEncounterKey(normalizedEncounter)) {
        enqueue({
          id: `reception-open-charts-blocked-${
            normalizedEncounter.encounterKey ??
            normalizedEncounter.scheduleKey ??
            normalizedEncounter.receptionId ??
            normalizedEncounter.patientId ??
            'unknown'
          }`,
          tone: 'warning',
          message: 'カルテを開くための canonical key が未設定です。',
          detail: 'scheduleKey / encounterKey のある受付情報を使用してください。',
        });
        logAuditEvent({
          runId: guardRunId,
          source: 'reception/open-charts',
          cacheHit: mergedMeta.cacheHit,
          missingMaster: mergedMeta.missingMaster,
          dataSourceTransition: mergedMeta.dataSourceTransition,
          appointmentId: normalizedEncounter.appointmentId,
          payload: {
            action: 'RECEPTION_OPEN_CHARTS',
            outcome: 'blocked',
            details: {
              controlId,
              appointmentId: normalizedEncounter.appointmentId,
              receptionId: normalizedEncounter.receptionId,
              blockedReasons: ['missing_schedule_key', 'missing_encounter_key'],
            },
          },
        });
        logUiState({
          action: 'navigate',
          screen: 'reception/list',
          controlId,
          runId: guardRunId,
          details: {
            blockedReason: 'missing_schedule_key',
            blockedReasons: ['missing_schedule_key', 'missing_encounter_key'],
            appointmentId: normalizedEncounter.appointmentId,
            receptionId: normalizedEncounter.receptionId,
          },
        });
        return;
      }
      if (guardRunId) {
        bumpRunId(guardRunId);
      }
      appNav.openCharts({
        encounter: normalizedEncounter,
        carryover: receptionCarryover,
        runId: guardRunId,
        navigate: {
          state: {
            runId: guardRunId,
            patientId: normalizedEncounter.patientId,
            appointmentId: normalizedEncounter.appointmentId,
            receptionId: normalizedEncounter.receptionId,
            scheduleKey: normalizedEncounter.scheduleKey,
            encounterKey: normalizedEncounter.encounterKey,
            visitDate: normalizedEncounter.visitDate,
          },
        },
      });
      logUiState({
        action: 'navigate',
        screen: 'reception/list',
        controlId,
        runId: guardRunId,
        dataSourceTransition: mergedMeta.dataSourceTransition,
        cacheHit: mergedMeta.cacheHit,
        missingMaster: mergedMeta.missingMaster,
        patientId: normalizedEncounter.patientId,
      });
    },
    [
      appNav,
      bumpRunId,
      enqueue,
      flags.runId,
      initialRunId,
      mergedMeta.cacheHit,
      mergedMeta.dataSourceTransition,
      mergedMeta.missingMaster,
      mergedMeta.runId,
      receptionCarryover,
    ],
  );

  const exceptionItems = useMemo(() => {
    const nowMs = Date.now();
    const baseRunId = mergedMeta.runId ?? initialRunId ?? flags.runId;
    const list: ReceptionExceptionItem[] = [];
    for (const entry of displayedEntries) {
      const bundle = resolveBundleForEntry(entry);
      const queue = resolveQueueForEntry(entry);
      const queueStatus = resolveQueueStatus(queue);
      const orcaQueueEntry = entry.patientId ? orcaQueueByPatientId.get(entry.patientId) : undefined;
      const orcaQueueStatus = orcaQueueErrorStatus ?? resolveOrcaQueueStatus(orcaQueueEntry);
      const decision = resolveExceptionDecision({
        entry,
        bundle,
        queue,
        nowMs,
        thresholdMs: ORCA_QUEUE_STALL_THRESHOLD_MS,
      });
      if (!decision.kind) continue;

      list.push({
        id: `${decision.kind}-${entryKey(entry)}`,
        kind: decision.kind,
        detail: decision.detail,
        nextAction: decision.nextAction,
        entry,
        bundle,
        queue,
        queueLabel: queueStatus.label,
        queueDetail: queueStatus.detail,
        queueTone: queueStatus.tone,
        orcaQueueLabel: orcaQueueStatus.label,
        orcaQueueDetail: orcaQueueStatus.detail,
        orcaQueueTone: orcaQueueStatus.tone,
        orcaQueueSource: orcaQueueQuery.data?.source,
        paymentLabel: paymentModeLabel(entry.insurance),
        chartsUrl: buildChartsUrlForEntry(entry, baseRunId),
        reasons: decision.reasons,
      });
    }
    return list;
  }, [
    buildChartsUrlForEntry,
    flags.runId,
    initialRunId,
    mergedMeta.runId,
    orcaQueueByPatientId,
    orcaQueueErrorStatus,
    orcaQueueQuery.data?.source,
    resolveBundleForEntry,
    resolveQueueForEntry,
    displayedEntries,
  ]);

  const exceptionCounts = useMemo(() => {
    const counts = {
      total: exceptionItems.length,
      unapproved: 0,
      sendError: 0,
      delayed: 0,
    };
    exceptionItems.forEach((item) => {
      if (item.kind === 'send_error') counts.sendError += 1;
      if (item.kind === 'delayed') counts.delayed += 1;
      if (item.kind === 'unapproved') counts.unapproved += 1;
    });
    return counts;
  }, [exceptionItems]);

  const exceptionIndicatorTone =
    exceptionCounts.sendError > 0
      ? 'error'
      : exceptionCounts.delayed > 0
        ? 'warning'
        : exceptionCounts.unapproved > 0
          ? 'info'
          : 'neutral';
  const statusExceptionTone = useMemo(() => {
    const byStatus = new Map<ReceptionStatus, 'error' | 'warning' | 'info'>();
    SECTION_ORDER.forEach((status) => {
      const items = exceptionItems.filter((item) => item.entry.status === status);
      if (items.some((item) => item.kind === 'send_error')) {
        byStatus.set(status, 'error');
        return;
      }
      if (items.some((item) => item.kind === 'delayed')) {
        byStatus.set(status, 'warning');
        return;
      }
      if (items.some((item) => item.kind === 'unapproved')) {
        byStatus.set(status, 'info');
      }
    });
    return byStatus;
  }, [exceptionItems]);

  const latestAuditEvent = useMemo(() => {
    const snapshot = getAuditEventLog();
    const latest = snapshot[snapshot.length - 1];
    return (latest?.payload as Record<string, unknown> | undefined) ?? undefined;
  }, [
    appointmentQuery.data?.runId,
    claimQuery.data?.runId,
    exceptionItems.length,
    mergedMeta.runId,
    missingMasterNote,
    selectedEntryKey,
  ]);

  const physicianOptions = useMemo(() => {
    const options = new Map<string, string>();
    const selected =
      selectedEntryKey && displayedEntries.length > 0
        ? displayedEntries.find((entry) => entryKey(entry) === selectedEntryKey)
        : undefined;
    const registerEntry = (entry?: ReceptionEntry) => {
      const code = resolveReceptionEntryPhysicianCode(entry);
      if (!code || options.has(code)) return;
      const mappedLabel = physicianNameMap[code]?.trim();
      options.set(code, mappedLabel && mappedLabel !== code ? mappedLabel : resolveEntryDisplayLabel(code, entry?.physician));
    };
    visibleAppointmentEntries.forEach((entry) => registerEntry(entry));
    registerEntry(selected);
    const selectedCode = normalizeCanonicalCode(acceptPhysicianSelection);
    if (selectedCode && !options.has(selectedCode)) {
      const mappedLabel = physicianNameMap[selectedCode]?.trim();
      options.set(selectedCode, mappedLabel && mappedLabel !== selectedCode ? mappedLabel : selectedCode);
    }
    return Array.from(options.entries())
      .sort((a, b) => {
        const [leftCode, leftLabel] = a;
        const [rightCode, rightLabel] = b;
        const byLabel = leftLabel.localeCompare(rightLabel, 'ja');
        if (byLabel !== 0) return byLabel;
        return leftCode.localeCompare(rightCode, 'ja');
      })
      .slice(0, 200)
      .map(([code, label]) => ({
        code,
        label,
      }));
  }, [acceptPhysicianSelection, displayedEntries, physicianNameMap, selectedEntryKey, visibleAppointmentEntries]);

  const selectedEntry = useMemo(() => {
    if (!selectedEntryKey) return undefined;
    return displayedEntries.find((entry) => entryKey(entry) === selectedEntryKey);
  }, [displayedEntries, selectedEntryKey]);

  useEffect(() => {
    if (!acceptedChartsHandoff) return;
    const handoffEncounterKey = acceptedChartsHandoff.encounter.encounterKey;
    const handoffScheduleKey = acceptedChartsHandoff.encounter.scheduleKey;
    const matched = displayedEntries.find((entry) => {
      if (handoffEncounterKey && entry.encounterKey === handoffEncounterKey) return true;
      if (handoffScheduleKey && entry.scheduleKey === handoffScheduleKey) return true;
      return false;
    });
    if (!matched) return;
    setSelectedEntryKey((previous) => (previous === entryKey(matched) ? previous : entryKey(matched)));
  }, [acceptedChartsHandoff, displayedEntries]);

  const recordsModalPatientId = recordsModalPatient?.patientId?.trim() ?? '';
  const recordsModalPatientLabel = recordsModalPatient?.name?.trim() || recordsModalPatientId || '—';

  const medicalRecordsModalQuery = useQuery({
    queryKey: ['orca-medical-records', recordsModalPatientId],
    enabled: Boolean(recordsModalPatientId),
    queryFn: async () => {
      if (!recordsModalPatientId) throw new Error('patientId is required');
      return postMedicalRecords({ patientId: recordsModalPatientId, performMonths: 18, includeVisitStatus: false });
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!appointmentQuery.dataUpdatedAt) return;
    if (lastAppointmentUpdatedAt.current === appointmentQuery.dataUpdatedAt) return;
    const previous = lastAppointmentUpdatedAt.current;
    lastAppointmentUpdatedAt.current = appointmentQuery.dataUpdatedAt;
    if (!previous) return;
    if (!selectedEntryKey) return;
    const stillExists = displayedEntries.some((entry) => entryKey(entry) === selectedEntryKey);
    if (stillExists) {
      setSelectionNotice({ tone: 'info', message: '一覧を更新しました。選択は保持されています。' });
      setSelectionLost(false);
    } else {
      setSelectionNotice({ tone: 'warning', message: '一覧更新で選択中の行が見つかりません。検索条件を確認してください。' });
      setSelectedEntryKey(null);
      setSelectionLost(true);
    }
  }, [appointmentQuery.dataUpdatedAt, displayedEntries, selectedEntryKey]);

  const applyAcceptAutoFill = useCallback(
    (entry: ReceptionEntry | undefined, options?: { force?: boolean }) => {
      if (!entry) return;
      const nextPatientId = entry.patientId?.trim() ?? '';
      const nextPaymentMode = resolvePaymentMode(entry.insurance ?? undefined);
      const nextDepartmentCode = resolveReceptionEntryDepartmentCode(entry);
      const nextPhysicianCode = resolveReceptionEntryPhysicianCode(entry);
      const nextVisitKind = acceptVisitKind.trim() ? acceptVisitKind : '1';
      const shouldUpdate = (current: string, next: string, last?: string) =>
        Boolean(next) && (options?.force || !current.trim() || (last && current === last));
      let updated = false;
      if (
        nextPatientId &&
        nextPatientId !== acceptPatientId.trim() &&
        (options?.force || !acceptPatientId.trim() || entry.source === 'unknown')
      ) {
        setAcceptPatientId(nextPatientId);
        setPatientSearchPatientId(nextPatientId);
        updated = true;
      } else if (shouldUpdate(acceptPatientId, nextPatientId, lastAcceptAutoFill.current.patientId)) {
        setAcceptPatientId(nextPatientId);
        setPatientSearchPatientId(nextPatientId);
        updated = true;
      }
      if (
        nextPaymentMode &&
        nextPaymentMode !== 'all' &&
        shouldUpdate(acceptPaymentMode, nextPaymentMode, lastAcceptAutoFill.current.paymentMode)
      ) {
        setAcceptPaymentMode(nextPaymentMode);
        updated = true;
      }
      if (!acceptVisitKind.trim() && nextVisitKind) {
        setAcceptVisitKind(nextVisitKind);
        updated = true;
      }
      const currentDepartmentCode = normalizeCanonicalCode(acceptDepartmentSelection) ?? '';
      const nextDepartmentSelection = nextDepartmentCode ?? '';
      if (currentDepartmentCode !== nextDepartmentSelection) {
        setAcceptDepartmentSelection(nextDepartmentSelection);
        updated = true;
      }
      const currentPhysicianCode = normalizeCanonicalCode(acceptPhysicianSelection) ?? '';
      const nextPhysicianSelection = nextPhysicianCode ?? '';
      if (currentPhysicianCode !== nextPhysicianSelection) {
        setAcceptPhysicianSelection(nextPhysicianSelection);
        updated = true;
      }
      if (updated) {
        lastAcceptAutoFill.current = {
          patientId: nextPatientId || lastAcceptAutoFill.current.patientId,
          paymentMode: (nextPaymentMode && nextPaymentMode !== 'all'
            ? nextPaymentMode
            : lastAcceptAutoFill.current.paymentMode) as 'insurance' | 'self' | '',
          departmentCode: nextDepartmentSelection || lastAcceptAutoFill.current.departmentCode,
          physicianCode: nextPhysicianSelection || lastAcceptAutoFill.current.physicianCode,
        };
        setAcceptErrors((prev) => {
          const next = { ...prev };
          if (nextPatientId) delete next.patientId;
          if (nextPaymentMode) delete next.paymentMode;
          if (nextDepartmentSelection) delete next.department;
          if (nextPhysicianSelection) delete next.physician;
          return next;
        });
      }
    },
    [
      acceptDepartmentSelection,
      acceptPatientId,
      acceptPaymentMode,
      acceptPhysicianSelection,
      acceptVisitKind,
    ],
  );

  const acceptAutoFillSignature = useMemo(() => {
    if (!selectedEntry) return null;
    const departmentCode = resolveReceptionEntryDepartmentCode(selectedEntry) ?? '';
    const physicianCode = resolveReceptionEntryPhysicianCode(selectedEntry) ?? '';
    return JSON.stringify({
      key: entryKey(selectedEntry),
      patientId: selectedEntry.patientId ?? '',
      paymentMode: resolvePaymentMode(selectedEntry.insurance ?? undefined) ?? '',
      departmentCode: departmentCode ?? '',
      physicianCode,
    });
  }, [selectedEntry]);

  useEffect(() => {
    if (!selectedEntry || !acceptAutoFillSignature) return;
    if (acceptWorkflowModalOpen && patientSearchSelected) return;
    if (lastAcceptAutoFillSignature.current === acceptAutoFillSignature) return;
    lastAcceptAutoFillSignature.current = acceptAutoFillSignature;
    applyAcceptAutoFill(selectedEntry);
  }, [acceptAutoFillSignature, acceptWorkflowModalOpen, applyAcceptAutoFill, patientSearchSelected, selectedEntry]);

  useEffect(() => {
    if (!selectedEntry || selectedEntry.source !== 'unknown') return;
    if (!selectedEntry.patientId) return;
    if (acceptPatientId.trim()) return;
    setAcceptPatientId(selectedEntry.patientId);
    setPatientSearchPatientId(selectedEntry.patientId);
    lastAcceptAutoFill.current = { ...lastAcceptAutoFill.current, patientId: selectedEntry.patientId };
  }, [acceptPatientId, selectedEntry]);

  const selectedBundle = useMemo(
    () => (selectedEntry ? resolveBundleForEntry(selectedEntry) : undefined),
    [resolveBundleForEntry, selectedEntry],
  );

  const selectedQueue = useMemo(
    () => (selectedEntry ? resolveQueueForEntry(selectedEntry) : undefined),
    [resolveQueueForEntry, selectedEntry],
  );
  const summaryText = useMemo(() => `検索結果 ${displayedEntries.length}件`, [displayedEntries.length]);

  const selectionSummaryText = useMemo(() => {
    if (!selectedEntry) return '選択中の患者はありません。';
    const queue = resolveQueueStatus(selectedQueue);
    const statusLabel = SECTION_LABEL[selectedEntry.status] ?? selectedEntry.status ?? '-';
    return [
      `選択中: ${selectedEntry.name ?? '未登録'}`,
      `患者ID ${selectedEntry.patientId ?? '未登録'}`,
      `状態 ${statusLabel}`,
      `ORCAキュー ${queue.label}${queue.detail ? ` ${queue.detail}` : ''}`,
    ].join('、');
  }, [selectedEntry, selectedQueue]);

  const selectedSavedView = useMemo(
    () => savedViews.find((view) => view.id === selectedViewId) ?? null,
    [savedViews, selectedViewId],
  );
  const savedViewUpdatedAtLabel = useMemo(() => {
    if (!selectedSavedView?.updatedAt) return null;
    const parsed = Date.parse(selectedSavedView.updatedAt);
    if (Number.isNaN(parsed)) return selectedSavedView.updatedAt;
    return formatAutoRefreshTimestamp(parsed);
  }, [selectedSavedView]);

  const unlinkedCounts = useMemo(() => {
    return countAppointmentDataIntegrity(visibleAppointmentEntries);
  }, [visibleAppointmentEntries]);

  const unlinkedWarning = useMemo(() => {
    const banner = getAppointmentDataBanner({
      entries: visibleAppointmentEntries,
      isLoading: appointmentQuery.isLoading,
      isError: appointmentQuery.isError,
      error: appointmentQuery.error,
      date: selectedDate,
    });
    if (!banner || banner.tone !== 'warning') return null;
    const parts = [
      unlinkedCounts.missingPatientId > 0 ? `患者ID欠損: ${unlinkedCounts.missingPatientId}` : undefined,
      unlinkedCounts.missingAppointmentId > 0 ? `予約ID欠損: ${unlinkedCounts.missingAppointmentId}` : undefined,
      unlinkedCounts.missingReceptionId > 0 ? `受付ID欠損: ${unlinkedCounts.missingReceptionId}` : undefined,
    ].filter((value): value is string => typeof value === 'string');
    const key = `${mergedMeta.runId ?? 'runId'}-${selectedDate}-${unlinkedCounts.missingPatientId}-${unlinkedCounts.missingAppointmentId}-${unlinkedCounts.missingReceptionId}`;
    return { ...banner, key, detail: parts.join(' / ') };
  }, [
    appointmentQuery.error,
    appointmentQuery.isError,
    appointmentQuery.isLoading,
    mergedMeta.runId,
    selectedDate,
    unlinkedCounts.missingAppointmentId,
    unlinkedCounts.missingPatientId,
    unlinkedCounts.missingReceptionId,
    visibleAppointmentEntries,
  ]);

  useEffect(() => {
    if (!unlinkedWarning) {
      lastUnlinkedToastKey.current = null;
      return;
    }
    if (lastUnlinkedToastKey.current === unlinkedWarning.key) return;
    lastUnlinkedToastKey.current = unlinkedWarning.key;
    enqueue({
      id: `reception-unlinked-${unlinkedWarning.key}`,
      tone: 'warning',
      message: unlinkedWarning.message,
      detail: unlinkedWarning.detail ? `${unlinkedWarning.detail} / 検索日: ${selectedDate}` : `検索日: ${selectedDate}`,
    });
  }, [enqueue, selectedDate, unlinkedWarning]);

  useEffect(() => {
    if (!selectionNotice) {
      lastSelectionNoticeToastKey.current = null;
      return;
    }
    const key = `${selectionNotice.tone}:${selectionNotice.message}:${selectedDate}`;
    if (lastSelectionNoticeToastKey.current === key) return;
    lastSelectionNoticeToastKey.current = key;
    enqueue({
      id: `reception-selection-notice-${selectionNotice.tone}-${selectedDate}`,
      tone: selectionNotice.tone,
      message: selectionNotice.message,
      detail: `検索日: ${selectedDate}`,
    });
  }, [enqueue, selectedDate, selectionNotice]);

  useEffect(() => {
    summaryRef.current?.focus?.();
  }, [summaryText]);

  useEffect(() => {
    if (displayedEntries.length === 0) {
      setSelectedEntryKey(null);
      setSelectionLost(false);
      return;
    }
    if (selectionLost) return;
    if (selectedEntryKey && displayedEntries.some((entry) => entryKey(entry) === selectedEntryKey)) return;
    setSelectedEntryKey(entryKey(displayedEntries[0]));
  }, [displayedEntries, selectedEntryKey, selectionLost]);

  useEffect(() => {
    if (!selectedEntry) return;
    const queue = resolveQueueStatus(selectedQueue);
    const payload = {
      entryKey: entryKey(selectedEntry),
      bundleNumber: selectedBundle?.bundleNumber ?? null,
      queuePhase: selectedQueue?.phase ?? null,
      lastVisit: toDateLabel(selectedBundle?.performTime ?? selectedEntry.visitDate),
    };
    const signature = JSON.stringify(payload);
    if (lastSidepaneAuditKey.current === signature) return;
    lastSidepaneAuditKey.current = signature;
    logAuditEvent({
      runId: mergedMeta.runId,
      patientId: selectedEntry.patientId,
      appointmentId: selectedEntry.appointmentId,
      cacheHit: mergedMeta.cacheHit,
      missingMaster: mergedMeta.missingMaster,
      dataSourceTransition: mergedMeta.dataSourceTransition,
      payload: {
        action: 'RECEPTION_SIDEPANE_SUMMARY',
        receptionId: selectedEntry.receptionId,
        patientSummary: {
          patientId: selectedEntry.patientId,
          name: selectedEntry.name,
          kana: selectedEntry.kana,
          birthDate: selectedEntry.birthDate,
          sex: selectedEntry.sex,
          insurance: selectedEntry.insurance,
          department: selectedEntry.department,
          physician: selectedEntry.physician,
          status: selectedEntry.status,
        },
        orderSummary: {
          claimStatus: selectedBundle?.claimStatus ?? selectedBundle?.claimStatusText,
          bundleNumber: selectedBundle?.bundleNumber,
          totalClaimAmount: selectedBundle?.totalClaimAmount,
          performTime: selectedBundle?.performTime,
          orcaQueue: {
            phase: selectedQueue?.phase,
            label: queue.label,
            detail: queue.detail,
          },
        },
      },
    });
  }, [
    mergedMeta.cacheHit,
    mergedMeta.dataSourceTransition,
    mergedMeta.missingMaster,
    mergedMeta.runId,
    selectedBundle,
    selectedEntry,
    selectedQueue,
  ]);

  useEffect(() => {
    if (!selectedEntryKey && selectionNotice?.tone !== 'warning') {
      setSelectionNotice(null);
    }
  }, [selectedEntryKey, selectionNotice?.tone]);

  useEffect(() => {
    const runId = mergedMeta.runId ?? initialRunId ?? flags.runId;
    if (!runId) return;
    const auditDetails = buildExceptionAuditDetails({
      runId,
      items: exceptionItems.map((item) => ({
        kind: item.kind,
        entry: item.entry,
        reasons: item.reasons ?? {},
      })),
      queueSummary,
      thresholdMs: ORCA_QUEUE_STALL_THRESHOLD_MS,
    });
    const signature = JSON.stringify(auditDetails);
    if (lastExceptionAuditKey.current === signature) return;
    lastExceptionAuditKey.current = signature;
    logAuditEvent({
      runId,
      source: 'reception-exception-list',
      cacheHit: mergedMeta.cacheHit,
      missingMaster: mergedMeta.missingMaster,
      dataSourceTransition: mergedMeta.dataSourceTransition,
      payload: {
        action: 'RECEPTION_EXCEPTION_LIST',
        outcome: 'info',
        details: {
          runId,
          summary: auditDetails,
        },
      },
    });
  }, [
    exceptionItems,
    flags.runId,
    initialRunId,
    mergedMeta.cacheHit,
    mergedMeta.dataSourceTransition,
    mergedMeta.missingMaster,
    mergedMeta.runId,
    queueSummary,
  ]);

  const tonePayload = useMemo(
    () => ({
      missingMaster: mergedMeta.missingMaster ?? true,
      cacheHit: mergedMeta.cacheHit ?? false,
      dataSourceTransition: mergedMeta.dataSourceTransition ?? 'snapshot',
    }),
    [mergedMeta.cacheHit, mergedMeta.dataSourceTransition, mergedMeta.missingMaster],
  );
  const toneDetails = useMemo(() => getChartToneDetails(tonePayload), [tonePayload]);
  const { tone, message: toneMessage, transitionMeta } = toneDetails;
  const masterSource = toMasterSource(tonePayload.dataSourceTransition);
  const isAcceptSubmitting = visitMutation.isPending;
  const resolvedDepartmentCode = normalizeCanonicalCode(acceptDepartmentSelection) ?? '';
  const resolvedPhysicianCode = normalizeCanonicalCode(acceptPhysicianSelection) ?? '';
  const resolvedMedicalInformation = acceptMedicalInformationCode.trim() || undefined;
  const resolveAcceptTarget = useCallback((): AcceptTarget => {
    const resolveFromVisibleEntries = (targetPatientId: string) =>
      visibleAppointmentEntries.find((entry) => entry.patientId?.trim() === targetPatientId);

    const direct = acceptPatientId.trim();
    if (direct) {
      const fromSearch = patientSearchSelected?.patientId?.trim() === direct ? patientSearchSelected : undefined;
      const fromMaster = masterSelected?.patientId?.trim() === direct ? masterSelected : undefined;
      const fromSelection = selectedEntry?.patientId?.trim() === direct ? selectedEntry : undefined;
      const fromVisibleEntries = resolveFromVisibleEntries(direct);
      return {
        source: 'manual',
        patientId: direct,
        name:
          fromSearch?.name?.trim() ||
          fromMaster?.name?.trim() ||
          fromSelection?.name?.trim() ||
          fromVisibleEntries?.name?.trim() ||
          '',
        birthDate:
          fromSearch?.birthDate?.trim() ||
          fromMaster?.birthDate?.trim() ||
          fromSelection?.birthDate?.trim() ||
          fromVisibleEntries?.birthDate?.trim() ||
          '',
        sex:
          fromSearch?.sex?.trim() ||
          fromMaster?.sex?.trim() ||
          fromSelection?.sex?.trim() ||
          fromVisibleEntries?.sex?.trim() ||
          '',
      };
    }

    const fromSearch = patientSearchSelected?.patientId?.trim();
    if (fromSearch) {
      return {
        source: 'patient-search',
        patientId: fromSearch,
        name: patientSearchSelected?.name?.trim() ?? '',
        birthDate: patientSearchSelected?.birthDate?.trim() ?? '',
        sex: patientSearchSelected?.sex?.trim() ?? '',
      };
    }

    const fromMaster = masterSelected?.patientId?.trim();
    if (fromMaster) {
      return {
        source: 'master-search',
        patientId: fromMaster,
        name: masterSelected?.name?.trim() ?? '',
        birthDate: masterSelected?.birthDate?.trim() ?? '',
        sex: masterSelected?.sex?.trim() ?? '',
      };
    }

    const fromSelection = selectedEntry?.patientId?.trim();
    if (fromSelection) {
      return {
        source: 'selection',
        patientId: fromSelection,
        name: selectedEntry?.name?.trim() ?? '',
        birthDate: selectedEntry?.birthDate?.trim() ?? '',
        sex: selectedEntry?.sex?.trim() ?? '',
      };
    }

    return {
      source: 'none',
      patientId: '',
      name: '',
      birthDate: '',
      sex: '',
    };
  }, [acceptPatientId, masterSelected, patientSearchSelected, selectedEntry, visibleAppointmentEntries]);

  const handleAcceptRegister = useCallback(
    async (event?: MouseEvent<HTMLButtonElement>) => {
      event?.preventDefault();
      setAcceptResult(null);
      setAcceptErrors({});
      setAcceptDurationMs(null);
      const currentAcceptTarget = resolveAcceptTarget();
      const trimmedPatientId = currentAcceptTarget.patientId.trim();
      if (!acceptPatientId.trim() && trimmedPatientId) {
        setAcceptPatientId(trimmedPatientId);
      }
      const selectedPatientId = patientSearchSelected?.patientId?.trim() ?? '';
      const manualPatientId = acceptPatientId.trim();
      const manualMismatchKey =
        manualPatientId && selectedPatientId && manualPatientId !== selectedPatientId
          ? `${manualPatientId}:${selectedPatientId}`
          : null;
      const mismatchNotConfirmed = Boolean(manualMismatchKey && manualAcceptConfirmedKey !== manualMismatchKey);
      const resolvedPaymentMode = acceptPaymentMode || 'insurance';
      const resolvedVisitKind = acceptVisitKind.trim() || '1';
      if (!acceptPaymentMode) {
        setAcceptPaymentMode(resolvedPaymentMode);
      }
      if (!acceptVisitKind.trim()) {
        setAcceptVisitKind(resolvedVisitKind);
      }
      const errors: typeof acceptErrors = {};
      if (!selectedPatientId) {
        errors.patientId = '患者検索結果から患者を選択してください。';
      } else if (!trimmedPatientId) {
        errors.patientId = '患者IDは必須です';
      }
      if (mismatchNotConfirmed) {
        errors.patientId = '手入力患者IDと選択中患者が不一致です。当日受付モーダルの確認導線を完了してください。';
      }
      if (!resolvedPaymentMode) errors.paymentMode = '保険/自費を選択してください';
      if (!resolvedVisitKind) errors.visitKind = '来院区分を選択してください';
      if (!resolvedDepartmentCode) errors.department = '診療科を選択してください';
      if (!resolvedPhysicianCode) errors.physician = '担当医を選択してください';
      if (!selectedDate) {
        setAcceptResult({
          tone: 'error',
          message: '受付日が未確定です',
          detail: '日付を選択してから再実行してください。',
        });
        return;
      }
      const hasErrors = Object.keys(errors).length > 0;
      if (hasErrors) {
        setAcceptErrors(errors);
        setAcceptResult({
          tone: 'error',
          message: '入力内容を確認してください',
          detail: Object.values(errors).join(' / '),
        });
      }
      const now = new Date();
      const params: VisitMutationParams = {
        patientId: trimmedPatientId || '',
        requestNumber: '01',
        acceptanceDate: selectedDate,
        acceptanceTime: formatLocalHms(now),
        acceptancePush: resolvedVisitKind,
        medicalInformation: resolvedMedicalInformation,
        paymentMode: resolvedPaymentMode || undefined,
        departmentCode: resolvedDepartmentCode || undefined,
        physicianCode: resolvedPhysicianCode || undefined,
      };

      const started = performance.now();
      try {
        if (hasErrors) return;
        // mutateAsync 未配線時の直接呼び出しフォールバック。
        const payload = await (visitMutation.mutateAsync ? visitMutation.mutateAsync(params) : mutateVisit(params));
        const durationMs = Math.round(performance.now() - started);
        setAcceptDurationMs(durationMs);
        const apiResult = normalizeOrcaApiResult(payload.apiResult);
        const isSuccess = isOrcaSuccessResult(apiResult) || ACCEPT_SUCCESS_RESULTS.has(apiResult);
        const isAlreadyAccepted = apiResult === '16';

        if (isSuccess) {
          applyMutationResultToList(payload, params);
          void refetchAppointment();
          if (claimOutpatientEnabled) {
            void refetchClaim();
          }
        } else if (isAlreadyAccepted) {
          void refetchAppointment();
        }

        const toneResult: 'info' | 'warning' | 'error' = isSuccess
          ? 'info'
          : ACCEPT_WARNING_RESULTS.has(apiResult)
            ? 'warning'
            : 'error';
        const fallbackMessage = resolveAcceptmodFallbackMessage(apiResult);
        const message = isSuccess
          ? '受付登録が完了しました'
          : payload.apiResultMessage
            ? payload.apiResultMessage
          : isAlreadyAccepted
            ? '診療科・保険組合せで既に受付済みです'
          : fallbackMessage
            ? fallbackMessage
            : '受付処理でエラーが返却されました';

        setAcceptResult({
          tone: toneResult,
          message,
          detail: buildReceptionAcceptResultDetail(),
          runId: payload.runId ?? mergedMeta.runId,
          apiResult: payload.apiResult,
        });

        if (durationMs > 1000) {
          enqueue({
            tone: 'warning',
            message: '受付リクエストが1秒を超えました',
            detail: `${durationMs}ms`,
          });
        }

        console.info(
          '[acceptmodv2]',
          JSON.stringify(
            {
              runId: payload.runId ?? mergedMeta.runId,
              traceId: payload.traceId,
              requestNumber: params.requestNumber,
              apiResult: payload.apiResult,
              apiResultMessage: payload.apiResultMessage,
              acceptanceId: payload.acceptanceId,
              patientId: payload.patient?.patientId ?? params.patientId,
              durationMs,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        setAcceptResult({
          tone: 'error',
          message: '受付処理に失敗しました',
          detail: RECEPTION_SUPPORT_GUIDE,
          runId: mergedMeta.runId,
        });
        enqueue({ tone: 'error', message: '受付処理に失敗しました', detail: RECEPTION_SUPPORT_GUIDE });
        // eslint-disable-next-line no-console
        console.error('[acceptmodv2]', detail);
      }
    },
    [
      acceptMedicalInformationCode,
      acceptPatientId,
      acceptPaymentMode,
      acceptVisitKind,
      applyMutationResultToList,
      enqueue,
      manualAcceptConfirmedKey,
      mergedMeta.runId,
      resolveAcceptTarget,
      refetchAppointment,
      refetchClaim,
      resolvedDepartmentCode,
      resolvedPhysicianCode,
      selectedDate,
      physicianNameMap,
      patientSearchSelected?.patientId,
      visitMutation,
    ],
  );

  const requestCancelEntry = useCallback(
    (entry: ReceptionEntry | null | undefined, source: 'selection' | 'card' | 'table') => {
      setAcceptResult(null);
      setAcceptErrors({});
      setAcceptDurationMs(null);
      if (!entry) {
        enqueue({ tone: 'warning', message: '取消する患者を選択してください。' });
        return;
      }
      if (entry.status === '予約') {
        enqueue({ tone: 'warning', message: '予約は受付取消できません。' });
        return;
      }
      const patientId = entry.patientId?.trim() ?? '';
      const acceptanceId = entry.receptionId?.trim() ?? '';
      if (!patientId) {
        enqueue({ tone: 'warning', message: '患者IDが未登録のため取消できません。' });
        return;
      }
      if (!acceptanceId) {
        enqueue({ tone: 'warning', message: '受付IDが未登録のため取消できません。' });
        return;
      }
      setCancelConfirmState({ entry, source, reason: '' });
    },
    [enqueue],
  );

  const executeCancelEntry = useCallback(
    async (entry: ReceptionEntry, source: 'selection' | 'card' | 'table', reason?: string) => {
      const patientId = entry.patientId?.trim() ?? '';
      const acceptanceId = entry.receptionId?.trim() ?? '';
      if (!patientId || !acceptanceId) return;
      if (!selectedDate) {
        setAcceptResult({
          tone: 'error',
          message: '受付日が未確定です',
          detail: '日付を選択してから再実行してください。',
          runId: mergedMeta.runId,
        });
        return;
      }
      const now = new Date();
      const params: VisitMutationParams = {
        patientId,
        requestNumber: '02',
        acceptanceDate: selectedDate,
        acceptanceTime: formatLocalHms(now),
        acceptancePush: '1',
        acceptanceId,
      };
      const started = performance.now();
      try {
        const payload = await (visitMutation.mutateAsync ? visitMutation.mutateAsync(params) : mutateVisit(params));
        const durationMs = Math.round(performance.now() - started);
        setAcceptDurationMs(durationMs);
        const apiResult = normalizeOrcaApiResult(payload.apiResult);
        const isSuccess = isOrcaSuccessResult(apiResult) || ACCEPT_SUCCESS_RESULTS.has(apiResult);
        if (isSuccess) {
          applyMutationResultToList(payload, params);
          void refetchAppointment();
          if (claimOutpatientEnabled) {
            void refetchClaim();
          }
        }
        const toneResult: 'info' | 'warning' | 'error' =
          isSuccess ? 'info' : ACCEPT_WARNING_RESULTS.has(apiResult) ? 'warning' : 'error';
        const fallbackMessage = resolveAcceptmodFallbackMessage(apiResult);
        const message = isSuccess
          ? '受付取消が完了しました'
          : payload.apiResultMessage
            ? payload.apiResultMessage
          : fallbackMessage
            ? fallbackMessage
            : '受付取消でエラーが返却されました';
        setAcceptResult({
          tone: toneResult,
          message,
          detail: buildReceptionAcceptResultDetail(),
          runId: payload.runId ?? mergedMeta.runId,
          apiResult: payload.apiResult,
        });
        enqueue({
          tone: toneResult === 'info' ? 'info' : toneResult,
          message,
          detail: buildReceptionAcceptResultDetail(),
        });
        logUiState({
          action: 'cancel',
          screen: 'reception/acceptmodv2',
          controlId: source === 'card' ? 'card-cancel' : source === 'table' ? 'table-cancel' : 'selection-cancel',
          runId: payload.runId ?? mergedMeta.runId,
          patientId,
          details: {
            acceptanceId,
            apiResult: payload.apiResult,
            apiResultMessage: payload.apiResultMessage,
            reason: reason || undefined,
          },
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        setAcceptResult({
          tone: 'error',
          message: '受付取消に失敗しました',
          detail: RECEPTION_SUPPORT_GUIDE,
          runId: mergedMeta.runId,
        });
        enqueue({ tone: 'error', message: '受付取消に失敗しました', detail: RECEPTION_SUPPORT_GUIDE });
        // eslint-disable-next-line no-console
        console.error('[acceptmodv2]', detail);
      }
    },
    [
      applyMutationResultToList,
      claimOutpatientEnabled,
      enqueue,
      mergedMeta.runId,
      refetchAppointment,
      refetchClaim,
      selectedDate,
      visitMutation,
    ],
  );

  const closeCancelConfirm = useCallback(() => {
    setCancelConfirmState(null);
  }, []);

  const handleConfirmCancelEntry = useCallback(() => {
    if (!cancelConfirmState) return;
    const reason = cancelConfirmState.reason.trim();
    void executeCancelEntry(cancelConfirmState.entry, cancelConfirmState.source, reason || undefined);
    setCancelConfirmState(null);
  }, [cancelConfirmState, executeCancelEntry]);

  const openAcceptWorkflowModal = useCallback(() => {
    setAcceptWorkflowModalOpen(true);
    setDailyCalendarOpen(false);
    setAcceptResult(null);
  }, []);

  const toggleAcceptWorkflowModal = useCallback(() => {
    setAcceptWorkflowModalOpen((prev) => {
      const next = !prev;
      if (next) {
        setDailyCalendarOpen(false);
        setAcceptResult(null);
      }
      return next;
    });
  }, []);

  const handlePatientSearchSubmit = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      const filters = {
        patientId: patientSearchPatientId.trim(),
        nameSei: patientSearchNameSei.trim(),
        nameMei: patientSearchNameMei.trim(),
        kanaSei: patientSearchKanaSei.trim(),
        kanaMei: patientSearchKanaMei.trim(),
      };
      const primaryKeyword =
        filters.patientId ||
        filters.kanaSei ||
        filters.kanaMei ||
        filters.nameSei ||
        filters.nameMei;
      if (!primaryKeyword) {
        setPatientSearchError('患者ID / 氏名 / カナ のいずれかを入力してください。');
        return;
      }
      patientSearchFilterRef.current = filters;
      setPatientSearchError(null);
      setPatientSearchSelected(null);
      setAcceptPatientId('');
      setAcceptWorkflowModalOpen(true);
      setDailyCalendarOpen(false);
      await patientSearchMutation.mutateAsync({ keyword: primaryKeyword });
      logUiState({
        action: 'patient_search',
        screen: 'reception',
        runId: mergedMeta.runId ?? flags.runId,
        details: { keyword: primaryKeyword, ...filters },
      });
    },
    [
      flags.runId,
      mergedMeta.runId,
      patientSearchPatientId,
      patientSearchKanaMei,
      patientSearchKanaSei,
      patientSearchMutation,
      patientSearchNameMei,
      patientSearchNameSei,
    ],
  );

  const clearPatientSearch = useCallback(() => {
    setPatientSearchPatientId('');
    setAcceptPatientId('');
    setPatientSearchNameSei('');
    setPatientSearchNameMei('');
    setPatientSearchKanaSei('');
    setPatientSearchKanaMei('');
    setPatientSearchResults([]);
    setPatientSearchMeta(null);
    setPatientSearchSelected(null);
    setPatientSearchPage(1);
    setPatientSearchError(null);
    patientSearchFilterRef.current = null;
    setAcceptedChartsHandoff(null);
    setPendingAcceptedChartsHandoff(null);
  }, []);

  const handleSelectPatientSearchResult = useCallback(
    (patient: PatientRecord) => {
      const nextPatientId = patient.patientId?.trim() ?? '';
      if (acceptedChartsHandoff?.encounter.patientId && acceptedChartsHandoff.encounter.patientId !== nextPatientId) {
        setAcceptedChartsHandoff(null);
      }
      if (pendingAcceptedChartsHandoff?.patientId && pendingAcceptedChartsHandoff.patientId !== nextPatientId) {
        setPendingAcceptedChartsHandoff(null);
      }
      setPatientSearchSelected(patient);
      const resolvedPatientId = nextPatientId;
      if (resolvedPatientId) {
        setAcceptPatientId(resolvedPatientId);
        setPatientSearchPatientId(resolvedPatientId);
        lastAcceptAutoFill.current = { ...lastAcceptAutoFill.current, patientId: resolvedPatientId };
        setAcceptErrors((prev) => ({ ...prev, patientId: undefined }));
        const matched = displayedEntries.find((entry) => entry.patientId === resolvedPatientId);
        if (matched) {
          setSelectedEntryKey(entryKey(matched));
          setSelectionNotice(null);
          setSelectionLost(false);
        } else {
          setSelectedEntryKey(null);
        }
      }
      const resolvedPaymentMode = resolvePaymentMode(patient.insurance ?? undefined);
      if (resolvedPaymentMode && resolvedPaymentMode !== 'all') {
        const shouldAutoFill =
          !acceptPaymentMode.trim() ||
          (lastAcceptAutoFill.current.paymentMode && acceptPaymentMode === lastAcceptAutoFill.current.paymentMode);
        if (shouldAutoFill) {
          setAcceptPaymentMode(resolvedPaymentMode);
          lastAcceptAutoFill.current = { ...lastAcceptAutoFill.current, paymentMode: resolvedPaymentMode };
          setAcceptErrors((prev) => ({ ...prev, paymentMode: undefined }));
        }
      }
      if (!acceptVisitKind.trim()) {
        setAcceptVisitKind('1');
      }
      logUiState({
        action: 'patient_select',
        screen: 'reception/patient-search',
        runId: mergedMeta.runId ?? flags.runId,
        patientId: resolvedPatientId || undefined,
        details: {
          patientId: resolvedPatientId || undefined,
          name: patient.name,
          kana: patient.kana,
        },
      });
    },
    [
      acceptPaymentMode,
      acceptVisitKind,
      acceptedChartsHandoff?.encounter.patientId,
      flags.runId,
      mergedMeta.runId,
      pendingAcceptedChartsHandoff?.patientId,
      displayedEntries,
    ],
  );

  const acceptTarget = useMemo(() => resolveAcceptTarget(), [resolveAcceptTarget]);
  const selectedPatientId = patientSearchSelected?.patientId?.trim() ?? '';
  const manualPatientId = acceptPatientId.trim();
  const manualMismatchKey =
    manualPatientId && selectedPatientId && manualPatientId !== selectedPatientId
      ? `${manualPatientId}:${selectedPatientId}`
      : null;
  const isManualPatientMismatch = Boolean(manualMismatchKey);
  const isManualMismatchConfirmed = Boolean(manualMismatchKey && manualAcceptConfirmedKey === manualMismatchKey);

  useEffect(() => {
    if (!manualMismatchKey && manualAcceptConfirmedKey) {
      setManualAcceptConfirmedKey(null);
    }
  }, [manualAcceptConfirmedKey, manualMismatchKey]);

  const acceptTargetPatientId = acceptTarget.patientId;
  const acceptTargetMetaMissing = Boolean(acceptTarget.patientId && (!acceptTarget.birthDate || !acceptTarget.sex));

  const handleConfirmManualMismatch = useCallback(() => {
    if (!manualMismatchKey) return;
    setManualAcceptConfirmedKey(manualMismatchKey);
    setAcceptResult(null);
  }, [manualMismatchKey]);

  const handleClearManualPatientInput = useCallback(() => {
    setAcceptPatientId('');
    setManualAcceptConfirmedKey(null);
    setAcceptResult(null);
  }, []);

  const handleAlignManualToSelection = useCallback(() => {
    if (!selectedPatientId) return;
    setAcceptPatientId(selectedPatientId);
    lastAcceptAutoFill.current = { ...lastAcceptAutoFill.current, patientId: selectedPatientId };
    setManualAcceptConfirmedKey(null);
    setAcceptResult(null);
    setAcceptErrors((prev) => ({ ...prev, patientId: undefined }));
  }, [selectedPatientId]);

  const acceptRegisterDecision = useMemo(() => {
    if (!selectedPatientId) {
      return { disabled: true, label: '受付する', reason: '患者検索結果から患者を選択してください。' };
    }
    if (!acceptTargetPatientId) {
      return { disabled: true, label: '受付する', reason: '患者を選択してください。' };
    }
    if (isManualPatientMismatch && !isManualMismatchConfirmed) {
      return {
        disabled: true,
        label: '受付する',
        reason: '手入力患者IDと選択中患者が不一致のため、当日受付モーダルの確認導線を完了してください。',
      };
    }
    const missingRequiredFields = [
      !resolvedDepartmentCode ? '診療科' : null,
      !acceptPaymentMode ? '保険/自費' : null,
      !resolvedPhysicianCode ? '担当医' : null,
      !acceptVisitKind.trim() ? '来院区分' : null,
    ].filter((value): value is string => Boolean(value));
    if (missingRequiredFields.length > 0) {
      const missingLabels = missingRequiredFields.join(' / ');
      return {
        disabled: true,
        label: '受付する',
        reason: `${missingLabels}を選択すると受付できます。`,
      };
    }
    const matches = visibleAppointmentEntries.filter((entry) => entry.patientId?.trim() === acceptTargetPatientId);
    const inScope = (entry: ReceptionEntry) => {
      if (!resolvedDepartmentCode) return true;
      const entryDepartmentCode = resolveReceptionEntryDepartmentCode(entry);
      if (!entryDepartmentCode) return true;
      return entryDepartmentCode === resolvedDepartmentCode;
    };
    const hasActive = matches.some((entry) => entry.status !== '予約' && inScope(entry));
    const hasReservation = matches.some((entry) => entry.status === '予約' && inScope(entry));
    if (hasActive) {
      return { disabled: true, label: '受付する', reason: '本日はすでに受付済みです。' };
    }
    if (hasReservation) {
      return { disabled: false, label: '受付する', reason: undefined };
    }
    return { disabled: false, label: '受付する', reason: undefined };
  }, [
    acceptTargetPatientId,
    acceptPaymentMode,
    isManualMismatchConfirmed,
    isManualPatientMismatch,
    resolvedDepartmentCode,
    resolvedPhysicianCode,
    selectedPatientId,
    acceptVisitKind,
    visibleAppointmentEntries,
  ]);
  const selectedPatientName = patientSearchSelected?.name?.trim() || acceptTarget.name || '未選択';

  const openExceptionsModal = useCallback(() => {
    setExceptionsModalOpen(true);
    logUiState({
      action: 'open_modal',
      screen: 'reception/exceptions',
      controlId: 'exceptions-modal',
      runId: mergedMeta.runId ?? flags.runId,
      details: {
        total: exceptionCounts.total,
        sendError: exceptionCounts.sendError,
        delayed: exceptionCounts.delayed,
        unapproved: exceptionCounts.unapproved,
      },
    });
  }, [exceptionCounts, flags.runId, mergedMeta.runId]);

  const closeExceptionsModal = useCallback(() => {
    setExceptionsModalOpen(false);
  }, []);

  const openMedicalRecordsModal = useCallback(
    (patient: { patientId?: string | null; name?: string | null }, source: 'search' | 'selection') => {
      const resolvedPatientId = patient.patientId?.trim() ?? '';
      if (!resolvedPatientId) {
        enqueue({ tone: 'warning', message: '患者IDが未登録のため過去カルテを表示できません。' });
        return;
      }
      setRecordsModalPatient({
        patientId: resolvedPatientId,
        name: patient.name?.trim() ? patient.name.trim() : undefined,
      });
      logUiState({
        action: 'open_modal',
        screen: 'reception/medical-records',
        controlId: 'medical-records-modal',
        runId: mergedMeta.runId ?? flags.runId,
        patientId: resolvedPatientId,
        details: { source },
      });
    },
    [enqueue, flags.runId, mergedMeta.runId],
  );

  const closeMedicalRecordsModal = useCallback(() => {
    setRecordsModalPatient(null);
  }, []);

  const handleMasterSearchSubmit = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      setMasterSearchNotice(null);
      setMasterSearchError(null);
      const trimmedName = masterSearchFilters.name.trim();
      if (masterSearchFilters.birthEndDate && !masterSearchFilters.birthStartDate) {
        setMasterSearchError('生年月日（終了）を指定する場合は開始日も入力してください。');
        return;
      }
      if (masterSearchFilters.birthStartDate && masterSearchFilters.birthEndDate) {
        const start = Date.parse(masterSearchFilters.birthStartDate);
        const end = Date.parse(masterSearchFilters.birthEndDate);
        if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
          setMasterSearchError('生年月日の開始日が終了日より後になっています。');
          return;
        }
      }
      if (!trimmedName) {
        setMasterSearchError('氏名（WholeName）は必須です。');
        return;
      }
      setMasterSearchError(null);
      await masterSearchMutation.mutateAsync({
        name: trimmedName || undefined,
        kana: masterSearchFilters.kana.trim() || undefined,
        birthStartDate: masterSearchFilters.birthStartDate || undefined,
        birthEndDate: masterSearchFilters.birthEndDate || undefined,
        sex: masterSearchFilters.sex || undefined,
        inOut: masterSearchFilters.inOut || undefined,
      });
    },
    [masterSearchFilters, masterSearchMutation],
  );

  const handleSelectMasterPatient = useCallback(
    (patient: PatientMasterRecord) => {
      setMasterSelected(patient);
      const resolvedPatientId = patient.patientId?.trim() ?? '';
      if (resolvedPatientId) {
        setAcceptPatientId(resolvedPatientId);
        lastAcceptAutoFill.current = {
          ...lastAcceptAutoFill.current,
          patientId: resolvedPatientId,
        };
        setAcceptErrors((prev) => ({ ...prev, patientId: undefined }));
      }
      if (!acceptPaymentMode) {
        const hasInsurance = (patient.insuranceCount ?? 0) > 0 || (patient.publicInsuranceCount ?? 0) > 0;
        setAcceptPaymentMode(hasInsurance ? 'insurance' : 'self');
      }
      if (!acceptVisitKind.trim()) {
        setAcceptVisitKind('1');
      }
      logUiState({
        action: 'patient_master_select',
        screen: 'reception',
        runId: mergedMeta.runId ?? flags.runId,
        details: {
          patientId: resolvedPatientId || undefined,
          name: patient.name,
          kana: patient.kana,
        },
      });
    },
    [acceptPaymentMode, acceptVisitKind, flags.runId, mergedMeta.runId],
  );

  useEffect(() => {
    if (!masterSelected?.patientId) return;
    if (!acceptPatientId.trim()) {
      setAcceptPatientId(masterSelected.patientId);
      lastAcceptAutoFill.current = {
        ...lastAcceptAutoFill.current,
        patientId: masterSelected.patientId,
      };
    }
    if (!acceptPaymentMode) {
      const hasInsurance =
        (masterSelected.insuranceCount ?? 0) > 0 || (masterSelected.publicInsuranceCount ?? 0) > 0;
      setAcceptPaymentMode(hasInsurance ? 'insurance' : 'self');
    }
    if (!acceptVisitKind.trim()) {
      setAcceptVisitKind('1');
    }
  }, [acceptPatientId, acceptPaymentMode, acceptVisitKind, masterSelected]);

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmittedKeyword(keyword.trim());
      appointmentQuery.refetch();
      logUiState({
        action: 'search',
        screen: 'reception/list',
        controlId: 'search-form',
        runId: mergedMeta.runId,
        dataSourceTransition: mergedMeta.dataSourceTransition,
      });
    },
    [appointmentQuery, keyword, mergedMeta.dataSourceTransition, mergedMeta.runId],
  );

  const handleClear = useCallback(() => {
    setKeyword('');
    setSubmittedKeyword('');
    setDepartmentFilter('');
    setPhysicianFilter('');
    setPaymentMode('all');
    setSortKey('time');
  }, []);

  const applySavedView = useCallback(
    (view: OutpatientSavedView) => {
      setSelectedViewId(view.id);
      const nextKeyword = view.filters.keyword ?? '';
      setKeyword(nextKeyword);
      setSubmittedKeyword(nextKeyword);
      setDepartmentFilter(view.filters.department ?? '');
      setPhysicianFilter(view.filters.physician ?? '');
      setPaymentMode(view.filters.paymentMode ?? 'all');
      setSortKey(isSortKey(view.filters.sort) ? (view.filters.sort as SortKey) : 'time');
      setSelectedDate(view.filters.date ?? selectedDate);
      appointmentQuery.refetch();
    },
    [appointmentQuery, selectedDate],
  );

  const handleSaveView = () => {
    const label = savedViewName || `検索 ${new Date().toLocaleString()}`;
    const nextViews = upsertOutpatientSavedView({
      label,
      filters: {
        keyword: keyword.trim() || undefined,
        department: departmentFilter || undefined,
        physician: physicianFilter || undefined,
        paymentMode,
        sort: sortKey,
        date: selectedDate,
      },
    });
    setSavedViews(nextViews);
    const saved = nextViews.find((view) => view.label === label);
    if (saved) setSelectedViewId(saved.id);
    setSavedViewName('');
  };

  const handleDeleteView = () => {
    if (!selectedViewId) return;
    const nextViews = removeOutpatientSavedView(selectedViewId);
    setSavedViews(nextViews);
    setSelectedViewId('');
  };

  const handleMasterSourceChange = useCallback(
    (value: ResolveMasterSource) => {
      const transition = value as DataSourceTransition;
      setDataSourceTransition(transition);
      logUiState({
        action: 'config_delivery',
        screen: 'reception/order-console',
        controlId: 'resolve-master-source',
        dataSourceTransition: transition,
        cacheHit: tonePayload.cacheHit,
        missingMaster: tonePayload.missingMaster,
        runId: mergedMeta.runId,
      });
      logAuditEvent({
        runId: mergedMeta.runId,
        source: 'order-console',
        cacheHit: tonePayload.cacheHit,
        missingMaster: tonePayload.missingMaster,
        dataSourceTransition: transition,
        payload: { resolveMasterSource: value },
      });
    },
    [mergedMeta.runId, setDataSourceTransition, tonePayload.cacheHit, tonePayload.dataSourceTransition, tonePayload.missingMaster],
  );

  const handleToggleMissingMaster = useCallback(() => {
    const next = !tonePayload.missingMaster;
    setMissingMaster(next);
    logUiState({
      action: 'tone_change',
      screen: 'reception/order-console',
      controlId: 'toggle-missing-master',
      dataSourceTransition: tonePayload.dataSourceTransition,
      cacheHit: tonePayload.cacheHit,
      missingMaster: next,
      runId: mergedMeta.runId,
    });
    logAuditEvent({
      runId: mergedMeta.runId,
      source: 'order-console',
      note: missingMasterNote,
      cacheHit: tonePayload.cacheHit,
      missingMaster: next,
      dataSourceTransition: tonePayload.dataSourceTransition,
    });
  }, [mergedMeta.runId, missingMasterNote, setMissingMaster, tonePayload.cacheHit, tonePayload.dataSourceTransition, tonePayload.missingMaster]);

  const handleToggleCacheHit = useCallback(() => {
    const next = !tonePayload.cacheHit;
    setCacheHit(next);
    logUiState({
      action: 'tone_change',
      screen: 'reception/order-console',
      controlId: 'toggle-cache-hit',
      dataSourceTransition: tonePayload.dataSourceTransition,
      cacheHit: next,
      missingMaster: tonePayload.missingMaster,
      runId: mergedMeta.runId,
    });
    logAuditEvent({
      runId: mergedMeta.runId,
      source: 'order-console',
      note: missingMasterNote,
      cacheHit: next,
      missingMaster: tonePayload.missingMaster,
      dataSourceTransition: tonePayload.dataSourceTransition,
    });
  }, [mergedMeta.runId, missingMasterNote, setCacheHit, tonePayload.cacheHit, tonePayload.dataSourceTransition, tonePayload.missingMaster]);

  const handleMissingMasterNoteChange = useCallback(
    (value: string) => {
      setMissingMasterNote(value);
      const selected = selectedEntry;
      logUiState({
        action: 'save',
        screen: 'reception/order-console',
        controlId: 'missing-master-note',
        runId: mergedMeta.runId,
        dataSourceTransition: tonePayload.dataSourceTransition,
        cacheHit: tonePayload.cacheHit,
        missingMaster: tonePayload.missingMaster,
        patientId: selected?.patientId,
        appointmentId: selected?.appointmentId,
        details: { missingMasterNote: value },
      });
      logAuditEvent({
        runId: mergedMeta.runId,
        source: 'order-console-note',
        note: value,
        cacheHit: tonePayload.cacheHit,
        missingMaster: tonePayload.missingMaster,
        dataSourceTransition: tonePayload.dataSourceTransition,
        patientId: selected?.patientId,
        appointmentId: selected?.appointmentId,
        payload: { missingMasterNote: value, receptionId: selected?.receptionId },
      });
    },
    [mergedMeta.runId, selectedEntry, tonePayload.cacheHit, tonePayload.dataSourceTransition, tonePayload.missingMaster],
  );

  const handleRowDoubleClick = useCallback(
    (entry: ReceptionEntry) => {
      openChartsWithEncounter(buildReceptionEncounterFromEntry(entry), 'row_double_click', entry);
    },
    [openChartsWithEncounter],
  );

  const handleRetryQueue = useCallback(
    async (entry: ReceptionEntry) => {
      if (!isSystemAdmin) {
        enqueue({
          tone: 'warning',
          message: 'ORCAキュー再送はシステム管理者のみ実行できます。',
        });
        return;
      }
      const patientId = entry.patientId;
      if (!patientId) return;
      if (orcaQueueQuery.data?.retrySupported !== true) {
        enqueue({
          tone: 'info',
          message: 'この環境では ORCA 再送は未実装です。',
        });
        return;
      }
      const baseRunId = mergedMeta.runId ?? initialRunId ?? flags.runId;
      setRetryingPatientId(patientId);
      const started = performance.now();
      try {
        const data = await retryOrcaQueue(patientId, { enabled: isSystemAdmin });
        queryClient.setQueryData(orcaQueueQueryKey, data);
        const durationMs = Math.round(performance.now() - started);
        const feedback = resolveOrcaQueueRetryUiFeedback(data);
        const detailParts = [
          feedback.detail,
          data.source ? `source=${data.source}` : undefined,
          `queue=${data.queue.length}`,
          data.verifyAdminDelivery ? 'verify=on' : undefined,
          `duration=${durationMs}ms`,
        ].filter((value): value is string => Boolean(value));
        enqueue({
          tone: feedback.tone,
          message: feedback.message,
          detail: detailParts.join(' / '),
        });
        logUiState({
          action: 'orca_queue_retry',
          screen: 'reception/exceptions',
          controlId: 'retry-orca-queue',
          runId: data.runId ?? baseRunId,
          dataSourceTransition: mergedMeta.dataSourceTransition,
          cacheHit: mergedMeta.cacheHit,
          missingMaster: mergedMeta.missingMaster,
          patientId,
          details: {
            queueSource: data.source,
            queueEntries: data.queue.length,
            durationMs,
          },
        });
        logAuditEvent({
          runId: data.runId ?? baseRunId,
          source: 'reception/exceptions',
          patientId,
          payload: {
            action: 'RECEPTION_QUEUE_RETRY',
            result: feedback.tone === 'success' ? 'success' : feedback.tone === 'error' ? 'error' : 'info',
            queueSource: data.source,
            queueEntries: data.queue.length,
            verifyAdminDelivery: data.verifyAdminDelivery,
            durationMs,
            retryApplied: data.retryApplied,
            retryReason: data.retryReason,
          },
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        enqueue({ tone: 'error', message: 'ORCA再送に失敗しました', detail });
        logAuditEvent({
          runId: baseRunId,
          source: 'reception/exceptions',
          patientId,
          payload: {
            action: 'RECEPTION_QUEUE_RETRY',
            result: 'error',
            error: detail,
          },
        });
      } finally {
        setRetryingPatientId(null);
      }
    },
    [
      enqueue,
      flags.runId,
      initialRunId,
      isSystemAdmin,
      mergedMeta.cacheHit,
      mergedMeta.dataSourceTransition,
      mergedMeta.missingMaster,
      mergedMeta.runId,
      orcaQueueQuery.data?.retrySupported,
      orcaQueueQueryKey,
      queryClient,
    ],
  );

  const handleSendBilling = useCallback(
    async (entry: ReceptionEntry) => {
      const sendGuard = resolveBillingSendGuard({
        entry,
        fallbackUsed: mergedMeta.fallbackUsed,
      });
      if (!sendGuard.canSend) {
        enqueue({
          tone: 'warning',
          message: sendGuard.message,
          detail: sendGuard.detail,
        });
        logAuditEvent({
          runId: mergedMeta.runId ?? initialRunId ?? flags.runId,
          source: 'reception/claim-send',
          patientId: entry.patientId?.trim() || undefined,
          payload: {
            action: 'RECEPTION_CLAIM_SEND',
            result: 'blocked',
            blockedReasons: sendGuard.blockedReasons,
            visitDate: entry.visitDate,
            departmentCode: entry.departmentCode,
            physicianCode: entry.physicianCode,
            insuranceCombinationNumber: entry.insuranceCombinationNumber,
            voucherNumber: entry.voucherNumber,
            sequentialNumber: entry.sequentialNumber,
            fallbackUsed: mergedMeta.fallbackUsed ?? false,
          },
        });
        return;
      }

      const { patientId, visitDate: calculationDate, departmentCode, physicianCode } = sendGuard.encounterContext;
      const baseRunId = mergedMeta.runId ?? initialRunId ?? flags.runId;
      setClaimSendingPatientId(patientId);
      const startedAt = performance.now();
      try {
        const orderBundleResult = await fetchMedicalModV2OrderBundles(patientId, calculationDate);
        if (orderBundleResult.errors.length > 0) {
          const failedEntitiesPreview = orderBundleResult.errors.slice(0, 6).join(' / ');
          const remaining = orderBundleResult.errors.length - 6;
          enqueue({
            tone: 'warning',
            message: '会計送信を停止',
            detail: `オーダー取得失敗（${failedEntitiesPreview}${remaining > 0 ? ` / 他${remaining}件` : ''}）`,
          });
          logAuditEvent({
            runId: baseRunId,
            source: 'reception/claim-send',
            patientId,
            payload: {
              action: 'RECEPTION_CLAIM_SEND',
              result: 'blocked',
              blockedReasons: ['fetch_failed'],
              visitDate: calculationDate,
              orderBundles: {
                fetchErrors: orderBundleResult.errors,
              },
            },
          });
          return;
        }
        const preparedSendData = prepareMedicalModV2SendData(orderBundleResult.bundles);
        const blockNotice = buildMedicalModV2BlockNotice(preparedSendData);
        if (blockNotice) {
          enqueue({
            tone: 'warning',
            message: '会計送信を停止',
            detail: `${blockNotice.message} / ${blockNotice.nextAction}`,
          });
          logAuditEvent({
            runId: baseRunId,
            source: 'reception/claim-send',
            patientId,
            payload: {
              action: 'RECEPTION_CLAIM_SEND',
              result: 'blocked',
              blockedReasons: ['invalid_order_bundle'],
              visitDate: calculationDate,
              orderBundles: {
                bundles: orderBundleResult.bundles.length,
                medicalInformation: preparedSendData.medicalInformation.length,
                requiredIssues: preparedSendData.requiredIssues.length,
                bundleIssues: preparedSendData.bundleIssues.length,
                codeIssues: preparedSendData.codeIssues.length,
                invalidCodes: preparedSendData.invalidCodes.length,
              },
            },
          });
          return;
        }
        const requestXml = buildMedicalModV2RequestXml({
          encounterContext: sendGuard.encounterContext,
          medicalInformation: preparedSendData.medicalInformation,
        });
        const result = await postOrcaMedicalModV2Xml(requestXml, { classCode: '01' });
        const idempotentDuplicate = isIdempotentDuplicate(result.apiResult, result.apiResultMessage);
        const apiResultOk = isOrcaSuccessResult(result.apiResult) || idempotentDuplicate;
        const hasMissingTags = Boolean(result.missingTags?.length);
        const allowMissingTags = idempotentDuplicate;
        const outcome =
          result.ok && apiResultOk && (!hasMissingTags || allowMissingTags)
            ? ('success' as const)
            : result.ok
              ? ('warning' as const)
              : ('error' as const);
        const durationMs = Math.round(performance.now() - startedAt);
        const nextRunId = result.runId ?? baseRunId;
        const nextTraceId = result.traceId ?? undefined;
        const detailParts = [
          `runId=${nextRunId}`,
          `traceId=${nextTraceId ?? 'unknown'}`,
          result.apiResult ? `Api_Result=${result.apiResult}` : undefined,
          result.apiResultMessage ? `Api_Result_Message=${result.apiResultMessage}` : undefined,
          result.invoiceNumber ? `Invoice_Number=${result.invoiceNumber}` : undefined,
          result.dataId ? `Data_Id=${result.dataId}` : undefined,
          `duration=${durationMs}ms`,
        ].filter((part): part is string => Boolean(part));
        const detail = detailParts.join(' / ');
        enqueue({
          tone: outcome === 'success' ? 'success' : outcome === 'warning' ? 'warning' : 'error',
          message: outcome === 'success' ? '会計送信を完了' : outcome === 'warning' ? '会計送信に警告' : '会計送信に失敗',
          detail: buildReceptionClaimSendDetail(outcome),
        });

        logUiState({
          action: 'claim_send',
          screen: 'reception/claim-send',
          controlId: 'claim-send-list',
          runId: nextRunId,
          cacheHit: mergedMeta.cacheHit,
          missingMaster: mergedMeta.missingMaster,
          dataSourceTransition: mergedMeta.dataSourceTransition,
          patientId,
          details: {
            visitDate: calculationDate,
            departmentCode,
            physicianCode,
            insuranceCombinationNumber: sendGuard.encounterContext.insuranceCombinationNumber,
            voucherNumber: sendGuard.encounterContext.voucherNumber,
            sequentialNumber: sendGuard.encounterContext.sequentialNumber,
            httpStatus: result.status,
            apiResult: result.apiResult,
            apiResultMessage: result.apiResultMessage,
            invoiceNumber: result.invoiceNumber,
            dataId: result.dataId,
            missingTags: result.missingTags,
            orderBundles: {
              entities: ORCA_SEND_ORDER_ENTITIES.length,
              bundles: orderBundleResult.bundles.length,
              medicalInformation: preparedSendData.medicalInformation.length,
              fetchErrors: orderBundleResult.errors.length > 0 ? orderBundleResult.errors : undefined,
            },
          },
        });
        logAuditEvent({
          runId: nextRunId,
          source: 'reception/claim-send',
          patientId,
          payload: {
            action: 'RECEPTION_CLAIM_SEND',
            result: outcome,
            visitDate: calculationDate,
            departmentCode,
            physicianCode,
            insuranceCombinationNumber: sendGuard.encounterContext.insuranceCombinationNumber,
            voucherNumber: sendGuard.encounterContext.voucherNumber,
            sequentialNumber: sendGuard.encounterContext.sequentialNumber,
            httpStatus: result.status,
            apiResult: result.apiResult,
            apiResultMessage: result.apiResultMessage,
            invoiceNumber: result.invoiceNumber,
            dataId: result.dataId,
            missingTags: result.missingTags,
            orderBundles: {
              entities: ORCA_SEND_ORDER_ENTITIES.length,
              bundles: orderBundleResult.bundles.length,
              medicalInformation: preparedSendData.medicalInformation.length,
              fetchErrors: orderBundleResult.errors.length > 0 ? orderBundleResult.errors : undefined,
            },
          },
        });

        saveOrcaClaimSendCache(
          {
            patientId,
            appointmentId: entry.appointmentId,
            receptionId: entry.receptionId,
            scheduleKey: entry.scheduleKey,
            encounterKey: entry.encounterKey,
            invoiceNumber: result.invoiceNumber,
            dataId: result.dataId,
            runId: nextRunId,
            traceId: nextTraceId,
            apiResult: result.apiResult,
            sendStatus: outcome === 'success' ? 'success' : 'error',
            errorMessage: outcome === 'success' ? undefined : detail,
          },
          storageScope,
        );

        void Promise.resolve(refetchAppointment()).catch(() => undefined);
        void Promise.resolve(orcaQueueQuery.refetch()).catch(() => undefined);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        enqueue({ tone: 'error', message: '会計送信に失敗しました', detail });
        logAuditEvent({
          runId: baseRunId,
          source: 'reception/claim-send',
          patientId,
          payload: {
            action: 'RECEPTION_CLAIM_SEND',
            result: 'error',
            error: detail,
          },
        });
      } finally {
        setClaimSendingPatientId(null);
      }
    },
    [
      enqueue,
      flags.runId,
      initialRunId,
      mergedMeta.cacheHit,
      mergedMeta.dataSourceTransition,
      mergedMeta.fallbackUsed,
      mergedMeta.missingMaster,
      mergedMeta.runId,
      orcaQueueQuery,
      refetchAppointment,
      storageScope,
    ],
  );

  const handleOpenCharts = useCallback(
    (entry: ReceptionEntry, _urlOverride?: string) => {
      openChartsWithEncounter(buildReceptionEncounterFromEntry(entry), 'list_action', entry);
    },
    [openChartsWithEncounter],
  );

  const handleSelectEntry = useCallback(
    (entry: ReceptionEntry) => {
      setSelectedEntryKey(entryKey(entry));
      if (!acceptWorkflowModalOpen) {
        setPatientSearchSelected(null);
      }
      setSelectionNotice(null);
      setSelectionLost(false);
      logUiState({
        action: 'history_jump',
        screen: 'reception/exceptions',
        controlId: 'exception-select',
        runId: mergedMeta.runId ?? initialRunId ?? flags.runId,
        patientId: entry.patientId,
        appointmentId: entry.appointmentId,
      });
    },
    [acceptWorkflowModalOpen, flags.runId, initialRunId, mergedMeta.runId],
  );
  const handleStatusTabChange = useCallback((status: ReceptionStatus) => {
    statusTabManualSelectionRef.current = true;
    setActiveStatusTab(status);
  }, []);
  const handleStatusTabKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = STATUS_TAB_ORDER.indexOf(activeStatusTab);
      if (currentIndex < 0) return;
      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextIndex = (currentIndex + 1) % STATUS_TAB_ORDER.length;
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nextIndex = (currentIndex - 1 + STATUS_TAB_ORDER.length) % STATUS_TAB_ORDER.length;
      } else if (event.key === 'Home') {
        event.preventDefault();
        nextIndex = 0;
      } else if (event.key === 'End') {
        event.preventDefault();
        nextIndex = STATUS_TAB_ORDER.length - 1;
      } else {
        return;
      }
      const nextStatus = STATUS_TAB_ORDER[nextIndex];
      handleStatusTabChange(nextStatus);
      window.setTimeout(() => {
        document.getElementById(`reception-status-tab-${nextStatus}`)?.focus();
      }, 0);
    },
    [activeStatusTab, handleStatusTabChange],
  );

  const handleSelectRow = useCallback(
    (entry: ReceptionEntry) => {
      setOpenCardActionMenuKey(null);
      setSelectedEntryKey(entryKey(entry));
      if (!acceptWorkflowModalOpen) {
        setPatientSearchSelected(null);
      }
      setSelectionNotice(null);
      setSelectionLost(false);
      if (entry.source === 'unknown') {
        const resolvedPatientId = entry.patientId?.trim() ?? '';
        if (resolvedPatientId) {
          setAcceptPatientId(resolvedPatientId);
          lastAcceptAutoFill.current = { ...lastAcceptAutoFill.current, patientId: resolvedPatientId };
        }
        if (!acceptPaymentMode) {
          const hasInsurance = resolvePaymentMode(entry.insurance ?? undefined) ?? 'self';
          setAcceptPaymentMode(hasInsurance === 'self' ? 'self' : 'insurance');
        }
        if (!acceptVisitKind.trim()) {
          setAcceptVisitKind('1');
        }
      }
    },
    [acceptPaymentMode, acceptVisitKind, acceptWorkflowModalOpen],
  );

  const renderAcceptDetailPanel = (placement: 'sidepane' | 'modal') => (
    <div
      className={`reception-accept__detail-panel${placement === 'modal' ? ' reception-accept__detail-panel--modal' : ''}`}
      data-test-id={placement === 'modal' ? 'reception-accept-detail-modal' : 'reception-accept-detail-sidepane'}
    >
      <PatientIdentityBar
        className="reception-accept__identity-bar"
        eyebrow={placement === 'modal' ? '受付登録モーダル' : '受付登録'}
        title="受付登録"
        patientName={selectedPatientName}
        patientId={acceptTarget.patientId}
        patientKana={patientSearchSelected?.kana?.trim() ?? undefined}
        sex={acceptTarget.sex}
        note={`受付対象: ${selectedPatientName}`}
        selected={Boolean(selectedPatientId)}
        chips={
          isManualPatientMismatch ? (
            <StatusPill tone="warning" size="xs">
              手入力不一致
            </StatusPill>
          ) : undefined
        }
      />
      {acceptTargetMetaMissing ? (
        <small className="reception-accept__optional">
          手入力IDから患者同定情報（生年月日/性別）を取得できません。患者選択結果を確認してください。
        </small>
      ) : null}
      {isManualPatientMismatch ? (
        <div>
          <ToneBanner
            tone="warning"
            message={`手入力患者ID(${manualPatientId}) と選択中患者ID(${selectedPatientId}) が一致していません。`}
            destination="受付"
            nextAction={
              isManualMismatchConfirmed
                ? '手入力続行を確認済みです'
                : '以下の導線から続行方法を選択してください'
            }
            runId={resolvedRunId}
            ariaLive="assertive"
          />
          <div className="reception-accept__buttons">
            <button
              type="button"
              className="reception-search__button warning"
              onClick={handleConfirmManualMismatch}
              disabled={isManualMismatchConfirmed}
            >
              手入力で続行
            </button>
            <button
              type="button"
              className="reception-search__button ghost"
              onClick={handleClearManualPatientInput}
            >
              手入力をクリア
            </button>
            <button
              type="button"
              className="reception-search__button ghost"
              onClick={handleAlignManualToSelection}
              disabled={!selectedPatientId}
            >
              選択に合わせる
            </button>
          </div>
        </div>
      ) : null}

      <div className="reception-accept__details" data-test-id="reception-accept-details">
          <div className="reception-accept__row">
            <label className="reception-accept__field">
              <span>
                診療科<span className="reception-accept__required">必須</span>
              </span>
              <select
                id="reception-accept-department"
                name="receptionAcceptDepartment"
                data-testid="accept-department-select"
                value={acceptDepartmentSelection}
                onChange={(event) => {
                  const value = event.target.value;
                  setAcceptDepartmentSelection(value);
                  setAcceptErrors((prev) => ({ ...prev, department: undefined }));
                }}
                aria-invalid={Boolean(acceptErrors.department)}
              >
                <option value="">選択してください</option>
                {departmentOptions.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
              {departmentOptions.length >= 200 && (
                <small className="reception-accept__optional">候補が多いため上位200件に制限しています。</small>
              )}
              {acceptDepartmentSelection && departmentOptions.length === 1 && departmentOptions[0]?.[0] && (
                <small className="reception-accept__optional">選択中の行に基づいて診療科を反映しています。</small>
              )}
              {acceptDepartmentSelection && departmentOptions.length > 1 && (
                <small className="reception-accept__optional">選択中の行に一致する診療科を優先します。</small>
              )}
              {acceptErrors.department && <small className="reception-accept__error">{acceptErrors.department}</small>}
            </label>

            <label className="reception-accept__field">
              <span>
                保険/自費<span className="reception-accept__required">必須</span>
              </span>
              <select
                id="reception-accept-payment-mode"
                name="receptionAcceptPaymentMode"
                value={acceptPaymentMode}
                onChange={(event) => setAcceptPaymentMode(event.target.value as 'insurance' | 'self' | '')}
                aria-invalid={Boolean(acceptErrors.paymentMode)}
              >
                <option value="">自動（既定: 保険）</option>
                <option value="insurance">保険</option>
                <option value="self">自費</option>
              </select>
              {acceptErrors.paymentMode && <small className="reception-accept__error">{acceptErrors.paymentMode}</small>}
            </label>

            <label className="reception-accept__field">
              <span>
                担当医<span className="reception-accept__required">必須</span>
              </span>
              <select
                id="reception-accept-physician"
                name="receptionAcceptPhysician"
                data-testid="accept-physician-select"
                value={acceptPhysicianSelection}
                onChange={(event) => {
                  const value = event.target.value;
                  setAcceptPhysicianSelection(value);
                  setAcceptErrors((prev) => ({ ...prev, physician: undefined }));
                }}
                aria-invalid={Boolean(acceptErrors.physician)}
              >
                <option value="">選択してください</option>
                {physicianOptions.map((physician) => (
                  <option key={physician.code} value={physician.code}>
                    {physician.label}
                  </option>
                ))}
              </select>
              {physicianOptions.length === 0 && (
                <small className="reception-accept__optional">
                  担当医が取得できません。フィルタ/受付一覧の読み込みを確認してください。
                </small>
              )}
              {acceptPhysicianSelection && physicianOptions.length > 0 && (
                <small className="reception-accept__optional">選択中の行の担当医を反映しています。</small>
              )}
              {physicianOptions.length >= 200 && (
                <small className="reception-accept__optional">候補が多いため上位200件に制限しています。</small>
              )}
              {acceptPhysicianSelection && physicianOptions.length > 1 && (
                <small className="reception-accept__optional">選択中の行に一致する担当医を優先します。</small>
              )}
              {acceptErrors.physician && <small className="reception-accept__error">{acceptErrors.physician}</small>}
            </label>

            <label className="reception-accept__field">
              <span>
                来院区分<span className="reception-accept__required">必須</span>
              </span>
              <select
                id="reception-accept-visit-kind"
                name="receptionAcceptVisitKind"
                value={acceptVisitKind}
                onChange={(event) => setAcceptVisitKind(event.target.value)}
                aria-invalid={Boolean(acceptErrors.visitKind)}
              >
                <option value="">自動（既定: 通常）</option>
                <option value="1">通常(1)</option>
                <option value="2">時間外(2)</option>
                <option value="3">救急(3)</option>
              </select>
              {acceptErrors.visitKind && <small className="reception-accept__error">{acceptErrors.visitKind}</small>}
            </label>
          </div>

          <div className="reception-accept__row">
            <label className="reception-accept__field">
              <span>診療内容コード</span>
              <select
                id="reception-accept-medical-information"
                name="receptionAcceptMedicalInformation"
                data-testid="accept-medical-information-select"
                value={acceptMedicalInformationCode}
                onChange={(event) => setAcceptMedicalInformationCode(event.target.value)}
              >
                <option value="">未選択（送信しない）</option>
                {medicalInformationOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name} ({option.code})
                  </option>
                ))}
              </select>
              <small className="reception-accept__optional">
                既存患者の受付に必要な場合のみ送信します。未選択なら `Medical_Information` は送信しません。
              </small>
            </label>
          </div>

          <div className="reception-accept__actions">
            <div className="reception-accept__hints" aria-live={infoLive}>
              <span>受付内容を確認して「受付する」を押してください。</span>
              <span>この画面は既存患者の受付専用です。新患登録は Patients で行ってください。</span>
              {debugUiEnabled ? (
                <>
                  <span>Api_Result=00/K3: 左の一覧へ即時反映 / Api_Result=16/21/60: 警告表示</span>
                  <span>runId/traceId は監査ログ（action=reception_accept）とコンソールに残します</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

      {acceptResult ? (
        <div className="reception-accept__result" role="status" aria-live={infoLive}>
          <div className="reception-accept__result-header">
            <h3>送信結果</h3>
          </div>
          <ToneBanner
            tone={acceptResult.tone === 'success' ? 'info' : acceptResult.tone}
            message={acceptResult.message}
            destination="受付"
            nextAction={acceptResult.tone === 'success' ? '受付リスト更新' : '内容確認'}
            runId={acceptResult.runId ?? resolvedRunId}
            ariaLive={acceptResult.tone === 'error' ? 'assertive' : 'polite'}
          />
          {debugUiEnabled ? (
            <div className="reception-accept__result-meta">
              <span data-test-id="accept-api-result">Api_Result: {acceptResult.apiResult ?? '—'}</span>
              <span data-test-id="accept-duration-ms">
                所要時間: {acceptDurationMs !== null ? `${acceptDurationMs} ms` : '—'}
              </span>
            </div>
          ) : null}
          {acceptResult.detail && <p className="reception-accept__result-detail">{acceptResult.detail}</p>}
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <Global styles={receptionStyles} />
      <main className="reception-page" data-run-id={resolvedRunId}>
        <a className="skip-link" href="#reception-results">
          検索結果へスキップ
        </a>
      <ReturnToBar
        scope={{ facilityId: session.facilityId, userId: session.userId }}
        returnTo={appNav.safeReturnToCandidate}
        from={appNav.fromCandidate}
        fallbackUrl={fallbackUrl}
      />
        <section className="reception-page__header">
          <div className="reception-page__title">
            <div className="reception-page__title-main">
              <h1>{title}</h1>
              <p className="sr-only">{description}</p>
            </div>
          </div>
        </section>
        <section className="reception-toolbar" role="region" aria-label="受付ツールバー" data-run-id={resolvedRunId}>
          <form className="reception-toolbar__group" onSubmit={handleSearchSubmit}>
            <div className="reception-toolbar__group" role="group" aria-label="日付操作">
              <div className="reception-search__date-nav" role="group" aria-label="日付操作">
                <button
                  type="button"
                  className="reception-search__button ghost"
                  onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
                  title="前日に移動"
                >
                  前日
                </button>
                <button
                  type="button"
                  className="reception-search__button ghost"
                  onClick={() => setSelectedDate(todayString())}
                  disabled={selectedDate === todayString()}
                  title="今日に移動"
                >
                  今日
                </button>
                <button
                  type="button"
                  className="reception-search__button ghost"
                  onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}
                  title="翌日に移動"
                >
                  翌日
                </button>
                {chartVisitDate ? (
                  <button
                    type="button"
                    className="reception-search__button ghost"
                    onClick={() => setSelectedDate(chartVisitDate)}
                    disabled={selectedDate === chartVisitDate}
                    title="現在のカルテ日へ移動"
                  >
                    カルテ日
                  </button>
                ) : null}
              </div>
              <label className="reception-search__field">
                <span className="sr-only">日付</span>
                <input
                  id="reception-search-date"
                  name="receptionSearchDate"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  required
                />
              </label>
              <div
                ref={dailyCalendarRootRef}
                className={`reception-daily-calendar${dailyCalendarOpen ? ' is-open' : ''}`}
                data-run-id={resolvedRunId}
              >
                <button
                  type="button"
                  className="reception-daily-calendar__trigger"
                  aria-label="日次状態（カレンダー）"
                  aria-expanded={dailyCalendarOpen}
                  onClick={toggleDailyCalendar}
                >
                  <span className="reception-daily-calendar__trigger-label">日次状態</span>
                  <span className="reception-daily-calendar__trigger-date">{selectedDate}</span>
                </button>
                {dailyCalendarOpen ? (
                  <div className="reception-daily-calendar__popover" role="group" aria-label="日次状態カレンダー">
                    <header className="reception-daily-calendar__popover-header">
                      <button
                        type="button"
                        className="reception-daily-calendar__nav"
                        onClick={() => setDailyCalendarMonthStart((prev) => shiftUtcMonth(prev, -1))}
                      >
                        前月
                      </button>
                      <strong className="reception-daily-calendar__month" aria-live={infoLive}>
                        {dailyCalendarMonthLabel}
                      </strong>
                      <button
                        type="button"
                        className="reception-daily-calendar__nav"
                        onClick={() => setDailyCalendarMonthStart((prev) => shiftUtcMonth(prev, 1))}
                      >
                        翌月
                      </button>
                    </header>
                    <div className="reception-daily-calendar__weekdays" aria-hidden="true">
                      {DAILY_CALENDAR_WEEKDAYS.map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>
                    <div className="reception-daily-calendar__days">
                      {dailyCalendarCells.map((cell) => {
                        const enabled = dailyCalendarAvailableDates.has(cell.ymd);
                        const selected = cell.ymd === selectedDate;
                        return (
                          <button
                            key={cell.ymd}
                            type="button"
                            className={`reception-daily-calendar__day${selected ? ' is-selected' : ''}${enabled ? ' is-enabled' : ''}${cell.inMonth ? '' : ' is-outside'}`}
                            onClick={() => {
                              if (!enabled) return;
                              setSelectedDate(cell.ymd);
                              setDailyCalendarOpen(false);
                            }}
                            disabled={!enabled}
                            aria-pressed={selected}
                            data-weekday={cell.weekday}
                            title={enabled ? `${cell.ymd} の受付状況へ移動` : `${cell.ymd} は受付データがありません`}
                          >
                            {cell.day}
                          </button>
                        );
                      })}
                    </div>
                    <div className="reception-daily-calendar__legend" aria-hidden="true">
                      <span className="reception-daily-calendar__legend-item">
                        <span className="reception-daily-calendar__legend-dot" data-kind="enabled" />
                        受付データあり
                      </span>
                      <span className="reception-daily-calendar__legend-item">
                        <span className="reception-daily-calendar__legend-dot" data-kind="selected" />
                        選択中
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="reception-toolbar__group" role="group" aria-label="検索">
              <label className="reception-search__field">
                <span>検索（患者ID/氏名/カナ）</span>
                <input
                  id="reception-search-keyword"
                  name="receptionSearchKeyword"
                  type="search"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="PX-0001 / 山田 / ヤマダ"
                />
              </label>
              <button type="submit" className="reception-search__button primary">
                検索
              </button>
            </div>
            <div className="reception-toolbar__group" role="group" aria-label="絞り込み">
              <label className="reception-search__field">
                <span>診療科</span>
                <select
                  id="reception-search-department"
                  name="receptionSearchDepartment"
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                >
                  <option value="">すべて</option>
                  {uniqueDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </label>
              <label className="reception-search__field">
                <span>担当医</span>
                <select
                  id="reception-search-physician"
                  name="receptionSearchPhysician"
                  value={physicianFilter}
                  onChange={(event) => setPhysicianFilter(event.target.value)}
                >
                  <option value="">すべて</option>
                  {uniquePhysicians.map((physician) => (
                    <option key={physician} value={physician}>
                      {physician}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="reception-toolbar__group" role="status" aria-live={infoLive}>
              <button
                type="button"
                className={`reception-exception-indicator${exceptionCounts.total > 0 ? ' is-active' : ''}`}
                data-tone={exceptionIndicatorTone}
                onClick={openExceptionsModal}
                aria-label={`例外一覧を開く（${exceptionCounts.total}件）`}
                title={`送信エラー:${exceptionCounts.sendError} / 遅延:${exceptionCounts.delayed} / 未承認:${exceptionCounts.unapproved}`}
              >
                <span className="reception-exception-indicator__icon" aria-hidden="true">
                  !
                </span>
                <span className="reception-exception-indicator__label">例外</span>
                <span className="reception-exception-indicator__count">{exceptionCounts.total}</span>
              </button>
              <StatusPill
                className="reception-pill"
                label="最終更新"
                value={appointmentUpdatedAtLabel}
                tone="neutral"
                runId={resolvedRunId}
              />
              <StatusPill
                className="reception-pill"
                label="RT同期"
                value={RECEPTION_REALTIME_STATUS_LABEL[receptionRealtimeStatus]}
                tone={RECEPTION_REALTIME_STATUS_TONE[receptionRealtimeStatus]}
                runId={resolvedRunId}
              />
            </div>
            <div className="reception-toolbar__group" role="group" aria-label="操作">
              <button
                type="button"
                className="reception-search__button ghost"
                onClick={() => appointmentQuery.refetch()}
              >
                再取得
              </button>
              <button
                type="button"
                className="reception-search__button ghost"
                onClick={() => setFiltersCollapsed((prev) => !prev)}
                aria-expanded={!filtersCollapsed}
                aria-controls="reception-toolbar-advanced"
              >
                詳細条件
              </button>
              <button
                type="button"
                className="reception-search__button primary"
                onClick={toggleAcceptWorkflowModal}
                aria-expanded={acceptWorkflowModalOpen}
                data-test-id="reception-open-accept-workflow"
              >
                既存患者受付/患者検索
              </button>
              <button
                type="button"
                className="reception-results-toolbar__toggle"
                onClick={() => setStatusListLayout('table')}
                aria-pressed={statusListLayout === 'table'}
              >
                表
              </button>
              <button
                type="button"
                className="reception-results-toolbar__toggle"
                onClick={() => setStatusListLayout('cards')}
                aria-pressed={statusListLayout === 'cards'}
              >
                カード
              </button>
            </div>
          </form>
          {debugUiEnabled ? (
            <details className="reception-page__meta-details" data-test-id="reception-meta-details">
              <summary className="reception-page__meta-details-summary">システム詳細</summary>
              <div className="reception-page__meta-advanced" aria-label="システム詳細">
                <RunIdBadge runId={resolvedRunId} />
                <StatusPill
                  className="reception-pill"
                  label="dataSourceTransition"
                  value={metaDataSourceTransition}
                  tone={resolveTransitionTone()}
                  runId={resolvedRunId}
                />
                <StatusPill
                  className="reception-pill"
                  label="missingMaster"
                  value={String(metaMissingMaster)}
                  tone={resolveMetaFlagTone(metaMissingMaster)}
                  runId={resolvedRunId}
                />
                <StatusPill
                  className="reception-pill"
                  label="cacheHit"
                  value={String(metaCacheHit)}
                  tone={resolveCacheHitTone(metaCacheHit)}
                  runId={resolvedRunId}
                />
                <AuditSummaryInline
                  auditEvent={latestAuditEvent}
                  className="reception-pill"
                  variant="inline"
                  label="監査サマリ"
                  runId={resolvedRunId}
                />
              </div>
            </details>
          ) : null}
        </section>
        {!filtersCollapsed ? (
          <section
            id="reception-toolbar-advanced"
            className="reception-toolbar__advanced"
            role="region"
            aria-label="詳細条件"
          >
            <div className="reception-toolbar__advanced-grid">
              <label className="reception-search__field">
                <span>保険/自費</span>
                <select
                  id="reception-search-payment-mode"
                  name="receptionSearchPaymentMode"
                  value={paymentMode}
                  onChange={(event) => setPaymentMode(normalizePaymentMode(event.target.value))}
                >
                  <option value="all">すべて</option>
                  <option value="insurance">保険</option>
                  <option value="self">自費</option>
                </select>
              </label>
              <label className="reception-search__field">
                <span>ソート</span>
                <select
                  id="reception-search-sort"
                  name="receptionSearchSort"
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                >
                  <option value="time">優先時間（受付→予約）</option>
                  <option value="acceptance">受付時間</option>
                  <option value="reservation">予約時間</option>
                  <option value="name">氏名</option>
                  <option value="department">診療科</option>
                </select>
              </label>
              <label className="reception-search__field">
                <span>保存ビュー</span>
                <select
                  id="reception-search-saved-view"
                  name="receptionSearchSavedView"
                  value={selectedViewId}
                  onChange={(event) => setSelectedViewId(event.target.value)}
                >
                  <option value="">選択してください</option>
                  {savedViews.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="reception-search__button ghost"
                onClick={() => {
                  const view = savedViews.find((item) => item.id === selectedViewId);
                  if (view) applySavedView(view);
                }}
                disabled={!selectedViewId}
              >
                適用
              </button>
              <button
                type="button"
                className="reception-search__button ghost"
                onClick={handleDeleteView}
                disabled={!selectedViewId}
              >
                削除
              </button>
              <label className="reception-search__field">
                <span>ビュー名</span>
                <input
                  id="reception-search-saved-view-name"
                  name="receptionSearchSavedViewName"
                  value={savedViewName}
                  onChange={(event) => setSavedViewName(event.target.value)}
                  placeholder="例: 内科/午前/保険"
                />
              </label>
              <button type="button" className="reception-search__button primary" onClick={handleSaveView}>
                現在の条件を保存
              </button>
              <button type="button" className="reception-search__button ghost" onClick={handleClear}>
                クリア
              </button>
            </div>
            <div className="reception-toolbar__summary" role="status" aria-live={infoLive}>
              <span className="reception-search__saved-share">受付 ↔ 患者管理で共有</span>
              <span className="reception-search__saved-updated">
                {selectedSavedView ? `選択中の更新: ${savedViewUpdatedAtLabel ?? '—'}` : '選択中のビューはありません'}
              </span>
            </div>
          </section>
        ) : null}
		          {(appointmentErrorContext ||
		            unlinkedWarning ||
		            intentBanner ||
		            broadcast ||
	            appointmentAutoRefreshNotice ||
	            appointmentQuery.data?.hasNextPage) && (
            <div className="reception-page__alerts" role="region" aria-label="警告/通知">
              {appointmentErrorContext && (
                <ApiFailureBanner
                  subject="外来リスト"
                  destination="受付"
                  runId={appointmentQuery.data?.runId ?? flags.runId}
                  nextAction="再取得"
                  retryLabel="再取得"
                  onRetry={() => appointmentQuery.refetch()}
                  isRetrying={appointmentQuery.isFetching}
                  {...appointmentErrorContext}
                />
              )}
              {unlinkedWarning && (
                <ToneBanner
                  tone="warning"
                  message={unlinkedWarning.message}
                  destination="受付"
                  nextAction="一覧を確認"
                  runId={mergedMeta.runId}
                  ariaLive="assertive"
                />
              )}
              <AdminBroadcastBanner broadcast={broadcast} surface="reception" runId={resolvedRunId} />
              {intentBanner && (
                <ToneBanner
                  tone={intentBanner.tone}
                  message={intentBanner.message}
                  patientId={intentKeyword || undefined}
                  destination="受付"
                  nextAction={intentBanner.nextAction}
                  runId={flags.runId}
                  ariaLive={intentBanner.tone === 'info' ? 'polite' : 'assertive'}
                />
              )}
              {appointmentAutoRefreshNotice && (
                <ToneBanner
                  tone={appointmentAutoRefreshNotice.tone}
                  message={appointmentAutoRefreshNotice.message}
                  destination="受付"
                  nextAction={appointmentAutoRefreshNotice.nextAction}
                  runId={resolvedRunId}
                />
              )}
              {appointmentQuery.data?.hasNextPage ? (
                <ToneBanner
                  tone="warning"
                  message={`先頭${appointmentQuery.data?.size ?? 50}件のみ表示中です。`}
                  destination="受付"
                  nextAction="検索条件を絞って再取得"
                  runId={appointmentQuery.data?.runId ?? resolvedRunId}
                />
              ) : null}
            </div>
          )}

        <section className="reception-layout" id="reception-results" tabIndex={-1}>
          <div className="reception-layout__main">
            {debugUiEnabled ? (
            <section className="reception-master" aria-label="既存患者マスタ検索" data-run-id={resolvedRunId}>
              <header className="reception-master__header">
                <div>
                  <h2>既存患者マスタ検索（name-search）</h2>
                  <p className="reception-master__lead">
                    /api/orca/official/patients/name-search で既存患者を照会し、選択した患者IDを受付設定へ反映します。新患登録は Patients で行ってください。
                  </p>
                </div>
                <div className="reception-master__meta">
                  <RunIdBadge runId={resolvedRunId} />
                  <StatusPill
                    className="reception-pill"
                    label="recordsReturned"
                    value={String(masterSearchMeta?.recordsReturned ?? masterSearchResults.length ?? 0)}
                    tone="neutral"
                    runId={resolvedRunId}
                  />
                </div>
              </header>

              <form className="reception-master__form" onSubmit={handleMasterSearchSubmit}>
                <div className="reception-master__form-row">
                  <label className="reception-master__field">
                    <span>氏名</span>
                    <input
                      id="reception-master-name"
                      name="receptionMasterName"
                      type="text"
                      value={masterSearchFilters.name}
                      onChange={(event) => setMasterSearchFilters((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="山田 太郎"
                    />
                  </label>
                  <label className="reception-master__field">
                    <span>カナ</span>
                    <input
                      id="reception-master-kana"
                      name="receptionMasterKana"
                      type="text"
                      value={masterSearchFilters.kana}
                      onChange={(event) => setMasterSearchFilters((prev) => ({ ...prev, kana: event.target.value }))}
                      placeholder="ヤマダ タロウ"
                    />
                  </label>
                  <label className="reception-master__field">
                    <span>生年月日（開始）</span>
                    <input
                      id="reception-master-birth-start"
                      name="receptionMasterBirthStart"
                      type="date"
                      value={masterSearchFilters.birthStartDate}
                      onChange={(event) =>
                        setMasterSearchFilters((prev) => ({ ...prev, birthStartDate: event.target.value }))
                      }
                    />
                  </label>
                  <label className="reception-master__field">
                    <span>生年月日（終了）</span>
                    <input
                      id="reception-master-birth-end"
                      name="receptionMasterBirthEnd"
                      type="date"
                      value={masterSearchFilters.birthEndDate}
                      onChange={(event) =>
                        setMasterSearchFilters((prev) => ({ ...prev, birthEndDate: event.target.value }))
                      }
                    />
                  </label>
                  <label className="reception-master__field">
                    <span>性別</span>
                    <select
                      id="reception-master-sex"
                      name="receptionMasterSex"
                      value={masterSearchFilters.sex}
                      onChange={(event) => setMasterSearchFilters((prev) => ({ ...prev, sex: event.target.value }))}
                    >
                      <option value="">指定なし</option>
                      <option value="M">男性</option>
                      <option value="F">女性</option>
                      <option value="O">その他</option>
                    </select>
                  </label>
                  <label className="reception-master__field">
                    <span>
                      区分
                    </span>
                    <select
                      id="reception-master-inout"
                      name="receptionMasterInOut"
                      value={masterSearchFilters.inOut}
                      onChange={(event) => setMasterSearchFilters((prev) => ({ ...prev, inOut: event.target.value }))}
                    >
                      <option value="">未指定</option>
                      <option value="2">外来(2)</option>
                      <option value="1">入院(1)</option>
                    </select>
                  </label>
                </div>
                <div className="reception-master__actions">
                  <div className="reception-master__hints" aria-live={infoLive}>
                    <span>氏名（WholeName）は必須です。カナは画面内確認用で、official payload には送信しません。</span>
                    <span>区分は任意です。指定した場合のみ official payload に送信します。</span>
                    {masterSearchError ? <span className="reception-master__error">{masterSearchError}</span> : null}
                  </div>
                  <div className="reception-master__buttons">
                    <button
                      type="button"
                      className="reception-search__button ghost"
                      onClick={() => {
                        openAcceptWorkflowModal();
                        window.setTimeout(() => {
                          const el = document.getElementById('reception-patient-search-patient-id');
                          if (el instanceof HTMLInputElement) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.focus();
                          }
                        }, 0);
                      }}
                    >
                      既存患者受付へ
                    </button>
                    <button
                      type="button"
                      className="reception-search__button ghost"
                      onClick={() => {
                        setMasterSearchFilters({
                          name: '',
                          kana: '',
                          birthStartDate: '',
                          birthEndDate: '',
                          sex: '',
                          inOut: '',
                        });
                        setMasterSearchResults([]);
                        setMasterSearchMeta(null);
                        setMasterSelected(null);
                        setMasterSearchNotice(null);
                        setMasterSearchError(null);
                      }}
                    >
                      クリア
                    </button>
                    <button type="submit" className="reception-search__button primary" disabled={masterSearchMutation.isPending}>
                      {masterSearchMutation.isPending ? '検索中…' : '患者検索'}
                    </button>
                  </div>
                </div>
              </form>

              {masterSearchNotice ? (
                <ToneBanner
                  tone={masterSearchNotice.tone}
                  message={masterSearchNotice.message}
                  destination="受付"
                  nextAction="検索結果を確認"
                  runId={masterSearchMeta?.runId ?? resolvedRunId}
                />
              ) : null}

              <div className="reception-master__results" role="status" aria-live={infoLive}>
                <div className="reception-master__results-meta">
                  <span>Api_Result: {masterSearchMeta?.apiResult ?? '—'}</span>
                  <span>records: {masterSearchMeta?.recordsReturned ?? masterSearchResults.length}</span>
                  <span>fetchedAt: {masterSearchMeta?.fetchedAt ?? '—'}</span>
                </div>
                {masterSearchResults.length === 0 ? (
                  <p className="reception-master__empty">検索結果がありません。条件を見直してください。</p>
                ) : (
                  <div className="reception-master__list" role="list">
                    {masterSearchResults.map((patient, index) => {
                      const key = patient.patientId ?? `${patient.name ?? 'unknown'}-${index}`;
                      const isSelected = masterSelected?.patientId === patient.patientId && Boolean(patient.patientId);
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`reception-master__row${isSelected ? ' is-selected' : ''}`}
                          onClick={() => handleSelectMasterPatient(patient)}
                          disabled={!patient.patientId}
                        >
                          <div className="reception-master__row-main">
                            <strong>{patient.name ?? '氏名未登録'}</strong>
                            <span>{patient.kana ?? 'カナ未登録'}</span>
                          </div>
                          <div className="reception-master__row-meta">
                            <span>患者ID: {patient.patientId ?? '未登録'}</span>
                            <span>生年月日: {patient.birthDate ?? '—'}</span>
                            <span>性別: {patient.sex ?? '—'}</span>
                            <span>保険: {patient.insuranceCount ?? 0}件</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
            ) : null}

            <div className="reception-status-tabs" role="region" aria-label="ステータスタブ">
              <div className="reception-status-tabs__header">
                <div className="reception-status-tabs__summary" ref={summaryRef} tabIndex={-1} role="status" aria-live={infoLive}>
                  <strong>{summaryText}</strong>
                  {appointmentQuery.isFetching ? (
                    <span className="reception-results-toolbar__loading">更新中…</span>
                  ) : null}
                </div>
              </div>
              <div className="reception-status-tabs__list" role="tablist" aria-label="受付ステータス">
                {STATUS_TAB_ORDER.map((status) => {
                  const isActive = status === activeStatusTab;
                  const count = groupedByStatus.get(status)?.length ?? 0;
                  const dotTone = statusExceptionTone.get(status);
                  return (
                    <button
                      key={status}
                      id={`reception-status-tab-${status}`}
                      type="button"
                      role="tab"
                      className={`reception-status-tabs__tab${isActive ? ' is-active' : ''}`}
                      aria-selected={isActive}
                      aria-controls={`reception-status-tabpanel-${status}`}
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => handleStatusTabChange(status)}
                      onKeyDown={handleStatusTabKeyDown}
                    >
                      <span>{SECTION_LABEL[status]}</span>
                      <span>{count}</span>
                      {dotTone ? <span className="reception-status-tabs__dot" data-tone={dotTone} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <section className="reception-list" role="region" aria-label="受付一覧">
              <div
                className="reception-status-tabs__panel"
                id={`reception-status-tabpanel-${activeStatusTab}`}
                role="tabpanel"
                aria-labelledby={`reception-status-tab-${activeStatusTab}`}
              >
                {statusListLayout === 'cards' ? (
                  <section className="reception-board__column" data-status={activeStatusTab} aria-label={`${activeStatusLabel}一覧`}>
                    <header className="reception-board__header">
                      <div className="reception-board__title">
                        <h2>{activeStatusLabel}</h2>
                        <span className="reception-board__count" aria-live={infoLive}>
                          {activeStatusItems.length}件
                        </span>
                      </div>
                    </header>
                    <div className="reception-board__body" role="list" aria-label={`${activeStatusLabel}の患者一覧`}>
                      {activeStatusItems.length === 0 ? (
                        <p className="reception-board__empty">「{activeStatusLabel}」に該当する患者はいません。</p>
                      ) : (
                        activeStatusItems.map((entry) => {
                          const status = activeStatusTab;
                          const bundle = resolveBundleForEntry(entry);
                          const billingProjection =
                            entry.billingProjection ??
                            (status === '会計待ち' || status === '会計済み' || status === '再計待'
                              ? resolveBillingProjectionForEntry(entry)
                              : undefined);
                          const correctionNote = formatCorrectionNote(billingProjection?.correction);
                          const paymentLabel = paymentModeLabel(entry.insurance);
                          const canOpenCharts = hasHandoffEncounterKey(entry);
                          const orcaQueueEntry = entry.patientId ? orcaQueueByPatientId.get(entry.patientId) : undefined;
                          const orcaQueueStatus = orcaQueueErrorStatus ?? resolveOrcaQueueStatus(orcaQueueEntry);
                          const mvpDecision = isReceptionStatusMvpEnabled
                            ? resolveRec001MvpDecision({
                                missingMaster: metaMissingMaster,
                                orcaQueueErrorMessage,
                                orcaQueueStatus,
                                orcaQueueEntry,
                                isSystemAdmin,
                                retrySupported: orcaQueueQuery.data?.retrySupported === true,
                              })
                            : null;
                          const cached = resolveClaimSendCacheForEntry(entry);
                          const isSelected = selectedEntryKey === entryKey(entry);
                          const rowKey =
                            entryKey(entry) ??
                            `${entry.patientId ?? 'unknown'}-${entry.appointmentTime ?? entry.department ?? 'card'}`;
                          const cardActionMenuKey = `${status}:${rowKey}`;
                          const cardActionMenuOpen = openCardActionMenuKey === cardActionMenuKey;
                          const billingSendGuard =
                            billingProjection?.workflow === '会計待ち'
                              ? resolveBillingSendGuard({
                                  entry,
                                  fallbackUsed: mergedMeta.fallbackUsed,
                                })
                              : null;
                          const billingSendBlockedReason =
                            billingSendGuard && !billingSendGuard.canSend ? billingSendGuard.visibleReason : null;
                          const billingSendBlockedTitle =
                            billingSendGuard && !billingSendGuard.canSend ? billingSendGuard.title : 'ORCAへ会計送信します';
                          const billingSendInProgress = claimSendingPatientId === entry.patientId;
                          const activeQueue = orcaQueueStatus;
                          const queueDetailVisible =
                            Boolean(activeQueue.detail) && (activeQueue.tone === 'warning' || activeQueue.tone === 'error');
                          const acceptanceTime = normalizeTimeLabel(
                            entry.acceptanceTime ?? (entry.source === 'visits' ? entry.appointmentTime : undefined),
                          );
                          const reservationTime =
                            normalizeTimeLabel(
                              entry.reservationTime ?? (entry.status === '予約' ? entry.appointmentTime : undefined),
                            ) ??
                            (entry.patientId ? reservationTimeByPatientId.get(entry.patientId.trim()) : undefined);
                          const visitKind =
                            status === '受付中' ? (reservationTime ? ('reserved' as const) : ('walkin' as const)) : null;
                          const elapsedMinutes =
                            status !== '予約' && acceptanceTime && isSelectedDateToday
                              ? computeElapsedMinutes(nowMs, selectedDate, acceptanceTime)
                              : null;
                          const elapsedSeverity =
                            elapsedMinutes === null
                              ? null
                              : elapsedMinutes >= 60
                                ? '3'
                                : elapsedMinutes >= 30
                                  ? '2'
                                  : elapsedMinutes >= 15
                                    ? '1'
                                    : '0';
                          const elapsedLabel =
                            elapsedMinutes === null ? null : `${status === '受付中' ? '待ち' : '経過'} ${elapsedMinutes}分`;
                          const mainTimeLabel = status === '予約' ? '予約' : '受付';
                          const mainTime = status === '予約' ? reservationTime : acceptanceTime;
                          const subTime = status !== '予約' ? reservationTime : null;
                          return (
                            <div
                              key={rowKey}
                              tabIndex={0}
                              role="button"
                              aria-pressed={isSelected}
                              className={`reception-card${isSelected ? ' is-selected' : ''}`}
                              data-test-id="reception-entry-card"
                              data-patient-id={entry.patientId ?? ''}
                              data-reception-status={status}
                              data-visit-kind={visitKind ?? undefined}
                              data-elapsed-severity={elapsedSeverity ?? undefined}
                              aria-label={`${entry.name ?? '患者'} ${entry.patientId ?? ''}`}
                              onClick={() => handleSelectRow(entry)}
                              onDoubleClick={() => handleRowDoubleClick(entry)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  handleRowDoubleClick(entry);
                                }
                                if (event.key === ' ') {
                                  event.preventDefault();
                                  handleSelectRow(entry);
                                }
                              }}
                            >
                              <div className="reception-card__summary">
                                <div className="reception-card__identity">
                                  {entry.kana ? <small className="reception-card__kana">{entry.kana}</small> : null}
                                  <strong className="reception-card__display-name">{entry.name ?? '未登録'}</strong>
                                </div>
                                <div>
                                  <span className="reception-card__patient-id" aria-label={`患者ID: ${entry.patientId ?? '未登録'}`}>
                                    {entry.patientId ?? '—'}
                                  </span>
                                  <small className="reception-table__sub">
                                    DOB: {entry.birthDate ?? '—'} / 性別: {entry.sex ?? '—'}
                                  </small>
                                </div>
                                {billingProjection ? (
                                  <div className="reception-card__billing-summary">
                                    <small className="reception-table__sub">請求: {billingProjection.workflow}</small>
                                    <small className="reception-table__sub" data-test-id="reception-billing-transmission">
                                      送信: {billingProjection.transmission}
                                    </small>
                                  </div>
                                ) : null}
                              </div>

                              <div className="reception-card__actions">
                                <button
                                  type="button"
                                  className="reception-card__action reception-card__action--primary"
                                  aria-label="カルテを開く（カード）"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenCardActionMenuKey(null);
                                    handleOpenCharts(entry);
                                  }}
                                  disabled={!canOpenCharts}
                                  title={canOpenCharts ? 'カルテを開く' : 'canonical key がないためカルテを開けません'}
                                >
                                  カルテ
                                </button>
                                <div>
                                  <div
                                    className={`reception-card__menu${cardActionMenuOpen ? ' is-open' : ''}`}
                                    data-card-actions-menu-root="true"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                    }}
                                    onKeyDown={(event) => {
                                      event.stopPropagation();
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="reception-card__action reception-card__action--menu-trigger"
                                      aria-label="カード操作を開く"
                                      aria-haspopup="menu"
                                      aria-expanded={cardActionMenuOpen}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setOpenCardActionMenuKey((prev) => (prev === cardActionMenuKey ? null : cardActionMenuKey));
                                      }}
                                    >
                                      その他
                                    </button>
                                    {cardActionMenuOpen ? (
                                      <div className="reception-card__submenu" role="menu" aria-label="カード追加操作">
                                        {status === '会計待ち' ? (
                                          <button
                                            type="button"
                                            className="reception-card__submenu-item primary"
                                            role="menuitem"
                                            aria-label="会計送信（カード）"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setOpenCardActionMenuKey(null);
                                              void handleSendBilling(entry);
                                            }}
                                            disabled={billingSendInProgress || billingSendGuard?.canSend === false}
                                            title={billingSendInProgress ? '送信中です' : billingSendBlockedTitle}
                                          >
                                            {billingSendInProgress ? '送信中…' : '会計送信'}
                                          </button>
                                        ) : null}
                                        {isReceptionStatusMvpPhase2 && mvpDecision?.canRetry ? (
                                          <button
                                            type="button"
                                            className="reception-card__submenu-item warning"
                                            role="menuitem"
                                            data-test-id="reception-status-mvp-retry"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setOpenCardActionMenuKey(null);
                                              void handleRetryQueue(entry);
                                            }}
                                            title={mvpDecision.retryTitle ?? 'ORCA再送を要求します'}
                                          >
                                            再送
                                          </button>
                                        ) : null}
                                        <button
                                          type="button"
                                          className="reception-card__submenu-item"
                                          role="menuitem"
                                          aria-label="過去カルテ（カード）"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setOpenCardActionMenuKey(null);
                                            openMedicalRecordsModal({ patientId: entry.patientId, name: entry.name }, 'selection');
                                          }}
                                          disabled={!entry.patientId}
                                          title={
                                            entry.patientId
                                              ? '過去カルテをモーダルで確認'
                                              : '患者IDが未登録のため過去カルテを表示できません'
                                          }
                                        >
                                          過去カルテ
                                        </button>
                                        <button
                                          type="button"
                                          className="reception-card__submenu-item danger"
                                          role="menuitem"
                                          aria-label="受付取消（カード）"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setOpenCardActionMenuKey(null);
                                            requestCancelEntry(entry, 'card');
                                          }}
                                          disabled={isAcceptSubmitting || !entry.patientId || !entry.receptionId || status === '予約'}
                                          title={
                                            isAcceptSubmitting
                                              ? '送信中です'
                                              : !entry.patientId
                                                ? '患者IDが未登録のため取消できません'
                                                : status === '予約'
                                                  ? '予約は受付取消できません'
                                                  : entry.receptionId
                                                    ? '受付取消'
                                                    : '受付IDが未登録のため取消できません'
                                          }
                                        >
                                          受付取消
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                  {billingSendBlockedReason ? (
                                    <small className="reception-table__sub">{billingSendBlockedReason}</small>
                                  ) : null}
                                </div>
                              </div>

                              {isSelected ? (
                                <div className="reception-card__expand" aria-label="カード詳細">
                                  <div className="reception-card__head">
                                    <div className="reception-card__time-block" aria-label={`${mainTimeLabel}: ${mainTime ?? '—'}`}>
                                      <div className="reception-card__time-main">
                                        <span className="reception-card__time-label">{mainTimeLabel}</span>
                                        <span className="reception-card__time-value">{mainTime ?? '—'}</span>
                                      </div>
                                      {subTime ? (
                                        <div className="reception-card__time-sub">
                                          <span className="reception-card__time-label">予約</span>
                                          <span className="reception-card__time-sub-value">{subTime}</span>
                                        </div>
                                      ) : null}
                                      <div className="reception-card__chips" aria-label="種別/経過">
                                        {status === '受付中' && visitKind ? (
                                          <span
                                            className="reception-card__chip reception-card__chip--kind"
                                            data-kind={visitKind}
                                            title={visitKind === 'reserved' ? '予約あり' : '予約なし（当日受付）'}
                                          >
                                            {visitKind === 'reserved' ? '予約患者' : '当日受付'}
                                          </span>
                                        ) : null}
                                        {elapsedLabel && elapsedSeverity ? (
                                          <span
                                            className="reception-card__chip reception-card__chip--elapsed"
                                            data-severity={elapsedSeverity}
                                            title={
                                              acceptanceTime
                                                ? `現在時刻との差: ${elapsedMinutes}分（受付 ${acceptanceTime}）`
                                                : undefined
                                            }
                                          >
                                            {elapsedLabel}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    <span className={`reception-badge reception-badge--${status}`} aria-label={`状態: ${SECTION_LABEL[status]}`}>
                                      {isReceptionStatusMvpEnabled ? (
                                        <span className="reception-status-mvp" data-test-id="reception-status-mvp">
                                          <span className="reception-status-mvp__dot" aria-hidden="true" data-status={status} />
                                          <span className="reception-status-mvp__label">{SECTION_LABEL[status]}</span>
                                        </span>
                                      ) : (
                                        SECTION_LABEL[status]
                                      )}
                                    </span>
                                  </div>
                                  <div className="reception-card__meta">
                                    {debugUiEnabled && entry.receptionId ? (
                                      <span>
                                        受付ID: <code>{entry.receptionId}</code>
                                      </span>
                                    ) : null}
                                    {debugUiEnabled && entry.appointmentId ? (
                                      <span>
                                        予約ID: <code>{entry.appointmentId}</code>
                                      </span>
                                    ) : null}
                                    <span>{entry.department ?? '—'}</span>
                                    {entry.physician ? <span>担当: {entry.physician}</span> : null}
                                    <span>直近: {resolveLastVisitForEntry(entry)}</span>
                                  </div>
                                  <div className="reception-card__signals">
                                    <StatusPill
                                      className="reception-pill"
                                      ariaLabel={`支払区分: ${paymentLabel}`}
                                      runId={resolvedRunId}
                                    >
                                      {paymentLabel}
                                    </StatusPill>
                                    {bundle?.claimStatus || bundle?.claimStatusText ? (
                                      <small>請求: {bundle.claimStatus ?? bundle.claimStatusText}</small>
                                    ) : null}
                                    {billingProjection ? (
                                      <small>送信: {billingProjection.transmission}</small>
                                    ) : null}
                                    {debugUiEnabled && cached?.invoiceNumber ? <small>invoice: {cached.invoiceNumber}</small> : null}
                                    {debugUiEnabled && cached?.dataId ? <small>data: {cached.dataId}</small> : null}
                                    <span className={`reception-queue reception-queue--${activeQueue.tone}`}>{activeQueue.label}</span>
                                    {queueDetailVisible ? <small>{truncateText(activeQueue.detail ?? '', 44)}</small> : null}
                                  </div>
                                  {correctionNote ? (
                                    <div className="reception-status-mvp__next" data-tone={billingProjection?.correction?.kind === '要再計' ? 'warning' : 'info'}>
                                      <strong data-test-id="reception-billing-correction-note">{correctionNote}</strong>
                                    </div>
                                  ) : null}
                                  {isReceptionStatusMvpPhase2 && mvpDecision ? (
                                    <div className="reception-status-mvp__next" data-tone={mvpDecision.tone}>
                                      <span className="reception-status-mvp__next-label">次:</span>
                                      <strong className="reception-status-mvp__next-action">{mvpDecision.nextAction}</strong>
                                      {mvpDecision.detail ? (
                                        <small className="reception-status-mvp__next-detail">{truncateText(mvpDecision.detail, 44)}</small>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                ) : (
                  <section className="reception-section" aria-label={`${activeStatusLabel}一覧`}>
                    <header className="reception-section__header">
                      <div>
                        <h2 id={`reception-section-label-${activeStatusTab}`}>{activeStatusLabel}</h2>
                        <span className="reception-section__count" aria-live={infoLive}>
                          {activeStatusItems.length} 件
                        </span>
                      </div>
                    </header>
                    <div
                      className="reception-table__wrapper"
                      role="region"
                      tabIndex={0}
                      aria-labelledby={`reception-section-label-${activeStatusTab}`}
                    >
                      <p id={`reception-section-help-${activeStatusTab}`} className="sr-only">
                        行クリックで選択状態を更新し、ダブルクリックまたは Enter で Charts（新規タブ）へ移動します。
                      </p>
                      <p
                        id={`reception-section-status-${activeStatusTab}`}
                        className="sr-only"
                        role="status"
                        aria-live={infoLive}
                        aria-atomic="true"
                      >
                        {selectedEntry && selectedEntry.status === activeStatusTab
                          ? selectionSummaryText
                          : `${activeStatusLabel} ${activeStatusItems.length}件`}
                      </p>
                      <table
                        className="reception-table"
                        aria-describedby={`reception-section-help-${activeStatusTab} reception-section-status-${activeStatusTab}`}
                      >
                        <thead>
                          <tr>
                            <th scope="col">ID</th>
                            <th scope="col">氏名</th>
                            <th scope="col">来院/科</th>
                            <th scope="col">支払</th>
                            <th scope="col">請求</th>
                            <th scope="col">メモ/参照</th>
                            <th scope="col">直近</th>
                            <th scope="col">ORCA</th>
                            <th scope="col">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeStatusItems.length === 0 ? (
                            <tr>
                              <td colSpan={tableColCount} className="reception-table__empty">
                                「{activeStatusLabel}」に該当する患者はいません。
                              </td>
                            </tr>
                          ) : null}
                          {activeStatusItems.map((entry) => {
                            const queueStatus = resolveQueueStatusForEntry(entry);
                            const bundle = resolveBundleForEntry(entry);
                            const billingProjection =
                              entry.billingProjection ??
                              (activeStatusTab === '会計待ち' || activeStatusTab === '会計済み' || activeStatusTab === '再計待'
                                ? resolveBillingProjectionForEntry(entry)
                                : undefined);
                            const correctionNote = formatCorrectionNote(billingProjection?.correction);
                            const paymentLabel = paymentModeLabel(entry.insurance);
                            const canOpenCharts = hasHandoffEncounterKey(entry);
                            const orcaQueueEntry = entry.patientId ? orcaQueueByPatientId.get(entry.patientId) : undefined;
                            const orcaQueueStatus = orcaQueueErrorStatus ?? resolveOrcaQueueStatus(orcaQueueEntry);
                            const displayedQueueStatus = isReceptionStatusMvpEnabled ? orcaQueueStatus : queueStatus;
                            const queueDetailVisible =
                              Boolean(displayedQueueStatus.detail) &&
                              (displayedQueueStatus.tone === 'warning' || displayedQueueStatus.tone === 'error');
                            const mvpDecision = isReceptionStatusMvpEnabled
                              ? resolveRec001MvpDecision({
                                  missingMaster: metaMissingMaster,
                                  orcaQueueErrorMessage,
                                  orcaQueueStatus,
                                  orcaQueueEntry,
                                  isSystemAdmin,
                                  retrySupported: orcaQueueQuery.data?.retrySupported === true,
                                })
                              : null;
                            const fallbackAppointmentId =
                              entry.receptionId ? undefined : entry.appointmentId ?? (entry.id ? String(entry.id) : undefined);
                            const isSelected = selectedEntryKey === entryKey(entry);
                            const rowKey =
                              entryKey(entry) ??
                              `${entry.patientId ?? 'unknown'}-${entry.appointmentTime ?? entry.department ?? 'row'}`;
                            const tableActionMenuKey = `table:${activeStatusTab}:${rowKey}`;
                            const tableActionMenuOpen = openCardActionMenuKey === tableActionMenuKey;
                            const billingSendGuard =
                              billingProjection?.workflow === '会計待ち'
                                ? resolveBillingSendGuard({
                                    entry,
                                    fallbackUsed: mergedMeta.fallbackUsed,
                                  })
                                : null;
                            const billingSendBlockedReason =
                              billingSendGuard && !billingSendGuard.canSend ? billingSendGuard.visibleReason : null;
                            const billingSendBlockedTitle =
                              billingSendGuard && !billingSendGuard.canSend ? billingSendGuard.title : 'ORCAへ会計送信します';
                            const billingSendInProgress = claimSendingPatientId === entry.patientId;
                            return (
                              <tr
                                key={rowKey}
                                tabIndex={0}
                                className={`reception-table__row${isSelected ? ' reception-table__row--selected' : ''}`}
                                onClick={() => handleSelectRow(entry)}
                                onDoubleClick={() => handleRowDoubleClick(entry)}
                                onKeyDown={(event) => {
                                  if (event.target !== event.currentTarget) return;
                                  if (event.key !== 'Enter') return;
                                  event.preventDefault();
                                  handleRowDoubleClick(entry);
                                }}
                                aria-selected={isSelected}
                                aria-label={`${entry.name ?? '患者'} ${entry.appointmentTime ?? ''} ${entry.department ?? ''}`}
                                data-test-id="reception-entry-row"
                                data-patient-id={entry.patientId ?? ''}
                                data-reception-status={activeStatusTab}
                              >
                                <td>
                                  <PatientMetaRow
                                    as="div"
                                    className="reception-table__id"
                                    patientId={entry.patientId ?? '未登録'}
                                    receptionId={entry.receptionId}
                                    appointmentId={fallbackAppointmentId}
                                    showLabels
                                    separator="slash"
                                    runId={resolvedRunId}
                                    itemClassName="reception-table__id-item"
                                    labelClassName="reception-table__id-label"
                                    valueClassName="reception-table__id-value"
                                  />
                                </td>
                                <td>
                                  <div className="reception-table__patient">
                                    <strong>{entry.name ?? '未登録'}</strong>
                                    <small className="reception-table__sub">{entry.kana ?? '—'}</small>
                                    <small className="reception-table__sub">
                                      DOB: {entry.birthDate ?? '—'} / 性別: {entry.sex ?? '—'}
                                    </small>
                                  </div>
                                </td>
                                <td>
                                  <div className="reception-table__time">{entry.appointmentTime ?? '-'}</div>
                                  <small className="reception-table__sub">{entry.department ?? '-'}</small>
                                </td>
                                <td className="reception-table__insurance">
                                  <StatusPill className="reception-pill" ariaLabel={`支払区分: ${paymentLabel}`} runId={resolvedRunId}>
                                    {paymentLabel}
                                  </StatusPill>
                                  <small className="reception-table__sub">{entry.insurance ?? '—'}</small>
                                </td>
                                <td className="reception-table__claim">
                                  <div>{billingProjection?.workflow ?? bundle?.claimStatus ?? bundle?.claimStatusText ?? '未確認'}</div>
                                  <small className="reception-table__sub" data-test-id="reception-billing-transmission">
                                    送信: {billingProjection?.transmission ?? '未送信'}
                                  </small>
                                  {bundle?.bundleNumber && debugUiEnabled ? (
                                    <small className="reception-table__sub">B: {bundle.bundleNumber}</small>
                                  ) : null}
                                  {(() => {
                                    const cached = resolveClaimSendCacheForEntry(entry);
                                    if (!cached) return null;
                                    return (
                                      <>
                                        {debugUiEnabled && cached.invoiceNumber ? (
                                          <small className="reception-table__sub">I: {cached.invoiceNumber}</small>
                                        ) : null}
                                        {debugUiEnabled && cached.dataId ? (
                                          <small className="reception-table__sub">D: {cached.dataId}</small>
                                        ) : null}
                                      </>
                                    );
                                  })()}
                                </td>
                                <td className="reception-table__note">
                                  {correctionNote ? (
                                    <small className="reception-table__sub" data-test-id="reception-billing-correction-note">
                                      {correctionNote}
                                    </small>
                                  ) : null}
                                  <div>{entry.note ? truncateText(entry.note, 36) : '—'}</div>
                                </td>
                                <td className="reception-table__last">{resolveLastVisitForEntry(entry)}</td>
                                <td className="reception-table__queue">
                                  <span
                                    className={`reception-queue reception-queue--${displayedQueueStatus.tone}`}
                                    aria-label={`ORCAキュー: ${displayedQueueStatus.label}${displayedQueueStatus.detail ? ` ${displayedQueueStatus.detail}` : ''}`}
                                  >
                                    {displayedQueueStatus.label}
                                  </span>
                                  {queueDetailVisible ? (
                                    <small className="reception-table__sub">{displayedQueueStatus.detail}</small>
                                  ) : null}
                                </td>
                                <td className="reception-table__action">
                                  {billingProjection?.workflow === '会計待ち' ? (
                                    <div>
                                      <button
                                        type="button"
                                        className="reception-card__action reception-card__action--primary"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setOpenCardActionMenuKey(null);
                                          void handleSendBilling(entry);
                                        }}
                                        disabled={billingSendInProgress || billingSendGuard?.canSend === false}
                                        title={billingSendInProgress ? '送信中です' : billingSendBlockedTitle}
                                      >
                                        {billingSendInProgress ? '会計送信中…' : '会計送信'}
                                      </button>
                                      {billingSendBlockedReason ? (
                                        <small className="reception-table__sub">{billingSendBlockedReason}</small>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="reception-card__action reception-card__action--primary"
                                    aria-label="カルテを開く"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setOpenCardActionMenuKey(null);
                                      handleOpenCharts(entry);
                                    }}
                                    disabled={!canOpenCharts}
                                    title={canOpenCharts ? 'カルテを開く' : 'canonical key がないためカルテを開けません'}
                                  >
                                    カルテ
                                  </button>
                                  <div
                                    className={`reception-card__menu${tableActionMenuOpen ? ' is-open' : ''}`}
                                    data-card-actions-menu-root="true"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                    }}
                                    onKeyDown={(event) => {
                                      event.stopPropagation();
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="reception-card__action reception-card__action--menu-trigger"
                                      aria-label="行の操作を開く"
                                      aria-haspopup="menu"
                                      aria-expanded={tableActionMenuOpen}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setOpenCardActionMenuKey((prev) => (prev === tableActionMenuKey ? null : tableActionMenuKey));
                                      }}
                                    >
                                      その他
                                    </button>
                                    {tableActionMenuOpen ? (
                                      <div className="reception-card__submenu" role="menu" aria-label="行の追加操作">
                                        <button
                                          type="button"
                                          className="reception-card__submenu-item"
                                          role="menuitem"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setOpenCardActionMenuKey(null);
                                            openMedicalRecordsModal({ patientId: entry.patientId, name: entry.name }, 'selection');
                                          }}
                                          disabled={!entry.patientId}
                                          title={
                                            entry.patientId
                                              ? '過去カルテをモーダルで確認'
                                              : '患者IDが未登録のため過去カルテを表示できません'
                                          }
                                        >
                                          過去カルテ
                                        </button>
                                        {isReceptionStatusMvpPhase2 && mvpDecision?.canRetry ? (
                                          <button
                                            type="button"
                                            className="reception-card__submenu-item warning"
                                            role="menuitem"
                                            data-test-id="reception-status-mvp-retry"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setOpenCardActionMenuKey(null);
                                              void handleRetryQueue(entry);
                                            }}
                                            title={mvpDecision.retryTitle ?? 'ORCA再送を要求します'}
                                          >
                                            再送
                                          </button>
                                        ) : null}
                                        <button
                                          type="button"
                                          className="reception-card__submenu-item danger"
                                          role="menuitem"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setOpenCardActionMenuKey(null);
                                            requestCancelEntry(entry, 'table');
                                          }}
                                          disabled={isAcceptSubmitting || !entry.patientId || !entry.receptionId || activeStatusTab === '予約'}
                                          title={
                                            isAcceptSubmitting
                                              ? '送信中です'
                                              : !entry.patientId
                                                ? '患者IDが未登録のため取消できません'
                                                : activeStatusTab === '予約'
                                                  ? '予約は受付取消できません'
                                                  : entry.receptionId
                                                    ? '受付取消'
                                                    : '受付IDが未登録のため取消できません'
                                          }
                                        >
                                          受付取消
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </div>
            </section>
          </div>

        </section>

        {debugUiEnabled ? (
          <OrderConsole
            masterSource={masterSource}
            missingMaster={tonePayload.missingMaster ?? true}
            cacheHit={tonePayload.cacheHit ?? false}
            missingMasterNote={missingMasterNote}
            runId={mergedMeta.runId ?? initialRunId ?? flags.runId}
            tone={tone}
            toneMessage={`${toneMessage} ｜ transition=${transitionMeta.label}`}
            patientId={selectedEntry?.patientId ?? patientId ?? ''}
            receptionId={selectedEntry?.receptionId ?? receptionId ?? ''}
            destination={destination}
            nextAction={tone === 'error' || mergedMeta.missingMaster ? MISSING_MASTER_RECOVERY_NEXT_ACTION : 'ORCA再送'}
            transitionDescription={transitionMeta.description}
            onMasterSourceChange={handleMasterSourceChange}
            onToggleMissingMaster={handleToggleMissingMaster}
            onToggleCacheHit={handleToggleCacheHit}
            onMissingMasterNoteChange={handleMissingMasterNoteChange}
          />
        ) : null}

        {debugUiEnabled ? <ReceptionAuditPanel runId={mergedMeta.runId} selectedEntry={selectedEntry} /> : null}

        {acceptWorkflowModalOpen ? (
          <section
            className="reception-accept-workflow-modal"
            role="region"
            aria-label="既存患者受付/患者検索"
            data-test-id="reception-accept-workflow-modal"
            data-run-id={resolvedRunId}
          >
            <header className="reception-accept-workflow-modal__header">
              <div className="reception-accept-workflow-modal__heading">
                <h2>既存患者受付/患者検索</h2>
                <p>既存患者を検索して選択し、当日受付を登録します。新患登録は Patients で行ってください。</p>
              </div>
              <button
                type="button"
                className="reception-search__button ghost"
                onClick={() => setAcceptWorkflowModalOpen(false)}
              >
                閉じる
              </button>
            </header>
            <div className="reception-accept-workflow-modal__body">
                <div className="reception-accept-modal" data-run-id={resolvedRunId}>
                  <section
                    className="reception-patient-search reception-patient-search--embedded reception-accept-modal__left"
                    aria-label="患者検索"
                    data-run-id={resolvedRunId}
                  >
                    <header className="reception-patient-search__header">
                      <h3>患者検索</h3>
                      <div className="reception-patient-search__header-actions">
                        <span className="reception-patient-search__meta" aria-live={infoLive}>
                          {patientSearchMutation.isPending
                            ? '検索中…'
                            : showPatientSearchPagination
                              ? `${patientSearchResults.length}件（${patientSearchRangeLabel}）`
                              : `${patientSearchResults.length}件`}
                        </span>
                        <button
                          type="button"
                          className="reception-search__button ghost"
                          onClick={clearPatientSearch}
                          disabled={patientSearchMutation.isPending && patientSearchResults.length === 0}
                        >
                          クリア
                        </button>
                      </div>
                    </header>

                    <form
                      className="reception-patient-search__form"
                      onSubmit={handlePatientSearchSubmit}
                      data-test-id="reception-patient-search-form"
                    >
                      <div className="reception-patient-search__row">
                        <label className="reception-patient-search__field">
                          <span>患者ID</span>
                          <input
                            id="reception-patient-search-patient-id"
                            name="receptionPatientSearchPatientId"
                            type="search"
                            inputMode="numeric"
                            autoComplete="off"
                            value={patientSearchPatientId}
                            onChange={(event) => setPatientSearchPatientId(event.target.value)}
                            placeholder="000001"
                          />
                        </label>
                      </div>
                      <div className="reception-patient-search__grid">
                        <label className="reception-patient-search__field">
                          <span>氏名（姓）</span>
                          <input
                            id="reception-patient-search-name-sei"
                            name="receptionPatientSearchNameSei"
                            type="search"
                            autoComplete="off"
                            value={patientSearchNameSei}
                            onChange={(event) => setPatientSearchNameSei(event.target.value)}
                            placeholder="山田"
                          />
                        </label>
                        <label className="reception-patient-search__field">
                          <span>氏名（名）</span>
                          <input
                            id="reception-patient-search-name-mei"
                            name="receptionPatientSearchNameMei"
                            type="search"
                            autoComplete="off"
                            value={patientSearchNameMei}
                            onChange={(event) => setPatientSearchNameMei(event.target.value)}
                            placeholder="太郎"
                          />
                        </label>
                        <label className="reception-patient-search__field">
                          <span>カナ（セイ）</span>
                          <input
                            id="reception-patient-search-kana-sei"
                            name="receptionPatientSearchKanaSei"
                            type="search"
                            autoComplete="off"
                            value={patientSearchKanaSei}
                            onChange={(event) => setPatientSearchKanaSei(event.target.value)}
                            placeholder="ヤマダ"
                          />
                        </label>
                        <label className="reception-patient-search__field">
                          <span>カナ（メイ）</span>
                          <input
                            id="reception-patient-search-kana-mei"
                            name="receptionPatientSearchKanaMei"
                            type="search"
                            autoComplete="off"
                            value={patientSearchKanaMei}
                            onChange={(event) => setPatientSearchKanaMei(event.target.value)}
                            placeholder="タロウ"
                          />
                        </label>
                      </div>
                      <div className="reception-patient-search__buttons">
                        <button
                          type="submit"
                          className="reception-search__button primary"
                          disabled={patientSearchMutation.isPending}
                          data-test-id="reception-patient-search-submit"
                        >
                          {patientSearchMutation.isPending ? '検索中…' : '検索'}
                        </button>
                      </div>
                    </form>

                    {patientSearchError ? (
                      <ToneBanner
                        tone="error"
                        message={patientSearchError}
                        destination="受付"
                        nextAction="条件を見直す"
                        runId={patientSearchMeta?.runId ?? resolvedRunId}
                        ariaLive="assertive"
                      />
                    ) : null}

                    <section
                      className="reception-accept-modal__search-results"
                      role="region"
                      aria-label="患者検索結果モーダル"
                      data-run-id={resolvedRunId}
                    >
                      <header className="reception-accept-modal__results-header">
                        <div>
                          <h3>患者検索結果</h3>
                          <span className="reception-patient-search__meta" aria-live={infoLive}>
                            {patientSearchMutation.isPending
                              ? '検索中…'
                              : showPatientSearchPagination
                                ? `${patientSearchResults.length}件（${patientSearchRangeLabel}）`
                                : `${patientSearchResults.length}件`}
                          </span>
                        </div>
                      </header>
                      <div className="reception-accept-modal__results-body">
                        <div className="reception-patient-search__list" role="list" aria-label="検索結果">
                          {patientSearchMutation.isPending ? (
                            <p className="reception-sidepane__empty">検索中…</p>
                          ) : patientSearchResults.length === 0 ? (
                            <p className="reception-sidepane__empty">検索結果がありません。</p>
                          ) : (
                            pagedPatientSearchResults.map((patient, pageIndex) => {
                              const index = (patientSearchPage - 1) * PATIENT_SEARCH_PAGE_SIZE + pageIndex;
                              const key = patient.patientId ?? `${patient.name ?? 'unknown'}-${index}`;
                              const resolvedPatientId = patient.patientId?.trim() ?? '';
                              const isSelected =
                                patientSearchSelected === patient ||
                                (Boolean(resolvedPatientId) &&
                                  Boolean(patientSearchSelected?.patientId) &&
                                  resolvedPatientId === patientSearchSelected?.patientId);
                              const chartsHandoffCandidate = resolvePatientChartsHandoff({
                                patientId: resolvedPatientId,
                                acceptedHandoff:
                                  acceptedChartsHandoff?.encounter.patientId === resolvedPatientId ? acceptedChartsHandoff : null,
                                entries: displayedEntries,
                              });
                              const canOpenCharts = chartsHandoffCandidate.kind === 'ready';
                              const patientSearchOpenChartsTitle =
                                chartsHandoffCandidate.kind === 'ready'
                                  ? chartsHandoffCandidate.source === 'accepted'
                                    ? '直前に確立した canonical handoff でカルテを開く'
                                    : '当日の受付から一意に解決した canonical handoff でカルテを開く'
                                  : chartsHandoffCandidate.reason === 'ambiguous_active_entries'
                                    ? '同一患者の active entry が複数あるためカルテを開けません'
                                    : chartsHandoffCandidate.reason === 'missing_handoff_key'
                                      ? '当日の受付に canonical key がないためカルテを開けません'
                                      : '当日の active entry がないためカルテを開けません';
                              return (
                                <div
                                  key={key}
                                  className={`reception-patient-search__item${isSelected ? ' is-selected' : ''}`}
                                  role="listitem"
                                  tabIndex={0}
                                  aria-label={`${patient.name ?? '氏名未登録'} ${
                                    resolvedPatientId ? `ID: ${resolvedPatientId}` : '（未登録ID）'
                                  }`}
                                  onClick={() => handleSelectPatientSearchResult(patient)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      handleSelectPatientSearchResult(patient);
                                    }
                                  }}
                                >
                                  <div className="reception-patient-search__item-main">
                                    <strong>{patient.name ?? '氏名未登録'}</strong>
                                    <span className="reception-patient-search__item-id">ID: {patient.patientId ?? '—'}</span>
                                  </div>
                                  {isSelected ? (
                                    <div className="reception-patient-search__item-actions" role="group" aria-label="患者操作">
                                      <button
                                        type="button"
                                        className="reception-search__button ghost"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openMedicalRecordsModal({ patientId: patient.patientId, name: patient.name }, 'search');
                                        }}
                                        onKeyDown={(event) => {
                                          event.stopPropagation();
                                        }}
                                        disabled={!resolvedPatientId}
                                        title={
                                          resolvedPatientId
                                            ? '過去カルテをモーダルで確認'
                                            : '患者IDが未登録のため過去カルテを表示できません'
                                        }
                                      >
                                        過去カルテ
                                      </button>
                                      <button
                                        type="button"
                                        className="reception-search__button primary"
                                        data-test-id="reception-patient-search-open-charts"
                                        data-schedule-key={
                                          chartsHandoffCandidate.kind === 'ready'
                                            ? chartsHandoffCandidate.encounter.scheduleKey ?? ''
                                            : ''
                                        }
                                        data-encounter-key={
                                          chartsHandoffCandidate.kind === 'ready'
                                            ? chartsHandoffCandidate.encounter.encounterKey ?? ''
                                            : ''
                                        }
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (!resolvedPatientId) return;
                                          if (chartsHandoffCandidate.kind === 'ready') {
                                            openChartsWithEncounter(
                                              chartsHandoffCandidate.encounter,
                                              'patient_search',
                                              buildReceptionEncounterFromEntry(chartsHandoffCandidate.encounter),
                                            );
                                            return;
                                          }
                                          enqueue({
                                            tone: 'warning',
                                            message: 'カルテを開くための canonical key が見つかりません。',
                                            detail:
                                              chartsHandoffCandidate.reason === 'ambiguous_active_entries'
                                                ? '同一患者の active entry が複数あるため、対象の受付を 1 件に絞ってください。'
                                                : '当日の受付から canonical key を受け取れる患者のみカルテを開けます。',
                                          });
                                        }}
                                        onKeyDown={(event) => {
                                          event.stopPropagation();
                                        }}
                                        disabled={!canOpenCharts}
                                        title={patientSearchOpenChartsTitle}
                                      >
                                        カルテを開く
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                        {showPatientSearchPagination ? (
                          <nav className="reception-patient-search__pagination" aria-label="検索結果ページ">
                            <span className="reception-patient-search__pagination-range">{patientSearchRangeLabel}</span>
                            <div className="reception-patient-search__pagination-actions">
                              <button
                                type="button"
                                className="reception-search__button ghost"
                                onClick={() => setPatientSearchPage((prev) => Math.max(1, prev - 1))}
                                disabled={patientSearchPage <= 1}
                              >
                                前へ
                              </button>
                              <span
                                className="reception-patient-search__pagination-page"
                                data-test-id="reception-patient-search-page-indicator"
                              >
                                {patientSearchPage} / {patientSearchTotalPages}
                              </span>
                              <button
                                type="button"
                                className="reception-search__button ghost"
                                onClick={() => setPatientSearchPage((prev) => Math.min(patientSearchTotalPages, prev + 1))}
                                disabled={patientSearchPage >= patientSearchTotalPages}
                              >
                                次へ
                              </button>
                            </div>
                          </nav>
                        ) : null}
                      </div>
                    </section>
                  </section>

                  <section
                    className="reception-accept-modal__right"
                    role="region"
                    aria-label="受付登録モーダル"
                    data-run-id={resolvedRunId}
                  >
                    <header className="reception-accept-modal__accept-header">
                      <div>
                        <h3>受付登録</h3>
                        <p className="reception-accept-modal__selected-patient">
                          選択患者: {selectedPatientName}
                        </p>
                      </div>
                    </header>
                    <div className="reception-accept-modal__accept">
                      {selectedPatientId ? (
                        <>
                          {renderAcceptDetailPanel('modal')}
                          <div className="reception-accept-modal__submit">
                            <button
                              type="button"
                              className="reception-search__button primary"
                              onClick={(event) => void handleAcceptRegister(event)}
                              disabled={isAcceptSubmitting || acceptRegisterDecision.disabled}
                              aria-disabled={isAcceptSubmitting || acceptRegisterDecision.disabled}
                              data-test-id="reception-accept-register"
                              title={acceptRegisterDecision.reason}
                            >
                              {isAcceptSubmitting ? '受付中…' : '受付する'}
                            </button>
                            <p className="reception-accept-modal__submit-hint" aria-live={infoLive}>
                              {acceptRegisterDecision.reason ?? '必須項目を入力すると受付できます。'}
                            </p>
                          </div>
                        </>
                      ) : (
                        <p className="reception-sidepane__empty">
                          左の患者検索結果カードを選択すると、受付設定と「受付する」ボタンが表示されます。
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              </div>
          </section>
        ) : null}

        <FocusTrapDialog
          open={exceptionsModalOpen}
          title={`例外一覧（${exceptionCounts.total}件）`}
          description="送信エラー・遅延・未承認の詳細を確認します。"
          onClose={closeExceptionsModal}
          testId="reception-exceptions-modal"
        >
          <div className="reception-modal__actions">
            <button type="button" className="reception-search__button ghost" onClick={closeExceptionsModal}>
              閉じる
            </button>
          </div>
          <ReceptionExceptionList
            variant="modal"
            items={exceptionItems}
            counts={exceptionCounts}
            runId={mergedMeta.runId}
            claimEnabled={claimOutpatientEnabled}
            onSelectEntry={(entry) => {
              handleSelectEntry(entry);
              closeExceptionsModal();
            }}
            onOpenCharts={handleOpenCharts}
            onRetryQueue={handleRetryQueue}
            retryingPatientId={retryingPatientId}
          />
        </FocusTrapDialog>

        <FocusTrapDialog
          open={Boolean(cancelConfirmState)}
          title="受付取消の確認"
          description="患者同定情報と受付情報を確認してから取消を実行します。"
          onClose={closeCancelConfirm}
          testId="reception-cancel-confirm-modal"
        >
          {cancelConfirmState ? (
            <>
              <p>
                この受付を取消します。実行後は受付一覧へ反映されます。
              </p>
              <PatientIdentityBar
                className="reception-cancel__identity-bar"
                eyebrow="受付取消"
                title={cancelConfirmState.entry.name ?? '取消対象'}
                patientId={cancelConfirmState.entry.patientId}
                patientKana={cancelConfirmState.entry.kana}
                receptionId={cancelConfirmState.entry.receptionId}
                appointmentId={cancelConfirmState.entry.appointmentId}
                sex={cancelConfirmState.entry.sex}
                note={`氏名: ${cancelConfirmState.entry.name ?? '—'} / 状態: ${
                  SECTION_LABEL[cancelConfirmState.entry.status] ?? cancelConfirmState.entry.status
                }`}
                selected
              />
              <p>
                氏名: {cancelConfirmState.entry.name ?? '—'} / 状態: {SECTION_LABEL[cancelConfirmState.entry.status] ?? cancelConfirmState.entry.status}
              </p>
              <label className="reception-accept__field">
                <span>取消理由（任意）</span>
                <input
                  id="reception-cancel-reason"
                  type="text"
                  value={cancelConfirmState.reason}
                  onChange={(event) =>
                    setCancelConfirmState((prev) =>
                      prev
                        ? {
                            ...prev,
                            reason: event.target.value,
                          }
                        : prev,
                    )
                  }
                  placeholder="例: 誤受付のため"
                />
              </label>
              <div className="reception-modal__actions">
                <button type="button" className="reception-search__button ghost" onClick={closeCancelConfirm}>
                  戻る
                </button>
                <button
                  type="button"
                  className="reception-search__button danger"
                  onClick={handleConfirmCancelEntry}
                  disabled={isAcceptSubmitting}
                >
                  {isAcceptSubmitting ? '取消中…' : '取消を実行'}
                </button>
              </div>
            </>
          ) : null}
        </FocusTrapDialog>

        <FocusTrapDialog
          open={Boolean(recordsModalPatientId)}
          title={`過去カルテ（${recordsModalPatientLabel}）`}
          description={recordsModalPatientId ? `患者ID: ${recordsModalPatientId}` : undefined}
          onClose={closeMedicalRecordsModal}
          testId="reception-medical-records-modal"
        >
          <div className="reception-modal__actions">
            {medicalRecordsModalQuery.data?.runId ? <RunIdBadge runId={medicalRecordsModalQuery.data.runId} /> : null}
            <button type="button" className="reception-search__button ghost" onClick={closeMedicalRecordsModal}>
              閉じる
            </button>
          </div>
          {!recordsModalPatientId ? null : medicalRecordsModalQuery.isFetching ? (
            <p className="reception-sidepane__empty">過去カルテを取得中…</p>
          ) : medicalRecordsModalQuery.isError ? (
            <ToneBanner
              tone="error"
              message={`過去カルテの取得に失敗しました: ${
                medicalRecordsModalQuery.error instanceof Error ? medicalRecordsModalQuery.error.message : 'unknown'
              }`}
              destination="受付"
              nextAction="条件を見直す"
              runId={medicalRecordsModalQuery.data?.runId ?? resolvedRunId}
              ariaLive="assertive"
            />
          ) : medicalRecordsModalQuery.data?.records?.length ? (
            <div className="reception-history__list" role="list" aria-label="過去カルテ一覧">
              {medicalRecordsModalQuery.data.records.map((record: MedicalRecordEntry, index: number) => {
                const key =
                  record.documentId ?? record.sequentialNumber ?? `${record.performDate ?? 'unknown'}-${index}`;
                const deptLabel = record.departmentName?.trim() || record.departmentCode?.trim();
                const metaParts = [
                  deptLabel ? `科: ${deptLabel}` : undefined,
                  record.sequentialNumber ? `連番: ${record.sequentialNumber}` : undefined,
                  record.documentStatus ? `状態: ${record.documentStatus}` : undefined,
                ].filter((value): value is string => Boolean(value));
                return (
                  <div key={key} className="reception-history__item" role="listitem">
                    <strong>{record.performDate ?? '—'}</strong>
                    <small>{metaParts.join(' / ') || '—'}</small>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="reception-sidepane__empty">過去カルテがありません。</p>
          )}
        </FocusTrapDialog>
      </main>
    </>
  );
}
