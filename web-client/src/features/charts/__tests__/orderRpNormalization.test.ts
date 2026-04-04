import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveCanonicalOrderEntity } from '../orderCategoryRegistry';
import {
  collectMedicalModV2BundleIssues,
  fetchMedicalModV2OrderBundles,
  normalizeOrderBundleToRp,
} from '../orderRpNormalization';
import { fetchOrderBundles } from '../orderBundleApi';
import { buildEmptyPrescriptionOrder, fetchPrescriptionOrder } from '../prescriptionOrderApi';

vi.mock('../orderBundleApi', () => ({
  fetchOrderBundles: vi.fn(),
}));

vi.mock('../prescriptionOrderApi', async () => {
  const actual = await vi.importActual<typeof import('../prescriptionOrderApi')>('../prescriptionOrderApi');
  return {
    ...actual,
    fetchPrescriptionOrder: vi.fn(),
  };
});

describe('orderRpNormalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves canonical aliases', () => {
    expect(resolveCanonicalOrderEntity('generalOrder')).toBe('treatmentOrder');
    expect(resolveCanonicalOrderEntity('laboTest')).toBe('testOrder');
  });

  it('reports mixed coded and uncoded rows', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'treatmentOrder',
        bundleName: 'mixed-bundle',
        items: [
          { code: '140000610', name: 'coded-item', quantity: '1', unit: 'times' },
          { name: 'free-text-only', quantity: '1', unit: 'times' },
        ],
      } as any,
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual(
      expect.objectContaining({
        code: 'mixed_coded_uncoded',
        bundleName: 'mixed-bundle',
      }),
    );
  });

  it('reports comment-only bundles when no sendable main row exists', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'radiologyOrder',
        bundleName: 'body-part-only',
        bodyPart: { code: '002001', name: 'CHEST', quantity: '1', unit: 'part', memo: '' },
        items: [{ code: '002001', name: 'CHEST', quantity: '1', unit: 'part', memo: '' }],
      } as any,
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual(
      expect.objectContaining({
        code: 'comment_only',
        bundleName: 'body-part-only',
      }),
    );
  });

  it('does not block bacteria bundles only because subtype exists', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'bacteriaOrder',
        bundleName: 'bacteria-culture',
        subtype: 'culture',
        items: [{ code: '160000010', name: 'culture-row', quantity: '1', unit: 'count', memo: '' }],
      } as any,
    ]);

    expect(issues).toEqual([]);
  });

  it('keeps units during normalization', () => {
    const normalized = normalizeOrderBundleToRp({
      entity: 'radiologyOrder',
      bundleName: 'chest-ct',
      bundleNumber: '1',
      items: [{ code: '170017510', name: 'ct', quantity: '1', unit: 'times', memo: '' }],
    } as any);

    expect(normalized?.rows[0]?.medication).toEqual(
      expect.objectContaining({
        unit: 'times',
      }),
    );
  });

  it('keeps explicit bodyPart and admin code as first-class fields', () => {
    const normalized = normalizeOrderBundleToRp({
      entity: 'radiologyOrder',
      bundleName: 'chest-ct',
      bundleNumber: '1',
      admin: 'oral',
      adminCode: '4101',
      bodyPart: { code: '002001', name: 'CHEST', quantity: '1', unit: 'part', memo: '' },
      items: [{ code: '170017510', name: 'ct', quantity: '1', unit: 'times', memo: '' }],
    } as any);

    expect(normalized?.header.admin).toBe('oral');
    expect(normalized?.header.adminCode).toBe('4101');
    expect(normalized?.rows.map((row) => row.source.kind)).toEqual(['body_part', 'bundle_item']);
    expect(normalized?.rows[0]?.medication).toEqual(
      expect.objectContaining({
        code: '002001',
        unit: 'part',
      }),
    );
  });

  it('keeps injection usage row and row-role ordering', () => {
    const normalized = normalizeOrderBundleToRp({
      entity: 'injectionOrder',
      bundleName: 'drip-set',
      bundleNumber: '3',
      classCode: '310',
      admin: 'infuse',
      adminCode: '4101',
      items: [
        { code: '0085001', name: 'COMMENT', quantity: '', unit: '', memo: 'slow', rowRole: 'comment' },
        { code: '700000031', name: 'DRIP_SET', quantity: '1', unit: 'set', memo: '', rowRole: 'material' },
        { code: '830000001', name: 'PROCEDURE', quantity: '1', unit: 'times', memo: '', rowRole: 'main' },
        { code: '620000012', name: 'DRUG_C', quantity: '1', unit: 'ampoule', memo: '', rowRole: 'main' },
      ],
    } as any);

    expect(normalized?.header.medicalClass).toBe('310');
    expect(normalized?.header.medicalClassNumber).toBe('3');
    expect(normalized?.rows.map((row) => row.medication.code)).toEqual([
      '4101',
      '830000001',
      '620000012',
      '700000031',
      '0085001',
    ]);
  });

  it('uses prescription orders as the medOrder source of truth', async () => {
    vi.mocked(fetchPrescriptionOrder).mockResolvedValue({
      ok: true,
      patientId: '000001',
      sourceBundles: [],
      order: {
        ...buildEmptyPrescriptionOrder('000001', '2026-03-09'),
        rps: [
          {
            ...buildEmptyPrescriptionOrder('000001', '2026-03-09').rps[0],
            name: 'RP1',
            usage: 'after meal',
            usageCode: '001000',
            daysOrTimes: '7',
            drugs: [
              {
                rowId: 'drug-1',
                code: '620000001',
                name: 'drug-a',
                quantity: '3',
                unit: 'tablet',
                genericChangeAllowed: true,
                isGeneralNamePrescription: false,
                drugComment: '',
                claimComments: [],
                patientRequest: false,
              },
            ],
          },
        ],
      },
    } as any);
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [{ entity: 'treatmentOrder', bundleName: 'treatment-1', bundleNumber: '1', items: [{ code: '140000610', name: 'procedure', quantity: '1', unit: 'times' }] }]
          : [],
    }));

    const result = await fetchMedicalModV2OrderBundles('000001', '2026-03-09');

    expect(fetchPrescriptionOrder).toHaveBeenCalledWith({ patientId: '000001', from: '2026-03-09' });
    expect(fetchOrderBundles).not.toHaveBeenCalledWith(expect.objectContaining({ entity: 'medOrder' }));
    expect(result.errors).toEqual([]);
    expect(result.bundles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'medOrder',
          bundleName: 'RP1',
          admin: 'after meal',
          adminMemo: '001000',
        }),
        expect.objectContaining({
          entity: 'treatmentOrder',
          bundleName: 'treatment-1',
        }),
      ]),
    );
  });
});
