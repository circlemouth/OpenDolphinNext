import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, seedAuthSession, withChartLock } from '../e2e/helpers/orcaMaster';
import {
  buildAppointmentFixture,
  buildVisitListFixture,
  type OutpatientFlagSet,
} from '../../web-client/src/mocks/fixtures/outpatient';

const RUN_ID = process.env.RUN_ID ?? '20260121T111246Z';
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

test('会計伝票の送信結果と incomeinfv2 を突き合わせて会計済みを表示する (MSW)', async ({ page }) => {
  const artifactDir =
    process.env.PLAYWRIGHT_ARTIFACT_DIR ??
    path.join(process.cwd(), 'artifacts', 'webclient', 'orca-e2e', '20260122', 'billing-status');
  fs.mkdirSync(artifactDir, { recursive: true });

  await withChartLock(page, async () => {
    await seedAuthSession(page);
    const facilityId = e2eAuthSession.credentials.facilityId;
    const userId = e2eAuthSession.credentials.userId;
    const visitDate = new Date().toISOString().slice(0, 10);
    const outpatientFlags: OutpatientFlagSet = {
      runId: 'RUN-E2E',
      cacheHit: false,
      missingMaster: false,
      dataSourceTransition: 'server',
      fallbackUsed: false,
    };
    const adminConfig = {
      runId: outpatientFlags.runId,
      chartsDisplayEnabled: true,
      chartsSendEnabled: true,
      chartsMasterSource: 'auto',
      verified: true,
      source: 'mock',
    };
    const queueResponse = {
      ...outpatientFlags,
      source: 'mock',
      fetchedAt: new Date().toISOString(),
      queue: [
        {
          id: 'Q-ACK-2401',
          phase: 'ack',
          patientId: '000001',
          scheduleKey: 'F001:S2401',
          encounterKey: 'F001:E2401',
        },
      ],
    };
    const browserContext = page.context();

    await page.addInitScript(({ adminConfig, facilityId, queueResponse, runId, userId }) => {
      const sessionPayload = {
        facilityId,
        userId,
        clientUuid: 'e2e-playwright',
        runId,
        roles: ['admin'],
        displayName: 'Playwright Doctor',
      };
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        if (url.includes('/api/session/me')) {
          return new Response(JSON.stringify(sessionPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/api/session/login') && !url.includes('/api/session/login/factor2')) {
          return new Response(JSON.stringify(sessionPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/api/admin/config') || url.includes('/api/admin/delivery')) {
          return new Response(JSON.stringify(adminConfig), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/api/orca/queue')) {
          return new Response(JSON.stringify(queueResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return originalFetch(input, init);
      };
      window.localStorage.setItem('devFacilityId', facilityId);
      window.localStorage.setItem('devUserId', userId);
      window.localStorage.setItem('devPasswordMd5', '632080fabdb968f9ac4f31fb55104648');
      window.localStorage.setItem('devClientUuid', 'e2e-playwright');
      window.localStorage.setItem('devRole', 'admin');
      window.sessionStorage.setItem(
        'opendolphin:web-client:auth',
        JSON.stringify({
          facilityId,
          userId,
          role: 'admin',
          clientUuid: 'e2e-playwright',
          runId,
          displayName: 'Playwright Doctor',
        }),
      );
      window.sessionStorage.setItem(
        'opendolphin:web-client:auth-flags',
        JSON.stringify({
          sessionKey: `${facilityId}:${userId}`,
          flags: {
            runId,
            cacheHit: false,
            missingMaster: false,
            dataSourceTransition: 'server',
            fallbackUsed: false,
          },
          updatedAt: new Date().toISOString(),
        }),
      );
    }, {
      adminConfig,
      facilityId,
      queueResponse,
      runId: outpatientFlags.runId,
      userId,
    });
    await browserContext.route('**/api/session/me**', (route) =>
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
    await browserContext.route('**/api/admin/config**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminConfig) }),
    );
    await browserContext.route('**/api/admin/delivery**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminConfig) }),
    );
    await page.route('**/api/orca/official/appointments/list**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...buildAppointmentFixture(outpatientFlags),
          appointmentDate: visitDate,
          slots: [
            {
              appointmentId: 'APT-2401',
              appointmentTime: '0910',
              departmentName: '01 内科',
              departmentCode: '01',
              physicianName: '藤井',
              physicianCode: '10001',
              insuranceCombinationNumber: '0001',
              voucherNumber: 'V-2401',
              sequentialNumber: 'APT-2401',
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
    await page.route('**/api/orca/official/visits/list**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...buildVisitListFixture(outpatientFlags),
          visitDate,
          visits: [
            {
              receptionId: 'RCPT-2401',
              sequentialNumber: 'APT-2401',
              voucherNumber: 'V-2401',
              insuranceCombinationNumber: '0001',
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
    await page.route('**/api/orca/official/chart-support/income-info', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          apiOk: true,
          apiResult: '00',
          apiResultMessage: 'OK',
          informationDate: visitDate.replaceAll('-', ''),
          informationTime: '090000',
          entries: [
            {
              performDate: visitDate,
              performEndDate: visitDate,
              inOut: 'O',
              invoiceNumber: 'INV-001',
              departmentCode: '01',
              departmentName: '01 内科',
              insuranceCombinationNumber: '0001',
              claimAmount: 1800,
              paymentAmount: 1800,
              insuranceAppliedAmount: 300,
              selfPayAmount: 1500,
              mealLivingCopayAmount: 0,
            },
          ],
          unpaidMoneyTotal: 0,
          unpaidMoneyInformation: [],
        }),
      }),
    );
    await page.route('**/api/orca/queue**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(queueResponse),
      }),
    );
    await page.addInitScript(
      ({ storageKey, payload }) => {
        window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
      },
      {
        storageKey: `charts:orca-claim-send:${facilityId}:${userId}`,
        payload: {
          'appointment:A-1': {
            cacheKey: 'appointment:A-1',
            patientId: '000001',
            appointmentId: 'A-1',
            dataId: 'DATA-1',
            runId: 'RUN-CLAIM',
            traceId: 'TRACE-CLAIM',
            apiResult: '00',
            sendStatus: 'success',
            savedAt: new Date().toISOString(),
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

    await seedChartsNavigationState(page, {
      patientId: '000001',
      appointmentId: 'APT-2401',
      receptionId: 'RCPT-2401',
      scheduleKey: 'F001:S2401',
      encounterKey: 'F001:E2401',
      visitDate,
      runId: outpatientFlags.runId,
    });
    await page.goto(`${baseUrl}/f/${facilityId}/charts?msw=1`);
    await expect(page.locator('.charts-page')).toBeVisible({ timeout: 20_000 });
    await page.evaluate(
      async ({ facilityId, userId, visitDate }) => {
        const mod = await import('/src/features/charts/orcaClaimSendCache');
        mod.saveOrcaClaimSendCache(
          {
            patientId: '000001',
            appointmentId: 'A-1',
            performDate: visitDate,
            invoiceNumber: 'INV-001',
            dataId: 'DATA-1',
            runId: 'RUN-CLAIM',
            traceId: 'TRACE-CLAIM',
            apiResult: '00',
            sendStatus: 'success',
          },
          { facilityId, userId },
        );
      },
      { facilityId, userId, visitDate },
    );

    const summary = page.locator('[data-test-id="orca-summary"]');
    await expect(summary).toBeVisible({ timeout: 20_000 });
    const detailsToggle = summary.getByText('詳細を表示').first();
    if (await detailsToggle.isVisible().catch(() => false)) {
      await detailsToggle.click();
    }

    const refreshButton = summary.getByRole('button', { name: '収納情報を確認' });
    await expect(refreshButton).toBeEnabled({ timeout: 20_000 });
    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/api/orca/official/chart-support/income-info') && response.ok(),
      ),
      refreshButton.click(),
    ]);

    await expect(summary.getByText(/Api_Result=00/)).toBeVisible({ timeout: 10_000 });
    await expect(summary.getByText('confirmation: 会計済み')).toBeVisible({ timeout: 10_000 });

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

    await page.screenshot({
      path: path.join(artifactDir, 'billing-status.png'),
      fullPage: true,
    });
  });
});
