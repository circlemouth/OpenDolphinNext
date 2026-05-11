import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';

export type OrcaMedicalCandidateIssue = {
  code?: string;
  message?: string;
  rpSequence?: number;
  itemSequence?: number;
};

export type OrcaMedicalCandidateMedication = {
  itemSequence?: number;
  code?: string;
  name?: string;
  number?: string;
  genericFlg?: string;
};

export type OrcaMedicalCandidateMedicalInformation = {
  entity?: string;
  medicalClass?: string;
  medicalClassName?: string;
  medicalClassNumber?: string;
  rpSequence?: number;
  usageCode?: string;
  usageName?: string;
  medications?: OrcaMedicalCandidateMedication[];
};

export type OrcaMedicalCandidatePrescriptionHistoryEvent = {
  prescriptionEventId?: number;
  prescriptionRevisionId?: number;
  revisionNumber?: number;
  revisionStatus?: string;
  eventType?: string;
  reasonCode?: string;
  reasonText?: string;
  actorUserId?: string;
  occurredAt?: string;
  contentHash?: string;
  eventHash?: string;
  previousEventHash?: string;
};

export type OrcaMedicalCandidateResponse = {
  ok: boolean;
  status?: number;
  runId?: string;
  message?: string;
  candidateId?: number;
  candidateStatus?: string;
  sendable: boolean;
  nonAuthoritative: boolean;
  patientId?: string;
  encounterId?: string;
  chartRevisionId?: string;
  prescriptionId?: number;
  prescriptionRevisionId?: number;
  prescriptionContentHash?: string;
  prescriptionHistory: OrcaMedicalCandidatePrescriptionHistoryEvent[];
  medicalInformation: OrcaMedicalCandidateMedicalInformation[];
  issues: OrcaMedicalCandidateIssue[];
};

const asNumber = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const asString = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined);

const parseIssue = (value: unknown): OrcaMedicalCandidateIssue | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return {
    code: asString(raw.code),
    message: asString(raw.message),
    rpSequence: asNumber(raw.rpSequence),
    itemSequence: asNumber(raw.itemSequence),
  };
};

const parseMedication = (value: unknown): OrcaMedicalCandidateMedication | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return {
    itemSequence: asNumber(raw.itemSequence),
    code: asString(raw.code),
    name: asString(raw.name),
    number: asString(raw.number),
    genericFlg: asString(raw.genericFlg),
  };
};

const parseMedicalInformation = (value: unknown): OrcaMedicalCandidateMedicalInformation | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return {
    entity: asString(raw.entity),
    medicalClass: asString(raw.medicalClass),
    medicalClassName: asString(raw.medicalClassName),
    medicalClassNumber: asString(raw.medicalClassNumber),
    rpSequence: asNumber(raw.rpSequence),
    usageCode: asString(raw.usageCode),
    usageName: asString(raw.usageName),
    medications: Array.isArray(raw.medications) ? raw.medications.map(parseMedication).filter((item): item is OrcaMedicalCandidateMedication => Boolean(item)) : [],
  };
};

const parsePrescriptionHistoryEvent = (value: unknown): OrcaMedicalCandidatePrescriptionHistoryEvent | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return {
    prescriptionEventId: asNumber(raw.prescriptionEventId),
    prescriptionRevisionId: asNumber(raw.prescriptionRevisionId),
    revisionNumber: asNumber(raw.revisionNumber),
    revisionStatus: asString(raw.revisionStatus),
    eventType: asString(raw.eventType),
    reasonCode: asString(raw.reasonCode),
    reasonText: asString(raw.reasonText),
    actorUserId: asString(raw.actorUserId),
    occurredAt: asString(raw.occurredAt),
    contentHash: asString(raw.contentHash),
    eventHash: asString(raw.eventHash),
    previousEventHash: asString(raw.previousEventHash),
  };
};

const emptyFailure = (params: {
  runId: string;
  status?: number;
  message?: string;
  errorCode?: string;
}): OrcaMedicalCandidateResponse => ({
  ok: false,
  status: params.status,
  runId: params.runId,
  message: params.message,
  sendable: false,
  nonAuthoritative: true,
  prescriptionHistory: [],
  medicalInformation: [],
  issues: params.errorCode ? [{ code: params.errorCode, message: params.message }] : [],
});

