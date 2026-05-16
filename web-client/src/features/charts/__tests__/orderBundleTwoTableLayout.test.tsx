import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { OrderBundleEditPanel } from '../OrderBundleEditPanel';
import { fetchOrderMasterSearch } from '../orderMasterSearchApi';

vi.mock('../orderBundleApi', async () => ({
  fetchOrderBundles: vi.fn().mockResolvedValue({
    ok: true,
    bundles: [],
    patientId: 'P-1',
  }),
  mutateOrderBundles: vi.fn(),
}));

vi.mock('../orderMasterSearchApi', async () => ({
  fetchOrderMasterSearch: vi.fn(),
}));

vi.mock('../stampApi', async () => ({
  fetchUserProfile: vi.fn().mockResolvedValue({ ok: true, id: 1, userId: 'facility:doctor' }),
  fetchStampTree: vi.fn().mockResolvedValue({ ok: true, trees: [] }),
  fetchStampDetail: vi.fn(),
}));

const renderWithClient = (ui: ReactElement) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const baseProps = {
  patientId: 'P-1',
  entity: 'medOrder',
  title: '処方編集',
  bundleLabel: 'RP名',
  itemQuantityLabel: '用量',
  meta: {
    runId: 'RUN-ORDER',
    cacheHit: false,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server' as const,
  },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('OrderBundleEditPanel predictive options', () => {
  it('候補は入力欄の選択肢として表示される', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');

    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({
      ok: true,
      items: [
        {
          type: 'drug',
          code: 'A100',
          name: 'アムロジピン',
          unit: '錠',
        },
      ],
      totalCount: 1,
    });

    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    expect(screen.queryByLabelText('RP名')).not.toBeInTheDocument();

    const confirmed = screen.getByTestId('order-bundle-confirmed-table');
    expect(confirmed.closest('.charts-side-panel__meta-section--items')).not.toBeNull();
    expect(screen.getByLabelText('用法').closest('.charts-side-panel__meta-section--usage')).not.toBeNull();

    const itemNameInput = within(confirmed).getByPlaceholderText('薬剤名');
    await user.type(itemNameInput, 'アム');

    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'drug', keyword: 'アム' })),
    );
    await waitFor(() =>
      expect(document.querySelector('datalist[id$="-item-predictive-list"] option[value="アムロジピン"]')).not.toBeNull(),
    );
  });

  it('2テーブルレイアウトを維持し、処方タイミング切替で行サマリの日数/回数ラベルが更新される', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const confirmed = screen.getByTestId('order-bundle-confirmed-table');
    expect(confirmed.closest('.charts-side-panel__two-table-layout')).not.toBeNull();

    const itemNameInput = within(confirmed).getByPlaceholderText('薬剤名');
    await user.type(itemNameInput, 'テスト薬');

    const summary = await screen.findByTestId('order-bundle-item-summary-0');
    expect(summary).toHaveTextContent('日数: 1');

    await user.click(screen.getByRole('button', { name: '頓用' }));
    expect(summary).toHaveTextContent('回数: 1');
  });
});
