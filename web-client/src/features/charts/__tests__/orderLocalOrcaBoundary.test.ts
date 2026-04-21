import { describe, expect, it } from 'vitest';

import { buildMedicalModV2RequestXml } from '../orcaClaimApi';
import {
  collectMedicalModV2BundleIssues,
  prepareMedicalModV2SendData,
  toMedicalModV2InformationWithSource,
} from '../orderRpNormalization';
import type { OrderBundle } from '../orderBundleApi';

const encounterContext = {
  patientId: '000001',
  visitDate: '2026-04-21T09:30:00',
  departmentCode: '01',
  physicianCode: '10001',
  insuranceCombinationNumber: '0001',
  voucherNumber: '1234',
  sequentialNumber: '1',
};

const sendableBundles: OrderBundle[] = [
  {
    entity: 'medOrder',
    bundleName: '処方RP',
    bundleNumber: '7',
    classCode: '212',
    className: '処方',
    items: [
      { code: '620000001', name: 'アムロジピン', quantity: '1', unit: '錠', rowRole: 'main' },
      { code: '830000001', name: '処方コメント', quantity: '', unit: '', structuredCommentValue: '補足', rowRole: 'comment' },
    ],
  },
  {
    entity: 'injectionOrder',
    bundleName: '点滴',
    bundleNumber: '1',
    classCode: '310',
    className: '注射',
    admin: '点滴静注',
    adminCode: '4103',
    items: [
      { code: '620000012', name: '注射薬A', quantity: '1', unit: 'A', rowRole: 'main' },
      { code: '700000031', name: 'ドリップセット', quantity: '1', unit: '式', rowRole: 'material' },
      { code: '0085001', name: 'コメント', quantity: '', unit: '', memo: 'slow', rowRole: 'comment' },
    ],
  },
  {
    entity: 'testOrder',
    bundleName: '検体検査',
    bundleNumber: '1',
    subtype: 'specimen',
    classCode: '600',
    className: '検査',
    admin: '空腹',
    memo: 'local memo must not enter payload',
    items: [
      { code: '160000010', name: 'CBC', quantity: '1', unit: '回', memo: 'local item memo', rowRole: 'main' },
      { code: '0085001', name: '検査コメント', quantity: '', unit: '', memo: 'comment memo', rowRole: 'comment' },
    ],
  },
  {
    entity: 'radiologyOrder',
    bundleName: '胸部CT',
    bundleNumber: '1',
    classCode: '700',
    className: '画像診断',
    bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', rowRole: 'bodyPart' },
    items: [{ code: '170017510', name: 'CT撮影', quantity: '1', unit: '回', rowRole: 'main' }],
  },
  {
    entity: 'treatmentOrder',
    bundleName: '創傷処置',
    bundleNumber: '1',
    classCode: '400',
    className: '処置',
    items: [
      { code: '140000610', name: '創傷処置', quantity: '1', unit: '回', rowRole: 'main' },
      { code: '700000031', name: '処置材料', quantity: '1', unit: '個', rowRole: 'material' },
      { code: '0085001', name: '処置コメント', quantity: '', unit: '', memo: '洗浄後', rowRole: 'comment' },
    ],
  },
  {
    entity: 'surgeryOrder',
    bundleName: '縫合',
    bundleNumber: '1',
    classCode: '500',
    className: '手術',
    items: [
      { code: '150000001', name: '縫合術', quantity: '1', unit: '回', rowRole: 'main' },
      { code: '700000031', name: '縫合糸', quantity: '1', unit: '本', rowRole: 'material' },
      { code: '0085001', name: '手術コメント', quantity: '', unit: '', memo: '局麻下', rowRole: 'comment' },
    ],
  },
];

