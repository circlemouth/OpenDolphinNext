import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginScreen, normalizeSessionResult } from '../LoginScreen';
import { AUTH_COPY } from '../features/login/loginErrorMessage';
import { httpFetch } from '../libs/http/httpClient';

vi.mock('../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));
vi.mock('../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'run-001'),
  updateObservabilityMeta: vi.fn(),
}));
vi.mock('../libs/session/sessionExpiry', () => ({
  consumeSessionExpiredNotice: vi.fn(() => undefined),
}));
vi.mock('../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
}));

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.mocked(httpFetch).mockReset();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/login');
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('aria-labelledby が見出しIDと一致している', () => {
    const { container } = render(<LoginScreen />);

    const section = container.querySelector('section.login-card');
    const heading = screen.getByRole('heading', { level: 1, name: 'OpenDolphin Web ログイン' });

    expect(section).not.toBeNull();
    expect(section).toHaveAttribute('aria-labelledby', 'login-heading');
    expect(heading).toHaveAttribute('id', 'login-heading');
  });

  it('factor2_required を受けると 2FA 入力画面へ遷移し、password を DOM から消す', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      jsonResponse(
        {
          error: 'factor2_required',
          code: 'factor2_required',
          errorCode: 'factor2_required',
          message: '二要素認証コードを入力してください。',
          status: 401,
          errorCategory: 'factor2_required',
          factor2Required: true,
          factor2Type: 'totp',
        },
        401,
      ),
    );

    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByLabelText('施設ID'), 'F001');
    await user.type(screen.getByLabelText('ユーザーID'), 'doctor01');
    await user.type(screen.getByLabelText('パスワード'), 'Secret123!');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));

    expect(await screen.findByLabelText('認証コード')).toBeInTheDocument();
    expect(screen.queryByLabelText('パスワード')).not.toBeInTheDocument();
    expect(screen.getByText('ステップ 2/2')).toBeInTheDocument();
    expect(screen.getByText('二要素認証')).toBeInTheDocument();
    expect(screen.getByText('ログイン情報の確認が終わったため、続けて認証アプリの6桁コードで本人確認を行います。')).toBeInTheDocument();
    expect(screen.getByText(AUTH_COPY.factor2Required)).toBeInTheDocument();
    expect(screen.getByText('パスワードは保持していません。認証コードのみ入力してください。')).toBeInTheDocument();
    expect(screen.getByLabelText('認証コード')).toHaveFocus();
  });

  it('正しいコードでログイン完了し、clientUuid を維持する', async () => {
    const onLoginSuccess = vi.fn();
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: 'factor2_required',
            code: 'factor2_required',
            errorCode: 'factor2_required',
            message: '二要素認証コードを入力してください。',
            status: 401,
            errorCategory: 'factor2_required',
            factor2Required: true,
            factor2Type: 'totp',
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          facilityId: 'F001',
          userId: 'doctor01',
          displayName: 'Doctor One',
          roles: ['doctor'],
          runId: 'server-run-2',
        }),
      );

    const user = userEvent.setup();
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);

    await user.type(screen.getByLabelText('施設ID'), 'F001');
    await user.type(screen.getByLabelText('ユーザーID'), 'doctor01');
    await user.type(screen.getByLabelText('パスワード'), 'Secret123!');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));

    const firstRequest = JSON.parse(String(vi.mocked(httpFetch).mock.calls[0]?.[1]?.body ?? '{}')) as {
      clientUuid?: string;
    };
    expect(firstRequest.clientUuid).toBeTruthy();

    await user.type(await screen.findByLabelText('認証コード'), '123456');
    await user.click(screen.getByRole('button', { name: '認証コードを確認' }));

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledTimes(1));
    expect(onLoginSuccess.mock.calls[0]?.[0]).toMatchObject({
      facilityId: 'F001',
      userId: 'doctor01',
      clientUuid: firstRequest.clientUuid,
      runId: 'server-run-2',
    });
    expect(String(vi.mocked(httpFetch).mock.calls[1]?.[0])).toContain('/api/session/login/factor2');
    expect(JSON.parse(String(vi.mocked(httpFetch).mock.calls[1]?.[1]?.body ?? '{}'))).toEqual({ code: '123456' });
  });

  it('不正コードではエラー表示し、その場に残る', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: 'factor2_required',
            code: 'factor2_required',
            errorCode: 'factor2_required',
            message: '二要素認証コードを入力してください。',
            status: 401,
            errorCategory: 'factor2_required',
            factor2Required: true,
            factor2Type: 'totp',
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: 'factor2_invalid',
            code: 'factor2_invalid',
            errorCode: 'factor2_invalid',
            message: '認証コードが正しくありません。',
            status: 401,
            errorCategory: 'factor2_invalid',
          },
          401,
        ),
      );

    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByLabelText('施設ID'), 'F001');
    await user.type(screen.getByLabelText('ユーザーID'), 'doctor01');
    await user.type(screen.getByLabelText('パスワード'), 'Secret123!');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));

    await user.type(await screen.findByLabelText('認証コード'), '111111');
    await user.click(screen.getByRole('button', { name: '認証コードを確認' }));

    expect(await screen.findByText(AUTH_COPY.factor2Invalid)).toBeInTheDocument();
    expect(screen.getByLabelText('認証コード')).toBeInTheDocument();
  });

  it('factor2 session missing/expired では最初のログイン画面へ戻り、storage と URL に残さない', async () => {
    vi.mocked(httpFetch)
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: 'factor2_required',
            code: 'factor2_required',
            errorCode: 'factor2_required',
            message: '二要素認証コードを入力してください。',
            status: 401,
            errorCategory: 'factor2_required',
            factor2Required: true,
            factor2Type: 'totp',
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: 'factor2_session_expired',
            code: 'factor2_session_expired',
            errorCode: 'factor2_session_expired',
            message: '二要素認証セッションが無効です。',
            status: 401,
            errorCategory: 'factor2_session_expired',
          },
          401,
        ),
      );

    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByLabelText('施設ID'), 'F001');
    await user.type(screen.getByLabelText('ユーザーID'), 'doctor01');
    await user.type(screen.getByLabelText('パスワード'), 'Secret123!');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));

    await user.type(await screen.findByLabelText('認証コード'), '222222');
    await user.click(screen.getByRole('button', { name: '認証コードを確認' }));

    expect(await screen.findByLabelText('施設ID')).toBeInTheDocument();
    expect(screen.queryByLabelText('認証コード')).not.toBeInTheDocument();
    expect(screen.getByText(AUTH_COPY.factor2SessionExpired)).toBeInTheDocument();
    expect(window.location.search).toBe('');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('factor2 をキャンセルすると credentials step に戻り、info copy を表示する', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      jsonResponse(
        {
          error: 'factor2_required',
          code: 'factor2_required',
          errorCode: 'factor2_required',
          message: '二要素認証コードを入力してください。',
          status: 401,
          errorCategory: 'factor2_required',
          factor2Required: true,
          factor2Type: 'totp',
        },
        401,
      ),
    );

    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByLabelText('施設ID'), 'F001');
    await user.type(screen.getByLabelText('ユーザーID'), 'doctor01');
    await user.type(screen.getByLabelText('パスワード'), 'Secret123!');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));
    await user.click(await screen.findByRole('button', { name: '二要素認証を中止' }));

    expect(await screen.findByLabelText('パスワード')).toBeInTheDocument();
    expect(screen.getByText('ステップ 1/2')).toBeInTheDocument();
    expect(screen.getByText(AUTH_COPY.factor2Cancelled)).toBeInTheDocument();
  });

  it('initialNotice と destinationSummary を login 画面に表示する', () => {
    render(
      <LoginScreen
        initialFacilityId="0001"
        lockFacilityId
        initialNotice={{
          message: 'サインアウトしました。続けて別の施設やユーザーでログインできます。',
          tone: 'info',
        }}
        destinationSummary={{
          title: 'ログイン後の移動先',
          body: 'ログイン後は /f/0001/reception を既定の着地点として開きます。',
        }}
      />,
    );

    expect(screen.getAllByText('サインアウトしました。続けて別の施設やユーザーでログインできます。').length).toBeGreaterThan(0);
    expect(screen.getByText('ログイン後の移動先')).toBeInTheDocument();
    expect(screen.getByText('ログイン後は /f/0001/reception を既定の着地点として開きます。')).toBeInTheDocument();
  });

  it('normalizeSessionResult は server の userPk を保持する', () => {
    const result = normalizeSessionResult(
      { facilityId: '0001', userId: 'doctor01', userPk: 101, roles: ['doctor'] },
      { facilityId: '0001', userId: 'doctor01', clientUuid: 'client-1', runId: 'RUN-1' },
    );

    expect(result.userPk).toBe(101);
  });
});
