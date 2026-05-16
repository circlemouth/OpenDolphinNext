import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useOptionalSession } from '../../AppRouter';
import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { mutateOrderBundles, type OrderBundle, type OrderBundleItem } from './orderBundleApi';
import {
  OrderBundleEditPanel,
  type OrderBundleEditPanelMeta,
  type OrderBundleEditPanelRequest,
  type OrderBundleEditingContext,
} from './OrderBundleEditPanel';
import {
  ORDER_GROUP_REGISTRY,
  isOrderEntity,
  resolveBundleNumberLabel,
  resolveCanonicalOrderEntity,
  resolveOrderEntityEditorMeta,
  resolveOrderEntityLabel,
  resolveOrderGroupKeyByEntity,
  type OrderEntity,
  type OrderGroupKey,
} from './orderCategoryRegistry';
import type { OrderRecommendationCandidate } from './orderRecommendationApi';
import { OrderRecommendationModal } from './OrderRecommendationModal';
import type { RpHistoryEntry } from './karteExtrasApi';
import {
  getOrcaClaimSendEntryForRow,
  type OrcaClaimSendCacheMatch,
  type OrcaMedicalWarningUi,
} from './orcaClaimSendCache';
import { resolveOrcaOrderItemFields } from './orcaOrderItemMeta';
import { buildOrderHubEventId, recordOrderHubKpi, type OrderHubKpiSource } from './orderHubKpi';
import { buildRpRequiredEditorMessage, resolveRpRequiredFieldLabel, resolveRpRequiredIssueFromBundle } from './orderRpRequirements';
import {
  buildOrderDetailDisplayRowsForGroup,
  sortBundlesByLatestRule,
  type OrderDetailDisplayViewModel,
} from './orderDetailDisplayViewModel';
import { normalizeInline, resolvePrescriptionTiming, stripLeadingCode } from './orderDetailFormatters';
import { resolveUserSafeFetchFailure } from './userSafeErrorCopy';

type TreatmentOrderEntity = 'treatmentOrder' | 'surgeryOrder' | 'otherOrder';
type TestOrderEntity = 'testOrder' | 'physiologyOrder' | 'bacteriaOrder' | 'radiologyOrder';
type ChargeOrderEntity = 'baseChargeOrder' | 'instractionChargeOrder';
type OrderDockPanelStateChange = {
  hasEditing: boolean;
  targetCategory: OrderGroupKey | null;
  count: number;
  editingLabel?: string;
  source?: OrderHubKpiSource | null;
};
type OrderHubMode = 'right-primary' | 'bottom-integrated' | 'rollback-legacy';

type ContextGuardState = {
  eventId: string;
  currentEntity: OrderEntity;
  target:
    | { kind: 'switch'; entity: OrderEntity; request: OrderBundleEditPanelRequest | null; source: OrderHubKpiSource; reason: string }
    | { kind: 'close'; source: OrderHubKpiSource; reason: string };
};

type EditLifecycleState = {
  eventId: string;
  entity: OrderEntity;
  source: OrderHubKpiSource;
  completed: boolean;
};

const formatBundleName = (bundle: OrderBundle) => bundle.bundleName?.trim() || bundle.className?.trim() || '名称未設定';

const formatBundleItemChip = (item: OrderBundleItem) => {
  const name = stripLeadingCode(item.name ?? '');
  if (!name) return '';
  const quantity = item.quantity?.trim();
  const unit = item.unit?.trim();
  const qty = [quantity, unit].filter(Boolean).join('');
  return qty ? `${name} ${qty}` : name;
};

