import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { RevisionHistoryDrawer } from '../revisions/RevisionHistoryDrawer';
import { fetchRevisionHistory } from '../revisions/revisionHistoryApi';
import { createKarteRevision } from '../revisions/revisionWriteApi';

vi.mock('../revisions/revisionHistoryApi', () => ({
  fetchRevisionHistory: vi.fn(),
}));

vi.mock('../revisions/revisionWriteApi', () => ({
  createKarteRevision: vi.fn(),
}));

const serverRevision = {
  revisionId: '12',
  parentRevisionId: '11',
  authoredAt: '2026-05-11T12:00:00.000Z',
  authorName: '医師A',
  operation: 'revise' as const,
  summary: 'SOAP本文の訂正',
};

describe('RevisionHistoryDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchRevisionHistory).mockResolvedValue({
      ok: true,
      source: 'server',
      revisions: [serverRevision],
    });
    vi.mocked(createKarteRevision).mockResolvedValue({
      ok: true,
      status: 200,
      endpoint: '/karte/revisions/revise',
      createdRevisionId: 13,
    });
  });

  it('診療録訂正は共通重大操作確認で患者とrevisionを再掲してから実行する', async () => {
    const user = userEvent.setup();

    render(
      <RevisionHistoryDrawer
        open
        onClose={vi.fn()}
        meta={{
          patientId: 'P-REV-1',
          visitDate: '2026-05-11',
          receptionId: 'R-100',
          appointmentId: 'A-200',
        }}
        soapHistory={[]}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'この版を編集（改訂版追加）' }));

    const dialog = await screen.findByRole('alertdialog', { name: '診療録訂正の確認' });
    expect(within(dialog).getByText('実行操作:')).toBeInTheDocument();
    expect(within(dialog).getByText('診療録訂正')).toBeInTheDocument();
    expect(within(dialog).getAllByText('P-REV-1').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('2026-05-11')).toBeInTheDocument();
    expect(within(dialog).getByText('R-100')).toBeInTheDocument();
    expect(within(dialog).getByText('A-200')).toBeInTheDocument();
    expect(within(dialog).getByText('12')).toBeInTheDocument();
    expect(within(dialog).getByText('選択版を基準に新規改訂または復元を実行します。')).toBeInTheDocument();
    expect(createKarteRevision).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: '改訂版を追加する' }));

    await waitFor(() =>
      expect(createKarteRevision).toHaveBeenCalledWith({
        operation: 'revise',
        revisionId: 12,
        patientId: 'P-REV-1',
        visitDate: '2026-05-11',
        baseRevisionIdOverride: undefined,
      }),
    );
  });
});
