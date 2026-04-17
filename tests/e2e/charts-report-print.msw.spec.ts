import { test, expect } from '../playwright/fixtures';

const RUN_ID = process.env.RUN_ID ?? '20260113T210214Z';
process.env.RUN_ID ??= RUN_ID;

const reportState = {
  reportType: 'prescription',
  reportLabel: '処方箋',
  dataId: 'DATA-PRINT-1',
  patientId: '000001',
  appointmentId: 'APPT-001',
  requestedAt: new Date('2026-01-13T08:00:00Z').toISOString(),
  meta: {
    runId: RUN_ID,
    cacheHit: false,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server',
  },
  actor: 'FAC-PRINT:doctor-print',
  facilityId: 'FAC-PRINT',
};

const installPrintPreviewHarness = async (
  page: Parameters<typeof test>[0]['page'],
  options: { state?: typeof reportState },
) => {
  await page.addInitScript(({ state }) => {
    const sessionPayload = {
      facilityId: 'FAC-PRINT',
      userId: 'doctor-print',
      role: 'doctor',
      roles: ['doctor'],
      clientUuid: 'e2e-print',
      runId: state?.meta?.runId ?? 'RUN-PRINT',
      displayName: 'E2E Doctor',
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
      return originalFetch(input, init);
    };
    window.sessionStorage.setItem(
      'opendolphin:web-client:auth',
      JSON.stringify(sessionPayload),
    );
    window.sessionStorage.setItem(
      'opendolphin:web-client:auth-flags',
      JSON.stringify({
        sessionKey: 'FAC-PRINT:doctor-print',
        flags: {
          runId: sessionPayload.runId,
          cacheHit: false,
          missingMaster: false,
          dataSourceTransition: 'server',
          fallbackUsed: false,
        },
        updatedAt: new Date().toISOString(),
      }),
    );
    window.localStorage.setItem('devFacilityId', 'FAC-PRINT');
    window.localStorage.setItem('devUserId', 'doctor-print');
    window.localStorage.setItem('devPasswordMd5', 'e2e');
    window.localStorage.setItem('devClientUuid', 'e2e-print');
    window.localStorage.setItem('devRole', 'doctor');
    if (state && window.location.pathname.endsWith('/charts/print/document')) {
      window.history.replaceState({ ...(window.history.state ?? {}), usr: state, key: 'print-e2e' }, '', window.location.href);
    }
  }, { state: options.state ?? null });

  await page.route('**/api/session/me**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        facilityId: 'FAC-PRINT',
        userId: 'doctor-print',
        displayName: 'E2E Doctor',
        roles: ['doctor'],
        clientUuid: 'e2e-print',
        runId: RUN_ID,
      }),
    }),
  );
  await page.route('**/blobapi/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: Buffer.from('%PDF-1.4\n%%EOF', 'utf-8'),
    }),
  );
};

test('帳票 print preview は route-state only で PDF プレビューまで到達する', async ({ page }) => {
  await installPrintPreviewHarness(page, { state: reportState });

  await page.goto('/f/FAC-PRINT/charts/print/document?msw=1');
  await expect(page.getByText('処方箋 PDFプレビュー')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'PDFを開く' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Data_Id=DATA-PRINT-1')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.charts-print__pdf-preview iframe')).toBeVisible({ timeout: 10_000 });

  const reportPreviewStorageKeys = await page.evaluate(() =>
    Object.keys(window.sessionStorage).filter((key) => key.includes('printPreview:report')),
  );
  expect(reportPreviewStorageKeys).toHaveLength(0);
});

test('帳票 print preview は route-state が無ければ missing-state shell に fail-close する', async ({ page }) => {
  await installPrintPreviewHarness(page, {});

  await page.goto('/f/FAC-PRINT/charts/print/document?msw=1');
  await expect(page.getByText('文書プレビューの状態が見つかりません。')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('状態が無いため出力できません。')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Chartsへ戻る' })).toBeVisible({ timeout: 10_000 });
});
