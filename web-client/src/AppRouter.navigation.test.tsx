import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppRouter } from './AppRouter';
import { httpFetch } from './libs/http/httpClient';

let mockPatientsPageShouldThrow = false;

vi.mock('./styles/app-shell.css', () => ({}));
vi.mock('./libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));
vi.mock('./libs/observability/observability', () => ({
  updateObservabilityMeta: vi.fn(),
  resolveAriaLive: () => 'polite',
  getObservabilityMeta: () => ({}),
}));
vi.mock('./libs/observability/runIdCopy', () => ({
  copyRunIdToClipboard: vi.fn().mockResolvedValue('clipboard'),
  copyTextToClipboard: vi.fn().mockResolvedValue('clipboard'),
}));
vi.mock('./libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
}));
vi.mock('./features/login/recentFacilityStore', () => ({
  addRecentFacility: vi.fn(),
  loadRecentFacilities: () => [],
  loadDevFacilityId: () => undefined,
}));
vi.mock('./libs/session/sessionExpiry', () => ({
  SESSION_EXPIRED_EVENT: 'session-expired',
  clearSessionExpiredNotice: vi.fn(),
  consumeSessionExpiredNotice: () => undefined,
}));
vi.mock('./features/shared/ChartEventStreamBridge', () => ({
  ChartEventStreamBridge: () => null,
}));
vi.mock('./features/shared/MockModeBanner', () => ({
  MockModeBanner: () => null,
}));
vi.mock('./components/SecurityMisconfigBanner', () => ({
  SecurityMisconfigBanner: () => null,
}));
vi.mock('./features/charts/authService', async () => {
  const ReactModule = await import('react');
  const AuthContext = ReactModule.createContext({ flags: {} });
  return {
    AuthServiceProvider: ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={{ flags: {} }}>{children}</AuthContext.Provider>
    ),
    useAuthService: () => ReactModule.useContext(AuthContext),
    clearStoredAuthFlags: vi.fn(),
  };
});
vi.mock('./routes/NavigationGuardProvider', () => ({
  NavigationGuardProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  resolveScreenKey: () => 'screen',
  useNavigationGuard: () => ({
    isDirty: false,
    dirtySources: [],
    guardedNavigate: vi.fn(),
  }),
}));
vi.mock('./features/reception/pages/ReceptionPage', () => ({
  ReceptionPage: () => <div data-testid="reception-page">reception page</div>,
}));
vi.mock('./features/patients/PatientsPage', () => ({
  PatientsPage: () => {
    if (mockPatientsPageShouldThrow) {
      throw new Error('java.lang.IllegalStateException: render exploded');
    }
    return <div data-testid="patients-page">patients page</div>;
  },
}));
vi.mock('./features/administration/AdministrationPage', async () => {
  const { useLocation, useNavigate } = await import('react-router-dom');

  const AdministrationPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const params = new URLSearchParams(location.search);
    const section = params.get('section') ?? 'dashboard';
    const tab = params.get('tab') ?? '';

    const setSection = (nextSection: string, nextTab?: string) => {
      const nextParams = new URLSearchParams();
      nextParams.set('section', nextSection);
      if (nextTab) {
        nextParams.set('tab', nextTab);
      }
      navigate({
        pathname: location.pathname,
        search: `?${nextParams.toString()}`,
      });
    };

    return (
      <section>
        <div role="tablist" aria-label="Administration tabs">
          <button type="button" role="tab" onClick={() => setSection('access', 'orca-users')}>
            ORCAユーザー連携・権限
          </button>
          <button type="button" role="tab" onClick={() => setSection('master-updates', 'master-updates')}>
            マスタ更新
          </button>
          <button type="button" role="tab" onClick={() => setSection('dashboard')}>
            設定配信
          </button>
        </div>
        {section === 'dashboard' ? <nav aria-label="設定配信サブナビ">subnav</nav> : null}
        {tab === 'orca-users' ? <h1>ORCAユーザー連携（職員マスタ）</h1> : null}
        {section === 'master-updates' ? <h1>マスタ更新ダッシュボード</h1> : null}
      </section>
    );
  };

  return { AdministrationPage };
});
vi.mock('./features/workspaceTabs/WorkspaceTabBar', async () => {
  const { useNavigate } = await import('react-router-dom');

  const WorkspaceTabBar = ({
    facilityId,
    role,
    orcaStatus,
    onRequestLogout,
  }: {
    facilityId?: string;
    role?: string;
    orcaStatus?: { label: string };
    onRequestLogout?: () => void;
  }) => {
    const navigate = useNavigate();
    const basePath = `/f/${facilityId ?? '0001'}`;
    return (
      <div>
        <div role="tablist" aria-label="画面ナビゲーション">
          <button type="button" role="tab" onClick={() => navigate(`${basePath}/reception`)}>
            受付
          </button>
          <button type="button" role="tab" onClick={() => navigate(`${basePath}/patients`)}>
            患者管理
          </button>
        </div>
        {orcaStatus ? <div>{orcaStatus.label}</div> : null}
        {role === 'system_admin' ? (
          <button type="button" aria-label="管理画面を開く" onClick={() => navigate(`${basePath}/administration`)}>
            管理画面を開く
          </button>
        ) : null}
        <button type="button" onClick={() => onRequestLogout?.()}>
          logout
        </button>
      </div>
    );
  };

  return { WorkspaceTabBar };
});
vi.mock('./features/administration/orcaConnectionApi', () => ({
  testOrcaConnection: vi.fn(async () => ({
    ok: true,
    status: 200,
    orcaHttpStatus: 200,
    apiResult: '00',
    testedAt: '2026-03-07T00:00:00Z',
  })),
}));

