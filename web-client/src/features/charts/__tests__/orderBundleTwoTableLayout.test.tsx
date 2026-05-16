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
const injectionProps = {
  ...baseProps,
  entity: 'injectionOrder',
  title: '注射編集',
  bundleLabel: '注射名',
  itemQuantityLabel: '数量',
};
const testProps = {
  ...baseProps,
  entity: 'testOrder',
  title: '検査編集',
  bundleLabel: '検査名',
  itemQuantityLabel: '回数',
};
const chargeProps = {
  ...baseProps,
  entity: 'baseChargeOrder',
  title: '基本料編集',
  bundleLabel: '算定',
  itemQuantityLabel: '回数',
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

  it('点滴・注射はキリン型の密な列と local-only 速度欄を同一編集面に出す', () => {
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    renderWithClient(<OrderBundleEditPanel {...injectionProps} />);

    const grid = screen.getByTestId('order-bundle-injection-kirin-grid');
    expect(within(grid).getByText('薬剤・器材')).toBeInTheDocument();
    expect(within(grid).getByText('投与指示')).toBeInTheDocument();
    expect(within(grid).getAllByText('速度指定').length).toBeGreaterThan(0);
    expect(screen.getByText(/速度指定と点滴速度は院内ローカル保持です/)).toBeInTheDocument();
    expect(document.querySelector('[data-order-layout="compact-kirin"][data-order-entity="injectionOrder"]')).not.toBeNull();
    expect(document.querySelector('.charts-side-panel__item-row--injection-main')).not.toBeNull();
  });

  it('検査と算定は密なオーダー登録内容テーブルに寄せ、基本料区分セグメントを使える', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    renderWithClient(<OrderBundleEditPanel {...testProps} />);
    expect(screen.getByText('検査 / 入力値')).toBeInTheDocument();
    expect(document.querySelector('.charts-side-panel__item-row--test-main')).not.toBeNull();

    cleanup();

    renderWithClient(<OrderBundleEditPanel {...chargeProps} />);
    expect(screen.getByText('オーダー登録内容')).toBeInTheDocument();
    const baseChargeGroup = screen.getByRole('group', { name: '基本料区分' });
    await user.click(within(baseChargeGroup).getByRole('button', { name: '再診' }));
    expect(screen.getByDisplayValue('再診')).toBeInTheDocument();
    expect(document.querySelector('.charts-side-panel__item-row--charge-main')).not.toBeNull();
  });
});
