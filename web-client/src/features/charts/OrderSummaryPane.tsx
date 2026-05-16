import { type ReactNode, useMemo } from 'react';

import type { OrderBundle } from './orderBundleApi';
import {
  type OrderEntity,
  type OrderGroupKey,
} from './orderCategoryRegistry';
import {
  buildOrderDetailDisplayCategories,
  type OrderDetailDisplayCategoryViewModel,
  type OrderDetailDisplayViewModel,
} from './orderDetailDisplayViewModel';
import type { RightUtilityDockUtilityAction, RightUtilityDockUtilityItem } from './RightUtilityDock';
import { resolveUserSafeFetchFailure } from './userSafeErrorCopy';

type OrderSummaryPaneProps = {
  orderBundles?: OrderBundle[];
  prescriptionBundles?: OrderBundle[];
  orderBundlesLoading?: boolean;
  orderBundlesError?: string;
  onBundleSelect?: (payload: { group: OrderGroupKey; entity: OrderEntity; bundle: OrderBundle }) => void;
  onCategoryAdd?: (payload: { group: OrderGroupKey; entity: OrderEntity }) => void;
  onCategorySelect?: (payload: { group: OrderGroupKey; entity: OrderEntity; hasRows: boolean }) => void;
  onCandidateOpen?: (payload: { group: OrderGroupKey; entity: OrderEntity; intent: 'search' | 'apply' }) => void;
  onBundleDeleteRequest?: (payload: { group: OrderGroupKey; entity: OrderEntity; bundle: OrderBundle; label: string }) => void;
  activeOrderPanel?: ReactNode;
  activeOrderTitle?: string;
  activeOrderEntity?: OrderEntity | null;
  activeCategory?: OrderGroupKey | null;
  selectedCategory?: OrderGroupKey | null;
  emptyCategoryAddState?: Partial<Record<OrderGroupKey, { disabled?: boolean; reason?: string; pending?: boolean }>>;
  rightPaneMode?: 'summary' | 'edit';
  inlineEditorMode?: 'summary' | 'edit';
  onActiveOrderClose?: () => void;
  documentPanel?: ReactNode;
  documentPanelVisible?: boolean;
  onDocumentClose?: () => void;
  utilityActions?: RightUtilityDockUtilityItem[];
  activeUtilityAction?: RightUtilityDockUtilityAction | null;
  onUtilityActionSelect?: (action: RightUtilityDockUtilityAction, trigger: HTMLButtonElement) => void;
  orcaPanel?: ReactNode;
  notice?: { tone: 'success' | 'error'; message: string } | null;
};

const ORDER_CATEGORY_ADD_LABELS: Record<OrderGroupKey, string> = {
  prescription: '処方',
  injection: '注射',
  treatment: '処置',
  test: '検査',
  charge: '算定',
};

const isParallelEditLockReason = (reason?: string | null): boolean => {
  if (!reason) return false;
  return reason.includes('別タブ') || reason.includes('並行編集');
};

const renderCardBody = (row: OrderDetailDisplayViewModel) => {
  return (
    <div className="soap-note__summary-body">
      {row.title ? <p className="soap-note__summary-detail soap-note__summary-detail--heading">{row.title}</p> : null}
      {row.items.length > 0 ? (
        <ul className="soap-note__summary-list">
          {row.items.map((item, index) => (
            <li key={`${row.id}-item-${index}`} className="soap-note__summary-list-item">
              {item.genericNote ? <span className="soap-note__summary-item-sub">{item.genericNote}</span> : null}
              <span className="soap-note__summary-item-name">{item.primary}</span>
              {item.secondary.map((detail, detailIndex) => (
                <span key={`${row.id}-item-${index}-detail-${detailIndex}`} className="soap-note__summary-item-sub">
                  {detail}
                </span>
              ))}
            </li>
          ))}
        </ul>
      ) : null}
      {row.detailLines.map((detail, index) => (
        <p key={`${row.id}-detail-${index}`} className="soap-note__summary-detail">
          {detail}
        </p>
      ))}
      {row.warnings.map((warning, index) => (
        <p key={`${row.id}-warning-${index}`} className="soap-note__summary-detail">
          {warning}
        </p>
      ))}
    </div>
  );
};

