import { httpFetch } from '../../libs/http/httpClient';
import { getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import { isOrcaApiResultOk } from '../../libs/xml/xmlUtils';

export type OrcaQueueEntry = {
  patientId: string;
  status: 'pending' | 'delivered' | 'failed' | string;
  retryable?: boolean;
  lastDispatchAt?: string;
  error?: string;
  headers?: string[];
};

export type OrcaQueueResponse = {
  ok: boolean;
  status: number;
  error?: string;
  message?: string;
  runId?: string;
  traceId?: string;
  fetchedAt?: string;
  source?: 'mock' | 'live';
  verifyAdminDelivery?: boolean;
  patientId?: string;
  retrySupported?: boolean;
  discardSupported?: boolean;
  adminOnly?: boolean;
  retryRequested?: boolean;
  retryApplied?: boolean;
  retryReason?: string;
  discardApplied?: boolean;
  queue: OrcaQueueEntry[];
};

export type OrcaQueueRetryUiFeedback = {
  tone: 'success' | 'info' | 'warning' | 'error';
  message: string;
  detail?: string;
};

export type OrcaPushEvent = {
  eventId?: string;
  event?: string;
  user?: string;
  timestamp?: string;
  patientId?: string;
  payload?: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

export type OrcaPushEventMeta = {
  total?: number;
  kept?: number;
  deduped?: number;
  newlyAdded?: number;
};

export type OrcaPushEventResponse = {
  ok?: boolean;
  apiOk?: boolean;
  runId?: string;
  traceId?: string;
  fetchedAt?: string;
  apiResult?: string;
  apiResultMessage?: string;
  eventName?: string;
  events: OrcaPushEvent[];
  meta?: OrcaPushEventMeta;
  missingTags?: string[];
  status?: number;
  warning?: string;
  error?: string;
};

const ORCA_QUEUE_ENDPOINT = '/api/orca/queue';
const ORCA_PUSH_EVENT_ENDPOINT = '/api/orca/pusheventgetv2';
export const ORCA_QUEUE_PUBLIC_ROUTE_AVAILABLE = false;
export const ORCA_PUSH_EVENT_PUBLIC_ROUTE_AVAILABLE = false;
const isOrcaPollingDisabled = () => import.meta.env.VITE_DISABLE_ORCA_POLLING === '1';
let orcaQueueUnavailable = false;
let orcaPushEventUnavailable = false;
type OrcaQueueRequestOptions = {
  enabled?: boolean;
};

const buildUnavailableQueueResponse = (): OrcaQueueResponse => ({
  ok: false,
  status: 410,
  runId: getObservabilityMeta().runId,
  traceId: getObservabilityMeta().traceId,
  fetchedAt: new Date().toISOString(),
  source: 'live',
  error: 'HTTP 410',
  message: 'ORCA queue public route は現行 contract では利用できません。',
  retrySupported: false,
  discardSupported: false,
  adminOnly: true,
  queue: [],
});

const buildUnavailablePushEventResponse = (status = 0, warning?: string): OrcaPushEventResponse => ({
  ok: false,
  status: status || 410,
  runId: getObservabilityMeta().runId,
  traceId: getObservabilityMeta().traceId,
  fetchedAt: new Date().toISOString(),
  events: [],
  error: status || warning ? `HTTP ${status || 410}` : 'HTTP 410',
  warning: warning ?? 'ORCA push event public route は現行 contract では利用できません。',
});

const getString = (value: unknown) => (typeof value === 'string' ? value : undefined);
const getBoolean = (value: unknown) => (typeof value === 'boolean' ? value : undefined);
const getNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const normalizeErrorCode = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.toLowerCase();
};
const parseNumberHeader = (value: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

type OrcaPushEventRequestParams = {
  event?: string;
  user?: string;
  startTime?: string;
  endTime?: string;
};

export const buildOrcaPushEventRequestJson = (params?: OrcaPushEventRequestParams) => {
  const request: Record<string, string> = {};
  if (params?.event) request.event = params.event;
  if (params?.user) request.user = params.user;
  if (params?.startTime) request.start_time = params.startTime;
  if (params?.endTime) request.end_time = params.endTime;
  return JSON.stringify({ pusheventgetv2req: request });
};

const normalizeQueue = (json: unknown, headers: Headers): OrcaQueueResponse => {
  const body = (json ?? {}) as Record<string, unknown>;
  const queue = Array.isArray((body as { queue?: unknown }).queue)
    ? (((body as { queue?: unknown }).queue as OrcaQueueEntry[]) ?? [])
    : [];

  const runId = getString(body.runId) ?? headers.get('x-run-id') ?? undefined;
  const traceId = headers.get('x-trace-id') ?? getObservabilityMeta().traceId;
  if (runId) updateObservabilityMeta({ runId });

  return {
    ok: false,
    status: 0,
    runId,
    traceId,
    fetchedAt: new Date().toISOString(),
    source: (getString(body.source) as 'mock' | 'live' | undefined) ?? 'live',
    verifyAdminDelivery: getBoolean(body.verifyAdminDelivery),
    patientId: getString(body.patientId),
    retrySupported: getBoolean(body.retrySupported),
    discardSupported: getBoolean(body.discardSupported),
    adminOnly: getBoolean(body.adminOnly),
    retryRequested: getBoolean(body.retryRequested),
    retryApplied: getBoolean(body.retryApplied),
    retryReason:
      getString(body.retryReason) ?? normalizeErrorCode(body.errorCode) ?? normalizeErrorCode(body.code) ?? normalizeErrorCode(body.error),
    discardApplied: getBoolean(body.discardApplied),
    message: getString(body.message),
    queue,
  };
};

const buildQueueResponse = (response: Response, json: unknown): OrcaQueueResponse => {
  const normalized = normalizeQueue(json, response.headers);
  const localizedMessage =
    response.status === 403
      ? 'ORCA再送の権限がありません。'
      : response.status === 404
        ? 'ORCAキューが見つかりません。'
        : response.status >= 500
          ? 'ORCAキューの取得に失敗しました。'
          : undefined;
  return {
    ...normalized,
    ok: response.ok,
    status: response.status,
    error: response.ok ? undefined : `HTTP ${response.status}`,
    message:
      localizedMessage ??
      normalized.message ??
      getString(asRecord(json)?.message) ??
      undefined,
  };
};

const formatRetryReason = (reason?: string) => {
  switch ((reason ?? '').trim().toLowerCase()) {
    case 'patientid_required':
    case 'patient_id_required':
      return '患者IDが必要です。';
    case 'not_implemented':
      return 'この環境では ORCA 再送は未実装です。';
    case 'mock_noop':
      return '対象キューが見つからないため再送されませんでした。';
    case 'retry_request_failed':
      return 'ORCA 再送要求に失敗しました。';
    default:
      return reason?.trim() ? `reason=${reason}` : undefined;
  }
};

export const resolveOrcaQueueRetryUiFeedback = (response: OrcaQueueResponse): OrcaQueueRetryUiFeedback => {
  if (response.status === 400) {
    return { tone: 'warning', message: 'ORCA再送に必要な患者IDが不足しています。', detail: formatRetryReason(response.retryReason) };
  }
  if (response.status === 403) {
    return { tone: 'error', message: 'ORCA再送の権限がありません。' };
  }
  if (response.status === 410) {
    return { tone: 'info', message: 'ORCA queue public route は現行 contract では利用できません。' };
  }
  if (response.status === 501) {
    return { tone: 'info', message: 'この環境では ORCA 再送は未実装です。', detail: formatRetryReason(response.retryReason) };
  }
  if (!response.ok || response.status >= 500 || response.status === 0) {
    return {
      tone: 'error',
      message: 'ORCA再送に失敗しました。',
      detail: formatRetryReason(response.retryReason) ?? response.error ?? response.message,
    };
  }
  if (response.retryApplied === true) {
    return { tone: 'success', message: 'ORCA再送を受け付けました。', detail: formatRetryReason(response.retryReason) };
  }
  return {
    tone: 'info',
    message: 'ORCA再送は実行されませんでした。',
    detail: formatRetryReason(response.retryReason) ?? response.message,
  };
};

const resolvePushEventPayload = (json: unknown): Record<string, unknown> => {
  const body = asRecord(json) ?? {};
  const xmlio2 = asRecord(body.xmlio2);
  const xmlio2Res = xmlio2 ? asRecord(xmlio2.pusheventgetv2res) : undefined;
  return (
    asRecord(body.pusheventgetv2res) ??
    xmlio2Res ??
    body
  );
};

const buildPushEventKey = (event: OrcaPushEvent) => {
  if (event.eventId) return `id:${event.eventId}`;
  const fallback = [event.event ?? 'event', event.timestamp ?? 'time', event.patientId ?? 'patient'].join('|');
  return `fallback:${fallback}`;
};

const normalizePushEvents = (value: unknown): OrcaPushEvent[] => {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const normalized: OrcaPushEvent[] = [];
  for (const item of list) {
    const record = asRecord(item) ?? {};
    const data = asRecord(record.data) ?? record;
    const payload = asRecord(data.body) ?? asRecord(data.payload) ?? asRecord(data.Payload);
    const patientInfo = asRecord(payload?.Patient_Information);
    const event: OrcaPushEvent = {
      eventId: getString(data.uuid ?? data.id ?? data.eventId ?? data.Event_Id ?? data.Event_ID ?? record.uuid ?? record.id),
      event: getString(data.event ?? data.Event ?? data.eventName ?? record.event ?? record.Event),
      user: getString(data.user ?? data.User ?? record.user),
      timestamp: getString(data.time ?? data.timestamp ?? data.Timestamp ?? record.timestamp),
      patientId: getString(
        data.patientId ??
          data.patient_id ??
          data.Patient_ID ??
          payload?.Patient_ID ??
          payload?.patient_id ??
          patientInfo?.Patient_ID ??
          patientInfo?.patient_id,
      ),
      payload,
      raw: record,
    };
    const key = buildPushEventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(event);
  }
  return normalized;
};

const normalizePushEventResponse = (json: unknown, headers: Headers, status: number): OrcaPushEventResponse => {
  const payload = resolvePushEventPayload(json);
  const eventsValue =
    Array.isArray(payload.Event_Information) ? payload.Event_Information :
    Array.isArray(payload.event_information) ? payload.event_information :
    Array.isArray(payload.events) ? payload.events :
    Array.isArray(payload.EventInformation) ? payload.EventInformation :
    Array.isArray(json) ? json :
    [];
  const events = normalizePushEvents(eventsValue);
  const runId = headers.get('x-run-id') ?? getObservabilityMeta().runId;
  const traceId = headers.get('x-trace-id') ?? getObservabilityMeta().traceId;
  const apiResult = getString(payload.Api_Result ?? payload.apiResult);
  const apiOk = isOrcaApiResultOk(apiResult);
  const apiResultMessage = getString(payload.Api_Result_Message ?? payload.apiResultMessage);
  const eventName = getString(payload.event ?? payload.Event);
  const missingTags = [
    apiResult ? undefined : 'Api_Result',
    apiResultMessage ? undefined : 'Api_Result_Message',
  ].filter((value): value is string => typeof value === 'string');
  if (runId) updateObservabilityMeta({ runId });

  return {
    runId,
    traceId,
    fetchedAt: new Date().toISOString(),
    apiOk,
    apiResult,
    apiResultMessage,
    eventName,
    events,
    meta: {
      total: parseNumberHeader(headers.get('x-orca-pushevent-total')) ?? getNumber(payload.total),
      kept: parseNumberHeader(headers.get('x-orca-pushevent-kept')) ?? getNumber(payload.kept),
      deduped: parseNumberHeader(headers.get('x-orca-pushevent-deduped')) ?? getNumber(payload.deduped),
      newlyAdded: parseNumberHeader(headers.get('x-orca-pushevent-new')) ?? getNumber(payload.new),
    },
    missingTags: missingTags.length > 0 ? missingTags : undefined,
    status,
  };
};

const isQueueRequestDisabled = (options?: OrcaQueueRequestOptions) =>
  options?.enabled === false || isOrcaPollingDisabled() || orcaQueueUnavailable;

export async function fetchOrcaQueue(patientId?: string, options?: OrcaQueueRequestOptions): Promise<OrcaQueueResponse> {
  void patientId;
  if (!ORCA_QUEUE_PUBLIC_ROUTE_AVAILABLE) return buildUnavailableQueueResponse();
  if (isQueueRequestDisabled(options)) return buildUnavailableQueueResponse();
  const endpoint = patientId ? `${ORCA_QUEUE_ENDPOINT}?patientId=${encodeURIComponent(patientId)}` : ORCA_QUEUE_ENDPOINT;
  const response = await httpFetch(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    notifySessionExpired: false,
  });
  if (response.status === 404) {
    orcaQueueUnavailable = true;
  }
  const json = await response.json().catch(() => ({}));
  return buildQueueResponse(response, json);
}

export async function retryOrcaQueue(patientId: string, options?: OrcaQueueRequestOptions): Promise<OrcaQueueResponse> {
  void patientId;
  if (!ORCA_QUEUE_PUBLIC_ROUTE_AVAILABLE) return buildUnavailableQueueResponse();
  if (isQueueRequestDisabled(options)) return buildUnavailableQueueResponse();
  const endpoint = `${ORCA_QUEUE_ENDPOINT}?patientId=${encodeURIComponent(patientId)}&retry=1`;
  const response = await httpFetch(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    notifySessionExpired: false,
  });
  if (response.status === 404) {
    orcaQueueUnavailable = true;
  }
  const json = await response.json().catch(() => ({}));
  return buildQueueResponse(response, json);
}

