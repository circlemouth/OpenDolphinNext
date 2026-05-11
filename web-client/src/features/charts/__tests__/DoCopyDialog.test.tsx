import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DoCopyDialog, type DoCopyDialogState } from '../DoCopyDialog';

describe('DoCopyDialog overwrite behavior', () => {
  it('未選択時は転記元があるセクションのみ既定選択して適用する', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onUndo = vi.fn();
    const onClose = vi.fn();
    const state: DoCopyDialogState = {
      open: true,
      applied: false,
      selectedSections: [],
      sections: [
        {
          section: 'subjective',
          source: { authoredAt: '2026-02-26T09:00:00Z', authorRole: 'doctor', body: '転記元S' },
          target: { body: '転記先S' },
        },
        {
          section: 'objective',
          source: { authoredAt: '2026-02-26T09:00:00Z', authorRole: 'doctor', body: '' },
          target: { body: '転記先O' },
        },
      ],
    };

    render(<DoCopyDialog state={state} onApply={onApply} onUndo={onUndo} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '適用' }));

    expect(onApply).toHaveBeenCalledWith(['subjective']);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('Do入力の上書き対象はチェックしたセクションに限定できる', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onUndo = vi.fn();
    const onClose = vi.fn();
    const state: DoCopyDialogState = {
      open: true,
      applied: false,
      selectedSections: ['subjective', 'objective'],
      sections: [
        {
          section: 'subjective',
          source: { authoredAt: '2026-02-26T09:00:00Z', authorRole: 'doctor', body: '転記元S' },
          target: { body: '転記先S' },
        },
        {
          section: 'objective',
          source: { authoredAt: '2026-02-26T09:00:00Z', authorRole: 'doctor', body: '転記元O' },
          target: { body: '転記先O' },
        },
      ],
    };

    render(<DoCopyDialog state={state} onApply={onApply} onUndo={onUndo} onClose={onClose} />);

    await user.click(screen.getByRole('checkbox', { name: 'Objective' }));
    await user.click(screen.getByRole('button', { name: '適用' }));

    expect(onApply).toHaveBeenCalledWith(['subjective']);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('Do対象未選択時の適用は native disabled を維持し近傍理由を示す', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onUndo = vi.fn();
    const onClose = vi.fn();
    const state: DoCopyDialogState = {
      open: true,
      applied: false,
      selectedSections: ['subjective'],
      sections: [
        {
          section: 'subjective',
          source: { authoredAt: '2026-02-26T09:00:00Z', authorRole: 'doctor', body: '転記元S' },
          target: { body: '転記先S' },
        },
      ],
    };

    render(<DoCopyDialog state={state} onApply={onApply} onUndo={onUndo} onClose={onClose} />);

    await user.click(screen.getByRole('checkbox', { name: 'Subjective' }));

    expect(screen.getByText('適用はブロックされています: Do対象セクションを1つ以上選択してください。')).toBeInTheDocument();
    const applyButton = screen.getByRole('button', { name: '適用' });
    expect(applyButton).toBeDisabled();
    expect(applyButton).toHaveAttribute('aria-describedby', 'charts-do-copy-apply-block-reason');
    expect(onApply).not.toHaveBeenCalled();
  });
});
