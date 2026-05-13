import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation, useSearchParams } from 'react-router-dom';

import { getAuditEventLog, logAuditEvent, logUiState, type AuditEventRecord } from '../../libs/audit/auditLogger';
import { resolveAriaLive, resolveRunId } from '../../libs/observability/observability';
import { getChartToneDetails, type ChartTonePayload } from '../../ux/charts/tones';
import { ApiFailureBanner } from '../shared/ApiFailureBanner';
import { AdminBroadcastBanner } from '../shared/AdminBroadcastBanner';
import { MissingMasterRecoveryGuide } from '../shared/MissingMasterRecoveryGuide';
import { PatientIdentityBar } from '../shared/PatientIdentityBar';
import { RunIdBadge } from '../shared/RunIdBadge';
import { StatusPill } from '../shared/StatusPill';
import { AuditSummaryInline } from '../shared/AuditSummaryInline';
import { resolveCacheHitTone, resolveMetaFlagTone, resolveTransitionTone } from '../shared/metaPillRules';
import {
  OUTPATIENT_AUTO_REFRESH_INTERVAL_MS,
  formatAutoRefreshTimestamp,
  resolveAutoRefreshIntervalMs,
  useAutoRefreshNotice,
} from '../shared/autoRefreshNotice';
import { MISSING_MASTER_RECOVERY_NEXT_ACTION } from '../shared/missingMasterRecovery';
import { ToneBanner } from '../reception/components/ToneBanner';
import { applyAuthServicePatch, useAuthService, type AuthServiceFlags, type DataSourceTransition } from '../charts/authService';
import { loadChartsEncounterContext, normalizeEncounterContext, normalizeVisitDate } from '../charts/encounterContext';
import { useSession } from '../../AppRouter';
import { applyExternalParams, isSafeReturnTo, pickExternalParams } from '../../routes/appNavigation';
import { useNavigationGuard } from '../../routes/NavigationGuardProvider';
import { useAppNavigation } from '../../routes/useAppNavigation';
import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { PatientFormErrorAlert } from './PatientFormErrorAlert';
import { useAppToast } from '../../libs/ui/appToast';
import { useAdminBroadcast } from '../../libs/admin/useAdminBroadcast';
import {
  createOfficialPatient,
  searchLocalPatients,
  updateOfficialPatient,
  type LocalPatientSearchParams,
  type OfficialPatientCreatePayload,
  type OfficialPatientUpdatePayload,
  type PatientListResponse,
  type PatientMutationResult,
  type PatientRecord,
} from './api';
import { importPatientsFromOrca, type OrcaPatientImportResult } from '../outpatient/orcaPatientImportApi';
import { fetchOrcaAddress } from './orcaAddressApi';
import { PATIENT_FIELD_LABEL, diffPatientKeys } from './patientDiff';
import { validatePatientMutation, type PatientOperation, type PatientValidationError } from './patientValidation';
import {
  loadOutpatientSavedViews,
  removeOutpatientSavedView,
  type OutpatientSavedView,
  type PaymentMode,
  upsertOutpatientSavedView,
} from '../outpatient/savedViews';
import { buildScopedStorageKey } from '../../libs/session/storageScope';
import './patients.css';

const FILTER_STORAGE_KEY = 'patients-filter-state';
const RECEPTION_FILTER_STORAGE_KEY = 'reception-filter-state';
const SIDEBAR_WIDTH_STORAGE_BASE = 'opendolphin:web-client:patients:sidebarWidth';
const SIDEBAR_WIDTH_STORAGE_VERSION = 'v1';
const SIDEBAR_WIDTH_LEGACY_KEY = `${SIDEBAR_WIDTH_STORAGE_BASE}:v1`;
const SIDEBAR_WIDTH_DEFAULT = 380;
const SIDEBAR_WIDTH_MIN = 320;
const SIDEBAR_WIDTH_MAX = 520;
const SIDEBAR_WIDTH_KEY_STEP = 16;
const PATIENTS_SUPPORT_GUIDE = '必要に応じて RUN_ID コピーで実行IDを共有してください。';

const DEFAULT_FILTER = {
  keyword: '',
  department: '',
  physician: '',
  paymentMode: 'all' as 'all' | 'insurance' | 'self',
};

const toLocalDateYmd = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeZipCode = (value?: string | null) => (value ?? '').replace(/\D/g, '');

const normalizePaymentMode = (value?: string | null): PaymentMode | undefined =>
  value === 'insurance' || value === 'self' ? value : undefined;

const resolvePatientSearchType = (keyword: string | undefined): LocalPatientSearchParams['searchType'] | undefined => {
  if (!keyword) return undefined;
  const normalized = keyword.trim();
  if (!normalized) return undefined;
  if (/^\d{3}-\d{4}$/.test(normalized)) return 'zipcode';
  if (/^\d[\d-]{8,}$/.test(normalized)) return 'telephone';
  if (/^\d+$/.test(normalized)) return 'patient-id';
  if (/^[ぁ-んァ-ヶー]+$/.test(normalized)) return 'kana';
  return 'name';
};

const toSearchParams = () => {
  const params = new URLSearchParams();
  return params;
};

const isSameFilter = (left: typeof DEFAULT_FILTER, right: typeof DEFAULT_FILTER) =>
  left.keyword === right.keyword &&
  left.department === right.department &&
  left.physician === right.physician &&
  left.paymentMode === right.paymentMode;

const buildPatientEditBlockReason = (
  kind: 'missing_master' | 'fallback_used' | 'not_server_route',
  transition?: DataSourceTransition,
) => {
  if (kind === 'missing_master') {
    return `ORCA 参照が不足しているため編集を停止中です。${MISSING_MASTER_RECOVERY_NEXT_ACTION}してください。`;
  }
  if (kind === 'fallback_used') {
    return `暫定データ表示中のため編集を停止中です。${MISSING_MASTER_RECOVERY_NEXT_ACTION}してください。`;
  }
  if (transition && transition !== 'server' && transition !== 'local') {
    return '最新データを確認できる画面へ戻ってから編集してください。';
  }
  return '現在の状態では編集できません。';
};

const buildPatientsOrcaStatus = (options: {
  action?: 'create' | 'update' | 'import' | null;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  dataSourceTransition?: DataSourceTransition;
  lastSaveSucceeded?: boolean;
  lastSaveFailed?: boolean;
  lastSaveWriteAcceptedWithoutReadback?: boolean;
  lastErrorCategory?: string;
}) => {
  const actionLabel = options.action === 'import' ? 'ORCA既存患者取込' : '患者情報の登録・更新';
  if (options.missingMaster) {
    return {
      state: '同期停止',
      detail: `ORCA 参照が不足しているため同期確認を停止中です。${MISSING_MASTER_RECOVERY_NEXT_ACTION}してください。`,
    };
  }
  if (options.fallbackUsed) {
    return {
      state: '同期停止',
      detail: `暫定データ表示中のため同期確認を停止中です。${MISSING_MASTER_RECOVERY_NEXT_ACTION}してください。`,
    };
  }
  if (options.dataSourceTransition === 'local') {
    return {
      state: '院内ローカル',
      detail: '院内ローカル患者情報を編集中です。',
    };
  }
  if ((options.dataSourceTransition ?? 'server') !== 'server') {
    return {
      state: '同期停止',
      detail: '最新データを確認できる画面へ戻ってから同期状態を確認してください。',
    };
  }
  if (options.lastSaveFailed) {
    return {
      state: '同期失敗',
      detail: `${actionLabel}に失敗しました。時間をおいて再試行してください。`,
    };
  }
  if (options.lastSaveWriteAcceptedWithoutReadback) {
    if (options.lastErrorCategory === 'business_partial') {
      return {
        state: '一部処理',
        detail: `${actionLabel}は一部のみ処理されました。結果を確認してください。`,
      };
    }
    return {
      state: '同期確認失敗',
      detail: `${actionLabel}は受け付けられましたが、ORCA正本の再取得による同期確認が完了していません。`,
    };
  }
  if (options.lastSaveSucceeded) {
    return {
      state: '同期確認済',
      detail: `${actionLabel}は ORCA正本の再取得まで完了しました。必要なら監査ログで結果を確認してください。`,
    };
  }
  return {
    state: '同期可能',
    detail: options.action === 'import' ? 'ORCA既存患者取込を実行できます。' : '患者情報を登録・更新できます。',
  };
};

const buildImportAuditEvent = (patientId: string, result: OrcaPatientImportResult) => {
  const fallbackMessage = result.writeAccepted
    ? 'ORCA既存患者取込は受け付けられましたが、ORCA正本の再取得による同期確認が完了していません。'
    : 'ORCA既存患者取込に失敗しました。';
  return {
    action: 'ORCA_OFFICIAL_IMPORT_PATIENT',
    outcome: result.ok ? 'success' : result.writeAccepted ? 'warning' : 'error',
    subject: 'patients',
    runId: result.runId,
    details: {
      patientId,
      status: result.status,
      writeAccepted: result.writeAccepted ?? false,
      businessOk: result.businessOk ?? false,
      errorCategory: result.errorCategory,
      importApiResult: result.importSummary?.apiResult,
      importApiResultMessage: result.importSummary?.apiResultMessage,
      importRequestedCount: result.importSummary?.requestedCount,
      importFetchedCount: result.importSummary?.fetchedCount,
      importCreatedCount: result.importSummary?.createdCount,
      importUpdatedCount: result.importSummary?.updatedCount,
      importImportedCount: result.importSummary?.importedCount,
      importSkippedCount: result.importSummary?.skippedCount,
      importErrorsCount: result.importSummary?.errorsCount,
      canonicalRefetchSource: result.canonicalRefetch?.source,
      canonicalRefetchOk: result.canonicalRefetch?.ok,
      canonicalRefetchStatus: result.canonicalRefetch?.status,
      canonicalRefetchExpectedPatientIds: result.canonicalRefetch?.expectedPatientIds,
      canonicalRefetchMatchedPatientIds: result.canonicalRefetch?.matchedPatientIds,
      canonicalRefetchMissingPatientIds: result.canonicalRefetch?.missingPatientIds,
      message: result.ok ? 'ORCA既存患者取込は ORCA正本の再取得で同期確認しました。' : toSafePatientFeedbackMessage(result.error, fallbackMessage),
    },
  } satisfies Record<string, unknown>;
};

const INTERNAL_PATIENT_COPY_PATTERN =
  /\b(?:canonical|patientmodv2|full-success)\b|canonical\/local|local sync|official write|official ORCA|readback/i;

const toSafePatientFeedbackMessage = (message: string | undefined, fallback: string): string => {
  if (!message) return fallback;
  return INTERNAL_PATIENT_COPY_PATTERN.test(message) ? fallback : message;
};

const toImportSaveResult = (result: OrcaPatientImportResult): PatientMutationResult => {
  const fallbackMessage = result.writeAccepted
    ? 'ORCA既存患者取込は受け付けられましたが、ORCA正本の再取得による同期確認が完了していません。'
    : 'ORCA既存患者取込に失敗しました。';
  return {
    ok: result.ok,
    writeAccepted: result.writeAccepted,
    errorCategory: result.errorCategory,
    runId: result.runId,
    status: result.status,
    message:
      result.ok
        ? 'ORCA既存患者取込は ORCA正本の再取得で同期確認しました。'
        : toSafePatientFeedbackMessage(result.error, fallbackMessage),
    canonicalRefetch: result.canonicalRefetch,
  };
};

const buildPatientsToneMessage = (payload: ChartTonePayload) => {
  if (payload.missingMaster) {
    return `ORCA 参照が不足しています。${MISSING_MASTER_RECOVERY_NEXT_ACTION}してから再開してください。`;
  }
  if (payload.cacheHit) {
    return '前回取得した参照情報を表示しています。必要なら再取得してください。';
  }
  if (payload.dataSourceTransition === 'local') {
    return '院内ローカル患者情報を表示中です。';
  }
  if (payload.dataSourceTransition !== 'server') {
    return '最新データ確認前の参照状態です。必要なら再取得してください。';
  }
  return '最新データを確認しながら患者情報を編集できます。';
};

const pickString = (value: unknown): string | undefined => (typeof value === 'string' && value.length > 0 ? value : undefined);

const readStorageJson = (key: string) => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const readFilters = (
  searchParams: URLSearchParams,
  carryover?: {
    kw?: string;
    keyword?: string;
  } | null,
): typeof DEFAULT_FILTER => {
  const receptionStored = readStorageJson(RECEPTION_FILTER_STORAGE_KEY);
  const patientStored = readStorageJson(FILTER_STORAGE_KEY);
  const dropUndefined = (value: Partial<typeof DEFAULT_FILTER>) =>
    Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<typeof DEFAULT_FILTER>;

  const fromUrl: Partial<typeof DEFAULT_FILTER> = {
    department: searchParams.get('dept') ?? undefined,
    physician: searchParams.get('phys') ?? undefined,
    paymentMode: normalizePaymentMode(searchParams.get('pay')),
  };
  const carryoverKeyword = pickString(carryover?.kw) ?? pickString(carryover?.keyword);

  const normalizedReception: Partial<typeof DEFAULT_FILTER> = {
    department: (receptionStored?.dept as string | undefined) ?? undefined,
    physician: (receptionStored?.phys as string | undefined) ?? undefined,
    paymentMode: normalizePaymentMode(receptionStored?.pay as string | undefined),
  };

  const normalizedPatients: Partial<typeof DEFAULT_FILTER> = {
    department: (patientStored?.department as string | undefined) ?? (patientStored?.dept as string | undefined),
    physician: (patientStored?.physician as string | undefined) ?? (patientStored?.phys as string | undefined),
    paymentMode: normalizePaymentMode(patientStored?.paymentMode as string | undefined),
  };

  return {
    ...DEFAULT_FILTER,
    ...(carryoverKeyword ? { keyword: carryoverKeyword } : {}),
    ...dropUndefined(normalizedReception),
    ...dropUndefined(normalizedPatients),
    ...dropUndefined(fromUrl),
  } as typeof DEFAULT_FILTER;
};

const normalizeAuditValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').toLowerCase();
};

const buildImportDisabledReason = (pending: boolean, patientId: string) => {
  if (pending) {
    return '取込中は再実行できません。完了メッセージを待ってから再試行してください。';
  }
  if (!patientId.trim()) {
    return '患者ID（数字のみ）を入力すると取込を実行できます。';
  }
  return undefined;
};

const isImportablePatientId = (value: string | undefined | null): value is string => {
  const normalized = value?.trim();
  return Boolean(normalized && /^\d{1,16}$/.test(normalized));
};

const buildAddressLookupDisabledReason = (blocking: boolean, zip: string, pending: boolean) => {
  if (blocking) {
    return '編集ブロック中のため住所補完を停止しています。ブロック理由を解消してから再試行してください。';
  }
  if (pending) {
    return '住所補完中です。完了を待ってから再試行してください。';
  }
  if (normalizeZipCode(zip).length !== 7) {
    return '住所補完には7桁の郵便番号が必要です。';
  }
  return undefined;
};

