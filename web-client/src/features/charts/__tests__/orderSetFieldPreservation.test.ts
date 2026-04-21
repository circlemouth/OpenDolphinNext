import { afterEach, describe, expect, it } from 'vitest';

import {
  clearChartOrderSetStorage,
  getChartOrderSet,
  saveChartOrderSet,
  type ChartOrderSetTemplateSnapshot,
} from '../chartOrderSetStorage';

afterEach(() => {
  clearChartOrderSetStorage();
});

describe('order set field preservation boundary', () => {
  it('documents current lossy risk for extended order bundle fields in chart order sets', () => {
    const saved = saveChartOrderSet({
      facilityId: 'facility-A',
      userId: 'doctor-1',
      name: '拡張オーダー項目セット',
      snapshot: {
        diagnoses: [],
        orderBundles: [
          {
            entity: 'radiologyOrder',
            bundleName: '胸部CT',
            bundleNumber: '1',
            classCode: '700',
            className: '画像診断',
            admin: '造影あり',
            adminCode: '4103',
            adminMemo: '20ml/h',
            memo: 'local memo',
            subtype: 'specimen',
            bacteria: {
              specimen: { role: 'specimen', code: '830000001', name: '検体', inputValue: '喀痰' },
            },
            items: [{ code: '170017510', name: 'CT撮影', quantity: '1', unit: '回', memo: 'item memo' }],
            materialItems: [{ code: '700000031', name: '造影材料', quantity: '1', unit: '本', rowRole: 'material' }],
            commentItems: [{ code: '0085001', name: 'コメント', quantity: '', unit: '', memo: 'comment' }],
            bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: 'body part' },
          },
        ],
      } as unknown as ChartOrderSetTemplateSnapshot,
    });

    const detail = getChartOrderSet({ facilityId: 'facility-A', userId: 'doctor-1', id: saved.id });
    const bundle = detail?.snapshot.orderBundles[0] as unknown as Record<string, unknown>;

    expect(bundle).toEqual(
      expect.objectContaining({
        entity: 'radiologyOrder',
        bundleName: '胸部CT',
        classCode: '700',
        className: '画像診断',
      }),
    );
    expect(bundle.items).toEqual([{ code: '170017510', name: 'CT撮影', quantity: '1', unit: '回', memo: 'item memo' }]);

    expect(bundle).not.toHaveProperty('bundleNumber');
    expect(bundle).not.toHaveProperty('admin');
    expect(bundle).not.toHaveProperty('adminCode');
    expect(bundle).not.toHaveProperty('adminMemo');
    expect(bundle).not.toHaveProperty('memo');
    expect(bundle).not.toHaveProperty('subtype');
    expect(bundle).not.toHaveProperty('bacteria');
    expect(bundle).not.toHaveProperty('materialItems');
    expect(bundle).not.toHaveProperty('commentItems');
    expect(bundle).not.toHaveProperty('bodyPart');
  });
});
