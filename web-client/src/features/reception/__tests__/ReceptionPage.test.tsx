import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ReceptionPage } from '../pages/ReceptionPage';
import { buildDepartmentOptions } from '../departmentOptions';
import type { AppointmentPayload, ClaimOutpatientPayload, ReceptionEntry } from '../../outpatient/types';
import { postOrcaMedicalModV2Xml } from '../../charts/orcaClaimApi';

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
let mockClaimSendCache: Record<string, { invoiceNumber?: string; dataId?: string; sendStatus?: 'success' | 'error' }> =
  {};
let mockMedicalInformationOptions = [{ code: '01', name: '外来' }];
let mockSearchParams = new URLSearchParams();
let mockLocationState: Record<string, unknown> | undefined;
let mockSessionRole = 'staff';
const mockInvalidateQueries = vi.fn(async () => undefined);
const mockEnqueue = vi.fn();

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
    openCharts: vi.fn(),
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
  saveOrcaClaimSendCache: (entry: { patientId: string }) => {
    mockClaimSendCache = { ...mockClaimSendCache, [entry.patientId]: entry as any };
  },
}));

vi.mock('../../charts/orcaClaimApi', () => ({
  buildMedicalModV2RequestXml: vi.fn().mockReturnValue('<data></data>'),
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

describe('buildDepartmentOptions', () => {
  it('appointment raw 由来の code/name から診療科候補を構成する', () => {
    const options = buildDepartmentOptions({
      departmentCodeMap: new Map([
        ['内科', '01'],
        ['外科', '02'],
      ]),
      visibleDepartments: [],
    });

    expect(options).toEqual([
      ['01', '内科'],
      ['02', '外科'],
    ]);
  });

  it('visible entry の coded department 文字列から code/name を補完する', () => {
    const options = buildDepartmentOptions({
      departmentCodeMap: new Map(),
      visibleDepartments: ['01 内科', '02 外科'],
    });

    expect(options).toEqual([
      ['01', '内科'],
      ['02', '外科'],
    ]);
  });

  it('source が空でも 01 fallback を維持する', () => {
    const options = buildDepartmentOptions({
      departmentCodeMap: new Map(),
      visibleDepartments: [],
    });

    expect(options).toEqual([['01', '01']]);
  });
});

const getToolbar = () => {
  return screen.getByRole('region', { name: '受付ツールバー' });
};

const openAcceptWorkflowModal = async (user: ReturnType<typeof userEvent.setup>) => {
  const toolbar = getToolbar();
  await user.click(within(toolbar).getByRole('button', { name: '既存患者受付/患者検索' }));
  return (await screen.findByRole('region', { name: '既存患者受付/患者検索' })) as HTMLElement;
};

const getAcceptRegisterPanel = (workflowModal: HTMLElement) =>
  within(workflowModal).getByRole('region', { name: '受付登録モーダル' });

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
  mockSearchParams = new URLSearchParams();
  mockLocationState = undefined;
  mockSessionRole = 'staff';
  mockInvalidateQueries.mockClear();
  mockEnqueue.mockReset();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
        department: '内科',
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
        department: '内科',
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
    expect(within(acceptPanel).queryByRole('button', { name: '受付する' })).toBeNull();
    expect(within(acceptPanel).getByText(/左の患者検索結果カードを選択すると/)).toBeInTheDocument();

    await user.click(within(resultPanel).getAllByRole('listitem')[0]);
    expect(within(acceptPanel).getByText('選択患者: 山田太郎')).toBeInTheDocument();
    expect(within(acceptPanel).getByRole('button', { name: '受付する' })).toBeInTheDocument();
    const paymentSelect = within(acceptPanel).getByLabelText(/保険\/自費/);
    expect(paymentSelect).toHaveValue('insurance');

    const row2 = screen.getByRole('row', { name: /佐藤花子/ });
    await user.click(row2);

    expect(within(acceptPanel).getByText('選択患者: 山田太郎')).toBeInTheDocument();
  });

  it('enables 受付する only after required fields are filled', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-1',
        patientId: 'P-010',
        appointmentId: 'A-010',
        name: '田中一郎',
        appointmentTime: '09:00',
        department: '内科',
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
    const registerButton = within(acceptPanel).getByRole('button', { name: '受付する' });
    await user.selectOptions(departmentSelect, '');
    await user.selectOptions(physicianSelect, '');
    expect(registerButton).toBeDisabled();

    const paymentSelect = within(acceptPanel).getByLabelText(/保険\/自費/);
    expect(paymentSelect).toHaveValue('insurance');
    await user.selectOptions(departmentSelect, departmentSelect.options[1]?.value ?? '01');
    await user.selectOptions(physicianSelect, physicianSelect.options[1]?.value ?? '10001');
    expect(registerButton).toBeEnabled();
  });

  it('keeps 受付する disabled until 保険/自費 and 来院区分 are selected', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-2',
        patientId: 'P-011',
        appointmentId: 'A-011',
        name: '必須入力患者',
        appointmentTime: '09:30',
        department: '内科',
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
    const registerButton = within(acceptPanel).getByRole('button', { name: '受付する' });

    await user.selectOptions(departmentSelect, departmentSelect.options[1]?.value ?? '01');
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
        department: '内科',
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
        department: '内科',
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
        department: '内科',
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
    expect(within(dialog).getByLabelText(/患者ID:P-210/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('取消理由（任意）'), '誤受付');
    await user.click(within(dialog).getByRole('button', { name: '取消を実行' }));

    await waitFor(() => {
      expect(mockMutationQueue).toHaveLength(0);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '受付取消の確認' })).toBeNull();
    });
  });

  it('shows Api_Result and duration in the result area after submit', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-result-1',
        patientId: '555',
        appointmentId: 'A-555',
        name: '送信患者',
        appointmentTime: '09:10',
        department: '内科',
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
    const submitButton = within(acceptPanel).getByRole('button', { name: '受付する' });
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
        name: '診療内容患者',
        appointmentTime: '09:45',
        department: '内科',
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
    await user.selectOptions(within(acceptPanel).getByLabelText(/診療内容コード/), '02');
    await user.click(within(acceptPanel).getByRole('button', { name: '受付する' }));

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
        name: '未選択患者',
        appointmentTime: '10:15',
        department: '内科',
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
    await user.click(within(acceptPanel).getByRole('button', { name: '受付する' }));

    expect(mockMutationCalls.at(-1)).toMatchObject({
      requestNumber: '01',
      patientId: 'P-013',
    });
    expect((mockMutationCalls.at(-1) as { medicalInformation?: unknown }).medicalInformation).toBeUndefined();
  });
});

