import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const fillCredentialsAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('施設ID'), 'F001');
  await user.type(screen.getByLabelText('ユーザーID'), 'doctor01');
  await user.type(screen.getByLabelText('パスワード'), 'Secret123!');
  await user.click(screen.getByRole('button', { name: 'ログイン' }));
};

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
    vi.unstubAllEnvs();
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

  it('initialNotice は表示し、destinationSummary は login surface 上に表示しない', () => {
    render(
      <LoginScreen
        initialNotice={{ message: 'セッションの有効期限が切れました。作業を続けるには、もう一度ログインしてください。', tone: 'error' }}
        destinationSummary={{
          body: '利用する実際の施設IDを入力してください。',
        }}
      />,
    );

    expect(screen.getByText('セッションの有効期限が切れました。作業を続けるには、もう一度ログインしてください。')).toBeInTheDocument();
    expect(screen.queryByText('利用する実際の施設IDを入力してください。')).not.toBeInTheDocument();
  });

  it('パスワード表示ボタンで mask を切り替える', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    const passwordInput = screen.getByLabelText('パスワード');
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.type(passwordInput, 'Secret123!');
    await user.click(screen.getByRole('button', { name: 'パスワードを表示' }));

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'パスワードを隠す' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'パスワードを隠す' }));

    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('入力不足時は field error を aria-invalid と aria-describedby で結びつける', async () => {
    render(<LoginScreen />);

    fireEvent.submit(screen.getByRole('button', { name: 'ログイン' }).closest('form') as HTMLFormElement);

    expect(document.getElementById('login-facility-id')).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById('login-user-id')).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById('login-password')).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById('login-facility-id')).toHaveAttribute('aria-describedby', 'login-facility-id-error');
    expect(document.getElementById('login-user-id')).toHaveAttribute('aria-describedby', 'login-user-id-error');
    expect(document.getElementById('login-password')).toHaveAttribute('aria-describedby', 'login-password-error');
    expect(screen.getByText('施設IDを入力してください。')).toHaveAttribute('id', 'login-facility-id-error');
    expect(screen.getByText('ユーザーIDを入力してください。')).toHaveAttribute('id', 'login-user-id-error');
    expect(screen.getByText('パスワードを入力してください。')).toHaveAttribute('id', 'login-password-error');
  });

  it('single facility login では施設ID入力欄を表示せず login payload から facilityId を省略する', async () => {
    vi.stubEnv('VITE_SINGLE_FACILITY_LOGIN', '1');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      jsonResponse({
        facilityId: 'F001',
        userId: 'doctor01',
        displayName: 'Doctor One',
        roles: ['doctor'],
        runId: 'server-run-1',
      }),
    );
    const onLoginSuccess = vi.fn();
    const user = userEvent.setup();

    render(<LoginScreen initialFacilityId="F001" lockFacilityId onLoginSuccess={onLoginSuccess} />);

    expect(screen.queryByLabelText('施設ID')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('ユーザーID'), 'doctor01');
    await user.type(screen.getByLabelText('パスワード'), 'Secret123!');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalled());
    const requestBody = JSON.parse(String(vi.mocked(httpFetch).mock.calls[0]?.[1]?.body ?? '{}')) as {
      facilityId?: string;
      userId?: string;
    };
    expect(requestBody.facilityId).toBeUndefined();
    expect(requestBody.userId).toBe('doctor01');
  });

  it.each([
    [
      '401 credentials denied',
      jsonResponse({ error: 'authentication_failed', message: 'nope' }, 401),
      AUTH_COPY.credentialsFailure,
    ],
    [
      '403 forbidden',
      jsonResponse({ error: 'forbidden', message: 'forbidden' }, 403),
      'ログインに失敗しました。このアカウントにはアクセス権限がありません。',
    ],
    [
      '404 missing endpoint',
      jsonResponse({ error: 'not_found', message: 'missing' }, 404),
      'ログイン先が見つかりません。接続先設定を確認してください。',
    ],
    [
      '429 throttled',
      new Response(JSON.stringify({ error: 'too_many_requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
      }),
      'ログイン試行回数が上限に達しました。しばらく待ってから再試行してください。 30秒後に再試行してください。',
    ],
    [
      '500 server error',
      jsonResponse({ error: 'internal_server_error', message: 'boom' }, 500),
      'ログインに失敗しました。サーバー側でエラーが発生しています。時間をおいて再試行してください。',
    ],
  ])('credentials step は %s の canonical copy を表示する', async (_label, response, expectedMessage) => {
    vi.mocked(httpFetch).mockResolvedValueOnce(response);

    const user = userEvent.setup();
    render(<LoginScreen />);

    await fillCredentialsAndSubmit(user);

    expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
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

  it('factor2 submit で 429 を受けた場合も step 2 に残り待機文言を表示する', async () => {
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
        new Response(JSON.stringify({ error: 'too_many_requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '45' },
        }),
      );

    const user = userEvent.setup();
    render(<LoginScreen />);

    await fillCredentialsAndSubmit(user);
    await user.type(await screen.findByLabelText('認証コード'), '123456');
    await user.click(screen.getByRole('button', { name: '認証コードを確認' }));

    expect(await screen.findByText('ログイン試行回数が上限に達しました。しばらく待ってから再試行してください。 45秒後に再試行してください。')).toBeInTheDocument();
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
    expect(screen.getByText('ユーザーIDとパスワードを入力してください。')).toBeInTheDocument();
    expect(screen.getByText(AUTH_COPY.factor2Cancelled)).toBeInTheDocument();
  });

  it('unexpected fetch error でも raw internal detail を出さず canonical copy に寄せる', async () => {
    vi.mocked(httpFetch).mockRejectedValueOnce(new Error('backend-node-3 connection refused'));

    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByLabelText('施設ID'), 'F001');
    await user.type(screen.getByLabelText('ユーザーID'), 'doctor01');
    await user.type(screen.getByLabelText('パスワード'), 'Secret123!');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));

    expect(await screen.findByText('ログインに失敗しました。通信状態を確認して再試行してください。')).toBeInTheDocument();
    expect(screen.queryByText(/backend-node-3/)).not.toBeInTheDocument();
  });

  it('initialNotice を login 画面に表示し、destinationSummary は表示しない', () => {
    render(
      <LoginScreen
        initialFacilityId="0001"
        lockFacilityId
        initialNotice={{
          message: 'サインアウトしました。続けて別の施設やユーザーでログインできます。',
          tone: 'info',
        }}
        destinationSummary={{
          body: '利用する実際の施設IDを入力してください。',
        }}
      />,
    );

    expect(screen.getAllByText('サインアウトしました。続けて別の施設やユーザーでログインできます。').length).toBeGreaterThan(0);
    expect(screen.queryByText('利用する実際の施設IDを入力してください。')).not.toBeInTheDocument();
  });

  it('normalizeSessionResult は server の userPk を保持する', () => {
    const result = normalizeSessionResult(
      { facilityId: '0001', userId: 'doctor01', userPk: 101, roles: ['doctor'] },
      { facilityId: '0001', userId: 'doctor01', clientUuid: 'client-1', runId: 'RUN-1' },
    );

    expect(result.userPk).toBe(101);
  });
});
