import { httpFetch } from '../../libs/http/httpClient';
import { ensureObservabilityMeta } from '../../libs/observability/observability';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';

export type OrcaHokenjaResult = {
  ok: boolean;
  status: number;
  items: Array<{
    payerCode?: string;
    payerName?: string;
    payerType?: string;
    payerRatio?: number;
    prefCode?: string;
    cityCode?: string;
    zip?: string;
    addressLine?: string;
    phone?: string;
    validFrom?: string;
    validTo?: string;
  }>;
  totalCount?: number;
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

const normalizePref = (value?: string) => {
  if (!value) return undefined;
  const digits = value.replace(/[^0-9]/g, '');
  return digits.length === 2 ? digits : undefined;
};

export async function fetchOrcaHokenja(params: {
  keyword: string;
  pref?: string;
  effective?: string;
  page?: number;
  size?: number;
}): Promise<OrcaHokenjaResult> {
  const keyword = params.keyword.trim();
  if (!keyword) {
    return { ok: false, status: 0, items: [], totalCount: 0, message: '検索キーワードが未指定です。' };
  }
  const meta = ensureObservabilityMeta();
  const query = new URLSearchParams();
  query.set('keyword', keyword);
  query.set('effective', normalizeYmd(params.effective));
  query.set('page', String(params.page && params.page > 0 ? params.page : 1));
  query.set('size', String(params.size && params.size > 0 ? params.size : 50));
  const pref = normalizePref(params.pref);
  if (pref) query.set('pref', pref);
  const response = await httpFetch(`/api/orca/master/hokenja?${query.toString()}`, { notifySessionExpired: false });
  const parsed = await parseOrcaApiResponse(response, { fallbackMessage: '保険者検索に失敗しました。' });
  const json = parsed.json ?? {};
  const traceId =
    (typeof json.traceId === 'string' ? json.traceId : undefined) ??
    response.headers.get('x-trace-id') ??
    undefined;
  if (!parsed.ok) {
    return {
      ok: false,
      status: parsed.status,
      items: [],
      totalCount: 0,
      message: parsed.message,
      runId: parsed.runId ?? meta.runId,
      traceId,
    };
  }
  const rawItems = Array.isArray((json as { items?: unknown[] }).items)
    ? ((json as { items?: Array<Record<string, unknown>> }).items ?? [])
    : Array.isArray((json as { list?: unknown[] }).list)
      ? ((json as { list?: Array<Record<string, unknown>> }).list ?? [])
      : [];
  return {
    ok: true,
    status: parsed.status,
    items: rawItems.map((item) => ({
      payerCode:
        typeof item.payerCode === 'string'
          ? item.payerCode
          : typeof item.insurerNumber === 'string'
            ? item.insurerNumber
            : undefined,
      payerName:
        typeof item.payerName === 'string'
          ? item.payerName
          : typeof item.insurerName === 'string'
            ? item.insurerName
            : undefined,
      payerType:
        typeof item.payerType === 'string'
          ? item.payerType
          : typeof item.insurerType === 'string'
            ? item.insurerType
            : undefined,
      payerRatio: typeof item.payerRatio === 'number' ? item.payerRatio : undefined,
      prefCode:
        typeof item.prefCode === 'string'
          ? item.prefCode
          : typeof item.prefectureCode === 'string'
            ? item.prefectureCode
            : undefined,
      cityCode: typeof item.cityCode === 'string' ? item.cityCode : undefined,
      zip: typeof item.zip === 'string' ? item.zip : undefined,
      addressLine:
        typeof item.addressLine === 'string'
          ? item.addressLine
          : typeof item.address === 'string'
            ? item.address
            : undefined,
      phone: typeof item.phone === 'string' ? item.phone : typeof item.tel === 'string' ? item.tel : undefined,
      validFrom: typeof item.validFrom === 'string' ? item.validFrom : undefined,
      validTo: typeof item.validTo === 'string' ? item.validTo : undefined,
    })),
    totalCount: typeof json.totalCount === 'number' ? json.totalCount : rawItems.length,
    runId: parsed.runId ?? meta.runId,
    traceId,
  };
}