describe('local-vs-ORCA medicalmodv2 boundary', () => {
  it('builds static medicalmodv2 payload data only for sendable order entities', () => {
    const prepared = prepareMedicalModV2SendData(sendableBundles);
    const requestPayload = buildMedicalModV2RequestXml({
      encounterContext,
      medicalInformation: prepared.medicalInformation,
    });

    expect(prepared.requiredIssues).toEqual([]);
    expect(prepared.bundleIssues).toEqual([]);
    expect(prepared.codeIssues).toEqual([]);
    expect(prepared.invalidCodes).toEqual([]);
    expect(requestPayload.medicalInformation).toEqual([
      {
        entity: 'medOrder',
        medicalClass: '212',
        medicalClassName: '処方',
        medicalClassNumber: '7',
        medications: [
          { code: '620000001', name: 'アムロジピン', number: '1', genericFlg: undefined },
          { code: '830000001', name: '補足', number: undefined, genericFlg: undefined },
        ],
      },
      {
        entity: 'injectionOrder',
        medicalClass: '310',
        medicalClassName: '注射',
        medicalClassNumber: '1',
        medications: [
          { code: '620000012', name: '注射薬A', number: '1', genericFlg: undefined },
          { code: '700000031', name: 'ドリップセット', number: '1', genericFlg: undefined },
          { code: '0085001', name: 'コメント', number: undefined, genericFlg: undefined },
        ],
      },
      {
        entity: 'testOrder',
        medicalClass: '600',
        medicalClassName: '検査',
        medicalClassNumber: '1',
        medications: [
          { code: '160000010', name: 'CBC', number: '1', genericFlg: undefined },
          { code: '0085001', name: '検査コメント', number: undefined, genericFlg: undefined },
        ],
      },
      {
        entity: 'radiologyOrder',
        medicalClass: '700',
        medicalClassName: '画像診断',
        medicalClassNumber: '1',
        medications: [
          { code: '002001', name: '胸部', number: '1', genericFlg: undefined },
          { code: '170017510', name: 'CT撮影', number: '1', genericFlg: undefined },
        ],
      },
      {
        entity: 'treatmentOrder',
        medicalClass: '400',
        medicalClassName: '処置',
        medicalClassNumber: '1',
        medications: [
          { code: '140000610', name: '創傷処置', number: '1', genericFlg: undefined },
          { code: '700000031', name: '処置材料', number: '1', genericFlg: undefined },
          { code: '0085001', name: '処置コメント', number: undefined, genericFlg: undefined },
        ],
      },
      {
        entity: 'surgeryOrder',
        medicalClass: '500',
        medicalClassName: '手術',
        medicalClassNumber: '1',
        medications: [
          { code: '150000001', name: '縫合術', number: '1', genericFlg: undefined },
          { code: '700000031', name: '縫合糸', number: '1', genericFlg: undefined },
          { code: '0085001', name: '手術コメント', number: undefined, genericFlg: undefined },
        ],
      },
    ]);

    const serialized = JSON.stringify(requestPayload.medicalInformation);
    expect(serialized).not.toContain('空腹');
    expect(serialized).not.toContain('local memo must not enter payload');
    expect(serialized).not.toContain('local item memo');
  });

  it('blocks local-only or unsupported entities before static medicalmodv2 payload construction', () => {
    const blockedBundles: OrderBundle[] = [
      {
        entity: 'physiologyOrder',
        bundleName: '心電図',
        bundleNumber: '1',
        subtype: 'physiology',
        classCode: '600',
        items: [{ code: '160000020', name: '心電図', quantity: '1', unit: '回', rowRole: 'main' }],
      },
      {
        entity: 'bacteriaOrder',
        bundleName: '細菌培養',
        bundleNumber: '1',
        subtype: 'culture',
        classCode: '600',
        items: [{ code: '160000030', name: '培養検査', quantity: '1', unit: '回', rowRole: 'main' }],
      },
      {
        entity: 'otherOrder',
        bundleName: '文書料',
        bundleNumber: '1',
        items: [{ code: 'LOCAL_OTHER:CERTIFICATE_FEE', name: '文書料', quantity: '1', unit: '回', rowRole: 'main' }],
      },
    ];

    expect(collectMedicalModV2BundleIssues(blockedBundles)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: 'physiologyOrder', code: 'unsupported_physiology_order' }),
        expect.objectContaining({ entity: 'bacteriaOrder', code: 'unsupported_bacteria_order' }),
        expect.objectContaining({ entity: 'otherOrder', code: 'invalid_other_order_class' }),
      ]),
    );

    const prepared = prepareMedicalModV2SendData(blockedBundles);
    expect(prepared.medicalInformation).toEqual([]);
    expect(prepared.bundleIssues.map((issue) => issue.code).sort()).toEqual([
      'invalid_other_order_class',
      'unsupported_bacteria_order',
      'unsupported_physiology_order',
    ]);
    expect(blockedBundles.map((bundle) => toMedicalModV2InformationWithSource(bundle))).toEqual([null, null, null]);
  });

  it('keeps material rows dependent on a clinical parent row in static payload sources', () => {
    const treatment = sendableBundles.find((bundle) => bundle.entity === 'treatmentOrder');
    const surgery = sendableBundles.find((bundle) => bundle.entity === 'surgeryOrder');
    expect(treatment).toBeTruthy();
    expect(surgery).toBeTruthy();

    const treatmentPayload = toMedicalModV2InformationWithSource(treatment!);
    const surgeryPayload = toMedicalModV2InformationWithSource(surgery!);

    expect(treatmentPayload?.source.rows.map((row) => row.source.kind === 'bundle_item' ? row.source.rowRole : row.source.kind)).toEqual([
      'main',
      'material',
      'comment',
    ]);
    expect(surgeryPayload?.source.rows.map((row) => row.source.kind === 'bundle_item' ? row.source.rowRole : row.source.kind)).toEqual([
      'main',
      'material',
      'comment',
    ]);
  });
});
