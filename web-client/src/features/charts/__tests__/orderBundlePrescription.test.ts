import { describe, expect, it } from 'vitest';

import {
  parsePrescriptionClassCode,
  resolveMedOrderBundleName,
  resolvePrescriptionClassCode,
  toFormState,
} from '../OrderBundleEditPanel';
import type { OrderBundle } from '../orderBundleApi';

describe('prescription class code round trip', () => {
  const cases = [
    { timing: 'regular', location: 'in', code: '211' },
    { timing: 'regular', location: 'out', code: '212' },
    { timing: 'tonyo', location: 'in', code: '221' },
    { timing: 'tonyo', location: 'out', code: '222' },
    { timing: 'gaiyo', location: 'in', code: '231' },
    { timing: 'gaiyo', location: 'out', code: '232' },
  ] as const;

  cases.forEach(({ timing, location, code }) => {
    it(`${timing}:${location} -> ${code}`, () => {
      expect(resolvePrescriptionClassCode(timing, location)).toBe(code);
      expect(parsePrescriptionClassCode(code)).toEqual({ timing, location });
      const bundle: OrderBundle = {
        bundleName: '降圧薬RP',
        bundleNumber: '14',
        classCode: code,
        items: [],
      };
      const form = toFormState(bundle, '2025-12-30');
      expect(form.prescriptionTiming).toBe(timing);
      expect(form.prescriptionLocation).toBe(location);
      expect(form.bundleNumber).toBe('14');
    });
  });
});

describe('resolveMedOrderBundleName', () => {
  it('入力済みのRP名を優先する', () => {
    const name = resolveMedOrderBundleName({
      bundleName: '降圧薬RP',
      items: [{ name: 'アムロジピン', quantity: '1', unit: '錠', memo: '' }],
      prescriptionTiming: 'regular',
      prescriptionLocation: 'out',
    });
    expect(name).toBe('降圧薬RP');
  });

  it('空欄時は1件目の薬剤名を補正する', () => {
    const name = resolveMedOrderBundleName({
      bundleName: '  ',
      items: [{ name: 'アムロジピン', quantity: '1', unit: '錠', memo: '' }],
      prescriptionTiming: 'regular',
      prescriptionLocation: 'out',
    });
    expect(name).toBe('アムロジピン');
  });

  it('薬剤がない場合は処方区分ラベルを補正する', () => {
    const name = resolveMedOrderBundleName({
      bundleName: '',
      items: [{ name: '   ', quantity: '', unit: '', memo: '' }],
      prescriptionTiming: 'regular',
      prescriptionLocation: 'out',
    });
    expect(name).toBe('内用（院外処方）');
  });
});

describe('toFormState non-prescription split rules', () => {
  it('radiologyOrder は 7 で始まる本体コードを材料行へ誤分類しない', () => {
    const bundle: OrderBundle = {
      entity: 'radiologyOrder',
      bundleName: '胸部CT',
      bundleNumber: '3',
      classCode: '700',
      classCodeSystem: 'Claim007',
      className: '画像診断',
      bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '' },
      items: [
        { code: '700000001', name: '胸部CT本体', quantity: '1', unit: '回', memo: '' },
        { code: '700000099', name: '造影剤', quantity: '1', unit: '本', memo: '' },
      ],
    };

    const form = toFormState(bundle, '2026-03-09');

    expect(form.items.map((item) => item.code)).toEqual(expect.arrayContaining(['700000001', '700000099']));
    expect(form.materialItems).toHaveLength(0);
    expect(form.bodyPart).toEqual(expect.objectContaining({ code: '002001', name: '胸部' }));
  });
});
