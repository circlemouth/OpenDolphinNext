import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, seedAuthSession, withChartLock } from '../e2e/helpers/orcaMaster';
import {
  buildAppointmentFixture,
  buildMedicalSummaryFixture,
  buildPatientListFixture,
  buildVisitListFixture,
  type OutpatientFlagSet,
} from '../../web-client/src/mocks/fixtures/outpatient';

const RUN_ID = process.env.RUN_ID ?? '20260204T163000Z';
process.env.RUN_ID ??= RUN_ID;

const artifactDir =
  process.env.PLAYWRIGHT_ARTIFACT_DIR ??
  path.join(process.cwd(), 'artifacts', 'verification', RUN_ID);

const writeNote = (fileName: string, body: string) => {
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, fileName), body);
};

const openOrderQuickAdd = async (page: Parameters<typeof withChartLock>[0], key: 'prescription' | 'treatment') => {
  const label = key === 'prescription' ? '+処方' : '+処置';
  const quickAdd = page.getByRole('button', { name: label }).first();
  await expect(quickAdd).toBeVisible({ timeout: 10_000 });
  await quickAdd.click();
};

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

test('薬剤/処置マスタ検索→入力が反映される (MSW)', async ({ page }) => {
  test.setTimeout(90_000);
  fs.mkdirSync(artifactDir, { recursive: true });

  await withChartLock(page, async () => {
    await seedAuthSession(page);
    const facilityId = e2eAuthSession.credentials.facilityId;
    const userId = e2eAuthSession.credentials.userId;
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
    await page.route('**/api/orca/official/appointments/list/mock**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildAppointmentFixture(outpatientFlags)),
      }),
    );
    await page.route('**/api/orca/official/visits/list/mock**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildVisitListFixture(outpatientFlags)),
      }),
    );
    await page.route('**/api/orca/official/appointments/list**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildAppointmentFixture(outpatientFlags)),
      }),
    );
    await page.route('**/api/orca/official/visits/list**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildVisitListFixture(outpatientFlags)),
      }),
    );
    await page.route('**/api/local/patients/search/mock**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPatientListFixture(outpatientFlags, '/api/local/patients/search/mock')),
      }),
    );
    await page.route('**/api/local/patients/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPatientListFixture(outpatientFlags, '/api/local/patients/search')),
      }),
    );
    await page.route('**/api/local/order/bundles**', async (route) => {
      const method = route.request().method().toUpperCase();
      if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            runId: RUN_ID,
            createdDocumentIds: [910001],
            updatedDocumentIds: [],
            deletedDocumentIds: [],
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          runId: RUN_ID,
          patientId: '000001',
          recordsReturned: 0,
          bundles: [],
        }),
      });
    });
    await page.route('**/api/orca/master/drug**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              code: 'A100',
              name: 'アムロジピン',
              unit: '錠',
              category: '降圧薬',
              note: 'E2E',
              validFrom: '20240101',
              validTo: '99999999',
            },
          ],
          totalCount: 1,
        }),
      }),
    );
    await page.route('**/api/orca/master/material**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              code: 'M001',
              name: '処置材料A',
              unit: '個',
              category: '処置',
              note: 'E2E',
              validFrom: '20240101',
              validTo: '99999999',
            },
          ],
          totalCount: 1,
        }),
      }),
    );

    await page.addInitScript((runId) => {
      const raw = window.sessionStorage.getItem('opendolphin:web-client:auth');
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        parsed.runId = runId;
        window.sessionStorage.setItem('opendolphin:web-client:auth', JSON.stringify(parsed));
      } catch {
        // ignore
      }
    }, RUN_ID);

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
          runId: RUN_ID,
          cacheHit: false,
          missingMaster: false,
          dataSourceTransition: 'server',
          fallbackUsed: false,
        },
      },
    );
    await page.addInitScript(({ headers, masterMocks, runId }) => {
      const originalFetch = window.fetch.bind(window);
      const resolveMethod = (input: RequestInfo | URL, init: RequestInit | undefined) => {
        if (init?.method) return init.method.toUpperCase();
        if (input instanceof Request && input.method) return input.method.toUpperCase();
        return 'GET';
      };
      window.fetch = (input, init = {}) => {
        const requestUrl =
          typeof input === 'string'
            ? input
            : input instanceof Request
              ? input.url
              : input instanceof URL
                ? input.href
                : String(input);
        const method = resolveMethod(input, init);
        if (requestUrl.includes('/api/local/order/bundles')) {
          if (method === 'POST') {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  runId,
                  createdDocumentIds: [910001],
                  updatedDocumentIds: [],
                  deletedDocumentIds: [],
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            );
          }
          return Promise.resolve(
            new Response(
              JSON.stringify({
                runId,
                patientId: '000001',
                recordsReturned: 0,
                bundles: [],
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }
        const matched = masterMocks.find((entry) => requestUrl.includes(entry.path));
        if (matched) {
          return Promise.resolve(
            new Response(JSON.stringify({ items: matched.items, totalCount: matched.items.length }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        const nextHeaders = new Headers(init.headers || {});
        Object.entries(headers).forEach(([key, value]) => {
          if (!nextHeaders.has(key)) {
            nextHeaders.set(key, value);
          }
        });
        return originalFetch(input, { ...init, headers: nextHeaders });
      };
    }, {
      headers: {
        'x-msw-missing-master': '0',
        'x-msw-transition': 'server',
        'x-msw-cache-hit': '0',
        'x-msw-fallback-used': '0',
        'x-msw-run-id': RUN_ID,
      },
      runId: RUN_ID,
      masterMocks: [
        {
          path: '/api/orca/master/drug',
          items: [
            {
              code: 'A100',
              name: 'アムロジピン',
              unit: '錠',
              category: '降圧薬',
              note: 'E2E',
              validFrom: '20240101',
              validTo: '99999999',
            },
          ],
        },
        {
          path: '/api/orca/master/material',
          items: [
            {
              code: 'M001',
              name: '処置材料A',
              unit: '個',
              category: '処置',
              note: 'E2E',
              validFrom: '20240101',
              validTo: '99999999',
            },
          ],
        },
      ],
    });

    await page.goto(`${baseUrl}/f/${facilityId}/charts?patientId=000001&visitDate=2026-02-04&msw=1`);
    await expect(page.locator('.charts-page')).toBeVisible({ timeout: 20_000 });
    const topbarMeta = page.locator('[data-test-id="charts-topbar-meta"]');
    await page.evaluate(
      ({ sessionKey, flags }) => {
        const envelope = {
          version: 1,
          sessionKey,
          payload: flags,
          updatedAt: new Date().toISOString(),
        };
        const key = 'opendolphin:web-client:auth:shared-flags:v1';
        try {
          window.localStorage.setItem(key, JSON.stringify(envelope));
        } catch {
          // ignore
        }
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(envelope) }));
      },
      {
        sessionKey: `${facilityId}:${userId}`,
        flags: {
          runId: RUN_ID,
          cacheHit: false,
          missingMaster: false,
          dataSourceTransition: 'server',
          fallbackUsed: false,
        },
      },
    );
    const debugControls = page.locator('.auth-service-controls');
    if ((await debugControls.count()) > 0) {
      const missingMasterButton = debugControls.getByRole('button', { name: /missingMaster:/ }).first();
      const buttonText = await missingMasterButton.textContent();
      if (buttonText?.includes('true')) {
        await missingMasterButton.click();
      }
      const transitionSelect = debugControls.locator('#transition-select');
      if ((await transitionSelect.count()) > 0) {
        await transitionSelect.selectOption('server');
      }
    }
    await expect(topbarMeta).toHaveAttribute('data-missing-master', 'false', { timeout: 10_000 });
    await expect(topbarMeta).toHaveAttribute('data-source-transition', 'server', { timeout: 10_000 });
    const orderPane = page.locator('#charts-order-pane');

    // 薬剤マスタ（処方）検索
    await openOrderQuickAdd(page, 'prescription');
    const itemNameInput = orderPane.locator('input[placeholder="薬剤名"]').first();
    await expect(itemNameInput).toBeVisible({ timeout: 10_000 });
    await itemNameInput.fill('アム');
    await expect(orderPane.locator('datalist[id$="-item-predictive-list"] option[value="アムロジピン"]')).toHaveCount(1, {
      timeout: 10_000,
    });
    await itemNameInput.fill('アムロジピン');
    await itemNameInput.press('Tab');

    await expect(itemNameInput).toHaveValue(/(?:A100\s+)?アムロジピン/);

    await page.screenshot({
      path: path.join(artifactDir, 'order-master-medication.png'),
      fullPage: true,
    });

    // quick-add フォーカスを解除してから次カテゴリを追加
    await orderPane.getByRole('button', { name: '通常閲覧へ戻る' }).click();

    // 処置マスタ（材料）検索
    await openOrderQuickAdd(page, 'treatment');
    const treatmentItemNameInput = orderPane.locator('input[placeholder="処置項目名"]').first();
    await expect(treatmentItemNameInput).toBeVisible({ timeout: 10_000 });
    await treatmentItemNameInput.fill('処置');
    await expect(orderPane.locator('datalist[id$="-item-predictive-list"] option[value="処置材料A"]')).toHaveCount(1, {
      timeout: 10_000,
    });
    await treatmentItemNameInput.fill('処置材料A');
    await treatmentItemNameInput.press('Tab');

    await expect(treatmentItemNameInput).toHaveValue(/(?:M001\s+)?処置材料A/);

    await page.screenshot({
      path: path.join(artifactDir, 'order-master-procedure.png'),
      fullPage: true,
    });

    writeNote(
      'qa-order-master-search.md',
      [
        `RUN_ID: ${RUN_ID}`,
        'MSW: on',
        '確認項目:',
        '- 薬剤マスタ検索 → 選択 → 入力反映',
        '- 処置マスタ検索（材料） → 選択 → 入力反映',
        '',
        `スクショ: order-master-medication.png / order-master-procedure.png`,
        'HAR: har/ 配下に保存',
      ].join('\n'),
    );
  });
});
