import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveCanonicalOrderEntity } from '../orderCategoryRegistry';
import { buildMedicalModV2RequestXml } from '../orcaClaimApi';
import {
  collectMedicalModV2BundleIssues,
  collectMedicalModV2BundleIssuesForBundle,
  fetchMedicalModV2OrderBundles,
  normalizeOrderBundleToRp,
  prepareMedicalModV2SendData,
  toMedicalModV2InformationWithSource,
} from '../orderRpNormalization';
import { fetchOrderBundles } from '../orderBundleApi';
import { buildEmptyPrescriptionOrder, buildPrescriptionOrderSendBundles, fetchPrescriptionOrder, type PrescriptionOrder } from '../prescriptionOrderApi';

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
        bundleName: '混在束',
        classCode: '400',
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
        classCode: '700',
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

  it.each([
    { subtype: '', label: 'subtype 空' },
    { subtype: 'culture', label: 'subtype あり' },
  ])('bacteriaOrder は $label でも entity 単位で送信前 issue を返す', ({ subtype }) => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'bacteriaOrder',
        bundleName: '細菌培養',
        subtype,
        classCode: '600',
        items: [{ code: '160000010', name: '培養検査', quantity: '1', unit: '回', memo: '' }],
      } as any,
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported_bacteria_order',
          bundleName: '細菌培養',
        }),
      ]),
    );
  });

  it('prepareMedicalModV2SendData は bacteriaOrder を subtype に依存せず fail-close する', () => {
    const bundle = {
      entity: 'bacteriaOrder',
      bundleName: '細菌培養',
      bundleNumber: '1',
      classCode: '600',
      items: [{ code: '160000010', name: '培養検査', quantity: '1', unit: '回', memo: '' }],
    } as any;

    expect(collectMedicalModV2BundleIssuesForBundle(bundle)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported_bacteria_order',
          bundleName: '細菌培養',
        }),
      ]),
    );

    const prepared = prepareMedicalModV2SendData([bundle]);
    expect(prepared.bundleIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unsupported_bacteria_order',
          entity: 'bacteriaOrder',
        }),
      ]),
    );
    expect(prepared.medicalInformation).toEqual([]);
  });

  it('parameter 付き選択式コメントは送信前 issue を返す', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'treatmentOrder',
        bundleName: 'parameter-comment',
        classCode: '400',
        items: [
          { code: '140000610', name: '創傷処置', quantity: '1', unit: '回', rowRole: 'main' },
          {
            code: '0082',
            name: '食後',
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

  it('otherOrder は explicit local-only 契約として送信前 issue を返す', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'otherOrder',
        bundleName: 'invalid-other-class',
        classCode: '8A0',
        items: [{ code: 'LOCAL_OTHER:CERTIFICATE_FEE', name: 'other-main', quantity: '1', unit: '回' }],
      } as any,
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual(
      expect.objectContaining({
        code: 'invalid_other_order_class',
        bundleName: 'invalid-other-class',
      }),
    );
  });

  it.each([
    { entity: 'treatmentOrder', expected: 'invalid_class_code' },
    { entity: 'injectionOrder', expected: 'invalid_injection_class_code' },
    { entity: 'baseChargeOrder', expected: 'invalid_class_code' },
  ])('exact-class entity $entity rejects blank classCode before ORCA send', ({ entity, expected }) => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity,
        bundleName: 'missing-class-code',
        items: [{ code: '140000610', name: 'main-item', quantity: '1', unit: '回', rowRole: 'main' }],
      } as any,
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: expected,
          bundleName: 'missing-class-code',
        }),
      ]),
    );
  });

  it('injectionOrder で admin があり adminCode が無くても main row があれば送信前 issue を返さない', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'injectionOrder',
        bundleName: 'missing-admin-code',
        classCode: '310',
        admin: '静注',
        adminCode: '',
        items: [{ code: '620000012', name: 'DRUG_C', quantity: '1', unit: 'ampoule', rowRole: 'main' }],
      } as any,
    ]);

    expect(issues).toHaveLength(0);
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

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual(
      expect.objectContaining({
        code: 'missing_main_row',
        bundleName: 'comment-only-injection',
      }),
    );
  });

  it.each(['332', '335', '352'])('injectionOrder は exact allowlist 外 classCode=%s を送信前に reject する', (classCode) => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'injectionOrder',
        bundleName: `invalid-injection-${classCode}`,
        classCode,
        admin: '静注',
        adminCode: '4101',
        items: [{ code: '620000012', name: 'DRUG_C', quantity: '1', unit: 'ampoule', rowRole: 'main' }],
      } as any,
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid_injection_class_code',
          bundleName: `invalid-injection-${classCode}`,
        }),
      ]),
    );
  });

  it('surgeryOrder の 7xxxxxxxxx 行は explicit rowRole がなくても send 正規化で material になる', () => {
    const normalized = normalizeOrderBundleToRp({
      entity: 'surgeryOrder',
      bundleName: '手術材料',
      bundleNumber: '1',
      classCode: '500',
      items: [
        { code: '150000001', name: '手術主行', quantity: '1', unit: '回', memo: '' },
        { code: '700000031', name: '縫合糸', quantity: '1', unit: '本', memo: '' },
      ],
    } as any);

    expect(normalized?.rows.map((row) => row.medication.code)).toEqual(['150000001', '700000031']);
    expect(normalized?.rows.map((row) => row.source.kind === 'bundle_item' ? row.source.rowRole : 'bodyPart')).toEqual([
      'main',
      'material',
    ]);
  });

  it('surgeryOrder の implicit material は send row partition で main row に混ざらない', () => {
    const normalized = toMedicalModV2InformationWithSource({
      entity: 'surgeryOrder',
      bundleName: '手術材料',
      bundleNumber: '1',
      classCode: '500',
      items: [
        { code: '150000001', name: '手術主行', quantity: '1', unit: '回', memo: '' },
        { code: '700000031', name: '縫合糸', quantity: '1', unit: '本', memo: '' },
      ],
    } as any);

    expect(normalized?.source.rows.map((row) => row.source.kind === 'bundle_item' ? row.source.rowRole : 'bodyPart')).toEqual([
      'main',
      'material',
    ]);
    expect(normalized?.info.medications.map((row) => row.code)).toEqual(['150000001', '700000031']);
  });

  it('surgeryOrder 501/502 standalone は material-only でも main-row 必須除外を維持する', () => {
    const bundle = {
      entity: 'surgeryOrder',
      bundleName: '手術材料のみ',
      bundleNumber: '1',
      classCode: '501',
      items: [{ code: '700000031', name: '縫合糸', quantity: '1', unit: '本', memo: '' }],
    } as any;

    expect(collectMedicalModV2BundleIssues([bundle])).toEqual([]);

    const prepared = prepareMedicalModV2SendData([bundle]);
    expect(prepared.bundleIssues).toEqual([]);
    expect(prepared.medicalInformation).toEqual([
      expect.objectContaining({
        medicalClass: '501',
        medications: [expect.objectContaining({ code: '700000031', name: '縫合糸' })],
      }),
    ]);
  });

  it('buildMedicalModV2RequestXml は unsupported な unit を送信 payload から除外する', () => {
    const normalized = toMedicalModV2InformationWithSource({
      entity: 'radiologyOrder',
      bundleName: '胸部CT',
      bundleNumber: '1',
      classCode: '700',
      items: [{ code: '170017510', name: 'ＣＴ撮影', quantity: '1', unit: '回', memo: '' }],
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
      classCode: '700',
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
      admin: '空腹',
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

    expect(normalized?.header.admin).toBe('空腹');
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
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('空腹');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('院内メモ');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('bundle memo');
    expect(JSON.stringify(payload.medicalInformation)).not.toContain('item memo');
  });

  it('normalize は injectionOrder の local-only admin 行を送信 payload へ含めない', () => {
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

  it('medOrder structured claim comment は family ごとに correct carrier を使う', () => {
    const order: PrescriptionOrder = {
      patientId: '000001',
      encounterDate: '2026-03-09',
      performDate: '2026-03-09',
      doctorComment: '',
      deletedDocumentIds: [],
      rps: [
        {
          rpId: 'rp-1',
          name: '処方RP',
          location: 'out',
          category: 'regular',
          usage: '毎食後',
          usageCode: '001000',
          daysOrTimes: '7',
          remark: '',
          refillPattern: 'none',
          doctorComment: '',
          started: '2026-03-09',
          claimComments: [
            { id: 'rp-830', code: '830000001', name: '自由記載', note: '補足メモ' },
            { id: 'rp-842', code: '842000001', name: '数量指定', note: '1.5' },
            { id: 'rp-831', code: '831000001', name: '管理番号', note: '123456789' },
          ],
          drugs: [
            {
              rowId: 'drug-1',
              code: '620000001',
              name: 'アムロジピン',
              quantity: '1',
              unit: '錠',
              genericChangeAllowed: true,
              isGeneralNamePrescription: false,
              drugComment: '',
              claimComments: [
                { id: 'claim-8501', code: '850100001', name: '日付', note: '2026-04-09' },
                { id: 'claim-8511', code: '851100001', name: '月日', note: '04-09' },
                { id: 'claim-8521', code: '852100001', name: '回数', note: '12' },
              ],
              patientRequest: true,
            },
          ],
        },
      ],
    };

    const bundle = buildPrescriptionOrderSendBundles(order)[0];
    const medicalInfo = toMedicalModV2InformationWithSource(bundle);

    expect(medicalInfo?.info.medications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: '830000001', name: '補足メモ', number: undefined }),
        expect.objectContaining({ code: '842000001', name: '数量指定', number: '1.5' }),
        expect.objectContaining({ code: '831000001', name: '管理番号', number: '123456789' }),
        expect.objectContaining({ code: '850100001', name: '日付', number: '2026-04-09' }),
        expect.objectContaining({ code: '851100001', name: '月日', number: '04-09' }),
        expect.objectContaining({ code: '852100001', name: '回数', number: '12' }),
      ]),
    );
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

  it('injectionOrder は rowRole-aware 判定で bodyPart を local-only として block する', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'injectionOrder',
        bundleName: 'aux-only',
        classCode: '310',
        admin: '点滴',
        adminCode: '4103',
        bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', rowRole: 'bodyPart' },
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

  it('injectionOrder は adminMemo を持っていても local-only として送信前 issue を返さない', () => {
    const issues = collectMedicalModV2BundleIssues([
      {
        entity: 'injectionOrder',
        bundleName: 'admin-memo',
        classCode: '310',
        admin: '点滴',
        adminCode: '4103',
        adminMemo: '20ml/h',
        items: [{ code: '620000001', name: '注射薬A', quantity: '1', unit: 'A', rowRole: 'main' }],
      } as any,
    ]);

    expect(issues).toHaveLength(0);
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
        }),
        expect.objectContaining({
          entity: 'treatmentOrder',
          bundleName: '処置',
        }),
      ]),
    );
  });
});
