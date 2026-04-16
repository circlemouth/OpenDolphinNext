// RUN_ID=20260416T213106Z
// Charts: minimal encounter context loss は fail-close し、named return を表示する

import { test, expect, type Page, type Route } from '../playwright/fixtures';
import { baseUrl, runId } from './helpers/orcaMaster';

const stubChartsShell = async (page: Page) => {
  await page.route('**/api/user/**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        facilityId: '0001',
        userId: 'doctor1',
        displayName: 'E2E Doctor',
        roles: ['doctor'],
      }),
    }),
  );

  const adminConfig = {
    runId,
    chartsDisplayEnabled: true,
    chartsSendEnabled: true,
    chartsMasterSource: 'server',
    deliveryVersion: 'e2e',
    deliveredAt: new Date().toISOString(),
  };
  await page.route('**/api/admin/config', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminConfig) }),
  );
  await page.route('**/api/admin/delivery', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminConfig) }),
  );

  await page.route('**/api/orca/official/appointments/list**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        runId,
        cacheHit: true,
        missingMaster: false,
        fallbackUsed: false,
        dataSourceTransition: 'server',
        entries: [],
        page: 1,
        size: 50,
        recordsReturned: 0,
        hasNextPage: false,
        fetchedAt: new Date().toISOString(),
      }),
    }),
  );
  await page.route('**/api/orca/official/visits/list**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        runId,
        cacheHit: true,
        missingMaster: false,
        fallbackUsed: false,
        dataSourceTransition: 'server',
        visits: [],
        recordsReturned: 0,
        fetchedAt: new Date().toISOString(),
      }),
    }),
  );
  await page.route('**/orca21/medicalmodv2/outpatient**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        runId,
        cacheHit: true,
        missingMaster: false,
        fallbackUsed: false,
        dataSourceTransition: 'server',
        outpatientList: [],
        recordsReturned: 0,
      }),
    }),
  );
};

const login = async (page: Page) => {
  await page.goto(`${baseUrl}/login?msw=1`);
  await page.getByLabel('施設ID').fill('0001');
  await page.getByLabel('ユーザーID').fill('doctor1');
  await page.getByLabel('パスワード').fill('pass');
  await Promise.all([
    page.waitForURL(/reception/, { timeout: 20_000 }),
    page.getByRole('button', { name: 'ログイン' }).click(),
  ]);
};

test.describe('Charts missing context recovery', () => {
  test.use({ ignoreHTTPSErrors: true });

  test('minimal context loss では editor を fail-close し、受付へ戻るを出す', async ({ context }) => {
    const page = await context.newPage();
    await stubChartsShell(page);
    await login(page);

    await page.goto(`${baseUrl}/charts?msw=1&patientId=P-001&visitDate=2026-04-17`);
    await expect(page.locator('.charts-context-recovery')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: '来院文脈を再取得してください' })).toBeVisible();
    await expect(page.getByRole('button', { name: '受付へ戻る' })).toBeVisible();
    await expect(page.locator('#charts-action-send')).toBeDisabled();

    await page.getByRole('button', { name: '受付へ戻る' }).click();
    await expect(page).toHaveURL(/reception/);
  });
});
