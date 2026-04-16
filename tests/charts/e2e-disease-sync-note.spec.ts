import { test, expect } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, seedAuthSession, withChartLock } from '../e2e/helpers/orcaMaster';
import {
  buildAppointmentFixture,
  buildMedicalSummaryFixture,
  buildPatientListFixture,
  buildVisitListFixture,
  type OutpatientFlagSet,
} from '../../web-client/src/mocks/fixtures/outpatient';

const RUN_ID = process.env.RUN_ID ?? '20260416T205543Z-disease-sync-note';
process.env.RUN_ID ??= RUN_ID;
const FACILITY_ID = e2eAuthSession.credentials.facilityId;
const USER_ID = e2eAuthSession.credentials.userId;
const PASSWORD = 'doctor2025';

async function seedChartsAuthContext(page: Parameters<typeof test>[0]['page']) {
  await seedAuthSession(page);
  await page.addInitScript(({ facilityId, userId, runId, clientUuid }) => {
    const sessionPayload = {
      facilityId,
      userId,
      clientUuid,
      runId,
      roles: ['admin'],
      displayName: 'E2E Admin',
      commonName: 'E2E Admin',
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
        const requestBody = typeof init?.body === 'string' ? JSON.parse(init.body) as { clientUuid?: string } : undefined;
        return new Response(
          JSON.stringify({
            ...sessionPayload,
            clientUuid: requestBody?.clientUuid ?? clientUuid,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (url.includes('/api/local/diagnoses/') && (init?.method ?? 'GET') === 'GET') {
        return new Response(
          JSON.stringify({
            runId,
            patientId: '000001',
            karteId: 1001,
            diseases: [
              {
                diagnosisId: 55,
                diagnosisName: '脂質異常症',
                diagnosisCode: 'E78.5',
                startDate: '2026-04-01',
                layer: 'insurance-local',
                syncState: 'conflict',
                note: 'ORCA側と差分があります',
              },
              {
                diagnosisId: 77,
                diagnosisName: '脂質異常症',
                diagnosisCode: 'E78.5',
                startDate: '2026-04-01',
                layer: 'orca-mirror',
                syncState: 'manual-resolution',
                readOnly: true,
                note: '保険病名の確認が必要です',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (url.endsWith('/api/local/diagnoses') && (init?.method ?? 'GET') === 'POST') {
        (window as typeof window & { __diseaseMutationCount?: number }).__diseaseMutationCount =
          ((window as typeof window & { __diseaseMutationCount?: number }).__diseaseMutationCount ?? 0) + 1;
        return new Response(
          JSON.stringify({
            runId,
            createdDiagnosisIds: [501],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (url.includes('/api/orca/official/disease-master/name/')) {
        const decodedUrl = decodeURIComponent(url);
        const list = decodedUrl.includes('高血')
          ? [{ code: '8839001', name: '高血圧症', icdTen: 'I10', layer: 'candidate', readOnly: true, candidateOnly: true }]
          : [];
        return new Response(
          JSON.stringify({ layer: 'candidate', readOnly: true, candidateOnly: true, list }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      return originalFetch(input, init);
    };
    (window as typeof window & { __diseaseMutationCount?: number }).__diseaseMutationCount = 0;
    let csrfMeta = document.querySelector("meta[name='csrf-token']");
    if (!csrfMeta) {
      csrfMeta = document.createElement('meta');
      csrfMeta.setAttribute('name', 'csrf-token');
      document.head.appendChild(csrfMeta);
    }
    csrfMeta.setAttribute('content', 'test-csrf-token');
    window.localStorage.setItem('devFacilityId', facilityId);
    window.localStorage.setItem('devUserId', userId);
    window.localStorage.setItem('devPasswordMd5', '632080fabdb968f9ac4f31fb55104648');
    window.localStorage.setItem('devClientUuid', 'e2e-playwright');
    window.localStorage.setItem('devRole', 'admin');
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
    facilityId: FACILITY_ID,
    userId: USER_ID,
    runId: RUN_ID,
    clientUuid: e2eAuthSession.credentials.clientUuid,
  });
}

async function ensureChartsSession(page: Parameters<typeof test>[0]['page']) {
  const panel = page.locator('[data-test-id="diagnosis-edit-panel"]');
  const loginHeading = page.getByRole('heading', { name: 'OpenDolphin Web ログイン' });
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await panel.isVisible().catch(() => false)) {
      return;
    }
    if (await loginHeading.isVisible().catch(() => false)) {
      await page.getByLabel('施設ID').fill(FACILITY_ID);
      await page.getByLabel('ユーザーID').fill(USER_ID);
      await page.getByLabel('パスワード').fill(PASSWORD);
      await expect(page.getByRole('button', { name: 'ログイン' })).toBeEnabled();
      await page.getByRole('button', { name: 'ログイン' }).click();
      await page.waitForURL(`**/f/${encodeURIComponent(FACILITY_ID)}/charts**`, { timeout: 20_000 });
      await expect(panel).toBeVisible({ timeout: 20_000 });
      return;
    }
    await page.waitForTimeout(500);
  }
  throw new Error('charts 画面またはログイン画面を確認できませんでした。');
}

test.use({
  viewport: { width: 1366, height: 900 },
  ignoreHTTPSErrors: true,
  extraHTTPHeaders: {
    'x-msw-missing-master': '0',
    'x-msw-transition': 'server',
    'x-msw-cache-hit': '0',
    'x-msw-fallback-used': '0',
    'x-msw-run-id': RUN_ID,
  },
});

test('Disease: 3層見出しと manual-resolution note を表示し、候補は confirm 前に自動登録しない', async ({ page }) => {
  await withChartLock(page, async () => {
    await seedChartsAuthContext(page);
    const outpatientFlags: OutpatientFlagSet = {
      runId: RUN_ID,
      cacheHit: false,
      missingMaster: false,
      dataSourceTransition: 'server',
      fallbackUsed: false,
    };

    await page.route('**/orca21/medicalmodv2/outpatient**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildMedicalSummaryFixture(outpatientFlags)),
      }),
    );
    await page.route('**/api/orca/official/appointments/list/mock', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildAppointmentFixture(outpatientFlags)),
      }),
    );
    await page.route('**/api/orca/official/visits/list/mock', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildVisitListFixture(outpatientFlags)),
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
    await page.route('**/api/local/patients/search/mock', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPatientListFixture(outpatientFlags, '/api/local/patients/search/mock')),
      }),
    );
    await page.route('**/api/local/patients/search', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPatientListFixture(outpatientFlags, '/api/local/patients/search')),
      }),
    );
    await page.context().route('**/api/session/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          facilityId: FACILITY_ID,
          userId: USER_ID,
          clientUuid: e2eAuthSession.credentials.clientUuid,
          runId: RUN_ID,
          roles: ['admin'],
          displayName: 'E2E Admin',
          commonName: 'E2E Admin',
        }),
      }),
    );
    await page.context().route('**/api/session/login', async (route) => {
      const requestBody = route.request().postDataJSON() as
        | { facilityId?: string; userId?: string; clientUuid?: string }
        | undefined;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          facilityId: requestBody?.facilityId ?? FACILITY_ID,
          userId: requestBody?.userId ?? USER_ID,
          clientUuid: requestBody?.clientUuid ?? e2eAuthSession.credentials.clientUuid,
          runId: RUN_ID,
          roles: ['admin'],
          displayName: 'E2E Admin',
          commonName: 'E2E Admin',
        }),
      });
    });
    await page.goto(`${baseUrl}/f/${FACILITY_ID}/charts?patientId=000001&visitDate=2026-01-21&msw=1`, {
      waitUntil: 'domcontentloaded',
    });
    await ensureChartsSession(page);

    const panel = page.locator('[data-test-id="diagnosis-edit-panel"]');
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel.locator('strong').filter({ hasText: '保険病名' }).first()).toBeVisible();
    await expect(panel.getByText('ORCA mirror', { exact: true })).toBeVisible();
    await expect(panel.getByText('候補', { exact: true })).toBeVisible();
    await expect(panel.getByText('保険病名の確認が必要です')).toBeVisible();
    await expect(panel.getByText('ORCA側と差分があります')).toBeVisible();
    await expect(panel.getByText('clinical source が未実装のため、この画面では保険病名だけを扱います。')).toBeVisible();
    await expect(panel.getByText('参照専用', { exact: true })).toBeVisible();

    const diagnosisNameInput = panel.getByLabel('病名 *');
    if (await diagnosisNameInput.isDisabled()) {
      const missingMasterToggle = page.getByRole('button', { name: /missingMaster:/ });
      if ((await missingMasterToggle.textContent())?.includes('true')) {
        await missingMasterToggle.click();
      }
      const transitionSelect = page.getByRole('combobox', { name: 'dataSourceTransition' });
      await transitionSelect.selectOption('server');
      await expect(diagnosisNameInput).toBeEnabled();
    }

    await diagnosisNameInput.fill('高血');
    await expect(panel.getByText('同期候補があります')).toBeVisible();

    const candidateSelect = panel.getByLabel('病名候補');
    await expect(candidateSelect).toBeEnabled();
    await expect(candidateSelect.locator('option')).toContainText(['候補を選択して入力へ反映', '高血圧症']);
    await candidateSelect.selectOption('高血圧症\u00008839001\u0000I10\u00000');

    expect(await page.evaluate(() => (window as typeof window & { __diseaseMutationCount?: number }).__diseaseMutationCount ?? 0)).toBe(0);
  });
});
