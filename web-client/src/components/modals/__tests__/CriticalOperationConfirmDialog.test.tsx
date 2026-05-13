import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
          { label: '患者番号', value: 'P-001' },
          { label: '氏名', value: '山田太郎' },
          { label: '生年月日', value: '1980-05-20' },
          { label: '性別', value: '男性' },
          { label: '年齢', value: '45歳' },
          { label: '受付日', value: '2026-05-10' },
          { label: '診療科', value: '内科' },
          { label: '担当医', value: '医師A' },
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
    expect(within(dialog).getAllByText('山田太郎').length).toBeGreaterThan(0);
    for (const label of ['患者番号', '氏名', '生年月日', '性別', '年齢', '受付日', '診療科', '担当医', '保険組合せ']) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    expect(within(dialog).getByText('P-001')).toBeInTheDocument();
    expect(within(dialog).getByText('1980-05-20')).toBeInTheDocument();
    expect(within(dialog).getByText('男性')).toBeInTheDocument();
    expect(within(dialog).getByText('45歳')).toBeInTheDocument();
    expect(within(dialog).getByText('2026-05-10')).toBeInTheDocument();
    expect(within(dialog).getByText('内科')).toBeInTheDocument();
    expect(within(dialog).getByText('医師A')).toBeInTheDocument();
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
        cancelDisabled
        confirmDisabled
        tone="danger"
        testId="critical-backdrop"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    const backdrop = document.querySelector('[data-test-id="critical-backdrop"]');
    expect(backdrop).not.toBeNull();
    const dialog = screen.getByRole('alertdialog', { name: '受付取消の確認' });
    expect(within(dialog).getByRole('button', { name: 'キャンセル' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: '受付を取消する' })).toBeDisabled();
    fireEvent.mouseDown(backdrop as Element);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('重大操作ボタンの優先度と44px以上の押下領域を共通契約として持つ', () => {
    render(
      <CriticalOperationConfirmDialog
        open
        title="診察終了の確認"
        description="終了前に患者と対象を確認します。"
        operationLabel="診察終了して会計へ送信"
        patientName="山田太郎"
        patientFields={[{ label: '患者ID', value: 'P-001' }]}
        summaryTitle="終了対象"
        summaryFields={[{ label: '診療日', value: '2026-05-11' }]}
        confirmLabel="診察終了して会計へ送信する"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('alertdialog', { name: '診察終了の確認' });
    const cancelButton = within(dialog).getByRole('button', { name: 'キャンセル' });
    const confirmButton = within(dialog).getByRole('button', { name: '診察終了して会計へ送信する' });

    expect(cancelButton).toHaveClass('critical-operation-confirm__button', 'critical-operation-confirm__button--secondary');
    expect(confirmButton).toHaveClass('critical-operation-confirm__button', 'critical-operation-confirm__button--primary');

    const globalCss = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
    expect(globalCss).toMatch(/\.critical-operation-confirm__button\s*\{[^}]*min-height:\s*44px/s);
    expect(globalCss).toMatch(/\.critical-operation-confirm__button\s*\{[^}]*min-width:\s*44px/s);
  });
});
