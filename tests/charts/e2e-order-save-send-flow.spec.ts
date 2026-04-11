import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, expandChartsQuickActions, seedAuthSession, withChartLock } from '../e2e/helpers/orcaMaster';
import {
  buildAppointmentFixture,
  buildMedicalSummaryFixture,
  buildPatientListFixture,
  buildVisitListFixture,
  type OutpatientFlagSet,
} from '../../web-client/src/mocks/fixtures/outpatient';

const RUN_ID = process.env.RUN_ID ?? '20260223T092234Z-order-save-send';
process.env.RUN_ID ??= RUN_ID;

const artifactDir =
  process.env.PLAYWRIGHT_ARTIFACT_DIR ??
  path.join(process.cwd(), 'artifacts', 'verification', RUN_ID, 'order-save-send');

const writeNote = (fileName: string, body: string) => {
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, fileName), body);
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

test('オーダー入力改修後: カテゴリ限定表示 + 用法プルダウン + 保存/ORCA送信 (MSW)', async ({ page }) => {
  test.setTimeout(120_000);
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
    const medicalSummaryPayload = (() => {
      const base = buildMedicalSummaryFixture(outpatientFlags) as Record<string, unknown>;
      const outpatientList = Array.isArray(base.outpatientList)
        ? base.outpatientList.map((entry) => {
            if (!entry || typeof entry !== 'object') return entry;
            const record = entry as Record<string, unknown>;
            const patient = (record.patient ?? null) as { patientId?: string } | null;
            if (patient?.patientId !== '000001') return entry;
            return {
              ...record,
              department: '01 内科',
              physician: '10001 藤井',
            };
          })
        : [];
      return {
        ...base,
        outpatientList,
      };
    })();

    await page.route('**/orca21/medicalmodv2/outpatient**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(medicalSummaryPayload),
      }),
    );
    const appointmentPayload = {
      ...buildAppointmentFixture(outpatientFlags),
      appointmentDate: '2026-02-04',
      slots: [
        {
          appointmentId: 'APT-2401',
          appointmentTime: '0910',
          departmentName: '01 内科',
          departmentCode: '01',
          physicianName: '10001 藤井',
          physicianCode: '10001',
          patient: {
            patientId: '000001',
            wholeName: '山田 花子',
            wholeNameKana: 'ヤマダ ハナコ',
            birthDate: '1985-04-12',
            sex: 'F',
          },
        },
      ],
      reservations: [],
      visits: [],
    };
    const visitPayload = {
      ...buildVisitListFixture(outpatientFlags),
      visitDate: '2026-02-04',
      visits: [
        {
          patientId: '000001',
          departmentCode: '01',
          physicianCode: '10001',
          physician: '10001 藤井',
        },
      ],
    };
    await page.route('**/orca/appointments/list/mock**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(appointmentPayload),
      }),
    );
    await page.route('**/orca/visits/list/mock**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(visitPayload),
      }),
    );
    await page.route('**/orca/appointments/list**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(appointmentPayload),
      }),
    );
    await page.route('**/orca/visits/list**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(visitPayload),
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
    await page.addInitScript(
      ({ facilityId, userId, passwordMd5, clientUuid }) => {
        window.localStorage.setItem('devFacilityId', facilityId);
        window.localStorage.setItem('devUserId', userId);
        if (passwordMd5) window.localStorage.setItem('devPasswordMd5', passwordMd5);
        if (clientUuid) window.localStorage.setItem('devClientUuid', clientUuid);
      },
      {
        facilityId,
        userId,
        passwordMd5: e2eAuthSession.credentials.passwordMd5,
        clientUuid: e2eAuthSession.credentials.clientUuid,
      },
    );
    await page.addInitScript(({ runId, appointmentFixture, visitFixture, medicalSummaryFixture }) => {
      const originalFetch = window.fetch.bind(window);
      const state = {
        bundles: [] as Array<Record<string, unknown>>,
        capturedMedicalmodv2Request: '',
      };
      (window as any).__E2E_ORDER_FLOW_STATE__ = state;
      const drugItems = [
        {
          code: '620000001',
          name: 'アムロジピン',
          unit: '錠',
          category: '降圧薬',
          note: 'E2E',
          validFrom: '20240101',
          validTo: '99999999',
        },
      ];
      const usageItems = [
        {
          code: '101',
          name: '1日1回 朝食後',
          timingCode: '01',
          routeCode: 'PO',
          daysLimit: 7,
          dosePerDay: 1,
        },
        {
          code: '205',
          name: '1日2回 朝夕食後',
          timingCode: '05',
          routeCode: 'PO',
          daysLimit: 14,
          dosePerDay: 2,
        },
      ];
      const resolveUrl = (input: RequestInfo | URL) => {
        if (typeof input === 'string') return input;
        if (input instanceof Request) return input.url;
        return input.href;
      };
      const resolveMethod = (input: RequestInfo | URL, init: RequestInit | undefined) => {
        if (init?.method) return init.method.toUpperCase();
        if (input instanceof Request && input.method) return input.method.toUpperCase();
        return 'GET';
      };
      const resolveBody = async (input: RequestInfo | URL, init: RequestInit | undefined) => {
        if (typeof init?.body === 'string') return init.body;
        if (init?.body && typeof init.body === 'object') return String(init.body);
        if (input instanceof Request) {
          try {
            return await input.clone().text();
          } catch {
            return '';
          }
        }
        return '';
      };

      window.fetch = async (input, init) => {
        const requestUrl = resolveUrl(input);
        const method = resolveMethod(input, init);

        if (requestUrl.includes('/orca21/medicalmodv2/outpatient')) {
          return new Response(JSON.stringify(medicalSummaryFixture), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (requestUrl.includes('/orca/appointments/list')) {
          return new Response(JSON.stringify(appointmentFixture), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (requestUrl.includes('/orca/visits/list')) {
          return new Response(JSON.stringify(visitFixture), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (requestUrl.includes('/orca/master/drug')) {
          return new Response(JSON.stringify({ items: drugItems, totalCount: drugItems.length }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (requestUrl.includes('/orca/master/youhou')) {
          return new Response(JSON.stringify({ items: usageItems, totalCount: usageItems.length }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (requestUrl.includes('/orca/order/bundles')) {
          if (method === 'POST') {
            const payloadRaw = await resolveBody(input, init);
            let payload: { operations?: Array<Record<string, unknown>> } = {};
            try {
              payload = JSON.parse(payloadRaw || '{}');
            } catch {
              payload = {};
            }
            const createOp = payload.operations?.find((entry) => entry.operation === 'create' || entry.operation === 'update') ?? null;
            if (createOp) {
              state.bundles = [
                {
                  documentId: 910001,
                  moduleId: 910001,
                  entity: createOp.entity ?? 'medOrder',
                  bundleName: createOp.bundleName ?? 'E2E処方',
                  bundleNumber: createOp.bundleNumber ?? '1',
                  classCode: createOp.classCode,
                  classCodeSystem: createOp.classCodeSystem,
                  className: createOp.className,
                  admin: createOp.admin ?? '',
                  adminMemo: createOp.adminMemo ?? '',
                  memo: createOp.memo ?? '',
                  started: createOp.startDate ?? '2026-02-04',
                  items: Array.isArray(createOp.items) ? createOp.items : [],
                },
              ];
            }
            return new Response(
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
            );
          }
          return new Response(
            JSON.stringify({
              runId,
              patientId: '000001',
              recordsReturned: state.bundles.length,
              bundles: state.bundles,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
        if (requestUrl.includes('/api21/medicalmodv2')) {
          state.capturedMedicalmodv2Request = await resolveBody(input, init);
          return new Response(
            [
              '<xmlio2>',
              '  <medicalres>',
              '    <Api_Result>00</Api_Result>',
              '    <Api_Result_Message>OK</Api_Result_Message>',
              '    <Information_Date>2026-02-04</Information_Date>',
              '    <Information_Time>09:30:00</Information_Time>',
              '    <Invoice_Number>INV-E2E-001</Invoice_Number>',
              '    <Data_Id>DATA-E2E-001</Data_Id>',
              '  </medicalres>',
              '</xmlio2>',
            ].join(''),
            {
              status: 200,
              headers: { 'Content-Type': 'application/xml' },
            },
          );
        }
        return originalFetch(input, init);
      };
    }, {
      runId: RUN_ID,
      appointmentFixture: appointmentPayload,
      visitFixture: visitPayload,
      medicalSummaryFixture: medicalSummaryPayload,
    });

    await page.goto(`${baseUrl}/f/${facilityId}/charts?patientId=000001&appointmentId=APT-2401&visitDate=2026-02-04&msw=1`);
    await expect(page.locator('.charts-page')).toBeVisible({ timeout: 20_000 });

    const orderPane = page.locator('#charts-order-pane');
    await expect(orderPane).toBeVisible({ timeout: 20_000 });

    // quick-add: 押下カテゴリだけ表示されること
    const treatmentQuickAdd = orderPane.getByRole('button', { name: '+処置' }).first();
    await expect(treatmentQuickAdd).toBeVisible({ timeout: 20_000 });
    await treatmentQuickAdd.click();
    await expect(orderPane.getByRole('button', { name: '通常閲覧へ戻る' })).toBeVisible({ timeout: 10_000 });
    await expect(orderPane.getByLabel('処置入力')).toBeVisible({ timeout: 10_000 });
    await expect(orderPane.getByRole('button', { name: '追加' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(orderPane.getByRole('searchbox', { name: 'オーダー検索' })).toHaveCount(0);
    await expect(orderPane.getByRole('button', { name: '+処方' })).toHaveCount(0);
    await orderPane.getByRole('button', { name: '通常閲覧へ戻る' }).click();
    await expect(orderPane.getByRole('searchbox', { name: 'オーダー検索' })).toBeVisible({ timeout: 10_000 });

    // 処方追加 + 用法プルダウン
    await page.getByRole('button', { name: '+処方' }).first().click();
    const usageSelect = orderPane.getByLabel('用法').first();
    await expect(usageSelect).toBeVisible({ timeout: 10_000 });
    await expect(orderPane.locator('.charts-side-panel__search-header--usage')).toHaveCount(0);
    await expect(orderPane.locator('.charts-side-panel__search-row--usage')).toHaveCount(0);

    const usageOptionValue = await usageSelect.evaluate((element) => {
      const select = element as HTMLSelectElement;
      const found = Array.from(select.options).find((option) => option.textContent?.includes('1日2回 朝夕食後'));
      return found?.value ?? '';
    });
    expect(usageOptionValue).not.toBe('');
    await usageSelect.selectOption(usageOptionValue);
    await expect(orderPane.getByText('タイミング: 毎食後 / 経路: 内服 / 上限日数: 14 / 1日量目安: 2')).toBeVisible({
      timeout: 10_000,
    });

    const itemNameInput = orderPane.locator('input[placeholder="薬剤名"]').first();
    await expect(itemNameInput).toBeVisible({ timeout: 10_000 });
    await itemNameInput.fill('アム');
    await expect(orderPane.locator('datalist[id$="-item-predictive-list"] option[value="アムロジピン"]')).toHaveCount(1, {
      timeout: 10_000,
    });
    await itemNameInput.fill('アムロジピン');
    await itemNameInput.press('Tab');
    await expect(itemNameInput).toHaveValue(/(?:620000001\s+)?アムロジピン/);

    const dismissContraDialog = async () => {
      const contraDialog = page.locator('[data-test-id="contraindication-confirm"]');
      if (await contraDialog.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await contraDialog.getByRole('button', { name: '今回だけ無視して保存' }).click();
        await expect(contraDialog).toBeHidden({ timeout: 10_000 });
      }
    };

    await orderPane.getByRole('button', { name: '保存して追加' }).click();
    await dismissContraDialog();
    await expect(orderPane.getByRole('button', { name: '保存して追加' })).toBeVisible({ timeout: 10_000 });

    // ORCA送信
    await dismissContraDialog();
    await expandChartsQuickActions(page);
    await page.getByRole('button', { name: 'ORCA 送信' }).click();
    const sendDialog = page.getByRole('alertdialog', { name: 'ORCA送信の確認' });
    await expect(sendDialog).toBeVisible({ timeout: 10_000 });
    await sendDialog.getByRole('button', { name: '送信する' }).click();

    const toast = page.locator('.charts-actions__toast');
    await expect(toast).toContainText('ORCA送信を完了', { timeout: 15_000 });
    await expect(orderPane.getByText(/送信状態:\s*送信済み/)).toBeVisible({ timeout: 10_000 });
    await expect(orderPane.getByText(/最終送信:\s*20\d{2}\/\d{2}\/\d{2}/)).toBeVisible({ timeout: 10_000 });

    const capturedMedicalmodv2Request = await page.evaluate(
      () => ((window as any).__E2E_ORDER_FLOW_STATE__?.capturedMedicalmodv2Request ?? '') as string,
    );
    expect(capturedMedicalmodv2Request).toContain('<medicalreq');
    expect(capturedMedicalmodv2Request).toContain('<Department_Code type="string">01</Department_Code>');
    expect(capturedMedicalmodv2Request).toContain('<Physician_Code type="string">10001</Physician_Code>');
    expect(capturedMedicalmodv2Request).toContain('620000001');

    await page.screenshot({
      path: path.join(artifactDir, 'order-save-send-flow.png'),
      fullPage: true,
    });

    writeNote(
      'qa-order-save-send-flow.md',
      [
        `RUN_ID: ${RUN_ID}`,
        'MSW: on',
        '確認項目:',
        '- +処置押下時に処置カテゴリのみ表示される',
        '- 用法が入力不要プルダウンで選択できる',
        '- 用法候補の表形式テーブルが表示されない',
        '- 処方を保存後に ORCA送信が成功し、送信状態が更新される',
        '',
        '証跡:',
        '- order-save-send-flow.png',
      ].join('\n'),
    );
  });
});
