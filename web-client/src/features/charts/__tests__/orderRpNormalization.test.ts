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

  it('canonical entity は generalOrder と laboTest を正規化する', () => {
    expect(resolveCanonicalOrderEntity('generalOrder')).toBe('treatmentOrder');
    expect(resolveCanonicalOrderEntity('laboTest')).toBe('testOrder');
  });

  it('コードあり/なし混在の bundle は送信前 issue を返す', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'treatmentOrder',
        bundleName: '混在束',
        items: [
          { code: '140000610', name: '創傷処置（１００ｃｍ２未満）', quantity: '1', unit: '回' },
          { name: '未コード行', quantity: '1', unit: '回' },
        ],
      } as any,
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual(
      expect.objectContaining({
        code: 'mixed_coded_uncoded',
        bundleName: '混在束',
      }),
    );
  });

  it('部位のみの bundle は送信前 issue を返す', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'radiologyOrder',
        bundleName: '胸部CT',
        bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '' },
        items: [{ code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '' }],
      } as any,
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual(
      expect.objectContaining({
        code: 'comment_only',
        bundleName: '胸部CT',
      }),
    );
  });

  it('bacteriaOrder の subtype は carrier 未対応のため送信前 issue を返す', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'bacteriaOrder',
        bundleName: '細菌培養',
        subtype: 'culture',
        items: [{ code: '160000010', name: '培養検査', quantity: '1', unit: '回', memo: '' }],
      } as any,
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported_bacteria_subtype',
          bundleName: '細菌培養',
        }),
      ]),
    );
  });

  it('normalize は unit を保持する', () => {
    const normalized = normalizeOrderBundleToRp({
      entity: 'radiologyOrder',
      bundleName: '胸部CT',
      bundleNumber: '1',
      items: [{ code: '170017510', name: 'ＣＴ撮影', quantity: '1', unit: '回', memo: '' }],
    } as any);

    expect(normalized?.rows[0]?.medication).toEqual(
      expect.objectContaining({
        unit: '回',
      }),
    );
  });

  it('normalize は explicit bodyPart と adminCode を first-class で保持する', () => {
    const normalized = normalizeOrderBundleToRp({
      entity: 'radiologyOrder',
      bundleName: '胸部CT',
      bundleNumber: '1',
      admin: '静注',
      adminCode: '4101',
      bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '' },
      items: [{ code: '170017510', name: 'ＣＴ撮影', quantity: '1', unit: '回', memo: '' }],
    } as any);

    expect(normalized?.header.admin).toBe('静注');
    expect(normalized?.header.adminCode).toBe('4101');
    expect(normalized?.rows.map((row) => row.source.kind)).toEqual(['body_part', 'bundle_item']);
    expect(normalized?.rows[0]?.medication).toEqual(
      expect.objectContaining({
        code: '002001',
        unit: '部位',
      }),
    );
  });
  it('normalize は treatmentOrder の bodyPart/main/material/comment 順を固定する', () => {
    const normalized = normalizeOrderBundleToRp({
      entity: 'treatmentOrder',
      bundleName: '創傷処置セット',
      bundleNumber: '3',
      classCode: '400',
      classCodeSystem: 'Claim007',
      className: 'Treatment',
      bodyPart: { code: '002001', name: '膝関節', quantity: '1', unit: '部位', memo: '', rowRole: 'bodyPart' },
      items: [
        { code: '140000610', name: '創傷処置（１００ｃｍ２未満）', quantity: '1', unit: '回', memo: '', rowRole: 'main' },
        { code: '700000021', name: '処置材料A', quantity: '1', unit: '個', memo: '', rowRole: 'material' },
        { code: '0085001', name: '注意事項', quantity: '', unit: '', memo: '術前確認', rowRole: 'comment' },
      ],
    } as any);

    expect(normalized?.header.medicalClass).toBe('400');
    expect(normalized?.header.medicalClassNumber).toBe('3');
    expect(normalized?.rows.map((row) => row.medication.code)).toEqual([
      '002001',
      '140000610',
      '700000021',
      '0085001',
    ]);
  });
  it('normalize は injectionOrder の admin 行と rowRole 順を固定する', () => {
    const normalized = normalizeOrderBundleToRp({
      entity: 'injectionOrder',
      bundleName: 'drip-set',
      bundleNumber: '3',
      classCode: '310',
      admin: '静注',
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

  it('fetchMedicalModV2OrderBundles は medOrder を prescription-orders から組み立てる', async () => {
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
            usage: '毎食後',
            usageCode: '001000',
            daysOrTimes: '7',
            drugs: [
              {
                rowId: 'drug-1',
                code: '620000001',
                name: '薬剤A',
                quantity: '3',
                unit: '錠',
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
          ? [{ entity: 'treatmentOrder', bundleName: '処置', bundleNumber: '1', items: [{ code: '140000610', name: '処置', quantity: '1', unit: '回' }] }]
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
          admin: '毎食後',
          adminMemo: '001000',
        }),
        expect.objectContaining({
          entity: 'treatmentOrder',
          bundleName: '処置',
        }),
      ]),
    );
  });
});
