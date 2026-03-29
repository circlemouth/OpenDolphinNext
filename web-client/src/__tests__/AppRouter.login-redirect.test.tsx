import React, { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { AppRouterWithNavigation } from '../AppRouter';
import { httpFetch } from '../libs/http/httpClient';

// 軽量モック
vi.mock('../styles/app-shell.css', () => ({}));
vi.mock('../libs/observability/observability', () => ({
  updateObservabilityMeta: vi.fn(),
  resolveAriaLive: () => 'polite',
  getObservabilityMeta: () => ({}),
}));
vi.mock('../libs/observability/runIdCopy', () => ({
  copyRunIdToClipboard: vi.fn().mockResolvedValue(undefined),
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));
vi.mock('../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
}));
vi.mock('../features/login/recentFacilityStore', () => ({
  addRecentFacility: vi.fn(),
  loadRecentFacilities: () => ['123'],
  loadDevFacilityId: () => undefined,
}));
vi.mock('../features/login/loginRouteState', () => ({
  normalizeFromState: (state: unknown) => (typeof state === 'object' && state !== null ? (state as any) : undefined),
  resolveFromState: (state: unknown) =>
    typeof state === 'object' && state !== null && 'from' in (state as any) ? (state as any).from : undefined,
  resolveSwitchContext: (state: unknown) =>
    typeof state === 'object' && state !== null && 'switchContext' in (state as any)
      ? (state as any).switchContext
      : undefined,
  isLegacyFrom: () => false,
}));
vi.mock('../libs/session/sessionExpiry', () => ({
  SESSION_EXPIRED_EVENT: 'session-expired',
  clearSessionExpiredNotice: vi.fn(),
  consumeSessionExpiredNotice: () => undefined,
}));
vi.mock('../libs/ui/appToast', () => ({
  AppToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../features/shared/RunIdNavBadge', () => ({
  RunIdNavBadge: ({ runId }: { runId?: string }) => <div data-testid="runid-nav-badge">{runId}</div>,
}));
vi.mock('../features/shared/ChartEventStreamBridge', () => ({
  ChartEventStreamBridge: () => null,
}));
vi.mock('../features/charts/authService', async () => {
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

vi.mock('../LoginScreen', () => {
  const MockLogin = ({
    onLoginSuccess,
    initialNotice,
    destinationSummary,
  }: {
    onLoginSuccess?: (result: any) => void;
    initialNotice?: { message?: string };
    destinationSummary?: { body?: string };
  }) => {
    useEffect(() => {
      if ((globalThis as any).__mockAutoLogin !== false && onLoginSuccess) {
        onLoginSuccess(globalThis.__mockLoginResult);
      }
    }, [onLoginSuccess]);
    return (
      <div data-testid="login-screen">
        <div>login</div>
        {initialNotice?.message ? <div>{initialNotice.message}</div> : null}
        {destinationSummary?.body ? <div>{destinationSummary.body}</div> : null}
      </div>
    );
  };
  return { LoginScreen: MockLogin };
});

vi.mock('../features/reception/pages/ReceptionPage', () => ({
  ReceptionPage: () => <div data-testid="reception-page">reception</div>,
}));
vi.mock('../features/charts/pages/ChartsPage', () => ({
  ChartsPage: () => <div data-testid="charts-page">charts</div>,
}));
vi.mock('../features/charts/pages/ChartsOutpatientPrintPage', () => ({
  ChartsOutpatientPrintPage: () => <div data-testid="charts-outpatient-print">print</div>,
}));
vi.mock('../features/charts/pages/ChartsDocumentPrintPage', () => ({
  ChartsDocumentPrintPage: () => <div data-testid="charts-document-print">doc-print</div>,
}));
vi.mock('../features/patients/PatientsPage', () => ({
  PatientsPage: () => <div data-testid="patients-page">patients</div>,
}));
vi.mock('../features/administration/AdministrationPage', () => ({
  AdministrationPage: () => <div data-testid="administration-page">admin</div>,
}));
vi.mock('../features/outpatient/OutpatientMockPage', () => ({
  OutpatientMockPage: () => <div data-testid="outpatient-mock-page">outpatient-mock</div>,
}));
vi.mock('../features/debug/DebugHubPage', () => ({
  DebugHubPage: () => <div data-testid="debug-hub-page">debug-hub</div>,
}));
vi.mock('../features/debug/OrcaApiConsolePage', () => ({
  OrcaApiConsolePage: () => <div data-testid="debug-orca-api">debug-orca</div>,
}));
declare global {
  // eslint-disable-next-line no-var
  var __mockLoginResult: any;
  // eslint-disable-next-line no-var
  var __mockAutoLogin: boolean | undefined;
}

const AUTH_STORAGE_KEY = 'opendolphin:web-client:auth';

const buildRouter = (initialEntries: Array<string | { pathname: string; search?: string; hash?: string; state?: unknown }>, initialIndex = 0) =>
  createMemoryRouter(
    [{ path: '*', element: <AppRouterWithNavigation /> }],
    { initialEntries, initialIndex },
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  globalThis.__mockAutoLogin = true;
  globalThis.__mockLoginResult = {
    facilityId: '123',
    userId: 'user-1',
    role: 'doctor',
    runId: 'run-001',
    clientUuid: 'client-001',
  };
  vi.mocked(httpFetch).mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/session/me')) {
      const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) {
        return new Response(null, { status: 401 });
      }
      const parsed = JSON.parse(stored) as Record<string, string | undefined>;
      return new Response(
        JSON.stringify({
          facilityId: parsed.facilityId ?? '123',
          userId: parsed.userId ?? 'user-1',
          roles: [parsed.role ?? 'doctor'],
          clientUuid: parsed.clientUuid ?? 'client-001',
          runId: parsed.runId ?? 'run-001',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    if (url === '/api/logout' && init?.method === 'POST') {
      return new Response(null, { status: 404 });
    }
    return new Response(null, { status: 404 });
  });
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('AppRouter login redirect', () => {
  it('state.from がある場合はクエリ・ハッシュ・state を保持したまま遷移する', async () => {
    const fromState = { pathname: '/f/123/patients', search: '?foo=1', hash: '#h', state: { kw: 'keep' } };
    const router = buildRouter([{ pathname: '/login', state: { from: fromState } }]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/123/patients');
    });
    expect(router.state.location.search).toBe('?foo=1');
    expect(router.state.location.hash).toBe('#h');
    expect(router.state.location.state).toEqual(fromState.state);
  });

  it('state.from が facility-scoped でない場合でも認証済みなら reception に落とす', async () => {
    sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        facilityId: '123',
        userId: 'user-1',
        role: 'doctor',
        runId: 'run-login-state',
      }),
    );
    const router = buildRouter([{ pathname: '/login', state: { from: '/charts' } }]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/123/reception');
    });
  });

  it('未認証の root-level arbitrary path は /login に寄せ、state.from を持ち込まない', async () => {
    globalThis.__mockAutoLogin = false;
    const router = buildRouter(['/charts']);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/123/login');
    });
    expect(router.state.location.state).toBeNull();
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('/f/:id/login 直アクセス時は reception へ即リダイレクトする', async () => {
    const router = buildRouter(['/f/123/login']);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/123/reception');
    });
  });

  it('root-level の arbitrary path は reception の固定 fallback に寄せる', async () => {
    sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        facilityId: '123',
        userId: 'user-1',
        role: 'doctor',
        runId: 'run-root',
      }),
    );

    const router = buildRouter(['/charts']);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/123/reception');
    });
  });

  it('state.from が login の場合は reception にフォールバックする', async () => {
    const router = buildRouter([{ pathname: '/login', state: { from: '/login' } }]);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/123/reception');
    });
  });

  it('logout notice がある場合は login surface に理由を表示する', async () => {
    globalThis.__mockAutoLogin = false;
    const router = buildRouter([{ pathname: '/f/123/login', state: { loginNotice: { reason: 'logout' } } }]);

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('サインアウトしました。続けて別の施設やユーザーでログインできます。')).toBeInTheDocument();
  });

  it('scrub される deep link return では landing explanation を表示する', async () => {
    globalThis.__mockAutoLogin = false;
    const router = buildRouter([
      {
        pathname: '/f/123/login',
        state: {
          from: {
            pathname: '/f/123/charts',
            search: '?patientId=P-001&kw=山田',
          },
        },
      },
    ]);

    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/deep link query は引き継がずに画面本体へ移動します/)).toBeInTheDocument();
  });

  it('ログイン済みで /login に戻った場合は server bootstrap 後に reception へ戻す', async () => {
    sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        facilityId: '123',
        userId: 'user-1',
        role: 'doctor',
        runId: 'run-stay',
      }),
    );

    const router = buildRouter(
      ['/f/123/reception', { pathname: '/login', state: { from: '/f/123/reception' } }],
      1,
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/123/reception');
    });
    expect(screen.queryByText('ログイン中のため切替が必要です')).not.toBeInTheDocument();
  });

  it('state.from が無い POP で /login に来た場合は即 reception に戻す', async () => {
    sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        facilityId: '123',
        userId: 'user-1',
        role: 'doctor',
        runId: 'run-stay',
      }),
    );

    const router = buildRouter(['/f/123/reception', '/login'], 1);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/123/reception');
    });
    expect(screen.queryByText('ログイン中のため切替が必要です')).not.toBeInTheDocument();
  });

  it('localStorage に残った旧セッションは復元せずログイン画面を表示する', async () => {
    globalThis.__mockAutoLogin = false;
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        facilityId: '123',
        userId: 'user-1',
        role: 'doctor',
        runId: 'run-stale',
      }),
    );

    const router = buildRouter(['/f/123/reception']);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/123/login');
    });
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
