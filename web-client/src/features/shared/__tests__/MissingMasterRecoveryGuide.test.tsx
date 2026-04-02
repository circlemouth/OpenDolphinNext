import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { MissingMasterRecoveryGuide } from '../MissingMasterRecoveryGuide';
import { AppToastProvider, type AppToastController } from '../../../libs/ui/appToast';

const copyTextToClipboard = vi.hoisted(() => vi.fn());

vi.mock('@emotion/react', () => ({
  Global: () => null,
  css: () => '',
}));

vi.mock('../../../libs/observability/runIdCopy', () => ({
  copyTextToClipboard,
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  copyTextToClipboard.mockReset();
});

const renderWithToast = (ui: ReactElement, enqueue: AppToastController['enqueue']) =>
  render(<AppToastProvider value={{ enqueue, dismiss: vi.fn() }}>{ui}</AppToastProvider>);

describe('MissingMasterRecoveryGuide', () => {
  it('復旧導線のボタンを表示し共有成功トーストを出す', async () => {
    const user = userEvent.setup();
    copyTextToClipboard.mockResolvedValueOnce(undefined);
    const enqueue: AppToastController['enqueue'] = vi.fn();
    const handleRefetch = vi.fn();
    const handleReception = vi.fn();

    renderWithToast(
      <MissingMasterRecoveryGuide
        runId="RUN-RECOVERY"
        traceId="TRACE-RECOVERY"
        onRefetch={handleRefetch}
        onOpenReception={handleReception}
      />,
      enqueue,
    );

    expect(screen.getByRole('button', { name: '再取得（再取得）' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '受付へ戻る（受付）' })).toBeEnabled();
    const shareButton = screen.getByRole('button', { name: '管理者共有（管理者共有）' });
    expect(shareButton).toBeEnabled();

    await user.click(shareButton);

    expect(copyTextToClipboard).toHaveBeenCalledWith('runId=RUN-RECOVERY / traceId=TRACE-RECOVERY');
    expect(enqueue).toHaveBeenCalledWith({
      tone: 'success',
      message: '管理者共有用IDをコピーしました',
      detail: 'runId=RUN-RECOVERY / traceId=TRACE-RECOVERY',
    });
  });

  it('共有失敗時はエラートーストを出す', async () => {
    const user = userEvent.setup();
    copyTextToClipboard.mockRejectedValueOnce(new Error('copy_failed'));
    const enqueue: AppToastController['enqueue'] = vi.fn();

    renderWithToast(
      <MissingMasterRecoveryGuide runId="RUN-RECOVERY" traceId="TRACE-RECOVERY" onRefetch={() => {}} onOpenReception={() => {}} />,
      enqueue,
    );

    const shareButton = screen.getByRole('button', { name: '管理者共有（管理者共有）' });
    await user.click(shareButton);

    expect(enqueue).toHaveBeenCalledWith({
      tone: 'error',
      message: '共有用IDのコピーに失敗しました',
      detail: 'クリップボード権限を確認してください。',
    });
  });

  it('必要な情報がない場合はボタンが無効になる', () => {
    const enqueue: AppToastController['enqueue'] = vi.fn();
    renderWithToast(<MissingMasterRecoveryGuide />, enqueue);

    expect(screen.getByRole('button', { name: '再取得（再取得）' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '受付へ戻る（受付）' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '管理者共有（管理者共有）' })).toBeDisabled();
  });
});
