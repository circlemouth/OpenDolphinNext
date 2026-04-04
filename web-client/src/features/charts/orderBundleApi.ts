import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import { importPatientsFromOrca } from '../outpatient/orcaPatientImportApi';
import { buildPatientImportFailureMessage, isRecoverableOrcaNotFound } from '../shared/orcaPatientImportRecovery';
import type { OrcaResponseErrorKind } from '../shared/orcaApiResponse';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';
import { resolveCanonicalOrderEntity } from './orderCategoryRegistry';
import { resolveOrcaOrderItemFields } from './orcaOrderItemMeta';

export type OrderBundleItem = {
  code?: string;
  name: string;
  quantity?: string;
  unit?: string;
  memo?: string;
  genericFlg?: 'yes' | 'no';
  userComment?: string;
  masterCategory?: string;
  selectionCommentItemNumber?: string;
  selectionCommentItemNumberBranch?: string;
  rowRole?: 'main' | 'material' | 'comment' | 'bodyPart';
};

export type OrderBundleBodyPart = {
  code?: string;
  name: string;
  quantity?: string;
  unit?: string;
  memo?: string;
  rowRole?: 'bodyPart';
};

export type OrderBundle = {
  documentId?: number;
  moduleId?: number;
  entity?: string;
  bundleName?: string;
  bundleNumber?: string;
  sourceSetCode?: string;
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
  enteredByName?: string;
  enteredByRole?: string;
  enteredAt?: string;
  authorName?: string;
  authorRole?: string;
  authoredAt?: string;
  items: OrderBundleItem[];
  bodyPart?: OrderBundleBodyPart;
};

export type OrderBundleFetchResult = {
  ok: boolean;
  runId?: string;
  patientId?: string;
  recordsReturned?: number;
  bundles: OrderBundle[];
  message?: string;
  status?: number;
  errorCode?: string;
  errorKind?: OrcaResponseErrorKind;
  routeMismatch?: boolean;
  patientImportAttempted?: boolean;
  patientImportStatus?: number;
};

type FetchOrderBundlesParams = {
  patientId: string;
  entity?: string;
  from?: string;
};

export type OrderBundleOperation = {
  operation: 'create' | 'update' | 'delete';
  documentId?: number;
  moduleId?: number;
  entity?: string;
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
  startDate?: string;
  endDate?: string;
  items?: OrderBundleItem[];
  bodyPart?: OrderBundleBodyPart;
};

const normalizeOrderEntityValue = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return resolveCanonicalOrderEntity(trimmed) ?? trimmed;
};

const normalizeOptionalText = (value?: string | null) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const normalizeOrderBundle = (bundle: OrderBundle): OrderBundle => ({
  ...bundle,
  entity: normalizeOrderEntityValue(bundle.entity),
  items: (bundle.items ?? []).map((item) => {
    const fields = resolveOrcaOrderItemFields(item);
    return {
      ...item,
      memo: fields.memoText,
      genericFlg: fields.genericFlg,
      userComment: fields.userComment,
      masterCategory: fields.masterCategory,
      selectionCommentItemNumber: normalizeOptionalText(item.selectionCommentItemNumber ?? fields.itemNumber),
      selectionCommentItemNumberBranch: normalizeOptionalText(
        item.selectionCommentItemNumberBranch ?? fields.itemNumberBranch,
      ),
    };
  }),
});

const normalizeOrderBundleOperation = (operation: OrderBundleOperation): OrderBundleOperation => ({
  ...operation,
  entity: normalizeOrderEntityValue(operation.entity),
  items: (operation.items ?? []).map((item) => {
    const fields = resolveOrcaOrderItemFields(item);
    return {
      ...item,
      memo: fields.memoText,
      genericFlg: fields.genericFlg,
      userComment: fields.userComment,
      masterCategory: fields.masterCategory,
      selectionCommentItemNumber: normalizeOptionalText(item.selectionCommentItemNumber ?? fields.itemNumber),
      selectionCommentItemNumberBranch: normalizeOptionalText(
        item.selectionCommentItemNumberBranch ?? fields.itemNumberBranch,
      ),
    };
  }),
});

