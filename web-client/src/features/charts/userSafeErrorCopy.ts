const AUTH_HINT_RE = /(権限がありません|再ログイン|unauthorized|forbidden|authentication_failed|認証)/i;
const NETWORK_HINT_RE = /(network|timeout|timed out|abort|中断|通信|接続)/i;

const normalize = (value?: string | null): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

export const resolveUserSafeFetchFailure = (subject: string, detail?: string | null): string => {
  const normalized = normalize(detail);
  if (AUTH_HINT_RE.test(normalized)) {
    return `${subject}を取得できませんでした。再ログインしてからやり直してください。`;
  }
  return `${subject}の取得に失敗しました。時間をおいて再試行してください。`;
};

export const resolveUserSafeOperationFailure = (detail?: string | null): string => {
  const normalized = normalize(detail);
  if (AUTH_HINT_RE.test(normalized)) {
    return '再ログインしてからやり直してください。';
  }
  if (NETWORK_HINT_RE.test(normalized)) {
    return '通信状態を確認してから再試行してください。';
  }
  return '状態を確認してからやり直してください。';
};
