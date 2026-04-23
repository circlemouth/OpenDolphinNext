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

const stubChartsShell = async (page: Page, options: { includeSafeVisit?: boolean } = {}) => {
  let nextSubjectiveId = 5100;
  let nextDiagnosisId = 6100;
  const subjectiveBodies: Array<Record<string, any>> = [];
  const diagnosisMutationBodies: Array<Record<string, any>> = [];
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
  await page.route('**/session/login**', (route: Route) =>
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
    const pathname = new URL(route.request().url()).pathname;
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
    route.fulfill(jsonResponse({ found: false, runId, sourceBundles: [], order: null })),
  );
  await page.route('**/api/local/order/bundles**', (route: Route) =>
    route.fulfill(jsonResponse({ ok: true, runId, patientId: SAFE_PATIENT_ID, recordsReturned: 0, bundles: [] })),
  );
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
    const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, any>;
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

  return { readOnlyOrcaPaths, blockedOrcaPaths, subjectiveBodies, diagnosisMutationBodies };
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

    await expect(page.getByRole('region', { name: '受付一覧' })).toBeVisible({ timeout: 20_000 });
    const safePatientEntry = page.locator(
      '[data-test-id="reception-entry-card"][data-patient-id="PW-SAFE-UI-001"], [data-test-id="reception-entry-row"][data-patient-id="PW-SAFE-UI-001"]',
    );
    await expect(safePatientEntry).toBeVisible({ timeout: 20_000 });
    await safePatientEntry.getByRole('button', { name: /カルテを開く/ }).first().click();

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

  test('Charts UI saves SOAP and adds insurance disease through local-only routes', async ({ page }) => {
    const { readOnlyOrcaPaths, blockedOrcaPaths, subjectiveBodies, diagnosisMutationBodies } = await stubChartsShell(page, {
      includeSafeVisit: true,
    });
    await establishSession(page);

    await expect(page.getByRole('region', { name: '受付一覧' })).toBeVisible({ timeout: 20_000 });
    const safePatientEntry = page.locator(
      '[data-test-id="reception-entry-card"][data-patient-id="PW-SAFE-UI-001"], [data-test-id="reception-entry-row"][data-patient-id="PW-SAFE-UI-001"]',
    );
    await expect(safePatientEntry).toBeVisible({ timeout: 20_000 });
    await safePatientEntry.getByRole('button', { name: /カルテを開く/ }).first().click();

    await expect(page.getByRole('region', { name: '外来カルテ作業台' })).toBeVisible({ timeout: 20_000 });
    const soapRegion = page.getByRole('region', { name: 'SOAP 記載' });
    await expect(soapRegion).toBeVisible({ timeout: 20_000 });
    await page.locator('#soap-note-subjective').fill('browser UI subjective note');
    await page.locator('#soap-note-objective').fill('browser UI objective note');
    await soapRegion.getByRole('button', { name: '保存' }).click();
    await expect.poll(() => subjectiveBodies.length, { timeout: 20_000 }).toBe(2);

    await page.locator('#diagnosis-quick-name').fill('browser UI diagnosis');
    await page.locator('#diagnosis-quick-code').fill('J00');
    await page.locator('#diagnosis-quick-start').fill(SAFE_VISIT_DATE);
    await page.getByRole('button', { name: '保険病名に追加' }).click();
    await expect(page.getByText('病名を保存しました。')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('browser UI diagnosis')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Safe ORCA mirror')).toBeVisible();

    expect(subjectiveBodies.map((body) => body.displaySection).sort()).toEqual(['objective', 'subjective']);
    expect(subjectiveBodies.every((body) => body.patientId === SAFE_PATIENT_ID)).toBe(true);
    expect(diagnosisMutationBodies).toHaveLength(1);
    expect(diagnosisMutationBodies[0].patientId).toBe(SAFE_PATIENT_ID);
    expect(diagnosisMutationBodies[0].operations).toEqual([
      expect.objectContaining({
        operation: 'create',
        diagnosisName: 'browser UI diagnosis',
        diagnosisCode: 'J00',
        startDate: SAFE_VISIT_DATE,
        category: '副病名',
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
});
