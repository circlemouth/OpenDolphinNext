import { test, expect } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, seedAuthSession, withChartLock } from '../e2e/helpers/orcaMaster';

const RUN_ID = process.env.RUN_ID ?? '20260124T090000Z';
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

test('画像参照付き文書は再編集を fail-close する', async ({ page }) => {
  await withChartLock(page, async () => {
    await seedAuthSession(page);
    const facilityId = e2eAuthSession.credentials.facilityId;

    await page.route('**/api/karte/pid/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 201 }),
      });
    });
    await page.route('**/odletter/list/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          list: [
            {
              id: 1,
              patientId: '000001',
              letterType: 'client',
              title: '画像参照つき紹介状',
              recorded: '2026-01-21T00:00:00Z',
              letterItems: [
                { name: 'webTemplateId', value: 'REF-ODT-STD' },
                { name: 'webTemplateLabel', value: '標準紹介状' },
                { name: 'purpose', value: '精査依頼' },
                { name: 'disease', value: '高血圧' },
                { name: 'webAttachmentIds', value: '[901]' },
              ],
              letterTexts: [{ name: 'clinicalCourse', textValue: '既往歴と検査結果を記載' }],
            },
          ],
        }),
      });
    });
    await page.route('**/odletter/letter/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          patientId: '000001',
          letterType: 'client',
          title: '画像参照つき紹介状',
          recorded: '2026-01-21T00:00:00Z',
          letterItems: [
            { name: 'webTemplateId', value: 'REF-ODT-STD' },
            { name: 'webTemplateLabel', value: '標準紹介状' },
            { name: 'purpose', value: '精査依頼' },
            { name: 'disease', value: '高血圧' },
            { name: 'webAttachmentIds', value: '[901]' },
          ],
          letterTexts: [{ name: 'clinicalCourse', textValue: '既往歴と検査結果を記載' }],
        }),
      });
    });

    await page.goto(`${baseUrl}/f/${facilityId}/charts?patientId=000001&visitDate=2026-01-21&msw=1`);
    await expect(page.locator('.charts-page')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: '文書を編集' }).click();

    const panel = page.locator('[data-test-id="document-create-panel"]');
    await expect(panel.getByText('文書作成メニュー')).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByText('画像参照付き文書は現契約では安全に再編集できません。新規作成で画像を選び直してください。')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'コピーして編集' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: '編集' })).toBeDisabled();
  });
});