const truncateChipText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 1))}…`;
};

const resolveMedItemUserComment = (item: OrderBundleItem): string => {
  const parsed = resolveOrcaOrderItemFields(item);
  return normalizeInline(parsed.userComment ?? '');
};

type BundleCardChip = {
  label: string;
  title: string;
  className?: string;
};

type BundleCardSummary = {
  metaLine?: string;
  chips: BundleCardChip[];
  moreLabel?: string;
};

const summarizeBundleForCard = (bundle: OrderBundle, entity: OrderEntity): BundleCardSummary => {
  const items = (bundle.items ?? []).filter((item) => Boolean(item?.name?.trim?.()));
  const chipsAll = items.reduce<BundleCardChip[]>((acc, item) => {
    const baseChip = formatBundleItemChip(item);
    if (!baseChip) return acc;
    const userComment = resolveMedItemUserComment(item);
    if (!userComment) {
      acc.push({ label: baseChip, title: baseChip });
      return acc;
    }
    const shortComment = truncateChipText(userComment, 12);
    acc.push({
      label: `${baseChip} コメント:${shortComment}`,
      title: `${baseChip} コメント:${userComment}`,
      className: 'order-dock__chip--comment',
    });
    return acc;
  }, []);
  const usage = normalizeInline(bundle.admin ?? '');
  const bundleNumber = normalizeInline(bundle.bundleNumber ?? '');
  const memo = normalizeInline(bundle.memo ?? '');

  if (entity === 'medOrder') {
    const bundleNumberLabel = resolveBundleNumberLabel({
      group: 'prescription',
      classCode: bundle.classCode,
      prescriptionTiming: resolvePrescriptionTiming(bundle),
    });
    const metaParts = [usage || null, bundleNumber ? `${bundleNumberLabel}:${bundleNumber}` : null].filter(Boolean) as string[];
    return {
      metaLine: metaParts.length > 0 ? metaParts.join(' / ') : undefined,
      chips: chipsAll.slice(0, 6),
      moreLabel: chipsAll.length > 6 ? `他${chipsAll.length - 6}` : undefined,
    };
  }

  if (entity === 'baseChargeOrder' || entity === 'instractionChargeOrder') {
    const bundleNumberLabel = resolveBundleNumberLabel({ group: 'charge' });
    const metaParts = [bundleNumber ? `${bundleNumberLabel}:${bundleNumber}` : null, memo ? `メモ:${memo}` : null].filter(Boolean) as string[];
    return {
      metaLine: metaParts.length > 0 ? metaParts.join(' / ') : undefined,
      chips: chipsAll.slice(0, 4),
      moreLabel: chipsAll.length > 4 ? `他${chipsAll.length - 4}` : undefined,
    };
  }

  const metaParts = [usage || null, memo ? `メモ:${memo}` : null].filter(Boolean) as string[];
  return {
    metaLine: metaParts.length > 0 ? metaParts.join(' / ') : undefined,
    chips: chipsAll.slice(0, 5),
    moreLabel: chipsAll.length > 5 ? `他${chipsAll.length - 5}` : undefined,
  };
};

const renderBundleDetailSummary = (row: OrderDetailDisplayViewModel) => {
  return (
    <div className="soap-note__summary-body">
      {row.title ? <p className="soap-note__summary-detail soap-note__summary-detail--heading">{row.title}</p> : null}
      {row.items.length > 0 ? (
        <ul className="soap-note__summary-list">
          {row.items.map((item, index) => {
            const quantityLine = item.secondary.find((line) => line.startsWith('薬剤量:'));
            const quantity = quantityLine
              ?.replace('薬剤量:', '')
              .split('/')[0]
              ?.trim();
            const commentLine = item.secondary.find((line) => line.startsWith('薬剤コメント:'));
            const comment = commentLine?.replace('薬剤コメント:', '').trim() ?? '';
            const commentPreview = comment.length > 12 ? `${comment.slice(0, 11)}…` : comment;
            const commentTitle = comment ? `${item.primary}${quantity ? ` ${quantity}` : ''} コメント:${comment}` : undefined;
            const primaryLabel = comment ? `${item.primary} コメント:${commentPreview}` : item.primary;
            return (
              <li key={`${row.id}-dock-item-${index}`} className="soap-note__summary-list-item">
                {item.genericNote ? <span className="soap-note__summary-item-sub">{item.genericNote}</span> : null}
                <span className="soap-note__summary-item-name" title={commentTitle}>
                  {primaryLabel}
                </span>
                {item.secondary.map((detail, detailIndex) => (
                  <span key={`${row.id}-dock-item-${index}-detail-${detailIndex}`} className="soap-note__summary-item-sub">
                    {detail}
                  </span>
                ))}
              </li>
            );
          })}
        </ul>
      ) : null}
      {row.detailLines.map((detail, index) => (
        <p key={`${row.id}-dock-detail-${index}`} className="soap-note__summary-detail">
          {detail}
        </p>
      ))}
      {row.warnings.map((warning, index) => (
        <p key={`${row.id}-dock-warning-${index}`} className="soap-note__summary-detail">
          {warning}
        </p>
      ))}
    </div>
  );
};

type BundleWarningBadge = { tone: 'warn' | 'contra'; label: string; count: number };
type SearchCandidate = {
  id: string;
  entity: OrderEntity;
  label: string;
  detail?: string;
  bundle?: OrderBundle;
};

const resolveWarningBadge = (warnings: OrcaMedicalWarningUi[]): BundleWarningBadge | null => {
  if (warnings.length === 0) return null;
  const combined = warnings
    .map((warning) =>
      [warning.medicalWarning, warning.message, warning.medicalClass, warning.code].filter(Boolean).join(' '),
    )
    .join(' ');
  const hasContra = /禁忌/.test(combined);
  return hasContra ? { tone: 'contra', label: '禁忌', count: warnings.length } : { tone: 'warn', label: '警告', count: warnings.length };
};

const buildRequestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const ORDER_HUB_MODE_STORAGE_KEY = 'charts:order-hub-mode';
const BOTTOM_ORDER_HUB_INTEGRATION_FLAG = import.meta.env.VITE_CHARTS_BOTTOM_ORDER_HUB_INTEGRATION === '1';
const ORDER_HUB_MODE_LABEL: Record<OrderHubMode, string> = {
  'right-primary': '右欄主体',
  'bottom-integrated': '下欄統合試験',
  'rollback-legacy': 'ロールバック',
};
const RP_SHARED_USAGE_RULE = '1 RP = 共通用法。異なる用法は別RP';

const parseOrderHubMode = (value?: string | null): OrderHubMode | null => {
  if (!value) return null;
  switch (value.trim()) {
    case 'right-primary':
      return 'right-primary';
    case 'bottom-integrated':
      return 'bottom-integrated';
    case 'rollback-legacy':
      return 'rollback-legacy';
    default:
      return null;
  }
};

const sanitizeOrderHubMode = (mode: OrderHubMode, allowBottomIntegration: boolean): OrderHubMode => {
  if (mode === 'bottom-integrated' && !allowBottomIntegration) return 'right-primary';
  return mode;
};

const resolveOrderHubMode = (allowBottomIntegration: boolean): OrderHubMode => {
  const envMode = parseOrderHubMode(import.meta.env.VITE_CHARTS_ORDER_HUB_MODE);
  if (envMode) return sanitizeOrderHubMode(envMode, allowBottomIntegration);
  if (typeof window === 'undefined') return 'right-primary';
  try {
    const qsMode = parseOrderHubMode(new URLSearchParams(window.location.search).get('orderHubMode'));
    if (qsMode) return sanitizeOrderHubMode(qsMode, allowBottomIntegration);
  } catch {
    // ignore URL parse errors
  }
  try {
    const persisted = parseOrderHubMode(window.localStorage.getItem(ORDER_HUB_MODE_STORAGE_KEY));
    if (persisted) return sanitizeOrderHubMode(persisted, allowBottomIntegration);
  } catch {
    // ignore storage errors
  }
  return 'right-primary';
};

const resolveActiveElement = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
};

const resolveOrderHubSourceLabel = (source?: OrderHubKpiSource | null) => {
  switch (source) {
    case 'bottom-floating':
      return '下欄フローティング';
    case 'right-panel':
      return '右欄アコーディオン';
    case 'order-dock':
      return 'オーダーハブ';
    case 'system':
      return 'システム';
    default:
      return '未設定';
  }
};

const resolveComparableOrderEntity = (entity: OrderEntity) => resolveCanonicalOrderEntity(entity) ?? entity;

const EMPTY_ORDER_BUNDLE_EDITING_CONTEXT: OrderBundleEditingContext = {
  hasRpRequiredIssue: false,
  rpRequiredMissing: [],
};

const quickAddCategories = [
  { key: 'prescription', label: '+処方', entity: 'medOrder' as const },
  { key: 'injection', label: '+注射', entity: 'injectionOrder' as const },
  { key: 'treatment', label: '+処置', entity: null },
  { key: 'test', label: '+検査', entity: null },
  { key: 'charge', label: '+算定', entity: null },
] as const;

const ORDER_WORKBENCH_CATEGORY_LABEL: Record<OrderGroupKey, string> = {
  prescription: '処方',
  injection: '点滴・注射',
  treatment: '処置',
  test: '検査',
  charge: '算定',
};

const treatmentSubtypeTabs = [
  { key: 'treatmentOrder' as const, label: '処置' },
  { key: 'surgeryOrder' as const, label: '手術' },
  { key: 'otherOrder' as const, label: 'その他' },
] as const;

const testSubtypeTabs = [
  { key: 'testOrder' as const, label: '検査' },
  { key: 'physiologyOrder' as const, label: '生理（送信停止）' },
  { key: 'bacteriaOrder' as const, label: '細菌' },
  { key: 'radiologyOrder' as const, label: '画像診断' },
] as const;

const chargeSubtypeTabs = [
  { key: 'baseChargeOrder' as const, label: '基本料' },
  { key: 'instractionChargeOrder' as const, label: '指導料' },
] as const;

const resolveNextTabKey = <T extends string>(
  key: string,
  tabs: readonly T[],
  selected: T,
): T | null => {
  const selectedIndex = tabs.indexOf(selected);
  if (selectedIndex < 0 || tabs.length === 0) return null;
  if (key === 'Home') return tabs[0] ?? null;
  if (key === 'End') return tabs[tabs.length - 1] ?? null;
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return tabs[(selectedIndex + 1) % tabs.length] ?? null;
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return tabs[(selectedIndex - 1 + tabs.length) % tabs.length] ?? null;
  }
  return null;
};

const focusSubtypeTabButton = (container: HTMLDivElement, key: string) => {
  const target = container.querySelector<HTMLButtonElement>(`button[data-order-dock-tab-key="${key}"]`);
  if (!target) return;
  requestAnimationFrame(() => target.focus());
};

export function OrderDockPanel(props: {
  patientId?: string;
  meta: OrderBundleEditPanelMeta;
  visitDate?: string;
  orderBundles?: OrderBundle[];
  orderBundlesLoading?: boolean;
  orderBundlesError?: string;
  rpHistory?: RpHistoryEntry[];
  rpHistoryLoading?: boolean;
  rpHistoryError?: string;
  openRequest?: { requestId: string; entity: OrderEntity } | null;
  onOpenRequestConsumed?: (requestId: string) => void;
  historyCopyRequest?: { requestId: string; entity: OrderEntity; bundle: OrderBundle } | null;
  onHistoryCopyConsumed?: (requestId: string) => void;
  bottomOrderHubIntegrationEnabled?: boolean;
  onStateChange?: (state: OrderDockPanelStateChange) => void;
}) {
  const {
    patientId,
    meta,
    visitDate,
    orderBundles,
    orderBundlesLoading,
    orderBundlesError,
    rpHistory,
    rpHistoryLoading,
    rpHistoryError,
    openRequest,
    onOpenRequestConsumed,
    historyCopyRequest,
    onHistoryCopyConsumed,
    bottomOrderHubIntegrationEnabled,
    onStateChange,
  } = props;
  const queryClient = useQueryClient();
  const session = useOptionalSession();
  const storageScope = useMemo(
    () => ({ facilityId: session?.facilityId, userId: session?.userId }),
    [session?.facilityId, session?.userId],
  );

  const orderVisitDate = (visitDate ?? meta.visitDate ?? '').slice(0, 10);
  const allowBottomOrderHubIntegration = bottomOrderHubIntegrationEnabled ?? BOTTOM_ORDER_HUB_INTEGRATION_FLAG;
  const [orderHubMode] = useState<OrderHubMode>(() => resolveOrderHubMode(allowBottomOrderHubIntegration));
  const enableContextGuard = orderHubMode !== 'rollback-legacy';
  const primaryOperationSource: OrderHubKpiSource =
    orderHubMode === 'bottom-integrated' ? 'bottom-floating' : 'right-panel';
  const kpiMeta = useMemo(
    () => ({
      runId: meta.runId,
      cacheHit: meta.cacheHit,
      missingMaster: meta.missingMaster,
      fallbackUsed: meta.fallbackUsed,
      dataSourceTransition: meta.dataSourceTransition,
      patientId,
      appointmentId: meta.appointmentId,
    }),
    [
      meta.appointmentId,
      meta.cacheHit,
      meta.dataSourceTransition,
      meta.fallbackUsed,
      meta.missingMaster,
      meta.runId,
      patientId,
    ],
  );
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

  const orcaMedicalWarnings = useMemo<OrcaMedicalWarningUi[]>(() => {
    const warnings = orcaSendEntry?.medicalWarnings ?? [];
    const sentDate = orcaSendEntry?.performDate?.slice(0, 10);
    if (!sentDate || !orderVisitDate || sentDate !== orderVisitDate) return [];
    return warnings;
  }, [orcaSendEntry?.medicalWarnings, orcaSendEntry?.performDate, orderVisitDate]);

  const bundlesByEntity = useMemo(() => {
    const map = new Map<string, OrderBundle[]>();
    for (const bundle of (orderBundles ?? []).filter(Boolean)) {
      const started = bundle.started?.slice(0, 10);
      if (orderVisitDate && started && started !== orderVisitDate) continue;
      const rawEntity = bundle.entity?.trim();
      const entity = resolveCanonicalOrderEntity(rawEntity ?? '') ?? rawEntity ?? 'unknown';
      const list = map.get(entity) ?? [];
      list.push(bundle);
      map.set(entity, list);
    }
    return map;
  }, [orderBundles, orderVisitDate]);

  const groupBundles = useMemo(() => {
    return ORDER_GROUP_REGISTRY.map((spec) => {
      const bundles = sortBundlesByLatestRule(spec.entities.flatMap((entity) => bundlesByEntity.get(entity) ?? []));
      return { ...spec, bundles };
    });
  }, [bundlesByEntity]);

  const hasAnyOrders = groupBundles.some((group) => group.bundles.length > 0);

  const [treatmentEntity, setTreatmentEntity] = useState<TreatmentOrderEntity>('treatmentOrder');
  const [testEntity, setTestEntity] = useState<TestOrderEntity>('testOrder');
  const [chargeEntity, setChargeEntity] = useState<ChargeOrderEntity>('baseChargeOrder');
  const [treatmentShowAll, setTreatmentShowAll] = useState(false);
  const [testShowAll, setTestShowAll] = useState(false);
  const [chargeShowAll, setChargeShowAll] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [quickSearchGroup, setQuickSearchGroup] = useState<OrderGroupKey | 'all'>('all');

  const [activeEntity, setActiveEntity] = useState<OrderEntity | null>(null);
  const [activeRequest, setActiveRequest] = useState<OrderBundleEditPanelRequest | null>(null);
  const [quickAddGroupKey, setQuickAddGroupKey] = useState<OrderGroupKey | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<OrderGroupKey, boolean>>(() => ({
    prescription: orderHubMode !== 'rollback-legacy',
    injection: orderHubMode !== 'rollback-legacy',
    treatment: false,
    test: false,
    charge: false,
  }));
  const [contextGuard, setContextGuard] = useState<ContextGuardState | null>(null);
  const focusRestoreRef = useRef<HTMLElement | null>(null);
  const editLifecycleRef = useRef<EditLifecycleState | null>(null);
  const [activeEditorSource, setActiveEditorSource] = useState<OrderHubKpiSource | null>(null);
  const [activeEditorContext, setActiveEditorContext] = useState<OrderBundleEditingContext>(EMPTY_ORDER_BUNDLE_EDITING_CONTEXT);
  const isQuickAddMode = quickAddGroupKey !== null;
  const quickAddModeSpec = useMemo(
    () => (quickAddGroupKey ? quickAddCategories.find((item) => item.key === quickAddGroupKey) ?? null : null),
    [quickAddGroupKey],
  );
  const quickAddEntityByGroup = useMemo<Record<OrderGroupKey, OrderEntity>>(
    () => ({
      prescription: 'medOrder',
      injection: 'injectionOrder',
      treatment: treatmentEntity,
      test: testEntity,
      charge: chargeEntity,
    }),
    [chargeEntity, testEntity, treatmentEntity],
  );

  const activeTitleMeta = useMemo(() => (activeEntity ? resolveOrderEntityEditorMeta(activeEntity) : null), [activeEntity]);

  const canEdit = Boolean(patientId && !meta.readOnly && !meta.missingMaster && !meta.fallbackUsed);
  const editDisabledReason = !patientId
    ? '患者未選択のため操作できません。'
    : meta.readOnly
      ? meta.readOnlyReason ?? '閲覧専用のため操作できません。'
      : meta.missingMaster
        ? 'マスター未同期のため操作できません。'
        : meta.fallbackUsed
          ? 'フォールバックデータのため操作できません。'
          : undefined;
  const showEditBlockedNotice = useCallback((operationLabel = 'オーダー追加') => {
    if (canEdit) return false;
    setNotice({ tone: 'error', message: `${operationLabel}を停止: ${editDisabledReason ?? '編集不可のため操作できません。'}` });
    return true;
  }, [canEdit, editDisabledReason]);

  const quickSearchCandidates = useMemo<SearchCandidate[]>(() => {
    const keyword = quickSearch.trim().toLowerCase();
    const matches = groupBundles.flatMap((group) => {
      if (quickSearchGroup !== 'all' && group.key !== quickSearchGroup) return [];
      return group.bundles.flatMap((bundle, index) => {
        const rawEntity = resolveCanonicalOrderEntity(bundle.entity?.trim() ?? '') ?? group.entities[0];
        if (!isOrderEntity(rawEntity)) return [];
        const entity = rawEntity;
        const summary = summarizeBundleForCard(bundle, entity);
        const label = formatBundleName(bundle);
        const detail = [resolveOrderEntityLabel(entity), summary.metaLine].filter(Boolean).join(' / ');
        const haystack = [label, detail, summary.chips.map((chip) => chip.title).join(' ')].join(' ').toLowerCase();
        if (keyword && !haystack.includes(keyword)) return [];
        return [
          {
            id: `bundle-${group.key}-${bundle.documentId ?? 'doc'}-${bundle.moduleId ?? 'mod'}-${index}`,
            entity,
            label,
            detail,
            bundle,
          } satisfies SearchCandidate,
        ];
      });
    });
    if (matches.length > 0) return matches.slice(0, 8);

    if (!keyword) return [];
    const fallbackEntities: OrderEntity[] =
      quickSearchGroup === 'prescription'
        ? ['medOrder']
        : quickSearchGroup === 'injection'
          ? ['injectionOrder']
          : quickSearchGroup === 'treatment'
            ? ['treatmentOrder', 'surgeryOrder', 'otherOrder']
            : quickSearchGroup === 'test'
              ? ['testOrder', 'physiologyOrder', 'bacteriaOrder', 'radiologyOrder']
              : quickSearchGroup === 'charge'
                ? ['baseChargeOrder', 'instractionChargeOrder']
                : ['medOrder', 'injectionOrder', 'treatmentOrder', 'testOrder', 'baseChargeOrder'];
    const fallback = fallbackEntities
      .filter((entity) => resolveOrderEntityLabel(entity).toLowerCase().includes(keyword))
      .map((entity) => ({
        id: `new-${entity}`,
        entity,
        label: `${resolveOrderEntityLabel(entity)}を新規追加`,
        detail: '新規作成',
      }));
    return fallback.slice(0, 8);
  }, [groupBundles, quickSearch, quickSearchGroup]);

  const emitOrderHubKpi = useCallback(
    (payload: Parameters<typeof recordOrderHubKpi>[1]) => {
      recordOrderHubKpi(kpiMeta, payload);
    },
    [kpiMeta],
  );

  const finalizeEditLifecycle = useCallback(
    (result: 'left' | 'discarded', source: OrderHubKpiSource) => {
      const lifecycle = editLifecycleRef.current;
      if (!lifecycle) return;
      emitOrderHubKpi({
        category: 'OUI-03',
        source,
        result,
        eventId: lifecycle.eventId,
        details: { entity: lifecycle.entity },
      });
      editLifecycleRef.current = null;
    },
    [emitOrderHubKpi],
  );

  const openEditor = useCallback(
    (
      entity: OrderEntity,
      request: OrderBundleEditPanelRequest | null,
      options?: { source?: OrderHubKpiSource; reason?: string; force?: boolean; triggerEl?: HTMLElement | null },
    ) => {
      const resolvedEntity = resolveCanonicalOrderEntity(entity) ?? entity;
      const source = options?.source ?? 'right-panel';
      const reason = options?.reason ?? 'open_editor';
      const hasUnsaved = Boolean(editLifecycleRef.current && !editLifecycleRef.current.completed);
      const isContextSwitch = Boolean(activeEntity && (activeEntity !== resolvedEntity || request));
      if (!options?.force && enableContextGuard && isContextSwitch && hasUnsaved && activeEntity) {
        const eventId = buildOrderHubEventId();
        focusRestoreRef.current = options?.triggerEl ?? resolveActiveElement();
        setContextGuard({
          eventId,
          currentEntity: activeEntity,
          target: { kind: 'switch', entity: resolvedEntity, request, source, reason },
        });
        emitOrderHubKpi({
          category: 'OUI-04',
          source,
          result: 'blocked',
          eventId,
          reason,
          details: { currentEntity: activeEntity, nextEntity: resolvedEntity },
        });
        return false;
      }
      if (activeEntity && (activeEntity !== resolvedEntity || request)) {
        finalizeEditLifecycle(hasUnsaved ? 'discarded' : 'left', source);
      }
      const groupKey = resolveOrderGroupKeyByEntity(resolvedEntity);
      if (groupKey === 'treatment') {
        setTreatmentEntity(resolvedEntity as TreatmentOrderEntity);
      }
      if (groupKey === 'test') {
        setTestEntity(resolvedEntity as TestOrderEntity);
      }
      if (groupKey === 'charge') {
        setChargeEntity(resolvedEntity as ChargeOrderEntity);
      }
      if (quickAddGroupKey && groupKey !== quickAddGroupKey) {
        setQuickAddGroupKey(null);
      }
      setActiveEditorContext(EMPTY_ORDER_BUNDLE_EDITING_CONTEXT);
      setActiveEntity(resolvedEntity);
      setActiveRequest(request);
      setActiveEditorSource(source);

      const operationEventId = buildOrderHubEventId();
      emitOrderHubKpi({
        category: source === 'bottom-floating' ? 'OUI-02' : 'OUI-01',
        source,
        result: 'started',
        eventId: operationEventId,
        reason,
        details: { entity: resolvedEntity, requestKind: request?.kind ?? 'history_copy' },
      });

      const activeLifecycle = editLifecycleRef.current;
      if (!activeLifecycle || activeLifecycle.entity !== resolvedEntity || activeLifecycle.completed) {
        const lifecycleEventId = buildOrderHubEventId();
        editLifecycleRef.current = {
          eventId: lifecycleEventId,
          entity: resolvedEntity,
          source,
          completed: false,
        };
        emitOrderHubKpi({
          category: 'OUI-03',
          source,
          result: 'started',
          eventId: lifecycleEventId,
          reason,
          details: { entity: resolvedEntity, requestKind: request?.kind ?? 'history_copy' },
        });
      }
      return true;
    },
    [activeEntity, emitOrderHubKpi, enableContextGuard, finalizeEditLifecycle, quickAddGroupKey],
  );

  const closeEditor = useCallback(
    (options?: { source?: OrderHubKpiSource; reason?: string; force?: boolean; triggerEl?: HTMLElement | null }) => {
      if (!activeEntity) return true;
      const source = options?.source ?? 'right-panel';
      const reason = options?.reason ?? 'close_editor';
      const hasUnsaved = Boolean(editLifecycleRef.current && !editLifecycleRef.current.completed);
      if (!options?.force && enableContextGuard && hasUnsaved) {
        const eventId = buildOrderHubEventId();
        focusRestoreRef.current = options?.triggerEl ?? resolveActiveElement();
        setContextGuard({
          eventId,
          currentEntity: activeEntity,
          target: { kind: 'close', source, reason },
        });
        emitOrderHubKpi({
          category: 'OUI-04',
          source,
          result: 'blocked',
          eventId,
          reason,
          details: { currentEntity: activeEntity },
        });
        return false;
      }
      finalizeEditLifecycle(hasUnsaved ? 'discarded' : 'left', source);
      setActiveEntity(null);
      setActiveRequest(null);
      setActiveEditorSource(null);
      setActiveEditorContext(EMPTY_ORDER_BUNDLE_EDITING_CONTEXT);
      return true;
    },
    [activeEntity, emitOrderHubKpi, enableContextGuard, finalizeEditLifecycle],
  );

  const handleEditorSubmitResult = useCallback(
    (result: { action: 'save' | 'expand' | 'expand_continue'; ok: boolean }) => {
      const lifecycle = editLifecycleRef.current;
      if (!lifecycle) return;
      if (result.ok) {
        if (!lifecycle.completed) {
          lifecycle.completed = true;
          emitOrderHubKpi({
            category: 'OUI-03',
            source: lifecycle.source,
            result: 'completed',
            eventId: lifecycle.eventId,
            details: { entity: lifecycle.entity, action: result.action },
          });
        }
        if (result.action === 'expand_continue') {
          lifecycle.completed = false;
        }
        return;
      }
      emitOrderHubKpi({
        category: 'OUI-03',
        source: lifecycle.source,
        result: 'failed',
        eventId: lifecycle.eventId,
        details: { entity: lifecycle.entity, action: result.action },
      });
    },
    [emitOrderHubKpi],
  );

  const lastOpenRequestIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openRequest) return;
    if (openRequest.requestId === lastOpenRequestIdRef.current) return;
    lastOpenRequestIdRef.current = openRequest.requestId;
    openEditor(
      openRequest.entity,
      { requestId: openRequest.requestId, kind: 'new' },
      { source: 'bottom-floating', reason: 'external_open_request' },
    );
    onOpenRequestConsumed?.(openRequest.requestId);
  }, [onOpenRequestConsumed, openEditor, openRequest]);

  const lastHistoryCopyRequestIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!historyCopyRequest) return;
    if (historyCopyRequest.requestId === lastHistoryCopyRequestIdRef.current) return;
    lastHistoryCopyRequestIdRef.current = historyCopyRequest.requestId;
    // Do not send a `new` request here: the embedded editor will consume `historyCopyRequest`
    // and would otherwise be overwritten by the reset handler (request effect runs after copy effect).
    openEditor(historyCopyRequest.entity, null, {
      source: 'bottom-floating',
      reason: 'external_history_copy',
    });
  }, [historyCopyRequest, openEditor]);

  const handleContextGuardCancel = useCallback(() => {
    const current = contextGuard;
    if (!current) return;
    emitOrderHubKpi({
      category: 'OUI-05',
      source: current.target.source,
      result: 'recovered',
      eventId: current.eventId,
      reason: current.target.reason,
      details: { currentEntity: current.currentEntity },
    });
    setContextGuard(null);
    const target = focusRestoreRef.current;
    focusRestoreRef.current = null;
    if (target && target.isConnected) {
      requestAnimationFrame(() => target.focus());
    }
  }, [contextGuard, emitOrderHubKpi]);

  const handleContextGuardConfirm = useCallback(() => {
    const current = contextGuard;
    if (!current) return;
    emitOrderHubKpi({
      category: 'OUI-04',
      source: current.target.source,
      result: 'discarded',
      eventId: current.eventId,
      reason: current.target.reason,
      details: {
        currentEntity: current.currentEntity,
        nextEntity: current.target.kind === 'switch' ? current.target.entity : null,
      },
    });
    finalizeEditLifecycle('discarded', current.target.source);
    setContextGuard(null);
    const restoreTarget = focusRestoreRef.current;
    focusRestoreRef.current = null;
    if (current.target.kind === 'switch') {
      openEditor(current.target.entity, current.target.request, {
        source: current.target.source,
        reason: `${current.target.reason}_confirmed`,
        force: true,
      });
      return;
    }
    setActiveEntity(null);
    setActiveRequest(null);
    setActiveEditorSource(null);
    setActiveEditorContext(EMPTY_ORDER_BUNDLE_EDITING_CONTEXT);
    if (restoreTarget && restoreTarget.isConnected) {
      requestAnimationFrame(() => restoreTarget.focus());
    }
  }, [contextGuard, emitOrderHubKpi, finalizeEditLifecycle, openEditor]);

  useEffect(() => {
    const keysToExpand = new Set<OrderGroupKey>();
    const activeGroupKey = activeEntity ? resolveOrderGroupKeyByEntity(activeEntity) : null;
    if (activeGroupKey) keysToExpand.add(activeGroupKey);
    if (quickAddGroupKey) keysToExpand.add(quickAddGroupKey);
    if (keysToExpand.size === 0) return;
    setExpandedGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      keysToExpand.forEach((key) => {
        if (!next[key]) {
          next[key] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [activeEntity, quickAddGroupKey]);

  const targetCategory = useMemo<OrderGroupKey | null>(() => {
    if (activeEntity) return resolveOrderGroupKeyByEntity(activeEntity);
    return quickAddGroupKey;
  }, [activeEntity, quickAddGroupKey]);

  const hasEditing = activeEntity !== null;
  const summaryCount = useMemo(() => {
    if (targetCategory) {
      return groupBundles.find((group) => group.key === targetCategory)?.bundles.length ?? 0;
    }
    return groupBundles.reduce((sum, group) => sum + group.bundles.length, 0);
  }, [groupBundles, targetCategory]);

  useEffect(() => {
    const editingLabel = activeEntity
      ? `${resolveOrderEntityLabel(activeEntity)}${activeEditorContext.hasRpRequiredIssue ? '（必須不足）' : ''}`
      : undefined;
    onStateChange?.({
      hasEditing,
      targetCategory,
      count: summaryCount,
      editingLabel,
      source: activeEntity ? activeEditorSource : null,
    });
  }, [activeEditorContext.hasRpRequiredIssue, activeEditorSource, activeEntity, hasEditing, onStateChange, summaryCount, targetCategory]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!activeEntity) return;
    const groupKey = resolveOrderGroupKeyByEntity(activeEntity);
    if (!groupKey) return;
    requestAnimationFrame(() => {
      const section = document.querySelector(`section.order-dock__group[data-group="${groupKey}"]`);
      if (!section) return;
      const inlineEditor = section.querySelector('.order-dock__inline-editor');
      if (!(inlineEditor instanceof HTMLElement)) return;
      if (typeof inlineEditor.scrollIntoView !== 'function') return;
      inlineEditor.scrollIntoView({ block: 'nearest' });
    });
  }, [activeEntity]);

  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async (bundle: OrderBundle) => {
      if (!patientId) throw new Error('patientId is required');
      return mutateOrderBundles({
        patientId,
        operations: [
          {
            operation: 'delete',
            documentId: bundle.documentId,
            moduleId: bundle.moduleId,
            entity: bundle.entity,
          },
        ],
      });
    },
    onSuccess: (result) => {
      setNotice({ tone: result.ok ? 'success' : 'error', message: result.ok ? 'オーダーを削除しました。' : result.message ?? '削除に失敗しました。' });
      if (result.ok && patientId) {
        queryClient.invalidateQueries({ queryKey: ['charts-order-bundles', patientId] });
        queryClient.invalidateQueries({ queryKey: ['charts-order-recommendations', patientId] });
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setNotice({ tone: 'error', message: `削除に失敗しました: ${message}` });
    },
  });

  const [recommendModalOpen, setRecommendModalOpen] = useState(false);
  const [recommendModalEntity, setRecommendModalEntity] = useState<OrderEntity | ''>('');
  const [deleteTarget, setDeleteTarget] = useState<{ bundle: OrderBundle; label: string; groupLabel: string; eventId: string } | null>(null);
  const openRecommendationModal = useCallback((entity: OrderEntity) => {
    setRecommendModalEntity(entity);
    setRecommendModalOpen(true);
  }, []);

  const handleQuickAdd = useCallback(
    (groupKey: OrderGroupKey, triggerEl?: HTMLElement | null) => {
      if (showEditBlockedNotice()) return;
      setQuickAddGroupKey(groupKey);
      openEditor(
        quickAddEntityByGroup[groupKey],
        { requestId: buildRequestId(), kind: 'new' },
        { source: primaryOperationSource, reason: 'quick_add', triggerEl },
      );
    },
    [openEditor, primaryOperationSource, quickAddEntityByGroup, showEditBlockedNotice],
  );

  const handleQuickAddExit = useCallback(() => {
    setQuickAddGroupKey(null);
  }, []);

  const toggleGroupExpanded = useCallback((key: OrderGroupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleQuickSearchApply = useCallback(
    (candidate: SearchCandidate) => {
      if (!canEdit) {
        showEditBlockedNotice();
        return;
      }
      setQuickAddGroupKey(null);
      const requestId = buildRequestId();
      if (candidate.bundle) {
        openEditor(candidate.entity, { requestId, kind: 'copy', bundle: candidate.bundle }, { source: primaryOperationSource, reason: 'quick_search_copy' });
        setNotice({ tone: 'info', message: `「${candidate.label}」をコピーして編集を開始しました。` });
      } else {
        openEditor(candidate.entity, { requestId, kind: 'new' }, { source: primaryOperationSource, reason: 'quick_search_new' });
        setNotice({ tone: 'info', message: `${resolveOrderEntityLabel(candidate.entity)}の新規入力を開始しました。` });
      }
      setQuickSearch('');
    },
    [canEdit, openEditor, primaryOperationSource, showEditBlockedNotice],
  );

  const handleApplyRecommendation = useCallback(
    (candidate: OrderRecommendationCandidate, entity: string) => {
      if (showEditBlockedNotice('頻用オーダー反映')) return;
      const resolved = resolveCanonicalOrderEntity(entity.trim()) ?? entity.trim();
      if (!isOrderEntity(resolved)) return;
      setQuickAddGroupKey(null);
      openEditor(resolved, { requestId: buildRequestId(), kind: 'recommendation', candidate }, { source: primaryOperationSource, reason: 'recommendation' });
      setRecommendModalOpen(false);
    },
    [openEditor, primaryOperationSource, showEditBlockedNotice],
  );

  const latestPrescription = useMemo(() => {
    const entries = (rpHistory ?? []).filter(Boolean);
    if (entries.length === 0) return null;
    const sorted = entries.slice().sort((a, b) => (b.issuedDate ?? '').localeCompare(a.issuedDate ?? ''));
    return sorted[0] ?? null;
  }, [rpHistory]);
  const visibleGroupBundles = useMemo(
    () => (quickAddGroupKey ? groupBundles.filter((group) => group.key === quickAddGroupKey) : groupBundles),
    [quickAddGroupKey, groupBundles],
  );
  const sortedVisibleGroupBundles = useMemo(() => {
    if (orderHubMode === 'rollback-legacy') return visibleGroupBundles;
    const prioritized: OrderGroupKey[] = ['prescription', 'injection'];
    const top = prioritized.flatMap((key) => visibleGroupBundles.filter((group) => group.key === key));
    const rest = visibleGroupBundles.filter((group) => !prioritized.includes(group.key));
    return [...top, ...rest];
  }, [orderHubMode, visibleGroupBundles]);
  const hasVisibleOrders = visibleGroupBundles.some((group) => group.bundles.length > 0);
  const activeContextLabel = activeEntity
    ? `${resolveOrderEntityLabel(activeEntity)} / ${resolveOrderGroupKeyByEntity(activeEntity)} / ${resolveOrderHubSourceLabel(activeEditorSource)}${
        activeEditorContext.hasRpRequiredIssue ? ' / 必須不足' : ''
      }`
    : 'なし';
  const prescriptionDrugs = useMemo(() => latestPrescription?.rpList ?? [], [latestPrescription]);
  const prescriptionIssuedDate = latestPrescription?.issuedDate?.trim() ?? '';
  const prescriptionMemo = latestPrescription?.memo?.trim() ?? '';
  const latestPrescriptionBundle = useMemo<OrderBundle | null>(() => {
    const drugs = (latestPrescription?.rpList ?? []).filter(Boolean);
    if (drugs.length === 0) return null;
    const items = drugs.reduce<OrderBundleItem[]>((acc, drug) => {
      const code = normalizeInline(drug.srycd ?? '');
      const rawName = normalizeInline(drug.name ?? '');
      const name = normalizeInline([code, rawName].filter(Boolean).join(' '));
      if (!name) return acc;
      const item: OrderBundleItem = {
        name,
        quantity: normalizeInline(drug.dose ?? ''),
        unit: normalizeInline(drug.amount ?? ''),
        memo: normalizeInline(drug.memo ?? ''),
      };
      if (code) {
        item.code = code;
      }
      acc.push(item);
      return acc;
    }, []);
    if (items.length === 0) return null;
    const usage = normalizeInline(drugs[0]?.usage ?? '');
    const days = normalizeInline(drugs[0]?.days ?? '');
    return {
      entity: 'medOrder',
      bundleName: stripLeadingCode(items[0]?.name ?? '') || '前回処方',
      admin: usage,
      bundleNumber: days || '1',
      started: orderVisitDate,
      items,
    };
  }, [latestPrescription?.rpList, orderVisitDate]);

  const renderQuickAdds = () => {
    if (isQuickAddMode && quickAddModeSpec) {
      return (
        <div className="order-dock__quick-add" role="group" aria-label="オーダー追加">
          <span className="order-dock__quick-add-mode">クイック追加中: {quickAddModeSpec.label.replace('+', '')}</span>
          <button
            type="button"
            className="order-dock__mini-add"
            data-test-id={`order-dock-quick-add-${quickAddModeSpec.key}`}
            onClick={(event) => handleQuickAdd(quickAddModeSpec.key, event.currentTarget)}
            aria-disabled={!canEdit}
            aria-describedby={!canEdit ? 'order-dock-edit-block-reason' : undefined}
            data-disabled-reason={!canEdit ? 'order_edit_blocked' : undefined}
            title={!canEdit ? editDisabledReason : undefined}
            aria-label={`${quickAddModeSpec.label.replace('+', '')}を追加`}
          >
            {quickAddModeSpec.label}
          </button>
          <button
            type="button"
            className="order-dock__mini-secondary"
            data-test-id="order-dock-quick-add-exit"
            onClick={handleQuickAddExit}
          >
            通常閲覧へ戻る
          </button>
        </div>
      );
    }

    return (
      <div className="order-dock__quick-add" role="group" aria-label="オーダー追加">
        {quickAddCategories.map((item) => (
          <button
            key={item.label}
            type="button"
            className="order-dock__mini-add"
            data-test-id={`order-dock-quick-add-${item.key}`}
            onClick={(event) => handleQuickAdd(item.key, event.currentTarget)}
            aria-disabled={!canEdit}
            aria-describedby={!canEdit ? 'order-dock-edit-block-reason' : undefined}
            data-disabled-reason={!canEdit ? 'order_edit_blocked' : undefined}
            title={!canEdit ? editDisabledReason : undefined}
            aria-label={`${item.label.replace('+', '')}を追加`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          className="order-dock__mini-secondary"
          onClick={() => openRecommendationModal('medOrder')}
          disabled={!patientId}
          title={!patientId ? '患者未選択のため開けません。' : undefined}
          aria-label="頻用オーダーを開く"
        >
          頻用
        </button>
      </div>
    );
  };

  const renderGroup = (group: (typeof groupBundles)[number]) => {
    const groupLabel = group.key === 'prescription' ? '処方RP' : group.key === 'injection' ? '注射RP' : group.label;
    const defaultEntity =
      group.key === 'treatment'
        ? treatmentEntity
        : group.key === 'test'
          ? testEntity
          : group.key === 'charge'
            ? chargeEntity
            : group.defaultEntity;
    const selectionMeta = (() => {
      switch (group.key) {
        case 'treatment':
          return { showAll: treatmentShowAll, label: resolveOrderEntityLabel(treatmentEntity) };
        case 'test':
          return { showAll: testShowAll, label: resolveOrderEntityLabel(testEntity) };
        case 'charge':
          return { showAll: chargeShowAll, label: resolveOrderEntityLabel(chargeEntity) };
        default:
          return { showAll: false, label: '' };
      }
    })();
    const isQuickAddTarget = quickAddGroupKey === group.key;
    const visibleBundles = (() => {
      if (group.bundles.length === 0) return [];
      if (isQuickAddMode && isQuickAddTarget) return group.bundles;
      const selectedTreatmentEntity = resolveComparableOrderEntity(treatmentEntity);
      const selectedTestEntity = resolveComparableOrderEntity(testEntity);
      const selectedChargeEntity = resolveComparableOrderEntity(chargeEntity);
      if (group.key === 'treatment' && !treatmentShowAll) {
        return group.bundles.filter((bundle) => {
          const normalizedEntity = resolveComparableOrderEntity(
            resolveCanonicalOrderEntity(bundle.entity?.trim() ?? '') ?? defaultEntity,
          );
          return normalizedEntity === selectedTreatmentEntity;
        });
      }
      if (group.key === 'test' && !testShowAll) {
        return group.bundles.filter((bundle) => {
          const normalizedEntity = resolveComparableOrderEntity(
            resolveCanonicalOrderEntity(bundle.entity?.trim() ?? '') ?? defaultEntity,
          );
          return normalizedEntity === selectedTestEntity;
        });
      }
      if (group.key === 'charge' && !chargeShowAll) {
        return group.bundles.filter((bundle) => {
          const normalizedEntity = resolveComparableOrderEntity(
            resolveCanonicalOrderEntity(bundle.entity?.trim() ?? '') ?? defaultEntity,
          );
          return normalizedEntity === selectedChargeEntity;
        });
      }
      return group.bundles;
    })();
    const visibleRows = buildOrderDetailDisplayRowsForGroup({
      group: group.key,
      bundles: visibleBundles,
      defaultEntity,
    });
    const showEntityBadge = Boolean(
      (isQuickAddMode && isQuickAddTarget) ||
      (group.key === 'treatment' && treatmentShowAll) ||
        (group.key === 'test' && testShowAll) ||
        (group.key === 'charge' && chargeShowAll),
    );
    const isInlineEditorVisible = Boolean(activeEntity && (group.entities as readonly string[]).includes(activeEntity));
    const inlineEntity = isInlineEditorVisible ? activeEntity : null;
    const inlineTitleMeta = isInlineEditorVisible ? activeTitleMeta : null;
    const inlineBundlesOverride = inlineEntity ? bundlesByEntity.get(inlineEntity) ?? [] : [];
    const isExpanded = expandedGroups[group.key];
    const groupBodyId = `order-dock-group-body-${group.key}`;
    const isEditingGroup = Boolean(inlineEntity);
    const treatmentSelectedTab = treatmentShowAll ? 'all' : treatmentEntity;
    const treatmentTabKeys = [...treatmentSubtypeTabs.map((tab) => tab.key), 'all'] as const;
    const testSelectedTab = testShowAll ? 'all' : testEntity;
    const testTabKeys = [...testSubtypeTabs.map((tab) => tab.key), 'all'] as const;
    const chargeSelectedTab = chargeShowAll ? 'all' : chargeEntity;
    const chargeTabKeys = [...chargeSubtypeTabs.map((tab) => tab.key), 'all'] as const;

    return (
      <section
        key={group.key}
        className="order-dock__group"
        data-group={group.key}
        data-editing={isEditingGroup ? 'true' : 'false'}
        aria-label={`${groupLabel}アコーディオン`}
      >
        <header className="order-dock__group-header">
          <div className="order-dock__group-title">
            <strong>{groupLabel}</strong>
            {group.key === 'prescription' ? <span className="order-dock__group-mode">{RP_SHARED_USAGE_RULE}</span> : null}
            {isEditingGroup ? (
              <span className="order-dock__group-mode order-dock__group-mode--editing" role="status" aria-live="polite">
                編集中
              </span>
            ) : null}
            {isQuickAddMode ? (
              <span className="order-dock__group-mode">クイック追加</span>
            ) : (
              <span className="order-dock__group-count">
                {visibleBundles.length}
                {visibleBundles.length !== group.bundles.length ? `/${group.bundles.length}` : ''}件
                {selectionMeta.label && !selectionMeta.showAll ? `(${selectionMeta.label})` : ''}
              </span>
            )}
          </div>
          <button
            type="button"
            className="order-dock__group-action order-dock__group-action--add"
            data-test-id={`order-dock-group-add-${group.key}`}
            aria-label={`${groupLabel}を追加して編集開始`}
            onClick={(event) => handleQuickAdd(group.key, event.currentTarget)}
            aria-disabled={!canEdit}
            aria-describedby={!canEdit ? 'order-dock-edit-block-reason order-dock-edit-context-status' : 'order-dock-edit-context-status'}
            data-disabled-reason={!canEdit ? 'order_edit_blocked' : undefined}
            title={!canEdit ? editDisabledReason : undefined}
          >
            ＋
          </button>
          <button
            type="button"
            className={`order-dock__group-toggle${isExpanded ? ' order-dock__group-toggle--expanded' : ''}`}
            aria-expanded={isExpanded}
            aria-controls={groupBodyId}
            aria-describedby="order-dock-edit-context-status"
            aria-label={`${groupLabel}を${isExpanded ? '閉じる' : '開く'}`}
            onClick={() => toggleGroupExpanded(group.key)}
          >
            <span aria-hidden="true">{isExpanded ? '閉じる' : '開く'}</span>
          </button>
        </header>

        {isExpanded ? (
          <div id={groupBodyId} className="order-dock__group-body">
            {!isQuickAddMode && group.key === 'treatment' ? (
              <div
                className="order-dock__subtype-tabs"
                role="tablist"
                aria-label="処置種類"
                onKeyDown={(event) => {
                  const nextTab = resolveNextTabKey(event.key, treatmentTabKeys, treatmentSelectedTab);
                  if (!nextTab) return;
                  event.preventDefault();
                  if (nextTab === 'all') {
                    setTreatmentShowAll(true);
                  } else {
                    setTreatmentEntity(nextTab);
                    setTreatmentShowAll(false);
                  }
                  focusSubtypeTabButton(event.currentTarget, nextTab);
                }}
              >
                {treatmentSubtypeTabs.map((tab) => (
                  <button
                    key={`treatment-tab-${tab.key}`}
                    type="button"
                    className="order-dock__subtype-tab"
                    id={`order-dock-treatment-tab-${tab.key}`}
                    role="tab"
                    aria-controls={groupBodyId}
                    data-order-dock-tab-key={tab.key}
                    data-active={!treatmentShowAll && treatmentEntity === tab.key ? 'true' : 'false'}
                    aria-selected={!treatmentShowAll && treatmentEntity === tab.key}
                    tabIndex={!treatmentShowAll && treatmentEntity === tab.key ? 0 : -1}
                    onClick={() => {
                      setTreatmentEntity(tab.key);
                      setTreatmentShowAll(false);
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="order-dock__subtype-tab"
                  id="order-dock-treatment-tab-all"
                  role="tab"
                  aria-controls={groupBodyId}
                  data-order-dock-tab-key="all"
                  data-active={treatmentShowAll ? 'true' : 'false'}
                  aria-selected={treatmentShowAll}
                  tabIndex={treatmentShowAll ? 0 : -1}
                  onClick={() => setTreatmentShowAll(true)}
                >
                  すべて
                </button>
              </div>
            ) : null}
            {!isQuickAddMode && group.key === 'test' ? (
              <div
                className="order-dock__subtype-tabs"
                role="tablist"
                aria-label="検査種類"
                onKeyDown={(event) => {
                  const nextTab = resolveNextTabKey(event.key, testTabKeys, testSelectedTab);
                  if (!nextTab) return;
                  event.preventDefault();
                  if (nextTab === 'all') {
                    setTestShowAll(true);
                  } else {
                    setTestEntity(nextTab);
                    setTestShowAll(false);
                  }
                  focusSubtypeTabButton(event.currentTarget, nextTab);
                }}
              >
                {testSubtypeTabs.map((tab) => (
                  <button
                    key={`test-tab-${tab.key}`}
                    type="button"
                    className="order-dock__subtype-tab"
                    id={`order-dock-test-tab-${tab.key}`}
                    role="tab"
                    aria-controls={groupBodyId}
                    data-order-dock-tab-key={tab.key}
                    data-active={!testShowAll && testEntity === tab.key ? 'true' : 'false'}
                    aria-selected={!testShowAll && testEntity === tab.key}
                    tabIndex={!testShowAll && testEntity === tab.key ? 0 : -1}
                    onClick={() => {
                      setTestEntity(tab.key);
                      setTestShowAll(false);
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="order-dock__subtype-tab"
                  id="order-dock-test-tab-all"
                  role="tab"
                  aria-controls={groupBodyId}
                  data-order-dock-tab-key="all"
                  data-active={testShowAll ? 'true' : 'false'}
                  aria-selected={testShowAll}
                  tabIndex={testShowAll ? 0 : -1}
                  onClick={() => setTestShowAll(true)}
                >
                  すべて
                </button>
              </div>
            ) : null}
            {!isQuickAddMode && group.key === 'charge' ? (
              <div
                className="order-dock__subtype-tabs"
                role="tablist"
                aria-label="算定種類"
                onKeyDown={(event) => {
                  const nextTab = resolveNextTabKey(event.key, chargeTabKeys, chargeSelectedTab);
                  if (!nextTab) return;
                  event.preventDefault();
                  if (nextTab === 'all') {
                    setChargeShowAll(true);
                  } else {
                    setChargeEntity(nextTab);
                    setChargeShowAll(false);
                  }
                  focusSubtypeTabButton(event.currentTarget, nextTab);
                }}
              >
                {chargeSubtypeTabs.map((tab) => (
                  <button
                    key={`charge-tab-${tab.key}`}
                    type="button"
                    className="order-dock__subtype-tab"
                    id={`order-dock-charge-tab-${tab.key}`}
                    role="tab"
                    aria-controls={groupBodyId}
                    data-order-dock-tab-key={tab.key}
                    data-active={!chargeShowAll && chargeEntity === tab.key ? 'true' : 'false'}
                    aria-selected={!chargeShowAll && chargeEntity === tab.key}
                    tabIndex={!chargeShowAll && chargeEntity === tab.key ? 0 : -1}
                    onClick={() => {
                      setChargeEntity(tab.key);
                      setChargeShowAll(false);
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="order-dock__subtype-tab"
                  id="order-dock-charge-tab-all"
                  role="tab"
                  aria-controls={groupBodyId}
                  data-order-dock-tab-key="all"
                  data-active={chargeShowAll ? 'true' : 'false'}
                  aria-selected={chargeShowAll}
                  tabIndex={chargeShowAll ? 0 : -1}
                  onClick={() => setChargeShowAll(true)}
                >
                  すべて
                </button>
              </div>
            ) : null}
            {inlineEntity && inlineTitleMeta ? (
              <div className="order-dock__inline-editor" aria-label={`${resolveOrderEntityLabel(inlineEntity)}入力`}>
                <OrderBundleEditPanel
                  patientId={patientId}
                  entity={inlineEntity}
                  title={inlineTitleMeta.title}
                  bundleLabel={inlineTitleMeta.bundleLabel}
                  itemQuantityLabel={inlineTitleMeta.itemQuantityLabel}
                  meta={meta}
                  variant="embedded"
                  bundlesOverride={inlineBundlesOverride}
                  request={activeRequest}
                  onRequestConsumed={(requestId) => {
                    setActiveRequest((prev) => (prev?.requestId === requestId ? null : prev));
                  }}
                  onSubmitResult={handleEditorSubmitResult}
                  historyCopyRequest={
                    historyCopyRequest?.entity === inlineEntity
                      ? { requestId: historyCopyRequest.requestId, bundle: historyCopyRequest.bundle }
                      : null
                  }
                  onHistoryCopyConsumed={(requestId) => onHistoryCopyConsumed?.(requestId)}
                  onEditingContextChange={setActiveEditorContext}
                  onClose={() => {
                    closeEditor({ source: primaryOperationSource, reason: 'editor_close' });
                  }}
                />
              </div>
            ) : null}

            <div className="order-dock__bundle-list" role="list" aria-label={`${groupLabel}オーダー一覧`}>
              {group.bundles.length === 0 ? (
                isQuickAddMode ? null : <p className="order-dock__empty">まだありません。</p>
              ) : visibleBundles.length === 0 ? (
                isQuickAddMode ? null : <p className="order-dock__empty">この種類のオーダーはまだありません。</p>
              ) : (
                visibleRows.map((row) => {
                  const bundle = row.bundle;
                  const bundleEntity = row.entity;
                  const bundleLabel = row.bundleLabel;
                  const warnings = bundle.documentId
                    ? orcaMedicalWarnings.filter(
                        (warning) =>
                          warning.documentId === bundle.documentId && (warning.entity?.trim() ?? '') === bundleEntity,
                      )
                    : [];
                  const warningBadge = resolveWarningBadge(warnings);
                  const rpRequiredIssue = resolveRpRequiredIssueFromBundle(bundle);
                  const canMutate = canEdit;
                  return (
                    <div
                      key={`${group.key}-${row.id}`}
                      className="order-dock__bundle"
                      role="listitem"
                    >
                      <div className="order-dock__bundle-main">
                        <div className="order-dock__bundle-head">
                          <strong className="order-dock__bundle-name">{bundleLabel}</strong>
                          <div className="order-dock__bundle-badges" role="group" aria-label="バッジ">
                            {showEntityBadge ? (
                              <span className="order-dock__badge order-dock__badge--entity">{resolveOrderEntityLabel(bundleEntity)}</span>
                            ) : null}
                            {rpRequiredIssue ? <span className="order-dock__badge order-dock__badge--required">必須不足</span> : null}
                            {warningBadge ? (
                              <span className={`order-dock__badge order-dock__badge--${warningBadge.tone}`}>
                                {warningBadge.label}
                                {warningBadge.count > 1 ? `×${warningBadge.count}` : ''}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span className="order-dock__bundle-meta">{row.operatorLine}</span>
                        {renderBundleDetailSummary(row)}
                        {rpRequiredIssue ? (
                          <>
                            <span className="order-dock__bundle-required">{buildRpRequiredEditorMessage(rpRequiredIssue)}</span>
                            <ul className="order-dock__bundle-required-list" aria-label="不足しているRP必須項目">
                              {rpRequiredIssue.missing.map((field) => (
                                <li key={`${bundleLabel}-${field}`}>{resolveRpRequiredFieldLabel(field)}</li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                      </div>
                      <div className="order-dock__bundle-actions" role="group" aria-label={`${groupLabel}束操作`}>
                        <button
                          type="button"
                          className="order-dock__bundle-action"
                          aria-label={`${bundleLabel}を編集`}
                          onClick={(event) => {
                            if (showEditBlockedNotice('オーダー編集')) return;
                            openEditor(bundleEntity, { requestId: buildRequestId(), kind: 'edit', bundle }, {
                              source: primaryOperationSource,
                              reason: 'bundle_edit',
                              triggerEl: event.currentTarget,
                            });
                          }}
                          aria-disabled={!canMutate}
                          aria-describedby={!canMutate ? 'order-dock-edit-block-reason' : undefined}
                          data-disabled-reason={!canMutate ? 'order_edit_blocked' : undefined}
                          title={!canMutate ? editDisabledReason : undefined}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className="order-dock__bundle-action"
                          aria-label={`${bundleLabel}をコピーして編集`}
                          onClick={(event) => {
                            if (showEditBlockedNotice('オーダーコピー')) return;
                            openEditor(bundleEntity, { requestId: buildRequestId(), kind: 'copy', bundle }, {
                              source: primaryOperationSource,
                              reason: 'bundle_copy',
                              triggerEl: event.currentTarget,
                            });
                          }}
                          aria-disabled={!canMutate}
                          aria-describedby={!canMutate ? 'order-dock-edit-block-reason' : undefined}
                          data-disabled-reason={!canMutate ? 'order_edit_blocked' : undefined}
                          title={!canMutate ? editDisabledReason : undefined}
                        >
                          コピー
                        </button>
                        <button
                          type="button"
                          className="order-dock__bundle-action order-dock__bundle-action--danger"
                          aria-label={`${bundleLabel}を削除`}
                          onClick={() => {
                            if (showEditBlockedNotice('オーダー削除')) return;
                            const eventId = buildOrderHubEventId();
                            emitOrderHubKpi({
                              category: 'OUI-01',
                              source: primaryOperationSource,
                              result: 'started',
                              eventId,
                              reason: 'bundle_delete',
                              details: { entity: bundleEntity, bundleName: bundleLabel },
                            });
                            setDeleteTarget({ bundle, label: bundleLabel, groupLabel, eventId });
                          }}
                          aria-disabled={!canMutate}
                          aria-describedby={!canMutate ? 'order-dock-edit-block-reason' : undefined}
                          data-disabled-reason={!canMutate ? 'order_edit_blocked' : undefined}
                          disabled={deleteMutation.isPending}
                          title={!canMutate ? editDisabledReason : undefined}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  return (
    <div
      className="order-dock"
      aria-label="オーダー入力ハブ"
      data-has-orders={hasAnyOrders ? '1' : '0'}
      data-hub-mode={orderHubMode}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        if (contextGuard || deleteTarget) return;
        if (!activeEntity) return;
        event.preventDefault();
        closeEditor({ source: primaryOperationSource, reason: 'escape_key', triggerEl: event.currentTarget });
      }}
    >
      <FocusTrapDialog
        open={Boolean(contextGuard)}
        role="alertdialog"
        title="編集中の内容を破棄して切り替えますか？"
        description="編集コンテキストは同時に1つのみ保持できます。"
        onClose={handleContextGuardCancel}
        testId="order-dock-context-guard-dialog"
      >
        <section className="charts-tab-guard" aria-label="編集コンテキスト切替確認">
          <dl className="charts-actions__send-confirm-list">
            <div>
              <dt>現在の編集中</dt>
              <dd>{contextGuard ? resolveOrderEntityLabel(contextGuard.currentEntity) : '—'}</dd>
            </div>
            <div>
              <dt>切替先</dt>
              <dd>
                {contextGuard?.target.kind === 'switch'
                  ? resolveOrderEntityLabel(contextGuard.target.entity)
                  : '編集を終了（一覧へ戻る）'}
              </dd>
            </div>
            <div>
              <dt>操作元</dt>
              <dd>{contextGuard ? (contextGuard.target.source === 'bottom-floating' ? '下欄フローティング' : '右欄アコーディオン') : '—'}</dd>
            </div>
            <div>
              <dt>影響範囲</dt>
              <dd>未保存の入力が破棄される可能性があります。</dd>
            </div>
          </dl>
          <div className="charts-tab-guard__actions" role="group" aria-label="編集コンテキスト切替操作">
            <button type="button" onClick={handleContextGuardCancel}>
              キャンセル
            </button>
            <button type="button" className="charts-tab-guard__danger" onClick={handleContextGuardConfirm}>
              破棄して切替
            </button>
          </div>
        </section>
      </FocusTrapDialog>
      <FocusTrapDialog
        open={Boolean(deleteTarget)}
        role="alertdialog"
        title="オーダーを削除しますか？"
        description="対象と影響範囲を確認して実行してください。"
        onClose={() => setDeleteTarget(null)}
        testId="order-dock-delete-dialog"
      >
        <section className="charts-tab-guard" aria-label="オーダー削除確認">
          <dl className="charts-actions__send-confirm-list">
            <div>
              <dt>対象名</dt>
              <dd>{deleteTarget?.label ?? '—'}</dd>
            </div>
            <div>
              <dt>患者ID</dt>
              <dd>{patientId ?? '—'}</dd>
            </div>
            <div>
              <dt>対象カテゴリ</dt>
              <dd>{deleteTarget?.groupLabel ?? '—'}</dd>
            </div>
            <div>
              <dt>影響範囲</dt>
              <dd>該当オーダー束が一覧から削除されます。</dd>
            </div>
          </dl>
          <div className="charts-tab-guard__actions" role="group" aria-label="オーダー削除操作">
            <button type="button" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </button>
            <button
              type="button"
              className="charts-tab-guard__danger"
              onClick={() => {
                if (!deleteTarget) return;
                const eventId = deleteTarget.eventId;
                deleteMutation.mutate(deleteTarget.bundle, {
                  onSuccess: (result) => {
                    emitOrderHubKpi({
                      category: 'OUI-01',
                      source: primaryOperationSource,
                      result: result.ok ? 'success' : 'failed',
                      eventId,
                      reason: 'bundle_delete',
                    });
                  },
                  onError: () => {
                    emitOrderHubKpi({
                      category: 'OUI-01',
                      source: primaryOperationSource,
                      result: 'failed',
                      eventId,
                      reason: 'bundle_delete',
                    });
                  },
                  onSettled: () => setDeleteTarget(null),
                });
              }}
              disabled={deleteMutation.isPending}
            >
              削除する
            </button>
          </div>
        </section>
      </FocusTrapDialog>
      <header className="order-dock__header">
        <strong>オーダー入力</strong>
        <span className="order-dock__meta">診療日:{orderVisitDate || '—'}</span>
      </header>
      <div className="order-dock__notice order-dock__notice--info" aria-label="オーダー候補ソース">
        候補ソース: 既存オーダー / 患者候補 / 施設頻用 / ORCA診療セット / 検索して追加。ORCA候補は確定処方・ORCA送信・会計済みではありません。
      </div>
      <section className="order-dock__workbench" aria-label="オーダーワークベンチ" data-testid="order-dock-workbench">
        <div className="order-dock__workbench-rail" role="navigation" aria-label="オーダー種別">
          {groupBundles.map((group) => (
            <button
              key={`workbench-category-${group.key}`}
              type="button"
              className="order-dock__workbench-category"
              data-active={
                quickSearchGroup === group.key ||
                (activeEntity != null && resolveOrderGroupKeyByEntity(activeEntity) === group.key)
                  ? 'true'
                  : 'false'
              }
              aria-current={quickSearchGroup === group.key ? 'true' : undefined}
              onClick={() => {
                setQuickSearchGroup(group.key);
                setExpandedGroups((prev) => ({ ...prev, [group.key]: true }));
              }}
            >
              <span>{ORDER_WORKBENCH_CATEGORY_LABEL[group.key]}</span>
              <strong>{group.bundles.length}</strong>
            </button>
          ))}
        </div>
        <div className="order-dock__workbench-stage" aria-label="候補からオーダー内容へ">
          <div className="order-dock__workbench-pane">
            <strong>候補/セット選択</strong>
            <span>検索、頻用、ORCA入力セット、セット/スタンプを下書き候補として扱います。</span>
          </div>
          <div className="order-dock__workbench-pane">
            <strong>オーダー内容</strong>
            <span>候補反映後は行単位で編集します。保存・確定・ORCA送信とは分離します。</span>
          </div>
        </div>
      </section>
      <div
        id="order-dock-edit-context-status"
        className="order-dock__context"
        role="status"
        aria-live="polite"
        tabIndex={-1}
        data-test-id="order-dock-edit-context"
        data-editing={hasEditing ? 'true' : 'false'}
        data-target-category={targetCategory ?? ''}
        data-editor-source={activeEditorSource ?? ''}
        data-rp-required={activeEditorContext.hasRpRequiredIssue ? 'true' : 'false'}
        data-rp-required-missing={activeEditorContext.rpRequiredMissing.join(',')}
      >
        <span className="order-dock__context-mode">モード: {ORDER_HUB_MODE_LABEL[orderHubMode]}</span>
        <span className="order-dock__context-current">編集中: {activeContextLabel}</span>
      </div>
      {!orderBundlesLoading && !orderBundlesError ? renderQuickAdds() : null}
      {!isQuickAddMode ? (
        <div className="order-dock__search" aria-label="検索して追加">
          <div className="order-dock__search-row">
            <label htmlFor="order-dock-search-input">検索して追加</label>
            <input
              id="order-dock-search-input"
              type="search"
              value={quickSearch}
              onChange={(event) => setQuickSearch(event.target.value)}
              placeholder="オーダー名・薬剤名・コード"
              disabled={!patientId || !canEdit}
              aria-label="オーダー検索"
              aria-describedby={!canEdit && editDisabledReason ? 'order-dock-search-block-reason' : undefined}
            />
            <select
              value={quickSearchGroup}
              onChange={(event) => setQuickSearchGroup(event.target.value as OrderGroupKey | 'all')}
              disabled={!patientId || !canEdit}
              aria-label="カテゴリ選択"
              aria-describedby={!canEdit && editDisabledReason ? 'order-dock-search-block-reason' : undefined}
            >
              <option value="all">全カテゴリ</option>
              <option value="prescription">処方</option>
              <option value="injection">注射</option>
              <option value="treatment">処置</option>
              <option value="test">検査</option>
              <option value="charge">算定</option>
            </select>
          </div>
          {!canEdit && editDisabledReason ? (
            <p id="order-dock-search-block-reason" className="order-dock__search-empty">
              検索して追加はブロックされています: {editDisabledReason}
            </p>
          ) : null}
          {quickSearchCandidates.length > 0 ? (
            <ul className="order-dock__search-results" role="listbox" aria-label="検索候補">
              {quickSearchCandidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className="order-dock__search-result"
                    onClick={() => handleQuickSearchApply(candidate)}
                    disabled={!canEdit}
                    title={!canEdit ? editDisabledReason : candidate.detail}
                  >
                    <strong>{candidate.label}</strong>
                    <span>{candidate.detail ?? '候補'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : quickSearch.trim().length > 0 ? (
            <p className="order-dock__search-empty">候補が見つかりません。カテゴリを変えて検索してください。</p>
          ) : null}
        </div>
      ) : null}

      {!canEdit && editDisabledReason ? (
        <div id="order-dock-edit-block-reason" className="order-dock__notice order-dock__notice--info">
          オーダー追加はブロックされています: {editDisabledReason}
        </div>
      ) : null}
      {notice ? <div className={`order-dock__notice order-dock__notice--${notice.tone}`}>{notice.message}</div> : null}
      {orderBundlesLoading ? <p className="order-dock__empty">オーダー情報を取得しています...</p> : null}
      {orderBundlesError ? <p className="order-dock__empty">{resolveUserSafeFetchFailure('オーダー情報', orderBundlesError)}</p> : null}
      {!orderBundlesLoading && !orderBundlesError && (hasVisibleOrders || activeEntity) ? (
        <div className="order-dock__groups">{sortedVisibleGroupBundles.map(renderGroup)}</div>
      ) : null}

      {rpHistoryLoading || rpHistoryError || prescriptionDrugs.length > 0 || prescriptionMemo ? (
        <details className="order-dock__rx" aria-label="処方履歴（直近）">
          <summary className="order-dock__rx-summary">処方履歴（直近）</summary>
          {rpHistoryLoading ? (
            <p className="order-dock__empty">処方履歴を取得しています...</p>
          ) : rpHistoryError ? (
            <p className="order-dock__empty">{resolveUserSafeFetchFailure('処方履歴', rpHistoryError)}</p>
          ) : prescriptionDrugs.length === 0 ? (
            <p className="order-dock__empty">直近の処方履歴はありません。</p>
          ) : (
            <>
              <p className="order-dock__rx-meta">発行:{prescriptionIssuedDate || '—'}</p>
              <ol className="order-dock__rx-list" aria-label="処方薬剤一覧">
                {prescriptionDrugs.slice(0, 40).map((drug, index) => {
                  const name = drug.name?.trim() || '薬剤名不明';
                  const dose = drug.dose?.trim();
                  const amount = drug.amount?.trim();
                  const usage = drug.usage?.trim();
                  const days = drug.days?.trim();
                  const line = [dose, amount].filter(Boolean).join(' ');
                  const metaLine = [usage, days ? `日数:${days}` : null].filter(Boolean).join(' / ');
                  return (
                    <li key={`${name}-${index}`} className="order-dock__rx-item">
                      <strong>{name}</strong>
                      {line ? <span>{line}</span> : null}
                      {metaLine ? <span className="order-dock__rx-sub">{metaLine}</span> : null}
                    </li>
                  );
                })}
              </ol>
              {prescriptionMemo ? <p className="order-dock__rx-memo">メモ: {prescriptionMemo}</p> : null}
              <div className="order-dock__rx-actions" role="group" aria-label="処方取り込み">
                <button
                  type="button"
                  className="order-dock__rx-action"
                  onClick={(event) => {
                    if (showEditBlockedNotice('処方履歴取り込み')) return;
                    openEditor('medOrder', { requestId: buildRequestId(), kind: 'new' }, {
                      source: 'bottom-floating',
                      reason: 'rx_new',
                      triggerEl: event.currentTarget,
                    });
                  }}
                  aria-disabled={!canEdit}
                  aria-describedby={!canEdit ? 'order-dock-edit-block-reason' : undefined}
                  data-disabled-reason={!canEdit ? 'order_edit_blocked' : undefined}
                  title={!canEdit ? editDisabledReason : undefined}
                >
                  新規（空）
                </button>
                <button
                  type="button"
                  className="order-dock__rx-action"
                  onClick={(event) => {
                    if (showEditBlockedNotice('直近処方コピー')) return;
                    if (!latestPrescriptionBundle) return;
                    openEditor('medOrder', { requestId: buildRequestId(), kind: 'copy', bundle: latestPrescriptionBundle }, {
                      source: 'bottom-floating',
                      reason: 'rx_copy',
                      triggerEl: event.currentTarget,
                    });
                  }}
                  aria-disabled={!canEdit}
                  aria-describedby={!canEdit ? 'order-dock-edit-block-reason' : undefined}
                  data-disabled-reason={!canEdit ? 'order_edit_blocked' : undefined}
                  disabled={!latestPrescriptionBundle}
                  title={
                    !latestPrescriptionBundle
                      ? '直近処方がないためコピーできません。'
                      : !canEdit
                        ? editDisabledReason
                        : '直近処方をコピーして開始します。'
                  }
                >
                  直近処方をコピーして開始
                </button>
              </div>
            </>
          )}
        </details>
      ) : null}

      <OrderRecommendationModal
        open={recommendModalOpen}
        patientId={patientId}
        defaultEntity={recommendModalEntity || undefined}
        defaultScope={recommendModalEntity ? 'category' : 'all'}
        onClose={() => setRecommendModalOpen(false)}
        onApply={handleApplyRecommendation}
      />
    </div>
  );
}
