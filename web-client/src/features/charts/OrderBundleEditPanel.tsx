import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logAuditEvent, logUiState } from '../../libs/audit/auditLogger';
import { httpFetch } from '../../libs/http/httpClient';
import { recordOutpatientFunnel } from '../../libs/telemetry/telemetryClient';
import { ensureObservabilityMeta, resolveAriaLive } from '../../libs/observability/observability';
import { useOptionalSession } from '../../AppRouter';
import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import {
  fetchOrderBundles,
  mutateOrderBundles,
  normalizeOrderBundleBodyPart,
  type OrderBundle,
  type OrderBundleBodyPart,
  type OrderBundleItem,
} from './orderBundleApi';
import {
  getOrcaClaimSendEntryForRow,
  type OrcaClaimSendCacheMatch,
  type OrcaMedicalWarningUi,
} from './orcaClaimSendCache';
import {
  fetchOrderMasterSearch,
  type OrderMasterSearchItem,
  type OrderMasterSearchResult,
  type OrderMasterSearchType,
} from './orderMasterSearchApi';
import {
  fetchOrcaOrderInputSetDetail,
  fetchOrcaOrderInputSets,
  type OrcaOrderInputSetSummary,
} from './orcaOrderInputSetApi';
import { fetchOrcaMedicationGet } from './orcaMedicationGetApi';
import { resolveOrcaOrderItemFields } from './orcaOrderItemMeta';
import {
  fetchOrderRecommendations,
  type OrderRecommendationCandidate,
  type OrderRecommendationTemplate,
} from './orderRecommendationApi';
import {
  collectInjectionBundleContractIssues,
  collectOrderBundleContractStats,
  hasOrderBundleRowValue,
  isStandaloneSurgeryClassCode,
  isOrderBundleCommentCode,
  ORDER_BUNDLE_BODY_PART_CODE_PREFIX,
  resolveOrderBundleItemRowRole,
  shouldTreatAsMaterialItem,
} from './orderBundleContract';
import { isOtherOrderLocalOnlyCode } from './otherOrderContract';
import {
  resolveOrcaAdminMemoLocalOnlyHelp,
  resolveOrcaInstructionLocalOnlyHelp,
  resolveOrcaItemMemoLocalOnlyHelp,
  resolveOrcaMemoLocalOnlyHelp,
  resolveOrcaSendContractNote,
  resolveOrcaUsageLocalOnlyHelp,
} from './orcaSendabilityPolicy';
import {
  buildRpRequiredEditorMessage,
  resolveRpRequiredIssue,
  resolveRpRequiredFieldLabel,
  RP_REQUIRED_ERROR_LABEL,
  type RpRequiredField,
} from './orderRpRequirements';
import {
  isChargeClassCompatible,
  isChargeEntity,
  isChargeItemCategoryCompatible,
  resolveCanonicalChargeClassMeta,
  resolveChargeClassMetaFromItemCategory,
  resolveCanonicalOrderEntity,
  resolveChargeEntityFromClassCode,
  resolveOrderEntityDefaultClassMeta,
  resolveOrderEntityEtensuCategory,
  resolveOrderEntityPhysiologySendContractGuidance,
  resolveOrderEntityUsageUiCopy,
  resolveOrderEntityTestSubtypeConfig,
  resolveOrderEntityUiProfile,
  resolveOrderEntityValidationRule,
  normalizeOrderTestSubtype,
  type OrderTestSubtype,
} from './orderCategoryRegistry';
import type { DataSourceTransition } from './authService';
import type { DocumentOpenRequest } from './DocumentCreatePanel';
import { canonicalizeChargeBundleMeta } from './orderChargeClassSupport';
import {
  getAllowedClassCodesForEntity,
  isAuxiliaryMaterialCode,
  isOrcaEntityClassAllowed,
  supportsOrcaBodyPartField,
} from './orcaMedicalClassCatalog';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';

export type OrderBundleEditPanelMeta = {
  runId?: string;
  cacheHit?: boolean;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  dataSourceTransition?: DataSourceTransition;
  patientId?: string;
  encounterId?: string;
  scheduleKey?: string;
  appointmentId?: string;
  receptionId?: string;
  visitDate?: string;
  actorRole?: string;
  readOnly?: boolean;
  readOnlyReason?: string;
};

export type OrderBundleEditPanelRequest =
  | { requestId: string; kind: 'new' }
  | { requestId: string; kind: 'edit'; bundle: OrderBundle }
  | { requestId: string; kind: 'copy'; bundle: OrderBundle }
  | { requestId: string; kind: 'recommendation'; candidate: OrderRecommendationCandidate }
  | { requestId: string; kind: 'orca-set'; candidate: OrcaOrderInputSetSummary }
  | { requestId: string; kind: 'input-set'; candidate: OrcaOrderInputSetSummary };

export type OrderBundleEditPanelProps = {
  patientId?: string;
  entity: string;
  title: string;
  bundleLabel: string;
  itemQuantityLabel: string;
  meta: OrderBundleEditPanelMeta;
  readOnlyPreview?: boolean;
  instanceKey?: string;
  variant?: 'utility' | 'embedded';
  bundlesOverride?: OrderBundle[];
  onOpenDocument?: (request: DocumentOpenRequest) => void;
  historyCopyRequest?: { requestId: string; bundle: OrderBundle } | null;
  onHistoryCopyConsumed?: (requestId: string) => void;
  request?: OrderBundleEditPanelRequest | null;
  onRequestConsumed?: (requestId: string) => void;
  onSubmitResult?: (result: { action: 'save' | 'expand' | 'expand_continue'; ok: boolean }) => void;
  onEditingContextChange?: (state: OrderBundleEditingContext) => void;
  onClose?: () => void;
  mutateBundles?: typeof mutateOrderBundles;
};

export type OrderBundleEditingContext = {
  hasRpRequiredIssue: boolean;
  rpRequiredMissing: RpRequiredField[];
};

type PrescriptionLocation = 'in' | 'out';
type PrescriptionTiming = 'regular' | 'tonyo' | 'gaiyo';

type BundleFormState = {
  documentId?: number;
  moduleId?: number;
  bundleName: string;
  admin: string;
  adminMemo: string;
  adminCode: string;
  adminCodeSystem?: string;
  bundleNumber: string;
  sourceSetCode?: string;
  subtype: OrderTestSubtype | '';
  classCode?: string;
  classCodeSystem?: string;
  className?: string;
  memo: string;
  startDate: string;
  prescriptionLocation: PrescriptionLocation;
  prescriptionTiming: PrescriptionTiming;
  items: OrderBundleItem[];
  materialItems: OrderBundleItem[];
  commentItems: OrderBundleItem[];
  bodyPart?: OrderBundleBodyPart | null;
};

type OrderBundleSubmitAction = 'save' | 'expand' | 'expand_continue';

type OrderBundleSubmitPayload = {
  form: BundleFormState;
  action: OrderBundleSubmitAction;
};

type BundleValidationIssue = {
  key: string;
  message: string;
};

const CHARGE_CONSISTENCY_ISSUE_KEYS = new Set([
  'invalid_charge_class_code',
  'missing_charge_item_category',
  'invalid_charge_item_category',
  'missing_charge_class_name',
  'invalid_charge_class_name',
]);

const isChargeConsistencyIssueKey = (key: string) => CHARGE_CONSISTENCY_ISSUE_KEYS.has(key);
const INJECTION_UNCODED_MAIN_ROW_MESSAGE = 'マスタ候補から薬剤/手技を選択してください。';
const INJECTION_UNCODED_MATERIAL_ROW_MESSAGE = 'マスタ候補から材料を選択してください。';

type UsageMasterMeta = {
  code?: string;
  label: string;
  timingCode?: string;
  routeCode?: string;
  daysLimit?: number;
  dosePerDay?: number;
  youhouCode?: string;
};

type SelectionCommentCandidate = {
  code: string;
  name: string;
  category?: string;
  itemNumber?: string;
  itemNumberBranch?: string;
};

type ContraindicationCheckMedication = {
  medicationCode: string;
  medicationName?: string;
};

type ContraindicationCheckResult = {
  ok: boolean;
  apiOk?: boolean;
  status: number;
  apiResult?: string;
  apiResultMessage?: string;
  informationDate?: string;
  informationTime?: string;
  results: Array<{
    medicationCode?: string;
    medicationName?: string;
    medicalResult?: string;
    medicalResultMessage?: string;
    warnings: Array<{
      contraCode?: string;
      contraName?: string;
      interactCode?: string;
      administerDate?: string;
      contextClass?: string;
    }>;
  }>;
  symptomInfo: Array<{
    code?: string;
    content?: string;
    detail?: string;
  }>;
  message?: string;
  runId?: string;
  traceId?: string;
};

type BundleValidationRule = {
  itemLabel: string;
  requiresItems: boolean;
  requiresUsage: boolean;
  requiresBodyPart: boolean;
};

type ContraindicationNotice = { tone: 'info' | 'warning' | 'error'; message: string; detail?: string };

type OrderBundleItemWithRowId = OrderBundleItem & { rowId?: string };
type RecentUsageStorageScope = { facilityId?: string; userId?: string };

let rowIdSequence = 0;

