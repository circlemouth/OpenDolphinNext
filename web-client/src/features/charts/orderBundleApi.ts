import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import { importPatientsFromOrca } from '../outpatient/orcaPatientImportApi';
import { buildPatientImportFailureMessage, isRecoverableOrcaNotFound } from '../shared/orcaPatientImportRecovery';
import type { OrcaResponseErrorKind } from '../shared/orcaApiResponse';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';
import type { BacteriaOrderMetadata } from './bacteriaOrderSupport';
import { normalizeBacteriaOrderMetadata } from './bacteriaOrderSupport';
import {
  getAllowedClassCodesForEntity,
  isOrcaEntityClassAllowed,
  normalizeOrcaClassCode,
  requiresOrcaClassCode,
  resolveCanonicalOrcaClassName,
  resolveCanonicalOrcaOrderEntity,
  supportsOrcaBodyPartField,
} from './orcaMedicalClassCatalog';
import { isOtherOrderLocalOnlyCode } from './otherOrderContract';
import { canonicalizeChargeBundleMeta, isChargeClassCompatible, isChargeEntity } from './orderChargeClassSupport';
import { resolveOrcaOrderItemFields } from './orcaOrderItemMeta';

export type OrderBundleRowRole = 'main' | 'auxiliary' | 'material' | 'comment' | 'bodyPart';
export type OrderBundleRowSubtype = 'material' | 'contrastDrug';

export const normalizeOrderBundleRowRole = (value?: string | null): OrderBundleRowRole | undefined => {
  const normalized = value?.trim();
  if (
    normalized === 'main' ||
    normalized === 'auxiliary' ||
    normalized === 'material' ||
    normalized === 'comment' ||
    normalized === 'bodyPart'
  ) {
    return normalized;
  }
  return undefined;
};

export const normalizeOrderBundleRowSubtype = (value?: string | null): OrderBundleRowSubtype | undefined => {
  const normalized = value?.trim();
  if (normalized === 'material' || normalized === 'contrastDrug') {
    return normalized;
  }
  if (normalized === 'contrast' || normalized === 'drug') return 'contrastDrug';
  return undefined;
};

export type OrderBundleItem = {
  code?: string;
  name: string;
  quantity?: string;
  unit?: string;
  memo?: string;
  structuredCommentValue?: string;
  genericFlg?: 'yes' | 'no';
  userComment?: string;
  rowRole?: OrderBundleRowRole;
  rowSubtype?: OrderBundleRowSubtype;
  category?: string;
  masterCategory?: string;
  itemNumber?: string;
  itemNumberBranch?: string;
  selectionCommentItemNumber?: string;
  selectionCommentItemNumberBranch?: string;
};

export type OrderBundleBodyPart = {
  code?: string;
  name: string;
  quantity?: string;
  unit?: string;
  memo?: string;
  rowRole?: Extract<OrderBundleRowRole, 'bodyPart'>;
};

export type OrderBundle = {
  documentId?: number;
  moduleId?: number;
  contentHash?: string;
  entity?: string;
  bundleName?: string;
  bundleNumber?: string;
  sourceSetCode?: string;
  subtype?: string;
  bacteria?: BacteriaOrderMetadata;
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
  materialItems?: OrderBundleItem[];
  commentItems?: OrderBundleItem[];
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
  expectedContentHash?: string;
  clientMutationId?: string;
  entity?: string;
  bundleName?: string;
  bundleNumber?: string;
  subtype?: string;
  bacteria?: BacteriaOrderMetadata;
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
  materialItems?: OrderBundleItem[];
  commentItems?: OrderBundleItem[];
  bodyPart?: OrderBundleBodyPart;
};

const normalizeOrderBundleClassName = (
  entity?: string | null,
  classCode?: string | null,
  className?: string | null,
): string | undefined => resolveCanonicalOrcaClassName(normalizeOrderEntityValue(entity), classCode, className);

export const ORDER_BUNDLE_BODY_PART_CODE_PREFIX = '002';

const normalizeBodyPartText = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const hasOrderBundleBodyPartValue = (bodyPart?: OrderBundleBodyPart | null) =>
  Boolean(
    bodyPart?.code?.trim() ||
      bodyPart?.name?.trim() ||
      bodyPart?.quantity?.trim() ||
      bodyPart?.unit?.trim() ||
      bodyPart?.memo?.trim(),
  );

