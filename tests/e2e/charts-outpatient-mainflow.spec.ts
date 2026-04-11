// RUN_ID=20251218T180331Z
// 受付→Charts→患者確認→送信→会計の主要シナリオを MSW ON/OFF で自動検証する。
// - dataSourceTransition / cacheHit / missingMaster / fallbackUsed の透過と tone(aria-live) を検証。
// - 送信ボタンと会計CTAのガード理由を fixture で注入し、toast/detail に transition が残ることを確認。
// - 失敗時の HAR/スクリーンショットは共通フィクスチャ（tests/playwright/fixtures.ts）で RUN_ID 配下へ保存される。

import { test, expect, type Page, type Route } from '../playwright/fixtures';
import { baseUrl, profile } from './helpers/orcaMaster';

const RUN_ID = process.env.RUN_ID ?? '20251218T180331Z';
process.env.RUN_ID ??= RUN_ID;

const mswDisabled = process.env.VITE_DISABLE_MSW === '1' || process.env.PLAYWRIGHT_DISABLE_MSW === '1';

type Scenario = {
  id: 'cache-hit' | 'snapshot-missing-master' | 'fallback';
  label: string;
  cacheHit: boolean;
  missingMaster: boolean;
  fallbackUsed: boolean;
  dataSourceTransition: 'server' | 'snapshot' | 'fallback';
  tone: 'info' | 'warning' | 'error';
  expectSendEnabled: boolean;
};

const scenarios: Scenario[] = [
  {
    id: 'cache-hit',
    label: 'server/cacheHit=true（正常送信OK）',
    cacheHit: true,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server',
    tone: 'info',
    expectSendEnabled: true,
  },
  {
    id: 'snapshot-missing-master',
    label: 'snapshot missingMaster=true（送信ガード）',
    cacheHit: false,
    missingMaster: true,
    fallbackUsed: false,
    dataSourceTransition: 'snapshot',
    tone: 'warning',
    expectSendEnabled: false,
  },
  {
    id: 'fallback',
    label: 'fallbackUsed=true（送信/会計ブロック）',
    cacheHit: false,
    missingMaster: true,
    fallbackUsed: true,
    dataSourceTransition: 'fallback',
    tone: 'error',
    expectSendEnabled: false,
  },
];

async function login(page: Page, useMsw: boolean) {
  const query = useMsw ? '?msw=1' : '';
  await page.goto(`${baseUrl}/login${query}`);
  await page.getByLabel('施設ID').fill('0001');
  await page.getByLabel('ユーザーID').fill('doctor1');
  await page.getByLabel('パスワード').fill('pass');
  await Promise.all([
    page.waitForURL('**/reception**', { timeout: 15_000 }),
    page.getByRole('button', { name: 'ログイン' }).click(),
  ]);
}

async function updateMswRunId(page: Page) {
  try {
    await page.waitForFunction(() => Boolean((window as any).__OUTPATIENT_SCENARIO__?.update), { timeout: 5_000 });
    await page.evaluate((runId) => {
      const api = (window as any).__OUTPATIENT_SCENARIO__;
      api?.update?.({ runId });
    }, RUN_ID);
  } catch {
    // MSW OFF 時は scenario 控制が無いのでスキップ
  }
}

async function refreshReception(page: Page) {
  const retryButton = page.getByRole('button', { name: '再取得' }).first();
  if (await retryButton.isVisible()) {
    await retryButton.click();
  }
}

async function openChartsFromReception(page: Page) {
  const firstRow = page.getByRole('row', { name: /山田\s*花子/ });
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  await firstRow.dblclick();
  await expect(page).toHaveURL(/charts/);
  await expect(page.locator('.charts-page')).toBeVisible({ timeout: 20_000 });
}

async function expectReceptionMeta(page: Page, scenario: Scenario) {
  const meta = page.locator('.reception-page__meta-bar');
  await expect(meta).toHaveAttribute('data-run-id', RUN_ID, { timeout: 15_000 });
  await expect(meta).toContainText(`dataSourceTransition: ${scenario.dataSourceTransition}`);
  await expect(meta).toContainText(`missingMaster: ${String(scenario.missingMaster)}`);
  await expect(meta).toContainText(`cacheHit: ${String(scenario.cacheHit)}`);
}

