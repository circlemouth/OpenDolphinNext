import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';

import type { OrderBundle } from './orderBundleApi';
import {
  ORDER_GROUP_REGISTRY,
  resolveCanonicalOrderEntity,
  resolveOrderEntityLabel,
  resolveOrderGroupKeyByEntity,
  type OrderEntity,
} from './orderCategoryRegistry';
import {
  buildOrderDetailDisplayRowsForGroup,
  resolveLatestBundle,
  sortBundlesByLatestRule,
} from './orderDetailDisplayViewModel';
import type { OrderBundleEditPanelMeta, OrderBundleEditPanelRequest } from './OrderBundleEditPanel';
import {
  filterInputSetItemsForEntity,
  resolveOrderChooserCtaLabel,
  resolveOrderChooserSources,
  splitRecommendationCandidates,
} from './orderChooserSources';
import {
  fetchOrcaOrderInputSets,
  type OrcaOrderInputSetSummary,
} from './orcaOrderInputSetApi';
import {
  fetchOrderRecommendations,
  type OrderRecommendationCandidate,
} from './orderRecommendationApi';
import { resolveUserSafeFetchFailure } from './userSafeErrorCopy';
import {
  RIGHT_UTILITY_TOOLS,
  resolveRightUtilityToolLabel,
  type RightUtilityTool,
} from './rightUtilityTools';

export type { RightUtilityTool } from './rightUtilityTools';

type RightUtilityDrawerProps = {
  open: boolean;
  activeTool: RightUtilityTool;
  mode?: 'dock' | 'overlay';
  minimized?: boolean;
  width?: number;
  onMinimizedChange?: (minimized: boolean) => void;
  onPeekChange?: (peek: boolean) => void;
  onWidthChange?: (width: number) => void;
  onToolSelect?: (tool: RightUtilityTool) => void;
  patientId?: string;
  meta: OrderBundleEditPanelMeta;
  orderBundles?: OrderBundle[];
  orderBundlesLoading?: boolean;
  orderBundlesError?: string;
  prescriptionBundles?: OrderBundle[];
  prescriptionBundlesLoading?: boolean;
  prescriptionBundlesError?: string;
  activeOrderEntity?: OrderEntity | null;
  activeOrderRequest?: OrderBundleEditPanelRequest | null;
  onOrderEntitySwitch?: (entity: OrderEntity) => void;
  onOrderRequest?: (entity: OrderEntity, request: OrderBundleEditPanelRequest) => void;
  onClose: () => void;
};

const normalizeBundleEntity = (bundle: OrderBundle, fallback: OrderEntity): OrderEntity => {
  const raw = bundle.entity?.trim() ?? '';
  const resolved = resolveCanonicalOrderEntity(raw) ?? raw;
  return resolveCanonicalOrderEntity(resolved) ?? (resolved as OrderEntity) ?? fallback;
};

const belongsToSelectionEntity = (bundleEntity: OrderEntity, selectedEntity: OrderEntity) => {
  const normalizedBundleEntity = resolveCanonicalOrderEntity(bundleEntity) ?? bundleEntity;
  const normalizedSelectedEntity = resolveCanonicalOrderEntity(selectedEntity) ?? selectedEntity;
  return normalizedBundleEntity === normalizedSelectedEntity;
};

const resolveNextTabEntity = <T extends string>(key: string, entities: readonly T[], selected: T): T | null => {
  const selectedIndex = entities.indexOf(selected);
  if (selectedIndex < 0 || entities.length === 0) return null;
  if (key === 'Home') return entities[0] ?? null;
  if (key === 'End') return entities[entities.length - 1] ?? null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return entities[(selectedIndex + 1) % entities.length] ?? null;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return entities[(selectedIndex - 1 + entities.length) % entities.length] ?? null;
  return null;
};

const focusDrawerSubtypeTab = (container: HTMLDivElement, entity: OrderEntity) => {
  const target = container.querySelector<HTMLButtonElement>(`button[data-drawer-subtype-entity="${entity}"]`);
  if (!target) return;
  requestAnimationFrame(() => target.focus());
};

const MAX_PREVIEW_ITEMS = 3;
const MIN_DRAWER_WIDTH = 560;
const MAX_DRAWER_RIGHT_GUTTER = 80;
const MINIMIZED_HANDLE_WIDTH = 56;
const RESIZE_HIT_WIDTH = 12;

