export type OrcaResponseErrorKind = 'business_not_found' | 'route_not_found' | 'auth' | 'http';

export type ParsedOrcaApiResponse = {
  ok: boolean;
  status: number;
  contentType: string;
  text: string;
  json: Record<string, unknown> | null;
  runId?: string;
  apiResult?: string;
  apiResultMessage?: string;
  businessOk?: boolean;
  errorCode?: string;
  message?: string;
  errorKind?: OrcaResponseErrorKind;
  routeMismatch?: boolean;
};

const JSON_CONTENT_TYPE_PATTERN = /\b(application\/json|[^;\s]+\/[^;\s]+\+json)\b/i;
const HTML_BODY_PATTERN = /<!doctype html|<html[\s>]/i;
const DEFAULT_NOT_FOUND_CODES = new Set(['patient_not_found', 'karte_not_found']);

const normalizeMessage = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveErrorCode = (json: Record<string, unknown> | null): string | undefined => {
  if (!json) return undefined;
  const direct =
    normalizeMessage(json.errorCode) ??
    normalizeMessage(json.code) ??
    normalizeMessage(json.reason) ??
    normalizeMessage(json.error);
  return direct;
};

const resolveApiResult = (json: Record<string, unknown> | null): string | undefined => {
  return normalizeMessage(json?.apiResult);
};

const resolveApiResultMessage = (json: Record<string, unknown> | null): string | undefined => {
  return normalizeMessage(json?.apiResultMessage);
};

const isApiResultBusinessSuccess = (apiResult?: string): boolean | undefined => {
  if (!apiResult) return undefined;
  return /^[0]+$/.test(apiResult);
};

const resolveMessage = (json: Record<string, unknown> | null, text: string, status: number, fallback?: string): string => {
  const fromJson =
    normalizeMessage(json?.message) ??
    normalizeMessage(json?.apiResultMessage) ??
    normalizeMessage(json?.errorDescription) ??
    normalizeMessage(json?.error);
  if (fromJson) return fromJson;
  const trimmed = text.trim();
  if (trimmed.length > 0) return trimmed.slice(0, 240);
  return fallback ?? `HTTP ${status}`;
};

const isJsonContentType = (contentType: string) => JSON_CONTENT_TYPE_PATTERN.test(contentType);

export const looksLikeHtmlResponse = (text: string) => HTML_BODY_PATTERN.test(text);

export async function parseOrcaApiResponse(
  response: Response,
  options: { notFoundCodes?: ReadonlySet<string>; fallbackMessage?: string } = {},
): Promise<ParsedOrcaApiResponse> {
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  const text = await response.text().catch(() => '');
  const canParseJson = isJsonContentType(contentType) || (!contentType && text.trim().startsWith('{'));
  let json: Record<string, unknown> | null = null;
  if (canParseJson && text.trim().length > 0) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        json = parsed as Record<string, unknown>;
      }
    } catch {
      json = null;
    }
  }

  const status = response.status;
  const errorCode = resolveErrorCode(json);
  const runId = normalizeMessage(json?.runId);
  const apiResult = resolveApiResult(json);
  const apiResultMessage = resolveApiResultMessage(json);
  const businessOk = isApiResultBusinessSuccess(apiResult);
  const message = resolveMessage(json, text, status, options.fallbackMessage);
  const notFoundCodes = options.notFoundCodes ?? DEFAULT_NOT_FOUND_CODES;

  if (response.ok) {
    return {
      ok: true,
      status,
      contentType,
      text,
      json,
      runId,
      apiResult,
      apiResultMessage,
      businessOk,
      errorCode,
      message,
      errorKind: undefined,
      routeMismatch: false,
    };
  }

  let errorKind: OrcaResponseErrorKind = 'http';
  if (status === 401 || status === 403) {
    errorKind = 'auth';
  } else if (status === 404) {
    if (errorCode && notFoundCodes.has(errorCode)) {
      errorKind = 'business_not_found';
    } else if (!isJsonContentType(contentType) || looksLikeHtmlResponse(text) || !json) {
      errorKind = 'route_not_found';
    }
  }

  return {
    ok: false,
    status,
    contentType,
    text,
    json,
    runId,
    apiResult,
    apiResultMessage,
    businessOk,
    errorCode,
    message,
    errorKind,
    routeMismatch: errorKind === 'route_not_found',
  };
}
