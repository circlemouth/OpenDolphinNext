import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ReceptionPage } from '../pages/ReceptionPage';
import { buildDepartmentOptions } from '../departmentOptions';
import type { AppointmentPayload, ClaimOutpatientPayload, ReceptionEntry } from '../../outpatient/types';
import { buildMedicalModV2RequestXml, postOrcaMedicalModV2Xml } from '../../charts/orcaClaimApi';

const createBaseClaimData = (): ClaimOutpatientPayload => ({
  runId: 'RUN-CLAIM',
  missingMaster: false,
  cacheHit: false,
  fallbackUsed: false,
  dataSourceTransition: 'server',
  fetchedAt: '2026-01-29T00:00:00Z',
  bundles: [],
  queueEntries: [],
});

const createBaseAppointmentData = (): AppointmentPayload => ({
  runId: 'RUN-APPOINT',
  missingMaster: false,
  cacheHit: false,
  fallbackUsed: false,
  dataSourceTransition: 'server',
  fetchedAt: '2026-01-29T00:00:00Z',
  entries: [] as ReceptionEntry[],
  recordsReturned: 0,
  raw: {},
});

let mockClaimData = createBaseClaimData();
let mockAppointmentData = createBaseAppointmentData();
let mockMutationResult: any = null;
let mockMutationQueue: any[] = [];
let mockMutationCalls: unknown[] = [];
let mockMutationPending = false;
let mockClaimSendCache: Record<
  string,
  {
    patientId?: string;
    appointmentId?: string;
    receptionId?: string;
    scheduleKey?: string;
    encounterKey?: string;
    invoiceNumber?: string;
    dataId?: string;
    sendStatus?: 'success' | 'error';
    correctionKind?: 'confirm' | 'rebill';
    correctionReason?: string;
  }
> = {};
let mockMedicalInformationOptions = [{ code: '01', name: '外来' }];
let mockReceptionSelectorOptions = {
  departments: [] as Array<{ code: string; name: string }>,
  physicians: [] as Array<{ code: string; name: string }>,
};
let mockBillingOrcaReviewData:
  | {
      ok: boolean;
      entries: Array<{
        transmissionId?: number;
        snapshotId?: number;
        encounterKey?: string;
        scheduleKey?: string;
        patientId?: string;
        state?: string;
        operationStatus?: string;
        needsUserReview?: boolean;
        confirmationRequired?: boolean;
        medicalUidPresent?: boolean;
        apiResult?: string;
        apiResultMessage?: string;
        startedAt?: string;
      }>;
      count: number;
      limit: number;
      runId?: string;
    }
  | undefined;
let mockMedicalRecordsData:
  | {
      runId?: string;
      records?: Array<{
        documentId?: string;
        performDate?: string;
        departmentCode?: string;
        departmentName?: string;
        sequentialNumber?: string;
        documentStatus?: string;
      }>;
    }
  | undefined;
let mockSearchParams = new URLSearchParams();
let mockLocationState: Record<string, unknown> | undefined;
let mockSessionRole = 'staff';
const mockInvalidateQueries = vi.fn(async () => undefined);
const mockEnqueue = vi.fn();
const mockOpenCharts = vi.fn();
const mockVerifyOfficialPatientExactExistence = vi.hoisted(() =>
  vi.fn(async ({ patientId }: { patientId: string }) => ({
    ok: patientId !== 'LOCAL-001',
    patientId,
    status: 200,
    apiResult: patientId !== 'LOCAL-001' ? '00' : '10',
    exactMatchedPatientIds: patientId !== 'LOCAL-001' ? [patientId] : [],
    missingPatientIds: patientId !== 'LOCAL-001' ? [] : [patientId],
  })),
);
const mockRefetchOfficialCanonicalPatients = vi.hoisted(() =>
  vi.fn(async ({ patientIds }: { patientIds: string[] }) => ({
    ok: true,
    patients: [] as Array<{ patientId?: string; name?: string; kana?: string; birthDate?: string; sex?: string }>,
    status: 200,
    apiResult: '00',
    apiResultMessage: '',
    matchedPatientIds: patientIds,
    missingPatientIds: [],
  })),
);

const mockAuthFlags = {
  runId: 'RUN-AUTH',
  missingMaster: false,
  cacheHit: false,
  dataSourceTransition: 'server' as const,
  fallbackUsed: false,
};

const mockAuthActions = {
  setCacheHit: vi.fn(),
  setMissingMaster: vi.fn(),
  setDataSourceTransition: vi.fn(),
  setFallbackUsed: vi.fn(),
  bumpRunId: vi.fn(),
};

vi.mock('@emotion/react', () => ({
  Global: () => null,
  css: () => '',
}));

vi.mock('../../charts/authService', () => ({
  applyAuthServicePatch: (patch: any, previous: any) => ({ ...previous, ...patch }),
  useAuthService: () => ({
    flags: mockAuthFlags,
    ...mockAuthActions,
  }),
}));

vi.mock('../../../routes/useAppNavigation', () => ({
  useAppNavigation: () => ({
    currentUrl: '/f/FAC-TEST/reception',
    currentScreen: 'reception',
    fromCandidate: null,
    returnToCandidate: null,
    safeReturnToCandidate: null,
    locationState: mockLocationState,
    carryover: {},
    external: {},
    encounter: {},
    openReception: vi.fn(),
    openPatients: vi.fn(),
    openCharts: mockOpenCharts,
    openOrderSets: vi.fn(),
    openPrintOutpatient: vi.fn(),
    openPrintDocument: vi.fn(),
    openMobileImages: vi.fn(),
  }),
}));

vi.mock('../../shared/ReturnToBar', () => ({
  ReturnToBar: () => null,
}));

vi.mock('../../shared/AdminBroadcastBanner', () => ({
  AdminBroadcastBanner: () => <div data-testid="admin-broadcast" />,
}));

vi.mock('../components/OrderConsole', () => ({
  OrderConsole: () => (
    <section role="region" aria-label="オーダー概要" data-testid="order-console">
      <div>請求状態</div>
      <div>会計待ち</div>
      <div>合計金額/診療時間</div>
      <div>送信キャッシュ</div>
      <div>ORCAキュー</div>
      <button type="button">Charts 新規タブ</button>
    </section>
  ),
}));

vi.mock('../components/ReceptionAuditPanel', () => ({
  ReceptionAuditPanel: () => <div data-testid="reception-audit" />,
}));

vi.mock('../components/ReceptionExceptionList', () => ({
  ReceptionExceptionList: () => <div data-testid="reception-exceptions" />,
}));

vi.mock('../../shared/autoRefreshNotice', () => ({
  OUTPATIENT_AUTO_REFRESH_INTERVAL_MS: 90_000,
  resolveAutoRefreshIntervalMs: (value: number) => value,
  useAutoRefreshNotice: () => null,
}));

vi.mock('../../../libs/admin/useAdminBroadcast', () => ({
  useAdminBroadcast: () => ({ broadcast: null }),
}));

vi.mock('../../../libs/ui/appToast', () => ({
  useAppToast: () => ({ enqueue: mockEnqueue, dismiss: vi.fn() }),
}));

vi.mock('../../../AppRouter', () => ({
  useSession: () => ({ facilityId: 'FAC-TEST', userId: 'user01', role: mockSessionRole }),
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  getAuditEventLog: () => [],
  logAuditEvent: () => ({ timestamp: new Date().toISOString() }),
  logUiState: () => ({ timestamp: new Date().toISOString() }),
}));

vi.mock('../../patients/api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    refetchOfficialCanonicalPatients: mockRefetchOfficialCanonicalPatients,
    verifyOfficialPatientExactExistence: mockVerifyOfficialPatientExactExistence,
  };
});

vi.mock('../../outpatient/savedViews', () => ({
  loadOutpatientSavedViews: () => [],
  removeOutpatientSavedView: () => [],
  upsertOutpatientSavedView: () => [],
  resolvePaymentMode: (insurance?: string) => {
    if (!insurance) return undefined;
    const normalized = insurance.toLowerCase();
    if (normalized.includes('自費') || normalized.includes('self')) return 'self';
    return 'insurance';
  },
}));

vi.mock('../../charts/orcaClaimSendCache', () => ({
  loadOrcaClaimSendCache: () => mockClaimSendCache,
  findOrcaClaimSendEntryForMatch: (
    store: typeof mockClaimSendCache,
    entry: { patientId?: string; appointmentId?: string; receptionId?: string; scheduleKey?: string; encounterKey?: string },
    options?: { allowPatientFallback?: boolean },
  ) => {
    const values = Object.values(store ?? {});
    const direct =
      values.find((candidate) => candidate.encounterKey && candidate.encounterKey === entry.encounterKey) ??
      values.find((candidate) => candidate.scheduleKey && candidate.scheduleKey === entry.scheduleKey) ??
      values.find((candidate) => candidate.receptionId && candidate.receptionId === entry.receptionId) ??
      values.find((candidate) => candidate.appointmentId && candidate.appointmentId === entry.appointmentId);
    if (direct) return direct;
    if (!options?.allowPatientFallback || !entry.patientId) return null;
    const patientMatches = values.filter((candidate) => candidate.patientId === entry.patientId);
    return patientMatches.length === 1 ? patientMatches[0] ?? null : null;
  },
  saveOrcaClaimSendCache: (entry: {
    patientId: string;
    appointmentId?: string;
    receptionId?: string;
    scheduleKey?: string;
    encounterKey?: string;
  }) => {
    const key =
      entry.encounterKey
        ? `encounter:${entry.encounterKey}`
        : entry.scheduleKey
          ? `schedule:${entry.scheduleKey}`
          : entry.receptionId
            ? `reception:${entry.receptionId}`
            : entry.appointmentId
              ? `appointment:${entry.appointmentId}`
              : `patient:${entry.patientId}`;
    mockClaimSendCache = { ...mockClaimSendCache, [key]: entry as any };
    window.dispatchEvent(new CustomEvent('orca-claim-send-cache-update', { detail: { patientId: entry.patientId, cacheKey: key } }));
  },
}));

vi.mock('../../charts/orcaClaimApi', () => ({
  buildMedicalModV2RequestXml: vi.fn((payload: unknown) => payload),
  postOrcaMedicalModV2Xml: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    rawXml: '<xml></xml>',
    apiResult: '00',
    apiResultMessage: 'OK',
    invoiceNumber: 'INV-001',
    dataId: 'DATA-001',
    missingTags: [],
    runId: 'RUN-ORCA',
    traceId: 'TRACE-ORCA',
  }),
}));

vi.mock('../../charts/orderBundleApi', () => ({
  fetchOrderBundles: vi.fn(async () => ({ ok: true, bundles: [], recordsReturned: 0 })),
}));

vi.mock('../../charts/orderRpNormalization', () => ({
  buildMedicalModV2BlockNotice: vi.fn().mockReturnValue(null),
  fetchMedicalModV2OrderBundles: vi.fn().mockResolvedValue({ bundles: [], errors: [] }),
  prepareMedicalModV2SendData: vi.fn().mockReturnValue({
    requiredIssues: [],
    bundleIssues: [],
    codeIssues: [],
    medicalInformationWithSource: [],
    medicalInformationSources: [],
    medicalInformation: [],
    totalGroups: 0,
    groupLimitExceeded: false,
    rowLimitExceeded: false,
    limitReasons: [],
    invalidCodes: [],
  }),
}));

vi.mock('../exceptionLogic', () => ({
  buildExceptionAuditDetails: () => ({}),
  buildQueuePhaseSummary: () => ({
    shouldWarn: false,
    summary: 'ok',
  }),
  resolveExceptionDecision: () => ({
    kind: undefined,
    detail: '',
    nextAction: '—',
    reasons: {},
  }),
}));

vi.mock('../../outpatient/orcaQueueStatus', () => ({
  ORCA_QUEUE_STALL_THRESHOLD_MS: 120_000,
  resolveOrcaSendStatus: () => ({
    key: 'waiting',
    label: '待ち',
    tone: 'warning',
    isStalled: false,
  }),
}));