type EncounterGuardStatus = 'ok' | 'noPatient' | 'noEncounter' | 'readOnly' | 'missingMaster' | 'fallbackUsed';

type EncounterGuard = {
  status: EncounterGuardStatus;
  message?: string;
};

type OrderChooserState = {
  status: 'closed' | 'blocked' | 'open' | 'loading' | 'error';
  tool: RightUtilityTool;
  source?: 'existing' | 'patient' | 'facility' | 'orca' | 'search';
  reason?: EncounterGuardStatus | 'fetchFailure';
};

const hasText = (value: string | undefined) => Boolean(value?.trim());

const resolveEncounterGuard = (patientId: string | undefined, meta: OrderBundleEditPanelMeta): EncounterGuard => {
  if (!hasText(patientId)) {
    return {
      status: 'noPatient',
      message: '患者が選択されていません。候補表示、ORCA候補検索、新規作成は開始できません。',
    };
  }
  if (
    !hasText(meta.encounterId) &&
    !hasText(meta.scheduleKey) &&
    !hasText(meta.appointmentId) &&
    !hasText(meta.receptionId)
  ) {
    return {
      status: 'noEncounter',
      message: '来院文脈が不足しています。候補表示、ORCA候補検索、新規作成は開始できません。',
    };
  }
  if (meta.readOnly) {
    return {
      status: 'readOnly',
      message: meta.readOnlyReason ?? '読み取り専用のため候補表示、候補反映、新規作成は開始できません。',
    };
  }
  if (meta.missingMaster) {
    return {
      status: 'missingMaster',
      message: 'マスター未同期のため候補表示、ORCA候補検索、新規作成は開始できません。',
    };
  }
  if (meta.fallbackUsed) {
    return {
      status: 'fallbackUsed',
      message: 'フォールバックデータのため候補表示、候補反映、新規作成は開始できません。',
    };
  }
  return { status: 'ok' };
};

const clampDrawerWidth = (width: number) => {
  if (!Number.isFinite(width)) return MIN_DRAWER_WIDTH;
  if (typeof window === 'undefined') return Math.max(MIN_DRAWER_WIDTH, Math.round(width));
  const max = Math.max(MIN_DRAWER_WIDTH, window.innerWidth - MAX_DRAWER_RIGHT_GUTTER);
  return Math.max(MIN_DRAWER_WIDTH, Math.min(Math.round(width), max));
};

const subtractDays = (value: string | undefined, days: number) => {
  const base = value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(base.getTime())) return undefined;
  base.setUTCDate(base.getUTCDate() - days);
  return base.toISOString().slice(0, 10);
};

