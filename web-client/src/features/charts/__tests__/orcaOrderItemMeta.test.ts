import { describe, expect, it } from 'vitest';

import {
  formatOrcaOrderItemMemo,
  parseOrcaOrderItemMemo,
  updateOrcaOrderItemMeta,
} from '../orcaOrderItemMeta';

describe('orcaOrderItemMeta', () => {
  it('parse で genericFlg tri-state と userComment を読み取る', () => {
    const parsed = parseOrcaOrderItemMemo('__orca_meta__:{"genericFlg":"inherit","userComment":"食後"}\n元メモ');

    expect(parsed.meta).toEqual({
      genericFlg: 'inherit',
      userComment: '食後',
    });
    expect(parsed.memoText).toBe('元メモ');
  });

  it('parse で userComment が文字列以外なら無視する', () => {
    const parsed = parseOrcaOrderItemMemo('__orca_meta__:{"genericFlg":"no","userComment":1}\n元メモ');

    expect(parsed.meta.genericFlg).toBe('no');
    expect(parsed.meta.userComment).toBeUndefined();
  });

  it('format で tri-state genericFlg と userComment を出力する', () => {
    const formatted = formatOrcaOrderItemMemo(
      {
        genericFlg: 'inherit',
        userComment: '食後',
      },
      '元メモ',
    );

    expect(formatted).toBe('__orca_meta__:{"genericFlg":"inherit","userComment":"食後"}\n元メモ');
  });

  it('update で空白のみ userComment を除去し genericFlg tri-state を保持する', () => {
    const updated = updateOrcaOrderItemMeta('__orca_meta__:{"genericFlg":"inherit","userComment":"食後"}\n元メモ', {
      userComment: '   ',
    });

    const parsed = parseOrcaOrderItemMemo(updated);
    expect(parsed.meta.genericFlg).toBe('inherit');
    expect(parsed.meta.userComment).toBeUndefined();
    expect(parsed.memoText).toBe('元メモ');
  });

  it('update で meta が空になれば本文のみを残す', () => {
    const updated = updateOrcaOrderItemMeta('__orca_meta__:{"genericFlg":"inherit","userComment":"食後"}\n元メモ', {
      genericFlg: undefined,
      userComment: '   ',
    });

    expect(updated).toBe('元メモ');
  });
});
