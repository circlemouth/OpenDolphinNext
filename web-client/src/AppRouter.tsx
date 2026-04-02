import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
  lazy,
  Suspense,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import { LoginScreen, type LoginResult } from './LoginScreen';
import { ChartsPage } from './features/charts/pages/ChartsPage';
import { ChartsOutpatientPrintPage } from './features/charts/pages/ChartsOutpatientPrintPage';
import { ChartsDocumentPrintPage } from './features/charts/pages/ChartsDocumentPrintPage';
import { OrderSetEditorPage } from './features/charts/pages/OrderSetEditorPage';
import { ReceptionPage } from './features/reception/pages/ReceptionPage';
import { MobileImagesUploadPage } from './features/images/pages/MobileImagesUploadPage';
import './styles/app-shell.css';
import { getObservabilityMeta, resolveAriaLive, updateObservabilityMeta } from './libs/observability/observability';
import { copyRunIdToClipboard, copyTextToClipboard } from './libs/observability/runIdCopy';
import { AuthServiceProvider, clearStoredAuthFlags, useAuthService } from './features/charts/authService';
import { PatientsPage } from './features/patients/PatientsPage';
import { AdministrationPage } from './features/administration/AdministrationPage';
import { AppToastProvider, type AppToast, type AppToastInput } from './libs/ui/appToast';
import { clearDevVolatilePlainPassword } from './libs/http/devAuthVolatile';
import { httpFetch } from './libs/http/httpClient';
import { logAuditEvent } from './libs/audit/auditLogger';
import { ChartEventStreamBridge } from './features/shared/ChartEventStreamBridge';
import { MockModeBanner } from './features/shared/MockModeBanner';
import { WorkspaceTabBar } from './features/workspaceTabs/WorkspaceTabBar';
import { SecurityMisconfigBanner } from './components/SecurityMisconfigBanner';
import {
  SESSION_EXPIRED_EVENT,
  clearSessionExpiredNotice,
  type SessionExpiryReason,
  type SessionExpiryNotice,
} from './libs/session/sessionExpiry';
import { clearAllAuthShared, clearScopedStorage } from './libs/session/storageCleanup';
import {
  buildFacilityPath,
  buildFacilityUrl,
  decodeFacilityParam,
  describeFacilityId,
  isFacilityMatch,
  normalizeFacilityId,
  parseFacilityPath,
} from './routes/facilityRoutes';
import { FacilityLoginResolver } from './features/login/FacilityLoginResolver';
import { addRecentFacility } from './features/login/recentFacilityStore';
import { resolveSwitchContext, type LoginSwitchContext } from './features/login/loginRouteState';
import {
  type LoginRedirectIntent,
  persistLoginNotice,
  resolveLoginDestinationSummary,
  resolveLoginNotice,
  resolveLoginNoticeFromSearch,
  resolveLoginSurfaceNotice,
  resolveLoginRedirect,
} from './features/login/loginRedirect';
import { isSystemAdminRole } from './libs/auth/roles';
import { testOrcaConnection, type OrcaConnectionTestResponse } from './features/administration/orcaConnectionApi';
import { FocusTrapDialog } from './components/modals/FocusTrapDialog';
import { NavigationGuardProvider, resolveScreenKey, useNavigationGuard } from './routes/NavigationGuardProvider';
import {
  normalizeVisitDate,
  storeChartsEncounterContext,
} from './features/charts/encounterContext';
import { saveDeepLinkContext } from './routes/deepLinkContextStorage';
import { scrubSearch } from './routes/scrubSensitiveUrl';
import { normalizeSessionResult, type SessionAuthResponse } from './LoginScreen';

type Session = LoginResult;
const AUTH_STORAGE_KEY = 'opendolphin:web-client:auth';
const isMobileImagesUiEnabled = () => import.meta.env.VITE_PATIENT_IMAGES_MOBILE_UI === '1';
const LOGOUT_ENDPOINT = (import.meta.env.VITE_LOGOUT_ENDPOINT ?? '/api/logout').trim() || '/api/logout';
const API_BASE_URL = ((import.meta.env.VITE_API_BASE_URL ?? '/api').trim().replace(/\/$/, '')) || '/api';
const SESSION_ME_ENDPOINT = `${API_BASE_URL}/session/me`;
const normalizeBasePath = (value?: string | null): string => {
  if (!value) return '/';
  const trimmed = value.trim();
  if (!trimmed) return '/';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (withLeadingSlash === '/') return '/';
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '');
  return withoutTrailingSlash || '/';
};
const BASE_PATH = normalizeBasePath(import.meta.env.VITE_BASE_PATH);
const parseUserPk = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

const loadStoredSession = (): Session | null => {
  const readRaw = () => {
    try {
      return sessionStorage.getItem(AUTH_STORAGE_KEY);
    } catch {
      return null;
    }
  };
  const resolveSession = (raw: string | null) => {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed?.facilityId || !parsed?.userId) return null;
    return {
      facilityId: parsed.facilityId,
      userId: parsed.userId,
      userPk: parseUserPk(parsed.userPk),
      displayName: parsed.displayName,
      commonName: parsed.commonName,
      clientUuid: parsed.clientUuid ?? '',
      runId: parsed.runId ?? '',
      // Role claims are revalidated via /session/me and must not be restored from browser storage.
      role: 'unknown',
      roles: undefined,
    };
  };
  try {
    const stored = resolveSession(readRaw());
    if (stored) return stored;
    // 永続化ストレージに残っている旧セッションは復元しない（ウィンドウを閉じたらログアウト扱い）。
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    clearStoredAuthFlags();
    return null;
  } catch {
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
    clearStoredAuthFlags();
    return null;
  }
};

const persistSession = (session: Session) => {
  try {
    sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        facilityId: session.facilityId,
        userId: session.userId,
        userPk: session.userPk,
        displayName: session.displayName,
        commonName: session.commonName,
        clientUuid: session.clientUuid,
        runId: session.runId,
      }),
    );
  } catch {
    // storage が使えない環境では保持せず、都度ログインし直す（セッションの永続化を避ける）。
  }
};

const clearSession = () => {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // storage が使えない環境ではスキップ
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  clearStoredAuthFlags();
};

const clearStoredCredentials = () => {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem('devPasswordPlain');
      localStorage.removeItem('devClientUuid');
      localStorage.removeItem('devRole');
      localStorage.removeItem('devFacilityId');
      localStorage.removeItem('devUserId');
    } catch {
      // ignore storage errors
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem('devPasswordPlain');
      sessionStorage.removeItem('devClientUuid');
      sessionStorage.removeItem('devRole');
      sessionStorage.removeItem('devFacilityId');
      sessionStorage.removeItem('devUserId');
    } catch {
      // ignore storage errors
    }
  }
  clearDevVolatilePlainPassword();
};