export const isOrderBundleBodyPartCode = (code?: string | null) =>
  Boolean(normalizeBodyPartText(code)?.startsWith(ORDER_BUNDLE_BODY_PART_CODE_PREFIX));

export const normalizeOrderBundleBodyPart = (
  bodyPart?: OrderBundleBodyPart | null,
  options?: { dropInvalid?: boolean },
): OrderBundleBodyPart | undefined => {
  if (!hasOrderBundleBodyPartValue(bodyPart)) return undefined;
  const normalized: OrderBundleBodyPart = {
    code: normalizeBodyPartText(bodyPart?.code),
    name: normalizeBodyPartText(bodyPart?.name) ?? '',
    quantity: normalizeBodyPartText(bodyPart?.quantity),
    unit: normalizeBodyPartText(bodyPart?.unit),
    memo: normalizeBodyPartText(bodyPart?.memo),
    rowRole: 'bodyPart',
  };
  if (!normalized.name) {
    return options?.dropInvalid ? undefined : normalized;
  }
  if (!normalized.code || !isOrderBundleBodyPartCode(normalized.code)) {
    return options?.dropInvalid ? undefined : normalized;
  }
  return normalized;
};

const normalizeOrderBundleBodyPartForEntity = (
  entity?: string | null,
  classCode?: string | null,
  bodyPart?: OrderBundleBodyPart | null,
  options?: { dropInvalid?: boolean },
) => {
  if (!supportsOrcaBodyPartField(entity, classCode)) return undefined;
  return normalizeOrderBundleBodyPart(bodyPart, options);
};

const normalizeOrderEntityValue = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return resolveCanonicalOrcaOrderEntity(trimmed) ?? trimmed;
};

const normalizeOptionalText = (value?: string | null) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const validateOperationClassCode = (operation: OrderBundleOperation) => {
  if (operation.operation === 'delete') return null;
  const canonicalEntity = normalizeOrderEntityValue(operation.entity) ?? 'treatmentOrder';
  const normalizedClassCode = normalizeOrcaClassCode(operation.classCode);
  if (canonicalEntity === 'otherOrder') {
    return normalizedClassCode ? 'otherOrder は classCode を受け付けません。' : null;
  }
  if ((requiresOrcaClassCode(canonicalEntity) || isChargeEntity(canonicalEntity)) && !normalizedClassCode) {
    return `${canonicalEntity} は classCode が必須です。`;
  }
  if (!normalizedClassCode) return null;
  if (isChargeEntity(canonicalEntity)) {
    return isChargeClassCompatible(canonicalEntity, normalizedClassCode)
      ? null
      : `${canonicalEntity} は charge catalog の exact classCode のみ保存できます。`;
  }
  if (isOrcaEntityClassAllowed(canonicalEntity, normalizedClassCode)) {
    return null;
  }
  const allowlist = getAllowedClassCodesForEntity(canonicalEntity);
  return allowlist.length > 0
    ? `${canonicalEntity} は exact allowlist（${allowlist.join('/')}）のみ保存できます。`
    : `${canonicalEntity} の classCode は保存契約外です。`;
};

const normalizeOtherOrderItemCode = (entity?: string | null, code?: string | null) => {
  const normalizedEntity = normalizeOrderEntityValue(entity);
  const normalizedCode = normalizeOptionalText(code);
  if (normalizedEntity !== 'otherOrder') {
    return normalizedCode;
  }
  return normalizedCode && isOtherOrderLocalOnlyCode(normalizedCode) ? normalizedCode : undefined;
};

const hasUnsupportedSelectionCommentParameter = (item?: OrderBundleItem | null) => {
  if (!item) return false;
  const fields = resolveOrcaOrderItemFields(item);
  return Boolean(
    item.selectionCommentItemNumber?.trim() ||
      item.selectionCommentItemNumberBranch?.trim() ||
      fields.itemNumber?.trim() ||
      fields.itemNumberBranch?.trim(),
  );
};

