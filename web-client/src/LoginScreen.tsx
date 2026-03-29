import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { httpFetch } from './libs/http/httpClient';
import { generateRunId, updateObservabilityMeta } from './libs/observability/observability';
import { consumeSessionExpiredNotice } from './libs/session/sessionExpiry';
import { logAuditEvent } from './libs/audit/auditLogger';
import {
  AUTH_COPY,
  resolveLoginFailure,
  type LoginFailureResolution,
} from './features/login/loginErrorMessage';

const resolveApiBaseUrl = () => {
  const raw = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim().replace(/\/$/, '');
  return raw || '/api';
};
const API_BASE_URL = resolveApiBaseUrl();
const SYSTEM_ICON_URL = `${import.meta.env.BASE_URL}LogoImage/MainLogo.png`;
const SESSION_LOGIN_ENDPOINT = `${API_BASE_URL}/session/login`;
const SESSION_FACTOR2_LOGIN_ENDPOINT = `${API_BASE_URL}/session/login/factor2`;

const createClientUuid = (seed?: string) => {
  if (seed?.trim()) {
    return seed.trim();
  }
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return uuidv4();
};

const resolveLoginTimeoutMs = () => {
  const raw = import.meta.env.VITE_LOGIN_TIMEOUT_MS ?? import.meta.env.VITE_HTTP_TIMEOUT_MS ?? '';
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10000;
  return parsed;
};

const waitMs = (duration: number) => new Promise<void>((resolve) => setTimeout(resolve, duration));
const normalize = (value: string) => value.trim();

const normalizeRoles = (roles?: Array<string | { role?: string }>) => {
  if (!roles) return [];
  return roles
    .map((entry) => (typeof entry === 'string' ? entry : entry?.role))
    .filter((role): role is string => Boolean(role));
};

const inferRole = (_userId: string, roles?: Array<string | { role?: string }>) => {
  const normalized = normalizeRoles(roles);
  if (normalized.length > 0) return normalized[0];
  return 'unknown';
};

type CredentialsFormValues = {
  facilityId: string;
  userId: string;
  password: string;
  clientUuid: string;
};

type CredentialsFieldKey = keyof CredentialsFormValues;
type LoginStatus = 'idle' | 'loading' | 'success' | 'error';
type LoginStep = 'credentials' | 'factor2';
type FeedbackTone = 'success' | 'error' | 'info';

type PendingSecondFactorState = {
  facilityId: string;
  userId: string;
  clientUuid: string;
  runId: string;
};

type LoginStepMeta = {
  badge: string;
  title: string;
  body: string;
};

export interface SessionAuthResponse {
  facilityId?: string;
  userId?: string;
  userPk?: number;
  displayName?: string;
  commonName?: string;
  roles?: Array<string | { role?: string }>;
  clientUuid?: string;
  runId?: string;
}

export type LoginResult = {
  facilityId: string;
  userId: string;
  userPk?: number;
  displayName?: string;
  commonName?: string;
  clientUuid: string;
  runId: string;
  role: string;
  roles?: string[];
};

type LoginAttemptResult =
  | { kind: 'success'; result: LoginResult }
  | { kind: 'factor2_required'; message: string; clientUuid: string; runId: string };

type SecondFactorAttemptResult =
  | { kind: 'success'; result: LoginResult }
  | { kind: 'failure'; failure: LoginFailureResolution };

const resolveAbsoluteApiBaseUrl = () => {
  if (typeof window === 'undefined') return null;
  try {
    return new URL(API_BASE_URL, window.location.origin);
  } catch {
    return null;
  }
};

const assertLoginTargetIsAllowed = () => {
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
    return;
  }
  const absoluteBaseUrl = resolveAbsoluteApiBaseUrl();
  if (absoluteBaseUrl?.protocol === 'http:') {
    throw new Error('HTTPS 画面から HTTP 接続先へは送れません。設定を修正してください。');
  }
};

const parseUserPk = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

export const normalizeSessionResult = (
  data: SessionAuthResponse,
  fallback: {
    facilityId: string;
    userId: string;
    userPk?: number;
    clientUuid: string;
    runId: string;
  },
): LoginResult => {
  const normalizedRoles = normalizeRoles(data.roles);
  return {
    facilityId: data.facilityId ?? fallback.facilityId,
    userId: data.userId ?? fallback.userId,
    userPk: parseUserPk(data.userPk) ?? parseUserPk(fallback.userPk),
    displayName: data.displayName,
    commonName: data.commonName,
    clientUuid: data.clientUuid ?? fallback.clientUuid,
    runId: data.runId ?? fallback.runId,
    role: inferRole(fallback.userId, normalizedRoles),
    roles: normalizedRoles,
  };
};

