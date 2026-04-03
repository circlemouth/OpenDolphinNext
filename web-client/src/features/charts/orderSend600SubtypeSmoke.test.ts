import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'RUN-GEN'),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-META', traceId: 'TRACE-META' })),
  updateObservabilityMeta: vi.fn(),
}));

import { httpFetch } from '../../libs/http/httpClient';
import { buildMedicalModV2RequestXml, postOrcaMedicalModV2Xml } from './orcaClaimApi';
import { fetchOrderBundles, mutateOrderBundles } from './orderBundleApi';
import { toMedicalModV2InformationWithSource } from './orderRpNormalization';

describe('order send smoke for class 600 subtype', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('save fetch normalize send smoke keeps subtype out of xml payload', async () => {
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
          items: [{ code: '160000010', name: 'lab item', quantity: '1', unit: 'count', memo: '' }],
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
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('culture');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local admin memo');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('local memo');

    const sendResult = await postOrcaMedicalModV2Xml(payload, { classCode: '01' });

    expect(sendResult.ok).toBe(true);
    expect(httpFetch).toHaveBeenCalledTimes(3);
  });
});