vi.mock('../../outpatient/appointmentDataBanner', () => ({
  getAppointmentDataBanner: () => null,
  countAppointmentDataIntegrity: () => ({
    missingPatientId: 0,
    missingAppointmentId: 0,
    missingReceptionId: 0,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: unknown[] }) => {
    const key = options.queryKey[0];
    if (key === 'outpatient-claim-flags') {
      return {
        data: mockClaimData,
        dataUpdatedAt: 0,
        isError: false,
        error: null,
        isFetching: false,
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    if (key === 'outpatient-appointments') {
      return {
        data: mockAppointmentData,
        dataUpdatedAt: 0,
        isError: false,
        error: null,
        isFetching: false,
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    if (key === 'orca-medical-information-options') {
      return {
        data: mockMedicalInformationOptions,
        dataUpdatedAt: 0,
        isError: false,
        error: null,
        isFetching: false,
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    if (key === 'orca-reception-selector-options') {
      return {
        data: mockReceptionSelectorOptions,
        dataUpdatedAt: 0,
        isError: false,
        error: null,
        isFetching: false,
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    if (key === 'orca-medical-records') {
      return {
        data: mockMedicalRecordsData,
        dataUpdatedAt: 0,
        isError: false,
        error: null,
        isFetching: false,
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    if (key === 'billing-orca-transmission-review') {
      return {
        data: mockBillingOrcaReviewData,
        dataUpdatedAt: 0,
        isError: false,
        error: null,
        isFetching: false,
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    return {
      data: undefined,
      dataUpdatedAt: 0,
      isError: false,
      error: null,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    };
  },
  useMutation: (options?: {
    onSuccess?: (data: any, variables: any, context: unknown) => void;
    onError?: (error: unknown, variables: any, context: unknown) => void;
  }) => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(async (variables?: unknown) => {
      mockMutationCalls.push(variables);
      const nextResult = mockMutationQueue.length > 0 ? mockMutationQueue.shift() : (mockMutationResult ?? {});
      if (nextResult instanceof Error) {
        options?.onError?.(nextResult, variables, undefined);
        throw nextResult;
      }
      options?.onSuccess?.(nextResult, variables, undefined);
      return nextResult;
    }),
    isPending: mockMutationPending,
  }),
  useQueryClient: () => ({
    getQueryState: () => ({ dataUpdatedAt: 0, fetchFailureCount: 0 }),
    setQueryData: vi.fn((_: unknown, updater: any) => {
      if (typeof updater === 'function') {
        const next = updater(mockAppointmentData);
        if (next) mockAppointmentData = next;
        return next;
      }
      mockAppointmentData = updater;
      return updater;
    }),
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock('react-router-dom', () => ({
  MemoryRouter: ({ children }: { children: React.ReactNode }) => children,
  useNavigate: () => vi.fn(),
  useSearchParams: () => [mockSearchParams, vi.fn()],
}));

const renderReceptionPage = () => {
  render(
    <MemoryRouter initialEntries={['/reception']}>
      <ReceptionPage runId="RUN-INIT" />
    </MemoryRouter>,
  );
  screen.getByRole('heading', { name: '診察待ち' });
};

const createBillingEntry = (overrides: Partial<ReceptionEntry> = {}): ReceptionEntry => ({
  id: 'row-claim',
  patientId: 'P-501',
  receptionId: 'R-501',
  visitDate: '2026-01-29',
  departmentCode: '01',
  physicianCode: '10001',
  insuranceCombinationNumber: '0001',
  voucherNumber: '1234',
  sequentialNumber: '1',
  name: '診察終了患者',
  appointmentTime: '11:00',
  department: '01 内科',
  physician: '10001 主治医',
  status: '会計待ち',
  insurance: '保険',
  source: 'visits',
  ...overrides,
});

describe('buildDepartmentOptions', () => {
  it('appointment raw 由来の code/name から診療科候補を構成する', () => {
    const options = buildDepartmentOptions({
      departmentLabels: new Map([
        ['01', '内科'],
        ['02', '外科'],
      ]),
      visibleEntries: [],
    });

    expect(options).toEqual([
      ['01', '内科'],
      ['02', '外科'],
    ]);
  });

  it('visible entry の canonical departmentCode を使って候補を構成する', () => {
    const options = buildDepartmentOptions({
      departmentLabels: new Map(),
      visibleEntries: [
        { departmentCode: '01', department: '内科' },
        { departmentCode: '02', department: '外科' },
      ],
    });

    expect(options).toEqual([
      ['01', '内科'],
      ['02', '外科'],
    ]);
  });

  it('display string しか無い場合は偽の診療科コードを生成しない', () => {
    const options = buildDepartmentOptions({
      departmentLabels: new Map(),
      visibleEntries: [{ department: '01 内科' }],
    });

    expect(options).toEqual([]);
  });
});

const getToolbar = () => {
  return screen.getByRole('region', { name: '受付ツールバー' });
};

const openAcceptWorkflowModal = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: '患者を受付する' }));
  return (await screen.findByRole('region', { name: '既存患者受付/患者検索' })) as HTMLElement;
};

const getAcceptRegisterPanel = (workflowModal: HTMLElement) =>
  within(workflowModal).getByRole('region', { name: '受付登録モーダル' });

const selectInsurancePayment = async (user: ReturnType<typeof userEvent.setup>, acceptPanel: HTMLElement) => {
  const paymentSelect = acceptPanel.querySelector('#reception-accept-payment-mode') as HTMLSelectElement | null;
  if (!paymentSelect) throw new Error('reception-accept-payment-mode select was not found');
  await user.selectOptions(paymentSelect, 'insurance');
};

const openRowActionMenu = async (user: ReturnType<typeof userEvent.setup>, row: HTMLElement) => {
  const trigger = within(row).getByRole('button', { name: /その他|操作を開く/ });
  await user.click(trigger);
};

const getRowMenuAction = (row: HTMLElement, name: RegExp) => {
  const action = within(row).queryByRole('menuitem', { name }) ?? within(row).queryByRole('button', { name });
  if (!action) {
    throw new Error(`行アクションが見つかりません: ${name.toString()}`);
  }
  return action as HTMLButtonElement;
};

beforeEach(() => {
  mockClaimData = createBaseClaimData();
  mockAppointmentData = createBaseAppointmentData();
  mockMutationResult = null;
  mockMutationQueue = [];
  mockMutationCalls = [];
  mockMutationPending = false;
  mockClaimSendCache = {};
  mockMedicalInformationOptions = [{ code: '01', name: '外来' }];
  mockReceptionSelectorOptions = { departments: [], physicians: [] };
  mockBillingOrcaReviewData = undefined;
  mockMedicalRecordsData = undefined;
  mockSearchParams = new URLSearchParams();
  mockLocationState = undefined;
  mockSessionRole = 'staff';
  mockInvalidateQueries.mockClear();
  mockEnqueue.mockReset();
  mockOpenCharts.mockReset();
  mockRefetchOfficialCanonicalPatients.mockClear();
  mockRefetchOfficialCanonicalPatients.mockImplementation(async ({ patientIds }: { patientIds: string[] }) => ({
    ok: true,
    patients: [],
    status: 200,
    apiResult: '00',
    apiResultMessage: '',
    matchedPatientIds: patientIds,
    missingPatientIds: [],
  }));
  mockVerifyOfficialPatientExactExistence.mockClear();
  mockVerifyOfficialPatientExactExistence.mockImplementation(async ({ patientId }: { patientId: string }) => ({
    ok: patientId !== 'LOCAL-001',
    patientId,
    status: 200,
    apiResult: patientId !== 'LOCAL-001' ? '00' : '10',
    exactMatchedPatientIds: patientId !== 'LOCAL-001' ? [patientId] : [],
    missingPatientIds: patientId !== 'LOCAL-001' ? [] : [patientId],
  }));
  vi.mocked(buildMedicalModV2RequestXml).mockClear();
  vi.mocked(postOrcaMedicalModV2Xml).mockClear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('ReceptionPage accept UX', () => {
  it('shows reception settings only after selecting a patient from search results', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-1',
        patientId: 'P-001',
        receptionId: 'R-001',
        name: '山田太郎',
        appointmentTime: '09:00',
        department: '01 内科',
        status: '受付中',
        insurance: '保険',
        source: 'visits',
      },
      {
        id: 'row-2',
        patientId: 'P-002',
        receptionId: 'R-002',
        name: '佐藤花子',
        appointmentTime: '10:00',
        department: '01 内科',
        status: '受付中',
        insurance: '自費',
        source: 'visits',
      },
    ];
    mockMutationQueue.push({
      patients: [
        { patientId: 'P-001', name: '山田太郎', insurance: '保険' },
        { patientId: 'P-002', name: '佐藤花子', insurance: '自費' },
      ],
      recordsReturned: 2,
      runId: 'RUN-SEARCH-SELECT',
    });

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const form = within(patientSearch);
    const patientInput = form.getByLabelText('患者ID');

    await waitFor(() => {
      expect(patientInput).toHaveValue('P-001');
    });

    await user.click(form.getByRole('button', { name: '検索' }));
    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    const acceptPanel = getAcceptRegisterPanel(workflowModal);
    expect(within(resultPanel).queryByText(/Api_Result_Message:/)).toBeNull();
    expect(within(workflowModal).queryByTestId('reception-accept-register')).toBeNull();
    expect(within(acceptPanel).getByText(/左の患者検索結果カードを選択すると/)).toBeInTheDocument();

    await user.click(within(resultPanel).getAllByRole('listitem')[0]);
    expect(within(acceptPanel).queryByText('選択患者: 山田太郎')).toBeNull();
    expect(within(acceptPanel).getByRole('group', { name: '受付対象 山田太郎' })).toBeInTheDocument();
    expect(within(workflowModal).getByTestId('reception-accept-register')).toBeInTheDocument();
    const paymentSelect = within(acceptPanel).getByLabelText(/保険\/自費/);
    expect(paymentSelect).toHaveValue('insurance');

    const row2 = screen.getByRole('row', { name: /佐藤花子/ });
    await user.click(row2);

    expect(within(acceptPanel).queryByText('選択患者: 山田太郎')).toBeNull();
    expect(within(acceptPanel).getByRole('group', { name: '受付対象 山田太郎' })).toBeInTheDocument();
  });

  it('enables 受付する when required fields are auto-filled', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-1',
        patientId: 'P-010',
        appointmentId: 'A-010',
        departmentCode: '01',
        physicianCode: '10001',
        name: '田中一郎',
        appointmentTime: '09:00',
        department: '01 内科',
        physician: '10001 担当医A',
        status: '予約',
        insurance: '保険',
        source: 'reservations',
      },
    ];
    mockMutationQueue.push({
      patients: [
        {
          patientId: 'P-010',
          name: '田中一郎',
          insurance: '保険',
        },
      ],
      recordsReturned: 1,
      runId: 'RUN-SEARCH-REQUIRED',
    });

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const form = within(patientSearch);
    const patientInput = form.getByLabelText('患者ID');

    await waitFor(() => expect(patientInput).toHaveValue('P-010'));
    await user.click(form.getByRole('button', { name: '検索' }));
    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    const acceptPanel = getAcceptRegisterPanel(workflowModal);

    await user.click(within(resultPanel).getAllByRole('listitem')[0]);
    const departmentSelect = within(acceptPanel).getByLabelText(/診療科/) as HTMLSelectElement;
    const physicianSelect = within(acceptPanel).getByLabelText(/担当医/) as HTMLSelectElement;
    const registerButton = within(workflowModal).getByTestId('reception-accept-register');
    await waitFor(() => expect(within(acceptPanel).getByLabelText(/保険\/自費/)).toHaveValue('insurance'));
    expect(departmentSelect).toHaveValue('01');
    expect(physicianSelect).toHaveValue('10001');

    const paymentSelect = within(acceptPanel).getByLabelText(/保険\/自費/);
    expect(paymentSelect).toHaveValue('insurance');
    await user.selectOptions(departmentSelect, departmentSelect.options[0]?.value ?? '01');
    await user.selectOptions(physicianSelect, physicianSelect.options[1]?.value ?? '10001');
    await waitFor(() => expect(registerButton).toBeEnabled());
    expect(mockVerifyOfficialPatientExactExistence).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'P-010' }));
  });

  it('does not enable ORCA受付 for a local-only patient search result', async () => {
    mockReceptionSelectorOptions = {
      departments: [{ code: '01', name: '内科' }],
      physicians: [{ code: '10001', name: '担当医A' }],
    };
    mockMutationQueue.push({
      patients: [
        {
          patientId: 'LOCAL-001',
          name: 'ローカル患者',
          insurance: '保険',
        },
      ],
      recordsReturned: 1,
      runId: 'RUN-LOCAL-ONLY',
    });

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const form = within(patientSearch);
    const patientInput = form.getByLabelText('患者ID');
    await user.clear(patientInput);
    await user.type(patientInput, 'LOCAL-001');
    await user.click(form.getByRole('button', { name: '検索' }));

    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await user.click(within(resultPanel).getAllByRole('listitem')[0]);

    const acceptPanel = getAcceptRegisterPanel(workflowModal);
    await user.selectOptions(within(acceptPanel).getByLabelText(/診療科/), '01');
    await user.selectOptions(within(acceptPanel).getByLabelText(/担当医/), '10001');
    await user.selectOptions(within(acceptPanel).getByLabelText(/来院区分/), '1');

    await waitFor(() => {
      expect(within(workflowModal).getByTestId('reception-accept-register')).toBeDisabled();
      expect(within(acceptPanel).getByText(/ORCA 受付対象として未確認\/未登録です/)).toBeInTheDocument();
    });
    expect(mockVerifyOfficialPatientExactExistence).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'LOCAL-001' }));
    expect(mockMutationCalls).toHaveLength(1);
  });

  it('clears stale name/kana filters when reopening the accept workflow', async () => {
    const user = userEvent.setup();
    renderReceptionPage();

    let workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    await user.type(within(patientSearch).getByLabelText('氏名（姓）'), '山田');
    await user.type(within(patientSearch).getByLabelText('氏名（名）'), '太郎');
    await user.type(within(patientSearch).getByLabelText('カナ（セイ）'), 'ヤマダ');
    await user.type(within(patientSearch).getByLabelText('カナ（メイ）'), 'タロウ');

    await user.click(within(workflowModal).getByRole('button', { name: '閉じる' }));
    workflowModal = await openAcceptWorkflowModal(user);
    const reopenedPatientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });

    expect(within(reopenedPatientSearch).getByLabelText('氏名（姓）')).toHaveValue('');
    expect(within(reopenedPatientSearch).getByLabelText('氏名（名）')).toHaveValue('');
    expect(within(reopenedPatientSearch).getByLabelText('カナ（セイ）')).toHaveValue('');
    expect(within(reopenedPatientSearch).getByLabelText('カナ（メイ）')).toHaveValue('');
  });

  it('keeps 受付する disabled until 保険/自費 and 来院区分 are selected', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-2',
        patientId: 'P-011',
        appointmentId: 'A-011',
        departmentCode: '01',
        physicianCode: '10001',
        name: '必須入力患者',
        appointmentTime: '09:30',
        department: '01 内科',
        physician: '10001 担当医A',
        status: '予約',
        insurance: '保険',
        source: 'reservations',
      },
    ];
    mockMutationQueue.push({
      patients: [
        {
          patientId: 'P-011',
          name: '必須入力患者',
        },
      ],
      recordsReturned: 1,
      runId: 'RUN-SEARCH-REQUIRED-PAYMENT',
    });

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const form = within(patientSearch);
    await waitFor(() => expect(form.getByLabelText('患者ID')).toHaveValue('P-011'));
    await user.click(form.getByRole('button', { name: '検索' }));

    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await user.click(within(resultPanel).getAllByRole('listitem')[0]);
    const acceptPanel = getAcceptRegisterPanel(workflowModal);
    const departmentSelect = within(acceptPanel).getByLabelText(/診療科/) as HTMLSelectElement;
    const physicianSelect = within(acceptPanel).getByLabelText(/担当医/) as HTMLSelectElement;
    const paymentSelect = within(acceptPanel).getByLabelText(/保険\/自費/) as HTMLSelectElement;
    const visitKindSelect = within(acceptPanel).getByLabelText(/来院区分/) as HTMLSelectElement;
    const registerButton = within(workflowModal).getByTestId('reception-accept-register');

    await user.selectOptions(departmentSelect, departmentSelect.options[0]?.value ?? '01');
    await user.selectOptions(physicianSelect, physicianSelect.options[1]?.value ?? '10001');
    await user.selectOptions(visitKindSelect, '');
    expect(registerButton).toBeDisabled();

    await user.selectOptions(paymentSelect, 'insurance');
    expect(registerButton).toBeDisabled();

    await user.selectOptions(visitKindSelect, '1');
    expect(registerButton).toBeEnabled();
  });

  it('enables cancel action in その他 menu only when entry has a receptionId', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-1',
        patientId: 'P-100',
        appointmentId: 'A-100',
        name: '受付IDなし患者',
        appointmentTime: '09:00',
        department: '01 内科',
        status: '受付中',
        insurance: '保険',
        source: 'visits',
      },
      {
        id: 'row-2',
        patientId: 'P-200',
        receptionId: 'R-200',
        name: '取消可能患者',
        appointmentTime: '10:00',
        department: '01 内科',
        status: '受付中',
        insurance: '保険',
        source: 'visits',
      },
    ];

    const user = userEvent.setup();
    renderReceptionPage();

    const row1 = screen.getByRole('row', { name: /受付IDなし患者/ });
    await openRowActionMenu(user, row1);
    expect(getRowMenuAction(row1, /受付取消/)).toBeDisabled();

    const row2 = screen.getByRole('row', { name: /取消可能患者/ });
    await openRowActionMenu(user, row2);
    expect(getRowMenuAction(row2, /受付取消/)).toBeEnabled();
  });

  it('shows only the ORCA patient ID in the normal table ID column', () => {
    mockAppointmentData.entries = [
      {
        id: 'row-visible-id',
        patientId: '00003',
        receptionId: '00001',
        name: 'ID表示患者',
        appointmentTime: '09:00',
        department: '01 内科',
        status: '受付中',
        insurance: '保険',
        source: 'visits',
      },
    ];

    renderReceptionPage();

    expect(screen.getByRole('columnheader', { name: '患者ID' })).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /ID表示患者/ });
    expect(within(row).getByLabelText('00003')).toBeInTheDocument();
    expect(within(row).queryByText('患者ID')).toBeNull();
    expect(within(row).queryByText('受付ID')).toBeNull();
    expect(within(row).queryByText('00001')).toBeNull();
  });

  it('keeps selector department names when raw ORCA visit rows only repeat the department code', () => {
    mockReceptionSelectorOptions = {
      departments: [{ code: '02', name: 'Psychiatry' }],
      physicians: [],
    };
    mockAppointmentData.entries = [
      {
        id: 'row-department-code',
        patientId: '00004',
        receptionId: '00004',
        name: 'Department Code Patient',
        appointmentTime: '14:58',
        department: '02',
        departmentCode: '02',
        status: '受付中',
        insurance: 'insurance',
        source: 'visits',
      },
    ];
    mockAppointmentData.raw = {
      visits: [{ Department_Code: '02' }],
    };

    renderReceptionPage();

    const row = screen.getByRole('row', { name: /Department Code Patient/ });
    expect(within(row).getByText('Psychiatry')).toBeInTheDocument();
    expect(within(row).queryByText('02')).toBeNull();
  });

  it('hydrates reception rows from ORCA canonical patient data after returning from charts', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-hydrate',
        patientId: '00002',
        receptionId: '00002',
        name: 'Seed Patient',
        appointmentTime: '15:35',
        department: '02',
        status: '受付中',
        source: 'visits',
      },
    ];
    mockRefetchOfficialCanonicalPatients.mockResolvedValueOnce({
      ok: true,
      patients: [
        {
          patientId: '00002',
          name: '事例　一',
          kana: 'ジレイ　イチ',
          birthDate: '2015-01-01',
          sex: 'M',
        },
      ],
      status: 200,
      apiResult: '00',
      apiResultMessage: '',
      matchedPatientIds: ['00002'],
      missingPatientIds: [],
    });

    renderReceptionPage();

    const hydratedRow = await screen.findByRole('row', { name: /事例　一/ });
    expect(within(hydratedRow).queryByText('Seed Patient')).toBeNull();
    expect(mockRefetchOfficialCanonicalPatients).toHaveBeenCalledWith({
      patientIds: ['00002'],
      runId: 'RUN-APPOINT',
    });
  });

  it('does not present routine ORCA connectivity as a normal table column', () => {
    mockAppointmentData.entries = [
      {
        id: 'row-no-queue',
        patientId: '00004',
        receptionId: '00002',
        name: 'キュー未対象患者',
        appointmentTime: '09:15',
        department: '01 内科',
        status: '受付中',
        insurance: '保険',
        source: 'visits',
      },
    ];

    renderReceptionPage();

    expect(screen.queryByRole('columnheader', { name: 'ORCA連携' })).toBeNull();
    const row = screen.getByRole('row', { name: /キュー未対象患者/ });
    expect(within(row).queryByLabelText('ORCA連携: 対象なし')).toBeNull();
    expect(within(row).queryByLabelText(/ORCAキュー/)).toBeNull();
    expect(within(row).queryByText('未取得')).toBeNull();
    expect(within(row).getByRole('button', { name: 'カルテを開く' })).toBeInTheDocument();
  });

  it('shows confirmation dialog before cancel execution', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-cancel-1',
        patientId: 'P-210',
        receptionId: 'R-210',
        name: '取消確認患者',
        birthDate: '1970-01-01',
        sex: 'M',
        appointmentTime: '09:40',
        department: '01 内科',
        status: '受付中',
        insurance: '保険',
        source: 'visits',
      },
    ];
    mockMutationQueue.push({
      runId: 'RUN-CANCEL',
      traceId: 'TRACE-CANCEL',
      apiResult: '00',
      apiResultMessage: 'OK',
      requestNumber: '02',
      acceptanceId: 'R-210',
      patient: { patientId: 'P-210' },
    });

    const user = userEvent.setup();
    renderReceptionPage();

    const row = screen.getByRole('row', { name: /取消確認患者/ });
    await openRowActionMenu(user, row);
    await user.click(getRowMenuAction(row, /受付取消/));

    expect(mockMutationQueue).toHaveLength(1);
    const dialog = await screen.findByRole('dialog', { name: '受付取消の確認' });
    expect(within(dialog).getByRole('region', { name: /取消対象 取消確認患者/ })).toBeInTheDocument();
    expect(within(dialog).getByText('取消確認患者')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('取消理由（任意）')).toBeNull();
    expect(within(dialog).queryByText(/患者ID/)).toBeNull();
    expect(within(dialog).queryByText(/受付ID/)).toBeNull();
    expect(within(dialog).queryByText(/性別\/年齢/)).toBeNull();
    expect(within(dialog).queryByText(/氏名:/)).toBeNull();
    expect(within(dialog).queryByText(/患者同定情報と受付情報/)).toBeNull();
    expect(within(dialog).queryByText('PT')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: '取消を実行' }));

    await waitFor(() => {
      expect(mockMutationQueue).toHaveLength(0);
    });
    expect(mockMutationCalls.at(-1)).toMatchObject({
      acceptanceId: 'R-210',
      patientId: 'P-210',
      requestNumber: '02',
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '受付取消の確認' })).toBeNull();
    });
  });

  it('受付成功後は同一患者の予約行を受付中に置換し取消を有効化する', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-accept-reservation',
        patientId: 'P-220',
        appointmentId: 'A-220',
        departmentCode: '01',
        physicianCode: '10001',
        name: '予約登録患者',
        appointmentTime: '09:20',
        department: '01 内科',
        physician: '10001 担当医A',
        status: '予約',
        insurance: '保険',
        source: 'reservations',
      },
    ];
    mockMutationQueue.push(
      {
        patients: [{ patientId: 'P-220', name: '予約登録患者', insurance: '保険' }],
        recordsReturned: 1,
        runId: 'RUN-SEARCH-ACCEPT-REPLACE',
      },
      {
        runId: 'RUN-VISIT-ACCEPT-REPLACE',
        traceId: 'TRACE-VISIT-ACCEPT-REPLACE',
        apiResult: '00',
        apiResultMessage: 'OK',
        requestNumber: '01',
        businessStatus: 'businessAccepted',
        acceptanceId: 'R-220',
        acceptanceDate: '2026-01-29',
        acceptanceTime: '09:21:00',
        departmentCode: '01',
        physicianCode: '10001',
        patient: { patientId: 'P-220', name: '予約登録患者' },
      },
    );

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    await user.click(within(patientSearch).getByRole('button', { name: '検索' }));
    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await user.click(within(resultPanel).getAllByRole('listitem')[0]);

    const acceptPanel = getAcceptRegisterPanel(workflowModal);
    await user.selectOptions(within(acceptPanel).getByLabelText(/診療科/), '01');
    await user.selectOptions(within(acceptPanel).getByLabelText(/担当医/), '10001');
    await selectInsurancePayment(user, acceptPanel);
    await user.click(within(workflowModal).getByTestId('reception-accept-register'));

    const row = await screen.findByRole('row', { name: /予約登録患者/ });
    expect(row).toHaveAttribute('data-reception-status', '受付中');
    await openRowActionMenu(user, row);
    expect(getRowMenuAction(row, /受付取消/)).toBeEnabled();
    expect(mockAppointmentData.entries.filter((entry) => entry.patientId === 'P-220')).toHaveLength(1);
    expect(mockAppointmentData.entries[0]).toMatchObject({
      patientId: 'P-220',
      receptionId: 'R-220',
      status: '受付中',
      source: 'visits',
    });
  });

  it('shows Api_Result and duration in the result area after submit', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-result-1',
        patientId: '555',
        appointmentId: 'A-555',
        departmentCode: '01',
        physicianCode: '10001',
        name: '送信患者',
        appointmentTime: '09:10',
        department: '01 内科',
        physician: '10001 Dr. Test',
        status: '予約',
        insurance: '保険',
        source: 'reservations',
      },
    ];
    mockMutationQueue.push(
      {
        patients: [
          {
            patientId: '555',
            name: '送信患者',
            insurance: '保険',
          },
        ],
        recordsReturned: 1,
        runId: 'RUN-SEARCH-VISIT',
      },
      {
        patients: [
          {
            patientId: '555',
            name: '送信患者',
            insurance: '保険',
          },
        ],
        recordsReturned: 1,
        runId: 'RUN-SEARCH-VISIT',
      },
      {
        runId: 'RUN-VISIT',
        traceId: 'TRACE-VISIT',
        apiResult: '00',
        apiResultMessage: 'OK',
        requestNumber: '01',
        acceptanceId: 'R-555',
        acceptanceDate: '2026-01-29',
        acceptanceTime: '09:10:00',
        patient: {
          patientId: '555',
          name: '送信患者',
        },
      },
    );

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const form = within(patientSearch);

    const patientIdInput = form.getByLabelText('患者ID');
    await user.clear(patientIdInput);
    await user.type(patientIdInput, '555');
    await user.click(form.getByRole('button', { name: '検索' }));
    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await waitFor(() => {
      expect(within(resultPanel).getAllByRole('listitem').length).toBeGreaterThan(0);
    });
    await user.click(within(resultPanel).getAllByRole('listitem')[0]);
    const acceptPanel = getAcceptRegisterPanel(workflowModal);
    await user.selectOptions(within(acceptPanel).getByLabelText(/診療科/), '01');
    await user.selectOptions(within(acceptPanel).getByLabelText(/担当医/), '10001');
    await selectInsurancePayment(user, acceptPanel);
    const submitButton = within(workflowModal).getByTestId('reception-accept-register');
    await user.click(submitButton);

    const resultHeading = await screen.findByRole('heading', { name: '送信結果' });
    const resultArea = (resultHeading.closest('[role="status"]') ?? resultHeading.parentElement ?? resultHeading) as HTMLElement;
    const resultScope = within(resultArea);

    expect(resultScope.queryByText(/Api_Result:/)).toBeNull();
    expect(resultScope.queryByText(/所要時間:/)).toBeNull();
  });

  it('sends Medical_Information only when selected', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-3',
        patientId: 'P-012',
        appointmentId: 'A-012',
        departmentCode: '01',
        physicianCode: '10001',
        name: '診療内容患者',
        appointmentTime: '09:45',
        department: '01 内科',
        physician: '10001 担当医A',
        status: '予約',
        insurance: '保険',
        source: 'reservations',
      },
    ];
    mockMedicalInformationOptions = [
      { code: '01', name: '外来' },
      { code: '02', name: '再診' },
    ];
    mockMutationQueue.push(
      {
        patients: [
          {
            patientId: 'P-012',
            name: '診療内容患者',
            insurance: '保険',
          },
        ],
        recordsReturned: 1,
        runId: 'RUN-SEARCH-MEDICAL',
      },
      {
        runId: 'RUN-VISIT-MEDICAL',
        traceId: 'TRACE-VISIT-MEDICAL',
        apiResult: '00',
        apiResultMessage: 'OK',
        requestNumber: '01',
        acceptanceId: 'R-012',
        patient: { patientId: 'P-012', name: '診療内容患者' },
      },
    );

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    await user.click(within(patientSearch).getByRole('button', { name: '検索' }));
    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await user.click(within(resultPanel).getAllByRole('listitem')[0]);

    const acceptPanel = getAcceptRegisterPanel(workflowModal);
    await user.selectOptions(within(acceptPanel).getByLabelText(/診療科/), '01');
    await user.selectOptions(within(acceptPanel).getByLabelText(/担当医/), '10001');
    await selectInsurancePayment(user, acceptPanel);
    await user.selectOptions(within(acceptPanel).getByLabelText(/診療内容コード/), '02');
    await user.click(within(workflowModal).getByTestId('reception-accept-register'));

    expect(mockMutationCalls.at(-1)).toMatchObject({
      requestNumber: '01',
      patientId: 'P-012',
      medicalInformation: '02',
    });
  });

  it('omits Medical_Information when left unselected', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-4',
        patientId: 'P-013',
        appointmentId: 'A-013',
        departmentCode: '01',
        physicianCode: '10001',
        name: '未選択患者',
        appointmentTime: '10:15',
        department: '01 内科',
        physician: '10001 担当医A',
        status: '予約',
        insurance: '保険',
        source: 'reservations',
      },
    ];
    mockMedicalInformationOptions = [{ code: '01', name: '外来' }];
    mockMutationQueue.push(
      {
        patients: [
          {
            patientId: 'P-013',
            name: '未選択患者',
            insurance: '保険',
          },
        ],
        recordsReturned: 1,
        runId: 'RUN-SEARCH-MEDICAL-EMPTY',
      },
      {
        runId: 'RUN-VISIT-MEDICAL-EMPTY',
        traceId: 'TRACE-VISIT-MEDICAL-EMPTY',
        apiResult: '00',
        apiResultMessage: 'OK',
        requestNumber: '01',
        acceptanceId: 'R-013',
        patient: { patientId: 'P-013', name: '未選択患者' },
      },
    );

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    await user.click(within(patientSearch).getByRole('button', { name: '検索' }));
    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await user.click(within(resultPanel).getAllByRole('listitem')[0]);

    const acceptPanel = getAcceptRegisterPanel(workflowModal);
    await user.selectOptions(within(acceptPanel).getByLabelText(/診療科/), '01');
    await user.selectOptions(within(acceptPanel).getByLabelText(/担当医/), '10001');
    await selectInsurancePayment(user, acceptPanel);
    await user.click(within(workflowModal).getByTestId('reception-accept-register'));

    expect(mockMutationCalls.at(-1)).toMatchObject({
      requestNumber: '01',
      patientId: 'P-013',
    });
    expect((mockMutationCalls.at(-1) as { medicalInformation?: unknown }).medicalInformation).toBeUndefined();
  });

  it('does not synthesize department/physician codes from display strings during accept workflow', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-display-only',
        patientId: 'P-014',
        appointmentId: 'A-014',
        name: '表示文字列患者',
        appointmentTime: '10:45',
        department: '01 内科',
        physician: '10001 担当医A',
        status: '予約',
        insurance: '保険',
        source: 'reservations',
      },
    ];
    mockMutationQueue.push({
      patients: [
        {
          patientId: 'P-014',
          name: '表示文字列患者',
          insurance: '保険',
        },
      ],
      recordsReturned: 1,
      runId: 'RUN-SEARCH-DISPLAY-ONLY',
    });

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    await user.click(within(patientSearch).getByRole('button', { name: '検索' }));
    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await user.click(within(resultPanel).getAllByRole('listitem')[0]);

    const acceptPanel = getAcceptRegisterPanel(workflowModal);
    const departmentSelect = within(acceptPanel).getByLabelText(/診療科/) as HTMLSelectElement;
    const physicianSelect = within(acceptPanel).getByLabelText(/担当医/) as HTMLSelectElement;
    const registerButton = within(workflowModal).getByTestId('reception-accept-register');

    expect(departmentSelect.options).toHaveLength(0);
    expect(physicianSelect.options).toHaveLength(1);
    expect(registerButton).toBeDisabled();
    expect(mockMutationCalls).toHaveLength(1);
  });

  it('uses server-authoritative selector options for direct patient-search acceptance', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-selector-display-only',
        patientId: 'P-SEL',
        appointmentId: 'A-SEL',
        name: '選択肢患者',
        appointmentTime: '10:45',
        department: '01 内科',
        physician: '10001 担当医A',
        status: '予約',
        insurance: '保険',
        source: 'reservations',
      },
    ];
    mockReceptionSelectorOptions = {
      departments: [{ code: '01', name: '内科' }],
      physicians: [{ code: '10001', name: '日本 一' }],
    };
    mockMutationQueue.push(
      {
        patients: [
          {
            patientId: 'P-SEL',
            name: '選択肢患者',
            insurance: '保険',
          },
        ],
        recordsReturned: 1,
        runId: 'RUN-SEARCH-SELECTOR',
      },
      {
        runId: 'RUN-VISIT-SELECTOR',
        traceId: 'TRACE-VISIT-SELECTOR',
        apiResult: '00',
        apiResultMessage: 'OK',
        acceptanceId: 'R-SEL',
        acceptanceDate: '2026-01-29',
        acceptanceTime: '11:05:00',
        patient: { patientId: 'P-SEL', name: '選択肢患者' },
      },
    );

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    await user.click(within(patientSearch).getByRole('button', { name: '検索' }));
    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await user.click(within(resultPanel).getAllByRole('listitem')[0]);

    const acceptPanel = getAcceptRegisterPanel(workflowModal);
    await user.selectOptions(within(acceptPanel).getByLabelText(/診療科/), '01');
    await user.selectOptions(within(acceptPanel).getByLabelText(/担当医/), '10001');
    await selectInsurancePayment(user, acceptPanel);
    await user.click(within(workflowModal).getByTestId('reception-accept-register'));

    expect(mockMutationCalls.at(-1)).toMatchObject({
      requestNumber: '01',
      patientId: 'P-SEL',
      departmentCode: '01',
      physicianCode: '10001',
    });
  });

  it('accept success 後は patient search 側の canonical handoff で charts を開ける', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-handoff-seed',
        patientId: 'P-015',
        appointmentId: 'A-015',
        departmentCode: '01',
        physicianCode: '10001',
        name: '受診導線患者',
        appointmentTime: '11:00',
        department: '01 内科',
        physician: '10001 担当医A',
        status: '予約',
        insurance: '保険',
        source: 'reservations',
      },
    ];
    mockMutationQueue.push(
      {
        patients: [{ patientId: 'P-015', name: '受診導線患者', insurance: '保険' }],
        recordsReturned: 1,
        runId: 'RUN-SEARCH-HANDOFF',
      },
      {
        runId: 'RUN-VISIT-HANDOFF',
        traceId: 'TRACE-VISIT-HANDOFF',
        apiResult: '00',
        apiResultMessage: 'OK',
        requestNumber: '01',
        businessStatus: 'businessAccepted',
        acceptanceId: 'R-015',
        acceptanceDate: '2026-01-29',
        acceptanceTime: '11:05:00',
        scheduleKey: 'F001:S150',
        encounterKey: 'F001:E150',
        patient: { patientId: 'P-015', name: '受診導線患者' },
      },
    );

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    await user.click(within(patientSearch).getByRole('button', { name: '検索' }));

    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    const selectedItem = within(resultPanel).getAllByRole('listitem')[0];
    await user.click(selectedItem);

    expect(within(selectedItem).queryByRole('button', { name: 'カルテを開く' })).toBeNull();
    const registerButton = within(selectedItem).getByRole('button', { name: '受付する' });
    expect(registerButton).toBeEnabled();

    const acceptPanel = getAcceptRegisterPanel(workflowModal);
    await user.selectOptions(within(acceptPanel).getByLabelText(/診療科/), '01');
    await user.selectOptions(within(acceptPanel).getByLabelText(/担当医/), '10001');
    await selectInsurancePayment(user, acceptPanel);
    await waitFor(() => expect(registerButton).toBeEnabled());
    await user.click(registerButton);

    expect(mockOpenCharts).not.toHaveBeenCalled();
  });

  it('patient search は server-derived 公式 visit 行から既存受付 handoff を開く', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-orca-reservation',
        patientId: 'P-016',
        scheduleKey: 'F001:S159',
        encounterKey: 'F001:E159',
        visitDate: '2026-01-29',
        departmentCode: '01',
        status: '予約',
        source: 'reservations',
      },
      {
        id: 'row-orca-existing-acceptance',
        patientId: 'P-016',
        scheduleKey: 'F001:S160',
        encounterKey: 'F001:E160',
        visitDate: '2026-01-29',
        departmentCode: '01',
        physicianCode: '10001',
        voucherNumber: 'server-derived-voucher',
        sequentialNumber: 'server-derived-seq',
        insuranceCombinationNumber: 'server-derived-insurance',
        name: '既存受付患者',
        department: '01 内科',
        physician: '10001 担当医A',
        status: '予約',
        insurance: '保険',
        source: 'visits',
      },
    ];
    mockMutationQueue.push({
      patients: [{ patientId: 'P-016', name: '既存受付患者', insurance: '保険' }],
      recordsReturned: 1,
      runId: 'RUN-SEARCH-EXISTING-HANDOFF',
    });

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    await user.click(within(patientSearch).getByRole('button', { name: '検索' }));

    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    const selectedItem = within(resultPanel).getAllByRole('listitem')[0];
    await user.click(selectedItem);

    expect(within(selectedItem).queryByRole('button', { name: 'カルテを開く' })).toBeNull();
    expect(within(selectedItem).getByRole('button', { name: '受付する' })).toBeInTheDocument();
    expect(mockOpenCharts).not.toHaveBeenCalled();
    expect(mockMutationCalls).toHaveLength(1);
  });
});

