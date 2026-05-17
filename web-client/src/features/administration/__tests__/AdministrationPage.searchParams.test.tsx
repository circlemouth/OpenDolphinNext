import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';

import { AdministrationPage } from '../AdministrationPage';

const {
  mockFetchAdminConfig,
  mockFetchOrcaQueue,
  mockFetchOrcaConnectionConfig,
  mockFetchOrcaCapabilities,
  mockUseAuthService,
} = vi.hoisted(() => ({
  mockFetchAdminConfig: vi.fn(),
  mockFetchOrcaQueue: vi.fn(),
  mockFetchOrcaConnectionConfig: vi.fn(),
  mockFetchOrcaCapabilities: vi.fn(),
  mockUseAuthService: vi.fn(),
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
  logUiState: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  resolveAriaLive: vi.fn(() => 'polite'),
  resolveRunId: vi.fn((runId?: string) => runId ?? 'RUN-FALLBACK'),
}));

vi.mock('../../../libs/observability/runIdCopy', () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../libs/http/header-flags', () => ({
  persistHeaderFlags: vi.fn(),
  resolveHeaderFlags: vi.fn(() => ({ verifyAdminDelivery: true })),
}));

vi.mock('../../../libs/auth/roles', () => ({
  isSystemAdminRole: vi.fn((role?: string) => role === 'system_admin'),
}));

vi.mock('../../../libs/admin/broadcast', () => ({
  publishAdminBroadcast: vi.fn(),
}));

vi.mock('../../charts/authService', () => ({
  applyAuthServicePatch: vi.fn(),
  useAuthService: () => mockUseAuthService(),
}));

vi.mock('../../reception/components/ToneBanner', () => ({
  ToneBanner: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock('../../shared/AuditSummaryInline', () => ({
  AuditSummaryInline: () => <div data-testid="audit-summary">audit</div>,
}));

vi.mock('../../shared/RunIdBadge', () => ({
  RunIdBadge: ({ runId }: { runId?: string }) => <div data-testid="runid-badge">{runId}</div>,
}));

vi.mock('../AccessManagementPanel', () => ({
  AccessManagementPanel: () => <div data-testid="access-management-panel" />,
}));

vi.mock('../OrcaUserManagementPanel', () => ({
  OrcaUserManagementPanel: () => <div data-testid="orca-user-management-panel" />,
}));

vi.mock('../MasterUpdatesPanel', () => ({
  MasterUpdatesPanel: () => <div data-testid="master-updates-panel" />,
}));

vi.mock('../MasterVisibilityPanel', () => ({
  MasterVisibilityPanel: () => <div data-testid="master-visibility-panel" />,
}));

vi.mock('../components/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('../components/AdminStatusPill', () => ({
  AdminStatusPill: () => <span data-testid="admin-status-pill" />,
}));

vi.mock('../delivery/DeliverySubNav', () => ({
  DeliverySubNav: ({
    activeSection,
    onChange,
  }: {
    activeSection: string;
    onChange: (next: string) => void;
  }) => (
    <div>
      <div data-testid="delivery-active-section">{activeSection}</div>
      <button type="button" onClick={() => onChange('queue')}>
        section:queue
      </button>
    </div>
  ),
}));

vi.mock('../delivery/DeliveryDashboard', () => ({
  DeliveryDashboard: () => <div data-testid="delivery-dashboard" />,
}));

vi.mock('../delivery/WebOrcaConnectionCard', () => ({
  WebOrcaConnectionCard: () => <div data-testid="weborca-connection-card" />,
}));

vi.mock('../delivery/AdminDeliveryConfigCard', () => ({
  AdminDeliveryConfigCard: () => <div data-testid="delivery-config-card" />,
}));

vi.mock('../delivery/AdminDeliveryStatusCard', () => ({
  AdminDeliveryStatusCard: () => <div data-testid="delivery-status-card" />,
}));

vi.mock('../delivery/OperationsHealthCard', () => ({
  OperationsHealthCard: () => <div data-testid="operations-health-card" />,
}));

vi.mock('../delivery/OrcaInternalWrapperCard', () => ({
  OrcaInternalWrapperCard: () => <div data-testid="internal-wrapper-card" />,
}));

vi.mock('../delivery/OrcaQueueCard', () => ({
  OrcaQueueCard: () => <div data-testid="queue-card" />,
}));

vi.mock('../api', () => ({
  discardOrcaQueue: vi.fn().mockResolvedValue({ ok: true }),
  fetchAdminConfig: mockFetchAdminConfig,
  fetchOperationsHealth: vi.fn().mockResolvedValue({ ok: true, status: 200, summaryStatus: 'UP', raw: {} }),
  fetchOperationsReadiness: vi.fn().mockResolvedValue({ ok: true, status: 200, summaryStatus: 'UP', checks: {}, raw: {} }),
  fetchOrcaQueue: mockFetchOrcaQueue,
  fetchPvtWorkerHealth: vi.fn().mockResolvedValue({ ok: true, status: 200, workerStatus: 'UP', reasonCodes: [], raw: {} }),
  retryOrcaQueue: vi.fn().mockResolvedValue({ ok: true }),
  saveAdminConfig: vi.fn().mockResolvedValue({
    ok: true,
    runId: 'RUN-CONFIG',
    chartsDisplayEnabled: true,
    chartsSendEnabled: true,
    chartsMasterSource: 'auto',
  }),
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
  postBirthDelivery: vi.fn().mockResolvedValue({ ok: true, status: 200, apiResult: '00' }),
  postMedicalRecords: vi.fn().mockResolvedValue({ ok: true, status: 200, apiResult: '00' }),
  postMedicalSets: vi.fn().mockResolvedValue({ ok: true, status: 200, apiResult: '00' }),
  postSubjectiveEntry: vi.fn().mockResolvedValue({ ok: true, status: 200, apiResult: '00' }),
}));

const renderPage = (initialEntries: string[]) => {
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
            <AdministrationPage runId="RUN-TEST" role="system_admin" />
          </QueryClientProvider>
        ),
      },
    ],
    { initialEntries },
  );

  render(<RouterProvider router={router} />);
  return router;
};

