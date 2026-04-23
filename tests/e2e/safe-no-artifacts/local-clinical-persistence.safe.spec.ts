// Artifact-free RWO-03/RWO-04/RWO-05 browser checks.
// These specs run client modules in the browser and keep all persistence stubs local-only.

import { expect, test, type Page, type Route } from '@playwright/test';

import { baseUrl, runId } from '../helpers/orcaMaster';

const FACILITY_ID = '1.3.6.1.4.1.9414.72.103';
const USER_ID = 'doctor1';
const PATIENT_ID = 'PW-SAFE-001';
const VISIT_DATE = '2026-04-23';
const ENCOUNTER_ID = `${FACILITY_ID}:SAFE-${runId}`;

type JsonRecord = Record<string, any>;

const jsonResponse = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

const parseBody = (route: Route): JsonRecord => {
  const body = route.request().postData() ?? '{}';
  return JSON.parse(body) as JsonRecord;
};

const installRuntimeShell = async (page: Page) => {
  const sessionPayload = {
    facilityId: FACILITY_ID,
    userId: USER_ID,
    displayName: 'Safe Browser Doctor',
    roles: ['doctor'],
    clientUuid: 'safe-no-artifacts-local-clinical',
    runId,
  };

  await page.route('**/safe-browser-no-artifacts-host.html', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><head><meta charset="utf-8"><title>safe browser host</title></head><body></body></html>',
    }),
  );
  await page.route('**/api/session/me**', (route) => route.fulfill(jsonResponse(sessionPayload)));
  await page.route('**/session/me**', (route) => route.fulfill(jsonResponse(sessionPayload)));
  await page.route('**/api/user/**', (route) => route.fulfill(jsonResponse(sessionPayload)));
  await page.addInitScript(({ currentRunId, facilityId, userId }) => {
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
    window.sessionStorage.setItem(
      'opendolphin:web-client:auth',
      JSON.stringify({
        facilityId,
        userId,
        runId: currentRunId,
        clientUuid: 'safe-no-artifacts-local-clinical',
        displayName: 'Safe Browser Doctor',
        role: 'doctor',
      }),
    );
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

  await page.goto(`${baseUrl}/safe-browser-no-artifacts-host.html`);
};

const installOrcaMutationGuard = async (page: Page) => {
  const blockedCalls: string[] = [];
  const block = (route: Route) => {
    blockedCalls.push(new URL(route.request().url()).pathname);
    return route.fulfill(jsonResponse({ ok: false, routeBlocked: true, runId }, 451));
  };

  await page.route('**/api/orca/**', block);
  await page.route('**/api21/**', block);
  await page.route('**/orca21/**', block);
  await page.route('**/orca22/**', block);
  await page.route('**/orca25/**', block);
  return blockedCalls;
};

const installPrescriptionLocalStub = async (page: Page) => {
  let storedOrder: JsonRecord | null = null;
  const savedBodies: JsonRecord[] = [];

  await page.route('**/api/local/prescription-orders**', (route) => {
    const method = route.request().method().toUpperCase();
    if (method === 'GET') {
      return route.fulfill(
        jsonResponse({
          found: Boolean(storedOrder),
          runId,
          patientId: PATIENT_ID,
          recordsReturned: storedOrder ? 1 : 0,
          order: storedOrder,
        }),
      );
    }
    if (method === 'POST') {
      const body = parseBody(route);
      savedBodies.push(body);
      storedOrder = {
        ...body,
        patientId: PATIENT_ID,
        encounterId: body.encounterId ?? ENCOUNTER_ID,
        encounterDate: body.encounterDate ?? VISIT_DATE,
        performDate: body.performDate ?? VISIT_DATE,
      };
      return route.fulfill(jsonResponse({ ok: true, runId }));
    }
    return route.fulfill(jsonResponse({ ok: false, message: 'unsupported method', runId }, 405));
  });

  return savedBodies;
};

const installOrderBundleLocalStub = async (page: Page) => {
  let nextDocumentId = 3000;
  let bundles: JsonRecord[] = [];
  const mutationBodies: JsonRecord[] = [];

  await page.route('**/api/local/order/bundles**', (route) => {
    const method = route.request().method().toUpperCase();
    const url = new URL(route.request().url());
    if (method === 'GET') {
      const entity = url.searchParams.get('entity');
      const filtered = entity ? bundles.filter((bundle) => bundle.entity === entity) : bundles;
      return route.fulfill(
        jsonResponse({
          ok: true,
          runId,
          patientId: PATIENT_ID,
          recordsReturned: filtered.length,
          bundles: filtered,
        }),
      );
    }
    if (method === 'POST') {
      const body = parseBody(route);
      mutationBodies.push(body);
      const createdDocumentIds: number[] = [];
      const updatedDocumentIds: number[] = [];
      const deletedDocumentIds: number[] = [];
      for (const operation of body.operations ?? []) {
        if (operation.operation === 'create') {
          const documentId = nextDocumentId++;
          createdDocumentIds.push(documentId);
          bundles.push({ ...operation, operation: undefined, documentId });
        } else if (operation.operation === 'update') {
          updatedDocumentIds.push(operation.documentId);
          bundles = bundles.map((bundle) =>
            bundle.documentId === operation.documentId ? { ...bundle, ...operation, operation: undefined } : bundle,
          );
        } else if (operation.operation === 'delete') {
          deletedDocumentIds.push(operation.documentId);
          bundles = bundles.filter((bundle) => bundle.documentId !== operation.documentId);
        }
      }
      return route.fulfill(jsonResponse({ ok: true, runId, createdDocumentIds, updatedDocumentIds, deletedDocumentIds }));
    }
    return route.fulfill(jsonResponse({ ok: false, message: 'unsupported method', runId }, 405));
  });

  return mutationBodies;
};

const installSoapAndDiseaseLocalStubs = async (page: Page) => {
  let nextSubjectiveId = 7000;
  let nextDiagnosisId = 8100;
  const subjectiveBodies: JsonRecord[] = [];
  const diagnosisMutationBodies: JsonRecord[] = [];
  let diseases: JsonRecord[] = [
    {
      diagnosisId: 8001,
      diagnosisName: 'ORCA mirror sample',
      diagnosisCode: 'I10',
      startDate: VISIT_DATE,
      outcome: '継続',
      layer: 'orca-mirror',
      readOnly: true,
      syncState: 'manual-resolution',
    },
  ];

  await page.route('**/api/local/charts/subjectives**', (route) => {
    if (route.request().method().toUpperCase() !== 'POST') {
      return route.fulfill(jsonResponse({ ok: false, message: 'unsupported method', runId }, 405));
    }
    const body = parseBody(route);
    subjectiveBodies.push(body);
    return route.fulfill(
      jsonResponse({
        ok: true,
        status: 200,
        apiResult: '00',
        apiResultMessage: '処理終了',
        runId,
        recordedAt: `${VISIT_DATE}T00:00:00Z`,
        entry: {
          documentId: nextSubjectiveId++,
          patientId: body.patientId,
          performDate: body.performDate,
          soapCategory: body.soapCategory,
          displaySection: body.displaySection,
          body: body.body,
          recordedAt: `${VISIT_DATE}T00:00:00Z`,
          authorName: 'Safe Browser Doctor',
        },
      }),
    );
  });

  await page.route('**/api/local/diagnoses**', (route) => {
    const method = route.request().method().toUpperCase();
    if (method === 'GET') {
      return route.fulfill(
        jsonResponse({
          ok: true,
          runId,
          patientId: PATIENT_ID,
          karteId: 9001,
          diseases,
        }),
      );
    }
    if (method === 'POST') {
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
    }
    return route.fulfill(jsonResponse({ ok: false, message: 'unsupported method', runId }, 405));
  });

  return { subjectiveBodies, diagnosisMutationBodies };
};

test.describe('Artifact-free local clinical persistence browser contracts', () => {
  test.use({ ignoreHTTPSErrors: true });

  test('RWO-03 prescription save, reload, edit, delete, and copy stay local-only', async ({ page }) => {
    const blockedOrcaCalls = await installOrcaMutationGuard(page);
    const savedBodies = await installPrescriptionLocalStub(page);
    await installRuntimeShell(page);

    const result = await page.evaluate(
      async ({ patientId, visitDate, encounterId }) => {
        const api = await import('/src/features/charts/prescriptionOrderApi.ts');
        const initialOrder = {
          patientId,
          encounterId,
          encounterDate: visitDate,
          performDate: visitDate,
          doctorComment: 'browser prescription doctor comment',
          deletedDocumentIds: [],
          prescriptionSettings: [{ code: 'outside', name: '院外処方', value: 'enabled' }],
          remarks: [{ code: 'local-remark', text: 'browser local remark' }],
          rps: [
            {
              rpId: 'rp-browser-1',
              name: 'browser RP',
              location: 'out',
              category: 'regular',
              usage: '1日1回 朝食後',
              usageCode: '001000',
              daysOrTimes: '7',
              remark: 'browser remark',
              refillPattern: 'none',
              doctorComment: 'browser RP doctor comment',
              started: visitDate,
              claimComments: [{ id: 'rp-claim-1', code: '830000001', name: 'RP comment', note: 'RP note' }],
              drugs: [
                {
                  rowId: 'drug-browser-1',
                  code: '620000001',
                  name: 'browser drug',
                  quantity: '1',
                  unit: '錠',
                  genericChangeAllowed: true,
                  isGeneralNamePrescription: false,
                  drugComment: 'browser drug comment',
                  claimComments: [{ id: 'drug-claim-1', code: '810000001', name: 'Drug comment', note: 'Drug note' }],
                  patientRequest: true,
                },
              ],
            },
          ],
        };

        const firstSave = await api.savePrescriptionOrder({ patientId, order: initialOrder });
        const reloaded = await api.fetchPrescriptionOrder({ patientId, from: visitDate, encounterId });
        const editedOrder = {
          ...reloaded.order,
          doctorComment: 'browser prescription edited',
          rps: [
            {
              ...reloaded.order.rps[0],
              usage: '1日2回 朝夕食後',
              usageCode: '002000',
              daysOrTimes: '14',
              drugs: [{ ...reloaded.order.rps[0].drugs[0], quantity: '2', drugComment: 'browser edited drug comment' }],
            },
          ],
        };
        const editSave = await api.savePrescriptionOrder({ patientId, order: editedOrder });
        const deleteSave = await api.savePrescriptionOrder({ patientId, order: { ...editedOrder, rps: [] } });
        const copyTarget = {
          ...api.buildEmptyPrescriptionOrder(patientId, visitDate, `${encounterId}:COPY`),
          rps: [],
        };
        const copiedOrder = api.importPrescriptionDoInput(copyTarget, { type: 'order', order: reloaded.order });
        const copySave = await api.savePrescriptionOrder({ patientId, order: copiedOrder });

        return {
          firstSaveOk: firstSave.ok,
          reloadedOk: reloaded.ok,
          reloadedUsage: reloaded.order.rps[0]?.usage,
          editSaveOk: editSave.ok,
          deleteSaveOk: deleteSave.ok,
          copySaveOk: copySave.ok,
          copiedEncounterId: copiedOrder.encounterId,
          copiedUsage: copiedOrder.rps[0]?.usage,
        };
      },
      { patientId: PATIENT_ID, visitDate: VISIT_DATE, encounterId: ENCOUNTER_ID },
    );

    expect(result).toEqual(
      expect.objectContaining({
        firstSaveOk: true,
        reloadedOk: true,
        reloadedUsage: '1日1回 朝食後',
        editSaveOk: true,
        deleteSaveOk: true,
        copySaveOk: true,
        copiedEncounterId: `${ENCOUNTER_ID}:COPY`,
        copiedUsage: '1日1回 朝食後',
      }),
    );
    expect(savedBodies).toHaveLength(4);
    expect(savedBodies.map((body) => body.rps?.length)).toEqual([1, 1, 0, 1]);
    expect(savedBodies[1].doctorComments).toEqual([{ text: 'browser prescription edited' }]);
    expect(savedBodies[1].rps[0]).toEqual(expect.objectContaining({ medicalClassNumber: '14', usageCode: '002000' }));
    expect(blockedOrcaCalls).toEqual([]);
  });

  test('RWO-04 representative generic order create, readback, update, and delete stay local-only', async ({ page }) => {
    const blockedOrcaCalls = await installOrcaMutationGuard(page);
    const mutationBodies = await installOrderBundleLocalStub(page);
    await installRuntimeShell(page);

    const result = await page.evaluate(
      async ({ patientId }) => {
        const api = await import('/src/features/charts/orderBundleApi.ts');
        const createResult = await api.mutateOrderBundles({
          patientId,
          operations: [
            {
              operation: 'create',
              entity: 'injectionOrder',
              bundleName: 'browser injection',
              bundleNumber: '1',
              classCode: '310',
              classCodeSystem: 'Claim007',
              admin: '点滴静注',
              adminCode: '4103',
              adminMemo: '20ml/h',
              items: [{ code: '620000012', name: '注射薬A', quantity: '1', unit: 'A', rowRole: 'main' }],
              materialItems: [{ code: '700000031', name: 'ドリップセット', quantity: '1', unit: '式', rowRole: 'material' }],
              commentItems: [{ code: '0085001', name: 'コメント', quantity: '', unit: '', memo: 'slow', rowRole: 'comment' }],
            },
            {
              operation: 'create',
              entity: 'testOrder',
              bundleName: 'browser specimen test',
              bundleNumber: '1',
              subtype: 'specimen',
              classCode: '600',
              items: [{ code: '160000010', name: 'CBC', quantity: '1', unit: '回', rowRole: 'main' }],
            },
            {
              operation: 'create',
              entity: 'radiologyOrder',
              bundleName: 'browser chest CT',
              bundleNumber: '1',
              classCode: '700',
              items: [{ code: '170017510', name: 'CT撮影', quantity: '1', unit: '回', rowRole: 'main' }],
              bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '正面', rowRole: 'bodyPart' },
            },
            {
              operation: 'create',
              entity: 'treatmentOrder',
              bundleName: 'browser treatment',
              bundleNumber: '1',
              classCode: '400',
              items: [{ code: '140000610', name: '創傷処置', quantity: '1', unit: '回', rowRole: 'main' }],
              materialItems: [{ code: '700000031', name: '処置材料', quantity: '1', unit: '個', rowRole: 'material' }],
            },
            {
              operation: 'create',
              entity: 'surgeryOrder',
              bundleName: 'browser surgery',
              bundleNumber: '1',
              classCode: '500',
              items: [{ code: '150000001', name: '縫合術', quantity: '1', unit: '回', rowRole: 'main' }],
            },
            {
              operation: 'create',
              entity: 'otherOrder',
              bundleName: 'browser local other',
              bundleNumber: '1',
              items: [{ code: 'LOCAL_OTHER:education', name: '療養指導', quantity: '1', unit: '回', rowRole: 'main' }],
            },
          ],
        });
        const radiology = await api.fetchOrderBundles({ patientId, entity: 'radiologyOrder' });
        const surgery = await api.fetchOrderBundles({ patientId, entity: 'surgeryOrder' });
        const radiologyId = radiology.bundles[0]?.documentId;
        const surgeryId = surgery.bundles[0]?.documentId;
        const updateResult = await api.mutateOrderBundles({
          patientId,
          operations: [
            {
              operation: 'update',
              documentId: radiologyId,
              entity: 'radiologyOrder',
              bundleName: 'browser chest CT updated',
              bundleNumber: '1',
              classCode: '700',
              items: [{ code: '170017510', name: 'CT撮影', quantity: '1', unit: '回', rowRole: 'main' }],
              bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '側面追加', rowRole: 'bodyPart' },
            },
            {
              operation: 'delete',
              documentId: surgeryId,
              entity: 'surgeryOrder',
              classCode: '500',
              bundleName: 'browser surgery',
            },
          ],
        });
        const updatedRadiology = await api.fetchOrderBundles({ patientId, entity: 'radiologyOrder' });
        const remainingSurgery = await api.fetchOrderBundles({ patientId, entity: 'surgeryOrder' });
        const allOrders = await api.fetchOrderBundles({ patientId });

        return {
          createOk: createResult.ok,
          updateOk: updateResult.ok,
          createdCount: createResult.createdDocumentIds?.length ?? 0,
          radiologyBodyPartMemo: updatedRadiology.bundles[0]?.bodyPart?.memo,
          remainingSurgeryCount: remainingSurgery.bundles.length,
          totalReadbackCount: allOrders.bundles.length,
          entitySet: allOrders.bundles.map((bundle: any) => bundle.entity).sort(),
        };
      },
      { patientId: PATIENT_ID },
    );

    expect(result).toEqual(
      expect.objectContaining({
        createOk: true,
        updateOk: true,
        createdCount: 6,
        radiologyBodyPartMemo: '側面追加',
        remainingSurgeryCount: 0,
        totalReadbackCount: 5,
      }),
    );
    expect(result.entitySet).toEqual(['injectionOrder', 'otherOrder', 'radiologyOrder', 'testOrder', 'treatmentOrder']);
    expect(mutationBodies).toHaveLength(2);
    expect(mutationBodies[0].operations.map((operation: JsonRecord) => operation.entity).sort()).toEqual([
      'injectionOrder',
      'otherOrder',
      'radiologyOrder',
      'surgeryOrder',
      'testOrder',
      'treatmentOrder',
    ]);
    expect(blockedOrcaCalls).toEqual([]);
  });

  test('RWO-05 SOAP and disease local readback stays local-only and keeps ORCA mirror read-only', async ({ page }) => {
    const blockedOrcaCalls = await installOrcaMutationGuard(page);
    const { subjectiveBodies, diagnosisMutationBodies } = await installSoapAndDiseaseLocalStubs(page);
    await installRuntimeShell(page);

    const result = await page.evaluate(
      async ({ patientId, visitDate }) => {
        const soapApi = await import('/src/features/charts/soap/subjectiveChartApi.ts');
        const diseaseApi = await import('/src/features/charts/diseaseApi.ts');
        const sectionPayloads = [
          { soapCategory: 'S', displaySection: 'free', body: 'browser free local note' },
          { soapCategory: 'S', displaySection: 'subjective', body: 'browser subjective' },
          { soapCategory: 'O', displaySection: 'objective', body: 'browser objective' },
          { soapCategory: 'A', displaySection: 'assessment', body: 'browser assessment' },
          { soapCategory: 'P', displaySection: 'plan', body: 'browser plan' },
        ] as const;
        const soapResults = [];
        for (const section of sectionPayloads) {
          soapResults.push(await soapApi.postChartSubjectiveEntry({ patientId, performDate: visitDate, ...section }));
        }

        const initialDiseases = await diseaseApi.fetchDiseases({ patientId, from: visitDate });
        const createResult = await diseaseApi.mutateDiseases({
          patientId,
          karteId: initialDiseases.karteId ?? 9001,
          operations: [
            {
              operation: 'create',
              diagnosisName: 'browser local diagnosis',
              diagnosisCode: 'J00',
              startDate: visitDate,
              category: '主病名',
              suspectedFlag: '疑い',
            },
          ],
        });
        const afterCreate = await diseaseApi.fetchDiseases({ patientId, from: visitDate });
        const createdId = createResult.createdDiagnosisIds?.[0];
        const updateResult = await diseaseApi.mutateDiseases({
          patientId,
          karteId: afterCreate.karteId ?? 9001,
          operations: [
            {
              operation: 'update',
              diagnosisId: createdId,
              diagnosisName: 'browser local diagnosis',
              diagnosisCode: 'J00',
              startDate: visitDate,
              endDate: visitDate,
              outcome: '治癒',
              category: '主病名',
              suspectedFlag: '疑い',
            },
          ],
        });
        const deleteResult = await diseaseApi.mutateDiseases({
          patientId,
          karteId: afterCreate.karteId ?? 9001,
          operations: [{ operation: 'delete', diagnosisId: createdId, diagnosisName: 'browser local diagnosis' }],
        });
        const finalDiseases = await diseaseApi.fetchDiseases({ patientId, from: visitDate });

        return {
          soapOk: soapResults.every((entry) => entry.ok && entry.entry?.patientId === patientId),
          soapSections: soapResults.map((entry) => entry.entry?.displaySection).sort(),
          initialMirrorReadOnly: initialDiseases.diseases?.some((entry: any) => entry.layer === 'orca-mirror' && entry.readOnly),
          createOk: createResult.ok,
          updateOk: updateResult.ok,
          deleteOk: deleteResult.ok,
          finalLocalDiseaseCount: finalDiseases.diseases?.filter((entry: any) => entry.layer === 'insurance-local').length ?? 0,
          finalMirrorCount: finalDiseases.diseases?.filter((entry: any) => entry.layer === 'orca-mirror').length ?? 0,
        };
      },
      { patientId: PATIENT_ID, visitDate: VISIT_DATE },
    );

    expect(result).toEqual(
      expect.objectContaining({
        soapOk: true,
        initialMirrorReadOnly: true,
        createOk: true,
        updateOk: true,
        deleteOk: true,
        finalLocalDiseaseCount: 0,
        finalMirrorCount: 1,
      }),
    );
    expect(result.soapSections).toEqual(['assessment', 'free', 'objective', 'plan', 'subjective']);
    expect(subjectiveBodies).toHaveLength(5);
    expect(diagnosisMutationBodies.map((body) => body.operations[0]?.operation)).toEqual(['create', 'update', 'delete']);
    expect(blockedOrcaCalls).toEqual([]);
  });
});
