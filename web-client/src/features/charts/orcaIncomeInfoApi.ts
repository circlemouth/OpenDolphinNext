import { httpFetch } from '../../libs/http/httpClient';
import { getObservabilityMeta } from '../../libs/observability/observability';

export type IncomeInfoEntry = {
  performDate?: string;
  performEndDate?: string;
  inOut?: string;
  invoiceNumber?: string;
  departmentName?: string;
  insuranceCombinationNumber?: string;
  acMoney?: number;
  icMoney?: number;
  aiMoney?: number;
  oeMoney?: number;
  mlSmoney?: number;
};

export type IncomeInfoRequest = {
  patientId: string;
  performMonth?: string;
  performYear?: string;
};

export type IncomeInfoResponse = {
  ok: boolean;
  apiOk?: boolean;
  status: number;
  apiResult?: string;
  apiResultMessage?: string;
  informationDate?: string;
  informationTime?: string;
  entries: IncomeInfoEntry[];
  runId?: string;
  traceId?: string;
  error?: string;
};

const ORCA_INCOME_INFO_PATH = '/api/orca/chart-support/income-info';

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const asString = (value: unknown) => (typeof value === 'string' ? value : undefined);

const asNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
};

const normalizeEntry = (value: unknown): IncomeInfoEntry | null => {
  const record = asRecord(value);
  if (!record) return null;
  return {
    performDate: asString(record.performDate),
    performEndDate: asString(record.performEndDate),
    inOut: asString(record.inOut),
    invoiceNumber: asString(record.invoiceNumber),
    departmentName: asString(record.departmentName),
    insuranceCombinationNumber: asString(record.insuranceCombinationNumber),
    acMoney: asNumber(record.acMoney),
    icMoney: asNumber(record.icMoney),
    aiMoney: asNumber(record.aiMoney),
    oeMoney: asNumber(record.oeMoney),
    mlSmoney: asNumber(record.mlSmoney),
  };
};

export const buildIncomeInfoRequest = (params: IncomeInfoRequest): IncomeInfoRequest => ({
  patientId: params.patientId,
  performMonth: params.performMonth,
  performYear: params.performYear,
});

export async function fetchOrcaIncomeInfo(request: IncomeInfoRequest): Promise<IncomeInfoResponse> {
  const runId = getObservabilityMeta().runId;
  const response = await httpFetch(ORCA_INCOME_INFO_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const entries = Array.isArray(json.entries)
    ? json.entries.map(normalizeEntry).filter((entry): entry is IncomeInfoEntry => entry !== null)
    : [];

  return {
    ok: Boolean(json.ok ?? response.ok),
    apiOk: typeof json.apiOk === 'boolean' ? json.apiOk : undefined,
    status: response.status,
    apiResult: asString(json.apiResult),
    apiResultMessage: asString(json.apiResultMessage),
    informationDate: asString(json.informationDate),
    informationTime: asString(json.informationTime),
    entries,
    runId: asString(json.runId) ?? getObservabilityMeta().runId ?? runId,
    traceId: asString(json.traceId) ?? getObservabilityMeta().traceId,
    error: asString(json.error),
  };
}
