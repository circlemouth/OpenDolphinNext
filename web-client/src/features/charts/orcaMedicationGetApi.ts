import { httpFetch } from '../../libs/http/httpClient';
import { ensureObservabilityMeta } from '../../libs/observability/observability';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';

export type OrcaMedicationGetSelection = {
  commentCode?: string;
  commentName?: string;
  category?: string;
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
    startDate?: string;
    endDate?: string;
    requestCode?: string;
  };
  message?: string;
  runId?: string;
  traceId?: string;
};

const todayYmd = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

const normalizeYmd = (value?: string) => {
  if (!value) return todayYmd();
  const digits = value.replace(/[^0-9]/g, '');
  return digits.length === 8 ? digits : todayYmd();
};

export async function fetchOrcaMedicationGet(params: {
  requestCode: string;
  baseDate?: string;
  requestNumber?: '01' | '02';
}): Promise<OrcaMedicationGetResult> {
  const requestCode = params.requestCode.trim();
  if (!/^\d{9}$/.test(requestCode)) {
    return {
      ok: false,
      status: 0,
      selections: [],
      message: '診療行為コードは9桁数字で指定してください。',
    };
  }
  const meta = ensureObservabilityMeta();
  const response = await httpFetch('/api/orca/chart-support/medication-get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    notifySessionExpired: false,
    body: JSON.stringify({
      requestNumber: params.requestNumber ?? '02',
      requestCode,
      baseDate: normalizeYmd(params.baseDate),
    }),
  });
  const parsed = await parseOrcaApiResponse(response, { fallbackMessage: '選択式コメント候補の取得に失敗しました。' });
  const json = (parsed.json ?? {}) as Record<string, unknown>;
  const traceId =
    (typeof json.traceId === 'string' ? json.traceId : undefined) ??
    response.headers.get('x-trace-id') ??
    undefined;
  const selections = Array.isArray(json.selections)
    ? (json.selections as Array<Record<string, unknown>>).map((selection) => ({
        commentCode: typeof selection.commentCode === 'string' ? selection.commentCode : undefined,
        commentName: typeof selection.commentName === 'string' ? selection.commentName : undefined,
        category: typeof selection.category === 'string' ? selection.category : undefined,
        itemNumber: typeof selection.itemNumber === 'string' ? selection.itemNumber : undefined,
        itemNumberBranch: typeof selection.itemNumberBranch === 'string' ? selection.itemNumberBranch : undefined,
      }))
    : [];
  const medicationSource = json.medication;
  const medication =
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
  return {
    ok: parsed.ok,
    apiOk: typeof json.apiOk === 'boolean' ? (json.apiOk as boolean) : undefined,
    status: parsed.status,
    apiResult: typeof json.apiResult === 'string' ? (json.apiResult as string) : undefined,
    apiResultMessage: typeof json.apiResultMessage === 'string' ? (json.apiResultMessage as string) : undefined,
    selections,
    medication,
    message: parsed.message,
    runId: parsed.runId ?? meta.runId,
    traceId,
  };
}
