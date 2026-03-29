import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { clearAuditEventLog, logAuditEvent } from '../../../libs/audit/auditLogger';

type MockQueryData = {
  patients: Array<Record<string, any>>;
  memos?: Array<{ memo?: string }>;
  runId?: string;
  cacheHit?: boolean;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  dataSourceTransition?: string;
  recordsReturned?: number;
  status?: number;
  error?: string;
  fetchedAt?: string;
  sourcePath?: string;
  auditEvent?: Record<string, unknown>;
  apiResult?: string;
  apiResultMessage?: string;
  missingTags?: string[];
};

let mockQueryData: MockQueryData = {
  patients: [],
  memos: [],
  runId: 'RUN-PATIENTS',
  cacheHit: false,
  missingMaster: false,
  fallbackUsed: false,
  dataSourceTransition: 'server',
  recordsReturned: 0,
};

let mockMutationResult: any = null;
let mockMutationError: any = null;
let mockMutationPending = false;
let mockMutationCallCount = 0;
let mockSearchParams = new URLSearchParams();
let mockLocationSearch = '';
let mockLocationState: unknown = null;
const mockEnqueue = vi.fn();
const mockFetchOrcaAddress = vi.fn();
const mockFetchOrcaHokenja = vi.fn();
const mockSetSearchParams = vi.fn();
const mockRegisterDirty = vi.fn();
const mockGuardedNavigate = vi.fn();

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

vi.mock('../../charts/authService', () => ({
  applyAuthServicePatch: (patch: any, previous: any) => ({ ...previous, ...patch }),
  useAuthService: () => ({
    flags: mockAuthFlags,
    ...mockAuthActions,
  }),
}));

vi.mock('@emotion/react', () => ({
  Global: () => null,
  css: () => '',
}));

vi.mock('../../../libs/audit/auditLogger', () => {
  const auditLog: any[] = [];
  return {
    clearAuditEventLog: () => {
      auditLog.length = 0;
    },
    getAuditEventLog: () => [...auditLog],
    logAuditEvent: (entry: any) => {
      const record = { ...entry, timestamp: new Date().toISOString() };
      auditLog.push(record);
      return record;
    },
    logUiState: () => ({ timestamp: new Date().toISOString() }),
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mockQueryData,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  }),
  useMutation: (options?: { onSuccess?: (data: any) => void; onError?: (error: any) => void }) => ({
    mutate: vi.fn(() => {
      mockMutationCallCount += 1;
      if (mockMutationError && options?.onError) {
        options.onError(mockMutationError);
        return;
      }
      if (mockMutationResult && options?.onSuccess) {
        options.onSuccess(mockMutationResult);
      }
    }),
    mutateAsync: vi.fn(async () => {
      mockMutationCallCount += 1;
      if (mockMutationError && options?.onError) {
        options.onError(mockMutationError);
        throw mockMutationError;
      }
      if (mockMutationResult && options?.onSuccess) {
        options.onSuccess(mockMutationResult);
        return mockMutationResult;
      }
      return { ok: true };
    }),
    isPending: mockMutationPending,
  }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    Link: ({ children, to, ...props }: { children: ReactNode; to: string | { pathname?: string }; [key: string]: unknown }) => {
      const href = typeof to === 'string' ? to : (to.pathname ?? '');
      return <a href={href} {...props}>{children}</a>;
    },
    MemoryRouter: ({ children }: { children: any }) => children,
    useLocation: () => ({ pathname: '/f/FAC-TEST/patients', search: mockLocationSearch, state: mockLocationState }),
    useNavigate: () => vi.fn(),
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

vi.mock('../../../libs/admin/useAdminBroadcast', () => ({
  useAdminBroadcast: () => ({ broadcast: null }),
}));

vi.mock('../../../libs/ui/appToast', () => ({
  useAppToast: () => ({ enqueue: mockEnqueue, dismiss: vi.fn() }),
}));

vi.mock('../orcaAddressApi', () => ({
  fetchOrcaAddress: (...args: unknown[]) => mockFetchOrcaAddress(...args),
}));

vi.mock('../orcaHokenjaApi', () => ({
  fetchOrcaHokenja: (...args: unknown[]) => mockFetchOrcaHokenja(...args),
}));

vi.mock('../../../AppRouter', () => ({
  useSession: () => ({ facilityId: 'FAC-TEST', runId: 'RUN-SESSION' }),
}));

vi.mock('../../../routes/NavigationGuardProvider', () => ({
  NavigationGuardProvider: ({ children }: { children: any }) => children,
  useNavigationGuard: () => ({
    registerDirty: mockRegisterDirty,
    isDirty: false,
    dirtySources: [],
    guardedNavigate: mockGuardedNavigate,
  }),
}));

vi.mock('../../../routes/useAppNavigation', () => ({
  useAppNavigation: () => {
    const from = mockSearchParams.get('from') ?? null;
    const returnTo = mockSearchParams.get('returnTo') ?? null;
    const safeReturnTo = (() => {
      if (!returnTo || returnTo.startsWith('http') || !returnTo.startsWith('/f/')) return null;
      const [pathname, rawSearch = ''] = returnTo.split('?');
      if (!rawSearch) return pathname;
      const params = new URLSearchParams(rawSearch);
      ['patientId', 'appointmentId', 'receptionId', 'scheduleKey', 'encounterKey', 'visitDate', 'invoiceNumber', 'kw', 'keyword']
        .forEach((key) => params.delete(key));
      const scrubbedSearch = params.toString();
      return scrubbedSearch ? `${pathname}?${scrubbedSearch}` : pathname;
    })();
    return {
      currentUrl: '/f/FAC-TEST/patients',
      currentScreen: 'patients',
      fromCandidate: from,
      returnToCandidate: returnTo,
      safeReturnToCandidate: safeReturnTo,
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
    };
  },
}));

type PatientsPageType = typeof import('../PatientsPage').PatientsPage;
let PatientsPage: PatientsPageType;

beforeAll(async () => {
  ({ PatientsPage } = await import('../PatientsPage'));
});

afterAll(() => {
  PatientsPage = undefined as unknown as PatientsPageType;
});

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockMutationResult = null;
  mockMutationError = null;
  mockMutationPending = false;
  mockMutationCallCount = 0;
  setRouterSearch('');
  mockLocationState = null;
  mockSetSearchParams.mockClear();
  mockRegisterDirty.mockClear();
  mockGuardedNavigate.mockClear();
  mockEnqueue.mockReset();
  mockFetchOrcaAddress.mockReset();
  mockFetchOrcaHokenja.mockReset();
});

