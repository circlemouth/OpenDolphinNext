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
    method: 'ANY',
    path: '/api/orca/appointments/*',
    purpose: '予約一覧・患者／請求試算・来院状況を取得して ORCA バナーの `runId`/`dataSource` を連携する。',
    auditMetadata: ['runId', 'dataSource', 'cacheHit', 'missingMaster', 'fallbackUsed', 'dataSourceTransition', 'fetchedAt'],
    sourceDocs: ['docs/server-modernization/api-architecture-consolidation-plan.md'],
  },
  {
    id: 'medicalOutpatient',
    group: 'outpatient',
    method: 'ANY',
    path: '/api/orca/medical/outpatient',
    purpose: 'Charts/DocumentTimeline が表示する外来の Medical record を取得し、`auditEvent` に `recordsReturned`/`outcome` を記録する。',
    auditMetadata: ['runId', 'dataSource', 'cacheHit', 'missingMaster', 'fallbackUsed', 'dataSourceTransition', 'recordsReturned'],
    sourceDocs: [
      'docs/server-modernization/phase2/operations/logs/20251208T124645Z-api-gap-implementation.md',
      'docs/server-modernization/phase2/operations/logs/20251124T073245Z-webclient-master-bridge.md',
      'docs/web-client/architecture/web-client-api-mapping.md',
      'docs/server-modernization/phase2/operations/logs/20251205T090000Z-integration-implementation.md',
      'docs/server-modernization/phase2/operations/logs/20251205T150000Z-integration-implementation.md',
    ],
  },
  {
    id: 'diseaseMutation',
    group: 'outpatient',
    method: 'ANY',
    path: '/api/local-summary/diagnoses',
    purpose: 'Charts の local diagnosis 編集で facilityId/patientId/karteId スコープの登録・更新・削除を行い、ORCA live 契約と分離する。',
    auditMetadata: ['runId', 'operation', 'patientId', 'karteId'],
    sourceDocs: ['docs/web-client/ux/charts-claim-ui-policy.md'],
  },
  {
    id: 'orderBundleMutation',
    group: 'outpatient',
    method: 'ANY',
    path: '/api/orca/order/bundles',
    purpose: 'Charts の処方（RP）/オーダー束編集でバンドルを登録・更新・削除し、監査イベントへ反映する。',
    auditMetadata: ['runId', 'operation', 'patientId', 'entity'],
    sourceDocs: ['docs/web-client/ux/charts-claim-ui-policy.md'],
  },
  {
    id: 'patientOutpatient',
    group: 'outpatient',
    method: 'ANY',
    path: '/api/orca/patient/mutation',
    purpose: 'Patients/Administration で患者基本・保険情報を更新し、新規追加・削除・保険変更の `action=ORCA_PATIENT_MUTATION` を生成する。',
    auditMetadata: ['runId', 'dataSource', 'cacheHit', 'missingMaster', 'fallbackUsed', 'operation'],
    sourceDocs: [
      'docs/web-client/architecture/web-client-api-mapping.md',
      'docs/server-modernization/phase2/operations/logs/20251204T064209Z-api-gap.md',
      'docs/server-modernization/phase2/operations/logs/20251205T090000Z-integration-implementation.md',
      'docs/server-modernization/phase2/operations/logs/20251205T150000Z-integration-implementation.md',
    ],
  },
  {
    id: 'patientOutpatientInfo',
    group: 'outpatient',
    method: 'ANY',
    path: '/api/orca/patients/local-search/*',
    purpose: 'Reception/Patients 用にローカル患者検索を実行し、`missingMaster`/`cacheHit` を含めた `audit` を生成する。',
    auditMetadata: ['runId', 'dataSource', 'cacheHit', 'missingMaster', 'fallbackUsed', 'dataSourceTransition', 'fetchedAt', 'recordsReturned'],
    sourceDocs: ['docs/server-modernization/api-architecture-consolidation-plan.md'],
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
    sourceDocs: ['docs/server-modernization/README.md', 'docs/web-client/CURRENT.md'],
  },
  {
    id: 'patientImagesUpload',
    group: 'images',
    method: 'POST',
    path: '/patients/{patientId}/images',
    purpose: '患者画像を multipart/form-data でアップロードする。',
    auditMetadata: ['runId', 'traceId', 'patientId', 'imageId', 'documentId', 'fetchedAt'],
    sourceDocs: ['docs/server-modernization/README.md', 'docs/web-client/CURRENT.md'],
  },
  {
    id: 'karteImageDetail',
    group: 'images',
    method: 'GET',
    path: '/karte/image/{id}',
    purpose: 'カルテ画像の詳細（SchemaModel）を取得する。',
    auditMetadata: ['runId', 'traceId', 'imageId', 'fetchedAt'],
    sourceDocs: ['src/server_modernized_gap_20251221/02_karte_gap/KRT_03_karte_image_PathParam修正.md'],
  },
  {
    id: 'karteAttachmentDetail',
    group: 'images',
    method: 'GET',
    path: '/karte/attachment/{id}',
    purpose: 'カルテ添付ファイルを取得する。',
    auditMetadata: ['runId', 'traceId', 'attachmentId', 'fetchedAt'],
    sourceDocs: ['src/server_modernized_gap_20251221/02_karte_gap/KRT_01_Document更新API.md'],
  },
  {
    id: 'karteDocumentUpdate',
    group: 'images',
    method: 'PUT',
    path: '/karte/document',
    purpose: 'カルテ文書（Document）への添付送信と本文更新を行う。',
    auditMetadata: ['runId', 'traceId', 'documentId', 'attachmentsSent', 'fetchedAt'],
    sourceDocs: ['src/server_modernized_gap_20251221/02_karte_gap/KRT_01_Document更新API.md'],
  },
];

// `resolveMasterSource` が `dataSourceTransition=server` を返す経路ではこの `outpatient` グループを使い、`cacheHit`/`missingMaster` を `telemetryClient` に継承します。
// RUN_ID=20251205T150000Z の統合実装ではこのパス一覧を経由し、`docs/server-modernization/phase2/operations/logs/20251205T150000Z-integration-implementation.md` へ telemetry funnel を記録しています。

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

const isOrcaEndpoint = (url?: URL | null): boolean => {
  if (!url) return false;
  const pattern = /^\/(orca|api\/orca|blobapi|karte|odletter|user|api\/admin|api\/chart-events|chart-events|api\/realtime|realtime)(\/|$)/;
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
  const response = await fetch(input, { ...initWithHeaders, cache, credentials });
  captureObservabilityFromResponse(response);
  const resolvedInit =
    init?.notifySessionExpired === undefined && isOrcaEndpoint(requestUrl)
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
