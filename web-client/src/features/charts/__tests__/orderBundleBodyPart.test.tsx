import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { OrderBundleEditPanel } from '../OrderBundleEditPanel';
import { fetchOrderBundles, mutateOrderBundles } from '../orderBundleApi';
import { fetchOrderMasterSearch } from '../orderMasterSearchApi';

vi.mock('../orderBundleApi', async () => ({
  fetchOrderBundles: vi.fn().mockResolvedValue({
    ok: true,
    bundles: [],
    patientId: 'P-1',
  }),
  mutateOrderBundles: vi.fn().mockResolvedValue({
    ok: true,
    runId: 'RUN-BODY-PART',
  }),
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
  entity: 'radiologyOrder',
  title: '放射線',
  bundleLabel: '放射線オーダー名',
  itemQuantityLabel: '数量',
  meta: {
    runId: 'RUN-ORDER',
    cacheHit: false,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server' as const,
  },
};

const fixedNow = new Date('2026-01-21T04:39:02.765Z').getTime();
const fixedRandom = 0.4835244854724878;
const RealDate = Date;
type DateConstructorArgs =
  | []
  | [value: string | number | Date]
  | [
      year: number,
      monthIndex: number,
      date?: number,
      hours?: number,
      minutes?: number,
      seconds?: number,
      ms?: number,
    ];

beforeEach(() => {
  vi.stubGlobal(
    'Date',
    class extends RealDate {
      constructor(...args: DateConstructorArgs) {
        if (args.length === 0) {
          super(fixedNow);
          return;
        }
        if (args.length === 1) {
          super(args[0]);
          return;
        }
        const [year, monthIndex, date, hours, minutes, seconds, ms] = args;
        super(year, monthIndex, date, hours, minutes, seconds, ms);
      }
      static now() {
        return fixedNow;
      }
    },
  );
  vi.spyOn(Math, 'random').mockReturnValue(fixedRandom);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('OrderBundleEditPanel body part search', () => {
  it('放射線の部位検索はキーワード入力で自動検索され、スナップショットに反映される', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type }) => {
      if (type === 'bodypart') {
        return {
          ok: true,
          items: [
            {
              type: 'bodypart',
              code: '002001',
              name: '胸部',
              unit: '部位',
              category: '2',
            },
          ],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });

    const user = userEvent.setup();
    const { container } = renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const keywordInput = screen.getByLabelText('部位検索', {
      selector: 'input[id$="-bodypart-keyword"]',
    });
    await user.type(keywordInput, '胸');

    await waitFor(() =>
      expect(searchMock).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'bodypart', keyword: '胸' })),
    );
    await waitFor(() => expect(screen.getByText('胸部')).toBeInTheDocument());

    container.querySelectorAll<HTMLElement>('[data-rowid]').forEach((node) => {
      node.removeAttribute('data-rowid');
    });
    expect(container).toMatchSnapshot();
  });

  it('generalOrder では bodyPart を専用フィールドに分離し、主項目は items に残る', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type }) => {
      if (type === 'etensu') {
        return {
          ok: true,
          items: [
            {
              type: 'etensu',
              code: '140000610',
              name: 'テスト項目',
              unit: '回',
              category: '4',
            },
          ],
          totalCount: 1,
        };
      }
      if (type === 'bodypart') {
        return {
          ok: true,
          items: [
            {
              type: 'bodypart',
              code: '002003',
              name: '膝関節',
              unit: '部位',
              category: '2',
            },
          ],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });

    const user = userEvent.setup();
    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="generalOrder"
        title="オーダー編集"
        bundleLabel="オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    await user.type(screen.getByPlaceholderText('処置項目名'), 'テスト項目');
    await waitFor(() =>
      expect(
        searchMock.mock.calls.some(
          ([params]) => params?.type === 'etensu' && params?.keyword === 'テスト項目',
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(document.querySelector('datalist[id$="-item-predictive-list"] option[value="テスト項目"]')).not.toBeNull(),
    );
    await user.tab();
    await waitFor(() => expect(screen.getByTestId('order-bundle-item-summary-0')).toHaveTextContent('コード: 140000610'));

    const keywordInput = screen.getByLabelText('部位検索', {
      selector: 'input[id$="-bodypart-keyword"]',
    });
    await user.type(keywordInput, '膝');

    await waitFor(() =>
      expect(
        searchMock.mock.calls.some(
          ([params]) => params?.type === 'bodypart' && params?.keyword === '膝',
        ),
      ).toBe(true),
    );
    await waitFor(() => expect(screen.getByText('膝関節')).toBeInTheDocument());

    await user.click(screen.getByText('膝関節').closest('button')!);

    await user.click(screen.getByRole('button', { name: /保存して追加/ }));

    await waitFor(() => expect(mutateOrderBundles).toHaveBeenCalled());

    const call = vi.mocked(mutateOrderBundles).mock.calls[0]?.[0];
    const items = call?.operations?.[0]?.items ?? [];
    expect(items).toEqual(expect.arrayContaining([expect.objectContaining({ code: '140000610', name: 'テスト項目' })]));
    expect(items).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: '002003', name: '膝関節' })]));
  });

  it('部位検索の失敗時は aria-live=assertive のエラーバナーが表示される', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({
      ok: false,
      items: [],
      totalCount: 0,
      message: '部位マスタの検索に失敗しました。',
    });

    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const keywordInput = screen.getByLabelText('部位検索', {
      selector: 'input[id$="-bodypart-keyword"]',
    });
    await user.type(keywordInput, '胸');

    await waitFor(() =>
      expect(searchMock).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'bodypart', keyword: '胸' })),
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent('部位マスタの検索に失敗しました。');
  });

  it('放射線以外のエンティティでは部位検索が発火しない', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    const user = userEvent.setup();
    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="medOrder"
        title="処方編集"
        bundleLabel="RP名"
        itemQuantityLabel="用量"
      />,
    );

    const keywordInput = screen.queryByLabelText('部位検索', {
      selector: 'input[id$="-bodypart-keyword"]',
    });
    expect(keywordInput).toBeNull();
    await user.click(screen.getByRole('button', { name: /保存して追加/ }));
    expect(searchMock).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'bodypart' }));
    expect(fetchOrderBundles).toHaveBeenCalled();
  });

  it('既存束に bodyPart 専用フィールドがあれば 002 アイテムが無くても部位入力へ復元する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const fetchMock = vi.mocked(fetchOrderBundles);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      patientId: 'P-1',
      bundles: [
        {
          documentId: 700,
          moduleId: 70,
          entity: 'radiologyOrder',
          bundleName: '胸部CT',
          started: '2026-02-27',
          items: [{ code: '700001', name: '胸部CT' }],
          bodyPart: { code: 'BP001', name: '胸部', quantity: '1', unit: '部位', memo: '専用フィールド' },
        } as any,
      ],
    });

    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    await user.click(await screen.findByRole('button', { name: '編集' }));

    expect(screen.getByLabelText('部位')).toHaveValue('胸部');
  });

  it('保存payloadは bodyPart 専用フィールドを送る', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type }) => {
      if (type === 'etensu') {
        return {
          ok: true,
          items: [{ type: 'etensu', code: '140000700', name: '温熱療法', unit: '回', category: '4' }],
          totalCount: 1,
        };
      }
      if (type === 'bodypart') {
        return {
          ok: true,
          items: [{ type: 'bodypart', code: '002777', name: '腰部', unit: '部位', category: '2' }],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });

    const user = userEvent.setup();
    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="generalOrder"
        title="オーダー編集"
        bundleLabel="オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    await user.type(screen.getByPlaceholderText('処置項目名'), '温熱療法');
    await waitFor(() =>
      expect(
        searchMock.mock.calls.some(
          ([params]) => params?.type === 'etensu' && params?.keyword === '温熱療法',
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(document.querySelector('datalist[id$="-item-predictive-list"] option[value="温熱療法"]')).not.toBeNull(),
    );
    await user.tab();
    await waitFor(() => expect(screen.getByTestId('order-bundle-item-summary-0')).toHaveTextContent('コード: 140000700'));

    await user.type(screen.getByLabelText('部位検索', { selector: 'input[id$="-bodypart-keyword"]' }), '腰');
    await waitFor(() =>
      expect(
        searchMock.mock.calls.some(
          ([params]) => params?.type === 'bodypart' && params?.keyword === '腰',
        ),
      ).toBe(true),
    );
    const bodyPartButton = await screen.findByRole('button', { name: /腰部/ });
    await user.click(bodyPartButton);
    await user.click(screen.getByRole('button', { name: /保存して追加/ }));

    await waitFor(() => expect(mutateOrderBundles).toHaveBeenCalled());
    const payload = vi.mocked(mutateOrderBundles).mock.calls[0]?.[0];
    const operation = (payload?.operations?.[0] ?? {}) as Record<string, unknown>;

    expect(operation).toHaveProperty(
      'bodyPart',
      expect.objectContaining({
        code: '002777',
        name: '腰部',
      }),
    );
  });
});
