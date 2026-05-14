import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { OrderSummaryPane } from '../OrderSummaryPane';

describe('OrderSummaryPane', () => {
  it('空カテゴリは大きなカードではなく件数付きカテゴリチップとして表示する', () => {
    render(<OrderSummaryPane orderBundles={[]} prescriptionBundles={[]} />);

    const pane = screen.getByLabelText('オーダー概要');

    expect(pane).not.toHaveTextContent('カテゴリ別詳細カード');
    expect(pane).not.toHaveTextContent('runtime support');
    expect(pane.querySelector('.soap-note__order-group[data-group="document"]')).toBeNull();
    expect(screen.getByRole('button', { name: '処方 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '点滴・注射 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '処置 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '検査 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '算定 0' })).toBeInTheDocument();
    expect(pane.querySelectorAll('.soap-note__order-group[data-empty="true"]').length).toBe(1);
    expect(screen.getByRole('button', { name: '＋処方入力' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '注射を追加' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '文書を編集' })).not.toBeInTheDocument();
    expect(screen.queryByText('ORCA確認')).not.toBeInTheDocument();
    expect(pane.querySelector('.soap-note__order-group-rail')).toBeNull();
    expect(pane.querySelector('.soap-note__right-dock-button')).toBeNull();
    expect(screen.queryByText('該当オーダーなし')).toBeNull();
    expect(screen.queryByText('追加しても処方確定・ORCA送信・会計済みにはなりません。')).not.toBeInTheDocument();
    expect(screen.getByText('追加は下書き入力であり、処方確定・ORCA送信・会計済みではありません。')).toBeInTheDocument();
  });

  it('取得失敗時は raw detail ではなく canonical copy を表示する', () => {
    render(<OrderSummaryPane orderBundles={[]} prescriptionBundles={[]} orderBundlesError="HTTP 500 (/api/local/order/bundles)" />);

    expect(screen.getByText('オーダー情報の取得に失敗しました。時間をおいて再試行してください。')).toBeInTheDocument();
    expect(screen.queryByText(/HTTP 500/)).not.toBeInTheDocument();
  });
});
