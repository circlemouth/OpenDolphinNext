import { httpFetch } from '../../libs/http/httpClient';
import { getObservabilityMeta } from '../../libs/observability/observability';
import type { OrcaEncounterContext } from './orcaEncounterContext';

export type OrcaClaimSendResult = {
  ok: boolean;
  apiOk?: boolean;
  status: number;
  rawXml?: string;
  apiResult?: string;
  apiResultMessage?: string;
  informationDate?: string;
  informationTime?: string;
  invoiceNumber?: string;
  dataId?: string;
  medicalWarnings?: Array<{
    medicalWarning?: string;
    medicalWarningMessage?: string;
    medicalWarningPosition?: number;
    medicalWarningItemPosition?: number;
    medicalWarningCode?: string;
  }>;
  missingTags?: string[];
  runId?: string;
  traceId?: string;
  error?: string;
  operationStatus?: string;
  needsUserReview?: boolean;
};

export const ORCA_OFFICIAL_MEDICAL_MOD_V2_PATH = '/api/orca/official/chart-support/medical-mod-v2';

export type MedicalModV2Medication = {
  code: string;
  name?: string;
  number?: string;
  genericFlg?: 'yes' | 'no';
  nameInputValue?: string;
  inputCode?: string;
};

export type MedicalModV2Information = {
  entity?: string;
  medicalClass: string;
  medicalClassName?: string;
  medicalClassNumber?: string;
  medications: MedicalModV2Medication[];
};

export type MedicalModV2RequestPayload = {
  encounterContext: OrcaEncounterContext;
  requestNumber?: string;
  medicalUid?: string;
  includeInitialConsultation?: boolean;
  medicalInformation?: MedicalModV2Information[];
};

export const buildMedicalModV2RequestXml = (params: MedicalModV2RequestPayload): MedicalModV2RequestPayload => ({
  encounterContext: params.encounterContext,
  requestNumber: params.requestNumber,
  medicalUid: params.medicalUid,
  includeInitialConsultation: params.includeInitialConsultation,
  medicalInformation: params.medicalInformation?.map((info) => ({
    entity: info.entity,
    medicalClass: info.medicalClass,
    medicalClassName: info.medicalClassName,
    medicalClassNumber: info.medicalClassNumber,
    medications: info.medications.map((medication) => ({
      code: medication.code,
      name: medication.name,
      number: medication.number,
      genericFlg: medication.genericFlg,
    })),
  })),
});

export async function postOrcaMedicalModV2Xml(
  payload: MedicalModV2RequestPayload,
  options: { classCode?: string; signal?: AbortSignal } = {},
): Promise<OrcaClaimSendResult> {
  const runId = getObservabilityMeta().runId;
  const requestPayload = buildMedicalModV2RequestXml(payload);
  const hasUnsupportedPhysiologyPayload = Boolean(
    requestPayload.medicalInformation?.some((info) => info.entity?.trim() === 'physiologyOrder'),
  );
  if (hasUnsupportedPhysiologyPayload) {
    const message = 'ORCA送信を停止: physiologyOrder は generic 600 送信に対応していません。';
    return {
      ok: false,
      apiOk: false,
      status: 400,
      apiResultMessage: message,
      runId: getObservabilityMeta().runId ?? runId,
      traceId: getObservabilityMeta().traceId,
      error: message,
    };
  }
  const response = await httpFetch(ORCA_OFFICIAL_MEDICAL_MOD_V2_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      ...requestPayload,
      classCode: options.classCode,
    }),
    signal: options.signal,
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const apiResult = typeof json.apiResult === 'string' ? json.apiResult : undefined;
  const apiResultMessage = typeof json.apiResultMessage === 'string' ? json.apiResultMessage : undefined;
  const responseError = typeof json.error === 'string' ? json.error : undefined;
  return {
    ok: response.ok && !responseError?.trim(),
    apiOk: typeof json.apiOk === 'boolean' ? json.apiOk : undefined,
    status: response.status,
    rawXml: undefined,
    apiResult,
    apiResultMessage,
    informationDate: typeof json.informationDate === 'string' ? json.informationDate : undefined,
    informationTime: typeof json.informationTime === 'string' ? json.informationTime : undefined,
    invoiceNumber: typeof json.invoiceNumber === 'string' ? json.invoiceNumber : undefined,
    dataId: typeof json.dataId === 'string' ? json.dataId : undefined,
    medicalWarnings: Array.isArray(json.medicalWarnings)
      ? (json.medicalWarnings as OrcaClaimSendResult['medicalWarnings'])
      : undefined,
    missingTags: undefined,
    runId: typeof json.runId === 'string' ? json.runId : getObservabilityMeta().runId ?? runId,
    traceId: typeof json.traceId === 'string' ? json.traceId : getObservabilityMeta().traceId,
    error: responseError,
    operationStatus: typeof json.operationStatus === 'string' ? json.operationStatus : undefined,
    needsUserReview: json.needsUserReview === true,
  };
}
