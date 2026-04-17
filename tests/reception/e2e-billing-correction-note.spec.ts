import { test, expect } from '../playwright/fixtures';

import { e2eAuthSession, profile, seedAuthSession } from '../e2e/helpers/orcaMaster';

const fulfillJson = (route: any, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const RUN_ID = '20260417T121000Z';
const VISIT_DATE = '2026-04-17';
const FACILITY_ID = encodeURIComponent(e2eAuthSession.credentials.facilityId);
const CACHE_STORAGE_KEY = `charts:orca-claim-send:${e2eAuthSession.credentials.facilityId}:${e2eAuthSession.credentials.userId}`;

const visitEntry = {
  sequentialNumber: 'APT-2402',
  acceptanceId: 'RCPT-2402',
  receptionId: 'RCPT-2402',
  scheduleKey: 'SCH-2402',
  encounterKey: 'ENC-2402',
  patient: {
    patientId: '000002',
    wholeName: '再計待 患者',
    wholeNameKana: 'サイケイマチ カンジャ',
    birthDate: '1990-01-01',
    sex: 'F',
  },
  appointmentTime: '09:00:00',
  visitDate: VISIT_DATE,
  departmentCode: '01',
  departmentName: '内科',
  physicianCode: '1001',
  physicianName: 'テスト医師',
  visitInformation: '会計',
  insuranceCombinationNumber: 'HKN-0002',
  voucherNumber: 'V-0002',
};

const stubReceptionApis = async (page: import('@playwright/test').Page) => {
  await page.route('**/api/user/**', async (route) =>
    fulfillJson(route, {
      facilityId: e2eAuthSession.credentials.facilityId,
      userId: e2eAuthSession.credentials.userId,
      displayName: 'E2E Admin',
      roles: ['admin'],
    }),
  );
  await page.route('**/api/orca/official/appointments/medical-information', async (route) =>
    fulfillJson(route, {
      options: [
        { code: '01', name: '外来受付' },
        { code: '02', name: '健診' },
      ],
    }),
  );
  await page.route('**/api/chart-events', async (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' }),
  );
  await page.route('**/api/realtime/reception', async (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' }),
  );
  await page.route('**/api/orca/official/appointments/list**', async (route) =>
    fulfillJson(route, {
      runId: RUN_ID,
      appointmentDate: VISIT_DATE,
      apiResult: '00',
      recordsReturned: 0,
      cacheHit: true,
      missingMaster: false,
      fallbackUsed: false,
      dataSourceTransition: 'server',
      slots: [],
      reservations: [],
    }),
  );
  await page.route('**/api/orca/official/visits/list**', async (route) =>
    fulfillJson(route, {
      runId: RUN_ID,
      visitDate: VISIT_DATE,
      apiResult: '00',
      recordsReturned: 1,
      cacheHit: true,
      missingMaster: false,
      fallbackUsed: false,
      dataSourceTransition: 'server',
      visits: [visitEntry],
    }),
  );
};

test.describe('Reception billing correction note', () => {
  test.skip(profile !== 'msw', 'MSW プロファイル専用（Stage 接続禁止）');

  test('keeps rebill note visible and projects the row into 再計待', async ({ page }) => {
    await seedAuthSession(page);
    await stubReceptionApis(page);
    await page.addInitScript(([cacheKey]) => {
      window.sessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          'reception:RCPT-2402': {
            cacheKey: 'reception:RCPT-2402',
            patientId: '000002',
            receptionId: 'RCPT-2402',
            scheduleKey: 'SCH-2402',
            encounterKey: 'ENC-2402',
            sendStatus: 'success',
            correctionKind: 'rebill',
            correctionReason: '会計済み後に変更があったため再会計が必要です。',
            savedAt: new Date().toISOString(),
          },
        }),
      );
    }, [CACHE_STORAGE_KEY]);

    await page.goto(`/f/${FACILITY_ID}/reception?date=${VISIT_DATE}`);
    await expect(page.getByRole('heading', { name: '受付' })).toBeVisible();

    await page.getByRole('tab', { name: /再計待/ }).click();
    const row = page.locator('[data-test-id="reception-entry-row"][data-patient-id="000002"]').first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toHaveAttribute('data-reception-status', '再計待');
    await expect(row.getByText(/送信:\s*送信済/)).toBeVisible();
    await expect(row.getByText('再計待: 会計済み後に変更があったため再会計が必要です。')).toBeVisible();
  });
});
