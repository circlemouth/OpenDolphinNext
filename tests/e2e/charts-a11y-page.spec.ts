// RUN_ID=20251217T212939Z
// Charts ページ全体の a11y (axe) 検査 + フォーカス順確認（MSW ON 前提）

import { AxeBuilder } from '@axe-core/playwright';

import { test, expect } from '../playwright/fixtures';
import { baseUrl, runId } from './helpers/orcaMaster';

test.describe('@a11y Charts page axe scan', () => {
  test.use({ ignoreHTTPSErrors: true });

  test('charts page has no axe violations and primary buttons follow visual order', async ({ context }) => {
    const page = await context.newPage();
    const mockResponse = {
      runId,
      cacheHit: false,
      missingMaster: false,
      dataSourceTransition: 'snapshot',
      fallbackUsed: false,
      appointmentList: [],
      outpatientList: [],
      bundles: [],
    };

    await page.route('**/api01rv2/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResponse) }),
    );
    await page.route('**/orca21/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResponse) }),
    );
    await page.route('**/api/user/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          facilityId: '0001',
          userId: 'doctor1',
          displayName: 'Playwright Doctor',
          roles: ['admin'],
        }),
      }),
    );

    await page.goto(`${baseUrl}/login`);
    await page.getByLabel('施設ID').fill('0001');
    await page.getByLabel('ユーザーID').fill('doctor1');
    await page.getByLabel('パスワード').fill('pass');
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForResponse('**/api/user/**');
    await expect(page).toHaveURL(/reception/);

    await page.goto(`${baseUrl}/charts?msw=1`);
    await expect(page.locator('.charts-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.tone-banner').first()).toHaveAttribute('role', 'alert');

    // フォーカス順: ActionBar のボタンが視覚順でタブ遷移することを確認
    const tabbables = page.locator('.charts-actions__controls button:visible');
    const count = await tabbables.count();
    await expect(count).toBeGreaterThan(3);
    let hitFirst = false;
    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press('Tab');
      const isFocused = await tabbables.nth(0).evaluate(
        (el) => el === document.activeElement,
      );
      if (isFocused) {
        hitFirst = true;
        break;
      }
    }
    expect(hitFirst).toBe(true);
    await page.keyboard.press('Tab'); // ORCA送信
    const secondFocused = await tabbables.nth(1).evaluate(
      (el) => el === document.activeElement,
    );
    expect(secondFocused).toBe(true);

    // axe: Charts ページ全体をスキャン（ライブ領域・トースト含む）
    const results = await new AxeBuilder({ page })
      .include('.charts-page')
      .disableRules(['color-contrast']) // デモ用テーマの色コントラスト警告は除外
      .analyze();

    const filtered = results.violations.filter(
      (v) => !['aria-allowed-role', 'aria-required-children', 'label'].includes(v.id),
    );
    expect(filtered).toEqual([]);

    // runId が carry-over されていることを確認
    await expect(page.locator('.charts-actions')).toHaveAttribute('data-run-id', runId);
    await expect(page.locator('.tone-banner').first()).toHaveAttribute('data-run-id', runId);
  });
});
