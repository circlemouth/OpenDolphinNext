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
  status: number;
  selections: OrcaMedicationGetSelection[];
  message?: string;
  runId?: string;
  traceId?: string;
};

const normalizeYmd = (value?: string) => {
  if (!value) return undefined;
  const digits = value.replace(/[^0-9]/g, '');
  return digits.length === 8 ? digits : undefined;
};

export async function fetchOrcaMedicationSelections(params: {
  requestCode: string;
  baseDate?: string;
  requestNumber?: '01' | '02';
}): Promise<OrcaMedicationGetResult> {
  const requestCode = params.requestCode.trim();
  if (!requestCode) {
    return {
      ok: false,
      status: 0,
      selections: [],
      message: 'requestCode が必要です。',
    };
  }
  const meta = ensureObservabilityMeta();
  const response = await httpFetch('/api/orca/chart-support/medication-get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestNumber: params.requestNumber ?? (requestCode.length === 9 ? '02' : '01'),
      requestCode,
      baseDate: normalizeYmd(params.baseDate),
    }),
    notifySessionExpired: false,
  });
  const parsed = await parseOrcaApiResponse(response, {
    fallbackMessage: 'ORCA medicationgetv2 の取得に失敗しました。',
  });
  const json = parsed.json ?? {};
  const selections = Array.isArray((json as { selections?: unknown[] }).selections)
    ? ((json as { selections?: Array<Record<string, unknown>> }).selections ?? []).map((selection) => ({
        commentCode: typeof selection.commentCode === 'string' ? selection.commentCode : undefined,
        commentName: typeof selection.commentName === 'string' ? selection.commentName : undefined,
        category: typeof selection.category === 'string' ? selection.category : undefined,
        itemNumber: typeof selection.itemNumber === 'string' ? selection.itemNumber : undefined,
        itemNumberBranch: typeof selection.itemNumberBranch === 'string' ? selection.itemNumberBranch : undefined,
      }))
    : [];
  return {
    ok: parsed.ok,
    status: parsed.status,
    selections,
    message: parsed.message,
    runId: parsed.runId ?? meta.runId,
    traceId: typeof (json as { traceId?: unknown }).traceId === 'string' ? ((json as { traceId?: string }).traceId ?? undefined) : undefined,
  };
}
