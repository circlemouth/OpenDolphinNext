import { describe, expect, it } from 'vitest';

import { AUTH_COPY, resolveLoginFailure, resolveLoginFailureMessage } from '../loginErrorMessage';

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

    expect(message).toBe(AUTH_COPY.credentialsFailure);
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

  it('maps CSRF 403 to reload guidance instead of account permission guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 403,
      bodyText: JSON.stringify({
        error: 'csrf_validation_failed',
        reason: 'csrf_validation_failed',
      }),
    });

    expect(message).toContain('再読み込み');
    expect(message).not.toContain('アクセス権限');
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

    expect(message).toBe(AUTH_COPY.tooManyRequests);
  });

  it('maps factor2_required to purpose-first guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 401,
      bodyText: JSON.stringify({
        error: 'factor2_required',
        reason: 'factor2_required',
      }),
    });

    expect(message).toBe(AUTH_COPY.factor2Required);
    expect(message).toContain('本人確認');
  });

  it('maps factor2_invalid to retry guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 401,
      bodyText: JSON.stringify({
        error: 'factor2_invalid',
        reason: 'factor2_invalid',
      }),
    });

    expect(message).toBe(AUTH_COPY.factor2Invalid);
  });

  it('maps factor2_session_expired to relogin guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 401,
      bodyText: JSON.stringify({
        error: 'factor2_session_expired',
        reason: 'factor2_session_expired',
      }),
    });

    expect(message).toBe(AUTH_COPY.factor2SessionExpired);
  });

  it('distinguishes factor2 session missing and expired', () => {
    const missing = resolveLoginFailure({
      status: 401,
      bodyText: JSON.stringify({
        error: 'factor2_session_missing',
      }),
    });
    const expired = resolveLoginFailure({
      status: 401,
      bodyText: JSON.stringify({
        error: 'factor2_session_expired',
      }),
    });

    expect(missing.message).toBe(AUTH_COPY.factor2SessionMissing);
    expect(expired.message).toBe(AUTH_COPY.factor2SessionExpired);
  });

  it('maps header auth mismatch to security guidance', () => {
    const message = resolveLoginFailureMessage({
      status: 401,
      bodyText: JSON.stringify({
        error: 'header_auth_disabled',
        reason: 'header_auth_disabled',
      }),
    });

    expect(message).toBe(AUTH_COPY.securityFailure);
  });

  it('does not expose backend message from generic 4xx payload', () => {
    const message = resolveLoginFailureMessage({
      status: 400,
      bodyText: JSON.stringify({
        message: 'oracle jdbc authentication failed at backend-node-3',
      }),
    });

    expect(message).toBe(AUTH_COPY.authenticationFailed);
    expect(message).not.toContain('backend-node-3');
    expect(message).not.toContain('oracle');
  });

  it('does not expose raw statusText for generic HTTP failure', () => {
    const message = resolveLoginFailureMessage({
      status: 418,
      statusText: 'Upstream Panic',
    });

    expect(message).toBe(AUTH_COPY.authenticationFailed);
    expect(message).not.toContain('Upstream Panic');
  });
});
