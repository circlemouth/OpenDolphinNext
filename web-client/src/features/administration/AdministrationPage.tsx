import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getAuditEventLog, logAuditEvent } from '../../libs/audit/auditLogger';
import { isSystemAdminRole } from '../../libs/auth/roles';
import { resolveAriaLive, resolveRunId } from '../../libs/observability/observability';
import { copyTextToClipboard } from '../../libs/observability/runIdCopy';
import { useAppToast } from '../../libs/ui/appToast';
import { useSession } from '../../AppRouter';
import { ToneBanner } from '../reception/components/ToneBanner';
import { AuditSummaryInline } from '../shared/AuditSummaryInline';
import { RunIdBadge } from '../shared/RunIdBadge';
import {
  ORCA_QUEUE_STALL_THRESHOLD_MS,
  isOrcaQueueWarningEntry,
} from '../outpatient/orcaQueueStatus';
import { AccessManagementPanel } from './AccessManagementPanel';
import { MasterUpdatesPanel } from './MasterUpdatesPanel';
import { OrcaUserManagementPanel } from './OrcaUserManagementPanel';
import {
  discardOrcaQueue,
  fetchAdminConfig,
  fetchOperationsHealth,
  fetchOperationsReadiness,
  fetchOrcaQueue,
  fetchPvtWorkerHealth,
  retryOrcaQueue,
  saveAdminConfig,
  type AdminConfigPayload,
  type ChartsMasterSourcePolicy,
  type OrcaQueueEntry,
} from './api';
import { ConfirmDialog } from './components/ConfirmDialog';
import { AdminAlert } from './components/AdminAlert';
import { AdminDeliveryConfigCard } from './delivery/AdminDeliveryConfigCard';
import { AdminDeliveryStatusCard } from './delivery/AdminDeliveryStatusCard';
import { DeliveryDashboard } from './delivery/DeliveryDashboard';
import { DeliverySubNav } from './delivery/DeliverySubNav';
import { OperationsHealthCard } from './delivery/OperationsHealthCard';
import { OrcaInternalWrapperCard } from './delivery/OrcaInternalWrapperCard';
import { OrcaQueueCard } from './delivery/OrcaQueueCard';
import { WebOrcaConnectionCard } from './delivery/WebOrcaConnectionCard';
import { type DeliverySection, DELIVERY_SECTION_ITEMS } from './delivery/types';
import {
  fetchOrcaConnectionConfig,
  saveOrcaConnectionConfig,
  testOrcaConnection,
  type OrcaConnectionTestResponse,
} from './orcaConnectionApi';
import {
  postBirthDelivery,
  postMedicalRecords,
  postMedicalSets,
  postPatientMutation,
  postSubjectiveEntry,
  type MedicalPatientSummary,
  type MedicalRecordEntry,
  type OrcaInternalWrapperBase,
  type OrcaInternalWrapperEndpoint,
} from './orcaInternalWrapperApi';
import type { FeedbackTone } from '../shared/feedbackTone';
import './administration.css';

type AdministrationPageProps = {
  runId: string;
  role?: string;
};

type AdministrationTab = 'delivery' | 'orca-users' | 'master-updates';
type Feedback = { tone: FeedbackTone; message: string };

type OrcaInternalWrapperResult = OrcaInternalWrapperBase & {
  generatedAt?: string;
  patient?: MedicalPatientSummary;
  records?: MedicalRecordEntry[];
  warnings?: string[];
  recordedAt?: string;
  patientDbId?: number;
  patientId?: string;
};

type OrcaInternalWrapperFormState = {
  payload: string;
  result?: OrcaInternalWrapperResult | null;
  parseError?: string;
};

type OrcaConnectionFormState = {
  useWeborca: boolean;
  serverUrl: string;
  port: string;
  username: string;
  password: string;
  passwordConfigured: boolean;
  passwordUpdatedAt?: string;
  clientAuthEnabled: boolean;
  clientCertificateFile: File | null;
  clientCertificateConfigured: boolean;
  clientCertificateFileName?: string;
  clientCertificateUploadedAt?: string;
  clientCertificatePassphrase: string;
  clientCertificatePassphraseConfigured: boolean;
  clientCertificatePassphraseUpdatedAt?: string;
  caCertificateFile: File | null;
  caCertificateConfigured: boolean;
  caCertificateFileName?: string;
  caCertificateUploadedAt?: string;
  updatedAt?: string;
  auditSummary?: string;
};

type GuardAction =
  | 'access'
  | 'edit'
  | 'save'
  | 'retry'
  | 'discard'
  | 'operations-refresh'
  | 'orca-internal-wrapper'
  | 'orca-connection';

type OrcaInternalWrapperOption = {
  id: OrcaInternalWrapperEndpoint;
  label: string;
  hint: string;
  stubFixed?: boolean;
  defaultPayload: Record<string, unknown>;
};

const DEFAULT_ORCA_ENDPOINT =
  (import.meta.env as Record<string, string | undefined>).VITE_ORCA_ENDPOINT ?? 'https://localhost:9080/openDolphin/resources';
const DEFAULT_FORM: AdminConfigPayload = {
  orcaEndpoint: DEFAULT_ORCA_ENDPOINT,
  verifyAdminDelivery: false,
  chartsDisplayEnabled: true,
  chartsSendEnabled: true,
  chartsMasterSource: 'auto',
};

const DEFAULT_ORCA_CONNECTION_FORM: OrcaConnectionFormState = {
  useWeborca: true,
  serverUrl: '',
  port: '443',
  username: '',
  password: '',
  passwordConfigured: false,
  clientAuthEnabled: false,
  clientCertificateFile: null,
  clientCertificateConfigured: false,
  clientCertificatePassphrase: '',
  clientCertificatePassphraseConfigured: false,
  caCertificateFile: null,
  caCertificateConfigured: false,
};

const DEFAULT_DELIVERY_SECTION: DeliverySection = 'dashboard';

const isDeliverySection = (value: string | null): value is DeliverySection =>
  DELIVERY_SECTION_ITEMS.some((item) => item.id === value);

const resolveAdministrationTabFromSearch = (params: URLSearchParams): AdministrationTab => {
  const tab = params.get('tab');
  if (tab === 'access') return 'orca-users';
  if (tab === 'orca-users' || tab === 'master-updates') return tab;
  return 'delivery';
};

const resolveDeliverySectionFromSearch = (params: URLSearchParams): DeliverySection => {
  const section = params.get('section');
  if (isDeliverySection(section)) return section;
  return DEFAULT_DELIVERY_SECTION;
};

const normalizeAdministrationSearchParams = (params: URLSearchParams) => {
  const normalized = new URLSearchParams(params);
  const tab = resolveAdministrationTabFromSearch(params);
  if (tab === 'delivery') {
    normalized.delete('tab');
    normalized.set('section', resolveDeliverySectionFromSearch(params));
    return normalized;
  }
  normalized.set('tab', tab);
  normalized.delete('section');
  return normalized;
};

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimeAgo = (iso?: string) => {
  if (!iso) return '―';
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return '1分以内';
  return `${minutes}分前`;
};

const formatTimestamp = (iso?: string) => {
  if (!iso) return '―';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ja-JP', { hour12: false });
};

const formatTimestampWithAgo = (iso?: string) => {
  if (!iso) return '―';
  return `${formatTimestamp(iso)}（${formatTimeAgo(iso)}）`;
};

const normalizeEnvironmentLabel = (raw?: string) => {
  if (!raw) return undefined;
  const value = raw.toLowerCase();
  if (value.includes('stage')) return 'stage';
  if (value.includes('dev')) return 'dev';
  if (value.includes('prod')) return 'prod';
  if (value.includes('preview')) return 'preview';
  return raw;
};

