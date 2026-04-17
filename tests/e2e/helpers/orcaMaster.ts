import { Page, expect } from '@playwright/test';

export const runId = process.env.RUN_ID ?? '20251124T181500Z';
export const profile = process.env.VITE_DEV_PROXY_TARGET ? 'live' : 'msw';
const useHttps = process.env.VITE_DEV_USE_HTTPS === '1';
const protocol = useHttps ? 'https' : 'http';
const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? '4173');
export const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `${protocol}://localhost:${webPort}`;
export const defaultChartPath = '/charts/72001?msw=1';

export const orcaSelectors = {
  skipLink: '[data-test-id=\"orca-skip-results\"]',
  searchForm: '[data-test-id=\"orca-search-form\"]',
  searchInput: '[data-test-id=\"orca-search-input\"]',
  searchButton: '[data-test-id=\"orca-search-submit\"]',
  resultsRegion: '[data-test-id=\"orca-results-region\"]',
  resultsTable: '[data-test-id=\"orca-results-table\"]',
  alertBanner: '[data-test-id=\"orca-alert-banner\"]',
  rateLimitCountdown: '[data-test-id=\"orca-rate-limit-countdown\"]',
  rateLimitRetry: '[data-test-id=\"orca-rate-limit-retry\"]',
};

const AUTH_STORAGE_KEY = 'opendolphin:web-client:auth';

export const e2eAuthSession = {
  credentials: {
    facilityId: '1.3.6.1.4.1.9414.72.103',
    userId: 'doctor1',
    passwordMd5: '632080fabdb968f9ac4f31fb55104648',
    clientUuid: 'e2e-playwright',
  },
  userProfile: {
    facilityId: '1.3.6.1.4.1.9414.72.103',
    userId: 'doctor1',
    displayName: 'E2E Admin',
    roles: ['admin'],
  },
  persistedAt: Date.now(),
};

export type AuditMeta = {
  runId: string;
  dataSource: 'server' | 'snapshot' | 'mock' | 'fallback';
  cacheHit: boolean;
  missingMaster: boolean;
  fallbackUsed: boolean;
  validationError?: boolean | null;
  snapshotVersion?: string | null;
};

/**
 * Acquire chart lock or any prerequisite fixture. Stub for now; replace with real lock API when available.
 */
export async function withChartLock(page: Page, fn: () => Promise<void>, ownerUUID = 'e2e-orca-master') {
  await page.addInitScript(({ id }) => {
    (window as any).__ORCA_E2E_OWNER__ = id;
  }, { id: ownerUUID });
  await fn();
}

export async function setMswFault(page: Page, faultId: string) {
  try {
    await page.evaluate((id) => {
      const setter = (window as any).__mswSetFault;
      if (typeof setter === 'function') setter(id);
    }, faultId);
  } catch (err) {
    console.warn('setMswFault skipped', err);
  }
}

export async function clearMswFault(page: Page) {
  try {
    await page.evaluate(() => {
      const clearer = (window as any).__mswClearFault || (window as any).__mswResetHandlers;
      if (typeof clearer === 'function') clearer();
    });
  } catch (err) {
    console.warn('clearMswFault skipped', err);
  }
}

export async function expectAuditMeta(actual: Partial<AuditMeta>, expected: Partial<AuditMeta> = {}) {
  const merged = { runId, ...expected };
  if (merged.runId) expect(actual.runId).toBe(merged.runId);
  if (merged.dataSource) expect(actual.dataSource).toBe(merged.dataSource as any);
  if (merged.cacheHit !== undefined) expect(actual.cacheHit).toBe(merged.cacheHit);
  if (merged.missingMaster !== undefined) expect(actual.missingMaster).toBe(merged.missingMaster);
  if (merged.fallbackUsed !== undefined) expect(actual.fallbackUsed).toBe(merged.fallbackUsed);
  if (merged.validationError !== undefined) expect(actual.validationError).toBe(merged.validationError);
}

export async function recordPerfLog(page: Page, label: string) {
  await page.evaluate(
    ({ label: name, runId: id }) => {
      (window as any).__ORCA_E2E_PERF__ = { label: name, runId: id, ts: Date.now() };
    },
    { label, runId },
  );
}