const parseCandidateJson = (
  json: Record<string, unknown>,
  parsed: { status?: number; runId?: string; message?: string },
  fallbackRunId: string,
): OrcaMedicalCandidateResponse => ({
  ok: true,
  status: parsed.status,
  runId: asString(json.runId) ?? parsed.runId ?? fallbackRunId,
  message: parsed.message,
  candidateId: asNumber(json.candidateId),
  candidateStatus: asString(json.candidateStatus),
  sendable: json.sendable === true,
  nonAuthoritative: json.nonAuthoritative !== false,
  patientId: asString(json.patientId),
  encounterId: asString(json.encounterId),
  chartRevisionId: asString(json.chartRevisionId),
  prescriptionId: asNumber(json.prescriptionId),
  prescriptionRevisionId: asNumber(json.prescriptionRevisionId),
  prescriptionContentHash: asString(json.prescriptionContentHash),
  prescriptionHistory: Array.isArray(json.prescriptionHistory)
    ? json.prescriptionHistory.map(parsePrescriptionHistoryEvent).filter((item): item is OrcaMedicalCandidatePrescriptionHistoryEvent => Boolean(item))
    : [],
  medicalInformation: Array.isArray(json.medicalInformation)
    ? json.medicalInformation.map(parseMedicalInformation).filter((item): item is OrcaMedicalCandidateMedicalInformation => Boolean(item))
    : [],
  issues: Array.isArray(json.issues) ? json.issues.map(parseIssue).filter((item): item is OrcaMedicalCandidateIssue => Boolean(item)) : [],
});

export async function prepareOrcaMedicalCandidateFromChart(params: {
  chartRevisionId: string;
  signal?: AbortSignal;
}): Promise<OrcaMedicalCandidateResponse> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const chartRevisionId = params.chartRevisionId.trim();
  if (!chartRevisionId) {
    return {
      ok: false,
      runId,
      message: '診療録リビジョンが未確定のため候補を作成できません。',
      sendable: false,
      nonAuthoritative: true,
      prescriptionHistory: [],
      medicalInformation: [],
      issues: [{ code: 'chart_revision_missing', message: 'chartRevisionId is required' }],
    };
  }
  const response = await httpFetch(`/api/local/orca/medical-candidates/from-chart/${encodeURIComponent(chartRevisionId)}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    signal: params.signal,
  });
  const parsed = await parseOrcaApiResponse(response, {
    fallbackMessage: '診療行為送信候補の作成に失敗しました。',
  });
  if (!parsed.ok || !parsed.json) {
    return emptyFailure({
      status: parsed.status,
      runId: parsed.runId ?? runId,
      message: parsed.message,
      errorCode: parsed.errorCode,
    });
  }
  return parseCandidateJson(parsed.json, parsed, runId);
}

export async function getLatestOrcaMedicalCandidateFromChart(params: {
  chartRevisionId: string;
  signal?: AbortSignal;
}): Promise<OrcaMedicalCandidateResponse> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const chartRevisionId = params.chartRevisionId.trim();
  if (!chartRevisionId) {
    return {
      ok: false,
      runId,
      message: '診療録リビジョンが未確定のため候補を確認できません。',
      sendable: false,
      nonAuthoritative: true,
      prescriptionHistory: [],
      medicalInformation: [],
      issues: [{ code: 'chart_revision_missing', message: 'chartRevisionId is required' }],
    };
  }
  const response = await httpFetch(`/api/local/orca/medical-candidates/from-chart/${encodeURIComponent(chartRevisionId)}/latest`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: params.signal,
  });
  const parsed = await parseOrcaApiResponse(response, {
    fallbackMessage: '診療行為送信候補の取得に失敗しました。',
  });
  if (!parsed.ok || !parsed.json) {
    return emptyFailure({
      status: parsed.status,
      runId: parsed.runId ?? runId,
      message: parsed.message,
      errorCode: parsed.errorCode,
    });
  }
  return parseCandidateJson(parsed.json, parsed, runId);
}
