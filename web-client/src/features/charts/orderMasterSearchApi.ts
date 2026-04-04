import { httpFetch } from '../../libs/http/httpClient';
import { ensureObservabilityMeta, getObservabilityMeta } from '../../libs/observability/observability';
import type { DataSourceTransition } from './authService';

export type OrderMasterSearchType =
  | 'drug'
  | 'generic-class'
  | 'youhou'
  | 'material'
  | 'kensa-sort'
  | 'etensu'
  | 'comment'
  | 'bodypart';

export type OrderMasterSearchItem = {
  type: OrderMasterSearchType;
  code?: string;
  name: string;
  unit?: string;
  category?: string;
  itemNumber?: string;
  itemNumberBranch?: string;
  points?: number;
  note?: string;
  validFrom?: string;
  validTo?: string;
  timingCode?: string;
  routeCode?: string;
  daysLimit?: number;
  dosePerDay?: number;
  youhouCode?: string;
  specimens?: Array<{
    groupCode?: string;
    seq?: number;
    sampleCode?: string;
  }>;
};

export type OrderMasterSearchResult = {
  ok: boolean;
  items: OrderMasterSearchItem[];
  totalCount?: number;
  runId?: string;
  cacheHit?: boolean;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  dataSourceTransition?: DataSourceTransition;
  message?: string;
  raw?: unknown;
  correctionCandidates?: OrderMasterSearchItem[];
  correctionMeta?: {
    apiResult?: string;
    apiResultMessage?: string;
    validTo?: string;
  };
  selectionComments?: Array<{
    code: string;
    name: string;
    category?: string;
    itemNumber?: string;
    itemNumberBranch?: string;
  }>;
};

type OrcaMasterListResponse<T> = {
  totalCount?: number;
  items?: T[];
  message?: string;
};

type OrcaDrugMasterEntry = {
  code?: string;
  name?: string;
  category?: string;
  unit?: string;
  minPrice?: number;
  youhouCode?: string;
  timingCode?: string;
  routeCode?: string;
  daysLimit?: number;
  dosePerDay?: number;
  materialCategory?: string;
  kensaSort?: string;
  validFrom?: string;
  validTo?: string;
  note?: string;
};

type OrcaTensuEntry = {
  tensuCode?: string;
  name?: string;
  kubun?: string;
  points?: number;
  tanka?: number;
  unit?: string;
  category?: string;
  noticeDate?: string;
  effectiveDate?: string;
  startDate?: string;
  endDate?: string;
  tensuVersion?: string;
  specimens?: Array<{
    groupCode?: string;
    seq?: number;
    sampleCode?: string;
  }>;
};

const MASTER_ENDPOINT_MAP: Record<OrderMasterSearchType, string> = {
  drug: '/api/orca/master/drug',
  'generic-class': '/api/orca/master/generic-class',
  youhou: '/api/orca/master/youhou',
  material: '/api/orca/master/material',
  'kensa-sort': '/api/orca/master/kensa-sort',
  etensu: '/api/orca/master/etensu',
  comment: '/api/orca/master/comment',
  bodypart: '/api/orca/master/bodypart',
};

const COMMENT_CODE_PATTERN = /^(008[1-6]|8[1-6]|098|099|98|99)/;

const normalizeDrugEntry = (entry: OrcaDrugMasterEntry, type: OrderMasterSearchType): OrderMasterSearchItem | null => {
  const name = entry.name?.trim();
  if (!name) return null;
  const code = entry.code?.trim();
  const timingCode = entry.timingCode?.trim();
  const routeCode = entry.routeCode?.trim();
  const youhouCode = entry.youhouCode?.trim();
  const category = entry.category ?? entry.materialCategory ?? entry.kensaSort ?? entry.youhouCode;
  return {
    type,
    code: code || undefined,
    name,
    unit: entry.unit ?? undefined,
    category: category ?? undefined,
    points: typeof entry.minPrice === 'number' ? entry.minPrice : undefined,
    note: entry.note ?? undefined,
    validFrom: entry.validFrom ?? undefined,
    validTo: entry.validTo ?? undefined,
    timingCode: timingCode || undefined,
    routeCode: routeCode || undefined,
    daysLimit: typeof entry.daysLimit === 'number' ? entry.daysLimit : undefined,
    dosePerDay: typeof entry.dosePerDay === 'number' ? entry.dosePerDay : undefined,
    youhouCode: youhouCode || undefined,
  };
};

