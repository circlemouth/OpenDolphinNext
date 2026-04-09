import { describe, expect, it } from 'vitest';

import {
  isOtherOrderBodyPartCode,
  isOtherOrderLocalOnlyCode,
  isOtherOrderRowRole,
  isOtherOrderSentinelClassCode,
  OTHER_ORDER_ALLOWED_ROW_ROLES,
  OTHER_ORDER_LOCAL_ONLY_SENTINEL_CLASS_CODE,
} from '../otherOrderContract';

describe('otherOrderContract', () => {
  it('explicit local-only sentinel は単一の非ORCA numeric 値に固定される', () => {
    expect(OTHER_ORDER_LOCAL_ONLY_SENTINEL_CLASS_CODE).toBe('LOCAL_OTHER');
    expect(/^\d+$/.test(OTHER_ORDER_LOCAL_ONLY_SENTINEL_CLASS_CODE)).toBe(false);
    expect(isOtherOrderSentinelClassCode('LOCAL_OTHER')).toBe(true);
    expect(isOtherOrderSentinelClassCode('800')).toBe(false);
  });

  it('rowRole は main/comment だけを許可する', () => {
    expect(OTHER_ORDER_ALLOWED_ROW_ROLES).toEqual(['main', 'comment']);
    expect(isOtherOrderRowRole('main')).toBe(true);
    expect(isOtherOrderRowRole('comment')).toBe(true);
    expect(isOtherOrderRowRole('material')).toBe(false);
    expect(isOtherOrderRowRole('bodyPart')).toBe(false);
  });

  it('explicit local-only code は LOCAL_OTHER: プレフィックスに固定される', () => {
    expect(isOtherOrderLocalOnlyCode('LOCAL_OTHER:CERTIFICATE_FEE')).toBe(true);
    expect(isOtherOrderLocalOnlyCode('LOCAL_OTHER:LOCAL-NOTE.01')).toBe(true);
    expect(isOtherOrderLocalOnlyCode('180000210')).toBe(false);
    expect(isOtherOrderLocalOnlyCode('LOCAL-001')).toBe(false);
    expect(isOtherOrderLocalOnlyCode('LOCAL_OTHER:')).toBe(false);
    expect(isOtherOrderLocalOnlyCode('002001')).toBe(false);
    expect(isOtherOrderLocalOnlyCode('0085001')).toBe(false);
    expect(isOtherOrderBodyPartCode('002001')).toBe(true);
  });
});
