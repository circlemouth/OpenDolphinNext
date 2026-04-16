import { httpFetch } from '../../libs/http/httpClient';
import { ensureObservabilityMeta, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';

export type { OrcaQueueEntry, OrcaQueueResponse } from '../outpatient/orcaQueueApi';
export { discardOrcaQueue, fetchOrcaQueue, retryOrcaQueue } from '../outpatient/orcaQueueApi';

export type ChartsMasterSourcePolicy = 'auto' | 'server' | 'mock' | 'snapshot' | 'fallback';

export type AdminConfigPayload = {
  chartsDisplayEnabled: boolean;
  chartsSendEnabled: boolean;
  chartsMasterSource: ChartsMasterSourcePolicy;
};

export type AdminConfigResponse = Partial<AdminConfigPayload> & {
  status?: number;
  runId?: string;
  deliveryId?: string;
  deliveryVersion?: string;
  deliveryEtag?: string;
  deliveredAt?: string;
  source?: 'mock' | 'live';
  verified?: boolean;
  note?: string;
  environment?: string;
  deliveryMode?: string;
};

export type OperationsCheck = {
  status?: string;
  [key: string]: unknown;
};

export type OperationsReadinessChecks = {
  database?: OperationsCheck;
  orca?: OperationsCheck;
  attachmentStorage?: OperationsCheck;
  pvtQueue?: OperationsCheck;
  patientImages?: OperationsCheck;
};

export type OperationsHealthResponse = {
  ok: boolean;
  status: number;
  summaryStatus?: string;
  service?: string;
  runId?: string;
  traceId?: string;
  error?: string;
  raw: Record<string, unknown>;
};

export type OperationsReadinessResponse = {
  ok: boolean;
  status: number;
  summaryStatus?: string;
  checks: OperationsReadinessChecks;
  runId?: string;
  traceId?: string;
  error?: string;
  raw: Record<string, unknown>;
};

export type PvtWorkerHealthResponse = {
  ok: boolean;
  status: number;
  workerStatus?: string;
  reasonCodes: string[];
  runId?: string;
  traceId?: string;
  error?: string;
  raw: Record<string, unknown>;
};

const ADMIN_CONFIG_ENDPOINT = '/api/admin/config';
const OPERATIONS_HEALTH_ENDPOINT = '/api/health';
const OPERATIONS_READINESS_ENDPOINT = '/api/health/readiness';
const PVT_WORKER_HEALTH_ENDPOINT = '/api/health/worker/pvt';

let adminEndpointUnavailable = false;

const buildAdminUnavailableResponse = (status = 404): AdminConfigResponse => ({
  status,
  note: 'admin endpoint unavailable',
  chartsDisplayEnabled: true,
  chartsSendEnabled: true,
  chartsMasterSource: 'auto',
});

const normalizeBooleanHeader = (value: string | null) => {
  if (value === null) return undefined;
  return value === 'enabled' || value === '1' || value === 'true';
};

const normalizeHeaderValue = (value: string | null) => (typeof value === 'string' ? value.trim() : undefined);
const getString = (value: unknown) => (typeof value === 'string' ? value : undefined);
const getBoolean = (value: unknown) => (typeof value === 'boolean' ? value : undefined);
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const getStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item : String(item ?? ''))).filter(Boolean) : [];

const getObservabilityFromResponse = (body: Record<string, unknown>, headers: Headers, beforeMeta: { runId?: string; traceId?: string }) => {
  const runId = getString(body.runId) ?? headers.get('x-run-id') ?? getObservabilityMeta().runId ?? beforeMeta.runId;
  const traceId = getString(body.traceId) ?? headers.get('x-trace-id') ?? getObservabilityMeta().traceId ?? beforeMeta.traceId;
  if (runId || traceId) {
    updateObservabilityMeta({
      ...(runId ? { runId } : {}),
      ...(traceId ? { traceId } : {}),
    });
  }
  return { runId, traceId };
};

const resolveClientEnvironment = () => {
  const meta = import.meta.env as Record<string, string | undefined>;
  return meta.VITE_ENVIRONMENT ?? meta.VITE_DEPLOY_ENV ?? (import.meta.env.MODE === 'development' ? 'dev' : meta.MODE);
};

const normalizeEnvironment = (body: Record<string, unknown>, headers: Headers) => {
  const header =
    headers.get('x-environment') ??
    headers.get('x-env') ??
    headers.get('x-stage') ??
    headers.get('x-runtime-env') ??
    undefined;
  const bodyValue = getString(body.environment) ?? getString(body.env) ?? getString(body.stage);
  const clientValue = resolveClientEnvironment();
  return header ?? bodyValue ?? clientValue;
};

const normalizeDeliveryMode = (body: Record<string, unknown>, headers: Headers) => {
  const header = headers.get('x-delivery-mode') ?? headers.get('x-admin-delivery-mode') ?? undefined;
  return getString(body.deliveryMode) ?? getString(body.deliveryState) ?? getString(body.deliveryStatus) ?? header;
};

const isChartsMasterSourcePolicy = (value: string): value is ChartsMasterSourcePolicy =>
  value === 'auto' || value === 'server' || value === 'mock' || value === 'snapshot' || value === 'fallback';

const getChartsMasterSourcePolicy = (value: unknown): ChartsMasterSourcePolicy | undefined => {
  const raw = getString(value);
  if (!raw) return undefined;
  return isChartsMasterSourcePolicy(raw) ? raw : undefined;
};

