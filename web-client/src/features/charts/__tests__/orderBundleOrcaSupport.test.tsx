import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OrderBundleEditPanel } from '../OrderBundleEditPanel';
import { fetchOrcaOrderInputSetDetail, fetchOrcaOrderInputSets } from '../orcaOrderInputSetApi';
import { mutateOrderBundles } from '../orderBundleApi';
import { fetchOrderMasterSearch } from '../orderMasterSearchApi';

vi.mock('../orderMasterSearchApi', async () => ({
  fetchOrderMasterSearch: vi.fn(),
}));

vi.mock('../orcaOrderInputSetApi', () => ({
  fetchOrcaOrderInputSets: vi.fn(),
  fetchOrcaOrderInputSetDetail: vi.fn(),
}));

vi.mock('../orderBundleApi', async () => ({
  fetchOrderBundles: vi.fn().mockResolvedValue({
    ok: true,
    bundles: [],
    patientId: 'P-ORDER-001',
  }),
  mutateOrderBundles: vi.fn().mockResolvedValue({ ok: true, runId: 'RUN-ORDER-ORCA-TEST' }),
}));

const baseProps = {
  patientId: 'P-ORDER-001',
  entity: 'generalOrder',
  title: '一般オーダー',
  bundleLabel: 'オーダー名',
  itemQuantityLabel: '数量',
  meta: {
    runId: 'RUN-ORDER-ORCA-TEST',
    cacheHit: false,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server' as const,
    visitDate: '2026-03-09',
  },
  variant: 'embedded' as const,
  bundlesOverride: [] as [],
};

const chargeProps = {
  ...baseProps,
  entity: 'baseChargeOrder',
  title: '基本料編集',
  bundleLabel: '算定',
  itemQuantityLabel: '回数',
};

const injectionProps = {
  ...baseProps,
  entity: 'injectionOrder',
  title: '注射編集',
  bundleLabel: '注射オーダー名',
  itemQuantityLabel: '回数',
};

const radiologyProps = {
  ...baseProps,
  entity: 'radiologyOrder',
  title: '放射線編集',
  bundleLabel: '放射線オーダー名',
  itemQuantityLabel: '回数',
};

const otherProps = {
  ...baseProps,
  entity: 'otherOrder',
  title: 'その他オーダー編集',
  bundleLabel: 'オーダー名',
  itemQuantityLabel: '回数',
};

const testProps = {
  ...baseProps,
  entity: 'testOrder',
  title: '検査編集',
  bundleLabel: '検査名',
  itemQuantityLabel: '回数',
};

const bacteriaProps = {
  ...baseProps,
  entity: 'bacteriaOrder',
  title: '細菌検査編集',
  bundleLabel: '検査名',
  itemQuantityLabel: '回数',
};

