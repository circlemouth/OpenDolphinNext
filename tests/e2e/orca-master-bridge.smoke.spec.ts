import { test, expect } from '../playwright/fixtures';
import { gotoOrcaMaster, seedAuthSession, runId as defaultRunId } from './helpers/orcaMaster';

// This smoke relies on page.route stubs for /api/orca/master/* and must not be
// preempted by MSW service-worker fetch handlers.
test.use({ ignoreHTTPSErrors: true, serviceWorkers: 'block' });

type AuditMeta = {
  runId?: string;
  dataSource?: string;
  cacheHit?: boolean;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  dataSourceTransition?: { from?: string; to?: string; reason?: string } | null;
  snapshotVersion?: string | null;
};

const runId = process.env.RUN_ID ?? defaultRunId;
const shouldStub = (process.env.MASTER_BRIDGE_STUB ?? '1') !== '0';
const proxyTargetBase =
  process.env.VITE_ORCA_MASTER_BRIDGE ?? process.env.VITE_DEV_PROXY_TARGET ?? process.env.VITE_API_BASE_URL;

const logMeta = (label: string, meta: AuditMeta) => {
  // keep logs compact for tee -a sp4-runtime-flag.log
  // eslint-disable-next-line no-console
  console.log(
    `[master-bridge] ${label}`,
    JSON.stringify({
      runId: meta.runId,
      dataSource: meta.dataSource,
      cacheHit: meta.cacheHit,
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      dataSourceTransition: meta.dataSourceTransition ?? null,
      snapshotVersion: meta.snapshotVersion ?? null,
    }),
  );
};

const expectMeta = (meta: AuditMeta, expected: { missingMaster: boolean; fallbackUsed: boolean }) => {
  expect(meta.runId).toBe(runId);
  expect(meta.dataSource).toBeDefined();
  expect(meta.cacheHit).not.toBeUndefined();
  expect(meta.missingMaster).toBe(expected.missingMaster);
  expect(meta.fallbackUsed).toBe(expected.fallbackUsed);
  expect(meta.dataSourceTransition === undefined || typeof meta.dataSourceTransition === 'object').toBeTruthy();
};

test('@master-bridge ORCA master audit smoke', async ({ page }) => {
  const sourceHint = (process.env.WEB_ORCA_MASTER_SOURCE ?? 'mock').toLowerCase();
  if (shouldStub) {
    await page.route('**/api/orca/master/**', (route) => {
      const url = new URL(route.request().url());
      const isFallback = url.pathname.includes('/address') && url.searchParams.get('zip') !== '1000001';
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          runId,
          dataSource: sourceHint,
          cacheHit: false,
          missingMaster: isFallback,
          fallbackUsed: isFallback,
          dataSourceTransition: { from: sourceHint, to: sourceHint, reason: 'smoke_stub' },
        }),
      });
    });
  } else {
    // Let requests hit the configured bridge (proxy to VITE_ORCA_MASTER_BRIDGE/VITE_DEV_PROXY_TARGET if provided)
    await page.route('**/api/orca/master/**', async (route) => {
      if (!proxyTargetBase) {
        await route.continue();
        return;
      }
      const url = new URL(route.request().url());
      const upstream = new URL(url.pathname + url.search, proxyTargetBase);
      const response = await route.fetch({ url: upstream.toString() });
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: await response.body(),
      });
    });
  }

  await seedAuthSession(page);
  await gotoOrcaMaster(page, '/charts/72001');

  const primaryResponsePromise = page.waitForResponse((res) =>
    res.url().includes('/api/orca/master/generic-class'),
  );
  await page.evaluate(() => fetch('/api/orca/master/generic-class'));
  const primaryJson = (await primaryResponsePromise).json() as Promise<AuditMeta>;
  const primaryMeta = await primaryJson;
  // Log raw meta before assertions so sp4-runtime-flag.log captures server responses even on failure
  // eslint-disable-next-line no-console
  console.log('[master-bridge] primary_raw', JSON.stringify(primaryMeta));
  expectMeta(primaryMeta, { missingMaster: false, fallbackUsed: false });
  logMeta('primary', primaryMeta);

  const fallbackResponsePromise = page.waitForResponse((res) =>
    res.url().includes('/api/orca/master/address'),
  );
  await page.evaluate(() => fetch('/api/orca/master/address?zip=0000000'));
  const fallbackJson = (await fallbackResponsePromise).json() as Promise<AuditMeta>;
  const fallbackMeta = await fallbackJson;
  // eslint-disable-next-line no-console
  console.log('[master-bridge] fallback_raw', JSON.stringify(fallbackMeta));
  expectMeta(fallbackMeta, { missingMaster: true, fallbackUsed: true });
  logMeta('fallback', fallbackMeta);
});
