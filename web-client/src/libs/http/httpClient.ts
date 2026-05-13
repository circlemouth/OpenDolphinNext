import { applyHeaderFlagsToInit } from './header-flags';
import { applyObservabilityHeaders, captureObservabilityFromResponse } from '../observability/observability';
import { notifySessionExpired } from '../session/sessionExpiry';
import { readStoredSession } from '../session/storedSession';
import { readCsrfToken } from '../security/csrf';

export function hasStoredAuth(): boolean {
  return readStoredSession() !== null;
}

const resolveBaseOrigin = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost';
};

const resolveUrl = (input?: string | URL | null): URL | null => {
  if (!input) return null;
  if (input instanceof URL) return input;
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, resolveBaseOrigin());
  } catch {
    return null;
  }
};

const resolveRequestUrl = (input: RequestInfo | URL): URL | null => {
  if (input instanceof URL) return input;
  if (typeof input === 'string') return resolveUrl(input);
  if (input instanceof Request) return resolveUrl(input.url);
  return null;
};

const isSameOrigin = (url?: URL | null): boolean => {
  if (!url) return false;
  return url.origin === resolveBaseOrigin();
};

const normalizeHeaders = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }
  return { ...headers };
};

export function buildHttpHeaders(init?: RequestInit, pathname?: string | null): Record<string, string> {
  const url = resolveUrl(pathname);
  const withObservability = applyObservabilityHeaders(init);
  const withFlags = applyHeaderFlagsToInit(withObservability);
  const withCsrf = applyCsrfHeaders(withFlags, url);
  return normalizeHeaders(withCsrf.headers);
}

export type HttpEndpointDefinition = {
  id: string;
  group?: 'outpatient' | 'images';
  scope?: 'official' | 'master' | 'local';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'ANY';
  path: string;
  purpose: string;
  auditMetadata: readonly string[];
  sourceDocs: readonly string[];
};

