import { test, expect } from '../playwright/fixtures';
import type { Page } from '@playwright/test';
import { profile } from './helpers/orcaMaster';

const runId = process.env.RUN_ID ?? '20251217T130407Z';

async function loginWithMsw(page: Page) {
  const facilityId = 'FAC-E2E';
  const userId = 'doctor-e2e';

  await page.route('**/api/user/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        facilityId,
        userId,
        displayName: 'E2E Doctor',
        role: 'doctor',
      }),
    }),
  );

  await page.goto('/login?msw=1');
  await page.getByLabel('施設ID').fill(facilityId);
  await page.getByLabel('ユーザーID').fill(userId);
  await page.getByLabel('パスワード').fill('password');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForURL('**/reception', { timeout: 10_000 });
}

async function mockOutpatientEndpoints(
  page: Page,
  payload: { missingMaster: boolean; fallbackUsed?: boolean; dataSourceTransition?: string },
) {
  const common = {
    runId,
    cacheHit: !payload.missingMaster,
    missingMaster: payload.missingMaster,
    fallbackUsed: payload.fallbackUsed ?? false,
    dataSourceTransition: (payload.dataSourceTransition as any) ?? 'server',
    recordsReturned: 3,
    fetchedAt: '2025-12-17T12:34:56Z',
  };

  await page.route('**/orca21/medicalmodv2/outpatient**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...common,
        outpatientList: [{}, {}, {}],
        apiResultMessage: payload.fallbackUsed ? 'fallbackUsed=true' : 'server ok',
      }),
    }),
  );

  await page.route('**/api/orca/official/appointments/list**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...common,
        appointmentDate: '2025-12-17',
        slots: [
          {
            appointmentId: 'APT-001',
            appointmentTime: '0900',
            departmentName: '内科',
            physicianName: '医師A',
            patient: {
              patientId: 'PX-1',
              wholeName: 'テスト太郎',
              wholeNameKana: 'テストタロウ',
              birthDate: '1980-01-01',
              sex: 'M',
            },
            visitInformation: '予約',
            medicalInformation: '予約',
          },
          {
            appointmentId: 'APT-002',
            appointmentTime: payload.fallbackUsed ? '0900' : '1000',
            departmentName: '内科',
            physicianName: '医師A',
            patient: {
              patientId: 'PX-2',
              wholeName: 'テスト花子',
              wholeNameKana: 'テストハナコ',
              birthDate: '1985-01-01',
              sex: 'F',
            },
            visitInformation: '予約',
            medicalInformation: '予約',
          },
        ],
        reservations: [],
      }),
    }),
  );

  await page.route('**/api/orca/official/visits/list**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...common,
        visitDate: '2025-12-17',
        visits: [],
      }),
    }),
  );

  await page.route('**/api01rv2/incomeinfv2**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?>
<xmlio2>
  <private_objects type="record">
    <Information_Date type="string">2025-12-17</Information_Date>
    <Information_Time type="string">12:00:00</Information_Time>
    <Api_Result type="string">0000</Api_Result>
    <Api_Result_Message type="string">処理終了</Api_Result_Message>
    <Income_Information type="array">
      <Income_Information_child type="record">
        <Perform_Date type="string">2025-12-16</Perform_Date>
        <Department_Name type="string">内科</Department_Name>
        <Cd_Information type="record">
          <Oe_Money type="string">1500</Oe_Money>
          <Ai_Money type="string">300</Ai_Money>
          <Ac_Money type="string">1800</Ac_Money>
        </Cd_Information>
      </Income_Information_child>
    </Income_Information>
  </private_objects>
</xmlio2>`,
    }),
  );
}

test.describe('OrcaSummary UX (MSW)', () => {
  test.skip(profile !== 'msw', 'MSW プロファイル専用');

  test('fallbackUsed=true でCTAがブロックされ、警告がassertive', async ({ page }) => {
    await loginWithMsw(page);
    await mockOutpatientEndpoints(page, { missingMaster: true, fallbackUsed: true, dataSourceTransition: 'fallback' });

    await page.getByRole('link', { name: 'カルテ / Charts' }).click();
    await page.waitForURL('**/charts', { timeout: 10_000 });

    const summary = page.locator('[data-test-id="orca-summary"]');
    await expect(summary).toBeVisible();

    const toneBanner = summary.locator('.tone-banner');
    await expect(toneBanner).toHaveAttribute('aria-live', /assertive/);

    const billingCta = summary.getByRole('button', { name: '会計へ' });
    await expect(billingCta).toBeDisabled();
    await expect(billingCta).toHaveAttribute('data-disabled-reason', 'fallback_used');

    const warning = summary.locator('[data-test-id="orca-summary-warning"]').first();
    await expect(warning).toContainText('暫定');
  });

  test('Alt+R で再取得をトリガし audit に manualRefresh が残る', async ({ page }) => {
    await loginWithMsw(page);
    await mockOutpatientEndpoints(page, { missingMaster: false, fallbackUsed: false, dataSourceTransition: 'server' });

    await page.getByRole('link', { name: 'カルテ / Charts' }).click();
    await page.waitForSelector('[data-test-id="orca-summary"]', { timeout: 10_000 });

    await page.keyboard.press('Alt+R');

    await page.waitForFunction(
      () =>
        Array.isArray((window as any).__AUDIT_UI_STATE__) &&
        (window as any).__AUDIT_UI_STATE__.some((entry: any) => entry?.details?.manualRefresh === true),
    );

    const auditLog = await page.evaluate(() => (window as any).__AUDIT_UI_STATE__);
    const manual = auditLog.find((entry: any) => entry?.details?.manualRefresh === true);
    expect(manual).toBeTruthy();
  });

  test('収納情報サマリに最新収納と合計が表示される', async ({ page }) => {
    await loginWithMsw(page);
    await mockOutpatientEndpoints(page, { missingMaster: false, fallbackUsed: false, dataSourceTransition: 'server' });

    await page.getByRole('link', { name: 'カルテ / Charts' }).click();
    await page.waitForSelector('[data-test-id="orca-summary"]', { timeout: 10_000 });

    const summary = page.locator('[data-test-id="orca-summary"]');
    await expect(summary.getByText('最新収納')).toBeVisible();
    await expect(summary.getByText('未収合計')).toBeVisible();
    await expect(summary.getByText('入金合計')).toBeVisible();
  });
});
