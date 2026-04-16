// RUN_ID=20251217T113616Z
// Charts: キーボード操作・ARIA・フォーカス復元の最小検証（MSW/route stub 前提）

import { test, expect } from '../playwright/fixtures';
import { baseUrl, runId } from './helpers/orcaMaster';
import type { Page, Route } from '@playwright/test';

const stubChartsApi = async (page: Page) => {
  const adminConfig = {
    runId,
    chartsDisplayEnabled: true,
    chartsSendEnabled: true,
    chartsMasterSource: 'auto',
    verified: true,
    source: 'mock',
  };

  const appointmentResponse = {
    runId,
    cacheHit: true,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server',
    appointmentDate: '2025-12-18',
    page: 1,
    size: 50,
    recordsReturned: 1,
    hasNextPage: false,
    slots: [
      {
        appointmentId: 'appt-1',
        appointmentTime: '0900',
        visitInformation: '診療',
        receptionId: 'r-1',
        departmentName: '内科',
        physicianName: '医師1',
        medicalInformation: 'メモ',
        patient: {
          patientId: 'p-1',
          wholeName: 'テスト太郎',
          wholeNameKana: 'ﾃｽﾄﾀﾛｳ',
          birthDate: '1970-01-01',
          sex: 'M',
        },
      },
    ],
  };

  const visitResponse = {
    runId,
    cacheHit: true,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server',
    visitDate: '2025-12-18',
    visits: [],
  };

  const orcaSummaryResponse = {
    runId,
    cacheHit: true,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server',
    outpatientList: [],
    recordsReturned: 0,
    apiResultMessage: 'ok',
  };

  await page.route('**/api/user/**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        facilityId: '0001',
        userId: 'doctor1',
        displayName: 'Playwright Doctor',
        roles: ['admin'],
      }),
    }),
  );

  await page.route('**/api/admin/config', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminConfig) }),
  );
  await page.route('**/api/admin/delivery', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminConfig) }),
  );

  await page.route('**/api/orca/official/appointments/list**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(appointmentResponse) }),
  );
  await page.route('**/api/orca/official/visits/list**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(visitResponse) }),
  );
  await page.route('**/orca21/medicalmodv2/outpatient**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(orcaSummaryResponse) }),
  );
};

test.describe('@a11y Charts keyboard + aria', () => {
  test.use({ ignoreHTTPSErrors: true });

  test('Alt+P で患者検索へ移動し Esc で戻る', async ({ context }) => {
    const page = await context.newPage();
    await stubChartsApi(page);

    await page.goto(`${baseUrl}/login`);
    await page.getByLabel('施設ID').fill('0001');
    await page.getByLabel('ユーザーID').fill('doctor1');
    await page.getByLabel('パスワード').fill('pass');
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForResponse('**/api/user/**');
    await expect(page).toHaveURL(/reception/);

    await page.goto(`${baseUrl}/charts?msw=1`);
    await expect(page.locator('[data-test-id=\"charts-actionbar\"]')).toBeVisible({ timeout: 20_000 });

    const sendButton = page.locator('#charts-action-send');
    await sendButton.focus();
    await expect(sendButton).toBeFocused();

    await page.keyboard.press('Alt+P');
    const search = page.locator('#charts-patient-search');
    await expect(search).toBeFocused();

    await search.fill('テスト');
    await page.keyboard.press('Escape');
    await expect(sendButton).toBeFocused();
  });

  test('Alt+S/Alt+I でダイアログを開き Esc で閉じてフォーカス復元 + runId 不変', async ({ context }) => {
    const page = await context.newPage();
    await stubChartsApi(page);

    await page.goto(`${baseUrl}/login`);
    await page.getByLabel('施設ID').fill('0001');
    await page.getByLabel('ユーザーID').fill('doctor1');
    await page.getByLabel('パスワード').fill('pass');
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForResponse('**/api/user/**');

    await page.goto(`${baseUrl}/charts?msw=1`);
    await expect(page.locator('[data-test-id=\"charts-topbar-meta\"]')).toBeVisible({ timeout: 20_000 });

    const topbar = page.locator('[data-test-id=\"charts-topbar-meta\"]');
    const initialRunId = await topbar.getAttribute('data-run-id');
    expect(initialRunId).toBe(runId);

    const sendButton = page.locator('#charts-action-send');
    await sendButton.focus();

    await page.keyboard.press('Alt+S');
    const sendDialog = page.locator('[data-test-id=\"charts-send-dialog\"] .focus-trap-dialog__panel');
    await expect(sendDialog).toBeVisible();
    await expect(sendDialog).toHaveAttribute('role', 'alertdialog');
    await expect(sendDialog).toHaveAttribute('aria-modal', 'true');

    // Tab がダイアログ外へ出ない（簡易チェック: activeElement が panel 内にいる）
    await page.keyboard.press('Tab');
    const focusedInDialog = await sendDialog.evaluate((panel) => panel.contains(document.activeElement));
    expect(focusedInDialog).toBe(true);

    await page.keyboard.press('Escape');
    await expect(sendDialog).toBeHidden();
    await expect(sendButton).toBeFocused();

    const runIdAfterSendDialog = await topbar.getAttribute('data-run-id');
    expect(runIdAfterSendDialog).toBe(initialRunId);

    const printButton = page.locator('#charts-action-print');
    await printButton.focus();
    await page.keyboard.press('Alt+I');
    const printDialog = page.locator('[data-test-id=\"charts-print-dialog\"] .focus-trap-dialog__panel');
    await expect(printDialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(printDialog).toBeHidden();
    await expect(printButton).toBeFocused();

    const runIdAfterPrintDialog = await topbar.getAttribute('data-run-id');
    expect(runIdAfterPrintDialog).toBe(initialRunId);
  });
});
