import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ConfirmDialog } from '../components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('確認/キャンセルを呼び出せる', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="配信確認"
        description="実行しますか"
        confirmLabel="実行"
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        <p>差分あり</p>
      </ConfirmDialog>,
    );

    expect(screen.getByRole('alertdialog', { name: '配信確認' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '実行' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('pending 中は close affordance を一貫して無効化する', () => {
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        pending
        title="配信確認"
        description="実行しますか"
        confirmLabel="実行"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      >
        <p>差分あり</p>
      </ConfirmDialog>,
    );

    expect(screen.queryByRole('button', { name: 'ダイアログを閉じる' })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(document.querySelector('[data-test-id="admin-confirm-dialog"]') as Element);

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '実行中…' })).toBeDisabled();
  });
});
