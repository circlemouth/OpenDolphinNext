import { httpFetch } from '../../libs/http/httpClient';
import { ensureObservabilityMeta } from '../../libs/observability/observability';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';

export type EncounterTransitionSuccess = {
  encounterKey: string;
  scheduleKey?: string;
  facilityId?: string;
  patientId: string;
  karteId: number;
  fromState?: string;
  businessState: string;
  requestId: string;
  traceId?: string;
  idempotencyKey: string;
  transitionedAt?: string;
};

export type EncounterTransitionFailureCode =
  | 'missing_encounter_key'
  | 'missing_patient_id'
  | 'missing_karte_id'
  | 'invalid_response'
  | 'http_error';

export class EncounterTransitionError extends Error {
  code: EncounterTransitionFailureCode;
  apiDetails?: Record<string, unknown>;

  constructor(message: string, code: EncounterTransitionFailureCode, apiDetails?: Record<string, unknown>) {
    super(message);
    this.name = 'EncounterTransitionError';
    this.code = code;
    this.apiDetails = apiDetails;
  }
}

const generateStableId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}`;
};

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const requireString = (value: string | undefined, code: EncounterTransitionFailureCode, message: string): string => {
  if (!value) throw new EncounterTransitionError(message, code);
  return value;
};

const requireNumber = (value: number | undefined, code: EncounterTransitionFailureCode, message: string): number => {
  if (!value || value <= 0) throw new EncounterTransitionError(message, code);
  return value;
};

export async function openChartEncounter(params: {
  encounterKey?: string;
  patientId?: string;
  karteId?: number | null;
}): Promise<EncounterTransitionSuccess> {
  const encounterKey = requireString(normalizeString(params.encounterKey), 'missing_encounter_key', 'encounterKey がないため診察開始を実行できません。受付から開き直してください。');
  const patientId = requireString(normalizeString(params.patientId), 'missing_patient_id', 'patientId がないため診察開始を実行できません。患者選択を確認してください。');
  const karteId = requireNumber(normalizeNumber(params.karteId), 'missing_karte_id', 'karteId がないため診察開始を実行できません。患者情報を再取得してください。');

  const meta = ensureObservabilityMeta();
  const requestId = generateStableId('encounter-start');
  const idempotencyKey = generateStableId('encounter-start-idem');
  const traceId = meta.traceId;

  const response = await httpFetch(`/api/encounters/${encodeURIComponent(encounterKey)}/transitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    notifySessionExpired: false,
    body: JSON.stringify({
      operation: 'chart_open',
      patientId,
      karteId,
      requestId,
      traceId,
      idempotencyKey,
    }),
  });

  const parsed = await parseOrcaApiResponse(response, { fallbackMessage: '診察開始の状態更新に失敗しました。' });
  const json = parsed.json ?? {};
  const responseTraceId = normalizeString(json.traceId) ?? response.headers.get('x-trace-id') ?? traceId;
  const responseRequestId = normalizeString(json.requestId) ?? requestId;
  const responseIdempotencyKey = normalizeString(json.idempotencyKey) ?? idempotencyKey;
  const apiDetails = {
    endpoint: `/api/encounters/${encounterKey}/transitions`,
    httpStatus: parsed.status,
    requestId: responseRequestId,
    traceId: responseTraceId,
    idempotencyKey: responseIdempotencyKey,
    encounterKey,
    patientId,
    karteId,
    apiResult: parsed.errorCode,
    apiResultMessage: parsed.message,
    outcome: parsed.ok ? 'success' : 'error',
  } satisfies Record<string, unknown>;

  if (!parsed.ok) {
    throw new EncounterTransitionError(parsed.message ?? '診察開始の状態更新に失敗しました。', 'http_error', apiDetails);
  }

  const businessState = normalizeString(json.businessState);
  if (businessState !== 'chart_opened') {
    throw new EncounterTransitionError('診察開始の応答が不正です。chart_opened を確認できませんでした。', 'invalid_response', {
      ...apiDetails,
      businessState,
      outcome: 'invalid_response',
    });
  }

  return {
    encounterKey,
    scheduleKey: normalizeString(json.scheduleKey),
    facilityId: normalizeString(json.facilityId),
    patientId: normalizeString(json.patientId) ?? patientId,
    karteId: normalizeNumber(json.karteId) ?? karteId,
    fromState: normalizeString(json.fromState),
    businessState,
    requestId: responseRequestId,
    traceId: responseTraceId,
    idempotencyKey: responseIdempotencyKey,
    transitionedAt: normalizeString(json.transitionedAt),
  };
}
