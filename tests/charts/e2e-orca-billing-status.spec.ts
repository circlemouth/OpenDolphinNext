import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, seedAuthSession, withChartLock } from '../e2e/helpers/orcaMaster';
import { buildIncomeInfoXml } from '../../web-client/src/mocks/fixtures/orcaAdditional';
import {
  buildAppointmentFixture,
  buildVisitListFixture,
  type OutpatientFlagSet,
} from '../../web-client/src/mocks/fixtures/outpatient';

const RUN_ID = process.env.RUN_ID ?? '20260121T111246Z';
process.env.RUN_ID ??= RUN_ID;

test.use({
  ignoreHTTPSErrors: true,
  extraHTTPHeaders: {
    'x-msw-missing-master': '0',
    'x-msw-transition': 'server',
    'x-msw-cache-hit': '0',
    'x-msw-fallback-used': '0',
    'x-msw-run-id': RUN_ID,
  },
});

test('会計伝票の送信結果と incomeinfv2 を突き合わせて会計済みを表示する (MSW)', async ({ page }) => {
  const artifactDir =
    process.env.PLAYWRIGHT_ARTIFACT_DIR ??
    path.join(process.cwd(), 'artifacts', 'webclient', 'orca-e2e', '20260122', 'billing-status');
  fs.mkdirSync(artifactDir, { recursive: true });

    await withChartLock(page, async () => {
      await seedAuthSession(page);
      const facilityId = e2eAuthSession.credentials.facilityId;
      const userId = e2eAuthSession.credentials.userId;
      const outpatientFlags: OutpatientFlagSet = {
        runId: 'RUN-E2E',
        cacheHit: false,
        missingMaster: false,
        dataSourceTransition: 'server',
        fallbackUsed: false,
      };

      await page.route('**/api01rv2/incomeinfv2', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/xml; charset=UTF-8',
          body: buildIncomeInfoXml(),
        }),
      );
      await page.route('**/api/orca/official/appointments/list', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildAppointmentFixture(outpatientFlags)),
        }),
      );
      await page.route('**/api/orca/official/visits/list', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildVisitListFixture(outpatientFlags)),
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
            apiResult: '00',
            sendStatus: 'success',
            savedAt: '2026-01-22T09:00:00Z',
          },
        },
      },
    );
    await page.addInitScript(
      ({ storageKey, sessionKey, flags }) => {
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({ sessionKey, flags, updatedAt: new Date().toISOString() }),
        );
      },
      {
        storageKey: 'opendolphin:web-client:auth-flags',
        sessionKey: `${facilityId}:${userId}`,
        flags: {
          runId: outpatientFlags.runId,
          cacheHit: false,
          missingMaster: false,
          dataSourceTransition: 'server',
          fallbackUsed: false,
        },
      },
    );

    await page.goto(`${baseUrl}/f/${facilityId}/charts?patientId=000001&visitDate=2026-01-21&msw=1`);
    await expect(page.locator('.charts-page')).toBeVisible({ timeout: 20_000 });

    const summary = page.locator('[data-test-id=\"orca-summary\"]');
    await expect(summary).toBeVisible({ timeout: 20_000 });

    const refreshButton = summary.getByRole('button', { name: '収納情報を確認' });
    await expect(refreshButton).toBeEnabled({ timeout: 20_000 });
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api01rv2/incomeinfv2') && response.ok()),
      refreshButton.click(),
    ]);

    await expect(summary.getByText(/Api_Result=00/)).toBeVisible({ timeout: 10_000 });
    await expect(summary.getByText('ステータス: 会計済み')).toBeVisible({ timeout: 10_000 });

    const billingLog = await page.evaluate(() => {
      const log = (window as any).__OUTPATIENT_FUNNEL__ as Array<any> | undefined;
      if (!Array.isArray(log)) return null;
      const candidates = log.filter((entry) => entry.action === 'billing_status_update');
      return candidates.length > 0 ? candidates[candidates.length - 1] : null;
    });
    if (billingLog) {
      fs.writeFileSync(
        path.join(artifactDir, 'billing-status-funnel.json'),
        JSON.stringify(billingLog, null, 2),
      );
    }
    expect(typeof billingLog?.durationMs).toBe('number');
    expect(billingLog?.durationMs).toBeLessThanOrEqual(500);

    await page.goto(`${baseUrl}/f/${facilityId}/reception?msw=1`);
    await expect(page.locator('.reception-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('cell', { name: /ORCAキュー: 応答済/ })).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: path.join(artifactDir, 'billing-status.png'),
      fullPage: true,
    });
    await page.screenshot({
      path: path.join(artifactDir, 'billing-status-queue-ack.png'),
      fullPage: true,
    });
  });
});
