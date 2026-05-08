import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearDevVolatilePlainPassword } from './devAuthVolatile';
import { shouldNotifySessionExpired } from './httpClient';

const AUTH_KEY = 'opendolphin:web-client:auth';
const OFFICIAL_ORCA_APPOINTMENTS_ROUTE = '/api/orca/official/appointments/list';

const setSession = () => {
  sessionStorage.setItem(
    AUTH_KEY,
    JSON.stringify({ facilityId: 'f001', userId: 'user01', role: 'doctor', runId: 'run-1' }),
  );
};

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

const readCsrfHeader = (headers: Record<string, string>) => headers['X-CSRF-Token'] ?? headers['x-csrf-token'];

const mockFetchSequence = (statuses: number[]) => {
  const queue = [...statuses];
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    const status = queue.shift() ?? 200;
    return Promise.resolve(new Response(null, { status }));
  });
};

const importSubjects = async () => {
  const sessionExpiry = await import('../session/sessionExpiry');
  const devAuthVolatile = await import('./devAuthVolatile');
  const httpClient = await import('./httpClient');
  return { sessionExpiry, devAuthVolatile, httpClient };
};

describe('shouldNotifySessionExpired', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearDevVolatilePlainPassword();
  });

  it('returns false when no stored session exists', () => {
    expect(shouldNotifySessionExpired(401)).toBe(false);
    expect(shouldNotifySessionExpired(419)).toBe(false);
  });

  it('returns true for 401 when a session exists', () => {
    setSession();
    expect(shouldNotifySessionExpired(401)).toBe(true);
  });

  it('returns false when notifySessionExpired is disabled', () => {
    setSession();
    expect(shouldNotifySessionExpired(401, { notifySessionExpired: false })).toBe(false);
    expect(shouldNotifySessionExpired(419, { notifySessionExpired: false })).toBe(false);
  });

  it('returns true for 419 and 440 when a session exists', () => {
    setSession();
    expect(shouldNotifySessionExpired(419)).toBe(true);
    expect(shouldNotifySessionExpired(440)).toBe(true);
  });

  it('ignores 403 by default even when a session exists', () => {
    setSession();
    expect(shouldNotifySessionExpired(403)).toBe(false);
  });

  it('notifies for 403 only when explicitly opted-in', () => {
    setSession();
    expect(shouldNotifySessionExpired(403, { notifyForbiddenAsSessionExpiry: true })).toBe(true);
  });

  it('returns false for non expiry statuses', () => {
    setSession();
    expect(shouldNotifySessionExpired(500)).toBe(false);
  });
});

