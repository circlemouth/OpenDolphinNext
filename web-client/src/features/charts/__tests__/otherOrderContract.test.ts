import { describe, expect, it } from 'vitest';

import {
  isOtherOrderBodyPartCode,
  isOtherOrderOpaqueLocalCode,
  isOtherOrderRowRole,
  isOtherOrderSentinelClassCode,
  OTHER_ORDER_ALLOWED_ROW_ROLES,
  OTHER_ORDER_LOCAL_ONLY_SENTINEL_CLASS_CODE,
} from '../otherOrderContract';

describe('otherOrderContract', () => {
  it('explicit local-only sentinel は単一の非ORCA numeric 値に固定される', () => {
    expect(OTHER_ORDER_LOCAL_ONLY_SENTINEL_CLASS_CODE).toBe('LOCAL_OTHER_ORDER');
    expect(/^\d+$/.test(OTHER_ORDER_LOCAL_ONLY_SENTINEL_CLASS_CODE)).toBe(false);
    expect(isOtherOrderSentinelClassCode('LOCAL_OTHER_ORDER')).toBe(true);
    expect(isOtherOrderSentinelClassCode('800')).toBe(false);
  });

  it('rowRole は main/comment だけを許可する', () => {
    expect(OTHER_ORDER_ALLOWED_ROW_ROLES).toEqual(['main', 'comment']);
    expect(isOtherOrderRowRole('main')).toBe(true);
    expect(isOtherOrderRowRole('comment')).toBe(true);
    expect(isOtherOrderRowRole('material')).toBe(false);
    expect(isOtherOrderRowRole('bodyPart')).toBe(false);
  });

  it('opaque local code は bodyPart/comment carrier shape を reject する', () => {
    expect(isOtherOrderOpaqueLocalCode('LOCAL-001')).toBe(true);
    expect(isOtherOrderOpaqueLocalCode('180000210')).toBe(true);
    expect(isOtherOrderOpaqueLocalCode('81234567')).toBe(true);
    expect(isOtherOrderOpaqueLocalCode('002001')).toBe(false);
    expect(isOtherOrderOpaqueLocalCode('0085001')).toBe(false);
    expect(isOtherOrderBodyPartCode('002001')).toBe(true);
  });
});
