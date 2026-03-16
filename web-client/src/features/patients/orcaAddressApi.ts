import { httpFetch } from '../../libs/http/httpClient';
import { ensureObservabilityMeta } from '../../libs/observability/observability';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';

export type OrcaAddressResult = {
  ok: boolean;
  status: number;
  item?: {
    zip?: string;
    prefCode?: string;
    cityCode?: string;
    city?: string;
    town?: string;
    kana?: string;
    roman?: string;
    fullAddress?: string;
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

const normalizeZip = (value: string) => value.replace(/[^0-9]/g, '');

export async function fetchOrcaAddress(params: { zip: string; effective?: string }): Promise<OrcaAddressResult> {
  const zip = normalizeZip(params.zip);
  if (zip.length !== 7) {
    return {
      ok: false,
      status: 0,
      notFound: false,
      message: '郵便番号は7桁で指定してください。',
    };
  }
  const meta = ensureObservabilityMeta();
  const effective = normalizeYmd(params.effective);
  const response = await httpFetch(`/api/orca/master/address?zip=${encodeURIComponent(zip)}&effective=${encodeURIComponent(effective)}`, {
    notifySessionExpired: false,
  });
  const parsed = await parseOrcaApiResponse(response, { fallbackMessage: '住所補完に失敗しました。' });
  const json = parsed.json ?? {};
  const traceId =
    (typeof json.traceId === 'string' ? json.traceId : undefined) ??
    response.headers.get('x-trace-id') ??
    undefined;
  if (response.status === 404) {
    return {
      ok: false,
      status: response.status,
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
      zip: typeof source.zip === 'string' ? source.zip : typeof source.zipCode === 'string' ? source.zipCode : zip,
      prefCode:
        typeof source.prefCode === 'string'
          ? source.prefCode
          : typeof source.prefectureCode === 'string'
            ? source.prefectureCode
            : undefined,
      cityCode: typeof source.cityCode === 'string' ? source.cityCode : undefined,
      city: typeof source.city === 'string' ? source.city : undefined,
      town: typeof source.town === 'string' ? source.town : undefined,
      kana: typeof source.kana === 'string' ? source.kana : undefined,
      roman: typeof source.roman === 'string' ? source.roman : undefined,
      fullAddress: typeof source.fullAddress === 'string' ? source.fullAddress : undefined,
    },
    runId: parsed.runId ?? meta.runId,
    traceId,
  };
}