describe('ReceptionPage official master search', () => {
  it('requires WholeName before calling the official patient search', async () => {
    mockSessionRole = 'system_admin';
    vi.stubEnv('VITE_ENABLE_DEBUG_UI', '1');
    const user = userEvent.setup();
    renderReceptionPage();

    const masterSearch = screen.getByRole('region', { name: '既存患者マスタ検索' });
    await user.click(within(masterSearch).getByRole('button', { name: '患者検索' }));

    expect(await within(masterSearch).findByText('氏名（WholeName）は必須です。')).toBeInTheDocument();
    expect(mockMutationCalls).toHaveLength(0);
  });

  it('allows master search without inOut selection and omits inOut from the official request', async () => {
    mockSessionRole = 'system_admin';
    vi.stubEnv('VITE_ENABLE_DEBUG_UI', '1');
    mockMutationQueue.push({
      ok: true,
      apiResult: '00',
      apiResultMessage: 'OK',
      patients: [
        {
          patientId: 'P-200',
          name: '既存患者',
          kana: 'キソンカンジャ',
        },
      ],
      recordsReturned: 1,
      runId: 'RUN-MASTER-SEARCH',
    });

    const user = userEvent.setup();
    renderReceptionPage();

    const masterSearch = screen.getByRole('region', { name: '既存患者マスタ検索' });
    await user.type(within(masterSearch).getByLabelText('氏名'), '既存患者');
    await user.click(within(masterSearch).getByRole('button', { name: '患者検索' }));

    expect(screen.queryByText('処理区分（入院/外来）を選択してください。')).toBeNull();
    expect(mockMutationCalls[0]).toMatchObject({
      name: '既存患者',
    });
    expect((mockMutationCalls[0] as { inOut?: unknown }).inOut).toBeUndefined();
  });
});