const hasUnsupportedSelectionCommentParameterInOperation = (operation?: OrderBundleOperation | null) =>
  [
    ...(operation?.items ?? []),
    ...(operation?.materialItems ?? []),
    ...(operation?.commentItems ?? []),
  ].some((item) => hasUnsupportedSelectionCommentParameter(item));

const normalizeOrderBundle = (bundle: OrderBundle): OrderBundle => {
  const canonicalBundle = canonicalizeChargeBundleMeta(bundle);
  return {
    ...canonicalBundle,
    entity: normalizeOrderEntityValue(canonicalBundle.entity),
    bacteria: normalizeBacteriaOrderMetadata(canonicalBundle.bacteria),
    bodyPart: normalizeOrderBundleBodyPartForEntity(canonicalBundle.entity, canonicalBundle.classCode, canonicalBundle.bodyPart, {
      dropInvalid: true,
    }),
    className: normalizeOrderBundleClassName(
      canonicalBundle.entity,
      canonicalBundle.classCode,
      canonicalBundle.className,
    ),
    items: (canonicalBundle.items ?? []).map((item) => {
      const fields = resolveOrcaOrderItemFields(item);
      return {
        ...item,
        code: normalizeOtherOrderItemCode(canonicalBundle.entity, item.code),
        memo: fields.memoText,
        genericFlg: fields.genericFlg,
        userComment: fields.userComment,
        rowRole: fields.rowRole,
        rowSubtype: fields.rowSubtype,
        category: fields.category,
        masterCategory: fields.masterCategory,
        itemNumber: fields.itemNumber,
        itemNumberBranch: fields.itemNumberBranch,
        selectionCommentItemNumber: normalizeOptionalText(item.selectionCommentItemNumber ?? fields.itemNumber),
        selectionCommentItemNumberBranch: normalizeOptionalText(
          item.selectionCommentItemNumberBranch ?? fields.itemNumberBranch,
        ),
      };
    }),
    materialItems: (canonicalBundle.materialItems ?? []).map((item) => {
      const fields = resolveOrcaOrderItemFields(item);
      return {
        ...item,
        code: normalizeOtherOrderItemCode(canonicalBundle.entity, item.code),
        memo: fields.memoText,
        genericFlg: fields.genericFlg,
        userComment: fields.userComment,
        rowRole: fields.rowRole,
        rowSubtype: fields.rowSubtype,
        category: fields.category,
        masterCategory: fields.masterCategory,
        itemNumber: fields.itemNumber,
        itemNumberBranch: fields.itemNumberBranch,
        selectionCommentItemNumber: normalizeOptionalText(item.selectionCommentItemNumber ?? fields.itemNumber),
        selectionCommentItemNumberBranch: normalizeOptionalText(
          item.selectionCommentItemNumberBranch ?? fields.itemNumberBranch,
        ),
      };
    }),
    commentItems: (canonicalBundle.commentItems ?? []).map((item) => {
      const fields = resolveOrcaOrderItemFields(item);
      return {
        ...item,
        code: normalizeOtherOrderItemCode(canonicalBundle.entity, item.code),
        memo: fields.memoText,
        genericFlg: fields.genericFlg,
        userComment: fields.userComment,
        rowRole: fields.rowRole,
        rowSubtype: fields.rowSubtype,
        category: fields.category,
        masterCategory: fields.masterCategory,
        itemNumber: fields.itemNumber,
        itemNumberBranch: fields.itemNumberBranch,
        selectionCommentItemNumber: normalizeOptionalText(item.selectionCommentItemNumber ?? fields.itemNumber),
        selectionCommentItemNumberBranch: normalizeOptionalText(
          item.selectionCommentItemNumberBranch ?? fields.itemNumberBranch,
        ),
      };
    }),
  };
};