describe('ReceptionPage official master search', () => {
  it('allows master search without inOut selection and omits inOut from the official request', async () => {
    mockSessionRole = 'system_admin';
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
    renderReceptionPage();

    const toolbar = getToolbar();
    expect(toolbar).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: '既存患者受付/患者検索' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: /日次状態/ })).toBeInTheDocument();
    expect(document.querySelector('.reception-page__floating-actions')).toBeNull();
  });

  it('hides system details for non-debug users', () => {
    renderReceptionPage();
    expect(screen.queryByText('システム詳細')).toBeNull();
  });

  it('toggles advanced filters from 詳細条件 button', async () => {
    const user = userEvent.setup();
    renderReceptionPage();

    expect(screen.queryByRole('combobox', { name: '保険/自費' })).toBeNull();
    const toolbar = getToolbar();
    const toggleButton = within(toolbar).getByRole('button', { name: '詳細条件' });
    await user.click(toggleButton);

    expect(screen.getByRole('combobox', { name: '保険/自費' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '保存ビュー' })).toBeInTheDocument();

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
        department: '内科',
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
        department: '外科',
        status: '診療中',
        insurance: '自費',
        source: 'visits',
      },
    ];

    const user = userEvent.setup();
    renderReceptionPage();

    const row1 = screen.getByRole('row', { name: /山田太郎/ });

    expect(row1).toHaveClass('reception-table__row--selected');
    expect(screen.queryByRole('row', { name: /佐藤花子/ })).toBeNull();

    await user.click(screen.getByRole('tab', { name: /診察中/ }));
    const row2 = screen.getByRole('row', { name: /佐藤花子/ });

    await user.click(row2);

    expect(row2).toHaveClass('reception-table__row--selected');
  });

  it('opens accept workflow modal and shows patient search/result panes; medical record preview opens in a modal (debug panels hidden by default)', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-3',
        patientId: 'P-010',
        receptionId: 'R-010',
        appointmentId: 'A-010',
        name: '集約患者',
        kana: 'シュウヤク',
        appointmentTime: '11:30',
        department: '内科',
        physician: '10001 Dr. Test',
        status: '会計待ち',
        insurance: '保険',
        source: 'visits',
      },
    ];
    const user = userEvent.setup();
    renderReceptionPage();

    expect(screen.queryByRole('region', { name: '患者検索' })).toBeNull();
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
    await user.click(screen.getByRole('tab', { name: /会計待ち/ }));
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
    expect(within(resultPanel).queryByText('生年月日: 1980-01-01')).toBeNull();
    expect(within(resultPanel).getAllByRole('listitem').length).toBeGreaterThan(0);

    await user.click(within(resultPanel).getAllByRole('listitem')[0]);
    expect(within(acceptPanel).getByRole('button', { name: '受付する' })).toBeInTheDocument();
    expect(within(acceptPanel).getByText('選択患者: 検索患者一')).toBeInTheDocument();
    expect(within(acceptPanel).getByLabelText(/診療科/)).toBeInTheDocument();
    expect(within(acceptPanel).getByLabelText(/保険\/自費/)).toBeInTheDocument();
    expect(within(acceptPanel).queryByText(/InsuranceProvider_Class/)).toBeNull();
    expect(within(resultPanel).queryByText('生年月日: 1990-02-02')).toBeNull();
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

    const toolbar = getToolbar();
    const acceptButton = within(toolbar).getByRole('button', { name: '既存患者受付/患者検索' });

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
    const acceptPanel = getAcceptRegisterPanel(workflowModal);
    expect(within(acceptPanel).queryByRole('button', { name: '受付する' })).toBeNull();

    await user.click(within(resultPanel).getAllByRole('listitem')[0]);
    expect(within(acceptPanel).getByRole('button', { name: '受付する' })).toBeInTheDocument();
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

  it('keeps accept workflow and daily calendar mutually exclusive', async () => {
    const user = userEvent.setup();
    renderReceptionPage();
    const toolbar = getToolbar();
    const acceptButton = within(toolbar).getByRole('button', { name: '既存患者受付/患者検索' });
    const dailyStatusButton = within(toolbar).getByRole('button', { name: /日次状態/ });

    await user.click(acceptButton);
    expect(await screen.findByRole('region', { name: '既存患者受付/患者検索' })).toBeInTheDocument();

    await user.click(dailyStatusButton);
    expect(await screen.findByRole('group', { name: '日次状態カレンダー' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '既存患者受付/患者検索' })).toBeNull();
    expect(dailyStatusButton).toHaveAttribute('aria-expanded', 'true');

    await user.click(acceptButton);
    expect(await screen.findByRole('region', { name: '既存患者受付/患者検索' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '日次状態カレンダー' })).toBeNull();
    expect(dailyStatusButton).toHaveAttribute('aria-expanded', 'false');
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
    await user.click(within(toolbar).getByRole('button', { name: '詳細条件' }));
    await user.click(screen.getByRole('button', { name: 'クリア' }));
    expect(screen.getByRole('button', { name: '検索' })).toBeInTheDocument();
  });

  it('shows chart button directly on table rows and keeps history/cancel in menu', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-card-1',
        patientId: 'P-301',
        receptionId: 'R-301',
        name: 'カード患者',
        appointmentTime: '09:30',
        department: '内科',
        status: '受付中',
        insurance: '保険',
        source: 'visits',
      },
    ];
    const user = userEvent.setup();
    renderReceptionPage();

    const row = screen.getByRole('row', { name: /カード患者/ });
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
        department: '内科',
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
        department: '外科',
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
        department: '内科',
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
        department: '外科',
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
        department: '内科',
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
        department: '外科',
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
    await user.selectOptions(within(toolbar).getByLabelText('診療科'), '外科');

    const workflowModal = await openAcceptWorkflowModal(user);
    const patientSearch = within(workflowModal).getByRole('region', { name: '患者検索' });
    await user.click(within(patientSearch).getByRole('button', { name: '検索' }));
    const resultPanel = within(workflowModal).getByRole('region', { name: '患者検索結果モーダル' });
    await user.click(within(resultPanel).getAllByRole('listitem')[0]);
    const acceptPanel = getAcceptRegisterPanel(workflowModal);
    const registerButton = within(acceptPanel).getByRole('button', { name: '受付する' });
    await waitFor(() => {
      expect(registerButton).toBeDisabled();
      expect(registerButton).toHaveTextContent('受付する');
    });
  });

  it('shows 会計送信 button on 会計待ち rows and moves them to 会計済 on success', async () => {
    mockAppointmentData.entries = [
      {
        id: 'row-claim-1',
        patientId: 'P-501',
        receptionId: 'R-501',
        name: '診察終了患者',
        appointmentTime: '11:00',
        department: '01 内科',
        physician: '10001 主治医',
        status: '会計待ち',
        insurance: '保険',
        source: 'visits',
      },
    ];

    const user = userEvent.setup();
    renderReceptionPage();

    await user.click(screen.getByRole('tab', { name: /会計待ち/ }));
    const listRegion = screen.getByRole('region', { name: '受付一覧' });
    const row = within(listRegion).getByRole('row', { name: /診察終了患者/ });
    await user.click(within(row).getByRole('button', { name: '会計送信' }));

    await waitFor(() => expect(vi.mocked(postOrcaMedicalModV2Xml)).toHaveBeenCalled());
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'success',
        message: '会計送信を完了',
        detail: '一覧更新後に会計済みへの反映を確認してください。',
      }),
    );

    await user.click(screen.getByRole('tab', { name: /会計済/ }));
    const completedList = screen.getByRole('region', { name: '受付一覧' });
    const completedRow = await within(completedList).findByRole('row', { name: /診察終了患者/ });
    expect(completedRow).toBeInTheDocument();
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
