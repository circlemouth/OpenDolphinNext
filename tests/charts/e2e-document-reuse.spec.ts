import { test, expect } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, seedAuthSession, withChartLock } from '../e2e/helpers/orcaMaster';

const RUN_ID = process.env.RUN_ID ?? '20260121T111311Z';
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

test('文書履歴をコピーして編集フォームへ再適用できる', async ({ page }) => {
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
              consultantHospital: '東京クリニック',
              consultantDoctor: '山田太郎',
              title: '標準紹介状',
              recorded: '2026-01-21T00:00:00Z',
              letterItems: [
                { name: 'webTemplateId', value: 'REF-ODT-STD' },
                { name: 'webTemplateLabel', value: '標準紹介状' },
                { name: 'hospital', value: '東京クリニック' },
                { name: 'doctor', value: '山田太郎' },
                { name: 'purpose', value: '精査依頼' },
                { name: 'disease', value: '高血圧' },
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
          consultantHospital: '東京クリニック',
          consultantDoctor: '山田太郎',
          title: '標準紹介状',
          recorded: '2026-01-21T00:00:00Z',
          letterItems: [
            { name: 'webTemplateId', value: 'REF-ODT-STD' },
            { name: 'webTemplateLabel', value: '標準紹介状' },
            { name: 'hospital', value: '東京クリニック' },
            { name: 'doctor', value: '山田太郎' },
            { name: 'purpose', value: '精査依頼' },
            { name: 'disease', value: '高血圧' },
          ],
          letterTexts: [{ name: 'clinicalCourse', textValue: '既往歴と検査結果を記載' }],
        }),
      });
    });

    await page.goto(`${baseUrl}/f/${facilityId}/charts?patientId=000001&visitDate=2026-01-21&msw=1`);
    await expect(page.locator('.charts-page')).toBeVisible({ timeout: 20_000 });

    const persistedKeys = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.includes('document-history') || key.includes('printPreview:document')),
    );
    expect(persistedKeys).toHaveLength(0);

    await page.getByRole('button', { name: '文書を編集' }).click();

    const panel = page.locator('[data-test-id="document-create-panel"]');
    await expect(panel.getByText('文書作成メニュー')).toBeVisible({ timeout: 10_000 });
    await panel.getByRole('button', { name: 'コピーして編集' }).click();

    await expect(panel.getByLabel('宛先医療機関 *')).toHaveValue('東京クリニック');
    await expect(panel.getByLabel('宛先医師 *')).toHaveValue('山田太郎');
    await expect(panel.getByLabel('紹介目的 *')).toHaveValue('精査依頼');
    await expect(panel.getByLabel('主病名 *')).toHaveValue('高血圧');
    await expect(panel.getByLabel('紹介内容 *')).toHaveValue('既往歴と検査結果を記載');
  });
});