const AUTH_KEY = 'opendolphin:web-client:auth';
let currentRole = 'doctor';

const setSession = (role: string) => {
  currentRole = role;
  sessionStorage.setItem(
    AUTH_KEY,
    JSON.stringify({
      facilityId: '0001',
      userId: 'user01',
      role,
      runId: 'RUN-NAV',
      displayName: 'user01',
      clientUuid: 'client-001',
    }),
  );
};

const prepareSession = (role: string) => {
  localStorage.clear();
  sessionStorage.clear();
  setSession(role);
};

describe('AppRouter navigation guard', () => {
  beforeEach(() => {
    mockPatientsPageShouldThrow = false;
    vi.mocked(httpFetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/session/me')) {
        return new Response(
          JSON.stringify({
            facilityId: '0001',
            userId: 'user01',
            displayName: 'user01',
            clientUuid: 'client-001',
            runId: 'RUN-NAV',
            roles: [currentRole],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (url === '/api/logout' && init?.method === 'POST') {
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    });
    window.history.pushState({}, '', '/f/0001/reception');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('non system_admin は管理画面ボタン/ORCAステータスが表示されず、受付/患者管理タブで遷移できる', async () => {
    prepareSession('doctor');
    const user = userEvent.setup();

    render(<AppRouter />);

    await screen.findByTestId('reception-page');
    expect(screen.queryByText(/^ORCA:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '管理画面を開く' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '患者管理' }));
    expect(window.location.pathname).toBe('/f/0001/patients');
    await screen.findByTestId('patients-page');

    await user.click(screen.getByRole('tab', { name: '受付' }));
    expect(window.location.pathname).toBe('/f/0001/reception');
    await screen.findByTestId('reception-page');
  });

  it('route render error 時も raw error.message を画面に表示しない', async () => {
    prepareSession('doctor');
    mockPatientsPageShouldThrow = true;
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<AppRouter />);

    await screen.findByTestId('reception-page');
    await user.click(screen.getByRole('tab', { name: '患者管理' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('画面エラーが発生しました');
    expect(screen.getByText(/RUN_ID:/)).toBeInTheDocument();
    expect(screen.queryByText(/java\.lang\.IllegalStateException/)).not.toBeInTheDocument();
    expect(screen.queryByText(/詳細:/)).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('system_admin は管理画面ボタンが表示され遷移できる', async () => {
    prepareSession('system_admin');
    const user = userEvent.setup();

    render(<AppRouter />);

    await screen.findByTestId('reception-page');
    expect(await screen.findByText(/^ORCA:/)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: '管理画面を開く' }));
    expect(window.location.pathname).toBe('/f/0001/administration');
  });

  it('Administration のタブ/サブナビ切替が即時反映される', async () => {
    prepareSession('system_admin');
    const user = userEvent.setup();
    window.history.pushState({}, '', '/f/0001/administration?section=dashboard');

    render(<AppRouter />);

    expect(await screen.findByRole('navigation', { name: '設定配信サブナビ' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'ORCAユーザー連携・権限' }));
    expect(window.location.search).toContain('tab=orca-users');
    expect(await screen.findByRole('heading', { name: 'ORCAユーザー連携（職員マスタ）' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'マスタ更新' }));
    expect(window.location.search).toContain('tab=master-updates');
    expect(await screen.findByRole('heading', { name: 'マスタ更新ダッシュボード' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '設定配信' }));
    expect(window.location.search).toContain('section=dashboard');
    expect(await screen.findByRole('navigation', { name: '設定配信サブナビ' })).toBeInTheDocument();
  });

  it('system_admin 以外の直アクセスは Administration を遮断する', async () => {
    prepareSession('doctor');
    window.history.pushState({}, '', '/f/0001/administration');

    render(<AppRouter />);

    expect(await screen.findByText('Administration は system_admin 専用のためアクセスできません。')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/f/0001/administration');
  });
});