const createRowId = () => {
  rowIdSequence += 1;
  return `${Date.now().toString(36)}-${rowIdSequence.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const ensureRowId = (item: OrderBundleItem): OrderBundleItemWithRowId => ({
  ...item,
  rowId: (item as OrderBundleItemWithRowId).rowId ?? createRowId(),
});

const stripRowMeta = (item: OrderBundleItem): OrderBundleItem => {
  const rest = { ...(item as OrderBundleItemWithRowId) };
  delete rest.rowId;
  const resolvedItemFields = resolveOrcaOrderItemFields(rest);
  rest.memo = resolvedItemFields.memoText;
  if (resolvedItemFields.genericFlg) {
    rest.genericFlg = resolvedItemFields.genericFlg;
  } else {
    delete rest.genericFlg;
  }
  if (resolvedItemFields.userComment) {
    rest.userComment = resolvedItemFields.userComment;
  } else {
    delete rest.userComment;
  }
  return rest;
};

const buildEmptyItem = (): OrderBundleItem => ensureRowId({ name: '', quantity: '', unit: '', memo: '' });

const normalizeItemForForm = (entity: string | undefined, item: OrderBundleItem): OrderBundleItem => {
  const canonicalEntity = resolveCanonicalOrderEntity(entity) ?? entity ?? '';
  const resolvedItemFields = resolveOrcaOrderItemFields(item);
  if (canonicalEntity !== 'injectionOrder') {
    return {
      ...item,
      genericFlg: resolvedItemFields.genericFlg,
      userComment: resolvedItemFields.userComment,
    };
  }
  const fallbackComment = resolvedItemFields.userComment?.trim() || resolvedItemFields.memoText?.trim() || undefined;
  return {
    ...item,
    memo: resolvedItemFields.memoText?.trim() ? resolvedItemFields.memoText : undefined,
    genericFlg: resolvedItemFields.genericFlg,
    userComment: fallbackComment,
  };
};

const hasOrderBundleItemValue = (item: OrderBundleItem) => hasOrderBundleRowValue(item);

const resolveChargeSelectionClassMeta = (entity: string, item?: Pick<OrderMasterSearchItem, 'category'> | null) => {
  const itemCategory = normalizeChargeMasterCategory(item?.category);
  if (!isChargeEntity(entity)) return null;
  if (!itemCategory || !isChargeItemCategoryCompatible(entity, itemCategory)) return null;
  return resolveChargeClassMetaFromItemCategory(entity, itemCategory) ?? null;
};

const isUnsupportedChargeSelection = (entity: string, item?: Pick<OrderMasterSearchItem, 'category'> | null) =>
  isChargeEntity(entity) && !resolveChargeSelectionClassMeta(entity, item);

const resolveChargeItemMasterCategory = (
  entity: string,
  item?: Pick<OrderBundleItem, 'masterCategory' | 'category'> | null,
) => {
  if (!isChargeEntity(entity)) return undefined;
  const explicitMasterCategory = normalizeChargeMasterCategory(item?.masterCategory);
  if (explicitMasterCategory) return explicitMasterCategory;
  const explicitCategory = normalizeChargeMasterCategory(item?.category);
  if (explicitCategory) return explicitCategory;
  return undefined;
};

const ensureTrailingEmptyMainItem = (items: OrderBundleItem[]): OrderBundleItemWithRowId[] => {
  if (items.length === 0) return [buildEmptyItem()];
  let changed = false;
  const rows = items.map((item) => {
    const currentRowId = (item as OrderBundleItemWithRowId).rowId;
    const ensured = ensureRowId(item);
    if (ensured.rowId !== currentRowId) changed = true;
    return ensured;
  });
  if (hasOrderBundleItemValue(rows[rows.length - 1])) {
    rows.push(buildEmptyItem());
    changed = true;
  }
  return changed ? rows : (items as OrderBundleItemWithRowId[]);
};

const formatItemQuantitySummary = (item: OrderBundleItem, quantityLabel: string) => {
  const quantity = item.quantity?.trim() ?? '';
  const unit = item.unit?.trim() ?? '';
  if (!quantity && !unit) return `${quantityLabel}: 未入力`;
  return `${quantityLabel}: ${[quantity, unit].filter(Boolean).join(' ')}`;
};

const safeScrollIntoView = (el: HTMLElement, options?: ScrollIntoViewOptions) => {
  if (typeof el.scrollIntoView !== 'function') return;
  el.scrollIntoView(options);
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [delayMs, value]);
  return debounced;
}

const MIXING_COMMENT_MARKER = '__mixing_comment__';
const DOCUMENT_ITEM_KEYWORDS = ['文書', '診断書', '紹介状', '返信', '報告', '証明書', '意見書', '指示書'];
const DEFAULT_PRESCRIPTION_LOCATION: PrescriptionLocation = 'out';
const DEFAULT_PRESCRIPTION_TIMING: PrescriptionTiming = 'regular';
const PRESCRIPTION_CLASS_CODE_SYSTEM = 'Claim007';
const PRESCRIPTION_CLASS_CODES: Record<PrescriptionTiming, Record<PrescriptionLocation, string>> = {
  regular: { in: '211', out: '212' },
  tonyo: { in: '221', out: '222' },
  gaiyo: { in: '231', out: '232' },
};
const PRESCRIPTION_LABELS: Record<PrescriptionTiming, Record<PrescriptionLocation, string>> = {
  regular: { in: '内用（院内処方）', out: '内用（院外処方）' },
  tonyo: { in: '頓用（院内処方）', out: '頓用（院外処方）' },
  gaiyo: { in: '外用（院内処方）', out: '外用（院外処方）' },
};
const PRESCRIPTION_CLASS_NAMES: Record<string, string> = {
  '211': '内服薬剤（院内処方）',
  '212': '内服薬剤（院外処方）',
  '221': '頓服薬剤（院内処方）',
  '222': '頓服薬剤（院外処方）',
  '231': '外用薬剤（院内処方）',
  '232': '外用薬剤（院外処方）',
};
const PRESCRIPTION_LOCATION_OPTIONS: Array<{ value: PrescriptionLocation; label: string }> = [
  { value: 'in', label: '院内' },
  { value: 'out', label: '院外' },
];
const PRESCRIPTION_TIMING_OPTIONS: Array<{ value: PrescriptionTiming; label: string }> = [
  { value: 'regular', label: '内服' },
  { value: 'tonyo', label: '頓用' },
  { value: 'gaiyo', label: '外用' },
];
const USAGE_SELECT_FETCH_SIZE = 300;
const MAX_USAGE_SELECT_OPTIONS = 300;
const PREDICTIVE_FETCH_PAGE_SIZE = 2000;
const PAGINATED_MASTER_SEARCH_TYPES = new Set<OrderMasterSearchType>([
  'drug',
  'generic-class',
  'comment',
  'bodypart',
  'etensu',
]);
const RECENT_USAGE_STORAGE_PREFIX = 'charts-order-recent-usage';
const RECENT_USAGE_MAX = 10;
const USAGE_DAYS_LIMIT_ERROR_KEY = 'usage_days_limit_exceeded';
const USAGE_TIMING_LABELS: Record<string, string> = {
  '01': '朝',
  '02': '昼',
  '03': '夕',
  '04': '眠前',
  '05': '毎食後',
  '06': '毎食前',
  '07': '食間',
};
const USAGE_ROUTE_CLASSIFICATION_TABLE: Record<string, { label: string; injectionPriority: number }> = {
  IV: { label: '静注', injectionPriority: 10 },
  DIV: { label: '点滴', injectionPriority: 20 },
  DRIP: { label: '点滴', injectionPriority: 20 },
  IM: { label: '筋注', injectionPriority: 30 },
  SC: { label: '皮下注', injectionPriority: 40 },
  IA: { label: '動注', injectionPriority: 50 },
  IT: { label: '髄注', injectionPriority: 60 },
  IH: { label: '吸入', injectionPriority: 70 },
  PO: { label: '内服', injectionPriority: 80 },
  TOP: { label: '外用', injectionPriority: 90 },
};
const UNKNOWN_USAGE_ROUTE_CLASSIFICATION = { label: '未分類', injectionPriority: 999 };
const UNSUPPORTED_COMMENT_PARAMETER_MESSAGE =
  '選択式コメントの itemNumber / branch は未対応のため追加できません。パラメータ不要のコメントのみ選択してください。';
const buildUnsupportedChargeSelectionMessage = (entity: string) =>
  entity === 'baseChargeOrder'
    ? 'baseChargeOrder では 110〜125 の算定項目のみ選択できます。'
    : 'instractionChargeOrder では 130〜150 の算定項目のみ選択できます。';
const isDrugMedicationCode = (code: string) => /^6\d{8}$/.test(code.trim());
const hasUnsupportedCommentSelectionParameter = (item?: {
  itemNumber?: string;
  itemNumberBranch?: string;
  selectionCommentItemNumber?: string;
  selectionCommentItemNumberBranch?: string;
}) =>
  Boolean(
    item?.selectionCommentItemNumber?.trim() ||
      item?.selectionCommentItemNumberBranch?.trim() ||
      item?.itemNumber?.trim() ||
      item?.itemNumberBranch?.trim(),
  );

const normalizeChargeMasterCategory = (category?: string | null) => {
  const trimmed = category?.trim();
  return trimmed && /^\d{3}$/.test(trimmed) ? trimmed : undefined;
};

const normalizePerformMonth = (value?: string) => {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length >= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
  }
  const trimmed = value.trim();
  return /^\d{4}-\d{2}$/.test(trimmed) ? trimmed : null;
};

const buildContraindicationDetails = (result: ContraindicationCheckResult) => {
  const details: string[] = [];
  result.results.forEach((item) => {
    const header = [item.medicationCode, item.medicationName].filter(Boolean).join(' ');
    const resultLine = [item.medicalResult, item.medicalResultMessage].filter(Boolean).join(' / ');
    const line = [header, resultLine].filter(Boolean).join(' - ');
    if (line) details.push(line);
    item.warnings.forEach((warning) => {
      const warningLine = [
        warning.contraCode,
        warning.contraName,
        warning.interactCode,
        warning.administerDate,
        warning.contextClass,
      ]
        .filter(Boolean)
        .join(' / ');
      if (warningLine) details.push(warningLine);
    });
  });
  result.symptomInfo.forEach((item) => {
    const line = [item.code, item.content, item.detail].filter(Boolean).join(' / ');
    if (line) details.push(line);
  });
  return details;
};

const fetchOrcaContraindicationCheck = async (params: {
  patientId?: string;
  performMonth?: string;
  medications?: ContraindicationCheckMedication[];
  requestNumber?: '01' | '02';
  checkTerm?: string;
}): Promise<ContraindicationCheckResult> => {
  const meta = ensureObservabilityMeta();
  const patientId = params.patientId?.trim();
  if (!patientId) {
    return {
      ok: false,
      status: 0,
      apiOk: false,
      results: [],
      symptomInfo: [],
      message: 'patientId が未解決のため患者別 ORCA 禁忌チェックを実行できません。',
      runId: meta.runId,
      traceId: meta.traceId,
    };
  }
  const performMonth = normalizePerformMonth(params.performMonth);
  if (!performMonth) {
    return {
      ok: false,
      status: 0,
      apiOk: false,
      results: [],
      symptomInfo: [],
      message: 'performMonth は YYYY-MM の診療月で指定してください。',
      runId: meta.runId,
      traceId: meta.traceId,
    };
  }
  const response = await httpFetch('/api/orca/official/chart-support/contraindication-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    notifySessionExpired: false,
    body: JSON.stringify({
      patientId,
      performMonth,
      requestNumber: params.requestNumber ?? '01',
      checkTerm: params.checkTerm ?? '1',
      medications: params.medications ?? [],
    }),
  });
  const parsed = await parseOrcaApiResponse(response, {
    fallbackMessage: '患者別 ORCA 禁忌チェックに失敗しました。',
  });
  const json = (parsed.json ?? {}) as Record<string, unknown>;
  const traceId =
    (typeof json.traceId === 'string' ? json.traceId : undefined) ??
    response.headers.get('x-trace-id') ??
    undefined;
  const results = Array.isArray(json.results)
    ? (json.results as Array<Record<string, unknown>>).map((item) => ({
        medicationCode: typeof item.medicationCode === 'string' ? item.medicationCode : undefined,
        medicationName: typeof item.medicationName === 'string' ? item.medicationName : undefined,
        medicalResult: typeof item.medicalResult === 'string' ? item.medicalResult : undefined,
        medicalResultMessage: typeof item.medicalResultMessage === 'string' ? item.medicalResultMessage : undefined,
        warnings: Array.isArray(item.warnings)
          ? (item.warnings as Array<Record<string, unknown>>).map((warning) => ({
              contraCode: typeof warning.contraCode === 'string' ? warning.contraCode : undefined,
              contraName: typeof warning.contraName === 'string' ? warning.contraName : undefined,
              interactCode: typeof warning.interactCode === 'string' ? warning.interactCode : undefined,
              administerDate: typeof warning.administerDate === 'string' ? warning.administerDate : undefined,
              contextClass: typeof warning.contextClass === 'string' ? warning.contextClass : undefined,
            }))
          : [],
      }))
    : [];
  const symptomInfo = Array.isArray(json.symptomInfo)
    ? (json.symptomInfo as Array<Record<string, unknown>>).map((item) => ({
        code: typeof item.code === 'string' ? item.code : undefined,
        content: typeof item.content === 'string' ? item.content : undefined,
        detail: typeof item.detail === 'string' ? item.detail : undefined,
      }))
    : [];
  return {
    ok: parsed.ok,
    apiOk: typeof json.apiOk === 'boolean' ? (json.apiOk as boolean) : undefined,
    status: parsed.status,
    apiResult: typeof json.apiResult === 'string' ? (json.apiResult as string) : undefined,
    apiResultMessage: typeof json.apiResultMessage === 'string' ? (json.apiResultMessage as string) : undefined,
    informationDate: typeof json.informationDate === 'string' ? (json.informationDate as string) : undefined,
    informationTime: typeof json.informationTime === 'string' ? (json.informationTime as string) : undefined,
    results,
    symptomInfo,
    message: parsed.message,
    runId: parsed.runId ?? meta.runId,
    traceId,
  };
};

const hasUnsupportedSelectionCommentParameterInItem = (item?: OrderBundleItem | null) => {
  if (!item) return false;
  const fields = resolveOrcaOrderItemFields(item);
  return hasUnsupportedCommentSelectionParameter(fields);
};

const parseDocumentIds = (value?: string) => {
  if (!value) return { documentId: undefined, letterId: undefined };
  const trimmed = value.trim();
  if (!trimmed) return { documentId: undefined, letterId: undefined };
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const documentId = typeof parsed.documentId === 'number' ? parsed.documentId : Number(parsed.documentId);
      const letterId = typeof parsed.letterId === 'number' ? parsed.letterId : Number(parsed.letterId);
      return {
        documentId: Number.isFinite(documentId) ? documentId : undefined,
        letterId: Number.isFinite(letterId) ? letterId : undefined,
      };
    } catch {
      // fall through
    }
  }
  const docMatch =
    trimmed.match(/documentId\s*[:=]\s*(\d+)/i) ??
    trimmed.match(/docId\s*[:=]\s*(\d+)/i) ??
    trimmed.match(/docPk\s*[:=]\s*(\d+)/i);
  const letterMatch = trimmed.match(/letterId\s*[:=]\s*(\d+)/i) ?? trimmed.match(/odletter\s*[:=]\s*(\d+)/i);
  return {
    documentId: docMatch ? Number(docMatch[1]) : undefined,
    letterId: letterMatch ? Number(letterMatch[1]) : undefined,
  };
};

const resolveDocumentOpenRequest = (bundle: OrderBundle, item: OrderBundleItem): DocumentOpenRequest | null => {
  const keywordHit = DOCUMENT_ITEM_KEYWORDS.some((keyword) => item.name?.includes(keyword));
  const memoSource = [item.memo, item.code].filter((value): value is string => Boolean(value && value.trim())).join(' ');
  const { documentId, letterId } = parseDocumentIds(memoSource);
  if (!keywordHit && !documentId && !letterId) return null;
  const resolvedDocumentId = documentId ?? (keywordHit ? bundle.documentId : undefined);
  return {
    intent: 'edit',
    documentId: resolvedDocumentId,
    letterId,
    query: item.name?.trim() || undefined,
    source: 'order-item',
  };
};

const countItems = (items?: OrderBundleItem[]) =>
  items ? items.filter((item) => item.name.trim().length > 0).length : 0;

const canEditInjectionGenericFlag = (entity?: string | null, item?: OrderBundleItem | null) => {
  const canonicalEntity = resolveCanonicalOrderEntity(entity) ?? entity;
  if (canonicalEntity !== 'injectionOrder') return false;
  if (resolveOrderBundleItemRowRole(entity, item) !== 'main') return false;
  return isDrugMedicationCode(item?.code?.trim() ?? '');
};

const splitBundleItems = (
  entity?: string | null,
  classCode?: string | null,
  items?: OrderBundleItem[],
  explicitBodyPart?: OrderBundleBodyPart,
) => {
  const normal: OrderBundleItem[] = [];
  const material: OrderBundleItem[] = [];
  const comment: OrderBundleItem[] = [];
  const explicit = explicitBodyPart?.name?.trim()
    ? {
        code: explicitBodyPart.code?.trim() || undefined,
        name: explicitBodyPart.name.trim(),
        quantity: explicitBodyPart.quantity?.trim() || undefined,
        unit: explicitBodyPart.unit?.trim() || undefined,
        memo: explicitBodyPart.memo?.trim() || undefined,
        rowRole: 'bodyPart' as const,
      }
    : null;
  (items ?? []).forEach((item) => {
    const rowRole = resolveOrderBundleItemRowRole(entity, item);
    if (rowRole === 'bodyPart') {
      return;
    }
    if (rowRole === 'material') {
      material.push({ ...item, rowRole: 'material' });
      return;
    }
    if (rowRole === 'comment') {
      comment.push({ ...item, rowRole: 'comment' });
      return;
    }
    normal.push({ ...item, rowRole: 'main' });
  });
  return {
    normal,
    material,
    comment,
    bodyPart: normalizeBundleBodyPartForEntity(entity, classCode, explicit) ?? null,
  };
};

const collectBundleItems = (form: BundleFormState) => {
  return [
    ...form.items.map((item) => ({ ...item, rowRole: 'main' as const })),
    ...form.materialItems.map((item) => ({ ...item, rowRole: 'material' as const })),
    ...form.commentItems.map((item) => ({ ...item, rowRole: 'comment' as const })),
  ];
};

const hasBundleBodyPartValue = (bodyPart?: OrderBundleBodyPart | null) =>
  Boolean(bodyPart?.name?.trim() || bodyPart?.code?.trim() || bodyPart?.quantity?.trim() || bodyPart?.unit?.trim() || bodyPart?.memo?.trim());

const normalizeBundleBodyPartForEntity = (
  entity: string | null | undefined,
  classCode: string | null | undefined,
  bodyPart?:
    | OrderBundleBodyPart
    | {
        code?: string;
        name?: string;
        quantity?: string;
        unit?: string;
        memo?: string;
        rowRole?: 'bodyPart';
      }
    | null,
): OrderBundleBodyPart | undefined => {
  if (!supportsOrcaBodyPartField(entity, classCode)) return undefined;
  return normalizeOrderBundleBodyPart(
    bodyPart
      ? {
          code: bodyPart.code?.trim() || undefined,
          name: bodyPart.name?.trim() || '',
          quantity: bodyPart.quantity?.trim() || undefined,
          unit: bodyPart.unit?.trim() || undefined,
          memo: bodyPart.memo?.trim() || undefined,
          rowRole: 'bodyPart',
        }
      : undefined,
    { dropInvalid: true },
  );
};

const buildMissingMainRowMessage = ({
  canonicalEntity,
  hasBodyPartValue,
  hasMaterialValue,
  hasCommentValue,
  hasAdminValue,
}: {
  canonicalEntity: string;
  hasBodyPartValue: boolean;
  hasMaterialValue: boolean;
  hasCommentValue: boolean;
  hasAdminValue: boolean;
}) => {
  if (canonicalEntity === 'injectionOrder') {
    return '投与指示・材料・コメント・部位だけでは保存できません。薬剤または手技のコード付き本体項目を1件以上入力してください。';
  }
  if (hasMaterialValue) {
    return '材料だけでは保存できません。コード付きの本体項目を入力してください。';
  }
  if (hasBodyPartValue) {
    return '部位だけでは保存できません。コード付きの本体項目を入力してください。';
  }
  if (hasCommentValue) {
    return 'コメントだけでは保存できません。コード付きの本体項目を入力してください。';
  }
  if (hasAdminValue) {
    return '指示だけでは保存できません。コード付きの本体項目を入力してください。';
  }
  return 'コード付きの本体項目を入力してください。';
};

const resolveOperationBodyPart = (entity: string, form: BundleFormState): OrderBundleBodyPart | undefined =>
  normalizeBundleBodyPartForEntity(entity, form.classCode, form.bodyPart);

const DEFAULT_VALIDATION_RULE: BundleValidationRule = {
  itemLabel: '項目',
  requiresItems: true,
  requiresUsage: false,
  requiresBodyPart: false,
};

const resolveFormSubtype = (entity: string, subtype?: string | null): OrderTestSubtype | '' => {
  if (!entity.trim()) {
    const normalized = subtype?.trim().toLowerCase();
    if (normalized === 'specimen' || normalized === 'physiology' || normalized === 'culture' || normalized === 'sensitivity') {
      return normalized;
    }
    return '';
  }
  return normalizeOrderTestSubtype(entity, subtype) ?? '';
};

const buildEmptyForm = (today: string): BundleFormState => ({
  bundleName: '',
  admin: '',
  adminMemo: '',
  adminCode: '',
  adminCodeSystem: undefined,
  bundleNumber: '1',
  sourceSetCode: undefined,
  subtype: '',
  classCode: undefined,
  classCodeSystem: undefined,
  className: undefined,
  memo: '',
  startDate: today,
  prescriptionLocation: DEFAULT_PRESCRIPTION_LOCATION,
  prescriptionTiming: DEFAULT_PRESCRIPTION_TIMING,
  items: [buildEmptyItem()],
  materialItems: [],
  commentItems: [],
  bodyPart: null,
});

const normalizeOptimisticText = (value?: string | null) => value?.trim() ?? '';

const normalizeOptimisticItems = (items?: OrderBundleItem[]) =>
  (items ?? []).map((item) => ({
    code: normalizeOptimisticText(item.code),
    name: normalizeOptimisticText(item.name),
    quantity: normalizeOptimisticText(item.quantity),
    unit: normalizeOptimisticText(item.unit),
    memo: normalizeOptimisticText(item.memo),
    rowRole: normalizeOptimisticText(item.rowRole),
    rowSubtype: normalizeOptimisticText(item.rowSubtype),
    category: normalizeOptimisticText(item.category),
    masterCategory: normalizeOptimisticText(item.masterCategory),
  }));

const normalizeOptimisticBodyPart = (bodyPart?: OrderBundleBodyPart) =>
  bodyPart
    ? {
        code: normalizeOptimisticText(bodyPart.code),
        name: normalizeOptimisticText(bodyPart.name),
        quantity: normalizeOptimisticText(bodyPart.quantity),
        unit: normalizeOptimisticText(bodyPart.unit),
        memo: normalizeOptimisticText(bodyPart.memo),
      }
    : null;

const buildOptimisticBundleKey = (bundle: OrderBundle) =>
  JSON.stringify({
    documentId: bundle.documentId ?? null,
    moduleId: bundle.moduleId ?? null,
    entity: normalizeOptimisticText(bundle.entity),
    bundleName: normalizeOptimisticText(bundle.bundleName),
    bundleNumber: normalizeOptimisticText(bundle.bundleNumber),
    subtype: normalizeOptimisticText(bundle.subtype),
    classCode: normalizeOptimisticText(bundle.classCode),
    classCodeSystem: normalizeOptimisticText(bundle.classCodeSystem),
    className: normalizeOptimisticText(bundle.className),
    admin: normalizeOptimisticText(bundle.admin),
    adminCode: normalizeOptimisticText(bundle.adminCode),
    adminCodeSystem: normalizeOptimisticText(bundle.adminCodeSystem),
    adminMemo: normalizeOptimisticText(bundle.adminMemo),
    memo: normalizeOptimisticText(bundle.memo),
    started: normalizeOptimisticText(bundle.started),
    items: normalizeOptimisticItems(bundle.items),
    materialItems: normalizeOptimisticItems(bundle.materialItems),
    commentItems: normalizeOptimisticItems(bundle.commentItems),
    bodyPart: normalizeOptimisticBodyPart(bundle.bodyPart),
  });

const isOptimisticBundleSynced = (fetched: OrderBundle, optimistic: OrderBundle) =>
  fetched.documentId === optimistic.documentId && buildOptimisticBundleKey(fetched) === buildOptimisticBundleKey(optimistic);

const applyDefaultClassMeta = (entity: string, form: BundleFormState): BundleFormState => {
  if (entity === 'medOrder') return form;
  if (form.classCode?.trim()) return form;
  const defaultClassMeta = resolveOrderEntityDefaultClassMeta(entity);
  if (!defaultClassMeta) return form;
  return {
    ...form,
    classCode: defaultClassMeta.classCode,
    classCodeSystem: PRESCRIPTION_CLASS_CODE_SYSTEM,
    className: defaultClassMeta.className,
  };
};

export const toFormState = (bundle: OrderBundle, today: string): BundleFormState => {
  const canonicalBundle = canonicalizeChargeBundleMeta(bundle);
  const { normal, material, comment, bodyPart } = splitBundleItems(
    canonicalBundle.entity,
    canonicalBundle.classCode,
    canonicalBundle.items,
    canonicalBundle.bodyPart,
  );
  const prescription = parsePrescriptionClassCode(canonicalBundle.classCode);
  return {
    documentId: canonicalBundle.documentId,
    moduleId: canonicalBundle.moduleId,
    bundleName: canonicalBundle.bundleName ?? '',
    admin: canonicalBundle.admin ?? '',
    adminMemo: canonicalBundle.adminMemo ?? '',
    adminCode: canonicalBundle.adminCode ?? '',
    adminCodeSystem: canonicalBundle.adminCodeSystem ?? undefined,
    bundleNumber: canonicalBundle.bundleNumber ?? '1',
    sourceSetCode: canonicalBundle.sourceSetCode,
    subtype: resolveFormSubtype(canonicalBundle.entity ?? '', canonicalBundle.subtype),
    classCode: canonicalBundle.classCode ?? undefined,
    classCodeSystem: canonicalBundle.classCodeSystem ?? undefined,
    className: canonicalBundle.className ?? undefined,
    memo: canonicalBundle.memo ?? '',
    startDate: canonicalBundle.started ?? today,
    prescriptionLocation: prescription.location,
    prescriptionTiming: prescription.timing,
    items: ensureTrailingEmptyMainItem(
      (normal.length > 0 ? normal : [buildEmptyItem()]).map((item) => normalizeItemForForm(canonicalBundle.entity, item)),
    ),
    materialItems: material.map((item) => ensureRowId(normalizeItemForForm(canonicalBundle.entity, item))),
    commentItems: comment.map((item) => ensureRowId(normalizeItemForForm(canonicalBundle.entity, item))),
    bodyPart,
  };
};

const toFormStateFromHistoryCopy = (bundle: OrderBundle, today: string): BundleFormState => {
  const base = toFormState(bundle, today);
  return {
    ...base,
    documentId: undefined,
    moduleId: undefined,
    startDate: today,
  };
};

export const toFormStateFromRecommendation = (
  entity: string,
  template: OrderRecommendationTemplate,
  today: string,
): BundleFormState => {
  const chargeClassMeta = resolveCanonicalChargeClassMeta({
    entity,
    classCode: template.classCode,
    itemCategory: template.items.find((item) => item.name?.trim() || item.code?.trim())?.masterCategory,
  });
  return {
    bundleName: template.bundleName,
    admin: template.admin,
    adminMemo: template.adminMemo ?? '',
    adminCode: template.adminCode ?? '',
    adminCodeSystem: template.adminCodeSystem ?? undefined,
    bundleNumber: template.bundleNumber || '1',
    subtype: resolveFormSubtype('', template.subtype),
    classCode: chargeClassMeta?.classCode ?? template.classCode ?? undefined,
    classCodeSystem: chargeClassMeta ? PRESCRIPTION_CLASS_CODE_SYSTEM : template.classCodeSystem ?? undefined,
    className: chargeClassMeta?.className ?? template.className ?? undefined,
    memo: template.memo,
    startDate: today,
    prescriptionLocation: template.prescriptionLocation ?? DEFAULT_PRESCRIPTION_LOCATION,
    prescriptionTiming: template.prescriptionTiming ?? DEFAULT_PRESCRIPTION_TIMING,
    items: ensureTrailingEmptyMainItem(
      template.items.length > 0 ? template.items.map((item) => ensureRowId({ ...item })) : [buildEmptyItem()],
    ),
    materialItems: template.materialItems.map((item) => ensureRowId({ ...item })),
    commentItems: template.commentItems.map((item) => ({ ...item })),
    bodyPart: template.bodyPart ? { ...template.bodyPart } : null,
  };
};

const isBundleFormEmpty = (form: BundleFormState) => {
  const bundleNumber = form.bundleNumber.trim();
  const hasBundleNumber = bundleNumber.length > 0 && bundleNumber !== '1';
  return (
    !form.bundleName.trim() &&
    !form.admin.trim() &&
    !hasBundleNumber &&
    !form.memo.trim() &&
    !form.bodyPart?.name?.trim() &&
    form.items.every((item) => !hasOrderBundleItemValue(item)) &&
    form.commentItems.every((item) => !hasOrderBundleItemValue(item)) &&
    form.materialItems.every((item) => !hasOrderBundleItemValue(item))
  );
};

const toOrderBundleFromInputSetDetail = (
  bundle: NonNullable<Awaited<ReturnType<typeof fetchOrcaOrderInputSetDetail>>['bundle']>,
  entity: string,
): OrderBundle => {
  const inputSetEntity = resolveCanonicalOrderEntity(bundle.entity) ?? resolveCanonicalOrderEntity(entity) ?? entity;
  const requestedEntity = resolveCanonicalOrderEntity(entity) ?? entity;
  const classCode = bundle.classCode?.trim() ?? '';
  const resolvedEntity =
    classCode.startsWith('6') && (requestedEntity === 'physiologyOrder' || requestedEntity === 'bacteriaOrder')
      ? requestedEntity
      : inputSetEntity;
  const canonicalBundle = canonicalizeChargeBundleMeta({
    entity: resolvedEntity,
    bundleName: bundle.bundleName ?? '',
    bundleNumber: bundle.bundleNumber ?? '1',
    sourceSetCode: bundle.sourceSetCode,
    subtype: resolveFormSubtype(resolvedEntity, bundle.subtype),
    classCode: bundle.classCode,
    classCodeSystem: bundle.classCodeSystem,
    className: bundle.className,
    admin: bundle.admin ?? '',
    adminMemo: bundle.adminMemo ?? '',
    adminCode: bundle.adminCode ?? '',
    adminCodeSystem: bundle.adminCodeSystem ?? undefined,
    memo: bundle.memo ?? '',
    started: bundle.started,
    bodyPart: normalizeBundleBodyPartForEntity(resolvedEntity, bundle.classCode, bundle.bodyPart),
  });
  return {
    ...canonicalBundle,
    items: bundle.items.map((item) => ({
      code: item.code,
      name: item.name ?? '',
      quantity: item.quantity,
      unit: item.unit,
      memo: item.memo,
      genericFlg: item.genericFlg,
      userComment: item.userComment,
      category: item.category,
      masterCategory: resolveChargeItemMasterCategory(resolvedEntity, item) ?? item.masterCategory,
      itemNumber: item.itemNumber,
      itemNumberBranch: item.itemNumberBranch,
      rowSubtype: item.rowSubtype,
      rowRole:
        item.rowRole === 'main' || item.rowRole === 'material' || item.rowRole === 'comment'
          ? item.rowRole
          : undefined,
    })),
  };
};

const matchesOrcaInputSetEntity = (
  requestedEntity?: string | null,
  bundleEntity?: string | null,
  classCode?: string | null,
) => {
  const normalizedRequested = resolveCanonicalOrderEntity(requestedEntity ?? '') ?? requestedEntity?.trim() ?? '';
  const normalizedBundle = resolveCanonicalOrderEntity(bundleEntity ?? '') ?? bundleEntity?.trim() ?? '';
  const chargeEntityFromClassCode = resolveChargeEntityFromClassCode(classCode);
  const effectiveBundleEntity = chargeEntityFromClassCode ?? normalizedBundle;
  if (!normalizedRequested || !effectiveBundleEntity) return true;
  if (normalizedRequested === effectiveBundleEntity) return true;
  const normalizedClassCode = classCode?.trim() ?? '';
  return (
    normalizedClassCode.startsWith('6') &&
    effectiveBundleEntity === 'testOrder' &&
    (normalizedRequested === 'physiologyOrder' || normalizedRequested === 'bacteriaOrder')
  );
};

const resolveRecommendationLabel = (candidate: OrderRecommendationCandidate) => {
  const bundle = candidate.template.bundleName.trim();
  const firstItem = candidate.template.items.find((item) => item.name.trim())?.name.trim() ?? '';
  const base = bundle || firstItem || '名称未設定';
  const usage = candidate.template.admin.trim();
  return usage ? `${base} / ${usage}` : base;
};

const formatBundleName = (bundle: OrderBundle) => bundle.bundleName ?? '名称未設定';
const formatMasterLabel = (item: OrderMasterSearchItem) => (item.code ? `${item.code} ${item.name}` : item.name);
const formatUsageLabel = (item: OrderMasterSearchItem) => item.name;
const normalizeUsageCode = (value?: string | null) => {
  const normalized = value?.trim().toUpperCase();
  return normalized || '';
};
const resolveUsageTimingLabel = (timingCode?: string) => {
  const code = timingCode?.trim();
  if (!code) return '未設定';
  return USAGE_TIMING_LABELS[code] ?? `コード:${code}`;
};
const resolveUsageRouteClassification = (routeCode?: string) => {
  const code = normalizeUsageCode(routeCode);
  if (!code) return { ...UNKNOWN_USAGE_ROUTE_CLASSIFICATION, code: '' };
  const classified = USAGE_ROUTE_CLASSIFICATION_TABLE[code];
  if (classified) return { ...classified, code };
  return { ...UNKNOWN_USAGE_ROUTE_CLASSIFICATION, label: `未分類(${code})`, code };
};
const buildUsageMasterMeta = (item: OrderMasterSearchItem): UsageMasterMeta => ({
  code: item.code?.trim() || undefined,
  label: formatUsageLabel(item),
  timingCode: item.timingCode?.trim() || undefined,
  routeCode: item.routeCode?.trim() || undefined,
  daysLimit: typeof item.daysLimit === 'number' ? item.daysLimit : undefined,
  dosePerDay: typeof item.dosePerDay === 'number' ? item.dosePerDay : undefined,
  youhouCode: item.youhouCode?.trim() || undefined,
});

const formatUsageMasterSummary = (item: Pick<UsageMasterMeta, 'timingCode' | 'routeCode' | 'daysLimit' | 'dosePerDay'>) => {
  const route = resolveUsageRouteClassification(item.routeCode);
  const segments = [`タイミング: ${resolveUsageTimingLabel(item.timingCode)}`, `経路: ${route.label}`];
  if (typeof item.daysLimit === 'number') segments.push(`上限日数: ${item.daysLimit}`);
  if (typeof item.dosePerDay === 'number') segments.push(`1日量目安: ${item.dosePerDay}`);
  return segments.join(' / ');
};
const normalizePredictiveLabel = (value: string) => value.replace(/\s+/g, ' ').trim();
const buildUsageOptionKey = (item: Pick<OrderMasterSearchItem, 'code' | 'name'>) =>
  `${item.code?.trim() ?? ''}|${normalizePredictiveLabel(item.name)}`;
const extractCodeToken = (value: string) => value.trim().split(/\s+/)[0] ?? '';
const isLikelyCodeSearch = (value: string) => {
  const token = extractCodeToken(value);
  if (!token) return false;
  if (/^\d{4,}$/.test(token)) return true;
  return /^[A-Za-z]\d{3,}$/.test(token);
};
const normalizePartialKeyword = (value: string) => value.trim().toLowerCase();
const matchesMasterItemByPartial = (item: OrderMasterSearchItem, keyword: string) => {
  const normalizedKeyword = normalizePartialKeyword(keyword);
  if (!normalizedKeyword) return true;
  const candidates = [item.code ?? '', item.name, formatMasterLabel(item), item.category ?? '', item.note ?? ''];
  return candidates.some((candidate) => candidate.toLowerCase().includes(normalizedKeyword));
};
const sortUsageItemsForInjection = (items: OrderMasterSearchItem[]) =>
  [...items].sort((left, right) => {
    const leftRoute = resolveUsageRouteClassification(left.routeCode);
    const rightRoute = resolveUsageRouteClassification(right.routeCode);
    if (leftRoute.injectionPriority !== rightRoute.injectionPriority) {
      return leftRoute.injectionPriority - rightRoute.injectionPriority;
    }
    const leftCode = left.code?.trim() ?? '';
    const rightCode = right.code?.trim() ?? '';
    if (leftCode !== rightCode) return leftCode.localeCompare(rightCode);
    return left.name.localeCompare(right.name);
  });

const buildRecentUsageStorageKey = (scope: RecentUsageStorageScope, entity: string) => {
  const facilityId = scope.facilityId?.trim() || 'unknown-facility';
  const userId = scope.userId?.trim() || 'unknown-user';
  return `${RECENT_USAGE_STORAGE_PREFIX}:${facilityId}:${userId}:${entity}`;
};

const dedupeRecentUsages = (values: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    next.push(normalized);
  });
  return next.slice(0, RECENT_USAGE_MAX);
};

const loadRecentUsageHistory = (storageKey: string): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupeRecentUsages(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return [];
  }
};

const saveRecentUsageHistory = (storageKey: string, values: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(dedupeRecentUsages(values)));
  } catch {
    // Ignore storage failures in private mode or quota exceeded cases.
  }
};

const appendRecentUsageHistory = (values: string[], value: string) =>
  dedupeRecentUsages([value, ...values]);

export const resolvePrescriptionClassCode = (timing: PrescriptionTiming, location: PrescriptionLocation) =>
  PRESCRIPTION_CLASS_CODES[timing][location];

const resolvePrescriptionLabel = (timing: PrescriptionTiming, location: PrescriptionLocation) =>
  PRESCRIPTION_LABELS[timing][location];

const resolvePrescriptionClassName = (classCode: string | undefined) =>
  classCode ? PRESCRIPTION_CLASS_NAMES[classCode] : undefined;

export const parsePrescriptionClassCode = (classCode?: string | null) => {
  if (!classCode) {
    return {
      location: DEFAULT_PRESCRIPTION_LOCATION,
      timing: DEFAULT_PRESCRIPTION_TIMING,
    };
  }
  const normalized = classCode.trim();
  const location: PrescriptionLocation = normalized.endsWith('2') ? 'out' : 'in';
  let timing: PrescriptionTiming = 'regular';
  if (normalized.startsWith('22')) {
    timing = 'tonyo';
  } else if (normalized.startsWith('23')) {
    timing = 'gaiyo';
  }
  return { location, timing };
};

type MedOrderBundleNameInput = {
  bundleName: string;
  items: OrderBundleItem[];
  prescriptionTiming: PrescriptionTiming;
  prescriptionLocation: PrescriptionLocation;
};

export const resolveMedOrderBundleName = ({
  bundleName,
  items,
  prescriptionTiming,
  prescriptionLocation,
}: MedOrderBundleNameInput) => {
  if (bundleName.trim()) return bundleName;
  const candidate = items.find((item) => item.name.trim())?.name.trim();
  if (candidate) return candidate;
  return resolvePrescriptionLabel(prescriptionTiming, prescriptionLocation);
};

export const validateBundleForm = ({
  form,
  entity,
  usageDaysLimit,
}: {
  form: BundleFormState;
  entity: string;
  bundleLabel: string;
  usageDaysLimit?: number;
}): BundleValidationIssue[] => {
  const issues: BundleValidationIssue[] = [];
  const hasAnyValue = (item: OrderBundleItem) => hasOrderBundleRowValue(item);
  const rule = resolveOrderEntityValidationRule(entity) ?? DEFAULT_VALIDATION_RULE;
  const testSubtypeConfig = resolveOrderEntityTestSubtypeConfig(entity);
  const resolvedSubtype = resolveFormSubtype(entity, form.subtype);
  const supportsBodyPartField = supportsOrcaBodyPartField(entity, form.classCode);
  const canonicalEntity = resolveCanonicalOrderEntity(entity) ?? entity;
  const combinedItems = collectBundleItems(form);
  const contractStats = collectOrderBundleContractStats({
    entity,
    items: combinedItems,
    bodyPart: form.bodyPart,
    admin: canonicalEntity === 'injectionOrder' ? form.admin : undefined,
  });
  const injectionContractIssues =
    canonicalEntity === 'injectionOrder'
      ? collectInjectionBundleContractIssues(
          {
            entity,
            classCode: form.classCode,
            admin: form.admin,
            adminCode: form.adminCode,
            items: combinedItems,
            bodyPart: form.bodyPart,
          },
          { mode: 'save' },
        )
      : [];
  const hasMaterialValues = form.materialItems.some(hasAnyValue);
  const hasCommentValues = form.commentItems.some(hasAnyValue);
  const hasBodyPartValue = hasBundleBodyPartValue(form.bodyPart);
  const normalizedClassCode = form.classCode?.trim() ?? '';
  const requiresExactClassCode =
    canonicalEntity !== 'medOrder' &&
    canonicalEntity !== 'otherOrder' &&
    canonicalEntity !== 'injectionOrder' &&
    !isChargeEntity(canonicalEntity) &&
    getAllowedClassCodesForEntity(canonicalEntity).length > 0;
  const requiresSendableMainRow =
    rule.requiresItems &&
    canonicalEntity !== 'medOrder' &&
    !(canonicalEntity === 'surgeryOrder' && isStandaloneSurgeryClassCode(normalizedClassCode));
  const hasAuxiliaryOnlyBundleContent =
    requiresSendableMainRow &&
    contractStats.sendableMainRows.length === 0 &&
    (contractStats.valuedRows.length > 0 || contractStats.hasBodyPartValue || contractStats.hasAdmin);
  if (rule.requiresUsage && !form.admin.trim()) {
    issues.push({ key: 'missing_usage', message: '用法を入力してください。' });
  }
  injectionContractIssues.forEach((issue) => {
    issues.push({ key: issue.code, message: issue.detail });
  });
  if (requiresExactClassCode && !normalizedClassCode) {
    const allowlist = getAllowedClassCodesForEntity(canonicalEntity);
    issues.push({
      key: canonicalEntity === 'injectionOrder' ? 'missing_injection_class_code' : 'missing_class_code',
      message:
        allowlist.length > 0
          ? `${canonicalEntity} は exact allowlist（${allowlist.join('/')}）の classCode が必須です。`
          : `${canonicalEntity} は classCode が必須です。`,
    });
  } else if (requiresExactClassCode && !isOrcaEntityClassAllowed(canonicalEntity, normalizedClassCode)) {
    const allowlist = getAllowedClassCodesForEntity(canonicalEntity);
    issues.push({
      key: canonicalEntity === 'injectionOrder' ? 'invalid_injection_class_code' : 'invalid_class_code',
      message:
        allowlist.length > 0
          ? `${canonicalEntity} は exact allowlist（${allowlist.join('/')}）のみ保存できます。`
          : `${canonicalEntity} の classCode は保存契約外です。`,
    });
  }
  if (testSubtypeConfig?.required && !resolvedSubtype) {
    issues.push({ key: 'missing_test_subtype', message: `${testSubtypeConfig.label}を選択してください。` });
  }
  if (form.subtype && !resolvedSubtype) {
    issues.push({ key: 'invalid_test_subtype', message: '600系 subtype が不正です。' });
  }
  if (canonicalEntity === 'physiologyOrder' && hasBodyPartValue) {
    issues.push({
      key: 'unsupported_body_part',
      message: '生理検査では bodyPart を保存しません。値をクリアしてください。',
    });
  }
  if ((rule.requiresBodyPart || (canonicalEntity === 'radiologyOrder' && supportsBodyPartField)) && !form.bodyPart?.name?.trim()) {
    issues.push({ key: 'missing_body_part', message: '部位を入力してください。' });
  }
  if (hasBodyPartValue && !supportsBodyPartField && canonicalEntity !== 'physiologyOrder') {
    issues.push({
      key: 'unsupported_body_part',
      message: 'この種別では bodyPart を保持できません。部位をクリアしてください。',
    });
  }
  if (form.bodyPart?.name?.trim() && !form.bodyPart.code?.trim()) {
    issues.push({
      key: 'missing_body_part_code',
      message: '部位コードを選択してください。',
    });
  } else if (
    form.bodyPart?.code?.trim() &&
    !form.bodyPart.code.trim().startsWith(ORDER_BUNDLE_BODY_PART_CODE_PREFIX)
  ) {
    issues.push({
      key: 'invalid_body_part_code',
      message: 'bodyPart は 002 系コードのみ保存できます。',
    });
  }
  if (rule.requiresItems && contractStats.valuedRows.length === 0 && !(canonicalEntity === 'injectionOrder' && injectionContractIssues.length > 0)) {
    issues.push({
      key: hasAuxiliaryOnlyBundleContent ? (canonicalEntity === 'injectionOrder' ? 'missing_main_row' : 'comment_only') : 'missing_items',
      message: hasAuxiliaryOnlyBundleContent
        ? buildMissingMainRowMessage({
            canonicalEntity,
            hasBodyPartValue,
            hasMaterialValue: hasMaterialValues,
            hasCommentValue: hasCommentValues,
            hasAdminValue: contractStats.hasAdmin,
          })
        : `${rule.itemLabel}を1件以上入力してください。`,
    });
  }
  if (contractStats.valuedRows.length > 0 && canonicalEntity !== 'injectionOrder') {
    if (contractStats.uncodedRows.length > 0 && contractStats.codedRows.length > 0) {
      issues.push({
        key: 'mixed_coded_uncoded',
        message: 'コードあり行とコードなし行が混在しています。コードなし行を削除するか、必ずマスタ選択してください。',
      });
    } else if (contractStats.uncodedRows.length > 0) {
      issues.push({
        key: 'uncoded_row',
        message: 'コードなし行が含まれています。名前だけの行は ORCA へ送れないため、マスタ選択してください。',
      });
    } else if (hasAuxiliaryOnlyBundleContent) {
      issues.push({
        key: 'comment_only',
        message: buildMissingMainRowMessage({
          canonicalEntity,
          hasBodyPartValue,
          hasMaterialValue: hasMaterialValues,
          hasCommentValue: hasCommentValues,
          hasAdminValue: contractStats.hasAdmin,
        }),
      });
    }
  }
  const unsupportedSelectionParameterRow = combinedItems.find(
    (item) => hasOrderBundleRowValue(item) && hasUnsupportedSelectionCommentParameterInItem(item),
  );
  if (unsupportedSelectionParameterRow) {
    issues.push({
      key: 'unsupported_selection_comment_parameter',
      message: UNSUPPORTED_COMMENT_PARAMETER_MESSAGE,
    });
  }
  if (canonicalEntity === 'otherOrder') {
    if (form.classCode?.trim()) {
      issues.push({
        key: 'invalid_other_order_class_code',
        message: 'otherOrder は explicit local-only 契約のため classCode を保持しません。classCode をクリアしてください。',
      });
    }
    const invalidLocalOnlyRow = combinedItems.find(
      (item) => hasAnyValue(item) && Boolean(item.code?.trim()) && !isOtherOrderLocalOnlyCode(item.code),
    );
    if (invalidLocalOnlyRow) {
      issues.push({
        key: 'invalid_other_order_code',
        message: 'otherOrder は explicit local-only code 形式のみ保存できます。LOCAL_OTHER:... で始まるコードを入力してください。',
      });
    }
    if (hasMaterialValues) {
      issues.push({
        key: 'unsupported_material_item',
        message: 'otherOrder では材料行を保持できません。',
      });
    }
  }
  if (canonicalEntity !== 'otherOrder' && hasMaterialValues) {
    if (
      form.materialItems.some((item) => {
        const code = item.code?.trim() ?? '';
        return code !== '' && !isAuxiliaryMaterialCode(code);
      })
    ) {
      issues.push({
        key: 'invalid_material_code',
        message: '材料行は 7 から始まる9桁コードのみ保存できます。',
      });
    }
  }
  if (isChargeEntity(canonicalEntity)) {
    const normalizedClassCode = form.classCode?.trim() ?? '';
    if (!normalizedClassCode) {
      issues.push({
        key: 'missing_charge_class_code',
        message: 'charge bundle は explicit classCode が必須です。',
      });
    } else if (!isChargeClassCompatible(canonicalEntity, normalizedClassCode)) {
      issues.push({
        key: 'invalid_charge_class_code',
        message: canonicalEntity === 'baseChargeOrder'
          ? 'baseChargeOrder の classCode は 110〜125 の範囲のみ保存できます。'
          : 'instractionChargeOrder の classCode は 130〜150 の範囲のみ保存できます。',
      });
    }
    const hasMissingChargeItemCategory = form.items.some((item) => {
      if (!hasAnyValue(item)) return false;
      const resolvedFields = resolveOrcaOrderItemFields(item);
      const masterCategory = resolveChargeItemMasterCategory(canonicalEntity, item);
      return Boolean(resolvedFields.rowRole !== 'comment' && resolvedFields.rowRole !== 'auxiliary' && !masterCategory);
    });
    if (hasMissingChargeItemCategory) {
      issues.push({
        key: 'missing_charge_item_category',
        message: 'charge main row は compatible な masterCategory が必須です。算定項目を候補から選び直してください。',
      });
    }
    if (
      form.items.some((item) => {
        const category = resolveChargeItemMasterCategory(canonicalEntity, item) ?? '';
        if (!category) return false;
        return !isChargeItemCategoryCompatible(canonicalEntity, category);
      })
    ) {
      issues.push({
        key: 'invalid_charge_item_category',
        message: canonicalEntity === 'baseChargeOrder'
          ? 'baseChargeOrder の main row は 110〜125 の masterCategory のみ保存できます。'
          : 'instractionChargeOrder の main row は 130〜150 の masterCategory のみ保存できます。',
      });
    }
    const canonicalClassMeta = resolveCanonicalChargeClassMeta({
      entity: canonicalEntity,
      classCode: normalizedClassCode,
      itemCategory: resolveChargeItemMasterCategory(canonicalEntity, form.items.find((item) => item.name?.trim() || item.code?.trim())),
    });
    const explicitClassName = form.className?.trim() ?? '';
    if (normalizedClassCode && !canonicalClassMeta?.className && !explicitClassName) {
      issues.push({
        key: 'missing_charge_class_name',
        message: 'charge bundle の className を決定できません。対応する算定項目を選択してください。',
      });
    }
    if (
      explicitClassName &&
      canonicalClassMeta?.className &&
      explicitClassName !== canonicalClassMeta.className
    ) {
      issues.push({
        key: 'invalid_charge_class_name',
        message: 'charge bundle の className は entity/classCode に対応する canonical 値のみ保存できます。',
      });
    }
  }
  const hasUnsupportedSelectionCommentParameterInBundle = collectBundleItems(form).some((item) =>
    hasUnsupportedCommentSelectionParameter(item),
  );
  if (hasUnsupportedSelectionCommentParameterInBundle) {
    issues.push({
      key: 'unsupported_selection_comment_parameter',
      message: UNSUPPORTED_COMMENT_PARAMETER_MESSAGE,
    });
  }
  const isDaysBasedPrescription =
    entity === 'medOrder' && (form.prescriptionTiming === 'regular' || form.prescriptionTiming === 'gaiyo');
  if (isDaysBasedPrescription && typeof usageDaysLimit === 'number' && Number.isFinite(usageDaysLimit) && usageDaysLimit > 0) {
    const bundleDays = Number(form.bundleNumber);
    if (Number.isFinite(bundleDays) && bundleDays > usageDaysLimit) {
      issues.push({
        key: USAGE_DAYS_LIMIT_ERROR_KEY,
        message: `用法マスタ上限日数（${usageDaysLimit}日）を超えています。日数を見直してください。`,
      });
    }
  }
  const commentIssues = form.commentItems.reduce(
    (acc, item) => {
      const hasCode = Boolean(item.code?.trim());
      const hasName = Boolean(item.name?.trim());
      const hasValue = hasAnyValue(item);
      if (hasValue && (!hasCode || !hasName)) acc.incomplete = true;
      if (hasCode && !isOrderBundleCommentCode(item.code!.trim())) acc.invalidCode = true;
      return acc;
    },
    { incomplete: false, invalidCode: false },
  );
  if (commentIssues.incomplete) {
    issues.push({ key: 'invalid_comment_item', message: 'コメントコードと内容を入力してください。' });
  }
  if (commentIssues.invalidCode) {
    issues.push({ key: 'invalid_comment_code', message: 'コメントコードが不正です。' });
  }
  return issues;
};

export function OrderBundleEditPanel({
  patientId,
  entity,
  title,
  bundleLabel,
  itemQuantityLabel,
  meta,
  readOnlyPreview = false,
  instanceKey,
  variant = 'utility',
  bundlesOverride,
  onOpenDocument,
  historyCopyRequest,
  onHistoryCopyConsumed,
  request,
  onRequestConsumed,
  onSubmitResult,
  onEditingContextChange,
  onClose,
  mutateBundles,
}: OrderBundleEditPanelProps) {
  const queryClient = useQueryClient();
  const executeMutateOrderBundles = mutateBundles ?? mutateOrderBundles;
  const entityId = useMemo(() => {
    const raw = instanceKey?.trim();
    if (!raw) return entity;
    const safeKey = raw.replace(/[^A-Za-z0-9_-]/g, '-');
    if (!safeKey) return entity;
    return `${entity}-${safeKey}`;
  }, [entity, instanceKey]);
  const isPreviewMode = readOnlyPreview;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState<BundleFormState>(() => buildEmptyForm(today));
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [detailSearchOpen, setDetailSearchOpen] = useState(false);
  const [pointsMinInput, setPointsMinInput] = useState('');
  const [pointsMaxInput, setPointsMaxInput] = useState('');
  const [orcaSetKeyword, setOrcaSetKeyword] = useState('');
  const [orcaSetLoading, setOrcaSetLoading] = useState(false);
  const [orcaSetItems, setOrcaSetItems] = useState<OrcaOrderInputSetSummary[]>([]);
  const [orcaSetConfirmOpen, setOrcaSetConfirmOpen] = useState(false);
  const [pendingOrcaSetForm, setPendingOrcaSetForm] = useState<BundleFormState | null>(null);
  const [contraNotice, setContraNotice] = useState<ContraindicationNotice | null>(null);
  const [contraDetails, setContraDetails] = useState<string[]>([]);
  const [isContraChecking, setIsContraChecking] = useState(false);
  const [bodyPartKeyword, setBodyPartKeyword] = useState('');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedItemRowId, setSelectedItemRowId] = useState<string | null>(null);
  const [optimisticBundles, setOptimisticBundles] = useState<OrderBundle[]>([]);
  const [commentDraft, setCommentDraft] = useState<OrderBundleItem>({
    code: '',
    name: '',
    quantity: '',
    unit: '',
    memo: '',
  });
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const [validationIssues, setValidationIssues] = useState<BundleValidationIssue[]>([]);
  const [commentsFoldOpen, setCommentsFoldOpen] = useState(false);
  const commentsAutoOpenedRef = useRef(false);
  const [selectedUsageMasterMeta, setSelectedUsageMasterMeta] = useState<UsageMasterMeta | null>(null);
  const contraConfirmResolveRef = useRef<((value: boolean) => void) | null>(null);
  const [contraConfirmOpen, setContraConfirmOpen] = useState(false);
  const [clearRowsDialogOpen, setClearRowsDialogOpen] = useState(false);
  const [contraConfirmPayload, setContraConfirmPayload] = useState<{
    summary: string;
    details: string[];
    apiResult?: string;
    apiMessage?: string;
  } | null>(null);
  const orderUiProfile = useMemo(() => resolveOrderEntityUiProfile(entity), [entity]);
  const usageUiCopy = useMemo(() => resolveOrderEntityUsageUiCopy(entity), [entity]);

  const resetEditorForm = useCallback(() => {
    setForm(buildEmptyForm(today));
    setNotice(null);
    setContraNotice(null);
    setContraDetails([]);
    setContraConfirmPayload(null);
    setBodyPartKeyword('');
    setValidationIssues([]);
    setCommentDraft({
      code: '',
      name: '',
      quantity: '',
      unit: '',
      memo: '',
    });
    setCommentsFoldOpen(false);
    commentsAutoOpenedRef.current = false;
    setSelectedUsageMasterMeta(null);
  }, [today]);

  const focusFirstField = useCallback(() => {
    if (typeof document === 'undefined') return;
    requestAnimationFrame(() => {
      if (editorScrollRef.current) {
        editorScrollRef.current.scrollTop = 0;
      }
      const el =
        (document.getElementById(`${entityId}-item-name-0`) as HTMLInputElement | null) ??
        (document.getElementById(`${entityId}-bundle-name`) as HTMLInputElement | null) ??
        (document.getElementById(`${entityId}-admin`) as HTMLInputElement | null);
      if (!el) return;
      safeScrollIntoView(el, { block: 'nearest' });
      el.focus();
    });
  }, [entityId]);

  const clearValidationByKeys = useCallback((keys: string[]) => {
    if (keys.length === 0) return;
    setValidationIssues((prev) => prev.filter((issue) => !keys.includes(issue.key)));
  }, []);

  useEffect(() => {
    return () => {
      const resolve = contraConfirmResolveRef.current;
      if (resolve) resolve(false);
      contraConfirmResolveRef.current = null;
    };
  }, []);
  const canonicalEntity = resolveCanonicalOrderEntity(entity) ?? entity;
  const isMedOrder = canonicalEntity === 'medOrder';
  const isInjectionOrder = canonicalEntity === 'injectionOrder';
  const isCompactOrderLayout = isMedOrder || isInjectionOrder;
  const isRadiologyOrder = canonicalEntity === 'radiologyOrder';
  const isRehabOrder = canonicalEntity === 'treatmentOrder';
  const isGaiyoPrescription = isMedOrder && form.prescriptionTiming === 'gaiyo';
  const rpRequiredIssueForForm = useMemo(
    () =>
      resolveRpRequiredIssue({
        entity,
        bundleName: form.bundleName,
        classCode: isMedOrder
          ? resolvePrescriptionClassCode(form.prescriptionTiming, form.prescriptionLocation)
          : form.classCode?.trim(),
        bundleNumber: form.bundleNumber,
        items: form.items,
      }),
    [entity, form.bundleName, form.bundleNumber, form.items, form.prescriptionLocation, form.prescriptionTiming, isMedOrder],
  );
  useEffect(() => {
    onEditingContextChange?.({
      hasRpRequiredIssue: Boolean(rpRequiredIssueForForm),
      rpRequiredMissing: rpRequiredIssueForForm?.missing ?? [],
    });
  }, [onEditingContextChange, rpRequiredIssueForForm]);
  useEffect(
    () => () => {
      onEditingContextChange?.({ hasRpRequiredIssue: false, rpRequiredMissing: [] });
    },
    [onEditingContextChange],
  );
  const mixingCommentIndex = useMemo(
    () => (isMedOrder ? form.commentItems.findIndex((item) => item.memo === MIXING_COMMENT_MARKER) : -1),
    [form.commentItems, isMedOrder],
  );
  const mixingComment = mixingCommentIndex >= 0 ? form.commentItems[mixingCommentIndex] : null;
  const mixingEnabled = Boolean(isGaiyoPrescription && mixingComment);

  useEffect(() => {
    if (!isMedOrder) return;
    if (form.prescriptionTiming === 'gaiyo') return;
    if (mixingCommentIndex < 0) return;
    setForm((prev) => ({
      ...prev,
      commentItems: prev.commentItems.filter((item) => item.memo !== MIXING_COMMENT_MARKER),
    }));
  }, [form.prescriptionTiming, isMedOrder, mixingCommentIndex]);

  useEffect(() => {
    if (resolveCanonicalOrderEntity(entity) !== 'physiologyOrder') return;
    if (!hasBundleBodyPartValue(form.bodyPart)) return;
    setForm((prev) => (hasBundleBodyPartValue(prev.bodyPart) ? { ...prev, bodyPart: null } : prev));
  }, [entity, form.bodyPart]);

  useEffect(() => {
    setForm((prev) => applyDefaultClassMeta(entity, prev));
  }, [entity]);

  const supportsUsageSearch = orderUiProfile.supportsUsageSearch;
  const supportsBodyPartSearch = supportsOrcaBodyPartField(entity, form.classCode);
  const supportsCommentCodes = orderUiProfile.supportsCommentCodes;
  const physiologySendContractGuidance = resolveOrderEntityPhysiologySendContractGuidance(entity);
  const supportsMaterialRows =
    isInjectionOrder ||
    isRehabOrder ||
    isRadiologyOrder ||
    form.materialItems.some((item) => hasOrderBundleItemValue(item));
  const testSubtypeConfig = resolveOrderEntityTestSubtypeConfig(entity);
  const effectiveTestSubtype = resolveFormSubtype(entity, form.subtype);
  const showBodyPartSection = supportsBodyPartSearch || (canonicalEntity !== 'physiologyOrder' && hasBundleBodyPartValue(form.bodyPart));
  const sendContractNote = resolveOrcaSendContractNote(entity) ?? '';
  const usageLocalOnlyHelp = resolveOrcaUsageLocalOnlyHelp(entity);
  const instructionLocalOnlyHelp = resolveOrcaInstructionLocalOnlyHelp(entity);
  const memoLocalOnlyHelp = resolveOrcaMemoLocalOnlyHelp(entity);
  const adminMemoLocalOnlyHelp =
    resolveOrcaAdminMemoLocalOnlyHelp(entity) ?? '院内ローカル情報として保存します。ORCA 送信対象にはしません。';
  const itemMemoLocalOnlyHelp = resolveOrcaItemMemoLocalOnlyHelp(entity);
  const physiologyContractGuidanceBlock = physiologySendContractGuidance ? (
    <div
      className="charts-side-panel__notice charts-side-panel__notice--warning"
      role="status"
      aria-live={resolveAriaLive('warning')}
    >
      <div className="charts-side-panel__warning-header">
        <strong>生理検査のORCA送信</strong>
        <span>停止</span>
      </div>
      <p className="charts-side-panel__notice-detail">{physiologySendContractGuidance.reason}</p>
      <ul className="charts-side-panel__notice-list" aria-label="生理検査の送信区分">
        <li>送信候補: {physiologySendContractGuidance.sendableFields.join(' / ')}</li>
        <li>院内ローカル: {physiologySendContractGuidance.localOnlyFields.join(' / ')}</li>
        <li>別扱い: {physiologySendContractGuidance.separateFields.join(' / ')}</li>
      </ul>
    </div>
  ) : null;
  const itemMasterTargets = orderUiProfile.masterSearchPresets;
  const supportsEtensuDetailSearch = itemMasterTargets.some((target) => target.type === 'etensu');
  const itemPredictiveTargetLabel = itemMasterTargets.map((target) => target.label).join(' / ');
  const parsedPointsMin = pointsMinInput.trim() ? Number(pointsMinInput) : undefined;
  const parsedPointsMax = pointsMaxInput.trim() ? Number(pointsMaxInput) : undefined;
  const pointsRangeError =
    (pointsMinInput.trim() && Number.isNaN(parsedPointsMin))
      ? '点数From は数値で入力してください。'
      : (pointsMaxInput.trim() && Number.isNaN(parsedPointsMax))
        ? '点数To は数値で入力してください。'
        : parsedPointsMin !== undefined && parsedPointsMax !== undefined && parsedPointsMin > parsedPointsMax
          ? '点数From は 点数To 以下で入力してください。'
          : '';
  const pointsRangeSummary =
    parsedPointsMin !== undefined || parsedPointsMax !== undefined
      ? `点数: ${parsedPointsMin ?? '0'}〜${parsedPointsMax ?? '∞'}`
      : '';
  const hasCommentValues = useMemo(
    () =>
      form.commentItems.some((item) =>
        Boolean(item.name?.trim() || item.code?.trim() || item.quantity?.trim() || item.unit?.trim() || item.memo?.trim()),
      ),
    [form.commentItems],
  );

  useEffect(() => {
    if (!supportsCommentCodes) return;
    if (commentsFoldOpen) return;
    if (commentsAutoOpenedRef.current) return;
    if (!hasCommentValues) return;
    setCommentsFoldOpen(true);
    commentsAutoOpenedRef.current = true;
  }, [commentsFoldOpen, hasCommentValues, supportsCommentCodes]);

  const blockReasons = useMemo(() => {
    const reasons: string[] = [];
    if (isPreviewMode) {
      reasons.push('プレビューモードのため編集できません。');
    }
    if (meta.readOnly) {
      reasons.push(meta.readOnlyReason ?? '閲覧専用のため編集できません。');
    }
    if (meta.missingMaster) {
      reasons.push('マスター未同期のため編集できません。');
    }
    if (meta.fallbackUsed) {
      reasons.push('フォールバックデータのため編集できません。');
    }
    return reasons;
  }, [isPreviewMode, meta.fallbackUsed, meta.missingMaster, meta.readOnly, meta.readOnlyReason]);
  const guardReasonKeys = useMemo(() => {
    const reasons: string[] = [];
    if (isPreviewMode) reasons.push('preview');
    if (meta.readOnly) reasons.push('read_only');
    if (meta.missingMaster) reasons.push('missing_master');
    if (meta.fallbackUsed) reasons.push('fallback_used');
    return reasons;
  }, [isPreviewMode, meta.fallbackUsed, meta.missingMaster, meta.readOnly]);
  const isBlocked = blockReasons.length > 0;
  const editBlockedReasonId = `${entityId}-edit-block-reason`;
  const saveBlockedReason = blockReasons.join(' / ');
  const session = useOptionalSession();
  const storageScope = useMemo(
    () => ({ facilityId: session?.facilityId, userId: session?.userId }),
    [session?.facilityId, session?.userId],
  );
  const recentUsageStorageKey = useMemo(
    () => buildRecentUsageStorageKey(storageScope, entity),
    [entity, storageScope],
  );
  const [recentUsageHistory, setRecentUsageHistory] = useState<string[]>(() =>
    loadRecentUsageHistory(recentUsageStorageKey),
  );
  useEffect(() => {
    setRecentUsageHistory(loadRecentUsageHistory(recentUsageStorageKey));
  }, [recentUsageStorageKey]);
  const orcaSendMatch = useMemo<OrcaClaimSendCacheMatch | null>(
    () =>
      patientId
        ? {
            patientId,
            appointmentId: meta.appointmentId,
            receptionId: meta.receptionId,
            scheduleKey: meta.scheduleKey,
            encounterKey: meta.encounterId,
          }
        : null,
    [meta.appointmentId, meta.encounterId, meta.receptionId, meta.scheduleKey, patientId],
  );
  const [orcaSendEntry, setOrcaSendEntry] = useState<ReturnType<typeof getOrcaClaimSendEntryForRow> | null>(() =>
    getOrcaClaimSendEntryForRow(storageScope, orcaSendMatch),
  );
  useEffect(() => {
    setOrcaSendEntry(getOrcaClaimSendEntryForRow(storageScope, orcaSendMatch));
  }, [orcaSendMatch, storageScope]);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ patientId?: string }>).detail;
      if (detail?.patientId && detail.patientId !== patientId) return;
      setOrcaSendEntry(getOrcaClaimSendEntryForRow(storageScope, orcaSendMatch));
    };
    window.addEventListener('orca-claim-send-cache-update', handler);
    return () => {
      window.removeEventListener('orca-claim-send-cache-update', handler);
    };
  }, [orcaSendMatch, patientId, storageScope]);

  const currentPerformDate = useMemo(() => (meta.visitDate ?? today).slice(0, 10), [meta.visitDate, today]);
  const orcaMedicalWarnings = useMemo<OrcaMedicalWarningUi[]>(() => {
    const warnings = orcaSendEntry?.medicalWarnings ?? [];
    const sentDate = orcaSendEntry?.performDate?.slice(0, 10);
    if (!sentDate || sentDate !== currentPerformDate) return [];
    return warnings;
  }, [currentPerformDate, orcaSendEntry?.medicalWarnings, orcaSendEntry?.performDate]);

  const orcaWarningsForEntity = useMemo(
    () => orcaMedicalWarnings.filter((warning) => warning.entity === entity),
    [entity, orcaMedicalWarnings],
  );

  type WarningFocusTarget =
    | { kind: 'usage' }
    | { kind: 'bodyPart' }
    | { kind: 'items'; index: number }
    | { kind: 'commentItems'; index: number };

  const resolveWarningFocusTarget = useCallback(
    (warning: OrcaMedicalWarningUi): { elementId: string; target: WarningFocusTarget } | null => {
      if (warning.sourceKind === 'usage') {
        return { elementId: `${entityId}-admin`, target: { kind: 'usage' } };
      }
      if (typeof warning.sourceItemIndex !== 'number') return null;
      const bodyPartCount = form.bodyPart && form.bodyPart.name.trim() ? 1 : 0;
      const sourceIndex = warning.sourceItemIndex;
      if (sourceIndex < bodyPartCount) {
        return { elementId: `${entityId}-bodypart`, target: { kind: 'bodyPart' } };
      }
      const itemsStart = bodyPartCount;
      const itemsEnd = itemsStart + form.items.length;
      if (sourceIndex >= itemsStart && sourceIndex < itemsEnd) {
        const index = sourceIndex - itemsStart;
        return { elementId: `${entityId}-item-name-${index}`, target: { kind: 'items', index } };
      }
      const commentStart = itemsEnd;
      const commentEnd = commentStart + form.commentItems.length;
      if (sourceIndex >= commentStart && sourceIndex < commentEnd) {
        const index = sourceIndex - commentStart;
        return { elementId: `${entityId}-comment-name-${index}`, target: { kind: 'commentItems', index } };
      }
      return null;
    },
    [entityId, form.bodyPart, form.commentItems.length, form.items.length],
  );

  const [warningFocusRequest, setWarningFocusRequest] = useState<OrcaMedicalWarningUi | null>(null);
  const [warningFocusTarget, setWarningFocusTarget] = useState<WarningFocusTarget | null>(null);

  const auditMetaDetails = useMemo(
    () => ({
      cacheHit: meta.cacheHit,
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      dataSourceTransition: meta.dataSourceTransition,
      patientId: meta.patientId,
      appointmentId: meta.appointmentId,
      receptionId: meta.receptionId,
      visitDate: meta.visitDate,
      actorRole: meta.actorRole,
    }),
    [meta],
  );

  useEffect(() => {
    setCommentDraft({ code: '', name: '', quantity: '', unit: '', memo: '' });
  }, [entity]);

  useEffect(() => {
    setOptimisticBundles([]);
  }, [entity, patientId]);

  const recommendationFrom = useMemo(() => {
    const base = new Date();
    base.setMonth(base.getMonth() - 6);
    return base.toISOString().slice(0, 10);
  }, []);

  const recommendationQueryKey = useMemo(
    () => ['charts-order-recommendations', patientId, entity, recommendationFrom],
    [entity, patientId, recommendationFrom],
  );
  const recommendationQuery = useQuery({
    queryKey: recommendationQueryKey,
    queryFn: () => {
      if (!patientId) throw new Error('patientId is required');
      return fetchOrderRecommendations({
        patientId,
        entity,
        from: recommendationFrom,
        includeFacility: true,
        patientLimit: 8,
        facilityLimit: 8,
        scanLimit: 800,
      });
    },
    enabled: Boolean(patientId) && variant === 'utility',
    staleTime: 60 * 1000,
  });
  const recommendationCandidates = useMemo<OrderRecommendationCandidate[]>(
    () => recommendationQuery.data?.recommendations ?? [],
    [recommendationQuery.data],
  );
  const showRecommendationSidebar = variant === 'utility';
  const showBundleList = variant === 'utility';
  const showOrcaSetChooser = variant === 'utility';

  const queryKey = ['charts-order-bundles', patientId, entity];
  const canQueryBundles = Boolean(patientId) && !bundlesOverride;
  const bundleQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (!patientId) throw new Error('patientId is required');
      return fetchOrderBundles({ patientId, entity });
    },
    enabled: canQueryBundles,
    placeholderData: keepPreviousData,
  });

  const resolveActionMessage = (action: OrderBundleSubmitAction, ok: boolean) => {
    if (action === 'save') {
      return ok ? 'オーダーを保存しました。' : 'オーダーの保存に失敗しました。';
    }
    if (action === 'expand') {
      return ok ? 'オーダーを保存し、編集を閉じました。' : '保存して閉じる操作に失敗しました。';
    }
    return ok ? 'オーダーを保存し、編集を継続します。' : '保存して継続する操作に失敗しました。';
  };

  useEffect(() => {
    logUiState({
      action: 'navigate',
      screen: `charts/${entity}-edit`,
      runId: meta.runId,
      cacheHit: meta.cacheHit,
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      dataSourceTransition: meta.dataSourceTransition,
      details: {
        patientId: meta.patientId,
        appointmentId: meta.appointmentId,
        receptionId: meta.receptionId,
        visitDate: meta.visitDate,
        entity,
      },
    });
  }, [entity, meta]);

  const selectedItemForPrediction = useMemo(() => {
    const rows = [...(form.items as OrderBundleItemWithRowId[]), ...(form.materialItems as OrderBundleItemWithRowId[])];
    if (rows.length === 0) return null;
    if (!selectedItemRowId) return rows[0];
    return rows.find((row) => row.rowId === selectedItemRowId) ?? rows[0];
  }, [form.items, form.materialItems, selectedItemRowId]);
  const selectedItemPredictionKeyword = selectedItemForPrediction?.name?.trim() ?? '';
  const selectedItemPredictionCode = selectedItemForPrediction?.code?.trim() ?? '';
  const debouncedItemPredictionKeyword = useDebouncedValue(selectedItemPredictionKeyword, 260);
  const itemPredictiveSearchTypes = useMemo<OrderMasterSearchType[]>(
    () => Array.from(new Set(itemMasterTargets.map((target) => target.type))),
    [itemMasterTargets],
  );
  const etensuCategory = useMemo(() => resolveOrderEntityEtensuCategory(entity), [entity]);
  const isItemCodeSearch = isLikelyCodeSearch(debouncedItemPredictionKeyword);
  const medicationGetRequestCode = /^\d{9}$/.test(selectedItemPredictionCode)
    ? selectedItemPredictionCode
    : /^\d{9}$/.test(debouncedItemPredictionKeyword)
      ? debouncedItemPredictionKeyword
      : '';
  const itemPredictiveQuery = useQuery({
    queryKey: [
      'charts-order-item-predictive',
      entity,
      itemPredictiveSearchTypes.join(','),
      etensuCategory ?? '',
      debouncedItemPredictionKeyword,
      medicationGetRequestCode,
      form.startDate,
      pointsMinInput,
      pointsMaxInput,
    ],
    queryFn: async () => {
      const medicationGetResult =
        medicationGetRequestCode
          ? await fetchOrcaMedicationGet({
              requestCode: medicationGetRequestCode,
              baseDate: form.startDate,
              requestNumber: '02',
            })
          : null;
      const responses = await Promise.all(
        itemPredictiveSearchTypes.map(async (type) => {
          const items: OrderMasterSearchItem[] = [];
          const correctionCandidates: OrderMasterSearchItem[] = [];
          const selectionComments: Array<{
            code: string;
            name: string;
            category?: string;
            itemNumber?: string;
            itemNumberBranch?: string;
          }> = [];
          let correctionMeta: OrderMasterSearchResult['correctionMeta'];
          let totalCount: number | undefined;
          let page = 1;
          while (true) {
            const result = await fetchOrderMasterSearch({
              type,
              keyword: debouncedItemPredictionKeyword,
              category: type === 'etensu' ? etensuCategory : undefined,
              pointsMin: type === 'etensu' && !pointsRangeError ? parsedPointsMin : undefined,
              pointsMax: type === 'etensu' && !pointsRangeError ? parsedPointsMax : undefined,
              page,
              size: PREDICTIVE_FETCH_PAGE_SIZE,
            });
            if (!result.ok) {
              return { type, result };
            }
            items.push(...(result.items ?? []));
            if (page === 1) {
              correctionCandidates.push(...(result.correctionCandidates ?? []));
              correctionMeta = result.correctionMeta ?? correctionMeta;
            }
            selectionComments.push(...(result.selectionComments ?? []));
            totalCount = typeof result.totalCount === 'number' ? result.totalCount : totalCount;
            const pageItemCount = result.items?.length ?? 0;
            const hasNextPage =
              PAGINATED_MASTER_SEARCH_TYPES.has(type) &&
              pageItemCount === PREDICTIVE_FETCH_PAGE_SIZE &&
              (typeof totalCount !== 'number' || items.length < totalCount);
            if (!hasNextPage) break;
            page += 1;
          }
          const mergedResult: OrderMasterSearchResult = {
            ok: true,
            items,
            totalCount: typeof totalCount === 'number' ? totalCount : items.length,
            correctionCandidates,
            correctionMeta,
            selectionComments,
          };
          return { type, result: mergedResult };
        }),
      );
      const successful = responses.filter((entry) => entry.result.ok);
      const failedTypes = responses.filter((entry) => !entry.result.ok).map((entry) => entry.type);
      const items = successful.flatMap((entry) => entry.result.items ?? []);
      const correctionCandidates = successful.flatMap((entry) => entry.result.correctionCandidates ?? []);
      const correctionMeta = successful.map((entry) => entry.result.correctionMeta).find((meta) => Boolean(meta));
      const selectionComments = successful.flatMap((entry) => entry.result.selectionComments ?? []);
      if (medicationGetResult?.ok) {
        selectionComments.push(
          ...(medicationGetResult.selections ?? []).flatMap((selection) => {
            const code = selection.commentCode?.trim();
            const name = selection.commentName?.trim();
            if (!code || !name) return [];
            return [{
              code,
              name,
              category: selection.category,
              itemNumber: selection.itemNumber,
              itemNumberBranch: selection.itemNumberBranch,
            }];
          }),
        );
      }
      const failedMessages = responses
        .filter((entry) => !entry.result.ok)
        .map((entry) => entry.result.message)
        .filter((message): message is string => Boolean(message && message.trim()));
      return {
        ok: successful.length > 0,
        items,
        correctionCandidates,
        correctionMeta,
        selectionComments,
        failedTypes,
        message: failedMessages[0] ?? medicationGetResult?.message,
      };
    },
    enabled: debouncedItemPredictionKeyword.length > 0,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
  const itemMasterCandidates = useMemo(
    () =>
      itemPredictiveQuery.data?.ok
        ? itemPredictiveQuery.data.items
            .filter((item) => matchesMasterItemByPartial(item, debouncedItemPredictionKeyword))
        : [],
    [debouncedItemPredictionKeyword, itemPredictiveQuery.data],
  );
  const correctionMeta = itemPredictiveQuery.data?.correctionMeta;
  const itemPredictiveFailedTypeLabel = useMemo(() => {
    const failedTypes = itemPredictiveQuery.data?.failedTypes ?? [];
    if (failedTypes.length === 0) return '';
    return failedTypes
      .map((type) => itemMasterTargets.find((target) => target.type === type)?.label ?? type)
      .join(' / ');
  }, [itemMasterTargets, itemPredictiveQuery.data?.failedTypes]);
  const itemCorrectionCandidates = useMemo(
    () =>
      (itemPredictiveQuery.data?.correctionCandidates ?? []).filter((item) =>
        matchesMasterItemByPartial(item, debouncedItemPredictionKeyword),
      ),
    [debouncedItemPredictionKeyword, itemPredictiveQuery.data?.correctionCandidates],
  );
  const itemPredictiveItems = useMemo(() => {
    const merged = [...itemCorrectionCandidates, ...itemMasterCandidates];
    const deduped = new Map<string, OrderMasterSearchItem>();
    merged.forEach((item) => {
      const key = `${item.code?.trim() ?? ''}|${item.name.trim()}`;
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    });
    return Array.from(deduped.values()).filter((item) => !isUnsupportedChargeSelection(entity, item));
  }, [entity, itemCorrectionCandidates, itemMasterCandidates]);
  const itemPredictiveCandidates = useMemo(
    () =>
      itemPredictiveItems.map((item) => ({
        item,
        label: item.name,
      })),
    [itemPredictiveItems],
  );
  const selectedItemCode = selectedItemForPrediction?.code?.trim() ?? '';
  const selectionCommentQuery = useQuery({
    queryKey: ['charts-order-selection-comments', selectedItemCode, form.startDate],
    queryFn: async (): Promise<{
      selections: Array<{
        commentCode?: string;
        commentName?: string;
        category?: string;
        itemNumber?: string;
        itemNumberBranch?: string;
      }>;
    }> => ({ selections: [] }),
    enabled: false,
    staleTime: 30 * 1000,
    retry: 0,
  });
  const selectionCommentCandidates = useMemo(() => {
    const map = new Map<string, SelectionCommentCandidate>();
    (itemPredictiveQuery.data?.selectionComments ?? []).forEach((item) => {
      const code = item.code?.trim();
      const name = item.name.trim();
      if (!code || !name) return;
      map.set(`${code}|${name}`, item);
    });
    (selectionCommentQuery.data?.selections ?? []).forEach((selection) => {
      const code = selection.commentCode?.trim();
      const name = selection.commentName?.trim();
      if (!code || !name) return;
      map.set(`${code}|${name}`, {
        code,
        name,
        category: selection.category,
        itemNumber: selection.itemNumber,
        itemNumberBranch: selection.itemNumberBranch,
      });
    });
    return Array.from(map.values());
  }, [itemPredictiveQuery.data?.selectionComments, selectionCommentQuery.data?.selections]);

  const usageEffectiveDate = form.startDate?.trim() || undefined;
  const usageSearchQuery = useQuery({
    queryKey: ['charts-order-usage-search', entity, usageEffectiveDate ?? ''],
    queryFn: () =>
      fetchOrderMasterSearch({
        type: 'youhou',
        keyword: '',
        effective: usageEffectiveDate,
        page: 1,
        size: USAGE_SELECT_FETCH_SIZE,
        allowEmpty: true,
      }),
    enabled: supportsUsageSearch && !isBlocked,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
  const usageItems = useMemo(
    () => {
      if (!usageSearchQuery.data?.ok) return [];
      const sorted = isInjectionOrder ? sortUsageItemsForInjection(usageSearchQuery.data.items) : usageSearchQuery.data.items;
      return sorted.slice(0, MAX_USAGE_SELECT_OPTIONS);
    },
    [isInjectionOrder, usageSearchQuery.data],
  );

  const debouncedBodyPartKeyword = useDebouncedValue(bodyPartKeyword, 260);
  const bodyPartSearchQuery = useQuery({
    queryKey: ['charts-order-bodypart-search', debouncedBodyPartKeyword],
    queryFn: () => fetchOrderMasterSearch({ type: 'bodypart', keyword: debouncedBodyPartKeyword }),
    enabled: supportsBodyPartSearch && debouncedBodyPartKeyword.trim().length > 0,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

  const commentKeyword = commentDraft.name?.trim() ?? '';
  const debouncedCommentKeyword = useDebouncedValue(commentKeyword, 260);
  const commentSearchQuery = useQuery({
    queryKey: ['charts-order-comment-search', debouncedCommentKeyword],
    queryFn: () => fetchOrderMasterSearch({ type: 'comment', keyword: debouncedCommentKeyword }),
    enabled: supportsCommentCodes && debouncedCommentKeyword.trim().length > 0,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

  const usageSelectOptions = useMemo(() => {
    const optionMap = new Map<string, OrderMasterSearchItem>();
    usageItems.forEach((item) => {
      optionMap.set(buildUsageOptionKey(item), item);
    });
    const currentAdmin = form.admin.trim();
    if (currentAdmin) {
      const currentItem: OrderMasterSearchItem = {
        type: 'youhou',
        code: form.adminCode?.trim() || undefined,
        name: currentAdmin,
      };
      const currentOptionKey = buildUsageOptionKey(currentItem);
      if (!optionMap.has(currentOptionKey)) {
        optionMap.set(currentOptionKey, currentItem);
      }
    }
    return Array.from(optionMap.values());
  }, [form.admin, form.adminCode, usageItems]);
  const selectedUsageOptionKey = useMemo(() => {
    const currentAdminCode = form.adminCode?.trim() ?? '';
    if (currentAdminCode) {
      const matchedByCode = usageSelectOptions.find((item) => item.code?.trim() === currentAdminCode);
      if (matchedByCode) return buildUsageOptionKey(matchedByCode);
    }
    const normalizedAdmin = normalizePredictiveLabel(form.admin);
    if (!normalizedAdmin) return '';
    const matchedByLabel =
      usageSelectOptions.find((item) => normalizePredictiveLabel(formatUsageLabel(item)) === normalizedAdmin) ??
      usageSelectOptions.find((item) => normalizePredictiveLabel(item.name) === normalizedAdmin) ??
      null;
    return matchedByLabel ? buildUsageOptionKey(matchedByLabel) : '';
  }, [form.admin, form.adminCode, usageSelectOptions]);
  const usageMasterMetaFromOptions = useMemo(() => {
    const currentAdminCode = form.adminCode?.trim() ?? '';
    if (currentAdminCode) {
      const matchedByCode = usageSelectOptions.find((item) => item.code?.trim() === currentAdminCode);
      if (matchedByCode) return buildUsageMasterMeta(matchedByCode);
    }
    const normalizedAdmin = normalizePredictiveLabel(form.admin);
    if (!normalizedAdmin) return null;
    const matchedByLabel =
      usageSelectOptions.find((item) => normalizePredictiveLabel(formatUsageLabel(item)) === normalizedAdmin) ??
      usageSelectOptions.find((item) => normalizePredictiveLabel(item.name) === normalizedAdmin) ??
      null;
    return matchedByLabel ? buildUsageMasterMeta(matchedByLabel) : null;
  }, [form.admin, form.adminCode, usageSelectOptions]);
  const selectedUsageMeta = usageMasterMetaFromOptions ?? selectedUsageMasterMeta;
  const selectedUsageDaysLimit = selectedUsageMeta?.daysLimit;
  const selectedUsageDosePerDay = selectedUsageMeta?.dosePerDay;
  const selectedUsageSummary = selectedUsageMeta ? formatUsageMasterSummary(selectedUsageMeta) : '';

  useEffect(() => {
    if (!selectedUsageMasterMeta) return;
    const currentCode = form.adminCode?.trim() ?? '';
    const normalizedCurrentAdmin = normalizePredictiveLabel(form.admin);
    const matchesByCode = Boolean(selectedUsageMasterMeta.code && currentCode && selectedUsageMasterMeta.code === currentCode);
    const matchesByLabel = normalizePredictiveLabel(selectedUsageMasterMeta.label) === normalizedCurrentAdmin;
    if (!matchesByCode && !matchesByLabel) {
      setSelectedUsageMasterMeta(null);
    }
  }, [form.admin, form.adminCode, selectedUsageMasterMeta]);

  const commentMasterOptions = useMemo(() => {
    const map = new Map<string, OrderMasterSearchItem>();
    if (commentSearchQuery.data?.ok) {
      commentSearchQuery.data.items
        .filter((item) => matchesMasterItemByPartial(item, debouncedCommentKeyword))
        .forEach((item) => {
          const code = item.code?.trim();
          const name = item.name.trim();
          if (!code || !name) return;
          map.set(`${code}|${name}`, item);
        });
    }
    selectionCommentCandidates
      .filter((item) => !hasUnsupportedCommentSelectionParameter(item))
      .forEach((item) => {
        const code = item.code?.trim();
        const name = item.name.trim();
        if (!code || !name) return;
        map.set(`${code}|${name}`, {
          type: 'comment',
          code,
          name,
          category: item.category,
        });
      });
    const draftCode = commentDraft.code?.trim();
    const draftName = commentDraft.name?.trim();
    if (!draftName) return Array.from(map.values());
    if (draftCode) {
      map.set(`${draftCode}|${draftName}`, {
        type: 'comment',
        code: draftCode,
        name: draftName,
        unit: commentDraft.unit ?? '',
        note: commentDraft.memo ?? '',
      });
      return Array.from(map.values());
    }
    if (!map.size) {
      map.set(`|${draftName}`, {
        type: 'comment',
        code: '',
        name: draftName,
      });
    }
    return Array.from(map.values());
  }, [
    commentDraft.code,
    commentDraft.memo,
    commentDraft.name,
    commentDraft.unit,
    debouncedCommentKeyword,
    commentSearchQuery.data,
    selectionCommentCandidates,
  ]);
  const selectableCommentOptions = useMemo(
    () =>
      commentMasterOptions.filter((item) => {
        const code = item.code?.trim();
        const name = item.name?.trim();
        return Boolean(code && name);
      }),
    [commentMasterOptions],
  );
  const unsupportedSelectionCommentCandidates = useMemo(
    () => selectionCommentCandidates.filter((item) => hasUnsupportedCommentSelectionParameter(item)),
    [selectionCommentCandidates],
  );

  const resolvePredictiveItem = (value: string) => {
    const normalized = normalizePredictiveLabel(value);
    if (!normalized) return null;
    return (
      itemPredictiveCandidates.find((candidate) => normalizePredictiveLabel(candidate.label) === normalized)?.item ??
      itemPredictiveCandidates.find((candidate) => normalizePredictiveLabel(candidate.item.name) === normalized)?.item ??
      itemPredictiveCandidates.find((candidate) => normalizePredictiveLabel(candidate.item.code ?? '') === normalized)?.item ??
      null
    );
  };

  const autoFillUsageFromYouhouCode = useCallback(
    async (youhouCode: string) => {
      const normalizedCode = youhouCode.trim();
      if (!normalizedCode) return;
      if (!supportsUsageSearch) return;
      try {
        const result = await fetchOrderMasterSearch({
          type: 'youhou',
          keyword: normalizedCode,
          effective: form.startDate?.trim() || undefined,
        });
        if (!result.ok) return;
        const matched =
          result.items.find((item) => item.code?.trim() === normalizedCode) ??
          result.items.find((item) => normalizeUsageCode(item.youhouCode) === normalizeUsageCode(normalizedCode)) ??
          result.items[0];
        if (!matched) return;
        setForm((prev) => {
          if (prev.admin.trim()) return prev;
          return {
            ...prev,
            admin: formatUsageLabel(matched),
            adminCode: matched.code?.trim() ?? '',
          };
        });
        setSelectedUsageMasterMeta(buildUsageMasterMeta(matched));
      } catch {
        // Keep manual input workflow when auto completion fails.
      }
    },
    [form.startDate, supportsUsageSearch],
  );

  const applyPredictiveItem = (rowId: string | undefined, matched: OrderMasterSearchItem | null) => {
    if (!rowId || !matched) return;
    const chargeClassMeta = resolveChargeSelectionClassMeta(entity, matched);
    if (isChargeEntity(entity) && !chargeClassMeta) {
      setNotice({ tone: 'error', message: buildUnsupportedChargeSelectionMessage(entity) });
      clearValidationByKeys([
        'invalid_charge_class_code',
        'invalid_charge_item_category',
        'missing_charge_item_category',
        'invalid_charge_class_name',
      ]);
      return;
    }
    const promoteToMaterial = matched.type === 'material' || shouldTreatAsMaterialItem(entity, matched.code?.trim() ?? '');
    setForm((prev) => {
      const updateRow = (row: OrderBundleItem) => ({
        ...row,
        code: matched.code ?? row.code,
        name: matched.name,
        unit: row.unit?.trim() ? row.unit : matched.unit ?? '',
        memo: row.memo?.trim() ? row.memo : matched.note ?? '',
        category: matched.category?.trim() || undefined,
        masterCategory: matched.category?.trim() || undefined,
        itemNumber: matched.itemNumber?.trim() || undefined,
        itemNumberBranch: matched.itemNumberBranch?.trim() || undefined,
      });
      let promotedMaterialRow: OrderBundleItemWithRowId | null = null;
      const nextItems = ensureTrailingEmptyMainItem(
        prev.items.map((row) => {
          const currentRow = row as OrderBundleItemWithRowId;
          if (currentRow.rowId !== rowId) return row;
          if (!promoteToMaterial) {
            return updateRow(row);
          }
          promotedMaterialRow = ensureRowId({ ...updateRow(row), rowRole: 'material' });
          return buildEmptyItem();
        }),
      );
      const nextMaterialItems = prev.materialItems.map((row) => {
        const currentRow = row as OrderBundleItemWithRowId;
        if (currentRow.rowId !== rowId) return row;
        return ensureRowId({ ...updateRow(row), rowRole: 'material' });
      });
      if (promotedMaterialRow) {
        nextMaterialItems.push(promotedMaterialRow);
      }
      return {
        ...prev,
        classCode: chargeClassMeta?.classCode ?? prev.classCode,
        classCodeSystem: chargeClassMeta?.classCodeSystem ?? prev.classCodeSystem,
        className: chargeClassMeta?.className ?? prev.className,
        items: nextItems,
        materialItems: nextMaterialItems,
      };
    });
    clearValidationByKeys([
      'invalid_charge_class_code',
      'invalid_charge_item_category',
      'missing_charge_item_category',
      'missing_charge_class_name',
      'invalid_charge_class_name',
    ]);
    const youhouCode = matched.youhouCode?.trim();
    if (supportsUsageSearch && !form.admin.trim() && youhouCode) {
      void autoFillUsageFromYouhouCode(youhouCode);
    }
  };

  const applyPredictiveItemSelection = (rowId: string | undefined, value: string) => {
    applyPredictiveItem(rowId, resolvePredictiveItem(value));
  };

  const applyCommentDraftSelection = useCallback((selected: {
    code?: string;
    name?: string;
    unit?: string;
    note?: string;
    itemNumber?: string;
    itemNumberBranch?: string;
  }) => {
    const selectedName = selected.name?.trim();
    if (!selectedName) return;
    if (hasUnsupportedCommentSelectionParameter(selected)) {
      setNotice({ tone: 'error', message: UNSUPPORTED_COMMENT_PARAMETER_MESSAGE });
      return;
    }
    setCommentDraft((prev) => ({
      ...prev,
      code: selected.code?.trim() ?? '',
      name: selectedName,
      unit: selected.unit ?? prev.unit ?? '',
      memo: selected.note ?? prev.memo ?? '',
    }));
  }, []);

  useEffect(() => {
    if (!supportsCommentCodes) return;
    if (isBlocked) return;
    if (commentDraft.code?.trim()) return;
    const normalized = normalizePredictiveLabel(commentDraft.name);
    if (!normalized) return;
    const selected =
      selectableCommentOptions.find((item) => normalizePredictiveLabel(item.name) === normalized) ??
      selectableCommentOptions.find((item) => normalizePredictiveLabel(formatMasterLabel(item)) === normalized) ??
      null;
    if (!selected) return;
    applyCommentDraftSelection(selected);
  }, [applyCommentDraftSelection, commentDraft.code, commentDraft.name, isBlocked, selectableCommentOptions, supportsCommentCodes]);

  const applyRecommendation = (candidate: OrderRecommendationCandidate) => {
    if (isBlocked) return;
    const nextForm = toFormStateFromRecommendation(entity, candidate.template, today);
    const firstComment = candidate.template.commentItems[0] ?? { code: '', name: '', quantity: '', unit: '', memo: '' };
    setForm(nextForm);
    setSelectedUsageMasterMeta(null);
    setCommentDraft(firstComment);
    setNotice({
      tone: 'info',
      message: `頻用オーダーを反映しました（${candidate.source === 'patient' ? '患者傾向' : '施設傾向'} / ${candidate.count}回）。`,
    });
  };

  const applyOrcaSetForm = useCallback((nextForm: BundleFormState) => {
    setForm(nextForm);
    setSelectedUsageMasterMeta(null);
    setValidationIssues([]);
    setNotice({ tone: 'success', message: 'ORCA診療セットを反映しました。' });
  }, []);

  const handleOrcaSetSearch = useCallback(async () => {
    const keyword = orcaSetKeyword.trim();
    if (!keyword || orcaSetLoading || isMedOrder) return;
    setOrcaSetLoading(true);
    try {
      const result = await fetchOrcaOrderInputSets({
        keyword,
        entity,
        effective: form.startDate,
        page: 1,
        size: 20,
      });
      if (!result.ok) {
        setOrcaSetItems([]);
        setNotice({ tone: 'error', message: result.message ?? '診療セット検索に失敗しました。' });
        return;
      }
      setOrcaSetItems(result.items);
    } finally {
      setOrcaSetLoading(false);
    }
  }, [entity, form.startDate, isMedOrder, orcaSetKeyword, orcaSetLoading]);

  const handleOrcaSetApply = useCallback(
    async (item: OrcaOrderInputSetSummary) => {
      const setCode = item.setCode?.trim();
      if (!setCode || isMedOrder) return;
      const detail = await fetchOrcaOrderInputSetDetail({
        setCode,
        entity,
        effective: form.startDate,
      });
      if (!detail.ok || !detail.bundle) {
        setNotice({ tone: 'error', message: detail.message ?? '診療セット詳細の取得に失敗しました。' });
        return;
      }
      const requestedEntity = resolveCanonicalOrderEntity(entity);
      const detailEntity = resolveCanonicalOrderEntity(detail.bundle.entity);
      if (!matchesOrcaInputSetEntity(requestedEntity, detailEntity, detail.bundle.classCode)) {
        setNotice({ tone: 'error', message: 'entity が一致しないため診療セットを反映できません。' });
        return;
      }
      const nextForm = toFormState(toOrderBundleFromInputSetDetail(detail.bundle, entity), today);
      const nextFormIssues = validateBundleForm({
        form: nextForm,
        entity,
        bundleLabel,
      });
      const chargeIssues = nextFormIssues.filter((issue) => isChargeConsistencyIssueKey(issue.key));
      if (chargeIssues.length > 0) {
        setNotice({ tone: 'error', message: chargeIssues[0]?.message ?? 'charge 診療セットを反映できません。' });
        return;
      }
      if (nextFormIssues.some((issue) => issue.key === 'unsupported_selection_comment_parameter')) {
        setNotice({ tone: 'error', message: UNSUPPORTED_COMMENT_PARAMETER_MESSAGE });
        return;
      }
      if (isBundleFormEmpty(form)) {
        applyOrcaSetForm(nextForm);
        return;
      }
      setPendingOrcaSetForm(nextForm);
      setOrcaSetConfirmOpen(true);
    },
    [applyOrcaSetForm, entity, form, isMedOrder, today],
  );

  const pushRecentUsage = useCallback(
    (value: string) => {
      const normalized = value.trim();
      if (!normalized) return;
      setRecentUsageHistory((prev) => {
        const next = appendRecentUsageHistory(prev, normalized);
        saveRecentUsageHistory(recentUsageStorageKey, next);
        return next;
      });
    },
    [recentUsageStorageKey],
  );

  const applyUsage = (item: OrderMasterSearchItem) => {
    const label = formatUsageLabel(item);
    clearValidationByKeys(['missing_usage', USAGE_DAYS_LIMIT_ERROR_KEY]);
    setForm((prev) => ({
      ...prev,
      admin: label,
      adminCode: item.code?.trim() ?? '',
    }));
    setSelectedUsageMasterMeta(buildUsageMasterMeta(item));
  };

  const applyUsageSelection = (value: string): boolean => {
    const normalized = normalizePredictiveLabel(value);
    if (!normalized) return false;
    const selected =
      usageSelectOptions.find((item) => normalizePredictiveLabel(formatUsageLabel(item)) === normalized) ??
      usageSelectOptions.find((item) => normalizePredictiveLabel(item.name) === normalized) ??
      null;
    if (!selected) return false;
    applyUsage(selected);
    return true;
  };
  const applyUsageSelectionByOptionKey = (value: string): boolean => {
    if (!value) return false;
    const selected = usageSelectOptions.find((item) => buildUsageOptionKey(item) === value) ?? null;
    if (!selected) return false;
    applyUsage(selected);
    return true;
  };

  const applyRecentUsageSelection = (value: string) => {
    const nextValue = value.trim();
    if (!nextValue) return;
    if (applyUsageSelection(nextValue)) return;
    clearValidationByKeys(['missing_usage', USAGE_DAYS_LIMIT_ERROR_KEY]);
    setForm((prev) => ({
      ...prev,
      admin: nextValue,
      adminCode: '',
    }));
    setSelectedUsageMasterMeta(null);
    void normalizeUsageInput(nextValue);
  };

  const normalizeUsageInput = async (rawValue: string) => {
    void rawValue;
  };

  const setMixingCommentEnabled = (enabled: boolean) => {
    setForm((prev) => {
      const others = prev.commentItems.filter((item) => item.memo !== MIXING_COMMENT_MARKER);
      if (!enabled) {
        if (others.length === prev.commentItems.length) return prev;
        return { ...prev, commentItems: others };
      }
      const current = prev.commentItems.find((item) => item.memo === MIXING_COMMENT_MARKER);
      const mixingItem: OrderBundleItem =
        current ?? { code: '810000001', name: '混合', quantity: '', unit: '', memo: MIXING_COMMENT_MARKER };
      return { ...prev, commentItems: [...others, mixingItem] };
    });
  };

  const updateMixingCommentText = (text: string) => {
    setForm((prev) => {
      const index = prev.commentItems.findIndex((item) => item.memo === MIXING_COMMENT_MARKER);
      if (index === -1) return prev;
      const next = [...prev.commentItems];
      next[index] = { ...next[index], name: text };
      // Keep mixing comment at the very end to match ORCA's RP comment constraint.
      const [updated] = next.splice(index, 1);
      next.push(updated);
      return { ...prev, commentItems: next };
    });
  };

  const applyMixingTemplate = (templateText: string) => {
    setForm((prev) => {
      const others = prev.commentItems.filter((item) => item.memo !== MIXING_COMMENT_MARKER);
      const current = prev.commentItems.find((item) => item.memo === MIXING_COMMENT_MARKER);
      const mixingItem: OrderBundleItem = {
        ...(current ?? { code: '810000001', quantity: '', unit: '', memo: MIXING_COMMENT_MARKER }),
        name: templateText,
        memo: MIXING_COMMENT_MARKER,
      };
      return { ...prev, commentItems: [...others, mixingItem] };
    });
  };

  const applyBodyPart = (item: OrderMasterSearchItem) => {
    clearValidationByKeys(['missing_body_part', 'missing_body_part_code']);
    setForm((prev) => ({
      ...prev,
      bodyPart: {
        code: item.code,
        name: item.name,
        quantity: '',
        unit: item.unit ?? '',
        memo: item.note ?? '',
      },
    }));
  };

  const appendCommentItem = (item: { code?: string; name?: string; unit?: string; note?: string }) => {
    const code = item.code?.trim() ?? '';
    const name = item.name?.trim() ?? '';
    if (!code || !name) return;
    setForm((prev) => {
      if (prev.commentItems.some((entry) => entry.code?.trim() === code && entry.name.trim() === name)) {
        return prev;
      }
      const nextComment = {
        code,
        name,
        quantity: '',
        unit: item.unit ?? '',
        memo: item.note ?? '',
      };
      return {
        ...prev,
        commentItems: [...prev.commentItems, nextComment],
      };
    });
    setCommentDraft({
      code,
      name,
      quantity: '',
      unit: item.unit ?? '',
      memo: item.note ?? '',
    });
  };

  const resolveBundleClassMeta = (bundleForm: BundleFormState) => {
    if (!isMedOrder) {
      const primaryChargeItem = bundleForm.items.find((item) => item.name?.trim() || item.code?.trim());
      const chargeClassMeta = resolveCanonicalChargeClassMeta({
        entity,
        classCode: bundleForm.classCode,
        itemCategory: resolveChargeItemMasterCategory(entity, primaryChargeItem),
      });
      if (chargeClassMeta) {
        return {
          classCode: chargeClassMeta.classCode,
          classCodeSystem: PRESCRIPTION_CLASS_CODE_SYSTEM,
          className: chargeClassMeta.className,
        };
      }
      const explicitClassCode = bundleForm.classCode?.trim();
      const explicitClassName = bundleForm.className?.trim();
      if (explicitClassCode || explicitClassName) {
        return {
          classCode: explicitClassCode || undefined,
          classCodeSystem: bundleForm.classCodeSystem?.trim() || PRESCRIPTION_CLASS_CODE_SYSTEM,
          className: explicitClassName || undefined,
        };
      }
      return {};
    }
    const classCode = resolvePrescriptionClassCode(bundleForm.prescriptionTiming, bundleForm.prescriptionLocation);
    return {
      classCode,
      classCodeSystem: PRESCRIPTION_CLASS_CODE_SYSTEM,
      className: resolvePrescriptionClassName(classCode),
    };
  };

  const applyBundleNameCorrection = (bundleForm: BundleFormState) => {
    if (bundleForm.bundleName.trim()) return bundleForm;

    if (entity === 'medOrder') {
      const corrected = resolveMedOrderBundleName({
        bundleName: bundleForm.bundleName,
        items: bundleForm.items,
        prescriptionTiming: bundleForm.prescriptionTiming,
        prescriptionLocation: bundleForm.prescriptionLocation,
      });
      if (!corrected.trim() || corrected === bundleForm.bundleName) return bundleForm;
      return { ...bundleForm, bundleName: corrected };
    }

    // MVP: For base editor entities, auto-fill bundle name from the first item.
    // This reduces friction vs legacy EditorSet where "bundle label" was often implicit.
    if (import.meta.env.VITE_ORDER_EDIT_MVP === '1') {
      const candidate = bundleForm.items.find((item) => item.name.trim())?.name.trim() ?? '';
      if (candidate) return { ...bundleForm, bundleName: candidate };
    }

    return bundleForm;
  };

  const copyFromHistory = (bundle: OrderBundle) => {
    if (isBlocked) {
      setNotice({ tone: 'error', message: '編集ガード中のため履歴コピーはできません。' });
      logAuditEvent({
        runId: meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_ORDER_HISTORY_COPY',
          outcome: 'blocked',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            runId: meta.runId,
            operationPhase: 'copy',
            entity,
            patientId,
            sourceDocumentId: bundle.documentId,
            sourceModuleId: bundle.moduleId,
            bundleName: bundle.bundleName,
            itemCount: countItems(bundle.items),
            blockedReasons: guardReasonKeys.length > 0 ? guardReasonKeys : ['edit_guard'],
          },
        },
      });
      return;
    }
    const nextForm = toFormStateFromHistoryCopy(bundle, today);
    setForm(nextForm);
    setSelectedUsageMasterMeta(null);
    setNotice({ tone: 'info', message: '履歴をコピーしました。内容を確認して反映してください。' });
    logAuditEvent({
      runId: meta.runId,
      cacheHit: meta.cacheHit,
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      dataSourceTransition: meta.dataSourceTransition,
      payload: {
        action: 'CHARTS_ORDER_HISTORY_COPY',
        outcome: 'success',
        subject: 'charts',
        details: {
          ...auditMetaDetails,
          runId: meta.runId,
          operationPhase: 'copy',
          entity,
          patientId,
          sourceDocumentId: bundle.documentId,
          sourceModuleId: bundle.moduleId,
          bundleName: bundle.bundleName,
          itemCount: countItems(bundle.items),
        },
      },
    });
  };

  const lastExternalHistoryCopyRequestIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!historyCopyRequest) return;
    if (historyCopyRequest.requestId === lastExternalHistoryCopyRequestIdRef.current) return;
    lastExternalHistoryCopyRequestIdRef.current = historyCopyRequest.requestId;
    if (isPreviewMode) {
      onHistoryCopyConsumed?.(historyCopyRequest.requestId);
      return;
    }
    copyFromHistory(historyCopyRequest.bundle);
    setValidationIssues([]);
    focusFirstField();
    onHistoryCopyConsumed?.(historyCopyRequest.requestId);
  }, [copyFromHistory, focusFirstField, historyCopyRequest, isPreviewMode, onHistoryCopyConsumed]);

  const lastExternalRequestIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!request) return;
    if (request.requestId === lastExternalRequestIdRef.current) return;
    lastExternalRequestIdRef.current = request.requestId;
    if (isPreviewMode) {
      if (request.kind === 'edit') {
        setForm(toFormState(request.bundle, today));
        setSelectedUsageMasterMeta(null);
        setContraConfirmPayload(null);
      } else if (request.kind === 'copy') {
        setForm(toFormStateFromHistoryCopy(request.bundle, today));
        setSelectedUsageMasterMeta(null);
        setContraConfirmPayload(null);
      }
      onRequestConsumed?.(request.requestId);
      return;
    }
    switch (request.kind) {
      case 'new': {
        resetEditorForm();
        break;
      }
      case 'edit': {
        setForm(toFormState(request.bundle, today));
        setSelectedUsageMasterMeta(null);
        setNotice(null);
        setContraNotice(null);
        setContraDetails([]);
        setContraConfirmPayload(null);
        setBodyPartKeyword('');
        break;
      }
      case 'copy': {
        copyFromHistory(request.bundle);
        break;
      }
      case 'recommendation': {
        applyRecommendation(request.candidate);
        setContraConfirmPayload(null);
        break;
      }
      case 'orca-set': {
        void handleOrcaSetApply(request.candidate);
        setContraConfirmPayload(null);
        break;
      }
      case 'input-set': {
        break;
      }
      default: {
        // exhaustive
      }
    }
    setValidationIssues([]);
    focusFirstField();
    onRequestConsumed?.(request.requestId);
  }, [
    applyRecommendation,
    copyFromHistory,
    entity,
    focusFirstField,
    isPreviewMode,
    onRequestConsumed,
    request,
    resetEditorForm,
    today,
  ]);

  const isDaysBasedPrescription =
    isMedOrder && (form.prescriptionTiming === 'regular' || form.prescriptionTiming === 'gaiyo');
  const bundleNumberLabel = isMedOrder
    ? isDaysBasedPrescription
      ? '日数'
      : '回数'
    : '回数';
  const bundleNumberPlaceholder = isMedOrder
    ? isDaysBasedPrescription
      ? '例: 7'
      : '例: 1'
    : '1';
  const canEditBundleNumber = !isMedOrder || form.admin.trim().length > 0;
  const bundleNumberDisabled = isBlocked || !canEditBundleNumber;
  const bundleNumberHelp = isMedOrder
    ? form.admin.trim()
      ? isDaysBasedPrescription
        ? form.prescriptionTiming === 'gaiyo'
          ? '外用は日数として扱われます。'
          : '通常処方は日数として扱われます。'
        : '頓用は回数として扱われます。'
      : isDaysBasedPrescription
        ? '用法入力後に日数を入力できます。'
        : '用法入力後に回数を入力できます。'
    : '';

  const closeContraConfirm = useCallback((result: boolean) => {
    setContraConfirmOpen(false);
    setIsContraChecking(false);
    const resolve = contraConfirmResolveRef.current;
    contraConfirmResolveRef.current = null;
    setContraConfirmPayload(null);
    resolve?.(result);
  }, []);

  const runOfficialContraindicationCheck = async (bundleForm: BundleFormState) => {
    setIsContraChecking(true);
    setContraNotice(null);
    setContraDetails([]);
    setContraConfirmPayload(null);
    try {
      const medications = collectBundleItems(bundleForm)
        .filter((item) => item.rowRole === 'main')
        .map((item) => ({
          medicationCode: item.code?.trim() ?? '',
          medicationName: item.name?.trim() || undefined,
        }))
        .filter((item) => item.medicationCode && isDrugMedicationCode(item.medicationCode));
      if (medications.length === 0) {
        return true;
      }
      const result = await fetchOrcaContraindicationCheck({
        patientId,
        performMonth: bundleForm.startDate,
        requestNumber: '01',
        checkTerm: '1',
        medications,
      });
      logAuditEvent({
        runId: result.runId ?? meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'ORCA_OFFICIAL_CONTRAINDICATION_CHECK',
          outcome: result.ok ? (result.results.length > 0 || result.symptomInfo.length > 0 ? 'warning' : 'success') : 'error',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            patientId,
            performMonth: normalizePerformMonth(bundleForm.startDate) ?? bundleForm.startDate,
            requestNumber: '01',
            checkTerm: '1',
            apiResult: result.apiResult,
            apiResultMessage: result.apiResultMessage,
            httpStatus: result.status,
          },
        },
      });
      if (!result.ok || (result.apiOk === false && !result.results.length && !result.symptomInfo.length)) {
        const message = result.apiResultMessage ?? result.message ?? '患者別 ORCA 禁忌チェックに失敗しました。';
        setContraNotice({
          tone: 'error',
          message,
          detail: result.apiResult ? `Api_Result: ${result.apiResult}` : undefined,
        });
        setContraDetails(buildContraindicationDetails(result));
        return false;
      }
      const details = buildContraindicationDetails(result);
      const hasWarning = result.results.length > 0 || result.symptomInfo.length > 0;
      if (!hasWarning) {
        return true;
      }
      const summary = result.apiResultMessage ?? '患者別 ORCA 禁忌チェックで警告が検出されました。';
      setContraNotice({
        tone: 'warning',
        message: summary,
        detail: result.apiResult ? `Api_Result: ${result.apiResult}` : undefined,
      });
      setContraDetails(details);
      setContraConfirmPayload({
        summary,
        details,
        apiResult: result.apiResult,
        apiMessage: result.apiResultMessage,
      });
      setContraConfirmOpen(true);
      return await new Promise<boolean>((resolve) => {
        contraConfirmResolveRef.current = resolve;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '患者別 ORCA 禁忌チェックに失敗しました。';
      setContraNotice({
        tone: 'error',
        message,
      });
      setContraDetails([]);
      return false;
    } finally {
      setIsContraChecking(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async (payload: OrderBundleSubmitPayload) => {
      if (isPreviewMode) throw new Error('preview mode');
      if (!patientId) throw new Error('patientId is required');
      if (resolveCanonicalOrderEntity(entity) === 'physiologyOrder') {
        throw new Error('生理検査は official ORCA carrier がないため ORCA 送信を停止します。');
      }
      const filteredItems = collectBundleItems(payload.form)
        .filter((item) => item.name.trim().length > 0)
        .map(stripRowMeta);

      const classMeta = resolveBundleClassMeta(payload.form);
      return executeMutateOrderBundles({
        patientId,
        operations: [
          {
            operation: payload.form.documentId ? 'update' : 'create',
            documentId: payload.form.documentId,
            moduleId: payload.form.moduleId,
            entity,
            bundleName: payload.form.bundleName,
            bundleNumber: payload.form.bundleNumber,
            subtype: resolveFormSubtype(entity, payload.form.subtype) || undefined,
            ...classMeta,
            admin: payload.form.admin,
            adminCode: payload.form.adminCode,
            adminCodeSystem: payload.form.adminCodeSystem,
            adminMemo: payload.form.adminMemo,
            memo: payload.form.memo,
            startDate: payload.form.startDate,
            items: filteredItems,
            bodyPart: resolveOperationBodyPart(entity, payload.form),
          },
        ],
      });
    },
    onSuccess: (result, payload) => {
      const operation = payload.form.documentId ? 'update' : 'create';
      const allItems = collectBundleItems(payload.form);
      const itemCount = countItems(allItems);
      const operationPhase = payload.action === 'save' ? 'save' : payload.action;
      const failureMessage = result.message ?? resolveActionMessage(payload.action, false);
      setNotice({ tone: result.ok ? 'success' : 'error', message: result.ok ? resolveActionMessage(payload.action, true) : failureMessage });
      onSubmitResult?.({ action: payload.action, ok: result.ok });
      recordOutpatientFunnel('charts_action', {
        runId: result.runId ?? meta.runId,
        cacheHit: meta.cacheHit ?? false,
        missingMaster: meta.missingMaster ?? false,
        dataSourceTransition: meta.dataSourceTransition ?? 'server',
        fallbackUsed: meta.fallbackUsed ?? false,
        action: payload.action === 'save' ? operation : payload.action,
        outcome: result.ok ? 'success' : 'error',
        note: payload.form.bundleName,
      });
      logAuditEvent({
        runId: result.runId ?? meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_ORDER_BUNDLE_MUTATION',
          outcome: result.ok ? 'success' : 'error',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            runId: result.runId ?? meta.runId,
            operationPhase,
            operation,
            entity,
            patientId,
            documentId: payload.form.documentId,
            moduleId: payload.form.moduleId,
            bundleName: payload.form.bundleName,
            bundleNumber: payload.form.bundleNumber,
            itemCount,
            materialItemCount: countItems(payload.form.materialItems),
            commentItemCount: countItems(payload.form.commentItems),
            bodyPart: payload.form.bodyPart?.name ?? null,
            ...(result.ok ? {} : { error: failureMessage }),
          },
        },
      });
      if (result.ok) {
        if (supportsUsageSearch) {
          pushRecentUsage(payload.form.admin);
        }
        queryClient.invalidateQueries({ queryKey: recommendationQueryKey });
        if (operation === 'create' && result.createdDocumentIds && result.createdDocumentIds.length > 0) {
          const createdDocumentId = result.createdDocumentIds[0];
          const classMeta = resolveBundleClassMeta(payload.form);
          const normalizedItems = collectBundleItems(payload.form)
            .filter((item) => item.name.trim().length > 0)
            .map(stripRowMeta);
          const optimisticEntry: OrderBundle = {
            documentId: createdDocumentId,
            moduleId: payload.form.moduleId,
            entity,
            bundleName: payload.form.bundleName,
            bundleNumber: payload.form.bundleNumber,
            subtype: resolveFormSubtype(entity, payload.form.subtype) || undefined,
            classCode: classMeta.classCode,
            classCodeSystem: classMeta.classCodeSystem,
            className: classMeta.className,
            admin: payload.form.admin,
            adminCode: payload.form.adminCode,
            adminCodeSystem: payload.form.adminCodeSystem,
            adminMemo: payload.form.adminMemo,
            memo: payload.form.memo,
            started: payload.form.startDate,
            items: normalizedItems,
            bodyPart: resolveOperationBodyPart(entity, payload.form),
          };
          setOptimisticBundles((prev) => {
            if (prev.some((bundle) => bundle.documentId === createdDocumentId)) return prev;
            return [optimisticEntry, ...prev];
          });
        }
        if (operation === 'update' && payload.form.documentId) {
          const classMeta = resolveBundleClassMeta(payload.form);
          const normalizedItems = collectBundleItems(payload.form)
            .filter((item) => item.name.trim().length > 0)
            .map(stripRowMeta);
          setOptimisticBundles((prev) =>
            prev.map((bundle) =>
              bundle.documentId === payload.form.documentId
                ? {
                    ...bundle,
                    bundleName: payload.form.bundleName,
                    bundleNumber: payload.form.bundleNumber,
                    subtype: resolveFormSubtype(entity, payload.form.subtype) || undefined,
                    classCode: classMeta.classCode,
                    classCodeSystem: classMeta.classCodeSystem,
                    className: classMeta.className,
                    admin: payload.form.admin,
                    adminCode: payload.form.adminCode,
                    adminCodeSystem: payload.form.adminCodeSystem,
                    adminMemo: payload.form.adminMemo,
                    memo: payload.form.memo,
                    started: payload.form.startDate,
                    items: normalizedItems,
                    bodyPart: resolveOperationBodyPart(entity, payload.form),
                  }
                : bundle,
            ),
          );
        }
        queryClient.invalidateQueries({ queryKey });
        if (patientId) {
          // Also refresh same-day summary queries (they use visitDate as key part, not entity).
          queryClient.invalidateQueries({ queryKey: ['charts-order-bundles', patientId] });
          if (entity === 'medOrder') {
            queryClient.invalidateQueries({ queryKey: ['charts-prescription-bundles', patientId] });
          }
        }
        if (payload.action !== 'expand_continue') {
          setForm(buildEmptyForm(today));
        }
        setValidationIssues([]);
        if (payload.action === 'expand') {
          onClose?.();
        }
      }
    },
    onError: (error: unknown, payload: OrderBundleSubmitPayload) => {
      const message = error instanceof Error ? error.message : String(error);
      const allItems = collectBundleItems(payload.form);
      const itemCount = countItems(allItems);
      const operationPhase = payload.action === 'save' ? 'save' : payload.action;
      setNotice({ tone: 'error', message: `${resolveActionMessage(payload.action, false)}: ${message}` });
      onSubmitResult?.({ action: payload.action, ok: false });
      logAuditEvent({
        runId: meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_ORDER_BUNDLE_MUTATION',
          outcome: 'error',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            runId: meta.runId,
            operationPhase,
            operation: payload.form.documentId ? 'update' : 'create',
            entity,
            patientId,
            documentId: payload.form.documentId,
            moduleId: payload.form.moduleId,
            bundleName: payload.form.bundleName,
            bundleNumber: payload.form.bundleNumber,
            itemCount,
            materialItemCount: countItems(payload.form.materialItems),
            commentItemCount: countItems(payload.form.commentItems),
            bodyPart: payload.form.bodyPart?.name ?? null,
            error: message,
          },
        },
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (bundle: OrderBundle) => {
      if (isPreviewMode) throw new Error('preview mode');
      if (!patientId) throw new Error('patientId is required');
      return executeMutateOrderBundles({
        patientId,
        operations: [
          {
            operation: 'delete',
            documentId: bundle.documentId,
            moduleId: bundle.moduleId,
            entity,
          },
        ],
      });
    },
    onSuccess: (result, bundle) => {
      const itemCount = bundle.items?.length ?? 0;
      const failureMessage = result.message ?? 'オーダーの削除に失敗しました。';
      setNotice({ tone: result.ok ? 'success' : 'error', message: result.ok ? 'オーダーを削除しました。' : failureMessage });
      logAuditEvent({
        runId: result.runId ?? meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_ORDER_BUNDLE_MUTATION',
          outcome: result.ok ? 'success' : 'error',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            runId: result.runId ?? meta.runId,
            operation: 'delete',
            entity,
            patientId,
            documentId: bundle.documentId,
            moduleId: bundle.moduleId,
            bundleName: bundle.bundleName,
            bundleNumber: bundle.bundleNumber,
            itemCount,
            ...(result.ok ? {} : { error: failureMessage }),
          },
        },
      });
      if (result.ok) {
        if (bundle.documentId) {
          setOptimisticBundles((prev) => prev.filter((entry) => entry.documentId !== bundle.documentId));
        }
        queryClient.invalidateQueries({ queryKey });
        if (patientId) {
          queryClient.invalidateQueries({ queryKey: ['charts-order-bundles', patientId] });
          if (entity === 'medOrder') {
            queryClient.invalidateQueries({ queryKey: ['charts-prescription-bundles', patientId] });
          }
        }
      }
    },
    onError: (error: unknown, bundle) => {
      const message = error instanceof Error ? error.message : String(error);
      const itemCount = bundle.items?.length ?? 0;
      setNotice({ tone: 'error', message: `オーダーの削除に失敗しました: ${message}` });
      logAuditEvent({
        runId: meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_ORDER_BUNDLE_MUTATION',
          outcome: 'error',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            runId: meta.runId,
            operation: 'delete',
            entity,
            patientId,
            documentId: bundle.documentId,
            moduleId: bundle.moduleId,
            bundleName: bundle.bundleName,
            bundleNumber: bundle.bundleNumber,
            itemCount,
            error: message,
          },
        },
      });
    },
  });

  const isSaving = mutation.isPending || isContraChecking;
  const fetchedBundles = bundlesOverride ?? bundleQuery.data?.bundles ?? [];
  useEffect(() => {
    if (optimisticBundles.length === 0 || fetchedBundles.length === 0) return;
    const fetchedIds = new Set(
      fetchedBundles
        .map((bundle) => bundle.documentId)
        .filter((id): id is number => typeof id === 'number' && id > 0),
    );
    if (fetchedIds.size === 0) return;
    setOptimisticBundles((prev) =>
      prev.filter((bundle) => {
        if (!bundle.documentId || !fetchedIds.has(bundle.documentId)) return true;
        const fetched = fetchedBundles.find((entry) => entry.documentId === bundle.documentId);
        return fetched ? !isOptimisticBundleSynced(fetched, bundle) : true;
      }),
    );
  }, [fetchedBundles, optimisticBundles.length]);
  const bundles = useMemo(() => {
    if (optimisticBundles.length === 0) return fetchedBundles;
    const optimisticById = new Map(
      optimisticBundles
        .filter((bundle) => typeof bundle.documentId === 'number' && bundle.documentId > 0)
        .map((bundle) => [bundle.documentId as number, bundle]),
    );
    const fetchedIds = new Set(
      fetchedBundles
        .map((bundle) => bundle.documentId)
        .filter((id): id is number => typeof id === 'number' && id > 0),
    );
    const pending = optimisticBundles.filter((bundle) => !bundle.documentId || !fetchedIds.has(bundle.documentId));
    const mergedFetched = fetchedBundles.map((bundle) => {
      const optimistic = typeof bundle.documentId === 'number' ? optimisticById.get(bundle.documentId) : undefined;
      return optimistic ?? bundle;
    });
    return [...pending, ...mergedFetched];
  }, [fetchedBundles, optimisticBundles]);

  const orcaWarningsForActiveBundle = useMemo(() => {
    if (!form.documentId) return [];
    return orcaWarningsForEntity.filter((warning) => warning.documentId === form.documentId);
  }, [form.documentId, orcaWarningsForEntity]);

  const orcaWarningTargets = useMemo(() => {
    const items = new Set<number>();
    const commentItems = new Set<number>();
    let usage = false;
    let bodyPart = false;
    orcaWarningsForActiveBundle.forEach((warning) => {
      const resolved = resolveWarningFocusTarget(warning);
      if (!resolved) return;
      if (resolved.target.kind === 'usage') usage = true;
      if (resolved.target.kind === 'bodyPart') bodyPart = true;
      if (resolved.target.kind === 'items') items.add(resolved.target.index);
      if (resolved.target.kind === 'commentItems') commentItems.add(resolved.target.index);
    });
    if (warningFocusTarget?.kind === 'usage') usage = true;
    if (warningFocusTarget?.kind === 'bodyPart') bodyPart = true;
    if (warningFocusTarget?.kind === 'items') items.add(warningFocusTarget.index);
    if (warningFocusTarget?.kind === 'commentItems') commentItems.add(warningFocusTarget.index);
    return { usage, bodyPart, items, commentItems };
  }, [orcaWarningsForActiveBundle, resolveWarningFocusTarget, warningFocusTarget]);

  const requestWarningFocus = useCallback(
    (warning: OrcaMedicalWarningUi) => {
      setWarningFocusRequest(warning);
      if (warning.documentId && warning.documentId !== form.documentId) {
        const nextBundle = bundles.find((bundle) => bundle.documentId === warning.documentId) ?? null;
        if (nextBundle) {
          setForm(toFormState(nextBundle, today));
          setNotice({ tone: 'info', message: 'ORCA警告の該当オーダーを表示しました。' });
        }
      }
    },
    [bundles, form.documentId, today],
  );

  useEffect(() => {
    if (!warningFocusRequest) return;
    if (warningFocusRequest.entity && warningFocusRequest.entity !== entity) {
      setWarningFocusRequest(null);
      return;
    }
    if (warningFocusRequest.documentId && form.documentId !== warningFocusRequest.documentId) return;
    const resolved = resolveWarningFocusTarget(warningFocusRequest);
    setWarningFocusRequest(null);
    if (!resolved) return;
    setWarningFocusTarget(resolved.target);
    if (typeof document === 'undefined') return;
    requestAnimationFrame(() => {
      const el = document.getElementById(resolved.elementId);
      if (!el || !(el instanceof HTMLElement)) return;
      safeScrollIntoView(el, { block: 'center' });
      el.focus();
    });
  }, [
    entity,
    form.bodyPart,
    form.commentItems.length,
    form.documentId,
    form.items.length,
    resolveWarningFocusTarget,
    warningFocusRequest,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ patientId?: string; warning?: OrcaMedicalWarningUi }>).detail;
      if (detail?.patientId && detail.patientId !== patientId) return;
      const warning = detail?.warning;
      if (!warning) return;
      if (warning.entity && warning.entity !== entity) return;
      requestWarningFocus(warning);
    };
    window.addEventListener('orca-medical-warning-focus', handler);
    return () => {
      window.removeEventListener('orca-medical-warning-focus', handler);
    };
  }, [entity, patientId, requestWarningFocus]);

  const focusFirstValidationIssue = useCallback(
    (issues: BundleValidationIssue[], bundleForm: BundleFormState) => {
      if (issues.length === 0) return;
      if (typeof document === 'undefined') return;
      const hasAnyValue = (item: OrderBundleItem) =>
        Boolean(item.name?.trim() || item.code?.trim() || item.quantity?.trim() || item.unit?.trim() || item.memo?.trim());
      const resolveTargetId = (key: string) => {
        switch (key) {
          case 'rp_required':
            return `${entityId}-rp-required-warning`;
          case 'missing_usage':
          case 'invalid_injection_class_code':
            return `${entityId}-admin`;
          case 'missing_body_part':
            return `${entityId}-bodypart`;
          case 'missing_body_part_code':
            return `${entityId}-bodypart`;
          case 'missing_items':
          case 'missing_main_row':
          case 'invalid_charge_item_category':
          case 'unsupported_selection_comment_parameter':
            return `${entityId}-item-name-0`;
          case 'comment_only':
            return `${entityId}-item-name-0`;
          case 'invalid_charge_class_code':
          case 'missing_charge_class_name':
          case 'invalid_charge_class_name':
            return `${entityId}-bundle-name`;
          case 'mixed_coded_uncoded':
          case 'uncoded_row':
          case 'missing_item_code': {
            const idx = bundleForm.items.findIndex((item) => {
              if (!item.name?.trim() && !item.quantity?.trim() && !item.unit?.trim() && !item.memo?.trim()) {
                return false;
              }
              return !item.code?.trim();
            });
            return idx >= 0 ? `${entityId}-item-code-${idx}` : `${entityId}-item-name-0`;
          }
          case USAGE_DAYS_LIMIT_ERROR_KEY:
            return `${entityId}-bundle-number`;
          case 'invalid_comment_item': {
            const idx = bundleForm.commentItems.findIndex((item) => {
              const hasCode = Boolean(item.code?.trim());
              const hasName = Boolean(item.name?.trim());
              return hasAnyValue(item) && (!hasCode || !hasName);
            });
            return idx >= 0 ? `${entityId}-comment-name-${idx}` : `${entityId}-comment-draft-name`;
          }
          case 'invalid_comment_code': {
            const idx = bundleForm.commentItems.findIndex((item) => {
              const code = item.code?.trim();
              return Boolean(code && !isOrderBundleCommentCode(code));
            });
            return idx >= 0 ? `${entityId}-comment-name-${idx}` : `${entityId}-comment-draft-name`;
          }
          default:
            return null;
        }
      };
      const targetId = issues.map((issue) => resolveTargetId(issue.key)).find((id): id is string => Boolean(id));
      if (!targetId) return;
      requestAnimationFrame(() => {
        const el = document.getElementById(targetId);
        if (!el || !(el instanceof HTMLElement)) return;
        safeScrollIntoView(el, { block: 'center' });
        el.focus();
      });
    },
    [entityId],
  );

  const submitAction = (action: OrderBundleSubmitAction) => {
    if (isContraChecking) return;
    void (async () => {
    if (isPreviewMode) {
      setNotice({ tone: 'info', message: 'プレビューモードでは保存できません。' });
      return;
    }
    if (isBlocked) {
      setNotice({ tone: 'error', message: `保存操作を停止: ${saveBlockedReason}` });
      logAuditEvent({
        runId: meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_ORDER_BUNDLE_MUTATION',
          outcome: 'blocked',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            runId: meta.runId,
            operation: form.documentId ? 'update' : 'create',
            entity,
            patientId,
            bundleName: form.bundleName,
            bundleNumber: form.bundleNumber,
            itemCount: countItems(collectBundleItems(form)),
            materialItemCount: countItems(form.materialItems),
            commentItemCount: countItems(form.commentItems),
            bodyPart: form.bodyPart?.name ?? null,
            blockedReasons: guardReasonKeys.length > 0 ? guardReasonKeys : ['edit_guard'],
            operationPhase: 'lock',
          },
        },
      });
      return;
    }
    const normalizedForm = applyBundleNameCorrection(form);
    if (normalizedForm !== form) {
      setForm(normalizedForm);
    }
    const validationIssuesBeforeRp = validateBundleForm({
      form: normalizedForm,
      entity,
      bundleLabel,
      usageDaysLimit: selectedUsageDaysLimit,
    });
    const rpRequiredIssue = resolveRpRequiredIssue({
      entity,
      bundleName: normalizedForm.bundleName,
      classCode: isMedOrder
        ? resolvePrescriptionClassCode(normalizedForm.prescriptionTiming, normalizedForm.prescriptionLocation)
        : normalizedForm.classCode?.trim(),
      bundleNumber: normalizedForm.bundleNumber,
      items: normalizedForm.items,
    });
    if (rpRequiredIssue) {
      const message = buildRpRequiredEditorMessage(rpRequiredIssue);
      const uncodedInjectionIssues = validationIssuesBeforeRp.filter(
        (issue) => issue.key === 'uncoded_row' || issue.key === 'mixed_coded_uncoded',
      );
      if (uncodedInjectionIssues.length > 0) {
        setNotice({ tone: 'error', message: uncodedInjectionIssues[0]?.message ?? message });
        setValidationIssues(validationIssuesBeforeRp);
        focusFirstValidationIssue(validationIssuesBeforeRp, normalizedForm);
        return;
      }
      setNotice({ tone: 'error', message });
      setValidationIssues([{ key: 'rp_required', message }]);
      focusFirstValidationIssue([{ key: 'rp_required', message }], normalizedForm);
      return;
    }
    const validationIssues = validationIssuesBeforeRp;
    if (validationIssues.length > 0) {
      setNotice({ tone: 'error', message: validationIssues[0].message });
      setValidationIssues(validationIssues);
      if (validationIssues.some((issue) => issue.key === 'invalid_comment_item' || issue.key === 'invalid_comment_code')) {
        setCommentsFoldOpen(true);
      }
      focusFirstValidationIssue(validationIssues, normalizedForm);
      logAuditEvent({
        runId: meta.runId,
        cacheHit: meta.cacheHit,
        missingMaster: meta.missingMaster,
        fallbackUsed: meta.fallbackUsed,
        dataSourceTransition: meta.dataSourceTransition,
        payload: {
          action: 'CHARTS_ORDER_BUNDLE_MUTATION',
          outcome: 'blocked',
          subject: 'charts',
          details: {
            ...auditMetaDetails,
            runId: meta.runId,
            operation: normalizedForm.documentId ? 'update' : 'create',
            entity,
            patientId,
            bundleName: normalizedForm.bundleName,
            bundleNumber: normalizedForm.bundleNumber,
            itemCount: countItems(collectBundleItems(normalizedForm)),
            materialItemCount: countItems(normalizedForm.materialItems),
            commentItemCount: countItems(normalizedForm.commentItems),
            bodyPart: normalizedForm.bodyPart?.name ?? null,
            blockedReasons: validationIssues.map((issue) => issue.key),
            validationMessages: validationIssues.map((issue) => issue.message),
            operationPhase: 'lock',
          },
        },
      });
      return;
    }
    const canContinue = await runOfficialContraindicationCheck(normalizedForm);
    if (!canContinue) return;
    setValidationIssues([]);
    mutation.mutate({ form: normalizedForm, action });
    })();
  };

  const reorderItems = (items: OrderBundleItem[], fromIndex: number, toIndex: number) => {
    const nextItems = [...items];
    const [moved] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, moved);
    return nextItems;
  };

  const clearItemRows = () => {
    setClearRowsDialogOpen(true);
  };

  const confirmClearItemRows = () => {
    setClearRowsDialogOpen(false);
    setForm((prev) => ({
      ...prev,
      items: [buildEmptyItem()],
      materialItems: [],
      commentItems: [],
    }));
    setCommentDraft({ code: '', name: '', quantity: '', unit: '', memo: '' });
  };

  const removeItemRowById = (rowId?: string | null) => {
    if (!rowId) return;
    setForm((prev) => {
      const nextItems =
        prev.items.length > 1
          ? prev.items.filter((item) => (item as OrderBundleItemWithRowId).rowId !== rowId)
          : [buildEmptyItem()];
      return { ...prev, items: nextItems };
    });
  };

  const removeMaterialRowById = (rowId?: string | null) => {
    if (!rowId) return;
    setForm((prev) => ({
      ...prev,
      materialItems: prev.materialItems.filter((item) => (item as OrderBundleItemWithRowId).rowId !== rowId),
    }));
  };

  const removeSelectedItemRow = () => removeItemRowById(selectedItemRowId);

  useEffect(() => {
    const normalizedItems = ensureTrailingEmptyMainItem(form.items);
    if (normalizedItems === form.items) return;
    setForm((prev) => {
      if (prev.items !== form.items) return prev;
      return { ...prev, items: normalizedItems };
    });
  }, [form.items]);

  useEffect(() => {
    const rows = [...form.items, ...form.materialItems];
    if (rows.length === 0) {
      setSelectedItemRowId(null);
      return;
    }
    const exists = selectedItemRowId
      ? rows.some((item) => (item as OrderBundleItemWithRowId).rowId === selectedItemRowId)
      : false;
    if (!exists) {
      setSelectedItemRowId((rows[0] as OrderBundleItemWithRowId).rowId ?? null);
    }
  }, [form.items, form.materialItems, selectedItemRowId]);

  const validationByKey = useMemo(() => {
    const map = new Map<string, string>();
    validationIssues.forEach((issue) => {
      if (!map.has(issue.key)) map.set(issue.key, issue.message);
    });
    return map;
  }, [validationIssues]);
  const usageError =
    validationByKey.get('missing_usage') ??
    validationByKey.get('invalid_injection_class_code');
  const bundleNumberError = validationByKey.get(USAGE_DAYS_LIMIT_ERROR_KEY);
  const itemsError =
    validationByKey.get('missing_items') ??
    validationByKey.get('missing_main_row') ??
    validationByKey.get('comment_only') ??
    validationByKey.get('unsupported_material_item') ??
    validationByKey.get('invalid_other_order_code');
  const subtypeError = validationByKey.get('missing_test_subtype') ?? validationByKey.get('invalid_test_subtype');
  const bodyPartError =
    validationByKey.get('unsupported_body_part') ??
    validationByKey.get('missing_body_part') ??
    validationByKey.get('missing_body_part_code');
  const commentError =
    validationByKey.get('invalid_comment_item') ?? validationByKey.get('invalid_comment_code');
  const hasInjectionUncodedValidation =
    isInjectionOrder && (validationByKey.has('uncoded_row') || validationByKey.has('mixed_coded_uncoded'));
  const injectionUncodedMainRows = useMemo(() => {
    if (!hasInjectionUncodedValidation) return new Set<number>();
    return new Set(
      form.items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => hasOrderBundleItemValue(item) && !item.code?.trim())
        .map(({ index }) => index),
    );
  }, [form.items, hasInjectionUncodedValidation]);
  const injectionUncodedMaterialRows = useMemo(() => {
    if (!hasInjectionUncodedValidation) return new Set<number>();
    return new Set(
      form.materialItems
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => hasOrderBundleItemValue(item) && !item.code?.trim())
        .map(({ index }) => index),
    );
  }, [form.materialItems, hasInjectionUncodedValidation]);

  const invalidCommentIndices = useMemo(() => {
    if (!commentError) return new Set<number>();
    const hasAnyValue = (item: OrderBundleItem) =>
      Boolean(
        item.name?.trim() ||
          item.code?.trim() ||
          item.quantity?.trim() ||
          item.unit?.trim() ||
          item.memo?.trim(),
      );
    const indices = new Set<number>();
    form.commentItems.forEach((item, index) => {
      const hasCode = Boolean(item.code?.trim());
      const hasName = Boolean(item.name?.trim());
      const hasValue = hasAnyValue(item);
      const invalidCode = hasCode && !isOrderBundleCommentCode(item.code!.trim());
      if (invalidCode || (hasValue && (!hasCode || !hasName))) indices.add(index);
    });
    return indices;
  }, [commentError, form.commentItems]);

  if (!patientId) {
    return <p className="charts-side-panel__empty">患者IDが未選択のため {title} を開始できません。</p>;
  }

  return (
    <section
      className="charts-side-panel__section"
      data-order-entity={entity}
      data-test-id={`${entityId}-edit-panel`}
      data-rp-required={rpRequiredIssueForForm ? 'true' : 'false'}
      data-rp-required-missing={rpRequiredIssueForForm ? rpRequiredIssueForForm.missing.join(',') : ''}
    >
      <FocusTrapDialog
        open={contraConfirmOpen}
        title="患者別 ORCA 禁忌チェックの警告"
        description={contraConfirmPayload?.summary}
        role="alertdialog"
        onClose={() => closeContraConfirm(false)}
        testId="contraindication-confirm"
      >
        <div className="charts-side-panel__confirm">
          <p className="charts-side-panel__message">
            患者別 ORCA 禁忌チェックで警告が検出されました。確認のうえ、保存を続行するか編集に戻って修正してください。
          </p>
          <p className="charts-side-panel__help">
            この確認は official patient-aware contraindicationcheckv2 です。ORCA マスタ参照の静的相互作用チェックとは別です。
          </p>
          {contraConfirmPayload?.apiResult ? (
            <p className="charts-side-panel__help">
              Api_Result: {contraConfirmPayload.apiResult}
              {contraConfirmPayload.apiMessage ? ` / ${contraConfirmPayload.apiMessage}` : ''}
            </p>
          ) : null}
          {contraConfirmPayload?.details?.length ? (
            <ul className="charts-side-panel__confirm-list">
              {contraConfirmPayload.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <div
            className="charts-side-panel__actions charts-side-panel__actions--dialog"
            role="group"
            aria-label="患者別 ORCA 禁忌チェックの確認"
          >
            <button type="button" className="charts-side-panel__action" onClick={() => closeContraConfirm(false)}>
              編集に戻る
            </button>
            <button type="button" className="charts-side-panel__action charts-side-panel__action--save" onClick={() => closeContraConfirm(true)}>
              今回だけ無視して保存
            </button>
          </div>
        </div>
      </FocusTrapDialog>
      <FocusTrapDialog
        open={orcaSetConfirmOpen}
        role="alertdialog"
        title="診療セットを反映しますか？"
        description="現在の入力内容は置き換えられます。"
        onClose={() => {
          setOrcaSetConfirmOpen(false);
          setPendingOrcaSetForm(null);
        }}
        testId="orca-order-set-confirm"
      >
        <div className="charts-side-panel__confirm">
          <div className="charts-side-panel__actions charts-side-panel__actions--dialog" role="group" aria-label="診療セット反映の確認">
            <button
              type="button"
              className="charts-side-panel__action"
              onClick={() => {
                setOrcaSetConfirmOpen(false);
                setPendingOrcaSetForm(null);
              }}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="charts-side-panel__action charts-side-panel__action--save"
              onClick={() => {
                if (pendingOrcaSetForm) {
                  applyOrcaSetForm(pendingOrcaSetForm);
                }
                setOrcaSetConfirmOpen(false);
                setPendingOrcaSetForm(null);
              }}
            >
              反映する
            </button>
          </div>
        </div>
      </FocusTrapDialog>
      <FocusTrapDialog
        open={clearRowsDialogOpen}
        role="alertdialog"
        title="入力を全クリアしますか？"
        description={`${orderUiProfile.mainItemLabel}・コメント入力を初期化します。`}
        onClose={() => setClearRowsDialogOpen(false)}
        testId="order-bundle-clear-all-dialog"
      >
        <section className="charts-tab-guard" aria-label="オーダー入力全クリア確認">
          <dl className="charts-actions__send-confirm-list">
            <div>
              <dt>対象</dt>
              <dd>{title}</dd>
            </div>
            <div>
              <dt>患者ID</dt>
              <dd>{patientId}</dd>
            </div>
            <div>
              <dt>影響範囲</dt>
              <dd>{orderUiProfile.mainItemLabel}・コメント入力がすべて消去されます。</dd>
            </div>
          </dl>
          <div className="charts-tab-guard__actions" role="group" aria-label="オーダー入力全クリア操作">
            <button type="button" onClick={() => setClearRowsDialogOpen(false)}>
              キャンセル
            </button>
            <button type="button" className="charts-tab-guard__danger" onClick={confirmClearItemRows}>
              クリアする
            </button>
          </div>
        </section>
      </FocusTrapDialog>
      <header className="charts-side-panel__section-header">
        <div className="charts-side-panel__section-header-main">
          <strong>{title}</strong>
        </div>
        <button
          type="button"
          className="charts-side-panel__ghost charts-side-panel__ghost--reset"
          onClick={resetEditorForm}
          disabled={isBlocked}
        >
          新規入力
        </button>
      </header>

      <div className="charts-side-panel__dock-body" ref={editorScrollRef}>
      {isBlocked && (
        <div id={editBlockedReasonId} className="charts-side-panel__notice charts-side-panel__notice--info">
          編集はブロックされています: {blockReasons.join(' / ')}
        </div>
      )}
      {notice && <div className={`charts-side-panel__notice charts-side-panel__notice--${notice.tone}`}>{notice.message}</div>}
      {contraNotice && (
        <div className={`charts-side-panel__notice charts-side-panel__notice--${contraNotice.tone}`}>
          <div>{contraNotice.message}</div>
          {contraNotice.detail ? <div className="charts-side-panel__notice-detail">{contraNotice.detail}</div> : null}
          {contraDetails.length > 0 ? (
            <ul className="charts-side-panel__contra-list">
              {contraDetails.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
          {contraNotice.tone === 'error' ? (
            <button
              type="button"
              className="charts-side-panel__notice-action charts-side-panel__notice-action--retry"
              onClick={() => void runOfficialContraindicationCheck(form)}
              disabled={isContraChecking}
            >
              {isContraChecking ? '再実行中…' : '患者別 ORCA 禁忌チェックを再実行'}
            </button>
          ) : null}
        </div>
      )}
      {orcaWarningsForEntity.length > 0 && (
        <div className="charts-side-panel__notice charts-side-panel__notice--warning" aria-live={resolveAriaLive('warning')}>
          <div className="charts-side-panel__warning-header">
            <strong>ORCA 警告</strong> <span>{orcaWarningsForEntity.length}件</span>
          </div>
          <ul className="charts-side-panel__warning-list">
            {orcaWarningsForEntity.slice(0, 8).map((warning, index) => {
              const key = `${warning.groupPosition ?? 'g'}-${warning.itemPosition ?? 'l'}-${warning.code ?? ''}-${index}`;
              const pos = warning.groupPosition
                ? `G${warning.groupPosition}${warning.itemPosition ? `-L${warning.itemPosition}` : ''}`
                : '位置不明';
              const text = warning.message ?? warning.medicalWarning ?? warning.code ?? '警告';
              return (
                <li key={key}>
                  <button type="button" className="charts-side-panel__warning-button" onClick={() => requestWarningFocus(warning)}>
                    <span className="charts-side-panel__warning-pos">{pos}</span>
                    <span className="charts-side-panel__warning-text">{text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {orcaWarningsForEntity.length > 8 && (
            <p className="charts-side-panel__help">他 {orcaWarningsForEntity.length - 8} 件</p>
          )}
        </div>
      )}
      {rpRequiredIssueForForm ? (
        <div
          id={`${entityId}-rp-required-warning`}
          className="charts-side-panel__notice charts-side-panel__notice--warning"
          role="status"
          tabIndex={-1}
          aria-live={resolveAriaLive('warning')}
          data-test-id={`${entityId}-rp-required-warning`}
        >
          <div>
            <strong>{RP_REQUIRED_ERROR_LABEL}</strong>
          </div>
          <p className="charts-side-panel__notice-detail">{buildRpRequiredEditorMessage(rpRequiredIssueForForm)}</p>
          <ul className="charts-side-panel__notice-list" aria-label="不足しているRP必須項目">
            {rpRequiredIssueForForm.missing.map((field) => (
              <li key={`${entityId}-${field}`}>{resolveRpRequiredFieldLabel(field)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="charts-side-panel__workspace" data-variant={variant} data-order-editor-layout="manual-first">
        {showRecommendationSidebar ? (
          <aside className="charts-side-panel__workspace-left charts-order-editor__secondary" aria-label="候補・セット・登録済みオーダー">
            <details className="charts-side-panel__subsection charts-order-editor__secondary-section">
              <summary className="charts-side-panel__subheader charts-order-editor__secondary-summary">
                <strong>頻用オーダー（患者優先）</strong>
                <span className="charts-side-panel__search-count">{recommendationCandidates.length}件</span>
                <span className="charts-side-panel__fold-badge">候補を開く</span>
              </summary>
              {recommendationCandidates.length === 0 ? (
                <p className="charts-side-panel__empty">
                  まだ学習データがありません。保存済みオーダーから候補ボタンを自動生成します。
                </p>
              ) : (
                <div className="charts-side-panel__template-actions" aria-label="頻用オーダー候補">
                  {recommendationCandidates.map((candidate) => (
                    <button
                      key={candidate.key}
                      type="button"
                      className="charts-side-panel__chip-button charts-side-panel__chip-button--recommend"
                      onClick={() => applyRecommendation(candidate)}
                      disabled={isBlocked}
                      title={`${resolveRecommendationLabel(candidate)} / ${candidate.source === 'patient' ? '患者傾向' : '施設傾向'} / ${candidate.count}回`}
                    >
                      {resolveRecommendationLabel(candidate)}
                      {` (${candidate.source === 'patient' ? '患者' : '施設'}:${candidate.count})`}
                    </button>
                  ))}
                </div>
              )}
              <p className="charts-side-panel__help">患者個別候補を優先し、不足分のみ施設候補で補完します。</p>
            </details>
          </aside>
        ) : null}

        <div className="charts-side-panel__workspace-right charts-side-panel__workspace-right--full">
          <form
            className="charts-side-panel__form charts-order-editor__manual-primary"
            onSubmit={(event) => {
              event.preventDefault();
              submitAction('save');
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              const target = event.target;
              if (target instanceof HTMLSelectElement) return;
              if (!(target instanceof HTMLInputElement)) return;
              if (['checkbox', 'radio', 'button', 'submit'].includes(target.type)) return;
              if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                submitAction('save');
                return;
              }
              // Prevent accidental submit while editing fields.
              event.preventDefault();
            }}
          >
            <div className="charts-side-panel__field charts-side-panel__meta-section charts-side-panel__meta-section--bundle charts-order-editor__manual-card">
              <label htmlFor={`${entityId}-bundle-name`}>{bundleLabel}</label>
              <input
                id={`${entityId}-bundle-name`}
                value={form.bundleName}
                onChange={(event) => setForm((prev) => ({ ...prev, bundleName: event.target.value }))}
                placeholder={orderUiProfile.bundleNamePlaceholder}
                disabled={isBlocked}
              />
            </div>
        {supportsEtensuDetailSearch && (
          <details
            className="charts-side-panel__subsection charts-side-panel__meta-section charts-order-editor__secondary-section"
            open={detailSearchOpen}
            onToggle={(event) => setDetailSearchOpen(event.currentTarget.open)}
          >
            <summary className="charts-side-panel__subheader charts-order-editor__secondary-summary">
              <strong>点数検索（詳細）</strong>
              <span className="charts-side-panel__fold-badge">候補を開く</span>
            </summary>
            {pointsRangeSummary ? <p className="charts-side-panel__help">{pointsRangeSummary}</p> : null}
            {detailSearchOpen ? (
              <div className="charts-side-panel__field-row">
                <div className="charts-side-panel__field">
                  <label htmlFor={`${entityId}-points-min`}>点数From</label>
                  <input
                    id={`${entityId}-points-min`}
                    value={pointsMinInput}
                    onChange={(event) => setPointsMinInput(event.target.value)}
                    inputMode="decimal"
                    disabled={isBlocked}
                  />
                </div>
                <div className="charts-side-panel__field">
                  <label htmlFor={`${entityId}-points-max`}>点数To</label>
                  <input
                    id={`${entityId}-points-max`}
                    value={pointsMaxInput}
                    onChange={(event) => setPointsMaxInput(event.target.value)}
                    inputMode="decimal"
                    disabled={isBlocked}
                  />
                </div>
              </div>
            ) : null}
            {pointsRangeError ? (
              <p className="charts-side-panel__field-error" role="alert">
                {pointsRangeError}
              </p>
            ) : null}
          </details>
        )}
        {!isMedOrder && showOrcaSetChooser ? (
          <details className="charts-side-panel__subsection charts-side-panel__meta-section charts-order-editor__secondary-section">
            <summary className="charts-side-panel__subheader charts-order-editor__secondary-summary">
              <strong>ORCA診療セット</strong>
              <span className="charts-side-panel__search-count">{orcaSetItems.length}件</span>
              <span className="charts-side-panel__fold-badge">候補を開く</span>
            </summary>
            <div className="charts-side-panel__field">
              <label htmlFor={`${entityId}-orca-set-keyword`}>keyword</label>
              <input
                id={`${entityId}-orca-set-keyword`}
                value={orcaSetKeyword}
                onChange={(event) => setOrcaSetKeyword(event.target.value)}
                placeholder="診療セット名またはコード"
                disabled={isBlocked}
              />
            </div>
            <button
              type="button"
              className="charts-side-panel__action charts-side-panel__action--search"
              onClick={() => void handleOrcaSetSearch()}
              disabled={isBlocked || orcaSetLoading || !orcaSetKeyword.trim()}
            >
              {orcaSetLoading ? '検索中…' : 'セット検索'}
            </button>
            <p className="charts-side-panel__help">
              {sendContractNote || 'ORCA診療セットは下書きフォームへ反映するだけです。処方確定・ORCA送信・会計済み確定は行いません。'}
            </p>
            {form.sourceSetCode ? (
              <p className="charts-side-panel__help">反映元 setCode: {form.sourceSetCode}（local-only）</p>
            ) : null}
            {orcaSetItems.length > 0 ? (
              <div className="charts-side-panel__search-table">
                <div className="charts-side-panel__search-header">
                  <span>setCode</span>
                  <span>name</span>
                  <span>itemCount</span>
                  <span>反映</span>
                </div>
                {orcaSetItems.map((item) => (
                  <button
                    key={`orca-set-${item.setCode ?? item.name}`}
                    type="button"
                    className="charts-side-panel__search-row"
                    onClick={() => void handleOrcaSetApply(item)}
                    disabled={isBlocked}
                  >
                    <span>{item.setCode ?? '-'}</span>
                    <span>{item.name ?? '-'}</span>
                    <span>{item.itemCount ?? '-'}</span>
                    <span>反映</span>
                  </button>
                ))}
              </div>
            ) : null}
          </details>
        ) : null}
        {isMedOrder && (
          <div className="charts-side-panel__field-row charts-side-panel__meta-section charts-side-panel__meta-section--rx-class">
            <div className="charts-side-panel__field">
              <label>院内/院外</label>
              <div className="charts-side-panel__switch-group" role="group" aria-label="院内院外">
                {PRESCRIPTION_LOCATION_OPTIONS.map((option) => (
                  <button
                    key={`${entityId}-prescription-location-${option.value}`}
                    type="button"
                    className="charts-side-panel__switch-button"
                    data-active={form.prescriptionLocation === option.value ? 'true' : 'false'}
                    aria-pressed={form.prescriptionLocation === option.value}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        prescriptionLocation: option.value,
                      }))
                    }
                    disabled={isBlocked}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="charts-side-panel__field">
              <label>剤区分</label>
              <div className="charts-side-panel__switch-group" role="group" aria-label="剤区分">
                {PRESCRIPTION_TIMING_OPTIONS.map((option) => (
                  <button
                    key={`${entityId}-prescription-timing-${option.value}`}
                    type="button"
                    className="charts-side-panel__switch-button"
                    data-active={form.prescriptionTiming === option.value ? 'true' : 'false'}
                    aria-pressed={form.prescriptionTiming === option.value}
                    onClick={() => {
                      clearValidationByKeys([USAGE_DAYS_LIMIT_ERROR_KEY]);
                      setForm((prev) => ({
                        ...prev,
                        prescriptionTiming: option.value,
                      }));
                    }}
                    disabled={isBlocked}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {isGaiyoPrescription && (
          <div className="charts-side-panel__field charts-side-panel__meta-section charts-side-panel__meta-section--mixing">
            <label className="charts-side-panel__toggle">
              <input
                id={`${entityId}-mixing`}
                name={`${entityId}-mixing`}
                type="checkbox"
                checked={mixingEnabled}
                onChange={(event) => setMixingCommentEnabled(event.target.checked)}
                disabled={isBlocked}
              />
              混合
            </label>
            {mixingEnabled && (
              <>
                <div className="charts-side-panel__template-actions" aria-label="混合テンプレート">
                  <button type="button" className="charts-side-panel__chip-button" onClick={() => applyMixingTemplate('混合')} disabled={isBlocked}>
                    混合
                  </button>
                  <button type="button" className="charts-side-panel__chip-button" onClick={() => applyMixingTemplate('別包')} disabled={isBlocked}>
                    別包
                  </button>
                  <button type="button" className="charts-side-panel__chip-button" onClick={() => applyMixingTemplate('患者指示優先')} disabled={isBlocked}>
                    患者指示優先
                  </button>
                </div>
                <input
                  id={`${entityId}-mixing-comment`}
                  name={`${entityId}-mixing-comment`}
                  value={mixingComment?.name ?? ''}
                  onChange={(event) => updateMixingCommentText(event.target.value)}
                  placeholder="混合コメント"
                  disabled={isBlocked}
                />
              </>
            )}
            <p className="charts-side-panel__message">
              外用の混合コメントは RP 末尾へ自動配置します。必要に応じてテンプレボタンで文言を補正できます。
            </p>
          </div>
        )}
        <div className="charts-side-panel__field-row charts-side-panel__meta-section charts-side-panel__meta-section--usage charts-order-editor__manual-card">
          <div className="charts-side-panel__field" data-invalid={usageError ? 'true' : undefined}>
            <label htmlFor={`${entityId}-admin`}>{orderUiProfile.instructionLabel}</label>
            {supportsUsageSearch ? (
              <select
                id={`${entityId}-admin`}
                value={selectedUsageOptionKey}
                data-orca-warning={orcaWarningTargets.usage ? 'true' : undefined}
                aria-invalid={usageError ? 'true' : undefined}
                onFocus={() => {
                  if (usageSearchQuery.data || usageSearchQuery.isFetching) return;
                  void usageSearchQuery.refetch();
                }}
                onChange={(event) => {
                  clearValidationByKeys(['missing_usage', USAGE_DAYS_LIMIT_ERROR_KEY]);
                  const selected = event.target.value;
                  if (!selected) {
                    setForm((prev) => ({
                      ...prev,
                      admin: '',
                      adminCode: '',
                    }));
                    setSelectedUsageMasterMeta(null);
                    return;
                  }
                  const matched = applyUsageSelectionByOptionKey(selected);
                  if (!matched) {
                    setForm((prev) => ({
                      ...prev,
                      admin: '',
                      adminCode: '',
                    }));
                    setSelectedUsageMasterMeta(null);
                  }
                }}
                disabled={isBlocked}
              >
                <option value="">
                  {usageSearchQuery.isFetching ? usageUiCopy.usageLoadingLabel : usageUiCopy.usageSelectPlaceholder}
                </option>
                {usageSelectOptions.map((item) => {
                  const optionKey = buildUsageOptionKey(item);
                  return (
                    <option key={`usage-option-${optionKey}`} value={optionKey}>
                      {item.name}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                id={`${entityId}-admin`}
                value={form.admin}
                data-orca-warning={orcaWarningTargets.usage ? 'true' : undefined}
                aria-invalid={usageError ? 'true' : undefined}
                onChange={(event) => {
                  clearValidationByKeys(['missing_usage', USAGE_DAYS_LIMIT_ERROR_KEY]);
                  setForm((prev) => ({ ...prev, admin: event.target.value, adminCode: '' }));
                  setSelectedUsageMasterMeta(null);
                }}
                placeholder={orderUiProfile.instructionPlaceholder}
                disabled={isBlocked}
              />
            )}
            {supportsUsageSearch && (
              <>
                <label htmlFor={`${entityId}-admin-recent`}>{usageUiCopy.recentUsageLabel}</label>
                <select
                  id={`${entityId}-admin-recent`}
                  value=""
                  onChange={(event) => applyRecentUsageSelection(event.target.value)}
                  disabled={isBlocked || recentUsageHistory.length === 0}
                >
                  <option value="">{usageUiCopy.usageSelectPlaceholder}</option>
                  {recentUsageHistory.map((usage) => (
                    <option key={`${entityId}-recent-usage-${usage}`} value={usage}>
                      {usage}
                    </option>
                  ))}
                </select>
              </>
            )}
            {usageError ? (
              <p className="charts-side-panel__field-error" role="alert">
                {usageError}
              </p>
            ) : null}
            {usageLocalOnlyHelp ? <p className="charts-side-panel__help">{usageLocalOnlyHelp}</p> : null}
            {!supportsUsageSearch && instructionLocalOnlyHelp ? (
              <p className="charts-side-panel__help">{instructionLocalOnlyHelp}</p>
            ) : null}
            {supportsUsageSearch && selectedUsageSummary && (
              <p className="charts-side-panel__help">{selectedUsageSummary}</p>
            )}
            {supportsUsageSearch && typeof selectedUsageDosePerDay === 'number' && (
              <p className="charts-side-panel__help">1日量目安: {selectedUsageDosePerDay}（参考表示のみ）</p>
            )}
            {supportsUsageSearch && usageSearchQuery.isFetching && (
              <p className="charts-side-panel__help">{usageUiCopy.usageSearchHelp}</p>
            )}
            {supportsUsageSearch && usageSearchQuery.data?.ok && (
              <p className="charts-side-panel__help">候補 {usageItems.length}件（最大 {MAX_USAGE_SELECT_OPTIONS}件）</p>
            )}
            {supportsUsageSearch && usageSearchQuery.data && !usageSearchQuery.data.ok && (
              <div className="charts-side-panel__notice charts-side-panel__notice--error">
                {usageSearchQuery.data.message ?? usageUiCopy.usageSearchError}
              </div>
            )}
          </div>
          <div className="charts-side-panel__field">
            <label htmlFor={`${entityId}-bundle-number`}>{bundleNumberLabel}</label>
            <input
              id={`${entityId}-bundle-number`}
              value={form.bundleNumber}
              onChange={(event) => {
                clearValidationByKeys([USAGE_DAYS_LIMIT_ERROR_KEY]);
                setForm((prev) => ({ ...prev, bundleNumber: event.target.value }));
              }}
              placeholder={bundleNumberPlaceholder}
              disabled={bundleNumberDisabled}
            />
            {isMedOrder && bundleNumberHelp && (
              <p className="charts-side-panel__help">{bundleNumberHelp}</p>
            )}
            {isMedOrder && typeof selectedUsageDaysLimit === 'number' && (
              <p className="charts-side-panel__help">
                {usageUiCopy.usageDaysLimitLabel}: {selectedUsageDaysLimit}日
              </p>
            )}
            {bundleNumberError ? (
              <p className="charts-side-panel__field-error" role="alert">
                {bundleNumberError}
              </p>
            ) : null}
          </div>
        </div>
        {isCompactOrderLayout ? (
          <details className="charts-side-panel__fold charts-side-panel__meta-section charts-side-panel__meta-section--start">
            <summary className="charts-side-panel__fold-summary">
              <span>詳細入力（開始日・メモ）</span>
              <span className="charts-side-panel__fold-meta">
                <span className="charts-side-panel__fold-count">
                  {[
                    form.startDate ? '開始日' : null,
                    form.memo?.trim() ? orderUiProfile.memoLabel : null,
                  ]
                    .filter(Boolean)
                    .join(' / ') || '未入力'}
                </span>
              </span>
            </summary>
            <div className="charts-side-panel__fold-content">
              <div className="charts-side-panel__subsection">
                <div className="charts-side-panel__field charts-side-panel__meta-section--start">
                  <label htmlFor={`${entityId}-start`}>開始日</label>
                  <input
                    id={`${entityId}-start`}
                    type="date"
                    value={form.startDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                    disabled={isBlocked}
                  />
                </div>
                <div className="charts-side-panel__field charts-side-panel__meta-section--memo">
                  <label htmlFor={`${entityId}-memo`}>{orderUiProfile.memoLabel}</label>
                  <textarea
                    id={`${entityId}-memo`}
                    value={form.memo}
                    onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
                    placeholder={orderUiProfile.memoPlaceholder}
                    disabled={isBlocked}
                  />
                  {isRehabOrder && (
                    <p className="charts-side-panel__message">
                      メモは自由記述の補足欄です。指示・コメントをコードで管理する場合は「コメントコード」に入力してください。
                    </p>
                  )}
                  {memoLocalOnlyHelp ? <p className="charts-side-panel__help">{memoLocalOnlyHelp}</p> : null}
                </div>
                {!isMedOrder ? (
                  <div className="charts-side-panel__field charts-side-panel__meta-section--memo">
                    <label htmlFor={`${entityId}-admin-memo`}>院内補足</label>
                    <textarea
                      id={`${entityId}-admin-memo`}
                      value={form.adminMemo}
                      onChange={(event) => setForm((prev) => ({ ...prev, adminMemo: event.target.value }))}
                      placeholder="院内運用向けの補足を入力"
                      disabled={isBlocked}
                    />
                    <p className="charts-side-panel__help">{adminMemoLocalOnlyHelp}</p>
                  </div>
                ) : null}
                {physiologyContractGuidanceBlock}
              </div>
            </div>
          </details>
        ) : (
          <>
            <div className="charts-side-panel__field charts-side-panel__meta-section charts-side-panel__meta-section--start">
              <label htmlFor={`${entityId}-start`}>開始日</label>
              <input
                id={`${entityId}-start`}
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                disabled={isBlocked}
              />
            </div>
            <div className="charts-side-panel__field charts-side-panel__meta-section charts-side-panel__meta-section--memo">
              <label htmlFor={`${entityId}-memo`}>{orderUiProfile.memoLabel}</label>
              <textarea
                id={`${entityId}-memo`}
                value={form.memo}
                onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
                placeholder={orderUiProfile.memoPlaceholder}
                disabled={isBlocked}
              />
              {isRehabOrder && (
                <p className="charts-side-panel__message">
                  メモは自由記述の補足欄です。指示・コメントをコードで管理する場合は「コメントコード」に入力してください。
                </p>
              )}
              {memoLocalOnlyHelp ? <p className="charts-side-panel__help">{memoLocalOnlyHelp}</p> : null}
            </div>
            {!isMedOrder ? (
              <div className="charts-side-panel__field charts-side-panel__meta-section charts-side-panel__meta-section--memo">
                <label htmlFor={`${entityId}-admin-memo`}>院内補足</label>
                <textarea
                  id={`${entityId}-admin-memo`}
                  value={form.adminMemo}
                  onChange={(event) => setForm((prev) => ({ ...prev, adminMemo: event.target.value }))}
                  placeholder="院内運用向けの補足を入力"
                  disabled={isBlocked}
                />
                <p className="charts-side-panel__help">{adminMemoLocalOnlyHelp}</p>
              </div>
            ) : null}
            {physiologyContractGuidanceBlock}
            {testSubtypeConfig ? (
              <div className="charts-side-panel__field charts-side-panel__meta-section">
                <label htmlFor={`${entityId}-test-subtype`}>{testSubtypeConfig.label}</label>
                {testSubtypeConfig.readOnly ? (
                  <input
                    id={`${entityId}-test-subtype`}
                    value={testSubtypeConfig.options.find((option) => option.value === effectiveTestSubtype)?.label ?? ''}
                    readOnly
                    disabled
                  />
                ) : (
                  <select
                    id={`${entityId}-test-subtype`}
                    value={effectiveTestSubtype}
                    aria-invalid={subtypeError ? 'true' : undefined}
                    onChange={(event) => {
                      clearValidationByKeys(['missing_test_subtype', 'invalid_test_subtype']);
                      setForm((prev) => ({ ...prev, subtype: event.target.value as OrderTestSubtype | '' }));
                    }}
                    disabled={isBlocked}
                  >
                    <option value="">選択してください</option>
                    {testSubtypeConfig.options.map((option) => (
                      <option key={`test-subtype-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
                <p className="charts-side-panel__help">{testSubtypeConfig.helpText}</p>
                {subtypeError ? (
                  <p className="charts-side-panel__field-error" role="alert">
                    {subtypeError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}

        {showBodyPartSection && (
          <div className="charts-side-panel__subsection charts-side-panel__subsection--search charts-side-panel__meta-section charts-side-panel__meta-section--bodypart charts-order-editor__manual-card">
            <div className="charts-side-panel__subheader">
              <strong>{supportsBodyPartSearch ? (isRadiologyOrder ? '部位' : '部位（リハビリ）') : 'bodyPart'}</strong>
              {isRadiologyOrder && (
                <span
                  className={`charts-side-panel__status ${
                    form.bodyPart?.name?.trim() ? 'charts-side-panel__status--ok' : 'charts-side-panel__status--warn'
                  }`}
                >
                  {form.bodyPart?.name?.trim() ? '入力済み' : '未入力'}
                </span>
              )}
            </div>
            <div className="charts-side-panel__field-row">
              <div className="charts-side-panel__field" data-invalid={bodyPartError ? 'true' : undefined}>
                <label htmlFor={`${entityId}-bodypart`}>部位</label>
                <input
                  id={`${entityId}-bodypart`}
                  value={form.bodyPart?.name ?? ''}
                  data-orca-warning={orcaWarningTargets.bodyPart ? 'true' : undefined}
                  aria-readonly={supportsBodyPartSearch ? 'true' : undefined}
                  aria-invalid={bodyPartError ? 'true' : undefined}
                  onChange={(event) => {
                    clearValidationByKeys(['unsupported_body_part', 'missing_body_part', 'missing_body_part_code']);
                    const nextName = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      bodyPart: {
                        code: prev.bodyPart?.code,
                        name: nextName,
                        quantity: prev.bodyPart?.quantity ?? '',
                        unit: prev.bodyPart?.unit ?? '',
                        memo: prev.bodyPart?.memo ?? '',
                      },
                    }));
                  }}
                  placeholder={supportsBodyPartSearch ? (isRadiologyOrder ? '例: 胸部' : '例: 膝関節') : '保持しない場合はクリアしてください'}
                  disabled={isBlocked}
                  readOnly={supportsBodyPartSearch}
                />
                {bodyPartError ? (
                  <p className="charts-side-panel__field-error" role="alert">
                    {bodyPartError}
                  </p>
                ) : null}
              </div>
              <div className="charts-side-panel__field">
                <label htmlFor={`${entityId}-bodypart-keyword`}>部位検索</label>
                <input
                  id={`${entityId}-bodypart-keyword`}
                  value={bodyPartKeyword}
                  onChange={(event) => setBodyPartKeyword(event.target.value)}
                  placeholder={isRadiologyOrder ? '例: 胸' : '例: 膝'}
                  disabled={isBlocked || !supportsBodyPartSearch}
                />
              </div>
            </div>
            <div className="charts-side-panel__actions">
              <button
                type="button"
                className="charts-side-panel__action charts-side-panel__action--search"
                onClick={() => bodyPartSearchQuery.refetch()}
                disabled={isBlocked || !supportsBodyPartSearch || bodyPartSearchQuery.isFetching}
              >
                部位検索
              </button>
              <button
                type="button"
                className="charts-side-panel__action charts-side-panel__action--clear"
                onClick={() => setForm((prev) => ({ ...prev, bodyPart: null }))}
                disabled={isBlocked || !form.bodyPart?.name}
              >
                部位クリア
              </button>
            </div>
            {!isRadiologyOrder && (
              <p className="charts-side-panel__message">
                {supportsBodyPartSearch
                  ? 'リハビリ部位は任意入力です。部位マスタから選択するか、手入力で補足できます。'
                  : 'この種別では bodyPart を保存・送信しません。値が残っている場合はクリアしてください。'}
              </p>
            )}
            {supportsBodyPartSearch && bodyPartSearchQuery.data && !bodyPartSearchQuery.data.ok && (
              <div className="charts-side-panel__notice charts-side-panel__notice--error" role="alert" aria-live="assertive">
                {bodyPartSearchQuery.data.message ?? '部位マスタの検索に失敗しました。'}
              </div>
            )}
            {supportsBodyPartSearch && bodyPartSearchQuery.data?.ok && (
              <>
                <div className="charts-side-panel__search-count">
                  {bodyPartSearchQuery.isFetching ? '検索中...' : `${bodyPartSearchQuery.data.totalCount ?? 0}件`}
                </div>
                {bodyPartSearchQuery.data.items.length === 0 ? (
                  <p className="charts-side-panel__empty">該当する部位が見つかりません。</p>
                ) : (
                  <div className="charts-side-panel__search-table">
                    <div className="charts-side-panel__search-header">
                      <span>コード</span>
                      <span>名称</span>
                      <span>単位</span>
                      <span>分類</span>
                      <span>備考</span>
                    </div>
                    {bodyPartSearchQuery.data.items.map((item) => (
                      <button
                        key={`bodypart-${item.code ?? item.name}`}
                        type="button"
                        className="charts-side-panel__search-row"
                        onClick={() => applyBodyPart(item)}
                        disabled={isBlocked}
                      >
                        <span>{item.code ?? '-'}</span>
                        <span>{item.name}</span>
                        <span>{item.unit ?? '-'}</span>
                        <span>{item.category ?? '-'}</span>
                        <span>{item.note ?? '-'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="charts-side-panel__subsection charts-side-panel__meta-section charts-side-panel__meta-section--items charts-order-editor__manual-card">
          <div className="charts-side-panel__two-table-layout">
            <div className="charts-side-panel__two-table-fixed" data-testid="order-bundle-confirmed-table">
              <div className="charts-side-panel__subheader">
                <strong>{orderUiProfile.mainItemLabel}</strong>
                <div className="charts-side-panel__subheader-actions">
              <button
                type="button"
                className="charts-side-panel__ghost charts-side-panel__ghost--add"
                onClick={() => {
                  const nextItem = buildEmptyItem();
                  setForm((prev) => ({ ...prev, items: [...prev.items, nextItem] }));
                  setSelectedItemRowId((nextItem as OrderBundleItemWithRowId).rowId ?? null);
                }}
                disabled={isBlocked}
              >
                行追加
              </button>
              <button
                type="button"
                className="charts-side-panel__row-delete"
                onClick={removeSelectedItemRow}
                disabled={isBlocked || !selectedItemRowId}
              >
                行削除
              </button>
              <button
                type="button"
                className="charts-side-panel__ghost charts-side-panel__ghost--danger"
                onClick={clearItemRows}
                disabled={isBlocked}
              >
                入力を全クリア
              </button>
            </div>
          </div>
          {itemsError ? (
            <p className="charts-side-panel__field-error" role="alert">
              {itemsError}
            </p>
          ) : null}
          {itemMemoLocalOnlyHelp ? <p className="charts-side-panel__help">{itemMemoLocalOnlyHelp}</p> : null}
          <p className="charts-side-panel__help">候補対象: {itemPredictiveTargetLabel}</p>
          <p className="charts-side-panel__help">
            {selectedItemPredictionKeyword
                ? itemPredictiveQuery.isFetching
                ? '入力候補を検索中...'
                : itemPredictiveCandidates.length > 0
                  ? `入力候補 ${itemPredictiveCandidates.length}件`
                  : '入力候補はありません。'
              : `項目名の入力確定ごとに、${itemPredictiveTargetLabel}を自動検索します。`}
          </p>
          {itemPredictiveQuery.data?.failedTypes.length ? (
            <div className="charts-side-panel__notice charts-side-panel__notice--warning">
              一部マスタの候補取得に失敗しました: {itemPredictiveFailedTypeLabel}
            </div>
          ) : null}
          {itemPredictiveQuery.data && !itemPredictiveQuery.data.ok && (
            <div className="charts-side-panel__notice charts-side-panel__notice--error">
              {itemPredictiveQuery.data.message ?? '入力候補の検索に失敗しました。'}
            </div>
          )}
          {itemPredictiveQuery.data?.ok && isItemCodeSearch && correctionMeta ? (
            <div className="charts-side-panel__correction">
              <div className="charts-side-panel__correction-header">
                <strong>コード補正候補（official medicationgetv2）</strong>
                <span>
                  Api_Result: {correctionMeta.apiResult ?? '—'} / 有効期限: {correctionMeta.validTo ?? '—'}
                </span>
              </div>
              {correctionMeta.apiResultMessage ? (
                <p className="charts-side-panel__message">{correctionMeta.apiResultMessage}</p>
              ) : null}
            </div>
          ) : null}
          {itemPredictiveCandidates.length > 0 && (
            <datalist id={`${entityId}-item-predictive-list`}>
              {itemPredictiveCandidates.map((candidate, candidateIndex) => (
                <option
                  key={`${candidate.item.code ?? candidate.item.name}-${candidateIndex}`}
                  value={candidate.label}
                >
                  {candidate.item.category ?? ''}
                </option>
              ))}
            </datalist>
          )}
          {form.items.map((item, index) => {
            const rowId = (item as OrderBundleItemWithRowId).rowId;
            const hasRowValue = hasOrderBundleItemValue(item);
            const isInactiveRow = !hasRowValue;
            const supportsItemCommentRow = isMedOrder || isInjectionOrder;
            const resolvedItemFields = supportsItemCommentRow ? resolveOrcaOrderItemFields(item) : null;
            const canEditGenericFlag = isMedOrder || canEditInjectionGenericFlag(entity, item);
            const genericValue = canEditGenericFlag ? resolvedItemFields?.genericFlg ?? '' : '';
            const userCommentValue = resolvedItemFields?.userComment ?? '';
            const genericDisabled = isBlocked || !isDrugMedicationCode(item.code?.trim() ?? '');
            const updateGenericFlag = (nextValue: '' | 'yes' | 'no') => {
              setForm((prev) => {
                const next = [...prev.items];
                const current = next[index];
                if (!current) return prev;
                next[index] = {
                  ...current,
                  genericFlg: nextValue === 'yes' || nextValue === 'no' ? nextValue : undefined,
                };
                return { ...prev, items: next };
              });
            };
            const updateUserComment = (nextValue: string) => {
              setForm((prev) => {
                const next = [...prev.items];
                const current = next[index];
                if (!current) return prev;
                next[index] = {
                  ...current,
                  userComment: nextValue,
                };
                return { ...prev, items: next };
              });
            };
            const rowSummary = [
              `コード: ${item.code?.trim() || '未設定'}`,
              formatItemQuantitySummary(item, itemQuantityLabel),
              ...(isMedOrder
                ? [
                    `${orderUiProfile.instructionLabel}: ${form.admin.trim() || '未入力'}`,
                    `${bundleNumberLabel}: ${form.bundleNumber.trim() || '未入力'}`,
                  ]
                : []),
            ].join(' / ');
            const shouldShowRowSummary = hasRowValue;
            const injectionRowError = injectionUncodedMainRows.has(index) ? INJECTION_UNCODED_MAIN_ROW_MESSAGE : null;
            return (
              <div key={rowId ?? `${entityId}-item-${index}`}>
                <div
                  className={`charts-side-panel__item-row${
                    isInactiveRow ? ' charts-side-panel__item-row--inactive' : ''
                  }${
                    orcaWarningTargets.items.has(index) ? ' charts-side-panel__item-row--orca-warning' : ''
                  }${
                    itemsError && index === 0 ? ' charts-side-panel__item-row--invalid' : ''
                  }${
                    injectionRowError ? ' charts-side-panel__item-row--invalid' : ''
                  }${
                    dragOverIndex === index ? ' charts-side-panel__item-row--drag-over' : ''
                  }${draggingIndex === index ? ' charts-side-panel__item-row--dragging' : ''}${
                    selectedItemRowId === rowId ? ' charts-side-panel__item-row--selected' : ''
                  }`}
                  data-invalid={itemsError && index === 0 || Boolean(injectionRowError) ? 'true' : undefined}
                  data-testid="order-bundle-item-row"
                  onClick={() => setSelectedItemRowId(rowId ?? null)}
                  onDragOver={(event) => {
                    if (isBlocked) return;
                    event.preventDefault();
                    setDragOverIndex(index);
                  }}
                  onDrop={(event) => {
                    if (isBlocked) return;
                    event.preventDefault();
                    const fromIndex = Number(event.dataTransfer.getData('text/plain'));
                    if (Number.isNaN(fromIndex) || fromIndex === index) {
                      setDragOverIndex(null);
                      setDraggingIndex(null);
                      return;
                    }
                    setForm((prev) => ({
                      ...prev,
                      items: reorderItems(prev.items, fromIndex, index),
                    }));
                    setDragOverIndex(null);
                    setDraggingIndex(null);
                  }}
                >
                  <button
                    type="button"
                    className="charts-side-panel__drag-handle"
                    aria-label={`行 ${index + 1} をドラッグして並べ替え`}
                    draggable={!isBlocked}
                    onDragStart={(event) => {
                      if (isBlocked) return;
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', String(index));
                      setDraggingIndex(index);
                    }}
                    onDragEnd={() => {
                      setDragOverIndex(null);
                      setDraggingIndex(null);
                    }}
                    onFocus={() => setSelectedItemRowId(rowId ?? null)}
                    disabled={isBlocked}
                  >
                    ≡
                  </button>
                  <input
                    id={`${entityId}-item-name-${index}`}
                    name={`${entityId}-item-name-${index}`}
                    value={item.name}
                    aria-invalid={itemsError && index === 0 || Boolean(injectionRowError) ? 'true' : undefined}
                    list={
                      rowId === selectedItemRowId && itemPredictiveCandidates.length > 0
                        ? `${entityId}-item-predictive-list`
                        : undefined
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      clearValidationByKeys(['missing_items']);
                      setForm((prev) => {
                        const next = [...prev.items];
                        next[index] = { ...next[index], name: value };
                        return { ...prev, items: next };
                      });
                      applyPredictiveItemSelection(rowId, value);
                    }}
                    onBlur={(event) => applyPredictiveItemSelection(rowId, event.target.value)}
                    onFocus={() => setSelectedItemRowId(rowId ?? null)}
                    placeholder={orderUiProfile.mainItemPlaceholder}
                    disabled={isBlocked}
                  />
                  <input
                    id={`${entityId}-item-quantity-${index}`}
                    name={`${entityId}-item-quantity-${index}`}
                    value={item.quantity ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setForm((prev) => {
                        const next = [...prev.items];
                        next[index] = { ...next[index], quantity: value };
                        return { ...prev, items: next };
                      });
                    }}
                    onFocus={() => setSelectedItemRowId(rowId ?? null)}
                    placeholder={itemQuantityLabel}
                    disabled={isBlocked}
                  />
                  <input
                    id={`${entityId}-item-unit-${index}`}
                    name={`${entityId}-item-unit-${index}`}
                    value={item.unit ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setForm((prev) => {
                        const next = [...prev.items];
                        next[index] = { ...next[index], unit: value };
                        return { ...prev, items: next };
                      });
                    }}
                    onFocus={() => setSelectedItemRowId(rowId ?? null)}
                    placeholder="単位"
                    disabled={isBlocked}
                  />
                  {hasRowValue ? (
                    <button
                      type="button"
                      className="charts-side-panel__icon"
                      aria-label={`行 ${index + 1} を削除`}
                      onClick={() => removeItemRowById(rowId)}
                      disabled={isBlocked}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
                {supportsItemCommentRow ? (
                  <div
                    className={`charts-side-panel__item-row charts-side-panel__item-row--comment${
                      isInactiveRow ? ' charts-side-panel__item-row--inactive' : ''
                    }${selectedItemRowId === rowId ? ' charts-side-panel__item-row--selected' : ''}`}
                    onClick={() => setSelectedItemRowId(rowId ?? null)}
                  >
                    {canEditGenericFlag ? (
                      <div
                        className="charts-side-panel__switch-group charts-side-panel__switch-group--compact"
                        role="group"
                        aria-label={isInjectionOrder ? '後発情報' : '一般名'}
                        title={genericDisabled ? '薬剤コード確定後に選択できます。' : undefined}
                        style={{ gridColumn: '1 / span 2' }}
                      >
                        {[
                          { value: '', label: '既定' },
                          { value: 'yes', label: '一般名' },
                          { value: 'no', label: '一般名なし' },
                        ].map((option) => (
                          <button
                            key={`${entityId}-item-generic-${index}-${option.value || 'default'}`}
                            type="button"
                            className="charts-side-panel__switch-button charts-side-panel__switch-button--compact"
                            data-active={genericValue === option.value ? 'true' : 'false'}
                            aria-pressed={genericValue === option.value}
                            onClick={() => updateGenericFlag(option.value as '' | 'yes' | 'no')}
                            disabled={genericDisabled}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {isInjectionOrder && canEditGenericFlag ? (
                      <p className="charts-side-panel__help">注射の genericFlg は薬剤 main row に限り編集できます。</p>
                    ) : null}
                    <input
                      id={`${entityId}-item-user-comment-${index}`}
                      name={`${entityId}-item-user-comment-${index}`}
                      value={userCommentValue}
                      onChange={(event) => updateUserComment(event.target.value)}
                      onFocus={() => setSelectedItemRowId(rowId ?? null)}
                      placeholder={isMedOrder ? '薬剤ごとのコメント入力' : '注射ごとのコメント入力'}
                      aria-label={`${isMedOrder ? '薬剤' : '注射'}コメント ${index + 1}`}
                      disabled={isBlocked}
                      style={isMedOrder ? { gridColumn: '3 / span 2' } : { gridColumn: '1 / span 4' }}
                    />
                  </div>
                ) : null}
                {injectionRowError ? (
                  <p className="charts-side-panel__field-error" role="alert">
                    行 {index + 1}: {injectionRowError}
                  </p>
                ) : null}
                {shouldShowRowSummary ? (
                  <p className="charts-side-panel__help" data-testid={`order-bundle-item-summary-${index}`}>
                    {rowSummary}
                  </p>
                ) : null}
              </div>
            );
          })}
          {supportsMaterialRows ? (
            <div className="charts-side-panel__subsection">
              <div className="charts-side-panel__subheader">
                <strong>材料行</strong>
                <div className="charts-side-panel__subheader-actions">
                  <button
                    type="button"
                    className="charts-side-panel__ghost charts-side-panel__ghost--add"
                    onClick={() => {
                      const nextItem = buildEmptyItem();
                      setForm((prev) => ({ ...prev, materialItems: [...prev.materialItems, nextItem] }));
                      setSelectedItemRowId((nextItem as OrderBundleItemWithRowId).rowId ?? null);
                    }}
                    disabled={isBlocked}
                  >
                    材料追加
                  </button>
                </div>
              </div>
              <p className="charts-side-panel__help">
                材料行は `rowRole=material` として保存します。material 候補を main 行で選んだ場合もここへ移します。
              </p>
              {form.materialItems.length === 0 ? (
                <p className="charts-side-panel__empty">材料行はまだありません。</p>
              ) : null}
              {form.materialItems.map((item, index) => {
                const rowId = (item as OrderBundleItemWithRowId).rowId;
                const hasRowValue = hasOrderBundleItemValue(item);
                const rowSummary = [
                  `コード: ${item.code?.trim() || '未設定'}`,
                  formatItemQuantitySummary(item, itemQuantityLabel),
                ].join(' / ');
                const materialRowError = injectionUncodedMaterialRows.has(index) ? INJECTION_UNCODED_MATERIAL_ROW_MESSAGE : null;
                return (
                  <div key={rowId ?? `${entityId}-material-${index}`}>
                    <div
                      className={`charts-side-panel__item-row charts-side-panel__item-row--comment${
                        selectedItemRowId === rowId ? ' charts-side-panel__item-row--selected' : ''
                      }${materialRowError ? ' charts-side-panel__item-row--invalid' : ''}`}
                      data-invalid={materialRowError ? 'true' : undefined}
                      onClick={() => setSelectedItemRowId(rowId ?? null)}
                    >
                      <input
                        id={`${entityId}-material-name-${index}`}
                        name={`${entityId}-material-name-${index}`}
                        value={item.name}
                        aria-invalid={materialRowError ? 'true' : undefined}
                        list={
                          rowId === selectedItemRowId && itemPredictiveCandidates.length > 0
                            ? `${entityId}-item-predictive-list`
                            : undefined
                        }
                        onChange={(event) => {
                          const value = event.target.value;
                          setForm((prev) => {
                            const next = [...prev.materialItems];
                            next[index] = { ...next[index], name: value };
                            return { ...prev, materialItems: next };
                          });
                          applyPredictiveItemSelection(rowId, value);
                        }}
                        onBlur={(event) => applyPredictiveItemSelection(rowId, event.target.value)}
                        onFocus={() => setSelectedItemRowId(rowId ?? null)}
                        placeholder="材料名"
                        disabled={isBlocked}
                        style={{ gridColumn: '1 / span 2' }}
                      />
                      <input
                        id={`${entityId}-material-quantity-${index}`}
                        name={`${entityId}-material-quantity-${index}`}
                        value={item.quantity ?? ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          setForm((prev) => {
                            const next = [...prev.materialItems];
                            next[index] = { ...next[index], quantity: value };
                            return { ...prev, materialItems: next };
                          });
                        }}
                        onFocus={() => setSelectedItemRowId(rowId ?? null)}
                        placeholder={itemQuantityLabel}
                        disabled={isBlocked}
                      />
                      <input
                        id={`${entityId}-material-unit-${index}`}
                        name={`${entityId}-material-unit-${index}`}
                        value={item.unit ?? ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          setForm((prev) => {
                            const next = [...prev.materialItems];
                            next[index] = { ...next[index], unit: value };
                            return { ...prev, materialItems: next };
                          });
                        }}
                        onFocus={() => setSelectedItemRowId(rowId ?? null)}
                        placeholder="単位"
                        disabled={isBlocked}
                      />
                      <button
                        type="button"
                        className="charts-side-panel__icon"
                        aria-label={`材料行 ${index + 1} を削除`}
                        onClick={() => removeMaterialRowById(rowId)}
                        disabled={isBlocked}
                      >
                        ✕
                      </button>
                    </div>
                    {materialRowError ? (
                      <p className="charts-side-panel__field-error" role="alert">
                        材料行 {index + 1}: {materialRowError}
                      </p>
                    ) : null}
                    {hasRowValue ? <p className="charts-side-panel__help">{rowSummary}</p> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
            </div>

            {supportsCommentCodes && selectionCommentCandidates.length > 0 && (
            <div className="charts-side-panel__correction">
              <div className="charts-side-panel__correction-header">
                <strong>選択式コメント候補（official medicationgetv2）</strong>
                <span>{selectionCommentCandidates.length}件</span>
              </div>
              <div className="charts-side-panel__search-table">
                <div className="charts-side-panel__search-header">
                  <span>コード</span>
                  <span>名称</span>
                  <span>分類</span>
                  <span>項番</span>
                  <span>枝番</span>
                </div>
                {selectionCommentCandidates.map((item) => (
                  <button
                    key={`selection-comment-${item.code}-${item.name}`}
                    type="button"
                    className="charts-side-panel__search-row charts-side-panel__search-row--correction"
                    onClick={() =>
                      appendCommentItem({
                        code: item.code,
                        name: item.name,
                        note: item.category,
                      })
                    }
                    disabled={isBlocked || hasUnsupportedCommentSelectionParameter(item)}
                    title={hasUnsupportedCommentSelectionParameter(item) ? UNSUPPORTED_COMMENT_PARAMETER_MESSAGE : undefined}
                  >
                    <span>{item.code}</span>
                    <span>{item.name}</span>
                    <span>{item.category ?? '-'}</span>
                    <span>{item.itemNumber ?? '-'}</span>
                    <span>{item.itemNumberBranch ?? '-'}</span>
                  </button>
                ))}
              </div>
              {unsupportedSelectionCommentCandidates.length > 0 ? (
                <p className="charts-side-panel__help">{UNSUPPORTED_COMMENT_PARAMETER_MESSAGE}</p>
              ) : null}
            </div>
          )}
          </div>
        </div>

        {supportsCommentCodes && (
          <details
            className="charts-side-panel__fold charts-side-panel__meta-section charts-side-panel__meta-section--comments"
            open={commentsFoldOpen}
            onToggle={(event) => setCommentsFoldOpen(event.currentTarget.open)}
            data-invalid={commentError ? 'true' : undefined}
          >
            <summary className="charts-side-panel__fold-summary">
              <span>コメントコード</span>
              <span className="charts-side-panel__fold-meta">
                {commentError ? (
                  <span className="charts-side-panel__fold-badge charts-side-panel__fold-badge--error">要修正</span>
                ) : null}
                <span className="charts-side-panel__fold-count">{countItems(form.commentItems)}件</span>
              </span>
            </summary>
            <div className="charts-side-panel__fold-content">
              <div className="charts-side-panel__subsection">
            <div className="charts-side-panel__subheader">
              <strong>コメントコード</strong>
              <span className="charts-side-panel__search-count">
                {commentSearchQuery.isFetching
                  ? '検索中...'
                  : commentSearchQuery.data?.ok
                    ? `${selectableCommentOptions.length}件`
                    : ''}
              </span>
            </div>
            {commentError ? (
              <p className="charts-side-panel__field-error" role="alert">
                {commentError}
              </p>
            ) : null}
            <p className="charts-side-panel__message">
              コメント内容欄に入力した文字列で部分一致候補を表示します。候補選択でコードと名称を自動入力します。
            </p>
            {selectableCommentOptions.length > 0 && (
              <datalist id={`${entityId}-comment-suggestion-list`}>
                {selectableCommentOptions.map((item) => {
                  const code = item.code?.trim();
                  const name = item.name.trim();
                  return (
                    <option key={`${code}-${name}`} value={name}>
                      {code}
                    </option>
                  );
                })}
              </datalist>
            )}
            <div className="charts-side-panel__item-row charts-side-panel__item-row--comment">
              <input
                id={`${entityId}-comment-draft-code`}
                name={`${entityId}-comment-draft-code`}
                value={commentDraft.code ?? ''}
                placeholder="コード"
                readOnly
                disabled={isBlocked}
              />
              <input
                id={`${entityId}-comment-draft-name`}
                name={`${entityId}-comment-draft-name`}
                value={commentDraft.name}
                placeholder="コメント内容"
                list={selectableCommentOptions.length > 0 ? `${entityId}-comment-suggestion-list` : undefined}
                onChange={(event) =>
                  setCommentDraft((prev) => ({
                    ...prev,
                    code: '',
                    name: event.target.value,
                  }))
                }
                onBlur={(event) => {
                  const normalized = normalizePredictiveLabel(event.target.value);
                  if (!normalized) return;
                  const selected =
                    selectableCommentOptions.find((item) => normalizePredictiveLabel(item.name) === normalized) ??
                    selectableCommentOptions.find((item) => normalizePredictiveLabel(formatMasterLabel(item)) === normalized) ??
                    null;
                  if (!selected) return;
                  applyCommentDraftSelection(selected);
                }}
                disabled={isBlocked}
              />
              <input
                id={`${entityId}-comment-draft-quantity`}
                name={`${entityId}-comment-draft-quantity`}
                value={commentDraft.quantity ?? ''}
                onChange={(event) => setCommentDraft((prev) => ({ ...prev, quantity: event.target.value }))}
                placeholder="数量"
                disabled={isBlocked}
              />
              <input
                id={`${entityId}-comment-draft-unit`}
                name={`${entityId}-comment-draft-unit`}
                value={commentDraft.unit ?? ''}
                onChange={(event) => setCommentDraft((prev) => ({ ...prev, unit: event.target.value }))}
                placeholder="単位"
                disabled={isBlocked}
              />
              <button
                type="button"
                className="charts-side-panel__ghost charts-side-panel__ghost--add"
                onClick={() => {
                  if (!commentDraft.code?.trim() || !commentDraft.name.trim()) return;
                  setForm((prev) => ({
                    ...prev,
                    commentItems: [
                      ...prev.commentItems,
                      {
                        code: commentDraft.code?.trim(),
                        name: commentDraft.name.trim(),
                        quantity: commentDraft.quantity ?? '',
                        unit: commentDraft.unit ?? '',
                        memo: commentDraft.memo ?? '',
                      },
                    ],
                  }));
                  setCommentDraft({ code: '', name: '', quantity: '', unit: '', memo: '' });
                }}
                disabled={isBlocked || !commentDraft.code?.trim() || !commentDraft.name.trim()}
              >
                コメント追加
              </button>
            </div>
            {commentSearchQuery.data && !commentSearchQuery.data.ok && (
              <div className="charts-side-panel__notice charts-side-panel__notice--error">
                {commentSearchQuery.data.message ?? 'コメントマスタの検索に失敗しました。'}
              </div>
            )}
            {selectableCommentOptions.length > 0 && (
              <div className="charts-side-panel__search-table">
                <div className="charts-side-panel__search-header">
                  <span>コード</span>
                  <span>名称</span>
                  <span>単位</span>
                  <span>分類</span>
                  <span>備考</span>
                </div>
                {selectableCommentOptions.map((item) => (
                  <button
                    key={`comment-${item.code ?? item.name}`}
                    type="button"
                    className="charts-side-panel__search-row"
                    onClick={() => applyCommentDraftSelection(item)}
                    disabled={isBlocked}
                  >
                    <span>{item.code ?? '-'}</span>
                    <span>{item.name}</span>
                    <span>{item.unit ?? '-'}</span>
                    <span>{item.category ?? '-'}</span>
                    <span>{item.note ?? '-'}</span>
                  </button>
                ))}
              </div>
            )}
            {(commentKeyword || isItemCodeSearch) && !commentSearchQuery.isFetching && selectableCommentOptions.length === 0 && (
              <p className="charts-side-panel__empty">該当するコメントコードが見つかりません。</p>
            )}
            {form.commentItems.map((item, index) => {
              const invalid = invalidCommentIndices.has(index);
              return (
                <div
                  key={`${entityId}-comment-${index}`}
                  className={`charts-side-panel__item-row charts-side-panel__item-row--comment${
                    orcaWarningTargets.commentItems.has(index) ? ' charts-side-panel__item-row--orca-warning' : ''
                  }${invalid ? ' charts-side-panel__item-row--invalid' : ''}`}
                  data-invalid={invalid ? 'true' : undefined}
                >
                {/*
                 * Free comment (810...) used for gaiyo mixing needs to stay editable so users can adjust wording.
                 * We tag it via memo marker and keep other comment codes read-only.
                 */}
                {(() => {
                  const isMixingItem = item.memo === MIXING_COMMENT_MARKER;
                  return (
                    <>
                <input
                  id={`${entityId}-comment-code-${index}`}
                  name={`${entityId}-comment-code-${index}`}
                  value={item.code ?? ''}
                  placeholder="コード"
                  readOnly
                  disabled={isBlocked}
                />
                <input
                  id={`${entityId}-comment-name-${index}`}
                  name={`${entityId}-comment-name-${index}`}
                  value={item.name}
                  placeholder="コメント内容"
                  readOnly={!isMixingItem}
                  aria-invalid={invalid ? 'true' : undefined}
                  onChange={(event) => {
                    if (!isMixingItem) return;
                    const value = event.target.value;
                    clearValidationByKeys(['invalid_comment_item', 'invalid_comment_code']);
                    setForm((prev) => {
                      const next = [...prev.commentItems];
                      next[index] = { ...next[index], name: value };
                      return { ...prev, commentItems: next };
                    });
                  }}
                  disabled={isBlocked}
                />
                    </>
                  );
                })()}
                <input
                  id={`${entityId}-comment-quantity-${index}`}
                  name={`${entityId}-comment-quantity-${index}`}
                  value={item.quantity ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((prev) => {
                      const next = [...prev.commentItems];
                      next[index] = { ...next[index], quantity: value };
                      return { ...prev, commentItems: next };
                    });
                  }}
                  placeholder="数量"
                  disabled={isBlocked}
                />
                <input
                  id={`${entityId}-comment-unit-${index}`}
                  name={`${entityId}-comment-unit-${index}`}
                  value={item.unit ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((prev) => {
                      const next = [...prev.commentItems];
                      next[index] = { ...next[index], unit: value };
                      return { ...prev, commentItems: next };
                    });
                  }}
                  placeholder="単位"
                  disabled={isBlocked}
                />
                <button
                  type="button"
                  className="charts-side-panel__icon"
                  onClick={() => {
                    clearValidationByKeys(['invalid_comment_item', 'invalid_comment_code']);
                    setForm((prev) => ({
                      ...prev,
                      commentItems: prev.commentItems.filter((_, idx) => idx !== index),
                    }));
                  }}
                  disabled={isBlocked}
                >
                  ✕
                </button>
              </div>
              );
            })}
              </div>
            </div>
          </details>
        )}

      </form>

          {showBundleList ? (
            <div className="charts-side-panel__list" aria-live={resolveAriaLive('info')}>
              <div className="charts-side-panel__list-header">
                <span>登録済み{title}</span>
                <span>{bundleQuery.isFetching ? '更新中' : `${bundles.length}件`}</span>
              </div>
              {bundleQuery.isError && <p className="charts-side-panel__empty">オーダーの取得に失敗しました。</p>}
              {bundles.length === 0 && !bundleQuery.isFetching && <p className="charts-side-panel__empty">登録はまだありません。</p>}
              {bundles.length > 0 && (
                <ul className="charts-side-panel__items">
                  {bundles.map((bundle) => (
                    <li key={bundle.documentId ?? `${bundle.bundleName}-${bundle.started}`}>
                      <div>
                        <strong>{formatBundleName(bundle)}</strong>
                        <span>{bundle.admin ? ` / ${bundle.admin}` : ''}</span>
                        <span>{bundle.started ? ` / ${bundle.started}` : ''}</span>
                      </div>
                      <div className="charts-side-panel__bundle-items">
                        {bundle.items.map((item, idx) => {
                          const itemLabel = `${item.name}${item.quantity ? ` ${item.quantity}` : ''}${item.unit ?? ''}`;
                          const openRequest = onOpenDocument ? resolveDocumentOpenRequest(bundle, item) : null;
                          if (openRequest && onOpenDocument) {
                            return (
                              <button
                                key={`${bundle.documentId}-${idx}`}
                                type="button"
                                className="charts-side-panel__bundle-item charts-side-panel__bundle-item--document"
                                onClick={() => onOpenDocument(openRequest)}
                                aria-label={`文書を開く: ${item.name}`}
                              >
                                {itemLabel}
                              </button>
                            );
                          }
                          return (
                            <span key={`${bundle.documentId}-${idx}`} className="charts-side-panel__bundle-item">
                              {itemLabel}
                            </span>
                          );
                        })}
                      </div>
                      <div className="charts-side-panel__item-actions">
                        <button
                          type="button"
                          className="charts-side-panel__history-action charts-side-panel__history-action--copy"
                          onClick={() => copyFromHistory(bundle)}
                          disabled={isBlocked}
                        >
                          コピー
                        </button>
                        <button
                          type="button"
                          className="charts-side-panel__history-action charts-side-panel__history-action--edit"
                          onClick={() => {
                            setForm(toFormState(bundle, today));
                            setNotice(null);
                          }}
                          disabled={isBlocked}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className="charts-side-panel__history-action charts-side-panel__history-action--delete"
                          onClick={() => deleteMutation.mutate(bundle)}
                          disabled={deleteMutation.isPending || isBlocked}
                        >
                          削除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>
      </div>

      <footer className="charts-side-panel__dock-footer charts-order-editor__sticky-footer" aria-label="保存操作">
        <p className="charts-side-panel__message">
          Ctrl+Enter: 保存 / 保存して閉じる: 保存後に一覧へ戻る / 保存して続ける: 入力を保持 / 保存して追加: 新規入力へ
        </p>
        <div className="charts-side-panel__actions charts-side-panel__actions--footer" role="group" aria-label="保存操作">
          <button
            type="button"
            className="charts-side-panel__action charts-side-panel__action--expand"
            onClick={() => submitAction('expand')}
            disabled={isSaving}
            aria-disabled={isBlocked}
            aria-describedby={isBlocked ? editBlockedReasonId : undefined}
            data-disabled-reason={isBlocked ? 'order_detail_submit_blocked' : undefined}
            title={isBlocked ? saveBlockedReason : undefined}
          >
            保存して閉じる
          </button>
          <button
            type="button"
            className="charts-side-panel__action charts-side-panel__action--expand-continue"
            onClick={() => submitAction('expand_continue')}
            disabled={isSaving}
            aria-disabled={isBlocked}
            aria-describedby={isBlocked ? editBlockedReasonId : undefined}
            data-disabled-reason={isBlocked ? 'order_detail_submit_blocked' : undefined}
            title={isBlocked ? saveBlockedReason : undefined}
          >
            保存して続ける
          </button>
          <button
            type="button"
            className="charts-side-panel__action charts-side-panel__action--save"
            onClick={() => submitAction('save')}
            disabled={isSaving}
            aria-disabled={isBlocked}
            aria-describedby={isBlocked ? editBlockedReasonId : undefined}
            data-disabled-reason={isBlocked ? 'order_detail_submit_blocked' : undefined}
            title={isBlocked ? saveBlockedReason : undefined}
            aria-keyshortcuts="Control+Enter"
            aria-label={form.documentId ? '保存して更新する' : '保存して追加する'}
          >
            {form.documentId ? '保存して更新' : '保存して追加'}
          </button>
          {onClose ? (
            <button type="button" className="charts-side-panel__action charts-side-panel__action--close" onClick={onClose} disabled={isSaving}>
              閉じる
            </button>
          ) : null}
        </div>
      </footer>
    </section>
  );
}
