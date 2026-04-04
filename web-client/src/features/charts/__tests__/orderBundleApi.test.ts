import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'RUN-GEN'),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-META' })),
  updateObservabilityMeta: vi.fn(),
}));

vi.mock('../../outpatient/orcaPatientImportApi', () => ({
  importPatientsFromOrca: vi.fn(),
}));

import { httpFetch } from '../../../libs/http/httpClient';
import { importPatientsFromOrca } from '../../outpatient/orcaPatientImportApi';
import {
  fetchOrderBundles,
  fetchOrderBundlesWithPatientImportRecovery,
  mutateOrderBundles,
} from '../orderBundleApi';
import { resolveCanonicalChargeClassMeta } from '../orderChargeClassSupport';

describe('orderBundleApi bodyPart contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetch restores bodyPart and adminCode as first-class fields', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-FETCH',
          patientId: '000001',
          bundles: [
            {
              entity: 'radiologyOrder',
              bundleName: 'CHEST_CT',
              admin: 'once-daily',
              adminCode: '1234',
              adminCodeSystem: 'Claim007',
              items: [{ code: '700001', name: 'CHEST_CT', rowRole: 'main' }],
              bodyPart: {
                code: 'BP001',
                name: 'CHEST',
                quantity: '1',
                unit: 'part',
                memo: 'BODY_PART',
                rowRole: 'bodyPart',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrderBundles({ patientId: '000001' });

    expect(result.ok).toBe(true);
    expect((result.bundles[0] as any).bodyPart).toEqual(
      expect.objectContaining({
        code: 'BP001',
        name: 'CHEST',
      }),
    );
    expect((result.bundles[0] as any).adminCode).toBe('1234');
    expect((result.bundles[0] as any).adminCodeSystem).toBe('Claim007');
    expect((result.bundles[0] as any).items[0]?.rowRole).toBe('main');
    expect((result.bundles[0] as any).bodyPart?.rowRole).toBe('bodyPart');
  });

  it('fetch normalizes laboTest bundle.entity to testOrder', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-FETCH-ENTITY',
          patientId: '000001',
          bundles: [
            {
              entity: 'laboTest',
              bundleName: 'LAB_GENERAL',
              items: [{ code: '160000010', name: 'LAB_GENERAL' }],
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrderBundles({ patientId: '000001' });

    expect(result.ok).toBe(true);
    expect(result.bundles[0]?.entity).toBe('testOrder');
  });

  it('mutation includes bodyPart and adminCode in the payload', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-MUT',
          createdDocumentIds: [101],
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
          bundleName: 'CHEST_CT',
          admin: 'once-daily',
          adminCode: '1234',
          adminCodeSystem: 'Claim007',
          items: [{ code: '700001', name: 'CHEST_CT', rowRole: 'main' }],
          bodyPart: {
            code: 'BP001',
            name: 'CHEST',
            quantity: '1',
            unit: 'part',
            memo: 'BODY_PART',
            rowRole: 'bodyPart',
          },
        } as any,
      ],
    });

    const request = vi.mocked(httpFetch).mock.calls[0]?.[1];
    const body = JSON.parse(String((request as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;

    expect(body.operations[0]).toEqual(
      expect.objectContaining({
        adminCode: '1234',
        adminCodeSystem: 'Claim007',
        items: [expect.objectContaining({ code: '700001', rowRole: 'main' })],
        bodyPart: expect.objectContaining({
          code: 'BP001',
          name: 'CHEST',
          rowRole: 'bodyPart',
        }),
      }),
    );
  });

  it('mutation normalizes laboTest entity to testOrder', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-MUT-ENTITY',
          createdDocumentIds: [101],
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
          entity: 'laboTest',
          bundleName: 'LAB_GENERAL',
          items: [{ code: '160000010', name: 'LAB_GENERAL' }],
        } as any,
      ],
    });

    const request = vi.mocked(httpFetch).mock.calls[0]?.[1];
    const body = JSON.parse(String((request as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;

    expect(body.operations[0]?.entity).toBe('testOrder');
  });

  it('mutation keeps adminCode and adminMemo as separate fields', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-MUT-ADMIN',
          createdDocumentIds: [102],
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
          bundleName: 'TREATMENT_SET',
          admin: 'once-per-day',
          adminCode: '31001',
          adminCodeSystem: 'Claim007',
          adminMemo: 'ADMIN_MEMO',
          items: [{ code: '140000610', name: 'TREATMENT_ITEM', quantity: '1', unit: 'times' }],
        } as any,
      ],
    });

    const request = vi.mocked(httpFetch).mock.calls[0]?.[1];
    const body = JSON.parse(String((request as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;

    expect(body.operations[0]).toEqual(
      expect.objectContaining({
        admin: 'once-per-day',
        adminCode: '31001',
        adminCodeSystem: 'Claim007',
        adminMemo: 'ADMIN_MEMO',
      }),
    );
  });

  it('mutation keeps mixed coded and uncoded rows in the payload', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-MUT-MIXED',
          createdDocumentIds: [103],
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
          bundleName: 'MIXED_ORDER',
          bundleNumber: '1',
          items: [
            { code: '140000610', name: 'TREATMENT_ITEM', quantity: '1', unit: 'times' },
            { name: 'UNCODED_ROW', quantity: '1', unit: 'times' },
          ],
        } as any,
      ],
    });

    const request = vi.mocked(httpFetch).mock.calls[0]?.[1];
    const body = JSON.parse(String((request as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;

    expect(body.operations[0]?.items).toHaveLength(2);
    expect(body.operations[0]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: '140000610' }),
        expect.objectContaining({ name: 'UNCODED_ROW' }),
      ]),
    );
  });

  it('patient import recovery still preserves bodyPart in fetched bundles', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'patient_not_found',
            runId: 'RUN-404',
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runId: 'RUN-200',
            patientId: '000001',
            bundles: [
              {
                entity: 'radiologyOrder',
                bundleName: 'BRAIN_MRI',
                items: [{ code: '700100', name: 'BRAIN_MRI' }],
                bodyPart: { code: 'BP090', name: 'HEAD' },
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    vi.mocked(importPatientsFromOrca).mockResolvedValueOnce({
      ok: true,
      runId: 'RUN-IMPORT',
      status: 200,
      payload: {},
    });

    const result = await fetchOrderBundlesWithPatientImportRecovery({ patientId: '000001', from: '2026-02-27' });

    expect(result.ok).toBe(true);
    expect(result.patientImportAttempted).toBe(true);
    expect((result.bundles[0] as any).bodyPart).toEqual(expect.objectContaining({ name: 'HEAD' }));
  });

  it('fetch restores otherOrder explicit class meta and local-only fields', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-OTHER-FETCH',
          patientId: '000001',
          bundles: [
            {
              entity: 'otherOrder',
              bundleName: 'CERTIFICATE_FEE',
              bundleNumber: '5',
              classCode: '800',
              classCodeSystem: 'Claim007',
              className: 'Other',
              admin: 'LOCAL_ADMIN_NOTE',
              memo: 'LOCAL_MEMO',
              items: [{ code: '180000210', name: 'CERTIFICATE_FEE', quantity: '1', unit: 'times' }],
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrderBundles({ patientId: '000001', entity: 'otherOrder' });

    expect(result.ok).toBe(true);
    expect(result.bundles[0]).toEqual(
      expect.objectContaining({
        entity: 'otherOrder',
        bundleName: 'CERTIFICATE_FEE',
        classCode: '800',
        classCodeSystem: 'Claim007',
        className: 'Other',
        admin: 'LOCAL_ADMIN_NOTE',
        memo: 'LOCAL_MEMO',
      }),
    );
  });

  it('mutation keeps otherOrder explicit class meta and local-only fields', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-OTHER-MUT',
          createdDocumentIds: [104],
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
          bundleName: 'CERTIFICATE_FEE',
          bundleNumber: '5',
          classCode: '800',
          classCodeSystem: 'Claim007',
          className: 'Other',
          admin: 'LOCAL_ADMIN_NOTE',
          memo: 'LOCAL_MEMO',
          items: [{ code: '180000210', name: 'CERTIFICATE_FEE', quantity: '1', unit: 'times' }],
        } as any,
      ],
    });

    const request = vi.mocked(httpFetch).mock.calls[0]?.[1];
    const body = JSON.parse(String((request as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;

    expect(body.operations[0]).toEqual(
      expect.objectContaining({
        entity: 'otherOrder',
        bundleName: 'CERTIFICATE_FEE',
        bundleNumber: '5',
        classCode: '800',
        classCodeSystem: 'Claim007',
        className: 'Other',
        admin: 'LOCAL_ADMIN_NOTE',
        memo: 'LOCAL_MEMO',
        items: expect.arrayContaining([expect.objectContaining({ code: '180000210', unit: 'times' })]),
      }),
    );
  });

  it('fetch canonicalizes charge className from classCode and entity', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-CHARGE-FETCH',
          patientId: '000001',
          bundles: [
            {
              entity: 'baseChargeOrder',
              bundleName: 'BASE_CHARGE_SET',
              bundleNumber: '1',
              classCode: '120',
              classCodeSystem: 'Claim007',
              className: 'bundle fallback should not survive',
              adminMemo: 'LOCAL_NOTE',
              items: [{ code: '120000110', name: 'BASE_CHARGE_SET', quantity: '1', unit: 'times' }],
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrderBundles({ patientId: '000001', entity: 'baseChargeOrder' });

    expect(result.ok).toBe(true);
    expect(result.bundles[0]).toEqual(
      expect.objectContaining({
        entity: 'baseChargeOrder',
        classCode: '120',
        classCodeSystem: 'Claim007',
        className: resolveCanonicalChargeClassMeta({ entity: 'baseChargeOrder', classCode: '120' })?.className,
      }),
    );
  });

  it('mutation canonicalizes charge className before send', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-CHARGE-MUT',
          createdDocumentIds: [106],
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
          entity: 'instractionChargeOrder',
          bundleName: 'INSTRACTION_CHARGE_SET',
          bundleNumber: '2',
          classCode: '140',
          classCodeSystem: 'Claim007',
          className: 'bundle fallback should not survive',
          items: [{ code: '140000610', name: 'INSTRACTION_CHARGE_SET', quantity: '1', unit: 'times' }],
        } as any,
      ],
    });

    const request = vi.mocked(httpFetch).mock.calls[0]?.[1];
    const body = JSON.parse(String((request as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;

    expect(body.operations[0]).toEqual(
      expect.objectContaining({
        entity: 'instractionChargeOrder',
        classCode: '140',
        classCodeSystem: 'Claim007',
        className: resolveCanonicalChargeClassMeta({ entity: 'instractionChargeOrder', classCode: '140' })?.className,
      }),
    );
  });

  it('fetch preserves class 600 subtype contract', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-SUBTYPE-FETCH',
          patientId: '000001',
          bundles: [
            {
              entity: 'bacteriaOrder',
              bundleName: 'bacteria bundle',
              bundleNumber: '2',
              subtype: 'culture',
              classCode: '600',
              classCodeSystem: 'Claim007',
              className: 'test class',
              items: [{ code: '160000010', name: 'culture item', quantity: '1', unit: 'count' }],
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrderBundles({ patientId: '000001', entity: 'bacteriaOrder' });

    expect(result.ok).toBe(true);
    expect(result.bundles[0]).toEqual(
      expect.objectContaining({
        entity: 'bacteriaOrder',
        subtype: 'culture',
        classCode: '600',
      }),
    );
  });

  it('mutation preserves class 600 subtype contract', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-SUBTYPE-MUT',
          createdDocumentIds: [105],
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
          bundleNumber: '2',
          subtype: 'sensitivity',
          classCode: '600',
          classCodeSystem: 'Claim007',
          className: 'test class',
          items: [{ code: '160000011', name: 'sensitivity item', quantity: '1', unit: 'count' }],
        } as any,
      ],
    });

    const request = vi.mocked(httpFetch).mock.calls[0]?.[1];
    const body = JSON.parse(String((request as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;

    expect(body.operations[0]).toEqual(
      expect.objectContaining({
        entity: 'bacteriaOrder',
        subtype: 'sensitivity',
        classCode: '600',
      }),
    );
  });
});
