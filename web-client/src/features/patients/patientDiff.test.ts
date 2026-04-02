import { describe, expect, it } from 'vitest';

import { diffPatientKeys } from './patientDiff';

describe('diffPatientKeys', () => {
  it('detects changed keys for basic section', () => {
    const keys = diffPatientKeys({
      baseline: { patientId: '000001', name: '山田 花子', phone: '03-1111-2222' },
      draft: { patientId: '000001', name: '山田 花子', phone: '03-9999-0000' },
    });
    expect(keys).toEqual(['phone']);
  });

  it('insurance は比較対象に含めない', () => {
    const keys = diffPatientKeys({
      baseline: { patientId: '000001', phone: '03-1111-2222', insurance: '社保12' },
      draft: { patientId: '000001', phone: '03-1111-2222', insurance: '国保34' },
    });
    expect(keys).toEqual([]);
  });
});