const formatRoleLabel = (value?: string) => {
  if (!value) return '不明';
  if (value === 'system_admin') return 'システム管理者';
  return value;
};

const getStringValue = (value: unknown) => (typeof value === 'string' ? value : undefined);

const extractPatientIdFromPayload = (endpoint: OrcaInternalWrapperEndpoint, payload?: Record<string, unknown>) => {
  if (!payload) return undefined;
  if (endpoint === 'patient-mutation') {
    const patient = (payload.patient ?? {}) as Record<string, unknown>;
    return getStringValue(patient.patientId);
  }
  return getStringValue(payload.patientId);
};

const extractOperationFromPayload = (payload?: Record<string, unknown>) =>
  payload ? getStringValue(payload.operation) : undefined;

const resolveDeliveryFlagState = (
  configValue: boolean | string | undefined,
  deliveryValue: boolean | string | undefined,
) => {
  if (deliveryValue === undefined && configValue === undefined) return 'unknown' as const;
  if (deliveryValue === undefined) return 'pending' as const;
  if (configValue === undefined) return 'applied' as const;
  return deliveryValue === configValue ? ('applied' as const) : ('pending' as const);
};

const buildChartsDeliveryStatus = (
  config?: Partial<AdminConfigPayload>,
  delivery?: Partial<AdminConfigPayload>,
) => ({
  chartsDisplayEnabled: resolveDeliveryFlagState(config?.chartsDisplayEnabled, delivery?.chartsDisplayEnabled),
  chartsSendEnabled: resolveDeliveryFlagState(config?.chartsSendEnabled, delivery?.chartsSendEnabled),
  chartsMasterSource: resolveDeliveryFlagState(config?.chartsMasterSource, delivery?.chartsMasterSource),
});

const summarizeDeliveryStatus = (status: ReturnType<typeof buildChartsDeliveryStatus>) => {
  const states = Object.values(status).filter(Boolean);
  const hasPending = states.some((state) => state === 'pending');
  const hasApplied = states.some((state) => state === 'applied');
  return {
    hasPending,
    summary: hasPending ? '次回リロード' : hasApplied ? '即時反映' : '不明',
  };
};

const buildInternalWrapperOptions = (today: string): OrcaInternalWrapperOption[] => [
  {
    id: 'medical-sets',
    label: '/api/orca/medical-sets（診療セット）',
    hint: 'Trial 閉鎖のため stub 応答固定（Api_Result=79）',
    stubFixed: true,
    defaultPayload: {
      requestNumber: '01',
      patientId: '00002',
      sets: [
        {
          medicalClass: '120',
          medicationCode: '112007410',
          medicationName: 'テスト処方',
          quantity: '1',
          note: 'stub',
        },
      ],
    },
  },
  {
    id: 'birth-delivery',
    label: '/api/orca/birth-delivery（出産育児一時金）',
    hint: 'Trial 閉鎖のため stub 応答固定（Api_Result=79）',
    stubFixed: true,
    defaultPayload: {
      requestNumber: '01',
      patientId: '00002',
      insuranceCombinationNumber: '0001',
      performDate: today,
      note: '出産育児一時金',
    },
  },
  {
    id: 'medical-records',
    label: '/api/orca/medical/records（診療記録取得）',
    hint: 'feature flag により stub/実データが切り替わります',
    defaultPayload: {
      patientId: '00002',
      fromDate: '',
      toDate: today,
      performMonths: 12,
      departmentCode: '01',
      sequentialNumber: '',
      insuranceCombinationNumber: '0001',
      includeVisitStatus: false,
    },
  },
  {
    id: 'patient-mutation',
    label: '/api/orca/patient/mutation（患者作成/更新/削除）',
    hint: 'delete は Trial 閉鎖のため stub 応答',
    defaultPayload: {
      operation: 'create',
      patient: {
        patientId: '00002',
        wholeName: 'テスト 太郎',
        wholeNameKana: 'テスト タロウ',
        birthDate: '1980-01-01',
        sex: '1',
        telephone: '',
        mobilePhone: '',
        zipCode: '',
        addressLine: '',
      },
    },
  },
  {
    id: 'chart-subjectives',
    label: '/api/orca/chart/subjectives（主訴登録）',
    hint: 'feature flag により stub/実データが切り替わります',
    defaultPayload: {
      patientId: '00002',
      performDate: today,
      soapCategory: 'S',
      physicianCode: '10001',
      body: '主訴テスト',
    },
  },
];

const buildInternalWrapperState = (options: OrcaInternalWrapperOption[]) =>
  options.reduce<Record<OrcaInternalWrapperEndpoint, OrcaInternalWrapperFormState>>((acc, option) => {
    acc[option.id] = {
      payload: JSON.stringify(option.defaultPayload, null, 2),
      result: null,
    };
    return acc;
  }, {} as Record<OrcaInternalWrapperEndpoint, OrcaInternalWrapperFormState>);

const resolveInternalWrapperOption = (options: OrcaInternalWrapperOption[], endpoint: OrcaInternalWrapperEndpoint) =>
  options.find((option) => option.id === endpoint) ?? options[0];

const resolveStatusTone = (result: { ok: boolean } | null, isPending: boolean) => {
  if (isPending) return 'pending' as const;
  if (!result) return 'idle' as const;
  return result.ok ? ('ok' as const) : ('error' as const);
};

