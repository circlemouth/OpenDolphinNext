import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveCanonicalOrderEntity } from '../orderCategoryRegistry';
import { buildMedicalModV2RequestXml } from '../orcaClaimApi';
import {
  collectMedicalModV2BundleIssues,
  fetchMedicalModV2OrderBundles,
  normalizeOrderBundleToRp,
  toMedicalModV2InformationWithSource,
} from '../orderRpNormalization';
import { fetchOrderBundles } from '../orderBundleApi';
import { buildEmptyPrescriptionOrder, fetchPrescriptionOrder } from '../prescriptionOrderApi';

vi.mock('../orderBundleApi', async () => {
  const actual = await vi.importActual<typeof import('../orderBundleApi')>('../orderBundleApi');
  return {
    ...actual,
    fetchOrderBundles: vi.fn(),
  };
});

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
        bundleName: 'mixed-rows',
        items: [
          { code: '140000610', name: '処置A', quantity: '1', unit: '回' },
          { name: '未コード行', quantity: '1', unit: '回' },
        ],
      } as any,
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'mixed_coded_uncoded',
          bundleName: 'mixed-rows',
        }),
      ]),
    );
  });

  it('部位のみの radiology bundle は送信前 issue を返す', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'radiologyOrder',
        bundleName: '胸部CT',
        bodyPart: { code: '002', name: '胸部', quantity: '1', unit: '部位', memo: '' },
        items: [{ code: '002', name: '胸部', quantity: '1', unit: '部位', memo: '' }],
      } as any,
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'comment_only',
          bundleName: '胸部CT',
        }),
      ]),
    );
  });

  it('bacteriaOrder は local-only のため送信前 issue を返す', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'bacteriaOrder',
        bundleName: '細菌検査',
        subtype: 'culture',
        items: [{ code: '160000010', name: '細菌検査A', quantity: '1', unit: '回', memo: '' }],
      } as any,
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported_bacteria_subtype',
          bundleName: '細菌検査',
        }),
      ]),
    );
  });

  it('parameter 付き選択式コメントは送信前 issue を返す', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'treatmentOrder',
        bundleName: 'parameter-comment',
        items: [
          { code: '140000610', name: '処置A', quantity: '1', unit: '回', rowRole: 'main' },
          {
            code: '0082',
            name: 'コメント',
            quantity: '',
            unit: '',
            rowRole: 'comment',
            selectionCommentItemNumber: '0166',
            selectionCommentItemNumberBranch: '01',
          },
        ],
      } as any,
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported_selection_comment_parameter',
          bundleName: 'parameter-comment',
        }),
      ]),
    );
  });

  it('otherOrder は classCode が妥当でも send-block で送信前 issue を返す', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'otherOrder',
        bundleName: 'local-only-other',
        classCode: '800',
        items: [{ code: '180000210', name: 'other-main', quantity: '1', unit: '回' }],
      } as any,
    ]);

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.entity === 'otherOrder')).toBe(true);
  });

  it('injectionOrder では admin があり adminCode が無くても送信前 issue にしない', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'injectionOrder',
        bundleName: 'local-admin-without-code',
        classCode: '310',
        admin: '静注',
        adminCode: '',
        items: [{ code: '620000012', name: 'DRUG_C', quantity: '1', unit: 'ampoule', rowRole: 'main' }],
      } as any,
    ]);

    expect(issues).toEqual([]);
  });

  it('injectionOrder で comment-only bundle は送信前 issue を返す', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'injectionOrder',
        bundleName: 'comment-only-injection',
        classCode: '310',
        admin: '静注',
        adminCode: '4101',
        items: [{ code: '0085001', name: 'COMMENT', quantity: '', unit: '', memo: 'slow', rowRole: 'comment' }],
      } as any,
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_main_row',
          bundleName: 'comment-only-injection',
        }),
      ]),
    );
  });

  it('buildMedicalModV2RequestXml は unsupported な unit を送信 payload から除外する', () => {
    const normalized = toMedicalModV2InformationWithSource({
      entity: 'radiologyOrder',
      bundleName: '胸部CT',
      bundleNumber: '1',
      items: [{ code: '170017510', name: 'ＣＴ診断料', quantity: '1', unit: '回', memo: '' }],
    } as any);

    const payload = buildMedicalModV2RequestXml({
      patientId: '000001',
      performDate: '2026-03-09T09:30:00',
      departmentCode: '01',
      physicianCode: '10001',
      medicalInformation: normalized ? [normalized.info] : [],
    });

    expect(JSON.stringify(payload.medicalInformation)).not.toContain('"unit"');
  });

  it('normalize は explicit bodyPart と adminCode を first-class で保持する', () => {
    const normalized = normalizeOrderBundleToRp({
      entity: 'radiologyOrder',
      bundleName: '胸部CT',
      bundleNumber: '1',
      admin: '静注',
      adminCode: '4101',
      bodyPart: { code: '002', name: '胸部', quantity: '1', unit: '部位', memo: '' },
      items: [{ code: '170017510', name: 'ＣＴ診断料', quantity: '1', unit: '回', memo: '' }],
    } as any);

    expect(normalized?.header.admin).toBe('静注');
    expect(normalized?.header.adminCode).toBe('4101');
    expect(normalized?.rows.map((row) => row.source.kind)).toEqual(['body_part', 'bundle_item']);
    expect(normalized?.rows[0]?.medication).toEqual(
      expect.objectContaining({
        code: '002',
      }),
    );
  });

  it('normalize は testOrder の admin/comment を local-only として payload に出さない', () => {
    const bundle = {
      entity: 'testOrder',
      bundleName: '検査セット',
      bundleNumber: '2',
      classCode: '600',
      className: '検査',
      admin: '採血',
      adminMemo: '院内メモ',
      memo: 'bundle memo',
      items: [
        { code: '160000010', name: '検査A', quantity: '1', unit: '回', memo: 'item memo A', rowRole: 'main' },
        { code: '0085001', name: 'コメント', quantity: '', unit: '', memo: 'comment memo', rowRole: 'comment' },
        { code: '160000011', name: '検査B', quantity: '1', unit: '回', memo: 'item memo B', rowRole: 'main' },
      ],
    } as any;
    const normalized = normalizeOrderBundleToRp(bundle);
    const medicalInfo = toMedicalModV2InformationWithSource(bundle);

    expect(normalized?.header.admin).toBe('採血');
    expect(normalized?.rows.map((row) => row.medication.code)).toEqual(['160000010', '160000011', '0085001']);
    expect(normalized?.rows.map((row) => row.source.kind)).toEqual(['bundle_item', 'bundle_item', 'bundle_item']);

    const payload = buildMedicalModV2RequestXml({
      patientId: '000001',
      performDate: '2026-03-09T09:30:00',
      departmentCode: '01',
      physicianCode: '10001',
      medicalInformation: medicalInfo ? [medicalInfo.info] : [],
    });

    expect(payload.medicalInformation?.[0]?.medications.map((row) => row.code)).toEqual([
      '160000010',
      '160000011',
      '0085001',
    ]);
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('採血');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('院内メモ');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('bundle memo');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('item memo');
  });

  it('normalize は injectionOrder の synthetic admin row を作らない', () => {
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
      '830000001',
      '620000012',
      '700000031',
      '0085001',
    ]);
  });

  it('injectionOrder で material row は main-row requirement を満たさない', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'injectionOrder',
        bundleName: 'material-only',
        classCode: '310',
        admin: '点滴',
        adminCode: '4103',
        items: [{ code: '700000031', name: 'DRIP_SET', quantity: '1', unit: 'set', rowRole: 'material' }],
      } as any,
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_main_row',
          bundleName: 'material-only',
        }),
      ]),
    );
  });

  it('injectionOrder は bodyPart/comment/material だけの bundle を sendable main row に数えない', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'injectionOrder',
        bundleName: 'aux-only',
        classCode: '310',
        admin: '点滴',
        adminCode: '4103',
        bodyPart: { code: '002', name: '胸部', quantity: '1', unit: '部位', rowRole: 'bodyPart' },
        items: [
          { code: '700000031', name: 'DRIP_SET', quantity: '1', unit: 'set', rowRole: 'material' },
          { code: '0085001', name: 'COMMENT', quantity: '', unit: '', rowRole: 'comment' },
        ],
      } as any,
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported_body_part',
          bundleName: 'aux-only',
        }),
      ]),
    );
  });

  it('injectionOrder で adminMemo/speed を持つ bundle は送信前 issue を返す', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'injectionOrder',
        bundleName: 'admin-memo',
        classCode: '310',
        admin: '点滴',
        adminCode: '4103',
        adminMemo: '20ml/h',
        items: [{ code: '620000001', name: '輸液A', quantity: '1', unit: 'A', rowRole: 'main' }],
      } as any,
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported_admin_memo',
          bundleName: 'admin-memo',
        }),
      ]),
    );
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
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: '処置',
                bundleNumber: '1',
                items: [{ code: '140000610', name: '処置', quantity: '1', unit: '回' }],
              },
            ]
          : [],
    }));

    const result = await fetchMedicalModV2OrderBundles('000001', '2026-03-09', 'F001:E777');

    expect(fetchPrescriptionOrder).toHaveBeenCalledWith({
      patientId: '000001',
      from: '2026-03-09',
      encounterId: 'F001:E777',
    });
    expect(fetchOrderBundles).not.toHaveBeenCalledWith(expect.objectContaining({ entity: 'medOrder' }));
    expect(result.errors).toEqual([]);
    expect(result.bundles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'medOrder',
          bundleName: 'RP1',
          admin: '毎食後',
        }),
        expect.objectContaining({
          entity: 'treatmentOrder',
          bundleName: '処置',
        }),
      ]),
    );
  });
});
