// Artifact-free RWO-02 smoke: no screenshots, HAR, trace, video, or raw network dumps.

import { expect, test, type Page, type Route } from '@playwright/test';

import { baseUrl, runId } from '../helpers/orcaMaster';

const FACILITY_ID = '1.3.6.1.4.1.9414.72.103';
const USER_ID = 'doctor1';

const stubChartsShell = async (page: Page) => {
  const sessionPayload = {
    facilityId: FACILITY_ID,
    userId: USER_ID,
    displayName: 'E2E Doctor',
    roles: ['doctor'],
    clientUuid: 'safe-no-artifacts-e2e',
    runId,
  };

  await page.route('**/session/me**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    }),
  );
  await page.route('**/session/login**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    }),
  );
  await page.route('**/api/user/**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    }),
  );

  const adminConfig = {
    runId,
    chartsDisplayEnabled: true,
    chartsSendEnabled: true,
    chartsMasterSource: 'server',
    deliveryVersion: 'safe-no-artifacts-e2e',
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

const establishSession = async (page: Page) => {
  await page.goto(`${baseUrl}/login?msw=1`);
  await page.evaluate(({ currentRunId, facilityId, userId }) => {
    const authSnapshot = {
      facilityId,
      userId,
      runId: currentRunId,
      clientUuid: 'safe-no-artifacts-e2e',
      displayName: 'E2E Doctor',
    };
    window.sessionStorage.setItem('opendolphin:web-client:auth', JSON.stringify(authSnapshot));
    window.sessionStorage.setItem(
      'opendolphin:web-client:auth-flags',
      JSON.stringify({
        sessionKey: `${facilityId}:${userId}`,
        flags: {
          runId: currentRunId,
          cacheHit: true,
          missingMaster: false,
          dataSourceTransition: 'server',
          fallbackUsed: false,
        },
        updatedAt: new Date().toISOString(),
      }),
    );
  }, { currentRunId: runId, facilityId: FACILITY_ID, userId: USER_ID });

  await page.goto(`${baseUrl}/f/${encodeURIComponent(FACILITY_ID)}/reception?msw=1`);
  await expect(page).toHaveURL(/reception/);
};

test.describe('Charts missing context recovery safe smoke', () => {
  test.use({ ignoreHTTPSErrors: true });

  test('minimal context loss fails closed and offers return to reception', async ({ page }) => {
    await stubChartsShell(page);
    await establishSession(page);

    await page.goto(`${baseUrl}/f/${encodeURIComponent(FACILITY_ID)}/charts?msw=1&patientId=P-001&visitDate=2026-04-17`);
    await expect(page.locator('.charts-context-recovery')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: '来院文脈を再取得してください' })).toBeVisible();
    const recovery = page.locator('.charts-context-recovery');
    await expect(recovery.getByRole('button', { name: '受付へ戻る' })).toBeVisible();
    await expect(page.locator('#charts-action-send')).toBeDisabled();
  });
});