export const OUTPATIENT_API_ENDPOINTS: readonly HttpEndpointDefinition[] = [
  {
    id: 'appointmentOutpatient',
    group: 'outpatient',
    scope: 'official',
    method: 'ANY',
    path: '/api/orca/official/appointments/*',
    purpose: 'scope=official。予約一覧・患者／請求試算・来院状況を取得して ORCA バナーの `runId`/`dataSource` を連携する。',
    auditMetadata: ['runId', 'dataSource', 'cacheHit', 'missingMaster', 'fallbackUsed', 'dataSourceTransition', 'fetchedAt'],
    sourceDocs: ['docs/architecture/server-modernization-overview.md', 'docs/contracts/orca-master-api.md', 'docs/contracts/orca-route-taxonomy.md'],
  },
  {
    id: 'orcaDiseaseMirrorRead',
    group: 'outpatient',
    scope: 'local',
    method: 'GET',
    path: '/api/local/diagnoses/{patientId}',
    purpose: 'scope=local。Charts 用の病名 read model。ORCA diseasegetv2 正本 projection と local candidate を分離して返し、local 候補の作成・更新・削除 route は提供しない。',
    auditMetadata: ['runId', 'patientId', 'baseMonth', 'sourceOfTruth', 'orcaMirrorStatus'],
    sourceDocs: ['docs/contracts/disease-boundary.md', 'docs/contracts/orca-route-taxonomy.md', 'web-client/notes/disease-insurance-orca-contract.md'],
  },
  {
    id: 'officialDiseaseGetV2',
    group: 'outpatient',
    scope: 'local',
    method: 'GET',
    path: '/api/local/diagnoses/{patientId}',
    purpose: 'scope=local / classification=official diseasegetv2。server が ORCA diseasegetv2?class=01 を取得し、主病名一覧の唯一の ORCA 正本 projection として返す。',
    auditMetadata: ['runId', 'patientId', 'baseMonth', 'sourceApi=diseasegetv2', 'orcaMirrorStatus'],
    sourceDocs: ['docs/contracts/disease-boundary.md', 'docs/contracts/orca-route-taxonomy.md', 'web-client/notes/disease-insurance-orca-contract.md'],
  },
  {
    id: 'officialDiseaseV3Mutation',
    group: 'outpatient',
    scope: 'official',
    method: 'POST',
    path: '/api/orca/official/chart-support/disease-mod-v3',
    purpose: 'scope=official。Charts の病名追加・更新・削除・削除病名整理を diseasev3 へ送信し、成功後の diseasegetv2 再取得だけを登録済み表示に使う。',
    auditMetadata: ['runId', 'operation', 'patientId', 'operationStatus', 'needsUserReview', 'postMutationMirrorStatus'],
    sourceDocs: ['docs/contracts/disease-boundary.md', 'docs/contracts/orca-route-taxonomy.md', 'web-client/notes/disease-insurance-orca-contract.md'],
  },
  {
    id: 'orderMasterRead',
    group: 'outpatient',
    scope: 'master',
    method: 'ANY',
    path: '/api/orca/master/order/*',
    purpose: 'scope=master。Charts の入力セット参照と相互作用チェックで master-backed read を実行し、official/local mutation と混在させない。',
    auditMetadata: ['runId', 'traceId', 'recordsReturned', 'totalCount'],
    sourceDocs: ['docs/contracts/orca-route-taxonomy.md', 'docs/contracts/orca-master-api.md'],
  },
  {
    id: 'orderBundleMutation',
    group: 'outpatient',
    scope: 'local',
    method: 'ANY',
    path: '/api/local/order/bundles',
    purpose: 'scope=local。Charts の処方（RP）/オーダー束編集でバンドルを登録・更新・削除し、監査イベントへ反映する。',
    auditMetadata: ['runId', 'operation', 'patientId', 'entity'],
    sourceDocs: ['docs/architecture/web-client-overview.md', 'docs/managerdocs/04_ui_improvement_program.md', 'docs/contracts/orca-route-taxonomy.md'],
  },
  {
    id: 'officialPatientCreate',
    group: 'outpatient',
    scope: 'official',
    method: 'POST',
    path: '/api/orca/official/patientmodv2/outpatient/create',
    purpose: 'scope=official。Patients で official patientmodv2 class=01 create を実行し、成功後に canonical/local sync を確定する。',
    auditMetadata: ['runId', 'routeNamespace', 'operation', 'patientId'],
    sourceDocs: ['docs/architecture/web-client-overview.md', 'docs/architecture/server-modernization-overview.md', 'docs/contracts/orca-route-taxonomy.md'],
  },
  {
    id: 'officialPatientUpdate',
    group: 'outpatient',
    scope: 'official',
    method: 'POST',
    path: '/api/orca/official/patientmodv2/outpatient/update',
    purpose: 'scope=official。Patients/Charts で official patientmodv2 class=02 update を実行し、成功後に canonical/local sync を確定する。',
    auditMetadata: ['runId', 'routeNamespace', 'operation', 'patientId'],
    sourceDocs: ['docs/architecture/web-client-overview.md', 'docs/architecture/server-modernization-overview.md', 'docs/contracts/orca-route-taxonomy.md'],
  },
  {
    id: 'patientOutpatientInfo',
    group: 'outpatient',
    scope: 'local',
    method: 'ANY',
    path: '/api/local/patients/search',
    purpose: 'scope=local。Reception/Patients 用に院内ローカル患者検索を実行し、`routeNamespace=local` と `recordsReturned` を含む監査を生成する。',
    auditMetadata: ['runId', 'routeNamespace', 'dataSource', 'dataSourceTransition', 'fetchedAt', 'recordsReturned'],
    sourceDocs: ['docs/architecture/server-modernization-overview.md', 'docs/contracts/orca-master-api.md', 'docs/contracts/orca-route-taxonomy.md'],
  },
];

