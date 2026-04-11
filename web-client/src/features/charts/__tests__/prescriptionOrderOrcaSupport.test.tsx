import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { PrescriptionOrderEditorPanel } from '../PrescriptionOrderEditorPanel';
import { fetchOrderMasterSearch } from '../orderMasterSearchApi';
import { fetchOrcaGenericPrice } from '../orcaGenericPriceApi';
import { fetchOrcaOrderInputSetDetail, fetchOrcaOrderInputSets } from '../orcaOrderInputSetApi';
import { checkOrcaMasterStaticOrderInteractions } from '../orcaOrderInteractionApi';
import { savePrescriptionOrder } from '../prescriptionOrderApi';

vi.mock('../orderMasterSearchApi', async () => {
  const actual = await vi.importActual<typeof import('../orderMasterSearchApi')>('../orderMasterSearchApi');
  return {
    ...actual,
    fetchOrderMasterSearch: vi.fn(),
  };
});

vi.mock('../orcaGenericPriceApi', () => ({
  fetchOrcaGenericPrice: vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    notFound: true,
  }),
}));

vi.mock('../orcaOrderInputSetApi', () => ({
  fetchOrcaOrderInputSets: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    items: [],
    totalCount: 0,
  }),
  fetchOrcaOrderInputSetDetail: vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    notFound: true,
    bundle: { items: [] },
  }),
}));

vi.mock('../orcaOrderInteractionApi', () => ({
  checkOrcaMasterStaticOrderInteractions: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    totalCount: 0,
    pairs: [],
  }),
}));

vi.mock('../prescriptionOrderApi', async () => {
  const actual = await vi.importActual<typeof import('../prescriptionOrderApi')>('../prescriptionOrderApi');
  return {
    ...actual,
    savePrescriptionOrder: vi.fn().mockResolvedValue({ ok: true }),
  };
});

const renderWithClient = (ui: ReactElement) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const baseMeta = {
  runId: 'RUN-RX-ORCA',
  cacheHit: false,
  missingMaster: false,
  fallbackUsed: false,
  dataSourceTransition: 'server' as const,
  visitDate: '2026-03-09',
};

const renderPanel = (bundlesOverride = [
  {
    entity: 'medOrder',
    bundleName: '既存RP',
    bundleNumber: '7',
    admin: '1日1回 朝食後',
    adminCode: '001000',
    classCode: '212',
    started: '2026-03-09',
    items: [{ code: '620000001', name: 'アムロジピン錠5mg', quantity: '1', unit: '錠', memo: '' }],
  },
]) =>
  renderWithClient(
    <PrescriptionOrderEditorPanel
      patientId="P-ORCA-001"
      meta={baseMeta}
      active
      bundlesOverride={bundlesOverride as any}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const requestUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    if (requestUrl.includes('/api/orca/official/chart-support/contraindication-check')) {
      return new Response(
        JSON.stringify({
          ok: true,
          apiOk: true,
          apiResult: '0000',
          apiResultMessage: 'OK',
          results: [],
          symptomInfo: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    throw new Error(`unexpected fetch: ${requestUrl}`);
  });
  vi.mocked(fetchOrderMasterSearch).mockImplementation(async ({ type, keyword }) => {
    if (type === 'youhou') return { ok: true, items: [], totalCount: 0 };
    if (type === 'drug') {
      return {
        ok: true,
        items: keyword
          ? [{ type: 'drug', code: '620000001', name: 'アムロジピン錠5mg', unit: '錠' }]
          : [],
        totalCount: keyword ? 1 : 0,
      };
    }
    return { ok: true, items: [], totalCount: 0 };
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PrescriptionOrderEditorPanel ORCA support', () => {
  it('候補一覧と選択中薬剤に最低薬価を補助表示する', async () => {
    vi.mocked(fetchOrcaGenericPrice).mockResolvedValue({
      ok: true,
      status: 200,
      item: { code: '620000001', minPrice: 12.34, unit: '錠' },
    });
    const user = userEvent.setup();

    renderPanel();

    await user.type(screen.getByLabelText('キーワード'), 'アム');
    await user.click(screen.getByRole('button', { name: '検索（2文字以下は明示実行）' }));

    const candidateRow = await screen.findByRole('button', { name: /620000001.*12\.34.*右へ反映/ });
    expect(candidateRow).toBeInTheDocument();

    await user.click(candidateRow);
    await waitFor(() => {
      expect(screen.getByText('最低薬価: 12.34')).toBeInTheDocument();
    });
  });

  it('ORCA入力セットを RP へ追記反映する', async () => {
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [
        {
          setCode: 'P01001',
          name: '降圧セット',
          entity: 'medOrder',
          itemCount: 2,
        },
      ],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'P01001',
      bundle: {
        entity: 'medOrder',
        bundleName: '降圧セット',
        bundleNumber: '14',
        admin: '1日1回 朝食後',
        started: '2026-03-09',
        items: [
          { code: '620000001', name: 'アムロジピン錠5mg', quantity: '1', unit: '錠', memo: '' },
          { code: '620000002', name: 'ロサルタン錠50mg', quantity: '1', unit: '錠', memo: '' },
        ],
      },
    });
    const user = userEvent.setup();

    renderPanel();

    const rpPane = screen.getByLabelText('RP一覧');
    expect(within(rpPane).getByText('1件')).toBeInTheDocument();

    await user.type(screen.getByLabelText('keyword'), '降圧');
    await user.click(screen.getByRole('button', { name: '入力セット検索' }));
    await user.click(await screen.findByRole('button', { name: /P01001.*RPへ反映/ }));

    await waitFor(() => {
      expect(within(rpPane).getByText('2件')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /RP2: 降圧セット/ })).toBeInTheDocument();
  });

  it('相互作用ありのとき確認後に 1 回だけ保存する', async () => {
    vi.mocked(checkOrcaMasterStaticOrderInteractions).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      pairs: [
        {
          code1: '620000001',
          code2: '620000002',
          interactionCode: 'INT001',
          interactionName: '併用注意',
          message: '相互作用が検出されました',
        },
      ],
    });
    const user = userEvent.setup();

    renderPanel([
      {
        entity: 'medOrder',
        bundleName: '既存RP',
        bundleNumber: '7',
        admin: '1日1回 朝食後',
        adminCode: '001000',
        classCode: '212',
        started: '2026-03-09',
        items: [
          { code: '620000001', name: 'アムロジピン錠5mg', quantity: '1', unit: '錠', memo: '' },
          { code: '620000002', name: 'ロサルタン錠50mg', quantity: '1', unit: '錠', memo: '' },
        ],
      },
    ]);

    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('マスタ参照の静的相互作用チェック')).toBeInTheDocument();
    expect(screen.getByText(/620000001 \/ 620000002 \/ 併用注意/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '編集に戻る' }));
    expect(vi.mocked(savePrescriptionOrder)).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '保存' }));
    await user.click(await screen.findByRole('button', { name: '今回だけ無視して保存' }));

    await waitFor(() => {
      expect(vi.mocked(savePrescriptionOrder)).toHaveBeenCalledTimes(1);
    });
  });
});