async function expectChartsMeta(page: Page, scenario: Scenario) {
  const meta = page.locator('[data-test-id="charts-topbar-meta"]');
  await expect(meta).toHaveAttribute('data-run-id', RUN_ID, { timeout: 20_000 });
  await expect(meta).toHaveAttribute('data-source-transition', scenario.dataSourceTransition);
  await expect(meta).toHaveAttribute('data-missing-master', String(scenario.missingMaster));
  await expect(meta).toHaveAttribute('data-cache-hit', String(scenario.cacheHit));
  await expect(meta).toHaveAttribute('data-fallback-used', String(scenario.fallbackUsed));

  const patientPill = page.locator('.charts-actions__pill', { hasText: '患者:' });
  await expect(patientPill).toContainText(/山田|000001/);
}

async function expectToneBanner(page: Page, scenario: Scenario) {
  const banner = page.locator('.tone-banner').first();
  await expect(banner).toBeVisible({ timeout: 10_000 });
  const ariaLive = await banner.getAttribute('aria-live');
  if (scenario.tone === 'info') {
    expect(ariaLive).toBe('polite');
  } else {
    expect(ariaLive).toBe('assertive');
  }
  await expect(banner).toHaveAttribute('data-run-id', RUN_ID);
}

async function runSendAndBillingFlow(page: Page, scenario: Scenario) {
  const sendButton = page.getByRole('button', { name: 'ORCA 送信' });

  if (scenario.expectSendEnabled) {
    await expect(sendButton).toBeEnabled({ timeout: 10_000 });
    await sendButton.click();
    const dialog = page.getByRole('dialog', { name: 'ORCA送信の確認' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: '送信する' }).click();

    const toast = page.locator('.charts-actions__toast');
    await expect(toast).toContainText('ORCA送信を完了', { timeout: 20_000 });
    await expect(toast).toContainText(`transition=${scenario.dataSourceTransition}`);
  } else {
    await expect(sendButton).toBeDisabled({ timeout: 5_000 });
    const reason = (await sendButton.getAttribute('data-disabled-reason')) ?? '';
    if (scenario.missingMaster) expect(reason).toContain('missing');
    if (scenario.fallbackUsed) expect(reason).toContain('fallback');
  }

  const billingButton = page.getByRole('button', { name: '会計へ' });
  if (scenario.expectSendEnabled) {
    await expect(billingButton).toBeEnabled({ timeout: 10_000 });
    await billingButton.click();
    await expect(page).toHaveURL(/reception/, { timeout: 10_000 });
    await expect(page).toHaveURL(/section=billing/);
    await expect(page.locator('.reception-page__meta-bar')).toHaveAttribute('data-run-id', RUN_ID);
  } else {
    await expect(billingButton).toBeDisabled({ timeout: 5_000 });
    await expect(billingButton).toHaveAttribute('data-disabled-reason');
  }
}

