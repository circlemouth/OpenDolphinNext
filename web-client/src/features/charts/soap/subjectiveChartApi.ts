import { httpFetch } from '../../../libs/http/httpClient';
import { getObservabilityMeta } from '../../../libs/observability/observability';

export type ChartSubjectiveEntryRequest = {
  patientId: string;
  performDate?: string;
  soapCategory: 'S' | 'O' | 'A' | 'P';
  displaySection?: 'free' | 'subjective' | 'objective' | 'assessment' | 'plan';
  physicianCode?: string;
  body: string;
};

export type ChartSubjectiveEntryReadback = {
  documentId?: number;
  patientId?: string;
  performDate?: string;
  soapCategory?: 'S' | 'O' | 'A' | 'P';
  displaySection?: 'free' | 'subjective' | 'objective' | 'assessment' | 'plan';
  body?: string;
  recordedAt?: string;
  authorUserId?: string;
  authorName?: string;
};

export type ChartSubjectiveEntryResponse = {
  ok: boolean;
  status: number;
  apiResult?: string;
  apiResultMessage?: string;
  runId?: string;
  recordedAt?: string;
  messageDetail?: string;
  reasonCode?: string;
  error?: string;
  entry?: ChartSubjectiveEntryReadback;
};

const isSoapCategory = (value: unknown): value is ChartSubjectiveEntryReadback['soapCategory'] =>
  value === 'S' || value === 'O' || value === 'A' || value === 'P';

const isDisplaySection = (value: unknown): value is ChartSubjectiveEntryReadback['displaySection'] =>
  value === 'free' || value === 'subjective' || value === 'objective' || value === 'assessment' || value === 'plan';

const parseReadbackEntry = (value: unknown): ChartSubjectiveEntryReadback | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  return {
    documentId: typeof raw.documentId === 'number' ? raw.documentId : undefined,
    patientId: typeof raw.patientId === 'string' ? raw.patientId : undefined,
    performDate: typeof raw.performDate === 'string' ? raw.performDate : undefined,
    soapCategory: isSoapCategory(raw.soapCategory) ? raw.soapCategory : undefined,
    displaySection: isDisplaySection(raw.displaySection) ? raw.displaySection : undefined,
    body: typeof raw.body === 'string' ? raw.body : undefined,
    recordedAt: typeof raw.recordedAt === 'string' ? raw.recordedAt : undefined,
    authorUserId: typeof raw.authorUserId === 'string' ? raw.authorUserId : undefined,
    authorName: typeof raw.authorName === 'string' ? raw.authorName : undefined,
  };
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
    reasonCode: typeof json.reasonCode === 'string' ? json.reasonCode : undefined,
    entry: parseReadbackEntry(json.entry),
  };
}
