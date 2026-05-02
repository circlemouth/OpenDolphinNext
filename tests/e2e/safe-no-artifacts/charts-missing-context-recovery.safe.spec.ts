// Artifact-free RWO-02 smoke: no screenshots, HAR, trace, video, or raw network dumps.

import { expect, test, type Page, type Route } from '@playwright/test';

import { baseUrl, runId } from '../helpers/orcaMaster';

const FACILITY_ID = '1.3.6.1.4.1.9414.72.103';
const USER_ID = 'doctor1';
const SAFE_PATIENT_ID = 'PW-SAFE-UI-001';
const SAFE_ENCOUNTER_KEY = `${FACILITY_ID}:SAFE-CHART-OPEN-001`;
const SAFE_SCHEDULE_KEY = 'SAFE-SCHEDULE-CHART-OPEN-001';
const SAFE_VISIT_DATE = '2026-04-23';

const safeVisit = {
  patient: {
    patientId: SAFE_PATIENT_ID,
    wholeName: 'Safe Browser Patient',
    wholeNameKana: 'セーフブラウザ',
    birthDate: '1980-01-02',
    sex: '1',
  },
  receptionId: 'SAFE-REC-001',
  acceptanceId: 'SAFE-REC-001',
  sequentialNumber: 'SAFE-SEQ-001',
  voucherNumber: 'SAFE-VOUCHER-001',
  scheduleKey: SAFE_SCHEDULE_KEY,
  encounterKey: SAFE_ENCOUNTER_KEY,
  departmentCode: '01',
  departmentName: '内科',
  physicianCode: '1001',
  physicianName: 'Safe Doctor',
  insuranceCombinationNumber: 'SAFE-COMBINATION',
  visitDate: SAFE_VISIT_DATE,
  acceptanceTime: '0900',
  visitInformation: '受付',
};

const jsonResponse = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

const parseBody = (route: Route) => JSON.parse(route.request().postData() ?? '{}') as Record<string, any>;