export type OrderBundleMutationResult = {
  ok: boolean;
  runId?: string;
  createdDocumentIds?: number[];
  updatedDocumentIds?: number[];
  deletedDocumentIds?: number[];
  message?: string;
  raw?: unknown;
};

export async function fetchOrderBundles(params: FetchOrderBundlesParams): Promise<OrderBundleFetchResult> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const query = new URLSearchParams();
  const normalizedEntity = normalizeOrderEntityValue(params.entity);
  if (normalizedEntity) query.set('entity', normalizedEntity);
  if (params.from) query.set('from', params.from);
  const response = await httpFetch(`/api/orca/order/bundles?patientId=${encodeURIComponent(params.patientId)}${query.toString() ? `&${query.toString()}` : ''}`);
  const parsed = await parseOrcaApiResponse(response, { fallbackMessage: 'オーダー情報の取得に失敗しました。' });
  const json = parsed.json ?? {};
  if (parsed.ok && !parsed.json) {
    return {
      ok: false,
      runId,
      patientId: params.patientId,
      bundles: [],
      message: 'オーダー情報APIがJSON以外を返しました。ルーティング設定を確認してください。',
      status: parsed.status,
      errorKind: 'route_not_found',
      routeMismatch: true,
    };
  }
  return {
    ok: parsed.ok,
    runId: typeof json.runId === 'string' ? (json.runId as string) : parsed.runId ?? runId,
    patientId: typeof json.patientId === 'string' ? (json.patientId as string) : params.patientId,
    recordsReturned: typeof json.recordsReturned === 'number' ? (json.recordsReturned as number) : undefined,
    bundles: Array.isArray(json.bundles) ? (json.bundles as OrderBundle[]).map(normalizeOrderBundle) : [],
    message: parsed.message,
    status: parsed.status,
    errorCode: parsed.ok ? undefined : parsed.errorCode,
    errorKind: parsed.ok ? undefined : parsed.errorKind,
    routeMismatch: parsed.ok ? false : parsed.routeMismatch,
  };
}

export async function fetchOrderBundlesWithPatientImportRecovery(
  params: FetchOrderBundlesParams,
): Promise<OrderBundleFetchResult> {
  const primary = await fetchOrderBundles(params);
  if (primary.ok) return primary;

  if (
    !isRecoverableOrcaNotFound({
      patientId: params.patientId,
      status: primary.status,
      errorCode: primary.errorCode,
      errorKind: primary.errorKind,
    })
  ) {
    return primary;
  }

  const importResult = await importPatientsFromOrca({
    patientIds: [params.patientId],
    runId: primary.runId,
  });

  if (!importResult.ok) {
    return {
      ...primary,
      ok: false,
      bundles: [],
      runId: importResult.runId ?? primary.runId,
      status: importResult.status || primary.status,
      message: buildPatientImportFailureMessage('オーダー情報', importResult),
      errorCode: importResult.errorCode ?? primary.errorCode,
      errorKind: importResult.errorKind ?? primary.errorKind,
      routeMismatch: importResult.routeMismatch ?? primary.routeMismatch,
      patientImportAttempted: true,
      patientImportStatus: importResult.status,
    };
  }

  const retried = await fetchOrderBundles(params);
  return {
    ...retried,
    runId: retried.runId ?? importResult.runId ?? primary.runId,
    patientImportAttempted: true,
    patientImportStatus: importResult.status,
  };
}

export async function mutateOrderBundles(params: {
  patientId: string;
  operations: OrderBundleOperation[];
}): Promise<OrderBundleMutationResult> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const response = await httpFetch('/api/orca/order/bundles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: params.patientId,
      operations: params.operations.map(normalizeOrderBundleOperation),
    }),
  });
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
    createdDocumentIds: Array.isArray(json.createdDocumentIds) ? (json.createdDocumentIds as number[]) : undefined,
    updatedDocumentIds: Array.isArray(json.updatedDocumentIds) ? (json.updatedDocumentIds as number[]) : undefined,
    deletedDocumentIds: Array.isArray(json.deletedDocumentIds) ? (json.deletedDocumentIds as number[]) : undefined,
    message,
    raw: json,
  };
}