const fetchSessionMe = async (cachedSession?: Session | null): Promise<LoginResult | null> => {
  const response = await httpFetch(SESSION_ME_ENDPOINT, {
    method: 'GET',
    notifySessionExpired: false,
    cache: 'no-store',
  });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`session/me failed: ${response.status}`);
  }
  const data = (await response.json()) as SessionAuthResponse;
  return normalizeSessionResult(data, {
    facilityId: data.facilityId ?? cachedSession?.facilityId ?? '',
    userId: data.userId ?? cachedSession?.userId ?? '',
    userPk: cachedSession?.userPk,
    clientUuid: data.clientUuid ?? cachedSession?.clientUuid ?? '',
    runId: data.runId ?? cachedSession?.runId ?? '',
  });
};

const SessionContext = createContext<Session | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  const context = useOptionalSession();
  if (!context) {
    throw new Error('useSession must be used within SessionContext');
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalSession() {
  return useContext(SessionContext);
}

const TOAST_MAX_STACK = 3;
const DEFAULT_TOAST_DURATION_MS = 4200;
const TOAST_PRIORITY: Record<AppToast['tone'], number> = {
  error: 3,
  warning: 2,
  success: 1,
  info: 0,
};
const ORCA_TOP_STATUS_POLL_MS = 5 * 60 * 1000;

type OrcaTopStatus = {
  tone: 'info' | 'success' | 'warning' | 'error';
  label: string;
  detail: string;
  checkedAt: string | null;
};

const ORCA_TOP_STATUS_CHECKING: OrcaTopStatus = {
  tone: 'info',
  label: 'ORCA: 確認中',
  detail: 'ORCA 接続テストを実行しています。',
  checkedAt: null,
};

const ORCA_TOP_STATUS_FETCH_ERROR: OrcaTopStatus = {
  tone: 'error',
  label: 'ORCA: 確認失敗',
  detail: 'ORCA 接続テスト API の呼び出しに失敗しました。',
  checkedAt: null,
};

const formatOrcaTopStatusTimestamp = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP', { hour12: false });
};

const resolveOrcaTopStatus = (result: OrcaConnectionTestResponse): OrcaTopStatus => {
  const checkedAt = result.testedAt ?? null;
  if (result.ok) {
    return {
      tone: 'success',
      label: 'ORCA: 接続OK',
      detail: `HTTP ${result.orcaHttpStatus ?? '—'} / Api_Result ${result.apiResult ?? '—'}`,
      checkedAt,
    };
  }
  if (result.status === 401 || result.status === 403) {
    return {
      tone: 'warning',
      label: 'ORCA: 認証要確認',
      detail: '管理者認証が未確認です。再ログイン後に確認してください。',
      checkedAt,
    };
  }
  if (result.errorCategory === 'config_incomplete') {
    return {
      tone: 'warning',
      label: 'ORCA: 設定要確認',
      detail: result.error ?? 'ORCA 接続設定が未完了です。',
      checkedAt,
    };
  }
  return {
    tone: 'error',
    label: 'ORCA: 接続NG',
    detail: result.error ?? `HTTP ${result.status}`,
    checkedAt,
  };
};

const isSensitiveScrubPath = (pathname: string): boolean => {
  const facility = parseFacilityPath(pathname);
  if (facility?.suffix) {
    return (
      facility.suffix === '/reception' ||
      facility.suffix === '/charts' ||
      facility.suffix === '/patients' ||
      facility.suffix === '/m/images'
    );
  }
  return (
    pathname === '/reception' ||
    pathname === '/reception/' ||
    pathname === '/charts' ||
    pathname === '/charts/' ||
    pathname === '/patients' ||
    pathname === '/patients/' ||
    pathname === '/m/images' ||
    pathname === '/m/images/'
  );
};

// Debug pages must never be exposed from production-like builds.
const DEBUG_PAGES_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEBUG_PAGES === '1';
const DebugHubPage = DEBUG_PAGES_ENABLED
  ? lazy(() => import('./features/debug/DebugHubPage').then((m) => ({ default: m.DebugHubPage })))
  : null;
const OrcaApiConsolePage = DEBUG_PAGES_ENABLED
  ? lazy(() => import('./features/debug/OrcaApiConsolePage').then((m) => ({ default: m.OrcaApiConsolePage })))
  : null;
const MobilePatientPickerDemoPage = DEBUG_PAGES_ENABLED
  ? lazy(() => import('./features/debug/MobilePatientPickerDemoPage').then((m) => ({ default: m.MobilePatientPickerDemoPage })))
  : null;

const buildSwitchContext = (
  session: Session,
  reason: LoginSwitchContext['reason'] = 'manual',
): LoginSwitchContext => ({
  mode: 'switch',
  reason,
  actor: {
    facilityId: session.facilityId,
    userId: session.userId,
    role: session.role,
    runId: session.runId,
  },
});

const asLocationStateRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
};

export function AppRouter() {
  return (
    <BrowserRouter basename={BASE_PATH}>
      <AppRouterWithNavigation />
    </BrowserRouter>
  );
}