const normalizeOrderBundleOperation = (operation: OrderBundleOperation): OrderBundleOperation => {
  const shouldCanonicalizeCharge = normalizeOrcaClassCode(operation.classCode) != null;
  const canonicalOperation = shouldCanonicalizeCharge ? canonicalizeChargeBundleMeta(operation) : operation;
  return {
    ...canonicalOperation,
    entity: normalizeOrderEntityValue(canonicalOperation.entity),
    bacteria: normalizeBacteriaOrderMetadata(canonicalOperation.bacteria),
    bodyPart: normalizeOrderBundleBodyPartForEntity(canonicalOperation.entity, canonicalOperation.classCode, canonicalOperation.bodyPart),
    className: normalizeOrderBundleClassName(
      canonicalOperation.entity,
      canonicalOperation.classCode,
      canonicalOperation.className,
    ),
    items: (canonicalOperation.items ?? []).map((item) => {
      const fields = resolveOrcaOrderItemFields(item);
      return {
        ...item,
        code: normalizeOtherOrderItemCode(canonicalOperation.entity, item.code),
        memo: fields.memoText,
        genericFlg: fields.genericFlg,
        userComment: fields.userComment,
        rowRole: fields.rowRole,
        rowSubtype: fields.rowSubtype,
        category: fields.category,
        masterCategory: fields.masterCategory,
        itemNumber: fields.itemNumber,
        itemNumberBranch: fields.itemNumberBranch,
        selectionCommentItemNumber: normalizeOptionalText(item.selectionCommentItemNumber ?? fields.itemNumber),
        selectionCommentItemNumberBranch: normalizeOptionalText(
          item.selectionCommentItemNumberBranch ?? fields.itemNumberBranch,
        ),
      };
    }),
    materialItems: (canonicalOperation.materialItems ?? []).map((item) => {
      const fields = resolveOrcaOrderItemFields(item);
      return {
        ...item,
        code: normalizeOtherOrderItemCode(canonicalOperation.entity, item.code),
        memo: fields.memoText,
        genericFlg: fields.genericFlg,
        userComment: fields.userComment,
        rowRole: fields.rowRole,
        rowSubtype: fields.rowSubtype,
        category: fields.category,
        masterCategory: fields.masterCategory,
        itemNumber: fields.itemNumber,
        itemNumberBranch: fields.itemNumberBranch,
        selectionCommentItemNumber: normalizeOptionalText(item.selectionCommentItemNumber ?? fields.itemNumber),
        selectionCommentItemNumberBranch: normalizeOptionalText(
          item.selectionCommentItemNumberBranch ?? fields.itemNumberBranch,
        ),
      };
    }),
    commentItems: (canonicalOperation.commentItems ?? []).map((item) => {
      const fields = resolveOrcaOrderItemFields(item);
      return {
        ...item,
        code: normalizeOtherOrderItemCode(canonicalOperation.entity, item.code),
        memo: fields.memoText,
        genericFlg: fields.genericFlg,
        userComment: fields.userComment,
        rowRole: fields.rowRole,
        rowSubtype: fields.rowSubtype,
        category: fields.category,
        masterCategory: fields.masterCategory,
        itemNumber: fields.itemNumber,
        itemNumberBranch: fields.itemNumberBranch,
        selectionCommentItemNumber: normalizeOptionalText(item.selectionCommentItemNumber ?? fields.itemNumber),
        selectionCommentItemNumberBranch: normalizeOptionalText(
          item.selectionCommentItemNumberBranch ?? fields.itemNumberBranch,
        ),
      };
    }),
  };
};

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
  const response = await httpFetch(`/api/local/order/bundles?patientId=${encodeURIComponent(params.patientId)}${query.toString() ? `&${query.toString()}` : ''}`);
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
  const normalizedOperations = params.operations.map(normalizeOrderBundleOperation);
  const classCodeValidationError = normalizedOperations
    .map(validateOperationClassCode)
    .find((message): message is string => Boolean(message));
  if (classCodeValidationError) {
    return {
      ok: false,
      runId,
      message: classCodeValidationError,
    };
  }
  if (normalizedOperations.some((operation) => hasUnsupportedSelectionCommentParameterInOperation(operation))) {
    return {
      ok: false,
      runId,
      message: '選択式コメントの itemNumber / branch は未対応のため保存できません。パラメータ不要のコメントのみ選択してください。',
    };
  }
  const operationsWithMutationIds = normalizedOperations.map((operation, index) => ({
    ...operation,
    clientMutationId: operation.clientMutationId ?? `${runId}:order-bundle:${index}`,
  }));
  const response = await httpFetch('/api/local/order/bundles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: params.patientId,
      operations: operationsWithMutationIds,
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
