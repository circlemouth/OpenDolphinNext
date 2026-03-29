import { describe, expect, it } from 'vitest';

import { resolveLoginFailureMessage } from '../loginErrorMessage';

describe('resolveLoginFailureMessage', () => {
  it('maps unauthorized JSON to user-friendly credential guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 401,
      bodyText: JSON.stringify({
        error: 'unauthorized',
        reason: 'authentication_failed',
        message: 'Authentication required',
      }),
    });

    expect(message).toContain('施設ID・ユーザーID・パスワード');
  });

  it('maps principal_unresolved to facility guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 401,
      bodyText: JSON.stringify({
        error: 'unauthorized',
        reason: 'principal_unresolved',
      }),
    });

    expect(message).toContain('施設ID');
  });

  it('maps 403 to permission guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 403,
      bodyText: JSON.stringify({
        error: 'forbidden',
      }),
    });

    expect(message).toContain('アクセス権限');
  });

  it('maps 404 to endpoint guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 404,
      bodyText: '<!doctype html><html><body>Not Found</body></html>',
    });

    expect(message).toContain('ログイン先が見つかりません');
  });

  it('maps 5xx to retry guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 500,
      bodyText: 'Internal Server Error',
    });

    expect(message).toContain('時間をおいて再試行');
  });

  it('maps 429 with Retry-After seconds to wait guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 429,
      bodyText: JSON.stringify({
        error: 'too_many_requests',
      }),
      retryAfter: '120',
    });

    expect(message).toContain('120秒後');
  });

  it('maps 429 without valid Retry-After to generic wait guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 429,
      bodyText: JSON.stringify({
        error: 'too_many_requests',
      }),
      retryAfter: 'not-a-number',
    });

    expect(message).toContain('しばらく待って');
  });

  it('maps factor2_invalid to retry guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 401,
      bodyText: JSON.stringify({
        error: 'factor2_invalid',
        reason: 'factor2_invalid',
      }),
    });

    expect(message).toContain('再試行');
  });

  it('maps factor2_session_expired to relogin guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 401,
      bodyText: JSON.stringify({
        error: 'factor2_session_expired',
        reason: 'factor2_session_expired',
      }),
    });

    expect(message).toContain('確認時間');
    expect(message).toContain('もう一度ログイン');
  });
});