const normalizeTensuEntry = (entry: OrcaTensuEntry, type: OrderMasterSearchType): OrderMasterSearchItem | null => {
  const name = entry.name?.trim();
  if (!name) return null;
  const code = entry.tensuCode?.trim();
  const specimens = Array.isArray(entry.specimens)
    ? entry.specimens
        .map((specimen) => ({
          groupCode: typeof specimen.groupCode === 'string' ? specimen.groupCode : undefined,
          seq: typeof specimen.seq === 'number' ? specimen.seq : undefined,
          sampleCode: typeof specimen.sampleCode === 'string' ? specimen.sampleCode : undefined,
        }))
        .filter((specimen) => specimen.groupCode || specimen.sampleCode)
    : [];
  return {
    type,
    code: code || undefined,
    name,
    unit: entry.unit ?? undefined,
    category: entry.category ?? entry.kubun ?? undefined,
    points: typeof entry.points === 'number' ? entry.points : typeof entry.tanka === 'number' ? entry.tanka : undefined,
    note: entry.noticeDate ?? entry.effectiveDate ?? entry.tensuVersion ?? undefined,
    validFrom: entry.startDate ?? entry.effectiveDate ?? undefined,
    validTo: entry.endDate ?? undefined,
    specimens: specimens.length > 0 ? specimens : undefined,
  };
};

const readMessage = (json: unknown, fallback: string) => {
  if (json && typeof json === 'object' && 'message' in json && typeof (json as { message?: unknown }).message === 'string') {
    return (json as { message?: string }).message ?? fallback;
  }
  return fallback;
};

const readErrorCode = (json: unknown): string | undefined => {
  if (!json || typeof json !== 'object') return undefined;
  const source = json as { code?: unknown; errorCode?: unknown; error?: unknown };
  if (typeof source.code === 'string' && source.code.trim().length > 0) return source.code;
  if (typeof source.errorCode === 'string' && source.errorCode.trim().length > 0) return source.errorCode;
  if (typeof source.error === 'string' && source.error.trim().length > 0) return source.error;
  return undefined;
};

const isMasterUnavailableError = (
  status: number,
  errorCode: string | undefined,
  json: unknown,
  statusText?: string,
) => {
  if (status !== 502 && status !== 503 && status !== 504) return false;
  if (typeof errorCode === 'string' && /(?:^|_)UNAVAILABLE$/i.test(errorCode.trim())) {
    return true;
  }
  const summary = `${readMessage(json, '')} ${statusText ?? ''}`.trim();
  if (!summary) return false;
  return /unavailable|取得できませんでした/i.test(summary);
};

const extractList = <T,>(json: unknown): { items: T[]; totalCount?: number } => {
  if (Array.isArray(json)) {
    return { items: json as T[], totalCount: (json as T[]).length };
  }
  if (json && typeof json === 'object') {
    const list = (json as OrcaMasterListResponse<T>).items;
    const total = (json as OrcaMasterListResponse<T>).totalCount;
    if (Array.isArray(list)) {
      return { items: list, totalCount: typeof total === 'number' ? total : list.length };
    }
  }
  return { items: [], totalCount: 0 };
};

type OrderMasterDrugSearchMethod = 'prefix' | 'partial';
type OrderMasterDrugSearchScope = 'outer' | 'in-hospital' | 'adopted';

const normalizeDrugSearchMethod = (value: string | undefined): OrderMasterDrugSearchMethod | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'prefix' || normalized === 'partial') return normalized;
  return undefined;
};

const normalizeDrugSearchScope = (value: string | undefined): OrderMasterDrugSearchScope | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'outer' || normalized === 'outside' || normalized === 'outside_adopted') {
    return 'outer';
  }
  if (normalized === 'in-hospital' || normalized === 'in_hospital' || normalized === 'facility' || normalized === 'in_hospital_adopted') {
    return 'in-hospital';
  }
  if (normalized === 'adopted' || normalized === 'inside_adopted') {
    return 'adopted';
  }
  return undefined;
};

const normalizeOrcaDateParam = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const digitsOnly = trimmed.replace(/[^0-9]/g, '');
  if (digitsOnly.length === 8) return digitsOnly;
  const slashOrHyphenDate = trimmed.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})/);
  if (slashOrHyphenDate) {
    return `${slashOrHyphenDate[1]}${slashOrHyphenDate[2]}${slashOrHyphenDate[3]}`;
  }
  return trimmed;
};