export const KARTE_IMAGE_API_ENDPOINTS: readonly HttpEndpointDefinition[] = [
  {
    id: 'patientImagesList',
    group: 'images',
    method: 'GET',
    path: '/patients/{patientId}/images',
    purpose: '患者画像の一覧を取得し、Charts / Mobile Images UI へ共通供給する。',
    auditMetadata: ['runId', 'traceId', 'recordsReturned', 'fetchedAt'],
    sourceDocs: ['docs/contracts/patient-images.md', 'docs/architecture/web-client-overview.md'],
  },
  {
    id: 'patientImagesUpload',
    group: 'images',
    method: 'POST',
    path: '/patients/{patientId}/images',
    purpose: '患者画像を multipart/form-data でアップロードする。',
    auditMetadata: ['runId', 'traceId', 'patientId', 'imageId', 'documentId', 'fetchedAt'],
    sourceDocs: ['docs/contracts/patient-images.md', 'docs/architecture/web-client-overview.md'],
  },
  {
    id: 'karteImageDetail',
    group: 'images',
    method: 'GET',
    path: '/karte/image/{id}',
    purpose: 'カルテ画像の詳細（SchemaModel）を取得する。',
    auditMetadata: ['runId', 'traceId', 'imageId', 'fetchedAt'],
    sourceDocs: ['docs/contracts/patient-images.md'],
  },
  {
    id: 'karteAttachmentDetail',
    group: 'images',
    method: 'GET',
    path: '/karte/attachment/{id}',
    purpose: 'カルテ添付ファイルを取得する。',
    auditMetadata: ['runId', 'traceId', 'attachmentId', 'fetchedAt'],
    sourceDocs: ['docs/contracts/document-integrity.md'],
  },
  {
    id: 'chartDocumentDraft',
    group: 'images',
    method: 'POST',
    path: '/api/charts/document-drafts',
    purpose: 'chart_revision authority 経由で診療録下書きを作成し、旧 karte/document 書込 route を使わない。',
    auditMetadata: ['runId', 'traceId', 'chartId', 'revisionId', 'attachmentsSent', 'fetchedAt'],
    sourceDocs: ['docs/contracts/chart-authority-api.md', 'docs/contracts/document-integrity.md', 'docs/web-client/architecture/document-embedded-attachment-policy.md'],
  },
];

// `resolveMasterSource` が `dataSourceTransition=server` を返す経路ではこの `outpatient` グループを使い、`cacheHit`/`missingMaster` を `telemetryClient` に継承します。
// scope は official/master/local taxonomy と一致させ、契約の正本は `docs/architecture/*.md` と `docs/contracts/*.md` に集約しています。