export function AppRouterWithNavigation() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionBootstrapped, setSessionBootstrapped] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<LoginRedirectIntent | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLoginSuccess = useCallback(
    (result: LoginResult, context?: LoginSwitchContext) => {
      const nextActor = {
        facilityId: result.facilityId,
        userId: result.userId,
        role: result.role,
        runId: result.runId,
      };
      const previousActor = context?.actor ?? (session ?? undefined);
      if (
        context?.mode === 'switch' ||
        (session &&
          (session.facilityId !== result.facilityId ||
            session.userId !== result.userId ||
            session.role !== result.role))
      ) {
        logAuditEvent({
          runId: result.runId,
          source: 'auth',
          note: 'role-switch',
          payload: {
            action: 'role-switch',
            screen: 'login',
            reason: context?.reason ?? 'manual',
            previous: previousActor,
            next: nextActor,
          },
        });
      }
      updateObservabilityMeta({ runId: result.runId });
      addRecentFacility(result.facilityId);
      setSession(result);
      persistSession(result);

      const fallbackPath = buildFacilityPath(result.facilityId, '/reception');
      const isSwitchLogin = context?.mode === 'switch';
      const redirectIntent = isSwitchLogin ? null : resolveLoginRedirect(location);
      setPendingRedirect({
        to: isSwitchLogin ? fallbackPath : (redirectIntent?.to ?? fallbackPath),
        state: isSwitchLogin ? undefined : redirectIntent?.state,
      });
    },
    [location, session],
  );

  const requestServerLogoutBestEffort = useCallback((actor?: Session) => {
    const runId = actor?.runId;
    const actorLabel = actor ? `${actor.facilityId}:${actor.userId}` : undefined;
    void (async () => {
      try {
        const response = await httpFetch(LOGOUT_ENDPOINT, {
          method: 'POST',
          notifySessionExpired: false,
        });
        if (response.status === 404) {
          logAuditEvent({
            runId,
            source: 'auth',
            note: 'server logout unsupported',
            payload: {
              action: 'logout',
              outcome: 'unsupported',
              endpoint: LOGOUT_ENDPOINT,
              status: response.status,
              actor: actorLabel,
            },
          });
          return;
        }
        if (!response.ok) {
          logAuditEvent({
            runId,
            source: 'auth',
            note: 'server logout failed',
            payload: {
              action: 'logout',
              outcome: 'error',
              endpoint: LOGOUT_ENDPOINT,
              status: response.status,
              actor: actorLabel,
            },
          });
          return;
        }
        logAuditEvent({
          runId,
          source: 'auth',
          note: 'server logout success',
          payload: {
            action: 'logout',
            outcome: 'success',
            endpoint: LOGOUT_ENDPOINT,
            status: response.status,
            actor: actorLabel,
          },
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'network_error';
        logAuditEvent({
          runId,
          source: 'auth',
          note: 'server logout failed',
          payload: {
            action: 'logout',
            outcome: 'error',
            endpoint: LOGOUT_ENDPOINT,
            status: 0,
            actor: actorLabel,
            reason,
          },
        });
      }
    })();
  }, []);

  const handleLogout = useCallback(
    (reason: 'logout' | SessionExpiryReason = 'logout') => {
      if (reason === 'logout') {
        clearSessionExpiredNotice();
      }
      persistLoginNotice({ reason });
      const current = session;
      requestServerLogoutBestEffort(current ?? undefined);
      if (current) {
        clearScopedStorage({ facilityId: current.facilityId, userId: current.userId });
      }
      clearAllAuthShared();
      clearStoredCredentials();
      clearSession();
      setSession(null);
      navigate(
        current && reason === 'logout'
          ? `${buildFacilityPath(current.facilityId, '/login')}?reason=logout`
          : current
            ? buildFacilityPath(current.facilityId, '/login')
            : '/login',
        {
          replace: true,
          state: { loginNotice: { reason } },
        },
      );
    },
    [navigate, requestServerLogoutBestEffort, session],
  );

  useEffect(() => {
    let active = true;
    const stored = loadStoredSession();
    if (stored?.runId) {
      updateObservabilityMeta({ runId: stored.runId });
    }
    void (async () => {
      try {
        const restored = await fetchSessionMe(stored);
        if (!active) return;
        if (restored) {
          persistSession(restored);
          setSession(restored);
          updateObservabilityMeta({ runId: restored.runId });
        } else {
          clearAllAuthShared();
          clearStoredCredentials();
          clearSession();
          setSession(null);
        }
      } catch {
        if (!active) return;
        clearSession();
        setSession(null);
      } finally {
        if (active) {
          setSessionBootstrapped(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pendingRedirect || !session) return;
    navigate(pendingRedirect.to, { replace: true, state: pendingRedirect.state });
    setPendingRedirect(null);
  }, [navigate, pendingRedirect, session]);

  useEffect(() => {
    if (!isSensitiveScrubPath(location.pathname)) return;
    const { scrubbedSearch, removed } = scrubSearch(location.search);
    if (scrubbedSearch === location.search) return;
    saveDeepLinkContext(removed);

    const encounterContext = {
      patientId: removed.patientId,
      appointmentId: removed.appointmentId,
      receptionId: removed.receptionId,
      scheduleKey: removed.scheduleKey,
      encounterKey: removed.encounterKey,
      visitDate: normalizeVisitDate(removed.visitDate),
    };
    if (
      encounterContext.patientId ||
      encounterContext.appointmentId ||
      encounterContext.receptionId ||
      encounterContext.scheduleKey ||
      encounterContext.encounterKey ||
      encounterContext.visitDate
    ) {
      storeChartsEncounterContext(
        encounterContext,
        session
          ? {
              facilityId: session.facilityId,
              userId: session.userId,
            }
          : undefined,
      );
    }

    const currentState = asLocationStateRecord(location.state);
    const nextCarryover = {
      ...(typeof currentState.carryover === 'object' && currentState.carryover !== null && !Array.isArray(currentState.carryover)
        ? (currentState.carryover as Record<string, unknown>)
        : {}),
      ...(removed.kw || removed.keyword ? { kw: removed.kw ?? removed.keyword } : {}),
    };
    const nextEncounterState = {
      ...(typeof currentState.encounter === 'object' && currentState.encounter !== null && !Array.isArray(currentState.encounter)
        ? (currentState.encounter as Record<string, unknown>)
        : {}),
      ...(encounterContext.patientId ? { patientId: encounterContext.patientId } : {}),
      ...(encounterContext.appointmentId ? { appointmentId: encounterContext.appointmentId } : {}),
      ...(encounterContext.receptionId ? { receptionId: encounterContext.receptionId } : {}),
      ...(encounterContext.scheduleKey ? { scheduleKey: encounterContext.scheduleKey } : {}),
      ...(encounterContext.encounterKey ? { encounterKey: encounterContext.encounterKey } : {}),
      ...(encounterContext.visitDate ? { visitDate: encounterContext.visitDate } : {}),
    };

    navigate(
      {
        pathname: location.pathname,
        search: scrubbedSearch,
        hash: location.hash,
      },
      {
        replace: true,
        state: {
          ...currentState,
          carryover: nextCarryover,
          encounter: nextEncounterState,
          ...(encounterContext.patientId ? { patientId: encounterContext.patientId } : {}),
          ...(encounterContext.appointmentId ? { appointmentId: encounterContext.appointmentId } : {}),
          ...(encounterContext.receptionId ? { receptionId: encounterContext.receptionId } : {}),
          ...(encounterContext.scheduleKey ? { scheduleKey: encounterContext.scheduleKey } : {}),
          ...(encounterContext.encounterKey ? { encounterKey: encounterContext.encounterKey } : {}),
          ...(encounterContext.visitDate ? { visitDate: encounterContext.visitDate } : {}),
          ...(removed.kw || removed.keyword ? { kw: removed.kw ?? removed.keyword, keyword: removed.kw ?? removed.keyword } : {}),
        },
      },
    );
  }, [
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
    session,
  ]);

  useEffect(() => {
    const onSessionExpired = (event: Event) => {
      const detail = (event as CustomEvent<SessionExpiryNotice>).detail;
      if (session) {
        logAuditEvent({
          runId: session.runId,
          source: 'auth',
          note: 'session expired',
          payload: {
            reason: detail?.reason,
            status: detail?.status,
            screen: 'session',
            actor: `${session.facilityId}:${session.userId}`,
          },
        });
      }
      handleLogout(detail?.reason ?? 'timeout');
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired as EventListener);
      }
    };
  }, [handleLogout, session]);

  return (
    <Routes>
      <Route
        element={
          <FacilityGate
            session={session}
            sessionBootstrapped={sessionBootstrapped}
            onLogout={() => handleLogout('logout')}
          />
        }
      >
        <Route path="login" element={<FacilityLoginResolver />} />
        <Route path="outpatient-mock" element={<LegacyOutpatientMockNotFound />} />
        <Route path="f/:facilityId/login" element={<FacilityLoginScreen onLoginSuccess={handleLoginSuccess} />} />
        <Route path="f/:facilityId/*" element={<FacilityShell session={session} />} />
        <Route path="*" element={<LegacyRootRedirect session={session} />} />
      </Route>
    </Routes>
  );
}

function FacilityGate({
  session,
  sessionBootstrapped,
  onLogout,
}: {
  session: Session | null;
  sessionBootstrapped: boolean;
  onLogout: () => void;
}) {
  const location = useLocation();
  const loginRoute = isLoginRoute(location.pathname);
  const redirectIntent = resolveLoginRedirect(location);
  if (!sessionBootstrapped) {
    return <SessionBootstrapScreen />;
  }
  if (!session) {
    if (loginRoute) {
      return <Outlet />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (loginRoute) {
    const nextPath = redirectIntent?.to ?? buildFacilityPath(session.facilityId, '/reception');
    return <Navigate to={nextPath} state={redirectIntent?.state} replace />;
  }

  return (
    <SessionContext.Provider value={session}>
      <AuthServiceProvider
        initialFlags={{
          runId: session.runId,
          cacheHit: false,
          missingMaster: true,
          dataSourceTransition: 'snapshot',
        }}
        sessionKey={`${session.facilityId}:${session.userId}`}
      >
        <NavigationGuardProvider>
          <AppLayout onLogout={onLogout} />
        </NavigationGuardProvider>
      </AuthServiceProvider>
    </SessionContext.Provider>
  );
}

function FacilityShell({ session }: { session: Session | null }) {
  const { facilityId } = useParams();
  const location = useLocation();
  const normalizedId = normalizeFacilityId(decodeFacilityParam(facilityId) ?? facilityId);

  if (!session) {
    const next = buildFacilityUrl(normalizedId, location.pathname, location.search);
    return <Navigate to="/login" state={{ from: next }} replace />;
  }

  if (normalizedId && !isFacilityMatch(normalizedId, session.facilityId)) {
    return <FacilityMismatchNotice session={session} requestedFacilityId={normalizedId} />;
  }

  return (
    <Routes>
      <Route index element={<Navigate to={buildFacilityPath(session.facilityId, '/reception')} replace />} />
      <Route path="reception" element={<ConnectedReception />} />
      <Route path="charts" element={<ConnectedCharts />} />
      <Route path="charts/order-sets" element={<OrderSetEditorPage />} />
      <Route path="charts/print/outpatient" element={<ChartsOutpatientPrintPage />} />
      <Route path="charts/print/document" element={<ChartsDocumentPrintPage />} />
      {isMobileImagesUiEnabled() ? <Route path="m/images" element={<MobileImagesUploadPage />} /> : null}
      <Route path="patients" element={<ConnectedPatients />} />
      <Route path="administration" element={<AdministrationGate session={session} />} />
      {DEBUG_PAGES_ENABLED ? <Route path="debug" element={<DebugHubGate session={session} />} /> : null}
      {DEBUG_PAGES_ENABLED ? (
        <Route path="debug/outpatient-mock" element={<DebugOutpatientMockGate session={session} />} />
      ) : null}
      {DEBUG_PAGES_ENABLED ? (
        <Route path="debug/mobile-patient-picker" element={<DebugMobilePatientPickerGate session={session} />} />
      ) : null}
      {DEBUG_PAGES_ENABLED ? <Route path="debug/orca-api" element={<DebugOrcaApiGate session={session} />} /> : null}
      <Route path="*" element={<Navigate to={buildFacilityPath(session.facilityId, '/reception')} replace />} />
    </Routes>
  );
}

function SessionBootstrapScreen() {
  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="session-bootstrap">
        <header className="login-card__header">
          <h1 id="session-bootstrap">セッションを確認中…</h1>
          <p>現在のログイン状態をサーバーへ確認しています。</p>
        </header>
      </section>
    </main>
  );
}

function AdministrationGate({ session }: { session: Session }) {
  const navigate = useNavigate();
  const isAllowed = isSystemAdminRole(session.role);

  useEffect(() => {
    if (isAllowed) return;
    logAuditEvent({
      runId: session.runId,
      source: 'authz',
      note: 'administration access denied',
      payload: {
        operation: 'navigate',
        screen: 'administration',
        outcome: 'blocked',
        requiredRole: 'system_admin',
        role: session.role,
        actor: `${session.facilityId}:${session.userId}`,
      },
    });
  }, [isAllowed, session.facilityId, session.role, session.runId, session.userId]);

  if (isAllowed) {
    return <ConnectedAdministration />;
  }

  return (
    <div style={{ maxWidth: '620px', margin: '2rem auto' }}>
      <div className="status-message is-error" role="status">
        <p>管理画面はシステム管理者のみ利用できます。</p>
        <p>必要権限: システム管理者</p>
        <p>サポート共有用 RUN_ID: {session.runId || '未取得'}</p>
        <p>権限付与が必要な場合はシステム管理者へ依頼してください。</p>
      </div>
      <div className="login-form__actions" style={{ marginTop: '1rem' }}>
        <button type="button" onClick={() => navigate(buildFacilityPath(session.facilityId, '/reception'), { replace: true })}>
          受付へ戻る
        </button>
      </div>
    </div>
  );
}

function FacilityMismatchNotice({
  session,
  requestedFacilityId,
}: {
  session: Session;
  requestedFacilityId: string;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    logAuditEvent({
      runId: session.runId,
      source: 'authz',
      note: 'facility boundary denied',
      payload: {
        action: 'navigate',
        screen: 'facility',
        outcome: 'denied',
        facilityId: session.facilityId,
        requestedFacilityId,
        userId: session.userId,
        role: session.role,
      },
    });
  }, [requestedFacilityId, session.facilityId, session.role, session.runId, session.userId]);

  return (
    <div style={{ maxWidth: '620px', margin: '2rem auto' }}>
      <div className="status-message is-error" role="status">
        <p>施設IDが現在のログインと一致しないためアクセスを拒否しました。</p>
        <p>
          要求された施設: {describeFacilityId(requestedFacilityId)} / 現在の施設: {describeFacilityId(session.facilityId)}
        </p>
        <p>現在のログイン: ユーザー={session.userId} / role={session.role} / RUN_ID={session.runId}</p>
        <p>施設/ユーザー切替は上部の「施設/ユーザー切替」からログアウト後に実施してください。</p>
      </div>
      <div className="login-form__actions" style={{ marginTop: '1rem' }}>
        <button type="button" onClick={() => navigate(buildFacilityPath(session.facilityId, '/reception'), { replace: true })}>
          現在の施設へ戻る
        </button>
      </div>
    </div>
  );
}

function FacilityLoginScreen({
  onLoginSuccess,
}: {
  onLoginSuccess: (result: LoginResult, context?: LoginSwitchContext) => void;
}) {
  const { facilityId } = useParams();
  const location = useLocation();
  const normalizedId = normalizeFacilityId(decodeFacilityParam(facilityId) ?? facilityId);
  const switchContext = useMemo(() => resolveSwitchContext(location.state), [location.state]);
  const initialNotice = useMemo(() => {
    return resolveLoginSurfaceNotice({
      loginNotice: resolveLoginNotice(location.state) ?? resolveLoginNoticeFromSearch(location.search),
    });
  }, [location.search, location.state]);
  const destinationSummary = useMemo(
    () => resolveLoginDestinationSummary(location.state, normalizedId ?? undefined),
    [location.state, normalizedId],
  );

  return (
    <LoginScreen
      onLoginSuccess={(result) => onLoginSuccess(result, switchContext)}
      initialFacilityId={normalizedId ?? ''}
      lockFacilityId={Boolean(normalizedId)}
      initialNotice={initialNotice}
      destinationSummary={destinationSummary}
    />
  );
}

function LegacyOutpatientMockNotFound() {
  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="legacy-outpatient-mock">
        <header className="login-card__header">
          <h1 id="legacy-outpatient-mock">指定されたページは存在しません</h1>
          <p>旧導線（/outpatient-mock）は本番環境では無効化されています。</p>
        </header>
        <div className="login-form__actions">
          <NavLink to="/login">ログイン画面へ戻る</NavLink>
        </div>
      </section>
    </main>
  );
}

function DebugOutpatientMockGate({ session }: { session: Session }) {
  const navigate = useNavigate();
  const hasEnvAccess = DEBUG_PAGES_ENABLED;
  const hasRoleAccess = isSystemAdminRole(session.role);
  const isAllowed = hasEnvAccess && hasRoleAccess;
  const envFlagValue = DEBUG_PAGES_ENABLED ? '1' : '0';

  useEffect(() => {
    if (isAllowed) return;
    const denialReasons: string[] = [];
    if (!hasEnvAccess) denialReasons.push('env flag disabled');
    if (!hasRoleAccess) denialReasons.push('role missing');
    logAuditEvent({
      runId: session.runId,
      source: 'authz',
      note: 'debug access denied',
      payload: {
        action: 'navigate',
        screen: 'debug',
        debug: true,
        debugFeature: 'outpatient-mock',
        requiredRole: 'system_admin',
        role: session.role,
        envFlags: { VITE_ENABLE_DEBUG_PAGES: envFlagValue },
        denialReasons,
        actor: `${session.facilityId}:${session.userId}`,
      },
    });
  }, [
    envFlagValue,
    hasEnvAccess,
    hasRoleAccess,
    isAllowed,
    session.facilityId,
    session.role,
    session.runId,
    session.userId,
  ]);

  if (!isAllowed) {
    return (
      <div style={{ maxWidth: '620px', margin: '2rem auto' }}>
        <div className="status-message is-error" role="status">
          <p>権限がないためデバッグ画面へのアクセスを拒否しました。</p>
          <p>必要権限: システム管理者 / 現在: {session.role}</p>
          <p>ENV: VITE_ENABLE_DEBUG_PAGES={envFlagValue}</p>
          {!hasEnvAccess ? <p>環境フラグが OFF のため表示されません。</p> : null}
          <p>ログイン中: 施設ID={describeFacilityId(session.facilityId)} / ユーザー={session.userId}</p>
        </div>
        <div className="login-form__actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => navigate(buildFacilityPath(session.facilityId, '/reception'), { replace: true })}
          >
            受付へ戻る
          </button>
        </div>
      </div>
    );
  }

  const OutpatientMockPage = lazy(() =>
    import('./features/outpatient/OutpatientMockPage').then((m) => ({ default: m.OutpatientMockPage })),
  );
  return (
    <Suspense fallback={<div className="status-message">Outpatient Mock を読み込み中…</div>}>
      <OutpatientMockPage />
    </Suspense>
  );
}

function DebugMobilePatientPickerGate({ session }: { session: Session }) {
  const navigate = useNavigate();
  const hasEnvAccess = DEBUG_PAGES_ENABLED;
  const hasRoleAccess = isSystemAdminRole(session.role);
  const isAllowed = hasEnvAccess && hasRoleAccess;
  const envFlagValue = DEBUG_PAGES_ENABLED ? '1' : '0';

  useEffect(() => {
    if (isAllowed) return;
    const denialReasons: string[] = [];
    if (!hasEnvAccess) denialReasons.push('env flag disabled');
    if (!hasRoleAccess) denialReasons.push('role missing');
    logAuditEvent({
      runId: session.runId,
      source: 'authz',
      note: 'debug access denied',
      payload: {
        action: 'navigate',
        screen: 'debug',
        debug: true,
        debugFeature: 'mobile-patient-picker',
        requiredRole: 'system_admin',
        role: session.role,
        envFlags: { VITE_ENABLE_DEBUG_PAGES: envFlagValue },
        denialReasons,
        actor: `${session.facilityId}:${session.userId}`,
      },
    });
  }, [
    envFlagValue,
    hasEnvAccess,
    hasRoleAccess,
    isAllowed,
    session.facilityId,
    session.role,
    session.runId,
    session.userId,
  ]);

  if (!isAllowed) {
    return (
      <div style={{ maxWidth: '620px', margin: '2rem auto' }}>
        <div className="status-message is-error" role="status">
          <p>権限がないためデバッグ画面へのアクセスを拒否しました。</p>
          <p>必要権限: システム管理者 / 現在: {session.role}</p>
          <p>ENV: VITE_ENABLE_DEBUG_PAGES={envFlagValue}</p>
          {!hasEnvAccess ? <p>環境フラグが OFF のため表示されません。</p> : null}
          <p>ログイン中: 施設ID={describeFacilityId(session.facilityId)} / ユーザー={session.userId}</p>
        </div>
        <div className="login-form__actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => navigate(buildFacilityPath(session.facilityId, '/reception'), { replace: true })}
          >
            受付へ戻る
          </button>
        </div>
      </div>
    );
  }

  if (!MobilePatientPickerDemoPage) return null;
  return (
    <Suspense fallback={<div className="status-message">Mobile Patient Picker を読み込み中…</div>}>
      <MobilePatientPickerDemoPage />
    </Suspense>
  );
}

function DebugHubGate({ session }: { session: Session }) {
  const navigate = useNavigate();
  const hasEnvAccess = DEBUG_PAGES_ENABLED;
  const hasRoleAccess = isSystemAdminRole(session.role);
  const isAllowed = hasEnvAccess && hasRoleAccess;
  const envFlagValue = DEBUG_PAGES_ENABLED ? '1' : '0';

  useEffect(() => {
    if (isAllowed) return;
    const denialReasons: string[] = [];
    if (!hasEnvAccess) denialReasons.push('env flag disabled');
    if (!hasRoleAccess) denialReasons.push('role missing');
    logAuditEvent({
      runId: session.runId,
      source: 'authz',
      note: 'debug access denied',
      payload: {
        action: 'navigate',
        screen: 'debug',
        debug: true,
        debugFeature: 'hub',
        requiredRole: 'system_admin',
        role: session.role,
        envFlags: { VITE_ENABLE_DEBUG_PAGES: envFlagValue },
        denialReasons,
        actor: `${session.facilityId}:${session.userId}`,
      },
    });
  }, [
    envFlagValue,
    hasEnvAccess,
    hasRoleAccess,
    isAllowed,
    session.facilityId,
    session.role,
    session.runId,
    session.userId,
  ]);

  if (!isAllowed) {
    return (
      <div style={{ maxWidth: '620px', margin: '2rem auto' }}>
        <div className="status-message is-error" role="status">
          <p>権限がないためデバッグ導線へのアクセスを拒否しました。</p>
          <p>必要権限: システム管理者 / 現在: {session.role}</p>
          <p>ENV: VITE_ENABLE_DEBUG_PAGES={envFlagValue}</p>
          {!hasEnvAccess ? <p>環境フラグが OFF のため表示されません。</p> : null}
          <p>ログイン中: 施設ID={describeFacilityId(session.facilityId)} / ユーザー={session.userId}</p>
        </div>
        <div className="login-form__actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => navigate(buildFacilityPath(session.facilityId, '/reception'), { replace: true })}
          >
            受付へ戻る
          </button>
        </div>
      </div>
    );
  }

  if (!DebugHubPage) return null;
  return (
    <Suspense fallback={<div className="status-message">Debug Hub を読み込み中…</div>}>
      <DebugHubPage />
    </Suspense>
  );
}

function DebugOrcaApiGate({ session }: { session: Session }) {
  const navigate = useNavigate();
  const hasEnvAccess = DEBUG_PAGES_ENABLED;
  const hasRoleAccess = isSystemAdminRole(session.role);
  const isAllowed = hasEnvAccess && hasRoleAccess;
  const envFlagValue = DEBUG_PAGES_ENABLED ? '1' : '0';

  useEffect(() => {
    if (isAllowed) return;
    const denialReasons: string[] = [];
    if (!hasEnvAccess) denialReasons.push('env flag disabled');
    if (!hasRoleAccess) denialReasons.push('role missing');
    logAuditEvent({
      runId: session.runId,
      source: 'authz',
      note: 'debug access denied',
      payload: {
        action: 'navigate',
        screen: 'debug',
        debug: true,
        debugFeature: 'orca-api-console',
        requiredRole: 'system_admin',
        role: session.role,
        envFlags: { VITE_ENABLE_DEBUG_PAGES: envFlagValue },
        denialReasons,
        actor: `${session.facilityId}:${session.userId}`,
      },
    });
  }, [
    envFlagValue,
    hasEnvAccess,
    hasRoleAccess,
    isAllowed,
    session.facilityId,
    session.role,
    session.runId,
    session.userId,
  ]);

  if (!isAllowed) {
    return (
      <div style={{ maxWidth: '620px', margin: '2rem auto' }}>
        <div className="status-message is-error" role="status">
          <p>権限がないため ORCA API コンソールへのアクセスを拒否しました。</p>
          <p>必要権限: システム管理者 / 現在: {session.role}</p>
          <p>ENV: VITE_ENABLE_DEBUG_PAGES={envFlagValue}</p>
          {!hasEnvAccess ? <p>環境フラグが OFF のため表示されません。</p> : null}
          <p>ログイン中: 施設ID={describeFacilityId(session.facilityId)} / ユーザー={session.userId}</p>
        </div>
        <div className="login-form__actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => navigate(buildFacilityPath(session.facilityId, '/reception'), { replace: true })}
          >
            受付へ戻る
          </button>
        </div>
      </div>
    );
  }

  if (!OrcaApiConsolePage) return null;
  return (
    <Suspense fallback={<div className="status-message">ORCA API Console を読み込み中…</div>}>
      <OrcaApiConsolePage />
    </Suspense>
  );
}

function LegacyRootRedirect({ session }: { session: Session | null }) {
  const location = useLocation();
  const redirectFromLoginState = resolveLoginRedirect(location);
  if (redirectFromLoginState) {
    return <Navigate to={redirectFromLoginState.to} state={redirectFromLoginState.state} replace />;
  }

  if (!session) {
    return <Navigate to="/login" state={{}} replace />;
  }

  return <Navigate to={buildFacilityPath(session.facilityId, '/reception')} replace />;
}

const isLoginRoute = (pathname: string) => {
  if (pathname === '/login') return true;
  const match = parseFacilityPath(pathname);
  return match?.suffix === '/login';
};

type AppOutletErrorBoundaryProps = {
  children: ReactNode;
  screenKey: string;
  runId?: string;
  traceId?: string;
  onReload: () => void;
  onReturnToReception: () => void;
  onCopyMeta?: () => void;
};

type AppOutletErrorBoundaryState = {
  hasError: boolean;
};

class AppOutletErrorBoundary extends Component<AppOutletErrorBoundaryProps, AppOutletErrorBoundaryState> {
  state: AppOutletErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_error: Error): AppOutletErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logAuditEvent({
      runId: this.props.runId,
      source: 'ui',
      note: 'app layout render error',
      payload: {
        action: 'render',
        screen: 'app-layout',
        traceId: this.props.traceId,
        errorName: error.name,
        errorMessage: error.message,
        componentStack: info.componentStack,
      },
    });
  }

  componentDidUpdate(prevProps: AppOutletErrorBoundaryProps) {
    if (prevProps.screenKey !== this.props.screenKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <section className="status-message is-error app-shell__crash-fallback" role="alert">
        <h2 style={{ marginTop: 0 }}>画面エラーが発生しました</h2>
        <p>業務継続のため、画面を再読み込みするか受付へ戻ってください。</p>
        <p>
          RUN_ID: {this.props.runId ?? '未取得'} / traceId: {this.props.traceId ?? '未取得'}
        </p>
        <div className="app-shell__crash-actions">
          <button type="button" onClick={this.props.onReload}>
            画面を再読み込み
          </button>
          <button type="button" onClick={this.props.onReturnToReception}>
            受付へ戻る
          </button>
          {this.props.onCopyMeta ? (
            <button type="button" onClick={this.props.onCopyMeta}>
              RUN_ID/traceId をコピー
            </button>
          ) : null}
        </div>
      </section>
    );
  }
}

