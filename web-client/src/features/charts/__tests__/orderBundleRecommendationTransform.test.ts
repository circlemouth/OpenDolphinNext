import { describe, expect, it } from 'vitest';

import { toFormStateFromRecommendation } from '../OrderBundleEditPanel';

describe('orderBundle recommendation transform', () => {
  it('recommendation の class/admin/material を form state へ保持する', () => {
    const form = toFormStateFromRecommendation(
      {
        bundleName: '訪問看護指示料',
        admin: '1日1回',
        adminCode: '4101',
        adminCodeSystem: 'Claim007',
        bundleNumber: '2',
        classCode: '130',
        classCodeSystem: 'Claim007',
        className: '旧名称',
        adminMemo: '訪問頻度補足',
        memo: '院内メモ',
        items: [{ code: '1300001', name: '医学管理項目', quantity: '1', unit: '回', memo: '' }],
        materialItems: [{ code: '7000001', name: '処置材料', quantity: '1', unit: '個', memo: '' }],
        commentItems: [{ code: '0085001', name: 'コメント', quantity: '', unit: '', memo: '補足' }],
        bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '' },
      },
      '2026-03-09',
    );

    expect(form.classCode).toBe('130');
    expect(form.classCodeSystem).toBe('Claim007');
    expect(form.className).toBe('管理料');
    expect(form.adminMemo).toBe('訪問頻度補足');
    expect(form.adminCode).toBe('4101');
    expect(form.adminCodeSystem).toBe('Claim007');
    expect(form.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: '1300001', name: '医学管理項目' })]),
    );
    expect(form.materialItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: '7000001', name: '処置材料' })]),
    );
    expect(form.commentItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: '0085001', name: 'コメント' })]),
    );
    expect(form.bodyPart).toEqual(expect.objectContaining({ code: '002001', name: '胸部' }));
  });
});
