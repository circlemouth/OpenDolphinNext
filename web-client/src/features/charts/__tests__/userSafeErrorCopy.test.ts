import { describe, expect, it } from 'vitest';

import { resolveUserSafeFetchFailure, resolveUserSafeOperationFailure } from '../userSafeErrorCopy';

describe('userSafeErrorCopy', () => {
  it('fetch failure は auth hint を再ログイン guidance に寄せる', () => {
    expect(resolveUserSafeFetchFailure('オーダー情報', '401 unauthorized from backend-node-3')).toBe(
      'オーダー情報を取得できませんでした。再ログインしてからやり直してください。',
    );
  });

  it('fetch failure は raw internal detail を generic retry copy に寄せる', () => {
    const message = resolveUserSafeFetchFailure('オーダー情報', 'HTTP 500 (/api/local/order/bundles)');

    expect(message).toBe('オーダー情報の取得に失敗しました。時間をおいて再試行してください。');
    expect(message).not.toContain('/api/local/order/bundles');
  });

  it('operation failure は network hint を安全な再試行 guidance に寄せる', () => {
    expect(resolveUserSafeOperationFailure('network timeout from backend-node-3')).toBe(
      '通信状態を確認してから再試行してください。',
    );
  });
});
