import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { OrderBundleEditPanel } from '../OrderBundleEditPanel';
import { fetchOrderBundles } from '../orderBundleApi';
import { fetchOrderMasterSearch } from '../orderMasterSearchApi';
import { fetchOrcaMedicationGet } from '../orcaMedicationGetApi';

vi.mock('../orderBundleApi', async () => {
  const actual = await vi.importActual<typeof import('../orderBundleApi')>('../orderBundleApi');
  return {
    ...actual,
    fetchOrderBundles: vi.fn().mockResolvedValue({
      ok: true,
      bundles: [],
      patientId: 'P-1',
    }),
    mutateOrderBundles: vi.fn(),
  };
});

vi.mock('../orderMasterSearchApi', async () => ({
  fetchOrderMasterSearch: vi.fn(),
}));

vi.mock('../orcaMedicationGetApi', async () => ({
  fetchOrcaMedicationGet: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    selections: [],
  }),
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

describe('OrderBundleEditPanel master search UI', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it('検索条件変更時に結果が更新される', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type, keyword }) => {
      if (type !== 'drug') {
        return { ok: true, items: [], totalCount: 0 };
      }
      if (keyword.includes('ベル')) {
        return {
          ok: true,
          items: [
            {
              type: 'drug',
              code: 'B200',
              name: 'ベルベリン',
              unit: '包',
            },
          ],
          totalCount: 1,
        };
      }
      return {
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
      };
    });
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const itemNameInput = screen.getByPlaceholderText('薬剤名');
    await user.type(itemNameInput, 'アム');

    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'drug', keyword: 'アム' })),
    );
    await waitFor(() =>
      expect(document.querySelector('datalist[id$="-item-predictive-list"] option[value="アムロジピン"]')).not.toBeNull(),
    );

    await user.clear(itemNameInput);
    await user.type(itemNameInput, 'ベル');

    await waitFor(() =>
      expect(document.querySelector('datalist[id$="-item-predictive-list"] option[value="ベルベリン"]')).not.toBeNull(),
    );
  });

  it('検索結果の行選択で項目が追加される', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type }) => {
      if (type !== 'drug') {
        return { ok: true, items: [], totalCount: 0 };
      }
      return {
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
      };
    });

    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const itemNameInput = screen.getByPlaceholderText('薬剤名');
    await user.type(itemNameInput, 'アム');
    await waitFor(() =>
      expect(document.querySelector('datalist[id$="-item-predictive-list"] option[value="アムロジピン"]')).not.toBeNull(),
    );
    await user.clear(itemNameInput);
    await user.type(itemNameInput, 'アムロジピン');
    await user.tab();

    const selectedItemNameInputs = screen.getAllByPlaceholderText('薬剤名') as HTMLInputElement[];
    expect(selectedItemNameInputs[0]?.value).toBe('アムロジピン');
    expect(selectedItemNameInputs[1]?.value).toBe('');

    const rowSummary = screen.getByTestId('order-bundle-item-summary-0');
    expect(rowSummary).toHaveTextContent('コード: A100');
    expect(rowSummary).toHaveTextContent('用量: 錠');
    expect(rowSummary).toHaveTextContent('用法: 未入力');
    expect(rowSummary).toHaveTextContent('日数: 1');
  });

  it('項目名入力のリアルタイム候補で主項目を補完できる', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type, keyword }) => {
      if (type === 'drug' && keyword.includes('アム')) {
        return {
          ok: true,
          items: [
            {
              type: 'drug',
              code: 'A100',
              name: 'アムロジピン',
              unit: '錠',
              note: '予測候補',
            },
          ],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });

    const user = userEvent.setup();
    const { container } = renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const itemNameInput = screen.getByPlaceholderText('薬剤名') as HTMLInputElement;
    await user.type(itemNameInput, 'アム');
    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'drug', keyword: 'アム' })),
    );

    await waitFor(() =>
      expect(container.querySelector('datalist[id$="-item-predictive-list"] option[value="アムロジピン"]')).not.toBeNull(),
    );

    await user.clear(itemNameInput);
    await user.type(itemNameInput, 'アムロジピン');
    await user.tab();

    await waitFor(() => expect(itemNameInput.value).toBe('アムロジピン'));
    const itemUnitInput = container.querySelector<HTMLInputElement>('input[id$="-item-unit-0"]');
    expect(itemUnitInput?.value).toBe('錠');
  });

  it('候補が多い場合でも入力欄の選択肢で全件参照できる', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const items = Array.from({ length: 60 }, (_, index) => ({
      type: 'drug' as const,
      code: `A${String(index + 1).padStart(3, '0')}`,
      name: `薬剤${index + 1}`,
      unit: '錠',
    }));
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type }) => {
      if (type !== 'drug') {
        return { ok: true, items: [], totalCount: 0 };
      }
      return {
        ok: true,
        items,
        totalCount: items.length,
      };
    });

    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const itemNameInput = screen.getByPlaceholderText('薬剤名');
    await user.type(itemNameInput, '薬剤');

    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'drug', keyword: '薬剤' })),
    );
    await waitFor(() =>
      expect(document.querySelectorAll(`datalist[id$="-item-predictive-list"] option`).length).toBeGreaterThan(0),
    );
    const datalistOptions = Array.from(document.querySelectorAll(`datalist[id$="-item-predictive-list"] option`));
    expect(datalistOptions.map((option) => option.getAttribute('value'))).toContain('薬剤1');
    expect(datalistOptions.map((option) => option.getAttribute('value'))).toContain('薬剤60');
  });

  it('readOnly の場合は検索入力が無効化される', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        meta={{
          ...baseProps.meta,
          readOnly: true,
          readOnlyReason: '閲覧専用',
        }}
      />,
    );

    expect(screen.getByPlaceholderText('薬剤名')).toBeDisabled();
    expect(screen.getByText('候補対象: 処方薬剤')).toBeInTheDocument();
    expect(fetchOrderBundles).toHaveBeenCalled();
  });

  it('リハビリ部位検索で選択した部位が反映される', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type }) => {
      if (type === 'bodypart') {
        return {
          ok: true,
          items: [
            {
              type: 'bodypart',
              code: '002001',
              name: '膝関節',
            },
          ],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });
    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="treatmentOrder"
        title="オーダー編集"
        bundleLabel="オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    const keywordInput = screen.getByLabelText('部位検索', {
      selector: 'input[id$="-bodypart-keyword"]',
    });
    await user.type(keywordInput, '膝');

    const searchButton = screen.getByRole('button', { name: '部位検索' });
    await user.click(searchButton);

    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'bodypart', keyword: '膝' })),
    );
    await waitFor(() => expect(screen.getByText('膝関節')).toBeInTheDocument());

    const rowButton = screen.getByText('膝関節').closest('button');
    expect(rowButton).not.toBeNull();
    await user.click(rowButton!);

    const bodyPartInput = screen.getByLabelText('部位', {
      selector: 'input[id$="-bodypart"]',
    }) as HTMLInputElement;
    expect(bodyPartInput.value).toBe('膝関節');
  });

  it('readOnly の場合は放射線の部位/コメント入力が無効化される', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="radiologyOrder"
        title="放射線"
        bundleLabel="放射線オーダー名"
        meta={{
          ...baseProps.meta,
          readOnly: true,
          readOnlyReason: '閲覧専用',
        }}
      />,
    );

    expect(screen.getByLabelText('部位')).toBeDisabled();
    expect(screen.getByLabelText('部位検索')).toBeDisabled();
    expect(screen.getByRole('button', { name: '部位検索' })).toBeDisabled();
    expect(screen.getByPlaceholderText('コード')).toBeDisabled();
    expect(screen.getByPlaceholderText('コメント内容')).toBeDisabled();
    const addButtons = screen.getAllByRole('button', { name: '追加' });
    addButtons.forEach((button) => expect(button).toBeDisabled());
  });

  it('treatmentOrder の場合はリハビリ部位検索が表示される', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="treatmentOrder"
        title="オーダー編集"
        bundleLabel="オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    expect(screen.getByLabelText('部位')).toBeEnabled();
    expect(screen.getByLabelText('部位検索')).toBeEnabled();
    expect(screen.getByRole('button', { name: '部位検索' })).toBeEnabled();
  });

  it('注射オーダーでは注射専用フォームが表示される', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="injectionOrder"
        title="注射"
        bundleLabel="注射名"
        itemQuantityLabel="数量"
      />,
    );

    expect(screen.getByText('候補対象: 注射薬剤 / 注射手技')).toBeInTheDocument();
    expect(screen.queryByText('用法候補')).not.toBeInTheDocument();
    expect(screen.getByLabelText('投与指示')).toBeInTheDocument();
  });

  it('手術オーダーの手技検索は etensu カテゴリ5を使用する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({
      ok: true,
      items: [],
      totalCount: 0,
    });

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="surgeryOrder"
        title="手術"
        bundleLabel="手術オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    const itemNameInput = screen.getByPlaceholderText('処置項目名');
    await user.type(itemNameInput, 'カテ');

    await waitFor(() => {
      const called = searchMock.mock.calls.some(
        ([params]) =>
          params?.type === 'etensu' &&
          params?.category === '5' &&
          typeof params?.keyword === 'string' &&
          params.keyword.includes('カテ'),
      );
      expect(called).toBe(true);
    });
  });

  it('treatmentOrder の手技検索は etensu カテゴリ4を使用する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({
      ok: true,
      items: [],
      totalCount: 0,
    });

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="treatmentOrder"
        title="オーダー編集"
        bundleLabel="オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    const itemNameInput = screen.getByPlaceholderText('処置項目名');
    await user.type(itemNameInput, '創傷');

    await waitFor(() => {
      const called = searchMock.mock.calls.some(
        ([params]) =>
          params?.type === 'etensu' &&
          params?.category === '4' &&
          typeof params?.keyword === 'string' &&
          params.keyword.includes('創傷'),
      );
      expect(called).toBe(true);
    });
  });

  it('treatmentOrder の手技検索は etensu カテゴリ4を使用する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({
      ok: true,
      items: [],
      totalCount: 0,
    });
    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="treatmentOrder"
        title="処置"
        bundleLabel="処置名"
        itemQuantityLabel="数量"
      />,
    );

    const itemNameInput = screen.getByPlaceholderText('処置項目名');
    await user.type(itemNameInput, '消毒');

    await waitFor(() => {
      const called = searchMock.mock.calls.some(
        ([params]) =>
          params?.type === 'etensu' &&
          params?.category === '4' &&
          typeof params?.keyword === 'string' &&
          params.keyword.includes('消毒'),
      );
      expect(called).toBe(true);
    });
  });

  it('算定オーダーの手技検索は etensu カテゴリ1を使用する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({
      ok: true,
      items: [],
      totalCount: 0,
    });

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="baseChargeOrder"
        title="基本料"
        bundleLabel="算定"
        itemQuantityLabel="数量"
      />,
    );

    const itemNameInput = screen.getByPlaceholderText('算定項目名');
    await user.type(itemNameInput, '初診');

    await waitFor(() => {
      const called = searchMock.mock.calls.some(
        ([params]) =>
          params?.type === 'etensu' &&
          params?.category === '1' &&
          typeof params?.keyword === 'string' &&
          params.keyword.includes('初診'),
      );
      expect(called).toBe(true);
    });
  });

  it('注射オーダーの統合検索は drug と etensu カテゴリ3を使用する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({
      ok: true,
      items: [],
      totalCount: 0,
    });

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="injectionOrder"
        title="注射"
        bundleLabel="注射名"
        itemQuantityLabel="数量"
      />,
    );

    const itemNameInput = screen.getByPlaceholderText('注射薬剤または手技名');
    await user.type(itemNameInput, '点滴');

    await waitFor(() => {
      const hasDrug = searchMock.mock.calls.some(
        ([params]) => params?.type === 'drug' && typeof params?.keyword === 'string' && params.keyword.includes('点滴'),
      );
      const hasEtensu = searchMock.mock.calls.some(
        ([params]) =>
          params?.type === 'etensu' &&
          params?.category === '3' &&
          typeof params?.keyword === 'string' &&
          params.keyword.includes('点滴'),
      );
      expect(hasDrug).toBe(true);
      expect(hasEtensu).toBe(true);
    });
  });

  it('放射線オーダーの統合検索は etensuカテゴリ7 / material / drug を使用する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({
      ok: true,
      items: [],
      totalCount: 0,
    });

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="radiologyOrder"
        title="放射線"
        bundleLabel="放射線オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    const itemNameInput = screen.getByPlaceholderText('画像検査名');
    await user.type(itemNameInput, 'CT');

    await waitFor(() => {
      const hasEtensu = searchMock.mock.calls.some(
        ([params]) =>
          params?.type === 'etensu' &&
          params?.category === '7' &&
          typeof params?.keyword === 'string' &&
          params.keyword.includes('CT'),
      );
      const hasMaterial = searchMock.mock.calls.some(
        ([params]) => params?.type === 'material' && typeof params?.keyword === 'string' && params.keyword.includes('CT'),
      );
      const hasDrug = searchMock.mock.calls.some(
        ([params]) => params?.type === 'drug' && typeof params?.keyword === 'string' && params.keyword.includes('CT'),
      );
      expect(hasEtensu).toBe(true);
      expect(hasMaterial).toBe(true);
      expect(hasDrug).toBe(true);
    });
  });

  it('検査オーダーの統合検索は etensuカテゴリ6 と kensa-sort を使用する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({
      ok: true,
      items: [],
      totalCount: 0,
    });

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="testOrder"
        title="検査"
        bundleLabel="検査オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    const itemNameInput = screen.getByPlaceholderText('検査項目名');
    await user.type(itemNameInput, '血液');

    await waitFor(() => {
      const hasEtensu = searchMock.mock.calls.some(
        ([params]) =>
          params?.type === 'etensu' &&
          params?.category === '6' &&
          typeof params?.keyword === 'string' &&
          params.keyword.includes('血液'),
      );
      const hasKensaSort = searchMock.mock.calls.some(
        ([params]) => params?.type === 'kensa-sort' && typeof params?.keyword === 'string' && params.keyword.includes('血液'),
      );
      expect(hasEtensu).toBe(true);
      expect(hasKensaSort).toBe(true);
    });
  });

  it('生理検査オーダーの統合検索は etensuカテゴリ6 と kensa-sort を使用する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({
      ok: true,
      items: [],
      totalCount: 0,
    });
    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="physiologyOrder"
        title="生理検査"
        bundleLabel="検査オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    const itemNameInput = screen.getByPlaceholderText('生理検査項目名');
    await user.type(itemNameInput, '心電図');

    await waitFor(() => {
      const hasEtensu = searchMock.mock.calls.some(
        ([params]) =>
          params?.type === 'etensu' &&
          params?.category === '6' &&
          typeof params?.keyword === 'string' &&
          params.keyword.includes('心電図'),
      );
      const hasKensaSort = searchMock.mock.calls.some(
        ([params]) => params?.type === 'kensa-sort' && typeof params?.keyword === 'string' && params.keyword.includes('心電図'),
      );
      expect(hasEtensu).toBe(true);
      expect(hasKensaSort).toBe(true);
    });
  });

  it('細菌検査オーダーの統合検索は etensuカテゴリ6 と kensa-sort を使用する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({
      ok: true,
      items: [],
      totalCount: 0,
    });
    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="bacteriaOrder"
        title="細菌検査"
        bundleLabel="検査オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    const itemNameInput = screen.getByPlaceholderText('細菌検査項目名');
    await user.type(itemNameInput, '培養');

    await waitFor(() => {
      const hasEtensu = searchMock.mock.calls.some(
        ([params]) =>
          params?.type === 'etensu' &&
          params?.category === '6' &&
          typeof params?.keyword === 'string' &&
          params.keyword.includes('培養'),
      );
      const hasKensaSort = searchMock.mock.calls.some(
        ([params]) => params?.type === 'kensa-sort' && typeof params?.keyword === 'string' && params.keyword.includes('培養'),
      );
      expect(hasEtensu).toBe(true);
      expect(hasKensaSort).toBe(true);
    });
  });

  it('その他オーダーの統合検索は etensuカテゴリ8 のみを使用する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({
      ok: true,
      items: [],
      totalCount: 0,
    });

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="otherOrder"
        title="その他"
        bundleLabel="その他オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    const itemNameInput = screen.getByPlaceholderText('その他オーダー項目名');
    await user.type(itemNameInput, '創');

    await waitFor(() => {
      const hasEtensu = searchMock.mock.calls.some(
        ([params]) =>
          params?.type === 'etensu' &&
          params?.category === '8' &&
          typeof params?.keyword === 'string' &&
          params.keyword.includes('創'),
      );
      const hasDrug = searchMock.mock.calls.some(
        ([params]) => params?.type === 'drug' && typeof params?.keyword === 'string' && params.keyword.includes('創'),
      );
      const hasMaterial = searchMock.mock.calls.some(
        ([params]) => params?.type === 'material' && typeof params?.keyword === 'string' && params.keyword.includes('創'),
      );
      expect(hasEtensu).toBe(true);
      expect(hasDrug).toBe(false);
      expect(hasMaterial).toBe(false);
    });
  });

  it('指導料オーダーの手技検索は etensu カテゴリ1を使用する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({
      ok: true,
      items: [],
      totalCount: 0,
    });

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="instractionChargeOrder"
        title="指導料"
        bundleLabel="指導料"
        itemQuantityLabel="数量"
      />,
    );

    const itemNameInput = screen.getByPlaceholderText('算定項目名');
    await user.type(itemNameInput, '管理');

    await waitFor(() => {
      const called = searchMock.mock.calls.some(
        ([params]) =>
          params?.type === 'etensu' &&
          params?.category === '1' &&
          typeof params?.keyword === 'string' &&
          params.keyword.includes('管理'),
      );
      expect(called).toBe(true);
    });
  });

  it('放射線オーダーでは統合検索対象が表示される', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="radiologyOrder"
        title="放射線"
        bundleLabel="放射線オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    expect(screen.getByText('候補対象: 画像検査 / 画像器材 / 造影薬剤')).toBeInTheDocument();
    expect(screen.getByLabelText('検査指示')).toBeInTheDocument();
  });

  it('otherOrder では bodyPart 検索を表示しない', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="otherOrder"
        title="その他"
        bundleLabel="項目"
        itemQuantityLabel="数量"
      />,
    );

    expect(screen.queryByLabelText('部位検索')).toBeNull();
    expect(screen.queryByLabelText('部位')).toBeNull();
  });

  it('コメント候補の行選択でコメントコードを追加できる', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type, keyword }) => {
      if (type === 'comment' && keyword.includes('服薬')) {
        return {
          ok: true,
          items: [
            {
              type: 'comment',
              code: '0082',
              name: '服薬指示',
              category: 'comment',
              note: 'RP',
            },
          ],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });

    const user = userEvent.setup();
    const { container } = renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const commentDraftNameInput = container.querySelector<HTMLInputElement>('input[id$="-comment-draft-name"]');
    expect(commentDraftNameInput).not.toBeNull();
    await user.type(commentDraftNameInput!, '服薬');

    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'comment', keyword: '服薬' })),
    );
    await waitFor(() => expect(screen.getByText('服薬指示')).toBeInTheDocument());

    await user.click(screen.getByText('服薬指示').closest('button')!);
    await user.click(screen.getByRole('button', { name: 'コメント追加' }));

    const commentCodeInput = container.querySelector<HTMLInputElement>('input[id$="-comment-code-0"]');
    const commentNameInput = container.querySelector<HTMLInputElement>('input[id$="-comment-name-0"]');
    expect(commentCodeInput?.value).toBe('0082');
    expect(commentNameInput?.value).toBe('服薬指示');
  });

  it('コメント内容入力欄の blur 補完でコメント追加できる', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type, keyword }) => {
      if (type === 'comment' && keyword.includes('服薬')) {
        return {
          ok: true,
          items: [{ type: 'comment', code: '0082', name: '服薬指示', unit: '', note: '' }],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });

    const user = userEvent.setup();
    const { container } = renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const commentDraftNameInput = container.querySelector<HTMLInputElement>('input[id$="-comment-draft-name"]');
    expect(commentDraftNameInput).not.toBeNull();
    await user.type(commentDraftNameInput!, '服薬指示');
    await user.tab();
    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'comment', keyword: '服薬指示' })),
    );

    const addButton = screen.getByRole('button', { name: 'コメント追加' });
    await user.click(addButton);

    const commentCodeInput = container.querySelector<HTMLInputElement>('input[id$="-comment-code-0"]');
    const commentNameInput = container.querySelector<HTMLInputElement>('input[id$="-comment-name-0"]');
    expect(commentCodeInput?.value).toBe('0082');
    expect(commentNameInput?.value).toBe('服薬指示');
    expect(commentCodeInput).toHaveAttribute('readonly');
    expect(commentNameInput).toHaveAttribute('readonly');
  });

  it('edit request の 9 桁コードと開始日から medicationgetv2 候補を取得できる', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const medicationGetMock = vi.mocked(fetchOrcaMedicationGet);
    medicationGetMock.mockResolvedValue({
      ok: true,
      status: 200,
      selections: [
        {
          commentCode: '0082',
          commentName: '食後',
          category: '1',
          itemNumber: '01',
          itemNumberBranch: '00',
        },
      ],
    });
    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        request={{
          requestId: 'medication-get-runtime',
          kind: 'edit',
          bundle: {
            entity: 'medOrder',
            bundleName: '対象RP',
            bundleNumber: '1',
            classCode: '210',
            classCodeSystem: 'Claim007',
            className: '内服',
            admin: '',
            started: '2026-03-09',
            items: [{ code: '123400001', name: '対象行為', quantity: '1', unit: '回', memo: '', rowRole: 'main' }],
          },
        }}
        meta={{
          ...baseProps.meta,
          visitDate: '2026-03-09',
        }}
      />,
    );

    await waitFor(() =>
      expect(medicationGetMock).toHaveBeenCalledWith({
        requestCode: '123400001',
        baseDate: '2026-03-09',
        requestNumber: '02',
      }),
    );
    const selectionCommentButtons = await screen.findAllByRole('button', { name: /食後/ });
    const selectionCommentButton =
      selectionCommentButtons.find((button) => button.className.includes('charts-side-panel__search-row--correction')) ??
      selectionCommentButtons[0];
    expect(selectionCommentButton).toBeDisabled();
    expect(selectionCommentButton).toHaveAttribute(
      'title',
      '選択式コメントの itemNumber / branch は未対応のため追加できません。パラメータ不要のコメントのみ選択してください。',
    );
  });
});
