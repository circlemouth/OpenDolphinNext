import { httpFetch } from '../../libs/http/httpClient';
import { ensureObservabilityMeta } from '../../libs/observability/observability';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';

export type OrcaGenericPriceResult = {
  ok: boolean;
  status: number;
  item?: {
    code?: string;
    name?: string;
    minPrice?: number;
    unit?: string;
    validFrom?: string;
    validTo?: string;
  };
  notFound?: boolean;
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

export async function fetchOrcaGenericPrice(params: { srycd: string; effective?: string }): Promise<OrcaGenericPriceResult> {
  const srycd = params.srycd.trim();
  if (!/^\d{9}$/.test(srycd)) {
    return {
      ok: false,
      status: 0,
      message: '薬剤コードは9桁数字で指定してください。',
    };
  }
  const meta = ensureObservabilityMeta();
  const response = await httpFetch(
    `/api/orca/master/generic-price?srycd=${encodeURIComponent(srycd)}&effective=${encodeURIComponent(normalizeYmd(params.effective))}`,
    { notifySessionExpired: false },
  );
  const parsed = await parseOrcaApiResponse(response, { fallbackMessage: '最低薬価の取得に失敗しました。' });
  const json = parsed.json ?? {};
  const traceId =
    (typeof json.traceId === 'string' ? json.traceId : undefined) ??
    response.headers.get('x-trace-id') ??
    undefined;
  if (response.status === 404) {
    return {
      ok: false,
      status: parsed.status,
      notFound: true,
      message: parsed.message,
      runId: parsed.runId ?? meta.runId,
      traceId,
    };
  }
  if (!parsed.ok) {
    return {
      ok: false,
      status: parsed.status,
      message: parsed.message,
      runId: parsed.runId ?? meta.runId,
      traceId,
    };
  }
  const source = Array.isArray((json as { items?: unknown[] }).items)
    ? ((json as { items?: Array<Record<string, unknown>> }).items?.[0] ?? {})
    : json;
  return {
    ok: true,
    status: parsed.status,
    item: {
      code: typeof source.code === 'string' ? source.code : typeof source.srycd === 'string' ? source.srycd : srycd,
      name: typeof source.name === 'string' ? source.name : typeof source.drugName === 'string' ? source.drugName : undefined,
      minPrice:
        typeof source.minPrice === 'number' ? source.minPrice : typeof source.price === 'number' ? source.price : undefined,
      unit: typeof source.unit === 'string' ? source.unit : undefined,
      validFrom:
        typeof source.validFrom === 'string'
          ? source.validFrom
          : typeof source.startDate === 'string'
            ? source.startDate
            : undefined,
      validTo:
        typeof source.validTo === 'string'
          ? source.validTo
          : typeof source.endDate === 'string'
            ? source.endDate
            : undefined,
    },
    runId: parsed.runId ?? meta.runId,
    traceId,
  };
}
