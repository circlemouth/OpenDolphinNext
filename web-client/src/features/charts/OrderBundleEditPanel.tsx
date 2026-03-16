import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logAuditEvent, logUiState } from '../../libs/audit/auditLogger';
import { recordOutpatientFunnel } from '../../libs/telemetry/telemetryClient';
import { resolveAriaLive } from '../../libs/observability/observability';
import { useOptionalSession } from '../../AppRouter';
import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import {
  fetchOrderBundles,
  mutateOrderBundles,
  type OrderBundle,
  type OrderBundleBodyPart,
  type OrderBundleItem,
} from './orderBundleApi';
import { getOrcaClaimSendEntry, type OrcaMedicalWarningUi } from './orcaClaimSendCache';
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
import { parseOrcaOrderItemMemo, type OrcaOrderItemMeta, updateOrcaOrderItemMeta } from './orcaOrderItemMeta';
import {
  fetchOrderRecommendations,
  type OrderRecommendationCandidate,
  type OrderRecommendationTemplate,
} from './orderRecommendationApi';
import {
  buildRpRequiredEditorMessage,
  resolveRpRequiredIssue,
  resolveRpRequiredFieldLabel,
  RP_REQUIRED_ERROR_LABEL,
  type RpRequiredField,
} from './orderRpRequirements';
import {
  resolveOrderEntityDefaultClassMeta,
  resolveOrderEntityEtensuCategory,
  resolveOrderEntityUiProfile,
  resolveOrderEntityValidationRule,
} from './orderCategoryRegistry';
import type { DataSourceTransition } from './authService';
import type { DocumentOpenRequest } from './DocumentCreatePanel';

