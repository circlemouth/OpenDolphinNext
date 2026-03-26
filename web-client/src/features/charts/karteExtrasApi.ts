import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';

export type AllergyEntry = {
  observationId?: number;
  factor?: string;
  severity?: string;
  severityTableId?: string;
  identifiedDate?: string;
  memo?: string;
};

export type SafetySummaryPayload = {
  allergies?: AllergyEntry[] | null;
  diagnoses?: unknown;
  routineMeds?: unknown;
};

export type RpHistoryDrugEntry = {
  srycd?: string;
  srysyukbn?: string;
  name?: string;
  amount?: string;
  dose?: string;
  usage?: string;
  days?: string;
  memo?: string;
};

export type RpHistoryEntry = {
  issuedDate?: string;
  memo?: string;
  rpList?: RpHistoryDrugEntry[];
};

type ApiResultBase = {
  ok: boolean;
  runId: string;
  status: number;
  endpoint: string;
  error?: string;
};

const ensureRunId = (): string => {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  return runId;
};

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export async function fetchSafetySummary({ karteId }: { karteId: number }): Promise<ApiResultBase & { payload?: SafetySummaryPayload }> {
  const runId = ensureRunId();
  const endpoint = `/api/karte/safety/${encodeURIComponent(String(karteId))}`;
  const response = await httpFetch(endpoint);
  const json = (await parseJson(response)) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      typeof json.message === 'string'
        ? (json.message as string)
        : typeof json.error === 'string'
          ? (json.error as string)
          : response.statusText;
    return { ok: false, runId, status: response.status, endpoint, error: message };
  }
  return { ok: true, runId, status: response.status, endpoint, payload: json as SafetySummaryPayload };
}

export async function fetchRpHistory(params: {
  karteId: number;
  fromDate?: string;
  toDate?: string;
  lastOnly?: boolean;
}): Promise<ApiResultBase & { entries: RpHistoryEntry[] }> {
  const runId = ensureRunId();
  const query = new URLSearchParams();
  if (params.fromDate) query.set('fromDate', params.fromDate);
  if (params.toDate) query.set('toDate', params.toDate);
  if (typeof params.lastOnly === 'boolean') query.set('lastOnly', params.lastOnly ? 'true' : 'false');
  const endpoint = `/api/karte/rpHistory/list/${encodeURIComponent(String(params.karteId))}${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await httpFetch(endpoint);
  const json = await parseJson(response);
  if (!response.ok) {
    const raw = (json ?? {}) as Record<string, unknown>;
    const message =
      typeof raw.message === 'string'
        ? (raw.message as string)
        : typeof raw.error === 'string'
          ? (raw.error as string)
          : response.statusText;
    return { ok: false, runId, status: response.status, endpoint, error: message, entries: [] };
  }
  return {
    ok: true,
    runId,
    status: response.status,
    endpoint,
    entries: Array.isArray(json) ? (json as RpHistoryEntry[]) : [],
  };
}
