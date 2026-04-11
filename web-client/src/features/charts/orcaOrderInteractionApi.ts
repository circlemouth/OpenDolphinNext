import { httpFetch } from '../../libs/http/httpClient';
import { ensureObservabilityMeta } from '../../libs/observability/observability';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';

export type OrcaStaticOrderInteractionResult = {
  ok: boolean;
  status: number;
  totalCount: number;
  pairs: Array<{
    code1: string;
    code2: string;
    interactionCode?: string;
    interactionName?: string;
    message?: string;
  }>;
  message?: string;
  runId?: string;
  traceId?: string;
};

export type OrcaOrderInteractionResult = OrcaStaticOrderInteractionResult;

const sanitizeCodes = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export async function checkOrcaStaticOrderInteractions(params: {
  codes: string[];
  existingCodes?: string[];
}): Promise<OrcaStaticOrderInteractionResult> {
  const meta = ensureObservabilityMeta();
  const response = await httpFetch('/api/orca/order/interactions/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    notifySessionExpired: false,
    body: JSON.stringify({
      codes: sanitizeCodes(params.codes),
      existingCodes: sanitizeCodes(params.existingCodes ?? []),
    }),
  });
  const parsed = await parseOrcaApiResponse(response, { fallbackMessage: 'マスタ相互作用チェックに失敗しました。' });
  const json = parsed.json ?? {};
  const traceId =
    (typeof json.traceId === 'string' ? json.traceId : undefined) ??
    response.headers.get('x-trace-id') ??
    undefined;
  const rawPairs = Array.isArray((json as { pairs?: unknown[] }).pairs)
    ? ((json as { pairs?: Array<Record<string, unknown>> }).pairs ?? [])
    : [];
  if (!parsed.ok) {
    return {
      ok: false,
      status: parsed.status,
      totalCount: 0,
      pairs: [],
      message: parsed.message,
      runId: parsed.runId ?? meta.runId,
      traceId,
    };
  }
  return {
    ok: true,
    status: parsed.status,
    totalCount: typeof json.totalCount === 'number' ? json.totalCount : rawPairs.length,
    pairs: rawPairs
      .map((pair) => ({
        code1: typeof pair.code1 === 'string' ? pair.code1 : '',
        code2: typeof pair.code2 === 'string' ? pair.code2 : '',
        interactionCode: typeof pair.interactionCode === 'string' ? pair.interactionCode : undefined,
        interactionName: typeof pair.interactionName === 'string' ? pair.interactionName : undefined,
        message: typeof pair.message === 'string' ? pair.message : undefined,
      }))
      .filter((pair) => pair.code1 && pair.code2),
    runId: parsed.runId ?? meta.runId,
    traceId,
  };
}

export const checkOrcaOrderInteractions = checkOrcaStaticOrderInteractions;
