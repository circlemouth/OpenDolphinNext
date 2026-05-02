import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { AppRouterWithNavigation } from '../AppRouter';
import { clearChartsEncounterContext, loadChartsEncounterContext } from '../features/charts/encounterContext';
import { clearChartsPatientTabsStorage } from '../features/charts/patientTabsStorage';
import { httpFetch } from '../libs/http/httpClient';
import { clearDeepLinkContext, loadDeepLinkContext } from '../routes/deepLinkContextStorage';

vi.mock('../styles/app-shell.css', () => ({}));
vi.mock('../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));
vi.mock('../libs/observability/observability', () => ({
  updateObservabilityMeta: vi.fn(),
  resolveAriaLive: () => 'polite',
  getObservabilityMeta: () => ({}),
}));
vi.mock('../libs/observability/runIdCopy', () => ({
  copyRunIdToClipboard: vi.fn().mockResolvedValue(undefined),
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
}));
vi.mock('../features/login/recentFacilityStore', () => ({
  addRecentFacility: vi.fn(),
  loadRecentFacilities: () => [],
  loadDevFacilityId: () => undefined,
}));
vi.mock('../libs/session/sessionExpiry', () => ({
  SESSION_EXPIRED_EVENT: 'session-expired',
  clearSessionExpiredNotice: vi.fn(),
  consumeSessionExpiredNotice: () => undefined,
}));
vi.mock('../libs/ui/appToast', () => ({
  AppToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../features/shared/ChartEventStreamBridge', () => ({
  ChartEventStreamBridge: () => null,
}));
vi.mock('../features/shared/MockModeBanner', () => ({
  MockModeBanner: () => null,
}));
vi.mock('../features/workspaceTabs/WorkspaceTabBar', () => ({
  WorkspaceTabBar: () => null,
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
vi.mock('../features/charts/pages/ChartsPage', () => ({
  ChartsPage: () => <div data-testid="charts-page">charts</div>,
}));
vi.mock('../features/reception/pages/ReceptionPage', () => ({
  ReceptionPage: () => <div data-testid="reception-page">reception</div>,
}));
vi.mock('../features/charts/pages/ChartsOutpatientPrintPage', () => ({
  ChartsOutpatientPrintPage: () => <div data-testid="charts-outpatient-print">print</div>,
}));
vi.mock('../features/charts/pages/ChartsDocumentPrintPage', () => ({
  ChartsDocumentPrintPage: () => <div data-testid="charts-document-print">doc-print</div>,
}));
vi.mock('../features/charts/pages/OrderSetEditorPage', () => ({
  OrderSetEditorPage: () => <div data-testid="order-set-editor">order-sets</div>,
}));
vi.mock('../features/patients/PatientsPage', () => ({
  PatientsPage: () => <div data-testid="patients-page">patients</div>,
}));
vi.mock('../features/administration/AdministrationPage', () => ({
  AdministrationPage: () => <div data-testid="administration-page">admin</div>,
}));
vi.mock('../features/debug/DebugHubPage', () => ({
  DebugHubPage: () => <div data-testid="debug-hub-page">debug-hub</div>,
}));
vi.mock('../features/debug/OrcaApiConsolePage', () => ({
  OrcaApiConsolePage: () => <div data-testid="debug-orca-api">debug-orca</div>,
}));
vi.mock('../features/images/pages/MobileImagesUploadPage', () => ({
  MobileImagesUploadPage: () => <div data-testid="mobile-images-page">mobile-images</div>,
}));
vi.mock('../features/debug/MobilePatientPickerDemoPage', () => ({
  MobilePatientPickerDemoPage: () => <div data-testid="mobile-picker-page">mobile-picker</div>,
}));
vi.mock('../features/administration/api', () => ({
  fetchOperationsReadiness: vi.fn(async () => ({
    ok: true,
    status: 200,
    summaryStatus: 'UP',
    checks: { orca: { status: 'UP' } },
    raw: {},
  })),
}));
vi.mock('../features/login/loginRouteState', () => ({
  normalizeFromState: () => undefined,
  resolveFromState: () => undefined,
  resolveSwitchContext: () => undefined,
  isLegacyFrom: () => false,
}));
vi.mock('../routes/NavigationGuardProvider', async () => {
  return {
    NavigationGuardProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    resolveScreenKey: () => 'charts',
    useNavigationGuard: () => ({
      isDirty: false,
      dirtySources: [],
      guardedNavigate: vi.fn(),
      confirmNavigation: vi.fn(),
    }),
  };
});

const AUTH_STORAGE_KEY = 'opendolphin:web-client:auth';
const setCsrfMetaToken = (content: string) => {
  const existing = document.querySelector("meta[name='csrf-token']");
  if (existing) {
    existing.remove();
  }
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'csrf-token');
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
};

const buildRouter = (initialEntries: string[]) =>
  createMemoryRouter(
    [{ path: '*', element: <AppRouterWithNavigation /> }],
    { initialEntries },
  );

describe('AppRouter charts query scrub', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    document.head.innerHTML = '';
    setCsrfMetaToken('csrf-test-token');
    localStorage.clear();
    sessionStorage.clear();
    clearChartsEncounterContext();
    clearChartsPatientTabsStorage();
    clearDeepLinkContext();
    sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        facilityId: '0001',
        userId: 'user-1',
        role: 'doctor',
        runId: 'run-001',
        clientUuid: 'client-001',
      }),
    );
    vi.mocked(httpFetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/session/me')) {
        return new Response(
          JSON.stringify({
            facilityId: '0001',
            userId: 'user-1',
            roles: ['doctor'],
            clientUuid: 'client-001',
            runId: 'run-001',
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
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    localStorage.clear();
    sessionStorage.clear();
    clearChartsEncounterContext();
    clearChartsPatientTabsStorage();
    clearDeepLinkContext();
  });

  it('charts queryから encounter パラメータを除去し、context を保存する', async () => {
    const router = buildRouter([
      '/f/0001/charts?patientId=00001&visitDate=2026-01-01&departmentCode=01&physicianCode=10001&insuranceCombinationNumber=0001',
    ]);
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/0001/charts');
      expect(router.state.location.search).toBe('');
    });

    const saved = loadChartsEncounterContext({ facilityId: '0001', userId: 'user-1' });
    expect(saved).toEqual({
      patientId: '00001',
      appointmentId: undefined,
      receptionId: undefined,
      scheduleKey: undefined,
      encounterKey: undefined,
      visitDate: '2026-01-01',
      departmentCode: '01',
      physicianCode: '10001',
      insuranceCombinationNumber: '0001',
      voucherNumber: undefined,
      sequentialNumber: undefined,
    });
    expect(sessionStorage.getItem('opendolphin:web-client:charts:encounter-context:v2:0001:user-1')).toBeNull();
  });

  it('patients query から patientId/kw を除去し、context を保存する', async () => {
    const router = buildRouter(['/f/0001/patients?patientId=00002&kw=山田']);
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/f/0001/patients');
      expect(router.state.location.search).toBe('');
    });

    const saved = loadChartsEncounterContext({ facilityId: '0001', userId: 'user-1' });
    expect(saved).toEqual({
      patientId: '00002',
      appointmentId: undefined,
      receptionId: undefined,
      scheduleKey: undefined,
      encounterKey: undefined,
      visitDate: undefined,
    });
    expect(loadDeepLinkContext()?.values).toEqual({
      patientId: '00002',
    });
    expect(sessionStorage.getItem('opendolphin:web-client:deeplink-context')).toBeNull();
  });

  it('mobile images query から patientId を除去して context を保存する', async () => {
    vi.stubEnv('VITE_PATIENT_IMAGES_MOBILE_UI', '1');
    const router = buildRouter(['/f/0001/m/images?patientId=00003']);
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });

    const saved = loadChartsEncounterContext({ facilityId: '0001', userId: 'user-1' });
    expect(saved).toEqual({
      patientId: '00003',
      appointmentId: undefined,
      receptionId: undefined,
      scheduleKey: undefined,
      encounterKey: undefined,
      visitDate: undefined,
    });
    expect(loadDeepLinkContext()?.values).toEqual(
      expect.objectContaining({
        patientId: '00003',
      }),
    );
    expect(sessionStorage.getItem('opendolphin:web-client:deeplink-context')).toBeNull();
  });

  it('logout API が 404 でも /login へ遷移し、患者関連 storage を削除する', async () => {
    const user = userEvent.setup();
    const httpFetchMock = vi.mocked(httpFetch);
    sessionStorage.setItem('opendolphin:web-client:charts:patient-tabs:v1:0001:user-1', '{"tabs":[]}');
    sessionStorage.setItem(
      'opendolphin:web-client:deeplink-context',
      JSON.stringify({ savedAt: new Date().toISOString(), values: { patientId: '00003' } }),
    );
    sessionStorage.setItem('charts:orca-claim-send:0001:user-1', '{"P-1":{"patientId":"P-1"}}');
    sessionStorage.setItem('charts:orca-income-info:0001:user-1', '{"P-1":{"patientId":"P-1"}}');
    localStorage.setItem(
      'opendolphin:web-client:outpatient-saved-views:v1',
      '[{"id":"1","label":"old","filters":{"keyword":"山田"}}]',
    );
    const router = buildRouter(['/f/0001/reception']);
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'ログアウト' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/\/login$/);
    });
    await waitFor(() => {
      expect(httpFetchMock).toHaveBeenCalledWith(
        '/api/logout',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
    expect(sessionStorage.getItem('opendolphin:web-client:charts:patient-tabs:v1:0001:user-1')).toBeNull();
    expect(sessionStorage.getItem('opendolphin:web-client:deeplink-context')).toBeNull();
    expect(sessionStorage.getItem('charts:orca-claim-send:0001:user-1')).toBeNull();
    expect(sessionStorage.getItem('charts:orca-income-info:0001:user-1')).toBeNull();
    expect(localStorage.getItem('opendolphin:web-client:outpatient-saved-views:v1')).toBeNull();
  });
});