const clampSidebarWidth = (value: number) => Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, value));

const resolveUnlinkedState = (patient?: PatientRecord | null) => {
  const missingPatientId = !patient?.patientId;
  const missingName = !patient?.name;
  return {
    missingPatientId,
    missingName,
    isUnlinked: missingPatientId || missingName,
  };
};

const resolvePatientKey = (patient: PatientRecord) => {
  if (patient.patientId) return patient.patientId;
  if (patient.name) return `name:${patient.name}`;
  if (patient.kana) return `kana:${patient.kana}`;
  const fallback = [patient.birthDate, patient.sex, patient.insurance].filter(Boolean).join('|');
  return fallback || 'unknown';
};

const normalizePatientRecord = (record?: PatientRecord | null) => ({
  patientId: record?.patientId ?? '',
  name: record?.name ?? '',
  kana: record?.kana ?? '',
  birthDate: record?.birthDate ?? '',
  sex: record?.sex ?? '',
  phone: record?.phone ?? '',
  zip: record?.zip ?? '',
  address: record?.address ?? '',
  insurance: record?.insurance ?? '',
  memo: record?.memo ?? '',
});

const resolveSexLabel = (sex?: string) => {
  if (sex === 'M') return '男';
  if (sex === 'F') return '女';
  return '不明';
};

const resolveAgeLabel = (birthDate?: string) => {
  if (!birthDate) return '年齢不明';
  const parsed = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '年齢不明';
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > parsed.getMonth() || (now.getMonth() === parsed.getMonth() && now.getDate() >= parsed.getDate());
  if (!hasBirthdayPassed) age -= 1;
  if (!Number.isFinite(age) || age < 0) return '年齢不明';
  return `${age}歳`;
};