describe('ReceptionPage toolbar and tabs', () => {
  it('shows toolbar controls and removes floating actions', () => {
    mockSearchParams = new URLSearchParams('date=2026-05-07');
    renderReceptionPage();

    const toolbar = getToolbar();
    expect(toolbar).toBeInTheDocument();
    const dateInput = within(toolbar).getByLabelText('受付日') as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: '前日に移動' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: '翌日に移動' })).toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: '前日' })).toBeNull();
    expect(within(toolbar).queryByRole('button', { name: '翌日' })).toBeNull();
    expect(within(toolbar).queryByRole('button', { name: '今日' })).toBeNull();
    expect(within(toolbar).getByRole('searchbox', { name: '受付患者検索' })).toHaveAttribute(
      'placeholder',
      '患者ID・氏名・カナで検索できます。',
    );
    expect(within(toolbar).queryByText('患者ID・氏名・カナで検索できます。')).toBeNull();
    expect(within(toolbar).getByRole('button', { name: '検索' })).toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: '一覧操作' })).toBeNull();
    expect(within(toolbar).getByRole('button', { name: '表示条件変更' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '患者を受付する' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(toolbar).queryByRole('button', { name: '再取得' })).toBeNull();
    const statusTabs = screen.getByRole('region', { name: 'ステータスタブ' });
    expect(within(statusTabs).getByRole('button', { name: '再取得' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '保険/自費' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: '保存した条件' })).toBeNull();
    expect(screen.queryByRole('button', { name: '条件をクリア' })).toBeNull();
    expect(within(toolbar).queryByRole('button', { name: /日次状態/ })).toBeNull();
    expect(document.querySelector('.reception-page__floating-actions')).toBeNull();
  });

  it('shifts the reception date by one day with compact arrow buttons', async () => {
    mockSearchParams = new URLSearchParams('date=2026-05-07');
    const user = userEvent.setup();
    renderReceptionPage();

    const toolbar = getToolbar();
    const dateInput = within(toolbar).getByLabelText('受付日') as HTMLInputElement;
    await user.click(within(toolbar).getByRole('button', { name: '前日に移動' }));
    expect(dateInput).toHaveValue('2026-05-06');
    await user.click(within(toolbar).getByRole('button', { name: '翌日に移動' }));
    expect(dateInput).toHaveValue('2026-05-07');
  });

  it('places list actions without the 一覧操作 disclosure', () => {
    renderReceptionPage();

    const toolbar = getToolbar();
    expect(within(toolbar).queryByRole('button', { name: '一覧操作' })).toBeNull();
    expect(screen.getByRole('button', { name: '患者を受付する' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '一覧操作' })).toBeNull();

    const statusTabs = screen.getByRole('region', { name: 'ステータスタブ' });
    expect(within(statusTabs).getByRole('button', { name: '再取得' })).toBeInTheDocument();
  });

  it('hides system details for non-debug users', () => {
    renderReceptionPage();
    expect(screen.queryByText('システム詳細')).toBeNull();
  });

  it('toggles advanced filters from 表示条件変更 button', async () => {
    const user = userEvent.setup();
    renderReceptionPage();

    expect(screen.queryByRole('combobox', { name: '保険/自費' })).toBeNull();
    const toolbar = getToolbar();
    const toggleButton = within(toolbar).getByRole('button', { name: '表示条件変更' });
    await user.click(toggleButton);

    expect(screen.getByRole('combobox', { name: '保険/自費' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '保存した条件' })).toBeInTheDocument();
    expect(screen.getByText('表示条件を保存')).toBeInTheDocument();
    expect(screen.queryByText('例: 内科/午前/保険')).toBeNull();
    expect(screen.getByRole('button', { name: '条件をクリア' })).toBeInTheDocument();

    await user.click(toggleButton);
    expect(screen.queryByRole('combobox', { name: '保険/自費' })).toBeNull();
  });
});

