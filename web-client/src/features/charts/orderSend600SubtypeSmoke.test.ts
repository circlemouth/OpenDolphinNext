import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'RUN-GEN'),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-META', traceId: 'TRACE-META' })),
  ensureObservabilityMeta: vi.fn(() => ({ runId: 'RUN-META', traceId: 'TRACE-META' })),
  updateObservabilityMeta: vi.fn(),
}));

vi.mock('./orcaOrderInputSetApi', () => ({
  fetchOrcaOrderInputSets: vi.fn(),
  fetchOrcaOrderInputSetDetail: vi.fn(),
}));

import { httpFetch } from '../../libs/http/httpClient';
import { buildMedicalModV2RequestXml, postOrcaMedicalModV2Xml } from './orcaClaimApi';
import { fetchOrderBundles, mutateOrderBundles } from './orderBundleApi';
import { fetchOrcaOrderInputSetDetail } from './orcaOrderInputSetApi';
import {
  buildMedicalModV2BlockNotice,
  prepareMedicalModV2SendData,
  toMedicalModV2InformationWithSource,
} from './orderRpNormalization';

describe('order send smoke for class 600', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('save fetch normalize send smoke blocks bacteria subtype before xml payload generation', async () => {
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
                className: '検査',
                admin: '院内指示',
                adminMemo: 'local admin memo',
                memo: 'local memo',
                items: [{ code: '160000010', name: 'lab item', quantity: '1', unit: 'count', memo: '' }],
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
          className: '検査',
          admin: '院内指示',
          adminMemo: 'local admin memo',
          memo: 'local memo',
          items: [{ code: '160000010', name: 'lab item', quantity: '1', unit: 'count', memo: '' }],
        },
      ],
    });

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'bacteriaOrder' });
    expect(fetched.ok).toBe(true);

    const prepared = prepareMedicalModV2SendData(fetched.bundles);
    const blockNotice = buildMedicalModV2BlockNotice(prepared);
    expect(prepared.bundleIssues.map((issue) => issue.code)).toContain('unsupported_bacteria_subtype');
    expect(prepared.medicalInformation).toEqual([]);
    expect(blockNotice?.message).toContain('ORCA送信を停止');
    expect(blockNotice?.nextAction).toContain('細菌検査');
    expect(httpFetch).toHaveBeenCalledTimes(2);
  });

  it('save fetch normalize send smoke keeps testOrder multi-item comment bundle local-only fields out of xml payload', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-SAVE-600-TEST',
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
            runId: 'RUN-FETCH-600-TEST',
            patientId: '000001',
            bundles: [
              {
                entity: 'testOrder',
                bundleName: 'test bundle',
                bundleNumber: '2',
                classCode: '600',
                classCodeSystem: 'Claim007',
                className: '検査',
                admin: '院内指示',
                adminMemo: 'bundle-admin-memo',
                memo: 'bundle-memo',
                items: [
                  { code: '160000010', name: 'lab item A', quantity: '1', unit: 'count', memo: '', rowRole: 'main' },
                  { code: '0085001', name: 'comment item', quantity: '', unit: '', memo: 'note', rowRole: 'comment' },
                  { code: '160000011', name: 'lab item B', quantity: '1', unit: 'count', memo: '', rowRole: 'main' },
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
            runId: 'RUN-SEND-600-TEST',
            traceId: 'TRACE-SEND-600-TEST',
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
          entity: 'testOrder',
          bundleName: 'test bundle',
          bundleNumber: '2',
          classCode: '600',
          classCodeSystem: 'Claim007',
          className: '検査',
          admin: '院内指示',
          adminMemo: 'bundle-admin-memo',
          memo: 'bundle-memo',
          items: [
            { code: '160000010', name: 'lab item A', quantity: '1', unit: 'count', memo: '', rowRole: 'main' },
            { code: '0085001', name: 'comment item', quantity: '', unit: '', memo: 'note', rowRole: 'comment' },
            { code: '160000011', name: 'lab item B', quantity: '1', unit: 'count', memo: '', rowRole: 'main' },
          ],
        },
      ],
    });

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'testOrder' });
    expect(fetched.ok).toBe(true);
    const normalized = fetched.bundles
      .map((bundle) => toMedicalModV2InformationWithSource(bundle))
      .filter((entry): entry is NonNullable<ReturnType<typeof toMedicalModV2InformationWithSource>> => Boolean(entry));

    expect(normalized[0]?.source.rows.map((row) => row.medication.code)).toEqual([
      '160000010',
      '160000011',
      '0085001',
    ]);

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
          medicalClassName: '検査',
          medicalClassNumber: '2',
          medications: expect.arrayContaining([
            expect.objectContaining({ code: '160000010', name: 'lab item A' }),
            expect.objectContaining({ code: '160000011', name: 'lab item B' }),
            expect.objectContaining({ code: '0085001', name: 'comment item' }),
          ]),
        }),
      ]),
    );
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('院内指示');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('bundle-admin-memo');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('bundle-memo');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('note');

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });
    expect(sendResult.ok).toBe(true);
    expect(httpFetch).toHaveBeenCalledTimes(3);

    const request = vi.mocked(httpFetch).mock.calls[2]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(request?.body ?? '{}')) as Record<string, any>;
    expect(body.medicalInformation[0]?.medications.map((item: Record<string, string>) => item.code)).toEqual([
      '160000010',
      '160000011',
      '0085001',
    ]);
    expect(JSON.stringify(body.medicalInformation)).not.toContain('院内指示');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('bundle-admin-memo');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('bundle-memo');
    expect(JSON.stringify(body.medicalInformation)).not.toContain('note');
  });

  it('input set detail -> save -> fetch -> send keeps testOrder bundle-common local-only fields out of xml payload', async () => {
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValueOnce({
      ok: true,
      bundle: {
        entity: 'testOrder',
        sourceSetCode: 'T60001',
        bundleName: '血液検査セット',
        bundleNumber: '4',
        classCode: '600',
        classCodeSystem: 'Claim007',
        className: '検査',
        admin: '朝採血',
        adminMemo: '空腹時',
        memo: 'bundle memo',
        items: [
          { code: '160000010', name: '血算', quantity: '1', unit: '回', memo: 'item memo a', rowRole: 'main' },
          { code: '160000011', name: '生化学', quantity: '1', unit: '回', memo: 'item memo b', rowRole: 'main' },
          { code: '0085001', name: '採血注意', quantity: '', unit: '', memo: 'comment note', rowRole: 'comment' },
        ],
      },
    } as any);
    vi.mocked(httpFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith('/api/orca/order/inputsets/T60001?')) {
        return new Response(
          JSON.stringify({
            ok: true,
            setCode: 'T60001',
            bundle: {
              entity: 'testOrder',
              sourceSetCode: 'T60001',
              bundleName: '血液検査セット',
              bundleNumber: '4',
              classCode: '600',
              classCodeSystem: 'Claim007',
              className: '検査',
              admin: '朝採血',
              adminMemo: '空腹時',
              memo: 'bundle memo',
              items: [
                { code: '160000010', name: '血算', quantity: '1', unit: '回', memo: 'item memo a', rowRole: 'main' },
                { code: '160000011', name: '生化学', quantity: '1', unit: '回', memo: 'item memo b', rowRole: 'main' },
                { code: '0085001', name: '採血注意', quantity: '', unit: '', memo: 'comment note', rowRole: 'comment' },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url === '/api/orca/order/bundles' && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            runId: 'RUN-SAVE-INPUTSET-600',
            createdDocumentIds: [505],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.startsWith('/api/orca/order/bundles?')) {
        return new Response(
          JSON.stringify({
            runId: 'RUN-FETCH-INPUTSET-600',
            patientId: '000001',
            bundles: [
              {
                entity: 'testOrder',
                sourceSetCode: 'T60001',
                bundleName: '血液検査セット',
                bundleNumber: '4',
                classCode: '600',
                classCodeSystem: 'Claim007',
                className: '検査',
                admin: '朝採血',
                adminMemo: '空腹時',
                memo: 'bundle memo',
                items: [
                  { code: '160000010', name: '血算', quantity: '1', unit: '回', memo: 'item memo a', rowRole: 'main' },
                  { code: '160000011', name: '生化学', quantity: '1', unit: '回', memo: 'item memo b', rowRole: 'main' },
                  { code: '0085001', name: '採血注意', quantity: '', unit: '', memo: 'comment note', rowRole: 'comment' },
                ],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url === '/api/orca/chart-support/medical-mod-v2') {
        return new Response(
          JSON.stringify({
            runId: 'RUN-SEND-INPUTSET-600',
            traceId: 'TRACE-SEND-INPUTSET-600',
            apiResult: '00',
            apiResultMessage: 'OK',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`unexpected request: ${url}`);
    });

    const detail = await fetchOrcaOrderInputSetDetail({ setCode: 'T60001', entity: 'testOrder', effective: '20260309' });
    expect(detail.ok).toBe(true);
    expect(detail.bundle?.admin).toBe('朝採血');
    expect(detail.bundle?.sourceSetCode).toBe('T60001');

    await mutateOrderBundles({
      patientId: '000001',
      operations: [
        {
          operation: 'create',
          ...(detail.bundle ?? { items: [] }),
          entity: detail.bundle?.entity ?? undefined,
          items: (detail.bundle?.items ?? []) as any,
        } as any,
      ],
    });

    const fetched = await fetchOrderBundles({ patientId: '000001', entity: 'testOrder' });
    expect(fetched.ok).toBe(true);
    const normalized = fetched.bundles
      .map((bundle) => toMedicalModV2InformationWithSource(bundle))
      .filter((entry): entry is NonNullable<ReturnType<typeof toMedicalModV2InformationWithSource>> => Boolean(entry));
    expect(normalized[0]?.source.rows.map((row) => row.medication.code)).toEqual([
      '160000010',
      '160000011',
      '0085001',
    ]);

    const payload = buildMedicalModV2RequestXml({
      patientId: '000001',
      performDate: '2026-03-09T09:30:00',
      departmentCode: '01',
      physicianCode: '10001',
      medicalInformation: normalized.map((entry) => entry.info),
    });

    expect(payload.medicalInformation?.[0]?.medications.map((item) => item.code)).toEqual([
      '160000010',
      '160000011',
      '0085001',
    ]);
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('朝採血');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('空腹時');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('bundle memo');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('item memo');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('comment note');

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });
    expect(sendResult.ok).toBe(true);
  });
});