const truncateText = (value: string, limit: number) => {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}…`;
};

type PatientsDetailTabKey = 'basic' | 'audit';

const PATIENTS_DETAIL_TABS: Array<{ key: PatientsDetailTabKey; label: string }> = [
  { key: 'basic', label: '基本情報' },
  { key: 'audit', label: '監査/ログ' },
];
const PATIENTS_DETAIL_TAB_KEYS = PATIENTS_DETAIL_TABS.map((tab) => tab.key);

type ToastState = {
  tone: 'warning' | 'success' | 'error' | 'info';
  message: string;
  detail?: string;
};

type PatientsPageProps = {
  runId: string;
};

type PatientsMutationOperation = 'create' | 'update';
type PatientsMutationAttempt = {
  operation: PatientsMutationOperation;
  payload: OfficialPatientCreatePayload | OfficialPatientUpdatePayload;
};
type PatientsEditorMode = 'update' | 'create';

export function PatientsPage({ runId }: PatientsPageProps) {
  const session = useSession();
  const storageScope = useMemo(
    () => ({ facilityId: session.facilityId, userId: session.userId }),
    [session.facilityId, session.userId],
  );
  const sidebarWidthStorageKey = useMemo(
    () => buildScopedStorageKey(SIDEBAR_WIDTH_STORAGE_BASE, SIDEBAR_WIDTH_STORAGE_VERSION, storageScope) ?? SIDEBAR_WIDTH_LEGACY_KEY,
    [storageScope],
  );
  const today = useMemo(() => toLocalDateYmd(), []);
  const location = useLocation();
  const locationState = (location.state as
    | {
        encounter?: {
          patientId?: string;
          appointmentId?: string;
          receptionId?: string;
          scheduleKey?: string;
          encounterKey?: string;
          visitDate?: string;
          departmentCode?: string;
          physicianCode?: string;
          insuranceCombinationNumber?: string;
        };
        carryover?: {
          kw?: string;
          keyword?: string;
        };
        patientId?: string;
        appointmentId?: string;
        receptionId?: string;
        visitDate?: string;
      }
    | null) ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const { enqueue } = useAppToast();
  const appNav = useAppNavigation({ facilityId: session.facilityId, userId: session.userId });
  const { registerDirty } = useNavigationGuard();
  const handleOpenReception = useCallback(() => {
    appNav.openReception();
  }, [appNav.openReception]);
  const storedEncounter = useMemo(
    () => loadChartsEncounterContext(storageScope),
    [location.pathname, location.search, storageScope],
  );
  const stateEncounter = locationState?.encounter;
  const patientIdParam = locationState?.patientId ?? stateEncounter?.patientId ?? storedEncounter?.patientId;
  const appointmentIdParam =
    locationState?.appointmentId ?? stateEncounter?.appointmentId ?? storedEncounter?.appointmentId;
  const receptionIdParam = locationState?.receptionId ?? stateEncounter?.receptionId ?? storedEncounter?.receptionId;
  const visitDateParam =
    normalizeVisitDate(locationState?.visitDate) ??
    normalizeVisitDate(stateEncounter?.visitDate) ??
    normalizeVisitDate(storedEncounter?.visitDate);
  const patientHeaderEncounterContext = useMemo(
    () =>
      normalizeEncounterContext({
        ...storedEncounter,
        ...stateEncounter,
        patientId: patientIdParam,
        appointmentId: appointmentIdParam,
        receptionId: receptionIdParam,
        visitDate: visitDateParam,
      }),
    [appointmentIdParam, patientIdParam, receptionIdParam, stateEncounter, storedEncounter, visitDateParam],
  );
  const fromCandidate = appNav.fromCandidate ?? undefined;
  const fromCharts = fromCandidate === 'charts';
  const initialFilters = useMemo(
    () => readFilters(searchParams, locationState?.carryover),
    [locationState?.carryover, searchParams],
  );
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [orcaImportPatientId, setOrcaImportPatientId] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState<PatientsDetailTabKey>('basic');
  const [editorMode, setEditorMode] = useState<PatientsEditorMode>('update');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [form, setForm] = useState<PatientRecord>({});
  const [baseline, setBaseline] = useState<PatientRecord | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<{ tone: 'info' | 'warning'; message: string } | null>(null);
  const [pendingImportSelectionPatientId, setPendingImportSelectionPatientId] = useState<string | null>(null);
  const [, setSelectionLost] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<PatientRecord | null>(null);
  const [switchingSelection, setSwitchingSelection] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [lastAuditEvent, setLastAuditEvent] = useState<Record<string, unknown> | undefined>();
  const [lastSaveResult, setLastSaveResult] = useState<PatientMutationResult | null>(null);
  const [lastOfficialAction, setLastOfficialAction] = useState<'create' | 'update' | 'import' | null>(null);
  const [auditSnapshot, setAuditSnapshot] = useState<AuditEventRecord[]>(() => getAuditEventLog());
  const [validationErrors, setValidationErrors] = useState<PatientValidationError[]>([]);
  const [lastAttempt, setLastAttempt] = useState<PatientsMutationAttempt | null>(null);
  const baselineRef = useRef<PatientRecord | null>(null);
  const [savedViews, setSavedViews] = useState<OutpatientSavedView[]>(() => loadOutpatientSavedViews());
  const [savedViewName, setSavedViewName] = useState('');
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_WIDTH_DEFAULT);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const sidebarResizeRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const lastUnlinkedToastKey = useRef<string | null>(null);
  const lastPatientIdParam = useRef<string | null>(null);
  const lastPatientsUpdatedAt = useRef<number | null>(null);
  const detailTabRefs = useRef<Record<PatientsDetailTabKey, HTMLButtonElement | null>>({
    basic: null,
    audit: null,
  });
  const [auditKeyword, setAuditKeyword] = useState('');
  const [auditOutcome, setAuditOutcome] = useState<'all' | 'success' | 'error' | 'warning' | 'partial' | 'unknown'>('all');
  const [auditScope, setAuditScope] = useState<'selected' | 'all'>('selected');
  const [auditSort, setAuditSort] = useState<'desc' | 'asc'>('desc');
  const [auditLimit, setAuditLimit] = useState<'10' | '20' | '50' | 'all'>('10');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  useEffect(() => {
    document.title = `患者管理 | 施設ID=${session.facilityId}`;
  }, [session.facilityId]);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(sidebarWidthStorageKey) ?? localStorage.getItem(SIDEBAR_WIDTH_LEGACY_KEY);
      if (!raw) {
        setSidebarWidth(SIDEBAR_WIDTH_DEFAULT);
        return;
      }
      const resolvedWidth = clampSidebarWidth(Number(raw));
      if (Number.isNaN(resolvedWidth)) {
        setSidebarWidth(SIDEBAR_WIDTH_DEFAULT);
        return;
      }
      setSidebarWidth(resolvedWidth);
      if (sidebarWidthStorageKey !== SIDEBAR_WIDTH_LEGACY_KEY && !localStorage.getItem(sidebarWidthStorageKey)) {
        localStorage.setItem(sidebarWidthStorageKey, String(resolvedWidth));
        localStorage.removeItem(SIDEBAR_WIDTH_LEGACY_KEY);
      }
    } catch {
      setSidebarWidth(SIDEBAR_WIDTH_DEFAULT);
    }
  }, [sidebarWidthStorageKey]);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      const nextValue = String(clampSidebarWidth(sidebarWidth));
      localStorage.setItem(sidebarWidthStorageKey, nextValue);
      if (sidebarWidthStorageKey !== SIDEBAR_WIDTH_LEGACY_KEY) {
        localStorage.removeItem(SIDEBAR_WIDTH_LEGACY_KEY);
      }
    } catch {
      // ignore storage write errors
    }
  }, [sidebarWidth, sidebarWidthStorageKey]);

  const [orcaAddressPending, setOrcaAddressPending] = useState(false);
  const [lastMeta, setLastMeta] = useState<
    Pick<
      PatientListResponse,
      | 'missingMaster'
      | 'fallbackUsed'
      | 'cacheHit'
      | 'dataSourceTransition'
      | 'runId'
      | 'fetchedAt'
      | 'recordsReturned'
      | 'apiResult'
      | 'apiResultMessage'
      | 'missingTags'
    >
  >({
    missingMaster: undefined,
    fallbackUsed: undefined,
    cacheHit: undefined,
    dataSourceTransition: undefined,
    runId,
    fetchedAt: undefined,
    recordsReturned: undefined,
    apiResult: undefined,
    apiResultMessage: undefined,
    missingTags: undefined,
  });
  const appliedMeta = useRef<Partial<AuthServiceFlags>>({});
  const { flags, setCacheHit, setMissingMaster, setDataSourceTransition, setFallbackUsed, bumpRunId } = useAuthService();
  const { broadcast } = useAdminBroadcast({ facilityId: session.facilityId, userId: session.userId });
  useEffect(() => {
    const merged = readFilters(searchParams, locationState?.carryover);
    setDraftFilters((prev) => {
      const next = { ...merged, keyword: merged.keyword || prev.keyword };
      return isSameFilter(prev, next) ? prev : next;
    });
    setAppliedFilters((prev) => {
      const next = { ...merged, keyword: merged.keyword || prev.keyword };
      return isSameFilter(prev, next) ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, locationState?.carryover]);

  useEffect(() => {
    const carryoverSource = new URLSearchParams(location.search);
    const receptionStored = readStorageJson(RECEPTION_FILTER_STORAGE_KEY);
    const sortFromUrl = carryoverSource.get('sort');
    const dateFromUrl = carryoverSource.get('date');
    if (typeof localStorage !== 'undefined') {
      const patientFilterSnapshot = {
        department: appliedFilters.department,
        physician: appliedFilters.physician,
        paymentMode: appliedFilters.paymentMode,
      };
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(patientFilterSnapshot));
      const receptionStoredWithoutKeyword = { ...(receptionStored ?? {}) } as Record<string, unknown>;
      ['kw', 'keyword', 'patientId', 'appointmentId', 'receptionId', 'visitDate', 'invoiceNumber'].forEach((key) => {
        delete receptionStoredWithoutKeyword[key];
      });
      const receptionSnapshot = {
        ...receptionStoredWithoutKeyword,
        dept: appliedFilters.department,
        phys: appliedFilters.physician,
        pay: appliedFilters.paymentMode,
        sort: sortFromUrl ?? receptionStored?.sort,
        date: dateFromUrl ?? receptionStored?.date,
      };
      localStorage.setItem(RECEPTION_FILTER_STORAGE_KEY, JSON.stringify(receptionSnapshot));
    }
    const params = toSearchParams();
    const sort = sortFromUrl ?? pickString(receptionStored?.sort);
    const date = dateFromUrl ?? pickString(receptionStored?.date);
    const from = carryoverSource.get('from');
    const returnTo = carryoverSource.get('returnTo');
    const intent = carryoverSource.get('intent');
    const runIdFromUrl = carryoverSource.get('runId');
    if (sort) params.set('sort', sort);
    if (date) params.set('date', date);
    if (from) params.set('from', from);
    if (intent) params.set('intent', intent);
    if (isSafeReturnTo(returnTo, session.facilityId)) params.set('returnTo', returnTo as string);
    if (runIdFromUrl) params.set('runId', runIdFromUrl);
    applyExternalParams(params, pickExternalParams(carryoverSource));
    const nextSearch = params.toString();
    const currentSearch = location.search.startsWith('?') ? location.search.slice(1) : location.search;
    if (nextSearch !== currentSearch) {
      setSearchParams(params, { replace: true });
    }
  }, [appliedFilters, location.search, session.facilityId, setSearchParams]);

  const patientsQuery = useQuery({
    queryKey: ['patients', appliedFilters],
    queryFn: () =>
      searchLocalPatients({
        keyword: appliedFilters.keyword || undefined,
        searchType: resolvePatientSearchType(appliedFilters.keyword || undefined),
      }),
    staleTime: OUTPATIENT_AUTO_REFRESH_INTERVAL_MS,
    refetchInterval: OUTPATIENT_AUTO_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: false,
  });
  const refetchPatients = patientsQuery.refetch;

  const importMutation = useMutation({
    mutationFn: async (patientId: string) => {
      return importPatientsFromOrca({ patientIds: [patientId], runId: flags.runId });
    },
    onSuccess: async (result, patientId) => {
      setLastOfficialAction('import');
      setLastSaveResult(toImportSaveResult(result));
      setLastAttempt(null);
      setPendingImportSelectionPatientId(null);
      const auditEvent = buildImportAuditEvent(patientId, result);
      logAuditEvent({
        runId: result.runId,
        source: 'patient-import',
        cacheHit: resolvedCacheHit,
        missingMaster: resolvedMissingMaster,
        fallbackUsed: resolvedFallbackUsed,
        dataSourceTransition: resolvedTransition,
        payload: auditEvent,
      });
      setLastAuditEvent(auditEvent);
      if (result.ok) {
        enqueue({
          tone: 'success',
          message: 'ORCA既存患者取込は ORCA正本の再取得で同期確認しました',
          detail: `患者番号=${patientId}`,
        });
        const refreshed = await refetchPatients();
        const target = refreshed.data?.patients.find((item) => item.patientId === patientId);
        if (target) {
          setSelectedId(resolvePatientKey(target));
          setForm(target);
          setBaseline(target);
          baselineRef.current = target;
          setSelectionLost(false);
          setEditorMode('update');
          setPendingImportSelectionPatientId(null);
          setSelectionNotice({ tone: 'info', message: `ORCA既存患者取込後の患者 ${patientId} を自動選択しました。` });
          setActiveDetailTab('basic');
        } else {
          setPendingImportSelectionPatientId(patientId);
          setSelectionNotice({
            tone: 'warning',
            message: `ORCA既存患者取込は ORCA正本の再取得で同期確認しましたが、現在の検索条件では患者番号 ${patientId} が一覧に見つかりません。`,
          });
        }
      } else if (result.writeAccepted && result.errorCategory === 'business_partial') {
        enqueue({
          tone: 'warning',
          message: 'ORCA既存患者取込は一部のみ処理され、同期確認済みにできませんでした',
          detail: `患者番号=${patientId}`,
        });
        setSelectionNotice({
          tone: 'warning',
          message: result.error ?? `ORCA既存患者取込は一部のみ処理されました。患者番号 ${patientId} の取り込み結果を確認してください。`,
        });
      } else if (result.writeAccepted) {
        enqueue({
          tone: 'warning',
          message: 'ORCA既存患者取込は受け付けられましたが、ORCA正本の再取得による同期確認が完了していません。',
          detail: `患者番号=${patientId}`,
        });
        setSelectionNotice({
          tone: 'warning',
          message: `ORCA既存患者取込は受け付けられましたが、患者番号 ${patientId} の ORCA正本の再取得による同期確認が完了していません。`,
        });
      } else {
        enqueue({
          tone: 'error',
          message: 'ORCA既存患者取込に失敗しました',
          detail: `患者番号=${patientId}`,
        });
        setSelectionNotice({
          tone: 'warning',
          message: 'ORCA既存患者取込に失敗しました。患者番号を確認して再実行してください。',
        });
      }
    },
    onError: (_error: unknown, patientId) => {
      setLastOfficialAction('import');
      setPendingImportSelectionPatientId(null);
      setLastSaveResult({
        ok: false,
        writeAccepted: false,
        message: 'ORCA既存患者取込に失敗しました。',
      });
      setLastAttempt(null);
      enqueue({
        tone: 'error',
        message: 'ORCA既存患者取込に失敗しました',
        detail: `患者番号=${patientId}`,
      });
      const auditEvent = {
        action: 'ORCA_OFFICIAL_IMPORT_PATIENT',
        outcome: 'error',
        subject: 'patients',
        runId: resolvedRunId,
        details: {
          patientId,
          writeAccepted: false,
          message: 'ORCA既存患者取込に失敗しました。',
        },
      } satisfies Record<string, unknown>;
      logAuditEvent({
        runId: resolvedRunId,
        source: 'patient-import',
        cacheHit: resolvedCacheHit,
        missingMaster: resolvedMissingMaster,
        fallbackUsed: resolvedFallbackUsed,
        dataSourceTransition: resolvedTransition,
        payload: auditEvent,
      });
      setLastAuditEvent(auditEvent);
    },
  });

  const patientsAutoRefreshNotice = useAutoRefreshNotice({
    subject: '患者一覧',
    dataUpdatedAt: patientsQuery.dataUpdatedAt,
    isFetching: patientsQuery.isFetching,
    isError: patientsQuery.isError,
    intervalMs: OUTPATIENT_AUTO_REFRESH_INTERVAL_MS,
  });

  useEffect(() => {
    if (!broadcast?.updatedAt) return;
    void refetchPatients();
  }, [broadcast?.updatedAt, refetchPatients]);

  const patientsErrorContext = useMemo(() => {
    const httpStatus = patientsQuery.data?.status;
    const hasHttpError = typeof httpStatus === 'number' && httpStatus >= 400;
    const error = patientsQuery.isError ? patientsQuery.error : patientsQuery.data?.error;
    if (!error && !hasHttpError) return null;
    return {
      error,
      httpStatus,
    };
  }, [patientsQuery.data?.error, patientsQuery.data?.status, patientsQuery.error, patientsQuery.isError]);

  useEffect(() => {
    const meta = patientsQuery.data;
    if (!meta) return;
    appliedMeta.current = applyAuthServicePatch(
      {
        runId: meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        dataSourceTransition: meta.dataSourceTransition as DataSourceTransition | undefined,
        fallbackUsed: meta.fallbackUsed,
      },
      appliedMeta.current,
      { bumpRunId, setCacheHit, setMissingMaster, setDataSourceTransition, setFallbackUsed },
    );
    setLastAuditEvent(meta.auditEvent);
    setLastMeta({
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      cacheHit: meta.cacheHit,
      dataSourceTransition: meta.dataSourceTransition,
      runId: meta.runId,
      fetchedAt: meta.fetchedAt,
      recordsReturned: meta.recordsReturned,
      apiResult: meta.apiResult,
      apiResultMessage: meta.apiResultMessage,
      missingTags: meta.missingTags,
    });
  }, [bumpRunId, patientsQuery.data, setCacheHit, setDataSourceTransition, setFallbackUsed, setMissingMaster]);

  const patients = patientsQuery.data?.patients ?? [];
  const patientsEmptyState = useMemo(() => {
    if (patients.length > 0) return null;
    const status = patientsErrorContext?.httpStatus;
    const hasAnyFilter = Boolean(
      appliedFilters.keyword && appliedFilters.keyword.trim(),
    );

    if (status === 403) {
      return {
        title: '権限不足（403）',
        body: '患者検索を実行する権限がありません。',
        hint: '管理者に権限付与を依頼するか、別ユーザーでログインして再取得してください。',
        showReception: false,
      };
    }
    if (status === 404) {
      return {
        title: '見つかりません（404）',
        body: '患者検索APIが見つかりません。',
        hint: 'サーバー設定（ルーティング/プロキシ）を確認し、復旧後に再取得してください。',
        showReception: false,
      };
    }
    if (status === 422) {
      return {
        title: '入力不備（422）',
        body: '検索条件が不正のため取得できません。',
        hint: '検索キーワードを見直して再検索してください。',
        showReception: false,
      };
    }
    if (patientsErrorContext?.error) {
      return {
        title: '通信エラー',
        body: '患者一覧を取得できません。',
        hint: '通信回復後に再取得してください。',
        showReception: false,
      };
    }
    if (hasAnyFilter) {
      return {
        title: '0件（該当なし）',
        body: '検索条件に一致する患者がいません。',
        hint: '条件を見直すか、未取り込みの場合は ORCA で患者登録後に ORCA既存患者取込を実行してください。',
        showReception: true,
      };
    }
    return {
      title: '0件（未登録）',
      body: '患者が未登録、または連携元にデータがありません。',
      hint: 'ORCA で患者登録後に取り込み、受付で受付登録してから再取得してください。',
      showReception: true,
    };
  }, [
    appliedFilters.department,
    appliedFilters.keyword,
    appliedFilters.paymentMode,
    appliedFilters.physician,
    patients.length,
    patientsErrorContext,
  ]);

  const resolvedRunId = resolveRunId(patientsQuery.data?.runId ?? flags.runId);
  const infoLive = resolveAriaLive('info');
  const resolvedCacheHit = patientsQuery.data?.cacheHit ?? flags.cacheHit ?? lastMeta.cacheHit ?? false;
  const resolvedMissingMaster = patientsQuery.data?.missingMaster ?? flags.missingMaster ?? lastMeta.missingMaster ?? false;
  const resolvedFallbackUsed = patientsQuery.data?.fallbackUsed ?? flags.fallbackUsed ?? lastMeta.fallbackUsed ?? false;
  const resolvedTransition =
    patientsQuery.data?.dataSourceTransition ?? flags.dataSourceTransition ?? lastMeta.dataSourceTransition;
  const resolvedFetchedAt = patientsQuery.data?.fetchedAt ?? lastMeta.fetchedAt;
  const resolvedRecordsReturned = patientsQuery.data?.recordsReturned ?? lastMeta.recordsReturned;
  const resolvedApiResult = patientsQuery.data?.apiResult ?? lastMeta.apiResult;
  const resolvedMissingTags = patientsQuery.data?.missingTags ?? lastMeta.missingTags ?? [];
  const masterOk = !resolvedMissingMaster
    && !resolvedFallbackUsed
    && ((resolvedTransition ?? 'server') === 'server' || resolvedTransition === 'local');
  const importPatientIdDraft = orcaImportPatientId.trim();
  const emptyStateImportPatientId = useMemo(() => {
    const explicit = importPatientIdDraft;
    if (isImportablePatientId(explicit)) return explicit;
    const keyword = appliedFilters.keyword.trim();
    return resolvePatientSearchType(keyword) === 'patient-id' && isImportablePatientId(keyword) ? keyword : undefined;
  }, [appliedFilters.keyword, importPatientIdDraft]);
  const importSelectedPatientId = useMemo(() => {
    const pid = (form.patientId ?? '').trim();
    if (pid && /^[0-9]{1,16}$/.test(pid)) return pid;
    return undefined;
  }, [form.patientId]);
  const isUnlinkedStopNotice = resolvedMissingMaster || resolvedFallbackUsed;
  const unlinkedAlertLabel = isUnlinkedStopNotice ? '同期停止注意' : '未紐付警告';
  const unlinkedBadgeLabel = isUnlinkedStopNotice ? '同期停止' : '未紐付';
  const patientsUpdatedAtLabel = useMemo(() => {
    if (!patientsQuery.dataUpdatedAt) return '—';
    return formatAutoRefreshTimestamp(patientsQuery.dataUpdatedAt);
  }, [patientsQuery.dataUpdatedAt]);
  const autoRefreshIntervalLabel = useMemo(() => {
    const resolved = resolveAutoRefreshIntervalMs(OUTPATIENT_AUTO_REFRESH_INTERVAL_MS);
    if (!Number.isFinite(resolved) || resolved <= 0) return '停止';
    return `${Math.round(resolved / 1000)}秒`;
  }, []);
  const hasUnsavedChanges = useMemo(() => {
    const normalizedForm = normalizePatientRecord(form);
    if (!baseline) {
      return Object.values(normalizedForm).some((value) => value !== '');
    }
    return JSON.stringify(normalizedForm) !== JSON.stringify(normalizePatientRecord(baseline));
  }, [baseline, form]);

  useEffect(() => {
    registerDirty('patients:patientForm', hasUnsavedChanges, '患者基本情報の未保存変更');
  }, [hasUnsavedChanges, registerDirty]);

  useEffect(() => {
    return () => registerDirty('patients:patientForm', false);
  }, [registerDirty]);
  const saveOperation: PatientOperation = editorMode === 'create' ? 'create' : 'update';
  const liveValidationErrors = useMemo(
    () => validatePatientMutation({ patient: form, operation: saveOperation, context: { masterOk } }),
    [form, masterOk, saveOperation],
  );
  const shouldShowLiveValidation = hasUnsavedChanges || validationErrors.length > 0;
  const displayedValidationErrors = useMemo(
    () => (validationErrors.length ? validationErrors : shouldShowLiveValidation ? liveValidationErrors : []),
    [liveValidationErrors, shouldShowLiveValidation, validationErrors],
  );
  const liveValidationCount = liveValidationErrors.length;
  const basicChangedKeys = useMemo(
    () => diffPatientKeys({ baseline, draft: form }),
    [baseline, form],
  );
  const basicChangedRows = useMemo(
    () =>
      basicChangedKeys.map((key) => ({
        key,
        label: PATIENT_FIELD_LABEL[key],
        before: String(baseline?.[key] ?? '—'),
        after: String(form[key] ?? '—'),
      })),
    [baseline, basicChangedKeys, form],
  );
  const hasPendingFilterChanges = useMemo(() => !isSameFilter(draftFilters, appliedFilters), [appliedFilters, draftFilters]);
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
  const { blockReasons, blockReasonKeys } = useMemo(() => {
    const reasons: string[] = [];
    const keys: string[] = [];
    if (resolvedMissingMaster) {
      reasons.push(buildPatientEditBlockReason('missing_master'));
      keys.push('missing_master');
    }
    if (resolvedFallbackUsed) {
      reasons.push(buildPatientEditBlockReason('fallback_used'));
      keys.push('fallback_used');
    }
    if ((resolvedTransition ?? 'server') !== 'server' && resolvedTransition !== 'local') {
      const transition = resolvedTransition ?? 'unknown';
      reasons.push(buildPatientEditBlockReason('not_server_route', transition));
      keys.push(`data_source_transition:${transition}`);
    }
    return { blockReasons: reasons, blockReasonKeys: keys };
  }, [resolvedFallbackUsed, resolvedMissingMaster, resolvedTransition]);
  const blocking = blockReasons.length > 0;
  const operationalAlertReasons = useMemo(() => {
    const reasons: string[] = [];
    if (patientsErrorContext) {
      reasons.push('患者一覧を取得できません。通信回復後に再取得してください。');
    }
    reasons.push(...blockReasons);
    return reasons;
  }, [blockReasons, patientsErrorContext]);
  const handleOrcaAddressLookup = useCallback(async () => {
    const zip = normalizeZipCode(form.zip);
    if (zip.length !== 7 || blocking || orcaAddressPending) return;
    setOrcaAddressPending(true);
    try {
      const result = await fetchOrcaAddress({ zip, effective: today });
      if (result.ok && result.item) {
        const fullAddress = result.item.fullAddress ?? [result.item.city, result.item.town].filter(Boolean).join('');
        setForm((prev) => ({ ...prev, address: fullAddress || prev.address }));
        enqueue({ tone: 'success', message: '住所を補完しました。', detail: fullAddress || '住所候補を取得しました。' });
        return;
      }
      if (result.notFound) {
        enqueue({ tone: 'warning', message: '該当する住所が見つかりませんでした' });
        return;
      }
      enqueue({ tone: 'error', message: '住所補完に失敗しました。郵便番号を確認して再試行してください。' });
    } catch {
      enqueue({ tone: 'error', message: '住所補完に失敗しました。時間をおいて再試行してください。' });
    } finally {
      setOrcaAddressPending(false);
    }
  }, [blocking, enqueue, form.zip, orcaAddressPending, today]);
  const canLookupAddress = normalizeZipCode(form.zip).length === 7 && !blocking && !orcaAddressPending;
  const importDisabledReason = buildImportDisabledReason(importMutation.isPending, importPatientIdDraft);
  const selectedImportDisabledReason = buildImportDisabledReason(
    importMutation.isPending,
    emptyStateImportPatientId ?? importSelectedPatientId ?? '',
  );
  const addressLookupDisabledReason = buildAddressLookupDisabledReason(blocking, form.zip ?? '', orcaAddressPending);
  const missingMasterFlag = resolvedMissingMaster;
  const fallbackUsedFlag = resolvedFallbackUsed;
  const fieldErrorMap = useMemo(() => {
    const map = new Map<keyof PatientRecord, PatientValidationError>();
    for (const error of displayedValidationErrors) {
      if (!error.field || error.field === 'form') continue;
      map.set(error.field as keyof PatientRecord, error);
    }
    return map;
  }, [displayedValidationErrors]);
  const buildAriaDescribedBy = (...ids: Array<string | undefined>) => {
    const filtered = ids.filter(Boolean);
    return filtered.length ? filtered.join(' ') : undefined;
  };

  const tonePayload: ChartTonePayload = {
    missingMaster: resolvedMissingMaster,
    cacheHit: resolvedCacheHit,
    dataSourceTransition: resolvedTransition,
  };
  const { tone } = getChartToneDetails(tonePayload);
  const toneMessage = buildPatientsToneMessage(tonePayload);
  const operationalStatus = !patientsErrorContext && masterOk ? 'OK' : '要注意';

  const unlinkedCounts = useMemo(() => {
    return patients.reduce(
      (acc, patient) => {
        const state = resolveUnlinkedState(patient);
        if (state.missingPatientId) acc.missingPatientId += 1;
        if (state.missingName) acc.missingName += 1;
        return acc;
      },
      { missingPatientId: 0, missingName: 0 },
    );
  }, [patients]);

  const unlinkedNotice = useMemo(() => {
    if (unlinkedCounts.missingPatientId === 0 && unlinkedCounts.missingName === 0) return null;
    const parts = [
      unlinkedCounts.missingPatientId > 0 ? `患者ID未紐付: ${unlinkedCounts.missingPatientId}` : undefined,
      unlinkedCounts.missingName > 0 ? `氏名未紐付: ${unlinkedCounts.missingName}` : undefined,
    ].filter((value): value is string => typeof value === 'string');
    const message = `患者一覧に${unlinkedAlertLabel}があります（${parts.join(' / ')}）`;
    const key = `${unlinkedCounts.missingPatientId}-${unlinkedCounts.missingName}-${resolvedRunId ?? 'runId'}`;
    return { message, detail: `recordsReturned=${resolvedRecordsReturned ?? '―'}`, key };
  }, [resolvedRecordsReturned, resolvedRunId, unlinkedAlertLabel, unlinkedCounts.missingName, unlinkedCounts.missingPatientId]);

  const selectedUnlinked = useMemo(() => {
    if (!baseline) return null;
    const state = resolveUnlinkedState(form);
    return state.isUnlinked ? state : null;
  }, [baseline, form]);
  const selectedUnlinkedBadge = useMemo(() => {
    if (!selectedUnlinked) return null;
    const parts = [
      selectedUnlinked.missingPatientId ? '患者ID欠損' : null,
      selectedUnlinked.missingName ? '氏名欠損' : null,
    ].filter((value): value is string => Boolean(value));
    return parts.length ? `未紐付: ${parts.join(' / ')}` : '未紐付';
  }, [selectedUnlinked]);

  const chartsArrivalBanner = useMemo(() => {
    if (!fromCharts) return null;
    const hasPatient = Boolean(patientIdParam);
    const matched = hasPatient && patients.some((patient) => patient.patientId === patientIdParam);
    if (hasPatient && !matched) {
      return {
        tone: 'warning' as const,
        message: 'カルテから移動しましたが、対象患者の文脈が引き継がれていません。この画面だけでは再開できないため、受付の検索条件を見直して患者を選び直してください。',
        nextAction: '患者を選び直す',
      };
    }
    return {
      tone: 'warning' as const,
      message: 'カルテから患者管理へ移動しました。受付フィルタは引き継いでいますが、この画面だけでは再開できません。操作前に対象患者を選び直してください。',
      nextAction: '対象患者を選び直す',
    };
  }, [fromCharts, patientIdParam, patients]);

  useEffect(() => {
    if (!unlinkedNotice) {
      lastUnlinkedToastKey.current = null;
      return;
    }
    if (lastUnlinkedToastKey.current === unlinkedNotice.key) return;
    lastUnlinkedToastKey.current = unlinkedNotice.key;
    enqueue({
      id: `patients-unlinked-${unlinkedNotice.key}`,
      tone: 'warning',
      message: unlinkedNotice.message,
      detail: unlinkedNotice.detail,
    });
  }, [enqueue, unlinkedNotice]);

  useEffect(() => {
    if (!patientIdParam) {
      lastPatientIdParam.current = null;
      return;
    }
    if (!patientsQuery.data || patientsQuery.isFetching) return;
    if (lastPatientIdParam.current === patientIdParam) return;
    const target = patients.find((patient) => patient.patientId === patientIdParam);
    if (target) {
      setSelectedId(resolvePatientKey(target));
      setForm(target);
      setBaseline(target);
      baselineRef.current = target;
      setSelectionLost(false);
      setValidationErrors([]);
      setLastAttempt(null);
      setPendingSelection(null);
      setSelectionNotice(null);
    } else {
      if (!hasUnsavedChanges) {
        setSelectedId(undefined);
        setForm({});
        setBaseline(null);
        baselineRef.current = null;
        setSelectionLost(false);
      }
      setSelectionNotice({ tone: 'warning', message: '指定患者が見つかりません。患者を選択してください。' });
    }
    lastPatientIdParam.current = patientIdParam;
  }, [hasUnsavedChanges, patientIdParam, patients, patientsQuery.data, patientsQuery.isFetching]);

  useEffect(() => {
    if (!selectionNotice) return;
    if (!selectedId && selectionNotice.tone !== 'warning') {
      setSelectionNotice(null);
    }
  }, [selectedId, selectionNotice]);

  useEffect(() => {
    if (!pendingImportSelectionPatientId) return;
    if (!patientsQuery.data || patientsQuery.isFetching) return;
    const importedPatient = patients.find((patient) => patient.patientId === pendingImportSelectionPatientId);
    if (!importedPatient) return;
    if (hasUnsavedChanges) {
      setSelectionNotice({
        tone: 'info',
        message: `ORCA既存患者取込後の患者 ${pendingImportSelectionPatientId} が一覧に表示されました。編集中の内容は保持しています。`,
      });
      setPendingImportSelectionPatientId(null);
      return;
    }
    setSelectedId(resolvePatientKey(importedPatient));
    setForm(importedPatient);
    setBaseline(importedPatient);
    baselineRef.current = importedPatient;
    setSelectionLost(false);
    setEditorMode('update');
    setActiveDetailTab('basic');
    setSelectionNotice({
      tone: 'info',
      message: `ORCA既存患者取込後の患者 ${pendingImportSelectionPatientId} を自動選択しました。`,
    });
    setPendingImportSelectionPatientId(null);
  }, [hasUnsavedChanges, patients, patientsQuery.data, patientsQuery.isFetching, pendingImportSelectionPatientId]);

  useEffect(() => {
    if (!patientsQuery.dataUpdatedAt) return;
    if (lastPatientsUpdatedAt.current === patientsQuery.dataUpdatedAt) return;
    const previous = lastPatientsUpdatedAt.current;
    lastPatientsUpdatedAt.current = patientsQuery.dataUpdatedAt;
    if (!previous) return;
    if (!selectedId) return;
    const selectedPatient = patients.find((patient) => resolvePatientKey(patient) === selectedId);
    if (!selectedPatient) {
      setSelectionNotice({ tone: 'warning', message: '一覧更新で選択中の患者が見つかりません。検索条件を確認してください。' });
      if (!hasUnsavedChanges) {
        setSelectedId(undefined);
        setForm({});
        setBaseline(null);
        baselineRef.current = null;
        setSelectionLost(true);
      }
      return;
    }
    if (hasUnsavedChanges) {
      setSelectionNotice({ tone: 'info', message: '一覧を更新しました。編集中の内容は保持しています。' });
      setSelectionLost(false);
      return;
    }
    setForm(selectedPatient);
    setBaseline(selectedPatient);
    baselineRef.current = selectedPatient;
    setSelectionNotice({ tone: 'info', message: '一覧を更新しました。選択は保持されています。' });
    setSelectionLost(false);
  }, [hasUnsavedChanges, patients, patientsQuery.dataUpdatedAt, selectedId]);

  useEffect(() => {
    if (!lastAuditEvent) return;
    setAuditSnapshot(getAuditEventLog());
  }, [lastAuditEvent]);

  const focusDetailTab = useCallback((tabKey: PatientsDetailTabKey) => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      detailTabRefs.current[tabKey]?.focus();
    });
  }, []);

  const moveDetailTab = useCallback(
    (currentTab: PatientsDetailTabKey, direction: 'prev' | 'next' | 'first' | 'last') => {
      const currentIndex = PATIENTS_DETAIL_TAB_KEYS.indexOf(currentTab);
      if (currentIndex < 0) return;
      const lastIndex = PATIENTS_DETAIL_TAB_KEYS.length - 1;
      let nextIndex = currentIndex;
      if (direction === 'prev') nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
      if (direction === 'next') nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
      if (direction === 'first') nextIndex = 0;
      if (direction === 'last') nextIndex = lastIndex;
      const nextTab = PATIENTS_DETAIL_TAB_KEYS[nextIndex];
      setActiveDetailTab(nextTab);
      focusDetailTab(nextTab);
    },
    [focusDetailTab],
  );

  const handleDetailTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, tabKey: PatientsDetailTabKey) => {
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          moveDetailTab(tabKey, 'prev');
          return;
        case 'ArrowRight':
          event.preventDefault();
          moveDetailTab(tabKey, 'next');
          return;
        case 'Home':
          event.preventDefault();
          moveDetailTab(tabKey, 'first');
          return;
        case 'End':
          event.preventDefault();
          moveDetailTab(tabKey, 'last');
          return;
        case 'Enter':
        case ' ':
          event.preventDefault();
          setActiveDetailTab(tabKey);
          return;
        default:
          return;
      }
    },
    [moveDetailTab],
  );

  const applyPatientSelection = useCallback((patient: PatientRecord) => {
    setEditorMode('update');
    setSelectedId(resolvePatientKey(patient));
    setForm(patient);
    setBaseline(patient);
    baselineRef.current = patient;
    setValidationErrors([]);
    setLastAttempt(null);
    setSelectionNotice(null);
    setSelectionLost(false);
    setPendingSelection(null);
    setActiveDetailTab('basic');
    logUiState({
      action: 'tone_change',
      screen: 'patients',
      controlId: 'select-patient',
      runId: resolvedRunId,
      cacheHit: resolvedCacheHit,
      missingMaster: resolvedMissingMaster,
      dataSourceTransition: resolvedTransition,
      fallbackUsed: resolvedFallbackUsed,
      details: { patientId: patient.patientId },
    });
  }, [resolvedCacheHit, resolvedFallbackUsed, resolvedMissingMaster, resolvedRunId, resolvedTransition]);

  const handleSelect = useCallback(
    (patient: PatientRecord) => {
      if (switchingSelection) return;
      const nextKey = resolvePatientKey(patient);
      if (selectedId === nextKey) return;
      if (hasUnsavedChanges) {
        setPendingSelection(patient);
        return;
      }
      applyPatientSelection(patient);
    },
    [applyPatientSelection, hasUnsavedChanges, selectedId, switchingSelection],
  );

  const mutation = useMutation({
    mutationFn: (attempt: PatientsMutationAttempt) =>
      attempt.operation === 'create'
        ? createOfficialPatient(attempt.payload as OfficialPatientCreatePayload)
        : updateOfficialPatient(attempt.payload as OfficialPatientUpdatePayload),
    onSuccess: async (result: PatientMutationResult, variables: PatientsMutationAttempt) => {
      const writeAccepted = result.writeAccepted ?? false;
      const fullSuccess = result.ok;
      const defaultMutationMessage = fullSuccess
        ? '保存しました'
        : writeAccepted
          ? '保存は受け付けられましたが、ORCA正本の再取得による同期確認が完了していません。'
          : '保存に失敗しました。内容を確認して再試行してください。';
      const resultDisplayMessage = toSafePatientFeedbackMessage(result.message, defaultMutationMessage);
      setLastAuditEvent(result.auditEvent);
      setLastSaveResult({
        ...result,
        message: resultDisplayMessage,
      });
      setLastOfficialAction(variables.operation);
      setToast({
        tone: fullSuccess ? 'success' : writeAccepted ? 'warning' : 'error',
        message: resultDisplayMessage,
      });
      appliedMeta.current = applyAuthServicePatch(
        {
          runId: result.runId,
          cacheHit: result.cacheHit,
          missingMaster: result.missingMaster,
          dataSourceTransition: result.dataSourceTransition,
          fallbackUsed: result.fallbackUsed,
        },
        appliedMeta.current,
        { bumpRunId, setCacheHit, setMissingMaster, setDataSourceTransition, setFallbackUsed },
      );
      setLastMeta((prev) => ({
        missingMaster: result.missingMaster ?? prev.missingMaster,
        fallbackUsed: result.fallbackUsed ?? prev.fallbackUsed,
        cacheHit: result.cacheHit ?? prev.cacheHit,
        dataSourceTransition: result.dataSourceTransition ?? prev.dataSourceTransition,
        runId: result.runId ?? prev.runId,
      }));
      if (fullSuccess) {
        const canonicalOrSyncedPatient = result.canonicalPatient ?? result.patient;
        const syncedPatientId =
          result.canonicalPatient?.patientId ?? result.patient?.patientId ?? variables.payload.patient.patientId;
        const refreshed = await patientsQuery.refetch();
        const syncedPatient = syncedPatientId
          ? refreshed.data?.patients.find((item) => item.patientId === syncedPatientId)
          : undefined;
        if (syncedPatient) {
          setEditorMode('update');
          setSelectedId(resolvePatientKey(syncedPatient));
          setForm(syncedPatient);
          setBaseline(syncedPatient);
          baselineRef.current = syncedPatient;
          setSelectionNotice({
            tone: 'info',
            message:
              variables.operation === 'create'
                ? `新患登録は ORCA正本の再取得で同期確認し、患者 ${syncedPatientId ?? '—'} を選択しました。`
                : `既存患者更新は ORCA正本の再取得で同期確認し、患者 ${syncedPatientId ?? '—'} を再読込しました。`,
          });
        } else if (canonicalOrSyncedPatient) {
          setEditorMode('update');
          setSelectedId(resolvePatientKey(canonicalOrSyncedPatient));
          setForm(canonicalOrSyncedPatient);
          setBaseline(canonicalOrSyncedPatient);
          baselineRef.current = canonicalOrSyncedPatient;
          setSelectionNotice({
            tone: 'warning',
            message:
              variables.operation === 'create'
                ? '新患登録は ORCA正本の再取得で同期確認しましたが、現在の検索条件では一覧に見つかりません。登録した患者を詳細表示しています。'
                : '既存患者更新は ORCA正本の再取得で同期確認しましたが、現在の検索条件では一覧に見つかりません。更新した患者を詳細表示しています。',
          });
        }
        setValidationErrors([]);
        setLastAttempt(null);
      } else if (writeAccepted) {
        setSelectionNotice({
          tone: 'warning',
          message:
            variables.operation === 'create'
              ? '新患登録は受け付けられましたが、ORCA正本の再取得による同期確認が完了していません。'
              : '既存患者更新は受け付けられましたが、ORCA正本の再取得による同期確認が完了していません。',
        });
        setLastAttempt(null);
      } else {
        setLastAttempt(variables);
      }
    },
    onError: (_error: unknown) => {
      setToast({ tone: 'error', message: '保存に失敗しました。時間をおいて再試行してください。' });
      // onError は network/throw のみなので、直前の attempt を残して UI から再試行できるようにする
      setLastSaveResult({
        ok: false,
        message: '保存に失敗しました',
      });
    },
  });

  const saveDisabled = useMemo(
    () =>
      mutation.isPending
      || blocking
      || liveValidationCount > 0
      || (editorMode === 'update' && !(form.patientId ?? '').trim()),
    [blocking, editorMode, form.patientId, liveValidationCount, mutation.isPending],
  );

  const currentOrcaStatus = useMemo(() => {
    return buildPatientsOrcaStatus({
      missingMaster: missingMasterFlag,
      fallbackUsed: fallbackUsedFlag,
      dataSourceTransition: resolvedTransition,
    });
  }, [fallbackUsedFlag, missingMasterFlag, resolvedTransition]);

  const lastSaveOrcaStatus = useMemo(() => {
    if (!lastSaveResult) return { state: '未送信', detail: '保存操作はまだありません。' };
    return buildPatientsOrcaStatus({
      action: lastOfficialAction,
      missingMaster: lastSaveResult.missingMaster,
      fallbackUsed: lastSaveResult.fallbackUsed,
      dataSourceTransition: lastSaveResult.dataSourceTransition,
      lastSaveSucceeded: lastSaveResult.ok,
      lastSaveFailed: !lastSaveResult.ok && !lastSaveResult.writeAccepted,
      lastSaveWriteAcceptedWithoutReadback: Boolean(lastSaveResult.writeAccepted && !lastSaveResult.ok),
      lastErrorCategory: lastSaveResult.errorCategory,
    });
  }, [lastOfficialAction, lastSaveResult]);
  const patientHeaderContextMatchesSelection =
    Boolean(form.patientId) && patientHeaderEncounterContext.patientId === form.patientId;
  const patientHeaderInternalReference = patientHeaderContextMatchesSelection
    ? patientHeaderEncounterContext.encounterKey ??
      patientHeaderEncounterContext.scheduleKey ??
      patientHeaderEncounterContext.receptionId ??
      patientHeaderEncounterContext.appointmentId
    : undefined;
  const patientHeaderVisitDate = patientHeaderContextMatchesSelection ? patientHeaderEncounterContext.visitDate : undefined;
  const patientHeaderDepartment = patientHeaderContextMatchesSelection
    ? patientHeaderEncounterContext.departmentCode
    : undefined;
  const patientHeaderPhysician = patientHeaderContextMatchesSelection ? patientHeaderEncounterContext.physicianCode : undefined;
  const patientHeaderInsurance = patientHeaderContextMatchesSelection
    ? patientHeaderEncounterContext.insuranceCombinationNumber ?? form.insurance
    : form.insurance;
  const patientHeaderOrcaCacheStatus = missingMasterFlag
    ? 'missing'
    : fallbackUsedFlag
      ? 'stale'
      : currentOrcaStatus.state === '同期確認済'
        ? 'fresh'
        : currentOrcaStatus.state === '同期可能'
          ? 'unverified'
          : currentOrcaStatus.state;

  const resolveAuditPatientId = (record: AuditEventRecord) => {
    const payload = record.payload as Record<string, unknown> | undefined;
    const details = payload?.details as Record<string, unknown> | undefined;
    return (
      (record.patientId as string | undefined) ??
      (payload?.patientId as string | undefined) ??
      (details?.patientId as string | undefined)
    );
  };

  const auditDateValidation = useMemo(() => {
    if (!auditDateFrom || !auditDateTo) {
      return { fromDate: auditDateFrom, toDate: auditDateTo, isValid: true, message: '' };
    }
    const fromValue = Date.parse(`${auditDateFrom}T00:00:00`);
    const toValue = Date.parse(`${auditDateTo}T23:59:59`);
    if (Number.isNaN(fromValue) || Number.isNaN(toValue)) {
      return { fromDate: auditDateFrom, toDate: auditDateTo, isValid: true, message: '' };
    }
    if (fromValue > toValue) {
      return {
        fromDate: auditDateFrom,
        toDate: auditDateTo,
        isValid: false,
        message: `開始日 (${auditDateFrom}) が終了日 (${auditDateTo}) より後です。`,
      };
    }
    return { fromDate: auditDateFrom, toDate: auditDateTo, isValid: true, message: '' };
  }, [auditDateFrom, auditDateTo]);

  const auditRows = useMemo(() => {
    const selectedPatientId = form.patientId ?? baseline?.patientId ?? undefined;
    const list = [...auditSnapshot];
    const filtered = list.filter((record) => {
      const payload = record.payload as Record<string, unknown> | undefined;
      const action = (payload?.action as string | undefined) ?? '';
      const source = record.source ?? '';
      if (!action.includes('PATIENT') && !source.includes('patient')) return false;
      const recordPatientId = resolveAuditPatientId(record);
      if (auditScope === 'selected' && selectedPatientId) {
        return recordPatientId === selectedPatientId;
      }
      return true;
    });

    const keyword = normalizeAuditValue(auditKeyword).trim();
    const outcomeFilter = normalizeAuditValue(auditOutcome);
    const fromDate = auditDateFrom ? new Date(`${auditDateFrom}T00:00:00`).getTime() : undefined;
    const toDate = auditDateTo ? new Date(`${auditDateTo}T23:59:59`).getTime() : undefined;

    const matches = filtered.filter((record) => {
      const payload = record.payload as Record<string, unknown> | undefined;
      const details = payload?.details as Record<string, unknown> | undefined;
      const action = normalizeAuditValue((payload?.action as string | undefined) ?? '');
      const outcome = normalizeAuditValue(
        (payload?.outcome as string | undefined) ?? (details?.outcome as string | undefined) ?? 'unknown',
      );
      const patientId = resolveAuditPatientId(record);
      const changedKeys = details?.changedKeys as string[] | string | undefined;
      const message = (details?.message as string | undefined) ?? (payload?.message as string | undefined);
      const sourcePath = (details?.sourcePath as string | undefined) ?? (payload?.sourcePath as string | undefined);
      const recordTime = new Date(record.timestamp).getTime();

      if (auditDateValidation.isValid) {
        if (fromDate && recordTime < fromDate) return false;
        if (toDate && recordTime > toDate) return false;
      }

      if (outcomeFilter !== 'all' && outcome !== outcomeFilter) return false;

      if (keyword) {
        const haystack = normalizeAuditValue(
          [
            action,
            outcome,
            record.source ?? '',
            record.note ?? '',
            record.runId ?? '',
            record.traceId ?? '',
            patientId ?? '',
            String(details?.operation ?? ''),
            String(details?.section ?? ''),
            String(details?.appointmentId ?? ''),
            String(details?.receptionId ?? ''),
            String(details?.visitDate ?? ''),
            String(details?.requestId ?? ''),
            typeof changedKeys === 'string' ? changedKeys : Array.isArray(changedKeys) ? changedKeys.join(',') : '',
            message ?? '',
            sourcePath ?? '',
          ].join(' '),
        );
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });

    const sorted = [...matches].sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return auditSort === 'asc' ? aTime - bTime : bTime - aTime;
    });

    const limit = auditLimit === 'all' ? sorted.length : Number(auditLimit);
    return {
      total: sorted.length,
      items: sorted.slice(0, limit),
    };
  }, [
    auditDateFrom,
    auditDateTo,
    auditDateValidation.isValid,
    auditKeyword,
    auditLimit,
    auditOutcome,
    auditScope,
    auditSnapshot,
    auditSort,
    baseline?.patientId,
    form.patientId,
  ]);

  const describeAudit = (record: AuditEventRecord) => {
    const payload = record.payload as Record<string, unknown> | undefined;
    const details = payload?.details as Record<string, unknown> | undefined;
    const action =
      (payload?.action as string | undefined) ??
      (details?.operation ? `PATIENT_${String(details.operation).toUpperCase()}` : undefined) ??
      'PATIENT_EVENT';
    const outcome = (payload?.outcome as string | undefined) ?? (details?.outcome as string | undefined) ?? '—';
    const runId = (payload?.runId as string | undefined) ?? record.runId ?? '—';
    const traceId = (payload?.traceId as string | undefined) ?? record.traceId ?? '—';
    const requestId = (payload?.requestId as string | undefined) ?? (details?.requestId as string | undefined) ?? '—';
    const patientId = resolveAuditPatientId(record) ?? '—';
    const changedKeysRaw = details?.changedKeys as string[] | string | undefined;
    const changedKeys = Array.isArray(changedKeysRaw)
      ? changedKeysRaw.length <= 5
        ? changedKeysRaw.join(', ')
        : `${changedKeysRaw.slice(0, 5).join(', ')} 他${changedKeysRaw.length - 5}件`
      : changedKeysRaw ?? '';
    const status = details?.status as string | number | undefined;
    const sourcePath = details?.sourcePath as string | undefined;
    const message = (details?.message as string | undefined) ?? (payload?.message as string | undefined);
    const section = (details?.section as string | undefined) ?? (payload?.section as string | undefined);
    const operation = (details?.operation as string | undefined) ?? (payload?.operation as string | undefined);
    const orcaStatus =
      record.missingMaster || record.fallbackUsed || record.dataSourceTransition !== 'server'
        ? '同期停止'
        : outcome === 'success'
          ? '同期確認済'
          : outcome === 'warning'
            ? '同期確認失敗'
          : outcome === 'error'
            ? '同期失敗'
            : '同期待ち';
    return {
      action,
      outcome,
      runId,
      traceId,
      requestId,
      patientId,
      changedKeys,
      status,
      sourcePath,
      message,
      section,
      operation,
      orcaStatus,
    };
  };

  const renderAuditMessage = (message?: string) => {
    if (!message) return null;
    if (message.length <= 100) {
      return <span>message: {message}</span>;
    }
    const summary = `${message.slice(0, 100)}…`;
    return (
      <details className="patients-page__audit-message">
        <summary>message: {summary}</summary>
        <div>{message}</div>
      </details>
    );
  };

  const focusField = (field: keyof PatientRecord) => {
    const el = typeof document !== 'undefined' ? (document.getElementById(`patients-form-${String(field)}`) as HTMLElement | null) : null;
    if (el && typeof el.focus === 'function') el.focus();
  };

  const save = useCallback(
    async (operation: PatientsMutationOperation) => {
      if (blocking) {
        setToast({
          tone: 'warning',
          message: '編集ブロック中のため保存できません',
          detail: blockReasons.join(' / '),
        });
        logAuditEvent({
          runId: resolvedRunId ?? flags.runId,
          source: 'patient-save',
          cacheHit: resolvedCacheHit,
          missingMaster: missingMasterFlag,
          dataSourceTransition: resolvedTransition,
          fallbackUsed: fallbackUsedFlag,
          patientId: form.patientId,
          payload: {
            action: 'PATIENT_SAVE_BLOCKED',
            outcome: 'blocked',
            details: {
              operation,
              patientId: form.patientId,
              blockedReasons: blockReasonKeys,
              message: blockReasons.join(' / '),
            },
          },
        });
        logUiState({
          action: 'save',
          screen: 'patients',
          controlId: 'save-blocked',
          runId: flags.runId,
          cacheHit: flags.cacheHit,
          missingMaster: missingMasterFlag,
          dataSourceTransition: flags.dataSourceTransition,
          fallbackUsed: fallbackUsedFlag,
          details: {
            blockedReasons: blockReasonKeys,
            message: blockReasons.join(' / '),
          },
        });
        return false;
      }

      if (operation === 'update' && !(form.patientId ?? '').trim()) {
        setToast({
          tone: 'warning',
          message: '患者が未選択のため保存できません',
          detail: 'ORCA で患者登録後、一覧検索または ORCA から取り込みしてください。',
        });
        return false;
      }

      const validation = validatePatientMutation({ patient: form, operation, context: { masterOk } });
      setValidationErrors(validation);
      if (validation.length > 0) {
        setToast({ tone: 'error', message: '入力エラーがあります（保存できません）。' });
        const firstField = validation.find((e) => e.field && e.field !== 'form')?.field;
        if (firstField && firstField !== 'form') {
          focusField(firstField as keyof PatientRecord);
        }
        return false;
      }

      const payloadBase = {
        patient: form,
        runId: flags.runId,
        auditMeta: {
          source: 'patients',
          changedKeys: basicChangedKeys,
          receptionId: receptionIdParam,
          appointmentId: appointmentIdParam,
          visitDate: visitDateParam,
          actorRole: session.role,
        },
      };
      const attempt: PatientsMutationAttempt = {
        operation,
        payload: operation === 'create'
          ? (payloadBase as OfficialPatientCreatePayload)
          : (payloadBase as OfficialPatientUpdatePayload),
      };
      setLastOfficialAction(operation);
      setLastAttempt(attempt);
      try {
        const result = await mutation.mutateAsync(attempt);
        return Boolean(result?.ok);
      } catch {
        return false;
      }
    },
    [
      appointmentIdParam,
      basicChangedKeys,
      blockReasonKeys,
      blockReasons,
      blocking,
      fallbackUsedFlag,
      flags.cacheHit,
      flags.dataSourceTransition,
      flags.runId,
      form,
      masterOk,
      missingMasterFlag,
      mutation,
      receptionIdParam,
      resolvedCacheHit,
      resolvedFallbackUsed,
      resolvedMissingMaster,
      resolvedRunId,
      resolvedTransition,
      session.role,
      visitDateParam,
    ],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void save(editorMode);
  };

  const onFilterChange = (key: keyof typeof DEFAULT_FILTER, value: string) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applySavedView = (view: OutpatientSavedView) => {
    const next = {
      keyword: view.filters.keyword ?? '',
      department: '',
      physician: '',
      paymentMode: 'all',
    } satisfies typeof DEFAULT_FILTER;
    setSelectedViewId(view.id);
    setDraftFilters(next);
    setAppliedFilters(next);
  };

  const handleSaveView = () => {
    const label = savedViewName || `検索 ${new Date().toLocaleString()}`;
    const nextViews = upsertOutpatientSavedView({
      label,
      filters: {
        keyword: draftFilters.keyword.trim() || undefined,
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

  const handleFilterSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setAppliedFilters((prev) => (isSameFilter(prev, draftFilters) ? prev : draftFilters));
    if (isSameFilter(appliedFilters, draftFilters)) {
      void patientsQuery.refetch();
    }
  };

  const handleClearFilters = () => {
    setDraftFilters(DEFAULT_FILTER);
  };

  const handleImportByPatientId = (patientIdOverride?: string) => {
    const targetPatientId = patientIdOverride?.trim() || importPatientIdDraft;
    if (!isImportablePatientId(targetPatientId)) {
      setSelectionNotice({ tone: 'warning', message: 'ORCA患者番号を数字（最大16桁）で入力してください。' });
      return;
    }
    importMutation.mutate(targetPatientId);
  };

  const handleCancelSelectionSwitch = () => {
    if (switchingSelection) return;
    setPendingSelection(null);
  };

  const handleDiscardSelectionSwitch = () => {
    if (switchingSelection) return;
    if (!pendingSelection) return;
    setPendingSelection(null);
    setValidationErrors([]);
    setLastAttempt(null);
    setToast({ tone: 'info', message: '未保存変更を破棄して患者を切り替えました。' });
    applyPatientSelection(pendingSelection);
  };

  const handleSaveSelectionSwitch = async () => {
    if (!pendingSelection || switchingSelection) return;
    setSwitchingSelection(true);
    let canSwitch = true;
    if (hasUnsavedChanges) {
      canSwitch = await save(editorMode);
    }
    if (canSwitch) {
      applyPatientSelection(pendingSelection);
      setPendingSelection(null);
    } else {
      setSelectionNotice({
        tone: 'warning',
        message: '保存に失敗したため患者切替を中止しました。内容を確認して再実行してください。',
      });
    }
    setSwitchingSelection(false);
  };

  const splitLayoutStyle = useMemo(
    () =>
      ({
        '--patients-sidebar-width': `${sidebarWidth}px`,
      }) as CSSProperties,
    [sidebarWidth],
  );

  const updateSidebarWidth = useCallback((nextWidth: number) => {
    setSidebarWidth(clampSidebarWidth(nextWidth));
  }, []);

  const handleSidebarSplitterPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      sidebarResizeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: sidebarWidth,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsSidebarResizing(true);
    },
    [sidebarWidth],
  );

  const handleSidebarSplitterPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const current = sidebarResizeRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const delta = event.clientX - current.startX;
      updateSidebarWidth(current.startWidth + delta);
    },
    [updateSidebarWidth],
  );

  const handleSidebarSplitterPointerRelease = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const current = sidebarResizeRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    sidebarResizeRef.current = null;
    setIsSidebarResizing(false);
  }, []);

  const handleSidebarSplitterKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        updateSidebarWidth(sidebarWidth - SIDEBAR_WIDTH_KEY_STEP);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        updateSidebarWidth(sidebarWidth + SIDEBAR_WIDTH_KEY_STEP);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        updateSidebarWidth(SIDEBAR_WIDTH_MIN);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        updateSidebarWidth(SIDEBAR_WIDTH_MAX);
      }
    },
    [sidebarWidth, updateSidebarWidth],
  );

  return (
    <>
      <a className="skip-link" href="#patients-search">
        本文へスキップ
      </a>
      <main className="patients-page" data-run-id={resolvedRunId} id="patients-main" tabIndex={-1}>
      <header className="patients-page__header">
        <div>
          <p className="patients-page__kicker">患者管理 検索・管理</p>
          <h1>患者管理</h1>
          <p className="patients-page__hint" role="status" aria-live={infoLive}>
            患者一覧から対象を選択し、右ペインのタブで目的別に操作してください。患者基本情報の登録・更新は「基本情報」タブで行います。
          </p>
        </div>
        <div className="patients-page__ops-metrics" role="status" aria-live={infoLive}>
          <span>患者件数: {resolvedRecordsReturned ?? patients.length}件</span>
          <span>更新時刻: {patientsUpdatedAtLabel}</span>
          <span className={`patients-page__ops-status${operationalStatus === 'OK' ? ' is-ok' : ' is-alert'}`}>状態: {operationalStatus}</span>
        </div>
      </header>

      {operationalAlertReasons.length > 0 ? (
        <section
          className="patients-page__ops-alert"
          role="alert"
          aria-label="患者管理の同期状態に確認が必要です"
          aria-live={resolveAriaLive('warning')}
        >
          <strong>患者管理の同期状態に確認が必要です</strong>
          <ul>
            {operationalAlertReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p>この警告は通信詳細を開かなくても確認できる必要があります。ORCA正本の再取得が完了するまで、患者基本情報の編集を進めないでください。</p>
        </section>
      ) : null}

      <details className="patients-page__network-details">
        <summary>通信詳細を表示</summary>
        <div className="patients-page__badges" role="status" aria-live={infoLive}>
          <RunIdBadge runId={resolvedRunId} />
          <StatusPill
            className="patients-page__badge"
            label="dataSourceTransition"
            value={resolvedTransition ?? 'unknown'}
            tone={resolveTransitionTone()}
            runId={resolvedRunId}
          />
          <StatusPill
            className="patients-page__badge"
            label="missingMaster"
            value={String(missingMasterFlag)}
            tone={resolveMetaFlagTone(missingMasterFlag)}
            runId={resolvedRunId}
          />
          <StatusPill
            className="patients-page__badge"
            label="fallbackUsed"
            value={String(fallbackUsedFlag)}
            tone={resolveMetaFlagTone(fallbackUsedFlag)}
            runId={resolvedRunId}
          />
          <StatusPill
            className="patients-page__badge"
            label="cacheHit"
            value={String(resolvedCacheHit)}
            tone={resolveCacheHitTone(resolvedCacheHit)}
            runId={resolvedRunId}
          />
          <AuditSummaryInline
            auditEvent={lastAuditEvent}
            variant="inline"
            className="patients-page__badge"
            label="監査サマリ"
            showActor={false}
            runId={resolvedRunId}
          />
        </div>
        <div className="patients-page__network-meta">
          <span>RUN_ID: {resolvedRunId ?? '―'}</span>
          <span>{resolvedTransition ?? 'server'} fetchedAt: {resolvedFetchedAt ?? '—'}</span>
          <span>Api_Result: {resolvedApiResult ?? '—'}</span>
          <span>不足タグ: {resolvedMissingTags.length ? resolvedMissingTags.join(', ') : 'なし'}</span>
        </div>
      </details>

      <AdminBroadcastBanner broadcast={broadcast} surface="patients" runId={resolvedRunId} />
      {patientsAutoRefreshNotice && (
        <ToneBanner
          tone={patientsAutoRefreshNotice.tone}
          message={patientsAutoRefreshNotice.message}
          destination="患者管理"
          nextAction={patientsAutoRefreshNotice.nextAction}
          runId={resolvedRunId}
        />
      )}
      <ToneBanner tone={tone} message={toneMessage} runId={resolvedRunId} />
      {chartsArrivalBanner && (
        <ToneBanner
          tone={chartsArrivalBanner.tone}
          message={chartsArrivalBanner.message}
          patientId={patientIdParam}
          receptionId={receptionIdParam}
          destination="患者管理"
          nextAction={chartsArrivalBanner.nextAction}
          runId={resolvedRunId}
        />
      )}
      {unlinkedNotice && (
        <ToneBanner
          tone="warning"
          message={unlinkedNotice.message}
          destination="患者管理"
          nextAction="一覧を確認"
          runId={resolvedRunId}
        />
      )}

      <section className="patients-page__content patients-page__split" style={splitLayoutStyle}>
        <aside className="patients-page__sidebar" aria-label="local 患者検索と一覧" id="patients-sidebar-pane">

          <section className="patients-search" id="patients-search" tabIndex={-1} aria-label="患者検索" aria-live={infoLive}>
            <form className="patients-search__form" onSubmit={handleFilterSubmit}>

              {/* 基本：キーワード + 更新/クリア（同一ブロック） */}
              <div className="patients-search__primary">
                <label className="patients-search__field patients-search__field--keyword">
                  <span>検索キーワード</span>
                  <input
                    id="patients-filter-keyword"
                    name="patientsFilterKeyword"
                    type="search"
                    value={draftFilters.keyword}
                    onChange={(event) => onFilterChange('keyword', event.target.value)}
                    aria-describedby="patients-filter-keyword-help"
                    aria-label="検索キーワード"
                  />
                  <small id="patients-filter-keyword-help" className="patients-page__field-help">
                    氏名、カナ、患者番号、電話、郵便番号のいずれかを入力してください。
                  </small>
                </label>

                <div className="patients-search__primary-actions">
                  <button type="submit" className="patients-search__button primary">
                    検索
                  </button>
                  <button type="button" className="patients-search__button ghost" onClick={handleClearFilters}>
                    クリア
                  </button>

                  {/* 未適用の注意は“細いピル”で、ボタンの横に常時見える位置へ */}
                  {hasPendingFilterChanges ? (
                    <span className="patients-search__pending-pill" role="status" aria-live="polite">
                      未適用あり
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="patients-search__actions">
                <span className="patients-page__field-help">
                  local search は氏名・カナ・患者番号・電話・郵便番号のみを使います。未使用の詳細条件はこの画面から外しています。
                </span>
                <button type="button" className="patients-search__button ghost" onClick={() => patientsQuery.refetch()}>
                  再取得
                </button>
              </div>

              {/* official import：折りたたみ */}
              <details className="patients-search__advanced">
                <summary>ORCA既存患者取込</summary>
                <section className="patients-search__import" aria-label="ORCA既存患者取込">
                  <label className="patients-search__field">
                    <span>ORCA患者番号で ORCA既存患者取込</span>
                    <input
                      id="patients-orca-import-patient-id"
                      name="patientsOrcaImportPatientId"
                      value={orcaImportPatientId}
                      onChange={(event) => setOrcaImportPatientId(event.target.value)}
                      inputMode="numeric"
                      aria-describedby="patients-orca-import-help"
                    />
                    <small id="patients-orca-import-help" className="patients-page__field-help">
                      数字のみで入力してください（例: 00001234）。
                    </small>
                  </label>
                  <button
                    type="button"
                    className="patients-search__button primary"
                    onClick={() => handleImportByPatientId()}
                    disabled={importMutation.isPending || !importPatientIdDraft}
                    aria-describedby={importDisabledReason ? 'patients-orca-import-disabled-reason' : undefined}
                  >
                    {importMutation.isPending ? 'ORCA既存患者取込中…' : 'ORCA既存患者取込'}
                  </button>
                  {importDisabledReason ? (
                    <small id="patients-orca-import-disabled-reason" className="patients-page__field-help">
                      {importDisabledReason}
                    </small>
                  ) : null}
                </section>
              </details>

              {/* 保存ビュー：適用は見せる／管理（削除・保存）は折りたたみ */}
              <div className="patients-search__saved" aria-label="保存ビュー">
                <div className="patients-search__saved-meta" role="status" aria-live={infoLive}>
                  <span className="patients-search__saved-share">受付 ↔ 患者管理 で共有</span>
                  <span className="patients-search__saved-updated">
                    {selectedSavedView ? `選択中の更新: ${savedViewUpdatedAtLabel ?? '—'}` : '選択中のビューはありません'}
                  </span>
                </div>

                {/* 適用（常時表示） */}
                <div className="patients-search__saved-row">
                  <label className="patients-search__field">
                    <span>保存ビュー</span>
                    <select
                      id="patients-saved-view"
                      name="patientsSavedView"
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
                    className="patients-search__button ghost"
                    onClick={() => {
                      const view = savedViews.find((item) => item.id === selectedViewId);
                      if (view) applySavedView(view);
                    }}
                    disabled={!selectedViewId}
                  >
                    適用
                  </button>
                </div>

                {/* 管理（折りたたみ） */}
                <details className="patients-search__advanced">
                  <summary>保存ビューを管理</summary>

                  <div className="patients-search__saved-row">
                    <button
                      type="button"
                      className="patients-search__button ghost"
                      onClick={handleDeleteView}
                      disabled={!selectedViewId}
                    >
                      削除
                    </button>
                  </div>

                  <div className="patients-search__saved-row">
                    <label className="patients-search__field">
                      <span>ビュー名</span>
                      <input
                        id="patients-saved-view-name"
                        name="patientsSavedViewName"
                        value={savedViewName}
                        onChange={(event) => setSavedViewName(event.target.value)}
                        aria-describedby="patients-saved-view-name-help"
                      />
                      <small id="patients-saved-view-name-help" className="patients-page__field-help">
                        例: 内科/午前/保険。共有しやすい短い名前を付けてください。
                      </small>
                    </label>

                    <button type="button" className="patients-search__button primary" onClick={handleSaveView}>
                      現在の条件を保存
                    </button>
                  </div>
                </details>
              </div>
            </form>
          </section>

          {/* 左：ステータスバー（件数/更新/未適用/選択注意を“常時見える”場所へ） */}
          <div className="patients-sidebar__statusbar" role="status" aria-live={infoLive}>
            <div className="patients-sidebar__statusbar-main">
              <span className="patients-sidebar__statusbar-label">検索結果</span>
              <strong className="patients-sidebar__statusbar-count">{resolvedRecordsReturned ?? patients.length}件</strong>
              {patientsQuery.isFetching ? <span className="patients-sidebar__statusbar-fetching">更新中…</span> : null}
            </div>

            <div className="patients-sidebar__statusbar-meta">
              <span>更新: {patientsUpdatedAtLabel}</span>
              <span>自動更新: {autoRefreshIntervalLabel}</span>
              <span>
                適用: {appliedFilters.keyword ? `local KW=${appliedFilters.keyword}` : 'local KWなし'}
              </span>
              <span>検索状態: {hasPendingFilterChanges ? '未適用あり' : '最新'}</span>
            </div>

            {/* selectionNotice はここへ移動（一覧と同じ文脈で常時見える） */}
            {selectionNotice ? (
              <div
                className={`patients-sidebar__statusbar-note patients-sidebar__statusbar-note--${selectionNotice.tone}`}
                role="status"
                aria-live={selectionNotice.tone === 'warning' ? 'assertive' : 'polite'}
              >
                {selectionNotice.message}
              </div>
            ) : null}
          </div>

          {/* APIエラーは左（検索/一覧）文脈に置く（検索セクション内から移動） */}
          {patientsErrorContext ? (
            <ApiFailureBanner
              subject="患者情報"
              destination="患者管理"
              runId={patientsQuery.data?.runId ?? flags.runId}
              nextAction="再取得"
              retryLabel="再取得"
              onRetry={() => patientsQuery.refetch()}
              isRetrying={patientsQuery.isFetching}
              {...patientsErrorContext}
            />
          ) : null}

          {/* 欠損アラートは一覧の上（常時見える）に固定（一覧内から移動） */}
          {(unlinkedCounts.missingPatientId > 0 || unlinkedCounts.missingName > 0) ? (
            <div className={`patients-page__list-alert${isUnlinkedStopNotice ? ' is-blocked' : ''}`} role="status" aria-live="polite">
              <strong>{unlinkedAlertLabel}</strong>
              <span>患者ID欠損: {unlinkedCounts.missingPatientId}</span>
              <span>氏名欠損: {unlinkedCounts.missingName}</span>
            </div>
          ) : null}

          {/* 左下：患者一覧（ここだけスクロール） */}
          <div className="patients-page__list" role="list" aria-label="患者一覧">

            {/* emptyState は一覧内のまま */}
            {patientsEmptyState ? (
              <div className="patients-page__empty" role="status" aria-live={infoLive}>
                <strong className="patients-page__empty-title">{patientsEmptyState.title}</strong>
                <span className="patients-page__empty-body">{patientsEmptyState.body}</span>
                <div className="patients-page__empty-actions" role="group" aria-label="次アクション">
                  <button type="button" className="ghost" onClick={() => void refetchPatients()}>
                    再取得
                  </button>
                  {emptyStateImportPatientId ? (
                    <button
                      type="button"
                      className="ghost"
                      disabled={importMutation.isPending}
                      onClick={() => handleImportByPatientId(emptyStateImportPatientId)}
                      title={`患者ID ${emptyStateImportPatientId} の既存患者情報を取り込みます`}
                      aria-describedby={selectedImportDisabledReason ? 'patients-empty-import-disabled-reason' : undefined}
                    >
                      {importMutation.isPending ? 'ORCA既存患者取込中…' : 'ORCA既存患者取込'}
                    </button>
                  ) : null}
                  {patientsEmptyState.showReception ? (
                    <button type="button" className="ghost" onClick={handleOpenReception}>
                      受付へ
                    </button>
                  ) : null}
                </div>
                <span className="patients-page__empty-hint">{patientsEmptyState.hint}</span>
                <span className="patients-page__empty-hint">ヒント: local search は ID/氏名/カナ/電話/郵便番号で絞れます。</span>
                {selectedImportDisabledReason ? (
                  <span id="patients-empty-import-disabled-reason" className="patients-page__empty-hint">
                    {selectedImportDisabledReason}
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* 患者行（次の “3) 患者行をGrid化” で map内を置換） */}
            {patients.map((patient, index) => {
              const selected = selectedId === resolvePatientKey(patient);
              const unlinkedState = resolveUnlinkedState(patient);
              return (
                <button
                  key={`${resolvePatientKey(patient)}-${index}`}
                  type="button"
                  className={`patients-page__row${selected ? ' is-selected' : ''}${unlinkedState.isUnlinked ? ' is-unlinked' : ''}`}
                  onClick={() => handleSelect(patient)}
                  aria-pressed={selected}
                >
                  <span className="patients-page__row-id" aria-label={`患者ID ${patient.patientId ?? '—'}`}>
                    <span className="patients-page__row-id-label">患者ID</span>
                    <span className="patients-page__row-id-value">{patient.patientId ?? '—'}</span>
                  </span>

                  <div className="patients-page__row-name">
                    <strong className="patients-page__row-name-main">{patient.name ?? '氏名未登録'}</strong>
                    <span className="patients-page__row-name-kana">{patient.kana ?? 'カナ未登録'}</span>
                  </div>

                  <div className="patients-page__row-flags" aria-label="状態">
                    {unlinkedState.isUnlinked ? (
                      <span className={`patients-page__row-flag patients-page__row-flag--unlinked${isUnlinkedStopNotice ? ' is-blocked' : ''}`}>
                        {unlinkedBadgeLabel}
                      </span>
                    ) : null}
                    {unlinkedState.missingPatientId ? (
                      <span className={`patients-page__row-flag patients-page__row-flag--detail${isUnlinkedStopNotice ? ' is-blocked' : ''}`}>
                        患者ID欠損
                      </span>
                    ) : null}
                    {unlinkedState.missingName ? (
                      <span className={`patients-page__row-flag patients-page__row-flag--detail${isUnlinkedStopNotice ? ' is-blocked' : ''}`}>
                        氏名欠損
                      </span>
                    ) : null}
                  </div>

                  <div className="patients-page__row-meta">
                    <span className="patients-page__row-meta-age">
                      {resolveAgeLabel(patient.birthDate)} / {resolveSexLabel(patient.sex)}
                    </span>
                    <span className="patients-page__row-meta-insurance" title={patient.insurance ?? '保険未設定'}>
                      {patient.insurance ? truncateText(patient.insurance, 28) : '保険未設定'}
                    </span>
                    <span className="patients-page__row-meta-last">
                      {patient.lastVisit ? `最終受診 ${patient.lastVisit}` : '受診履歴なし'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div
          className={`patients-page__splitter${isSidebarResizing ? ' is-dragging' : ''}`}
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-valuemin={SIDEBAR_WIDTH_MIN}
          aria-valuemax={SIDEBAR_WIDTH_MAX}
          aria-valuenow={Math.round(sidebarWidth)}
          aria-label="患者一覧ペインの幅"
          aria-controls="patients-sidebar-pane patients-detail-pane"
          onPointerDown={handleSidebarSplitterPointerDown}
          onPointerMove={handleSidebarSplitterPointerMove}
          onPointerUp={handleSidebarSplitterPointerRelease}
          onPointerCancel={handleSidebarSplitterPointerRelease}
          onLostPointerCapture={handleSidebarSplitterPointerRelease}
          onKeyDown={handleSidebarSplitterKeyDown}
        />

        <div className="patients-page__form" aria-live={resolveAriaLive(blocking ? 'warning' : 'info')} id="patients-detail-pane">
          <div className="patients-detail__context" role="status" aria-live={infoLive}>
            <PatientIdentityBar
              className="patients-detail__identity-bar"
              eyebrow="患者マスタ / 監査"
              patientId={form.patientId}
              internalPatientId={patientHeaderInternalReference}
              patientName={form.name}
              patientKana={form.kana}
              birthDateIso={form.birthDate}
              sex={resolveSexLabel(form.sex)}
              age={resolveAgeLabel(form.birthDate)}
              visitDate={patientHeaderVisitDate}
              department={patientHeaderDepartment}
              physician={patientHeaderPhysician}
              insuranceCombination={patientHeaderInsurance}
              orcaSourceLabel={form.patientId ? '患者管理同期状態' : undefined}
              orcaCacheStatus={form.patientId ? patientHeaderOrcaCacheStatus : undefined}
              note={form.lastVisit ? `最終受診 ${form.lastVisit}` : '受診履歴なし'}
              selected={Boolean(form.patientId)}
              chips={
                <>
                  {selectedUnlinkedBadge ? (
                    <StatusPill className="patients-detail__badge" tone="warning" size="xs">
                      {selectedUnlinkedBadge}
                    </StatusPill>
                  ) : null}
                  {blocking ? (
                    <StatusPill className="patients-detail__badge" tone="error" size="xs">
                      編集ブロック中
                    </StatusPill>
                  ) : null}
                  {form.insurance ? (
                    <StatusPill className="patients-detail__badge" tone="neutral" size="xs">
                      {truncateText(form.insurance, 36)}
                    </StatusPill>
                  ) : null}
                </>
              }
            />
          </div>
          <div className="patients-page__detail-tabs" role="tablist" aria-label="患者詳細タブ">
            {PATIENTS_DETAIL_TABS.map((tab) => (
              <button
                key={tab.key}
                id={`patients-detail-tab-${tab.key}`}
                ref={(node) => {
                  detailTabRefs.current[tab.key] = node;
                }}
                type="button"
                role="tab"
                tabIndex={activeDetailTab === tab.key ? 0 : -1}
                aria-selected={activeDetailTab === tab.key}
                aria-controls={`patients-detail-panel-${tab.key}`}
                className={`patients-page__detail-tab${activeDetailTab === tab.key ? ' is-active' : ''}`}
                onClick={() => setActiveDetailTab(tab.key)}
                onKeyDown={(event) => handleDetailTabKeyDown(event, tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <section
            id="patients-detail-panel-basic"
            role="tabpanel"
            aria-labelledby="patients-detail-tab-basic"
            className="patients-page__detail-panel"
            hidden={activeDetailTab !== 'basic'}
          >
            <form className="patients-page__basic-form" onSubmit={handleSubmit}>
          <div className="patients-page__form-header patients-page__sticky-bar">
            <div>
              <p className="patients-page__pill">
                {editorMode === 'create' ? '新患登録' : '既存患者更新'}
              </p>
              <div className="patients-page__form-title">
                <h3 className="patients-page__section-title">
                  {editorMode === 'create' ? '患者情報（新患登録）' : '患者情報（既存患者更新）'}
                </h3>
              </div>
              {blocking ? <p className="patients-page__block-summary">編集ブロック中（詳細は下部）</p> : null}
            </div>
            <div className="patients-page__form-actions">
              <button
                type="button"
                className="ghost"
                disabled={mutation.isPending || importMutation.isPending}
                onClick={() => {
                  setEditorMode('create');
                  setSelectedId(undefined);
                  setForm({});
                  setBaseline(null);
                  baselineRef.current = null;
                  setValidationErrors([]);
                  setLastAttempt(null);
                  setSelectionNotice({ tone: 'info', message: '新患登録モードへ切り替えました。' });
                }}
              >
                新患登録
              </button>
              <button
                type="button"
                className="ghost"
                disabled={mutation.isPending || editorMode === 'update' || !baseline}
                onClick={() => {
                  if (!baseline) return;
                  setEditorMode('update');
                  setForm(baseline);
                  setValidationErrors([]);
                  setLastAttempt(null);
                }}
              >
                更新モードへ戻る
              </button>
              <button
                type="button"
                className="ghost"
                disabled={!importSelectedPatientId || importMutation.isPending || mutation.isPending}
                onClick={() => importSelectedPatientId && importMutation.mutate(importSelectedPatientId)}
                title={importSelectedPatientId ? 'ORCA既存患者の情報を再取得します' : '患者IDが必要です'}
              >
                {importMutation.isPending ? 'ORCA既存患者取込中…' : 'ORCA既存患者取込'}
              </button>
              <button type="submit" disabled={saveDisabled}>
                {mutation.isPending ? '送信中…' : editorMode === 'create' ? '新患登録を実行' : '既存患者更新を実行'}
              </button>
            </div>
          </div>

          <div className="patients-page__change-summary" aria-live="polite">
            <span className="patients-page__change-summary-label">変更点</span>
            {basicChangedRows.length === 0 ? (
              <span className="patients-page__change-empty">変更なし</span>
            ) : (
              <div className="patients-page__change-chips">
                {basicChangedRows.map((row) => (
                  <span key={row.key} className="patients-page__change-chip">
                    {row.label}
                  </span>
                ))}
              </div>
            )}
            {basicChangedRows.length > 0 ? (
              <details className="patients-page__change-details">
                <summary>差分を表示</summary>
                <ul>
                  {basicChangedRows.map((row) => (
                    <li key={`diff-${row.key}`}>
                      {row.label}: {row.before || '—'} → {row.after || '—'}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          {selectedUnlinked ? (
            <div className={`patients-page__unlinked-alert${isUnlinkedStopNotice ? ' is-blocked' : ''}`} role="alert" aria-live="assertive">
              <strong>{unlinkedAlertLabel}</strong>
              <p>選択中の患者データに欠損があります。</p>
              <div className="patients-page__unlinked-alert-tags">
                {selectedUnlinked.missingPatientId ? <span>患者ID欠損</span> : null}
                {selectedUnlinked.missingName ? <span>氏名欠損</span> : null}
              </div>
            </div>
          ) : null}

          {blocking && (
            <div className="patients-page__block" role="alert" aria-live={resolveAriaLive('warning')}>
              <strong>編集ブロック中のため保存できません</strong>
              <p>復旧手順は下記を確認してください。</p>
              <MissingMasterRecoveryGuide
                runId={resolvedRunId}
                onRefetch={() => patientsQuery.refetch()}
                onOpenReception={handleOpenReception}
                isRefetching={patientsQuery.isFetching}
              />
              <div className="patients-page__block-reasons">
                <span>ブロック理由</span>
                <ul>
                  {blockReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
              <small>
                現在の患者情報同期確認状態: {currentOrcaStatus.state}（{currentOrcaStatus.detail}）
              </small>
            </div>
          )}

          <PatientFormErrorAlert errors={displayedValidationErrors} onFocusField={focusField} />

          <fieldset className="patients-page__grid" disabled={blocking}>
            <label>
              <span>患者ID</span>
              <input
                id="patients-form-patientId"
                aria-label="患者ID"
                value={form.patientId ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, patientId: event.target.value }))}
                inputMode="numeric"
                aria-invalid={fieldErrorMap.has('patientId')}
                aria-describedby={buildAriaDescribedBy(
                  'patients-form-help-patientId',
                  fieldErrorMap.has('patientId') ? 'patients-form-error-patientId' : undefined,
                )}
                readOnly={editorMode === 'update'}
                disabled={blocking || editorMode === 'update'}
              />
              <small id="patients-form-help-patientId" className="patients-page__field-help">
                {editorMode === 'create' ? '空欄時は自動採番します。手入力する場合のみ数字を指定してください。' : '更新時は既存の患者IDを固定で使用します。'}
              </small>
              {fieldErrorMap.has('patientId') ? (
                <small id="patients-form-error-patientId" className="patients-page__field-error" role="alert">
                  {fieldErrorMap.get('patientId')?.message}
                </small>
              ) : null}
            </label>
            <label>
              <span>氏名</span>
              <input
                id="patients-form-name"
                aria-label="氏名"
                required
                value={form.name ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                aria-invalid={fieldErrorMap.has('name')}
                aria-describedby={buildAriaDescribedBy(
                  'patients-form-help-name',
                  fieldErrorMap.has('name') ? 'patients-form-error-name' : undefined,
                )}
                disabled={blocking}
              />
              <small id="patients-form-help-name" className="patients-page__field-help">
                必須項目です（例: 山田 花子）。
              </small>
              {fieldErrorMap.has('name') ? (
                <small id="patients-form-error-name" className="patients-page__field-error" role="alert">
                  {fieldErrorMap.get('name')?.message}
                </small>
              ) : null}
            </label>
            <label>
              <span>カナ</span>
              <input
                id="patients-form-kana"
                aria-label="カナ"
                value={form.kana ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, kana: event.target.value }))}
                aria-invalid={fieldErrorMap.has('kana')}
                aria-describedby={buildAriaDescribedBy(
                  'patients-form-help-kana',
                  fieldErrorMap.has('kana') ? 'patients-form-error-kana' : undefined,
                )}
                disabled={blocking}
              />
              <small id="patients-form-help-kana" className="patients-page__field-help">
                全角カタカナで入力してください。
              </small>
              {fieldErrorMap.has('kana') ? (
                <small id="patients-form-error-kana" className="patients-page__field-error" role="alert">
                  {fieldErrorMap.get('kana')?.message}
                </small>
              ) : null}
            </label>
            <label>
              <span>生年月日</span>
              <input
                id="patients-form-birthDate"
                aria-label="生年月日"
                type="date"
                value={form.birthDate ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, birthDate: event.target.value }))}
                aria-invalid={fieldErrorMap.has('birthDate')}
                aria-describedby={buildAriaDescribedBy(
                  'patients-form-help-birthDate',
                  fieldErrorMap.has('birthDate') ? 'patients-form-error-birthDate' : undefined,
                )}
                disabled={blocking}
              />
              <small id="patients-form-help-birthDate" className="patients-page__field-help">
                YYYY-MM-DD 形式（例: 1980-04-01）。
              </small>
              {fieldErrorMap.has('birthDate') ? (
                <small id="patients-form-error-birthDate" className="patients-page__field-error" role="alert">
                  {fieldErrorMap.get('birthDate')?.message}
                </small>
              ) : null}
            </label>
            <label>
              <span>性別</span>
              <select
                id="patients-form-sex"
                aria-label="性別"
                value={form.sex ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, sex: event.target.value }))}
                aria-invalid={fieldErrorMap.has('sex')}
                aria-describedby={buildAriaDescribedBy(
                  fieldErrorMap.has('sex') ? 'patients-form-error-sex' : undefined,
                )}
                disabled={blocking}
              >
                <option value="">未選択</option>
                <option value="M">男性</option>
                <option value="F">女性</option>
              </select>
              {fieldErrorMap.has('sex') ? (
                <small id="patients-form-error-sex" className="patients-page__field-error" role="alert">
                  {fieldErrorMap.get('sex')?.message}
                </small>
              ) : null}
            </label>
            <label>
              <span>電話</span>
              <input
                id="patients-form-phone"
                aria-label="電話"
                value={form.phone ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                inputMode="tel"
                aria-invalid={fieldErrorMap.has('phone')}
                aria-describedby={buildAriaDescribedBy(
                  'patients-form-help-phone',
                  fieldErrorMap.has('phone') ? 'patients-form-error-phone' : undefined,
                )}
                disabled={blocking}
              />
              <small id="patients-form-help-phone" className="patients-page__field-help">
                数字/括弧/ハイフン/空白のみ（6〜24文字）。
              </small>
              {fieldErrorMap.has('phone') ? (
                <small id="patients-form-error-phone" className="patients-page__field-error" role="alert">
                  {fieldErrorMap.get('phone')?.message}
                </small>
              ) : null}
            </label>
            <label>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span>郵便番号</span>
                <button
                  type="button"
                  className="ghost"
                  onClick={handleOrcaAddressLookup}
                  disabled={!canLookupAddress}
                  aria-label="住所補完"
                >
                  {orcaAddressPending ? '住所補完中…' : '住所補完'}
                </button>
              </span>
              <input
                id="patients-form-zip"
                aria-label="郵便番号"
                value={form.zip ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, zip: event.target.value }))}
                inputMode="numeric"
                aria-invalid={fieldErrorMap.has('zip')}
                aria-describedby={buildAriaDescribedBy(
                  'patients-form-help-zip',
                  fieldErrorMap.has('zip') ? 'patients-form-error-zip' : undefined,
                )}
                disabled={blocking}
              />
              <small id="patients-form-help-zip" className="patients-page__field-help">
                123-4567 形式（ハイフンは任意）。
              </small>
              {addressLookupDisabledReason ? (
                <small className="patients-page__field-help">{addressLookupDisabledReason}</small>
              ) : null}
              {fieldErrorMap.has('zip') ? (
                <small id="patients-form-error-zip" className="patients-page__field-error" role="alert">
                  {fieldErrorMap.get('zip')?.message}
                </small>
              ) : null}
            </label>
            <label className="span-2">
              <span>住所</span>
              <input
                id="patients-form-address"
                aria-label="住所"
                value={form.address ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                disabled={blocking}
                aria-describedby="patients-form-help-address"
              />
              <small id="patients-form-help-address" className="patients-page__field-help">
                住所補完後に不足分だけを追記してください（例: 東京都千代田区千代田1-1）。
              </small>
            </label>
            <label className="span-2">
              <span>メモ</span>
              <textarea
                id="patients-form-memo"
                aria-label="メモ"
                rows={3}
                value={form.memo ?? ''}
                readOnly
                disabled={blocking}
                aria-describedby="patients-form-help-memo"
              />
              <small id="patients-form-help-memo" className="patients-page__field-help">
                院内メモとして保存します。
              </small>
            </label>
          </fieldset>

          {toast && (
            <div className="patients-page__save-support" role="status" aria-live={resolveAriaLive('info')}>
              {toast && (
                <div className={`patients-page__toast patients-page__toast--${toast.tone}`} role="alert" aria-live={resolveAriaLive(toast.tone)}>
                  <strong>{toast.message}</strong>
                  {toast.detail && <p>{toast.detail}</p>}
                </div>
              )}

              {(toast?.tone === 'error' || toast?.tone === 'warning') && lastAttempt ? (
                <div className="patients-page__retry-save" role="alert" aria-live={resolveAriaLive('warning')}>
                  <p className="patients-page__retry-save-title">保存を再試行できます</p>
                  <div className="patients-page__retry-save-actions" role="group" aria-label="保存失敗時の操作">
                    <button type="button" onClick={() => mutation.mutate(lastAttempt)} disabled={mutation.isPending}>
                      再試行
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const base = baselineRef.current ?? baseline;
                        if (!base) return;
                        setForm(base);
                        setValidationErrors([]);
                        setToast({ tone: 'info', message: '変更を巻き戻しました（直近取得値へ復元）。' });
                      }}
                      disabled={mutation.isPending || !(baselineRef.current ?? baseline)}
                    >
                      巻き戻し
                    </button>
                    <button type="button" onClick={() => patientsQuery.refetch()} disabled={mutation.isPending}>
                      再取得
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

            </form>
          </section>

          <section
            id="patients-detail-panel-audit"
            role="tabpanel"
            aria-labelledby="patients-detail-tab-audit"
            className="patients-page__detail-panel"
            hidden={activeDetailTab !== 'audit'}
          >
          <div id="patients-audit-log" className="patients-page__audit-view" role="status" aria-live={infoLive}>
            <div className="patients-page__audit-head patients-page__sticky-bar">
              <h3>監査ログビュー</h3>
              <div className="patients-page__audit-actions">
                <button type="button" onClick={() => setAuditSnapshot(getAuditEventLog())}>
                  履歴を更新
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuditKeyword('');
                    setAuditOutcome('all');
                    setAuditScope('selected');
                    setAuditSort('desc');
                    setAuditLimit('10');
                    setAuditDateFrom('');
                    setAuditDateTo('');
                  }}
                >
                  フィルタ初期化
                </button>
              </div>
            </div>
            <div className="patients-page__audit-filters" role="group" aria-label="監査検索">
              <label>
                <span>キーワード</span>
                <input
                  id="patients-audit-keyword"
                  name="patientsAuditKeyword"
                  value={auditKeyword}
                  onChange={(event) => setAuditKeyword(event.target.value)}
                  placeholder="patientId / runId / action / outcome"
                />
              </label>
              <label>
                <span>outcome</span>
                <select
                  id="patients-audit-outcome"
                  name="patientsAuditOutcome"
                  value={auditOutcome}
                  onChange={(event) => setAuditOutcome(event.target.value as typeof auditOutcome)}
                >
                  <option value="all">全件</option>
                  <option value="success">success</option>
                  <option value="error">error</option>
                  <option value="warning">warning</option>
                  <option value="partial">partial</option>
                  <option value="unknown">unknown</option>
                </select>
              </label>
              <label>
                <span>対象</span>
                <select
                  id="patients-audit-scope"
                  name="patientsAuditScope"
                  value={auditScope}
                  onChange={(event) => setAuditScope(event.target.value as typeof auditScope)}
                >
                  <option value="selected">選択患者のみ</option>
                  <option value="all">全患者</option>
                </select>
              </label>
              <label>
                <span>並び順</span>
                <select
                  id="patients-audit-sort"
                  name="patientsAuditSort"
                  value={auditSort}
                  onChange={(event) => setAuditSort(event.target.value as typeof auditSort)}
                >
                  <option value="desc">新しい順</option>
                  <option value="asc">古い順</option>
                </select>
              </label>
              <label>
                <span>件数</span>
                <select
                  id="patients-audit-limit"
                  name="patientsAuditLimit"
                  value={auditLimit}
                  onChange={(event) => setAuditLimit(event.target.value as typeof auditLimit)}
                >
                  <option value="10">10件</option>
                  <option value="20">20件</option>
                  <option value="50">50件</option>
                  <option value="all">全件</option>
                </select>
              </label>
              <label>
                <span>開始日</span>
                <input
                  id="patients-audit-date-from"
                  name="patientsAuditDateFrom"
                  type="date"
                  value={auditDateFrom}
                  onChange={(event) => setAuditDateFrom(event.target.value)}
                />
              </label>
              <label>
                <span>終了日</span>
                <input
                  id="patients-audit-date-to"
                  name="patientsAuditDateTo"
                  type="date"
                  value={auditDateTo}
                  onChange={(event) => setAuditDateTo(event.target.value)}
                />
              </label>
              <div className="patients-page__audit-count" role="status" aria-live="polite">
                対象件数: {auditRows.total}
              </div>
            </div>
            {auditDateValidation.message ? (
              <div className="patients-page__audit-date-error" role="alert" aria-live="assertive">
                {auditDateValidation.message}
              </div>
            ) : null}
            <div className="patients-page__audit-summary">
              <div className="patients-page__audit-card">
                <span>{lastOfficialAction === 'import' ? '取込結果' : '保存結果'}</span>
                <strong>
                  {lastSaveResult
                    ? lastSaveResult.ok
                      ? '成功'
                      : lastSaveResult.writeAccepted
                        ? '要確認'
                        : '失敗'
                    : '未送信'}
                </strong>
                <small>{PATIENTS_SUPPORT_GUIDE}</small>
                {lastSaveResult?.message ? (
                  <small>
                    {lastSaveResult.ok
                      ? lastOfficialAction === 'import'
                        ? '取込処理は ORCA正本の再取得で同期確認しました。'
                        : '保存処理は ORCA正本の再取得で同期確認しました。'
                      : lastSaveResult.writeAccepted
                        ? lastSaveResult.errorCategory === 'business_partial'
                          ? '一部のみ処理されたため同期確認済みにしていません。'
                          : '保存は受け付けられましたが、ORCA正本の再取得による同期確認が完了していません。'
                        : '保存に失敗しました。時間をおいて再試行してください。'}
                  </small>
                ) : null}
              </div>
              <div className="patients-page__audit-card">
                <span>{lastOfficialAction === 'import' ? 'ORCA既存患者取込' : '患者情報更新'}</span>
                <strong>{lastSaveOrcaStatus.state}</strong>
                <small>{lastSaveOrcaStatus.detail}</small>
              </div>
              <div className="patients-page__audit-card">
                <span>運用整理</span>
                <strong>完了</strong>
                <small>患者画面から ORCA 原本/保険/メモの XML 補助 UI を撤去しました。</small>
              </div>
              <div className="patients-page__audit-card">
                <span>現在の患者情報同期可否</span>
                <strong>{currentOrcaStatus.state}</strong>
                <small>{currentOrcaStatus.detail}</small>
              </div>
            </div>
            {lastAuditEvent && (
              <AuditSummaryInline
                auditEvent={lastAuditEvent}
                variant="inline"
                className="patients-page__audit-inline"
                runId={resolvedRunId}
              />
            )}
            {lastAuditEvent && (
              <div className="patients-page__audit-raw">
                <strong>最新の監査要約</strong>
                <p>既定表示では action / outcome / 時刻 / RUN_ID を要約し、内部 endpoint は表示しません。</p>
              </div>
            )}
            <div className="patients-page__audit-list" role="list" aria-label="保存履歴">
              {auditRows.items.length === 0 ? (
                <p className="patients-page__audit-empty" role="status" aria-live={infoLive}>
                  まだ保存履歴がありません（患者管理/カルテで保存すると同期確認の結果を表示します）。
                </p>
              ) : (
                auditRows.items.map((record, index) => {
                  const desc = describeAudit(record);
                  return (
                    <div key={`${record.timestamp}-${index}`} className="patients-page__audit-row" role="listitem">
                      <div className="patients-page__audit-row-main">
                        <strong>{desc.action}</strong>
                        <StatusPill className="patients-page__audit-pill" label="outcome" value={desc.outcome} />
                        <StatusPill className="patients-page__audit-pill" label="ORCA" value={desc.orcaStatus} />
                      </div>
                      <div className="patients-page__audit-row-sub">
                        <span>RUN_ID: {desc.runId}</span>
                        <span>{record.timestamp}</span>
                      </div>
                      <details className="patients-page__audit-support">
                        <summary>サポート向け詳細を表示</summary>
                        <div className="patients-page__audit-support-body">
                          <span>patientId: {desc.patientId}</span>
                          {desc.traceId !== '—' ? <span>traceId: {desc.traceId}</span> : null}
                          {desc.requestId !== '—' ? <span>requestId: {desc.requestId}</span> : null}
                          {desc.status ? <span>status: {String(desc.status)}</span> : null}
                          {desc.changedKeys ? <span>changedKeys: {desc.changedKeys}</span> : null}
                          {desc.operation ? <span>operation: {desc.operation}</span> : null}
                          {desc.section ? <span>section: {desc.section}</span> : null}
                          {desc.sourcePath ? <span>sourcePath: {desc.sourcePath}</span> : null}
                          {renderAuditMessage(desc.message)}
                        </div>
                      </details>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          </section>
        </div>
      </section>

      <FocusTrapDialog
        open={Boolean(pendingSelection)}
        role="alertdialog"
        title="未保存の変更があります"
        description="患者を切り替える前に、保存するか破棄するかを選択してください。"
        onClose={handleCancelSelectionSwitch}
        testId="patients-switch-dialog"
      >
        <div className="patients-page__switch-dialog" role="group" aria-label="患者切替確認">
          <p>
            現在の患者: {form.name ?? '未選択'}（{form.patientId ?? '—'}）
          </p>
          <p>
            切替先: {pendingSelection?.name ?? '—'}（{pendingSelection?.patientId ?? '—'}）
          </p>
          <p className="patients-page__switch-dialog-note">未保存の変更があります。保存して切替または破棄して切替を選択してください。</p>
          <div className="patients-page__switch-dialog-actions">
            <button type="button" onClick={handleCancelSelectionSwitch} disabled={switchingSelection}>
              キャンセル
            </button>
            <button type="button" onClick={() => void handleSaveSelectionSwitch()} disabled={switchingSelection}>
              {switchingSelection ? '保存中…' : '保存して切り替え'}
            </button>
            <button type="button" onClick={handleDiscardSelectionSwitch} disabled={switchingSelection}>
              破棄して切り替え
            </button>
          </div>
        </div>
      </FocusTrapDialog>
      </main>
    </>
  );
}