export type HttpFetchInit = RequestInit & {
  /**
   * 403（権限不足）をセッション失効扱いとして通知する場合に明示的に有効化する。
   * デフォルトでは 403 では失効通知を行わず、UI 側のエラーバナー/トーストで吸収する。
   */
  notifyForbiddenAsSessionExpiry?: boolean;
  /**
   * 認証エラー検知時のセッション失効通知を抑止する。
   * ORCA 接続など別系統の認証で 401 が返る場合に使用する。
   */
  notifySessionExpired?: boolean;
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALLOW_MISSING_CSRF_FLAG = '1';
type CsrfRuntimeOverride = {
  prod?: boolean;
  allowMissingCsrf?: boolean;
};
let csrfRuntimeOverride: CsrfRuntimeOverride | undefined;

/**
 * Test helper: override CSRF runtime behavior without mutating import.meta.env.PROD.
 */
export const setCsrfRuntimeOverrideForTests = (override?: CsrfRuntimeOverride) => {
  csrfRuntimeOverride = override;
};

const isProdRuntime = () => csrfRuntimeOverride?.prod ?? import.meta.env.PROD;
const isMissingCsrfAllowedRuntime = () => {
  if (isProdRuntime()) return false;
  return csrfRuntimeOverride?.allowMissingCsrf ?? import.meta.env.VITE_ALLOW_MISSING_CSRF === ALLOW_MISSING_CSRF_FLAG;
};

const isUpstreamAuthEndpoint = (url?: URL | null): boolean => {
  if (!url) return false;
  const pattern = /^\/(orca|api\/orca|blobapi|karte|odletter|user)(\/|$)/;
  return pattern.test(url.pathname);
};

const shouldUseNoStoreCache = (url?: URL | null, method = 'GET') => {
  if (!url || !isSameOrigin(url) || method !== 'GET') {
    return false;
  }
  return /^\/(karte|odletter|letter|user|api\/session)(\/|$)/.test(url.pathname);
};

const applyCsrfHeaders = (init?: RequestInit, url?: URL | null): RequestInit => {
  if (!url || !isSameOrigin(url)) return init ?? {};
  const method = (init?.method ?? 'GET').toUpperCase();
  if (SAFE_METHODS.has(method)) return init ?? {};

  const headers = new Headers(init?.headers ?? {});
  if (headers.has('X-CSRF-Token')) return { ...(init ?? {}), headers };

  const token = readCsrfToken();
  if (!token) {
    if (!isMissingCsrfAllowedRuntime()) {
      throw new Error('CSRF token missing');
    }
    return { ...(init ?? {}), headers };
  }

  headers.set('X-CSRF-Token', token);
  if (!headers.has('Origin')) {
    headers.set('Origin', url.origin);
  }
  if (!headers.has('Referer') && typeof window !== 'undefined' && window.location?.href) {
    headers.set('Referer', window.location.href);
  }
  return { ...(init ?? {}), headers };
};

export const shouldNotifySessionExpired = (status: number, init?: HttpFetchInit) => {
  if (init?.notifySessionExpired === false) return false;
  if (status === 403 && !init?.notifyForbiddenAsSessionExpiry) return false;
  if (status !== 401 && status !== 403 && status !== 419 && status !== 440) return false;
  const session = readStoredSession();
  return Boolean(session);
};

export async function httpFetch(input: RequestInfo | URL, init?: HttpFetchInit) {
  const requestUrl = resolveRequestUrl(input);
  const mergedHeaders = new Headers(input instanceof Request ? input.headers : undefined);
  const overrideHeaders = new Headers(init?.headers ?? {});
  overrideHeaders.forEach((value, key) => {
    mergedHeaders.set(key, value);
  });
  const requestMethod = (init?.method ?? (input instanceof Request ? input.method : undefined) ?? 'GET').toUpperCase();
  const headers = buildHttpHeaders(
    { ...(init ?? {}), method: requestMethod, headers: mergedHeaders },
    requestUrl ? requestUrl.toString() : undefined,
  );
  const initWithHeaders = { ...(init ?? {}), method: requestMethod, headers };
  const cache = initWithHeaders.cache ?? (shouldUseNoStoreCache(requestUrl, requestMethod) ? 'no-store' : undefined);
  // 認証クッキー（JSESSIONID 等）を常に送るため、デフォルトで include を付与する。
  const credentials = initWithHeaders.credentials ?? 'include';
  const resolvedInput =
    typeof input === 'string' && requestUrl
      ? requestUrl.toString()
      : input instanceof Request && requestUrl
        ? new Request(requestUrl.toString(), input)
        : input;
  const response = await fetch(resolvedInput, { ...initWithHeaders, cache, credentials });
  captureObservabilityFromResponse(response);
  const resolvedInit =
    init?.notifySessionExpired === undefined && isUpstreamAuthEndpoint(requestUrl)
      ? { ...init, notifySessionExpired: false }
      : init;
  if (shouldNotifySessionExpired(response.status, resolvedInit)) {
    const reason =
      response.status === 403
        ? 'forbidden'
        : response.status === 419 || response.status === 440
          ? 'timeout'
          : 'unauthorized';
    notifySessionExpired(reason, response.status);
  }
  return response;
}
