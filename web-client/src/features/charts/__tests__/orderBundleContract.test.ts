import { describe, expect, it } from 'vitest';

import {
  isExactTestOrderClassCode,
  isRejectedTestOrderClassCode,
  isStandaloneSurgeryClassCode,
  resolveOrderBundleItemRowRole,
} from '../orderBundleContract';

describe('orderBundleContract grammar', () => {
  it('surgeryOrder は explicit material を main へ降格しない', () => {
    expect(
      resolveOrderBundleItemRowRole('surgeryOrder', {
        code: '700000031',
        name: 'surgery-material',
        rowRole: 'material',
      }),
    ).toBe('material');
  });

  it('surgeryOrder は 7桁材料コードを material として解決する', () => {
    expect(
      resolveOrderBundleItemRowRole('surgeryOrder', {
        code: '700000031',
        name: 'surgery-material',
      }),
    ).toBe('material');
  });

  it('otherOrder は explicit local-only code を main 扱いする', () => {
    expect(
      resolveOrderBundleItemRowRole('otherOrder', {
        code: 'LOCAL_OTHER:CERTIFICATE_FEE',
        name: 'explicit-local-only-shape',
      }),
    ).toBe('main');
  });

  it('testOrder exact allowlist と surgery standalone helper を共有する', () => {
    expect(isExactTestOrderClassCode('600')).toBe(true);
    expect(isExactTestOrderClassCode('610')).toBe(true);
    expect(isExactTestOrderClassCode('611')).toBe(false);
    expect(isExactTestOrderClassCode('699')).toBe(false);
    expect(isRejectedTestOrderClassCode('640')).toBe(true);
    expect(isRejectedTestOrderClassCode('643')).toBe(true);
    expect(isStandaloneSurgeryClassCode('501')).toBe(true);
    expect(isStandaloneSurgeryClassCode('502')).toBe(true);
    expect(isStandaloneSurgeryClassCode('500')).toBe(false);
  });
});
