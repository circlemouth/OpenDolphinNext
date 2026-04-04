import { httpFetch } from '../../libs/http/httpClient';
import { ensureObservabilityMeta } from '../../libs/observability/observability';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';
import { normalizeOrderBundleRowRole, normalizeOrderBundleRowSubtype } from './orderBundleApi';

export type OrcaOrderInputSetSummary = {
  setCode?: string;
  name?: string;
  entity?: string | null;
  kind?: string;
  classCode?: string;
  classCodeSystem?: string;
  itemCount?: number;
  validFrom?: string;
  validTo?: string;
};

export type OrcaOrderInputSetListResult = {
  ok: boolean;
  status: number;
  items: OrcaOrderInputSetSummary[];
  totalCount?: number;
  message?: string;
  runId?: string;
  traceId?: string;
};

export type OrcaOrderInputSetDetailResult = {
  ok: boolean;
  status: number;
  setCode?: string;
  bundle?: {
    entity?: string | null;
    sourceSetCode?: string;
    bundleName?: string;
    bundleNumber?: string;
    subtype?: string;
    classCode?: string;
    classCodeSystem?: string;
    className?: string;
    admin?: string;
    adminCode?: string;
    adminCodeSystem?: string;
    adminMemo?: string;
    memo?: string;
    started?: string;
    bodyPart?: {
      code?: string;
      name?: string;
      quantity?: string;
      unit?: string;
      memo?: string;
      rowRole?: 'bodyPart';
    } | null;
    items: Array<{
      code?: string;
      name?: string;
      quantity?: string;
      unit?: string;
      memo?: string;
      genericFlg?: 'yes' | 'no';
      userComment?: string;
      rowRole?: 'main' | 'auxiliary' | 'comment';
      rowSubtype?: 'material' | 'contrastDrug';
    }>;
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

export async function fetchOrcaOrderInputSets(params: {
  keyword?: string;
  entity?: string;
  effective?: string;
  page?: number;
  size?: number;
}): Promise<OrcaOrderInputSetListResult> {
  const meta = ensureObservabilityMeta();
  const query = new URLSearchParams();
  if (params.keyword?.trim()) query.set('keyword', params.keyword.trim());
  if (params.entity?.trim()) query.set('entity', params.entity.trim());
  query.set('effective', normalizeYmd(params.effective));
  query.set('page', String(params.page && params.page > 0 ? params.page : 1));
  query.set('size', String(params.size && params.size > 0 ? params.size : 20));
  const response = await httpFetch(`/api/orca/order/inputsets?${query.toString()}`, { notifySessionExpired: false });
  const parsed = await parseOrcaApiResponse(response, { fallbackMessage: 'ORCA入力セット検索に失敗しました。' });
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
  const items = Array.isArray((json as { items?: unknown[] }).items)
    ? ((json as { items?: Array<Record<string, unknown>> }).items ?? []).map((item) => ({
        setCode: typeof item.setCode === 'string' ? item.setCode : undefined,
        name: typeof item.name === 'string' ? item.name : undefined,
        entity: typeof item.entity === 'string' ? item.entity : item.entity === null ? null : undefined,
        kind: typeof item.kind === 'string' ? item.kind : undefined,
        classCode: typeof item.classCode === 'string' ? item.classCode : undefined,
        classCodeSystem: typeof item.classCodeSystem === 'string' ? item.classCodeSystem : undefined,
        itemCount: typeof item.itemCount === 'number' ? item.itemCount : undefined,
        validFrom: typeof item.validFrom === 'string' ? item.validFrom : undefined,
        validTo: typeof item.validTo === 'string' ? item.validTo : undefined,
      }))
    : [];
  return {
    ok: true,
    status: parsed.status,
    items,
    totalCount: typeof json.totalCount === 'number' ? json.totalCount : items.length,
    runId: parsed.runId ?? meta.runId,
    traceId,
  };
}

export async function fetchOrcaOrderInputSetDetail(params: {
  setCode: string;
  effective?: string;
  entity?: string;
  name?: string;
}): Promise<OrcaOrderInputSetDetailResult> {
  const setCode = params.setCode.trim();
  if (!setCode) {
    return {
      ok: false,
      status: 0,
      bundle: { items: [] },
      message: 'setCode が未指定です。',
    };
  }
  const meta = ensureObservabilityMeta();
  const query = new URLSearchParams();
  query.set('effective', normalizeYmd(params.effective));
  if (params.entity?.trim()) query.set('entity', params.entity.trim());
  if (params.name?.trim()) query.set('name', params.name.trim());
  const response = await httpFetch(`/api/orca/order/inputsets/${encodeURIComponent(setCode)}?${query.toString()}`, {
    notifySessionExpired: false,
  });
  const parsed = await parseOrcaApiResponse(response, {
    fallbackMessage: 'ORCA入力セット詳細の取得に失敗しました。',
    notFoundCodes: new Set(['inputset_not_found']),
  });
  const json = parsed.json ?? {};
  const traceId =
    (typeof json.traceId === 'string' ? json.traceId : undefined) ??
    response.headers.get('x-trace-id') ??
    undefined;
  if (response.status === 404) {
    return {
      ok: false,
      status: parsed.status,
      setCode,
      bundle: { items: [] },
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
      setCode,
      bundle: { items: [] },
      message: parsed.message,
      runId: parsed.runId ?? meta.runId,
      traceId,
    };
  }
  const bundle = (json as { bundle?: Record<string, unknown> }).bundle ?? {};
  type DetailItem = NonNullable<OrcaOrderInputSetDetailResult['bundle']>['items'][number];
  const items: NonNullable<OrcaOrderInputSetDetailResult['bundle']>['items'] = Array.isArray((bundle as { items?: unknown[] }).items)
    ? ((bundle as { items?: Array<Record<string, unknown>> }).items ?? []).map((item): DetailItem => {
        const detailItem: DetailItem = {};
        if (typeof item.code === 'string') detailItem.code = item.code;
        if (typeof item.name === 'string') detailItem.name = item.name;
        if (typeof item.quantity === 'string') detailItem.quantity = item.quantity;
        if (typeof item.unit === 'string') detailItem.unit = item.unit;
        if (typeof item.memo === 'string') detailItem.memo = item.memo;
        if (item.genericFlg === 'yes' || item.genericFlg === 'no') detailItem.genericFlg = item.genericFlg;
        if (typeof item.userComment === 'string') detailItem.userComment = item.userComment;
        const rowRole = normalizeOrderBundleRowRole(typeof item.rowRole === 'string' ? item.rowRole : undefined);
        if (rowRole && rowRole !== 'bodyPart') {
          detailItem.rowRole = rowRole;
        }
        detailItem.rowSubtype = normalizeOrderBundleRowSubtype(
          typeof item.rowSubtype === 'string' ? item.rowSubtype : undefined,
        );
        return detailItem;
      })
    : [];
  const bodyPartSource = (bundle as { bodyPart?: Record<string, unknown> | null }).bodyPart;
  return {
    ok: true,
    status: parsed.status,
    setCode: typeof json.setCode === 'string' ? json.setCode : setCode,
    bundle: {
      entity: typeof bundle.entity === 'string' ? bundle.entity : bundle.entity === null ? null : undefined,
      sourceSetCode: typeof bundle.sourceSetCode === 'string' ? bundle.sourceSetCode : setCode,
      bundleName: typeof bundle.bundleName === 'string' ? bundle.bundleName : undefined,
      bundleNumber: typeof bundle.bundleNumber === 'string' ? bundle.bundleNumber : undefined,
      subtype: typeof bundle.subtype === 'string' ? bundle.subtype : undefined,
      classCode: typeof bundle.classCode === 'string' ? bundle.classCode : undefined,
      classCodeSystem: typeof bundle.classCodeSystem === 'string' ? bundle.classCodeSystem : undefined,
      className: typeof bundle.className === 'string' ? bundle.className : undefined,
      admin: typeof bundle.admin === 'string' ? bundle.admin : undefined,
      adminCode: typeof bundle.adminCode === 'string' ? bundle.adminCode : undefined,
      adminCodeSystem: typeof bundle.adminCodeSystem === 'string' ? bundle.adminCodeSystem : undefined,
      adminMemo: typeof bundle.adminMemo === 'string' ? bundle.adminMemo : undefined,
      memo: typeof bundle.memo === 'string' ? bundle.memo : undefined,
      started: typeof bundle.started === 'string' ? bundle.started : undefined,
      bodyPart:
        bodyPartSource && typeof bodyPartSource === 'object'
          ? {
              code: typeof bodyPartSource.code === 'string' ? bodyPartSource.code : undefined,
              name: typeof bodyPartSource.name === 'string' ? bodyPartSource.name : undefined,
              quantity: typeof bodyPartSource.quantity === 'string' ? bodyPartSource.quantity : undefined,
              unit: typeof bodyPartSource.unit === 'string' ? bodyPartSource.unit : undefined,
              memo: typeof bodyPartSource.memo === 'string' ? bodyPartSource.memo : undefined,
              rowRole: bodyPartSource.rowRole === 'bodyPart' ? 'bodyPart' : undefined,
            }
          : null,
      items,
    },
    runId: parsed.runId ?? meta.runId,
    traceId,
  };
}
