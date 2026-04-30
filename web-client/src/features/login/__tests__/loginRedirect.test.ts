import { describe, expect, it } from 'vitest';

import {
  consumeLoginNotice,
  persistLoginNotice,
  resolveLoginDestinationSummary,
  resolveLoginNotice,
  resolveLoginNoticeMessage,
  resolveLoginSurfaceNotice,
  resolveLoginRedirect,
} from '../loginRedirect';

describe('loginRedirect helpers', () => {
  it('resolves facility scoped from state into redirect intent', () => {
    const redirect = resolveLoginRedirect({
      state: {
        from: {
          pathname: '/f/0001/patients',
          search: '?kw=山田',
          hash: '#focus',
          state: { kw: '山田' },
        },
      },
    } as any);

    expect(redirect).toEqual({
      to: '/f/0001/patients?kw=山田#focus',
      state: { kw: '山田' },
    });
  });

  it('returns scrub explanation when from state contains deep link query', () => {
    const summary = resolveLoginDestinationSummary(
      {
        from: {
          pathname: '/f/0001/charts',
          search: '?patientId=P-001&returnTo=/f/0001/reception',
        },
      },
      '0001',
    );

    expect(summary?.body).toContain('deep link query');
    expect(summary?.body).toContain('前回の画面へ戻ります');
  });

  it('returns default landing summary when from state is missing', () => {
    const summary = resolveLoginDestinationSummary({}, '0001');

    expect(summary?.title).toBeUndefined();
    expect(summary?.body).toBe('利用する実際の施設IDを入力してください。');
  });

  it('returns invalid landing summary when from state is not facility scoped', () => {
    const summary = resolveLoginDestinationSummary({ from: '/charts' }, '0001');

    expect(summary?.body).toContain('元の移動先は安全に開けなかったため');
    expect(summary?.body).toContain('/f/0001/reception');
  });

  it('resolves logout notice from state', () => {
    const notice = resolveLoginNotice({ loginNotice: { reason: 'logout' } });

    expect(notice).toEqual({ reason: 'logout' });
    expect(resolveLoginNoticeMessage(notice)).toContain('サインアウトしました');
  });

  it('resolves timeout / unauthorized / forbidden messages distinctly', () => {
    expect(resolveLoginNoticeMessage({ reason: 'timeout' })).toContain('有効期限が切れました');
    expect(resolveLoginNoticeMessage({ reason: 'unauthorized' })).toContain('ログインが必要です');
    expect(resolveLoginNoticeMessage({ reason: 'forbidden' })).toContain('この操作は許可されていません');
  });

  it('persists and consumes login notice from sessionStorage', () => {
    persistLoginNotice({ reason: 'logout' });

    expect(consumeLoginNotice()).toEqual({ reason: 'logout' });
    expect(consumeLoginNotice()).toBeUndefined();
  });

  it('login surface notice は session expiry を loginNotice より優先する', () => {
    const notice = resolveLoginSurfaceNotice({
      sessionExpiryNotice: {
        reason: 'timeout',
        occurredAt: '2026-04-02T00:00:00Z',
        message: 'セッションの有効期限が切れました。再ログインしてください。',
      },
      loginNotice: { reason: 'logout' },
      initialNotice: { message: 'fallback', tone: 'info' },
    });

    expect(notice).toEqual({
      message: 'セッションの有効期限が切れました。再ログインしてください。',
      tone: 'error',
    });
  });

  it('login surface notice は logout notice を表示しない', () => {
    const notice = resolveLoginSurfaceNotice({
      loginNotice: { reason: 'logout' },
      initialNotice: { message: 'fallback', tone: 'error' },
    });

    expect(notice).toBeUndefined();
  });

  it('login surface notice は non-logout loginNotice を initialNotice より優先する', () => {
    const notice = resolveLoginSurfaceNotice({
      loginNotice: { reason: 'timeout' },
      initialNotice: { message: 'fallback', tone: 'error' },
    });

    expect(notice).toEqual({
      message: 'セッションの有効期限が切れました。作業を続けるには、もう一度ログインしてください。',
      tone: 'error',
    });
  });
});