const resolveStatusLabel = (result: { ok: boolean; apiResult?: string } | null, isPending: boolean) => {
  if (isPending) return '実行中';
  if (!result) return '未実行';
  if (result.ok) return `OK${result.apiResult ? ` (${result.apiResult})` : ''}`;
  return 'NG';
};

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function AdministrationPage({ runId, role }: AdministrationPageProps) {
  const isSystemAdmin = isSystemAdminRole(role);
  const session = useSession();
  const { enqueue } = useAppToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const guardLogRef = useRef<{ runId?: string; role?: string }>({});
  const forbiddenLogRef = useRef<{ runId?: string; noted?: boolean }>({});
  const today = useMemo(() => formatDateInput(new Date()), []);
  const internalWrapperOptions = useMemo(() => buildInternalWrapperOptions(today), [today]);
  const normalizedSearchParams = useMemo(() => normalizeAdministrationSearchParams(searchParams), [searchParams]);
  const activeTab = useMemo(() => resolveAdministrationTabFromSearch(normalizedSearchParams), [normalizedSearchParams]);
  const activeDeliverySection = useMemo(
    () => resolveDeliverySectionFromSearch(normalizedSearchParams),
    [normalizedSearchParams],
  );

  const [form, setForm] = useState<AdminConfigPayload>(DEFAULT_FORM);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [orcaConnectionForm, setOrcaConnectionForm] = useState<OrcaConnectionFormState>(DEFAULT_ORCA_CONNECTION_FORM);
  const [orcaConnectionSavedSnapshot, setOrcaConnectionSavedSnapshot] = useState<OrcaConnectionFormState | null>(null);
  const [orcaConnectionFieldErrors, setOrcaConnectionFieldErrors] = useState<{
    serverUrl?: string;
    port?: string;
    username?: string;
    password?: string;
    clientCertificate?: string;
    clientCertificatePassphrase?: string;
  }>({});
  const [orcaConnectionFeedback, setOrcaConnectionFeedback] = useState<Feedback | null>(null);
  const [orcaConnectionTestResult, setOrcaConnectionTestResult] = useState<OrcaConnectionTestResponse | null>(null);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [discardConfirmTarget, setDiscardConfirmTarget] = useState<OrcaQueueEntry | null>(null);
  const [orcaInternalWrapperTarget, setOrcaInternalWrapperTarget] = useState<OrcaInternalWrapperEndpoint>('medical-sets');
  const [orcaInternalWrapperState, setOrcaInternalWrapperState] = useState<
    Record<OrcaInternalWrapperEndpoint, OrcaInternalWrapperFormState>
  >(() => buildInternalWrapperState(internalWrapperOptions));
  const [connectivitySummary, setConnectivitySummary] = useState<{
    testedAt: string;
    success: number;
    failure: number;
    details: string[];
  } | null>(null);

  const queryClient = useQueryClient();
  const guardDetailsId = 'admin-guard-details';
  const actorId = `${session.facilityId}:${session.userId}`;
  const showAdminDebugToggles = import.meta.env.VITE_ENABLE_ADMIN_DEBUG === '1' && isSystemAdmin;

  const configQuery = useQuery({
    queryKey: ['admin-config'],
    queryFn: fetchAdminConfig,
    staleTime: 60_000,
  });
  const orcaConnectionQuery = useQuery({
    queryKey: ['admin-orca-connection'],
    queryFn: fetchOrcaConnectionConfig,
    staleTime: 60_000,
    enabled: activeTab === 'delivery',
  });
  const queueQuery = useQuery({
    queryKey: ['orca-queue'],
    queryFn: () => fetchOrcaQueue(),
    refetchInterval: 60_000,
  });
  const operationsHealthQuery = useQuery({
    queryKey: ['admin-operations-health'],
    queryFn: fetchOperationsHealth,
    staleTime: 30_000,
    enabled: activeTab === 'delivery',
  });
  const operationsReadinessQuery = useQuery({
    queryKey: ['admin-operations-readiness'],
    queryFn: fetchOperationsReadiness,
    staleTime: 30_000,
    enabled: activeTab === 'delivery',
  });
  const pvtWorkerHealthQuery = useQuery({
    queryKey: ['admin-pvt-worker-health'],
    queryFn: fetchPvtWorkerHealth,
    staleTime: 30_000,
    enabled: activeTab === 'delivery',
  });

  const latestRunId = configQuery.data?.runId ?? queueQuery.data?.runId ?? runId;
  const resolvedRunId = resolveRunId(latestRunId);
  const panelRunId = resolvedRunId ?? runId;
  const infoLive = resolveAriaLive('info');
  const envFallback = normalizeEnvironmentLabel(
    (import.meta.env as Record<string, string | undefined>).VITE_ENVIRONMENT ??
      (import.meta.env as Record<string, string | undefined>).VITE_DEPLOY_ENV ??
      (import.meta.env.MODE === 'development' ? 'dev' : import.meta.env.MODE),
  );
  const environmentLabel = normalizeEnvironmentLabel(configQuery.data?.environment) ?? envFallback ?? 'unknown';
  const warningThresholdMinutes = Math.round(ORCA_QUEUE_STALL_THRESHOLD_MS / 60000);
  const rawConfig = configQuery.data;
  const latestAuditEvent = useMemo(() => {
    const snapshot = getAuditEventLog();
    const latest = snapshot[snapshot.length - 1];
    return (latest?.payload as Record<string, unknown> | undefined) ?? undefined;
  }, [configQuery.data?.runId, feedback?.message, queueQuery.data?.runId, resolvedRunId]);

  const orcaConnectionAuthStatus = orcaConnectionQuery.data?.status;
  const orcaConnectionAccessVerified = activeTab === 'delivery' && orcaConnectionAuthStatus === 200;
  const orcaConnectionAuthBlocked =
    activeTab === 'delivery' && (orcaConnectionAuthStatus === 401 || orcaConnectionAuthStatus === 403);

  const buildConnectionSnapshot = useCallback(
    (formState: OrcaConnectionFormState): OrcaConnectionFormState => ({
      ...formState,
      password: '',
      clientCertificateFile: null,
      clientCertificatePassphrase: '',
      caCertificateFile: null,
    }),
    [],
  );

  const orcaConnectionDirty = useMemo(() => {
    if (!orcaConnectionSavedSnapshot) return false;
    return JSON.stringify(buildConnectionSnapshot(orcaConnectionForm)) !== JSON.stringify(orcaConnectionSavedSnapshot);
  }, [buildConnectionSnapshot, orcaConnectionForm, orcaConnectionSavedSnapshot]);

  const configDirty = useMemo(() => {
    if (!rawConfig) return false;
    return (
      rawConfig.orcaEndpoint !== form.orcaEndpoint ||
      rawConfig.verifyAdminDelivery !== form.verifyAdminDelivery ||
      rawConfig.chartsDisplayEnabled !== form.chartsDisplayEnabled ||
      rawConfig.chartsSendEnabled !== form.chartsSendEnabled ||
      rawConfig.chartsMasterSource !== form.chartsMasterSource
    );
  }, [form, rawConfig]);

  const configDiffRows = useMemo(
    () =>
      [
        { key: 'orcaEndpoint', label: 'orcaEndpoint', before: rawConfig?.orcaEndpoint, after: form.orcaEndpoint },
        {
          key: 'verifyAdminDelivery',
          label: 'verifyAdminDelivery',
          before: rawConfig?.verifyAdminDelivery,
          after: form.verifyAdminDelivery,
        },
        {
          key: 'chartsDisplayEnabled',
          label: 'chartsDisplayEnabled',
          before: rawConfig?.chartsDisplayEnabled,
          after: form.chartsDisplayEnabled,
        },
        {
          key: 'chartsSendEnabled',
          label: 'chartsSendEnabled',
          before: rawConfig?.chartsSendEnabled,
          after: form.chartsSendEnabled,
        },
        {
          key: 'chartsMasterSource',
          label: 'chartsMasterSource',
          before: rawConfig?.chartsMasterSource,
          after: form.chartsMasterSource,
        },
      ].filter((row) => row.before !== row.after),
    [form, rawConfig],
  );

  const updateOrcaInternalWrapperState = useCallback(
    (endpoint: OrcaInternalWrapperEndpoint, patch: Partial<OrcaInternalWrapperFormState>) => {
      setOrcaInternalWrapperState((prev) => ({
        ...prev,
        [endpoint]: {
          ...prev[endpoint],
          ...patch,
        },
      }));
    },
    [],
  );
  const internalWrapperOption = resolveInternalWrapperOption(internalWrapperOptions, orcaInternalWrapperTarget);
  const currentInternalWrapper = orcaInternalWrapperState[orcaInternalWrapperTarget];
  const internalWrapperResult = currentInternalWrapper?.result ?? null;

  const logGuardEvent = useCallback(
    (action: GuardAction, detail?: string) => {
      logAuditEvent({
        runId: resolvedRunId,
        source: 'admin/guard',
        note: action === 'access' ? 'admin access restricted' : 'admin action blocked',
        payload: {
          operation: action,
          actor: actorId,
          role,
          requiredRole: 'system_admin',
          environment: environmentLabel,
          detail,
        },
      });
    },
    [actorId, environmentLabel, resolvedRunId, role],
  );

  const reportGuardedAction = useCallback(
    (action: GuardAction, detail?: string) => {
      setFeedback({ tone: 'warn', message: '権限がないため操作をブロックしました。システム管理者へ依頼してください。' });
      logGuardEvent(action, detail);
    },
    [logGuardEvent],
  );

  useEffect(() => {
    const normalizedSearch = normalizedSearchParams.toString();
    const currentSearch = searchParams.toString();
    if (normalizedSearch === currentSearch) return;
    setSearchParams(normalizedSearchParams, { replace: true });
  }, [normalizedSearchParams, searchParams, setSearchParams]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = `管理画面 | 施設ID=${session.facilityId ?? 'unknown'}`;
  }, [location.pathname, session.facilityId]);

  useEffect(() => {
    if (isSystemAdmin) return;
    if (guardLogRef.current.runId === resolvedRunId && guardLogRef.current.role === role) return;
    guardLogRef.current = { runId: resolvedRunId, role };
    logGuardEvent('access', 'read-only view');
  }, [isSystemAdmin, logGuardEvent, resolvedRunId, role]);

  useEffect(() => {
    const data = configQuery.data;
    if (!data) return;
    setForm((prev) => ({
      ...prev,
      orcaEndpoint: data.orcaEndpoint || prev.orcaEndpoint,
      verifyAdminDelivery: data.verifyAdminDelivery ?? prev.verifyAdminDelivery,
      chartsDisplayEnabled: data.chartsDisplayEnabled ?? prev.chartsDisplayEnabled,
      chartsSendEnabled: data.chartsSendEnabled ?? prev.chartsSendEnabled,
      chartsMasterSource: data.chartsMasterSource ?? prev.chartsMasterSource,
    }));
  }, [configQuery.data]);

  useEffect(() => {
    const data = orcaConnectionQuery.data;
    if (!data) return;
    if (!data.ok) {
      setOrcaConnectionFeedback({ tone: 'warn', message: 'WebORCA 接続設定の取得に失敗しました。再取得してください。' });
      return;
    }
    const next = buildConnectionSnapshot({
      ...orcaConnectionForm,
      useWeborca: data.useWeborca ?? orcaConnectionForm.useWeborca,
      serverUrl: data.serverUrl ?? orcaConnectionForm.serverUrl,
      port: data.port !== undefined ? String(data.port) : orcaConnectionForm.port,
      username: data.username ?? orcaConnectionForm.username,
      password: '',
      passwordConfigured: Boolean(data.passwordConfigured),
      passwordUpdatedAt: data.passwordUpdatedAt,
      clientAuthEnabled: Boolean(data.clientAuthEnabled),
      clientCertificateFile: null,
      clientCertificateConfigured: Boolean(data.clientCertificateConfigured),
      clientCertificateFileName: data.clientCertificateFileName,
      clientCertificateUploadedAt: data.clientCertificateUploadedAt,
      clientCertificatePassphrase: '',
      clientCertificatePassphraseConfigured: Boolean(data.clientCertificatePassphraseConfigured),
      clientCertificatePassphraseUpdatedAt: data.clientCertificatePassphraseUpdatedAt,
      caCertificateFile: null,
      caCertificateConfigured: Boolean(data.caCertificateConfigured),
      caCertificateFileName: data.caCertificateFileName,
      caCertificateUploadedAt: data.caCertificateUploadedAt,
      updatedAt: data.updatedAt,
      auditSummary: data.auditSummary,
    });
    setOrcaConnectionForm(next);
    setOrcaConnectionSavedSnapshot(next);
    setOrcaConnectionFieldErrors({});
    setOrcaConnectionFeedback(null);
  }, [buildConnectionSnapshot, orcaConnectionForm, orcaConnectionQuery.data]);

  const configMutation = useMutation({
    mutationFn: saveAdminConfig,
    onSuccess: () => {
      setSaveConfirmOpen(false);
      setFeedback({ tone: 'success', message: '設定を保存しました。' });
      queryClient.invalidateQueries({ queryKey: ['admin-config'] });
    },
    onError: () => {
      setSaveConfirmOpen(false);
      setFeedback({ tone: 'error', message: '保存に失敗しました。再度お試しください。' });
    },
  });

  const orcaConnectionSaveMutation = useMutation({
    mutationFn: saveOrcaConnectionConfig,
    onSuccess: (data) => {
      if (!data.ok) {
        setOrcaConnectionFeedback({ tone: 'error', message: 'WebORCA 接続設定の保存に失敗しました。設定内容を確認してください。' });
        return;
      }
      setOrcaConnectionFeedback({ tone: 'success', message: 'WebORCA 接続設定を保存しました。' });
      queryClient.invalidateQueries({ queryKey: ['admin-orca-connection'] });
    },
    onError: () => {
      setOrcaConnectionFeedback({
        tone: 'error',
        message: 'WebORCA 接続設定の保存に失敗しました。設定内容を確認してください。',
      });
    },
  });

  const orcaConnectionTestMutation = useMutation({
    mutationFn: testOrcaConnection,
    onSuccess: (data) => {
      setOrcaConnectionTestResult(data);
      if (data.ok) {
        setOrcaConnectionFeedback({
          tone: 'success',
          message: `接続テストに成功しました（HTTP ${data.orcaHttpStatus ?? '―'} / Api_Result=${data.apiResult ?? '―'}）。`,
        });
      } else {
        setOrcaConnectionFeedback({
          tone: 'error',
          message: '接続テストに失敗しました。接続先・認証・証明書を確認してください。',
        });
      }
    },
    onError: (error) => {
      setOrcaConnectionTestResult({
        ok: false,
        status: 0,
        errorCategory: 'unknown',
        error: toErrorMessage(error),
      });
      setOrcaConnectionFeedback({
        tone: 'error',
        message: '接続テストに失敗しました。接続先・認証・証明書を確認してください。',
      });
    },
  });

  const queueMutation = useMutation({
    mutationFn: (params: { kind: 'retry' | 'discard'; patientId: string }) => {
      if (params.kind === 'retry') return retryOrcaQueue(params.patientId);
      return discardOrcaQueue(params.patientId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orca-queue'] });
      setFeedback({ tone: 'info', message: 'キュー操作を実行しました。' });
    },
    onError: () => {
      setFeedback({ tone: 'error', message: 'キュー操作に失敗しました。' });
    },
  });

  const internalWrapperMutation = useMutation({
    mutationFn: async (params: { endpoint: OrcaInternalWrapperEndpoint; payload: Record<string, unknown> }) => {
      switch (params.endpoint) {
        case 'medical-sets':
          return postMedicalSets(params.payload);
        case 'birth-delivery':
          return postBirthDelivery(params.payload);
        case 'medical-records':
          return postMedicalRecords(params.payload);
        case 'patient-mutation':
          return postPatientMutation(params.payload);
        case 'chart-subjectives':
          return postSubjectiveEntry(params.payload);
        default:
          return {
            ok: false,
            status: 0,
            error: 'unsupported endpoint',
            runId: resolvedRunId,
            raw: {},
          } as OrcaInternalWrapperResult;
      }
    },
    onSuccess: (result, variables) => {
      updateOrcaInternalWrapperState(variables.endpoint, { result, parseError: undefined });
      const patientId = extractPatientIdFromPayload(variables.endpoint, variables.payload);
      const operation = extractOperationFromPayload(variables.payload);
      logAuditEvent({
        runId: result.runId ?? resolvedRunId,
        traceId: result.traceId,
        source: 'admin/orca-internal-wrapper',
        note: 'orca internal wrapper request',
        payload: {
          operation: variables.endpoint,
          actor: actorId,
          role,
          patientId,
          operationType: operation,
          apiResult: result.apiResult,
          apiResultMessage: result.apiResultMessage,
          status: result.status,
          stub: result.stub,
          missingMaster: result.missingMaster,
          fallbackUsed: result.fallbackUsed,
        },
      });
    },
  });

  const internalWrapperStatusTone = (() => {
    if (internalWrapperMutation.isPending) return 'pending' as const;
    if (!internalWrapperResult) return 'idle' as const;
    if (!internalWrapperResult.ok) return 'error' as const;
    if (internalWrapperResult.stub) return 'warn' as const;
    if (internalWrapperResult.apiResult && !internalWrapperResult.apiResult.startsWith('00')) return 'warn' as const;
    return 'ok' as const;
  })();
  const internalWrapperStatusLabel = resolveStatusLabel(internalWrapperResult ?? null, internalWrapperMutation.isPending);

  const queueEntries = useMemo(() => queueQuery.data?.queue ?? [], [queueQuery.data?.queue]);
  const warningEntries = useMemo(() => {
    const nowMs = Date.now();
    return queueEntries.filter((entry) => isOrcaQueueWarningEntry(entry, nowMs).isWarning);
  }, [queueEntries]);

  const requireOrcaConnectionAdminAuth = useCallback(() => {
    if (!isSystemAdmin) {
      reportGuardedAction('orca-connection');
      return false;
    }
    if (!orcaConnectionAccessVerified) {
      setOrcaConnectionFeedback({
        tone: 'warn',
        message:
          'WebORCA 接続設定は、管理者アカウントで認証済みのセッションでのみ表示・編集できます。再ログイン後に再取得してください。',
      });
      reportGuardedAction('orca-connection', 'admin authentication required');
      return false;
    }
    return true;
  }, [isSystemAdmin, orcaConnectionAccessVerified, reportGuardedAction]);

  const patchOrcaConnectionForm = useCallback(
    (patch: Partial<OrcaConnectionFormState>) => {
      if (!requireOrcaConnectionAdminAuth()) return;
      setOrcaConnectionForm((prev) => ({ ...prev, ...patch }));
      setOrcaConnectionFieldErrors((prev) => ({
        ...prev,
        serverUrl: patch.serverUrl !== undefined ? undefined : prev.serverUrl,
        port: patch.port !== undefined ? undefined : prev.port,
        username: patch.username !== undefined ? undefined : prev.username,
        password: patch.password !== undefined ? undefined : prev.password,
        clientCertificate: patch.clientCertificateFile !== undefined ? undefined : prev.clientCertificate,
        clientCertificatePassphrase:
          patch.clientCertificatePassphrase !== undefined ? undefined : prev.clientCertificatePassphrase,
      }));
    },
    [requireOrcaConnectionAdminAuth],
  );

  const handleOrcaConnectionWeborcaToggle = (next: boolean) => {
    const currentPort = Number(orcaConnectionForm.port);
    const shouldAutoSwitchPort = !Number.isFinite(currentPort) || currentPort === 443 || currentPort === 8000;
    patchOrcaConnectionForm({
      useWeborca: next,
      port: shouldAutoSwitchPort ? String(next ? 443 : 8000) : orcaConnectionForm.port,
    });
  };

  const handleOrcaConnectionSave = () => {
    if (!requireOrcaConnectionAdminAuth()) return;
    const serverUrl = orcaConnectionForm.serverUrl.trim();
    const port = Number(orcaConnectionForm.port);
    const username = orcaConnectionForm.username.trim();
    const password = orcaConnectionForm.password.trim();
    const passphrase = orcaConnectionForm.clientCertificatePassphrase.trim();
    const fieldErrors: {
      serverUrl?: string;
      port?: string;
      username?: string;
      password?: string;
      clientCertificate?: string;
      clientCertificatePassphrase?: string;
    } = {};

    if (!serverUrl) fieldErrors.serverUrl = 'サーバURLは必須です。';
    if (!Number.isFinite(port) || port <= 0 || port > 65535) fieldErrors.port = 'ポートは 1〜65535 で入力してください。';
    if (!username) fieldErrors.username = 'ユーザー名は必須です。';
    if (!orcaConnectionForm.passwordConfigured && !password) fieldErrors.password = 'パスワードまたは API キーは必須です。';
    if (orcaConnectionForm.clientAuthEnabled) {
      const hasP12 = orcaConnectionForm.clientCertificateConfigured || Boolean(orcaConnectionForm.clientCertificateFile);
      if (!hasP12) fieldErrors.clientCertificate = 'mTLS 有効時はクライアント証明書（.p12）が必須です。';
      if (!passphrase && !orcaConnectionForm.clientCertificatePassphraseConfigured) {
        fieldErrors.clientCertificatePassphrase = 'mTLS 有効時は証明書パスフレーズが必須です。';
      }
    }
    setOrcaConnectionFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setOrcaConnectionFeedback({ tone: 'error', message: '入力エラーを修正してください。' });
      return;
    }

    orcaConnectionSaveMutation.mutate({
      useWeborca: orcaConnectionForm.useWeborca,
      serverUrl,
      port,
      username,
      password: password || undefined,
      clientAuthEnabled: orcaConnectionForm.clientAuthEnabled,
      clientCertificatePassphrase: passphrase || undefined,
      clientCertificateFile: orcaConnectionForm.clientCertificateFile,
      caCertificateFile: orcaConnectionForm.caCertificateFile,
    });
  };

  const handleCopyValue = useCallback(
    async (value: string, label: string) => {
      try {
        await copyTextToClipboard(value);
        enqueue({ tone: 'success', message: `${label} をコピーしました`, detail: value, durationMs: 1800 });
      } catch {
        enqueue({ tone: 'error', message: `${label} のコピーに失敗しました` });
      }
    },
    [enqueue],
  );

  const requestTemplate = useMemo(
    () =>
      [
        '【システム管理者 権限依頼テンプレート】',
        `施設ID: ${session.facilityId}`,
        `環境: ${environmentLabel}`,
        '作業内容: 管理画面の設定変更/配信',
        '影響範囲: WebORCA接続設定・配信設定・ORCA queue 操作',
      ].join('\n'),
    [environmentLabel, session.facilityId],
  );

  const handleCopyRequestTemplate = useCallback(async () => {
    await handleCopyValue(requestTemplate, '依頼テンプレ');
  }, [handleCopyValue, requestTemplate]);

  const handleOrcaConnectionTest = () => {
    if (!requireOrcaConnectionAdminAuth()) return;
    orcaConnectionTestMutation.mutate();
  };

  const handleInputChange = (key: keyof AdminConfigPayload, value: string | boolean) => {
    if (!isSystemAdmin) {
      reportGuardedAction('edit', `field:${key}`);
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleChartsMasterSourceChange = (value: string) => {
    const next: ChartsMasterSourcePolicy =
      value === 'auto' || value === 'server' || value === 'mock' || value === 'snapshot' || value === 'fallback'
        ? value
        : 'auto';
    handleInputChange('chartsMasterSource', next);
  };

  const handleSave = () => {
    if (!isSystemAdmin) {
      reportGuardedAction('save');
      return;
    }
    setSaveConfirmOpen(true);
  };

  const handleConfirmSave = () => {
    configMutation.mutate(form);
  };

  const handleRetry = (patientId: string) => {
    if (!isSystemAdmin) {
      reportGuardedAction('retry', `patient:${patientId}`);
      return;
    }
    queueMutation.mutate({ kind: 'retry', patientId });
  };

  const handleDiscardRequest = (entry: OrcaQueueEntry) => {
    if (!isSystemAdmin) {
      reportGuardedAction('discard', `patient:${entry.patientId}`);
      return;
    }
    setDiscardConfirmTarget(entry);
  };

  const handleConfirmDiscard = () => {
    if (!discardConfirmTarget) return;
    queueMutation.mutate({ kind: 'discard', patientId: discardConfirmTarget.patientId });
    setDiscardConfirmTarget(null);
  };

  const handleOperationsRefresh = async () => {
    if (!isSystemAdmin) {
      reportGuardedAction('operations-refresh');
      return;
    }
    await Promise.all([
      operationsHealthQuery.refetch(),
      operationsReadinessQuery.refetch(),
      pvtWorkerHealthQuery.refetch(),
    ]);
  };

  const handleInternalWrapperPayloadChange = (value: string) => {
    updateOrcaInternalWrapperState(orcaInternalWrapperTarget, { payload: value });
  };

  const handleInternalWrapperSubmit = () => {
    if (!isSystemAdmin) {
      reportGuardedAction('orca-internal-wrapper');
      return;
    }
    const rawPayload = currentInternalWrapper?.payload ?? '';
    try {
      const parsed = rawPayload ? (JSON.parse(rawPayload) as Record<string, unknown>) : {};
      updateOrcaInternalWrapperState(orcaInternalWrapperTarget, { parseError: undefined });
      internalWrapperMutation.mutate({ endpoint: orcaInternalWrapperTarget, payload: parsed });
    } catch (error) {
      updateOrcaInternalWrapperState(orcaInternalWrapperTarget, {
        parseError: error instanceof Error ? error.message : 'JSON の解析に失敗しました。',
      });
    }
  };

  const handleInternalWrapperReset = () => {
    const defaultPayload = internalWrapperOption?.defaultPayload ?? {};
    updateOrcaInternalWrapperState(orcaInternalWrapperTarget, {
      payload: JSON.stringify(defaultPayload, null, 2),
      parseError: undefined,
    });
  };

  const handleRunConnectivityGroup = async () => {
    if (!isSystemAdmin) {
      reportGuardedAction('operations-refresh', 'connectivity-group');
      return;
    }
    const checks: Array<Promise<{ label: string; ok: boolean; detail: string }>> = [
      operationsReadinessQuery
        .refetch()
        .then(({ data }) => ({
          label: 'operations readiness',
          ok: Boolean(data?.ok),
          detail: `HTTP ${data?.status ?? '―'} / status=${data?.summaryStatus ?? '―'}`,
        }))
        .catch((error) => ({
          label: 'operations readiness',
          ok: false,
          detail: toErrorMessage(error),
        })),
      postMedicalRecords(resolveInternalWrapperOption(internalWrapperOptions, 'medical-records').defaultPayload)
        .then((result) => ({
          label: 'internal wrapper medical-records',
          ok: Boolean(result.ok),
          detail: `HTTP ${result.status} / Api_Result=${result.apiResult ?? '―'} / source=${result.stub ? 'stub' : 'real'}`,
        }))
        .catch((error) => ({
          label: 'internal wrapper medical-records',
          ok: false,
          detail: toErrorMessage(error),
        })),
    ];

    if (orcaConnectionAccessVerified) {
      checks.push(
        testOrcaConnection()
          .then((result) => ({
            label: 'WebORCA connection test',
            ok: Boolean(result.ok),
            detail: `HTTP ${result.orcaHttpStatus ?? result.status} / Api_Result=${result.apiResult ?? '―'}`,
          }))
          .catch((error) => ({
            label: 'WebORCA connection test',
            ok: false,
            detail: toErrorMessage(error),
          })),
      );
    }

    const results = await Promise.all(checks);
    const success = results.filter((entry) => entry.ok).length;
    const failure = results.length - success;
    const details = results.map((entry) => `${entry.ok ? 'OK' : 'NG'} ${entry.label}: ${entry.detail}`);
    setConnectivitySummary({ testedAt: new Date().toISOString(), success, failure, details });
  };

  const isForbidden = configQuery.data?.status === 403 || rawConfig?.status === 403;

  useEffect(() => {
    if (!isForbidden) return;
    if (forbiddenLogRef.current.runId === resolvedRunId && forbiddenLogRef.current.noted) return;
    forbiddenLogRef.current = { runId: resolvedRunId, noted: true };
    setFeedback({ tone: 'warn', message: '管理API が権限不足のため読み取り専用で表示しています。' });
    logAuditEvent({
      runId: resolvedRunId,
      source: 'admin/guard',
      note: 'admin api forbidden',
      payload: {
        operation: 'access',
        actor: actorId,
        role,
        requiredRole: 'system_admin',
        status: 403,
        detail: 'admin config/delivery 403 forbidden',
      },
    });
  }, [actorId, isForbidden, resolvedRunId, role]);

  const deliveryMode = configQuery.data?.deliveryMode ?? rawConfig?.deliveryMode;
  const effectiveDeliveryEtag = configQuery.data?.deliveryEtag ?? configQuery.data?.deliveryVersion;
  const deliveryStatus = buildChartsDeliveryStatus(rawConfig, rawConfig);
  const deliverySummary = summarizeDeliveryStatus(deliveryStatus);
  const lastDeliveredAt = configQuery.data?.deliveredAt ?? rawConfig?.deliveredAt;
  const orcaConnectionStatusTone = resolveStatusTone(orcaConnectionTestResult, orcaConnectionTestMutation.isPending);
  const orcaConnectionStatusLabel = resolveStatusLabel(orcaConnectionTestResult, orcaConnectionTestMutation.isPending);
  const traceId = queueQuery.data?.traceId ?? orcaConnectionTestResult?.traceId;

  const queueSummary = useMemo(() => {
    let pending = 0;
    let failed = 0;
    let delivered = 0;
    let delayed = 0;
    const now = Date.now();
    for (const entry of queueEntries) {
      if (entry.status === 'pending') pending += 1;
      if (entry.status === 'failed') failed += 1;
      if (entry.status === 'delivered') delivered += 1;
      if (entry.status === 'pending' && entry.lastDispatchAt) {
        const delta = now - new Date(entry.lastDispatchAt).getTime();
        if (delta > ORCA_QUEUE_STALL_THRESHOLD_MS) delayed += 1;
      }
    }
    return { pending, failed, delivered, delayed };
  }, [queueEntries]);

  const webOrcaConnectionLabel = orcaConnectionTestResult
    ? orcaConnectionTestResult.ok
      ? '接続OK'
      : '接続NG'
    : orcaConnectionAccessVerified
      ? '認証済み（未テスト）'
      : orcaConnectionAuthBlocked
        ? '認証要確認'
        : '未確認';

  const abnormalSummary = (() => {
    const fragments: string[] = [];
    const checks = operationsReadinessQuery.data?.checks ?? {};
    if (checks.database?.status && checks.database.status !== 'UP') fragments.push(`database=${checks.database.status}`);
    if (checks.orca?.status && checks.orca.status !== 'UP') fragments.push(`orca=${checks.orca.status}`);
    if (checks.attachmentStorage?.status && checks.attachmentStorage.status !== 'UP') {
      fragments.push(`attachmentStorage=${checks.attachmentStorage.status}`);
    }
    if (checks.pvtQueue?.status && checks.pvtQueue.status !== 'UP') fragments.push(`pvtQueue=${checks.pvtQueue.status}`);
    if (queueSummary.failed > 0) fragments.push(`queue failed ${queueSummary.failed}件`);
    return fragments.length > 0 ? fragments.join(' / ') : '異常なし';
  })();

  const sectionLead =
    activeTab === 'delivery'
      ? '配信設定・接続テスト・監視導線を分離し、誤操作を防止します。'
      : activeTab === 'master-updates'
        ? 'ORCA と外部マスタの更新導線を管理し、更新状態を安全に確認します。'
        : 'ORCA職員マスタ連携と、連携済みユーザーへの電子カルテ権限付与を管理します。';

  const sectionMetricsHeading =
    activeTab === 'delivery' ? '運用KPI' : activeTab === 'master-updates' ? '更新サマリ' : '権限サマリ';

  const sectionMetrics =
    activeTab === 'delivery'
      ? [
          `配信状態: ${deliverySummary.summary}`,
          `最終配信: ${formatTimestampWithAgo(lastDeliveredAt)}`,
          `WebORCA: ${webOrcaConnectionLabel}`,
          `queue警告: pending ${queueSummary.pending} / failed ${queueSummary.failed} / 遅延 ${queueSummary.delayed}`,
          `運用状態: ${abnormalSummary}`,
          `環境: ${environmentLabel}`,
          '単一路線: config only',
        ]
      : activeTab === 'master-updates'
        ? [`環境: ${environmentLabel}`, `RUN_ID: ${resolvedRunId ?? '―'}`, '配信設定の正本: /api/admin/config']
        : [
            `権限: ${formatRoleLabel(role)}`,
            `施設ID: ${session.facilityId}`,
            `環境: ${environmentLabel}`,
            '認可の正本: route-level',
          ];
  const isDeliveryTab = activeTab === 'delivery';

  return (
    <>
      <a className="skip-link" href="#administration-main">
        本文へスキップ
      </a>
      <main
        className="administration-page"
        data-test-id="administration-page"
        data-run-id={resolvedRunId}
        id="administration-main"
        tabIndex={-1}
      >
        <div className="administration-page__header">
          <div className="administration-page__masthead">
            <div className="administration-page__masthead-copy">
              <p className="administration-page__eyebrow">Clinical operations console</p>
              <h1>管理画面</h1>
              <p className="administration-page__lead" role="status" aria-live={infoLive}>
                {sectionLead}
              </p>
            </div>

            <section className="administration-page__summary-rail" aria-label="運用サマリー">
              <div className="admin-header-blocks">
                <section className="admin-header-block">
                  <h2>{sectionMetricsHeading}</h2>
                  <div className="administration-page__meta" aria-live={infoLive}>
                    {sectionMetrics.map((metric) => (
                      <span key={metric} className="administration-page__pill">
                        {metric}
                      </span>
                    ))}
                  </div>
                </section>

                <section className="admin-header-block">
                  <h2>識別子</h2>
                  <div className="administration-page__meta">
                    <RunIdBadge runId={resolvedRunId} />
                    <AuditSummaryInline
                      auditEvent={latestAuditEvent}
                      className="administration-page__pill"
                      variant="inline"
                      runId={resolvedRunId}
                    />
                    <span className="administration-page__pill">
                      施設ID: {session.facilityId}
                      <button
                        type="button"
                        className="admin-pill-copy"
                        onClick={() => handleCopyValue(session.facilityId, '施設ID')}
                      >
                        コピー
                      </button>
                    </span>
                    <span className="administration-page__pill">権限: {formatRoleLabel(role)}</span>
                    <span className="administration-page__pill">
                      traceId: {traceId ?? '―'}
                      {traceId ? (
                        <button type="button" className="admin-pill-copy" onClick={() => handleCopyValue(traceId, 'traceId')}>
                          コピー
                        </button>
                      ) : null}
                    </span>
                  </div>
                </section>
              </div>
            </section>
          </div>

          <nav className="administration-tabs" aria-label="管理画面の主要ナビゲーション">
            <button
              type="button"
              aria-current={activeTab === 'delivery' ? 'page' : undefined}
              className={`administration-tab${activeTab === 'delivery' ? ' is-active' : ''}`}
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.delete('tab');
                params.set('section', resolveDeliverySectionFromSearch(searchParams));
                setSearchParams(normalizeAdministrationSearchParams(params), { replace: false });
              }}
            >
              配信・運用
            </button>
            <button
              type="button"
              aria-current={activeTab === 'orca-users' ? 'page' : undefined}
              className={`administration-tab${activeTab === 'orca-users' ? ' is-active' : ''}`}
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.set('tab', 'orca-users');
                params.delete('section');
                setSearchParams(normalizeAdministrationSearchParams(params), { replace: false });
              }}
            >
              ORCAユーザー連携・権限
            </button>
            <button
              type="button"
              aria-current={activeTab === 'master-updates' ? 'page' : undefined}
              className={`administration-tab${activeTab === 'master-updates' ? ' is-active' : ''}`}
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.set('tab', 'master-updates');
                params.delete('section');
                setSearchParams(normalizeAdministrationSearchParams(params), { replace: false });
              }}
            >
              マスタ更新
            </button>
          </nav>
        </div>

        <div className={`administration-page__workspace${isDeliveryTab ? ' administration-page__workspace--delivery' : ''}`}>
          {isDeliveryTab ? (
            <aside className="administration-page__rail" aria-label="配信・運用の操作レール">
              <section className="administration-page__rail-card">
                <p className="administration-page__eyebrow">Ops rail</p>
                <h2>配信・運用</h2>
                <p className="admin-quiet">設定 / 状態確認 / 調査をこのレールで切り替えます。</p>
              </section>
              <DeliverySubNav
                activeSection={activeDeliverySection}
                onChange={(next) => {
                  const params = new URLSearchParams(searchParams);
                  params.delete('tab');
                  params.set('section', next);
                  setSearchParams(normalizeAdministrationSearchParams(params), { replace: false });
                }}
              />
            </aside>
          ) : null}

          <section className="administration-page__pane">
            {feedback ? <AdminAlert tone={feedback.tone} message={feedback.message} className="administration-page__feedback" /> : null}
            {orcaConnectionFeedback && activeTab === 'delivery' && activeDeliverySection === 'connection' ? (
              <AdminAlert
                tone={orcaConnectionFeedback.tone}
                message={orcaConnectionFeedback.message}
                className="administration-page__feedback"
              />
            ) : null}

            {isForbidden && activeTab === 'delivery' ? (
              <ToneBanner
                tone="error"
                message="管理APIへのアクセスが拒否されました。権限を確認し、必要ならシステム管理者へ依頼してください。"
                destination="管理画面"
                runId={resolvedRunId}
                nextAction="権限確認 / サポート依頼"
              />
            ) : null}

            {activeTab === 'orca-users' ? (
              <div className="administration-grid administration-grid--wide">
                <OrcaUserManagementPanel runId={panelRunId} role={role} />
                <AccessManagementPanel runId={panelRunId} role={role} mode="linked-only" />
              </div>
            ) : activeTab === 'master-updates' ? (
              <div className="administration-grid administration-grid--wide">
                <MasterUpdatesPanel runId={panelRunId} role={role} />
              </div>
            ) : (
              <>
                {warningEntries.length > 0 ? (
                  <ToneBanner
                    tone="warning"
                    message={`未配信・失敗バンドルが ${warningEntries.length} 件あります（遅延判定:${warningThresholdMinutes}分）。再送または破棄を実施してください。`}
                    destination="ORCA queue"
                    runId={resolvedRunId}
                    nextAction="再送/破棄・再取得"
                  />
                ) : null}

                {activeDeliverySection === 'dashboard' ? (
                  <DeliveryDashboard
                    deliverySummary={deliverySummary.summary}
                    deliveryMode={deliveryMode}
                    lastDeliveredAt={formatTimestampWithAgo(lastDeliveredAt)}
                    webOrcaConnection={webOrcaConnectionLabel}
                    queueSummary={queueSummary}
                    environmentLabel={environmentLabel}
                    warningThresholdMinutes={warningThresholdMinutes}
                    onNavigate={(next) => {
                      const params = new URLSearchParams(searchParams);
                      params.delete('tab');
                      params.set('section', next);
                      setSearchParams(normalizeAdministrationSearchParams(params), { replace: false });
                    }}
                  />
                ) : null}

                {activeDeliverySection === 'connection' ? (
                  <WebOrcaConnectionCard
                    form={orcaConnectionForm}
                    fieldErrors={orcaConnectionFieldErrors}
                    isSystemAdmin={isSystemAdmin}
                    accessVerified={orcaConnectionAccessVerified}
                    authBlocked={orcaConnectionAuthBlocked}
                    dirty={orcaConnectionDirty}
                    statusTone={orcaConnectionStatusTone}
                    statusLabel={orcaConnectionStatusLabel}
                    testSummary={orcaConnectionTestResult}
                    savePending={orcaConnectionSaveMutation.isPending}
                    testPending={orcaConnectionTestMutation.isPending}
                    refetchPending={orcaConnectionQuery.isFetching}
                    onPatch={patchOrcaConnectionForm}
                    onToggleWeborca={handleOrcaConnectionWeborcaToggle}
                    onSave={handleOrcaConnectionSave}
                    onTest={handleOrcaConnectionTest}
                    onRefetch={() => orcaConnectionQuery.refetch()}
                    onCopyRequestTemplate={handleCopyRequestTemplate}
                    requestTemplate={requestTemplate}
                    guardDetailsId={guardDetailsId}
                  />
                ) : null}

                {activeDeliverySection === 'config' ? (
                  <div className="administration-grid">
                    <AdminDeliveryConfigCard
                      form={form}
                      isSystemAdmin={isSystemAdmin}
                      showAdminDebugToggles={showAdminDebugToggles}
                      dirty={configDirty}
                      updatedAt={configQuery.data?.deliveredAt ?? rawConfig?.deliveredAt}
                      note={configQuery.data?.note}
                      guardDetailsId={guardDetailsId}
                      saving={configMutation.isPending}
                      refetching={configQuery.isFetching}
                      onFieldChange={handleInputChange}
                      onChartsMasterSourceChange={handleChartsMasterSourceChange}
                      onSaveRequest={handleSave}
                      onRefetch={() => configQuery.refetch()}
                    />
                    <AdminDeliveryStatusCard
                      deliveryId={configQuery.data?.deliveryId}
                      deliveryVersion={configQuery.data?.deliveryVersion}
                      deliveryEtag={effectiveDeliveryEtag}
                      deliveredAt={configQuery.data?.deliveredAt ?? rawConfig?.deliveredAt}
                      environmentLabel={environmentLabel}
                      deliveryMode={deliveryMode}
                      verified={configQuery.data?.verified}
                      onCopy={handleCopyValue}
                    />
                  </div>
                ) : null}

                {activeDeliverySection === 'queue' ? (
                  <OrcaQueueCard
                    entries={queueEntries}
                    isSystemAdmin={isSystemAdmin}
                    guardDetailsId={guardDetailsId}
                    pending={queueMutation.isPending}
                    warningThresholdMs={ORCA_QUEUE_STALL_THRESHOLD_MS}
                    onRetry={handleRetry}
                    onDiscardRequest={handleDiscardRequest}
                  />
                ) : null}

                {activeDeliverySection === 'operations' ? (
                  <OperationsHealthCard
                    healthResult={operationsHealthQuery.data ?? null}
                    readinessResult={operationsReadinessQuery.data ?? null}
                    pvtWorkerResult={pvtWorkerHealthQuery.data ?? null}
                    healthPending={operationsHealthQuery.isFetching}
                    readinessPending={operationsReadinessQuery.isFetching}
                    pvtWorkerPending={pvtWorkerHealthQuery.isFetching}
                    orcaConnectionStatusTone={orcaConnectionStatusTone}
                    orcaConnectionStatusLabel={orcaConnectionStatusLabel}
                    orcaConnectionResult={orcaConnectionTestResult}
                    onRefresh={handleOperationsRefresh}
                    refreshPending={
                      operationsHealthQuery.isFetching || operationsReadinessQuery.isFetching || pvtWorkerHealthQuery.isFetching
                    }
                  />
                ) : null}

                {activeDeliverySection === 'debug' ? (
                  <>
                    <section className="administration-card" aria-label="診断一括疎通">
                      <h2 className="administration-card__title">診断/デバッグ</h2>
                      <p className="admin-note">このセクションは運用設定から隔離されています。診断用途のみで使用してください。</p>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="admin-button admin-button--secondary"
                          onClick={handleRunConnectivityGroup}
                          disabled={!isSystemAdmin}
                        >
                          一括疎通（グループ）
                        </button>
                      </div>
                      {connectivitySummary ? (
                        <div className="admin-result admin-result--stack">
                          <div>testedAt: {formatTimestamp(connectivitySummary.testedAt)}</div>
                          <div>
                            success: {connectivitySummary.success} / failure: {connectivitySummary.failure}
                          </div>
                          <ul className="placeholder-page__list">
                            {connectivitySummary.details.map((detail) => (
                              <li key={detail}>{detail}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </section>
                    <div className="administration-grid administration-grid--wide">
                      <OrcaInternalWrapperCard
                        isSystemAdmin={isSystemAdmin}
                        guardDetailsId={guardDetailsId}
                        options={internalWrapperOptions}
                        target={orcaInternalWrapperTarget}
                        currentOption={internalWrapperOption}
                        currentState={currentInternalWrapper}
                        result={internalWrapperResult}
                        statusTone={internalWrapperStatusTone}
                        statusLabel={internalWrapperStatusLabel}
                        pending={internalWrapperMutation.isPending}
                        onTargetChange={setOrcaInternalWrapperTarget}
                        onPayloadChange={handleInternalWrapperPayloadChange}
                        onSubmit={handleInternalWrapperSubmit}
                        onReset={handleInternalWrapperReset}
                      />
                    </div>
                  </>
                ) : null}
              </>
            )}
          </section>
        </div>
      </main>

      <ConfirmDialog
        open={saveConfirmOpen}
        title="設定を保存して配信しますか？"
        description="差分内容と影響範囲を確認してください。"
        confirmLabel="保存して配信"
        tone="danger"
        pending={configMutation.isPending}
        onConfirm={handleConfirmSave}
        onCancel={() => setSaveConfirmOpen(false)}
      >
        <div className="admin-result admin-result--stack">
          <div>対象環境: {environmentLabel}</div>
          <div>施設ID: {session.facilityId}</div>
          <div>RUN_ID: {resolvedRunId ?? '―'}</div>
        </div>
        <table className="admin-table admin-table--compact">
          <thead>
            <tr>
              <th>項目</th>
              <th>変更前</th>
              <th>変更後</th>
            </tr>
          </thead>
          <tbody>
            {configDiffRows.length ? (
              configDiffRows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>{String(row.before ?? '―')}</td>
                  <td>{String(row.after ?? '―')}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>差分はありません。</td>
              </tr>
            )}
          </tbody>
        </table>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(discardConfirmTarget)}
        title="キュー破棄を実行しますか？"
        description="破棄後は再送できない可能性があります。"
        confirmLabel="破棄する"
        tone="danger"
        pending={queueMutation.isPending}
        onConfirm={handleConfirmDiscard}
        onCancel={() => setDiscardConfirmTarget(null)}
      >
        <div className="admin-result admin-result--stack">
          <div>patientId: {discardConfirmTarget?.patientId ?? '―'}</div>
          <div>status: {discardConfirmTarget?.status ?? '―'}</div>
          <div>影響: このエントリは再送不可となる場合があります。</div>
        </div>
      </ConfirmDialog>
    </>
  );
}