export function OrderSummaryPane({
  orderBundles,
  prescriptionBundles,
  orderBundlesLoading = false,
  orderBundlesError,
  onBundleSelect,
  onCategoryAdd,
  onCategorySelect,
  onCandidateOpen,
  onBundleDeleteRequest,
  activeOrderPanel,
  activeOrderTitle,
  activeOrderEntity = null,
  activeCategory = null,
  selectedCategory = null,
  emptyCategoryAddState,
  rightPaneMode,
  inlineEditorMode,
  onActiveOrderClose,
  documentPanel,
  documentPanelVisible = false,
  onDocumentClose,
  utilityActions = [],
  activeUtilityAction = null,
  onUtilityActionSelect,
  orcaPanel,
  notice,
}: OrderSummaryPaneProps) {
  const groupedBundles = useMemo<OrderDetailDisplayCategoryViewModel[]>(
    () => buildOrderDetailDisplayCategories({ orderBundles, prescriptionBundles }),
    [orderBundles, prescriptionBundles],
  );

  const contentDisabled = orderBundlesLoading || Boolean(orderBundlesError);
  const visibleCategories = groupedBundles.filter((category) => category.key !== 'document');
  const resolvedRightPaneMode = rightPaneMode ?? (activeOrderPanel || documentPanelVisible ? 'edit' : 'summary');
  const firstNonEmptyCategory = visibleCategories.find((category) => category.rows.length > 0)?.groupKey ?? null;
  const resolvedSelectedCategory: OrderGroupKey = selectedCategory ?? activeCategory ?? firstNonEmptyCategory ?? 'prescription';
  const selectedCategoryModel =
    visibleCategories.find((category) => category.groupKey === resolvedSelectedCategory) ?? visibleCategories[0] ?? null;
  const selectedGroupKey: OrderGroupKey = selectedCategoryModel?.groupKey ?? resolvedSelectedCategory;
  const selectedAddState = emptyCategoryAddState?.[selectedGroupKey];
  const selectedAddReasonId = 'charts-order-add-block-reason';
  const globalAddBlockReason = visibleCategories
    .map((category) => (category.groupKey ? emptyCategoryAddState?.[category.groupKey]?.reason : undefined))
    .find((reason): reason is string => Boolean(reason));
  const visibleGlobalAddBlockReason = isParallelEditLockReason(globalAddBlockReason) ? undefined : globalAddBlockReason;
  const selectedAddReasonDescribedBy =
    selectedAddState?.reason && !isParallelEditLockReason(selectedAddState.reason) ? selectedAddReasonId : undefined;
  const activeEditorSelected = Boolean(activeOrderPanel && activeCategory === selectedGroupKey);
  const resolvedInlineEditorMode = inlineEditorMode ?? (activeEditorSelected ? 'edit' : 'summary');
  const disabledUtilityNotes = utilityActions.filter((item) => item.disabled && item.title);

  const triggerCategoryAdd = (category: OrderDetailDisplayCategoryViewModel | null) => {
    const groupKey = category?.groupKey;
    if (!groupKey || !category?.defaultEntity) return;
    const addState = emptyCategoryAddState?.[groupKey];
    if (addState?.disabled) return;
    onCategoryAdd?.({ group: groupKey, entity: category.defaultEntity });
  };

  const triggerCandidateOpen = (category: OrderDetailDisplayCategoryViewModel | null, intent: 'search' | 'apply') => {
    const groupKey = category?.groupKey;
    const entity = activeEditorSelected && activeOrderEntity ? activeOrderEntity : category?.defaultEntity;
    if (!groupKey || !entity) return;
    onCandidateOpen?.({ group: groupKey, entity, intent });
  };

  return (
    <aside
      id="charts-order-pane"
      className="soap-note__paper soap-note__order-workspace"
      aria-label="オーダー概要"
      tabIndex={-1}
      data-focus-anchor="true"
      data-loading={orderBundlesLoading ? '1' : '0'}
      data-error={orderBundlesError ? '1' : '0'}
      data-right-pane-mode={resolvedRightPaneMode}
      data-inline-editor-mode={resolvedInlineEditorMode}
    >
      <header className="soap-note__paper-header">
        <div>
          <strong>当日オーダー</strong>
        </div>
        {(!contentDisabled && selectedCategoryModel && onCandidateOpen) || utilityActions.length > 0 ? (
          <div className="soap-note__paper-header-actions">
            {!contentDisabled && selectedCategoryModel && onCandidateOpen ? (
              <button
                type="button"
                className="order-dock__bundle-action order-dock__bundle-action--secondary"
                aria-label={`${ORDER_CATEGORY_ADD_LABELS[selectedGroupKey]}候補を探す`}
                onClick={() => triggerCandidateOpen(selectedCategoryModel, 'search')}
              >
                候補を探す
              </button>
            ) : null}
            {utilityActions.map((item) => {
              const isActive = activeUtilityAction === item.id;
              const meta = item.meta ? `（${item.meta}）` : '';
              const controls = item.id === 'document' ? 'charts-order-document-panel' : 'charts-docked-panel';
              return (
                <button
                  key={`order-pane-utility-${item.id}`}
                  id={`charts-order-pane-action-${item.id}`}
                  type="button"
                  className="order-dock__bundle-action order-dock__bundle-action--secondary order-dock__bundle-action--utility"
                  data-utility-action={item.id}
                  data-utility-kind={item.kind}
                  data-active={isActive ? 'true' : 'false'}
                  aria-pressed={isActive}
                  aria-controls={controls}
                  aria-expanded={isActive}
                  aria-label={`${item.label}${meta}`}
                  title={item.disabled ? item.title : item.shortcut}
                  disabled={item.disabled}
                  onClick={(event) => onUtilityActionSelect?.(item.id, event.currentTarget)}
                >
                  <span>{item.label}</span>
                  {item.dirty ? <span className="order-dock__utility-dirty" aria-hidden="true">●</span> : null}
                  {item.meta ? <span className="order-dock__utility-meta">{item.meta}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {orderBundlesLoading ? <p className="soap-note__paper-empty">オーダー情報を取得しています...</p> : null}
      {orderBundlesError ? <p className="soap-note__paper-empty">{resolveUserSafeFetchFailure('オーダー情報', orderBundlesError)}</p> : null}
      {notice ? (
        <p className={`soap-note__paper-empty soap-note__paper-empty--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.message}
        </p>
      ) : null}
      {!contentDisabled && visibleGlobalAddBlockReason ? (
        <p id={selectedAddReasonId} className="soap-note__paper-empty soap-note__paper-empty--error" role="status">
          編集はブロックされています: {visibleGlobalAddBlockReason}
        </p>
      ) : null}
      {disabledUtilityNotes.length > 0 ? (
        <p className="soap-note__paper-empty soap-note__paper-empty--muted">
          {disabledUtilityNotes.map((item) => `${item.label}: ${item.title}`).join(' / ')}
        </p>
      ) : null}

      {!contentDisabled ? (
        <>
        <nav className="soap-note__order-category-strip" aria-label="オーダー分野">
          {visibleCategories.map((category) => {
            const groupKey = category.groupKey ?? (category.key as OrderGroupKey);
            const hasRows = category.rows.length > 0;
            const active = selectedGroupKey === groupKey;
            return (
              <button
                key={`summary-category-${category.key}`}
                type="button"
                className="soap-note__order-category-chip"
                data-active={active ? 'true' : 'false'}
                data-empty={hasRows ? 'false' : 'true'}
                aria-pressed={active}
                onClick={() => {
                  if (!category.defaultEntity) return;
                  onCategorySelect?.({ group: groupKey, entity: category.defaultEntity, hasRows });
                }}
              >
                <span>{category.label}</span>
                <span className="soap-note__order-category-count">{category.rows.length}</span>
              </button>
            );
          })}
        </nav>
        {selectedCategoryModel ? (
          <section
            className="soap-note__order-group soap-note__order-selected"
            data-group={selectedCategoryModel.key}
            data-active="true"
            data-empty={selectedCategoryModel.rows.length > 0 ? 'false' : 'true'}
          >
            <header className="soap-note__order-group-header">
              <div>
                <strong>{selectedCategoryModel.label}</strong>
                <p className="soap-note__order-group-submeta">
                  {activeEditorSelected
                    ? '編集中'
                    : selectedCategoryModel.rows.length > 0
                      ? `${selectedCategoryModel.rows.length}件の当日オーダー`
                      : '未入力'}
                </p>
              </div>
              {!activeEditorSelected && selectedCategoryModel.rows.length > 0 ? (
                <div className="soap-note__order-group-actions">
                  <button
                    type="button"
                    className="order-dock__bundle-action order-dock__bundle-action--primary"
                    onClick={() => triggerCategoryAdd(selectedCategoryModel)}
                    aria-disabled={selectedAddState?.disabled ? 'true' : undefined}
                    aria-describedby={selectedAddReasonDescribedBy}
                    data-disabled-reason={selectedAddState?.disabled ? 'order_category_add_blocked' : undefined}
                    title={selectedAddState?.reason ?? `${ORDER_CATEGORY_ADD_LABELS[selectedGroupKey]}を追加`}
                  >
                    ＋{ORDER_CATEGORY_ADD_LABELS[selectedGroupKey]}
                  </button>
                  {onCandidateOpen ? (
                    <button
                      type="button"
                      className="order-dock__bundle-action order-dock__bundle-action--secondary"
                      aria-label={`${ORDER_CATEGORY_ADD_LABELS[selectedGroupKey]}候補を追加`}
                      onClick={() => triggerCandidateOpen(selectedCategoryModel, 'search')}
                    >
                      候補を追加
                    </button>
                  ) : null}
                </div>
              ) : null}
            </header>

            {activeEditorSelected ? (
              <section className="soap-note__inline-order-editor" data-group="active-order-editor">
                <header className="soap-note__order-group-header">
                  <strong>{activeOrderTitle ?? `${selectedCategoryModel.label}入力`}</strong>
                  <div className="soap-note__order-group-actions">
                    {onCandidateOpen ? (
                      <button
                        type="button"
                        className="order-dock__bundle-action order-dock__bundle-action--secondary"
                        aria-label={`${ORDER_CATEGORY_ADD_LABELS[selectedGroupKey]}候補から反映`}
                        onClick={() => triggerCandidateOpen(selectedCategoryModel, 'apply')}
                      >
                        候補から反映
                      </button>
                    ) : null}
                    {onActiveOrderClose ? (
                      <button type="button" className="order-dock__bundle-action" onClick={onActiveOrderClose}>
                        閉じる
                      </button>
                    ) : null}
                  </div>
                </header>
                {activeOrderPanel}
              </section>
            ) : selectedCategoryModel.rows.length > 0 ? (
              <ul className="soap-note__order-list">
                {selectedCategoryModel.rows.map((row) => (
                  <li key={`summary-bundle-${row.id}`} className="soap-note__order-item">
                    <button
                      type="button"
                      className="order-dock__search-result soap-note__summary-card"
                      onClick={() => onBundleSelect?.({ group: row.group, entity: row.entity, bundle: row.bundle })}
                      aria-label={`${row.bundleLabel}を編集`}
                      title={`${selectedCategoryModel.label}を編集`}
                    >
                      <p className="soap-note__summary-meta">{row.operatorLine}</p>
                      {renderCardBody(row)}
                    </button>
                    {onBundleDeleteRequest ? (
                      <div className="soap-note__summary-card-actions" role="group" aria-label={`${row.bundleLabel}操作`}>
                        <button
                          type="button"
                          className="order-dock__bundle-action order-dock__bundle-action--danger"
                          onClick={() =>
                            onBundleDeleteRequest({
                              group: row.group,
                              entity: row.entity,
                              bundle: row.bundle,
                              label: row.bundleLabel,
                            })
                          }
                          aria-label={`${row.bundleLabel}を削除`}
                        >
                          削除
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="soap-note__order-empty-inline">
                <div className="soap-note__order-empty-actions">
                  <button
                    type="button"
                    className="order-dock__bundle-action order-dock__bundle-action--primary"
                    onClick={() => triggerCategoryAdd(selectedCategoryModel)}
                    aria-disabled={selectedAddState?.disabled ? 'true' : undefined}
                    aria-describedby={selectedAddReasonDescribedBy}
                    data-disabled-reason={selectedAddState?.disabled ? 'order_category_add_blocked' : undefined}
                    title={selectedAddState?.reason ?? `${ORDER_CATEGORY_ADD_LABELS[selectedGroupKey]}を追加`}
                  >
                    ＋{ORDER_CATEGORY_ADD_LABELS[selectedGroupKey]}入力
                  </button>
                  {onCandidateOpen ? (
                    <button
                      type="button"
                      className="order-dock__bundle-action order-dock__bundle-action--secondary"
                      aria-label={`${ORDER_CATEGORY_ADD_LABELS[selectedGroupKey]}候補を探す`}
                      onClick={() => triggerCandidateOpen(selectedCategoryModel, 'search')}
                    >
                      候補を探す
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        ) : null}
        </>
      ) : null}

      {documentPanelVisible && documentPanel ? (
        <section id="charts-order-document-panel" className="soap-note__order-group" data-group="active-document-editor">
          <header className="soap-note__order-group-header">
            <strong>文書編集</strong>
            {onDocumentClose ? (
              <button type="button" className="order-dock__bundle-action" onClick={onDocumentClose}>
                閉じる
              </button>
            ) : null}
          </header>
          {documentPanel}
        </section>
      ) : null}

      {orcaPanel}
    </aside>
  );
}
