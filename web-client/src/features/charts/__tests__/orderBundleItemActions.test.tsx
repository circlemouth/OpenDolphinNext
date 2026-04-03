import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { OrderBundleEditPanel } from '../OrderBundleEditPanel';
import { mutateOrderBundles } from '../orderBundleApi';
import { fetchOrderMasterSearch } from '../orderMasterSearchApi';

vi.mock('../orderBundleApi', async () => ({
  fetchOrderBundles: vi.fn().mockResolvedValue({
    ok: true,
    bundles: [],
    patientId: 'P-1',
  }),
  mutateOrderBundles: vi.fn().mockResolvedValue({ ok: true, runId: 'RUN-ORDER' }),
}));

vi.mock('../stampApi', async () => ({
  fetchUserProfile: vi.fn().mockResolvedValue({ ok: true, id: 1, userId: 'facility:doctor' }),
  fetchStampTree: vi.fn().mockResolvedValue({ ok: true, trees: [] }),
  fetchStampDetail: vi.fn(),
}));

vi.mock('../orderMasterSearchApi', async () => ({
  fetchOrderMasterSearch: vi.fn(),
}));

const renderWithClient = (ui: ReactElement) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
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
  bundleLabel: '注射オーダー名',
  itemQuantityLabel: '回数',
};
const generalProps = {
  ...baseProps,
  entity: 'generalOrder',
  title: '一般オーダー編集',
  bundleLabel: 'オーダー名',
  itemQuantityLabel: '回数',
};
const chargeProps = {
  ...baseProps,
  entity: 'baseChargeOrder',
  title: '基本料編集',
  bundleLabel: '算定',
  itemQuantityLabel: '回数',
};

