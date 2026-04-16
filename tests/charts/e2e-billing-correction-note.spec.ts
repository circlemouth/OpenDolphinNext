import { test, expect } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, seedAuthSession, withChartLock } from '../e2e/helpers/orcaMaster';
import {
  buildAppointmentFixture,
  buildVisitListFixture,
  type OutpatientFlagSet,
} from '../../web-client/src/mocks/fixtures/outpatient';

const RUN_ID = process.env.RUN_ID ?? '20260417T010000Z';
process.env.RUN_ID ??= RUN_ID;

test.use({
  ignoreHTTPSErrors: true,
  serviceWorkers: 'block',
  extraHTTPHeaders: {
    'x-msw-missing-master': '0',
    'x-msw-transition': 'server',
    'x-msw-cache-hit': '0',
    'x-msw-fallback-used': '0',
    'x-msw-run-id': RUN_ID,
  },
});

const seedChartsNavigationState = async (
  page: Parameters<typeof test>[0]['page'],
  params: { patientId: string; appointmentId: string; receptionId: string; scheduleKey: string; encounterKey: string; visitDate: string; runId: string },
) => {
  await page.addInitScript((state) => {
    const current = window.history.state ?? {};
    window.history.replaceState(
      {
        ...current,
        usr: {
          ...(typeof current === 'object' && current ? (current as { usr?: Record<string, unknown> }).usr : {}),
          ...state,
        },
      },
      '',
      window.location.href,
    );
  }, params);
};

test('correction note は workflow ではなく note として表示し、setting note と分離する (MSW)', async ({ page }) => {
  await withChartLock(page, async () => {
    await seedAuthSession(page);
    const facilityId = e2eAuthSession.credentials.facilityId;
    const userId = e2eAuthSession.credentials.userId;
    const outpatientFlags: OutpatientFlagSet = {
      runId: 'RUN-CORRECTION',
      cacheHit: false,
      missingMaster: false,
      dataSourceTransition: 'server',
      fallbackUsed: false,
    };

    await page.route('**/api/orca/official/appointments/list', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...buildAppointmentFixture(outpatientFlags),
          appointmentDate: '2026-01-21',
          slots: [
            {
              appointmentId: 'APT-2401',
              appointmentTime: '0910',
              departmentName: '01 内科',
              departmentCode: '01',
              physicianName: '藤井',
              physicianCode: '10001',
              scheduleKey: 'F001:S2401',
              encounterKey: 'F001:E2401',
              patient: {
                patientId: '000001',
                wholeName: '山田 花子',
                wholeNameKana: 'ヤマダ ハナコ',
                birthDate: '1985-04-12',
                sex: 'F',
              },
            },
          ],
          reservations: [],
          visits: [],
        }),
      }),
    );
    await page.route('**/api/session/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          facilityId,
          userId,
          clientUuid: 'e2e-playwright',
          runId: outpatientFlags.runId,
          roles: ['admin'],
          displayName: 'Playwright Doctor',
        }),
      }),
    );
    await page.route('**/api/orca/official/visits/list', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...buildVisitListFixture(outpatientFlags),
          visitDate: '2026-01-21',
          visits: [
            {
              receptionId: 'RCPT-2401',
              sequentialNumber: 'APT-2401',
              scheduleKey: 'F001:S2401',
              encounterKey: 'F001:E2401',
              acceptanceTime: '0910',
              departmentCode: '01',
              departmentName: '01 内科',
              physicianCode: '10001',
              physicianName: '藤井',
              visitInformation: '受付',
              patient: {
                patientId: '000001',
                wholeName: '山田 花子',
                wholeNameKana: 'ヤマダ ハナコ',
                birthDate: '1985-04-12',
                sex: 'F',
              },
            },
          ],
        }),
      }),
    );
    await page.addInitScript(
      ({ storageKey, payload }) => {
        window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
      },
      {
        storageKey: `charts:orca-claim-send:${facilityId}:${userId}`,
        payload: {
          '000001': {
            patientId: '000001',
            appointmentId: 'A-1',
            invoiceNumber: 'INV-001',
            dataId: 'DATA-1',
            runId: 'RUN-CLAIM',
            traceId: 'TRACE-CLAIM',
            apiResult: '80',
            sendStatus: 'success',
            medicalWarnings: [
              {
                medicalWarning: 'warning',
                medicalWarningMessage: '補正候補があります',
                medicalWarningCode: 'W01',
                medicalWarningPosition: 1,
                medicalWarningItemPosition: 1,
              },
            ],
            savedAt: '2026-04-17T09:00:00Z',
          },
        },
      },
    );

    await seedChartsNavigationState(page, {
      patientId: '000001',
      appointmentId: 'APT-2401',
      receptionId: 'RCPT-2401',
      scheduleKey: 'F001:S2401',
      encounterKey: 'F001:E2401',
      visitDate: '2026-01-21',
      runId: outpatientFlags.runId,
    });
    await page.goto(`${baseUrl}/f/${facilityId}/charts?msw=1`);
    await expect(page.locator('.charts-page')).toBeVisible({ timeout: 20_000 });
    const summary = page.locator('[data-test-id="orca-summary"]');
    await expect(summary).toBeVisible({ timeout: 20_000 });
    const detailsToggle = summary.getByText('詳細を表示').first();
    if (await detailsToggle.isVisible().catch(() => false)) {
      await detailsToggle.click();
    }

    await expect(summary.getByText('confirmation: 会計待ち+送信済')).toBeVisible({ timeout: 10_000 });
    await expect(summary.getByText('transmission: 送信済')).toBeVisible({ timeout: 10_000 });
    await expect(summary.locator('[data-test-id="orca-billing-correction-note"]')).toContainText('補正が必要です');
    await expect(summary.locator('[data-test-id="orca-billing-setting-note"]')).toContainText('収納情報の確認前です');
    await expect(summary.getByText('Workflow / 院内ローカル診療サマリ')).toBeVisible({ timeout: 10_000 });
  });
});