const renderPatientsPage = () => {
  render(
    <MemoryRouter initialEntries={['/patients']}>
      <PatientsPage runId="RUN-INIT" />
    </MemoryRouter>,
  );
  screen.getByRole('list', { name: '患者一覧' });
};

const setRouterSearch = (search: string) => {
  mockLocationSearch = search;
  mockSearchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
};

const setRouterState = (state: unknown) => {
  mockLocationState = state;
};

const clickPatientRowByName = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const row = screen.getByText(name).closest('button');
  expect(row).not.toBeNull();
  if (!row) return;
  await user.click(row);
};

const addAuditEvent = (timestamp: string, entry: Parameters<typeof logAuditEvent>[0]) => {
  const record = logAuditEvent(entry);
  record.timestamp = timestamp;
  return record;
};

const mockPatients = (overrides?: Partial<MockQueryData>) => {
  mockQueryData = {
    patients: [
      {
        patientId: 'P-001',
        name: '山田 花子',
        kana: 'ヤマダ ハナコ',
        birthDate: '1980-01-01',
      },
    ],
    memos: [],
    runId: 'RUN-PATIENTS',
    cacheHit: false,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server',
    recordsReturned: 1,
    ...overrides,
  };
};

describe('PatientsPage audit filters', () => {
  beforeEach(() => {
    clearAuditEventLog();
    localStorage.clear();
    sessionStorage.clear();
    mockAuthFlags.missingMaster = false;
    mockAuthFlags.fallbackUsed = false;
  });

  afterEach(() => {
    clearAuditEventLog();
  });

  it('keyword/outcome は全角混在と大文字小文字を正規化して一致する', async () => {
    mockPatients();
    addAuditEvent('2025-12-01T10:00:00.000Z', {
      source: 'patient-save',
      patientId: 'P-001',
      payload: {
        action: 'PATIENT_UPDATE',
        outcome: 'SUCCESS',
        details: { patientId: 'P-001', message: 'updated', requestId: 'REQ-1' },
      },
    });
    addAuditEvent('2025-12-02T10:00:00.000Z', {
      source: 'patient-save',
      patientId: 'P-001',
      payload: {
        action: 'PATIENT_DELETE',
        outcome: 'ERROR',
        details: { patientId: 'P-001', message: 'deleted', requestId: 'REQ-2' },
      },
    });

    renderPatientsPage();
    expect(screen.getByText('対象件数: 2')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: '監査/ログ' }));

    const auditGroup = screen.getByRole('group', { name: '監査検索' });
    const keywordInput = within(auditGroup).getByLabelText('キーワード');
    await user.type(keywordInput, 'Ｐ－００１');
    const outcomeSelect = within(auditGroup).getByLabelText('outcome');
    await user.selectOptions(outcomeSelect, 'success');

    expect(screen.getByText('対象件数: 1')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: '保存履歴' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('date/limit フィルタと無効範囲エラーを反映する', async () => {
    mockPatients();
    const base = new Date('2025-12-01T00:00:00Z');
    for (let i = 0; i < 12; i += 1) {
      addAuditEvent(new Date(base.getTime() + i * 24 * 60 * 60 * 1000).toISOString(), {
        source: 'patient-save',
        patientId: 'P-001',
        payload: {
          action: 'PATIENT_UPDATE',
          outcome: 'SUCCESS',
          details: { patientId: 'P-001', message: `log-${i}` },
        },
      });
    }

    renderPatientsPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: '監査/ログ' }));

    const list = screen.getByRole('list', { name: '保存履歴' });
    expect(await screen.findByText('対象件数: 12')).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);

    const auditGroup = screen.getByRole('group', { name: '監査検索' });
    const dateFrom = within(auditGroup).getByLabelText('開始日');
    const dateTo = within(auditGroup).getByLabelText('終了日');
    await user.clear(dateFrom);
    await user.type(dateFrom, '2025-12-03');
    await user.clear(dateTo);
    await user.type(dateTo, '2025-12-03');

    expect(screen.getByText('対象件数: 1')).toBeInTheDocument();

    await user.clear(dateFrom);
    await user.type(dateFrom, '2025-12-10');
    await user.clear(dateTo);
    await user.type(dateTo, '2025-12-05');

    expect(screen.getByText('開始日 (2025-12-10) が終了日 (2025-12-05) より後です。')).toBeInTheDocument();
  });
});