const renderPanel = (props?: Partial<typeof baseProps>) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <OrderBundleEditPanel {...baseProps} {...props} />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('OrderBundleEditPanel ORCA support', () => {
  it('600系は subtype/local-only field の送信契約を明示する', () => {
    renderPanel(testProps);

    expect(
      screen.getByText(
        '600系 subtype・院内補足・自由メモは local-only です。ORCA送信 grouping には classCode 600 とコード付き行だけを使用します。',
      ),
    ).toBeInTheDocument();
  });

  it('physiologyOrder も 600 local-only 契約を明示する', () => {
    renderPanel({
      ...testProps,
      entity: 'physiologyOrder',
      title: '生理検査編集',
    });

    expect(
      screen.getByText(
        '600系 subtype・院内補足・自由メモは local-only です。ORCA送信 grouping には classCode 600 とコード付き行だけを使用します。',
      ),
    ).toBeInTheDocument();
  });
  it('otherOrder は local-only field の送信契約を明示する', () => {
    renderPanel(otherProps);

    expect(
      screen.getByText(
        'setCode は展開専用です。otherOrder は etensu category 8 のコード付き行のみを扱い、bodyPart は保存しません。オーダー名・指示・自由メモは院内補足として保存します。',
      ),
    ).toBeInTheDocument();
  });

  it('charge は unit/local-only/comment parameter の送信契約を明示する', () => {
    renderPanel(chargeProps);

    expect(
      screen.getByText(
        'setCode は展開専用です。数量/単位は ORCA 送信し、算定指示・院内補足・自由メモは院内補足としてのみ保持します。選択式コメントの parameter 付き候補は追加できません。',
      ),
    ).toBeInTheDocument();
  });

  it('injectionOrder は route/timing/dosePerDay/speed と注射コメントの送信契約を明示する', () => {
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    renderPanel(injectionProps);

    expect(
      screen.getByText(
        '注射送信では admin/adminCode・回数・coded row と rowRole を使います。用法候補の route/timing/dosePerDay は参照表示のみで、adminMemo/speed と行ごとの注射コメントは local-only です。',
      ),
    ).toBeInTheDocument();
  });

  it('treatmentOrder は bundleName/admin/memo の local-only 契約を明示する', () => {
    renderPanel({
      entity: 'treatmentOrder',
      title: '処置編集',
      bundleLabel: '処置オーダー名',
      itemQuantityLabel: '回数',
    });

    expect(
      screen.getByText(
        '処置送信では classCode・bodyPart・coded row のみを使います。オーダー名・処置指示・自由メモは院内ローカル情報として保持し、ORCA 送信 payload には含めません。',
      ),
    ).toBeInTheDocument();
  });

  it('radiologyOrder は instruction/memo/item memo の local-only 契約を明示する', () => {
    renderPanel(radiologyProps);

    expect(
      screen.getByText(
        '放射線送信では bodyPart・coded row・classCode を使います。検査指示・自由メモ・item memo は院内ローカル情報として保持し、ORCA 送信 payload には含めません。',
      ),
    ).toBeInTheDocument();
  });

  it('点数検索（詳細）は値保持と invalid range を扱う', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });

    renderPanel();

    await user.click(screen.getByRole('button', { name: '開く' }));
    await user.type(screen.getByLabelText('点数From'), '20');
    await user.type(screen.getByLabelText('点数To'), '40');

    expect(screen.getByText('点数: 20〜40')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '閉じる' }));
    await user.click(screen.getByRole('button', { name: '開く' }));

    expect(screen.getByLabelText('点数From')).toHaveValue('20');
    expect(screen.getByLabelText('点数To')).toHaveValue('40');

    await user.clear(screen.getByLabelText('点数To'));
    await user.type(screen.getByLabelText('点数To'), '10');

    expect(screen.getByText('点数From は 点数To 以下で入力してください。')).toBeInTheDocument();
  });

  it('空フォームでは ORCA診療セットを即時反映する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [{ setCode: 'P02001', name: '処置セット', entity: 'generalOrder', itemCount: 2 }],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'P02001',
      bundle: {
        entity: 'generalOrder',
        sourceSetCode: 'P02001',
        bundleName: '創傷処置セット',
        bundleNumber: '1',
        admin: '適宜',
        adminMemo: '運用前確認',
        memo: '消毒後に実施',
        started: '2026-03-09',
        bodyPart: { code: '002001', name: '膝関節', quantity: '1', unit: '部位', memo: '', rowRole: 'bodyPart' },
        items: [
          { code: '140000610', name: '創傷処置（１００ｃｍ２未満）', quantity: '1', unit: '回', memo: '', rowRole: 'main' },
          { code: '700000021', name: '処置材料A', quantity: '1', unit: '個', memo: '', rowRole: 'material' },
          { code: '0085001', name: '注意事項', quantity: '', unit: '', memo: '術前確認', rowRole: 'comment' },
        ],
      },
    });

    renderPanel();

    expect(
      screen.getByText(
        '処置送信では classCode・bodyPart・coded row のみを使います。オーダー名・処置指示・自由メモは院内ローカル情報として保持し、ORCA 送信 payload には含めません。',
      ),
    ).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('診療セット名またはコード'), '処置');
    await user.click(screen.getByRole('button', { name: 'セット検索' }));
    await user.click(await screen.findByRole('button', { name: /P02001.*処置セット.*反映/ }));

    expect(screen.queryByText('診療セットを反映しますか？')).toBeNull();
    expect(screen.getByLabelText('オーダー名')).toHaveValue('創傷処置セット');
    expect(screen.getByLabelText('部位', { selector: 'input' })).toHaveValue('膝関節');
    expect(screen.getByLabelText('院内補足')).toHaveValue('運用前確認');
    expect(screen.getByDisplayValue('処置材料A')).toBeInTheDocument();
    expect(screen.getByText('反映元 setCode: P02001（local-only）')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const payload = vi.mocked(mutateOrderBundles).mock.calls[0]?.[0];
    const operation = payload?.operations?.[0];
    expect(operation?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: '140000610', rowRole: 'main' }),
        expect.objectContaining({ code: '700000021', rowRole: 'material', unit: '個' }),
        expect.objectContaining({ code: '0085001', rowRole: 'comment' }),
      ]),
    );
  });

  it('非空フォームでは confirm 後に ORCA診療セットを反映する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [{ setCode: 'P02001', name: '処置セット', entity: 'generalOrder', itemCount: 2 }],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'P02001',
      bundle: {
        entity: 'generalOrder',
        bundleName: '創傷処置セット',
        bundleNumber: '1',
        admin: '適宜',
        started: '2026-03-09',
        items: [{ code: '140000610', name: '創傷処置（１００ｃｍ２未満）', quantity: '1', unit: '回', memo: '' }],
      },
    });

    renderPanel();

    await user.type(screen.getByLabelText('オーダー名'), '既存内容');
    await user.type(screen.getByPlaceholderText('診療セット名またはコード'), '処置');
    await user.click(screen.getByRole('button', { name: 'セット検索' }));
    await user.click(await screen.findByRole('button', { name: /P02001.*処置セット.*反映/ }));

    expect(await screen.findByText('診療セットを反映しますか？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(screen.getByLabelText('オーダー名')).toHaveValue('既存内容');

    await user.click(screen.getByRole('button', { name: /P02001.*処置セット.*反映/ }));
    await user.click(await screen.findByRole('button', { name: '反映する' }));

    expect(screen.getByLabelText('オーダー名')).toHaveValue('創傷処置セット');
  });

  it('entity 不一致の診療セットは warning で中断する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [{ setCode: 'P02001', name: '処置セット', entity: 'generalOrder', itemCount: 2 }],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'P02001',
      bundle: {
        entity: 'radiologyOrder',
        bundleName: '画像セット',
        bundleNumber: '1',
        items: [{ code: '170017510', name: 'ＣＴ撮影', quantity: '1', unit: '回', memo: '' }],
      },
    });

    renderPanel();

    await user.type(screen.getByPlaceholderText('診療セット名またはコード'), '処置');
    await user.click(screen.getByRole('button', { name: 'セット検索' }));
    await user.click(await screen.findByRole('button', { name: /P02001.*処置セット.*反映/ }));

    expect(await screen.findByText('entity が一致しないため診療セットを反映できません。')).toBeInTheDocument();
    expect(screen.getByLabelText('オーダー名')).toHaveValue('');
  });

  it('generalOrder に treatmentOrder の診療セット詳細を反映できる', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [{ setCode: 'P02001', name: '処置セット', entity: 'generalOrder', itemCount: 1 }],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'P02001',
      bundle: {
        entity: 'treatmentOrder',
        bundleName: '創傷処置セット',
        bundleNumber: '1',
        items: [{ code: '140000610', name: '創傷処置（１００ｃｍ２未満）', quantity: '1', unit: '回', memo: '' }],
      },
    });

    renderPanel();

    await user.type(screen.getByPlaceholderText('診療セット名またはコード'), '処置');
    await user.click(screen.getByRole('button', { name: 'セット検索' }));
    await user.click(await screen.findByRole('button', { name: /P02001.*処置セット.*反映/ }));

    expect(screen.getByLabelText('オーダー名')).toHaveValue('創傷処置セット');
    expect(screen.queryByText('entity が一致しないため診療セットを反映できません。')).toBeNull();
  });

  it('baseChargeOrder の ORCA診療セット適用後も class meta を保存 payload で保持する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [{ setCode: 'B13001', name: '在宅指導セット', entity: 'baseChargeOrder', itemCount: 1 }],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'B13001',
      bundle: {
        entity: 'baseChargeOrder',
        bundleName: '在宅指導セット',
        bundleNumber: '1',
        classCode: '130',
        classCodeSystem: 'Claim007',
        className: '指導・在宅',
        adminMemo: '算定前確認',
        items: [{ code: '112007410', name: '在宅自己注射指導管理料', quantity: '1', unit: '回', memo: '' }],
      },
    });

    renderPanel(chargeProps);

    await user.type(screen.getByPlaceholderText('診療セット名またはコード'), '在宅');
    await user.click(screen.getByRole('button', { name: 'セット検索' }));
    await user.click(await screen.findByRole('button', { name: /B13001.*在宅指導セット.*反映/ }));

    expect(screen.getByLabelText('算定')).toHaveValue('在宅指導セット');
    expect(screen.getByLabelText('院内補足')).toHaveValue('算定前確認');

    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const payload = vi.mocked(mutateOrderBundles).mock.calls[0]?.[0];
    const operation = payload?.operations?.[0];
    expect(operation?.entity).toBe('baseChargeOrder');
    expect(operation?.classCode).toBe('130');
    expect(operation?.classCodeSystem).toBe('Claim007');
    expect(operation?.className).toBe('指導・在宅');
    expect(operation?.adminMemo).toBe('算定前確認');
  });

  it('radiologyOrder の ORCA診療セット適用後も bodyPart と class meta を保存 payload で保持する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [{ setCode: 'R70001', name: '胸部CTセット', entity: 'radiologyOrder', itemCount: 2 }],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'R70001',
      bundle: {
        entity: 'radiologyOrder',
        sourceSetCode: 'R70001',
        bundleName: '胸部CTセット',
        bundleNumber: '3',
        classCode: '700',
        classCodeSystem: 'Claim007',
        className: '放射線',
        bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '', rowRole: 'bodyPart' },
        items: [
          { code: '170017510', name: 'ＣＴ撮影', quantity: '1', unit: '回', memo: '', rowRole: 'main' },
          { code: '700000001', name: '造影剤', quantity: '1', unit: '本', memo: '', rowRole: 'material' },
        ],
      },
    });

    renderPanel(radiologyProps);

    await user.type(screen.getByPlaceholderText('診療セット名またはコード'), '胸部');
    await user.click(screen.getByRole('button', { name: 'セット検索' }));
    await user.click(await screen.findByRole('button', { name: /R70001.*胸部CTセット.*反映/ }));

    expect(screen.getByLabelText('放射線オーダー名')).toHaveValue('胸部CTセット');
    expect(screen.getByLabelText('部位', { selector: 'input' })).toHaveValue('胸部');

    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const payload = vi.mocked(mutateOrderBundles).mock.calls[0]?.[0];
    const operation = payload?.operations?.[0];
    expect(operation?.entity).toBe('radiologyOrder');
    expect(operation?.classCode).toBe('700');
    expect(operation?.classCodeSystem).toBe('Claim007');
    expect(operation?.className).toBe('放射線');
    expect(operation?.bodyPart).toEqual(expect.objectContaining({ code: '002001', name: '胸部', unit: '部位' }));
    expect(operation?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: '170017510', unit: '回', rowRole: 'main' }),
        expect.objectContaining({ code: '700000001', unit: '本', rowRole: 'material' }),
      ]),
    );
  });

  it('otherOrder の ORCA診療セット適用後も explicit class meta を保存 payload で保持する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [{ setCode: 'O80001', name: '文書料セット', entity: 'otherOrder', itemCount: 1 }],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'O80001',
      bundle: {
        entity: 'otherOrder',
        sourceSetCode: 'O80001',
        bundleName: '文書料セット',
        bundleNumber: '5',
        classCode: '800',
        classCodeSystem: 'Claim007',
        className: 'その他',
        items: [{ code: '180000210', name: '診断書料', quantity: '1', unit: '回', memo: '' }],
      },
    });

    renderPanel(otherProps);

    await user.type(screen.getByPlaceholderText('診療セット名またはコード'), '文書');
    await user.click(screen.getByRole('button', { name: 'セット検索' }));
    await user.click(await screen.findByRole('button', { name: /O80001.*文書料セット.*反映/ }));

    expect(screen.getByLabelText('オーダー名')).toHaveValue('文書料セット');
    expect(screen.getByText('反映元 setCode: O80001（local-only）')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const payload = vi.mocked(mutateOrderBundles).mock.calls[0]?.[0];
    const operation = payload?.operations?.[0];
    expect(operation?.entity).toBe('otherOrder');
    expect(operation?.classCode).toBe('800');
    expect(operation?.classCodeSystem).toBe('Claim007');
    expect(operation?.className).toBe('その他');
    expect(operation?.items).toEqual(expect.arrayContaining([expect.objectContaining({ code: '180000210', unit: '回' })]));
  });

  it('testOrder は laboTest 入力セット詳細を canonical entity のまま保存 payload に変換する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [{ setCode: 'T60001', name: '血液検査セット', entity: 'laboTest', itemCount: 1 }],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'T60001',
      bundle: {
        entity: 'laboTest',
        bundleName: '血液検査セット',
        bundleNumber: '2',
        classCode: '600',
        classCodeSystem: 'Claim007',
        className: '検査',
        adminMemo: '至急',
        items: [{ code: '160000010', name: '血液一般', quantity: '1', unit: '回', memo: '' }],
      },
    });

    renderPanel(testProps);

    await user.type(screen.getByPlaceholderText('診療セット名またはコード'), '血液');
    await user.click(screen.getByRole('button', { name: 'セット検索' }));
    await user.click(await screen.findByRole('button', { name: /T60001.*血液検査セット.*反映/ }));

    expect(screen.getByLabelText('検査名')).toHaveValue('血液検査セット');
    expect(screen.getByLabelText('院内補足')).toHaveValue('至急');

    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const payload = vi.mocked(mutateOrderBundles).mock.calls[0]?.[0];
    const operation = payload?.operations?.[0];
    expect(operation?.entity).toBe('testOrder');
    expect(operation?.classCode).toBe('600');
    expect(operation?.classCodeSystem).toBe('Claim007');
    expect(operation?.className).toBe('検査');
    expect(operation?.adminMemo).toBe('至急');
    expect(operation?.items).toEqual(expect.arrayContaining([expect.objectContaining({ code: '160000010', unit: '回' })]));
  });

  it('bacteriaOrder は testOrder の 600 input set detail を受け入れて subtype を保持する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [{ setCode: 'B60001', name: '細菌培養セット', entity: 'bacteriaOrder', itemCount: 1 }],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'B60001',
      bundle: {
        entity: 'testOrder',
        bundleName: '細菌培養セット',
        bundleNumber: '1',
        subtype: 'culture',
        classCode: '600',
        classCodeSystem: 'Claim007',
        className: '検査',
        adminMemo: '48h incubate',
        items: [{ code: '160000010', name: '培養検査', quantity: '1', unit: '回', memo: '' }],
      },
    });

    renderPanel(bacteriaProps);

    await user.type(screen.getByPlaceholderText('診療セット名またはコード'), '細菌');
    await user.click(screen.getByRole('button', { name: 'セット検索' }));
    await user.click(await screen.findByRole('button', { name: /B60001.*細菌培養セット.*反映/ }));

    expect(screen.getByLabelText('検査名')).toHaveValue('細菌培養セット');
    expect(screen.getByLabelText('細菌検査 subtype')).toHaveValue('culture');
    expect(screen.getByLabelText('院内補足')).toHaveValue('48h incubate');

    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const payload = vi.mocked(mutateOrderBundles).mock.calls[0]?.[0];
    const operation = payload?.operations?.[0];
    expect(operation?.entity).toBe('bacteriaOrder');
    expect(operation?.subtype).toBe('culture');
    expect(operation?.classCode).toBe('600');
    expect(operation?.classCodeSystem).toBe('Claim007');
    expect(operation?.adminMemo).toBe('48h incubate');
    expect(operation?.items).toEqual(expect.arrayContaining([expect.objectContaining({ code: '160000010', unit: '回' })]));
  });

  it('injectionOrder で 7xxxx 候補を main 行に選ぶと material 行へ昇格する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockImplementation(async (params) => {
      if (typeof params?.keyword === 'string' && params.keyword.includes('注射薬A')) {
        return {
          ok: true,
          items: [
            {
              type: params.type ?? 'drug',
              code: '620000010',
              name: '注射薬A',
              unit: 'ampoule',
              note: '',
            },
          ],
          totalCount: 1,
        } as any;
      }
      if (typeof params?.keyword === 'string' && params.keyword.includes('ドリップ')) {
        return {
          ok: true,
          items: [
            {
              type: params.type ?? 'etensu',
              code: '700000031',
              name: 'ドリップセット',
              unit: 'set',
              note: '',
            },
          ],
          totalCount: 1,
        } as any;
      }
      return { ok: true, items: [], totalCount: 0 } as any;
    });

    renderPanel(injectionProps);

    const [firstMainInput] = screen.getAllByPlaceholderText('注射薬剤または手技名');
    await user.type(firstMainInput, '注射薬A');
    await waitFor(() =>
      expect(vi.mocked(fetchOrderMasterSearch)).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: '注射薬A' }),
      ),
    );
    await user.tab();
    await waitFor(() => expect(screen.getByDisplayValue('注射薬A')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '追加' }));

    const mainInputsAfterAppend = screen.getAllByPlaceholderText('注射薬剤または手技名');
    const secondMainInput = mainInputsAfterAppend[mainInputsAfterAppend.length - 1];
    await user.type(secondMainInput, 'ドリップセット');
    await waitFor(() =>
      expect(vi.mocked(fetchOrderMasterSearch)).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: 'ドリップセット' }),
      ),
    );
    await user.tab();

    await waitFor(() => expect(screen.getByDisplayValue('ドリップセット')).toBeInTheDocument());
    expect(screen.getByText('材料行')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const payload = vi.mocked(mutateOrderBundles).mock.calls[0]?.[0];
    const operation = payload?.operations?.[0];
    expect(operation?.items).toEqual(expect.arrayContaining([expect.objectContaining({ code: '700000031', rowRole: 'material' })]));
    expect(operation?.items).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: '700000031', rowRole: 'main' })]));
  });

  it('treatmentOrder で main row と material row を UI から作成して rowRole を保持する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockImplementation(async (params) => {
      if (typeof params?.keyword === 'string' && params.keyword.includes('創傷処置')) {
        return {
          ok: true,
          items: [
            {
              type: 'etensu',
              code: '140000610',
              name: '創傷処置（１００ｃｍ２未満）',
              unit: '回',
              note: '',
            },
          ],
          totalCount: 1,
        } as any;
      }
      if (typeof params?.keyword === 'string' && params.keyword.includes('処置材料B')) {
        return {
          ok: true,
          items: [
            {
              type: 'material',
              code: '700000022',
              name: '処置材料B',
              unit: '個',
              note: '',
            },
          ],
          totalCount: 1,
        } as any;
      }
      return { ok: true, items: [], totalCount: 0 } as any;
    });

    renderPanel({
      entity: 'treatmentOrder',
      title: '処置編集',
      bundleLabel: '処置オーダー名',
      itemQuantityLabel: '回数',
    });

    const [mainInput] = screen.getAllByPlaceholderText('処置項目名');
    await user.type(mainInput, '創傷処置（１００ｃｍ２未満）');
    await waitFor(() =>
      expect(vi.mocked(fetchOrderMasterSearch)).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: '創傷処置（１００ｃｍ２未満）' }),
      ),
    );
    await user.tab();
    await waitFor(() => expect(screen.getByDisplayValue('創傷処置（１００ｃｍ２未満）')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '追加' }));
    const appendedInputs = screen.getAllByPlaceholderText('処置項目名');
    const secondMainInput = appendedInputs[appendedInputs.length - 1];
    await user.type(secondMainInput, '処置材料B');
    await waitFor(() =>
      expect(vi.mocked(fetchOrderMasterSearch)).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: '処置材料B' }),
      ),
    );
    await user.tab();

    await waitFor(() => expect(screen.getByDisplayValue('処置材料B')).toBeInTheDocument());
    expect(screen.getByText('材料行')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const payload = vi.mocked(mutateOrderBundles).mock.calls[0]?.[0];
    const operation = payload?.operations?.[0];
    expect(operation?.entity).toBe('treatmentOrder');
    expect(operation?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: '140000610', rowRole: 'main' }),
        expect.objectContaining({ code: '700000022', rowRole: 'material', unit: '個' }),
      ]),
    );
  });

  it('treatmentOrder の warning focus は bodyPart/main/material/comment の順で正しい入力欄へ飛ぶ', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [{ setCode: 'P02001', name: '処置セット', entity: 'generalOrder', itemCount: 3 }],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'P02001',
      bundle: {
        entity: 'generalOrder',
        sourceSetCode: 'P02001',
        bundleName: '創傷処置セット',
        bundleNumber: '1',
        admin: '適宜',
        adminMemo: '運用前確認',
        memo: '消毒後に実施',
        started: '2026-03-09',
        bodyPart: { code: '002001', name: '膝関節', quantity: '1', unit: '部位', memo: '', rowRole: 'bodyPart' },
        items: [
          { code: '140000610', name: '創傷処置（１００ｃｍ２未満）', quantity: '1', unit: '回', memo: '', rowRole: 'main' },
          { code: '700000021', name: '処置材料A', quantity: '1', unit: '個', memo: '', rowRole: 'material' },
          { code: '0085001', name: '注意事項', quantity: '', unit: '', memo: '術前確認', rowRole: 'comment' },
        ],
      },
    });

    renderPanel({
      entity: 'treatmentOrder',
      title: '処置編集',
      bundleLabel: '処置オーダー名',
      itemQuantityLabel: '回数',
    });

    await user.type(screen.getByPlaceholderText('診療セット名またはコード'), '処置');
    await user.click(screen.getByRole('button', { name: 'セット検索' }));
    await user.click(await screen.findByRole('button', { name: /P02001.*処置セット.*反映/ }));
    await screen.findByText('反映元 setCode: P02001（local-only）');

    const dispatchWarning = (sourceItemIndex: number) => {
      window.dispatchEvent(
        new CustomEvent('orca-medical-warning-focus', {
          detail: {
            patientId: 'P-ORDER-001',
            warning: {
              entity: 'treatmentOrder',
              sourceKind: 'bundle_item',
              sourceItemIndex,
              medicalWarning: 'WARN',
              medicalWarningMessage: 'WARN',
              medicalWarningCode: 'W001',
            },
          },
        }),
      );
    };

    dispatchWarning(0);
    await waitFor(() => expect(document.activeElement).toHaveAttribute('id', 'treatmentOrder-bodypart'));

    dispatchWarning(1);
    await waitFor(() => expect(document.activeElement).toHaveAttribute('id', 'treatmentOrder-item-name-0'));

    dispatchWarning(2);
    await waitFor(() => expect(document.activeElement).toHaveAttribute('id', 'treatmentOrder-material-name-0'));

    dispatchWarning(3);
    await waitFor(() => expect(document.activeElement).toHaveAttribute('id', 'treatmentOrder-comment-name-0'));
  });
});