beforeEach(() => {
  mockUseAuthService.mockReturnValue({
    flags: {},
    bumpRunId: vi.fn(),
    setCacheHit: vi.fn(),
    setMissingMaster: vi.fn(),
    setDataSourceTransition: vi.fn(),
    setFallbackUsed: vi.fn(),
  });
  mockFetchAdminConfig.mockResolvedValue({
    runId: 'RUN-CONFIG',
    source: 'live',
    status: 200,
    deliveryVersion: '1',
    deliveryEtag: 'etag-1',
    deliveredAt: '2026-02-21T00:00:00Z',
    deliveryId: 'DELIVERY-1',
    chartsDisplayEnabled: true,
    chartsSendEnabled: true,
    chartsMasterSource: 'auto',
  });
  mockFetchOrcaQueue.mockResolvedValue({
    runId: 'RUN-QUEUE',
    source: 'live',
    queue: [],
  });
  mockFetchOrcaConnectionConfig.mockResolvedValue({
    status: 403,
    runId: 'RUN-CONNECTION',
    ok: false,
    error: 'forbidden',
  });
  mockFetchOrcaCapabilities.mockResolvedValue({ ok: true, internalWrappers: [] });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AdministrationPage search params sync', () => {
  it('不正クエリを正規化し、URL由来でタブ/セクションを決定する', async () => {
    const router = renderPage(['/admin?tab=invalid&section=unknown']);

    await waitFor(() => {
      expect(router.state.location.search).toBe('?section=dashboard');
    });
    expect(screen.getByRole('button', { name: '配信・運用' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('delivery-active-section')).toHaveTextContent('dashboard');
    expect(document.title).toBe('管理画面 | 施設ID=FAC-TEST');
  });

  it('connection セクションでは async feedback を live region に表示する', async () => {
    renderPage(['/admin?section=connection']);

    expect(await screen.findByText('WebORCA 接続設定の取得に失敗しました。再取得してください。')).toBeInTheDocument();
  });

  it('query だけの遷移と戻る/進むで UI が追従する', async () => {
    const router = renderPage(['/admin?section=dashboard']);

    await waitFor(() => {
      expect(screen.getByTestId('delivery-active-section')).toHaveTextContent('dashboard');
    });

    act(() => {
      void router.navigate('/admin?tab=master-updates');
    });
    await waitFor(() => {
      expect(router.state.location.search).toBe('?tab=master-updates');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'マスタ更新' })).toHaveAttribute('aria-current', 'page');
    });

    act(() => {
      void router.navigate('/admin?tab=master-visibility');
    });
    await waitFor(() => {
      expect(router.state.location.search).toBe('?tab=master-visibility');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'マスタ表示設定' })).toHaveAttribute('aria-current', 'page');
    });
    expect(screen.getByTestId('master-visibility-panel')).toBeInTheDocument();

    act(() => {
      void router.navigate('/admin?section=queue');
    });
    await waitFor(() => {
      expect(router.state.location.search).toBe('?section=queue');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '配信・運用' })).toHaveAttribute('aria-current', 'page');
    });
    expect(screen.getByTestId('delivery-active-section')).toHaveTextContent('queue');

    act(() => {
      void router.navigate(-1);
    });
    await waitFor(() => {
      expect(router.state.location.search).toBe('?tab=master-visibility');
    });
    expect(screen.getByRole('button', { name: 'マスタ表示設定' })).toHaveAttribute('aria-current', 'page');

    act(() => {
      void router.navigate(-1);
    });
    await waitFor(() => {
      expect(router.state.location.search).toBe('?tab=master-updates');
    });
    expect(screen.getByRole('button', { name: 'マスタ更新' })).toHaveAttribute('aria-current', 'page');

    act(() => {
      void router.navigate(-1);
    });
    await waitFor(() => {
      expect(router.state.location.search).toBe('?section=dashboard');
    });
    expect(screen.getByTestId('delivery-active-section')).toHaveTextContent('dashboard');
  });

  it('タブ/セクション操作で searchParams を更新し、履歴で戻せる', async () => {
    const router = renderPage(['/admin?section=dashboard']);

    fireEvent.click(screen.getByRole('button', { name: 'ORCAユーザー連携・権限' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?tab=orca-users');
    });

    fireEvent.click(screen.getByRole('button', { name: '配信・運用' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?section=dashboard');
    });

    fireEvent.click(screen.getByRole('button', { name: 'section:queue' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?section=queue');
    });

    act(() => {
      void router.navigate(-1);
    });
    await waitFor(() => {
      expect(router.state.location.search).toBe('?section=dashboard');
    });
  });
});
