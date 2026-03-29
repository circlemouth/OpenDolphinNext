import type { Location } from 'react-router-dom';

import { buildFacilityPath, normalizeFacilityId, parseFacilityPath } from '../../routes/facilityRoutes';
import { scrubPathWithQuery } from '../../routes/scrubSensitiveUrl';
import type { SessionExpiryReason } from '../../libs/session/sessionExpiry';

export type LoginRedirectReason = 'logout' | SessionExpiryReason;

export type LoginRedirectNotice = {
  reason: LoginRedirectReason;
};

export type LoginRedirectState = {
  from?: string | Location;
  loginNotice?: LoginRedirectNotice;
};

export type LoginRedirectIntent = {
  to: string;
  state?: unknown;
};

export type LoginDestinationSummary = {
  title: string;
  body: string;
};

const LOGIN_NOTICE_STORAGE_KEY = 'opendolphin:web-client:login-notice';

const isLoginPath = (path: string) => path === '/login' || parseFacilityPath(path)?.suffix === '/login';

const resolveFromPath = (from?: string | Location): string => {
  if (!from) return '';
  if (typeof from === 'string') {
    return from.split('?')[0]?.split('#')[0] ?? '';
  }
  return from.pathname ?? '';
};

const resolveFromTarget = (from?: string | Location): string => {
  if (!from) return '';
  if (typeof from === 'string') return from;
  return `${from.pathname ?? ''}${from.search ?? ''}${from.hash ?? ''}`;
};

export const resolveLoginNotice = (state: unknown): LoginRedirectNotice | undefined => {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return undefined;
  }
  const record = state as Record<string, unknown>;
  const loginNotice = record.loginNotice;
  if (!loginNotice || typeof loginNotice !== 'object' || Array.isArray(loginNotice)) {
    return undefined;
  }
  const reason = (loginNotice as Record<string, unknown>).reason;
  if (
    reason === 'logout' ||
    reason === 'timeout' ||
    reason === 'unauthorized' ||
    reason === 'forbidden'
  ) {
    return { reason };
  }
  return undefined;
};

export const resolveLoginNoticeFromSearch = (search: string): LoginRedirectNotice | undefined => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const reason = params.get('reason');
  if (
    reason === 'logout' ||
    reason === 'timeout' ||
    reason === 'unauthorized' ||
    reason === 'forbidden'
  ) {
    return { reason };
  }
  return undefined;
};

export const resolveLoginNoticeMessage = (notice?: LoginRedirectNotice): string | undefined => {
  if (!notice) return undefined;
  if (notice.reason === 'logout') {
    return 'サインアウトしました。安全のため、この端末の作業状態を消去してログイン画面へ戻りました。';
  }
  if (notice.reason === 'forbidden') {
    return 'この操作は許可されていません。現在の権限では続けられないため、利用可能な画面からやり直してください。';
  }
  if (notice.reason === 'timeout') {
    return 'セッションの有効期限が切れました。作業を続けるには、もう一度ログインしてください。';
  }
  return 'ログインが必要です。この画面を開くには再ログインしてください。';
};

const buildDefaultLandingBody = (fallbackFacilityId?: string, reason?: 'missing' | 'invalid') => {
  const fallback =
    normalizeFacilityId(fallbackFacilityId ?? '')
      ? `${buildFacilityPath(normalizeFacilityId(fallbackFacilityId ?? ''), '/reception')} を既定の着地点として開きます。`
      : '受付を既定の着地点として開きます。';
  if (reason === 'invalid') {
    return `元の移動先は安全に開けなかったため、${fallback}`;
  }
  if (reason === 'missing') {
    return `移動先が指定されていなかったため、${fallback}`;
  }
  return `ログイン後は ${fallback}`;
};

export const persistLoginNotice = (notice: LoginRedirectNotice) => {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(LOGIN_NOTICE_STORAGE_KEY, JSON.stringify(notice));
  } catch {
    // ignore storage errors
  }
};

export const consumeLoginNotice = (): LoginRedirectNotice | undefined => {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(LOGIN_NOTICE_STORAGE_KEY);
    if (!raw) return undefined;
    sessionStorage.removeItem(LOGIN_NOTICE_STORAGE_KEY);
    const parsed = JSON.parse(raw) as unknown;
    return resolveLoginNotice({ loginNotice: parsed });
  } catch {
    return undefined;
  }
};

export const resolveLoginDestinationSummary = (
  state: unknown,
  fallbackFacilityId?: string,
): LoginDestinationSummary | undefined => {
  const from = resolveFromState(state);
  const fromTarget = resolveFromTarget(from);
  const fromPath = resolveFromPath(from);
  if (fromPath && !isLoginPath(fromPath) && parseFacilityPath(fromPath)) {
    const scrubbed = scrubPathWithQuery(fromTarget);
    if (scrubbed !== fromTarget) {
      return {
        title: 'ログイン後の移動先',
        body: 'ログイン後は前回の画面へ戻ります。安全のため、詳細条件や deep link query は引き継がずに画面本体へ移動します。',
      };
    }
    return {
      title: 'ログイン後の移動先',
      body: 'ログイン後は前回の画面へ戻ります。',
    };
  }

  if (from !== undefined) {
    return {
      title: 'ログイン後の移動先',
      body: buildDefaultLandingBody(fallbackFacilityId, 'invalid'),
    };
  }
  return {
    title: 'ログイン後の移動先',
    body: buildDefaultLandingBody(fallbackFacilityId, 'missing'),
  };
};

export const resolveFromState = (state: unknown): string | Location | undefined => {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return undefined;
  }
  const record = state as Record<string, unknown>;
  const from = record.from;
  if (typeof from === 'string') return from;
  if (from && typeof from === 'object' && !Array.isArray(from)) {
    return from as Location;
  }
  return undefined;
};

export const resolveLoginRedirect = (location: Pick<Location, 'state'>): LoginRedirectIntent | null => {
  const from = resolveFromState(location.state);
  if (!from) return null;
  if (typeof from === 'string') {
    const pathname = resolveFromPath(from);
    if (!pathname || isLoginPath(pathname)) return null;
    if (!parseFacilityPath(pathname)) return null;
    return { to: from };
  }
  const path = from.pathname ?? '';
  if (!path) return null;
  if (isLoginPath(path)) return null;
  if (!parseFacilityPath(path)) return null;
  return { to: `${path}${from.search ?? ''}${from.hash ?? ''}`, state: from.state };
};
