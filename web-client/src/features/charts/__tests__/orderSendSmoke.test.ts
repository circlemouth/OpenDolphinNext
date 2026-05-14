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
import {
  buildMedicalModV2BlockNotice,
  fetchMedicalModV2OrderBundles,
  prepareMedicalModV2SendData,
  toMedicalModV2InformationWithSource,
} from '../orderRpNormalization';
import { buildEmptyPrescriptionOrder, fetchPrescriptionOrder, savePrescriptionOrder } from '../prescriptionOrderApi';

const buildInjectionAdminCode = (suffix: 1 | 2 | 3) => `410${suffix}`;

describe('order send smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(httpFetch).mockReset();
  });

  it('input set detail save reload send smoke keeps testOrder admin local-only and multiple item comment rows', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            setCode: 'T60001',
            bundle: {
              entity: 'testOrder',
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
    expect(inputSet.bundle?.entity).toBe('testOrder');

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
      encounterContext: {
        patientId: '000001',
        visitDate: '2026-03-09T09:30:00',
        departmentCode: '01',
        physicianCode: '10001',
        insuranceCombinationNumber: '0001',
        voucherNumber: '1234',
        sequentialNumber: '1',
      },
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
                className: '画像診断',
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
          className: '画像診断',
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
      encounterContext: {
        patientId: '000001',
        visitDate: '2026-03-09T09:30:00',
        departmentCode: '01',
        physicianCode: '10001',
        insuranceCombinationNumber: '0001',
        voucherNumber: '1234',
        sequentialNumber: '1',
      },
      medicalInformation: normalized.map((entry) => entry.info),
    });

    expect(payload.medicalInformation).toEqual(
      expect.arrayContaining([
          expect.objectContaining({
            medicalClass: '700',
            medicalClassName: '画像診断',
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
    expect(vi.mocked(httpFetch).mock.calls[2]?.[0]).toBe('/api/orca/official/chart-support/medical-mod-v2');

    const request = vi.mocked(httpFetch).mock.calls[2]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(request?.body ?? '{}')) as Record<string, any>;
    expect(body.classCode).toBe('01');
    expect(body.medicalInformation).toEqual(
      expect.arrayContaining([
          expect.objectContaining({
            medicalClass: '700',
            medicalClassName: '画像診断',
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
  it('save fetch normalize send smoke blocks otherOrder as explicit local-only contract', async () => {
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
                admin: 'local-admin-note',
                memo: 'local-free-memo',
                items: [{ code: 'LOCAL_OTHER:CERTIFICATE_FEE', name: 'certificate-fee', quantity: '1', unit: 'times', memo: '' }],
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
          entity: 'otherOrder',
          bundleName: 'certificate-fee',
          bundleNumber: '4',
          admin: 'local-admin-note',
          memo: 'local-free-memo',
          items: [{ code: 'LOCAL_OTHER:CERTIFICATE_FEE', name: 'certificate-fee', quantity: '1', unit: 'times', memo: '' }],
        },
      ],
    });

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'otherOrder' });
    expect(fetched.ok).toBe(true);
    expect(fetched.bundles[0]).toEqual(
      expect.objectContaining({
        entity: 'otherOrder',
        bundleName: 'certificate-fee',
        admin: 'local-admin-note',
        memo: 'local-free-memo',
      }),
    );
    expect(fetched.bundles[0]?.classCode).toBeUndefined();
    expect(fetched.bundles[0]?.classCodeSystem).toBeUndefined();
    expect(fetched.bundles[0]?.className).toBeUndefined();

    const prepared = prepareMedicalModV2SendData(fetched.bundles);
    const blockNotice = buildMedicalModV2BlockNotice(prepared);

    expect(prepared.bundleIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid_other_order_class',
          entity: 'otherOrder',
        }),
      ]),
    );
    expect(prepared.medicalInformation).toEqual([]);
    expect(blockNotice?.message).toContain('ORCA送信を停止');
    expect(blockNotice?.nextAction).toContain('コードなし行');
    expect(httpFetch).toHaveBeenCalledTimes(2);
  });

  it('save fetch normalize send payload smoke keeps treatmentOrder class 400 and rejects resurrected 002 bodyPart from fetched bundle', async () => {
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
                className: '処置',
                bodyPart: { code: '002001', name: '膝関節', quantity: '1', unit: '部位', memo: 'local-treatment-body-part' },
                admin: 'local-treatment-admin',
                memo: 'local-treatment-memo',
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
          className: '処置',
          admin: 'local-treatment-admin',
          memo: 'local-treatment-memo',
          items: [
            { code: '140000610', name: 'WOUND_CARE', quantity: '1', unit: 'times', memo: 'local-treatment-item-memo' },
            { code: '700000021', name: 'GAUZE', quantity: '2', unit: 'sheet', memo: '' },
            { code: '0085002', name: 'COMMENT', quantity: '', unit: '', memo: 'after-cleaning' },
          ],
        },
      ],
    });

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'treatmentOrder' });
    expect(fetched.ok).toBe(true);
    expect(fetched.bundles[0]?.entity).toBe('treatmentOrder');
    expect(fetched.bundles[0]?.bodyPart).toBeUndefined();

    const normalized = fetched.bundles
      .map((bundle) => toMedicalModV2InformationWithSource(bundle))
      .filter((entry): entry is NonNullable<ReturnType<typeof toMedicalModV2InformationWithSource>> => Boolean(entry));

    const payload = buildMedicalModV2RequestXml({
      encounterContext: {
        patientId: '000001',
        visitDate: '2026-03-09T09:30:00',
        departmentCode: '01',
        physicianCode: '10001',
        insuranceCombinationNumber: '0001',
        voucherNumber: '1234',
        sequentialNumber: '1',
      },
      medicalInformation: normalized.map((entry) => entry.info),
    });

    expect(payload.medicalInformation).toEqual(
      expect.arrayContaining([
          expect.objectContaining({
            medicalClass: '400',
            medicalClassName: '処置',
            medicalClassNumber: '3',
            medications: expect.arrayContaining([
              expect.objectContaining({ code: '140000610' }),
              expect.objectContaining({ code: '700000021' }),
              expect.objectContaining({ code: '0085002', name: 'COMMENT' }),
            ]),
          }),
        ]),
      );
    const treatmentMedicalInformation = payload.medicalInformation ?? [];
    expect(treatmentMedicalInformation[0]?.medications.map((item) => item.code)).toEqual([
      '140000610',
      '700000021',
      '0085002',
    ]);
    expect(JSON.stringify(treatmentMedicalInformation)).not.toContain('local-treatment-admin');
    expect(JSON.stringify(treatmentMedicalInformation)).not.toContain('local-treatment-memo');
    expect(JSON.stringify(treatmentMedicalInformation)).not.toContain('local-treatment-item-memo');
    expect(JSON.stringify(treatmentMedicalInformation)).not.toContain('002001');

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });

    expect(sendResult.ok).toBe(true);
    expect(httpFetch).toHaveBeenCalledTimes(3);

    const request = vi.mocked(httpFetch).mock.calls[2]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(request?.body ?? '{}')) as Record<string, any>;
    expect(body.medicalInformation).toEqual(
      expect.arrayContaining([
          expect.objectContaining({
            medicalClass: '400',
            medicalClassName: '処置',
            medicalClassNumber: '3',
            medications: expect.arrayContaining([
              expect.objectContaining({ code: '140000610' }),
              expect.objectContaining({ code: '700000021' }),
              expect.objectContaining({ code: '0085002', name: 'COMMENT' }),
            ]),
          }),
        ]),
      );
    expect(body.medicalInformation[0]?.medications.map((item: Record<string, string>) => item.code)).toEqual([
      '140000610',
      '700000021',
      '0085002',
    ]);
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-treatment-admin');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-treatment-memo');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-treatment-item-memo');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('002001');
  });

  it('save fetch normalize send payload smoke keeps charge class meta stable and drops local-only fields', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-SAVE-CHARGE',
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
            runId: 'RUN-FETCH-CHARGE',
            patientId: '000001',
            bundles: [
              {
                entity: 'baseChargeOrder',
                sourceSetCode: 'B12001',
                bundleName: '再診料セット',
                bundleNumber: '2',
                classCode: '120',
                classCodeSystem: 'Claim007',
                className: 'bundle fallback should not survive',
                admin: 'local charge admin',
                adminMemo: 'local charge admin memo',
                memo: 'local charge memo',
                items: [
                  {
                    code: '120000110',
                    name: '再診料',
                    quantity: '1',
                    unit: '回',
                    memo: 'item memo',
                    masterCategory: '120',
                  },
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
            runId: 'RUN-SEND-CHARGE',
            traceId: 'TRACE-SEND-CHARGE',
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
          entity: 'baseChargeOrder',
          sourceSetCode: 'B12001',
          bundleName: '再診料セット',
          bundleNumber: '2',
          classCode: '120',
          classCodeSystem: 'Claim007',
          className: '基本診療料',
          admin: 'local charge admin',
          adminMemo: 'local charge admin memo',
          memo: 'local charge memo',
          items: [{ code: '120000110', name: '再診料', quantity: '1', unit: '回', memo: 'item memo', masterCategory: '120' }],
        } as any,
      ],
    });

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'baseChargeOrder' });
    expect(fetched.ok).toBe(true);
    expect(fetched.bundles[0]?.classCode).toBe('120');
    expect(fetched.bundles[0]?.className).toBe('基本診療料');
    expect(fetched.bundles[0]?.sourceSetCode).toBe('B12001');
    expect(fetched.bundles[0]?.adminMemo).toBe('local charge admin memo');
    expect(fetched.bundles[0]?.memo).toBe('local charge memo');

    const prepared = prepareMedicalModV2SendData(fetched.bundles);
    expect(prepared.bundleIssues).toEqual([]);
    expect(prepared.medicalInformation[0]).toEqual(
      expect.objectContaining({
        medicalClass: '120',
        medicalClassName: '基本診療料',
        medicalClassNumber: '2',
      }),
    );
    expect(prepared.medicalInformation[0]?.medications).toEqual([
      expect.objectContaining({
        code: '120000110',
        name: '再診料',
        number: '1',
      }),
    ]);
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('B12001');
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('local charge admin');
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('local charge admin memo');
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('local charge memo');
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('item memo');
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('"unit"');

    const payload = buildMedicalModV2RequestXml({
      encounterContext: {
        patientId: '000001',
        visitDate: '2026-03-09T09:30:00',
        departmentCode: '01',
        physicianCode: '10001',
        insuranceCombinationNumber: '0001',
        voucherNumber: '1234',
        sequentialNumber: '1',
      },
      medicalInformation: prepared.medicalInformation,
    });

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });

    expect(sendResult.ok).toBe(true);
    expect(httpFetch).toHaveBeenCalledTimes(3);
    const request = vi.mocked(httpFetch).mock.calls[2]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(request?.body ?? '{}')) as Record<string, any>;
    expect(body.medicalInformation[0]).toEqual(
      expect.objectContaining({
        medicalClass: '120',
        medicalClassName: '基本診療料',
        medicalClassNumber: '2',
      }),
    );
    expect(body.medicalInformation[0]?.medications).toEqual([
      expect.objectContaining({
        code: '120000110',
        name: '再診料',
        number: '1',
      }),
    ]);
    expect(JSON.stringify(body.medicalInformation)).not.toContain('B12001');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local charge admin');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local charge admin memo');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local charge memo');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('item memo');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('"unit"');
  });

  it('prepareMedicalModV2SendData blocks selection comment parameters that medicalmodv2 cannot carry', () => {
    const prepared = prepareMedicalModV2SendData([
      {
        entity: 'baseChargeOrder',
        bundleName: 'parameterized charge',
        bundleNumber: '1',
        classCode: '120',
        classCodeSystem: 'Claim007',
        className: '基本診療料',
        items: [
          {
            code: '120000110',
            name: '再診料',
            quantity: '1',
            unit: '回',
            memo: '',
            masterCategory: '120',
          },
          {
            code: '850100106',
            name: '往診又は訪問診療年月日（在医総管）',
            quantity: '1',
            unit: '',
            memo: '',
            selectionCommentItemNumber: '0166',
            selectionCommentItemNumberBranch: '01',
          },
        ],
      },
    ] as any);

    expect(prepared.bundleIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported_selection_comment_parameter',
          entity: 'baseChargeOrder',
        }),
      ]),
    );
    expect(buildMedicalModV2BlockNotice(prepared)?.nextAction).toContain('official medicalmodv2 carrier');
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
          code: 'unsupported_bacteria_order',
          entity: 'bacteriaOrder',
        }),
      ]),
    );
    expect(httpFetch).toHaveBeenCalledTimes(2);
  });

  it('save fetch normalize smoke blocks physiologyOrder before send and keeps save/display continuity', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            setCode: 'P60001',
            bundle: {
              entity: 'physiologyOrder',
              sourceSetCode: 'P60001',
              bundleName: '生理検査セット',
              bundleNumber: '7',
              subtype: 'physiology',
              classCode: '600',
              classCodeSystem: 'Claim007',
              className: '検査',
              admin: '至急',
              adminMemo: '安静条件',
              memo: 'bundle memo',
              items: [{ code: '160000090', name: '生理検査A', quantity: '1', unit: '回', memo: '' }],
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
            runId: 'RUN-SAVE-PHYSIOLOGY',
            createdDocumentIds: [505],
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
            runId: 'RUN-FETCH-PHYSIOLOGY',
            patientId: '000001',
            bundles: [
              {
                entity: 'physiologyOrder',
                bundleName: '生理検査セット',
                bundleNumber: '7',
                subtype: 'physiology',
                classCode: '600',
                classCodeSystem: 'Claim007',
                className: '検査',
                admin: '至急',
                adminMemo: '安静条件',
                memo: 'bundle memo',
                items: [{ code: '160000090', name: '生理検査A', quantity: '1', unit: '回', memo: '' }],
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const inputSet = await fetchOrcaOrderInputSetDetail({
      setCode: 'P60001',
      effective: '20260309',
      entity: 'physiologyOrder',
    });
    expect(inputSet.ok).toBe(true);
    expect(inputSet.bundle?.entity).toBe('physiologyOrder');
    expect(inputSet.bundle?.subtype).toBe('physiology');

    await mutateOrderBundles({
      patientId: '000001',
      operations: [
        {
          operation: 'create',
          entity: 'physiologyOrder',
          subtype: inputSet.bundle?.subtype,
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

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'physiologyOrder' });
    expect(fetched.ok).toBe(true);
    expect(fetched.bundles[0]?.entity).toBe('physiologyOrder');
    expect(fetched.bundles[0]?.subtype).toBe('physiology');
    expect(fetched.bundles[0]?.admin).toBe('至急');
    expect(fetched.bundles[0]?.adminMemo).toBe('安静条件');
    expect(fetched.bundles[0]?.memo).toBe('bundle memo');

    const prepared = prepareMedicalModV2SendData(fetched.bundles);
    expect(prepared.bundleIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'physiologyOrder',
          detail: expect.stringMatching(/(physiology|生理|送信|block|停止)/),
        }),
      ]),
    );
    expect(buildMedicalModV2BlockNotice(prepared)).not.toBeNull();
    expect(buildMedicalModV2BlockNotice(prepared)?.message).toMatch(/(physiology|生理)/);
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
                className: '注射',
                admin: '静注',
                adminCode: buildInjectionAdminCode(1),
                adminMemo: '',
                memo: 'bundle-memo-a',
                items: [
                  { code: '620000010', name: 'DRUG_A', quantity: '1', unit: 'ampoule', memo: '', genericFlg: 'yes', userComment: 'local-a', rowRole: 'main' },
                ],
              },
              {
                entity: 'injectionOrder',
                bundleName: 'procedure-drug',
                bundleNumber: '2',
                classCode: '310',
                classCodeSystem: 'Claim007',
                className: '注射',
                admin: '筋注',
                adminCode: buildInjectionAdminCode(2),
                adminMemo: '',
                memo: 'bundle-memo-b',
                items: [
                  { code: '0085001', name: 'COMMENT', quantity: '', unit: '', memo: 'after-procedure', rowRole: 'comment' },
                  { code: '830000001', name: 'PROCEDURE', quantity: '1', unit: 'times', memo: '', rowRole: 'main' },
                  { code: '620000011', name: 'DRUG_B', quantity: '1', unit: 'ampoule', memo: '', genericFlg: 'no', userComment: 'local-b', rowRole: 'main' },
                ],
              },
              {
                entity: 'injectionOrder',
                bundleName: 'drip-set',
                bundleNumber: '3',
                classCode: '310',
                classCodeSystem: 'Claim007',
                className: '注射',
                admin: '点滴',
                adminCode: buildInjectionAdminCode(3),
                adminMemo: '',
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
          className: '注射',
          admin: '静注',
          adminCode: buildInjectionAdminCode(1),
          adminMemo: '',
          memo: 'bundle-memo-a',
          items: [{ code: '620000010', name: 'DRUG_A', quantity: '1', unit: 'ampoule', memo: '', genericFlg: 'yes', userComment: 'local-a', rowRole: 'main' }],
        },
        {
          operation: 'create',
          entity: 'injectionOrder',
          bundleName: 'procedure-drug',
          bundleNumber: '2',
          classCode: '310',
          classCodeSystem: 'Claim007',
          className: '注射',
          admin: '筋注',
          adminCode: buildInjectionAdminCode(2),
          adminMemo: '',
          memo: 'bundle-memo-b',
          items: [
            { code: '0085001', name: 'COMMENT', quantity: '', unit: '', memo: 'after-procedure', rowRole: 'comment' },
            { code: '830000001', name: 'PROCEDURE', quantity: '1', unit: 'times', memo: '', rowRole: 'main' },
            { code: '620000011', name: 'DRUG_B', quantity: '1', unit: 'ampoule', memo: '', genericFlg: 'no', userComment: 'local-b', rowRole: 'main' },
          ],
        },
        {
          operation: 'create',
          entity: 'injectionOrder',
          bundleName: 'drip-set',
          bundleNumber: '3',
          classCode: '310',
          classCodeSystem: 'Claim007',
          className: '注射',
          admin: '点滴',
          adminCode: buildInjectionAdminCode(3),
          adminMemo: '',
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
    ).toEqual([['main'], ['comment', 'main', 'main'], ['material', 'main']]);
    expect(saveBody.operations[0]?.items[0]?.genericFlg).toBe('yes');
    expect(saveBody.operations[1]?.items[2]?.genericFlg).toBe('no');
    expect(JSON.stringify(saveBody.operations)).not.toContain('__orca_meta__:');

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'injectionOrder' });
    expect(fetched.ok).toBe(true);
    expect(fetched.bundles.map((bundle) => bundle.items.map((item) => item.rowRole))).toEqual([
      ['main'],
      ['comment', 'main', 'main'],
      ['material', 'main'],
    ]);
    expect(fetched.bundles[1]?.items[2]?.userComment).toBe('local-b');
    expect(fetched.bundles[0]?.items[0]?.genericFlg).toBe('yes');
    expect(fetched.bundles[1]?.items[2]?.genericFlg).toBe('no');
    expect(fetched.bundles[1]?.items[2]?.memo).toBe('');

    const normalized = fetched.bundles
      .map((bundle) => toMedicalModV2InformationWithSource(bundle))
      .filter((entry): entry is NonNullable<ReturnType<typeof toMedicalModV2InformationWithSource>> => Boolean(entry));

    expect(normalized.map((entry) => entry.info.medications.map((item) => item.code))).toEqual([
      ['620000010'],
      ['830000001', '620000011', '0085001'],
      ['620000012', '700000031'],
    ]);
    expect(normalized[0]?.info.medications[0]?.genericFlg).toBe('yes');
    expect(normalized[1]?.info.medications[1]?.genericFlg).toBe('no');
    expect(JSON.stringify(normalized.map((entry) => entry.info))).not.toContain(buildInjectionAdminCode(1));
    expect(JSON.stringify(normalized.map((entry) => entry.info))).not.toContain(buildInjectionAdminCode(2));
    expect(JSON.stringify(normalized.map((entry) => entry.info))).not.toContain(buildInjectionAdminCode(3));
    expect(normalized.map((entry) => entry.source.adminCode)).toEqual([
      buildInjectionAdminCode(1),
      buildInjectionAdminCode(2),
      buildInjectionAdminCode(3),
    ]);

    const payload = buildMedicalModV2RequestXml({
      encounterContext: {
        patientId: '000001',
        visitDate: '2026-03-09T09:30:00',
        departmentCode: '01',
        physicianCode: '10001',
        insuranceCombinationNumber: '0001',
        voucherNumber: '1234',
        sequentialNumber: '1',
      },
      medicalInformation: normalized.map((entry) => entry.info),
    });

    expect(payload.medicalInformation?.map((entry) => entry.medications.map((item) => item.code))).toEqual([
      ['620000010'],
      ['830000001', '620000011', '0085001'],
      ['620000012', '700000031'],
    ]);
    expect(payload.medicalInformation?.[0]?.medications[0]?.genericFlg).toBe('yes');
    expect(payload.medicalInformation?.[1]?.medications[1]?.genericFlg).toBe('no');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('bundle-memo-a');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('bundle-memo-b');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('bundle-memo-c');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local-a');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local-b');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local-c');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain(buildInjectionAdminCode(1));
    expect(JSON.stringify(payload.medicalInformation)).not.toContain(buildInjectionAdminCode(2));
    expect(JSON.stringify(payload.medicalInformation)).not.toContain(buildInjectionAdminCode(3));

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });

    expect(sendResult.ok).toBe(true);
    expect(httpFetch).toHaveBeenCalledTimes(3);

    const request = vi.mocked(httpFetch).mock.calls[2]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(request?.body ?? '{}')) as Record<string, any>;
    expect(body.medicalInformation.map((entry: Record<string, any>) => entry.medications.map((item: Record<string, string>) => item.code))).toEqual([
      ['620000010'],
      ['830000001', '620000011', '0085001'],
      ['620000012', '700000031'],
    ]);
    expect(body.medicalInformation[0]?.medications[0]?.genericFlg).toBe('yes');
    expect(body.medicalInformation[1]?.medications[1]?.genericFlg).toBe('no');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('bundle-memo-a');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('bundle-memo-b');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('bundle-memo-c');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-a');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-b');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('local-c');
    expect(JSON.stringify(body.medicalInformation)).not.toContain(buildInjectionAdminCode(1));
    expect(JSON.stringify(body.medicalInformation)).not.toContain(buildInjectionAdminCode(2));
    expect(JSON.stringify(body.medicalInformation)).not.toContain(buildInjectionAdminCode(3));
  });

  it('save fetch no-op save send smoke uses prescription-orders as medOrder source of truth', async () => {
    const requestUrls: string[] = [];
    const order = buildEmptyPrescriptionOrder('000001', '2026-03-09T09:30:00', 'F001:E900');
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
            numberCode: '001',
            numberCodeSystem: 'urn:orca:number',
            numberCodeName: 'number-name',
            genericChangeAllowed: false,
            isGeneralNamePrescription: true,
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
        encounterId: 'F001:E900',
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
                numberCode: '001',
                numberCodeSystem: 'urn:orca:number',
                numberCodeName: 'number-name',
                genericChangeAllowed: false,
                generalNamePrescription: true,
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
      if (url === '/api/local/prescription-orders/authority' && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            runId: 'RUN-RX-SAVE',
            prescriptionId: 701,
            revisionId: 801,
            status: 'DRAFT',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (url.startsWith('/api/local/prescription-orders?')) {
        return new Response(JSON.stringify(prescriptionOrderResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('/api/local/order/bundles?')) {
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
      if (url === '/api/orca/official/chart-support/medical-mod-v2') {
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
    const firstSaveEnvelope = JSON.parse(String((firstSaveRequest as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;
    const firstSaveBody = (firstSaveEnvelope.order ?? {}) as Record<string, any>;
    expect(firstSaveEnvelope.patientId).toBe('000001');
    expect(firstSaveEnvelope.encounterId).toBe('F001:E900');
    expect(firstSaveBody.encounterId).toBe('F001:E900');
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
        numberCode: '001',
        numberCodeSystem: 'urn:orca:number',
        numberCodeName: 'number-name',
        genericChangeAllowed: false,
        generalNamePrescription: true,
        lowerFields: { lowerUsageCode: 'lower-usage' },
      }),
    );

    const fetched = await fetchPrescriptionOrder({ patientId: '000001', from: '2026-03-09', encounterId: 'F001:E900' });
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
    expect(
      requestUrls.some(
        (url) =>
          url.startsWith('/api/local/prescription-orders?') &&
          url.includes('patientId=000001') &&
          url.includes('encounterDate=2026-03-09') &&
          url.includes('encounterId=F001%3AE900'),
      ),
    ).toBe(true);
    expect(fetched.order.encounterId).toBe('F001:E900');
    expect(fetched.order.rps[0]?.drugs[0]).toMatchObject({
      code: '620000001',
      name: '薬剤A',
      quantity: '3',
      unit: '錠',
      drugComment: '眠前注意',
      numberCode: '001',
      numberCodeSystem: 'urn:orca:number',
      numberCodeName: 'number-name',
      genericChangeAllowed: false,
      isGeneralNamePrescription: true,
      lowerUsageCode: 'lower-usage',
    });
    expect(fetched.order.rps[0]?.claimComments).toEqual([
      expect.objectContaining({ code: '820100001', name: 'RP患者希望', note: 'rp-note' }),
    ]);
    expect(fetched.order.prescriptionSettings).toEqual([{ code: 'setting-1', name: '院内設定', value: 'enabled' }]);
    expect(fetched.order.remarks).toEqual([{ code: 'remark-1', text: '院内備考' }]);

    const secondSave = await savePrescriptionOrder({ patientId: '000001', order: fetched.order });
    expect(secondSave.ok).toBe(true);

    const fetchedBundles = await fetchMedicalModV2OrderBundles('000001', '2026-03-09', 'F001:E900');
    expect(fetchedBundles.errors).toEqual([]);
    expect(fetchedBundles.bundles.some((bundle) => bundle.entity === 'medOrder')).toBe(true);
    expect(requestUrls.some((url) => url.includes('/api/local/order/bundles?') && url.includes('entity=medOrder'))).toBe(false);
    expect(
      requestUrls.filter((url) => url.startsWith('/api/local/prescription-orders?') && url.includes('encounterId=F001%3AE900')).length,
    ).toBeGreaterThanOrEqual(2);

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
      encounterContext: {
        patientId: '000001',
        visitDate: '2026-03-09T09:30:00',
        departmentCode: '01',
        physicianCode: '10001',
        insuranceCombinationNumber: '0001',
        voucherNumber: '1234',
        sequentialNumber: '1',
      },
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
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('number-name');

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });
    expect(sendResult.ok).toBe(true);
    expect(requestUrls.filter((url) => url.startsWith('/api/local/prescription-orders?'))).toHaveLength(2);
    expect(requestUrls.filter((url) => url === '/api/local/prescription-orders/authority')).toHaveLength(2);
  });

  it('postOrcaMedicalModV2Xml treats same-day duplicate as ORCA business rejection', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          apiResult: '80',
          apiResultMessage: '既に同日の診療データが登録されています',
          apiOk: false,
          error: '既に同日の診療データが登録されています',
          runId: 'RUN-DUPLICATE',
          traceId: 'TRACE-DUPLICATE',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await postOrcaMedicalModV2Xml(
      {
        encounterContext: {
          patientId: '000001',
          visitDate: '2026-03-09',
          departmentCode: '01',
          physicianCode: '10001',
          insuranceCombinationNumber: '0001',
          voucherNumber: '1234',
          sequentialNumber: '1',
        },
        medicalInformation: [
          {
            entity: 'treatmentOrder',
            medicalClass: '400',
            medicalClassNumber: '1',
            medications: [{ code: '140000610', number: '1' }],
          },
        ],
      },
      { classCode: '01' },
    );

    expect(result.ok).toBe(false);
    expect(result.apiResult).toBe('80');
    expect(result.apiResultMessage).toBe('既に同日の診療データが登録されています');
  });

  it('fetchMedicalModV2OrderBundles ignores empty prescription placeholders when other coded orders are sendable', async () => {
    vi.mocked(httpFetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/local/prescription-orders?')) {
        return new Response(
          JSON.stringify({
            found: false,
            runId: 'RUN-PRESCRIPTION-NOT-FOUND',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (url.includes('/api/local/order/bundles?') && url.includes('entity=treatmentOrder')) {
        return new Response(
          JSON.stringify({
            runId: 'RUN-FETCH-TREATMENT',
            patientId: '000001',
            bundles: [
              {
                entity: 'treatmentOrder',
                bundleName: 'wound-care',
                bundleNumber: '1',
                classCode: '400',
                classCodeSystem: 'Claim007',
                className: '処置',
                items: [{ code: '140000610', name: '創傷処置', quantity: '1', unit: '回', rowRole: 'main' }],
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (url.includes('/api/local/order/bundles?')) {
        return new Response(
          JSON.stringify({
            runId: 'RUN-FETCH-EMPTY',
            patientId: '000001',
            bundles: [],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      throw new Error(`unexpected request: ${url}`);
    });

    const fetched = await fetchMedicalModV2OrderBundles('000001', '2026-03-09', 'F001:E900');
    expect(fetched.errors).toEqual([]);
    expect(fetched.bundles.some((bundle) => bundle.entity === 'medOrder')).toBe(false);
    expect(fetched.bundles.some((bundle) => bundle.entity === 'treatmentOrder')).toBe(true);

    const prepared = prepareMedicalModV2SendData(fetched.bundles);
    expect(prepared.requiredIssues).toEqual([]);
    expect(prepared.bundleIssues).toEqual([]);
    expect(prepared.medicalInformation).toEqual([
      expect.objectContaining({
        entity: 'treatmentOrder',
        medicalClass: '400',
        medicalClassNumber: '1',
        medications: [expect.objectContaining({ code: '140000610' })],
      }),
    ]);
  });

  it('stale selection comment parameters block medicalmodv2 send before payload generation', () => {
    const prepared = prepareMedicalModV2SendData([
      {
        entity: 'baseChargeOrder',
        bundleName: '基本料',
        bundleNumber: '1',
        classCode: '110',
        classCodeSystem: 'Claim007',
        className: '基本診療料',
        items: [{ code: '110000110', name: '初診料', quantity: '1', unit: '回', memo: '', masterCategory: '110' }],
        commentItems: [
          {
            code: '0085001',
            name: 'コメント',
            quantity: '',
            unit: '',
            selectionCommentItemNumber: '0166',
            selectionCommentItemNumberBranch: '01',
          },
        ],
      },
    ]);

    expect(prepared.bundleIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported_selection_comment_parameter',
          entity: 'baseChargeOrder',
        }),
      ]),
    );
    expect(prepared.medicalInformation).toEqual([]);

    const notice = buildMedicalModV2BlockNotice(prepared);
    expect(notice?.message).toContain('ORCA送信を停止');
    expect(notice?.nextAction).toContain('itemNumber / branch');
  });

  it('same-day multi-encounter send path uses encounterId scoped prescription order', async () => {
    const requestUrls: string[] = [];
    vi.mocked(httpFetch).mockImplementation(async (input) => {
      const url = String(input);
      requestUrls.push(url);
      if (url.startsWith('/api/local/prescription-orders?')) {
        const parsed = new URL(`http://localhost${url}`);
        const encounterId = parsed.searchParams.get('encounterId');
        const drugName = encounterId === 'F001:E901' ? 'Encounter B薬' : 'Encounter A薬';
        const drugCode = encounterId === 'F001:E901' ? '620000901' : '620000900';
        return new Response(
          JSON.stringify({
            runId: 'RUN-RX-MULTI',
            found: true,
            order: {
              patientId: '000001',
              encounterId,
              encounterDate: '2026-03-09',
              performDate: '2026-03-09',
              rps: [
                {
                  rpNumber: `rp-${encounterId}`,
                  bundleName: 'same-day-rp',
                  medicalClass: '212',
                  medicalClassNumber: '7',
                  usageCode: '001000',
                  usageName: '毎食後',
                  started: '2026-03-09T09:30:00',
                  drugs: [
                    {
                      code: drugCode,
                      name: drugName,
                      quantity: '1',
                      unit: '錠',
                      genericChangeAllowed: true,
                      generalNamePrescription: false,
                      claimComments: [],
                    },
                  ],
                },
              ],
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      if (url.startsWith('/api/local/order/bundles?')) {
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
      throw new Error(`unexpected request: ${url}`);
    });

    const fetchedBundles = await fetchMedicalModV2OrderBundles('000001', '2026-03-09', 'F001:E901');
    expect(fetchedBundles.errors).toEqual([]);
    expect(requestUrls.filter((url) => url.startsWith('/api/local/prescription-orders?'))).toEqual([
      expect.stringContaining('encounterId=F001%3AE901'),
    ]);
    expect(requestUrls.some((url) => url.includes('/api/local/order/bundles?') && url.includes('entity=medOrder'))).toBe(false);

    const prepared = prepareMedicalModV2SendData(fetchedBundles.bundles);
    expect(prepared.medicalInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          medications: expect.arrayContaining([expect.objectContaining({ code: '620000901', name: 'Encounter B薬' })]),
        }),
      ]),
    );
    expect(prepared.medicalInformation[0]?.medications).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: '620000901', genericFlg: 'no' })]),
    );
    expect(JSON.stringify(prepared.medicalInformation)).not.toContain('Encounter A薬');
  });
});