export async function fetchOrderMasterSearch(params: {
  type: OrderMasterSearchType;
  keyword: string;
  effective?: string;
  asOf?: string;
  method?: OrderMasterDrugSearchMethod;
  scope?: string;
  category?: string;
  pointsMin?: number;
  pointsMax?: number;
  page?: number;
  size?: number;
  allowEmpty?: boolean;
}): Promise<OrderMasterSearchResult> {
  const keyword = params.keyword.trim();
  if (!keyword && params.type !== 'bodypart' && !params.allowEmpty) {
    return { ok: false, items: [], totalCount: 0, message: '検索キーワードが未指定です。' };
  }
  const query = new URLSearchParams();
  const normalizedDate = normalizeOrcaDateParam(params.asOf ?? params.effective);
  if (keyword) query.set('keyword', keyword);
  if (normalizedDate) {
    query.set('effective', normalizedDate);
    query.set('asOf', normalizedDate);
  }
  if (params.category) query.set('category', params.category);
  if (params.type === 'comment' && params.category) {
    query.set('category', params.category);
  }
  if (params.type === 'drug') {
    const normalizedMethod = normalizeDrugSearchMethod(params.method);
    if (normalizedMethod) query.set('method', normalizedMethod);
    const normalizedScope = normalizeDrugSearchScope(params.scope ?? params.category);
    if (normalizedScope) query.set('scope', normalizedScope);
  }
  if (params.type === 'etensu') {
    if (typeof params.pointsMin === 'number' && Number.isFinite(params.pointsMin)) {
      query.set('pointsMin', String(params.pointsMin));
    }
    if (typeof params.pointsMax === 'number' && Number.isFinite(params.pointsMax)) {
      query.set('pointsMax', String(params.pointsMax));
    }
  }
  const hasExplicitPage = typeof params.page === 'number' && Number.isFinite(params.page);
  const hasExplicitSize = typeof params.size === 'number' && Number.isFinite(params.size);
  if (hasExplicitPage) {
    query.set('page', String(params.page));
  }
  if (hasExplicitSize) {
    query.set('size', String(params.size));
  }
  const shouldApplyDefaultPaging = !hasExplicitPage && !hasExplicitSize;
  if (shouldApplyDefaultPaging && (params.type === 'drug' || params.type === 'generic-class')) {
    query.set('page', '1');
    query.set('size', '50');
  }
  if (shouldApplyDefaultPaging && params.type === 'comment') {
    query.set('page', '1');
    query.set('size', '100');
  }
  const endpoint = MASTER_ENDPOINT_MAP[params.type];
  const meta = ensureObservabilityMeta();
  const response = await httpFetch(`${endpoint}?${query.toString()}`, {
    notifySessionExpired: false,
  });
  const json = (await response.json().catch(() => ({}))) as unknown;
  const latestMeta = getObservabilityMeta();

  if (!response.ok) {
    const errorCode = readErrorCode(json);
    const isMasterUnavailable = isMasterUnavailableError(response.status, errorCode, json, response.statusText);
    if (isMasterUnavailable) {
      return {
        ok: true,
        items: [],
        totalCount: 0,
        runId: latestMeta.runId ?? meta.runId,
        cacheHit: latestMeta.cacheHit,
        missingMaster: true,
        fallbackUsed: true,
        dataSourceTransition: latestMeta.dataSourceTransition,
        message: readMessage(json, response.statusText || 'マスタ候補の取得に失敗しました。'),
        raw: json,
      };
    }
    const isTensuNotFound =
      response.status === 404 &&
      errorCode === 'TENSU_NOT_FOUND' &&
      (params.type === 'etensu' || params.type === 'comment');
    if (isTensuNotFound) {
      return {
        ok: true,
        items: [],
        totalCount: 0,
        runId: latestMeta.runId ?? meta.runId,
        cacheHit: latestMeta.cacheHit,
        missingMaster: latestMeta.missingMaster,
        fallbackUsed: latestMeta.fallbackUsed,
        dataSourceTransition: latestMeta.dataSourceTransition,
        raw: json,
      };
    }
    return {
      ok: false,
      items: [],
      totalCount: 0,
      runId: latestMeta.runId ?? meta.runId,
      cacheHit: latestMeta.cacheHit,
      missingMaster: latestMeta.missingMaster,
      fallbackUsed: latestMeta.fallbackUsed,
      dataSourceTransition: latestMeta.dataSourceTransition,
      message: readMessage(json, response.statusText || '検索に失敗しました。'),
      raw: json,
    };
  }

  if (params.type === 'etensu' || params.type === 'bodypart' || params.type === 'comment') {
    const { items, totalCount } = extractList<OrcaTensuEntry>(json);
    const normalizedAll = items
      .map((entry) => normalizeTensuEntry(entry, params.type))
      .filter((item): item is OrderMasterSearchItem => Boolean(item));
    const normalized =
      params.type === 'comment'
        ? normalizedAll.filter((item) => {
            const code = item.code?.trim() ?? '';
            if (COMMENT_CODE_PATTERN.test(code)) return true;
            const category = item.category?.toLowerCase() ?? '';
            return category.includes('comment') || category.includes('コメント');
          })
        : normalizedAll;
    return {
      ok: true,
      items: normalized,
      totalCount: params.type === 'comment' ? normalized.length : totalCount ?? normalized.length,
      runId: latestMeta.runId ?? meta.runId,
      cacheHit: latestMeta.cacheHit,
      missingMaster: latestMeta.missingMaster,
      fallbackUsed: latestMeta.fallbackUsed,
      dataSourceTransition: latestMeta.dataSourceTransition,
      raw: json,
    };
  }

  const { items, totalCount } = extractList<OrcaDrugMasterEntry>(json);
  const normalized = items
    .map((entry) => normalizeDrugEntry(entry, params.type))
    .filter((item): item is OrderMasterSearchItem => Boolean(item));

  return {
    ok: true,
    items: normalized,
    totalCount: totalCount ?? normalized.length,
    runId: latestMeta.runId ?? meta.runId,
    cacheHit: latestMeta.cacheHit,
    missingMaster: latestMeta.missingMaster,
    fallbackUsed: latestMeta.fallbackUsed,
    dataSourceTransition: latestMeta.dataSourceTransition,
    raw: json,
    correctionCandidates: undefined,
    correctionMeta: undefined,
    selectionComments: undefined,
  };
}
