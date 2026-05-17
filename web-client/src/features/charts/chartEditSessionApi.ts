import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';

export type ChartEditSessionParams = {
  patientId: string;
  encounterId?: string;
  receptionId?: string;
  appointmentId?: string;
  ownerTabSessionId: string;
  ownerRunId?: string;
  leaseId?: string;
  forceTakeover?: boolean;
  ttlSeconds?: number;
};

export type ChartEditSessionResult = {
  ok: boolean;
  supported: boolean;
  status: number;
  runId: string;
  lockStatus?: 'owned' | 'released' | 'other-editor' | 'expired' | 'lost' | string;
  leaseId?: string;
  ownerRunId?: string;
  ownerTabSessionId?: string;
  acquiredAt?: string;
  heartbeatAt?: string;
  expiresAt?: string;
  staleTakeover?: boolean;
  error?: string;
};

const ensureRunId = (): string => {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  return runId;
};

const safeJsonParse = (raw: string): Record<string, unknown> | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const postChartEditSession = async (
  operation: 'acquire' | 'heartbeat' | 'release',
  params: ChartEditSessionParams,
): Promise<ChartEditSessionResult> => {
  const runId = ensureRunId();
  const response = await httpFetch(`/api/local/charts/edit-sessions/${operation}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const status = response.status;
  const raw = await response.text().catch(() => '');
  const parsed = safeJsonParse(raw);
  if (status === 404) {
    return { ok: false, supported: false, status, runId, error: 'NOT_SUPPORTED' };
  }
  const resultRunId = typeof parsed?.runId === 'string' ? parsed.runId : runId;
  const result: ChartEditSessionResult = {
    ok: response.ok,
    supported: true,
    status,
    runId: resultRunId,
    lockStatus: typeof parsed?.lockStatus === 'string' ? parsed.lockStatus : undefined,
    leaseId: typeof parsed?.leaseId === 'string' ? parsed.leaseId : undefined,
    ownerRunId: typeof parsed?.ownerRunId === 'string' ? parsed.ownerRunId : undefined,
    ownerTabSessionId: typeof parsed?.ownerTabSessionId === 'string' ? parsed.ownerTabSessionId : undefined,
    acquiredAt: typeof parsed?.acquiredAt === 'string' ? parsed.acquiredAt : undefined,
    heartbeatAt: typeof parsed?.heartbeatAt === 'string' ? parsed.heartbeatAt : undefined,
    expiresAt: typeof parsed?.expiresAt === 'string' ? parsed.expiresAt : undefined,
    staleTakeover: typeof parsed?.staleTakeover === 'boolean' ? parsed.staleTakeover : undefined,
    error: typeof parsed?.error === 'string' ? parsed.error : typeof parsed?.code === 'string' ? parsed.code : undefined,
  };
  return result;
};

export const acquireChartEditSession = (params: ChartEditSessionParams) => postChartEditSession('acquire', params);
export const heartbeatChartEditSession = (params: ChartEditSessionParams) => postChartEditSession('heartbeat', params);
export const releaseChartEditSession = (params: ChartEditSessionParams) => postChartEditSession('release', params);