const buildChooserRequestId = (prefix: string) =>
  `right-chooser-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const resolveChooserTitle = (tool: RightUtilityTool, selectedEntity: OrderEntity | null) => {
  if (!selectedEntity) return `${resolveRightUtilityToolLabel(tool)}候補`;
  const group = resolveOrderGroupKeyByEntity(selectedEntity);
  if (!group || group === 'prescription' || group === 'injection') {
    return `${resolveRightUtilityToolLabel(tool)}候補`;
  }
  return `${resolveRightUtilityToolLabel(tool)}候補 / ${resolveOrderEntityLabel(selectedEntity)}`;
};

const resolveSourceRoleLabel = (sourceKey: string) => {
  switch (sourceKey) {
    case 'existing':
      return '既存API由来';
    case 'patient':
      return '患者候補';
    case 'facility':
      return '施設頻用';
    case 'orca-input-set':
    case 'orca-set':
      return 'ORCA診療セット候補';
    case 'search':
      return '検索追加';
    default:
      return '入力開始';
  }
};

export { resolveLatestBundle, sortBundlesByLatestRule };

export function RightUtilityDrawer({
  open,
  activeTool,
  mode = 'dock',
  minimized = false,
  width = 860,
  onMinimizedChange,
  onPeekChange,
  onWidthChange,
  onToolSelect,
  patientId,
  meta,
  orderBundles,
  orderBundlesLoading = false,
  orderBundlesError,
  prescriptionBundles,
  prescriptionBundlesLoading = false,
  prescriptionBundlesError,
  activeOrderEntity,
  activeOrderRequest,
  onOrderEntitySwitch,
  onOrderRequest,
  onClose,
}: RightUtilityDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const peekCleanupRef = useRef<(() => void) | null>(null);
  const [inputSetKeyword, setInputSetKeyword] = useState('');
  const [submittedInputSetKeyword, setSubmittedInputSetKeyword] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (open) {
      drawer.removeAttribute('inert');
      return;
    }
    drawer.setAttribute('inert', '');
  }, [open]);

  useEffect(
    () => () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      peekCleanupRef.current?.();
      peekCleanupRef.current = null;
    },
    [],
  );

  const groupSpec = useMemo(() => ORDER_GROUP_REGISTRY.find((spec) => spec.key === activeTool) ?? null, [activeTool]);
  const groupBundles = useMemo(() => {
    if (!groupSpec) return [];
    if (groupSpec.key === 'prescription' && prescriptionBundles) return prescriptionBundles;
    return (orderBundles ?? []).filter((bundle) => resolveOrderGroupKeyByEntity(bundle.entity?.trim() ?? '') === groupSpec.key);
  }, [groupSpec, orderBundles, prescriptionBundles]);

  const sortedGroupBundles = useMemo(() => sortBundlesByLatestRule(groupBundles), [groupBundles]);
  const selectedEntity = useMemo<OrderEntity | null>(() => {
    if (!groupSpec) return null;
    if (activeOrderEntity && groupSpec.entities.includes(activeOrderEntity)) return activeOrderEntity;
    return groupSpec.defaultEntity;
  }, [activeOrderEntity, groupSpec]);
  const guardedPatientId = patientId ?? meta.patientId;
  const encounterGuard = useMemo(() => resolveEncounterGuard(guardedPatientId, meta), [guardedPatientId, meta]);
  const chooserEnabled = open && encounterGuard.status === 'ok';

  useEffect(() => {
    setInputSetKeyword('');
    setSubmittedInputSetKeyword('');
  }, [selectedEntity]);

  const bundlesBySelectedEntity = useMemo(() => {
    if (!groupSpec || !selectedEntity) return [];
    return sortedGroupBundles.filter((bundle) => {
      const entity = normalizeBundleEntity(bundle, groupSpec.defaultEntity);
      return belongsToSelectionEntity(entity, selectedEntity);
    });
  }, [groupSpec, selectedEntity, sortedGroupBundles]);

  const existingOrderRows = useMemo(() => {
    if (!groupSpec || !selectedEntity) return [];
    return buildOrderDetailDisplayRowsForGroup({
      group: groupSpec.key,
      bundles: bundlesBySelectedEntity,
      defaultEntity: selectedEntity,
    });
  }, [bundlesBySelectedEntity, groupSpec, selectedEntity]);

  const recommendationFrom = useMemo(() => subtractDays(meta.visitDate, 365), [meta.visitDate]);
  const recommendationQuery = useQuery({
    queryKey: ['right-utility-drawer-recommendations', guardedPatientId, selectedEntity, recommendationFrom],
    queryFn: async () =>
      fetchOrderRecommendations({
        patientId: guardedPatientId!,
        entity: selectedEntity ?? undefined,
        from: recommendationFrom,
        includeFacility: true,
        patientLimit: 4,
        facilityLimit: 4,
        scanLimit: 200,
      }),
    enabled: chooserEnabled && Boolean(guardedPatientId && selectedEntity),
    staleTime: 30_000,
  });

  const recommendationCandidates = useMemo(
    () => splitRecommendationCandidates(recommendationQuery.data?.recommendations ?? []),
    [recommendationQuery.data?.recommendations],
  );

  const inputSetQuery = useQuery({
    queryKey: ['right-utility-drawer-input-sets', submittedInputSetKeyword, selectedEntity, meta.visitDate],
    queryFn: async () =>
      fetchOrcaOrderInputSets({
        keyword: submittedInputSetKeyword,
        entity: selectedEntity ?? undefined,
        effective: meta.visitDate,
        size: 8,
      }),
    enabled: chooserEnabled && Boolean(selectedEntity && submittedInputSetKeyword.trim()),
    staleTime: 30_000,
  });

  const inputSetItems = useMemo(
    () => filterInputSetItemsForEntity(inputSetQuery.data?.items ?? [], selectedEntity ?? 'medOrder'),
    [inputSetQuery.data?.items, selectedEntity],
  );

  const resolvedPanelLoading = groupSpec?.key === 'prescription' ? prescriptionBundlesLoading : orderBundlesLoading;
  const resolvedPanelError =
    groupSpec?.key === 'prescription'
      ? prescriptionBundlesError ?? orderBundlesError
      : orderBundlesError;
  const activeEditBundle =
    activeOrderRequest && (activeOrderRequest.kind === 'edit' || activeOrderRequest.kind === 'copy')
      ? activeOrderRequest.bundle
      : null;
  const orderChooserState = useMemo<OrderChooserState>(() => {
    if (!open) return { status: 'closed', tool: activeTool };
    if (encounterGuard.status !== 'ok') {
      return { status: 'blocked', tool: activeTool, reason: encounterGuard.status };
    }
    if (recommendationQuery.isFetching || inputSetQuery.isFetching) return { status: 'loading', tool: activeTool };
    if (recommendationQuery.data && !recommendationQuery.data.ok) {
      return { status: 'error', tool: activeTool, source: 'patient', reason: 'fetchFailure' };
    }
    if (inputSetQuery.data && !inputSetQuery.data.ok) {
      return { status: 'error', tool: activeTool, source: 'orca', reason: 'fetchFailure' };
    }
    return { status: 'open', tool: activeTool };
  }, [
    activeTool,
    encounterGuard.status,
    inputSetQuery.data,
    inputSetQuery.isFetching,
    open,
    recommendationQuery.data,
    recommendationQuery.isFetching,
  ]);
  const resolvedDrawerWidth = clampDrawerWidth(width);
  const visibleDrawerWidth = minimized ? MINIMIZED_HANDLE_WIDTH : resolvedDrawerWidth;
  const drawerInlineStyle = useMemo(
    () =>
      ({
        '--soap-right-drawer-width': `${visibleDrawerWidth}px`,
        '--soap-right-drawer-minimized-handle': `${MINIMIZED_HANDLE_WIDTH}px`,
        '--soap-right-drawer-resize-handle-size': `${RESIZE_HIT_WIDTH}px`,
      }) as CSSProperties,
    [visibleDrawerWidth],
  );
  const activeToolTitle = resolveChooserTitle(activeTool, selectedEntity);

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || typeof window === 'undefined') return;
    event.preventDefault();
    resizeCleanupRef.current?.();
    const pointerId = event.pointerId;
    const updateWidth = (clientX: number) => {
      onWidthChange?.(clampDrawerWidth(window.innerWidth - clientX));
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      if (resizeCleanupRef.current === cleanup) resizeCleanupRef.current = null;
    };
    const handlePointerMove = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      updateWidth(pointerEvent.clientX);
    };
    const handlePointerEnd = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      cleanup();
    };
    resizeCleanupRef.current = cleanup;
    updateWidth(event.clientX);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
  };

  const handlePeekPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !onPeekChange || typeof window === 'undefined') return;
    event.preventDefault();
    peekCleanupRef.current?.();
    onPeekChange(true);
    const cleanup = () => {
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('blur', handleWindowBlur);
      if (peekCleanupRef.current === cleanup) peekCleanupRef.current = null;
      onPeekChange(false);
    };
    const handlePointerEnd = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== event.pointerId) return;
      cleanup();
    };
    const handleWindowBlur = () => cleanup();
    peekCleanupRef.current = cleanup;
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('blur', handleWindowBlur);
  };

  const handleOpenExistingBundle = (entity: OrderEntity, bundle: OrderBundle) => {
    if (encounterGuard.status !== 'ok') return;
    onOrderRequest?.(entity, {
      requestId: buildChooserRequestId('edit'),
      kind: 'edit',
      bundle,
    });
  };

  const handleApplyRecommendation = (entity: OrderEntity, candidate: OrderRecommendationCandidate) => {
    if (encounterGuard.status !== 'ok') return;
    onOrderRequest?.(entity, {
      requestId: buildChooserRequestId('recommendation'),
      kind: 'recommendation',
      candidate,
    });
  };

  const handleApplyInputSet = (entity: OrderEntity, item: OrcaOrderInputSetSummary) => {
    if (encounterGuard.status !== 'ok') return;
    const groupKey = resolveOrderGroupKeyByEntity(entity);
    if (!groupKey) return;
    onOrderRequest?.(entity, {
      requestId: buildChooserRequestId(groupKey === 'prescription' ? 'input-set' : 'orca-set'),
      kind: groupKey === 'prescription' ? 'input-set' : 'orca-set',
      candidate: item,
    });
  };

  const handleCreateNew = () => {
    if (!selectedEntity || encounterGuard.status !== 'ok') return;
    onOrderRequest?.(selectedEntity, {
      requestId: buildChooserRequestId('new'),
      kind: 'new',
    });
  };

  const renderEmptyState = (message: string) => <p className="order-dock__empty">{message}</p>;

  const drawerNode = (
    <aside
      ref={drawerRef}
      className="soap-note__right-drawer"
      data-open={open ? 'true' : 'false'}
      data-tool={activeTool}
      data-mode={mode}
      data-minimized={minimized ? 'true' : 'false'}
      data-order-layout="stack"
      data-chooser-state={orderChooserState.status}
      aria-hidden={!open}
      aria-label="右ユーティリティドロワー"
      style={drawerInlineStyle}
    >
      <button
        type="button"
        className="soap-note__right-drawer-restore-handle"
        onClick={() => onMinimizedChange?.(false)}
        aria-label="右ドロワーを復帰"
        title="右ドロワーを復帰"
      >
        <span className="soap-note__right-drawer-restore-icon" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="soap-note__right-drawer-resize-handle"
        onPointerDown={handleResizePointerDown}
        aria-label="右ドロワー幅を調整"
      />
      {!minimized ? (
        <>
          <header className="soap-note__right-drawer-header">
            <strong>{activeToolTitle}</strong>
            <div className="soap-note__right-drawer-header-controls">
              <button
                type="button"
                className="soap-note__right-drawer-header-control order-dock__bundle-action"
                onClick={() => onMinimizedChange?.(!minimized)}
                aria-label={minimized ? '右ドロワーを展開' : '右ドロワーを最小化'}
              >
                {minimized ? '展開' : '最小化'}
              </button>
              <button
                type="button"
                className="soap-note__right-drawer-peek-button order-dock__bundle-action"
                onPointerDown={handlePeekPointerDown}
                aria-label="押している間だけ一時的に隠す"
              >
                一時隠す
              </button>
              <button
                type="button"
                className="soap-note__right-drawer-header-control order-dock__bundle-action"
                onClick={onClose}
                aria-label="右ドロワーを閉じる"
              >
                閉じる
              </button>
            </div>
          </header>

          <div className="soap-note__right-drawer-tool-tabs soap-note__right-drawer-category-tabs" role="tablist" aria-label="右ユーティリティカテゴリ">
            {RIGHT_UTILITY_TOOLS.map((item) => {
              const isActive = item.tool === activeTool;
              return (
                <button
                  key={`drawer-tool-${item.tool}`}
                  type="button"
                  className="soap-note__right-drawer-category-tab order-dock__subtype-tab"
                  role="tab"
                  data-drawer-category={item.tool}
                  data-active={isActive ? 'true' : 'false'}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  aria-label={`${resolveRightUtilityToolLabel(item.tool)}候補タブへ切替`}
                  onClick={() => onToolSelect?.(item.tool)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="soap-note__right-drawer-content">
            <section className="soap-note__right-drawer-panel soap-note__right-drawer-panel--order" data-active={open ? 'true' : 'false'} aria-hidden={open ? 'false' : 'true'}>
              <div className="soap-note__right-drawer-switch soap-note__right-drawer-order-layout">
                {groupSpec && selectedEntity && groupSpec.entities.length > 1 ? (
                  <div className="order-dock__subtype-tabs" role="tablist" aria-label={`${groupSpec.label}サブカテゴリ`}>
                    {groupSpec.entities.map((entity) => {
                      const isActive = selectedEntity === entity;
                      return (
                        <button
                          key={`drawer-sub-${entity}`}
                          type="button"
                          className="order-dock__subtype-tab"
                          role="tab"
                          data-drawer-subtype-entity={entity}
                          data-active={isActive ? 'true' : 'false'}
                          aria-selected={isActive}
                          tabIndex={isActive ? 0 : -1}
                          onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                            const next = resolveNextTabEntity(event.key, groupSpec.entities, selectedEntity);
                            if (!next) return;
                            event.preventDefault();
                            onOrderEntitySwitch?.(next);
                            const tabList = event.currentTarget.closest('[role="tablist"]');
                            if (tabList instanceof HTMLDivElement) focusDrawerSubtypeTab(tabList, next);
                          }}
                          onClick={() => onOrderEntitySwitch?.(entity)}
                        >
                          {resolveOrderEntityLabel(entity)}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {encounterGuard.status !== 'ok' ? (
                  <section
                    className="soap-note__right-drawer-order-preview soap-note__right-drawer-order-preview--blocked"
                    aria-label="オーダー候補の開始条件"
                  >
                    <div className="soap-note__right-drawer-order-preview-header">
                      <strong>オーダー候補を開始できません</strong>
                    </div>
                    {renderEmptyState(encounterGuard.message ?? '患者または来院文脈を確認してください。')}
                  </section>
                ) : null}

                {encounterGuard.status === 'ok' ? (
                  <section className="soap-note__right-drawer-source-overview" aria-label="候補ソースの概要">
                    <div className="soap-note__right-drawer-order-preview-header">
                      <strong>候補ソース</strong>
                    </div>
                    <ul className="soap-note__right-drawer-order-preview-item-list">
                      <li>既存オーダー: 保存済み候補を編集またはコピーします。</li>
                      <li>患者候補: この患者の過去使用から候補化します。</li>
                      <li>施設頻用: 施設全体の頻用から候補化します。</li>
                      <li>ORCA診療セット: 入力セットをRPまたはカテゴリ別候補として展開します。ORCA送信ではありません。</li>
                      <li>検索して追加: 候補が無い場合に新規入力へ進みます。</li>
                    </ul>
                  </section>
                ) : null}

                {encounterGuard.status === 'ok' ? resolveOrderChooserSources(activeTool).map((source) => {
                  if (!selectedEntity || !groupSpec) return null;
                  if (source.key === 'existing') {
                    return (
                      <section key={source.key} className="soap-note__right-drawer-order-preview" aria-label={source.label}>
                        <div className="soap-note__right-drawer-order-preview-header">
                          <div>
                            <p className="soap-note__summary-meta">{resolveSourceRoleLabel(source.key)}</p>
                            <strong>{source.label}</strong>
                          </div>
                          <button type="button" className="order-dock__bundle-action" onClick={handleCreateNew}>
                            {resolveOrderChooserCtaLabel('create')}
                          </button>
                        </div>
                        {source.note ? <p className="order-dock__empty">{source.note}</p> : null}
                        {resolvedPanelLoading ? renderEmptyState('候補を取得しています...') : null}
                        {resolvedPanelError ? renderEmptyState(resolveUserSafeFetchFailure('候補', resolvedPanelError)) : null}
                        {!resolvedPanelLoading && !resolvedPanelError && existingOrderRows.length === 0 ? renderEmptyState('このカテゴリの候補はありません。') : null}
                        {!resolvedPanelLoading && !resolvedPanelError && existingOrderRows.length > 0 ? (
                          <div className="soap-note__right-drawer-order-preview-list order-dock__bundle-list" role="list">
                            {existingOrderRows.map((row) => {
                              const isActive = Boolean(
                                activeEditBundle &&
                                  activeEditBundle.documentId === row.bundle.documentId &&
                                  activeEditBundle.moduleId === row.bundle.moduleId,
                              );
                              return (
                                <article
                                  key={`drawer-existing-${row.id}`}
                                  role="listitem"
                                  className="soap-note__right-drawer-order-preview-item"
                                  data-active={isActive ? 'true' : 'false'}
                                >
                                  <header className="soap-note__right-drawer-order-preview-item-header">
                                    <div>
                                      <p className="soap-note__summary-meta">{row.operatorLine}</p>
                                      <strong>{row.bundleLabel}</strong>
                                    </div>
                                    <button
                                      type="button"
                                      className="order-dock__bundle-action"
                                      onClick={() => handleOpenExistingBundle(row.entity, row.bundle)}
                                      aria-label={`${row.bundleLabel}を編集面で開く`}
                                    >
                                      {resolveOrderChooserCtaLabel('edit')}
                                    </button>
                                  </header>
                                  <div className="soap-note__right-drawer-order-preview-item-body">
                                    {row.title ? <p className="soap-note__right-drawer-order-preview-item-title">{row.title}</p> : null}
                                    {row.items.length > 0 ? (
                                      <ul className="soap-note__right-drawer-order-preview-item-list" aria-label="既存セット内容">
                                        {row.items.slice(0, MAX_PREVIEW_ITEMS).map((item, index) => (
                                          <li key={`${row.id}-existing-item-${index}`} className="soap-note__right-drawer-order-preview-item-line">
                                            <span className="soap-note__right-drawer-order-preview-item-primary">{item.primary}</span>
                                            {item.genericNote ? (
                                              <span className="soap-note__right-drawer-order-preview-item-note">{item.genericNote}</span>
                                            ) : null}
                                            {item.secondary.map((detail, detailIndex) => (
                                              <span key={`${row.id}-existing-item-${index}-detail-${detailIndex}`} className="soap-note__right-drawer-order-preview-item-secondary">
                                                {detail}
                                              </span>
                                            ))}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : null}
                                    {row.items.length > MAX_PREVIEW_ITEMS ? (
                                      <p className="soap-note__right-drawer-order-preview-item-more">他{row.items.length - MAX_PREVIEW_ITEMS}件</p>
                                    ) : null}
                                    {row.detailLines.map((detail, index) => (
                                      <p key={`${row.id}-detail-${index}`} className="soap-note__right-drawer-order-preview-item-detail">
                                        {detail}
                                      </p>
                                    ))}
                                    {row.warnings.map((warning, index) => (
                                      <p key={`${row.id}-warning-${index}`} className="soap-note__right-drawer-order-preview-item-warning">
                                        {warning}
                                      </p>
                                    ))}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        ) : null}
                      </section>
                    );
                  }

                  if (source.key === 'patient' || source.key === 'facility') {
                    const candidates = source.key === 'patient' ? recommendationCandidates.patient : recommendationCandidates.facility;
                    return (
                      <section key={source.key} className="soap-note__right-drawer-order-preview" aria-label={source.label}>
                        <div className="soap-note__right-drawer-order-preview-header">
                          <div>
                            <p className="soap-note__summary-meta">{resolveSourceRoleLabel(source.key)}</p>
                            <strong>{source.label}</strong>
                          </div>
                        </div>
                        {source.note ? <p className="order-dock__empty">{source.note}</p> : null}
                        {recommendationQuery.isFetching ? renderEmptyState('候補を取得しています...') : null}
                        {recommendationQuery.data && !recommendationQuery.data.ok
                          ? renderEmptyState(source.key === 'patient' ? '患者候補を取得できませんでした。時間をおいて再試行してください。' : '施設頻用候補を取得できませんでした。時間をおいて再試行してください。')
                          : null}
                        {!recommendationQuery.isFetching && (!recommendationQuery.data || recommendationQuery.data.ok) && candidates.length === 0
                          ? renderEmptyState('このカテゴリの候補はありません。')
                          : null}
                        {candidates.length > 0 ? (
                          <div className="soap-note__right-drawer-order-preview-list" role="list">
                            {candidates.map((candidate) => (
                              <article key={`${source.key}-${candidate.key}`} role="listitem" className="soap-note__right-drawer-order-preview-item">
                                <header className="soap-note__right-drawer-order-preview-item-header">
                                  <div>
                                    <p className="soap-note__summary-meta">回数: {candidate.count} / 最終: {candidate.lastUsedAt}</p>
                                    <strong>{candidate.template.bundleName || '名称未設定'}</strong>
                                  </div>
                                  <button
                                    type="button"
                                    className="order-dock__bundle-action"
                                    onClick={() => handleApplyRecommendation(selectedEntity, candidate)}
                                  >
                                    {resolveOrderChooserCtaLabel('apply')}
                                  </button>
                                </header>
                                <div className="soap-note__right-drawer-order-preview-item-body">
                                  {candidate.template.admin ? (
                                    <p className="soap-note__right-drawer-order-preview-item-detail">用法: {candidate.template.admin}</p>
                                  ) : null}
                                  {candidate.template.bundleNumber ? (
                                    <p className="soap-note__right-drawer-order-preview-item-detail">回数/日数: {candidate.template.bundleNumber}</p>
                                  ) : null}
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    );
                  }

                  if (source.key === 'orca-input-set' || source.key === 'orca-set') {
                    const isSearching = inputSetQuery.isFetching;
                    return (
                      <section key={source.key} className="soap-note__right-drawer-order-preview" aria-label={source.label}>
                        <div className="soap-note__right-drawer-order-preview-header">
                          <div>
                            <p className="soap-note__summary-meta">{resolveSourceRoleLabel(source.key)}</p>
                            <strong>{source.label}</strong>
                          </div>
                        </div>
                        {source.note ? <p className="order-dock__empty">{source.note}</p> : null}
                        <div className="charts-side-panel__field">
                          <label htmlFor="right-drawer-orca-set-keyword">ORCA候補キーワード</label>
                          <input
                            id="right-drawer-orca-set-keyword"
                            value={inputSetKeyword}
                            onChange={(event) => setInputSetKeyword(event.target.value)}
                          />
                          <p className="charts-side-panel__help">
                            {source.key === 'orca-input-set' ? '入力セット名またはコードで検索します。' : '診療セット名またはコードで検索します。'}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="order-dock__bundle-action"
                          onClick={() => setSubmittedInputSetKeyword(inputSetKeyword.trim())}
                          aria-describedby={!inputSetKeyword.trim() ? 'right-drawer-orca-set-search-reason' : undefined}
                          disabled={!inputSetKeyword.trim() || isSearching}
                        >
                          {isSearching ? '検索中…' : '検索'}
                        </button>
                        {!inputSetKeyword.trim() ? (
                          <p id="right-drawer-orca-set-search-reason" className="order-dock__empty">
                            ORCA候補検索はキーワード入力後に実行できます。
                          </p>
                        ) : null}
                        <p className="order-dock__empty">候補を反映しても、この操作だけでは処方確定・ORCA送信・会計済みにはなりません。</p>
                        {submittedInputSetKeyword.trim() && inputSetQuery.data && !inputSetQuery.data.ok
                          ? renderEmptyState('ORCA候補を取得できませんでした。通信状態またはORCA接続設定を確認してください。')
                          : null}
                        {submittedInputSetKeyword.trim() && !isSearching && inputSetQuery.data?.ok && inputSetItems.length === 0
                          ? renderEmptyState('このカテゴリの候補はありません。')
                          : null}
                        {inputSetItems.length > 0 ? (
                          <div className="soap-note__right-drawer-order-preview-list" role="list">
                            {inputSetItems.map((item) => (
                              <article key={`${source.key}-${item.setCode ?? item.name}`} role="listitem" className="soap-note__right-drawer-order-preview-item">
                                <header className="soap-note__right-drawer-order-preview-item-header">
                                  <div>
                                    <p className="soap-note__summary-meta">{item.setCode ?? 'setCode不明'}</p>
                                    <strong>{item.name ?? '名称未設定'}</strong>
                                  </div>
                                  <button
                                    type="button"
                                    className="order-dock__bundle-action"
                                    onClick={() => handleApplyInputSet(selectedEntity, item)}
                                  >
                                    {resolveOrderChooserCtaLabel('apply')}
                                  </button>
                                </header>
                                <div className="soap-note__right-drawer-order-preview-item-body">
                                  {item.itemCount ? (
                                    <p className="soap-note__right-drawer-order-preview-item-detail">項目数: {item.itemCount}</p>
                                  ) : null}
                                  {item.classCode ? (
                                    <p className="soap-note__right-drawer-order-preview-item-detail">classCode: {item.classCode}</p>
                                  ) : null}
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    );
                  }

                  return (
                    <section key={source.key} className="soap-note__right-drawer-order-preview" aria-label={source.label}>
                      <div className="soap-note__right-drawer-order-preview-header">
                        <div>
                          <p className="soap-note__summary-meta">{resolveSourceRoleLabel(source.key)}</p>
                          <strong>{source.label}</strong>
                        </div>
                      </div>
                      <p className="order-dock__empty">新規入力からこのカテゴリの編集面を開きます。</p>
                      <button type="button" className="order-dock__bundle-action" onClick={handleCreateNew} disabled={!selectedEntity}>
                        {resolveOrderChooserCtaLabel('create')}
                      </button>
                    </section>
                  );
                }) : null}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </aside>
  );

  if (typeof document === 'undefined') return drawerNode;
  const portalHost = document.getElementById('charts-portal-root') ?? document.body;
  return createPortal(drawerNode, portalHost);
}
