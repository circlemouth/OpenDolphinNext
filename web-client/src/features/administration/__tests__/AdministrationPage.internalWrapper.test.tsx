import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

import { AdministrationPage } from '../AdministrationPage';

const {
  mockFetchAdminConfig,
  mockFetchOrcaQueue,
  mockFetchOrcaConnectionConfig,
  mockFetchOrcaCapabilities,
} = vi.hoisted(() => ({
  mockFetchAdminConfig: vi.fn(),
  mockFetchOrcaQueue: vi.fn(),
  mockFetchOrcaConnectionConfig: vi.fn(),
  mockFetchOrcaCapabilities: vi.fn(),
}));

vi.mock('../../../AppRouter', () => ({
  useSession: () => ({ facilityId: 'FAC-TEST', userId: 'admin-user', role: 'system_admin' }),
}));

vi.mock('../../../libs/ui/appToast', () => ({
  useAppToast: () => ({ enqueue: vi.fn() }),
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  getAuditEventLog: vi.fn(() => []),
  logAuditEvent: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  resolveAriaLive: vi.fn(() => 'polite'),
  resolveRunId: vi.fn((runId?: string) => runId ?? 'RUN-FALLBACK'),
}));

vi.mock('../../../libs/observability/runIdCopy', () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../libs/auth/roles', () => ({
  isSystemAdminRole: vi.fn(() => true),
}));

vi.mock('../../reception/components/ToneBanner', () => ({
  ToneBanner: () => null,
}));

vi.mock('../../shared/AuditSummaryInline', () => ({
  AuditSummaryInline: () => null,
}));

vi.mock('../../shared/RunIdBadge', () => ({
  RunIdBadge: () => null,
}));

vi.mock('../AccessManagementPanel', () => ({
  AccessManagementPanel: () => null,
}));

vi.mock('../OrcaUserManagementPanel', () => ({
  OrcaUserManagementPanel: () => null,
}));

vi.mock('../MasterUpdatesPanel', () => ({
  MasterUpdatesPanel: () => null,
}));

vi.mock('../components/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('../api', () => ({
  discardOrcaQueue: vi.fn().mockResolvedValue({ ok: true }),
  fetchAdminConfig: mockFetchAdminConfig,
  fetchOperationsHealth: vi.fn().mockResolvedValue({ ok: true, status: 200, summaryStatus: 'UP', raw: {} }),
  fetchOperationsReadiness: vi.fn().mockResolvedValue({ ok: true, status: 200, summaryStatus: 'UP', checks: {}, raw: {} }),
  fetchOrcaQueue: mockFetchOrcaQueue,
  fetchPvtWorkerHealth: vi.fn().mockResolvedValue({ ok: true, status: 200, workerStatus: 'UP', reasonCodes: [], raw: {} }),
  retryOrcaQueue: vi.fn().mockResolvedValue({ ok: true }),
  saveAdminConfig: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../orcaConnectionApi', () => ({
  fetchOrcaConnectionConfig: mockFetchOrcaConnectionConfig,
  saveOrcaConnectionConfig: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
  testOrcaConnection: vi.fn().mockResolvedValue({ ok: true, status: 200, orcaHttpStatus: 200, apiResult: '00' }),
}));

vi.mock('../orcaCapabilitiesApi', () => ({
  fetchOrcaCapabilities: mockFetchOrcaCapabilities,
}));

vi.mock('../orcaInternalWrapperApi', () => ({
  postBirthDelivery: vi.fn().mockResolvedValue({ ok: true, status: 200, apiResult: '79', stub: true }),
  postMedicalRecords: vi.fn().mockResolvedValue({ ok: true, status: 200, apiResult: '00' }),
  postMedicalSets: vi.fn().mockResolvedValue({ ok: true, status: 200, apiResult: '79', stub: true }),
  postPatientMutation: vi.fn().mockResolvedValue({ ok: true, status: 200, apiResult: '00' }),
  postSubjectiveEntry: vi.fn().mockResolvedValue({ ok: true, status: 200, apiResult: '00' }),
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter(
    [
      {
        path: '/admin',
        element: (
          <QueryClientProvider client={queryClient}>
            <AdministrationPage runId="RUN-DEBUG" role="system_admin" />
          </QueryClientProvider>
        ),
      },
    ],
    { initialEntries: ['/admin?section=debug'] },
  );
  render(<RouterProvider router={router} />);
};

beforeEach(() => {
  mockFetchAdminConfig.mockResolvedValue({
    runId: 'RUN-CONFIG',
    status: 200,
    deliveredAt: '2026-04-11T00:00:00Z',
    chartsDisplayEnabled: true,
    chartsSendEnabled: true,
    chartsMasterSource: 'auto',
  });
  mockFetchOrcaQueue.mockResolvedValue({ runId: 'RUN-QUEUE', queue: [] });
  mockFetchOrcaConnectionConfig.mockResolvedValue({
    ok: true,
    status: 200,
    passwordConfigured: true,
    clientAuthEnabled: false,
    clientCertificateConfigured: false,
    clientCertificatePassphraseConfigured: false,
    caCertificateConfigured: false,
  });
  mockFetchOrcaCapabilities.mockResolvedValue({
    ok: true,
    connection: {
      available: true,
      testedScope: 'api_only',
      pushConfigured: false,
      pushTenantConfigured: false,
      pushMode: 'none',
    },
    internalWrappers: [],
  });
});

describe('AdministrationPage internal wrapper section', () => {
  it('debug section で actual behavior を診断チェックとして表示し、旧 wording を残さない', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '診断チェック' })).toBeInTheDocument();
    expect(
      screen.getByText('このセクションは運用設定から隔離されています。表示中の個別チェックだけを実行し、official / local の境界を混ぜた「一括疎通」には見せません。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'この画面の診断チェックを実行' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '一括疎通（グループ）' })).not.toBeInTheDocument();
  });

  it('capability が無い wrapper を表示しない', async () => {
    mockFetchOrcaCapabilities.mockResolvedValue({
      ok: true,
      connection: {
        available: true,
        testedScope: 'api_only',
        pushConfigured: false,
        pushTenantConfigured: false,
        pushMode: 'none',
      },
      internalWrappers: [],
    });

    renderPage();

    expect(await screen.findByText('この環境で利用可能な internal wrapper はありません。')).toBeInTheDocument();
  });

  it('利用可能な wrapper だけを selector に出す', async () => {
    mockFetchOrcaCapabilities.mockResolvedValue({
      ok: true,
      internalWrappers: [
        {
          id: 'medical-records',
          available: true,
          label: '/api/local/charts/medical-records（院内診療記録取得）',
          hint: 'official ORCA ではなく院内ローカル保存済みカルテ文書を返します',
          routeNamespace: 'local',
          behavior: 'local_read',
        },
      ],
    });

    renderPage();

    expect(await screen.findByText('capability で許可された local-only wrapper だけを表示します。official ORCA API 互換の画面ではありません。')).toBeInTheDocument();
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('/api/local/charts/medical-records');
  });
});