const stubChartsShell = async (page: Page, options: { includeSafeVisit?: boolean } = {}) => {
  let nextSubjectiveId = 5100;
  let nextDiagnosisId = 6100;
  let nextPrescriptionDocumentId = 7100;
  let nextOrderDocumentId = 8100;
  const subjectiveBodies: Array<Record<string, any>> = [];
  const diagnosisMutationBodies: Array<Record<string, any>> = [];
  const prescriptionMutationBodies: Array<Record<string, any>> = [];
  const orderBundleMutationBodies: Array<Record<string, any>> = [];
  let storedPrescriptionOrder: Record<string, any> | null = null;
  let storedOrderBundles: Array<Record<string, any>> = [];
  let diseases: Array<Record<string, any>> = [
    {
      diagnosisId: 6001,
      diagnosisName: 'Safe ORCA mirror',
      diagnosisCode: 'I10',
      startDate: SAFE_VISIT_DATE,
      outcome: '継続',
      layer: 'orca-mirror',
      readOnly: true,
      syncState: 'manual-resolution',
    },
  ];

  const sessionPayload = {
    facilityId: FACILITY_ID,
    userId: USER_ID,
    displayName: 'E2E Doctor',
    roles: ['doctor'],
    clientUuid: 'safe-no-artifacts-e2e',
    runId,
  };

  await page.addInitScript(() => {
    const ensureCsrfMeta = () => {
      const existing = document.querySelector("meta[name='csrf-token']");
      if (existing instanceof HTMLMetaElement) {
        existing.content = 'safe-browser-csrf-token';
        return;
      }
      if (!document.head) return;
      const meta = document.createElement('meta');
      meta.name = 'csrf-token';
      meta.content = 'safe-browser-csrf-token';
      document.head.appendChild(meta);
    };
    ensureCsrfMeta();
    document.addEventListener('DOMContentLoaded', ensureCsrfMeta, { once: true });
  });

  await page.route('**/session/me**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    }),
  );
  await page.route('**/api/session/me**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    }),
  );
  await page.route('**/session/login**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    }),
  );
  await page.route('**/api/session/login**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    }),
  );
  await page.route('**/api/user/**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    }),
  );

  const adminConfig = {
    runId,
    chartsDisplayEnabled: true,
    chartsSendEnabled: true,
    chartsMasterSource: 'server',
    deliveryVersion: 'safe-no-artifacts-e2e',
    deliveredAt: new Date().toISOString(),
  };
  await page.route('**/api/admin/config', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminConfig) }),
  );
  await page.route('**/api/admin/delivery', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminConfig) }),
  );

  const readOnlyOrcaPaths: string[] = [];
  const blockedOrcaPaths: string[] = [];
  await page.route('**/api/orca/**', (route: Route) => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    if (pathname === '/api/orca/master/youhou') {
      readOnlyOrcaPaths.push(pathname);
      return route.fulfill(
        jsonResponse({
          runId,
          totalCount: 1,
          items: [
            {
              code: '001000',
              name: '1日1回 朝食後',
              category: '001',
              daysLimit: 14,
              youhouCode: '001000',
            },
          ],
        }),
      );
    }
    if (pathname === '/api/orca/master/drug') {
      readOnlyOrcaPaths.push(pathname);
      const keyword = requestUrl.searchParams.get('keyword') ?? '';
      const items = keyword.includes('browser')
        ? [
            {
              code: '620000123',
              name: 'browser med tablet',
              unit: '錠',
              category: '1',
              youhouCode: '001000',
            },
          ]
        : [];
      return route.fulfill(jsonResponse({ runId, totalCount: items.length, items }));
    }
    if (pathname === '/api/orca/master/generic-price') {
      readOnlyOrcaPaths.push(pathname);
      return route.fulfill(
        jsonResponse({
          code: '620000123',
          name: 'browser med tablet',
          unit: '錠',
          price: 12.3,
          category: 'generic-price',
          dataSource: 'safe-no-artifacts-local',
          missingMaster: false,
          fallbackUsed: false,
          runId,
        }),
      );
    }
    if (pathname === '/api/orca/master/etensu') {
      readOnlyOrcaPaths.push(pathname);
      const keyword = requestUrl.searchParams.get('keyword') ?? '';
      const category = requestUrl.searchParams.get('category') ?? '';
      const items =
        keyword.includes('browser') && category === '4'
          ? [
              {
                tensuCode: '140000610',
                name: 'browser treatment procedure',
                unit: '回',
                category: '4',
              },
            ]
          : [];
      return route.fulfill(jsonResponse({ runId, totalCount: items.length, items }));
    }
    if (pathname === '/api/orca/master/material') {
      readOnlyOrcaPaths.push(pathname);
      return route.fulfill(jsonResponse({ runId, totalCount: 0, items: [] }));
    }
    if (pathname === '/api/orca/official/chart-support/medication-get') {
      readOnlyOrcaPaths.push(pathname);
      return route.fulfill(
        jsonResponse({
          ok: true,
          runId,
          status: 200,
          apiResult: '00',
          apiResultMessage: '処理終了',
          selections: [],
          dataSource: 'safe-no-artifacts-local',
        }),
      );
    }
    if (pathname === '/api/orca/official/appointments/list') {
      readOnlyOrcaPaths.push(pathname);
      return route.fulfill(
        jsonResponse({
          runId,
          cacheHit: true,
          missingMaster: false,
          fallbackUsed: false,
          dataSourceTransition: 'server',
          entries: [],
          page: 1,
          size: 50,
          recordsReturned: 0,
          hasNextPage: false,
          fetchedAt: new Date().toISOString(),
        }),
      );
    }
    if (pathname === '/api/orca/official/appointments/medical-information') {
      readOnlyOrcaPaths.push(pathname);
      return route.fulfill(
        jsonResponse({
          runId,
          items: [{ code: '01', name: '外来' }],
        }),
      );
    }
    if (pathname === '/api/orca/official/appointments/selector-options') {
      readOnlyOrcaPaths.push(pathname);
      return route.fulfill(
        jsonResponse({
          runId,
          departments: [{ code: safeVisit.departmentCode, name: safeVisit.departmentName }],
          physicians: [{ code: safeVisit.physicianCode, name: safeVisit.physicianName }],
        }),
      );
    }
    if (pathname === '/api/orca/official/visits/list') {
      readOnlyOrcaPaths.push(pathname);
      const visits = options.includeSafeVisit ? [safeVisit] : [];
      return route.fulfill(
        jsonResponse({
          runId,
          cacheHit: true,
          missingMaster: false,
          fallbackUsed: false,
          dataSourceTransition: 'server',
          visitDate: SAFE_VISIT_DATE,
          visits,
          recordsReturned: visits.length,
          fetchedAt: new Date().toISOString(),
        }),
      );
    }
    if (pathname.startsWith('/api/orca/official/disease-master/name/')) {
      readOnlyOrcaPaths.push('/api/orca/official/disease-master/name/:term');
      return route.fulfill(
        jsonResponse({
          runId,
          Disease_Master_Information: [
            {
              Disease_Code: 'J00',
              Disease_Name: 'browser UI diagnosis',
              IcdTen: 'J00',
            },
          ],
        }),
      );
    }
    blockedOrcaPaths.push(pathname);
    return route.fulfill(jsonResponse({ ok: false, routeBlocked: true, runId }, 451));
  });
  await page.route('**/orca21/medicalmodv2/outpatient**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        runId,
        cacheHit: true,
        missingMaster: false,
        fallbackUsed: false,
        dataSourceTransition: 'server',
        outpatientList: [],
        recordsReturned: 0,
      }),
    }),
  );

  await page.route('**/api/local/encounters/*/medical-summary**', (route: Route) =>
    route.fulfill(
      jsonResponse({
        runId,
        fetchedAt: new Date().toISOString(),
        recordsReturned: 0,
        outcome: 'MISSING',
        payload: { outpatientList: [] },
      }),
    ),
  );
  await page.route('**/api/local/patients/search**', (route: Route) =>
    route.fulfill(
      jsonResponse({
        runId,
        patients: [
          {
            patientId: SAFE_PATIENT_ID,
            name: 'Safe Browser Patient',
            kana: 'セーフブラウザ',
            birthDate: '1980-01-02',
            sex: '1',
          },
        ],
        recordsReturned: 1,
      }),
    ),
  );
  await page.route('**/api/karte/pid/**', (route: Route) => route.fulfill(jsonResponse({ id: 9001, runId })));
  await page.route('**/api/karte/rpHistory/list/**', (route: Route) => route.fulfill(jsonResponse([])));
  await page.route('**/api/local/prescription-orders**', (route: Route) =>
    {
      const method = route.request().method().toUpperCase();
      if (method === 'GET') {
        return route.fulfill(
          jsonResponse({
            found: Boolean(storedPrescriptionOrder?.rps?.length),
            runId,
            patientId: SAFE_PATIENT_ID,
            sourceBundles: [],
            order: storedPrescriptionOrder,
          }),
        );
      }
      if (method === 'POST') {
        const body = parseBody(route);
        prescriptionMutationBodies.push(body);
        storedPrescriptionOrder = {
          patientId: SAFE_PATIENT_ID,
          encounterId: body.encounterId ?? SAFE_ENCOUNTER_KEY,
          encounterDate: body.encounterDate ?? SAFE_VISIT_DATE,
          performDate: body.performDate ?? SAFE_VISIT_DATE,
          doctorComments: Array.isArray(body.doctorComments) ? body.doctorComments : [],
          prescriptionSettings: Array.isArray(body.prescriptionSettings) ? body.prescriptionSettings : [],
          remarks: Array.isArray(body.remarks) ? body.remarks : [],
          rps: Array.isArray(body.rps)
            ? body.rps.map((rp: Record<string, any>) => ({
                ...rp,
                documentId: typeof rp.documentId === 'number' ? rp.documentId : nextPrescriptionDocumentId++,
                moduleId: typeof rp.moduleId === 'number' ? rp.moduleId : undefined,
                drugs: Array.isArray(rp.drugs) ? rp.drugs : [],
              }))
            : [],
        };
        return route.fulfill(jsonResponse({ ok: true, runId }));
      }
      return route.fulfill(jsonResponse({ ok: false, message: 'unsupported method', runId }, 405));
    },
  );
  await page.route('**/api/local/order/bundles**', (route: Route) => {
    const method = route.request().method().toUpperCase();
    const requestUrl = new URL(route.request().url());
    if (method === 'GET') {
      const entity = requestUrl.searchParams.get('entity');
      const bundles = entity
        ? storedOrderBundles.filter((bundle) => (bundle.entity ?? '').trim() === entity.trim())
        : storedOrderBundles;
      return route.fulfill(
        jsonResponse({
          ok: true,
          runId,
          patientId: SAFE_PATIENT_ID,
          recordsReturned: bundles.length,
          bundles,
        }),
      );
    }
    if (method === 'POST') {
      const body = parseBody(route);
      orderBundleMutationBodies.push(body);
      const createdDocumentIds: number[] = [];
      const updatedDocumentIds: number[] = [];
      const deletedDocumentIds: number[] = [];
      for (const operation of body.operations ?? []) {
        if (operation.operation === 'create') {
          const documentId = typeof operation.documentId === 'number' ? operation.documentId : nextOrderDocumentId++;
          createdDocumentIds.push(documentId);
          storedOrderBundles.push({
            ...operation,
            operation: undefined,
            documentId,
            patientId: SAFE_PATIENT_ID,
            startDate: operation.startDate ?? SAFE_VISIT_DATE,
          });
          continue;
        }
        if (operation.operation === 'update' && typeof operation.documentId === 'number') {
          updatedDocumentIds.push(operation.documentId);
          const patch = Object.fromEntries(Object.entries(operation).filter(([, value]) => value !== undefined));
          storedOrderBundles = storedOrderBundles.map((bundle) =>
            bundle.documentId === operation.documentId
              ? { ...bundle, ...patch, operation: undefined, patientId: SAFE_PATIENT_ID }
              : bundle,
          );
          continue;
        }
        if (operation.operation === 'delete' && typeof operation.documentId === 'number') {
          deletedDocumentIds.push(operation.documentId);
          storedOrderBundles = storedOrderBundles.filter((bundle) => bundle.documentId !== operation.documentId);
        }
      }
      return route.fulfill(jsonResponse({ ok: true, runId, createdDocumentIds, updatedDocumentIds, deletedDocumentIds }));
    }
    return route.fulfill(jsonResponse({ ok: false, message: 'unsupported method', runId }, 405));
  });
  await page.route('**/api/local/charts/subjectives', (route: Route) => {
    if (route.request().method().toUpperCase() !== 'POST') {
      return route.fulfill(jsonResponse({ ok: false, message: 'unsupported method', runId }, 405));
    }
    const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, any>;
    subjectiveBodies.push(body);
    return route.fulfill(
      jsonResponse({
        ok: true,
        status: 200,
        apiResult: '00',
        apiResultMessage: '処理終了',
        runId,
        recordedAt: `${SAFE_VISIT_DATE}T00:00:00Z`,
        entry: {
          documentId: nextSubjectiveId++,
          patientId: body.patientId,
          performDate: body.performDate,
          soapCategory: body.soapCategory,
          displaySection: body.displaySection,
          body: body.body,
          recordedAt: `${SAFE_VISIT_DATE}T00:00:00Z`,
          authorName: 'Safe Browser Doctor',
        },
      }),
    );
  });
  await page.route('**/api/local/diagnoses/*', (route: Route) =>
    route.fulfill(jsonResponse({ ok: true, runId, patientId: SAFE_PATIENT_ID, karteId: 9001, diseases })),
  );
  await page.route('**/api/local/diagnoses', (route: Route) => {
    if (route.request().method().toUpperCase() !== 'POST') {
      return route.fulfill(jsonResponse({ ok: false, message: 'unsupported method', runId }, 405));
    }
    const body = parseBody(route);
    diagnosisMutationBodies.push(body);
    const createdDiagnosisIds: number[] = [];
    const updatedDiagnosisIds: number[] = [];
    const removedDiagnosisIds: number[] = [];
    for (const operation of body.operations ?? []) {
      if (operation.operation === 'create') {
        const diagnosisId = nextDiagnosisId++;
        createdDiagnosisIds.push(diagnosisId);
        diseases.push({ ...operation, operation: undefined, diagnosisId, layer: 'insurance-local' });
      } else if (operation.operation === 'update') {
        updatedDiagnosisIds.push(operation.diagnosisId);
        diseases = diseases.map((entry) =>
          entry.diagnosisId === operation.diagnosisId ? { ...entry, ...operation, operation: undefined } : entry,
        );
      } else if (operation.operation === 'delete') {
        removedDiagnosisIds.push(operation.diagnosisId);
        diseases = diseases.filter((entry) => entry.diagnosisId !== operation.diagnosisId);
      }
    }
    return route.fulfill(jsonResponse({ ok: true, runId, createdDiagnosisIds, updatedDiagnosisIds, removedDiagnosisIds }));
  });
  await page.route('**/api/local/order/recommendations**', (route: Route) =>
    route.fulfill(jsonResponse({ ok: true, runId, recommendations: [] })),
  );
  await page.route('**/api/karte/freedocument/**', (route: Route) => route.fulfill(jsonResponse({ list: [], runId })));
  await page.route('**/odletter/**', (route: Route) => route.fulfill(jsonResponse({ list: [], runId })));

  return {
    readOnlyOrcaPaths,
    blockedOrcaPaths,
    subjectiveBodies,
    diagnosisMutationBodies,
    prescriptionMutationBodies,
    orderBundleMutationBodies,
  };
};

