import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CriticalOperationConfirmDialog } from '../CriticalOperationConfirmDialog';

describe('CriticalOperationConfirmDialog', () => {
  it('重大操作名、患者識別情報、対象サマリを再掲してから confirm する', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <CriticalOperationConfirmDialog
        open
        title="診療行為ORCA送信の確認"
        description="送信前に患者と対象を確認します。"
        operationLabel="診療行為ORCA送信"
        patientName="山田太郎"
        patientFields={[
          { label: '患者ID', value: 'P-001' },
          { label: '診療日', value: '2026-05-10' },
          { label: '保険組合せ', value: '0001' },
        ]}
        summaryTitle="送信対象サマリ"
        summaryFields={[
          { label: '病名', value: '3件' },
          { label: 'オーダー', value: '5件' },
        ]}
        confirmLabel="ORCAへ送信する"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole('alertdialog', { name: '診療行為ORCA送信の確認' });
    expect(within(dialog).getByText('実行操作:')).toBeInTheDocument();
    expect(within(dialog).getByText('診療行為ORCA送信')).toBeInTheDocument();
    expect(within(dialog).getByText('山田太郎')).toBeInTheDocument();
    expect(within(dialog).getByText('P-001')).toBeInTheDocument();
    expect(within(dialog).getByText('2026-05-10')).toBeInTheDocument();
    expect(within(dialog).getByText('0001')).toBeInTheDocument();
    expect(within(dialog).getByText('3件')).toBeInTheDocument();
    expect(within(dialog).getByText('5件')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'ORCAへ送信する' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('backdrop click does not cancel critical operations', () => {
    const onCancel = vi.fn();

    render(
      <CriticalOperationConfirmDialog
        open
        title="受付取消の確認"
        description="取消前に患者を確認します。"
        operationLabel="受付取消"
        patientName="山田太郎"
        patientFields={[{ label: '患者ID', value: 'P-001' }]}
        summaryTitle="取消対象"
        summaryFields={[{ label: '状態', value: '受付中' }]}
        confirmLabel="受付を取消する"
        tone="danger"
        testId="critical-backdrop"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    const backdrop = document.querySelector('[data-test-id="critical-backdrop"]');
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop as Element);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
