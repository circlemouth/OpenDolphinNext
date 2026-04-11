import { httpFetch } from '../../libs/http/httpClient';
import { getObservabilityMeta } from '../../libs/observability/observability';

export type IncomeInfoEntry = {
  performDate?: string;
  performEndDate?: string;
  issuedDate?: string;
  inOut?: string;
  invoiceNumber?: string;
  groupInvoiceNumber?: string;
  departmentCode?: string;
  departmentName?: string;
  insuranceCombinationNumber?: string;
  claimAmount?: number;
  paymentAmount?: number;
  insuranceAppliedAmount?: number;
  selfPayAmount?: number;
  mealLivingCopayAmount?: number;
};

export type UnpaidMoneyEntry = {
  performDate?: string;
  inOut?: string;
  invoiceNumber?: string;
  unpaidMoney?: number;
};

export type IncomeInfoRequest = {
  patientId: string;
  performDate?: string;
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
  unpaidMoneyTotal?: number;
  unpaidMoneyInformationOverflow?: boolean;
  unpaidMoneyInformation: UnpaidMoneyEntry[];
  runId?: string;
  traceId?: string;
  error?: string;
};

const ORCA_INCOME_INFO_PATH = '/api/orca/official/chart-support/income-info';

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
    issuedDate: asString(record.issuedDate),
    inOut: asString(record.inOut),
    invoiceNumber: asString(record.invoiceNumber),
    groupInvoiceNumber: asString(record.groupInvoiceNumber),
    departmentCode: asString(record.departmentCode),
    departmentName: asString(record.departmentName),
    insuranceCombinationNumber: asString(record.insuranceCombinationNumber),
    claimAmount: asNumber(record.claimAmount ?? record.acMoney),
    paymentAmount: asNumber(record.paymentAmount ?? record.icMoney),
    insuranceAppliedAmount: asNumber(record.insuranceAppliedAmount ?? record.aiMoney),
    selfPayAmount: asNumber(record.selfPayAmount ?? record.oeMoney),
    mealLivingCopayAmount: asNumber(record.mealLivingCopayAmount ?? record.mlSmoney),
  };
};

const normalizeUnpaidMoneyEntry = (value: unknown): UnpaidMoneyEntry | null => {
  const record = asRecord(value);
  if (!record) return null;
  return {
    performDate: asString(record.performDate),
    inOut: asString(record.inOut),
    invoiceNumber: asString(record.invoiceNumber),
    unpaidMoney: asNumber(record.unpaidMoney),
  };
};

export const buildIncomeInfoRequest = (params: IncomeInfoRequest): IncomeInfoRequest => {
  const request: IncomeInfoRequest = {
    patientId: params.patientId,
  };
  if (params.performDate) {
    request.performDate = params.performDate;
    return request;
  }
  if (params.performMonth) {
    request.performMonth = params.performMonth;
    return request;
  }
  if (params.performYear) {
    request.performYear = params.performYear;
  }
  return request;
};

export async function fetchOrcaIncomeInfo(request: IncomeInfoRequest): Promise<IncomeInfoResponse> {
  const runId = getObservabilityMeta().runId;
  const payload = buildIncomeInfoRequest(request);
  const response = await httpFetch(ORCA_INCOME_INFO_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const entries = Array.isArray(json.entries)
    ? json.entries.map(normalizeEntry).filter((entry): entry is IncomeInfoEntry => entry !== null)
    : [];
  const unpaidMoneyInformation = Array.isArray(json.unpaidMoneyInformation)
    ? json.unpaidMoneyInformation
        .map(normalizeUnpaidMoneyEntry)
        .filter((entry): entry is UnpaidMoneyEntry => entry !== null)
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
    unpaidMoneyTotal: asNumber(json.unpaidMoneyTotal),
    unpaidMoneyInformationOverflow: typeof json.unpaidMoneyInformationOverflow === 'boolean' ? json.unpaidMoneyInformationOverflow : undefined,
    unpaidMoneyInformation,
    runId: asString(json.runId) ?? getObservabilityMeta().runId ?? runId,
    traceId: asString(json.traceId) ?? getObservabilityMeta().traceId,
    error: asString(json.error),
  };
}
