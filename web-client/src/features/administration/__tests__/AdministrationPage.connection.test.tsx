import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdministrationPage } from '../AdministrationPage';

const {
  mockFetchAdminConfig,
  mockFetchOrcaQueue,
  mockFetchOrcaConnectionConfig,
  mockSaveOrcaConnectionConfig,
  mockFetchOrcaCapabilities,
} = vi.hoisted(() => ({
  mockFetchAdminConfig: vi.fn(),
  mockFetchOrcaQueue: vi.fn(),
  mockFetchOrcaConnectionConfig: vi.fn(),
  mockSaveOrcaConnectionConfig: vi.fn(),
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
  ToneBanner: ({ message }: { message: string }) => <div>{message}</div>,
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
  saveOrcaConnectionConfig: mockSaveOrcaConnectionConfig,
  testOrcaConnection: vi.fn().mockResolvedValue({ ok: true, status: 200, orcaHttpStatus: 200, apiResult: '00' }),
}));

vi.mock('../orcaCapabilitiesApi', () => ({
  fetchOrcaCapabilities: mockFetchOrcaCapabilities,
}));

vi.mock('../orcaInternalWrapperApi', () => ({
  postBirthDelivery: vi.fn().mockResolvedValue({ ok: true, status: 200, apiResult: '00' }),
  postMedicalRecords: vi.fn().mockResolvedValue({ ok: true, status: 200, apiResult: '00' }),
  postMedicalSets: vi.fn().mockResolvedValue({ ok: true, status: 200, apiResult: '00' }),
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
            <AdministrationPage runId="RUN-CONNECTION" role="system_admin" />
          </QueryClientProvider>
        ),
      },
    ],
    { initialEntries: ['/admin?section=connection'] },
  );

  render(<RouterProvider router={router} />);
};

beforeEach(() => {
  mockFetchAdminConfig.mockReset();
  mockFetchOrcaQueue.mockReset();
  mockFetchOrcaConnectionConfig.mockReset();
  mockSaveOrcaConnectionConfig.mockReset();
  mockFetchOrcaCapabilities.mockReset();
  mockFetchAdminConfig.mockResolvedValue({
    runId: 'RUN-CONFIG',
    status: 200,
    deliveredAt: '2026-04-11T00:00:00Z',
    chartsDisplayEnabled: true,
    chartsSendEnabled: true,
    chartsMasterSource: 'auto',
  });
  mockFetchOrcaQueue.mockResolvedValue({ runId: 'RUN-QUEUE', queue: [] });
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
  mockSaveOrcaConnectionConfig.mockResolvedValue({ ok: true, status: 200 });
});

describe('AdministrationPage connection section', () => {
  it('権限取得と ORCA 接続成功を混同しない文言を表示する', async () => {
    mockFetchOrcaConnectionConfig.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'forbidden',
    });

    renderPage();

    expect(await screen.findByText('WebORCA 接続設定は管理画面の接続設定取得権限が確認できたセッションでのみ表示します。この状態は ORCA 接続成功を意味しません。')).toBeInTheDocument();
    expect(screen.getByText('管理画面権限: 確認中または未取得')).toBeInTheDocument();
    expect(screen.getByText('ORCA 接続成否: 接続テスト未実行')).toBeInTheDocument();
    expect(screen.queryByText(/認証済み/)).not.toBeInTheDocument();
  });

  it('pushUrl / pushTenantId を表示し保存 request に含める', async () => {
    const user = userEvent.setup();
    mockFetchOrcaCapabilities.mockResolvedValue({
      ok: true,
      connection: {
        available: true,
        testedScope: 'api_only',
        pushConfigured: true,
        pushTenantConfigured: true,
        pushMode: 'push_url_and_tenant',
      },
      internalWrappers: [],
    });
    mockFetchOrcaConnectionConfig.mockResolvedValue({
      ok: true,
      status: 200,
      useWeborca: true,
      serverUrl: 'https://weborca.example.invalid',
      port: 443,
      username: 'orca-admin',
      pushUrl: 'wss://push.old.invalid/ws',
      pushTenantId: 'tenant-old',
      passwordConfigured: true,
      clientAuthEnabled: false,
      clientCertificateConfigured: false,
      clientCertificatePassphraseConfigured: false,
      caCertificateConfigured: false,
    });

    renderPage();

    const pushUrl = await screen.findByLabelText('Push URL');
    const pushTenantId = screen.getByLabelText('Push tenant ID');
    expect(pushUrl).toHaveValue('wss://push.old.invalid/ws');
    expect(pushTenantId).toHaveValue('tenant-old');
    expect(screen.getByText('保存済みPush設定: Push URL + tenant ID 設定済み')).toBeInTheDocument();
    expect(screen.getByText('接続テスト範囲: API到達のみ')).toBeInTheDocument();
    expect(screen.getByText('この section が正本なのは施設別 ORCA 接続のみです。管理画面権限、保存済み接続設定、testedScope を分離して扱います。')).toBeInTheDocument();
    expect(screen.getByText('testedScope: API到達のみ')).toBeInTheDocument();

    await user.clear(pushUrl);
    await user.type(pushUrl, 'wss://push.new.invalid/ws');
    await user.clear(pushTenantId);
    await user.type(pushTenantId, 'tenant-new');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockSaveOrcaConnectionConfig).toHaveBeenCalled();
      expect(mockSaveOrcaConnectionConfig.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          pushUrl: 'wss://push.new.invalid/ws',
          pushTenantId: 'tenant-new',
        }),
      );
    });
  });

  it('pushTenantId 単独では保存させない', async () => {
    const user = userEvent.setup();
    mockFetchOrcaConnectionConfig.mockResolvedValue({
      ok: true,
      status: 200,
      useWeborca: true,
      serverUrl: 'https://weborca.example.invalid',
      port: 443,
      username: 'orca-admin',
      pushUrl: '',
      pushTenantId: '',
      passwordConfigured: true,
      clientAuthEnabled: false,
      clientCertificateConfigured: false,
      clientCertificatePassphraseConfigured: false,
      caCertificateConfigured: false,
    });

    renderPage();

    const pushTenantId = await screen.findByLabelText('Push tenant ID');
    await user.type(pushTenantId, 'tenant-only');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(mockSaveOrcaConnectionConfig).not.toHaveBeenCalled();
    expect(screen.getByText('Push tenant ID は Push URL を設定した場合のみ保存できます。')).toBeInTheDocument();
    expect(screen.getByText('入力エラーを修正してください。')).toBeInTheDocument();
  });
});