const establishSession = async (page: Page) => {
  await page.goto(`${baseUrl}/login?msw=1`);
  await page.evaluate(({ currentRunId, facilityId, userId }) => {
    const authSnapshot = {
      facilityId,
      userId,
      runId: currentRunId,
      clientUuid: 'safe-no-artifacts-e2e',
      displayName: 'E2E Doctor',
    };
    window.sessionStorage.setItem('opendolphin:web-client:auth', JSON.stringify(authSnapshot));
    window.sessionStorage.setItem(
      'opendolphin:web-client:auth-flags',
      JSON.stringify({
        sessionKey: `${facilityId}:${userId}`,
        flags: {
          runId: currentRunId,
          cacheHit: true,
          missingMaster: false,
          dataSourceTransition: 'server',
          fallbackUsed: false,
        },
        updatedAt: new Date().toISOString(),
      }),
    );
  }, { currentRunId: runId, facilityId: FACILITY_ID, userId: USER_ID });

  await page.goto(`${baseUrl}/f/${encodeURIComponent(FACILITY_ID)}/reception?msw=1`);
  await expect(page).toHaveURL(/reception/);
};

const openSafeChartsFromReception = async (page: Page) => {
  await expect(page.getByRole('region', { name: '受付一覧' })).toBeVisible({ timeout: 20_000 });
  const safePatientEntry = page.locator(
    '[data-test-id="reception-entry-card"][data-patient-id="PW-SAFE-UI-001"], [data-test-id="reception-entry-row"][data-patient-id="PW-SAFE-UI-001"]',
  );
  await expect(safePatientEntry).toBeVisible({ timeout: 20_000 });
  await safePatientEntry.getByRole('button', { name: /カルテを開く/ }).first().click();
  await expect(page.getByRole('region', { name: '外来カルテ作業台' })).toBeVisible({ timeout: 20_000 });
};

