// RUN_ID=20251218T092541Z
// Charts 患者サイドペイン（基本/保険/履歴/差分）: 閲覧中心 + 編集ガード + 差分/保存履歴導線の smoke

import { test, expect } from '../playwright/fixtures';
import type { Page } from '@playwright/test';
import { baseUrl, runId } from './helpers/orcaMaster';

test.use({ ignoreHTTPSErrors: true });

const seedChartsDoctorSession = async (page: Page) => {
  const AUTH_STORAGE_KEY = 'opendolphin:web-client:auth';
  await page.addInitScript(({ storageKey, session }) => {
    window.sessionStorage.setItem(storageKey, JSON.stringify(session));
    if (!(window as any).$RefreshReg$) (window as any).$RefreshReg$ = () => {};
    if (!(window as any).$RefreshSig$) (window as any).$RefreshSig$ = () => (type: unknown) => type;
  }, {
    storageKey: AUTH_STORAGE_KEY,
    session: {
      credentials: {
        facilityId: '0001',
        userId: 'doctor1',
        passwordMd5: 'dummy',
        clientUuid: 'e2e-playwright',
      },
      userProfile: {
        facilityId: '0001',
        userId: 'doctor1',
        displayName: 'E2E Doctor',
        roles: ['doctor'],
      },
      facilityId: '0001',
      userId: 'doctor1',
      displayName: 'E2E Doctor',
      clientUuid: 'e2e-playwright',
      runId,
      role: 'doctor',
      roles: ['doctor'],
      persistedAt: Date.now(),
    },
  });
};

test.describe('Charts patient sidepane', () => {
  test('memo edit toggles diff and audit modal opens', async ({ context }) => {
    const page = await context.newPage();
    await seedChartsDoctorSession(page);

    const baseMeta = {
      runId,
      cacheHit: false,
      missingMaster: false,
      dataSourceTransition: 'server',
      fallbackUsed: false,
      fetchedAt: new Date().toISOString(),
      recordsReturned: 1,
    };

    await page.route('**/api/admin/config', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          runId,
          chartsDisplayEnabled: true,
          chartsSendEnabled: true,
          chartsMasterSource: 'server',
          deliveryVersion: 'e2e',
          deliveredAt: new Date().toISOString(),
        }),
      }),
    );
    await page.route('**/api/admin/delivery', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          runId,
          chartsDisplayEnabled: true,
          chartsSendEnabled: true,
          chartsMasterSource: 'server',
          deliveryVersion: 'e2e',
          deliveredAt: new Date().toISOString(),
        }),
      }),
    );

    await page.route('**/orca21/medicalmodv2/outpatient**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...baseMeta, outpatientList: [] }) }),
    );
    await page.route('**/orca/appointments/list**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...baseMeta,
          reservations: [
            {
              appointmentId: 'A-0001',
              appointmentDate: '2025-12-18',
              appointmentTime: '0900',
              visitInformation: '診療中',
              medicalInformation: '外来メモ',
              receptionId: 'R-0001',
              departmentName: '内科',
              physicianName: '医師A',
              patient: {
                patientId: '000001',
                wholeName: '山田 花子',
                wholeNameKana: 'ヤマダ ハナコ',
                birthDate: '1985-04-12',
                sex: 'F',
              },
            },
          ],
          recordsReturned: 1,
        }),
      }),
    );
    await page.route('**/orca/visits/list**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...baseMeta, visitDate: '2025-12-18', visits: [] }),
      }),
    );
    await page.route('**/api/local/patients/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...baseMeta,
          patients: [
            {
              patientId: '000001',
              name: '山田 花子',
              kana: 'ヤマダ ハナコ',
              birthDate: '1985-04-12',
              sex: 'F',
              phone: '03-1234-5678',
              zip: '1000001',
              address: '東京都千代田区',
              insurance: '社保12',
              memo: '初期メモ',
            },
          ],
          auditEvent: { action: 'LOCAL_PATIENT_SEARCH', details: { runId } },
        }),
      }),
    );

    await page.goto(`${baseUrl}/charts?msw=1&patientId=000001`);
    await expect(page.locator('.patients-tab')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.patients-tab__edit-guard')).toContainText('閲覧モード', { timeout: 20_000 });

    // 閲覧中心の重要ストリップ
    await expect(page.getByRole('button', { name: '保存履歴' })).toBeVisible();

    // 差分（初期は memo 行が before==after の想定）
    await page.getByLabel('患者サイドペイン操作').getByRole('button', { name: /差分へ/ }).click();
    await expect(page.getByRole('heading', { name: '差分（変更前/変更後）' })).toBeVisible();

    // メモ編集 → 差分の memo 行が changed になる
    await page.getByRole('button', { name: 'メモ編集' }).click();
    const memoArea = page.locator('.patients-tab__memo textarea');
    await expect(memoArea).toBeEditable({ timeout: 10_000 });
    await memoArea.fill('初期メモ（更新）');

    const memoDiffRow = page.locator('.patients-tab__diff-row[data-key="memo"]');
    await expect(memoDiffRow).toHaveClass(/is-changed/);

    // 保存履歴モーダルが開ける
    await page.getByRole('button', { name: '保存履歴' }).click();
    await expect(page.getByRole('dialog', { name: '保存履歴（監査ログ）' })).toBeVisible();
    await page.getByRole('button', { name: '閉じる' }).click();
    await expect(page.getByRole('dialog', { name: '保存履歴（監査ログ）' })).toHaveCount(0);
  }, { timeout: 60_000 });
});