export async function discardOrcaQueue(patientId: string, options?: OrcaQueueRequestOptions): Promise<OrcaQueueResponse> {
  void patientId;
  if (!ORCA_QUEUE_PUBLIC_ROUTE_AVAILABLE) return buildUnavailableQueueResponse();
  if (isQueueRequestDisabled(options)) return buildUnavailableQueueResponse();
  const endpoint = `${ORCA_QUEUE_ENDPOINT}?patientId=${encodeURIComponent(patientId)}`;
  const response = await httpFetch(endpoint, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    notifySessionExpired: false,
  });
  if (response.status === 404) {
    orcaQueueUnavailable = true;
  }
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    // DELETE 未対応環境では 404/405 が返る可能性があるため、GET で再取得してフォールバックする。
    return fetchOrcaQueue(undefined, options);
  }
  return buildQueueResponse(response, json);
}

export async function fetchOrcaPushEvents(params?: OrcaPushEventRequestParams): Promise<OrcaPushEventResponse> {
  void params;
  if (!ORCA_PUSH_EVENT_PUBLIC_ROUTE_AVAILABLE) {
    return buildUnavailablePushEventResponse(410);
  }
  if (isOrcaPollingDisabled() || orcaPushEventUnavailable) {
    return buildUnavailablePushEventResponse(0, 'orca-push-events disabled');
  }
  const requestBody = buildOrcaPushEventRequestJson(params);
  const response = await httpFetch(ORCA_PUSH_EVENT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/json',
    },
    body: requestBody,
    notifySessionExpired: false,
  });
  if (response.status === 404) {
    orcaPushEventUnavailable = true;
  }
  const json = await response.json().catch(() => ({}));
  const normalized = normalizePushEventResponse(json, response.headers, response.status);
  const error = response.ok ? undefined : `HTTP ${response.status}`;
  const warning =
    !normalized.apiResult || !normalized.apiResultMessage
      ? `missing: ${(normalized.missingTags ?? []).join(', ') || 'Api_Result/Api_Result_Message'}`
      : normalized.apiOk === false
        ? `Api_Result=${normalized.apiResult ?? 'unknown'}`
      : undefined;
  return {
    ...normalized,
    ok: response.ok,
    error,
    warning,
  };
}