async function stubOutpatientApis(page: Page, scenario: Scenario) {
  const meta = {
    runId: RUN_ID,
    cacheHit: scenario.cacheHit,
    missingMaster: scenario.missingMaster,
    dataSourceTransition: scenario.dataSourceTransition,
    fallbackUsed: scenario.fallbackUsed,
    recordsReturned: 1,
    fetchedAt: new Date().toISOString(),
  };

  const receptionEntry = {
    id: 'SAMPLE-01',
    appointmentId: 'APT-2401',
    receptionId: 'RCPT-2401',
    patientId: '000001',
    name: '山田 花子',
    kana: 'ヤマダ ハナコ',
    birthDate: '1985-04-12',
    sex: 'F',
    department: '内科',
    physician: '藤井',
    appointmentTime: '09:10',
    visitDate: '2025-12-18',
    status: '診療中',
    insurance: '社保12',
    note: 'Playwright fixture',
    source: 'slots',
  };

  const appointmentPayload = {
    ...meta,
    appointmentDate: receptionEntry.visitDate,
    slots: [
      {
        appointmentId: receptionEntry.appointmentId,
        appointmentTime: receptionEntry.appointmentTime.replace(':', ''),
        departmentName: receptionEntry.department,
        physicianName: receptionEntry.physician,
        patient: {
          patientId: receptionEntry.patientId,
          wholeName: receptionEntry.name,
          wholeNameKana: receptionEntry.kana,
          birthDate: receptionEntry.birthDate,
          sex: receptionEntry.sex,
        },
        visitInformation: receptionEntry.note,
        medicalInformation: receptionEntry.note,
      },
    ],
    reservations: [],
    recordsReturned: 1,
  };

  const visitPayload = {
    ...meta,
    visitDate: receptionEntry.visitDate,
    visits: [],
    recordsReturned: 0,
  };

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

  const adminPayload = {
    runId: RUN_ID,
    chartsDisplayEnabled: true,
    chartsSendEnabled: true,
    chartsMasterSource: scenario.fallbackUsed ? 'fallback' : 'server',
    deliveryVersion: 'e2e',
    deliveredAt: new Date().toISOString(),
  };
  await page.route('**/api/admin/config', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminPayload) }),
  );
  await page.route('**/api/admin/delivery', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminPayload) }),
  );

  await page.route('**/api/orca/official/appointments/list**', (route: Route) =>
    route.fulfill({
      status: scenario.missingMaster && !scenario.cacheHit ? 200 : 200,
      contentType: 'application/json',
      body: JSON.stringify(appointmentPayload),
    }),
  );

  await page.route('**/api/orca/official/visits/list**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(visitPayload),
    }),
  );

  await page.route('**/api/local/patients/search**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...meta,
        patients: [
          {
            patientId: '000001',
            name: '山田 花子',
            kana: 'ヤマダ ハナコ',
            birthDate: '1985-04-12',
            sex: 'F',
            phone: '03-1234-5678',
            insurance: '社保12',
            memo: 'Playwright stub',
          },
        ],
      }),
    }),
  );

  await page.route('**/orca21/medicalmodv2/outpatient**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...meta,
        outpatientList: [
          {
            voucherNumber: receptionEntry.id,
            patient: {
              patientId: receptionEntry.patientId,
              wholeName: receptionEntry.name,
              wholeNameKana: receptionEntry.kana,
              birthDate: receptionEntry.birthDate,
              sex: receptionEntry.sex,
            },
            department: receptionEntry.department,
            physician: receptionEntry.physician,
            appointmentId: receptionEntry.appointmentId,
            source: receptionEntry.source,
          },
        ],
      }),
    }),
  );

  await page.route('**/api/orca/queue**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'x-run-id': RUN_ID, 'x-trace-id': `${RUN_ID}-trace` },
      body: JSON.stringify({
        runId: RUN_ID,
        traceId: `${RUN_ID}-trace`,
        source: 'mock',
        fetchedAt: new Date().toISOString(),
        queue: [],
      }),
    }),
  );
}

test.describe('Charts outpatient main scenario (MSW ON)', () => {
  test.skip(mswDisabled || profile !== 'msw', 'MSW ON プロファイルのみ実行');

  for (const scenario of scenarios) {
    test(`Reception→Charts→送信→会計: ${scenario.label}`, async ({ context }) => {
      const baseHeaders = {
        'x-use-mock-orca-queue': process.env.VITE_USE_MOCK_ORCA_QUEUE === '1' ? '1' : '0',
        'x-verify-admin-delivery': process.env.VITE_VERIFY_ADMIN_DELIVERY === '1' ? '1' : '0',
      };
      await context.setExtraHTTPHeaders({
        ...baseHeaders,
        'x-msw-scenario': scenario.id,
        'x-msw-cache-hit': scenario.cacheHit ? '1' : '0',
        'x-msw-missing-master': scenario.missingMaster ? '1' : '0',
        'x-msw-transition': scenario.dataSourceTransition,
        'x-msw-fallback-used': scenario.fallbackUsed ? '1' : '0',
        'X-Run-Id': RUN_ID,
        'X-Trace-Id': `${RUN_ID}-trace`,
      });

      const page = await context.newPage();
      await login(page, true);
      await updateMswRunId(page);
      await refreshReception(page);
      await expectReceptionMeta(page, scenario);

      await openChartsFromReception(page);
      await expectChartsMeta(page, scenario);
      await expectToneBanner(page, scenario);
      await runSendAndBillingFlow(page, scenario);
    });
  }
});

test.describe('Charts outpatient main scenario (MSW OFF)', () => {
  test.skip(!mswDisabled, 'VITE_DISABLE_MSW=1 / PLAYWRIGHT_DISABLE_MSW=1 のときのみ実行');

  for (const scenario of scenarios) {
    test(`Reception→Charts→送信→会計 (MSW OFF): ${scenario.label}`, async ({ context }) => {
      const page = await context.newPage();
      await stubOutpatientApis(page, scenario);
      await login(page, false);
      await expectReceptionMeta(page, scenario);

      await openChartsFromReception(page);
      await expectChartsMeta(page, scenario);
      await expectToneBanner(page, scenario);
      await runSendAndBillingFlow(page, scenario);
    });
  }
});
