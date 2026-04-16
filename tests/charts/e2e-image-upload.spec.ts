import { test, expect } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, seedAuthSession } from '../e2e/helpers/orcaMaster';

const RUN_ID = process.env.RUN_ID ?? '20260122T001851Z';
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

test('mobile asset 画面で一覧とアップロードが確認できる', async ({ page }) => {
  await seedAuthSession(page);
  const facilityId = e2eAuthSession.credentials.facilityId;

  await page.route('**/patients/000001/images', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          list: [
            {
              imageId: 901,
              fileName: 'xray_2026_01_21.png',
              contentType: 'image/png',
              size: 245120,
              createdAt: '2026-01-21T12:00:00Z',
              downloadUrl: '/mock/images/901',
            },
          ],
        }),
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

  await page.goto(`${baseUrl}/f/${facilityId}/m/images?patientId=000001&msw=1`);
  await expect(page.locator('[data-test-id="mobile-images-page"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-test-id="mobile-images-status"]')).toContainText('患者情報を確認しました。画像を選択して送信してください。');
  await expect(page.locator('[data-test-id="mobile-images-list"]')).toContainText('xray_2026_01_21.png');

  const fileInput = page.locator('[data-test-id="mobile-image-file-input"]');
  await fileInput.setInputFiles({
    name: 'upload.png',
    mimeType: 'image/png',
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });

  await expect(page.locator('[data-test-id="mobile-image-preview"]')).toBeVisible();
  await page.locator('[data-test-id="mobile-image-send"]').click();

  await expect(page.locator('[data-test-id="mobile-images-status"]')).toContainText('送信しました。');
});
