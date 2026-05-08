import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { OrderSummaryPane } from '../OrderSummaryPane';

describe('OrderSummaryPane', () => {
  it('空カテゴリは非表示で文書カテゴリのみ表示し、レールボタンを出さない', () => {
    render(<OrderSummaryPane orderBundles={[]} prescriptionBundles={[]} />);

    const pane = screen.getByLabelText('オーダー概要');

    expect(pane).not.toHaveTextContent('カテゴリ別詳細カード');
    expect(pane).not.toHaveTextContent('runtime support');
    expect(pane.querySelector('.soap-note__order-group[data-group="document"]')).not.toBeNull();
    expect(pane.querySelector('.soap-note__order-group[data-group="prescription"]')).toBeNull();
    expect(pane.querySelector('.soap-note__order-group[data-group="injection"]')).toBeNull();
    expect(pane.querySelector('.soap-note__order-group[data-group="treatment"]')).toBeNull();
    expect(pane.querySelector('.soap-note__order-group[data-group="test"]')).toBeNull();
    expect(pane.querySelector('.soap-note__order-group[data-group="charge"]')).toBeNull();

    expect(screen.getByRole('button', { name: '文書を編集' })).toBeInTheDocument();
    expect(screen.queryByText('ORCA確認')).not.toBeInTheDocument();
    expect(pane.querySelector('.soap-note__order-group-rail')).toBeNull();
    expect(pane.querySelector('.soap-note__right-dock-button')).toBeNull();
    expect(screen.queryByText('該当オーダーなし')).toBeNull();
  });

  it('取得失敗時は raw detail ではなく canonical copy を表示する', () => {
    render(<OrderSummaryPane orderBundles={[]} prescriptionBundles={[]} orderBundlesError="HTTP 500 (/api/local/order/bundles)" />);

    expect(screen.getByText('オーダー情報の取得に失敗しました。時間をおいて再試行してください。')).toBeInTheDocument();
    expect(screen.queryByText(/HTTP 500/)).not.toBeInTheDocument();
  });
});
