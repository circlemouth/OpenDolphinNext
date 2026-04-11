import { httpFetch } from '../../libs/http/httpClient';
import { ensureObservabilityMeta } from '../../libs/observability/observability';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';

export type OrcaMedicationGetSelection = {
  commentCode?: string;
  commentName?: string;
  category?: string;
  conditionCategory?: string;
  notUseComment?: string;
  processCategory?: string;
  selectionGrepName?: string;
  itemNumber?: string;
  itemNumberBranch?: string;
};

export type OrcaMedicationGetResult = {
  ok: boolean;
  apiOk?: boolean;
  status: number;
  apiResult?: string;
  apiResultMessage?: string;
  selections: OrcaMedicationGetSelection[];
  medication?: {
    medicationCode?: string;
    medicationName?: string;
    medicationNameKana?: string;
    unitCode?: string;
    unitName?: string;
    startDate?: string;
    endDate?: string;
    requestCode?: string;
  };
  informationDate?: string;
  informationTime?: string;
  reskey?: string;
  baseDate?: string;
  message?: string;
  runId?: string;
  traceId?: string;
};

const parseMedicationSelection = (selection: Record<string, unknown>): OrcaMedicationGetSelection => ({
  commentCode: typeof selection.commentCode === 'string' ? selection.commentCode : undefined,
  commentName: typeof selection.commentName === 'string' ? selection.commentName : undefined,
  category: typeof selection.category === 'string' ? selection.category : undefined,
  conditionCategory: typeof selection.conditionCategory === 'string' ? selection.conditionCategory : undefined,
  notUseComment: typeof selection.notUseComment === 'string' ? selection.notUseComment : undefined,
  processCategory: typeof selection.processCategory === 'string' ? selection.processCategory : undefined,
  selectionGrepName: typeof selection.selectionGrepName === 'string' ? selection.selectionGrepName : undefined,
  itemNumber: typeof selection.itemNumber === 'string' ? selection.itemNumber : undefined,
  itemNumberBranch: typeof selection.itemNumberBranch === 'string' ? selection.itemNumberBranch : undefined,
});

const parseMedicationInfo = (medicationSource: unknown) =>
  medicationSource && typeof medicationSource === 'object'
    ? {
        medicationCode:
          typeof (medicationSource as Record<string, unknown>).medicationCode === 'string'
            ? ((medicationSource as Record<string, unknown>).medicationCode as string)
            : undefined,
        medicationName:
          typeof (medicationSource as Record<string, unknown>).medicationName === 'string'
            ? ((medicationSource as Record<string, unknown>).medicationName as string)
            : undefined,
        medicationNameKana:
          typeof (medicationSource as Record<string, unknown>).medicationNameKana === 'string'
            ? ((medicationSource as Record<string, unknown>).medicationNameKana as string)
            : undefined,
        unitCode:
          typeof (medicationSource as Record<string, unknown>).unitCode === 'string'
            ? ((medicationSource as Record<string, unknown>).unitCode as string)
            : undefined,
        unitName:
          typeof (medicationSource as Record<string, unknown>).unitName === 'string'
            ? ((medicationSource as Record<string, unknown>).unitName as string)
            : undefined,
        startDate:
          typeof (medicationSource as Record<string, unknown>).startDate === 'string'
            ? ((medicationSource as Record<string, unknown>).startDate as string)
            : undefined,
        endDate:
          typeof (medicationSource as Record<string, unknown>).endDate === 'string'
            ? ((medicationSource as Record<string, unknown>).endDate as string)
            : undefined,
        requestCode:
          typeof (medicationSource as Record<string, unknown>).requestCode === 'string'
            ? ((medicationSource as Record<string, unknown>).requestCode as string)
            : undefined,
      }
    : undefined;

const normalizeBaseDate = (value?: string) => {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, '');
  return digits.length === 8 ? digits : null;
};

const normalizeRequestCode = (value: string) => value.trim();

const isValidRequestCode = (requestNumber: '01' | '02', requestCode: string) =>
  requestNumber === '01' ? /^[A-Za-z0-9]+$/.test(requestCode) : /^\d{9}$/.test(requestCode);

export async function fetchOrcaMedicationGet(params: {
  requestCode: string;
  baseDate?: string;
  requestNumber?: '01' | '02';
}): Promise<OrcaMedicationGetResult> {
  const requestNumber = params.requestNumber ?? '02';
  const requestCode = normalizeRequestCode(params.requestCode);
  const meta = ensureObservabilityMeta();
  if (!isValidRequestCode(requestNumber, requestCode)) {
    return {
      ok: false,
      status: 0,
      selections: [],
      message:
        requestNumber === '01'
          ? 'Request_Number=01 の requestCode は英数字で指定してください。'
          : '診療行為コードは9桁数字で指定してください。',
      runId: meta.runId,
      traceId: meta.traceId,
    };
  }
  const baseDate = normalizeBaseDate(params.baseDate);
  if (!baseDate) {
    return {
      ok: false,
      status: 0,
      selections: [],
      message: 'baseDate は YYYY-MM-DD の診療開始日で指定してください。',
      runId: meta.runId,
      traceId: meta.traceId,
    };
  }
  const response = await httpFetch('/api/orca/official/chart-support/medication-get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    notifySessionExpired: false,
    body: JSON.stringify({
      requestNumber,
      requestCode,
      baseDate,
    }),
  });
  const parsed = await parseOrcaApiResponse(response, { fallbackMessage: '選択式コメント候補の取得に失敗しました。' });
  const json = (parsed.json ?? {}) as Record<string, unknown>;
  const traceId =
    (typeof json.traceId === 'string' ? json.traceId : undefined) ??
    response.headers.get('x-trace-id') ??
    undefined;
  const selections = Array.isArray(json.selections)
    ? (json.selections as Array<Record<string, unknown>>).map(parseMedicationSelection)
    : [];
  const medication = parseMedicationInfo(json.medication);
  return {
    ok: parsed.ok,
    apiOk: typeof json.apiOk === 'boolean' ? (json.apiOk as boolean) : undefined,
    status: parsed.status,
    apiResult: typeof json.apiResult === 'string' ? (json.apiResult as string) : undefined,
    apiResultMessage: typeof json.apiResultMessage === 'string' ? (json.apiResultMessage as string) : undefined,
    selections,
    medication,
    informationDate: typeof json.informationDate === 'string' ? (json.informationDate as string) : undefined,
    informationTime: typeof json.informationTime === 'string' ? (json.informationTime as string) : undefined,
    reskey: typeof json.reskey === 'string' ? (json.reskey as string) : undefined,
    baseDate: typeof json.baseDate === 'string' ? (json.baseDate as string) : undefined,
    message: parsed.message,
    runId: parsed.runId ?? meta.runId,
    traceId,
  };
}
