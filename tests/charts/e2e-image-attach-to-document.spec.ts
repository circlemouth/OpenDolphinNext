import { test, expect } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, seedAuthSession, withChartLock } from '../e2e/helpers/orcaMaster';

const RUN_ID = process.env.RUN_ID ?? '20260123T090000Z';
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

test('patient image upload は asset API のみを使い document write を発火しない', async ({ page }) => {
  await seedAuthSession(page);
  const facilityId = e2eAuthSession.credentials.facilityId;
  let documentWriteCount = 0;

  await page.route('**/patients/000001/images', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ list: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        imageId: 902,
        documentId: 9902,
        fileName: 'upload.png',
        contentType: 'image/png',
        size: 8,
        createdAt: '2026-01-21T12:10:00Z',
      }),
    });
  });
  await page.route('**/karte/document', async (route) => {
    documentWriteCount += 1;
    await route.abort();
  });

  await page.goto(`${baseUrl}/f/${facilityId}/m/images?patientId=000001&msw=1`);
  await expect(page.locator('[data-test-id="mobile-images-page"]')).toBeVisible({ timeout: 20_000 });

  await page.locator('[data-test-id="mobile-image-file-input"]').setInputFiles({
    name: 'upload.png',
    mimeType: 'image/png',
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });
  await page.locator('[data-test-id="mobile-image-send"]').click();

  await expect(page.locator('[data-test-id="mobile-images-status"]')).toContainText('送信しました。');
  expect(documentWriteCount).toBe(0);
});

test('charts では document attach action が feature-off のまま非表示', async ({ page }) => {
  await withChartLock(page, async () => {
    await seedAuthSession(page);
    const facilityId = e2eAuthSession.credentials.facilityId;

    await page.goto(`${baseUrl}/f/${facilityId}/charts?patientId=000001&visitDate=2026-01-21&msw=1`);
    await expect(page.locator('.charts-page')).toBeVisible({ timeout: 20_000 });

    await expect(page.getByRole('button', { name: '画像を開く' })).toHaveCount(0);
    await expect(page.locator('[data-test-id="charts-image-panel"]')).toHaveCount(0);
  });
});
