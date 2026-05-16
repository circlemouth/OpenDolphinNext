import { describe, expect, it } from 'vitest';

import {
  INJECTION_LOCAL_META_PREFIX,
  formatInjectionAdminMemo,
  parseInjectionAdminMemo,
} from '../injectionLocalMeta';

describe('injectionLocalMeta', () => {
  it('速度指定と点滴速度を adminMemo prefix に保存し、表示用 memo からは隠す', () => {
    const raw = formatInjectionAdminMemo(
      { speedMode: 'specified', dripSpeedMlPerHour: '80' },
      '点滴中に疼痛確認',
    );

    expect(raw.startsWith(INJECTION_LOCAL_META_PREFIX)).toBe(true);

    const parsed = parseInjectionAdminMemo(raw);
    expect(parsed.meta).toEqual({ speedMode: 'specified', dripSpeedMlPerHour: '80' });
    expect(parsed.memoText).toBe('点滴中に疼痛確認');
  });

  it('meta がない既存 adminMemo はそのまま扱う', () => {
    const parsed = parseInjectionAdminMemo('既存メモ');
    expect(parsed.hasMeta).toBe(false);
    expect(parsed.meta).toEqual({});
    expect(parsed.memoText).toBe('既存メモ');
    expect(formatInjectionAdminMemo(parsed.meta, parsed.memoText)).toBe('既存メモ');
  });
});