describe('PatientsPage legacy ORCA tabs', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('ORCA 原本/保険/メモの補助タブを表示しない', async () => {
    mockPatients();
    renderPatientsPage();
    const user = userEvent.setup();
    await clickPatientRowByName(user, '山田 花子');
    expect(screen.queryByRole('tab', { name: 'ORCA更新/原本' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '保険' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'ORCAメモ' })).not.toBeInTheDocument();
  });
});

describe('PatientsPage initial selection', () => {
  beforeEach(() => {
    clearAuditEventLog();
    localStorage.clear();
    sessionStorage.clear();
    mockAuthFlags.missingMaster = false;
    mockAuthFlags.fallbackUsed = false;
  });

  it('patientId 文脈がない場合は未選択で開始する', () => {
    mockPatients();
    setRouterSearch('');
    renderPatientsPage();

    expect(screen.getByText('患者を選択してください。')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '患者未選択' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /山田 花子/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('legacy intent パラメータは無視して現行タブ構成を維持する', () => {
    mockPatients();
    setRouterSearch('?intent=insurance');
    renderPatientsPage();

    expect(screen.getByRole('tab', { name: '基本情報' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: '保険' })).not.toBeInTheDocument();
  });

  it('location state の patientId と一致する患者を自動選択する', () => {
    mockPatients();
    setRouterState({ patientId: 'P-001' });
    renderPatientsPage();

    expect(screen.getByRole('heading', { name: /ORCA患者番号（Patient_ID） P-001/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /山田 花子/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('location state の patientId が不一致の場合は警告を表示して未選択を維持する', async () => {
    mockPatients();
    setRouterState({ patientId: 'P-999' });
    renderPatientsPage();

    expect(await screen.findByText(/指定患者が見つかりません/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '患者未選択' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /山田 花子/ })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('PatientsPage unlinked warnings', () => {
  beforeEach(() => {
    clearAuditEventLog();
    localStorage.clear();
    sessionStorage.clear();
    mockAuthFlags.missingMaster = false;
    mockAuthFlags.fallbackUsed = false;
  });

  afterEach(() => {
    clearAuditEventLog();
  });

  it('未紐付警告を一覧と詳細で表示する', async () => {
    mockAuthFlags.missingMaster = false;
    mockAuthFlags.fallbackUsed = false;
    mockPatients({
      patients: [
        { patientId: '', name: '', kana: '', birthDate: '1990-01-01' },
        { patientId: 'P-002', name: '鈴木 太郎', kana: 'スズキ タロウ' },
      ],
      recordsReturned: 2,
    });

    renderPatientsPage();
    await screen.findAllByText('患者ID欠損');

    await screen.findAllByText('未紐付警告');
    expect(screen.getAllByText('未紐付').length).toBeGreaterThan(0);
    expect(screen.getAllByText('患者ID欠損').length).toBeGreaterThan(0);
    expect(screen.getAllByText('氏名欠損').length).toBeGreaterThan(0);
  });

  it('missingMaster 時は反映停止注意として表示する', async () => {
    mockAuthFlags.missingMaster = true;
    mockAuthFlags.fallbackUsed = false;
    mockPatients({
      patients: [{ patientId: '', name: '', kana: '', birthDate: '1990-01-01' }],
      missingMaster: true,
      recordsReturned: 1,
    });

    renderPatientsPage();
    await screen.findAllByText('患者ID欠損');

    await screen.findAllByText('反映停止注意');
    expect(screen.getAllByText('反映停止').length).toBeGreaterThan(0);
    expect(screen.getByText('復旧導線（再取得 → Reception → 管理者共有）')).toBeTruthy();
    expect(screen.getByRole('button', { name: '管理者共有（管理者共有）' })).toBeTruthy();
  });
});

describe('PatientsPage audit changedKeys', () => {
  beforeEach(() => {
    clearAuditEventLog();
    localStorage.clear();
    sessionStorage.clear();
    mockAuthFlags.missingMaster = false;
    mockAuthFlags.fallbackUsed = false;
  });

  afterEach(() => {
    clearAuditEventLog();
  });

  it('changedKeys は上限5件で他n件表記', async () => {
    mockPatients();
    addAuditEvent('2025-12-01T10:00:00.000Z', {
      source: 'patient-save',
      patientId: 'P-001',
      payload: {
        action: 'PATIENT_UPDATE',
        outcome: 'SUCCESS',
        details: {
          patientId: 'P-001',
          changedKeys: ['name', 'kana', 'birthDate', 'sex', 'phone', 'zip', 'address'],
        },
      },
    });

    renderPatientsPage();
    await screen.findByText('対象件数: 1');

    expect(screen.getByText('changedKeys: name, kana, birthDate, sex, phone 他2件')).toBeInTheDocument();
  });
});

describe('PatientsPage switch guard', () => {
  beforeEach(() => {
    clearAuditEventLog();
    localStorage.clear();
    sessionStorage.clear();
    mockAuthFlags.missingMaster = false;
    mockAuthFlags.fallbackUsed = false;
  });

  it('未保存変更があると患者切替ダイアログを表示する', async () => {
    mockPatients({
      patients: [
        { patientId: 'P-001', name: '山田 花子', kana: 'ヤマダ ハナコ', birthDate: '1980-01-01' },
        { patientId: 'P-002', name: '佐藤 次郎', kana: 'サトウ ジロウ', birthDate: '1985-05-20' },
      ],
      recordsReturned: 2,
    });
    renderPatientsPage();
    const user = userEvent.setup();
    await clickPatientRowByName(user, '山田 花子');

    await user.click(screen.getByRole('tab', { name: '基本情報' }));
    const nameInput = screen.getByLabelText(/氏名/);
    await user.clear(nameInput);
    await user.type(nameInput, '山田 花子A');

    const target = screen.getByText('佐藤 次郎').closest('button');
    expect(target).not.toBeNull();
    if (!target) return;
    await user.click(target);

    expect(screen.getByText('未保存の変更があります')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(screen.queryByText('未保存の変更があります')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ORCA患者番号（Patient_ID） P-001/ })).toBeInTheDocument();
  });

  it('破棄して切り替えで次の患者へ移動する', async () => {
    mockPatients({
      patients: [
        { patientId: 'P-001', name: '山田 花子', kana: 'ヤマダ ハナコ', birthDate: '1980-01-01' },
        { patientId: 'P-002', name: '佐藤 次郎', kana: 'サトウ ジロウ', birthDate: '1985-05-20' },
      ],
      recordsReturned: 2,
    });
    renderPatientsPage();
    const user = userEvent.setup();
    await clickPatientRowByName(user, '山田 花子');

    await user.click(screen.getByRole('tab', { name: '基本情報' }));
    const nameInput = screen.getByLabelText(/氏名/);
    await user.type(nameInput, 'A');

    const target = screen.getByText('佐藤 次郎').closest('button');
    expect(target).not.toBeNull();
    if (!target) return;
    await user.click(target);

    await user.click(screen.getByRole('button', { name: '破棄して切り替え' }));
    expect(screen.getByRole('heading', { name: /ORCA患者番号（Patient_ID） P-002/ })).toBeInTheDocument();
  });
});

describe('PatientsPage form safety', () => {
  beforeEach(() => {
    clearAuditEventLog();
    localStorage.clear();
    sessionStorage.clear();
    mockAuthFlags.missingMaster = false;
    mockAuthFlags.fallbackUsed = false;
  });

  it('非基本情報タブの Enter で患者保存 mutate が走らない', async () => {
    mockPatients();
    renderPatientsPage();
    const user = userEvent.setup();
    await clickPatientRowByName(user, '山田 花子');

    await user.click(screen.getByRole('tab', { name: '監査/ログ' }));
    const auditKeywordInput = document.getElementById('patients-audit-keyword');
    expect(auditKeywordInput).not.toBeNull();
    if (!auditKeywordInput) return;
    await user.type(auditKeywordInput, '{enter}');
    expect(mockMutationCallCount).toBe(0);
  });
});

describe('PatientsPage ORCA helpers', () => {
  it('郵便番号から住所補完できる', async () => {
    mockPatients({
      patients: [
        {
          patientId: 'P-001',
          name: '山田 花子',
          zip: '100-0001',
          address: '',
        },
      ],
    });
    mockFetchOrcaAddress.mockResolvedValue({
      ok: true,
      status: 200,
      item: {
        zip: '1000001',
        fullAddress: '東京都千代田区千代田',
      },
    });
    const user = userEvent.setup();

    renderPatientsPage();
    await clickPatientRowByName(user, '山田 花子');
    await user.click(screen.getByText('住所補完'));

    expect(mockFetchOrcaAddress).toHaveBeenCalledWith({ zip: '1000001', effective: expect.any(String) });
    expect(screen.getByDisplayValue('東京都千代田区千代田')).toBeInTheDocument();
  });

  it('保険 helper タブは表示しない', async () => {
    mockPatients();
    const user = userEvent.setup();

    renderPatientsPage();
    await clickPatientRowByName(user, '山田 花子');

    expect(screen.queryByRole('tab', { name: '保険' })).not.toBeInTheDocument();
    expect(mockFetchOrcaHokenja).not.toHaveBeenCalled();
  });
});

describe('PatientsPage detail tabs keyboard', () => {
  beforeEach(() => {
    clearAuditEventLog();
    localStorage.clear();
    sessionStorage.clear();
    mockAuthFlags.missingMaster = false;
    mockAuthFlags.fallbackUsed = false;
  });

  it('矢印キーと Home/End でタブを移動できる', async () => {
    mockPatients();
    renderPatientsPage();
    const user = userEvent.setup();

    const basicTab = screen.getByRole('tab', { name: '基本情報' });
    basicTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: '監査/ログ' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{End}');
    const auditTab = screen.getByRole('tab', { name: '監査/ログ' });
    expect(auditTab).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: '基本情報' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('PatientsPage return flow', () => {
  beforeEach(() => {
    clearAuditEventLog();
    localStorage.clear();
    sessionStorage.clear();
    mockAuthFlags.missingMaster = false;
    mockAuthFlags.fallbackUsed = false;
  });

  it('returnTo 指定がある場合は surface-aware な戻り導線を表示する', () => {
    mockPatients();
    setRouterSearch('?from=charts&returnTo=/f/FAC-TEST/charts?patientId=000001');

    renderPatientsPage();

    expect(screen.getByRole('region', { name: '戻り導線' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'カルテへ戻る' })).toHaveAttribute('href', '/f/FAC-TEST/charts');
    expect(screen.getByText('戻ったあとに必要な患者・受診を選び直してください。')).toBeInTheDocument();
    expect(mockGuardedNavigate).not.toHaveBeenCalled();
  });
});

describe('PatientsPage search summary', () => {
  beforeEach(() => {
    clearAuditEventLog();
    localStorage.clear();
    sessionStorage.clear();
    mockAuthFlags.missingMaster = false;
    mockAuthFlags.fallbackUsed = false;
  });

  it('検索サマリに recordsReturned / fetchedAt / Api_Result / missingTags を表示する', () => {
    mockPatients({
      recordsReturned: 5,
      fetchedAt: '2026-01-29T00:00:00Z',
      apiResult: '00',
      apiResultMessage: 'OK',
      missingTags: ['Patient_ID'],
      sourcePath: '/api/orca/patients/local-search',
    });

    renderPatientsPage();

    const summary = screen.getByText('検索結果').closest('.patients-sidebar__statusbar');
    expect(summary).not.toBeNull();
    if (!summary) return;
    const summaryScope = within(summary as HTMLElement);
    expect(summaryScope.getByText('5件')).toBeInTheDocument();
    const networkDetailsSummary = screen.getByText('通信詳細を表示');
    const networkDetails = networkDetailsSummary.closest('details');
    expect(networkDetails).not.toBeNull();
    if (!networkDetails) return;
    const networkScope = within(networkDetails);
    expect(networkScope.getByText('server fetchedAt: 2026-01-29T00:00:00Z')).toBeInTheDocument();
    expect(networkScope.getByText('Api_Result: 00')).toBeInTheDocument();
    expect(networkScope.getByText('不足タグ: Patient_ID')).toBeInTheDocument();
    expect(networkScope.queryByText(/Api_Result_Message:/)).not.toBeInTheDocument();
    expect(networkScope.queryByText('OK')).not.toBeInTheDocument();
  });

  it('API failure 時も raw Api_Result_Message を通信詳細へ表示しない', () => {
    mockQueryData = {
      patients: [],
      memos: [],
      runId: 'RUN-PATIENTS',
      recordsReturned: 0,
      status: 500,
      apiResult: 'E90',
      apiResultMessage: 'java.lang.IllegalStateException: backend exploded',
      missingTags: [],
    };

    renderPatientsPage();

    const errorBanner = screen
      .getAllByRole('alert')
      .find((element) => element.textContent?.includes('患者情報の取得に失敗しました。'));
    expect(errorBanner).toBeDefined();
    expect(errorBanner).toHaveTextContent('患者情報の取得に失敗しました。');
    expect(errorBanner).toHaveTextContent('サーバー側で障害が発生しています。');
    expect(screen.queryByText(/java\.lang\.IllegalStateException/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Api_Result_Message:/)).not.toBeInTheDocument();
  });
});

describe('PatientsPage splitter resize', () => {
  beforeEach(() => {
    clearAuditEventLog();
    localStorage.clear();
    sessionStorage.clear();
    mockAuthFlags.missingMaster = false;
    mockAuthFlags.fallbackUsed = false;
  });

  it('ArrowLeft/ArrowRight/Home/End で幅を調整し localStorage に保存する', async () => {
    mockPatients();
    renderPatientsPage();
    const user = userEvent.setup();
    const splitter = screen.getByRole('separator', { name: '患者一覧ペインの幅' });

    splitter.focus();
    await user.keyboard('{ArrowRight}');
    expect(splitter).toHaveAttribute('aria-valuenow', '396');
    expect(localStorage.getItem('opendolphin:web-client:patients:sidebarWidth:v1')).toBe('396');

    await user.keyboard('{ArrowLeft}');
    expect(splitter).toHaveAttribute('aria-valuenow', '380');
    expect(localStorage.getItem('opendolphin:web-client:patients:sidebarWidth:v1')).toBe('380');

    await user.keyboard('{End}');
    expect(splitter).toHaveAttribute('aria-valuenow', '520');
    expect(localStorage.getItem('opendolphin:web-client:patients:sidebarWidth:v1')).toBe('520');

    await user.keyboard('{Home}');
    expect(splitter).toHaveAttribute('aria-valuenow', '320');
    expect(localStorage.getItem('opendolphin:web-client:patients:sidebarWidth:v1')).toBe('320');
  });

  it('保存済み幅を初期値として読み込む', () => {
    localStorage.setItem('opendolphin:web-client:patients:sidebarWidth:v1', '510');
    mockPatients();
    renderPatientsPage();

    expect(screen.getByRole('separator', { name: '患者一覧ペインの幅' })).toHaveAttribute('aria-valuenow', '510');
  });
});
