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
    return {
      ok: false,
      status: parsed.status,
      runId: parsed.runId ?? runId,
      message: parsed.message,
      sendable: false,
      nonAuthoritative: true,
      medicalInformation: [],
      issues: parsed.errorCode ? [{ code: parsed.errorCode, message: parsed.message }] : [],
    };
  }
  const json = parsed.json;
  return {
    ok: true,
    status: parsed.status,
    runId: asString(json.runId) ?? parsed.runId ?? runId,
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
    medicalInformation: Array.isArray(json.medicalInformation)
      ? json.medicalInformation.map(parseMedicalInformation).filter((item): item is OrcaMedicalCandidateMedicalInformation => Boolean(item))
      : [],
    issues: Array.isArray(json.issues) ? json.issues.map(parseIssue).filter((item): item is OrcaMedicalCandidateIssue => Boolean(item)) : [],
  };
}