export type OrderBundleEditPanelMeta = {
  runId?: string;
  cacheHit?: boolean;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  dataSourceTransition?: DataSourceTransition;
  patientId?: string;
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
  | { requestId: string; kind: 'recommendation'; candidate: OrderRecommendationCandidate };

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
  bundleNumber: string;
  adminMemo: string;
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

type UsageMasterMeta = {
  code?: string;
  label: string;
  timingCode?: string;
  routeCode?: string;
  daysLimit?: number;
  dosePerDay?: number;
  youhouCode?: string;
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

const createRowId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const ensureRowId = (item: OrderBundleItem): OrderBundleItemWithRowId => ({
  ...item,
  rowId: (item as OrderBundleItemWithRowId).rowId ?? createRowId(),
});

const stripRowMeta = (item: OrderBundleItem): OrderBundleItem => {
  const rest = { ...(item as OrderBundleItemWithRowId) };
  delete rest.rowId;
  return rest;
};

const buildEmptyItem = (): OrderBundleItem => ensureRowId({ name: '', quantity: '', unit: '', memo: '' });

const hasOrderBundleItemValue = (item: OrderBundleItem) =>
  Boolean(item.name?.trim() || item.code?.trim() || item.quantity?.trim() || item.unit?.trim() || item.memo?.trim());

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

const NO_PROCEDURE_CHARGE_TEXT = '手技料なし';
const MATERIAL_CODE_PREFIX = '7';
const BODY_PART_CODE_PREFIX = '002';
const COMMENT_CODE_PATTERN = /^(008[1-6]|8[1-6]|098|099|98|99)/;
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

const isDrugMedicationCode = (code: string) => /^6\d{8}$/.test(code.trim());

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

const splitBundleItems = (items?: OrderBundleItem[], explicitBodyPart?: OrderBundleBodyPart) => {
  const normal: OrderBundleItem[] = [];
  const material: OrderBundleItem[] = [];
  const comment: OrderBundleItem[] = [];
  let bodyPart: OrderBundleBodyPart | null = explicitBodyPart?.name?.trim()
    ? {
        code: explicitBodyPart.code,
        name: explicitBodyPart.name,
        quantity: explicitBodyPart.quantity,
        unit: explicitBodyPart.unit,
        memo: explicitBodyPart.memo,
      }
    : null;
  (items ?? []).forEach((item) => {
    const code = item.code?.trim();
    if (code && code.startsWith(BODY_PART_CODE_PREFIX)) {
      if (!bodyPart) {
        bodyPart = { ...item };
      } else {
        normal.push({ ...item });
      }
      return;
    }
    if (code && code.startsWith(MATERIAL_CODE_PREFIX)) {
      material.push({ ...item });
      return;
    }
    if (code && COMMENT_CODE_PATTERN.test(code)) {
      comment.push({ ...item });
      return;
    }
    normal.push({ ...item });
  });
  return { normal, material, comment, bodyPart };
};

const collectBundleItems = (form: BundleFormState) => {
  const bodyPartItem =
    form.bodyPart && form.bodyPart.name.trim()
      ? {
          code: form.bodyPart.code,
          name: form.bodyPart.name,
          quantity: form.bodyPart.quantity,
          unit: form.bodyPart.unit,
          memo: form.bodyPart.memo,
        }
      : null;
  const merged = [
    ...(bodyPartItem ? [bodyPartItem] : []),
    ...form.items,
    ...form.materialItems,
    ...form.commentItems,
  ];
  return merged;
};

const resolveOperationBodyPart = (form: BundleFormState): OrderBundleBodyPart | undefined => {
  if (!form.bodyPart?.name?.trim()) return undefined;
  return {
    code: form.bodyPart.code?.trim() || undefined,
    name: form.bodyPart.name.trim(),
    quantity: form.bodyPart.quantity?.trim() || undefined,
    unit: form.bodyPart.unit?.trim() || undefined,
    memo: form.bodyPart.memo?.trim() || undefined,
  };
};

const countMainItems = (form: BundleFormState) => countItems(form.items);

const DEFAULT_VALIDATION_RULE: BundleValidationRule = {
  itemLabel: '項目',
  requiresItems: true,
  requiresUsage: false,
  requiresBodyPart: false,
};

const buildEmptyForm = (today: string): BundleFormState => ({
  bundleName: '',
  admin: '',
  bundleNumber: '1',
  adminMemo: '',
  memo: '',
  startDate: today,
  prescriptionLocation: DEFAULT_PRESCRIPTION_LOCATION,
  prescriptionTiming: DEFAULT_PRESCRIPTION_TIMING,
  items: [buildEmptyItem()],
  materialItems: [],
  commentItems: [],
  bodyPart: null,
});

export const toFormState = (bundle: OrderBundle, today: string): BundleFormState => {
  const { normal, material, comment, bodyPart } = splitBundleItems(bundle.items, bundle.bodyPart);
  const prescription = parsePrescriptionClassCode(bundle.classCode);
  const mergedItems = [...normal, ...material];
  return {
    documentId: bundle.documentId,
    moduleId: bundle.moduleId,
    bundleName: bundle.bundleName ?? '',
    admin: bundle.admin ?? '',
    bundleNumber: bundle.bundleNumber ?? '1',
    adminMemo: bundle.adminMemo ?? '',
    memo: bundle.memo ?? '',
    startDate: bundle.started ?? today,
    prescriptionLocation: prescription.location,
    prescriptionTiming: prescription.timing,
    items: ensureTrailingEmptyMainItem(mergedItems.length > 0 ? mergedItems : [buildEmptyItem()]),
    materialItems: [],
    commentItems: comment.map(ensureRowId),
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

const toFormStateFromRecommendation = (template: OrderRecommendationTemplate, today: string): BundleFormState => ({
  bundleName: template.bundleName,
  admin: template.admin,
  bundleNumber: template.bundleNumber || '1',
  adminMemo: template.adminMemo,
  memo: template.memo,
  startDate: today,
  prescriptionLocation: template.prescriptionLocation ?? DEFAULT_PRESCRIPTION_LOCATION,
  prescriptionTiming: template.prescriptionTiming ?? DEFAULT_PRESCRIPTION_TIMING,
  items: ensureTrailingEmptyMainItem(
    [...template.items, ...template.materialItems].length > 0
      ? [...template.items, ...template.materialItems].map((item) => ensureRowId({ ...item }))
      : [buildEmptyItem()],
  ),
  materialItems: [],
  commentItems: template.commentItems.map((item) => ({ ...item })),
  bodyPart: template.bodyPart ? { ...template.bodyPart } : null,
});

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
): OrderBundle => ({
  entity: bundle.entity ?? entity,
  bundleName: bundle.bundleName ?? '',
  bundleNumber: bundle.bundleNumber ?? '1',
  classCode: bundle.classCode,
  classCodeSystem: bundle.classCodeSystem,
  className: bundle.className,
  admin: bundle.admin ?? '',
  adminMemo: bundle.adminMemo ?? '',
  memo: bundle.memo ?? '',
  started: bundle.started,
  bodyPart: bundle.bodyPart?.name
    ? {
        code: bundle.bodyPart.code,
        name: bundle.bodyPart.name,
        quantity: bundle.bodyPart.quantity,
        unit: bundle.bodyPart.unit,
        memo: bundle.bodyPart.memo,
      }
    : undefined,
  items: bundle.items.map((item) => ({
    code: item.code,
    name: item.name ?? '',
    quantity: item.quantity,
    unit: item.unit,
    memo: item.memo,
  })),
});

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
  const hasAnyValue = (item: OrderBundleItem) =>
    Boolean(
      item.name?.trim() ||
        item.code?.trim() ||
        item.quantity?.trim() ||
        item.unit?.trim() ||
        item.memo?.trim(),
    );
  const rule = resolveOrderEntityValidationRule(entity) ?? DEFAULT_VALIDATION_RULE;
  const itemCount = countMainItems(form);
  if (rule.requiresItems && itemCount === 0) {
    issues.push({ key: 'missing_items', message: `${rule.itemLabel}を1件以上入力してください。` });
  }
  if (rule.requiresUsage && !form.admin.trim()) {
    issues.push({ key: 'missing_usage', message: '用法を入力してください。' });
  }
  if (rule.requiresBodyPart && !form.bodyPart?.name?.trim()) {
    issues.push({ key: 'missing_body_part', message: '部位を入力してください。' });
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
      if (hasCode && !COMMENT_CODE_PATTERN.test(item.code!.trim())) acc.invalidCode = true;
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
  const [contraConfirmPayload] = useState<{
    summary: string;
    details: string[];
    apiResult?: string;
    apiMessage?: string;
  } | null>(null);
  const orderUiProfile = useMemo(() => resolveOrderEntityUiProfile(entity), [entity]);

  const resetEditorForm = useCallback(() => {
    setForm(buildEmptyForm(today));
    setNotice(null);
    setContraNotice(null);
    setContraDetails([]);
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
  const isMedOrder = entity === 'medOrder';
  const isInjectionOrder = entity === 'injectionOrder';
  const isCompactOrderLayout = isMedOrder || isInjectionOrder;
  const isRadiologyOrder = entity === 'radiologyOrder';
  const isRehabOrder = entity === 'generalOrder';
  const isGaiyoPrescription = isMedOrder && form.prescriptionTiming === 'gaiyo';
  const rpRequiredIssueForForm = useMemo(
    () =>
      resolveRpRequiredIssue({
        entity,
        bundleName: form.bundleName,
        classCode: isMedOrder
          ? resolvePrescriptionClassCode(form.prescriptionTiming, form.prescriptionLocation)
          : resolveOrderEntityDefaultClassMeta(entity)?.classCode,
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

  const supportsUsageSearch = orderUiProfile.supportsUsageSearch;
  const supportsBodyPartSearch = orderUiProfile.supportsBodyPartSearch;
  const supportsCommentCodes = orderUiProfile.supportsCommentCodes;
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
  const [orcaSendEntry, setOrcaSendEntry] = useState<ReturnType<typeof getOrcaClaimSendEntry> | null>(() =>
    getOrcaClaimSendEntry(storageScope, patientId),
  );
  useEffect(() => {
    setOrcaSendEntry(getOrcaClaimSendEntry(storageScope, patientId));
  }, [patientId, storageScope]);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ patientId?: string }>).detail;
      if (detail?.patientId && detail.patientId !== patientId) return;
      setOrcaSendEntry(getOrcaClaimSendEntry(storageScope, patientId));
    };
    window.addEventListener('orca-claim-send-cache-update', handler);
    return () => {
      window.removeEventListener('orca-claim-send-cache-update', handler);
    };
  }, [patientId, storageScope]);

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
    const rows = form.items as OrderBundleItemWithRowId[];
    if (rows.length === 0) return null;
    if (!selectedItemRowId) return rows[0];
    return rows.find((row) => row.rowId === selectedItemRowId) ?? rows[0];
  }, [form.items, selectedItemRowId]);
  const selectedItemPredictionKeyword = selectedItemForPrediction?.name?.trim() ?? '';
  const debouncedItemPredictionKeyword = useDebouncedValue(selectedItemPredictionKeyword, 260);
  const itemPredictiveSearchTypes = useMemo<OrderMasterSearchType[]>(
    () => Array.from(new Set(itemMasterTargets.map((target) => target.type))),
    [itemMasterTargets],
  );
  const etensuCategory = useMemo(() => resolveOrderEntityEtensuCategory(entity), [entity]);
  const isItemCodeSearch = isLikelyCodeSearch(debouncedItemPredictionKeyword);
  const itemPredictiveQuery = useQuery({
    queryKey: [
      'charts-order-item-predictive',
      entity,
      itemPredictiveSearchTypes.join(','),
      etensuCategory ?? '',
      debouncedItemPredictionKeyword,
      pointsMinInput,
      pointsMaxInput,
    ],
    queryFn: async () => {
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
        message: failedMessages[0],
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
    return Array.from(deduped.values());
  }, [itemCorrectionCandidates, itemMasterCandidates]);
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
    const map = new Map<
      string,
      { code: string; name: string; category?: string; itemNumber?: string; itemNumberBranch?: string }
    >();
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
        code: form.adminMemo?.trim() || undefined,
        name: currentAdmin,
      };
      const currentOptionKey = buildUsageOptionKey(currentItem);
      if (!optionMap.has(currentOptionKey)) {
        optionMap.set(currentOptionKey, currentItem);
      }
    }
    return Array.from(optionMap.values());
  }, [form.admin, form.adminMemo, usageItems]);
  const selectedUsageOptionKey = useMemo(() => {
    const currentAdminCode = form.adminMemo?.trim() ?? '';
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
  }, [form.admin, form.adminMemo, usageSelectOptions]);
  const usageMasterMetaFromOptions = useMemo(() => {
    const currentAdminCode = form.adminMemo?.trim() ?? '';
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
  }, [form.admin, form.adminMemo, usageSelectOptions]);
  const selectedUsageMeta = usageMasterMetaFromOptions ?? selectedUsageMasterMeta;
  const selectedUsageDaysLimit = selectedUsageMeta?.daysLimit;
  const selectedUsageDosePerDay = selectedUsageMeta?.dosePerDay;
  const selectedUsageSummary = selectedUsageMeta ? formatUsageMasterSummary(selectedUsageMeta) : '';

  useEffect(() => {
    if (!selectedUsageMasterMeta) return;
    const currentCode = form.adminMemo?.trim() ?? '';
    const normalizedCurrentAdmin = normalizePredictiveLabel(form.admin);
    const matchesByCode = Boolean(selectedUsageMasterMeta.code && currentCode && selectedUsageMasterMeta.code === currentCode);
    const matchesByLabel = normalizePredictiveLabel(selectedUsageMasterMeta.label) === normalizedCurrentAdmin;
    if (!matchesByCode && !matchesByLabel) {
      setSelectedUsageMasterMeta(null);
    }
  }, [form.admin, form.adminMemo, selectedUsageMasterMeta]);

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
    selectionCommentCandidates.forEach((item) => {
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
            adminMemo: matched.code?.trim() ?? '',
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
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((row) => {
        const currentRow = row as OrderBundleItemWithRowId;
        if (currentRow.rowId !== rowId) return row;
        return {
          ...row,
          code: matched.code ?? row.code,
          name: matched.name,
          unit: row.unit?.trim() ? row.unit : matched.unit ?? '',
          memo: row.memo?.trim() ? row.memo : matched.note ?? '',
        };
      }),
    }));
    const youhouCode = matched.youhouCode?.trim();
    if (supportsUsageSearch && !form.admin.trim() && youhouCode) {
      void autoFillUsageFromYouhouCode(youhouCode);
    }
  };

  const applyPredictiveItemSelection = (rowId: string | undefined, value: string) => {
    applyPredictiveItem(rowId, resolvePredictiveItem(value));
  };

  const applyCommentDraftSelection = (selected: {
    code?: string;
    name?: string;
    unit?: string;
    note?: string;
  }) => {
    const selectedName = selected.name?.trim();
    if (!selectedName) return;
    setCommentDraft((prev) => ({
      ...prev,
      code: selected.code?.trim() ?? '',
      name: selectedName,
      unit: selected.unit ?? prev.unit ?? '',
      memo: selected.note ?? prev.memo ?? '',
    }));
  };

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
    const nextForm = toFormStateFromRecommendation(candidate.template, today);
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
      if (detail.bundle.entity && detail.bundle.entity !== entity) {
        setNotice({ tone: 'error', message: 'entity が一致しないため診療セットを反映できません。' });
        return;
      }
      const nextForm = toFormState(toOrderBundleFromInputSetDetail(detail.bundle, entity), today);
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
      adminMemo: item.code?.trim() ?? '',
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
      adminMemo: '',
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
      const mapped = resolveOrderEntityDefaultClassMeta(entity);
      if (!mapped) return {};
      return {
        classCode: mapped.classCode,
        classCodeSystem: PRESCRIPTION_CLASS_CODE_SYSTEM,
        className: mapped.className,
      };
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
      } else if (request.kind === 'copy') {
        setForm(toFormStateFromHistoryCopy(request.bundle, today));
        setSelectedUsageMasterMeta(null);
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
        setBodyPartKeyword('');
        break;
      }
      case 'copy': {
        copyFromHistory(request.bundle);
        break;
      }
      case 'recommendation': {
        applyRecommendation(request.candidate);
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

  const isNoProcedureCharge = isInjectionOrder && form.memo === NO_PROCEDURE_CHARGE_TEXT;
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
    const resolve = contraConfirmResolveRef.current;
    contraConfirmResolveRef.current = null;
    resolve?.(result);
  }, []);

  const runContraindicationCheck = async (bundleForm: BundleFormState) => {
    void bundleForm;
    setIsContraChecking(false);
    setContraNotice(null);
    setContraDetails([]);
    return true;
  };

  const mutation = useMutation({
    mutationFn: async (payload: OrderBundleSubmitPayload) => {
      if (isPreviewMode) throw new Error('preview mode');
      if (!patientId) throw new Error('patientId is required');
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
            ...classMeta,
            admin: payload.form.admin,
            adminMemo: payload.form.adminMemo,
            memo: payload.form.memo,
            startDate: payload.form.startDate,
            items: filteredItems,
            bodyPart: resolveOperationBodyPart(payload.form),
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
            noProcedureCharge: payload.form.memo === NO_PROCEDURE_CHARGE_TEXT,
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
            classCode: classMeta.classCode,
            classCodeSystem: classMeta.classCodeSystem,
            className: classMeta.className,
            admin: payload.form.admin,
            adminMemo: payload.form.adminMemo,
            memo: payload.form.memo,
            started: payload.form.startDate,
            items: normalizedItems,
            bodyPart: resolveOperationBodyPart(payload.form),
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
                    classCode: classMeta.classCode,
                    classCodeSystem: classMeta.classCodeSystem,
                    className: classMeta.className,
                    admin: payload.form.admin,
                    adminMemo: payload.form.adminMemo,
                    memo: payload.form.memo,
                    started: payload.form.startDate,
                    items: normalizedItems,
                    bodyPart: resolveOperationBodyPart(payload.form),
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
            noProcedureCharge: payload.form.memo === NO_PROCEDURE_CHARGE_TEXT,
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
    setOptimisticBundles((prev) => prev.filter((bundle) => !bundle.documentId || !fetchedIds.has(bundle.documentId)));
  }, [fetchedBundles, optimisticBundles.length]);
  const bundles = useMemo(() => {
    if (optimisticBundles.length === 0) return fetchedBundles;
    const fetchedIds = new Set(
      fetchedBundles
        .map((bundle) => bundle.documentId)
        .filter((id): id is number => typeof id === 'number' && id > 0),
    );
    const pending = optimisticBundles.filter((bundle) => !bundle.documentId || !fetchedIds.has(bundle.documentId));
    if (pending.length === 0) return fetchedBundles;
    return [...pending, ...fetchedBundles];
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
            return `${entityId}-admin`;
          case 'missing_body_part':
            return `${entityId}-bodypart`;
          case 'missing_items':
            return `${entityId}-item-name-0`;
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
              return Boolean(code && !COMMENT_CODE_PATTERN.test(code));
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
      setNotice({ tone: 'error', message: '編集ガード中のため保存できません。' });
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
            noProcedureCharge: form.memo === NO_PROCEDURE_CHARGE_TEXT,
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
    const rpRequiredIssue = resolveRpRequiredIssue({
      entity,
      bundleName: normalizedForm.bundleName,
      classCode: isMedOrder
        ? resolvePrescriptionClassCode(normalizedForm.prescriptionTiming, normalizedForm.prescriptionLocation)
        : resolveOrderEntityDefaultClassMeta(entity)?.classCode,
      bundleNumber: normalizedForm.bundleNumber,
      items: normalizedForm.items,
    });
    if (rpRequiredIssue) {
      const message = buildRpRequiredEditorMessage(rpRequiredIssue);
      setNotice({ tone: 'error', message });
      setValidationIssues([{ key: 'rp_required', message }]);
      focusFirstValidationIssue([{ key: 'rp_required', message }], normalizedForm);
      return;
    }
    const validationIssues = validateBundleForm({
      form: normalizedForm,
      entity,
      bundleLabel,
      usageDaysLimit: selectedUsageDaysLimit,
    });
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
            noProcedureCharge: normalizedForm.memo === NO_PROCEDURE_CHARGE_TEXT,
            blockedReasons: validationIssues.map((issue) => issue.key),
            validationMessages: validationIssues.map((issue) => issue.message),
            operationPhase: 'lock',
          },
        },
      });
      return;
    }
    const canContinue = await runContraindicationCheck(normalizedForm);
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
    const rows = form.items;
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
  }, [form.items, selectedItemRowId]);

  const validationByKey = useMemo(() => {
    const map = new Map<string, string>();
    validationIssues.forEach((issue) => {
      if (!map.has(issue.key)) map.set(issue.key, issue.message);
    });
    return map;
  }, [validationIssues]);
  const usageError = validationByKey.get('missing_usage');
  const bundleNumberError = validationByKey.get(USAGE_DAYS_LIMIT_ERROR_KEY);
  const itemsError = validationByKey.get('missing_items');
  const bodyPartError = validationByKey.get('missing_body_part');
  const commentError =
    validationByKey.get('invalid_comment_item') ?? validationByKey.get('invalid_comment_code');

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
      const invalidCode = hasCode && !COMMENT_CODE_PATTERN.test(item.code!.trim());
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
        title="禁忌チェックの警告"
        description={contraConfirmPayload?.summary}
        role="alertdialog"
        onClose={() => closeContraConfirm(false)}
        testId="contraindication-confirm"
      >
        <div className="charts-side-panel__confirm">
          <p className="charts-side-panel__message">
            禁忌チェックで警告が検出されました。確認のうえ、保存を続行するか編集に戻って修正してください。
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
          <div className="charts-side-panel__actions charts-side-panel__actions--dialog" role="group" aria-label="禁忌チェックの確認">
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
        <div className="charts-side-panel__notice charts-side-panel__notice--info">
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
              onClick={() => void runContraindicationCheck(form)}
              disabled={isContraChecking}
            >
              {isContraChecking ? '再実行中…' : '禁忌チェックを再実行'}
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
      <div className="charts-side-panel__workspace" data-variant={variant}>
        {showRecommendationSidebar ? (
          <aside className="charts-side-panel__workspace-left" aria-label="頻用オーダー">
            <div className="charts-side-panel__subsection">
              <div className="charts-side-panel__subheader">
                <strong>頻用オーダー（患者優先）</strong>
                <span className="charts-side-panel__search-count">{recommendationCandidates.length}件</span>
              </div>
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
            </div>
          </aside>
        ) : null}

        <div
          className={`charts-side-panel__workspace-right${showRecommendationSidebar ? '' : ' charts-side-panel__workspace-right--full'}`}
        >
          <form
            className="charts-side-panel__form"
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
            <div className="charts-side-panel__field charts-side-panel__meta-section charts-side-panel__meta-section--bundle">
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
          <div className="charts-side-panel__subsection charts-side-panel__meta-section">
            <div className="charts-side-panel__subheader">
              <strong>点数検索（詳細）</strong>
              <button type="button" className="charts-side-panel__ghost" onClick={() => setDetailSearchOpen((prev) => !prev)}>
                {detailSearchOpen ? '閉じる' : '開く'}
              </button>
            </div>
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
          </div>
        )}
        {!isMedOrder && (
          <div className="charts-side-panel__subsection charts-side-panel__meta-section">
            <div className="charts-side-panel__subheader">
              <strong>ORCA診療セット</strong>
              <span className="charts-side-panel__search-count">{orcaSetItems.length}件</span>
            </div>
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
          </div>
        )}
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
        <div className="charts-side-panel__field-row charts-side-panel__meta-section charts-side-panel__meta-section--usage">
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
                      adminMemo: '',
                    }));
                    setSelectedUsageMasterMeta(null);
                    return;
                  }
                  const matched = applyUsageSelectionByOptionKey(selected);
                  if (!matched) {
                    setForm((prev) => ({
                      ...prev,
                      admin: '',
                      adminMemo: '',
                    }));
                    setSelectedUsageMasterMeta(null);
                  }
                }}
                disabled={isBlocked}
              >
                <option value="">
                  {usageSearchQuery.isFetching ? '用法候補を取得中...' : '候補を選択'}
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
                  setForm((prev) => ({ ...prev, admin: event.target.value, adminMemo: '' }));
                  setSelectedUsageMasterMeta(null);
                }}
                placeholder={orderUiProfile.instructionPlaceholder}
                disabled={isBlocked}
              />
            )}
            {supportsUsageSearch && (
              <>
                <label htmlFor={`${entityId}-admin-recent`}>最近使った用法</label>
                <select
                  id={`${entityId}-admin-recent`}
                  value=""
                  onChange={(event) => applyRecentUsageSelection(event.target.value)}
                  disabled={isBlocked || recentUsageHistory.length === 0}
                >
                  <option value="">候補を選択</option>
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
            {supportsUsageSearch && selectedUsageSummary && (
              <p className="charts-side-panel__help">{selectedUsageSummary}</p>
            )}
            {supportsUsageSearch && typeof selectedUsageDosePerDay === 'number' && (
              <p className="charts-side-panel__help">1日量目安: {selectedUsageDosePerDay}（参考表示のみ）</p>
            )}
            {supportsUsageSearch && usageSearchQuery.isFetching && (
              <p className="charts-side-panel__help">用法候補を読み込み中です。</p>
            )}
            {supportsUsageSearch && usageSearchQuery.data?.ok && (
              <p className="charts-side-panel__help">候補 {usageItems.length}件（最大 {MAX_USAGE_SELECT_OPTIONS}件）</p>
            )}
            {supportsUsageSearch && usageSearchQuery.data && !usageSearchQuery.data.ok && (
              <div className="charts-side-panel__notice charts-side-panel__notice--error">
                {usageSearchQuery.data.message ?? '用法マスタの検索に失敗しました。'}
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
              <p className="charts-side-panel__help">用法マスタ上限日数: {selectedUsageDaysLimit}日</p>
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
                {orderUiProfile.supportsInjectionNoProcedure ? (
                  <div className="charts-side-panel__field charts-side-panel__meta-section--memo">
                    <label className="charts-side-panel__toggle">
                      <input
                        id={`${entityId}-no-procedure-charge`}
                        name={`${entityId}-no-procedure-charge`}
                        type="checkbox"
                        checked={isNoProcedureCharge}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            memo: event.target.checked ? NO_PROCEDURE_CHARGE_TEXT : '',
                          }))
                        }
                        disabled={isBlocked}
                      />
                      手技料なし
                    </label>
                    <p className="charts-side-panel__message">注射オーダーのメモに「手技料なし」を反映します。</p>
                  </div>
                ) : (
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
                  </div>
                )}
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
            {orderUiProfile.supportsInjectionNoProcedure ? (
              <div className="charts-side-panel__field charts-side-panel__meta-section charts-side-panel__meta-section--memo">
                <label className="charts-side-panel__toggle">
                  <input
                    id={`${entityId}-no-procedure-charge`}
                    name={`${entityId}-no-procedure-charge`}
                    type="checkbox"
                    checked={isNoProcedureCharge}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        memo: event.target.checked ? NO_PROCEDURE_CHARGE_TEXT : '',
                      }))
                    }
                    disabled={isBlocked}
                  />
                  手技料なし
                </label>
                <p className="charts-side-panel__message">注射オーダーのメモに「手技料なし」を反映します。</p>
              </div>
            ) : (
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
              </div>
            )}
          </>
        )}

        {supportsBodyPartSearch && (
          <div className="charts-side-panel__subsection charts-side-panel__subsection--search charts-side-panel__meta-section charts-side-panel__meta-section--bodypart">
            <div className="charts-side-panel__subheader">
              <strong>{isRadiologyOrder ? '部位' : '部位（リハビリ）'}</strong>
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
                  aria-invalid={bodyPartError ? 'true' : undefined}
                  onChange={(event) => {
                    clearValidationByKeys(['missing_body_part']);
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
                  placeholder={isRadiologyOrder ? '例: 胸部' : '例: 膝関節'}
                  disabled={isBlocked}
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
                  disabled={isBlocked}
                />
              </div>
            </div>
            <div className="charts-side-panel__actions">
              <button
                type="button"
                className="charts-side-panel__action charts-side-panel__action--search"
                onClick={() => bodyPartSearchQuery.refetch()}
                disabled={isBlocked || bodyPartSearchQuery.isFetching}
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
                リハビリ部位は任意入力です。部位マスタから選択するか、手入力で補足できます。
              </p>
            )}
            {bodyPartSearchQuery.data && !bodyPartSearchQuery.data.ok && (
              <div className="charts-side-panel__notice charts-side-panel__notice--error" role="alert" aria-live="assertive">
                {bodyPartSearchQuery.data.message ?? '部位マスタの検索に失敗しました。'}
              </div>
            )}
            {bodyPartSearchQuery.data?.ok && (
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

        <div className="charts-side-panel__subsection charts-side-panel__meta-section charts-side-panel__meta-section--items">
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
                追加
              </button>
              <button
                type="button"
                className="charts-side-panel__row-delete"
                onClick={removeSelectedItemRow}
                disabled={isBlocked || !selectedItemRowId}
              >
                選択行削除
              </button>
              <button
                type="button"
                className="charts-side-panel__ghost charts-side-panel__ghost--danger"
                onClick={clearItemRows}
                disabled={isBlocked}
              >
                全クリア
              </button>
            </div>
          </div>
          {itemsError ? (
            <p className="charts-side-panel__field-error" role="alert">
              {itemsError}
            </p>
          ) : null}
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
                <strong>コード補正候補（medicationgetv2）</strong>
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
            const parsedItemMemo = supportsItemCommentRow ? parseOrcaOrderItemMemo(item.memo) : null;
            const genericValue = isMedOrder ? parsedItemMemo?.meta.genericFlg ?? '' : '';
            const userCommentValue = isMedOrder
              ? parsedItemMemo?.meta.userComment ?? ''
              : parsedItemMemo?.memoText ?? (item.memo ?? '');
            const genericDisabled = isBlocked || !isDrugMedicationCode(item.code?.trim() ?? '');
            const updateItemMeta = (patch: Partial<OrcaOrderItemMeta>) => {
              setForm((prev) => {
                const next = [...prev.items];
                const current = next[index];
                if (!current) return prev;
                next[index] = {
                  ...current,
                  memo: updateOrcaOrderItemMeta(current.memo ?? '', patch),
                };
                return { ...prev, items: next };
              });
            };
            const updateGenericFlag = (nextValue: '' | 'yes' | 'no') => {
              updateItemMeta({
                genericFlg: nextValue === 'yes' || nextValue === 'no' ? nextValue : undefined,
              });
            };
            const updateUserComment = (nextValue: string) => {
              if (isMedOrder) {
                updateItemMeta({ userComment: nextValue });
                return;
              }
              setForm((prev) => {
                const next = [...prev.items];
                const current = next[index];
                if (!current) return prev;
                next[index] = { ...current, memo: nextValue };
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
                    dragOverIndex === index ? ' charts-side-panel__item-row--drag-over' : ''
                  }${draggingIndex === index ? ' charts-side-panel__item-row--dragging' : ''}${
                    selectedItemRowId === rowId ? ' charts-side-panel__item-row--selected' : ''
                  }`}
                  data-invalid={itemsError && index === 0 ? 'true' : undefined}
                  data-testid="order-bundle-item-row"
                  data-rowid={rowId ?? ''}
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
                    aria-invalid={itemsError && index === 0 ? 'true' : undefined}
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
                    {isMedOrder ? (
                      <div
                        className="charts-side-panel__switch-group charts-side-panel__switch-group--compact"
                        role="group"
                        aria-label="一般名"
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
                {shouldShowRowSummary ? (
                  <p className="charts-side-panel__help" data-testid={`order-bundle-item-summary-${index}`}>
                    {rowSummary}
                  </p>
                ) : null}
              </div>
            );
          })}
            </div>

            {supportsCommentCodes && selectionCommentCandidates.length > 0 && (
            <div className="charts-side-panel__correction">
              <div className="charts-side-panel__correction-header">
                <strong>選択式コメント候補（medicationgetv2）</strong>
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
                    disabled={isBlocked}
                  >
                    <span>{item.code}</span>
                    <span>{item.name}</span>
                    <span>{item.category ?? '-'}</span>
                    <span>{item.itemNumber ?? '-'}</span>
                    <span>{item.itemNumberBranch ?? '-'}</span>
                  </button>
                ))}
              </div>
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

      <footer className="charts-side-panel__dock-footer" aria-label="保存操作">
        <p className="charts-side-panel__message">
          Ctrl+Enter: 保存 / 保存して閉じる: 保存後に一覧へ戻る / 保存して続ける: 入力を保持 / 保存して追加: 新規入力へ
        </p>
        <div className="charts-side-panel__actions charts-side-panel__actions--footer" role="group" aria-label="保存操作">
          <button
            type="button"
            className="charts-side-panel__action charts-side-panel__action--expand"
            onClick={() => submitAction('expand')}
            disabled={isSaving || isBlocked}
          >
            保存して閉じる
          </button>
          <button
            type="button"
            className="charts-side-panel__action charts-side-panel__action--expand-continue"
            onClick={() => submitAction('expand_continue')}
            disabled={isSaving || isBlocked}
          >
            保存して続ける
          </button>
          <button
            type="button"
            className="charts-side-panel__action charts-side-panel__action--save"
            onClick={() => submitAction('save')}
            disabled={isSaving || isBlocked}
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