describe('ReceptionPage list and side pane guidance', () => {
  it('highlights selected row and expands details on selection', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-1',
        patientId: 'P-001',
        receptionId: 'R-001',
        name: '山田太郎',
        appointmentTime: '09:00',
        department: '01 内科',
        status: '受付中',
        insurance: '保険',
        source: 'visits',
      },
      {
        id: 'row-2',
        patientId: 'P-002',
        receptionId: 'R-002',
        name: '佐藤花子',
        appointmentTime: '10:00',
        department: '02 外科',
        status: '診療中',
        insurance: '自費',
        source: 'visits',
      },
    ];

    const user = userEvent.setup();
    renderReceptionPage();

    const row1 = screen.getByRole('row', { name: /山田太郎/ });

    expect(row1).toHaveClass('reception-table__row--selected');
    expect(row1).toHaveAttribute('data-patient-id', 'P-001');
    expect(row1).toHaveAttribute('data-reception-id', 'R-001');
    expect(row1).toHaveAttribute('data-schedule-key', '');
    expect(row1).toHaveAttribute('data-encounter-key', '');
    expect(row1).toHaveAttribute('data-appointment-id', '');
    expect(screen.queryByRole('row', { name: /佐藤花子/ })).toBeNull();

    await user.click(screen.getByRole('tab', { name: /診察中/ }));
    const row2 = screen.getByRole('row', { name: /佐藤花子/ });

    await user.click(row2);

    expect(row2).toHaveClass('reception-table__row--selected');
  });

  it('keeps list controls and patient summary compact for reception work', () => {
    mockSearchParams = new URLSearchParams('date=2026-05-07');
    mockAppointmentData.entries = [
      {
        id: 'row-compact',
        patientId: 'P-100',
        appointmentId: 'A-100',
        name: '表示患者',
        kana: 'ヒョウジ',
        birthDate: '1957-12-10 +09',
        sex: 'M',
        appointmentTime: '09:15',
        department: '01 内科',
        status: '受付中',
        insurance: '保険',
        source: 'slots',
      },
      {
        id: 'row-child',
        patientId: 'P-101',
        appointmentId: 'A-101',
        name: '小児患者',
        kana: 'ショウニ',
        birthDate: '2018-05-08',
        sex: 'F',
        appointmentTime: '09:30',
        department: '01 内科',
        status: '受付中',
        insurance: '保険',
        source: 'slots',
      },
    ];

    renderReceptionPage();

    const statusTabs = screen.getByRole('region', { name: 'ステータスタブ' });
    const displayActions = within(statusTabs).getByRole('group', { name: '表示形式' });
    expect(displayActions).toBeInTheDocument();
    expect(within(statusTabs).getByRole('tab', { name: '診察待ち 2' })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('.reception-workspace-header__title')).toBeNull();
    expect(statusTabs.previousElementSibling).toHaveClass('reception-workspace-header__controls');

    const toolbar = screen.getByRole('region', { name: '受付ツールバー' });
    expect(within(toolbar).queryByRole('group', { name: '表示形式' })).toBeNull();
    expect(within(displayActions).getByRole('button', { name: '表' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(displayActions).getByRole('button', { name: 'カード' })).toHaveAttribute('aria-pressed', 'false');

    const table = screen.getByRole('table');
    expect(within(table).queryByRole('columnheader', { name: '支払' })).toBeNull();
    expect(within(table).queryByRole('columnheader', { name: '請求' })).toBeNull();
    expect(within(table).queryByRole('columnheader', { name: '直近' })).toBeNull();
    expect(within(table).queryByRole('columnheader', { name: 'ORCA連携' })).toBeNull();
    expect(within(table).queryByText('操作')).toBeNull();
    expect(within(table).getByRole('columnheader', { name: '行操作' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: '年齢' })).toBeInTheDocument();

    const row = screen.getByRole('row', { name: /表示患者/ });
    expect(row).toHaveAttribute('data-sex-tone', 'male');
    expect(row).toHaveAccessibleName(/男性 成人/);
    expect(row.querySelector('.reception-patient-icon')).toHaveAttribute('data-sex-tone', 'male');
    expect(row.querySelector('.reception-patient-icon')).toHaveAttribute('data-age-group', 'adult');
    expect(row.querySelector('.reception-patient-icon__halo')).toBeInTheDocument();
    expect(row.querySelector('.reception-patient-icon__body')).toBeInTheDocument();
    expect(within(row).getByText('68歳')).toBeInTheDocument();
    expect(within(row).queryByText('1957年12月10日生')).toBeNull();
    expect(within(row).getByText('内科')).toBeInTheDocument();
    expect(within(row).queryByText('01 内科')).toBeNull();
    const patientText = row.querySelector('.reception-table__patient-text');
    expect(patientText?.textContent).toContain('ヒョウジ表示患者');
    expect(patientText?.textContent).not.toContain('68歳');
    expect(within(row).queryByText(/予約ID/)).toBeNull();
    expect(within(row).queryByText(/DOB:/)).toBeNull();

    const childRow = screen.getByRole('row', { name: /小児患者/ });
    expect(childRow).toHaveAttribute('data-sex-tone', 'female');
    expect(childRow).toHaveAccessibleName(/女性 小児/);
    expect(childRow.querySelector('.reception-patient-icon')).toHaveAttribute('data-sex-tone', 'female');
    expect(childRow.querySelector('.reception-patient-icon')).toHaveAttribute('data-age-group', 'child');
    expect(childRow.querySelector('.reception-patient-icon__age-mark')).toBeInTheDocument();
    expect(within(childRow).getByText('7歳')).toBeInTheDocument();
    expect(within(row).queryByText(/性別/)).toBeNull();
  });

  it('opens accept workflow modal and shows patient search/result panes; medical record preview opens in a modal (debug panels hidden by default)', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-3',
        patientId: 'P-010',
        receptionId: 'R-010',
        appointmentId: 'A-010',
        scheduleKey: 'F001:S150',
        encounterKey: 'F001:E150',
        name: '集約患者',
        kana: 'シュウヤク',
        appointmentTime: '11:30',
        department: '01 内科',
        physician: '10001 Dr. Test',
        status: '会計待ち',
        insurance: '保険',
        source: 'visits',
      },
    ];
    const user = userEvent.setup();
    renderReceptionPage();

    expect(screen.queryByRole('region', { name: '患者検索' })).toBeNull();
    await user.click(screen.getByRole('tab', { name: /会計待ち/ }));
    const selectedRow = screen.getByRole('row', { name: /集約患者/ });
    expect(selectedRow).toHaveAttribute('data-patient-id', 'P-010');
    expect(selectedRow).toHaveAttribute('data-reception-id', 'R-010');
    expect(selectedRow).toHaveAttribute('data-appointment-id', 'A-010');
    expect(selectedRow).toHaveAttribute('data-schedule-key', 'F001:S150');
    expect(selectedRow).toHaveAttribute('data-encounter-key', 'F001:E150');
    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    expect(patientSearch).toBeInTheDocument();
    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    expect(resultPanel).toBeInTheDocument();

    await waitFor(() => {
      expect(within(patientSearch).getByLabelText('患者ID')).toHaveValue('P-010');
    });
    expect(within(patientSearch).queryByLabelText(/保険\/自費/)).toBeNull();

    // Preview medical records in a modal (no new tab).
    const row = screen.getByRole('row', { name: /集約患者/ });
    await openRowActionMenu(user, row);
    await user.click(getRowMenuAction(row, /過去カルテ/));
    const dialog = (await screen.findByRole('dialog', { name: /過去カルテ/ })) as HTMLElement;
    expect(within(dialog).getByText(/患者ID:\s*P-010/)).toBeInTheDocument();
    await waitFor(() => {
      expect(within(dialog).getByText('過去カルテがありません。')).toBeInTheDocument();
    });
    await user.click(within(dialog).getByRole('button', { name: '閉じる' }));
    expect(screen.queryByRole('dialog', { name: /過去カルテ/ })).toBeNull();

    // Debug panels should not be visible by default.
    expect(screen.queryByTestId('order-console')).toBeNull();
    expect(screen.queryByTestId('reception-audit')).toBeNull();
  });

  it('does not show debug panels to system_admin unless debug UI is explicitly enabled', () => {
    mockSessionRole = 'system_admin';
    renderReceptionPage();

    expect(screen.queryByTestId('order-console')).toBeNull();
    expect(screen.queryByTestId('reception-audit')).toBeNull();
    expect(screen.queryByRole('region', { name: '既存患者マスタ検索' })).toBeNull();
  });

  it('過去カルテモーダルは実行IDと内部状態コードを表示しない', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-records-modal',
        patientId: 'P-030',
        receptionId: 'R-030',
        name: '履歴患者',
        birthDate: '1975-04-01',
        sex: 'F',
        visitDate: '2026-05-08',
        appointmentTime: '10:30',
        departmentCode: '01',
        department: '01 内科',
        status: '受付中',
        insurance: '保険',
        source: 'visits',
      },
    ];
    mockMedicalRecordsData = {
      runId: 'RUN-MEDICAL-RECORDS',
      records: [
        {
          documentId: 'DOC-001',
          performDate: '2026-05-07',
          departmentCode: '01',
          departmentName: '内科',
          sequentialNumber: '1.0',
          documentStatus: 'F',
        },
      ],
    };

    const user = userEvent.setup();
    renderReceptionPage();

    const row = screen.getByRole('row', { name: /履歴患者/ });
    await openRowActionMenu(user, row);
    await user.click(getRowMenuAction(row, /過去カルテ/));

    const dialog = await screen.findByRole('dialog', { name: /過去カルテ/ });
    expect(within(dialog).getByText('2026-05-07')).toBeInTheDocument();
    expect(within(dialog).getByText('内科')).toBeInTheDocument();
    expect(within(dialog).queryByText(/RUN_ID/)).toBeNull();
    expect(within(dialog).queryByText(/コピー/)).toBeNull();
    expect(within(dialog).queryByText(/連番/)).toBeNull();
    expect(within(dialog).queryByText(/状態/)).toBeNull();
  });

  it('pads the accept workflow patient ID to the ORCA trial digit count before search', async () => {
    mockMutationQueue.push({
      patients: [],
      recordsReturned: 0,
      runId: 'RUN-PATIENT-ID-SEARCH',
    });

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const form = within(patientSearch);
    await user.clear(form.getByLabelText('患者ID'));
    await user.type(form.getByLabelText('患者ID'), '1');
    await user.click(form.getByRole('button', { name: '検索' }));

    await waitFor(() => {
      expect(mockMutationCalls.at(-1)).toEqual({
        patientId: '00001',
        nameSei: '',
        nameMei: '',
        kanaSei: '',
        kanaMei: '',
      });
    });
  });

  it('shows a no-result notice instead of a timeout when patient ID search completes with zero hits', async () => {
    mockMutationQueue.push({
      patients: [],
      recordsReturned: 0,
      runId: 'RUN-PATIENT-ID-NO-HIT',
    });

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const form = within(patientSearch);
    await user.clear(form.getByLabelText('患者ID'));
    await user.type(form.getByLabelText('患者ID'), '999999');
    await user.click(form.getByRole('button', { name: '検索' }));

    expect(await within(workflowModal).findByText(/患者ID 999999 に一致する ORCA 患者は見つかりません/)).toBeInTheDocument();
    expect(within(workflowModal).queryByText(/タイムアウト/)).not.toBeInTheDocument();
  });

  it('uses the submitted patient ID field value even when React state has not re-rendered yet', async () => {
    mockMutationQueue.push({
      patients: [],
      recordsReturned: 0,
      runId: 'RUN-PATIENT-ID-FORMDATA',
    });

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const form = patientSearch.querySelector('[data-test-id="reception-patient-search-form"]') as HTMLFormElement;
    const patientIdInput = within(patientSearch).getByLabelText('患者ID') as HTMLInputElement;
    expect(form).not.toBeNull();
    patientIdInput.value = '1';
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockMutationCalls.at(-1)).toEqual({
        patientId: '00001',
        nameSei: '',
        nameMei: '',
        kanaSei: '',
        kanaMei: '',
      });
    });
  });

  it('normalizes over-padded ORCA trial patient IDs before search', async () => {
    mockMutationQueue.push({
      patients: [],
      recordsReturned: 0,
      runId: 'RUN-PATIENT-ID-OVERPADDED',
    });

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const form = within(patientSearch);
    await user.clear(form.getByLabelText('患者ID'));
    await user.type(form.getByLabelText('患者ID'), '000001');
    await user.click(form.getByRole('button', { name: '検索' }));

    await waitFor(() => {
      expect(mockMutationCalls.at(-1)).toEqual({
        patientId: '00001',
        nameSei: '',
        nameMei: '',
        kanaSei: '',
        kanaMei: '',
      });
    });
  });

  it('keeps the accept workflow patient ID field numeric and capped to the ORCA digit count', async () => {
    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const patientIdInput = within(patientSearch).getByLabelText('患者ID') as HTMLInputElement;

    await user.clear(patientIdInput);
    await user.type(patientIdInput, '12A3456789');

    expect(patientIdInput).toHaveValue('12345678');
    expect(patientIdInput).toHaveAttribute('maxLength', '8');
    expect(patientIdInput).toHaveAttribute('pattern', '[0-9]*');
  });

  it('does not show a previously selected reception row as the accept workflow selected patient', async () => {
    mockAppointmentData.entries = [
      createBillingEntry({
        id: 'row-previous-selection',
        patientId: '00003',
        name: '事例　三',
        status: '受付中',
      }),
    ];
    mockMutationQueue.push({
      patients: [
        {
          patientId: '00001',
          name: 'スモーク 患者',
          kana: 'スモーク カンジャ',
          birthDate: '1970-01-01',
          sex: 'M',
        },
      ],
      recordsReturned: 1,
      runId: 'RUN-PATIENT-ID-SELECTION',
    });

    const user = userEvent.setup();
    renderReceptionPage();
    await user.click(screen.getByRole('row', { name: /事例　三/ }));

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const form = within(patientSearch);
    await user.type(form.getByLabelText('患者ID'), '00001');
    await user.click(form.getByRole('button', { name: '検索' }));

    await waitFor(() => {
      expect(within(workflowModal).queryByText('選択患者: 未選択')).toBeNull();
    });
    expect(within(workflowModal).queryByText('選択患者: 事例　三')).toBeNull();
  });

  it('removes direct chart-open form from 当日受付モーダル', async () => {
    const user = userEvent.setup();
    renderReceptionPage();
    const workflowModal = await openAcceptWorkflowModal(user);
    expect(within(workflowModal).queryByLabelText('患者IDでカルテを開く')).toBeNull();
  });

  it('shows patient details after explicit result selection', async () => {
    const searchPayload = {
      patients: [
        {
          patientId: '101',
          name: '検索患者一',
          kana: 'ケンサクカンジャイチ',
          birthDate: '1980-01-01',
          sex: 'M',
          insurance: '保険',
          lastVisit: '2026-02-10',
        },
        {
          patientId: '102',
          name: '検索患者二',
          kana: 'ケンサクカンジャニ',
          birthDate: '1990-02-02',
          sex: 'F',
          insurance: '自費',
          lastVisit: '2026-02-12',
        },
      ],
      recordsReturned: 2,
      runId: 'RUN-SEARCH',
    };
    mockMutationQueue.push(searchPayload, searchPayload);

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const patientIdInput = within(patientSearch).getByLabelText('患者ID');
    await user.clear(patientIdInput);
    await user.type(patientIdInput, '1');
    await user.click(within(patientSearch).getByRole('button', { name: '検索' }));

    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await waitFor(() => {
      expect(within(resultPanel).getAllByText('検索患者一').length).toBeGreaterThan(0);
    });
    const acceptPanel = getAcceptRegisterPanel(workflowModal);

    expect(within(workflowModal).queryByText('受付対象')).toBeNull();
    expect(within(resultPanel).getByText('生年月日: 1980-01-01')).toBeInTheDocument();
    expect(within(resultPanel).getAllByRole('listitem').length).toBeGreaterThan(0);

    await user.click(within(resultPanel).getAllByRole('listitem')[0]);
    expect(within(workflowModal).getByTestId('reception-accept-register')).toBeInTheDocument();
    expect(within(acceptPanel).queryByText('選択患者: 検索患者一')).toBeNull();
    expect(within(acceptPanel).getByRole('group', { name: '受付対象 検索患者一' })).toBeInTheDocument();
    const identitySummary = within(acceptPanel).getByRole('group', { name: '受付対象 検索患者一' });
    expect(identitySummary.textContent).toMatch(/ケンサクカンジャイチ.*検索患者一/s);
    expect(within(identitySummary).getByText('46歳')).toBeInTheDocument();
    expect(within(acceptPanel).queryByText('受付登録モーダル')).toBeNull();
    expect(within(acceptPanel).queryByText('Pt')).toBeNull();
    expect(within(acceptPanel).queryByText('患者ID 101')).toBeNull();
    expect(within(acceptPanel).queryByText(/性別\/年齢/)).toBeNull();
    expect(within(acceptPanel).queryByText(/受付対象:/)).toBeNull();
    expect(within(acceptPanel).getByLabelText(/診療科/)).toBeInTheDocument();
    expect(within(acceptPanel).getByLabelText(/保険\/自費/)).toBeInTheDocument();
    expect(within(acceptPanel).queryByText(/InsuranceProvider_Class/)).toBeNull();
    expect(within(resultPanel).getByText('生年月日: 1990-02-02')).toBeInTheDocument();
  });

  it('paginates patient-search results when the hit count is large', async () => {
    const searchPayload = {
      patients: Array.from({ length: 55 }, (_, index) => {
        const suffix = String(index + 1).padStart(3, '0');
        return {
          patientId: `${suffix}`,
          name: `ページ患者${suffix}`,
        };
      }),
      recordsReturned: 55,
      runId: 'RUN-SEARCH-PAGE',
    };
    mockMutationQueue.push(searchPayload, searchPayload);

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const patientIdInput = within(patientSearch).getByLabelText('患者ID');
    await user.clear(patientIdInput);
    await user.type(patientIdInput, '0');
    await user.click(within(patientSearch).getByRole('button', { name: '検索' }));

    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await waitFor(() => {
      expect(within(resultPanel).getByText('ページ患者001')).toBeInTheDocument();
      expect(within(resultPanel).getByRole('navigation', { name: '検索結果ページ' })).toBeInTheDocument();
    });

    expect(within(resultPanel).getByText('ページ患者050')).toBeInTheDocument();
    expect(within(resultPanel).queryByText('ページ患者051')).toBeNull();
    expect(within(resultPanel).getByText('1 / 2')).toBeInTheDocument();

    const pager = within(resultPanel).getByRole('navigation', { name: '検索結果ページ' });
    await user.click(within(pager).getByRole('button', { name: '次へ' }));

    await waitFor(() => {
      expect(within(resultPanel).getByText('ページ患者051')).toBeInTheDocument();
    });
    expect(within(resultPanel).queryByText('ページ患者001')).toBeNull();
    expect(within(resultPanel).getByText('2 / 2')).toBeInTheDocument();
  });

  it('toggles the accept workflow modal from the toolbar button', async () => {
    const searchPayload = {
      patients: [
        {
          patientId: '301',
          name: 'クローズ確認患者',
        },
      ],
      recordsReturned: 1,
      runId: 'RUN-SEARCH-CLOSE',
    };
    mockMutationQueue.push(searchPayload, searchPayload);

    const user = userEvent.setup();
    renderReceptionPage();

    const acceptButton = screen.getByRole('button', { name: '患者を受付する' });

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const patientIdInput = within(patientSearch).getByLabelText('患者ID');
    await user.clear(patientIdInput);
    await user.type(patientIdInput, '3');
    await user.click(within(patientSearch).getByRole('button', { name: '検索' }));

    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await waitFor(() => {
      expect(within(resultPanel).getByText('クローズ確認患者')).toBeInTheDocument();
    });

    await user.click(acceptButton);

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: '既存患者受付/患者検索' })).toBeNull();
    });
    expect(acceptButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders patient search pane on the left and result pane on the right in accept workflow modal', async () => {
    const searchPayload = {
      patients: [
        {
          patientId: '401',
          name: '折りたたみ患者',
        },
      ],
      recordsReturned: 1,
      runId: 'RUN-SEARCH-COLLAPSE',
    };
    mockMutationQueue.push(searchPayload, searchPayload);

    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    const patientIdInput = within(patientSearch).getByLabelText('患者ID');
    await user.clear(patientIdInput);
    await user.type(patientIdInput, '4');
    await user.click(within(patientSearch).getByRole('button', { name: '検索' }));

    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await waitFor(() => {
      expect(within(resultPanel).getByText('折りたたみ患者')).toBeInTheDocument();
    });
    expect(within(workflowModal).queryByTestId('reception-accept-register')).toBeNull();

    await user.click(within(resultPanel).getAllByRole('listitem')[0]);
    expect(within(workflowModal).getByTestId('reception-accept-register')).toBeInTheDocument();
  });

  it('shows close button in accept workflow modal and closes it', async () => {
    const user = userEvent.setup();
    renderReceptionPage();

    const workflowModal = await openAcceptWorkflowModal(user);
    expect(within(workflowModal).getByRole('region', { name: '患者検索' })).toBeInTheDocument();
    expect(within(workflowModal).queryByRole('button', { name: '折りたたむ' })).toBeNull();
    expect(within(workflowModal).queryByRole('button', { name: '展開' })).toBeNull();
    const closeButton = within(workflowModal).getByRole('button', { name: '閉じる' });
    await user.click(closeButton);
    expect(screen.queryByRole('region', { name: '既存患者受付/患者検索' })).toBeNull();
  });

  it('uses the reception date input as the single date control', async () => {
    const user = userEvent.setup();
    renderReceptionPage();
    const toolbar = getToolbar();
    const acceptButton = screen.getByRole('button', { name: '患者を受付する' });
    const dateInput = within(toolbar).getByLabelText('受付日');

    expect(dateInput).toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: /日次状態/ })).toBeNull();
    expect(screen.queryByRole('group', { name: '日次状態カレンダー' })).toBeNull();

    await user.click(acceptButton);
    expect(await screen.findByRole('region', { name: '既存患者受付/患者検索' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '日次状態カレンダー' })).toBeNull();
  });

  it('closes accept workflow modal with Escape key', async () => {
    const user = userEvent.setup();
    renderReceptionPage();

    await openAcceptWorkflowModal(user);
    expect(screen.getByRole('region', { name: '既存患者受付/患者検索' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: '既存患者受付/患者検索' })).toBeNull();
    });
  });
});

