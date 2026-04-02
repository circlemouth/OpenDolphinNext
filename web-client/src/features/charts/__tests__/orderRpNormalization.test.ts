import { describe, expect, it } from 'vitest';

import { resolveCanonicalOrderEntity } from '../orderCategoryRegistry';
import {
  collectMedicalModV2BundleIssues,
  normalizeOrderBundleToRp,
} from '../orderRpNormalization';

describe('orderRpNormalization', () => {
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
});
