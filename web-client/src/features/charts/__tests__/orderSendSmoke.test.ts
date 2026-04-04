import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'RUN-GEN'),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-META', traceId: 'TRACE-META' })),
  ensureObservabilityMeta: vi.fn(() => ({ runId: 'RUN-META', traceId: 'TRACE-META' })),
  updateObservabilityMeta: vi.fn(),
}));

import { httpFetch } from '../../../libs/http/httpClient';
import { buildMedicalModV2RequestXml, postOrcaMedicalModV2Xml } from '../orcaClaimApi';
import { fetchOrderBundles, mutateOrderBundles } from '../orderBundleApi';
import { fetchOrcaOrderInputSetDetail } from '../orcaOrderInputSetApi';
import { fetchMedicalModV2OrderBundles, prepareMedicalModV2SendData, toMedicalModV2InformationWithSource } from '../orderRpNormalization';
import { buildEmptyPrescriptionOrder, fetchPrescriptionOrder, savePrescriptionOrder } from '../prescriptionOrderApi';

describe('order send smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('input set detail save reload send smoke keeps testOrder admin local-only and multiple item comment rows', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            setCode: 'T60001',
            bundle: {
              entity: 'laboTest',
              sourceSetCode: 'T60001',
              bundleName: '採血セット',
              bundleNumber: '2',
              classCode: '600',
              classCodeSystem: 'Claim007',
              className: '検査',
              admin: '至急',
              adminMemo: '空腹時',
              memo: 'bundle memo',
              items: [
                { code: '160000010', name: '血算', quantity: '1', unit: '回', memo: 'item memo A', rowRole: 'main' },
                { code: '0085001', name: '採血注意', quantity: '', unit: '', memo: 'comment memo', rowRole: 'comment' },
                { code: '160000011', name: '生化学', quantity: '1', unit: '回', memo: 'item memo B', rowRole: 'main' },
              ],
            },
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
            runId: 'RUN-SAVE-TEST600',
            createdDocumentIds: [606],
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
            runId: 'RUN-FETCH-TEST600',
            patientId: '000001',
            bundles: [
              {
                entity: 'testOrder',
                bundleName: '採血セット',
                bundleNumber: '2',
                classCode: '600',
                classCodeSystem: 'Claim007',
                className: '検査',
                admin: '至急',
                adminMemo: '空腹時',
                memo: 'bundle memo',
                items: [
                  { code: '160000010', name: '血算', quantity: '1', unit: '回', memo: 'item memo A', rowRole: 'main' },
                  { code: '0085001', name: '採血注意', quantity: '', unit: '', memo: 'comment memo', rowRole: 'comment' },
                  { code: '160000011', name: '生化学', quantity: '1', unit: '回', memo: 'item memo B', rowRole: 'main' },
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
            runId: 'RUN-SEND-TEST600',
            traceId: 'TRACE-SEND-TEST600',
            apiResult: '00',
            apiResultMessage: 'OK',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const inputSet = await fetchOrcaOrderInputSetDetail({
      setCode: 'T60001',
      effective: '20260309',
      entity: 'testOrder',
    });
    expect(inputSet.ok).toBe(true);
    expect(inputSet.bundle?.entity).toBe('laboTest');

    await mutateOrderBundles({
      patientId: '000001',
      operations: [
        {
          operation: 'create',
          entity: 'testOrder',
          bundleName: inputSet.bundle?.bundleName,
          bundleNumber: inputSet.bundle?.bundleNumber,
          classCode: inputSet.bundle?.classCode,
          classCodeSystem: inputSet.bundle?.classCodeSystem,
          className: inputSet.bundle?.className,
          admin: inputSet.bundle?.admin,
          adminMemo: inputSet.bundle?.adminMemo,
          memo: inputSet.bundle?.memo,
          items: inputSet.bundle?.items as any,
        },
      ],
    });

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'testOrder' });
    expect(fetched.ok).toBe(true);
    expect(fetched.bundles[0]?.admin).toBe('至急');
    expect(fetched.bundles[0]?.adminMemo).toBe('空腹時');
    expect(fetched.bundles[0]?.memo).toBe('bundle memo');

    const prepared = prepareMedicalModV2SendData(fetched.bundles);
    expect(prepared.bundleIssues).toEqual([]);
    expect(prepared.medicalInformation[0]?.medications.map((item) => item.code)).toEqual([
      '160000010',
      '160000011',
      '0085001',
    ]);
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('至急');
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('空腹時');
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('bundle memo');
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('item memo');
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('"unit"');

    const payload = buildMedicalModV2RequestXml({
      patientId: '000001',
      performDate: '2026-03-09T09:30:00',
      departmentCode: '01',
      physicianCode: '10001',
      medicalInformation: prepared.medicalInformation,
    });

    expect(payload.medicalInformation?.[0]?.medications.map((item) => item.code)).toEqual([
      '160000010',
      '160000011',
      '0085001',
    ]);
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('"unit"');

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });

    expect(sendResult.ok).toBe(true);
    expect(httpFetch).toHaveBeenCalledTimes(4);
    const request = vi.mocked(httpFetch).mock.calls[3]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(request?.body ?? '{}')) as Record<string, any>;
    expect(body.medicalInformation[0]?.medications.map((item: Record<string, string>) => item.code)).toEqual([
      '160000010',
      '160000011',
      '0085001',
    ]);
    expect(JSON.stringify(body.medicalInformation)).not.toContain('至急');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('空腹時');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('bundle memo');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('item memo');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('"unit"');
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
                admin: '検査前説明',
                memo: 'local-radiology-memo',
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
          admin: '検査前説明',
          memo: 'local-radiology-memo',
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
              expect.objectContaining({ code: '002001' }),
              expect.objectContaining({ code: '170017510' }),
              expect.objectContaining({ code: '700000001' }),
              expect.objectContaining({ code: '0085001', name: 'CAUTION' }),
            ]),
          }),
        ]),
      );
    const radiologyMedicalInformation = payload.medicalInformation ?? [];
    expect(radiologyMedicalInformation[0]?.medications.map((item) => item.code)).toEqual([
      '002001',
      '170017510',
      '700000001',
      '0085001',
    ]);
    expect(JSON.stringify(radiologyMedicalInformation)).not.toContain('検査前説明');
    expect(JSON.stringify(radiologyMedicalInformation)).not.toContain('local-radiology-memo');
    expect(JSON.stringify(radiologyMedicalInformation)).not.toContain('local-item-memo');

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
              expect.objectContaining({ code: '002001' }),
              expect.objectContaining({ code: '170017510' }),
              expect.objectContaining({ code: '700000001' }),
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
    expect(JSON.stringify(body.medicalInformation)).not.toContain('検査前説明');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-radiology-memo');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-item-memo');
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
          medications: [expect.objectContaining({ code: '180000210' })],
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
          medications: [expect.objectContaining({ code: '180000210' })],
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
                admin: 'local-treatment-admin',
                memo: 'local-treatment-memo',
                bodyPart: { code: '002003', name: 'KNEE', quantity: '1', unit: 'PART', memo: '' },
                items: [
                  { code: '140000610', name: 'WOUND_CARE', quantity: '1', unit: 'times', memo: 'local-treatment-item-memo' },
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
          admin: 'local-treatment-admin',
          memo: 'local-treatment-memo',
          bodyPart: { code: '002003', name: 'KNEE', quantity: '1', unit: 'PART', memo: '' },
          items: [
            { code: '140000610', name: 'WOUND_CARE', quantity: '1', unit: 'times', memo: 'local-treatment-item-memo' },
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
              expect.objectContaining({ code: '002003' }),
              expect.objectContaining({ code: '140000610' }),
              expect.objectContaining({ code: '700000021' }),
              expect.objectContaining({ code: '0085002', name: 'COMMENT' }),
            ]),
          }),
        ]),
      );
    const treatmentMedicalInformation = payload.medicalInformation ?? [];
    expect(treatmentMedicalInformation[0]?.medications.map((item) => item.code)).toEqual([
      '002003',
      '140000610',
      '700000021',
      '0085002',
    ]);
    expect(JSON.stringify(treatmentMedicalInformation)).not.toContain('local-treatment-admin');
    expect(JSON.stringify(treatmentMedicalInformation)).not.toContain('local-treatment-memo');
    expect(JSON.stringify(treatmentMedicalInformation)).not.toContain('local-treatment-item-memo');

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
              expect.objectContaining({ code: '002003' }),
              expect.objectContaining({ code: '140000610' }),
              expect.objectContaining({ code: '700000021' }),
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
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-treatment-admin');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-treatment-memo');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-treatment-item-memo');
  });

  it('save fetch normalize smoke blocks bacteriaOrder before send when subtype is present', async () => {
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
      ;

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

    const prepared = prepareMedicalModV2SendData(fetched.bundles);

    expect(prepared.bundleIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported_bacteria_subtype',
          entity: 'bacteriaOrder',
        }),
      ]),
    );
    expect(httpFetch).toHaveBeenCalledTimes(2);
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
                memo: 'bundle-memo-a',
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
                memo: 'bundle-memo-b',
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
                memo: 'bundle-memo-c',
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
          memo: 'bundle-memo-a',
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
          memo: 'bundle-memo-b',
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
          memo: 'bundle-memo-c',
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
    ).toEqual([['main'], ['comment', 'main', 'main'], ['auxiliary', 'main']]);
    expect(JSON.stringify(saveBody.operations)).not.toContain('__orca_meta__:');

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'injectionOrder' });
    expect(fetched.ok).toBe(true);
    expect(fetched.bundles.map((bundle) => bundle.items.map((item) => item.rowRole))).toEqual([
      ['main'],
      ['comment', 'main', 'main'],
      ['auxiliary', 'main'],
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
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('bundle-memo-a');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('bundle-memo-b');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('bundle-memo-c');
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
    expect(JSON.stringify(body.medicalInformation)).not.toContain('ward-note');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('slow-drip');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('bundle-memo-a');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('bundle-memo-b');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('bundle-memo-c');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-a');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-b');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-c');
  });

  it('save fetch no-op save send smoke uses prescription-orders as medOrder source of truth', async () => {
    const requestUrls: string[] = [];
    const order = buildEmptyPrescriptionOrder('000001', '2026-03-09T09:30:00');
    order.prescriptionSettings = [{ code: 'setting-1', name: '院内設定', value: 'enabled' }];
    order.remarks = [{ code: 'remark-1', text: '院内備考' }];
    order.rps = [
      {
        ...order.rps[0],
        rpId: 'rp-1',
        name: '降圧薬RP',
        location: 'in',
        category: 'regular',
        usage: '毎食後',
        usageCode: '001000',
        daysOrTimes: '7',
        remark: '食後',
        doctorComment: '継続処方',
        lowerDrugCode: 'lower-drug',
        claimComments: [{ id: 'rp-claim-1', code: '820100001', name: 'RP患者希望', note: 'rp-note' }],
        drugs: [
          {
            rowId: 'drug-1',
            code: '620000001',
            name: '薬剤A',
            quantity: '3',
            unit: '錠',
            genericChangeAllowed: true,
            isGeneralNamePrescription: false,
            drugComment: '眠前注意',
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
        doctorComments: [{ text: '継続処方' }],
        prescriptionSettings: [{ code: 'setting-1', name: '院内設定', value: 'enabled' }],
        remarks: [{ code: 'remark-1', text: '院内備考' }],
        rps: [
          {
            rpNumber: 'rp-1',
            bundleName: '降圧薬RP',
            medicalClass: '211',
            medicalClassNumber: '7',
            usageCode: '001000',
            usageName: '毎食後',
            remark: '食後',
            doctorComment: '継続処方',
            started: '2026-03-09T09:30:00',
            lowerFields: { lowerDrugCode: 'lower-drug' },
            claimComments: [{ code: '820100001', text: 'RP患者希望', note: 'rp-note' }],
            drugs: [
              {
                code: '620000001',
                name: '薬剤A',
                quantity: '3',
                unit: '錠',
                genericChangeAllowed: true,
                generalNamePrescription: false,
                drugComment: '眠前注意',
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
        return new Response(
          JSON.stringify({
            runId: 'RUN-RX-SAVE',
            createdDocumentIds: [701],
            updatedDocumentIds: [],
            deletedDocumentIds: [],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (url.startsWith('/api/orca/prescription-orders?')) {
        return new Response(JSON.stringify(prescriptionOrderResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('/api/orca/order/bundles?')) {
        return new Response(
          JSON.stringify({
            runId: 'RUN-BUNDLES',
            patientId: '000001',
            recordsReturned: 0,
            bundles: [],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (url === '/api/orca/chart-support/medical-mod-v2') {
        return new Response(
          JSON.stringify({
            runId: 'RUN-SEND-RX',
            traceId: 'TRACE-SEND-RX',
            apiResult: '00',
            apiResultMessage: 'OK',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      throw new Error(`unexpected request: ${url}`);
    });

    const firstSave = await savePrescriptionOrder({ patientId: '000001', order });
    expect(firstSave.ok).toBe(true);
    const firstSaveRequest = vi.mocked(httpFetch).mock.calls[0]?.[1];
    const firstSaveBody = JSON.parse(String((firstSaveRequest as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;
    expect(firstSaveBody.prescriptionSettings).toEqual([{ code: 'setting-1', name: '院内設定', value: 'enabled' }]);
    expect(firstSaveBody.remarks).toEqual([{ code: 'remark-1', text: '院内備考' }]);
    expect(firstSaveBody.rps[0]).toEqual(
      expect.objectContaining({
        claimComments: expect.arrayContaining([
          expect.objectContaining({ code: '820100001', text: 'RP患者希望', note: 'rp-note' }),
        ]),
        lowerFields: { lowerDrugCode: 'lower-drug' },
      }),
    );
    expect(firstSaveBody.rps[0].drugs[0]).toEqual(
      expect.objectContaining({
        lowerFields: { lowerUsageCode: 'lower-usage' },
      }),
    );

    const fetched = await fetchPrescriptionOrder({ patientId: '000001', from: '2026-03-09' });
    expect(fetched.ok).toBe(true);
    expect(fetched.order.rps[0]?.drugs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: '620000001',
          name: '薬剤A',
          quantity: '3',
          unit: '錠',
          drugComment: '眠前注意',
          lowerUsageCode: 'lower-usage',
        }),
      ]),
    );
    expect(fetched.order.rps[0]?.claimComments).toEqual([
      expect.objectContaining({ code: '820100001', name: 'RP患者希望', note: 'rp-note' }),
    ]);
    expect(fetched.order.prescriptionSettings).toEqual([{ code: 'setting-1', name: '院内設定', value: 'enabled' }]);
    expect(fetched.order.remarks).toEqual([{ code: 'remark-1', text: '院内備考' }]);

    const secondSave = await savePrescriptionOrder({ patientId: '000001', order: fetched.order });
    expect(secondSave.ok).toBe(true);

    const fetchedBundles = await fetchMedicalModV2OrderBundles('000001', '2026-03-09');
    expect(fetchedBundles.errors).toEqual([]);
    expect(fetchedBundles.bundles.some((bundle) => bundle.entity === 'medOrder')).toBe(true);
    expect(requestUrls.some((url) => url.includes('/api/orca/order/bundles?') && url.includes('entity=medOrder'))).toBe(false);

    const prepared = prepareMedicalModV2SendData(fetchedBundles.bundles);
    expect(prepared.requiredIssues).toEqual([]);
    expect(prepared.bundleIssues).toEqual([]);
    expect(prepared.codeIssues).toEqual([]);
    expect(prepared.medicalInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          medicalClass: '211',
          medicalClassNumber: '7',
          medications: expect.arrayContaining([
            expect.objectContaining({ code: '620000001', name: '薬剤A' }),
            expect.objectContaining({ code: '820100001', name: 'RP患者希望' }),
          ]),
        }),
      ]),
    );

    const payload = buildMedicalModV2RequestXml({
      patientId: '000001',
      performDate: '2026-03-09T09:30:00',
      departmentCode: '01',
      physicianCode: '10001',
      medicalInformation: prepared.medicalInformation,
    });

    expect(payload.medicalInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          medicalClass: '211',
          medicalClassNumber: '7',
          medications: expect.arrayContaining([
            expect.objectContaining({ code: '620000001', name: '薬剤A' }),
          ]),
        }),
      ]),
    );
    expect(JSON.stringify(payload.medicalInformation)).toContain('RP患者希望');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('院内設定');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('院内備考');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('lower-drug');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('lower-usage');

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });
    expect(sendResult.ok).toBe(true);
    expect(requestUrls.filter((url) => url.startsWith('/api/orca/prescription-orders?'))).toHaveLength(2);
    expect(requestUrls.filter((url) => url === '/api/orca/prescription-orders')).toHaveLength(2);
  });
});
