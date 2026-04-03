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
import { toMedicalModV2InformationWithSource } from '../orderRpNormalization';

describe('order send smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('save fetch normalize send payload smoke keeps radiology row roles and class meta', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-SAVE',
            createdDocumentIds: [101],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-FETCH',
            patientId: '000001',
            bundles: [
              {
                entity: 'radiologyOrder',
                bundleName: 'CHESTCT',
                bundleNumber: '3',
                classCode: '700',
                classCodeSystem: 'Claim007',
                className: 'Radiology',
                bodyPart: { code: '002001', name: 'CHEST', quantity: '1', unit: 'PART', memo: '' },
                items: [
                  { code: '170017510', name: 'CT_SCAN', quantity: '1', unit: 'times', memo: '' },
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
        new Response(
          JSON.stringify({
            runId: 'RUN-SEND',
            traceId: 'TRACE-SEND',
            apiResult: '00',
            apiResultMessage: 'OK',
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
          entity: 'radiologyOrder',
          bundleName: 'CHESTCT',
          bundleNumber: '3',
          classCode: '700',
          classCodeSystem: 'Claim007',
          className: 'Radiology',
          bodyPart: { code: '002001', name: 'CHEST', quantity: '1', unit: 'PART', memo: '' },
            items: [
              { code: '170017510', name: 'CT_SCAN', quantity: '1', unit: 'times', memo: '' },
              { code: '700000001', name: 'CONTRAST', quantity: '1', unit: 'bottle', memo: '' },
              { code: '0085001', name: 'CAUTION', quantity: '', unit: '', memo: 'note' },
            ],
          },
      ],
    });

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'radiologyOrder' });
    expect(fetched.ok).toBe(true);

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

    expect(payload.medicalInformation).toEqual(
      expect.arrayContaining([
          expect.objectContaining({
            medicalClass: '700',
            medicalClassName: 'Radiology',
            medicalClassNumber: '3',
            medications: expect.arrayContaining([
              expect.objectContaining({ code: '002001', unit: 'PART' }),
              expect.objectContaining({ code: '170017510', unit: 'times' }),
              expect.objectContaining({ code: '700000001', unit: 'bottle' }),
              expect.objectContaining({ code: '0085001', name: 'CAUTION' }),
            ]),
          }),
        ]),
      );
    expect(payload.medicalInformation[0]?.medications.map((item) => item.code)).toEqual([
      '002001',
      '170017510',
      '700000001',
      '0085001',
    ]);

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });

    expect(sendResult.ok).toBe(true);
    expect(httpFetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(httpFetch).mock.calls[2]?.[0]).toBe('/api/orca/chart-support/medical-mod-v2');

    const request = vi.mocked(httpFetch).mock.calls[2]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(request?.body ?? '{}')) as Record<string, any>;
    expect(body.classCode).toBe('01');
    expect(body.medicalInformation).toEqual(
      expect.arrayContaining([
          expect.objectContaining({
            medicalClass: '700',
            medicalClassName: 'Radiology',
            medicalClassNumber: '3',
            medications: expect.arrayContaining([
              expect.objectContaining({ code: '002001', unit: 'PART' }),
              expect.objectContaining({ code: '170017510', unit: 'times' }),
              expect.objectContaining({ code: '700000001', unit: 'bottle' }),
              expect.objectContaining({ code: '0085001', name: 'CAUTION' }),
            ]),
          }),
        ]),
      );
    expect(body.medicalInformation[0]?.medications.map((item: Record<string, string>) => item.code)).toEqual([
      '002001',
      '170017510',
      '700000001',
      '0085001',
    ]);
  });
  it('save fetch normalize send smoke keeps otherOrder local fields out of medical payload', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-SAVE-OTHER',
            createdDocumentIds: [202],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-FETCH-OTHER',
            patientId: '000001',
            bundles: [
              {
                entity: 'otherOrder',
                bundleName: 'certificate-fee',
                bundleNumber: '4',
                classCode: '800',
                classCodeSystem: 'Claim007',
                className: 'Other',
                admin: 'local-admin-note',
                memo: 'local-free-memo',
                items: [{ code: '180000210', name: 'certificate-fee', quantity: '1', unit: 'times', memo: '' }],
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
        new Response(
          JSON.stringify({
            runId: 'RUN-SEND-OTHER',
            traceId: 'TRACE-SEND-OTHER',
            apiResult: '00',
            apiResultMessage: 'OK',
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
          entity: 'otherOrder',
          bundleName: 'certificate-fee',
          bundleNumber: '4',
          classCode: '800',
          classCodeSystem: 'Claim007',
          className: 'Other',
          admin: 'local-admin-note',
          memo: 'local-free-memo',
          items: [{ code: '180000210', name: 'certificate-fee', quantity: '1', unit: 'times', memo: '' }],
        },
      ],
    });

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'otherOrder' });
    expect(fetched.ok).toBe(true);

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

    expect(payload.medicalInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          medicalClass: '800',
          medicalClassName: 'Other',
          medicalClassNumber: '4',
          medications: [expect.objectContaining({ code: '180000210', unit: 'times' })],
        }),
      ]),
    );
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local-admin-note');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local-free-memo');

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });

    expect(sendResult.ok).toBe(true);
    expect(httpFetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(httpFetch).mock.calls[2]?.[0]).toBe('/api/orca/chart-support/medical-mod-v2');

    const request = vi.mocked(httpFetch).mock.calls[2]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(request?.body ?? '{}')) as Record<string, any>;
    expect(body.classCode).toBe('01');
    expect(body.medicalInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          medicalClass: '800',
          medicalClassName: 'Other',
          medicalClassNumber: '4',
          medications: [expect.objectContaining({ code: '180000210', unit: 'times' })],
        }),
      ]),
    );
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-admin-note');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-free-memo');
  });

  it('save fetch normalize send payload smoke keeps treatmentOrder bodyPart and class 400', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-SAVE-400',
            createdDocumentIds: [404],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-FETCH-400',
            patientId: '000001',
            bundles: [
              {
                entity: 'treatmentOrder',
                bundleName: 'wound-care',
                bundleNumber: '3',
                classCode: '400',
                classCodeSystem: 'Claim007',
                className: 'Treatment',
                bodyPart: { code: '002003', name: 'KNEE', quantity: '1', unit: 'PART', memo: '' },
                items: [
                  { code: '140000610', name: 'WOUND_CARE', quantity: '1', unit: 'times', memo: '' },
                  { code: '700000021', name: 'GAUZE', quantity: '2', unit: 'sheet', memo: '' },
                  { code: '0085002', name: 'COMMENT', quantity: '', unit: '', memo: 'after-cleaning' },
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
        new Response(
          JSON.stringify({
            runId: 'RUN-SEND-400',
            traceId: 'TRACE-SEND-400',
            apiResult: '00',
            apiResultMessage: 'OK',
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
          entity: 'treatmentOrder',
          bundleName: 'wound-care',
          bundleNumber: '3',
          classCode: '400',
          classCodeSystem: 'Claim007',
          className: 'Treatment',
          bodyPart: { code: '002003', name: 'KNEE', quantity: '1', unit: 'PART', memo: '' },
          items: [
            { code: '140000610', name: 'WOUND_CARE', quantity: '1', unit: 'times', memo: '' },
            { code: '700000021', name: 'GAUZE', quantity: '2', unit: 'sheet', memo: '' },
            { code: '0085002', name: 'COMMENT', quantity: '', unit: '', memo: 'after-cleaning' },
          ],
        },
      ],
    });

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'generalOrder' });
    expect(fetched.ok).toBe(true);
    expect(fetched.bundles[0]?.entity).toBe('treatmentOrder');

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

    expect(payload.medicalInformation).toEqual(
      expect.arrayContaining([
          expect.objectContaining({
            medicalClass: '400',
            medicalClassName: 'Treatment',
            medicalClassNumber: '3',
            medications: expect.arrayContaining([
              expect.objectContaining({ code: '002003', unit: 'PART' }),
              expect.objectContaining({ code: '140000610', unit: 'times' }),
              expect.objectContaining({ code: '700000021', unit: 'sheet' }),
              expect.objectContaining({ code: '0085002', name: 'COMMENT' }),
            ]),
          }),
        ]),
      );
    expect(payload.medicalInformation[0]?.medications.map((item) => item.code)).toEqual([
      '002003',
      '140000610',
      '700000021',
      '0085002',
    ]);

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });

    expect(sendResult.ok).toBe(true);
    expect(httpFetch).toHaveBeenCalledTimes(3);

    const request = vi.mocked(httpFetch).mock.calls[2]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(request?.body ?? '{}')) as Record<string, any>;
    expect(body.medicalInformation).toEqual(
      expect.arrayContaining([
          expect.objectContaining({
            medicalClass: '400',
            medicalClassName: 'Treatment',
            medicalClassNumber: '3',
            medications: expect.arrayContaining([
              expect.objectContaining({ code: '002003', unit: 'PART' }),
              expect.objectContaining({ code: '140000610', unit: 'times' }),
              expect.objectContaining({ code: '700000021', unit: 'sheet' }),
              expect.objectContaining({ code: '0085002', name: 'COMMENT' }),
            ]),
          }),
        ]),
      );
    expect(body.medicalInformation[0]?.medications.map((item: Record<string, string>) => item.code)).toEqual([
      '002003',
      '140000610',
      '700000021',
      '0085002',
    ]);
  });

  it('save fetch normalize send payload smoke keeps 600 subtype local-only', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-SAVE-600',
            createdDocumentIds: [303],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-FETCH-600',
            patientId: '000001',
            bundles: [
              {
                entity: 'bacteriaOrder',
                bundleName: 'bacteria bundle',
                bundleNumber: '6',
                subtype: 'culture',
                classCode: '600',
                classCodeSystem: 'Claim007',
                className: 'test class',
                adminMemo: 'local admin memo',
                memo: 'local memo',
                items: [{ code: '160000010', name: 'culture item', quantity: '1', unit: 'count', memo: '' }],
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
        new Response(
          JSON.stringify({
            runId: 'RUN-SEND-600',
            traceId: 'TRACE-SEND-600',
            apiResult: '00',
            apiResultMessage: 'OK',
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
          bundleName: 'bacteria bundle',
          bundleNumber: '6',
          subtype: 'culture',
          classCode: '600',
          classCodeSystem: 'Claim007',
          className: 'test class',
          adminMemo: 'local admin memo',
          memo: 'local memo',
          items: [{ code: '160000010', name: 'culture item', quantity: '1', unit: 'count', memo: '' }],
        },
      ],
    });

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'bacteriaOrder' });
    expect(fetched.ok).toBe(true);

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

    expect(payload.medicalInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          medicalClass: '600',
          medicalClassName: 'test class',
          medicalClassNumber: '6',
          medications: [expect.objectContaining({ code: '160000010', unit: 'count' })],
        }),
      ]),
    );
    expect(payload.medicalInformation[0]).not.toHaveProperty('subtype');
    expect(payload.medicalInformation[0]).not.toHaveProperty('adminMemo');
    expect(payload.medicalInformation[0]).not.toHaveProperty('memo');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local admin memo');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local memo');

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });

    expect(sendResult.ok).toBe(true);
    expect(httpFetch).toHaveBeenCalledTimes(3);
  });

  it('save fetch normalize send payload smoke keeps injection rowRole patterns and drops local-only fields', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-SAVE-INJECTION',
            createdDocumentIds: [404],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-FETCH-INJECTION',
            patientId: '000001',
            bundles: [
              {
                entity: 'injectionOrder',
                bundleName: 'drug-only',
                bundleNumber: '1',
                classCode: '310',
                classCodeSystem: 'Claim007',
                className: 'Injection',
                admin: '静注',
                adminCode: '4101',
                adminMemo: '20ml/h',
                items: [
                  { code: '620000010', name: 'DRUG_A', quantity: '1', unit: 'ampoule', memo: '', userComment: 'local-a', rowRole: 'main' },
                ],
              },
              {
                entity: 'injectionOrder',
                bundleName: 'procedure-drug',
                bundleNumber: '2',
                classCode: '310',
                classCodeSystem: 'Claim007',
                className: 'Injection',
                admin: '筋注',
                adminCode: '4102',
                adminMemo: 'ward-note',
                items: [
                  { code: '0085001', name: 'COMMENT', quantity: '', unit: '', memo: 'after-procedure', rowRole: 'comment' },
                  { code: '830000001', name: 'PROCEDURE', quantity: '1', unit: 'times', memo: '', rowRole: 'main' },
                  { code: '620000011', name: 'DRUG_B', quantity: '1', unit: 'ampoule', memo: '', userComment: 'local-b', rowRole: 'main' },
                ],
              },
              {
                entity: 'injectionOrder',
                bundleName: 'drip-set',
                bundleNumber: '3',
                classCode: '310',
                classCodeSystem: 'Claim007',
                className: 'Injection',
                admin: '点滴',
                adminCode: '4103',
                adminMemo: 'slow-drip',
                items: [
                  { code: '700000031', name: 'DRIP_SET', quantity: '1', unit: 'set', memo: '', rowRole: 'material' },
                  { code: '620000012', name: 'DRUG_C', quantity: '1', unit: 'ampoule', memo: '', userComment: 'local-c', rowRole: 'main' },
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
        new Response(
          JSON.stringify({
            runId: 'RUN-SEND-INJECTION',
            traceId: 'TRACE-SEND-INJECTION',
            apiResult: '00',
            apiResultMessage: 'OK',
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
          entity: 'injectionOrder',
          bundleName: 'drug-only',
          bundleNumber: '1',
          classCode: '310',
          classCodeSystem: 'Claim007',
          className: 'Injection',
          admin: '静注',
          adminCode: '4101',
          adminMemo: '20ml/h',
          items: [{ code: '620000010', name: 'DRUG_A', quantity: '1', unit: 'ampoule', memo: '', userComment: 'local-a', rowRole: 'main' }],
        },
        {
          operation: 'create',
          entity: 'injectionOrder',
          bundleName: 'procedure-drug',
          bundleNumber: '2',
          classCode: '310',
          classCodeSystem: 'Claim007',
          className: 'Injection',
          admin: '筋注',
          adminCode: '4102',
          adminMemo: 'ward-note',
          items: [
            { code: '0085001', name: 'COMMENT', quantity: '', unit: '', memo: 'after-procedure', rowRole: 'comment' },
            { code: '830000001', name: 'PROCEDURE', quantity: '1', unit: 'times', memo: '', rowRole: 'main' },
            { code: '620000011', name: 'DRUG_B', quantity: '1', unit: 'ampoule', memo: '', userComment: 'local-b', rowRole: 'main' },
          ],
        },
        {
          operation: 'create',
          entity: 'injectionOrder',
          bundleName: 'drip-set',
          bundleNumber: '3',
          classCode: '310',
          classCodeSystem: 'Claim007',
          className: 'Injection',
          admin: '点滴',
          adminCode: '4103',
          adminMemo: 'slow-drip',
          items: [
            { code: '700000031', name: 'DRIP_SET', quantity: '1', unit: 'set', memo: '', rowRole: 'material' },
            { code: '620000012', name: 'DRUG_C', quantity: '1', unit: 'ampoule', memo: '', userComment: 'local-c', rowRole: 'main' },
          ],
        },
      ],
    });

    const saveRequest = vi.mocked(httpFetch).mock.calls[0]?.[1] as RequestInit | undefined;
    const saveBody = JSON.parse(String(saveRequest?.body ?? '{}')) as Record<string, any>;
    expect(
      saveBody.operations.map((entry: Record<string, any>) => entry.items.map((item: Record<string, string>) => item.rowRole)),
    ).toEqual([['main'], ['comment', 'main', 'main'], ['material', 'main']]);
    expect(JSON.stringify(saveBody.operations)).not.toContain('__orca_meta__:');

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'injectionOrder' });
    expect(fetched.ok).toBe(true);
    expect(fetched.bundles.map((bundle) => bundle.items.map((item) => item.rowRole))).toEqual([
      ['main'],
      ['comment', 'main', 'main'],
      ['material', 'main'],
    ]);
    expect(fetched.bundles[1]?.items[2]?.userComment).toBe('local-b');
    expect(fetched.bundles[1]?.items[2]?.memo).toBe('');

    const normalized = fetched.bundles
      .map((bundle) => toMedicalModV2InformationWithSource(bundle))
      .filter((entry): entry is NonNullable<ReturnType<typeof toMedicalModV2InformationWithSource>> => Boolean(entry));

    expect(normalized.map((entry) => entry.info.medications.map((item) => item.code))).toEqual([
      ['4101', '620000010'],
      ['4102', '830000001', '620000011', '0085001'],
      ['4103', '620000012', '700000031'],
    ]);

    const payload = buildMedicalModV2RequestXml({
      patientId: '000001',
      performDate: '2026-03-09T09:30:00',
      departmentCode: '01',
      physicianCode: '10001',
      medicalInformation: normalized.map((entry) => entry.info),
    });

    expect(payload.medicalInformation?.map((entry) => entry.medications.map((item) => item.code))).toEqual([
      ['4101', '620000010'],
      ['4102', '830000001', '620000011', '0085001'],
      ['4103', '620000012', '700000031'],
    ]);
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('20ml/h');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('ward-note');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('slow-drip');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local-a');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local-b');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local-c');

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });

    expect(sendResult.ok).toBe(true);
    expect(httpFetch).toHaveBeenCalledTimes(3);

    const request = vi.mocked(httpFetch).mock.calls[2]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(request?.body ?? '{}')) as Record<string, any>;
    expect(body.medicalInformation.map((entry: Record<string, any>) => entry.medications.map((item: Record<string, string>) => item.code))).toEqual([
      ['4101', '620000010'],
      ['4102', '830000001', '620000011', '0085001'],
      ['4103', '620000012', '700000031'],
    ]);
    expect(JSON.stringify(body.medicalInformation)).not.toContain('20ml/h');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-a');
  });
});