const openNewOrderEditor = async (page: Page, toolLabel: '処方' | '処置') => {
  await page.getByRole('button', { name: `${toolLabel}候補を開く` }).click();
  await expect(page.getByRole('complementary', { name: '右ユーティリティドロワー' })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: '新規作成を開く' }).first().click();
};

const closeRightDrawerIfOpen = async (page: Page) => {
  const closeButton = page.getByRole('button', { name: '右ドロワーを閉じる' });
  if ((await closeButton.count()) > 0 && (await closeButton.first().isVisible())) {
    await closeButton.first().click();
  }
};

const expandOrderGroupIfClosed = async (page: Page, groupLabel: string) => {
  const toggleButton = page.locator('#charts-order-pane').getByRole('button', { name: `${groupLabel}を開く` });
  if ((await toggleButton.count()) > 0 && (await toggleButton.first().isVisible())) {
    await toggleButton.first().click();
  }
};

test.describe('Charts missing context recovery safe smoke', () => {
  test.use({ ignoreHTTPSErrors: true });

  test('minimal context loss fails closed and offers return to reception', async ({ page }) => {
    await stubChartsShell(page);
    await establishSession(page);

    await page.goto(`${baseUrl}/f/${encodeURIComponent(FACILITY_ID)}/charts?msw=1&patientId=P-001&visitDate=2026-04-17`);
    await expect(page.locator('.charts-context-recovery')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: '来院文脈を再取得してください' })).toBeVisible();
    const recovery = page.locator('.charts-context-recovery');
    await expect(recovery.getByRole('button', { name: '受付へ戻る' })).toBeVisible();
    await expect(page.locator('#charts-action-send')).toBeDisabled();
  });

  test('reception card opens Charts with volatile encounter context only', async ({ page }) => {
    const { readOnlyOrcaPaths, blockedOrcaPaths } = await stubChartsShell(page, { includeSafeVisit: true });
    await establishSession(page);

    await openSafeChartsFromReception(page);

    await expect(page).toHaveURL(new RegExp(`/f/${encodeURIComponent(FACILITY_ID)}/charts`));
    expect(new URL(page.url()).searchParams.get('patientId')).toBeNull();
    await expect(page.getByRole('region', { name: '外来カルテ作業台' })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.charts-context-recovery')).toHaveCount(0);
    await expect(page.locator('#charts-patient-summary')).toContainText(SAFE_PATIENT_ID);
    await expect(page.locator('#charts-patient-summary')).toContainText('Safe Browser Patient');
    await expect(page.locator('#charts-action-send')).toBeVisible();

    const retainedEncounterStorage = await page.evaluate(() =>
      Object.keys(window.sessionStorage).filter((key) => key.includes('charts:encounter-context')),
    );
    expect(retainedEncounterStorage).toEqual([]);
    expect(readOnlyOrcaPaths).toEqual(
      expect.arrayContaining(['/api/orca/official/appointments/list', '/api/orca/official/visits/list']),
    );
    expect(blockedOrcaPaths).toEqual([]);
  });

  test('Charts UI saves SOAP and creates, updates, and deletes insurance disease through local-only routes', async ({ page }) => {
    const { readOnlyOrcaPaths, blockedOrcaPaths, subjectiveBodies, diagnosisMutationBodies } = await stubChartsShell(page, {
      includeSafeVisit: true,
    });
    await establishSession(page);

    await openSafeChartsFromReception(page);
    const soapRegion = page.getByRole('region', { name: 'SOAP 記載' });
    await expect(soapRegion).toBeVisible({ timeout: 20_000 });
    await page.locator('#soap-note-free').fill('browser UI free note');
    await page.locator('#soap-note-subjective').fill('browser UI subjective note');
    await page.locator('#soap-note-objective').fill('browser UI objective note');
    await page.locator('#soap-note-assessment').fill('browser UI assessment note');
    await page.locator('#soap-note-plan').fill('browser UI plan note');
    await soapRegion.getByRole('button', { name: '保存' }).click();
    await expect.poll(() => subjectiveBodies.length, { timeout: 20_000 }).toBe(5);

    await page.locator('#diagnosis-quick-name').fill('browser UI diagnosis');
    await page.locator('#diagnosis-quick-code').fill('J00');
    await page.locator('#diagnosis-quick-start').fill(SAFE_VISIT_DATE);
    await page.getByRole('button', { name: '保険病名に追加' }).click();
    await expect(page.getByText('病名を保存しました。')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('browser UI diagnosis')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Safe ORCA mirror')).toBeVisible();

    const insuranceList = page.getByRole('list', { name: '保険病名（活動中）' });
    await expect(insuranceList.getByText('browser UI diagnosis')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('list', { name: 'ORCA mirror' }).getByText('Safe ORCA mirror')).toBeVisible();
    await expect(page.getByRole('list', { name: 'ORCA mirror' }).getByRole('button', { name: '編集' })).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'ORCA mirror' }).getByRole('button', { name: '削除' })).toHaveCount(0);

    const createdDiagnosisRow = insuranceList.locator('li').filter({ hasText: 'browser UI diagnosis' });
    await createdDiagnosisRow.getByRole('button', { name: '編集' }).click();
    const editDialog = page.getByRole('dialog', { name: '病名の編集' });
    await expect(editDialog).toBeVisible({ timeout: 20_000 });
    await editDialog.locator('#diagnosis-name').fill('browser UI diagnosis updated');
    await editDialog.getByRole('button', { name: '更新' }).click();
    await expect(page.getByText('browser UI diagnosis updated')).toBeVisible({ timeout: 20_000 });

    const updatedDiagnosisRow = insuranceList.locator('li').filter({ hasText: 'browser UI diagnosis updated' });
    await updatedDiagnosisRow.getByRole('button', { name: '削除' }).click();
    await expect(page.getByText('病名を削除しました。')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('browser UI diagnosis updated')).toHaveCount(0);
    await expect(page.getByText('Safe ORCA mirror')).toBeVisible();

    expect(subjectiveBodies.map((body) => body.displaySection).sort()).toEqual([
      'assessment',
      'free',
      'objective',
      'plan',
      'subjective',
    ]);
    expect(subjectiveBodies.every((body) => body.patientId === SAFE_PATIENT_ID)).toBe(true);
    expect(diagnosisMutationBodies).toHaveLength(3);
    expect(diagnosisMutationBodies.every((body) => body.patientId === SAFE_PATIENT_ID)).toBe(true);
    expect(diagnosisMutationBodies.map((body) => body.operations[0]?.operation)).toEqual(['create', 'update', 'delete']);
    expect(diagnosisMutationBodies[0].operations).toEqual([
      expect.objectContaining({
        operation: 'create',
        diagnosisName: 'browser UI diagnosis',
        diagnosisCode: 'J00',
        startDate: SAFE_VISIT_DATE,
        category: '副病名',
      }),
    ]);
    expect(diagnosisMutationBodies[1].operations).toEqual([
      expect.objectContaining({
        operation: 'update',
        diagnosisName: 'browser UI diagnosis updated',
        diagnosisCode: 'J00',
        startDate: SAFE_VISIT_DATE,
        category: '副病名',
      }),
    ]);
    expect(diagnosisMutationBodies[2].operations).toEqual([
      expect.objectContaining({
        operation: 'delete',
        diagnosisName: 'browser UI diagnosis updated',
      }),
    ]);
    expect(readOnlyOrcaPaths).toEqual(
      expect.arrayContaining([
        '/api/orca/official/appointments/list',
        '/api/orca/official/visits/list',
      ]),
    );
    expect(blockedOrcaPaths).toEqual([]);
  });

  test('Charts UI saves and updates prescription bundles through local-only routes', async ({ page }) => {
    const { readOnlyOrcaPaths, blockedOrcaPaths, prescriptionMutationBodies } = await stubChartsShell(page, {
      includeSafeVisit: true,
    });
    await establishSession(page);
    await openSafeChartsFromReception(page);

    await openNewOrderEditor(page, '処方');
    const editor = page.locator('[data-test-id="medOrder-prescription-editor-v2"]');
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.getByLabel('RP名').fill('UI降圧薬RP');
    await editor.getByLabel('用法マスタ').focus();
    await editor.getByLabel('用法マスタ').selectOption('001000');
    await editor.locator('#rx-days').fill('7');
    await editor.getByLabel('キーワード').fill('browser med tablet');
    await editor.getByRole('button', { name: /620000123.*browser med tablet.*右へ反映/ }).click();
    await editor.locator('#rx-drug-quantity-0').fill('2');
    await editor.locator('#rx-drug-unit-0').fill('錠');
    await editor.locator('#rx-drug-comment-0').fill('local-only prescription comment');
    await editor.getByLabel('RP名').click();
    await editor.getByRole('button', { name: '保存して閉じる' }).click();
    await expect.poll(() => prescriptionMutationBodies.length, { timeout: 20_000 }).toBe(1);
    await closeRightDrawerIfOpen(page);
    await expect(
      page.locator('#charts-order-pane').getByRole('button', { name: 'UI降圧薬RPを編集', exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    await page.locator('#charts-order-pane').getByRole('button', { name: 'UI降圧薬RPを編集', exact: true }).click();
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.getByLabel('RP名').fill('UI降圧薬RP更新');
    await editor.getByRole('button', { name: '保存して閉じる' }).click();
    await expect.poll(() => prescriptionMutationBodies.length, { timeout: 20_000 }).toBe(2);
    await closeRightDrawerIfOpen(page);
    await expect(
      page.locator('#charts-order-pane').getByRole('button', { name: 'UI降圧薬RP更新を編集', exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    expect(prescriptionMutationBodies[0].patientId).toBe(SAFE_PATIENT_ID);
    expect(prescriptionMutationBodies[0].rps?.[0]).toEqual(
      expect.objectContaining({
        bundleName: 'UI降圧薬RP',
        usageName: '1日1回 朝食後',
        usageCode: '001000',
        medicalClass: '212',
        medicalClassNumber: '7',
      }),
    );
    expect(prescriptionMutationBodies[1].rps?.[0]).toEqual(
      expect.objectContaining({
        bundleName: 'UI降圧薬RP更新',
        usageName: '1日1回 朝食後',
      }),
    );
    expect(readOnlyOrcaPaths).toEqual(
      expect.arrayContaining([
        '/api/orca/official/appointments/list',
        '/api/orca/official/visits/list',
        '/api/orca/master/youhou',
        '/api/orca/master/drug',
        '/api/orca/master/generic-price',
      ]),
    );
    expect(blockedOrcaPaths).toEqual([]);
  });

  test('Charts UI saves, updates, and deletes representative treatment orders through local-only routes', async ({ page }) => {
    const { readOnlyOrcaPaths, blockedOrcaPaths, orderBundleMutationBodies } = await stubChartsShell(page, {
      includeSafeVisit: true,
    });
    await establishSession(page);
    await openSafeChartsFromReception(page);

    await openNewOrderEditor(page, '処置');
    const editor = page.locator('[data-test-id="treatmentOrder-edit-panel"]');
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.getByLabel('処置名').fill('UI処置束');
    await editor.getByLabel('処置指示').fill('browser local procedure memo');
    await editor.locator('#treatmentOrder-item-name-0').fill('browser treatment procedure');
    await expect(editor.getByText('入力候補 1件')).toBeVisible({ timeout: 20_000 });
    await editor.locator('#treatmentOrder-item-quantity-0').fill('1');
    await editor.locator('#treatmentOrder-item-unit-0').fill('回');
    await editor.locator('#treatmentOrder-item-name-0').press('Tab');
    await expect(editor.getByTestId('order-bundle-item-summary-0')).toContainText('コード: 140000610');
    await editor.getByRole('button', { name: '保存して閉じる' }).click();
    await expect.poll(() => orderBundleMutationBodies.length, { timeout: 20_000 }).toBe(1);
    await closeRightDrawerIfOpen(page);
    await expandOrderGroupIfClosed(page, '処置');
    await expect(
      page.locator('#charts-order-pane').getByRole('button', { name: 'UI処置束を編集', exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    await page.locator('#charts-order-pane').getByRole('button', { name: 'UI処置束を編集', exact: true }).click();
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.getByLabel('処置名').fill('UI処置束更新');
    await editor.getByRole('button', { name: '保存して閉じる' }).click();
    await expect.poll(() => orderBundleMutationBodies.length, { timeout: 20_000 }).toBe(2);
    await closeRightDrawerIfOpen(page);
    await expandOrderGroupIfClosed(page, '処置');
    await expect(
      page.locator('#charts-order-pane').getByRole('button', { name: 'UI処置束更新を編集', exact: true }),
    ).toBeVisible({ timeout: 20_000 });

    await page.locator('#charts-order-pane').getByRole('button', { name: 'UI処置束更新を削除', exact: true }).click();
    await expect(page.getByRole('alertdialog', { name: 'オーダーを削除しますか？' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: '削除する' }).click();
    await expect(page.getByText('オーダーを削除しました。')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('UI処置束更新')).toHaveCount(0);

    await expect.poll(() => orderBundleMutationBodies.length, { timeout: 20_000 }).toBe(3);
    expect(orderBundleMutationBodies.map((body) => body.operations?.[0]?.operation)).toEqual(['create', 'update', 'delete']);
    expect(orderBundleMutationBodies[0].operations?.[0]).toEqual(
      expect.objectContaining({
        entity: 'treatmentOrder',
        bundleName: 'UI処置束',
        classCode: '400',
      }),
    );
    expect(orderBundleMutationBodies[1].operations?.[0]).toEqual(
      expect.objectContaining({
        entity: 'treatmentOrder',
        bundleName: 'UI処置束更新',
        classCode: '400',
      }),
    );
    expect(readOnlyOrcaPaths).toEqual(
      expect.arrayContaining([
        '/api/orca/official/appointments/list',
        '/api/orca/official/visits/list',
        '/api/orca/master/etensu',
        '/api/orca/master/material',
        '/api/orca/official/chart-support/medication-get',
      ]),
    );
    expect(blockedOrcaPaths).toEqual([]);
  });
});