describe('ReceptionPage status/date/card action UX', () => {
  it('defaults date filter to visitDate from router state (non-charts navigation)', () => {
    mockLocationState = { visitDate: '2026-02-03' };
    renderReceptionPage();
    expect(screen.getByLabelText('日付')).toHaveValue('2026-02-03');
  });

  it('defaults date filter to today when opened from charts (visitDate is only a hint)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-13T00:00:00Z'));
    try {
      mockSearchParams = new URLSearchParams('from=charts');
      mockLocationState = { visitDate: '2026-02-03' };
      renderReceptionPage();
      expect(screen.getByLabelText('日付')).toHaveValue('2026-02-13');
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears search conditions without crashing', async () => {
    const user = userEvent.setup();
    renderReceptionPage();
    const toolbar = getToolbar();
    await user.click(within(toolbar).getByRole('button', { name: '表示条件変更' }));
    await user.click(screen.getByRole('button', { name: '条件をクリア' }));
    expect(screen.getByRole('button', { name: '検索' })).toBeInTheDocument();
  });

  it('shows chart button directly on table rows and keeps history/cancel in menu', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-card-1',
        patientId: 'P-301',
        receptionId: 'R-301',
        appointmentId: 'A-301',
        scheduleKey: 'S-301',
        encounterKey: 'E-301',
        name: 'カード患者',
        appointmentTime: '09:30',
        department: '01 内科',
        status: '受付中',
        insurance: '保険',
        source: 'visits',
      },
    ];
    const user = userEvent.setup();
    renderReceptionPage();

    const row = screen.getByRole('row', { name: /カード患者/ });
    expect(row).toHaveAttribute('data-patient-id', 'P-301');
    expect(row).toHaveAttribute('data-reception-id', 'R-301');
    expect(row).toHaveAttribute('data-appointment-id', 'A-301');
    expect(row).toHaveAttribute('data-schedule-key', 'S-301');
    expect(row).toHaveAttribute('data-encounter-key', 'E-301');
    expect(within(row).getByRole('button', { name: 'カルテを開く' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /その他|操作を開く/ })).toBeInTheDocument();
    await openRowActionMenu(user, row);
    expect(getRowMenuAction(row, /過去カルテ/)).toBeInTheDocument();
    expect(getRowMenuAction(row, /受付取消/)).toBeInTheDocument();
  });

  it('switches to 会計待ち tab and shows only 会計待ち entries', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-tab-1',
        patientId: 'P-401',
        receptionId: 'R-401',
        name: '受付患者',
        appointmentTime: '08:30',
        department: '01 内科',
        status: '受付中',
        insurance: '保険',
        source: 'visits',
      },
      {
        id: 'row-tab-2',
        patientId: 'P-402',
        receptionId: 'R-402',
        name: '診察後患者',
        appointmentTime: '10:15',
        department: '02 外科',
        status: '会計待ち',
        insurance: '保険',
        source: 'visits',
      },
    ];

    renderReceptionPage();
    const tab = screen.getByRole('tab', { name: /会計待ち/ });
    await userEvent.setup().click(tab);
    const listRegion = screen.getByRole('region', { name: '受付一覧' });
    expect(within(listRegion).getByText('診察後患者')).toBeInTheDocument();
    expect(within(listRegion).queryByText('受付患者')).toBeNull();
  });

  it('switches to 予約 tab and shows only 予約 entries', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-tab-3',
        patientId: 'P-403',
        receptionId: 'R-403',
        name: '会計患者',
        appointmentTime: '10:00',
        department: '01 内科',
        status: '会計待ち',
        insurance: '保険',
        source: 'visits',
      },
      {
        id: 'row-tab-4',
        patientId: 'P-404',
        appointmentId: 'A-404',
        name: '予約患者',
        appointmentTime: '11:00',
        department: '02 外科',
        status: '予約',
        insurance: '保険',
        source: 'reservations',
      },
    ];

    const user = userEvent.setup();
    renderReceptionPage();
    await user.click(screen.getByRole('tab', { name: /予約/ }));
    const listRegion = screen.getByRole('region', { name: '受付一覧' });
    expect(within(listRegion).getByText('予約患者')).toBeInTheDocument();
    expect(within(listRegion).queryByText('会計患者')).toBeNull();
  });

  it('blocks duplicate acceptance even when active reception is hidden by filters', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-dup-active',
        patientId: 'P-900',
        receptionId: 'R-900',
        name: '重複患者',
        appointmentTime: '09:00',
        department: '01 内科',
        status: '受付中',
        insurance: '保険',
        source: 'visits',
      },
      {
        id: 'row-dup-reserve',
        patientId: 'P-900',
        appointmentId: 'A-901',
        name: '重複患者',
        appointmentTime: '10:00',
        department: '02 外科',
        status: '予約',
        insurance: '保険',
        source: 'reservations',
      },
    ];
    mockMutationQueue.push({
      patients: [
        {
          patientId: 'P-900',
          name: '重複患者',
          insurance: '保険',
        },
      ],
      recordsReturned: 1,
      runId: 'RUN-SEARCH-DUPLICATE',
    });

    const user = userEvent.setup();
    renderReceptionPage();

    const toolbar = getToolbar();
    await user.click(within(toolbar).getByRole('button', { name: '表示条件変更' }));
    await user.selectOptions(screen.getByLabelText('診療科'), '02 外科');

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    await user.click(within(patientSearch).getByRole('button', { name: '検索' }));
    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await user.click(within(resultPanel).getAllByRole('listitem')[0]);
    const registerButton = within(workflowModal).getByTestId('reception-accept-register');
    await waitFor(() => {
      expect(registerButton).toBeDisabled();
      expect(registerButton).toHaveTextContent('受付する');
    });
  });

  it('会計待ち rows do not expose the routine initial 会計送信 action', async () => {
    mockAppointmentData.entries = [createBillingEntry()];
    mockSearchParams = new URLSearchParams('date=2026-01-29');
    mockLocationState = { visitDate: '2026-01-29' };

    const user = userEvent.setup();
    renderReceptionPage();

    await user.click(screen.getByRole('tab', { name: /会計待ち/ }));
    const listRegion = screen.getByRole('region', { name: '受付一覧' });
    const row = within(listRegion).getByRole('row', { name: /診察終了患者/ });
    expect(within(row).queryByRole('button', { name: '会計送信' })).not.toBeInTheDocument();
    expect(within(row).getByText('初回送信は医師画面で実行')).toBeInTheDocument();
    expect(vi.mocked(buildMedicalModV2RequestXml)).not.toHaveBeenCalled();
    expect(vi.mocked(postOrcaMedicalModV2Xml)).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalledWith(expect.objectContaining({ message: '会計送信を完了' }));
    expect(within(row).getByText('送信: 未送信')).toBeInTheDocument();
    await expect(screen.queryByRole('tab', { name: /会計済/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /会計待ち/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(listRegion).getByRole('row', { name: /診察終了患者/ })).toBeInTheDocument();
  });

  it('ORCA送信の要確認一覧を初期表示し、秘密系識別子を表示しない', async () => {
    mockBillingOrcaReviewData = {
      ok: true,
      count: 1,
      limit: 20,
      runId: 'RUN-REVIEW-LIST',
      entries: [
        {
          transmissionId: 42,
          snapshotId: 101,
          encounterKey: 'encounter-review-001',
          scheduleKey: 'schedule-review-001',
          patientId: 'P-REVIEW-001',
          state: 'ORCA_UNKNOWN',
          operationStatus: 'UNKNOWN',
          needsUserReview: true,
          confirmationRequired: true,
          medicalUidPresent: false,
          apiResult: 'UNKNOWN',
          apiResultMessage: '送信結果が確定していません',
          startedAt: '2026-05-10T15:00:00Z',
        },
      ],
    };

    renderReceptionPage();

    const reviewRegion = screen.getByRole('region', { name: 'ORCA送信の要確認一覧' });
    expect(reviewRegion).toHaveTextContent('ORCA送信の要確認が1件あります。');
    expect(within(reviewRegion).getByText('要確認')).toBeInTheDocument();
    expect(within(reviewRegion).getByText('患者ID: P-REVIEW-001')).toBeInTheDocument();
    expect(within(reviewRegion).getByText('encounter-review-001')).toBeInTheDocument();
    expect(within(reviewRegion).getAllByText('UNKNOWN').length).toBeGreaterThanOrEqual(1);
    expect(within(reviewRegion).getByText('ORCA状態を再照合し、成功扱いにせず要確認として処理')).toBeInTheDocument();
    expect(reviewRegion).not.toHaveTextContent(/idempotency|trace|request/i);
    expect(screen.queryByRole('button', { name: '会計送信' })).not.toBeInTheDocument();
    expect(vi.mocked(buildMedicalModV2RequestXml)).not.toHaveBeenCalled();
    expect(vi.mocked(postOrcaMedicalModV2Xml)).not.toHaveBeenCalled();
  });

  it('ORCA送信の要確認一覧から server-side 再照合を実行し、秘密系識別子を表示しない', async () => {
    mockBillingOrcaReviewData = {
      ok: true,
      count: 1,
      limit: 20,
      runId: 'RUN-REVIEW-LIST',
      entries: [
        {
          transmissionId: 42,
          snapshotId: 101,
          encounterKey: 'encounter-review-001',
          scheduleKey: 'schedule-review-001',
          patientId: 'P-REVIEW-001',
          state: 'ORCA_UNKNOWN',
          operationStatus: 'UNKNOWN',
          needsUserReview: true,
          confirmationRequired: true,
          medicalUidPresent: false,
          apiResult: 'UNKNOWN',
          apiResultMessage: '送信結果が確定していません',
          startedAt: '2026-05-10T15:00:00Z',
        },
      ],
    };
    mockMutationResult = {
      ok: true,
      transmissionId: 42,
      operationStatus: 'ORCA_TEMPORARY_MEDICAL_FOUND',
      reconciliationStatus: 'TEMPORARY_MEDICAL_FOUND',
      needsUserReview: true,
      rawSensitiveFieldsExcluded: true,
      clientProvidedIdentifiersTrusted: false,
      serverDerivedAuthorityRequired: true,
      temporaryMedicalRowCount: 2,
      matchingTemporaryMedicalRowCount: 1,
      medicalUidPresent: true,
      medicalMode: '0',
      medicalMode2: '0',
      resendBlocked: true,
      resendBlockReason: 'ORCA_TEMPORARY_MEDICAL_MODE_LOCKED',
      message: 'ORCA中途終了データに一致候補があります',
      medicalUid: 'SECRET-MEDICAL-UID',
      insuranceCombinationNumber: 'SECRET-INSURANCE',
      rawResponseBody: '<xml>secret</xml>',
    };

    const user = userEvent.setup();
    renderReceptionPage();

    const reviewRegion = screen.getByRole('region', { name: 'ORCA送信の要確認一覧' });
    await user.click(within(reviewRegion).getByRole('button', { name: 'ORCA状態を再照合' }));

    await waitFor(() => {
      expect(mockMutationCalls).toContainEqual({ transmissionId: 42 });
    });
    expect(mockMutationCalls[0]).not.toHaveProperty('patientId');
    expect(await screen.findByText(/再送を停止します/)).toBeInTheDocument();
    expect(mockMutationCalls[0]).not.toHaveProperty('facilityId');
    expect(mockMutationCalls[0]).not.toHaveProperty('insuranceCombinationNumber');
    expect(mockMutationCalls[0]).not.toHaveProperty('medicalUid');
    expect(within(reviewRegion).getByText(/再送を停止します/)).toBeInTheDocument();
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'warning',
        message: 'ORCA状態を再照合しました',
      }),
    );
    expect(reviewRegion).not.toHaveTextContent(/SECRET|rawResponseBody|insuranceCombinationNumber|medicalUid/i);
    expect(screen.queryByRole('button', { name: '会計送信' })).not.toBeInTheDocument();
    expect(vi.mocked(buildMedicalModV2RequestXml)).not.toHaveBeenCalled();
    expect(vi.mocked(postOrcaMedicalModV2Xml)).not.toHaveBeenCalled();
  });

  it('keeps transmission visible in cards layout without selecting the card', async () => {
    mockAppointmentData.entries = [createBillingEntry()];
    mockClaimSendCache = {
      'reception:R-501': {
        patientId: 'P-501',
        receptionId: 'R-501',
        sendStatus: 'success',
      },
    };
    mockSearchParams = new URLSearchParams('date=2026-01-29&receptionList=cards');

    renderReceptionPage();

    await userEvent.setup().click(screen.getByRole('tab', { name: /会計待ち/ }));
    const card = document.querySelector(
      '[data-test-id="reception-entry-card"][data-patient-id="P-501"][data-reception-status="会計待ち"]',
    );
    expect(card).not.toBeNull();
    expect(card).toHaveAttribute('role', 'listitem');
    expect(card).not.toHaveAttribute('role', 'button');
    expect(within(card as HTMLElement).getByText(/請求:\s*会計待ち/)).toBeInTheDocument();
    expect(within(card as HTMLElement).getByRole('button', { name: 'カルテを開く（カード）' })).toBeInTheDocument();
    expect(within(card as HTMLElement).getByRole('button', { name: 'カード操作を開く' })).toBeInTheDocument();
    const transmission = (card as HTMLElement).querySelector('[data-test-id="reception-billing-transmission"]');
    expect(transmission).not.toBeNull();
    expect(transmission).toHaveTextContent('送信: 送信済');
    const transmissionNote = (card as HTMLElement).querySelector('[data-test-id="reception-billing-transmission-note"]');
    expect(transmissionNote).not.toBeNull();
    expect(transmissionNote).toHaveTextContent(
      '送信済は会計済みではありません。収納確認まで会計待ちです。',
    );
    expect(within(card as HTMLElement).queryByText(/^請求:\s*会計済み$/)).not.toBeInTheDocument();
  });

  it('shows rebill note in a separate slot and projects the row into 再計待', async () => {
    mockAppointmentData.entries = [createBillingEntry({ patientId: 'P-611', receptionId: 'R-611', name: '再計患者' })];
    mockClaimSendCache = {
      'reception:R-611': {
        patientId: 'P-611',
        receptionId: 'R-611',
        sendStatus: 'success',
        correctionKind: 'rebill',
        correctionReason: '会計済み後に変更があったため再会計が必要です。',
      },
    };

    renderReceptionPage();

    await userEvent.setup().click(screen.getByRole('tab', { name: /再計待/ }));
    const listRegion = screen.getByRole('region', { name: '受付一覧' });
    const row = within(listRegion).getByRole('row', { name: /再計患者/ });
    expect(within(row).getByText(/送信:\s*送信済/)).toBeInTheDocument();
    expect(within(row).getByText('送信済は会計済みではありません。収納確認まで会計待ちです。')).toBeInTheDocument();
    expect(within(row).getByText(/再計待: 会計済み後に変更があったため再会計が必要です。/)).toBeInTheDocument();
  });

  it('does not apply patient-only send cache to multiple rows of the same patient', async () => {
    mockAppointmentData.entries = [
      createBillingEntry({ id: 'row-701a', patientId: 'P-701', receptionId: 'R-701-A', name: '同一患者A', appointmentTime: '09:00' }),
      createBillingEntry({ id: 'row-701b', patientId: 'P-701', receptionId: 'R-701-B', name: '同一患者B', appointmentTime: '10:00' }),
    ];
    mockClaimSendCache = {
      'patient:P-701': {
        patientId: 'P-701',
        sendStatus: 'success',
      },
    };

    renderReceptionPage();
    await userEvent.setup().click(screen.getByRole('tab', { name: /会計待ち/ }));
    const listRegion = screen.getByRole('region', { name: '受付一覧' });
    const firstRow = within(listRegion).getByRole('row', { name: /同一患者A/ });
    const secondRow = within(listRegion).getByRole('row', { name: /同一患者B/ });

    expect(within(firstRow).getByText('送信: 未送信')).toBeInTheDocument();
    expect(within(secondRow).getByText('送信: 未送信')).toBeInTheDocument();
  });

  it.each([
    {
      title: 'fallbackUsed=true では会計送信を fail-close する',
      claimFallbackUsed: true,
      entry: createBillingEntry({ name: 'fallback患者' }),
      reason: /fallbackUsed=true です。受付一覧を再取得し、official visit row の canonical field が揃うと送信できます。/,
    },
    {
      title: 'physicianCode 欠落では会計送信を fail-close する',
      entry: createBillingEntry({ name: '担当医不足患者', physicianCode: undefined }),
      reason: /Physician_Code が不足しています。受付一覧を再取得し、official visit row の canonical field が揃うと送信できます。/,
    },
    {
      title: 'insuranceCombinationNumber 欠落では会計送信を fail-close する',
      entry: createBillingEntry({ name: '保険組合せ不足患者', insuranceCombinationNumber: undefined }),
      reason: /Insurance_Combination_Number が不足しています。受付一覧を再取得し、official visit row の canonical field が揃うと送信できます。/,
    },
    {
      title: 'voucherNumber 欠落では会計送信を fail-close する',
      entry: createBillingEntry({ name: '伝票番号不足患者', voucherNumber: undefined }),
      reason: /Voucher_Number が不足しています。受付一覧を再取得し、official visit row の canonical field が揃うと送信できます。/,
    },
    {
      title: 'sequentialNumber 欠落では会計送信を fail-close する',
      entry: createBillingEntry({ name: '受付連番不足患者', sequentialNumber: undefined }),
      reason: /Sequential_Number が不足しています。受付一覧を再取得し、official visit row の canonical field が揃うと送信できます。/,
    },
    {
      title: 'visitDate 欠落では selectedDate があっても会計送信を fail-close する',
      searchParams: new URLSearchParams('date=2026-02-03'),
      locationState: { visitDate: '2026-02-03' },
      entry: createBillingEntry({ name: '診療日不足患者', visitDate: undefined }),
      reason: /Perform_Date が不足しています。受付一覧を再取得し、official visit row の canonical field が揃うと送信できます。/,
    },
  ])('$title', async ({ claimFallbackUsed, entry, locationState, reason, searchParams }) => {
    mockClaimData.fallbackUsed = false;
    mockAppointmentData.fallbackUsed = claimFallbackUsed ?? false;
    mockAppointmentData.entries = [entry];
    mockLocationState = locationState;
    mockSearchParams = searchParams ?? new URLSearchParams();

    const user = userEvent.setup();
    renderReceptionPage();

    await user.click(screen.getByRole('tab', { name: /会計待ち/ }));
    const listRegion = screen.getByRole('region', { name: '受付一覧' });
    const row = within(listRegion).getByRole('row', { name: new RegExp(entry.name ?? '') });
    expect(within(row).queryByRole('button', { name: '会計送信' })).not.toBeInTheDocument();
    expect(within(row).getByText('初回送信は医師画面で実行')).toBeInTheDocument();
    expect(reason.test(row.textContent ?? '')).toBe(false);
    expect(vi.mocked(buildMedicalModV2RequestXml)).not.toHaveBeenCalled();
    expect(vi.mocked(postOrcaMedicalModV2Xml)).not.toHaveBeenCalled();
  });

  it('row double click は canonical key が無い場合に charts navigation を block する', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-open-blocked',
        patientId: 'P-700',
        receptionId: 'R-700',
        name: 'ダブルクリック患者',
        appointmentTime: '09:30',
        department: '01 内科',
        physician: '10001 主治医',
        status: '受付中',
        insurance: '保険',
        source: 'visits',
      },
    ];

    const user = userEvent.setup();
    renderReceptionPage();

    const listRegion = screen.getByRole('region', { name: '受付一覧' });
    const row = within(listRegion).getByRole('row', { name: /ダブルクリック患者/ });
    await user.dblClick(row);

    expect(mockOpenCharts).not.toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'warning',
        message: 'カルテを開くための canonical key が未設定です。',
      }),
    );
  });
});

