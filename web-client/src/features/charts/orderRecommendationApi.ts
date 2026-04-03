import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import type { OrderBundleBodyPart, OrderBundleItem } from './orderBundleApi';

export type OrderRecommendationSource = 'patient' | 'facility';

export type OrderRecommendationTemplate = {
  bundleName: string;
  admin: string;
  adminMemo?: string;
  adminCode?: string;
  adminCodeSystem?: string;
  bundleNumber: string;
  subtype?: string;
  classCode?: string;
  classCodeSystem?: string;
  className?: string;
  memo: string;
  prescriptionLocation?: 'in' | 'out';
  prescriptionTiming?: 'regular' | 'tonyo' | 'gaiyo';
  items: OrderBundleItem[];
  materialItems: OrderBundleItem[];
  commentItems: OrderBundleItem[];
  bodyPart?: OrderBundleBodyPart | null;
};

export type OrderRecommendationCandidate = {
  key: string;
  // Present when the server returns cross-category recommendations.
  // When fetching with `entity` query param, this may be omitted.
  entity?: string;
  source: OrderRecommendationSource;
  count: number;
  lastUsedAt: string;
  template: OrderRecommendationTemplate;
};

export type OrderRecommendationFetchResult = {
  ok: boolean;
  runId?: string;
  patientId?: string;
  recordsScanned?: number;
  recordsReturned?: number;
  recommendations: OrderRecommendationCandidate[];
  message?: string;
};

export async function fetchOrderRecommendations(params: {
  patientId: string;
  entity?: string;
  from?: string;
  includeFacility?: boolean;
  patientLimit?: number;
  facilityLimit?: number;
  scanLimit?: number;
}): Promise<OrderRecommendationFetchResult> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const query = new URLSearchParams();
  if (params.entity) query.set('entity', params.entity);
  if (params.from) query.set('from', params.from);
  if (typeof params.includeFacility === 'boolean') query.set('includeFacility', params.includeFacility ? 'true' : 'false');
  if (typeof params.patientLimit === 'number') query.set('patientLimit', String(params.patientLimit));
  if (typeof params.facilityLimit === 'number') query.set('facilityLimit', String(params.facilityLimit));
  if (typeof params.scanLimit === 'number') query.set('scanLimit', String(params.scanLimit));
  const endpoint = `/api/orca/order/recommendations?patientId=${encodeURIComponent(params.patientId)}${query.toString() ? `&${query.toString()}` : ''}`;
  try {
    const response = await httpFetch(endpoint);
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const message =
      typeof json.message === 'string'
        ? (json.message as string)
        : typeof json.apiResultMessage === 'string'
          ? (json.apiResultMessage as string)
          : undefined;
    return {
      ok: response.ok,
      runId: typeof json.runId === 'string' ? (json.runId as string) : runId,
      patientId: typeof json.patientId === 'string' ? (json.patientId as string) : params.patientId,
      recordsScanned: typeof json.recordsScanned === 'number' ? (json.recordsScanned as number) : undefined,
      recordsReturned: typeof json.recordsReturned === 'number' ? (json.recordsReturned as number) : undefined,
      recommendations: Array.isArray(json.recommendations) ? (json.recommendations as OrderRecommendationCandidate[]) : [],
      message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      runId,
      patientId: params.patientId,
      recommendations: [],
      message,
    };
  }
}
