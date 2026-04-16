import { test, expect } from '../playwright/fixtures';

import { e2eAuthSession, seedAuthSession } from '../e2e/helpers/orcaMaster';

const fulfillJson = (route: any, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('REC-001 Reception status MVP', () => {
  test('shows workflow badge and keeps transmission signal separate from workflow', async ({ page }) => {
    await seedAuthSession(page);

    await page.route('**/api/user/**', async (route) =>
      fulfillJson(route, {
        facilityId: e2eAuthSession.credentials.facilityId,
        userId: e2eAuthSession.credentials.userId,
        displayName: 'E2E Admin',
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
        appointmentDate: '2026-01-20',
        apiResult: '00',
        recordsReturned: 1,
        slots: [],
        reservations: [],
      }),
    );
    await page.route('**/api/orca/official/visits/list**', async (route) =>
      fulfillJson(route, {
        visitDate: '2026-01-20',
        apiResult: '00',
        recordsReturned: 1,
        visits: [
          {
            sequentialNumber: 'SEQ-0002',
            acceptanceId: 'R-0002',
            receptionId: 'R-0002',
            patient: {
              patientId: '000002',
              wholeName: 'MVP 患者',
              wholeNameKana: 'エムブイピー カンジャ',
              birthDate: '1990-01-01',
              sex: 'F',
            },
            appointmentTime: '09:00:00',
            visitDate: '2026-01-20',
            departmentCode: '01',
            departmentName: '内科',
            physicianCode: '1001',
            physicianName: 'テスト医師',
            visitInformation: '01',
            status: '受付中',
            insuranceCombinationNumber: 'HKN-0002',
            voucherNumber: 'V-0002',
          },
        ],
      }),
    );

    const facilityId = encodeURIComponent(e2eAuthSession.credentials.facilityId);
    await page.goto(`/f/${facilityId}/reception?date=2026-01-20`);
    await expect(page.getByRole('heading', { name: '受付' })).toBeVisible();
    await page.getByRole('button', { name: 'カード' }).click();

    const entry = page.locator('[data-test-id="reception-entry-card"][data-patient-id="000002"]').first();
    await expect(entry).toBeVisible({ timeout: 20_000 });
    await expect(entry).toHaveAttribute('data-reception-status', '受付中');
    await expect(entry).not.toContainText('会計済');
  });
});
