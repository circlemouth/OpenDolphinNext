import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

  it('ヘッダーの候補・セット/スタンプ・文書アクションを同じ当日オーダー欄から起動する', async () => {
    const user = userEvent.setup();
    const onCandidateOpen = vi.fn();
    const onUtilityActionSelect = vi.fn();

    render(
      <OrderSummaryPane
        orderBundles={[]}
        prescriptionBundles={[]}
        onCandidateOpen={onCandidateOpen}
        utilityActions={[
          {
            id: 'order-set',
            label: 'セット/スタンプ',
            shortLabel: '★',
            shortcut: 'Ctrl+Shift+1',
            dirty: true,
            meta: '右欄編集中:処方（必須不足）',
            kind: 'stamp',
          },
          { id: 'document', label: '文書', shortLabel: '文', shortcut: 'Ctrl+Shift+2', meta: '添付2', kind: 'document' },
        ]}
        activeUtilityAction="document"
        onUtilityActionSelect={onUtilityActionSelect}
      />,
    );

    const pane = screen.getByLabelText('オーダー概要');
    const headerActions = pane.querySelector('.soap-note__paper-header-actions');
    expect(headerActions).not.toBeNull();
    const actions = within(headerActions as HTMLElement);

    await user.click(actions.getByRole('button', { name: '処方候補を探す' }));
    expect(onCandidateOpen).toHaveBeenCalledWith({ group: 'prescription', entity: 'medOrder', intent: 'search' });

    await user.click(actions.getByRole('button', { name: /セット\/スタンプ/ }));
    expect(onUtilityActionSelect).toHaveBeenCalledWith('order-set', expect.any(HTMLButtonElement));

    const documentButton = actions.getByRole('button', { name: /文書（添付2）/ });
    expect(documentButton).toHaveAttribute('data-active', 'true');
    await user.click(documentButton);
    expect(onUtilityActionSelect).toHaveBeenCalledWith('document', expect.any(HTMLButtonElement));
  });
});