type LoginScreenProps = {
  onLoginSuccess?: (result: LoginResult) => void;
  initialFacilityId?: string;
  lockFacilityId?: boolean;
  initialNotice?: { message: string; tone: FeedbackTone };
  destinationSummary?: {
    title: string;
    body: string;
  };
};

export const LoginScreen = ({
  onLoginSuccess,
  initialFacilityId,
  lockFacilityId = false,
  initialNotice,
  destinationSummary,
}: LoginScreenProps) => {
  const [values, setValues] = useState<CredentialsFormValues>(() => ({
    facilityId: initialFacilityId ?? '',
    userId: '',
    password: '',
    clientUuid: '',
  }));
  const [errors, setErrors] = useState<Partial<Record<CredentialsFieldKey, string>>>({});
  const [secondFactorCode, setSecondFactorCode] = useState('');
  const [secondFactorError, setSecondFactorError] = useState<string | null>(null);
  const [step, setStep] = useState<LoginStep>('credentials');
  const [pendingSecondFactor, setPendingSecondFactor] = useState<PendingSecondFactorState | null>(null);
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('error');
  const [profile, setProfile] = useState<LoginResult | null>(null);
  const secondFactorInputRef = useRef<HTMLInputElement | null>(null);

  const isLoading = status === 'loading';
  const isSuccess = status === 'success';
  const normalizedFacilityId = normalize(values.facilityId);
  const normalizedUserId = normalize(values.userId);
  const shouldLockFacility = lockFacilityId && Boolean(normalizedFacilityId);
  const resolvedFacilityId = shouldLockFacility ? (initialFacilityId ?? values.facilityId) : values.facilityId;
  const normalizedResolvedFacilityId = normalize(resolvedFacilityId);
  const canSubmitCredentials = Boolean(normalizedResolvedFacilityId && normalizedUserId && values.password && !isLoading);
  const normalizedFactor2Code = secondFactorCode.replace(/\D/g, '');
  const canSubmitFactor2 = Boolean(normalizedFactor2Code.length === 6 && !isLoading);
  const stepMeta: LoginStepMeta = useMemo(() => {
    if (step === 'factor2') {
      return {
        badge: 'ステップ 2/2',
        title: '二要素認証',
        body: 'ログイン情報の確認が終わったため、続けて認証アプリの6桁コードで本人確認を行います。',
      };
    }
    return {
      badge: 'ステップ 1/2',
      title: '認証情報の入力',
      body: '施設ID・ユーザーID・パスワードを確認してサインインします。',
    };
  }, [step]);

  useEffect(() => {
    const notice = consumeSessionExpiredNotice();
    if (notice?.message) {
      setFeedback(notice.message);
      setFeedbackTone('error');
      setStatus('error');
      return;
    }
    if (initialNotice?.message) {
      setFeedback(initialNotice.message);
      setFeedbackTone(initialNotice.tone);
      setStatus(initialNotice.tone === 'error' ? 'error' : 'idle');
    }
  }, [initialNotice]);

  useEffect(() => {
    if (!initialFacilityId) return;
    setValues((prev) =>
      prev.facilityId === initialFacilityId ? prev : { ...prev, facilityId: initialFacilityId },
    );
  }, [initialFacilityId]);

  useEffect(() => {
    if (step !== 'factor2') return;
    secondFactorInputRef.current?.focus();
  }, [step]);

  const handleChange = (key: CredentialsFieldKey) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleFacilityChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (shouldLockFacility) return;
    handleChange('facilityId')(event);
  };

  const handleSecondFactorCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value.replace(/\D/g, '').slice(0, 6);
    setSecondFactorCode(next);
    if (secondFactorError) {
      setSecondFactorError(null);
    }
  };

  const validateCredentials = (form: CredentialsFormValues) => {
    const next: Partial<Record<CredentialsFieldKey, string>> = {};
    if (!normalize(form.facilityId)) {
      next.facilityId = '施設IDを入力してください。';
    }
    if (!normalize(form.userId)) {
      next.userId = 'ユーザーIDを入力してください。';
    }
    if (!form.password) {
      next.password = 'パスワードを入力してください。';
    }
    return next;
  };

  const resetToCredentialsStep = (message?: string, tone: FeedbackTone = 'error') => {
    setStep('credentials');
    setPendingSecondFactor(null);
    setSecondFactorCode('');
    setSecondFactorError(null);
    setValues((prev) => ({ ...prev, password: '', clientUuid: prev.clientUuid || '' }));
    if (message) {
      setFeedback(message);
      setFeedbackTone(tone);
      setStatus(tone === 'success' ? 'success' : 'error');
    } else {
      setStatus('idle');
    }
  };

  const handleCredentialsSubmit = async () => {
    setFeedback(null);
    setProfile(null);
    setSecondFactorError(null);

    const clientUuid = createClientUuid(values.clientUuid);
    const normalizedValues: CredentialsFormValues = {
      facilityId: normalize(resolvedFacilityId),
      userId: normalize(values.userId),
      password: values.password,
      clientUuid,
    };
    setValues((prev) => ({ ...prev, clientUuid }));

    const nextErrors = validateCredentials(normalizedValues);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFeedbackTone('error');
      setStatus('error');
      return;
    }

    setErrors({});
    setStatus('loading');

    const runId = generateRunId();
    updateObservabilityMeta({ runId, traceId: undefined });

    try {
      logAuditEvent({
        runId,
        source: 'auth',
        note: 'login attempt',
        payload: {
          action: 'login',
          screen: 'login',
          facilityId: normalizedValues.facilityId,
          userId: normalizedValues.userId,
        },
      });
      const outcome = await performLogin(normalizedValues, runId);
      if (outcome.kind === 'factor2_required') {
        setValues((prev) => ({ ...prev, password: '', clientUuid: outcome.clientUuid }));
        setPendingSecondFactor({
          facilityId: normalizedValues.facilityId,
          userId: normalizedValues.userId,
          clientUuid: outcome.clientUuid,
          runId: outcome.runId,
        });
        setSecondFactorCode('');
        setStep('factor2');
        setFeedback(null);
        setFeedbackTone('info');
        setStatus('idle');
        logAuditEvent({
          runId: outcome.runId,
          source: 'auth',
          note: 'login factor2 required',
          payload: {
            action: 'login',
            screen: 'login',
            outcome: 'factor2_required',
            facilityId: normalizedValues.facilityId,
            userId: normalizedValues.userId,
            clientUuid: outcome.clientUuid,
          },
        });
        return;
      }

      setProfile(outcome.result);
      setFeedback('ログインに成功しました。');
      setFeedbackTone('success');
      setStatus('success');
      logAuditEvent({
        runId: outcome.result.runId,
        source: 'auth',
        note: 'login success',
        payload: {
          action: 'login',
          screen: 'login',
          outcome: 'success',
          facilityId: outcome.result.facilityId,
          userId: outcome.result.userId,
          role: outcome.result.role,
          roles: outcome.result.roles,
        },
      });
      onLoginSuccess?.(outcome.result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ログインに失敗しました。';
      setFeedback(message);
      setFeedbackTone('error');
      setStatus('error');
      logAuditEvent({
        runId,
        source: 'auth',
        note: 'login denied',
        payload: {
          action: 'login',
          screen: 'login',
          outcome: 'denied',
          facilityId: normalizedValues.facilityId,
          userId: normalizedValues.userId,
          reason: message,
        },
      });
    }
  };

  const handleSecondFactorSubmit = async () => {
    const pending = pendingSecondFactor;
    if (!pending) {
      resetToCredentialsStep(AUTH_COPY.factor2SessionMissing);
      return;
    }

    const code = normalizedFactor2Code;
    if (code.length !== 6) {
      setSecondFactorError('6桁の認証コードを入力してください。');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setFeedback(null);
    setProfile(null);
    setSecondFactorError(null);

    try {
      logAuditEvent({
        runId: pending.runId,
        source: 'auth',
        note: 'login factor2 attempt',
        payload: {
          action: 'login-factor2',
          screen: 'login',
          facilityId: pending.facilityId,
          userId: pending.userId,
        },
      });
      const outcome = await performSecondFactorLogin(
        {
          facilityId: pending.facilityId,
          userId: pending.userId,
          clientUuid: pending.clientUuid,
        },
        pending.runId,
        code,
      );

      if (outcome.kind === 'failure') {
        if (outcome.failure.kind === 'factor2_invalid') {
          setFeedback(outcome.failure.message);
          setFeedbackTone('error');
          setStatus('error');
          return;
        }
        if (
          outcome.failure.kind === 'factor2_session_missing'
          || outcome.failure.kind === 'factor2_session_expired'
        ) {
          resetToCredentialsStep(outcome.failure.message);
          return;
        }
        setFeedback(outcome.failure.message);
        setFeedbackTone('error');
        setStatus('error');
        return;
      }

      setPendingSecondFactor(null);
      setSecondFactorCode('');
      setStep('credentials');
      setProfile(outcome.result);
      setFeedback('ログインに成功しました。');
      setFeedbackTone('success');
      setStatus('success');
      logAuditEvent({
        runId: outcome.result.runId,
        source: 'auth',
        note: 'login factor2 success',
        payload: {
          action: 'login-factor2',
          screen: 'login',
          outcome: 'success',
          facilityId: outcome.result.facilityId,
          userId: outcome.result.userId,
        },
      });
      onLoginSuccess?.(outcome.result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '二要素認証に失敗しました。';
      setFeedback(message);
      setFeedbackTone('error');
      setStatus('error');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 'factor2') {
      await handleSecondFactorSubmit();
      return;
    }
    await handleCredentialsSubmit();
  };

  const buttonLabel = useMemo(() => {
    if (isLoading) {
      return step === 'factor2' ? '確認中…' : 'ログイン中…';
    }
    if (step === 'factor2') {
      return '認証コードを確認';
    }
    if (isSuccess) {
      return '再ログイン';
    }
    return 'ログイン';
  }, [isLoading, isSuccess, step]);

  const statusClassName = useMemo(() => {
    if (feedbackTone === 'success') return 'status-message is-success';
    if (feedbackTone === 'info') return 'status-message';
    return 'status-message is-error';
  }, [feedbackTone]);

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-heading">
        <header className="login-card__header">
          <h1 id="login-heading" className="login-card__title">
            OpenDolphin Web ログイン
          </h1>
          <div className="login-brand">
            <div className="login-brand__badge">
              <img src={SYSTEM_ICON_URL} alt="OpenDolphin システムアイコン" />
            </div>
          </div>
          <div className="status-message" role="status" aria-live="polite">
            <p style={{ margin: 0, fontWeight: 700 }}>{stepMeta.badge}</p>
            <p style={{ margin: '0.25rem 0 0', fontWeight: 700 }}>{stepMeta.title}</p>
            <p className="status-message__detail">{stepMeta.body}</p>
          </div>
          {destinationSummary ? (
            <div className="status-message" role="status" aria-live="polite">
              <p style={{ margin: 0, fontWeight: 700 }}>{destinationSummary.title}</p>
              <p className="status-message__detail">{destinationSummary.body}</p>
            </div>
          ) : null}
        </header>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {step === 'credentials' ? (
            <>
              <label className="field">
                <span>施設ID</span>
                <input
                  id="login-facility-id"
                  name="loginFacilityId"
                  type="text"
                  autoComplete="organization"
                  value={resolvedFacilityId}
                  onChange={handleFacilityChange}
                  placeholder="例: 0001"
                  disabled={isLoading}
                />
                {errors.facilityId ? <span className="field-error">{errors.facilityId}</span> : null}
              </label>

              <label className="field">
                <span>ユーザーID</span>
                <input
                  id="login-user-id"
                  name="loginUserId"
                  type="text"
                  autoComplete="username"
                  value={values.userId}
                  onChange={handleChange('userId')}
                  placeholder="例: doctor01"
                  disabled={isLoading}
                />
                {errors.userId ? <span className="field-error">{errors.userId}</span> : null}
              </label>

              <label className="field">
                <span>パスワード</span>
                <input
                  id="login-password"
                  name="loginPassword"
                  type="password"
                  autoComplete="current-password"
                  value={values.password}
                  onChange={handleChange('password')}
                  placeholder="パスワード"
                  disabled={isLoading}
                />
                {errors.password ? <span className="field-error">{errors.password}</span> : null}
              </label>
            </>
          ) : (
            <>
              <div className="status-message" role="status" aria-live="polite">
                {AUTH_COPY.factor2Required}
                <p className="status-message__detail">
                  対象: {pendingSecondFactor?.facilityId}:{pendingSecondFactor?.userId}
                </p>
                <p className="status-message__detail">
                  パスワードは保持していません。認証コードのみ入力してください。
                </p>
              </div>

              <label className="field">
                <span>認証コード</span>
                <input
                  ref={secondFactorInputRef}
                  id="login-factor2-code"
                  name="loginFactor2Code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={secondFactorCode}
                  onChange={handleSecondFactorCodeChange}
                  placeholder="6桁コード"
                  disabled={isLoading}
                />
                {secondFactorError ? <span className="field-error">{secondFactorError}</span> : null}
              </label>

              <div className="login-form__actions">
                <button type="submit" disabled={!canSubmitFactor2}>
                  {buttonLabel}
                </button>
                <button
                  type="button"
                  onClick={() => resetToCredentialsStep(AUTH_COPY.factor2Cancelled, 'info')}
                  disabled={isLoading}
                >
                  二要素認証を中止
                </button>
              </div>
            </>
          )}

          {step === 'credentials' ? (
            <div className="login-form__actions">
              <button type="submit" disabled={!canSubmitCredentials}>
                {buttonLabel}
              </button>
            </div>
          ) : null}

          {feedback ? (
            <div className={statusClassName} role="status">
              {feedback}
              {isSuccess && profile ? (
                <p className="status-message__detail">
                  サインインユーザー: {profile.displayName ?? profile.commonName ?? `${profile.facilityId}:${profile.userId}`}
                </p>
              ) : null}
            </div>
          ) : null}
        </form>
      </section>
    </main>
  );
};

