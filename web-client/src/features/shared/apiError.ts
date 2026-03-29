import type { BannerTone } from '../reception/components/ToneBanner';

export type ApiErrorKind = 'network' | 'http' | 'business' | 'unknown';

export type ApiErrorContext = {
  error?: unknown;
  httpStatus?: number;
  apiResult?: string;
  apiResultMessage?: string;
  outcome?: string;
};

export type ApiFailureBanner = {
  tone: BannerTone;
  message: string;
  kind: ApiErrorKind;
  detail?: string;
  nextAction?: string;
  retryLabel?: string;
  cooldownMs?: number;
  forceNextAction?: boolean;
  reloginReason?: 'unauthorized' | 'forbidden';
};

const toErrorMessage = (error: unknown): string | undefined => {
  if (!error) return undefined;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return undefined;
};

export const isNetworkError = (error: unknown): boolean => {
  if (!error) return false;
  if (error instanceof TypeError) return true;
  const message = toErrorMessage(error);
  if (!message) return false;
  return /failed to fetch|networkerror|network|connection|timeout|timed out|ネットワーク|接続|タイムアウト/i.test(message);
};

const isBusinessError = (context: ApiErrorContext): boolean => {
  const apiResult = context.apiResult;
  if (typeof apiResult === 'string' && /error|^e/i.test(apiResult)) return true;
  const outcome = context.outcome;
  if (typeof outcome === 'string' && /error/i.test(outcome)) return true;
  return false;
};

export const classifyApiError = (context: ApiErrorContext): ApiErrorKind => {
  if (context.httpStatus === 0 || isNetworkError(context.error)) return 'network';
  if (typeof context.httpStatus === 'number' && context.httpStatus >= 400) return 'http';
  if (isBusinessError(context)) return 'business';
  if (context.error) return 'unknown';
  return 'unknown';
};

const isAuthErrorStatus = (status?: number) => status === 401 || status === 403;

const isServerErrorStatus = (status?: number) => typeof status === 'number' && status >= 500;

const resolveHttpTone = (status?: number): BannerTone => {
  if (status === 404) return 'info';
  if (status === 401 || status === 403) return 'warning';
  if (typeof status === 'number' && status >= 400 && status < 500) return 'warning';
  return 'error';
};

const resolveActionLabel = (kind: ApiErrorKind, status?: number) => {
  if (kind === 'network') return { nextAction: '通信回復後に再取得', retryLabel: '再取得' };
  if (kind === 'http') {
    if (status === 401 || status === 403) return { nextAction: '再ログイン', retryLabel: '再ログイン', force: true };
    if (status === 404) return { nextAction: '条件を変えて再取得', retryLabel: '再取得' };
    if (typeof status === 'number' && status >= 500) return { nextAction: '時間をおいて再取得', retryLabel: '再取得' };
    return { nextAction: '再取得', retryLabel: '再取得' };
  }
  if (kind === 'business') return { nextAction: '内容を確認して再取得', retryLabel: '再取得' };
  return { nextAction: '再取得', retryLabel: '再取得' };
};

const resolveMessageBase = (subject: string, operation: string, kind: ApiErrorKind, status?: number) => {
  if (kind === 'http' && status === 404) {
    return `${subject}が見つかりませんでした。条件を変えて再取得してください。`;
  }
  if (kind === 'http' && status === 401) {
    return `${subject}の${operation}に失敗しました。ログインが必要です。再ログインしてください。`;
  }
  if (kind === 'http' && status === 403) {
    return `${subject}の${operation}に失敗しました。この操作は許可されていません。利用可能な画面からやり直してください。`;
  }
  if (kind === 'http' && typeof status === 'number' && status >= 500) {
    return `${subject}の${operation}に失敗しました。サーバー側で障害が発生しています。`;
  }
  if (kind === 'network') {
    return `${subject}の${operation}に失敗しました。ネットワーク障害の可能性があります。`;
  }
  if (kind === 'business') {
    return `${subject}の${operation}に失敗しました。業務エラーが発生しています。`;
  }
  return `${subject}の${operation}に失敗しました。`;
};

export const buildApiFailureBanner = (
  subject: string,
  context: ApiErrorContext,
  operation: string = '取得',
): ApiFailureBanner => {
  const kind = classifyApiError(context);
  const status = context.httpStatus;
  const tone: BannerTone = kind === 'http' ? resolveHttpTone(status) : kind === 'business' ? 'warning' : 'error';
  const label =
    kind === 'network'
      ? 'ネットワーク障害'
      : kind === 'http'
        ? status
          ? `HTTP ${status}`
          : 'サーバー応答エラー'
        : kind === 'business'
          ? '業務エラー'
          : '不明なエラー';
  const base = resolveMessageBase(subject, operation, kind, status);
  const message = `${base}${label ? `（${label}）` : ''}`;
  const action = resolveActionLabel(kind, status);
  return {
    tone,
    message,
    kind,
    nextAction: action.nextAction,
    retryLabel: action.retryLabel,
    cooldownMs: isServerErrorStatus(status) ? 5000 : undefined,
    forceNextAction: action.force,
    reloginReason: isAuthErrorStatus(status) ? (status === 403 ? 'forbidden' : 'unauthorized') : undefined,
  };
};
