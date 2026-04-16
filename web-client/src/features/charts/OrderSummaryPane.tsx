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
import { resolveUserSafeFetchFailure } from './userSafeErrorCopy';

type OrderSummaryPaneProps = {
  orderBundles?: OrderBundle[];
  prescriptionBundles?: OrderBundle[];
  orderBundlesLoading?: boolean;
  orderBundlesError?: string;
  onBundleSelect?: (payload: { group: OrderGroupKey; entity: OrderEntity; bundle: OrderBundle }) => void;
  onDocumentSelect?: () => void;
  activeOrderPanel?: ReactNode;
  activeOrderTitle?: string;
  onActiveOrderClose?: () => void;
  documentPanel?: ReactNode;
  documentPanelVisible?: boolean;
  onDocumentClose?: () => void;
  orcaPanel?: ReactNode;
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
  onDocumentSelect,
  activeOrderPanel,
  activeOrderTitle,
  onActiveOrderClose,
  documentPanel,
  documentPanelVisible = false,
  onDocumentClose,
  orcaPanel,
}: OrderSummaryPaneProps) {
  const groupedBundles = useMemo<OrderDetailDisplayCategoryViewModel[]>(
    () => buildOrderDetailDisplayCategories({ orderBundles, prescriptionBundles }),
    [orderBundles, prescriptionBundles],
  );

  const contentDisabled = orderBundlesLoading || Boolean(orderBundlesError);
  const hasAnyOrderBundle = groupedBundles.some((group) => group.key !== 'document' && group.rows.length > 0);
  const visibleCategories = groupedBundles.filter((category) => category.key === 'document' || category.rows.length > 0);

  return (
    <aside
      id="charts-order-pane"
      className="soap-note__paper soap-note__center-panel-only"
      aria-label="オーダー概要"
      tabIndex={-1}
      data-focus-anchor="true"
      data-loading={orderBundlesLoading ? '1' : '0'}
      data-error={orderBundlesError ? '1' : '0'}
    >
      <header className="soap-note__paper-header">
        <div>
          <strong>オーダー概要</strong>
          <span className="soap-note__paper-meta">カテゴリ別詳細カード</span>
        </div>
      </header>

      {orderBundlesLoading ? <p className="soap-note__paper-empty">オーダー情報を取得しています...</p> : null}
      {orderBundlesError ? <p className="soap-note__paper-empty">{resolveUserSafeFetchFailure('オーダー情報', orderBundlesError)}</p> : null}
      {!contentDisabled && !hasAnyOrderBundle ? (
        <p className="soap-note__paper-empty">当日のオーダーはありません。</p>
      ) : null}

      {!contentDisabled ? (
        <div className="soap-note__order-groups">
          {visibleCategories.map((category) => {
            return (
              <section key={`summary-group-${category.key}`} className="soap-note__order-group" data-group={category.key}>
                <header className="soap-note__order-group-header">
                  <strong>{category.label}</strong>
                  <span className="soap-note__order-group-meta">
                    {category.key === 'document' ? '編集' : `${category.rows.length}件`}
                  </span>
                </header>

                {category.key === 'document' ? (
                  <button
                    type="button"
                    className="order-dock__search-result soap-note__summary-card"
                    onClick={() => onDocumentSelect?.()}
                    aria-label="文書を編集"
                    title="文書を編集"
                  >
                    <p className="soap-note__summary-meta">入力者不明 医師 日時不明</p>
                    <div className="soap-note__summary-body">
                      <p className="soap-note__summary-detail">文書名: 文書情報なし</p>
                      <p className="soap-note__summary-detail">本文情報なし</p>
                    </div>
                  </button>
                ) : (
                  <ul className="soap-note__order-list">
                    {category.rows.map((row) => (
                      <li key={`summary-bundle-${row.id}`} className="soap-note__order-item">
                        <button
                          type="button"
                          className="order-dock__search-result soap-note__summary-card"
                          onClick={() => onBundleSelect?.({ group: row.group, entity: row.entity, bundle: row.bundle })}
                          aria-label={`${row.bundleLabel}を編集`}
                          title={`${category.label}を編集`}
                        >
                          <p className="soap-note__summary-meta">{row.operatorLine}</p>
                          {renderCardBody(row)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : null}

      {activeOrderPanel ? (
        <section className="soap-note__order-group" data-group="active-order-editor">
          <header className="soap-note__order-group-header">
            <strong>{activeOrderTitle ?? 'オーダー編集'}</strong>
            {onActiveOrderClose ? (
              <button type="button" className="order-dock__bundle-action" onClick={onActiveOrderClose}>
                閉じる
              </button>
            ) : null}
          </header>
          {activeOrderPanel}
        </section>
      ) : null}

      {documentPanelVisible && documentPanel ? (
        <section className="soap-note__order-group" data-group="active-document-editor">
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

      {orcaPanel ? (
        <section className="soap-note__order-group" data-group="orca-support">
          <header className="soap-note__order-group-header">
            <strong>ORCA確認</strong>
            <span className="soap-note__order-group-meta">runtime support</span>
          </header>
          {orcaPanel}
        </section>
      ) : null}
    </aside>
  );
}
