import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, seedAuthSession, withChartLock } from '../e2e/helpers/orcaMaster';

const RUN_ID = process.env.RUN_ID ?? '20260121T043104Z';
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

test('部位マスタ検索が1秒以内に候補を表示し、選択が反映される (MSW)', async ({ page }) => {
  const artifactDir =
    process.env.PLAYWRIGHT_ARTIFACT_DIR ??
    path.join(process.cwd(), 'artifacts', 'webclient', 'orca-e2e', '20260120', 'bodypart');
  fs.mkdirSync(artifactDir, { recursive: true });

  await withChartLock(page, async () => {
    await seedAuthSession(page);
    const facilityId = e2eAuthSession.credentials.facilityId;
    const userId = e2eAuthSession.credentials.userId;
    await page.route('**/api/orca/master/etensu**', (route) => {
      const url = new URL(route.request().url());
      const keyword = url.searchParams.get('keyword') ?? '';
      const category = url.searchParams.get('category') ?? '';
      if (category !== '2' || !keyword.includes('胸')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], totalCount: 0 }),
        });
        return;
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              tensuCode: '002001',
              name: '胸部',
              unit: '部位',
              category: '2',
              points: 0,
              noticeDate: '20240101',
              startDate: '20240101',
            },
          ],
          totalCount: 1,
        }),
      });
    });
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
          runId: 'RUN-E2E',
          cacheHit: false,
          missingMaster: false,
          dataSourceTransition: 'server',
          fallbackUsed: false,
        },
      },
    );
    await page.goto(
      `${baseUrl}/f/${facilityId}/charts?patientId=000001&visitDate=2026-01-21&msw=1`,
    );
    await expect(page.locator('.charts-page')).toBeVisible({ timeout: 20_000 });

    const orderTab = page.getByRole('tab', { name: 'オーダー' });
    await expect(orderTab).toBeEnabled({ timeout: 20_000 });
    await orderTab.click();

    const keywordInput = page.getByLabel('部位検索');
    await keywordInput.fill('胸');

    const candidate = page.getByRole('button', { name: /胸部/ });
    await expect(candidate).toBeVisible({ timeout: 1_000 });
    await candidate.click();

    await expect(page.getByLabel('部位', { exact: true })).toHaveValue('胸部');

    await page.screenshot({
      path: path.join(artifactDir, 'bodypart-search.png'),
      fullPage: true,
    });
  });
});
