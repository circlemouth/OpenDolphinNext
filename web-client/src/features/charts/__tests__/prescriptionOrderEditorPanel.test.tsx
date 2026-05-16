import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PrescriptionOrderEditorPanel } from '../PrescriptionOrderEditorPanel';
import { fetchOrderMasterSearch } from '../orderMasterSearchApi';

vi.mock('../orderMasterSearchApi', async () => {
  const actual = await vi.importActual<typeof import('../orderMasterSearchApi')>('../orderMasterSearchApi');
  return {
    ...actual,
    fetchOrderMasterSearch: vi.fn(),
  };
});

const baseMeta = {
  runId: 'RUN-RX-PANEL-TEST',
  cacheHit: true,
  missingMaster: false,
  fallbackUsed: false,
  dataSourceTransition: 'server' as const,
  visitDate: '2026-02-26',
};

const renderPanel = (metaOverrides?: Partial<typeof baseMeta>) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <PrescriptionOrderEditorPanel
        patientId="P-TEST-001"
        meta={{ ...baseMeta, ...metaOverrides }}
        active
        bundlesOverride={[
          {
            entity: 'medOrder',
            bundleName: '既存RP',
            bundleNumber: '1',
            admin: '1日1回',
            classCode: '212',
            started: '2026-02-26',
            items: [{ name: 'A100 アムロジピン', quantity: '1', unit: '錠', memo: '' }],
          },
        ]}
      />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PrescriptionOrderEditorPanel', () => {
  it('RPグリッドでオーダー内容を前面表示し、未解決の成分量/その他を未設定として扱う', () => {
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    renderPanel();

    const grid = screen.getByTestId('prescription-order-kirin-grid');
    expect(document.querySelector('[data-order-entity="medOrder"][data-order-layout="compact-kirin"]')).not.toBeNull();
    expect(within(grid).getByText('オーダー内容')).toBeInTheDocument();
    expect(within(grid).queryByText('RP行はこの表で確認し、下の選択中RPで即編集します')).toBeNull();
    expect(within(grid).getByText('薬剤名称')).toBeInTheDocument();
    expect(within(grid).getByText(/アムロジピン/)).toBeInTheDocument();
    expect(within(grid).getByText('後発変更可否')).toBeInTheDocument();
    expect(grid.querySelectorAll('[data-unresolved="true"]').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('RP名')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('処方安全チェックサマリ')).toBeNull();
    expect(screen.queryByText('この画面で検出できる重複投与候補、静的相互作用候補、保存不可ルールはありません。')).toBeNull();
    expect(document.querySelector('.charts-side-panel__item-row--rx-drug')).not.toBeNull();
    expect(document.querySelector('.charts-order-editor__rx-compact-band')).not.toBeNull();
  });

  it('3文字以上は自動検索、2文字以下は手動検索ボタンで候補表示する', async () => {
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type, keyword }) => {
      if (type === 'youhou') return { ok: true, items: [], totalCount: 0 };
      if (type === 'drug') {
        return {
          ok: true,
          items: [{ type: 'drug', code: 'A100', name: `${keyword}候補`, unit: '錠' }],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });

    renderPanel();

    const keywordInput = screen.getByLabelText('キーワード');
    await user.clear(keywordInput);
    await user.type(keywordInput, 'アム');
    const manualSearchButton = await screen.findByRole('button', { name: '検索（2文字以下は明示実行）' });
    expect(manualSearchButton).toBeInTheDocument();

    await user.click(manualSearchButton);
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'drug', keyword: 'アム' }));
    });
    expect(screen.getByRole('button', { name: /アム候補/ })).toBeInTheDocument();

    await user.clear(keywordInput);
    await user.type(keywordInput, 'アムロ');
    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'drug', keyword: 'アムロ' }));
    });
    expect(screen.getByRole('button', { name: /アムロ候補/ })).toBeInTheDocument();
  });

  it('＋RP / ＋薬剤行 / 入力を全クリアでRP集合を操作できる', async () => {
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    renderPanel();

    const rpPane = screen.getByLabelText('候補・セット・RP一覧');
    expect(within(rpPane).getByText('1件')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '＋RP' }));
    expect(within(rpPane).getByText('2件')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '＋薬剤行' }));
    expect(screen.getAllByPlaceholderText('薬剤名')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: '入力を全クリア' }));
    expect(within(rpPane).getByText('1件')).toBeInTheDocument();
  });

  it('RP共通用法ルールを通常表示せず、複数薬剤から別RPへ分離できる', async () => {
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    renderPanel();

    expect(screen.queryByText('1つのRPでは用法は共通です。異なる用法の薬剤は別RPに分けてください。')).toBeNull();
    const addDrugButton = screen.getByRole('button', { name: '＋薬剤行' });
    expect(addDrugButton).toHaveAttribute('title', '1つのRPでは用法は共通です。異なる用法の薬剤は別RPに分けてください。');
    await user.click(addDrugButton);
    expect(screen.getAllByPlaceholderText('薬剤名')).toHaveLength(2);

    const splitDrugButtons = screen.getAllByRole('button', { name: 'この薬剤を別RPへ' });
    expect(splitDrugButtons[1]).toHaveAttribute('title', '1つのRPでは用法は共通です。異なる用法の薬剤は別RPに分けてください。');
    await user.click(splitDrugButtons[1]);

    const rpPane = screen.getByLabelText('候補・セット・RP一覧');
    expect(within(rpPane).getByText('2件')).toBeInTheDocument();
    expect(screen.getByText('薬剤を別RPへ分けました。新しいRPで用法を設定してください。')).toBeInTheDocument();
  });

  it('請求用コメントは Shift+Enter で確定し、個別削除できる', async () => {
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    renderPanel();

    const claimCodeInput = screen.getByPlaceholderText('請求コメントコード');
    const claimInput = screen.getByPlaceholderText('請求用コメント（Shift+Enterで確定）');
    await user.type(claimCodeInput, '810000001');
    await user.type(claimInput, '患者希望コメント');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    const chip = screen.getByRole('button', { name: '810000001 患者希望コメント' });
    expect(chip).toBeInTheDocument();

    await user.click(chip);
    expect(screen.queryByRole('button', { name: '810000001 患者希望コメント' })).toBeNull();
  });

  it('コード未入力の請求コメントは追加前に明示ブロックする', async () => {
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    renderPanel();

    const claimInput = screen.getByPlaceholderText('請求用コメント（Shift+Enterで確定）');
    await user.type(claimInput, 'コードなしコメント');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(screen.queryByRole('button', { name: /コードなしコメント/ })).toBeNull();
    expect(screen.getByText('請求コメントはコード付きで追加してください。自由文は薬剤コメントへ入力してください。')).toBeInTheDocument();
  });

  it('日数一括変更は内服/頓服RPのみに反映し、外用RPには反映しない', async () => {
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    renderPanel();

    await user.click(screen.getByRole('button', { name: '＋RP' }));
    await user.click(screen.getByRole('button', { name: /RP2:/ }));
    await user.click(screen.getByRole('button', { name: '外用' }));

    const daysInput = screen.getByLabelText('日数');
    await user.clear(daysInput);
    await user.type(daysInput, '3');

    const bulkInput = screen.getByLabelText('日数一括変更（内服/頓服のみ）');
    await user.type(bulkInput, '7');
    await user.click(screen.getByRole('button', { name: '一括反映' }));

    await user.click(screen.getByRole('button', { name: /RP1:/ }));
    expect((screen.getByLabelText('日数') as HTMLInputElement).value).toBe('7');

    await user.click(screen.getByRole('button', { name: /RP2:/ }));
    expect((screen.getByLabelText('日数') as HTMLInputElement).value).toBe('3');
  });

  it('薬剤検索で method/scope を API に渡し、scope は ORCA 値にマッピングする', async () => {
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type, keyword }) => {
      if (type === 'youhou') return { ok: true, items: [], totalCount: 0 };
      if (type === 'drug') {
        return {
          ok: true,
          items: [{ type: 'drug', code: 'A100', name: `${keyword}候補`, unit: '錠' }],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });

    renderPanel();

    const methodSelect = screen.getByLabelText('検索方法');
    const scopeSelect = screen.getByLabelText('検索範囲');
    const keywordInput = screen.getByLabelText('キーワード');

    await user.selectOptions(methodSelect, 'partial');

    const runManualSearch = async (scope: 'outside_adopted' | 'in_hospital_adopted' | 'inside_adopted') => {
      await user.selectOptions(scopeSelect, scope);
      await user.clear(keywordInput);
      await user.type(keywordInput, 'アム');
      await user.click(screen.getByRole('button', { name: '検索（2文字以下は明示実行）' }));
    };

    await runManualSearch('outside_adopted');
    await runManualSearch('in_hospital_adopted');
    await runManualSearch('inside_adopted');

    await waitFor(() => {
      const hasScopeCall = (scope: string) =>
        searchMock.mock.calls.some(([params]) => {
          const record = params as Record<string, unknown> | undefined;
          return record?.type === 'drug' && record?.method === 'partial' && record?.scope === scope;
        });

      const hasOuter = hasScopeCall('outer');
      const hasInHospital = hasScopeCall('in-hospital');
      const hasAdopted = hasScopeCall('adopted');
      expect(hasOuter).toBe(true);
      expect(hasInHospital).toBe(true);
      expect(hasAdopted).toBe(true);
    });
  });

  it('visitDate が日時文字列でも用法マスタ検索の effective は YYYY-MM-DD になる', async () => {
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    renderPanel({ visitDate: '2026-02-26T23:59:59+09:00' });

    await waitFor(() => {
      expect(searchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'youhou',
          effective: '2026-02-26',
        }),
      );
    });
  });

  it('visitDate が日時文字列でも薬剤マスタ検索の effective/asOf は YYYY-MM-DD になる', async () => {
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type, keyword }) => {
      if (type === 'youhou') return { ok: true, items: [], totalCount: 0 };
      if (type === 'drug') {
        return {
          ok: true,
          items: [{ type: 'drug', code: 'A100', name: `${keyword}候補`, unit: '錠' }],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });

    renderPanel({ visitDate: '2026-02-26T23:59:59+09:00' });

    const keywordInput = screen.getByLabelText('キーワード');
    await user.clear(keywordInput);
    await user.type(keywordInput, 'アム');
    await user.click(screen.getByRole('button', { name: '検索（2文字以下は明示実行）' }));

    await waitFor(() => {
      const hasExpectedDrugCall = searchMock.mock.calls.some(([params]) => {
        const record = params as Record<string, unknown> | undefined;
        return (
          record?.type === 'drug' &&
          record?.keyword === 'アム' &&
          record?.effective === '2026-02-26' &&
          record?.asOf === '2026-02-26'
        );
      });
      expect(hasExpectedDrugCall).toBe(true);
    });
  });
});
