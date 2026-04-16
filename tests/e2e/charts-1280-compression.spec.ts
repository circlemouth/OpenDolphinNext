// RUN_ID=20260416T213106Z
// Charts: 1280 幅でも primary/editor/support CTA が disclosure なしで見えることを確認する

import { test, expect, type Page, type Route } from '../playwright/fixtures';
import { baseUrl, runId } from './helpers/orcaMaster';

const stubChartsWorkbench = async (page: Page) => {
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

  const encounterEntry = {
    id: 'entry-1',
    patientId: 'P-001',
    name: '患者A',
    status: '診療中',
    source: 'visits',
    appointmentId: 'A-001',
    receptionId: 'R-001',
    visitDate: '2026-04-17',
    department: '内科',
    physician: '医師A',
    departmentCode: '01',
    physicianCode: '10001',
    insuranceCombinationNumber: '0001',
    voucherNumber: '1234',
    sequentialNumber: '1',
    scheduleKey: 'F001:S100',
    encounterKey: 'F001:E100',
  };

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
        entries: [encounterEntry],
        page: 1,
        size: 50,
        recordsReturned: 1,
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
        visits: [encounterEntry],
        recordsReturned: 1,
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
        recordsReturned: 1,
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

test.describe('Charts 1280 compression', () => {
  test.use({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });

  test('support CTA と main primary が 1280 幅で見切れず表示される', async ({ context }) => {
    const page = await context.newPage();
    await stubChartsWorkbench(page);
    await login(page);

    await page.goto(
      `${baseUrl}/charts?msw=1&patientId=P-001&visitDate=2026-04-17&scheduleKey=F001:S100&encounterKey=F001:E100`,
    );
    await expect(page.locator('#charts-soap-note')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.charts-patient-summary__encounter-band')).toBeVisible();
    await expect(page.locator('#charts-action-send')).toBeVisible();
    await expect(page.getByRole('button', { name: '受付へ戻る' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ドラフト保存' })).toBeVisible();
    await expect(page.getByRole('button', { name: '印刷/エクスポート' })).toBeVisible();

    const supportBar = page.locator('.charts-actions__group[data-group="support"]');
    const box = await supportBar.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(1280);
  });
});