function AppLayout({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSession();
  const { flags } = useAuthService();
  const { isDirty, dirtySources } = useNavigationGuard();
  const isSystemAdmin = isSystemAdminRole(session.role);
  const resolvedRunId = flags.runId || session.runId;
  const traceId = getObservabilityMeta().traceId;
  const outletScreenKey = useMemo(
    () => resolveScreenKey({ pathname: location.pathname, search: location.search, state: location.state }),
    [location.pathname, location.search, location.state],
  );
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const [orcaTopStatus, setOrcaTopStatus] = useState<OrcaTopStatus>(ORCA_TOP_STATUS_CHECKING);
  const [sessionExitDialogOpen, setSessionExitDialogOpen] = useState(false);
  const toastTimers = useRef<Map<string, number>>(new Map());
  const runIdNoticeRef = useRef<string | undefined>(resolvedRunId);

  const enqueueToast = useCallback((toast: AppToastInput) => {
    const id = toast.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const durationMs = toast.durationMs ?? DEFAULT_TOAST_DURATION_MS;
    let shouldKeep = true;
    setToasts((prev) => {
      if (prev.some((item) => item.id === id)) {
        shouldKeep = false;
        return prev;
      }
      const next = [...prev, { id, ...toast }];
      if (next.length <= TOAST_MAX_STACK) {
        return next;
      }
      const ranked = next.map((item, index) => ({
        id: item.id,
        priority: TOAST_PRIORITY[item.tone],
        index,
      }));
      ranked.sort((a, b) => b.priority - a.priority || b.index - a.index);
      const keepIds = new Set(ranked.slice(0, TOAST_MAX_STACK).map((item) => item.id));
      shouldKeep = keepIds.has(id);
      next
        .filter((item) => !keepIds.has(item.id))
        .forEach((item) => {
          const timer = toastTimers.current.get(item.id);
          if (timer) {
            window.clearTimeout(timer);
            toastTimers.current.delete(item.id);
          }
        });
      return next.filter((item) => keepIds.has(item.id));
    });
    if (!shouldKeep) return;
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
      toastTimers.current.delete(id);
    }, durationMs);
    toastTimers.current.set(id, timer);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
    const timer = toastTimers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      toastTimers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setToasts((prev) => {
          const removed = prev.length ? prev[prev.length - 1] : undefined;
          if (removed) {
            const timer = toastTimers.current.get(removed.id);
            if (timer) {
              window.clearTimeout(timer);
              toastTimers.current.delete(removed.id);
            }
          }
          return prev.slice(0, -1);
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      toastTimers.current.forEach((timer) => window.clearTimeout(timer));
      toastTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!resolvedRunId || resolvedRunId === session.runId) return;
    persistSession({ ...session, runId: resolvedRunId });
  }, [resolvedRunId, session]);

  useEffect(() => {
    if (!isSystemAdmin) {
      setOrcaTopStatus(ORCA_TOP_STATUS_CHECKING);
      return;
    }
    let cancelled = false;
    let timerId: number | null = null;
    const refreshOrcaTopStatus = async (showPending: boolean) => {
      if (showPending) {
        setOrcaTopStatus(ORCA_TOP_STATUS_CHECKING);
      }
      try {
        const result = await testOrcaConnection();
        if (cancelled) return;
        setOrcaTopStatus(resolveOrcaTopStatus(result));
      } catch {
        if (cancelled) return;
        setOrcaTopStatus(ORCA_TOP_STATUS_FETCH_ERROR);
      }
    };
    void refreshOrcaTopStatus(true);
    timerId = window.setInterval(() => {
      void refreshOrcaTopStatus(false);
    }, ORCA_TOP_STATUS_POLL_MS);
    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearInterval(timerId);
      }
    };
  }, [isSystemAdmin]);

  useEffect(() => {
    if (!resolvedRunId || runIdNoticeRef.current === resolvedRunId) return;
    runIdNoticeRef.current = resolvedRunId;
    enqueueToast({ tone: 'info', message: 'RUN_ID が更新されました', detail: resolvedRunId, id: `runid-${resolvedRunId}` });
  }, [enqueueToast, resolvedRunId]);

  useEffect(() => {
    if (!isDirty && sessionExitDialogOpen) {
      setSessionExitDialogOpen(false);
    }
  }, [isDirty, sessionExitDialogOpen]);

  const orcaTopStatusTooltip = useMemo(() => {
    const checkedAt = formatOrcaTopStatusTimestamp(orcaTopStatus.checkedAt);
    if (!checkedAt) return orcaTopStatus.detail;
    return `${orcaTopStatus.detail} / 最終確認: ${checkedAt}`;
  }, [orcaTopStatus.checkedAt, orcaTopStatus.detail]);

  const handleCopyRunId = async () => {
    const runId = resolvedRunId;
    if (!runId) {
      enqueueToast({ tone: 'error', message: 'RUN_ID が未取得です', detail: 'ログイン情報を確認してください。' });
      return;
    }
    try {
      const method = await copyRunIdToClipboard(runId);
      if (method === 'prompt') {
        enqueueToast({ tone: 'info', message: '手動コピーを開きました', detail: runId, durationMs: 3600 });
      } else {
        enqueueToast({ tone: 'success', message: 'RUN_ID をコピーしました', detail: runId, durationMs: 2400 });
      }
    } catch {
      enqueueToast({
        tone: 'error',
        message: 'RUN_ID のコピーに失敗しました',
        detail: 'クリップボード権限を確認してください。',
        durationMs: 2400,
      });
    }
  };

  const executeSwitchAccount = useCallback(() => {
    const switchContext = buildSwitchContext(session, 'manual');
    logAuditEvent({
      runId: resolvedRunId,
      source: 'auth',
      note: 'switch initiated',
      payload: {
        action: 'role-switch',
        screen: 'navigation',
        reason: switchContext.reason,
        previous: switchContext.actor,
      },
    });
    onLogout();
    navigate('/login', { state: { from: location, switchContext }, replace: true });
  }, [location, navigate, onLogout, resolvedRunId, session]);

  const requestLogout = useCallback(() => {
    if (!isDirty) {
      onLogout();
      return;
    }
    setSessionExitDialogOpen(true);
  }, [isDirty, onLogout]);

  const requestSwitchAccount = useCallback(() => {
    if (!isDirty) {
      executeSwitchAccount();
      return;
    }
    setSessionExitDialogOpen(true);
  }, [executeSwitchAccount, isDirty]);

  const handleSessionExitCancel = useCallback(() => {
    setSessionExitDialogOpen(false);
  }, []);

  const handleSessionExitLogout = useCallback(() => {
    setSessionExitDialogOpen(false);
    onLogout();
  }, [onLogout]);

  const handleSessionExitSwitch = useCallback(() => {
    setSessionExitDialogOpen(false);
    executeSwitchAccount();
  }, [executeSwitchAccount]);

  const handleReloadApp = useCallback(() => {
    window.location.reload();
  }, []);

  const handleReturnToReceptionFromError = useCallback(() => {
    window.location.assign(buildFacilityPath(session.facilityId, '/reception'));
  }, [session.facilityId]);

  const handleCopyErrorMeta = useCallback(async () => {
    const shareText = `runId=${resolvedRunId ?? 'unknown'} / traceId=${traceId ?? 'unknown'}`;
    try {
      const method = await copyTextToClipboard(shareText);
      if (method === 'prompt') {
        enqueueToast({ tone: 'info', message: '手動コピーを開きました', detail: shareText, durationMs: 3600 });
      } else {
        enqueueToast({ tone: 'success', message: '障害情報をコピーしました', detail: shareText, durationMs: 2400 });
      }
    } catch {
      enqueueToast({ tone: 'error', message: '障害情報のコピーに失敗しました', detail: 'ブラウザ権限を確認してください。' });
    }
  }, [enqueueToast, resolvedRunId, traceId]);

  return (
    <AppToastProvider value={{ enqueue: enqueueToast, dismiss: dismissToast }}>
      <ChartEventStreamBridge />
      <a className="skip-link" href="#app-shell-main">
        本文へスキップ
      </a>
      <div className="app-shell">
        <header className="app-shell__topbar" data-run-id={resolvedRunId}>
          <div className="app-shell__brand">
            <span className="app-shell__title">OpenDolphin Web</span>
            <small className="app-shell__subtitle">電子カルテデモシェル</small>
          </div>
          <div className="app-shell__session" data-run-id={resolvedRunId}>
            <span className="app-shell__pill app-shell__pill--fixed">施設ID: {session.facilityId}</span>
            <span className="app-shell__pill app-shell__pill--fixed">
              ユーザー: {session.displayName ?? session.commonName ?? session.userId}
            </span>
            <span className="app-shell__pill app-shell__pill--fixed" data-tooltip="認可ロール">
              role: {session.role}
            </span>
            <button
              type="button"
              className="app-shell__debug-copy"
              onClick={handleCopyRunId}
              aria-label="障害情報コピー"
              title={resolvedRunId ? `RUN_ID をコピー: ${resolvedRunId}` : 'RUN_ID をコピー'}
            >
              障害情報コピー
            </button>
          </div>
        </header>

        <MockModeBanner />
        <SecurityMisconfigBanner />
        <WorkspaceTabBar
          facilityId={session.facilityId}
          userId={session.userId}
          role={session.role}
          onRequestSwitchAccount={requestSwitchAccount}
          onRequestLogout={requestLogout}
          orcaStatus={
            isSystemAdmin
              ? {
                  tone: orcaTopStatus.tone,
                  label: orcaTopStatus.label,
                  tooltip: orcaTopStatusTooltip,
                }
              : undefined
          }
        />

        <div className="app-shell__body" id="app-shell-main" tabIndex={-1} data-tab-id={outletScreenKey}>
          <AppOutletErrorBoundary
            screenKey={outletScreenKey}
            runId={resolvedRunId}
            traceId={traceId}
            onReload={handleReloadApp}
            onReturnToReception={handleReturnToReceptionFromError}
            onCopyMeta={resolvedRunId || traceId ? handleCopyErrorMeta : undefined}
          >
            <Outlet key={outletScreenKey} />
          </AppOutletErrorBoundary>
        </div>

        <aside className="app-shell__notice-stack" data-run-id={resolvedRunId}>
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`app-shell__notice app-shell__notice--${toast.tone}`}
              role="status"
              aria-live={resolveAriaLive(toast.tone)}
              aria-atomic="true"
              data-run-id={resolvedRunId}
            >
              <div className="app-shell__notice-message">{toast.message}</div>
              {toast.detail ? <div className="app-shell__notice-detail">{toast.detail}</div> : null}
              <button
                type="button"
                className="app-shell__notice-close"
                onClick={() => dismissToast(toast.id)}
                aria-label="通知を閉じる"
              >
                ×
              </button>
            </div>
          ))}
        </aside>

        <FocusTrapDialog
          open={sessionExitDialogOpen}
          title="未保存の変更があります"
          description="ログアウトまたは切替を実行すると、未保存の内容は破棄されます。"
          role="alertdialog"
          onClose={handleSessionExitCancel}
          testId="session-exit-guard-dialog"
        >
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {dirtySources.length > 0 ? (
              <div>
                <p style={{ margin: 0, fontWeight: 700 }}>未保存の内容</p>
                <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.2rem' }}>
                  {dirtySources.map((entry) => (
                    <li key={entry.sourceKey}>{entry.reason ? entry.reason : entry.sourceKey}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleSessionExitCancel}>
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSessionExitLogout}
                style={{
                  background: '#b42318',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 8,
                }}
              >
                破棄してログアウト
              </button>
              <button
                type="button"
                onClick={handleSessionExitSwitch}
                style={{
                  background: '#155eef',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 8,
                }}
              >
                破棄して切替
              </button>
            </div>
          </div>
        </FocusTrapDialog>
      </div>
    </AppToastProvider>
  );
}

function ConnectedReception() {
  const session = useSession();
  const { flags } = useAuthService();

  return (
    <ReceptionPage
      runId={flags.runId ?? session.runId}
      destination="ORCA queue"
      title="受付"
      description="受付一覧の確認、例外対応、当日受付、カルテ起動を行う画面。"
    />
  );
}

function ConnectedCharts() {
  return <ChartsPage />;
}

function ConnectedPatients() {
  const session = useSession();
  const { flags } = useAuthService();
  return <PatientsPage runId={flags.runId ?? session.runId} />;
}

function ConnectedAdministration() {
  const session = useSession();
  const { flags } = useAuthService();
  return <AdministrationPage runId={flags.runId ?? session.runId} role={session.role} />;
}
