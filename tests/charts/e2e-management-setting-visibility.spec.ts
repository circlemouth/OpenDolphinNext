import { expect, test } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, seedAuthSession } from '../e2e/helpers/orcaMaster';

const RUN_ID = process.env.RUN_ID ?? '20260417T000000Z-management-setting-visibility';

test('management setting inventory keeps charts/config and connection visibility separated', async ({ page }) => {
  await seedAuthSession(page);
  await page.route('**/api/session/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        facilityId: e2eAuthSession.credentials.facilityId,
        userId: e2eAuthSession.credentials.userId,
        displayName: 'E2E Admin',
        clientUuid: 'e2e-admin-setting',
        runId: RUN_ID,
        role: 'system_admin',
        roles: ['system_admin'],
      }),
    }),
  );

  await page.route('**/api/admin/config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        runId: RUN_ID,
        chartsDisplayEnabled: true,
        chartsSendEnabled: false,
        chartsMasterSource: 'fallback',
        deliveryId: 'DELIVERY-1',
        deliveryVersion: 'VERSION-1',
        deliveryEtag: 'ETAG-1',
        deliveredAt: '2026-04-17T00:00:00Z',
        source: 'live',
      }),
    }),
  );
  await page.route('**/api/admin/orca/connection', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        runId: RUN_ID,
        useWeborca: true,
        serverUrl: 'https://weborca.example.invalid',
        port: 443,
        username: 'orca-admin',
        pushUrl: 'wss://push.example.invalid/ws',
        pushTenantId: 'tenant-01',
        passwordConfigured: true,
        clientAuthEnabled: false,
        clientCertificateConfigured: false,
        clientCertificatePassphraseConfigured: false,
        caCertificateConfigured: false,
      }),
    }),
  );
  await page.route('**/api/admin/orca/capabilities', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        runId: RUN_ID,
        connection: {
          available: true,
          testedScope: 'api_only',
          hint: '接続テストは WebORCA API の到達確認のみで、push WebSocket の接続確認は行いません。',
        },
        internalWrappers: [],
      }),
    }),
  );
  await page.route('**/api/health/worker/pvt', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'UP', reasonCodes: [], runId: RUN_ID }),
    }),
  );
  await page.route('**/api/health/readiness', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'UP', checks: {}, runId: RUN_ID }),
    }),
  );
  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'UP', service: 'server-modernized', runId: RUN_ID }),
    }),
  );
  await page.route('**/api/orca/queue', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, status: 200, queue: [], runId: RUN_ID }),
    }),
  );

  const facilityId = e2eAuthSession.credentials.facilityId;

  await page.goto(`${baseUrl}/f/${facilityId}/administration?section=config`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: '配信設定' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('この section が正本なのは charts delivery のみです。接続設定・runtime-owned・未証明 setting はここへ混ぜません。')).toBeVisible();
  await expect(page.getByText('未証明の facility setting や optional module visibility は UI に toggle を出さず、feature-off / fail-close を維持します。')).toBeVisible();
  await expect(page.getByLabel('orcaEndpoint（配信先 URL）')).toHaveCount(0);
  await expect(page.getByText('配信検証フラグ')).toHaveCount(0);

  await page.goto(`${baseUrl}/f/${facilityId}/administration?section=connection`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'WebORCA接続設定' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('testedScope: API到達のみ')).toBeVisible();
  await expect(page.getByText('Push保存状態: Push URL + tenant ID 設定済み')).toBeVisible();
  await expect(page.getByText('接続テスト範囲: API到達のみ')).toBeVisible();
});
