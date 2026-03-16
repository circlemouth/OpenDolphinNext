import { httpFetch } from '../../libs/http/httpClient';
import { getObservabilityMeta } from '../../libs/observability/observability';

export type OrcaXmlResponse = {
  ok: boolean;
  apiOk?: boolean;
  status: number;
  rawXml?: string;
  apiResult?: string;
  apiResultMessage?: string;
  informationDate?: string;
  informationTime?: string;
  missingTags?: string[];
  runId?: string;
  traceId?: string;
  error?: string;
};

export const ORCA_MEDICALMODV23_PATH = '/api/orca/chart-support/medical-mod-v23';

export type MedicalModV23RequestPayload = {
  patientId: string;
  requestNumber?: string;
  firstCalculationDate?: string;
  lastVisitDate?: string;
  departmentCode?: string;
};

export const buildMedicalModV23RequestXml = (
  params: MedicalModV23RequestPayload,
): MedicalModV23RequestPayload => params;

export async function postOrcaMedicalModXml(
  payload: MedicalModV23RequestPayload,
  options: { signal?: AbortSignal } = {},
): Promise<OrcaXmlResponse> {
  return postOrcaMedicalModV23Xml(payload, options);
}

export async function postOrcaMedicalModV23Xml(
  payload: MedicalModV23RequestPayload,
  options: { signal?: AbortSignal } = {},
): Promise<OrcaXmlResponse> {
  const runId = getObservabilityMeta().runId;
  const response = await httpFetch(ORCA_MEDICALMODV23_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    ok: response.ok && !(typeof json.error === 'string' && json.error.trim()),
    apiOk: typeof json.apiOk === 'boolean' ? json.apiOk : undefined,
    status: response.status,
    rawXml: undefined,
    apiResult: typeof json.apiResult === 'string' ? json.apiResult : undefined,
    apiResultMessage: typeof json.apiResultMessage === 'string' ? json.apiResultMessage : undefined,
    informationDate: typeof json.informationDate === 'string' ? json.informationDate : undefined,
    informationTime: typeof json.informationTime === 'string' ? json.informationTime : undefined,
    missingTags: undefined,
    runId: typeof json.runId === 'string' ? json.runId : getObservabilityMeta().runId ?? runId,
    traceId: typeof json.traceId === 'string' ? json.traceId : getObservabilityMeta().traceId,
    error: typeof json.error === 'string' ? json.error : undefined,
  };
}