describe('ReceptionPage realtime sync', () => {
  it('invalidates appointment queries when realtime update arrives', async () => {
    class MockEventSource {
      static instances: MockEventSource[] = [];
      onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
      onmessage: ((this: EventSource, ev: MessageEvent<string>) => unknown) | null = null;
      onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
      private listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>();

      constructor(_url: string, _init?: EventSourceInit) {
        MockEventSource.instances.push(this);
      }

      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (typeof listener !== 'function') return;
        const list = this.listeners.get(type) ?? [];
        list.push(listener as (event: MessageEvent<string>) => void);
        this.listeners.set(type, list);
      }

      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (typeof listener !== 'function') return;
        const list = this.listeners.get(type);
        if (!list) return;
        this.listeners.set(
          type,
          list.filter((candidate) => candidate !== listener),
        );
      }

      close() {
        // no-op
      }

      emit(type: string, data: string) {
        const event = new MessageEvent<string>(type, { data, lastEventId: '11' });
        const list = this.listeners.get(type) ?? [];
        list.forEach((listener) => listener(event));
      }
    }

    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
    vi.stubGlobal('fetch', undefined);

    renderReceptionPage();

    await waitFor(() => expect(MockEventSource.instances.length).toBeGreaterThan(0));
    const source = MockEventSource.instances.at(-1)!;
    source.emit(
      'reception.updated',
      JSON.stringify({
        type: 'reception.updated',
        patientId: 'P-001',
      }),
    );

    await waitFor(() =>
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['outpatient-appointments'],
      }),
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['orca-queue'],
    });
  });
});
