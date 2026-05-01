type LoginErrorJson = {
  error?: unknown;
  code?: unknown;
  errorCode?: unknown;
  errorCategory?: unknown;
  message?: unknown;
  reason?: unknown;
  details?: {
    reason?: unknown;
  };
};

export type LoginFailureKind =
  | 'generic'
  | 'factor2_required'
  | 'factor2_invalid'
  | 'factor2_session_missing'
  | 'factor2_session_expired';

export type LoginFailureResolution = {
  kind: LoginFailureKind;
  message: string;
};

export const AUTH_COPY = {
  credentialsFailure: 'ログインに失敗しました。施設ID・ユーザーID・パスワードを確認してください。',
  authenticationFailed: '認証を完了できませんでした。はじめからやり直してください。',
  securityFailure: '安全な確認ができなかったため、この操作を続けられません。ログイン画面からやり直してください。',
  factor2Required: '本人確認のため二要素認証が必要です。認証アプリの6桁コードを入力してください。',
  factor2Invalid: '認証コードが一致しません。6桁コードを確認して再試行してください。',
  factor2SessionMissing: '二要素認証の続きが見つかりません。施設IDとパスワードからやり直してください。',
  factor2SessionExpired: '二要素認証の有効期限が切れました。もう一度ログインしてください。',
  factor2Cancelled: '二要素認証を中止しました。もう一度ログインすると認証コード入力からやり直せます。',
  tooManyRequests: 'ログイン試行回数が上限に達しました。しばらく待ってから再試行してください。',
} as const;

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseLoginErrorJson = (bodyText: string): LoginErrorJson | null => {
  const trimmed = bodyText.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as LoginErrorJson;
  } catch {
    return null;
  }
};

const resolveReason = (payload: LoginErrorJson | null): string | undefined =>
  normalizeText(payload?.reason) ??
  normalizeText(payload?.errorCode) ??
  normalizeText(payload?.code) ??
  normalizeText(payload?.errorCategory) ??
  normalizeText(payload?.details?.reason) ??
  normalizeText(payload?.error);

const resolveRetryAfterSeconds = (retryAfter: string | undefined): number | undefined => {
  const normalized = normalizeText(retryAfter);
  if (!normalized) return undefined;

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isNaN(parsed) && parsed > 0) {
    return parsed;
  }
  return undefined;
};

const resolveTooManyRequestsMessage = (retryAfter: string | undefined): string => {
  const seconds = resolveRetryAfterSeconds(retryAfter);
  if (seconds) {
    return `${AUTH_COPY.tooManyRequests} ${seconds}秒後に再試行してください。`;
  }
  return AUTH_COPY.tooManyRequests;
};

const isNetworkLikeMessage = (message: string | undefined): boolean => {
  if (!message) return false;
  return /failed to fetch|network|timeout|timed out|connection|load failed|abort/i.test(message);
};

const resolveAuthFailureMessage = (reason: string | undefined, status: number): string => {
  const normalizedReason = reason?.toLowerCase();
  if (normalizedReason === 'factor2_required') {
    return AUTH_COPY.factor2Required;
  }
  if (normalizedReason === 'factor2_invalid') {
    return AUTH_COPY.factor2Invalid;
  }
  if (normalizedReason === 'factor2_session_missing') {
    return AUTH_COPY.factor2SessionMissing;
  }
  if (normalizedReason === 'factor2_session_expired') {
    return AUTH_COPY.factor2SessionExpired;
  }
  if (normalizedReason === 'authentication_failed' || normalizedReason === 'unauthorized') {
    return AUTH_COPY.credentialsFailure;
  }
  if (normalizedReason === 'principal_unresolved') {
    return 'ログインに失敗しました。施設IDの入力が正しいか確認してください。';
  }
  if (normalizedReason === 'header_auth_disabled' || normalizedReason === 'header_authentication_disabled') {
    return AUTH_COPY.securityFailure;
  }
  if (normalizedReason?.startsWith('csrf_')) {
    return 'ログイン画面の安全確認情報が古くなりました。画面を再読み込みしてからもう一度ログインしてください。';
  }
  if (status === 403) {
    return 'ログインに失敗しました。このアカウントにはアクセス権限がありません。';
  }
  return AUTH_COPY.authenticationFailed;
};

export const resolveLoginFailure = (params: {
  status: number;
  bodyText?: string;
  statusText?: string;
  retryAfter?: string;
}): LoginFailureResolution => {
  const { status, bodyText = '', statusText, retryAfter } = params;
  const parsed = parseLoginErrorJson(bodyText);
  const reason = resolveReason(parsed)?.toLowerCase();

  if (status === 401 && reason === 'factor2_required') {
    return { kind: 'factor2_required', message: AUTH_COPY.factor2Required };
  }
  if (status === 401 && reason === 'factor2_invalid') {
    return { kind: 'factor2_invalid', message: AUTH_COPY.factor2Invalid };
  }
  if (status === 401 && reason === 'factor2_session_missing') {
    return { kind: 'factor2_session_missing', message: AUTH_COPY.factor2SessionMissing };
  }
  if (status === 401 && reason === 'factor2_session_expired') {
    return { kind: 'factor2_session_expired', message: AUTH_COPY.factor2SessionExpired };
  }

  if (status === 429) {
    return { kind: 'generic', message: resolveTooManyRequestsMessage(retryAfter) };
  }

  if (status === 401 || status === 403) {
    return { kind: 'generic', message: resolveAuthFailureMessage(reason, status) };
  }

  if (status === 404) {
    return { kind: 'generic', message: 'ログイン先が見つかりません。接続先設定を確認してください。' };
  }

  if (status >= 500) {
    return { kind: 'generic', message: 'ログインに失敗しました。サーバー側でエラーが発生しています。時間をおいて再試行してください。' };
  }

  const message = normalizeText(parsed?.message);
  const resolvedStatusText = normalizeText(statusText);
  if (isNetworkLikeMessage(message) || isNetworkLikeMessage(resolvedStatusText)) {
    return {
      kind: 'generic',
      message: 'ログインに失敗しました。通信状態を確認して再試行してください。',
    };
  }
  return { kind: 'generic', message: AUTH_COPY.authenticationFailed };
};

export const resolveLoginFailureMessage = (params: {
  status: number;
  bodyText?: string;
  statusText?: string;
  retryAfter?: string;
}): string => resolveLoginFailure(params).message;

export const resolveUnexpectedLoginErrorMessage = (error: unknown): string => {
  const message = normalizeText(error instanceof Error ? error.message : typeof error === 'string' ? error : undefined);
  if (isNetworkLikeMessage(message)) {
    return 'ログインに失敗しました。通信状態を確認して再試行してください。';
  }
  return AUTH_COPY.authenticationFailed;
};