const normalizeConfig = (json: unknown, headers: Headers, status?: number): AdminConfigResponse => {
  const body = asRecord(json);
  const runId = getString(body.runId) ?? headers.get('x-run-id') ?? undefined;
  const verifyHeader = headers.get('x-admin-delivery-verification');
  const queueMode = headers.get('x-orca-queue-mode');
  const headerEtag = normalizeHeaderValue(headers.get('etag') ?? headers.get('x-etag') ?? headers.get('x-delivery-etag'));
  const deliveryEtag = getString(body.etag) ?? headerEtag;
  const deliveryVersion = getString(body.deliveryVersion) ?? getString(body.version) ?? deliveryEtag;
  const verified = getBoolean(body.verified) ?? normalizeBooleanHeader(verifyHeader);
  const source = (getString(body.source) as 'mock' | 'live' | undefined) ?? (queueMode === 'mock' ? 'mock' : 'live');
  const environment = normalizeEnvironment(body, headers);
  const deliveryMode = normalizeDeliveryMode(body, headers);

  const charts = asRecord(body.charts);

  const payload: AdminConfigResponse = {
    chartsDisplayEnabled: getBoolean(body.chartsDisplayEnabled) ?? getBoolean(charts.displayEnabled),
    chartsSendEnabled: getBoolean(body.chartsSendEnabled) ?? getBoolean(charts.sendEnabled),
    chartsMasterSource:
      getChartsMasterSourcePolicy(body.chartsMasterSource) ?? getChartsMasterSourcePolicy(charts.masterSource),
    deliveryId: getString(body.deliveryId),
    deliveryVersion,
    deliveryEtag,
    deliveredAt: getString(body.deliveredAt) ?? getString(body.updatedAt),
    status,
    note: getString(body.note),
    runId,
    source,
    verified,
    environment,
    deliveryMode,
  };

  if (runId) {
    updateObservabilityMeta({ runId });
  }
  return payload;
};

export async function fetchAdminConfig(): Promise<AdminConfigResponse> {
  if (adminEndpointUnavailable) return buildAdminUnavailableResponse();
  const response = await httpFetch(ADMIN_CONFIG_ENDPOINT, { method: 'GET', notifySessionExpired: false });
  const json = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) {
    return buildAdminUnavailableResponse(response.status);
  }
  if (response.status === 404) {
    adminEndpointUnavailable = true;
    return buildAdminUnavailableResponse(response.status);
  }
  return normalizeConfig(json, response.headers, response.status);
}

export async function saveAdminConfig(payload: AdminConfigPayload): Promise<AdminConfigResponse> {
  const response = await httpFetch(ADMIN_CONFIG_ENDPOINT, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    notifySessionExpired: false,
  });
  const json = await response.json().catch(() => ({}));
  return normalizeConfig(json, response.headers, response.status);
}

export async function fetchOperationsHealth(): Promise<OperationsHealthResponse> {
  const beforeMeta = ensureObservabilityMeta();
  const response = await httpFetch(OPERATIONS_HEALTH_ENDPOINT, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    notifySessionExpired: false,
  });
  const json = await response.json().catch(() => ({}));
  const body = asRecord(json);
  const { runId, traceId } = getObservabilityFromResponse(body, response.headers, beforeMeta);
  const summaryStatus = getString(body.status);
  const ok = response.ok && summaryStatus === 'UP';
  const error = !ok ? getString(body.error ?? body.message) ?? `HTTP ${response.status}` : undefined;
  return {
    ok,
    status: response.status,
    summaryStatus,
    service: getString(body.service),
    runId,
    traceId,
    error,
    raw: body,
  };
}

export async function fetchOperationsReadiness(): Promise<OperationsReadinessResponse> {
  const beforeMeta = ensureObservabilityMeta();
  const response = await httpFetch(OPERATIONS_READINESS_ENDPOINT, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    notifySessionExpired: false,
  });
  const json = await response.json().catch(() => ({}));
  const body = asRecord(json);
  const { runId, traceId } = getObservabilityFromResponse(body, response.headers, beforeMeta);
  const summaryStatus = getString(body.status);
  const checks = asRecord(body.checks) as OperationsReadinessChecks;
  const ok = response.ok && summaryStatus === 'UP';
  const error = !ok ? getString(body.error ?? body.message) ?? `HTTP ${response.status}` : undefined;
  return {
    ok,
    status: response.status,
    summaryStatus,
    checks,
    runId,
    traceId,
    error,
    raw: body,
  };
}

export async function fetchPvtWorkerHealth(): Promise<PvtWorkerHealthResponse> {
  const beforeMeta = ensureObservabilityMeta();
  const response = await httpFetch(PVT_WORKER_HEALTH_ENDPOINT, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    notifySessionExpired: false,
  });
  const json = await response.json().catch(() => ({}));
  const body = asRecord(json);
  const { runId, traceId } = getObservabilityFromResponse(body, response.headers, beforeMeta);
  const workerStatus = getString(body.status);
  const ok = response.ok && (workerStatus === 'UP' || workerStatus === 'DISABLED');
  const error = !ok ? getString(body.error ?? body.message) ?? `HTTP ${response.status}` : undefined;
  return {
    ok,
    status: response.status,
    workerStatus,
    reasonCodes: getStringArray(body.reasonCodes),
    runId,
    traceId,
    error,
    raw: body,
  };
}
