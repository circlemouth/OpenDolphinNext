import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'RUN-GEN'),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-META', traceId: 'TRACE-META' })),
  updateObservabilityMeta: vi.fn(),
}));

import { httpFetch } from '../../../libs/http/httpClient';
import { buildMedicalModV2RequestXml, postOrcaMedicalModV2Xml } from '../orcaClaimApi';
import { fetchOrderBundles, mutateOrderBundles } from '../orderBundleApi';
import {
  fetchMedicalModV2OrderBundles,
  prepareMedicalModV2SendData,
  toMedicalModV2InformationWithSource,
} from '../orderRpNormalization';
import { buildEmptyPrescriptionOrder, fetchPrescriptionOrder, savePrescriptionOrder } from '../prescriptionOrderApi';

describe('order send smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('radiology payload keeps sendable rows and drops local-only fields', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ runId: 'RUN-SAVE', createdDocumentIds: [101] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-FETCH',
            patientId: '000001',
            bundles: [
              {
                entity: 'radiologyOrder',
                bundleName: 'CHEST-CT',
                bundleNumber: '3',
                classCode: '700',
                classCodeSystem: 'Claim007',
                className: 'Radiology',
                admin: 'local-admin-note',
                memo: 'local-bundle-memo',
                bodyPart: { code: '002001', name: 'CHEST', quantity: '1', unit: 'PART', memo: '' },
                items: [
                  { code: '170017510', name: 'CT_SCAN', quantity: '1', unit: 'times', memo: 'local-item-memo' },
                  { code: '700000001', name: 'CONTRAST', quantity: '1', unit: 'bottle', memo: '' },
                  { code: '0085001', name: 'CAUTION', quantity: '', unit: '', memo: 'note' },
                ],
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ runId: 'RUN-SEND', traceId: 'TRACE-SEND', apiResult: '00', apiResultMessage: 'OK' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await mutateOrderBundles({
      patientId: '000001',
      operations: [
        {
          operation: 'create',
          entity: 'radiologyOrder',
          bundleName: 'CHEST-CT',
          bundleNumber: '3',
          classCode: '700',
          classCodeSystem: 'Claim007',
          className: 'Radiology',
          admin: 'local-admin-note',
          memo: 'local-bundle-memo',
          bodyPart: { code: '002001', name: 'CHEST', quantity: '1', unit: 'PART', memo: '' },
          items: [
            { code: '170017510', name: 'CT_SCAN', quantity: '1', unit: 'times', memo: 'local-item-memo' },
            { code: '700000001', name: 'CONTRAST', quantity: '1', unit: 'bottle', memo: '' },
            { code: '0085001', name: 'CAUTION', quantity: '', unit: '', memo: 'note' },
          ],
        },
      ],
    });

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'radiologyOrder' });
    const normalized = fetched.bundles
      .map((bundle) => toMedicalModV2InformationWithSource(bundle))
      .filter((entry): entry is NonNullable<ReturnType<typeof toMedicalModV2InformationWithSource>> => Boolean(entry));

    const payload = buildMedicalModV2RequestXml({
      patientId: '000001',
      performDate: '2026-03-09T09:30:00',
      departmentCode: '01',
      physicianCode: '10001',
      medicalInformation: normalized.map((entry) => entry.info),
    });

    expect(payload.medicalInformation?.[0]?.medications.map((item) => item.code)).toEqual([
      '002001',
      '170017510',
      '700000001',
      '0085001',
    ]);
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local-admin-note');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local-bundle-memo');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local-item-memo');

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });
    expect(sendResult.ok).toBe(true);
  });

  it('bacteria bundle is not blanket-blocked and keeps first-class metadata local-only', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ runId: 'RUN-SAVE-600', createdDocumentIds: [303] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-FETCH-600',
            patientId: '000001',
            bundles: [
              {
                entity: 'bacteriaOrder',
                bundleName: 'bacteria-bundle',
                bundleNumber: '6',
                subtype: 'culture',
                bacteria: {
                  specimen: {
                    role: 'specimen',
                    code: '830000001',
                    name: 'SPUTUM',
                  },
                  carrierComments: [
                    {
                      role: 'instruction',
                      code: '842000001',
                      name: 'INCUBATE_HOURS',
                      inputValue: '48',
                    },
                  ],
                },
                classCode: '600',
                classCodeSystem: 'Claim007',
                className: 'Test',
                adminMemo: 'local-admin-memo',
                memo: 'local-bundle-memo',
                items: [{ code: '160000010', name: 'lab-item', quantity: '1', unit: 'count', memo: '' }],
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    await mutateOrderBundles({
      patientId: '000001',
      operations: [
        {
          operation: 'create',
          entity: 'bacteriaOrder',
          bundleName: 'bacteria-bundle',
          bundleNumber: '6',
          subtype: 'culture',
          bacteria: {
            specimen: {
              role: 'specimen',
              code: '830000001',
              name: 'SPUTUM',
            },
            carrierComments: [
              {
                role: 'instruction',
                code: '842000001',
                name: 'INCUBATE_HOURS',
                inputValue: '48',
              },
            ],
          },
          classCode: '600',
          classCodeSystem: 'Claim007',
          className: 'Test',
          adminMemo: 'local-admin-memo',
          memo: 'local-bundle-memo',
          items: [{ code: '160000010', name: 'lab-item', quantity: '1', unit: 'count', memo: '' }],
        },
      ],
    });

    const saveRequest = vi.mocked(httpFetch).mock.calls[0]?.[1] as RequestInit | undefined;
    const saveBody = JSON.parse(String(saveRequest?.body ?? '{}')) as Record<string, any>;
    expect(saveBody.operations[0]?.bacteria).toEqual(
      expect.objectContaining({
        specimen: expect.objectContaining({
          code: '830000001',
          name: 'SPUTUM',
        }),
      }),
    );

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'bacteriaOrder' });
    const prepared = prepareMedicalModV2SendData(fetched.bundles);

    expect(prepared.bundleIssues).toEqual([]);
    expect(prepared.medicalInformation[0]?.medications.map((item) => item.code)).toEqual(['160000010']);
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('culture');
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('local-admin-memo');
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('local-bundle-memo');
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('SPUTUM');
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('842000001');
  });

  it('injection save/fetch keeps row-role ordering before ORCA normalization', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ runId: 'RUN-SAVE-INJECTION', createdDocumentIds: [404] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-FETCH-INJECTION',
            patientId: '000001',
            bundles: [
              {
                entity: 'injectionOrder',
                bundleName: 'procedure-drug',
                bundleNumber: '2',
                classCode: '310',
                classCodeSystem: 'Claim007',
                className: 'Injection',
                admin: 'procedure',
                adminCode: '4102',
                adminMemo: 'ward-note',
                memo: 'bundle-b',
                items: [
                  { code: '0085001', name: 'COMMENT', quantity: '', unit: '', memo: 'after-procedure', rowRole: 'comment' },
                  { code: '830000001', name: 'PROCEDURE', quantity: '1', unit: 'times', memo: '', rowRole: 'main' },
                  { code: '620000011', name: 'DRUG_B', quantity: '1', unit: 'ampoule', memo: '', userComment: 'local-b', rowRole: 'main' },
                  { code: '700000031', name: 'DRIP_SET', quantity: '1', unit: 'set', memo: '', rowRole: 'material' },
                ],
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      ;

    await mutateOrderBundles({
      patientId: '000001',
      operations: [
        {
          operation: 'create',
          entity: 'injectionOrder',
          bundleName: 'procedure-drug',
          bundleNumber: '2',
          classCode: '310',
          classCodeSystem: 'Claim007',
          className: 'Injection',
          admin: 'procedure',
          adminCode: '4102',
          adminMemo: 'ward-note',
          memo: 'bundle-b',
          items: [
            { code: '0085001', name: 'COMMENT', quantity: '', unit: '', memo: 'after-procedure', rowRole: 'comment' },
            { code: '830000001', name: 'PROCEDURE', quantity: '1', unit: 'times', memo: '', rowRole: 'main' },
            { code: '620000011', name: 'DRUG_B', quantity: '1', unit: 'ampoule', memo: '', userComment: 'local-b', rowRole: 'main' },
            { code: '700000031', name: 'DRIP_SET', quantity: '1', unit: 'set', memo: '', rowRole: 'material' },
          ],
        },
      ],
    });

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'injectionOrder' });
    expect(fetched.bundles[0]?.items.map((item) => item.rowRole)).toEqual([
      'comment',
      'main',
      'main',
      'material',
    ]);
    expect(fetched.bundles[0]?.items[2]?.userComment).toBe('local-b');
  });

  it('prescription order remains the medOrder source of truth across save fetch normalize send', async () => {
    const requestUrls: string[] = [];
    const order = buildEmptyPrescriptionOrder('000001', '2026-03-09T09:30:00');
    order.prescriptionSettings = [{ code: 'setting-1', name: 'settings', value: 'enabled' }];
    order.remarks = [{ code: 'remark-1', text: 'remark-text' }];
    order.rps = [
      {
        ...order.rps[0],
        rpId: 'rp-1',
        name: 'regular-rp',
        location: 'in',
        category: 'regular',
        usage: 'after meal',
        usageCode: '001000',
        daysOrTimes: '7',
        remark: 'take-after-meal',
        doctorComment: 'doctor-note',
        lowerDrugCode: 'lower-drug',
        claimComments: [{ id: 'rp-claim-1', code: '820100001', name: 'rp-comment', note: 'rp-note' }],
        drugs: [
          {
            rowId: 'drug-1',
            code: '620000001',
            name: 'drug-a',
            quantity: '3',
            unit: 'tablet',
            genericChangeAllowed: true,
            isGeneralNamePrescription: false,
            drugComment: 'drug-note',
            lowerUsageCode: 'lower-usage',
            claimComments: [],
            patientRequest: false,
          },
        ],
      },
    ];

    const prescriptionOrderResponse = {
      runId: 'RUN-RX-FETCH',
      found: true,
      order: {
        patientId: '000001',
        encounterDate: '2026-03-09',
        performDate: '2026-03-09',
        doctorComments: [{ text: 'doctor-note' }],
        prescriptionSettings: [{ code: 'setting-1', name: 'settings', value: 'enabled' }],
        remarks: [{ code: 'remark-1', text: 'remark-text' }],
        rps: [
          {
            rpNumber: 'rp-1',
            bundleName: 'regular-rp',
            medicalClass: '211',
            medicalClassNumber: '7',
            usageCode: '001000',
            usageName: 'after meal',
            remark: 'take-after-meal',
            doctorComment: 'doctor-note',
            started: '2026-03-09T09:30:00',
            lowerFields: { lowerDrugCode: 'lower-drug' },
            claimComments: [{ code: '820100001', text: 'rp-comment', note: 'rp-note' }],
            drugs: [
              {
                code: '620000001',
                name: 'drug-a',
                quantity: '3',
                unit: 'tablet',
                genericChangeAllowed: true,
                generalNamePrescription: false,
                drugComment: 'drug-note',
                lowerFields: { lowerUsageCode: 'lower-usage' },
                claimComments: [],
                patientRequested: false,
              },
            ],
          },
        ],
      },
    };

    vi.mocked(httpFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      requestUrls.push(url);
      if (url === '/api/orca/prescription-orders' && init?.method === 'POST') {
        return new Response(JSON.stringify({ runId: 'RUN-RX-SAVE', createdDocumentIds: [701] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('/api/orca/prescription-orders?')) {
        return new Response(JSON.stringify(prescriptionOrderResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('/api/orca/order/bundles?')) {
        return new Response(JSON.stringify({ runId: 'RUN-BUNDLES', patientId: '000001', recordsReturned: 0, bundles: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === '/api/orca/chart-support/medical-mod-v2') {
        return new Response(JSON.stringify({ runId: 'RUN-SEND-RX', traceId: 'TRACE-SEND-RX', apiResult: '00', apiResultMessage: 'OK' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`unexpected request: ${url}`);
    });

    expect((await savePrescriptionOrder({ patientId: '000001', order })).ok).toBe(true);
    expect((await fetchPrescriptionOrder({ patientId: '000001', from: '2026-03-09' })).ok).toBe(true);
    const fetchedBundles = await fetchMedicalModV2OrderBundles('000001', '2026-03-09');
    const prepared = prepareMedicalModV2SendData(fetchedBundles.bundles);

    expect(prepared.bundleIssues).toEqual([]);
    expect(prepared.medicalInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          medicalClass: '211',
          medicalClassNumber: '7',
          medications: expect.arrayContaining([
            expect.objectContaining({ code: '620000001', unit: 'tablet', name: 'drug-a' }),
            expect.objectContaining({ code: '820100001', name: 'rp-comment' }),
          ]),
        }),
      ]),
    );
    expect(requestUrls.some((url) => url.includes('/api/orca/order/bundles?') && url.includes('entity=medOrder'))).toBe(false);

    const payload = buildMedicalModV2RequestXml({
      patientId: '000001',
      performDate: '2026-03-09T09:30:00',
      departmentCode: '01',
      physicianCode: '10001',
      medicalInformation: prepared.medicalInformation,
    });
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('settings');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('remark-text');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('lower-drug');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('lower-usage');

    expect((await postOrcaMedicalModV2Xml(payload, { classCode: '01' })).ok).toBe(true);
  });
});
