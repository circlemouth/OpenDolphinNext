import { describe, expect, it } from 'vitest';

import {
  consumeLoginNotice,
  persistLoginNotice,
  resolveLoginDestinationSummary,
  resolveLoginNotice,
  resolveLoginNoticeMessage,
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

    expect(summary?.body).toContain('/f/0001/reception');
  });

  it('resolves logout notice from state', () => {
    const notice = resolveLoginNotice({ loginNotice: { reason: 'logout' } });

    expect(notice).toEqual({ reason: 'logout' });
    expect(resolveLoginNoticeMessage(notice)).toContain('サインアウトしました');
  });

  it('persists and consumes login notice from sessionStorage', () => {
    persistLoginNotice({ reason: 'logout' });

    expect(consumeLoginNotice()).toEqual({ reason: 'logout' });
    expect(consumeLoginNotice()).toBeUndefined();
  });
});
