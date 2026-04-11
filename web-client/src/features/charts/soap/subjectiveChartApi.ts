import { httpFetch } from '../../../libs/http/httpClient';
import { getObservabilityMeta } from '../../../libs/observability/observability';

export type ChartSubjectiveEntryRequest = {
  patientId: string;
  performDate?: string;
  soapCategory: 'S' | 'O' | 'A' | 'P';
  physicianCode?: string;
  body: string;
};

export type ChartSubjectiveEntryResponse = {
  ok: boolean;
  status: number;
  apiResult?: string;
  apiResultMessage?: string;
  runId?: string;
  recordedAt?: string;
  messageDetail?: string;
  error?: string;
};

export async function postChartSubjectiveEntry(
  payload: ChartSubjectiveEntryRequest,
): Promise<ChartSubjectiveEntryResponse> {
  const runId = getObservabilityMeta().runId;
  const response = await httpFetch('/api/local/charts/subjectives', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    ok: response.ok,
    status: response.status,
    apiResult: typeof json.apiResult === 'string' ? json.apiResult : undefined,
    apiResultMessage: typeof json.apiResultMessage === 'string' ? json.apiResultMessage : undefined,
    runId: typeof json.runId === 'string' ? json.runId : runId,
    recordedAt: typeof json.recordedAt === 'string' ? json.recordedAt : undefined,
    messageDetail: typeof json.messageDetail === 'string' ? json.messageDetail : undefined,
  };
}