const executeSessionPost = async (endpoint: string, body: Record<string, unknown>): Promise<Response> => {
  assertLoginTargetIsAllowed();
  const timeoutMs = resolveLoginTimeoutMs();

  const sendRequest = async (signal?: AbortSignal) =>
    httpFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      notifySessionExpired: false,
      cache: 'no-store',
      body: JSON.stringify(body),
      signal,
    });

  const executeWithTimeout = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await sendRequest(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  };

  const shouldRetry = (error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('abort')
        || message.includes('aborted')
        || message.includes('err_aborted')
        || message.includes('failed to fetch')
        || message.includes('networkerror')
        || message.includes('timeout')
      );
    }
    return false;
  };

  let response: Response | null = null;
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      response = await executeWithTimeout();
      break;
    } catch (error) {
      if (attempt < maxAttempts && shouldRetry(error)) {
        await waitMs(400);
        continue;
      }
      if (shouldRetry(error)) {
        throw new Error('通信がタイムアウトまたは中断されました。時間をおいて再試行してください。');
      }
      throw error;
    }
  }

  if (!response) {
    throw new Error('ログイン応答を取得できませんでした。');
  }
  return response;
};

const performLogin = async (payload: CredentialsFormValues, runId: string): Promise<LoginAttemptResult> => {
  const clientUuid = createClientUuid(payload.clientUuid);
  const response = await executeSessionPost(SESSION_LOGIN_ENDPOINT, {
    facilityId: payload.facilityId,
    userId: payload.userId,
    password: payload.password,
    clientUuid,
  });

  if (!response.ok) {
    const body = await response.text();
    const failure = resolveLoginFailure({
      status: response.status,
      bodyText: body,
      statusText: response.statusText,
      retryAfter: response.headers.get('Retry-After') ?? undefined,
    });
    if (failure.kind === 'factor2_required') {
      return { kind: 'factor2_required', message: failure.message, clientUuid, runId };
    }
    throw new Error(failure.message);
  }

  const data = (await response.json()) as SessionAuthResponse;
  return {
    kind: 'success',
    result: normalizeSessionResult(data, {
      facilityId: payload.facilityId,
      userId: payload.userId,
      clientUuid,
      runId,
    }),
  };
};

const performSecondFactorLogin = async (
  payload: { facilityId: string; userId: string; clientUuid: string },
  runId: string,
  code: string,
): Promise<SecondFactorAttemptResult> => {
  const response = await executeSessionPost(SESSION_FACTOR2_LOGIN_ENDPOINT, { code });
  if (!response.ok) {
    const body = await response.text();
    return {
      kind: 'failure',
      failure: resolveLoginFailure({
        status: response.status,
        bodyText: body,
        statusText: response.statusText,
        retryAfter: response.headers.get('Retry-After') ?? undefined,
      }),
    };
  }

  const data = (await response.json()) as SessionAuthResponse;
  return {
    kind: 'success',
    result: normalizeSessionResult(data, {
      facilityId: payload.facilityId,
      userId: payload.userId,
      clientUuid: payload.clientUuid,
      runId,
    }),
  };
};