describe('httpFetch session expiry debounce', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T00:00:00Z'));
    sessionStorage.clear();
    localStorage.clear();
    clearDevVolatilePlainPassword();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('debounces consecutive 401 responses', async () => {
    setSession();
    mockFetchSequence([401, 401]);
    const { sessionExpiry, httpClient } = await importSubjects();
    vi.spyOn(sessionExpiry, 'notifySessionExpired');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    await httpClient.httpFetch('/dummy');
    vi.advanceTimersByTime(1_000);
    await httpClient.httpFetch('/dummy');

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });

  it('debounces mixed 419 then 440 responses', async () => {
    setSession();
    mockFetchSequence([419, 440]);
    const { sessionExpiry, httpClient } = await importSubjects();
    vi.spyOn(sessionExpiry, 'notifySessionExpired');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    await httpClient.httpFetch('/dummy');
    vi.advanceTimersByTime(2_000);
    await httpClient.httpFetch('/dummy');

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not notify for repeated 403 responses without opt-in', async () => {
    setSession();
    mockFetchSequence([403, 403]);
    const { sessionExpiry, httpClient } = await importSubjects();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    vi.spyOn(sessionExpiry, 'notifySessionExpired');

    await httpClient.httpFetch('/dummy');
    await httpClient.httpFetch('/dummy');

    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});

describe('httpFetch session expiry reasons', () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    localStorage.clear();
    clearDevVolatilePlainPassword();
    document.head.innerHTML = '';
    setCsrfMetaToken('csrf-default-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    document.head.innerHTML = '';
  });

  it('maps 403 to forbidden only when opted-in', async () => {
    setSession();
    mockFetchSequence([403]);
    const { sessionExpiry, httpClient } = await importSubjects();
    const notifySpy = vi.spyOn(sessionExpiry, 'notifySessionExpired');

    await httpClient.httpFetch('/dummy', { notifyForbiddenAsSessionExpiry: true });
    expect(notifySpy).toHaveBeenCalledWith('forbidden', 403);

    notifySpy.mockClear();
    mockFetchSequence([403]);
    await httpClient.httpFetch('/dummy');
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('maps 401 to unauthorized and 419 to timeout', async () => {
    setSession();
    mockFetchSequence([401]);
    const { sessionExpiry, httpClient } = await importSubjects();
    const notifySpy = vi.spyOn(sessionExpiry, 'notifySessionExpired');

    await httpClient.httpFetch('/dummy');
    expect(notifySpy).toHaveBeenCalledWith('unauthorized', 401);

    notifySpy.mockClear();
    mockFetchSequence([419]);
    await httpClient.httpFetch('/dummy');
    expect(notifySpy).toHaveBeenCalledWith('timeout', 419);
  });

  it('does not notify for ORCA endpoints by default', async () => {
    setSession();
    mockFetchSequence([401]);
    const { sessionExpiry, httpClient } = await importSubjects();
    const notifySpy = vi.spyOn(sessionExpiry, 'notifySessionExpired');

    await httpClient.httpFetch('/api/orca/official/appointments/list');
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('does not notify for /api/orca endpoints on 401/403', async () => {
    setSession();
    const { sessionExpiry, httpClient } = await importSubjects();
    const notifySpy = vi.spyOn(sessionExpiry, 'notifySessionExpired');

    mockFetchSequence([401]);
    await httpClient.httpFetch(OFFICIAL_ORCA_APPOINTMENTS_ROUTE, { method: 'GET' });
    expect(notifySpy).not.toHaveBeenCalled();

    mockFetchSequence([403]);
    await httpClient.httpFetch(OFFICIAL_ORCA_APPOINTMENTS_ROUTE, { method: 'GET' });
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('notifies for first-party admin and realtime API 401 responses', async () => {
    setSession();
    const { sessionExpiry, httpClient } = await importSubjects();
    const notifySpy = vi.spyOn(sessionExpiry, 'notifySessionExpired');

    mockFetchSequence([401]);
    await httpClient.httpFetch('/api/admin/orca/connection', { method: 'GET' });
    expect(notifySpy).toHaveBeenCalledWith('unauthorized', 401);

    notifySpy.mockClear();
    mockFetchSequence([401]);
    await httpClient.httpFetch('/api/realtime/reception', { method: 'GET' });
    expect(notifySpy).toHaveBeenCalledWith('unauthorized', 401);
  });

  it('does not notify for /karte and /odletter endpoints on 401', async () => {
    setSession();
    const { sessionExpiry, httpClient } = await importSubjects();
    const notifySpy = vi.spyOn(sessionExpiry, 'notifySessionExpired');

    mockFetchSequence([401]);
    await httpClient.httpFetch('/karte/pid/00001,2000-01-01%2000%3A00%3A00', { method: 'GET' });
    expect(notifySpy).not.toHaveBeenCalled();

    mockFetchSequence([401]);
    await httpClient.httpFetch('/odletter/list/1', { method: 'GET' });
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('never attaches Authorization headers for same-origin endpoints', async () => {
    setSession();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const { httpClient } = await importSubjects();

    await httpClient.httpFetch('/api/admin/orca/connection', { method: 'GET' });
    const adminHeaders = new Headers((fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined)?.headers ?? {});
    expect(adminHeaders.get('Authorization')).toBeNull();

    await httpClient.httpFetch('/api/orca/official/appointments/list', { method: 'GET' });
    const orcaHeaders = new Headers((fetchSpy.mock.calls[1]?.[1] as RequestInit | undefined)?.headers ?? {});
    expect(orcaHeaders.get('Authorization')).toBeNull();

    await httpClient.httpFetch('/api/chart-events', { method: 'GET' });
    const chartHeaders = new Headers((fetchSpy.mock.calls[2]?.[1] as RequestInit | undefined)?.headers ?? {});
    expect(chartHeaders.get('Authorization')).toBeNull();

    await httpClient.httpFetch('/api/realtime/reception', { method: 'GET' });
    const realtimeHeaders = new Headers((fetchSpy.mock.calls[3]?.[1] as RequestInit | undefined)?.headers ?? {});
    expect(realtimeHeaders.get('Authorization')).toBeNull();

    await httpClient.httpFetch('/karte/pid/00001,2000-01-01%2000%3A00%3A00', { method: 'GET' });
    const karteHeaders = new Headers((fetchSpy.mock.calls[4]?.[1] as RequestInit | undefined)?.headers ?? {});
    expect(karteHeaders.get('Authorization')).toBeNull();

    await httpClient.httpFetch('/api/healthz', { method: 'GET' });
    const nonOrcaHeaders = new Headers((fetchSpy.mock.calls[5]?.[1] as RequestInit | undefined)?.headers ?? {});
    expect(nonOrcaHeaders.has('Authorization')).toBe(false);
  });

  it('never attaches Authorization headers for /api/orca endpoints', async () => {
    setSession();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const { httpClient } = await importSubjects();

    await httpClient.httpFetch(OFFICIAL_ORCA_APPOINTMENTS_ROUTE, { method: 'GET' });
    const headers = new Headers((fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined)?.headers ?? {});
    expect(headers.get('Authorization')).toBeNull();
  });

  it('does not attach Authorization to cross-origin absolute ORCA URLs in DEV', async () => {
    setSession();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const { httpClient } = await importSubjects();

    await httpClient.httpFetch('https://evil.example/api/orca/official/appointments/list', { method: 'GET' });
    const headers = new Headers((fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined)?.headers ?? {});
    expect(headers.get('Authorization')).toBeNull();
  });

  it('adds X-CSRF-Token for same-origin unsafe methods when meta token exists', async () => {
    setCsrfMetaToken('  csrf-token-123  ');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const { httpClient } = await importSubjects();

    await httpClient.httpFetch('/api/admin/orca/connection', { method: 'PUT' });
    const headers = new Headers((fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined)?.headers ?? {});
    expect(headers.get('X-CSRF-Token')).toBe('csrf-token-123');
  });

  it('does not add X-CSRF-Token for GET requests', async () => {
    setCsrfMetaToken('csrf-token-123');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const { httpClient } = await importSubjects();

    await httpClient.httpFetch('/api/admin/orca/connection', { method: 'GET' });
    const headers = new Headers((fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined)?.headers ?? {});
    expect(headers.get('X-CSRF-Token')).toBeNull();
  });

  it('does not add X-CSRF-Token for cross-origin requests', async () => {
    setCsrfMetaToken('csrf-token-123');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const { httpClient } = await importSubjects();

    await httpClient.httpFetch('https://evil.example/api/admin/orca/connection', { method: 'PUT' });
    const headers = new Headers((fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined)?.headers ?? {});
    expect(headers.get('X-CSRF-Token')).toBeNull();
  });

  it('uses credentials include for cookie-based session requests', async () => {
    setSession();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const { httpClient } = await importSubjects();

    await httpClient.httpFetch('/api/orca/official/appointments/list', { method: 'GET' });
    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestInit?.credentials).toBe('include');
  });

  it('resolves relative request paths before calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const { httpClient } = await importSubjects();

    await httpClient.httpFetch('/api/orca/official/chart-support/contraindication-check', { method: 'POST' });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(`${window.location.origin}/api/orca/official/chart-support/contraindication-check`);
  });

  it('applies no-store cache only to PHI GET requests', async () => {
    setSession();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const { httpClient } = await importSubjects();

    await httpClient.httpFetch('/karte/pid/00001,2000-01-01%2000%3A00%3A00', { method: 'GET' });
    const phiInit = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(phiInit?.cache).toBe('no-store');

    await httpClient.httpFetch('/api/healthz', { method: 'GET' });
    const nonPhiInit = fetchSpy.mock.calls[1]?.[1] as RequestInit | undefined;
    expect(nonPhiInit?.cache).toBeUndefined();
  });

  it('does not notify for /blobapi endpoints on 401/403', async () => {
    setSession();
    const { sessionExpiry, httpClient } = await importSubjects();
    const notifySpy = vi.spyOn(sessionExpiry, 'notifySessionExpired');

    mockFetchSequence([401]);
    await httpClient.httpFetch('/blobapi/xxxx', { method: 'GET' });
    expect(notifySpy).not.toHaveBeenCalled();

    mockFetchSequence([403]);
    await httpClient.httpFetch('/blobapi/xxxx', { method: 'GET' });
    expect(notifySpy).not.toHaveBeenCalled();
  });
});

describe('buildHttpHeaders CSRF policy', () => {
  beforeEach(async () => {
    vi.resetModules();
    document.head.innerHTML = '';
    const { httpClient } = await importSubjects();
    httpClient.setCsrfRuntimeOverrideForTests(undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    const { httpClient } = await importSubjects();
    httpClient.setCsrfRuntimeOverrideForTests(undefined);
  });

  it('adds X-CSRF-Token for same-origin POST', async () => {
    setCsrfMetaToken('  csrf-token-abc  ');
    const { httpClient } = await importSubjects();

    const headers = httpClient.buildHttpHeaders({ method: 'POST' }, '/api/foo');
    expect(readCsrfHeader(headers)).toBe('csrf-token-abc');
  });

  it('does not add X-CSRF-Token for GET', async () => {
    setCsrfMetaToken('csrf-token-abc');
    const { httpClient } = await importSubjects();

    const headers = httpClient.buildHttpHeaders({ method: 'GET' }, '/api/foo');
    expect(headers['X-CSRF-Token']).toBeUndefined();
  });

  it('throws for token-missing POST when PROD is enabled', async () => {
    const { httpClient } = await importSubjects();
    httpClient.setCsrfRuntimeOverrideForTests({ prod: true, allowMissingCsrf: true });

    expect(() => httpClient.buildHttpHeaders({ method: 'POST' }, '/api/foo')).toThrowError('CSRF token missing');
    httpClient.setCsrfRuntimeOverrideForTests(undefined);
  });

  it('allows token-missing POST in dev/test only when VITE_ALLOW_MISSING_CSRF=1', async () => {
    vi.stubEnv('VITE_ALLOW_MISSING_CSRF', '1');
    const { httpClient } = await importSubjects();
    httpClient.setCsrfRuntimeOverrideForTests({ prod: false });

    expect(() => httpClient.buildHttpHeaders({ method: 'POST' }, '/api/foo')).not.toThrow();
    httpClient.setCsrfRuntimeOverrideForTests(undefined);
  });

  it('includes X-CSRF-Token in XHR path header generation', async () => {
    setCsrfMetaToken('csrf-token-xhr');
    const { httpClient } = await importSubjects();

    const headers = httpClient.buildHttpHeaders(
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      },
      '/karte/document',
    );

    expect(readCsrfHeader(headers)).toBe('csrf-token-xhr');
  });
});
