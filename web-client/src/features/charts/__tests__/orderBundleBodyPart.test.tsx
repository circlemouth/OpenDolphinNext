import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { OrderBundleEditPanel } from '../OrderBundleEditPanel';
import { fetchOrderBundles } from '../orderBundleApi';
import { fetchOrderMasterSearch } from '../orderMasterSearchApi';

vi.mock('../orderBundleApi', async () => {
  const actual = await vi.importActual<typeof import('../orderBundleApi')>('../orderBundleApi');
  return {
    ...actual,
    fetchOrderBundles: vi.fn().mockResolvedValue({
      ok: true,
      bundles: [],
      patientId: 'P-1',
    }),
    mutateOrderBundles: vi.fn().mockResolvedValue({
      ok: true,
      runId: 'RUN-BODY-PART',
    }),
  };
});

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
  title: '画像診断オーダー編集',
  bundleLabel: '画像診断オーダー名',
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

describe('OrderBundleEditPanel body part contract', () => {
  it('radiologyOrder の bodyPart 検索は 002 部位を read-only フィールドへ反映する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    vi.mocked(fetchOrderMasterSearch).mockImplementation(async ({ type }) => {
      if (type === 'bodypart') {
        return {
          ok: true,
          items: [{ type: 'bodypart', code: '002001', name: '胸部', unit: '部位', category: '2' }],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });

    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    await user.type(screen.getByLabelText('部位検索', { selector: 'input[id$="-bodypart-keyword"]' }), '胸');
    await waitFor(() =>
      expect(fetchOrderMasterSearch).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'bodypart', keyword: '胸' })),
    );
    await user.click(await screen.findByRole('button', { name: /胸部/ }));

    const bodyPartInput = screen.getByLabelText('部位', { selector: 'input[id$="-bodypart"]' });
    expect(bodyPartInput).toHaveAttribute('readonly');
    expect(bodyPartInput).toHaveAttribute('aria-readonly', 'true');
    expect(bodyPartInput).toHaveValue('胸部');
  });

  it('treatmentOrder では bodyPart 検索 UI を表示しない', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="treatmentOrder"
        title="処置オーダー編集"
        bundleLabel="オーダー名"
        itemQuantityLabel="回数"
      />,
    );

    expect(screen.queryByLabelText('部位検索', { selector: 'input[id$="-bodypart-keyword"]' })).toBeNull();
    expect(screen.queryByLabelText('部位', { selector: 'input[id$="-bodypart"]' })).toBeNull();
  });

  it('bodyPart 検索失敗時は aria-live=assertive のエラーを表示する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({
      ok: false,
      items: [],
      totalCount: 0,
      message: '部位マスタの検索に失敗しました。',
    });

    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    await user.type(screen.getByLabelText('部位検索', { selector: 'input[id$="-bodypart-keyword"]' }), '胸');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent('部位マスタの検索に失敗しました。');
  });

  it('bodyPart 非対応 entity では部位検索 UI を表示しない', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');

    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="medOrder"
        title="処方オーダー編集"
        bundleLabel="RP名"
        itemQuantityLabel="用量"
      />,
    );

    expect(screen.queryByLabelText('部位検索', { selector: 'input[id$="-bodypart-keyword"]' })).toBeNull();
  });

  it('fetch 済みの 002 bodyPart は read-only フィールドへ復元する', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    vi.mocked(fetchOrderBundles).mockResolvedValueOnce({
      ok: true,
      patientId: 'P-1',
      bundles: [
        {
          documentId: 700,
          moduleId: 70,
          entity: 'radiologyOrder',
          bundleName: '胸部CT',
          classCode: '700',
          started: '2026-02-27',
          items: [{ code: '700001', name: '胸部CT' }],
          bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '専用フィールド' },
        } as any,
      ],
    });

    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    await user.click(await screen.findByRole('button', { name: '編集' }));

    const bodyPartInput = screen.getByLabelText('部位', { selector: 'input[id$="-bodypart"]' });
    expect(bodyPartInput).toHaveAttribute('readonly');
    expect(bodyPartInput).toHaveValue('胸部');
  });

  it('fetch 済みの non-002 bodyPart は再構成しない', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    vi.mocked(fetchOrderBundles).mockResolvedValueOnce({
      ok: true,
      patientId: 'P-1',
      bundles: [
        {
          documentId: 701,
          moduleId: 71,
          entity: 'radiologyOrder',
          bundleName: '胸部CT',
          classCode: '700',
          started: '2026-02-27',
          items: [{ code: '700001', name: '胸部CT' }],
          bodyPart: { code: '001001', name: '胸部', quantity: '1', unit: '部位', memo: 'invalid' },
        } as any,
      ],
    });

    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    await user.click(await screen.findByRole('button', { name: '編集' }));

    const bodyPartInput = screen.getByLabelText('部位', { selector: 'input[id$="-bodypart"]' });
    expect(bodyPartInput).toHaveValue('');
  });

  it('radiologyOrder でも classCode 701 では bodyPart UI を再構成しない', async () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');
    vi.mocked(fetchOrderBundles).mockResolvedValueOnce({
      ok: true,
      patientId: 'P-1',
      bundles: [
        {
          documentId: 702,
          moduleId: 72,
          entity: 'radiologyOrder',
          bundleName: '胸部MRI',
          classCode: '701',
          started: '2026-02-27',
          items: [{ code: '701001', name: '胸部MRI' }],
          bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: 'should-not-restore' },
        } as any,
      ],
    });

    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    await user.click(await screen.findByRole('button', { name: '編集' }));

    expect(screen.queryByLabelText('部位検索', { selector: 'input[id$="-bodypart-keyword"]' })).toBeNull();
    expect(screen.queryByLabelText('部位', { selector: 'input[id$="-bodypart"]' })).toBeNull();
  });
});
