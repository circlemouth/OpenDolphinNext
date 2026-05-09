import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { ChartsActionBar } from '../ChartsActionBar';
import { ToneBanner } from '../../reception/components/ToneBanner';

afterEach(cleanup);

vi.mock('../../../routes/useAppNavigation', () => ({
  useAppNavigation: () => ({
    currentUrl: '/f/F-1/charts',
    currentScreen: 'charts',
    fromCandidate: undefined,
    returnToCandidate: undefined,
    safeReturnToCandidate: undefined,
    carryover: {},
    external: {},
    encounter: {},
    openReception: vi.fn(),
    openPatients: vi.fn(),
    openCharts: vi.fn(),
    openOrderSets: vi.fn(),
    openPrintOutpatient: vi.fn(),
    openPrintDocument: vi.fn(),
    openMobileImages: vi.fn(),
  }),
}));

const baseActionBarProps = {
  runId: 'RUN-A11Y',
  cacheHit: false,
  missingMaster: false,
  dataSourceTransition: 'snapshot' as const,
};

describe('Charts accessibility', () => {
  it('Chart action bar exposes disable理由と重大違反なし (missingMaster ブロック時)', async () => {
    const { container } = render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseActionBarProps}
          dataSourceTransition="server"
          missingMaster
          fallbackUsed={false}
          patientId="000123"
          showLegacyOrcaSend
        />
      </MemoryRouter>,
    );

    const sendButton = screen.getByRole('button', { name: 'ORCA 送信' });
    expect(sendButton).toHaveAttribute('aria-disabled', 'true');
    const notes = screen.getAllByRole('note');
    expect(notes.some((note) => note.textContent?.includes('ORCA 参照不足: 送信不可'))).toBe(true);

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('フォーカス移動順がボタン列の視覚順と一致し、重大違反なし (ロック解除状態)', async () => {
    const { container } = render(
      <MemoryRouter>
        <ChartsActionBar
          {...baseActionBarProps}
          missingMaster={false}
          fallbackUsed={false}
        />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    const tabbables = screen.getAllByRole('button').filter((button) => !button.hasAttribute('disabled'));

    await user.tab();
    expect(document.activeElement).toBe(tabbables[0]);
    await user.tab();
    expect(document.activeElement).toBe(tabbables[1]);

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('ToneBanner は aria-live/role を持ち重大違反なし', async () => {
    const { container } = render(
      <ToneBanner tone="warning" message="接続遅延が発生しています" patientId="000123" runId="RUN-A11Y" />,
    );

    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