const recentUsageStorageKey = 'charts-order-recent-usage:unknown-facility:unknown-user:medOrder';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('OrderBundleEditPanel item actions', () => {
  const mockUsageMaster = () => {
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type, keyword }) => {
      if (type === 'youhou') {
        return {
          ok: true,
          items: [{ type: 'youhou', name: '1回' }],
          totalCount: 1,
        };
      }
      if (type === 'drug' && keyword.trim().length > 0) {
        return {
          ok: true,
          items: [
            { type: 'drug', code: '620001402', name: 'アムロジピン', unit: '錠' },
            { type: 'drug', code: '620009876', name: 'テルミサルタン', unit: '錠' },
          ],
          totalCount: 2,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });
  };

  const selectUsage = async (user: ReturnType<typeof userEvent.setup>) => {
    const usageSelect = screen.getByLabelText('用法') as HTMLSelectElement;
    let optionValue = '';
    await waitFor(() => {
      const targetOption = Array.from(usageSelect.options).find((option) => option.text === '1回');
      expect(targetOption).toBeDefined();
      optionValue = targetOption?.value ?? '';
      expect(optionValue).not.toBe('');
    });
    await user.selectOptions(usageSelect, optionValue);
    expect(usageSelect.selectedOptions[0]?.text).toBe('1回');
  };

  const fillDrugRow = async (
    user: ReturnType<typeof userEvent.setup>,
    rowIndex: number,
    drugName: string,
  ) => {
    const nameInputs = screen.getAllByPlaceholderText('薬剤名') as HTMLInputElement[];
    await user.clear(nameInputs[rowIndex]);
    await user.type(nameInputs[rowIndex], drugName);
    await waitFor(() => {
      const options = Array.from(
        document.querySelectorAll('datalist[id$="-item-predictive-list"] option'),
      ) as HTMLOptionElement[];
      expect(options.some((option) => (option.getAttribute('value') ?? '').includes(drugName))).toBe(true);
    });
    await user.tab();
  };

  it('injectionOrder は注射コメントを first-class userComment として保持し hidden meta を再送しない', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    renderWithClient(
      <OrderBundleEditPanel
        {...injectionProps}
        request={{
          requestId: 'REQ-INJECTION-1',
          kind: 'edit',
          bundle: {
            entity: 'injectionOrder',
            bundleName: '点滴セット',
            bundleNumber: '2',
            classCode: '310',
            classCodeSystem: 'Claim007',
            className: 'Injection',
            admin: '静注',
            adminCode: '4101',
            adminMemo: '20ml/h',
            items: [
              {
                code: '620000001',
                name: '注射薬A',
                quantity: '1',
                unit: 'A',
                memo: '__orca_meta__:{"genericFlg":"no","userComment":"旧コメント"}\nレセ本文',
                rowRole: 'main',
              },
            ],
          },
        }}
      />,
    );

    expect(
      await screen.findByText(/admin\/adminCode・回数・coded row と rowRole.*注射コメントは local-only/i),
    ).toBeInTheDocument();

    const commentInput = (await screen.findByLabelText('注射コメント 1')) as HTMLInputElement;
    expect(commentInput.value).toBe('旧コメント');
    await user.clear(commentInput);
    await user.type(commentInput, '更新コメント');
    await user.click(screen.getByRole('button', { name: '保存して続ける' }));

    const mutateMock = vi.mocked(mutateOrderBundles);
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());

    const savedItem = mutateMock.mock.calls.at(-1)?.[0]?.operations?.[0]?.items?.[0];
    expect(savedItem).toMatchObject({
      code: '620000001',
      genericFlg: 'no',
      userComment: '更新コメント',
      rowRole: 'main',
    });
    expect(savedItem?.memo).toBe('レセ本文');
  });

  it('末尾行に入力すると空行が自動追加される', async () => {
    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const nameInputsBefore = screen.getAllByPlaceholderText('薬剤名') as HTMLInputElement[];
    expect(nameInputsBefore).toHaveLength(1);

    await user.type(nameInputsBefore[0], 'ア');

    await waitFor(() => {
      const nameInputsAfter = screen.getAllByPlaceholderText('薬剤名') as HTMLInputElement[];
      expect(nameInputsAfter).toHaveLength(2);
      expect(nameInputsAfter[0]?.value).toBe('ア');
      expect(nameInputsAfter[1]?.value).toBe('');
    });
  });

  it('空行は待機行として強調表示され、行削除ボタンを表示しない', async () => {
    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const initialRows = screen.getAllByTestId('order-bundle-item-row');
    expect(initialRows).toHaveLength(1);
    expect(initialRows[0]).toHaveClass('charts-side-panel__item-row--inactive');
    expect(screen.queryByLabelText('行 1 を削除')).not.toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('薬剤名') as HTMLInputElement;
    await user.type(nameInput, 'ア');

    await waitFor(() => {
      const rows = screen.getAllByTestId('order-bundle-item-row');
      expect(rows).toHaveLength(2);
      expect(rows[1]).toHaveClass('charts-side-panel__item-row--inactive');
      expect(screen.getByLabelText('行 1 を削除')).toBeInTheDocument();
      expect(screen.queryByLabelText('行 2 を削除')).not.toBeInTheDocument();
    });
  });

  it('入力順が保存 payload に反映される', async () => {
    mockUsageMaster();
    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const itemSectionLabel = screen
      .getAllByText('処方薬剤')
      .find((node) => node.tagName.toLowerCase() === 'strong');
    const itemSection = itemSectionLabel?.closest('.charts-side-panel__subsection') as HTMLElement | null;
    if (!itemSection) throw new Error('処方薬剤セクションが見つかりません');
    await user.click(within(itemSection).getByRole('button', { name: '追加' }));

    await fillDrugRow(user, 0, 'アムロジピン');
    await fillDrugRow(user, 1, 'テルミサルタン');

    await selectUsage(user);

    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const mutateMock = vi.mocked(mutateOrderBundles);
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());

    const payload = mutateMock.mock.calls[0]?.[0];
    const items = payload?.operations?.[0]?.items ?? [];
    expect(items.map((item: { name: string }) => item.name)).toEqual(['アムロジピン', 'テルミサルタン']);
  });

  it('頓用/院内の選択とRP名補正が保存 payload に反映される', async () => {
    mockUsageMaster();
    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    await fillDrugRow(user, 0, 'アムロジピン');

    await user.click(screen.getByRole('button', { name: '院内' }));
    await user.click(screen.getByRole('button', { name: '頓用' }));

    await selectUsage(user);
    await user.clear(screen.getByLabelText('回数'));
    await user.type(screen.getByLabelText('回数'), '3');

    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const mutateMock = vi.mocked(mutateOrderBundles);
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());

    const payload = mutateMock.mock.calls[0]?.[0];
    const operation = payload?.operations?.[0];
    expect(operation?.bundleName).toBe('アムロジピン');
    expect(operation?.bundleNumber).toBe('3');
    expect(operation?.admin).toBe('1回');
    expect(operation?.classCode).toBe('221');
    expect(operation?.classCodeSystem).toBe('Claim007');
    expect(operation?.className).toBe('頓服薬剤（院内処方）');
  });

  it('generalOrder は仕様準拠の Medical_Class を保存 payload に付与する', async () => {
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type, keyword }) => {
      if (type === 'etensu' && keyword.includes('創傷処置')) {
        return {
          ok: true,
          items: [{ type: 'etensu', code: '140000610', name: '創傷処置', unit: '回', category: '4' }],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });
    renderWithClient(<OrderBundleEditPanel {...generalProps} />);

    const itemInput = screen.getByPlaceholderText('処置項目名') as HTMLInputElement;
    await user.type(itemInput, '創傷処置');
    await waitFor(() =>
      expect(
        searchMock.mock.calls.some(
          ([params]) => params?.type === 'etensu' && params?.keyword === '創傷処置',
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(document.querySelector('datalist[id$="-item-predictive-list"] option[value="創傷処置"]')).not.toBeNull(),
    );
    await user.tab();
    await waitFor(() => expect(screen.getByTestId('order-bundle-item-summary-0')).toHaveTextContent('コード: 140000610'));
    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const mutateMock = vi.mocked(mutateOrderBundles);
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());

    const payload = mutateMock.mock.calls[0]?.[0];
    const operation = payload?.operations?.[0];
    expect(operation?.classCode).toBe('400');
    expect(operation?.classCodeSystem).toBe('Claim007');
    expect(operation?.className).toBe('処置');
  });

  it('baseChargeOrder の再編集保存は explicit class meta を潰さない', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <OrderBundleEditPanel
        {...chargeProps}
        request={{
          requestId: 'req-charge-edit',
          kind: 'edit',
          bundle: {
            documentId: 10,
            moduleId: 20,
            entity: 'baseChargeOrder',
            bundleName: '在宅指導',
            bundleNumber: '1',
            classCode: '130',
            classCodeSystem: 'Claim007',
            className: '指導・在宅',
            admin: '',
            adminMemo: '',
            memo: '確認',
            started: '2026-03-09',
            items: [{ code: '1300001', name: '在宅患者訪問診療料', quantity: '1', unit: '回', memo: '' }],
          },
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: '保存して更新する' }));

    const mutateMock = vi.mocked(mutateOrderBundles);
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());

    const payload = mutateMock.mock.calls[0]?.[0];
    const operation = payload?.operations?.[0];
    expect(operation?.classCode).toBe('130');
    expect(operation?.classCodeSystem).toBe('Claim007');
    expect(operation?.className).toBe('指導・在宅');
  });

  it('外用の混合トグルで混合コメント行が保存 payload に追加される', async () => {
    mockUsageMaster();
    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    await fillDrugRow(user, 0, 'アムロジピン');
    await selectUsage(user);

    await user.click(screen.getByRole('button', { name: '外用' }));
    await user.click(screen.getByLabelText('混合'));

    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const mutateMock = vi.mocked(mutateOrderBundles);
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());
    const payload = mutateMock.mock.calls[0]?.[0];
    const items = payload?.operations?.[0]?.items ?? [];
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: '810000001',
          name: '混合',
          memo: '__mixing_comment__',
        }),
      ]),
    );
  });

  it('一般名指示と薬剤コメントが薬剤行ごとに memo meta へ共存保存される', async () => {
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type, keyword }) => {
      if (type === 'youhou') {
        return {
          ok: true,
          items: [{ type: 'youhou', name: '1回' }],
          totalCount: 1,
        };
      }
      if (type === 'drug' && keyword.trim().length > 0) {
        return {
          ok: true,
          items: [
            {
              type: 'drug',
              code: '612345678',
              name: 'アムロジピン',
              unit: '錠',
              note: '元メモ',
            },
          ],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });

    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const nameInput = screen.getByPlaceholderText('薬剤名') as HTMLInputElement;
    await user.click(nameInput);
    await user.type(nameInput, 'アムロジピン');
    await waitFor(() =>
      expect(document.querySelector('datalist[id$="-item-predictive-list"] option[value="アムロジピン"]')).not.toBeNull(),
    );
    await user.tab();

    const genericGroup = screen.getAllByRole('group', { name: '一般名' })[0];
    const genericOnButton = within(genericGroup).getByRole('button', { name: '一般名' });
    await waitFor(() => expect(genericOnButton).toBeEnabled());
    await user.click(genericOnButton);
    await user.type(screen.getByLabelText('薬剤コメント 1'), '食後');

    await selectUsage(user);

    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const mutateMock = vi.mocked(mutateOrderBundles);
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());

    const payload = mutateMock.mock.calls[0]?.[0];
    const items = payload?.operations?.[0]?.items ?? [];
    expect(items[0]).toMatchObject({
      genericFlg: 'yes',
      userComment: '食後',
      memo: '元メモ',
    });
  });

  it('空白のみ薬剤コメントは memo meta から除去される', async () => {
    mockUsageMaster();
    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    await fillDrugRow(user, 0, 'アムロジピン');
    await user.type(screen.getByLabelText('薬剤コメント 1'), '   ');
    await selectUsage(user);

    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    const mutateMock = vi.mocked(mutateOrderBundles);
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());

    const payload = mutateMock.mock.calls[0]?.[0];
    const items = payload?.operations?.[0]?.items ?? [];
    expect(items[0]?.memo ?? '').toBe('');
    expect(items[0]?.userComment).toBeUndefined();
  });

  it('最近使った用法セレクトで用法欄を上書きできる', async () => {
    const user = userEvent.setup();
    localStorage.setItem(recentUsageStorageKey, JSON.stringify(['1日2回 朝夕食後', '1日1回 朝']));
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    await user.selectOptions(screen.getByLabelText('最近使った用法'), '1日2回 朝夕食後');
    const usageSelect = screen.getByLabelText('用法') as HTMLSelectElement;
    await waitFor(() => expect(usageSelect.selectedOptions[0]?.text).toBe('1日2回 朝夕食後'));
  });

  it('保存成功時に最近使った用法履歴へ追加される', async () => {
    mockUsageMaster();
    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    await fillDrugRow(user, 0, 'アムロジピン');
    await selectUsage(user);
    await user.click(screen.getByRole('button', { name: '保存して追加する' }));

    await waitFor(() => expect(vi.mocked(mutateOrderBundles)).toHaveBeenCalled());
    const stored = localStorage.getItem(recentUsageStorageKey);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored ?? '[]')[0]).toBe('1回');
  });

  it('injectionOrder でも用法候補を利用でき、経路コード順で表示される', async () => {
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type }) => {
      if (type === 'youhou') {
        return {
          ok: true,
          items: [
            { type: 'youhou', code: 'Y900', name: '外用候補', routeCode: 'TOP', timingCode: '03' },
            { type: 'youhou', code: 'Y100', name: '静注候補', routeCode: 'IV', timingCode: '03' },
          ],
          totalCount: 2,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });

    renderWithClient(<OrderBundleEditPanel {...injectionProps} />);

    const usageSelect = screen.getByLabelText('投与指示') as HTMLSelectElement;
    await waitFor(() => expect(usageSelect.options.length).toBeGreaterThan(2));
    expect(usageSelect.options[1]?.text).toBe('静注候補');
    expect(usageSelect.options[2]?.text).toBe('外用候補');
    await user.selectOptions(usageSelect, usageSelect.options[1]?.value ?? '');
    expect(usageSelect.selectedOptions[0]?.text).toBe('静注候補');
    expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'youhou', keyword: '', allowEmpty: true }));
  });

  it.each([
    ['readOnly', { readOnly: true, readOnlyReason: '閲覧専用' }],
    ['missingMaster', { missingMaster: true }],
    ['fallbackUsed', { fallbackUsed: true }],
  ])('編集ガード中(%s)は追加/入力/行削除が無効化される', (_, meta) => {
    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        meta={{
          ...baseProps.meta,
          ...meta,
        }}
      />,
    );

    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled();
    const nameInput = screen.getByPlaceholderText('薬剤名') as HTMLInputElement;
    expect(nameInput).toBeDisabled();
    expect(screen.getByRole('button', { name: '選択行削除' })).toBeDisabled();
    expect(screen.queryByLabelText('行 1 を削除')).not.toBeInTheDocument();
  });

  it('行削除で最終行が初期化される', async () => {
    const user = userEvent.setup();

    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const nameInput = screen.getByPlaceholderText('薬剤名') as HTMLInputElement;
    await user.type(nameInput, 'A');
    const rowDeleteButton = await screen.findByLabelText('行 1 を削除');
    await user.click(rowDeleteButton);

    const cleared = screen.getAllByPlaceholderText('薬剤名') as HTMLInputElement[];
    expect(cleared).toHaveLength(1);
    expect(cleared[0].value).toBe('');
  });

  it('+薬剤/削除/全クリアで入力行とコメント行をまとめて初期化できる', async () => {
    const user = userEvent.setup();
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

    const { container } = renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    const itemSectionLabel = screen
      .getAllByText('処方薬剤')
      .find((node) => node.tagName.toLowerCase() === 'strong');
    const itemSection = itemSectionLabel?.closest('.charts-side-panel__subsection') as HTMLElement | null;
    if (!itemSection) throw new Error('処方薬剤セクションが見つかりません');

    await user.click(within(itemSection).getByRole('button', { name: '追加' }));
    expect(screen.getAllByPlaceholderText('薬剤名')).toHaveLength(2);

    const firstNameInput = screen.getAllByPlaceholderText('薬剤名')[0] as HTMLInputElement;
    await user.type(firstNameInput, 'ア');
    const rowDeleteButton = await screen.findByLabelText('行 1 を削除');
    await user.click(rowDeleteButton);
    expect(screen.getAllByPlaceholderText('薬剤名')).toHaveLength(1);

    const commentDraftCodeInput = container.querySelector<HTMLInputElement>('input[id$="-comment-draft-code"]');
    const commentDraftNameInput = container.querySelector<HTMLInputElement>('input[id$="-comment-draft-name"]');
    expect(commentDraftCodeInput).not.toBeNull();
    expect(commentDraftNameInput).not.toBeNull();
    await user.type(commentDraftCodeInput!, '0082');
    await user.type(commentDraftNameInput!, '服薬');
    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'comment', keyword: '服薬' })),
    );
    await user.clear(commentDraftNameInput!);
    await user.type(commentDraftNameInput!, '服薬指示');
    await user.click(screen.getByRole('button', { name: 'コメント追加' }));
    expect(container.querySelector<HTMLInputElement>('input[id$="-comment-code-0"]')?.value).toBe('0082');

    await user.click(screen.getByRole('button', { name: '全クリア' }));
    const dialog = await screen.findByRole('alertdialog', { name: '入力を全クリアしますか？' });
    await user.click(within(dialog).getByRole('button', { name: 'クリアする' }));

    const clearedNameInputs = screen.getAllByPlaceholderText('薬剤名') as HTMLInputElement[];
    expect(clearedNameInputs).toHaveLength(1);
    expect(clearedNameInputs[0]?.value).toBe('');
    expect(container.querySelector('input[id$="-comment-code-0"]')).toBeNull();
  });

  it.skip('コメントコードを複数追加し、数量編集と個別削除ができる', async () => {
    const user = userEvent.setup();
    const searchMock = vi.mocked(fetchOrderMasterSearch);
    searchMock.mockImplementation(async ({ type, keyword }) => {
      if (type === 'comment' && keyword.includes('服薬')) {
        return {
          ok: true,
          items: [{ type: 'comment', code: '0082', name: '服薬指示', unit: '', note: '' }],
          totalCount: 1,
        };
      }
      if (type === 'comment' && keyword.includes('就寝')) {
        return {
          ok: true,
          items: [{ type: 'comment', code: '0083', name: '就寝前服用', unit: '', note: '' }],
          totalCount: 1,
        };
      }
      return { ok: true, items: [], totalCount: 0 };
    });

    const { container } = renderWithClient(<OrderBundleEditPanel {...baseProps} />);
    const commentDraftCodeInput = container.querySelector<HTMLInputElement>('input[id$="-comment-draft-code"]');
    const commentDraftNameInput = container.querySelector<HTMLInputElement>('input[id$="-comment-draft-name"]');
    expect(commentDraftCodeInput).not.toBeNull();
    expect(commentDraftNameInput).not.toBeNull();

    await user.type(commentDraftCodeInput!, '0082');
    await user.type(commentDraftNameInput!, '服薬');
    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'comment', keyword: '服薬' })),
    );
    await user.clear(commentDraftNameInput!);
    await user.type(commentDraftNameInput!, '服薬指示');
    await user.click(screen.getByRole('button', { name: 'コメント追加' }));

    await user.type(commentDraftCodeInput!, '{selectall}0083');
    await user.type(commentDraftNameInput!, '{selectall}就寝');
    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'comment', keyword: '就寝' })),
    );
    await user.type(commentDraftNameInput!, '{selectall}就寝前服用');
    await user.click(screen.getByRole('button', { name: 'コメント追加' }));

    expect(container.querySelector<HTMLInputElement>('input[id$="-comment-name-0"]')?.value).toBe('服薬指示');
    expect(container.querySelector<HTMLInputElement>('input[id$="-comment-name-1"]')?.value).toBe('就寝前服用');

    const quantityInput0 = container.querySelector<HTMLInputElement>('input[id$="-comment-quantity-0"]');
    expect(quantityInput0).not.toBeNull();
    await user.type(quantityInput0!, '2');
    expect(quantityInput0?.value).toBe('2');

    const secondCommentNameInput = container.querySelector<HTMLInputElement>('input[id$="-comment-name-1"]');
    const secondRow = secondCommentNameInput?.closest('.charts-side-panel__item-row');
    const deleteButton = secondRow?.querySelector('button');
    expect(deleteButton).not.toBeNull();
    await user.click(deleteButton as HTMLButtonElement);

    expect(container.querySelector('input[id$="-comment-name-1"]')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[id$="-comment-name-0"]')?.value).toBe('服薬指示');
  });
});