export async function seedAuthSession(page: Page) {
  await page.route('**/api/session/me**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        facilityId: e2eAuthSession.credentials.facilityId,
        userId: e2eAuthSession.credentials.userId,
        displayName: e2eAuthSession.userProfile.displayName,
        roles: e2eAuthSession.userProfile.roles,
        clientUuid: e2eAuthSession.credentials.clientUuid,
        runId,
      }),
    });
  });
  await page.addInitScript(([storageKey, session]) => {
    const ensureCsrfMeta = () => {
      const existing = document.querySelector("meta[name='csrf-token']");
      if (existing instanceof HTMLMetaElement) {
        existing.content = 'e2e-csrf-token';
        return;
      }
      if (!document.head) return;
      const meta = document.createElement('meta');
      meta.name = 'csrf-token';
      meta.content = 'e2e-csrf-token';
      document.head.appendChild(meta);
    };
    ensureCsrfMeta();
    document.addEventListener('DOMContentLoaded', ensureCsrfMeta, { once: true });
    window.sessionStorage.setItem(storageKey, JSON.stringify(session));
    // Web クライアント本体が参照するシンプルな認証スナップショットも併存させる
    window.sessionStorage.setItem(
      'opendolphin:web-client:auth',
      JSON.stringify({
        facilityId: session.credentials.facilityId,
        userId: session.credentials.userId,
        role: 'admin',
        runId: session.userProfile?.runId ?? (session as any).runId ?? 'RUN-E2E',
        clientUuid: session.credentials.clientUuid,
        displayName: session.userProfile?.displayName,
      }),
    );
    window.sessionStorage.setItem(
      'opendolphin:web-client:auth-flags',
      JSON.stringify({
        sessionKey: `${session.credentials.facilityId}:${session.credentials.userId}`,
        flags: {
          runId: session.userProfile?.runId ?? (session as any).runId ?? 'RUN-E2E',
          cacheHit: false,
          missingMaster: false,
          dataSourceTransition: 'server',
          fallbackUsed: false,
        },
        updatedAt: new Date().toISOString(),
      }),
    );
    window.localStorage.setItem('devFacilityId', session.credentials.facilityId);
    window.localStorage.setItem('devUserId', session.credentials.userId);
    window.localStorage.setItem('devPasswordMd5', session.credentials.passwordMd5);
    window.localStorage.setItem('devClientUuid', session.credentials.clientUuid);
    window.localStorage.setItem('devRole', 'admin');
    if (!(window as unknown as { $RefreshReg$?: unknown }).$RefreshReg$) {
      (window as unknown & { $RefreshReg$?: () => void }).$RefreshReg$ = () => {};
    }
    if (!(window as unknown as { $RefreshSig$?: unknown }).$RefreshSig$) {
      (window as unknown & { $RefreshSig$?: () => (type: unknown) => unknown }).$RefreshSig$ = () => (type) => type;
    }
  }, [AUTH_STORAGE_KEY, { ...e2eAuthSession, persistedAt: Date.now() }]);
}

export async function gotoOrcaMaster(page: Page, path: string = defaultChartPath) {
  await page.goto(`${baseUrl}${path}`);
}

export async function expandChartsQuickActions(page: Page) {
  const closeToggle = page.getByRole('button', { name: '操作を閉じる' }).first();
  if (await closeToggle.isVisible().catch(() => false)) {
    return;
  }

  const openToggle = page.getByRole('button', { name: '操作を開く' }).first();
  if (!(await openToggle.isVisible().catch(() => false))) {
    await openToggle.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => null);
  }
  if (!(await openToggle.isVisible().catch(() => false))) {
    return;
  }
  await openToggle.click();
  await expect(closeToggle).toBeVisible({ timeout: 5_000 });
}

export async function expandReceptionStatusSections(page: Page) {
  for (let i = 0; i < 10; i += 1) {
    const openButtons = page.getByRole('button', { name: '開く' });
    if ((await openButtons.count()) === 0) break;
    await openButtons.first().click();
  }
}

export async function mockTensuNameSuccess(page: Page) {
  await page.route('**/orca/tensu/name/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        list: [
          {
            srycd: '1100001',
            name: '初診料（外来）',
            kananame: 'ｼｮｼﾝﾘｮｳ',
            taniname: '回',
            ten: '288',
            ykzkbn: '1',
            nyugaitekkbn: '0',
            routekkbn: 'I',
            srysyukbn: 'SY',
            yukostymd: '20240401',
            yukoedymd: '99999999',
          },
          {
            srycd: '1120002',
            name: '再診料（外来）',
            taniname: '回',
            ten: '73',
            ykzkbn: '1',
            nyugaitekkbn: '0',
            routekkbn: 'I',
            srysyukbn: 'SY',
            yukostymd: '20240401',
            yukoedymd: '99999999',
          },
        ],
        totalCount: 2,
        version: '20251123',
      }),
    }),
  );
}

export async function mockTensuNameValidationError(page: Page, message = 'SRYCD は数字 9 桁で指定してください') {
  await page.route('**/orca/tensu/name/**', (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message, validationError: true, runId } }),
    }),
  );
}

export async function mockTensuNameRateLimit(page: Page, retryAfterSeconds = 3) {
  await page.route('**/orca/tensu/name/**', (route) =>
    route.fulfill({
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'RATE_LIMIT', message: 'busy', runId } }),
    }),
  );
}
